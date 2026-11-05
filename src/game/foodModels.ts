import * as THREE from 'three';
import { createBeerLabelTexture } from './proceduralModels';

/**
 * Street-food dishes ("mồi") and table clutter for the stainless pub table.
 * Dishes are modelled at unit scale (plate radius ~0.24) and scaled up by DISH_SCALE.
 * Each dish exposes `userData.morsels` (hidden as servings run out) and may expose
 * `userData.update(time)` for steam / flame / bubbling animation.
 */
export const DISH_SCALE = 1.4;

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const std = (color: number, roughness = 0.5, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, ...extra });

// Shared materials
const M = {
  plate: std(0xf8fafc, 0.3),
  plateBlue: std(0x1d4ed8, 0.35),
  leaf: std(0x2f7d32, 0.6, { side: THREE.DoubleSide }),
  leafVein: std(0x9ccc65, 0.6),
  chili: std(0xdc2626, 0.3),
  herb: std(0x3f9b3f, 0.6),
  lime: std(0x65a30d, 0.4),
  limeFlesh: std(0xd9f99d, 0.5),
  bowl: std(0xf5f5f4, 0.3),
  fishSauce: std(0xb45309, 0.1, { transparent: true, opacity: 0.85 }),
  steel: std(0xd4d4d8, 0.25, { metalness: 0.85 }),
  black: std(0x18181b, 0.5),
};

function softSpriteTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
let steamTex: THREE.CanvasTexture | null = null;

/** Melamine plate with a lip and the classic blue rim lines. */
function makePlate(radius = 0.24): THREE.Group {
  const g = new THREE.Group();
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(radius * 0.72, 0),
    new THREE.Vector2(radius * 0.78, 0.006),
    new THREE.Vector2(radius * 0.97, 0.03),
    new THREE.Vector2(radius, 0.036),
    new THREE.Vector2(radius * 0.985, 0.04),
    new THREE.Vector2(radius * 0.78, 0.012),
    new THREE.Vector2(0, 0.012),
  ];
  const plate = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), M.plate);
  plate.castShadow = true;
  plate.receiveShadow = true;
  g.add(plate);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.99, 0.004, 6, 48), M.plateBlue);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.038;
  g.add(rim);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.8, 0.0025, 6, 48), M.plateBlue);
  inner.rotation.x = Math.PI / 2;
  inner.position.y = 0.014;
  g.add(inner);
  return g;
}

/** Pointed banana leaf liner with a pale midrib, laid across the plate. */
function makeBananaLeaf(length = 0.4, width = 0.24, rotation = 0.4): THREE.Group {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-length / 2, 0);
  shape.quadraticCurveTo(-length * 0.1, width / 2, length / 2, 0.01);
  shape.quadraticCurveTo(-length * 0.1, -width / 2, -length / 2, 0);
  const leaf = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), M.leaf);
  leaf.rotation.x = -Math.PI / 2;
  leaf.position.y = 0.0135;
  g.add(leaf);
  const vein = new THREE.Mesh(new THREE.BoxGeometry(length * 0.9, 0.002, 0.006), M.leafVein);
  vein.position.y = 0.0145;
  g.add(vein);
  g.rotation.y = rotation;
  return g;
}

function chiliRing(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0035, 6, 10), M.chili);
  m.rotation.x = Math.PI / 2;
  return m;
}

function herbLeaf(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), M.herb);
  m.scale.set(1.6, 0.25, 0.8);
  return m;
}

function limeWedge(): THREE.Group {
  const g = new THREE.Group();
  const skin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12, 1, false, 0, Math.PI / 2), M.lime);
  const flesh = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.021, 12, 1, false, 0, Math.PI / 2), M.limeFlesh);
  g.add(skin, flesh);
  g.rotation.z = Math.PI / 2;
  return g;
}

function dipBowl(fill: THREE.Material, r = 0.05): THREE.Group {
  const g = new THREE.Group();
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(r * 0.6, 0),
    new THREE.Vector2(r, r * 0.7),
    new THREE.Vector2(r * 0.94, r * 0.72),
    new THREE.Vector2(r * 0.56, r * 0.08),
    new THREE.Vector2(0, r * 0.08),
  ];
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), M.bowl);
  bowl.castShadow = true;
  g.add(bowl);
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(r * 0.85, 20), fill);
  liquid.rotation.x = -Math.PI / 2;
  liquid.position.y = r * 0.5;
  g.add(liquid);
  return g;
}

