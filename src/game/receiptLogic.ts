/**
 * Pure helpers that turn one night at the table into a Tờ Hóa Đơn Ký Ức
 * (see shared/receipts.ts): alcohol ECG samples, the most spammed quote,
 * tablemate award titles and which embarrassing moment wins the polaroid.
 */
import { MAX_TIMELINE_POINTS, type AlcoholSample, type QuoteCount, type ReceiptTablemate } from '../../shared/receipts';

/** Adds a sample; drops near-duplicates and thins the line when it gets too long. */
export function pushAlcoholSample(
  timeline: AlcoholSample[],
  tSec: number,
  alcohol: number,
  note?: string
): AlcoholSample[] {
  const a = Math.round(Math.min(100, Math.max(0, alcohol)));
  const t = Math.max(0, Math.round(tSec));
  const last = timeline[timeline.length - 1];
  if (last && !note && Math.abs(last.a - a) < 2 && t - last.t < 60) return timeline;
  if (last && last.t === t) {
    // same second: keep the newest value, merge notes
    const joined = [last.note, note].filter(Boolean).join(' · ');
    const merged: AlcoholSample = { t, a, ...(joined ? { note: joined.slice(0, 40) } : {}) };
    return [...timeline.slice(0, -1), merged];
  }
  const next = [...timeline, { t, a, ...(note ? { note } : {}) }];
  if (next.length <= MAX_TIMELINE_POINTS) return next;
  // Thin out: drop every other unannotated point (keep first, last and noted ones)
  return next.filter((p, i) => i === 0 || i === next.length - 1 || !!p.note || i % 2 === 0);
}

const normalizeQuote = (text: string) => text.trim().replace(/\s+/g, ' ').slice(0, 120);

export function countQuote(counts: Record<string, number>, text: string): Record<string, number> {
  const q = normalizeQuote(text);
  if (q.length < 2) return counts;
  return { ...counts, [q]: (counts[q] ?? 0) + 1 };
}

