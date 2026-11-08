/** NPC drinking buddies a player designed themself (tab "NPC" in the friends list). */
import mongoose, { Schema } from 'mongoose';
import type { CustomNpc } from '../../../shared/social.ts';

export interface ICustomNpc extends CustomNpc {
  ownerId: string;
  createdAt?: Date;
}

const CustomNpcSchema = new Schema<ICustomNpc>(
  {
    ownerId: { type: String, required: true, index: true },
    npcId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    avatar: String,
    clothing: String,
    hat: String,
    glassType: String,
    tolerance: Number,
    catchphrase: String,
  },
  { timestamps: true, collection: 'custom_npcs' }
);

export const CustomNpcModel = mongoose.model<ICustomNpc>('CustomNpc', CustomNpcSchema);

export const toCustomNpc = (doc: any): CustomNpc => ({
  npcId: doc.npcId,
  name: doc.name,
  avatar: doc.avatar,
  clothing: doc.clothing,
  hat: doc.hat,
  glassType: doc.glassType,
  tolerance: doc.tolerance,
  catchphrase: doc.catchphrase || '',
});
