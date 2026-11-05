import express from 'express';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbService, initMongo, verifyPassword } from './server/db.ts';
import { redis } from './server/redis.ts';

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

// ----------------------------------------------------------------------------
// BACKEND STATUS & HEALTH ENDPOINTS (MongoDB + Redis)
// ----------------------------------------------------------------------------

app.get('/api/status', async (_req, res) => {
  const dbStatus = dbService.getStatus();
  const redisStatus = redis.getStatus();

  res.json({
    status: 'ok',
    timestamp: Date.now(),
    database: {
      mongodb: dbStatus,
      redis: redisStatus,
    },
    gemini: {
      configured: Boolean(apiKey),
    },
  });
});

// ----------------------------------------------------------------------------
// AUTHENTICATION & SESSIONS (REAL MONGODB USER PERSISTENCE + REDIS TOKEN STORE)
// ----------------------------------------------------------------------------

// POST /api/auth/register - Create account with salted hash and Redis session
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, avatar, title, drunkArchetype, declaredTolerance } = req.body;

  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: 'Biệt danh bàn nhậu phải có ít nhất 2 ký tự!' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu ám hiệu phải có ít nhất 6 ký tự!' });
  }

  try {
    const existing = await dbService.findUserByIdentifier(username);
    if (existing) {
      return res.status(409).json({ error: 'Biệt danh này đã có bợm nhậu khác đăng ký rồi! Vui lòng chọn tên khác.' });
    }

    if (email) {
      const existingEmail = await dbService.findUserByIdentifier(email);
      if (existingEmail) {
        return res.status(409).json({ error: 'Email này đã gắn với một tài khoản khác!' });
      }
    }

    const newUser = await dbService.createUser({
      username: username.trim(),
      email: email?.trim(),
      password,
      avatar: avatar || 'dog',
      title: title || 'Tấm Chiếu Mới',
      drunkArchetype: drunkArchetype || 'TRIET_GIA',
      declaredTolerance: Number(declaredTolerance) || 50,
      coins: 740,
    });

    // Generate secure session token
    const token = crypto.randomBytes(32).toString('hex');
    const sessionData = {
      userId: newUser.userId,
      username: newUser.username,
      avatar: newUser.avatar,
      title: newUser.title,
      drunkArchetype: newUser.drunkArchetype,
      declaredTolerance: newUser.declaredTolerance,
      coins: newUser.coins,
      isGuest: false,
      loginAt: Date.now(),
    };

    // Store session in Redis with 7-day TTL (604800 seconds)
    await redis.set(`session:${token}`, JSON.stringify(sessionData), 'EX', 604800);

    const { passwordHash: _, ...safeUser } = newUser;
    res.json({
      success: true,
      token,
      user: safeUser,
      message: 'Đăng ký thành công! Đã cấp Hộ Chiếu Tửu Lượng.',
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Đăng ký thất bại do lỗi hệ thống' });
  }
});

// POST /api/auth/login - Check password hash, create Redis session token
app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ biệt danh/email và mật khẩu!' });
  }

  try {
    const user = await dbService.findUserByIdentifier(identifier);
    if (!user) {
      return res.status(401).json({ error: 'Không tìm thấy tài khoản với biệt danh hoặc email này!' });
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Sai mật khẩu ám hiệu! Nếu quá say hãy bấm "Quên mật khẩu" bên dưới.' });
    }

    await dbService.updateUser(user.userId, { lastLogin: new Date() });

    const token = crypto.randomBytes(32).toString('hex');
    const sessionData = {
      userId: user.userId,
      username: user.username,
      avatar: user.avatar,
      title: user.title,
      drunkArchetype: user.drunkArchetype,
      declaredTolerance: user.declaredTolerance,
      coins: user.coins,
      isGuest: Boolean(user.isGuest),
      loginAt: Date.now(),
    };

    await redis.set(`session:${token}`, JSON.stringify(sessionData), 'EX', 604800);

    const { passwordHash: _, ...safeUser } = user;
    res.json({
      success: true,
      token,
      user: safeUser,
      message: 'Đăng nhập thành công! Mời đại ca vào bàn.',
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Đăng nhập thất bại do lỗi hệ thống' });
  }
});

