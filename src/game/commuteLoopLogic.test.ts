import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLEY_TOTAL_DISTANCE_METERS,
  BREATHALYZER_MAX_READING_TEXT,
  DAN_TO_BONUS_POINTS,
  EXEMPLARY_TAXPAYER_TITLE,
  GRAB_VIP_COST_COINS,
  IMPOUNDED_BIKE_TAG_TEMPLATE,
  OVERNIGHT_PARKING_COST_COINS,
  POLICE_CHECKPOINT_DISTANCE_FROM_HOME_METERS,
  POLICE_CHECKPOINT_FINE_COINS,
  PUB_SIGN_CRASH_BILL_PENALTY_VND,
  computeDrunkDrivingDistortion,
  createInitialMotorbikeState,
  evaluateSpawnCommuteChoice,
  pressMotorbikeIgnition,
  resolveReturnCommuteOutcome,
  breathalyzerReadingFor,
  BREATHALYZER_ZERO_READING_TEXT,
  SOBER_DRIVER_TITLE,
  stepMotorbikePhysics,
  toggleMotorbikeKickstand,
} from './commuteLoopLogic.ts';

test('evaluateSpawnCommuteChoice: allows free self_bike when not impounded and awards Dân Tổ bonus', () => {
  const res = evaluateSpawnCommuteChoice({
    mode: 'self_bike',
    selectedBikeSkin: 'dream_chien',
    currentCoins: 240,
    bikeImpoundMatchesLeft: 0,
    playerName: 'Bợm Nhậu',
  });

  assert.equal(res.allowed, true);
  assert.equal(res.effectiveMode, 'self_bike');
  assert.equal(res.coinsDelta, 0);
  assert.equal(res.newCoins, 240);
  assert.equal(res.danToBonusPoints, DAN_TO_BONUS_POINTS);
});

test('evaluateSpawnCommuteChoice: blocks self_bike when impounded and returns exact impound tag', () => {
  const res = evaluateSpawnCommuteChoice({
    mode: 'self_bike',
    selectedBikeSkin: 'wave_do_po',
    currentCoins: 240,
    bikeImpoundMatchesLeft: 2,
    playerName: 'Bợm Nhậu',
  });

  assert.equal(res.allowed, false);
  assert.equal(res.effectiveMode, 'grab_vip');
  assert.equal(
    res.reason,
    '[🔒 Đang bị giam ở đồn - Còn 2 trận nữa mới được chuộc]'
  );
});

test('evaluateSpawnCommuteChoice: deducts 50 Nắp Bia for Grab VIP and formats driver greeting', () => {
  const res = evaluateSpawnCommuteChoice({
    mode: 'grab_vip',
    selectedBikeSkin: 'cub_50',
    currentCoins: 240,
    bikeImpoundMatchesLeft: 0,
    playerName: 'Phi Quân',
  });

  assert.equal(res.allowed, true);
  assert.equal(res.effectiveMode, 'grab_vip');
  assert.equal(res.coinsDelta, -GRAB_VIP_COST_COINS);
  assert.equal(res.newCoins, 190);
  assert.equal(
    res.driverGreetingLine,
    'Anh/chị có phải là Phi Quân đi nhậu bờ kè không ạ? Lên xe ôm chặt nha!'
  );
});

test('pressMotorbikeIgnition: requires 3 E presses for Dream Chiến before starting engine', () => {
  let state = createInitialMotorbikeState('dream_chien');
  assert.equal(state.isEngineRunning, false);

  state = pressMotorbikeIgnition(state);
  assert.equal(state.kickstartCount, 1);
  assert.equal(state.isEngineRunning, false);

  state = pressMotorbikeIgnition(state);
  assert.equal(state.kickstartCount, 2);
  assert.equal(state.isEngineRunning, false);

  state = pressMotorbikeIgnition(state);
  assert.equal(state.kickstartCount, 3);
  assert.equal(state.isEngineRunning, true);
  assert.ok(state.lastEventMessage.includes('Khặc khặc... Bành bành bành!'));
});

