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
