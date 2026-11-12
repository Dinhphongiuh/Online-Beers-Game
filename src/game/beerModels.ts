/**
 * Photo-style 3D models of the beers in beerCatalog: a 330 ml can, a 330 ml long-neck
 * bottle and a bia hơi glass ("cốc vại"), built from lathe profiles at real size
 * (units = centimetres) with PBR materials:
 *  - cans: lacquered painted aluminium wrapped in a canvas-drawn label,
 *  - bottles: tinted transmissive glass over a darker beer core, paper label, foil neck,
 *    crown cap,
 *  - glass: clear recycled glass, transmissive amber beer, foam head, bubbles,
 *  - condensation droplets as a bump map on everything cold.
 *
 * The studio scene lights them with softbox strips (via a PMREM environment) so
 * cylinders pick up the long highlights seen in product photos. Labels are our own
 * layouts in each beer's colours, not the brands' logos.
 */
import * as THREE from 'three';
import type { Beer } from './beerCatalog';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- textures

function canvas(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return { canvas: c, ctx: c.getContext('2d')! };
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let condensationTexture: THREE.CanvasTexture | null = null;
/** White droplets on black: used as a bump map (raised beads) on cold surfaces. */
function condensation() {
  if (condensationTexture) return condensationTexture;
  const { canvas: c, ctx } = canvas(1024, 1024);
  const random = seeded(7);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 2600; i++) {
    const x = random() * 1024;
    const y = random() * 1024;
    const r = 1 + random() * random() * 9;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    if (random() < 0.06) {
      // A drop that has started to run.
      ctx.ellipse(x, y + r * 2, r * 0.8, r * 3, 0, 0, TAU);
    } else {
      ctx.ellipse(x, y, r, r * 1.1, 0, 0, TAU);
    }
    ctx.fill();
  }
  condensationTexture = new THREE.CanvasTexture(c);
  condensationTexture.wrapS = condensationTexture.wrapT = THREE.RepeatWrapping;
  return condensationTexture;
}

/** Brushed-aluminium base for silver cans. */
function brushed(ctx: CanvasRenderingContext2D, w: number, h: number, base: string) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const random = seeded(3);
  for (let i = 0; i < 1400; i++) {
    const y = random() * h;
    ctx.fillStyle = random() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, y, w, 1 + random() * 2);
  }
}

/** Generic star badge (our own mark). */
function medallion(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, ring: string) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = ring;
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.28 : r * 0.64;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = ring;
  ctx.fill();
}

/** Small print on the back of a label: ingredients lines and a barcode. */
function backPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.75;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ['Thành phần: nước, malt đại mạch,', 'gạo, hoa bia (houblon).', 'Bảo quản nơi khô mát.', 'Uống có trách nhiệm.'].forEach((line, i) =>
    ctx.fillText(line, x, y + i * 24)
  );
  ctx.globalAlpha = 1;
  const random = seeded(11);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y + 110, w * 0.7, 70);
  ctx.fillStyle = '#111';
  let bx = x + 6;
  while (bx < x + w * 0.7 - 8) {
    const bw = 1 + Math.floor(random() * 4);
    ctx.fillRect(bx, y + 116, bw, 50);
    bx += bw + 1 + Math.floor(random() * 3);
  }
}

