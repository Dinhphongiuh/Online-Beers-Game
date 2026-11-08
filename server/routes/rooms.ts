/** Tables: room state (Redis cache over MongoDB), presence, chat, minigame records. */
import { Router } from 'express';
import { dbService } from '../db/index.ts';
import { redis } from '../redis.ts';
import { sendServerError } from '../http/respond.ts';

export const roomsRouter = Router();

// GET room state: checks Redis cache first, then MongoDB
roomsRouter.get('/api/rooms/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const cacheKey = `room:${roomId}`;

  try {
    // 1. Try Redis cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({ room: JSON.parse(cached), source: 'redis-cache' });
    }

    // 2. Fetch from MongoDB
    const room = await dbService.getRoom(roomId);
    if (room) {
      // Cache in Redis for 1 hour
      await redis.set(cacheKey, JSON.stringify(room), 'EX', 3600);
      return res.json({ room, source: 'mongodb' });
    }

    return res.status(404).json({ error: 'Room not found' });
  } catch (error) {
    console.error('Error fetching room:', error);
    sendServerError(res, error, 'Failed to retrieve room');
  }
});

// POST upsert room state: saves to MongoDB and updates Redis cache
roomsRouter.post('/api/rooms', async (req, res) => {
  const { roomId, theme, drunkSpeed, rules, players, dishes, totalBill } = req.body;
  if (!roomId) {
    return res.status(400).json({ error: 'roomId is required' });
  }

  try {
    const saved = await dbService.upsertRoom(roomId, {
      theme,
      drunkSpeed,
      rules,
      players,
      dishes,
      totalBill,
      status: 'active',
    });

    // Write-through update to Redis cache
    const cacheKey = `room:${roomId}`;
    await redis.set(cacheKey, JSON.stringify(saved), 'EX', 3600);

    res.json({ success: true, room: saved });
  } catch (error) {
    console.error('Error saving room:', error);
    sendServerError(res, error, 'Failed to save room');
  }
});

// POST player heartbeat to Redis with 45s TTL for active presence
roomsRouter.post('/api/rooms/:roomId/heartbeat', async (req, res) => {
  const { roomId } = req.params;
  const { playerId, playerName } = req.body;

  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }

  try {
    const key = `presence:${roomId}:${playerId}`;
    await redis.set(key, JSON.stringify({ playerId, playerName: playerName || playerId, lastSeen: Date.now() }), 'EX', 45);

    res.json({ success: true, active: true });
  } catch (error) {
    sendServerError(res, error, 'Heartbeat error');
  }
});

// GET online players in room via Redis
roomsRouter.get('/api/rooms/:roomId/presence', async (req, res) => {
  const { roomId } = req.params;
  try {
    const keys = await redis.keys(`presence:${roomId}:*`);
    const activePlayers: any[] = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        try {
          activePlayers.push(JSON.parse(data));
        } catch {
          // ignore parse error
        }
      }
    }
    res.json({ roomId, activeCount: activePlayers.length, players: activePlayers });
  } catch (error) {
    sendServerError(res, error, 'Presence check error');
  }
});

// POST chat message: stored in MongoDB & cached in Redis
roomsRouter.post('/api/rooms/:roomId/chat', async (req, res) => {
  const { roomId } = req.params;
  const { id, sender, text, drunkLevel } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Message text required' });
  }

  const msg = {
    id: id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sender: sender || 'Bợm Nhậu',
    text,
    drunkLevel: Number(drunkLevel) || 0,
    timestamp: Date.now(),
  };

  try {
    // 1. Save in MongoDB
    const updatedRoom = await dbService.addRoomChatMessage(roomId, msg);

    // 2. Refresh Redis room cache
    if (updatedRoom) {
      await redis.set(`room:${roomId}`, JSON.stringify(updatedRoom), 'EX', 3600);
    }

    res.json({ success: true, message: msg });
  } catch (error) {
    console.error('Error posting chat message:', error);
    sendServerError(res, error, 'Failed to post message');
  }
});

// GET chat messages: from Redis cache or MongoDB
roomsRouter.get('/api/rooms/:roomId/chat', async (req, res) => {
  const { roomId } = req.params;
  try {
    const room = await dbService.getRoom(roomId);
    res.json({ messages: room?.chatMessages || [] });
  } catch (error) {
    sendServerError(res, error, 'Failed to get messages');
  }
});

// POST record minigame match
roomsRouter.post('/api/rooms/:roomId/game-record', async (req, res) => {
  const { roomId } = req.params;
  const { gameType, winnerId, winnerName, details } = req.body;

  try {
    const record = await dbService.recordGame({
      gameId: `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomId,
      gameType: gameType || 'minigame',
      winnerId: winnerId || 'unknown',
      winnerName: winnerName || 'Bợm nhậu',
      details,
    });
    res.json({ success: true, record });
  } catch (error) {
    sendServerError(res, error, 'Failed to record game');
  }
});
