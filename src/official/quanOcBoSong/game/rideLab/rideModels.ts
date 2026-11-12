// ⚠️ FROZEN COPY of src/game/rideLab/rideModels.ts for the official "Quán Ốc Bờ Sông" map (promoted 2026-11-12).
// Develop in the original (Dev Mode) and run `yarn promote:quan-oc` to update this copy;
// edit here only for urgent production fixes (they are overwritten by the next promote).
/**
 * Ride Lab vehicles: the player's underbone scooter with rider (Wave / Dream style,
 * real size: 1.9 m long, 17" wheels), plus merged low-cost traffic scooters and cars.
 * Bike local frame: forward +Z, up +Y, rider's right = -X.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BikeSpec } from './bikePhysics';

const std = (color: THREE.ColorRepresentation, roughness = 0.5, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const glow = (color: THREE.ColorRepresentation, intensity: number) =>
  new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity });

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}
const rbox = (w: number, h: number, d: number, r = 0.04) => new RoundedBoxGeometry(w, h, d, 3, r);

/** A cylinder from `a` to `b` (arms, legs, fork tubes, stalks). */
function limb(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) {
  const length = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.9, length, 10), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

function wheel(spoke: THREE.Material, withDisc: boolean) {
  const group = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.058, 14, 40), std(0x161616, 0.85));
  tire.rotation.y = Math.PI / 2;
  group.add(tire);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 8, 40), std(0xcbd5e1, 0.25, 0.9));
  rim.rotation.y = Math.PI / 2;
  group.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 16), std(0x9ca3af, 0.3, 0.8));
  hub.rotation.z = Math.PI / 2;
  group.add(hub);
  for (let i = 0; i < 5; i++) {
    const s = mesh(new THREE.BoxGeometry(0.02, 0.36, 0.035), spoke);
    s.rotation.x = (i / 5) * Math.PI;
    group.add(s);
  }
  if (withDisc) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.01, 28), std(0xd4d4d8, 0.35, 0.9));
    disc.rotation.z = Math.PI / 2;
    disc.position.x = 0.065;
    group.add(disc);
  }
  return group;
}

function plateTexture(text: string) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 120);
  ctx.fillStyle = '#111';
  ctx.font = '900 46px sans-serif';
  ctx.textAlign = 'center';
  const [top, bottom] = text.split(' ');
  ctx.fillText(top, 128, 56);
  ctx.fillText(bottom, 128, 108);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface RideBikeModel {
  root: THREE.Group;
  /** Rolls about the ground contact line. */
  lean: THREE.Group;
  /** Rotates the fork, front wheel and bars. */
  steer: THREE.Group;
  frontWheel: THREE.Group;
  rearWheel: THREE.Group;
  kickstand: THREE.Group;
  brakeLight: THREE.MeshStandardMaterial;
  headLens: THREE.MeshStandardMaterial;
  signals: { left: THREE.MeshStandardMaterial; right: THREE.MeshStandardMaterial };
  /** Head and torso: hidden in first-person view. */
  riderBody: THREE.Object3D[];
  /** Where the eyes are (bike local), for the first-person camera. */
  eye: THREE.Vector3;
}

