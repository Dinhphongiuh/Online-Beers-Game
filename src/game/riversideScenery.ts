/**
 * "Quán Ốc Bờ Sông" scenery for the Dev Mode next-gen bar: a sidewalk snail bar on a
 * riverside embankment at night.
 *
 * Layout (metres, y up, the main table at the origin):
 *   z < -5.6   river (water at WATER_Y), moored boats, a lit bridge, the far bank skyline
 *   -5.6..6.6  embankment sidewalk: railing, street lamps, tables, the snail stall
 *   6.6..14    road, then shophouses across the street
 */
import * as THREE from 'three/webgpu';
import {
  createBeerCrates,
  createFloorLitterAndBottles,
  createNeighborTableGroup,
  createNeonSign,
  createSidewalkTexture,
  createStandingIndustrialFan,
  createStreetMotorbike,
} from './proceduralModels';
import type { Collider, PlayerBounds, Seat } from './playerController';
import {
  createBanner,
  createDrinksFridge,
  createFootballTv,
  createHangingBulb,
  createSeafoodTanks,
  createShellBucket,
  createShrine,
  createStoolStack,
  createTableSpread,
  createTrashBin,
  createUmbrella,
  mergeStatic,
} from './quanOcProps';
import { HOUSE_DEPTH, HOUSE_WIDTH, createQuanOcHouse, type QuanOcHouse } from './quanOcInterior';
import { createQuanOcParking, type QuanOcParking } from './quanOcParking';

export const RIVER_EDGE_Z = -5.6;
export const ROAD_EDGE_Z = 6.6;
const WATER_Y = -1.35;
/** Where the road ends and the far sidewalk (shophouse side) begins. */
const FAR_WALK_Z = ROAD_EDGE_Z + 0.22 + 7.4;
const HALF_WIDTH = 60;

export interface RiversideScenery {
  /** Sidewalk + road surface (toggled by the "floor" effect). */
  ground: THREE.Group;
  /** Near props that cast and receive shadows. */
  props: THREE.Group;
  /** Water, far bank, bridge: no shadows, mostly emissive. */
  backdrop: THREE.Group;
  /** Moon and stars, for the background pass (unaffected by the river haze). */
  sky: THREE.Group;
  /** Obstacles for the walkable character (the main table is added by the caller). */
  colliders: Collider[];
  /** Free stools at the neighbouring tables. */
  seats: Seat[];
  bounds: PlayerBounds;
  /** The walk-in shophouse: its interior box and where its staff stand. */
  house: Pick<QuanOcHouse, 'interior' | 'tight' | 'staff' | 'route'>;
  /** Bãi giữ xe east of the stall, with the player's bike in it. */
  parking: QuanOcParking;
  /** `focus` = the walking player (opens doors). */
  update: (time: number, delta: number, focus?: THREE.Vector3) => void;
}

// ---------- small helpers ----------

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const std = (color: number, roughness = 0.7, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

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

/** Building facade: dark wall with a grid of windows, some lit warm or cool. */
function facadeTexture(seed: number, floors: number, columns: number, litRatio: number, shopFront: boolean) {
  const random = rng(seed);
  return canvasTexture(256, 512, (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 512);
    const cellW = 256 / columns;
    const cellH = 512 / floors;
    for (let f = 0; f < floors; f++) {
      const isShop = shopFront && f === floors - 1;
      for (let c = 0; c < columns; c++) {
        if (isShop) continue;
        if (random() > litRatio) {
          ctx.fillStyle = '#0d0f14';
        } else {
          const warm = random() < 0.7;
          const level = 0.55 + random() * 0.45;
          ctx.fillStyle = warm
            ? `rgb(${255 * level}, ${190 * level}, ${110 * level})`
            : `rgb(${170 * level}, ${210 * level}, ${255 * level})`;
        }
        ctx.fillRect(c * cellW + cellW * 0.22, f * cellH + cellH * 0.25, cellW * 0.56, cellH * 0.5);
      }
      if (isShop) {
        // Ground-floor shop: half-raised shutter spilling light, plus a small sign.
        ctx.fillStyle = random() < 0.5 ? '#ffd9a0' : '#e8f4ff';
        ctx.fillRect(18, f * cellH + cellH * 0.45, 220, cellH * 0.55);
        ctx.fillStyle = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'][Math.floor(random() * 4)];
        ctx.fillRect(10, f * cellH + cellH * 0.1, 236, cellH * 0.22);
      }
    }
  });
}

