/**
 * Ride Lab world: a night ride from the home alley to the quán (~920 m).
 *
 * Built from the route samples: road ribbons (concrete alley, marked asphalt street),
 * curbs and tiled pavements, rows of Vietnamese shophouses with lit signboards, street
 * lamps with light pools, tangled power lines, trees, parked bikes, the river with a
 * railing on the riverside stretch, a police checkpoint and the quán at the end.
 * Traffic rides both directions. Rendering: WebGL + bloom (+ afterimage when drunk).
 *
 * Input is read from the keyboard here; the React HUD polls `telemetry()`.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNeonSign, createPlasticStool, createSidewalkTexture, createStainlessTable } from '../proceduralModels';
import { breathalyzerReadingFor } from '../commuteLoopLogic';
import {
  CRASH_TEXT,
  RIDE_BIKES,
  createBikeState,
  crash,
  drunkInputLag,
  hitBump,
  kickstart,
  stepBike,
  toggleKickstand,
  type BikeInput,
  type BikeSpec,
  type BikeState,
} from './bikePhysics';
import { SIDEWALK, ZONE_LABEL, createRoute, type Route, type RouteSample, type Zone } from './route';
import { createRideBike, createTrafficCar, createTrafficScooter, mergeByMaterial, type RideBikeModel } from './rideModels';

export type CameraMode = 'tpp' | 'fpp';
export type RideEventKind = 'info' | 'warn' | 'crash' | 'success';

export interface RideTelemetry {
  speedKmh: number;
  gear: number;
  rpm: number;
  engineOn: boolean;
  kickCount: number;
  kicksNeeded: number;
  kickstandDown: boolean;
  signal: 'off' | 'left' | 'right';
  blinkOn: boolean;
  horn: boolean;
  braking: boolean;
  progress: number;
  distanceLeft: number;
  zone: string;
  lateral: number;
  roadHalfWidth: number;
  surface: string;
  leanDeg: number;
  crashed: boolean;
  elapsed: number;
  finished: boolean;
  bestTime: number | null;
  inputLagMs: number;
  /** For the minimap. */
  x: number;
  z: number;
  heading: number;
  traffic: { x: number; z: number }[];
}

export interface RideWorld {
  routeOutline: { x: number; z: number }[];
  setBike: (id: string) => void;
  setCamera: (mode: CameraMode) => void;
  setAlcohol: (value: number) => void;
  setTraffic: (enabled: boolean) => void;
  reset: () => void;
  telemetry: () => RideTelemetry;
  onEvent?: (text: string, kind: RideEventKind) => void;
  onFps?: (fps: number) => void;
  /** Fired when [V] switches the camera from the keyboard. */
  onCameraChange?: (mode: CameraMode) => void;
  dispose: () => void;
}

// ------------------------------------------------------------------ textures

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Asphalt, 1 tile = 8 m along the road, full width across; edge lines + dashed centre. */
function asphaltTexture() {
  const random = rng(4);
  const t = canvasTex(512, 1024, (ctx) => {
    ctx.fillStyle = '#26272b';
    ctx.fillRect(0, 0, 512, 1024);
    for (let i = 0; i < 26000; i++) {
      const v = 20 + random() * 40;
      ctx.fillStyle = `rgba(${v},${v},${v + 4},${0.5 + random() * 0.5})`;
      ctx.fillRect(random() * 512, random() * 1024, 1 + random() * 2, 1 + random() * 2);
    }
    // Patches and cracks.
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '15,15,18' : '55,55,60'},0.5)`;
      ctx.fillRect(random() * 400, random() * 900, 40 + random() * 90, 30 + random() * 120);
    }
    ctx.strokeStyle = 'rgba(10,10,12,0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      let x = random() * 512;
      let y = random() * 1024;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (random() - 0.5) * 50;
        y += random() * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Tyre-polished wheel tracks.
    [128, 384].forEach((x) => {
      const g = ctx.createLinearGradient(x - 50, 0, x + 50, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.25)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 50, 0, 100, 1024);
    });
    // Markings: worn solid edge lines, dashed centre (3 m paint, 5 m gap).
    ctx.fillStyle = 'rgba(235,235,225,0.85)';
    ctx.fillRect(16, 0, 9, 1024);
    ctx.fillRect(487, 0, 9, 1024);
    ctx.fillRect(251, 0, 10, 384);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function concreteTexture() {
  const random = rng(8);
  const t = canvasTex(256, 512, (ctx) => {
    ctx.fillStyle = '#5b5a57';
    ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 9000; i++) {
      const v = 70 + random() * 40;
      ctx.fillStyle = `rgba(${v},${v - 2},${v - 6},0.6)`;
      ctx.fillRect(random() * 256, random() * 512, 2, 2);
    }
    // Poured slabs with joints, damp gutter in the middle.
    ctx.fillStyle = 'rgba(20,20,20,0.7)';
    ctx.fillRect(0, 0, 256, 3);
    ctx.fillRect(0, 256, 256, 3);
    const g = ctx.createLinearGradient(100, 0, 156, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(100, 0, 56, 512);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Tileable ripple normals for the river. */
function rippleNormals() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const height = (u: number, v: number) =>
    Math.sin(2 * Math.PI * (3 * u + v)) * 0.6 + Math.sin(2 * Math.PI * (-2 * u + 5 * v)) * 0.35 + Math.sin(2 * Math.PI * (7 * u - 3 * v)) * 0.2;
  const e = 1 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const dx = (height(u + e, v) - height(u - e, v)) * 4;
      const dy = (height(u, v + e) - height(u, v - e)) * 4;
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * size + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

function lightPoolTexture() {
  return canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

const SHOPS: [string, string][] = [
  ['PHỞ BÒ GIA TRUYỀN', '#b91c1c'],
  ['CƠM TẤM SƯỜN BÌ', '#c2410c'],
  ['TẠP HÓA CÔ BA', '#1d4ed8'],
  ['SỬA XE - VÁ XE', '#0f766e'],
  ['CÀ PHÊ VÕNG', '#7c2d12'],
  ['NHÀ THUỐC TÂY', '#15803d'],
  ['BÁNH MÌ NÓNG', '#ca8a04'],
  ['KARAOKE ÁNH SAO', '#9333ea'],
  ['BIDA CLB', '#166534'],
  ['HỚT TÓC NAM', '#be123c'],
  ['ĐIỆN THOẠI - SIM', '#0369a1'],
  ['BÚN BÒ HUẾ', '#9a3412'],
];
const WALLS = ['#e8c872', '#9ec5d6', '#e3a3a8', '#a8c99a', '#e7dcc8', '#d6b38a', '#c4b5e0', '#f1e2a8'];

/** Shophouse facade (diffuse + emissive): shop / house ground floor, windows above. */
function facadeTextures(seed: number, floors: number, house: boolean) {
  const random = rng(seed);
  const H = floors * 160 + 40;
  const wall = WALLS[seed % WALLS.length];
  const [shop, signColor] = SHOPS[seed % SHOPS.length];
  const lit: { x: number; y: number; w: number; h: number; color: string }[] = [];
  const map = canvasTex(256, H, (ctx) => {
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, 256, H);
    // Weathering streaks.
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.03 + random() * 0.05})`;
      ctx.fillRect(random() * 256, random() * H, 2 + random() * 6, 20 + random() * 90);
    }
    // Upper floors: window, balcony rail, AC unit, plants.
    for (let f = 0; f < floors - 1; f++) {
      const y = 30 + f * 160;
      const on = random() < 0.55;
      const color = random() < 0.7 ? '#ffd9a0' : '#cfe3ff';
      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(48, y, 160, 100);
      ctx.fillStyle = on ? color : '#1b2230';
      ctx.fillRect(54, y + 6, 148, 88);
      if (on) lit.push({ x: 54, y: y + 6, w: 148, h: 88, color });
      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(126, y, 4, 100);
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(30, y + 104, 196, 6);
      for (let i = 0; i < 16; i++) ctx.fillRect(34 + i * 12, y + 110, 3, 30);
      ctx.fillRect(30, y + 138, 196, 5);
      if (random() < 0.6) {
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(176, y + 84, 40, 26);
      }
      ctx.fillStyle = '#2f7a35';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(46 + random() * 160, y + 100, 10 + random() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Ground floor.
    const g0 = (floors - 1) * 160 + 30;
    if (house) {
      // Iron sliding gate, a lamp over it.
      ctx.fillStyle = '#334155';
      ctx.fillRect(30, g0 + 10, 196, 160 - 10);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.moveTo(34 + i * 10, g0 + 12);
        ctx.lineTo(34 + i * 10, g0 + 168);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffe2a8';
      ctx.fillRect(118, g0 - 4, 20, 10);
      lit.push({ x: 118, y: g0 - 4, w: 20, h: 10, color: '#ffe2a8' });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(196, g0 + 30, 24, 16);
    } else {
      // Signboard band and an open, lit shop (or a pulled-down shutter).
      ctx.fillStyle = signColor;
      ctx.fillRect(10, g0, 236, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 21px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(shop, 128, g0 + 28);
      lit.push({ x: 10, y: g0, w: 236, h: 40, color: '' });
      const open = random() < 0.7;
      if (open) {
        const inside = random() < 0.5 ? '#ffe4b5' : '#e0f2fe';
        ctx.fillStyle = inside;
        ctx.fillRect(20, g0 + 48, 216, 120);
        ctx.fillStyle = 'rgba(60,40,20,0.55)';
        for (let i = 0; i < 5; i++) ctx.fillRect(28 + random() * 190, g0 + 100 + random() * 50, 18 + random() * 30, 20 + random() * 30);
        lit.push({ x: 20, y: g0 + 48, w: 216, h: 120, color: inside });
      } else {
        ctx.fillStyle = '#8b939c';
        ctx.fillRect(20, g0 + 48, 216, 120);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        for (let i = 0; i < 24; i++) ctx.fillRect(20, g0 + 48 + i * 5, 216, 2);
      }
    }
  });
  // Emissive: the lit windows, sign and shop interior only.
  const glowMap = canvasTex(256, H, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, H);
    const source = (map.image as HTMLCanvasElement).getContext('2d')!;
    lit.forEach((r) => ctx.putImageData(source.getImageData(r.x, r.y, r.w, r.h), r.x, r.y));
  });
  return { map, glowMap, height: floors * 3.4 + 0.8 };
}

