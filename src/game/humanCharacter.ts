import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import {
  DEFAULT_HUMAN_APPEARANCE,
  HUMAN_SKIN_TONES,
  normalizeChibiAppearance,
  type ChibiAppearanceDNA,
  type HumanHairStyle,
  type HumanTopStyle,
} from '../../shared/appearance';
import { createChibiCharacter, type CharacterRig } from './characterModel';
import type { CharacterAvatar, ClothingType, GlassType, HatType } from './types';

const ASSET_ROOT = '/assets/characters/human/optimized';

export interface HumanCharacterAssets {
  body: THREE.Group;
  hair: Record<HumanHairStyle, THREE.Group>;
  tops: Record<HumanTopStyle, THREE.Group>;
  jeans: THREE.Group;
  shoes: THREE.Group;
  joints: {
    morphs: Record<string, Record<string, [number, number, number]>>;
  };
}

let assetsPromise: Promise<HumanCharacterAssets> | null = null;

async function loadScene(loader: GLTFLoader, file: string) {
  const gltf = await loader.loadAsync(`${ASSET_ROOT}/${file}`);
  return gltf.scene;
}

/** Loads the CC0 MakeHuman body and modular hair/clothing meshes once per page. */
export function loadHumanCharacterAssets(): Promise<HumanCharacterAssets> {
  if (!assetsPromise) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    assetsPromise = Promise.all([
      loadScene(loader, 'base_body.glb'),
      loadScene(loader, 'hair_short02.glb'),
      loadScene(loader, 'hair_bob02.glb'),
      loadScene(loader, 'hair_long01.glb'),
      loadScene(loader, 'clothing_tshirt.glb'),
      loadScene(loader, 'clothing_hoodie.glb'),
      loadScene(loader, 'clothing_jeans.glb'),
      loadScene(loader, 'clothing_shoes.glb'),
      fetch('/assets/characters/human/base_body.joints.json').then((response) => {
        if (!response.ok) throw new Error('Human rig morph data failed to load');
        return response.json() as Promise<HumanCharacterAssets['joints']>;
      }),
    ]).then(([body, short02, bob02, long01, tshirt, hoodie, jeans, shoes, joints]) => ({
      body,
      hair: { short02, bob02, long01 },
      tops: { tshirt, hoodie },
      jeans,
      shoes,
      joints,
    }));
  }
  return assetsPromise;
}

/*
 * Zone bits baked into the `_CCZONE` vertex attribute of the source assets
 * (CharacterCreator clothing.json `bodyZones`). A body or lower-layer garment
 * triangle is dropped when all three of its vertices are covered by a worn
 * garment, which stops skin from poking through clothes when the joints bend.
 */
const GARMENT_ZONES = { shoes: 1, jeans: 2, tshirt: 8, hoodie: 1024 } as const;
const GARMENT_LAYERS = { shoes: 1, jeans: 2, tshirt: 3, hoodie: 4 } as const;
type GarmentId = keyof typeof GARMENT_ZONES;

const fullIndexCache = new WeakMap<THREE.BufferGeometry, THREE.BufferAttribute>();
const maskedGeometryCache = new WeakMap<THREE.BufferGeometry, Map<number, THREE.BufferGeometry>>();

function maskedGeometry(source: THREE.BufferGeometry, mask: number) {
  const zone = source.getAttribute('_cczone') as THREE.BufferAttribute | undefined;
  const fullIndex = fullIndexCache.get(source) || source.index;
  if (!zone || !fullIndex || !mask) return source;
  fullIndexCache.set(source, fullIndex);
  let byMask = maskedGeometryCache.get(source);
  if (!byMask) {
    byMask = new Map();
    maskedGeometryCache.set(source, byMask);
  }
  const cached = byMask.get(mask);
  if (cached) return cached;

  const covered = (vertex: number) => (Math.round(zone.getX(vertex)) & mask) !== 0;
  const kept: number[] = [];
  for (let i = 0; i < fullIndex.count; i += 3) {
    const a = fullIndex.getX(i);
    const b = fullIndex.getX(i + 1);
    const c = fullIndex.getX(i + 2);
    if (covered(a) && covered(b) && covered(c)) continue;
    kept.push(a, b, c);
  }
  // Share every vertex/morph buffer with the source and only swap the index,
  // so each outfit variant costs one small index array.
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
  geometry.morphAttributes = source.morphAttributes;
  geometry.morphTargetsRelative = source.morphTargetsRelative;
  geometry.setIndex(kept);
  geometry.boundingBox = source.boundingBox;
  geometry.boundingSphere = source.boundingSphere;
  byMask.set(mask, geometry);
  return geometry;
}

function applyZoneMask(root: THREE.Object3D, mask: number) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const source = (mesh.userData.zoneSourceGeometry as THREE.BufferGeometry | undefined) || mesh.geometry;
    mesh.userData.zoneSourceGeometry = source;
    mesh.geometry = maskedGeometry(source, mask);
  });
}

