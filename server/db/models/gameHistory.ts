/** Finished minigames (winner per game). */
import mongoose, { Schema, Document } from 'mongoose';

export interface IGameHistory extends Document {
  gameId: string;
  roomId: string;
  gameType: string;
  winnerId: string;
  winnerName: string;
  details?: any;
  createdAt: Date;
}

const GameHistorySchema = new Schema<IGameHistory>(
  {
    gameId: { type: String, required: true, unique: true },
    roomId: { type: String, required: true },
    gameType: { type: String, required: true },
    winnerId: { type: String, required: true },
    winnerName: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const GameHistoryModel = mongoose.model<IGameHistory>('GameHistory', GameHistorySchema);
