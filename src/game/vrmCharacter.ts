/**
 * VRM characters (VRoid Studio exports) driven by @pixiv/three-vrm.
 *
 * Dev Mode prototype: the rig is posed through the VRM *normalized* humanoid
 * bones, whose rest pose is a T-pose facing +Z with identity rotations on
 * every bone. That gives the same, predictable axes on any VRoid model, so the
 * seated / drinking poses below work without per-model tuning.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  VRM,
  VRMExpressionPresetName,
  VRMHumanBoneName,
  VRMLoaderPlugin,
  VRMUtils,
} from '@pixiv/three-vrm';
import { EMPTY_VRM_OUTFIT, createVrmOutfitController, type VrmOutfit } from './vrmOutfit';

export type VrmPose = 'seated' | 'standing' | 'walking' | 'running';

/**
 * Ground speed (m/s) that matches each gait's stride, so whoever moves
 * `root` (the Lab, later the game) keeps the feet from sliding.
 */
export const VRM_MOVE_SPEED: Record<VrmPose, number> = {
  seated: 0,
  standing: 0,
  walking: 1.15,
  running: 3.1,
};
export type VrmMood = 'neutral' | 'happy' | 'relaxed' | 'surprised' | 'sad' | 'angry';

export interface VrmCharacterState {
  pose: VrmPose;
  /** 0 - 100, same scale as Player.alcoholLevel. */
  alcohol: number;
  mood: VrmMood;
  /** Raises the mug for a "1, 2, 3 DZÔ!" while true. */
  cheers: boolean;
  /** Slumped over, eyes shut (game: Player.isPassedOut). */
  passedOut?: boolean;
}

export interface VrmCharacterOptions {
  /** Object held in the right hand instead of the built-in beer mug (e.g. the game's glass). */
  holdObject?: THREE.Object3D;
  /** Where `holdObject` sits in the grip, before the VRM 0.x mirror is applied. */
  holdOffset?: THREE.Vector3;
  outfit?: VrmOutfit;
  /** Rescale the model to this standing height in metres (VRoid sizes vary a lot). */
  targetHeight?: number;
}

export interface VrmCharacter {
  vrm: VRM;
  root: THREE.Group;
  /** Mug parented to the right hand. */
  mug: THREE.Group;
  state: VrmCharacterState;
  update: (delta: number, lookTarget?: THREE.Object3D) => void;
  /** Recolour clothes / hair / skin and toggle accessories. */
  setOutfit: (outfit: VrmOutfit) => void;
  /** Releases GPU resources. A `holdObject` is detached first and not disposed. */
  dispose: () => void;
}

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

