import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

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
// IN-MEMORY DATA STORE (Zero-friction fallback if MongoDB is offline)
// ----------------------------------------------------------------------------

class InMemoryDataStore {
  rooms = new Map<string, any>();
  playerProfiles = new Map<string, any>();
  users = new Map<string, any>();
  gameHistory: any[] = [];

  constructor() {
    // Seed default registered demo user
    const defaultPasswordHash = hashPassword('khongsaykhongve123');
    this.users.set('cauvang_doluc', {
      userId: 'cauvang_doluc',
      username: 'cauvang_doluc',
      email: 'cauvang_doluc@nhau.vn',
      passwordHash: defaultPasswordHash,
      avatar: 'dog',
      title: 'Hệ Nhiệt Tình • Cậu Vàng',
      clothing: 'tanktop_white',
      hat: 'sunglasses',
      glassType: 'beer_mug',
      coins: 740,
      gems: 10,
      drunkArchetype: 'TRIET_GIA',
      declaredTolerance: 75,
      drinksCount: 5,
      foodEatenCount: 2,
      gamesWon: 2,
      timesPassedOut: 0,
      isGuest: false,
      lastLogin: new Date(),
      createdAt: new Date(),
    });
    // Seed initial demo player profiles
    this.playerProfiles.set('user', {
      playerId: 'user',
      name: 'Bợm Nhậu (Bạn)',
      avatar: 'dog',
      title: 'Tấm Chiếu Mới',
      clothing: 'tanktop_red',
      hat: 'none',
      glassType: 'beer_mug',
      coins: 240,
      gems: 10,
      drinksCount: 2,
      foodEatenCount: 0,
      gamesWon: 1,
      timesPassedOut: 0,
      lastActive: new Date(),
    });
    this.playerProfiles.set('bot_phiquan', {
      playerId: 'bot_phiquan',
      name: 'Phi Quân',
      avatar: 'panda',
      title: 'Gấu Trúc Đô Bất Tử',
      clothing: 'floral_shirt',
      hat: 'sunglasses',
      glassType: 'coi_glass',
      coins: 500,
      gems: 20,
      drinksCount: 15,
      foodEatenCount: 8,
      gamesWon: 6,
      timesPassedOut: 1,
      lastActive: new Date(),
    });
    this.playerProfiles.set('bot_khoanguyen', {
      playerId: 'bot_khoanguyen',
      name: 'Khoa Nguyễn',
      avatar: 'bear',
      title: 'Gấu Nâu Diệt Mồi',
      clothing: 'tanktop_white',
      hat: 'none',
      glassType: 'beer_mug',
      coins: 380,
      gems: 15,
      drinksCount: 12,
      foodEatenCount: 19,
      gamesWon: 4,
      timesPassedOut: 2,
      lastActive: new Date(),
    });
    this.playerProfiles.set('bot_baonguyen', {
      playerId: 'bot_baonguyen',
      name: 'Bảo Nguyễn',
      avatar: 'cat',
      title: 'Chúa Tể Trốn Bill',
      clothing: 'gold_chain',
      hat: 'traffic_helmet',
      glassType: 'horn',
      coins: 850,
      gems: 50,
      drinksCount: 18,
      foodEatenCount: 3,
      gamesWon: 9,
      timesPassedOut: 3,
      lastActive: new Date(),
    });
    this.playerProfiles.set('bot_ngaphan', {
      playerId: 'bot_ngaphan',
      name: 'Nga Phan',
      avatar: 'hamster',
      title: 'Uống Coca • Thánh Phá Mồi 🥤',
      clothing: 'floral_shirt',
      hat: 'none',
      glassType: 'coi_glass',
      coins: 620,
      gems: 30,
      drinksCount: 0,
      foodEatenCount: 25,
      gamesWon: 5,
      timesPassedOut: 0,
      lastActive: new Date(),
    });
  }
}

const memoryStore = new InMemoryDataStore();

// ----------------------------------------------------------------------------
// MONGO DB CONNECTION STATE
// ----------------------------------------------------------------------------

let isMongoConnected = false;
let lastMongoError = '';

