/**
 * Ride Lab motorbike physics: a planar bike on the XZ plane (heading 0 = +Z).
 *
 * Steering sets a path curvature; the curvature a bike can hold is limited by how far
 * it can lean (tan(lean) = v²κ / g), so turns tighten at low speed and widen at high
 * speed, and the bike leans into them. Semi-automatic 4-speed gearbox with RPM,
 * kickstart, kickstand, crashes, and drunk riding (handlebar drift, sluggish hands).
 *
 * Pure (no DOM / three.js) so it can run under node:test.
 */

export const G = 9.81;

export interface BikeSpec {
  id: string;
  name: string;
  subtitle: string;
  /** Top speed per gear, km/h (4-speed semi-automatic like a Wave / Dream). */
  gearTopKmh: number[];
  /** Peak acceleration at low speed, m/s². */
  accel: number;
  /** Full-brake deceleration, m/s². */
  brake: number;
  maxLeanDeg: number;
  kickstartsNeeded: number;
  color: string;
  accent: string;
}

export const RIDE_BIKES: BikeSpec[] = [
  {
    id: 'dream_chien',
    name: 'Dream Chiến Thái',
    subtitle: 'Bền bỉ, đầm xe, 3 cú đạp mới nổ',
    gearTopKmh: [22, 40, 56, 70],
    accel: 3.0,
    brake: 6.5,
    maxLeanDeg: 38,
    kickstartsNeeded: 3,
    color: '#7f1d1d',
    accent: '#d4d4d8',
  },
  {
    id: 'wave_do_po',
    name: 'Wave Alpha độ pô',
    subtitle: 'Nhẹ, bốc, vào cua sâu',
    gearTopKmh: [24, 44, 62, 78],
    accel: 3.6,
    brake: 6.0,
    maxLeanDeg: 42,
    kickstartsNeeded: 2,
    color: '#0369a1',
    accent: '#e5e7eb',
  },
  {
    id: 'cub_50',
    name: 'Super Cub 50',
    subtitle: 'Hiền, chậm, êm ru',
    gearTopKmh: [18, 32, 46, 55],
    accel: 2.3,
    brake: 5.5,
    maxLeanDeg: 34,
    kickstartsNeeded: 3,
    color: '#15803d',
    accent: '#f5f5f4',
  },
];

export type Surface = 'road' | 'sidewalk';

export type CrashReason = 'kickstand' | 'wall' | 'traffic' | 'lowside' | 'sign';

export const CRASH_TEXT: Record<CrashReason, string> = {
  kickstand: '⚡ Quên gạt chân chống, ôm cua tóe lửa, trượt bánh!',
  wall: '💥 Đâm thẳng vào tường nhà dân!',
  traffic: '💥 Tông xe khác giữa đường!',
  lowside: '🌀 Nghiêng quá đà, trượt bánh ngã xe!',
  sign: '💥 Phóng nhanh tông đổ biển hiệu quán!',
};

export interface BikeState {
  x: number;
  z: number;
  /** Radians; 0 = +Z, positive turns toward +X (left). */
  heading: number;
  /** m/s, never negative (no reverse). */
  speed: number;
  /** Radians, positive = leaning right. */
  lean: number;
  /** Smoothed handlebar input, -1 (left) .. 1 (right). */
  steer: number;
  gear: number;
  /** 0..1 */
  rpm: number;
  engineOn: boolean;
  kickCount: number;
  kickstandDown: boolean;
  surface: Surface;
  /** Seconds since the crash; null when riding. */
  crashTime: number | null;
  crashReason: CrashReason | null;
  /** Suspension compression from bumps, decays to 0 (visual + camera). */
  jolt: number;
}

export interface BikeInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (left) .. 1 (right)
}

export interface StepOptions {
  spec: BikeSpec;
  dt: number;
  /** Player.alcoholLevel scale 0..100. */
  alcohol: number;
  /** Seconds, for the drunk sway. */
  time: number;
  surface: Surface;
}

