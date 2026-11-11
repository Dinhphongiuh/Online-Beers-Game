/** Role definitions (collection `roles`): a key plus the permissions it grants. */
import mongoose, { Schema } from 'mongoose';

export interface IRole {
  key: string;
  label: string;
  description?: string;
  permissions: string[];
  /** Seeded from SYSTEM_ROLES (shared/roles.ts). */
  isSystem: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    label: { type: String, required: true },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'roles' }
);

export const RoleModel = mongoose.model<IRole>('Role', RoleSchema);
