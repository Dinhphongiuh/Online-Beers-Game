import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  BURN_SNAPSHOT_COST,
  MAP_LABELS,
  formatDuration,
  grudgeCandidates,
  receiptMood,
  type AlcoholSample,
  type LifetimeStats,
  type MatchReceipt,
} from '../../shared/receipts';
import { sound } from '../game/audio';
import { getNetPlayerId } from '../net/useTableNet';
import { AVATAR_ICON } from '../lobby/lobbyData';
import type { CharacterAvatar } from '../game/types';

interface BookData {
  receipts: MatchReceipt[];
  lifetime: LifetimeStats;
  coins: number;
  pinnedReceiptCode: string;
}

const vnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;
const ddmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('tram_nhau_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const apiBase = () => `/api/players/${encodeURIComponent(getNetPlayerId())}`;

const OUTCOME_LINE: Record<MatchReceipt['commuteOutcome'], string> = {
  HOME_SAFE: '🛵 TỰ LÁI VỀ TỚI CỔNG NHÀ AN TOÀN',
  CAUGHT_BY_TRAFFIC_POLICE: '🚔 BỊ GIAO THÔNG TỊCH THU CHIẾN CƠ',
  GRAB_HOME: '🚕 XE ÔM CÔNG NGHỆ CỘT DÂY NỊT CHỞ VỀ',
  LEFT_TABLE: '🚪 LẶNG LẼ RỜI BÀN (KHÔNG AI THẤY)',
  CARRIED_HOME_PASSED_OUT: '💤 NGẤT = ĐẦU HÀNG — ANH EM KHIÊNG LÊN XE ÔM VỀ',
};

function resultLine(r: MatchReceipt) {
  if (r.stats.peakAlcoholPercent >= 100 || r.stats.timesPassedOut > 0)
    return `💀 GỤC TẠI BÀN (Độ cồn chạm đỉnh: ${r.stats.peakAlcoholPercent}%)`;
  if (r.escapedBill) return `🥷 TRỐN BILL THÀNH CÔNG (Độ cồn đỉnh: ${r.stats.peakAlcoholPercent}%)`;
  if (r.paidWholeBill) return `💸 BỊ ÚP SỌT TRẢ CẢ BÀN (Độ cồn đỉnh: ${r.stats.peakAlcoholPercent}%)`;
  return `🍺 SỐNG SÓT TỚI CUỐI (Độ cồn đỉnh: ${r.stats.peakAlcoholPercent}%)`;
}

// ---------------------------------------------------------------------------
// Điện Tâm Đồ Tửu Lượng
// ---------------------------------------------------------------------------
const DrunkECG: React.FC<{ timeline: AlcoholSample[]; durationSec: number }> = ({ timeline, durationSec }) => {
  const W = 600;
  const H = 170;
  const PAD = { l: 30, r: 12, t: 26, b: 22 };
  const pts = timeline.length ? timeline : [{ t: 0, a: 0 }];
  const maxT = Math.max(60, durationSec, ...pts.map((p) => p.t));
  const x = (t: number) => PAD.l + (t / maxT) * (W - PAD.l - PAD.r);
  const y = (a: number) => PAD.t + (1 - a / 100) * (H - PAD.t - PAD.b);
  // Square-ish "ECG" steps: hold the value, then spike to the next one
  const path = pts
    .map((p, i) => {
      if (i === 0) return `M ${x(p.t)} ${y(p.a)}`;
      const prev = pts[i - 1];
      const mid = x(p.t) - Math.min(6, (x(p.t) - x(prev.t)) / 3);
      return `L ${mid} ${y(prev.a)} L ${x(p.t)} ${y(p.a)}`;
    })
    .join(' ');
  const notes = pts.filter((p) => p.note);
  const minuteTicks = Array.from({ length: Math.min(12, Math.floor(maxT / 60)) + 1 }, (_, i) =>
    Math.round((i * maxT) / Math.max(1, Math.min(12, Math.floor(maxT / 60))))
  );

  return (
    <div className="ecg-paper rounded-lg border border-red-200 overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Điện tâm đồ độ cồn theo phút">
        {[0, 50, 80, 100].map((a) => (
          <g key={a}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(a)} y2={y(a)} stroke={a === 80 ? '#dc2626' : '#fca5a5'} strokeDasharray={a === 80 ? '4 3' : '0'} strokeWidth={a === 80 ? 1 : 0.6} />
            <text x={4} y={y(a) + 3} fontSize="9" fill="#991b1b" fontWeight={700}>
              {a}%
            </text>
          </g>
        ))}
        <text x={PAD.l + 4} y={y(80) + 9} fontSize="8" fill="#dc2626" textAnchor="start" fontWeight={800} opacity={0.75}>
          VÙNG MẤT KẾT NỐI NÃO BỘ
        </text>
        {minuteTicks.map((t) => (
          <text key={t} x={x(t)} y={H - 6} fontSize="8" fill="#7f1d1d" textAnchor="middle">
            {Math.round(t / 60)}′
          </text>
        ))}
        <path d={path} fill="none" stroke="#ef4444" strokeWidth={5} strokeOpacity={0.18} strokeLinejoin="round" />
        <path d={path} fill="none" stroke="#b91c1c" strokeWidth={1.8} strokeLinejoin="round" />
        {notes.map((p, i) => {
          const up = i % 2 === 0;
          const ly = up ? Math.max(10, y(p.a) - 12) : Math.min(H - PAD.b - 2, y(p.a) + 16);
          return (
            <g key={`${p.t}_${i}`}>
              <circle cx={x(p.t)} cy={y(p.a)} r={3} fill="#fff" stroke="#b91c1c" strokeWidth={1.5} />
              <text x={x(p.t)} y={ly} fontSize="9" fontWeight={800} fill="#450a0a" textAnchor="middle">
                {p.note} {p.a}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Polaroid
// ---------------------------------------------------------------------------
const Polaroid: React.FC<{ src: string; caption: string; tilt?: number; big?: boolean }> = ({
  src,
  caption,
  tilt = -4,
  big,
}) => (
  <div
    className={`relative bg-white p-2 pb-7 shadow-xl border border-zinc-200 ${big ? 'w-full max-w-[340px]' : 'w-28'}`}
    style={{ transform: `rotate(${tilt}deg)` }}
  >
    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-3 rounded-sm bg-zinc-400 shadow" title="Ghim bấm" />
    {src ? (
      <img src={src} alt={caption} className="w-full aspect-[4/3] object-cover grayscale-[15%] sepia-[25%]" />
    ) : (
      <div className="w-full aspect-[4/3] bg-zinc-800 flex items-center justify-center text-3xl">🔥</div>
    )}
    <div className={`absolute bottom-1 left-2 right-2 font-['Comic_Sans_MS',cursive] text-zinc-700 leading-tight ${big ? 'text-xs' : 'text-[8px]'} line-clamp-2`}>
      {caption}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// One receipt in the stack
// ---------------------------------------------------------------------------
const ReceiptSlip: React.FC<{ r: MatchReceipt; index: number; onOpen: () => void }> = ({ r, index, onOpen }) => {
  const mood = receiptMood(r);
  const tilt = ((index * 37) % 7) - 3 + (mood === 'crumpled' ? (index % 2 ? 4 : -4) : 0);
  return (
    <button
      type="button"
      data-testid="receipt-slip"
      onClick={onOpen}
      className={`group relative w-full text-left cursor-pointer transition-transform hover:-translate-y-1 hover:rotate-0 ${
        index > 0 ? 'mt-1' : ''
      }`}
      style={{ transform: `rotate(${tilt * 0.6}deg)`, zIndex: 50 - index }}
    >
      <div
        className={`receipt-zigzag relative px-3 pt-2 pb-4 font-mono text-[11px] text-zinc-800 shadow-md ${
          index % 3 === 1 ? 'bg-[#fde2e4]' : 'bg-[#fffdf5]'
        } ${mood === 'crumpled' ? 'receipt-crumpled scale-[0.97]' : ''}`}
      >
        {index % 2 === 0 && <div className="beer-stain absolute -right-4 -top-3 w-16 h-16 pointer-events-none" />}
        {index % 3 === 2 && <div className="grease-stain absolute left-10 bottom-1 w-20 h-8 pointer-events-none" />}
        <div className="flex justify-between font-black">
          <span>🧾 {r.receiptCode}</span>
          <span>{ddmm(r.createdAt)}</span>
        </div>
        <div className="flex justify-between text-[10px] text-zinc-600">
          <span className="truncate">{MAP_LABELS[r.map] ?? r.map}</span>
          <span>{Math.round(r.durationSec / 60)} phút</span>
        </div>
        <div className="flex justify-between mt-0.5">
          <span>{r.stats.beersChugged} ly • đỉnh {r.stats.peakAlcoholPercent}%</span>
          <b className={r.billShare === 0 ? 'text-emerald-700' : 'text-red-700'}>
            {r.billShare === 0 ? '0đ' : `-${vnd(r.billShare)}`}
          </b>
        </div>
        {mood === 'escaped' && (
          <div className="absolute right-12 top-7 rotate-[-12deg] border-2 border-red-600 text-red-600 font-black text-[9px] px-1 rounded opacity-85">
            ĐÃ TRỐN BILL THÀNH CÔNG
          </div>
        )}
        {mood === 'crumpled' && (
          <div className="absolute right-2 bottom-2 text-xl opacity-40 rotate-[25deg]" title="Vết dép">
            👟
          </div>
        )}
        {r.grudge && !r.grudge.settled && (
          <div className="absolute -left-1 -top-1 text-sm" title="Đã ghim thù">
            📌
          </div>
        )}
      </div>
    </button>
  );
};

// ---------------------------------------------------------------------------
// Tờ Hóa Đơn Ký Ức (detail)
// ---------------------------------------------------------------------------
const Leader: React.FC<{ label: string; value: string; extra?: string }> = ({ label, value, extra }) => (
  <div className="flex items-baseline gap-1">
    <span className="shrink-0">• {label}</span>
    <span className="flex-1 border-b border-dotted border-zinc-400 translate-y-[-3px]" />
    <span className="shrink-0 font-black">{value}</span>
    {extra && <span className="shrink-0 text-zinc-500">({extra})</span>}
  </div>
);

const ReceiptDetail: React.FC<{
  r: MatchReceipt;
  coins: number;
  pinned: boolean;
  onBack: () => void;
  onUpdated: (r: MatchReceipt, coins?: number, pinnedCode?: string) => void;
}> = ({ r, coins, pinned, onBack, onUpdated }) => {
  const [showPhoto, setShowPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pickTarget, setPickTarget] = useState(false);
  const candidates = grudgeCandidates(r);
  const s = r.stats;

  const post = async (path: string, body?: unknown) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${apiBase()}/receipts/${encodeURIComponent(r.receiptCode)}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(`⚠️ ${data.error || 'Máy chủ sổ nợ đang say, thử lại sau'}`);
        return null;
      }
      return data;
    } catch {
      setMsg('⚠️ Mất kết nối tới sổ nợ');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const pinGrudge = async (targetId: string) => {
    const data = await post('grudge', { targetId });
    if (data?.receipt) {
      sound.playStampSlam();
      onUpdated(data.receipt);
      setPickTarget(false);
      setMsg(`📌 Đã ghim thù ${data.receipt.grudge.targetName}! Lần tới ngồi chung bàn, nó sẽ đội bảng TRUY NÃ.`);
    }
  };
  const pinFront = async () => {
    const data = await post('pin');
    if (data) {
      sound.playMugSlam();
      onUpdated(r, undefined, data.pinnedReceiptCode);
      setMsg('📌 Đã ghim ảnh lên trang nhất Hộ Chiếu!');
    }
  };
  const burn = async () => {
    const data = await post('burn');
    if (data?.receipt) {
      sound.playSpicySizzle();
      onUpdated(data.receipt, data.coins, pinned ? '' : undefined);
      setShowPhoto(false);
      setMsg(`🔥 Đã đốt phi tang! -${BURN_SNAPSHOT_COST} Nắp Bia`);
    }
  };

  return (
    <div className="receipt-unfold space-y-3" data-testid="receipt-detail">
      <button type="button" onClick={onBack} className="text-xs font-black text-amber-900 hover:underline cursor-pointer">
        ← Kẹp lại vào xấp hóa đơn
      </button>
      <div className="receipt-zigzag relative bg-[#fffdf5] px-4 pt-3 pb-6 font-mono text-[11px] text-zinc-800 shadow-lg">
        <div className="beer-stain absolute -right-6 top-10 w-24 h-24 pointer-events-none" />
        <div className="text-center border-y-2 border-double border-zinc-500 py-1">
          <div className="font-black text-[13px]">BIÊN BẢN HIỆN TRƯỜNG BÀN NHẬU #{r.receiptCode.replace('BILL-', '')}</div>
          <div className="text-[10px]">
            Địa điểm: {MAP_LABELS[r.map] ?? r.map} | Thời lượng: {formatDuration(r.durationSec)} | {ddmm(r.createdAt)}
          </div>
        </div>
        <div className="mt-2 space-y-0.5">
          <div>
            <b>[KẾT QUẢ CỦA BẠN]:</b> {resultLine(r)}
          </div>
          <div>
            <b>[DIỄN BIẾN ĐƯỜNG VỀ]:</b> {OUTCOME_LINE[r.commuteOutcome]}
            {r.finePaid > 0 && <b className="text-red-700"> (-{r.finePaid} 🪙)</b>}
          </div>
          <div>
            <b>[DANH HIỆU]:</b> {r.rankEmoji} {r.rankTitle} • {r.score} điểm
          </div>
        </div>

        <div className="mt-2 font-black">📋 CHI TIẾT TIÊU THỤ TRONG ĐÊM:</div>
        <div className="space-y-0.5 pl-1">
          <Leader label="Bia đã nốc" value={`${s.beersChugged} Ly`} extra={`đỉnh ${s.peakAlcoholPercent}% cồn`} />
          <Leader label="Bia đổ ướt áo vì run tay" value={`${s.secretlySpilled} Ly`} />
          <Leader label="Chạy vào WC" value={`${s.toiletRuns} Lần`} />
          <Leader label='"Cho cá ăn chè" (gọi Huệ)' value={`${s.tacticalPukes} Lần`} />
          <Leader label="Dép tổ ong trúng đầu bạn nhậu" value={`${s.slipperHits}/${s.slippersThrown} Phát`} extra={s.slippersThrown ? `Headshot ${Math.round((s.slipperHits / s.slippersThrown) * 100)}%` : undefined} />
          <Leader label="Vỏ lon phi vào đầu nhau" value={`${s.cansThrown} Lon`} />
          <Leader label="Lật bàn inox" value={`${s.tablesFlipped} Lần`} />
          <Leader
            label="Số lần bấm Gọi Tính Tiền"
            value={`${r.surrenderVotesTriggered} Lần`}
            extra={r.surrenderVotesRejected ? `Bị bác bỏ ${r.surrenderVotesRejected}` : undefined}
          />
          {s.loudestDzoDb > 0 && <Leader label='Hét "DZÔ" to nhất' value={`${s.loudestDzoDb} dB`} />}
          {r.mostSpammedQuote && (
            <div className="pt-0.5">
              • Câu gáy nhiều nhất: <b>"{r.mostSpammedQuote}"</b>
              {r.quotes[0] ? ` (x${r.quotes[0].count})` : ''}
            </div>
          )}
        </div>

        <div className="mt-2 font-black">
          👑 PHÂN CHIA DANH HIỆU TRONG BÀN ({r.table.length} NGƯỜI):
        </div>
        <ol className="pl-1 space-y-0.5">
          {r.table.map((m, i) => (
            <li key={`${m.name}_${i}`} className={m.isUser ? 'bg-amber-100' : ''}>
              {i + 1}. [{m.isUser ? `Bạn - ${m.name}` : m.name}
              {m.isRemote ? ' 🌐' : ''}]: <b>"{m.awardTitle}"</b> <span className="text-zinc-500">({m.awardNote})</span>
            </li>
          ))}
        </ol>

        <div className="mt-2 pt-1 border-t border-dashed border-zinc-400 flex justify-between">
          <span>Tổng bill cả bàn: {vnd(r.totalBillAmount)}</span>
          <b className={r.billShare === 0 ? 'text-emerald-700' : 'text-red-700'}>
            Bạn trả: {r.billShare === 0 ? '0đ 😎' : vnd(r.billShare)}
          </b>
        </div>
        {r.billPayerName && <div className="text-[10px] text-zinc-500">Người cầm bill: {r.billPayerName}</div>}
        {r.grudge && (
          <div className={`mt-1 font-black ${r.grudge.settled ? 'text-emerald-700 line-through' : 'text-red-700'}`}>
            📌 Sổ thù vặt: {r.grudge.targetName} nợ 1 chầu từ ngày {ddmm(r.grudge.since)}
            {r.grudge.settled ? ' — ĐÃ TRẢ BẰNG LY X1.5' : ''}
          </div>
        )}
      </div>

      <div>
        <div className="text-[11px] font-black text-amber-950 mb-1">📈 ĐIỆN TÂM ĐỒ TỬU LƯỢNG</div>
        <DrunkECG timeline={r.alcoholTimeline} durationSec={r.durationSec} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] font-black">
        <button
          type="button"
          disabled={!r.funnySnapshot}
          onClick={() => {
            sound.playSnap();
            setShowPhoto((v) => !v);
          }}
          className="rounded-lg bg-zinc-900 text-amber-200 py-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          📸 {r.snapshotBurned ? 'Ảnh đã bị đốt' : r.funnySnapshot ? (showPhoto ? 'Cất ảnh dìm hàng' : 'Xem ảnh dìm hàng') : 'Không có ảnh'}
        </button>
        <button
          type="button"
          disabled={busy || !!r.grudge || candidates.length === 0}
          onClick={() => setPickTarget((v) => !v)}
          title={
            r.grudge
              ? 'Tờ này đã ghim thù'
              : candidates.length === 0
              ? 'Chỉ ghim được khi bạn phải trả tiền mà có đứa trốn bill'
              : ''
          }
          className="rounded-lg bg-red-700 text-white py-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ⚖️ {r.grudge ? 'Đã ghim vào sổ thù' : 'Ghim vào sổ thù vặt'}
        </button>
      </div>

      {pickTarget && (
        <div className="rounded-lg border-2 border-red-700 bg-red-50 p-2 text-[11px]">
          <div className="font-black text-red-800 mb-1">Ghim thù đứa nào trốn bill đêm đó?</div>
          <div className="flex flex-wrap gap-1.5">
            {candidates.map((m) => (
              <button
                key={m.playerId}
                type="button"
                disabled={busy}
                onClick={() => pinGrudge(m.playerId)}
                className="rounded-md bg-red-700 hover:bg-red-600 text-white px-2 py-1 font-black cursor-pointer"
              >
                📌 {m.name} ({m.awardTitle})
              </button>
            ))}
          </div>
          <div className="text-[10px] text-red-900/70 mt-1">
            Lần tới ngồi chung bàn: trên đầu nó lơ lửng bảng TRUY NÃ, ly bia đầu tiên to gấp rưỡi.
          </div>
        </div>
      )}

      {showPhoto && r.funnySnapshot && (
        <div className="flex flex-col items-center gap-2 py-2" data-testid="receipt-polaroid">
          <Polaroid src={r.funnySnapshot} caption={r.funnySnapshotCaption} tilt={-2} big />
          <div className="flex gap-2 text-[11px] font-black">
            <button
              type="button"
              disabled={busy || pinned}
              onClick={pinFront}
              className="rounded-lg bg-amber-500 text-amber-950 px-3 py-1.5 cursor-pointer disabled:opacity-50"
            >
              📌 {pinned ? 'Đang ở trang nhất' : 'Ghim lên trang nhất Profile'}
            </button>
            <button
              type="button"
              disabled={busy || coins < BURN_SNAPSHOT_COST}
              onClick={burn}
              title={coins < BURN_SNAPSHOT_COST ? `Cần ${BURN_SNAPSHOT_COST} Nắp Bia` : ''}
              className="rounded-lg bg-orange-600 text-white px-3 py-1.5 cursor-pointer disabled:opacity-50"
            >
              🔥 Đốt phi tang ảnh (-{BURN_SNAPSHOT_COST} 🪙)
            </button>
          </div>
        </div>
      )}
      {msg && <div className="text-[11px] font-black text-amber-950 bg-amber-100 rounded px-2 py-1">{msg}</div>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// The book
// ---------------------------------------------------------------------------
export const HangoverBook: React.FC<{
  name: string;
  avatar: CharacterAvatar;
  onClose: () => void;
}> = ({ name, avatar, onClose }) => {
  const [data, setData] = useState<BookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openCode, setOpenCode] = useState<string | null>(null);

  useEffect(() => {
    sound.playPaperRip(); // "Xoẹt!"
    fetch(`${apiBase()}/receipts`, { headers: authHeaders() })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Không mở được sổ');
        setData(body);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Không mở được sổ'));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const open = data?.receipts.find((r) => r.receiptCode === openCode) ?? null;
  const pinned = useMemo(
    () => data?.receipts.find((r) => r.receiptCode === data.pinnedReceiptCode && r.funnySnapshot) ?? null,
    [data]
  );
  const life = data?.lifetime;

  const updateReceipt = (r: MatchReceipt, coins?: number, pinnedCode?: string) =>
    setData((prev) =>
      prev
        ? {
            ...prev,
            receipts: prev.receipts.map((x) => (x.receiptCode === r.receiptCode ? r : x)),
            coins: coins ?? prev.coins,
            pinnedReceiptCode: pinnedCode ?? prev.pinnedReceiptCode,
          }
        : prev
    );

  const notes: { color: string; tilt: number; title: string; value: string; sub: string }[] = life
    ? [
        {
          color: 'bg-yellow-200',
          tilt: -3,
          title: '🍺 Lượng Bia Đã Tiêu Thụ',
          value: `${life.liters.toLocaleString('vi-VN')} Lít`,
          sub: `${life.totalDrinks} ly — ${life.litersComparison}`,
        },
        {
          color: 'bg-pink-200',
          tilt: 2,
          title: '🐍 Chỉ Số Lươn Lẹo',
          value: `${life.billDodgeRate}%`,
          sub: `Trốn bill ${life.nightsEscaped}/${life.nights} buổi • Gánh cả bàn ${life.nightsPaidWhole} lần`,
        },
        {
          color: 'bg-lime-200',
          tilt: -1,
          title: '🐟 Số Lần "Cho Cá Ăn Chè"',
          value: `${life.pukes} Lần`,
          sub: `+ ${life.toiletRuns} lần chạy WC • Gục ${life.timesPassedOut} lần`,
        },
        {
          color: 'bg-orange-200',
          tilt: 3,
          title: '💥 Tài Sản Quán Đã Đập Phá',
          value: `${life.tablesFlipped} bàn inox`,
          sub: `${life.slipperHits} dép trúng đầu • ${life.cansThrown} vỏ lon bay • ${life.spilled} ly đổ`,
        },
        {
          color: 'bg-sky-200',
          tilt: -2,
          title: '🚔 Số Lần Bị Giao Thông "Bế"',
          value: `${life.timesCaughtByPolice} Lần`,
          sub: `Đã nộp phạt ${life.finesPaid.toLocaleString('vi-VN')} Nắp Bia`,
        },
        {
          color: 'bg-violet-200',
          tilt: 1,
          title: '🗣️ Câu Gáy Nhiều Nhất Khi Say',
          value: life.favoriteQuote ? `"${life.favoriteQuote}"` : '— chưa gáy câu nào —',
          sub: life.favoriteQuoteCount ? `Đã hét ${life.favoriteQuoteCount} lần` : 'Chat trong bàn để lập kỷ lục',
        },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-[2px] p-2 sm:p-4" data-testid="hangover-book">
      <div className="absolute bottom-6 right-4 text-3xl cockroach-dash pointer-events-none select-none z-[70]" aria-hidden>
        🪳
      </div>

      <div className="book-open relative w-full max-w-5xl max-h-[94vh] rounded-xl bg-[#8b5a2b] p-2 sm:p-3 shadow-2xl border-4 border-[#5b3a1a]">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-zinc-900 border-2 border-amber-400 text-amber-300 flex items-center justify-center cursor-pointer hover:bg-zinc-800"
          title="Gấp sổ (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="text-center text-amber-100/90 font-neon text-sm sm:text-lg tracking-wider -mt-0.5 mb-1.5">
          📕 SỔ NỢ GIA TRUYỀN & BỆNH ÁN TỬU LƯỢNG
        </div>

        <div className="grid md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] gap-0 rounded-md h-[calc(94vh-64px)] overflow-y-auto md:overflow-hidden">
          {/* LEFT PAGE: Hồ Sơ Đen */}
          <div className="relative bg-[#f4e9cf] p-4 md:overflow-y-auto min-h-0 border-r-2 border-[#c9b48a] shadow-[inset_-12px_0_18px_-12px_rgba(0,0,0,0.35)]">
            <div className="beer-stain absolute right-6 top-24 w-28 h-28 pointer-events-none" />
            <div className="grease-stain absolute left-4 bottom-10 w-32 h-14 pointer-events-none" />
            <div className="text-[10px] font-black tracking-[0.3em] text-amber-900/70">HỒ SƠ ĐEN • D/P/B</div>
            <div className="flex gap-3 items-start mt-2">
              {pinned ? (
                <Polaroid src={pinned.funnySnapshot} caption={pinned.funnySnapshotCaption} tilt={-5} />
              ) : (
                <div className="w-24 shrink-0 bg-white p-1.5 pb-5 shadow rotate-[-4deg] relative">
                  <div className="aspect-[3/4] bg-sky-100 flex items-center justify-center text-5xl blur-[0.4px]">
                    {AVATAR_ICON[avatar]}
                  </div>
                  <div className="absolute bottom-0.5 left-1 right-1 text-[8px] text-zinc-600 text-center">mắt nhắm mắt mở</div>
                </div>
              )}
              <div className="text-xs text-amber-950 space-y-0.5">
                <div className="font-black text-base leading-tight">{name}</div>
                {life && (
                  <>
                    <div>
                      Drink <b>{life.totalDrinks}</b> / Puke <b>{life.pukes}</b> / Bill{' '}
                      <b>{data ? vnd(life.totalPaid) : '—'}</b>
                    </div>
                    <div>Đã nhậu {life.nights} buổi • Kỷ lục {life.bestScore} điểm</div>
                    <div>Cồn cao nhất từng đạt: {life.peakAlcohol}%</div>
                  </>
                )}
                <div className="font-black">🪙 Ví Hộ Chiếu: {data?.coins ?? '—'} Nắp Bia</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-4">
              {notes.map((n) => (
                <div
                  key={n.title}
                  className={`${n.color} relative p-2 shadow-md`}
                  style={{ transform: `rotate(${n.tilt}deg)` }}
                >
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-10 h-3 bg-white/60 rotate-[-3deg]" />
                  <div className="text-[10px] font-black text-zinc-700">{n.title}</div>
                  <div className="text-sm font-black text-zinc-900 leading-tight break-words">{n.value}</div>
                  <div className="text-[9px] text-zinc-600 leading-tight mt-0.5">{n.sub}</div>
                </div>
              ))}
            </div>
            {!data && !error && <div className="text-sm text-amber-900 mt-4">⏳ Đang lật sổ…</div>}
          </div>

          {/* RIGHT PAGE: Xấp Hóa Đơn Cũ */}
          <div data-testid="book-right-page" className="relative bg-[#efe3c4] p-4 md:overflow-y-auto min-h-0 shadow-[inset_12px_0_18px_-12px_rgba(0,0,0,0.3)]">
            {error && (
              <div className="rounded-lg bg-red-100 border border-red-400 p-3 text-sm text-red-800">
                ⚠️ {error}
              </div>
            )}
            {open ? (
              <ReceiptDetail
                r={open}
                coins={data?.coins ?? 0}
                pinned={data?.pinnedReceiptCode === open.receiptCode}
                onBack={() => setOpenCode(null)}
                onUpdated={updateReceipt}
              />
            ) : (
              <>
                <div className="text-[10px] font-black tracking-[0.3em] text-amber-900/70 mb-3">
                  XẤP HÓA ĐƠN CŨ • {data?.receipts.length ?? 0} TỜ GẦN NHẤT
                </div>
                {data && data.receipts.length === 0 && (
                  <div className="text-center text-sm text-amber-950 py-10">
                    <div className="text-4xl mb-2">🧾</div>
                    Chưa có tờ hóa đơn nào. Nhậu xong một buổi (tính tiền & về nhà) để kẹp tờ đầu tiên vào sổ!
                  </div>
                )}
                <div className="pt-2">
                  {data?.receipts.map((r, i) => (
                    <ReceiptSlip
                      key={r.receiptCode}
                      r={r}
                      index={i}
                      onOpen={() => {
                        sound.playPaperRip();
                        setOpenCode(r.receiptCode);
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
