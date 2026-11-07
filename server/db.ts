import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';
import { BackendUnavailableError } from './errors.ts';
import { normalizeEmail, normalizeUsername, usernameKey } from '../shared/validation.ts';

// Ensure Mongoose fails fast without buffering when DB is offline
mongoose.set('bufferCommands', false);

// ----------------------------------------------------------------------------
// PASSWORD HASHING UTILITIES (PBKDF2 with SHA-512 & Salt)
// ----------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, combinedHash?: string): boolean {
  if (!combinedHash) return false;
  const parts = combinedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  const testHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return testHash === originalHash;
}

// ----------------------------------------------------------------------------
// INTERFACES & SCHEMAS
// ----------------------------------------------------------------------------

export interface IUser extends Document {
  userId: string;
  username: string;
  /** Case-insensitive uniqueness key for `username` (see shared/validation.ts usernameKey) */
  usernameKey?: string;
  email?: string;
  passwordHash?: string;
  avatar: string;
  title: string;
  clothing: string;
  hat: string;
  glassType: string;
  coins: number;
  gems: number;
  drunkArchetype: string;
  declaredTolerance: number;
  drinksCount: number;
  foodEatenCount: number;
  gamesWon: number;
  timesPassedOut: number;
  bikeImpoundMatchesLeft?: number;
  selectedBikeSkin?: string;
  isGuest: boolean;
  roomPin?: string;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoom extends Document {
  roomId: string;
  theme: string;
  drunkSpeed: string;
  rules: {
    micDzo: boolean;
    randomEvents: boolean;
    billBrawl: boolean;
  };
  players: any[];
  dishes: any[];
  totalBill: number;
  chatMessages: {
    id: string;
    sender: string;
    text: string;
    drunkLevel?: number;
    timestamp: number;
  }[];
  truthOrDareLogs: {
    id: string;
    type: string;
    text: string;
    target?: string;
    source?: string;
    completedAt: number;
  }[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPlayerProfile extends Document {
  playerId: string;
  name: string;
  avatar: string;
  title: string;
  clothing: string;
  hat: string;
  glassType: string;
  coins: number;
  gems: number;
  drinksCount: number;
  foodEatenCount: number;
  gamesWon: number;
  timesPassedOut: number;
  bikeImpoundMatchesLeft?: number;
  selectedBikeSkin?: string;
  lastActive: Date;
}

export interface IGameHistory extends Document {
  gameId: string;
  roomId: string;
  gameType: string;
  winnerId: string;
  winnerName: string;
  details?: any;
  createdAt: Date;
}

const RoomSchema = new Schema<IRoom>(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    theme: { type: String, default: 'sidewalk' },
    drunkSpeed: { type: String, default: 'toi_ben' },
    rules: {
      micDzo: { type: Boolean, default: false },
      randomEvents: { type: Boolean, default: true },
      billBrawl: { type: Boolean, default: true },
    },
    players: [Schema.Types.Mixed],
    dishes: [Schema.Types.Mixed],
    totalBill: { type: Number, default: 0 },
    chatMessages: [
      {
        id: String,
        sender: String,
        text: String,
        drunkLevel: Number,
        timestamp: Number,
      },
    ],
    truthOrDareLogs: [
      {
        id: String,
        type: String,
        text: String,
        target: String,
        source: String,
        completedAt: Number,
      },
    ],
    status: { type: String, default: 'active' },
  },
  { timestamps: true }
);

const PlayerProfileSchema = new Schema<IPlayerProfile>(
  {
    playerId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatar: { type: String, default: 'dog' },
    title: { type: String, default: 'Tấm Chiếu Mới' },
    clothing: { type: String, default: 'tanktop_red' },
    hat: { type: String, default: 'none' },
    glassType: { type: String, default: 'beer_mug' },
    coins: { type: Number, default: 240 },
    gems: { type: Number, default: 10 },
    drinksCount: { type: Number, default: 0 },
    foodEatenCount: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    timesPassedOut: { type: Number, default: 0 },
    bikeImpoundMatchesLeft: { type: Number, default: 0 },
    selectedBikeSkin: { type: String, default: 'dream_chien' },
    lastActive: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const GameHistorySchema = new Schema<IGameHistory>(
  {
    gameId: { type: String, required: true, unique: true },
    roomId: { type: String, required: true },
    gameType: { type: String, required: true },
    winnerId: { type: String, required: true },
    winnerName: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

const UserSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, index: true },
    // Unique, case/whitespace-insensitive form of username. Sparse so legacy rows without it
    // don't collide while they are being backfilled.
    usernameKey: { type: String, unique: true, sparse: true },
    email: { type: String, sparse: true, index: true },
    passwordHash: { type: String },
    avatar: { type: String, default: 'dog' },
    title: { type: String, default: 'Tấm Chiếu Mới' },
    clothing: { type: String, default: 'tanktop_red' },
    hat: { type: String, default: 'none' },
    glassType: { type: String, default: 'beer_mug' },
    coins: { type: Number, default: 740 },
    gems: { type: Number, default: 10 },
    drunkArchetype: { type: String, default: 'TRIET_GIA' },
    declaredTolerance: { type: Number, default: 50 },
    drinksCount: { type: Number, default: 0 },
    foodEatenCount: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    timesPassedOut: { type: Number, default: 0 },
    bikeImpoundMatchesLeft: { type: Number, default: 0 },
    selectedBikeSkin: { type: String, default: 'dream_chien' },
    isGuest: { type: Boolean, default: false },
    roomPin: { type: String },
    lastLogin: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<IUser>('User', UserSchema);
export const RoomModel = mongoose.model<IRoom>('Room', RoomSchema);
export const PlayerProfileModel = mongoose.model<IPlayerProfile>('PlayerProfile', PlayerProfileSchema);
export const GameHistoryModel = mongoose.model<IGameHistory>('GameHistory', GameHistorySchema);

// ----------------------------------------------------------------------------
// MONGO DB CONNECTION (required — no fallback)
// ----------------------------------------------------------------------------

const mongoUri = process.env.MONGODB_URI;
let lastMongoError = mongoUri ? 'Đang kết nối…' : 'Chưa cấu hình MONGODB_URI';
const RETRY_MS = 5000;

mongoose.connection.on('connected', () => {
  lastMongoError = '';
  console.log('✅ [MongoDB] Connected');
  backfillUsernameKeys().catch((err) => console.error('❌ [MongoDB] usernameKey backfill failed:', err));
});

/**
 * Give accounts created before usernameKey existed their key, so uniqueness covers them too.
 * Legacy duplicate *guest* names get the same "#1234" tag new guests get; duplicate registered
 * accounts are only logged (never renamed automatically).
 */
async function backfillUsernameKeys() {
  // The legacy `username` unique index cannot build while duplicates exist: don't let that stop us
  await UserModel.createIndexes().catch((err) =>
    console.warn('⚠️ [MongoDB] Some user indexes could not be built yet:', err?.message)
  );

  const legacy = await UserModel.find(
    { usernameKey: { $exists: false } },
    { userId: 1, username: 1, isGuest: 1 }
  ).lean();
  let fixed = 0;
  for (const u of legacy) {
    let name = u.username;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await UserModel.updateOne({ userId: u.userId }, { $set: { username: name, usernameKey: usernameKey(name) } });
        fixed++;
        if (name !== u.username) console.log(`ℹ️ [MongoDB] Duplicate guest "${u.username}" renamed to "${name}"`);
        break;
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;
        if (!u.isGuest) {
          console.warn(`⚠️ [MongoDB] Account "${u.username}" (${u.userId}) duplicates another name; rename it manually.`);
          break;
        }
        name = `${normalizeUsername(u.username)} #${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }
  }
  if (legacy.length) console.log(`ℹ️ [MongoDB] Backfilled usernameKey for ${fixed}/${legacy.length} account(s)`);

  // Now that duplicates are gone, the `username` unique index can be built too
  if (fixed) {
    await UserModel.createIndexes().catch((err) =>
      console.warn('⚠️ [MongoDB] username index still blocked by duplicates:', err?.message)
    );
  }
}

/** Mongo duplicate-key error (E11000), e.g. two sign-ups racing for the same name. */
export function isDuplicateKeyError(err: unknown, field?: string): boolean {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> } | null;
  return e?.code === 11000 && (!field || Boolean(e.keyPattern && field in e.keyPattern));
}
mongoose.connection.on('disconnected', () => {
  if (!lastMongoError) lastMongoError = 'Mất kết nối MongoDB';
  console.error('❌ [MongoDB] Disconnected');
});

/**
 * Connects to MongoDB and keeps retrying in the background until it succeeds.
 * Never throws: while disconnected, data access throws BackendUnavailableError (HTTP 503).
 */
export async function initMongo() {
  if (!mongoUri) {
    console.error('❌ [MongoDB] MONGODB_URI is not set — accounts, rooms and leaderboards are unavailable.');
    return;
  }
  const attempt = async () => {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 4000 });
    } catch (err: any) {
      const message = err?.message || 'Unknown connection error';
      if (message !== lastMongoError) console.error('❌ [MongoDB] Unreachable:', message);
      lastMongoError = message;
      setTimeout(attempt, RETRY_MS);
    }
  };
  await attempt();
}

function requireMongo() {
  if (mongoose.connection.readyState !== 1) {
    throw new BackendUnavailableError('MongoDB', lastMongoError || 'not connected');
  }
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ----------------------------------------------------------------------------
// DATA ACCESS SERVICES
// ----------------------------------------------------------------------------

export const dbService = {
  getStatus() {
    const connected = mongoose.connection.readyState === 1;
    return {
      configured: Boolean(mongoUri),
      connected,
      error: connected ? undefined : lastMongoError || undefined,
    };
  },

  // --- ROOMS / TABLES ---
  async getRoom(roomId: string) {
    requireMongo();
    return RoomModel.findOne({ roomId }).lean();
  },

  async upsertRoom(roomId: string, data: Partial<IRoom>) {
    requireMongo();
    return RoomModel.findOneAndUpdate(
      { roomId },
      { $set: { ...data, roomId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();
  },

  async addRoomChatMessage(
    roomId: string,
    message: { id: string; sender: string; text: string; drunkLevel?: number; timestamp: number }
  ) {
    requireMongo();
    // Keep only the last 50 messages
    return RoomModel.findOneAndUpdate(
      { roomId },
      { $push: { chatMessages: { $each: [message], $slice: -50 } } },
      { returnDocument: 'after' }
    ).lean();
  },

  async addTruthOrDareLog(
    roomId: string,
    log: { id: string; type: string; text: string; target?: string; source?: string; completedAt: number }
  ) {
    requireMongo();
    return RoomModel.findOneAndUpdate(
      { roomId },
      { $push: { truthOrDareLogs: { $each: [log], $slice: -50 } } },
      { returnDocument: 'after' }
    ).lean();
  },

  // --- PLAYERS / PROFILES ---
  async getPlayerProfile(playerId: string) {
    requireMongo();
    return PlayerProfileModel.findOne({ playerId }).lean();
  },

  async updatePlayerProfile(playerId: string, updates: Partial<IPlayerProfile>) {
    requireMongo();
    const { playerId: _ignored, ...safeUpdates } = updates as Record<string, unknown>;
    // `name` is required on insert; only default it via $setOnInsert when it isn't
    // already in $set (the same path in both operators is a ConflictingUpdateOperators error)
    const update: Record<string, unknown> = { $set: { ...safeUpdates, lastActive: new Date() } };
    if (!safeUpdates.name) update.$setOnInsert = { name: 'Bợm Nhậu' };
    return PlayerProfileModel.findOneAndUpdate({ playerId }, update, {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    }).lean();
  },

  async getLeaderboard(limit = 10) {
    requireMongo();
    return PlayerProfileModel.find().sort({ drinksCount: -1, coins: -1 }).limit(limit).lean();
  },

  // --- GAME HISTORY ---
  async recordGame(gameData: {
    gameId: string;
    roomId: string;
    gameType: string;
    winnerId: string;
    winnerName: string;
    details?: any;
  }) {
    requireMongo();
    const doc = await GameHistoryModel.create(gameData);
    return doc.toObject();
  },

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
    await this.updatePlayerProfile(userId, {
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
