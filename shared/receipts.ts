/**
 * "Sổ Nợ Gia Truyền & Bệnh Án Tửu Lượng" — one Tờ Hóa Đơn Ký Ức per night per player,
 * stored in MongoDB (`match_receipts`) and shown in the Hộ Chiếu's history book.
 *
 * Shared by the server (sanitize + lifetime stats) and the client (types, formatting).
 */

export type CommuteChoice = 'SELF_DRIVE_MOTO' | 'GRAB_VIP' | 'NONE';
export type CommuteOutcome =
  | 'HOME_SAFE'
  | 'CAUGHT_BY_TRAFFIC_POLICE'
  | 'GRAB_HOME'
  | 'LEFT_TABLE'
  /** Ngất = đầu hàng: never made it to the parking lot, carried home. */
  | 'CARRIED_HOME_PASSED_OUT';

export interface AlcoholSample {
  /** Seconds since the night started. */
  t: number;
  /** Độ Cồn 0..100. */
  a: number;
  /** What happened right here ("🚽 WC", "🍺 Ly phạt"...), drawn on the ECG. */
  note?: string;
}

export interface QuoteCount {
  text: string;
  count: number;
}

export interface ReceiptStats {
  beersChugged: number;
  secretlySpilled: number;
  toiletRuns: number;
  tacticalPukes: number;
  slippersThrown: number;
  slipperHits: number;
  cansThrown: number;
  tablesFlipped: number;
  peakAlcoholPercent: number;
  timesPassedOut: number;
  loudestDzoDb: number;
}

export interface ReceiptTablemate {
  name: string;
  /** Net player id for humans, `bot:<name>` for the NPC regulars. */
  playerId: string;
  avatar: string;
  isUser: boolean;
  isRemote: boolean;
  alcohol: number;
  drinks: number;
  escaped: boolean;
  paidBill: boolean;
  awardTitle: string;
  awardNote: string;
}

export interface ReceiptGrudge {
  targetId: string;
  targetName: string;
  since: number;
  settled: boolean;
  settledAt?: number;
}

export interface MatchReceipt {
  receiptCode: string;
  ownerId: string;
  /** The device/net id of the owner (to recognise them at a table even when signed in). */
  ownerNetId: string;
  ownerName: string;
  roomId: string;
  map: string;
  durationSec: number;
  surrenderVotesTriggered: number;
  surrenderVotesRejected: number;
  billPayerName: string;
  totalBillAmount: number;
  billShare: number;
  escapedBill: boolean;
  paidWholeBill: boolean;
  score: number;
  rankTitle: string;
  rankEmoji: string;
  commuteChoice: CommuteChoice;
  commuteOutcome: CommuteOutcome;
  finePaid: number;
  stats: ReceiptStats;
  alcoholTimeline: AlcoholSample[];
  quotes: QuoteCount[];
  mostSpammedQuote: string;
  awardTitle: string;
  funnySnapshot: string;
  funnySnapshotCaption: string;
  snapshotBurned: boolean;
  table: ReceiptTablemate[];
  grudge?: ReceiptGrudge | null;
  createdAt: number;
}

/** What the client sends when the night ends (server fills ids, code and dates). */
export type MatchReceiptInput = Omit<
  MatchReceipt,
  'receiptCode' | 'ownerId' | 'createdAt' | 'grudge' | 'snapshotBurned'
>;

export const SNAPSHOT_MAX_CHARS = 90_000;
export const BURN_SNAPSHOT_COST = 20;
export const MAX_TIMELINE_POINTS = 80;

export const MAP_LABELS: Record<string, string> = {
  sidewalk: 'Vỉa Hè Phố Đêm',
  bo_ke: 'Bờ Kè Ven Sông',
  rooftop: 'Sân Thượng Chill',
  quan_oc: 'Quán Ốc Bờ Sông',
};

// ---------------------------------------------------------------------------
// Sanitizing (server side: never trust what the client posts)
// ---------------------------------------------------------------------------

const num = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 0;
const int = (v: unknown, min: number, max: number) => Math.round(num(v, min, max));
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const bool = (v: unknown) => v === true;

const COMMUTE_CHOICES: CommuteChoice[] = ['SELF_DRIVE_MOTO', 'GRAB_VIP', 'NONE'];
const COMMUTE_OUTCOMES: CommuteOutcome[] = [
  'HOME_SAFE',
  'CAUGHT_BY_TRAFFIC_POLICE',
  'GRAB_HOME',
  'LEFT_TABLE',
  'CARRIED_HOME_PASSED_OUT',
];

