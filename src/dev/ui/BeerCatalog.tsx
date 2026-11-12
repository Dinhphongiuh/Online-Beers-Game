/**
 * UI Lab → Các loại bia: the beer menu as players will see it when ordering.
 * Cards with filters and sorting, plus a detail panel with stats and order buttons
 * (orders only show a confirmation here; nothing is sent to the game yet).
 */
import React, { useMemo, useState } from 'react';
import { BEERS, FORMAT_LABEL, formatVnd, type Beer, type BeerFormat } from '../../game/beerCatalog';
import { BeerRender, BeerViewer } from './Beer3D';

type Filter = 'all' | BeerFormat;
type Sort = 'default' | 'price' | 'strong';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'lon', label: '🥫 Lon' },
  { id: 'chai', label: '🍾 Chai' },
  { id: 'ly', label: '🍺 Bia tươi' },
];
const SORTS: { id: Sort; label: string }[] = [
  { id: 'default', label: 'Phổ biến' },
  { id: 'price', label: 'Giá thấp → cao' },
  { id: 'strong', label: 'Nặng đô nhất' },
];

/** Full-scale values for the stat bars (the strongest tier in the game is ~35). */
const MAX_ALCOHOL = 20;
const MAX_BLADDER = 20;

const pill = (active: boolean) =>
  `px-2.5 py-1 rounded-lg text-xs font-black border transition ${
    active ? 'bg-amber-400 text-zinc-950 border-amber-200' : 'bg-zinc-900 text-amber-100 border-zinc-700 hover:border-amber-400/60'
  }`;

const StatBar: React.FC<{ label: string; value: number; max: number; color: string; hint: string }> = ({ label, value, max, color, hint }) => (
  <div title={hint}>
    <div className="flex justify-between text-[10px] font-bold text-zinc-300">
      <span>{label}</span>
      <span>+{value}</span>
    </div>
    <div className="mt-0.5 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  </div>
);

const bulkOrder = (beer: Beer) =>
  beer.format === 'lon' ? { label: 'Gọi 1 thùng (24 lon)', count: 24 } : beer.format === 'chai' ? { label: 'Gọi 1 két (20 chai)', count: 20 } : { label: 'Gọi tháp 3 lít', count: 6 };

