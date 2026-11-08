import { Client, type Room } from '@colyseus/sdk';
import {
  MSG,
  POSE_SEND_INTERVAL_MS,
  TABLE_ROOM_NAME,
  normalizeRoomCode,
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
  type TableJoinOptions,
} from '../../shared/tableNet';

export type NetConnectionState = 'idle' | 'connecting' | 'online' | 'offline';

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
  // WebRTC signaling
  readonly onRtcPeers = new Emitter<[string[]]>();
  readonly onRtcPeerJoined = new Emitter<[string]>();
  readonly onRtcPeerLeft = new Emitter<[string]>();
  readonly onRtcOffer = new Emitter<[SignalIn]>();
  readonly onRtcAnswer = new Emitter<[SignalIn]>();
  readonly onRtcIce = new Emitter<[SignalIn]>();

  state: NetConnectionState = 'idle';
  sessionId: string | null = null;
  players: NetPlayer[] = [];

  private room: Room<any, any> | null = null;
  private disposed = false;
  private retryTimer: number | null = null;
  private retryDelay = 2000;
  private lastPose: PoseMessage | null = null;
  private pendingPose: PoseMessage | null = null;
  private poseTimer: number | null = null;
  private lastStatus = '';
  private lastVoice = '';

  constructor(private options: TableJoinOptions, private endpoint = defaultEndpoint()) {}

  async connect() {
    if (this.disposed || this.state === 'connecting' || this.state === 'online') return;
    this.setState('connecting');
    try {
      const client = new Client(this.endpoint);
      const room = await client.joinOrCreate<any>(TABLE_ROOM_NAME, {
        ...this.options,
        roomCode: normalizeRoomCode(this.options.roomCode),
      });
      if (this.disposed) {
        room.leave(true);
        return;
      }
      this.room = room;
      this.sessionId = room.sessionId;
      this.retryDelay = 2000;
      this.bindRoom(room);
      this.setState('online');
      // Re-send the latest local state after (re)connecting
      this.lastStatus = '';
      this.lastVoice = '';
      if (this.lastPose) this.sendRaw(MSG.pose, this.lastPose);
    } catch (err) {
      console.warn('[net] table connect failed', err);
      this.setState('offline');
      this.scheduleRetry();
    }
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
          debt: p.debt ?? '',
        });
      });
      list.sort((a, b) => a.joinedAt - b.joinedAt);
      this.players = list;
      this.onPlayers.emit(list);
    });
    room.onMessage(MSG.chat, (m: NetChatMessage) => this.onChat.emit(m));
    room.onMessage(MSG.chatHistory, (m: NetChatMessage[]) => this.onChatHistory.emit(m ?? []));
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
      this.onPlayers.emit([]);
      if (!this.disposed) {
        this.setState('offline');
        this.scheduleRetry();
      }
    });
  }

  private scheduleRetry() {
    if (this.disposed || this.retryTimer) return;
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, this.retryDelay);
    this.retryDelay = Math.min(30000, this.retryDelay * 2);
  }

  private setState(s: NetConnectionState) {
    this.state = s;
    this.onConnection.emit(s);
  }
}

function defaultEndpoint() {
  return typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin;
}
