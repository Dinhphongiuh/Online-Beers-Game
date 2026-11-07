import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANTI_SPAM_LOCK_MESSAGE,
  DIAMOND_SPONSOR_TITLE,
  PASSED_OUT_STAMP_TEXT,
  REJECTED_STAMP_TEXT,
  SURRENDER_COOLDOWN_SECONDS,
  areAllAwakeVotesCast,
  canTriggerSurrenderVote,
  computeDrunkVoteButtonLayout,
  createInitialBottleCapVotes,
  resolveBillEscapeQTE,
  resolveSurrenderVote,
} from './surrenderVoteLogic';
import { Player } from './types';

const MOCK_PLAYERS: Player[] = [
  {
    id: 'user',
    name: 'Đại Ca Vỉa Hè',
    avatar: 'dog',
    isUser: true,
    seatIndex: 0,
    alcoholLevel: 40,
    stamina: 80,
    bladderLevel: 20,
    coins: 150,
    gems: 10,
    drinksCount: 2,
    isPassedOut: false,
    title: 'Tân Binh',
    clothing: 'tanktop_red',
    hat: 'none',
    glassType: 'beer_mug',
    faceDoodles: [],
  },
  {
    id: 'bot_phiquan',
    name: 'Phi Quân',
    avatar: 'panda',
    isUser: false,
    seatIndex: 1,
    alcoholLevel: 78,
    stamina: 60,
    bladderLevel: 40,
    coins: 120,
    gems: 10,
    drinksCount: 4,
    isPassedOut: false,
    title: 'Thánh Lầy',
    clothing: 'floral_shirt',
    hat: 'sunglasses',
    glassType: 'beer_mug',
    faceDoodles: [],
  },
  {
    id: 'bot_khoanguyen',
    name: 'Khoa Nguyễn',
    avatar: 'bear',
    isUser: false,
    seatIndex: 2,
    alcoholLevel: 65,
    stamina: 75,
    bladderLevel: 30,
    coins: 110,
    gems: 10,
    drinksCount: 3,
    isPassedOut: false,
    title: 'Gấu Nâu',
    clothing: 'tanktop_white',
    hat: 'none',
    glassType: 'beer_mug',
    faceDoodles: [],
  },
  {
    id: 'bot_baonguyen',
    name: 'Bảo Nguyễn',
    avatar: 'cat',
    isUser: false,
    seatIndex: 3,
    alcoholLevel: 100,
    stamina: 0,
    bladderLevel: 80,
    coins: 90,
    gems: 10,
    drinksCount: 6,
    isPassedOut: true,
    title: 'Sập Nguồn',
    clothing: 'gold_chain',
    hat: 'towel',
    glassType: 'beer_mug',
    faceDoodles: [],
  },
];

