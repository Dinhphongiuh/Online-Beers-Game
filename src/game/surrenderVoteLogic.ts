import { Player } from './types';

export type BottleCapVoteStatus = 'pending' | 'yes' | 'no' | 'passed_out';

export interface BottleCapVoteEntry {
  playerId: string;
  playerName: string;
  avatar: Player['avatar'];
  isUser: boolean;
  alcoholLevel: number;
  status: BottleCapVoteStatus;
  autoChatLine?: string;
  isJumbledDrunkText?: boolean;
  votedAtMs?: number;
}

export type SurrenderVoteOutcome = 'PENDING' | 'REJECTED' | 'APPROVED_QTE';

export interface SurrenderTriggerCheckResult {
  canTrigger: boolean;
  reason?: 'COOLDOWN_LOCKED' | 'CONDITION_NOT_MET' | 'ALREADY_ACTIVE';
  cooldownRemainingSeconds: number;
  message?: string;
  conditionSummary: {
    matchElapsedSeconds: number;
    maxAlcoholLevel: number;
    isTimeMet: boolean;
    isAlcoholMet: boolean;
  };
}

export interface SurrenderResolutionResult {
  outcome: 'REJECTED' | 'APPROVED_QTE';
  yesCount: number;
  noCount: number;
  passedOutCount: number;
  awakeVoterCount: number;
  callerId: string;
  callerName: string;
  cooldownDurationSeconds: number;
  penaltyAlcGain: number;
  newDifficultyMultiplier: number;
  headline: string;
  subtext: string;
}

export type BillEscapeAction = 'run_wc' | 'tie_shoelace' | 'none';

export interface BillEscapeParticipantResult {
  playerId: string;
  playerName: string;
  avatar: Player['avatar'];
  isUser: boolean;
  isPassedOut: boolean;
  escapeScore: number;
  escapeAction: BillEscapeAction;
  escaped: boolean;
  isDiamondSponsorVictim: boolean;
}

export interface BillEscapeResolution {
  victim: BillEscapeParticipantResult;
  participants: BillEscapeParticipantResult[];
  awardedTitle: string;
  summaryHeadline: string;
}

export const SURRENDER_COOLDOWN_SECONDS = 120; // 2 minutes anti-spam lock
export const SURRENDER_VOTE_DURATION_SECONDS = 15; // 15s burning cigarette / draining beer foam
export const BILL_ESCAPE_QTE_DURATION_SECONDS = 5; // 5s final escape QTE
export const MIN_MATCH_SECONDS_FOR_BILL = 600; // 10 minutes
export const MIN_ALCOHOL_FOR_BILL = 75; // > 75% alcohol

export const CALL_BILL_VOICE_LINES = [
  'Chủ quán ơiiii! Cho xin cái bill!',
  'Thôi nghỉ nha anh em, mai tao phải đi làm sớm!',
] as const;

export const SURRENDER_YES_QUOTES = [
  'Thôi tính tiền đi, nóc nhà tao gọi cháy máy rồi!',
  'Đầu hàng! Dạ dày tao nộp đơn xin từ chức rồi anh em ơi...',
  'Nghỉ khỏe! Mai tao còn phải dậy sớm đi họp với sếp.',
  'Chịu thua! Nay phong độ tụt, hẹn anh em kèo sau phục thù!',
] as const;

export const SURRENDER_NO_QUOTES = [
  'Tính tiền cái gì?! Tao chưa say! Đứa nào về trước làm chó!',
  'Mới uống có mấy chai nước ngọt để tráng miệng mà đòi về à?!',
  'Mày coi thường anh em à? Chủ quán! Lên thêm 1 két ướp lạnh nữa!',
  'Bỏ cái tay gọi bill xuống! Hôm nay không say không về, ngủ luôn tại vỉa hè!',
  'Tao nói cho mày biết... tao hoàn toàn tỉnh táo nhé, nhìn 1 cái bàn thành 3 cái thôi mà!',
] as const;

export const ANTI_SPAM_LOCK_MESSAGE = 'Bàn đang sung, cấm bàn lùi!';
export const PASSED_OUT_STAMP_TEXT =
  '💤 Đã ngất - Quyền quyết định thuộc về người còn thức';
