/** Hộ Chiếu Tửu Lượng: leaderboard, profiles, end-of-night reports. */
import { Router } from 'express';
import { dbService } from '../db/index.ts';
import { sendServerError } from '../http/respond.ts';
import { resolvePassportOwner } from '../http/session.ts';
import { sanitizeReceiptInput } from '../../shared/receipts.ts';

export const playersRouter = Router();

playersRouter.get('/api/leaderboard', async (_req, res) => {
  try {
    const leaderboard = await dbService.getLeaderboard(15);
    res.json({ leaderboard });
  } catch (error) {
    sendServerError(res, error, 'Failed to fetch leaderboard');
  }
});

playersRouter.get('/api/players/:playerId', async (req, res) => {
  const { playerId } = req.params;
  try {
    const profile = await dbService.getPlayerProfile(playerId);
    if (!profile) {
      return res.status(404).json({ error: 'Player profile not found' });
    }
    res.json({ profile });
  } catch (error) {
    sendServerError(res, error, 'Failed to get player profile');
  }
});

playersRouter.post('/api/players/:playerId', async (req, res) => {
  const { playerId } = req.params;
  try {
    const updated = await dbService.updatePlayerProfile(playerId, req.body);
    res.json({ success: true, profile: updated });
  } catch (error) {
    sendServerError(res, error, 'Failed to update player profile');
  }
});

// POST "Biên Bản Cuối Buổi": end-of-night report into the Hộ Chiếu Tửu Lượng
playersRouter.post('/api/players/:playerId/night-report', async (req, res) => {
  const b = req.body ?? {};
  const num = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 0;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  try {
    const targetId = await resolvePassportOwner(req, req.params.playerId);

    const report = {
      roomId: str(b.roomId, 40),
      score: Math.round(num(b.score, 0, 100000)),
      rankTitle: str(b.rankTitle, 60),
      endingKind: str(b.endingKind, 30),
      durationMinutes: Math.round(num(b.durationMinutes, 0, 24 * 60)),
      drinks: Math.round(num(b.drinks, 0, 999)),
      peakAlcohol: Math.round(num(b.peakAlcohol, 0, 100)),
      slipperHits: Math.round(num(b.slipperHits, 0, 999)),
      loudestDzoDb: Math.round(num(b.loudestDzoDb, 0, 140)),
      billShare: Math.round(num(b.billShare, 0, 1e9)),
      createdAt: new Date(),
    };
    const profile = await dbService.addNightReport(targetId, str(b.playerName, 32), report, {
      drinks: report.drinks,
      timesPassedOut: Math.round(num(b.timesPassedOut, 0, 99)),
      coinsReward: Math.round(num(b.coinsReward, 0, 10000)),
    });
    // The Tờ Hóa Đơn Ký Ức for the Sổ Nợ Gia Truyền
    let receiptCode: string | null = null;
    if (b.receipt && typeof b.receipt === 'object') {
      const receipt = await dbService.createMatchReceipt(targetId, sanitizeReceiptInput(b.receipt));
      receiptCode = receipt.receiptCode;
    }
    res.json({ success: true, profile, receiptCode });
  } catch (error) {
    sendServerError(res, error, 'Failed to save night report');
  }
});
