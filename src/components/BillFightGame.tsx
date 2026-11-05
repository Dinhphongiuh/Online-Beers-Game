import React, { useState, useEffect } from 'react';
import { Player } from '../game/types';
import { sound } from '../game/audio';
import confetti from 'canvas-confetti';
import { Receipt, Flame, ShieldAlert, Award } from 'lucide-react';

interface BillFightGameProps {
  players: Player[];
  userPlayer: Player;
  totalBill: number;
  onFinishFight: (payer: Player, billAmount: number) => void;
  onClose: () => void;
}

export const BillFightGame: React.FC<BillFightGameProps> = ({
  players,
  userPlayer,
  totalBill,
  onFinishFight,
  onClose,
}) => {
  const activePlayers = players.filter((p) => !p.isPassedOut);
  const [currentHolderId, setCurrentHolderId] = useState<string>(() => {
    // Start with a random player
    return activePlayers[Math.floor(Math.random() * activePlayers.length)]?.id || userPlayer.id;
  });

  const [timeLeft, setTimeLeft] = useState(12);
  const [fightLogs, setFightLogs] = useState<string[]>([
    '⚡ TỜ HÓA ĐƠN BAY RA GIỮA BÀN! CUỘC CHIẾN ĐÙN ĐẨY BẮT ĐẦU!',
  ]);
  const [isOver, setIsOver] = useState(false);
  const [payer, setPayer] = useState<Player | null>(null);

  const currentHolder = activePlayers.find((p) => p.id === currentHolderId) || userPlayer;

  // Countdown loop
  useEffect(() => {
    if (isOver) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          endFight();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOver, currentHolderId]);

  // Bot random push behavior
  useEffect(() => {
    if (isOver || currentHolder.isUser) return;

    // Bot holding bill will try to throw it away within 0.8 to 1.8 seconds
    const throwDelay = 800 + Math.random() * 1000;
    const botTimer = setTimeout(() => {
      const candidates = activePlayers.filter((p) => p.id !== currentHolder.id);
      if (candidates.length === 0) return;

      const target = candidates[Math.floor(Math.random() * candidates.length)];
      sound.playSlap();

      const botExcuses = [
        `"Bóp tao rơi dưới cống rồi!" -> Ném bill cho ${target.name}`,
        `"Vợ tao gọi, tao đi vệ sinh gấp!" -> Đùn bill vào tay ${target.name}`,
        `"Thằng này giàu nhất bàn!" -> Phi tờ bill thẳng mặt ${target.name}`,
      ];
      const excuse = botExcuses[Math.floor(Math.random() * botExcuses.length)];

      setFightLogs((prev) => [...prev.slice(-4), `${currentHolder.name}: ${excuse}`]);
      setCurrentHolderId(target.id);
    }, throwDelay);

    return () => clearTimeout(botTimer);
  }, [currentHolderId, isOver]);

  const throwBillTo = (target: Player, method: string) => {
    if (isOver || !currentHolder.isUser) return;

    sound.playSlap();
    setFightLogs((prev) => [
      ...prev.slice(-4),
      `Bạn: ${method} -> Ném bill vào người ${target.name}!`,
    ]);
    setCurrentHolderId(target.id);
  };

  const endFight = () => {
    setIsOver(true);
    sound.playBell();
    const finalPayer = activePlayers.find((p) => p.id === currentHolderId) || userPlayer;
    setPayer(finalPayer);

    if (!finalPayer.isUser) {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    }

    onFinishFight(finalPayer, totalBill);
  };

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-zinc-900/95 border-2 border-red-500 rounded-2xl p-4 shadow-2xl backdrop-blur-md w-[94vw] max-w-lg text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <Receipt className="w-6 h-6 text-red-400 animate-bounce" />
          <div>
            <h3 className="font-black text-red-400 text-sm flex items-center gap-1.5">
              GIẰNG HÓA ĐƠN (BILL FIGHT) <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
            </h3>
            <p className="text-xs text-zinc-400">
              Tổng bill: <span className="text-amber-300 font-bold">{totalBill.toLocaleString()} VNĐ</span> — Ai giữ bill lúc hết giờ phải bao!
            </p>
          </div>
        </div>
        {isOver && (
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300"
          >
            Đóng
          </button>
        )}
      </div>

      {/* Countdown Timer */}
      <div className="flex items-center justify-between bg-black/60 rounded-xl p-3 mb-3 border border-red-500/30">
        <div className="text-xs text-zinc-400">Đồng hồ tính tiền:</div>
        <div className={`text-2xl font-black font-mono ${timeLeft <= 3 ? 'text-red-500 animate-ping' : 'text-amber-400'}`}>
          00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
        </div>
      </div>

      {/* Current Holder Status */}
      <div className={`p-3.5 rounded-xl border mb-3 text-center transition-all ${
        currentHolder.isUser
          ? 'bg-red-950/80 border-red-500 box-neon-red'
          : 'bg-zinc-800/80 border-zinc-700'
      }`}>
        <div className="text-xs text-zinc-300 uppercase font-semibold tracking-wider mb-1">
          {currentHolder.isUser ? '🚨 BẠN ĐANG BỊ DÍ BILL! NÉM ĐI MAU!' : 'TỜ HÓA ĐƠN ĐANG NẰM TRONG TAY:'}
        </div>
        <div className="text-lg font-black text-amber-300 flex items-center justify-center gap-2">
          🧾 {currentHolder.name} {currentHolder.isUser ? '(CHÍNH BẠN!)' : ''}
        </div>
      </div>

      {/* Live action logs */}
      <div className="bg-black/40 rounded-xl p-2.5 mb-3 text-xs space-y-1 min-h-[70px] max-h-24 overflow-y-auto">
        {fightLogs.map((log, i) => (
          <div key={i} className="text-zinc-300">
            {log}
          </div>
        ))}
      </div>

      {/* Interactive Controls for User */}
      {!isOver ? (
        currentHolder.isUser ? (
          <div className="space-y-2 bg-zinc-800/90 p-3 rounded-xl border border-red-500/50">
            <div className="text-xs text-red-300 font-bold flex items-center gap-1">
              <ShieldAlert className="w-4 h-4" /> CHỌN ĐỐI TƯỢNG ĐỂ ĐÙN ĐẨY BILL:
            </div>
            <div className="grid grid-cols-2 gap-2">
              {activePlayers
                .filter((p) => !p.isUser)
                .map((bot) => (
                  <button
                    key={bot.id}
                    onClick={() => throwBillTo(bot, '"Tao quên mang ví!"')}
                    className="py-2.5 px-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 rounded-xl font-black text-xs shadow-md active:scale-95 flex items-center justify-center gap-1 text-white"
                  >
                    👉 NÉM CHO {bot.name}!
                  </button>
                ))}
            </div>
          </div>
        ) : (
          <div className="bg-zinc-800/50 rounded-xl p-3 text-center text-xs text-zinc-400">
            Đang giữ khoảng cách... Đừng để {currentHolder.name} ném tờ bill vào người bạn!
          </div>
        )
      ) : (
        payer && (
          <div className="bg-amber-950/90 border border-amber-500/70 rounded-xl p-3 text-center">
            <div className="text-xs text-amber-200 font-bold mb-1 flex items-center justify-center gap-1">
              <Award className="w-4 h-4 text-amber-400" /> KẾT THÚC GIỜ TÍNH TIỀN!
            </div>
            <div className="text-sm font-black text-white mb-1">
              🏆 {payer.name} ĐÃ TRỞ THÀNH "CHÚA TỂ BAO CHẦU"!
            </div>
            <div className="text-xs text-zinc-300">
              {payer.isUser
                ? 'Huhu! Bạn phải thanh toán chầu nhậu và bị trừ Nắp Bia + uống phạt cạn ly!'
                : `${payer.name} đành ngậm ngùi rút ví thanh toán toàn bộ chầu nhậu! Cả bàn hoan hô!`}
            </div>
          </div>
        )
      )}
    </div>
  );
};
