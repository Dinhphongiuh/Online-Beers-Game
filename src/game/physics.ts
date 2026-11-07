import * as THREE from 'three';
import type RAPIER_NS from '@dimforge/rapier3d-compat';
import type { PropSnapshot } from '../../shared/tableNet';

type Rapier = typeof RAPIER_NS;
type RigidBody = RAPIER_NS.RigidBody;
type Collider = RAPIER_NS.Collider;
type World = RAPIER_NS.World;

let rapierPromise: Promise<Rapier> | null = null;

/** Lazy-loads the Rapier WASM (≈2 MB) only once the match scene needs physics. */
export function loadRapier(): Promise<Rapier> {
  if (!rapierPromise) {
    rapierPromise = import('@dimforge/rapier3d-compat').then(async (mod) => {
      const R = ((mod as unknown as { default?: Rapier }).default ?? mod) as Rapier;
      await R.init();
      return R;
    });
  }
  return rapierPromise;
}

const FIXED_DT = 1 / 60;
const MAX_SUBSTEPS = 4;

/** Deterministic layout so every client at the table starts with the same cans. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// TABLE PROPS: empty cans, bottles and flying slippers (dép tổ ong)
// ============================================================================

const TABLE_TOP_Y = 0.98;
const TABLE_RADIUS = 1.55;

interface PhysProp {
  id: string;
  kind: 'can' | 'bottle' | 'slipper';
  body: RigidBody;
  collider: Collider;
  mesh: THREE.Object3D;
  /** Local client streams this prop until then (ms timestamp). */
  ownedUntil: number;
  /** A remote owner is driving this prop until then; we only interpolate. */
  remoteUntil: number;
  targetPos: THREE.Vector3;
  targetQuat: THREE.Quaternion;
  expiresAt?: number;
  /** Only the thrower's copy of a slipper reports hits. */
  isLocalThrow?: boolean;
  hitIds?: Set<string>;
}

export interface CharacterProxy {
  id: string;
  x: number;
  y: number;
  z: number;
}

function makeCanMesh(color: number) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.033, 0.033, 0.12, 14),
    new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.3 })
  );
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.029, 0.033, 0.008, 14),
    new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.25 })
  );
  lid.position.y = 0.064;
  g.add(body, lid);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

function makeBottleMesh() {
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({
    color: 0x166534,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.17, 14), glass);
  body.position.y = -0.035;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.034, 0.07, 12), glass);
  neck.position.y = 0.085;
  g.add(body, neck);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

function makeSlipperMesh(color: number) {
  const g = new THREE.Group();
  const sole = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.025, 0.26),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
  );
  // Honeycomb-ish holes as dark dots on top
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  for (let i = 0; i < 10; i++) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.009, 6), holeMat);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(((i % 3) - 1) * 0.026, 0.0135, -0.1 + Math.floor(i / 3) * 0.045);
    g.add(hole);
  }
  const strap = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.012, 6, 14, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 })
  );
  strap.position.set(0, 0.012, 0.03);
  g.add(sole, strap);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

const CAN_COLORS = [0xb91c1c, 0x15803d, 0xca8a04, 0x1d4ed8, 0xb91c1c, 0x15803d];

export class TablePhysics {
  readonly group = new THREE.Group();
  /** Fired at ~15 Hz with the props this client currently owns (to stream over the network). */
  onSnapshot?: (props: PropSnapshot[]) => void;
  /** A locally thrown slipper hit somebody (player id). */
  onSlipperHit?: (playerId: string) => void;

  private world: World;
  private props = new Map<string, PhysProp>();
  private characters = new Map<string, { body: RigidBody; collider: Collider }>();
  private acc = 0;
  private snapshotAcc = 0;
  private slipperSeq = 0;
  private _v = new THREE.Vector3();
  private _q = new THREE.Quaternion();

