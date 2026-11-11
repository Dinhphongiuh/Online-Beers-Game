/**
 * In-game "human" characters, rendered with VRoid (VRM) models.
 *
 * Replaces the MakeHuman rig (humanCharacter.ts). Like it, this keeps the chibi
 * rig for the nameplate, the glass (mugHolder) and all game-state animation
 * drivers, hides the chibi meshes, and maps the game state (seated, standing,
 * walking, drunk, cheers, passed out) onto the VRM character. The VRM parses
 * asynchronously: the chibi stays visible until the model is ready.
 */
import * as THREE from 'three';
import {
  DEFAULT_HUMAN_APPEARANCE,
  HUMAN_SKIN_TONES,
  normalizeChibiAppearance,
  type ChibiAppearanceDNA,
  type HumanGender,
  type HumanHairColor,
  type HumanTopStyle,
} from '../../shared/appearance';
import { createChibiCharacter, type CharacterRig } from './characterModel';
import type { CharacterAvatar, ClothingType, GlassType, HatType } from './types';
import { createVrmCharacter, fetchVrmBuffer, parseVrm, type VrmCharacter, type VrmPose } from './vrmCharacter';
import type { VrmOutfit } from './vrmOutfit';

/** Official human characters (pixiv samples), see public/assets/characters/vrm/LICENSES.md. */
export const VRM_HUMAN_MODELS: Record<HumanGender, string> = {
  male: '/assets/characters/vrm/male_fumiriya.vrm',
  female: '/assets/characters/vrm/female_pixiv.vrm',
};

const HAIR_COLORS: Record<HumanHairColor, string | null> = {
  natural: null,
  black: '#1c1714',
  dark_brown: '#3b2519',
  brown: '#7a4b2c',
  blonde: '#d8b46a',
};

/** Multipliers over VRoid's light skin texture for the creator's skin tones. */
const SKIN_TINTS: Record<(typeof HUMAN_SKIN_TONES)[number]['id'], string> = {
  light: '#ffffff',
  warm: '#f4d6c2',
  tan: '#d6a684',
  deep: '#9c6c52',
};

const TOP_COLORS: Record<HumanTopStyle, string | null> = {
  // Keep the model's own uniform for the default; "hoodie" gets a street grey-blue.
  tshirt: null,
  hoodie: '#5b6f8a',
};

/** Wardrobe settings that still apply to VRM characters. */
export function outfitFromAppearance(appearance: ChibiAppearanceDNA): VrmOutfit {
  return {
    colors: {
      hair: HAIR_COLORS[appearance.hairColor] ?? null,
      top: TOP_COLORS[appearance.topStyle] ?? null,
    },
    skinTone: SKIN_TINTS[appearance.humanSkinTone] ?? null,
    accessories: [],
  };
}

/** Start downloading the models early (e.g. when the menu opens). */
export function preloadVrmHumanModels(genders: HumanGender[] = ['male', 'female']) {
  genders.forEach((gender) => void fetchVrmBuffer(VRM_HUMAN_MODELS[gender]).catch(() => undefined));
}

