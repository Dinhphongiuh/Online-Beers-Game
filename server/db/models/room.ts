/** Tables: settings, dishes, bill, chat & Truth-or-Dare logs. */
import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  roomId: string;
  theme: string;
  drunkSpeed: string;
  rules: {
    micDzo: boolean;
    randomEvents: boolean;
    billBrawl: boolean;
  };
  players: any[];
  dishes: any[];
  totalBill: number;
  chatMessages: {
    id: string;
    sender: string;
    text: string;
    drunkLevel?: number;
    timestamp: number;
  }[];
  truthOrDareLogs: {
    id: string;
    type: string;
    text: string;
    target?: string;
    source?: string;
    completedAt: number;
  }[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    theme: { type: String, default: 'sidewalk' },
    drunkSpeed: { type: String, default: 'toi_ben' },
    rules: {
      micDzo: { type: Boolean, default: false },
      randomEvents: { type: Boolean, default: true },
      billBrawl: { type: Boolean, default: true },
    },
    players: [Schema.Types.Mixed],
    dishes: [Schema.Types.Mixed],
    totalBill: { type: Number, default: 0 },
    chatMessages: [
      {
        id: String,
        sender: String,
        text: String,
        drunkLevel: Number,
        timestamp: Number,
      },
    ],
    truthOrDareLogs: [
      {
        id: String,
        type: String,
        text: String,
        target: String,
        source: String,
        completedAt: Number,
      },
    ],
    status: { type: String, default: 'active' },
  },
  { timestamps: true }
);

export const RoomModel = mongoose.model<IRoom>('Room', RoomSchema);