/** Tileable ripple normal map for the river. */
function rippleNormalTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const waves = [
    [3, 1, 0.9],
    [-2, 4, 0.6],
    [7, -3, 0.35],
    [-9, -6, 0.25],
    [13, 5, 0.15],
  ];
  const height = (u: number, v: number) =>
    waves.reduce((sum, [a, b, amp]) => sum + amp * Math.sin(2 * Math.PI * (a * u + b * v)), 0);
  const e = 1 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const dx = (height(u + e, v) - height(u - e, v)) * 0.03 * size;
      const dy = (height(u, v + e) - height(u, v - e)) * 0.03 * size;
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * size + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** A string of festoon bulbs sagging between anchor points. */
function festoon(anchors: THREE.Vector3[], sag: number, spacing: number) {
  const group = new THREE.Group();
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    const steps = 12;
    for (let s = i === 0 ? 0 : 1; s <= steps; s++) {
      const t = s / steps;
      const p = a.clone().lerp(b, t);
      p.y -= sag * 4 * t * (1 - t);
      points.push(p);
    }
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const length = curve.getLength();
  group.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(16, points.length * 2), 0.01, 5, false),
      new THREE.MeshBasicMaterial({ color: 0x111113 })
    )
  );
  const count = Math.max(2, Math.floor(length / spacing));
  const bulbs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.05, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff1c1, emissive: 0xffc46b, emissiveIntensity: 4 }),
    count
  );
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const p = curve.getPointAt((i + 0.5) / count);
    matrix.makeTranslation(p.x, p.y - 0.07, p.z);
    bulbs.setMatrixAt(i, matrix);
  }
  bulbs.castShadow = false;
  group.add(bulbs);
  return group;
}

// ---------- pieces ----------

function createGround() {
  const ground = new THREE.Group();
  ground.name = 'Ground';

  // Embankment sidewalk with the same concrete tiles as the lobby.
  const tiles = createSidewalkTexture();
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  const depth = ROAD_EDGE_Z - RIVER_EDGE_Z;
  tiles.repeat.set(HALF_WIDTH, depth / 2);
  tiles.anisotropy = 8;
  const sidewalk = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_WIDTH * 2, depth),
    new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.5, metalness: 0.05, color: 0x9a9690 })
  );
  sidewalk.rotation.x = -Math.PI / 2;
  sidewalk.position.z = (ROAD_EDGE_Z + RIVER_EDGE_Z) / 2;
  sidewalk.receiveShadow = true;
  ground.add(sidewalk);

  // Granite curb, then the asphalt road one step lower.
  const curb = box(HALF_WIDTH * 2, 0.2, 0.22, std(0xa8a29e, 0.8), 0, -0.09, ROAD_EDGE_Z + 0.11);
  curb.receiveShadow = true;
  ground.add(curb);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_WIDTH * 2, 7.4),
    new THREE.MeshStandardMaterial({ color: 0x1f1f23, roughness: 0.62, metalness: 0.1 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.16, ROAD_EDGE_Z + 0.22 + 3.7);
  road.receiveShadow = true;
  ground.add(road);
  const dash = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.7 });
  for (let x = -HALF_WIDTH + 1; x < HALF_WIDTH; x += 4) {
    const line = box(2, 0.01, 0.12, dash, x, -0.155, ROAD_EDGE_Z + 3.9);
    line.receiveShadow = true;
    ground.add(line);
  }
  // Far sidewalk.
  const farWalk = box(HALF_WIDTH * 2, 0.16, 2.4, std(0x57534e, 0.85), 0, -0.08, ROAD_EDGE_Z + 0.22 + 7.4 + 1.2);
  farWalk.receiveShadow = true;
  ground.add(farWalk);
  return ground;
}

function createEmbankment() {
  const group = new THREE.Group();
  group.name = 'Embankment';
  // Stone retaining wall dropping to the water, with a coping stone along the top.
  const stone = std(0x6b6660, 0.9);
  group.add(box(HALF_WIDTH * 2, 2.4, 0.5, stone, 0, -1.2, RIVER_EDGE_Z - 0.25));
  group.add(box(HALF_WIDTH * 2, 0.12, 0.6, std(0x9c968e, 0.75), 0, 0.03, RIVER_EDGE_Z - 0.2));

  // Painted iron railing: posts every 1.2 m with two rails.
  const iron = std(0x1d3a2e, 0.45, 0.6);
  const postCount = Math.floor((HALF_WIDTH * 2) / 1.2);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 1.0, 0.05), iron, postCount);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < postCount; i++) {
    matrix.makeTranslation(-HALF_WIDTH + 0.6 + i * 1.2, 0.59, RIVER_EDGE_Z + 0.05);
    posts.setMatrixAt(i, matrix);
  }
  group.add(posts);
  group.add(box(HALF_WIDTH * 2, 0.06, 0.08, iron, 0, 1.1, RIVER_EDGE_Z + 0.05));
  group.add(box(HALF_WIDTH * 2, 0.03, 0.03, iron, 0, 0.55, RIVER_EDGE_Z + 0.05));
  return group;
}

function createStreetLamp() {
  const lamp = new THREE.Group();
  const pole = std(0x3f3f46, 0.4, 0.7);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 5.4, 12), pole);
  post.position.y = 2.7;
  lamp.add(post);
  const arm = box(0.05, 0.05, 1.1, pole, 0, 5.3, 0.5);
  lamp.add(arm);
  const head = box(0.32, 0.1, 0.5, pole, 0, 5.28, 1.05);
  lamp.add(head);
  const glow = box(
    0.26,
    0.02,
    0.42,
    new THREE.MeshStandardMaterial({ color: 0xffe2b8, emissive: 0xffb066, emissiveIntensity: 6 }),
    0,
    5.22,
    1.05
  );
  lamp.add(glow);
  const light = new THREE.PointLight(0xffb066, 34, 16, 2);
  light.position.set(0, 5.1, 1.05);
  lamp.add(light);
  return lamp;
}

