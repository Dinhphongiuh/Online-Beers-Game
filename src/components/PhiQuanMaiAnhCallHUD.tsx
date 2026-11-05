import React, { useEffect, useState } from 'react';
import { Player } from '../game/types';
import { sound } from '../game/audio';
import {
  PhoneCall,
  HeartCrack,
  UtensilsCrossed,
  Soup,
  Volume2,
  Snowflake,
  Sparkles,
  Trees,
  HeartHandshake,
} from 'lucide-react';

export type StopPhiQuanAction =
  | 'stuff_chicken_foot'
  | 'toss_phone_hotpot'
  | 'fake_girl_voice'
  | 'dump_ice_bucket'
  | 'comfort_nho_em_ne';

export type KhoaTreeAction =
  | 'shake_tree'
  | 'honey_chicken_lure'
  | 'fire_ants_scare'
  | 'feather_duster';

export const PHI_QUAN_MAI_ANH_DIALOGUES: {
  phiQuanLine: string;
  maiAnhLine: string;
}[] = [
  {
    phiQuanLine:
      '🐼💬 Phi Quân: "Alo Mai Anh à... ực... Anh Quân Gấu Trúc đây! Em ngủ chưa hay đang đi uống trà sữa ít đường với thằng nào?!"',
    maiAnhLine:
      '📱💔 Mai Anh (NYC): "Ủa 12 giờ đêm rồi gọi cái gì nữa vậy Phi Quân?! Anh lại đi nhậu say quắc cần câu rồi phải không?!"',
  },
  {
    phiQuanLine:
      '🐼💬 Phi Quân: "Mai Anh ơi anh đâu có say! Anh mới uống có 2 két với Khoa Nguyễn và Bảo Nguyễn thôi... mà nhìn miếng chân gà nướng anh lại nhớ đôi môi em!"',
    maiAnhLine:
      '📱💔 Mai Anh (NYC): "Trời đất ơi chia tay 8 tháng rồi mà nhìn chân gà sả tắc nhớ môi tôi là sao hả cái đồ Gấu Trúc kia?!"',
  },
  {
    phiQuanLine:
      '🐼💬 Phi Quân: "Mai Anh trả lại cho anh chiếc dép tổ ong màu hường kỷ niệm 2 tuần yêu nhau đi... ực... không trả là anh khóc ngập quán Tư Đực bây giờ!"',
    maiAnhLine:
      '📱💔 Mai Anh (NYC): "Đôi dép tổ ong 15 ngàn đứt quai tôi vứt sọt rác lâu rồi! Bàn đó không có ai giật điện thoại của ổng giùm tôi hả trời?!"',
  },
  {
    phiQuanLine:
      '🐼💬 Phi Quân: "Đừng cúp máy mà Mai Anh!! Nghe anh hát Đắp Mộ Cuộc Tình bằng giọng Gấu Trúc nè: Cuộc tình dĩ vãng đã trôi đi vào quên lãng... ợ... hu hu!"',
    maiAnhLine:
      '📱💔 Mai Anh (NYC): "Thôi đủ rồi nhé! 3 giây nữa không tắt máy là tôi BLOCK sạch Zalo, Facebook, số điện thoại luôn đây!"',
  },
];

export const KHOA_NGUYEN_TREE_DIALOGUES: string[] = [
  '🐻🌳 Khoa Nguyễn (Đang ôm ngọn cây): "Ở dưới đất nóng nực quá anh em ơi! Bản năng Gấu Nâu trỗi dậy rồi, tao leo lên ngọn cây bàng hóng gió bờ kè với hái tổ ong mật đây!"',
  '🐻🌳 Khoa Nguyễn (Đu cành cây): "Đứa nào tính tiền xong nhớ hú tao mới tụt xuống nha! Trên ngọn cây xanh này mát rượi, nhìn xuống thấy ly bia của tụi bây bé tí!"',
  '🐻🌳 Khoa Nguyễn (Vẫy tay từ trên cây): "Ê Bảo Nguyễn, Phi Quân! Đừng có rung cây nha mày, tao đang tập làm Tarzan phiên bản Gấu Nâu 80% độ cồn đây!"',
];

