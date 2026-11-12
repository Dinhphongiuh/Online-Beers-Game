/**
 * Dev Mode → UI Lab: a sandbox for building the game's UI.
 *
 * "Kit giao diện" shows the shared look (colours, fonts, buttons, badges) so new
 * screens stay consistent. "Các loại bia" is the beer menu; glasses and dishes are
 * placeholders marked Coming Soon until their designs land.
 */
import React, { useState } from 'react';
import { BeerCatalog } from './ui/BeerCatalog';

type SectionId = 'kit' | 'beers' | 'glasses' | 'dishes';

interface Section {
  id: SectionId;
  icon: string;
  label: string;
  comingSoon: boolean;
  /** What the screen will be (shown on the Coming Soon panel). */
  plan?: string;
  /** Placeholder card names for the locked preview grid. */
  placeholders?: string[];
}

const SECTIONS: Section[] = [
  { id: 'kit', icon: '🎨', label: 'Kit giao diện', comingSoon: false },
  {
    id: 'beers',
    icon: '🍺',
    label: 'Các loại bia',
    comingSoon: false,
  },
  {
    id: 'glasses',
    icon: '🥛',
    label: 'Ly bia',
    comingSoon: true,
    plan: 'Bộ sưu tập ly: ly vại, ly thuỷ tinh, cốc có quai, ly khổng lồ, ly có đá. Xem trước 3D, mở khoá và trang bị.',
    placeholders: ['Ly vại', 'Ly thuỷ tinh', 'Cốc có quai', 'Ly có đá', 'Ly khổng lồ', 'Ly sứ'],
  },
  {
    id: 'dishes',
    icon: '🦪',
    label: 'Món nhậu',
    comingSoon: true,
    plan: 'Thực đơn món nhậu: ốc, sò, nghêu, chân gà, lẩu, xoài non… với ảnh, giá, độ cay và nút gọi món.',
    placeholders: ['Ốc hương', 'Sò điệp', 'Nghêu hấp', 'Chân gà', 'Lẩu thái', 'Xoài non'],
  },
];

const ComingSoon: React.FC<{ section: Section }> = ({ section }) => (
  <div className="relative h-full min-h-[360px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
    {/* Locked preview grid behind the banner */}
    <div className="absolute inset-0 grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 opacity-40 blur-[2px] pointer-events-none" aria-hidden>
      {section.placeholders?.map((name) => (
        <div key={name} className="rounded-xl border border-zinc-700 bg-zinc-800/80 p-3">
          <div className="aspect-square rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-4xl">
            {section.icon}
          </div>
          <div className="mt-2 h-3 w-2/3 rounded bg-zinc-600" />
          <div className="mt-1.5 h-2.5 w-1/3 rounded bg-zinc-700" />
          <p className="mt-2 text-xs font-bold text-zinc-300">{name}</p>
        </div>
      ))}
    </div>

    <div className="relative flex h-full min-h-[360px] items-center justify-center p-6">
      <div
        data-testid={`ui-lab-coming-soon-${section.id}`}
        className="max-w-md rounded-3xl border-2 border-amber-400/70 bg-zinc-950/90 px-6 py-7 text-center box-neon-yellow"
      >
        <div className="text-5xl">{section.icon}</div>
        <span className="mt-3 inline-block rounded-full bg-amber-400 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-zinc-950">
          Coming soon
        </span>
        <h3 className="mt-3 font-neon text-2xl text-amber-200 text-neon-yellow">{section.label}</h3>
        <p className="mt-2 text-sm leading-snug text-zinc-300">{section.plan}</p>
        <p className="mt-3 text-[11px] text-zinc-500">Giao diện đang được thiết kế, sẽ có trong bản cập nhật tới.</p>
      </div>
    </div>
  </div>
);

const SWATCHES: { name: string; className: string; hex: string }[] = [
  { name: 'Nền', className: 'bg-zinc-950', hex: '#09090b' },
  { name: 'Panel', className: 'bg-zinc-900', hex: '#18181b' },
  { name: 'Viền', className: 'bg-zinc-700', hex: '#3f3f46' },
  { name: 'Bia (nhấn)', className: 'bg-amber-400', hex: '#fbbf24' },
  { name: 'Neon đỏ', className: 'bg-rose-500', hex: '#f43f5e' },
  { name: 'Neon xanh', className: 'bg-cyan-500', hex: '#06b6d4' },
  { name: 'Dev', className: 'bg-fuchsia-500', hex: '#d946ef' },
  { name: 'Thành công', className: 'bg-emerald-400', hex: '#34d399' },
];

