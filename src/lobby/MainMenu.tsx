import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Settings, Volume2, VolumeX, Users, MessageSquare, Send, X, LogOut } from 'lucide-react';
import { initThreeScene, SceneController, LOBBY_SEAT_COUNT } from '../game/threeScene';
import { sound } from '../game/audio';
import { FoodDish, Player, PubTheme } from '../game/types';
import {
  AVATAR_ICON,
  DEFAULT_RULES,
  DRUNK_SPEEDS,
  DrunkSpeedId,
  LobbyConfig,
  LobbySkin,
  TableRules,
  THEME_NAMES,
  LOBBY_MAPS,
  buildFriendList,
  drinkingRank,
  randomRoomCode,
} from './lobbyData';
import {
  GraphicsQuality,
  HostRoomPanel,
  InvitePopup,
  JoinCodePanel,
  ProfilePanel,
  SettingsPanel,
  WardrobePanel,
  isAudioUnlocked,
  markAudioUnlocked,
  sfx,
} from './LobbyPanels';
import { AuthPanelModal, AuthUserSession } from '../components/AuthPanelModal';

type PanelId = 'none' | 'host' | 'join' | 'wardrobe' | 'profile' | 'settings' | 'invite' | 'auth';

interface SquadMember {
  id: string;
  seatIndex: number;
}

interface ChatLine {
  key: number;
  who: string;
  text: string;
}

interface ReactionPop {
  key: number;
  seatIndex: number;
  text: string;
}

const QUICK_PHRASES = ['Lẹ lên anh em ơi! 🍻', 'Ai bao chầu này? 🤑', 'Tới đâu rồi? 🛵', 'Hôm nay không say không về! 🔥'];

const NPC_ARRIVAL_LINES = [
  'Tới rồi tới rồi, kêu thêm két bia đi! 🍺',
  'Kẹt xe quá trời, phạt tui 1 ly cũng được 😅',
  'Hôm nay tui bao… à mà thôi 🙊',
  'Có mồi gì chưa, đói quá! 🥜',
];

const NPC_BANTER = [
  { kind: 'slap' as const, line: 'tát yêu', emoji: '👋' },
  { kind: 'tickle' as const, line: 'chọc lét', emoji: '🤣' },
];

export interface MainMenuProps {
  userTemplate: Player;
  crew: Player[];
  dishes: FoodDish[];
  onStart: (config: LobbyConfig, graphics: GraphicsQuality) => void;
  /** Signed in: hide every login/sign-up entry point and only offer Logout. */
  isLoggedIn: boolean;
  onAuthSuccess: (session: AuthUserSession) => void;
  onLogout: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  userTemplate,
  crew,
  dishes,
  onStart,
  isLoggedIn,
  onAuthSuccess,
  onLogout,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneController | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timers = useRef<number[]>([]);
  const keyCounter = useRef(0);
  const nextKey = () => ++keyCounter.current;

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  // ---- Player & table setup ----
  const [name, setName] = useState(isLoggedIn ? userTemplate.name : 'Bợm Nhậu');
  // The session can be restored after the lobby mounts (token check), so follow it
  useEffect(() => {
    if (isLoggedIn) setName(userTemplate.name);
  }, [isLoggedIn, userTemplate.name]);
  const [skin, setSkin] = useState<LobbySkin>({
    avatar: userTemplate.avatar,
    clothing: userTemplate.clothing,
    hat: userTemplate.hat,
    glassType: userTemplate.glassType,
  });
  const [squad, setSquad] = useState<SquadMember[]>([]);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [seatedIds, setSeatedIds] = useState<string[]>(['user']);
  const [talking, setTalking] = useState<Record<string, boolean>>({});

  const [map, setMap] = useState<PubTheme>('bo_ke');
  const [drunkSpeed, setDrunkSpeed] = useState<DrunkSpeedId>('toi_ben');
  const [rules, setRules] = useState<TableRules>(DEFAULT_RULES);
  const [roomCode, setRoomCode] = useState(randomRoomCode);
  const [hostName, setHostName] = useState<string | null>(null);

