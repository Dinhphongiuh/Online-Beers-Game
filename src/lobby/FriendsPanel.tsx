import React, { useState } from 'react';
import { Plus, Trash2, UserPlus, Users, Bot } from 'lucide-react';
import { sound } from '../game/audio';
import type { Player } from '../game/types';
import { AVATAR_ICON } from './lobbyData';
import { sfx } from './LobbyPanels';
import { presenceNote, type CustomNpc, type SocialSnapshot } from '../../shared/social';

export interface NpcEntry {
  player: Player;
  /** Present for player-made NPCs (deletable); built-in regulars have none. */
  custom?: CustomNpc;
  note: string;
  /** Default regulars who can't come tonight: drinking at another table / phone taken by the wife. */
  unavailable?: 'drinking' | 'offline';
}

interface FriendsPanelProps {
  social: SocialSnapshot | null;
  socialError: string | null;
  npcs: NpcEntry[];
  /** NPC ids already on a stool. */
  seatedNpcIds: string[];
  /** Friends I already sent a table invite to (this lobby). */
  invitedFriendIds: string[];
  roomCode: string;
  disabled?: boolean;
  onInviteNpc: (playerId: string) => void;
  onOpenNpcCreator: () => void;
  onDeleteNpc: (npc: CustomNpc) => void;
  onInviteFriend: (userId: string, username: string) => void;
  onSendFriendRequest: (username: string) => Promise<string>;
  onAcceptFriend: (userId: string) => void;
  onRemoveFriend: (userId: string) => void;
}

const DOT: Record<string, string> = {
  online: 'bg-emerald-400',
  drinking: 'bg-amber-400',
  offline: 'bg-zinc-600',
};

/**
 * "Danh Sách Bạn Bè" — tab 1: real friends (online / đang nhậu / bị vợ thu điện thoại),
 * friend requests and table invites; tab 2: NPC regulars + player-made NPCs (➕).
 */