function wornZoneMask(worn: GarmentId[], above?: GarmentId) {
  return worn.reduce(
    (mask, id) =>
      above && GARMENT_LAYERS[id] <= GARMENT_LAYERS[above] ? mask : mask | GARMENT_ZONES[id],
    0
  );
}

function tintGain(material: THREE.Material) {
  const gain = Number((material.userData?.tint as { gain?: number } | undefined)?.gain);
  return gain > 0 ? gain : 1;
}

/** Physically based upgrade of the plain glTF materials, keeping maps and tint metadata. */
function upgradeMaterial(material: THREE.Material): THREE.Material {
  if (!(material instanceof THREE.MeshStandardMaterial)) return material.clone();
  const name = material.name.toLowerCase();
  const physical = new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(physical, material);
  physical.userData = { ...material.userData };
  physical.envMapIntensity = 0.55;

  if (name === 'skin') {
    // Soft red-tinted sheen approximates light scattering under the skin and
    // removes the plastic look of a plain standard material.
    physical.roughness = 0.56;
    physical.specularIntensity = 0.42;
    physical.specularColor.setRGB(1, 0.92, 0.88);
    physical.sheen = 0.25;
    physical.sheenRoughness = 0.5;
    physical.sheenColor.setRGB(0.5, 0.16, 0.1);
    physical.envMapIntensity = 0.38;
    if (physical.normalMap) physical.normalScale.setScalar(0.85);
  } else if (name.startsWith('hair')) {
    physical.roughness = 0.5;
    physical.specularIntensity = 0.6;
    physical.alphaTest = 0.32;
    physical.alphaToCoverage = true;
    physical.transparent = false;
    physical.depthWrite = true;
    physical.side = THREE.DoubleSide;
    physical.envMapIntensity = 0.3;
  } else if (name === 'eyebrow' || name === 'eyelash') {
    // Soft blended edges read as fine hairs; alpha-tested cards look like dots.
    physical.alphaTest = 0.02;
    physical.transparent = true;
    physical.depthWrite = false;
    physical.roughness = 0.7;
    physical.envMapIntensity = 0.1;
  } else if (name === 'cornea') {
    // A clear, glossy coat over the eyes gives them catchlights instead of a dull matte look.
    physical.roughness = 0.02;
    physical.clearcoat = 1;
    physical.clearcoatRoughness = 0.02;
    physical.specularIntensity = 1;
    physical.opacity = 0.05;
    physical.depthWrite = false;
    physical.envMapIntensity = 1;
  } else if (name === 'eye' || name === 'iris') {
    physical.roughness = 0.35;
    physical.envMapIntensity = 0.25;
  } else if (name === 'teeth') {
    physical.roughness = 0.3;
    physical.color.setRGB(0.86, 0.83, 0.78);
    physical.envMapIntensity = 0.3;
  } else if (name.startsWith('cloth_')) {
    physical.envMapIntensity = 0.25;
    physical.specularIntensity = name === 'cloth_shoes' ? 0.7 : 0.25;
  }
  return physical;
}

function cloneMaterials(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(upgradeMaterial);
    } else {
      mesh.material = upgradeMaterial(mesh.material);
    }
    mesh.onBeforeRender = bindSceneEnvironment;
  });
}

/*
 * three.js ignores material.envMapIntensity for scene.environment lighting, so
 * bind the scene environment to each material explicitly. Otherwise the bright
 * studio environment flattens and washes out skin, hair, and fabric.
 */
function bindSceneEnvironment(
  this: THREE.Mesh,
  _renderer: THREE.WebGLRenderer,
  scene: THREE.Scene
) {
  const environment = scene.environment;
  const materials = Array.isArray(this.material) ? this.material : [this.material];
  materials.forEach((material) => {
    const standard = material as THREE.MeshStandardMaterial;
    if (!standard.isMeshStandardMaterial || standard.envMap === environment) return;
    standard.envMap = environment;
    standard.needsUpdate = true;
  });
}

function getBodyBones(root: THREE.Object3D) {
  const bones = new Map<string, THREE.Bone>();
  root.traverse((object) => {
    const bone = object as THREE.Bone;
    if (bone.isBone) bones.set(bone.name, bone);
  });
  return bones;
}

function getBoneDirectionInFrame(
  bone: THREE.Bone,
  child: THREE.Bone,
  inverseFrameWorld: THREE.Quaternion
) {
  const bonePosition = bone.getWorldPosition(new THREE.Vector3());
  const childPosition = child.getWorldPosition(new THREE.Vector3());
  return childPosition.sub(bonePosition).applyQuaternion(inverseFrameWorld).normalize();
}

