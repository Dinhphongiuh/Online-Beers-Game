/** Features still in development, shown only to admins in Dev Mode. */
export interface DevFeature {
  id: string;
  title: string;
  description: string;
  status: 'prototype' | 'testing';
}

export const DEV_FEATURES: DevFeature[] = [
  {
    id: 'vrm-character',
    title: 'VRM Character Lab',
    description:
      'Nhân vật anime/stylized (VRoid Studio + @pixiv/three-vrm): ngồi ghế nhựa, cầm ly, biểu cảm say, chớp mắt, tóc có vật lý.',
    status: 'prototype',
  },
];
