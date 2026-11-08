import React, { useCallback, useEffect, useMemo, useState } from 'react';
import App, { INITIAL_DISHES, INITIAL_PLAYERS } from './App';
import { MainMenu } from './lobby/MainMenu';
import { LobbyConfig } from './lobby/lobbyData';
import { GraphicsQuality } from './lobby/LobbyPanels';
import { AuthPanelModal, AuthUserSession } from './components/AuthPanelModal';
import { ROUTES, loginPathFor, navigate, safeNextPath, useLocation } from './router';
import { usePresenceHeartbeat } from './net/socialApi';
import { useSocialEvents, useSocialSocket } from './net/socialSocket';
import { socialEventToast } from '../shared/social';

type AuthStatus = 'checking' | 'authed' | 'anon';
const TOKEN_KEY = 'tram_nhau_auth_token';

type Phase = 'menu' | 'foam_in' | 'game' | 'foam_out';

/** Shows the 3D lobby first, then swaps to the match behind a beer-foam wipe. */
export default function Root() {
  // Home menu first; the commute (house → alley → pub) starts once you enter the match.
  // `?autostart=1` jumps straight into a default match (dev shortcut).
  const isAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [phase, setPhase] = useState<Phase>(isAutostart ? 'game' : 'menu');
  const [config, setConfig] = useState<LobbyConfig | null>(() =>
    isAutostart
      ? {
          playerName: INITIAL_PLAYERS[0].name,
          skin: {
            avatar: INITIAL_PLAYERS[0].avatar,
            clothing: INITIAL_PLAYERS[0].clothing,
            hat: INITIAL_PLAYERS[0].hat,
            glassType: INITIAL_PLAYERS[0].glassType,
          },
          squadIds: INITIAL_PLAYERS.slice(1).map((p) => p.id),
          roomCode: '4089',
          theme: 'sidewalk',
          drunkSpeed: 'toi_ben',
          rules: {
            micDzo: false,
            randomEvents: false,
            billBrawl: true,
          },
        }
      : null
  );
  const [graphics, setGraphics] = useState<GraphicsQuality>('high');
  const [userSession, setUserSession] = useState<AuthUserSession | null>(null);
  const [showAuthGate, setShowAuthGate] = useState<boolean>(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() =>
    localStorage.getItem(TOKEN_KEY) ? 'checking' : 'anon'
  );
  const location = useLocation();
  const onLoginRoute = location.path === ROUTES.login;

  // Authenticate session from Redis on mount using stored token
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => ({ status: res.status, data: res.ok ? await res.json() : null }))
      .then(({ status, data }) => {
        if (!data?.authenticated || !data?.user) {
          // 401 = expired / revoked: forget the token. A server hiccup (5xx) keeps it.
          if (status === 401) localStorage.removeItem(TOKEN_KEY);
          setAuthStatus('anon');
          return;
        }
        setUserSession({
          authMode: data.user.isGuest ? 'GUEST' : 'LOGIN',
          username: data.user.username,
          email: data.user.email,
          avatar: data.user.avatar || 'dog',
          drunkArchetype: data.user.drunkArchetype || 'TRIET_GIA',
          declaredTolerance: data.user.declaredTolerance || 50,
          coins: data.user.coins || 740,
          title: data.user.title || 'Khách Quen Bờ Kè',
        });
        setAuthStatus('authed');
      })
      .catch(() => setAuthStatus('anon'));
  }, []);

  // Route guard: the menu (and the match) need a session; /login is only for signed-out players
  useEffect(() => {
    if (authStatus === 'checking') return;
    if (authStatus === 'anon' && !onLoginRoute) {
      navigate(loginPathFor(location.path, location.search), { replace: true });
    } else if (authStatus === 'authed' && onLoginRoute) {
      navigate(safeNextPath(location.search), { replace: true });
    }
  }, [authStatus, onLoginRoute, location.path, location.search]);

  const handleStart = useCallback((cfg: LobbyConfig, gfx: GraphicsQuality) => {
    setConfig(cfg);
    setGraphics(gfx);
    setPhase('foam_in');
    // Foam fully covers the screen at ~55% of the 1.6s rise; swap scenes underneath it
    window.setTimeout(() => setPhase('foam_out'), 1250);
    window.setTimeout(() => setPhase('game'), 2000);
  }, []);

  const inGame = phase === 'foam_out' || phase === 'game';

  // Realtime friends channel (friend requests, table invites, presence) while signed in
  useSocialSocket(authStatus === 'authed');
  const [socialToast, setSocialToast] = useState<string | null>(null);
  useSocialEvents((e) => {
    // The menu shows its own toasts; mid-match a small banner keeps you in the loop
    if (!inGame) return;
    const text = socialEventToast(e);
    if (!text) return;
    setSocialToast(text);
    window.setTimeout(() => setSocialToast((t) => (t === text ? null : t)), 5000);
  });

  // Friends see "đang ở quán" (menu) or "đang nhậu bàn #x" (match); no heartbeat = vợ thu điện thoại
  usePresenceHeartbeat(
    authStatus === 'authed',
    inGame ? 'drinking' : 'online',
    inGame ? config?.roomCode : undefined
  );

  // Single source of truth for login state: lobby and match only show Logout once signed in
  const handleAuthSuccess = useCallback((session: AuthUserSession) => {
    setUserSession(session);
    setShowAuthGate(false);
    setAuthStatus('authed'); // the guard sends /login → ?next (or the menu)
  }, []);

  const handleLogout = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setUserSession(null);
    // Leaving the account also leaves the table, and lands back at the gate
    setPhase('menu');
    setConfig(null);
    setAuthStatus('anon');
    navigate(ROUTES.login, { replace: true });
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
    }
  }, []);

  const currentUser = useMemo(() => {
    if (!userSession) return INITIAL_PLAYERS[0];
    return {
      ...INITIAL_PLAYERS[0],
      name: userSession.username,
      avatar: userSession.avatar,
      title: userSession.title || INITIAL_PLAYERS[0].title,
      coins: userSession.coins || INITIAL_PLAYERS[0].coins + 500,
    };
  }, [userSession]);

  // ---- /login: Cổng Quán (no close button — it's the way in) ----
  if (onLoginRoute) {
    if (authStatus === 'authed') return null; // redirecting to ?next
    return <AuthPanelModal isOpen={true} onSuccess={handleAuthSuccess} />;
  }

  // ---- Protected: wait for the session check, then menu / match ----
  if (authStatus !== 'authed') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 text-amber-300 font-neon text-xl">
        {authStatus === 'checking' ? '🪪 Đang kiểm tra Hộ Chiếu...' : '🚪 Mời qua Cổng Quán...'}
      </div>
    );
  }

  return (
    <>
      {inGame && config ? (
        <App
          lobbyConfig={config}
          graphics={graphics}
          isLoggedIn={!!userSession}
          onAuthSuccess={handleAuthSuccess}
          onExitToMenu={() => {
            // Drop the `?autostart=1` dev shortcut: a later reload (F5 / Vite) must stay on the menu
            const url = new URL(window.location.href);
            if (url.searchParams.has('autostart')) {
              url.searchParams.delete('autostart');
              window.history.replaceState(null, '', url.pathname + url.search + url.hash);
            }
            setPhase('menu');
          }}
        />
      ) : (
        <MainMenu
          userTemplate={currentUser}
          crew={INITIAL_PLAYERS.slice(1)}
          dishes={INITIAL_DISHES}
          onStart={handleStart}
          isLoggedIn={!!userSession}
          onAuthSuccess={handleAuthSuccess}
          onLogout={handleLogout}
        />
      )}

      {inGame && socialToast && (
        <div
          data-testid="social-toast-ingame"
          className="fixed top-20 right-4 z-[96] max-w-xs rounded-xl border-2 border-amber-400 bg-zinc-950/95 px-3 py-2 text-xs font-bold text-amber-100 shadow-2xl pointer-events-none"
        >
          {socialToast}
          <div className="text-[10px] font-normal text-zinc-400">Xem ở danh sách bạn bè khi về Menu</div>
        </div>
      )}

      {showAuthGate && (
        <AuthPanelModal
          isOpen={true}
          onClose={() => setShowAuthGate(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {(phase === 'foam_in' || phase === 'foam_out') && (
        <div
          className={`fixed inset-0 z-[100] pointer-events-none ${
            phase === 'foam_out' ? 'foam-wipe-out' : ''
          }`}
        >
          <div className="absolute inset-0 foam-wipe flex flex-col">
            <div className="foam-head h-24 -mb-10 shrink-0" />
            <div className="foam-body flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
              <div className="font-neon text-5xl sm:text-7xl text-white drop-shadow-[0_4px_0_rgba(146,64,14,0.8)] rotate-[-3deg]">
                LOADING 100% • DZÔÔÔ!
              </div>
              <div className="px-4 py-2 rounded-2xl bg-zinc-950/85 border-2 border-amber-300 text-amber-200 font-black text-xs sm:text-sm shadow-xl">
                🏠➔🛵 Đang mở Bản Đồ Khu Phố Đêm 3D: Xuất phát từ Căn Nhà Ống Trong Hẻm (Cách quán 250m)...
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
