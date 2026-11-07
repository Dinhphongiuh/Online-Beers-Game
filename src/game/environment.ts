import * as THREE from 'three';

/**
 * Night-time Saigon street backdrop around the sidewalk pub:
 * sky dome with city glow, rows of "nhà ống" shophouses with lit windows,
 * asphalt road, an electric pole with tangled cables and sodium street lamps.
 */
export interface StreetBackdrop {
  group: THREE.Group;
  update: (time: number) => void;
}

// Deterministic RNG so the street looks the same on every load
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WALL_COLORS = ['#f2c14e', '#e9a178', '#9fd3c7', '#f4e1c1', '#e8a0bf', '#b5c99a', '#d4a373', '#a5b4fc', '#f5f5f4'];
const SHOP_SIGNS: { text: string; bg: string; fg: string }[] = [
  { text: 'PHỞ 24H', bg: '#b91c1c', fg: '#fde68a' },
  { text: 'TẠP HÓA', bg: '#1d4ed8', fg: '#ffffff' },
  { text: 'KARAOKE', bg: '#7e22ce', fg: '#f9a8d4' },
  { text: 'CƠM TẤM', bg: '#c2410c', fg: '#fff7ed' },
  { text: 'SỬA XE', bg: '#15803d', fg: '#fef08a' },
  { text: 'TRÀ SỮA', bg: '#be185d', fg: '#ffffff' },
  { text: 'ỐC ĐÊM', bg: '#0e7490', fg: '#cffafe' },
  { text: 'BIA HƠI', bg: '#a16207', fg: '#fefce8' },
];

const FLOOR_H = 3;

interface FacadeTextures {
  map: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture;
}

