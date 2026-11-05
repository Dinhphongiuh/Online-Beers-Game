import React, { useState } from 'react';
import { Player } from '../game/types';
import { sound } from '../game/audio';
import { RotateCcw, AlertCircle } from 'lucide-react';

interface CrocodileGameProps {
  players: Player[];
  userPlayer: Player;
  onToothPressed: (toothIndex: number, isTrap: boolean, victim: Player) => void;
  onClose: () => void;
}

export const CrocodileGame: React.FC<CrocodileGameProps> = ({
  players,
  userPlayer,
  onToothPressed,
  onClose,
}) => {
  const [trapTooth, setTrapTooth] = useState(() => Math.floor(Math.random() * 10));
  const [pressedTeeth, setPressedTeeth] = useState<number[]>([]);
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [loserName, setLoserName] = useState<string | null>(null);

  const activePlayers = players.filter((p) => !p.isPassedOut);
  const currentPlayer = activePlayers[currentTurnIdx % activePlayers.length] || userPlayer;

  const handlePress = (idx: number) => {
    if (pressedTeeth.includes(idx) || isGameOver) return;

    const isTrap = idx === trapTooth;
    setPressedTeeth((prev) => [...prev, idx]);

    if (isTrap) {
      sound.playSnap();
      setIsGameOver(true);
      setLoserName(currentPlayer.name);
      onToothPressed(idx, true, currentPlayer);
    } else {
      sound.playDiceShake();
      onToothPressed(idx, false, currentPlayer);
      // Next turn
      setCurrentTurnIdx((prev) => prev + 1);

      // If next player is bot, trigger bot auto turn after short delay
      const nextIdx = (currentTurnIdx + 1) % activePlayers.length;
      const nextPlayer = activePlayers[nextIdx];
      if (nextPlayer && !nextPlayer.isUser) {
        setTimeout(() => {
          handleBotTurn(nextPlayer, [...pressedTeeth, idx]);
        }, 1200);
      }
    }
  };

  const handleBotTurn = (bot: Player, currentPressed: number[]) => {
    if (isGameOver) return;
    const available = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((i) => !currentPressed.includes(i));
    if (available.length === 0) return;

    const randomPick = available[Math.floor(Math.random() * available.length)];
    const isTrap = randomPick === trapTooth;
    setPressedTeeth((prev) => [...prev, randomPick]);

    if (isTrap) {
      sound.playSnap();
      setIsGameOver(true);
      setLoserName(bot.name);
      onToothPressed(randomPick, true, bot);
    } else {
      sound.playDiceShake();
      onToothPressed(randomPick, false, bot);
      setCurrentTurnIdx((prev) => prev + 1);

      // Continue to next
      const afterIdx = (currentTurnIdx + 2) % activePlayers.length;
      const afterPlayer = activePlayers[afterIdx];
      if (afterPlayer && !afterPlayer.isUser) {
        setTimeout(() => {
          handleBotTurn(afterPlayer, [...currentPressed, randomPick]);
        }, 1200);
      }
    }
  };

  const resetGame = () => {
    setTrapTooth(Math.floor(Math.random() * 10));
    setPressedTeeth([]);
    setIsGameOver(false);
    setLoserName(null);
    setCurrentTurnIdx(0);
  };

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-zinc-900/90 border border-green-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md w-[92vw] max-w-md text-white">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐊</span>
          <div>
            <h3 className="font-extrabold text-green-400 text-sm">BỐC RĂNG CÁ SẤU (ROULETTE)</h3>
            <p className="text-xs text-zinc-400">Ấn từng chiếc răng — Ai dính răng bẫy phạt 1 ly bia!</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300"
        >
          Đóng
        </button>
      </div>

      {/* Turn indicator */}
      {!isGameOver ? (
        <div className="bg-zinc-800/80 rounded-xl p-2.5 mb-3 flex items-center justify-between text-xs">
          <span className="text-zinc-400">Lượt bốc hiện tại:</span>
          <span className="font-bold text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-600/30">
            {currentPlayer.isUser ? '👉 LƯỢT CỦA BẠN!' : `🤖 ${currentPlayer.name} đang suy nghĩ...`}
          </span>
        </div>
      ) : (
        <div className="bg-red-950/80 border border-red-500/50 rounded-xl p-3 mb-3 text-center">
          <div className="text-xl mb-1">💥 KHẬP! CÁ SẤU CẮN TAY!</div>
          <div className="text-sm font-bold text-red-200">
            {loserName} đã dính bẫy! Phạt cạn 1 ly bia (+20% cồn)!
          </div>
        </div>
      )}

      {/* 10 Teeth Buttons */}
      <div className="grid grid-cols-5 gap-2 my-2">
        {Array.from({ length: 10 }).map((_, idx) => {
          const isPressed = pressedTeeth.includes(idx);
          const isTrapAndOver = isGameOver && idx === trapTooth;

          return (
            <button
              key={idx}
              disabled={isPressed || isGameOver || (!currentPlayer.isUser && !isGameOver)}
              onClick={() => handlePress(idx)}
              className={`h-12 rounded-xl font-bold flex flex-col items-center justify-center transition-all ${
                isTrapAndOver
                  ? 'bg-red-600 text-white animate-bounce'
                  : isPressed
                  ? 'bg-zinc-800 text-zinc-600 opacity-40 cursor-not-allowed border border-zinc-700'
                  : 'bg-gradient-to-b from-white to-zinc-200 text-zinc-900 shadow-md hover:scale-105 active:scale-95 border-b-4 border-zinc-400'
              }`}
            >
              <span className="text-xs">🦷</span>
              <span className="text-[10px] font-mono">{idx + 1}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-zinc-800 mt-3 text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 text-zinc-400" />
          Răng an toàn: {10 - pressedTeeth.length} / 10
        </span>
        {isGameOver && (
          <button
            onClick={resetGame}
            className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white font-bold px-3 py-1.5 rounded-lg shadow"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Chơi Ván Mới
          </button>
        )}
      </div>
    </div>
  );
};
