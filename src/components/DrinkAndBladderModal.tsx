import React, { useState, useEffect } from 'react';
import {
  DrinkTierId,
  DrinkTierSpec,
  CupPhysicsState,
  ToiletState,
  Player,
} from '../game/types';
import {
  Beer,
  Snowflake,
  Flame,
  Sparkles,
  AlertTriangle,
  Bath,
  X,
  ShieldAlert,
  Hammer,
  RefreshCw,
} from 'lucide-react';

export const DRINK_TIERS: DrinkTierSpec[] = [
  {
    id: 'bia_hoi',
    name: 'Bia Hơi Vỉa Hè',
    servingStyle: 'Ly thủy tinh cối / Theo ca',
    icon: '🍺',
    alcoholDelta: 8,
    bladderDelta: 15,
    price: 15000,
    liquidColorHex: 0xfbbf24,
    description:
      'Rẻ nhất, cực nhiều bọt. Uống nhanh dễ làm đầy thanh "Mắc Tiểu" (phải chạy đi WC giải quyết, nếu không sẽ tự "xả" tại ghế làm mất điểm phong độ).',
    specialTag: '🚽 Nhanh Mắc Tiểu (+15% Bụng Bia)',
  },
  {
    id: 'bia_lon',
    name: 'Bia Lon / Bia Chai (Tiger, Sài Gòn)',
    servingStyle: 'Két 24 chai / Tháp bia 3L',
    icon: '🍻',
    alcoholDelta: 12,
    bladderDelta: 10,
    price: 25000,
    liquidColorHex: 0xf59e0b,
    description:
      'Chuẩn mực bàn nhậu Việt Nam. Vỏ chai/lon uống xong có thể dùng làm đạo cụ ném nhau hoặc xếp tháp vỏ lon trên bàn.',
    specialTag: '🍾 Tạo Vỏ Chai Ném Nhau / Xếp Tháp',
  },
  {
    id: 'craft_beer',
    name: 'Bia Thủ Công (Craft Beer)',
    servingStyle: 'Ly cao sang chảnh',
    icon: '🍷',
    alcoholDelta: 18,
    bladderDelta: 10,
    price: 65000,
    liquidColorHex: 0xd97706,
    description:
      'Cồn cao, hương hoa bia đậm đặc, uống vào có hiệu ứng đổi màu màn hình nhẹ (Ảo giác Neon). Giá đắt đỏ.',
    specialTag: '🌈 Hiệu Ứng Ảo Giác Đổi Màu Màn Hình',
  },
  {
    id: 'ruou_de',
    name: 'Rượu Đế / Chuối Hột / Soju',
    servingStyle: 'Chai thủy tinh + Ly mắt trâu',
    icon: '🍶',
    alcoholDelta: 25,
    bladderDelta: 2,
    price: 45000,
    liquidColorHex: 0xe2e8f0,
    description:
      '"Sát thủ bàn nhậu". Không làm no bụng nhưng cồn tăng dựng đứng. Khi uống có hiệu ứng nhân vật 3D khè ra lửa hoặc rùng mình rớt ghế!',
    specialTag: '🔥 Khè Ra Lửa 3D / Rùng Mình Rớt Ghế',
  },
  {
    id: 'tau_ngam',
    name: 'Tàu Ngầm (Bia + Chén Rượu Chìm)',
    servingStyle: '1 Ly cối + 1 ly mắt trâu bên trong',
    icon: '💣',
    alcoholDelta: 35,
    bladderDelta: 15,
    price: 75000,
    liquidColorHex: 0xb45309,
    description:
      'Vật phẩm phạt tối thượng cho người thua Minigame. Uống xong 100% bị Choáng (Stun) quay cuồng 5 giây!',
    specialTag: '💫 100% Choáng (Stun) 5 Giây',
  },
  {
    id: 'tra_da',
    name: 'Nước Lọc / Trà Đá (Đồ Giải Rượu)',
    servingStyle: 'Ly nhựa vỉa hè',
    icon: '🧊',
    alcoholDelta: -10,
    bladderDelta: 5,
    price: 5000,
    liquidColorHex: 0xa3e635,
    description:
      'Dùng để "chữa cháy" hạ nồng độ cồn, nhưng nếu uống lén bị bạn bè phát hiện sẽ bị phạt uống gấp đôi!',
    specialTag: '🕵️ Uống Lén (Bị Bắt = Phạt Gấp Đôi)',
  },
];

