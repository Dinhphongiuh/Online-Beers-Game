/** Sổ Nợ Gia Truyền & Bệnh Án Tửu Lượng: match receipts, grudges, polaroids. */
import { Router } from 'express';
import { dbService } from '../db/index.ts';
import { sendServerError } from '../http/respond.ts';
import { resolvePassportOwner } from '../http/session.ts';
import { grudgeCandidates, summarizeLifetime } from '../../shared/receipts.ts';

export const receiptsRouter = Router();

// GET the book: last 15 receipts + lifetime "Hồ Sơ Đen" stats + wallet
receiptsRouter.get('/api/players/:playerId/receipts', async (req, res) => {
  try {
    const ownerId = await resolvePassportOwner(req, req.params.playerId);
    const [receipts, allStats, profile] = await Promise.all([
      dbService.listMatchReceipts(ownerId, 15),
      dbService.listReceiptStats(ownerId),
      dbService.getPlayerProfile(ownerId),
    ]);
    res.json({
      success: true,
      receipts,
      lifetime: summarizeLifetime(allStats as any),
      coins: profile?.coins ?? 240,
      pinnedReceiptCode: profile?.pinnedReceiptCode || '',
    });
  } catch (error) {
    sendServerError(res, error, 'Failed to load receipts');
  }
});

// POST ghim thù: pin the bill dodger of that night in the grudge book
receiptsRouter.post('/api/players/:playerId/receipts/:code/grudge', async (req, res) => {
  try {
    const ownerId = await resolvePassportOwner(req, req.params.playerId);
    const receipt = await dbService.getMatchReceipt(String(req.params.code));
    if (!receipt || receipt.ownerId !== ownerId) return res.status(404).json({ error: 'Không tìm thấy tờ hóa đơn' });
    if (receipt.grudge) return res.status(409).json({ error: 'Tờ này đã ghim thù rồi' });
    const target = grudgeCandidates(receipt).find((m) => m.playerId === req.body?.targetId);
    if (!target) return res.status(400).json({ error: 'Chỉ ghim thù được đứa trốn bill lúc bạn phải trả' });
    const updated = await dbService.setReceiptGrudge(receipt.receiptCode, ownerId, {
      targetId: target.playerId,
      targetName: target.name,
      since: receipt.createdAt,
      settled: false,
    });
    res.json({ success: true, receipt: updated });
  } catch (error) {
    sendServerError(res, error, 'Failed to pin grudge');
  }
});

// POST đòi nợ xong: the debtor drank the 1.5x glass in front of the creditor
receiptsRouter.post('/api/receipts/:code/grudge/settle', async (req, res) => {
  try {
    const receipt = await dbService.getMatchReceipt(String(req.params.code));
    if (!receipt?.grudge || receipt.grudge.settled) return res.status(404).json({ error: 'Không có món nợ nào' });
    const caller = String(req.body?.playerId || '');
    const isCreditor =
      (!!caller && caller === receipt.ownerNetId) || (await resolvePassportOwner(req, caller)) === receipt.ownerId;
    // NPC regulars can't call the API: their creditor settles for them
    if (caller !== receipt.grudge.targetId && !isCreditor) return res.status(403).json({ error: 'Không phải con nợ' });
    await dbService.settleGrudge(receipt.receiptCode);
    res.json({ success: true });
  } catch (error) {
    sendServerError(res, error, 'Failed to settle grudge');
  }
});

// GET grudges I hold (creditor) and debts I owe (debtor), for the wanted signs at the table
receiptsRouter.get('/api/players/:playerId/grudges', async (req, res) => {
  try {
    const netId = String(req.params.playerId || '').slice(0, 64);
    const ownerId = await resolvePassportOwner(req, netId);
    const [held, owed] = await Promise.all([
      dbService.listOpenGrudgesByCreditor(ownerId, netId),
      dbService.listOpenDebts([...new Set([netId, ownerId])]),
    ]);
    const view = (r: any) => ({
      receiptCode: r.receiptCode,
      creditorNetId: r.ownerNetId,
      creditorName: r.ownerName,
      targetId: r.grudge.targetId,
      targetName: r.grudge.targetName,
      since: r.grudge.since,
    });
    res.json({ success: true, held: held.map(view), owed: owed.map(view) });
  } catch (error) {
    sendServerError(res, error, 'Failed to load grudges');
  }
});

// POST ghim lên trang nhất
receiptsRouter.post('/api/players/:playerId/receipts/:code/pin', async (req, res) => {
  try {
    const ownerId = await resolvePassportOwner(req, req.params.playerId);
    const receipt = await dbService.getMatchReceipt(String(req.params.code));
    if (!receipt || receipt.ownerId !== ownerId) return res.status(404).json({ error: 'Không tìm thấy tờ hóa đơn' });
    if (!receipt.funnySnapshot) return res.status(400).json({ error: 'Tờ này không còn ảnh để ghim' });
    await dbService.pinReceipt(ownerId, receipt.receiptCode);
    res.json({ success: true, pinnedReceiptCode: receipt.receiptCode });
  } catch (error) {
    sendServerError(res, error, 'Failed to pin receipt');
  }
});

// POST đốt phi tang ảnh (-20 Nắp)
receiptsRouter.post('/api/players/:playerId/receipts/:code/burn', async (req, res) => {
  try {
    const ownerId = await resolvePassportOwner(req, req.params.playerId);
    const result = await dbService.burnReceiptSnapshot(ownerId, String(req.params.code));
    if (!result) return res.status(402).json({ error: 'Không đủ 20 Nắp Bia (hoặc ảnh đã bị đốt)' });
    res.json({ success: true, coins: result.coins, receipt: result.receipt });
  } catch (error) {
    sendServerError(res, error, 'Failed to burn snapshot');
  }
});
