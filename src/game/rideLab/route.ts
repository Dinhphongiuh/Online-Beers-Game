/**
 * The Ride Lab route: home alley → main street → crossroads with traffic lights →
 * second street → riverside → the quán's parking lot (≈1.4 km).
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
  // A straight run through the crossroads.
  { x: 294, z: 360, width: 10, zone: 'duong' },
  { x: 296, z: 420, width: 10, zone: 'duong' },
  { x: 310, z: 500, width: 10, zone: 'duong' },
  { x: 360, z: 560, width: 10, zone: 'duong' },
  { x: 440, z: 590, width: 10, zone: 'duong' },
  { x: 530, z: 600, width: 9, zone: 'duong' },
  { x: 610, z: 612, width: 8, zone: 'bo_ke' },
  { x: 690, z: 630, width: 8, zone: 'bo_ke' },
  { x: 770, z: 628, width: 8, zone: 'bo_ke' },
  { x: 840, z: 610, width: 8, zone: 'bo_ke' },
  { x: 900, z: 592, width: 8, zone: 'bo_ke' },
  { x: 960, z: 584, width: 8, zone: 'bo_ke' },
  { x: 1000, z: 582, width: 8, zone: 'bo_ke' },
];

/** Where the cross street meets the main street (traffic lights). */
const CROSSROADS = { x: 294, z: 360 };

/** Which way the ride goes: to the quán, or back home after drinking. */
export type RideDirection = 'outbound' | 'return';

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
  /** Only active on this trip (the checkpoint waits for people riding home). */
  direction?: RideDirection;
  /** Lateral offset from the centre line (m), + = right. Bumps span the road. */
  lateral: number;
  radius: number;
}

export interface ParkingLot {
  /** Centre of the lot along the route. */
  s: number;
  /** Lot extent along the route (± from s) and its depth beyond the pavement. */
  halfLength: number;
  depth: number;
  /** Bays: position along the route, lateral offset, row (0 = nearest the road). */
  bays: { s: number; lateral: number; row: number }[];
  /** Index into `bays` of the free bay the rider parks in (and leaves from). */
  playerBay: number;
}

export interface Route {
  samples: RouteSample[];
  length: number;
  /** The home gate (start of the ride out, end of the ride home). */
  startS: number;
  /** The parking lot entrance (end of the ride out). */
  finishS: number;
  /** Centre of the crossroads along the route. */
  crossroadsS: number;
  lot: ParkingLot;
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
  // Parking lot just before the quán at the end of the riverside.
  const lotS = length - 40;
  const lot: ParkingLot = { s: lotS, halfLength: 8, depth: 9, bays: [], playerBay: 0 };
  const lotSample = at(lotS);
  const edge = lotSample.width / 2 + SIDEWALK[lotSample.zone];
  [edge + 1.8, edge + 6.4].forEach((lateral, row) => {
    for (let k = -6; k <= 6; k++) lot.bays.push({ s: lotS + k * 1.15, lateral, row });
  });
  lot.playerBay = lot.bays.findIndex((b) => b.row === 0 && Math.abs(b.s - (lotS + 1.15)) < 0.01);
  const finishS = lotS - lot.halfLength;
  const crossroadsS = locate(CROSSROADS.x, CROSSROADS.z).sample.s;

  const events: RoadEvent[] = [
    // Alley: speed humps the residents poured themselves, a couple of potholes.
    { kind: 'bump', s: 45, lateral: 0, radius: 0.5 },
    { kind: 'pothole', s: 78, lateral: 0.8, radius: 0.55 },
    { kind: 'bump', s: 115, lateral: 0, radius: 0.5 },
    // First street.
    { kind: 'pothole', s: 230, lateral: 2.4, radius: 0.7 },
    { kind: 'pothole', s: 310, lateral: -1.2, radius: 0.6 },
    { kind: 'pothole', s: 420, lateral: 2.8, radius: 0.8 },
    // Second street.
    { kind: 'pothole', s: crossroadsS + 90, lateral: 1.6, radius: 0.6 },
    { kind: 'pothole', s: crossroadsS + 170, lateral: -2.2, radius: 0.7 },
    { kind: 'bump', s: crossroadsS + 260, lateral: 0, radius: 0.6 },
    // Riverside.
    { kind: 'pothole', s: length - 300, lateral: 1.4, radius: 0.6 },
    { kind: 'pothole', s: length - 180, lateral: -1.6, radius: 0.6 },
    // The police wait at the mouth of the alley for people riding home after a drink.
    { kind: 'checkpoint', s: 200, lateral: -2, radius: 3, direction: 'return' },
  ];
  return { samples, length, startS, finishS, crossroadsS, lot, events, locate, at };
}
