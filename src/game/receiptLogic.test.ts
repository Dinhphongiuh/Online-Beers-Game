import test from 'node:test';
import assert from 'node:assert/strict';
import {
  awardTablemates,
  countQuote,
  isMoreShameful,
  pushAlcoholSample,
  topQuotes,
  type TablemateInput,
} from './receiptLogic';
import {
  grudgeCandidates,
  litersComparison,
  receiptMood,
  sanitizeReceiptInput,
  summarizeLifetime,
  MAX_TIMELINE_POINTS,
} from '../../shared/receipts';

test('ECG keeps notes, skips flat duplicates and stays bounded', () => {
  let tl = pushAlcoholSample([], 0, 0);
  tl = pushAlcoholSample(tl, 10, 1); // flat, skipped
  assert.equal(tl.length, 1);
  tl = pushAlcoholSample(tl, 20, 1, '🚽 WC'); // noted: kept
  assert.equal(tl.length, 2);
  for (let i = 0; i < 300; i++) tl = pushAlcoholSample(tl, 30 + i * 61, i % 100);
  assert.ok(tl.length <= MAX_TIMELINE_POINTS);
  assert.ok(tl.some((p) => p.note === '🚽 WC'));
});

test('two events in the same second keep both notes', () => {
  let tl = pushAlcoholSample([], 100, 60, '🚔 Dính chốt');
  tl = pushAlcoholSample(tl, 100, 60, '🏁 Tàn tiệc');
  assert.equal(tl.length, 1);
  assert.equal(tl[0].note, '🚔 Dính chốt · 🏁 Tàn tiệc');
});

test('most spammed quote wins', () => {
  let c: Record<string, number> = {};
  for (const q of ['Tao chưa say!', 'dzô', 'Tao  chưa say!', 'Tao chưa say!']) c = countQuote(c, q);
  assert.deepEqual(topQuotes(c)[0], { text: 'Tao chưa say!', count: 3 });
});

test('getting caught by CSGT beats every other embarrassing photo', () => {
  assert.ok(isMoreShameful('caught_police', 'passed_out'));
  assert.ok(!isMoreShameful('toilet', 'puke'));
  assert.ok(isMoreShameful('end', null));
});

const mate = (o: Partial<TablemateInput>): TablemateInput => ({
  name: 'X',
  playerId: 'x',
  avatar: 'dog',
  isUser: false,
  isRemote: false,
  alcohol: 40,
  drinks: 3,
  foodEaten: 0,
  escaped: false,
  paidBill: false,
  ...o,
});

test('bill victim and ninja get their titles first, everyone gets one', () => {
  const r = awardTablemates(
    [
      mate({ name: 'Bạn', isUser: true, paidBill: true, alcohol: 99 }),
      mate({ name: 'Tèo', escaped: true, escapeAction: 'run_wc' }),
      mate({ name: 'Gấu', foodEaten: 9, alcohol: 70 }),
      mate({ name: 'Vịt', alcohol: 10 }),
    ],
    { billTotal: 1_450_000, userLoudestDzoDb: 0 }
  );
  assert.equal(r[0].awardTitle, 'Nạn Nhân Của Đêm');
  assert.match(r[0].awardNote, /1\.450\.000đ/);
  assert.equal(r[1].awardTitle, 'Ninja Độn Thổ');
  assert.equal(r[2].awardTitle, 'Ma Men Số 1');
  assert.ok(r.every((m) => m.awardTitle));
});

test('lifetime D/P/B stats add up and pick the favourite quote', () => {
  const base = sanitizeReceiptInput({});
  const life = summarizeLifetime([
    { ...base, stats: { ...base.stats, beersChugged: 10, tacticalPukes: 1 }, escapedBill: true, quotes: [{ text: 'Tao chưa say!', count: 5 }] },
    { ...base, stats: { ...base.stats, beersChugged: 5 }, commuteOutcome: 'CAUGHT_BY_TRAFFIC_POLICE', finePaid: 500, quotes: [{ text: 'Dzô', count: 2 }, { text: 'Tao chưa say!', count: 1 }] },
  ]);
  assert.equal(life.nights, 2);
  assert.equal(life.totalDrinks, 15);
  assert.equal(life.billDodgeRate, 50);
  assert.equal(life.timesCaughtByPolice, 1);
  assert.equal(life.finesPaid, 500);
  assert.equal(life.favoriteQuote, 'Tao chưa say!');
  assert.equal(life.favoriteQuoteCount, 6);
  assert.match(litersComparison(420), /bể bơi/);
});

test('sanitizer rejects junk and non-image snapshots', () => {
  const r = sanitizeReceiptInput({
    durationSec: -5,
    commuteOutcome: 'TELEPORT',
    funnySnapshot: 'javascript:alert(1)',
    stats: { beersChugged: 1e9 },
    table: [{ name: 'A', escaped: true }],
  });
  assert.equal(r.durationSec, 0);
  assert.equal(r.commuteOutcome, 'LEFT_TABLE');
  assert.equal(r.funnySnapshot, '');
  assert.equal(r.stats.beersChugged, 999);
  assert.equal(r.table[0].escaped, true);
});

test('only escapers can be pinned to the grudge book, and only when you paid', () => {
  const base = sanitizeReceiptInput({ billShare: 300000, table: [{ name: 'Me', isUser: true }, { name: 'Tèo', escaped: true }, { name: 'Gấu' }] });
  assert.deepEqual(grudgeCandidates(base).map((m) => m.name), ['Tèo']);
  assert.equal(grudgeCandidates({ ...base, escapedBill: true }).length, 0);
  assert.equal(receiptMood({ ...base, paidWholeBill: true }), 'crumpled');
  assert.equal(receiptMood({ ...base, escapedBill: true }), 'escaped');
});
