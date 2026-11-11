import { Client, type Room } from '@colyseus/sdk';
import {
  MSG,
  POSE_SEND_INTERVAL_MS,
  TABLE_ROOM_NAME,
  DEFAULT_TABLE_SETUP,
  normalizeRoomCode,
  sanitizeSetup,
  type NetChatMessage,
  type NetPlayer,
  type PoseMessage,
  type PropSyncEnvelope,
  type PropSnapshot,
  type SignalIn,
  type SignalOut,
  type StatusMessage,
  type TableEvent,
  type TableEventEnvelope,
  type TableInfo,
  type TableJoinOptions,
  type TableSetup,
} from '../../shared/tableNet';
import { normalizeChibiAppearance } from '../../shared/appearance';

/** 'waiting_host' = guest knocking on a table the host hasn't opened yet (keeps retrying). */
export type NetConnectionState = 'idle' | 'connecting' | 'waiting_host' | 'online' | 'offline';

/** Remote pose stream (20 Hz) — kept out of React state, fed straight to the 3D scene. */
export interface NetPose {
  x: number;
  z: number;
  angle: number;
  roaming: boolean;
  moving: boolean;
}

/** host = opens the table (joinOrCreate), guest = only sits at an existing table. */
export type TableJoinMode = 'host' | 'guest';

const MAX_CHAT_LOG = 12;

type Listener<A extends unknown[]> = (...args: A) => void;
class Emitter<A extends unknown[]> {
  private set = new Set<Listener<A>>();
  on(fn: Listener<A>) {
    this.set.add(fn);
    return () => {
      this.set.delete(fn);
    };
  }
  emit(...args: A) {
    this.set.forEach((fn) => fn(...args));
  }
}

/**
 * Thin wrapper around the Colyseus table room. Pose updates are throttled and only sent
 * when they change; status/voice are sent on change. Everything is fire-and-forget so the
 * single-player game keeps working when the realtime server is unreachable.
 */
export class TableNetClient {
  readonly onPlayers = new Emitter<[NetPlayer[]]>();
  readonly onChat = new Emitter<[NetChatMessage]>();
  readonly onChatHistory = new Emitter<[NetChatMessage[]]>();
  readonly onEvent = new Emitter<[TableEventEnvelope]>();
  readonly onProps = new Emitter<[PropSyncEnvelope]>();
  readonly onConnection = new Emitter<[NetConnectionState]>();
  /** Phase / host / venue changes. */
  readonly onInfo = new Emitter<[TableInfo]>();
  /** Every patch: remote poses by sessionId (not React state). */
  readonly onPoses = new Emitter<[Record<string, NetPose>]>();
  // WebRTC signaling
  readonly onRtcPeers = new Emitter<[string[]]>();
  readonly onRtcPeerJoined = new Emitter<[string]>();
  readonly onRtcPeerLeft = new Emitter<[string]>();
  readonly onRtcOffer = new Emitter<[SignalIn]>();
  readonly onRtcAnswer = new Emitter<[SignalIn]>();
  readonly onRtcIce = new Emitter<[SignalIn]>();

  state: NetConnectionState = 'idle';
  sessionId: string | null = null;
  /** Latest full list (incl. poses). onPlayers only fires on roster/status changes, NOT every pose patch. */
  players: NetPlayer[] = [];
  info: TableInfo = { phase: 'lobby', hostSessionId: '', setup: DEFAULT_TABLE_SETUP };
  poses: Record<string, NetPose> = {};
  /** Last chat lines (history + live), so a lobby → game handoff keeps the conversation. */
  chatLog: NetChatMessage[] = [];
  readonly roomCode: string;

  private room: Room<any, any> | null = null;
  private disposed = false;
  private retryTimer: number | null = null;
  private retryDelay = 2000;
  private lastPose: PoseMessage | null = null;
  private pendingPose: PoseMessage | null = null;
  private poseTimer: number | null = null;
  private lastStatus = '';
  private lastVoice = '';
  private rosterKey = '';
  private infoKey = '';
  private everJoined = false;

  constructor(
    private options: TableJoinOptions,
    private mode: TableJoinMode = 'host',
    private endpoint = defaultEndpoint()
  ) {
    this.roomCode = normalizeRoomCode(options.roomCode);
  }

  get isHost() {
    return !!this.sessionId && this.info.hostSessionId === this.sessionId;
  }

