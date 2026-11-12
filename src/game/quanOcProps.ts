/**
 * Props that make "Quán Ốc Bờ Sông" feel lived in: food and drinks on every table,
 * the drinks fridge, live-seafood tanks, the football TV, stacked stools, umbrellas,
 * the Thần Tài shrine, a banner, shell buckets and bins.
 *
 * Most of these are static, so `mergeStatic` collapses a prop (or a whole table)
 * into one mesh per material to keep the draw-call count down.
 */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createFoodPlatter } from './foodModels';
import { createIceBucket, createPlasticStool } from './proceduralModels';

// ---------- helpers ----------

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const std = (color: number, roughness = 0.6, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const glow = (color: number, intensity: number) =>
  new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity });

function box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Bakes every plain mesh under `root` into one mesh per material (in root's local
 * space). Instanced meshes, sprites and lights are kept as they are. The result
 * takes root's transform, so it drops in where root was.
 */
export function mergeStatic(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const keep: THREE.Object3D[] = [];
  const relative = new THREE.Matrix4();
  root.traverse((object) => {
    if (object === root) return;
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) {
      if ((object as THREE.Light).isLight || (object as THREE.Sprite).isSprite) keep.push(object);
      return;
    }
    if ((mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || Array.isArray(mesh.material)) {
      keep.push(mesh);
      return;
    }
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') geometry.deleteAttribute(name);
    }
    geometry.morphAttributes = {};
    geometry.clearGroups();
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    if (!geometry.getAttribute('uv')) {
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
    }
    geometry.applyMatrix4(relative.multiplyMatrices(toRoot, mesh.matrixWorld));
    const list = buckets.get(mesh.material as THREE.Material) ?? [];
    list.push(geometry);
    buckets.set(mesh.material as THREE.Material, list);
  });

  const merged = new THREE.Group();
  merged.name = root.name;
  merged.position.copy(root.position);
  merged.quaternion.copy(root.quaternion);
  merged.scale.copy(root.scale);
  buckets.forEach((geometries, material) => {
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (geometry) merged.add(new THREE.Mesh(geometry, material));
  });
  keep.forEach((object) => {
    relative.multiplyMatrices(toRoot, object.matrixWorld);
    object.removeFromParent();
    relative.decompose(object.position, object.quaternion, object.scale);
    merged.add(object);
  });
  return merged;
}

// ---------- table dressing ----------

const bottleGeometry = (() => {
  const profile = [
    [0, 0],
    [0.034, 0],
    [0.035, 0.17],
    [0.03, 0.2],
    [0.014, 0.24],
    [0.012, 0.29],
    [0.014, 0.295],
    [0, 0.295],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(profile, 12);
})();
const labelGeometry = new THREE.CylinderGeometry(0.0355, 0.0355, 0.07, 12, 1, true);
const canGeometry = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 14);
const glassGeometry = new THREE.CylinderGeometry(0.045, 0.038, 0.13, 14);
const foamGeometry = new THREE.CylinderGeometry(0.044, 0.044, 0.02, 14);
const napkinGeometry = new THREE.DodecahedronGeometry(0.04, 0);

const M = {
  greenGlass: new THREE.MeshStandardMaterial({ color: 0x0f5132, roughness: 0.12, metalness: 0.2 }),
  amberGlass: new THREE.MeshStandardMaterial({ color: 0x6b3a0f, roughness: 0.12, metalness: 0.2 }),
  label: std(0xf5f5f4, 0.5),
  labelRed: std(0xb91c1c, 0.5),
  canRed: std(0xc81e1e, 0.3, 0.7),
  canSilver: std(0xd4d4d8, 0.25, 0.85),
  beer: new THREE.MeshStandardMaterial({ color: 0xd88a14, roughness: 0.15, emissive: 0x3a1a00, emissiveIntensity: 0.4 }),
  foam: std(0xfff7e6, 0.8),
  napkin: std(0xf4f4f5, 0.95),
  shell: std(0x8b5a2b, 0.6),
  shellPale: std(0xe7d3b0, 0.6),
};