export function sanitizeReceiptInput(raw: unknown): MatchReceiptInput {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (b.stats && typeof b.stats === 'object' ? b.stats : {}) as Record<string, unknown>;
  const timeline = Array.isArray(b.alcoholTimeline) ? b.alcoholTimeline : [];
  const quotes = Array.isArray(b.quotes) ? b.quotes : [];
  const table = Array.isArray(b.table) ? b.table : [];
  const snapshot = str(b.funnySnapshot, SNAPSHOT_MAX_CHARS);

  return {
    ownerNetId: str(b.ownerNetId, 64),
    ownerName: str(b.ownerName, 32) || 'Bợm Nhậu',
    roomId: str(b.roomId, 40),
    map: str(b.map, 20) || 'sidewalk',
    durationSec: int(b.durationSec, 0, 24 * 3600),
    surrenderVotesTriggered: int(b.surrenderVotesTriggered, 0, 99),
    surrenderVotesRejected: int(b.surrenderVotesRejected, 0, 99),
    billPayerName: str(b.billPayerName, 32),
    totalBillAmount: int(b.totalBillAmount, 0, 1e9),
    billShare: int(b.billShare, 0, 1e9),
    escapedBill: bool(b.escapedBill),
    paidWholeBill: bool(b.paidWholeBill),
    score: int(b.score, 0, 100000),
    rankTitle: str(b.rankTitle, 60),
    rankEmoji: str(b.rankEmoji, 8),
    commuteChoice: COMMUTE_CHOICES.includes(b.commuteChoice as CommuteChoice)
      ? (b.commuteChoice as CommuteChoice)
      : 'NONE',
    commuteOutcome: COMMUTE_OUTCOMES.includes(b.commuteOutcome as CommuteOutcome)
      ? (b.commuteOutcome as CommuteOutcome)
      : 'LEFT_TABLE',
    finePaid: int(b.finePaid, 0, 100000),
    stats: {
      beersChugged: int(s.beersChugged, 0, 999),
      secretlySpilled: int(s.secretlySpilled, 0, 999),
      toiletRuns: int(s.toiletRuns, 0, 999),
      tacticalPukes: int(s.tacticalPukes, 0, 999),
      slippersThrown: int(s.slippersThrown, 0, 999),
      slipperHits: int(s.slipperHits, 0, 999),
      cansThrown: int(s.cansThrown, 0, 999),
      tablesFlipped: int(s.tablesFlipped, 0, 999),
      peakAlcoholPercent: int(s.peakAlcoholPercent, 0, 100),
      timesPassedOut: int(s.timesPassedOut, 0, 99),
      loudestDzoDb: int(s.loudestDzoDb, 0, 140),
    },
    alcoholTimeline: timeline.slice(0, MAX_TIMELINE_POINTS).map((p) => {
      const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      const note = str(o.note, 40);
      return { t: int(o.t, 0, 24 * 3600), a: int(o.a, 0, 100), ...(note ? { note } : {}) };
    }),
    quotes: quotes
      .slice(0, 5)
      .map((q) => {
        const o = (q && typeof q === 'object' ? q : {}) as Record<string, unknown>;
        return { text: str(o.text, 120), count: int(o.count, 0, 9999) };
      })
      .filter((q) => q.text && q.count > 0),
    mostSpammedQuote: str(b.mostSpammedQuote, 120),
    awardTitle: str(b.awardTitle, 60),
    funnySnapshot: snapshot.startsWith('data:image/') ? snapshot : '',
    funnySnapshotCaption: str(b.funnySnapshotCaption, 140),
    table: table.slice(0, 12).map((m) => {
      const o = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
      return {
        name: str(o.name, 32) || '???',
        playerId: str(o.playerId, 80),
        avatar: str(o.avatar, 16),
        isUser: bool(o.isUser),
        isRemote: bool(o.isRemote),
        alcohol: int(o.alcohol, 0, 100),
        drinks: int(o.drinks, 0, 9999),
        escaped: bool(o.escaped),
        paidBill: bool(o.paidBill),
        awardTitle: str(o.awardTitle, 60),
        awardNote: str(o.awardNote, 120),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// "Hồ Sơ Đen" lifetime metrics (D/P/B: Drink / Puke / Bill)
// ---------------------------------------------------------------------------

/** One "ly" in the game ≈ a 330ml glass of bia hơi. */
export const LITERS_PER_DRINK = 0.33;

export interface LifetimeStats {
  nights: number;
  totalDrinks: number;
  liters: number;
  litersComparison: string;
  billDodgeRate: number;
  nightsEscaped: number;
  nightsPaidWhole: number;
  totalPaid: number;
  pukes: number;
  toiletRuns: number;
  timesPassedOut: number;
  tablesFlipped: number;
  slipperHits: number;
  cansThrown: number;
  spilled: number;
  timesCaughtByPolice: number;
  finesPaid: number;
  favoriteQuote: string;
  favoriteQuoteCount: number;
  peakAlcohol: number;
  bestScore: number;
}

export function litersComparison(liters: number): string {
  if (liters <= 0) return 'Chưa giọt nào — trong sạch như nước cất';
  if (liters < 1.5) return 'Đủ đổ đầy 1 chai nước suối 1,5L';
  if (liters < 5) return 'Đủ đổ đầy 1 can nhựa 5 lít';
  if (liters < 20) return 'Đủ thay 1 bình nước lọc 19L ở văn phòng';
  if (liters < 100) return 'Đủ tắm cho 1 chú chó Cỏ trong chậu nhôm';
  if (liters < 400) return 'Đủ đổ đầy 1 bồn tắm nằm';
  return 'Đủ bơm đầy 1 bể bơi phao trẻ em';
}

export function summarizeLifetime(receipts: Pick<MatchReceipt, 'stats' | 'quotes' | 'escapedBill' | 'paidWholeBill' | 'billShare' | 'commuteOutcome' | 'finePaid' | 'score'>[]): LifetimeStats {
  const quoteTotals = new Map<string, number>();
  const sum = (f: (r: (typeof receipts)[number]) => number) => receipts.reduce((acc, r) => acc + f(r), 0);
  for (const r of receipts) {
    for (const q of r.quotes ?? []) quoteTotals.set(q.text, (quoteTotals.get(q.text) ?? 0) + q.count);
  }
  let favoriteQuote = '';
  let favoriteQuoteCount = 0;
  for (const [text, count] of quoteTotals) {
    if (count > favoriteQuoteCount) {
      favoriteQuote = text;
      favoriteQuoteCount = count;
    }
  }
  const nights = receipts.length;
  const totalDrinks = sum((r) => r.stats.beersChugged);
  const liters = Math.round(totalDrinks * LITERS_PER_DRINK * 10) / 10;
  const nightsEscaped = receipts.filter((r) => r.escapedBill).length;
  return {
    nights,
    totalDrinks,
    liters,
    litersComparison: litersComparison(liters),
    billDodgeRate: nights ? Math.round((nightsEscaped / nights) * 100) : 0,
    nightsEscaped,
    nightsPaidWhole: receipts.filter((r) => r.paidWholeBill).length,
    totalPaid: sum((r) => r.billShare),
    pukes: sum((r) => r.stats.tacticalPukes),
    toiletRuns: sum((r) => r.stats.toiletRuns),
    timesPassedOut: sum((r) => r.stats.timesPassedOut),
    tablesFlipped: sum((r) => r.stats.tablesFlipped),
    slipperHits: sum((r) => r.stats.slipperHits),
    cansThrown: sum((r) => r.stats.cansThrown),
    spilled: sum((r) => r.stats.secretlySpilled),
    timesCaughtByPolice: receipts.filter((r) => r.commuteOutcome === 'CAUGHT_BY_TRAFFIC_POLICE').length,
    finesPaid: sum((r) => r.finePaid),
    favoriteQuote,
    favoriteQuoteCount,
    peakAlcohol: receipts.reduce((m, r) => Math.max(m, r.stats.peakAlcoholPercent), 0),
    bestScore: receipts.reduce((m, r) => Math.max(m, r.score), 0),
  };
}

/** How the receipt looks in the stack: proud & stamped, normal, or crumpled & stepped on. */
export function receiptMood(r: Pick<MatchReceipt, 'escapedBill' | 'paidWholeBill' | 'commuteOutcome'>): 'escaped' | 'normal' | 'crumpled' {
  if (r.paidWholeBill || r.commuteOutcome === 'CAUGHT_BY_TRAFFIC_POLICE') return 'crumpled';
  if (r.escapedBill) return 'escaped';
  return 'normal';
}

/** Tablemates the owner may pin a grudge on: whoever escaped while the owner paid. */
export function grudgeCandidates(r: Pick<MatchReceipt, 'table' | 'billShare' | 'escapedBill'>): ReceiptTablemate[] {
  if (r.escapedBill || r.billShare <= 0) return [];
  return r.table.filter((m) => !m.isUser && m.escaped);
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} phút ${s.toString().padStart(2, '0')} giây`;
}
