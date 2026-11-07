import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNightReport, createNightStats, rankForScore, scoreNight } from './nightReportLogic';

const T0 = 1_800_000_000_000;

test('a heavy safe night outranks the same night caught at the checkpoint', () => {
  const stats = { ...createNightStats(T0, 4), drinks: 12, peakAlcohol: 92, loudestDzoDb: 101, billTotal: 800000 };
  const safe = scoreNight(stats, { kind: 'rode_home_safe', headline: '', coinsDelta: 0 });
  const caught = scoreNight(stats, { kind: 'caught_checkpoint', headline: '', coinsDelta: 0 });
  assert.equal(safe - caught, 90);
});

test('Grab home earns more than riding home drunk', () => {
  const stats = { ...createNightStats(T0, 2), drinks: 5, peakAlcohol: 70 };
  assert.ok(
    scoreNight(stats, { kind: 'grab_home', headline: '', coinsDelta: 0 }) >
      scoreNight(stats, { kind: 'rode_home_safe', headline: '', coinsDelta: 0 })
  );
});

test('bill share: split evenly, whole bill for the victim, nothing when escaped', () => {
  const base = { ...createNightStats(T0, 4), billTotal: 1_000_000 };
  const ending = { kind: 'left_table' as const, headline: '', coinsDelta: 0 };
  assert.equal(buildNightReport(base, ending, [], T0 + 60000).billShare, 250000);
  assert.equal(buildNightReport({ ...base, paidWholeBill: true }, ending, [], T0).billShare, 1_000_000);
  assert.equal(buildNightReport({ ...base, escapedBill: true }, ending, [], T0).billShare, 0);
});

test('report ranks the table by alcohol and lists highlights', () => {
  const stats = { ...createNightStats(T0, 3), drinks: 3, peakAlcohol: 60, slippersThrown: 2, slipperHits: 1 };
  const r = buildNightReport(
    stats,
    { kind: 'rode_home_safe', headline: 'Về tới nhà', coinsDelta: 0 },
    [
      { name: 'A', alcohol: 40, isUser: true, isRemote: false },
      { name: 'B', alcohol: 95, isUser: false, isRemote: true },
      { name: 'C', alcohol: 70, isUser: false, isRemote: false },
    ],
    T0 + 45 * 60000
  );
  assert.deepEqual(r.tableRanking.map((p) => p.name), ['B', 'C', 'A']);
  assert.equal(r.durationMinutes, 45);
  assert.ok(r.highlights.some((h) => h.includes('trúng đầu 1')));
  assert.equal(r.rankTitle, rankForScore(r.score).title);
});

test('a quiet night still gets a highlight and never a negative score', () => {
  const r = buildNightReport(
    { ...createNightStats(T0, 1), timesPassedOut: 5 },
    { kind: 'caught_checkpoint', headline: '', coinsDelta: 0 },
    [],
    T0
  );
  assert.equal(r.score, 0);
  assert.ok(r.highlights.length > 0);
  assert.equal(r.rankTitle, 'Tấm Chiếu Mới');
});
