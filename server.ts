// Must be the first import: server/*.ts read process.env when they are imported
import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as ColyseusServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createApp } from './server/app.ts';
import { initMongo } from './server/db/index.ts';
import { TableRoom } from './server/tableRoom.ts';
import { TABLE_ROOM_NAME } from './shared/tableNet.ts';
import { SocialRoom } from './server/realtime/socialRoom.ts';
import { SOCIAL_ROOM_NAME } from './shared/social.ts';

/**
 * Entry point: REST API (server/app.ts) + Vite/static frontend + Colyseus realtime tables,
 * all on one HTTP server.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApp();
const port = process.env.PORT || 3000;

// Setup Vite in Dev or Serve Static in Prod
async function startServer() {
  // Initialize MongoDB connection asynchronously
  // Connects in the background (with retries); APIs answer 503 until it is up
  void initMongo();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  // Realtime tables (Colyseus over WebSocket) share the HTTP server with Express:
  // /matchmake/* goes to Colyseus, everything else falls through to the Express app.
  const httpServer = http.createServer(app);
  const gameServer = new ColyseusServer({
    transport: new WebSocketTransport({ server: httpServer }),
    greet: false,
  });
  gameServer.define(TABLE_ROOM_NAME, TableRoom).filterBy(['roomCode']);
  // Friends list push channel (friend requests, table invites, presence)
  gameServer.define(SOCIAL_ROOM_NAME, SocialRoom);

  await gameServer.listen(Number(port), '0.0.0.0');
  console.log(`Server listening on http://0.0.0.0:${port} (Colyseus room "${TABLE_ROOM_NAME}")`);
}

startServer();
