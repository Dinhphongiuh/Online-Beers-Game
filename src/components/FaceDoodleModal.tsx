import React, { useState } from 'react';
import { Player } from '../game/types';
import { sound } from '../game/audio';
import { Camera, Palette, Check, Sparkles } from 'lucide-react';

interface FaceDoodleModalProps {
  victim: Player;
  onApplyDoodles: (playerId: string, doodles: string[]) => void;
  onClose: () => void;
}

export const FaceDoodleModal: React.FC<FaceDoodleModalProps> = ({
  victim,
  onApplyDoodles,
  onClose,
}) => {
  const [selectedDoodles, setSelectedDoodles] = useState<string[]>(victim.faceDoodles || []);
  const [photoSnapped, setPhotoSnapped] = useState(false);

  const toggleDoodle = (doodleKey: string) => {
    sound.playDiceShake();
    if (selectedDoodles.includes(doodleKey)) {
      setSelectedDoodles(selectedDoodles.filter((d) => d !== doodleKey));
    } else {
      setSelectedDoodles([...selectedDoodles, doodleKey]);
    }
  };

  const handleSave = () => {
    sound.playClink();
    onApplyDoodles(victim.id, selectedDoodles);
    onClose();
  };

  const handleSnapPhoto = () => {
    sound.playBell();
    setPhotoSnapped(true);
    setTimeout(() => setPhotoSnapped(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl p-5 shadow-2xl w-full max-w-sm text-white">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-extrabold text-amber-400 text-sm">VẼ BẬY LÊN MẶT BẠN SAY XỈN</h3>
              <p className="text-xs text-zinc-400">
                Nạn nhân sập nguồn: <span className="text-red-400 font-bold">{victim.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400"
          >
            Đóng
          </button>
        </div>

        {/* Polaroid Preview */}
        <div className="bg-zinc-100 text-zinc-900 p-3 rounded-xl shadow-inner mb-4 flex flex-col items-center">
          <div className="w-full h-36 bg-zinc-800 rounded-lg relative overflow-hidden flex items-center justify-center border border-zinc-300">
            {/* Sleeping face emoji representation */}
            <div className="text-6xl select-none">😴</div>
            {/* Active doodles overlay */}
            {selectedDoodles.includes('mustache') && (
              <div className="absolute text-4xl top-16 select-none">🥸</div>
            )}
            {selectedDoodles.includes('cat_whiskers') && (
              <div className="absolute text-3xl top-10 select-none">🐱</div>
            )}
            {selectedDoodles.includes('spiral_glasses') && (
              <div className="absolute text-4xl top-8 select-none">🥽</div>
            )}

            <div className="absolute bottom-1 right-2 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black">
              100% CỒN - SẬP NGUỒN
            </div>
          </div>
          <div className="text-xs font-mono font-bold mt-2 text-zinc-700">
            📸 #{victim.name} - "Một thời oanh liệt, nay nằm một đống"
          </div>
        </div>

        {/* Doodle choices */}
        <div className="space-y-2 mb-4">
          <div className="text-xs text-zinc-300 font-semibold mb-1">Chọn nét vẽ bằng bút dạ không xóa:</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'mustache', icon: '🥸', name: 'Râu Quăn' },
              { id: 'cat_whiskers', icon: '🐱', name: 'Râu Mèo' },
              { id: 'spiral_glasses', icon: '🌀', name: 'Kính Xoắn' },
            ].map((item) => {
              const active = selectedDoodles.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleDoodle(item.id)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 border transition-all ${
                    active
                      ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                      : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-[10px]">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSnapPhoto}
            className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold text-zinc-200 flex items-center justify-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5 text-blue-400" />
            {photoSnapped ? 'Đã Chụp Tách! 📸' : 'Chụp Ảnh Dìm'}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5 shadow"
          >
            <Check className="w-3.5 h-3.5" /> Lưu Nét Vẽ
          </button>
        </div>
      </div>
    </div>
  );
};