describe('Em Ơi Tính Tiền! (Surrender Vote Logic)', () => {
  it('enforces trigger conditions: requires >=10m elapsed OR >=1 player with >75% alcohol', () => {
    const lowAlcPlayers = MOCK_PLAYERS.map((p) => ({
      ...p,
      alcoholLevel: 45,
      isPassedOut: false,
    }));

    const blocked = canTriggerSurrenderVote({
      matchElapsedSeconds: 180,
      players: lowAlcPlayers,
      callerId: 'user',
      cooldownUntilMsByPlayer: {},
      nowMs: 1000,
    });
    assert.equal(blocked.canTrigger, false);
    assert.equal(blocked.reason, 'CONDITION_NOT_MET');

    const allowedByAlcohol = canTriggerSurrenderVote({
      matchElapsedSeconds: 120,
      players: MOCK_PLAYERS, // Phi Quân is 78% (>75%)
      callerId: 'user',
      cooldownUntilMsByPlayer: {},
      nowMs: 1000,
    });
    assert.equal(allowedByAlcohol.canTrigger, true);

    const allowedByTime = canTriggerSurrenderVote({
      matchElapsedSeconds: 605, // > 10 minutes
      players: lowAlcPlayers,
      callerId: 'user',
      cooldownUntilMsByPlayer: {},
      nowMs: 1000,
    });
    assert.equal(allowedByTime.canTrigger, true);
  });

  it('enforces 2-minute anti-spam cooldown lock with "Bàn đang sung, cấm bàn lùi!"', () => {
    const nowMs = 50_000;
    const cooldownUntilMsByPlayer = {
      user: nowMs + 95_000,
    };
    const res = canTriggerSurrenderVote({
      matchElapsedSeconds: 700,
      players: MOCK_PLAYERS,
      callerId: 'user',
      cooldownUntilMsByPlayer,
      nowMs,
    });
    assert.equal(res.canTrigger, false);
    assert.equal(res.reason, 'COOLDOWN_LOCKED');
    assert.equal(res.cooldownRemainingSeconds, 95);
    assert.ok(res.message?.includes(ANTI_SPAM_LOCK_MESSAGE));
  });

  it('stamps passed-out players (>=100% alcohol) automatically and excludes them from active vote count', () => {
    const entries = createInitialBottleCapVotes(MOCK_PLAYERS, 'user', true);
    const baoEntry = entries.find((e) => e.playerId === 'bot_baonguyen');
    assert.ok(baoEntry);
    assert.equal(baoEntry.status, 'passed_out');
    assert.equal(baoEntry.autoChatLine, PASSED_OUT_STAMP_TEXT);
    assert.equal(areAllAwakeVotesCast(entries), false);
  });

  it('Scenario 1: rejects surrender when "Tao Chưa Say!" (No) >= "Thôi Về Nghỉ" (Yes) including ties', () => {
    const entries = createInitialBottleCapVotes(MOCK_PLAYERS, 'user', true);
    // Awake players: user ('yes'), bot_phiquan ('no'), bot_khoanguyen ('no'). Bao is 'passed_out'.
    const updated = entries.map((e) =>
      e.playerId === 'bot_phiquan' || e.playerId === 'bot_khoanguyen'
        ? { ...e, status: 'no' as const }
        : e
    );
    assert.equal(areAllAwakeVotesCast(updated), true);

    const resolution = resolveSurrenderVote({
      entries: updated,
      callerId: 'user',
      callerName: 'Đại Ca Vỉa Hè',
      existingPenaltyCrates: 0,
    });

    assert.equal(resolution.outcome, 'REJECTED');
    assert.equal(resolution.yesCount, 1);
    assert.equal(resolution.noCount, 2);
    assert.equal(resolution.passedOutCount, 1);
    assert.equal(resolution.cooldownDurationSeconds, SURRENDER_COOLDOWN_SECONDS);
    assert.equal(resolution.headline, REJECTED_STAMP_TEXT);
    assert.equal(resolution.newDifficultyMultiplier, 1.25);
  });

  it('Scenario 1 tie-breaker: 2 Yes vs 2 No still results in REJECTED ("BÁC BỎ! NHẬU TIẾP!")', () => {
    const fourAwake = MOCK_PLAYERS.map((p) => ({
      ...p,
      alcoholLevel: 70,
      isPassedOut: false,
    }));
    const entries = createInitialBottleCapVotes(fourAwake, 'user', true).map(
      (e, idx) => ({
        ...e,
        status: (idx < 2 ? 'yes' : 'no') as 'yes' | 'no',
      })
    );

    const resolution = resolveSurrenderVote({
      entries,
      callerId: 'user',
      callerName: 'Đại Ca Vỉa Hè',
      existingPenaltyCrates: 1,
    });

    assert.equal(resolution.outcome, 'REJECTED');
    assert.equal(resolution.yesCount, 2);
    assert.equal(resolution.noCount, 2);
    assert.equal(resolution.newDifficultyMultiplier, 1.5);
  });

  it('Scenario 2: approves surrender when "Thôi Về Nghỉ" (Yes) > "Tao Chưa Say!" (No) among awake voters', () => {
    // 3 awake players + 1 passed-out player: 2 vote Yes, 1 votes No -> strict majority of awake voters!
    const entries = createInitialBottleCapVotes(MOCK_PLAYERS, 'user', true).map(
      (e) => {
        if (e.playerId === 'bot_phiquan') return { ...e, status: 'yes' as const };
        if (e.playerId === 'bot_khoanguyen') return { ...e, status: 'no' as const };
        return e;
      }
    );

    const resolution = resolveSurrenderVote({
      entries,
      callerId: 'user',
      callerName: 'Đại Ca Vỉa Hè',
      existingPenaltyCrates: 0,
    });

    assert.equal(resolution.outcome, 'APPROVED_QTE');
    assert.equal(resolution.yesCount, 2);
    assert.equal(resolution.noCount, 1);
    assert.equal(resolution.passedOutCount, 1);
  });

  it('Edge case "Tay Nhanh Hơn Não": swaps & swims buttons only when alcoholLevel > 85%', () => {
    const soberLayout = computeDrunkVoteButtonLayout(80, 1);
    assert.equal(soberLayout.isDrunkSwimming, false);
    assert.equal(soberLayout.areButtonsSwapped, false);

    const drunkTick1 = computeDrunkVoteButtonLayout(90, 1);
    const drunkTick2 = computeDrunkVoteButtonLayout(90, 2);
    assert.equal(drunkTick1.isDrunkSwimming, true);
    assert.equal(drunkTick1.areButtonsSwapped, true);
    assert.equal(drunkTick2.areButtonsSwapped, false);
  });

  it('Finale QTE "Cuộc Chiến Giành/Trốn Hóa Đơn": crowns passed-out or slowest player as Nhà Tài Trợ Kim Cương', () => {
    // When Bảo Nguyễn is passed out (100% alcohol), he gets hit by the flying receipt
    const qteWithPassedOut = resolveBillEscapeQTE({
      players: MOCK_PLAYERS,
      userEscapeClicks: 9,
      userEscapeAction: 'run_wc',
    });
    assert.equal(qteWithPassedOut.victim.playerId, 'bot_baonguyen');
    assert.equal(qteWithPassedOut.awardedTitle, DIAMOND_SPONSOR_TITLE);

    // When everyone is awake and user clicks 0 times, user becomes the Diamond Sponsor victim
    const awakePlayers = MOCK_PLAYERS.map((p) => ({
      ...p,
      alcoholLevel: 50,
      isPassedOut: false,
    }));
    const qteSlowUser = resolveBillEscapeQTE({
      players: awakePlayers,
      userEscapeClicks: 0,
      userEscapeAction: 'none',
    });
    assert.equal(qteSlowUser.victim.playerId, 'user');
    assert.equal(qteSlowUser.victim.isDiamondSponsorVictim, true);
  });
});
