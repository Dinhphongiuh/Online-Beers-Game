/** Accounts & sessions: register, login, guest, me, logout, forgot-password. */
import crypto from 'crypto';
import { Router } from 'express';
import { dbService, isDuplicateKeyError, verifyPassword } from '../db/index.ts';
import { redis } from '../redis.ts';
import { sendServerError } from '../http/respond.ts';
import { resolveUserAccess } from '../http/roles.ts';
import { NO_ACCESS } from '../../shared/roles.ts';
import { normalizeChibiAppearance } from '../../shared/appearance.ts';
import {
  firstError,
  validateEmail,
  validateLoginIdentifier,
  validateRegistration,
  validateUsername,
} from '../../shared/validation.ts';

export const authRouter = Router();

// POST /api/auth/register - Create account with salted hash and Redis session
authRouter.post('/api/auth/register', async (req, res) => {
  const { avatar, title, drunkArchetype, declaredTolerance } = req.body;

  // Same rules as the sign-up form (shared/validation.ts)
  const form = validateRegistration({
    username: String(req.body.username ?? ''),
    email: req.body.email ? String(req.body.email) : undefined,
    password: String(req.body.password ?? ''),
  });
  if (!form.ok) {
    return res.status(400).json({ error: firstError(form.errors), fieldErrors: form.errors });
  }
  const { username, email, password } = form.value;

  try {
    if (await dbService.isUsernameTaken(username)) {
      return res.status(409).json({
        error: 'Biệt danh này đã có bợm nhậu khác đăng ký rồi! Vui lòng chọn tên khác.',
        fieldErrors: { username: 'Biệt danh đã có người dùng.' },
      });
    }

    if (email && (await dbService.isEmailTaken(email))) {
      return res.status(409).json({
        error: 'Email này đã gắn với một tài khoản khác!',
        fieldErrors: { email: 'Email đã được dùng cho tài khoản khác.' },
      });
    }

    const newUser = await dbService.createUser({
      username,
      email,
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
      user: { ...safeUser, access: await resolveUserAccess(newUser) },
      message: 'Đăng ký thành công! Đã cấp Hộ Chiếu Tửu Lượng.',
    });
  } catch (error: any) {
    // Lost a race with another sign-up for the same name/email: the unique index caught it
    if (isDuplicateKeyError(error, 'usernameKey') || isDuplicateKeyError(error, 'username')) {
      return res.status(409).json({
        error: 'Biệt danh này vừa có người đăng ký! Vui lòng chọn tên khác.',
        fieldErrors: { username: 'Biệt danh đã có người dùng.' },
      });
    }
    console.error('Registration error:', error);
    sendServerError(res, error, 'Đăng ký thất bại do lỗi hệ thống');
  }
});

// GET /api/auth/check-username?username=... — live "is this name free?" for the sign-up form
authRouter.get('/api/auth/check-username', async (req, res) => {
  const check = validateUsername(String(req.query.username ?? ''));
  if (!check.ok) return res.json({ available: false, valid: false, error: check.error });
  try {
    const taken = await dbService.isUsernameTaken(check.value);
    res.json({
      available: !taken,
      valid: true,
      username: check.value,
      error: taken ? 'Biệt danh đã có người dùng.' : undefined,
    });
  } catch (error) {
    sendServerError(res, error, 'Không kiểm tra được biệt danh');
  }
});

// POST /api/auth/login - Check password hash, create Redis session token
authRouter.post('/api/auth/login', async (req, res) => {
  const { password } = req.body;
  const idCheck = validateLoginIdentifier(String(req.body.identifier ?? ''));
  if (!idCheck.ok) {
    return res.status(400).json({ error: idCheck.error, fieldErrors: { identifier: idCheck.error } });
  }
  if (!password) {
    return res.status(400).json({ error: 'Vui lòng nhập mật khẩu!', fieldErrors: { password: 'Vui lòng nhập mật khẩu.' } });
  }
  const identifier = idCheck.value;

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
    // Self-heal accounts whose profile was never created (e.g. an earlier failed registration)
    if (!(await dbService.getPlayerProfile(user.userId))) {
      await dbService.updatePlayerProfile(user.userId, {
        name: user.username,
        avatar: user.avatar,
        title: user.title,
        coins: user.coins,
        gems: user.gems,
      });
    }

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
      user: { ...safeUser, access: await resolveUserAccess(user) },
      message: 'Đăng nhập thành công! Mời đại ca vào bàn.',
    });
  } catch (error) {
    console.error('Login error:', error);
    sendServerError(res, error, 'Đăng nhập thất bại do lỗi hệ thống');
  }
});