function createTree(seed: number) {
  const random = rng(seed);
  const tree = new THREE.Group();
  const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.25, 8), std(0xd4d4d8, 0.8));
  planter.position.y = 0.125;
  tree.add(planter);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3.4, 8), std(0x4a3426, 0.9));
  trunk.position.y = 1.7;
  trunk.rotation.z = (random() - 0.5) * 0.12;
  tree.add(trunk);
  const leaves = [std(0x1f4d2b, 0.85), std(0x2d5f34, 0.85), std(0x183d22, 0.85)];
  for (let i = 0; i < 7; i++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + random() * 0.5, 1), leaves[i % 3]);
    const a = random() * Math.PI * 2;
    const r = i === 0 ? 0 : 0.6 + random() * 0.6;
    blob.position.set(Math.cos(a) * r, 3.5 + random() * 0.9, Math.sin(a) * r);
    blob.scale.y = 0.75;
    tree.add(blob);
  }
  return tree;
}

function createParkedScooter(color: number) {
  const bike = createStreetMotorbike();
  // Drop the rider; leave the helmet on the seat.
  const [, , headlight, , , torso, helmet] = bike.children as THREE.Mesh[];
  bike.remove(torso);
  helmet.position.set(-0.2, 0.72, 0);
  headlight.material = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.2 });
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.3 });
  (bike.children[0] as THREE.Mesh).material = paint;
  (bike.children[1] as THREE.Mesh).material = paint;
  return bike;
}

