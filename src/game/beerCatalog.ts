/**
 * Beers commonly drunk at Vietnamese street bars, for the drinks menu / shop UI.
 *
 * Prices are typical quán prices in VND (not shop prices). `alcoholDelta` and
 * `bladderDelta` use the same 0-100 scales as DRINK_TIERS (Player.alcoholLevel,
 * bladder), scaled from ABV × serving size so stronger / bigger servings hit harder.
 * Artwork is our own drawing in each beer's usual colours, not the brands' logos.
 */
import type { DrinkTierId } from './types';

export type BeerFormat = 'lon' | 'chai' | 'ly';

export interface BeerArt {
  /** Can metal / bottle glass / beer colour. */
  body: string;
  /** Label band (can), label paper (bottle), foam (glass). */
  accent: string;
  /** Thin trim lines and the neck foil. */
  stripe: string;
  /** Text colour on the label (drawn over `accent`). */
  ink: string;
  /** Two short label lines (plain text, not the brand logo). */
  label: [string, string];
}

export interface Beer {
  id: string;
  name: string;
  /** Line under the name (style / nickname). */
  subtitle: string;
  format: BeerFormat;
  volumeMl: number;
  /** Alcohol by volume, %. */
  abv: number;
  /** Typical price per serving at a quán, VND. */
  priceVnd: number;
  /** Which drink tier of the game it belongs to (alcohol / bladder rules). */
  tier: DrinkTierId;
  alcoholDelta: number;
  bladderDelta: number;
  /** How a table usually orders it. */
  servedAs: string;
  tags: string[];
  description: string;
  art: BeerArt;
}

export const FORMAT_LABEL: Record<BeerFormat, string> = { lon: 'Lon', chai: 'Chai', ly: 'Ly' };

export const BEERS: Beer[] = [
  {
    id: 'tiger_bac',
    name: 'Tiger Bạc',
    subtitle: 'Tiger Crystal • lon bạc',
    format: 'lon',
    volumeMl: 330,
    abv: 4.6,
    priceVnd: 25000,
    tier: 'bia_lon',
    alcoholDelta: 11,
    bladderDelta: 10,
    servedAs: 'Thùng 24 lon, ướp đá',
    tags: ['Nhẹ', 'Mát lạnh', 'Dễ uống'],
    description:
      'Lon bạc quen mặt ở mọi bàn nhậu: vị nhẹ, êm, uống lạnh với đá rất "trôi". Uống nhiều mà không bị nặng đầu nhanh.',
    art: { body: '#c9ced6', accent: '#1e3a8a', stripe: '#f59e0b', ink: '#ffffff', label: ['TIGER', 'CRYSTAL'] },
  },
  {
    id: 'tiger_nau',
    name: 'Tiger Nâu',
    subtitle: 'Tiger Lager • lon xanh cam',
    format: 'lon',
    volumeMl: 330,
    abv: 5.0,
    priceVnd: 22000,
    tier: 'bia_lon',
    alcoholDelta: 12,
    bladderDelta: 10,
    servedAs: 'Thùng 24 lon, ướp đá',
    tags: ['Đậm vị', 'Đắng nhẹ', 'Phổ biến'],
    description:
      'Bản lager truyền thống, đậm và đắng hơn Tiger Bạc một chút. Lựa chọn "chắc kèo" khi cả bàn không biết gọi gì.',
    art: { body: '#1e3a8a', accent: '#f97316', stripe: '#fbbf24', ink: '#ffffff', label: ['TIGER', 'LAGER BEER'] },
  },
  {
    id: 'tiger_chai',
    name: 'Tiger Chai',
    subtitle: 'Tiger Lager • chai nâu',
    format: 'chai',
    volumeMl: 330,
    abv: 5.0,
    priceVnd: 20000,
    tier: 'bia_lon',
    alcoholDelta: 12,
    bladderDelta: 10,
    servedAs: 'Két 20 chai, khui bằng bật lửa',
    tags: ['Đậm vị', 'Vỏ chai xếp tháp'],
    description:
      'Cùng vị Tiger nâu nhưng đựng chai thuỷ tinh nâu, rẻ hơn lon. Vỏ chai uống xong xếp đầy gầm bàn để đếm "chiến tích".',
    art: { body: '#4a2a0e', accent: '#1e3a8a', stripe: '#f97316', ink: '#ffffff', label: ['TIGER', 'LAGER BEER'] },
  },
  {
    id: 'sai_gon',
    name: 'Sài Gòn',
    subtitle: 'Sài Gòn Special • chai xanh',
    format: 'chai',
    volumeMl: 330,
    abv: 4.9,
    priceVnd: 18000,
    tier: 'bia_lon',
    alcoholDelta: 12,
    bladderDelta: 10,
    servedAs: 'Két 20 chai, uống với đá',
    tags: ['Vị miền Nam', 'Giá mềm', 'Đá lạnh'],
    description:
      'Chai xanh "quốc dân" của dân nhậu miền Nam: vị thanh, giá mềm, uống với đá ở quán ốc là đúng bài.',
    art: { body: '#1f5f2e', accent: '#f4f1e6', stripe: '#15803d', ink: '#166534', label: ['SAIGON', 'SPECIAL'] },
  },
  {
    id: 'bia_tuoi',
    name: 'Bia tươi',
    subtitle: 'Rót từ bom • cốc vại thuỷ tinh',
    format: 'ly',
    volumeMl: 500,
    abv: 4.0,
    priceVnd: 12000,
    tier: 'bia_hoi',
    alcoholDelta: 9,
    bladderDelta: 15,
    servedAs: 'Cốc vại 500 ml / tháp 3 lít',
    tags: ['Rẻ', 'Nhiều bọt', 'Nhanh mắc tiểu'],
    description:
      'Rót thẳng từ bom ra ly vại, bọt trắng xoá, rẻ nhất quán. Uống nhanh, nhiều, nên cũng phải chạy đi WC nhiều nhất.',
    art: { body: '#e3940f', accent: '#fffaf0', stripe: '#cfe3d4', ink: '#78350f', label: ['BIA', 'TƯƠI'] },
  },
];

export const formatVnd = (value: number) => `${Math.round(value / 1000)}k`;