  async connect() {
    if (this.disposed || this.state === 'connecting' || this.state === 'online') return;
    // A guest waiting for the host stays in 'waiting_host' between knocks (no flicker)
    if (this.state !== 'waiting_host') this.setState('connecting');
    const guestKnock = this.mode === 'guest' && !this.everJoined;
    try {
      const client = new Client(this.endpoint);
      const opts = { ...this.options, roomCode: this.roomCode };
      // Guests never open a table themselves (else they'd become host of an empty one).
      // Once seated, a reconnect may re-open it: the night goes on even if the room died.
      const room = guestKnock
        ? await client.join<any>(TABLE_ROOM_NAME, opts)
        : await client.joinOrCreate<any>(TABLE_ROOM_NAME, opts);
      if (this.disposed) {
        room.leave(true);
        return;
      }
      this.room = room;
      this.sessionId = room.sessionId;
      this.everJoined = true;
      this.retryDelay = 2000;
      this.bindRoom(room);
      this.setState('online');
      // Re-send the latest local state after (re)connecting
      this.lastStatus = '';
      this.lastVoice = '';
      if (this.lastPose) this.sendRaw(MSG.pose, this.lastPose);
    } catch (err) {
      if (this.disposed) return;
      if (guestKnock) {
        // Table not open yet (host still picking the venue) — knock again shortly
        this.setState('waiting_host');
        this.scheduleRetry(2000);
        return;
      }
      console.warn('[net] table connect failed', err);
      this.setState('offline');
      this.scheduleRetry();
    }
  }

  /** Phòng chờ */
  setReady(ready: boolean) {
    return this.sendRaw(MSG.ready, { ready });
  }
  /** Host only: change the venue / speed / rules while still in the lobby. */
  sendSetup(setup: TableSetup) {
    return this.sendRaw(MSG.setup, setup);
  }
  /** Host only: everyone is ready → the night begins for the whole table. */
  startNight() {
    return this.sendRaw(MSG.start, {});
  }

  dispose() {
    this.disposed = true;
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
    if (this.poseTimer) window.clearTimeout(this.poseTimer);
    this.room?.leave(true).catch(() => null);
    this.room = null;
    this.setState('idle');
  }

  /** Remote humans only (excludes this client). */
  get remotePlayers() {
    return this.players.filter((p) => p.sessionId !== this.sessionId);
  }

  sendPose(pose: PoseMessage) {
    const last = this.lastPose;
    const changed =
      !last ||
      last.roaming !== pose.roaming ||
      last.moving !== pose.moving ||
      Math.abs(last.x - pose.x) > 0.01 ||
      Math.abs(last.z - pose.z) > 0.01 ||
      Math.abs(last.angle - pose.angle) > 0.02;
    if (!changed) return;
    this.pendingPose = pose;
    if (this.poseTimer) return;
    this.poseTimer = window.setTimeout(() => {
      this.poseTimer = null;
      if (!this.pendingPose) return;
      this.lastPose = this.pendingPose;
      this.pendingPose = null;
      this.sendRaw(MSG.pose, this.lastPose);
    }, POSE_SEND_INTERVAL_MS);
  }

  sendStatus(status: StatusMessage) {
    const key = `${Math.round(status.alcohol)}|${status.passedOut}|${status.drinks}`;
    if (key === this.lastStatus) return;
    if (this.sendRaw(MSG.status, status)) this.lastStatus = key;
  }

  sendVoiceLevel(speaking: boolean, level: number) {
    const key = `${speaking}|${Math.round(level * 10)}`;
    if (key === this.lastVoice) return;
    if (this.sendRaw(MSG.voice, { speaking, level })) this.lastVoice = key;
  }

  sendChat(text: string, drunkLevel: number) {
    return this.sendRaw(MSG.chat, { text, drunkLevel });
  }

  sendEvent(event: TableEvent) {
    return this.sendRaw(MSG.event, event);
  }

  sendProps(props: PropSnapshot[]) {
    if (props.length) this.sendRaw(MSG.props, { props });
  }

  rtcJoin() {
    this.sendRaw(MSG.rtcJoin, {});
  }
  rtcOffer(msg: SignalOut) {
    this.sendRaw(MSG.rtcOffer, msg);
  }
  rtcAnswer(msg: SignalOut) {
    this.sendRaw(MSG.rtcAnswer, msg);
  }
  rtcIce(msg: SignalOut) {
    this.sendRaw(MSG.rtcIce, msg);
  }

  private sendRaw(type: string, payload: unknown) {
    if (!this.room || this.state !== 'online') return false;
    try {
      (this.room as unknown as { send: (t: string, p: unknown) => void }).send(type, payload);
      return true;
    } catch {
      return false;
    }
  }

