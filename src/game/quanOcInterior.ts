/**
 * The walk-in shophouse of "Quán Ốc Bờ Sông": a two-bay nhà phố across the road
 * from the embankment, shutter rolled up, with the dining room, cashier counter
 * and kitchen inside.
 *
 * Local frame = world frame shifted by `origin` in X: the front (street) face is at
 * z = front and faces -Z (toward the river), the room runs back to front + DEPTH.
 *
 *   front ── tanks (left) · Thần Tài (right) · door
 *     │     4 tables in two rows, aisle down the middle
 *     │     freezer · fridge │ door │ cashier counter     ← z ≈ front + 8.5
 *     │     ─── half wall with pass-through + kitchen door ───
 *   back ── kitchen: stove + wok, sink, shelves, gas bottle
 */
import * as THREE from 'three/webgpu';
import { createBeerCrates, createPlasticStool, createStainlessTable } from './proceduralModels';
import type { Collider, Seat } from './playerController';
import {
  createDrinksFridge,
  createFootballTv,
  createSeafoodTanks,
  createShellBucket,
  createShrine,
  createStoolStack,
  createTableSpread,
  mergeStatic,
  rng,
} from './quanOcProps';

export const HOUSE_WIDTH = 12; // outer, wall centre to wall centre
export const HOUSE_DEPTH = 16;
const INNER = HOUSE_WIDTH / 2 - 0.2; // interior half width (walls are 0.2 thick inside)
const CEILING = 3.8;
const WALL = 0.2;
/** Layout (local x across the room, z back from the shopfront). */
const TABLE_SPOTS: [number, number][] = [
  [-3.6, 4.4],
  [0, 4.4],
  [3.6, 4.4],
  [-3.6, 8.4],
  [0, 8.4],
  [3.6, 8.4],
];
const CASHIER_X = 4.6; // centre of the cashier corner, front right
const WC_FRONT = 11.6; // the WC block fills the back-left corner from here…
const WC_RIGHT = -2.2; // …to here (local x)
const KITCHEN_Z = 12.3; // kitchen half wall

export interface QuanOcHouse {
  group: THREE.Group;
  colliders: Collider[];
  seats: Seat[];
  /** Interior box (world), for keeping the camera inside while the player is in. */
  interior: THREE.Box3;
  /** The WC: a tight space where the follow camera has to come in close. */
  tight: THREE.Box3;
  /** Where the indoor staff stand: cook at the stove, cashier behind the counter. */
  staff: { cook: Seat; cashier: Seat };
  /** Waitress loop inside (world points, pause seconds). */
  route: { x: number; z: number; pause: number }[];
  /** `focus` (the player) opens the WC doors when close. */
  update: (time: number, delta: number, focus?: THREE.Vector3) => void;
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

/** A flat picture (poster, menu, calendar) hung on a wall; faces local +Z. */
function picture(texture: THREE.Texture, w: number, h: number, glowAmount = 0.25) {
  const frame = new THREE.Group();
  frame.add(box(w + 0.06, h + 0.06, 0.03, std(0x3f2a1d, 0.6)));
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: glowAmount, roughness: 0.7 })
  );
  face.position.z = 0.017;
  frame.add(face);
  return frame;
}

// ---------- textures ----------

function floorTiles() {
  const random = rng(3);
  const texture = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#a89c86';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const shade = 196 + Math.floor(random() * 14);
        ctx.fillStyle = `rgb(${shade}, ${shade - 8}, ${shade - 22})`;
        ctx.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
        // Faint marbling.
        ctx.strokeStyle = 'rgba(160,140,110,0.18)';
        ctx.beginPath();
        ctx.moveTo(x * 128 + random() * 128, y * 128 + 3);
        ctx.bezierCurveTo(x * 128 + random() * 128, y * 128 + 60, x * 128 + random() * 128, y * 128 + 70, x * 128 + random() * 128, y * 128 + 125);
        ctx.stroke();
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function wallTiles() {
  const texture = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 7 === 0 ? '#93c5fd' : '#dbe3ec';
        ctx.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function upperFacade() {
  return canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#d6c7a1';
    ctx.fillRect(0, 0, 512, 512);
    // Two floors of windows with balconies, AC units and plants.
    for (let floor = 0; floor < 2; floor++) {
      const top = 40 + floor * 240;
      ctx.fillStyle = floor === 0 ? '#ffd9a0' : '#1f2937';
      ctx.fillRect(60, top, 392, 150);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 6;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(60 + i * 98, top);
        ctx.lineTo(60 + i * 98, top + 150);
        ctx.stroke();
      }
      ctx.fillStyle = '#374151';
      ctx.fillRect(30, top + 150, 452, 10);
      for (let i = 0; i < 24; i++) ctx.fillRect(34 + i * 19, top + 160, 4, 46);
      ctx.fillRect(30, top + 200, 452, 8);
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(400, top + 120, 60, 36);
      ctx.fillStyle = '#15803d';
      [[70, top + 130], [110, top + 136], [300, top + 132]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });
}

function signboard() {
  return canvasTexture(1024, 140, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 140);
    g.addColorStop(0, '#1d4ed8');
    g.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 140);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 1012, 128);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 66px sans-serif';
    ctx.fillText('QUÁN ỐC BỜ SÔNG', 512, 72);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('Hải sản tươi sống • Ốc các loại • Bia lạnh • Phục vụ tới 2h sáng', 512, 118);
  });
}

function menuBoard() {
  return canvasTexture(640, 360, (ctx) => {
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = '#fde047';
    ctx.font = '900 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THỰC ĐƠN', 320, 54);
    const items = [
      ['Ốc hương xào bơ tỏi', '120k'],
      ['Ốc len xào dừa', '70k'],
      ['Sò điệp nướng mỡ hành', '80k'],
      ['Nghêu hấp sả', '60k'],
      ['Càng ghẹ rang muối', '150k'],
      ['Hàu nướng phô mai', '90k'],
      ['Sò huyết cháy tỏi', '85k'],
      ['Lẩu thái hải sản', '250k'],
    ];
    ctx.font = 'bold 24px sans-serif';
    items.forEach(([name, price], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(name, 24 + col * 312, 110 + row * 62);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fde047';
      ctx.fillText(price, 300 + col * 312, 110 + row * 62);
    });
  });
}

function calendar() {
  return canvasTexture(256, 360, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 360);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 256, 70);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THÁNG 11', 128, 48);
    ctx.fillStyle = '#dc2626';
    ctx.font = '900 150px sans-serif';
    ctx.fillText('12', 128, 230);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('Thứ Năm', 128, 280);
    ctx.font = '22px sans-serif';
    ctx.fillText('Âm lịch: 23/9', 128, 320);
  });
}

