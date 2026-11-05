import React, { useEffect, useState } from 'react';

interface DrunkEffectOverlayProps {
  alcoholLevel: number;
  coldTowelBuffTimer: number;
  waterSplashActive: boolean;
  craftBeerHallucination?: boolean;
  isStunned?: boolean;
  isSpicedMouth?: boolean;
  spotlightVictimName?: string | null;
  cheatingAlertText?: string | null;
  onWakeUp: () => void;
}

export const DrunkEffectOverlay: React.FC<DrunkEffectOverlayProps> = ({
  alcoholLevel,
  coldTowelBuffTimer,
  waterSplashActive,
  craftBeerHallucination = false,
  isStunned = false,
  isSpicedMouth = false,
  spotlightVictimName = null,
  cheatingAlertText = null,
  onWakeUp,
}) => {
  const [isDozingBlink, setIsDozingBlink] = useState(false);

  const isColdTowelClear = coldTowelBuffTimer > 0;
  const isTipsy = alcoholLevel >= 30 && alcoholLevel < 60 && !isColdTowelClear;
  const isHammered = alcoholLevel >= 60 && alcoholLevel < 100 && !isColdTowelClear;
  const isPassedOut = alcoholLevel >= 100;

  // Periodic "Nhắm mắt gật gù" (0.5s Eyelid Blink) when 60% - 99% alcohol
  useEffect(() => {
    if (!isHammered) {
      setIsDozingBlink(false);
      return;
    }

    const intervalMs = Math.max(4500, 9500 - (alcoholLevel - 60) * 110);
    const timer = setInterval(() => {
      setIsDozingBlink(true);
      setTimeout(() => {
        setIsDozingBlink(false);
      }, 500);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isHammered, alcoholLevel]);

  const hasAnyEffect =
    alcoholLevel >= 30 ||
    waterSplashActive ||
    isColdTowelClear ||
    craftBeerHallucination ||
    isStunned ||
    isSpicedMouth ||
    !!spotlightVictimName ||
    !!cheatingAlertText;

  if (!hasAnyEffect) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
      {/* 0a. Craft Beer Psychedelic Hallucination Color Filter */}
      {craftBeerHallucination && (
        <div className="absolute inset-0 bg-gradient-to-tr from-fuchsia-600/20 via-cyan-400/15 to-amber-400/20 mix-blend-screen animate-pulse" />
      )}

      {/* 0b. Tàu Ngầm 5s Stun Overlay */}
      {isStunned && (
        <div className="absolute inset-0 bg-purple-950/45 border-8 border-purple-500/60 flex items-center justify-center">
          <div className="bg-zinc-950/90 border-2 border-purple-400 rounded-2xl px-5 py-3 text-center shadow-2xl animate-bounce">
            <div className="text-3xl mb-1">💫💣💫</div>
            <div className="text-sm font-black text-purple-300 uppercase">
              DÍNH CHƯỞNG "TÀU NGẦM" — CHOÁNG VÁNG (STUN) 5 GIÂY!
            </div>
          </div>
        </div>
      )}

      {/* 0c. "Bỏng Mỏ" 10s Panic Run Overlay */}
      {isSpicedMouth && (
        <div className="absolute inset-0 border-8 border-red-600/70 bg-radial from-transparent via-orange-600/15 to-red-700/35">
          <div className="absolute top-28 left-1/2 -translate-x-1/2 bg-red-950/95 border-2 border-red-400 px-5 py-2 rounded-full text-xs font-black text-amber-200 shadow-2xl animate-bounce">
            🌶️🔥 BỎNG MỎ RỒI! UỐNG TRÚNG "BOM HỖN HỢP" — CHẠY VÒNG QUANH BÀN TÌM NƯỚC LỌC 10 GIÂY!
          </div>
        </div>
      )}

      {/* 0d. "ĐỒ NHẤP MÔI / LƯƠN LẸO" Spotlight Banner */}
      {spotlightVictimName && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-amber-500 text-zinc-950 border-2 border-white px-5 py-2 rounded-2xl text-xs md:text-sm font-black shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="text-xl">🔦🥜</span>
          <span>
            ĐÈN SPOTLIGHT RỌI THẲNG MẶT {spotlightVictimName.toUpperCase()}: "ĐỒ NHẤP MÔI / ĐỒ LƯƠN LẸO!" (Còn dư &gt;20% bia trong ly!)
          </span>
        </div>
      )}

      {/* 0e. Red Exclamation Mark (!) Caught Cheating Alert */}
      {cheatingAlertText && (
        <div className="absolute top-36 left-1/2 -translate-x-1/2 bg-red-600 text-white border-2 border-yellow-300 px-5 py-2.5 rounded-2xl text-xs md:text-sm font-black shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="text-2xl font-black text-yellow-300">❗</span>
          <span>{cheatingAlertText}</span>
        </div>
      )}

      {/* 1. Ice Water / Cold Towel Splash Droplets Effect */}
      {waterSplashActive && (
        <div className="absolute inset-0 border-8 border-cyan-400/40 bg-radial from-cyan-400/15 via-transparent to-cyan-500/25 transition-opacity duration-500">
          {[
            { left: '14%', top: '18%', size: 'w-4 h-6' },
            { left: '28%', top: '34%', size: 'w-3 h-5' },
            { left: '46%', top: '15%', size: 'w-5 h-7' },
            { left: '64%', top: '26%', size: 'w-3.5 h-5' },
            { left: '79%', top: '20%', size: 'w-4 h-6' },
            { left: '22%', top: '62%', size: 'w-3 h-4' },
            { left: '55%', top: '54%', size: 'w-4 h-6' },
            { left: '83%', top: '58%', size: 'w-3.5 h-5' },
          ].map((drop, i) => (
            <div
              key={i}
              style={{ left: drop.left, top: drop.top }}
              className={`absolute ${drop.size} rounded-full bg-cyan-200/75 border border-white/80 shadow-lg animate-bounce`}
            />
          ))}
          <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-cyan-950/90 border border-cyan-400 px-4 py-1.5 rounded-full text-xs font-black text-cyan-200 shadow-xl">
            🧊 XOẸT! ĐẮP KHĂN LẠNH / TẠT NƯỚC ĐÁ — MÀN HÌNH TRONG TRẺO, CAMERA HẾT LẮC 30 GIÂY!
          </div>
        </div>
      )}

      {/* 2. Tipsy 30% - 60%: Subtle Warm Figure-8 Sway Vignette */}
      {isTipsy && (
        <div className="w-full h-full bg-radial from-transparent via-transparent to-amber-500/15" />
      )}

      {/* 3. Hammered 60% - 99%: Chromatic Aberration Edge + Vignette */}
      {isHammered && (
        <div
          className="w-full h-full bg-radial from-transparent via-amber-900/15 to-red-950/45 border-4 border-red-500/25"
          style={{
            boxShadow:
              'inset 8px 0 18px rgba(239,68,68,0.28), inset -8px 0 18px rgba(6,182,212,0.28)',
          }}
        />
      )}

      {/* 4. Dozing Off Eyelid Blink (0.5s Blackout & Startle Awake) */}
      {isDozingBlink && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center transition-opacity duration-150">
          <span className="text-xs font-black text-amber-300/80 tracking-widest uppercase">
            😴 Nhắm mắt gật gù 0.5s... Giật mình tỉnh dậy!
          </span>
        </div>
      )}

      {/* 5. Passed Out Blackout Screen (100% Alcohol) */}
      {isPassedOut && (
        <div className="w-full h-full bg-black/85 pointer-events-auto flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="text-7xl mb-4 select-none animate-bounce">😵‍💫</div>
          <h2 className="text-2xl font-black text-red-500 mb-2">
            BẠN ĐÃ CHÍNH THỨC SẬP NGUỒN! (100% CỒN)
          </h2>
          <p className="text-sm text-zinc-300 max-w-md mb-4">
            Bạn đã gục mặt xuống bàn inox ngủ say như chết! Bạn bè trên bàn đang tranh nhau cầm bút vẽ râu mèo, râu quăn và chụp ảnh dìm hàng bạn!
          </p>

          <button
            onClick={onWakeUp}
            className="py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-all text-white flex items-center gap-2"
          >
            <span>☕ Uống Cốc Nước Chanh Giải Rượu (Hồi Tỉnh)</span>
          </button>
        </div>
      )}
    </div>
  );
};