export const createBikeState = (x = 0, z = 0, heading = 0): BikeState => ({
  x,
  z,
  heading,
  speed: 0,
  lean: 0,
  steer: 0,
  gear: 1,
  rpm: 0,
  engineOn: false,
  kickCount: 0,
  kickstandDown: true,
  surface: 'road',
  crashTime: null,
  crashReason: null,
  jolt: 0,
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * (1 - Math.exp(-rate * dt));

/** Kick the starter once; returns the new state and whether it fired. */
export function kickstart(state: BikeState, spec: BikeSpec): { state: BikeState; started: boolean } {
  if (state.engineOn) return { state, started: false };
  const kickCount = state.kickCount + 1;
  const started = kickCount >= spec.kickstartsNeeded;
  return { state: { ...state, kickCount, engineOn: started, rpm: started ? 0.18 : 0 }, started };
}

export const toggleKickstand = (state: BikeState): BikeState => ({ ...state, kickstandDown: !state.kickstandDown });

export function crash(state: BikeState, reason: CrashReason): BikeState {
  if (state.crashTime !== null) return state;
  return { ...state, crashTime: 0, crashReason: reason };
}

/** Handlebar drift from the drink: a slow breathing sway plus a faster wobble. */
export function drunkDrift(alcohol: number, time: number) {
  const ratio = clamp((alcohol - 15) / 85, 0, 1);
  return ratio * (Math.sin(time * 1.3) * 0.35 + Math.sin(time * 3.1 + 1.7) * 0.18);
}

/** Seconds of input delay the drunk rider has. */
export const drunkInputLag = (alcohol: number) => clamp((alcohol - 15) / 85, 0, 1) * 0.45;

export const gearTopMs = (spec: BikeSpec, gear: number) => spec.gearTopKmh[gear - 1] / 3.6;

/** Advances one step. */
export function stepBike(state: BikeState, input: BikeInput, options: StepOptions): BikeState {
  const { spec, dt, alcohol, time, surface } = options;
  const s = { ...state, surface };
  s.jolt = approach(s.jolt, 0, 6, dt);

  // ---- Crashed: slide to a stop, lying on its side ----
  if (s.crashTime !== null) {
    s.crashTime += dt;
    s.speed = Math.max(0, s.speed - 9 * dt);
    s.lean = approach(s.lean, (Math.sign(s.lean) || 1) * 1.35, 8, dt);
    s.x += Math.sin(s.heading) * s.speed * dt;
    s.z += Math.cos(s.heading) * s.speed * dt;
    s.rpm = approach(s.rpm, 0, 3, dt);
    return s;
  }

  const drunk = clamp((alcohol - 15) / 85, 0, 1);
  // Drunk hands react slower and the bars wander on their own.
  const steerTarget = clamp(input.steer + drunkDrift(alcohol, time), -1, 1);
  s.steer = approach(s.steer, steerTarget, 7 - drunk * 4, dt);

  // ---- Longitudinal ----
  const vmax = gearTopMs(spec, spec.gearTopKmh.length);
  let accel = 0;
  if (s.engineOn && !s.kickstandDown) {
    const headroom = clamp(1 - s.speed / vmax, 0, 1);
    accel += input.throttle * spec.accel * Math.pow(headroom, 0.6);
  } else if (s.engineOn && s.kickstandDown && input.throttle > 0) {
    // Riding with the stand down: it drags, but you can move.
    accel += input.throttle * spec.accel * 0.5 * clamp(1 - s.speed / 5, 0, 1);
  }
  accel -= input.brake * spec.brake;
  // Rolling resistance + air drag (+ much more on the pavement's broken tiles).
  accel -= 0.25 + 0.0045 * s.speed * s.speed + (surface === 'sidewalk' ? 1.6 : 0);
  s.speed = Math.max(0, s.speed + accel * dt);

  // ---- Gearbox (semi-automatic: shifts by road speed) ----
  let gear = 1;
  while (gear < spec.gearTopKmh.length && s.speed > gearTopMs(spec, gear) * 0.92) gear++;
  s.gear = gear;
  const low = gear > 1 ? gearTopMs(spec, gear - 1) * 0.7 : 0;
  const band = clamp((s.speed - low) / (gearTopMs(spec, gear) - low), 0, 1);
  s.rpm = s.engineOn ? approach(s.rpm, 0.16 + band * 0.8 + input.throttle * 0.06, 8, dt) : approach(s.rpm, 0, 3, dt);

  // ---- Lateral: steering → curvature, limited by lean ----
  const v = s.speed;
  const maxLean = (spec.maxLeanDeg * Math.PI) / 180;
  const leanLimitedCurvature = (G * Math.tan(maxLean)) / Math.max(v * v, 0.25);
  const maxCurvature = Math.min(1 / 1.9, leanLimitedCurvature); // 1.9 m tightest radius
  const curvature = s.steer * maxCurvature;
  s.heading -= v * curvature * dt; // steering right turns toward -X
  const targetLean = Math.atan((v * v * curvature) / G);
  s.lean = approach(s.lean, targetLean + Math.sin(time * 2.1) * 0.05 * drunk, 6, dt);

  s.x += Math.sin(s.heading) * v * dt;
  s.z += Math.cos(s.heading) * v * dt;

  // ---- Hazards ----
  if (s.kickstandDown && Math.abs(s.lean) > 0.2 && v > 4) return crash(s, 'kickstand');
  if (Math.abs(s.lean) > maxLean * 1.05 && v > 3) return crash(s, 'lowside');
  return s;
}

/** A bump (pothole, curb, speed hump): loses some speed and kicks the suspension. */
export function hitBump(state: BikeState, severity: number): BikeState {
  return {
    ...state,
    speed: state.speed * (1 - 0.18 * severity),
    jolt: Math.min(1, state.jolt + severity),
  };
}
