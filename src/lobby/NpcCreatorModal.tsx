import React, { useState } from 'react';
import { X } from 'lucide-react';
import { sound } from '../game/audio';
import { AVATAR_ICON } from './lobbyData';
import {
  MAX_CUSTOM_NPCS,
  NPC_AVATARS,
  NPC_CLOTHES,
  NPC_GLASSES,
  NPC_HATS,
  type CustomNpc,
} from '../../shared/social';

const CLOTHES_LABEL: Record<(typeof NPC_CLOTHES)[number], string> = {
  tanktop_red: '🎽 Ba lỗ đỏ',
  tanktop_white: '👕 Ba lỗ trắng',
  floral_shirt: '🌺 Sơ mi hoa',
  gold_chain: '📿 Dây chuyền vàng',
};
const HAT_LABEL: Record<(typeof NPC_HATS)[number], string> = {
  none: '🙂 Không',
  sunglasses: '🕶️ Kính râm',
  traffic_helmet: '⛑️ Mũ bảo hiểm',
  towel: '🧣 Khăn lạnh',
};
const GLASS_LABEL: Record<(typeof NPC_GLASSES)[number], string> = {
  beer_mug: '🍺 Cốc vại',
  coi_glass: '🥛 Ly cối',
  horn: '📯 Tù và',
  jade_cup: '🍶 Chén ngọc',
};

const toleranceLabel = (t: number) =>
  t < 25 ? 'Một lon là gục 🥴' : t < 50 ? 'Lai rai vài ly 🍺' : t < 80 ? 'Chiến binh bàn nhậu 💪' : 'Hũ chìm không đáy 🛢️';

/** "➕ Tạo NPC bạn nhậu": name, look, tửu lượng and a catchphrase. */
export const NpcCreatorModal: React.FC<{
  count: number;
  onCreate: (npc: Omit<CustomNpc, 'npcId'>) => Promise<void>;
  onClose: () => void;
}> = ({ count, onCreate, onClose }) => {
  const [form, setForm] = useState<Omit<CustomNpc, 'npcId'>>({
    name: '',
    avatar: 'dog',
    clothing: 'tanktop_red',
    hat: 'none',
    glassType: 'beer_mug',
    tolerance: 50,
    catchphrase: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = count >= MAX_CUSTOM_NPCS;

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError('Tên NPC cần ít nhất 2 ký tự');
    setBusy(true);
    setError(null);
    try {
      await onCreate(form);
      sound.playMugSlam();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được NPC');
    } finally {
      setBusy(false);
    }
  };

  const chip = (active: boolean) =>
    `px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer border ${
      active ? 'bg-amber-400 text-red-900 border-amber-200' : 'bg-black/30 border-white/10 hover:bg-black/50'
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/55 backdrop-blur-[2px]"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        data-testid="npc-creator"
        className="relative w-[min(420px,95vw)] max-h-[90vh] overflow-y-auto rounded-2xl laminated-menu border-4 border-amber-400 shadow-2xl p-4 text-white space-y-3"
      >
        <button type="button" onClick={onClose} className="absolute top-2 right-2 p-1 rounded-full bg-black/40 cursor-pointer" aria-label="Đóng">
          <X className="w-4 h-4" />
        </button>
        <h2 className="font-neon text-xl text-amber-300">🤖 Tạo NPC Bạn Nhậu</h2>
        <div className="text-[11px] text-white/70">
          {count}/{MAX_CUSTOM_NPCS} NPC tự tạo • NPC chỉ ngồi vào bàn khi bạn bấm “Rủ”.
        </div>

        <label className="block">
          <span className="text-[11px] font-black text-amber-100">Tên gọi</span>
          <input
            value={form.name}
            maxLength={24}
            onChange={(e) => set('name', e.target.value)}
            placeholder="VD: Tư Mập Bia Hơi"
            data-testid="npc-name-input"
            className="mt-0.5 w-full bg-zinc-900 text-white text-sm px-2.5 py-1.5 rounded-lg border border-zinc-700 focus:outline-none focus:border-amber-400"
          />
        </label>

        <div>
          <div className="text-[11px] font-black text-amber-100 mb-1">Linh vật</div>
          <div className="flex flex-wrap gap-1.5">
            {NPC_AVATARS.map((a) => (
              <button key={a} type="button" onClick={() => set('avatar', a)} className={`${chip(form.avatar === a)} text-xl`}>
                {AVATAR_ICON[a]}
              </button>
            ))}
          </div>
        </div>

        {[
          { key: 'clothing' as const, label: 'Áo', list: NPC_CLOTHES, names: CLOTHES_LABEL },
          { key: 'hat' as const, label: 'Phụ kiện', list: NPC_HATS, names: HAT_LABEL },
          { key: 'glassType' as const, label: 'Ly ruột', list: NPC_GLASSES, names: GLASS_LABEL },
        ].map((g) => (
          <div key={g.key}>
            <div className="text-[11px] font-black text-amber-100 mb-1">{g.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {g.list.map((v) => (
                <button key={v} type="button" onClick={() => set(g.key, v as never)} className={chip(form[g.key] === v)}>
                  {(g.names as Record<string, string>)[v]}
                </button>
              ))}
            </div>
          </div>
        ))}

        <label className="block">
          <span className="flex justify-between text-[11px] font-black text-amber-100">
            <span>Tửu lượng</span>
            <span className="text-amber-300">{toleranceLabel(form.tolerance)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={form.tolerance}
            onChange={(e) => set('tolerance', Number(e.target.value))}
            className="w-full accent-amber-400"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-black text-amber-100">Câu cửa miệng</span>
          <input
            value={form.catchphrase}
            maxLength={80}
            onChange={(e) => set('catchphrase', e.target.value)}
            placeholder='VD: "Uống đi rồi tính!"'
            className="mt-0.5 w-full bg-zinc-900 text-white text-sm px-2.5 py-1.5 rounded-lg border border-zinc-700 focus:outline-none focus:border-amber-400"
          />
        </label>

        {error && <div className="text-[11px] font-bold text-red-300">⚠️ {error}</div>}
        <button
          type="submit"
          disabled={busy || full}
          data-testid="npc-create-submit"
          className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-red-900 font-black text-sm cursor-pointer disabled:opacity-50"
        >
          {full ? 'Đã đủ NPC rồi!' : busy ? 'Đang nặn NPC…' : '➕ Tạo & cho vào danh sách NPC'}
        </button>
      </form>
    </div>
  );
};
