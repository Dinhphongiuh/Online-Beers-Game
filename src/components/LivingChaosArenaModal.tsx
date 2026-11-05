import React, { useEffect, useState } from 'react';
import { Player } from '../game/types';
import {
  Flame,
  Volume2,
  Ticket,
  CloudRain,
  ShieldAlert,
  Dog,
  Sparkles,
  X,
  Tv,
  Bell,
  Clock,
  Bike,
  Umbrella,
  PhoneCall,
  PhoneOff,
  Mic,
  Soup,
  PartyPopper,
  VolumeX,
} from 'lucide-react';

export type DrunkArchetypeId =
  | 'none'
  | 'philosopher'
  | 'boxer'
  | 'mr_rich'
  | 'lion_puker'
  | 'ninja_escape';

export type PartyStageId = 'sidewalk_stage1' | 'taxi_transfer' | 'karaoke_stage2';

export interface ChaosArenaState {
  brokenGlassesCount: number;
  isKaraokeActive: boolean;
  karaokeSongName: string;
  hasHungPhanBuff: boolean;
  lotteryTickets: string[];
  lastLotteryDraw: string | null;
  isLotteryWinner: boolean | null;
  cauVangAffinity: number; // 0..100
  droppedMorselsEatenByDog: number;
  isRaining: boolean;
  isTarpPulled: boolean;
  rainCountdown: number;
  urbanPatrolActive: boolean;
  urbanPatrolCountdown: number;
  neighborBrawlActive: boolean;
  currentMatchPhase: 1 | 2 | 3 | 4;

  // 6 NEW MEME GENERATOR SYSTEMS
  drunkSubtitleBubble: {
    originalText: string;
    translatedMemeText: string;
  } | null;
  exCallQTEActive: boolean;
  exCallCountdown: number;
  exCallSnatchClicks: number;
  isLovesickUnderTable: boolean;
  lovesickTimer: number;

  wifeCallActive: boolean;
  wifeCallCountdown: number;
  wifeCallNoiseLevel: number; // 0..100 (over 80 = busted by giant slipper!)
  isSummonedByWife: boolean;

  activeArchetype: DrunkArchetypeId;
  rainbowPuddleActive: boolean;

  partyStage: PartyStageId;
  karaokeScore: number;
  karaokeGoldenMicHolder: string;
}

export const DRUNK_ARCHETYPES: {
  id: DrunkArchetypeId;
  name: string;
  icon: string;
  badge: string;
  desc: string;
  effectText: string;
}[] = [
  {
    id: 'philosopher',
    name: 'Hệ Triết Gia (The Philosopher)',
    icon: '🧐',
    badge: 'Đeo Kính Trắng Giảng Đạo Lý',
    desc: 'Tự động đeo kính trắng, đứng lên ghế nhựa chỉ tay lên trời giảng đạo lý làm cả bàn buồn ngủ!',
    effectText: 'Gây buồn ngủ (-15% Tỉnh Táo) cho bạn nhậu xung quanh',
  },
  {
    id: 'boxer',
    name: 'Hệ Võ Sĩ (The Boxer)',
    icon: '🥊',
    badge: 'Máu Chiến +200%',
    desc: 'Nhìn cái ghế nhựa hay cột điện cũng tưởng là đối thủ! Lực đẩy và ném đồ vật mạnh gấp đôi!',
    effectText: 'x2 Lực Húc Đầu & Ném Ghế Nhựa (Bất phân địch ta)',
  },
  {
    id: 'mr_rich',
    name: 'Hệ Hào Phóng (Mr. Rich)',
    icon: '💸',
    badge: 'Mưa Tiền Đại Gia',
    desc: 'Rút ví ném xu Nắp Bia tung tóe ra bàn như mưa! Bạn bè bò ra đất lượm xu rần rần!',
    effectText: 'Tặng mưa tiền quanh bàn & Nhận danh hiệu "Tổng Tài Phát Tiền"',
  },
  {
    id: 'lion_puker',
    name: 'Hệ Sư Tử ("Cho Chó Ăn Chè")',
    icon: '🌈',
    badge: 'Phun Cầu Vồng 3D',
    desc: 'Ôm miệng mặt xanh lè! Phun hiệu ứng Cầu Vồng Pixel hài hước ra sàn làm ai dẫm phải trượt ngã liên hoàn!',
    effectText: 'Tạo Vũng Cầu Vồng 3D dưới chân bàn gây trượt té Ragdoll',
  },
  {
    id: 'ninja_escape',
    name: 'Hệ Ninja (Chúa Tể Trốn Về)',
    icon: '🥷',
    badge: 'Tàng Hình Bò Sát Đất',
    desc: 'Khi gần đến giờ tính tiền, kích hoạt tàng hình nhẹ hoặc bò sát đất lủi ra phía xe máy trốn trả Bill!',
    effectText: 'Miễn nhiễm 80% bị gán Hóa Đơn cuối trận',
  },
];