/** "Quầy ốc": the stall with basins of live snails, a charcoal brazier and the menu. */
function createSnailStall() {
  const stall = new THREE.Group();
  stall.name = 'SnailStall';
  const random = rng(7);
  const steel = std(0xb4b4bb, 0.3, 0.8);
  const frame = std(0x52525b, 0.5, 0.6);

  // Tarp roof on four posts.
  [-2.1, 2.1].forEach((x) =>
    [-1.3, 1.6].forEach((z) => stall.add(box(0.06, 2.75, 0.06, frame, x, 1.375, z)))
  );
  const tarp = box(4.6, 0.05, 3.4, std(0x1d4ed8, 0.6), 0, 2.78, 0.15);
  tarp.rotation.x = -0.06;
  stall.add(tarp);
  stall.add(box(4.64, 0.22, 0.05, std(0xea580c, 0.5), 0, 2.62, 1.86));

  // Corrugated back panel with the menu board.
  stall.add(box(4.3, 2.4, 0.05, std(0x64748b, 0.55, 0.4), 0, 1.25, -1.3));
  const menu = canvasTexture(512, 320, (ctx) => {
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, 512, 320);
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, 498, 306);
    ctx.fillStyle = '#fde047';
    ctx.font = '900 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MENU ỐC', 256, 64);
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f8fafc';
    [
      ['Ốc hương rang muối', '90k'],
      ['Sò điệp nướng mỡ hành', '80k'],
      ['Nghêu hấp sả', '60k'],
      ['Ốc len xào dừa', '70k'],
      ['Bia lạnh', '20k'],
    ].forEach(([name, price], i) => {
      ctx.fillText(name, 34, 116 + i * 42);
      ctx.fillText(price, 412, 116 + i * 42);
    });
  });
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.94),
    new THREE.MeshStandardMaterial({ map: menu, emissiveMap: menu, emissive: 0xffffff, emissiveIntensity: 0.35 })
  );
  board.position.set(1.1, 1.75, -1.26);
  stall.add(board);

  // Prep counter along the back.
  stall.add(box(3.2, 0.08, 0.7, steel, -0.4, 0.88, -0.85));
  stall.add(box(3.1, 0.84, 0.62, std(0x3f3f46, 0.7, 0.3), -0.4, 0.42, -0.85));

  // Brazier ("bếp than") with a grill of scallops at the counter end.
  const brazier = new THREE.Group();
  brazier.position.set(1.55, 0, -0.85);
  const stove = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.62, 16), std(0x7c2d12, 0.9));
  stove.position.y = 0.31;
  brazier.add(stove);
  const coals = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.02, 16),
    new THREE.MeshStandardMaterial({ color: 0x431407, emissive: 0xff5a1f, emissiveIntensity: 3 })
  );
  coals.position.y = 0.63;
  brazier.add(coals);
  const scallop = std(0xe7d3b0, 0.6);
  for (let i = 0; i < 5; i++) {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), scallop);
    shell.scale.y = 0.35;
    const a = (i / 5) * Math.PI * 2;
    shell.position.set(Math.cos(a) * 0.12, 0.66, Math.sin(a) * 0.12);
    brazier.add(shell);
  }
  stall.add(brazier);

  // Display table at the front with plastic basins of shellfish.
  stall.add(box(3.6, 0.06, 1.0, std(0x9ca3af, 0.4, 0.6), 0, 0.7, 0.95));
  [-1.7, 1.7].forEach((x) => [0.55, 1.35].forEach((z) => stall.add(box(0.05, 0.68, 0.05, frame, x, 0.34, z))));
  const basinColors = [0xdc2626, 0x2563eb, 0x16a34a, 0xdc2626, 0xf59e0b, 0x2563eb];
  const shellfish = [
    { color: 0x8b5a2b, scale: [1, 1.3, 1] }, // ốc hương
    { color: 0x2b2522, scale: [1, 1.6, 1] }, // ốc len
    { color: 0xe7e5e4, scale: [1.4, 0.6, 1] }, // nghêu
    { color: 0x6b4f3a, scale: [1.3, 0.7, 1.1] }, // sò huyết
    { color: 0xd6b48a, scale: [1.5, 0.45, 1.3] }, // sò điệp
    { color: 0x3f3f46, scale: [1.1, 1.1, 1.1] }, // ốc bươu
  ];
  const shellGeo = new THREE.IcosahedronGeometry(0.035, 1);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  basinColors.forEach((color, i) => {
    const x = -1.2 + (i % 3) * 1.2;
    const z = i < 3 ? 0.72 : 1.18;
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.17, 0.12, 20, 1, true),
      new THREE.MeshStandardMaterial({ color, roughness: 0.45, side: THREE.DoubleSide })
    );
    basin.position.set(x, 0.79, z);
    stall.add(basin);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), std(color, 0.45));
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.set(x, 0.735, z);
    stall.add(bottom);
    const kind = shellfish[i];
    const count = 40;
    const shells = new THREE.InstancedMesh(shellGeo, std(kind.color, 0.55), count);
    for (let k = 0; k < count; k++) {
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * 0.19;
      euler.set(random() * 3, random() * 3, random() * 3);
      quaternion.setFromEuler(euler);
      matrix.compose(
        new THREE.Vector3(x + Math.cos(a) * r, 0.76 + random() * 0.05, z + Math.sin(a) * r),
        quaternion,
        new THREE.Vector3(...(kind.scale as [number, number, number]))
      );
      shells.setMatrixAt(k, matrix);
    }
    stall.add(shells);
  });

  // Styrofoam ice boxes stacked at the side.
  const foam = std(0xf5f5f4, 0.9);
  stall.add(box(0.62, 0.4, 0.44, foam, -2.4, 0.2, -0.6));
  stall.add(box(0.62, 0.4, 0.44, foam, -2.4, 0.6, -0.6));
  stall.add(box(0.62, 0.4, 0.44, foam, -2.45, 0.2, -0.1));

  // Fluorescent tube under the tarp.
  stall.add(
    box(
      1.4,
      0.04,
      0.04,
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8f4ff, emissiveIntensity: 5 }),
      0,
      2.68,
      0.4
    )
  );
  const tube = new THREE.PointLight(0xe8f4ff, 7, 7, 2);
  tube.position.set(0, 2.5, 0.4);
  stall.add(tube);

  // Shop sign on the roof (the neon board without its ground poles).
  const sign = createNeonSign('QUÁN ỐC BỜ SÔNG', 'ỐC • SÒ • NGHÊU • BIA LẠNH', 0x06b6d4);
  sign.children.slice(1).forEach((pole) => sign.remove(pole));
  sign.scale.setScalar(0.95);
  sign.position.set(0, 3.58, 1.7);
  stall.add(sign);
  [-1.6, 1.6].forEach((x) => stall.add(box(0.05, 0.4, 0.05, frame, x, 2.95, 1.7)));

  const update = (time: number) => {
    const flicker = 0.85 + Math.sin(time * 11) * 0.08 + Math.sin(time * 23.7) * 0.07;
    (coals.material as THREE.MeshStandardMaterial).emissiveIntensity = 3 * flicker;
  };
  return { group: stall, update };
}

function createBoat(seed: number) {
  const random = rng(seed);
  const boat = new THREE.Group();
  const outline = new THREE.Shape();
  outline.moveTo(-1.9, -0.5);
  outline.lineTo(1.1, -0.62);
  outline.quadraticCurveTo(1.8, -0.4, 2.1, 0);
  outline.quadraticCurveTo(1.8, 0.4, 1.1, 0.62);
  outline.lineTo(-1.9, 0.5);
  outline.closePath();
  const hull = new THREE.Mesh(
    new THREE.ExtrudeGeometry(outline, { depth: 0.5, bevelEnabled: false }),
    std(random() < 0.5 ? 0x5b3a1e : 0x1e3a5f, 0.7)
  );
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.25;
  boat.add(hull);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(outline), std(0x3b2614, 0.85));
  deck.rotation.x = -Math.PI / 2;
  deck.scale.setScalar(0.9);
  deck.position.y = 0.2;
  boat.add(deck);
  const canopyGeo = new THREE.CylinderGeometry(0.58, 0.58, 1.7, 14, 1, true, 0, Math.PI);
  canopyGeo.rotateZ(Math.PI / 2);
  const canopy = new THREE.Mesh(
    canopyGeo,
    new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9, side: THREE.DoubleSide })
  );
  canopy.position.set(-0.4, 0.2, 0);
  boat.add(canopy);
  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xff3b1f, emissiveIntensity: 4 })
  );
  lantern.scale.y = 1.3;
  lantern.position.set(1.3, 0.9, 0);
  boat.add(lantern);
  boat.add(box(0.03, 0.7, 0.03, std(0x3b2614), 1.3, 0.5, 0));
  return boat;
}

