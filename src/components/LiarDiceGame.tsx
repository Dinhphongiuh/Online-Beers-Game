import React, { useState } from 'react';
import { Player } from '../game/types';
import { sound } from '../game/audio';
import { Eye, ShieldAlert, Award } from 'lucide-react';

interface LiarDiceGameProps {
  players: Player[];
  userPlayer: Player;
  onFinishGame: (loser: Player) => void;
  onClose: () => void;
}

export const LiarDiceGame: React.FC<LiarDiceGameProps> = ({
  players,
  userPlayer,
  onFinishGame,
  onClose,
}) => {
  // Generate 5 random dice (1 to 6) for user and opponent
  const [userDice, setUserDice] = useState<number[]>(() =>
    Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1)
  );
  const [botDice, setBotDice] = useState<number[]>(() =>
    Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1)
  );

  const [currentBid, setCurrentBid] = useState<{ count: number; value: number } | null>(null);
  const [bidHistory, setBidHistory] = useState<string[]>([]);
  const [isUserTurn, setIsUserTurn] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [gameResult, setGameResult] = useState<{ message: string; loser: Player } | null>(null);

  const [inputCount, setInputCount] = useState(2);
  const [inputValue, setInputValue] = useState(3);

  const opponent = players.find((p) => !p.isUser && !p.isPassedOut) || {
    id: 'bot_tuan',
    name: 'Bợm Nhậu Tuấn',
  } as Player;

  const handleUserBid = () => {
    if (!isUserTurn || revealed) return;

    if (currentBid) {
      const isHigher =
        inputCount > currentBid.count ||
        (inputCount === currentBid.count && inputValue > currentBid.value);
      if (!isHigher) {
        alert('Mức tố phải cao hơn mức tố hiện tại!');
        return;
      }
    }

    sound.playDiceShake();
    const newBid = { count: inputCount, value: inputValue };
    setCurrentBid(newBid);
    setBidHistory((prev) => [
      ...prev,
      `Bạn: Tố ${inputCount} con [${inputValue}]`,
    ]);
    setIsUserTurn(false);

    // Bot decision after 1.5s
    setTimeout(() => {
      handleBotTurn(newBid);
    }, 1500);
  };

  const handleBotTurn = (lastBid: { count: number; value: number }) => {
    // Bot checks its own dice
    const matchingInBot = botDice.filter((d) => d === lastBid.value || d === 1).length;
    const estimatedTotal = matchingInBot + 2; // rough guess of user's dice

    // If bid is too absurdly high, bot calls liar!
    if (lastBid.count > estimatedTotal + 1 || lastBid.count >= 7) {
      sound.playSlap();
      setBidHistory((prev) => [
        ...prev,
        `${opponent.name}: "NÓI DỐI! MỞ CỐC ĐI BẠN ƠI!" 💥`,
      ]);
      handleReveal(lastBid, opponent);
    } else {
      // Bot raises bid
      sound.playDiceShake();
      let nextCount = lastBid.count;
      let nextValue = lastBid.value + 1;
      if (nextValue > 6) {
        nextCount += 1;
        nextValue = 2;
      }
      const newBid = { count: nextCount, value: nextValue };
      setCurrentBid(newBid);
      setBidHistory((prev) => [
        ...prev,
        `${opponent.name}: Tố ${nextCount} con [${nextValue}]`,
      ]);
      setInputCount(nextCount);
      setInputValue(nextValue);
      setIsUserTurn(true);
    }
  };

  const handleUserChallenge = () => {
    if (!currentBid || !isUserTurn || revealed) return;
    sound.playSlap();
    setBidHistory((prev) => [...prev, `Bạn: "BẮT BÀI! MỞ CỐC!" 💥`]);
    handleReveal(currentBid, userPlayer);
  };

  const handleReveal = (bid: { count: number; value: number }, challenger: Player) => {
    setRevealed(true);
    sound.playClink();

    // Count all matching dice (1 is wild if value > 1)
    const allDice = [...userDice, ...botDice];
    const totalMatch = allDice.filter((d) => d === bid.value || (bid.value !== 1 && d === 1)).length;

    let loser: Player;
    let msg: string;

    const bidder = challenger.id === userPlayer.id ? opponent : userPlayer;

    if (totalMatch >= bid.count) {
      // Bidder was right! Challenger loses!
      loser = challenger;
      msg = `Cả bàn có ${totalMatch} con [${bid.value}] (Tố ${bid.count} con). ${challenger.name} bắt bài sai, bị phạt uống!`;
    } else {
      // Bidder was lying! Bidder loses!
      loser = bidder;
      msg = `Cả bàn chỉ có ${totalMatch} con [${bid.value}] (Tố ${bid.count} con). ${bidder.name} bốc phét bị lộ, phạt uống cạn ly!`;
    }

    setGameResult({ message: msg, loser });
    onFinishGame(loser);
  };

  const restartRound = () => {
    setUserDice(Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1));
    setBotDice(Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1));
    setCurrentBid(null);
    setBidHistory([]);
    setIsUserTurn(true);
    setRevealed(false);
    setGameResult(null);
    setInputCount(2);
    setInputValue(3);
    sound.playDiceShake();
  };

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-zinc-900/95 border border-amber-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md w-[94vw] max-w-lg text-white">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎲</span>
          <div>
            <h3 className="font-extrabold text-amber-400 text-sm">LẮC XÍ NGẦU NÓI DỐI (LIAR'S DICE)</h3>
            <p className="text-xs text-zinc-400">Đoán số mặt xúc xắc cả bàn (Số 1 là Vạn Năng) — Thua phạt uống!</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300"
        >
          Đóng
        </button>
      </div>

      {/* Dice Display */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* User Dice */}
        <div className="bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-700">
          <div className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-amber-400" /> Cốc của bạn:
          </div>
          <div className="flex gap-1.5 justify-center">
            {userDice.map((d, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-lg bg-gradient-to-b from-white to-zinc-200 text-zinc-900 font-black text-sm flex items-center justify-center border-b-2 border-zinc-400 shadow"
              >
                {d === 1 ? '🔴' : d}
              </div>
            ))}
          </div>
        </div>

        {/* Opponent Dice */}
        <div className="bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-700">
          <div className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Cốc {opponent.name}:
          </div>
          <div className="flex gap-1.5 justify-center">
            {botDice.map((d, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-lg font-black text-sm flex items-center justify-center border-b-2 shadow transition-all ${
                  revealed
                    ? 'bg-gradient-to-b from-white to-zinc-200 text-zinc-900 border-zinc-400'
                    : 'bg-zinc-700 text-zinc-500 border-zinc-900'
                }`}
              >
                {revealed ? (d === 1 ? '🔴' : d) : '?'}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bid History */}
      <div className="bg-black/40 rounded-xl p-2.5 mb-3 max-h-24 overflow-y-auto text-xs space-y-1">
        {bidHistory.length === 0 ? (
          <div className="text-zinc-500 text-center italic">Chưa ai tố... Hãy ra mức tố đầu tiên!</div>
        ) : (
          bidHistory.map((h, i) => (
            <div
              key={i}
              className={h.includes('Bạn') ? 'text-amber-300 font-semibold' : 'text-zinc-300'}
            >
              {h}
            </div>
          ))
        )}
      </div>

      {/* Game Result Banner */}
      {gameResult && (
        <div className="bg-amber-950/80 border border-amber-500/60 rounded-xl p-3 mb-3 text-center">
          <div className="text-xs text-amber-200 font-bold mb-1 flex items-center justify-center gap-1">
            <Award className="w-4 h-4 text-amber-400" /> KẾT QUẢ MỞ CỐC
          </div>
          <div className="text-xs text-white">{gameResult.message}</div>
          <button
            onClick={restartRound}
            className="mt-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1 rounded-lg text-xs"
          >
            Lắc Cốc Ván Tiếp Theo
          </button>
        </div>
      )}

      {/* Action Controls */}
      {!revealed && (
        <div className="space-y-2">
          {isUserTurn ? (
            <div className="bg-zinc-800/90 rounded-xl p-3 border border-amber-500/30">
              <div className="text-xs text-amber-300 font-bold mb-2">👉 LƯỢT TỐ CỦA BẠN:</div>
              <div className="flex gap-2 items-center mb-3">
                <div className="flex-1">
                  <label className="text-[11px] text-zinc-400 block mb-1">Số lượng con:</label>
                  <select
                    value={inputCount}
                    onChange={(e) => setInputCount(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-1 px-2 text-xs text-white"
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <option key={num} value={num}>
                        {num} con
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-[11px] text-zinc-400 block mb-1">Mặt xí ngầu:</label>
                  <select
                    value={inputValue}
                    onChange={(e) => setInputValue(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-1 px-2 text-xs text-white"
                  >
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <option key={num} value={num}>
                        Mặt [{num}] {num === 1 ? '(🔴 Vạn năng)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleUserBid}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs shadow transition-all active:scale-95"
                >
                  TỐ TIẾP!
                </button>

                {currentBid && (
                  <button
                    onClick={handleUserChallenge}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs shadow transition-all active:scale-95 flex items-center justify-center gap-1"
                  >
                    💥 BẮT BÀI / MỞ CỐC!
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-800/60 rounded-xl p-3 text-center text-xs text-zinc-400">
              🤖 {opponent.name} đang cân não tính xác suất...
            </div>
          )}
        </div>
      )}
    </div>
  );
};
