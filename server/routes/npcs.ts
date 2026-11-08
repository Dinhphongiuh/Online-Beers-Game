/** "NPC tự tạo": each account's own AI drinking buddies (tab NPC → ➕). */
import { Router } from 'express';
import { dbService } from '../db/index.ts';
import { sendServerError } from '../http/respond.ts';
import { requireSession, type SessionUser } from '../http/session.ts';
import { MAX_CUSTOM_NPCS, sanitizeNpcInput } from '../../shared/social.ts';

export const npcsRouter = Router();
npcsRouter.use('/api/npcs', requireSession);

const me = (res: { locals: Record<string, unknown> }) => res.locals.user as SessionUser;

npcsRouter.get('/api/npcs', async (_req, res) => {
  try {
    res.json({ npcs: await dbService.listCustomNpcs(me(res).userId) });
  } catch (error) {
    sendServerError(res, error, 'Không tải được NPC');
  }
});

npcsRouter.post('/api/npcs', async (req, res) => {
  try {
    const input = sanitizeNpcInput(req.body);
    if (!input) return res.status(400).json({ error: 'Tên NPC cần ít nhất 2 ký tự' });
    const npc = await dbService.createCustomNpc(me(res).userId, input);
    if (!npc) return res.status(409).json({ error: `Tối đa ${MAX_CUSTOM_NPCS} NPC thôi, bàn hết ghế rồi!` });
    res.json({ success: true, npc });
  } catch (error) {
    sendServerError(res, error, 'Không tạo được NPC');
  }
});

npcsRouter.delete('/api/npcs/:npcId', async (req, res) => {
  try {
    await dbService.deleteCustomNpc(me(res).userId, String(req.params.npcId));
    res.json({ success: true });
  } catch (error) {
    sendServerError(res, error, 'Không xóa được NPC');
  }
});
