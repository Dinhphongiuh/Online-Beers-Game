/**
 * Friends list: friend requests (MongoDB), live presence & table invites (Redis TTL keys).
 * Every route needs a session — friends are accounts, not devices.
 */
import crypto from 'crypto';
import { Router } from 'express';
import { dbService } from '../db/index.ts';
import { redis } from '../redis.ts';
import { sendServerError } from '../http/respond.ts';
import { parseRedisJson, requireSession, type SessionUser } from '../http/session.ts';
import { socialHub } from '../realtime/socialHub.ts';
import { readPresence, setPresence } from '../services/presence.ts';
import { summarizeLifetime } from '../../shared/receipts.ts';
import {
  INVITE_TTL_SECONDS,
  sanitizePresenceInput,
  sortFriends,
  type FriendProfile,
  type FriendView,
  type SocialSnapshot,
  type SocialUser,
  type TableInvite,
} from '../../shared/social.ts';

export const socialRouter = Router();
socialRouter.use('/api/social', requireSession);

const invitesKey = (userId: string) => `invites:${userId}`;
const me = (res: { locals: Record<string, unknown> }) => res.locals.user as SessionUser;
const publicProfile = (u: SessionUser): SocialUser => ({ userId: u.userId, username: u.username, avatar: u.avatar });

async function readInvites(userId: string): Promise<TableInvite[]> {
  const list = parseRedisJson<TableInvite[]>(await redis.get(invitesKey(userId))) ?? [];
  const cutoff = Date.now() - INVITE_TTL_SECONDS * 1000;
  return Array.isArray(list) ? list.filter((i) => i && i.at > cutoff) : [];
}

async function writeInvites(userId: string, list: TableInvite[]) {
  if (list.length) await redis.set(invitesKey(userId), JSON.stringify(list.slice(-10)), 'EX', INVITE_TTL_SECONDS);
  else await redis.del(invitesKey(userId));
}

// GET everything the friends panel needs in one poll
socialRouter.get('/api/social', async (_req, res) => {
  try {
    const user = me(res);
    const { friends, incoming, outgoing } = await dbService.listSocial(user.userId);
    const withPresence: FriendView[] = await Promise.all(
      friends.map(async (f) => ({ ...f, presence: await readPresence(f.userId) }))
    );
    const snapshot: SocialSnapshot = {
      friends: sortFriends(withPresence),
      incoming,
      outgoing,
      invites: await readInvites(user.userId),
    };
    res.json(snapshot);
  } catch (error) {
    sendServerError(res, error, 'Không tải được danh sách bạn bè');
  }
});

// POST heartbeat: "đang ở quán" (menu) or "đang nhậu bàn #1234"
socialRouter.post('/api/social/presence', async (req, res) => {
  try {
    const presence = await setPresence(me(res).userId, sanitizePresenceInput(req.body));
    res.json({ success: true, presence });
  } catch (error) {
    sendServerError(res, error, 'Không cập nhật được trạng thái');
  }
});

// POST kết bạn bằng biệt danh
socialRouter.post('/api/social/friends/request', async (req, res) => {
  try {
    const user = me(res);
    const name = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    if (!name) return res.status(400).json({ error: 'Nhập biệt danh của bạn nhậu' });
    const target = await dbService.findUserByIdentifier(name);
    if (!target || target.userId === undefined) return res.status(404).json({ error: `Không có bợm nhậu nào tên "${name}"` });
    if (target.userId === user.userId) return res.status(400).json({ error: 'Tự kết bạn với chính mình thì hơi cô đơn 🥲' });
    const result = await dbService.requestFriend(user.userId, target.userId);
    // Realtime: the other side sees the request (or the auto-accept) without waiting for a poll
    if (result === 'sent') socialHub.notify(target.userId, { type: 'friend_request', from: publicProfile(user) });
    if (result === 'accepted') socialHub.notify(target.userId, { type: 'friend_accepted', by: publicProfile(user) });
    const messages = {
      sent: `📨 Đã gửi lời mời kết bạn tới ${target.username}`,
      accepted: `🤝 ${target.username} cũng đã mời bạn — giờ là bạn nhậu!`,
      already_friends: `Hai bạn đã là bạn nhậu rồi 🍻`,
      already_pending: `Đã gửi lời mời rồi, chờ ${target.username} trả lời nhé`,
    } as const;
    res.json({ success: true, result, message: messages[result] });
  } catch (error) {
    sendServerError(res, error, 'Không gửi được lời mời kết bạn');
  }
});

