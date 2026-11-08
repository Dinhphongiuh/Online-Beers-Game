/** Shared HTTP helpers: backend health + consistent error responses. */
import type express from 'express';
import { dbService } from '../db/index.ts';
import { redis } from '../redis.ts';
import { isDatabaseConnectionError } from '../errors.ts';

export function backendStatus() {
  const mongodb = dbService.getStatus();
  const redisStatus = redis.getStatus();
  return { ready: mongodb.connected && redisStatus.connected, mongodb, redis: redisStatus };
}

/** 503 when MongoDB/Redis is down, 500 for anything else. */
export function sendServerError(res: express.Response, error: unknown, message: string) {
  if (isDatabaseConnectionError(error)) {
    return res.status(503).json({
      error: 'Không kết nối được máy chủ dữ liệu (MongoDB/Redis). Vui lòng thử lại sau.',
      backend: backendStatus(),
    });
  }
  return res.status(500).json({ error: message });
}
