/**
 * MongoDB connection (required — no in-memory fallback). Connects in the background with
 * retries; while it is down, every repository call throws BackendUnavailableError (HTTP 503).
 */
import mongoose from 'mongoose';
import { BackendUnavailableError } from '../errors.ts';
import { normalizeUsername, usernameKey } from '../../shared/validation.ts';
import { UserModel } from './models/user.ts';

// Fail fast instead of buffering queries while the DB is offline
mongoose.set('bufferCommands', false);

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

export function requireMongo() {
  if (mongoose.connection.readyState !== 1) {
    throw new BackendUnavailableError('MongoDB', lastMongoError || 'not connected');
  }
}


export function getMongoStatus() {
  const connected = mongoose.connection.readyState === 1;
  return {
    configured: Boolean(mongoUri),
    connected,
    error: connected ? undefined : lastMongoError || undefined,
  };
}
