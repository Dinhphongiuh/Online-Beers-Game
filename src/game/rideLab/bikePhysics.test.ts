import test from 'node:test';
import assert from 'node:assert/strict';
import { RIDE_BIKES, createBikeState, gearTopMs, kickstart, stepBike, toggleKickstand, type BikeInput, type BikeState } from './bikePhysics';

const spec = RIDE_BIKES[0];
const run = (state: BikeState, input: BikeInput, seconds: number, alcohol = 0) => {
  let s = state;
  for (let t = 0; t < seconds; t += 1 / 60) s = stepBike(s, input, { spec, dt: 1 / 60, alcohol, time: t, surface: 'road' });
  return s;
};
const ready = () => {
  let s = createBikeState();
  for (let i = 0; i < spec.kickstartsNeeded; i++) s = kickstart(s, spec).state;
  return toggleKickstand(s);
};

test('engine needs the configured number of kicks', () => {
  let s = createBikeState();
  for (let i = 1; i < spec.kickstartsNeeded; i++) {
    s = kickstart(s, spec).state;
    assert.equal(s.engineOn, false);
  }
  assert.equal(kickstart(s, spec).started, true);
});

test('no engine, no throttle response', () => {
  const s = run(createBikeState(), { throttle: 1, brake: 0, steer: 0 }, 3);
  assert.equal(s.speed, 0);
});

test('full throttle climbs through the gears and stays under top speed', () => {
  const s = run(ready(), { throttle: 1, brake: 0, steer: 0 }, 30);
  assert.equal(s.gear, spec.gearTopKmh.length);
  assert.ok(s.speed <= gearTopMs(spec, spec.gearTopKmh.length) + 0.01);
  assert.ok(s.z > 100, 'moves forward along +Z');
  assert.ok(Math.abs(s.x) < 0.01, 'goes straight without steering');
});

test('braking stops the bike', () => {
  const moving = run(ready(), { throttle: 1, brake: 0, steer: 0 }, 6);
  const stopped = run(moving, { throttle: 0, brake: 1, steer: 0 }, 6);
  assert.equal(stopped.speed, 0);
});

test('steering right turns toward -X and leans right', () => {
  const moving = run(ready(), { throttle: 1, brake: 0, steer: 0 }, 4);
  const turning = run(moving, { throttle: 0.5, brake: 0, steer: 1 }, 1);
  assert.ok(turning.heading < moving.heading);
  assert.ok(turning.lean > 0.1);
});

test('turns widen with speed (lean-limited curvature)', () => {
  const slowStart = run(ready(), { throttle: 1, brake: 0, steer: 0 }, 1.5);
  const fastStart = run(ready(), { throttle: 1, brake: 0, steer: 0 }, 12);
  const yawRate = (s: BikeState) => {
    const after = stepBike({ ...s, steer: 1 }, { throttle: 0, brake: 0, steer: 1 }, { spec, dt: 0.05, alcohol: 0, time: 0, surface: 'road' });
    return Math.abs(after.heading - s.heading) / 0.05 / Math.max(s.speed, 0.01);
  };
  assert.ok(yawRate(slowStart) > yawRate(fastStart), 'curvature is tighter at low speed');
});

test('cornering with the kickstand down crashes', () => {
  let s = createBikeState();
  for (let i = 0; i < spec.kickstartsNeeded; i++) s = kickstart(s, spec).state;
  s = { ...s, speed: 8 };
  const after = run(s, { throttle: 0.5, brake: 0, steer: 1 }, 1);
  assert.equal(after.crashReason, 'kickstand');
});

test('a drunk rider drifts with hands off the bars', () => {
  const moving = run(ready(), { throttle: 1, brake: 0, steer: 0 }, 4);
  const sober = run(moving, { throttle: 0.4, brake: 0, steer: 0 }, 3, 0);
  const drunk = run(moving, { throttle: 0.4, brake: 0, steer: 0 }, 3, 90);
  assert.ok(Math.abs(drunk.x - moving.x) > Math.abs(sober.x - moving.x) + 0.3);
});
