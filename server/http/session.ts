/** Redis-backed login sessions (Bearer tokens). */
import type express from 'express';
import { redis } from '../redis.ts';

/** Signed-in players keep their passport under their account id; guests under their device id. */
export async function resolvePassportOwner(req: express.Request, paramId: unknown): Promise<string> {
  let ownerId = String(paramId || '').slice(0, 64) || 'guest';
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const rawSession = await redis.get(`session:${authHeader.substring(7).trim()}`).catch(() => null);
    const session = rawSession ? JSON.parse(rawSession) : null;
    if (session?.userId) ownerId = String(session.userId);
  }
  return ownerId;
}

export interface SessionUser {
  userId: string;
  username: string;
  avatar: string;
  isGuest: boolean;
}

/** Redis values may come back already parsed (Upstash REST) or as JSON strings (TCP). */
export function parseRedisJson<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function readSession(req: express.Request): Promise<SessionUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const raw = await redis.get(`session:${authHeader.substring(7).trim()}`);
  const s = parseRedisJson<Record<string, unknown>>(raw);
  if (!s?.userId) return null;
  return {
    userId: String(s.userId),
    username: String(s.username || 'Bợm Nhậu'),
    avatar: String(s.avatar || 'dog'),
    isGuest: Boolean(s.isGuest),
  };
}

/** Route guard: 401 without a valid session; otherwise `res.locals.user` is the SessionUser. */
export const requireSession: express.RequestHandler = async (req, res, next) => {
  try {
    const user = await readSession(req);
    if (!user) return res.status(401).json({ error: 'Chưa đăng nhập — mời qua Cổng Quán' });
    res.locals.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