function beerPoster() {
  return canvasTexture(256, 360, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, '#065f46');
    g.addColorStop(1, '#022c22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 360);
    // A frosty glass of beer.
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(78, 110, 100, 170);
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(72, 86, 112, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(90, 130, 12, 130);
    ctx.fillStyle = '#fde047';
    ctx.font = '900 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BIA HƠI', 128, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('MÁT LẠNH • 1, 2, 3 DZÔ!', 128, 320);
  });
}

function clockFace() {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillStyle = '#111827';
      ctx.fillRect(64 + Math.sin(a) * 50 - 2, 64 - Math.cos(a) * 50 - 2, 4, 4);
    }
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(64 + 26, 64 + 18); // ~22:20
    ctx.moveTo(64, 64);
    ctx.lineTo(64 + 6, 64 + 44);
    ctx.stroke();
  });
}

// ---------- pieces ----------

function createCeilingFan() {
  const fan = new THREE.Group();
  const metal = std(0xe5e7eb, 0.4, 0.5);
  fan.add(box(0.03, 0.4, 0.03, metal, 0, -0.2, 0));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.12, 16), metal);
  hub.position.y = -0.44;
  fan.add(hub);
  const blades = new THREE.Group();
  blades.position.y = -0.47;
  const bladeMaterial = std(0xd6d3d1, 0.5, 0.2);
  for (let i = 0; i < 3; i++) {
    const blade = box(0.62, 0.012, 0.13, bladeMaterial, 0.38, 0, 0);
    const arm = new THREE.Group();
    arm.add(blade);
    arm.rotation.y = (i / 3) * Math.PI * 2;
    blade.rotation.x = 0.12;
    blades.add(arm);
  }
  fan.add(blades);
  return { group: fan, blades };
}

function createTubeLight(length = 1.2) {
  const group = new THREE.Group();
  group.add(box(length + 0.06, 0.04, 0.1, std(0xf4f4f5, 0.5, 0.3), 0, 0.02, 0));
  group.add(box(length, 0.035, 0.035, glow(0xf0f9ff, 6), 0, -0.02, 0));
  return group;
}

function createWallFan() {
  const group = new THREE.Group();
  const plastic = std(0xf4f4f5, 0.5);
  group.add(box(0.12, 0.18, 0.06, plastic, 0, 0, 0.03));
  const head = new THREE.Group();
  head.position.set(0, -0.05, 0.22);
  head.rotation.x = 0.35;
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 24), std(0x9ca3af, 0.4, 0.6));
  head.add(cage);
  const blades = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const b = box(0.16, 0.06, 0.008, std(0x60a5fa, 0.4), 0.09, 0, 0);
    const arm = new THREE.Group();
    arm.add(b);
    arm.rotation.z = (i / 3) * Math.PI * 2;
    blades.add(arm);
  }
  head.add(blades);
  group.add(box(0.04, 0.04, 0.2, plastic, 0, -0.05, 0.12));
  group.add(head);
  return { group, blades };
}

/** Indoor table: a smaller stainless round table with four stools on the diagonals. */
function createIndoorTable(seed: number, dishes: string[], iceBucket: boolean) {
  const group = new THREE.Group();
  const table = createStainlessTable();
  table.scale.set(0.62, 0.9, 0.62);
  group.add(table);
  const stoolPositions: THREE.Vector3[] = [];
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + (i * Math.PI) / 2;
    const stool = createPlasticStool(i % 2 ? 0x0284c7 : 0xdc2626);
    stool.position.set(Math.cos(angle) * 1.25, 0, Math.sin(angle) * 1.25);
    stool.rotation.y = Math.atan2(stool.position.x, stool.position.z);
    group.add(stool);
    stoolPositions.push(stool.position.clone());
  }
  group.add(createTableSpread({ seed, top: 0.98 * 0.9, radius: 0.95, dishes, clearCenter: 0.18, iceBucket }));
  const bucket = createShellBucket(seed % 2 ? 0x2563eb : 0xdc2626, seed);
  bucket.position.set(1.15, 0, 0);
  group.add(bucket);
  return { group, stoolPositions };
}

function createCashierCounter() {
  const group = new THREE.Group();
  const random = rng(9);
  // Wood-front counter with a laminate top.
  group.add(box(2.4, 1.0, 0.6, std(0x7c4a24, 0.55), 0, 0.5, 0));
  group.add(box(2.5, 0.05, 0.7, std(0xe7e5e4, 0.3, 0.1), 0, 1.025, 0));
  const front = canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = '#7c4a24';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#fde047';
    ctx.font = '900 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THU NGÂN', 256, 82);
  });
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.35),
    new THREE.MeshStandardMaterial({ map: front, emissiveMap: front, emissive: 0xffffff, emissiveIntensity: 0.2 })
  );
  panel.rotation.y = Math.PI;
  panel.position.set(0, 0.65, -0.305);
  group.add(panel);
  // Cash register with a lit display, calculator, bill book, toothpick jar.
  group.add(box(0.42, 0.14, 0.36, std(0x27272a, 0.4, 0.4), -0.6, 1.12, 0.05));
  const screen = box(0.26, 0.12, 0.02, glow(0x4ade80, 2.2), -0.6, 1.28, -0.02);
  screen.rotation.x = -0.4;
  group.add(screen);
  group.add(box(0.12, 0.02, 0.18, std(0x1f2937, 0.4), 0.05, 1.06, -0.05));
  group.add(box(0.22, 0.03, 0.3, std(0xfefce8, 0.9), 0.4, 1.065, 0));
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 12), std(0xe0f2fe, 0.1)).translateX(0.75).translateY(1.095));
  // Waving lucky cat.
  const cat = new THREE.Group();
  cat.position.set(0.95, 1.05, 0.1);
  cat.rotation.y = Math.PI;
  const white = std(0xfafaf9, 0.5);
  cat.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), white).translateY(0.07));
  cat.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), white).translateY(0.17));
  cat.add(box(0.03, 0.08, 0.03, white, 0.06, 0.2, 0));
  cat.add(box(0.05, 0.02, 0.01, std(0xdc2626, 0.5), 0, 0.12, -0.065));
  group.add(cat);
  // Stack of bills.
  for (let i = 0; i < 6; i++) {
    const bill = box(0.1, 0.002, 0.16, std(0xfef3c7, 0.9), 0.25 + random() * 0.04, 1.052 + i * 0.003, 0.2);
    bill.rotation.y = random() * 0.4;
    group.add(bill);
  }
  return group;
}

