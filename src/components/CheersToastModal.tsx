import React, { useEffect, useState } from 'react';
import { CupPhysicsState, Player } from '../game/types';
import { DRINK_TIERS } from './DrinkAndBladderModal';
import { Beer, Sparkles, Flame, Volume2, X, RefreshCw, Zap, EyeOff } from 'lucide-react';

export type ChugStrategy = 'full_100' | 'half_50' | 'lip_sip_10';
export type ClinkForceResult = 'perfect' | 'oversmash_splash' | 'weak_spill';

interface CheersToastModalProps {
  userPlayer: Player;
  cupState: CupPhysicsState;
  beerTowerLevel: number;
  onQuickRefillCup: () => void;
  onExecuteCheers: (strategy: ChugStrategy, clinkResult: ClinkForceResult, forceValue: number) => void;
  onClose: () => void;
}

const CHANT_STEPS = [
  '1, 2, 3... DZÔÔÔ!! 🍻',
  '2, 3... DZÔÔÔ!! 🔥',
  '2, 3... UỐNG CẠN!! 🍺',
];

export const CheersToastModal: React.FC<CheersToastModalProps> = ({
  userPlayer,
  cupState,
  beerTowerLevel,
  onQuickRefillCup,
  onExecuteCheers,
  onClose,
}) => {
  const [cursorPos, setCursorPos] = useState(50);
  const [chantIndex, setChantIndex] = useState(0);
  const [lockedForce, setLockedForce] = useState<number | null>(null);

  const currentDrink =
    DRINK_TIERS.find((d) => d.id === cupState.drinkId) || DRINK_TIERS[1];

  // Oscillate the Clink Force Timing Cursor (speed increases with alcoholLevel)
  useEffect(() => {
    if (lockedForce !== null) return;
    let rafId = 0;
    const start = performance.now();
    const speedMultiplier = 1 + (userPlayer.alcoholLevel / 100) * 1.35;

    const update = (now: number) => {
      const elapsed = (now - start) / 1000;
      const wave = (Math.sin(elapsed * 3.4 * speedMultiplier) + 1) / 2; // 0..1
      const drunkJitter =
        userPlayer.alcoholLevel > 50
          ? Math.sin(elapsed * 17) * ((userPlayer.alcoholLevel - 45) / 55) * 7
          : 0;
      const val = Math.max(2, Math.min(98, Math.round(wave * 100 + drunkJitter)));
      setCursorPos(val);
      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [userPlayer.alcoholLevel, lockedForce]);

  // Cycle the 3-beat Vietnamese drinking chant banner
  useEffect(() => {
    const timer = setInterval(() => {
      setChantIndex((prev) => (prev + 1) % CHANT_STEPS.length);
    }, 950);
    return () => clearInterval(timer);
  }, []);

  const evaluateClinkForce = (val: number): ClinkForceResult => {
    if (val >= 58 && val <= 85) return 'perfect';
    if (val > 85) return 'oversmash_splash';
    return 'weak_spill';
  };

  const activeForce = lockedForce !== null ? lockedForce : cursorPos;
  const currentZone = evaluateClinkForce(activeForce);

  const handleTrigger = (strategy: ChugStrategy) => {
    const finalForce = lockedForce !== null ? lockedForce : cursorPos;
    setLockedForce(finalForce);
    const result = evaluateClinkForce(finalForce);
    onExecuteCheers(strategy, result, finalForce);
  };

  const isCupEmptyOrLow = cupState.liquidLevel < 20;

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-3 pointer-events-none">
      {/* Compact HUD Card at bottom-center so the 3D table & clinking characters at center stay 100% visible */}
      <div className="pointer-events-auto w-full max-w-2xl bg-zinc-950/95 border-2 border-amber-500/80 rounded-3xl p-4 shadow-[0_0_50px_rgba(245,158,11,0.35)] text-white">
        {/* Header: Rhythmic 1-2-3 DZO Banner & Close */}
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-lg animate-bounce">
              🍻
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500 text-zinc-950">
                  NHỊP HÔ BÀN NHẬU
                </span>
                <span className="text-xs font-bold text-zinc-400">
                  Tháp bia còn: <strong className="text-amber-300">{beerTowerLevel}%</strong>
                </span>
              </div>
              <div className="text-base sm:text-lg font-black text-amber-300 tracking-wide mt-0.5 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{CHANT_STEPS[chantIndex]}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition cursor-pointer"
            title="Đóng bảng Dzô"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Row 1: Current 3D Cup Status + Clink Force Timing Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-3 items-center">
          {/* Left: Visual Beer Glass Meter */}
          <div className="sm:col-span-5 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2.5 flex items-center gap-3">
            {/* Mini Visual Mug */}
            <div className="relative w-11 h-14 rounded-b-xl rounded-t-sm border-2 border-amber-200/60 bg-zinc-950 overflow-hidden shrink-0 flex flex-col justify-end">
              {cupState.liquidLevel > 0 && (
                <>
                  {/* Foam layer */}
                  <div
                    style={{
                      height: `${Math.max(8, (cupState.liquidLevel * cupState.foamRatio) / 100)}%`,
                    }}
                    className="w-full bg-amber-50/95 border-b border-amber-200/40 transition-all duration-300"
                  />
                  {/* Golden beer liquid */}
                  <div
                    style={{
                      height: `${Math.max(
                        0,
                        cupState.liquidLevel - (cupState.liquidLevel * cupState.foamRatio) / 100
                      )}%`,
                    }}
                    className="w-full bg-gradient-to-t from-amber-600 via-amber-500 to-yellow-400 transition-all duration-300"
                  />
                </>
              )}
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow">
                {cupState.liquidLevel}%
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-amber-300 truncate">
                {currentDrink.icon} {currentDrink.name}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Bọt: <strong className="text-zinc-200">{cupState.foamRatio}%</strong> • Đá:{' '}
                <strong className="text-sky-300">{cupState.iceCubes} viên</strong>
              </div>

              {isCupEmptyOrLow ? (
                <button
                  onClick={onQuickRefillCup}
                  className="mt-1.5 w-full py-1 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-[11px] flex items-center justify-center gap-1 shadow cursor-pointer transition"
                >
                  <RefreshCw className="w-3 h-3" />
                  Rót Đầy Ly Ngay (100%)
                </button>
              ) : (
                <div className="text-[10px] text-emerald-400 font-bold mt-1">
                  ✅ Ly đã sẵn sàng cụng KENG!
                </div>
              )}
            </div>
          </div>

          {/* Right: Interactive Clink Force Timing Bar */}
          <div className="sm:col-span-7 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2.5">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-bold text-zinc-300">
                ⚡ Canh Lực Vung Tay Cụng Ly:
              </span>
              <span
                className={`font-black px-2 py-0.5 rounded ${
                  currentZone === 'perfect'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : currentZone === 'oversmash_splash'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {currentZone === 'perfect'
                  ? '🎯 CHUẨN TÂM VÀNG (KENG GIÒN!)'
                  : currentZone === 'oversmash_splash'
                  ? '💥 QUÁ MẠNH (VĂNG BỌT QUA BẠN!)'
                  : '💦 HỤT LỰC (DỄ ĐỔ BIA RA ÁO)'}
              </span>
            </div>

            {/* Bar Track */}
            <div className="relative h-5 w-full rounded-xl overflow-hidden bg-zinc-950 border border-zinc-700 flex">
              {/* Weak Zone 0-58% */}
              <div className="w-[58%] h-full bg-gradient-to-r from-zinc-800 to-amber-700/50 flex items-center justify-center text-[9px] font-bold text-zinc-400">
                Hụt Lực (Đổ Áo)
              </div>
              {/* Sweet Spot 58-85% */}
              <div className="w-[27%] h-full bg-gradient-to-r from-emerald-500 to-amber-400 flex items-center justify-center text-[9px] font-black text-zinc-950">
                CHUẨN KENG
              </div>
              {/* Oversmash 85-100% */}
              <div className="w-[15%] h-full bg-gradient-to-r from-orange-600 to-rose-600 flex items-center justify-center text-[9px] font-black text-white">
                HÚNG!
              </div>

              {/* Moving Needle */}
              <div
                style={{ left: `${activeForce}%` }}
                className="absolute top-0 bottom-0 w-1.5 -ml-0.5 bg-white shadow-[0_0_10px_#fff] rounded-full transition-none"
              />
            </div>

            <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
              <span>Say {userPlayer.alcoholLevel}% → Tay lắc theo độ cồn</span>
              <span>
                {currentZone === 'perfect'
                  ? '+25 Nắp Bia • Không đổ giọt nào'
                  : currentZone === 'oversmash_splash'
                  ? 'Văng 25% bia sang ly đối diện (Đỡ say!)'
                  : 'Đổ bọt ra áo ba lỗ (-5 Tỉnh táo)'}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: 3 Drinking Strategies (100% Chug vs 50% Half vs 10% Sneaky Lip-Sip) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* 1. Dzô 100% Cạn Sạch */}
          <button
            onClick={() => handleTrigger('full_100')}
            className="group relative bg-gradient-to-b from-amber-400 via-amber-500 to-orange-600 hover:from-amber-300 hover:to-orange-500 text-zinc-950 rounded-2xl p-3 text-left shadow-lg border border-amber-200 transition active:scale-95 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider bg-zinc-950/15 px-2 py-0.5 rounded-md">
                100% TRĂM PHẦN TRĂM
              </span>
              <Flame className="w-4 h-4 text-zinc-950" />
            </div>
            <div className="text-sm font-black mt-1 flex items-center gap-1">
              <span>🍻 DZÔ CẠN SẠCH LY!</span>
            </div>
            <div className="text-[11px] font-bold text-zinc-900/85 mt-0.5">
              {isCupEmptyOrLow
                ? 'Tự rót đầy & uống cạn 100% -> Dằn ly CỘP!'
                : `Uống sạch ${cupState.liquidLevel}% trong ly -> Dằn ly CỘP!`}
            </div>
            <div className="mt-1.5 text-[10px] font-black text-zinc-950 bg-white/30 rounded px-1.5 py-0.5 inline-block">
              +{currentDrink.alcoholDelta}% Cồn • +30 Nắp Bia
            </div>
          </button>

          {/* 2. Dzô 50% Nửa Ly Giữ Sức */}
          <button
            onClick={() => handleTrigger('half_50')}
            className="bg-zinc-900 hover:bg-zinc-800 border border-amber-500/50 text-white rounded-2xl p-3 text-left transition active:scale-95 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md">
                50% NỬA LY GIỮ ĐÔ
              </span>
              <Beer className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-sm font-black text-amber-200 mt-1">
              🍺 UỐNG 50% CẦM CHỪNG
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Cụng ly xôm tụ nhưng chỉ uống nửa cốc để giữ sức gắp mồi.
            </div>
            <div className="mt-1.5 text-[10px] font-bold text-amber-300 bg-amber-500/10 rounded px-1.5 py-0.5 inline-block">
              +{Math.round(currentDrink.alcoholDelta * 0.5)}% Cồn • +15 Nắp Bia
            </div>
          </button>

          {/* 3. Nhấp Môi 10% Lươn Lẹo */}
          <button
            onClick={() => handleTrigger('lip_sip_10')}
            className="bg-zinc-900 hover:bg-zinc-800 border border-purple-500/50 text-white rounded-2xl p-3 text-left transition active:scale-95 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md">
                10% TIỂU XẢO LƯƠN LẸO
              </span>
              <EyeOff className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-sm font-black text-purple-200 mt-1">
              😏 NHẤP MÔI GIẢ VỜ UỐNG
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Ngửa cổ cực sâu nhưng chỉ hớp 10%! (50% trót lọt / 50% bị Spotlight bắt phạt).
            </div>
            <div className="mt-1.5 text-[10px] font-bold text-purple-300 bg-purple-500/10 rounded px-1.5 py-0.5 inline-block">
              Trót lọt: +0% Cồn • Bị bắt: Phạt x2!
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
