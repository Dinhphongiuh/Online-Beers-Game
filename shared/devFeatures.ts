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
  {
    id: 'nextgen-bar',
    title: 'Quán Ốc Bờ Sông',
    description:
      'Quán ốc vỉa hè bên bờ kè trên WebGPU: mặt sông phản chiếu đèn, thuyền neo, cầu đổi màu, phố bên kia sông. TRAA, SSGI, GTAO, SSR, bloom (TSL) và phông nền Gaussian Splat.',
    status: 'prototype',
  },
];
