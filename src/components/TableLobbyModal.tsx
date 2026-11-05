import React from 'react';
import { Player, PubTheme } from '../game/types';
import { sound } from '../game/audio';
import { Users, Plus, Trash2, MapPin, Copy, Check } from 'lucide-react';

interface TableLobbyModalProps {
  roomId: string;
  theme: PubTheme;
  players: Player[];
  onAddBot: () => void;
  onRemovePlayer: (id: string) => void;
  onChangeTheme: (theme: PubTheme) => void;
  onClose: () => void;
}

export const TableLobbyModal: React.FC<TableLobbyModalProps> = ({
  roomId,
  theme,
  players,
  onAddBot,
  onRemovePlayer,
  onChangeTheme,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  const copyRoomCode = () => {
    sound.playClink();
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const themes: { id: PubTheme; name: string; icon: string; desc: string }[] = [
    {
      id: 'sidewalk',
      name: 'Vỉa Hè Đèn Neon Sài Gòn',
      icon: '🏮',
      desc: 'Bàn inox, ghế nhựa đỏ, đèn dây vàng, xe cá viên chiên thơm nức',
    },
    {
      id: 'bo_ke',
      name: 'Quán Nhậu Bờ Kè Hoàng Hôn',
      icon: '🌊',
      desc: 'Gió sông lồng lộng, ốc hương sốt trứng muối, bia hơi lạnh buốt',
    },
    {
      id: 'rooftop',
      name: 'Bàn Nhậu Rooftop Chill',
      icon: '🌃',
      desc: 'Ngắm Landmark lung linh, nhạc lofi chill, nhậu xuyên màn đêm',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl p-5 shadow-2xl w-full max-w-lg text-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="font-extrabold text-amber-400 text-sm">PHÒNG BÀN NHẬU ONLINE</h3>
              <p className="text-xs text-zinc-400">Quản lý người chơi & không gian quán nhậu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400"
          >
            Đóng
          </button>
        </div>

        {/* Room Code Share */}
        <div className="bg-zinc-800/80 rounded-xl p-3 mb-3 flex items-center justify-between border border-zinc-700">
          <div>
            <div className="text-[10px] text-zinc-400 uppercase font-bold">Mã Bàn Nhậu:</div>
            <div className="text-base font-black font-mono text-amber-300">{roomId}</div>
          </div>
          <button
            onClick={copyRoomCode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Đã Sao Chép Link!' : 'Mời Bạn Bè'}
          </button>
        </div>

        {/* Theme selector */}
        <div className="mb-4">
          <div className="text-xs text-zinc-300 font-bold mb-2 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-amber-400" /> Chọn Không Gian Quán:
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {themes.map((t) => {
              const active = theme === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    sound.playClink();
                    onChangeTheme(t.id);
                  }}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                    active
                      ? 'bg-amber-950/60 border-amber-500'
                      : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  <span className="text-2xl">{t.icon}</span>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-white">{t.name}</div>
                    <div className="text-[11px] text-zinc-400">{t.desc}</div>
                  </div>
                  {active && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Table Seats */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-zinc-300 font-bold">
              Ghế Ngồi Bàn Nhậu ({players.length} / 8 người):
            </div>
            {players.length < 8 && (
              <button
                onClick={() => {
                  sound.playDiceShake();
                  onAddBot();
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold shadow"
              >
                <Plus className="w-3 h-3" /> Thêm Bot Meme
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {players.map((p, idx) => (
              <div
                key={p.id}
                className="p-2 bg-zinc-800/70 rounded-xl border border-zinc-700/80 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {p.avatar === 'dog'
                      ? '🐕'
                      : p.avatar === 'cat'
                      ? '🐱'
                      : p.avatar === 'panda'
                      ? '🐼'
                      : p.avatar === 'bear'
                      ? '🐻'
                      : p.avatar === 'hamster'
                      ? '🐹'
                      : '🦆'}
                  </span>
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      {p.name} {p.isUser && <span className="text-[9px] bg-amber-600 px-1 py-0.2 rounded text-white font-normal">Bạn</span>}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {p.isColaOnlyDestroyer || p.avatar === 'hamster' ? (
                        <span className="text-amber-300 font-semibold">
                          🥤 Chỉ uống Coca (0% Cồn) • 🥢 Đã phá {p.foodEatenCount || 0} phần mồi
                        </span>
                      ) : (
                        <>Độ cồn: {p.alcoholLevel}% • Danh hiệu: {p.title}</>
                      )}
                    </div>
                  </div>
                </div>

                {!p.isUser && (
                  <button
                    onClick={() => {
                      sound.playSlap();
                      onRemovePlayer(p.id);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded-lg"
                    title="Mời rời bàn"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-800 mt-3 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs"
          >
            Quay Lại Bàn Nhậu
          </button>
        </div>
      </div>
    </div>
  );
};
