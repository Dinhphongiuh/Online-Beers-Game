/** PBKDF2 (SHA-512) password hashing with a per-user salt. */
import crypto from 'crypto';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, combinedHash?: string): boolean {
  if (!combinedHash) return false;
  const parts = combinedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  const testHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return testHash === originalHash;
}
