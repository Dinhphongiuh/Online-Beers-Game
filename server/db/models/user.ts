/** Accounts (registered + guest). */
import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  username: string;
  /** Case-insensitive uniqueness key for `username` (see shared/validation.ts usernameKey) */
  usernameKey?: string;
  email?: string;
  passwordHash?: string;
  avatar: string;
  title: string;
  clothing: string;
  hat: string;
  glassType: string;
  coins: number;
  gems: number;
  drunkArchetype: string;
  declaredTolerance: number;
  drinksCount: number;
  foodEatenCount: number;
  gamesWon: number;
  timesPassedOut: number;
  bikeImpoundMatchesLeft?: number;
  selectedBikeSkin?: string;
  isGuest: boolean;
  roomPin?: string;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, index: true },
    // Unique, case/whitespace-insensitive form of username. Sparse so legacy rows without it
    // don't collide while they are being backfilled.
    usernameKey: { type: String, unique: true, sparse: true },
    email: { type: String, sparse: true, index: true },
    passwordHash: { type: String },
    avatar: { type: String, default: 'dog' },
    title: { type: String, default: 'Tấm Chiếu Mới' },
    clothing: { type: String, default: 'tanktop_red' },
    hat: { type: String, default: 'none' },
    glassType: { type: String, default: 'beer_mug' },
    coins: { type: Number, default: 740 },
    gems: { type: Number, default: 10 },
    drunkArchetype: { type: String, default: 'TRIET_GIA' },
    declaredTolerance: { type: Number, default: 50 },
    drinksCount: { type: Number, default: 0 },
    foodEatenCount: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    timesPassedOut: { type: Number, default: 0 },
    bikeImpoundMatchesLeft: { type: Number, default: 0 },
    selectedBikeSkin: { type: String, default: 'dream_chien' },
    isGuest: { type: Boolean, default: false },
    roomPin: { type: String },
    lastLogin: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<IUser>('User', UserSchema);
