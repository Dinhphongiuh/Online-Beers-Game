/**
 * "Biên Bản Cuối Buổi" — the end-of-night report. Pure logic so it can be unit tested:
 * the App collects NightStats during the match and builds the report once the user
 * gets home (or passes out / takes a Grab).
 */

export type NightEndingKind =
  | 'rode_home_safe' // tự chạy xe về, qua chốt an toàn
  | 'caught_checkpoint' // dính chốt CSGT, bị giam xe
  | 'grab_home' // gọi Grab về
  | 'left_table'; // rời bàn không qua màn chạy về

export interface NightStats {
  startedAt: number;
  drinks: number;
  peakAlcohol: number;
  timesPassedOut: number;
  slippersThrown: number;
  slipperHits: number;
  tablesFlipped: number;
  loudestDzoDb: number;
  billTotal: number;
  tableSize: number;
  /** The user ended up paying the whole bill ("Nhà Tài Trợ Kim Cương"). */
  paidWholeBill: boolean;
  /** The user escaped the bill in the QTE. */
  escapedBill: boolean;
}

export interface NightEnding {
  kind: NightEndingKind;
  headline: string;
  breathalyzerText?: string | null;
  coinsDelta: number;
}

export interface TablemateResult {
  name: string;
  alcohol: number;
  isUser: boolean;
  isRemote: boolean;
}

export interface NightReport {
  durationMinutes: number;
  stats: NightStats;
  ending: NightEnding;
  billShare: number;
  score: number;
  rankTitle: string;
  rankEmoji: string;
  highlights: string[];
  coinsReward: number;
  tableRanking: TablemateResult[];
  createdAt: number;
}

export function createNightStats(now: number, tableSize: number): NightStats {
  return {
    startedAt: now,
    drinks: 0,
    peakAlcohol: 0,
    timesPassedOut: 0,
    slippersThrown: 0,
    slipperHits: 0,
    tablesFlipped: 0,
    loudestDzoDb: 0,
    billTotal: 0,
    tableSize: Math.max(1, tableSize),
    paidWholeBill: false,
    escapedBill: false,
  };
}

const RANKS: { min: number; title: string; emoji: string }[] = [
  { min: 420, title: 'Huyền Thoại Bờ Kè', emoji: '👑' },
  { min: 300, title: 'Tửu Thánh Vỉa Hè', emoji: '🏆' },
  { min: 200, title: 'Bợm Nhậu Chính Hiệu', emoji: '🍺' },
  { min: 110, title: 'Dân Chơi Tăng 1', emoji: '🍻' },
  { min: 0, title: 'Tấm Chiếu Mới', emoji: '🥤' },
];

export function rankForScore(score: number) {
  return RANKS.find((r) => score >= r.min) ?? RANKS[RANKS.length - 1];
}

export function scoreNight(stats: NightStats, ending: NightEnding): number {
  let score =
    stats.drinks * 12 +
    Math.round(stats.peakAlcohol * 1.2) +
    stats.slipperHits * 15 +
    stats.slippersThrown * 2 +
    stats.tablesFlipped * 10 +
    Math.max(0, stats.loudestDzoDb - 70);
  if (stats.paidWholeBill) score += 40; // hào phóng bất đắc dĩ
  if (stats.escapedBill) score += 25;
  score -= stats.timesPassedOut * 20;
  switch (ending.kind) {
    case 'rode_home_safe':
      score += 30;
      break;
    case 'grab_home':
      score += 45; // uống rồi không lái: điểm thưởng ý thức
      break;
    case 'caught_checkpoint':
      score -= 60;
      break;
    case 'left_table':
      break;
  }
  return Math.max(0, Math.round(score));
}

export function buildNightReport(
  stats: NightStats,
  ending: NightEnding,
  tablemates: TablemateResult[],
  now: number
): NightReport {
  const durationMinutes = Math.max(1, Math.round((now - stats.startedAt) / 60000));
  const score = scoreNight(stats, ending);
  const rank = rankForScore(score);
  const billShare = stats.paidWholeBill
    ? stats.billTotal
    : stats.escapedBill
    ? 0
    : Math.round(stats.billTotal / Math.max(1, stats.tableSize) / 1000) * 1000;

  const highlights: string[] = [];
  if (stats.drinks > 0) highlights.push(`🍺 Làm ${stats.drinks} ly, đỉnh điểm ${Math.round(stats.peakAlcohol)}% cồn`);
  if (stats.timesPassedOut > 0) highlights.push(`💤 Gục ngã ${stats.timesPassedOut} lần tại bàn`);
  if (stats.slippersThrown > 0)
    highlights.push(`🩴 Phi ${stats.slippersThrown} chiếc dép, trúng đầu ${stats.slipperHits} phát`);
  if (stats.tablesFlipped > 0) highlights.push(`💥 Lật bàn inox ${stats.tablesFlipped} lần`);
  if (stats.loudestDzoDb > 0) highlights.push(`📣 Hét "DZÔ" to nhất ${Math.round(stats.loudestDzoDb)} dB`);
  if (stats.paidWholeBill) highlights.push('💎 Một mình gánh cả hóa đơn — Nhà Tài Trợ Kim Cương');
  if (stats.escapedBill) highlights.push('🏃 Trốn bill thành công, không mất đồng nào');
  if (ending.kind === 'caught_checkpoint') highlights.push('🚨 Dính chốt CSGT, xe vào đồn ngủ');
  if (ending.kind === 'grab_home') highlights.push('🚕 Uống rồi không lái — gọi Grab về an toàn');
  if (!highlights.length) highlights.push('🥤 Một buổi nhậu nhẹ nhàng, tỉnh táo ra về');

  const tableRanking = [...tablemates].sort((a, b) => b.alcohol - a.alcohol);
  const coinsReward = Math.max(0, Math.round(score / 10) * 5);

  return {
    durationMinutes,
    stats,
    ending,
    billShare,
    score,
    rankTitle: rank.title,
    rankEmoji: rank.emoji,
    highlights,
    coinsReward,
    tableRanking,
    createdAt: now,
  };
}
