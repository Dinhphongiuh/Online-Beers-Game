import React, { useState } from 'react';
import { Player } from '../game/types';
import { sound } from '../game/audio';
import { Play, Sparkles } from 'lucide-react';

interface SpinBottleGameProps {
  players: Player[];
  onTriggerSpinIn3D: () => void;
  onPlayerSelected: (victim: Player, choice: 'drink' | 'truth_dare') => void;
  onClose: () => void;
}

export const SpinBottleGame: React.FC<SpinBottleGameProps> = ({
  players,
  onTriggerSpinIn3D,
  onPlayerSelected,
  onClose,
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const handleSpin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setSelectedPlayer(null);
    sound.playDiceShake();
    onTriggerSpinIn3D();

    // After 2.5 seconds, select target
    setTimeout(() => {
      const activePlayers = players.filter((p) => !p.isPassedOut);
      const chosen = activePlayers[Math.floor(Math.random() * activePlayers.length)];
      setSelectedPlayer(chosen);
      setIsSpinning(false);
      sound.playClink();
    }, 2500);
  };

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-zinc-900/95 border border-emerald-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md w-[92vw] max-w-md text-white">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍾</span>
          <div>
            <h3 className="font-extrabold text-emerald-400 text-sm">XOAY CHAI BIA BỜ KÈ</h3>
            <p className="text-xs text-zinc-400">Đầu chai chỉ vào ai — người đó nhận số phận!</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300"
        >
          Đóng
        </button>
      </div>

      <div className="my-3 text-center">
        {selectedPlayer ? (
          <div className="bg-emerald-950/60 border border-emerald-500/50 rounded-xl p-3.5 mb-3">
            <div className="text-xs text-emerald-300 font-semibold mb-1">CHAI ĐÃ DỪNG LẠI!</div>
            <div className="text-lg font-black text-amber-300 flex items-center justify-center gap-2">
              🎯 {selectedPlayer.name} {selectedPlayer.isUser ? '(Chính là bạn!)' : ''}
            </div>
            <p className="text-xs text-zinc-300 mt-1">Chọn hình thức chấp nhận hình phạt:</p>

            <div className="flex gap-2 mt-3 justify-center">
              <button
                onClick={() => onPlayerSelected(selectedPlayer, 'drink')}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow"
              >
                🍺 Uống 1 Ly (+15% cồn)
              </button>
              <button
                onClick={() => onPlayerSelected(selectedPlayer, 'truth_dare')}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow"
              >
                <Sparkles className="w-3.5 h-3.5" /> Thật hay Thách AI
              </button>
            </div>
          </div>
        ) : isSpinning ? (
          <div className="py-6 flex flex-col items-center justify-center">
            <div className="text-4xl animate-spin mb-2">🍾</div>
            <div className="text-xs font-bold text-amber-300 animate-pulse">
              Chai bia đang xoay tít trên bàn inox...
            </div>
          </div>
        ) : (
          <div className="py-4 text-xs text-zinc-400">
            Bấm nút bên dưới để dồn lực xoay chai bia giữa bàn!
          </div>
        )}

        <button
          disabled={isSpinning}
          onClick={handleSpin}
          className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
        >
          <Play className="w-4 h-4 fill-current" /> {isSpinning ? 'Đang xoay...' : 'LÊN TAY XOAY CHAI!'}
        </button>
      </div>
    </div>
  );
};