/** Post-load clean-up shared by the WebGL and WebGPU loaders. */
export function prepareVrm(gltf: { scene: THREE.Group; userData: Record<string, unknown> }): VRM {
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) throw new Error('File này không phải model VRM hợp lệ.');
  // Faster rendering and a consistent +Z facing for VRM 0.x exports.
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((object) => {
    object.frustumCulled = false;
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return vrm;
}

/** Loads a .vrm (VRM 0.x or 1.0) from a URL or a dropped File. */
export async function loadVrm(source: string | File): Promise<VRM> {
  if (typeof source === 'string') return parseVrm(await fetchVrmBuffer(source));
  return parseVrm(await source.arrayBuffer());
}

const bufferCache = new Map<string, Promise<ArrayBuffer>>();

/** Downloads a .vrm once per page; every character then parses its own copy. */
export function fetchVrmBuffer(url: string): Promise<ArrayBuffer> {
  let pending = bufferCache.get(url);
  if (!pending) {
    pending = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Không tải được ${url} (${res.status})`);
      return res.arrayBuffer();
    });
    pending.catch(() => bufferCache.delete(url));
    bufferCache.set(url, pending);
  }
  return pending;
}

/** VRM scenes cannot be cloned safely (springs, expressions), so each character parses its own. */
export async function parseVrm(buffer: ArrayBuffer): Promise<VRM> {
  const gltf = await loader.parseAsync(buffer, '');
  return prepareVrm(gltf);
}

function createMug() {
  const mug = new THREE.Group();
  mug.name = 'VrmMug';
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.05,
    transmission: 0.6,
    transparent: true,
    opacity: 0.45,
  });
  const beer = new THREE.MeshStandardMaterial({ color: 0xf5b21b, roughness: 0.3, emissive: 0x3a2200 });
  const foam = new THREE.MeshStandardMaterial({ color: 0xfff8e7, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.12, 20), glass);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.031, 0.095, 20), beer);
  liquid.position.y = -0.008;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.034, 0.018, 20), foam);
  head.position.y = 0.046;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 8, 16, Math.PI), glass);
  handle.rotation.z = -Math.PI / 2;
  handle.position.x = 0.04;
  mug.add(body, liquid, head, handle);
  return mug;
}

type SkinMaterial = THREE.Material & { color?: THREE.Color; shadeColorFactor?: THREE.Color };

interface SkinEntry {
  material: SkinMaterial;
  base: THREE.Color;
  shadeBase?: THREE.Color;
  /** Faces blush harder than the body. */
  strength: number;
}

/** Skin materials of VRoid exports carry "SKIN" in their name (face and body). */
function collectSkinMaterials(vrm: VRM) {
  const materials: SkinEntry[] = [];
  vrm.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    list.forEach((material) => {
      const skin = material as SkinMaterial;
      if (!skin.color || !/skin/i.test(material.name) || /outline/i.test(material.name)) return;
      if (materials.some((entry) => entry.material === skin)) return;
      materials.push({
        material: skin,
        base: skin.color.clone(),
        // MToon paints most of the surface with its shade colour, so tint that too.
        shadeBase: skin.shadeColorFactor?.clone(),
        strength: /face/i.test(material.name) ? 1 : 0.6,
      });
    });
  });
  return materials;
}

// Right-arm key poses in the normalized rig (see the arm comments in update()).
const HOLD_UPPER = new THREE.Euler(0, 0.75, 1.2);
const CHEERS_UPPER = new THREE.Euler(0, 1.1, 0.55);
const HOLD_LOWER = new THREE.Euler(-0.75, 1.5, 0);
const CHEERS_LOWER = new THREE.Euler(0, 0.15, -1.9);
const HOLD_HAND = new THREE.Euler(0, 0, -0.15);
const CHEERS_HAND = new THREE.Euler(0, 0, 0.25);

const MOOD_PRESETS: Record<Exclude<VrmMood, 'neutral'>, VRMExpressionPresetName> = {
  happy: VRMExpressionPresetName.Happy,
  relaxed: VRMExpressionPresetName.Relaxed,
  surprised: VRMExpressionPresetName.Surprised,
  sad: VRMExpressionPresetName.Sad,
  angry: VRMExpressionPresetName.Angry,
};

/** Wraps a loaded VRM with the bar poses, blinking, drunk sway and flush. */
export function createVrmCharacter(
  vrm: VRM,
  initial?: Partial<VrmCharacterState>,
  options: VrmCharacterOptions = {}
): VrmCharacter {
  const root = new THREE.Group();
  root.name = 'VrmCharacter';
  root.add(vrm.scene);

  const state: VrmCharacterState = {
    pose: 'seated',
    alcohol: 0,
    mood: 'neutral',
    cheers: false,
    ...initial,
  };

  const humanoid = vrm.humanoid;
  // VRM 0.x rigs face -Z (rotateVRM0 only turns the scene), so their normalized
  // bones are this rig turned 180° about Y: flip the X and Z rotation components.
  const flip = vrm.meta?.metaVersion === '0' ? -1 : 1;
  const flipped = new THREE.Euler();
  const toRig = (euler: THREE.Euler) => flipped.set(euler.x * flip, euler.y, euler.z * flip);
  const bone = (name: VRMHumanBoneName) => humanoid.getNormalizedBoneNode(name);
  const hipsRest = bone(VRMHumanBoneName.Hips)?.position.clone() ?? new THREE.Vector3();

  // Optional height normalisation. The head bone sits at ~87% of body height.
  let modelScale = 1;
  if (options.targetHeight) {
    vrm.scene.updateMatrixWorld(true);
    const headNode = bone(VRMHumanBoneName.Head);
    const headY = headNode ? headNode.getWorldPosition(new THREE.Vector3()).y : 0;
    if (headY > 0.3) {
      modelScale = options.targetHeight / (headY / 0.87);
      vrm.scene.scale.setScalar(modelScale);
    }
  }

  // Seat height of the plastic stool (createPlasticStool) and the hips-to-seat
  // offset; the hips joint sits a little above where the thighs touch the seat.
  // Both are world metres, converted into the (possibly rescaled) rig's units.
  const SEAT_HEIGHT = 0.55 / modelScale;
  const hipsAboveSeat = 0.08;

  const mug = (options.holdObject as THREE.Group | undefined) ?? createMug();
  const rightHand = bone(VRMHumanBoneName.RightHand);
  if (rightHand) {
    rightHand.add(mug);
    // Palm faces inward/forward in the normalized rig; the mug sits in the grip.
    const grip = options.holdOffset ?? new THREE.Vector3(-0.07, -0.01, 0.045);
    mug.position.set(grip.x * flip, grip.y, grip.z * flip);
  }

  const skin = collectSkinMaterials(vrm);
  const outfit = createVrmOutfitController(vrm, flip);
  outfit.apply(options.outfit ?? EMPTY_VRM_OUTFIT);
  const tintedBase = new THREE.Color();
  const tintedShade = new THREE.Color();
  const flush = new THREE.Color(0xff5a5a);

  let time = Math.random() * 10;
  let blinkTimer = 2 + Math.random() * 3;
  let blinkPhase = 0;
  let seatedBlend = state.pose === 'seated' ? 1 : 0;
  let cheersBlend = 0;
  let passedBlend = state.passedOut ? 1 : 0;
  let walkBlend = 0;
  let runBlend = 0;
  let gaitPhase = 0;
  const swingQuat = new THREE.Quaternion();
  const xAxis = new THREE.Vector3(1, 0, 0);

  const parentWorld = new THREE.Quaternion();
  const rootWorld = new THREE.Quaternion();
  const mugUpright = new THREE.Quaternion();
  const mugEuler = new THREE.Euler();

  const blendFrom = new THREE.Quaternion();
  const blendTo = new THREE.Quaternion();
  const tremor = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const blendRotation = (
    name: VRMHumanBoneName,
    from: THREE.Euler,
    to: THREE.Euler,
    t: number,
    extraZ = 0
  ) => {
    const node = bone(name);
    if (!node) return;
    blendFrom.setFromEuler(toRig(from));
    blendTo.setFromEuler(toRig(to));
    node.quaternion.slerpQuaternions(blendFrom, blendTo, t);
    if (extraZ) node.quaternion.multiply(tremor.setFromAxisAngle(zAxis, extraZ * flip));
  };

  const setRotation = (name: VRMHumanBoneName, x: number, y: number, z: number) => {
    const node = bone(name);
    if (node) node.rotation.set(x * flip, y, z * flip);
  };

  const update = (delta: number, lookTarget?: THREE.Object3D) => {
    time += delta;
    const drunk = THREE.MathUtils.clamp(state.alcohol / 100, 0, 1);
    seatedBlend = THREE.MathUtils.damp(seatedBlend, state.pose === 'seated' ? 1 : 0, 6, delta);
    cheersBlend = THREE.MathUtils.damp(cheersBlend, state.cheers ? 1 : 0, 8, delta);
    const s = seatedBlend;
    const c = cheersBlend;

    // ---- Gait (walking / running), blended in and out ----
    walkBlend = THREE.MathUtils.damp(walkBlend, state.pose === 'walking' ? 1 : 0, 6, delta);
    runBlend = THREE.MathUtils.damp(runBlend, state.pose === 'running' ? 1 : 0, 6, delta);
    const m = Math.min(1, walkBlend + runBlend); // how much of the gait is applied
    const r = walkBlend + runBlend > 0.001 ? runBlend / (walkBlend + runBlend) : 0; // walk → run
    // Steps per second follow the speed; drunk legs drag a little.
    const cadence = THREE.MathUtils.lerp(0.95, 1.45, r) * (1 - drunk * 0.2);
    if (m > 0.001) gaitPhase += delta * Math.PI * 2 * cadence;
    const sinP = Math.sin(gaitPhase);
    const cosP = Math.cos(gaitPhase);
    const legSwing = THREE.MathUtils.lerp(0.42, 0.85, r) * m;
    const kneeLift = THREE.MathUtils.lerp(0.7, 1.5, r) * m;
    const kneeBase = THREE.MathUtils.lerp(0.06, 0.32, r) * m;
    const armSwing = THREE.MathUtils.lerp(0.4, 0.85, r) * m;

    // ---- Body: hips onto the stool, breathing, drunk sway ----
    const hips = bone(VRMHumanBoneName.Hips);
    const sway = Math.sin(time * 1.3) * 0.12 * drunk;
    if (hips) {
      const seatedY = SEAT_HEIGHT + hipsAboveSeat;
      // Highest when the legs pass under the body, lowest mid-stride.
      const bob = THREE.MathUtils.lerp(0.025, 0.06, r) * m * (Math.cos(gaitPhase * 2) - 1) * 0.5;
      hips.position.set(
        hipsRest.x + sway * 0.15 * flip,
        THREE.MathUtils.lerp(hipsRest.y, seatedY, s) + bob - 0.03 * r * m,
        hipsRest.z - 0.02 * s * flip
      );
      // Pelvis turns with the swinging leg.
      hips.rotation.set(0, sinP * 0.12 * m, sway * 0.35 * flip);
    }
    const breathe = Math.sin(time * 2.1) * 0.015;
    const lean = THREE.MathUtils.lerp(0.04, 0.26, r) * m; // runners lean into the run
    setRotation(VRMHumanBoneName.Spine, 0.04 * s + breathe + drunk * 0.12 + lean, -sinP * 0.06 * m, sway * 0.4);
    // Shoulders counter-rotate against the pelvis.
    setRotation(
      VRMHumanBoneName.Chest,
      0.03 * s + breathe,
      Math.sin(time * 0.7) * 0.03 * (1 - m) - sinP * 0.1 * m,
      sway * 0.3
    );
    setRotation(
      VRMHumanBoneName.Neck,
      drunk * 0.15,
      Math.sin(time * 0.9) * 0.05 * (1 + drunk * 2),
      Math.sin(time * 1.7) * 0.08 * drunk
    );
    setRotation(VRMHumanBoneName.Head, -0.12 * c + drunk * 0.1, 0, Math.sin(time * 1.1) * 0.12 * drunk);
    // Passed out: fold forward over the table, head hanging.
    passedBlend = THREE.MathUtils.damp(passedBlend, state.passedOut ? 1 : 0, 3, delta);
    if (passedBlend > 0.001) {
      const pb = passedBlend;
      bone(VRMHumanBoneName.Spine)?.rotateX(0.55 * pb * flip);
      bone(VRMHumanBoneName.Chest)?.rotateX(0.25 * pb * flip);
      bone(VRMHumanBoneName.Neck)?.rotateX(0.35 * pb * flip);
      bone(VRMHumanBoneName.Head)?.rotateZ(0.35 * pb * flip);
    }

    // ---- Legs: thighs forward, shins down, feet a little apart ----
    const thigh = -1.45 * s;
    const knee = 1.38 * s;
    // Gait: thighs swing opposite each other (negative X = forward); the knee
    // folds while that leg swings forward and straightens to plant the foot.
    setRotation(VRMHumanBoneName.LeftUpperLeg, thigh - legSwing * sinP, 0, -0.08 * s);
    setRotation(VRMHumanBoneName.RightUpperLeg, thigh + legSwing * sinP, 0, 0.08 * s);
    setRotation(VRMHumanBoneName.LeftLowerLeg, knee + kneeBase + kneeLift * Math.max(0, cosP), 0, 0);
    setRotation(VRMHumanBoneName.RightLowerLeg, knee + kneeBase + kneeLift * Math.max(0, -cosP), 0, 0);
    setRotation(VRMHumanBoneName.LeftFoot, 0.1 * s + 0.25 * m * Math.max(0, cosP), 0, 0);
    setRotation(VRMHumanBoneName.RightFoot, 0.1 * s + 0.25 * m * Math.max(0, -cosP), 0, 0);

    // ---- Arms (normalized T-pose: left arm along +X, right along -X) ----
    // Left: relaxed down, forearm resting forward on the thigh/table edge.
    const leftDown = THREE.MathUtils.lerp(-1.25, -1.15, s);
    // Arms swing opposite the legs; running bends the elbow to ~90°.
    setRotation(VRMHumanBoneName.LeftUpperArm, armSwing * sinP, -0.25 * s, leftDown + 0.1 * m);
    setRotation(VRMHumanBoneName.LeftLowerArm, 0, -1.1 * s - 0.15 - THREE.MathUtils.lerp(0.2, 1.25, r) * m, 0);
    setRotation(VRMHumanBoneName.LeftHand, 0, 0, 0.1);

    // Right: holding the mug in front of the chest; cheers lifts it up.
    const mugTremor = Math.sin(time * 9) * 0.03 * drunk;
    // Holding: forearm forward and tilted up so the mug sits at chest height.
    // Cheers: elbow in front, forearm straight up to raise the mug high.
    // Slerp between the two so the arm doesn't swing out sideways mid-way.
    blendRotation(VRMHumanBoneName.RightUpperArm, HOLD_UPPER, CHEERS_UPPER, c, mugTremor);
    // The mug arm swings too, just less (don't spill the beer).
    bone(VRMHumanBoneName.RightUpperArm)?.quaternion.premultiply(
      swingQuat.setFromAxisAngle(xAxis, -armSwing * 0.5 * sinP * (1 - c) * flip)
    );
    blendRotation(VRMHumanBoneName.RightLowerArm, HOLD_LOWER, CHEERS_LOWER, c);
    blendRotation(VRMHumanBoneName.RightHand, HOLD_HAND, CHEERS_HAND, c);
    // Curl the fingers around the mug.
    for (const finger of ['Index', 'Middle', 'Ring', 'Little'] as const) {
      for (const joint of ['Proximal', 'Intermediate', 'Distal'] as const) {
        const name = `right${finger}${joint}` as VRMHumanBoneName;
        setRotation(name, 0, 0, 0.9);
        setRotation(`left${finger}${joint}` as VRMHumanBoneName, 0, 0, -0.25);
      }
    }
    setRotation(VRMHumanBoneName.RightThumbProximal, 0, -0.4, 0);

    // ---- Face: blinking, mood, drunk eyes ----
    const expressions = vrm.expressionManager;
    if (expressions) {
      blinkTimer -= delta;
      if (blinkTimer <= 0) {
        blinkPhase = 1;
        blinkTimer = 2 + Math.random() * 4 - drunk;
      }
      blinkPhase = Math.max(0, blinkPhase - delta * 7);
      const halfLidded = drunk > 0.45 ? (drunk - 0.45) * 0.9 : 0;
      expressions.setValue(
        VRMExpressionPresetName.Blink,
        Math.max(passedBlend, Math.min(1, Math.sin(blinkPhase * Math.PI) + halfLidded))
      );
      for (const [mood, preset] of Object.entries(MOOD_PRESETS)) {
        const target = state.mood === mood ? 1 : 0;
        const current = expressions.getValue(preset) ?? 0;
        expressions.setValue(preset, THREE.MathUtils.damp(current, target, 10, delta));
      }
      // Very drunk: a loose, relaxed face unless a mood is picked.
      if (state.mood === 'neutral' && drunk > 0.6) {
        expressions.setValue(VRMExpressionPresetName.Relaxed, (drunk - 0.6) * 1.5);
      }
      expressions.setValue(VRMExpressionPresetName.Aa, c * 0.6);
    }

    // Red cheeks and skin as the alcohol rises.
    const flushAmount = Math.min(0.5, drunk * 0.5);
    skin.forEach(({ material, base, shadeBase, strength }) => {
      tintedBase.copy(base).multiply(outfit.skinTint);
      material.color?.copy(tintedBase).lerp(flush, flushAmount * strength);
      if (shadeBase) {
        tintedShade.copy(shadeBase).multiply(outfit.skinTint);
        material.shadeColorFactor?.copy(tintedShade).lerp(flush, flushAmount * strength);
      }
    });

    if (vrm.lookAt) vrm.lookAt.target = lookTarget ?? null;
    vrm.update(delta);

    // Keep the beer upright whatever the wrist does (a little spill-tilt when drunk).
    if (mug.parent) {
      mug.parent.getWorldQuaternion(parentWorld);
      mugUpright.setFromEuler(mugEuler.set(Math.sin(time * 2.3) * 0.15 * drunk, root.rotation.y, 0));
      rootWorld.identity();
      root.parent?.getWorldQuaternion(rootWorld);
      mug.quaternion.copy(parentWorld.invert()).multiply(rootWorld).multiply(mugUpright);
    }
  };

  // Pose first, then restart the hair/skirt springs from that pose so they
  // don't whip upward from the T-pose on the first frames.
  seatedBlend = state.pose === 'seated' ? 1 : 0;
  update(0);
  vrm.springBoneManager?.reset();

  return {
    vrm,
    root,
    mug,
    state,
    update,
    setOutfit: (next: VrmOutfit) => outfit.apply(next),
    dispose: () => {
      // The caller owns a provided holdObject (e.g. the game glass), so it is not disposed.
      if (options.holdObject) options.holdObject.removeFromParent();
      outfit.dispose();
      root.remove(vrm.scene);
      VRMUtils.deepDispose(vrm.scene);
    },
  };
}