// ============================================================================
// DISHES
// ============================================================================

function peanutDish(dish: THREE.Group, morsels: THREE.Object3D[]) {
  const r = rng(11);
  dish.add(makePlate(), makeBananaLeaf(0.38, 0.22, 0.6));
  const nutGeo = new THREE.SphereGeometry(0.016, 10, 8);
  nutGeo.scale(1.5, 0.95, 1);
  const skin = std(0x9a3412, 0.7);
  const peeled = std(0xe7c38a, 0.6);
  const garlic = std(0xfacc15, 0.55);
  // 12 clusters of 3 nuts piled into a mound
  for (let c = 0; c < 12; c++) {
    const cluster = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const nut = new THREE.Mesh(nutGeo, r() < 0.55 ? skin : peeled);
      nut.position.set((r() - 0.5) * 0.04, k * 0.012, (r() - 0.5) * 0.04);
      nut.rotation.set(r() * 3, r() * 3, r() * 3);
      cluster.add(nut);
    }
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.1;
    cluster.position.set(Math.cos(a) * d, 0.022 + (0.1 - d) * 0.25, Math.sin(a) * d);
    dish.add(cluster);
    morsels.push(cluster);
  }
  // Fried garlic flakes and chili rings sprinkled on top
  for (let i = 0; i < 14; i++) {
    const flake = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.002, 6), garlic);
    const a = r() * Math.PI * 2;
    const d = r() * 0.11;
    flake.position.set(Math.cos(a) * d, 0.05 - d * 0.2, Math.sin(a) * d);
    flake.rotation.set(r(), r(), r());
    dish.add(flake);
  }
  for (let i = 0; i < 6; i++) {
    const c = chiliRing();
    const a = r() * Math.PI * 2;
    const d = r() * 0.1;
    c.position.set(Math.cos(a) * d, 0.052 - d * 0.2, Math.sin(a) * d);
    dish.add(c);
  }
}

function chickenFeetDish(dish: THREE.Group, morsels: THREE.Object3D[]) {
  const r = rng(22);
  dish.add(makePlate(), makeBananaLeaf(0.42, 0.24, -0.3));
  const glaze = std(0xb45309, 0.28, { emissive: 0x431407, emissiveIntensity: 0.15 });
  const charMat = std(0x451a03, 0.6);
  const shankGeo = new THREE.CapsuleGeometry(0.016, 0.09, 4, 10);
  const toeGeo = new THREE.CapsuleGeometry(0.0085, 0.045, 3, 8);
  const padGeo = new THREE.SphereGeometry(0.024, 10, 8);
  padGeo.scale(1.1, 0.6, 1);
  for (let i = 0; i < 6; i++) {
    const foot = new THREE.Group();
    const shank = new THREE.Mesh(shankGeo, glaze);
    shank.rotation.z = Math.PI / 2;
    shank.position.x = -0.05;
    foot.add(shank);
    // Grill char stripes
    for (let s = 0; s < 3; s++) {
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.0165, 0.002, 4, 12), charMat);
      stripe.rotation.y = Math.PI / 2;
      stripe.position.x = -0.08 + s * 0.025;
      foot.add(stripe);
    }
    const pad = new THREE.Mesh(padGeo, glaze);
    pad.position.x = 0.01;
    foot.add(pad);
    [-0.5, 0, 0.5].forEach((spread) => {
      const toe = new THREE.Mesh(toeGeo, glaze);
      toe.rotation.z = Math.PI / 2;
      toe.rotation.y = spread;
      toe.position.set(0.045, 0.002, spread * 0.05);
      foot.add(toe);
    });
    const angle = -0.9 + i * 0.36;
    foot.position.set(Math.cos(angle) * 0.03, 0.03 + (i % 2) * 0.012, Math.sin(angle) * 0.08 - 0.02);
    foot.rotation.y = angle + (r() - 0.5) * 0.3;
    foot.rotation.x = (r() - 0.5) * 0.3;
    foot.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    dish.add(foot);
    morsels.push(foot);
  }
  // Sesame + scallions
  const sesame = std(0xfef3c7, 0.5);
  for (let i = 0; i < 24; i++) {
    const seed = new THREE.Mesh(new THREE.SphereGeometry(0.003, 4, 3), sesame);
    seed.position.set((r() - 0.5) * 0.2, 0.06, (r() - 0.5) * 0.16);
    dish.add(seed);
  }
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.012, 6), M.herb);
    s.position.set((r() - 0.5) * 0.18, 0.062, (r() - 0.5) * 0.14);
    s.rotation.set(r() * 3, 0, r() * 3);
    dish.add(s);
  }
  // Kumquat halves + chili salt dip
  const kumquat = std(0xf97316, 0.35);
  for (let i = 0; i < 2; i++) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), kumquat);
    k.position.set(0.15, 0.015, -0.05 + i * 0.05);
    dish.add(k);
  }
  const salt = dipBowl(std(0xfb7185, 0.9), 0.035);
  salt.position.set(-0.14, 0.012, 0.11);
  dish.add(salt);
}

