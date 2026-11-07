import IORedis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';
import { BackendUnavailableError } from './errors.ts';

// Redis is required: there is no in-memory fallback. Two ways to configure it:
//   • TCP:  REDIS_URL=redis://… or rediss://…  (ioredis, persistent connection)
//   • REST: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN  (Upstash HTTP API)
// While unconfigured or unreachable, every command throws BackendUnavailableError (HTTP 503).

export interface RedisStatus {
  configured: boolean;
  connected: boolean;
  mode?: 'tcp' | 'rest';
  error?: string;
}

interface RedisDriver {
  mode: 'tcp' | 'rest';
  isReady(): boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, exSeconds?: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}

const redisUrl = process.env.REDIS_URL;
const restUrl = process.env.UPSTASH_REDIS_REST_URL;
const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let lastRedisError = '';
let driver: RedisDriver | null = null;

function logError(message: string) {
  // Only log when the reason changes, retry loops would otherwise spam
  if (message !== lastRedisError) console.error('❌ [Redis]', message);
  lastRedisError = message;
}

function isValidRedisUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === 'redis:' || u.protocol === 'rediss:';
  } catch {
    return false;
  }
}

function createTcpDriver(url: string): RedisDriver {
  const client = new IORedis(url, {
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
    // Fail commands immediately while disconnected instead of queueing them
    enableOfflineQueue: false,
    // Keep trying to (re)connect in the background, backing off to every 5s
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });
  client.on('ready', () => {
    lastRedisError = '';
    console.log('✅ [Redis] Connected (TCP)');
  });
  client.on('error', (err) => logError(err.message));

  return {
    mode: 'tcp',
    isReady: () => client.status === 'ready',
    get: (key) => client.get(key),
    set: (key, value, ex) => (ex ? client.set(key, value, 'EX', ex) : client.set(key, value)),
    del: (...keys) => client.del(...keys),
    incr: (key) => client.incr(key),
    expire: (key, seconds) => client.expire(key, seconds),
    keys: (pattern) => client.keys(pattern),
  };
}

function createRestDriver(url: string, token: string): RedisDriver {
  // Keep values as raw strings: callers JSON.parse what they stored themselves
  const client = new UpstashRedis({ url, token, automaticDeserialization: false });
  let ready = true; // Stateless HTTP: assume ready once configured until a command or ping fails

  // Ping immediately and periodically to verify credentials & connectivity
  const ping = async () => {
    try {
      await client.ping();
      if (!ready) console.log('✅ [Redis] Reconnected (Upstash REST)');
      else console.log('✅ [Redis] Connected (Upstash REST)');
      ready = true;
      lastRedisError = '';
    } catch (err: any) {
      ready = false;
      logError(err?.message || 'Upstash REST ping failed');
    }
    setTimeout(ping, ready ? 60000 : 5000).unref();
  };
  void ping();

  // A failed command also marks the connection down until the next good ping
  const track = async <T,>(p: Promise<T>): Promise<T> => {
    try {
      const res = await p;
      ready = true;
      lastRedisError = '';
      return res;
    } catch (err: any) {
      ready = false;
      logError(err?.message || 'Upstash REST request failed');
      throw new BackendUnavailableError('Redis', lastRedisError);
    }
  };

  return {
    mode: 'rest',
    isReady: () => ready,
    get: (key) => track(client.get<string>(key)),
    set: (key, value, ex) => track(ex ? client.set(key, value, { ex }) : client.set(key, value)),
    del: (...keys) => track(client.del(...keys)),
    incr: (key) => track(client.incr(key)),
    expire: (key, seconds) => track(client.expire(key, seconds)),
    keys: (pattern) => track(client.keys(pattern)),
  };
}

// Extract redis:// or rediss:// URL if user pasted a full `redis-cli -u ...` command or wrapped in quotes
function sanitizeRedisUrl(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '');
  const match = trimmed.match(/rediss?:\/\/[^\s'"]+/i);
  return match ? match[0] : trimmed;
}

const cleanRedisUrl = sanitizeRedisUrl(redisUrl);

if (cleanRedisUrl && isValidRedisUrl(cleanRedisUrl)) {
  lastRedisError = 'Đang kết nối…';
  driver = createTcpDriver(cleanRedisUrl);
} else if (restUrl && restToken) {
  if (redisUrl && !isValidRedisUrl(cleanRedisUrl)) {
    console.warn(
      `⚠️ [Redis] Bỏ qua REDIS_URL không hợp lệ ("${redisUrl}"), tự động dùng UPSTASH_REDIS_REST_URL.`
    );
  }
  lastRedisError = '';
  driver = createRestDriver(restUrl.trim(), restToken.trim());
} else if (redisUrl) {
  // e.g. a single character "m" or invalid string when Upstash REST is not configured
  logError('REDIS_URL không hợp lệ (phải có dạng redis:// hoặc rediss://user:pass@host:port)');
} else {
  logError('Chưa cấu hình REDIS_URL hoặc UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN');
}

function ready(): RedisDriver {
  if (!driver || !driver.isReady()) {
    throw new BackendUnavailableError('Redis', lastRedisError || 'not connected');
  }
  return driver;
}

export const redis = {
  get: (key: string) => ready().get(key),

  set: (key: string, value: string, mode?: 'EX', seconds?: number) =>
    ready().set(key, value, mode === 'EX' ? seconds : undefined),

  del: (...keys: string[]) => ready().del(...keys),

  incr: (key: string) => ready().incr(key),

  expire: (key: string, seconds: number) => ready().expire(key, seconds),

  keys: (pattern: string) => ready().keys(pattern),

  getStatus(): RedisStatus {
    const connected = Boolean(driver?.isReady());
    return {
      configured: Boolean(driver) || Boolean(redisUrl),
      connected,
      mode: driver?.mode,
      error: connected ? undefined : lastRedisError || undefined,
    };
  },
};
