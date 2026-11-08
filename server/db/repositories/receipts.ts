import { requireMongo, isDuplicateKeyError } from '../connection.ts';
import { MatchReceiptModel, toReceipt } from '../models/matchReceipt.ts';
import { PlayerProfileModel } from '../models/playerProfile.ts';
import { BURN_SNAPSHOT_COST, type MatchReceipt, type MatchReceiptInput } from '../../../shared/receipts.ts';

export const receiptsRepo = {
  // --- SỔ NỢ GIA TRUYỀN (match receipts) ---
  async createMatchReceipt(ownerId: string, input: MatchReceiptInput): Promise<MatchReceipt> {
    requireMongo();
    for (let attempt = 0; attempt < 5; attempt++) {
      const receiptCode = `BILL-${Math.floor(1000 + Math.random() * 9000)}${attempt ? attempt : ''}`;
      try {
        const doc = await MatchReceiptModel.create({ ...input, ownerId, receiptCode, grudge: null });
        return toReceipt(doc.toObject());
      } catch (err) {
        if (!isDuplicateKeyError(err, 'receiptCode')) throw err;
      }
    }
    throw new Error('Could not allocate a receipt code');
  },

  async listMatchReceipts(ownerId: string, limit = 15): Promise<MatchReceipt[]> {
    requireMongo();
    const docs = await MatchReceiptModel.find({ ownerId }).sort({ createdAt: -1 }).limit(limit).lean();
    return docs.map(toReceipt);
  },

  /** Light projection of every receipt (no photos / timelines) for the lifetime stats. */
  async listReceiptStats(ownerId: string) {
    requireMongo();
    return MatchReceiptModel.find(
      { ownerId },
      { stats: 1, quotes: 1, escapedBill: 1, paidWholeBill: 1, billShare: 1, commuteOutcome: 1, finePaid: 1, score: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
  },

  async getMatchReceipt(receiptCode: string): Promise<MatchReceipt | null> {
    requireMongo();
    const doc = await MatchReceiptModel.findOne({ receiptCode }).lean();
    return doc ? toReceipt(doc) : null;
  },

  async setReceiptGrudge(receiptCode: string, ownerId: string, grudge: NonNullable<MatchReceipt['grudge']>) {
    requireMongo();
    const doc = await MatchReceiptModel.findOneAndUpdate(
      { receiptCode, ownerId, grudge: null },
      { $set: { grudge } },
      { returnDocument: 'after' }
    ).lean();
    return doc ? toReceipt(doc) : null;
  },

  async settleGrudge(receiptCode: string) {
    requireMongo();
    const doc = await MatchReceiptModel.findOneAndUpdate(
      { receiptCode, 'grudge.settled': false },
      { $set: { 'grudge.settled': true, 'grudge.settledAt': Date.now() } },
      { returnDocument: 'after' }
    ).lean();
    return doc ? toReceipt(doc) : null;
  },

  /** Open grudges where `netId` / `ownerId` is the creditor. */
  async listOpenGrudgesByCreditor(ownerId: string, netId: string) {
    requireMongo();
    const docs = await MatchReceiptModel.find(
      { $or: [{ ownerId }, ...(netId ? [{ ownerNetId: netId }] : [])], 'grudge.settled': false },
      { receiptCode: 1, ownerId: 1, ownerNetId: 1, ownerName: 1, grudge: 1, createdAt: 1 }
    )
      .limit(50)
      .lean();
    return docs.map(toReceipt);
  },

  /** Open grudges where `targetId` owes somebody a round. */
  async listOpenDebts(targetIds: string[]) {
    requireMongo();
    const docs = await MatchReceiptModel.find(
      { 'grudge.targetId': { $in: targetIds }, 'grudge.settled': false },
      { receiptCode: 1, ownerId: 1, ownerNetId: 1, ownerName: 1, grudge: 1, createdAt: 1 }
    )
      .limit(50)
      .lean();
    return docs.map(toReceipt);
  },

  async pinReceipt(playerId: string, receiptCode: string) {
    requireMongo();
    return PlayerProfileModel.findOneAndUpdate(
      { playerId },
      { $set: { pinnedReceiptCode: receiptCode } },
      { returnDocument: 'after' }
    ).lean();
  },

  /**
   * "Đốt Phi Tang Ảnh": pay 20 Nắp from the passport wallet to wipe the photo.
   * Returns null when the wallet is short (the photo stays).
   */
  async burnReceiptSnapshot(ownerId: string, receiptCode: string) {
    requireMongo();
    const profile = await PlayerProfileModel.findOneAndUpdate(
      { playerId: ownerId, coins: { $gte: BURN_SNAPSHOT_COST } },
      { $inc: { coins: -BURN_SNAPSHOT_COST } },
      { returnDocument: 'after' }
    ).lean();
    if (!profile) return null;
    const receipt = await MatchReceiptModel.findOneAndUpdate(
      { receiptCode, ownerId, snapshotBurned: false, funnySnapshot: { $nin: ['', null] } },
      { $set: { funnySnapshot: '', snapshotBurned: true } },
      { returnDocument: 'after' }
    ).lean();
    if (!receipt) {
      // nothing to burn: refund
      await PlayerProfileModel.updateOne({ playerId: ownerId }, { $inc: { coins: BURN_SNAPSHOT_COST } });
      return null;
    }
    if (profile.pinnedReceiptCode === receiptCode) {
      await PlayerProfileModel.updateOne({ playerId: ownerId }, { $set: { pinnedReceiptCode: '' } });
    }
    return { coins: profile.coins, receipt: toReceipt(receipt) };
  },

};