function applyNaturalFingerCurl(bones: Map<string, THREE.Bone>) {
  const xAxis = new THREE.Vector3(1, 0, 0);
  const zAxis = new THREE.Vector3(0, 0, 1);
  const flex = new THREE.Quaternion();
  const opposition = new THREE.Quaternion();
  const relaxedCurl = {
    index: [0.04, 0.11, 0.09],
    middle: [0.05, 0.14, 0.11],
    ring: [0.07, 0.17, 0.12],
    pinky: [0.09, 0.2, 0.13],
  } as const;
  const mugGripCurl = {
    index: [0.1, 0.17, 0.13],
    middle: [0.12, 0.2, 0.14],
    ring: [0.14, 0.22, 0.16],
    pinky: [0.16, 0.24, 0.16],
  } as const;

  (['l', 'r'] as const).forEach((side) => {
    const hand = bones.get(`hand_${side}`);
    if (hand) hand.scale.set(1.08, 0.9, 1.04);

    const digitCurl = side === 'r' ? mugGripCurl : relaxedCurl;
    for (const [digit, joints] of Object.entries(digitCurl)) {
      joints.forEach((amount, index) => {
        const bone = bones.get(`${digit}_${String(index + 1).padStart(2, '0')}_${side}`);
        if (!bone) return;
        // Shorten the phalanges along their local length axis; the source hands
        // read too narrow and elongated at the game's camera distance.
        bone.scale.y *= 0.94;
        flex.setFromAxisAngle(xAxis, amount);
        bone.quaternion.multiply(flex);
      });
    }

    const thumbBase = bones.get(`thumb_01_${side}`);
    const thumbMiddle = bones.get(`thumb_02_${side}`);
    const thumbTip = bones.get(`thumb_03_${side}`);
    if (thumbBase) {
      thumbBase.scale.y *= 0.94;
      flex.setFromAxisAngle(xAxis, 0.05);
      opposition.setFromAxisAngle(zAxis, side === 'l' ? 0.15 : -0.15);
      thumbBase.quaternion.multiply(flex).multiply(opposition);
    }
    [thumbMiddle, thumbTip].forEach((bone, index) => {
      if (!bone) return;
      bone.scale.y *= 0.94;
      flex.setFromAxisAngle(xAxis, index === 0 ? 0.12 : 0.08);
      bone.quaternion.multiply(flex);
    });
  });
}

function attachSkinnedAsset(
  template: THREE.Group,
  parent: THREE.Object3D,
  bodyBones: Map<string, THREE.Bone>,
  morphWeights: Record<string, number>,
  jointRig: JointOffsetRig
) {
  const accessory = cloneSkinned(template) as THREE.Group;
  cloneMaterials(accessory);
  accessory.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const bones = mesh.skeleton.bones.map((bone) => bodyBones.get(bone.name) || bone);
    mesh.bind(new THREE.Skeleton(bones, mesh.skeleton.boneInverses), mesh.bindMatrix);
  });
  parent.add(accessory);
  registerJointSkeletons(jointRig, accessory);
  applyMorphWeights(accessory, morphWeights);
  return accessory;
}

function sliderPair(value: number, prefix: string) {
  const normalized = THREE.MathUtils.clamp(value / 100, 0, 1);
  return {
    [`${prefix}_decr`]: Math.max(0, (0.5 - normalized) * 2),
    [`${prefix}_incr`]: Math.max(0, (normalized - 0.5) * 2),
  };
}

function makeMorphWeights(appearance: ChibiAppearanceDNA, bladderLevel = 0) {
  const bodyWeight = Math.min(100, appearance.bodyWeight + bladderLevel * 0.4);
  const weights: Record<string, number> = {
    gender_male: appearance.gender === 'male' ? 1 : 0,
    gender_female: appearance.gender === 'female' ? 1 : 0,
    age_child: 0,
    age_old: appearance.age / 100,
    weight_min: Math.max(0, (50 - bodyWeight) / 50),
    weight_max: Math.max(0, (bodyWeight - 50) / 50),
    muscle_min: Math.max(0, (50 - appearance.muscle) / 50),
    muscle_max: Math.max(0, (appearance.muscle - 50) / 50),
    height_short: Math.max(0, (50 - appearance.height) / 50),
    // The tall macro target adds ~0.7 m at full strength; cap it like the source viewer.
    height_tall: Math.max(0, (appearance.height - 50) / 50) * 0.45,
    proportions_ideal: 1,
    proportions_uncommon: 0,
    breast_cup_min: 0,
    breast_cup_max: appearance.gender === 'female' ? 0.35 : 0,
    breast_firm_min: 0,
    breast_firm_max: appearance.gender === 'female' ? 0.45 : 0,
    blink_left: 0,
    blink_right: 0,
    look_left: 0,
    look_right: 0,
    look_up: 0,
    look_down: 0,
  };
  Object.assign(
    weights,
    sliderPair(appearance.faceNoseWidth, 'face_nose_width'),
    sliderPair(appearance.faceNoseLength, 'face_nose_length'),
    sliderPair(appearance.faceNoseHeight, 'face_nose_height'),
    sliderPair(appearance.faceJawWidth, 'face_jaw_width'),
    sliderPair(appearance.faceChin, 'face_chin'),
    sliderPair(appearance.faceCheekbones, 'face_cheekbones'),
    sliderPair(appearance.faceEyeSize, 'face_eye_size'),
    sliderPair(appearance.faceEyeSpacing, 'face_eye_spacing'),
    sliderPair(appearance.faceEyeTilt, 'face_eye_tilt'),
    sliderPair(appearance.faceLips, 'face_lips'),
    sliderPair(appearance.faceMouthWidth, 'face_mouth_width'),
    sliderPair(appearance.faceEarSize, 'face_ear_size'),
    sliderPair(appearance.faceForehead, 'face_forehead')
  );

  return weights;
}

