/**
 * Manage roles stored in the `roles` / `user_roles` collections (uses MONGODB_URI from .env):
 *
 *   yarn role roles                      list every role and its permissions
 *   yarn role list   <username>          roles held by an account
 *   yarn role grant  <username> <role>   e.g. yarn role grant "Thần Cồn" admin
 *   yarn role revoke <username> <role>
 *
 * Changes apply immediately: permissions are re-read from the database on every check.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { UserModel } from '../server/db/models/user.ts';
import { rolesRepo } from '../server/db/repositories/roles.ts';
import { whenStartupTasksDone } from '../server/db/connection.ts';
import { usernameKey } from '../shared/validation.ts';

const USAGE = 'Usage: yarn role roles | list <username> | grant <username> <role> | revoke <username> <role>';

async function findAccount(username: string) {
  const user = await UserModel.findOne({ usernameKey: usernameKey(username) }).lean();
  if (!user) throw new Error(`Không tìm thấy tài khoản "${username}".`);
  if (user.isGuest) throw new Error('Tài khoản khách (nhậu chui) không được cấp role.');
  return user;
}

async function main() {
  const [command, username, roleKey] = process.argv.slice(2);
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  await whenStartupTasksDone(); // seeds the system roles

  switch (command) {
    case 'roles': {
      for (const role of await rolesRepo.listRoles()) {
        console.log(`${role.key.padEnd(12)} ${role.label} — ${role.permissions.join(', ') || '(no permissions)'}`);
      }
      break;
    }
    case 'list': {
      if (!username) throw new Error(USAGE);
      const user = await findAccount(username);
      const access = await rolesRepo.getUserAccess(user.userId);
      console.log(`${user.username}: roles [${access.roles.join(', ')}], permissions [${access.permissions.join(', ')}]`);
      break;
    }
    case 'grant':
    case 'revoke': {
      if (!username || !roleKey) throw new Error(USAGE);
      const user = await findAccount(username);
      const key = roleKey.trim().toLowerCase();
      if (command === 'grant') {
        if (!(await rolesRepo.roleExists(key))) throw new Error(`Role "${key}" chưa có. Xem: yarn role roles`);
        await rolesRepo.assignRole(user.userId, key, 'cli');
        console.log(`✅ Đã cấp "${key}" cho ${user.username}.`);
      } else {
        const removed = await rolesRepo.revokeRole(user.userId, key);
        console.log(removed ? `✅ Đã gỡ "${key}" khỏi ${user.username}.` : `${user.username} không có role "${key}".`);
      }
      break;
    }
    default:
      throw new Error(USAGE);
  }
}

main()
  .catch((err) => {
    console.error(`❌ ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  // Let the on-connect maintenance finish so disconnecting doesn't cut it off mid-way.
  .finally(async () => {
    await whenStartupTasksDone();
    await mongoose.disconnect();
  });