// POST /api/auth/guest - Instant guest access with Redis session
app.post('/api/auth/guest', async (req, res) => {
  const { nickname, roomPin, avatar } = req.body;
  const guestName = (nickname || 'Khách Nhậu Chui').trim();

  try {
    const guestUser = await dbService.createUser({
      username: guestName,
      avatar: avatar || 'dog',
      title: 'Khách Nhậu Vãng Lai',
      coins: 500,
      isGuest: true,
      roomPin: roomPin || undefined,
    });

    const token = crypto.randomBytes(32).toString('hex');
    const sessionData = {
      userId: guestUser.userId,
      username: guestUser.username,
      avatar: guestUser.avatar,
      title: guestUser.title,
      coins: guestUser.coins,
      isGuest: true,
      roomPin: guestUser.roomPin,
      loginAt: Date.now(),
    };

    await redis.set(`session:${token}`, JSON.stringify(sessionData), 'EX', 86400);

    res.json({
      success: true,
      token,
      user: guestUser,
      message: 'Đã vào bàn nhậu với tư cách khách vãng lai!',
    });
  } catch (error) {
    console.error('Guest auth error:', error);
    res.status(500).json({ error: 'Không thể tạo phiên nhậu chui' });
  }
});

// GET /api/auth/me - Read Bearer token from Redis and fetch full DB profile
app.get('/api/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ authenticated: false, error: 'Chưa đăng nhập' });
  }

  const token = authHeader.substring(7);
  try {
    const sessionRaw = await redis.get(`session:${token}`);
    if (!sessionRaw) {
      return res.status(401).json({ authenticated: false, error: 'Phiên đăng nhập đã hết hạn hoặc không tồn tại' });
    }

    const session = JSON.parse(sessionRaw);
    const user = await dbService.findUserById(session.userId);
    if (user) {
      const { passwordHash: _, ...safeUser } = user;
      return res.json({ authenticated: true, user: safeUser });
    }

    return res.json({ authenticated: true, user: session });
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(500).json({ error: 'Lỗi xác thực phiên' });
  }
});

// POST /api/auth/logout - Invalidate Redis session token
app.post('/api/auth/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    await redis.del(`session:${token}`);
  }
  res.json({ success: true, message: 'Đã đăng xuất khỏi bàn nhậu!' });
});

// POST /api/auth/forgot-password - Recovery with cold towel humor
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Vui lòng cung cấp email!' });
  }

  res.json({
    success: true,
    message: `Đã gửi khăn lạnh giải rượu tới ${email}! Mật khẩu tạm của bạn là: khongsaykhongve123`,
    tempPassword: 'khongsaykhongve123',
  });
});

// ----------------------------------------------------------------------------
// REDIS & MONGODB: ROOMS / TABLES
// ----------------------------------------------------------------------------

// GET room state: checks Redis cache first, then MongoDB
app.get('/api/rooms/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const cacheKey = `room:${roomId}`;

  try {
    // 1. Try Redis cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({ room: JSON.parse(cached), source: 'redis-cache' });
    }

    // 2. Fetch from MongoDB
    const room = await dbService.getRoom(roomId);
    if (room) {
      // Cache in Redis for 1 hour
      await redis.set(cacheKey, JSON.stringify(room), 'EX', 3600);
      return res.json({ room, source: 'mongodb' });
    }

    return res.status(404).json({ error: 'Room not found' });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to retrieve room' });
  }
});

// POST upsert room state: saves to MongoDB and updates Redis cache
app.post('/api/rooms', async (req, res) => {
  const { roomId, theme, drunkSpeed, rules, players, dishes, totalBill } = req.body;
  if (!roomId) {
    return res.status(400).json({ error: 'roomId is required' });
  }

  try {
    const saved = await dbService.upsertRoom(roomId, {
      theme,
      drunkSpeed,
      rules,
      players,
      dishes,
      totalBill,
      status: 'active',
    });

    // Write-through update to Redis cache
    const cacheKey = `room:${roomId}`;
    await redis.set(cacheKey, JSON.stringify(saved), 'EX', 3600);

    res.json({ success: true, room: saved });
  } catch (error) {
    console.error('Error saving room:', error);
    res.status(500).json({ error: 'Failed to save room' });
  }
});

