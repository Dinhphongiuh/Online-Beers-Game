/** Đi Tỉnh Về Quắc: persists the commute outcome (coins, impounded bike, title). */
import { Router } from 'express';
import { dbService } from '../db/index.ts';
import { redis } from '../redis.ts';
import { sendServerError } from '../http/respond.ts';

export const commuteRouter = Router();

// POST record commute outcome (Pre/Post-Match Commute Loop: Đi Tỉnh Về Quắc)
commuteRouter.post('/api/commute/record-outcome', async (req, res) => {
  const {
    playerId,
    playerName,
    coins,
    title,
    bikeImpoundMatchesLeft,
    selectedBikeSkin,
  } = req.body;

  try {
    const targetId = String(playerId || 'user');
    const updates: Record<string, unknown> = {};
    if (typeof coins === 'number') updates.coins = Math.max(0, coins);
    if (typeof title === 'string' && title.trim()) updates.title = title.trim();
    if (typeof bikeImpoundMatchesLeft === 'number') {
      updates.bikeImpoundMatchesLeft = Math.max(0, bikeImpoundMatchesLeft);
    }
    if (typeof selectedBikeSkin === 'string') {
      updates.selectedBikeSkin = selectedBikeSkin;
    }

    const profile = await dbService.updatePlayerProfile(targetId, {
      ...(playerName ? { name: String(playerName) } : {}),
      ...updates,
    });

    // If user is authenticated via Bearer token, also update User document & Redis session
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const rawSession = await redis.get(`session:${token}`);
      if (rawSession) {
        const sessionData = JSON.parse(rawSession);
        if (sessionData.userId) {
          await dbService.updateUser(sessionData.userId, updates);
          const nextSession = {
            ...sessionData,
            ...updates,
          };
          await redis.set(`session:${token}`, JSON.stringify(nextSession), 'EX', 604800);
        }
      }
    }

    res.json({ success: true, profile });
  } catch (error) {
    sendServerError(res, error, 'Failed to record commute outcome');
  }
});