export const REJECTED_STAMP_TEXT = 'BÁC BỎ! NHẬU TIẾP!';
export const PENALTY_FULL_MUG_WARNING = 'Tội đòi về sớm: Phạt 100%!';
export const DIAMOND_SPONSOR_TITLE = 'Nhà Tài Trợ Kim Cương (Nạn Nhân Trả Bill)';

/**
 * Checks whether a player can trigger "Em Ơi Tính Tiền!" (Surrender Vote).
 * Rule 1: Match elapsed >= 10 minutes (600s) OR at least 1 player has alcoholLevel > 75%.
 * Rule 2: Anti-spam cooldown (2 minutes / 120s) after a rejected surrender vote.
 */
export function canTriggerSurrenderVote(params: {
  matchElapsedSeconds: number;
  players: Pick<Player, 'id' | 'alcoholLevel' | 'isPassedOut'>[];
  callerId: string;
  cooldownUntilMsByPlayer: Record<string, number>;
  nowMs: number;
  isVoteCurrentlyActive?: boolean;
  forceBypassCondition?: boolean;
}): SurrenderTriggerCheckResult {
  const {
    matchElapsedSeconds,
    players,
    callerId,
    cooldownUntilMsByPlayer,
    nowMs,
    isVoteCurrentlyActive = false,
    forceBypassCondition = false,
  } = params;

  const maxAlcoholLevel = players.reduce(
    (max, p) => Math.max(max, p.alcoholLevel),
    0
  );
  const isTimeMet = matchElapsedSeconds >= MIN_MATCH_SECONDS_FOR_BILL;
  const isAlcoholMet = players.some((p) => p.alcoholLevel > MIN_ALCOHOL_FOR_BILL);

  const conditionSummary = {
    matchElapsedSeconds,
    maxAlcoholLevel,
    isTimeMet,
    isAlcoholMet,
  };

  if (isVoteCurrentlyActive) {
    return {
      canTrigger: false,
      reason: 'ALREADY_ACTIVE',
      cooldownRemainingSeconds: 0,
      message: 'Đang có tờ hóa đơn bình chọn trên bàn rồi!',
      conditionSummary,
    };
  }

  const lockUntil = cooldownUntilMsByPlayer[callerId] || 0;
  if (lockUntil > nowMs) {
    const remainingSec = Math.ceil((lockUntil - nowMs) / 1000);
    return {
      canTrigger: false,
      reason: 'COOLDOWN_LOCKED',
      cooldownRemainingSeconds: remainingSec,
      message: `${ANTI_SPAM_LOCK_MESSAGE} (Khóa ${remainingSec}s)`,
      conditionSummary,
    };
  }

  if (!forceBypassCondition && !isTimeMet && !isAlcoholMet) {
    return {
      canTrigger: false,
      reason: 'CONDITION_NOT_MET',
      cooldownRemainingSeconds: 0,
      message:
        'Chưa đủ điều kiện gọi tính tiền! Cần nhậu qua 10 phút hoặc có ít nhất 1 thành viên đạt Độ Cồn > 75%.',
      conditionSummary,
    };
  }

  return {
    canTrigger: true,
    cooldownRemainingSeconds: 0,
    conditionSummary,
  };
}

/**
 * Picks a quote for Option A (Surrender / Yes) or Option B (Fight On / No).
 */
export function pickSurrenderAutoChat(
  choice: 'yes' | 'no',
  seedIndex?: number
): { text: string; isJumbledDrunkText: boolean } {
  if (choice === 'yes') {
    const idx =
      seedIndex !== undefined
        ? Math.abs(seedIndex) % SURRENDER_YES_QUOTES.length
        : Math.floor(Math.random() * SURRENDER_YES_QUOTES.length);
    return {
      text: SURRENDER_YES_QUOTES[idx],
      isJumbledDrunkText: false,
    };
  }

  const idx =
    seedIndex !== undefined
      ? Math.abs(seedIndex) % SURRENDER_NO_QUOTES.length
      : Math.floor(Math.random() * SURRENDER_NO_QUOTES.length);
  const text = SURRENDER_NO_QUOTES[idx];
  return {
    text,
    // The 5th quote ("nhìn 1 cái bàn thành 3 cái thôi mà!") explicitly has jumpy drunk text
    isJumbledDrunkText: idx === 4,
  };
}

