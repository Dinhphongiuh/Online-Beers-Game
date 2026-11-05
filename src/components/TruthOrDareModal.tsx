import React, { useState } from 'react';
import { Player } from '../game/types';
import { sound } from '../game/audio';
import { Sparkles, RefreshCw, CheckCircle2, Beer, AlertCircle } from 'lucide-react';

interface TruthOrDareModalProps {
  players: Player[];
  targetPlayer: Player;
  onComplete: (drankPenalty: boolean) => void;
  onClose: () => void;
}

export const TruthOrDareModal: React.FC<TruthOrDareModalProps> = ({
  players,
  targetPlayer,
  onComplete,
  onClose,
}) => {
  const [selectedType, setSelectedType] = useState<'truth' | 'dare'>('dare');
  const [promptText, setPromptText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasGenerated, setHasGenerated] = useState<boolean>(false);

  const generatePrompt = async (type: 'truth' | 'dare') => {
    setSelectedType(type);
    setIsLoading(true);
    sound.playDiceShake();

    try {
      const res = await fetch('/api/truth-or-dare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          playerName: targetPlayer.name,
          tablePlayers: players.map((p) => p.name),
          mood: 'funny',
        }),
      });

      const data = await res.json();
      setPromptText(data.text);
      setHasGenerated(true);
      sound.playClink();
    } catch (err) {
      console.error(err);
      setPromptText(
        type === 'truth'
          ? 'Kể tên một người trong bàn mà bạn muốn mời đi nhậu riêng nhất và vì sao?'
          : 'Hô thật to "DZÔ!" bằng giọng say xỉn bẹp dí trong 10 giây!'
      );
      setHasGenerated(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePassChallenge = () => {
    sound.playClink(1.3);
    onComplete(false);
  };

  const handleDrinkPenalty = () => {
    sound.playGulp();
    onComplete(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-purple-500/50 rounded-2xl p-5 shadow-2xl w-full max-w-md text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <div>
              <h3 className="font-extrabold text-purple-400 text-sm">THẬT HAY THÁCH AI (TRUTH OR DARE)</h3>
              <p className="text-xs text-zinc-400">
                Chỉ định cho: <span className="text-amber-300 font-bold">{targetPlayer.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white"
          >
            Đóng
          </button>
        </div>

        {/* Choice buttons if not generated yet */}
        {!hasGenerated ? (
          <div className="space-y-4 my-2">
            <p className="text-xs text-zinc-300 text-center">
              Chọn thể loại thử thách để AI sinh câu hỏi siêu bựa bàn nhậu:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={isLoading}
                onClick={() => generatePrompt('truth')}
                className="py-4 px-3 bg-gradient-to-b from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 rounded-xl font-black text-sm shadow flex flex-col items-center gap-1 active:scale-95 transition-all text-white"
              >
                <span className="text-2xl">🤫</span>
                <span>NÓI THẬT (TRUTH)</span>
                <span className="text-[10px] text-blue-200 font-normal">Khai thật điều bí mật</span>
              </button>

              <button
                disabled={isLoading}
                onClick={() => generatePrompt('dare')}
                className="py-4 px-3 bg-gradient-to-b from-purple-600 to-pink-700 hover:from-purple-500 hover:to-pink-600 rounded-xl font-black text-sm shadow flex flex-col items-center gap-1 active:scale-95 transition-all text-white"
              >
                <span className="text-2xl">🔥</span>
                <span>THÁCH ĐẤU (DARE)</span>
                <span className="text-[10px] text-purple-200 font-normal">Hành động bựa trên bàn</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-purple-950/60 border border-purple-500/40 rounded-xl p-4 text-center">
              <div className="text-[11px] font-bold uppercase tracking-wider text-purple-300 mb-1 flex items-center justify-center gap-1">
                {selectedType === 'truth' ? '🤫 CÂU HỎI SỰ THẬT' : '🔥 THỬ THÁCH BÀN NHẬU'}
              </div>
              <p className="text-sm font-semibold text-white leading-relaxed my-2">
                "{promptText}"
              </p>
            </div>

            <div className="flex gap-2">
              <button
                disabled={isLoading}
                onClick={() => generatePrompt(selectedType)}
                className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-semibold text-zinc-300 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Đổi Thử Thách
              </button>

              <button
                onClick={handlePassChallenge}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn Thành!
              </button>
            </div>

            <button
              onClick={handleDrinkPenalty}
              className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-1.5 shadow active:scale-95"
            >
              <Beer className="w-4 h-4" /> Không Dám Làm? Uống Phạt 1 Ly (+15% cồn)!
            </button>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center justify-center gap-1">
          <AlertCircle className="w-3 h-3" /> Văn hóa vui vẻ, giữ gìn hòa khí bàn nhậu!
        </div>
      </div>
    </div>
  );
};
