import React, { useState, useEffect } from 'react';
import { FoodDish, MinigameId, Player } from '../game/types';
import {
  Beer,
  Mic,
  MicOff,
  UtensilsCrossed,
  Bell,
  Gamepad2,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Bath,
  Sparkles,
  Flame,
  Receipt,
  Lock,
} from 'lucide-react';

interface BottomDockProps {
  userPlayer: Player;
  dishes: FoodDish[];
  cupLiquidLevel?: number;
  isMicActive: boolean;
  isFoodModalOpen: boolean;
  isDrinkModalOpen?: boolean;
  isChaosArenaOpen?: boolean;
  hasUrgentArenaEvent?: boolean;
  isSurrenderVoteActive?: boolean;
  surrenderCooldownSeconds?: number;
  isSurrenderConditionMet?: boolean;
  onCheers: () => void;
  onToggleMic: () => void;
  onOpenFoodModal: () => void;
  onOpenDrinkModal: (tab?: 'drinks' | 'tricks' | 'wc') => void;
  onOpenChaosArena: (tab?: 'meme_systems' | 'npcs' | 'events' | 'flow') => void;
  onCallWaiter: () => void;
  onGoToToilet: () => void;
  onSelectMinigame: (minigame: MinigameId) => void;
  onOpenShop: () => void;
  onTriggerSurrenderBillVote: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  userPlayer,
  dishes,
  cupLiquidLevel = 100,
  isMicActive,
  isFoodModalOpen,
  isDrinkModalOpen = false,
  isChaosArenaOpen = false,
  hasUrgentArenaEvent = false,
  isSurrenderVoteActive = false,
  surrenderCooldownSeconds = 0,
  isSurrenderConditionMet = true,
  onCheers,
  onToggleMic,
  onOpenFoodModal,
  onOpenDrinkModal,
  onOpenChaosArena,
  onCallWaiter,
  onSelectMinigame,
  onOpenShop,
  onTriggerSurrenderBillVote,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showGameMenu, setShowGameMenu] = useState(false);

  const totalServingsLeft = dishes.reduce((sum, d) => sum + d.servings, 0);
  const hasLastPieceAlert = dishes.some((d) => d.servings === 1);
  const bladder = userPlayer.bladderLevel || 0;

  // Keyboard shortcut 'H' to toggle dock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[min(1040px,97vw)] w-full pointer-events-none">
      {/* Minigame Selector Menu */}
      {showGameMenu && !isCollapsed && (
        <div className="mb-2 bg-zinc-900/95 border border-purple-500/40 rounded-2xl p-3 shadow-2xl w-full max-w-lg pointer-events-auto text-white">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2">
            <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
              <Gamepad2 className="w-3.5 h-3.5" /> TRÒ CHƠI DÂN NHẬU TRÊN BÀN (MINIGAMES)
            </span>
            <button
              onClick={() => setShowGameMenu(false)}
              className="text-xs text-zinc-400 hover:text-white px-2 py-0.5 rounded"
            >
              Đóng
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'crocodile' as MinigameId, icon: '🐊', name: 'Bốc Răng Cá Sấu', desc: 'Bấm răng roulette' },
              { id: 'spin_bottle' as MinigameId, icon: '🍾', name: 'Xoay Chai Bia', desc: 'Chỉ định người uống' },
              { id: 'liars_dice' as MinigameId, icon: '🎲', name: 'Lắc Xí Ngầu', desc: 'Đoán mặt nói dối' },
              { id: 'fifteen_twenty' as MinigameId, icon: '🖐️', name: '15 - 20 Hô Số', desc: 'Oẳn tù tì xòe tay' },
              { id: 'truth_or_dare' as MinigameId, icon: '✨', name: 'Thật hay Thách AI', desc: 'Thử thách bựa' },
              { id: 'bill_fight' as MinigameId, icon: '🧾', name: 'Giằng Hóa Đơn', desc: 'Đùn đẩy ai bao chầu' },
            ].map((game) => (
              <button
                key={game.id}
                onClick={() => {
                  onSelectMinigame(game.id);
                  setShowGameMenu(false);
                }}
                className="p-2.5 bg-zinc-800/80 hover:bg-purple-950/40 hover:border-purple-500/60 border border-zinc-700 rounded-xl flex flex-col items-center text-center transition-all active:scale-95"
              >
                <span className="text-2xl mb-1">{game.icon}</span>
                <span className="text-xs font-bold text-white">{game.name}</span>
                <span className="text-[10px] text-zinc-400">{game.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Collapse / Expand Toggle Tab */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="pointer-events-auto mb-1 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 px-3 py-0.5 rounded-full text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 shadow-md transition-all"
      >
        {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        <span>{isCollapsed ? 'Mở Bảng Điều Khiển [H]' : 'Thu Gọn [H]'}</span>
      </button>

      {/* Main Unified Control Dock */}
      {!isCollapsed && (
        <div className="pointer-events-auto bg-zinc-950/95 border border-zinc-800 rounded-2xl p-2 shadow-2xl flex items-center gap-1.5 md:gap-2 w-full justify-between overflow-x-auto">
          {/* Big Hero Cheers Button */}
          <button
            onClick={onCheers}
            className="flex-1 min-w-[135px] md:min-w-[165px] py-2.5 px-3 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 rounded-xl text-zinc-950 font-black text-xs md:text-sm shadow-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Beer className="w-4 h-4 fill-current shrink-0" />
            <span>1, 2, 3 DZÔ!</span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-950/20 text-zinc-950">
              {cupLiquidLevel}%
            </span>
          </button>

          {/* Quán Tư Đực & 6 Hệ Thống Meme Button */}
          <button
            onClick={() => {
              setShowGameMenu(false);
              onOpenChaosArena('meme_systems');
            }}
            className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 ${
              hasUrgentArenaEvent
                ? 'bg-rose-600/35 border-rose-400 text-rose-200 animate-pulse'
                : isChaosArenaOpen
                ? 'bg-amber-600/30 border-amber-400 text-amber-300'
                : 'bg-zinc-900 border-rose-500/40 text-rose-300 hover:bg-zinc-800'
            }`}
            title="Cỗ Máy Meme Bàn Nhậu & Quán Tư Đực: Nói Xàm, Gọi NYC, Điện Thoại Nóc Nhà, 5 Hệ Khi Say, Nhúng Bò 5s & Tăng 2 Karaoke"
          >
            <Flame className="w-4 h-4 text-rose-400" />
            <span>Meme & Quán Tư Đực</span>
          </button>

          {/* Rót Bia, Xô Đá & Độc Chiêu Button */}
          <button
            onClick={() => {
              setShowGameMenu(false);
              onOpenDrinkModal('drinks');
            }}
            className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 ${
              isDrinkModalOpen
                ? 'bg-amber-600/30 border-amber-400 text-amber-300'
                : 'bg-zinc-900 border-amber-500/40 text-amber-300 hover:bg-zinc-800'
            }`}
            title="Phân loại Bia/Rượu, Rót bọt, Xô đá Inox & Độc chiêu bàn nhậu"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Rót Bia & Đá</span>
          </button>

          {/* Mic Cheers Toggle */}
          <button
            onClick={onToggleMic}
            className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0 ${
              isMicActive
                ? 'bg-red-600/30 border-red-500 text-red-300'
                : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Hô Dzô vào Mic thật để tự động cụng ly"
          >
            {isMicActive ? <Mic className="w-4 h-4 text-red-400" /> : <MicOff className="w-4 h-4 text-zinc-400" />}
            <span className="hidden sm:inline">{isMicActive ? 'Mic: BẬT' : 'Mic Dzô'}</span>
          </button>

          {/* Gắp Mồi & Đấu Đũa Button */}
          <button
            onClick={() => {
              setShowGameMenu(false);
              onOpenFoodModal();
            }}
            className={`relative py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 ${
              isFoodModalOpen
                ? 'bg-amber-600/30 border-amber-400 text-amber-300'
                : hasLastPieceAlert
                ? 'bg-red-950/70 border-red-500/70 text-amber-300'
                : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 text-amber-400" />
            <span>Gắp Mồi</span>
            <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-md border border-amber-500/30">
              {totalServingsLeft}
            </span>
          </button>

          {/* Đi Vệ Sinh (Drama WC 1 Buồng & Bụng Bia) */}
          <button
            onClick={() => {
              setShowGameMenu(false);
              onOpenDrinkModal('wc');
            }}
            className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 ${
              bladder >= 80
                ? 'bg-red-950/80 border-red-500 text-red-300 animate-pulse'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-cyan-300'
            }`}
            title="Drama Nhà Vệ Sinh 1 Buồng & Thanh Bụng Bia"
          >
            <Bath className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">WC</span>
            <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-200 px-1.5 py-0.2 rounded border border-cyan-500/30">
              {bladder}%
            </span>
          </button>

          {/* Chọn Minigame */}
          <button
            onClick={() => {
              setShowGameMenu(!showGameMenu);
            }}
            className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0 ${
              showGameMenu
                ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Gamepad2 className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline">Minigame</span>
          </button>

          {/* Tiệm Tạp Hóa Cô Ba */}
          <button
            onClick={onOpenShop}
            className="py-2 px-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-300 flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Tạp Hóa</span>
          </button>

          {/* [🧾 GỌI TÍNH TIỀN] ("Em Ơi Tính Tiền!" Surrender Vote Trigger) */}
          <button
            data-testid="call-bill-surrender-btn"
            onClick={() => {
              setShowGameMenu(false);
              onTriggerSurrenderBillVote();
            }}
            className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 ${
              surrenderCooldownSeconds > 0
                ? 'bg-red-950/90 border-red-500/80 text-red-300'
                : isSurrenderVoteActive
                ? 'bg-rose-600 text-white border-rose-300 animate-pulse'
                : isSurrenderConditionMet
                ? 'bg-rose-500/20 hover:bg-rose-500/35 border-rose-400 text-rose-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-300'
            }`}
            title={
              surrenderCooldownSeconds > 0
                ? `Bàn đang sung, cấm bàn lùi! (Khóa ${surrenderCooldownSeconds}s)`
                : 'Em Ơi Tính Tiền! (Surrender Vote kiểu Bàn Nhậu - Gõ /tinhtien hoặc bấm nút)'
            }
          >
            {surrenderCooldownSeconds > 0 ? (
              <>
                <Lock className="w-3.5 h-3.5 text-red-400" />
                <span>Cấm Bàn Lùi ({surrenderCooldownSeconds}s)</span>
              </>
            ) : (
              <>
                <Receipt className="w-4 h-4 text-rose-400" />
                <span>🧾 GỌI TÍNH TIỀN</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};