function hotpotDish(dish: THREE.Group, morsels: THREE.Object3D[]) {
  const r = rng(33);
  // Portable butane stove (bếp ga mini)
  const stove = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.34), std(0x27272a, 0.4, { metalness: 0.5 }));
  stove.position.y = 0.035;
  stove.castShadow = true;
  dish.add(stove);
  const plateTop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.004, 0.32), M.steel);
  plateTop.position.y = 0.072;
  dish.add(plateTop);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), std(0xdc2626, 0.4));
  knob.rotation.x = Math.PI / 2;
  knob.position.set(0.14, 0.035, 0.175);
  dish.add(knob);
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0x60a5fa,
    emissive: 0x3b82f6,
    emissiveIntensity: 2.5,
    transparent: true,
    opacity: 0.85,
  });
  const flames = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.03, 6), flameMat);
    const a = (i / 12) * Math.PI * 2;
    f.position.set(Math.cos(a) * 0.07, 0.088, Math.sin(a) * 0.07);
    flames.add(f);
  }
  dish.add(flames);

  // Stainless pot with handles
  const potPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.17, 0),
    new THREE.Vector2(0.2, 0.02),
    new THREE.Vector2(0.21, 0.13),
    new THREE.Vector2(0.222, 0.135),
    new THREE.Vector2(0.2, 0.135),
    new THREE.Vector2(0.19, 0.03),
    new THREE.Vector2(0, 0.03),
  ];
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potPts, 40), M.steel);
  pot.position.y = 0.095;
  pot.castShadow = true;
  dish.add(pot);
  [-1, 1].forEach((side) => {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 12, Math.PI), M.black);
    handle.position.set(side * 0.23, 0.2, 0);
    handle.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    dish.add(handle);
  });

  // Tom Yum broth
  const broth = new THREE.Mesh(
    new THREE.CircleGeometry(0.195, 36),
    std(0xe2561b, 0.12, { emissive: 0x7c2d12, emissiveIntensity: 0.35 })
  );
  broth.rotation.x = -Math.PI / 2;
  broth.position.y = 0.205;
  dish.add(broth);
  // Chili oil droplets
  const oil = std(0xfb923c, 0.05);
  for (let i = 0; i < 14; i++) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.006 + r() * 0.01, 10), oil);
    d.rotation.x = -Math.PI / 2;
    const a = r() * Math.PI * 2;
    const rr = r() * 0.17;
    d.position.set(Math.cos(a) * rr, 0.2065, Math.sin(a) * rr);
    dish.add(d);
  }

  // Shrimp (curled tube + tail fan), squid rings, enoki, tomato
  const shrimpMat = std(0xf97316, 0.35);
  const shrimpCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.025, 0, 0),
    new THREE.Vector3(-0.012, 0, 0.02),
    new THREE.Vector3(0.012, 0, 0.022),
    new THREE.Vector3(0.026, 0, 0.004),
  ]);
  const shrimpGeo = new THREE.TubeGeometry(shrimpCurve, 12, 0.009, 8, false);
  const squidMat = std(0xfafaf9, 0.4);
  const tomatoMat = std(0xef4444, 0.35);
  const enokiMat = std(0xfef9c3, 0.6);
  for (let i = 0; i < 8; i++) {
    let item: THREE.Object3D;
    if (i % 4 === 0 || i % 4 === 2) {
      const s = new THREE.Group();
      s.add(new THREE.Mesh(shrimpGeo, shrimpMat));
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.02, 4), std(0xdc2626, 0.4));
      tail.position.set(0.03, 0, 0.0);
      tail.rotation.z = -Math.PI / 2;
      s.add(tail);
      item = s;
    } else if (i % 4 === 1) {
      item = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.006, 6, 14), squidMat);
      item.rotation.x = Math.PI / 2;
    } else {
      const e = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.05, 4), enokiMat);
        stem.position.set((k - 2.5) * 0.004, 0, 0);
        stem.rotation.z = Math.PI / 2 + (k - 2.5) * 0.06;
        e.add(stem);
      }
      item = e;
    }
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const rr = i < 6 ? 0.12 : 0.04;
    item.position.set(Math.cos(a) * rr, 0.21, Math.sin(a) * rr);
    item.rotation.y = -a;
    dish.add(item);
    morsels.push(item);
  }
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6, 0, Math.PI), tomatoMat);
    const a = r() * Math.PI * 2;
    t.position.set(Math.cos(a) * 0.08, 0.205, Math.sin(a) * 0.08);
    t.rotation.x = -Math.PI / 2;
    dish.add(t);
  }
  for (let i = 0; i < 6; i++) {
    const leaf = herbLeaf();
    leaf.scale.multiplyScalar(1.4);
    const a = r() * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.15, 0.208, Math.sin(a) * 0.15);
    leaf.rotation.y = a;
    dish.add(leaf);
  }

  // Bubbles + steam
  const bubbleMat = std(0xfdba74, 0.1, { transparent: true, opacity: 0.8 });
  const bubbles: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), bubbleMat);
    const a = r() * Math.PI * 2;
    const rr = r() * 0.16;
    b.position.set(Math.cos(a) * rr, 0.206, Math.sin(a) * rr);
    b.userData.phase = r() * 6;
    dish.add(b);
    bubbles.push(b);
  }
  if (!steamTex) steamTex = softSpriteTexture();
  const steam: THREE.Sprite[] = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: steamTex, transparent: true, opacity: 0, depthWrite: false })
    );
    s.userData.phase = i / 5;
    s.userData.x = (r() - 0.5) * 0.16;
    s.userData.z = (r() - 0.5) * 0.16;
    dish.add(s);
    steam.push(s);
  }

  dish.userData.update = (time: number) => {
    flames.children.forEach((f, i) => {
      f.scale.y = 0.8 + Math.abs(Math.sin(time * 18 + i * 1.7)) * 0.5;
    });
    bubbles.forEach((b) => {
      const k = (time * 1.6 + b.userData.phase) % 1;
      b.scale.setScalar(0.4 + k * 1.2);
      (b.material as THREE.MeshStandardMaterial).opacity = 0.8;
      b.visible = k < 0.9;
    });
    steam.forEach((s) => {
      const k = (time * 0.35 + s.userData.phase) % 1;
      s.position.set(s.userData.x + Math.sin(time + s.userData.phase * 6) * 0.03, 0.23 + k * 0.45, s.userData.z);
      s.scale.setScalar(0.08 + k * 0.22);
      s.material.opacity = Math.sin(k * Math.PI) * 0.35;
    });
  };
}

function snailShellTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e9cfa0';
  g.fillRect(0, 0, 128, 128);
  const r = rng(77);
  for (let i = 0; i < 110; i++) {
    g.fillStyle = r() < 0.5 ? '#5b210c' : '#8a3510';
    g.beginPath();
    g.ellipse(r() * 128, r() * 128, 3 + r() * 6, 2 + r() * 4, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
let shellTex: THREE.CanvasTexture | null = null;

function snailDish(dish: THREE.Group, morsels: THREE.Object3D[]) {
  const r = rng(44);
  dish.add(makePlate());
  // Garlic butter sauce pooled on the plate
  const sauceShape = new THREE.Shape();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = 0.15 + Math.sin(a * 3) * 0.015 + Math.cos(a * 5) * 0.01;
    if (i === 0) sauceShape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else sauceShape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const sauce = new THREE.Mesh(new THREE.ShapeGeometry(sauceShape), std(0xf59e0b, 0.08));
  sauce.rotation.x = -Math.PI / 2;
  sauce.position.y = 0.0135;
  dish.add(sauce);

  if (!shellTex) shellTex = snailShellTexture();
  const shellMat = new THREE.MeshStandardMaterial({ map: shellTex, color: 0xe8c99a, roughness: 0.25 });
  // Spiral shell: tall cone + stacked whorls, opening facing sideways
  const spirePts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    spirePts.push(new THREE.Vector2(0.026 * (1 - t) * (1 + 0.15 * Math.sin(t * Math.PI * 6)), t * 0.065));
  }
  const spireGeo = new THREE.LatheGeometry(spirePts, 16);
  for (let i = 0; i < 10; i++) {
    const snail = new THREE.Group();
    const spire = new THREE.Mesh(spireGeo, shellMat);
    spire.castShadow = true;
    snail.add(spire);
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), std(0xfde68a, 0.4));
    mouth.scale.set(1, 1.3, 0.5);
    mouth.position.set(0.018, 0.012, 0);
    snail.add(mouth);
    snail.scale.setScalar(1.45);
    snail.rotation.z = -1.2 + r() * 0.4;
    snail.rotation.y = r() * Math.PI * 2;
    const a = (i / 10) * Math.PI * 2 + r() * 0.3;
    const rr = i % 3 === 0 ? 0.04 : 0.11;
    snail.position.set(Math.cos(a) * rr, 0.035 + (i % 3 === 0 ? 0.02 : 0), Math.sin(a) * rr);
    dish.add(snail);
    morsels.push(snail);
  }
  // Garlic bits, Vietnamese coriander (rau răm), chili
  const garlic = std(0xfde047, 0.5);
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.004, 0.007), garlic);
    g.position.set((r() - 0.5) * 0.26, 0.017, (r() - 0.5) * 0.26);
    g.rotation.y = r() * 3;
    dish.add(g);
  }
  for (let i = 0; i < 7; i++) {
    const leaf = herbLeaf();
    leaf.position.set((r() - 0.5) * 0.22, 0.06, (r() - 0.5) * 0.22);
    leaf.rotation.y = r() * 3;
    dish.add(leaf);
  }
  for (let i = 0; i < 4; i++) {
    const c = chiliRing();
    c.position.set((r() - 0.5) * 0.2, 0.05, (r() - 0.5) * 0.2);
    dish.add(c);
  }
}

