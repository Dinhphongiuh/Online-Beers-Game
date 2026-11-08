import { Room, type Client } from '@colyseus/core';
import { schema, t, type SchemaType } from '@colyseus/schema';
import { dbService } from './db/index.ts';
import { redis } from './redis.ts';
import {
  MSG,
  TABLE_MAX_PLAYERS,
  TABLE_PATCH_MS,
  normalizeRoomCode,
  sanitizeChatText,
  sanitizeEvent,
  sanitizePose,
  sanitizeProps,
  sanitizeStatus,
  type NetChatMessage,
  type SignalOut,
  type TableEventEnvelope,
  type TableJoinOptions,
} from '../shared/tableNet.ts';

export const NetPlayerState = schema(
  {
    sessionId: t.string(),
    playerId: t.string(),
    name: t.string(),
    avatar: t.string(),
    clothing: t.string(),
    hat: t.string(),
    glassType: t.string(),
    alcohol: t.uint8(),
    passedOut: t.boolean(),
    drinks: t.uint16(),
    x: t.float32(),
    z: t.float32(),
    angle: t.float32(),
    roaming: t.boolean(),
    moving: t.boolean(),
    speaking: t.boolean(),
    voiceLevel: t.float32(),
    joinedAt: t.float64(),
    debt: t.string(),
  },
  'NetPlayerState'
);
export type NetPlayerState = SchemaType<typeof NetPlayerState>;

export const TableRoomState = schema(
  {
    roomCode: t.string(),
    players: t.map(NetPlayerState),
  },
  'TableRoomState'
);
export type TableRoomState = SchemaType<typeof TableRoomState>;

const str = (v: unknown, max: number, fallback: string) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback;

/**
 * Best-effort side effects (presence keys, chat persistence). The realtime table must keep
 * working when Redis/MongoDB are down, and their clients can throw synchronously.
 */
function bestEffort(fn: () => Promise<unknown>) {
  try {
    fn().catch(() => null);
  } catch {
    // backend unavailable: realtime play continues without it
  }
}

/** Mongo room id used by the REST API & chat history (matches App's tableState.roomId). */
const mongoRoomId = (code: string) => `TRẠM-NHẬU-${code}`;

/**
 * One drinking table. Rooms are keyed by the 6-digit PIN (filterBy roomCode), so
 * everyone typing the same PIN in the lobby lands at the same table.
 */
export class TableRoom extends Room<{ state: TableRoomState }> {
  maxClients = TABLE_MAX_PLAYERS;
  private roomCode = '8888';
  private rtcPeers = new Set<string>();
  private lastPropOwner = new Map<string, { owner: string; at: number }>();

  onCreate(options: Partial<TableJoinOptions>) {
    this.roomCode = normalizeRoomCode(options.roomCode);
    const state = new TableRoomState();
    state.roomCode = this.roomCode;
    this.setState(state);
    this.patchRate = TABLE_PATCH_MS;
    this.autoDispose = true;

    this.onMessage(MSG.pose, (client, raw) => {
      const pose = sanitizePose(raw);
      const p = this.state.players.get(client.sessionId);
      if (!pose || !p) return;
      p.x = pose.x;
      p.z = pose.z;
      p.angle = pose.angle;
      p.roaming = pose.roaming;
      p.moving = pose.moving;
    });

    this.onMessage(MSG.status, (client, raw) => {
      const st = sanitizeStatus(raw);
      const p = this.state.players.get(client.sessionId);
      if (!st || !p) return;
      p.alcohol = Math.round(st.alcohol);
      p.passedOut = st.passedOut;
      p.drinks = st.drinks;
      p.debt = st.debt ?? '';
    });

    this.onMessage(MSG.voice, (client, raw: { speaking?: unknown; level?: unknown }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !raw) return;
      p.speaking = raw.speaking === true;
      const level = typeof raw.level === 'number' && Number.isFinite(raw.level) ? raw.level : 0;
      p.voiceLevel = Math.min(1, Math.max(0, level));
    });

