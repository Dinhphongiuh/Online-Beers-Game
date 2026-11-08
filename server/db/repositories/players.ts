import { requireMongo } from '../connection.ts';
import { PlayerProfileModel, type IPlayerProfile, type NightReportRecord } from '../models/playerProfile.ts';

export const playersRepo = {
  // --- PLAYERS / PROFILES ---
  async getPlayerProfile(playerId: string) {
    requireMongo();
    return PlayerProfileModel.findOne({ playerId }).lean();
  },

  async updatePlayerProfile(playerId: string, updates: Partial<IPlayerProfile>) {
    requireMongo();
    const { playerId: _ignored, ...safeUpdates } = updates as Record<string, unknown>;
    // `name` is required on insert; only default it via $setOnInsert when it isn't
    // already in $set (the same path in both operators is a ConflictingUpdateOperators error)
    const update: Record<string, unknown> = { $set: { ...safeUpdates, lastActive: new Date() } };
    if (!safeUpdates.name) update.$setOnInsert = { name: 'Bợm Nhậu' };
    return PlayerProfileModel.findOneAndUpdate({ playerId }, update, {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    }).lean();
  },

  /** Appends a night report and rolls its numbers into the lifetime passport stats. */
  async addNightReport(
    playerId: string,
    name: string,
    report: NightReportRecord,
    totals: { drinks: number; timesPassedOut: number; coinsReward: number }
  ) {
    requireMongo();
    // Create the profile with its defaults first: $inc on an upsert would skip the
    // default 240 Nắp and start the wallet at just the reward.
    await PlayerProfileModel.updateOne(
      { playerId },
      { $setOnInsert: { name: name || 'Bợm Nhậu' } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    return PlayerProfileModel.findOneAndUpdate(
      { playerId },
      {
        $push: { nightReports: { $each: [report], $slice: -20 } },
        $inc: {
          nightsCompleted: 1,
          drinksCount: totals.drinks,
          timesPassedOut: totals.timesPassedOut,
          coins: totals.coinsReward,
        },
        $max: { bestNightScore: report.score },
        $set: { lastActive: new Date() },
      },
      { returnDocument: 'after' }
    ).lean();
  },

  async getLeaderboard(limit = 10) {
    requireMongo();
    return PlayerProfileModel.find().sort({ drinksCount: -1, coins: -1 }).limit(limit).lean();
  },

};
