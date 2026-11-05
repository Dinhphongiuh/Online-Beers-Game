import React, { useEffect, useRef, useState } from 'react';
import {
  Player,
  TableState,
  MinigameId,
  FoodDish,
  CharacterAvatar,
  PubTheme,
  IKHandControlState,
  CharacterEmote,
  DrinkTierId,
  CupPhysicsState,
  ToiletState,
  OpenWorldZoneId,
  HeavyPropType,
} from './game/types';
import { initThreeScene, SceneController } from './game/threeScene';
import { sound } from './game/audio';
import { TopBar } from './components/TopBar';
import { BottomDock } from './components/BottomDock';
import { DrunkEffectOverlay } from './components/DrunkEffectOverlay';
import { CameraAndControlsHUD } from './components/CameraAndControlsHUD';
import { CrocodileGame } from './components/CrocodileGame';
import { SpinBottleGame } from './components/SpinBottleGame';
import { LiarDiceGame } from './components/LiarDiceGame';
import { FifteenTwentyGame } from './components/FifteenTwentyGame';
import { BillFightGame } from './components/BillFightGame';
import { TruthOrDareModal } from './components/TruthOrDareModal';
import { FaceDoodleModal } from './components/FaceDoodleModal';
import { ShopModal } from './components/ShopModal';
import { TableLobbyModal } from './components/TableLobbyModal';
import { AuthPanelModal } from './components/AuthPanelModal';
import { FoodGrabModal, GrabMode, GrabPrecision } from './components/FoodGrabModal';
import { DrinkAndBladderModal, DRINK_TIERS } from './components/DrinkAndBladderModal';
import {
  CheersToastModal,
  ChugStrategy,
  ClinkForceResult,
} from './components/CheersToastModal';
import {
  LivingChaosArenaModal,
  ChaosArenaState,
  DrunkArchetypeId,
  PartyStageId,
  DRUNK_ARCHETYPES,
} from './components/LivingChaosArenaModal';
import {
  OverheadDrunkChatHUD,
  ProcessedDrunkChat,
  processDrunkChat,
} from './components/OverheadDrunkChatHUD';
import {
  PhiQuanMaiAnhCallHUD,
  StopPhiQuanAction,
  KhoaTreeAction,
} from './components/PhiQuanMaiAnhCallHUD';
import { OpenWorldSandboxHUD } from './components/OpenWorldSandboxHUD';
import confetti from 'canvas-confetti';
import { DRUNK_SPEEDS, LobbyConfig, THEME_NAMES } from './lobby/lobbyData';
import type { GraphicsQuality } from './lobby/LobbyPanels';
import { MessageSquare, CloudRain, ShieldAlert, Umbrella } from 'lucide-react';

export const INITIAL_PLAYERS: Player[] = [
  {
    id: 'user',
    name: 'Bợm Nhậu (Bạn)',
    isUser: true,
    avatar: 'dog',
    clothing: 'tanktop_red',
    hat: 'none',
    glassType: 'beer_mug',
    alcoholLevel: 15,
    stamina: 90,
    bladderLevel: 25,
    emptyBottlesCount: 2,
    seatIndex: 0,
    coins: 240,
    gems: 10,
    title: 'Tấm Chiếu Mới',
    isPassedOut: false,
    faceDoodles: [],
    drinksCount: 2,
    foodEatenCount: 0,
  },
  {
    id: 'bot_phiquan',
    name: 'Phi Quân',
    isUser: false,
    avatar: 'panda',
    clothing: 'floral_shirt',
    hat: 'sunglasses',
    glassType: 'coi_glass',
    alcoholLevel: 68, // Sát mốc 80% — chỉ cần Dzô 1-2 ly hoặc bấm nút là rút máy gọi NYC Mai Anh!
    stamina: 80,
    seatIndex: 1,
    coins: 500,
    gems: 20,
    title: 'Gấu Trúc Đô Bất Tử',
    isPassedOut: false,
    faceDoodles: [],
    drinksCount: 5,
    foodEatenCount: 2,
  },
  {
    id: 'bot_khoanguyen',
    name: 'Khoa Nguyễn',
    isUser: false,
    avatar: 'bear',
    clothing: 'tanktop_white',
    hat: 'none',
    glassType: 'beer_mug',
    alcoholLevel: 65, // Sát mốc 80% — đủ 80% sẽ tự rời ghế đi ra leo cây xanh!
    stamina: 95,
    seatIndex: 2,
    coins: 380,
    gems: 15,
    title: 'Gấu Nâu Diệt Mồi',
    isPassedOut: false,
    faceDoodles: [],
    drinksCount: 3,
    foodEatenCount: 5,
  },
  {
    id: 'bot_baonguyen',
    name: 'Bảo Nguyễn',
    isUser: false,
    avatar: 'cat',
    clothing: 'gold_chain',
    hat: 'traffic_helmet',
    glassType: 'horn',
    alcoholLevel: 45,
    stamina: 75,
    seatIndex: 3,
    coins: 850,
    gems: 50,
    title: 'Chúa Tể Trốn Bill',
    isPassedOut: false,
    faceDoodles: [],
    drinksCount: 6,
    foodEatenCount: 1,
  },
  {
    id: 'bot_ngaphan',
    name: 'Nga Phan',
    isUser: false,
    avatar: 'hamster',
    clothing: 'floral_shirt',
    hat: 'none',
    glassType: 'coi_glass',
    alcoholLevel: 0, // Chuột Hamster đuôi dài chỉ uống Coca & phá mồi -> luôn 0% cồn!
    stamina: 100,
    seatIndex: 4,
    coins: 620,
    gems: 30,
    title: 'Uống Coca • Thánh Phá Mồi 🥤',
    isPassedOut: false,
    isColaOnlyDestroyer: true,
    faceDoodles: [],
    drinksCount: 0,
    foodEatenCount: 8,
  },
];

export const INITIAL_DISHES: FoodDish[] = [
  {
    id: 'peanut',
    name: 'Đậu Phộng Rang Tỏi Ớt',
    icon: '🥜',
    servings: 8,
    maxServings: 10,
    alcoholDelta: -8,
    staminaDelta: 12,
    description: 'Giòn rụm bùi béo, xen lẫn ớt hiểm đỏ chót dễ gắp nhầm!',
    price: 25000,
    coinCost: 15,
    spicyRisk: 0.25,
  },
  {
    id: 'chicken_feet',
    name: 'Chân Gà Nướng Mật Ong Sả Tắc',
    icon: '🍗',
    servings: 1, // Ready for immediate "Cướp Miếng Mồi Cuối Cùng" demo!
    maxServings: 6,
    alcoholDelta: -15,
    staminaDelta: 24,
    description: 'Nướng mật ong vàng óng thơm lừng — CÒN ĐÚNG 1 MIẾNG CUỐI!',
    price: 75000,
    coinCost: 30,
    spicyRisk: 0.3,
  },
  {
    id: 'hotpot',
    name: 'Lẩu Thái Tomyum Chua Cay',
    icon: '🍲',
    servings: 6,
    maxServings: 8,
    alcoholDelta: -22,
    staminaDelta: 35,
    description: 'Nước dùng chua cay sôi sùng sục với tôm sú, mực ống, nấm kim châm',
    price: 169000,
    coinCost: 50,
    spicyRisk: 0.35,
  },
  {
    id: 'oc_huong',
    name: 'Ốc Hương Xào Bơ Tỏi',
    icon: '🐚',
    servings: 6,
    maxServings: 7,
    alcoholDelta: -14,
    staminaDelta: 22,
    description: 'Sốt bơ tỏi vàng sánh quyện lá răm, mồi bén số 1 vỉa hè Sài Gòn',
    price: 95000,
    coinCost: 40,
    spicyRisk: 0.15,
  },
  {
    id: 'ca_vien',
    name: 'Cá Viên Chiên Nước Mắm',
    icon: '🍡',
    servings: 5,
    maxServings: 6,
    alcoholDelta: -12,
    staminaDelta: 20,
    description: 'Xiên cá viên, bò viên, đậu bắp sốt mắm tỏi ớt kẹo lại đậm đà',
    price: 55000,
    coinCost: 25,
    spicyRisk: 0.2,
  },
  {
    id: 'xoai_non',
    name: 'Xoài Non Chấm Mắm Ruốc',
    icon: '🥭',
    servings: 7,
    maxServings: 8,
    alcoholDelta: -18,
    staminaDelta: 28,
    description: 'Chua giòn rùng mình tỉnh cả rượu, chấm mắm ruốc sệt cay xè',
    price: 45000,
    coinCost: 20,
    spicyRisk: 0.3,
  },
];

/** Seats the user (with their lobby skin) plus the friends who joined in the lobby. */
function buildTablePlayers(config?: LobbyConfig): Player[] {
  if (!config) return INITIAL_PLAYERS;
  const user: Player = { ...INITIAL_PLAYERS[0], name: config.playerName, ...config.skin };
  const friends = config.squadIds
    .map((id) => INITIAL_PLAYERS.find((p) => p.id === id))
    .filter((p): p is Player => !!p);
  return [user, ...friends].map((p, i) => ({ ...p, seatIndex: i }));
}