export function createRideBike(spec: BikeSpec, options: { rider?: boolean; plate?: string; shirt?: number; helmet?: number } = {}): RideBikeModel {
  const root = new THREE.Group();
  root.name = 'RideBike';
  const lean = new THREE.Group();
  root.add(lean);
  const paint = new THREE.MeshPhysicalMaterial({ color: spec.color, roughness: 0.32, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const trim = std(spec.accent, 0.4, 0.2);
  const black = std(0x18181b, 0.6);
  const chrome = std(0xe5e7eb, 0.15, 1);
  const engineGrey = std(0x52525b, 0.45, 0.6);

  // ---- Wheels ----
  const rearWheel = wheel(black, false);
  rearWheel.position.set(0, 0.31, -0.62);
  lean.add(rearWheel);

  // ---- Frame, engine, body ----
  lean.add(mesh(rbox(0.3, 0.26, 0.38, 0.05), engineGrey, 0, 0.36, -0.06));
  lean.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 20), chrome, 0.15, 0.34, -0.02).rotateZ(Math.PI / 2));
  // Swingarm.
  lean.add(limb(new THREE.Vector3(0.09, 0.33, -0.15), new THREE.Vector3(0.09, 0.31, -0.62), 0.025, black));
  lean.add(limb(new THREE.Vector3(-0.09, 0.33, -0.15), new THREE.Vector3(-0.09, 0.31, -0.62), 0.025, black));
  // Rear shocks.
  [0.13, -0.13].forEach((x) => lean.add(limb(new THREE.Vector3(x, 0.33, -0.6), new THREE.Vector3(x, 0.72, -0.48), 0.02, chrome)));
  // Exhaust on the right side with a heat shield.
  const pipe = limb(new THREE.Vector3(-0.08, 0.3, 0.05), new THREE.Vector3(-0.17, 0.33, -0.78), 0.042, chrome);
  lean.add(pipe);
  lean.add(mesh(rbox(0.04, 0.09, 0.4, 0.02), black, -0.215, 0.36, -0.42));
  // Underbone tunnel, floorboards, leg shield.
  lean.add(mesh(rbox(0.18, 0.2, 0.5, 0.06), paint, 0, 0.55, 0.12));
  lean.add(mesh(rbox(0.5, 0.05, 0.36, 0.02), black, 0, 0.42, 0.14));
  const shield = mesh(rbox(0.46, 0.62, 0.08, 0.05), paint, 0, 0.72, 0.42);
  shield.rotation.x = -0.28;
  lean.add(shield);
  // Rear body (side covers + tail) and the seat.
  lean.add(mesh(rbox(0.32, 0.3, 0.78, 0.09), paint, 0, 0.7, -0.38));
  lean.add(mesh(rbox(0.335, 0.06, 0.6, 0.03), trim, 0, 0.62, -0.38)); // side stripe
  lean.add(mesh(rbox(0.3, 0.11, 0.72, 0.05), std(0x0c0c0e, 0.7), 0, 0.89, -0.3));
  // Rear rack, fender, taillight, plate.
  lean.add(mesh(new THREE.BoxGeometry(0.26, 0.02, 0.24), chrome, 0, 0.88, -0.72));
  const fender = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.045, 8, 20, Math.PI * 0.55), black);
  fender.rotation.set(0, Math.PI / 2, Math.PI * 0.5);
  fender.position.set(0, 0.31, -0.62);
  lean.add(fender);
  const brakeLight = glow(0xff1a1a, 1.2);
  lean.add(mesh(rbox(0.16, 0.06, 0.06, 0.02), brakeLight, 0, 0.74, -0.8));
  const plate = mesh(new THREE.PlaneGeometry(0.19, 0.14), new THREE.MeshStandardMaterial({ map: plateTexture(options.plate ?? '59-X1 123.45'), roughness: 0.6 }), 0, 0.6, -0.84);
  plate.rotation.y = Math.PI;
  plate.rotation.x = -0.15;
  lean.add(plate);
  const signalLeft = glow(0xff8a00, 0.2);
  const signalRight = glow(0xff8a00, 0.2);
  lean.add(mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), signalLeft, 0.15, 0.74, -0.79));
  lean.add(mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), signalRight, -0.15, 0.74, -0.79));
  // Footpegs.
  [0.2, -0.2].forEach((x) => lean.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), black, x, 0.36, -0.3).rotateZ(Math.PI / 2)));

  // ---- Kickstand (left side, +X), hinged near the engine ----
  const kickstand = new THREE.Group();
  kickstand.position.set(0.12, 0.3, -0.12);
  kickstand.add(limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.3, 0), 0.016, black));
  lean.add(kickstand);

  // ---- Steering: fork, front wheel, cowl, headlight, bars, mirrors ----
  const steer = new THREE.Group();
  steer.position.set(0, 0.95, 0.5); // steering head
  lean.add(steer);
  const frontWheel = wheel(black, true);
  frontWheel.position.set(0, 0.31 - 0.95, 0.62 - 0.5);
  steer.add(frontWheel);
  [0.07, -0.07].forEach((x) =>
    steer.add(limb(new THREE.Vector3(x, 0.05, -0.02), new THREE.Vector3(x, 0.31 - 0.95, 0.12), 0.022, chrome))
  );
  const frontFender = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.04, 8, 20, Math.PI * 0.5), paint);
  frontFender.rotation.set(0, Math.PI / 2, Math.PI * 0.25);
  frontFender.position.copy(frontWheel.position);
  steer.add(frontFender);
  steer.add(mesh(rbox(0.32, 0.28, 0.24, 0.08), paint, 0, 0.08, 0.06));
  const headLens = glow(0xfff4d6, 3.5);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), headLens);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.09, 0.18);
  steer.add(lens);
  steer.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.64, 10), chrome, 0, 0.17, -0.02).rotateZ(Math.PI / 2));
  [0.29, -0.29].forEach((x) => steer.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 10), black, x, 0.17, -0.02).rotateZ(Math.PI / 2)));
  [0.24, -0.24].forEach((x) => {
    steer.add(limb(new THREE.Vector3(x, 0.17, 0), new THREE.Vector3(x * 1.15, 0.42, -0.04), 0.008, chrome));
    const mirror = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.015, 20), black, x * 1.15, 0.44, -0.04);
    mirror.rotation.x = Math.PI / 2;
    steer.add(mirror);
    steer.add(mesh(new THREE.CircleGeometry(0.048, 20), std(0xbfdbfe, 0.05, 1), x * 1.15, 0.44, -0.05).rotateY(Math.PI));
  });
  // Speedo pod facing the rider.
  const pod = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 24), black, 0, 0.22, -0.06);
  pod.rotation.x = -1.1;
  steer.add(pod);
  steer.add(mesh(new THREE.CircleGeometry(0.06, 24), glow(0x7dd3fc, 0.6), 0, 0.225, -0.085).rotateX(-1.1 - Math.PI / 2 + Math.PI));
  [0.17, -0.17].forEach((x, i) => steer.add(mesh(new THREE.BoxGeometry(0.06, 0.04, 0.05), i === 0 ? signalLeft : signalRight, x, 0.06, 0.16)));

  // ---- Rider ----
  const riderBody: THREE.Object3D[] = [];
  if (options.rider !== false) {
    const shirt = std(options.shirt ?? 0x1e40af, 0.8);
    const pants = std(0x27272a, 0.85);
    const skin = std(0xd6a77a, 0.7);
    const helmet = new THREE.MeshPhysicalMaterial({ color: options.helmet ?? 0xfacc15, roughness: 0.3, clearcoat: 1 });
    const hip = new THREE.Vector3(0, 0.98, -0.32);
    const torso = limb(hip, new THREE.Vector3(0, 1.5, -0.12), 0.17, shirt);
    lean.add(torso);
    const head = mesh(new THREE.SphereGeometry(0.11, 18, 14), skin, 0, 1.68, -0.06);
    lean.add(head);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), helmet);
    lid.position.set(0, 1.7, -0.07);
    lean.add(lid);
    const mask = mesh(new THREE.SphereGeometry(0.1, 16, 10, -0.9, 1.8, Math.PI * 0.5, Math.PI * 0.32), std(0x60a5fa, 0.9), 0, 1.66, -0.04);
    lean.add(mask);
    riderBody.push(torso, head, lid, mask);
    [1, -1].forEach((side) => {
      const shoulder = new THREE.Vector3(0.19 * side, 1.43, -0.14);
      const elbow = new THREE.Vector3(0.27 * side, 1.22, 0.12);
      const grip = new THREE.Vector3(0.29 * side, 1.12, 0.48);
      lean.add(limb(shoulder, elbow, 0.05, shirt));
      lean.add(limb(elbow, grip, 0.042, skin));
      const knee = new THREE.Vector3(0.18 * side, 0.82, 0.12);
      lean.add(limb(new THREE.Vector3(0.11 * side, 0.98, -0.28), knee, 0.075, pants));
      lean.add(limb(knee, new THREE.Vector3(0.16 * side, 0.46, 0.16), 0.06, pants));
      lean.add(mesh(rbox(0.1, 0.07, 0.24, 0.03), std(0x111111, 0.6), 0.16 * side, 0.45, 0.22)); // dép
    });
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  return {
    root,
    lean,
    steer,
    frontWheel,
    rearWheel,
    kickstand,
    brakeLight,
    headLens,
    signals: { left: signalLeft, right: signalRight },
    riderBody,
    // A little behind and below the real eyes so the bars, mirrors and speedo are in frame.
    eye: new THREE.Vector3(0, 1.52, -0.36),
  };
}

