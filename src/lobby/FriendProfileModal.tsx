import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { CharacterAvatar } from '../game/types';
import { PassportCard } from './PassportCard';
import { socialApi } from '../net/socialApi';
import { useSocialEvents } from '../net/socialSocket';
import { presenceNote, type FriendProfile } from '../../shared/social';

const DOT: Record<string, string> = {
  online: 'bg-emerald-400',
  drinking: 'bg-amber-400',
  offline: 'bg-zinc-500',
};

/** Tap a friend in the list → their Hộ Chiếu Tửu Lượng (+ invite / unfriend). */
export const FriendProfileModal: React.FC<{
  userId: string;
  roomCode: string;
  invited: boolean;
  onInvite: (userId: string, username: string) => void;
  /** Parent shows the unfriend confirm. */
  onUnfriend: (friend: { userId: string; username: string; avatar: string }) => void;
  onClose: () => void;
}> = ({ userId, roomCode, invited, onInvite, onUnfriend, onClose }) => {
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    socialApi
      .friendProfile(userId)
      .then((p) => alive && setProfile(p))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Không tải được hộ chiếu'));
    return () => {
      alive = false;
    };
  }, [userId]);

  // Live presence while the passport is open
  useSocialEvents((e) => {
    if (e.type === 'presence' && e.userId === userId) setProfile((p) => (p ? { ...p, presence: e.presence } : p));
    if (e.type === 'friend_removed' && e.userId === userId) onClose();
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const atMyTable = profile?.presence.state === 'drinking' && profile.presence.roomCode === roomCode;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-[2px]"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        data-testid="friend-profile"
        className="relative w-[min(480px,95vw)] max-h-[92vh] overflow-y-auto rounded-2xl bg-gradient-to-b from-emerald-900 to-emerald-950 border-4 border-amber-500/80 shadow-2xl text-white"
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/40 hover:bg-black/60 cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="px-5 pt-4 pb-2 text-center">
          <div className="text-[10px] tracking-[0.35em] text-amber-300/80">HỒ SƠ BẠN NHẬU</div>
          <h2 className="font-neon text-xl text-amber-300">🪪 Hộ Chiếu Của {profile?.username ?? '…'}</h2>
          {profile && (
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-0.5 text-[11px] font-bold">
              <span className={`w-2 h-2 rounded-full ${DOT[profile.presence.state]}`} />
              {presenceNote(profile.presence)}
            </div>
          )}
        </div>

        <div className="p-4 pt-1 space-y-3">
          {error && <div className="rounded-lg bg-red-950/70 border border-red-500 p-3 text-sm text-red-200">⚠️ {error}</div>}
          {!profile && !error && <div className="py-10 text-center text-sm text-amber-200">⏳ Đang mở hộ chiếu…</div>}

          {profile && (
            <>
              <PassportCard
                name={profile.username}
                avatar={(profile.avatar as CharacterAvatar) || 'dog'}
                coins={profile.coins}
                toastCount={profile.drinksCount}
                escaped={profile.nightsEscaped}
                nights={profile.nights}
                pinnedPhoto={profile.pinnedPhoto}
                account={{
                  userId: profile.userId,
                  username: profile.username,
                  isGuest: profile.isGuest,
                  createdAt: profile.createdAt,
                  drunkArchetype: profile.drunkArchetype,
                }}
              />

              <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                <div className="rounded-lg bg-black/30 px-1 py-1.5">
                  <div className="text-white/50 text-[9px] uppercase font-bold">Kỷ lục buổi</div>
                  <div className="font-black text-amber-300">{profile.bestNightScore} điểm</div>
                </div>
                <div className="rounded-lg bg-black/30 px-1 py-1.5">
                  <div className="text-white/50 text-[9px] uppercase font-bold">Cồn cao nhất</div>
                  <div className="font-black text-amber-300">{profile.peakAlcohol}%</div>
                </div>
                <div className="rounded-lg bg-black/30 px-1 py-1.5">
                  <div className="text-white/50 text-[9px] uppercase font-bold">Số buổi nhậu</div>
                  <div className="font-black text-amber-300">{profile.nights}</div>
                </div>
              </div>
              {profile.favoriteQuote && (
                <div className="rounded-lg bg-black/30 px-3 py-2 text-[12px]">
                  🗣️ Câu gáy ruột: <b className="text-amber-200">"{profile.favoriteQuote}"</b>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {atMyTable ? (
                  <div className="rounded-xl bg-emerald-700/60 py-2.5 text-center text-sm font-black">🍻 Đang ở bàn bạn</div>
                ) : (
                  <button
                    data-testid="friend-profile-invite"
                    disabled={invited || profile.presence.state === 'offline'}
                    onClick={() => onInvite(profile.userId, profile.username)}
                    className="rounded-xl bg-amber-500 hover:bg-amber-400 py-2.5 text-sm font-black text-zinc-950 cursor-pointer disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-default"
                  >
                    {invited ? 'Đã rủ ⏳' : profile.presence.state === 'offline' ? '📵 Đang bị thu ĐT' : `🍻 Rủ vào bàn #${roomCode}`}
                  </button>
                )}
                <button
                  data-testid="friend-profile-unfriend"
                  onClick={() => onUnfriend({ userId: profile.userId, username: profile.username, avatar: profile.avatar })}
                  className="rounded-xl py-2.5 text-sm font-black cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  💔 Hủy kết bạn
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
