import {
  CharacterAvatar,
  ClothingType,
  GlassType,
  HatType,
  Player,
  PubTheme,
} from '../game/types';

export type DrunkSpeedId = 'lai_rai' | 'toi_ben' | 'tu_chien';

export interface TableRules {
  /** Must shout "1, 2, 3 Dzô" into the mic before drinking. */
  micDzo: boolean;
  /** "Vợ gọi điện kiểm tra" & "Công an phường dẹp vỉa hè" pop up on their own. */
  randomEvents: boolean;
  /** Allow the end-of-night chair-throwing bill brawl. */
  billBrawl: boolean;
}

export interface LobbySkin {
  avatar: CharacterAvatar;
  clothing: ClothingType;
  hat: HatType;
  glassType: GlassType;
}

/** Everything the lobby hands over to the in-game table when "DZÔ!" is pressed. */
export interface LobbyConfig {
  playerName: string;
  skin: LobbySkin;
  /** Crew NPC ids seated at the lobby table (in seat order). */
  squadIds: string[];
  theme: PubTheme;
  drunkSpeed: DrunkSpeedId;
  rules: TableRules;
  roomCode: string;
}

export const LOBBY_MAPS: { id: PubTheme; name: string; icon: string; desc: string }[] = [
  { id: 'bo_ke', name: 'Quán Tư Đực Bờ Kè', icon: '🌊', desc: 'Gió sông lồng lộng, mồi hải sản tươi rói' },
  { id: 'sidewalk', name: 'Ngã Tư Vỉa Hè', icon: '🛵', desc: 'Còi xe inh ỏi, ghế nhựa tràn ra lề đường' },
  { id: 'rooftop', name: 'Phòng VIP Karaoke', icon: '🎤', desc: 'Đèn chớp xanh đỏ, loa kẹo kéo hết công suất' },
];

export const THEME_NAMES: Record<PubTheme, string> = {
  bo_ke: 'Quán Tư Đực Bờ Kè',
  sidewalk: 'Ngã Tư Vỉa Hè Sài Gòn',
  rooftop: 'Phòng VIP Karaoke',
};

export const DRUNK_SPEEDS: {
  id: DrunkSpeedId;
  name: string;
  icon: string;
  desc: string;
  /** Multiplier applied to every alcohol gain in-game. */
  multiplier: number;
}[] = [
  { id: 'lai_rai', name: 'Nhậu Lai Rai', icon: '🐢', desc: 'Say chậm, tám chuyện là chính', multiplier: 0.6 },
  { id: 'toi_ben', name: 'Uống Tới Bến', icon: '🍺', desc: 'Tốc độ chuẩn quán nhậu', multiplier: 1 },
  { id: 'tu_chien', name: 'Tử Chiến Rượu Đế', icon: '🔥', desc: 'Say cực nhanh, gục sau vài ly', multiplier: 1.6 },
];

export const RULE_LABELS: { id: keyof TableRules; label: string; icon: string }[] = [
  { id: 'micDzo', label: 'Bắt buộc hô "1, 2, 3 Dzô" vào Mic mới được uống', icon: '🎤' },
  { id: 'randomEvents', label: 'Có sự kiện "Vợ gọi điện kiểm tra" & "Công an phường dẹp vỉa hè"', icon: '🚨' },
  { id: 'billBrawl', label: 'Cho phép hỗn chiến ném ghế giành trả Bill cuối trận', icon: '🪑' },
];

export const DEFAULT_RULES: TableRules = {
  micDzo: false,
  randomEvents: true,
  billBrawl: true,
};

export const SKIN_AVATARS: { id: CharacterAvatar; name: string; icon: string }[] = [
  { id: 'dog', name: 'Cậu Vàng', icon: '🐕' },
  { id: 'cat', name: 'Mèo Mướp', icon: '🐱' },
  { id: 'panda', name: 'Gấu Trúc', icon: '🐼' },
  { id: 'bear', name: 'Gấu Nâu', icon: '🐻' },
  { id: 'duck', name: 'Vịt Vàng', icon: '🦆' },
  { id: 'hamster', name: 'Hamster', icon: '🐹' },
];

export const SKIN_CLOTHES: { id: ClothingType; name: string; icon: string }[] = [
  { id: 'tanktop_red', name: 'Ba Lỗ Đỏ', icon: '🎽' },
  { id: 'tanktop_white', name: 'Ba Lỗ Trắng', icon: '👕' },
  { id: 'floral_shirt', name: 'Sơ Mi Hoa', icon: '🌺' },
  { id: 'gold_chain', name: 'Dây Chuyền Vàng', icon: '📿' },
];

export const SKIN_HATS: { id: HatType; name: string; icon: string }[] = [
  { id: 'none', name: 'Đầu Trần', icon: '🧑' },
  { id: 'sunglasses', name: 'Kính Râm', icon: '🕶️' },
  { id: 'traffic_helmet', name: 'Nón Tổ Ong', icon: '🪖' },
  { id: 'towel', name: 'Khăn Vắt Vai', icon: '🧣' },
];

export const SKIN_GLASSES: { id: GlassType; name: string; icon: string }[] = [
  { id: 'beer_mug', name: 'Ly Quai', icon: '🍺' },
  { id: 'coi_glass', name: 'Ly Cối', icon: '🥛' },
  { id: 'horn', name: 'Sừng Trâu', icon: '📯' },
  { id: 'jade_cup', name: 'Chén Ngọc', icon: '🏺' },
];

export const AVATAR_ICON: Record<CharacterAvatar, string> = Object.fromEntries(
  SKIN_AVATARS.map((a) => [a.id, a.icon])
) as Record<CharacterAvatar, string>;

/** Drinking "rank" ladder shown on the profile passport. */
export function drinkingRank(toastCount: number): { name: string; level: number } {
  const ladder = ['Tấm Chiếu Mới', 'Bợm Tập Sự', 'Chiến Thần Bia Hơi', 'Trùm Vỉa Hè', 'Thần Cồn'];
  const level = Math.min(ladder.length - 1, Math.floor(toastCount / 25));
  return { name: ladder[level], level: level + 1 };
}

export function randomRoomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export interface LobbyFriend {
  id: string;
  name: string;
  avatar: CharacterAvatar;
  status: 'online' | 'drinking' | 'offline';
  note: string;
  /** Crew members can actually be invited to the table (they exist in-game). */
  invitable: boolean;
}

/** The online friends list: the in-game crew plus a few offline regulars for flavor. */
export function buildFriendList(crew: Player[]): LobbyFriend[] {
  const notes: Record<string, string> = {
    bot_phiquan: 'Đang online • hay gọi NYC lúc say',
    bot_khoanguyen: 'Đang online • thích leo cây',
    bot_baonguyen: 'Đang online • chuyên gắp miếng ngon',
    bot_ngaphan: 'Đang online • chỉ uống Coca',
  };
  return [
    ...crew.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      status: 'online' as const,
      note: notes[p.id] || 'Đang online',
      invitable: true,
    })),
    { id: 'off_tuan', name: 'Tuấn Xỉn', avatar: 'duck', status: 'drinking', note: 'Đang nhậu bàn khác (Tăng 3)', invitable: false },
    { id: 'off_hung', name: 'Hùng Bia Hơi', avatar: 'dog', status: 'offline', note: 'Offline • bị vợ thu điện thoại', invitable: false },
  ];
}