function applyMorphWeights(root: THREE.Object3D, weights: Record<string, number>) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
    for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
      const weight = resolveMorphWeight(name, weights);
      if (weight === undefined) continue;
      mesh.morphTargetInfluences[index] = weight;
    }
  });
}

function resolveMorphWeight(name: string, weights: Record<string, number>) {
  if (!name.startsWith('corr_')) return weights[name];
  const pair = name.slice(5);
  const split = pair.lastIndexOf('__');
  if (split < 0) return 0;
  const first = pair.slice(0, split);
  const second = pair.slice(split + 2);
  return (weights[first] || 0) * (weights[second] || 0);
}

/*
 * The joint data stores, per body morph, how far each joint head moves in
 * model space. Moving a joint changes where the already-morphed mesh is
 * skinned from, so the bind (inverse) matrices are rebased by the same offset;
 * otherwise the mesh is deformed twice (bloated torsos, stretched fingers).
 */
interface JointOffsetRig {
  bones: Map<string, THREE.Bone>;
  rest: Map<string, { position: THREE.Vector3; toParent: THREE.Matrix3; parent?: string }>;
  deltas: Map<string, THREE.Vector3>;
  skeletons: Map<THREE.Skeleton, THREE.Matrix4[]>;
}

function createJointOffsetRig(root: THREE.Object3D, bones: Map<string, THREE.Bone>): JointOffsetRig {
  root.updateMatrixWorld(true);
  const rootInverse = root.matrixWorld.clone().invert();
  const parentMatrix = new THREE.Matrix4();
  const rest: JointOffsetRig['rest'] = new Map();
  for (const [name, bone] of bones) {
    const parent = bone.parent;
    parentMatrix.copy(rootInverse);
    if (parent) parentMatrix.multiply(parent.matrixWorld);
    rest.set(name, {
      position: bone.position.clone(),
      toParent: new THREE.Matrix3().setFromMatrix4(parentMatrix).invert(),
      parent: (parent as THREE.Bone | null)?.isBone ? parent!.name : undefined,
    });
  }
  return { bones, rest, deltas: new Map(), skeletons: new Map() };
}

const rebaseTranslation = new THREE.Matrix4();

function rebaseSkeleton(rig: JointOffsetRig, skeleton: THREE.Skeleton, original: THREE.Matrix4[]) {
  skeleton.bones.forEach((bone, index) => {
    const delta = rig.deltas.get(bone.name);
    const inverse = skeleton.boneInverses[index];
    inverse.copy(original[index]);
    if (delta) inverse.multiply(rebaseTranslation.makeTranslation(-delta.x, -delta.y, -delta.z));
  });
}

/** Gives every skinned mesh under `root` its own bind matrices and applies the current joint offsets. */
function registerJointSkeletons(rig: JointOffsetRig, root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || rig.skeletons.has(mesh.skeleton)) return;
    // Cloned skeletons share their inverse arrays with the template; detach them first.
    const original = mesh.skeleton.boneInverses.map((matrix) => matrix.clone());
    mesh.skeleton.boneInverses = original.map((matrix) => matrix.clone());
    rig.skeletons.set(mesh.skeleton, original);
    rebaseSkeleton(rig, mesh.skeleton, original);
  });
}

function unregisterJointSkeletons(rig: JointOffsetRig, root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) rig.skeletons.delete(mesh.skeleton);
  });
}

function applyJointOffsets(
  rig: JointOffsetRig,
  joints: HumanCharacterAssets['joints'],
  weights: Record<string, number>
) {
  rig.deltas.clear();
  for (const [morph, boneOffsets] of Object.entries(joints.morphs)) {
    const weight = resolveMorphWeight(morph, weights) || 0;
    if (Math.abs(weight) < 0.00001) continue;
    for (const [boneName, values] of Object.entries(boneOffsets)) {
      let offset = rig.deltas.get(boneName);
      if (!offset) {
        offset = new THREE.Vector3();
        rig.deltas.set(boneName, offset);
      }
      offset.x += values[0] * weight;
      offset.y += values[1] * weight;
      offset.z += values[2] * weight;
    }
  }
  const local = new THREE.Vector3();
  for (const [name, bone] of rig.bones) {
    const rest = rig.rest.get(name);
    if (!rest) continue;
    bone.position.copy(rest.position);
    const delta = rig.deltas.get(name);
    if (!delta) continue;
    // The parent's own move is inherited, so only the difference is applied locally.
    local.copy(delta);
    const parentDelta = rest.parent ? rig.deltas.get(rest.parent) : undefined;
    if (parentDelta) local.sub(parentDelta);
    bone.position.add(local.applyMatrix3(rest.toParent));
  }
  for (const [skeleton, original] of rig.skeletons) rebaseSkeleton(rig, skeleton, original);
}

