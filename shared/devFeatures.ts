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
  {
    id: 'ride-lab',
    title: 'Ride Lab — Chạy xe về quán',
    description:
      'Phát triển cơ chế lái xe máy: vật lý nghiêng cua, hộp số, đạp nổ, chân chống, say xỉn; HUD đồng hồ tốc độ, minimap; lộ trình hẻm → đường lớn → bờ kè với ổ gà, gờ giảm tốc, xe cộ, chốt CSGT.',
    status: 'prototype',
  },
  {
    id: 'ui-lab',
    title: 'UI Lab',
    description:
      'Phát triển giao diện game: kit màu, chữ, nút, thẻ; thực đơn các loại bia (Tiger Bạc, Tiger Nâu, Tiger Chai, Sài Gòn, bia tươi). Ly bia và món nhậu: coming soon.',
    status: 'prototype',
  },
];