/**
 * Creates the initial 4–8 Bottle Cap (Nắp Bia) slots for the Surrender Vote UI.
 * - Knocked-out players (isPassedOut or alcoholLevel >= 100) get stamped 'passed_out'.
 * - If the caller is a bot, the caller starts with 'yes'. If the caller is the user,
 *   we can either pre-fill 'yes' or let the user test both Option A & Option B buttons directly
 *   (or change their vote during the 15s window), while bots cast their votes dynamically.
 */
export function createInitialBottleCapVotes(
  players: Player[],
  callerId: string,
  preVoteCallerAsYes = false
): BottleCapVoteEntry[] {
  return players.map((p, idx) => {
    const knockedOut = p.isPassedOut || p.alcoholLevel >= 100;
    if (knockedOut) {
      return {
        playerId: p.id,
        playerName: p.name,
        avatar: p.avatar,
        isUser: p.isUser,
        alcoholLevel: p.alcoholLevel,
        status: 'passed_out',
        autoChatLine: PASSED_OUT_STAMP_TEXT,
      };
    }

    if (preVoteCallerAsYes && p.id === callerId) {
      const quote = pickSurrenderAutoChat('yes', idx);
      return {
        playerId: p.id,
        playerName: p.name,
        avatar: p.avatar,
        isUser: p.isUser,
        alcoholLevel: p.alcoholLevel,
        status: 'yes',
        autoChatLine: quote.text,
        isJumbledDrunkText: quote.isJumbledDrunkText,
      };
    }

    return {
      playerId: p.id,
      playerName: p.name,
      avatar: p.avatar,
      isUser: p.isUser,
      alcoholLevel: p.alcoholLevel,
      status: 'pending',
    };
  });
}

/**
 * Determines how an AI bot at the table votes on the Surrender Receipt.
 * - Passed-out bots stay 'passed_out'.
 * - Bots with very high alcohol (>= 88%) or low stamina have a higher chance of voting 'yes' ("Thôi Về Nghỉ"),
 *   whereas rowdy street-pub bots (like Khoa Nguyễn, Bảo Nguyễn, or Nga Phan 0% Coca Destroyer) love to slam the table
 *   and vote 'no' ("Tao Chưa Say!").
 */
export function decideBotSurrenderVote(
  bot: Pick<Player, 'id' | 'alcoholLevel' | 'stamina' | 'isPassedOut' | 'isColaOnlyDestroyer'>,
  biasMode: 'natural' | 'force_reject' | 'force_approve' = 'natural',
  randomVal = Math.random()
): 'yes' | 'no' | 'passed_out' {
  if (bot.isPassedOut || bot.alcoholLevel >= 100) {
    return 'passed_out';
  }
  if (biasMode === 'force_reject') return 'no';
  if (biasMode === 'force_approve') return 'yes';

  // Nga Phan drinks Coca (0% alcohol) and wants to keep eating snacks all night!
  if (bot.isColaOnlyDestroyer || bot.id === 'bot_ngaphan') {
    return randomVal < 0.78 ? 'no' : 'yes';
  }
  // If bot is very drunk (> 85%), more likely to surrender and go home to wife
  if (bot.alcoholLevel > 85) {
    return randomVal < 0.65 ? 'yes' : 'no';
  }
  // Rowdy friends default to "Tao Chưa Say!" ~60% of the time
  return randomVal < 0.6 ? 'no' : 'yes';
}

/**
 * Checks whether all awake (non-passed-out) players have cast their vote.
 */
export function areAllAwakeVotesCast(entries: BottleCapVoteEntry[]): boolean {
  const awakeEntries = entries.filter((e) => e.status !== 'passed_out');
  if (awakeEntries.length === 0) return true;
  return awakeEntries.every((e) => e.status === 'yes' || e.status === 'no');
}

