export const CHIBI_SKIN_TONES = [
  { id: 'natural', label: 'Tự nhiên', color: '#f8d98f' },
  { id: 'peach', label: 'Đào', color: '#f3a58c' },
  { id: 'cream', label: 'Kem', color: '#f5e9c8' },
  { id: 'cocoa', label: 'Cacao', color: '#94624a' },
  { id: 'rose', label: 'Hồng', color: '#db8da7' },
  { id: 'mint', label: 'Bạc hà', color: '#83bca5' },
] as const;

export type ChibiSkinTone = (typeof CHIBI_SKIN_TONES)[number]['id'];

export const HUMAN_SKIN_TONES = [
  { id: 'light', label: 'Sáng', color: '#f2c7a5' },
  { id: 'warm', label: 'Ấm', color: '#d89a70' },
  { id: 'tan', label: 'Nâu sáng', color: '#a86f4f' },
  { id: 'deep', label: 'Nâu đậm', color: '#704632' },
] as const;

export type HumanSkinTone = (typeof HUMAN_SKIN_TONES)[number]['id'];
export type CharacterStyle = 'chibi' | 'human';
export type HumanGender = 'male' | 'female';
export type HumanHairStyle = 'short02' | 'bob02' | 'long01';
/** 'natural' keeps the character model's own hair colour. */
export type HumanHairColor = 'natural' | 'black' | 'dark_brown' | 'brown' | 'blonde';
export type HumanTopStyle = 'tshirt' | 'hoodie';

/** Serializable creator settings shared by the lobby, game scene, and network. */
export interface ChibiAppearanceDNA {
  characterStyle: CharacterStyle;
  skinTone: ChibiSkinTone;
  eyeSize: number;
  eyeDistance: number;
  eyeSlant: number;
  snoutWidth: number;
  mouthSize: number;
  bodyBuild: number;
  gender: HumanGender;
  age: number;
  height: number;
  bodyWeight: number;
  muscle: number;
  faceNoseWidth: number;
  faceNoseLength: number;
  faceNoseHeight: number;
  faceJawWidth: number;
  faceChin: number;
  faceCheekbones: number;
  faceEyeSize: number;
  faceEyeSpacing: number;
  faceEyeTilt: number;
  faceLips: number;
  faceMouthWidth: number;
  faceEarSize: number;
  faceForehead: number;
  humanSkinTone: HumanSkinTone;
  hairStyle: HumanHairStyle;
  hairColor: HumanHairColor;
  topStyle: HumanTopStyle;
}

export const DEFAULT_CHIBI_APPEARANCE: ChibiAppearanceDNA = {
  characterStyle: 'chibi',
  skinTone: 'natural',
  eyeSize: 50,
  eyeDistance: 50,
  eyeSlant: 50,
  snoutWidth: 50,
  mouthSize: 50,
  bodyBuild: 50,
  gender: 'male',
  age: 28,
  height: 50,
  bodyWeight: 50,
  muscle: 35,
  faceNoseWidth: 50,
  faceNoseLength: 50,
  faceNoseHeight: 50,
  faceJawWidth: 50,
  faceChin: 50,
  faceCheekbones: 50,
  faceEyeSize: 50,
  faceEyeSpacing: 50,
  faceEyeTilt: 50,
  faceLips: 50,
  faceMouthWidth: 50,
  faceEarSize: 50,
  faceForehead: 50,
  humanSkinTone: 'warm',
  hairStyle: 'short02',
  hairColor: 'natural',
  topStyle: 'tshirt',
};

export const DEFAULT_HUMAN_APPEARANCE: ChibiAppearanceDNA = {
  ...DEFAULT_CHIBI_APPEARANCE,
  characterStyle: 'human',
};

const clampPercent = (value: unknown, fallback: number) => {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.round(Math.min(100, Math.max(0, number)));
};

