/**
 * Pure game logic for "Lộ Trình Di Chuyển: Đi Tỉnh Về Quắc" (Pre & Post-Match Commute Loop)
 * Ở Nhà ➔ Ra Quán ➔ Nhậu Tới Bến ➔ Đường Về Giông Bão
 * Decoupled from DOM, WebGL, and audio so it can be unit-tested via node:test.
 */

export type BikeSkinId = 'dream_chien' | 'wave_do_po' | 'cub_50';

export interface BikeSkinSpec {
  id: BikeSkinId;
  name: string;
  subtitle: string;
  maxSpeedKmh: number;
  kickstartPressesRequired: number;
  accentColor: string;
  exhaustSoundText: string;
}

export const BIKE_SKINS: Record<BikeSkinId, BikeSkinSpec> = {
  dream_chien: {
    id: 'dream_chien',
    name: 'Dream Chiến Thái 1998',
    subtitle: 'Huyền thoại bô nổ giòn tan, đề 3 cái khói trắng mù mịt',
    maxSpeedKmh: 68,
    kickstartPressesRequired: 3,
    accentColor: '#b91c1c',
    exhaustSoundText: 'Khặc khặc... Bành bành bành!',
  },
  wave_do_po: {
    id: 'wave_do_po',
    name: 'Wave Alpha Độ Pô Tăng',
    subtitle: 'Tem lửa vỉa hè, vặn ga là bốc đầu, gương rung bần bật',
    maxSpeedKmh: 76,
    kickstartPressesRequired: 2,
    accentColor: '#0284c7',
    exhaustSoundText: 'Khặc... Bôp bôp RÈN RÈN!',
  },
  cub_50: {
    id: 'cub_50',
    name: 'Super Cub 50 Đèn Tròn',
    subtitle: 'Xe cổ đời ông ngoại, phải đạp cần khởi động 3 phát mới nổ',
    maxSpeedKmh: 54,
    kickstartPressesRequired: 3,
    accentColor: '#15803d',
    exhaustSoundText: 'Khặc khặc khặc... Pạch pạch pạch!',
  },
};

export type CommuteTransportMode = 'self_bike' | 'grab_vip';

export type ReturnCommuteOption =
  | 'grab_vip_return'
  | 'drunk_self_drive'
  | 'walk_overnight_parking'
  | 'beg_guard_push_past_checkpoint';

export const GRAB_VIP_COST_COINS = 50;
export const OVERNIGHT_PARKING_COST_COINS = 30;
export const GUARD_ASSIST_TIP_COINS = 20;
export const POLICE_CHECKPOINT_FINE_COINS = 500;
export const PUB_SIGN_CRASH_BILL_PENALTY_VND = 50000;
export const DAN_TO_BONUS_POINTS = 35;
export const IMPOUND_DURATION_MATCHES = 2;
export const ALLEY_TOTAL_DISTANCE_METERS = 250;
export const POLICE_CHECKPOINT_DISTANCE_FROM_HOME_METERS = 20;

export const IMPOUNDED_BIKE_TAG_TEMPLATE = (matchesLeft: number) =>
  `[🔒 Đang bị giam ở đồn - Còn ${matchesLeft} trận nữa mới được chuộc]`;

export const EXEMPLARY_TAXPAYER_TITLE = 'Công Dân Nộp Ngân Sách Tiêu Biểu';
export const BREATHALYZER_MAX_READING_TEXT =
  'Kịch Khung: 999 mg/L khí thở (Phát hiện máu trong cồn!)';

export interface AlleyObstacle {
  id: string;
  type: 'fishball_cart' | 'sleeping_dog' | 'trash_can' | 'utility_pole';
  label: string;
  icon: string;
  distanceMeters: number; // 0 to 250m
  laneOffset: number; // -1 (left) to +1 (right)
  hitRadius: number;
}

export const OUTBOUND_ALLEY_OBSTACLES: AlleyObstacle[] = [
  {
    id: 'obs_dog_1',
    type: 'sleeping_dog',
    label: 'Chó cỏ đang nằm ngủ giữa hẻm',
    icon: '🐕💤',
    distanceMeters: 65,
    laneOffset: -0.2,
    hitRadius: 0.34,
  },
  {
    id: 'obs_cart_1',
    type: 'fishball_cart',
    label: 'Xe đẩy bán cá viên chiên bốc khói',
    icon: '🍡🔥',
    distanceMeters: 130,
    laneOffset: 0.32,
    hitRadius: 0.38,
  },
  {
    id: 'obs_dog_2',
    type: 'sleeping_dog',
    label: 'Cậu Vàng nằm phơi bụng đầu ngã tư',
    icon: '🐕',
    distanceMeters: 190,
    laneOffset: -0.35,
    hitRadius: 0.34,
  },
];