  private bindRoom(room: Room<any, any>) {
    room.onStateChange((state: any) => {
      const list: NetPlayer[] = [];
      state?.players?.forEach?.((p: any) => {
        list.push({
          sessionId: p.sessionId,
          playerId: p.playerId,
          name: p.name,
          avatar: p.avatar,
          clothing: p.clothing,
          hat: p.hat,
          glassType: p.glassType,
          appearance: normalizeChibiAppearance(safeJson(p.appearance)),
          alcohol: p.alcohol,
          passedOut: p.passedOut,
          drinks: p.drinks,
          x: p.x,
          z: p.z,
          angle: p.angle,
          roaming: p.roaming,
          moving: p.moving,
          speaking: p.speaking,
          voiceLevel: p.voiceLevel,
          joinedAt: p.joinedAt,
          ready: p.ready === true,
          debt: p.debt ?? '',
        });
      });
      list.sort((a, b) => a.joinedAt - b.joinedAt);
      this.players = list;

      // Poses change every patch (20 Hz): stream them without touching React
      const poses: Record<string, NetPose> = {};
      list.forEach((p) => {
        poses[p.sessionId] = { x: p.x, z: p.z, angle: p.angle, roaming: p.roaming, moving: p.moving };
      });
      this.poses = poses;
      this.onPoses.emit(poses);

      // Everything else only when it actually changed
      const rosterKey = list
        .map(
          (p) =>
            `${p.sessionId}|${p.name}|${p.avatar}|${p.clothing}|${p.hat}|${p.glassType}|${JSON.stringify(p.appearance)}|${p.alcohol}|${p.passedOut}|${p.drinks}|${p.speaking}|${Math.round(p.voiceLevel * 3)}|${p.ready}|${p.debt}`
        )
        .join(';');
      if (rosterKey !== this.rosterKey) {
        this.rosterKey = rosterKey;
        this.onPlayers.emit(list);
      }

      const info: TableInfo = {
        phase: state?.phase === 'playing' ? 'playing' : 'lobby',
        hostSessionId: state?.hostSessionId ?? '',
        setup:
          sanitizeSetup({ theme: state?.theme, drunkSpeed: state?.drunkSpeed, rules: safeJson(state?.rules) }) ??
          DEFAULT_TABLE_SETUP,
      };
      const infoKey = JSON.stringify(info);
      if (infoKey !== this.infoKey) {
        this.infoKey = infoKey;
        this.info = info;
        this.onInfo.emit(info);
      }
    });
    room.onMessage(MSG.chat, (m: NetChatMessage) => {
      this.chatLog = [...this.chatLog, m].slice(-MAX_CHAT_LOG);
      this.onChat.emit(m);
    });
    room.onMessage(MSG.chatHistory, (m: NetChatMessage[]) => {
      this.chatLog = (m ?? []).slice(-MAX_CHAT_LOG);
      this.onChatHistory.emit(m ?? []);
    });
    room.onMessage(MSG.event, (m: TableEventEnvelope) => this.onEvent.emit(m));
    room.onMessage(MSG.props, (m: PropSyncEnvelope) => this.onProps.emit(m));
    room.onMessage(MSG.rtcPeers, (ids: string[]) => this.onRtcPeers.emit(ids ?? []));
    room.onMessage(MSG.rtcPeerJoined, (id: string) => this.onRtcPeerJoined.emit(id));
    room.onMessage(MSG.rtcPeerLeft, (id: string) => this.onRtcPeerLeft.emit(id));
    room.onMessage(MSG.rtcOffer, (m: SignalIn) => this.onRtcOffer.emit(m));
    room.onMessage(MSG.rtcAnswer, (m: SignalIn) => this.onRtcAnswer.emit(m));
    room.onMessage(MSG.rtcIce, (m: SignalIn) => this.onRtcIce.emit(m));
    room.onLeave(() => {
      if (this.room !== room) return;
      this.room = null;
      this.players = [];
      this.rosterKey = '';
      this.onPlayers.emit([]);
      if (!this.disposed) {
        this.setState('offline');
        this.scheduleRetry();
      }
    });
  }

  private scheduleRetry(fixedDelay?: number) {
    if (this.disposed || this.retryTimer) return;
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, fixedDelay ?? this.retryDelay);
    if (fixedDelay === undefined) this.retryDelay = Math.min(30000, this.retryDelay * 2);
  }

  private setState(s: NetConnectionState) {
    this.state = s;
    this.onConnection.emit(s);
  }
}

function safeJson(raw: unknown) {
  try {
    return typeof raw === 'string' && raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Lobby → game handoff: the phòng chờ connection is passed to the in-game table as is,
 * so nobody leaves/re-joins the room (no "X rời bàn / X vào bàn" spam, no voice re-dial).
 */
let handoff: TableNetClient | null = null;
export function handOffTableClient(client: TableNetClient) {
  if (handoff && handoff !== client) handoff.dispose();
  handoff = client;
}
export function takeTableClient(roomCode: string): TableNetClient | null {
  const c = handoff;
  handoff = null;
  if (c && c.roomCode === normalizeRoomCode(roomCode) && c.state !== 'idle') return c;
  c?.dispose();
  return null;
}

function defaultEndpoint() {
  return typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin;
}