export const BeerCatalog: React.FC = () => {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('default');
  const [selectedId, setSelectedId] = useState(BEERS[0].id);
  const [notice, setNotice] = useState('');

  const beers = useMemo(() => {
    const list = BEERS.filter((beer) => filter === 'all' || beer.format === filter);
    if (sort === 'price') return [...list].sort((a, b) => a.priceVnd - b.priceVnd);
    if (sort === 'strong') return [...list].sort((a, b) => b.alcoholDelta - a.alcoholDelta || b.abv - a.abv);
    return list;
  }, [filter, sort]);
  const selected = BEERS.find((beer) => beer.id === selectedId) ?? BEERS[0];

  const order = (beer: Beer, count: number) => {
    const unit = FORMAT_LABEL[beer.format].toLowerCase();
    setNotice(`🛎️ Đã gọi ${count} ${unit} ${beer.name} • ${formatVnd(beer.priceVnd * count)} (chỉ là bản xem thử)`);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-3" data-testid="beer-catalog">
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.id} className={pill(filter === f.id)} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-zinc-700" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-bold text-amber-100"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {beers.map((beer) => {
            const active = beer.id === selected.id;
            return (
              <button
                key={beer.id}
                data-testid={`beer-card-${beer.id}`}
                onClick={() => setSelectedId(beer.id)}
                className={`group text-left rounded-2xl border-2 p-2.5 transition ${
                  active ? 'border-amber-400 bg-zinc-900 box-neon-yellow' : 'border-zinc-800 bg-zinc-900/70 hover:border-amber-400/50'
                }`}
              >
                <div className="relative h-44 rounded-xl bg-gradient-to-b from-[#060607] to-[#2a2a30] flex items-end justify-center overflow-hidden">
                  <BeerRender beer={beer} className="h-full w-full transition duration-300 group-hover:scale-105" />
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-zinc-950/80 px-2 py-0.5 text-[10px] font-black text-amber-200">
                    {FORMAT_LABEL[beer.format]} {beer.volumeMl}ml
                  </span>
                </div>
                <div className="mt-2 flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="font-black text-amber-100 truncate">{beer.name}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{beer.subtitle}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-amber-400 px-1.5 py-0.5 text-xs font-black text-zinc-950">{formatVnd(beer.priceVnd)}</span>
                </div>
                <div className="mt-2 space-y-1">
                  <StatBar label={`Độ cồn ${beer.abv}%`} value={beer.alcoholDelta} max={MAX_ALCOHOL} color="bg-rose-500" hint="Thanh say tăng mỗi lần uống" />
                  <StatBar label="Mắc tiểu" value={beer.bladderDelta} max={MAX_BLADDER} color="bg-cyan-400" hint="Thanh mắc tiểu tăng mỗi lần uống" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="lg:w-72 shrink-0 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 space-y-3" data-testid="beer-detail">
        <div className="relative h-72 rounded-xl overflow-hidden bg-[#141416]">
          <BeerViewer key={selected.id} beer={selected} className="absolute inset-0" />
          <span className="pointer-events-none absolute bottom-1.5 right-2 text-[10px] font-bold text-zinc-500">Kéo để xoay 360°</span>
        </div>
        <div>
          <h3 className="font-neon text-2xl text-amber-200 text-neon-yellow">{selected.name}</h3>
          <p className="text-xs text-zinc-400">{selected.subtitle}</p>
        </div>
        <p className="text-sm leading-snug text-zinc-300">{selected.description}</p>
        <div className="flex flex-wrap gap-1">
          {selected.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-black text-amber-200">
              {tag}
            </span>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
          <dt className="text-zinc-500">Quy cách</dt>
          <dd className="font-bold text-zinc-200">
            {FORMAT_LABEL[selected.format]} {selected.volumeMl} ml
          </dd>
          <dt className="text-zinc-500">Độ cồn</dt>
          <dd className="font-bold text-zinc-200">{selected.abv}%</dd>
          <dt className="text-zinc-500">Giá ở quán</dt>
          <dd className="font-bold text-amber-300">{selected.priceVnd.toLocaleString('vi-VN')}đ</dd>
          <dt className="text-zinc-500">Hay gọi</dt>
          <dd className="font-bold text-zinc-200">{selected.servedAs}</dd>
        </dl>
        <div className="space-y-1.5">
          <StatBar label="Say mỗi lần uống" value={selected.alcoholDelta} max={MAX_ALCOHOL} color="bg-rose-500" hint="Cộng vào thanh say (0-100)" />
          <StatBar label="Mắc tiểu mỗi lần uống" value={selected.bladderDelta} max={MAX_BLADDER} color="bg-cyan-400" hint="Cộng vào thanh mắc tiểu (0-100)" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            data-testid="beer-order-one"
            onClick={() => order(selected, 1)}
            className="rounded-xl bg-amber-400 px-2 py-2 text-xs font-black text-zinc-950 hover:bg-amber-300"
          >
            Gọi 1 {FORMAT_LABEL[selected.format].toLowerCase()}
          </button>
          <button
            onClick={() => order(selected, bulkOrder(selected).count)}
            className="rounded-xl border border-amber-400/60 bg-zinc-900 px-2 py-2 text-xs font-black text-amber-200 hover:bg-amber-400/10"
          >
            {bulkOrder(selected).label}
          </button>
        </div>
        {notice && <p className="rounded-lg bg-emerald-500/15 px-2 py-1.5 text-[11px] font-bold text-emerald-200">{notice}</p>}
      </aside>
    </div>
  );
};