export const RETURN_DRUNK_OBSTACLES: AlleyObstacle[] = [
  {
    id: 'ret_trash_1',
    type: 'trash_can',
    label: 'Thùng rác nhựa xanh ven đường',
    icon: '🗑️',
    distanceMeters: 60,
    laneOffset: -0.38,
    hitRadius: 0.36,
  },
  {
    id: 'ret_pole_1',
    type: 'utility_pole',
    label: 'Cột điện bê tông chằng chịt dây cáp',
    icon: '🗼⚡',
    distanceMeters: 125,
    laneOffset: 0.36,
    hitRadius: 0.36,
  },
  {
    id: 'ret_cart_2',
    type: 'fishball_cart',
    label: 'Xe cá viên chiên dọn hàng khuya',
    icon: '🍡🛒',
    distanceMeters: 185,
    laneOffset: -0.15,
    hitRadius: 0.38,
  },
];

export interface SpawnCommuteChoiceInput {
  mode: CommuteTransportMode;
  selectedBikeSkin: BikeSkinId;
  currentCoins: number;
  bikeImpoundMatchesLeft: number;
  playerName: string;
}

export interface SpawnCommuteChoiceResult {
  allowed: boolean;
  effectiveMode: CommuteTransportMode;
  reason?: string;
  coinsDelta: number;
  newCoins: number;
  danToBonusPoints: number;
  driverGreetingLine?: string;
}

/**
 * Evaluates the 10-second spawn choice outside the player's tube house in the alley.
 */
export function evaluateSpawnCommuteChoice(
  input: SpawnCommuteChoiceInput
): SpawnCommuteChoiceResult {
  const { mode, currentCoins, bikeImpoundMatchesLeft, playerName } = input;

  if (mode === 'self_bike') {
    if (bikeImpoundMatchesLeft > 0) {
      return {
        allowed: false,
        effectiveMode: 'grab_vip',
        reason: IMPOUNDED_BIKE_TAG_TEMPLATE(bikeImpoundMatchesLeft),
        coinsDelta: 0,
        newCoins: currentCoins,
        danToBonusPoints: 0,
      };
    }

    return {
      allowed: true,
      effectiveMode: 'self_bike',
      coinsDelta: 0,
      newCoins: currentCoins,
      danToBonusPoints: DAN_TO_BONUS_POINTS,
    };
  }

  // Grab VIP mode ('grab_vip')
  const cost = Math.min(currentCoins, GRAB_VIP_COST_COINS);
  return {
    allowed: true,
    effectiveMode: 'grab_vip',
    coinsDelta: -GRAB_VIP_COST_COINS,
    newCoins: Math.max(0, currentCoins - cost),
    danToBonusPoints: 0,
    driverGreetingLine: `Anh/chị có phải là ${playerName} đi nhậu bờ kè không ạ? Lên xe ôm chặt nha!`,
  };
}

export interface MotorbikeFPPState {
  bikeSkin: BikeSkinId;
  kickstartCount: number;
  isEngineRunning: boolean;
  isKickstandDown: boolean; // Chân chống (Phím F)
  speedKmh: number;
  distanceTraveledMeters: number; // 0 -> 250m
  laneX: number; // -1.0 (left wall) to +1.0 (right wall)
  leanAngleDeg: number; // Inverted pendulum tilt (-35 to +35 deg)
  isHornPressed: boolean;
  turnSignal: 'off' | 'left' | 'right';
  hasKickstandSparksWipeout: boolean;
  hasCrashedPubSign: boolean;
  isParkedInWhiteBox: boolean;
  keyPulledOut: boolean;
  smokePuffCount: number;
  lastEventMessage: string;
}

export function createInitialMotorbikeState(
  bikeSkin: BikeSkinId = 'dream_chien'
): MotorbikeFPPState {
  return {
    bikeSkin,
    kickstartCount: 0,
    isEngineRunning: false,
    isKickstandDown: true, // Starts on kickstand in front yard! Player must press F to flip it up!
    speedKmh: 0,
    distanceTraveledMeters: 0,
    laneX: 0,
    leanAngleDeg: 0,
    isHornPressed: false,
    turnSignal: 'off',
    hasKickstandSparksWipeout: false,
    hasCrashedPubSign: false,
    isParkedInWhiteBox: false,
    keyPulledOut: false,
    smokePuffCount: 0,
    lastEventMessage:
      'Xe đang dựng chân chống trước cửa sắt kéo. Nhấp [E] 2-3 cái để đề nổ máy và gạt chân chống [F]!',
  };
}