    this.onMessage(MSG.chat, (client, raw: { text?: unknown; drunkLevel?: unknown }) => {
      const p = this.state.players.get(client.sessionId);
      const text = sanitizeChatText(raw?.text);
      if (!p || !text) return;
      const msg: NetChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        senderId: p.playerId,
        sender: p.name,
        text,
        drunkLevel: typeof raw.drunkLevel === 'number' ? Math.min(100, Math.max(0, raw.drunkLevel)) : p.alcohol,
        timestamp: Date.now(),
      };
      this.broadcast(MSG.chat, msg);
      // Persist in the background; realtime delivery never waits on MongoDB
      bestEffort(() =>
        dbService.addRoomChatMessage(mongoRoomId(this.roomCode), {
          id: msg.id,
          sender: msg.sender,
          text: msg.text,
          drunkLevel: msg.drunkLevel,
          timestamp: msg.timestamp,
        })
      );
    });

    this.onMessage(MSG.event, (client, raw) => {
      const p = this.state.players.get(client.sessionId);
      const event = sanitizeEvent(raw);
      if (!p || !event) return;
      const envelope: TableEventEnvelope = { from: client.sessionId, fromName: p.name, event, at: Date.now() };
      this.broadcast(MSG.event, envelope, { except: client });
    });

    // Owner-authoritative props: the newest toucher wins for 1.5s, then anyone may take over
    this.onMessage(MSG.props, (client, raw) => {
      const msg = sanitizeProps(raw);
      if (!msg || !msg.props.length) return;
      const now = Date.now();
      const accepted = msg.props.filter((prop) => {
        const lock = this.lastPropOwner.get(prop.id);
        if (lock && lock.owner !== client.sessionId && now - lock.at < 1500) return false;
        this.lastPropOwner.set(prop.id, { owner: client.sessionId, at: now });
        return true;
      });
      if (accepted.length) {
        this.broadcast(MSG.props, { owner: client.sessionId, props: accepted }, { except: client });
      }
    });

    // ---- WebRTC voice mesh signaling ----
    this.onMessage(MSG.rtcJoin, (client) => {
      const others = [...this.rtcPeers].filter((id) => id !== client.sessionId);
      if (!this.rtcPeers.has(client.sessionId)) {
        this.rtcPeers.add(client.sessionId);
        this.broadcast(MSG.rtcPeerJoined, client.sessionId, { except: client });
      }
      client.send(MSG.rtcPeers, others);
    });
    const relay = (type: string) => (client: Client, raw: SignalOut) => {
      if (!raw || typeof raw.targetId !== 'string') return;
      const target = this.clients.get(raw.targetId);
      target?.send(type, { peerId: client.sessionId, sdp: raw.sdp, candidate: raw.candidate });
    };
    this.onMessage(MSG.rtcOffer, relay(MSG.rtcOffer));
    this.onMessage(MSG.rtcAnswer, relay(MSG.rtcAnswer));
    this.onMessage(MSG.rtcIce, relay(MSG.rtcIce));
  }

  async onJoin(client: Client, options: Partial<TableJoinOptions>) {
    const p = new NetPlayerState();
    p.sessionId = client.sessionId;
    p.playerId = str(options.playerId, 64, client.sessionId);
    p.name = str(options.name, 32, 'Bợm Nhậu');
    p.avatar = str(options.avatar, 16, 'dog');
    p.clothing = str(options.clothing, 24, 'tanktop_white');
    p.hat = str(options.hat, 24, 'none');
    p.glassType = str(options.glassType, 24, 'beer_mug');
    p.joinedAt = Date.now();
    this.state.players.set(client.sessionId, p);

    bestEffort(() =>
      redis.set(
        `presence:${mongoRoomId(this.roomCode)}:${p.playerId}`,
        JSON.stringify({ playerId: p.playerId, playerName: p.name, lastSeen: Date.now(), realtime: true }),
        'EX',
        3600
      )
    );

    try {
      const room = await dbService.getRoom(mongoRoomId(this.roomCode));
      const history = ((room as { chatMessages?: NetChatMessage[] } | null)?.chatMessages ?? []).slice(-30);
      client.send(MSG.chatHistory, history);
    } catch {
      client.send(MSG.chatHistory, []);
    }
  }

  onLeave(client: Client) {
    const p = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    if (this.rtcPeers.delete(client.sessionId)) {
      this.broadcast(MSG.rtcPeerLeft, client.sessionId);
    }
    for (const [id, lock] of this.lastPropOwner) {
      if (lock.owner === client.sessionId) this.lastPropOwner.delete(id);
    }
    if (p) bestEffort(() => redis.del(`presence:${mongoRoomId(this.roomCode)}:${p.playerId}`));
  }
}