export default function App({
  lobbyConfig,
  graphics = 'high',
}: { lobbyConfig?: LobbyConfig; graphics?: GraphicsQuality } = {}) {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneController | null>(null);
  const walkStepCountRef = useRef<number>(0);

  // Table State
  const [tableState, setTableState] = useState<TableState>({
    roomId: lobbyConfig ? `TRẠM-NHẬU-${lobbyConfig.roomCode}` : 'TRẠM-NHẬU-8888',
    theme: lobbyConfig?.theme ?? 'sidewalk',
    themeName: lobbyConfig ? THEME_NAMES[lobbyConfig.theme] : 'Vỉa Hè Đèn Neon Sài Gòn',
    players: buildTablePlayers(lobbyConfig),
    activeMinigame: 'none',
    beerTowerLevel: 90,
    foodDishes: INITIAL_DISHES,
    toastCount: 8,
    isMicCheersActive: false,
    billFightActive: false,
    totalBill: 468000,
  });

  // Physics-based IK Hand, Camera & Open-World Sandbox State Machine
  const [ikState, setIkState] = useState<IKHandControlState>({
    controlMode: 'seated',
    cameraMode: 'seated_3rd',
    aimX: 0,
    aimY: 0,
    isGrabbing: false,
    isCheersHolding: false,
    isDrinkingOrEating: false,
    heldItem: 'beer_mug',
    chairBalance: 0,
    isFallenOffChair: false,
    freeRoamPos: { x: 0, z: 2.35, angle: Math.PI, isMoving: false },
    isHeadbutting: false,
    emote: 'none',
    micVolume: 0,
    coldTowelBuffTimer: 0,
    activeZone: 'street_sidewalk',
    isCrawlingMode: false,
    isFaceplanted: false,
    isHoldingGrabSupport: false,
    carriedHeavyProp: 'none',
    draggingFriendId: null,
    isUrgentPeeRushing: false,
    isChasedByCleaverChef: false,
  });

  const [yellowPeePuddleActive, setYellowPeePuddleActive] = useState(false);
  const [waterSplashActive, setWaterSplashActive] = useState(false);
  const [crowdDecibel, setCrowdDecibel] = useState(32);

  // Cup Liquid & Foam Physics + Ice Bucket State
  const [cupState, setCupState] = useState<CupPhysicsState>({
    drinkId: 'bia_lon',
    liquidLevel: 100,
    foamRatio: 20,
    iceCubes: 1,
    warmSeconds: 0,
    pouredByName: 'Phi Quân',
    isPoisonedCocktail: false,
    poisonIngredients: [],
  });

  // 1-Stall Sidewalk WC Drama State
  const [toiletState, setToiletState] = useState<ToiletState>({
    isOccupied: true,
    occupantName: 'Bảo Nguyễn',
    occupantTimeLeft: 25,
    blockerName: 'Khoa Nguyễn',
    doorThumpCount: 0,
    isHoldingPee: false,
  });

  // Special Drink FX States
  const [craftBeerHallucination, setCraftBeerHallucination] = useState(false);
  const [spotlightVictimName, setSpotlightVictimName] = useState<string | null>(null);
  const [cheatingAlertText, setCheatingAlertText] = useState<string | null>(null);
  const [drinkModalTab, setDrinkModalTab] = useState<'drinks' | 'tricks' | 'wc'>('drinks');
  const [chaosArenaTab, setChaosArenaTab] = useState<'meme_systems' | 'npcs' | 'events' | 'flow'>('meme_systems');
  const [activeChatBubble, setActiveChatBubble] = useState<ProcessedDrunkChat | null>(null);
  const [exCallTargetName, setExCallTargetName] = useState<'Người Yêu Cũ 💔' | 'Sếp Tổng 🤬'>('Người Yêu Cũ 💔');
  const [exCallResultReply, setExCallResultReply] = useState<string | null>(null);

  // State riêng cho tính năng NPC Phi Quân (>= 80% cồn) tự rút máy gọi NYC Mai Anh
  const [phiQuanCallCountdown, setPhiQuanCallCountdown] = useState<number>(0);
  const [phiQuanStopProgress, setPhiQuanStopProgress] = useState<number>(0);
  const [phiQuanLastStopLog, setPhiQuanLastStopLog] = useState<string | null>(null);

  // Living Chaos Arena & 6 Meme Generator Systems State
  const [arenaState, setArenaState] = useState<ChaosArenaState>({
    brokenGlassesCount: 1,
    isKaraokeActive: false,
    karaokeSongName: 'Đắp Mộ Cuộc Tình (Remix Loa Kẹo Kéo)',
    hasHungPhanBuff: false,
    lotteryTickets: ['686868'],
    lastLotteryDraw: null,
    isLotteryWinner: null,
    cauVangAffinity: 35,
    droppedMorselsEatenByDog: 1,
    isRaining: false,
    isTarpPulled: false,
    rainCountdown: 0,
    urbanPatrolActive: false,
    urbanPatrolCountdown: 0,
    neighborBrawlActive: false,
    currentMatchPhase: 1,
    // 6 Meme Generator Systems
    drunkSubtitleBubble: null,
    exCallQTEActive: false,
    exCallCountdown: 0,
    exCallSnatchClicks: 0,
    isLovesickUnderTable: false,
    lovesickTimer: 0,
    wifeCallActive: false,
    wifeCallCountdown: 0,
    wifeCallNoiseLevel: 15,
    isSummonedByWife: false,
    activeArchetype: 'none',
    rainbowPuddleActive: false,
    partyStage: 'sidewalk_stage1',
    karaokeScore: 0,
    karaokeGoldenMicHolder: 'Bợm Nhậu (Bạn)',
  });

  // UI Modals
  const [activeModal, setActiveModal] = useState<
    | 'none'
    | 'shop'
    | 'lobby'
    | 'truth_or_dare'
    | 'face_doodle'
    | 'food_grab'
    | 'drink_bladder'
    | 'cheers_toast'
    | 'chaos_arena'
    | 'auth'
  >('none');
  const [selectedFoodDishId, setSelectedFoodDishId] = useState<string>('peanut');
  const [doodleVictim, setDoodleVictim] = useState<Player | null>(null);
  const [truthDareTarget, setTruthDareTarget] = useState<Player | null>(null);
  const [isBgmActive, setIsBgmActive] = useState(false);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  // Some embeds (iframes/webviews) forbid pointer lock: fall back to drag-to-look
  const [isDragLookFallback, setIsDragLookFallback] = useState(false);

  const userPlayer = tableState.players.find((p) => p.isUser) || tableState.players[0];

  // Toast Notification helper
  const showToast = (msg: string) => {
    setToastNotification(msg);
    setTimeout(() => {
      setToastNotification((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Synchronize Room State to MongoDB & Redis Cache + Heartbeat presence
  useEffect(() => {
    fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: tableState.roomId,
        theme: tableState.theme,
        players: tableState.players,
        totalBill: tableState.totalBill,
      }),
    }).catch(() => null);

    const interval = setInterval(() => {
      fetch(`/api/rooms/${encodeURIComponent(tableState.roomId)}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: userPlayer.id,
          playerName: userPlayer.name,
        }),
      }).catch(() => null);
    }, 25000);

    return () => clearInterval(interval);
  }, [tableState.roomId]);

  // Initialize 3D Scene once
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const scene = initThreeScene();
    sceneRef.current = scene;
    scene.mount(canvasMountRef.current);
    scene.setGraphicsQuality(graphics);
    scene.updatePlayers(tableState.players);
    scene.updateFoodDishes(tableState.foodDishes);

    // Mouse look: click the 3D view to lock the cursor, Esc to release
    scene.onPointerLockChange = (locked: boolean, unavailable?: boolean) => {
      setIsPointerLocked(locked);
      if (unavailable) setIsDragLookFallback(true);
    };

    // Callbacks from 3D raycasting & mouse IK pointer
    scene.onPointerAimChange = (aimX: number, aimY: number) => {
      setIkState((prev) => ({ ...prev, aimX, aimY }));
    };

    scene.onBottleClick = () => {
      scene.spinBottle();
      sound.playDiceShake();
    };

    scene.onFoodClick = (type: string) => {
      sound.playChopstickClack();
      setSelectedFoodDishId(type);
      setActiveModal('food_grab');
    };

    scene.onIceBucketClick = () => {
      sound.playSplash();
      setDrinkModalTab('drinks');
      setActiveModal('drink_bladder');
    };

    scene.onToiletClick = () => {
      sound.playSlap();
      setDrinkModalTab('wc');
      setActiveModal('drink_bladder');
    };

    scene.onCauVangClick = () => {
      sound.playDogBark();
      scene.triggerFeedDog();
      setChaosArenaTab('npcs');
      setActiveModal('chaos_arena');
    };

    scene.onNeighborTableClick = () => {
      sound.playCheer();
      setChaosArenaTab('npcs');
      setActiveModal('chaos_arena');
    };

    scene.onKaraokeSpeakerClick = () => {
      sound.playKaraokeBeat();
      setChaosArenaTab('npcs');
      setActiveModal('chaos_arena');
    };

    scene.onPassedOutFaceClick = (playerId: string) => {
      const p = tableState.players.find((pl) => pl.id === playerId);
      if (p && p.isPassedOut) {
        setDoodleVictim(p);
        setActiveModal('face_doodle');
      }
    };

    scene.onGreenTreeClick = () => {
      scene.triggerTreeShake();
      sound.playSlap();
      setTableState((prev) => {
        const khoa = prev.players.find((pl) => pl.id === 'bot_khoanguyen');
        if (khoa?.isClimbingTree) {
          showToast(
            '🌳📳 RUNG CÂY BẦN BẬT! Khoa Nguyễn ôm chặt ngọn cây hét: "Đừng rung nữa rớt tổ ong mật vô đầu tao bây giờ!"'
          );
          return prev;
        }
        showToast(
          '🌳🐻 Đã chạm vào Cây Bàng Bờ Kè — Khoa Nguyễn vừa chạm 80% cồn và lao ra leo tót lên cây!'
        );
        return {
          ...prev,
          players: prev.players.map((pl) =>
            pl.id === 'bot_khoanguyen'
              ? {
                  ...pl,
                  alcoholLevel: Math.max(82, pl.alcoholLevel),
                  isClimbingTree: true,
                  isPassedOut: false,
                  title: 'Tarzan Gấu Nâu Leo Cây 🌳',
                }
              : pl
          ),
        };
      });
    };

    scene.onOpenKitchenClick = () => {
      sound.playChopstickClack();
      setIkState((prev) => ({
        ...prev,
        controlMode: 'free_roam',
        cameraMode: 'free_roam',
        activeZone: 'open_kitchen',
        freeRoamPos: { x: 4.5, z: -2.6, angle: 0.6, isMoving: false },
      }));
      showToast(
        '🔥🦑 Đã chạy vào Khu Bếp Lộ Thiên! Bấm "Lật Mực & Hàu Trên Vỉ Than" trong bảng Sandbox!'
      );
    };

    scene.onConvenienceATMClick = () => {
      sound.playBell();
      setIkState((prev) => ({
        ...prev,
        controlMode: 'free_roam',
        cameraMode: 'free_roam',
        activeZone: 'convenience_atm',
        freeRoamPos: { x: -4.2, z: -2.8, angle: -0.6, isMoving: false },
      }));
      showToast(
        '🏧🏪 Đã chạy ra Cây ATM 24/7 & Tiệm Tạp Hóa! Rút thêm Nắp Bia hoặc mua Kẹo Giải Rượu!'
      );
    };

    scene.onIndustrialFanClick = () => {
      sound.playHeadbutt();
      setIkState((prev) => {
        const nextProp =
          prev.carriedHeavyProp === 'industrial_fan' ? 'none' : 'industrial_fan';
        showToast(
          nextProp === 'industrial_fan'
            ? '🪭💪 Bạn đã dùng 2 tay nhấc bổng nguyên cây Quạt Công Nghiệp lên đầu! Bấm lần nữa để ném!'
            : '💥🪭 RẦM! Bạn quăng nguyên cây Quạt Công Nghiệp sang bàn đối thủ!'
        );
        return {
          ...prev,
          controlMode: 'free_roam',
          cameraMode: 'free_roam',
          carriedHeavyProp: nextProp,
        };
      });
    };

    return () => {
      scene.destroy();
      sound.stopMicCheers();
    };
  }, []);

  // Sync 3D players, food dishes, WC bulb, Cup Fill Ratio, Rain/Tarp, Karaoke & IK state
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.updatePlayers(tableState.players);
      sceneRef.current.updateFoodDishes(tableState.foodDishes);
      sceneRef.current.setUserDrunkLevel(userPlayer.alcoholLevel);
      sceneRef.current.setUserCupFillRatio(cupState.liquidLevel / 100);
      sceneRef.current.setActiveMinigame(tableState.activeMinigame);
      sceneRef.current.updateIKState(ikState);
      sceneRef.current.setToiletOccupied(
        toiletState.isOccupied || !!toiletState.blockerName
      );
      sceneRef.current.setRainAndTarp(arenaState.isRaining, arenaState.isTarpPulled);
      sceneRef.current.setKaraokeSpeakerActive(arenaState.isKaraokeActive);
      sceneRef.current.setRainbowPuddleActive(arenaState.rainbowPuddleActive);
      sceneRef.current.setYellowPeePuddleActive(yellowPeePuddleActive);
      sceneRef.current.setKaraokeDiscoRoomMode(
        arenaState.partyStage === 'karaoke_stage2'
      );
    }
  }, [
    tableState.players,
    tableState.foodDishes,
    tableState.activeMinigame,
    userPlayer.alcoholLevel,
    cupState.liquidLevel,
    ikState,
    toiletState.isOccupied,
    toiletState.blockerName,
    arenaState.isRaining,
    arenaState.isTarpPulled,
    arenaState.isKaraokeActive,
    arenaState.rainbowPuddleActive,
    yellowPeePuddleActive,
    arenaState.partyStage,
  ]);

  // Warm Beer Timer ("Bia Hầm" after 120s without ice) & 1-Stall WC Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCupState((prev) => {
        if (prev.liquidLevel <= 0 || prev.iceCubes > 0) return prev;
        return { ...prev, warmSeconds: Math.min(180, prev.warmSeconds + 1) };
      });

      setToiletState((prev) => {
        if (!prev.isOccupied) return prev;
        if (prev.occupantTimeLeft <= 1) {
          return {
            ...prev,
            isOccupied: false,
            occupantName: null,
            occupantTimeLeft: 0,
          };
        }
        return { ...prev, occupantTimeLeft: prev.occupantTimeLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Chair Balance Drift when Drunk (>= 65%) & Cold Towel 30s Timer Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setIkState((prev) => {
        const nextColdTowel = Math.max(0, prev.coldTowelBuffTimer - 0.25);
        let nextBalance = prev.chairBalance;
        let nextFallen = prev.isFallenOffChair;

        if (
          prev.controlMode === 'seated' &&
          !prev.isFallenOffChair &&
          userPlayer.alcoholLevel >= 65
        ) {
          // Random drunken sway on plastic stool
          const driftForce =
            ((userPlayer.alcoholLevel - 55) / 45) *
            (Math.random() > 0.48 ? 1 : -1) *
            7.5;
          nextBalance = prev.chairBalance + driftForce;

          if (Math.abs(nextBalance) >= 100) {
            nextFallen = true;
            nextBalance = 0;
            sound.playChairFall();
            showToast(
              '🙃 RẦM! Say quá không giữ thăng bằng [A/D] nên bạn đã ngã lộn cổ khỏi ghế nhựa!'
            );
          }
        } else if (userPlayer.alcoholLevel < 65) {
          nextBalance = prev.chairBalance * 0.85;
        }

        return {
          ...prev,
          coldTowelBuffTimer: nextColdTowel,
          chairBalance: nextBalance,
          isFallenOffChair: nextFallen,
        };
      });
    }, 250);

    return () => clearInterval(interval);
  }, [userPlayer.alcoholLevel]);

  // Countdown for Sudden Street Rain (10s to pull tarp) & Urban Inspection Patrol (10s to retreat table)
  useEffect(() => {
    if (!arenaState.isRaining && !arenaState.urbanPatrolActive) return;
    const timer = setInterval(() => {
      setArenaState((prev) => {
        let nextRainCount = prev.rainCountdown;
        let nextRaining = prev.isRaining;
        if (prev.isRaining && !prev.isTarpPulled) {
          if (prev.rainCountdown <= 1) {
            nextRainCount = 0;
            nextRaining = false;
            showToast(
              '🌧️💦 Không kéo bạt kịp! Nước mưa làm loãng hết bia trên bàn (Uống nhạt thếch -10 Tỉnh Táo)!'
            );
          } else {
            nextRainCount = prev.rainCountdown - 1;
          }
        }

        let nextPatrolCount = prev.urbanPatrolCountdown;
        let nextPatrol = prev.urbanPatrolActive;
        if (prev.urbanPatrolActive) {
          if (prev.urbanPatrolCountdown <= 1) {
            nextPatrolCount = 0;
            nextPatrol = false;
            showToast(
              '🚨👮 Đội Kiểm Tra Đô Thị đã tới! Bàn chưa bê lùi vào vạch sơn trắng nên bị rớt mất 2 phần mồi!'
            );
            setTableState((ts) => ({
              ...ts,
              foodDishes: ts.foodDishes.map((d, idx) =>
                idx === 0 ? { ...d, servings: Math.max(0, d.servings - 2) } : d
              ),
            }));
          } else {
            nextPatrolCount = prev.urbanPatrolCountdown - 1;
          }
        }

        return {
          ...prev,
          isRaining: nextRaining,
          rainCountdown: nextRainCount,
          urbanPatrolActive: nextPatrol,
          urbanPatrolCountdown: nextPatrolCount,
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [arenaState.isRaining, arenaState.isTarpPulled, arenaState.urbanPatrolActive]);

  // Countdown for Drunk Dialing Ex-Lover QTE (10s), Lovesick Under Table (30s) & Wife Call Stealth (8s)
  useEffect(() => {
    if (
      !arenaState.exCallQTEActive &&
      !arenaState.isLovesickUnderTable &&
      !arenaState.wifeCallActive
    ) {
      return;
    }

    const timer = setInterval(() => {
      setArenaState((prev) => {
        let nextExActive = prev.exCallQTEActive;
        let nextExCount = prev.exCallCountdown;
        let nextLovesick = prev.isLovesickUnderTable;
        let nextLovesickTimer = prev.lovesickTimer;

        if (prev.exCallQTEActive) {
          if (prev.exCallCountdown <= 1) {
            nextExActive = false;
            nextExCount = 0;
            nextLovesick = true;
            nextLovesickTimer = 30;
            sound.playChairFall();
            const replyMsg =
              exCallTargetName === 'Sếp Tổng 🤬'
                ? '🤬 Sếp Tổng: "MAI LÊN PHÒNG NHÂN SỰ GẶP TÔI! ĐUỔI VIỆC!"'
                : '💔 Người Yêu Cũ: "ĐỒ ĐIÊN! ĐỪNG LÀM PHIỀN TÔI NỮA! BLOCK!"';
            setExCallResultReply(replyMsg);
            setTimeout(() => setExCallResultReply(null), 6500);
            showToast(
              `😭💔 ĐÃ GỬI ✔️ — ${replyMsg} Bạn chui xuống gầm bàn ngồi khóc dưới đám mây đen "SUY TÌNH" suốt 30 giây!`
            );
          } else {
            nextExCount = prev.exCallCountdown - 1;
          }
        } else if (prev.isLovesickUnderTable) {
          if (prev.lovesickTimer <= 1) {
            nextLovesick = false;
            nextLovesickTimer = 0;
            showToast('🌤️ Đã hết 30 giây Suy Tình dưới gầm bàn! Lau nước mắt ngồi dậy nhậu tiếp!');
          } else {
            nextLovesickTimer = prev.lovesickTimer - 1;
          }
        }

        let nextWifeActive = prev.wifeCallActive;
        let nextWifeCount = prev.wifeCallCountdown;
        let nextWifeNoise = prev.wifeCallNoiseLevel;
        let nextSummoned = prev.isSummonedByWife;

        if (prev.wifeCallActive) {
          // Friends randomly try to shout "Em ơi tính tiền!" or "Châm thêm đá!"
          const friendNoiseSpike = Math.random() < 0.55 ? 16 : 6;
          nextWifeNoise = Math.min(100, prev.wifeCallNoiseLevel + friendNoiseSpike);

          if (nextWifeNoise >= 80) {
            nextWifeActive = false;
            nextWifeCount = 0;
            nextSummoned = true;
            sound.playHeadbutt();
            showToast(
              '🩴💥 LỘ RỒI! Thằng bạn hét "Em ơi thêm két bia!" vào điện thoại — Nóc Nhà phóng Chiếc Dép Tổ Ong Khổng Lồ bay xuyên màn hình triệu hồi bạn về nhà!'
            );
            setTimeout(() => {
              setArenaState((s) => ({ ...s, isSummonedByWife: false }));
            }, 6000);
          } else if (prev.wifeCallCountdown <= 1) {
            nextWifeActive = false;
            nextWifeCount = 0;
            sound.playCheer();
            showToast(
              '🤫✅ QUA MẶT NÓC NHÀ THÀNH CÔNG! "Anh đang tăng ca ở công ty êm ru nè vợ ơi!" (+45 Nắp Bia)!'
            );
            setTableState((ts) => ({
              ...ts,
              players: ts.players.map((p) =>
                p.isUser ? { ...p, coins: p.coins + 45 } : p
              ),
            }));
          } else {
            nextWifeCount = prev.wifeCallCountdown - 1;
          }
        }

        return {
          ...prev,
          exCallQTEActive: nextExActive,
          exCallCountdown: nextExCount,
          isLovesickUnderTable: nextLovesick,
          lovesickTimer: nextLovesickTimer,
          wifeCallActive: nextWifeActive,
          wifeCallCountdown: nextWifeCount,
          wifeCallNoiseLevel: nextWifeNoise,
          isSummonedByWife: nextSummoned,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [
    arenaState.exCallQTEActive,
    arenaState.isLovesickUnderTable,
    arenaState.wifeCallActive,
    exCallTargetName,
  ]);

  // ============================================================================
  // TÍNH NĂNG RIÊNG CHO NPC PHI QUÂN: ĐỦ 80% CỒN LẬP TỨC RÚT MÁY GỌI NYC MAI ANH
  // ============================================================================
  const phiQuanPlayer = tableState.players.find((p) => p.id === 'bot_phiquan');

  // Auto-trigger the moment Phi Quân hits >= 80% alcohol!
  useEffect(() => {
    if (!phiQuanPlayer) return;
    if (
      phiQuanPlayer.alcoholLevel >= 80 &&
      !phiQuanPlayer.isCallingMaiAnh &&
      !phiQuanPlayer.isHeartbrokenMaiAnh &&
      !phiQuanPlayer.isPassedOut
    ) {
      sound.playBell();
      setPhiQuanCallCountdown(12);
      setPhiQuanStopProgress(0);
      setPhiQuanLastStopLog(null);
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.id === 'bot_phiquan'
            ? {
                ...p,
                isCallingMaiAnh: true,
                title: 'Đang Gọi NYC Mai Anh 💔',
              }
            : p
        ),
      }));
      showToast(
        '🐼📱 BÁO ĐỘNG! Phi Quân vừa chạm mốc 80% độ cồn và lập tức rút máy gọi cho NYC MAI ANH! Mau cản Phi Quân ngay!'
      );
    }
  }, [
    phiQuanPlayer?.alcoholLevel,
    phiQuanPlayer?.isCallingMaiAnh,
    phiQuanPlayer?.isHeartbrokenMaiAnh,
    phiQuanPlayer?.isPassedOut,
  ]);

  // 12-Second Countdown while Phi Quân is on the phone with NYC Mai Anh
  useEffect(() => {
    if (!phiQuanPlayer?.isCallingMaiAnh) return;

    const timer = setInterval(() => {
      setPhiQuanCallCountdown((prev) => {
        if (prev <= 1) {
          // Failed to stop Phi Quân in time -> Mai Anh blocks him!
          sound.playChairFall();
          setTableState((ts) => ({
            ...ts,
            players: ts.players.map((p) =>
              p.id === 'bot_phiquan'
                ? {
                    ...p,
                    isCallingMaiAnh: false,
                    isHeartbrokenMaiAnh: true,
                    title: 'Bị Mai Anh Block 😭',
                  }
                : p
            ),
          }));
          showToast(
            '💔😭 KHÔNG CẢN KỊP! Mai Anh mắng Phi Quân: "Đồ Gấu Trúc nát rượu! Đừng gọi đòi dép tổ ong nữa, BLOCK!"'
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phiQuanPlayer?.isCallingMaiAnh]);

  const handleForcePhiQuan80Percent = () => {
    sound.playGulp();
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === 'bot_phiquan'
          ? {
              ...p,
              alcoholLevel: Math.max(82, p.alcoholLevel),
              isCallingMaiAnh: false,
              isHeartbrokenMaiAnh: false,
              isPassedOut: false,
            }
          : p
      ),
    }));
  };

  const triggerPlayerComfortSpeechForPhiQuan = () => {
    const comfortLine = 'Đừng nhớ Mai Anh nữa nhớ em nè';
    const processed = processDrunkChat(comfortLine, userPlayer.alcoholLevel);
    const bubble: ProcessedDrunkChat = {
      ...processed,
      rawText: comfortLine,
      displayText: 'Đừng nhớ Mai Anh nữa nhớ em nè ❤️',
      wasKeywordMutated: false,
    };
    setActiveChatBubble(bubble);
    sound.playAnimaleseBlip(70, userPlayer.alcoholLevel);
    setTimeout(() => sound.playAnimaleseBlip(78, userPlayer.alcoholLevel), 140);
    setTimeout(() => sound.playAnimaleseBlip(84, userPlayer.alcoholLevel), 280);
  };

  const handleStopPhiQuanAction = (action: StopPhiQuanAction) => {
    if (!phiQuanPlayer?.isCallingMaiAnh) return;

    let deltaStop = 35;
    let actionMsg = '';

    if (action === 'comfort_nho_em_ne') {
      sound.playCheer();
      triggerPlayerComfortSpeechForPhiQuan();
      deltaStop = 100;
      actionMsg =
        '🍻❤️ Bạn vỗ vai Phi Quân nói: "Đừng nhớ Mai Anh nữa nhớ em nè" làm Gấu Trúc đỏ mặt tắt máy cái rụp (+100%)!';
    } else if (action === 'stuff_chicken_foot') {
      sound.playChopstickClack();
      sceneRef.current?.triggerChopstickGrab('chicken_feet', 'bot_phiquan', false);
      deltaStop = 35;
      actionMsg =
        '🥢 Nhét nguyên cái chân gà sả tắc vào mồm Gấu Trúc làm Phi Quân ú ớ không nói được (+35%)!';
    } else if (action === 'toss_phone_hotpot') {
      sound.playSplash();
      deltaStop = 40;
      actionMsg =
        '🍲 Lao sang giật điện thoại trên tay Phi Quân dọa ném vào nồi Lẩu Thái sôi sùng sục (+40%)!';
    } else if (action === 'fake_girl_voice') {
      sound.playLaugh();
      deltaStop = 35;
      actionMsg =
        '🗣️ Ghé mồm vào mic hét: "Anh Quân ơi vào tắm đi anh!" làm Mai Anh tự dập máy (+35%)!';
    } else if (action === 'dump_ice_bucket') {
      sound.playSplash();
      sceneRef.current?.triggerThrowAtFriend();
      deltaStop = 50;
      actionMsg =
        '🧊 Úp nguyên xô đá lạnh lên đầu làm Phi Quân giật bắn người rớt điện thoại (+50%)!';
    }

    const nextProgress = Math.min(100, phiQuanStopProgress + deltaStop);
    setPhiQuanStopProgress(nextProgress);
    setPhiQuanLastStopLog(actionMsg);

    if (nextProgress >= 100) {
      sound.playCheer();
      confetti({ particleCount: 65, spread: 80, origin: { y: 0.55 } });
      setPhiQuanCallCountdown(0);
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) => {
          if (p.id === 'bot_phiquan') {
            return {
              ...p,
              isCallingMaiAnh: false,
              isHeartbrokenMaiAnh: false,
              alcoholLevel: 62, // Hạ bớt cồn sau khi tỉnh rượu để không tự gọi lại ngay lập tức
              title:
                action === 'comfort_nho_em_ne'
                  ? 'Quên Mai Anh Nhớ Bạn ❤️'
                  : 'Gấu Trúc Tỉnh Ngộ',
            };
          }
          if (p.isUser) {
            return {
              ...p,
              coins: p.coins + 50,
              title: 'Ân Nhân Cứu Phi Quân',
            };
          }
          return p;
        }),
      }));
      if (action === 'comfort_nho_em_ne') {
        showToast(
          '🍻💖 Bạn vỗ vai Phi Quân: "Đừng nhớ Mai Anh nữa nhớ em nè!" — Phi Quân cảm động cất điện thoại luôn và tặng bạn +50 Nắp Bia!'
        );
      } else {
        showToast(
          '🎉🛡️ CẢN PHI QUÂN THÀNH CÔNG! Đã tắt máy trước khi bị Mai Anh chửi — Phi Quân ôm bạn cảm kích tặng +50 Nắp Bia!'
        );
      }
    } else {
      showToast(`⚡ ${actionMsg}`);
    }
  };

  const handleComfortHeartbrokenPhiQuan = () => {
    sound.playCheer();
    confetti({ particleCount: 45, spread: 70, origin: { y: 0.6 } });
    triggerPlayerComfortSpeechForPhiQuan();
    setPhiQuanCallCountdown(0);
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) => {
        if (p.id === 'bot_phiquan') {
          return {
            ...p,
            isHeartbrokenMaiAnh: false,
            isCallingMaiAnh: false,
            alcoholLevel: 60,
            title: 'Quên Mai Anh Nhớ Bạn ❤️',
          };
        }
        if (p.isUser) {
          return {
            ...p,
            coins: p.coins + 35,
          };
        }
        return p;
      }),
    }));
    showToast(
      '🍻💖 Bạn vỗ vai Phi Quân an ủi: "Đừng nhớ Mai Anh nữa nhớ em nè" — Phi Quân lau nước mắt cười tít mắt (+35 Nắp Bia)!'
    );
  };

  // ============================================================================
  // TÍNH NĂNG RIÊNG CHO NPC KHOA NGUYỄN (GẤU NÂU): ĐỦ 80% CỒN TỰ ĐI RA LEO CÂY XANH
  // ============================================================================
  const khoaNguyenPlayer = tableState.players.find(
    (p) => p.id === 'bot_khoanguyen'
  );

  // Auto-trigger the moment Khoa Nguyễn reaches >= 80% alcohol!
  useEffect(() => {
    if (!khoaNguyenPlayer) return;
    if (
      khoaNguyenPlayer.alcoholLevel >= 80 &&
      !khoaNguyenPlayer.isClimbingTree &&
      !khoaNguyenPlayer.isPassedOut
    ) {
      sound.playLaugh();
      sceneRef.current?.triggerTreeShake();
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.id === 'bot_khoanguyen'
            ? {
                ...p,
                isClimbingTree: true,
                title: 'Tarzan Gấu Nâu Leo Cây 🌳',
              }
            : p
        ),
      }));
      showToast(
        '🐻🌳 BẢN NĂNG GẤU NÂU TRỖI DẬY! Khoa Nguyễn vừa chạm 80% độ cồn liền đứng phắt dậy đi ra leo tót lên Cây Xanh bên cạnh bàn!'
      );
    }
  }, [
    khoaNguyenPlayer?.alcoholLevel,
    khoaNguyenPlayer?.isClimbingTree,
    khoaNguyenPlayer?.isPassedOut,
  ]);

  const handleForceKhoaNguyen80Percent = () => {
    sound.playGulp();
    sound.playLaugh();
    sceneRef.current?.triggerTreeShake();
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === 'bot_khoanguyen'
          ? {
              ...p,
              alcoholLevel: Math.max(82, p.alcoholLevel),
              isClimbingTree: true,
              isPassedOut: false,
              title: 'Tarzan Gấu Nâu Leo Cây 🌳',
            }
          : p
      ),
    }));
    showToast(
      '🐻🌳 BẢN NĂNG GẤU NÂU TRỖI DẬY! Khoa Nguyễn vừa chạm 80% độ cồn liền đứng phắt dậy chạy ra leo tót lên Cây Xanh!'
    );
  };

  const handleGetKhoaDownFromTree = (action: KhoaTreeAction) => {
    sceneRef.current?.triggerTreeShake();
    let msg = '';
    if (action === 'shake_tree') {
      sound.playChairFall();
      msg =
        '📳🌳 Cả bàn xúm lại rung cây bàng bần bật làm Khoa Nguyễn tuột tay tụt xuống về lại ghế nhựa (+35 Nắp Bia)!';
    } else if (action === 'honey_chicken_lure') {
      sound.playChopstickClack();
      msg =
        '🍯🍗 Giơ đĩa Chân Gà Nướng Mật Ong thơm phức ra dụ — Gấu Nâu Khoa Nguyễn sáng mắt tụt xuống bàn ngay (+35 Nắp Bia)!';
    } else if (action === 'fire_ants_scare') {
      sound.playLaugh();
      msg =
        '🐜🔥 Hét lớn: "Trên cành cây có ổ kiến vàng lửa kìa Khoa ơi!" làm Khoa Nguyễn nhảy phắt xuống đất (+35 Nắp Bia)!';
    } else {
      sound.playSlap();
      msg =
        '🧹😂 Mượn chổi lông gà của bà chủ quán Tư Đực khều vào mông làm Khoa Nguyễn cười nhột tụt xuống (+35 Nắp Bia)!';
    }

    confetti({ particleCount: 45, spread: 70, origin: { y: 0.6 } });
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) => {
        if (p.id === 'bot_khoanguyen') {
          return {
            ...p,
            isClimbingTree: false,
            alcoholLevel: 58, // Hạ độ cồn xuống dưới 80% sau khi leo cây cho tỉnh rượu
            title: 'Gấu Nâu Diệt Mồi',
          };
        }
        if (p.isUser) {
          return {
            ...p,
            coins: p.coins + 35,
          };
        }
        return p;
      }),
    }));
    showToast(msg);
  };

  // ============================================================================
  // TÍNH NĂNG RIÊNG CHO NPC NGA PHAN (CHUỘT HAMSTER ĐUÔI DÀI - CHỈ UỐNG COCA 0% CỒN & PHÁ MỒI)
  // ============================================================================
  const ngaPhanPlayer = tableState.players.find((p) => p.id === 'bot_ngaphan');

  const handleTriggerNgaPhanDestroyFood = () => {
    sound.playChopstickClack();
    sound.playGulp();
    setTableState((prev) => {
      const availableDishes = prev.foodDishes.filter((d) => d.servings > 0);
      const targetDish =
        availableDishes.length > 0
          ? availableDishes[Math.floor(Math.random() * availableDishes.length)]
          : prev.foodDishes[0];

      if (targetDish) {
        sceneRef.current?.triggerChopstickGrab(targetDish.id, 'bot_ngaphan', false);
      }

      const updatedDishes = prev.foodDishes.map((d) =>
        targetDish && d.id === targetDish.id
          ? { ...d, servings: Math.max(1, d.servings - 1) }
          : d
      );

      const updatedPlayers = prev.players.map((p) =>
        p.id === 'bot_ngaphan' || p.isColaOnlyDestroyer
          ? {
              ...p,
              alcoholLevel: 0, // Luôn luôn 0% cồn vì chỉ uống Coca!
              isPassedOut: false,
              foodEatenCount: (p.foodEatenCount || 0) + 1,
              title: 'Uống Coca • Thánh Phá Mồi 🥤',
            }
          : p
      );

      showToast(
        `🐹🥤 Nga Phan vẫy chiếc đuôi dài, hút rột rột ly Coca đá (0% Cồn) rồi phóng đũa gắp sạch miếng ${
          targetDish?.name || 'mồi ngon'
        }!`
      );

      return {
        ...prev,
        foodDishes: updatedDishes,
        players: updatedPlayers,
      };
    });
  };

  // Định kỳ mỗi 24s Chuột Hamster Nga Phan tự động hút Coca & gắp mồi (luôn giữ 0% cồn)
  useEffect(() => {
    const timer = setInterval(() => {
      if (activeModal !== 'none') return;
      setTableState((prev) => {
        const hasNgaPhan = prev.players.some((p) => p.id === 'bot_ngaphan');
        if (!hasNgaPhan) return prev;
        const availableDishes = prev.foodDishes.filter((d) => d.servings > 1);
        const targetDish =
          availableDishes[Math.floor(Math.random() * availableDishes.length)] ||
          prev.foodDishes[0];
        if (targetDish) {
          sceneRef.current?.triggerChopstickGrab(targetDish.id, 'bot_ngaphan', false);
        }
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === 'bot_ngaphan' || p.isColaOnlyDestroyer
              ? {
                  ...p,
                  alcoholLevel: 0,
                  isPassedOut: false,
                  foodEatenCount: (p.foodEatenCount || 0) + 1,
                }
              : p
          ),
        };
      });
    }, 24000);
    return () => clearInterval(timer);
  }, [activeModal]);

  // ============================================================================
  // QUÁN NHẬU OPEN-WORLD SANDBOX HANDLERS (4 ZONES, RAGDOLL, PROPS & OFF-TABLE EVENTS)
  // ============================================================================
  const handleNavigateZone = (zone: OpenWorldZoneId) => {
    sound.playDiceShake();
    const zoneCoords: Record<
      OpenWorldZoneId,
      { x: number; z: number; angle: number; label: string }
    > = {
      street_sidewalk: {
        x: 0,
        z: 2.35,
        angle: Math.PI,
        label: '🛣️ Khu Vỉa Hè & Lòng Đường (Bàn chính, xe cá viên, xe máy chạy qua)',
      },
      open_kitchen: {
        x: 4.5,
        z: -2.6,
        angle: 0.6,
        label: '🔥 Khu Bếp Lộ Thiên (Bếp than hồng nướng mực & hàu mỡ hành)',
      },
      restroom_alley: {
        // In front of the WC booth (moved left of the neon sign)
        x: -3.35,
        z: -1.35,
        angle: -2.3,
        label: '🚽 Khu Vệ Sinh & Góc Tối (Giải quyết bụng bia, trốn bill, móc túi)',
      },
      convenience_atm: {
        x: -4.2,
        z: -2.8,
        angle: -0.6,
        label: '🏧 Khu Tạp Hóa & Cây ATM 24/7 (Rút tiền, mua kẹo cao su giải rượu)',
      },
    };
    const target = zoneCoords[zone];
    // Vận động đi lại giữa các khu vực hóng gió bờ kè giúp toát mồ hôi giải bớt cồn & tăng thể lực!
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.isUser && p.alcoholLevel > 0
          ? {
              ...p,
              alcoholLevel: Math.max(0, p.alcoholLevel - 4),
              stamina: Math.min(100, p.stamina + 8),
            }
          : p
      ),
    }));
    setIkState((prev) => ({
      ...prev,
      controlMode: 'free_roam',
      cameraMode: 'free_roam',
      activeZone: zone,
      isFallenOffChair: false,
      freeRoamPos: {
        x: target.x,
        z: target.z,
        angle: target.angle,
        isMoving: false,
      },
    }));
    showToast(`🗺️ Đã di chuyển sang: ${target.label} (Đi bộ hóng gió giải bớt 4% cồn, +8% Tỉnh táo)!`);
  };

  const handleToggleCrawlingMode = () => {
    sound.playSlap();
    setIkState((prev) => {
      const next = !prev.isCrawlingMode;
      showToast(
        next
          ? '🐢 Đã bật chế độ "BÒ LÊ BÒ LẾT" bằng tứ chi! Đi chậm nhưng BẤT TỬ 100% trước xe máy & đòn đánh tầm ngang!'
          : '🧍 Đã đứng thẳng dậy khỏi chế độ bò tứ chi!'
      );
      return {
        ...prev,
        controlMode: 'free_roam',
        cameraMode: 'free_roam',
        isCrawlingMode: next,
        isFaceplanted: false,
      };
    });
  };

  const handleToggleGrabSupport = () => {
    sound.playChopstickClack();
    setIkState((prev) => {
      const next = !prev.isHoldingGrabSupport;
      showToast(
        next
          ? '🫲 Đã giữ nút "BÁM VỊN"! Hai bàn tay bám chặt vào tường/bậc thềm giúp không bị ngã sấp mặt khi say!'
          : '🖐️ Đã buông tay khỏi điểm bám vịn!'
      );
      return {
        ...prev,
        controlMode: 'free_roam',
        cameraMode: 'free_roam',
        isHoldingGrabSupport: next,
      };
    });
  };

  const handleRecoverFaceplant = () => {
    sound.playSlap();
    setIkState((prev) => {
      const shouldCrawl = userPlayer.alcoholLevel > 85;
      showToast(
        shouldCrawl
          ? '🐢 Độ cồn > 85% chân tay mềm oặt! Bạn tự động chuyển sang "Bò Lê Bò Lết" bằng tứ chi!'
          : '🤕 Đã chống tay bò dậy sau cú ngã sấp mặt (Faceplant)!'
      );
      return {
        ...prev,
        isFaceplanted: false,
        isCrawlingMode: shouldCrawl ? true : prev.isCrawlingMode,
      };
    });
  };

  const handleTriggerDrunkInputDriftStep = () => {
    // Vận động đi lại toát mồ hôi giúp giải bớt 1% cồn
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.isUser && p.alcoholLevel > 0
          ? {
              ...p,
              alcoholLevel: Math.max(0, p.alcoholLevel - 1),
              stamina: Math.min(100, p.stamina + 2),
            }
          : p
      ),
    }));

    setIkState((prev) => {
      const driftAngle = (Math.random() - 0.5) * 1.4;
      const dx = Math.sin(driftAngle) * 0.45;
      const dz = -Math.cos(driftAngle) * 0.35;
      const nx = Math.max(-4.8, Math.min(4.8, prev.freeRoamPos.x + dx));
      const nz = Math.max(-3.6, Math.min(3.8, prev.freeRoamPos.z + dz));

      // If not holding Grab Support and either drunk or unlucky, trip over a beer crate -> Faceplant!
      const tripChance = prev.isHoldingGrabSupport
        ? 0
        : userPlayer.alcoholLevel >= 60
        ? 0.75
        : 0.45;
      const tripped = !prev.isCrawlingMode && Math.random() < tripChance;

      if (tripped) {
        sound.playChairFall();
        if (prev.isUrgentPeeRushing) {
          setYellowPeePuddleActive(true);
          showToast(
            '💦🤸 TÉ SẤP MẶT KHI ĐANG ÔM BỤNG CHẠY ĐI WC! Bạn để lại một vũng nước vàng óng trơn trượt ngay trên vỉa hè!'
          );
        } else {
          showToast(
            '🤸💥 NGÃ SẤP MẶT (FACEPLANT)! Bước đi loạng choạng bị Input Drift bẻ lái vấp trúng két bia ngã cái RẦM!'
          );
        }
      } else {
        sound.playDiceShake();
        showToast(
          prev.isHoldingGrabSupport
            ? '🫲 Nhờ giữ nút Bám Vịn nên dù đi loạng choạng bạn vẫn không bị vấp két bia (Vận động giải -1% cồn)!'
            : '🥴 Bước chân lảo đảo trên vỉa hè — Vận động đi lại toát mồ hôi giúp giải bớt -1% cồn!'
        );
      }

      return {
        ...prev,
        controlMode: 'free_roam',
        cameraMode: 'free_roam',
        isFaceplanted: tripped,
        isCrawlingMode:
          tripped && userPlayer.alcoholLevel > 85 ? true : prev.isCrawlingMode,
        isUrgentPeeRushing: tripped ? false : prev.isUrgentPeeRushing,
        freeRoamPos: {
          x: nx,
          z: nz,
          angle: Math.atan2(dx, dz),
          isMoving: !tripped,
        },
      };
    });
  };

  const handleKitchenFlipGrill = () => {
    const burned = Math.random() < 0.42;
    if (burned) {
      sound.playHeadbutt();
      setIkState((prev) => ({
        ...prev,
        controlMode: 'free_roam',
        cameraMode: 'free_roam',
        activeZone: 'open_kitchen',
        isChasedByCleaverChef: true,
      }));
      showToast(
        '🔪🔥 CHÁY KHÉT LẸT RỒI! Bạn lật vỉ nướng quá tay làm mực khô bốc lửa đen thui — Ông Chủ Quán vác DAO PHAY rượt chém khắp quán!'
      );
      setTimeout(() => {
        setIkState((prev) => ({ ...prev, isChasedByCleaverChef: false }));
      }, 6500);
    } else {
      sound.playCheer();
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 } });
      setTableState((prev) => ({
        ...prev,
        foodDishes: prev.foodDishes.map((d, idx) =>
          idx === 0 || idx === 3
            ? { ...d, servings: Math.min(d.maxServings, d.servings + 2) }
            : d
        ),
        players: prev.players.map((p) =>
          p.isUser
            ? {
                ...p,
                coins: p.coins + 35,
                stamina: Math.min(100, p.stamina + 18),
                alcoholLevel: Math.max(0, p.alcoholLevel - 10),
                title: 'Bếp Trưởng Nướng Mực 🦑',
              }
            : p
        ),
      }));
      showToast(
        '🦑🦪 THƠM NỨC MŨI! Bạn tự tay lật mực nướng & hàu mỡ hành chín vàng ươm trên bếp than hồng (+2 phần mồi, +35 Nắp Bia)!'
      );
    }
  };

  const handleAlleySneakAction = (
    action: 'dodge_bill' | 'pickpocket_friend' | 'ambush_wc'
  ) => {
    setIkState((prev) => ({
      ...prev,
      controlMode: 'free_roam',
      cameraMode: 'free_roam',
      activeZone: 'restroom_alley',
      freeRoamPos: { x: -3.35, z: -1.35, angle: -2.3, isMoving: false },
    }));

    if (action === 'dodge_bill') {
      sound.playLaugh();
      setTableState((prev) => ({
        ...prev,
        totalBill: Math.max(0, prev.totalBill - 180000),
        players: prev.players.map((p) =>
          p.isUser ? { ...p, title: 'Chúa Tể Trốn Bill Hẻm Tối 🥷' } : p
        ),
      }));
      showToast(
        '🥷💨 Giả vờ đi vệ sinh rồi lén trốn trong Góc Tối Hẻm WC! Đẩy thành công 180.000đ tiền Bill sang cho Bảo Nguyễn!'
      );
    } else if (action === 'pickpocket_friend') {
      sound.playBell();
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, coins: p.coins + 55 } : p
        ),
      }));
      showToast(
        '👛🤫 Nhân lúc góc hẻm WC tối om, bạn móc túi đồng đội đang đứng dựa tường thu gọn +55 Nắp Bia!'
      );
    } else {
      sound.playHeadbutt();
      const hitName = sceneRef.current?.triggerThrowAtFriend();
      showToast(
        `🥊💥 ĐÁNH LÉN GÓC TỐI! Bạn phục kích ngay cửa WC vỗ gáy ${
          hitName || 'đồng đội'
        } làm nó choáng váng!`
      );
    }
  };

  const handleAtmStoreAction = (
    action: 'withdraw_atm' | 'buy_sober_gum' | 'buy_night_snacks'
  ) => {
    setIkState((prev) => ({
      ...prev,
      controlMode: 'free_roam',
      cameraMode: 'free_roam',
      activeZone: 'convenience_atm',
      freeRoamPos: { x: -4.2, z: -2.8, angle: -0.6, isMoving: false },
    }));

    if (action === 'withdraw_atm') {
      sound.playBell();
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.65 } });
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser
            ? { ...p, coins: p.coins + 120, title: 'Đại Gia Rút Cây ATM 🏧' }
            : p
        ),
      }));
      showToast(
        '🏧💵 TÍT TÍT! Đã quẹt thẻ tại Cây ATM 24/7 góc phố rút nóng +120 Nắp Bia về chiến tiếp!'
      );
    } else if (action === 'buy_sober_gum') {
      sound.playGulp();
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser
            ? {
                ...p,
                coins: Math.max(0, p.coins - 20),
                alcoholLevel: Math.max(0, p.alcoholLevel - 25),
                stamina: Math.min(100, p.stamina + 20),
              }
            : p
        ),
      }));
      showToast(
        '🍬🌿 Đã mua Kẹo Cao Su Giải Rượu Cấp Tốc tại Tiệm Tạp Hóa (-25% Độ Cồn, +20% Tỉnh Táo, hơi thở thơm mát)!'
      );
    } else {
      sound.playChopstickClack();
      setTableState((prev) => ({
        ...prev,
        foodDishes: prev.foodDishes.map((d) => ({
          ...d,
          servings: Math.min(d.maxServings, d.servings + 2),
        })),
        players: prev.players.map((p) =>
          p.isUser ? { ...p, coins: Math.max(0, p.coins - 25) } : p
        ),
      }));
      showToast(
        '🦑🛒 Đã mua Khô Mực & Đậu Phộng từ Tiệm Tạp Hóa 24/7 bồi thêm +2 phần cho toàn bộ đĩa mồi trên bàn!'
      );
    }
  };

  const handleCarryOrThrowHeavyProp = (prop: HeavyPropType) => {
    const isAlreadyCarrying = ikState.carriedHeavyProp === prop;
    if (isAlreadyCarrying) {
      // Throw the heavy prop at the neighbor table!
      sound.playHeadbutt();
      sound.playMugSlam();
      sceneRef.current?.triggerFlipNeighborTable();
      setIkState((prev) => ({ ...prev, carriedHeavyProp: 'none' }));
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, coins: p.coins + 45, title: 'Thần Lực Ném Quạt 🪭' } : p
        ),
      }));
      const propLabel =
        prop === 'industrial_fan'
          ? 'Cây Quạt Máy Công Nghiệp'
          : prop === 'ice_bucket_giant'
          ? 'Thùng Nước Đá Khổng Lồ'
          : 'Ghế Nhựa Đỏ';
      showToast(
        `💥🪭 RẦM! Bạn vung 2 tay ném nguyên ${propLabel} bay thẳng sang dằn mặt bàn bên cạnh (+45 Nắp Bia)!`
      );
    } else {
      sound.playSlap();
      setIkState((prev) => ({
        ...prev,
        controlMode: 'free_roam',
        cameraMode: 'free_roam',
        carriedHeavyProp: prop,
      }));
      const propLabel =
        prop === 'industrial_fan'
          ? 'Cây Quạt Máy Công Nghiệp'
          : prop === 'ice_bucket_giant'
          ? 'Thùng Nước Đá Khổng Lồ'
          : 'Ghế Nhựa Đỏ';
      showToast(
        `💪 Đã dùng 2 tay ôm bổng ${propLabel} lên đầu! Bấm nút lần nữa để NÉM DẰN MẶT bàn đối thủ!`
      );
    }
  };

  const handlePushFoodCartCrash = () => {
    sound.playHornBeep();
    sound.playChairFall();
    sceneRef.current?.triggerPushFoodCartCrash();
    confetti({ particleCount: 55, spread: 80, origin: { y: 0.6 } });
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.isUser
          ? { ...p, coins: p.coins + 60, title: 'Quái Xế Xe Cá Viên 🍡' }
          : p
      ),
    }));
    showToast(
      '🛒💥 RẦM XOẢNG!! Bạn leo lên đẩy chiếc Xe Đẩy Cá Viên Chiên lao thẳng vào bàn nhậu đối thủ làm lật tung cả bàn (+60 Nắp Bia)!'
    );
  };

  const handleToggleWingmanCarry = (friendId: string) => {
    sound.playSlap();
    const friend = tableState.players.find((p) => p.id === friendId);
    setIkState((prev) => {
      const nextId = prev.draggingFriendId === friendId ? null : friendId;
      showToast(
        nextId
          ? `🦵🏃 Đang tóm nách kéo lê ${
              friend?.name || 'bạn nhậu'
            } sền sệt trên vỉa hè! Dùng WASD để kéo đi giấu vào nhà vệ sinh!`
          : `🚽 Đã thả ${friend?.name || 'bạn nhậu'} xuống nền vỉa hè!`
      );
      return {
        ...prev,
        controlMode: 'free_roam',
        cameraMode: 'free_roam',
        draggingFriendId: nextId,
      };
    });
  };

  const handleTackleBeerTrayFriend = () => {
    sound.playHeadbutt();
    sound.playSplash();
    setIkState((prev) => ({
      ...prev,
      controlMode: 'free_roam',
      cameraMode: 'free_roam',
      isHeadbutting: true,
    }));
    setTimeout(() => {
      setIkState((prev) => ({ ...prev, isHeadbutting: false }));
    }, 550);
    const victimName = sceneRef.current?.triggerThrowAtFriend();
    showToast(
      `🏈🍺 RẦM! Bạn chạy lấy đà húc vai tông ngã ${
        victimName || 'đứa bạn'
      } đang bưng khay bia làm bọt bia văng tung tóe khắp đường!`
    );
  };

  const handleStartUrgentPeeRush = () => {
    sound.playBell();
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.isUser ? { ...p, bladderLevel: 100 } : p
      ),
    }));
    setIkState((prev) => ({
      ...prev,
      controlMode: 'free_roam',
      cameraMode: 'free_roam',
      isUrgentPeeRushing: true,
    }));
    showToast(
      '🚽🏃💦 BÁO ĐỘNG 100% BỤNG BIA! Hai tay ôm chặt bụng chạy bán sống bán chết tìm Nhà Vệ Sinh — Coi chừng vấp té để lại vũng nước vàng óng!'
    );

    // After 4.5s, if still rushing, check if WC is free or slip into a yellow puddle!
    setTimeout(() => {
      setIkState((prev) => {
        if (!prev.isUrgentPeeRushing) return prev;
        setYellowPeePuddleActive(true);
        sound.playSplash();
        showToast(
          '💦😱 KHÔNG NHỊN NỔI NỮA! Bị vấp chân ngay trước cửa WC để lại Vũng Nước Vàng Óng trơn trượt trên vỉa hè!'
        );
        return { ...prev, isUrgentPeeRushing: false };
      });
    }, 5000);
  };

  const handleRivalTableAction = (
    action: 'steal_beer_mug' | 'flip_rival_table'
  ) => {
    if (action === 'steal_beer_mug') {
      sound.playGulp();
      setCupState((prev) => ({ ...prev, liquidLevel: 100, foamRatio: 22 }));
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, coins: p.coins + 40, title: 'Đạo Chích Bia Bàn Bên 🍺' } : p
        ),
      }));
      showToast(
        '🍺🥷 Lén đi qua bàn bên cạnh "chôm" gọn 1 ly bia đầy 100% đem về bàn mình uống (+40 Nắp Bia)!'
      );
    } else {
      sound.playChairFall();
      sound.playHeadbutt();
      sceneRef.current?.triggerFlipNeighborTable();
      setArenaState((prev) => ({ ...prev, neighborBrawlActive: true }));
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, coins: p.coins + 65, title: 'Chúa Tể Lật Bàn 💥' } : p
        ),
      }));
      showToast(
        '💥🪑 LẬT TUNG BÀN ĐỐI THỦ! Đồ ăn thức uống văng tung tóe — Kích hoạt Hỗn Chiến Quán Nhậu (Pub Brawl) (+65 Nắp Bia)!'
      );
    }
  };

  // Open Interactive "1, 2, 3 DZÔ!" HUD Modal
  const handleCheers = () => {
    if ((userPlayer.bladderLevel || 0) >= 100) {
      showToast(
        '🎈 BỤNG BIA ĐÃ CĂNG TRÒN 100%! Không thể uống thêm, phải chạy đi WC 1 Buồng giải quyết ngay!'
      );
      setDrinkModalTab('wc');
      setActiveModal('drink_bladder');
      return;
    }
    setActiveModal((prev) => (prev === 'cheers_toast' ? 'none' : 'cheers_toast'));
  };

  // Quick Refill Cup before Cheers
  const handleQuickRefillCup = () => {
    sound.playPour();
    setCupState((prev) => ({
      ...prev,
      liquidLevel: 100,
      foamRatio: 20,
      warmSeconds: 0,
    }));
    setTableState((prev) => ({
      ...prev,
      beerTowerLevel: Math.max(10, prev.beerTowerLevel - 12),
    }));
    showToast('🍾 Đã rót đầy 100% ly bia vàng óng sẵn sàng hô 1, 2, 3 DZÔ!');
  };

  // Execute 3-Phase Realistic Cheers ("1. Cụng ly giữa bàn KENG -> 2. Ngửa cổ uống ực ực -> 3. Dằn ly CỘP!")
  const handleExecuteCheersToast = async (
    strategy: ChugStrategy,
    clinkResult: ClinkForceResult,
    _forceValue: number
  ) => {
    setActiveModal('none');

    // Auto-refill if cup was nearly empty so the player can enjoy the full 3D chug
    const startingLevel = cupState.liquidLevel < 20 ? 100 : cupState.liquidLevel;
    const drainAmount =
      strategy === 'full_100'
        ? startingLevel
        : strategy === 'half_50'
        ? Math.min(startingLevel, 50)
        : Math.min(startingLevel, 10);
    const endLevel = Math.max(0, startingLevel - drainAmount);

    // Trigger 3-stage audio & 3-stage 3D animation with live beer draining
    sound.playCheer();
    sceneRef.current?.setUserCupFillRatio(startingLevel / 100);
    sceneRef.current?.triggerCheers(endLevel / 100);
    confetti({ particleCount: 55, spread: 75, origin: { y: 0.68 } });

    setCupState((prev) => ({
      ...prev,
      liquidLevel: endLevel,
      warmSeconds: endLevel === 0 ? 0 : prev.warmSeconds,
    }));

    const tier =
      DRINK_TIERS.find((d) => d.id === cupState.drinkId) || DRINK_TIERS[1];

    // Check Sneaky Lip-Sip ("Nhấp Môi 10%")
    if (strategy === 'lip_sip_10') {
      const caught = Math.random() < 0.5;
      if (caught) {
        setTimeout(() => {
          sound.playSlap();
          setSpotlightVictimName(userPlayer.name);
          setTableState((prev) => ({
            ...prev,
            players: prev.players.map((p) =>
              p.isUser
                ? {
                    ...p,
                    isCaughtSlipping: true,
                    alcoholLevel: Math.min(100, p.alcoholLevel + tier.alcoholDelta * 2),
                    bladderLevel: Math.min(100, (p.bladderLevel || 0) + tier.bladderDelta * 2),
                    isPassedOut: p.alcoholLevel + tier.alcoholDelta * 2 >= 100,
                  }
                : p
            ),
          }));
          showToast(
            '🚨 ĐÈN SPOTLIGHT "ĐỒ NHẤP MÔI" RỌI THẲNG ĐẦU! Cả bàn bắt phạt bạn uống GẤP ĐÔI!'
          );
          setTimeout(() => {
            setSpotlightVictimName(null);
            setTableState((prev) => ({
              ...prev,
              players: prev.players.map((p) =>
                p.isUser ? { ...p, isCaughtSlipping: false } : p
              ),
            }));
          }, 4500);
        }, 1200);
        return;
      } else {
        showToast(
          '😏 Lươn lẹo thành công! Bạn ngửa cổ cực sâu nhưng chỉ nhấp môi 10% (+0% Cồn, +20 Nắp Bia)!'
        );
        setTableState((prev) => ({
          ...prev,
          toastCount: prev.toastCount + 1,
          players: prev.players.map((p) =>
            p.isUser ? { ...p, coins: p.coins + 20 } : p
          ),
        }));
        return;
      }
    }

    // Calculate alcohol & coins based on 100% vs 50% and Clink Force result
    const ratio = strategy === 'full_100' ? 1.0 : 0.5;
    const oversmashSplashDiscount = clinkResult === 'oversmash_splash' ? 0.75 : 1.0;
    const userAlcGain = Math.round(tier.alcoholDelta * ratio * oversmashSplashDiscount);
    const userBladderGain = Math.round(tier.bladderDelta * ratio * oversmashSplashDiscount);
    const bonusCoins =
      (strategy === 'full_100' ? 30 : 15) + (clinkResult === 'perfect' ? 25 : 0);
    const staminaDelta =
      clinkResult === 'perfect' ? 8 : clinkResult === 'weak_spill' ? -6 : -3;

    setTableState((prev) => {
      const updatedPlayers = prev.players.map((p) => {
        if (p.isPassedOut) return p;
        // Chuột Hamster Nga Phan chỉ uống Coca & phá mồi -> Độ cồn luôn = 0%!
        if (p.isColaOnlyDestroyer || p.id === 'bot_ngaphan' || p.avatar === 'hamster') {
          return {
            ...p,
            alcoholLevel: 0,
            isPassedOut: false,
            foodEatenCount: (p.foodEatenCount || 0) + 1,
          };
        }
        const alcGain = p.isUser
          ? userAlcGain
          : p.id === 'bot_khoanguyen'
          ? 16
          : clinkResult === 'oversmash_splash' && p.id === 'bot_phiquan'
          ? 14
          : 12;
        const bladderGain = p.isUser ? userBladderGain : 10;
        const newAlcohol = Math.max(0, Math.min(100, p.alcoholLevel + alcGain));
        const newBladder = Math.min(100, (p.bladderLevel || 0) + bladderGain);
        const newStamina = Math.max(
          0,
          Math.min(100, p.stamina + (p.isUser ? staminaDelta : -4))
        );
        const isNowPassedOut = newAlcohol >= 100;

        return {
          ...p,
          alcoholLevel: newAlcohol,
          bladderLevel: newBladder,
          stamina: newStamina,
          drinksCount: p.drinksCount + 1,
          emptyBottlesCount: p.isUser
            ? (p.emptyBottlesCount || 0) + (strategy === 'full_100' ? 1 : 0)
            : p.emptyBottlesCount,
          coins: p.isUser ? p.coins + bonusCoins : p.coins,
          isPassedOut: isNowPassedOut,
        };
      });

      return {
        ...prev,
        players: updatedPlayers,
        toastCount: prev.toastCount + 1,
        beerTowerLevel: Math.max(5, prev.beerTowerLevel - 10),
        totalBill: prev.totalBill + tier.price,
      };
    });

    // Special Drink FX triggers on full chug
    if (tier.id === 'craft_beer') {
      setCraftBeerHallucination(true);
      setTimeout(() => setCraftBeerHallucination(false), 7000);
    }

    if (clinkResult === 'perfect') {
      showToast(
        `🎯 KENG GIÒN TAN! Cụng chuẩn tâm vàng + Uống ${
          strategy === 'full_100' ? 'CẠN SẠCH 100%' : '50% ly'
        } -> Dằn ly CỘP! (+${bonusCoins} Nắp Bia)`
      );
    } else if (clinkResult === 'oversmash_splash') {
      showToast(
        `💥 DZÔ QUÁ HÚNG! Bạn đập ly cực mạnh làm 25% bia văng sang mặt Phi Quân (Bạn đỡ say, Phi Quân +14% cồn)!`
      );
    } else {
      showToast(
        `💦 Tay hơi run khi cụng làm sánh bọt ra áo ba lỗ, nhưng vẫn dằn ly CỘP! (+${bonusCoins} Nắp Bia)`
      );
    }
  };

  // Drink / Eat with IK Hand [Khi ngồi bàn nhậu]
  const handleDrinkOrEatWithHand = () => {
    if (ikState.controlMode === 'free_roam') {
      showToast('🚶‍♂️ Bạn đang đi lại quanh quán! Hãy ngồi lại vào bàn nhậu [Phím E] để uống bia!');
      return;
    }

    if (ikState.isFallenOffChair) {
      sound.playSlap();
      setIkState((prev) => ({
        ...prev,
        isFallenOffChair: false,
        chairBalance: 0,
      }));
      showToast('🪑 Đã lồm cồm bò dậy ngồi lại ngay ngắn trên ghế nhựa!');
      return;
    }

    sound.playGulp();
    setIkState((prev) => ({ ...prev, isDrinkingOrEating: true }));
    setTimeout(() => {
      setIkState((prev) => ({ ...prev, isDrinkingOrEating: false }));
    }, 650);

    // If heavily drunk (>70%), 40% chance hand shakes and spills beer on shirt!
    if (userPlayer.alcoholLevel > 70 && Math.random() < 0.4) {
      sound.playSplash();
      showToast(
        '🍺💦 Tay run quá! Bạn đưa ly lệch tâm làm đổ cả bọt bia ướt nhẹp áo ba lỗ!'
      );
      return;
    }

    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.isUser
          ? {
              ...p,
              alcoholLevel: Math.min(100, p.alcoholLevel + 6),
              coins: p.coins + 8,
              drinksCount: p.drinksCount + 1,
              isPassedOut: p.alcoholLevel + 6 >= 100,
            }
          : p
      ),
    }));
    showToast('🍺 Ực ực! Đưa tay IK uống một ngụm bia mát lạnh (+8 Nắp Bia)!');
  };

  // Cold Towel / Ice Water Splash [Key C]
  const handleTriggerColdTowel = () => {
    sound.playSplash();
    setWaterSplashActive(true);
    setTimeout(() => setWaterSplashActive(false), 3200);

    setIkState((prev) => ({
      ...prev,
      coldTowelBuffTimer: 30,
      chairBalance: 0,
    }));

    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.isUser
          ? {
              ...p,
              alcoholLevel: Math.max(0, p.alcoholLevel - 6),
              stamina: Math.min(100, p.stamina + 10),
            }
          : p
      ),
    }));
    showToast(
      '🧊 XOẸT! Lau khăn lạnh ướp đá lên mặt — Màn hình trong veo, hết lắc Camera trong 30 giây!'
    );
  };

  // Headbutt / Push in Free-Roam Mode [RMB]
  const handleHeadbutt = () => {
    sound.playHeadbutt();
    setIkState((prev) => ({ ...prev, isHeadbutting: true }));
    setTimeout(() => {
      setIkState((prev) => ({ ...prev, isHeadbutting: false }));
    }, 450);

    const hitFriend = sceneRef.current?.triggerThrowAtFriend();
    showToast(
      `💥 BỐP! Bạn lao tới húc đầu đẩy vai ${hitFriend || 'bạn nhậu'} văng khỏi mâm mồi!`
    );
  };

  // Toggle Camera POV [Tab or V]
  const handleToggleCameraPOV = () => {
    setIkState((prev) => {
      const nextMode =
        prev.cameraMode === 'first_person' ? 'seated_3rd' : 'first_person';
      showToast(
        nextMode === 'first_person'
          ? '👁️ Đã chuyển sang Góc Nhìn Thứ Nhất (POV) — Nhìn thẳng mặt bạn nhậu bắt bài!'
          : '🎥 Đã chuyển về Góc Thứ 3 Chéo Vai 35° (Thấy trọn nhân vật & bàn nhậu)!'
      );
      return { ...prev, cameraMode: nextMode };
    });
  };

  // Toggle Seated vs Free-Roam Mode [E or F]
  const handleToggleControlMode = () => {
    setIkState((prev) => {
      const nextControl = prev.controlMode === 'seated' ? 'free_roam' : 'seated';
      const nextCam =
        nextControl === 'free_roam' ? 'free_roam' : 'seated_3rd';
      showToast(
        nextControl === 'free_roam'
          ? '🏃 Đã đứng dậy khỏi ghế nhựa! Dùng WASD để đi lại quanh quán, RMB để húc đầu!'
          : '🪑 Đã kéo ghế nhựa ngồi lại vào bàn nhậu!'
      );
      return {
        ...prev,
        controlMode: nextControl,
        cameraMode: nextCam,
        isFallenOffChair: false,
      };
    });
  };

  // Trigger Emote [Keys 1, 2, 3, 4]
  const handleTriggerEmote = (emote: CharacterEmote) => {
    if (emote === 'laugh_slap') {
      sound.playLaugh();
      showToast('😂 HAHAHA! Bạn ngửa cổ đập bàn inox cười vang cả góc phố!');
    } else if (emote === 'point_taunt') {
      sound.playSlap();
      showToast('👉 "Mày uống nhấp môi à?!" — Chỉ tay thẳng mặt khiêu khích!');
    } else if (emote === 'beg_mercy') {
      showToast('🙏 "Em xin phép uống trà đá!" — Chắp hai tay lạy xin tha uống!');
    } else if (emote === 'sleep_table') {
      showToast('😴 Gục đầu xuống bàn inox giả chết trốn rượu...');
    }
    setIkState((prev) => ({ ...prev, emote }));
  };

  // Hand the cursor back whenever a modal or minigame UI needs clicking
  useEffect(() => {
    if (activeModal !== 'none' || tableState.activeMinigame !== 'none') {
      sceneRef.current?.releasePointerLock();
    }
  }, [activeModal, tableState.activeMinigame]);

  // Global Keyboard & Mouse Controls Listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Chat input [Enter] and quick-chat wheel [Q] need the cursor
      if (e.key === 'Enter' || e.key === 'q' || e.key === 'Q') {
        sceneRef.current?.releasePointerLock();
      }
      if (activeModal !== 'none') return;

      if (e.key === 'Tab' || e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        handleToggleCameraPOV();
      } else if (e.key === 'e' || e.key === 'E' || e.key === 'f' || e.key === 'F') {
        handleToggleControlMode();
      } else if (e.key === 'c' || e.key === 'C') {
        handleTriggerColdTowel();
      } else if (e.key === ' ') {
        e.preventDefault();
        if (ikState.controlMode === 'free_roam') {
          // Khi đang đứng dậy tự do, Space là nhảy chân sáo / vận động toát mồ hôi giải rượu
          sound.playSlap();
          setTableState((prev) => ({
            ...prev,
            players: prev.players.map((p) =>
              p.isUser && p.alcoholLevel > 0
                ? {
                    ...p,
                    alcoholLevel: Math.max(0, p.alcoholLevel - 2),
                    stamina: Math.min(100, p.stamina + 4),
                  }
                : p
            ),
          }));
          showToast('🏃‍♂️ Nhảy chân sáo vận động hóng gió — Toát mồ hôi giải bớt 2% cồn!');
        } else {
          handleDrinkOrEatWithHand();
        }
      } else if (e.key === '1') {
        handleTriggerEmote('laugh_slap');
      } else if (e.key === '2') {
        handleTriggerEmote('point_taunt');
      } else if (e.key === '3') {
        handleTriggerEmote('beg_mercy');
      } else if (e.key === '4') {
        handleTriggerEmote('sleep_table');
      } else if (
        e.key === 'a' ||
        e.key === 'A' ||
        e.key === 'd' ||
        e.key === 'D' ||
        e.key === 'w' ||
        e.key === 'W' ||
        e.key === 's' ||
        e.key === 'S'
      ) {
        const key = e.key.toLowerCase();
        setIkState((prev) => {
          if (prev.controlMode === 'free_roam') {
            walkStepCountRef.current += 1;
            // Vận động đi lại toát mồ hôi: cứ 12 bước chân giải bớt 1% cồn & hồi thể lực!
            if (walkStepCountRef.current % 12 === 0) {
              setTableState((ts) => ({
                ...ts,
                players: ts.players.map((p) =>
                  p.isUser && p.alcoholLevel > 0
                    ? {
                        ...p,
                        alcoholLevel: Math.max(0, p.alcoholLevel - 1),
                        stamina: Math.min(100, p.stamina + 2),
                      }
                    : p
                ),
              }));
            }

            const step = 0.22;
            const localX = key === 'a' ? -step : key === 'd' ? step : 0;
            const localZ = key === 'w' ? -step : key === 's' ? step : 0;
            // W walks where the camera faces once mouse look has turned it
            const yaw = sceneRef.current?.getCameraYaw() ?? 0;
            const dx = localX * Math.cos(yaw) + localZ * Math.sin(yaw);
            const dz = -localX * Math.sin(yaw) + localZ * Math.cos(yaw);
            const nx = Math.max(-4.8, Math.min(4.8, prev.freeRoamPos.x + dx));
            const nz = Math.max(-3.6, Math.min(3.8, prev.freeRoamPos.z + dz));
            const angle = Math.atan2(dx, dz);
            return {
              ...prev,
              freeRoamPos: { x: nx, z: nz, angle, isMoving: true },
            };
          } else {
            // Seated Chair Balance A / D
            const deltaBal = key === 'a' ? -24 : key === 'd' ? 24 : 0;
            return {
              ...prev,
              chairBalance: Math.max(-95, Math.min(95, prev.chairBalance + deltaBal)),
            };
          }
        });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        setIkState((prev) => ({
          ...prev,
          freeRoamPos: { ...prev.freeRoamPos, isMoving: false },
        }));
      }
    };

    const onWheel = (_e: WheelEvent) => {
      // Cuộn chuột / Zoom góc nhìn tuyệt đối KHÔNG tự ý uống hay làm tăng nồng độ cồn!
    };

    const onContextMenu = (e: MouseEvent) => {
      if (activeModal !== 'none') return;
      e.preventDefault();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (activeModal !== 'none') return;
      if (e.button === 2) {
        // Right Mouse Button: Hold cheers in center (Seated) or Headbutt (Free-Roam)
        if (ikState.controlMode === 'free_roam') {
          handleHeadbutt();
        } else {
          setIkState((prev) => ({ ...prev, isCheersHolding: true }));
          setCrowdDecibel(58);
        }
      } else if (e.button === 0) {
        setIkState((prev) => ({ ...prev, isGrabbing: true }));
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        setIkState((prev) => ({ ...prev, isCheersHolding: false }));
      } else if (e.button === 0) {
        setIkState((prev) => {
          // If releasing LMB while hand is swung far to the side, throw object at friend!
          if (
            prev.isGrabbing &&
            Math.abs(prev.aimX) > 0.68 &&
            activeModal === 'none'
          ) {
            const victimName = sceneRef.current?.triggerThrowAtFriend();
            if (victimName) {
              sound.playHeadbutt();
              showToast(
                `🧊 BỐP! Bạn vung tay thả nút Cầm ném thẳng viên đá lạnh vào mặt ${victimName}!`
              );
            }
          }
          return { ...prev, isGrabbing: false };
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('wheel', onWheel);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [activeModal, ikState.controlMode, ikState.isFallenOffChair, userPlayer.alcoholLevel]);

  // Mic-Activated Cheers & Real-Time Lip-Sync Toggle
  const handleToggleMic = async () => {
    if (tableState.isMicCheersActive) {
      sound.stopMicCheers();
      setTableState((prev) => ({ ...prev, isMicCheersActive: false }));
      setIkState((prev) => ({ ...prev, micVolume: 0 }));
      showToast('Đã tắt nhận diện Mic Hô Dzô & Lip-Sync');
    } else {
      const success = await sound.startMicCheers(
        (_vol) => {
          setCrowdDecibel(98);
          showToast('🎤 CỘT ÂM LƯỢNG VỌT QUA VẠCH ĐỎ! 1, 2, 3 DZÔÔÔ SLOW-MOTION!');
          handleCheers();
        },
        () => {
          showToast('Không thể mở micro. Bạn có thể bấm nút "HÔ DZÔ NGAY" trên thanh dB!');
        },
        (rmsVol) => {
          setIkState((prev) => ({
            ...prev,
            micVolume: rmsVol,
            emote: rmsVol > 0.78 ? 'laugh_slap' : prev.emote,
          }));
          setCrowdDecibel(Math.min(100, Math.round(25 + rmsVol * 75)));
        }
      );
      if (success) {
        setTableState((prev) => ({ ...prev, isMicCheersActive: true }));
        showToast(
          '🎤 Đã bật Mic Lip-Sync & Hô Dzô! Nói chuyện để môi mấp máy, cười lớn để đập bàn!'
        );
      } else {
        micUnavailableRef.current = true;
      }
    }
  };

  // Lobby rule "Bắt buộc hô 1, 2, 3 Dzô vào Mic": the cheers button only arms the mic.
  // If the mic can't be opened, fall back to the button so nobody gets stuck sober.
  const micUnavailableRef = useRef(false);
  const handleCheersWithTableRules = () => {
    if (
      lobbyConfig?.rules.micDzo &&
      !tableState.isMicCheersActive &&
      !micUnavailableRef.current
    ) {
      showToast('🎤 Luật bàn: phải hô "1, 2, 3 DZÔ!" vào Mic mới được uống! Đang bật mic…');
      handleToggleMic();
      return;
    }
    handleCheers();
  };

  // Lobby "Độ Đô Của Bàn": scale every alcohol gain of the user by the table's drunk speed
  const lastUserAlcoholRef = useRef(userPlayer.alcoholLevel);
  useEffect(() => {
    const multiplier =
      DRUNK_SPEEDS.find((s) => s.id === lobbyConfig?.drunkSpeed)?.multiplier ?? 1;
    const prev = lastUserAlcoholRef.current;
    const cur = userPlayer.alcoholLevel;
    lastUserAlcoholRef.current = cur;
    if (multiplier === 1 || cur <= prev) return;
    const adjusted = Math.max(0, Math.min(100, Math.round(prev + (cur - prev) * multiplier)));
    if (adjusted === cur) return;
    lastUserAlcoholRef.current = adjusted;
    setTableState((ts) => ({
      ...ts,
      players: ts.players.map((p) => (p.isUser ? { ...p, alcoholLevel: adjusted } : p)),
    }));
  }, [userPlayer.alcoholLevel]);

  // Welcome toast when arriving from the lobby
  useEffect(() => {
    if (!lobbyConfig) return;
    const speed = DRUNK_SPEEDS.find((s) => s.id === lobbyConfig.drunkSpeed);
    showToast(
      `🍻 DZÔÔÔ! Bàn #${lobbyConfig.roomCode} • ${THEME_NAMES[lobbyConfig.theme]} • ${speed?.icon} ${speed?.name}`
    );
  }, []);


  // Interactive Chopstick Grab Execution (Self, Feed Friend, Spicy Prank, Last-Piece Clash)
  const handleExecuteGrab = (
    dishId: string,
    mode: GrabMode,
    targetPlayerId: string,
    precision: GrabPrecision
  ) => {
    const dish = tableState.foodDishes.find((d) => d.id === dishId);
    if (!dish || dish.servings <= 0) return;

    const targetPlayer =
      tableState.players.find((p) => p.id === targetPlayerId) || userPlayer;

    // Trigger 3D flying chopsticks animation from dish to target player's mouth
    sceneRef.current?.triggerChopstickGrab(
      dishId,
      targetPlayerId,
      precision === 'spicy_trap'
    );

    if (precision === 'slipped') {
      // Slipped off chopsticks! "Cậu Vàng" under the table immediately lunges out and snaps it up!
      sound.playDogBark();
      sceneRef.current?.triggerFeedDog();
      setArenaState((prev) => ({
        ...prev,
        cauVangAffinity: Math.min(100, prev.cauVangAffinity + 15),
        droppedMorselsEatenByDog: prev.droppedMorselsEatenByDog + 1,
      }));
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, stamina: Math.max(0, p.stamina - 3) } : p
        ),
      }));
      showToast(
        `🐕 GÂU! Bạn gắp trượt làm rơi miếng ${dish.name} xuống đất — Chú chó "Cậu Vàng" dưới gầm bàn phóng ra đớp gọn trong 1 nốt nhạc (+15% Thân thiết)!`
      );
      return;
    }

    if (precision === 'spicy_trap') {
      // Bit a fiery chili pepper! Target has to chug beer (+14% alcohol)
      setTableState((prev) => {
        const updatedDishes = prev.foodDishes.map((d) =>
          d.id === dishId ? { ...d, servings: Math.max(0, d.servings - 1) } : d
        );
        const updatedPlayers = prev.players.map((p) => {
          if (p.id !== targetPlayerId) return p;
          const newAlc = Math.min(100, p.alcoholLevel + 14);
          return {
            ...p,
            alcoholLevel: newAlc,
            isPassedOut: newAlc >= 100,
            drinksCount: p.drinksCount + 1,
          };
        });
        return { ...prev, foodDishes: updatedDishes, players: updatedPlayers };
      });

      if (mode === 'spicy_prank' && targetPlayerId !== userPlayer.id) {
        showToast(
          `🌶️ Đỉnh cao troll! Bạn lén gắp ớt hiểm đút cho ${targetPlayer.name} khiến bạn ấy cay xè phải nốc bia (+14% cồn)!`
        );
      } else {
        showToast(
          `🌶️ Á ĐÙ! Gắp trúng trái ớt hiểm trong đĩa ${dish.name}! Cay xè lưỡi phải nốc bia chữa cháy (+14% cồn)!`
        );
      }
      return;
    }

    // Normal or Perfect grab
    const multiplier = precision === 'perfect' ? 1.5 : 1.0;
    const alcChange = Math.round(dish.alcoholDelta * multiplier);
    const stamChange = Math.round(dish.staminaDelta * multiplier);

    setTableState((prev) => {
      const updatedDishes = prev.foodDishes.map((d) =>
        d.id === dishId ? { ...d, servings: Math.max(0, d.servings - 1) } : d
      );

      const updatedPlayers = prev.players.map((p) => {
        if (p.id === targetPlayerId) {
          const newAlc = Math.max(0, p.alcoholLevel + alcChange);
          const newStam = Math.min(100, p.stamina + stamChange);
          const eaten = (p.foodEatenCount || 0) + 1;
          return {
            ...p,
            alcoholLevel: newAlc,
            stamina: newStam,
            foodEatenCount: eaten,
            title:
              p.isUser && eaten >= 4
                ? 'Dũng Sĩ Diệt Mồi'
                : p.title,
          };
        }
        if (p.isUser && mode === 'feed_friend' && targetPlayerId !== userPlayer.id) {
          return {
            ...p,
            coins: p.coins + 20,
            title: 'Người Anh Em Thiện Lành',
          };
        }
        return p;
      });

      // Also reward +15 coins if user landed a Perfect grab for themselves
      const finalPlayers = updatedPlayers.map((p) =>
        p.isUser && precision === 'perfect' && mode === 'self'
          ? { ...p, coins: p.coins + 15 }
          : p
      );

      return {
        ...prev,
        foodDishes: updatedDishes,
        players: finalPlayers,
      };
    });

    if (mode === 'feed_friend' && targetPlayerId !== userPlayer.id) {
      showToast(
        `🥢 Đã gắp ${dish.name} tiếp sức cho ${targetPlayer.name} (${alcChange}% cồn)! Thưởng +20 Nắp Bia!`
      );
    } else if (precision === 'perfect') {
      showToast(
        `✨ GẮP CHUẨN TÂM VÀNG! Đớp ${dish.name} giảm cực mạnh ${Math.abs(alcChange)}% cồn & +${stamChange}% tỉnh táo (+15 Nắp Bia)!`
      );
    } else {
      showToast(
        `🥢 Đã gắp ${dish.name}! Giảm ${Math.abs(alcChange)}% cồn và hồi +${stamChange}% tỉnh táo!`
      );
    }
  };

  // Order / Refill Street Pub Dish
  const handleOrderDish = (dishId: string) => {
    const dish = tableState.foodDishes.find((d) => d.id === dishId);
    if (!dish) return;

    sound.playBell();
    setTableState((prev) => {
      const updatedDishes = prev.foodDishes.map((d) =>
        d.id === dishId ? { ...d, servings: d.maxServings } : d
      );
      return {
        ...prev,
        foodDishes: updatedDishes,
        totalBill: prev.totalBill + dish.price,
      };
    });

    showToast(
      `🛎️ "Chủ quán ơi cho thêm 1 phần ${dish.name} nóng hổi!" (+${dish.price.toLocaleString()}đ vào Bill)`
    );
  };

  // Call waiter: Refill beer tower
  const handleCallWaiter = () => {
    sound.playBell();
    sound.playPour();
    setTableState((prev) => ({
      ...prev,
      beerTowerLevel: 100,
      totalBill: prev.totalBill + 180000,
    }));
    showToast('🛎️ "Bồi bàn ơi!" — Tháp bia tươi Tiger 3L đá khô bốc khói đã lên bàn!');
  };

  // Toilet break & Full Drink / Bladder / Tricks Handlers
  const handleSelectDrinkTier = (tierId: DrinkTierId) => {
    sound.playPour();
    const tier = DRINK_TIERS.find((d) => d.id === tierId) || DRINK_TIERS[0];
    setCupState((prev) => ({
      ...prev,
      drinkId: tierId,
      liquidLevel: 100,
      foamRatio: tierId === 'bia_hoi' ? 40 : tierId === 'ruou_de' || tierId === 'tra_da' ? 0 : 20,
      warmSeconds: 0,
    }));
    showToast(`🍺 Đã chọn đồ uống: ${tier.name} (${tier.servingStyle})!`);
  };

  const handlePourDrink = (highAnglePour: boolean) => {
    sound.playPour();
    const isDrunkHand = userPlayer.alcoholLevel >= 50 || highAnglePour;
    const foam = isDrunkHand ? 80 : 18;
    setCupState((prev) => ({
      ...prev,
      liquidLevel: 100,
      foamRatio: foam,
      warmSeconds: 0,
      pouredByName: highAnglePour ? 'Phi Quân (Tay Run)' : userPlayer.name,
    }));
    if (foam >= 60) {
      showToast(
        '🌊 Rót từ trên cao / tay run tạo ra LY TOÀN BỌT (80% bọt, 20% bia)! Bấm nút Chửi Thằng Rót ngay!'
      );
    } else {
      showToast('🍾 Đã rót một ly chuẩn chỉnh (82% bia vàng óng, 18% bọt mịn)!');
    }
  };

  const handleScoldPourerAndForceDrink = () => {
    sound.playSlap();
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === 'bot_phiquan'
          ? {
              ...p,
              alcoholLevel: Math.min(100, p.alcoholLevel + 15),
              bladderLevel: Math.min(100, (p.bladderLevel || 0) + 15),
              isPassedOut: p.alcoholLevel + 15 >= 100,
            }
          : p
      ),
    }));
    setCupState((prev) => ({
      ...prev,
      liquidLevel: 100,
      foamRatio: 15,
      pouredByName: userPlayer.name,
    }));
    showToast(
      '🤬 "Mày rót cái ly toàn bọt thế này cho chó uống à?! Tự uống luôn đi!" — Phi Quân phải nốc hết ly bọt (+15% cồn)!'
    );
  };

  const handleAddIceToCup = () => {
    sound.playSplash();
    setCupState((prev) => ({
      ...prev,
      iceCubes: Math.min(3, prev.iceCubes + 1),
      warmSeconds: 0,
    }));
    showToast('🧊 Đã dùng cây gắp đá inox bỏ 1 viên đá mát lạnh vào ly (Chống Bia Hầm)!');
  };

  const handleThrowIceAtFriendCollar = (targetPlayerId: string) => {
    sound.playSplash();
    sound.playLaugh();
    sceneRef.current?.triggerThrowAtFriend();
    const target = tableState.players.find((p) => p.id === targetPlayerId);
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === targetPlayerId
          ? {
              ...p,
              isPassedOut: false,
              alcoholLevel: Math.max(0, p.alcoholLevel - 15),
              stamina: Math.min(100, p.stamina + 25),
            }
          : p
      ),
    }));
    showToast(
      `🧊😈 Á Á Á LẠNH QUÁ!! Bạn gắp cục đá bỏ lọt thỏm vào cổ áo ${target?.name || 'bạn nhậu'} làm nó giật bắn người tỉnh cả rượu!`
    );
  };

  const handleDrinkCup = (mode: 'full_100' | 'sip_50') => {
    if ((userPlayer.bladderLevel || 0) >= 100) {
      showToast('🎈 Bụng bia đã đầy 100%! Không thể uống thêm — Hãy chạy vào WC ngay!');
      return;
    }

    const tier =
      DRINK_TIERS.find((d) => d.id === cupState.drinkId) || DRINK_TIERS[0];
    const isWarm = cupState.warmSeconds >= 120 && cupState.iceCubes === 0;
    const warmMultiplier = isWarm ? 1.5 : 1.0;

    // 1. Check if drinking Trà Đá / Nước Lọc secretly
    if (tier.id === 'tra_da') {
      const caught = Math.random() < 0.45;
      if (caught) {
        sound.playSlap();
        setCheatingAlertText(
          '❗ PHÁT HIỆN UỐNG LÉN TRÀ ĐÁ GIẢI RƯỢU! CẢ BÀN PHẠT UỐNG GẤP ĐÔI (+24% CỒN)!'
        );
        setTimeout(() => setCheatingAlertText(null), 4000);
        setTableState((prev) => ({
          ...prev,
          players: prev.players.map((p) =>
            p.isUser
              ? {
                  ...p,
                  alcoholLevel: Math.min(100, p.alcoholLevel + 24),
                  bladderLevel: Math.min(100, (p.bladderLevel || 0) + 20),
                  isPassedOut: p.alcoholLevel + 24 >= 100,
                }
              : p
          ),
        }));
        return;
      } else {
        sound.playGulp();
        setTableState((prev) => ({
          ...prev,
          players: prev.players.map((p) =>
            p.isUser
              ? {
                  ...p,
                  alcoholLevel: Math.max(0, p.alcoholLevel - 10),
                  bladderLevel: Math.min(100, (p.bladderLevel || 0) + 5),
                }
              : p
          ),
        }));
        showToast('🧊 Đã lén húp 1 ly Trà Đá mát lạnh hạ 10% độ cồn mà không ai phát hiện!');
        return;
      }
    }

    // 2. Check if Nhấp Môi 50% (leaving >20% beer in mug -> Spotlight!)
    if (mode === 'sip_50') {
      sound.playGulp();
      setCupState((prev) => ({ ...prev, liquidLevel: 50 }));
      setSpotlightVictimName(userPlayer.name);
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser
            ? {
                ...p,
                alcoholLevel: Math.min(
                  100,
                  p.alcoholLevel + Math.round(tier.alcoholDelta * 0.5)
                ),
                bladderLevel: Math.min(
                  100,
                  (p.bladderLevel || 0) + Math.round(tier.bladderDelta * 0.5)
                ),
                isCaughtSlipping: true,
                title: 'Đồ Nhấp Môi Lươn Lẹo',
              }
            : p
        ),
      }));
      setTimeout(() => {
        setSpotlightVictimName(null);
        setTableState((prev) => ({
          ...prev,
          players: prev.players.map((p) =>
            p.isUser ? { ...p, isCaughtSlipping: false } : p
          ),
        }));
      }, 5000);
      showToast(
        '🔦 BẮT QUẢ TANG CÒN DƯ 50% BIA TRONG LY! Đèn Spotlight chiếu thẳng mặt: "ĐỒ NHẤP MÔI!"'
      );
      return;
    }

    // 3. Full 100% Chug!
    sound.playGulp();
    sceneRef.current?.triggerCheers();
    const alcDelta = Math.round(tier.alcoholDelta * warmMultiplier);
    const bladderDelta = tier.bladderDelta;

    // Trigger special tier effects
    if (tier.id === 'craft_beer') {
      setCraftBeerHallucination(true);
      setTimeout(() => setCraftBeerHallucination(false), 7000);
    }

    setTableState((prev) => ({
      ...prev,
      totalBill: prev.totalBill + tier.price,
      players: prev.players.map((p) => {
        if (!p.isUser) return p;
        const nextAlc = Math.max(0, Math.min(100, p.alcoholLevel + alcDelta));
        const nextBladder = Math.min(100, (p.bladderLevel || 0) + bladderDelta);
        return {
          ...p,
          alcoholLevel: nextAlc,
          bladderLevel: nextBladder,
          drinksCount: p.drinksCount + 1,
          emptyBottlesCount:
            (p.emptyBottlesCount || 0) + (tier.id === 'bia_lon' ? 1 : 0),
          coins: p.coins + 20,
          isPassedOut: nextAlc >= 100,
          isBreathingFire: tier.id === 'ruou_de',
          isStunned: tier.id === 'tau_ngam' || isWarm,
        };
      }),
    }));

    setCupState((prev) => ({ ...prev, liquidLevel: 0, warmSeconds: 0 }));

    if (tier.id === 'ruou_de') {
      setTimeout(() => {
        setTableState((prev) => ({
          ...prev,
          players: prev.players.map((p) =>
            p.isUser ? { ...p, isBreathingFire: false } : p
          ),
        }));
      }, 5000);
      showToast(
        '🍶🔥 KHÈÈÈ! Rượu Đế Chuối Hột nóng ran cổ họng — Nhân vật 3D khè ra lửa rùng mình!'
      );
    } else if (tier.id === 'tau_ngam') {
      setTimeout(() => {
        setTableState((prev) => ({
          ...prev,
          players: prev.players.map((p) =>
            p.isUser ? { ...p, isStunned: false } : p
          ),
        }));
      }, 5000);
      showToast(
        '💣💫 100% TÀU NGẦM (+35% Cồn)! Bạn bị Choáng (Stun) quay cuồng suốt 5 giây!'
      );
    } else if (isWarm) {
      setTimeout(() => {
        setTableState((prev) => ({
          ...prev,
          players: prev.players.map((p) =>
            p.isUser ? { ...p, isStunned: false } : p
          ),
        }));
      }, 4000);
      showToast(
        '🤢 Uống trúng BIA HẦM ẤM để lâu quá 2 phút! Tăng +50% độ choáng, nhăn mặt muốn ói!'
      );
    } else {
      showToast(
        `🍻 UỐNG CẠN 100% ${tier.name}! (+${alcDelta}% Cồn, +${bladderDelta}% Bụng Bia, +20 Nắp Bia)`
      );
    }
  };

  // Sleight of Hand: Dump in Potted Plant or Swap Mug
  const handleSleightOfHand = (trick: 'dump_plant' | 'swap_mug') => {
    const caught = Math.random() < 0.38;
    if (caught) {
      sound.playSlap();
      setCheatingAlertText(
        trick === 'dump_plant'
          ? '❗ BỊ CHỦ QUÁN BẮT QUẢ TANG ĐỔ BIA VÀO CHẬU CÂY! PHẠT UỐNG 2 LY (+24% CỒN)!'
          : '❗ BẠN NHẬU PHÁT HIỆN MÀY TRÁO LY ĐẦY LẤY LY RỖNG! PHẠT UỐNG GẤP ĐÔI!'
      );
      setTimeout(() => setCheatingAlertText(null), 4200);
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser
            ? {
                ...p,
                alcoholLevel: Math.min(100, p.alcoholLevel + 24),
                bladderLevel: Math.min(100, (p.bladderLevel || 0) + 20),
                isPassedOut: p.alcoholLevel + 24 >= 100,
              }
            : p
        ),
      }));
    } else {
      sound.playPour();
      setCupState((prev) => ({ ...prev, liquidLevel: 0, warmSeconds: 0 }));
      showToast(
        trick === 'dump_plant'
          ? '🪴 Đỉnh cao lươn lẹo! Bạn nghiêng tay đổ sạch ly bia vào chậu cây cảnh sau lưng mà không ai biết!'
          : '🔄 Tráo ly thần sầu! Bạn đẩy ly đầy sang cho thằng bạn bên cạnh và lấy ly rỗng về!'
      );
    }
  };

  // Mix Poison Cocktail ("Bom Hỗn Hợp" -> 10s Bỏng Mỏ Circle Run!)
  const handleMixPoisonCocktail = (
    targetPlayerId: string,
    ingredients: string[]
  ) => {
    sound.playPour();
    sound.playLaugh();
    const victim = tableState.players.find((p) => p.id === targetPlayerId);
    setActiveModal('none');

    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.id === targetPlayerId
          ? {
              ...p,
              isSpicedMouth: true,
              alcoholLevel: Math.min(100, p.alcoholLevel + 22),
            }
          : p
      ),
    }));

    showToast(
      `🧪🌶️ ${victim?.name || 'Bạn nhậu'} vừa uống trúng "Bom Hỗn Hợp" (${ingredients.join(
        ' + '
      )})! Dính trạng thái BỎNG MỎ chạy vòng quanh bàn 3D suốt 10 giây!`
    );

    setTimeout(() => {
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.id === targetPlayerId ? { ...p, isSpicedMouth: false } : p
        ),
      }));
    }, 10000);
  };

  // Artistic Bottle Opener QTE
  const handleBottleOpenerQTE = (toolName: string, success: boolean) => {
    if (success) {
      sound.playCheer();
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser
            ? {
                ...p,
                coins: p.coins + 25,
                emptyBottlesCount: (p.emptyBottlesCount || 0) + 1,
                title: `Thánh Khui Bia Bằng ${toolName}`,
              }
            : p
        ),
      }));
      showToast(
        `🍾💥 PỐCCC!! Khui bia bằng ${toolName} chuẩn tâm vàng! Bọt trào trắng xóa (+25 Nắp Bia)!`
      );
    } else {
      sound.playHeadbutt();
      const victimName = sceneRef.current?.triggerThrowAtFriend();
      showToast(
        `💥 Á ĐÙ! Trượt QTE khi khui bằng ${toolName} — Nắp bia văng thẳng vào giữa trán ${
          victimName || 'bạn đối diện'
        }!`
      );
    }
  };

  // Empty Bottles / Cans Props
  const handleUseEmptyBottles = (action: 'stack_tower' | 'throw_can') => {
    if ((userPlayer.emptyBottlesCount || 0) <= 0) {
      showToast('🍾 Chưa có vỏ chai/lon rỗng nào! Hãy uống Bia Lon/Bia Chai trước nhé!');
      return;
    }
    if (action === 'stack_tower') {
      sound.playBell();
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
      showToast(
        `🗼 Đã xếp ${userPlayer.emptyBottlesCount} vỏ lon Tiger/Sài Gòn thành tháp cao chót vót trên bàn (+20 Nắp Bia)!`
      );
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, coins: p.coins + 20, emptyBottlesCount: 0 } : p
        ),
      }));
    } else {
      sound.playHeadbutt();
      const hitName = sceneRef.current?.triggerThrowAtFriend();
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser
            ? { ...p, emptyBottlesCount: Math.max(0, (p.emptyBottlesCount || 1) - 1) }
            : p
        ),
      }));
      showToast(
        `🥫 BỐP! Bạn ném vỏ lon bia rỗng trúng đầu ${hitName || 'bạn nhậu'} kêu cái keng!`
      );
    }
  };

  // 1-Stall Sidewalk WC Drama Handlers
  const handleEnterToilet = () => {
    if (toiletState.isOccupied || toiletState.blockerName) {
      showToast('🚪 Cửa WC 1 Buồng đang bị kẹt! Hãy đập cửa hối hoặc húc văng đứa chặn cửa!');
      return;
    }
    sound.playPour();
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.isUser
          ? {
              ...p,
              bladderLevel: 0,
              alcoholLevel: Math.max(0, p.alcoholLevel - 25),
              stamina: Math.min(100, p.stamina + 25),
              isWetPants: false,
            }
          : p
      ),
    }));
    setActiveModal('none');
    showToast(
      '🚽 AAAA NHẸ CẢ NGƯỜI! Đã xả sạch 100% Bụng Bia (bụng xẹp lại bình thường) & giảm 25% Độ Cồn!'
    );
  };

  const handleThumpToiletDoor = () => {
    sound.playSlap();
    setToiletState((prev) => {
      const nextTime = Math.max(0, prev.occupantTimeLeft - 8);
      const nowFree = nextTime === 0;
      if (nowFree) {
        showToast(
          `🚪🏃 RẦM RẦM! Bị bạn đập cửa dữ quá, ${prev.occupantName} phải kéo quần chạy vội ra khỏi WC!`
        );
      } else {
        showToast(
          `✊ RẦM RẦM! "Mày ở trỏng ngủ luôn hả ${prev.occupantName}?!" — Còn ${nextTime}s nữa nó ra!`
        );
      }
      return {
        ...prev,
        doorThumpCount: prev.doorThumpCount + 1,
        occupantTimeLeft: nextTime,
        isOccupied: !nowFree,
        occupantName: nowFree ? null : prev.occupantName,
      };
    });
  };

  const handlePushToiletBlocker = () => {
    sound.playHeadbutt();
    const blocker = toiletState.blockerName;
    setToiletState((prev) => ({ ...prev, blockerName: null }));
    showToast(
      `💥 BỐP! Bạn lao tới húc văng ${blocker} ra khỏi cửa Nhà Vệ Sinh 1 Buồng!`
    );
  };

  const handleHoldPee = () => {
    sound.playSlap();
    setToiletState((prev) => ({ ...prev, isHoldingPee: true }));
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.isUser
          ? { ...p, bladderLevel: Math.max(0, (p.bladderLevel || 0) - 12) }
          : p
      ),
    }));
    showToast(
      '😬 Bạn bắt chéo hai chân nhịn tiểu khẩn cấp — Giữ vững phong độ không bị "xả" tại ghế nhựa!'
    );
  };

  // Minigames Handlers
  const handleSelectMinigame = (gameId: MinigameId) => {
    if (gameId === 'bill_fight' && lobbyConfig && !lobbyConfig.rules.billBrawl) {
      sound.playHiccup();
      showToast('🪑🚫 Luật bàn: cấm hỗn chiến ném ghế giành Bill! Chia đều cho lành nha anh em.');
      return;
    }
    sound.playDiceShake();
    if (gameId === 'truth_or_dare') {
      const activeTargets = tableState.players.filter((p) => !p.isPassedOut);
      const randomTarget = activeTargets[Math.floor(Math.random() * activeTargets.length)] || userPlayer;
      setTruthDareTarget(randomTarget);
      setActiveModal('truth_or_dare');
    }
    setTableState((prev) => ({ ...prev, activeMinigame: gameId }));
  };

  const handleCrocodileToothPressed = (toothIdx: number, isTrap: boolean, victim: Player) => {
    sceneRef.current?.pressCrocodileTooth(toothIdx, isTrap);

    if (isTrap) {
      // Punish victim
      setTableState((prev) => {
        const updated = prev.players.map((p) => {
          if (p.id !== victim.id) return p;
          const newAlc = Math.min(100, p.alcoholLevel + 20);
          return {
            ...p,
            alcoholLevel: newAlc,
            isPassedOut: newAlc >= 100,
          };
        });
        return { ...prev, players: updated };
      });
      showToast(`🐊 ${victim.name} bị cá sấu cắn cụp tay! Phạt uống cạn ly bia (+20% cồn)!`);
    }
  };

  const handleSpinBottleSelected = (victim: Player, choice: 'drink' | 'truth_dare') => {
    if (choice === 'drink') {
      sound.playGulp();
      setTableState((prev) => {
        const updated = prev.players.map((p) => {
          if (p.id !== victim.id) return p;
          const newAlc = Math.min(100, p.alcoholLevel + 15);
          return { ...p, alcoholLevel: newAlc, isPassedOut: newAlc >= 100 };
        });
        return { ...prev, players: updated, activeMinigame: 'none' };
      });
      showToast(`🍺 ${victim.name} chấp nhận uống 1 ly phạt (+15% cồn)!`);
    } else {
      setTruthDareTarget(victim);
      setTableState((prev) => ({ ...prev, activeMinigame: 'none' }));
      setActiveModal('truth_or_dare');
    }
  };

  const handleLiarDiceFinished = (loser: Player) => {
    setTableState((prev) => {
      const updated = prev.players.map((p) => {
        if (p.id !== loser.id) return p;
        const newAlc = Math.min(100, p.alcoholLevel + 20);
        return { ...p, alcoholLevel: newAlc, isPassedOut: newAlc >= 100 };
      });
      return { ...prev, players: updated };
    });
    showToast(`🎲 ${loser.name} thua ván xí ngầu nói dối và bị phạt cạn ly!`);
  };

  const handleFifteenTwentyFinished = (loser: Player) => {
    setTableState((prev) => {
      const updated = prev.players.map((p) => {
        if (p.id !== loser.id) return p;
        const newAlc = Math.min(100, p.alcoholLevel + 15);
        return { ...p, alcoholLevel: newAlc, isPassedOut: newAlc >= 100 };
      });
      return { ...prev, players: updated };
    });
    showToast(`🖐️ ${loser.name} thua trò 15-20 và phải uống 1 ly phạt!`);
  };

  const handleBillFightFinished = (payer: Player, amount: number) => {
    setTableState((prev) => {
      const updated = prev.players.map((p) => {
        if (p.id !== payer.id) return p;
        return {
          ...p,
          coins: Math.max(0, p.coins - 80),
          alcoholLevel: Math.min(100, p.alcoholLevel + 25),
          title: 'Chúa Tể Bao Chầu',
        };
      });
      return { ...prev, players: updated, totalBill: 0 };
    });
    showToast(`🧾 ${payer.name} giữ bill lúc hết giờ và đã bao chầu (${amount.toLocaleString()} VNĐ)!`);
  };

  const handleTruthDareComplete = (drankPenalty: boolean) => {
    setActiveModal('none');
    if (drankPenalty && truthDareTarget) {
      setTableState((prev) => {
        const updated = prev.players.map((p) => {
          if (p.id !== truthDareTarget.id) return p;
          const newAlc = Math.min(100, p.alcoholLevel + 15);
          return { ...p, alcoholLevel: newAlc, isPassedOut: newAlc >= 100 };
        });
        return { ...prev, players: updated };
      });
      showToast(`${truthDareTarget.name} không dám làm thử thách nên đã uống 1 ly phạt!`);
    } else {
      showToast('🎉 Thử thách hoàn thành xuất sắc! Cả bàn hoan hô!');
    }
  };

  // Add Meme Bot
  const handleAddBot = () => {
    const memeNames = [
      { name: 'Anh Ba Bờ Kè', avatar: 'dog' as CharacterAvatar, title: 'Bợm Nhậu Lão Làng' },
      { name: 'Thánh Rót Bia Minh', avatar: 'duck' as CharacterAvatar, title: 'Kỹ Sư Đổ Bọt' },
      { name: 'Cô Tư Bán Mồi', avatar: 'cat' as CharacterAvatar, title: 'Chúa Tể Order' },
      { name: 'Hưng Say Sỉn', avatar: 'panda' as CharacterAvatar, title: 'Ngủ Dưới Gầm Bàn' },
    ];
    const available = memeNames.filter((m) => !tableState.players.some((p) => p.name === m.name));
    if (available.length === 0) return;

    const chosen = available[0];
    const newPlayer: Player = {
      id: `bot_${Date.now()}`,
      name: chosen.name,
      isUser: false,
      avatar: chosen.avatar,
      clothing: 'tanktop_red',
      hat: 'none',
      glassType: 'beer_mug',
      alcoholLevel: 10,
      stamina: 90,
      seatIndex: tableState.players.length,
      coins: 300,
      gems: 10,
      title: chosen.title,
      isPassedOut: false,
      faceDoodles: [],
      drinksCount: 1,
    };

    setTableState((prev) => ({
      ...prev,
      players: [...prev.players, newPlayer],
    }));
    showToast(`🍻 ${chosen.name} vừa tấp xe vào kéo ghế ngồi chung bàn!`);
  };

  const handleRemovePlayer = (id: string) => {
    setTableState((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== id),
    }));
  };

  const handleChangeTheme = (newTheme: PubTheme) => {
    const names: Record<PubTheme, string> = {
      sidewalk: 'Vỉa Hè Đèn Neon Sài Gòn',
      bo_ke: 'Quán Nhậu Bờ Kè Hoàng Hôn',
      rooftop: 'Bàn Nhậu Rooftop Chill',
    };
    setTableState((prev) => ({
      ...prev,
      theme: newTheme,
      themeName: names[newTheme],
    }));
    showToast(`Đã đổi không gian sang: ${names[newTheme]}`);
  };

  const handleApplyDoodles = (playerId: string, doodles: string[]) => {
    setTableState((prev) => {
      const updated = prev.players.map((p) =>
        p.id === playerId ? { ...p, faceDoodles: doodles } : p
      );
      return { ...prev, players: updated };
    });
    showToast('🎨 Đã lưu tác phẩm vẽ bậy lên mặt bạn say sập nguồn!');
  };

  const handleWakeUp = () => {
    sound.playPour();
    setTableState((prev) => {
      const updated = prev.players.map((p) =>
        p.isUser ? { ...p, alcoholLevel: 65, stamina: 50, isPassedOut: false } : p
      );
      return { ...prev, players: updated };
    });
    showToast('☕ Đã húp trọn ly nước chanh đá giải rượu! Tỉnh táo trở lại!');
  };

  // ============================================================================
  // LIVING CHAOS ARENA HANDLERS (5 NPCs, Weather, Urban Patrol & 4-Stage Flow)
  // ============================================================================
  const handleSmashGlassProvokeLandlady = () => {
    sound.playMugSlam();
    const nextBroken = arenaState.brokenGlassesCount + 1;
    if (nextBroken >= 5) {
      sound.playChairFall();
      setArenaState((prev) => ({ ...prev, brokenGlassesCount: 0 }));
      setTableState((prev) => ({
        ...prev,
        totalBill: prev.totalBill + 100000,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, isStunned: true, stamina: Math.max(0, p.stamina - 20) } : p
        ),
      }));
      setTimeout(() => {
        setTableState((prev) => ({
          ...prev,
          players: prev.players.map((p) =>
            p.isUser ? { ...p, isStunned: false } : p
          ),
        }));
      }, 3200);
      showToast(
        '🧹💥 BÀ CHỦ "SƯ TỬ HÀ ĐÔNG" LAO RA! Đập vỡ đủ 5 cái ly nên bị Bà Chủ cầm Chổi Lông Gà gõ đầu CHOÁNG 3 GIÂY & phạt +100.000đ vào Bill!'
      );
    } else {
      setArenaState((prev) => ({ ...prev, brokenGlassesCount: nextBroken }));
      showToast(
        `💥 XOẢNG! Bạn đập vỡ 1 cái ly cối (${nextBroken}/5)! Bà Chủ Tư Đực đang lườm sắc lẻm từ trong bếp!`
      );
    }
  };

  const handleTriggerLandladySlipperSniper = () => {
    sound.playHeadbutt();
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.isUser ? { ...p, isStunned: true } : p
      ),
    }));
    setTimeout(() => {
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, isStunned: false } : p
        ),
      }));
    }, 3000);
    showToast(
      '🩴🎯 BỐP! Bạn định chạy trốn tờ Hóa Đơn ra khỏi quán liền bị Bà Chủ tung tuyệt chiêu "PHI DÉP TỔ ONG TẦM XA" trúng đỉnh đầu 100%!'
    );
  };

  const handleToggleKaraokeArrival = () => {
    const next = !arenaState.isKaraokeActive;
    if (next) {
      sound.playKaraokeBeat();
      setCrowdDecibel(92);
      showToast(
        '🔊🎤 Anh Kéo Loa Kẹo Kéo LED vừa đẩy thùng loa tới sát bàn bật Vinahouse Bolero rung cả ly bia!'
      );
    } else {
      setCrowdDecibel(35);
      showToast('🔊 Loa kẹo kéo đã kéo sang bàn bên cạnh!');
    }
    setArenaState((prev) => ({ ...prev, isKaraokeActive: next }));
  };

  const handleKaraokeChoice = (choice: 'buy_gum' | 'steal_mic' | 'push_speaker') => {
    if (choice === 'buy_gum') {
      sound.playBell();
      setArenaState((prev) => ({
        ...prev,
        isKaraokeActive: false,
        hasHungPhanBuff: true,
      }));
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser
            ? {
                ...p,
                coins: Math.max(0, p.coins - 25),
                stamina: Math.min(100, p.stamina + 20),
              }
            : p
        ),
      }));
      showToast(
        '🤝 Đã mua ủng hộ 2 phong kẹo cao su (-25 Xu)! Anh kéo loa cảm ơn sang bàn khác và tặng cả bàn Buff "HƯNG PHẤN" (+20% Tỉnh Táo)!'
      );
    } else if (choice === 'steal_mic') {
      sound.playKaraokeBeat();
      sound.playLaugh();
      setCrowdDecibel(99);
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, coins: p.coins + 35, title: 'Ca Sĩ Loa Kẹo Kéo' } : p
        ),
      }));
      showToast(
        '🎤🎶 "ĐẮP MỘ CUỘC TÌNH..." — Bạn giật lấy Mic hát rống lên với hiệu ứng Echo vang vọng khắp bờ kè (+35 Nắp Bia)!'
      );
    } else {
      const retaliated = Math.random() < 0.45;
      if (retaliated) {
        sound.playHeadbutt();
        setTableState((prev) => ({
          ...prev,
          players: prev.players.map((p) =>
            p.isUser ? { ...p, stamina: Math.max(0, p.stamina - 15) } : p
          ),
        }));
        showToast(
          '👊💥 Bạn đẩy đổ cái loa kẹo kéo liền bị anh hát rong cầm cây bông tăm rượt đánh khắp bàn (-15% Tỉnh Táo)!'
        );
      } else {
        sound.playSlap();
        setArenaState((prev) => ({ ...prev, isKaraokeActive: false }));
        showToast('👊 Đã đẩy thùng loa kẹo kéo ra xa khỏi bàn nhậu!');
      }
    }
  };

  const handleBuyLotteryTicket = () => {
    sound.playBell();
    const luckyPool = ['686868', '797979', '397939', '888999', '123456', '999999'];
    const newTicket =
      luckyPool[Math.floor(Math.random() * luckyPool.length)];
    setArenaState((prev) => ({
      ...prev,
      lotteryTickets: [...prev.lotteryTickets, newTicket],
    }));
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.isUser ? { ...p, coins: Math.max(0, p.coins - 20) } : p
      ),
    }));
    showToast(
      `🎟️ Đã mua ủng hộ Cô Bán Vé Số Dạo tờ vé số đài Sài Gòn [${newTicket}] (-20 Nắp Bia)!`
    );
  };

  const handleDrawLotteryTV = () => {
    sound.playBell();
    const hasTickets = arenaState.lotteryTickets.length > 0;
    const isWin = hasTickets && Math.random() < 0.65;
    const winningNumber = isWin
      ? arenaState.lotteryTickets[arenaState.lotteryTickets.length - 1]
      : '049531';

    setArenaState((prev) => ({
      ...prev,
      lastLotteryDraw: winningNumber,
      isLotteryWinner: isWin,
    }));

    if (isWin) {
      confetti({ particleCount: 110, spread: 100, origin: { y: 0.5 } });
      sound.playCheer();
      setTableState((prev) => ({
        ...prev,
        totalBill: 0,
        players: prev.players.map((p) =>
          p.isUser
            ? {
                ...p,
                coins: p.coins + 500,
                title: 'Đại Gia Trúng Số Độc Đắc',
              }
            : p
        ),
      }));
      showToast(
        `📺💎 TRÚNG ĐỘC ĐẮC XỔ SỐ KIẾN THIẾT [${winningNumber}]!! Cơn mưa tiền rơi ngập bàn (+500 Xu) — Bạn thành ĐẠI GIA bao trọn chầu nhậu hôm nay (Bill = 0đ)!`
      );
    } else {
      sound.playChairFall();
      showToast(
        `📺😭 TV công bố Giải Đặc Biệt [${winningNumber}] — Trật lất hết rồi! Cả bàn khóc ròng xé vé số tung tóe dưới gầm bàn!`
      );
    }
  };

  const handleToastNeighborTable = () => {
    sound.playCheer();
    sceneRef.current?.triggerCheers(0.2);
    setTableState((prev) => ({
      ...prev,
      foodDishes: prev.foodDishes.map((d) =>
        d.id === 'chicken_feet' ? { ...d, servings: d.maxServings } : d
      ),
      players: prev.players.map((p) =>
        p.isUser
          ? {
              ...p,
              alcoholLevel: Math.min(100, p.alcoholLevel + 10),
              coins: p.coins + 35,
            }
          : p
      ),
    }));
    showToast(
      '🍻 "Giao lưu một ly anh ơi!" — Bạn uống thắng đại ca bàn kế bên nên được bàn đó tặng miễn phí 1 đĩa Chân Gà Nướng đầy ắp (+35 Xu)!'
    );
  };

  const handleProvokeNeighborBrawl = () => {
    sound.playChairFall();
    sound.playHeadbutt();
    sceneRef.current?.triggerThrowAtFriend();
    setArenaState((prev) => ({ ...prev, neighborBrawlActive: true }));
    setActiveModal('none');
    setTableState((prev) => ({
      ...prev,
      activeMinigame: 'bill_fight',
    }));
    showToast(
      '🪑💥 "MÀY NHÌN CÁI GÌ?!" — Bạn ném xương gà trúng đầu đại ca bàn kế bên kích hoạt HỖN CHIẾN LIÊN BÀN ném ghế đẩu nhựa đỏ/xanh!'
    );
  };

  const handleFeedCauVang = () => {
    sound.playDogBark();
    sceneRef.current?.triggerFeedDog();
    const nextAff = Math.min(100, arenaState.cauVangAffinity + 35);
    setArenaState((prev) => ({
      ...prev,
      cauVangAffinity: nextAff,
      droppedMorselsEatenByDog: prev.droppedMorselsEatenByDog + 1,
    }));
    showToast(
      nextAff >= 60
        ? `🐕❤️ GÂU GÂU! Độ thân thiết Cậu Vàng đạt ${nextAff}% — Cuối trận Giằng Hóa Đơn Cậu Vàng sẽ lao ra cắn quần đối thủ cứu bạn!`
        : `🐕🍖 Đã đút miếng chân gà nướng cho Cậu Vàng dưới gầm bàn (Độ thân thiết: ${nextAff}%)!`
    );
  };

  const handleTriggerRainEvent = () => {
    sound.playSplash();
    setArenaState((prev) => ({
      ...prev,
      isRaining: true,
      isTarpPulled: false,
      rainCountdown: 10,
    }));
    showToast(
      '🌧️⚡ TRỜI ĐỔ MƯA RÀO BẤT CHỢT! Mau bấm nút "KÉO BẠT CHE MƯA" trong 10 giây kẻo nước mưa làm loãng hết bia!'
    );
  };

  const handlePullRainTarp = () => {
    sound.playSlap();
    const nextPulled = !arenaState.isTarpPulled;
    setArenaState((prev) => ({
      ...prev,
      isTarpPulled: nextPulled,
      rainCountdown: 0,
    }));
    if (nextPulled) {
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, coins: p.coins + 30 } : p
        ),
      }));
      showToast(
        '⛺✅ Đã cùng nhau kéo tấm Bạt Xanh Cam che kín bàn nhậu! Bia không bị mưa làm loãng (+30 Nắp Bia)!'
      );
    } else {
      showToast('⛺ Đã thu gọn tấm bạt che mưa vỉa hè!');
    }
  };

  const handleTriggerUrbanPatrol = () => {
    sound.playSiren();
    setArenaState((prev) => ({
      ...prev,
      urbanPatrolActive: true,
      urbanPatrolCountdown: 10,
    }));
    showToast(
      '🚨🚓 CÒI HÚ PHƯỜNG ĐI DẸP VỈA HÈ! Trong 10 giây cả bàn phải hợp sức BÊ BÀN INOX lùi vào trong vạch sơn trắng!'
    );
  };

  const handleRetreatTableBehindWhiteLine = () => {
    sound.playCheer();
    setArenaState((prev) => ({
      ...prev,
      urbanPatrolActive: false,
      urbanPatrolCountdown: 0,
    }));
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.isUser ? { ...p, coins: p.coins + 40, stamina: Math.min(100, p.stamina + 15) } : p
      ),
    }));
    showToast(
      '🏃‍♂️🛡️ "Một, hai, ba BÊ!!" — Cả bàn hợp sức bê nguyên bàn inox và ghế nhựa thụt lùi vào trong vạch sơn trắng an toàn, không rớt miếng mồi nào (+40 Xu)!'
    );
  };

  const handleStepIntoMotorbikeLane = () => {
    sound.playHornBeep();
    setTimeout(() => {
      sound.playChairFall();
    }, 220);
    setIkState((prev) => ({
      ...prev,
      isFallenOffChair: true,
      chairBalance: 95,
    }));
    showToast(
      '🛵💥 BÍP BÍP... RẦM!! Bạn say quá đi lảo đảo lấn ra lòng đường bị xe Exciter tông Ragdoll bay ngược vào trong quán (Không chết nhưng choáng váng)!'
    );
  };

  const handleTossBottleIntoCrate = () => {
    sound.playMugSlam();
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.isUser
          ? {
              ...p,
              coins: p.coins + 15,
              emptyBottlesCount: (p.emptyBottlesCount || 0) + 1,
            }
          : p
      ),
    }));
    showToast(
      '🍾🎯 CẠCH! Ném chuẩn xác vỏ chai bia vào két nhựa bên chân ghế — Không sợ đi đứng loạng choạng đạp trúng trượt té (+15 Xu)!'
    );
  };

  const handleSelectMatchPhase = (phase: 1 | 2 | 3 | 4) => {
    setArenaState((prev) => ({ ...prev, currentMatchPhase: phase }));
    if (phase === 1) {
      sound.playCheer();
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, alcoholLevel: 18, stamina: 95 } : p
        ),
      }));
      showToast(
        '⏱️ [Phút 0-5: Nhập Tiệc Tỉnh Táo] Anh em mới vào bàn, cụng ly lịch sự, gắp mồi chuẩn xác!'
      );
    } else if (phase === 2) {
      sound.playKaraokeBeat();
      setArenaState((prev) => ({ ...prev, isKaraokeActive: true }));
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, alcoholLevel: 52, bladderLevel: 75 } : p
        ),
      }));
      showToast(
        '⏱️ [Phút 5-12: Cao Trào Ngà Ngà Say] Loa kẹo kéo kéo tới hát inh ỏi, cô bán vé số mời mua, bụng bia căng muốn chạy đi giành WC!'
      );
    } else if (phase === 3) {
      sound.playSiren();
      setArenaState((prev) => ({
        ...prev,
        isRaining: true,
        isTarpPulled: false,
        rainCountdown: 10,
        urbanPatrolActive: true,
        urbanPatrolCountdown: 10,
      }));
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, alcoholLevel: 82 } : p
        ),
      }));
      showToast(
        '⏱️ [Phút 12-15: Hỗn Loạn Quắc Cần Câu] Trời đổ mưa rào + Phường đi dẹp vỉa hè cùng lúc! Mau kéo bạt và bê bàn chạy ngay!'
      );
    } else {
      handleDrawLotteryTV();
      setActiveModal('none');
      setTimeout(() => {
        setTableState((prev) => ({ ...prev, activeMinigame: 'bill_fight' }));
      }, 1200);
    }
  };

  // ============================================================================
  // 6 MEME GENERATOR SYSTEMS & OVERHEAD DRUNK CHAT BUBBLE HANDLERS
  // ============================================================================
  const handleSendDrunkChat = (rawText: string, processed: ProcessedDrunkChat) => {
    setActiveChatBubble(processed);
    setArenaState((prev) => ({
      ...prev,
      drunkSubtitleBubble: {
        originalText: rawText,
        translatedMemeText: processed.displayText,
      },
    }));

    // Physics Text: If player typed "!" or ALL CAPS, slam the stainless steel table "RẦM!"
    if (processed.isShoutSpike) {
      sound.playTableSlam();
      setCrowdDecibel(95);
      setTimeout(() => setCrowdDecibel(35), 1500);
      showToast(
        `💥 RẦM!! Bạn đập mạnh tay xuống bàn inox gào lớn: "${processed.displayText}" làm ly bia nảy tưng tưng!`
      );
    } else if (processed.wasKeywordMutated) {
      sound.playLaugh();
      showToast(
        `🗣️🍻 Rượu vào lời ra! Bạn định gõ "${processed.rawText}" nhưng miệng lại lè nhè: "${processed.displayText}"!`
      );
    }
  };

  const handleTriggerDrunkSubtitle = (original: string, translated: string) => {
    const forceDrunkAlc = Math.max(76, userPlayer.alcoholLevel);
    const processed = processDrunkChat(original, forceDrunkAlc);
    const customBubble: ProcessedDrunkChat = {
      ...processed,
      rawText: original,
      displayText: translated || processed.displayText,
      wasKeywordMutated: true,
    };
    setActiveChatBubble(customBubble);
    if (customBubble.isShoutSpike) {
      sound.playTableSlam();
    } else {
      sound.playLaugh();
    }
    setArenaState((prev) => ({
      ...prev,
      drunkSubtitleBubble: {
        originalText: original,
        translatedMemeText: customBubble.displayText,
      },
    }));
    showToast(
      `🗣️🎙️ Rượu vào lời ra! Bạn nói "${original}" nhưng bong bóng 3D trên đầu lại hiện: "${customBubble.displayText}"`
    );
  };

  const handleStartExCallQTE = () => {
    sound.playBell();
    const nextTarget: 'Người Yêu Cũ 💔' | 'Sếp Tổng 🤬' =
      exCallTargetName === 'Người Yêu Cũ 💔' ? 'Sếp Tổng 🤬' : 'Người Yêu Cũ 💔';
    setExCallTargetName(nextTarget);
    setExCallResultReply(null);
    setArenaState((prev) => ({
      ...prev,
      exCallQTEActive: true,
      exCallCountdown: 10,
      exCallSnatchClicks: 0,
      isLovesickUnderTable: false,
    }));
    showToast(
      nextTarget === 'Sếp Tổng 🤬'
        ? '📱🚨 BÁO ĐỘNG ĐỎ (85% CỒN)! Bạn tự động rút ĐT nhắn tin chửi SẾP TỔNG — Cả bàn có 10s để giật ĐT hoặc ném đậu phộng cứu bạn!'
        : '📱💔 BÁO ĐỘNG ĐỎ (85% CỒN)! Bạn tự động rút Nokia nhắn tin cho NGƯỜI YÊU CŨ — Cả bàn có 10s để giật ĐT ném vào nồi lẩu!'
    );
  };

  const handleSnatchExPhone = (method: 'snatch_hotpot' | 'throw_ice' = 'snatch_hotpot') => {
    if (!arenaState.exCallQTEActive) return;
    sound.playSlap();
    const increment = method === 'throw_ice' ? 2 : 1;
    const nextClicks = arenaState.exCallSnatchClicks + increment;
    if (nextClicks >= 5) {
      sound.playSplash();
      confetti({ particleCount: 45, spread: 70, origin: { y: 0.6 } });
      setArenaState((prev) => ({
        ...prev,
        exCallQTEActive: false,
        exCallCountdown: 0,
        exCallSnatchClicks: 5,
      }));
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, coins: p.coins + 40, title: 'Anh Hùng Giật Điện Thoại' } : p
        ),
      }));
      showToast(
        method === 'throw_ice'
          ? '🧊🎯 BỐP! Tạt thẳng xô nước đá lạnh trúng đầu làm rơi chiếc điện thoại trước khi kịp bấm Gửi (+40 Xu)!'
          : '📱🍲 TỦM! Đã giật phăng chiếc điện thoại ném thẳng vào nồi Lẩu Thái sôi sùng sục — Cứu bạn khỏi nhục nhã (+40 Xu)!'
      );
    } else {
      setArenaState((prev) => ({
        ...prev,
        exCallSnatchClicks: nextClicks,
      }));
    }
  };

  // Lobby rule: "Vợ gọi điện kiểm tra" & "Công an phường dẹp vỉa hè" strike at random
  const randomEventRef = useRef<() => void>(() => {});
  randomEventRef.current = () => {
    if (
      activeModal !== 'none' ||
      tableState.activeMinigame !== 'none' ||
      arenaState.wifeCallActive ||
      arenaState.urbanPatrolActive
    ) {
      return;
    }
    if (Math.random() < 0.5) handleStartWifeCallStealth();
    else handleTriggerUrbanPatrol();
  };
  useEffect(() => {
    if (!lobbyConfig?.rules.randomEvents) return;
    let id = 0;
    const schedule = () => {
      id = window.setTimeout(() => {
        randomEventRef.current();
        schedule();
      }, 80000 + Math.random() * 60000);
    };
    schedule();
    return () => clearTimeout(id);
  }, []);

  const handleStartWifeCallStealth = () => {
    sound.playBell();
    setArenaState((prev) => ({
      ...prev,
      wifeCallActive: true,
      wifeCallCountdown: 8,
      wifeCallNoiseLevel: 22,
      isSummonedByWife: false,
    }));
    showToast(
      '📲🐅 NÓC NHÀ GỌI KIỂM TRA! Giữ độ ồn dưới 80% trong 8 giây! Coi chừng lũ bạn cố tình hét "Em ơi thêm két bia!" vào mic!'
    );
  };

  const handleShushFriendsDuringWifeCall = () => {
    if (!arenaState.wifeCallActive) return;
    sound.playSlap();
    setArenaState((prev) => ({
      ...prev,
      wifeCallNoiseLevel: Math.max(5, prev.wifeCallNoiseLevel - 28),
    }));
  };

  const handleSabotageShoutDuringWifeCall = () => {
    if (!arenaState.wifeCallActive) return;
    sound.playLaugh();
    setArenaState((prev) => ({
      ...prev,
      wifeCallNoiseLevel: Math.min(100, prev.wifeCallNoiseLevel + 35),
    }));
    showToast(
      '😈🗣️ Thằng bạn ghé sát điện thoại hét lớn: "EM GÁI ƠI CHO ANH THÊM 2 KÉT TIGER ĐÁ LẠNH NHÉ!!"'
    );
  };

  const handleActivateArchetype = (archetype: DrunkArchetypeId) => {
    const info = DRUNK_ARCHETYPES.find((a) => a.id === archetype);
    const nextRainbow = archetype === 'lion_puker';

    setArenaState((prev) => ({
      ...prev,
      activeArchetype: archetype,
      rainbowPuddleActive: nextRainbow,
    }));

    if (archetype === 'lion_puker') {
      sound.playSplash();
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser
            ? {
                ...p,
                alcoholLevel: Math.max(0, p.alcoholLevel - 30),
                stamina: Math.min(100, p.stamina + 25),
                title: 'Sư Tử Phun Cầu Vồng',
              }
            : p
        ),
      }));
      showToast(
        '🦁🌈 ỌEEE CẦU VỒNG LẤP LÁNH! Bạn "Cho chó ăn chè" ngay tại bàn (-30% Độ Cồn cho bạn, nhưng tạo bãi Cầu Vồng 3D trơn trượt dưới sàn)!'
      );
    } else if (archetype === 'mr_rich') {
      sound.playCheer();
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) => ({
          ...p,
          coins: p.isUser ? Math.max(0, p.coins - 45) : p.coins + 25,
        })),
      }));
      showToast(
        '💸🎉 HỆ HÀO PHÓNG TỶ PHÚ! Bạn rút ví ném mưa tiền boa khắp bàn nhậu ("Hôm nay anh bao tất!")!'
      );
    } else if (archetype === 'boxer') {
      sound.playHeadbutt();
      const hit = sceneRef.current?.triggerThrowAtFriend();
      showToast(
        `🥊💥 HỆ VÕ SĨ! Tăng +200% lực đẩy Ragdoll — Bạn múa quyền cước húc văng ${hit || 'bạn nhậu'}!`
      );
    } else if (archetype === 'ninja_escape') {
      sound.playSlap();
      showToast(
        '🥷💨 HỆ NINJA ĐỘN THỔ! Bò lết tàng hình dưới gầm bàn inox để lén chuồn về trước khi tính Bill!'
      );
    } else {
      sound.playBell();
      showToast(
        `🧘‍♂️📜 Kích hoạt ${info?.name}: Giảng đạo lý nhân sinh làm bạn nhậu buồn ngủ giảm Tỉnh Táo!`
      );
    }
  };

  const handleCompleteHotpotBeefDip = (
    outcome: 'perfect_5s' | 'overcooked' | 'stolen_by_friend' | 'spilled_pot'
  ) => {
    if (outcome === 'perfect_5s') {
      sound.playCheer();
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser
            ? {
                ...p,
                alcoholLevel: Math.max(0, p.alcoholLevel - 20),
                stamina: Math.min(100, p.stamina + 30),
                coins: p.coins + 25,
                title: 'Bếp Trưởng Nhúng Bò 5 Giây',
              }
            : p
        ),
      }));
      showToast(
        '🥩✨ BÒ TÁI HOÀN HẢO (4.8s)! Thịt bò mềm ngọt chuẩn Wagyu (-20% Cồn, +30% Tỉnh Táo, +25 Xu)!'
      );
    } else if (outcome === 'stolen_by_friend') {
      sound.playLaugh();
      showToast(
        '🥢😈 HỚT TAY TRÊN! Đúng giây thứ 4.0 khi thịt bò vừa chín tới, Khoa Nguyên đã thò đũa cướp sạch miếng bò trên muôi của bạn!'
      );
    } else if (outcome === 'spilled_pot') {
      sound.playChairFall();
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, bladderLevel: 100 } : p
        ),
      }));
      showToast(
        '🤢🥩 BÒ CÒN SỐNG NHĂN (<3s)! Bạn ăn trúng bò tái sống bị ĐAU BỤNG TÀO THÁO RƯỢT (100% Bụng Bia — Chạy đi WC ngay)!'
      );
    } else {
      sound.playSlap();
      setTableState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.isUser ? { ...p, stamina: Math.max(0, p.stamina - 10) } : p
        ),
      }));
      showToast(
        '👞🥩 QUÁ LỬA (>6s)! Miếng thịt bò teo quắt dai nhách như nhai đế dép tổ ong (-10% Tỉnh Táo)!'
      );
    }
  };

  const handleChangePartyStage = (stage: PartyStageId) => {
    setArenaState((prev) => ({
      ...prev,
      partyStage: stage,
      isKaraokeActive: stage === 'karaoke_stage2' ? true : prev.isKaraokeActive,
      karaokeGoldenMicHolder:
        stage === 'karaoke_stage2' ? userPlayer.name : prev.karaokeGoldenMicHolder,
    }));

    if (stage === 'taxi_transfer') {
      sound.playHornBeep();
      showToast(
        '🛺💨 TĂNG 2 CHUYỂN BÃI! Cả đám khoác vai nhau loạng choạng trèo lên Xe Ba Gác / Taxi phóng tới Quán Karaoke!'
      );
    } else if (stage === 'karaoke_stage2') {
      sound.playKaraokeBeat();
      confetti({ particleCount: 80, spread: 90, origin: { y: 0.5 } });
      showToast(
        '🪩🎤 CHÀO MỪNG TỚI TĂNG 2: PHÒNG KARAOKE ÁNH SÁNG TÍM DISCO! Giành Mic Vàng và lắc Tambourine theo nhịp!'
      );
    } else {
      showToast('🍻 Đã quay về Tăng 1: Quán Nhậu Tư Đực - Bờ Kè Vỉa Hè!');
    }
  };

  const handleSingKaraokeBeat = () => {
    sound.playKaraokeBeat();
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
    setArenaState((prev) => ({
      ...prev,
      karaokeScore: Math.min(100, prev.karaokeScore + 15),
      karaokeGoldenMicHolder: userPlayer.name,
    }));
    setTableState((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.isUser
          ? {
              ...p,
              coins: p.coins + 20,
              stamina: Math.min(100, p.stamina + 10),
              title: 'Thần Tượng Karaoke Tăng 2',
            }
          : p
      ),
    }));
    showToast(
      '🎤🎶 "ĐẮP MỘ CUỘC TÌNH..." — Hát chuẩn nhịp Mic Vàng + Lắc lục lạc Tambourine cực sung (+20 Nắp Bia)!'
    );
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-zinc-950 font-sans">
      {/* 3D WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className={`absolute inset-0 w-full h-full z-0 touch-none ${
          isPointerLocked ? 'cursor-none' : isDragLookFallback ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
        }`}
      />

      {/* Mouse-look crosshair & lock hint (desktop mice only) */}
      {isPointerLocked ? (
        <>
          <div className="pointer-events-none fixed left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <div className="relative w-6 h-6">
              <div className="absolute left-1/2 top-0 h-2 w-0.5 -translate-x-1/2 rounded bg-white/90 shadow" />
              <div className="absolute left-1/2 bottom-0 h-2 w-0.5 -translate-x-1/2 rounded bg-white/90 shadow" />
              <div className="absolute top-1/2 left-0 w-2 h-0.5 -translate-y-1/2 rounded bg-white/90 shadow" />
              <div className="absolute top-1/2 right-0 w-2 h-0.5 -translate-y-1/2 rounded bg-white/90 shadow" />
              <div className="absolute left-1/2 top-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400" />
            </div>
          </div>
          <div className="pointer-events-none fixed left-1/2 bottom-28 z-10 -translate-x-1/2 px-3 py-1 rounded-full bg-black/55 text-[11px] font-bold text-white/85">
            🖱️ Rê chuột xoay góc nhìn • Click tương tác ở tâm ngắm • <b className="text-amber-300">Esc</b> hiện chuột
          </div>
        </>
      ) : (
        activeModal === 'none' &&
        tableState.activeMinigame === 'none' && (
          <div className="pointer-events-none fixed left-1/2 bottom-28 z-10 -translate-x-1/2 hidden pointer-fine:block px-3 py-1 rounded-full bg-black/55 text-[11px] font-bold text-white/85 animate-pulse">
            {isDragLookFallback
              ? '🖱️ Giữ & kéo chuột để xoay góc nhìn (trình duyệt này không cho khóa chuột)'
              : '🖱️ Click vào màn hình để khóa chuột & xoay góc nhìn'}
          </div>
        )
      )}

      {/* Top HUD */}
      <TopBar
        userPlayer={userPlayer}
        tableState={tableState}
        isBgmActive={isBgmActive}
        onToggleBgm={() => {
          const next = !isBgmActive;
          setIsBgmActive(next);
          sound.toggleBGM(next);
        }}
        onOpenLobby={() => setActiveModal('lobby')}
        onOpenShop={() => setActiveModal('shop')}
        onOpenDrinkModal={() => {
          setDrinkModalTab('wc');
          setActiveModal('drink_bladder');
        }}
        onOpenAuth={() => setActiveModal('auth')}
      />

      {/* Urgent Living Chaos Event Banner (Rain Tarp QTE, Urban Patrol, or Wife Call Stealth) */}
      {(arenaState.isRaining && !arenaState.isTarpPulled) ||
      arenaState.urbanPatrolActive ||
      arenaState.wifeCallActive ? (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-2 pointer-events-auto px-3">
          {arenaState.isRaining && !arenaState.isTarpPulled && (
            <button
              onClick={handlePullRainTarp}
              className="bg-sky-600 hover:bg-sky-500 text-white border-2 border-sky-200 rounded-2xl px-4 py-2 text-xs font-black shadow-2xl flex items-center gap-2 animate-bounce cursor-pointer"
            >
              <CloudRain className="w-4 h-4" />
              <span>
                🌧️ MƯA RÀO BẤT CHỢT ({arenaState.rainCountdown}s) — BẤM KÉO BẠT CHE MƯA NGAY!
              </span>
              <Umbrella className="w-4 h-4" />
            </button>
          )}
          {arenaState.urbanPatrolActive && (
            <button
              onClick={handleRetreatTableBehindWhiteLine}
              className="bg-rose-600 hover:bg-rose-500 text-white border-2 border-rose-200 rounded-2xl px-4 py-2 text-xs font-black shadow-2xl flex items-center gap-2 animate-bounce cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>
                🚨 ĐÔ THỊ DẸP VỈA HÈ ({arenaState.urbanPatrolCountdown}s) — BẤM BÊ BÀN LÙI VÀO VẠCH TRẮNG!
              </span>
            </button>
          )}
          {arenaState.wifeCallActive && (
            <button
              onClick={handleShushFriendsDuringWifeCall}
              className="bg-amber-600 hover:bg-amber-500 text-zinc-950 border-2 border-amber-200 rounded-2xl px-4 py-2 text-xs font-black shadow-2xl flex items-center gap-2 animate-bounce cursor-pointer"
            >
              <span>
                🤫🐅 NÓC NHÀ ĐANG GỌI ({arenaState.wifeCallCountdown}s | Ồn: {arenaState.wifeCallNoiseLevel}%) — BẤM "SUỴT!" BỊT MIỆNG BẠN NHẬU!
              </span>
            </button>
          )}
        </div>
      ) : null}

      {/* 3D Overhead Drunk Chat Bubble, Quick-Chat Wheel [Q], Animalese TTS & Ex/Boss QTE Bubble */}
      <OverheadDrunkChatHUD
        userPlayer={userPlayer}
        activeChatBubble={activeChatBubble}
        exCallQTEActive={arenaState.exCallQTEActive}
        exCallCountdown={arenaState.exCallCountdown}
        exCallSnatchClicks={arenaState.exCallSnatchClicks}
        exCallTargetName={exCallTargetName}
        exCallResultReply={exCallResultReply}
        isLovesickUnderTable={arenaState.isLovesickUnderTable}
        lovesickTimer={arenaState.lovesickTimer}
        onSendChat={handleSendDrunkChat}
        onSnatchExPhonePhysical={() => handleSnatchExPhone('snatch_hotpot')}
        onInterruptExPhoneWithPeanutOrIce={() => handleSnatchExPhone('throw_ice')}
      />

      {/* NPC Phi Quân (Gấu Trúc >= 80% Alcohol) Auto-Call to NYC Mai Anh, NPC Khoa Nguyễn (Gấu Nâu >= 80% Alcohol) Tree Climbing & NPC Nga Phan (Chuột Hamster 0% Cồn) */}
      <PhiQuanMaiAnhCallHUD
        phiQuanPlayer={phiQuanPlayer}
        countdown={phiQuanCallCountdown}
        stopProgress={phiQuanStopProgress}
        lastStopLog={phiQuanLastStopLog}
        onForcePhiQuan80Percent={handleForcePhiQuan80Percent}
        onStopPhiQuanAction={handleStopPhiQuanAction}
        onComfortHeartbrokenPhiQuan={handleComfortHeartbrokenPhiQuan}
        khoaNguyenPlayer={khoaNguyenPlayer}
        onForceKhoaNguyen80Percent={handleForceKhoaNguyen80Percent}
        onGetKhoaDownFromTree={handleGetKhoaDownFromTree}
        ngaPhanPlayer={ngaPhanPlayer}
        onTriggerNgaPhanDestroyFood={handleTriggerNgaPhanDestroyFood}
      />

      {/* Quán Nhậu Open-World Sandbox HUD ("Tổ Hợp Ăn Chơi Xuyên Đêm" - 4 Zones, Ragdoll, Heavy Props & Events) */}
      <OpenWorldSandboxHUD
        userPlayer={userPlayer}
        players={tableState.players}
        ikState={ikState}
        yellowPuddleActive={yellowPeePuddleActive}
        onToggleFreeRoam={handleToggleControlMode}
        onNavigateZone={handleNavigateZone}
        onToggleCrawlingMode={handleToggleCrawlingMode}
        onToggleGrabSupport={handleToggleGrabSupport}
        onRecoverFaceplant={handleRecoverFaceplant}
        onTriggerDrunkInputDriftStep={handleTriggerDrunkInputDriftStep}
        onKitchenFlipGrill={handleKitchenFlipGrill}
        onAlleySneakAction={handleAlleySneakAction}
        onAtmStoreAction={handleAtmStoreAction}
        onCarryOrThrowHeavyProp={handleCarryOrThrowHeavyProp}
        onPushFoodCartCrash={handlePushFoodCartCrash}
        onToggleWingmanCarry={handleToggleWingmanCarry}
        onTackleBeerTrayFriend={handleTackleBeerTrayFriend}
        onTriggerPatrolRetreatTable={() => {
          if (arenaState.urbanPatrolActive) {
            handleRetreatTableBehindWhiteLine();
          } else {
            handleTriggerUrbanPatrol();
          }
        }}
        onStartUrgentPeeRush={handleStartUrgentPeeRush}
        onRivalTableAction={handleRivalTableAction}
      />

      {/* Live Toast Notification Banner */}
      {toastNotification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all">
          <div className="bg-zinc-900 border border-amber-500/80 rounded-2xl px-4 py-2 text-xs font-bold text-amber-300 shadow-2xl flex items-center gap-2 animate-bounce">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <span>{toastNotification}</span>
          </div>
        </div>
      )}

      {/* Drunken Screen Post-FX (Chromatic Aberration, Dozing Blink, Cold Towel Splash, Craft Beer, Stun, Spotlight) */}
      <DrunkEffectOverlay
        alcoholLevel={userPlayer.alcoholLevel}
        coldTowelBuffTimer={ikState.coldTowelBuffTimer}
        waterSplashActive={waterSplashActive}
        craftBeerHallucination={craftBeerHallucination}
        isStunned={userPlayer.isStunned}
        isSpicedMouth={userPlayer.isSpicedMouth}
        spotlightVictimName={spotlightVictimName}
        cheatingAlertText={cheatingAlertText}
        onWakeUp={handleWakeUp}
      />

      {/* Contextual Camera System & Physics IK Hand Controls HUD */}
      <CameraAndControlsHUD
        alcoholLevel={userPlayer.alcoholLevel}
        ikState={ikState}
        isMicActive={tableState.isMicCheersActive}
        crowdDecibel={crowdDecibel}
        onToggleCameraPOV={handleToggleCameraPOV}
        onToggleControlMode={handleToggleControlMode}
        onTriggerColdTowel={handleTriggerColdTowel}
        onTriggerEmote={handleTriggerEmote}
        onNudgeChairBalance={(delta) =>
          setIkState((prev) => ({
            ...prev,
            chairBalance: Math.max(-95, Math.min(95, prev.chairBalance + delta)),
          }))
        }
        onRecoverFromChairFall={() => {
          sound.playSlap();
          setIkState((prev) => ({
            ...prev,
            isFallenOffChair: false,
            chairBalance: 0,
          }));
          showToast('🪑 Đã lồm cồm bò dậy ngồi lại ngay ngắn trên ghế nhựa!');
        }}
        onUpdateAim={(aimX, aimY) =>
          setIkState((prev) => ({ ...prev, aimX, aimY }))
        }
        onMoveFreeRoam={(dx, dz) => {
          walkStepCountRef.current += 1;
          if (walkStepCountRef.current % 12 === 0) {
            setTableState((ts) => ({
              ...ts,
              players: ts.players.map((p) =>
                p.isUser && p.alcoholLevel > 0
                  ? {
                      ...p,
                      alcoholLevel: Math.max(0, p.alcoholLevel - 1),
                      stamina: Math.min(100, p.stamina + 2),
                    }
                  : p
              ),
            }));
          }
          setIkState((prev) => {
            const nx = Math.max(-4.8, Math.min(4.8, prev.freeRoamPos.x + dx));
            const nz = Math.max(-3.6, Math.min(3.8, prev.freeRoamPos.z + dz));
            const angle = Math.atan2(dx, dz);
            return {
              ...prev,
              freeRoamPos: { x: nx, z: nz, angle, isMoving: true },
            };
          });
        }}
        onHoldGrab={(holding) =>
          setIkState((prev) => {
            if (!holding && prev.isGrabbing) {
              const victim = sceneRef.current?.triggerThrowAtFriend();
              if (victim) {
                sound.playHeadbutt();
                showToast(
                  `🧊 BỐP! Bạn vung tay ném thẳng viên đá lạnh vào mặt ${victim}!`
                );
              }
            }
            return { ...prev, isGrabbing: holding };
          })
        }
        onHoldCheersCenter={(holding) => {
          setIkState((prev) => ({ ...prev, isCheersHolding: holding }));
          if (holding) setCrowdDecibel(62);
        }}
        onDrinkOrEat={handleDrinkOrEatWithHand}
        onHeadbutt={handleHeadbutt}
        onShoutCrowdDecibel={() => {
          setCrowdDecibel(98);
          showToast('🗣️ "1, 2, 3 DZÔÔÔ!" — Cột âm lượng vọt qua vạch đỏ! Cụng ly Slow-Mo!');
          handleExecuteCheersToast('full_100', 'perfect', 72);
          setTimeout(() => setCrowdDecibel(32), 1800);
        }}
      />

      {/* Interactive 3-Phase "1, 2, 3 DZÔ!" HUD Overlay (Clink Force Timing + Cup Level + 100%/50%/10% Lip-Sip) */}
      {activeModal === 'cheers_toast' && (
        <CheersToastModal
          userPlayer={userPlayer}
          cupState={cupState}
          beerTowerLevel={tableState.beerTowerLevel}
          onQuickRefillCup={handleQuickRefillCup}
          onExecuteCheers={handleExecuteCheersToast}
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* Living Chaos Arena Modal: Quán Nhậu Tư Đực - Bờ Kè & 5 NPCs + Weather/Urban Events */}
      {activeModal === 'chaos_arena' && (
        <LivingChaosArenaModal
          initialTab={chaosArenaTab}
          userPlayer={userPlayer}
          arenaState={arenaState}
          totalBill={tableState.totalBill}
          onCallWaiterRefill={handleCallWaiter}
          onSmashGlassProvokeLandlady={handleSmashGlassProvokeLandlady}
          onTriggerLandladySlipperSniper={handleTriggerLandladySlipperSniper}
          onToggleKaraokeArrival={handleToggleKaraokeArrival}
          onHandleKaraokeChoice={handleKaraokeChoice}
          onBuyLotteryTicket={handleBuyLotteryTicket}
          onDrawLotteryTV={handleDrawLotteryTV}
          onToastNeighborTable={handleToastNeighborTable}
          onProvokeNeighborBrawl={handleProvokeNeighborBrawl}
          onFeedCauVang={handleFeedCauVang}
          onTriggerRainEvent={handleTriggerRainEvent}
          onPullRainTarp={handlePullRainTarp}
          onTriggerUrbanPatrol={handleTriggerUrbanPatrol}
          onRetreatTableBehindWhiteLine={handleRetreatTableBehindWhiteLine}
          onStepIntoMotorbikeLane={handleStepIntoMotorbikeLane}
          onTossBottleIntoCrate={handleTossBottleIntoCrate}
          onSelectMatchPhase={handleSelectMatchPhase}
          onTriggerDrunkSubtitle={handleTriggerDrunkSubtitle}
          onStartExCallQTE={handleStartExCallQTE}
          onSnatchExPhone={() => handleSnatchExPhone('snatch_hotpot')}
          onStartWifeCallStealth={handleStartWifeCallStealth}
          onShushFriendsDuringWifeCall={handleShushFriendsDuringWifeCall}
          onSabotageShoutDuringWifeCall={handleSabotageShoutDuringWifeCall}
          onActivateArchetype={handleActivateArchetype}
          onCompleteHotpotBeefDip={handleCompleteHotpotBeefDip}
          onChangePartyStage={handleChangePartyStage}
          onSingKaraokeBeat={handleSingKaraokeBeat}
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* Interactive Drink Tiers, Pouring & Foam Physics, Ice Bucket, Tricks & 1-Stall WC Modal */}
      {activeModal === 'drink_bladder' && (
        <DrinkAndBladderModal
          initialTab={drinkModalTab}
          userPlayer={userPlayer}
          players={tableState.players}
          cupState={cupState}
          toiletState={toiletState}
          onSelectDrinkTier={handleSelectDrinkTier}
          onPourDrink={handlePourDrink}
          onScoldPourerAndForceDrink={handleScoldPourerAndForceDrink}
          onAddIceToCup={handleAddIceToCup}
          onThrowIceAtFriendCollar={handleThrowIceAtFriendCollar}
          onDrinkCup={handleDrinkCup}
          onSleightOfHand={handleSleightOfHand}
          onMixPoisonCocktail={handleMixPoisonCocktail}
          onBottleOpenerQTE={handleBottleOpenerQTE}
          onUseEmptyBottles={handleUseEmptyBottles}
          onEnterToilet={handleEnterToilet}
          onThumpToiletDoor={handleThumpToiletDoor}
          onPushToiletBlocker={handlePushToiletBlocker}
          onHoldPee={handleHoldPee}
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* Interactive Food Grabbing & Chopstick Clash Modal */}
      {activeModal === 'food_grab' && (
        <FoodGrabModal
          dishes={tableState.foodDishes}
          players={tableState.players}
          userPlayer={userPlayer}
          initialDishId={selectedFoodDishId}
          onExecuteGrab={handleExecuteGrab}
          onOrderDish={handleOrderDish}
          onStartClashStateChange={(active: boolean, dishId?: string) => {
            sceneRef.current?.setChopstickClash(active, dishId);
          }}
          onClose={() => {
            sceneRef.current?.setChopstickClash(false);
            setActiveModal('none');
          }}
        />
      )}

      {/* Active Minigame Overlays */}
      {tableState.activeMinigame === 'crocodile' && (
        <CrocodileGame
          players={tableState.players}
          userPlayer={userPlayer}
          onToothPressed={handleCrocodileToothPressed}
          onClose={() => {
            sceneRef.current?.resetCrocodile();
            setTableState((prev) => ({ ...prev, activeMinigame: 'none' }));
          }}
        />
      )}

      {tableState.activeMinigame === 'spin_bottle' && (
        <SpinBottleGame
          players={tableState.players}
          onTriggerSpinIn3D={() => sceneRef.current?.spinBottle()}
          onPlayerSelected={handleSpinBottleSelected}
          onClose={() => setTableState((prev) => ({ ...prev, activeMinigame: 'none' }))}
        />
      )}

      {tableState.activeMinigame === 'liars_dice' && (
        <LiarDiceGame
          players={tableState.players}
          userPlayer={userPlayer}
          onFinishGame={handleLiarDiceFinished}
          onClose={() => setTableState((prev) => ({ ...prev, activeMinigame: 'none' }))}
        />
      )}

      {tableState.activeMinigame === 'fifteen_twenty' && (
        <FifteenTwentyGame
          players={tableState.players}
          userPlayer={userPlayer}
          onFinishGame={handleFifteenTwentyFinished}
          onClose={() => setTableState((prev) => ({ ...prev, activeMinigame: 'none' }))}
        />
      )}

      {tableState.activeMinigame === 'bill_fight' && (
        <BillFightGame
          players={tableState.players}
          userPlayer={userPlayer}
          totalBill={tableState.totalBill}
          onFinishFight={handleBillFightFinished}
          onClose={() => setTableState((prev) => ({ ...prev, activeMinigame: 'none' }))}
        />
      )}

      {/* Secondary Modals & Truth or Dare */}
      {(activeModal === 'truth_or_dare' || tableState.activeMinigame === 'truth_or_dare') && (
        <TruthOrDareModal
          players={tableState.players}
          targetPlayer={truthDareTarget || userPlayer}
          onComplete={handleTruthDareComplete}
          onClose={() => {
            setActiveModal('none');
            setTableState((prev) => ({ ...prev, activeMinigame: 'none' }));
          }}
        />
      )}

      {activeModal === 'face_doodle' && doodleVictim && (
        <FaceDoodleModal
          victim={doodleVictim}
          onApplyDoodles={handleApplyDoodles}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'shop' && (
        <ShopModal
          userPlayer={userPlayer}
          onUpdateCosmetics={(updates) => {
            setTableState((prev) => ({
              ...prev,
              players: prev.players.map((p) =>
                p.isUser ? { ...p, ...updates } : p
              ),
            }));
          }}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'lobby' && (
        <TableLobbyModal
          roomId={tableState.roomId}
          theme={tableState.theme}
          players={tableState.players}
          onAddBot={handleAddBot}
          onRemovePlayer={handleRemovePlayer}
          onChangeTheme={handleChangeTheme}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'auth' && (
        <AuthPanelModal
          isOpen={true}
          onClose={() => setActiveModal('none')}
          onSuccess={(session) => {
            setTableState((prev) => ({
              ...prev,
              players: prev.players.map((p) =>
                p.isUser
                  ? {
                      ...p,
                      name: session.username,
                      avatar: session.avatar,
                      title: session.title,
                      coins: p.coins + 500,
                    }
                  : p
              ),
            }));
            setActiveModal('none');
            showToast(`🍻 Chào mừng ${session.username}! Đã cập nhật Hộ Chiếu Tửu Lượng & tặng +500 Nắp Bia!`);
          }}
        />
      )}

      {/* Unified Collapsible Bottom Dock (Zero Viewport Occlusion) */}
      <BottomDock
        userPlayer={userPlayer}
        dishes={tableState.foodDishes}
        cupLiquidLevel={cupState.liquidLevel}
        isMicActive={tableState.isMicCheersActive}
        isFoodModalOpen={activeModal === 'food_grab'}
        isDrinkModalOpen={activeModal === 'drink_bladder'}
        isChaosArenaOpen={activeModal === 'chaos_arena'}
        hasUrgentArenaEvent={
          (arenaState.isRaining && !arenaState.isTarpPulled) ||
          arenaState.urbanPatrolActive ||
          arenaState.exCallQTEActive ||
          arenaState.wifeCallActive
        }
        onCheers={handleCheersWithTableRules}
        onToggleMic={handleToggleMic}
        onOpenFoodModal={() =>
          setActiveModal((prev) => (prev === 'food_grab' ? 'none' : 'food_grab'))
        }
        onOpenDrinkModal={(tab = 'drinks') => {
          setDrinkModalTab(tab);
          setActiveModal((prev) =>
            prev === 'drink_bladder' && drinkModalTab === tab ? 'none' : 'drink_bladder'
          );
        }}
        onOpenChaosArena={(tab = 'meme_systems') => {
          setChaosArenaTab(tab);
          setActiveModal((prev) =>
            prev === 'chaos_arena' && chaosArenaTab === tab ? 'none' : 'chaos_arena'
          );
        }}
        onCallWaiter={handleCallWaiter}
        onGoToToilet={handleEnterToilet}
        onSelectMinigame={handleSelectMinigame}
        onOpenShop={() => setActiveModal('shop')}
      />
    </div>
  );
}