function createChestFreezer() {
  const group = new THREE.Group();
  group.add(box(1.3, 0.82, 0.72, std(0xf4f4f5, 0.35, 0.2), 0, 0.41, 0));
  group.add(box(1.2, 0.03, 0.62, glow(0xbae6fd, 0.8), 0, 0.835, 0));
  group.add(box(1.32, 0.04, 0.74, std(0x9ca3af, 0.3, 0.7), 0, 0.86, 0));
  const label = canvasTexture(256, 64, (ctx) => {
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ĐÁ VIÊN', 128, 45);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), new THREE.MeshStandardMaterial({ map: label }));
  sign.position.set(0, 0.6, 0.362);
  group.add(sign);
  return group;
}

function createKitchen() {
  const group = new THREE.Group();
  const random = rng(15);
  const steel = std(0xb4b4bb, 0.3, 0.8);
  const dark = std(0x1f2937, 0.5, 0.5);
  // Back counter along the rear wall (local z = 0 is the rear wall face).
  group.add(box(7.2, 0.9, 0.7, std(0x52525b, 0.6, 0.3), 0, 0.45, -0.35));
  group.add(box(7.3, 0.05, 0.75, steel, 0, 0.925, -0.375));
  // Gas stove with two burners: a wok and a stockpot.
  const flames: THREE.Mesh[] = [];
  const flameGroup = new THREE.Group(); // animated, so kept out of the merge
  const flameMaterial = glow(0xff7a1a, 4);
  [-1.6, -0.9].forEach((x) => {
    group.add(box(0.6, 0.12, 0.55, dark, x, 1.01, -0.35));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 6, 20), glow(0x3b82f6, 4));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 1.08, -0.35);
    group.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 6), flameMaterial);
      flame.position.set(x + Math.cos(a) * 0.1, 1.12, -0.35 + Math.sin(a) * 0.1);
      flameGroup.add(flame);
      flames.push(flame);
    }
  });
  const wok = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.7, side: THREE.DoubleSide })
  );
  wok.position.set(-1.6, 1.38, -0.35);
  group.add(wok);
  group.add(box(0.3, 0.025, 0.03, std(0x3f2a1d), -1.25, 1.36, -0.35));
  // Snails in the wok.
  for (let i = 0; i < 10; i++) {
    const snail = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 7), std(0x8b5a2b, 0.6));
    const a = random() * Math.PI * 2;
    const r = random() * 0.12;
    snail.position.set(-1.6 + Math.cos(a) * r, 1.2, -0.35 + Math.sin(a) * r);
    snail.rotation.set(random() * 3, random() * 3, 0);
    group.add(snail);
  }
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.32, 20), steel);
  pot.position.set(-0.9, 1.25, -0.35);
  group.add(pot);
  // Exhaust hood.
  group.add(box(1.6, 0.35, 0.7, steel, -1.25, 2.35, -0.4));
  // Sink with a tap.
  group.add(box(0.7, 0.04, 0.45, std(0x52525b, 0.2, 0.9), 1.4, 0.93, -0.35));
  group.add(box(0.03, 0.3, 0.03, steel, 1.4, 1.1, -0.6));
  group.add(box(0.03, 0.03, 0.18, steel, 1.4, 1.24, -0.52));
  // Shelves of plates and bowls on the rear wall.
  [1.65, 2.05].forEach((y) => {
    group.add(box(3.2, 0.03, 0.3, std(0x9ca3af, 0.4, 0.6), 1.3, y, -0.15));
    for (let i = 0; i < 6; i++) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.12, 16), std(i % 2 ? 0xf8fafc : 0xdbeafe, 0.4));
      stack.position.set(0.0 + i * 0.5, y + 0.075, -0.15);
      group.add(stack);
    }
  });
  // Hanging ladles.
  group.add(box(1.2, 0.02, 0.02, steel, -1.25, 1.95, -0.06));
  for (let i = 0; i < 4; i++) {
    group.add(box(0.015, 0.32, 0.015, steel, -1.7 + i * 0.3, 1.78, -0.06));
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), steel).translateX(-1.7 + i * 0.3).translateY(1.6).translateZ(-0.06));
  }
  // Red gas bottle, baskets of clams, crates.
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 16), std(0xdc2626, 0.4, 0.3)).translateX(-3.2).translateY(0.3).translateZ(-0.95));
  for (let b = 0; b < 2; b++) {
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.22, 16, 1, true), new THREE.MeshStandardMaterial({ color: b ? 0x16a34a : 0x2563eb, side: THREE.DoubleSide }));
    basket.position.set(0.4 + b * 0.6, 0.11, -1.05);
    group.add(basket);
    group.add(new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), std(b ? 0xe7e5e4 : 0x3f3f46, 0.7)).rotateX(-Math.PI / 2).translateZ(0.18).translateX(0.4 + b * 0.6).translateY(1.05));
  }
  const crates = createBeerCrates();
  crates.position.set(3.0, 0, -1.2);
  group.add(crates);
  const update = (time: number) => {
    flames.forEach((flame, i) => {
      flame.scale.y = 0.7 + Math.abs(Math.sin(time * 17 + i * 1.9)) * 0.7;
    });
  };
  return { group, flames: flameGroup, update };
}

// ---------- cashier area ----------

/**
 * U-shaped cashier corner by the entrance (local frame: x across the room, z from the
 * shopfront). The counter faces the aisle (-X); a display case closes the front and a
 * tall shelf of spirits and cigarettes stands against the wall behind the cashier.
 */
