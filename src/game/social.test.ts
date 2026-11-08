import test from 'node:test';
import assert from 'node:assert/strict';
import {
  customNpcPlayerId,
  presenceNote,
  sanitizeNpcInput,
  sanitizePresenceInput,
  sortFriends,
} from '../../shared/social';
import { customNpcToPlayer } from '../lobby/lobbyData';

test('presence: drinking keeps its table code, anything else is plain online', () => {
  assert.deepEqual(sanitizePresenceInput({ state: 'drinking', roomCode: '12#34' }), { state: 'drinking', roomCode: '1234' });
  assert.deepEqual(sanitizePresenceInput({ state: 'offline', roomCode: '99' }), { state: 'online' });
  assert.match(presenceNote({ state: 'offline' }), /vợ thu điện thoại/);
  assert.match(presenceNote({ state: 'drinking', roomCode: '777' }), /#777/);
});

test('friends list: online, then drinking, then offline', () => {
  const list = sortFriends([
    { username: 'Cường', presence: { state: 'offline' as const } },
    { username: 'Bình', presence: { state: 'drinking' as const } },
    { username: 'An', presence: { state: 'online' as const } },
  ]);
  assert.deepEqual(list.map((f) => f.username), ['An', 'Bình', 'Cường']);
});

test('custom NPC input is sanitized and becomes a plain table bot', () => {
  assert.equal(sanitizeNpcInput({ name: ' x ' }), null);
  const npc = sanitizeNpcInput({ name: 'Tư  Mập', avatar: 'unicorn', tolerance: 400, catchphrase: 'Dzô!' });
  assert.ok(npc);
  assert.equal(npc.name, 'Tư Mập');
  assert.equal(npc.avatar, 'dog');
  assert.equal(npc.tolerance, 100);
  const p = customNpcToPlayer({ ...npc, npcId: 'abc' }, 3);
  assert.equal(p.id, customNpcPlayerId('abc'));
  assert.equal(p.isUser, false);
  assert.equal(p.seatIndex, 3);
  assert.equal(p.stamina, 100);
});