/** Normalize saved and network-provided appearance data before using it in the scene. */
export function normalizeChibiAppearance(value: unknown): ChibiAppearanceDNA {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const skinTone = CHIBI_SKIN_TONES.some((tone) => tone.id === raw.skinTone)
    ? (raw.skinTone as ChibiSkinTone)
    : DEFAULT_CHIBI_APPEARANCE.skinTone;
  return {
    characterStyle: raw.characterStyle === 'human' ? 'human' : 'chibi',
    skinTone,
    eyeSize: clampPercent(raw.eyeSize, DEFAULT_CHIBI_APPEARANCE.eyeSize),
    eyeDistance: clampPercent(raw.eyeDistance, DEFAULT_CHIBI_APPEARANCE.eyeDistance),
    eyeSlant: clampPercent(raw.eyeSlant, DEFAULT_CHIBI_APPEARANCE.eyeSlant),
    snoutWidth: clampPercent(raw.snoutWidth, DEFAULT_CHIBI_APPEARANCE.snoutWidth),
    mouthSize: clampPercent(raw.mouthSize, DEFAULT_CHIBI_APPEARANCE.mouthSize),
    bodyBuild: clampPercent(raw.bodyBuild, DEFAULT_CHIBI_APPEARANCE.bodyBuild),
    gender: raw.gender === 'female' ? 'female' : 'male',
    age: clampPercent(raw.age, DEFAULT_CHIBI_APPEARANCE.age),
    height: clampPercent(raw.height, DEFAULT_CHIBI_APPEARANCE.height),
    bodyWeight: clampPercent(raw.bodyWeight, DEFAULT_CHIBI_APPEARANCE.bodyWeight),
    muscle: clampPercent(raw.muscle, DEFAULT_CHIBI_APPEARANCE.muscle),
    faceNoseWidth: clampPercent(raw.faceNoseWidth, DEFAULT_CHIBI_APPEARANCE.faceNoseWidth),
    faceNoseLength: clampPercent(raw.faceNoseLength, DEFAULT_CHIBI_APPEARANCE.faceNoseLength),
    faceNoseHeight: clampPercent(raw.faceNoseHeight, DEFAULT_CHIBI_APPEARANCE.faceNoseHeight),
    faceJawWidth: clampPercent(raw.faceJawWidth, DEFAULT_CHIBI_APPEARANCE.faceJawWidth),
    faceChin: clampPercent(raw.faceChin, DEFAULT_CHIBI_APPEARANCE.faceChin),
    faceCheekbones: clampPercent(raw.faceCheekbones, DEFAULT_CHIBI_APPEARANCE.faceCheekbones),
    faceEyeSize: clampPercent(raw.faceEyeSize, DEFAULT_CHIBI_APPEARANCE.faceEyeSize),
    faceEyeSpacing: clampPercent(raw.faceEyeSpacing, DEFAULT_CHIBI_APPEARANCE.faceEyeSpacing),
    faceEyeTilt: clampPercent(raw.faceEyeTilt, DEFAULT_CHIBI_APPEARANCE.faceEyeTilt),
    faceLips: clampPercent(raw.faceLips, DEFAULT_CHIBI_APPEARANCE.faceLips),
    faceMouthWidth: clampPercent(raw.faceMouthWidth, DEFAULT_CHIBI_APPEARANCE.faceMouthWidth),
    faceEarSize: clampPercent(raw.faceEarSize, DEFAULT_CHIBI_APPEARANCE.faceEarSize),
    faceForehead: clampPercent(raw.faceForehead, DEFAULT_CHIBI_APPEARANCE.faceForehead),
    humanSkinTone: HUMAN_SKIN_TONES.some((tone) => tone.id === raw.humanSkinTone)
      ? (raw.humanSkinTone as HumanSkinTone)
      : DEFAULT_CHIBI_APPEARANCE.humanSkinTone,
    hairStyle: raw.hairStyle === 'bob02' || raw.hairStyle === 'long01' ? raw.hairStyle : 'short02',
    hairColor:
      raw.hairColor === 'black' ||
      raw.hairColor === 'dark_brown' ||
      raw.hairColor === 'brown' ||
      raw.hairColor === 'blonde'
        ? raw.hairColor
        : 'natural',
    // 'tshirt' = the character's own outfit colours.
    topStyle: raw.topStyle === 'hoodie' ? 'hoodie' : 'tshirt',
  };
}

export function chibiAppearanceKey(value: unknown): string {
  return JSON.stringify(normalizeChibiAppearance(value));
}