function createCashierArea() {
  const group = new THREE.Group();
  group.name = 'CashierArea';
  const random = rng(27);
  const colliders: Collider[] = [];

  const counter = createCashierCounter();
  counter.rotation.y = Math.PI / 2; // customer side (local -Z) faces -X, the aisle
  counter.position.set(-0.9, 0, 1.6);
  group.add(counter);
  colliders.push({ kind: 'box', x: -0.9, z: 1.6, hw: 0.36, hd: 1.26, yaw: 0 });

  // Payment QR stand on the counter.
  const qr = canvasTexture(128, 160, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 160);
    ctx.fillStyle = '#111827';
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 21; x++) {
        const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
        const ring = finder && (x % 14 === 0 || x % 14 === 6 || y % 14 === 0 || y % 14 === 6 || (x % 14 > 1 && x % 14 < 5 && y % 14 > 1 && y % 14 < 5));
        if (finder ? ring : random() < 0.45) ctx.fillRect(12 + x * 5, 12 + y * 5, 5, 5);
      }
    }
    ctx.fillStyle = '#0369a1';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QUÉT MÃ', 64, 136);
    ctx.fillText('THANH TOÁN', 64, 154);
  });
  const qrStand = new THREE.Group();
  qrStand.add(box(0.14, 0.18, 0.015, std(0x0369a1, 0.5)));
  qrStand.add(new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.15), new THREE.MeshStandardMaterial({ map: qr })).translateZ(0.009));
  qrStand.position.set(-1.12, 1.15, 2.5);
  qrStand.rotation.set(-0.2, -Math.PI / 2, 0, 'YXZ');
  group.add(qrStand);

  // Glass-topped display case across the front (cigarettes, gum, snacks).
  group.add(box(1.7, 0.85, 0.5, std(0x9ca3af, 0.3, 0.7), 0.25, 0.425, 0.3));
  const goods = [0xdc2626, 0xf8fafc, 0x2563eb, 0xfacc15, 0x16a34a, 0xea580c];
  for (let i = 0; i < 14; i++) {
    group.add(box(0.09, 0.05, 0.05, std(goods[i % goods.length], 0.5), -0.5 + i * 0.105, 0.88, 0.25 + (i % 2) * 0.12));
  }
  group.add(box(1.72, 0.02, 0.52, new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.35, depthWrite: false }), 0.25, 0.93, 0.3));
  colliders.push({ kind: 'box', x: 0.25, z: 0.3, hw: 0.86, hd: 0.27, yaw: 0 });

  // Tall shelf against the wall behind the cashier.
  const shelfX = 1.0;
  const frame = std(0x5b3a1e, 0.6);
  group.add(box(0.36, 2.3, 1.9, frame, shelfX + 0.04, 1.15, 1.7)); // back + sides as one block
  const shelfFace = std(0x7c4a24, 0.55);
  const bottleColors = [0x7c2d12, 0x14532d, 0xfef3c7, 0x1e3a8a, 0x713f12, 0xb91c1c];
  [0.55, 1.05, 1.55, 2.05].forEach((y, row) => {
    group.add(box(0.34, 0.03, 1.86, shelfFace, shelfX - 0.16, y - 0.015, 1.7));
    for (let i = 0; i < 9; i++) {
      const z = 0.9 + i * 0.2;
      if (row < 2) {
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.3, 10), new THREE.MeshStandardMaterial({ color: bottleColors[(i + row) % bottleColors.length], roughness: 0.15, metalness: 0.2 }));
        bottle.position.set(shelfX - 0.2, y + 0.15, z);
        group.add(bottle);
        group.add(box(0.02, 0.06, 0.02, std(0xd4d4d8, 0.3, 0.8), shelfX - 0.2, y + 0.33, z));
      } else {
        // Cartons of cigarettes and boxes of snacks.
        group.add(box(0.2, 0.09, 0.17, std(goods[(i + row) % goods.length], 0.5), shelfX - 0.2, y + 0.045 + (i % 3) * 0.09 * (row === 2 ? 1 : 0), z));
      }
    }
  });
  colliders.push({ kind: 'box', x: shelfX, z: 1.7, hw: 0.22, hd: 0.97, yaw: 0 });

  // Hanging sign over the counter.
  const signTex = canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = '#fde047';
    ctx.font = '900 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THU NGÂN', 256, 66);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('Tính tiền • Gọi thêm món', 256, 106);
  });
  const sign = box(0.04, 0.4, 1.6, new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.6 }), -1.0, 2.75, 1.6);
  group.add(sign);
  [-0.6, 0.6].forEach((dz) => group.add(box(0.01, 0.85, 0.01, std(0x27272a), -1.0, 3.37, 1.6 + dz)));

  return { group, colliders, stand: new THREE.Vector3(0.1, 0, 1.6) };
}

// ---------- restroom ----------

interface SwingDoor {
  pivot: THREE.Group;
  leaf: THREE.Group;
  width: number;
  /** +1: the leaf extends toward +X from the hinge, -1 toward -X. */
  hingeSide: 1 | -1;
  /** Sign of the rotation that swings the leaf inward (+Z). */
  swing: 1 | -1;
  angle: number;
}

function doorSign(text: string, color: string) {
  return canvasTexture(128, 64, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = color;
    ctx.font = '900 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 64, 46);
  });
}

function createSwingDoor(hingeX: number, z: number, width: number, hingeSide: 1 | -1, color: number, label: THREE.Texture): SwingDoor {
  const pivot = new THREE.Group();
  pivot.position.set(hingeX, 0, z);
  const leaf = new THREE.Group();
  pivot.add(leaf);
  const w = width - 0.02;
  leaf.add(box(w, 2.0, 0.04, std(color, 0.45), (hingeSide * w) / 2, 1.0, 0));
  leaf.add(box(0.05, 0.05, 0.06, std(0xd4d4d8, 0.2, 0.9), hingeSide * (w - 0.08), 1.0, 0));
  const signMaterial = new THREE.MeshStandardMaterial({ map: label });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), signMaterial);
  front.position.set((hingeSide * w) / 2, 1.6, -0.025);
  front.rotation.y = Math.PI;
  leaf.add(front);
  return { pivot, leaf, width, hingeSide, swing: hingeSide === 1 ? -1 : 1, angle: 0 };
}

function createBucketAndDipper(color: number) {
  const group = new THREE.Group();
  const plastic = new THREE.MeshStandardMaterial({ color, roughness: 0.45, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.32, 16, 1, true), plastic).translateY(0.16));
  group.add(new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), plastic).rotateX(-Math.PI / 2).translateZ(0.005));
  group.add(new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.05, metalness: 0.2 })).rotateX(-Math.PI / 2).translateZ(0.26));
  // Dipper (gáo) floating in the bucket.
  const dipper = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5, side: THREE.DoubleSide }));
  dipper.position.set(0.03, 0.31, 0);
  group.add(dipper);
  group.add(box(0.18, 0.02, 0.025, std(0xf59e0b, 0.5), 0.15, 0.32, 0));
  return group;
}