interface PhiQuanMaiAnhCallHUDProps {
  phiQuanPlayer: Player | undefined;
  countdown: number; // 12s down to 0
  stopProgress: number; // 0 to 100%
  lastStopLog: string | null;
  onForcePhiQuan80Percent: () => void;
  onStopPhiQuanAction: (action: StopPhiQuanAction) => void;
  onComfortHeartbrokenPhiQuan: () => void;
  // Khoa Nguyễn >= 80% Alcohol Tree-Climbing props
  khoaNguyenPlayer: Player | undefined;
  onForceKhoaNguyen80Percent: () => void;
  onGetKhoaDownFromTree: (action: KhoaTreeAction) => void;
  // Nga Phan (Chuột Hamster Đuôi Dài - Chỉ uống Coca 0% cồn & Phá mồi)
  ngaPhanPlayer?: Player;
  onTriggerNgaPhanDestroyFood?: () => void;
}

export const PhiQuanMaiAnhCallHUD: React.FC<PhiQuanMaiAnhCallHUDProps> = ({
  phiQuanPlayer,
  countdown,
  stopProgress,
  lastStopLog,
  onForcePhiQuan80Percent,
  onStopPhiQuanAction,
  onComfortHeartbrokenPhiQuan,
  khoaNguyenPlayer,
  onForceKhoaNguyen80Percent,
  onGetKhoaDownFromTree,
  ngaPhanPlayer,
  onTriggerNgaPhanDestroyFood,
}) => {
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [treeLineIndex, setTreeLineIndex] = useState(0);

  const isCalling = !!phiQuanPlayer?.isCallingMaiAnh;
  const isHeartbroken = !!phiQuanPlayer?.isHeartbrokenMaiAnh;
  const alc = Math.round(phiQuanPlayer?.alcoholLevel || 0);

  const isKhoaClimbing = !!khoaNguyenPlayer?.isClimbingTree;
  const khoaAlc = Math.round(khoaNguyenPlayer?.alcoholLevel || 0);

  // Cycle Phi Quân's hilarious drunk dialogue lines & play gibberish voice blips while calling Mai Anh
  useEffect(() => {
    if (!isCalling) {
      setDialogueIndex(0);
      return;
    }

    const idx = Math.min(
      PHI_QUAN_MAI_ANH_DIALOGUES.length - 1,
      Math.floor((12 - countdown) / 3)
    );
    setDialogueIndex(Math.max(0, idx));

    // Play a short drunken panda voice blip
    const blipTimer = setInterval(() => {
      sound.playAnimaleseBlip(65 + Math.floor(Math.random() * 25), 85);
    }, 260);

    return () => clearInterval(blipTimer);
  }, [isCalling, countdown]);

  // Cycle Khoa Nguyễn's tree-climbing lines when perched on the tree
  useEffect(() => {
    if (!isKhoaClimbing) {
      setTreeLineIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setTreeLineIndex((prev) => (prev + 1) % KHOA_NGUYEN_TREE_DIALOGUES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [isKhoaClimbing]);

  if (!phiQuanPlayer) return null;

  const currentDialogue =
    PHI_QUAN_MAI_ANH_DIALOGUES[dialogueIndex] || PHI_QUAN_MAI_ANH_DIALOGUES[0];

  return (
    <>
      {/* 1. Compact Floating Status Pills for NPC Phi Quân, NPC Khoa Nguyễn & NPC Nga Phan (Top-Right below TopBar) */}
      <div className="fixed top-14 right-3 z-20 pointer-events-auto flex flex-col items-end gap-1.5">
        {!isCalling && !isHeartbroken && (
          <div className="flex items-center gap-2 bg-zinc-900/92 border border-pink-500/50 rounded-2xl px-3 py-1.5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🐼</span>
              <div>
                <div className="text-[11px] font-black text-white flex items-center gap-1">
                  <span>Phi Quân</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                      alc >= 80
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    🍺 {alc}% / 80%
                  </span>
                </div>
                <div className="text-[9px] text-pink-300 font-semibold">
                  Đủ 80% cồn sẽ tự rút máy gọi NYC Mai Anh 💔
                </div>
              </div>
            </div>

            <button
              onClick={onForcePhiQuan80Percent}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-[10px] font-black shadow-lg flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
              title="Cho Phi Quân uống chạm mốc 80% cồn để rút máy gọi NYC Mai Anh ngay!"
            >
              <PhoneCall className="w-3 h-3 animate-bounce" />
              <span>Ép Lên 80% (Gọi Mai Anh)</span>
            </button>

            <button
              onClick={onComfortHeartbrokenPhiQuan}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white text-[10px] font-black shadow-lg flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
              title='Vỗ vai Phi Quân an ủi: "Đừng nhớ Mai Anh nữa nhớ em nè"'
            >
              <HeartHandshake className="w-3 h-3" />
              <span>Vỗ Vai An Ủi</span>
            </button>
          </div>
        )}

        {/* Compact Status Pill for NPC Khoa Nguyễn (Gấu Nâu >= 80% leo cây xanh) */}
        {khoaNguyenPlayer && !isKhoaClimbing && (
          <div className="flex items-center gap-2 bg-zinc-900/92 border border-emerald-500/50 rounded-2xl px-3 py-1.5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🐻</span>
              <div>
                <div className="text-[11px] font-black text-white flex items-center gap-1">
                  <span>{khoaNguyenPlayer.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                      khoaAlc >= 80
                        ? 'bg-emerald-600 text-white animate-pulse'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    🍺 {khoaAlc}% / 80%
                  </span>
                </div>
                <div className="text-[9px] text-emerald-300 font-semibold">
                  Đủ 80% cồn sẽ tự rời ghế đi ra leo Cây Xanh 🌳
                </div>
              </div>
            </div>

            <button
              onClick={onForceKhoaNguyen80Percent}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-[10px] font-black shadow-lg flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
              title="Cho Khoa Nguyễn uống chạm mốc 80% cồn để tự đi ra leo lên cây xanh bên cạnh bàn!"
            >
              <Trees className="w-3 h-3 animate-bounce" />
              <span>Ép Lên 80% (Ra Leo Cây)</span>
            </button>
          </div>
        )}

        {/* Compact Status Pill for NPC Nga Phan (Chuột Hamster Đuôi Dài - Chỉ uống Coca 0% Cồn & Phá Mồi) */}
        {ngaPhanPlayer && (
          <div className="flex items-center gap-2 bg-zinc-900/92 border border-amber-500/60 rounded-2xl px-3 py-1.5 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🐹</span>
              <div>
                <div className="text-[11px] font-black text-white flex items-center gap-1">
                  <span>{ngaPhanPlayer.name}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-red-600/30 text-amber-200 border border-amber-400/50">
                    🥤 COCA 0% CỒN
                  </span>
                </div>
                <div className="text-[9px] text-amber-300 font-semibold">
                  Hamster đuôi dài chỉ uống Coca & phá mồi (Đã càn quét {ngaPhanPlayer.foodEatenCount || 0} phần)
                </div>
              </div>
            </div>

            {onTriggerNgaPhanDestroyFood && (
              <button
                onClick={onTriggerNgaPhanDestroyFood}
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-[10px] font-black shadow-lg flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                title="Cho Nga Phan hút rột rột ly Coca đá và phóng đũa gắp sạch mồi trên bàn (vẫn 0% cồn)!"
              >
                <UtensilsCrossed className="w-3 h-3" />
                <span>Uống Coca & Phá Mồi</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. ACTIVE QTE OVERLAY: PHI QUÂN >= 80% ALCOHOL CALLING NYC MAI ANH! */}
      {isCalling && (
        <div className="fixed top-16 right-3 z-40 w-[375px] max-w-[94vw] pointer-events-auto animate-in fade-in slide-in-from-right-5 duration-200">
          <div className="bg-zinc-950/95 border-2 border-rose-500 rounded-3xl p-3.5 shadow-[0_0_40px_rgba(244,63,94,0.45)] text-white">
            {/* Header Alert */}
            <div className="flex items-center justify-between gap-2 border-b border-rose-500/30 pb-2.5 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-rose-600 flex items-center justify-center text-xl shadow-lg animate-bounce">
                  🐼📱
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                      BÁO ĐỘNG {alc}% CỒN!
                    </span>
                    <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                      CÒN {countdown}s
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-white">
                    Phi Quân Đang Gọi NYC: MAI ANH 💕💔
                  </h4>
                </div>
              </div>
            </div>

            {/* Live Hilarious Dialogue Box between Phi Quân & Mai Anh */}
            <div className="bg-zinc-900/95 border border-pink-500/40 rounded-2xl p-2.5 mb-2.5 space-y-1.5">
              <div className="text-xs font-bold text-amber-200 leading-snug">
                {currentDialogue.phiQuanLine}
              </div>
              <div className="text-[11px] font-semibold text-pink-300 bg-rose-950/60 border border-rose-500/30 rounded-xl px-2.5 py-1.5 leading-snug">
                {currentDialogue.maiAnhLine}
              </div>
            </div>

            {/* Stop Phi Quân Progress Bar */}
            <div className="mb-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span className="text-emerald-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Tiến độ cản Phi Quân:
                </span>
                <span className="font-mono font-black text-emerald-400">
                  {stopProgress}% / 100%
                </span>
              </div>
              <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-200"
                  style={{ width: `${Math.min(100, stopProgress)}%` }}
                />
              </div>
              {lastStopLog && (
                <div className="mt-1 text-[10px] font-bold text-amber-300 truncate">
                  ⚡ {lastStopLog}
                </div>
              )}
            </div>

            {/* Featured Comfort Button: Vỗ vai nói "Đừng nhớ Mai Anh nữa nhớ em nè" */}
            <button
              onClick={() => onStopPhiQuanAction('comfort_nho_em_ne')}
              className="w-full mb-2 p-2.5 rounded-2xl bg-gradient-to-r from-pink-600 via-fuchsia-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 border border-pink-300/60 text-left shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs font-black text-white">
                <span className="flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 animate-bounce" />
                  🍻 Vỗ Vai An Ủi Phi Quân Ngay
                </span>
                <span className="text-[10px] bg-white text-pink-700 px-2 py-0.5 rounded-full font-black">
                  +100% TẮT MÁY LUÔN
                </span>
              </div>
              <div className="text-[11px] font-bold text-pink-100 mt-0.5">
                💬 Nói: "Đừng nhớ Mai Anh nữa nhớ em nè!" ❤️
              </div>
            </button>

            {/* 4 Interactive Ways to Stop Phi Quân */}
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
              Hoặc dùng chiêu vật lý cản Phi Quân:
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onStopPhiQuanAction('stuff_chicken_foot')}
                className="p-2 rounded-xl bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/60 text-left transition-all active:scale-95 cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-black text-amber-300">
                  <span className="flex items-center gap-1">
                    <UtensilsCrossed className="w-3.5 h-3.5" /> Nhét Chân Gà
                  </span>
                  <span className="text-[10px] bg-amber-500 text-zinc-950 px-1.5 rounded font-black">
                    +35%
                  </span>
                </div>
                <div className="text-[10px] text-zinc-300 mt-0.5">
                  Nhét chân gà sả tắc khóa mõm Gấu Trúc!
                </div>
              </button>

              <button
                onClick={() => onStopPhiQuanAction('toss_phone_hotpot')}
                className="p-2 rounded-xl bg-rose-600/25 hover:bg-rose-600/40 border border-rose-500/60 text-left transition-all active:scale-95 cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-black text-rose-300">
                  <span className="flex items-center gap-1">
                    <Soup className="w-3.5 h-3.5" /> Ném Vào Lẩu
                  </span>
                  <span className="text-[10px] bg-rose-500 text-white px-1.5 rounded font-black">
                    +40%
                  </span>
                </div>
                <div className="text-[10px] text-zinc-300 mt-0.5">
                  Giật máy ném thẳng vào nồi Lẩu Thái!
                </div>
              </button>

              <button
                onClick={() => onStopPhiQuanAction('fake_girl_voice')}
                className="p-2 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/60 text-left transition-all active:scale-95 cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-black text-purple-300">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" /> Giả Giọng Gái
                  </span>
                  <span className="text-[10px] bg-purple-500 text-white px-1.5 rounded font-black">
                    +35%
                  </span>
                </div>
                <div className="text-[10px] text-zinc-300 mt-0.5">
                  Hét: "Anh Quân ơi vào tắm đi anh!"
                </div>
              </button>

              <button
                onClick={() => onStopPhiQuanAction('dump_ice_bucket')}
                className="p-2 rounded-xl bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-500/60 text-left transition-all active:scale-95 cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-black text-cyan-300">
                  <span className="flex items-center gap-1">
                    <Snowflake className="w-3.5 h-3.5" /> Úp Xô Đá Lạnh
                  </span>
                  <span className="text-[10px] bg-cyan-400 text-zinc-950 px-1.5 rounded font-black">
                    +50%
                  </span>
                </div>
                <div className="text-[10px] text-zinc-300 mt-0.5">
                  Đổ cả xô đá lên đầu cho rớt điện thoại!
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. AFTERMATH BANNER IF PLAYER FAILED TO STOP PHI QUÂN */}
      {isHeartbroken && !isCalling && (
        <div className="fixed top-16 right-3 z-30 w-[370px] max-w-[92vw] pointer-events-auto bg-zinc-950/95 border-2 border-pink-500/80 rounded-2xl p-3 shadow-2xl text-white">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-pink-400">
              <HeartCrack className="w-4 h-4 text-rose-500 animate-bounce" />
              <span>🐼💔 PHI QUÂN BỊ MAI ANH BLOCK!</span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-300 leading-snug mb-2.5">
            📱💬 <b className="text-rose-300">Mai Anh:</b> "Đồ Gấu Trúc nát rượu! Nửa đêm gọi đòi dép tổ ong màu hường hả?! TÔI BLOCK ANH LUÔN ĐÂY!"
          </p>
          <button
            onClick={onComfortHeartbrokenPhiQuan}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-pink-600 via-fuchsia-600 to-emerald-600 hover:from-pink-500 hover:to-emerald-500 text-white text-xs font-black cursor-pointer shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <HeartHandshake className="w-4 h-4 animate-bounce" />
            <span>🍻 Vỗ Vai: "Đừng nhớ Mai Anh nữa nhớ em nè"</span>
          </button>
        </div>
      )}

      {/* 4. ACTIVE OVERLAY: KHOA NGUYỄN >= 80% ALCOHOL CLIMBING THE GREEN TREE! */}
      {isKhoaClimbing && (
        <div className="fixed bottom-24 left-3 z-30 w-[355px] max-w-[92vw] pointer-events-auto animate-in fade-in slide-in-from-left-5 duration-200">
          <div className="bg-zinc-950/95 border-2 border-emerald-500 rounded-3xl p-3.5 shadow-[0_0_35px_rgba(16,185,129,0.4)] text-white">
            <div className="flex items-center justify-between gap-2 border-b border-emerald-500/30 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-emerald-600 flex items-center justify-center text-xl shadow-lg animate-bounce">
                  🐻🌳
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                      ĐỘ CỒN {khoaAlc}% — BẢN NĂNG GẤU TRỖI DẬY!
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-white">
                    Khoa Nguyễn Đã Leo Lên Cây Xanh Bờ Kè!
                  </h4>
                </div>
              </div>
            </div>

            <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-2xl p-2.5 mb-2.5 text-xs font-bold text-emerald-100 leading-snug">
              {KHOA_NGUYEN_TREE_DIALOGUES[treeLineIndex]}
            </div>

            <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1.5">
              Cách gọi Khoa Nguyễn tụt xuống về lại bàn nhậu:
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onGetKhoaDownFromTree('shake_tree')}
                className="p-2 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/60 text-left transition-all active:scale-95 cursor-pointer"
              >
                <div className="text-xs font-black text-emerald-300">
                  📳 Rung Cây Bần Bật
                </div>
                <div className="text-[10px] text-zinc-300 mt-0.5">
                  Rung rụng lá cây cho Gấu rớt xuống ghế!
                </div>
              </button>

              <button
                onClick={() => onGetKhoaDownFromTree('honey_chicken_lure')}
                className="p-2 rounded-xl bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/60 text-left transition-all active:scale-95 cursor-pointer"
              >
                <div className="text-xs font-black text-amber-300">
                  🍯 Dụ Chân Gà Mật Ong
                </div>
                <div className="text-[10px] text-zinc-300 mt-0.5">
                  Ngửi mùi mật ong là tụt xuống liền!
                </div>
              </button>

              <button
                onClick={() => onGetKhoaDownFromTree('fire_ants_scare')}
                className="p-2 rounded-xl bg-rose-600/25 hover:bg-rose-600/40 border border-rose-500/60 text-left transition-all active:scale-95 cursor-pointer"
              >
                <div className="text-xs font-black text-rose-300">
                  🐜 Hù Có Ổ Kiến Vàng
                </div>
                <div className="text-[10px] text-zinc-300 mt-0.5">
                  Hét: "Trên cành cây có ổ kiến lửa kìa Khoa!"
                </div>
              </button>

              <button
                onClick={() => onGetKhoaDownFromTree('feather_duster')}
                className="p-2 rounded-xl bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-500/60 text-left transition-all active:scale-95 cursor-pointer"
              >
                <div className="text-xs font-black text-cyan-300">
                  🧹 Chổi Lông Gà Khều
                </div>
                <div className="text-[10px] text-zinc-300 mt-0.5">
                  Mượn chổi bà chủ quán khều Khoa xuống!
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