/** Bakes a group into one mesh per material (cheap static traffic). */
export function mergeByMaterial(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const local = new THREE.Matrix4();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()) as THREE.BufferGeometry;
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    g.clearGroups();
    g.applyMatrix4(local.multiplyMatrices(inverse, m.matrixWorld));
    const list = buckets.get(m.material as THREE.Material) ?? [];
    list.push(g);
    buckets.set(m.material as THREE.Material, list);
  });
  const out = new THREE.Group();
  buckets.forEach((list, material) => {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (merged) out.add(new THREE.Mesh(merged, material));
  });
  return out;
}

const SHIRTS = [0xdc2626, 0x16a34a, 0xf59e0b, 0x7c3aed, 0x0ea5e9, 0xf4f4f5, 0xdb2777];
const HELMETS = [0xfacc15, 0xef4444, 0x3b82f6, 0xf8fafc, 0x10b981, 0x111827];

/** A traffic scooter with a rider, merged (no moving parts). */
export function createTrafficScooter(seed: number, spec: BikeSpec) {
  const bike = createRideBike(
    { ...spec, color: ['#b91c1c', '#1d4ed8', '#111827', '#e5e7eb', '#15803d', '#9333ea'][seed % 6] },
    { shirt: SHIRTS[seed % SHIRTS.length], helmet: HELMETS[(seed * 3) % HELMETS.length], plate: `5${seed % 10}-B${seed % 4} ${100 + seed * 7}.${10 + seed}` }
  );
  return mergeByMaterial(bike.root);
}

