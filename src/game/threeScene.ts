import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createStainlessTable,
  createPlasticStool,
  createBeerTower,
  createCrocodileToy,
  createSpinningBottle,
  createFoodPlatter,
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
}

// Reusable math helpers outside render loop
const _startPos = new THREE.Vector3();
const _endPos = new THREE.Vector3();
const _midPos = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3(0, 0.92, -0.15);

// Fixed positions on the round stainless steel table for each dish type
const DISH_POSITIONS: Record<string, [number, number, number]> = {
  peanut: [0.32, 0.98, -0.42],
  chicken_feet: [-0.24, 0.98, 0.42],
  hotpot: [0.46, 0.98, 0.18],
  oc_huong: [-0.55, 0.98, 0.25],
  ca_vien: [0.02, 0.98, -0.52],
  xoai_non: [0.22, 0.98, 0.56],
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
    scene.background = new THREE.Color(0x0c0a09);
    scene.fog = new THREE.FogExp2(0x0c0a09, 0.025);

    // Over-the-Shoulder / Isometric 35°-45° party table perspective
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.set(0.55, 2.55, 3.65);
    camera.lookAt(0, 0.92, -0.15);


    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Balanced 3-Point Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x18181b, 0.6);
    scene.add(hemiLight);

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
    const groundGeo = new THREE.PlaneGeometry(30, 30);
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
    // Placed on the sidewalk behind-left of Khoa Nguyễn (-1.20, 0, -2.98): far from the table/stools, yet 100% visible in center-left camera view!
    sidewalkGreenTree = createSidewalkGreenTree();
    sidewalkGreenTree.group.position.set(-1.2, 0, -2.98);
    sidewalkGreenTree.group.userData = { isGreenTree: true };
    scene.add(sidewalkGreenTree.group);

    // Open-Air Charcoal Grill Kitchen ("Khu Vực Bếp Lộ Thiên - Nướng Mực & Hàu Mỡ Hành + Dao Phay")
    openKitchen = createOpenCharcoalKitchen();
    openKitchen.group.position.set(2.25, 0, -2.75);
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
    toiletBooth.group.position.set(-3.45, 0, -2.55);
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

  function onPointerMove(event: PointerEvent) {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, -((event.clientY - rect.top) / rect.height) * 2 + 1));
    onPointerAimChangeCb?.(x, y);
  }

  function onPointerDown(event: MouseEvent) {
    if (!container || !camera || !scene || !raycaster) return;
    const rect = container.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    mouse?.set(x, y);

    raycaster.setFromCamera(mouse!, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      for (const hit of intersects) {
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
    playerRigs.forEach(({ rig, player }) => {
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
        const treeClimbTargetX = -1.12;
        const treeClimbTargetZ = -2.72;
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

    if (slowMoTimer > 0) {
      // Dynamic Slow-Mo Zoom into clinking glasses at center of table ("1, 2, 3 Dzô!")
      _camTargetPos.set(0.25 + swayX, 1.85 + swayY, 2.15);
      _camLookAt.set(0, 1.15, 0);
      camera.fov = THREE.MathUtils.damp(camera.fov, 34, 8, rawDelta);
      camera.updateProjectionMatrix();
    } else if (activeCamMode === 'first_person') {
      // A2. First-Person POV (Tab / V): Eye level from user seat looking across table or down at dice cup
      _camTargetPos.set(
        currentIKState.aimX * 0.14 + swayX * 0.8,
        1.34 + swayY * 0.8,
        1.48
      );
      _camLookAt.set(
        currentIKState.aimX * 1.25 + swayX,
        0.95 + currentIKState.aimY * 0.55 + swayY,
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
      _camLookAt.set(
        (someoneClimbingTree ? -0.25 : 0) + currentIKState.aimX * 0.22,
        (someoneClimbingTree ? 1.08 : 0.92) + currentIKState.aimY * 0.1,
        someoneClimbingTree ? -0.55 : -0.15
      );
      camera.fov = THREE.MathUtils.damp(camera.fov, 45, 6, rawDelta);
      camera.updateProjectionMatrix();
    }

    camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTargetPos.x, 5, rawDelta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTargetPos.y, 5, rawDelta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, 5, rawDelta);

    _currentLookAt.x = THREE.MathUtils.damp(_currentLookAt.x, _camLookAt.x, 6, rawDelta);
    _currentLookAt.y = THREE.MathUtils.damp(_currentLookAt.y, _camLookAt.y, 6, rawDelta);
    _currentLookAt.z = THREE.MathUtils.damp(_currentLookAt.z, _camLookAt.z, 6, rawDelta);
    camera.lookAt(_currentLookAt);

    renderer.render(scene, camera);

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

      const onResize = () => {
        if (!container || !camera || !renderer) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      };
      window.addEventListener('resize', onResize);
      container.addEventListener('pointerdown', onPointerDown);
      container.addEventListener('pointermove', onPointerMove);

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
      renderer?.dispose();
    },

    updatePlayers: (players: Player[]) => {
      if (!scene) return;
      const numPlayers = players.length;
      const tableRadius = 1.95;

      players.forEach((p, idx) => {
        // Place seat 0 (user) at +Math.PI/2 (foreground x=0, z=+1.95) so Over-the-Shoulder camera sees user + friends!
        const angle = (idx / numPlayers) * Math.PI * 2 + Math.PI / 2;
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
        }
      });
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

