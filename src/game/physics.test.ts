import test from 'node:test';
import assert from 'node:assert/strict';
import { BikeSuspension, loadRapier, TablePhysics } from './physics';
import type { PropSnapshot } from '../../shared/tableNet';

const run = (fn: (dt: number) => void, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) fn(1 / 60);
};

test('cans settle on the table instead of falling through', async () => {
  const R = await loadRapier();
  const table = new TablePhysics(R, 'a');
  let last: PropSnapshot[] = [];
  table.onSnapshot = (p) => (last = p);
  table.reset(); // owned for 1.5s → snapshots stream
  run((dt) => table.step(dt), 1.2);
  assert.ok(last.length >= 10, `expected snapshots for the props, got ${last.length}`);
  for (const p of last) assert.ok(p.p[1] > 0.95 && p.p[1] < 1.2, `${p.id} y=${p.p[1]}`);
  table.dispose();
});

test('flipping the table throws props off it and streams them', async () => {
  const R = await loadRapier();
  const table = new TablePhysics(R, 'a');
  run((dt) => table.step(dt), 0.5);
  table.flip();
  let last: PropSnapshot[] = [];
  table.onSnapshot = (p) => (last = p);
  run((dt) => table.step(dt), 2.5);
  const onFloor = last.filter((p) => p.p[1] < 0.5).length;
  assert.ok(onFloor >= 6, `expected most props on the floor, got ${onFloor}/${last.length}`);
  table.dispose();
});

test('a thrown slipper bonks the character it is aimed at', async () => {
  const R = await loadRapier();
  const table = new TablePhysics(R, 'a');
  const hits: string[] = [];
  table.onSlipperHit = (id) => hits.push(id);
  table.setCharacters([{ id: 'friend', x: 0, y: 0, z: -1.95 }]);
  // From the user's seat (z=+1.95, head ~1.35) at the friend's head, ~0.55s flight
  const T = 0.55;
  const origin: [number, number, number] = [0, 1.35, 1.7];
  const velocity: [number, number, number] = [0, (1.15 - 1.35) / T + 0.5 * 9.81 * T, (-1.95 - 1.7) / T];
  table.throwSlipper(origin, velocity, { local: true });
  run((dt) => {
    table.setCharacters([{ id: 'friend', x: 0, y: 0, z: -1.95 }]);
    table.step(dt);
  }, 1.5);
  assert.deepEqual(hits, ['friend']);
  table.dispose();
});

test('remote snapshots drive props we do not own', async () => {
  const R = await loadRapier();
  const table = new TablePhysics(R, 'b');
  table.applyRemote([{ id: 'can_0', p: [0.5, 1.5, 0.5], q: [0, 0, 0, 1], sleeping: false }]);
  let seen: PropSnapshot | undefined;
  table.onSnapshot = (p) => (seen = p.find((x) => x.id === 'can_0'));
  table.reset();
  // reset() claims ownership, so remote data is ignored and we stream our own
  run((dt) => table.step(dt), 0.3);
  assert.ok(seen, 'owned prop should be streamed');
  table.dispose();
});

test('pothole bump makes the bike chassis bounce and settle', async () => {
  const R = await loadRapier();
  const bike = new BikeSuspension(R);
  run((dt) => bike.step(dt), 0.5);
  const rest = bike.offset.y;
  bike.bump(-1, 0.9);
  let peak = 0;
  let peakPitch = 0;
  run((dt) => {
    bike.step(dt);
    peak = Math.max(peak, bike.offset.y);
    peakPitch = Math.max(peakPitch, Math.abs(bike.offset.pitch));
  }, 0.6);
  assert.ok(peak - rest > 0.01, `expected a bounce, got ${peak - rest}`);
  assert.ok(peakPitch > 0.01, `expected the front to pitch, got ${peakPitch}`);
  run((dt) => bike.step(dt), 3);
  assert.ok(Math.abs(bike.offset.y - rest) < 0.02, 'suspension should settle');
  bike.dispose();
});
