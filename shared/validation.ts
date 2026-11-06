/**
 * Shared input validation for the auth forms (client) and auth API (server).
 * Keep this file dependency-free: it is imported by both Vite (browser) and tsx (Node).
 */

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 22;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 64;
export const EMAIL_MAX = 254;
const EMAIL_LOCAL_MAX = 64;

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T,>(value: T): FieldResult<T> => ({ ok: true, value });
const fail = <T,>(error: string): FieldResult<T> => ({ ok: false, error });

// ---------------------------------------------------------------------------
// USERNAME (biệt danh): unique, case-insensitive
// ---------------------------------------------------------------------------

/** Unicode-normalised, trimmed, single-spaced display form. */
export function normalizeUsername(raw: string): string {
  return (raw ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

/**
 * Uniqueness key: "Chiến Thần", "chiến   thần" and "CHIẾN THẦN" are the same name.
 * Diacritics stay significant ("Hòa" ≠ "Hoa").
 */
export function usernameKey(raw: string): string {
  return normalizeUsername(raw).toLocaleLowerCase('vi');
}

// Letters (incl. Vietnamese) and digits, with single spaces, dots, underscores or dashes between them.
// No "@" so a username can never be mistaken for an email at login.
const USERNAME_PATTERN = /^[\p{L}\p{N}]+(?:[ ._-][\p{L}\p{N}]+)*$/u;

export function validateUsername(raw: string): FieldResult<string> {
  const value = normalizeUsername(raw);
  if (!value) return fail('Vui lòng nhập biệt danh bàn nhậu.');
  const length = [...value].length;
  if (length < USERNAME_MIN) return fail(`Biệt danh phải có ít nhất ${USERNAME_MIN} ký tự.`);
  if (length > USERNAME_MAX) return fail(`Biệt danh tối đa ${USERNAME_MAX} ký tự.`);
  if (value.includes('@')) return fail('Biệt danh không được chứa ký tự "@".');
  if (!USERNAME_PATTERN.test(value)) {
    return fail('Biệt danh chỉ gồm chữ, số và dấu cách / . _ - nằm giữa các chữ (không đứng đầu, cuối hay liền nhau).');
  }
  return ok(value);
}

// ---------------------------------------------------------------------------
// EMAIL
// ---------------------------------------------------------------------------

export function normalizeEmail(raw: string): string {
  return (raw ?? '').trim().toLowerCase();
}

const EMAIL_LOCAL_PATTERN = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const EMAIL_DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Practical email check (what real mail providers accept), not full RFC 5322.
 * Pass `required: false` for optional email fields: empty is then valid (value = undefined).
 */
export function validateEmail(
  raw: string,
  { required = true }: { required?: boolean } = {}
): FieldResult<string | undefined> {
  const value = normalizeEmail(raw);
  if (!value) return required ? fail('Vui lòng nhập email.') : ok(undefined);
  if (value.length > EMAIL_MAX) return fail(`Email quá dài (tối đa ${EMAIL_MAX} ký tự).`);
  if (/\s/.test(value)) return fail('Email không được chứa khoảng trắng.');

  const at = value.lastIndexOf('@');
  if (at <= 0 || value.indexOf('@') !== at) return fail('Email phải có đúng một ký tự "@", ví dụ ten@gmail.com.');
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);

  if (local.length > EMAIL_LOCAL_MAX) return fail('Phần trước "@" quá dài (tối đa 64 ký tự).');
  if (!EMAIL_LOCAL_PATTERN.test(local)) {
    return fail('Phần trước "@" có ký tự không hợp lệ hoặc dấu chấm ở đầu/cuối/liền nhau.');
  }
  if (!domain) return fail('Thiếu tên miền sau "@", ví dụ ten@gmail.com.');
  const labels = domain.split('.');
  if (labels.length < 2) return fail('Tên miền phải có dạng ten-mien.com.');
  if (!labels.every((l) => EMAIL_DOMAIN_LABEL.test(l))) return fail('Tên miền email không hợp lệ.');
  if (!/^[a-z]{2,}$/.test(labels[labels.length - 1])) return fail('Đuôi tên miền không hợp lệ (ví dụ .com, .vn).');
  return ok(value);
}

// ---------------------------------------------------------------------------
// PASSWORD
// ---------------------------------------------------------------------------

export function validatePassword(raw: string): FieldResult<string> {
  const value = raw ?? '';
  if (!value) return fail('Vui lòng nhập mật khẩu.');
  if (value.length < PASSWORD_MIN) return fail(`Mật khẩu phải có ít nhất ${PASSWORD_MIN} ký tự.`);
  if (value.length > PASSWORD_MAX) return fail(`Mật khẩu tối đa ${PASSWORD_MAX} ký tự.`);
  if (value.trim() !== value) return fail('Mật khẩu không được bắt đầu hoặc kết thúc bằng khoảng trắng.');
  return ok(value);
}

// ---------------------------------------------------------------------------
// FORMS
// ---------------------------------------------------------------------------

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type FormResult<T, K extends string> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors<K> };

export function validateRegistration(input: {
  username: string;
  email?: string;
  password: string;
}): FormResult<{ username: string; email?: string; password: string }, 'username' | 'email' | 'password'> {
  const username = validateUsername(input.username);
  const email = validateEmail(input.email ?? '', { required: false });
  const password = validatePassword(input.password);
  const errors: FieldErrors<'username' | 'email' | 'password'> = {};
  if (!username.ok) errors.username = username.error;
  if (!email.ok) errors.email = email.error;
  if (!password.ok) errors.password = password.error;
  if (!username.ok || !email.ok || !password.ok) return { ok: false, errors };
  return { ok: true, value: { username: username.value, email: email.value, password: password.value } };
}

/** Login accepts either an email or a username. */
export function validateLoginIdentifier(raw: string): FieldResult<string> {
  const value = (raw ?? '').trim();
  if (!value) return fail('Vui lòng nhập biệt danh hoặc email.');
  if (value.includes('@')) {
    const email = validateEmail(value);
    return email.ok ? ok(email.value as string) : fail(email.error);
  }
  // Only a sanity check: accounts created before these rules must still be able to log in
  if ([...value].length > 64) return fail('Biệt danh quá dài.');
  return ok(normalizeUsername(value));
}

/** First error message of a form result, for a single summary line. */
export function firstError<K extends string>(errors: FieldErrors<K>): string | undefined {
  return Object.values(errors).find(Boolean) as string | undefined;
}
