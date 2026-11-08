import crypto from 'crypto';
import { requireMongo } from '../connection.ts';
import { CustomNpcModel, toCustomNpc } from '../models/customNpc.ts';
import { MAX_CUSTOM_NPCS, type CustomNpc } from '../../../shared/social.ts';

export const npcsRepo = {
  async listCustomNpcs(ownerId: string): Promise<CustomNpc[]> {
    requireMongo();
    const docs = await CustomNpcModel.find({ ownerId }).sort({ createdAt: 1 }).limit(MAX_CUSTOM_NPCS).lean();
    return docs.map(toCustomNpc);
  },

  /** Returns null when the player already has MAX_CUSTOM_NPCS buddies. */
  async createCustomNpc(ownerId: string, npc: Omit<CustomNpc, 'npcId'>): Promise<CustomNpc | null> {
    requireMongo();
    if ((await CustomNpcModel.countDocuments({ ownerId })) >= MAX_CUSTOM_NPCS) return null;
    const doc = await CustomNpcModel.create({ ...npc, ownerId, npcId: crypto.randomBytes(6).toString('hex') });
    return toCustomNpc(doc.toObject());
  },

  async deleteCustomNpc(ownerId: string, npcId: string) {
    requireMongo();
    const res = await CustomNpcModel.deleteOne({ ownerId, npcId });
    return res.deletedCount > 0;
  },
};