function fishballDish(dish: THREE.Group, morsels: THREE.Object3D[]) {
  const r = rng(55);
  dish.add(makePlate(), makeBananaLeaf(0.42, 0.22, 1.2));
  const ballGeo = new THREE.IcosahedronGeometry(0.022, 1); // slightly lumpy = fried
  const fried = std(0xd97706, 0.45);
  const friedDark = std(0xb45309, 0.5);
  const sausage = std(0xdc2626, 0.35);
  const bamboo = std(0xe7d3a3, 0.7);
  for (let i = 0; i < 5; i++) {
    const skewer = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.26, 6), bamboo);
    stick.rotation.z = Math.PI / 2;
    skewer.add(stick);
    for (let k = 0; k < 4; k++) {
      const isSausage = (i + k) % 4 === 3;
      const piece = isSausage
        ? new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.035, 12), sausage)
        : new THREE.Mesh(ballGeo, k % 2 ? fried : friedDark);
      if (isSausage) piece.rotation.z = Math.PI / 2;
      piece.position.x = -0.07 + k * 0.045;
      piece.castShadow = true;
      skewer.add(piece);
    }
    skewer.position.set(0, 0.03 + i * 0.004, -0.1 + i * 0.05);
    skewer.rotation.y = 0.35 + (r() - 0.5) * 0.25;
    dish.add(skewer);
    morsels.push(skewer);
  }
  // Sweet chili sauce drizzle
  const drizzleMat = std(0xea580c, 0.15);
  for (let i = 0; i < 3; i++) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      pts.push(new THREE.Vector3(-0.1 + k * 0.025, 0.058, -0.08 + i * 0.07 + Math.sin(k * 1.4) * 0.02));
    }
    dish.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.003, 5), drizzleMat));
  }
  const sauce = dipBowl(std(0xb91c1c, 0.2), 0.04);
  sauce.position.set(0.15, 0.012, 0.12);
  dish.add(sauce);
}

