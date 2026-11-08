import { requireMongo } from '../connection.ts';
import { GameHistoryModel } from '../models/gameHistory.ts';

export const gamesRepo = {
  // --- GAME HISTORY ---
  async recordGame(gameData: {
    gameId: string;
    roomId: string;
    gameType: string;
    winnerId: string;
    winnerName: string;
    details?: any;
  }) {
    requireMongo();
    const doc = await GameHistoryModel.create(gameData);
    return doc.toObject();
  },

};
