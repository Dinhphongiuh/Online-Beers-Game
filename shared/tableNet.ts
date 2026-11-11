import type { ChibiAppearanceDNA } from './appearance';

/**
 * Realtime protocol for one drinking table (Colyseus room "nhau_table").
 *
 * Synced state (delta-encoded by Colyseus): who is at the table, their look, Độ Cồn
 * and pose. Everything one-off (chat, cheers, thrown slippers, physics props, WebRTC
 * signaling) travels as room messages.
 */

export const TABLE_ROOM_NAME = 'nhau_table';
export const TABLE_MAX_PLAYERS = 8;
/** Client → server pose rate. The server re-broadcasts state at TABLE_PATCH_MS. */
export const POSE_SEND_INTERVAL_MS = 66;
export const TABLE_PATCH_MS = 50;

/** Where & how hard the table drinks — picked by the host, shared with every guest. */
export const TABLE_THEMES = ['sidewalk', 'bo_ke', 'rooftop'] as const;
export const TABLE_SPEEDS = ['lai_rai', 'toi_ben', 'tu_chien'] as const;
export interface TableSetup {
  theme: (typeof TABLE_THEMES)[number];
  drunkSpeed: (typeof TABLE_SPEEDS)[number];
  rules: { micDzo: boolean; randomEvents: boolean; billBrawl: boolean };
}
export const DEFAULT_TABLE_SETUP: TableSetup = {
  theme: 'bo_ke',
  drunkSpeed: 'toi_ben',
  rules: { micDzo: false, randomEvents: true, billBrawl: true },
};

/** 'lobby' = phòng chờ (everyone gets ready), 'playing' = the night has started. */
export type TablePhase = 'lobby' | 'playing';

export interface TableJoinOptions {
  roomCode: string;
  playerId: string;
  name: string;
  avatar: string;
  clothing: string;
  hat: string;
  glassType: string;
  appearance?: ChibiAppearanceDNA;
  /** Host opening the table: the venue/rules everyone will play with. */
  setup?: TableSetup;
}

/** Room-level state every client mirrors (who hosts, which venue, lobby or playing). */
export interface TableInfo {
  phase: TablePhase;
  hostSessionId: string;
  setup: TableSetup;
}

/** Plain-JSON view of a synced player (what the client works with). */
export interface NetPlayer {
  sessionId: string;
  playerId: string;
  name: string;
  avatar: string;
  clothing: string;
  hat: string;
  glassType: string;
  appearance: ChibiAppearanceDNA;
  alcohol: number;
  passedOut: boolean;
  drinks: number;
  /** World position while walking around (free roam); ignored while seated. */
  x: number;
  z: number;
  angle: number;
  roaming: boolean;
  moving: boolean;
  speaking: boolean;
  /** Mic loudness 0..1, drives the remote mouth/bubble and the "DZÔ" meter. */
  voiceLevel: number;
  joinedAt: number;
  /** Phòng chờ: "Sẵn sàng" toggled. */
  ready: boolean;
  /** Sổ Nợ: "NỢ 1 CHẦU NHẬU TỪ 08/11" while their creditor sits at this table (else ''). */
  debt: string;
}

export interface PoseMessage {
  x: number;
  z: number;
  angle: number;
  roaming: boolean;
  moving: boolean;
}

export interface StatusMessage {
  alcohol: number;
  passedOut: boolean;
  drinks: number;
  debt?: string;
}

export interface VoiceLevelMessage {
  speaking: boolean;
  level: number;
}

export interface ChatMessageIn {
  text: string;
  drunkLevel: number;
}

export interface NetChatMessage {
  id: string;
  senderId: string;
  sender: string;
  text: string;
  drunkLevel: number;
  timestamp: number;
}

/** One-shot table events, relayed to everyone else at the table. */
export type TableEvent =
  | { kind: 'cheers' }
  | { kind: 'emote'; emote: string }
  | { kind: 'throw_slipper'; origin: [number, number, number]; velocity: [number, number, number] }
  | { kind: 'flip_table' }
  | { kind: 'dzo_shout'; decibel: number }
  /** The bill was settled at the caller's table: the night is over for everyone. */
  | { kind: 'night_end'; billTotal: number; payerName: string };

export interface TableEventEnvelope {
  from: string; // sessionId
  fromName: string;
  event: TableEvent;
  at: number;
}

/**
 * Owner-authoritative physics: whoever last touched a prop simulates it and streams
 * its transform; everyone else just interpolates.
 */
export interface PropSnapshot {
  id: string;
  p: [number, number, number];
  q: [number, number, number, number];
  sleeping: boolean;
}

export interface PropSyncMessage {
  props: PropSnapshot[];
}

export interface PropSyncEnvelope extends PropSyncMessage {
  owner: string;
}