// ------------------------------------------------------------------ geometry

/** A strip along the route between two lateral offsets (left < right), facing up. */
function ribbon(
  samples: RouteSample[],
  from: number,
  to: number,
  left: (s: RouteSample) => number,
  right: (s: RouteSample) => number,
  y: number,
  vScale: number,
  uScale: (s: RouteSample) => number = () => 1
) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = from; i <= to; i++) {
    const s = samples[i];
    const l = left(s);
    const r = right(s);
    positions.push(s.x + s.rx * l, y, s.z + s.rz * l, s.x + s.rx * r, y, s.z + s.rz * r);
    uvs.push(0, s.s / vScale, uScale(s), s.s / vScale);
    if (i < to) {
      const k = (i - from) * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** A vertical strip at a lateral offset (curb faces, embankment wall). */
function wallStrip(samples: RouteSample[], from: number, to: number, lateral: (s: RouteSample) => number, y0: number, y1: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = from; i <= to; i++) {
    const s = samples[i];
    const l = lateral(s);
    positions.push(s.x + s.rx * l, y0, s.z + s.rz * l, s.x + s.rx * l, y1, s.z + s.rz * l);
    if (i < to) {
      const k = (i - from) * 2;
      indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Contiguous index ranges of the route by zone (overlapping by one sample). */
function zoneRuns(samples: RouteSample[], test: (z: Zone) => boolean) {
  const runs: [number, number][] = [];
  let start = -1;
  samples.forEach((s, i) => {
    if (test(s.zone)) {
      if (start < 0) start = Math.max(0, i - 1);
    } else if (start >= 0) {
      runs.push([start, i]);
      start = -1;
    }
  });
  if (start >= 0) runs.push([start, samples.length - 1]);
  return runs;
}

const std = (color: THREE.ColorRepresentation, roughness = 0.7, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const glow = (color: THREE.ColorRepresentation, intensity: number) =>
  new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity });

// ------------------------------------------------------------------ world

interface Lamp {
  s: number;
  head: THREE.Vector3;
  /** Real-light strength when it's one of the nearest (alley wall lamps are weak bulbs). */
  power: number;
}

interface TrafficAgent {
  object: THREE.Object3D;
  s: number;
  dir: 1 | -1;
  /** Lane as a fraction of the half width (+ = right of the centre line). */
  lane: number;
  speed: number;
  baseSpeed: number;
  radius: number;
  x: number;
  z: number;
}

function buildTown(scene: THREE.Scene, route: Route) {
  const { samples } = route;
  const town = new THREE.Group();
  scene.add(town);
  const random = rng(12);

  // Ground under everything (back lots, gaps between houses).
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), std(0x1a1a1c, 0.95));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(140, -0.06, 220);
  ground.receiveShadow = true;
  town.add(ground);

  // ---- Road surfaces ----
  const asphalt = asphaltTexture();
  const asphaltMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.62, metalness: 0.05 });
  const concrete = concreteTexture();
  const concreteMat = new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.8 });
  zoneRuns(samples, (z) => z !== 'hem').forEach(([a, b]) => {
    const road = new THREE.Mesh(ribbon(samples, a, b, (s) => -s.width / 2, (s) => s.width / 2, 0, 8), asphaltMat);
    road.receiveShadow = true;
    town.add(road);
  });
  zoneRuns(samples, (z) => z === 'hem').forEach(([a, b]) => {
    const road = new THREE.Mesh(ribbon(samples, a, b, (s) => -s.width / 2, (s) => s.width / 2, 0.005, 4), concreteMat);
    road.receiveShadow = true;
    town.add(road);
  });
  // Pavements (raised 15 cm) with curb faces.
  const tiles = createSidewalkTexture();
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  tiles.anisotropy = 8;
  const tileMat = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.6, color: 0xa8a29e });
  const curbMat = std(0x9ca3af, 0.6);
  curbMat.side = THREE.DoubleSide;
  [-1, 1].forEach((side) => {
    const inner = (s: RouteSample) => (s.width / 2) * side;
    const outer = (s: RouteSample) => (s.width / 2 + SIDEWALK[s.zone]) * side;
    const walk = ribbon(samples, 0, samples.length - 1, side < 0 ? outer : inner, side < 0 ? inner : outer, 0.15, 2, (s) => SIDEWALK[s.zone] / 2);
    town.add(new THREE.Mesh(walk, tileMat));
    town.add(new THREE.Mesh(wallStrip(samples, 0, samples.length - 1, inner, 0, 0.15), curbMat));
  });

  // ---- Buildings (instanced per facade variant) ----
  const variants: { map: THREE.Texture; glowMap: THREE.Texture; height: number; house: boolean; matrices: THREE.Matrix4[] }[] = [];
  for (let v = 0; v < 18; v++) {
    const house = v >= 12;
    const floors = house ? 2 + (v % 2) : 2 + (v % 3);
    variants.push({ ...facadeTextures(100 + v * 7, floors, house), house, matrices: [] });
  }
  const coarse = samples.filter((_, i) => i % 4 === 0);
  const clearOfRoad = (x: number, z: number, radius: number) =>
    coarse.every((s) => (s.x - x) ** 2 + (s.z - z) ** 2 > (s.width / 2 + SIDEWALK[s.zone] + radius) ** 2);
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  [-1, 1].forEach((side) => {
    let s = 2;
    while (s < route.length - 2) {
      const sample = route.at(s);
      const house = sample.zone === 'hem';
      const width = house ? 3.8 + random() * 1.2 : 4 + random() * 2.2;
      // The riverside's left is the river; the quán owns the last plot on the right.
      if ((sample.zone === 'bo_ke' && side < 0) || (side > 0 && s > route.finishS - 14 && s < route.finishS + 10)) {
        s += width;
        continue;
      }
      const depth = house ? 9 : 12;
      const offset = (sample.width / 2 + SIDEWALK[sample.zone] + depth / 2 + 0.05) * side;
      const x = sample.x + sample.rx * offset;
      const z = sample.z + sample.rz * offset;
      if (clearOfRoad(x, z, depth / 2 - 0.3)) {
        const pool = variants.filter((v) => v.house === house);
        const variant = pool[Math.floor(random() * pool.length)];
        // Front (+Z of the box) faces the road.
        const yaw = Math.atan2(-sample.rx * side, -sample.rz * side);
        q.setFromAxisAngle(up, yaw);
        variant.matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(width - 0.05, variant.height, depth)));
      }
      s += width;
    }
  });
  const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const sideWall = std(0x6b6258, 0.9);
  const roof = std(0x3f3a36, 0.9);
  variants.forEach((variant) => {
    if (!variant.matrices.length) return;
    const facade = new THREE.MeshStandardMaterial({ map: variant.map, emissiveMap: variant.glowMap, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.85 });
    const instanced = new THREE.InstancedMesh(unitBox, [sideWall, sideWall, roof, roof, facade, sideWall], variant.matrices.length);
    variant.matrices.forEach((m, i) => instanced.setMatrixAt(i, m));
    instanced.receiveShadow = true;
    town.add(instanced);
  });

  // ---- Street lamps with light pools (street + riverside), wall lamps in the alley ----
  const lamps: Lamp[] = [];
  // No fog: with additive blending, fog would add its colour once per pool and the
  // distant pools pile up into a milky haze.
  const poolMat = new THREE.MeshBasicMaterial({ map: lightPoolTexture(), color: 0xffb35c, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 7, 10).translate(0, 3.5, 0);
  const armGeo = new THREE.BoxGeometry(0.08, 0.08, 1.9).translate(0, 0, 0.95);
  const headGeo = new THREE.BoxGeometry(0.34, 0.12, 0.6);
  const poleMats: THREE.Matrix4[] = [];
  const armMats: THREE.Matrix4[] = [];
  const headMats: THREE.Matrix4[] = [];
  const poolMats: THREE.Matrix4[] = [];
  const lampSpacing = 27;
  for (let s = 8, k = 0; s < route.length - 4; s += lampSpacing, k++) {
    const sample = route.at(s);
    if (sample.zone === 'hem') continue;
    const side = sample.zone === 'bo_ke' ? -1 : k % 2 ? 1 : -1;
    const lateral = (sample.width / 2 + 0.45) * side;
    const base = new THREE.Vector3(sample.x + sample.rx * lateral, 0.15, sample.z + sample.rz * lateral);
    const towardRoad = Math.atan2(-sample.rx * side, -sample.rz * side);
    q.setFromAxisAngle(up, towardRoad);
    poleMats.push(new THREE.Matrix4().compose(base, q, new THREE.Vector3(1, 1, 1)));
    armMats.push(new THREE.Matrix4().compose(base.clone().setY(7), q, new THREE.Vector3(1, 1, 1)));
    const head = base.clone().setY(6.95).add(new THREE.Vector3(Math.sin(towardRoad), 0, Math.cos(towardRoad)).multiplyScalar(1.8));
    headMats.push(new THREE.Matrix4().compose(head, q, new THREE.Vector3(1, 1, 1)));
    poolMats.push(new THREE.Matrix4().compose(head.clone().setY(0.03), new THREE.Quaternion(), new THREE.Vector3(13, 1, 13)));
    lamps.push({ s, head, power: 1 });
  }
  for (let s = 6; s < route.length; s += 13) {
    const sample = route.at(s);
    if (sample.zone !== 'hem') continue;
    const side = Math.round(s / 13) % 2 ? 1 : -1;
    const lateral = (sample.width / 2 + SIDEWALK.hem + 0.15) * side;
    const head = new THREE.Vector3(sample.x + sample.rx * lateral, 3.1, sample.z + sample.rz * lateral);
    headMats.push(new THREE.Matrix4().compose(head, new THREE.Quaternion(), new THREE.Vector3(0.5, 0.8, 0.5)));
    poolMats.push(new THREE.Matrix4().compose(head.clone().setY(0.03), new THREE.Quaternion(), new THREE.Vector3(6, 1, 6)));
    lamps.push({ s, head, power: 0.18 });
  }
  const instanced = (geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[]) => {
    const m = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((matrix, i) => m.setMatrixAt(i, matrix));
    town.add(m);
    return m;
  };
  const metal = std(0x52525b, 0.45, 0.6);
  instanced(poleGeo, metal, poleMats);
  instanced(armGeo, metal, armMats);
  instanced(headGeo, glow(0xffc27a, 7), headMats);
  instanced(poolGeo, poolMat, poolMats).renderOrder = 2;

  // ---- Power poles and the famous tangle of wires along the street ----
  const wireGeos: THREE.BufferGeometry[] = [];
  const concretePole = std(0x8a8782, 0.9);
  const poleMats2: THREE.Matrix4[] = [];
  let previous: THREE.Vector3 | null = null;
  for (let s = 150; s < route.length - 30; s += 31) {
    const sample = route.at(s);
    if (sample.zone === 'hem') {
      previous = null;
      continue;
    }
    const lateral = (sample.width / 2 + SIDEWALK[sample.zone] - 0.4) * (sample.zone === 'bo_ke' ? 1 : 1);
    const base = new THREE.Vector3(sample.x + sample.rx * lateral, 0.15, sample.z + sample.rz * lateral);
    poleMats2.push(new THREE.Matrix4().compose(base, new THREE.Quaternion(), new THREE.Vector3(1, 1.3, 1)));
    if (previous) {
      for (let w = 0; w < 6; w++) {
        const h = 6.6 + w * 0.28 + random() * 0.2;
        const a = previous.clone().setY(h).add(new THREE.Vector3((random() - 0.5) * 0.4, 0, (random() - 0.5) * 0.4));
        const b = base.clone().setY(h).add(new THREE.Vector3((random() - 0.5) * 0.4, 0, (random() - 0.5) * 0.4));
        const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -0.6 - random() * 0.7, 0));
        wireGeos.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 14, 0.018 + random() * 0.012, 4, false));
      }
      // A coil of spare cable hanging off the pole.
      if (random() < 0.5) wireGeos.push(new THREE.TorusGeometry(0.35, 0.05, 6, 16).translate(base.x, 5.6, base.z));
    }
    previous = base;
  }
  instanced(new THREE.CylinderGeometry(0.11, 0.16, 7, 8).translate(0, 3.5, 0), concretePole, poleMats2);
  if (wireGeos.length) town.add(new THREE.Mesh(mergeGeometries(wireGeos, false)!, std(0x0a0a0a, 0.6)));

  // ---- Trees on the street pavements ----
  const trunkMats: THREE.Matrix4[] = [];
  const crownMats: THREE.Matrix4[] = [];
  for (let s = 165; s < route.length; s += 15 + random() * 10) {
    const sample = route.at(s);
    if (sample.zone !== 'duong') continue;
    const side = random() < 0.5 ? 1 : -1;
    const lateral = (sample.width / 2 + SIDEWALK.duong * 0.55) * side;
    const p = new THREE.Vector3(sample.x + sample.rx * lateral, 0.15, sample.z + sample.rz * lateral);
    trunkMats.push(new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    for (let k = 0; k < 3; k++) {
      const c = p.clone().add(new THREE.Vector3((random() - 0.5) * 1.6, 4 + random() * 1.4, (random() - 0.5) * 1.6));
      const sc = 1.4 + random() * 0.8;
      crownMats.push(new THREE.Matrix4().compose(c, new THREE.Quaternion(), new THREE.Vector3(sc, sc * 0.8, sc)));
    }
  }
  instanced(new THREE.CylinderGeometry(0.14, 0.22, 4.4, 8).translate(0, 2.2, 0), std(0x3b2a1e, 0.9), trunkMats);
  instanced(new THREE.IcosahedronGeometry(1, 1), std(0x1f4a28, 0.85), crownMats);

  // ---- Parked scooters on the pavements ----
  const parked: THREE.Object3D[] = [];
  for (let s = 175, k = 0; s < route.length - 40; s += 9 + random() * 14, k++) {
    const sample = route.at(s);
    if (sample.zone !== 'duong' || random() < 0.35) continue;
    const side = random() < 0.5 ? 1 : -1;
    const lateral = (sample.width / 2 + SIDEWALK.duong - 1.0) * side;
    const bike = createTrafficScooterParked(k);
    bike.position.set(sample.x + sample.rx * lateral, 0.15, sample.z + sample.rz * lateral);
    bike.rotation.y = Math.atan2(sample.rx * side, sample.rz * side) + (random() - 0.5) * 0.4;
    town.add(bike);
    parked.push(bike);
  }

  // ---- Riverside: railing, water, the far bank ----
  const river = zoneRuns(samples, (z) => z === 'bo_ke');
  river.forEach(([a, b]) => {
    const edge = (s: RouteSample) => -(s.width / 2 + SIDEWALK[s.zone]);
    town.add(new THREE.Mesh(wallStrip(samples, a, b, edge, -1.5, 0.15), std(0x57534e, 0.9)));
    const water = new THREE.Mesh(
      ribbon(samples, a, b, (s) => edge(s) - 90, edge, -1.3, 6, () => 15),
      // Ripples break up the lamp reflections into the long glints you see on a river.
      new THREE.MeshStandardMaterial({ color: 0x0a1a24, roughness: 0.18, metalness: 0.5, normalMap: rippleNormals(), normalScale: new THREE.Vector2(0.6, 0.6) })
    );
    town.add(water);
    const railMats: THREE.Matrix4[] = [];
    for (let i = a; i <= b; i += 2) {
      const s = samples[i];
      const l = edge(s) + 0.15;
      railMats.push(new THREE.Matrix4().makeTranslation(s.x + s.rx * l, 0.65, s.z + s.rz * l));
    }
    instanced(new THREE.BoxGeometry(0.06, 1, 0.06), std(0x1d3a2e, 0.4, 0.6), railMats);
    const railCurve = new THREE.CatmullRomCurve3(
      samples.slice(a, b + 1).filter((_, i) => i % 3 === 0).map((s) => new THREE.Vector3(s.x + s.rx * (edge(s) + 0.15), 1.12, s.z + s.rz * (edge(s) + 0.15)))
    );
    town.add(new THREE.Mesh(new THREE.TubeGeometry(railCurve, 200, 0.035, 6, false), std(0x1d3a2e, 0.4, 0.6)));
  });
  // Far bank skyline.
  const skyline = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const h = 12 + random() * 40;
    const w = 10 + random() * 14;
    const tex = facadeTextures(500 + i, Math.max(3, Math.round(h / 3.4)), false);
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 10),
      new THREE.MeshStandardMaterial({ color: 0x1f2128, emissiveMap: tex.glowMap, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.9, fog: false })
    );
    b.position.set(-180 + i * 22 + random() * 8, h / 2 - 1.3, 520 + random() * 25);
    skyline.add(b);
  }
  town.add(skyline);

  // ---- Road events: potholes, speed humps, the checkpoint ----
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.15, metalness: 0.2 });
  const humpTex = canvasTex(256, 32, (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#111111' : '#facc15';
      ctx.fillRect(i * 32, 0, 32, 32);
    }
  });
  humpTex.wrapS = THREE.RepeatWrapping;
  route.events.forEach((event) => {
    const sample = route.at(event.s);
    const p = new THREE.Vector3(sample.x + sample.rx * event.lateral, 0, sample.z + sample.rz * event.lateral);
    const yaw = Math.atan2(sample.tx, sample.tz);
    if (event.kind === 'pothole') {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(event.radius, 18), holeMat);
      hole.rotation.x = -Math.PI / 2;
      hole.scale.set(1, 0.7 + random() * 0.4, 1);
      hole.position.copy(p).setY(0.012);
      town.add(hole);
    } else if (event.kind === 'bump') {
      const tex = humpTex.clone();
      tex.repeat.set(sample.width / 1.6, 1);
      tex.needsUpdate = true;
      const hump = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, sample.width, 16, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
      hump.rotation.set(0, yaw, Math.PI / 2);
      hump.scale.set(1, 1, 0.25);
      hump.position.copy(p).setY(0);
      town.add(hump);
    } else {
      town.add(createCheckpoint(p, yaw, sample));
    }
  });

  // ---- Start house and the quán at the finish ----
  const start = route.at(route.startS - 8);
  const gate = canvasTex(256, 64, (ctx) => {
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#fff';
    ctx.font = '900 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏠 NHÀ MÌNH', 128, 44);
  });
  const homeSign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshStandardMaterial({ map: gate, emissiveMap: gate, emissive: 0xffffff, emissiveIntensity: 0.8 }));
  homeSign.position.set(start.x - start.tx * 1, 3.2, start.z - start.tz * 1);
  homeSign.lookAt(start.x + start.tx * 10, 3.2, start.z + start.tz * 10);
  town.add(homeSign);
  town.add(createQuan(route));

  return { town, lamps, parked };
}