export interface TableSpreadOptions {
  seed: number;
  /** Height of the table top. */
  top: number;
  /** Radius of the table top; things sit inside it. */
  radius: number;
  dishes: string[];
  /** Skip the middle (beer tower / umbrella pole). */
  clearCenter?: number;
  /** Add the stainless ice bucket. */
  iceBucket?: boolean;
}

/** Dishes, bottles, cans, glasses of beer and crumpled napkins on a table. */
export function createTableSpread(options: TableSpreadOptions) {
  const random = rng(options.seed);
  const group = new THREE.Group();
  group.name = 'TableSpread';
  const { top, radius } = options;
  const inner = Math.max(options.clearCenter ?? 0.2, 0.2);
  const spot = (r: number, angle: number) => new THREE.Vector3(Math.cos(angle) * r, top, Math.sin(angle) * r);
  const start = random() * Math.PI * 2;

  options.dishes.forEach((type, i) => {
    const dish = createFoodPlatter(type);
    const angle = start + (i / options.dishes.length) * Math.PI * 2;
    dish.position.copy(spot(inner + (radius - inner) * 0.42, angle));
    dish.scale.multiplyScalar(0.82);
    dish.rotation.y = random() * Math.PI * 2;
    group.add(dish);
  });

  // Bottles (some empty and knocked over), cans, beer glasses near the rim.
  const edge = radius * 0.82;
  const bottleCount = 4 + Math.floor(random() * 4);
  for (let i = 0; i < bottleCount; i++) {
    const angle = start + 0.4 + i * (Math.PI * 2 / bottleCount) + (random() - 0.5) * 0.3;
    const bottle = new THREE.Group();
    const glass = random() < 0.7 ? M.greenGlass : M.amberGlass;
    bottle.add(new THREE.Mesh(bottleGeometry, glass));
    const label = new THREE.Mesh(labelGeometry, random() < 0.5 ? M.label : M.labelRed);
    label.position.y = 0.1;
    bottle.add(label);
    bottle.position.copy(spot(edge - random() * 0.12, angle));
    if (random() < 0.18) {
      bottle.rotation.z = Math.PI / 2;
      bottle.position.y += 0.035;
      bottle.rotation.y = random() * Math.PI;
    }
    group.add(bottle);
  }
  const canCount = 2 + Math.floor(random() * 4);
  for (let i = 0; i < canCount; i++) {
    const can = new THREE.Mesh(canGeometry, random() < 0.5 ? M.canRed : M.canSilver);
    const angle = start + 1.1 + i * 0.35;
    can.position.copy(spot(edge * 0.9, angle)).add(new THREE.Vector3(0, 0.06, 0));
    if (random() < 0.3) {
      // Crushed and lying down.
      can.scale.y = 0.55;
      can.rotation.z = Math.PI / 2;
      can.position.y = top + 0.035;
    }
    group.add(can);
  }
  const glassCount = 3 + Math.floor(random() * 2);
  for (let i = 0; i < glassCount; i++) {
    const angle = start + Math.PI + i * ((Math.PI * 2) / glassCount) + 0.2;
    const at = spot(edge * 0.78, angle);
    const beer = new THREE.Mesh(glassGeometry, M.beer);
    beer.position.copy(at).add(new THREE.Vector3(0, 0.065, 0));
    const foam = new THREE.Mesh(foamGeometry, M.foam);
    foam.position.copy(at).add(new THREE.Vector3(0, 0.14, 0));
    group.add(beer, foam);
  }
  // Napkins and empty snail shells.
  for (let i = 0; i < 9; i++) {
    const n = new THREE.Mesh(napkinGeometry, M.napkin);
    n.position.copy(spot(inner + random() * (radius - inner) * 0.95, random() * Math.PI * 2)).add(new THREE.Vector3(0, 0.02, 0));
    n.rotation.set(random() * 3, random() * 3, random() * 3);
    group.add(n);
  }
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 7), random() < 0.6 ? M.shell : M.shellPale);
    s.position.copy(spot(inner + random() * (radius - inner) * 0.9, random() * Math.PI * 2)).add(new THREE.Vector3(0, 0.012, 0));
    s.rotation.set(Math.PI / 2, random() * 3, random() * 3);
    group.add(s);
  }
  if (options.iceBucket) {
    const bucket = createIceBucket();
    bucket.scale.setScalar(0.8);
    bucket.position.copy(spot(inner + 0.2, start + Math.PI * 0.7));
    group.add(bucket);
  }
  return group;
}

