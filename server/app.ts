/**
 * Express app: JSON body, health check, the MongoDB/Redis gate, then one router per domain.
 * New API area → add server/routes/<name>.ts and mount it below.
 */
import express from 'express';
import { sendServerError } from './http/respond.ts';
import { requireBackend, statusRouter } from './routes/status.ts';
import { authRouter } from './routes/auth.ts';
import { roomsRouter } from './routes/rooms.ts';
import { playersRouter } from './routes/players.ts';
import { receiptsRouter } from './routes/receipts.ts';
import { commuteRouter } from './routes/commute.ts';
import { aiRouter } from './routes/ai.ts';
import { socialRouter } from './routes/social.ts';
import { npcsRouter } from './routes/npcs.ts';
import { devRouter } from './routes/dev.ts';

export function createApp() {
  const app = express();

  // Night receipts carry a small JPEG polaroid (<= ~90 KB)
  app.use(express.json({ limit: '512kb' }));

  // Health check answers even while the databases are down
  app.use(statusRouter);
  app.use('/api', requireBackend);

  app.use(authRouter);
  app.use(roomsRouter);
  app.use(playersRouter);
  app.use(receiptsRouter);
  app.use(commuteRouter);
  app.use(aiRouter);
  app.use(socialRouter);
  app.use(npcsRouter);
  app.use(devRouter);

  // Database outages surface as 503 (never as fake empty data)
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    console.error('Unhandled API error:', err);
    sendServerError(res, err, 'Lỗi hệ thống');
  });

  return app;
}
