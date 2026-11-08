import React, { useEffect, useMemo, useRef, useState } from 'react';
import { sound } from '../game/audio';
import type { Player } from '../game/types';
import { AVATAR_ICON } from './lobbyData';

export interface UnfriendTarget {
  userId: string;
  username: string;
  avatar: string;
}

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** {name} → friend's nickname. */
const PLEAS = [
  '{name} vẫn còn nợ bạn nửa thùng bia đấy, hủy là mất trắng luôn!',
  'Ai sẽ dìu bạn về nhà lúc 2 giờ sáng nếu không phải {name}?',
  '{name} là người duy nhất nghe bạn hát "Đắp mộ cuộc tình" tới câu cuối.',
  'Hủy {name} thì lần sau ai đứng ra "để tao trả" giả vờ?',
  '{name} đã từng nói dối vợ bạn là "nó ở nhà tui". Tình nghĩa vậy đó!',
  'Một trăm phần trăm thì được, chứ một trăm phần trăm cắt đứt thì… căng.',
  '{name} biết hết bí mật quỹ đen của bạn. Bạn chắc chưa?',
] as const;

const SOBS = [
  '"Tao với mày cụng ly bao nhiêu lần rồi…"',
  '"Hôm qua còn khoác vai, hôm nay đã hủy…"',
  '"Thôi được, nhưng chầu cuối mày trả nhé."',
  '"Mày say rồi, mai tỉnh nói chuyện tiếp."',
] as const;

/** The red button dodges the mouse a couple of times before giving in. */
const RUN_AWAY_LABELS = ['💔 Cắt đứt!', '🙅 Bắt được tao đi', '😮‍💨 Thôi được rồi…'] as const;
const DODGE_SPOTS = ['translate-x-0', '-translate-x-[105%]', 'translate-x-[105%] -translate-y-2'] as const;

/** Funny "are you sure?" before unfriending a drinking buddy. Escape / backdrop = keep the friendship. */
export const UnfriendConfirmModal: React.FC<{
  target: UnfriendTarget;
  onConfirm: (target: UnfriendTarget) => void;
  onCancel: () => void;
}> = ({ target, onConfirm, onCancel }) => {
  const plea = useMemo(() => pick(PLEAS).split('{name}').join(target.username), [target.username]);
  const sob = useMemo(() => pick(SOBS), []);
  const [dodges, setDodges] = useState(0);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    sound.playHiccup();
    keepRef.current?.focus();
    // Capture phase so Escape only closes this dialog, not the passport underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const dodge = (e: React.PointerEvent) => {
    // Only tease real mice — touch / keyboard users get a straight click.
    if (e.pointerType !== 'mouse' || dodges >= RUN_AWAY_LABELS.length - 1) return;
    sound.playSnap();
    setDodges((d) => d + 1);
  };

  const keep = () => {
    sound.playClink();
    onCancel();
  };

  const cut = () => {
    sound.playPaperRip();
    onConfirm(target);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/70 backdrop-blur-[2px]"
      onPointerDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        data-testid="unfriend-confirm"
        role="alertdialog"
        aria-labelledby="unfriend-title"
        className="w-[min(380px,95vw)] rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border-4 border-red-500/70 shadow-2xl p-5 text-center text-white"
      >
        <div className="relative mx-auto w-fit text-6xl leading-none select-none">
          {AVATAR_ICON[target.avatar as Player['avatar']] ?? '🍺'}
          <span className="absolute -right-3 top-0 text-2xl animate-bounce">💧</span>
          <span className="absolute -left-4 bottom-0 text-2xl">🍺</span>
        </div>
        <h2 id="unfriend-title" className="mt-3 font-neon text-xl text-red-300">
          Hủy kết bạn với {target.username}?!
        </h2>
        <p className="mt-2 text-[13px] text-zinc-200">{plea}</p>
        <p className="mt-2 text-[12px] italic text-amber-200/90">
          {target.username}: {sob}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            ref={keepRef}
            data-testid="unfriend-keep"
            onClick={keep}
            className="rounded-xl bg-emerald-500 hover:bg-emerald-400 py-3 text-base font-black text-zinc-950 cursor-pointer shadow-lg"
          >
            🍻 Thôi, làm hòa nhậu tiếp!
          </button>
          <div className="relative h-10">
            <button
              data-testid="unfriend-cut"
              onPointerEnter={dodge}
              onClick={cut}
              className={`absolute inset-x-8 top-0 rounded-xl bg-red-700/80 hover:bg-red-600 py-2 text-[12px] font-black text-white cursor-pointer transition-transform duration-200 ${DODGE_SPOTS[dodges]}`}
            >
              {RUN_AWAY_LABELS[dodges]}
            </button>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-zinc-500">Không có nút "hoàn tác" đâu — muốn quay lại phải gửi lời mời lại 🥲</div>
      </div>
    </div>
  );
};
