export type CharacterAvatar = 'dog' | 'cat' | 'panda' | 'duck' | 'bear' | 'hamster';

export type ClothingType = 'tanktop_red' | 'tanktop_white' | 'floral_shirt' | 'gold_chain';

export type HatType = 'none' | 'sunglasses' | 'traffic_helmet' | 'towel';

export type GlassType = 'beer_mug' | 'coi_glass' | 'horn' | 'jade_cup';

export type PubTheme = 'sidewalk' | 'bo_ke' | 'rooftop';

export type DrunkStatus = 'sober' | 'tipsy' | 'drunk' | 'passed_out';

export interface Player {
  id: string;
  name: string;
  isUser: boolean;
  avatar: CharacterAvatar;
  clothing: ClothingType;
  hat: HatType;
  glassType: GlassType;
  alcoholLevel: number; // 0 - 100
  stamina: number;      // 0 - 100
  bladderLevel?: number; // 0 - 100 (Thanh Độ No / Bụng Bia & Mắc Tiểu)
  seatIndex: number;    // 0 to 7 around the table
  coins: number;        // Nắp bia
  gems: number;         // Lúa
  title: string;
  isPassedOut: boolean;
  faceDoodles: string[]; // e.g. ['mustache', 'cat_whiskers', 'spiral_glasses', 'chicken']
  drinksCount: number;
  foodEatenCount?: number;
  lastAction?: string;
  isGulping?: boolean;
  isBreathingFire?: boolean; // Rượu Đế / Chuối Hột khè lửa
  isStunned?: boolean;       // Tàu Ngầm choáng 5 giây
  isSpicedMouth?: boolean;   // Bỏng Mỏ (chạy vòng quanh bàn tìm nước lọc 10s)
  isCaughtSlipping?: boolean; // Chiếu đèn Spotlight "ĐỒ NHẤP MÔI!"
  isWetPants?: boolean;      // Tự "xả" tại ghế khi bụng bia 100% không kịp đi WC
  emptyBottlesCount?: number; // Vỏ chai/lon uống xong dùng làm đạo cụ ném nhau / xếp tháp
  isCallingMaiAnh?: boolean;  // Riêng NPC Phi Quân đạt >=80% cồn rút máy gọi NYC Mai Anh
  isHeartbrokenMaiAnh?: boolean; // Phi Quân bị Mai Anh mắng & block, suy tình tại bàn
  isClimbingTree?: boolean;   // Riêng NPC Khoa Nguyễn (Gấu Nâu) đạt >=80% cồn đi ra leo cây xanh
  isColaOnlyDestroyer?: boolean; // Riêng NPC Nga Phan (Hamster đuôi dài): chỉ uống Coca & phá mồi, 0% cồn
  bikeImpoundMatchesLeft?: number; // Số trận xe máy còn bị giam ở đồn CSGT (2 trận khi bị bắt thổi cồn)
  selectedBikeSkin?: 'dream_chien' | 'wave_do_po' | 'cub_50'; // Skin xe máy trong Tủ Đồ / Garage
  commuteModeUsed?: 'self_bike' | 'grab_vip'; // Phương tiện đã chọn đầu trận
}

export type DrinkTierId =
  | 'bia_hoi'
  | 'bia_lon'
  | 'craft_beer'
  | 'ruou_de'
  | 'tau_ngam'
  | 'tra_da';

export interface DrinkTierSpec {
  id: DrinkTierId;
  name: string;
  servingStyle: string;
  icon: string;
  alcoholDelta: number; // +% or -%
  bladderDelta: number; // +% Độ No / Bụng Bia
  price: number;        // VND added to bill
  liquidColorHex: number;
  description: string;
  specialTag: string;
}

export interface CupPhysicsState {
  drinkId: DrinkTierId;
  liquidLevel: number; // 0 - 100%
  foamRatio: number;   // 0 - 85% (e.g. 80% foam when pouring high/drunk)
  iceCubes: number;    // 0 - 3 cubes
  warmSeconds: number; // >= 120s becomes "Bia Hầm (Ấm)" (+50% stun & nausea)
  pouredByName: string;
  isPoisonedCocktail: boolean; // Bom Hỗn Hợp (Ớt + Chanh + Nước mắm + Rượu đế)
  poisonIngredients: string[];
  poisonTargetPlayerId?: string;
}

