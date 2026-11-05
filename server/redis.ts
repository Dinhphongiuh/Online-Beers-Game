import Redis from 'ioredis';

// In-Memory Fallback Store (implements Redis-like interface with TTL)
interface CacheEntry {
  value: string;
  expireAt?: number;
}

class InMemoryRedis {
  private store = new Map<string, CacheEntry>();
  private hashStore = new Map<string, Map<string, string>>();

  private cleanIfExpired(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return true;
    if (entry.expireAt && Date.now() > entry.expireAt) {
      this.store.delete(key);
      return true;
    }
    return false;
  }

  async get(key: string): Promise<string | null> {
    if (this.cleanIfExpired(key)) return null;
    return this.store.get(key)?.value ?? null;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK'> {
    let expireAt: number | undefined;
    if (mode === 'EX' && duration) {
      expireAt = Date.now() + duration * 1000;
    } else if (mode === 'PX' && duration) {
      expireAt = Date.now() + duration;
    }
    this.store.set(key, { value, expireAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
      if (this.hashStore.delete(k)) count++;
    }
    return count;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const nextVal = (Number(current) || 0) + 1;
    await this.set(key, String(nextVal));
    return nextVal;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expireAt = Date.now() + seconds * 1000;
    return 1;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    let map = this.hashStore.get(key);
    if (!map) {
      map = new Map();
      this.hashStore.set(key, map);
    }
    const isNew = !map.has(field);
    map.set(field, value);
    return isNew ? 1 : 0;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashStore.get(key)?.get(field) ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const map = this.hashStore.get(key);
    if (!map) return {};
    const obj: Record<string, string> = {};
    for (const [k, v] of map.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  async keys(pattern: string): Promise<string[]> {
    const now = Date.now();
    const result: string[] = [];
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const [key, entry] of this.store.entries()) {
      if (entry.expireAt && now > entry.expireAt) {
        this.store.delete(key);
        continue;
      }
      if (regex.test(key)) {
        result.push(key);
      }
    }
    return result;
  }

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }
}

// Redis Client Manager
export interface RedisService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<'OK'>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  hset(key: string, field: string, value: string): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  keys(pattern: string): Promise<string[]>;
  ping(): Promise<string>;
  getStatus(): { connected: boolean; provider: 'ioredis' | 'in-memory-mock'; error?: string };
}

let redisClient: Redis | null = null;
const inMemoryFallback = new InMemoryRedis();
let isRealRedisConnected = false;
let lastRedisError = '';

const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2500,
      retryStrategy: () => null, // don't spam if unreachable
    });

    redisClient.on('connect', () => {
      console.log('✅ [Redis] Connected to external Redis instance');
      isRealRedisConnected = true;
      lastRedisError = '';
    });

    redisClient.on('error', (err) => {
      isRealRedisConnected = false;
      lastRedisError = err.message;
      console.warn('⚠️ [Redis] Offline or unreachable, falling back to in-memory store:', err.message);
    });

    // Try connecting in background
    redisClient.connect().catch((err) => {
      isRealRedisConnected = false;
      lastRedisError = err.message;
      console.warn('⚠️ [Redis] Connection failed, using in-memory store:', err.message);
    });
  } catch (err) {
    console.warn('⚠️ [Redis] Initialization failed, using in-memory store');
    redisClient = null;
  }
} else {
  console.log('ℹ️ [Redis] No REDIS_URL provided. Running high-speed in-memory store.');
}

export const redis: RedisService = {
  async get(key: string): Promise<string | null> {
    if (isRealRedisConnected && redisClient) {
      try {
        return await redisClient.get(key);
      } catch {
        return inMemoryFallback.get(key);
      }
    }
    return inMemoryFallback.get(key);
  },

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK'> {
    if (isRealRedisConnected && redisClient) {
      try {
        if (mode === 'EX' && duration) {
          await redisClient.set(key, value, 'EX', duration);
        } else {
          await redisClient.set(key, value);
        }
        // Mirror in memory for instant read fallback
        inMemoryFallback.set(key, value, mode, duration);
        return 'OK';
      } catch {
        return inMemoryFallback.set(key, value, mode, duration);
      }
    }
    return inMemoryFallback.set(key, value, mode, duration);
  },

  async del(...keys: string[]): Promise<number> {
    if (isRealRedisConnected && redisClient) {
      try {
        await redisClient.del(...keys);
      } catch (e) {
        // ignore
      }
    }
    return inMemoryFallback.del(...keys);
  },

  async incr(key: string): Promise<number> {
    if (isRealRedisConnected && redisClient) {
      try {
        const val = await redisClient.incr(key);
        await inMemoryFallback.set(key, String(val));
        return val;
      } catch {
        return inMemoryFallback.incr(key);
      }
    }
    return inMemoryFallback.incr(key);
  },

  async expire(key: string, seconds: number): Promise<number> {
    if (isRealRedisConnected && redisClient) {
      try {
        await redisClient.expire(key, seconds);
      } catch (e) {
        // ignore
      }
    }
    return inMemoryFallback.expire(key, seconds);
  },

  async hset(key: string, field: string, value: string): Promise<number> {
    if (isRealRedisConnected && redisClient) {
      try {
        await redisClient.hset(key, field, value);
      } catch (e) {
        // ignore
      }
    }
    return inMemoryFallback.hset(key, field, value);
  },

  async hget(key: string, field: string): Promise<string | null> {
    if (isRealRedisConnected && redisClient) {
      try {
        return await redisClient.hget(key, field);
      } catch {
        return inMemoryFallback.hget(key, field);
      }
    }
    return inMemoryFallback.hget(key, field);
  },

  async hgetall(key: string): Promise<Record<string, string>> {
    if (isRealRedisConnected && redisClient) {
      try {
        return await redisClient.hgetall(key);
      } catch {
        return inMemoryFallback.hgetall(key);
      }
    }
    return inMemoryFallback.hgetall(key);
  },

  async keys(pattern: string): Promise<string[]> {
    if (isRealRedisConnected && redisClient) {
      try {
        return await redisClient.keys(pattern);
      } catch {
        return inMemoryFallback.keys(pattern);
      }
    }
    return inMemoryFallback.keys(pattern);
  },

  async ping(): Promise<string> {
    if (isRealRedisConnected && redisClient) {
      try {
        return await redisClient.ping();
      } catch {
        return inMemoryFallback.ping();
      }
    }
    return inMemoryFallback.ping();
  },

  getStatus() {
    return {
      connected: isRealRedisConnected,
      provider: isRealRedisConnected ? 'ioredis' : 'in-memory-mock',
      error: lastRedisError || undefined,
    };
  },
};