function createSittingToilet() {
  const group = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.05 });
  // Pedestal, bowl, seat, open lid and cistern (faces +Z; cistern at the back).
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.36, 16), ceramic).translateY(0.18));
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), ceramic);
  bowl.scale.set(0.9, 0.35, 1.15);
  bowl.position.set(0, 0.36, 0.05);
  bowl.rotation.x = Math.PI;
  group.add(bowl);
  const seat = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 24), ceramic);
  seat.scale.set(1, 1.25, 1);
  seat.rotation.x = Math.PI / 2;
  seat.position.set(0, 0.42, 0.06);
  group.add(seat);
  const lid = box(0.32, 0.4, 0.025, ceramic, 0, 0.62, -0.16);
  lid.rotation.x = -0.15;
  group.add(lid);
  group.add(box(0.42, 0.38, 0.18, ceramic, 0, 0.64, -0.27));
  group.add(box(0.06, 0.02, 0.06, std(0xd4d4d8, 0.2, 0.9), 0, 0.84, -0.27));
  return group;
}

function createSquatToilet() {
  const group = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.05 });
  group.add(box(0.5, 0.06, 0.7, ceramic, 0, 0.03, 0));
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), std(0x1f2937, 0.3));
  hole.scale.set(1, 1.6, 1);
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(0, 0.062, 0.05);
  group.add(hole);
  [-0.17, 0.17].forEach((x) => group.add(box(0.1, 0.02, 0.24, std(0xe2e8f0, 0.6), x, 0.07, -0.12))); // footrests
  return group;
}

function createUrinal() {
  const group = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.05, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.6, 16, 1, true, -Math.PI / 2, Math.PI), ceramic);
  body.position.set(0, 0.85, 0.02);
  group.add(body);
  group.add(box(0.3, 0.05, 0.25, ceramic, 0, 0.56, 0.1));
  group.add(box(0.03, 0.3, 0.03, std(0xd4d4d8, 0.2, 0.9), 0, 1.3, 0.02));
  return group;
}

/**
 * The WC block in the back-left corner (local frame of the house): a lobby with a
 * sink and mirror, then two cubicles (NAM / NỮ) with doors that swing inward.
 */
function createRestroom(tile: THREE.Material) {
  const group = new THREE.Group();
  group.name = 'Restroom';
  const colliders: Collider[] = [];
  const T = 0.1; // wall thickness
  const left = -INNER;
  const right = WC_RIGHT;
  const z0 = WC_FRONT;
  const z1 = WC_FRONT + 2.0; // cubicle front wall
  const z2 = HOUSE_DEPTH; // back wall
  const mid = (left + right) / 2; // divider between the cubicles
  const wall = (x0: number, x1: number, za: number, zb: number, y0 = 0, y1 = CEILING) => {
    const w = Math.max(x1 - x0, T);
    const d = Math.max(zb - za, T);
    group.add(box(w, y1 - y0, d, tile, (x0 + x1) / 2, (y0 + y1) / 2, (za + zb) / 2));
    if (y0 === 0) colliders.push({ kind: 'box', x: (x0 + x1) / 2, z: (za + zb) / 2, hw: w / 2, hd: d / 2, yaw: 0 });
  };

  // Floor: small grey-green anti-slip tiles.
  const floorTex = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#94a3b8' : '#a3b1c2';
      ctx.fillRect(x * 16 + 1, y * 16 + 1, 14, 14);
    }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set((right - left) / 1.2, (z2 - z0) / 1.2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(right - left, z2 - z0), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.3 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((left + right) / 2, 0.01, (z0 + z2) / 2);
  group.add(floor);

  // Lobby front wall with a doorway, the partition to the kitchen.
  const lobbyDoor = [left + 1.2, left + 2.2];
  wall(left, lobbyDoor[0], z0 - T / 2, z0 + T / 2);
  wall(lobbyDoor[1], right, z0 - T / 2, z0 + T / 2);
  wall(lobbyDoor[0], lobbyDoor[1], z0 - T / 2, z0 + T / 2, 2.2, CEILING);
  wall(right - T / 2, right + T / 2, z0, z2);
  const wcSign = canvasTexture(256, 96, (ctx) => {
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WC ➜', 128, 50);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Nhà vệ sinh', 128, 82);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.26), new THREE.MeshStandardMaterial({ map: wcSign, emissiveMap: wcSign, emissive: 0xffffff, emissiveIntensity: 0.5 }));
  sign.rotation.y = Math.PI;
  sign.position.set((lobbyDoor[0] + lobbyDoor[1]) / 2, 2.5, z0 - T / 2 - 0.01);
  group.add(sign);

  // Lobby: wall-hung basin with mirror, soap and a small bin.
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.05, side: THREE.DoubleSide });
  const basinZ = z0 + 1.0;
  const basin = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), ceramic);
  basin.scale.set(0.8, 0.45, 1);
  basin.position.set(left + 0.25, 0.85, basinZ);
  group.add(basin);
  group.add(box(0.06, 0.25, 0.06, std(0xd4d4d8, 0.2, 0.9), left + 0.05, 1.0, basinZ));
  group.add(box(0.14, 0.03, 0.03, std(0xd4d4d8, 0.2, 0.9), left + 0.12, 1.12, basinZ));
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 10), std(0x22c55e, 0.3)).translateX(left + 0.08).translateY(0.92).translateZ(basinZ + 0.24));
  const mirror = box(0.02, 0.8, 0.6, new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.02, metalness: 1 }), left + 0.02, 1.65, basinZ);
  group.add(mirror);
  group.add(box(0.03, 0.86, 0.66, std(0x334155, 0.5), left + 0.01, 1.65, basinZ));
  colliders.push({ kind: 'box', x: left + 0.22, z: basinZ, hw: 0.22, hd: 0.25, yaw: 0 });
  // Mop bucket in the corner.
  group.add(createBucketAndDipper(0x16a34a).translateX(right - 0.3).translateZ(z0 + 0.35));
  group.add(box(0.03, 1.3, 0.03, std(0x92400e, 0.6), right - 0.25, 0.75, z0 + 0.3));
  colliders.push({ kind: 'circle', x: right - 0.3, z: z0 + 0.35, r: 0.18 });

  // Cubicle front wall (two door gaps) and the divider.
  const doorW = 0.8;
  const namX = (left + mid) / 2; // cubicle centres
  const nuX = (mid + right) / 2;
  const namDoor = [namX - doorW / 2, namX + doorW / 2];
  const nuDoor = [nuX - doorW / 2, nuX + doorW / 2];
  wall(left, namDoor[0], z1 - T / 2, z1 + T / 2);
  wall(namDoor[1], nuDoor[0], z1 - T / 2, z1 + T / 2);
  wall(nuDoor[1], right, z1 - T / 2, z1 + T / 2);
  wall(namDoor[0], namDoor[1], z1 - T / 2, z1 + T / 2, 2.1, CEILING);
  wall(nuDoor[0], nuDoor[1], z1 - T / 2, z1 + T / 2, 2.1, CEILING);
  wall(mid - T / 2, mid + T / 2, z1, z2);

  const doors = [
    createSwingDoor(namDoor[0], z1, doorW, 1, 0x1d4ed8, doorSign('NAM', '#1d4ed8')),
    createSwingDoor(nuDoor[1], z1, doorW, -1, 0xdb2777, doorSign('NỮ', '#db2777')),
  ];

  // NAM: squat toilet, urinal, bucket and dipper, a tap.
  group.add(createSquatToilet().translateX(namX).translateZ(z2 - 0.75));
  colliders.push({ kind: 'box', x: namX, z: z2 - 0.75, hw: 0.25, hd: 0.35, yaw: 0 });
  const urinal = createUrinal();
  urinal.rotation.y = Math.PI / 2;
  urinal.position.set(left, 0, z1 + 0.8);
  group.add(urinal);
  colliders.push({ kind: 'circle', x: left + 0.15, z: z1 + 0.8, r: 0.18 });
  group.add(createBucketAndDipper(0x2563eb).translateX(mid - 0.3).translateZ(z2 - 0.3));
  colliders.push({ kind: 'circle', x: mid - 0.3, z: z2 - 0.3, r: 0.17 });
  group.add(box(0.12, 0.03, 0.03, std(0xd4d4d8, 0.2, 0.9), mid - 0.3, 0.7, z2 - 0.05));

  // NỮ: sitting toilet facing the door, paper roll, bidet hose, bucket and dipper.
  const toilet = createSittingToilet();
  toilet.rotation.y = Math.PI; // faces the door, cistern against the back wall
  toilet.position.set(nuX, 0, z2 - 0.45);
  group.add(toilet);
  colliders.push({ kind: 'box', x: nuX, z: z2 - 0.4, hw: 0.24, hd: 0.36, yaw: 0 });
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 14), std(0xffffff, 0.9));
  roll.rotation.z = Math.PI / 2;
  roll.position.set(right - 0.12, 0.72, z2 - 0.75);
  group.add(roll);
  group.add(box(0.03, 0.03, 0.14, std(0xd4d4d8, 0.2, 0.9), right - 0.08, 0.72, z2 - 0.75));
  group.add(box(0.04, 0.12, 0.04, std(0xe5e7eb, 0.2, 0.8), right - 0.06, 0.6, z2 - 0.35)); // bidet hose holder
  group.add(box(0.015, 0.45, 0.015, std(0x9ca3af, 0.3, 0.8), right - 0.06, 0.32, z2 - 0.35)); // hose
  group.add(createBucketAndDipper(0xdc2626).translateX(mid + 0.3).translateZ(z2 - 0.3));
  colliders.push({ kind: 'circle', x: mid + 0.3, z: z2 - 0.3, r: 0.17 });

  // Tiles on the house's back wall inside the cubicles.
  const backTiles = new THREE.Mesh(new THREE.PlaneGeometry(right - left, 2.2), tile);
  backTiles.rotation.y = Math.PI;
  backTiles.position.set((left + right) / 2, 1.1, z2 - 0.005);
  group.add(backTiles);
  // A dim tube light in each cubicle and the lobby.
  [namX, nuX, (left + right) / 2].forEach((x, i) => {
    const tube = createTubeLight(0.6);
    tube.position.set(x, CEILING - 0.05, i < 2 ? z2 - 1.2 : z0 + 1.0);
    group.add(tube);
  });

  return { group, colliders, doors };
}