socialRouter.post('/api/social/friends/:userId/accept', async (req, res) => {
  try {
    const user = me(res);
    const otherId = String(req.params.userId);
    const ok = await dbService.acceptFriend(user.userId, otherId);
    if (!ok) return res.status(404).json({ error: 'Lời mời không còn nữa' });
    socialHub.notify(otherId, { type: 'friend_accepted', by: publicProfile(user) });
    res.json({ success: true });
  } catch (error) {
    sendServerError(res, error, 'Không chấp nhận được lời mời');
  }
});

// DELETE = từ chối / hủy lời mời / hủy kết bạn
socialRouter.delete('/api/social/friends/:userId', async (req, res) => {
  try {
    const user = me(res);
    const otherId = String(req.params.userId);
    if (await dbService.removeFriend(user.userId, otherId)) {
      socialHub.notify(otherId, { type: 'friend_removed', userId: user.userId });
    }
    res.json({ success: true });
  } catch (error) {
    sendServerError(res, error, 'Không xóa được');
  }
});

// POST rủ bạn vào bàn của mình
socialRouter.post('/api/social/friends/:userId/invite', async (req, res) => {
  try {
    const user = me(res);
    const targetId = String(req.params.userId);
    const roomCode = typeof req.body?.roomCode === 'string' ? req.body.roomCode.replace(/[^0-9A-Za-z]/g, '').slice(0, 12) : '';
    if (!roomCode) return res.status(400).json({ error: 'Thiếu mã bàn' });
    if (!(await dbService.areFriends(user.userId, targetId))) {
      return res.status(403).json({ error: 'Chỉ rủ được bạn bè đã kết bạn' });
    }
    const presence = await readPresence(targetId);
    if (presence.state === 'offline') return res.status(409).json({ error: 'Bạn ấy đang bị vợ thu điện thoại 📵' });
    const list = (await readInvites(targetId)).filter((i) => !(i.fromUserId === user.userId && i.roomCode === roomCode));
    const invite: TableInvite = {
      id: crypto.randomBytes(5).toString('hex'),
      fromUserId: user.userId,
      fromName: user.username,
      fromAvatar: user.avatar,
      roomCode,
      at: Date.now(),
    };
    await writeInvites(targetId, [...list, invite]);
    socialHub.notify(targetId, { type: 'table_invite', invite });
    res.json({ success: true, invite });
  } catch (error) {
    sendServerError(res, error, 'Không rủ được');
  }
});

// POST bỏ qua / đã nhận lời rủ
socialRouter.post('/api/social/invites/:id/dismiss', async (req, res) => {
  try {
    const user = me(res);
    const list = await readInvites(user.userId);
    await writeInvites(user.userId, list.filter((i) => i.id !== req.params.id));
    res.json({ success: true });
  } catch (error) {
    sendServerError(res, error, 'Không xóa được lời rủ');
  }
});

// GET hộ chiếu của bạn bè (friends only: strangers can't snoop on your bill-dodging record)
socialRouter.get('/api/social/friends/:userId/profile', async (req, res) => {
  try {
    const user = me(res);
    const friendId = String(req.params.userId);
    if (!(await dbService.areFriends(user.userId, friendId))) {
      return res.status(403).json({ error: 'Kết bạn rồi mới xem được hộ chiếu nhé' });
    }
    const [account, profile, receiptStats, presence] = await Promise.all([
      dbService.findUserById(friendId),
      dbService.getPlayerProfile(friendId),
      dbService.listReceiptStats(friendId),
      readPresence(friendId),
    ]);
    if (!account) return res.status(404).json({ error: 'Không tìm thấy bợm nhậu này' });
    const life = summarizeLifetime(receiptStats as any);
    let pinnedPhoto: FriendProfile['pinnedPhoto'] = null;
    if (profile?.pinnedReceiptCode) {
      const r = await dbService.getMatchReceipt(profile.pinnedReceiptCode);
      if (r?.funnySnapshot) pinnedPhoto = { src: r.funnySnapshot, caption: r.funnySnapshotCaption };
    }
    const result: FriendProfile = {
      userId: account.userId,
      username: account.username,
      avatar: account.avatar || 'dog',
      title: account.title,
      isGuest: Boolean(account.isGuest),
      createdAt: account.createdAt ? new Date(account.createdAt).toISOString() : undefined,
      drunkArchetype: account.drunkArchetype,
      presence,
      coins: profile?.coins ?? account.coins ?? 0,
      drinksCount: Math.max(profile?.drinksCount ?? 0, account.drinksCount ?? 0, life.totalDrinks),
      nights: life.nights,
      nightsEscaped: life.nightsEscaped,
      bestNightScore: Math.max(life.bestScore, profile?.bestNightScore ?? 0),
      peakAlcohol: life.peakAlcohol,
      favoriteQuote: life.favoriteQuote,
      pinnedPhoto,
    };
    res.json(result);
  } catch (error) {
    sendServerError(res, error, 'Không tải được hộ chiếu');
  }
});