export interface ToiletState {
  isOccupied: boolean;
  occupantName: string | null;
  occupantTimeLeft: number; // seconds
  blockerName: string | null; // Bạn nhậu đứng chặn cửa WC 1 buồng
  doorThumpCount: number;
  isHoldingPee: boolean; // Giữ phím "Nhịn Tiểu"
}

export type MinigameId =
  | 'none'
  | 'liars_dice'
  | 'crocodile'
  | 'spin_bottle'
  | 'fifteen_twenty'
  | 'bill_fight'
  | 'truth_or_dare';

export interface FoodDish {
  id: string;
  name: string;
  icon: string;
  servings: number;
  maxServings: number;
  alcoholDelta: number; // e.g. -12
  staminaDelta: number; // e.g. +20
  price: number;        // VND added to bill when ordered
  coinCost: number;     // Nắp bia cost
  spicyRisk: number;    // 0 - 1 chance of chili trap if clumsy
  description: string;
}

export interface ChopstickClashState {
  active: boolean;
  dishId: string;
  dishName: string;
  dishIcon: string;
  rivalPlayer: Player;
  userPower: number; // 0 to 100, starts at 50
  timeLeft: number;  // seconds
}

export interface TableState {
  roomId: string;
  theme: PubTheme;
  themeName: string;
  players: Player[];
  activeMinigame: MinigameId;
  beerTowerLevel: number; // 0 - 100%
  foodDishes: FoodDish[];
  toastCount: number;
  isMicCheersActive: boolean;
  billFightActive: boolean;
  totalBill: number; // VND in game
}

export interface TruthOrDareItem {
  id: string;
  type: 'truth' | 'dare';
  question: string;
  targetPlayerId: string;
  targetPlayerName: string;
  source: 'gemini' | 'offline';
}

export type CameraViewMode =
  | 'seated_3rd'
  | 'first_person'
  | 'minigame_focus'
  | 'free_roam';

export type ControlStateMode = 'seated' | 'free_roam';

export type CharacterEmote =
  | 'none'
  | 'laugh_slap'
  | 'point_taunt'
  | 'beg_mercy'
  | 'sleep_table';

export type HeldItemType =
  | 'beer_mug'
  | 'chopsticks'
  | 'ice_cube'
  | 'cold_towel'
  | 'plastic_stool';

export type OpenWorldZoneId =
  | 'street_sidewalk'
  | 'open_kitchen'
  | 'restroom_alley'
  | 'convenience_atm';

export type HeavyPropType =
  | 'none'
  | 'industrial_fan'
  | 'ice_bucket_giant'
  | 'plastic_stool';

export interface IKHandControlState {
  controlMode: ControlStateMode;
  cameraMode: CameraViewMode;
  aimX: number; // -1 to 1 (mouse / right joystick X)
  aimY: number; // -1 to 1 (mouse / right joystick Y)
  isGrabbing: boolean; // LMB / Grab button
  isCheersHolding: boolean; // RMB / Push to center
  isDrinkingOrEating: boolean; // Space / Scroll / Drink button
  heldItem: HeldItemType;
  chairBalance: number; // -100 to 100
  isFallenOffChair: boolean;
  freeRoamPos: { x: number; z: number; angle: number; isMoving: boolean };
  isHeadbutting: boolean;
  emote: CharacterEmote;
  micVolume: number; // 0 to 1 for lip-sync & laugh trigger
  coldTowelBuffTimer: number; // seconds left of clear camera
  // Open-World Sandbox ("Tổ Hợp Ăn Chơi Xuyên Đêm") physics & interactions
  activeZone?: OpenWorldZoneId;
  isCrawlingMode?: boolean; // Bò Lê Bò Lết bằng tứ chi (>85% cồn hoặc sau cú ngã sấp mặt)
  isFaceplanted?: boolean; // Ngã sấp mặt khi vấp gạch / két bia do Input Drift
  isHoldingGrabSupport?: boolean; // Nút "Bám Vịn" (Grab & Hold tường / bậc thềm / bạn nhậu)
  carriedHeavyProp?: HeavyPropType; // Khiêng quạt máy đứng / thùng nước đá / ghế nhựa trên đầu
  draggingFriendId?: string | null; // "The Wingman Carry": dìu hoặc kéo lê bạn say
  isUrgentPeeRushing?: boolean; // "Cuộc Đua Đi Tìm Nhà Vệ Sinh" khi bụng bia 100%
  isChasedByCleaverChef?: boolean; // Làm cháy khét mực ở Bếp Lộ Thiên bị chủ quán cầm dao phay rượt
}