export const DRUNK_AUTO_SUBTITLES: { input: string; output: string }[] = [
  {
    input: 'Gắp miếng mồi coi!',
    output: '😭 "Tao nói thật với mày nhé, tao coi mày như anh em ruột thịt!"',
  },
  {
    input: 'Uống từ từ thôi anh em!',
    output: '🤬 "Tao chưa say!! Đứa nào vừa bảo tao say bước ra đây?!"',
  },
  {
    input: 'Thôi muộn rồi tính tiền về đi!',
    output: '🍻 "Mới uống có 2 két mà về cái gì! Đứa nào về trước làm con chó!"',
  },
  {
    input: 'Cho xin cốc trà đá giải rượu!',
    output: '💔 "Em Trang ơi sao em nỡ bỏ anh theo thằng đi SH... Hu hu!"',
  },
];

interface LivingChaosArenaModalProps {
  initialTab?: 'meme_systems' | 'npcs' | 'events' | 'flow';
  userPlayer: Player;
  arenaState: ChaosArenaState;
  totalBill: number;
  onTriggerDrunkSubtitle: (original: string, translated: string) => void;
  onStartExCallQTE: () => void;
  onSnatchExPhone: () => void;
  onStartWifeCallStealth: () => void;
  onShushFriendsDuringWifeCall: () => void;
  onSabotageShoutDuringWifeCall: () => void;
  onActivateArchetype: (archetype: DrunkArchetypeId) => void;
  onCompleteHotpotBeefDip: (result: 'perfect_5s' | 'overcooked' | 'stolen_by_friend' | 'spilled_pot') => void;
  onChangePartyStage: (stage: PartyStageId) => void;
  onSingKaraokeBeat: () => void;
  onCallWaiterRefill: () => void;
  onSmashGlassProvokeLandlady: () => void;
  onTriggerLandladySlipperSniper: () => void;
  onToggleKaraokeArrival: () => void;
  onHandleKaraokeChoice: (choice: 'buy_gum' | 'steal_mic' | 'push_speaker') => void;
  onBuyLotteryTicket: () => void;
  onDrawLotteryTV: () => void;
  onToastNeighborTable: () => void;
  onProvokeNeighborBrawl: () => void;
  onFeedCauVang: () => void;
  onTriggerRainEvent: () => void;
  onPullRainTarp: () => void;
  onTriggerUrbanPatrol: () => void;
  onRetreatTableBehindWhiteLine: () => void;
  onStepIntoMotorbikeLane: () => void;
  onTossBottleIntoCrate: () => void;
  onSelectMatchPhase: (phase: 1 | 2 | 3 | 4) => void;
  onClose: () => void;
}