  constructor(private R: Rapier, private localTag: string) {
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });

    // Sidewalk
    this.world.createCollider(R.ColliderDesc.cuboid(30, 0.1, 30).setTranslation(0, -0.1, 0).setFriction(0.9));
    // Stainless table top (cylinder: half height, radius)
    this.world.createCollider(
      R.ColliderDesc.cylinder(0.03, TABLE_RADIUS)
        .setTranslation(0, TABLE_TOP_Y - 0.03, 0)
        .setFriction(0.45)
        .setRestitution(0.25)
    );

    const rand = mulberry32(8888);
    let canIdx = 0;
    for (let i = 0; i < 12; i++) {
      const a = rand() * Math.PI * 2;
      const r = 1.22 + rand() * 0.24;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (i % 4 === 3) this.addProp(`bottle_${i}`, 'bottle', x, z, rand() * 6);
      else this.addProp(`can_${canIdx++}`, 'can', x, z, rand() * 6, CAN_COLORS[i % CAN_COLORS.length]);
    }
  }

  private addProp(id: string, kind: 'can' | 'bottle', x: number, z: number, yaw: number, color = 0xb91c1c) {
    const R = this.R;
    const halfH = kind === 'can' ? 0.06 : 0.12;
    const radius = kind === 'can' ? 0.033 : 0.038;
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(x, TABLE_TOP_Y + halfH + 0.002, z)
        .setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw))
        .setCcdEnabled(true)
        .setLinearDamping(0.15)
        .setAngularDamping(0.4)
    );
    const collider = this.world.createCollider(
      R.ColliderDesc.cylinder(halfH, radius)
        .setDensity(kind === 'can' ? 180 : 650)
        .setFriction(0.5)
        .setRestitution(kind === 'can' ? 0.35 : 0.2),
      body
    );
    const mesh = kind === 'can' ? makeCanMesh(color) : makeBottleMesh();
    this.group.add(mesh);
    this.props.set(id, {
      id,
      kind,
      body,
      collider,
      mesh,
      ownedUntil: 0,
      remoteUntil: 0,
      targetPos: new THREE.Vector3(),
      targetQuat: new THREE.Quaternion(),
    });
  }

  /** Spawns a flying slipper. Local throws return the id used on the network. */
  throwSlipper(
    origin: [number, number, number],
    velocity: [number, number, number],
    opts: { local: boolean; id?: string }
  ) {
    const R = this.R;
    const id = opts.id ?? `slipper_${this.localTag}_${this.slipperSeq++}`;
    this.props.get(id) && this.removeProp(id);
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(origin[0], origin[1], origin[2])
        .setLinvel(velocity[0], velocity[1], velocity[2])
        .setAngvel({ x: 9 + Math.random() * 6, y: Math.random() * 4 - 2, z: Math.random() * 3 })
        .setCcdEnabled(true)
    );
    const collider = this.world.createCollider(
      R.ColliderDesc.cuboid(0.05, 0.0125, 0.13)
        .setDensity(420)
        .setFriction(0.8)
        .setRestitution(0.3)
        .setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      body
    );
    const mesh = makeSlipperMesh(opts.local ? 0x2563eb : 0xdc2626);
    this.group.add(mesh);
    const prop: PhysProp = {
      id,
      kind: 'slipper',
      body,
      collider,
      mesh,
      ownedUntil: opts.local ? Date.now() + 4000 : 0,
      remoteUntil: 0,
      targetPos: new THREE.Vector3(),
      targetQuat: new THREE.Quaternion(),
      expiresAt: Date.now() + 9000,
      isLocalThrow: opts.local,
      hitIds: new Set(),
    };
    this.props.set(id, prop);
    return id;
  }

  /** Fist on the table ("RẦM!"): everything loose hops. */
  slam(strength = 1) {
    const now = Date.now();
    this.props.forEach((p) => {
      if (p.kind === 'slipper') return;
      const t = p.body.translation();
      if (t.y < TABLE_TOP_Y - 0.05) return; // already on the floor
      const m = p.body.mass();
      p.body.applyImpulse(
        { x: (Math.random() - 0.5) * 0.6 * m * strength, y: (1.4 + Math.random() * 1.2) * m * strength, z: (Math.random() - 0.5) * 0.6 * m * strength },
        true
      );
      p.body.applyTorqueImpulse(
        { x: (Math.random() - 0.5) * 0.004 * strength, y: (Math.random() - 0.5) * 0.002, z: (Math.random() - 0.5) * 0.004 * strength },
        true
      );
      p.ownedUntil = now + 3500;
      p.remoteUntil = 0;
    });
  }

  /** Lật bàn: launches everything off the table, outward and up. */
  flip(fromX = 0, fromZ = 2) {
    const now = Date.now();
    this.props.forEach((p) => {
      if (p.kind === 'slipper') return;
      const t = p.body.translation();
      this._v.set(t.x - fromX * 0.3, 0, t.z - fromZ * 0.3).normalize();
      const m = p.body.mass();
      p.body.applyImpulse(
        { x: this._v.x * (2.5 + Math.random() * 2) * m, y: (3.5 + Math.random() * 2.5) * m, z: this._v.z * (2.5 + Math.random() * 2) * m },
        true
      );
      p.body.applyTorqueImpulse(
        { x: (Math.random() - 0.5) * 0.02, y: (Math.random() - 0.5) * 0.01, z: (Math.random() - 0.5) * 0.02 },
        true
      );
      p.ownedUntil = now + 5000;
      p.remoteUntil = 0;
    });
  }

  /** Puts every can/bottle back on the table (new round). */
  reset() {
    const rand = mulberry32(8888);
    let i = 0;
    this.props.forEach((p) => {
      if (p.kind === 'slipper') return;
      const a = rand() * Math.PI * 2;
      const r = 1.22 + rand() * 0.24;
      const halfH = p.kind === 'can' ? 0.06 : 0.12;
      p.body.setTranslation({ x: Math.cos(a) * r, y: TABLE_TOP_Y + halfH + 0.002, z: Math.sin(a) * r }, true);
      p.body.setRotation(this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6), true);
      p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      p.ownedUntil = Date.now() + 1500;
      p.remoteUntil = 0;
      i++;
    });
    return i;
  }

  /** Remote owner's transforms: we stop simulating those props and glide to them. */
  applyRemote(snapshots: PropSnapshot[]) {
    const now = Date.now();
    for (const s of snapshots) {
      let p = this.props.get(s.id);
      if (!p && s.id.startsWith('slipper_')) {
        this.throwSlipper(s.p, [0, 0, 0], { local: false, id: s.id });
        p = this.props.get(s.id);
      }
      if (!p) continue;
      // A prop we are actively throwing around wins over stale remote data
      if (p.ownedUntil > now) continue;
      p.remoteUntil = s.sleeping ? now + 400 : now + 600;
      p.targetPos.set(s.p[0], s.p[1], s.p[2]);
      p.targetQuat.set(s.q[0], s.q[1], s.q[2], s.q[3]);
    }
  }

  /** Kinematic capsules that follow the characters so slippers can bonk heads. */
  setCharacters(list: CharacterProxy[]) {
    const R = this.R;
    const seen = new Set<string>();
    for (const c of list) {
      seen.add(c.id);
      let entry = this.characters.get(c.id);
      if (!entry) {
        const body = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(c.x, c.y + 0.75, c.z));
        const collider = this.world.createCollider(R.ColliderDesc.capsule(0.45, 0.28).setFriction(0.6), body);
        entry = { body, collider };
        this.characters.set(c.id, entry);
      }
      entry.body.setNextKinematicTranslation({ x: c.x, y: c.y + 0.75, z: c.z });
    }
    this.characters.forEach((entry, id) => {
      if (seen.has(id)) return;
      this.world.removeRigidBody(entry.body);
      this.characters.delete(id);
    });
  }

  step(delta: number) {
    this.acc = Math.min(this.acc + delta, FIXED_DT * MAX_SUBSTEPS);
    let steps = 0;
    while (this.acc >= FIXED_DT && steps < MAX_SUBSTEPS) {
      this.driveRemoteProps(FIXED_DT);
      this.world.timestep = FIXED_DT;
      this.world.step();
      this.acc -= FIXED_DT;
      steps++;
    }
    if (steps) this.detectSlipperHits();

    const now = Date.now();
    this.props.forEach((p) => {
      if (p.expiresAt && now > p.expiresAt) {
        this.removeProp(p.id);
        return;
      }
      const t = p.body.translation();
      const r = p.body.rotation();
      p.mesh.position.set(t.x, t.y, t.z);
      p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      // Fell off the world? Put it back on the table edge.
      if (t.y < -2) {
        p.body.setTranslation({ x: 0, y: TABLE_TOP_Y + 0.3, z: 1.3 }, true);
        p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    });

    this.snapshotAcc += delta;
    if (this.snapshotAcc >= 1 / 15) {
      this.snapshotAcc = 0;
      const owned: PropSnapshot[] = [];
      this.props.forEach((p) => {
        if (p.ownedUntil < now) return;
        const t = p.body.translation();
        const r = p.body.rotation();
        owned.push({
          id: p.id,
          p: [round3(t.x), round3(t.y), round3(t.z)],
          q: [round3(r.x), round3(r.y), round3(r.z), round3(r.w)],
          sleeping: p.body.isSleeping(),
        });
      });
      if (owned.length) this.onSnapshot?.(owned);
    }
  }

  private driveRemoteProps(dt: number) {
    const now = Date.now();
    this.props.forEach((p) => {
      if (p.remoteUntil < now) return;
      const t = p.body.translation();
      const k = 1 - Math.exp(-18 * dt);
      this._v.set(t.x, t.y, t.z).lerp(p.targetPos, k);
      p.body.setTranslation(this._v, false);
      const r = p.body.rotation();
      this._q.set(r.x, r.y, r.z, r.w).slerp(p.targetQuat, k);
      p.body.setRotation(this._q, false);
      p.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      p.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    });
  }

  private detectSlipperHits() {
    this.props.forEach((p) => {
      if (p.kind !== 'slipper' || !p.isLocalThrow || !p.hitIds) return;
      this.characters.forEach((entry, playerId) => {
        if (p.hitIds!.has(playerId)) return;
        this.world.contactPair(p.collider, entry.collider, () => {
          if (p.hitIds!.has(playerId)) return;
          p.hitIds!.add(playerId);
          this.onSlipperHit?.(playerId);
        });
      });
    });
  }

  private removeProp(id: string) {
    const p = this.props.get(id);
    if (!p) return;
    this.world.removeRigidBody(p.body);
    this.group.remove(p.mesh);
    p.mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | undefined;
      mat?.dispose?.();
    });
    this.props.delete(id);
  }

  dispose() {
    [...this.props.keys()].forEach((id) => this.removeProp(id));
    this.world.free();
  }
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// ============================================================================
// MOTORBIKE SUSPENSION: Wave/Dream bobbing over ổ gà (potholes)
// ============================================================================