/**
 * Resolves the Surrender Vote after 15s (or once everyone awake has voted):
 * - Scenario 1: "Tao Chưa Say!" (No) >= "Thôi Về Nghỉ" (Yes) (More or Tie):
 *   -> Outcome: 'REJECTED' ("BÁC BỎ! NHẬU TIẾP!").
 *   -> Caller gets 100% penalty beer mug + 120s cooldown lock + a new beer crate drops from the sky!
 * - Scenario 2: "Thôi Về Nghỉ" (Yes) > "Tao Chưa Say!" (No) (Strict Majority of awake players):
 *   -> Outcome: 'APPROVED_QTE' -> triggers the 5s "Cuộc Chiến Giành/Trốn Hóa Đơn" QTE!
 * Note: Any 'pending' awake voter when the 15s timer expires defaults to 'no' (too busy drinking to leave)
 * UNLESS their alcoholLevel >= 100 (which is 'passed_out').
 */
export function resolveSurrenderVote(params: {
  entries: BottleCapVoteEntry[];
  callerId: string;
  callerName: string;
  existingPenaltyCrates: number;
}): SurrenderResolutionResult {
  const { entries, callerId, callerName, existingPenaltyCrates } = params;

  let yesCount = 0;
  let noCount = 0;
  let passedOutCount = 0;

  for (const entry of entries) {
    if (entry.status === 'passed_out' || entry.alcoholLevel >= 100) {
      passedOutCount += 1;
    } else if (entry.status === 'yes') {
      yesCount += 1;
    } else if (entry.status === 'no') {
      noCount += 1;
    } else {
      // Unvoted awake slot after 15s defaults to 'no' ("Im lặng là nhậu tiếp!")
      noCount += 1;
    }
  }

  const awakeVoterCount = yesCount + noCount;
  const isApproved = awakeVoterCount > 0 && yesCount > noCount;

  if (!isApproved) {
    const nextCrates = existingPenaltyCrates + 1;
    const newDifficultyMultiplier = Number((1 + nextCrates * 0.25).toFixed(2));
    return {
      outcome: 'REJECTED',
      yesCount,
      noCount,
      passedOutCount,
      awakeVoterCount,
      callerId,
      callerName,
      cooldownDurationSeconds: SURRENDER_COOLDOWN_SECONDS,
      penaltyAlcGain: 18,
      newDifficultyMultiplier,
      headline: REJECTED_STAMP_TEXT,
      subtext: `${callerName} bị cả bàn la ó phạt 1 Ly Bia Đầy Tràn 100% ("${PENALTY_FULL_MUG_WARNING}") + Chủ quán quăng thêm 1 két bia mới xuống đất (Độ khó x${newDifficultyMultiplier})!`,
    };
  }

  return {
    outcome: 'APPROVED_QTE',
    yesCount,
    noCount,
    passedOutCount,
    awakeVoterCount,
    callerId,
    callerName,
    cooldownDurationSeconds: 0,
    penaltyAlcGain: 0,
    newDifficultyMultiplier: Number((1 + existingPenaltyCrates * 0.25).toFixed(2)),
    headline: 'ĐỒNG Ý TÍNH TIỀN! CHỦ QUÁN MANG BILL RA!',
    subtext:
      '5 GIÂY CUỐI: Mau bấm [🏃 Đi Vệ Sinh] hoặc [👟 Buộc Dây Giày] để trốn tờ hóa đơn! Ai chậm tay nhất hoặc đã gục 100% sẽ làm Nhà Tài Trợ Kim Cương!',
  };
}

/**
 * Special Edge Case 1: "Tay Nhanh Hơn Não" (Drunk Misclick).
 * When user's alcoholLevel > 85%, the two vote buttons ([🏳️ Thôi Về Nghỉ] and [🍺 Tao Chưa Say!])
 * swim around and swap their left/right positions periodically so drunk players misclick!
 */
export function computeDrunkVoteButtonLayout(
  alcoholLevel: number,
  tickStep: number
): {
  isDrunkSwimming: boolean;
  areButtonsSwapped: boolean;
  offsetYesX: number;
  offsetYesY: number;
  offsetNoX: number;
  offsetNoY: number;
} {
  if (alcoholLevel <= 85) {
    return {
      isDrunkSwimming: false,
      areButtonsSwapped: false,
      offsetYesX: 0,
      offsetYesY: 0,
      offsetNoX: 0,
      offsetNoY: 0,
    };
  }

  const intensity = Math.min(1.5, (alcoholLevel - 80) / 15);
  // Swap left/right order on odd ticks so the buttons physically trade places!
  const areButtonsSwapped = tickStep % 2 === 1;
  const offsetYesX = Math.round(Math.sin(tickStep * 1.7) * 14 * intensity);
  const offsetYesY = Math.round(Math.cos(tickStep * 2.3) * 8 * intensity);
  const offsetNoX = Math.round(Math.cos(tickStep * 1.9) * -14 * intensity);
  const offsetNoY = Math.round(Math.sin(tickStep * 2.1) * -8 * intensity);

  return {
    isDrunkSwimming: true,
    areButtonsSwapped,
    offsetYesX,
    offsetYesY,
    offsetNoX,
    offsetNoY,
  };
}

