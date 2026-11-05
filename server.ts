import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Initialize Gemini Client server-side
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Built-in offline fallback pool for Truth or Dare (authentic Vietnamese drinking party flavor)
const FALLBACK_TRUTHS = [
  "Lần gần nhất bạn say đến mức mất trí nhớ là khi nào và đã làm trò gì xấu hổ nhất?",
  "Trong bàn nhậu này, bạn nghĩ ai là người hay trốn thanh toán tiền bill nhất?",
  "Bật mí một bí mật về crush cũ mà bạn chưa từng kể cho ai trong bàn này biết!",
  "Đã bao giờ bạn giả vờ nghe điện thoại để trốn một chầu nhậu chưa?",
  "Nếu phải chọn một người trong bàn nhậu này đi nhậu thâu đêm 3 ngày 3 đêm, bạn chọn ai?",
  "Kể tên tật xấu khó đỡ nhất của bạn mỗi khi uống quá 5 lon bia!",
  "Từng bị người yêu bắt quả tang đi nhậu 'tăng 2 tăng 3' chưa? Hậu quả thế nào?",
  "Ai trong bàn này có tửu lượng 'tấm chiếu mới' nhất mà hay gáy to nhất?",
  "Cho bàn nhậu xem tấm hình 'dìm hàng' chụp lúc say xỉn thê thảm nhất trong điện thoại!",
  "Lần nhậu tốn tiền ngu nhất cuộc đời bạn là bao nhiêu và vì lý do gì?"
];

const FALLBACK_DARES = [
  "Đứng lên ghế nhựa hô thật to: 'Anh em ơi, chầu này tao bao!' rồi ngồi xuống tự phạt 1 ly!",
  "Cầm ly bia sang bàn ảo (hoặc giả vờ) cụng ly chúc Tết một người bất kỳ theo phong cách MC đám cưới!",
  "Uống một hơi cạn nửa ly bia không dùng tay (nhờ người bên cạnh đút)!",
  "Đọc một bài thơ con cóc 4 câu khen nhan sắc của người ngồi đối diện!",
  "Hát điệp khúc bài 'Túy Âm' hoặc 'Một Cú Lừa' bằng giọng say xỉn bẹp dí!",
  "Thực hiện động tác 'chú bộ đội lắc lư' trong 15 giây mà không được cười!",
  "Gắp một miếng ớt hoặc mồi cay nhất trên bàn ăn hết trong sự ngỡ ngàng của anh em!",
  "Giả giọng say lè nhè xin phép 'vợ/mẹ' cho nhậu thêm 10 phút nữa!",
  "Cụng ly chéo tay (uống giao bôi) với người bên phải rồi hô 'Huynh đệ mãi đỉnh!'",
  "Tự lấy ngón tay chấm bọt bia quẹt lên mũi làm chú hề cho đến hết vòng chơi tiếp theo!"
];

const FALLBACK_TOASTS = [
  "Trăm năm Kiều vẫn là Kiều, bia mà không uống người yêu nó cười! 1 2 3 DZÔ!",
  "Rượu ngon phải có bạn hiền, nhậu mà không xỉn... tốn tiền nha anh em! DZÔ!",
  "Bàn nhậu không phân biệt sang hèn, chỉ phân biệt đứa nào trốn bill! DZÔ!",
  "Uống cho say để thấy trần gian đảo điên, nhậu cho tới bến mai liền đi làm! DZÔ!",
  "Sống là phải biết cụng ly, chết mang theo được thùng bia nào đâu! KENG!"
];

// API: Generate Truth or Dare via Gemini 3.8 Flash
app.post('/api/truth-or-dare', async (req, res) => {
  const { type, playerName, tablePlayers = [], mood = 'funny' } = req.body;
  const chosenType = type === 'dare' ? 'dare' : 'truth';

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
app.post('/api/drunk-banter', async (req, res) => {
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

// Setup Vite in Dev or Serve Static in Prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

startServer();