/** WebRTC voice mesh signaling (relayed by sessionId). */
export interface SignalOut {
  targetId: string;
  sdp?: { type: string; sdp?: string };
  candidate?: { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
}

export interface SignalIn {
  peerId: string;
  sdp?: { type: string; sdp?: string };
  candidate?: { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
}

export const MSG = {
  pose: 'pose',
  status: 'status',
  voice: 'voice',
  chat: 'chat',
  chatHistory: 'chat_history',
  event: 'event',
  props: 'props',
  rtcJoin: 'rtc:join',
  rtcPeers: 'rtc:peers',
  rtcPeerJoined: 'rtc:peer-joined',
  rtcPeerLeft: 'rtc:peer-left',
  rtcOffer: 'rtc:offer',
  rtcAnswer: 'rtc:answer',
  rtcIce: 'rtc:ice',
  // Phòng chờ
  ready: 'lobby:ready',
  setup: 'lobby:setup',
  start: 'lobby:start',
} as const;

const clampNum = (v: unknown, min: number, max: number, fallback = 0) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
};

export function sanitizePose(m: unknown): PoseMessage | null {
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  return {
    x: clampNum(o.x, -60, 60),
    z: clampNum(o.z, -60, 60),
    angle: clampNum(o.angle, -100, 100),
    roaming: o.roaming === true,
    moving: o.moving === true,
  };
}

export function sanitizeStatus(m: unknown): StatusMessage | null {
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  return {
    alcohol: clampNum(o.alcohol, 0, 100),
    passedOut: o.passedOut === true,
    drinks: Math.round(clampNum(o.drinks, 0, 9999)),
    debt: typeof o.debt === 'string' ? o.debt.slice(0, 60) : '',
  };
}

export function sanitizeChatText(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim().slice(0, 280);
  return trimmed.length ? trimmed : null;
}

function isVec3(v: unknown): v is [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

export function sanitizeEvent(e: unknown): TableEvent | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  switch (o.kind) {
    case 'cheers':
    case 'flip_table':
      return { kind: o.kind };
    case 'emote':
      return typeof o.emote === 'string' ? { kind: 'emote', emote: o.emote.slice(0, 32) } : null;
    case 'dzo_shout':
      return { kind: 'dzo_shout', decibel: clampNum(o.decibel, 0, 140) };
    case 'night_end':
      return {
        kind: 'night_end',
        billTotal: Math.round(clampNum(o.billTotal, 0, 1e9)),
        payerName: typeof o.payerName === 'string' ? o.payerName.slice(0, 32) : '',
      };
    case 'throw_slipper':
      return isVec3(o.origin) && isVec3(o.velocity)
        ? { kind: 'throw_slipper', origin: o.origin, velocity: o.velocity }
        : null;
    default:
      return null;
  }
}

export function sanitizeProps(m: unknown): PropSyncMessage | null {
  if (!m || typeof m !== 'object' || !Array.isArray((m as PropSyncMessage).props)) return null;
  const props: PropSnapshot[] = [];
  for (const raw of (m as PropSyncMessage).props.slice(0, 64)) {
    if (!raw || typeof raw.id !== 'string' || !isVec3(raw.p)) continue;
    const q = raw.q;
    if (!Array.isArray(q) || q.length !== 4 || !q.every((n) => typeof n === 'number' && Number.isFinite(n))) continue;
    props.push({ id: raw.id.slice(0, 40), p: raw.p, q: q as PropSnapshot['q'], sleeping: raw.sleeping === true });
  }
  return { props };
}

/** "TRẠM-NHẬU-123456" or "123456" → "123456". Keeps rooms keyed by the 6-digit PIN. */
export function normalizeRoomCode(code: unknown): string {
  const s = typeof code === 'string' ? code : '';
  const digits = s.replace(/^TRẠM-NHẬU-/, '').replace(/[^0-9A-Za-z]/g, '').slice(0, 12);
  return digits || '8888';
}

export function sanitizeSetup(m: unknown): TableSetup | null {
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  const r = (o.rules && typeof o.rules === 'object' ? o.rules : {}) as Record<string, unknown>;
  const d = DEFAULT_TABLE_SETUP;
  return {
    theme: TABLE_THEMES.includes(o.theme as TableSetup['theme']) ? (o.theme as TableSetup['theme']) : d.theme,
    drunkSpeed: TABLE_SPEEDS.includes(o.drunkSpeed as TableSetup['drunkSpeed'])
      ? (o.drunkSpeed as TableSetup['drunkSpeed'])
      : d.drunkSpeed,
    rules: {
      micDzo: typeof r.micDzo === 'boolean' ? r.micDzo : d.rules.micDzo,
      randomEvents: typeof r.randomEvents === 'boolean' ? r.randomEvents : d.rules.randomEvents,
      billBrawl: typeof r.billBrawl === 'boolean' ? r.billBrawl : d.rules.billBrawl,
    },
  };
}

/** Every human at the table pressed "Sẵn sàng" (the host starts it, so they count as ready). */
export function allPlayersReady(players: { sessionId: string; ready: boolean }[], hostSessionId: string) {
  return players.length > 0 && players.every((p) => p.ready || p.sessionId === hostSessionId);
}
