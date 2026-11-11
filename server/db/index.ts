/**
 * Data layer entry point. Routes talk to `dbService` (one object, grouped by domain below);
 * add a new domain as server/db/repositories/<name>.ts and spread it in here.
 */
import { getMongoStatus } from './connection.ts';
import { roomsRepo } from './repositories/rooms.ts';
import { playersRepo } from './repositories/players.ts';
import { receiptsRepo } from './repositories/receipts.ts';
import { gamesRepo } from './repositories/games.ts';
import { usersRepo } from './repositories/users.ts';
import { friendsRepo } from './repositories/friends.ts';
import { npcsRepo } from './repositories/npcs.ts';
import { rolesRepo } from './repositories/roles.ts';

export { initMongo, isDuplicateKeyError } from './connection.ts';
export { hashPassword, verifyPassword } from './password.ts';
export * from './models/index.ts';
export { roomsRepo, playersRepo, receiptsRepo, gamesRepo, usersRepo, friendsRepo, npcsRepo, rolesRepo };

export const dbService = {
  getStatus: getMongoStatus,
  ...roomsRepo,
  ...playersRepo,
  ...receiptsRepo,
  ...gamesRepo,
  ...usersRepo,
  ...friendsRepo,
  ...npcsRepo,
  ...rolesRepo,
};
