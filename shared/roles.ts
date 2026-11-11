/**
 * Role-based access. Roles live in their own collections (`roles`, `user_roles`),
 * and every check goes through a *permission*, so a new role (moderator, tester...)
 * only needs a new row in `roles`, not new code paths.
 */
export const PERMISSIONS = {
  /** Open Dev Mode and the features still in development. */
  DEV_MODE: 'dev_mode.access',
  /** Grant / revoke roles of other accounts. */
  ROLES_MANAGE: 'roles.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

export interface RoleDefinition {
  key: string;
  label: string;
  description: string;
  permissions: Permission[];
}

/** Built-in roles, seeded into the `roles` collection on startup. */
export const SYSTEM_ROLES: RoleDefinition[] = [
  {
    key: 'admin',
    label: 'Admin quán',
    description: 'Toàn quyền: Dev Mode và cấp/gỡ role cho người khác.',
    permissions: [...ALL_PERMISSIONS],
  },
  {
    key: 'tester',
    label: 'Tester',
    description: 'Được vào Dev Mode để thử tính năng đang phát triển.',
    permissions: [PERMISSIONS.DEV_MODE],
  },
];

/** What the client learns about the signed-in account's access. */
export interface UserAccess {
  roles: string[];
  permissions: Permission[];
}

export const NO_ACCESS: UserAccess = { roles: [], permissions: [] };

export function normalizeUserAccess(value: unknown): UserAccess {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const strings = (list: unknown) =>
    Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : [];
  return {
    roles: strings(raw.roles),
    permissions: strings(raw.permissions).filter((permission): permission is Permission =>
      (ALL_PERMISSIONS as string[]).includes(permission)
    ),
  };
}

export function hasPermission(access: UserAccess | null | undefined, permission: Permission): boolean {
  return !!access?.permissions.includes(permission);
}
