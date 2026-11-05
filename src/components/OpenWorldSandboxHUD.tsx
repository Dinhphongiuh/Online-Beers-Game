import React, { useState } from 'react';
import {
  HeavyPropType,
  IKHandControlState,
  OpenWorldZoneId,
  Player,
} from '../game/types';
import {
  MapPin,
  Flame,
  CreditCard,
  Footprints,
  Hand,
  ShieldAlert,
  Sparkles,
  Users,
  ShoppingCart,
  Wind,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';

interface OpenWorldSandboxHUDProps {
  userPlayer: Player;
  players: Player[];
  ikState: IKHandControlState;
  yellowPuddleActive: boolean;
  onNavigateZone: (zone: OpenWorldZoneId) => void;
  onToggleFreeRoam: () => void;
  onToggleCrawlingMode: () => void;
  onToggleGrabSupport: () => void;
  onRecoverFaceplant: () => void;
  onTriggerDrunkInputDriftStep: () => void;
  // Kitchen actions
  onKitchenFlipGrill: (burnFood: boolean) => void;
  // Restroom Alley actions
  onAlleySneakAction: (action: 'dodge_bill' | 'pickpocket_friend' | 'ambush_wc') => void;
  // Convenience Store & ATM actions
  onAtmStoreAction: (action: 'withdraw_atm' | 'buy_sober_gum' | 'buy_night_snacks') => void;
  // Prop & Player-to-Player physics
  onCarryOrThrowHeavyProp: (prop: HeavyPropType) => void;
  onPushFoodCartCrash: () => void;
  onToggleWingmanCarry: (friendId: string) => void;
  onTackleBeerTrayFriend: () => void;
  // Off-table dynamic events
  onTriggerPatrolRetreatTable: () => void;
  onStartUrgentPeeRush: (slipOnWay: boolean) => void;
  onRivalTableAction: (action: 'steal_beer_mug' | 'flip_rival_table') => void;
}

export const OPEN_WORLD_ZONES: {
  id: OpenWorldZoneId;
  name: string;
  shortName: string;
  icon: string;
  coords: { x: number; z: number; angle: number };
  desc: string;
}[] = [
  {
    id: 'street_sidewalk',
    name: 'Khu Vỉa Hè & Lòng Đường (The Street)',
    shortName: '🛵 Vỉa Hè & Đường',
    icon: '🛵',
    coords: { x: 0, z: 2.15, angle: Math.PI },
    desc: 'Bàn nhậu chính, xe đẩy cá viên chiên, vỏ lon nắp chai & xe máy chạy qua lại.',
  },
  {
    id: 'open_kitchen',
    name: 'Khu Bếp Lộ Thiên (The Kitchen)',
    shortName: '🔥 Bếp Than Hồng',
    icon: '🔥',
    coords: { x: 1.85, z: -2.05, angle: -0.4 },
    desc: 'Bếp than nướng mực, nướng hàu mỡ hành & dao phay sáng loáng của ông chủ quán.',
  },
  {
    id: 'restroom_alley',
    name: 'Khu Vệ Sinh & Góc Tối (Restroom Alley)',
    shortName: '🚽 Hẻm WC & Góc Tối',
    icon: '🚽',
    coords: { x: -2.35, z: -1.85, angle: 0.5 },
    desc: 'Giải quyết bụng bia, góc khuất lý tưởng để lén trốn bill, móc túi hoặc đánh lén.',
  },
  {
    id: 'convenience_atm',
    name: 'Khu Tạp Hóa / Cây ATM (Corner Store)',
    shortName: '🏧 Tạp Hóa & ATM',
    icon: '🏧',
    coords: { x: -2.35, z: 1.25, angle: 0.6 },
    desc: 'Rút tiền ATM khi cháy túi, mua kẹo cao su giải rượu & mua thêm mồi xuyên đêm.',
  },
];

export const OpenWorldSandboxHUD: React.FC<OpenWorldSandboxHUDProps> = ({
  userPlayer,
  players,
  ikState,
  yellowPuddleActive,
  onNavigateZone,
  onToggleFreeRoam,
  onToggleCrawlingMode,
  onToggleGrabSupport,
  onRecoverFaceplant,
  onTriggerDrunkInputDriftStep,
  onKitchenFlipGrill,
  onAlleySneakAction,
  onAtmStoreAction,
  onCarryOrThrowHeavyProp,
  onPushFoodCartCrash,
  onToggleWingmanCarry,
  onTackleBeerTrayFriend,
  onTriggerPatrolRetreatTable,
  onStartUrgentPeeRush,
  onRivalTableAction,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'zones' | 'locomotion' | 'props_pvp' | 'events'
  >('zones');

  const currentZone =
    OPEN_WORLD_ZONES.find((z) => z.id === (ikState.activeZone || 'street_sidewalk')) ||
    OPEN_WORLD_ZONES[0];

  const isFreeRoam = ikState.controlMode === 'free_roam';
  const npcFriends = players.filter((p) => !p.isUser);

  return (
    <div className="fixed bottom-[6.5rem] right-3 z-20 pointer-events-auto flex flex-col items-end gap-1.5 max-w-[95vw]">
      {/* Faceplant / Cleaver Chase / Crawling Quick Alert Banner */}
      {ikState.isFaceplanted && (
        <div className="bg-rose-950/95 border-2 border-rose-400 rounded-2xl px-3.5 py-2 shadow-2xl flex items-center gap-2.5 text-white animate-bounce">
          <span className="text-xl">🤕</span>
          <div>
            <div className="text-xs font-black text-rose-300">
              VẤP KÉT BIA NGÃ SẤP MẶT (FACEPLANT)!
            </div>
            <div className="text-[10px] text-zinc-200">
              Độ cồn cao làm lệch hướng đi (Input Drift)!
            </div>
          </div>
          <button
            onClick={onRecoverFaceplant}
            className="px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[11px] font-black flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Chống Tay Dậy</span>
          </button>
        </div>
      )}

      {ikState.isChasedByCleaverChef && (
        <div className="bg-orange-950/95 border-2 border-amber-400 rounded-2xl px-3.5 py-2 shadow-2xl flex items-center gap-2 text-white animate-pulse">
          <span className="text-xl">🔪🤬</span>
          <div className="text-[11px] font-black text-amber-200">
            LÀM CHÁY KHÉT MỰC NƯỚNG! Ông chủ quán Tư Đực đang cầm Dao Phay rượt bạn khắp quán!
          </div>
        </div>
      )}

      {/* Main Toggle Pill: "🗺️ Tổ Hợp Ăn Chơi Xuyên Đêm (Open-World Sandbox)" */}
      <div className="flex items-center gap-1.5">
        {!isFreeRoam && (
          <button
            onClick={() => {
              onToggleFreeRoam();
              setIsExpanded(true);
            }}
            className="px-3 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-xl border border-emerald-300/50 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <Footprints className="w-4 h-4 animate-bounce" />
            <span className="hidden sm:inline">Đứng Dậy Đi Dạo Khắp Quán [E]</span>
            <span className="sm:hidden">Đi Dạo</span>
          </button>
        )}

        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className={`px-3.5 py-2 rounded-2xl border text-xs font-black shadow-2xl flex items-center gap-2 cursor-pointer active:scale-95 transition-all ${
            isExpanded || isFreeRoam
              ? 'bg-zinc-950/95 border-amber-400 text-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.3)]'
              : 'bg-zinc-900/92 border-zinc-700 text-zinc-100 hover:border-amber-400/60'
          }`}
        >
          <span>🗺️<span className="hidden sm:inline"> Tổ Hợp Phố Nhậu Open-World</span></span>
          <span className="hidden sm:inline px-1.5 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-[10px] text-amber-200">
            {currentZone.shortName}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Expanded Open-World Sandbox Control Panel */}
      {isExpanded && (
        <div className="w-[410px] max-w-[95vw] bg-zinc-950/95 border-2 border-amber-500/70 rounded-3xl p-3.5 shadow-[0_0_45px_rgba(0,0,0,0.85)] text-white backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Top Header & Free-Roam Status */}
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2.5 mb-2.5">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>TỔ HỢP ĂN CHƠI XUYÊN ĐÊM (OPEN-WORLD SANDBOX)</span>
              </div>
              <div className="text-xs font-black text-white mt-0.5">
                Đang ở: <span className="text-emerald-300">{currentZone.name}</span>
              </div>
            </div>

            <button
              onClick={onToggleFreeRoam}
              className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border cursor-pointer shrink-0 transition-all ${
                isFreeRoam
                  ? 'bg-emerald-500 text-zinc-950 border-emerald-200'
                  : 'bg-amber-500 text-zinc-950 border-amber-200'
              }`}
            >
              {isFreeRoam ? '🪑 Về Ngồi Bàn' : '🏃 Đứng Dậy Tự Do'}
            </button>
          </div>

          {/* 4 Sandbox Feature Tabs */}
          <div className="grid grid-cols-4 gap-1 bg-zinc-900 p-1 rounded-2xl mb-2.5 border border-zinc-800">
            {[
              { id: 'zones', label: '🗺️ 4 Khu Vực' },
              { id: 'locomotion', label: '🤸 Bò & Vịn' },
              { id: 'props_pvp', label: '🪭 Khiêng/Phang' },
              { id: 'events', label: '🚨 Sự Kiện' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() =>
                  setActiveTab(
                    t.id as 'zones' | 'locomotion' | 'props_pvp' | 'events'
                  )
                }
                className={`py-1.5 px-1 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-amber-500 text-zinc-950 shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 1: 4 KHU VỰC KẾT NỐI LIỀN MẠCH ("TỔ HỢP ĂN CHƠI XUYÊN ĐÊM") */}
          {activeTab === 'zones' && (
            <div className="space-y-2.5">
              {/* Zone Selector Grid */}
              <div className="grid grid-cols-2 gap-1.5">
                {OPEN_WORLD_ZONES.map((z) => {
                  const active = currentZone.id === z.id;
                  return (
                    <button
                      key={z.id}
                      onClick={() => onNavigateZone(z.id)}
                      className={`p-2 rounded-2xl border text-left transition-all cursor-pointer active:scale-95 ${
                        active
                          ? 'bg-emerald-950/80 border-emerald-400 text-white shadow-lg'
                          : 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                      }`}
                    >
                      <div className="text-xs font-black flex items-center justify-between">
                        <span>{z.shortName}</span>
                        {active && (
                          <span className="text-[9px] bg-emerald-500 text-zinc-950 px-1.5 rounded font-black">
                            ĐANG ĐỨNG
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2 leading-tight">
                        {z.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Contextual Zone Interactions */}
              {currentZone.id === 'open_kitchen' && (
                <div className="bg-orange-950/40 border border-orange-500/50 rounded-2xl p-2.5 space-y-1.5">
                  <div className="text-[11px] font-black text-orange-300 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> TƯƠNG TÁC KHU BẾP LỘ THIÊN:
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => onKitchenFlipGrill(false)}
                      className="p-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/45 border border-amber-400/60 text-left cursor-pointer active:scale-95"
                    >
                      <div className="text-xs font-black text-amber-200">
                        🦑 Lật Mực & Hàu Mỡ Hành
                      </div>
                      <div className="text-[10px] text-zinc-300">
                        Nướng thơm phức (-15% Cồn, +35 Xu)
                      </div>
                    </button>
                    <button
                      onClick={() => onKitchenFlipGrill(true)}
                      className="p-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/45 border border-rose-400/60 text-left cursor-pointer active:scale-95"
                    >
                      <div className="text-xs font-black text-rose-200">
                        🔥 Làm Cháy Khét Đồ Nướng!
                      </div>
                      <div className="text-[10px] text-zinc-300">
                        Chủ quán cầm Dao Phay rượt chém!
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {currentZone.id === 'restroom_alley' && (
                <div className="bg-purple-950/40 border border-purple-500/50 rounded-2xl p-2.5 space-y-1.5">
                  <div className="text-[11px] font-black text-purple-300">
                    🚽 TƯƠNG TÁC KHU VỆ SINH & GÓC TỐI:
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => onAlleySneakAction('dodge_bill')}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-purple-400/50 text-left cursor-pointer active:scale-95"
                    >
                      <div className="text-[11px] font-black text-purple-200">
                        🥷 Nấp Trốn Bill
                      </div>
                      <div className="text-[9px] text-zinc-400">
                        Lén lút né trả tiền bàn nhậu
                      </div>
                    </button>
                    <button
                      onClick={() => onAlleySneakAction('pickpocket_friend')}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-amber-400/50 text-left cursor-pointer active:scale-95"
                    >
                      <div className="text-[11px] font-black text-amber-200">
                        👛 Móc Túi Bạn
                      </div>
                      <div className="text-[9px] text-zinc-400">
                        Chôm nhẹ +55 Nắp Bia trong góc tối
                      </div>
                    </button>
                    <button
                      onClick={() => onAlleySneakAction('ambush_wc')}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-rose-400/50 text-left cursor-pointer active:scale-95"
                    >
                      <div className="text-[11px] font-black text-rose-200">
                        🥊 Đánh Lén WC
                      </div>
                      <div className="text-[9px] text-zinc-400">
                        Úp sọt đồng đội đang đi vệ sinh
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {currentZone.id === 'convenience_atm' && (
                <div className="bg-blue-950/40 border border-sky-500/50 rounded-2xl p-2.5 space-y-1.5">
                  <div className="text-[11px] font-black text-sky-300 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5" /> TƯƠNG TÁC TẠP HÓA & CÂY ATM 24/7:
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => onAtmStoreAction('withdraw_atm')}
                      className="p-2 rounded-xl bg-sky-600/30 hover:bg-sky-600/45 border border-sky-400/60 text-left cursor-pointer active:scale-95"
                    >
                      <div className="text-[11px] font-black text-sky-200">
                        🏧 Rút Tiền ATM
                      </div>
                      <div className="text-[9px] text-zinc-300">
                        Nhận ngay +300 Nắp Bia nhậu tiếp!
                      </div>
                    </button>
                    <button
                      onClick={() => onAtmStoreAction('buy_sober_gum')}
                      className="p-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/45 border border-emerald-400/60 text-left cursor-pointer active:scale-95"
                    >
                      <div className="text-[11px] font-black text-emerald-200">
                        🍬 Kẹo Giải Rượu
                      </div>
                      <div className="text-[9px] text-zinc-300">
                        Hạ 25% Độ Cồn & thơm miệng
                      </div>
                    </button>
                    <button
                      onClick={() => onAtmStoreAction('buy_night_snacks')}
                      className="p-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/45 border border-amber-400/60 text-left cursor-pointer active:scale-95"
                    >
                      <div className="text-[11px] font-black text-amber-200">
                        🥜 Mua Thêm Mồi
                      </div>
                      <div className="text-[9px] text-zinc-300">
                        Đầy ắp mồi mới lên bàn nhậu
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {currentZone.id === 'street_sidewalk' && (
                <div className="bg-zinc-900/90 border border-zinc-700 rounded-2xl p-2.5 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-zinc-300">
                    🛵 Bạn đang ở <b>Vỉa Hè & Lòng Đường</b>. Bấm vào các khu vực trên hoặc dùng phím <b>WASD</b> để đi bộ khám phá!
                  </div>
                  <button
                    onClick={onTriggerDrunkInputDriftStep}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[10px] font-black shrink-0 cursor-pointer"
                  >
                    🥴 Bước Đi Loạng Choạng
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CƠ CHẾ DI CHUYỂN TỰ DO & RAGDOLL (INPUT DRIFT, GRAB & HOLD, BÒ LÊ BÒ LẾT) */}
          {activeTab === 'locomotion' && (
            <div className="space-y-2">
              {/* 1. Drunk Input Drift & Faceplant */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-black text-amber-300">
                    1. Di Chuyển Tự Do & Giải Rượu (Locomotion & Sobering)
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Độ cồn: <b>{Math.round(userPlayer.alcoholLevel)}%</b> — Đi bộ vận động toát mồ hôi giúp <b>GIẢI RƯỢU (-1% Cồn/12 bước)</b>! Say rượu chân sẽ loạng choạng (Input Drift).
                  </div>
                </div>
                <button
                  onClick={onTriggerDrunkInputDriftStep}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[10px] font-black shrink-0 cursor-pointer active:scale-95"
                >
                  🚶 Bước Đi Giã Rượu [W]
                </button>
              </div>

              {/* 2. Grab & Hold Support Button */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-black text-cyan-300 flex items-center gap-1">
                    <Hand className="w-3.5 h-3.5" /> 2. Nút "Bám Vịn" (Grab & Hold - Chuột Phải)
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Hai bàn tay bám chặt vào tường / bậc thềm để không bị vấp ngã khi say.
                  </div>
                </div>
                <button
                  onClick={onToggleGrabSupport}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black shrink-0 cursor-pointer transition-all ${
                    ikState.isHoldingGrabSupport
                      ? 'bg-cyan-400 text-zinc-950 shadow-lg'
                      : 'bg-zinc-800 text-cyan-300 border border-cyan-500/50'
                  }`}
                >
                  {ikState.isHoldingGrabSupport ? '🖐️ Đang Bám Chặt' : '🖐️ Bật Bám Vịn'}
                </button>
              </div>

              {/* 3. Crawling Mode ("Bò Lê Bò Lết" >85% alcohol) */}
              <div className="bg-zinc-900/90 border border-emerald-500/40 rounded-2xl p-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-black text-emerald-300">
                    3. Kỹ Năng "Bò Lê Bò Lết" (Crawling Mode Tứ Chi)
                  </div>
                  <div className="text-[10px] text-zinc-300">
                    Tự kích hoạt khi cồn &gt; 85% hoặc sau cú ngã: Bò sát đất <b>BẤT TỬ 100%</b> trước xe máy Exciter & đòn đánh ngang!
                  </div>
                </div>
                <button
                  onClick={onToggleCrawlingMode}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black shrink-0 cursor-pointer transition-all ${
                    ikState.isCrawlingMode
                      ? 'bg-emerald-400 text-zinc-950 shadow-lg'
                      : 'bg-zinc-800 text-emerald-300 border border-emerald-500/50'
                  }`}
                >
                  {ikState.isCrawlingMode ? '🐢 Đang Bò Tứ Chi' : '🐢 Bò Lê Bò Lết'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: ĐẠO CỤ KHỔNG LỒ, XE ĐẨY HÀNG & DÌU BẠN SAY (PROP & PVP PHYSICS) */}
          {activeTab === 'props_pvp' && (
            <div className="space-y-2.5">
              {/* A. Carry & Throw Giant Props */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-300 mb-1 flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5" /> A. Khiêng & Ném Đồ Vật Khổng Lồ (Bằng 2 Tay):
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    {
                      id: 'industrial_fan' as HeavyPropType,
                      label: '🪭 Quạt Máy Đứng',
                      sub: 'Ôm quạt ném dằn mặt',
                    },
                    {
                      id: 'ice_bucket_giant' as HeavyPropType,
                      label: '🪣 Thùng Nước Đá',
                      sub: 'Tạt văng cả tảng đá',
                    },
                    {
                      id: 'plastic_stool' as HeavyPropType,
                      label: '🪑 Ghế Nhựa Đỏ',
                      sub: 'Vũ khí quốc dân vỉa hè',
                    },
                  ].map((prop) => {
                    const carrying = ikState.carriedHeavyProp === prop.id;
                    return (
                      <button
                        key={prop.id}
                        onClick={() => onCarryOrThrowHeavyProp(prop.id)}
                        className={`p-2 rounded-xl border text-left cursor-pointer active:scale-95 transition-all ${
                          carrying
                            ? 'bg-amber-500 text-zinc-950 border-white font-black'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:border-amber-400'
                        }`}
                      >
                        <div className="text-[11px] font-black">{prop.label}</div>
                        <div
                          className={`text-[9px] mt-0.5 ${
                            carrying ? 'text-zinc-900 font-bold' : 'text-zinc-400'
                          }`}
                        >
                          {carrying ? '💥 BẤM ĐỂ NÉM NGAY!' : prop.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Push Street Food Cart Crash */}
              <button
                onClick={onPushFoodCartCrash}
                className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 text-white text-left shadow-lg flex items-center justify-between cursor-pointer active:scale-95"
              >
                <div>
                  <div className="text-xs font-black flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4" />
                    <span>🛒 Đẩy Xe Cá Viên Chiên Tông Sập Bàn Đối Thủ!</span>
                  </div>
                  <div className="text-[10px] text-orange-100">
                    Leo lên đẩy xe hàng tông thẳng vào bàn bên cạnh làm đổ sạch đồ ăn thức uống!
                  </div>
                </div>
                <span className="text-[10px] bg-black/30 px-2 py-1 rounded-lg font-black shrink-0">
                  TÔNG NGAY
                </span>
              </button>

              {/* B. Player-to-Player Physics: Wingman Carry & Tackle */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300 mb-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> B. Dìu/Kéo Lê Bạn Say (Wingman Carry) & Húc Vai:
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {npcFriends.map((friend) => {
                    const isDragging = ikState.draggingFriendId === friend.id;
                    return (
                      <button
                        key={friend.id}
                        onClick={() => onToggleWingmanCarry(friend.id)}
                        className={`p-1.5 rounded-xl border text-center cursor-pointer active:scale-95 ${
                          isDragging
                            ? 'bg-emerald-500 text-zinc-950 border-white font-black'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:border-emerald-400'
                        }`}
                      >
                        <div className="text-[10px] font-black truncate">
                          {isDragging ? `Đang Kéo ${friend.name}` : `Kéo ${friend.name}`}
                        </div>
                        <div className="text-[9px] opacity-80">
                          {isDragging ? 'Bấm giấu vào WC' : 'Tóm chân kéo lê'}
                        </div>
                      </button>
                    );
                  })}
                  <button
                    onClick={onTackleBeerTrayFriend}
                    className="p-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 border border-rose-400 text-center cursor-pointer active:scale-95"
                  >
                    <div className="text-[10px] font-black text-rose-200">
                      💥 Húc Vai
                    </div>
                    <div className="text-[9px] text-zinc-300">
                      Văng khay bia
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CÁC TÌNH HUỐNG DỞ KHÓC DỞ CƯỜI KHI RỜI KHỎI BÀN */}
          {activeTab === 'events' && (
            <div className="space-y-2">
              {/* 1. Dynamic Patrol Event */}
              <div className="bg-zinc-900/90 border border-rose-500/50 rounded-2xl p-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-black text-rose-300 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> 1. Công An Phường Đi Tuần!
                  </div>
                  <div className="text-[10px] text-zinc-300">
                    Chạy vội về bàn hợp sức bê nguyên cái bàn inox & ghế nhựa lùi vào vạch sơn trắng!
                  </div>
                </div>
                <button
                  onClick={onTriggerPatrolRetreatTable}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black shrink-0 cursor-pointer active:scale-95"
                >
                  🚨 Bê Bàn Chạy!
                </button>
              </div>

              {/* 2. The Urgent Pee Rush */}
              <div className="bg-zinc-900/90 border border-yellow-500/50 rounded-2xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black text-yellow-300 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> 2. Cuộc Đua Đi Tìm Nhà Vệ Sinh (100% Bụng Bia)
                  </div>
                  {yellowPuddleActive && (
                    <span className="text-[9px] bg-yellow-400 text-zinc-950 px-1.5 py-0.5 rounded font-black">
                      ⚠️ CÓ VŨNG NƯỚC VÀNG!
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-300">
                  Hai tay ôm bụng cắm cổ chạy đi WC. Nếu va chạm/vấp ngã sẽ để lại <b>vũng nước vàng</b> trên vỉa hè khiến ai đi qua cũng trượt ngã!
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => onStartUrgentPeeRush(false)}
                    className="py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black cursor-pointer active:scale-95"
                  >
                    🏃‍♂️🚽 Ôm Bụng Chạy Kịp Tới WC
                  </button>
                  <button
                    onClick={() => onStartUrgentPeeRush(true)}
                    className="py-1.5 px-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-[10px] font-black cursor-pointer active:scale-95"
                  >
                    💥💦 Vấp Ngã Ra Vũng Nước Vàng!
                  </button>
                </div>
              </div>

              {/* 3. Uncivilized Rival Table Interaction */}
              <div className="bg-zinc-900/90 border border-amber-500/50 rounded-2xl p-2.5 space-y-1.5">
                <div className="text-xs font-black text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> 3. Đi "Giao Lưu" Kém Văn Minh Với Bàn Khác:
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => onRivalTableAction('steal_beer_mug')}
                    className="py-1.5 px-2 rounded-xl bg-amber-600/35 hover:bg-amber-600/50 border border-amber-400 text-amber-200 text-[10px] font-black cursor-pointer active:scale-95"
                  >
                    🍺🥷 Chôm Ly Bia Bàn Bên Chạy Về
                  </button>
                  <button
                    onClick={() => onRivalTableAction('flip_rival_table')}
                    className="py-1.5 px-2 rounded-xl bg-rose-600/35 hover:bg-rose-600/50 border border-rose-400 text-rose-200 text-[10px] font-black cursor-pointer active:scale-95"
                  >
                    ╯°□°）╯︵ ┻━┻ Lật Úp Bàn Đối Thủ!
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
