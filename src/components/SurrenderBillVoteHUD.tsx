import React, { useEffect, useState } from 'react';
import { Player } from '../game/types';
import {
  BILL_ESCAPE_QTE_DURATION_SECONDS,
  BillEscapeAction,
  BillEscapeResolution,
  BottleCapVoteEntry,
  DIAMOND_SPONSOR_TITLE,
  PASSED_OUT_STAMP_TEXT,
  PENALTY_FULL_MUG_WARNING,
  REJECTED_STAMP_TEXT,
  SurrenderResolutionResult,
  computeDrunkVoteButtonLayout,
} from '../game/surrenderVoteLogic';
import {
  Beer,
  CheckCircle2,
  Cigarette,
  Crown,
  Flame,
  Flag,
  Footprints,
  Receipt,
  Shuffle,
  Skull,
  Sparkles,
  Timer,
  Volume2,
  X,
  XCircle,
} from 'lucide-react';

export type SurrenderPhase =
  | 'idle'
  | 'voting'
  | 'rejected_torn'
  | 'approved_escape_qte'
  | 'summary_diamond_sponsor';

interface SurrenderBillVoteHUDProps {
  phase: SurrenderPhase;
  callerPlayer: Player;
  userPlayer: Player;
  totalBill: number;
  countdownSeconds: number;
  qteCountdownSeconds: number;
  voteEntries: BottleCapVoteEntry[];
  triggerVoiceLine: string;
  chatFeed: {
    id: string;
    playerName: string;
    choice: 'yes' | 'no';
    text: string;
    isJumbledDrunkText: boolean;
  }[];
  resolution: SurrenderResolutionResult | null;
  qteUserClicks: number;
  qteUserAction: BillEscapeAction;
  qteResolution: BillEscapeResolution | null;
  penaltyCrateCount: number;
  onCastUserVote: (choice: 'yes' | 'no', wasDrunkMisclick?: boolean) => void;
  onForceScenario: (mode: 'force_reject' | 'force_approve') => void;
  onMashEscapeQTE: (action: 'run_wc' | 'tie_shoelace') => void;
  onBoostUserDrunk88ForTest: () => void;
  onCloseOrContinueParty: () => void;
  onStartReturnCommute?: () => void;
}

const AVATAR_EMOJI: Record<Player['avatar'], string> = {
  dog: '🐕',
  cat: '🐱',
  panda: '🐼',
  duck: '🦆',
  bear: '🐻',
  hamster: '🐹',
};