export function topQuotes(counts: Record<string, number>, limit = 5): QuoteCount[] {
  return Object.entries(counts)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Polaroid: the most embarrassing moment of the night wins
// ---------------------------------------------------------------------------

export type ShameMoment = 'caught_police' | 'passed_out' | 'puke' | 'paid_bill' | 'toilet' | 'spill' | 'end';

const SHAME_RANK: Record<ShameMoment, number> = {
  caught_police: 6,
  passed_out: 5,
  puke: 4,
  paid_bill: 3,
  toilet: 2,
  spill: 1,
  end: 0,
};

export const SHAME_CAPTIONS: Record<ShameMoment, string> = {
  caught_police: 'Đứng gãi đầu trước mặt anh CSGT, tay vẫn cầm ống thổi nồng độ cồn',
  passed_out: 'Gục mặt xuống bàn inox, má in hằn vân đĩa lạc — "Con nợ đời"',
  puke: 'Ôm gốc cây bờ kè "gọi Huệ" cầu vồng giữa đêm',
  paid_bill: 'Khoảnh khắc móc ví trả nguyên cái bill, mặt cười như mếu',
  toilet: 'Ôm bồn cầu quán vỉa hè, mắt nhắm mắt mở',
  spill: 'Tay run đổ nguyên ly bia ướt nhẹp áo ba lỗ',
  end: 'Mắt nhắm mắt mở chụp kỷ niệm cuối buổi',
};

/** Should a new moment replace the current polaroid? */
export function isMoreShameful(next: ShameMoment, current: ShameMoment | null): boolean {
  if (!current) return true;
  return SHAME_RANK[next] > SHAME_RANK[current];
}

// ---------------------------------------------------------------------------
// "Phân chia danh hiệu trong bàn"
// ---------------------------------------------------------------------------

export interface TablemateInput {
  name: string;
  playerId: string;
  avatar: string;
  isUser: boolean;
  isRemote: boolean;
  alcohol: number;
  drinks: number;
  foodEaten: number;
  escaped: boolean;
  escapeAction?: 'run_wc' | 'tie_shoelace' | 'none';
  paidBill: boolean;
}

const vnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

/**
 * Every tablemate gets exactly one title. Bill drama first (victim / ninja), then
 * the extremes (most drunk, most drinks, most food, most sober), then the crowd.
 */
export function awardTablemates(
  mates: TablemateInput[],
  opts: { billTotal: number; userLoudestDzoDb: number }
): ReceiptTablemate[] {
  const taken = new Set<number>();
  const titles = new Map<number, { title: string; note: string }>();
  const give = (i: number, title: string, note: string) => {
    if (i < 0 || taken.has(i)) return;
    taken.add(i);
    titles.set(i, { title, note });
  };
  const best = (score: (m: TablemateInput) => number, min = -Infinity) => {
    let idx = -1;
    let top = min;
    mates.forEach((m, i) => {
      if (taken.has(i)) return;
      const s = score(m);
      if (s > top) {
        top = s;
        idx = i;
      }
    });
    return idx;
  };

  mates.forEach((m, i) => {
    if (m.paidBill) give(i, 'Nạn Nhân Của Đêm', `Bị úp sọt trả ${vnd(opts.billTotal)}`);
  });
  mates.forEach((m, i) => {
    if (!m.escaped || m.paidBill) return;
    if (m.escapeAction === 'tie_shoelace') give(i, 'Thánh Buộc Dây Giày', 'Cúi buộc dây giày đúng lúc bill ra');
    else give(i, 'Ninja Độn Thổ', 'Đi toilet đúng lúc tính tiền, 8 phút chưa ra');
  });

  if (opts.userLoudestDzoDb >= 85) {
    const u = mates.findIndex((m) => m.isUser);
    give(u, 'Ca Sĩ Kẹo Kéo', `Hét rách mic ${Math.round(opts.userLoudestDzoDb)} Decibel`);
  }
  give(best((m) => m.alcohol, 60), 'Ma Men Số 1', '');
  give(best((m) => m.drinks, 0), 'Hũ Chìm Không Đáy', '');
  give(best((m) => m.foodEaten, 2), 'Dũng Sĩ Diệt Mồi', '');
  give(best((m) => -m.alcohol, -25), 'Tỉnh Táo Đáng Ngờ', '');

  return mates.map((m, i) => {
    const t = titles.get(i);
    const title = t?.title ?? 'Khán Giả Nhiệt Tình';
    let note = t?.note ?? '';
    if (!note) {
      if (title === 'Ma Men Số 1') note = `Độ cồn chạm ${Math.round(m.alcohol)}%`;
      else if (title === 'Hũ Chìm Không Đáy') note = `Nốc ${m.drinks} ly không cần mồi`;
      else if (title === 'Dũng Sĩ Diệt Mồi') note = `Càn quét ${m.foodEaten} phần mồi của bàn`;
      else if (title === 'Tỉnh Táo Đáng Ngờ') note = `Ngồi cả buổi vẫn ${Math.round(m.alcohol)}% cồn — nghi đổ lén`;
      else note = 'Vỗ tay hô "Dzô" theo phong trào';
    }
    return {
      name: m.name,
      playerId: m.playerId,
      avatar: m.avatar,
      isUser: m.isUser,
      isRemote: m.isRemote,
      alcohol: Math.round(m.alcohol),
      drinks: m.drinks,
      escaped: m.escaped,
      paidBill: m.paidBill,
      awardTitle: title,
      awardNote: note,
    };
  });
}

/** Stable id for a tablemate in the grudge book: humans by net id, NPC regulars by name. */
export const botGrudgeId = (name: string) => `bot:${name.trim().toLowerCase()}`;

/** The debtor's first glass while the creditor is at the table: 1.5x. */
export const DEBT_GLASS_MULTIPLIER = 1.5;
