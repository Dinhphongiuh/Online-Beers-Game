import React, { useState } from 'react';
import { Player } from '../game/types';
import { sound } from '../game/audio';
import { Hand, Zap, RotateCcw } from 'lucide-react';

interface FifteenTwentyGameProps {
  players: Player[];
  userPlayer: Player;
  onFinishGame: (loser: Player) => void;
  onClose: () => void;
}

export const FifteenTwentyGame: React.FC<FifteenTwentyGameProps> = ({
  players,
  userPlayer,
  onFinishGame,
  onClose,
}) => {
  const [caller, setCaller] = useState<'user' | 'bot'>('user');
  const [consecutiveWins, setConsecutiveWins] = useState({ user: 0, bot: 0 });
  const [lastRoundInfo, setLastRoundInfo] = useState<string | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);

  const opponent = players.find((p) => !p.isUser && !p.isPassedOut) || {
    id: 'bot_minh',
    name: 'Thánh Nhậu Minh',
  } as Player;

  const validCalls = [0, 5, 10, 15, 20];
  const handChoices = [0, 5, 10]; // 0: 2 fists, 5: 1 open 1 fist, 10: 2 open hands

  const playRound = (userHand: number, userCall?: number) => {
    if (isGameOver) return;

    sound.playSlap();

    // Bot picks hand (0, 5, or 10)
    const botHand = handChoices[Math.floor(Math.random() * handChoices.length)];
    const totalFingers = userHand + botHand;

    if (caller === 'user') {
      const callVal = userCall ?? 10;
      if (callVal === totalFingers) {
        // User guessed right!
        const nextWins = consecutiveWins.user + 1;
        setConsecutiveWins({ ...consecutiveWins, user: nextWins });
        sound.playClink(1.2);

        if (nextWins >= 2) {
          setIsGameOver(true);
          setLastRoundInfo(`🎉 BẠN ĐÃ ĐOÁN ĐÚNG 2 LẦN LIÊN TIẾP (${totalFingers})! ${opponent.name} THUA CUỘC!`);
          onFinishGame(opponent);
        } else {
          setLastRoundInfo(`🎯 Bạn đoán đúng ${totalFingers}! Cần 1 lần trúng nữa để thắng.`);
        }
      } else {
        // User guessed wrong, turn passes to bot
        setConsecutiveWins({ ...consecutiveWins, user: 0 });
        setCaller('bot');
        setLastRoundInfo(`❌ Bạn hô ${callVal} nhưng tổng là ${totalFingers} (Bạn: ${userHand}, ${opponent.name}: ${botHand}). Lượt hô chuyển sang đối thủ!`);

        // Bot turn auto executes after 1.5s
        setTimeout(() => triggerBotCall(userHand), 1500);
      }
    }
  };

  const triggerBotCall = (lastUserHand: number) => {
    if (isGameOver) return;

    const botHand = handChoices[Math.floor(Math.random() * handChoices.length)];
    // Bot guesses reasonable sum: botHand + (0, 5, or 10)
    const possibleUserGuesses = [0, 5, 10];
    const botGuessedTotal = botHand + possibleUserGuesses[Math.floor(Math.random() * possibleUserGuesses.length)];

    sound.playSlap();
    const userHand = handChoices[Math.floor(Math.random() * handChoices.length)]; // responsive
    const total = botHand + userHand;

    if (botGuessedTotal === total) {
      const nextWins = consecutiveWins.bot + 1;
      setConsecutiveWins((prev) => ({ ...prev, bot: nextWins }));
      sound.playClink(0.9);

      if (nextWins >= 2) {
        setIsGameOver(true);
        setLastRoundInfo(`💥 ${opponent.name} ĐOÁN ĐÚNG 2 LẦN LIÊN TIẾP (${total})! BẠN BỊ PHẠT UỐNG!`);
        onFinishGame(userPlayer);
      } else {
        setLastRoundInfo(`🤖 ${opponent.name} hô đúng ${total}! Hãy chặn chuỗi của đối thủ.`);
      }
    } else {
      setConsecutiveWins((prev) => ({ ...prev, bot: 0 }));
      setCaller('user');
      setLastRoundInfo(`🛡️ ${opponent.name} hô ${botGuessedTotal} nhưng tổng là ${total}. Đến lượt bạn hô!`);
    }
  };

  const resetGame = () => {
    setCaller('user');
    setConsecutiveWins({ user: 0, bot: 0 });
    setLastRoundInfo(null);
    setIsGameOver(false);
  };

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-zinc-900/95 border border-cyan-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md w-[92vw] max-w-md text-white">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🖐️</span>
          <div>
            <h3 className="font-extrabold text-cyan-400 text-sm">15 - 20 (ĐẾM NGÓN TAY NHẬU)</h3>
            <p className="text-xs text-zinc-400">Trò oẳn tù tì xòe tay hô số kinh điển — Đoán trúng 2 lần thắng!</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300"
        >
          Đóng
        </button>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className={`p-2.5 rounded-xl border text-center ${caller === 'user' ? 'bg-cyan-950/60 border-cyan-500/60' : 'bg-zinc-800/60 border-zinc-700'}`}>
          <div className="text-xs text-zinc-400">Bạn (Người chơi)</div>
          <div className="text-sm font-black text-cyan-300 flex items-center justify-center gap-1 mt-0.5">
            Điểm chuỗi: {consecutiveWins.user} / 2
          </div>
          {caller === 'user' && <span className="text-[10px] text-amber-300 font-bold">👉 Đang có quyền hô!</span>}
        </div>

        <div className={`p-2.5 rounded-xl border text-center ${caller === 'bot' ? 'bg-red-950/60 border-red-500/60' : 'bg-zinc-800/60 border-zinc-700'}`}>
          <div className="text-xs text-zinc-400">{opponent.name}</div>
          <div className="text-sm font-black text-red-300 flex items-center justify-center gap-1 mt-0.5">
            Điểm chuỗi: {consecutiveWins.bot} / 2
          </div>
          {caller === 'bot' && <span className="text-[10px] text-amber-300 font-bold">👉 Đang có quyền hô!</span>}
        </div>
      </div>

      {/* Last Round Message */}
      {lastRoundInfo && (
        <div className="bg-black/50 border border-zinc-800 rounded-xl p-2.5 mb-3 text-center text-xs">
          {lastRoundInfo}
        </div>
      )}

      {/* Action Controls for User */}
      {!isGameOver && caller === 'user' && (
        <div className="bg-zinc-800/80 rounded-xl p-3 border border-cyan-500/30">
          <div className="text-xs text-cyan-300 font-bold mb-2 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> BẠN RA TAY VÀ HÔ TỔNG:
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-[11px] text-zinc-400 block mb-1">1. Chọn số ngón bạn xòe:</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 0, label: '✊ Nắm cả 2 tay (0)' },
                  { val: 5, label: '🖐️ 1 xòe 1 nắm (5)' },
                  { val: 10, label: '🙌 Xòe cả 2 tay (10)' },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => playRound(item.val, 10)}
                    className="py-1.5 px-1 bg-zinc-900 hover:bg-cyan-900/60 border border-zinc-700 rounded-lg text-xs font-semibold text-zinc-200 hover:text-white"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-700">
              <span className="text-[11px] text-zinc-400 block mb-1">2. Hoặc vừa ra tay (5) vừa hô số:</span>
              <div className="grid grid-cols-5 gap-1.5">
                {validCalls.map((call) => (
                  <button
                    key={call}
                    onClick={() => playRound(5, call)}
                    className="py-2 bg-gradient-to-b from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-black text-xs shadow active:scale-95 text-white"
                  >
                    Hô {call === 0 ? 'DÁCH' : call}!
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!isGameOver && caller === 'bot' && (
        <div className="bg-zinc-800/50 rounded-xl p-3 text-center text-xs text-zinc-400 animate-pulse">
          🤖 {opponent.name} đang chuẩn bị xòe tay hô số...
        </div>
      )}

      {isGameOver && (
        <div className="text-center mt-3">
          <button
            onClick={resetGame}
            className="flex items-center justify-center gap-1.5 w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs shadow"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Chơi Ván Mới
          </button>
        </div>
      )}
    </div>
  );
};
