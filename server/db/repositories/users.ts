import crypto from 'crypto';
import { requireMongo } from '../connection.ts';
import { UserModel, type IUser } from '../models/user.ts';
import { hashPassword } from '../password.ts';
import { normalizeEmail, normalizeUsername, usernameKey } from '../../../shared/validation.ts';
import { playersRepo } from './players.ts';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const usersRepo = {
  // --- AUTH & USERS ---
  async findUserByIdentifier(identifier: string): Promise<any | null> {
    const cleanId = (identifier || '').trim().toLowerCase();
    if (!cleanId) return null;
    requireMongo();
    const byKey = await UserModel.findOne({
      $or: [{ usernameKey: usernameKey(identifier) }, { email: normalizeEmail(identifier) }, { userId: cleanId }],
    }).lean();
    if (byKey) return byKey;
    // Legacy rows that could not be backfilled (case-clash): fall back to a case-insensitive match
    const exact = new RegExp(`^${escapeRegex(normalizeUsername(identifier))}$`, 'i');
    return UserModel.findOne({ username: exact, usernameKey: { $exists: false } }).lean();
  },

  /** True when a username (case/whitespace-insensitive) is already taken. */
  async isUsernameTaken(username: string): Promise<boolean> {
    requireMongo();
    const key = usernameKey(username);
    if (await UserModel.exists({ usernameKey: key })) return true;
    const exact = new RegExp(`^${escapeRegex(normalizeUsername(username))}$`, 'i');
    return Boolean(await UserModel.exists({ username: exact }));
  },

  async isEmailTaken(email: string): Promise<boolean> {
    requireMongo();
    return Boolean(await UserModel.exists({ email: normalizeEmail(email) }));
  },

  async findUserById(userId: string): Promise<any | null> {
    if (!userId) return null;
    requireMongo();
    return UserModel.findOne({ userId }).lean();
  },

  async createUser(userData: {
    username: string;
    email?: string;
    password?: string;
    avatar?: string;
    title?: string;
    drunkArchetype?: string;
    declaredTolerance?: number;
    coins?: number;
    isGuest?: boolean;
    roomPin?: string;
  }): Promise<any> {
    requireMongo();
    // Strip Vietnamese diacritics before slugging so "Hòa" and "Hoà" don't both become "ho_",
    // and add a random suffix so different usernames can never collide on userId
    const slug =
      userData.username
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24) || 'user';
    const suffix = crypto.randomBytes(3).toString('hex');
    const userId = userData.isGuest ? `guest_${Date.now()}_${suffix}` : `${slug}_${suffix}`;

    const doc = await UserModel.create({
      userId,
      username: normalizeUsername(userData.username),
      usernameKey: usernameKey(userData.username),
      email: userData.email ? normalizeEmail(userData.email) : undefined,
      passwordHash: userData.password ? hashPassword(userData.password) : undefined,
      avatar: userData.avatar || 'dog',
      title: userData.title || 'Tấm Chiếu Mới',
      coins: userData.coins ?? 740,
      drunkArchetype: userData.drunkArchetype || 'TRIET_GIA',
      declaredTolerance: userData.declaredTolerance ?? 50,
      isGuest: Boolean(userData.isGuest),
      roomPin: userData.roomPin,
      lastLogin: new Date(),
    });
    const user = doc.toObject();

    // Keep the table leaderboard profile in sync
    await playersRepo.updatePlayerProfile(userId, {
      name: user.username,
      avatar: user.avatar,
      title: user.title,
      coins: user.coins,
      gems: user.gems,
    });

    return user;
  },

  async updateUser(userId: string, updates: Partial<IUser>): Promise<any> {
    requireMongo();
    return UserModel.findOneAndUpdate({ userId }, { $set: updates }, { returnDocument: 'after' }).lean();
  },
};