/** A rider-less scooter resting on its side stand, merged into a few meshes. */
function createTrafficScooterParked(seed: number) {
  const model = createRideBike(
    { ...RIDE_BIKES[seed % RIDE_BIKES.length], color: ['#b91c1c', '#1d4ed8', '#111827', '#e5e7eb', '#a16207'][seed % 5] },
    { rider: false }
  );
  model.kickstand.rotation.x = 0.5;
  model.lean.rotation.z = -0.12; // leaning onto the stand (left, +X)
  return mergeByMaterial(model.root);
}

function createCheckpoint(position: THREE.Vector3, yaw: number, sample: RouteSample) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = yaw;
  // Tent on the pavement, cones across half the road, a sign and officers.
  const tent = new THREE.Group();
  tent.position.set(-(sample.width / 2 + 1.4) - 2, 0.15, 0);
  tent.add(new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.9, 4), std(0xfacc15, 0.7)).translateY(2.6).rotateY(Math.PI / 4));
  [-1, 1].forEach((x) => [-1, 1].forEach((z) => tent.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), std(0x9ca3af)).translateX(x * 1.2).translateZ(z * 1.2).translateY(1.1))));
  tent.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.75, 0.6), std(0x2563eb, 0.6)).translateY(0.375));
  group.add(tent);
  const sign = canvasTex(256, 96, (ctx) => {
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#fde047';
    ctx.font = '900 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TRẠM CSGT', 128, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('KIỂM TRA NỒNG ĐỘ CỒN', 128, 76);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: 0xffffff, emissiveIntensity: 0.7 }));
  board.position.set(-(sample.width / 2) + 0.4, 1.4, -6);
  board.rotation.y = Math.PI;
  group.add(board);
  const cone = new THREE.ConeGeometry(0.18, 0.55, 12);
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(cone, std(0xf97316, 0.5));
    c.position.set(sample.width / 2 - 0.6 - i * 0.6, 0.27, -3 + i * 0.4);
    group.add(c);
  }
  // Officers: tan uniform, white cap, glowing baton.
  [
    [-(sample.width / 2) + 0.9, 1.5],
    [-(sample.width / 2) + 1.6, -1.2],
  ].forEach(([x, z], i) => {
    const officer = new THREE.Group();
    officer.position.set(x, 0, z);
    officer.rotation.y = Math.PI * 0.85;
    officer.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.75, 4, 10), std(0xc8b88a, 0.8)).translateY(1.05));
    officer.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), std(0xd6a77a)).translateY(1.65));
    officer.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.08, 16), std(0xf8fafc, 0.5)).translateY(1.76));
    officer.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), glow(i ? 0xff2a2a : 0xff6a00, 4)).translateY(1.3).translateX(0.35).rotateZ(0.6));
    group.add(officer);
  });
  return group;
}

