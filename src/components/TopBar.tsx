import React from 'react';
import { Player, TableState } from '../game/types';
import { Volume2, VolumeX, Users, Flame, Zap, Droplets, Database } from 'lucide-react';

interface TopBarProps {
  userPlayer: Player;
  tableState: TableState;
  isBgmActive: boolean;
  onToggleBgm: () => void;
  onOpenLobby: () => void;
  onOpenShop: () => void;
  onOpenDrinkModal?: () => void;
  onOpenAuth?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  userPlayer,
  tableState,
  isBgmActive,
  onToggleBgm,
  onOpenLobby,
  onOpenShop,
  onOpenDrinkModal,
  onOpenAuth,
}) => {
  const alcohol = userPlayer.alcoholLevel;
  const stamina = userPlayer.stamina;
  const bladder = userPlayer.bladderLevel || 0;

  const getDrunkStatus = () => {
    if (userPlayer.isStunned) return { label: 'CHOÁNG TÀU NGẦM 💫', color: 'bg-purple-600 text-white animate-pulse' };
    if (userPlayer.isSpicedMouth) return { label: 'BỎNG MỎ 10S 🌶️', color: 'bg-red-600 text-white animate-bounce' };
    if (userPlayer.isBreathingFire) return { label: 'RƯỢU ĐẾ KHÈ LỬA 🔥', color: 'bg-orange-600 text-white' };
    if (alcohol >= 100) return { label: 'SẬP NGUỒN 😴', color: 'bg-red-600 text-white' };
    if (alcohol >= 71) return { label: 'QUẮC CẦN CÂU 🥴', color: 'bg-amber-600 text-white' };
    if (alcohol >= 31) return { label: 'NGÀ NGÀ SAY 😏', color: 'bg-yellow-500 text-zinc-950 font-bold' };
    return { label: 'TỈNH TÁO 😎', color: 'bg-emerald-600 text-white' };
  };

  const status = getDrunkStatus();

  return (
    <header className="absolute top-0 left-0 right-0 z-20 px-3 py-2 flex items-center justify-between pointer-events-none">
      {/* Top Left: Game Title & Room Status */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="bg-zinc-900/90 border border-amber-500/40 rounded-xl px-3 py-1.5 shadow-lg backdrop-blur-md flex items-center gap-2">
          <span className="text-xl">🍻</span>
          <div className="hidden sm:block">
            <div className="text-xs font-black tracking-wide text-amber-400 flex items-center gap-1.5">
              TRẠM NHẬU ONLINE
              <span className="text-[10px] bg-red-600/80 text-white font-bold px-1.5 py-0.2 rounded">
                BỜ KÈ
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 flex items-center gap-1">
              <span>{tableState.themeName}</span> •
              <span className="text-amber-300 font-semibold">{tableState.toastCount} Lần Dzô</span>
            </div>
          </div>
        </div>

        {/* Players count badge */}
        <button
          onClick={onOpenLobby}
          className="bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 flex items-center gap-1.5 shadow-lg transition-all active:scale-95"
        >
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-bold">{tableState.players.length}/8</span>
        </button>

        {/* MongoDB & Redis Backend Status Shortcut */}
        <button
          onClick={onOpenLobby}
          title="Trạng thái MongoDB & Redis Cache (Nhấn để xem Bảng Vàng & Đồng Bộ)"
          className="bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-500/40 rounded-xl px-2.5 py-1.5 text-xs text-emerald-400 flex items-center gap-1.5 shadow-lg transition-all active:scale-95"
        >
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] font-mono font-bold text-zinc-300 hidden sm:inline">DB/Redis</span>
        </button>

        {/* Cổng Quán / Hộ Chiếu Auth Shortcut */}
        {onOpenAuth && (
          <button
            onClick={onOpenAuth}
            title="Cổng Quán: Đăng Nhập / Đăng Ký / Hộ Chiếu Tửu Lượng & MongoDB"
            className="bg-zinc-900/90 hover:bg-zinc-800 border border-amber-500/40 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 flex items-center gap-1.5 shadow-lg transition-all active:scale-95"
          >
            <span className="text-sm">🪪</span>
            <span className="text-[10px] font-bold text-amber-200 hidden sm:inline">Hộ Chiếu</span>
          </button>
        )}
      </div>

      {/* Top Center: Drunk Meter, Stamina & Bladder (Bụng Bia) Gauges */}
      <div className="hidden md:flex items-center gap-3 pointer-events-auto bg-zinc-900/90 border border-zinc-800 rounded-2xl px-4 py-2 shadow-lg backdrop-blur-md">
        {/* Alcohol Meter */}
        <div className="flex flex-col gap-1 w-32">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400 flex items-center gap-1">
              <Flame className="w-3 h-3 text-red-500" /> Độ Cồn:
            </span>
            <span className="font-mono font-bold text-amber-400">{alcohol}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
            <div
              className={`h-full transition-all duration-300 ${
                alcohol > 70 ? 'bg-gradient-to-r from-yellow-500 to-red-600' : 'bg-gradient-to-r from-emerald-500 to-yellow-500'
              }`}
              style={{ width: `${Math.min(alcohol, 100)}%` }}
            />
          </div>
        </div>

        {/* Status Pill */}
        <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${status.color}`}>
          {status.label}
        </div>

        {/* Stamina Meter */}
        <div className="flex flex-col gap-1 w-28">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-cyan-400" /> Tỉnh Táo:
            </span>
            <span className="font-mono font-bold text-cyan-300">{stamina}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${Math.min(stamina, 100)}%` }}
            />
          </div>
        </div>

        {/* Bladder / Belly Meter (Bụng Bia & Mắc Tiểu) */}
        <button
          onClick={onOpenDrinkModal}
          className="flex flex-col gap-1 w-32 text-left hover:opacity-90 transition-opacity"
          title="Thanh Độ No / Bụng Bia & Mắc Tiểu (100% = Phình bụng căng tròn phải chạy đi WC!)"
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400 flex items-center gap-1">
              <Droplets className="w-3 h-3 text-amber-400" /> Bụng Bia:
            </span>
            <span
              className={`font-mono font-bold ${
                bladder >= 80 ? 'text-red-400 animate-pulse' : 'text-amber-300'
              }`}
            >
              {bladder}%
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
            <div
              className={`h-full transition-all duration-300 ${
                bladder >= 80
                  ? 'bg-gradient-to-r from-amber-500 to-red-600'
                  : 'bg-gradient-to-r from-amber-400 to-yellow-500'
              }`}
              style={{ width: `${Math.min(bladder, 100)}%` }}
            />
          </div>
        </button>
      </div>

      {/* Mobile: compact meters (the full gauges above are desktop-only) */}
      <button
        onClick={onOpenDrinkModal}
        className="flex md:hidden items-center gap-1.5 whitespace-nowrap pointer-events-auto bg-zinc-900/90 border border-zinc-800 rounded-xl px-2 py-1.5 shadow-lg text-[11px] font-mono font-bold"
        title="Độ Cồn • Tỉnh Táo • Bụng Bia"
      >
        <span className={alcohol > 70 ? 'text-red-400' : 'text-amber-400'}>🍺{alcohol}%</span>
        <span className="text-cyan-300">⚡{stamina}%</span>
        <span className={bladder >= 80 ? 'text-red-400 animate-pulse' : 'text-amber-300'}>💧{bladder}%</span>
      </button>

      {/* Top Right: Currency & BGM Toggle */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          onClick={onOpenShop}
          className="bg-zinc-900/90 hover:bg-zinc-800 border border-amber-500/30 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 shadow-lg"
        >
          <span className="text-xs">🪙</span>
          <span className="text-xs font-bold text-amber-300">
            {userPlayer.coins}
            <span className="hidden sm:inline"> Nắp</span>
          </span>
        </button>

        <button
          onClick={onToggleBgm}
          className={`p-2 rounded-xl border transition-all ${
            isBgmActive
              ? 'bg-amber-600/30 border-amber-500 text-amber-300'
              : 'bg-zinc-900/90 border-zinc-700 text-zinc-400 hover:text-white'
          }`}
          title={isBgmActive ? 'Tắt nhạc acoustic' : 'Bật nhạc acoustic vỉa hè'}
        >
          {isBgmActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};

