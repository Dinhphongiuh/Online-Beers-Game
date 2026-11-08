import { requireMongo } from '../connection.ts';
import { RoomModel, type IRoom } from '../models/room.ts';

export const roomsRepo = {
  // --- ROOMS / TABLES ---
  async getRoom(roomId: string) {
    requireMongo();
    return RoomModel.findOne({ roomId }).lean();
  },

  async upsertRoom(roomId: string, data: Partial<IRoom>) {
    requireMongo();
    return RoomModel.findOneAndUpdate(
      { roomId },
      { $set: { ...data, roomId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();
  },

  async addRoomChatMessage(
    roomId: string,
    message: { id: string; sender: string; text: string; drunkLevel?: number; timestamp: number }
  ) {
    requireMongo();
    // Keep only the last 50 messages
    return RoomModel.findOneAndUpdate(
      { roomId },
      { $push: { chatMessages: { $each: [message], $slice: -50 } } },
      { returnDocument: 'after' }
    ).lean();
  },

  async addTruthOrDareLog(
    roomId: string,
    log: { id: string; type: string; text: string; target?: string; source?: string; completedAt: number }
  ) {
    requireMongo();
    return RoomModel.findOneAndUpdate(
      { roomId },
      { $push: { truthOrDareLogs: { $each: [log], $slice: -50 } } },
      { returnDocument: 'after' }
    ).lean();
  },

};