function mangoDish(dish: THREE.Group, morsels: THREE.Object3D[]) {
  const r = rng(66);
  dish.add(makePlate());
  // Wedge = extruded fan slice in pale flesh + a thin green skin strip on the outer arc
  const wedgeAngle = 0.5;
  const rad = 0.05;
  const wedgeShape = new THREE.Shape();
  wedgeShape.moveTo(0, 0);
  wedgeShape.absarc(0, 0, rad, -wedgeAngle / 2, wedgeAngle / 2, false);
  wedgeShape.lineTo(0, 0);
  const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, { depth: 0.11, bevelEnabled: false, curveSegments: 8 });
  wedgeGeo.translate(0, 0, -0.055);
  const flesh = std(0xe6f4a8, 0.45);
  const skin = std(0x3f6212, 0.35);
  // Skin = thin arc band extruded along the same axis as the flesh
  const skinShape = new THREE.Shape();
  skinShape.absarc(0, 0, rad + 0.004, -wedgeAngle / 2, wedgeAngle / 2, false);
  skinShape.absarc(0, 0, rad - 0.001, wedgeAngle / 2, -wedgeAngle / 2, true);
  const skinGeo = new THREE.ExtrudeGeometry(skinShape, { depth: 0.11, bevelEnabled: false, curveSegments: 8 });
  skinGeo.translate(0, 0, -0.055);
  for (let i = 0; i < 10; i++) {
    const wedge = new THREE.Group();
    wedge.add(new THREE.Mesh(wedgeGeo, flesh), new THREE.Mesh(skinGeo, skin));
    wedge.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    // Lay each slice skin-down (arc toward -y), long axis horizontal, resting on the plate
    wedge.rotation.z = -Math.PI / 2;
    wedge.position.y = rad + 0.004;
    const holder = new THREE.Group();
    holder.add(wedge);
    const a = (i / 10) * Math.PI * 2;
    holder.position.set(Math.cos(a) * 0.15, 0.012, Math.sin(a) * 0.15);
    // Long axis (z) points outward from the bowl like petals
    holder.rotation.y = -a + Math.PI / 2 + (r() - 0.5) * 0.2;
    holder.rotation.z = (r() - 0.5) * 0.5;
    dish.add(holder);
    morsels.push(holder);
  }
  // Mắm ruốc (purple shrimp paste) + chili salt
  const paste = dipBowl(std(0x6b2140, 0.6), 0.055);
  paste.position.y = 0.012;
  dish.add(paste);
  // Chili rings on top of the shrimp paste
  for (let i = 0; i < 3; i++) {
    const c = chiliRing();
    c.position.set(Math.cos(i * 2) * 0.025, 0.045, Math.sin(i * 2) * 0.025);
    dish.add(c);
  }
}

export function createFoodPlatter(type: string): THREE.Group {
  const dish = new THREE.Group();
  dish.name = `FoodDish_${type}`;
  const morsels: THREE.Object3D[] = [];
  switch (type) {
    case 'peanut':
      peanutDish(dish, morsels);
      break;
    case 'chicken_feet':
      chickenFeetDish(dish, morsels);
      break;
    case 'hotpot':
      hotpotDish(dish, morsels);
      break;
    case 'oc_huong':
      snailDish(dish, morsels);
      break;
    case 'ca_vien':
      fishballDish(dish, morsels);
      break;
    case 'xoai_non':
      mangoDish(dish, morsels);
      break;
    default:
      dish.add(makePlate());
  }
  dish.scale.setScalar(DISH_SCALE);
  dish.userData.morsels = morsels;
  return dish;
}