  // ---- UI state ----
  const [panel, setPanel] = useState<PanelId>('none');
  const [inviteSeat, setInviteSeat] = useState<number | null>(null);
  const [volume, setVolume] = useState(sound.getMasterVolume());
  const [graphics, setGraphics] = useState<GraphicsQuality>('high');
  const [bgmOn, setBgmOn] = useState(false);
  const [chat, setChat] = useState<ChatLine[]>([
    { key: 0, who: 'Phục vụ', text: 'Bàn trống nè, ngồi đi rồi rủ anh em tới! 🪑' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [micTest, setMicTest] = useState(false);
  const [pops, setPops] = useState<ReactionPop[]>([]);
  const [pendingStart, setPendingStart] = useState(false);
  const [starting, setStarting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [logoFlickerKey, setLogoFlickerKey] = useState(0);
  const [mobileSheet, setMobileSheet] = useState<'none' | 'chat' | 'friends'>('none');

  const friends = useMemo(() => buildFriendList(crew), [crew]);
  const rank = drinkingRank(userTemplate.drinksCount + 8);

  const showToast = useCallback(
    (msg: string) => {
      setToast(msg);
      later(() => setToast((prev) => (prev === msg ? null : prev)), 3200);
    },
    [later]
  );

  const say = useCallback((who: string, text: string) => {
    setChat((prev) => [...prev.slice(-30), { key: nextKey(), who, text }]);
  }, []);

  // Players handed to the 3D scene: you on seat 0, crew on the seats they took
  const lobbyPlayers = useMemo<Player[]>(() => {
    const me: Player = {
      ...userTemplate,
      name,
      ...skin,
      seatIndex: 0,
      alcoholLevel: 0,
      isPassedOut: false,
      faceDoodles: [],
    };
    const members = squad
      .map((m) => {
        const p = crew.find((c) => c.id === m.id);
        if (!p) return null;
        const member: Player = { ...p, seatIndex: m.seatIndex, alcoholLevel: 0, isPassedOut: false, faceDoodles: [] };
        return member;
      })
      .filter((p): p is Player => !!p);
    return [me, ...members];
  }, [userTemplate, name, skin, squad, crew]);

  const playerBySeat = useMemo(() => {
    const m = new Map<number, Player>();
    lobbyPlayers.forEach((p) => m.set(p.seatIndex, p));
    return m;
  }, [lobbyPlayers]);

  // ---- Handlers (kept in a ref so 3D callbacks registered once always see fresh state) ----
  const popReaction = useCallback(
    (seatIndex: number, text: string) => {
      const key = nextKey();
      setPops((prev) => [...prev, { key, seatIndex, text }]);
      later(() => setPops((prev) => prev.filter((p) => p.key !== key)), 1150);
    },
    [later]
  );

  const reactTo = useCallback(
    (target: Player, kind: 'slap' | 'tickle' | 'munch', text: string) => {
      sceneRef.current?.triggerLobbyReaction(target.id, kind);
      if (kind === 'slap') sound.playSlap();
      else if (kind === 'tickle') sound.playLaugh();
      else sound.playCrunch();
      popReaction(target.seatIndex, text);
    },
    [popReaction]
  );

  const slapCounter = useRef(0);
  const handlersRef = useRef({
    onCharacterClick: (_id: string) => {},
    onSeatClick: (_seat: number) => {},
    onFoodClick: (_type: string) => {},
  });
  handlersRef.current = {
    onCharacterClick: (id: string) => {
      const target = lobbyPlayers.find((p) => p.id === id);
      if (!target || starting) return;
      if (target.isUser) {
        reactTo(target, 'tickle', 'Tự gãi lưng 🤭');
        return;
      }
      const isSlap = slapCounter.current++ % 2 === 0;
      reactTo(target, isSlap ? 'slap' : 'tickle', isSlap ? 'Tát yêu! 👋' : 'Chọc lét! 🤣');
      if (Math.random() < 0.5) {
        later(() => say(target.name, isSlap ? 'Ê ê đánh gì đau vậy! 😤' : 'Hahaha nhột quá trời! 🤣'), 500);
      }
    },
    onSeatClick: (seat: number) => {
      if (starting) return;
      sound.playBottleOpen();
      setInviteSeat(seat);
      setPanel('invite');
    },
    onFoodClick: (type: string) => {
      const me = lobbyPlayers[0];
      const dish = dishes.find((d) => d.id === type);
      reactTo(me, 'munch', type === 'peanut' ? 'Rộp rộp! 🥜' : `Nhai ${dish?.icon || '😋'} nhóp nhép!`);
    },
  };

  // ---- 3D scene lifecycle ----
  useEffect(() => {
    if (!mountRef.current) return;
    const scene = initThreeScene();
    sceneRef.current = scene;
    scene.mount(mountRef.current);
    scene.setLobbyMode('lobby');
    scene.updateFoodDishes(dishes);
    scene.onLobbyCharacterClick = (id) => handlersRef.current.onCharacterClick(id);
    scene.onLobbySeatClick = (seat) => handlersRef.current.onSeatClick(seat);
    scene.onFoodClick = (type) => handlersRef.current.onFoodClick(type);

    // Pin HTML badges to the 3D seats every frame (direct DOM writes, no React re-render)
    let raf = 0;
    let lastSeatedKey = '';
    const loop = () => {
      const anchors = scene.getLobbyAnchors();
      const seatedNow: string[] = [];
      anchors.forEach((a) => {
        const el = slotRefs.current[a.seatIndex];
        if (el) {
          el.style.transform = `translate(${a.x}px, ${a.y}px)`;
          el.style.visibility = a.onScreen ? 'visible' : 'hidden';
        }
        if (a.playerId && a.seated) seatedNow.push(a.playerId);
      });
      const key = seatedNow.sort().join('|');
      if (key !== lastSeatedKey) {
        lastSeatedKey = key;
        setSeatedIds(seatedNow);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      scene.destroy();
      sceneRef.current = null;
      timers.current.forEach(clearTimeout);
      sound.stopMicCheers();
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.updatePlayers(lobbyPlayers);
  }, [lobbyPlayers]);

  useEffect(() => {
    sceneRef.current?.setLobbyMode(panel === 'wardrobe' ? 'wardrobe' : 'lobby');
  }, [panel]);

  useEffect(() => {
    sceneRef.current?.setGraphicsQuality(graphics);
  }, [graphics]);

  useEffect(() => {
    sound.setMasterVolume(volume);
  }, [volume]);

  // Unlock audio on first gesture so hover/click SFX can play
  useEffect(() => {
    const unlock = () => markAudioUnlocked();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Neon logo randomly shorts out with a "xẹt xẹt"
  useEffect(() => {
    let id = 0;
    const schedule = () => {
      id = window.setTimeout(() => {
        setLogoFlickerKey((k) => k + 1);
        if (isAudioUnlocked()) sound.playNeonBuzz();
        schedule();
      }, 6000 + Math.random() * 5000);
    };
    schedule();
    return () => clearTimeout(id);
  }, []);

  // Friends who just hopped onto their stool get ready after a moment
  const greeted = useRef(new Set<string>());
  useEffect(() => {
    seatedIds.forEach((id) => {
      if (id === 'user' || greeted.current.has(id)) return;
      greeted.current.add(id);
      const friend = crew.find((c) => c.id === id);
      if (!friend) return;
      sound.playChairFall();
      say(friend.name, NPC_ARRIVAL_LINES[Math.floor(Math.random() * NPC_ARRIVAL_LINES.length)]);
      later(() => {
        setReady((prev) => ({ ...prev, [id]: true }));
        sound.playMugSlam();
      }, 900 + Math.random() * 1600);
    });
  }, [seatedIds, crew, later, say]);

  // Seated friends chatter (mic lights blink) and mess with each other
  useEffect(() => {
    const talkTimer = window.setInterval(() => {
      setTalking((prev) => {
        const next: Record<string, boolean> = { user: prev.user || false };
        seatedIds.forEach((id) => {
          if (id !== 'user') next[id] = Math.random() < 0.3;
        });
        return next;
      });
    }, 700);

    const banterTimer = window.setInterval(() => {
      const seatedFriends = lobbyPlayers.filter((p) => !p.isUser && seatedIds.includes(p.id));
      if (seatedFriends.length < 1 || starting) return;
      const actor = seatedFriends[Math.floor(Math.random() * seatedFriends.length)];
      const victims = lobbyPlayers.filter((p) => p.id !== actor.id && seatedIds.includes(p.id));
      const victim = victims[Math.floor(Math.random() * victims.length)];
      if (!victim) return;
      const b = NPC_BANTER[Math.floor(Math.random() * NPC_BANTER.length)];
      reactTo(victim, b.kind, `${b.emoji}`);
      say(actor.name, `*${b.line} ${victim.isUser ? 'bạn' : victim.name}* ${b.emoji}`);
    }, 7500);

    return () => {
      clearInterval(talkTimer);
      clearInterval(banterTimer);
    };
  }, [seatedIds, lobbyPlayers, starting, reactTo, say]);

  // ---- Squad management ----
  const freeSeats = useCallback(
    (taken: SquadMember[]) =>
      Array.from({ length: LOBBY_SEAT_COUNT }, (_, i) => i).filter(
        (i) => i !== 0 && !taken.some((m) => m.seatIndex === i)
      ),
    []
  );

  const invite = useCallback(
    (friendId: string, seat?: number | null) => {
      setSquad((prev) => {
        if (prev.some((m) => m.id === friendId)) return prev;
        const free = freeSeats(prev);
        const target = seat != null && free.includes(seat) ? seat : free[0];
        if (target === undefined) return prev;
        return [...prev, { id: friendId, seatIndex: target }];
      });
      sound.playHornBeep();
    },
    [freeSeats]
  );

  const inviteWholeCrew = useCallback(() => {
    const missing = crew.filter((c) => !squad.some((m) => m.id === c.id));
    missing.forEach((c, i) => later(() => invite(c.id), 350 + i * 650));
    return missing.length;
  }, [crew, squad, invite, later]);

  // ---- Start flow ----
  const everyoneReady =
    squad.length > 0 &&
    !!ready.user &&
    squad.every((m) => seatedIds.includes(m.id) && ready[m.id]);

  const startMatch = useCallback(() => {
    if (starting) return;
    setStarting(true);
    setPanel('none');
    sound.stopMicCheers();
    sound.playCrowdDzo();
    onStart(
      {
        playerName: name.trim() || 'Bợm Nhậu',
        skin,
        squadIds: [...squad].sort((a, b) => a.seatIndex - b.seatIndex).map((m) => m.id),
        theme: map,
        drunkSpeed,
        rules,
        roomCode,
      },
      graphics
    );
  }, [starting, name, skin, squad, map, drunkSpeed, rules, roomCode, graphics, onStart]);

  // Quick play / join: start automatically once the table fills up and everyone is ready
  useEffect(() => {
    if (pendingStart && everyoneReady) {
      later(startMatch, 900);
      setPendingStart(false);
    }
  }, [pendingStart, everyoneReady, startMatch, later]);

  const handleQuickPlay = () => {
    sound.playBottleOpen();
    setReady((prev) => ({ ...prev, user: true }));
    const coming = inviteWholeCrew();
    showToast(coming > 0 ? '🛵 Đang ghép bàn… chiến hữu đang chạy tới!' : '🍻 Đủ người rồi, chuẩn bị DZÔ!');
    setPendingStart(true);
  };

  const handleToggleReady = () => {
    sound.playMugSlam();
    setReady((prev) => ({ ...prev, user: !prev.user }));
  };

  const handleStartButton = () => {
    if (squad.length === 0) {
      handleQuickPlay();
      return;
    }
    if (!everyoneReady) {
      sound.playHiccup();
      showToast('⏳ Chờ cả bàn bấm "Lên Mồi!" đã nha!');
      return;
    }
    startMatch();
  };

  const toggleMicTest = async () => {
    if (micTest) {
      sound.stopMicCheers();
      setMicTest(false);
      setTalking((prev) => ({ ...prev, user: false }));
      return;
    }
    const ok = await sound.startMicCheers(
      () => {},
      () => showToast('🎤 Không mở được micro — kiểm tra quyền trình duyệt nha.'),
      (rms) => setTalking((prev) => (prev.user === rms > 0.12 ? prev : { ...prev, user: rms > 0.12 }))
    );
    setMicTest(ok);
  };

  const sendChat = (text: string) => {
    const t = text.trim();
    if (!t) return;
    sound.playAnimaleseBlip(t.charCodeAt(0), 20);
    say(name || 'Bạn', t);
    setChatInput('');
    const seatedFriends = lobbyPlayers.filter((p) => !p.isUser && seatedIds.includes(p.id));
    if (seatedFriends.length > 0) {
      const f = seatedFriends[Math.floor(Math.random() * seatedFriends.length)];
      later(() => say(f.name, ['Chuẩn luôn! 👍', 'Dzô dzô! 🍻', 'Từ từ tui đang ăn 🥜', 'Ok bạn hiền 😎'][Math.floor(Math.random() * 4)]), 1100);
    }
  };

  const menuItems: { id: PanelId | 'quick'; icon: string; label: string; sub: string }[] = [
    ...(isLoggedIn ? [] : [{ id: 'auth' as PanelId, icon: '🪪', label: 'Đăng Nhập / Đăng Ký', sub: 'Tài khoản' }]),
    { id: 'host', icon: '🔑', label: 'Tạo Bàn Riêng', sub: 'Host Room' },
    { id: 'join', icon: '🔢', label: 'Nhập Mã Bàn', sub: 'Join by Code' },
    { id: 'wardrobe', icon: '👕', label: 'Tủ Đồ Vỉa Hè', sub: 'Wardrobe' },
    { id: 'profile', icon: '📜', label: 'Hộ Chiếu Tửu Lượng', sub: 'Profile & Rank' },
  ];

  const openPanel = (id: PanelId) => {
    sound.playBottleOpen();
    setPanel(id);
  };

  const speedInfo = DRUNK_SPEEDS.find((s) => s.id === drunkSpeed)!;
  const hideChrome = panel === 'wardrobe' || starting;

  // ============================================================================
  // RENDER
  // ============================================================================
  const chatBox = (
    <div className="w-full rounded-2xl bg-zinc-950/85 border border-zinc-700/80 backdrop-blur-md shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 text-[11px] font-black text-amber-300">
        <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Chat Bàn #{roomCode}</span>
        <button
          {...sfx}
          onClick={toggleMicTest}
          className={`px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer ${
            micTest ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          } ${micTest && talking.user ? 'mic-talking' : ''}`}
        >
          {micTest ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
          Mic Test
        </button>
      </div>
      <div className="h-24 overflow-y-auto px-3 py-1.5 space-y-0.5 text-[12px] flex flex-col-reverse">
        <div>
          {chat.slice(-12).map((c) => (
            <div key={c.key} className="leading-snug">
              <b className="text-amber-200">{c.who}:</b> <span className="text-zinc-200">{c.text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-1 px-2 pb-1.5 overflow-x-auto">
        {QUICK_PHRASES.map((q) => (
          <button
            key={q}
            {...sfx}
            onClick={() => sendChat(q)}
            className="shrink-0 px-2 py-0.5 rounded-full bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-[10px] font-bold text-zinc-300 cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>
      <form
        className="flex gap-1.5 p-2 pt-0"
        onSubmit={(e) => {
          e.preventDefault();
          sendChat(chatInput);
        }}
      >
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Nhắn cả bàn…"
          className="flex-1 min-w-0 bg-zinc-900 text-white text-xs px-2.5 py-1.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-amber-400"
        />
        <button type="submit" className="px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 cursor-pointer" aria-label="Gửi">
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );

  const friendsBox = (
    <div className="w-full rounded-2xl bg-zinc-950/85 border border-zinc-700/80 backdrop-blur-md shadow-xl p-2.5">
      <div className="flex items-center justify-between text-[11px] font-black text-amber-300 mb-1.5 px-0.5">
        <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Bạn Bè Online</span>
        <span className="text-zinc-500">{friends.filter((f) => f.status !== 'offline').length}/{friends.length}</span>
      </div>
      <div className="space-y-1">
        {friends.map((f) => {
          const seated = squad.some((m) => m.id === f.id);
          return (
            <div key={f.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/5">
              <span className="relative text-lg leading-none">
                {AVATAR_ICON[f.avatar]}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-950 ${
                    f.status === 'online' ? 'bg-emerald-400' : f.status === 'drinking' ? 'bg-amber-400' : 'bg-zinc-600'
                  }`}
                />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[12px] font-bold text-zinc-100 truncate">{f.name}</span>
                <span className="block text-[9px] text-zinc-500 truncate">{f.note}</span>
              </span>
              {f.invitable && (
                <button
                  {...sfx}
                  disabled={seated || starting}
                  onClick={() => invite(f.id)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-black cursor-pointer bg-amber-500 hover:bg-amber-400 text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-default"
                >
                  {seated ? 'Ở bàn' : 'Rủ'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="relative w-full h-screen overflow-hidden bg-zinc-950 text-white">
      {/* 3D background */}
      <div ref={mountRef} className="absolute inset-0" />
      {/* Warm vignette so the UI pops against the night scene */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_65%_45%,transparent_35%,rgba(0,0,0,0.55)_100%)]" />

      {/* Seat anchors: [+ Rủ Nhậu] on empty stools, name/mic/ready badges on occupied ones */}
      <div className={`absolute inset-0 pointer-events-none ${hideChrome ? 'opacity-0' : ''}`}>
        {Array.from({ length: LOBBY_SEAT_COUNT }, (_, seat) => {
          const p = playerBySeat.get(seat);
          const isSeated = p ? seatedIds.includes(p.id) : false;
          return (
            <div
              key={seat}
              ref={(el) => {
                slotRefs.current[seat] = el;
              }}
              className="absolute left-0 top-0 will-change-transform"
            >
              {!p ? (
                <button
                  {...sfx}
                  onClick={() => handlersRef.current.onSeatClick(seat)}
                  className="seat-plus pointer-events-auto absolute left-0 top-0 whitespace-nowrap px-2.5 py-1 rounded-full border-2 border-dashed border-amber-300/80 bg-zinc-950/70 hover:bg-amber-400 hover:text-zinc-950 text-amber-200 text-[11px] font-black shadow-lg cursor-pointer transition-colors"
                >
                  + Rủ Nhậu
                </button>
              ) : (
                <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-full flex flex-col items-center gap-1 pb-1">
                  <div className="flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full bg-zinc-950/80 border border-zinc-700 text-[11px] font-bold shadow">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        talking[p.id] ? 'bg-emerald-500 text-zinc-950 mic-talking' : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      <Mic className="w-2.5 h-2.5" />
                    </span>
                    <span className={p.isUser ? 'text-amber-300' : 'text-zinc-100'}>
                      {p.isUser ? name || 'Bạn' : p.name}
                    </span>
                  </div>
                  {p.isUser ? (
                    <button
                      {...sfx}
                      onClick={handleToggleReady}
                      className={`pointer-events-auto whitespace-nowrap px-2.5 py-1 rounded-lg text-[10px] font-black shadow-lg cursor-pointer active:scale-95 transition ${
                        ready.user
                          ? 'bg-emerald-500 text-zinc-950'
                          : 'bg-amber-400 text-red-900 hover:bg-amber-300 animate-pulse'
                      }`}
                    >
                      {ready.user ? '✅ Đã Lên Mồi!' : 'SẴN SÀNG / LÊN MỒI!'}
                    </button>
                  ) : (
                    <span
                      className={`whitespace-nowrap px-2 py-0.5 rounded-md text-[10px] font-black ${
                        !isSeated
                          ? 'bg-zinc-800/90 text-zinc-300'
                          : ready[p.id]
                          ? 'bg-emerald-500/90 text-zinc-950'
                          : 'bg-zinc-800/90 text-amber-300'
                      }`}
                    >
                      {!isSeated ? '🏃 Đang chạy tới…' : ready[p.id] ? '✅ Lên mồi!' : '⏳ Đang ngồi…'}
                    </span>
                  )}
                </div>
              )}
              {pops
                .filter((pp) => pp.seatIndex === seat)
                .map((pp) => (
                  <div
                    key={pp.key}
                    className="reaction-pop absolute left-0 top-0 whitespace-nowrap px-2 py-0.5 rounded-lg bg-white text-zinc-900 text-xs font-black shadow-lg"
                    style={{ marginTop: -56 }}
                  >
                    {pp.text}
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      {/* ---------- TOP BAR ---------- */}
      <div className={`absolute top-0 inset-x-0 z-30 flex items-start justify-between gap-2 p-2 sm:p-3 transition-opacity ${starting ? 'opacity-0' : ''}`}>
        <div className="flex items-center gap-2">
          <button
            {...sfx}
            onClick={() => openPanel('profile')}
            className="flex items-center gap-2 rounded-2xl bg-zinc-950/85 border border-amber-500/40 pl-1 pr-3 py-1 shadow-lg backdrop-blur-md cursor-pointer hover:border-amber-400 text-left"
          >
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 flex items-center justify-center text-xl border-2 border-amber-200">
              {AVATAR_ICON[skin.avatar]}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-black truncate max-w-[110px] sm:max-w-[180px]">{name || 'Bợm Nhậu'}</span>
              <span className="block text-[10px] text-amber-300 font-bold">
                Lv.{rank.level} • {rank.name}
              </span>
            </span>
          </button>

          {isLoggedIn ? (
            <button
              {...sfx}
              onClick={() => {
                sound.playBottleOpen();
                onLogout();
                setName('Bợm Nhậu');
                showToast('🏃💨 Đã rút êm về với nóc nhà! (Đăng xuất thành công)');
              }}
              className="flex items-center gap-1.5 rounded-2xl bg-rose-600/25 hover:bg-rose-600 border border-rose-500/50 px-3 py-1.5 shadow-lg backdrop-blur-md cursor-pointer text-rose-200 hover:text-white transition"
              title="Đăng xuất — rút êm về nhà trước khi nóc nhà gọi"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs font-black tracking-wide hidden sm:inline">Rút Êm Về Nhà 🏃</span>
            </button>
          ) : (
          <button
            {...sfx}
            onClick={() => openPanel('auth')}
            className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500/25 to-orange-500/25 border border-amber-400/60 px-3 py-1.5 shadow-lg backdrop-blur-md cursor-pointer hover:border-amber-300 text-amber-200 hover:text-white transition"
            title="Đăng nhập, đăng ký hoặc vào nhanh không cần tài khoản"
          >
            <span className="text-base">🪪</span>
            <span className="text-xs font-black tracking-wide hidden sm:inline">
              Đăng Nhập / Đăng Ký
            </span>
            <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.2 rounded-full">
              18+
            </span>
          </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded-xl bg-zinc-950/85 border border-zinc-700 px-2 py-1.5 shadow-lg" title="Nắp Bia (tiền thường)">
            <span className="beer-cap w-4 h-4 bg-gradient-to-br from-zinc-200 to-zinc-500 rotate-12 scale-y-75 inline-block" />
            <span className="text-xs font-black text-zinc-100">{userTemplate.coins}</span>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-zinc-950/85 border border-zinc-700 px-2 py-1.5 shadow-lg" title="Lúa (tiền cao cấp)">
            <span className="text-sm leading-none">🌾</span>
            <span className="text-xs font-black text-lime-300">{userTemplate.gems}</span>
          </div>
          <button
            {...sfx}
            onClick={() => openPanel('settings')}
            className="p-2 rounded-xl bg-zinc-950/85 border border-zinc-700 hover:border-amber-400 shadow-lg cursor-pointer"
            aria-label="Cài đặt"
          >
            <Settings className="w-4 h-4 text-zinc-200" />
          </button>
          <button
            {...sfx}
            onClick={() => {
              const next = !bgmOn;
              sound.toggleBGM(next);
              setBgmOn(next);
            }}
            className={`p-2 rounded-xl border shadow-lg cursor-pointer ${
              bgmOn ? 'bg-amber-500/25 border-amber-400 text-amber-300' : 'bg-zinc-950/85 border-zinc-700 text-zinc-400'
            }`}
            aria-label={bgmOn ? 'Tắt nhạc' : 'Bật nhạc'}
          >
            {bgmOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ---------- LEFT: LOGO + MAIN MENU ---------- */}
      <div
        className={`absolute z-20 transition-all duration-300 ${
          hideChrome ? 'opacity-0 -translate-x-8 pointer-events-none' : ''
        } left-3 right-3 bottom-3 md:right-auto md:bottom-auto md:left-6 md:top-20 md:w-[340px]`}
      >
        {/* Game logo: neon tubes on a rusty tin plate (a game brand, not any real pub) */}
        <div className="tin-sign rounded-2xl border-2 border-zinc-600 shadow-2xl px-4 py-3 mb-3 text-center relative overflow-hidden hidden md:block">
          <div className="absolute top-1.5 left-2 w-1.5 h-1.5 rounded-full bg-zinc-400/70" />
          <div className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-zinc-400/70" />
          <div className="font-neon text-[30px] leading-none neon-tube-amber neon-flicker">
            ONLINE <span key={logoFlickerKey} className="inline-block neon-flicker-fast">🍺</span>
          </div>
          <div className="mt-0.5 font-neon text-[26px] leading-none tracking-wide neon-tube-pink">DRINKING</div>
          <div className="text-[10px] text-zinc-400 mt-2 tracking-[0.2em]">NHẬU VỈA HÈ • KHÔNG SAY KHÔNG VỀ</div>
        </div>

        {/* Laminated street-food menu card */}
        <div className="laminated-menu rounded-2xl border-4 border-amber-400/90 shadow-2xl p-3">
          <div className="md:hidden text-center mb-2 -mt-0.5">
            <span className="font-neon text-lg neon-tube-amber neon-flicker">ONLINE</span>{' '}
            <span className="font-neon text-lg neon-tube-pink">
              DRINKING <span key={logoFlickerKey} className="inline-block neon-flicker-fast">🍺</span>
            </span>
          </div>
          <button
            {...sfx}
            onClick={handleQuickPlay}
            disabled={starting}
            className="beer-button w-full mt-2 rounded-xl px-4 py-3.5 text-left cursor-pointer shadow-[0_6px_0_#92400e] active:translate-y-1 active:shadow-[0_2px_0_#92400e] transition-transform"
          >
            {[10, 24, 41, 58, 73, 88].map((left, i) => (
              <span key={i} className="beer-bubble" style={{ left: `${left}%`, animationDelay: `${i * 0.17}s` }} />
            ))}
            <span className="relative block font-neon text-lg sm:text-xl text-red-900 leading-tight">🍺 VÀO BÀN NHẬU NGAY</span>
            <span className="relative block text-[10px] font-black text-red-900/70 tracking-widest">QUICK PLAY • GHÉP BÀN TỰ ĐỘNG</span>
          </button>

          <div
            className={`grid ${menuItems.length > 4 ? 'grid-cols-5' : 'grid-cols-4'} md:grid-cols-1 gap-1.5 mt-3`}
          >
            {menuItems.map((item) => (
              <button
                key={item.id}
                {...sfx}
                onClick={() => openPanel(item.id as PanelId)}
                className="group flex flex-col md:flex-row items-center md:gap-3 rounded-xl bg-black/25 hover:bg-amber-400 border border-white/10 hover:border-amber-200 px-1 md:px-3 py-2 text-center md:text-left cursor-pointer transition-colors"
              >
                <span className="text-xl md:text-lg leading-none">{item.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[10px] md:text-sm font-black text-amber-100 group-hover:text-red-900 leading-tight mt-1 md:mt-0">
                    {item.label}
                  </span>
                  <span className="hidden md:block text-[10px] text-white/50 group-hover:text-red-900/70 font-bold tracking-wider uppercase">
                    {item.sub}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {/* Your table: where it is set up, how hard it drinks, and who hosts */}
          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-2.5 hidden md:block">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-200/80">Bàn của bạn</span>
              <span className="rounded-md bg-amber-400/90 px-1.5 py-0.5 font-mono text-[10px] font-black text-red-900">
                #{roomCode}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="rounded-lg bg-black/25 px-2 py-1.5">
                <div className="text-[9px] font-bold uppercase text-white/45">Địa điểm</div>
                <div className="truncate font-black text-amber-50">
                  {LOBBY_MAPS.find((m) => m.id === map)?.icon} {THEME_NAMES[map]}
                </div>
              </div>
              <div className="rounded-lg bg-black/25 px-2 py-1.5">
                <div className="text-[9px] font-bold uppercase text-white/45">Độ đô</div>
                <div className="truncate font-black text-amber-50">
                  {speedInfo.icon} {speedInfo.name}
                </div>
              </div>
            </div>
            <div className="mt-1.5 text-[10px] font-bold text-amber-100/70">
              {hostName ? `👑 Chủ bàn: ${hostName}` : '👑 Bạn là chủ bàn'} • 🪑 {squad.length + 1}/{LOBBY_SEAT_COUNT} ghế
            </div>
          </div>
        </div>
      </div>

      {/* ---------- BOTTOM-CENTER: START ---------- */}
      {!hideChrome && (
        <div className="absolute z-20 left-1/2 -translate-x-1/2 bottom-[15.75rem] md:bottom-6 md:left-[calc(50%+170px)] flex flex-col items-center gap-1.5">
          <button
            {...sfx}
            onClick={handleStartButton}
            className={`font-neon whitespace-nowrap px-6 py-3 rounded-2xl text-lg shadow-2xl cursor-pointer transition active:scale-95 border-2 ${
              everyoneReady || squad.length === 0
                ? 'bg-gradient-to-b from-red-500 to-red-700 border-amber-300 text-amber-100 hover:from-red-400'
                : 'bg-zinc-800/90 border-zinc-600 text-zinc-400'
            }`}
          >
            {squad.length === 0 ? '🛵 Ghép Bàn & Nhậu!' : '🍻 BẮT ĐẦU NHẬU!'}
          </button>
          <div className="text-[10px] font-bold text-white/70 bg-black/40 rounded-full px-2.5 py-0.5">
            {squad.length === 0
              ? 'Bấm dấu [+] trên ghế trống để rủ chiến hữu'
              : `${squad.filter((m) => ready[m.id]).length + (ready.user ? 1 : 0)}/${squad.length + 1} người đã lên mồi`}
          </div>
        </div>
      )}

      {/* ---------- BOTTOM-LEFT CHAT / BOTTOM-RIGHT FRIENDS (desktop) ---------- */}
      {!hideChrome && (
        <>
          <div className="hidden lg:block absolute z-20 left-[384px] bottom-6 w-72">{chatBox}</div>
          <div className="hidden md:block absolute z-20 right-4 bottom-6 w-64">{friendsBox}</div>
          <div className="hidden md:block lg:hidden absolute z-20 right-4 bottom-[19rem] w-64">{chatBox}</div>
        </>
      )}

      {/* ---------- MOBILE: chat & friends as sheets ---------- */}
      {!hideChrome && (
        <div className="md:hidden absolute z-20 right-3 top-16 flex flex-col gap-1.5">
          <button
            {...sfx}
            onClick={() => setMobileSheet((s) => (s === 'chat' ? 'none' : 'chat'))}
            className="p-2.5 rounded-xl bg-zinc-950/85 border border-zinc-700 shadow-lg cursor-pointer"
            aria-label="Chat"
          >
            <MessageSquare className="w-4 h-4 text-amber-300" />
          </button>
          <button
            {...sfx}
            onClick={() => setMobileSheet((s) => (s === 'friends' ? 'none' : 'friends'))}
            className="p-2.5 rounded-xl bg-zinc-950/85 border border-zinc-700 shadow-lg cursor-pointer"
            aria-label="Bạn bè"
          >
            <Users className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      )}
      {!hideChrome && mobileSheet !== 'none' && (
        <div className="md:hidden absolute z-40 inset-x-3 top-16">
          <div className="relative">
            <button
              onClick={() => setMobileSheet('none')}
              className="absolute -top-2 -right-1 z-10 p-1 rounded-full bg-zinc-800 border border-zinc-600 cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {mobileSheet === 'chat' ? chatBox : friendsBox}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="absolute z-50 top-16 left-1/2 -translate-x-1/2 max-w-[92vw] px-4 py-2 rounded-xl bg-zinc-950/95 border border-amber-500/70 text-sm font-bold text-amber-100 shadow-2xl text-center">
          {toast}
        </div>
      )}

      {/* ---------- PANELS ---------- */}
      {panel === 'host' && (
        <HostRoomPanel
          map={map}
          drunkSpeed={drunkSpeed}
          rules={rules}
          roomCode={roomCode}
          onClose={() => setPanel('none')}
          onConfirm={(m, s, r) => {
            sound.playBottleOpen();
            setMap(m);
            setDrunkSpeed(s);
            setRules(r);
            setHostName(null);
            setPanel('none');
            showToast(`🔑 Đã mở bàn riêng #${roomCode} — bấm [+] trên ghế trống để rủ nhậu!`);
          }}
        />
      )}
      {panel === 'join' && (
        <JoinCodePanel
          onClose={() => setPanel('none')}
          onJoin={(code) => {
            sound.playBottleOpen();
            setRoomCode(code);
            setHostName(crew[0]?.name || 'Chủ bàn');
            setPanel('none');
            setReady((prev) => ({ ...prev, user: true }));
            inviteWholeCrew();
            setPendingStart(true);
            showToast(`🪑 Đã nhảy vào bàn #${code}! Anh em đang kéo ghế ra ngồi…`);
          }}
        />
      )}
      {panel === 'wardrobe' && (
        <WardrobePanel
          skin={skin}
          name={name}
          onNameChange={setName}
          onChange={setSkin}
          onClose={() => {
            sound.playBottleOpen();
            setPanel('none');
          }}
        />
      )}
      {panel === 'profile' && (
        <ProfilePanel
          name={name || 'Bợm Nhậu'}
          avatar={skin.avatar}
          coins={userTemplate.coins}
          toastCount={userTemplate.drinksCount + 8}
          onClose={() => setPanel('none')}
        />
      )}
      {panel === 'settings' && (
        <SettingsPanel
          volume={volume}
          onVolume={setVolume}
          graphics={graphics}
          onGraphics={setGraphics}
          onClose={() => setPanel('none')}
        />
      )}
      {panel === 'invite' && (
        <InvitePopup
          roomCode={roomCode}
          friends={friends}
          seatedIds={squad.map((m) => m.id)}
          onInvite={(id) => {
            invite(id, inviteSeat);
            setPanel('none');
          }}
          onClose={() => setPanel('none')}
        />
      )}
      {panel === 'auth' && !isLoggedIn && (
        <AuthPanelModal
          isOpen={true}
          onClose={() => setPanel('none')}
          onSuccess={(session) => {
            onAuthSuccess(session);
            setName(session.username);
            setSkin((prev) => ({ ...prev, avatar: session.avatar }));
            setPanel('none');
            showToast(`🍻 Chào mừng ${session.username}! Đã nhận +500 Nắp Bia Tân Thủ!`);
          }}
        />
      )}
    </div>
  );
};