export const FriendsPanel: React.FC<FriendsPanelProps> = ({
  social,
  socialError,
  npcs,
  seatedNpcIds,
  invitedFriendIds,
  roomCode,
  disabled,
  onInviteNpc,
  onOpenNpcCreator,
  onDeleteNpc,
  onInviteFriend,
  onSendFriendRequest,
  onAcceptFriend,
  onRemoveFriend,
}) => {
  const [tab, setTab] = useState<'friends' | 'npc'>('friends');
  const [addName, setAddName] = useState('');
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const friends = social?.friends ?? [];
  const onlineCount = friends.filter((f) => f.presence.state !== 'offline').length;
  const incoming = social?.incoming ?? [];
  const outgoing = social?.outgoing ?? [];

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = addName.trim();
    if (!name || sending) return;
    setSending(true);
    try {
      setAddMsg(await onSendFriendRequest(name));
      setAddName('');
    } catch (err) {
      setAddMsg(`⚠️ ${err instanceof Error ? err.message : 'Không gửi được'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div data-testid="friends-panel" className="w-full rounded-2xl bg-zinc-950/85 border border-zinc-700/80 backdrop-blur-md shadow-xl p-2.5">
      <div className="grid grid-cols-2 gap-1 mb-2">
        {[
          { id: 'friends' as const, icon: <Users className="w-3.5 h-3.5" />, label: 'Bạn Bè', badge: `${onlineCount}/${friends.length}` },
          { id: 'npc' as const, icon: <Bot className="w-3.5 h-3.5" />, label: 'NPC', badge: `${npcs.length}` },
        ].map((t) => (
          <button
            key={t.id}
            {...sfx}
            data-testid={`friends-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-black cursor-pointer ${
              tab === t.id ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {t.icon} {t.label}
            <span className={`text-[9px] ${tab === t.id ? 'text-zinc-800' : 'text-zinc-500'}`}>{t.badge}</span>
            {t.id === 'friends' && incoming.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center">
                {incoming.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'friends' ? (
        <div className="space-y-1.5">
          <form onSubmit={submitAdd} className="flex gap-1">
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Kết bạn bằng biệt danh…"
              data-testid="add-friend-input"
              className="flex-1 min-w-0 bg-zinc-900 text-white text-[11px] px-2 py-1 rounded-lg border border-zinc-800 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={sending || !addName.trim()}
              className="px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 cursor-pointer disabled:opacity-50"
              aria-label="Gửi lời mời kết bạn"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          </form>
          {addMsg && <div className="text-[10px] text-amber-200 px-0.5">{addMsg}</div>}

          {incoming.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-1.5 space-y-1">
              <div className="text-[10px] font-black text-amber-300">📨 Lời mời kết bạn</div>
              {incoming.map((u) => (
                <div key={u.userId} className="flex items-center gap-1.5">
                  <span className="text-base">{AVATAR_ICON[u.avatar as Player['avatar']] ?? '🍺'}</span>
                  <span className="flex-1 min-w-0 text-[11px] font-bold truncate">{u.username}</span>
                  <button
                    onClick={() => onAcceptFriend(u.userId)}
                    className="px-1.5 py-0.5 rounded bg-emerald-500 text-zinc-950 text-[10px] font-black cursor-pointer"
                  >
                    Đồng ý
                  </button>
                  <button
                    onClick={() => onRemoveFriend(u.userId)}
                    className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-black cursor-pointer"
                  >
                    Từ chối
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-0.5 max-h-56 overflow-y-auto">
            {socialError && !social && <div className="text-[10px] text-red-300 px-1">⚠️ {socialError}</div>}
            {social && friends.length === 0 && (
              <div className="text-[10px] text-zinc-500 px-1 py-2 text-center">
                Chưa có bạn nhậu nào — gõ biệt danh ở trên để kết bạn!
              </div>
            )}
            {friends.map((f) => {
              const invited = invitedFriendIds.includes(f.userId);
              const atMyTable = f.presence.state === 'drinking' && f.presence.roomCode === roomCode;
              return (
                <div key={f.userId} data-testid="friend-row" className="group flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/5">
                  <span className="relative text-lg leading-none">
                    {AVATAR_ICON[f.avatar as Player['avatar']] ?? '🍺'}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-950 ${DOT[f.presence.state]}`} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px] font-bold text-zinc-100 truncate">{f.username}</span>
                    <span className="block text-[9px] text-zinc-500 truncate">{presenceNote(f.presence)}</span>
                  </span>
                  <button
                    onClick={() => onRemoveFriend(f.userId)}
                    title="Hủy kết bạn"
                    className="hidden group-hover:block text-zinc-600 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  {atMyTable ? (
                    <span className="text-[10px] font-black text-emerald-300">Ở bàn</span>
                  ) : (
                    <button
                      {...sfx}
                      disabled={disabled || invited || f.presence.state === 'offline'}
                      onClick={() => onInviteFriend(f.userId, f.username)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-black cursor-pointer bg-amber-500 hover:bg-amber-400 text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-default"
                    >
                      {invited ? 'Đã rủ ⏳' : f.presence.state === 'offline' ? '📵' : 'Rủ'}
                    </button>
                  )}
                </div>
              );
            })}
            {outgoing.map((u) => (
              <div key={u.userId} className="flex items-center gap-2 px-1.5 py-1 opacity-70">
                <span className="text-lg leading-none">{AVATAR_ICON[u.avatar as Player['avatar']] ?? '🍺'}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-bold text-zinc-300 truncate">{u.username}</span>
                  <span className="block text-[9px] text-zinc-500">Đang chờ đồng ý kết bạn…</span>
                </span>
                <button
                  onClick={() => onRemoveFriend(u.userId)}
                  className="text-[10px] text-zinc-500 hover:text-red-300 cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-0.5 max-h-64 overflow-y-auto">
          <button
            {...sfx}
            data-testid="npc-create-btn"
            onClick={() => {
              sound.playBottleOpen();
              onOpenNpcCreator();
            }}
            className="w-full flex items-center justify-center gap-1 rounded-lg border-2 border-dashed border-amber-400/70 py-1.5 text-[11px] font-black text-amber-300 hover:bg-amber-400 hover:text-zinc-950 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Tạo NPC bạn nhậu
          </button>
          {npcs.map(({ player, custom, note, unavailable }) => {
            const seated = seatedNpcIds.includes(player.id);
            return (
              <div key={player.id} data-testid="npc-row" className="group flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/5">
                <span className="relative text-lg leading-none">
                  {AVATAR_ICON[player.avatar]}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-950 ${
                      unavailable ? DOT[unavailable] : 'bg-sky-400'
                    }`}
                  />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-bold text-zinc-100 truncate">
                    {player.name} {custom && <span className="text-[9px] text-sky-300">• tự tạo</span>}
                  </span>
                  <span className="block text-[9px] text-zinc-500 truncate">{note}</span>
                </span>
                {custom && (
                  <button
                    onClick={() => onDeleteNpc(custom)}
                    title="Xóa NPC"
                    className="hidden group-hover:block text-zinc-600 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                <button
                  {...sfx}
                  disabled={disabled || seated || !!unavailable}
                  onClick={() => onInviteNpc(player.id)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-black cursor-pointer bg-amber-500 hover:bg-amber-400 text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-default"
                >
                  {seated ? 'Ở bàn' : unavailable === 'drinking' ? 'Đang nhậu' : unavailable === 'offline' ? '📵' : 'Rủ'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