function serifTitle(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, outline?: string) {
  ctx.font = `900 ${size}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (outline) {
    ctx.lineWidth = size * 0.08;
    ctx.strokeStyle = outline;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Full 360° wrap for a can body. Front of the can is the middle of the texture. */
function canLabel(beer: Beer) {
  const W = 2048;
  const H = 900;
  const { canvas: c, ctx } = canvas(W, H);
  const { body, accent, stripe, ink, label } = beer.art;
  const front = W / 2;
  if (beer.id === 'tiger_bac') {
    brushed(ctx, W, H, '#cfd4da');
  } else {
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, W, H);
    // Soft vertical sheen in the print itself.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,255,255,0.08)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // Band around the can with trim lines.
  const bandTop = H * 0.4;
  const bandH = H * 0.3;
  ctx.fillStyle = accent;
  ctx.fillRect(0, bandTop, W, bandH);
  ctx.fillStyle = stripe;
  ctx.fillRect(0, bandTop - 16, W, 10);
  ctx.fillRect(0, bandTop + bandH + 6, W, 10);
  // Front: badge, name, style. Repeated small on the opposite side.
  [front, 0, W].forEach((x, i) => {
    const scale = i === 0 ? 1 : 0.6;
    medallion(ctx, x, bandTop - 120 * scale, 70 * scale, accent, stripe);
    serifTitle(ctx, label[0], x, bandTop + bandH * 0.68, 190 * scale, ink, beer.id === 'tiger_bac' ? undefined : 'rgba(0,0,0,0.35)');
    ctx.font = `800 ${56 * scale}px sans-serif`;
    ctx.fillStyle = beer.id === 'tiger_bac' ? accent : stripe;
    ctx.textAlign = 'center';
    ctx.fillText(label[1].split('').join(' '), x, bandTop + bandH + 90 * scale);
  });
  // Side panels: volume / ABV, back panel with small print.
  ctx.font = '800 40px sans-serif';
  ctx.fillStyle = beer.id === 'tiger_bac' ? '#1e3a8a' : '#ffffff';
  ctx.fillText(`${beer.volumeMl} ml`, front - 520, H * 0.86);
  ctx.fillText(`${beer.abv}% ALC/VOL`, front + 520, H * 0.86);
  backPanel(ctx, W * 0.08, H * 0.78 - 110, 380, beer.id === 'tiger_bac' ? '#1f2937' : '#e5e7eb');
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** 270° paper label for a bottle body. */
function bottleLabel(beer: Beer) {
  const W = 2048;
  const H = 820;
  const { canvas: c, ctx } = canvas(W, H);
  const { accent, stripe, ink, label } = beer.art;
  const front = W / 2;
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, H);
  // Paper grain.
  const random = seeded(5);
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(${random() < 0.5 ? '255,255,255' : '0,0,0'},0.035)`;
    ctx.fillRect(random() * W, random() * H, 2, 2);
  }
  // Double border.
  ctx.strokeStyle = stripe;
  ctx.lineWidth = 18;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.lineWidth = 5;
  ctx.strokeRect(62, 62, W - 124, H - 124);
  // Front.
  medallion(ctx, front, 210, 92, accent, stripe);
  serifTitle(ctx, label[0], front, 470, label[0].length > 5 ? 200 : 230, ink, beer.id === 'sai_gon' ? undefined : 'rgba(0,0,0,0.35)');
  ctx.fillStyle = stripe;
  ctx.fillRect(front - 330, 515, 660, 70);
  ctx.font = '900 54px sans-serif';
  ctx.fillStyle = beer.id === 'sai_gon' ? '#ffffff' : accent;
  ctx.textAlign = 'center';
  ctx.fillText(label[1].split('').join(' '), front, 568);
  ctx.font = '700 36px sans-serif';
  ctx.fillStyle = ink;
  ctx.fillText(`${beer.volumeMl} ml  •  ${beer.abv}% ALC/VOL`, front, 680);
  // Sides.
  backPanel(ctx, 120, 300, 360, beer.id === 'sai_gon' ? '#14532d' : '#e5e7eb');
  ctx.font = '800 44px sans-serif';
  ctx.fillStyle = ink;
  ctx.fillText('SẢN XUẤT TẠI VIỆT NAM', W - 420, 420);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Neck foil: stripe colour with a band of the label colour. */
function foilTexture(beer: Beer) {
  const { canvas: c, ctx } = canvas(512, 256);
  ctx.fillStyle = beer.art.stripe;
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = beer.art.accent;
  ctx.fillRect(0, 110, 512, 60);
  ctx.fillStyle = beer.art.ink;
  ctx.font = '900 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(beer.art.label[0], 256, 152);
  // Crinkles.
  const random = seeded(9);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = random() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(random() * 512, 0, 2, 256);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

// ---------------------------------------------------------------- geometry helpers

const lathe = (points: [number, number][], segments = 96) =>
  new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    segments
  );

function coldMaterial(params: THREE.MeshPhysicalMaterialParameters, bump = 0.35) {
  const drops = condensation().clone();
  drops.repeat.set(2, 2);
  drops.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial({ ...params, bumpMap: drops, bumpScale: bump });
}

// ---------------------------------------------------------------- models