/** Paints a shophouse front: windows per floor (some lit), a roller shutter or open shop at street level. */
function paintFacade(w: number, h: number, rand: () => number, wall: string): FacadeTextures {
  const W = 256;
  const H = Math.round((W * h) / w);
  const base = document.createElement('canvas');
  base.width = W;
  base.height = H;
  const glow = document.createElement('canvas');
  glow.width = W;
  glow.height = H;
  const c = base.getContext('2d')!;
  const g = glow.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);

  // Weathered wall
  c.fillStyle = wall;
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    c.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.06})`;
    c.fillRect(rand() * W, rand() * H, 4 + rand() * 30, 10 + rand() * 60);
  }

  const pxPerUnit = H / h;
  const floors = Math.floor(h / FLOOR_H);
  const floorPx = FLOOR_H * pxPerUnit;

  for (let f = 0; f < floors; f++) {
    const top = H - (f + 1) * floorPx;
    if (f === 0) {
      // Street level: open lit shop or pulled-down roller shutter
      const open = rand() < 0.6;
      const sx = W * 0.08;
      const sw = W * 0.84;
      const sy = top + floorPx * 0.28;
      const sh = floorPx * 0.72;
      if (open) {
        const warm = rand() < 0.7;
        c.fillStyle = warm ? '#fde68a' : '#e0f2fe';
        c.fillRect(sx, sy, sw, sh);
        g.fillStyle = warm ? '#fbbf24' : '#bae6fd';
        g.fillRect(sx, sy, sw, sh);
        // Shelves / silhouettes inside the shop
        c.fillStyle = 'rgba(68,64,60,0.55)';
        for (let k = 0; k < 4; k++) c.fillRect(sx + 6, sy + 10 + k * (sh / 4.5), sw - 12, 4);
        g.fillStyle = 'rgba(0,0,0,0.5)';
        for (let k = 0; k < 4; k++) g.fillRect(sx + 6, sy + 10 + k * (sh / 4.5), sw - 12, 4);
      } else {
        c.fillStyle = '#9ca3af';
        c.fillRect(sx, sy, sw, sh);
        c.fillStyle = 'rgba(55,65,81,0.6)';
        for (let y = sy; y < sy + sh; y += 6) c.fillRect(sx, y, sw, 2);
      }
    } else {
      // Upper floors: 2 windows with shutters / grilles
      const count = rand() < 0.3 ? 1 : 2;
      for (let k = 0; k < count; k++) {
        const ww = count === 1 ? W * 0.5 : W * 0.32;
        const wx = count === 1 ? W * 0.25 : W * (0.1 + k * 0.48);
        const wy = top + floorPx * 0.22;
        const wh = floorPx * 0.5;
        const lit = rand();
        const color = lit < 0.45 ? '#fde68a' : lit < 0.55 ? '#93c5fd' : '#1f2937';
        c.fillStyle = '#44403c';
        c.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
        c.fillStyle = color;
        c.fillRect(wx, wy, ww, wh);
        if (lit < 0.55) {
          g.fillStyle = lit < 0.45 ? '#f59e0b' : '#60a5fa';
          g.fillRect(wx, wy, ww, wh);
        }
        // Window grille
        c.fillStyle = 'rgba(28,25,23,0.7)';
        for (let x = wx; x < wx + ww; x += 9) c.fillRect(x, wy, 2, wh);
        g.fillStyle = 'rgba(0,0,0,0.7)';
        for (let x = wx; x < wx + ww; x += 9) g.fillRect(x, wy, 2, wh);
      }
    }
    // Floor slab line
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(0, top + floorPx - 3, W, 3);
  }

  const map = new THREE.CanvasTexture(base);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissive = new THREE.CanvasTexture(glow);
  emissive.colorSpace = THREE.SRGBColorSpace;
  return { map, emissive };
}

function makeSignTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = fg;
  ctx.font = 'bold 34px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const sharedMats = {
  concrete: new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 }),
  railing: new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.6, metalness: 0.4 }),
  acUnit: new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.5 }),
  steelTank: new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.25, metalness: 0.85 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 }),
};

interface Shophouse {
  group: THREE.Group;
  signs: THREE.MeshStandardMaterial[];
}

/** One narrow tube house ("nhà ống"); its front faces +z with the front plane at local z = 0. */
function createShophouse(w: number, h: number, rand: () => number): Shophouse {
  const group = new THREE.Group();
  const depth = 5;
  const wall = WALL_COLORS[Math.floor(rand() * WALL_COLORS.length)];
  const { map, emissive } = paintFacade(w, h, rand, wall);

  const sideMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(wall).multiplyScalar(0.55), roughness: 0.95 });
  const frontMat = new THREE.MeshStandardMaterial({
    map,
    emissiveMap: emissive,
    emissive: 0xffffff,
    emissiveIntensity: 1.4, // lit but below the bloom threshold: big shopfronts would wash out
    roughness: 0.9,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), [
    sideMat,
    sideMat,
    sharedMats.roof,
    sideMat,
    frontMat,
    sideMat,
  ]);
  body.position.set(0, h / 2, -depth / 2);
  group.add(body);

  const floors = Math.floor(h / FLOOR_H);
  for (let f = 1; f < floors; f++) {
    const y = f * FLOOR_H;
    // Balcony slab + railing
    if (rand() < 0.75) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.12, 0.7), sharedMats.concrete);
      slab.position.set(0, y, 0.35);
      group.add(slab);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.9, 0.04), sharedMats.railing);
      rail.position.set(0, y + 0.5, 0.68);
      group.add(rail);
      // Potted plants on some balconies
      if (rand() < 0.5) {
        const plant = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 })
        );
        plant.position.set((rand() - 0.5) * w * 0.7, y + 0.35, 0.4);
        group.add(plant);
      }
    }
    // Air-conditioner outdoor unit
    if (rand() < 0.55) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.3), sharedMats.acUnit);
      ac.position.set((rand() < 0.5 ? -1 : 1) * (w / 2 - 0.5), y + 1.9, 0.16);
      group.add(ac);
    }
  }

  // Stainless rooftop water tank (bồn nước inox)
  if (rand() < 0.65) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 14), sharedMats.steelTank);
    tank.rotation.z = Math.PI / 2;
    tank.position.set((rand() - 0.5) * (w - 1.2), h + 0.6, -1.5);
    group.add(tank);
  }

  // Shop signboard above street level
  const signs: THREE.MeshStandardMaterial[] = [];
  if (rand() < 0.7) {
    const s = SHOP_SIGNS[Math.floor(rand() * SHOP_SIGNS.length)];
    const tex = makeSignTexture(s.text, s.bg, s.fg);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 3.4,
      roughness: 0.5,
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.85, 3.2), 0.65, 0.08), mat);
    board.position.set(0, FLOOR_H * 0.92, 0.1);
    group.add(board);
    signs.push(mat);
  }

  return { group, signs };
}

/** A sagging cable between two points (catenary-ish). */
function cable(a: THREE.Vector3, b: THREE.Vector3, sag: number, mat: THREE.LineBasicMaterial) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
}

function createElectricPole(): { group: THREE.Group; top: THREE.Vector3 } {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 8.5, 10), sharedMats.concrete);
  pole.position.y = 4.25;
  group.add(pole);
  [7.6, 6.9].forEach((y, i) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(i === 0 ? 1.8 : 1.3, 0.1, 0.1), sharedMats.railing);
    arm.position.y = y;
    group.add(arm);
  });
  const transformer = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12), sharedMats.concrete);
  transformer.position.set(0.38, 6.0, 0);
  group.add(transformer);
  // The infamous tangle of telecom cables wrapped around the pole
  const tangle = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.28, 0.05, 48, 6, 2, 5),
    new THREE.MeshStandardMaterial({ color: 0x0c0a09, roughness: 0.8 })
  );
  tangle.position.y = 5.2;
  tangle.scale.set(1, 1.6, 1);
  group.add(tangle);
  return { group, top: new THREE.Vector3(0, 7.55, 0) };
}

function createStreetLamp(lampLight: THREE.PointLight): THREE.Group {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 6, 10), sharedMats.railing);
  pole.position.y = 3;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.6), sharedMats.railing);
  arm.position.set(0, 5.95, 0.8);
  group.add(arm);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.12, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xffb347, emissiveIntensity: 9 })
  );
  head.position.set(0, 5.88, 1.5);
  group.add(head);
  lampLight.position.set(0, 5.6, 1.5);
  group.add(lampLight);
  return group;
}

export function createStreetBackdrop(): StreetBackdrop {
  const group = new THREE.Group();
  const rand = mulberry32(20261105);

  // ---- Sky dome with warm city glow at the horizon ----
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x070b1f) },
      midColor: { value: new THREE.Color(0x1e1b4b) },
      horizonColor: { value: new THREE.Color(0x7c2d12) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      varying vec3 vPos;
      void main() {
        float h = clamp(vPos.y, -0.1, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(-0.02, 0.22, h));
        col = mix(col, topColor, smoothstep(0.2, 0.75, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), skyMat);
  sky.renderOrder = -10;
  group.add(sky);

  const starPos: number[] = [];
  for (let i = 0; i < 260; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = 0.15 + rand() * 1.1;
    starPos.push(
      Math.cos(theta) * Math.cos(phi) * 85,
      Math.sin(phi) * 85,
      Math.sin(theta) * Math.cos(phi) * 85
    );
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.85 })
  );
  group.add(stars);

  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff7d6, fog: false })
  );
  moon.position.set(-18, 24, -42);
  moon.lookAt(0, 2, 0);
  group.add(moon);

  // ---- Shophouse rows ----
  const signMats: THREE.MeshStandardMaterial[] = [];
  const buildRow = (
    fromX: number,
    toX: number,
    place: (house: THREE.Group, centerAlong: number) => void
  ) => {
    let x = fromX;
    while (x < toX) {
      const w = 3.2 + rand() * 1.5;
      const floors = 2 + Math.floor(rand() * 3);
      const h = floors * FLOOR_H + 0.4 + rand() * 0.8;
      const house = createShophouse(w, h, rand);
      place(house.group, x + w / 2);
      signMats.push(...house.signs);
      group.add(house.group);
      x += w + 0.05;
    }
  };
  // Back row behind the pub's neon sign
  buildRow(-17, 17, (house, cx) => house.position.set(cx, 0, -5.6));
  // Side rows running toward the street
  buildRow(-4.6, 4.6, (house, cz) => {
    house.position.set(-9.2, 0, cz);
    house.rotation.y = Math.PI / 2;
  });
  buildRow(-4.6, 4.6, (house, cz) => {
    house.position.set(9.2, 0, -cz);
    house.rotation.y = -Math.PI / 2;
  });

  // ---- Asphalt road beyond the yellow curb ----
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 10),
    new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.006, 10);
  road.receiveShadow = true;
  group.add(road);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xe7e5e4 });
  for (let x = -28; x <= 28; x += 3) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.12), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.01, 10);
    group.add(dash);
  }

  // ---- Electric poles with sagging cables to the houses ----
  const cableMat = new THREE.LineBasicMaterial({ color: 0x0a0a0a });
  const poleL = createElectricPole();
  poleL.group.position.set(-6.4, 0, -4.3);
  group.add(poleL.group);
  const poleR = createElectricPole();
  poleR.group.position.set(6.6, 0, -4.3);
  group.add(poleR.group);
  const topL = poleL.top.clone().add(poleL.group.position);
  const topR = poleR.top.clone().add(poleR.group.position);
  for (let i = 0; i < 6; i++) {
    const off = new THREE.Vector3((rand() - 0.5) * 0.8, (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.3);
    group.add(cable(topL.clone().add(off), topR.clone().add(off.clone().multiplyScalar(-1)), 0.9 + rand() * 0.9, cableMat));
  }
  // Drops from the poles into the houses and across to the side rows
  [
    [topL, new THREE.Vector3(-3, 6.2, -5.6)],
    [topL, new THREE.Vector3(-9.2, 5.5, -2)],
    [topL, new THREE.Vector3(-12, 7, -5.6)],
    [topR, new THREE.Vector3(3.5, 6.4, -5.6)],
    [topR, new THREE.Vector3(9.2, 5.8, -1.5)],
    [topR, new THREE.Vector3(12, 6.8, -5.6)],
  ].forEach(([a, b]) => group.add(cable(a, b, 0.6 + rand() * 0.5, cableMat)));

  // ---- Sodium street lamps over the road ----
  [-7.5, 7.5].forEach((x) => {
    const light = new THREE.PointLight(0xffa94d, 9, 16, 2);
    const lamp = createStreetLamp(light);
    lamp.position.set(x, 0, 4.7);
    group.add(lamp);
  });

  let nextFlicker = 2;
  const update = (time: number) => {
    // A random shop sign sputters now and then
    if (time > nextFlicker && signMats.length > 0) {
      const mat = signMats[Math.floor(Math.random() * signMats.length)];
      mat.emissiveIntensity = 0.15;
      setTimeout(() => (mat.emissiveIntensity = 3.4), 90 + Math.random() * 160);
      nextFlicker = time + 1.5 + Math.random() * 3;
    }
  };

  return { group, update };
}