/**
 * Handles pressing [E] to kickstart / crank the motorbike engine.
 */
export function pressMotorbikeIgnition(
  state: MotorbikeFPPState
): MotorbikeFPPState {
  const spec = BIKE_SKINS[state.bikeSkin];
  if (state.isEngineRunning) {
    return {
      ...state,
      lastEventMessage: `Máy ${spec.name} đã nổ giòn tan rồi! Gạt chân chống [F] và giữ [W] để vặn ga!`,
    };
  }

  const nextCount = state.kickstartCount + 1;
  const started = nextCount >= spec.kickstartPressesRequired;

  return {
    ...state,
    kickstartCount: nextCount,
    isEngineRunning: started,
    smokePuffCount: state.smokePuffCount + 1,
    lastEventMessage: started
      ? `💨 "${spec.exhaustSoundText}" — Khói trắng phụt ra bô xe, máy đã nổ giòn tan! Nhớ gạt chân chống [F] trước khi ôm cua!`
      : `💨 "Khặc khặc..." (${nextCount}/${spec.kickstartPressesRequired}) — Xe đời cũ hơi khó nổ, nhấp [E] thêm cái nữa!`,
  };
}

/**
 * Toggles the motorbike kickstand [Phím F].
 */
export function toggleMotorbikeKickstand(
  state: MotorbikeFPPState
): MotorbikeFPPState {
  const nextDown = !state.isKickstandDown;
  return {
    ...state,
    isKickstandDown: nextDown,
    hasKickstandSparksWipeout: false,
    lastEventMessage: nextDown
      ? '🦵 Đã hạ chân chống xe xuống đất.'
      : '🦵 "Cạch!" — Đã đá gọn chân chống lên! Giờ ôm cua thoải mái không sợ tóe lửa!',
  };
}

export interface DrunkDrivingDistortion {
  isDrunkDriving: boolean;
  doubleVisionGhostCount: number; // 1 when sober, 3 overlapping alleys when drunk
  inputLagMs: number; // ~500ms when drunk
  gyroDriftSteering: number; // sinusoidal breathing drift (-0.55 to +0.55)
  scrambledTurnSignal: 'off' | 'left' | 'right';
  accidentalHornHonk: boolean;
  motionBlurIntensity: number; // 0 to 1
}

/**
 * Computes the drunk FPP distortion parameters based on alcoholLevel and elapsed time.
 */
export function computeDrunkDrivingDistortion(
  alcoholLevel: number,
  elapsedTimeSeconds: number,
  intendedSteer: number
): DrunkDrivingDistortion {
  if (alcoholLevel <= 15) {
    return {
      isDrunkDriving: false,
      doubleVisionGhostCount: 1,
      inputLagMs: 0,
      gyroDriftSteering: 0,
      scrambledTurnSignal:
        intendedSteer < -0.2 ? 'left' : intendedSteer > 0.2 ? 'right' : 'off',
      accidentalHornHonk: false,
      motionBlurIntensity: 0,
    };
  }

  const ratio = Math.min(1, alcoholLevel / 100);
  // Ghi-đông tự nghiêng ngả sang 2 bên theo nhịp thở gấp của cơn say
  const gyroDrift =
    Math.sin(elapsedTimeSeconds * 2.4) * 0.42 * ratio +
    Math.cos(elapsedTimeSeconds * 3.7) * 0.22 * ratio;

  // Loạn xi-nhan: bật xi-nhan trái nhưng xe lại lạng sang phải
  const effectiveDir = intendedSteer + gyroDrift;
  const scrambledTurnSignal: 'off' | 'left' | 'right' =
    effectiveDir > 0.12 ? 'left' : effectiveDir < -0.12 ? 'right' : 'off';

  // Thỉnh thoảng nhân vật tự gục đầu xuống đè trúng nút còi kêu "Bípppp"
  const nodCycle = Math.sin(elapsedTimeSeconds * 1.85);
  const accidentalHornHonk = ratio >= 0.5 && nodCycle > 0.86;

  return {
    isDrunkDriving: true,
    doubleVisionGhostCount: 3, // "1 con hẻm tách thành 3 con hẻm chồng chéo lên nhau"
    inputLagMs: Math.round(500 * Math.max(0.65, ratio)), // ~0.5s input lag
    gyroDriftSteering: Number(gyroDrift.toFixed(3)),
    scrambledTurnSignal,
    accidentalHornHonk,
    motionBlurIntensity: Number((0.4 + ratio * 0.6).toFixed(2)),
  };
}