/** Plastic bucket on the floor for empty shells (every quán ốc has one per table). */
export function createShellBucket(color: number, seed: number) {
  const random = rng(seed);
  const group = new THREE.Group();
  const plastic = new THREE.MeshStandardMaterial({ color, roughness: 0.5, side: THREE.DoubleSide });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.22, 18, 1, true), plastic);
  wall.position.y = 0.11;
  group.add(wall);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.13, 18), plastic);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.005;
  group.add(floor);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(0.155, 18), std(0x4a3426, 0.8));
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.16;
  group.add(fill);
  for (let i = 0; i < 16; i++) {
    const shell = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 7), random() < 0.5 ? M.shell : M.shellPale);
    const a = random() * Math.PI * 2;
    const r = random() * 0.12;
    shell.position.set(Math.cos(a) * r, 0.17 + random() * 0.02, Math.sin(a) * r);
    shell.rotation.set(random() * 3, random() * 3, random() * 3);
    group.add(shell);
  }
  return group;
}

/** Bare bulb on a cord hanging over a table. */
export function createHangingBulb(from = 3.0, to = 2.35) {
  const group = new THREE.Group();
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, from - to, 6), new THREE.MeshBasicMaterial({ color: 0x111113 }));
  cord.position.y = (from + to) / 2;
  group.add(cord);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.12, 18, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide })
  );
  shade.position.y = to + 0.02;
  group.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), glow(0xffcf8a, 7));
  bulb.position.y = to - 0.04;
  group.add(bulb);
  return group;
}

// ---------- furniture ----------

/** Upright glass-door drinks fridge ("tủ mát") glowing with bottles and cans. */
export function createDrinksFridge() {
  const group = new THREE.Group();
  group.name = 'DrinksFridge';
  const random = rng(31);
  const body = std(0xb91c1c, 0.4, 0.3);
  const W = 0.78;
  const H = 1.95;
  const D = 0.68;
  // Shell: back, sides, top, bottom kick plate.
  group.add(box(W, H, 0.04, body, 0, H / 2, -D / 2 + 0.02));
  group.add(box(0.05, H, D, body, -W / 2 + 0.025, H / 2, 0));
  group.add(box(0.05, H, D, body, W / 2 - 0.025, H / 2, 0));
  group.add(box(W, 0.14, D, body, 0, 0.07, 0));
  // Lit header.
  const header = canvasTexture(256, 64, (ctx) => {
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BIA LẠNH', 128, 46);
  });
  group.add(
    box(W, 0.26, D, new THREE.MeshStandardMaterial({ map: header, emissiveMap: header, emissive: 0xffffff, emissiveIntensity: 1.6 }), 0, H - 0.13, 0)
  );
  // Glowing interior and shelves.
  group.add(box(W - 0.1, H - 0.42, 0.01, glow(0xe0f2fe, 1.6), 0, 0.14 + (H - 0.42) / 2, -D / 2 + 0.05));
  const shelf = std(0xe5e7eb, 0.4, 0.6);
  const shelves = [0.2, 0.62, 1.04, 1.46];
  shelves.forEach((y) => group.add(box(W - 0.1, 0.015, D - 0.1, shelf, 0, y, 0)));
  // Drinks on every shelf.
  const slots = shelves.length * 12;
  const bottles = new THREE.InstancedMesh(bottleGeometry, M.greenGlass, slots);
  const cans = new THREE.InstancedMesh(canGeometry, M.canRed, slots);
  const matrix = new THREE.Matrix4();
  let b = 0;
  let c = 0;
  shelves.forEach((y, row) => {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 2; j++) {
        const x = -0.28 + i * 0.112;
        const z = -0.12 + j * 0.16;
        if (row % 2 === 0 || random() < 0.2) {
          matrix.makeTranslation(x, y + 0.008, z);
          bottles.setMatrixAt(b++, matrix);
        } else {
          matrix.makeTranslation(x, y + 0.068, z);
          cans.setMatrixAt(c++, matrix);
        }
      }
    }
  });
  bottles.count = b;
  cans.count = c;
  group.add(bottles, cans);
  // Door frame and handle (the glass itself is left open so the drinks read clearly).
  const frame = std(0x27272a, 0.4, 0.6);
  group.add(box(W, 0.04, 0.04, frame, 0, H - 0.28, D / 2));
  group.add(box(W, 0.04, 0.04, frame, 0, 0.16, D / 2));
  group.add(box(0.04, H - 0.44, 0.04, frame, -W / 2 + 0.02, H / 2 - 0.06, D / 2));
  group.add(box(0.04, H - 0.44, 0.04, frame, W / 2 - 0.02, H / 2 - 0.06, D / 2));
  group.add(box(0.025, 0.4, 0.04, std(0xd4d4d8, 0.2, 0.9), W / 2 - 0.08, 1.05, D / 2 + 0.03));
  return group;
}

