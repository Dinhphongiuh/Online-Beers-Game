import express, { Router } from 'express';
import { backendStatus } from '../http/respond.ts';
import { geminiConfigured } from '../services/gemini.ts';

export const statusRouter = Router();

statusRouter.get('/api/status', async (_req, res) => {
  const { ready, mongodb: dbStatus, redis: redisStatus } = backendStatus();

  res.json({
    status: ready ? 'ok' : 'unavailable',
    ready,
    timestamp: Date.now(),
    database: {
      mongodb: dbStatus,
      redis: redisStatus,
    },
    gemini: {
      configured: geminiConfigured,
    },
  });
});

/** Every other API needs MongoDB + Redis: there is no in-memory fallback. */
export const requireBackend: express.RequestHandler = (req, res, next) => {
  const status = backendStatus();
  if (status.ready) return next();
  const missing = [
    !status.mongodb.connected && `MongoDB (${status.mongodb.error || 'chưa kết nối'})`,
    !status.redis.connected && `Redis (${status.redis.error || 'chưa kết nối'})`,
  ].filter(Boolean);
  res.status(503).json({
    error: `Không kết nối được máy chủ: ${missing.join(', ')}`,
    backend: status,
  });
};