interface DrinkAndBladderModalProps {
  initialTab?: 'drinks' | 'tricks' | 'wc';
  userPlayer: Player;
  players: Player[];
  cupState: CupPhysicsState;
  toiletState: ToiletState;
  onSelectDrinkTier: (tierId: DrinkTierId) => void;
  onPourDrink: (highAnglePour: boolean) => void;
  onScoldPourerAndForceDrink: () => void;
  onAddIceToCup: () => void;
  onThrowIceAtFriendCollar: (targetPlayerId: string) => void;
  onDrinkCup: (mode: 'full_100' | 'sip_50') => void;
  onSleightOfHand: (trick: 'dump_plant' | 'swap_mug') => void;
  onMixPoisonCocktail: (targetPlayerId: string, ingredients: string[]) => void;
  onBottleOpenerQTE: (toolName: string, success: boolean) => void;
  onUseEmptyBottles: (action: 'stack_tower' | 'throw_can') => void;
  onEnterToilet: () => void;
  onThumpToiletDoor: () => void;
  onPushToiletBlocker: () => void;
  onHoldPee: () => void;
  onClose: () => void;
}

export const DrinkAndBladderModal: React.FC<DrinkAndBladderModalProps> = ({
  initialTab = 'drinks',
  userPlayer,
  players,
  cupState,
  toiletState,
  onSelectDrinkTier,
  onPourDrink,
  onScoldPourerAndForceDrink,
  onAddIceToCup,
  onThrowIceAtFriendCollar,
  onDrinkCup,
  onSleightOfHand,
  onMixPoisonCocktail,
  onBottleOpenerQTE,
  onUseEmptyBottles,
  onEnterToilet,
  onThumpToiletDoor,
  onPushToiletBlocker,
  onHoldPee,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'drinks' | 'tricks' | 'wc'>(initialTab);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([
    'Ớt hiểm đỏ',
    'Nước mắm cốt',
  ]);
  const [poisonVictimId, setPoisonVictimId] = useState<string>(
    players.find((p) => !p.isUser)?.id || 'bot_tuan'
  );
  const [iceVictimId, setIceVictimId] = useState<string>(
    players.find((p) => !p.isUser)?.id || 'bot_tuan'
  );

  // Bottle Opener QTE State
  const [openerTool, setOpenerTool] = useState<string>('Đôi Đũa Tre');
  const [qteRunning, setQteRunning] = useState(false);
  const [qteCursor, setQteCursor] = useState(20);

  useEffect(() => {
    if (!qteRunning) return;
    let dir = 1;
    const interval = setInterval(() => {
      setQteCursor((prev) => {
        const next = prev + dir * 6;
        if (next >= 98) dir = -1;
        if (next <= 4) dir = 1;
        return Math.max(2, Math.min(98, next));
      });
    }, 35);
    return () => clearInterval(interval);
  }, [qteRunning]);

  const currentDrink =
    DRINK_TIERS.find((d) => d.id === cupState.drinkId) || DRINK_TIERS[0];
  const isWarmBeer = cupState.warmSeconds >= 120 && cupState.iceCubes === 0;
  const bladder = userPlayer.bladderLevel || 0;
  const otherPlayers = players.filter((p) => !p.isUser);

  const toggleIngredient = (ing: string) => {
    setSelectedIngredients((prev) =>
      prev.includes(ing) ? prev.filter((i) => i !== ing) : [...prev, ing]
    );
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-zinc-950 border-2 border-amber-500/60 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-amber-950/80 via-zinc-900 to-zinc-950 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🍺</span>
            <div>
              <h2 className="text-sm md:text-base font-black text-amber-400 tracking-wide uppercase">
                Hệ Thống Bia Rượu, Vật Lý Ly Bia, Độc Chiêu & Bụng Bia (WC 1 Buồng)
              </h2>
              <p className="text-[11px] text-zinc-400">
                Chọn loại đồ uống • Canh góc rót bọt bia • Gắp đá inox • Độc chiêu lươn lẹo • Giải quyết nỗi buồn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 bg-zinc-900/90 border-b border-zinc-800 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('drinks')}
            className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'drinks'
                ? 'bg-amber-500 text-zinc-950 shadow-lg'
                : 'bg-zinc-800/70 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Beer className="w-4 h-4" />
            <span>1. Đồ Uống, Rót Bia & Xô Đá</span>
          </button>
          <button
            onClick={() => setActiveTab('tricks')}
            className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'tricks'
                ? 'bg-purple-500 text-white shadow-lg'
                : 'bg-zinc-800/70 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>2. Độc Chiêu & Khui Bia QTE</span>
          </button>
          <button
            onClick={() => setActiveTab('wc')}
            className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'wc'
                ? 'bg-cyan-500 text-zinc-950 shadow-lg'
                : 'bg-zinc-800/70 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Bath className="w-4 h-4" />
            <span>3. Bụng Bia ({bladder}%) & WC 1 Buồng</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* ================================================================= */}
          {/* TAB 1: 6 DRINK TIERS + LIQUID/FOAM POURING + ICE BUCKET PHYSICS   */}
          {/* ================================================================= */}
          {activeTab === 'drinks' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left 7 cols: 6 Drink Tiers Table */}
              <div className="lg:col-span-7 space-y-2">
                <div className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center justify-between">
                  <span>📋 Danh Sách 6 Cấp Độ Đồ Uống Trên Bàn</span>
                  <span className="text-[11px] text-zinc-400">
                    Vỏ chai rỗng đang có: <strong className="text-amber-400">{userPlayer.emptyBottlesCount || 0}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DRINK_TIERS.map((tier) => {
                    const isSelected = cupState.drinkId === tier.id;
                    return (
                      <button
                        key={tier.id}
                        onClick={() => onSelectDrinkTier(tier.id)}
                        className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-950/50 border-amber-400 shadow-lg'
                            : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xl">{tier.icon}</span>
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                  tier.alcoholDelta > 0
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                }`}
                              >
                                {tier.alcoholDelta > 0
                                  ? `+${tier.alcoholDelta}% Cồn`
                                  : `${tier.alcoholDelta}% Cồn`}
                              </span>
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                +{tier.bladderDelta}% Độ No
                              </span>
                            </div>
                          </div>
                          <div className="text-xs font-black text-white">{tier.name}</div>
                          <div className="text-[10px] text-amber-400/90 font-semibold mb-1">
                            {tier.servingStyle} • {tier.price.toLocaleString()}đ
                          </div>
                          <p className="text-[10px] text-zinc-400 leading-relaxed">
                            {tier.description}
                          </p>
                        </div>
                        <div className="mt-2 pt-1.5 border-t border-zinc-800/80 text-[10px] font-bold text-amber-300">
                          {tier.specialTag}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right 5 cols: Live Cup Physics, Foam, Ice Bucket & 100% vs 50% Sip */}
              <div className="lg:col-span-5 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
                    <div>
                      <div className="text-xs font-black text-amber-400 uppercase">
                        🍺 Vật Lý Ly Của Bạn: {currentDrink.name}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        Người rót: <span className="text-white font-bold">{cupState.pouredByName}</span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-1 rounded-lg ${
                        isWarmBeer
                          ? 'bg-red-600/30 border border-red-500 text-red-300'
                          : cupState.iceCubes > 0
                          ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-200'
                          : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                      }`}
                    >
                      {isWarmBeer
                        ? '🌡️ BIA HẦM ẤM (+50% CHOÁNG!)'
                        : cupState.iceCubes > 0
                        ? `❄️ LẠNH TÊ (${cupState.iceCubes} Viên Đá)`
                        : `🍺 Mát (${120 - cupState.warmSeconds}s tới khi hầm)`}
                    </span>
                  </div>

                  {/* Interactive Visual Glass with Liquid + Foam + Ice */}
                  <div className="flex items-center gap-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl p-3 mb-3">
                    <div className="relative w-20 h-32 rounded-b-2xl border-2 border-zinc-500/80 bg-zinc-900 overflow-hidden flex flex-col justify-end shadow-inner">
                      {/* Foam Layer on Top */}
                      {cupState.liquidLevel > 0 && cupState.foamRatio > 0 && (
                        <div
                          className="w-full bg-amber-50/95 border-b border-amber-200 transition-all duration-300 flex items-center justify-center text-[9px] font-black text-zinc-800"
                          style={{
                            height: `${Math.round(
                              (cupState.liquidLevel * cupState.foamRatio) / 100
                            )}%`,
                          }}
                        >
                          BỌT {cupState.foamRatio}%
                        </div>
                      )}
                      {/* Liquid Layer */}
                      {cupState.liquidLevel > 0 && (
                        <div
                          className="w-full bg-gradient-to-t from-amber-600 to-yellow-400 transition-all duration-300 flex items-center justify-center text-[10px] font-black text-zinc-950"
                          style={{
                            height: `${Math.round(
                              (cupState.liquidLevel * (100 - cupState.foamRatio)) / 100
                            )}%`,
                          }}
                        >
                          {100 - cupState.foamRatio}%
                        </div>
                      )}
                      {/* Floating Ice Cubes */}
                      {cupState.iceCubes > 0 && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1">
                          {Array.from({ length: cupState.iceCubes }).map((_, idx) => (
                            <span key={idx} className="text-xs drop-shadow">
                              🧊
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Mực nước trong ly:</span>
                        <span className="font-mono font-black text-amber-400">
                          {cupState.liquidLevel}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Tỷ lệ Bọt / Bia:</span>
                        <span
                          className={`font-mono font-black ${
                            cupState.foamRatio >= 60 ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          {cupState.foamRatio}% Bọt / {100 - cupState.foamRatio}% Bia
                        </span>
                      </div>

                      {/* Pour Buttons */}
                      <div className="pt-1 grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => onPourDrink(false)}
                          className="py-1.5 px-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-xl text-[10px] font-black text-amber-300"
                        >
                          🍾 Rót Nghiêng Chuẩn (Ít Bọt)
                        </button>
                        <button
                          onClick={() => onPourDrink(true)}
                          className="py-1.5 px-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl text-[10px] font-black text-red-300"
                        >
                          🌊 Rót Từ Trên Cao (80% Bọt!)
                        </button>
                      </div>

                      {/* Scold Pourer Button when Foam >= 60% */}
                      {cupState.foamRatio >= 60 && (
                        <button
                          onClick={onScoldPourerAndForceDrink}
                          className="w-full py-1.5 px-2 bg-red-600 hover:bg-red-500 rounded-xl text-[10px] font-black text-white shadow-lg animate-pulse"
                        >
                          🤬 Chửi Thằng Rót & Bắt Nó Uống Luôn Ly Bọt Này!
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stainless Steel Ice Bucket Section */}
                  <div className="bg-cyan-950/30 border border-cyan-500/40 rounded-2xl p-2.5 space-y-2 mb-3">
                    <div className="text-[11px] font-black text-cyan-300 flex items-center gap-1.5">
                      <Snowflake className="w-3.5 h-3.5" />
                      <span>XÔ ĐÁ INOX & CÂY GẮP ĐÁ TRÊN BÀN</span>
                    </div>
                    <button
                      onClick={onAddIceToCup}
                      className="w-full py-1.5 px-3 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400 rounded-xl text-xs font-bold text-cyan-100"
                    >
                      🧊 Gắp 1 Viên Đá Bỏ Vào Ly (Chống Bia Hầm Ấm)
                    </button>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={iceVictimId}
                        onChange={(e) => setIceVictimId(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 rounded-xl px-2 py-1.5 text-[11px] text-white flex-1"
                      >
                        {otherPlayers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.isPassedOut ? '(Đang Gục)' : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => onThrowIceAtFriendCollar(iceVictimId)}
                        className="py-1.5 px-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-black text-white whitespace-nowrap"
                      >
                        😈 Bỏ Đá Vào Cổ Áo Bạn!
                      </button>
                    </div>
                  </div>
                </div>

                {/* Drink 100% vs 50% Nhấp Môi */}
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  {bladder >= 100 && (
                    <div className="p-2 bg-red-950/80 border border-red-500 rounded-xl text-[11px] font-bold text-red-300 text-center">
                      🚨 BỤNG BIA ĐÃ CĂNG TRÒN 100%! Phải đi WC xả ngay mới uống tiếp được!
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={bladder >= 100}
                      onClick={() => onDrinkCup('full_100')}
                      className="py-2.5 px-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-40 rounded-xl text-zinc-950 font-black text-xs shadow-lg"
                    >
                      🍻 UỐNG CẠN 100% (Chuẩn Đô)
                    </button>
                    <button
                      disabled={bladder >= 100}
                      onClick={() => onDrinkCup('sip_50')}
                      className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-amber-500/40 rounded-xl text-amber-300 font-black text-xs"
                    >
                      😏 NHẤP MÔI 50% (Lươn Lẹo)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: DRINKING TRICKS, POISON COCKTAIL & BOTTLE OPENER QTE       */}
          {/* ================================================================= */}
          {activeTab === 'tricks' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sleight of Hand: Dump in Plant / Swap Glass */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-black text-amber-400 uppercase flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Độc Chiêu 1: Đổ Bỏ / Tráo Ly (Sleight of Hand)</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Khi cả bàn đang quay đi chỗ khác, lén đổ bia vào chậu cây cảnh sau lưng hoặc tráo ly đầy của mình lấy ly rỗng của bạn bên cạnh. Cẩn thận: Nếu hiện dấu chấm than đỏ <strong className="text-red-400">(!)</strong> bị Chủ Quán bắt quả tang sẽ bị phạt uống gấp đôi!
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => onSleightOfHand('dump_plant')}
                    className="p-3 bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-500/50 rounded-xl text-xs font-black text-emerald-300 text-center"
                  >
                    🪴 Lén Nghiêng Ly Đổ Vào Chậu Cây Sau Lưng
                  </button>
                  <button
                    onClick={() => onSleightOfHand('swap_mug')}
                    className="p-3 bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/50 rounded-xl text-xs font-black text-amber-300 text-center"
                  >
                    🔄 Tráo Ly Đầy Lấy Ly Rỗng Của Bạn Bên Cạnh
                  </button>
                </div>

                {/* Empty Bottles / Cans Props */}
                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <div className="text-xs font-black text-zinc-200 flex items-center justify-between">
                    <span>🍾 Đạo Cụ Vỏ Chai / Lon Rỗng Trên Bàn</span>
                    <span className="text-amber-400">
                      Đang có: {userPlayer.emptyBottlesCount || 0} vỏ
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onUseEmptyBottles('stack_tower')}
                      className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-[11px] font-bold text-amber-300"
                    >
                      🗼 Xếp Tháp Vỏ Lon Khoe Chiến Tích
                    </button>
                    <button
                      onClick={() => onUseEmptyBottles('throw_can')}
                      className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-[11px] font-bold text-red-300"
                    >
                      🥫 Ném Vỏ Lon Vào Bạn Nhậu
                    </button>
                  </div>
                </div>
              </div>

              {/* Mix Poison Cocktail ("Bom Hỗn Hợp" -> Bỏng Mỏ 10s) */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-black text-red-400 uppercase flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-red-400" />
                  <span>Độc Chiêu 2: Pha "Bom Hỗn Hợp" (Cocktail Tà Đạo)</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Khi có người đứng dậy đi WC, lén bỏ nguyên liệu tà đạo vào ly bia của họ. Khi họ uống trúng mà không nhìn màu nước sẽ dính trạng thái <strong className="text-red-400">"BỎNG MỎ"</strong> (chạy vòng quanh bàn 3D tìm nước lọc trong 10 giây)!
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    '🌶️ Ớt hiểm đỏ',
                    '🍋 Chanh chua',
                    '🐟 Nước mắm cốt',
                    '🍶 Rượu đế nặng',
                    '🧄 Tỏi sống',
                  ].map((ing) => {
                    const active = selectedIngredients.includes(ing);
                    return (
                      <button
                        key={ing}
                        onClick={() => toggleIngredient(ing)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                          active
                            ? 'bg-red-600/30 border-red-400 text-red-200'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {ing}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <select
                    value={poisonVictimId}
                    onChange={(e) => setPoisonVictimId(e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white flex-1"
                  >
                    {otherPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        Bỏ vào ly của: {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      onMixPoisonCocktail(poisonVictimId, selectedIngredients)
                    }
                    className="py-2 px-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 rounded-xl text-xs font-black text-white shadow-lg"
                  >
                    🧪 Pha Bom Hỗn Hợp!
                  </button>
                </div>
              </div>

              {/* Artistic Bottle Opener QTE (Khui Bia Nghệ Thuật) */}
              <div className="md:col-span-2 bg-zinc-900/90 border border-purple-500/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black text-purple-300 uppercase flex items-center gap-1.5">
                    <Hammer className="w-4 h-4 text-purple-400" />
                    <span>Độc Chiêu 3: Khui Bia Nghệ Thuật (QTE Canh Lực Bật Nắp)</span>
                  </div>
                  <span className="text-[11px] text-amber-300 font-bold">
                    Trúng vạch vàng (65% - 88%): Nổ PỐC! (+25 Nắp) • Trượt: Nắp bia văng vào trán bạn đối diện!
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    '🥢 Đôi Đũa Tre',
                    '🥄 Muỗng Inox',
                    '🔥 Bật Lửa Ga',
                    '🦷 Hàm Răng Sắt',
                    '桌 Cạnh Bàn Inox',
                  ].map((tool) => (
                    <button
                      key={tool}
                      onClick={() => setOpenerTool(tool)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        openerTool === tool
                          ? 'bg-purple-600 border-purple-400 text-white'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                      }`}
                    >
                      {tool}
                    </button>
                  ))}
                </div>

                {/* QTE Bar */}
                <div className="relative h-7 bg-zinc-950 rounded-full border border-zinc-700 overflow-hidden">
                  {/* Sweet Spot Zone 65% - 88% */}
                  <div
                    className="absolute top-0 bottom-0 bg-emerald-500/35 border-x-2 border-emerald-400 flex items-center justify-center text-[10px] font-black text-emerald-200"
                    style={{ left: '65%', width: '23%' }}
                  >
                    TÂM BẬT NẮP
                  </div>
                  {/* Moving Cursor */}
                  <div
                    className="absolute top-0 bottom-0 w-2.5 bg-amber-400 shadow-lg rounded-full"
                    style={{ left: `${qteCursor}%` }}
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  {!qteRunning ? (
                    <button
                      onClick={() => setQteRunning(true)}
                      className="py-2 px-5 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-black text-white shadow-lg"
                    >
                      🎯 Bắt Đầu Canh Lực Khui Bia ({openerTool})
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setQteRunning(false);
                        const isSuccess = qteCursor >= 65 && qteCursor <= 88;
                        onBottleOpenerQTE(openerTool, isSuccess);
                      }}
                      className="py-2 px-6 bg-amber-500 hover:bg-amber-400 rounded-xl text-xs font-black text-zinc-950 shadow-lg animate-pulse"
                    >
                      💥 BẬT NẮP NGAY! ({qteCursor}%)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: BLADDER METER & 1-STALL SIDEWALK WC DRAMA                  */}
          {/* ================================================================= */}
          {activeTab === 'wc' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Belly / Bladder Status */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-black text-cyan-400 uppercase flex items-center justify-between">
                  <span>🎈 Thanh Độ No / Bụng Bia & Mắc Tiểu</span>
                  <span className="font-mono text-sm text-amber-300">{bladder}% / 100%</span>
                </div>

                <div className="h-4 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-700">
                  <div
                    className={`h-full transition-all duration-300 ${
                      bladder >= 85
                        ? 'bg-gradient-to-r from-amber-500 to-red-600 animate-pulse'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, bladder)}%` }}
                  />
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  Mỗi ly bia uống vào sẽ tăng cả <strong className="text-amber-400">Độ Cồn</strong> lẫn <strong className="text-cyan-300">Bụng Bia</strong>. Khi Bụng Bia đạt 100%, bụng nhân vật Chibi 3D sẽ phình to tròn xoe như cái trống và không thể uống hay ăn thêm! Nếu không kịp vào WC giải quyết sẽ tự <strong className="text-red-400">"xả tại ghế nhựa"</strong> mất điểm phong độ!
                </p>

                <button
                  onClick={onHoldPee}
                  className="w-full py-2.5 px-4 bg-amber-600/30 hover:bg-amber-600/40 border border-amber-400 rounded-xl text-xs font-black text-amber-200 flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>
                    😬 Giữ Phím "Nhịn Tiểu Khẩn Cấp" (Tránh Xả Tại Ghế Nhựa!)
                  </span>
                </button>
              </div>

              {/* Right: 1-Stall WC Drama */}
              <div className="bg-zinc-900/90 border border-cyan-500/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black text-white uppercase flex items-center gap-1.5">
                    <Bath className="w-4 h-4 text-cyan-400" />
                    <span>Nhà Vệ Sinh 1 Buồng Duy Nhất Góc Quán</span>
                  </div>
                  <span
                    className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                      toiletState.isOccupied || toiletState.blockerName
                        ? 'bg-red-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {toiletState.blockerName
                      ? `🚧 ${toiletState.blockerName} Chặn Cửa!`
                      : toiletState.isOccupied
                      ? `🔴 Đang Bận (${toiletState.occupantName} - ${toiletState.occupantTimeLeft}s)`
                      : '🟢 ĐANG TRỐNG — VÀO NGAY!'}
                  </span>
                </div>

                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs text-zinc-300 space-y-2">
                  {toiletState.isOccupied && (
                    <div className="text-amber-300 font-bold">
                      🚪 {toiletState.occupantName} đang chốt cửa ở lì trong buồng WC! Còn {toiletState.occupantTimeLeft} giây nữa mới chịu ra!
                    </div>
                  )}
                  {toiletState.blockerName && (
                    <div className="text-red-400 font-bold">
                      😈 {toiletState.blockerName} đang đứng khoanh tay chặn ngay trước cửa WC không cho bạn vào!
                    </div>
                  )}
                  {!toiletState.isOccupied && !toiletState.blockerName && (
                    <div className="text-emerald-300 font-bold">
                      ✨ Buồng WC đang trống! Vào xả bầu tâm sự ngay để giảm 100% Bụng Bia và hạ 25% Độ Cồn!
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <button
                    disabled={toiletState.isOccupied || !!toiletState.blockerName}
                    onClick={onEnterToilet}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 disabled:opacity-40 rounded-xl text-zinc-950 font-black text-xs shadow-lg"
                  >
                    🚽 Chạy Vào WC Giải Quyết Ngay (-100% Bụng Bia, -25% Cồn)
                  </button>

                  {toiletState.isOccupied && (
                    <button
                      onClick={onThumpToiletDoor}
                      className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-500 rounded-xl text-white font-black text-xs shadow-lg"
                    >
                      ✊ ĐẬP CỬA HỐI THÚC RẦM RẦM! (Đã đập {toiletState.doorThumpCount} lần)
                    </button>
                  )}

                  {toiletState.blockerName && (
                    <button
                      onClick={onPushToiletBlocker}
                      className="w-full py-2 px-4 bg-red-600 hover:bg-red-500 rounded-xl text-white font-black text-xs shadow-lg flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>💥 Húc Văng {toiletState.blockerName} Đang Chặn Cửa WC!</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
