/**
 * Dev Mode → Quán Ốc Bờ Sông: walk a VRM character around the map.
 *
 * WASD / arrow keys move relative to the camera, Shift runs, E sits on the
 * nearest free stool (or stands up). Collision is a flat 2D test against
 * circles and oriented boxes on the XZ plane, which is plenty for a bar floor.
 */
import * as THREE from 'three/webgpu';
import { VRM_MOVE_SPEED, type VrmCharacter } from './vrmCharacter';

export type Collider =
  | { kind: 'circle'; x: number; z: number; r: number }
  /** Box with half extents `hw` (local X) and `hd` (local Z), turned `yaw` about Y. */
  | { kind: 'box'; x: number; z: number; hw: number; hd: number; yaw: number };

export interface Seat {
  x: number;
  z: number;
  /** root.rotation.y that faces the table. */
  facing: number;
}

export interface PlayerBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Ground height under (x, z): the road is a step lower than the sidewalk. */
  groundY: (x: number, z: number) => number;
}

export interface PlayerController {
  readonly enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /** Moves the character; `cameraForward` is the camera's look direction. */
  update: (delta: number, cameraForward: THREE.Vector3) => void;
  /** Short hint for the UI ("Nhấn E để ngồi" …). */
  onStatus?: (status: string) => void;
  dispose: () => void;
}

const BODY_RADIUS = 0.28;
const SIT_REACH = 1.0;
const TURN_RATE = 12;
const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
};
const HANDLED = new Set([...Object.values(KEYS).flat(), 'KeyE']);

const up = new THREE.Vector3(0, 1, 0);
const local = new THREE.Vector3();

/** Pushes the circle at `p` (radius BODY_RADIUS) out of a collider. */
function resolve(p: THREE.Vector3, collider: Collider) {
  if (collider.kind === 'circle') {
    const dx = p.x - collider.x;
    const dz = p.z - collider.z;
    const min = collider.r + BODY_RADIUS;
    const distSq = dx * dx + dz * dz;
    if (distSq >= min * min) return;
    const dist = Math.sqrt(distSq) || 0.0001;
    p.x = collider.x + (dx / dist) * min;
    p.z = collider.z + (dz / dist) * min;
    return;
  }
  // Into the box's frame, resolve against an axis-aligned box, and back.
  local.set(p.x - collider.x, 0, p.z - collider.z).applyAxisAngle(up, -collider.yaw);
  const cx = THREE.MathUtils.clamp(local.x, -collider.hw, collider.hw);
  const cz = THREE.MathUtils.clamp(local.z, -collider.hd, collider.hd);
  const dx = local.x - cx;
  const dz = local.z - cz;
  const distSq = dx * dx + dz * dz;
  if (distSq > 0) {
    if (distSq >= BODY_RADIUS * BODY_RADIUS) return;
    const dist = Math.sqrt(distSq);
    local.x = cx + (dx / dist) * BODY_RADIUS;
    local.z = cz + (dz / dist) * BODY_RADIUS;
  } else {
    // Centre inside the box: leave through the nearest face.
    const exits = [
      collider.hw - local.x,
      collider.hw + local.x,
      collider.hd - local.z,
      collider.hd + local.z,
    ];
    const nearest = exits.indexOf(Math.min(...exits));
    if (nearest === 0) local.x = collider.hw + BODY_RADIUS;
    else if (nearest === 1) local.x = -collider.hw - BODY_RADIUS;
    else if (nearest === 2) local.z = collider.hd + BODY_RADIUS;
    else local.z = -collider.hd - BODY_RADIUS;
  }
  local.applyAxisAngle(up, collider.yaw);
  p.x = collider.x + local.x;
  p.z = collider.z + local.z;
}

const angleDamp = (current: number, target: number, rate: number, delta: number) => {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * (1 - Math.exp(-rate * delta));
};