export const LivingChaosArenaModal: React.FC<LivingChaosArenaModalProps> = ({
  initialTab = 'meme_systems',
  userPlayer,
  arenaState,
  totalBill,
  onTriggerDrunkSubtitle,
  onStartExCallQTE,
  onSnatchExPhone,
  onStartWifeCallStealth,
  onShushFriendsDuringWifeCall,
  onSabotageShoutDuringWifeCall,
  onActivateArchetype,
  onCompleteHotpotBeefDip,
  onChangePartyStage,
  onSingKaraokeBeat,
  onCallWaiterRefill,
  onSmashGlassProvokeLandlady,
  onTriggerLandladySlipperSniper,
  onToggleKaraokeArrival,
  onHandleKaraokeChoice,
  onBuyLotteryTicket,
  onDrawLotteryTV,
  onToastNeighborTable,
  onProvokeNeighborBrawl,
  onFeedCauVang,
  onTriggerRainEvent,
  onPullRainTarp,
  onTriggerUrbanPatrol,
  onRetreatTableBehindWhiteLine,
  onStepIntoMotorbikeLane,
  onTossBottleIntoCrate,
  onSelectMatchPhase,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'meme_systems' | 'npcs' | 'events' | 'flow'>(
    initialTab
  );

  // Interactive 5-Second Hotpot Beef Dipping State
  const [isDippingBeef, setIsDippingBeef] = useState(false);
  const [dipSeconds, setDipSeconds] = useState(0);
  const [rivalStealingBeef, setRivalStealingBeef] = useState(false);

  useEffect(() => {
    if (!isDippingBeef) return;
    const start = performance.now();
    const timer = setInterval(() => {
      const elapsed = Number(((performance.now() - start) / 1000).toFixed(1));
      setDipSeconds(elapsed);
      if (elapsed >= 3.6 && elapsed <= 4.6) {
        setRivalStealingBeef(true);
      } else {
        setRivalStealingBeef(false);
      }
      if (elapsed >= 7.5) {
        setIsDippingBeef(false);
        setRivalStealingBeef(false);
        onCompleteHotpotBeefDip('overcooked');
      }
    }, 100);
    return () => clearInterval(timer);
  }, [isDippingBeef]);

  const handlePullOutBeef = () => {
    setIsDippingBeef(false);
    setRivalStealingBeef(false);
    if (dipSeconds >= 4.2 && dipSeconds <= 5.6) {
      onCompleteHotpotBeefDip('perfect_5s');
    } else if (dipSeconds > 5.6) {
      onCompleteHotpotBeefDip('overcooked');
    } else {
      onCompleteHotpotBeefDip('stolen_by_friend');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-5xl bg-zinc-950 border-2 border-amber-500/80 rounded-3xl p-4 sm:p-5 shadow-2xl text-white max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl">
              🏮
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-amber-300 tracking-wide">
                  QUÁN NHẬU TƯ ĐỰC & CỖ MÁY SẢN XUẤT MEME BÀN NHẬU
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  LIVING CHAOS & 6 HỆ THỐNG MEME
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Nói xàm khi say, Bắt gọi Người Yêu Cũ, Điện thoại Nóc Nhà 🐅, 5 Hệ tư tưởng khi say, Nhúng bò Lẩu Thái 5s & Tăng 2 Karaoke!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3 shrink-0">
          <button
            onClick={() => setActiveTab('meme_systems')}
            className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition cursor-pointer ${
              activeTab === 'meme_systems'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 border-amber-200 shadow-lg'
                : 'bg-zinc-900 text-amber-300 border-amber-500/30 hover:bg-zinc-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>1. 6 HỆ THỐNG MEME (MỚI)</span>
          </button>

          <button
            onClick={() => setActiveTab('npcs')}
            className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition cursor-pointer ${
              activeTab === 'npcs'
                ? 'bg-amber-500 text-zinc-950 border-amber-300 shadow-lg'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>2. 5 NPC VỈA HÈ</span>
          </button>

          <button
            onClick={() => setActiveTab('events')}
            className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition cursor-pointer ${
              activeTab === 'events'
                ? 'bg-sky-500 text-zinc-950 border-sky-300 shadow-lg'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            <CloudRain className="w-4 h-4" />
            <span>3. MƯA RÀO • ĐÔ THỊ</span>
          </button>

          <button
            onClick={() => setActiveTab('flow')}
            className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition cursor-pointer ${
              activeTab === 'flow'
                ? 'bg-emerald-500 text-zinc-950 border-emerald-300 shadow-lg'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>4. LUỒNG 15–20 PHÚT</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {activeTab === 'meme_systems' && (
            <div className="space-y-3">
              {/* Row 1: Hệ thống 1 (Nói Xàm Khi Say & Gọi Người Yêu Cũ) + Hệ thống 2 (Điện Thoại Nóc Nhà 8s) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Nói Xàm Khi Say & Bắt Gọi Người Yêu Cũ */}
                <div className="bg-zinc-900/95 border border-purple-500/40 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-black text-purple-300">
                        🗣️ 1. "Rượu Vào Lời Ra" & Gọi Người Yêu Cũ (85% Cồn)
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-500/20 text-purple-200">
                        Auto-Subtitles & QTE
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mb-2">
                      Khi cồn vượt 75%, nói câu bình thường vào Mic sẽ bị dịch sai thành câu thoại kinh điển của dân nhậu! Ở 85% cồn, tự động rút điện thoại gọi <strong>Người Yêu Cũ</strong> (bạn bè có 10s giật điện thoại ném đi!).
                    </p>

                    <div className="space-y-1 mb-2.5">
                      <div className="text-[10px] font-bold text-zinc-300">
                        💬 Bấm nói thử để xem Bong Bóng Chat dịch sai trên đầu nhân vật:
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DRUNK_AUTO_SUBTITLES.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => onTriggerDrunkSubtitle(item.input, item.output)}
                            className="p-1.5 rounded-xl bg-zinc-950 hover:bg-purple-950/50 border border-zinc-800 hover:border-purple-400/50 text-left transition cursor-pointer"
                          >
                            <div className="text-[10px] font-bold text-zinc-400 truncate">
                              Nói: "{item.input}"
                            </div>
                            <div className="text-[10px] font-black text-purple-300 truncate">
                              ➔ {item.output}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Drunk Dialing Ex QTE Box */}
                  <div className="bg-zinc-950/90 border border-rose-500/40 rounded-xl p-2.5 flex items-center justify-between gap-2">
                    <div className="text-[11px]">
                      <div className="font-black text-rose-300">
                        💔 Bắt Gọi Điện Cho Người Yêu Cũ (10s QTE)
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {arenaState.exCallQTEActive
                          ? `ĐANG BẤM SỐ! Giật điện thoại (${arenaState.exCallSnatchClicks}/5) - Còn ${arenaState.exCallCountdown}s!`
                          : arenaState.isLovesickUnderTable
                          ? `😭 Đang ngồi bó gối Suy Tình dưới gầm bàn (${arenaState.lovesickTimer}s)!`
                          : 'Không giật kịp sẽ ngồi khóc Suy Tình dưới gầm bàn 30s!'}
                      </div>
                    </div>
                    {arenaState.exCallQTEActive ? (
                      <button
                        onClick={onSnatchExPhone}
                        className="py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs shrink-0 animate-bounce cursor-pointer"
                      >
                        📱 GIẬT ĐIỆN THOẠI ({arenaState.exCallSnatchClicks}/5)
                      </button>
                    ) : (
                      <button
                        onClick={onStartExCallQTE}
                        className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shrink-0 cursor-pointer transition"
                      >
                        📲 Rút ĐT Gọi NYC!
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Hệ Thống "Điện Thoại Nóc Nhà 🐅 / Mẹ Yêu" (Stealth 8 Giây) */}
                <div className="bg-zinc-900/95 border border-rose-500/50 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-black text-rose-300 flex items-center gap-1.5">
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>2. "Điện Thoại Nóc Nhà 🐅" (Stealth 8 Giây Im Lặng)</span>
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded ${
                          arenaState.wifeCallActive
                            ? 'bg-rose-500 text-white animate-ping'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {arenaState.wifeCallActive
                          ? `ĐANG NGHE MÁY (${arenaState.wifeCallCountdown}s)`
                          : 'Chờ Cuộc Gọi'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mb-2">
                      Nóc Nhà gọi: <em>"Anh đang ở đâu đấy? Lại đi nhậu với lũ bạn hư hỏng phải không?"</em> — Bạn trả lời: <em>"Đâu có, anh đang tăng ca ở công ty mà..."</em>. Trong 8 giây, lũ bạn khốn nạn sẽ hét <strong>"Em ơi thêm két bia!"</strong> để phá đám!
                    </p>

                    {/* Noise Meter */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 mb-2.5">
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span className="text-zinc-300">🔊 Độ Ồn Bàn Nhậu (Vượt 80% = Ăn Dép Tổ Ong!):</span>
                        <span
                          className={
                            arenaState.wifeCallNoiseLevel >= 75
                              ? 'text-rose-400 font-black'
                              : 'text-emerald-400 font-black'
                          }
                        >
                          {arenaState.wifeCallNoiseLevel}% / 80%
                        </span>
                      </div>
                      <div className="h-3.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-700">
                        <div
                          style={{ width: `${Math.min(100, arenaState.wifeCallNoiseLevel)}%` }}
                          className={`h-full transition-all duration-200 ${
                            arenaState.wifeCallNoiseLevel >= 75
                              ? 'bg-rose-500'
                              : arenaState.wifeCallNoiseLevel >= 45
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={onStartWifeCallStealth}
                      className="py-2 px-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] cursor-pointer transition"
                    >
                      📲 Nhận Cuộc Gọi Nóc Nhà (8s)
                    </button>
                    <button
                      onClick={onShushFriendsDuringWifeCall}
                      className="py-2 px-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/45 border border-emerald-500/50 text-emerald-200 font-bold text-[11px] cursor-pointer transition"
                    >
                      🤫 Bịt Mồm Bạn (-30% Ồn)
                    </button>
                    <button
                      onClick={onSabotageShoutDuringWifeCall}
                      className="py-2 px-2 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 border border-amber-500/50 text-amber-200 font-bold text-[11px] cursor-pointer transition"
                    >
                      📢 Hét Phá Đám: "THÊM KÉT BIA!"
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Hệ thống 3 — 5 Hệ Tư Tưởng Khi Say (Drunk Archetypes at 80% Alcohol) */}
              <div className="bg-zinc-900/95 border border-amber-500/40 rounded-2xl p-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div>
                    <span className="text-xs font-black text-amber-300">
                      🧬 3. Đột Biến Nhân Cách Khi Say — 5 "Hệ Tư Tưởng Khi Say" (80%+ Cồn)
                    </span>
                    <p className="text-[11px] text-zinc-400">
                      Chọn hoặc bốc ngẫu nhiên 1 trong 5 Hệ Tư Tưởng Khi Say để biến đổi hoàn toàn hành vi trên bàn nhậu:
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const randomArch =
                        DRUNK_ARCHETYPES[Math.floor(Math.random() * DRUNK_ARCHETYPES.length)];
                      onActivateArchetype(randomArch.id);
                    }}
                    className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs cursor-pointer transition"
                  >
                    🎲 Đột Biến Ngẫu Nhiên Ngay!
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {DRUNK_ARCHETYPES.map((arch) => {
                    const isSelected = arenaState.activeArchetype === arch.id;
                    return (
                      <button
                        key={arch.id}
                        onClick={() => onActivateArchetype(arch.id)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50'
                            : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-600'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xl">{arch.icon}</span>
                            {isSelected && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-zinc-950">
                                ĐANG BẬT
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-black text-white leading-tight mb-1">
                            {arch.name}
                          </div>
                          <p className="text-[10px] text-zinc-400 leading-snug mb-2">
                            {arch.desc}
                          </p>
                        </div>
                        <div className="text-[9px] font-bold text-amber-300 bg-amber-500/10 rounded px-1.5 py-1">
                          ⚡ {arch.effectText}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 3: Hệ thống 4 (Nồi Lẩu Thái Nhúng Thịt Bò 5 Giây) + Hệ thống 5 (Tăng 2 Phòng Karaoke Đèn Chớp) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 4. Nồi Lẩu Thái Nghi Ngút Khói — Nhúng Thịt Bò Đếm Đúng 5 Giây */}
                <div className="bg-zinc-900/95 border border-orange-500/40 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-orange-300 flex items-center gap-1.5">
                        <Soup className="w-4 h-4" />
                        <span>4. Nồi Lẩu Thái Sôi Sùng Sục — Nhúng Bò Đúng 5 Giây!</span>
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">
                        4.2s – 5.5s = Chín Tái
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mb-2">
                      Gắp lát thịt bò tươi nhúng vào nồi lẩu cồn đang cháy, đếm đúng <strong>5.0 giây</strong> rồi vớt ra mới được Buff ngon nhất! Nhúng quá lâu thịt dai nhách, mà lơ là ở giây thứ 4 là bị <strong>thằng bạn bên cạnh vớt trộm mất ngay trước mũi!</strong>
                    </p>

                    {/* Hotpot Timer Display */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 mb-2.5">
                      <div className="flex items-center justify-between text-xs font-black mb-1">
                        <span>
                          🥩 Thời gian nhúng bò:{' '}
                          <strong className="text-amber-300 text-sm">{dipSeconds.toFixed(1)}s</strong> / 5.0s
                        </span>
                        <span
                          className={
                            rivalStealingBeef
                              ? 'text-rose-400 animate-bounce'
                              : dipSeconds >= 4.2 && dipSeconds <= 5.6
                              ? 'text-emerald-400'
                              : 'text-zinc-400'
                          }
                        >
                          {rivalStealingBeef
                            ? '⚠️ TUẤN ĐANG THÒ ĐŨA VỚT TRỘM!'
                            : dipSeconds >= 4.2 && dipSeconds <= 5.6
                            ? '✨ CHÍN TÁI HOÀN HẢO — VỚT NGAY!'
                            : dipSeconds > 5.6
                            ? '💀 QUÁ LỬA DAI NHÁCH!'
                            : 'Đang nhúng trong nước lẩu sôi...'}
                        </span>
                      </div>
                      <div className="h-3 w-full bg-zinc-900 rounded-full overflow-hidden flex border border-zinc-700">
                        <div
                          style={{ width: `${Math.min(100, (dipSeconds / 6.5) * 100)}%` }}
                          className={`h-full transition-all ${
                            dipSeconds >= 4.2 && dipSeconds <= 5.6
                              ? 'bg-emerald-400'
                              : dipSeconds > 5.6
                              ? 'bg-rose-500'
                              : 'bg-amber-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {!isDippingBeef ? (
                      <button
                        onClick={() => {
                          setDipSeconds(0);
                          setIsDippingBeef(true);
                        }}
                        className="py-2 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs cursor-pointer transition"
                      >
                        🥩 Bắt Đầu Nhúng Bò (Đếm 5s)
                      </button>
                    ) : (
                      <button
                        onClick={handlePullOutBeef}
                        className="py-2 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs animate-pulse cursor-pointer transition"
                      >
                        🥢 VỚT BÒ RA ĂN NGAY ({dipSeconds.toFixed(1)}s)!
                      </button>
                    )}
                    <button
                      onClick={() => onCompleteHotpotBeefDip('stolen_by_friend')}
                      className="py-2 px-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/45 border border-purple-500/50 text-purple-200 font-bold text-[11px] cursor-pointer transition"
                    >
                      😈 Vớt Trộm Bò Của Bạn!
                    </button>
                    <button
                      onClick={() => onCompleteHotpotBeefDip('spilled_pot')}
                      className="py-2 px-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/45 border border-rose-500/50 text-rose-200 font-bold text-[11px] cursor-pointer transition"
                    >
                      💥 Làm Đổ Nồi Lẩu Tràn Bàn!
                    </button>
                  </div>
                </div>

                {/* 5. Sự Kiện "Tăng 2 - Tăng 3" (Đẩy Xe Ba Gác / Taxi -> Phòng Karaoke Đèn Chớp) */}
                <div className="bg-zinc-900/95 border border-fuchsia-500/40 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-fuchsia-300 flex items-center gap-1.5">
                        <PartyPopper className="w-4 h-4" />
                        <span>5. Chiến Dịch "Tăng 2 - Tăng 3" (Xe Ba Gác ➔ Karaoke Đèn Chớp)</span>
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-200">
                        Điểm Hát: {arenaState.karaokeScore}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mb-2.5">
                      Nhậu xong Tăng 1 chưa đã? Dìu nhau ra vỉa hè <strong>quăng đứa say lên thùng Xe Ba Gác / Taxi</strong> né công an phường, rồi kéo thẳng vào <strong>Tăng 2: Phòng Karaoke Đèn Chớp</strong> giành Mic Vàng hát nhạc chế và nhảy Ragdoll điên cuồng!
                    </p>

                    <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                      <button
                        onClick={() => onChangePartyStage('sidewalk_stage1')}
                        className={`py-2 px-2 rounded-xl font-black text-[11px] border cursor-pointer transition ${
                          arenaState.partyStage === 'sidewalk_stage1'
                            ? 'bg-amber-500 text-zinc-950 border-amber-300'
                            : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                        }`}
                      >
                        🍻 Tăng 1: Quán Vỉa Hè
                      </button>
                      <button
                        onClick={() => onChangePartyStage('taxi_transfer')}
                        className={`py-2 px-2 rounded-xl font-black text-[11px] border cursor-pointer transition ${
                          arenaState.partyStage === 'taxi_transfer'
                            ? 'bg-sky-500 text-zinc-950 border-sky-300'
                            : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                        }`}
                      >
                        🛺 Chuyển Cảnh: Xe Ba Gác
                      </button>
                      <button
                        onClick={() => onChangePartyStage('karaoke_stage2')}
                        className={`py-2 px-2 rounded-xl font-black text-[11px] border cursor-pointer transition ${
                          arenaState.partyStage === 'karaoke_stage2'
                            ? 'bg-fuchsia-500 text-zinc-950 border-fuchsia-300'
                            : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                        }`}
                      >
                        🎤 Tăng 2: Phòng Karaoke
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={onSingKaraokeBeat}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-500 hover:from-fuchsia-400 hover:to-amber-400 text-zinc-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg transition"
                  >
                    <Mic className="w-4 h-4" />
                    <span>🎤 GIÀNH MIC VÀNG HÁT ĐÚNG NHỊP & NHẢY RAGDOLL (+50 ĐIỂM)!</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'npcs' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* NPC 1: Bà Chủ Quán "Sư Tử Hà Đông" & Thằng Nhỏ Phục Vụ */}
              <div className="bg-zinc-900/90 border border-rose-500/40 rounded-2xl p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-black text-rose-300 flex items-center gap-1.5">
                      <span>👩‍🍳 1. Bà Chủ "Sư Tử Hà Đông" & Phục Vụ</span>
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      Ly vỡ: {arenaState.brokenGlassesCount}/5
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed mb-2.5">
                    Mặc đồ bộ bông, đeo túi tiền dày cộp trước bụng. Đập vỡ trên 5 cái ly là Bà Chủ cầm <strong>Chổi lông gà / Vá múc canh</strong> lao ra gõ đầu cả bàn (Stun 3s + đền tiền vào Bill). Ai trốn Bill chạy ra đường sẽ ăn <strong>"Phi Dép Tổ Ong"</strong> chuẩn 100%!
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    onClick={onCallWaiterRefill}
                    className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Hét Mic: "Em ơi cho thêm đá / thêm bia!"</span>
                  </button>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={onSmashGlassProvokeLandlady}
                      className="py-2 px-2.5 rounded-xl bg-rose-600/30 hover:bg-rose-600/45 border border-rose-500/50 text-rose-200 font-bold text-[11px] cursor-pointer transition"
                    >
                      💥 Đập Ly Quậy Bàn ({arenaState.brokenGlassesCount}/5)
                    </button>
                    <button
                      onClick={onTriggerLandladySlipperSniper}
                      className="py-2 px-2.5 rounded-xl bg-orange-600/30 hover:bg-orange-600/45 border border-orange-500/50 text-orange-200 font-bold text-[11px] cursor-pointer transition"
                    >
                      🩴 Thử Trốn Bill (Phi Dép Tổ Ong!)
                    </button>
                  </div>
                </div>
              </div>

              {/* NPC 2: Anh Chàng Kéo Loa Kẹo Kéo & Hát Rong */}
              <div className="bg-zinc-900/90 border border-fuchsia-500/40 rounded-2xl p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-black text-fuchsia-300">
                      🔊 2. Anh Kéo Loa Kẹo Kéo LED & Hát Rong
                    </span>
                    <button
                      onClick={onToggleKaraokeArrival}
                      className={`text-[10px] font-black px-2 py-0.5 rounded cursor-pointer ${
                        arenaState.isKaraokeActive
                          ? 'bg-fuchsia-500 text-zinc-950 animate-pulse'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {arenaState.isKaraokeActive ? '🔊 ĐANG BẬT MAX VOLUME' : 'Kéo Loa Tới Bàn'}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">
                    Đội nón kết, kính đen, ngậm bông tăm kéo loa LED đứng sát bàn bật <strong>{arenaState.karaokeSongName}</strong> làm át Voice Chat và rung lắc các ly bia trên bàn!
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => onHandleKaraokeChoice('buy_gum')}
                    className="py-2 px-2 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-200 font-bold text-[11px] cursor-pointer transition text-center"
                  >
                    🤝 Mua Kẹo Ủng Hộ (-25 Xu, Buff Hưng Phấn)
                  </button>
                  <button
                    onClick={() => onHandleKaraokeChoice('steal_mic')}
                    className="py-2 px-2 rounded-xl bg-fuchsia-600/30 hover:bg-fuchsia-600/45 border border-fuchsia-500/50 text-fuchsia-200 font-bold text-[11px] cursor-pointer transition text-center"
                  >
                    🎤 Cướp Mic Tự Hát (Echo Vang Quán!)
                  </button>
                  <button
                    onClick={() => onHandleKaraokeChoice('push_speaker')}
                    className="py-2 px-2 rounded-xl bg-rose-600/25 hover:bg-rose-600/40 border border-rose-500/50 text-rose-200 font-bold text-[11px] cursor-pointer transition text-center"
                  >
                    👊 Đẩy Loa Đuổi Đi (Coi Chừng Bị Rượt!)
                  </button>
                </div>
              </div>

              {/* NPC 3: Cô Bán Vé Số Dạo & TV Xổ Số Kiến Thiết */}
              <div className="bg-zinc-900/90 border border-amber-500/40 rounded-2xl p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-black text-amber-300">
                      🎟️ 3. Cô Bán Vé Số & TV Xổ Số Kiến Thiết
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      Đã mua: {arenaState.lotteryTickets.length} tờ
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">
                    Cuối trận màn hình TV treo trong quán sẽ quay giải: <strong>Trúng Độc Đắc sẽ có mưa tiền & tự động thành Đại Gia bao trọn bàn nhậu ({totalBill.toLocaleString()}đ)!</strong>
                  </p>

                  {arenaState.lotteryTickets.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {arenaState.lotteryTickets.map((t, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-mono font-black px-2 py-0.5 rounded bg-amber-400 text-zinc-950"
                        >
                          🎟️ {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onBuyLotteryTicket}
                    className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>Mua 1 Tờ Vé Số (20 Xu)</span>
                  </button>
                  <button
                    onClick={onDrawLotteryTV}
                    className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <Tv className="w-4 h-4" />
                    <span>Quay Kết Quả TV Ngay!</span>
                  </button>
                </div>
              </div>

              {/* NPC 4 & 5: Bàn Nhậu Kế Bên & Chú Chó Cậu Vàng Dưới Gầm Bàn */}
              <div className="space-y-3">
                <div className="bg-zinc-900/90 border border-orange-500/40 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-orange-300">
                      🍻 4. "Bàn Nhậu Kế Bên" (Giang Hồ Mạng)
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400">Cách 2m bên phải</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    <button
                      onClick={onToastNeighborTable}
                      className="py-1.5 px-2.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/45 border border-emerald-500/50 text-emerald-200 font-bold text-[11px] cursor-pointer transition"
                    >
                      🍻 Sang Giao Lưu 1 Ly (Thưởng Mồi)
                    </button>
                    <button
                      onClick={onProvokeNeighborBrawl}
                      className="py-1.5 px-2.5 rounded-xl bg-rose-600/35 hover:bg-rose-600/50 border border-rose-500/50 text-rose-200 font-bold text-[11px] cursor-pointer transition"
                    >
                      🪑 Ném Đá Gây Hỗn Chiến Liên Bàn!
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-900/90 border border-yellow-500/40 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-yellow-300 flex items-center gap-1">
                      <Dog className="w-3.5 h-3.5" />
                      <span>5. Chú Chó Cỏ "Cậu Vàng" Dưới Gầm Bàn</span>
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300">
                      Thân thiết: {arenaState.cauVangAffinity}%
                    </span>
                  </div>
                  <button
                    onClick={onFeedCauVang}
                    className="w-full mt-1.5 py-1.5 px-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-black text-xs cursor-pointer transition"
                  >
                    🍖 Đút Chân Gà Cho Cậu Vàng (+35% Thân Thiết)
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Event 1: Cơn Mưa Rào Bất Chợt */}
              <div className="bg-zinc-900/90 border border-sky-500/40 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-sky-300 flex items-center gap-1.5">
                      <CloudRain className="w-4 h-4" />
                      <span>🌧️ Cơn Mưa Rào Bất Chợt & Bạt Kéo</span>
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded ${
                        arenaState.isRaining
                          ? 'bg-sky-500 text-zinc-950 animate-bounce'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {arenaState.isRaining
                        ? `ĐANG MƯA RÀO (${arenaState.rainCountdown}s)`
                        : 'Trời Quang Mây Tạnh'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                    Đang nhậu thì trời Sài Gòn đổ mưa rào! Nếu không cùng nhau bấm nút kéo tấm <strong>Bạt che di động xanh cam</strong> ra kịp trong 10 giây, bia trong ly sẽ bị nước mưa làm loãng nhạt thếch!
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onTriggerRainEvent}
                    className="py-2.5 px-3 rounded-xl bg-sky-600/30 hover:bg-sky-600/45 border border-sky-400/50 text-sky-200 font-bold text-xs cursor-pointer transition"
                  >
                    🌧️ Gọi Mưa Rào Bất Chợt
                  </button>
                  <button
                    onClick={onPullRainTarp}
                    className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-lg"
                  >
                    <Umbrella className="w-4 h-4" />
                    <span>{arenaState.isTarpPulled ? 'Thu Bạt Lại' : 'KÉO BẠT CHE MƯA NGAY!'}</span>
                  </button>
                </div>
              </div>

              {/* Event 2: Đội Kiểm Tra Đô Thị */}
              <div className="bg-zinc-900/90 border border-red-500/40 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-red-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" />
                      <span>🚨 Đội Kiểm Tra Đô Thị Dẹp Vỉa Hè</span>
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded ${
                        arenaState.urbanPatrolActive
                          ? 'bg-red-500 text-white animate-ping'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {arenaState.urbanPatrolActive
                        ? `CÒI HÚ: CÒN ${arenaState.urbanPatrolCountdown}S!`
                        : 'Chưa Có Đoàn Kiểm Tra'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                    Tiếng còi hú vang lên! Trong <strong>10 giây</strong>, cả bàn phải hợp sức bê nguyên cái bàn inox và ghế nhựa chạy thụt lùi vào trong <strong>vạch sơn trắng vỉa hè</strong>!
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onTriggerUrbanPatrol}
                    className="py-2.5 px-3 rounded-xl bg-red-600/30 hover:bg-red-600/45 border border-red-500/50 text-red-200 font-bold text-xs cursor-pointer transition"
                  >
                    🚨 Báo Động Đô Thị Tới!
                  </button>
                  <button
                    onClick={onRetreatTableBehindWhiteLine}
                    className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs cursor-pointer transition shadow-lg"
                  >
                    🏃‍♂️ BÊ BÀN LÙI VÀO VẠCH TRẮNG!
                  </button>
                </div>
              </div>

              {/* Event 3: Xe Máy Phóng Qua Lòng Đường & Vỏ Chai Dưới Đất */}
              <div className="md:col-span-2 bg-zinc-900/90 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-black text-amber-300 flex items-center gap-2">
                    <Bike className="w-4 h-4" />
                    <span>🛵 Lòng Đường Xe Máy (Wave / Vision / Exciter) & Két Vỏ Bia Nhựa</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Đi bộ lảo đảo lấn ra lòng đường sẽ bị xe máy tông bay ngược vào quán (Ragdoll choáng 3s)! Uống hết chai nhớ ném vỏ vào két nhựa kẻo đạp trúng trượt té!
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    onClick={onTossBottleIntoCrate}
                    className="flex-1 sm:flex-initial py-2 px-3 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/45 border border-emerald-500/50 text-emerald-200 font-bold text-xs cursor-pointer transition"
                  >
                    🍾 Ném Vỏ Chai Vào Két (+15 Xu)
                  </button>
                  <button
                    onClick={onStepIntoMotorbikeLane}
                    className="flex-1 sm:flex-initial py-2 px-3 rounded-xl bg-rose-600/35 hover:bg-rose-600/50 border border-rose-500/50 text-rose-200 font-bold text-xs cursor-pointer transition"
                  >
                    🛵 Đi Ra Lòng Đường (Ragdoll!)
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'flow' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                {
                  phase: 1 as const,
                  time: 'Phút 0 – 5',
                  title: 'Giai Đoạn 1: Nhập Tiệc — Tỉnh Táo',
                  desc: 'Anh em vào bàn, chọn ghế nhựa, gọi bia gọi mồi. Cụng ly "1, 2, 3 Dzô!" lịch sự, chơi Xí ngầu nói dối nhẹ nhàng.',
                  badge: '0% – 30% Cồn',
                  color: 'border-emerald-500/50 bg-emerald-500/10',
                },
                {
                  phase: 2 as const,
                  title: 'Giai Đoạn 2: Cao Trào — Ngà Ngà Say',
                  time: 'Phút 5 – 12',
                  desc: 'Tay chân quơ quạng đổ bia, tranh miếng mồi cuối. Loa kẹo kéo tới hát inh ỏi, cô bán vé số đi ngang mời mua, chạy đua giành WC!',
                  badge: '31% – 70% Cồn',
                  color: 'border-amber-500/50 bg-amber-500/10',
                },
                {
                  phase: 3 as const,
                  title: 'Giai Đoạn 3: Hỗn Loạn — Quắc Cần Câu',
                  time: 'Phút 12 – 15',
                  desc: 'Đột biến 5 Hệ tư tưởng khi say, gọi điện cho Người Yêu Cũ, Nóc Nhà gọi kiểm tra, trời đổ mưa rào phải kéo bạt!',
                  badge: '71% – 99% Cồn',
                  color: 'border-orange-500/50 bg-orange-500/10',
                },
                {
                  phase: 4 as const,
                  title: 'Giai Đoạn 4: Tàn Tiệc ➔ Tăng 2 Karaoke',
                  time: 'Phút 15+',
                  desc: 'TV công bố kết quả Xổ Số Kiến Thiết -> Đại chiến Giành Hóa Đơn -> Đẩy xe ba gác kéo nhau đi Tăng 2 Phòng Karaoke Đèn Chớp!',
                  badge: 'Sổ Số & Tăng 2',
                  color: 'border-rose-500/50 bg-rose-500/10',
                },
              ].map((item) => (
                <div
                  key={item.phase}
                  className={`rounded-2xl border p-3.5 flex flex-col justify-between ${item.color} ${
                    arenaState.currentMatchPhase === item.phase ? 'ring-2 ring-amber-400' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-black mb-1">
                      <span className="text-amber-300">{item.time}</span>
                      <span className="px-2 py-0.5 rounded bg-zinc-950/60 text-zinc-200">
                        {item.badge}
                      </span>
                    </div>
                    <div className="text-sm font-black text-white mb-1">{item.title}</div>
                    <p className="text-xs text-zinc-300 leading-relaxed mb-3">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => onSelectMatchPhase(item.phase)}
                    className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs cursor-pointer transition"
                  >
                    ⚡ Kích Hoạt Không Khí Giai Đoạn {item.phase}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
