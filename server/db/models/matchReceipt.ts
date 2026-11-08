import mongoose, { Schema } from 'mongoose';
import type { MatchReceipt } from '../../../shared/receipts.ts';

/** "Sổ Nợ Gia Truyền": one Tờ Hóa Đơn Ký Ức per player per night (collection match_receipts). */
const MatchReceiptSchema = new Schema(
  {
    receiptCode: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    ownerNetId: { type: String, default: '' },
    ownerName: String,
    roomId: String,
    map: String,
    durationSec: Number,
    surrenderVotesTriggered: Number,
    surrenderVotesRejected: Number,
    billPayerName: String,
    totalBillAmount: Number,
    billShare: Number,
    escapedBill: Boolean,
    paidWholeBill: Boolean,
    score: Number,
    rankTitle: String,
    rankEmoji: String,
    commuteChoice: String,
    commuteOutcome: String,
    finePaid: Number,
    stats: Schema.Types.Mixed,
    alcoholTimeline: Schema.Types.Mixed,
    quotes: Schema.Types.Mixed,
    mostSpammedQuote: String,
    awardTitle: String,
    funnySnapshot: String,
    funnySnapshotCaption: String,
    snapshotBurned: { type: Boolean, default: false },
    table: Schema.Types.Mixed,
    grudge: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: 'match_receipts' }
);
MatchReceiptSchema.index({ ownerId: 1, createdAt: -1 });
MatchReceiptSchema.index({ 'grudge.targetId': 1, 'grudge.settled': 1 });
MatchReceiptSchema.index({ ownerNetId: 1, 'grudge.settled': 1 });

export const MatchReceiptModel = mongoose.model('MatchReceipt', MatchReceiptSchema);

/** Lean Mongo doc → API shape (no _id / __v, createdAt as epoch ms). */
export const toReceipt = (doc: any): MatchReceipt => {
  const { _id, __v, updatedAt, createdAt, ...rest } = doc;
  return { ...rest, createdAt: new Date(createdAt).getTime() } as MatchReceipt;
};