function createCan(beer: Beer) {
  const group = new THREE.Group();
  const aluminium = new THREE.MeshPhysicalMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.22 });
  const radius = 3.3;
  // Printed body: metallic paint under a glossy lacquer, beaded with condensation.
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 9.0, 128, 1, true),
    coldMaterial({ map: canLabel(beer), metalness: beer.id === 'tiger_bac' ? 0.9 : 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }, 0.25)
  );
  body.position.y = 0.9 + 4.5;
  body.rotation.y = Math.PI; // texture middle (front) toward +Z
  group.add(body);
  // Domed base and necked top with the lid rim.
  group.add(new THREE.Mesh(lathe([[0, 0.55], [2.0, 0.15], [2.55, 0.0], [2.95, 0.18], [3.25, 0.6], [radius, 0.9]]), aluminium));
  group.add(
    new THREE.Mesh(
      lathe([
        [radius, 9.9],
        [3.22, 10.35],
        [2.9, 10.9],
        [2.74, 11.05],
        [2.8, 11.32],
        [2.83, 11.48],
        [2.7, 11.52],
        [2.56, 11.3],
        [2.5, 11.18],
        [0, 11.18],
      ]),
      aluminium
    )
  );
  // Pull tab and rivet.
  const tab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.9), new THREE.MeshPhysicalMaterial({ color: 0xc7ccd3, metalness: 1, roughness: 0.3 }));
  tab.position.set(0, 11.22, 0.35);
  group.add(tab);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0x1f2937 }));
  hole.position.set(0, 11.23, 0.55);
  group.add(hole);
  const opening = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.02, 24), new THREE.MeshPhysicalMaterial({ color: 0xa3a9b2, metalness: 1, roughness: 0.4 }));
  opening.scale.z = 0.6;
  opening.position.set(0, 11.19, -1.2);
  group.add(opening);
  return group;
}

function createBottle(beer: Beer) {
  const group = new THREE.Group();
  const glassColor = new THREE.Color(beer.art.body);
  // Long-neck 330 ml profile (radius, height) in cm.
  const profile: [number, number][] = [
    [0, 0.35],
    [2.5, 0.05],
    [2.95, 0.2],
    [3.1, 0.65],
    [3.1, 12.8],
    [3.0, 14.0],
    [2.55, 15.6],
    [1.75, 17.2],
    [1.3, 18.5],
    [1.2, 21.6],
    [1.38, 21.9],
    [1.38, 22.5],
    [1.15, 22.7],
  ];
  const glass = new THREE.Mesh(
    lathe(profile),
    coldMaterial(
      {
        color: glassColor,
        metalness: 0,
        roughness: 0.05,
        transmission: 0.55,
        thickness: 0.6,
        ior: 1.5,
        attenuationColor: glassColor,
        attenuationDistance: 0.8,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
      },
      0.3
    )
  );
  group.add(glass);
  // The beer inside (filled into the neck), seen darkly through the tinted glass.
  const beerCore = new THREE.Mesh(
    lathe(
      profile
        .filter(([, y]) => y < 19.6)
        .map(([r, y]) => [Math.max(0, r - 0.22), Math.max(0.5, y)] as [number, number])
        .concat([
          [0.98, 19.6],
          [0, 19.6],
        ])
    ),
    new THREE.MeshStandardMaterial({ color: 0x3a1e05, roughness: 0.2 })
  );
  group.add(beerCore);
  // Body label (270° wrap), shoulder band, foil neck, crown cap.
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(3.125, 3.125, 6.0, 128, 1, true, Math.PI * 0.25, Math.PI * 1.5),
    new THREE.MeshPhysicalMaterial({ map: bottleLabel(beer), roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4 })
  );
  label.position.y = 7.6;
  label.rotation.y = Math.PI;
  group.add(label);
  const foil = new THREE.Mesh(
    lathe(
      [
        [1.36, 18.9],
        [1.24, 19.2],
        [1.23, 21.6],
        [1.41, 21.9],
        [1.41, 22.55],
      ],
      64
    ),
    new THREE.MeshPhysicalMaterial({ map: foilTexture(beer), metalness: 0.75, roughness: 0.32, clearcoat: 0.6 })
  );
  group.add(foil);
  const capMaterial = new THREE.MeshPhysicalMaterial({ color: beer.art.stripe, metalness: 0.85, roughness: 0.28 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.5, 0.55, 21), capMaterial); // 21 crimps
  cap.position.y = 22.75;
  group.add(cap);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.42, 0.12, 48), capMaterial);
  capTop.position.y = 23.08;
  group.add(capTop);
  return group;
}