test('stepMotorbikePhysics: triggers kickstand spark wipeout if cornering without pressing F', () => {
  let state = createInitialMotorbikeState('wave_do_po');
  state = pressMotorbikeIgnition(state);
  state = pressMotorbikeIgnition(state); // Wave starts in 2 presses
  assert.equal(state.isEngineRunning, true);
  assert.equal(state.isKickstandDown, true);

  // Accelerate straight first
  const accel = stepMotorbikePhysics(state, {
    throttle: true,
    brake: false,
    steerInput: 0,
    dtSeconds: 1.0,
    alcoholLevel: 0,
    elapsedTimeSeconds: 1,
    isReturnTrip: false,
  });
  assert.ok(accel.nextState.speedKmh >= 22);

  // Now lean into a corner while kickstand is still down -> sparks & wipeout!
  const turn = stepMotorbikePhysics(accel.nextState, {
    throttle: true,
    brake: false,
    steerInput: 0.6,
    dtSeconds: 0.5,
    alcoholLevel: 0,
    elapsedTimeSeconds: 1.5,
    isReturnTrip: false,
  });
  assert.equal(turn.nextState.hasKickstandSparksWipeout, true);
  assert.equal(turn.nextState.speedKmh, 0);

  // Flipping up kickstand with F prevents wipeout
  const flipped = toggleMotorbikeKickstand(accel.nextState);
  assert.equal(flipped.isKickstandDown, false);
  const safeTurn = stepMotorbikePhysics(flipped, {
    throttle: true,
    brake: false,
    steerInput: 0.6,
    dtSeconds: 0.5,
    alcoholLevel: 0,
    elapsedTimeSeconds: 2.0,
    isReturnTrip: false,
  });
  assert.equal(safeTurn.nextState.hasKickstandSparksWipeout, false);
});

test('stepMotorbikePhysics: crashing into pub sign at >32 km/h on arrival adds 50,000đ bill penalty', () => {
  let state = createInitialMotorbikeState('wave_do_po');
  state = pressMotorbikeIgnition( pressMotorbikeIgnition(state) );
  state = toggleMotorbikeKickstand(state);
  state = {
    ...state,
    speedKmh: 55,
    distanceTraveledMeters: ALLEY_TOTAL_DISTANCE_METERS - 2,
  };

  const arrival = stepMotorbikePhysics(state, {
    throttle: true,
    brake: false,
    steerInput: 0,
    dtSeconds: 0.5,
    alcoholLevel: 0,
    elapsedTimeSeconds: 5,
    isReturnTrip: false,
  });

  assert.equal(arrival.arrivedAtDestination, true);
  assert.equal(arrival.nextState.hasCrashedPubSign, true);
  assert.equal(arrival.pubSignBillPenaltyVnd, PUB_SIGN_CRASH_BILL_PENALTY_VND);
});

test('computeDrunkDrivingDistortion & stepMotorbikePhysics: return trip triggers 20m police checkpoint when drunk', () => {
  const dist = computeDrunkDrivingDistortion(85, 3.2, -0.4);
  assert.equal(dist.isDrunkDriving, true);
  assert.equal(dist.doubleVisionGhostCount, 3);
  assert.ok(dist.inputLagMs >= 350);

  let state = createInitialMotorbikeState('dream_chien');
  state = {
    ...state,
    isEngineRunning: true,
    isKickstandDown: false,
    speedKmh: 45,
    distanceTraveledMeters:
      ALLEY_TOTAL_DISTANCE_METERS -
      POLICE_CHECKPOINT_DISTANCE_FROM_HOME_METERS -
      2,
  };

  const step = stepMotorbikePhysics(state, {
    throttle: true,
    brake: false,
    steerInput: 0,
    dtSeconds: 0.5,
    alcoholLevel: 85,
    elapsedTimeSeconds: 4.0,
    isReturnTrip: true,
  });

  assert.equal(step.hitCheckpoint20m, true);
  assert.equal(
    step.nextState.distanceTraveledMeters,
    ALLEY_TOTAL_DISTANCE_METERS - POLICE_CHECKPOINT_DISTANCE_FROM_HOME_METERS
  );
});

