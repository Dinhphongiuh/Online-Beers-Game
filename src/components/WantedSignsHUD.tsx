import React, { useEffect, useRef, useState } from 'react';
import type { PlayerHeadAnchor, SceneController } from '../game/threeScene';

export interface WantedSign {
  /** Scene player id (bot id or `net_<sessionId>`). */
  playerId: string;
  text: string;
  /** Who pinned the grudge ('' when it's somebody else's book). */
  creditor: string;
}

/**
 * Sổ Nợ Gia Truyền: a "TRUY NÃ" poster floating over every bill dodger who still owes
 * a round to someone at this table.
 */
export const WantedSignsHUD: React.FC<{
  sceneRef: React.RefObject<SceneController | null>;
  signs: WantedSign[];
}> = ({ sceneRef, signs }) => {
  const [anchors, setAnchors] = useState<Record<string, PlayerHeadAnchor>>({});
  const idsRef = useRef<string[]>([]);
  idsRef.current = signs.map((s) => s.playerId);
  const active = signs.length > 0;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 40) return;
      last = t;
      const ids = new Set(idsRef.current);
      const next: Record<string, PlayerHeadAnchor> = {};
      (sceneRef.current?.getPlayerHeadAnchors() ?? []).forEach((a) => {
        if (ids.has(a.playerId)) next[a.playerId] = a;
      });
      setAnchors(next);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, sceneRef]);

  if (!active) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-[16]">
      {signs.map((s) => {
        const a = anchors[s.playerId];
        if (!a || !a.onScreen) return null;
        return (
          <div
            key={s.playerId}
            data-testid="wanted-sign"
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: a.x, top: a.y - 46 }}
          >
            <div className="wanted-sway rounded-sm border-2 border-amber-900 bg-[#f3e2b3] px-2 py-1 text-center shadow-lg">
              <div className="font-neon text-[13px] leading-none text-red-700 tracking-widest">TRUY NÃ</div>
              <div className="text-[9px] font-black text-amber-950 whitespace-nowrap">{s.text}</div>
              {s.creditor && (
                <div className="text-[8px] font-bold text-amber-900/70">Chủ nợ: {s.creditor} • Ly đầu x1.5</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
