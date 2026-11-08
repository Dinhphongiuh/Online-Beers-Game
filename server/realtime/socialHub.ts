/**
 * In-process registry of who is connected to the social_hub room, so REST routes can push
 * events ("X muốn kết bạn", "X rủ bạn vào bàn") to a user's open tabs right away.
 *
 * Single server process for now; with several instances this would become Redis pub/sub.
 */
import type { Client } from '@colyseus/core';
import { SOCIAL_EVENT_MSG, type SocialEvent } from '../../shared/social.ts';

const connections = new Map<string, Set<Client>>();

export const socialHub = {
  add(userId: string, client: Client) {
    let set = connections.get(userId);
    if (!set) connections.set(userId, (set = new Set()));
    set.add(client);
    return set.size;
  },

  /** Returns how many tabs the user still has open. */
  remove(userId: string, client: Client) {
    const set = connections.get(userId);
    if (!set) return 0;
    set.delete(client);
    if (!set.size) connections.delete(userId);
    return set.size;
  },

  isConnected(userId: string) {
    return (connections.get(userId)?.size ?? 0) > 0;
  },

  notify(userId: string, event: SocialEvent) {
    connections.get(userId)?.forEach((c) => {
      try {
        c.send(SOCIAL_EVENT_MSG, event);
      } catch {
        // socket closing: the poll fallback will catch up
      }
    });
  },

  notifyMany(userIds: string[], event: SocialEvent) {
    for (const id of userIds) this.notify(id, event);
  },
};