// ============================================================================
// TABLE CLUTTER — what a real nhậu table looks like halfway through the night
// ============================================================================

function beerBottle(labelTex: THREE.Texture, empty: boolean): THREE.Group {
  const g = new THREE.Group();
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.032, 0),
    new THREE.Vector2(0.034, 0.005),
    new THREE.Vector2(0.034, 0.15),
    new THREE.Vector2(0.03, 0.18),
    new THREE.Vector2(0.013, 0.215),
    new THREE.Vector2(0.012, 0.26),
    new THREE.Vector2(0.014, 0.265),
    new THREE.Vector2(0, 0.265),
  ];
  const glass = new THREE.MeshStandardMaterial({
    color: 0x166534,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: empty ? 0.65 : 0.88,
  });
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), glass);
  body.castShadow = true;
  g.add(body);
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0345, 0.0345, 0.07, 18, 1, true),
    new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.5 })
  );
  label.position.y = 0.09;
  g.add(label);
  if (!empty) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.008, 12), std(0xdc2626, 0.3, { metalness: 0.6 }));
    cap.position.y = 0.268;
    g.add(cap);
  }
  return g;
}

function canTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#facc15';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#b91c1c';
  g.fillRect(0, 18, 128, 28);
  g.fillStyle = '#fef08a';
  g.font = 'bold 22px sans-serif';
  g.textAlign = 'center';
  g.fillText('333', 64, 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function beerCan(tex: THREE.Texture): THREE.Mesh {
  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 0.12, 16),
    [
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.5 }),
      M.steel,
      M.steel,
    ]
  );
  can.castShadow = true;
  return can;
}

