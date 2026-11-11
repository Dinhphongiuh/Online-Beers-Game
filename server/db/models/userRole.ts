/** Role assignments (collection `user_roles`): which account holds which role. */
import mongoose, { Schema } from 'mongoose';

export interface IUserRole {
  userId: string;
  roleKey: string;
  /** userId of whoever granted it, or 'cli' / 'system'. */
  grantedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserRoleSchema = new Schema<IUserRole>(
  {
    userId: { type: String, required: true, index: true },
    roleKey: { type: String, required: true, index: true },
    grantedBy: { type: String, default: 'system' },
  },
  { timestamps: true, collection: 'user_roles' }
);
UserRoleSchema.index({ userId: 1, roleKey: 1 }, { unique: true });

export const UserRoleModel = mongoose.model<IUserRole>('UserRole', UserRoleSchema);
