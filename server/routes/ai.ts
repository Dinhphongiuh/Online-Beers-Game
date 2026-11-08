/** Gemini-powered Truth or Dare & drunk banter (Redis rate limit, offline fallbacks). */
import { Router } from 'express';
import { dbService } from '../db/index.ts';
import { redis } from '../redis.ts';
import { ai } from '../services/gemini.ts';
import { FALLBACK_DARES, FALLBACK_TOASTS, FALLBACK_TRUTHS } from '../content/fallbackLines.ts';

export const aiRouter = Router();

// API: Generate Truth or Dare via Gemini 3.8 Flash
aiRouter.post('/api/truth-or-dare', async (req, res) => {
  const { type, playerName, tablePlayers = [], mood = 'funny', roomId } = req.body;
  const chosenType = type === 'dare' ? 'dare' : 'truth';

  // Redis rate limit: max 20 requests per minute per IP
  const clientIp = req.ip || '127.0.0.1';
  const rateLimitKey = `ratelimit:truth:${clientIp}`;
  const reqCount = await redis.incr(rateLimitKey);
  if (reqCount === 1) {
    await redis.expire(rateLimitKey, 60);
  }

  if (reqCount > 30) {
    const list = chosenType === 'truth' ? FALLBACK_TRUTHS : FALLBACK_DARES;
    const randomItem = list[Math.floor(Math.random() * list.length)];
    return res.json({
      text: randomItem,
      type: chosenType,
      target: playerName || "Bợm nhậu",
      source: 'offline_rate_limited'
    });
  }

  if (!ai) {
    const list = chosenType === 'truth' ? FALLBACK_TRUTHS : FALLBACK_DARES;
    const randomItem = list[Math.floor(Math.random() * list.length)];
    return res.json({
      text: randomItem,
      type: chosenType,
      target: playerName || "Bợm nhậu",
      source: 'offline'
    });
  }

  try {
    const prompt = `Bạn là Quản Trò tại một quán nhậu vỉa hè Việt Nam cực lầy lội, hài hước, dí dỏm.
Hãy tạo 01 câu hỏi "${chosenType === 'truth' ? 'Thật (Truth)' : 'Thách (Dare)'}" cực bựa, duyên dáng, phù hợp với văn hóa nhậu Việt Nam (bàn inox, ghế nhựa, cụng ly bia, trốn bill, giả say, chém gió).
Người bị chỉ định: ${playerName || 'Người chơi'}.
Những người khác trong bàn: ${tablePlayers.join(', ') || 'Bạn bè'}.
Phong cách: ${mood} (hài hước, cười vỡ bụng, không dung tục quá đà, đậm chất anh em bàn nhậu).
Yêu cầu: Chỉ trả về đúng 1 câu văn súc tích (dưới 35 từ), bắt đầu thẳng vào nội dung thử thách hoặc câu hỏi.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: "Bạn là quản trò tiệc nhậu Việt Nam hài hước, xéo xắt, đáng yêu. Trả về đúng 1 câu thử thách hoặc câu hỏi sự thật ngắn gọn.",
      }
    });

    const generated = response.text?.trim();
    if (generated) {
      // Save truth or dare to MongoDB room log if roomId is passed
      if (roomId) {
        dbService.addTruthOrDareLog(roomId, {
          id: `tod_${Date.now()}`,
          type: chosenType,
          text: generated,
          target: playerName,
          source: 'gemini',
          completedAt: Date.now(),
        }).catch(() => null);
      }

      return res.json({
        text: generated,
        type: chosenType,
        target: playerName,
        source: 'gemini'
      });
    }

    throw new Error('Empty response');
  } catch (error) {
    console.error('Gemini Truth/Dare error:', error);
    const list = chosenType === 'truth' ? FALLBACK_TRUTHS : FALLBACK_DARES;
    const randomItem = list[Math.floor(Math.random() * list.length)];
    return res.json({
      text: randomItem,
      type: chosenType,
      target: playerName || "Bợm nhậu",
      source: 'fallback'
    });
  }
});

// API: Generate Drunk Toast / Banter / Excuse
aiRouter.post('/api/drunk-banter', async (req, res) => {
  const { drunkLevel = 50, speaker = 'Bợm Nhậu', category = 'toast' } = req.body;

  if (!ai) {
    const randomToast = FALLBACK_TOASTS[Math.floor(Math.random() * FALLBACK_TOASTS.length)];
    return res.json({ text: randomToast, speaker, source: 'offline' });
  }

  try {
    let contextPrompt = `Tạo 1 câu hô hào cụng ly hoặc khẩu hiệu nhậu cực sung 1 2 3 Dzô`;
    if (category === 'excuse') {
      contextPrompt = `Tạo 1 lý do cùn trốn uống bia hoặc trốn trả bill cực lầy lội hài hước kiểu dân nhậu Việt Nam`;
    } else if (drunkLevel > 70) {
      contextPrompt = `Tạo 1 câu nói lè nhè, say quắc cần câu, lẹo lưỡi, triết lý nhậu đời người cực hài`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Nhân vật: ${speaker}, Độ say: ${drunkLevel}%. ${contextPrompt}. Trả về đúng 1 câu dưới 25 từ kèm tiếng cụng ly hoặc hô Dzô.`,
    });

    const text = response.text?.trim() || FALLBACK_TOASTS[0];
    return res.json({ text, speaker, source: 'gemini' });
  } catch (error) {
    console.error('Gemini Banter error:', error);
    const randomToast = FALLBACK_TOASTS[Math.floor(Math.random() * FALLBACK_TOASTS.length)];
    return res.json({ text: randomToast, speaker, source: 'fallback' });
  }
});