export function createTableClutter(): THREE.Group {
  const g = new THREE.Group();
  const r = rng(99);
  const labelTex = createBeerLabelTexture();
  const can = canTexture();
  const top = 0.98;
  const at = (angleDeg: number, radius: number) => {
    const a = (angleDeg * Math.PI) / 180;
    return new THREE.Vector3(Math.cos(a) * radius, top, Math.sin(a) * radius);
  };

  // Beer bottles (some empty) near the edge
  [
    [25, 1.28, false],
    [32, 1.36, true],
    [-35, 1.3, false],
    [150, 1.3, true],
    [-140, 1.25, false],
    [-80, 1.32, true],
  ].forEach(([deg, rad, empty]) => {
    const b = beerBottle(labelTex, empty as boolean);
    b.position.copy(at(deg as number, rad as number));
    b.rotation.y = r() * Math.PI * 2;
    g.add(b);
  });
  // A bottle knocked over
  const fallen = beerBottle(labelTex, true);
  fallen.rotation.z = Math.PI / 2;
  fallen.position.copy(at(-112, 1.34)).add(new THREE.Vector3(0, 0.034, 0));
  fallen.rotation.y = 0.6;
  g.add(fallen);

  // Can pyramid + crushed cans
  const pyramid = new THREE.Group();
  [
    [-0.035, 0],
    [0.035, 0],
    [0, 0.12],
  ].forEach(([x, y]) => {
    const c = beerCan(can);
    c.position.set(x, 0.06 + y, 0);
    pyramid.add(c);
  });
  pyramid.position.copy(at(60, 1.3));
  pyramid.rotation.y = 0.4;
  g.add(pyramid);
  for (let i = 0; i < 2; i++) {
    const c = beerCan(can);
    c.scale.set(1, 0.55, 0.8);
    c.rotation.z = Math.PI / 2;
    c.position.copy(at(-15 + i * 12, 1.38)).add(new THREE.Vector3(0, 0.026, 0));
    c.rotation.y = r() * 3;
    g.add(c);
  }

  // Chopstick holder (ống đũa) packed with chopsticks
  const holder = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.12, 16, 1, true), std(0xb91c1c, 0.4, { side: THREE.DoubleSide }));
  tube.position.y = 0.06;
  holder.add(tube);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.005, 16), std(0xb91c1c, 0.4));
  holder.add(base);
  const chopMat = std(0xf5deb3, 0.6);
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0035, 0.22, 5), chopMat);
    const a = r() * Math.PI * 2;
    const d = r() * 0.028;
    s.position.set(Math.cos(a) * d, 0.11, Math.sin(a) * d);
    s.rotation.set((r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25);
    holder.add(s);
  }
  holder.position.copy(at(-160, 1.05));
  g.add(holder);

  // Pink tissue box with a tissue sticking out
  const tissue = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.1), std(0xf472b6, 0.4));
  box.position.y = 0.03;
  box.castShadow = true;
  tissue.add(box);
  const puff = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 6), std(0xffffff, 0.9));
  puff.position.y = 0.085;
  puff.rotation.z = 0.3;
  tissue.add(puff);
  tissue.position.copy(at(-165, 1.3));
  tissue.rotation.y = 0.5;
  g.add(tissue);

  // Chili sauce & soy sauce bottles
  const sauceBottle = (color: number, capColor: number) => {
    const sb = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.13, 14), std(color, 0.25, { transparent: true, opacity: 0.92 }));
    body.position.y = 0.065;
    body.castShadow = true;
    sb.add(body);
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 12), std(capColor, 0.4));
    nozzle.position.y = 0.155;
    sb.add(nozzle);
    return sb;
  };
  const chiliSauce = sauceBottle(0xdc2626, 0x16a34a);
  chiliSauce.position.copy(at(-150, 1.12));
  g.add(chiliSauce);
  const soy = sauceBottle(0x292524, 0xfacc15);
  soy.position.copy(at(-145, 1.2));
  g.add(soy);

  // Dipping bowls of fish sauce & salt-pepper-lime
  [
    [100, 1.15],
    [10, 1.15],
    [-78, 1.3],
    [138, 1.32],
  ].forEach(([deg, rad], i) => {
    const b = dipBowl(i % 2 ? std(0xe5e7eb, 0.9) : M.fishSauce, 0.045);
    b.position.copy(at(deg, rad));
    g.add(b);
    if (i % 2) {
      const w = limeWedge();
      w.position.copy(at(deg + 5, rad + 0.06)).add(new THREE.Vector3(0, 0.015, 0));
      g.add(w);
    }
  });

  // Glasses of iced beer
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.3 });
  const beerMat = std(0xf59e0b, 0.2, { transparent: true, opacity: 0.85 });
  const iceMat = std(0xe0f2fe, 0.1, { transparent: true, opacity: 0.7 });
  [
    [62, 1.12],
    [-30, 1.32],
    [170, 1.15],
  ].forEach(([deg, rad]) => {
    const glass = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.033, 0.11, 16, 1, true), glassMat);
    shell.position.y = 0.055;
    glass.add(shell);
    const beer = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.031, 0.07, 16), beerMat);
    beer.position.y = 0.037;
    glass.add(beer);
    for (let k = 0; k < 3; k++) {
      const ice = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.022), iceMat);
      ice.position.set((r() - 0.5) * 0.03, 0.07 + k * 0.006, (r() - 0.5) * 0.03);
      ice.rotation.set(r(), r(), r());
      glass.add(ice);
    }
    glass.position.copy(at(deg, rad));
    g.add(glass);
  });

  // Crumpled napkins & peanut shells littering the table
  const napkin = std(0xfafafa, 0.95);
  for (let i = 0; i < 9; i++) {
    const n = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025 + r() * 0.015, 0), napkin);
    n.scale.y = 0.5;
    n.position.copy(at(r() * 360, 0.95 + r() * 0.5)).add(new THREE.Vector3(0, 0.012, 0));
    n.rotation.set(r() * 3, r() * 3, r() * 3);
    g.add(n);
  }
  const shell = std(0xc2915b, 0.8);
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4, 0, Math.PI), shell);
    s.scale.set(1.5, 0.6, 1);
    s.position.copy(at(r() * 360, 0.5 + r() * 1.0)).add(new THREE.Vector3(0, 0.004, 0));
    s.rotation.set(r() * 3, r() * 3, r() * 3);
    g.add(s);
  }

  return g;
}