export interface StepMotorbikeInput {
  throttle: boolean; // W or LMB
  brake: boolean; // S or RMB
  steerInput: number; // -1 (A/Left) to +1 (D/Right)
  dtSeconds: number;
  alcoholLevel: number;
  elapsedTimeSeconds: number;
  isReturnTrip: boolean;
}

/**
 * Advances the motorbike FPP physics by `dtSeconds`.
 * Handles:
 * - Inverted pendulum leaning & steering
 * - Kickstand spark wipeout if cornering while `isKickstandDown` is true
 * - Police checkpoint trigger at 230m (20m before home gate!) on the return trip
 * - Arrival at the pub sidewalk (250m): checks if player decelerated into the white chalk box or crashed the pub neon sign (+50k VND bill penalty!)
 */
export function stepMotorbikePhysics(
  state: MotorbikeFPPState,
  input: StepMotorbikeInput
): {
  nextState: MotorbikeFPPState;
  hitCheckpoint20m: boolean;
  arrivedAtDestination: boolean;
  pubSignBillPenaltyVnd: number;
} {
  if (!state.isEngineRunning) {
    return {
      nextState: {
        ...state,
        speedKmh: 0,
        lastEventMessage: input.throttle
          ? '⚠️ Chưa nổ máy! Hãy nhấp phím [E] 2-3 cái để đạp nổ máy trước!'
          : state.lastEventMessage,
      },
      hitCheckpoint20m: false,
      arrivedAtDestination: false,
      pubSignBillPenaltyVnd: 0,
    };
  }

  const spec = BIKE_SKINS[state.bikeSkin];
  const distortion = computeDrunkDrivingDistortion(
    input.alcoholLevel,
    input.elapsedTimeSeconds,
    input.steerInput
  );

  // Speed calculation
  let nextSpeed = state.speedKmh;
  if (input.throttle) {
    nextSpeed = Math.min(
      spec.maxSpeedKmh,
      nextSpeed + 38 * input.dtSeconds
    );
  } else if (input.brake) {
    nextSpeed = Math.max(0, nextSpeed - 58 * input.dtSeconds);
  } else {
    nextSpeed = Math.max(0, nextSpeed - 16 * input.dtSeconds);
  }

  // Steering + Drunk Gyro Drift
  const totalSteer = Math.max(
    -1,
    Math.min(1, input.steerInput + (input.isReturnTrip ? distortion.gyroDriftSteering : 0))
  );
  const nextLeanDeg = Math.max(-34, Math.min(34, totalSteer * 28));

  // Kickstand hazard check: forgetting to flip up kickstand (F) when cornering at speed throws sparks & wipes out!
  if (
    state.isKickstandDown &&
    Math.abs(totalSteer) >= 0.35 &&
    nextSpeed >= 22
  ) {
    return {
      nextState: {
        ...state,
        speedKmh: 0,
        leanAngleDeg: totalSteer > 0 ? 45 : -45,
        hasKickstandSparksWipeout: true,
        lastEventMessage:
          '⚡🔥 XOẸT! XOÈ! Bạn quên gạt chân chống [F] khi ôm cua làm tóe lửa mặt đường và trượt bánh xoè ngay lập tức!',
      },
      hitCheckpoint20m: false,
      arrivedAtDestination: false,
      pubSignBillPenaltyVnd: 0,
    };
  }

  const metersPerSec = (nextSpeed / 3.6) * 1.45;
  const nextDistance = Math.min(
    ALLEY_TOTAL_DISTANCE_METERS,
    state.distanceTraveledMeters + metersPerSec * input.dtSeconds
  );
  const nextLaneX = Math.max(
    -0.95,
    Math.min(0.95, state.laneX + totalSteer * 0.85 * input.dtSeconds)
  );

  // Check if return trip reaches 20m before home (230m out of 250m) with alcohol > 0
  const checkpointTriggerDistance =
    ALLEY_TOTAL_DISTANCE_METERS - POLICE_CHECKPOINT_DISTANCE_FROM_HOME_METERS;
  if (
    input.isReturnTrip &&
    input.alcoholLevel > 0 &&
    nextDistance >= checkpointTriggerDistance
  ) {
    return {
      nextState: {
        ...state,
        speedKmh: 0,
        distanceTraveledMeters: checkpointTriggerDistance,
        laneX: nextLaneX,
        leanAngleDeg: 0,
        turnSignal: distortion.scrambledTurnSignal,
        isHornPressed: distortion.accidentalHornHonk,
        lastEventMessage:
          '🚨 TUÝT TUÝT TUÝT! Cách cổng sắt nhà đúng 20 mét — Chốt Cảnh Sát Giao Thông căng dây phản quang chặn đầu xe!',
      },
      hitCheckpoint20m: true,
      arrivedAtDestination: false,
      pubSignBillPenaltyVnd: 0,
    };
  }

  // Check if outbound trip reaches the pub at 250m
  if (nextDistance >= ALLEY_TOTAL_DISTANCE_METERS) {
    // If speeding > 32 km/h when hitting the pub sidewalk, crashes into the pub's neon sign (+50,000đ bill penalty!)
    const crashedPubSign = !input.isReturnTrip && nextSpeed > 32;
    return {
      nextState: {
        ...state,
        speedKmh: 0,
        distanceTraveledMeters: ALLEY_TOTAL_DISTANCE_METERS,
        leanAngleDeg: 0,
        hasCrashedPubSign: crashedPubSign,
        isParkedInWhiteBox: !crashedPubSign,
        keyPulledOut: !crashedPubSign,
        lastEventMessage: crashedPubSign
          ? '💥 RẦM! Bạn phóng quá nhanh không kịp phanh, tông đổ luôn biển hiệu Quán Nhậu! (+50.000đ vào tờ Bill cuối trận!)'
          : '🅿️ Đã giảm ga, lùi đít xe gọn gàng vào đúng vạch vôi trắng của bảo vệ quán và rút chìa khóa đút túi!',
      },
      hitCheckpoint20m: false,
      arrivedAtDestination: true,
      pubSignBillPenaltyVnd: crashedPubSign
        ? PUB_SIGN_CRASH_BILL_PENALTY_VND
        : 0,
    };
  }

  return {
    nextState: {
      ...state,
      speedKmh: Math.round(nextSpeed),
      distanceTraveledMeters: Math.round(nextDistance),
      laneX: Number(nextLaneX.toFixed(2)),
      leanAngleDeg: Math.round(nextLeanDeg),
      turnSignal: distortion.scrambledTurnSignal,
      isHornPressed: distortion.accidentalHornHonk,
    },
    hitCheckpoint20m: false,
    arrivedAtDestination: false,
    pubSignBillPenaltyVnd: 0,
  };
}