/** Two-tier rack of aerated glass tanks with crabs, prawns and clams. */
export function createSeafoodTanks() {
  const group = new THREE.Group();
  group.name = 'SeafoodTanks';
  const random = rng(77);
  const metal = std(0x9ca3af, 0.35, 0.8);
  const W = 1.5;
  const D = 0.6;
  const tiers = [0.55, 1.3];
  // Rack legs.
  [-W / 2, W / 2].forEach((x) => [-D / 2, D / 2].forEach((z) => group.add(box(0.04, 1.95, 0.04, metal, x, 0.975, z))));
  const water = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x0e7490,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.35,
    roughness: 0.05,
    depthWrite: false,
  });
  const gravel = std(0xa8a29e, 0.95);
  const crab = std(0xc2410c, 0.5);
  const prawn = std(0x7c8a9a, 0.4);
  const clam = std(0xd6d3d1, 0.6);
  const bubbleMeshes: { mesh: THREE.InstancedMesh; seeds: number[]; base: number; height: number }[] = [];
  const matrix = new THREE.Matrix4();
  tiers.forEach((y, tier) => {
    group.add(box(W + 0.04, 0.03, D + 0.04, metal, 0, y - 0.015, 0));
    group.add(box(W - 0.04, 0.04, D - 0.04, gravel, 0, y + 0.02, 0));
    const tankH = 0.55;
    group.add(box(W - 0.02, tankH, D - 0.02, water, 0, y + tankH / 2, 0));
    // Lid with a cyan light strip.
    group.add(box(W, 0.03, D, metal, 0, y + tankH + 0.015, 0));
    group.add(box(W - 0.2, 0.015, 0.03, glow(0x67e8f9, 3), 0, y + tankH - 0.01, D / 2 - 0.05));
    // Creatures on the gravel.
    for (let i = 0; i < 6; i++) {
      const x = -W / 2 + 0.15 + random() * (W - 0.3);
      const z = -D / 2 + 0.12 + random() * (D - 0.24);
      if (tier === 0 && i < 4) {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), crab);
        body.scale.set(1.3, 0.45, 1);
        body.position.set(x, y + 0.07, z);
        group.add(body);
        for (let leg = 0; leg < 4; leg++) {
          const side = leg < 2 ? -1 : 1;
          const l = box(0.1, 0.012, 0.012, crab, x + side * 0.1, y + 0.06, z + (leg % 2 ? 0.035 : -0.035));
          l.rotation.z = side * 0.4;
          group.add(l);
        }
      } else if (tier === 1) {
        const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.12, 4, 8), prawn);
        p.rotation.set(Math.PI / 2, 0, random() * Math.PI);
        p.position.set(x, y + 0.08 + random() * 0.2, z);
        group.add(p);
      } else {
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 6), clam);
        shell.scale.y = 0.45;
        shell.position.set(x, y + 0.05, z);
        group.add(shell);
      }
    }
    // Rising aerator bubbles.
    const count = 24;
    const bubbles = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.01, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xcffafe, emissiveIntensity: 1.2 }),
      count
    );
    const seeds = Array.from({ length: count }, () => random());
    seeds.forEach((s, i) => {
      matrix.makeTranslation(W / 2 - 0.15 + (s - 0.5) * 0.06, y + 0.05, (i % 3) * 0.02);
      bubbles.setMatrixAt(i, matrix);
    });
    group.add(bubbles);
    bubbleMeshes.push({ mesh: bubbles, seeds, base: y + 0.05, height: tankH - 0.1 });
  });
  // Sign on top.
  const sign = canvasTexture(512, 96, (ctx) => {
    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#fde047';
    ctx.font = '900 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HẢI SẢN TƯƠI SỐNG', 256, 64);
  });
  group.add(
    box(W, 0.26, 0.04, new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: 0xffffff, emissiveIntensity: 1.2 }), 0, 2.05, 0)
  );

  const update = (time: number) => {
    bubbleMeshes.forEach(({ mesh, seeds, base, height }) => {
      seeds.forEach((s, i) => {
        const t = (time * (0.35 + s * 0.3) + s * 7) % 1;
        matrix.makeTranslation(W / 2 - 0.15 + Math.sin(time * 3 + i) * 0.02 + (s - 0.5) * 0.06, base + t * height, (i % 3) * 0.02 - 0.02);
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  };
  return { group, update };
}

/** TV on a rolling stand showing the football (the whole quán is watching). */
export function createFootballTv() {
  const group = new THREE.Group();
  group.name = 'FootballTv';
  const metal = std(0x27272a, 0.4, 0.7);
  group.add(box(0.7, 0.04, 0.5, metal, 0, 0.06, 0));
  group.add(box(0.06, 1.5, 0.06, metal, 0, 0.8, 0));
  group.add(box(1.2, 0.72, 0.06, std(0x09090b, 0.3, 0.4), 0, 1.75, 0));

  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const random = rng(5);
  const players = Array.from({ length: 14 }, (_, i) => ({
    x: 30 + random() * 260,
    y: 40 + random() * 110,
    team: i % 2,
    phase: random() * 6,
  }));
  const draw = (time: number) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#15803d' : '#16a34a';
      ctx.fillRect(i * 40, 0, 40, 180);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 30, 296, 140);
    ctx.beginPath();
    ctx.moveTo(160, 30);
    ctx.lineTo(160, 170);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(160, 100, 22, 0, Math.PI * 2);
    ctx.stroke();
    const ballX = 160 + Math.sin(time * 0.7) * 110;
    const ballY = 100 + Math.sin(time * 1.3) * 45;
    players.forEach((p) => {
      const x = p.x + (ballX - p.x) * 0.25 + Math.sin(time + p.phase) * 8;
      const y = p.y + (ballY - p.y) * 0.2 + Math.cos(time * 0.8 + p.phase) * 6;
      ctx.fillStyle = p.team ? '#dc2626' : '#2563eb';
      ctx.fillRect(x - 3, y - 5, 6, 10);
    });
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ballX, ballY, 3, 0, Math.PI * 2);
    ctx.fill();
    // Score bug.
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(8, 6, 150, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`VIỆT NAM 2 - 1 THÁI LAN  ${78 + Math.floor(time / 30) % 12}'`, 14, 21);
    texture.needsUpdate = true;
  };
  draw(0);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.12, 0.64),
    new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: 1.3 })
  );
  screen.position.set(0, 1.75, 0.031);
  group.add(screen);

  let next = 0;
  const update = (time: number) => {
    if (time < next) return; // ~12 fps is plenty for a TV across the bar
    next = time + 0.08;
    draw(time);
  };
  return { group, update };
}

