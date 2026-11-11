/**
 * Outfit customisation for VRoid (VRM) characters.
 *
 * VRoid bakes clothes into per-part textures (Tops / Bottoms / Shoes / Hair...),
 * so colours are changed by *colorizing* those textures on a canvas: every
 * pixel keeps its own lightness (folds, stitches, hair strands, shading) and
 * takes the hue/saturation of the picked colour, with the average lightness
 * moved toward it. Accessories are small procedural meshes on the head/neck.
 */
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { VRMHumanBoneName } from '@pixiv/three-vrm';

export type VrmOutfitPart = 'hair' | 'top' | 'bottom' | 'shoes' | 'eyes';
export type VrmAccessory = 'non_la' | 'cap' | 'sunglasses' | 'headband' | 'scarf';

export interface VrmOutfit {
  /** Hex colours; null keeps the model's original texture. */
  colors: Partial<Record<VrmOutfitPart, string | null>>;
  /** Skin tint multiplied over the original skin (null = original). */
  skinTone: string | null;
  accessories: VrmAccessory[];
}

export const EMPTY_VRM_OUTFIT: VrmOutfit = { colors: {}, skinTone: null, accessories: [] };

export const VRM_ACCESSORIES: { id: VrmAccessory; label: string }[] = [
  { id: 'non_la', label: '🎋 Nón lá' },
  { id: 'cap', label: '🧢 Mũ lưỡi trai' },
  { id: 'sunglasses', label: '🕶️ Kính râm' },
  { id: 'headband', label: '🎀 Băng đô' },
  { id: 'scarf', label: '🧣 Khăn rằn' },
];

/** VRoid material naming: N00_000_00_Tops_01_CLOTH, ..._HairBack_00_HAIR, ..._EyeIris_00_EYE. */
const PART_PATTERNS: Record<VrmOutfitPart, RegExp> = {
  hair: /_HAIR\b|hair/i,
  top: /tops|onepiece|accessory/i,
  bottom: /bottoms/i,
  shoes: /shoes/i,
  eyes: /eyeiris/i,
};

function partOf(materialName: string): VrmOutfitPart | null {
  if (/outline/i.test(materialName) && !/hair|tops|bottoms|shoes/i.test(materialName)) return null;
  for (const [part, pattern] of Object.entries(PART_PATTERNS) as [VrmOutfitPart, RegExp][]) {
    if (pattern.test(materialName)) return part;
  }
  return null;
}

type TexturedMaterial = THREE.Material & {
  map?: THREE.Texture | null;
  shadeMultiplyTexture?: THREE.Texture | null;
};

interface SourcePixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  meanLightness: number;
}

const sourcePixelCache = new WeakMap<THREE.Texture, SourcePixels | null>();
const colorizedCache = new WeakMap<THREE.Texture, Map<string, THREE.Texture>>();

function readPixels(texture: THREE.Texture): SourcePixels | null {
  if (sourcePixelCache.has(texture)) return sourcePixelCache.get(texture)!;
  const image = texture.image as CanvasImageSource & { width: number; height: number };
  let result: SourcePixels | null = null;
  if (image?.width && image?.height) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context) {
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let sum = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 32) continue;
        const max = Math.max(data[i], data[i + 1], data[i + 2]);
        const min = Math.min(data[i], data[i + 1], data[i + 2]);
        sum += (max + min) / 510;
        count++;
      }
      result = { data, width: canvas.width, height: canvas.height, meanLightness: count ? sum / count : 0.5 };
    }
  }
  sourcePixelCache.set(texture, result);
  return result;
}

function hueToRgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/** Colorize: hue/saturation from `hex`, per-pixel lightness kept (shifted toward the colour). */
function colorizeTexture(texture: THREE.Texture, hex: string): THREE.Texture | null {
  let cache = colorizedCache.get(texture);
  if (!cache) {
    cache = new Map();
    colorizedCache.set(texture, cache);
  }
  const cached = cache.get(hex);
  if (cached) return cached;

  const source = readPixels(texture);
  if (!source) return null;
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(hex).getHSL(hsl, THREE.SRGBColorSpace);
  const shift = hsl.l - source.meanLightness;

  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d')!;
  const output = context.createImageData(source.width, source.height);
  const src = source.data;
  const out = output.data;
  for (let i = 0; i < src.length; i += 4) {
    const max = Math.max(src[i], src[i + 1], src[i + 2]) / 255;
    const min = Math.min(src[i], src[i + 1], src[i + 2]) / 255;
    const l = THREE.MathUtils.clamp((max + min) / 2 + shift, 0, 1);
    // Very light / dark pixels keep less saturation, like real fabric highlights.
    const s = hsl.s * (1 - Math.abs(2 * l - 1) * 0.6);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    out[i] = hueToRgb(p, q, hsl.h + 1 / 3) * 255;
    out[i + 1] = hueToRgb(p, q, hsl.h) * 255;
    out[i + 2] = hueToRgb(p, q, hsl.h - 1 / 3) * 255;
    out[i + 3] = src[i + 3];
  }
  context.putImageData(output, 0, 0);

  const result = new THREE.CanvasTexture(canvas);
  result.flipY = texture.flipY;
  result.colorSpace = texture.colorSpace;
  result.wrapS = texture.wrapS;
  result.wrapT = texture.wrapT;
  result.magFilter = texture.magFilter;
  result.minFilter = texture.minFilter;
  result.anisotropy = texture.anisotropy;
  result.offset.copy(texture.offset);
  result.repeat.copy(texture.repeat);
  result.channel = texture.channel;
  result.needsUpdate = true;
  cache.set(hex, result);
  return result;
}

