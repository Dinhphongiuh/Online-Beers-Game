import React, { useCallback, useEffect, useMemo, useState } from 'react';
import App, { INITIAL_DISHES, INITIAL_PLAYERS } from './App';
import { MainMenu } from './lobby/MainMenu';
import { LobbyConfig } from './lobby/lobbyData';
import { GraphicsQuality } from './lobby/LobbyPanels';
import { AuthPanelModal, AuthUserSession } from './components/AuthPanelModal';

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

  // Authenticate session from Redis on mount using stored token
  useEffect(() => {
    const token = localStorage.getItem('tram_nhau_auth_token');
    if (!token) return;

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data?.user) {
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
        }
      })
      .catch(() => null);
  }, []);

  const handleStart = useCallback((cfg: LobbyConfig, gfx: GraphicsQuality) => {
    setConfig(cfg);
    setGraphics(gfx);
    setPhase('foam_in');
    // Foam fully covers the screen at ~55% of the 1.6s rise; swap scenes underneath it
    window.setTimeout(() => setPhase('foam_out'), 1250);
    window.setTimeout(() => setPhase('game'), 2000);
  }, []);

  const inGame = phase === 'foam_out' || phase === 'game';

  // Single source of truth for login state: lobby and match only show Logout once signed in
  const handleAuthSuccess = useCallback((session: AuthUserSession) => {
    setUserSession(session);
    setShowAuthGate(false);
  }, []);

  const handleLogout = useCallback(async () => {
    const token = localStorage.getItem('tram_nhau_auth_token');
    localStorage.removeItem('tram_nhau_auth_token');
    setUserSession(null);
    // Leaving the account also leaves the table
    setPhase('menu');
    setConfig(null);
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

  return (
    <>
      {inGame && config ? (
        <App
          lobbyConfig={config}
          graphics={graphics}
          isLoggedIn={!!userSession}
          onAuthSuccess={handleAuthSuccess}
          onLogout={handleLogout}
          onExitToMenu={() => setPhase('menu')}
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