export const SurrenderBillVoteHUD: React.FC<SurrenderBillVoteHUDProps> = ({
  phase,
  callerPlayer,
  userPlayer,
  totalBill,
  countdownSeconds,
  qteCountdownSeconds,
  voteEntries,
  triggerVoiceLine,
  chatFeed,
  resolution,
  qteUserClicks,
  qteUserAction,
  qteResolution,
  penaltyCrateCount,
  onCastUserVote,
  onForceScenario,
  onMashEscapeQTE,
  onBoostUserDrunk88ForTest,
  onCloseOrContinueParty,
  onStartReturnCommute,
}) => {
  const [timerVisualMode, setTimerVisualMode] = useState<'cigarette' | 'beer'>(
    'cigarette'
  );
  const [swimTick, setSwimTick] = useState(0);

  // Tick every 550ms when user is > 85% alcohol so the two vote buttons swim & swap positions ("Tay Nhanh Hơn Não")
  useEffect(() => {
    if (phase !== 'voting' || userPlayer.alcoholLevel <= 85) {
      setSwimTick(0);
      return;
    }
    const interval = setInterval(() => {
      setSwimTick((prev) => prev + 1);
    }, 550);
    return () => clearInterval(interval);
  }, [phase, userPlayer.alcoholLevel]);

  if (phase === 'idle') return null;

  const userVoteEntry = voteEntries.find((e) => e.playerId === userPlayer.id);
  const hasUserVoted =
    userVoteEntry?.status === 'yes' || userVoteEntry?.status === 'no';
  const isUserPassedOut =
    userPlayer.isPassedOut ||
    userPlayer.alcoholLevel >= 100 ||
    userVoteEntry?.status === 'passed_out';

  const progressPct = Math.max(
    0,
    Math.min(100, (countdownSeconds / 15) * 100)
  );

  const drunkLayout = computeDrunkVoteButtonLayout(
    userPlayer.alcoholLevel,
    swimTick
  );

  const yesCount = voteEntries.filter((e) => e.status === 'yes').length;
  const noCount = voteEntries.filter((e) => e.status === 'no').length;
  const passedOutCount = voteEntries.filter(
    (e) => e.status === 'passed_out'
  ).length;

  const renderVoteButtons = () => {
    const btnYes = (
      <button
        key="btn-surrender-yes"
        disabled={isUserPassedOut}
        onClick={() => onCastUserVote('yes', false)}
        style={
          drunkLayout.isDrunkSwimming
            ? {
                transform: `translate(${drunkLayout.offsetYesX}px, ${drunkLayout.offsetYesY}px) rotate(-2deg)`,
              }
            : undefined
        }
        className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs transition-all cursor-pointer border-2 shadow-md flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
          userVoteEntry?.status === 'yes'
            ? 'bg-emerald-600 text-white border-emerald-900 ring-2 ring-emerald-400'
            : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 border-emerald-800'
        } ${isUserPassedOut ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        <span className="flex items-center gap-1 text-xs sm:text-sm">
          <Flag className="w-3.5 h-3.5" />
          <span>🏳️ Thôi Về Nghỉ</span>
        </span>
        <span className="text-[10px] font-bold opacity-85">
          (Đồng ý tính tiền)
        </span>
      </button>
    );

    const btnNo = (
      <button
        key="btn-surrender-no"
        disabled={isUserPassedOut}
        onClick={() =>
          onCastUserVote('no', drunkLayout.isDrunkSwimming && drunkLayout.areButtonsSwapped)
        }
        style={
          drunkLayout.isDrunkSwimming
            ? {
                transform: `translate(${drunkLayout.offsetNoX}px, ${drunkLayout.offsetNoY}px) rotate(2deg)`,
              }
            : undefined
        }
        className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs transition-all cursor-pointer border-2 shadow-md flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
          userVoteEntry?.status === 'no'
            ? 'bg-red-700 text-white border-red-950 ring-2 ring-amber-300'
            : 'bg-red-600 hover:bg-red-500 text-white border-red-900'
        } ${isUserPassedOut ? 'opacity-40 cursor-not-allowed' : ''}`}
      >
        <span className="flex items-center gap-1 text-xs sm:text-sm">
          <Beer className="w-3.5 h-3.5" />
          <span>🍺 Tao Chưa Say!</span>
        </span>
        <span className="text-[10px] font-bold text-amber-200">
          (Đập bàn chiến tiếp!)
        </span>
      </button>
    );

    return drunkLayout.areButtonsSwapped ? [btnNo, btnYes] : [btnYes, btnNo];
  };

  return (
    <>
      {/* =====================================================================
          1. RIGHT-SIDE SLIDING CARBON RECEIPT TRAY ("TỜ HÓA ĐƠN ĐỊNH MỆNH")
          Shown during 'voting' and 'rejected_torn' phases
         ===================================================================== */}
      {(phase === 'voting' || phase === 'rejected_torn') && (
        <div
          data-testid="surrender-bill-vote-hud"
          className="fixed right-3 top-14 z-40 w-[min(400px,94vw)] max-h-[calc(100vh-7.25rem)] overflow-y-auto pointer-events-auto transition-transform duration-300"
        >
          {/* Small Blue Plastic Dish Tray holding the receipt + Mint Candies (Kẹo Bạc Hà) */}
          <div className="relative bg-sky-900 border-4 border-sky-500 rounded-3xl p-2.5 shadow-2xl">
            {/* Plastic Tray Rim & Metal Clip at top */}
            <div className="flex items-center justify-between px-2 pb-1.5 mb-1 text-[11px] font-black text-sky-200">
              <span className="flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-amber-300" />
                <span>ĐĨA NHỰA KẸP BILL • QUÁN TƯ ĐỰC</span>
              </span>
              <div className="flex items-center gap-1">
                <span
                  title="Viên kẹo bạc hà khuyến mãi trên đĩa tính tiền"
                  className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/50 text-emerald-200 text-[10px]"
                >
                  🍬 Kẹo Bạc Hà x3
                </span>
                {phase === 'rejected_torn' && (
                  <button
                    onClick={onCloseOrContinueParty}
                    className="p-1 rounded-lg bg-sky-950 hover:bg-red-600 text-white cursor-pointer"
                    title="Đóng hóa đơn"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Metallic Receipt Clip */}
            <div className="mx-auto -mb-2 relative z-20 w-24 h-4 rounded-t-xl bg-zinc-300 border-2 border-zinc-600 shadow flex items-center justify-center">
              <div className="w-12 h-1.5 rounded-full bg-zinc-600" />
            </div>

            {/* Carbon-Copy Pink/White Receipt Paper (Tears in half when REJECTED!) */}
            <div
              className={`relative bg-rose-50 text-zinc-900 border-x-2 border-rose-300 shadow-xl transition-all duration-300 ${
                phase === 'rejected_torn' ? ' -rotate-1' : ''
              }`}
            >
              {/* Top Serrated / Perforated Edge (Răng Cưa) */}
              <div
                className="h-3 w-full bg-sky-900"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 8px 0px, transparent 6px, #fff1f2 6.5px)',
                  backgroundSize: '16px 12px',
                }}
              />

              <div className="px-3.5 pt-1 pb-3">
                {/* Dramatic Caller Voice-Line Banner */}
                <div className="mb-2 px-2.5 py-1.5 rounded-xl bg-amber-100 border border-amber-400 text-amber-950 text-[11px] font-bold flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-red-600 shrink-0 animate-bounce" />
                  <span>
                    <strong>{callerPlayer.name}</strong> đứng phắt dậy múa tay ký
                    không khí: <em>"{triggerVoiceLine}"</em>
                  </span>
                </div>

                {/* Receipt Header Title */}
                <div className="text-center border-b-2 border-dashed border-rose-300 pb-2 mb-2.5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-rose-600">
                    🧾 HÓA ĐƠN BÌNH CHỌN ĐẦU HÀNG (FF)
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-zinc-950 leading-tight mt-0.5">
                    [{callerPlayer.name}] đòi bỏ cuộc chơi để về với vợ!
                  </h3>
                  <div className="text-[11px] font-bold text-zinc-600 mt-0.5">
                    Tổng thiệt hại tạm tính:{' '}
                    <strong className="text-red-600 font-black">
                      {totalBill.toLocaleString()}đ
                    </strong>
                  </div>
                </div>

                {/* 15-Second Countdown Bar: Burning Cigarette OR Draining Beer Foam */}
                {phase === 'voting' && (
                  <div className="mb-3 bg-white border border-rose-200 rounded-2xl p-2.5 shadow-inner">
                    <div className="flex items-center justify-between text-[11px] font-black mb-1.5">
                      <span className="flex items-center gap-1 text-zinc-800">
                        <Timer className="w-3.5 h-3.5 text-red-600" />
                        <span>ĐẾM NGƯỢC CHỐT SỔ: {countdownSeconds}s</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setTimerVisualMode((m) =>
                            m === 'cigarette' ? 'beer' : 'cigarette'
                          )
                        }
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 cursor-pointer"
                      >
                        {timerVisualMode === 'cigarette'
                          ? '🚬 Điếu thuốc cháy dần (Đổi sang 🍺)'
                          : '🍺 Ly bia cạn bọt (Đổi sang 🚬)'}
                      </button>
                    </div>

                    {timerVisualMode === 'cigarette' ? (
                      /* Burning Cigarette Visual */
                      <div className="relative h-6 w-full bg-zinc-200 rounded-full overflow-hidden border border-zinc-400 flex items-center">
                        {/* Filter butt on the left */}
                        <div className="h-full w-10 bg-amber-600 border-r-2 border-amber-800 shrink-0 flex items-center justify-center text-[9px] font-black text-amber-100">
                          ĐẦU LỌC
                        </div>
                        {/* Remaining white cigarette paper */}
                        <div
                          className="h-full bg-stone-50 transition-all duration-300 flex items-center justify-end pr-1"
                          style={{ width: `${Math.max(6, progressPct * 0.78)}%` }}
                        >
                          {/* Glowing burning ember tip */}
                          <div className="w-3 h-full bg-gradient-to-r from-orange-500 to-red-600 animate-pulse flex items-center justify-center">
                            <Flame className="w-3 h-3 text-yellow-200" />
                          </div>
                        </div>
                        {/* Gray ash behind the ember */}
                        <div className="flex-1 h-full bg-zinc-500/40 flex items-center pl-1.5 text-[9px] font-bold text-zinc-700">
                          💨 Tàn thuốc...
                        </div>
                      </div>
                    ) : (
                      /* Draining Foamy Beer Glass Visual */
                      <div className="relative h-6 w-full bg-amber-950/15 rounded-full overflow-hidden border border-amber-500 flex items-center">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-200 transition-all duration-300 flex items-center justify-end pr-2"
                          style={{ width: `${progressPct}%` }}
                        >
                          <span className="text-[10px] font-black text-amber-950">
                            🫧 Bọt bia {countdownSeconds}s
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4-8 Bottle Caps (Nắp Bia) Vote Status Grid */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[11px] font-black text-zinc-700 mb-1.5">
                    <span>TRẠNG THÁI NẮP BIA ({voteEntries.length} NGƯỜI):</span>
                    <span className="text-[10px]">
                      🟢 Về: <b>{yesCount}</b> • 🔴 Chiến tiếp: <b>{noCount}</b>
                      {passedOutCount > 0 ? ` • 💤 Ngất: ${passedOutCount}` : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {voteEntries.map((entry) => {
                      const isPending = entry.status === 'pending';
                      const isYes = entry.status === 'yes';
                      const isNo = entry.status === 'no';
                      const isKnockedOut = entry.status === 'passed_out';

                      return (
                        <div
                          key={entry.playerId}
                          data-testid={`bottle-cap-slot-${entry.playerId}`}
                          className={`p-2 rounded-xl border-2 transition-all flex items-center gap-2 ${
                            isYes
                              ? 'bg-emerald-100 border-emerald-600 text-emerald-950'
                              : isNo
                              ? 'bg-red-100 border-red-600 text-red-950'
                              : isKnockedOut
                              ? 'bg-purple-100 border-purple-500 text-purple-950'
                              : 'bg-zinc-200/80 border-zinc-400 text-zinc-700'
                          }`}
                        >
                          {/* Bottle Cap Visual Icon */}
                          <div
                            className={`w-8 h-8 shrink-0 flex items-center justify-center font-black text-xs border-2 border-dashed shadow-sm ${
                              isYes
                                ? 'rounded-full bg-emerald-500 border-emerald-900 text-white rotate-6'
                                : isNo
                                ? 'rounded-lg scale-x-110 scale-y-75 bg-red-600 border-red-950 text-amber-200 -rotate-12'
                                : isKnockedOut
                                ? 'rounded-full bg-purple-700 border-purple-950 text-white'
                                : 'rounded-full bg-zinc-400 border-zinc-600 text-zinc-900'
                            }`}
                            title={
                              isYes
                                ? 'Nắp bia bật ngửa màu Xanh (Đồng ý tính tiền)'
                                : isNo
                                ? 'Nắp bia bị đập bẹp dí màu Đỏ (Không đầu hàng!)'
                                : isKnockedOut
                                ? PASSED_OUT_STAMP_TEXT
                                : 'Nắp bia úp màu Xám (Chưa bấm chọn)'
                            }
                          >
                            {isYes
                              ? '🟢'
                              : isNo
                              ? '💥'
                              : isKnockedOut
                              ? '💤'
                              : '⚪'}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-black truncate flex items-center gap-1">
                              <span>{AVATAR_EMOJI[entry.avatar]}</span>
                              <span className="truncate">{entry.playerName}</span>
                            </div>
                            <div className="text-[10px] font-bold leading-tight">
                              {isYes && 'Nắp bật ngửa: Về nghỉ!'}
                              {isNo && 'Nắp đập bẹp: Chiến tiếp!'}
                              {isPending && 'Nắp bia úp (Đang nghĩ...)'}
                              {isKnockedOut && (
                                <span className="text-purple-800 font-black">
                                  [💤 Đã ngất 100%]
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Special notice if any player is passed out 100% */}
                  {passedOutCount > 0 && (
                    <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-purple-900 text-purple-100 text-[10px] font-black text-center">
                      [{PASSED_OUT_STAMP_TEXT}]
                    </div>
                  )}
                </div>

                {/* Visual Tear Line when Rejected ("Tờ hóa đơn bị xé đôi cái rẹt") */}
                {phase === 'rejected_torn' && (
                  <div className="my-3 relative py-3">
                    <div
                      className="w-full h-3 bg-sky-900"
                      style={{
                        clipPath:
                          'polygon(0% 20%, 8% 95%, 16% 10%, 25% 90%, 34% 15%, 43% 92%, 52% 12%, 61% 95%, 70% 18%, 79% 88%, 88% 12%, 95% 90%, 100% 25%, 100% 100%, 0% 100%)',
                      }}
                    />
                    {/* Bright Red Stamp: BÁC BỎ! NHẬU TIẾP! */}
                    <div
                      data-testid="surrender-rejected-stamp"
                      className="mx-auto -mt-2 border-4 border-red-600 bg-red-600/15 text-red-700 font-black text-center py-2 px-3 rounded-xl rotate-[-6deg] shadow-lg"
                    >
                      <div className="text-base sm:text-lg tracking-wider uppercase">
                        STAMP: {REJECTED_STAMP_TEXT}
                      </div>
                      <div className="text-[10px] font-bold text-red-900">
                        Tờ hóa đơn đã bị xé đôi cái rẹt! Cấm bàn lùi!
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto-Chat Feed "Rượu Vào Lời Ra" */}
                {chatFeed.length > 0 && (
                  <div className="mb-3 bg-rose-100/90 border border-rose-300 rounded-xl p-2 max-h-28 overflow-y-auto space-y-1">
                    <div className="text-[10px] font-black uppercase text-rose-800">
                      🗣️ KÊNH AUTO-CHAT "RƯỢU VÀO LỜI RA":
                    </div>
                    {chatFeed.map((item) => (
                      <div
                        key={item.id}
                        className={`text-[11px] leading-snug px-2 py-1 rounded-lg ${
                          item.choice === 'no'
                            ? 'bg-red-950 text-amber-200 font-bold'
                            : 'bg-emerald-950 text-emerald-200 font-semibold'
                        }`}
                      >
                        <strong className="underline mr-1">
                          {item.playerName}:
                        </strong>
                        {item.isJumbledDrunkText ? (
                          <span className="inline-block animate-pulse tracking-wide text-pink-300">
                            {item.text} 🥴🔀
                          </span>
                        ) : (
                          <span>"{item.text}"</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Voting Choice Buttons + "Tay Nhanh Hơn Não" (>85% Alcohol) */}
                {phase === 'voting' && (
                  <div>
                    {drunkLayout.isDrunkSwimming ? (
                      <div className="mb-2 px-2.5 py-1 rounded-lg bg-purple-900 text-amber-200 text-[10px] font-black flex items-center justify-between gap-1">
                        <span>
                          🥴 TAY NHANH HƠN NÃO ({userPlayer.alcoholLevel}% Cồn
                          &gt; 85%): 2 nút đang bơi & tự đổi chỗ!
                        </span>
                        <Shuffle className="w-3.5 h-3.5 shrink-0 animate-spin" />
                      </div>
                    ) : (
                      <div className="mb-1.5 flex items-center justify-between text-[10px] text-zinc-600 font-bold">
                        <span>
                          {hasUserVoted
                            ? '✅ Bạn đã bỏ phiếu (Có thể đổi ý trước khi hết giờ)'
                            : '👇 Chọn lá phiếu của bạn:'}
                        </span>
                        <button
                          type="button"
                          onClick={onBoostUserDrunk88ForTest}
                          className="text-[10px] font-black text-purple-700 hover:underline cursor-pointer"
                        >
                          [Thử &gt;85% Cồn Đổi Chỗ Nút]
                        </button>
                      </div>
                    )}

                    <div className="flex items-stretch gap-2 py-1">
                      {renderVoteButtons()}
                    </div>

                    {/* Quick Resolution Buttons for instant testing of Scenario 1 vs Scenario 2 */}
                    <div className="mt-2.5 pt-2 border-t border-dashed border-rose-300 flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-black text-zinc-600">
                        ⚡ Chốt nhanh kịch bản:
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          data-testid="force-reject-surrender-btn"
                          onClick={() => onForceScenario('force_reject')}
                          className="px-2 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 border border-red-400 text-[10px] font-black cursor-pointer"
                        >
                          💥 Kịch bản 1: Bác Bỏ & Phạt
                        </button>
                        <button
                          type="button"
                          data-testid="force-approve-surrender-btn"
                          onClick={() => onForceScenario('force_approve')}
                          className="px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-400 text-[10px] font-black cursor-pointer"
                        >
                          🏃 Kịch bản 2: Duyệt & Trốn Bill
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scenario 1 Punishment Details ("Tội Đồ Đòi Về Sớm") */}
                {phase === 'rejected_torn' && resolution && (
                  <div className="mt-2 bg-red-950 text-white rounded-2xl p-3 border-2 border-amber-400 shadow-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-300 uppercase flex items-center gap-1">
                        <Skull className="w-4 h-4 text-red-400" />
                        <span>HÌNH PHẠT "TỘI ĐỒ ĐÒI VỀ SỚM"</span>
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-600 text-white">
                        Khóa gọi bill 120s
                      </span>
                    </div>

                    {/* 100% Penalty Beer Mug Alert */}
                    <div className="bg-amber-500/20 border border-amber-400 rounded-xl p-2 flex items-center gap-2.5">
                      <div className="text-2xl">🍺</div>
                      <div className="text-xs leading-snug">
                        <div className="font-black text-amber-300 uppercase">
                          ⚠️ "{PENALTY_FULL_MUG_WARNING}"
                        </div>
                        <div className="text-[11px] text-zinc-200">
                          <strong>{resolution.callerName}</strong> bị cả bàn la ó
                          và phải uống cạn <strong>1 Ly Bia Phạt đầy tràn 100%</strong> (+
                          {resolution.penaltyAlcGain}% Cồn)!
                        </div>
                      </div>
                    </div>

                    {/* Falling Red Plastic Beer Crate from Sky Alert */}
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-2 text-[11px] text-zinc-200 flex items-center justify-between">
                      <span>
                        📦💥 <strong>"RẦM!"</strong> — 1 Két bia nhựa đỏ mới tinh
                        vừa rơi từ trên trời xuống cạnh bàn!
                      </span>
                      <span className="font-black text-amber-300 shrink-0 ml-2">
                        Độ khó x{resolution.newDifficultyMultiplier} (Két #{penaltyCrateCount})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={onCloseOrContinueParty}
                      className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer transition"
                    >
                      🍻 NỐC LY PHẠT 100% & NHẬU TIẾP TỚI BẾN!
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Serrated / Perforated Edge (Răng Cưa) */}
              <div
                className="h-3 w-full bg-sky-900"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 8px 12px, transparent 6px, #fff1f2 6.5px)',
                  backgroundSize: '16px 12px',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. SCENARIO 2 FINALE (5 SECONDS): "CUỘC CHIẾN GIÀNH / TRỐN HÓA ĐƠN" QTE
         ===================================================================== */}
      {phase === 'approved_escape_qte' && (
        <div
          data-testid="surrender-escape-qte-modal"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 pointer-events-auto"
        >
          <div className="w-full max-w-lg bg-zinc-950 border-4 border-amber-400 rounded-3xl p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500 text-zinc-950 font-black text-xs">
                  ĐỒNG Ý TÍNH TIỀN!
                </span>
                <span className="text-xs font-bold text-amber-300">
                  😗🎵 Tiếng huýt sáo vang lên — Chủ quán đang cầm Bill đi ra!
                </span>
              </div>
              <span className="px-3 py-1 rounded-xl bg-red-600 text-white font-black text-sm animate-pulse">
                ⏱️ {qteCountdownSeconds}s
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-black text-center text-amber-300 uppercase mb-1">
              🏃💨 CUỘC CHIẾN TRỐN HÓA ĐƠN (5 GIÂY CUỐI)!
            </h2>
            <p className="text-xs text-zinc-300 text-center mb-4">
              Bấm liên hoàn vào 1 trong 2 chiêu dưới đây để đánh lạc hướng! Kẻ
              chậm tay nhất (hoặc đã gục 100% trên bàn) sẽ bị tờ hóa đơn{' '}
              <strong className="text-rose-400">
                {totalBill.toLocaleString()}đ
              </strong>{' '}
              bay thẳng vào mặt!
            </p>

            {/* User Escape Speed Meter */}
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-3 mb-4">
              <div className="flex items-center justify-between text-xs font-black mb-1.5">
                <span className="text-emerald-300">
                  ⚡ Tốc độ chuồn của bạn ({userPlayer.name}):
                </span>
                <span className="text-amber-300">
                  {qteUserClicks} cú bấm né{' '}
                  {qteUserAction === 'run_wc'
                    ? '(🏃 Đi Vệ Sinh)'
                    : qteUserAction === 'tie_shoelace'
                    ? '(👟 Buộc Dây Giày)'
                    : ''}
                </span>
              </div>
              <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-150"
                  style={{ width: `${Math.min(100, qteUserClicks * 10)}%` }}
                />
              </div>
            </div>

            {/* 2 Rapid-Mash QTE Escape Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="qte-escape-wc-btn"
                onClick={() => onMashEscapeQTE('run_wc')}
                className="py-4 px-3 rounded-2xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white border-2 border-sky-300 font-black text-sm flex flex-col items-center gap-1 cursor-pointer shadow-lg"
              >
                <span className="text-2xl">🏃🚽</span>
                <span>[🏃 Đi Vệ Sinh]</span>
                <span className="text-[10px] font-semibold text-sky-100">
                  Bấm liên tục để chuồn vào WC!
                </span>
              </button>

              <button
                type="button"
                data-testid="qte-escape-shoelace-btn"
                onClick={() => onMashEscapeQTE('tie_shoelace')}
                className="py-4 px-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 border-2 border-amber-200 font-black text-sm flex flex-col items-center gap-1 cursor-pointer shadow-lg"
              >
                <span className="text-2xl">👟🪢</span>
                <span>[👟 Buộc Dây Giày]</span>
                <span className="text-[10px] font-bold text-zinc-800">
                  Cúi xuống gầm bàn né tờ Bill!
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. MATCH SUMMARY SCREEN: CROWNING "NHÀ TÀI TRỢ KIM CƯƠNG"
         ===================================================================== */}
      {phase === 'summary_diamond_sponsor' && qteResolution && (
        <div
          data-testid="surrender-summary-modal"
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 pointer-events-auto"
        >
          <div className="w-full max-w-lg bg-zinc-950 border-4 border-amber-400 rounded-3xl p-5 text-white shadow-2xl">
            <div className="text-center border-b border-zinc-800 pb-3 mb-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400 text-amber-300 text-xs font-black mb-1">
                <Crown className="w-4 h-4" />
                <span>BẢNG TỔNG KẾT TÍNH TIỀN • GIẢI TÁN BÀN NHẬU</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white uppercase">
                🧾 TỜ HÓA ĐƠN ĐÃ BAY TRÚNG MẶT NẠN NHÂN!
              </h2>
            </div>

            {/* Diamond Sponsor Victim Spotlight Box */}
            <div className="bg-gradient-to-br from-rose-950 via-zinc-900 to-amber-950 border-2 border-amber-400 rounded-2xl p-4 mb-4 text-center shadow-inner">
              <div className="text-3xl mb-1">
                {AVATAR_EMOJI[qteResolution.victim.avatar]} 🧾💥
              </div>
              <div className="text-xs font-bold text-amber-300 uppercase">
                DANH HIỆU CAO QUÝ ĐÊM NAY:
              </div>
              <div
                data-testid="diamond-sponsor-title"
                className="text-base sm:text-lg font-black text-white mt-0.5"
              >
                💎 "{DIAMOND_SPONSOR_TITLE}"
              </div>
              <div className="text-sm font-black text-rose-300 mt-1">
                Nạn nhân: {qteResolution.victim.playerName} • Thanh toán:{' '}
                {totalBill.toLocaleString()}đ
              </div>
              <p className="text-xs text-zinc-300 mt-1">
                {qteResolution.summaryHeadline}
              </p>
            </div>

            {/* Escape Leaderboard */}
            <div className="space-y-1.5 mb-4 max-h-44 overflow-y-auto">
              {qteResolution.participants.map((part) => (
                <div
                  key={part.playerId}
                  className={`px-3 py-2 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    part.isDiamondSponsorVictim
                      ? 'bg-rose-950/90 border-rose-500 text-rose-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{AVATAR_EMOJI[part.avatar]}</span>
                    <span className="font-black">{part.playerName}</span>
                    {part.isDiamondSponsorVictim && (
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-zinc-950 font-black text-[10px]">
                        💎 TRẢ BILL
                      </span>
                    )}
                  </div>
                  <div className="text-[11px]">
                    {part.isPassedOut ? (
                      <span className="text-purple-300">
                        💤 Gục tại trận (0 phản xạ)
                      </span>
                    ) : part.isDiamondSponsorVictim ? (
                      <span className="text-rose-300">
                        Chậm nhất ({part.escapeScore} lần bấm)
                      </span>
                    ) : (
                      <span className="text-emerald-400">
                        🏃 Thoát nạn ({part.escapeScore} lần bấm)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {onStartReturnCommute && (
                <button
                  type="button"
                  data-testid="surrender-to-return-commute-btn"
                  onClick={onStartReturnCommute}
                  className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 border-2 border-amber-300 text-white font-black text-sm uppercase tracking-wider cursor-pointer transition shadow-lg"
                >
                  🛵 RA BÃI GIỮ XE VỀ NHÀ!
                </button>
              )}
              <button
                type="button"
                onClick={onCloseOrContinueParty}
                className="w-full py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer transition"
              >
                🍻 CẢM ƠN NHÀ TÀI TRỢ KIM CƯƠNG & TIẾP TỤC CHƠI TẠI BÀN!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
