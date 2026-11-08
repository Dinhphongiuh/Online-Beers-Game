/**
 * Client side of the friends list: REST helpers + hooks for the social snapshot (polled),
 * presence heartbeats and the player's custom NPCs.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PRESENCE_HEARTBEAT_MS,
  type CustomNpc,
  type SocialSnapshot,
} from '../../shared/social';

const TOKEN_KEY = 'tram_nhau_auth_token';
const SOCIAL_POLL_MS = 6000;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  // An outdated server answers unknown /api routes with the SPA's index.html (200, not JSON)
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok || data === null) {
    const message = (data as { error?: string } | null)?.error
      || (!isJson ? 'Máy chủ chưa cập nhật tính năng này — khởi động lại server (yarn dev)' : 'Máy chủ đang say, thử lại sau');
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const socialApi = {
  snapshot: () => api<SocialSnapshot>('/api/social'),
  heartbeat: (state: 'online' | 'drinking', roomCode?: string) =>
    api('/api/social/presence', { method: 'POST', body: { state, roomCode } }),
  requestFriend: (username: string) =>
    api<{ message: string; result: string }>('/api/social/friends/request', { method: 'POST', body: { username } }),
  accept: (userId: string) => api(`/api/social/friends/${encodeURIComponent(userId)}/accept`, { method: 'POST', body: {} }),
  remove: (userId: string) => api(`/api/social/friends/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  inviteToTable: (userId: string, roomCode: string) =>
    api(`/api/social/friends/${encodeURIComponent(userId)}/invite`, { method: 'POST', body: { roomCode } }),
  dismissInvite: (id: string) => api(`/api/social/invites/${encodeURIComponent(id)}/dismiss`, { method: 'POST', body: {} }),
  listNpcs: () => api<{ npcs: CustomNpc[] }>('/api/npcs'),
  createNpc: (npc: Omit<CustomNpc, 'npcId'>) => api<{ npc: CustomNpc }>('/api/npcs', { method: 'POST', body: npc }),
  deleteNpc: (npcId: string) => api(`/api/npcs/${encodeURIComponent(npcId)}`, { method: 'DELETE' }),
};

/** Friends, requests and table invites — refreshed every few seconds while mounted. */
export function useSocial(enabled = true) {
  const [snapshot, setSnapshot] = useState<SocialSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const raw = await socialApi.snapshot();
      const s: SocialSnapshot = {
        friends: Array.isArray(raw?.friends) ? raw.friends : [],
        incoming: Array.isArray(raw?.incoming) ? raw.incoming : [],
        outgoing: Array.isArray(raw?.outgoing) ? raw.outgoing : [],
        invites: Array.isArray(raw?.invites) ? raw.invites : [],
      };
      if (alive.current) {
        setSnapshot(s);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Lỗi tải bạn bè');
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    if (!enabled) return;
    void refresh();
    const id = window.setInterval(refresh, SOCIAL_POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [enabled, refresh]);

  return { snapshot, error, refresh };
}

/** "Đang ở quán" in the menu, "đang nhậu bàn #x" in a match; silence = offline after the TTL. */
export function usePresenceHeartbeat(enabled: boolean, state: 'online' | 'drinking', roomCode?: string) {
  useEffect(() => {
    if (!enabled) return;
    const beat = () => void socialApi.heartbeat(state, roomCode).catch(() => null);
    beat();
    const id = window.setInterval(beat, PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [enabled, state, roomCode]);
}

export function useCustomNpcs(enabled = true) {
  const [npcs, setNpcs] = useState<CustomNpc[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    socialApi
      .listNpcs()
      .then((r) => setNpcs(Array.isArray(r.npcs) ? r.npcs : []))
      .catch(() => null)
      .finally(() => setLoaded(true));
  }, [enabled]);

  const create = async (npc: Omit<CustomNpc, 'npcId'>) => {
    const r = await socialApi.createNpc(npc);
    if (!r?.npc) throw new Error('Máy chủ không trả về NPC vừa tạo');
    setNpcs((prev) => [...prev, r.npc]);
    return r.npc;
  };
  const remove = async (npcId: string) => {
    await socialApi.deleteNpc(npcId);
    setNpcs((prev) => prev.filter((n) => n.npcId !== npcId));
  };
  return { npcs, loaded, create, remove };
}