export function createPlayerController(options: {
  character: VrmCharacter;
  colliders: Collider[];
  seats: Seat[];
  /** Seat indices taken by other characters. */
  occupied: Set<number>;
  /** Seat the character starts on (and returns to when control is turned off). */
  homeSeat: number;
  bounds: PlayerBounds;
}): PlayerController {
  const { character, colliders, seats, occupied, homeSeat, bounds } = options;
  const { root, state } = character;
  const pressed = new Set<string>();
  let enabled = false;
  let seat: number | null = homeSeat;
  let lastStatus = '';
  const position = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();

  const sitAt = (index: number) => {
    const target = seats[index];
    seat = index;
    root.position.set(target.x, 0, target.z);
    root.rotation.y = target.facing;
    state.pose = 'seated';
  };

  const nearestFreeSeat = () => {
    let best = -1;
    let bestDist = SIT_REACH;
    seats.forEach((candidate, index) => {
      if (occupied.has(index)) return;
      const dist = Math.hypot(candidate.x - root.position.x, candidate.z - root.position.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    return best;
  };

  const standUp = () => {
    if (seat === null) return;
    // Step back from the table so we don't start inside its collider.
    const away = new THREE.Vector3(Math.sin(seats[seat].facing), 0, Math.cos(seats[seat].facing)).multiplyScalar(-0.35);
    root.position.add(away);
    seat = null;
    state.pose = 'standing';
  };

  const isKey = (code: string, group: string[]) => group.includes(code);
  const held = (group: string[]) => group.some((code) => pressed.has(code));

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    if (!HANDLED.has(event.code)) return;
    event.preventDefault(); // arrows would scroll the page
    if (event.code === 'KeyE' && !event.repeat) {
      if (seat !== null) standUp();
      else {
        const index = nearestFreeSeat();
        if (index >= 0) sitAt(index);
      }
      return;
    }
    pressed.add(event.code);
    // Moving while seated stands up first.
    if (seat !== null && !isKey(event.code, KEYS.run)) standUp();
  };
  const onKeyUp = (event: KeyboardEvent) => pressed.delete(event.code);
  const onBlur = () => pressed.clear();

  const setStatus = (status: string) => {
    if (status === lastStatus) return;
    lastStatus = status;
    controller.onStatus?.(status);
  };

  const controller: PlayerController = {
    get enabled() {
      return enabled;
    },
    setEnabled: (next) => {
      if (next === enabled) return;
      enabled = next;
      pressed.clear();
      if (enabled) {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
        standUp();
      } else {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        sitAt(homeSeat);
        setStatus('');
      }
    },
    update: (delta, cameraForward) => {
      if (!enabled) return;
      if (seat !== null) {
        setStatus('Đang ngồi • E: đứng dậy • WASD: đi');
        return;
      }
      forward.set(cameraForward.x, 0, cameraForward.z).normalize();
      right.crossVectors(forward, up);
      move.set(0, 0, 0);
      if (held(KEYS.forward)) move.add(forward);
      if (held(KEYS.back)) move.sub(forward);
      if (held(KEYS.right)) move.add(right);
      if (held(KEYS.left)) move.sub(right);

      if (move.lengthSq() > 0) {
        move.normalize();
        state.pose = held(KEYS.run) ? 'running' : 'walking';
        const speed = VRM_MOVE_SPEED[state.pose];
        position.copy(root.position).addScaledVector(move, speed * delta);
        // Two passes settle the corners where colliders meet.
        for (let pass = 0; pass < 2; pass++) colliders.forEach((collider) => resolve(position, collider));
        position.x = THREE.MathUtils.clamp(position.x, bounds.minX, bounds.maxX);
        position.z = THREE.MathUtils.clamp(position.z, bounds.minZ, bounds.maxZ);
        root.position.x = position.x;
        root.position.z = position.z;
        root.rotation.y = angleDamp(root.rotation.y, Math.atan2(move.x, move.z), TURN_RATE, delta);
      } else {
        state.pose = 'standing';
      }
      // Step down onto the road / back up the curb.
      root.position.y = THREE.MathUtils.damp(
        root.position.y,
        bounds.groundY(root.position.x, root.position.z),
        14,
        delta
      );
      setStatus(nearestFreeSeat() >= 0 ? 'Nhấn E để ngồi xuống ghế' : 'WASD / mũi tên: đi • Shift: chạy • E: ngồi');
    },
    dispose: () => controller.setEnabled(false),
  };
  return controller;
}