function createBridge() {
  const bridge = new THREE.Group();
  bridge.name = 'Bridge';
  const concrete = std(0x52525b, 0.8);
  const length = 110;
  const deckY = 5.2;
  bridge.add(box(5, 0.6, length, concrete, 0, deckY, -length / 2 + 25));
  for (let z = 15; z > -length + 25; z -= 14) {
    bridge.add(box(1.2, deckY + 3, 1.6, concrete, 0, (deckY - 3) / 2, z));
  }
  const ledMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x22d3ee, emissiveIntensity: 3 });
  [-2.55, 2.55].forEach((x) => bridge.add(box(0.08, 0.12, length, ledMaterial, x, deckY + 0.35, -length / 2 + 25)));
  // Lamp posts on the deck.
  const lampHead = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd08a, emissiveIntensity: 5 });
  for (let z = 20; z > -length + 25; z -= 8) {
    [-2.3, 2.3].forEach((x) => {
      bridge.add(box(0.08, 2.2, 0.08, concrete, x, deckY + 1.4, z));
      bridge.add(box(0.2, 0.08, 0.2, lampHead, x, deckY + 2.5, z));
    });
  }
  const update = (time: number) => {
    // The bridge LEDs slowly cycle through colours.
    ledMaterial.emissive.setHSL((time * 0.03) % 1, 0.85, 0.5);
  };
  return { group: bridge, update };
}

function createBuildingRow(options: {
  seed: number;
  z: number;
  facing: 1 | -1;
  fromX: number;
  toX: number;
  minHeight: number;
  maxHeight: number;
  depth: number;
  shopFront: boolean;
}) {
  const random = rng(options.seed);
  const row = new THREE.Group();
  const textures = Array.from({ length: 5 }, (_, i) =>
    facadeTexture(options.seed * 10 + i, options.shopFront ? 4 : 12, options.shopFront ? 3 : 6, 0.45, options.shopFront)
  );
  const wallColors = [0x2a2a30, 0x34302c, 0x2b3036, 0x3a2f2f, 0x2f3329];
  let x = options.fromX;
  while (x < options.toX) {
    // Shophouses fill the row exactly (the last one is trimmed to toX).
    const width = options.shopFront ? Math.min(3.6 + random() * 1.6, options.toX - x) : 6 + random() * 9;
    const height = options.minHeight + random() * (options.maxHeight - options.minHeight);
    const texture = textures[Math.floor(random() * textures.length)];
    const facade = new THREE.MeshStandardMaterial({
      color: wallColors[Math.floor(random() * wallColors.length)],
      roughness: 0.85,
      emissiveMap: texture,
      emissive: 0xffffff,
      emissiveIntensity: options.shopFront ? 1.1 : 1.5,
    });
    const plain = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    // Only the face toward the river gets windows (BoxGeometry groups: +x,-x,+y,-y,+z,-z).
    const materials = [plain, plain, plain, plain, plain, plain];
    materials[options.facing === 1 ? 4 : 5] = facade;
    const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, options.depth), materials);
    building.position.set(x + width / 2, height / 2 - 0.2, options.z - (options.facing * options.depth) / 2);
    row.add(building);
    x += width + (options.shopFront ? 0 : random() * 3);
  }
  return row;
}

function createSky() {
  const sky = new THREE.Group();
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(4, 24, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff6dd).multiplyScalar(2.2), fog: false })
  );
  moon.position.set(-70, 48, -170);
  sky.add(moon);
  const random = rng(42);
  const count = 220;
  const stars = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.22, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xdbe4ff, fog: false }),
    count
  );
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = (random() - 0.5) * Math.PI * 1.6 + Math.PI;
    const elevation = 0.18 + random() * 1.1;
    const r = 190;
    matrix.makeTranslation(
      Math.sin(a) * Math.cos(elevation) * r,
      Math.sin(elevation) * r,
      Math.cos(a) * Math.cos(elevation) * r
    );
    stars.setMatrixAt(i, matrix);
  }
  sky.add(stars);
  return sky;
}

// ---------- assembly ----------