function createQuan(route: Route) {
  const group = new THREE.Group();
  const f = route.at(route.finishS);
  const side = 1;
  const yaw = Math.atan2(-f.rx * side, -f.rz * side);
  // Shopfront building.
  const shop = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 10), [std(0x6b6258), std(0x6b6258), std(0x3f3a36), std(0x3f3a36), std(0xe8c872, 0.85), std(0x6b6258)]);
  const offset = f.width / 2 + SIDEWALK[f.zone] + 5;
  shop.position.set(f.x + f.rx * offset, 3.5, f.z + f.rz * offset);
  shop.rotation.y = yaw;
  group.add(shop);
  const sign = createNeonSign('QUÁN ỐC BỜ SÔNG', 'ỐC • SÒ • NGHÊU • BIA LẠNH');
  sign.children.slice(1).forEach((pole) => sign.remove(pole));
  sign.scale.setScalar(1.3);
  const signOffset = f.width / 2 + SIDEWALK[f.zone] - 0.1;
  sign.position.set(f.x + f.rx * signOffset, 4.6, f.z + f.rz * signOffset);
  sign.rotation.y = yaw;
  group.add(sign);
  // Tables spilling onto the pavement.
  [-3, 3].forEach((along, i) => {
    const table = createStainlessTable();
    table.scale.setScalar(0.6);
    const l = f.width / 2 + SIDEWALK[f.zone] * 0.5 + 0.1;
    table.position.set(f.x + f.rx * l + f.tx * along, 0.15, f.z + f.rz * l + f.tz * along);
    group.add(table);
    for (let k = 0; k < 3; k++) {
      const stool = createPlasticStool(k % 2 ? 0xdc2626 : 0x0284c7);
      const a = (k / 3) * Math.PI * 2 + i;
      stool.position.set(table.position.x + Math.cos(a) * 1.1, 0.15, table.position.z + Math.sin(a) * 1.1);
      group.add(stool);
    }
  });
  // White chalk parking box on the road edge.
  const box = new THREE.Group();
  const line = new THREE.MeshBasicMaterial({ color: 0xf5f5f4 });
  const w = 2.4;
  const len = 4;
  [
    [0, -len / 2, w, 0.1],
    [0, len / 2, w, 0.1],
    [-w / 2, 0, 0.1, len],
    [w / 2, 0, 0.1, len],
  ].forEach(([x, z, sx, sz]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2), line);
    m.position.set(x, 0, z);
    box.add(m);
  });
  const l = f.width / 2 - 1.4;
  box.position.set(f.x + f.rx * l, 0.02, f.z + f.rz * l);
  box.rotation.y = Math.atan2(f.tx, f.tz);
  group.add(box);
  return group;
}