function createBiaHoiGlass(beer: Beer, animated: boolean) {
  const group = new THREE.Group();
  // Thick recycled glass, slightly green, tapering toward the heavy base.
  const glass = new THREE.Mesh(
    lathe([
      [0, 0],
      [3.5, 0],
      [3.62, 0.2],
      [4.1, 13.3],
      [4.04, 13.5],
      [3.8, 13.44],
      [3.36, 1.4],
      [0, 1.35],
    ]),
    coldMaterial(
      {
        color: 0xe4f2e8,
        metalness: 0,
        roughness: 0.04,
        transmission: 1,
        thickness: 0.5,
        ior: 1.5,
        attenuationColor: new THREE.Color(0xb7dcc3),
        attenuationDistance: 5,
        clearcoat: 1,
        side: THREE.DoubleSide,
      },
      0.45
    )
  );
  group.add(glass);
  // Beer: transmissive amber that deepens with depth.
  const beerMesh = new THREE.Mesh(
    lathe([
      [0, 1.42],
      [3.32, 1.42],
      [3.74, 11.2],
      [0, 11.2],
    ]),
    // Opaque on purpose: three.js transmission only refracts opaque objects, so a
    // transmissive beer would vanish behind the transmissive glass. A little emissive
    // makes it glow amber the way back-lit beer does.
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(beer.art.body),
      roughness: 0.15,
      emissive: new THREE.Color(0xb86200),
      emissiveIntensity: 0.45,
      clearcoat: 0.5,
    })
  );
  group.add(beerMesh);
  // Foam head, domed and spilling a little over the rim.
  const foamBump = condensation().clone();
  foamBump.repeat.set(3, 1);
  foamBump.needsUpdate = true;
  const foam = new THREE.Mesh(
    lathe([
      [0, 11.15],
      [3.74, 11.15],
      [3.98, 12.6],
      [4.12, 13.55],
      [4.0, 14.05],
      [3.4, 14.5],
      [2.2, 14.8],
      [0, 14.9],
    ]),
    new THREE.MeshPhysicalMaterial({ color: 0xfffaf0, roughness: 0.92, sheen: 0.6, sheenColor: new THREE.Color(0xfff1d6), bumpMap: foamBump, bumpScale: 1.2 })
  );
  group.add(foam);
  // Rising bubbles.
  const random = seeded(21);
  const bubbleCount = 70;
  const bubbles = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.06, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xfff6d5, emissive: 0x6b4500, emissiveIntensity: 0.3, roughness: 0.2 }),
    bubbleCount
  );
  const seeds = Array.from({ length: bubbleCount }, () => ({
    a: random() * TAU,
    r: Math.sqrt(random()) * 3.0,
    speed: 0.8 + random() * 1.6,
    phase: random(),
  }));
  const matrix = new THREE.Matrix4();
  const place = (time: number) => {
    seeds.forEach((b, i) => {
      const t = (time * b.speed * 0.12 + b.phase) % 1;
      const y = 1.6 + t * 9.4;
      const r = b.r * (0.88 + (y / 11) * 0.12);
      matrix.makeTranslation(Math.cos(b.a) * r, y, Math.sin(b.a) * r);
      bubbles.setMatrixAt(i, matrix);
    });
    bubbles.instanceMatrix.needsUpdate = true;
  };
  place(0);
  group.add(bubbles);
  if (animated) group.userData.update = place;
  return group;
}

/** A beer model standing on y = 0, centred on the Y axis. `update(time)` if animated. */
export function createBeerModel(beer: Beer, animated = false): THREE.Group {
  const model = beer.format === 'lon' ? createCan(beer) : beer.format === 'chai' ? createBottle(beer) : createBiaHoiGlass(beer, animated);
  model.name = `Beer_${beer.id}`;
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) mesh.castShadow = true;
  });
  return model;
}

// ---------------------------------------------------------------- studio

/** Dark studio with softbox strips; the PMREM of it gives the reflections. */
function studioEnvironment() {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x050506);
  const strip = (w: number, h: number, intensity: number, position: [number, number, number], color = 0xffffff) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
  };
  strip(3, 16, 6, [-9, 2, 4]); // key strip, front-left
  strip(2, 16, 4, [9, 2, 3]); // fill strip, right
  strip(4, 16, 3, [0, 2, -10], 0xfff2dc); // warm back light
  strip(14, 6, 1.5, [0, 12, 0]); // overhead
  strip(30, 4, 0.25, [0, -6, 6]); // bounce off the table
  return env;
}

