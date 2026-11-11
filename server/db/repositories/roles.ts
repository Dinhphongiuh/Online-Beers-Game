/** Roles & permissions (collections `roles` and `user_roles`). */
import { requireMongo } from '../connection.ts';
import { RoleModel } from '../models/role.ts';
import { UserRoleModel } from '../models/userRole.ts';
import { SYSTEM_ROLES, normalizeUserAccess, type UserAccess } from '../../../shared/roles.ts';

export const rolesRepo = {
  /**
   * Make sure the built-in roles exist and carry at least their default permissions.
   * Permissions added to a system role directly in the database are kept.
   */
  async ensureSystemRoles() {
    requireMongo();
    await Promise.all(
      SYSTEM_ROLES.map((role) =>
        RoleModel.updateOne(
          { key: role.key },
          {
            $setOnInsert: { label: role.label, description: role.description },
            $set: { isSystem: true },
            $addToSet: { permissions: { $each: role.permissions } },
          },
          { upsert: true }
        )
      )
    );
  },

  async listRoles() {
    requireMongo();
    return RoleModel.find().sort({ key: 1 }).lean();
  },

  async roleExists(roleKey: string) {
    requireMongo();
    return (await RoleModel.countDocuments({ key: roleKey })) > 0;
  },

  async listUserRoleKeys(userId: string): Promise<string[]> {
    requireMongo();
    const rows = await UserRoleModel.find({ userId }).select({ roleKey: 1 }).lean();
    return rows.map((row) => row.roleKey);
  },

  /** Roles held by the account (plus `extraRoleKeys`) and the union of their permissions. */
  async getUserAccess(userId: string, extraRoleKeys: string[] = []): Promise<UserAccess> {
    requireMongo();
    const roleKeys = [...new Set([...(await rolesRepo.listUserRoleKeys(userId)), ...extraRoleKeys])];
    if (roleKeys.length === 0) return { roles: [], permissions: [] };
    const roles = await RoleModel.find({ key: { $in: roleKeys } }).lean();
    return normalizeUserAccess({
      roles: roles.map((role) => role.key),
      permissions: [...new Set(roles.flatMap((role) => role.permissions))],
    });
  },

  async assignRole(userId: string, roleKey: string, grantedBy: string) {
    requireMongo();
    await UserRoleModel.updateOne(
      { userId, roleKey },
      { $setOnInsert: { grantedBy } },
      { upsert: true }
    );
  },

  async revokeRole(userId: string, roleKey: string) {
    requireMongo();
    const res = await UserRoleModel.deleteOne({ userId, roleKey });
    return res.deletedCount > 0;
  },
};