export function createVrmHumanCharacter(
  avatar: CharacterAvatar,
  clothing: ClothingType,
  hat: HatType,
  glassType: GlassType,
  appearanceValue: ChibiAppearanceDNA = DEFAULT_HUMAN_APPEARANCE
): CharacterRig {
  let appearance = normalizeChibiAppearance({ ...appearanceValue, characterStyle: 'human' });
  const rig = createChibiCharacter(avatar, clothing, hat, glassType, appearance);

  const chibiMeshes: THREE.Object3D[] = [];
  rig.root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh && !isInside(object, rig.mugHolder)) chibiMeshes.push(object);
  });
  const mugHome = rig.mugHolder.parent;
  const mugHomeTransform = {
    position: rig.mugHolder.position.clone(),
    rotation: rig.mugHolder.rotation.clone(),
    scale: rig.mugHolder.scale.clone(),
  };

  let character: VrmCharacter | null = null;
  let loadedGender: HumanGender | null = null;
  let loadToken = 0;
  const lastRootPosition = new THREE.Vector3();
  const rootPosition = new THREE.Vector3();
  let hasLastPosition = false;
  let speed = 0;

  const showChibi = (visible: boolean) => chibiMeshes.forEach((mesh) => (mesh.visible = visible));

  const releaseCharacter = () => {
    if (!character) return;
    character.root.removeFromParent();
    character.dispose(); // detaches the glass without disposing it
    character = null;
    // Put the glass back in the chibi hand until the next model is in.
    mugHome?.add(rig.mugHolder);
    rig.mugHolder.position.copy(mugHomeTransform.position);
    rig.mugHolder.rotation.copy(mugHomeTransform.rotation);
    rig.mugHolder.scale.copy(mugHomeTransform.scale);
  };

  const loadModel = (gender: HumanGender) => {
    const token = ++loadToken;
    loadedGender = gender;
    fetchVrmBuffer(VRM_HUMAN_MODELS[gender])
      .then(parseVrm)
      .then((vrm) => {
        if (token !== loadToken) {
          vrm.scene.traverse((object) => (object as THREE.Mesh).geometry?.dispose());
          return;
        }
        releaseCharacter();
        // The chibi glass is ~2x a real mug: scale it to fit the hand.
        rig.mugHolder.scale.setScalar(0.45);
        rig.mugHolder.rotation.set(0, 0, 0);
        character = createVrmCharacter(
          vrm,
          { pose: 'seated', alcohol: 0, mood: 'neutral', cheers: false },
          {
            holdObject: rig.mugHolder,
            holdOffset: new THREE.Vector3(-0.07, -0.05, 0.045),
            outfit: outfitFromAppearance(appearance),
            // Fit the bar's scale (stools, table) whatever size the VRoid export is.
            targetHeight: gender === 'male' ? 1.62 : 1.52,
          }
        );
        rig.root.add(character.root);
        showChibi(false);
      })
      .catch((error) => console.warn('[vrm-human] model failed to load, keeping the chibi', error));
  };

  loadModel(appearance.gender);

  rig.setAppearance = (value: ChibiAppearanceDNA) => {
    appearance = normalizeChibiAppearance({ ...value, characterStyle: 'human' });
    if (appearance.gender !== loadedGender) {
      loadModel(appearance.gender); // the old model stays until the new one is ready
    } else {
      character?.setOutfit(outfitFromAppearance(appearance));
    }
  };

  const originalUpdate = rig.update;
  rig.update = (...args: Parameters<CharacterRig['update']>) => {
    originalUpdate(...args);
    if (!character) return;
    const [delta, alcohol, isPassedOut, isCheersing, ikState, extraState] = args;

    // Ground speed from how far the game moved the rig this frame.
    rig.root.getWorldPosition(rootPosition);
    if (hasLastPosition && delta > 0) {
      const dx = rootPosition.x - lastRootPosition.x;
      const dz = rootPosition.z - lastRootPosition.z;
      const instant = Math.min(8, Math.hypot(dx, dz) / delta);
      speed = THREE.MathUtils.damp(speed, instant, 10, delta);
    }
    lastRootPosition.copy(rootPosition);
    hasLastPosition = true;

    const standing =
      ikState?.controlMode === 'free_roam' ||
      !!extraState?.isStanding ||
      !!extraState?.isWalkingToTree ||
      !!extraState?.isClimbingTree ||
      !!extraState?.isAirSigningBill ||
      !!extraState?.isSpicedMouth ||
      !!ikState?.isFallenOffChair ||
      !!ikState?.isFaceplanted ||
      !!ikState?.isCrawlingMode;
    let pose: VrmPose = standing ? 'standing' : 'seated';
    if (speed > 2.2) pose = 'running';
    else if (speed > 0.35) pose = 'walking';

    const state = character.state;
    state.pose = pose;
    state.alcohol = alcohol;
    state.passedOut = isPassedOut;
    state.cheers =
      isCheersing || (!!extraState?.cheersPhase && extraState.cheersPhase !== 'idle');
    state.mood = extraState?.isSpicedMouth || extraState?.isStunned
      ? 'surprised'
      : extraState?.isHeartbrokenMaiAnh
      ? 'sad'
      : state.cheers
      ? 'happy'
      : 'neutral';

    // The chibi body bobs/hops for its own animations; the VRM handles its own
    // poses, so it follows the rig root and only borrows the body's lean.
    character.root.rotation.set(rig.body.rotation.x * 0.5, 0, rig.body.rotation.z * 0.5);
    character.update(delta);
  };

  return rig;
}

function isInside(object: THREE.Object3D, ancestor: THREE.Object3D) {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (node === ancestor) return true;
  }
  return false;
}