/**
 * The commute drive stays an on-rails lane model; Rapier only simulates the chassis on
 * two springs (front/rear fork) so hitting a pothole kicks the front, then the rear, and
 * the bike pitches and bounces for real. Output is a local offset for the bike pivot.
 */
export class BikeSuspension {
  private world: World;
  private chassis: RigidBody;
  private acc = 0;
  readonly offset = { y: 0, pitch: 0, roll: 0 };
  private R: Rapier;

  constructor(R: Rapier) {
    this.R = R;
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    const anchor = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    this.chassis = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(0, 0, 0)
        .setLinearDamping(0.6)
        .setAngularDamping(1.2)
        .enabledTranslations(false, true, false)
        .enabledRotations(true, false, true)
    );
    // ~110 kg bike + rider
    this.world.createCollider(R.ColliderDesc.cuboid(0.2, 0.3, 0.9).setDensity(110 / (0.4 * 0.6 * 1.8)), this.chassis);
    // Front & rear fork springs; rest length tuned so the chassis floats at y≈0
    const springs: [number, number][] = [
      [0, 0.75],
      [0, -0.75],
      [0.25, 0],
      [-0.25, 0],
    ];
    springs.forEach(([x, z], i) => {
      const stiffness = i < 2 ? 16000 : 6000;
      this.world.createImpulseJoint(
        R.JointData.spring(0.5, stiffness, i < 2 ? 900 : 500, { x, y: -0.5, z }, { x, y: 0, z }),
        anchor,
        this.chassis,
        true
      );
    });
  }

  /** Kick the front (+1) or rear (-1) wheel up, e.g. dropping into an ổ gà. */
  bump(wheel: 1 | -1, strength: number) {
    const m = this.chassis.mass();
    this.chassis.applyImpulseAtPoint(
      { x: 0, y: m * strength * (0.9 + Math.random() * 0.3), z: 0 },
      { x: 0, y: 0, z: 0.75 * wheel },
      true
    );
  }

  /** Small random roll/pitch shoves (drunk riding, crash). */
  shove(strength: number) {
    const m = this.chassis.mass();
    this.chassis.applyImpulseAtPoint(
      { x: 0, y: m * strength * (Math.random() - 0.3), z: 0 },
      { x: (Math.random() - 0.5) * 0.5, y: 0, z: (Math.random() - 0.5) * 1.4 },
      true
    );
  }

  step(delta: number) {
    this.acc = Math.min(this.acc + delta, FIXED_DT * MAX_SUBSTEPS);
    while (this.acc >= FIXED_DT) {
      this.world.timestep = FIXED_DT;
      this.world.step();
      this.acc -= FIXED_DT;
    }
    const t = this.chassis.translation();
    const r = this.chassis.rotation();
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w), 'XYZ');
    this.offset.y = THREE.MathUtils.clamp(t.y, -0.12, 0.25);
    this.offset.pitch = THREE.MathUtils.clamp(e.x, -0.25, 0.25);
    this.offset.roll = THREE.MathUtils.clamp(e.z, -0.2, 0.2);
  }

  dispose() {
    this.world.free();
  }
}
