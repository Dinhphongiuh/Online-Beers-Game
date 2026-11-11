/** Resolving an account's roles/permissions, and the permission route guard. */
import type express from 'express';
import { dbService } from '../db/index.ts';
import { NO_ACCESS, type Permission, type UserAccess } from '../../shared/roles.ts';
import { usernameKey } from '../../shared/validation.ts';
import { readSession } from './session.ts';

/**
 * Bootstrap admins from the ADMIN_USERNAMES env var (comma separated, case-insensitive),
 * so the first admin exists before anyone can grant roles. Everything else is stored
 * in the `user_roles` collection.
 */
function isEnvAdmin(username: string | undefined) {
  if (!username) return false;
  const key = usernameKey(username);
  return String(process.env.ADMIN_USERNAMES || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .some((name) => usernameKey(name) === key);
}

/** Roles and permissions of a stored account. Guests never get any. */
export async function resolveUserAccess(
  user: { userId?: string; username?: string; isGuest?: boolean } | null
): Promise<UserAccess> {
  if (!user?.userId || user.isGuest) return NO_ACCESS;
  return dbService.getUserAccess(user.userId, isEnvAdmin(user.username) ? ['admin'] : []);
}

/**
 * Route guard: 401 without a session, 403 without the permission.
 * Access is read from the database on every call, so revoking a role takes
 * effect immediately even for sessions created earlier.
 */
export function requirePermission(permission: Permission): express.RequestHandler {
  return async (req, res, next) => {
    try {
      const session = await readSession(req);
      if (!session) return res.status(401).json({ error: 'Chưa đăng nhập — mời qua Cổng Quán' });
      const user = await dbService.findUserById(session.userId);
      const access = await resolveUserAccess(user);
      if (!access.permissions.includes(permission)) {
        return res.status(403).json({ error: 'Bạn không có quyền vào khu vực này.' });
      }
      res.locals.user = session;
      res.locals.access = access;
      next();
    } catch (err) {
      next(err);
    }
  };
}
