/** Hộ Chiếu Tửu Lượng: lifetime stats, wallet, night reports. */
import mongoose, { Schema, Document } from 'mongoose';

export interface IPlayerProfile extends Document {
  playerId: string;
  name: string;
  avatar: string;
  title: string;
  clothing: string;
  hat: string;
  glassType: string;
  coins: number;
  gems: number;
  drinksCount: number;
  foodEatenCount: number;
  gamesWon: number;
  timesPassedOut: number;
  bikeImpoundMatchesLeft?: number;
  selectedBikeSkin?: string;
  nightsCompleted?: number;
  bestNightScore?: number;
  nightReports?: NightReportRecord[];
  /** Receipt shown on the Hộ Chiếu's front page ("Ghim lên trang nhất"). */
  pinnedReceiptCode?: string;
  lastActive: Date;
}

/** One "Biên Bản Cuối Buổi" kept in the Hộ Chiếu Tửu Lượng (last 20). */
export interface NightReportRecord {
  roomId: string;
  score: number;
  rankTitle: string;
  endingKind: string;
  durationMinutes: number;
  drinks: number;
  peakAlcohol: number;
  slipperHits: number;
  loudestDzoDb: number;
  billShare: number;
  createdAt: Date;
}

const PlayerProfileSchema = new Schema<IPlayerProfile>(
  {
    playerId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatar: { type: String, default: 'dog' },
    title: { type: String, default: 'Tấm Chiếu Mới' },
    clothing: { type: String, default: 'tanktop_red' },
    hat: { type: String, default: 'none' },
    glassType: { type: String, default: 'beer_mug' },
    coins: { type: Number, default: 240 },
    gems: { type: Number, default: 10 },
    drinksCount: { type: Number, default: 0 },
    foodEatenCount: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    timesPassedOut: { type: Number, default: 0 },
    bikeImpoundMatchesLeft: { type: Number, default: 0 },
    selectedBikeSkin: { type: String, default: 'dream_chien' },
    nightsCompleted: { type: Number, default: 0 },
    bestNightScore: { type: Number, default: 0 },
    nightReports: { type: [Schema.Types.Mixed], default: [] },
    pinnedReceiptCode: { type: String, default: '' },
    lastActive: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const PlayerProfileModel = mongoose.model<IPlayerProfile>('PlayerProfile', PlayerProfileSchema);
