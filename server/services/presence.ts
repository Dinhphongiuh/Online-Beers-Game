/**
 * Presence ("đang ở quán" / "đang nhậu bàn #x" / offline) lives in Redis with a TTL; every
 * change is pushed to the user's friends over the social_hub socket.
 */
import { dbService } from '../db/index.ts';
import { redis } from '../redis.ts';
import { parseRedisJson } from '../http/session.ts';
import { socialHub } from '../realtime/socialHub.ts';
import { PRESENCE_TTL_SECONDS, type Presence } from '../../shared/social.ts';

const presenceKey = (userId: string) => `presence:${userId}`;

export async function readPresence(userId: string): Promise<Presence> {
  const p = parseRedisJson<Presence>(await redis.get(presenceKey(userId)));
  return p && (p.state === 'online' || p.state === 'drinking') ? p : { state: 'offline' };
}

const samePresence = (a: Presence, b: Presence) => a.state === b.state && (a.roomCode ?? '') === (b.roomCode ?? '');

async function broadcastToFriends(userId: string, presence: Presence) {
  const { friends } = await dbService.listSocial(userId);
  socialHub.notifyMany(
    friends.map((f) => f.userId),
    { type: 'presence', userId, presence }
  );
}

/** Heartbeat / socket join: store it, and tell friends only when something changed. */
export async function setPresence(userId: string, next: Presence) {
  const prev = await readPresence(userId);
  const stored: Presence = { ...next, updatedAt: Date.now() };
  await redis.set(presenceKey(userId), JSON.stringify(stored), 'EX', PRESENCE_TTL_SECONDS);
  if (!samePresence(prev, next)) await broadcastToFriends(userId, next).catch(() => null);
  return stored;
}

/** Last tab closed: "bị vợ thu điện thoại" right away instead of after the TTL. */
export async function setOffline(userId: string) {
  await redis.del(presenceKey(userId));
  await broadcastToFriends(userId, { state: 'offline' }).catch(() => null);
}