// ------------------------------------------------------------------ the world

export function createRideWorld(container: HTMLElement): RideWorld {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const sky = canvasTex(4, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#03050c');
    g.addColorStop(0.55, '#0b1226');
    g.addColorStop(1, '#2a2440');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
  });
  scene.background = sky;
  scene.fog = new THREE.FogExp2(0x101426, 0.0105);
  scene.add(new THREE.HemisphereLight(0x5c6b99, 0x2a2018, 0.55));
  const moon = new THREE.DirectionalLight(0x9fb4ff, 0.35);
  moon.position.set(-60, 120, 160);
  scene.add(moon);

  const route = createRoute();
  const { lamps } = buildTown(scene, route);

  // Real point lights follow the lamps nearest the rider (the rest are pools + bloom).
  const LAMP_INTENSITY = 45;
  const lampLights = Array.from({ length: 5 }, () => {
    const light = new THREE.PointLight(0xffb866, LAMP_INTENSITY, 26, 1.8);
    scene.add(light);
    return light;
  });

  // ---- Player bike ----
  let spec: BikeSpec = RIDE_BIKES[0];
  let model: RideBikeModel = createRideBike(spec);
  scene.add(model.root);
  const headlight = new THREE.SpotLight(0xfff1d6, 140, 55, 0.42, 0.55, 1.4);
  headlight.castShadow = true;
  headlight.shadow.mapSize.set(1024, 1024);
  headlight.shadow.bias = -0.0008;
  const headTarget = new THREE.Object3D();
  scene.add(headlight, headTarget);
  // Small fill so the rider is readable from behind.
  const riderFill = new THREE.PointLight(0xbcd2ff, 3, 6, 2);
  scene.add(riderFill);

  // ---- Traffic ----
  const trafficGroup = new THREE.Group();
  scene.add(trafficGroup);
  const traffic: TrafficAgent[] = [];
  const spawnTraffic = () => {
    trafficGroup.clear();
    traffic.length = 0;
    const random = rng(99);
    for (let i = 0; i < 26; i++) {
      const car = i % 5 === 0;
      const object = car ? createTrafficCar(i) : createTrafficScooter(i, RIDE_BIKES[i % RIDE_BIKES.length]);
      trafficGroup.add(object);
      const dir: 1 | -1 = random() < 0.55 ? 1 : -1;
      const base = (car ? 7 : 8) + random() * 4;
      traffic.push({
        object,
        s: 150 + random() * (route.length - 180),
        dir,
        lane: dir * (car ? 0.5 : 0.35 + random() * 0.4),
        speed: base,
        baseSpeed: base,
        radius: car ? 2.0 : 1.0,
        x: 0,
        z: 0,
      });
    }
  };
  let trafficEnabled = true;
  spawnTraffic();

  // ---- Camera & post-processing ----
  const camera = new THREE.PerspectiveCamera(62, container.clientWidth / container.clientHeight, 0.05, 900);
  let cameraMode: CameraMode = 'tpp';
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 0.8, 0.55, 0.82);
  composer.addPass(bloom);
  const afterimage = new AfterimagePass(0.0);
  composer.addPass(afterimage);
  composer.addPass(new OutputPass());

  // ---- State ----
  let alcohol = 0;
  let bike: BikeState = createBikeState();
  let routeIndex = 0;
  let lateral = 0;
  let elapsed = 0;
  let timerRunning = false;
  let finished = false;
  let bestTime: number | null = null;
  let signal: 'off' | 'left' | 'right' = 'off';
  let horn = false;
  let checkpointDone = false;
  const hitEvents = new Set<number>();
  const keys = new Set<string>();
  const input: BikeInput = { throttle: 0, brake: 0, steer: 0 };
  const history: { t: number; input: BikeInput }[] = [];
  let clockTime = 0;
  let firstFrame = true;

  const api: RideWorld = {
    routeOutline: route.samples.filter((_, i) => i % 6 === 0).map((s) => ({ x: s.x, z: s.z })),
    setBike: (id) => {
      spec = RIDE_BIKES.find((b) => b.id === id) ?? RIDE_BIKES[0];
      scene.remove(model.root);
      model = createRideBike(spec);
      scene.add(model.root);
      api.reset();
    },
    setCamera: (mode) => {
      cameraMode = mode;
    },
    setAlcohol: (value) => {
      alcohol = value;
    },
    setTraffic: (enabled) => {
      trafficEnabled = enabled;
      trafficGroup.visible = enabled;
    },
    reset: () => placeAt(route.startS, false),
    telemetry: () => {
      const sample = route.samples[routeIndex];
      return {
        speedKmh: bike.speed * 3.6,
        gear: bike.gear,
        rpm: bike.rpm,
        engineOn: bike.engineOn,
        kickCount: bike.kickCount,
        kicksNeeded: spec.kickstartsNeeded,
        kickstandDown: bike.kickstandDown,
        signal,
        blinkOn: Math.floor(clockTime * 2.5) % 2 === 0,
        horn,
        braking: input.brake > 0,
        progress: Math.min(1, Math.max(0, (sample.s - route.startS) / (route.finishS - route.startS))),
        distanceLeft: Math.max(0, route.finishS - sample.s),
        zone: ZONE_LABEL[sample.zone],
        lateral,
        roadHalfWidth: sample.width / 2,
        surface: bike.surface === 'road' ? 'Mặt đường' : 'Vỉa hè',
        leanDeg: (bike.lean * 180) / Math.PI,
        crashed: bike.crashTime !== null,
        elapsed,
        finished,
        bestTime,
        inputLagMs: Math.round(drunkInputLag(alcohol) * 1000),
        x: bike.x,
        z: bike.z,
        heading: bike.heading,
        traffic: trafficEnabled ? traffic.map((t) => ({ x: t.x, z: t.z })) : [],
      };
    },
    dispose: () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      renderer.setAnimationLoop(null);
      observer.disconnect();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
  const emit = (text: string, kind: RideEventKind = 'info') => api.onEvent?.(text, kind);

  /** Put the bike on the route at `s`, in the right-hand lane, facing along it. */
  const placeAt = (s: number, keepEngine: boolean) => {
    const sample = route.at(s);
    const lane = sample.zone === 'hem' ? 0.4 : sample.width / 4;
    const fresh = createBikeState(sample.x + sample.rx * lane, sample.z + sample.rz * lane, Math.atan2(sample.tx, sample.tz));
    if (keepEngine) {
      fresh.engineOn = true;
      fresh.kickCount = spec.kickstartsNeeded;
      fresh.kickstandDown = false;
    }
    bike = fresh;
    routeIndex = route.locate(bike.x, bike.z).index;
    firstFrame = true; // snap the camera instead of gliding across the map
    if (!keepEngine) {
      elapsed = 0;
      timerRunning = false;
      finished = false;
      checkpointDone = false;
      hitEvents.clear();
      signal = 'off';
    }
    history.length = 0;
  };
  placeAt(route.startS, false);

  // ---- Keyboard ----
  const handled = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyF', 'KeyH', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyR']);
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
    if (!handled.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    switch (event.code) {
      case 'KeyE': {
        if (bike.engineOn) break;
        const result = kickstart(bike, spec);
        bike = result.state;
        emit(
          result.started
            ? '💨 Bành bành bành! Máy đã nổ. Gạt chân chống [F] rồi vặn ga [W].'
            : `💨 Khặc khặc… (${bike.kickCount}/${spec.kickstartsNeeded}) đạp thêm [E]`,
          result.started ? 'success' : 'info'
        );
        break;
      }
      case 'KeyF':
        bike = toggleKickstand(bike);
        emit(bike.kickstandDown ? '🦵 Đã hạ chân chống' : '🦵 Cạch! Đã gạt chân chống lên', 'info');
        break;
      case 'KeyZ':
        signal = signal === 'left' ? 'off' : 'left';
        break;
      case 'KeyC':
        signal = signal === 'right' ? 'off' : 'right';
        break;
      case 'KeyX':
        signal = 'off';
        break;
      case 'KeyV':
        cameraMode = cameraMode === 'tpp' ? 'fpp' : 'tpp';
        api.onCameraChange?.(cameraMode);
        break;
      case 'KeyR':
        placeAt(route.startS, false);
        emit('↺ Về lại đầu hẻm', 'info');
        break;
    }
  };
  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
  const onBlur = () => keys.clear();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  const held = (...codes: string[]) => codes.some((c) => keys.has(c));

  // ---- Loop ----
  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const lookSmoothed = new THREE.Vector3();
  const forward = new THREE.Vector3();
  let frames = 0;
  let fpsTime = 0;
  let wheelSpin = 0;
  let surfaceY = 0;

  renderer.setAnimationLoop(() => {
    const raw = clock.getDelta();
    const dt = Math.min(raw, 1 / 30);
    clockTime += dt;

    // Keyboard → smoothed analog input.
    const wantThrottle = held('KeyW', 'ArrowUp') ? 1 : 0;
    const wantBrake = held('KeyS', 'ArrowDown', 'Space') ? 1 : 0;
    const wantSteer = (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0);
    input.throttle += (wantThrottle - input.throttle) * Math.min(1, dt * 5);
    input.brake = wantBrake;
    input.steer += (wantSteer - input.steer) * Math.min(1, dt * 6);
    horn = held('KeyH');
    history.push({ t: clockTime, input: { ...input } });
    const lag = drunkInputLag(alcohol);
    while (history.length > 2 && history[1].t <= clockTime - lag) history.shift();
    const applied = lag > 0 ? history[0].input : input;

    // Where are we on the road?
    const located = route.locate(bike.x, bike.z, routeIndex);
    const prevIndex = routeIndex;
    routeIndex = located.index;
    lateral = located.lateral;
    const sample = located.sample;
    const half = sample.width / 2;
    const surface = Math.abs(lateral) > half ? 'sidewalk' : 'road';

    if (bike.engineOn && !timerRunning && !finished && bike.speed > 0.5) timerRunning = true;
    const before = bike;
    bike = stepBike(bike, applied, { spec, dt, alcohol, time: clockTime, surface });
    if (before.crashTime === null && bike.crashTime !== null) emit(CRASH_TEXT[bike.crashReason!], 'crash');

    if (bike.crashTime === null) {
      // Curb: hopping up or down at speed.
      if (before.surface !== surface && bike.speed > 2.5) {
        bike = hitBump(bike, surface === 'sidewalk' ? 0.55 : 0.35);
        if (surface === 'sidewalk') emit('⚠️ Leo lề! Đi trên vỉa hè bị chậm và xóc', 'warn');
      }
      // Walls / the river railing: hard stop, crash if fast.
      const wall = half + SIDEWALK[sample.zone] - 0.25;
      if (Math.abs(lateral) > wall) {
        if (bike.speed > 5) {
          bike = crash(bike, 'wall');
          emit(CRASH_TEXT.wall, 'crash');
        } else {
          const push = Math.abs(lateral) - wall;
          bike = { ...bike, x: bike.x - sample.rx * Math.sign(lateral) * push, z: bike.z - sample.rz * Math.sign(lateral) * push, speed: bike.speed * 0.5 };
        }
      }
      // Potholes, speed humps, the checkpoint.
      route.events.forEach((event, i) => {
        const ds = sample.s - event.s;
        if (event.kind === 'bump' && prevIndex < routeIndex && route.samples[prevIndex].s < event.s && sample.s >= event.s) {
          const hard = bike.speed > 7;
          bike = hitBump(bike, hard ? 0.95 : 0.3);
          emit(hard ? '💥 Gờ giảm tốc! Bay người khỏi yên' : 'Gờ giảm tốc', hard ? 'warn' : 'info');
        } else if (event.kind === 'pothole' && Math.abs(ds) < event.radius + 0.3 && Math.abs(lateral - event.lateral) < event.radius + 0.2 && !hitEvents.has(i)) {
          hitEvents.add(i);
          bike = hitBump(bike, 0.7);
          emit('🕳️ Sập ổ gà! Xóc nảy người', 'warn');
        } else if (event.kind === 'pothole' && Math.abs(ds) > 6) {
          hitEvents.delete(i);
        } else if (event.kind === 'checkpoint' && !checkpointDone && sample.s > event.s) {
          checkpointDone = true;
          emit(
            alcohol > 0
              ? `🚨 CSGT thổi nồng độ cồn: ${breathalyzerReadingFor(alcohol)} — Bị lập biên bản!`
              : `✅ CSGT kiểm tra: ${breathalyzerReadingFor(alcohol)}. Mời đi tiếp!`,
            alcohol > 0 ? 'crash' : 'success'
          );
        }
      });
      // Arrival at the quán.
      if (!finished && sample.s >= route.finishS) {
        if (bike.speed > 8) {
          bike = crash(bike, 'sign');
          emit(CRASH_TEXT.sign, 'crash');
        } else if (bike.speed < 2.2) {
          finished = true;
          timerRunning = false;
          bestTime = bestTime === null ? elapsed : Math.min(bestTime, elapsed);
          emit(`🅿️ Tới quán sau ${elapsed.toFixed(1)} giây! Rút chìa khóa, vào nhậu thôi`, 'success');
        }
      }
    } else if (bike.crashTime > 2.6) {
      // Get up and carry on from where we fell.
      placeAt(Math.max(route.startS, sample.s - 3), true);
      emit('🩹 Dựng xe dậy, đi tiếp', 'info');
    }
    if (timerRunning) elapsed += dt;

    // ---- Traffic ----
    if (trafficEnabled) {
      traffic.forEach((agent) => {
        const s = route.at(agent.s);
        const halfW = s.width / 2;
        const zoneLane = s.zone === 'hem' ? Math.sign(agent.lane) * 0.25 : agent.lane;
        // Slow down behind the player when in the same lane.
        const ahead = (route.samples[routeIndex].s - agent.s) * agent.dir;
        const sameLane = Math.abs(lateral - zoneLane * halfW) < 1.6;
        const target = sameLane && ahead > 0 && ahead < 9 ? Math.max(0, bike.speed - 0.5) : s.zone === 'hem' ? agent.baseSpeed * 0.5 : agent.baseSpeed;
        agent.speed += (target - agent.speed) * Math.min(1, dt * 2);
        agent.s += agent.speed * agent.dir * dt;
        if (agent.s > route.length - 5) agent.s = 140;
        if (agent.s < 140) agent.s = route.length - 6;
        const here = route.at(agent.s);
        agent.x = here.x + here.rx * zoneLane * halfW;
        agent.z = here.z + here.rz * zoneLane * halfW;
        agent.object.position.set(agent.x, 0, agent.z);
        agent.object.rotation.y = Math.atan2(here.tx * agent.dir, here.tz * agent.dir);
        if (bike.crashTime === null && Math.hypot(agent.x - bike.x, agent.z - bike.z) < agent.radius) {
          bike = crash({ ...bike, speed: bike.speed * 0.6 }, 'traffic');
          emit(CRASH_TEXT.traffic, 'crash');
        }
      });
    }

    // ---- Bike visuals ----
    surfaceY += ((bike.surface === 'sidewalk' ? 0.15 : 0) - surfaceY) * Math.min(1, dt * 12);
    const bob = Math.sin(clockTime * 40) * bike.jolt * 0.05;
    model.root.position.set(bike.x, surfaceY + bob, bike.z);
    model.root.rotation.set(0, bike.heading, 0);
    model.lean.rotation.z = bike.lean;
    model.lean.rotation.x = -bike.jolt * 0.08;
    model.steer.rotation.y = -bike.steer * (0.5 / (1 + bike.speed * 0.25));
    wheelSpin += (bike.speed / 0.31) * dt;
    model.frontWheel.rotation.x = wheelSpin;
    model.rearWheel.rotation.x = wheelSpin;
    model.kickstand.rotation.x = bike.kickstandDown ? 0.35 : -1.35;
    model.brakeLight.emissiveIntensity = input.brake > 0 ? 6 : 1.2;
    const blink = Math.floor(clockTime * 2.5) % 2 === 0;
    model.signals.left.emissiveIntensity = signal === 'left' && blink ? 6 : 0.15;
    model.signals.right.emissiveIntensity = signal === 'right' && blink ? 6 : 0.15;
    model.headLens.emissiveIntensity = bike.engineOn ? 4 : 0.4;
    headlight.intensity = bike.engineOn ? 140 : 0;
    forward.set(Math.sin(bike.heading), 0, Math.cos(bike.heading));
    headlight.position.set(bike.x, surfaceY + 1.0, bike.z).addScaledVector(forward, 1.1);
    headTarget.position.copy(headlight.position).addScaledVector(forward, 14).setY(0);
    headlight.target = headTarget;
    riderFill.position.set(bike.x, 2.4, bike.z).addScaledVector(forward, -1.5);

    // Nearest lamps get the real lights.
    const here = route.samples[routeIndex].s;
    const nearest = [...lamps].sort((a, b) => Math.abs(a.s - here) - Math.abs(b.s - here)).slice(0, lampLights.length);
    lampLights.forEach((light, i) => {
      const lamp = nearest[i];
      if (!lamp) return;
      light.position.copy(lamp.head).setY(lamp.head.y - 0.3);
      light.intensity = LAMP_INTENSITY * lamp.power;
    });

    // ---- Camera ----
    const drunk = Math.max(0, (alcohol - 15) / 85);
    const sway = drunk * 0.35;
    model.riderBody.forEach((o) => (o.visible = cameraMode === 'tpp'));
    if (cameraMode === 'tpp') {
      const back = 4.4 + bike.speed * 0.06;
      camPos.set(bike.x, surfaceY + 2.0 + bike.speed * 0.02, bike.z).addScaledVector(forward, -back);
      camLook.set(bike.x, surfaceY + 1.1, bike.z).addScaledVector(forward, 3.5);
      camera.position.lerp(camPos, firstFrame ? 1 : 1 - Math.exp(-dt * 6));
      lookSmoothed.lerp(camLook, firstFrame ? 1 : 1 - Math.exp(-dt * 10));
      camera.up.set(0, 1, 0);
      camera.lookAt(lookSmoothed);
      // Roll a little with the bike (and the drink).
      camera.rotateZ(-bike.lean * 0.18 + Math.sin(clockTime * 1.4) * sway * 0.15);
    } else {
      model.root.updateMatrixWorld(true);
      model.lean.localToWorld(camPos.copy(model.eye));
      camera.position.copy(camPos);
      camLook.copy(camPos).addScaledVector(forward, 10).setY(camPos.y - 1.5 - bike.jolt * 0.4);
      camera.up.set(0, 1, 0);
      camera.lookAt(camLook);
      camera.rotateZ(-bike.lean * 0.85 + Math.sin(clockTime * 1.4) * sway * 0.2);
    }
    camera.fov = 62 + bike.speed * 0.55 + Math.sin(clockTime * 0.9) * drunk * 4;
    camera.updateProjectionMatrix();
    firstFrame = false;

    // Drunk vision: ghosting trails and stronger glow.
    afterimage.uniforms['damp'].value = drunk > 0 ? 0.55 + drunk * 0.38 : 0;
    afterimage.enabled = drunk > 0;
    bloom.strength = 0.8 + drunk * 0.5;

    composer.render();

    frames++;
    fpsTime += raw;
    if (fpsTime > 0.5) {
      api.onFps?.(Math.round(frames / fpsTime));
      frames = 0;
      fpsTime = 0;
    }
  });

  const observer = new ResizeObserver(() => {
    if (!container.clientWidth || !container.clientHeight) return;
    renderer.setSize(container.clientWidth, container.clientHeight);
    composer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  });
  observer.observe(container);
  return api;
}