/**
 * Resolves the 5-second QTE "Cuộc Chiến Giành/Trốn Hóa Đơn" when a Surrender Vote passes.
 * - Anyone passed out (100% alcohol) has 0 escape speed and is a prime target for the flying bill.
 * - Otherwise, the slowest reactor among the table gets hit in the face by the flying receipt
 *   and receives the title "Nhà Tài Trợ Kim Cương (Nạn Nhân Trả Bill)".
 */
export function resolveBillEscapeQTE(params: {
  players: Player[];
  userEscapeClicks: number;
  userEscapeAction: BillEscapeAction;
  botScoresByPlayerId?: Record<string, { score: number; action: BillEscapeAction }>;
}): BillEscapeResolution {
  const {
    players,
    userEscapeClicks,
    userEscapeAction,
    botScoresByPlayerId = {},
  } = params;

  const participants: BillEscapeParticipantResult[] = players.map((p, idx) => {
    const knockedOut = p.isPassedOut || p.alcoholLevel >= 100;
    if (knockedOut) {
      return {
        playerId: p.id,
        playerName: p.name,
        avatar: p.avatar,
        isUser: p.isUser,
        isPassedOut: true,
        escapeScore: -10 - idx, // Knocked-out on the table -> guaranteed slowest!
        escapeAction: 'none',
        escaped: false,
        isDiamondSponsorVictim: false,
      };
    }

    if (p.isUser) {
      return {
        playerId: p.id,
        playerName: p.name,
        avatar: p.avatar,
        isUser: true,
        isPassedOut: false,
        escapeScore: userEscapeClicks,
        escapeAction: userEscapeClicks > 0 ? userEscapeAction : 'none',
        escaped: true,
        isDiamondSponsorVictim: false,
      };
    }

    const customBot = botScoresByPlayerId[p.id];
    const sobrietyFactor = Math.max(1, Math.round((100 - p.alcoholLevel) / 15));
    const defaultScore = customBot
      ? customBot.score
      : Math.max(2, Math.min(12, sobrietyFactor + ((idx * 3) % 5)));
    const defaultAction: BillEscapeAction = customBot
      ? customBot.action
      : idx % 2 === 0
      ? 'run_wc'
      : 'tie_shoelace';

    return {
      playerId: p.id,
      playerName: p.name,
      avatar: p.avatar,
      isUser: false,
      isPassedOut: false,
      escapeScore: defaultScore,
      escapeAction: defaultAction,
      escaped: true,
      isDiamondSponsorVictim: false,
    };
  });

  // Sort ascending by escapeScore to find the slowest / knocked-out victim
  const sorted = [...participants].sort((a, b) => a.escapeScore - b.escapeScore);
  const victimId = sorted[0]?.playerId || participants[0]?.playerId;

  const finalized = participants.map((part) => {
    const isVictim = part.playerId === victimId;
    return {
      ...part,
      escaped: !isVictim && !part.isPassedOut,
      isDiamondSponsorVictim: isVictim,
    };
  });

  const victim =
    finalized.find((p) => p.isDiamondSponsorVictim) || finalized[0];

  const reasonText = victim.isPassedOut
    ? `đang gục sập nguồn 100% trên bàn nên bị tờ hóa đơn bay thẳng vào mặt`
    : `chậm tay nhất bàn (${victim.escapeScore} lần bấm né)`;

  return {
    victim,
    participants: finalized,
    awardedTitle: DIAMOND_SPONSOR_TITLE,
    summaryHeadline: `💎 ${victim.playerName} ${reasonText} và chính thức nhận danh hiệu "${DIAMOND_SPONSOR_TITLE}"!`,
  };
}