export interface BeerStudio {
  scene: THREE.Scene;
  /** Puts `model` on the set and frames `camera` around it. */
  stage: (model: THREE.Object3D, camera: THREE.PerspectiveCamera) => void;
  dispose: () => void;
}

export function createBeerStudio(renderer: THREE.WebGLRenderer): BeerStudio {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = studioEnvironment();
  const envTarget = pmrem.fromScene(envScene, 0.02);
  scene.environment = envTarget.texture;

  // Backdrop: a curved sweep that fades from warm grey to black, like a product shot.
  const backdropCanvas = canvas(16, 256);
  const g = backdropCanvas.ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#060607');
  g.addColorStop(0.6, '#1d1d21');
  g.addColorStop(1, '#2a2a30');
  backdropCanvas.ctx.fillStyle = g;
  backdropCanvas.ctx.fillRect(0, 0, 16, 256);
  const backdropTexture = new THREE.CanvasTexture(backdropCanvas.canvas);
  backdropTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = backdropTexture;

  // Glossy dark table top with a soft contact shadow.
  const table = new THREE.Mesh(
    new THREE.CircleGeometry(60, 64),
    // Matte and dark: a bright, mirror-like table steals the attention from the beer.
    new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.75, metalness: 0, envMapIntensity: 0.15 })
  );
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.add(table);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-12, 22, 14);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  Object.assign(key.shadow.camera, { left: -12, right: 12, top: 30, bottom: -4, near: 1, far: 70 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe2b8, 1.4);
  rim.position.set(10, 14, -12);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  let current: THREE.Object3D | null = null;
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  return {
    scene,
    stage: (model, camera) => {
      if (current) scene.remove(current);
      current = model;
      scene.add(model);
      box.setFromObject(model);
      box.getSize(size);
      box.getCenter(center);
      // Frame the height (with margin) from slightly above, like a product shot.
      const fit = (size.y * 0.78) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const fitWidth = (size.x * 0.95) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.aspect;
      const distance = Math.max(fit, fitWidth);
      camera.position.set(0, center.y + size.y * 0.1, distance);
      camera.lookAt(0, center.y, 0);
      camera.near = distance / 20;
      camera.far = distance * 10;
      camera.updateProjectionMatrix();
    },
    dispose: () => {
      envTarget.dispose();
      pmrem.dispose();
      backdropTexture.dispose();
    },
  };
}

// ---------------------------------------------------------------- thumbnails

let thumbRenderer: THREE.WebGLRenderer | null = null;
let thumbStudio: BeerStudio | null = null;
const thumbCache = new Map<string, string>();

/** Renders a still product shot of `beer` (cached PNG data URL). */
export function renderBeerThumbnail(beer: Beer, width = 360, height = 480): string {
  const key = `${beer.id}@${width}x${height}`;
  const cached = thumbCache.get(key);
  if (cached) return cached;
  if (!thumbRenderer) {
    thumbRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    thumbRenderer.toneMappingExposure = 1.05;
    thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
    thumbRenderer.shadowMap.enabled = true;
    thumbRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    thumbStudio = createBeerStudio(thumbRenderer);
  }
  thumbRenderer.setPixelRatio(1);
  thumbRenderer.setSize(width, height, false);
  const camera = new THREE.PerspectiveCamera(24, width / height, 0.1, 500);
  const model = createBeerModel(beer);
  // A slight turn so the cylinder shows depth while the label still reads head-on.
  model.rotation.y = 0.12;
  thumbStudio!.stage(model, camera);
  thumbRenderer.render(thumbStudio!.scene, camera);
  const url = thumbRenderer.domElement.toDataURL('image/png');
  thumbCache.set(key, url);
  disposeBeerModel(model);
  return url;
}

/** Frees a model's geometry, materials and its own textures. */
export function disposeBeerModel(model: THREE.Object3D) {
  model.removeFromParent();
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const material = mesh.material as THREE.MeshPhysicalMaterial;
    material.map?.dispose();
    if (material.bumpMap && material.bumpMap !== condensationTexture) material.bumpMap.dispose();
    material.dispose();
  });
}
