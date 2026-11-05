import React, { useCallback, useEffect, useMemo, useState } from 'react';
import App, { INITIAL_DISHES, INITIAL_PLAYERS } from './App';
import { MainMenu } from './lobby/MainMenu';
import { LobbyConfig } from './lobby/lobbyData';
import { GraphicsQuality } from './lobby/LobbyPanels';
import { AuthPanelModal, AuthUserSession } from './components/AuthPanelModal';

type Phase = 'menu' | 'foam_in' | 'game' | 'foam_out';

/** Shows the 3D lobby first, then swaps to the match behind a beer-foam wipe. */
export default function Root() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [config, setConfig] = useState<LobbyConfig | null>(null);
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
        <App lobbyConfig={config} graphics={graphics} />
      ) : (
        <MainMenu
          userTemplate={currentUser}
          crew={INITIAL_PLAYERS.slice(1)}
          dishes={INITIAL_DISHES}
          onStart={handleStart}
        />
      )}

      {showAuthGate && (
        <AuthPanelModal
          isOpen={true}
          onClose={() => setShowAuthGate(false)}
          onSuccess={(session) => {
            setUserSession(session);
            setShowAuthGate(false);
          }}
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
            <div className="foam-body flex-1 flex items-center justify-center">
              <div className="font-neon text-6xl sm:text-8xl text-white drop-shadow-[0_4px_0_rgba(146,64,14,0.8)] rotate-[-4deg]">
                DZÔÔÔ!
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
