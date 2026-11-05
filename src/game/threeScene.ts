import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createStainlessTable,
  createPlasticStool,
  createBeerTower,
  createCrocodileToy,
  createSpinningBottle,
  createChopsticksPair,
  createFairyLights,
  createSidewalkTexture,
  createNeonSign,
  createBeerCrates,
  createStreetFoodCart,
  createIceBucket,
  createToiletBooth,
  createBeerMug,
  createFloorLitterAndBottles,
  createCauVangDog,
  createStreetMotorbike,
  createRetractableTarp,
  createKaraokeSpeakerRig,
  createNeighborTableGroup,
  createSidewalkGreenTree,
  createOpenCharcoalKitchen,
  createConvenienceStoreAndATM,
  createStandingIndustrialFan,
  createYellowPeePuddle,
} from './proceduralModels';
import { createChibiCharacter, CharacterRig, CheersAnimPhase } from './characterModel';
import { createStreetBackdrop, StreetBackdrop } from './environment';
import { createFoodPlatter, createTableClutter } from './foodModels';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Tames specular fireflies / NaNs before bloom, otherwise one hot pixel blooms into a white blob
const HdrClampShader = {
  uniforms: { tDiffuse: { value: null }, maxValue: { value: 3.0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float maxValue;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c.rgb)) || any(isinf(c.rgb))) c.rgb = vec3(0.0);
      c.rgb = min(c.rgb, vec3(maxValue));
      gl_FragColor = c;
    }
  `,
};
import {
  Player,
  MinigameId,
  FoodDish,
  IKHandControlState,
} from './types';

export interface SceneController {
  mount: (container: HTMLDivElement) => void;
  destroy: () => void;
  updatePlayers: (players: Player[]) => void;
  updateFoodDishes: (dishes: FoodDish[]) => void;
  updateIKState: (state: IKHandControlState) => void;
  setToiletOccupied: (occupied: boolean) => void;
  setUserCupFillRatio: (ratio: number) => void;
  triggerCheers: (targetEndFillRatio?: number) => void;
  triggerChopstickGrab: (dishId: string, targetPlayerId: string, isSpicy?: boolean) => void;
  triggerThrowAtFriend: () => string | null;
  triggerFeedDog: () => void;
  triggerTreeShake: () => void;
  triggerPushFoodCartCrash: () => void;
  triggerFlipNeighborTable: () => void;
  setYellowPeePuddleActive: (active: boolean) => void;
  setRainAndTarp: (raining: boolean, tarpPulled: boolean) => void;
  setKaraokeSpeakerActive: (active: boolean) => void;
  setRainbowPuddleActive: (active: boolean) => void;
  setKaraokeDiscoRoomMode: (active: boolean) => void;
  setChopstickClash: (active: boolean, dishId?: string) => void;
  setActiveMinigame: (minigame: MinigameId) => void;
  spinBottle: () => void;
  pressCrocodileTooth: (toothIndex: number, isTrap: boolean) => void;
  resetCrocodile: () => void;
  setUserDrunkLevel: (level: number) => void;
  onToothClick?: (index: number) => void;
  onFoodClick?: (type: string) => void;
  onBottleClick?: () => void;
  onIceBucketClick?: () => void;
  onToiletClick?: () => void;
  onCauVangClick?: () => void;
  onNeighborTableClick?: () => void;
  onKaraokeSpeakerClick?: () => void;
  onGreenTreeClick?: () => void;
  onOpenKitchenClick?: () => void;
  onConvenienceATMClick?: () => void;
  onIndustrialFanClick?: () => void;
  onPassedOutFaceClick?: (playerId: string) => void;
  onPointerAimChange?: (aimX: number, aimY: number) => void;

  // ---- 3D Interactive Lobby (Main Menu) ----
  setLobbyMode: (mode: LobbyMode) => void;
  /** Screen-space anchors (px, relative to the mount div) for each of the 8 lobby seats. */
  getLobbyAnchors: () => LobbyAnchor[];
  triggerLobbyReaction: (playerId: string, kind: LobbyReaction) => void;
  onLobbyCharacterClick?: (playerId: string) => void;
  onLobbySeatClick?: (seatIndex: number) => void;
  // ---- In-match mouse look (Pointer Lock) ----
  /** Fired when the cursor gets locked to the 3D view (click) or released (Esc / UI). */
  onPointerLockChange?: (locked: boolean, unavailable?: boolean) => void;
  releasePointerLock: () => void;
  /** Horizontal camera rotation from mouse look, so WASD can move relative to the view. */
  getCameraYaw: () => number;
  /** 'low' drops pixel ratio to 1 and disables shadows for weak devices. */
  setGraphicsQuality: (quality: 'low' | 'high') => void;
}

export type LobbyMode = 'off' | 'lobby' | 'wardrobe';
export type LobbyReaction = 'slap' | 'tickle' | 'munch';

export interface LobbyAnchor {
  seatIndex: number;
  x: number;
  y: number;
  onScreen: boolean;
  playerId: string | null;
  /** True once the player has run in from the street and hopped onto the stool. */
  seated: boolean;
}

export const LOBBY_SEAT_COUNT = 8;
const LOBBY_TABLE_RADIUS = 1.95;
const LOBBY_STREET_SPAWN_Z = 5.6;
const LOBBY_RUN_SPEED = 2.6;
const WARDROBE_SPOT = new THREE.Vector3(3.0, 0, 3.05);

function lobbySeatAngle(seatIndex: number) {
  return (seatIndex / LOBBY_SEAT_COUNT) * Math.PI * 2 + Math.PI / 2;
}

// Reusable math helpers outside render loop
const _startPos = new THREE.Vector3();
const _endPos = new THREE.Vector3();
const _midPos = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3(0, 0.92, -0.15);
const _yAxis = new THREE.Vector3(0, 1, 0);

// Sidewalk tree (Khoa Nguyễn climbs it at 80% alcohol)
const TREE_POS = { x: -3.08, z: -2.7 };

// Fixed positions on the round stainless steel table for each dish type
// Dishes ring the 1.6m table at r≈0.92, leaving the back-left gap for the beer tower & ice
// bucket and the centre free for minigame props
const dishAt = (deg: number, r = 0.92): [number, number, number] => [
  Math.cos((deg * Math.PI) / 180) * r,
  0.98,
  Math.sin((deg * Math.PI) / 180) * r,
];
const DISH_POSITIONS: Record<string, [number, number, number]> = {
  hotpot: dishAt(-12, 0.86),
  peanut: dishAt(35),
  xoai_non: dishAt(80),
  oc_huong: dishAt(125),
  ca_vien: dishAt(-100),
  chicken_feet: dishAt(-56),
};

const DISH_MORSEL_COLORS: Record<string, number> = {
  peanut: 0xd97706,
  chicken_feet: 0xb45309,
  hotpot: 0xf97316,
  oc_huong: 0xfde68a,
  ca_vien: 0xf59e0b,
  xoai_non: 0xa3e635,
};

export function initThreeScene(): SceneController {
  let container: HTMLDivElement | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let clock: THREE.Clock | null = null;
  let frameId = 0;
  let isSoftwareGl = false;

  // Scene props
  let tableGroup: THREE.Group | null = null;
  let beerTower: THREE.Group | null = null;
  let iceBucket: THREE.Group | null = null;
  let toiletBooth: {
    group: THREE.Group;
    doorMesh: THREE.Mesh;
    statusBulb: THREE.Mesh;
  } | null = null;
  let nhapMoiSpotlight: THREE.Mesh | null = null;
  let clinkShockwaveRing: THREE.Mesh | null = null;
  let centerClinkMugsGroup: THREE.Group | null = null;
  const centerClinkMugs: THREE.Group[] = [];
  let cauVangDog: { group: THREE.Group; tail: THREE.Mesh; headGroup: THREE.Group } | null = null;
  let dogJumpTimer = 0;
  let streetMotorbike: THREE.Group | null = null;
  let motorbikeX = -12;
  let retractableTarp: THREE.Group | null = null;
  let isRainingState = false;
  let isTarpPulledState = false;
  let rainParticles: THREE.Points | null = null;
  let rainPositions: Float32Array | null = null;
  const RAIN_COUNT = 160;
  let karaokeSpeaker: { group: THREE.Group; ledRing: THREE.Mesh } | null = null;
  let isKaraokeActiveState = false;
  let isKaraokeDiscoRoomState = false;
  let rainbowPuddleGroup: THREE.Group | null = null;
  let discoPointLight: THREE.PointLight | null = null;
  let neighborTable: THREE.Group | null = null;
  let neighborTableFlipTimer = 0;
  let foodCartRef: THREE.Group | null = null;
  let foodCartCrashTimer = 0;
  let openKitchen: {
    group: THREE.Group;
    charcoalGlow: THREE.Mesh;
    cleaverMesh: THREE.Group;
  } | null = null;
  let convenienceATM: THREE.Group | null = null;
  let industrialFan: {
    group: THREE.Group;
    bladesGroup: THREE.Group;
  } | null = null;
  let yellowPeePuddle: THREE.Group | null = null;
  let sidewalkGreenTree: { group: THREE.Group; canopyGroup: THREE.Group } | null = null;
  let treeShakeTimer = 0;
  let crocodile: { group: THREE.Group; teeth: THREE.Mesh[]; jawGroup: THREE.Group } | null = null;
  let spinningBottle: THREE.Group | null = null;
  const foodPlattersMap = new Map<string, THREE.Group>();
  let raycaster: THREE.Raycaster | null = null;
  let mouse: THREE.Vector2 | null = null;

  // 3D IK Hand Target Cursor & Thrown Projectile
  let ikTargetCursor: THREE.Group | null = null;
  let thrownProjectile: THREE.Mesh | null = null;
  let throwAnim = {
    active: false,
    progress: 0,
    start: new THREE.Vector3(),
    end: new THREE.Vector3(),
  };

  // 3D Chopsticks Animation Rig
  let primaryChopsticks: ReturnType<typeof createChopsticksPair> | null = null;
  let rivalChopsticks: ReturnType<typeof createChopsticksPair> | null = null;
  let grabAnim = {
    active: false,
    progress: 0,
    start: new THREE.Vector3(),
    end: new THREE.Vector3(),
  };
  let clashAnim = {
    active: false,
    center: new THREE.Vector3(0, 1.08, 0),
  };

  // 3D Lobby state
  let lobbyMode: LobbyMode = 'off';
  const lobbyEmptyStools: THREE.Group[] = [];
  let wardrobeSet: THREE.Group | null = null;
  const lobbyWaypoints = new Map<string, { x: number; z: number }[]>();
  const lobbyReactions = new Map<string, { kind: LobbyReaction; t: number; dur: number }>();
  const _projVec = new THREE.Vector3();
  let onLobbyCharacterClickCb: ((playerId: string) => void) | undefined;
  let onLobbySeatClickCb: ((seatIndex: number) => void) | undefined;
  let onResizeHandler: (() => void) | null = null;
  let streetBackdrop: StreetBackdrop | null = null;
  // Bloom makes neon, lit windows and street lamps glow ("Đẹp" graphics only)
  let composer: EffectComposer | null = null;
  let bloomPass: UnrealBloomPass | null = null;
  let bloomEnabled = true;

  // Mouse look (Pointer Lock): yaw orbits around the look target, pitch tilts it
  let pointerLocked = false;
  let camYaw = 0;
  let camPitch = 0;
  let lastLookCamMode = '';
  let lastSentAimX = 0;
  let lastSentAimY = 0;
  let onPointerLockChangeCb: ((locked: boolean, unavailable?: boolean) => void) | undefined;
  let pointerLockUnavailable = false;
  let dragLook: { id: number; x: number; y: number; moved: number } | null = null;
  const MOUSE_LOOK_SENSITIVITY = 0.0032;
  const _center = new THREE.Vector2(0, 0);
  const _tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.98);
  const _aimHit = new THREE.Vector3();
  const _lookOffset = new THREE.Vector3();

  // Player rigs mapped by player id
  const playerRigs = new Map<string, { rig: CharacterRig; stool: THREE.Group; player: Player }>();

  // State
  let userDrunkLevel = 0;
  let userCupFillRatio = 1.0;
  let cheersStartFillRatio = 1.0;
  let cheersTargetEndFillRatio = 0.0;
  let isCheersing = false;
  let cheersTimer = 0;
  let slowMoTimer = 0; // 0.55s slow-motion zoom when clinking glasses
  let currentMinigame: MinigameId = 'none';
  let bottleSpinSpeed = 0;
  let bottleAngle = 0;
  let currentIKState: IKHandControlState = {
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
  };

  // Foam Particle System
  let foamParticles: THREE.Points | null = null;
  let foamPositions: Float32Array | null = null;
  let foamVelocities: Float32Array | null = null;
  const FOAM_COUNT = 80;

  // Callbacks
  let onToothClickCb: ((index: number) => void) | undefined;
  let onFoodClickCb: ((type: string) => void) | undefined;
  let onBottleClickCb: (() => void) | undefined;
  let onIceBucketClickCb: (() => void) | undefined;
  let onToiletClickCb: (() => void) | undefined;
  let onCauVangClickCb: (() => void) | undefined;
  let onNeighborTableClickCb: (() => void) | undefined;
  let onKaraokeSpeakerClickCb: (() => void) | undefined;
  let onGreenTreeClickCb: (() => void) | undefined;
  let onOpenKitchenClickCb: (() => void) | undefined;
  let onConvenienceATMClickCb: (() => void) | undefined;
  let onIndustrialFanClickCb: (() => void) | undefined;
  let onPassedOutFaceClickCb: ((playerId: string) => void) | undefined;
  let onPointerAimChangeCb: ((aimX: number, aimY: number) => void) | undefined;

  function setupScene() {
    scene = new THREE.Scene();
    (window as unknown as { __threeScene: THREE.Scene }).__threeScene = scene;
    // Night-time city haze; the sky dome in the street backdrop covers the background
    scene.background = new THREE.Color(0x140f24);
    scene.fog = new THREE.FogExp2(0x1a1330, 0.02);

    // Over-the-Shoulder / Isometric 35°-45° party table perspective
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.set(0.55, 2.55, 3.65);
    camera.lookAt(0, 0.92, -0.15);


    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Balanced 3-Point Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x818cf8, 0x1c1917, 0.55);
    scene.add(hemiLight);

    // Saigon street around the pub: shophouses, sky, road, electric poles, street lamps
    streetBackdrop = createStreetBackdrop();
    scene.add(streetBackdrop.group);

    const keyLight = new THREE.DirectionalLight(0xfef08a, 1.8);
    keyLight.position.set(3, 6, 4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xf97316, 0.8);
    fillLight.position.set(-4, 3, -2);
    scene.add(fillLight);

    // Warm table spot light (đèn quán nhậu rọi sáng bàn inox)
    const tableSpot = new THREE.PointLight(0xfbbf24, 2.2, 8);
    tableSpot.position.set(0, 2.4, 0);
    scene.add(tableSpot);

    // Ground Floor: Pavement
    const groundGeo = new THREE.PlaneGeometry(60, 40);
    const groundMat = new THREE.MeshStandardMaterial({
      map: createSidewalkTexture(),
      roughness: 0.85,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Yellow curb barrier at sidewalk edge
    const curbGeo = new THREE.BoxGeometry(30, 0.16, 0.4);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.6 });
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.position.set(0, 0.08, 4.8);
    scene.add(curb);

    // Luminous Neon / Hiflex Sign in Background: "QUÁN NHẬU TƯ ĐỰC - BỜ KÈ"
    const neonSign = createNeonSign(
      'QUÁN NHẬU TƯ ĐỰC - BỜ KÈ',
      'LẨU DÊ • HẢI SẢN TƯƠI SỐNG • BIA HƠI LẠNH BUỐT'
    );
    neonSign.position.set(0, 2.1, -3.2);
    scene.add(neonSign);

    // Sidewalk White Urban Inspection Line ("Vạch Sơn Trắng Đô Thị Vỉa Hè")
    const whiteLineGeo = new THREE.PlaneGeometry(18, 0.08);
    const whiteLineMat = new THREE.MeshBasicMaterial({ color: 0xf4f4f5 });
    const whiteLine = new THREE.Mesh(whiteLineGeo, whiteLineMat);
    whiteLine.rotation.x = -Math.PI / 2;
    whiteLine.position.set(0, 0.008, 3.25);
    scene.add(whiteLine);

    // Stacked Beer Crates (Side)
    const crates1 = createBeerCrates();
    crates1.position.set(-2.15, 0, -1.75);
    crates1.rotation.y = 0.35;
    scene.add(crates1);

    const crates2 = createBeerCrates();
    crates2.position.set(-1.75, 0, -1.85);
    crates2.rotation.y = -0.2;
    crates2.scale.set(0.9, 0.9, 0.9);
    scene.add(crates2);

    // Street Food Cart with Red Lantern in Background
    const foodCart = createStreetFoodCart();
    foodCart.position.set(2.8, 0, -1.8);
    foodCart.rotation.y = -0.4;
    foodCartRef = foodCart;
    scene.add(foodCart);

    // Overhead String Fairy Lights
    const fairyLights = createFairyLights();
    scene.add(fairyLights);

    // Table in center
    tableGroup = createStainlessTable();
    scene.add(tableGroup);

    // Bottles, cans, chopstick holder, sauces, napkins & peanut shells on the table
    scene.add(createTableClutter());

    // Sidewalk Floor Litter (Peanut shells, crumpled tissues, bottle caps & rolling bottles)
    const floorLitter = createFloorLitterAndBottles();
    scene.add(floorLitter);

    // "Cậu Vàng" Street Dog under the table waiting for dropped food morsels
    cauVangDog = createCauVangDog();
    cauVangDog.group.position.set(0.38, 0, 0.55);
    cauVangDog.group.rotation.y = -0.35;
    cauVangDog.group.userData = { isCauVang: true };
    scene.add(cauVangDog.group);

    // Neighbor Table ("Bàn Nhậu Kế Bên - Dân Nhậu Giang Hồ Mạng")
    neighborTable = createNeighborTableGroup();
    neighborTable.position.set(3.25, 0, 0.35);
    neighborTable.userData = { isNeighborTable: true };
    scene.add(neighborTable);

    // Rolling LED Karaoke Speaker Rig ("Loa Kẹo Kéo LED")
    karaokeSpeaker = createKaraokeSpeakerRig();
    karaokeSpeaker.group.position.set(1.55, 0, -0.95);
    karaokeSpeaker.group.rotation.y = -0.5;
    karaokeSpeaker.group.userData = { isKaraokeSpeaker: true };
    scene.add(karaokeSpeaker.group);

    // Lush Sidewalk Green Tree ("Cây Bàng Xanh Bờ Kè Cho Khoa Nguyễn Leo Cây Khi Đủ 80% Cồn")
    // Left of the neon sign (which spans x -2.1..2.1) so the canopy never hides the shop name,
    // still inside the seated camera's view for Khoa Nguyễn's tree climb.
    sidewalkGreenTree = createSidewalkGreenTree();
    sidewalkGreenTree.group.position.set(TREE_POS.x, 0, TREE_POS.z);
    sidewalkGreenTree.group.userData = { isGreenTree: true };
    scene.add(sidewalkGreenTree.group);

    // Open-Air Charcoal Grill Kitchen ("Khu Vực Bếp Lộ Thiên - Nướng Mực & Hàu Mỡ Hành + Dao Phay")
    openKitchen = createOpenCharcoalKitchen();
    // Shifted right so the grill no longer covers the sign's lower-right corner
    openKitchen.group.position.set(3.0, 0, -2.75);
    openKitchen.group.rotation.y = -0.32;
    openKitchen.group.userData = { isOpenKitchen: true };
    scene.add(openKitchen.group);

    // Convenience Store & 24/7 ATM Booth ("Khu Tạp Hóa / Cây ATM Rút Tiền")
    convenienceATM = createConvenienceStoreAndATM();
    convenienceATM.position.set(-3.15, 0, 1.35);
    convenienceATM.rotation.y = 0.52;
    convenienceATM.userData = { isConvenienceATM: true };
    scene.add(convenienceATM);

    // Standing Industrial Fan ("Quạt Công Nghiệp Đứng - Khiêng & Ném Đồ Vật Khổng Lồ")
    industrialFan = createStandingIndustrialFan();
    industrialFan.group.position.set(-1.55, 0, 1.15);
    industrialFan.group.rotation.y = 0.65;
    industrialFan.group.userData = { isIndustrialFan: true };
    scene.add(industrialFan.group);

    // Slippery Yellow Pee Puddle on Sidewalk ("Vũng Nước Vàng Khi Đua Đi WC Bị Va Chạm/Vấp Ngã")
    yellowPeePuddle = createYellowPeePuddle();
    yellowPeePuddle.position.set(-1.55, 0, -0.95);
    yellowPeePuddle.visible = false;
    scene.add(yellowPeePuddle);

    // 3D Rainbow Pixel Puddle ("Hệ Sư Tử - Phun Cầu Vồng Cho Chó Ăn Chè")
    rainbowPuddleGroup = new THREE.Group();
    const rainbowColors = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x38bdf8, 0xa855f7];
    rainbowColors.forEach((col, idx) => {
      const rGeo = new THREE.RingGeometry(idx * 0.065, (idx + 1) * 0.068, 20);
      rGeo.rotateX(-Math.PI / 2);
      const rMat = new THREE.MeshBasicMaterial({
        color: col,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.position.y = 0.012 + idx * 0.001;
      rainbowPuddleGroup!.add(rMesh);
    });
    rainbowPuddleGroup.position.set(-0.62, 0, 1.72);
    rainbowPuddleGroup.visible = false;
    scene.add(rainbowPuddleGroup);

    // Karaoke Disco Laser Strobe Light for Stage 2 ("Phòng Karaoke Đèn Chớp")
    discoPointLight = new THREE.PointLight(0xec4899, 0, 12);
    discoPointLight.position.set(0, 2.8, 0);
    scene.add(discoPointLight);

    // Street Motorbike (Wave / Vision / Exciter) on front asphalt road
    streetMotorbike = createStreetMotorbike();
    streetMotorbike.position.set(-10, 0, 4.35);
    scene.add(streetMotorbike);

    // Retractable Rain Tarp Canopy (hidden retracted by default, slides out when pulled)
    retractableTarp = createRetractableTarp();
    retractableTarp.position.set(0, 0, -3.5);
    retractableTarp.scale.z = 0.15;
    scene.add(retractableTarp);

    // 3D Rain Particles for Sudden Street Downpour ("Cơn Mưa Rào Bất Chợt")
    rainPositions = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      rainPositions[i * 3 + 0] = (Math.random() - 0.5) * 8;
      rainPositions[i * 3 + 1] = Math.random() * 4.5;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 7;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 0.045,
      transparent: true,
      opacity: 0.75,
    });
    rainParticles = new THREE.Points(rainGeo, rainMat);
    rainParticles.visible = false;
    scene.add(rainParticles);

    // Beer Tower on table
    beerTower = createBeerTower(0.9);
    beerTower.position.set(-0.6, 0.98, -0.3);
    beerTower.scale.set(0.85, 0.85, 0.85);
    scene.add(beerTower);

    // Stainless Steel Ice Bucket with Tongs on table (Xô Đá Inox)
    iceBucket = createIceBucket();
    iceBucket.position.set(-0.42, 0.98, 0.06);
    iceBucket.scale.set(0.88, 0.88, 0.88);
    iceBucket.userData = { isIceBucket: true };
    scene.add(iceBucket);

    // 1-Stall Sidewalk WC Booth in back-left corner (Nhà Vệ Sinh 1 Buồng)
    toiletBooth = createToiletBooth();
    // Pushed further left to make room for the tree beside the sign
    toiletBooth.group.position.set(-4.78, 0, -2.4);
    toiletBooth.group.rotation.y = 0.45;
    toiletBooth.group.userData = { isToiletBooth: true };
    scene.add(toiletBooth.group);

    // "ĐỒ NHẤP MÔI" Spotlight Cone Beam from ceiling
    const spotConeGeo = new THREE.ConeGeometry(0.55, 2.5, 20, 1, true);
    const spotConeMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    nhapMoiSpotlight = new THREE.Mesh(spotConeGeo, spotConeMat);
    nhapMoiSpotlight.position.set(0, 1.85, 0);
    nhapMoiSpotlight.visible = false;
    scene.add(nhapMoiSpotlight);

    // 3D Clink Impact Golden Shockwave Ring + Center Clinking Mugs Cluster at (0, 1.24, 0)
    const shockGeo = new THREE.RingGeometry(0.08, 0.16, 32);
    shockGeo.rotateX(-Math.PI / 2);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    clinkShockwaveRing = new THREE.Mesh(shockGeo, shockMat);
    clinkShockwaveRing.position.set(0, 1.24, 0);
    clinkShockwaveRing.visible = false;
    scene.add(clinkShockwaveRing);

    centerClinkMugsGroup = new THREE.Group();
    centerClinkMugsGroup.position.set(0, 1.22, 0);
    centerClinkMugsGroup.visible = false;
    centerClinkMugs.length = 0;
    const mugTypes: Array<'beer_mug' | 'coi_glass' | 'horn'> = [
      'beer_mug',
      'coi_glass',
      'beer_mug',
      'horn',
    ];
    for (let i = 0; i < 4; i++) {
      const m = createBeerMug(mugTypes[i]);
      m.scale.set(1.15, 1.15, 1.15);
      centerClinkMugs.push(m);
      centerClinkMugsGroup.add(m);
    }
    scene.add(centerClinkMugsGroup);

    // 3D Chopsticks Pairs for food grabbing & clashing
    primaryChopsticks = createChopsticksPair();
    scene.add(primaryChopsticks.group);

    rivalChopsticks = createChopsticksPair();
    scene.add(rivalChopsticks.group);

    // 3D IK Hand Target Cursor on the table surface
    ikTargetCursor = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.055, 0.085, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ikTargetCursor.add(ringMesh);

    const dotGeo = new THREE.SphereGeometry(0.025, 12, 12);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const dotMesh = new THREE.Mesh(dotGeo, dotMat);
    dotMesh.position.y = 0.015;
    ikTargetCursor.add(dotMesh);

    ikTargetCursor.position.set(0.25, 0.99, 0.35);
    scene.add(ikTargetCursor);

    // Thrown Object Projectile (Ice cube / Chopstick / Beer Mug thrown at friend's face)
    const projGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const projMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      roughness: 0.15,
      metalness: 0.2,
    });
    thrownProjectile = new THREE.Mesh(projGeo, projMat);
    thrownProjectile.visible = false;
    scene.add(thrownProjectile);

    // Crocodile Dentist minigame model
    crocodile = createCrocodileToy();
    crocodile.group.position.set(0, 0.98, 0);
    crocodile.group.scale.set(0.9, 0.9, 0.9);
    crocodile.group.visible = false;
    scene.add(crocodile.group);

    // Spinning Bottle minigame model
    spinningBottle = createSpinningBottle();
    spinningBottle.position.set(0, 0.98, 0);
    spinningBottle.visible = false;
    scene.add(spinningBottle);

    // Foam particles system
    initFoamParticles();
  }

  function initFoamParticles() {
    foamPositions = new Float32Array(FOAM_COUNT * 3);
    foamVelocities = new Float32Array(FOAM_COUNT * 3);

    const geo = new THREE.BufferGeometry();
    for (let i = 0; i < FOAM_COUNT; i++) {
      foamPositions[i * 3 + 0] = 0;
      foamPositions[i * 3 + 1] = -10; // hidden initially
      foamPositions[i * 3 + 2] = 0;
      foamVelocities[i * 3 + 0] = 0;
      foamVelocities[i * 3 + 1] = 0;
      foamVelocities[i * 3 + 2] = 0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(foamPositions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xfffbeb,
      size: 0.055,
      transparent: true,
      opacity: 0.92,
    });
    foamParticles = new THREE.Points(geo, mat);
    scene?.add(foamParticles);
  }

  function burstFoam(originX: number, originY: number, originZ: number) {
    if (!foamPositions || !foamVelocities || !foamParticles) return;
    for (let i = 0; i < FOAM_COUNT; i++) {
      foamPositions[i * 3 + 0] = originX + (Math.random() - 0.5) * 0.18;
      foamPositions[i * 3 + 1] = originY + 0.12;
      foamPositions[i * 3 + 2] = originZ + (Math.random() - 0.5) * 0.18;

      foamVelocities[i * 3 + 0] = (Math.random() - 0.5) * 2.1;
      foamVelocities[i * 3 + 1] = 1.4 + Math.random() * 1.8;
      foamVelocities[i * 3 + 2] = (Math.random() - 0.5) * 2.1;
    }
    foamParticles.geometry.attributes.position.needsUpdate = true;
  }

  function updateFoamParticles(delta: number) {
    if (!foamPositions || !foamVelocities || !foamParticles) return;
    let anyActive = false;
    for (let i = 0; i < FOAM_COUNT; i++) {
      if (foamPositions[i * 3 + 1] > 0.95) {
        anyActive = true;
        foamPositions[i * 3 + 0] += foamVelocities[i * 3 + 0] * delta;
        foamPositions[i * 3 + 1] += foamVelocities[i * 3 + 1] * delta;
        foamPositions[i * 3 + 2] += foamVelocities[i * 3 + 2] * delta;

        // Gravity
        foamVelocities[i * 3 + 1] -= 4.2 * delta;
      }
    }
    if (anyActive) {
      foamParticles.geometry.attributes.position.needsUpdate = true;
    }
  }

  function onPointerLockStateChange() {
    const locked = !!container && document.pointerLockElement === container;
    if (locked === pointerLocked) return;
    pointerLocked = locked;
    onPointerLockChangeCb?.(locked);
  }

  function onMouseLook(event: MouseEvent) {
    if (!pointerLocked) return;
    camYaw -= event.movementX * MOUSE_LOOK_SENSITIVITY;
    camPitch = THREE.MathUtils.clamp(
      camPitch + event.movementY * MOUSE_LOOK_SENSITIVITY,
      -1.2,
      1.2
    );
  }

  function onPointerMove(event: PointerEvent) {
    if (!container || pointerLocked) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, -((event.clientY - rect.top) / rect.height) * 2 + 1));
    onPointerAimChangeCb?.(x, y);
  }

  function onPointerDown(event: PointerEvent) {
    if (!container || !camera || !scene || !raycaster) return;

    if (pointerLocked) {
      // Locked: interact with whatever sits under the center crosshair
      pickAt(0, 0);
      return;
    }

    if (lobbyMode === 'off') {
      // In a match, the first left click locks the cursor for mouse look (desktop mice)
      const canLock =
        event.pointerType === 'mouse' && !pointerLockUnavailable && !!container.requestPointerLock;
      if (canLock && event.button === 0) {
        try {
          const req = container.requestPointerLock() as unknown as Promise<void> | undefined;
          req?.catch?.(() => markPointerLockUnavailable());
        } catch {
          markPointerLockUnavailable();
        }
        return;
      }
      // Fallback (touch, or pointer lock blocked e.g. inside an iframe): drag to look,
      // a click without dragging still interacts with the scene on pointer up
      if (!canLock && event.button === 0) {
        dragLook = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
        return;
      }
    }

    const rect = container.getBoundingClientRect();
    pickAt(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  function markPointerLockUnavailable() {
    if (pointerLockUnavailable) return;
    pointerLockUnavailable = true;
    onPointerLockChangeCb?.(false, true);
  }

  function onDragLookMove(event: PointerEvent) {
    if (!dragLook || event.pointerId !== dragLook.id) return;
    const dx = event.clientX - dragLook.x;
    const dy = event.clientY - dragLook.y;
    dragLook.x = event.clientX;
    dragLook.y = event.clientY;
    dragLook.moved += Math.abs(dx) + Math.abs(dy);
    camYaw -= dx * MOUSE_LOOK_SENSITIVITY * 1.4;
    camPitch = THREE.MathUtils.clamp(camPitch + dy * MOUSE_LOOK_SENSITIVITY * 1.4, -1.2, 1.2);
  }

  function onDragLookEnd(event: PointerEvent) {
    if (!dragLook || event.pointerId !== dragLook.id || !container) return;
    const wasClick = dragLook.moved < 6;
    dragLook = null;
    if (!wasClick) return;
    const rect = container.getBoundingClientRect();
    pickAt(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  function pickAt(ndcX: number, ndcY: number) {
    if (!camera || !scene || !raycaster) return;
    mouse?.set(ndcX, ndcY);
    raycaster.setFromCamera(mouse!, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      for (const hit of intersects) {
        // Raycaster ignores `visible`; skip hidden things (e.g. hidden nameplate sprites)
        let hidden = false;
        for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
          if (!o.visible) {
            hidden = true;
            break;
          }
        }
        if (hidden) continue;

        // 1. Crocodile tooth hit
        if (crocodile?.group.visible && hit.object.userData?.toothIndex !== undefined) {
          const tIdx = hit.object.userData.toothIndex;
          if (!hit.object.userData.isPressed) {
            onToothClickCb?.(tIdx);
            return;
          }
        }

        // 2. Spinning bottle hit
        if (
          spinningBottle?.visible &&
          (hit.object === spinningBottle ||
            hit.object.parent === spinningBottle ||
            hit.object.parent?.parent === spinningBottle)
        ) {
          onBottleClickCb?.();
          return;
        }

        // 3. Food item, Ice Bucket, WC Booth, or Passed-out face hit
        let p: THREE.Object3D | null = hit.object;
        while (p && p !== scene) {
          if (lobbyMode !== 'off') {
            if (p.userData?.playerId) {
              onLobbyCharacterClickCb?.(p.userData.playerId);
              return;
            }
            if (p.userData?.lobbySeatIndex !== undefined) {
              onLobbySeatClickCb?.(p.userData.lobbySeatIndex);
              return;
            }
          }
          if (p.userData?.isFood) {
            onFoodClickCb?.(p.userData.foodType);
            return;
          }
          if (p.userData?.isIceBucket) {
            onIceBucketClickCb?.();
            return;
          }
          if (p.userData?.isToiletBooth) {
            onToiletClickCb?.();
            return;
          }
          if (p.userData?.isCauVang) {
            onCauVangClickCb?.();
            return;
          }
          if (p.userData?.isNeighborTable) {
            onNeighborTableClickCb?.();
            return;
          }
          if (p.userData?.isKaraokeSpeaker) {
            onKaraokeSpeakerClickCb?.();
            return;
          }
          if (p.userData?.isGreenTree) {
            onGreenTreeClickCb?.();
            return;
          }
          if (p.userData?.isOpenKitchen) {
            onOpenKitchenClickCb?.();
            return;
          }
          if (p.userData?.isConvenienceATM) {
            onConvenienceATMClickCb?.();
            return;
          }
          if (p.userData?.isIndustrialFan) {
            onIndustrialFanClickCb?.();
            return;
          }
          if (p.userData?.isPassedOut && p.userData?.playerId) {
            onPassedOutFaceClickCb?.(p.userData.playerId);
            return;
          }
          p = p.parent;
        }
      }
    }
  }

  function createWardrobeSet(): THREE.Group {
    // Sidewalk barber mirror on a brick wall + bamboo clothes-drying pole
    const group = new THREE.Group();
    const brick = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.2, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.95 })
    );
    brick.position.set(0, 1.1, -0.75);
    brick.receiveShadow = true;
    group.add(brick);
    const mortarMat = new THREE.MeshBasicMaterial({ color: 0xd6d3d1 });
    for (let row = 1; row < 11; row++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.012), mortarMat);
      line.position.set(0, row * 0.2, -0.688);
      group.add(line);
    }
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.95, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 })
    );
    frame.position.set(-0.75, 1.35, -0.67);
    group.add(frame);
    const mirror = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.85),
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, metalness: 1, roughness: 0.05 })
    );
    mirror.position.set(-0.75, 1.35, -0.64);
    group.add(mirror);

    const poleMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.7 });
    [0.65, 1.9].forEach((x) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.9, 8), poleMat);
      post.position.set(x, 0.95, -0.45);
      group.add(post);
    });
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 8), poleMat);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(1.275, 1.85, -0.45);
    group.add(rail);
    const clothes: [number, number][] = [
      [0.9, 0xdc2626], // áo ba lỗ đỏ
      [1.2, 0xf4f4f5], // áo ba lỗ trắng
      [1.5, 0x16a34a], // quần đùi hoa
      [1.75, 0xfacc15], // áo vàng
    ];
    clothes.forEach(([x, color], i) => {
      const shirt = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, i === 2 ? 0.22 : 0.34, 0.02),
        new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
      );
      shirt.position.set(x, i === 2 ? 1.72 : 1.66, -0.45);
      shirt.userData.swayPhase = i * 1.3;
      shirt.userData.isWardrobeCloth = true;
      group.add(shirt);
    });
    // Dép tổ ong on the ground
    const sandalMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.8 });
    [-0.09, 0.09].forEach((x) => {
      const sandal = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.26), sandalMat);
      sandal.position.set(0.7 + x, 0.015, 0.3);
      group.add(sandal);
    });

    // The "barber chair" is just another red plastic stool
    const barberStool = createPlasticStool(0xdc2626);
    barberStool.rotation.y = Math.PI;
    group.add(barberStool);

    group.position.copy(WARDROBE_SPOT);
    return group;
  }

  function ensureLobbyProps() {
    if (!scene) return;
    if (lobbyEmptyStools.length === 0) {
      for (let i = 0; i < LOBBY_SEAT_COUNT; i++) {
        const stool = createPlasticStool(0xdc2626);
        const angle = lobbySeatAngle(i);
        stool.position.set(
          Math.cos(angle) * LOBBY_TABLE_RADIUS,
          0,
          Math.sin(angle) * LOBBY_TABLE_RADIUS
        );
        stool.rotation.y = -angle + Math.PI / 2;
        stool.userData.lobbySeatIndex = i;
        stool.visible = false;
        scene.add(stool);
        lobbyEmptyStools.push(stool);
      }
    }
    if (!wardrobeSet) {
      wardrobeSet = createWardrobeSet();
      wardrobeSet.visible = false;
      scene.add(wardrobeSet);
    }
  }

  function refreshLobbyStools() {
    const occupied = new Set<number>();
    playerRigs.forEach(({ player }) => occupied.add(player.seatIndex));
    lobbyEmptyStools.forEach((stool, i) => {
      stool.visible = lobbyMode !== 'off' && !occupied.has(i);
    });
  }

  function updateLobbyRig(
    rig: CharacterRig,
    stool: THREE.Group,
    player: Player,
    delta: number,
    rawDelta: number,
    time: number,
    extraState: { isWalkingToTree?: boolean }
  ) {
    const inWardrobe = player.isUser && lobbyMode === 'wardrobe';
    const tx = inWardrobe ? WARDROBE_SPOT.x : stool.position.x;
    const tz = inWardrobe ? WARDROBE_SPOT.z : stool.position.z;
    const route = lobbyWaypoints.get(player.id);
    const waypoint = route?.[0];
    const gx = waypoint ? waypoint.x : tx;
    const gz = waypoint ? waypoint.z : tz;
    const dx = gx - rig.root.position.x;
    const dz = gz - rig.root.position.z;
    const dist = Math.hypot(dx, dz);
    let seated = false;

    if (dist > 0.06) {
      // Waddle-run in from the street, then hop up onto the stool
      const step = Math.min(dist, rawDelta * LOBBY_RUN_SPEED);
      rig.root.position.x += (dx / dist) * step;
      rig.root.position.z += (dz / dist) * step;
      const hopping = !waypoint && !inWardrobe && dist < 0.6;
      rig.root.position.y = hopping
        ? Math.sin((1 - dist / 0.6) * Math.PI) * 0.5
        : Math.abs(Math.sin(time * 16)) * 0.12;
      rig.root.rotation.y = Math.atan2(dx, dz);
      extraState.isWalkingToTree = true;
    } else if (route && waypoint) {
      route.shift();
      if (route.length === 0) lobbyWaypoints.delete(player.id);
    } else {
      rig.root.position.set(tx, 0, tz);
      rig.root.rotation.y = inWardrobe
        ? Math.sin(time * 0.7) * 0.6
        : -Math.atan2(tz, tx) - Math.PI / 2;
      seated = !inWardrobe;
    }

    rig.update(delta, player.alcoholLevel, false, false, undefined, extraState);

    // Idle "waiting for the crew" loops, varied per seat
    if (seated) {
      const phase = player.seatIndex * 1.7;
      switch (player.seatIndex % 3) {
        case 0: // drumming chopsticks on the table
          rig.rightArm.rotation.x = 1.25 + Math.abs(Math.sin(time * 9 + phase)) * 0.5;
          rig.leftArm.rotation.x = 1.25 + Math.abs(Math.cos(time * 9 + phase)) * 0.5;
          rig.head.rotation.z = Math.sin(time * 4.5 + phase) * 0.08;
          break;
        case 1: // picking teeth with a toothpick, head bobbing
          rig.rightArm.rotation.set(2.15, -0.3, -0.55);
          rig.head.rotation.z = Math.sin(time * 2.4 + phase) * 0.12;
          break;
        default: // foot tapping & swaying to the music
          rig.leftLeg.rotation.x = -Math.abs(Math.sin(time * 6 + phase)) * 0.4;
          rig.body.rotation.z = Math.sin(time * 3 + phase) * 0.07;
      }
    } else if (inWardrobe && dist <= 0.06) {
      // Showing off the outfit in the mirror
      rig.rightArm.rotation.set(2.6, 0, -0.9);
      rig.head.rotation.z = Math.sin(time * 2) * 0.1;
    }

    // Slap / tickle / munch reactions
    const reaction = lobbyReactions.get(player.id);
    if (reaction) {
      reaction.t += rawDelta;
      const k = reaction.t / reaction.dur;
      if (k >= 1) {
        lobbyReactions.delete(player.id);
        rig.root.scale.set(1, 1, 1);
      } else {
        const fade = 1 - k;
        if (reaction.kind === 'slap') {
          rig.head.rotation.y = Math.sin(k * Math.PI) * 1.2;
          rig.root.rotation.y += Math.sin(k * Math.PI * 2) * 0.5 * fade;
          const squash = Math.sin(k * Math.PI * 6) * 0.14 * fade;
          rig.root.scale.set(1 + squash, 1 - squash, 1 + squash);
        } else if (reaction.kind === 'tickle') {
          rig.body.rotation.z = Math.sin(reaction.t * 40) * 0.28 * fade;
          rig.root.position.y += Math.abs(Math.sin(reaction.t * 18)) * 0.14 * fade;
          rig.leftArm.rotation.set(2.7, 0, 0.6);
          rig.rightArm.rotation.set(2.7, 0, -0.6);
        } else {
          rig.jaw.rotation.x = Math.abs(Math.sin(reaction.t * 18)) * 0.38;
          rig.head.rotation.x = Math.sin(reaction.t * 9) * 0.08;
          rig.rightArm.rotation.set(2.2, -0.2, -0.5);
        }
      }
    }
  }

  /**
   * Rotates the current camera framing by the mouse-look yaw/pitch.
   * Third-person modes orbit the camera around its look target; first-person turns the head.
   */
  function applyMouseLook(firstPerson: boolean) {
    const pivot = firstPerson ? _camTargetPos : _camLookAt;
    const moving = firstPerson ? _camLookAt : _camTargetPos;
    _lookOffset.subVectors(moving, pivot);
    _lookOffset.applyAxisAngle(_yAxis, camYaw);

    const len = _lookOffset.length();
    const horiz = Math.hypot(_lookOffset.x, _lookOffset.z) || 0.0001;
    let elevation = Math.atan2(_lookOffset.y, horiz);
    // pitch > 0 = look further down in both modes
    elevation = firstPerson
      ? THREE.MathUtils.clamp(elevation - camPitch, -1.25, 0.9)
      : THREE.MathUtils.clamp(elevation + camPitch, 0.06, 1.45);
    const newHoriz = Math.cos(elevation) * len;
    _lookOffset.x *= newHoriz / horiz;
    _lookOffset.z *= newHoriz / horiz;
    _lookOffset.y = Math.sin(elevation) * len;
    moving.addVectors(pivot, _lookOffset);
  }

  /** While locked, the IK hand reaches for the spot on the table under the crosshair. */
  function updateCrosshairAim() {
    if (!camera || !raycaster) return;
    raycaster.setFromCamera(_center, camera);
    if (!raycaster.ray.intersectPlane(_tablePlane, _aimHit)) return;
    const aimX = THREE.MathUtils.clamp(_aimHit.x / 0.85, -1, 1);
    const aimY = THREE.MathUtils.clamp((0.45 - _aimHit.z) / 0.75, -1, 1);
    if (Math.abs(aimX - lastSentAimX) < 0.03 && Math.abs(aimY - lastSentAimY) < 0.03) return;
    lastSentAimX = aimX;
    lastSentAimY = aimY;
    onPointerAimChangeCb?.(aimX, aimY);
  }

  function tick() {
    if (!clock || !renderer || !scene || !camera) return;
    const rawDelta = Math.min(clock.getDelta(), 0.1);
    const time = clock.getElapsedTime();

    // 0.5s Slow-Motion effect during collective "1, 2, 3 Dzô!" clink
    if (slowMoTimer > 0) {
      slowMoTimer = Math.max(0, slowMoTimer - rawDelta);
    }
    const timeScale = slowMoTimer > 0 ? 0.32 : 1.0;
    const delta = rawDelta * timeScale;

    // Update Foam
    updateFoamParticles(delta);

    // Hotpot flame, bubbles & steam
    foodPlattersMap.forEach((platter) => platter.userData.update?.(time));

    // Animate Cậu Vàng Under-Table Dog (wagging tail + jumping for food)
    if (cauVangDog) {
      cauVangDog.tail.rotation.z = Math.sin(time * 14) * 0.45;
      cauVangDog.headGroup.rotation.z = Math.sin(time * 3.2) * 0.08;
      if (dogJumpTimer > 0) {
        dogJumpTimer = Math.max(0, dogJumpTimer - rawDelta);
        const jumpArc = Math.sin((dogJumpTimer / 0.9) * Math.PI);
        cauVangDog.group.position.y = jumpArc * 0.35;
        cauVangDog.group.position.z = 0.55 + jumpArc * 0.28;
      } else {
        cauVangDog.group.position.y = 0;
        cauVangDog.group.position.z = 0.55;
      }
    }

    // Animate Lush Sidewalk Green Tree Canopy (gentle breeze + vigorous rustle when Khoa Nguyễn climbs or tree is shaken)
    if (sidewalkGreenTree) {
      if (treeShakeTimer > 0) {
        treeShakeTimer = Math.max(0, treeShakeTimer - rawDelta);
      }
      let someoneClimbing = false;
      playerRigs.forEach(({ player }) => {
        if (player.isClimbingTree) someoneClimbing = true;
      });
      const shakeAmp = treeShakeTimer > 0 ? 0.14 : someoneClimbing ? 0.065 : 0.018;
      const shakeFreq = treeShakeTimer > 0 ? 28 : someoneClimbing ? 14 : 2.2;
      sidewalkGreenTree.canopyGroup.rotation.z = Math.sin(time * shakeFreq) * shakeAmp;
      sidewalkGreenTree.canopyGroup.rotation.x = Math.cos(time * shakeFreq * 0.8) * shakeAmp * 0.7;
      sidewalkGreenTree.group.rotation.z =
        treeShakeTimer > 0 ? Math.sin(time * 32) * 0.045 : 0;
    }

    // Animate Street Motorbike zooming past on front road (z = 4.35)
    if (streetMotorbike) {
      motorbikeX += rawDelta * 6.5;
      if (motorbikeX > 14) {
        motorbikeX = -14;
      }
      streetMotorbike.position.x = motorbikeX;
    }

    // Animate Retractable Rain Tarp & 3D Rain Particles
    if (retractableTarp) {
      const targetScaleZ = isTarpPulledState ? 1.0 : 0.15;
      const targetPosZ = isTarpPulledState ? 0 : -1.8;
      retractableTarp.scale.z = THREE.MathUtils.damp(
        retractableTarp.scale.z,
        targetScaleZ,
        5,
        rawDelta
      );
      retractableTarp.position.z = THREE.MathUtils.damp(
        retractableTarp.position.z,
        targetPosZ,
        5,
        rawDelta
      );
    }
    if (rainParticles && rainPositions) {
      rainParticles.visible = isRainingState;
      if (isRainingState) {
        for (let i = 0; i < RAIN_COUNT; i++) {
          rainPositions[i * 3 + 1] -= rawDelta * 6.8;
          if (rainPositions[i * 3 + 1] < 0.1) {
            rainPositions[i * 3 + 1] = 4.2;
          }
        }
        rainParticles.geometry.attributes.position.needsUpdate = true;
      }
    }

    // Animate Rolling Karaoke Speaker LED & Table Bass Vibration
    if (karaokeSpeaker) {
      const targetX = isKaraokeActiveState ? 1.18 : 1.75;
      const targetZ = isKaraokeActiveState ? 0.35 : -0.95;
      karaokeSpeaker.group.position.x = THREE.MathUtils.damp(
        karaokeSpeaker.group.position.x,
        targetX,
        4,
        rawDelta
      );
      karaokeSpeaker.group.position.z = THREE.MathUtils.damp(
        karaokeSpeaker.group.position.z,
        targetZ,
        4,
        rawDelta
      );
      const hue = (time * 1.5) % 1;
      (karaokeSpeaker.ledRing.material as THREE.MeshBasicMaterial).color.setHSL(
        hue,
        1,
        isKaraokeActiveState ? 0.6 : 0.35
      );
      if (isKaraokeActiveState) {
        const bassPulse = 1 + Math.sin(time * 22) * 0.06;
        karaokeSpeaker.group.scale.set(bassPulse, 1 / bassPulse, bassPulse);
        if (tableGroup) {
          tableGroup.rotation.z = Math.sin(time * 28) * 0.012;
        }
      } else if (tableGroup) {
        tableGroup.rotation.z = 0;
      }
    }

    // Animate Rainbow Puddle pulse & Karaoke Stage 2 Disco Strobe Lights
    if (rainbowPuddleGroup && rainbowPuddleGroup.visible) {
      const s = 1 + Math.sin(time * 6) * 0.08;
      rainbowPuddleGroup.scale.set(s, 1, s);
      rainbowPuddleGroup.rotation.y = time * 0.8;
    }

    // Animate Open-World Sandbox: Open Charcoal Kitchen embers & cleaver + Standing Industrial Fan + Food Cart Crash + Neighbor Table Flip
    if (openKitchen) {
      const emberMat = openKitchen.charcoalGlow.material as THREE.MeshStandardMaterial;
      emberMat.emissiveIntensity = 1.4 + Math.sin(time * 12) * 0.5;
      openKitchen.cleaverMesh.rotation.z =
        currentIKState.isChasedByCleaverChef
          ? Math.sin(time * 24) * 0.85
          : -0.35 + Math.sin(time * 3.5) * 0.08;
    }

    if (industrialFan) {
      industrialFan.bladesGroup.rotation.z += rawDelta * 22;
      const userEntry = playerRigs.get('user');
      if (
        currentIKState.controlMode === 'free_roam' &&
        currentIKState.carriedHeavyProp === 'industrial_fan' &&
        userEntry
      ) {
        // Carry the Standing Industrial Fan overhead with both hands!
        industrialFan.group.position.set(
          userEntry.rig.root.position.x,
          1.35 + Math.abs(Math.sin(time * 10)) * 0.06,
          userEntry.rig.root.position.z
        );
        industrialFan.group.rotation.z = Math.PI / 2;
      } else {
        industrialFan.group.position.x = THREE.MathUtils.damp(
          industrialFan.group.position.x,
          -1.55,
          5,
          rawDelta
        );
        industrialFan.group.position.y = THREE.MathUtils.damp(
          industrialFan.group.position.y,
          0,
          6,
          rawDelta
        );
        industrialFan.group.position.z = THREE.MathUtils.damp(
          industrialFan.group.position.z,
          1.15,
          5,
          rawDelta
        );
        industrialFan.group.rotation.z = THREE.MathUtils.damp(
          industrialFan.group.rotation.z,
          0,
          6,
          rawDelta
        );
      }
    }

    if (foodCartRef) {
      if (foodCartCrashTimer > 0) {
        foodCartCrashTimer = Math.max(0, foodCartCrashTimer - rawDelta);
        const crashPhase = 1 - foodCartCrashTimer / 2.2;
        const targetZ = crashPhase < 0.55 ? 0.35 : -1.8;
        const targetX = crashPhase < 0.55 ? 3.05 : 2.8;
        foodCartRef.position.x = THREE.MathUtils.damp(
          foodCartRef.position.x,
          targetX,
          8,
          rawDelta
        );
        foodCartRef.position.z = THREE.MathUtils.damp(
          foodCartRef.position.z,
          targetZ,
          8,
          rawDelta
        );
      }
    }

    if (neighborTable) {
      if (neighborTableFlipTimer > 0) {
        neighborTableFlipTimer = Math.max(0, neighborTableFlipTimer - rawDelta);
        neighborTable.rotation.z = THREE.MathUtils.damp(
          neighborTable.rotation.z,
          1.38,
          9,
          rawDelta
        );
        neighborTable.position.y = THREE.MathUtils.damp(
          neighborTable.position.y,
          0.35,
          9,
          rawDelta
        );
      } else {
        neighborTable.rotation.z = THREE.MathUtils.damp(
          neighborTable.rotation.z,
          0,
          5,
          rawDelta
        );
        neighborTable.position.y = THREE.MathUtils.damp(
          neighborTable.position.y,
          0,
          5,
          rawDelta
        );
      }
    }

    if (discoPointLight && scene) {
      if (isKaraokeDiscoRoomState) {
        const discoHue = (time * 0.85) % 1;
        discoPointLight.color.setHSL(discoHue, 1, 0.55);
        discoPointLight.intensity = 3.8 + Math.sin(time * 18) * 1.4;
      } else {
        discoPointLight.intensity = 0;
      }
    }

    // Update 3-Phase Cheers Timer (2.6s total: 0-0.85s clink_center -> 0.85-2.05s chug_gulp -> 2.05-2.6s slam_finish)
    let activeCheersPhase: CheersAnimPhase = 'idle';
    if (isCheersing) {
      cheersTimer -= rawDelta;
      if (cheersTimer <= 0) {
        isCheersing = false;
        cheersTimer = 0;
        userCupFillRatio = cheersTargetEndFillRatio;
        if (clinkShockwaveRing) clinkShockwaveRing.visible = false;
        if (centerClinkMugsGroup) centerClinkMugsGroup.visible = false;
      } else if (cheersTimer > 1.75) {
        activeCheersPhase = 'clink_center';
        // Phase 1: 4 mugs rush inward from player seats and collide at table center (0, 1.24, 0)
        const p1Progress = Math.min(1, (2.6 - cheersTimer) / 0.85);
        const clashDist = p1Progress < 0.45
          ? THREE.MathUtils.lerp(0.65, 0.08, p1Progress / 0.45)
          : 0.08 + Math.sin((p1Progress - 0.45) * Math.PI * 3) * 0.035;

        if (centerClinkMugsGroup) {
          centerClinkMugsGroup.visible = true;
          centerClinkMugs.forEach((mug, idx) => {
            const ang = (idx / 4) * Math.PI * 2 + Math.PI / 2;
            mug.position.set(Math.cos(ang) * clashDist, 0, Math.sin(ang) * clashDist);
            mug.rotation.set(
              -Math.sin(ang) * 0.35,
              -ang + Math.PI / 2,
              Math.cos(ang) * 0.35
            );
          });
        }
        if (clinkShockwaveRing) {
          clinkShockwaveRing.visible = p1Progress >= 0.38;
          const ringScale = 1 + (p1Progress - 0.35) * 4.5;
          clinkShockwaveRing.scale.set(ringScale, 1, ringScale);
          (clinkShockwaveRing.material as THREE.MeshBasicMaterial).opacity = Math.max(
            0,
            1 - (p1Progress - 0.35) * 1.5
          );
        }
      } else if (cheersTimer > 0.55) {
        activeCheersPhase = 'chug_gulp';
        if (clinkShockwaveRing) clinkShockwaveRing.visible = false;
        if (centerClinkMugsGroup) centerClinkMugsGroup.visible = false;
        // Phase 2: Smoothly drain the 3D beer liquid in the mug as the character gulps!
        const chugProgress = Math.min(1, Math.max(0, (1.75 - cheersTimer) / 1.2));
        userCupFillRatio = THREE.MathUtils.lerp(
          cheersStartFillRatio,
          cheersTargetEndFillRatio,
          chugProgress
        );
      } else {
        activeCheersPhase = 'slam_finish';
        if (clinkShockwaveRing) clinkShockwaveRing.visible = false;
        if (centerClinkMugsGroup) centerClinkMugsGroup.visible = false;
        userCupFillRatio = cheersTargetEndFillRatio;
      }
    }

    // Update Thrown Projectile Animation
    if (throwAnim.active && thrownProjectile) {
      throwAnim.progress += rawDelta * 2.4;
      if (throwAnim.progress >= 1) {
        throwAnim.active = false;
        thrownProjectile.visible = false;
        burstFoam(throwAnim.end.x, throwAnim.end.y, throwAnim.end.z);
      } else {
        const t = throwAnim.progress;
        _midPos.lerpVectors(throwAnim.start, throwAnim.end, t);
        _midPos.y += Math.sin(t * Math.PI) * 0.42;
        thrownProjectile.position.copy(_midPos);
        thrownProjectile.rotation.x += rawDelta * 14;
        thrownProjectile.rotation.y += rawDelta * 18;
      }
    }

    // Update 3D Chopstick Grab Animation
    if (grabAnim.active && primaryChopsticks) {
      grabAnim.progress += delta * 1.65;
      if (grabAnim.progress >= 1) {
        grabAnim.active = false;
        primaryChopsticks.group.visible = false;
      } else {
        const t = grabAnim.progress;
        _midPos.lerpVectors(grabAnim.start, grabAnim.end, t);
        _midPos.y += Math.sin(t * Math.PI) * 0.45;
        primaryChopsticks.group.position.copy(_midPos);
        primaryChopsticks.group.lookAt(grabAnim.end.x, _midPos.y - 0.15, grabAnim.end.z);

        const pinch = Math.sin(t * Math.PI * 3) * 0.025;
        primaryChopsticks.stick1.rotation.y = -0.03 + pinch;
        primaryChopsticks.stick2.rotation.y = 0.03 - pinch;
      }
    }

    // Update 3D Chopstick Clash Animation over Last Piece
    if (clashAnim.active && primaryChopsticks && rivalChopsticks) {
      const jitter1 = Math.sin(time * 28) * 0.04;
      const jitter2 = Math.cos(time * 32) * 0.04;
      primaryChopsticks.group.position.set(
        clashAnim.center.x - 0.06 + jitter1,
        clashAnim.center.y + 0.08 + Math.abs(jitter2),
        clashAnim.center.z + 0.08
      );
      primaryChopsticks.group.lookAt(clashAnim.center);

      rivalChopsticks.group.position.set(
        clashAnim.center.x + 0.06 - jitter2,
        clashAnim.center.y + 0.08 + Math.abs(jitter1),
        clashAnim.center.z - 0.08
      );
      rivalChopsticks.group.lookAt(clashAnim.center);
    }

    // Pulse last remaining food piece on any platter with 1 serving left
    foodPlattersMap.forEach((dishGroup) => {
      if (dishGroup.userData.servings === 1) {
        const morsels = dishGroup.userData.morsels as THREE.Object3D[] | undefined;
        if (morsels && morsels[0]) {
          const s = 1 + Math.sin(time * 7) * 0.18;
          morsels[0].scale.set(s, s, s);
        }
      }
    });

    // Update 3D IK Hand Target Cursor on Table
    const drunkRatio = userDrunkLevel / 100;
    const isColdTowelClear = currentIKState.coldTowelBuffTimer > 0;
    const effectiveDrunk = isColdTowelClear ? drunkRatio * 0.15 : drunkRatio;

    if (ikTargetCursor) {
      const showCursor =
        lobbyMode === 'off' &&
        currentIKState.controlMode === 'seated' &&
        !currentIKState.isFallenOffChair &&
        currentMinigame === 'none';
      ikTargetCursor.visible = showCursor;

      if (showCursor) {
        const driftX =
          (Math.sin(time * 2.3) * 0.6 + Math.cos(time * 3.9) * 0.4) *
          effectiveDrunk *
          0.38;
        const driftZ =
          (Math.cos(time * 1.9) * 0.6 + Math.sin(time * 4.1) * 0.4) *
          effectiveDrunk *
          0.32;

        const targetX = currentIKState.isCheersHolding
          ? driftX * 0.5
          : THREE.MathUtils.clamp(currentIKState.aimX * 0.85 + driftX, -0.95, 0.95);
        const targetZ = currentIKState.isCheersHolding
          ? driftZ * 0.5
          : THREE.MathUtils.clamp(0.45 - currentIKState.aimY * 0.75 + driftZ, -0.85, 0.95);

        ikTargetCursor.position.x = THREE.MathUtils.damp(
          ikTargetCursor.position.x,
          targetX,
          10,
          rawDelta
        );
        ikTargetCursor.position.z = THREE.MathUtils.damp(
          ikTargetCursor.position.z,
          targetZ,
          10,
          rawDelta
        );
        const pulse = currentIKState.isGrabbing ? 1.35 : 1 + Math.sin(time * 6) * 0.12;
        ikTargetCursor.scale.set(pulse, 1, pulse);
      }
    }

    // Update Characters Rig & Spotlight / Bỏng Mỏ Circle Run
    let spotlightTargetPos: THREE.Vector3 | null = null;
    playerRigs.forEach(({ rig, player, stool }) => {
      if (player.isCaughtSlipping) {
        spotlightTargetPos = rig.root.position;
      }

      const extraState: {
        bladderLevel: number;
        isBreathingFire?: boolean;
        isStunned?: boolean;
        isSpicedMouth?: boolean;
        cheersPhase?: CheersAnimPhase;
        cupFillRatio: number;
        isCallingMaiAnh?: boolean;
        isHeartbrokenMaiAnh?: boolean;
        isClimbingTree?: boolean;
        isWalkingToTree?: boolean;
      } = {
        bladderLevel: player.bladderLevel || 0,
        isBreathingFire: player.isBreathingFire,
        isStunned: player.isStunned,
        isSpicedMouth: player.isSpicedMouth,
        cheersPhase: activeCheersPhase,
        cupFillRatio: player.isUser
          ? userCupFillRatio
          : isCheersing && activeCheersPhase === 'chug_gulp'
          ? Math.max(0.15, (cheersTimer - 0.55) / 1.2)
          : 0.85,
        isCallingMaiAnh: player.isCallingMaiAnh,
        isHeartbrokenMaiAnh: player.isHeartbrokenMaiAnh,
        isClimbingTree: false,
        isWalkingToTree: false,
      };

      if (lobbyMode !== 'off') {
        updateLobbyRig(rig, stool, player, delta, rawDelta, time, extraState);
        return;
      }

      // If poisoned by "Bom Hỗn Hợp" ("Bỏng Mỏ"), character runs wildly in circles around the table!
      if (player.isSpicedMouth) {
        const panicAngle = time * 4.8 + player.seatIndex;
        const r = 2.45;
        rig.root.position.x = Math.cos(panicAngle) * r;
        rig.root.position.z = Math.sin(panicAngle) * r;
        rig.root.rotation.y = -panicAngle;
        rig.update(delta, player.alcoholLevel, player.isPassedOut, isCheersing, undefined, extraState);
        return;
      }

      // If Khoa Nguyễn (Gấu Nâu >= 80% alcohol) walks out from his stool to climb the Sidewalk Green Tree!
      if (player.isClimbingTree) {
        const treeClimbTargetX = TREE_POS.x + 0.08;
        const treeClimbTargetZ = TREE_POS.z + 0.26;
        const dx = treeClimbTargetX - rig.root.position.x;
        const dz = treeClimbTargetZ - rig.root.position.z;
        const distToTrunk = Math.hypot(dx, dz);

        if (distToTrunk > 0.16) {
          // Phase 1: Waddle-run step-by-step from plastic stool (0, 0, -1.95) across the sidewalk to the tree trunk!
          const walkStep = Math.min(distToTrunk, rawDelta * 1.15);
          rig.root.position.x += (dx / distToTrunk) * walkStep;
          rig.root.position.z += (dz / distToTrunk) * walkStep;
          rig.root.position.y = Math.abs(Math.sin(time * 14)) * 0.14;
          const moveAngle = Math.atan2(dx, dz);
          rig.root.rotation.y = THREE.MathUtils.damp(
            rig.root.rotation.y,
            moveAngle,
            10,
            rawDelta
          );
          extraState.isWalkingToTree = true;
          extraState.isClimbingTree = false;
        } else {
          // Phase 2: Reached the tree trunk -> scramble vertically up the trunk and swing on the branch!
          const swayX = Math.sin(time * 3.8) * 0.12;
          rig.root.position.x = treeClimbTargetX + swayX;
          rig.root.position.z = treeClimbTargetZ;
          const targetClimbHeight = 1.16 + Math.sin(time * 4.2) * 0.16;
          if (rig.root.position.y < 1.0) {
            rig.root.position.y = Math.min(
              targetClimbHeight,
              rig.root.position.y + rawDelta * 1.05
            );
          } else {
            rig.root.position.y = THREE.MathUtils.damp(
              rig.root.position.y,
              targetClimbHeight,
              6,
              rawDelta
            );
          }
          // Face toward the camera/table while hugging the trunk and waving!
          rig.root.rotation.y = THREE.MathUtils.damp(
            rig.root.rotation.y,
            0.35 + Math.sin(time * 2.8) * 0.25,
            6,
            rawDelta
          );
          extraState.isWalkingToTree = false;
          extraState.isClimbingTree = true;
        }

        rig.update(
          delta,
          player.alcoholLevel,
          player.isPassedOut,
          isCheersing,
          undefined,
          extraState
        );
        return;
      }

      if (player.isUser) {
        if (currentIKState.controlMode === 'free_roam' || currentMinigame === 'bill_fight') {
          rig.root.position.x = THREE.MathUtils.damp(
            rig.root.position.x,
            currentIKState.freeRoamPos.x,
            8,
            rawDelta
          );
          rig.root.position.z = THREE.MathUtils.damp(
            rig.root.position.z,
            currentIKState.freeRoamPos.z,
            8,
            rawDelta
          );
          rig.root.position.y = THREE.MathUtils.damp(rig.root.position.y, 0, 8, rawDelta);
          rig.root.rotation.y = currentIKState.freeRoamPos.angle;
        } else {
          // Seated at front of table (Seat 0 at x=0, z=1.95 facing table center 0,0,0)
          rig.root.position.x = THREE.MathUtils.damp(rig.root.position.x, 0, 8, rawDelta);
          rig.root.position.y = THREE.MathUtils.damp(rig.root.position.y, 0, 8, rawDelta);
          rig.root.position.z = THREE.MathUtils.damp(rig.root.position.z, 1.95, 8, rawDelta);
          rig.root.rotation.y = Math.PI;
        }
        rig.update(
          delta,
          player.alcoholLevel,
          player.isPassedOut,
          isCheersing,
          currentIKState,
          extraState
        );
      } else {
        // Check if this NPC is currently being dragged/carried by the user ("The Wingman Carry")
        const userEntry = playerRigs.get('user');
        if (
          currentIKState.controlMode === 'free_roam' &&
          currentIKState.draggingFriendId === player.id &&
          userEntry
        ) {
          const dragTargetX =
            userEntry.rig.root.position.x -
            Math.sin(userEntry.rig.root.rotation.y) * 0.55;
          const dragTargetZ =
            userEntry.rig.root.position.z -
            Math.cos(userEntry.rig.root.rotation.y) * 0.55;
          rig.root.position.x = THREE.MathUtils.damp(
            rig.root.position.x,
            dragTargetX,
            10,
            rawDelta
          );
          rig.root.position.z = THREE.MathUtils.damp(
            rig.root.position.z,
            dragTargetZ,
            10,
            rawDelta
          );
          rig.root.position.y = 0;
          rig.root.rotation.y = userEntry.rig.root.rotation.y;
          rig.update(delta, 100, true, isCheersing, undefined, extraState);
          return;
        }

        // Ensure NPC smoothly climbs down & walks back to their plastic stool if they were up in the tree
        const stoolEntry = playerRigs.get(player.id);
        if (stoolEntry) {
          const sx = stoolEntry.stool.position.x;
          const sz = stoolEntry.stool.position.z;
          if (rig.root.position.y > 0.08) {
            // Slide down trunk first
            rig.root.position.y = Math.max(0, rig.root.position.y - rawDelta * 1.85);
            extraState.isClimbingTree = true;
          } else {
            rig.root.position.y = 0;
            const dx = sx - rig.root.position.x;
            const dz = sz - rig.root.position.z;
            const distToStool = Math.hypot(dx, dz);
            if (distToStool > 0.06) {
              const step = Math.min(distToStool, rawDelta * 1.45);
              rig.root.position.x += (dx / distToStool) * step;
              rig.root.position.z += (dz / distToStool) * step;
              rig.root.position.y = Math.abs(Math.sin(time * 14)) * 0.1;
              rig.root.rotation.y = Math.atan2(dx, dz);
              extraState.isWalkingToTree = true;
            } else {
              rig.root.position.x = sx;
              rig.root.position.z = sz;
              const seatAngle = Math.atan2(sz, sx);
              rig.root.rotation.y = -seatAngle - Math.PI / 2;
            }
          }
        }
        rig.update(
          delta,
          player.alcoholLevel,
          player.isPassedOut,
          isCheersing,
          undefined,
          extraState
        );
      }
    });

    if (nhapMoiSpotlight) {
      if (spotlightTargetPos) {
        nhapMoiSpotlight.visible = true;
        nhapMoiSpotlight.position.set(
          (spotlightTargetPos as THREE.Vector3).x,
          1.95,
          (spotlightTargetPos as THREE.Vector3).z
        );
      } else {
        nhapMoiSpotlight.visible = false;
      }
    }

    // Update Bottle Spin Physics
    if (spinningBottle && spinningBottle.visible && bottleSpinSpeed > 0) {
      bottleAngle += bottleSpinSpeed * delta;
      spinningBottle.rotation.y = bottleAngle;
      bottleSpinSpeed = Math.max(0, bottleSpinSpeed - delta * 2.8);
    }

    // ============================================================================
    // CONTEXTUAL 3-MODE CAMERA SYSTEM + TAB/V FIRST-PERSON POV + DRUNK SWAY FX
    // ============================================================================
    // Determine effective camera mode
    let activeCamMode = currentIKState.cameraMode;
    if (currentIKState.controlMode === 'free_roam' || currentMinigame === 'bill_fight') {
      activeCamMode = 'free_roam';
    } else if (
      currentMinigame !== 'none' &&
      currentIKState.cameraMode !== 'first_person'
    ) {
      activeCamMode = 'minigame_focus';
    }

    // Figure-8 Perlin-style Camera Sway when alcohol >= 30% (unless cleared by Cold Towel / Ice Water)
    let swayX = 0;
    let swayY = 0;
    if (userDrunkLevel >= 30 && !isColdTowelClear) {
      const intensity = ((userDrunkLevel - 25) / 75) * 0.22;
      // Figure-8 Lissajous curve (sin(t) on X, sin(2t) on Y)
      swayX =
        (Math.sin(time * 1.45) * 0.75 + Math.cos(time * 2.8) * 0.25) * intensity;
      swayY =
        (Math.sin(time * 2.9) * 0.7 + Math.cos(time * 1.9) * 0.3) * intensity * 0.65;
    }

    if (lobbyMode !== 'off') {
      // Lobby: slow cinematic drift; on wide screens the table sits right of the menu panel
      const wide = camera.aspect > 1.15;
      wardrobeSet?.children.forEach((c) => {
        if (c.userData.isWardrobeCloth) {
          c.rotation.x = Math.sin(time * 1.6 + c.userData.swayPhase) * 0.18;
        }
      });
      if (lobbyMode === 'wardrobe') {
        _camTargetPos.set(WARDROBE_SPOT.x - (wide ? 0.6 : 0), 1.55, WARDROBE_SPOT.z + 3.7);
        _camLookAt.set(WARDROBE_SPOT.x - (wide ? 1.05 : 0), wide ? 0.85 : 0.55, WARDROBE_SPOT.z - 0.2);
        camera.fov = THREE.MathUtils.damp(camera.fov, wide ? 40 : 52, 4, rawDelta);
      } else {
        const drift = Math.sin(time * 0.17) * 0.35;
        if (wide) {
          _camTargetPos.set(1.2 + drift, 3.1, 6.0);
          _camLookAt.set(-1.25, 0.55, 0);
        } else {
          // Portrait: pull far back so all 8 stools fit the narrow horizontal FOV
          _camTargetPos.set(drift * 0.6, 6.6, 8.4);
          _camLookAt.set(0, -0.6, 0.4);
        }
        camera.fov = THREE.MathUtils.damp(camera.fov, wide ? 42 : 56, 4, rawDelta);
      }
      camera.updateProjectionMatrix();
    } else if (slowMoTimer > 0) {
      // Dynamic Slow-Mo Zoom into clinking glasses at center of table ("1, 2, 3 Dzô!")
      _camTargetPos.set(0.25 + swayX, 1.85 + swayY, 2.15);
      _camLookAt.set(0, 1.15, 0);
      camera.fov = THREE.MathUtils.damp(camera.fov, 34, 8, rawDelta);
      camera.updateProjectionMatrix();
    } else if (activeCamMode === 'first_person') {
      // A2. First-Person POV (Tab / V): Eye level from user seat looking across table or down at dice cup
      _camTargetPos.set(
        currentIKState.aimX * 0.14 * (pointerLocked ? 0 : 1) + swayX * 0.8,
        1.34 + swayY * 0.8,
        1.48
      );
      const fpAim = pointerLocked ? 0 : 1;
      _camLookAt.set(
        currentIKState.aimX * 1.25 * fpAim + swayX,
        0.95 + currentIKState.aimY * 0.55 * fpAim + swayY,
        -1.2
      );
      camera.fov = THREE.MathUtils.damp(camera.fov, 50, 6, rawDelta);
      camera.updateProjectionMatrix();
    } else if (activeCamMode === 'minigame_focus') {
      // B. Dynamic Minigame Focus Camera: Zoomed into center props (Crocodile, Liar's Dice, Spin Bottle)
      _camTargetPos.set(0.18 + swayX * 0.5, 2.28 + swayY * 0.5, 2.28);
      _camLookAt.set(0, 0.96, 0);
      camera.fov = THREE.MathUtils.damp(camera.fov, 40, 6, rawDelta);
      camera.updateProjectionMatrix();
    } else if (activeCamMode === 'free_roam') {
      // C. Free-Roam 3rd Person Follow Camera (Party Animals / Gang Beasts style)
      const px = currentIKState.freeRoamPos.x;
      const pz = currentIKState.freeRoamPos.z;
      _camTargetPos.set(px + 0.35 + swayX, 2.45 + swayY, pz + 2.55);
      _camLookAt.set(px, 0.85, pz - 0.4);
      camera.fov = THREE.MathUtils.damp(camera.fov, 48, 6, rawDelta);
      camera.updateProjectionMatrix();
    } else {
      // A1. Seated 3rd-Person Over-the-Shoulder / Isometric 35°-45° (Default 70% time)
      // Shows user's own Chibi character on plastic stool + all dishes + friends around the table
      let someoneClimbingTree = false;
      playerRigs.forEach(({ player }) => {
        if (player.isClimbingTree) someoneClimbingTree = true;
      });
      _camTargetPos.set(0.58 + swayX, 2.55 + swayY, 3.65);
      const seatAim = pointerLocked ? 0 : 1;
      _camLookAt.set(
        (someoneClimbingTree ? -0.9 : 0) + currentIKState.aimX * 0.22 * seatAim,
        (someoneClimbingTree ? 1.08 : 0.92) + currentIKState.aimY * 0.1 * seatAim,
        someoneClimbingTree ? -0.6 : -0.15
      );
      camera.fov = THREE.MathUtils.damp(camera.fov, 45, 6, rawDelta);
      camera.updateProjectionMatrix();
    }

    // Mouse look: reset when the camera mode changes, then rotate the mode's framing
    if (lobbyMode === 'off') {
      if (activeCamMode !== lastLookCamMode) {
        lastLookCamMode = activeCamMode;
        camYaw = 0;
        camPitch = 0;
      }
      if (slowMoTimer <= 0 && (camYaw !== 0 || camPitch !== 0)) {
        applyMouseLook(activeCamMode === 'first_person');
      }
    }

    const posRate = pointerLocked ? 14 : 5;
    const lookRate = pointerLocked ? 16 : 6;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTargetPos.x, posRate, rawDelta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTargetPos.y, posRate, rawDelta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, posRate, rawDelta);

    _currentLookAt.x = THREE.MathUtils.damp(_currentLookAt.x, _camLookAt.x, lookRate, rawDelta);
    _currentLookAt.y = THREE.MathUtils.damp(_currentLookAt.y, _camLookAt.y, lookRate, rawDelta);
    _currentLookAt.z = THREE.MathUtils.damp(_currentLookAt.z, _camLookAt.z, lookRate, rawDelta);
    camera.lookAt(_currentLookAt);

    if (pointerLocked && lobbyMode === 'off') updateCrosshairAim();

    streetBackdrop?.update(time);

    if (composer && bloomEnabled) composer.render(rawDelta);
    else renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  function afterDraw(cb: () => void) {
    if (!renderer) return;
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 60);
      }
    };
    frameId = window.setTimeout(poll, 5);
  }

  return {
    mount: (mountDiv: HTMLDivElement) => {
      container = mountDiv;

      // Software WebGL Detection (Three.js r160+ standard)
      const gl = document.createElement('canvas').getContext('webgl2');
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } else {
        isSoftwareGl = true;
      }

      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.setSize(mountDiv.clientWidth, mountDiv.clientHeight);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      mountDiv.appendChild(renderer.domElement);

      setupScene();

      // Studio Reflection via RoomEnvironment
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene!.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();

      if (!isSoftwareGl) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene!, camera!));
        composer.addPass(new ShaderPass(HdrClampShader));
        bloomPass = new UnrealBloomPass(
          new THREE.Vector2(mountDiv.clientWidth / 2, mountDiv.clientHeight / 2),
          1.6, // strength
          0.35, // radius
          // Lit surfaces under the table spotlight reach ~2.5; emissives get clamped to 3.0,
          // so only neon, bulbs, signs and lamps cross this threshold
          2.92
        );
        composer.addPass(bloomPass);
        composer.addPass(new OutputPass());
      }

      const onResize = () => {
        if (!container || !camera || !renderer) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        composer?.setSize(container.clientWidth, container.clientHeight);
      };
      onResizeHandler = onResize;
      window.addEventListener('resize', onResize);
      container.addEventListener('pointerdown', onPointerDown);
      container.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerlockchange', onPointerLockStateChange);
      document.addEventListener('pointerlockerror', markPointerLockUnavailable);
      window.addEventListener('pointermove', onDragLookMove);
      window.addEventListener('pointerup', onDragLookEnd);
      window.addEventListener('pointercancel', onDragLookEnd);
      document.addEventListener('mousemove', onMouseLook);

      tick();
    },

    destroy: () => {
      if (isSoftwareGl) {
        clearTimeout(frameId);
      } else {
        cancelAnimationFrame(frameId);
      }
      container?.removeEventListener('pointerdown', onPointerDown);
      container?.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerlockchange', onPointerLockStateChange);
      document.removeEventListener('pointerlockerror', markPointerLockUnavailable);
      window.removeEventListener('pointermove', onDragLookMove);
      window.removeEventListener('pointerup', onDragLookEnd);
      window.removeEventListener('pointercancel', onDragLookEnd);
      document.removeEventListener('mousemove', onMouseLook);
      if (pointerLocked) document.exitPointerLock();
      if (onResizeHandler) window.removeEventListener('resize', onResizeHandler);
      onResizeHandler = null;
      composer?.dispose();
      composer = null;
      renderer?.domElement.remove();
      renderer?.forceContextLoss();
      renderer?.dispose();
    },

    updatePlayers: (players: Player[]) => {
      if (!scene) return;
      const numPlayers = players.length;
      const tableRadius = 1.95;
      const inLobby = lobbyMode !== 'off';

      players.forEach((p, idx) => {
        // Place seat 0 (user) at +Math.PI/2 (foreground x=0, z=+1.95) so Over-the-Shoulder camera sees user + friends!
        // The lobby uses 8 fixed seats so empty stools can show a [+ Rủ Nhậu] slot.
        const angle = inLobby
          ? lobbySeatAngle(p.seatIndex)
          : (idx / numPlayers) * Math.PI * 2 + Math.PI / 2;
        const x = Math.cos(angle) * tableRadius;
        const z = Math.sin(angle) * tableRadius;

        let entry = playerRigs.get(p.id);
        if (
          entry &&
          (entry.player.avatar !== p.avatar ||
            entry.player.clothing !== p.clothing ||
            entry.player.hat !== p.hat ||
            entry.player.glassType !== p.glassType)
        ) {
          scene!.remove(entry.rig.root);
          scene!.remove(entry.stool);
          playerRigs.delete(p.id);
          entry = undefined;
        }

        if (!entry) {
          const stool = createPlasticStool(idx % 2 === 0 ? 0xdc2626 : 0x0284c7);
          const rig = createChibiCharacter(p.avatar, p.clothing, p.hat, p.glassType);
          rig.root.userData = { playerId: p.id, isPassedOut: p.isPassedOut };
          rig.root.position.set(x, 0, z);
          rig.root.rotation.y = -angle - Math.PI / 2;
          if (p.isUser && lobbyMode === 'wardrobe') {
            // Skin swapped in the wardrobe: rebuild in place on the barber stool
            rig.root.position.copy(WARDROBE_SPOT);
          }
          if (inLobby && !p.isUser) {
            // Friends arrive from the street on the right (the menu covers the left on wide
            // screens), circle the table along the shorter arc, then hop onto their stool
            const spawnX = 5.5;
            rig.root.position.set(spawnX, 0, LOBBY_STREET_SPAWN_Z);
            const ringR = 3.0;
            const startA = Math.atan2(LOBBY_STREET_SPAWN_Z, spawnX);
            let diff = (angle - startA) % (Math.PI * 2);
            if (diff > Math.PI) diff -= Math.PI * 2;
            if (diff < -Math.PI) diff += Math.PI * 2;
            const steps = Math.max(1, Math.ceil(Math.abs(diff) / 0.4));
            const route: { x: number; z: number }[] = [];
            for (let i = 0; i <= steps; i++) {
              const a = startA + (diff * i) / steps;
              route.push({ x: Math.cos(a) * ringR, z: Math.sin(a) * ringR });
            }
            lobbyWaypoints.set(p.id, route);
          }

          scene!.add(stool);
          scene!.add(rig.root);

          entry = { rig, stool, player: p };
          playerRigs.set(p.id, entry);
        }

        entry.player = p;
        entry.stool.position.set(x, 0, z);
        entry.stool.rotation.y = -angle + Math.PI / 2;
        entry.rig.root.userData.isPassedOut = p.isPassedOut;
        entry.rig.setDoodles(p.faceDoodles || []);
        entry.rig.setNameplateHidden(inLobby);
        const specialStatus = p.isCallingMaiAnh
          ? '📲 ĐANG GỌI NYC MAI ANH 💔'
          : p.isHeartbrokenMaiAnh
          ? '💔 BỊ MAI ANH BLOCK 😭'
          : p.isClimbingTree
          ? '🌳 ĐANG LEO CÂY HÓNG GIÓ 🐻'
          : null;
        entry.rig.setNameplate(
          p.name,
          p.title,
          p.alcoholLevel,
          p.isUser,
          p.avatar,
          specialStatus
        );
      });

      // Remove players who left
      playerRigs.forEach((val, id) => {
        if (!players.find((p) => p.id === id)) {
          scene?.remove(val.rig.root);
          scene?.remove(val.stool);
          playerRigs.delete(id);
          lobbyWaypoints.delete(id);
          lobbyReactions.delete(id);
        }
      });
      refreshLobbyStools();
    },

    setLobbyMode: (mode: LobbyMode) => {
      lobbyMode = mode;
      if (mode !== 'off') ensureLobbyProps();
      if (wardrobeSet) wardrobeSet.visible = mode === 'wardrobe';
      playerRigs.forEach(({ rig }) => rig.setNameplateHidden(mode !== 'off'));
      refreshLobbyStools();
    },

    getLobbyAnchors: () => {
      const anchors: LobbyAnchor[] = [];
      if (!camera || !container) return anchors;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const bySeat = new Map<number, { rig: CharacterRig; stool: THREE.Group; player: Player }>();
      playerRigs.forEach((entry) => bySeat.set(entry.player.seatIndex, entry));
      for (let i = 0; i < LOBBY_SEAT_COUNT; i++) {
        const entry = bySeat.get(i);
        let seated = false;
        if (entry) {
          const r = entry.rig.root.position;
          _projVec.set(r.x, r.y + 1.4, r.z);
          seated =
            !lobbyWaypoints.has(entry.player.id) &&
            Math.hypot(r.x - entry.stool.position.x, r.z - entry.stool.position.z) < 0.1;
        } else {
          const angle = lobbySeatAngle(i);
          _projVec.set(Math.cos(angle) * LOBBY_TABLE_RADIUS, 0.85, Math.sin(angle) * LOBBY_TABLE_RADIUS);
        }
        _projVec.project(camera);
        const onScreen =
          _projVec.z < 1 && Math.abs(_projVec.x) <= 1.05 && Math.abs(_projVec.y) <= 1.05;
        anchors.push({
          seatIndex: i,
          x: ((_projVec.x + 1) / 2) * w,
          y: ((1 - _projVec.y) / 2) * h,
          onScreen,
          playerId: entry ? entry.player.id : null,
          seated,
        });
      }
      return anchors;
    },

    set onPointerLockChange(cb: ((locked: boolean, unavailable?: boolean) => void) | undefined) {
      onPointerLockChangeCb = cb;
    },

    releasePointerLock: () => {
      if (pointerLocked) document.exitPointerLock();
    },

    getCameraYaw: () => camYaw,

    setGraphicsQuality: (quality: 'low' | 'high') => {
      if (!renderer) return;
      const low = quality === 'low' || isSoftwareGl;
      renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = !low;
      bloomEnabled = !low;
      if (composer && container) {
        composer.setPixelRatio(renderer.getPixelRatio());
        composer.setSize(container.clientWidth, container.clientHeight);
      }
      scene?.traverse((obj) => {
        const mat = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (!mat) return;
        (Array.isArray(mat) ? mat : [mat]).forEach((m) => (m.needsUpdate = true));
      });
    },

    triggerLobbyReaction: (playerId: string, kind: LobbyReaction) => {
      lobbyReactions.set(playerId, { kind, t: 0, dur: kind === 'munch' ? 1.4 : 0.9 });
    },

    set onLobbyCharacterClick(cb: ((playerId: string) => void) | undefined) {
      onLobbyCharacterClickCb = cb;
    },

    set onLobbySeatClick(cb: ((seatIndex: number) => void) | undefined) {
      onLobbySeatClickCb = cb;
    },

    updateFoodDishes: (dishes: FoodDish[]) => {
      if (!scene) return;
      dishes.forEach((d) => {
        let platter = foodPlattersMap.get(d.id);
        if (!platter) {
          platter = createFoodPlatter(d.id);
          const pos = DISH_POSITIONS[d.id] || [0, 0.98, 0];
          platter.position.set(pos[0], pos[1], pos[2]);
          platter.userData.isFood = true;
          platter.userData.foodType = d.id;
          scene!.add(platter);
          foodPlattersMap.set(d.id, platter);
        }

        platter.userData.servings = d.servings;
        const morsels = platter.userData.morsels as THREE.Object3D[] | undefined;
        if (morsels && morsels.length > 0) {
          const ratio = Math.max(0, Math.min(1, d.servings / Math.max(1, d.maxServings)));
          const visibleCount = d.servings === 0 ? 0 : Math.max(1, Math.ceil(ratio * morsels.length));
          morsels.forEach((m, idx) => {
            m.visible = idx < visibleCount;
            if (d.servings !== 1) {
              m.scale.set(1, 1, 1);
            }
          });
        }
      });
    },

    updateIKState: (state: IKHandControlState) => {
      currentIKState = state;
    },

    setToiletOccupied: (occupied: boolean) => {
      if (!toiletBooth) return;
      const mat = toiletBooth.statusBulb.material as THREE.MeshStandardMaterial;
      mat.color.setHex(occupied ? 0xef4444 : 0x22c55e);
      mat.emissive.setHex(occupied ? 0xef4444 : 0x22c55e);
    },

    setUserCupFillRatio: (ratio: number) => {
      if (!isCheersing) {
        userCupFillRatio = Math.max(0, Math.min(1, ratio));
      }
    },

    triggerCheers: (targetEndFillRatio = 0) => {
      isCheersing = true;
      cheersTimer = 2.6;
      slowMoTimer = 0.58; // 0.58s Slow-Motion Zoom into clinking glasses at center
      cheersStartFillRatio = Math.max(0.2, userCupFillRatio);
      cheersTargetEndFillRatio = Math.max(0, Math.min(1, targetEndFillRatio));
      burstFoam(0, 1.24, 0);
      setTimeout(() => {
        burstFoam(0, 1.26, 0);
      }, 280);
    },

    triggerChopstickGrab: (dishId: string, targetPlayerId: string, isSpicy = false) => {
      if (!primaryChopsticks) return;
      const pos = DISH_POSITIONS[dishId] || [0, 0.98, 0];
      _startPos.set(pos[0], pos[1] + 0.08, pos[2]);

      const targetEntry = playerRigs.get(targetPlayerId);
      if (targetEntry) {
        _endPos.copy(targetEntry.rig.root.position);
        _endPos.y += 1.05; // Mouth height
      } else {
        _endPos.set(0, 1.25, 1.85);
      }

      const mat = primaryChopsticks.morselMesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(isSpicy ? 0xdc2626 : DISH_MORSEL_COLORS[dishId] || 0xd97706);

      grabAnim.start.copy(_startPos);
      grabAnim.end.copy(_endPos);
      grabAnim.progress = 0;
      grabAnim.active = true;
      primaryChopsticks.group.visible = true;
      primaryChopsticks.morselMesh.visible = true;
    },

    triggerThrowAtFriend: () => {
      if (!thrownProjectile) return null;
      const bots: { id: string; name: string; pos: THREE.Vector3 }[] = [];
      playerRigs.forEach((val, id) => {
        if (!val.player.isUser) {
          bots.push({ id, name: val.player.name, pos: val.rig.root.position });
        }
      });
      if (bots.length === 0) return null;

      // Pick the friend closest to the current aimX direction
      const chosen = bots[Math.floor(Math.random() * bots.length)];
      throwAnim.start.set(currentIKState.aimX * 0.4, 1.15, 1.45);
      throwAnim.end.copy(chosen.pos);
      throwAnim.end.y += 1.08; // Head height
      throwAnim.progress = 0;
      throwAnim.active = true;
      thrownProjectile.visible = true;
      return chosen.name;
    },

    triggerFeedDog: () => {
      dogJumpTimer = 0.9;
    },

    triggerTreeShake: () => {
      treeShakeTimer = 1.1;
    },

    triggerPushFoodCartCrash: () => {
      foodCartCrashTimer = 2.2;
      neighborTableFlipTimer = 3.5;
      burstFoam(3.15, 1.15, 0.35);
    },

    triggerFlipNeighborTable: () => {
      neighborTableFlipTimer = 4.0;
      burstFoam(3.2, 1.15, 0.35);
    },

    setYellowPeePuddleActive: (active: boolean) => {
      if (yellowPeePuddle) {
        yellowPeePuddle.visible = active;
      }
    },

    setRainAndTarp: (raining: boolean, tarpPulled: boolean) => {
      isRainingState = raining;
      isTarpPulledState = tarpPulled;
    },

    setKaraokeSpeakerActive: (active: boolean) => {
      isKaraokeActiveState = active;
    },

    setRainbowPuddleActive: (active: boolean) => {
      if (rainbowPuddleGroup) {
        rainbowPuddleGroup.visible = active;
      }
    },

    setKaraokeDiscoRoomMode: (active: boolean) => {
      isKaraokeDiscoRoomState = active;
    },

    setChopstickClash: (active: boolean, dishId = 'chicken_feet') => {
      clashAnim.active = active;
      if (primaryChopsticks && rivalChopsticks) {
        if (active) {
          const pos = DISH_POSITIONS[dishId] || [0, 0.98, 0];
          clashAnim.center.set(pos[0], pos[1] + 0.08, pos[2]);
          primaryChopsticks.group.visible = true;
          primaryChopsticks.morselMesh.visible = true;
          rivalChopsticks.group.visible = true;
          rivalChopsticks.morselMesh.visible = false;
        } else {
          primaryChopsticks.group.visible = false;
          rivalChopsticks.group.visible = false;
        }
      }
    },

    setActiveMinigame: (minigame: MinigameId) => {
      currentMinigame = minigame;
      if (crocodile) {
        crocodile.group.visible = minigame === 'crocodile';
      }
      if (spinningBottle) {
        spinningBottle.visible = minigame === 'spin_bottle';
      }
      const showFood =
        minigame === 'none' ||
        minigame === 'truth_or_dare' ||
        minigame === 'liars_dice' ||
        minigame === 'fifteen_twenty';
      foodPlattersMap.forEach((f) => {
        f.visible = showFood;
      });
    },

    spinBottle: () => {
      if (!spinningBottle) return;
      bottleSpinSpeed = 16 + Math.random() * 12;
    },

    pressCrocodileTooth: (toothIndex: number, isTrap: boolean) => {
      if (!crocodile) return;
      const tooth = crocodile.teeth[toothIndex];
      if (tooth && !tooth.userData.isPressed) {
        tooth.userData.isPressed = true;
        tooth.position.y = 0.12;
        tooth.material = tooth.userData.toothPressedMat;

        if (isTrap) {
          crocodile.jawGroup.rotation.x = -0.05;
        }
      }
    },

    resetCrocodile: () => {
      if (!crocodile) return;
      crocodile.jawGroup.rotation.x = -0.7;
      crocodile.teeth.forEach((t) => {
        t.userData.isPressed = false;
        t.position.y = t.userData.origY;
        t.material = t.userData.toothMat;
      });
    },

    setUserDrunkLevel: (level: number) => {
      userDrunkLevel = level;
    },

    set onToothClick(cb: (index: number) => void) {
      onToothClickCb = cb;
    },

    set onFoodClick(cb: (type: string) => void) {
      onFoodClickCb = cb;
    },

    set onBottleClick(cb: () => void) {
      onBottleClickCb = cb;
    },

    set onIceBucketClick(cb: () => void) {
      onIceBucketClickCb = cb;
    },

    set onToiletClick(cb: () => void) {
      onToiletClickCb = cb;
    },

    set onCauVangClick(cb: () => void) {
      onCauVangClickCb = cb;
    },

    set onNeighborTableClick(cb: () => void) {
      onNeighborTableClickCb = cb;
    },

    set onKaraokeSpeakerClick(cb: () => void) {
      onKaraokeSpeakerClickCb = cb;
    },

    set onGreenTreeClick(cb: () => void) {
      onGreenTreeClickCb = cb;
    },

    set onOpenKitchenClick(cb: () => void) {
      onOpenKitchenClickCb = cb;
    },

    set onConvenienceATMClick(cb: () => void) {
      onConvenienceATMClickCb = cb;
    },

    set onIndustrialFanClick(cb: () => void) {
      onIndustrialFanClickCb = cb;
    },

    set onPassedOutFaceClick(cb: (playerId: string) => void) {
      onPassedOutFaceClickCb = cb;
    },

    set onPointerAimChange(cb: (aimX: number, aimY: number) => void) {
      onPointerAimChangeCb = cb;
    },
  };
}

