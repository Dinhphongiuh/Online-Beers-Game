/** One friendship (or pending request) between two accounts. */
import mongoose, { Schema } from 'mongoose';

export interface IFriendship {
  /** `${smallerId}|${biggerId}` — one row per pair, whoever asked first. */
  pairKey: string;
  userIds: [string, string];
  requesterId: string;
  status: 'pending' | 'accepted';
  createdAt?: Date;
  acceptedAt?: Date;
}

const FriendshipSchema = new Schema<IFriendship>(
  {
    pairKey: { type: String, required: true, unique: true },
    userIds: { type: [String], required: true, index: true },
    requesterId: { type: String, required: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
    acceptedAt: Date,
  },
  { timestamps: true, collection: 'friendships' }
);

export const FriendshipModel = mongoose.model<IFriendship>('Friendship', FriendshipSchema);

export const pairKeyOf = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