test('resolveReturnCommuteOutcome: applies -500 coins, 2-match impound, 999 mg/L reading, and Exemplary Taxpayer title when caught', () => {
  const caught = resolveReturnCommuteOutcome({
    option: 'drunk_self_drive',
    currentCoins: 740,
    currentImpoundMatchesLeft: 0,
    alcoholLevel: 90,
    playerName: 'Bợm Nhậu',
  });

  assert.equal(caught.caughtByPoliceCheckpoint, true);
  assert.equal(caught.coinsDelta, -POLICE_CHECKPOINT_FINE_COINS);
  assert.equal(caught.newCoins, 240);
  assert.equal(caught.newImpoundMatchesLeft, 2);
  assert.equal(caught.impoundTagText, IMPOUNDED_BIKE_TAG_TEMPLATE(2));
  assert.equal(caught.awardedTitle, EXEMPLARY_TAXPAYER_TITLE);
  assert.equal(caught.breathalyzerReadingText, BREATHALYZER_MAX_READING_TEXT);
  assert.equal(caught.grabFriendTauntLine, 'Đi bộ vui vẻ nha con trai!');

  // Overnight parking loophole (-30 coins) avoids police fine and decrements existing impound
  const loophole = resolveReturnCommuteOutcome({
    option: 'walk_overnight_parking',
    currentCoins: 240,
    currentImpoundMatchesLeft: 2,
    alcoholLevel: 90,
    playerName: 'Bợm Nhậu',
  });
  assert.equal(loophole.caughtByPoliceCheckpoint, false);
  assert.equal(loophole.coinsDelta, -OVERNIGHT_PARKING_COST_COINS);
  assert.equal(loophole.newCoins, 210);
  assert.equal(loophole.newImpoundMatchesLeft, 1);
});

test('return trip: the 20m checkpoint stops sober riders too', () => {
  const state = {
    ...createInitialMotorbikeState('dream_chien'),
    isEngineRunning: true,
    isKickstandDown: false,
    speedKmh: 40,
    distanceTraveledMeters: ALLEY_TOTAL_DISTANCE_METERS - POLICE_CHECKPOINT_DISTANCE_FROM_HOME_METERS - 2,
  };
  const step = stepMotorbikePhysics(state, {
    throttle: true,
    brake: false,
    steerInput: 0,
    dtSeconds: 0.5,
    alcoholLevel: 0,
    elapsedTimeSeconds: 4,
    isReturnTrip: true,
  });
  assert.equal(step.hitCheckpoint20m, true);
});

test('resolveReturnCommuteOutcome: 0% alcohol rides home legally, any alcohol is caught', () => {
  const sober = resolveReturnCommuteOutcome({
    option: 'drunk_self_drive',
    currentCoins: 300,
    currentImpoundMatchesLeft: 1,
    alcoholLevel: 0,
    playerName: 'Bợm Nhậu',
  });
  assert.equal(sober.caughtByPoliceCheckpoint, false);
  assert.equal(sober.coinsDelta, 0);
  assert.equal(sober.newImpoundMatchesLeft, 0);
  assert.equal(sober.awardedTitle, SOBER_DRIVER_TITLE);
  assert.equal(sober.breathalyzerReadingText, BREATHALYZER_ZERO_READING_TEXT);

  const tipsy = resolveReturnCommuteOutcome({
    option: 'drunk_self_drive',
    currentCoins: 600,
    currentImpoundMatchesLeft: 0,
    alcoholLevel: 15,
    playerName: 'Bợm Nhậu',
  });
  assert.equal(tipsy.caughtByPoliceCheckpoint, true);
  assert.equal(tipsy.breathalyzerReadingText, breathalyzerReadingFor(15));
  assert.match(tipsy.summaryHeadline, /15% CỒN/);
});

test('breathalyzerReadingFor scales with the real Độ Cồn', () => {
  assert.equal(breathalyzerReadingFor(0), BREATHALYZER_ZERO_READING_TEXT);
  assert.match(breathalyzerReadingFor(15), /^0\.135 mg\/L/);
  assert.match(breathalyzerReadingFor(50), /^0\.450 mg\/L/);
  assert.equal(breathalyzerReadingFor(95), BREATHALYZER_MAX_READING_TEXT);
});