export function createRiversideScenery(): RiversideScenery {
  const ground = createGround();
  const props = new THREE.Group();
  props.name = 'RiversideProps';
  const backdrop = new THREE.Group();
  backdrop.name = 'RiversideBackdrop';
  const updates: ((time: number, delta: number, focus?: THREE.Vector3) => void)[] = [];
  const colliders: Collider[] = [];
  const seats: Seat[] = [];
  const circle = (x: number, z: number, r: number) => colliders.push({ kind: 'circle', x, z, r });

  props.add(createEmbankment());

  // Street lamps along the railing, arms reaching over the sidewalk.
  [-14, 0, 14].forEach((x) => {
    const lamp = createStreetLamp();
    lamp.position.set(x, 0, RIVER_EDGE_Z + 0.35);
    props.add(lamp);
    circle(x, RIVER_EDGE_Z + 0.35, 0.12);
  });

  // Neighbouring tables spread along the embankment.
  // Each one is dressed (dishes, drinks, shells, bucket) and then merged into a few meshes.
  const NEIGHBOUR_TABLES: {
    x: number;
    z: number;
    rotation: number;
    dishes: string[];
    umbrella?: [number, number];
    iceBucket?: boolean;
  }[] = [
    { x: -4.6, z: -2.6, rotation: 0.4, dishes: ['oc_huong', 'peanut'] },
    { x: -4.4, z: 2.6, rotation: 1.3, dishes: ['oc_huong', 'chicken_feet', 'xoai_non'], umbrella: [0xdc2626, 0xca8a04] },
    { x: 3.4, z: -3.4, rotation: 2.2, dishes: ['ca_vien', 'oc_huong'], iceBucket: true },
    { x: -9.2, z: -1.2, rotation: 0.9, dishes: ['peanut', 'oc_huong', 'ca_vien'], umbrella: [0x15803d, 0xa16207] },
    { x: -10.4, z: 3.2, rotation: 2.6, dishes: ['chicken_feet', 'oc_huong'], iceBucket: true },
  ];
  const NEIGHBOUR_TOP = 0.98 * 0.9; // createNeighborTableGroup scales the table by 0.9 in Y
  NEIGHBOUR_TABLES.forEach(({ x, z, rotation, dishes, umbrella, iceBucket }, index) => {
    const neighbour = createNeighborTableGroup();
    neighbour.position.set(x, 0, z);
    neighbour.rotation.y = rotation;
    if (umbrella) {
      // The umbrella pole goes through the middle where the beer tower stood.
      neighbour.children[1].removeFromParent();
      neighbour.add(createUmbrella(umbrella[0], umbrella[1]));
    } else {
      neighbour.add(createHangingBulb(3.0, 2.3));
    }
    neighbour.add(
      createTableSpread({ seed: 100 + index * 17, top: NEIGHBOUR_TOP, radius: 1.15, dishes, clearCenter: 0.26, iceBucket })
    );
    const bucket = createShellBucket(index % 2 ? 0x2563eb : 0xdc2626, index);
    bucket.position.set(Math.cos(Math.PI / 3) * 1.3, 0, Math.sin(Math.PI / 3) * 1.3);
    neighbour.add(bucket);
    const litter = createFloorLitterAndBottles();
    litter.scale.setScalar(0.8);
    litter.rotation.y = index;
    neighbour.add(litter);
    // Table top radius 1.6 × 0.75. Its stools come at 1.15 m, under the rim: pull them
    // out to 1.5 m so someone can actually sit there (children 2..4 are the stools).
    circle(x, z, 1.1);
    neighbour.children.slice(2, 5).forEach((stool) => {
      stool.position.setLength(1.5);
      stool.rotation.y = Math.atan2(stool.position.x, stool.position.z);
      const world = stool.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
      seats.push({ x: x + world.x, z: z + world.z, facing: Math.atan2(-world.x, -world.z), table: 1 + index });
    });
    props.add(mergeStatic(neighbour));
  });

  const stall = createSnailStall();
  stall.group.position.set(8.2, 0, 0.6);
  stall.group.rotation.y = -Math.PI / 2 + 0.3;
  props.add(mergeStatic(stall.group));
  /** A point in the stall's frame (local +z is its customer-facing front). */
  const stallSpot = (lx: number, lz: number) =>
    new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), stall.group.rotation.y).add(stall.group.position);
  const place = (object: THREE.Object3D, at: THREE.Vector3, yaw: number) => {
    object.position.copy(at);
    object.rotation.y = yaw;
    return object;
  };

  // Drinks fridge beside the ice boxes, seafood tanks on the road side of the stall.
  const fridgeAt = stallSpot(-3.35, -0.9);
  props.add(mergeStatic(place(createDrinksFridge(), fridgeAt, stall.group.rotation.y)));
  colliders.push({ kind: 'box', x: fridgeAt.x, z: fridgeAt.z, hw: 0.42, hd: 0.38, yaw: stall.group.rotation.y });
  const tanks = createSeafoodTanks();
  const tanksAt = stallSpot(3.25, 0.2);
  props.add(place(tanks.group, tanksAt, stall.group.rotation.y));
  updates.push(tanks.update);
  colliders.push({ kind: 'box', x: tanksAt.x, z: tanksAt.z, hw: 0.8, hd: 0.34, yaw: stall.group.rotation.y });
  // Thần Tài shrine on the floor at the corner of the stall, facing the customers.
  props.add(mergeStatic(place(createShrine(), stallSpot(-1.95, 0.1), stall.group.rotation.y)));

  // Football on TV, turned toward the tables.
  const tv = createFootballTv();
  props.add(place(tv.group, new THREE.Vector3(5.6, 0, 3.9), Math.atan2(-8.6, -3.9)));
  updates.push(tv.update);
  circle(5.6, 3.9, 0.4);

  // Spare stools stacked up, a bin by the curb.
  (
    [
      [6.3, -2.3, 0xdc2626, 7],
      [5.8, -1.7, 0x0284c7, 6],
      [-13.2, -4.2, 0x0284c7, 5],
      [-12.6, -4.5, 0xdc2626, 4],
    ] as const
  ).forEach(([x, z, color, count], i) => {
    props.add(mergeStatic(place(createStoolStack(color, count), new THREE.Vector3(x, 0, z), i * 0.7)));
    circle(x, z, 0.32);
  });
  props.add(mergeStatic(place(createTrashBin(), new THREE.Vector3(6.4, 0, 5.5), 0)));
  circle(6.4, 5.5, 0.3);
  {
    // The stall's footprint spans local z -1.35..1.5 (back panel to display table).
    const center = new THREE.Vector3(0, 0, 0.075).applyAxisAngle(new THREE.Vector3(0, 1, 0), stall.group.rotation.y);
    colliders.push({
      kind: 'box',
      x: stall.group.position.x + center.x,
      z: stall.group.position.z + center.z,
      hw: 2.75, // includes the stacked ice boxes at the side
      hd: 1.45,
      yaw: stall.group.rotation.y,
    });
  }
  updates.push(stall.update);

  const crates = createBeerCrates();
  crates.position.set(10.8, 0, -2.8);
  crates.rotation.y = 0.5;
  props.add(crates);
  const crates2 = createBeerCrates();
  crates2.position.set(11.5, 0, -2.1);
  crates2.rotation.y = -0.2;
  crates2.scale.y = 0.68;
  props.add(crates2);
  circle(10.8, -2.8, 0.45);
  circle(11.5, -2.1, 0.45);

  const fan = createStandingIndustrialFan();
  fan.group.position.set(-2.6, 0, -4.4);
  fan.group.rotation.y = 0.5; // blowing toward the main table
  props.add(fan.group);
  circle(-2.6, -4.4, 0.3);
  updates.push((_, delta) => {
    fan.bladesGroup.rotation.z += delta * 14;
  });

  // Trees in planters along the curb.
  [
    [-13, 5.6, 1],
    [6.5, 5.7, 2],
    [-20, 5.6, 3],
    [29.5, 5.6, 4], // past the parking lot
  ].forEach(([x, z, seed]) => {
    const tree = createTree(seed);
    tree.position.set(x, 0, z);
    props.add(tree);
    circle(x, z, 0.6);
  });

  // Bãi giữ xe: the lot the ride ends in (and the ride home starts from).
  const parking = createQuanOcParking();
  props.add(parking.group);
  colliders.push(...parking.colliders);
  updates.push((time) => parking.update(time));

  // Scooters parked nose-in along the curb.
  [
    [-7.6, 0xe11d48],
    [-6.7, 0x0ea5e9],
    [-5.8, 0xf4f4f5],
    [-4.9, 0x22c55e],
  ].forEach(([x, color], i) => {
    const bike = createParkedScooter(color);
    bike.position.set(x, 0, ROAD_EDGE_Z - 0.75);
    bike.rotation.y = Math.PI / 2 + (i % 2 ? 0.08 : -0.06);
    props.add(bike);
    colliders.push({ kind: 'box', x, z: ROAD_EDGE_Z - 0.75, hw: 0.55, hd: 0.2, yaw: bike.rotation.y });
  });

  // Festoon lights: along the railing, and two strings crossing over the dining area.
  const festoonPole = (x: number, z: number) => {
    const pole = box(0.05, 3.1, 0.05, std(0x27272a, 0.5, 0.6), x, 1.55, z);
    props.add(pole);
    circle(x, z, 0.08);
  };
  [-7, 7].forEach((x) => festoonPole(x, RIVER_EDGE_Z + 0.2));
  [-5, 5].forEach((x) => festoonPole(x, ROAD_EDGE_Z - 0.3));
  // Banner between the road-side poles, reading from the street and the tables.
  const banner = createBanner('QUÁN ỐC BỜ SÔNG', 'Ốc tươi mỗi ngày • Bia lạnh • Mở cửa 16h - 2h sáng', 8);
  banner.position.set(0, 2.5, ROAD_EDGE_Z - 0.3);
  props.add(banner);
  props.add(
    festoon(
      [-21, -14, -7, 0, 7, 14, 21].map((x) => new THREE.Vector3(x, x === 0 || Math.abs(x) === 14 ? 3.2 : 3.05, RIVER_EDGE_Z + 0.2)),
      0.45,
      0.6
    )
  );
  props.add(
    festoon([new THREE.Vector3(-7, 3.05, RIVER_EDGE_Z + 0.2), new THREE.Vector3(5, 3.05, ROAD_EDGE_Z - 0.3)], 0.35, 0.55)
  );
  props.add(
    festoon([new THREE.Vector3(7, 3.05, RIVER_EDGE_Z + 0.2), new THREE.Vector3(-5, 3.05, ROAD_EDGE_Z - 0.3)], 0.35, 0.55)
  );

  // ---- Backdrop: river, boats, bridge, far bank, shophouses, sky ----
  const ripples = rippleNormalTexture();
  ripples.repeat.set(150, 64);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 180),
    new THREE.MeshStandardMaterial({
      color: 0x050c11,
      roughness: 0.16,
      metalness: 0.4,
      normalMap: ripples,
      normalScale: new THREE.Vector2(0.22, 0.22),
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WATER_Y, RIVER_EDGE_Z - 90);
  backdrop.add(water);
  updates.push((_, delta) => {
    ripples.offset.x += delta * 0.012;
    ripples.offset.y += delta * 0.004;
  });

  const boats = [
    { x: -3.5, z: RIVER_EDGE_Z - 2.4, yaw: 0.08, seed: 3 },
    { x: 5.2, z: RIVER_EDGE_Z - 3.1, yaw: -0.12, seed: 8 },
    { x: 18, z: RIVER_EDGE_Z - 9, yaw: 0.6, seed: 13 },
  ].map(({ x, z, yaw, seed }, i) => {
    const boat = createBoat(seed);
    boat.position.set(x, WATER_Y, z);
    boat.rotation.y = yaw;
    backdrop.add(boat);
    return { boat, phase: i * 1.7, yaw };
  });
  updates.push((time) => {
    boats.forEach(({ boat, phase }) => {
      boat.position.y = WATER_Y + Math.sin(time * 1.1 + phase) * 0.04;
      boat.rotation.z = Math.sin(time * 0.9 + phase) * 0.03;
      boat.rotation.x = Math.sin(time * 0.7 + phase * 2) * 0.02;
    });
  });

  const bridge = createBridge();
  bridge.group.position.set(-95, 0, 0);
  backdrop.add(bridge.group);
  updates.push(bridge.update);

  // Far bank: embankment wall, then a skyline of towers.
  const farZ = RIVER_EDGE_Z - 70;
  backdrop.add(box(400, 3, 4, std(0x27272a, 0.9), 0, WATER_Y + 1.3, farZ - 2));
  backdrop.add(
    box(
      400,
      0.08,
      0.08,
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc46b, emissiveIntensity: 3 }),
      0,
      WATER_Y + 3.1,
      farZ
    )
  );
  backdrop.add(
    createBuildingRow({ seed: 5, z: farZ - 6, facing: 1, fromX: -160, toX: 160, minHeight: 10, maxHeight: 48, depth: 10, shopFront: false })
  );
  backdrop.add(
    createBuildingRow({ seed: 9, z: farZ - 22, facing: 1, fromX: -200, toX: 200, minHeight: 25, maxHeight: 80, depth: 12, shopFront: false })
  );

  // Shophouses across the road ("nhà phố"), facing the river, with the quán's own
  // walk-in house in the middle of the row.
  const houseFront = FAR_WALK_Z + 2.4;
  const houseHalf = HOUSE_WIDTH / 2 + 0.1;
  [
    [-HALF_WIDTH, -houseHalf, 21],
    [houseHalf, HALF_WIDTH, 22],
  ].forEach(([fromX, toX, seed]) => {
    backdrop.add(
      createBuildingRow({ seed, z: houseFront, facing: -1, fromX, toX, minHeight: 8, maxHeight: 15, depth: 8, shopFront: true })
    );
    // Solid block behind the neighbours' fronts (also the house's side walls from outside).
    colliders.push({
      kind: 'box',
      x: (fromX + toX) / 2,
      z: houseFront + HOUSE_DEPTH / 2 + 1,
      hw: (toX - fromX) / 2 + (fromX < 0 ? 0.3 : 0.3),
      hd: HOUSE_DEPTH / 2 + 1,
      yaw: 0,
    });
  });
  const house = createQuanOcHouse({ originX: 0, front: houseFront });
  props.add(house.group);
  colliders.push(...house.colliders);
  seats.push(...house.seats);
  updates.push(house.update);

  return {
    ground,
    props,
    backdrop,
    sky: createSky(),
    house: { interior: house.interior, tight: house.tight, staff: house.staff, route: house.route },
    parking,
    colliders,
    seats,
    bounds: {
      minX: -HALF_WIDTH + 2,
      maxX: HALF_WIDTH - 2,
      minZ: RIVER_EDGE_Z + 0.35, // the railing
      maxZ: houseFront + HOUSE_DEPTH - 0.3, // into the house; the row of buildings is a collider
      groundY: (_x, z) => (z > ROAD_EDGE_Z + 0.22 && z < FAR_WALK_Z ? -0.16 : 0),
    },
    update: (time, delta, focus) => updates.forEach((update) => update(time, delta, focus)),
  };
}
