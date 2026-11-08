/**
 * Friends, presence and table invites (shared by server routes and the lobby UI).
 *
 * Presence states:
 *   online   — in the home menu
 *   drinking — sitting at a table (roomCode tells which)
 *   offline  — no heartbeat: "bị vợ thu điện thoại"
 */

export type PresenceState = 'online' | 'drinking' | 'offline';

export interface Presence {
  state: PresenceState;
  roomCode?: string;
  updatedAt?: number;
}

export interface SocialUser {
  userId: string;
  username: string;
  avatar: string;
  title?: string;
}

export interface FriendView extends SocialUser {
  presence: Presence;
}

export interface TableInvite {
  id: string;
  fromUserId: string;
  fromName: string;
  fromAvatar: string;
  roomCode: string;
  at: number;
}

export interface SocialSnapshot {
  friends: FriendView[];
  /** Friend requests waiting for MY answer. */
  incoming: SocialUser[];
  /** Requests I sent that are still pending. */
  outgoing: SocialUser[];
  /** "X rủ bạn vào bàn #1234" */
  invites: TableInvite[];
}

/** Heartbeat cadence and how long a missed heartbeat keeps you "online". */
export const PRESENCE_HEARTBEAT_MS = 20_000;
export const PRESENCE_TTL_SECONDS = 45;
export const INVITE_TTL_SECONDS = 10 * 60;
export const MAX_CUSTOM_NPCS = 12;

export const PRESENCE_LABEL: Record<PresenceState, string> = {
  online: 'Đang online ở quán',
  drinking: 'Đang trong cuộc nhậu',
  offline: 'Offline • bị vợ thu điện thoại 📵',
};

export function presenceNote(p: Presence): string {
  if (p.state === 'drinking') return p.roomCode ? `Đang nhậu ở bàn #${p.roomCode} 🍻` : 'Đang trong cuộc nhậu 🍻';
  return PRESENCE_LABEL[p.state];
}

/** Online first, then drinking, then the phones confiscated by wives; A→Z inside a group. */
export function sortFriends<T extends { username: string; presence: Presence }>(list: T[]): T[] {
  const rank: Record<PresenceState, number> = { online: 0, drinking: 1, offline: 2 };
  return [...list].sort(
    (a, b) => rank[a.presence.state] - rank[b.presence.state] || a.username.localeCompare(b.username, 'vi')
  );
}

export function sanitizePresenceInput(raw: unknown): Presence {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const state: PresenceState = o.state === 'drinking' ? 'drinking' : 'online';
  const roomCode = typeof o.roomCode === 'string' ? o.roomCode.replace(/[^0-9A-Za-z]/g, '').slice(0, 12) : '';
  return { state, ...(state === 'drinking' && roomCode ? { roomCode } : {}) };
}

// ---------------------------------------------------------------------------
// Custom NPCs ("NPC tự tạo")
// ---------------------------------------------------------------------------

export const NPC_AVATARS = ['dog', 'cat', 'panda', 'duck', 'bear', 'hamster'] as const;
export const NPC_CLOTHES = ['tanktop_red', 'tanktop_white', 'floral_shirt', 'gold_chain'] as const;
export const NPC_HATS = ['none', 'sunglasses', 'traffic_helmet', 'towel'] as const;
export const NPC_GLASSES = ['beer_mug', 'coi_glass', 'horn', 'jade_cup'] as const;

export interface CustomNpc {
  npcId: string;
  name: string;
  avatar: (typeof NPC_AVATARS)[number];
  clothing: (typeof NPC_CLOTHES)[number];
  hat: (typeof NPC_HATS)[number];
  glassType: (typeof NPC_GLASSES)[number];
  /** 0 = một lon là gục, 100 = hũ chìm. Shapes how fast they get drunk. */
  tolerance: number;
  catchphrase: string;
}

const pick = <T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] =>
  (list as readonly string[]).includes(v as string) ? (v as T[number]) : fallback;

export function sanitizeNpcInput(raw: unknown): Omit<CustomNpc, 'npcId'> | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim().replace(/\s+/g, ' ').slice(0, 24) : '';
  if (name.length < 2) return null;
  const tol = typeof o.tolerance === 'number' && Number.isFinite(o.tolerance) ? o.tolerance : 50;
  return {
    name,
    avatar: pick(NPC_AVATARS, o.avatar, 'dog'),
    clothing: pick(NPC_CLOTHES, o.clothing, 'tanktop_red'),
    hat: pick(NPC_HATS, o.hat, 'none'),
    glassType: pick(NPC_GLASSES, o.glassType, 'beer_mug'),
    tolerance: Math.round(Math.min(100, Math.max(0, tol))),
    catchphrase: typeof o.catchphrase === 'string' ? o.catchphrase.trim().slice(0, 80) : '',
  };
}

/** Lobby/table id for a custom NPC (never collides with the built-in `bot_*` regulars). */
export const customNpcPlayerId = (npcId: string) => `npc_${npcId}`;

// ---------------------------------------------------------------------------
// Realtime push (Colyseus room "social_hub"): the server tells you right away instead of
// waiting for the next poll.
// ---------------------------------------------------------------------------

export const SOCIAL_ROOM_NAME = 'social_hub';
export const SOCIAL_EVENT_MSG = 'social';

export type SocialEvent =
  | { type: 'friend_request'; from: SocialUser }
  | { type: 'friend_accepted'; by: SocialUser }
  | { type: 'friend_removed'; userId: string }
  | { type: 'table_invite'; invite: TableInvite }
  | { type: 'presence'; userId: string; presence: Presence };

/** One line for a toast, or null when the event is silent (presence ticks). */
export function socialEventToast(e: SocialEvent): string | null {
  switch (e.type) {
    case 'friend_request':
      return `📨 ${e.from.username} muốn kết bạn nhậu với bạn!`;
    case 'friend_accepted':
      return `🤝 ${e.by.username} đã đồng ý kết bạn — giờ là bạn nhậu!`;
    case 'table_invite':
      return `🍻 ${e.invite.fromName} rủ bạn vào bàn #${e.invite.roomCode}!`;
    default:
      return null;
  }
}

/** A friend's passport as shown when you tap them in the friends list. */
export interface FriendProfile extends SocialUser {
  isGuest: boolean;
  createdAt?: string;
  drunkArchetype?: string;
  presence: Presence;
  coins: number;
  drinksCount: number;
  nights: number;
  nightsEscaped: number;
  bestNightScore: number;
  peakAlcohol: number;
  favoriteQuote: string;
  pinnedPhoto: { src: string; caption: string } | null;
  friendsSince?: string;
}