const SEATED_CALF_ANGLE = -0.22;

const hairColors: Record<ChibiAppearanceDNA['hairColor'], number> = {
  natural: 0x34231d,
  black: 0x171311,
  dark_brown: 0x34231d,
  brown: 0x65432e,
  blonde: 0xa98654,
};

export function createHumanCharacter(
  assets: HumanCharacterAssets,
  avatar: CharacterAvatar,
  clothing: ClothingType,
  hat: HatType,
  glassType: GlassType,
  appearanceValue: ChibiAppearanceDNA = DEFAULT_HUMAN_APPEARANCE
): CharacterRig {
  let appearance = normalizeChibiAppearance({ ...appearanceValue, characterStyle: 'human' });
  const rig = createChibiCharacter(avatar, clothing, hat, glassType, appearance);

  // Retain the established nameplate, mug controls, and animation state while
  // replacing every procedural animal mesh with a skinned human model.
  rig.root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) mesh.visible = false;
  });

  const body = cloneSkinned(assets.body) as THREE.Group;
  cloneMaterials(body);
  const bodyBones = getBodyBones(body);
  // Capture the bind-pose joint frames before the finger pose changes them.
  const jointRig = createJointOffsetRig(body, bodyBones);
  registerJointSkeletons(jointRig, body);
  applyNaturalFingerCurl(bodyBones);
  const visualRoot = new THREE.Group();
  visualRoot.name = 'HumanCharacterVisual';
  // The GLB is authored in a standing pose with its pelvis above the stool
  // pivot. Lower it so the hips sit at the same height as the game's seat rig.
  visualRoot.position.y = -0.77;
  visualRoot.scale.setScalar(0.88);
  visualRoot.add(body);
  rig.body.add(visualRoot);

  const weights = makeMorphWeights(appearance);
  applyJointOffsets(jointRig, assets.joints, weights);
  let currentAppearanceKey = JSON.stringify(appearance);
  let lastJointOffsetKey = `${currentAppearanceKey}:0`;
  applyMorphWeights(body, weights);
  let hair = attachSkinnedAsset(assets.hair[appearance.hairStyle], visualRoot, bodyBones, weights, jointRig);
  let top = attachSkinnedAsset(assets.tops[appearance.topStyle], visualRoot, bodyBones, weights, jointRig);
  const jeans = attachSkinnedAsset(assets.jeans, visualRoot, bodyBones, weights, jointRig);
  const shoes = attachSkinnedAsset(assets.shoes, visualRoot, bodyBones, weights, jointRig);
  top.name = 'HumanTop';
  jeans.name = 'HumanJeans';
  shoes.name = 'HumanShoes';
  const applyOutfitMasks = (topStyle: HumanTopStyle) => {
    const worn: GarmentId[] = ['shoes', 'jeans', topStyle];
    applyZoneMask(body, wornZoneMask(worn));
    applyZoneMask(jeans, wornZoneMask(worn, 'jeans'));
    applyZoneMask(shoes, wornZoneMask(worn, 'shoes'));
  };
  applyOutfitMasks(appearance.topStyle);

  const skinBase = new THREE.Color(
    HUMAN_SKIN_TONES.find((tone) => tone.id === appearance.humanSkinTone)?.color || '#d89a70'
  );
  const flushColor = new THREE.Color(0xc84d4d);
  const skinMaterials: THREE.MeshStandardMaterial[] = [];
  const eyeMaterials: THREE.MeshStandardMaterial[] = [];
  const browMaterials: THREE.MeshStandardMaterial[] = [];
  let skinGain = 1;
  body.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return;
      const name = material.name.toLowerCase();
      if (name === 'skin') {
        // The albedo texture is normalised around 1 / gain, so colour * gain
        // makes the average rendered skin match the picked tone.
        // The extra 0.82 compensates for the lighter MakeHuman albedo so the tones
        // stay as warm as the swatches in the creator.
        skinGain = tintGain(material) * 0.82;
        material.color.copy(skinBase).multiplyScalar(skinGain);
        skinMaterials.push(material);
      } else if (name === 'eye') {
        eyeMaterials.push(material);
      } else if (name === 'eyebrow') {
        browMaterials.push(material);
      }
    });
  });
  const tintHair = (hairRoot: THREE.Object3D, hairColor: ChibiAppearanceDNA['hairColor']) => {
    hairRoot.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.color.setHex(hairColors[hairColor]).multiplyScalar(tintGain(material));
        }
      });
    });
    // Eyebrows follow the hair colour, slightly darker so blonde brows stay visible.
    browMaterials.forEach((material) => {
      material.color
        .setHex(hairColors[hairColor])
        .multiplyScalar(tintGain(material) * (hairColor === 'blonde' ? 0.6 : 0.9));
    });
  };
  const disposeAccessoryMaterials = (accessory: THREE.Object3D) => {
    accessory.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => material.dispose());
    });
  };
  tintHair(hair, appearance.hairColor);

  const setAppearance = (value: ChibiAppearanceDNA) => {
    const next = normalizeChibiAppearance({ ...value, characterStyle: 'human' });
    const nextWeights = makeMorphWeights(next);
    applyJointOffsets(jointRig, assets.joints, nextWeights);
    currentAppearanceKey = JSON.stringify(next);
    lastJointOffsetKey = `${currentAppearanceKey}:0`;
    applyMorphWeights(visualRoot, nextWeights);

    if (next.hairStyle !== appearance.hairStyle) {
      visualRoot.remove(hair);
      unregisterJointSkeletons(jointRig, hair);
      disposeAccessoryMaterials(hair);
      hair = attachSkinnedAsset(assets.hair[next.hairStyle], visualRoot, bodyBones, nextWeights, jointRig);
    }
    if (next.topStyle !== appearance.topStyle) {
      visualRoot.remove(top);
      unregisterJointSkeletons(jointRig, top);
      disposeAccessoryMaterials(top);
      top = attachSkinnedAsset(assets.tops[next.topStyle], visualRoot, bodyBones, nextWeights, jointRig);
      top.name = 'HumanTop';
      applyOutfitMasks(next.topStyle);
    }
    tintHair(hair, next.hairColor);
    const skinTone = HUMAN_SKIN_TONES.find((tone) => tone.id === next.humanSkinTone)?.color || '#d89a70';
    skinBase.set(skinTone);
    skinMaterials.forEach((material) => material.color.copy(skinBase).multiplyScalar(skinGain));
    appearance = next;
  };

  /*
   * Human creator sliders update the loaded model in place. This avoids cloning
   * the skinned meshes every time a slider moves and keeps the mirror preview light.
   */
  rig.setAppearance = setAppearance;

  /*
   * The modular meshes share the body bones after rebinding, so their skinning
   * follows the same pose and morph-adjusted joints automatically.
   */

  const humanHead = bodyBones.get('head');
  const humanJaw = bodyBones.get('jaw');
  const humanLeftArm = bodyBones.get('upperarm_l');
  const humanRightArm = bodyBones.get('upperarm_r');
  const humanLeftForearm = bodyBones.get('lowerarm_l');
  const humanRightForearm = bodyBones.get('lowerarm_r');
  const humanLeftHand = bodyBones.get('hand_l');
  const humanRightHand = bodyBones.get('hand_r');
  const humanLeftLeg = bodyBones.get('thigh_l');
  const humanRightLeg = bodyBones.get('thigh_r');
  const humanLeftCalf = bodyBones.get('calf_l');
  const humanRightCalf = bodyBones.get('calf_r');
  const bodyPoseBones = [
    { bone: humanHead, driver: rig.head },
  ].filter((entry): entry is { bone: THREE.Bone; driver: THREE.Object3D } => !!entry.bone);
  const humanArms = [
    {
      upper: humanLeftArm,
      lower: humanLeftForearm,
      hand: humanLeftHand,
      driver: rig.leftArm,
      neutral: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0, 0.3)),
      seatedUpper: new THREE.Vector3(-0.16, -0.5, 0.85).normalize(),
      seatedLower: new THREE.Vector3(-0.06, 0.48, 0.87).normalize(),
      standingUpper: new THREE.Vector3(0.12, -0.99, 0).normalize(),
      standingLower: new THREE.Vector3(0, -0.98, 0.18).normalize(),
    },
    {
      upper: humanRightArm,
      lower: humanRightForearm,
      hand: humanRightHand,
      driver: rig.rightArm,
      neutral: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.6, 0, -0.35)),
      seatedUpper: new THREE.Vector3(0.16, -0.5, 0.85).normalize(),
      seatedLower: new THREE.Vector3(0.08, 0.48, 0.87).normalize(),
      standingUpper: new THREE.Vector3(-0.12, -0.99, 0).normalize(),
      standingLower: new THREE.Vector3(0, -0.98, 0.18).normalize(),
    },
  ];
  const humanLegs = [
    { thigh: humanLeftLeg, calf: humanLeftCalf, driver: rig.leftLeg },
    { thigh: humanRightLeg, calf: humanRightCalf, driver: rig.rightLeg },
  ];
  const poseBones = [
    ...bodyPoseBones.map(({ bone }) => bone),
    humanLeftArm,
    humanRightArm,
    humanLeftForearm,
    humanRightForearm,
    humanLeftLeg,
    humanRightLeg,
    humanLeftCalf,
    humanRightCalf,
  ].filter((bone): bone is THREE.Bone => !!bone);
  const bodyPoseRest = new Map<THREE.Bone, THREE.Quaternion>();
  const bodyPoseLocalRest = new Map<THREE.Bone, THREE.Quaternion>();
  const bodyPoseRestDirections = new Map<THREE.Bone, THREE.Vector3>();
  rig.body.updateWorldMatrix(true, true);
  const restBodyWorld = rig.body.getWorldQuaternion(new THREE.Quaternion());
  const inverseRestBodyWorld = restBodyWorld.clone().invert();
  for (const bone of poseBones) {
    bodyPoseLocalRest.set(bone, bone.quaternion.clone());
    bodyPoseRest.set(
      bone,
      inverseRestBodyWorld.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion()))
    );
  }
  for (const arm of humanArms) {
    if (arm.upper && arm.lower) {
      bodyPoseRestDirections.set(
        arm.upper,
        getBoneDirectionInFrame(arm.upper, arm.lower, inverseRestBodyWorld)
      );
    }
    if (arm.lower && arm.hand) {
      bodyPoseRestDirections.set(
        arm.lower,
        getBoneDirectionInFrame(arm.lower, arm.hand, inverseRestBodyWorld)
      );
    }
  }
  const bodyWorld = new THREE.Quaternion();
  const inverseBodyWorld = new THREE.Quaternion();
  const parentWorld = new THREE.Quaternion();
  const parentInBody = new THREE.Quaternion();
  const targetInBody = new THREE.Quaternion();
  const armDriverDelta = new THREE.Quaternion();
  const chibiNeutralDirection = new THREE.Vector3();
  const chibiArmDirection = new THREE.Vector3();
  const seatedArmBase = new THREE.Vector3();
  const seatedAimDelta = new THREE.Quaternion();
  const downAxis = new THREE.Vector3(0, -1, 0);
  const armPoseDelta = new THREE.Quaternion();
  const armDirection = new THREE.Vector3();
  const xAxis = new THREE.Vector3(1, 0, 0);
  const legPose = new THREE.Quaternion();
  const seatedThighPose = new THREE.Quaternion();
  const seatedCalfPose = new THREE.Quaternion();
  const uprightLegEuler = new THREE.Euler();
  const sittingLegEuler = new THREE.Euler();
  let seatedBlend = 1;
  const rightHand = bodyBones.get('hand_r');
  if (rightHand) {
    rightHand.add(rig.mugHolder);
    rig.mugHolder.position.set(0.03, -0.025, 0.06);
    rig.mugHolder.rotation.set(0, 0, Math.PI / 2);
    rig.mugHolder.scale.setScalar(0.48);
    rig.mugHolder.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.visible = true;
    });
  }

  const originalUpdate = rig.update;
  rig.update = (...args: Parameters<CharacterRig['update']>) => {
    originalUpdate(...args);
    const [delta, alcohol, isPassedOut, , ikState, extraState] = args;
    const ratio = THREE.MathUtils.clamp(alcohol / 100, 0, 1);
    const bladderLevel = extraState?.bladderLevel || 0;
    const bodyWeights = makeMorphWeights(appearance, bladderLevel);
    bodyWeights.blink_left = isPassedOut ? 1 : Math.max(0, (ratio - 0.38) / 0.62) * 0.58;
    bodyWeights.blink_right = bodyWeights.blink_left;
    bodyWeights.look_left = ratio > 0.4 ? 0.18 + Math.max(0, Math.sin(Date.now() * 0.002)) * ratio * 0.45 : 0;
    bodyWeights.look_right = ratio > 0.4 ? 0.18 + Math.max(0, Math.cos(Date.now() * 0.0023)) * ratio * 0.45 : 0;
    bodyWeights.look_down = isPassedOut ? 0.9 : Math.max(0, (ratio - 0.65) / 0.35) * 0.35;
    const jointOffsetKey = `${currentAppearanceKey}:${Math.round(bladderLevel)}`;
    if (jointOffsetKey !== lastJointOffsetKey) {
      applyJointOffsets(jointRig, assets.joints, bodyWeights);
      lastJointOffsetKey = jointOffsetKey;
    }
    applyMorphWeights(visualRoot, bodyWeights);

    const flush = Math.min(0.55, ratio * 0.55);
    skinMaterials.forEach((material) => {
      material.color.copy(skinBase).lerp(flushColor, flush).multiplyScalar(skinGain);
      // Drunk skin gets flushed and a little sweaty/shiny.
      material.roughness = 0.56 - flush * 0.25;
    });
    eyeMaterials.forEach((material) => material.color.setHex(ratio > 0.75 ? 0xffcbc7 : 0xffffff));

    if (humanJaw) humanJaw.rotation.x = ratio > 0.2 ? -Math.min(0.24, ratio * 0.24) : 0;
    const isFreeRoaming = ikState?.controlMode === 'free_roam';
    const isWalkingToTree = !!extraState?.isWalkingToTree;
    const isClimbingTree = !!extraState?.isClimbingTree;
    const isFaceplanted = !!ikState?.isFaceplanted;
    const isCrawling = !!ikState?.isCrawlingMode;
    const isStanding =
      isFreeRoaming ||
      isWalkingToTree ||
      isClimbingTree ||
      !!extraState?.isStanding ||
      isFaceplanted ||
      isCrawling ||
      !!extraState?.isAirSigningBill ||
      !!extraState?.isSpicedMouth ||
      !!ikState?.isFallenOffChair;
    seatedBlend = THREE.MathUtils.damp(seatedBlend, isStanding ? 0 : 1, 8, delta);
    visualRoot.position.y = THREE.MathUtils.lerp(-0.55, -0.77, seatedBlend);

    rig.body.updateWorldMatrix(true, true);
    rig.body.getWorldQuaternion(bodyWorld);
    inverseBodyWorld.copy(bodyWorld).invert();
    for (const { bone, driver } of bodyPoseBones) {
      if (!bone.parent) continue;
      const restInBody = bodyPoseRest.get(bone);
      if (!restInBody) continue;
      bone.parent.getWorldQuaternion(parentWorld);
      parentInBody.copy(inverseBodyWorld).multiply(parentWorld).invert();
      targetInBody.copy(driver.quaternion).multiply(restInBody);
      bone.quaternion.copy(parentInBody).multiply(targetInBody);
    }

    for (const arm of humanArms) {
      // Follow only where the chibi arm points (swing), never its roll around
      // the arm axis: copying the full Euler delta twisted the human shoulder
      // and forearm into a corkscrew when waving in the wardrobe.
      // The chibi arm frame is turned 180° about Y relative to the human body
      // (its "right" arm sits on +X), so mirror X/Z into the human frame.
      chibiNeutralDirection.copy(downAxis).applyQuaternion(arm.neutral);
      chibiNeutralDirection.set(-chibiNeutralDirection.x, chibiNeutralDirection.y, -chibiNeutralDirection.z);
      chibiArmDirection.copy(downAxis).applyQuaternion(arm.driver.quaternion);
      chibiArmDirection.set(-chibiArmDirection.x, chibiArmDirection.y, -chibiArmDirection.z);
      armDriverDelta.setFromUnitVectors(chibiNeutralDirection, chibiArmDirection);
      if (seatedBlend > 0.001) {
        // Seated, the human arm already rests on the table where the chibi arm
        // hangs, so aim the upper arm where the chibi arm points instead of
        // adding its lift on top (that threw the hands above the head).
        seatedArmBase.copy(arm.seatedUpper).normalize();
        seatedAimDelta.setFromUnitVectors(seatedArmBase, chibiArmDirection);
        armDriverDelta.slerp(seatedAimDelta, seatedBlend);
      }
      for (const [bone, seatedDirection, standingDirection] of [
        [arm.upper, arm.seatedUpper, arm.standingUpper],
        [arm.lower, arm.seatedLower, arm.standingLower],
      ] as const) {
        if (!bone?.parent) continue;
        const restInBody = bodyPoseRest.get(bone);
        const restDirection = bodyPoseRestDirections.get(bone);
        if (!restInBody || !restDirection) continue;
        armDirection
          .copy(standingDirection)
          .lerp(seatedDirection, seatedBlend)
          .normalize()
          .applyQuaternion(armDriverDelta);
        armPoseDelta.setFromUnitVectors(restDirection, armDirection);
        bone.parent.getWorldQuaternion(parentWorld);
        parentInBody.copy(inverseBodyWorld).multiply(parentWorld).invert();
        targetInBody.copy(armPoseDelta).multiply(restInBody);
        bone.quaternion.copy(parentInBody).multiply(targetInBody);
      }
    }

    const legNeutralX =
      isFreeRoaming || extraState?.isAirSigningBill || extraState?.isSpicedMouth || isFaceplanted
        ? Math.PI / 2
        : isCrawling
        ? Math.PI / 2.2
        : isClimbingTree
        ? Math.PI / 3
        : 0;
    for (const { thigh, calf, driver } of humanLegs) {
      uprightLegEuler.set(
        driver.rotation.x - legNeutralX,
        driver.rotation.y,
        driver.rotation.z,
        driver.rotation.order
      );
      sittingLegEuler.set(
        -Math.PI / 2 + driver.rotation.x,
        driver.rotation.y,
        driver.rotation.z,
        driver.rotation.order
      );
      legPose.setFromEuler(uprightLegEuler);
      seatedThighPose.setFromEuler(sittingLegEuler);
      legPose.slerp(seatedThighPose, seatedBlend);
      if (thigh?.parent) {
        const restInBody = bodyPoseRest.get(thigh);
        if (restInBody) {
          thigh.parent.getWorldQuaternion(parentWorld);
          parentInBody.copy(inverseBodyWorld).multiply(parentWorld).invert();
          targetInBody.copy(legPose).multiply(restInBody);
          thigh.quaternion.copy(parentInBody).multiply(targetInBody);
        }
      }

      if (calf?.parent) {
        const restInBody = bodyPoseRest.get(calf);
        const restLocal = bodyPoseLocalRest.get(calf);
        if (restInBody && restLocal) {
          calf.parent.getWorldQuaternion(parentWorld);
          parentInBody.copy(inverseBodyWorld).multiply(parentWorld).invert();
          // Lower legs hang from the knee toward the floor, feet a little forward,
          // instead of folding back under the thighs like a kneel.
          seatedCalfPose.setFromAxisAngle(xAxis, SEATED_CALF_ANGLE * seatedBlend);
          targetInBody.copy(seatedCalfPose).multiply(restInBody);
          const sittingCalfLocal = parentInBody.multiply(targetInBody);
          calf.quaternion.copy(restLocal).slerp(sittingCalfLocal, seatedBlend);
        }
      }
    }
  };

  return rig;
}
