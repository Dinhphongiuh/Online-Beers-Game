import React from 'react';
import { sound } from '../game/audio';
import type { Player } from '../game/types';
import type { NetConnectionState } from '../net/tableClient';
import { allPlayersReady, type NetPlayer, type TableInfo } from '../../shared/tableNet';
import { AVATAR_ICON, DRUNK_SPEEDS, LOBBY_MAPS, RULE_LABELS } from './lobbyData';
import { sfx } from './LobbyPanels';

const RULE_SHORT: Record<keyof TableInfo['setup']['rules'], string> = {
  micDzo: 'Hô "Dzô" mới được uống',
  randomEvents: 'Vợ gọi & công an phường',
  billBrawl: 'Ném ghế giành bill',
};

export interface WaitingFriend {
  userId: string;
  username: string;
  avatar: string;
  invited: boolean;
}

/**
 * Bước 2/2 — Phòng chờ: everyone at the same table code sees the venue the host picked,
 * presses "Sẵn sàng", and the host pours the first round once the whole table is ready.
 */
export const TableWaitingRoom: React.FC<{
  roomCode: string;
  connection: NetConnectionState;
  mySessionId: string | null;
  info: TableInfo | null;
  players: NetPlayer[];
  /** Host's own NPCs (only the host brings them). */
  npcs: Player[];
  /** Online friends who aren't at this table yet. */
  friends: WaitingFriend[];
  onToggleReady: () => void;
  onStart: () => void;
  onChangeVenue: () => void;
  onInviteFriend: (userId: string, username: string) => void;
  onLeave: () => void;
}> = ({
  roomCode,
  connection,
  mySessionId,
  info,
  players,
  npcs,
  friends,
  onToggleReady,
  onStart,
  onChangeVenue,
  onInviteFriend,
  onLeave,
}) => {
  const online = connection === 'online' && !!info;
  const isHost = online && !!mySessionId && info!.hostSessionId === mySessionId;
  const me = players.find((p) => p.sessionId === mySessionId);
  const host = players.find((p) => p.sessionId === info?.hostSessionId);
  const readyCount = players.filter((p) => p.ready || p.sessionId === info?.hostSessionId).length;
  const everyoneReady = online && allPlayersReady(players, info!.hostSessionId);
  const venue = info ? LOBBY_MAPS.find((m) => m.id === info.setup.theme) : null;
  const speed = info ? DRUNK_SPEEDS.find((s) => s.id === info.setup.drunkSpeed) : null;
  const activeRules = info ? RULE_LABELS.filter((r) => info.setup.rules[r.id]) : [];

  const copyCode = () => {
    void navigator.clipboard?.writeText(roomCode).catch(() => null);
    sound.playBottleOpen();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/55 backdrop-blur-[2px]">
      <div
        data-testid="table-waiting-room"
        className="chalkboard chalk-text relative w-[min(520px,96vw)] max-h-[92vh] overflow-y-auto rounded-2xl p-5 text-white"
      >
        {/* Steps */}
        <div className="flex items-center justify-center gap-2 text-[10px] font-black tracking-widest mb-1">
          <span className="text-emerald-300">① CHỌN QUÁN ✓</span>
          <span className="text-white/30">──</span>
          <span className="text-amber-300">② CHỜ ANH EM</span>
        </div>
        <div className="text-center">
          <h2 className="font-neon text-2xl text-amber-300">🪑 Phòng Chờ</h2>
          <button
            {...sfx}
            onClick={copyCode}
            title="Bấm để copy mã bàn"
            className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-400/90 px-2 py-0.5 font-mono text-sm font-black text-red-900 cursor-pointer hover:bg-amber-300"
          >
            Bàn #{roomCode} 📋
          </button>
        </div>

        {!online ? (
          <div className="my-6 text-center space-y-2">
            <div className="text-4xl animate-bounce">{connection === 'waiting_host' ? '🚪' : '🛵'}</div>
            <div className="text-sm font-bold text-amber-100">
              {connection === 'waiting_host'
                ? `Đang gõ cửa bàn #${roomCode}… chủ bàn còn đang chọn quán, đợi xíu nha!`
                : connection === 'offline'
                ? 'Mất mạng giữa đường — đang chạy lại…'
                : 'Đang chạy xe tới quán…'}
            </div>
          </div>
        ) : (
          <>
            {/* Venue picked by the host */}
            <div className="mt-4 rounded-xl border border-white/15 bg-black/25 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/50">Quán chủ bàn đã chọn</div>
                  <div className="text-base font-black text-amber-100 truncate">
                    {venue?.icon} {venue?.name}
                  </div>
                  <div className="text-[12px] text-white/70">
                    {speed?.icon} {speed?.name}
                  </div>
                </div>
                {isHost && (
                  <button
                    {...sfx}
                    data-testid="waiting-change-venue"
                    onClick={onChangeVenue}
                    className="shrink-0 rounded-lg border border-amber-300/60 px-2 py-1 text-[11px] font-black text-amber-200 hover:bg-amber-300 hover:text-red-900 cursor-pointer"
                  >
                    🔁 Đổi quán
                  </button>
                )}
              </div>
              {activeRules.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {activeRules.map((r) => (
                    <span key={r.id} title={r.label} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold">
                      {r.icon} {RULE_SHORT[r.id]}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Who's at the table */}
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px] font-black">
                <span>👥 Anh em trong bàn</span>
                <span className={everyoneReady ? 'text-emerald-300' : 'text-amber-300'}>
                  {readyCount}/{players.length} sẵn sàng
                </span>
              </div>
              <div className="space-y-1">
                {players.map((p) => {
                  const isTableHost = p.sessionId === info!.hostSessionId;
                  const isMe = p.sessionId === mySessionId;
                  const ok = p.ready || isTableHost;
                  return (
                    <div
                      key={p.sessionId}
                      data-testid="waiting-player"
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${isMe ? 'bg-amber-400/15 border border-amber-300/40' : 'bg-black/25'}`}
                    >
                      <span className="text-xl leading-none">{AVATAR_ICON[p.avatar as Player['avatar']] ?? '🍺'}</span>
                      <span className="flex-1 min-w-0 truncate text-[13px] font-bold">
                        {isTableHost && '👑 '}
                        {p.name}
                        {isMe && <span className="text-amber-300"> (Bạn)</span>}
                      </span>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-black ${
                          ok ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-amber-300'
                        }`}
                      >
                        {isTableHost ? '👑 Chủ bàn' : ok ? '✅ Lên mồi!' : '⏳ Đang cột dây giày…'}
                      </span>
                    </div>
                  );
                })}
                {isHost &&
                  npcs.map((n) => (
                    <div key={n.id} className="flex items-center gap-2 rounded-lg bg-black/15 px-2 py-1 opacity-80">
                      <span className="text-lg leading-none">{AVATAR_ICON[n.avatar]}</span>
                      <span className="flex-1 min-w-0 truncate text-[12px] font-bold">{n.name}</span>
                      <span className="shrink-0 text-[10px] font-black text-sky-300">🤖 NPC • lúc nào cũng sẵn</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Rủ thêm */}
            {friends.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-black">📲 Rủ thêm bạn đang online</div>
                <div className="flex flex-wrap gap-1">
                  {friends.map((f) => (
                    <button
                      key={f.userId}
                      {...sfx}
                      disabled={f.invited}
                      onClick={() => onInviteFriend(f.userId, f.username)}
                      className="flex items-center gap-1 rounded-full bg-black/30 px-2 py-1 text-[11px] font-bold hover:bg-amber-400 hover:text-red-900 cursor-pointer disabled:opacity-50 disabled:cursor-default disabled:hover:bg-black/30 disabled:hover:text-white"
                    >
                      {AVATAR_ICON[f.avatar as Player['avatar']] ?? '🍺'} {f.username} {f.invited ? '⏳' : '+'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="mt-5 space-y-2">
          {online && isHost && (
            <>
              <button
                {...sfx}
                data-testid="waiting-start"
                disabled={!everyoneReady}
                onClick={onStart}
                className="w-full py-3 rounded-xl font-neon text-lg shadow-lg cursor-pointer active:scale-[0.98] transition bg-gradient-to-b from-red-500 to-red-700 text-amber-100 border-2 border-amber-300 disabled:from-zinc-700 disabled:to-zinc-800 disabled:border-zinc-600 disabled:text-zinc-400 disabled:cursor-default"
              >
                🍻 DZÔ! Bắt đầu nhậu
              </button>
              <div className="text-center text-[11px] font-bold text-amber-100/80">
                {players.length === 1
                  ? 'Chưa ai tới — nhậu một mình cũng được, hoặc rủ thêm anh em!'
                  : everyoneReady
                  ? 'Đủ mặt anh tài rồi, khui bia thôi! 🍺'
                  : `Chờ ${players.length - readyCount} người nữa lên mồi…`}
              </div>
            </>
          )}
          {online && !isHost && me && (
            <>
              <button
                {...sfx}
                data-testid="waiting-ready"
                onClick={onToggleReady}
                className={`w-full py-3 rounded-xl text-base font-black shadow-lg cursor-pointer active:scale-[0.98] transition ${
                  me.ready ? 'bg-emerald-500 text-zinc-950' : 'bg-amber-400 text-red-900 hover:bg-amber-300 animate-pulse'
                }`}
              >
                {me.ready ? '✅ Đã lên mồi! (bấm để hủy)' : '🍺 SẴN SÀNG / LÊN MỒI!'}
              </button>
              <div className="text-center text-[11px] font-bold text-amber-100/80">
                {everyoneReady
                  ? `Chờ ${host?.name ?? 'chủ bàn'} hô "Dzô"…`
                  : 'Cả bàn sẵn sàng thì chủ bàn mới khui bia được.'}
              </div>
            </>
          )}
          <button
            {...sfx}
            data-testid="waiting-leave"
            onClick={onLeave}
            className="w-full py-2 rounded-xl bg-black/30 hover:bg-black/50 text-[12px] font-black text-white/70 cursor-pointer"
          >
            🚪 Rời bàn
          </button>
        </div>
      </div>
    </div>
  );
};