const KitSection: React.FC = () => {
  const [toggle, setToggle] = useState(true);
  const title = 'text-[11px] font-black text-amber-300 uppercase tracking-wider';
  return (
    <div className="space-y-5" data-testid="ui-lab-kit">
      <section>
        <h3 className={title}>Màu</h3>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SWATCHES.map((swatch) => (
            <div key={swatch.name} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
              <div className={`h-10 rounded-lg border border-zinc-700 ${swatch.className}`} />
              <p className="mt-1.5 text-xs font-bold text-zinc-200">{swatch.name}</p>
              <p className="text-[10px] text-zinc-500">
                {swatch.className} • {swatch.hex}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className={title}>Chữ</h3>
        <div className="mt-2 space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="font-neon text-3xl text-amber-200 text-neon-yellow">1, 2, 3 DZÔ!</p>
          <p className="font-neon text-xl text-rose-300 text-neon-red">Trạm Nhậu Online</p>
          <p className="text-lg font-black text-zinc-100">Tiêu đề — Be Vietnam Pro 900</p>
          <p className="text-sm text-zinc-300">Nội dung — Be Vietnam Pro 400, cỡ 14px.</p>
          <p className="text-[11px] text-zinc-500">Chú thích — 11px, zinc-500.</p>
          <p className="text-[10px] text-zinc-600">font-neon = Chango (chữ bảng hiệu) • còn lại Be Vietnam Pro</p>
        </div>
      </section>

      <section>
        <h3 className={title}>Nút & nhãn</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <button className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-zinc-950 hover:bg-amber-300">Gọi món</button>
          <button className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white hover:bg-rose-500">Tính tiền</button>
          <button className="rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-black text-zinc-200 hover:border-amber-400">Huỷ</button>
          <button disabled className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-black text-zinc-500 cursor-not-allowed">Hết hàng</button>
          <button
            onClick={() => setToggle((on) => !on)}
            className={`px-2 py-1 rounded-lg text-xs font-black border transition ${
              toggle ? 'bg-amber-400 text-zinc-950 border-amber-200' : 'bg-zinc-900 text-amber-100 border-zinc-700'
            }`}
          >
            Pill {toggle ? 'bật' : 'tắt'}
          </button>
          <span className="text-[10px] font-black uppercase rounded-full px-2 py-0.5 bg-fuchsia-500/20 text-fuchsia-200">prototype</span>
          <span className="text-[10px] font-black uppercase rounded-full px-2 py-0.5 bg-emerald-500/20 text-emerald-200">mới</span>
          <span className="text-[10px] font-black uppercase rounded-full px-2 py-0.5 bg-rose-500/20 text-rose-200">hot</span>
        </div>
      </section>

      <section>
        <h3 className={title}>Thẻ mẫu</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-amber-400/60 bg-zinc-900/80 p-4 box-neon-yellow">
            <div className="flex items-center justify-between">
              <span className="font-black text-amber-200">Thẻ nổi bật</span>
              <span className="text-[10px] font-black uppercase rounded-full px-2 py-0.5 bg-amber-400 text-zinc-950">x2</span>
            </div>
            <p className="mt-1.5 text-xs text-zinc-400 leading-snug">Viền vàng neon cho món được chọn / phần thưởng.</p>
          </div>
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4 hover:border-fuchsia-400 transition">
            <span className="font-black text-zinc-100">Thẻ thường</span>
            <p className="mt-1.5 text-xs text-zinc-400 leading-snug">Viền xám, đổi màu khi rê chuột, như danh sách Dev Mode.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export const UiLab: React.FC = () => {
  const [active, setActive] = useState<SectionId>('kit');
  const section = SECTIONS.find((s) => s.id === active)!;
  return (
    <div className="flex flex-col md:flex-row gap-3 h-full min-h-0">
      <nav className="md:w-56 shrink-0 flex md:flex-col gap-1.5 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            data-testid={`ui-lab-tab-${s.id}`}
            onClick={() => setActive(s.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-left text-sm font-black transition ${
              active === s.id
                ? 'border-amber-300 bg-amber-400 text-zinc-950'
                : 'border-zinc-800 bg-zinc-900/70 text-zinc-200 hover:border-amber-400/60'
            }`}
          >
            <span>{s.icon}</span>
            <span className="flex-1">{s.label}</span>
            {s.comingSoon && (
              <span
                className={`text-[9px] uppercase rounded-full px-1.5 py-0.5 ${
                  active === s.id ? 'bg-zinc-950/20 text-zinc-900' : 'bg-amber-400/15 text-amber-300'
                }`}
              >
                Soon
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {section.comingSoon ? <ComingSoon section={section} /> : section.id === 'beers' ? <BeerCatalog /> : <KitSection />}
      </div>
    </div>
  );
};
