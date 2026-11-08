import { requireMongo } from '../connection.ts';
import { FriendshipModel, pairKeyOf } from '../models/friendship.ts';
import { UserModel } from '../models/user.ts';
import type { SocialUser } from '../../../shared/social.ts';

export type FriendRequestResult = 'sent' | 'accepted' | 'already_friends' | 'already_pending';

export const friendsRepo = {
  /** Sends a request — or accepts on the spot when the other side already asked us. */
  async requestFriend(fromId: string, toId: string): Promise<FriendRequestResult> {
    requireMongo();
    const pairKey = pairKeyOf(fromId, toId);
    const existing = await FriendshipModel.findOne({ pairKey }).lean();
    if (existing?.status === 'accepted') return 'already_friends';
    if (existing && existing.requesterId === fromId) return 'already_pending';
    if (existing) {
      await FriendshipModel.updateOne({ pairKey }, { $set: { status: 'accepted', acceptedAt: new Date() } });
      return 'accepted';
    }
    await FriendshipModel.create({ pairKey, userIds: [fromId, toId], requesterId: fromId, status: 'pending' });
    return 'sent';
  },

  /** Accepts a pending request the other user sent me. */
  async acceptFriend(meId: string, otherId: string) {
    requireMongo();
    const res = await FriendshipModel.updateOne(
      { pairKey: pairKeyOf(meId, otherId), requesterId: otherId, status: 'pending' },
      { $set: { status: 'accepted', acceptedAt: new Date() } }
    );
    return res.modifiedCount > 0;
  },

  /** Decline / cancel / unfriend: the pair is simply gone. */
  async removeFriend(meId: string, otherId: string) {
    requireMongo();
    const res = await FriendshipModel.deleteOne({ pairKey: pairKeyOf(meId, otherId) });
    return res.deletedCount > 0;
  },

  async areFriends(a: string, b: string) {
    requireMongo();
    return Boolean(await FriendshipModel.exists({ pairKey: pairKeyOf(a, b), status: 'accepted' }));
  },

  /** Friends + pending requests in both directions, with each person's public profile. */
  async listSocial(meId: string): Promise<{ friends: SocialUser[]; incoming: SocialUser[]; outgoing: SocialUser[] }> {
    requireMongo();
    const rows = await FriendshipModel.find({ userIds: meId }).limit(300).lean();
    const otherOf = (r: { userIds: string[] }) => r.userIds.find((id) => id !== meId) ?? r.userIds[0];
    const ids = [...new Set(rows.map(otherOf))];
    const users = await UserModel.find({ userId: { $in: ids } }, { userId: 1, username: 1, avatar: 1, title: 1 }).lean();
    const byId = new Map(users.map((u) => [u.userId, u]));
    const view = (id: string): SocialUser | null => {
      const u = byId.get(id);
      return u ? { userId: u.userId, username: u.username, avatar: u.avatar || 'dog', title: u.title } : null;
    };
    const friends: SocialUser[] = [];
    const incoming: SocialUser[] = [];
    const outgoing: SocialUser[] = [];
    for (const r of rows) {
      const v = view(otherOf(r));
      if (!v) continue;
      if (r.status === 'accepted') friends.push(v);
      else if (r.requesterId === meId) outgoing.push(v);
      else incoming.push(v);
    }
    return { friends, incoming, outgoing };
  },
};