/** A small hatchback / taxi, merged. */
export function createTrafficCar(seed: number) {
  const car = new THREE.Group();
  const colors = [0x16a34a, 0xf8fafc, 0x1f2937, 0xdc2626, 0x0369a1];
  const body = new THREE.MeshPhysicalMaterial({ color: colors[seed % colors.length], roughness: 0.3, metalness: 0.4, clearcoat: 1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1220, roughness: 0.05, metalness: 0.6 });
  const tire = std(0x111111, 0.8);
  car.add(mesh(rbox(1.7, 0.6, 3.9, 0.18), body, 0, 0.62, 0));
  car.add(mesh(rbox(1.5, 0.55, 2.1, 0.2), body, 0, 1.15, -0.25));
  car.add(mesh(rbox(1.52, 0.42, 1.9, 0.16), glass, 0, 1.17, -0.25));
  [
    [0.78, 1.25],
    [-0.78, 1.25],
    [0.78, -1.25],
    [-0.78, -1.25],
  ].forEach(([x, z]) => car.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.24, 20), tire, x, 0.32, z).rotateZ(Math.PI / 2)));
  [0.55, -0.55].forEach((x) => {
    car.add(mesh(rbox(0.36, 0.12, 0.05, 0.03), glow(0xfff4d6, 4), x, 0.75, 1.95));
    car.add(mesh(rbox(0.3, 0.12, 0.05, 0.03), glow(0xff1a1a, 2), x, 0.8, -1.95));
  });
  if (seed % 2 === 0) {
    // Taxi roof sign.
    car.add(mesh(rbox(0.5, 0.16, 0.22, 0.04), glow(0xfef08a, 1.5), 0, 1.5, -0.3));
  }
  return mergeByMaterial(car);
}