/** A nested stack of plastic stools waiting by the stall. */
export function createStoolStack(color: number, count: number) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const stool = createPlasticStool(color);
    stool.position.y = i * 0.085;
    stool.rotation.y = (i % 2) * 0.05;
    group.add(stool);
  }
  return group;
}

/** Big square street umbrella with a bulb hanging under it. */
export function createUmbrella(color: number, trim: number) {
  const group = new THREE.Group();
  group.name = 'Umbrella';
  const pole = std(0xe5e7eb, 0.4, 0.6);
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.7, 10), pole).translateY(1.35));
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(1.75, 0.8, 4, 1, true),
    new THREE.MeshStandardMaterial({ color, roughness: 0.75, side: THREE.DoubleSide })
  );
  canopy.rotation.y = Math.PI / 4;
  canopy.position.y = 2.82;
  group.add(canopy);
  const side = 1.75 * Math.SQRT1_2 * 2; // square edge length
  const trimMaterial = std(trim, 0.7);
  for (let i = 0; i < 4; i++) {
    const valance = box(side, 0.16, 0.01, trimMaterial, 0, 2.38, side / 2);
    const holder = new THREE.Group();
    holder.add(valance);
    holder.rotation.y = (i * Math.PI) / 2;
    group.add(holder);
  }
  group.add(createHangingBulb(2.6, 2.2));
  return group;
}

