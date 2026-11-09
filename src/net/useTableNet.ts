import { useEffect, useMemo, useRef, useState } from 'react';
import type { NetChatMessage, NetPlayer, TableEventEnvelope } from '../../shared/tableNet';
import type { Player } from '../game/types';
import { TableNetClient, takeTableClient, type NetConnectionState, type NetPose } from './tableClient';

const NET_ID_KEY = 'tram_nhau_net_player_id';

/** Stable per-browser id so a refresh rejoins as the same drinker. */
export function getNetPlayerId() {
  try {
    let id = localStorage.getItem(NET_ID_KEY);
    if (!id) {
      id = `bom_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(NET_ID_KEY, id);
    }
    return id;
  } catch {
    return `bom_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export interface RemoteChatBubble extends NetChatMessage {
  sessionId: string | null;
}

export interface TableNetHandle {
  client: TableNetClient | null;
  connection: NetConnectionState;
  /** Other humans at the table (this client excluded), oldest first. */
  remotePlayers: NetPlayer[];
  chatFeed: RemoteChatBubble[];
}

export const remotePlayerId = (sessionId: string) => `net_${sessionId}`;

/** NetPlayer → game Player, seated after the local table (user + NPC friends). */
export function toGamePlayer(p: NetPlayer, seatIndex: number): Player {
  return {
    id: remotePlayerId(p.sessionId),
    name: p.name,
    isUser: false,
    isRemote: true,
    avatar: p.avatar as Player['avatar'],
    clothing: p.clothing as Player['clothing'],
    hat: p.hat as Player['hat'],
    glassType: p.glassType as Player['glassType'],
    alcoholLevel: p.alcohol,
    stamina: 100,
    seatIndex,
    coins: 0,
    gems: 0,
    title: p.speaking ? '🎙️ Đang nói' : '🌐 Bạn nhậu online',
    isPassedOut: p.passedOut,
    faceDoodles: [],
    drinksCount: p.drinks,
  };
}

export function useTableNet(
  roomCode: string,
  profile: { name: string; avatar: string; clothing: string; hat: string; glassType: string },
  handlers: {
    onEvent?: (e: TableEventEnvelope) => void;
    onPlayerJoined?: (p: NetPlayer) => void;
    onPlayerLeft?: (p: NetPlayer) => void;
    /** 20 Hz remote poses by game player id — wire straight to the 3D scene (no re-render). */
    onPoses?: (poses: Record<string, NetPose>) => void;
  } = {}
): TableNetHandle {
  const [client, setClient] = useState<TableNetClient | null>(null);
  const [connection, setConnection] = useState<NetConnectionState>('idle');
  const [players, setPlayers] = useState<NetPlayer[]>([]);
  const [chatFeed, setChatFeed] = useState<RemoteChatBubble[]>([]);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    // Coming from the phòng chờ: keep that very connection (no leave/re-join at the table)
    const adopted = takeTableClient(roomCode);
    const net =
      adopted ??
      new TableNetClient({
        roomCode,
        playerId: getNetPlayerId(),
        ...profileRef.current,
      });
    setClient(net);
    // Join/leave toasts only after the first snapshot (so we don't announce who was already there)
    let known = new Map<string, NetPlayer>(net.players.map((p) => [p.sessionId, p]));
    const emitPoses = (poses: Record<string, NetPose>) => {
      const byGameId: Record<string, NetPose> = {};
      for (const id in poses) if (id !== net.sessionId) byGameId[remotePlayerId(id)] = poses[id];
      handlersRef.current.onPoses?.(byGameId);
    };
    if (adopted) {
      setConnection(net.state);
      setPlayers(net.players);
      setChatFeed(net.chatLog.map((m) => ({ ...m, sessionId: net.players.find((p) => p.playerId === m.senderId)?.sessionId ?? null })));
      emitPoses(net.poses);
    }
    const offs = [
      net.onPoses.on(emitPoses),
      net.onConnection.on(setConnection),
      net.onPlayers.on((list) => {
        setPlayers(list);
        const next = new Map(list.map((p) => [p.sessionId, p]));
        if (known.size > 0) {
          next.forEach((p, id) => {
            if (!known.has(id) && id !== net.sessionId) handlersRef.current.onPlayerJoined?.(p);
          });
          known.forEach((p, id) => {
            if (!next.has(id) && id !== net.sessionId) handlersRef.current.onPlayerLeft?.(p);
          });
        }
        known = next;
      }),
      net.onChatHistory.on((history) =>
        setChatFeed(history.slice(-12).map((m) => ({ ...m, sessionId: null })))
      ),
      net.onChat.on((m) => {
        const sender = net.players.find((p) => p.playerId === m.senderId);
        setChatFeed((prev) => [...prev, { ...m, sessionId: sender?.sessionId ?? null }].slice(-12));
      }),
      net.onEvent.on((e) => handlersRef.current.onEvent?.(e)),
    ];
    if (!adopted) void net.connect();
    return () => {
      offs.forEach((off) => off());
      net.dispose();
      setClient(null);
      setPlayers([]);
    };
  }, [roomCode]);

  const remotePlayers = useMemo(
    () => players.filter((p) => p.sessionId !== client?.sessionId),
    [players, client]
  );

  return { client, connection, remotePlayers, chatFeed };
}