// ---------------------------------------------------------------------------
// Accessories
// ---------------------------------------------------------------------------

function toon(color: number, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function buildAccessory(id: VrmAccessory, head: HeadMetrics): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `VrmAccessory_${id}`;
  const k = head.scale;
  switch (id) {
    case 'non_la': {
      // Vietnamese conical hat with a chin ribbon.
      // The rim rests on the hair a little above the brow.
      const rimY = head.top - 0.035 * k;
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.23 * k, 0.13 * k, 40, 1, true), toon(0xe8d29a));
      (hat.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      hat.position.y = rimY + 0.065 * k;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.228 * k, 0.006 * k, 6, 40), toon(0xcbb178));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = rimY;
      // Chin strap: a "U" from the sides of the head down under the chin.
      const chinY = head.eyes.y - 0.1 * k;
      const strapRadius = (rimY - chinY) * 0.5 + 0.05 * k;
      const ribbon = new THREE.Mesh(
        new THREE.TorusGeometry(strapRadius, 0.004 * k, 6, 24, Math.PI),
        toon(0xc0262d)
      );
      ribbon.scale.set(0.085 * k / strapRadius, 1, 1);
      ribbon.rotation.z = Math.PI;
      ribbon.position.set(0, chinY + strapRadius, 0.035 * k);
      group.add(hat, rim, ribbon);
      break;
    }
    case 'cap': {
      const red = toon(0xd62828, 0.7);
      // Anime hair is voluminous (radius ~16 cm): the crown sits over it.
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(0.155 * k, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        red
      );
      crown.scale.set(1, 0.72, 1.08);
      crown.position.y = head.top - 0.005 * k;
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11 * k, 0.11 * k, 0.012 * k, 32, 1, false, -Math.PI / 2, Math.PI),
        red
      );
      brim.scale.set(1, 1, 1.1);
      brim.position.set(0, head.top - 0.002 * k, 0.13 * k);
      brim.rotation.x = 0.15;
      group.add(crown, brim);
      break;
    }
    case 'sunglasses': {
      const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.05, metalness: 0.3, clearcoat: 1 });
      const frameMat = toon(0x1a1a1a, 0.4);
      const lensGeo = new THREE.CircleGeometry(0.026 * k, 24);
      const front = head.eyes.z + 0.02 * k;
      for (const side of [-1, 1]) {
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.set(side * head.eyeSpacing, head.eyes.y, front);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026 * k, 0.0035 * k, 6, 24), frameMat);
        ring.position.copy(lens.position);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.004 * k, 0.004 * k, 0.12 * k), frameMat);
        arm.position.set(side * (head.eyeSpacing + 0.045 * k), head.eyes.y + 0.004 * k, front - 0.06 * k);
        arm.rotation.y = side * 0.25;
        group.add(lens, ring, arm);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(head.eyeSpacing * 2 - 0.052 * k, 0.004 * k, 0.004 * k), frameMat);
      bridge.position.set(0, head.eyes.y + 0.006 * k, front);
      group.add(bridge);
      break;
    }
    case 'headband': {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.15 * k, 0.013 * k, 8, 48), toon(0xff4fa3, 0.6));
      band.scale.set(1, 1, 1.1);
      band.rotation.x = Math.PI / 2 - 0.4;
      band.position.set(0, head.top - 0.02 * k, 0.0);
      group.add(band);
      break;
    }
    case 'scarf': {
      // Checkered "khăn rằn" around the neck (drawn on a small canvas).
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#1f1f1f' : '#f2f2f2';
          ctx.fillRect(x * 8, y * 8, 8, 8);
        }
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(6, 1);
      const scarf = new THREE.Mesh(
        new THREE.TorusGeometry(0.075 * k, 0.025 * k, 10, 40),
        new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 })
      );
      scarf.rotation.x = Math.PI / 2;
      scarf.position.y = head.neckY;
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05 * k, 0.12 * k, 0.012 * k), scarf.material);
      tail.position.set(0.035 * k, head.neckY - 0.06 * k, 0.08 * k);
      tail.rotation.z = 0.25;
      group.add(scarf, tail);
      break;
    }
  }
  group.traverse((object) => {
    object.castShadow = true;
  });
  return group;
}