/** Small floor shrine to Thần Tài & Thổ Địa with red lamps, incense and fruit. */
export function createShrine() {
  const group = new THREE.Group();
  group.name = 'Shrine';
  const wood = std(0x7f1d1d, 0.5, 0.1);
  group.add(box(0.55, 0.42, 0.38, wood, 0, 0.21, 0));
  group.add(box(0.55, 0.04, 0.42, std(0xa16207, 0.4, 0.6), 0, 0.44, 0.02));
  const plaque = canvasTexture(256, 160, (ctx) => {
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 244, 148);
    ctx.fillStyle = '#facc15';
    ctx.font = '900 34px serif';
    ctx.textAlign = 'center';
    ctx.fillText('THẦN TÀI', 128, 70);
    ctx.fillText('THỔ ĐỊA', 128, 120);
  });
  group.add(
    box(0.5, 0.36, 0.02, new THREE.MeshStandardMaterial({ map: plaque, emissiveMap: plaque, emissive: 0xffffff, emissiveIntensity: 0.5 }), 0, 0.22, -0.15)
  );
  const lamp = glow(0xff2a1a, 5);
  [-0.2, 0.2].forEach((x) => {
    group.add(box(0.05, 0.12, 0.05, lamp, x, 0.52, 0.05));
  });
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.05, 12), std(0xb45309, 0.5, 0.5)).translateY(0.485));
  for (let i = 0; i < 3; i++) {
    const stick = box(0.005, 0.18, 0.005, std(0x7c2d12), -0.02 + i * 0.02, 0.6, 0);
    stick.rotation.z = (i - 1) * 0.12;
    group.add(stick);
    group.add(box(0.008, 0.01, 0.008, glow(0xff6a00, 6), -0.02 + i * 0.02 + (i - 1) * 0.011, 0.69, 0));
  }
  const fruit = [0xf97316, 0x84cc16, 0xfacc15, 0xdc2626];
  fruit.forEach((color, i) => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), std(color, 0.5));
    f.position.set(0.08 + (i % 2) * 0.06, 0.49 + Math.floor(i / 2) * 0.05, 0.08 + (i % 2) * 0.03);
    group.add(f);
  });
  return group;
}

/** Cloth banner stretched between two poles (text reads from both sides). */
export function createBanner(title: string, subtitle: string, width = 6) {
  const texture = canvasTexture(1024, 128, (ctx) => {
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.font = '900 62px sans-serif';
    ctx.fillText(title, 512, 66);
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(subtitle, 512, 108);
  });
  // A thin box: its back face maps the texture un-mirrored, so it reads from both sides.
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.75, 0.01),
    new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.9 })
  );
}

export function createTrashBin() {
  const group = new THREE.Group();
  const plastic = std(0x1d4ed8, 0.5);
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.21, 0.7, 18), plastic).translateY(0.35));
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 18), std(0x1e3a8a, 0.5)).translateY(0.72));
  // Black bag poking out.
  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), std(0x111111, 0.4)).translateY(0.78).translateX(0.04));
  return group;
}