// POST /api/auth/guest - Instant guest access with Redis session
authRouter.post('/api/auth/guest', async (req, res) => {
  const { roomPin, avatar } = req.body;
  const nick = validateUsername(String(req.body.nickname ?? '') || 'Khách Nhậu Chui');
  if (!nick.ok) {
    return res.status(400).json({ error: nick.error, fieldErrors: { nickname: nick.error } });
  }

  try {
    // Usernames are unique, so a guest gets a "#1234" tag: two "Thần Cồn Quận 4" can drink at once
    let guestName = '';
    for (let attempt = 0; attempt < 6 && !guestName; attempt++) {
      const candidate = `${nick.value} #${Math.floor(1000 + Math.random() * 9000)}`;
      if (!(await dbService.isUsernameTaken(candidate))) guestName = candidate;
    }
    if (!guestName) {
      return res.status(409).json({ error: 'Biệt danh tạm này đang quá đông người dùng, thử tên khác nhé!' });
    }

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
      user: { ...guestUser, access: NO_ACCESS },
      message: 'Đã vào bàn nhậu với tư cách khách vãng lai!',
    });
  } catch (error) {
    console.error('Guest auth error:', error);
    sendServerError(res, error, 'Không thể tạo phiên nhậu chui');
  }
});

// GET /api/auth/me - Read Bearer token from Redis and fetch full DB profile
authRouter.get('/api/auth/me', async (req, res) => {
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
      return res.json({ authenticated: true, user: { ...safeUser, access: await resolveUserAccess(user) } });
    }

    return res.json({ authenticated: true, user: { ...session, access: NO_ACCESS } });
  } catch (error) {
    console.error('Auth verification error:', error);
    sendServerError(res, error, 'Lỗi xác thực phiên');
  }
});

// POST /api/auth/appearance - Save the signed-in player's human character creator settings
authRouter.post('/api/auth/appearance', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  try {
    const token = authHeader.substring(7);
    const sessionRaw = await redis.get(`session:${token}`);
    if (!sessionRaw) {
      return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc không tồn tại' });
    }

    const session = JSON.parse(sessionRaw);
    if (typeof session.userId !== 'string' || !session.userId) {
      return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ' });
    }

    const appearance = {
      ...normalizeChibiAppearance(req.body?.appearance),
      characterStyle: 'human' as const,
    };
    const user = await dbService.updateUser(session.userId, { appearance });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy hồ sơ người chơi' });

    res.json({ success: true, appearance: user.appearance });
  } catch (error) {
    console.error('Character appearance save error:', error);
    sendServerError(res, error, 'Không lưu được ngoại hình nhân vật');
  }
});

// POST /api/auth/logout - Invalidate Redis session token
authRouter.post('/api/auth/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    await redis.del(`session:${token}`);
  }
  res.json({ success: true, message: 'Đã đăng xuất khỏi bàn nhậu!' });
});

// POST /api/auth/forgot-password - Recovery with cold towel humor
authRouter.post('/api/auth/forgot-password', async (req, res) => {
  const emailCheck = validateEmail(String(req.body.email ?? ''));
  if (!emailCheck.ok) {
    return res.status(400).json({ error: emailCheck.error, fieldErrors: { email: emailCheck.error } });
  }
  const email = emailCheck.value;

  res.json({
    success: true,
    message: `Đã gửi khăn lạnh giải rượu tới ${email}! Mật khẩu tạm của bạn là: khongsaykhongve123`,
    tempPassword: 'khongsaykhongve123',
  });
});