interface HeadMetrics {
  /** Top of the hair, relative to the head bone (head-local, face toward +Z). */
  top: number;
  eyes: THREE.Vector3;
  eyeSpacing: number;
  neckY: number;
  scale: number;
}

function measureHead(vrm: VRM, headNode: THREE.Object3D, faceSign: number): HeadMetrics {
  vrm.scene.updateMatrixWorld(true);
  const headWorld = headNode.getWorldPosition(new THREE.Vector3());
  const box = new THREE.Box3().setFromObject(vrm.scene);
  const sceneScale = vrm.scene.getWorldScale(new THREE.Vector3()).y || 1;
  const height = (box.max.y - box.min.y) / sceneScale;
  const scale = THREE.MathUtils.clamp(height / 1.6, 0.6, 1.5);
  const offset = vrm.lookAt?.offsetFromHeadBone ?? new THREE.Vector3(0, 0.06, 0.02);
  // In front of the eyes (accessory space faces +Z whatever the VRM version).
  // VRoid eyes sit ~8 cm in front of the head bone (offsetFromHeadBone.z is usually 0).
  const eyes = new THREE.Vector3(0, offset.y || 0.06 * scale, Math.abs(offset.z) + 0.085 * scale);
  // Top of the hair from the eye height: the scene's bounding box is thrown off
  // by spiky / long hair, the eyes are a steady landmark on every VRoid head.
  const top = eyes.y + 0.1 * scale;
  const neck = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Neck);
  const neckY = neck ? -(headWorld.y - neck.getWorldPosition(new THREE.Vector3()).y) / sceneScale + 0.02 * scale : -0.08 * scale;
  return { top, eyes, eyeSpacing: 0.032 * scale, neckY, scale };
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export interface VrmOutfitController {
  apply: (outfit: VrmOutfit) => void;
  /** Multiplier for the skin colour (used by the drunk flush in vrmCharacter). */
  skinTint: THREE.Color;
  dispose: () => void;
}

/**
 * @param faceSign +1 when the normalized head faces +Z (VRM 1.0), -1 for VRM 0.x.
 */
export function createVrmOutfitController(vrm: VRM, faceSign: number): VrmOutfitController {
  const originals = new Map<TexturedMaterial, { map: THREE.Texture | null; shade: THREE.Texture | null }>();
  const byPart = new Map<VrmOutfitPart, TexturedMaterial[]>();
  vrm.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
      const textured = material as TexturedMaterial;
      const part = partOf(material.name);
      if (!part || !textured.map || originals.has(textured)) return;
      originals.set(textured, { map: textured.map, shade: textured.shadeMultiplyTexture ?? null });
      const list = byPart.get(part) ?? [];
      list.push(textured);
      byPart.set(part, list);
    });
  });

  const head = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);
  const accessoryRoot = new THREE.Group();
  accessoryRoot.name = 'VrmAccessories';
  // Accessories are authored facing +Z; VRM 0.x heads face -Z locally.
  if (faceSign < 0) accessoryRoot.rotation.y = Math.PI;
  head?.add(accessoryRoot);
  const metrics = head ? measureHead(vrm, head, faceSign) : null;
  const built = new Map<VrmAccessory, THREE.Object3D>();

  const skinTint = new THREE.Color(1, 1, 1);
  const applied: Partial<Record<VrmOutfitPart, string | null>> = {};

  const apply = (outfit: VrmOutfit) => {
    for (const [part, materials] of byPart) {
      const hex = outfit.colors[part] ?? null;
      if (applied[part] === hex) continue;
      applied[part] = hex;
      materials.forEach((material) => {
        const original = originals.get(material)!;
        const colorized = hex && original.map ? colorizeTexture(original.map, hex) : null;
        material.map = colorized ?? original.map;
        if (original.shade && original.shade === original.map) material.shadeMultiplyTexture = material.map;
        material.needsUpdate = true;
      });
    }

    if (outfit.skinTone) skinTint.set(outfit.skinTone);
    else skinTint.setRGB(1, 1, 1);

    for (const [id, object] of built) {
      object.visible = outfit.accessories.includes(id);
    }
    if (metrics) {
      for (const id of outfit.accessories) {
        if (built.has(id)) continue;
        const object = buildAccessory(id, metrics);
        built.set(id, object);
        accessoryRoot.add(object);
      }
    }
  };

  return {
    apply,
    skinTint,
    dispose: () => {
      accessoryRoot.removeFromParent();
      accessoryRoot.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => material.dispose());
      });
    },
  };
}
