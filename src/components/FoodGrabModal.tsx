import React, { useState, useEffect, useRef } from 'react';
import { FoodDish, Player } from '../game/types';
import { sound } from '../game/audio';
import {
  UtensilsCrossed,
  Flame,
  HeartHandshake,
  Zap,
  Swords,
  PlusCircle,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

export type GrabMode = 'self' | 'feed_friend' | 'spicy_prank';

export type GrabPrecision = 'perfect' | 'normal' | 'spicy_trap' | 'slipped';

interface FoodGrabModalProps {
  userPlayer: Player;
  players: Player[];
  dishes: FoodDish[];
  initialDishId?: string;
  onExecuteGrab: (
    dishId: string,
    mode: GrabMode,
    targetPlayerId: string,
    precision: GrabPrecision
  ) => void;
  onOrderDish: (dishId: string) => void;
  onStartClashStateChange?: (active: boolean, dishId?: string) => void;
  onClose: () => void;
}

export const FoodGrabModal: React.FC<FoodGrabModalProps> = ({
  userPlayer,
  players,
  dishes,
  initialDishId,
  onExecuteGrab,
  onOrderDish,
  onStartClashStateChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'grab' | 'order'>('grab');
  const [selectedDishId, setSelectedDishId] = useState<string>(
    initialDishId || dishes.find((d) => d.servings > 0)?.id || dishes[0]?.id || 'peanut'
  );
  const [grabMode, setGrabMode] = useState<GrabMode>('self');
  const [targetFriendId, setTargetFriendId] = useState<string>(() => {
    const firstBot = players.find((p) => !p.isUser && !p.isPassedOut);
    return firstBot ? firstBot.id : userPlayer.id;
  });

  // Drunk Chopstick Timing Bar state (0 to 100)
  const [cursorPos, setCursorPos] = useState<number>(50);
  const cursorDirRef = useRef<number>(1);
  const cursorPosRef = useRef<number>(50);

  // Last-Piece Chopstick Clash state ("Đấu Đũa Cướp Mồi Cuối")
  const [clashActive, setClashActive] = useState<boolean>(false);
  const [clashPower, setClashPower] = useState<number>(52);
  const [clashTimeLeft, setClashTimeLeft] = useState<number>(3.5);
  const [clashRival, setClashRival] = useState<Player | null>(null);

  const selectedDish = dishes.find((d) => d.id === selectedDishId) || dishes[0];
  const friends = players.filter((p) => !p.isUser && !p.isPassedOut);

  // Oscillate the chopstick aiming cursor; speed & jitter scale with user's alcoholLevel
  useEffect(() => {
    if (clashActive || activeTab !== 'grab') return;

    const drunkFactor = 1 + (userPlayer.alcoholLevel / 100) * 1.8;
    const interval = setInterval(() => {
      const step = 2.4 * drunkFactor;
      const drunkJitter =
        userPlayer.alcoholLevel > 35
          ? (Math.random() - 0.5) * (userPlayer.alcoholLevel / 18)
          : 0;

      let next = cursorPosRef.current + cursorDirRef.current * step + drunkJitter;
      if (next >= 98) {
        next = 98;
        cursorDirRef.current = -1;
      } else if (next <= 2) {
        next = 2;
        cursorDirRef.current = 1;
      }
      cursorPosRef.current = next;
      setCursorPos(next);
    }, 28);

    return () => clearInterval(interval);
  }, [userPlayer.alcoholLevel, clashActive, activeTab]);

  // Handle Last-Piece Chopstick Clash countdown & bot pushback
  useEffect(() => {
    if (!clashActive) return;

    const timer = setInterval(() => {
      setClashTimeLeft((prev) => {
        if (prev <= 0.1) {
          clearInterval(timer);
          return 0;
        }
        return Number((prev - 0.1).toFixed(1));
      });

      // Bot pushes back against user's chopsticks
      setClashPower((prev) => Math.max(5, prev - (2.4 + Math.random() * 2.2)));
    }, 100);

    return () => clearInterval(timer);
  }, [clashActive]);

  // Resolve Clash when time runs out or power hits 100 / 0
  useEffect(() => {
    if (!clashActive || !selectedDish) return;

    if (clashPower >= 95 || (clashTimeLeft <= 0 && clashPower >= 50)) {
      // User wins the Chopstick Clash!
      setClashActive(false);
      onStartClashStateChange?.(false);
      sound.playCrunch();
      const recipientId = grabMode === 'self' ? userPlayer.id : targetFriendId;
      onExecuteGrab(selectedDish.id, grabMode, recipientId, 'perfect');
    } else if (clashPower <= 8 || (clashTimeLeft <= 0 && clashPower < 50)) {
      // Rival Bot wins the Chopstick Clash!
      setClashActive(false);
      onStartClashStateChange?.(false);
      sound.playSlap();
      if (clashRival) {
        onExecuteGrab(selectedDish.id, 'self', clashRival.id, 'normal');
      }
    }
  }, [clashPower, clashTimeLeft, clashActive]);

  const evaluateCursorPrecision = (pos: number): GrabPrecision => {
    // Center 38..62 is Perfect Golden Zone
    if (pos >= 38 && pos <= 62) return 'perfect';
    // 18..38 and 62..82 is Normal Grab Zone
    if ((pos >= 18 && pos < 38) || (pos > 62 && pos <= 82)) return 'normal';
    // Edges (<18 or >82): Spicy Chili Trap or Slipped off chopsticks
    return Math.random() < (selectedDish?.spicyRisk ?? 0.5) ? 'spicy_trap' : 'slipped';
  };

  const handleTriggerGrab = () => {
    if (!selectedDish || selectedDish.servings <= 0) return;

    // If only 1 piece is left (or 30% chance when 2 pieces left), a bot challenges for the Last Piece!
    const hungryBots = players.filter((p) => !p.isUser && !p.isPassedOut);
    if (selectedDish.servings === 1 && hungryBots.length > 0) {
      const rival =
        hungryBots.find((b) => b.name.includes('Linh')) ||
        hungryBots[Math.floor(Math.random() * hungryBots.length)];
      sound.playChopstickClack();
      setClashRival(rival);
      setClashPower(52);
      setClashTimeLeft(3.5);
      setClashActive(true);
      onStartClashStateChange?.(true, selectedDish.id);
      return;
    }

    const precision =
      grabMode === 'spicy_prank' ? 'spicy_trap' : evaluateCursorPrecision(cursorPosRef.current);

    if (precision === 'spicy_trap') {
      sound.playSpicySizzle();
    } else if (precision === 'slipped') {
      sound.playChopstickClack();
    } else {
      sound.playChopstickClack();
      setTimeout(() => sound.playCrunch(), 220);
    }

    const recipientId = grabMode === 'self' ? userPlayer.id : targetFriendId;
    onExecuteGrab(selectedDish.id, grabMode, recipientId, precision);
  };

  const handleClashTap = () => {
    if (!clashActive) return;
    sound.playChopstickClack();
    setClashPower((prev) => Math.min(100, prev + 11));
  };

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-zinc-900/95 border border-amber-500/50 rounded-2xl p-4 shadow-2xl w-[94vw] max-w-lg text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl">
            🥢
          </div>
          <div>
            <h3 className="font-extrabold text-amber-400 text-sm flex items-center gap-1.5">
              TUYỆT KỸ GẮP MỒI & ĐẤU ĐŨA BÀN NHẬU
            </h3>
            <p className="text-[11px] text-zinc-400">
              Gắp chuẩn giải rượu • Gắp giùm tình nghĩa • Cướp miếng mồi cuối!
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            onStartClashStateChange?.(false);
            onClose();
          }}
          className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300"
        >
          Đóng
        </button>
      </div>

      {/* Mode Switch Tabs */}
      <div className="flex gap-1.5 mb-3">
        <button
          onClick={() => setActiveTab('grab')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'grab'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'bg-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" /> Đĩa Mồi Trên Bàn
        </button>
        <button
          onClick={() => setActiveTab('order')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'order'
              ? 'bg-emerald-500 text-zinc-950 shadow'
              : 'bg-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" /> Gọi Thêm Mồi Mới (Menu)
        </button>
      </div>

      {/* ACTIVE CHOPSTICK CLASH MINI-EVENT ("Cướp Miếng Mồi Cuối Cùng") */}
      {clashActive && clashRival && selectedDish ? (
        <div className="bg-red-950/90 border-2 border-amber-400 rounded-2xl p-4 my-2 text-center">
          <div className="flex items-center justify-between text-xs font-bold text-amber-300 mb-1">
            <span className="flex items-center gap-1">
              <Swords className="w-4 h-4 text-red-400" /> ĐẤU ĐŨA CƯỚP MIẾNG CUỐI!
            </span>
            <span className="font-mono text-sm text-white bg-red-600 px-2 py-0.5 rounded">
              {clashTimeLeft}s
            </span>
          </div>

          <div className="text-sm font-black text-white my-1">
            {selectedDish.icon} {selectedDish.name} chỉ còn đúng 1 miếng cuối cùng!
          </div>
          <p className="text-xs text-red-200 mb-3">
            🤖 <b>{clashRival.name}</b> đang phóng đũa tới kẹp! Bấm liên hoàn để giật mồi!
          </p>

          {/* Tug of war bar */}
          <div className="relative h-6 bg-zinc-900 rounded-full overflow-hidden border border-amber-500/60 mb-3">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-all duration-75"
              style={{ width: `${clashPower}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-3 text-[11px] font-black text-white drop-shadow">
              <span>🥢 BẠN ({Math.round(clashPower)}%)</span>
              <span>⚔️</span>
              <span>{clashRival.name} 🥢</span>
            </div>
          </div>

          <button
            onClick={handleClashTap}
            className="w-full py-3 bg-gradient-to-r from-amber-500 via-yellow-400 to-red-500 hover:from-amber-400 hover:to-red-400 text-zinc-950 font-black text-sm rounded-xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            🥢 CẠCH CẠCH! BẤM LIÊN TỤC GIẬT MỒI! 🔥
          </button>
        </div>
      ) : activeTab === 'grab' ? (
        <div className="space-y-3">
          {/* 1. Dish Grid on Table */}
          <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-0.5">
            {dishes.map((dish) => {
              const isSelected = dish.id === selectedDishId;
              const isLastPiece = dish.servings === 1;
              const isEmpty = dish.servings <= 0;

              return (
                <button
                  key={dish.id}
                  onClick={() => {
                    sound.playChopstickClack();
                    setSelectedDishId(dish.id);
                  }}
                  className={`p-2 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-950/70 border-amber-400 shadow-md'
                      : isEmpty
                      ? 'bg-zinc-900/50 border-zinc-800 opacity-50'
                      : 'bg-zinc-800/70 border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  {isLastPiece && (
                    <span className="absolute -top-1.5 -right-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shadow">
                      MIẾNG CUỐI!
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{dish.icon}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isEmpty
                          ? 'bg-zinc-800 text-zinc-500'
                          : isLastPiece
                          ? 'bg-red-950 text-red-300 border border-red-500/40'
                          : 'bg-emerald-950 text-emerald-300'
                      }`}
                    >
                      {dish.servings}/{dish.maxServings}
                    </span>
                  </div>
                  <div className="mt-1">
                    <div className="text-xs font-bold text-white line-clamp-1">{dish.name}</div>
                    <div className="text-[10px] text-emerald-400 font-semibold">
                      {dish.alcoholDelta}% Cồn • +{dish.staminaDelta} Tỉnh
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 2. Target & Intention Selector: Tự ăn / Gắp giùm / Bẫy Ớt Hiểm */}
          <div className="bg-zinc-800/80 rounded-xl p-2.5 border border-zinc-700/80 space-y-2">
            <div className="text-[11px] font-bold text-zinc-300 flex items-center justify-between">
              <span>Kiểu gắp đũa trên bàn:</span>
              <span className="text-amber-300 font-semibold">
                {userPlayer.alcoholLevel > 50
                  ? `🥴 Tay đang run (${userPlayer.alcoholLevel}% cồn)`
                  : '😎 Tay cầm đũa vững'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setGrabMode('self')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 border transition-all ${
                  grabMode === 'self'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                }`}
              >
                😋 Tự Gắp Ăn
              </button>
              <button
                onClick={() => setGrabMode('feed_friend')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 border transition-all ${
                  grabMode === 'feed_friend'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                }`}
              >
                <HeartHandshake className="w-3.5 h-3.5" /> Gắp Giùm Bạn
              </button>
              <button
                onClick={() => setGrabMode('spicy_prank')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 border transition-all ${
                  grabMode === 'spicy_prank'
                    ? 'bg-red-500/20 border-red-400 text-red-300'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-red-400" /> Bẫy Ớt Hiểm
              </button>
            </div>

            {/* Friend Selector if feeding or pranking */}
            {grabMode !== 'self' && friends.length > 0 && (
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                <span className="text-[10px] text-zinc-400 shrink-0">Đút cho:</span>
                {friends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => setTargetFriendId(friend.id)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold shrink-0 border transition-all ${
                      targetFriendId === friend.id
                        ? 'bg-amber-500 text-zinc-950 border-amber-300'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {friend.name} ({friend.alcoholLevel}% cồn)
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Interactive Chopstick Precision Gauge */}
          {selectedDish && selectedDish.servings > 0 ? (
            <div className="bg-zinc-950/90 rounded-xl p-3 border border-zinc-800">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-zinc-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Canh tâm đĩa bấm GẮP để x1.5 giải rượu:
                </span>
                <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /> Rìa đỏ: Rớt mồi / Cắn nhầm ớt!
                </span>
              </div>

              {/* Target Bar */}
              <div className="relative h-7 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700 mb-2.5 flex">
                {/* Left Chili/Slip Zone (0-18%) */}
                <div className="w-[18%] h-full bg-red-950/80 flex items-center justify-center text-[10px] border-r border-zinc-800">
                  🌶️
                </div>
                {/* Left Normal Zone (18-38%) */}
                <div className="w-[20%] h-full bg-emerald-950/60 flex items-center justify-center text-[9px] text-emerald-300 font-bold">
                  THƯỜNG
                </div>
                {/* Center Golden Sweet-Spot (38-62%) */}
                <div className="w-[24%] h-full bg-amber-500/30 border-x-2 border-amber-400 flex items-center justify-center text-[10px] text-amber-300 font-black">
                  ⭐ CHUẨN x1.5
                </div>
                {/* Right Normal Zone (62-82%) */}
                <div className="w-[20%] h-full bg-emerald-950/60 flex items-center justify-center text-[9px] text-emerald-300 font-bold">
                  THƯỜNG
                </div>
                {/* Right Chili/Slip Zone (82-100%) */}
                <div className="w-[18%] h-full bg-red-950/80 flex items-center justify-center text-[10px] border-l border-zinc-800">
                  🌶️
                </div>

                {/* Moving Chopstick Cursor */}
                <div
                  className="absolute top-0 bottom-0 w-6 -ml-3 flex items-center justify-center text-base drop-shadow pointer-events-none"
                  style={{ left: `${cursorPos}%` }}
                >
                  🥢
                </div>
              </div>

              <button
                onClick={handleTriggerGrab}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-xs md:text-sm rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>🥢</span>
                <span>
                  {selectedDish.servings === 1
                    ? `PHÓNG ĐŨA TRANH MIẾNG ${selectedDish.name.toUpperCase()} CUỐI CÙNG!`
                    : grabMode === 'self'
                    ? `KẸP ĐŨA GẮP ${selectedDish.name.toUpperCase()}!`
                    : grabMode === 'feed_friend'
                    ? `GẮP GIÙM BẠN HIỀN (+20 NẮP BIA)!`
                    : `KẸP ỚT HIỂM ĐÚT BẠN CAY XÈ!`}
                </span>
              </button>
            </div>
          ) : (
            <div className="bg-zinc-950/80 rounded-xl p-4 text-center border border-zinc-800">
              <div className="text-2xl mb-1">🍽️</div>
              <div className="text-xs font-bold text-amber-300 mb-2">
                Đĩa {selectedDish?.name} đã bị anh em gắp sạch sành sanh!
              </div>
              <button
                onClick={() => selectedDish && onOrderDish(selectedDish.id)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow"
              >
                🛎️ Kêu Chủ Quán Lên Thêm 1 Đĩa ({selectedDish?.price.toLocaleString()}đ)
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ORDER NEW DISHES / REFILL MENU TAB */
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {dishes.map((dish) => (
            <div
              key={dish.id}
              className="p-2.5 bg-zinc-800/80 border border-zinc-700 rounded-xl flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{dish.icon}</span>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    {dish.name}
                    <span className="text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-400">
                      Còn {dish.servings}/{dish.maxServings}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400">{dish.description}</div>
                  <div className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-2">
                    <span>{dish.alcoholDelta}% Cồn</span>
                    <span>•</span>
                    <span>+{dish.staminaDelta} Tỉnh táo</span>
                    <span>•</span>
                    <span className="text-amber-300">{dish.price.toLocaleString()} VNĐ</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  sound.playBell();
                  onOrderDish(dish.id);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shrink-0 shadow active:scale-95"
              >
                + Gọi Đĩa Mới
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
