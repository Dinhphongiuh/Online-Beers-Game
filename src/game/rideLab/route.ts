/**
 * The Ride Lab route: home alley → main street → riverside → the quán.
 *
 * A Catmull-Rom curve through hand-placed points, sampled every metre. Each sample
 * carries the road width and zone so the world can build the road and the physics
 * can ask "where am I on the road?" (progress, lateral offset, surface).
 */
import * as THREE from 'three';

export type Zone = 'hem' | 'duong' | 'bo_ke';

export const ZONE_LABEL: Record<Zone, string> = { hem: 'Hẻm nhà', duong: 'Đường lớn', bo_ke: 'Bờ kè' };

/** Pavement width each side (the alley has none: houses open straight onto it). */
export const SIDEWALK: Record<Zone, number> = { hem: 0.6, duong: 3.2, bo_ke: 2.6 };

const CONTROL: { x: number; z: number; width: number; zone: Zone }[] = [
  { x: 0, z: -10, width: 3.8, zone: 'hem' },
  { x: 0, z: 0, width: 3.8, zone: 'hem' },
  { x: 0, z: 60, width: 3.8, zone: 'hem' },
  { x: 8, z: 110, width: 3.8, zone: 'hem' },
  { x: 30, z: 140, width: 4.2, zone: 'hem' },
  { x: 70, z: 152, width: 10, zone: 'duong' },
  { x: 160, z: 150, width: 10, zone: 'duong' },
  { x: 230, z: 170, width: 10, zone: 'duong' },
  { x: 280, z: 220, width: 10, zone: 'duong' },
  { x: 292, z: 300, width: 10, zone: 'duong' },
  { x: 270, z: 380, width: 10, zone: 'duong' },
  { x: 220, z: 432, width: 9, zone: 'bo_ke' },
  { x: 140, z: 452, width: 8, zone: 'bo_ke' },
  { x: 60, z: 444, width: 8, zone: 'bo_ke' },
  { x: 0, z: 424, width: 8, zone: 'bo_ke' },
  { x: -20, z: 416, width: 8, zone: 'bo_ke' },
];

export interface RouteSample {
  /** Metres from the start. */
  s: number;
  x: number;
  z: number;
  /** Unit tangent (direction of travel). */
  tx: number;
  tz: number;
  /** Unit vector to the rider's right. */
  rx: number;
  rz: number;
  width: number;
  zone: Zone;
  /** Signed curvature (1/m), positive = bending right. */
  curvature: number;
}

export interface RoadEvent {
  kind: 'pothole' | 'bump' | 'checkpoint';
  s: number;
  /** Lateral offset from the centre line (m), + = right. Bumps span the road. */
  lateral: number;
  radius: number;
}

export interface Route {
  samples: RouteSample[];
  length: number;
  /** Where the ride starts (outside the house) and where the quán's parking box is. */
  startS: number;
  finishS: number;
  events: RoadEvent[];
  /** Nearest sample to (x, z), searching around `hint` first. */
  locate: (x: number, z: number, hint?: number) => { index: number; sample: RouteSample; lateral: number };
  at: (s: number) => RouteSample;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export function createRoute(): Route {
  const curve = new THREE.CatmullRomCurve3(
    CONTROL.map((p) => new THREE.Vector3(p.x, 0, p.z)),
    false,
    'centripetal'
  );
  const length = curve.getLength();
  const count = Math.ceil(length);
  const samples: RouteSample[] = [];
  const tangent = new THREE.Vector3();
  for (let i = 0; i <= count; i++) {
    const u = i / count;
    const t = curve.getUtoTmapping(u, 0);
    const p = curve.getPoint(t);
    curve.getTangent(t, tangent);
    tangent.y = 0;
    tangent.normalize();
    const f = t * (CONTROL.length - 1);
    const k = Math.min(CONTROL.length - 2, Math.floor(f));
    const frac = smooth(f - k);
    const a = CONTROL[k];
    const b = CONTROL[k + 1];
    samples.push({
      s: u * length,
      x: p.x,
      z: p.z,
      tx: tangent.x,
      tz: tangent.z,
      rx: -tangent.z,
      rz: tangent.x,
      width: a.width + (b.width - a.width) * frac,
      zone: frac < 0.5 ? a.zone : b.zone,
      curvature: 0,
    });
  }
  // Curvature from the heading change between neighbours.
  for (let i = 1; i < samples.length - 1; i++) {
    const a = Math.atan2(samples[i - 1].tx, samples[i - 1].tz);
    const b = Math.atan2(samples[i + 1].tx, samples[i + 1].tz);
    let d = b - a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    samples[i].curvature = -d / (samples[i + 1].s - samples[i - 1].s);
  }

  const at = (s: number) => samples[Math.max(0, Math.min(samples.length - 1, Math.round((s / length) * count)))];

  const locate = (x: number, z: number, hint?: number) => {
    let best = 0;
    let bestDist = Infinity;
    const scan = (from: number, to: number) => {
      for (let i = Math.max(0, from); i <= Math.min(samples.length - 1, to); i++) {
        const d = (samples[i].x - x) ** 2 + (samples[i].z - z) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
    };
    if (hint !== undefined) scan(hint - 30, hint + 30);
    // Lost (respawn, big jump)? Fall back to a full scan.
    if (hint === undefined || bestDist > 400) scan(0, samples.length - 1);
    const sample = samples[best];
    const lateral = (x - sample.x) * sample.rx + (z - sample.z) * sample.rz;
    return { index: best, sample, lateral };
  };

  const startS = 12;
  const finishS = length - 22;
  const events: RoadEvent[] = [
    // Alley: speed humps the residents poured themselves, a couple of potholes.
    { kind: 'bump', s: 45, lateral: 0, radius: 0.5 },
    { kind: 'pothole', s: 78, lateral: 0.8, radius: 0.55 },
    { kind: 'bump', s: 115, lateral: 0, radius: 0.5 },
    // Main street.
    { kind: 'pothole', s: 230, lateral: 2.4, radius: 0.7 },
    { kind: 'pothole', s: 310, lateral: -1.2, radius: 0.6 },
    { kind: 'pothole', s: 420, lateral: 2.8, radius: 0.8 },
    { kind: 'pothole', s: 505, lateral: 1.6, radius: 0.6 },
    { kind: 'bump', s: 600, lateral: 0, radius: 0.6 },
    // Riverside: a police checkpoint before the quán.
    { kind: 'pothole', s: 690, lateral: 1.4, radius: 0.6 },
    { kind: 'checkpoint', s: finishS - 110, lateral: 2, radius: 3 },
  ];
  return { samples, length, startS, finishS, events, locate, at };
}