export interface ReturnCommuteResolutionInput {
  option: ReturnCommuteOption;
  currentCoins: number;
  currentImpoundMatchesLeft: number;
  alcoholLevel: number;
  playerName: string;
}

export interface ReturnCommuteResolutionResult {
  option: ReturnCommuteOption;
  caughtByPoliceCheckpoint: boolean;
  coinsDelta: number;
  newCoins: number;
  newImpoundMatchesLeft: number;
  impoundTagText: string | null;
  awardedTitle: string | null;
  breathalyzerReadingText: string | null;
  grabFriendTauntLine: string | null;
  summaryHeadline: string;
  summaryDetail: string;
}

/**
 * Resolves the post-match return commute outcome & economic consequences.
 */
export function resolveReturnCommuteOutcome(
  input: ReturnCommuteResolutionInput
): ReturnCommuteResolutionResult {
  const { option, currentCoins, currentImpoundMatchesLeft, playerName } = input;

  // 1. Grab VIP Return ("Đặc quyền Hòa Bình")
  if (option === 'grab_vip_return') {
    const nextImpound = Math.max(0, currentImpoundMatchesLeft - 1);
    return {
      option,
      caughtByPoliceCheckpoint: false,
      coinsDelta: 0, // Paid 50 coins upfront at spawn
      newCoins: currentCoins,
      newImpoundMatchesLeft: nextImpound,
      impoundTagText:
        nextImpound > 0 ? IMPOUNDED_BIKE_TAG_TEMPLATE(nextImpound) : null,
      awardedTitle: null,
      breathalyzerReadingText: null,
      grabFriendTauntLine: 'Đi bộ vui vẻ nha con trai!',
      summaryHeadline:
        '🛵🛡️ ĐẶC QUYỀN HÒA BÌNH: Tài Xế Áo Xanh Cột Dây Nịt Chở Về Tận Giường!',
      summaryDetail: `Dù ${playerName} đã say mềm nhũn như Ragdoll, anh tài xế công nghệ vẫn đợi sẵn ở cửa quán, lấy dây nịt cột chặt bụng bạn vào bụng tài xế rồi phóng vèo qua chốt giao thông về nhà an toàn 100%!`,
    };
  }

  // 2. Loophole A: Leave bike at pub & walk home (-30 Nắp Bia overnight parking fee)
  if (option === 'walk_overnight_parking') {
    const nextImpound = Math.max(0, currentImpoundMatchesLeft - 1);
    return {
      option,
      caughtByPoliceCheckpoint: false,
      coinsDelta: -OVERNIGHT_PARKING_COST_COINS,
      newCoins: Math.max(0, currentCoins - OVERNIGHT_PARKING_COST_COINS),
      newImpoundMatchesLeft: nextImpound,
      impoundTagText:
        nextImpound > 0 ? IMPOUNDED_BIKE_TAG_TEMPLATE(nextImpound) : null,
      awardedTitle: null,
      breathalyzerReadingText: null,
      grabFriendTauntLine: null,
      summaryHeadline:
        '🚶‍♂️🔑 MẸO LÁCH LUẬT THÀNH CÔNG: Gửi Xe Qua Đêm Tại Quán (-30 Nắp Bia)!',
      summaryDetail: `${playerName} tỉnh đòn gửi lại chiến cơ cho bảo vệ quán giữ qua đêm (tốn 30 Nắp Bia), đi bộ lết về hẻm và đi ngang qua Chốt Cảnh Sát Giao Thông mà không mất 500 Nắp Bia!`,
    };
  }

  // 3. Loophole B: Beg pub security guard to push bike past the checkpoint (-20 Nắp Bia tip)
  if (option === 'beg_guard_push_past_checkpoint') {
    const nextImpound = Math.max(0, currentImpoundMatchesLeft - 1);
    return {
      option,
      caughtByPoliceCheckpoint: false,
      coinsDelta: -GUARD_ASSIST_TIP_COINS,
      newCoins: Math.max(0, currentCoins - GUARD_ASSIST_TIP_COINS),
      newImpoundMatchesLeft: nextImpound,
      impoundTagText:
        nextImpound > 0 ? IMPOUNDED_BIKE_TAG_TEMPLATE(nextImpound) : null,
      awardedTitle: null,
      breathalyzerReadingText: null,
      grabFriendTauntLine: null,
      summaryHeadline:
        '🙏🛵 MẸO LÁCH LUẬT THÀNH CÔNG: Bảo Vệ Quán Dắt Bộ Hộ Qua Chốt (-20 Nắp Bia)!',
      summaryDetail: `${playerName} năn nỉ anh bảo vệ quán tắt máy dắt bộ chiến cơ qua chốt hộ (bồi dưỡng 20 Nắp Bia). Không nổ máy nên thoát ngoạn mục mức phạt 500 Nắp Bia!`,
    };
  }

  // 4. Drunk Self-Drive caught at the 20m Traffic Police Checkpoint! ("The Final Boss")
  const newImpound = IMPOUND_DURATION_MATCHES;
  return {
    option: 'drunk_self_drive',
    caughtByPoliceCheckpoint: true,
    coinsDelta: -POLICE_CHECKPOINT_FINE_COINS,
    newCoins: Math.max(0, currentCoins - POLICE_CHECKPOINT_FINE_COINS),
    newImpoundMatchesLeft: newImpound,
    impoundTagText: IMPOUNDED_BIKE_TAG_TEMPLATE(newImpound),
    awardedTitle: EXEMPLARY_TAXPAYER_TITLE,
    breathalyzerReadingText: BREATHALYZER_MAX_READING_TEXT,
    grabFriendTauntLine: 'Đi bộ vui vẻ nha con trai!',
    summaryHeadline:
      '🚔💸 KỊCH KHUNG 999 mg/L — LÊN THÙNG XE TẢI CÁCH NHÀ ĐÚNG 20 MÉT!',
    summaryDetail: `Chỉ còn cách cổng sắt nhà đúng 20m, ${playerName} bị Chốt CSGT căng dây phản quang "Xoẹt!". Máy đo báo "${BREATHALYZER_MAX_READING_TEXT}". Phạt -500 Nắp Bia (đắt gấp 10 lần tiền xe ôm) và giam xe 2 trận!`,
  };
}
