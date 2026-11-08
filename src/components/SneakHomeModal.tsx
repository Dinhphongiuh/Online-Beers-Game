import React from 'react';

export type SneakHomeStage = 'idle' | 'confirm' | 'riding';

/**
 * "Trốn Nhậu — Gọi Grab Về": leave the table mid-night. Asks first (one stray click
 * shouldn't end the night), then the Grab pulls up and takes you back to the menu.
 */
export const SneakHomeModal: React.FC<{
  stage: SneakHomeStage;
  alcoholLevel: number;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ stage, alcoholLevel, onConfirm, onCancel }) => {
  if (stage === 'idle') return null;

  if (stage === 'riding') {
    return (
      <div
        data-testid="sneak-home-riding"
        className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white text-center p-6"
      >
        <div className="text-6xl animate-bounce">🧑‍✈️🟢🛵💨</div>
        <div className="mt-4 font-neon text-2xl text-emerald-300">GRAB ĐÃ TỚI — LÊN XE!</div>
        <p className="mt-2 text-sm text-zinc-300 max-w-sm">
          Bạn lén chuồn ra cửa sau lúc cả bàn đang hô "Dzô"... Anh tài xế áo xanh chở bạn về thẳng nhà.
        </p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        data-testid="sneak-home-confirm"
        className="w-[min(380px,95vw)] rounded-2xl border-4 border-emerald-500 bg-zinc-950 p-5 text-white shadow-2xl rotate-[-0.8deg]"
      >
        <div className="text-4xl text-center">🏃‍♂️🚕</div>
        <h2 className="mt-1 text-center font-neon text-xl text-emerald-300">TRỐN NHẬU — GỌI GRAB VỀ?</h2>
        <p className="mt-2 text-center text-xs text-zinc-300">
          Bỏ dở buổi nhậu, lẻn ra cửa sau gọi xe ôm công nghệ về nhà
          {alcoholLevel > 0 ? ` (đang ${Math.round(alcoholLevel)}% cồn — để Grab chở cho lành)` : ''}. Buổi này sẽ
          không có Biên Bản Cuối Buổi.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 py-2.5 text-sm font-black text-zinc-950 cursor-pointer"
          >
            🍺 Nhậu tiếp
          </button>
          <button
            type="button"
            data-testid="sneak-home-confirm-btn"
            onClick={onConfirm}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-sm font-black text-white cursor-pointer"
          >
            🚕 Gọi Grab về
          </button>
        </div>
      </div>
    </div>
  );
};