export async function initMongo() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log('ℹ️ [MongoDB] No MONGODB_URI provided. Running in-memory MongoDB fallback store.');
    return;
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2500,
    });
    isMongoConnected = true;
    lastMongoError = '';
    console.log('✅ [MongoDB] Successfully connected to MongoDB database');
  } catch (err: any) {
    isMongoConnected = false;
    lastMongoError = err.message || 'Unknown connection error';
    console.warn('⚠️ [MongoDB] Offline or unreachable, falling back to in-memory store:', lastMongoError);
  }
}

// ----------------------------------------------------------------------------
// UNIFIED DATA ACCESS SERVICES (Seamless Mongo + Fallback)
// ----------------------------------------------------------------------------

export const dbService = {
  getStatus() {
    return {
      connected: isMongoConnected,
      provider: isMongoConnected ? 'mongodb-mongoose' : 'in-memory-mock',
      error: lastMongoError || undefined,
    };
  },

  // --- ROOMS / TABLES ---
  async getRoom(roomId: string) {
    if (isMongoConnected) {
      try {
        const room = await RoomModel.findOne({ roomId }).lean();
        if (room) return room;
      } catch (err) {
        console.warn('MongoDB getRoom query failed, checking memory:', err);
      }
    }
    return memoryStore.rooms.get(roomId) || null;
  },

  async upsertRoom(roomId: string, data: Partial<IRoom>) {
    const updatedData = {
      roomId,
      ...data,
      updatedAt: new Date(),
    };

    // Always keep memoryStore updated
    const existing = memoryStore.rooms.get(roomId) || { createdAt: new Date() };
    const merged = { ...existing, ...updatedData };
    memoryStore.rooms.set(roomId, merged);

    if (isMongoConnected) {
      try {
        await RoomModel.findOneAndUpdate(
          { roomId },
          { $set: updatedData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (err) {
        console.warn('MongoDB upsertRoom failed, saved in memory:', err);
      }
    }

    return merged;
  },

  async addRoomChatMessage(roomId: string, message: { id: string; sender: string; text: string; drunkLevel?: number; timestamp: number }) {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    const messages = room.chatMessages || [];
    messages.push(message);
    // keep last 50 messages
    if (messages.length > 50) messages.splice(0, messages.length - 50);

    return this.upsertRoom(roomId, { chatMessages: messages });
  },

  async addTruthOrDareLog(roomId: string, log: { id: string; type: string; text: string; target?: string; source?: string; completedAt: number }) {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    const logs = room.truthOrDareLogs || [];
    logs.push(log);
    if (logs.length > 50) logs.splice(0, logs.length - 50);

    return this.upsertRoom(roomId, { truthOrDareLogs: logs });
  },

  // --- PLAYERS / PROFILES ---
  async getPlayerProfile(playerId: string) {
    if (isMongoConnected) {
      try {
        const profile = await PlayerProfileModel.findOne({ playerId }).lean();
        if (profile) return profile;
      } catch (err) {
        console.warn('MongoDB getPlayerProfile failed, checking memory:', err);
      }
    }
    return memoryStore.playerProfiles.get(playerId) || null;
  },

  async updatePlayerProfile(playerId: string, updates: Partial<IPlayerProfile>) {
    const existing = memoryStore.playerProfiles.get(playerId) || {
      playerId,
      name: 'Bợm Nhậu',
      coins: 200,
      gems: 10,
      drinksCount: 0,
      foodEatenCount: 0,
      gamesWon: 0,
      timesPassedOut: 0,
      createdAt: new Date(),
    };

    const merged = { ...existing, ...updates, lastActive: new Date() };
    memoryStore.playerProfiles.set(playerId, merged);

    if (isMongoConnected) {
      try {
        await PlayerProfileModel.findOneAndUpdate(
          { playerId },
          { $set: updates, $setOnInsert: { createdAt: new Date() } },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.warn('MongoDB updatePlayerProfile failed, saved in memory:', err);
      }
    }

    return merged;
  },

  async getLeaderboard(limit = 10) {
    if (isMongoConnected) {
      try {
        const top = await PlayerProfileModel.find()
          .sort({ drinksCount: -1, coins: -1 })
          .limit(limit)
          .lean();
        if (top && top.length > 0) return top;
      } catch (err) {
        console.warn('MongoDB getLeaderboard failed, fallback to memory:', err);
      }
    }

    const profiles = Array.from(memoryStore.playerProfiles.values());
    profiles.sort((a, b) => (b.drinksCount || 0) - (a.drinksCount || 0) || (b.coins || 0) - (a.coins || 0));
    return profiles.slice(0, limit);
  },

  // --- GAME HISTORY ---
  async recordGame(gameData: { gameId: string; roomId: string; gameType: string; winnerId: string; winnerName: string; details?: any }) {
    const record = { ...gameData, createdAt: new Date() };
    memoryStore.gameHistory.push(record);

    if (isMongoConnected) {
      try {
        await GameHistoryModel.create(record);
      } catch (err) {
        console.warn('MongoDB recordGame failed, saved in memory:', err);
      }
    }

    return record;
  },

  // --- AUTH & USERS (AUTHENTIC REAL DATABASE / IN-MEMORY PERSISTENCE) ---
  async findUserByIdentifier(identifier: string): Promise<any | null> {
    const cleanId = (identifier || '').trim().toLowerCase();
    if (!cleanId) return null;

    if (isMongoConnected) {
      try {
        const user = await UserModel.findOne({
          $or: [
            { username: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
            { email: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
          ],
        }).lean();
        if (user) return user;
      } catch (err) {
        console.warn('MongoDB findUserByIdentifier query failed, checking memory:', err);
      }
    }

    for (const u of memoryStore.users.values()) {
      if (
        (u.username && u.username.toLowerCase() === cleanId) ||
        (u.email && u.email.toLowerCase() === cleanId) ||
        (u.userId && u.userId.toLowerCase() === cleanId)
      ) {
        return u;
      }
    }
    return null;
  },

  async findUserById(userId: string): Promise<any | null> {
    if (!userId) return null;

    if (isMongoConnected) {
      try {
        const user = await UserModel.findOne({ userId }).lean();
        if (user) return user;
      } catch (err) {
        console.warn('MongoDB findUserById failed, checking memory:', err);
      }
    }

    return memoryStore.users.get(userId) || null;
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
    const userId = userData.isGuest
      ? `guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      : userData.username.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const passwordHash = userData.password ? hashPassword(userData.password) : undefined;

    const userObj = {
      userId,
      username: userData.username,
      email: userData.email?.toLowerCase(),
      passwordHash,
      avatar: userData.avatar || 'dog',
      title: userData.title || 'Tấm Chiếu Mới',
      clothing: 'tanktop_red',
      hat: 'none',
      glassType: 'beer_mug',
      coins: userData.coins ?? 740,
      gems: 10,
      drunkArchetype: userData.drunkArchetype || 'TRIET_GIA',
      declaredTolerance: userData.declaredTolerance ?? 50,
      drinksCount: 0,
      foodEatenCount: 0,
      gamesWon: 0,
      timesPassedOut: 0,
      isGuest: Boolean(userData.isGuest),
      roomPin: userData.roomPin,
      lastLogin: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memoryStore.users.set(userId, userObj);

    // Also sync with player profile for table leaderboards
    await this.updatePlayerProfile(userId, {
      name: userObj.username,
      avatar: userObj.avatar,
      title: userObj.title,
      coins: userObj.coins,
      gems: userObj.gems,
    });

    if (isMongoConnected) {
      try {
        await UserModel.create(userObj);
      } catch (err) {
        console.warn('MongoDB createUser failed, stored in memory:', err);
      }
    }

    return userObj;
  },

  async updateUser(userId: string, updates: Partial<IUser>): Promise<any> {
    const existing = await this.findUserById(userId);
    if (!existing) return null;

    const merged = { ...existing, ...updates, updatedAt: new Date() };
    memoryStore.users.set(userId, merged);

    if (isMongoConnected) {
      try {
        await UserModel.findOneAndUpdate(
          { userId },
          { $set: updates },
          { new: true }
        );
      } catch (err) {
        console.warn('MongoDB updateUser failed, updated in memory:', err);
      }
    }

    return merged;
  },
};

