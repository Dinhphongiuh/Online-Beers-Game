/**
 * "social_hub": one lightweight socket per signed-in tab. No synced state — the server only
 * pushes SocialEvents (friend requests, accepts, table invites, presence) to the right users.
 */
import { Room, type Client } from '@colyseus/core';
import { redis } from '../redis.ts';
import { parseRedisJson, type SessionUser } from '../http/session.ts';
import { socialHub } from './socialHub.ts';
import { readPresence, setOffline, setPresence } from '../services/presence.ts';

const OFFLINE_GRACE_MS = 5000;

export class SocialRoom extends Room {
  maxClients = 2000;

  onCreate() {
    this.autoDispose = true;
    // Nothing to sync: events are sent to individual clients
    this.onMessage('*', () => {});
  }

  /** The login token rides in the join options; no session → the socket is refused. */
  async onAuth(_client: Client, options: { token?: unknown }) {
    const token = typeof options?.token === 'string' ? options.token : '';
    if (!token) throw new Error('Chưa đăng nhập');
    const s = parseRedisJson<Record<string, unknown>>(await redis.get(`session:${token}`));
    if (!s?.userId) throw new Error('Phiên đăng nhập đã hết hạn');
    const user: SessionUser = {
      userId: String(s.userId),
      username: String(s.username || 'Bợm Nhậu'),
      avatar: String(s.avatar || 'dog'),
      isGuest: Boolean(s.isGuest),
    };
    return user;
  }

  async onJoin(client: Client, _options: unknown, user: SessionUser) {
    socialHub.add(user.userId, client);
    // Opening the game counts as "đang ở quán" until the heartbeat says otherwise
    try {
      const current = await readPresence(user.userId);
      if (current.state === 'offline') await setPresence(user.userId, { state: 'online' });
    } catch {
      // Redis hiccup: the REST heartbeat will set it
    }
  }

  async onLeave(client: Client) {
    const user = client.auth as SessionUser | undefined;
    if (!user) return;
    socialHub.remove(user.userId, client);
    // A page reload reconnects within a second or two: only call it "offline" if nobody came back
    setTimeout(() => {
      if (!socialHub.isConnected(user.userId)) void setOffline(user.userId).catch(() => null);
    }, OFFLINE_GRACE_MS);
  }
}