// ---------- assembly ----------

export function createQuanOcHouse(options: { originX: number; front: number }): QuanOcHouse {
  const { originX, front } = options;
  const back = front + HOUSE_DEPTH;
  const house = new THREE.Group();
  house.name = 'QuanOcHouse';
  const statics = new THREE.Group(); // merged at the end
  const updates: ((time: number, delta: number, focus?: THREE.Vector3) => void)[] = [];
  const colliders: Collider[] = [];
  const seats: Seat[] = [];
  /** Local (x, z) → world. */
  const at = (x: number, z: number) => new THREE.Vector3(originX + x, 0, z);

  const paint = std(0xd9c9a6, 0.85);
  const outer = std(0xcdbb94, 0.85);

  // ---- Floor, walls, ceiling ----
  const floorTex = floorTiles();
  floorTex.repeat.set((INNER * 2) / 2, HOUSE_DEPTH / 2);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(INNER * 2, HOUSE_DEPTH),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.25, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(originX, 0.006, front + HOUSE_DEPTH / 2);
  floor.receiveShadow = true;
  house.add(floor);

  // Side and back walls (outer colour outside, painted plaster inside).
  [-1, 1].forEach((side) => {
    statics.add(box(WALL, CEILING, HOUSE_DEPTH, paint, originX + side * (INNER + WALL / 2), CEILING / 2, front + HOUSE_DEPTH / 2));
  });
  statics.add(box(INNER * 2 + WALL * 2, CEILING, WALL, paint, originX, CEILING / 2, back + WALL / 2));
  // Tiled dado on the inside of the walls.
  const dadoTex = wallTiles();
  dadoTex.repeat.set(HOUSE_DEPTH / 1.2, 1.4 / 1.2);
  const dado = new THREE.MeshStandardMaterial({ map: dadoTex, roughness: 0.2, metalness: 0.05 });
  [-1, 1].forEach((side) => {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(HOUSE_DEPTH, 1.4), dado);
    plane.rotation.y = -side * (Math.PI / 2);
    plane.position.set(originX + side * (INNER - 0.005), 0.7, front + HOUSE_DEPTH / 2);
    statics.add(plane);
  });

  // Upper floors: one block whose underside is the ceiling and whose front is the facade.
  const facade = upperFacade();
  const ceilingMaterial = std(0xf8fafc, 0.9);
  const upperMaterials = [outer, outer, outer, ceilingMaterial, outer, new THREE.MeshStandardMaterial({ map: facade, roughness: 0.85, emissiveMap: facade, emissive: 0xffffff, emissiveIntensity: 0.25 })];
  const upperHeight = 7.4;
  const upper = new THREE.Mesh(new THREE.BoxGeometry(HOUSE_WIDTH + 0.2, upperHeight, HOUSE_DEPTH + WALL), upperMaterials);
  upper.position.set(originX, CEILING + upperHeight / 2, front + (HOUSE_DEPTH + WALL) / 2);
  house.add(upper);
  // Roof parapet.
  statics.add(box(HOUSE_WIDTH + 0.3, 0.5, 0.25, outer, originX, CEILING + upperHeight + 0.25, front + 0.1));

  // ---- Shopfront: pillars, lintel, rolled-up shutter, signboard ----
  [-1, 1].forEach((side) => statics.add(box(0.32, CEILING, 0.34, outer, originX + side * (HOUSE_WIDTH / 2), CEILING / 2, front + 0.15)));
  statics.add(box(HOUSE_WIDTH + 0.3, 0.4, 0.34, outer, originX, CEILING - 0.2, front + 0.15));
  statics.add(box(INNER * 2, 0.26, 0.26, std(0x9ca3af, 0.4, 0.7), originX, CEILING - 0.53, front + 0.2));
  const sign = signboard();
  statics.add(
    box(HOUSE_WIDTH - 0.2, 1.0, 0.14, new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: 0xffffff, emissiveIntensity: 1.5 }), originX, CEILING + 0.6, front - 0.1)
  );
  // Fluorescent strip under the signboard washing the pavement.
  statics.add(box(HOUSE_WIDTH - 0.6, 0.04, 0.04, glow(0xf0f9ff, 5), originX, CEILING + 0.06, front - 0.15));

  // ---- Lights: a tube over every table, low point lights for the room ----
  const ceilingY = CEILING - 0.05;
  TABLE_SPOTS.forEach(([x, z]) => {
    const tube = createTubeLight(1.2);
    tube.position.set(originX + x, ceilingY, front + z);
    tube.rotation.y = Math.PI / 2;
    statics.add(tube);
  });
  // Kept low: white walls blow out into bloom (and SSGI bounce) quickly.
  [
    [0, 4.4, 3.4],
    [0, 8.6, 3.2],
    [1.8, 14.0, 2.2], // kitchen
    [-4.0, 12.6, 1.4], // WC lobby
  ].forEach(([x, z, intensity]) => {
    const light = new THREE.PointLight(0xfff4e0, intensity, 10, 2);
    light.position.set(originX + x, CEILING - 0.4, front + z);
    house.add(light);
  });

  // ---- Ceiling fans over the aisles, a wall fan by the tables ----
  [
    [-1.8, 4.4],
    [1.8, 4.4],
    [-1.8, 8.4],
    [1.8, 8.4],
  ].forEach(([x, z], i) => {
    const fan = createCeilingFan();
    fan.group.position.set(originX + x, CEILING, front + z);
    house.add(fan.group);
    updates.push((_, delta) => (fan.blades.rotation.y += delta * (6 + i)));
  });
  const wallFan = createWallFan();
  wallFan.group.position.set(originX + INNER, 2.6, front + 4.4);
  wallFan.group.rotation.y = -Math.PI / 2;
  house.add(wallFan.group);
  updates.push((time, delta) => {
    wallFan.blades.rotation.z += delta * 20;
    wallFan.group.rotation.y = -Math.PI / 2 + Math.sin(time * 0.6) * 0.5; // oscillating
  });

  // ---- Dining room: 3 × 2 tables with aisles at x = ±1.8 ----
  const DISHES = [
    ['oc_huong', 'xoai_non'],
    ['chicken_feet', 'peanut'],
    ['ca_vien', 'oc_huong'],
    ['oc_huong', 'peanut'],
    ['xoai_non', 'ca_vien', 'oc_huong'],
    ['chicken_feet', 'oc_huong'],
  ];
  TABLE_SPOTS.forEach(([x, z], index) => {
    const table = createIndoorTable(300 + index * 11, DISHES[index], index % 2 === 0);
    const center = at(x, front + z);
    table.group.position.copy(center);
    statics.add(table.group);
    colliders.push({ kind: 'circle', x: center.x, z: center.z, r: 0.92 });
    table.stoolPositions.forEach((p) => {
      seats.push({ x: center.x + p.x, z: center.z + p.z, facing: Math.atan2(-p.x, -p.z), table: 100 + index });
    });
  });

  // ---- Front left: Thần Tài shrine (facing the street) and the seafood tanks ----
  const shrine = createShrine();
  shrine.position.copy(at(-INNER + 0.35, front + 0.45));
  shrine.rotation.y = Math.PI;
  statics.add(shrine);
  colliders.push({ kind: 'circle', x: originX - INNER + 0.35, z: front + 0.45, r: 0.35 });
  const tanks = createSeafoodTanks();
  tanks.group.position.copy(at(-INNER + 0.32, front + 2.0));
  tanks.group.rotation.y = Math.PI / 2;
  house.add(tanks.group);
  updates.push(tanks.update);
  colliders.push({ kind: 'box', x: originX - INNER + 0.32, z: front + 2.0, hw: 0.8, hd: 0.34, yaw: Math.PI / 2 });

  // ---- Front right: the cashier area ----
  const cashier = createCashierArea();
  cashier.group.position.set(originX + CASHIER_X, 0, front);
  statics.add(cashier.group);
  cashier.colliders.forEach((c) => colliders.push({ ...c, x: c.x + originX + CASHIER_X, z: c.z + front }));

  // ---- Walls: menu, posters, calendar, TV ----
  const leftWall = (object: THREE.Object3D, z: number, y: number) => {
    object.position.set(originX - INNER + 0.02, y, front + z);
    object.rotation.y = Math.PI / 2;
    statics.add(object);
  };
  const rightWall = (object: THREE.Object3D, z: number, y: number) => {
    object.position.set(originX + INNER - 0.02, y, front + z);
    object.rotation.y = -Math.PI / 2;
    statics.add(object);
  };
  leftWall(picture(menuBoard(), 2.4, 1.35, 0.35), 6.4, 2.3);
  leftWall(picture(beerPoster(), 0.6, 0.85), 4.0, 2.1);
  leftWall(picture(calendar(), 0.42, 0.6), 9.6, 2.0);
  rightWall(picture(beerPoster(), 0.6, 0.85), 9.6, 2.1);
  const tv = createFootballTv();
  tv.group.children.slice(0, 2).forEach((stand) => stand.removeFromParent()); // wall-mounted
  tv.group.position.set(originX + INNER - 0.06, 0.75, front + 6.6);
  tv.group.rotation.y = -Math.PI / 2;
  house.add(tv.group);
  updates.push(tv.update);
  const stools = createStoolStack(0x0284c7, 6);
  stools.position.copy(at(INNER - 0.4, front + 11.0));
  statics.add(stools);
  colliders.push({ kind: 'circle', x: originX + INNER - 0.4, z: front + 11.0, r: 0.32 });

  // ---- Back right: fridge and freezer in front of the kitchen half wall ----
  const fridge = createDrinksFridge();
  fridge.position.copy(at(-1.2, front + 11.6));
  fridge.rotation.y = Math.PI;
  statics.add(fridge);
  colliders.push({ kind: 'box', x: originX - 1.2, z: front + 11.6, hw: 0.42, hd: 0.36, yaw: 0 });
  const freezer = createChestFreezer();
  freezer.position.copy(at(3.6, front + 11.65));
  freezer.rotation.y = Math.PI;
  statics.add(freezer);
  colliders.push({ kind: 'box', x: originX + 3.6, z: front + 11.65, hw: 0.66, hd: 0.37, yaw: 0 });

  // ---- Kitchen (x from WC_RIGHT to the right wall) behind a half wall ----
  const kitchenLeft = WC_RIGHT;
  const kitchenCenter = (kitchenLeft + INNER) / 2;
  const kitchenZ = front + KITCHEN_Z;
  const doorL = 0.3;
  const doorR = 1.3; // kitchen door gap (local x)
  [
    [kitchenLeft, doorL],
    [doorR, INNER],
  ].forEach(([x0, x1]) => {
    const w = x1 - x0;
    const cx = originX + (x0 + x1) / 2;
    statics.add(box(w, 1.1, 0.15, dado, cx, 0.55, kitchenZ));
    statics.add(box(w + 0.04, 0.05, 0.3, std(0xe7e5e4, 0.3, 0.1), cx, 1.125, kitchenZ));
    colliders.push({ kind: 'box', x: cx, z: kitchenZ, hw: w / 2, hd: 0.1, yaw: 0 });
  });
  statics.add(
    box(INNER - kitchenLeft, CEILING - 2.25, 0.15, paint, originX + kitchenCenter, 2.25 + (CEILING - 2.25) / 2, kitchenZ)
  );
  const clock = picture(clockFace(), 0.36, 0.36, 0.2);
  clock.position.set(originX + 3.6, 2.95, kitchenZ - 0.09);
  clock.rotation.y = Math.PI;
  statics.add(clock);
  const altar = new THREE.Group();
  altar.add(box(0.9, 0.05, 0.3, std(0x7f1d1d, 0.5), 0, 0, 0.15));
  altar.add(box(0.9, 0.5, 0.04, std(0x991b1b, 0.5), 0, 0.27, 0.02));
  altar.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 12), std(0xb45309, 0.4, 0.6)).translateY(0.065).translateZ(0.16));
  [-0.32, 0.32].forEach((x) => altar.add(box(0.06, 0.14, 0.06, glow(0xff2a1a, 5), x, 0.1, 0.16)));
  altar.position.set(originX + 0.8, 2.75, kitchenZ - 0.08);
  altar.rotation.y = Math.PI;
  statics.add(altar);
  const kitchen = createKitchen();
  kitchen.group.position.set(originX + kitchenCenter, 0, back);
  statics.add(kitchen.group);
  kitchen.flames.position.copy(kitchen.group.position);
  house.add(kitchen.flames);
  updates.push(kitchen.update);
  colliders.push({ kind: 'box', x: originX + kitchenCenter, z: back - 0.38, hw: 3.65, hd: 0.4, yaw: 0 });
  colliders.push({ kind: 'circle', x: originX + kitchenCenter - 3.2, z: back - 0.95, r: 0.2 });
  colliders.push({ kind: 'circle', x: originX + kitchenCenter + 3.0, z: back - 1.2, r: 0.45 });
  const kitchenLight = createTubeLight(1.2);
  kitchenLight.position.set(originX + kitchenCenter, ceilingY, back - 1.2);
  statics.add(kitchenLight);

  // ---- Back left: the WC ----
  // WC walls get their own tiling (the dado's repeat is set for the long side walls).
  const wcTiles = wallTiles();
  wcTiles.repeat.set(2, 3);
  const wc = createRestroom(new THREE.MeshStandardMaterial({ map: wcTiles, roughness: 0.2, metalness: 0.05 }));
  wc.group.position.set(originX, 0, front);
  statics.add(wc.group);
  wc.doors.forEach((door) => {
    door.pivot.position.add(new THREE.Vector3(originX, 0, front));
    house.add(door.pivot);
  });
  wc.colliders.forEach((c) => colliders.push({ ...c, x: c.x + originX, z: c.z + front }));
  const doorCenter = new THREE.Vector3();
  updates.push((_, delta, focus) => {
    wc.doors.forEach((door) => {
      door.pivot.localToWorld(doorCenter.set(door.width / 2 * door.hingeSide, 1, 0));
      const near = !!focus && Math.hypot(focus.x - doorCenter.x, focus.z - doorCenter.z) < 1.4;
      door.angle = THREE.MathUtils.damp(door.angle, near ? 1.45 : 0, 6, delta);
      door.leaf.rotation.y = door.angle * door.swing;
    });
  });

  house.add(mergeStatic(statics));

  return {
    group: house,
    colliders,
    seats,
    interior: new THREE.Box3(
      new THREE.Vector3(originX - INNER + 0.15, 0.4, front - 0.2),
      new THREE.Vector3(originX + INNER - 0.15, CEILING - 0.2, back - 0.15)
    ),
    tight: new THREE.Box3(
      new THREE.Vector3(originX - INNER, 0, front + WC_FRONT),
      new THREE.Vector3(originX + WC_RIGHT, CEILING, back)
    ),
    staff: {
      cook: { x: originX + kitchenCenter - 1.25, z: back - 1.1, facing: 0 },
      cashier: { x: originX + CASHIER_X + cashier.stand.x, z: front + cashier.stand.z, facing: -Math.PI / 2 },
    },
    route: [
      { x: originX + 1.8, z: front + 1.0, pause: 0 },
      { x: originX + 1.8, z: front + 4.4, pause: 2 },
      { x: originX + 1.8, z: front + 8.4, pause: 2 },
      { x: originX + 0.8, z: front + 10.6, pause: 2.5 }, // at the kitchen door
      { x: originX - 1.8, z: front + 8.4, pause: 2 },
      { x: originX - 1.8, z: front + 4.4, pause: 0 },
      { x: originX - 0.2, z: front + 1.0, pause: 0 },
    ],
    update: (time, delta, focus) => updates.forEach((update) => update(time, delta, focus)),
  };
}