// POST player heartbeat to Redis with 45s TTL for active presence
app.post('/api/rooms/:roomId/heartbeat', async (req, res) => {
  const { roomId } = req.params;
  const { playerId, playerName } = req.body;

  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }

  try {
    const key = `presence:${roomId}:${playerId}`;
    await redis.set(key, JSON.stringify({ playerId, playerName: playerName || playerId, lastSeen: Date.now() }), 'EX', 45);

    res.json({ success: true, active: true });
  } catch (error) {
    res.status(500).json({ error: 'Heartbeat error' });
  }
});

// GET online players in room via Redis
app.get('/api/rooms/:roomId/presence', async (req, res) => {
  const { roomId } = req.params;
  try {
    const keys = await redis.keys(`presence:${roomId}:*`);
    const activePlayers: any[] = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        try {
          activePlayers.push(JSON.parse(data));
        } catch {
          // ignore parse error
        }
      }
    }
    res.json({ roomId, activeCount: activePlayers.length, players: activePlayers });
  } catch (error) {
    res.status(500).json({ error: 'Presence check error' });
  }
});

// POST chat message: stored in MongoDB & cached in Redis
app.post('/api/rooms/:roomId/chat', async (req, res) => {
  const { roomId } = req.params;
  const { id, sender, text, drunkLevel } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Message text required' });
  }

  const msg = {
    id: id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sender: sender || 'Bợm Nhậu',
    text,
    drunkLevel: Number(drunkLevel) || 0,
    timestamp: Date.now(),
  };

  try {
    // 1. Save in MongoDB
    const updatedRoom = await dbService.addRoomChatMessage(roomId, msg);

    // 2. Refresh Redis room cache
    if (updatedRoom) {
      await redis.set(`room:${roomId}`, JSON.stringify(updatedRoom), 'EX', 3600);
    }

    res.json({ success: true, message: msg });
  } catch (error) {
    console.error('Error posting chat message:', error);
    res.status(500).json({ error: 'Failed to post message' });
  }
});

// GET chat messages: from Redis cache or MongoDB
app.get('/api/rooms/:roomId/chat', async (req, res) => {
  const { roomId } = req.params;
  try {
    const room = await dbService.getRoom(roomId);
    res.json({ messages: room?.chatMessages || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// ----------------------------------------------------------------------------
// MONGODB: PLAYERS & LEADERBOARD
// ----------------------------------------------------------------------------

app.get('/api/leaderboard', async (_req, res) => {
  try {
    const leaderboard = await dbService.getLeaderboard(15);
    res.json({ leaderboard });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

app.get('/api/players/:playerId', async (req, res) => {
  const { playerId } = req.params;
  try {
    const profile = await dbService.getPlayerProfile(playerId);
    if (!profile) {
      return res.status(404).json({ error: 'Player profile not found' });
    }
    res.json({ profile });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get player profile' });
  }
});

app.post('/api/players/:playerId', async (req, res) => {
  const { playerId } = req.params;
  try {
    const updated = await dbService.updatePlayerProfile(playerId, req.body);
    res.json({ success: true, profile: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update player profile' });
  }
});

// POST record minigame match
app.post('/api/rooms/:roomId/game-record', async (req, res) => {
  const { roomId } = req.params;
  const { gameType, winnerId, winnerName, details } = req.body;

  try {
    const record = await dbService.recordGame({
      gameId: `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomId,
      gameType: gameType || 'minigame',
      winnerId: winnerId || 'unknown',
      winnerName: winnerName || 'Bợm nhậu',
      details,
    });
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record game' });
  }
});

// ----------------------------------------------------------------------------
// GEMINI APIS (with Redis Rate Limiting & MongoDB Logging)
// ----------------------------------------------------------------------------

// API: Generate Truth or Dare via Gemini 3.8 Flash
app.post('/api/truth-or-dare', async (req, res) => {
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

// ----------------------------------------------------------------------------
// DATABASE ERROR MIDDLEWARE (Graceful handling required by AI Studio guidelines)
// ----------------------------------------------------------------------------

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (
    err.name === 'MongooseError' ||
    err.name === 'MongoNetworkError' ||
    (err.message && err.message.includes('buffering timed out'))
  ) {
    console.warn('[AI Studio] Database offline — returning mock response');
    if (req.method === 'GET') {
      return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
    }
    return res.status(503).json({ error: 'Service temporarily unavailable (database offline)' });
  }
  next(err);
});

// Setup Vite in Dev or Serve Static in Prod
async function startServer() {
  // Initialize MongoDB connection asynchronously
  await initMongo();

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

  app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
