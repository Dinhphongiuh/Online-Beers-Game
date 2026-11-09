import React, { useEffect, useRef, useState } from 'react';
import type { NetPlayer } from '../../shared/tableNet';
import type { PlayerHeadAnchor, SceneController } from '../game/threeScene';
import type { NetConnectionState } from '../net/tableClient';
import { remotePlayerId, type RemoteChatBubble } from '../net/useTableNet';

interface TableNetHUDProps {
  sceneRef: React.RefObject<SceneController | null>;
  connection: NetConnectionState;
  roomCode: string;
  remotePlayers: NetPlayer[];
  chatFeed: RemoteChatBubble[];
  /** Extra controls (voice chat) rendered inside the panel. */
  children?: React.ReactNode;
}

const BUBBLE_MS = 6000;

const CONNECTION_LABEL: Record<NetConnectionState, { text: string; dot: string }> = {
  idle: { text: 'Chưa kết nối', dot: 'bg-zinc-500' },
  connecting: { text: 'Đang kết nối bàn…', dot: 'bg-amber-400 animate-pulse' },
  waiting_host: { text: 'Chờ chủ bàn mở bàn…', dot: 'bg-amber-400 animate-pulse' },
  online: { text: 'Online', dot: 'bg-emerald-400' },
  offline: { text: 'Mất mạng — đang thử lại', dot: 'bg-red-500 animate-pulse' },
};

/**
 * Realtime table overlay: who is online, their Độ Cồn / mic, and chat bubbles pinned
 * above the remote players' 3D heads (projected every frame from the scene).
 */
export const TableNetHUD: React.FC<TableNetHUDProps> = ({
  sceneRef,
  connection,
  roomCode,
  remotePlayers,
  chatFeed,
  children,
}) => {
  const [anchors, setAnchors] = useState<Record<string, PlayerHeadAnchor>>({});
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);
  const hasRemote = remotePlayers.length > 0;
  const remoteIdsRef = useRef<string[]>([]);
  remoteIdsRef.current = remotePlayers.map((p) => remotePlayerId(p.sessionId));

  // Track head anchors only while someone else is at the table
  useEffect(() => {
    if (!hasRemote) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 33) return; // ~30 Hz is plenty for HTML labels
      last = t;
      const list = sceneRef.current?.getPlayerHeadAnchors() ?? [];
      const ids = new Set(remoteIdsRef.current);
      const next: Record<string, PlayerHeadAnchor> = {};
      list.forEach((a) => {
        if (ids.has(a.playerId)) next[a.playerId] = a;
      });
      setAnchors(next);
      setNow(Date.now());
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hasRemote, sceneRef]);

  const latestBubble = (p: NetPlayer) => {
    for (let i = chatFeed.length - 1; i >= 0; i--) {
      const m = chatFeed[i];
      if ((m.sessionId === p.sessionId || m.senderId === p.playerId) && now - m.timestamp < BUBBLE_MS) return m;
    }
    return null;
  };

  const conn = CONNECTION_LABEL[connection];

  return (
    <>
      {/* Overhead name tags + chat bubbles for remote humans */}
      <div className="fixed inset-0 pointer-events-none z-[15]">
        {remotePlayers.map((p) => {
          const a = anchors[remotePlayerId(p.sessionId)];
          if (!a || !a.onScreen) return null;
          const bubble = latestBubble(p);
          const wobble = p.alcohol >= 60 ? `rotate(${Math.sin(now / 300 + p.joinedAt) * 4}deg)` : '';
          return (
            <div
              key={p.sessionId}
              className="absolute flex flex-col items-center gap-1"
              style={{ left: a.x, top: a.y, transform: `translate(-50%, -100%) ${wobble}` }}
            >
              {bubble && (
                <div
                  className={`max-w-[220px] rounded-2xl px-3 py-1.5 text-xs font-bold shadow-xl border-2 ${
                    bubble.drunkLevel >= 60
                      ? 'bg-amber-100 text-amber-950 border-amber-500'
                      : 'bg-white text-zinc-900 border-zinc-300'
                  }`}
                >
                  {bubble.text}
                </div>
              )}
              <div className="flex items-center gap-1 rounded-full bg-zinc-950/80 border border-cyan-400/60 px-2 py-0.5 text-[10px] font-black text-cyan-200 whitespace-nowrap">
                {p.speaking && (
                  <span
                    className="inline-block w-2 h-2 rounded-full bg-emerald-400"
                    style={{ boxShadow: `0 0 ${4 + p.voiceLevel * 14}px #34d399` }}
                  />
                )}
                🌐 {p.name} · {p.alcohol}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Connection & roster panel */}
      <div className="fixed right-3 bottom-28 z-30 pointer-events-auto w-56 select-none">
        <div className="rounded-xl bg-zinc-950/85 border border-zinc-700 shadow-2xl text-zinc-100 overflow-hidden">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide hover:bg-zinc-800/80"
          >
            <span className={`w-2 h-2 rounded-full ${conn.dot}`} />
            <span className="flex-1 text-left">
              Bàn #{roomCode} · {conn.text}
            </span>
            <span className="text-zinc-400">{remotePlayers.length + (connection === 'online' ? 1 : 0)}👤</span>
          </button>
          {!collapsed && (
            <div className="px-3 pb-2 space-y-1.5">
              {remotePlayers.length === 0 ? (
                <div className="text-[10px] text-zinc-400 leading-snug">
                  Chưa có bạn nhậu online. Gửi mã PIN <b className="text-amber-300">{roomCode}</b> để rủ vào bàn!
                </div>
              ) : (
                remotePlayers.map((p) => (
                  <div key={p.sessionId} className="flex items-center gap-2 text-[11px]">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${p.speaking ? 'bg-emerald-400' : 'bg-zinc-600'}`}
                    />
                    <span className="flex-1 truncate font-bold">{p.name}</span>
                    <span className={p.alcohol >= 60 ? 'text-red-400 font-black' : 'text-amber-300'}>
                      {p.passedOut ? '💤' : `${p.alcohol}%`}
                    </span>
                  </div>
                ))
              )}
              {children}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
