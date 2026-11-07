import * as THREE from 'three';
import { Player } from './types';
import { BikeSkinId } from './commuteLoopLogic';

export type AvatarType = Player['avatar'];

export type Commute3DStage =
  | 'spawn_house_decision'
  | 'outbound_fpp_drive'
  | 'outbound_grab_vip'
  | 'return_parking_decision'
  | 'return_drunk_fpp_drive'
  | 'return_grab_vip'
  | 'checkpoint_20m_breathalyzer_qte'
  | 'impound_cutscene_summary';

export interface Commute3DState {
  active: boolean;
  stage: Commute3DStage;
  bikeSkin: BikeSkinId;
  userAvatar: AvatarType;
  isEngineRunning: boolean;
  kickstartCount: number;
  isKickstandDown: boolean;
  speedKmh: number;
  lateralOffset: number;
  steerInput: number;
  isHoldingThrottle: boolean;
  isHoldingBrake: boolean;
  isHornPressed: boolean;
  distanceTraveledM: number;
  targetDistanceM: number;
  isWipedOut: boolean;
  isSignboardHit: boolean;
  isParkedInChalkBox: boolean;
  alcoholLevel: number;
  cameraViewMode: 'fpp' | 'tpp';
  grabCameraAngleDeg: number;
  grabWaitTimer: number;
  breathHoldProgress: number;
}

export const DEFAULT_COMMUTE_3D_STATE: Commute3DState = {
  active: false,
  stage: 'spawn_house_decision',
  bikeSkin: 'dream_chien',
  userAvatar: 'dog',
  isEngineRunning: false,
  kickstartCount: 0,
  isKickstandDown: true,
  speedKmh: 0,
  lateralOffset: 0,
  steerInput: 0,
  isHoldingThrottle: false,
  isHoldingBrake: false,
  isHornPressed: false,
  distanceTraveledM: 0,
  targetDistanceM: 250,
  isWipedOut: false,
  isSignboardHit: false,
  isParkedInChalkBox: false,
  alcoholLevel: 0,
  cameraViewMode: 'fpp',
  grabCameraAngleDeg: 0,
  grabWaitTimer: 0,
  breathHoldProgress: 0,
};

const AVATAR_PAW_COLORS: Record<AvatarType, number> = {
  dog: 0xf59e0b,
  panda: 0xf4f4f5,
  bear: 0x92400e,
  cat: 0xfde68a,
  duck: 0xfacc15,
  hamster: 0xfdba74,
};

const BIKE_SKIN_COLORS: Record<
  BikeSkinId,
  { body: number; trim: number; exhaust: number; seat: number }
> = {
  dream_chien: {
    body: 0x7f1d1d, // Nâu nho huyền thoại Dream Thái
    trim: 0xfef3c7,
    exhaust: 0xe4e4e7,
    seat: 0x18181b,
  },
  wave_do_po: {
    body: 0x0284c7, // Xanh nhớt Wave Alpha độ pô
    trim: 0x38bdf8,
    exhaust: 0xf59e0b, // Cổ pô titan vàng tím
    seat: 0x09090b,
  },
  cub_50: {
    body: 0x15803d, // Xanh cổ vịt Cub 50
    trim: 0xfef9c3,
    exhaust: 0xd4d4d8,
    seat: 0x78350f, // Yên nâu cổ điển
  },
};

function createDialCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Dark metallic dial face
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(128, 128, 122, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#e4e4e7';
  ctx.stroke();

  // Speedometer tick marks (0 to 80 km/h)
  for (let i = 0; i <= 8; i++) {
    const angle = Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
    const x1 = 128 + Math.cos(angle) * 84;
    const y1 = 128 + Math.sin(angle) * 84;
    const x2 = 128 + Math.cos(angle) * 108;
    const y2 = 128 + Math.sin(angle) * 108;
    ctx.strokeStyle = i >= 6 ? '#ef4444' : '#fbbf24';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const tx = 128 + Math.cos(angle) * 62;
    const ty = 128 + Math.sin(angle) * 62;
    ctx.fillStyle = i >= 6 ? '#fca5a5' : '#fef08a';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i * 10), tx, ty);
  }

  // Fuel gauge bar at bottom of dial
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(88, 186, 80, 10);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('KM/H • XĂNG F', 128, 168);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBannerTexture(
  text: string,
  subtext: string,
  bgHex: string,
  fgHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = fgHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = fgHex;
  ctx.font = '900 32px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 52);
  ctx.font = '700 20px "Be Vietnam Pro", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(subtext, 256, 94);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface Commute3DController {
  root: THREE.Group;
  update: (
    time: number,
    delta: number,
    state: Commute3DState,
    camera: THREE.PerspectiveCamera,
    camTargetPos: THREE.Vector3,
    camLookAt: THREE.Vector3
  ) => boolean;
}

/**
 * Builds the continuous 3D Alley & Street Commute Corridor along X = 0 from Z = 32 (Player's Tube House)
 * straight down to Z = 5.6 (the Crossroads Sidewalk Pub Curb at Z = 4.8), so the player literally
 * drives through the 3D Saigon alley directly up to the 3D pub table!
 */
export function createCommute3DWorld(): Commute3DController {
  const root = new THREE.Group();
  root.name = 'Commute3DWorld';
  const START_Z = 32.0; // Player's Tube House Gate in the alley
  const END_Z = 5.8; // Crossroads Sidewalk Pub Parking Box right in front of the pub curb (Z=4.8)
  root.visible = false;

  // ---------------------------------------------------------------------------
  // 1. 3D ASPHALT ALLEY ROAD, SIDEWALKS & LANE MARKINGS (Z = 5 to Z = 37)
  // ---------------------------------------------------------------------------
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.88,
    metalness: 0.08,
  });
  const roadMesh = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.05, 32), roadMat);
  roadMesh.position.set(0, 0.005, 20.5);
  roadMesh.receiveShadow = true;
  root.add(roadMesh);

  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0x44403c,
    roughness: 0.92,
  });
  [-4.6, 4.6].forEach((sx) => {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 30), sidewalkMat);
    sw.position.set(sx, 0.08, 21.0);
    sw.receiveShadow = true;
    root.add(sw);
  });

  // Dashed yellow-white center line along the alley
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  for (let z = 7.5; z <= 31.5; z += 2.6) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 1.3), dashMat);
    dash.position.set(0, 0.032, z);
    root.add(dash);
  }

  // Row of 3D Shophouses ("Nhà Ống Hẻm Đêm") lining both sides of the alley (Z = 11 to Z = 31)
  const houseColors = [0xf2c14e, 0xe9a178, 0x9fd3c7, 0xf4e1c1, 0xd4a373, 0xa5b4fc];
  const windowLitMat = new THREE.MeshBasicMaterial({ color: 0xfde68a });
  const balconyMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    metalness: 0.5,
    roughness: 0.5,
  });

  for (let i = 0; i < 6; i++) {
    const zPos = 30.5 - i * 3.8;
    [-6.8, 6.8].forEach((sideX, sIdx) => {
      const h = 6.2 + ((i + sIdx) % 3) * 1.8;
      const col = houseColors[(i + sIdx * 2) % houseColors.length];
      const hGroup = new THREE.Group();
      const bMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, h, 3.5),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 })
      );
      bMesh.position.y = h / 2;
      hGroup.add(bMesh);

      const win = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 1.4), windowLitMat);
      win.position.set(sideX < 0 ? 1.62 : -1.62, 3.8, 0);
      hGroup.add(win);

      const bal = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 2.1), balconyMat);
      bal.position.set(sideX < 0 ? 1.82 : -1.82, 3.0, 0);
      hGroup.add(bal);

      hGroup.position.set(sideX, 0, zPos);
      root.add(hGroup);
    });
  }

  // Warm Street Lamps along the alley
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    metalness: 0.6,
    roughness: 0.4,
  });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  [11, 18, 25, 31].forEach((lz, idx) => {
    const side = idx % 2 === 0 ? -3.5 : 3.5;
    const pGroup = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.0, 8), poleMat);
    pole.position.y = 2.5;
    pGroup.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.07), poleMat);
    arm.position.set(side < 0 ? 0.5 : -0.5, 4.9, 0);
    pGroup.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), bulbMat);
    bulb.position.set(side < 0 ? 0.95 : -0.95, 4.8, 0);
    pGroup.add(bulb);
    pGroup.position.set(side, 0, lz);
    root.add(pGroup);
  });

  // ---------------------------------------------------------------------------
  // 2. SPAWN STAGE: PLAYER'S VIETNAMESE TUBE HOUSE + FOLDING IRON GATE ("CỬA SẮT KÉO") + BOLLARD
  // ---------------------------------------------------------------------------
  const spawnHouseGroup = new THREE.Group();
  spawnHouseGroup.position.set(0, 0, START_Z + 3.2);

  const mainHouseBody = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 8.2, 3.8),
    new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.85 })
  );
  mainHouseBody.position.set(0, 4.1, 1.9);
  spawnHouseGroup.add(mainHouseBody);

  // Warm interior doorway behind the iron gate
  const doorwayInterior = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 3.0, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xfef3c7 })
  );
  doorwayInterior.position.set(0, 1.5, -0.02);
  spawnHouseGroup.add(doorwayInterior);

  // House Number Sign ("HẺM 1 • NHÀ BẠN • CỬA SẮT KÉO")
  const houseSignTex = createBannerTexture(
    '🏠 NHÀ ỐNG HẺM 1 (CÁCH QUÁN 250M)',
    'CỬA SẮT KÉO • SÂN TRƯỚC DỰNG CHIẾN CƠ',
    '#0f172a',
    '#38bdf8'
  );
  const houseSign = new THREE.Mesh(
    new THREE.BoxGeometry(4.0, 0.9, 0.12),
    new THREE.MeshBasicMaterial({ map: houseSignTex })
  );
  houseSign.position.set(0, 3.65, -0.1);
  spawnHouseGroup.add(houseSign);

  // Folding Accordion Iron Gate ("Cửa sắt kéo xanh ngọc đặc trưng")
  const ironGateGroup = new THREE.Group();
  const gateBarMat = new THREE.MeshStandardMaterial({
    color: 0x0d9488,
    metalness: 0.7,
    roughness: 0.3,
  });
  for (let b = 0; b < 9; b++) {
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 2.9, 0.055), gateBarMat);
    vBar.position.set(-1.6 + b * 0.21, 1.45, 0);
    ironGateGroup.add(vBar);
    if (b < 8) {
      const diag1 = new THREE.Mesh(new THREE.BoxGeometry(0.038, 1.35, 0.038), gateBarMat);
      diag1.position.set(-1.5 + b * 0.21, 1.45, 0);
      diag1.rotation.z = 0.45;
      ironGateGroup.add(diag1);
    }
  }
  ironGateGroup.position.set(-0.85, 0, -0.15);
  spawnHouseGroup.add(ironGateGroup);

  // Sidewalk Bollard ("Cột mốc vỉa hè đỏ trắng")
  const bollardGroup = new THREE.Group();
  const bollardBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.19, 0.92, 14),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 })
  );
  bollardBase.position.y = 0.46;
  bollardGroup.add(bollardBase);
  const bollardStripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.165, 0.26, 14),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
  );
  bollardStripe.position.y = 0.52;
  bollardGroup.add(bollardStripe);
  bollardGroup.position.set(2.15, 0, -2.1);
  spawnHouseGroup.add(bollardGroup);

  root.add(spawnHouseGroup);

  // ---------------------------------------------------------------------------
  // 3. 3D ALLEY OBSTACLES & DESTINATION PUB PARKING LANDMARKS
  // ---------------------------------------------------------------------------
  // Obstacle 1: Fried Fishball Cart ("Xe Cá Viên Chiên 3D") at 35% of route (Z = 22.8)
  const fishballCartGroup = new THREE.Group();
  const cartBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 1.05, 0.85),
    new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.65, roughness: 0.3 })
  );
  cartBody.position.y = 0.72;
  fishballCartGroup.add(cartBody);
  const cartGlass = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.6, 0.78),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.55 })
  );
  cartGlass.position.y = 1.48;
  fishballCartGroup.add(cartGlass);
  const cartUmbrella = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 0.6, 12),
    new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.6 })
  );
  cartUmbrella.position.y = 2.15;
  fishballCartGroup.add(cartUmbrella);
  const cartSignTex = createBannerTexture(
    '🍡 XE CÁ VIÊN CHIÊN',
    'NÉ TRÁI/PHẢI (A/D) HOẶC BÓP CÒI (SPACE)!',
    '#b91c1c',
    '#fef08a'
  );
  const cartSign = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.38, 0.06),
    new THREE.MeshBasicMaterial({ map: cartSignTex })
  );
  cartSign.position.set(0, 0.95, 0.45);
  fishballCartGroup.add(cartSign);
  fishballCartGroup.position.set(-0.95, 0, 22.8);
  root.add(fishballCartGroup);

  // Obstacle 2: Sleeping Street Dog ("Chó Cỏ Nằm Ngủ Giữa Đường 3D") at 62% of route (Z = 15.6)
  const sleepingDogGroup = new THREE.Group();
  const dogFurMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 });
  const dogBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.44, 8, 12), dogFurMat);
  dogBody.rotation.z = Math.PI / 2;
  dogBody.position.y = 0.22;
  sleepingDogGroup.add(dogBody);
  const dogHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), dogFurMat);
  dogHead.position.set(0.28, 0.3, 0);
  sleepingDogGroup.add(dogHead);
  sleepingDogGroup.position.set(0.75, 0, 15.6);
  root.add(sleepingDogGroup);

  // Destination Pub Signboard ("Biển Hiệu Quán Nhậu 3D") & White Chalk Parking Box ("Vạch Vôi Trắng Bảo Vệ") at END_Z = 5.8
  const pubArrivalGroup = new THREE.Group();
  pubArrivalGroup.position.set(0, 0, END_Z);

  // White Chalk Parking Box on the asphalt right in front of the pub curb
  const chalkOuter = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.03, 3.2),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  chalkOuter.position.set(0, 0.032, 0.8);
  pubArrivalGroup.add(chalkOuter);
  const chalkInner = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.035, 2.9),
    new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.8 })
  );
  chalkInner.position.set(0, 0.036, 0.8);
  pubArrivalGroup.add(chalkInner);

  // Standing Pub Neon Signboard ("BIỂN HIỆU QUÁN NHẬU — TÔNG ĐỔ PHẠT 50K!")
  const pubSignboardPivot = new THREE.Group();
  pubSignboardPivot.position.set(1.55, 0, -0.4);
  const signLegL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), poleMat);
  signLegL.position.set(-0.75, 0.75, 0);
  pubSignboardPivot.add(signLegL);
  const signLegR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), poleMat);
  signLegR.position.set(0.75, 0.75, 0);
  pubSignboardPivot.add(signLegR);
  const pubBoardTex = createBannerTexture(
    '🍻 BÃI ĐỖ XE QUÁN NHẬU (VẠCH VÔI TRẮNG)',
    'PHANH (S) VỀ 0 KM/H TRONG Ô • TÔNG BIỂN PHẠT 50K!',
    '#7c2d12',
    '#fde047'
  );
  const pubBoardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.72, 0.1),
    new THREE.MeshBasicMaterial({ map: pubBoardTex })
  );
  pubBoardMesh.position.set(0, 1.25, 0);
  pubSignboardPivot.add(pubBoardMesh);
  pubArrivalGroup.add(pubSignboardPivot);
  root.add(pubArrivalGroup);

  // ---------------------------------------------------------------------------
  // 4. 3D TRAFFIC POLICE CHECKPOINT AT 20M BEFORE HOME ("CHỐT CSGT 20M") + TOW TRUCK
  // ---------------------------------------------------------------------------
  const policeCheckpointGroup = new THREE.Group();
  policeCheckpointGroup.position.set(0, 0, START_Z - 4.2);
  policeCheckpointGroup.visible = false;

  // Traffic Cones across the lane
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
  [-2.0, -1.0, 1.0, 2.0].forEach((cx) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.68, 12), coneMat);
    cone.position.set(cx, 0.34, 0);
    policeCheckpointGroup.add(cone);
  });

  // 3D Traffic Police Officer ("Đồng chí CSGT Áo Vàng Cầm Gậy & Máy Đo Nồng Độ Cồn")
  const officerGroup = new THREE.Group();
  const uniformMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
  const officerTorso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.52, 8, 12), uniformMat);
  officerTorso.position.y = 0.72;
  officerGroup.add(officerTorso);
  const officerHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 })
  );
  officerHead.position.y = 1.28;
  officerGroup.add(officerHead);
  const officerHelmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
    uniformMat
  );
  officerHelmet.position.y = 1.32;
  officerGroup.add(officerHelmet);
  const baton = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.52, 8),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  baton.position.set(0.34, 1.02, 0.22);
  baton.rotation.x = Math.PI / 4;
  officerGroup.add(baton);
  officerGroup.position.set(0, 0, -0.4);
  policeCheckpointGroup.add(officerGroup);

  // 3D Police Tow Truck ("Xe Thùng CSGT Chuyên Dụng Cẩu Xe")
  const towTruckGroup = new THREE.Group();
  const truckCab = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 1.75, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.4, roughness: 0.35 })
  );
  truckCab.position.set(0, 1.08, -1.6);
  towTruckGroup.add(truckCab);
  const truckBed = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.32, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.5 })
  );
  truckBed.position.set(0, 0.52, 0.8);
  towTruckGroup.add(truckBed);
  const redBeacon = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.16, 0.2),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  redBeacon.position.set(-0.38, 2.02, -1.6);
  towTruckGroup.add(redBeacon);
  const blueBeacon = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.16, 0.2),
    new THREE.MeshBasicMaterial({ color: 0x3b82f6 })
  );
  blueBeacon.position.set(0.38, 2.02, -1.6);
  towTruckGroup.add(blueBeacon);

  const checkpointBannerTex = createBannerTexture(
    '🚨 CHỐT ĐO NỒNG ĐỘ CỒN CSGT (CÁCH NHÀ 20M)',
    'THỔI VÀO ỐNG ĐO • KỊCH KIM > 0.4 MG/L LÀ LÊN XE THÙNG!',
    '#7f1d1d',
    '#fef08a'
  );
  const checkpointBanner = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.8, 0.1),
    new THREE.MeshBasicMaterial({ map: checkpointBannerTex })
  );
  checkpointBanner.position.set(0, 2.45, -0.4);
  policeCheckpointGroup.add(checkpointBanner);

  towTruckGroup.position.set(2.05, 0, 1.0);
  policeCheckpointGroup.add(towTruckGroup);
  root.add(policeCheckpointGroup);

  // ---------------------------------------------------------------------------
  // 5. HERO 3D MOTORBIKE + FULL 3D FIRST-PERSON HANDLEBAR COCKPIT ("BÀN THỜ XE MÁY 3D")
  // ---------------------------------------------------------------------------
  const playerBikeRoot = new THREE.Group();
  playerBikeRoot.position.set(0, 0, START_Z);
  root.add(playerBikeRoot);

  const bikeBodyMat = new THREE.MeshStandardMaterial({
    color: BIKE_SKIN_COLORS.dream_chien.body,
    metalness: 0.45,
    roughness: 0.28,
  });
  const bikeTrimMat = new THREE.MeshStandardMaterial({
    color: BIKE_SKIN_COLORS.dream_chien.trim,
    roughness: 0.35,
  });
  const bikeExhaustMat = new THREE.MeshStandardMaterial({
    color: BIKE_SKIN_COLORS.dream_chien.exhaust,
    metalness: 0.85,
    roughness: 0.18,
  });
  const bikeSeatMat = new THREE.MeshStandardMaterial({
    color: BIKE_SKIN_COLORS.dream_chien.seat,
    roughness: 0.75,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe4e4e7,
    metalness: 0.9,
    roughness: 0.15,
  });
  const darkRubberMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
  });
  const pawMat = new THREE.MeshStandardMaterial({
    color: AVATAR_PAW_COLORS.dog,
    roughness: 0.55,
  });

  // 5A. Lower 3D Chassis, Wheels, Exhaust Pipe & Kickstand
  const chassisGroup = new THREE.Group();
  const mainFrame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 1.35), bikeBodyMat);
  mainFrame.position.set(0, 0.48, 0.05);
  chassisGroup.add(mainFrame);

  const legShield = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.65, 0.14), bikeTrimMat);
  legShield.position.set(0, 0.56, -0.42);
  legShield.rotation.x = -0.18;
  chassisGroup.add(legShield);

  const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.82), bikeSeatMat);
  seatMesh.position.set(0, 0.74, 0.26);
  chassisGroup.add(seatMesh);

  const exhaustPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.045, 0.95, 12),
    bikeExhaustMat
  );
  exhaustPipe.rotation.x = Math.PI / 2 - 0.12;
  exhaustPipe.position.set(0.24, 0.32, 0.25);
  chassisGroup.add(exhaustPipe);

  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const frontWheel = new THREE.Mesh(wheelGeo, darkRubberMat);
  frontWheel.position.set(0, 0.28, -0.62);
  chassisGroup.add(frontWheel);
  const rearWheel = new THREE.Mesh(wheelGeo, darkRubberMat);
  rearWheel.position.set(0, 0.28, 0.62);
  chassisGroup.add(rearWheel);

  // 3D Kickstand ("Chân chống nghiêng F") + Spark Emitter
  const kickstandPivot = new THREE.Group();
  kickstandPivot.position.set(-0.2, 0.28, 0.08);
  const kickstandBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 8), chromeMat);
  kickstandBar.position.set(-0.06, -0.14, 0);
  kickstandBar.rotation.z = -0.38;
  kickstandPivot.add(kickstandBar);
  chassisGroup.add(kickstandPivot);

  const sparkMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 1),
    new THREE.MeshBasicMaterial({ color: 0xf97316 })
  );
  sparkMesh.position.set(-0.32, 0.06, 0.1);
  sparkMesh.visible = false;
  chassisGroup.add(sparkMesh);

  // Exhaust White Smoke Puff ("Khói trắng pô xe Khặc khặc... Bành bành!")
  const smokePuffMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xe4e4e7, transparent: true, opacity: 0.65 })
  );
  smokePuffMesh.position.set(0.26, 0.36, 0.85);
  smokePuffMesh.visible = false;
  chassisGroup.add(smokePuffMesh);

  playerBikeRoot.add(chassisGroup);

  // 5B. 3D FIRST-PERSON HANDLEBAR COCKPIT ("BÀN THỜ XE MÁY 3D + GƯƠNG CHIẾU HẬU + 2 BÀN TAY THÚ BÔNG")
  const steeringHeadGroup = new THREE.Group();
  steeringHeadGroup.position.set(0, 1.06, -0.38);
  playerBikeRoot.add(steeringHeadGroup);

  // Center Headlight Cowling & Dashboard ("Bàn thờ xe máy")
  const cowling = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.3), bikeBodyMat);
  cowling.position.set(0, 0.02, 0);
  cowling.rotation.x = 0.45;
  steeringHeadGroup.add(cowling);

  // 3D Speedometer Bezel & Upright Dial Face ("Đồng hồ công-tơ-mét 3D")
  const dialBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.132, 0.132, 0.028, 28),
    chromeMat
  );
  dialBezel.rotation.x = Math.PI / 2 - 0.45;
  dialBezel.position.set(-0.04, 0.145, 0.035);
  steeringHeadGroup.add(dialBezel);

  const dialTexture = createDialCanvasTexture();
  const dialFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.122, 32),
    new THREE.MeshBasicMaterial({ map: dialTexture })
  );
  dialFace.rotation.x = -0.45;
  dialFace.position.set(-0.04, 0.152, 0.049);
  steeringHeadGroup.add(dialFace);

  // Rotating 3D Speedometer Needle ("Kim đồng hồ tốc độ vọt lên")
  const needlePivot = new THREE.Group();
  needlePivot.position.set(-0.04, 0.152, 0.054);
  needlePivot.rotation.x = -0.45;
  const needleMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.088, 0.012),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  needleMesh.position.y = 0.038;
  needlePivot.add(needleMesh);
  steeringHeadGroup.add(needlePivot);

  // 3D Indicator Bulbs ("Đèn báo N, đèn xi-nhan")
  const indicatorBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x22c55e })
  );
  indicatorBulb.position.set(0.13, 0.125, 0.035);
  steeringHeadGroup.add(indicatorBulb);

  const turnSignalLeftBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b })
  );
  turnSignalLeftBulb.position.set(-0.21, 0.115, 0.035);
  steeringHeadGroup.add(turnSignalLeftBulb);

  const turnSignalRightBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b })
  );
  turnSignalRightBulb.position.set(0.21, 0.115, 0.035);
  steeringHeadGroup.add(turnSignalRightBulb);

  // Left & Right Handlebar Tubes + Grips
  const leftBar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.4, 10), chromeMat);
  leftBar.rotation.z = Math.PI / 2 - 0.12;
  leftBar.position.set(-0.36, 0.03, 0.06);
  steeringHeadGroup.add(leftBar);

  const rightBar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.4, 10), chromeMat);
  rightBar.rotation.z = -(Math.PI / 2 - 0.12);
  rightBar.position.set(0.36, 0.03, 0.06);
  steeringHeadGroup.add(rightBar);

  const leftGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.18, 12), darkRubberMat);
  leftGrip.rotation.z = Math.PI / 2 - 0.12;
  leftGrip.position.set(-0.46, 0.01, 0.07);
  steeringHeadGroup.add(leftGrip);

  // Right Throttle Grip Pivot (rotates when holding W!)
  const rightThrottlePivot = new THREE.Group();
  rightThrottlePivot.position.set(0.46, 0.01, 0.07);
  const rightGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.18, 12), darkRubberMat);
  rightGrip.rotation.z = -(Math.PI / 2 - 0.12);
  rightThrottlePivot.add(rightGrip);

  // Right Plush Animal Hand gripping the throttle ("Bàn tay thú bông phải vặn ga")
  const rightPaw = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 12), pawMat);
  rightPaw.scale.set(1.18, 0.85, 1.25);
  rightPaw.position.set(0, 0.02, 0.045);
  rightThrottlePivot.add(rightPaw);
  const rightArmSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.05, 0.26, 10),
    pawMat
  );
  rightArmSleeve.rotation.x = Math.PI / 2.3;
  rightArmSleeve.rotation.z = -0.22;
  rightArmSleeve.position.set(0.04, -0.04, 0.18);
  rightThrottlePivot.add(rightArmSleeve);
  steeringHeadGroup.add(rightThrottlePivot);

  // Left Plush Animal Hand gripping the left bar ("Bàn tay thú bông trái")
  const leftHandGroup = new THREE.Group();
  leftHandGroup.position.set(-0.46, 0.01, 0.07);
  const leftPaw = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 12), pawMat);
  leftPaw.scale.set(1.18, 0.85, 1.25);
  leftPaw.position.set(0, 0.02, 0.045);
  leftHandGroup.add(leftPaw);
  const leftArmSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.05, 0.26, 10),
    pawMat
  );
  leftArmSleeve.rotation.x = Math.PI / 2.3;
  leftArmSleeve.rotation.z = 0.22;
  leftArmSleeve.position.set(-0.04, -0.04, 0.18);
  leftHandGroup.add(leftArmSleeve);
  steeringHeadGroup.add(leftHandGroup);

  // Left & Right Vibrating 3D Rearview Mirrors ("Hai gương chiếu hậu rung bần bật")
  const createMirrorAssembly = (side: -1 | 1) => {
    const mGroup = new THREE.Group();
    mGroup.position.set(side * 0.3, 0.07, 0.03);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8), chromeMat);
    stem.position.set(side * 0.07, 0.11, -0.02);
    stem.rotation.z = -side * 0.42;
    mGroup.add(stem);

    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.105, 0.032),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 })
    );
    housing.position.set(side * 0.15, 0.21, -0.03);
    housing.rotation.y = -side * 0.28;
    mGroup.add(housing);

    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.09, 0.01),
      new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        metalness: 0.95,
        roughness: 0.08,
        emissive: 0x1e3a8a,
        emissiveIntensity: 0.45,
      })
    );
    glass.position.set(side * 0.15, 0.21, -0.012);
    glass.rotation.y = -side * 0.28;
    mGroup.add(glass);
    return mGroup;
  };
  const leftMirror = createMirrorAssembly(-1);
  const rightMirror = createMirrorAssembly(1);
  steeringHeadGroup.add(leftMirror);
  steeringHeadGroup.add(rightMirror);

  // 3D Headlight Beam Cone ("Chùm đèn pha chiếu sáng hẻm đêm")
  const headlightCone = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 7.5, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  headlightCone.rotation.x = Math.PI / 2 - 0.12;
  headlightCone.position.set(0, -0.25, -3.9);
  steeringHeadGroup.add(headlightCone);

  const headlightPoint = new THREE.PointLight(0xfef08a, 6, 14, 1.8);
  headlightPoint.position.set(0, 0.1, -1.2);
  steeringHeadGroup.add(headlightPoint);

  // ---------------------------------------------------------------------------
  // 6. 3D RIDER & NPC GRAB DRIVER ("TÀI XẾ ÁO XANH + DÂY NỊT RAGDOLL LÚC VỀ")
  // ---------------------------------------------------------------------------
  const grabDriverGroup = new THREE.Group();
  const grabJacketMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.5 });
  const grabTorso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.38, 8, 12), grabJacketMat);
  grabTorso.position.set(0, 0.98, -0.02);
  grabTorso.rotation.x = 0.22;
  grabDriverGroup.add(grabTorso);
  const grabHelmet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), grabJacketMat);
  grabHelmet.position.set(0, 1.34, -0.08);
  grabDriverGroup.add(grabHelmet);
  grabDriverGroup.visible = false;
  playerBikeRoot.add(grabDriverGroup);

  // Pillion Passenger / Ragdoll Player Character on the back seat (or standing in front of house gate)
  const passengerGroup = new THREE.Group();
  const passengerTorso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.19, 0.38, 8, 12),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 })
  );
  passengerTorso.position.y = 0.38;
  passengerGroup.add(passengerTorso);
  const passengerHead = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 14), pawMat);
  passengerHead.position.y = 0.78;
  passengerGroup.add(passengerHead);
  const halfHelmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.225, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 })
  );
  halfHelmet.position.y = 0.81;
  passengerGroup.add(halfHelmet);

  // Safety Belt ("Dây nịt cột ngang bụng giữ Ragdoll không rớt xuống đường")
  const safetyBeltMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.04, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
  );
  safetyBeltMesh.rotation.x = Math.PI / 2;
  safetyBeltMesh.position.set(0, 0.35, -0.18);
  safetyBeltMesh.visible = false;
  passengerGroup.add(safetyBeltMesh);

  playerBikeRoot.add(passengerGroup);

  // Rival Friend Bike riding parallel in the alley
  const rivalBikeGroup = new THREE.Group();
  const rivalBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.4, 1.25),
    new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.4 })
  );
  rivalBody.position.y = 0.45;
  rivalBikeGroup.add(rivalBody);
  const rivalRider = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.17, 0.36, 8, 10),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 })
  );
  rivalRider.position.set(0, 0.92, 0);
  rivalBikeGroup.add(rivalRider);
  const rivalHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6 })
  );
  rivalHead.position.set(0, 1.26, 0);
  rivalBikeGroup.add(rivalHead);
  root.add(rivalBikeGroup);

  let lastSkin: BikeSkinId = 'dream_chien';
  let lastAvatar: AvatarType = 'dog';

  return {
    root,
    update: (time, delta, state, camera, camTargetPos, camLookAt) => {
      root.visible = state.active;
      if (!state.active) return false;

      if (state.bikeSkin !== lastSkin) {
        lastSkin = state.bikeSkin;
        const c = BIKE_SKIN_COLORS[state.bikeSkin];
        bikeBodyMat.color.setHex(c.body);
        bikeTrimMat.color.setHex(c.trim);
        bikeExhaustMat.color.setHex(c.exhaust);
        bikeSeatMat.color.setHex(c.seat);
      }
      if (state.userAvatar !== lastAvatar) {
        lastAvatar = state.userAvatar;
        pawMat.color.setHex(AVATAR_PAW_COLORS[state.userAvatar] ?? 0xf59e0b);
      }

      const progress = THREE.MathUtils.clamp(
        state.distanceTraveledM / Math.max(1, state.targetDistanceM),
        0,
        1
      );
      const isReturn =
        state.stage === 'return_parking_decision' ||
        state.stage === 'return_drunk_fpp_drive' ||
        state.stage === 'return_grab_vip' ||
        state.stage === 'checkpoint_20m_breathalyzer_qte' ||
        state.stage === 'impound_cutscene_summary';

      // Outbound drives from START_Z (32.0) -> END_Z + 0.8 (6.6), facing -Z (toward pub at Z=0)
      // Return drives from END_Z (5.8) -> START_Z - 5.2 (26.8), facing +Z (toward house at Z=32)
      const currentZ = isReturn
        ? THREE.MathUtils.lerp(END_Z, START_Z - 5.2, progress)
        : THREE.MathUtils.lerp(START_Z, END_Z + 0.8, progress);
      const laneX = THREE.MathUtils.clamp(state.lateralOffset * 2.2, -2.3, 2.3);

      ironGateGroup.position.x = THREE.MathUtils.damp(
        ironGateGroup.position.x,
        state.stage === 'spawn_house_decision' ? -1.45 : -2.2,
        4,
        delta
      );

      const targetDogX = state.isHornPressed ? 2.6 : 0.75;
      sleepingDogGroup.position.x = THREE.MathUtils.damp(
        sleepingDogGroup.position.x,
        targetDogX,
        8,
        delta
      );

      pubSignboardPivot.rotation.x = THREE.MathUtils.damp(
        pubSignboardPivot.rotation.x,
        state.isSignboardHit ? -1.42 : 0,
        8,
        delta
      );

      policeCheckpointGroup.visible = isReturn;
      if (isReturn) {
        const flash = Math.sin(time * 16) > 0;
        (redBeacon.material as THREE.MeshBasicMaterial).color.setHex(
          flash ? 0xff0000 : 0x450a0a
        );
        (blueBeacon.material as THREE.MeshBasicMaterial).color.setHex(
          !flash ? 0x3b82f6 : 0x172554
        );
        officerGroup.rotation.y = Math.PI + Math.sin(time * 3) * 0.15;
      }

      playerBikeRoot.position.set(laneX, 0, currentZ);
      const baseYaw = isReturn ? Math.PI : 0;
      const steerYaw = -state.steerInput * 0.16 * (isReturn ? -1 : 1);
      playerBikeRoot.rotation.y = baseYaw + steerYaw;

      const targetLeanZ = state.isWipedOut
        ? 1.28
        : state.stage === 'spawn_house_decision' && state.isKickstandDown
        ? 0.12
        : -state.steerInput * (0.2 + (state.speedKmh / 65) * 0.24);
      playerBikeRoot.rotation.z = THREE.MathUtils.damp(
        playerBikeRoot.rotation.z,
        targetLeanZ,
        10,
        delta
      );

      kickstandPivot.rotation.x = THREE.MathUtils.damp(
        kickstandPivot.rotation.x,
        state.isKickstandDown ? 0 : -1.35,
        12,
        delta
      );
      sparkMesh.visible =
        state.isKickstandDown && Math.abs(state.steerInput) > 0.25 && state.speedKmh > 8;
      if (sparkMesh.visible) {
        sparkMesh.scale.setScalar(0.8 + Math.random() * 0.9);
      }

      smokePuffMesh.visible = state.isEngineRunning || state.kickstartCount > 0;
      if (smokePuffMesh.visible) {
        const s = 0.6 + ((time * 4) % 1) * 1.1;
        smokePuffMesh.scale.setScalar(s);
        smokePuffMesh.position.z = 0.78 + ((time * 4) % 1) * 0.55;
      }

      const wheelSpin = (state.speedKmh / 3.6) * delta * 2.2;
      frontWheel.rotation.x -= wheelSpin;
      rearWheel.rotation.x -= wheelSpin;

      const speedRatio = THREE.MathUtils.clamp(state.speedKmh / 80, 0, 1);
      needlePivot.rotation.z = THREE.MathUtils.lerp(2.1, -2.1, speedRatio);

      steeringHeadGroup.rotation.y = THREE.MathUtils.damp(
        steeringHeadGroup.rotation.y,
        -state.steerInput * 0.26,
        12,
        delta
      );

      rightThrottlePivot.rotation.x = THREE.MathUtils.damp(
        rightThrottlePivot.rotation.x,
        state.isHoldingThrottle ? 0.54 : 0,
        14,
        delta
      );

      const vibAmp = state.isEngineRunning
        ? 0.012 + (state.speedKmh / 65) * 0.028
        : 0.002;
      const vib = Math.sin(time * 52) * vibAmp;
      leftMirror.rotation.z = vib;
      rightMirror.rotation.z = -vib;
      steeringHeadGroup.position.y = 1.06 + Math.cos(time * 45) * (vibAmp * 0.35);

      (indicatorBulb.material as THREE.MeshBasicMaterial).color.setHex(
        state.isEngineRunning ? 0x22c55e : 0xef4444
      );
      const blinkOn = Math.sin(time * 12) > 0;
      (turnSignalLeftBulb.material as THREE.MeshBasicMaterial).color.setHex(
        state.steerInput < -0.15 && blinkOn ? 0xfacc15 : 0x3f3f46
      );
      (turnSignalRightBulb.material as THREE.MeshBasicMaterial).color.setHex(
        state.steerInput > 0.15 && blinkOn ? 0xfacc15 : 0x3f3f46
      );

      rivalBikeGroup.position.set(
        1.45 + Math.sin(time * 1.7) * 0.3,
        0,
        currentZ - (isReturn ? -2.8 : 2.8)
      );
      rivalBikeGroup.rotation.y = baseYaw;

      // -------------------------------------------------------------------------
      // STAGE-SPECIFIC 3D CHARACTER & CAMERA CHOREOGRAPHY
      // -------------------------------------------------------------------------
      const worldBikeX = playerBikeRoot.position.x;
      const worldBikeZ = playerBikeRoot.position.z;

      if (state.stage === 'spawn_house_decision') {
        grabDriverGroup.visible = false;
        passengerGroup.visible = true;
        safetyBeltMesh.visible = false;
        passengerGroup.position.set(-0.85, 0, 0.35);
        passengerGroup.rotation.set(0, Math.PI * 0.15, 0);

        // Frame the Tube House Iron Gate + Parked Motorbike + Sidewalk Bollard
        camTargetPos.set(
          1.75 + Math.sin(time * 0.5) * 0.22,
          1.68,
          START_Z - 3.3
        );
        camLookAt.set(-0.15, 1.12, START_Z + 0.9);
        camera.fov = THREE.MathUtils.damp(camera.fov, 50, 6, delta);
        camera.updateProjectionMatrix();
        return true;
      }

      if (state.stage === 'return_parking_decision') {
        grabDriverGroup.visible = false;
        passengerGroup.visible = true;
        safetyBeltMesh.visible = false;
        passengerGroup.position.set(-0.75, 0, -0.2);
        passengerGroup.rotation.set(0, Math.PI, Math.sin(time * 3.5) * 0.18);

        camTargetPos.set(
          1.55 + Math.sin(time * 1.8) * 0.32,
          1.65,
          END_Z + 3.2
        );
        camLookAt.set(0, 0.95, END_Z);
        camera.fov = THREE.MathUtils.damp(camera.fov, 54, 6, delta);
        camera.updateProjectionMatrix();
        return true;
      }

      if (
        state.stage === 'outbound_grab_vip' ||
        state.stage === 'return_grab_vip'
      ) {
        grabDriverGroup.visible = true;
        passengerGroup.visible = true;
        passengerGroup.position.set(0, 0.52, 0.38);
        const isRagdollReturn = state.stage === 'return_grab_vip';
        safetyBeltMesh.visible = isRagdollReturn;
        passengerGroup.rotation.set(
          isRagdollReturn ? -0.28 + Math.sin(time * 4.2) * 0.15 : 0,
          0,
          isRagdollReturn ? Math.sin(time * 3.6) * 0.38 : 0
        );

        if (state.stage === 'outbound_grab_vip' && state.grabWaitTimer > 0) {
          playerBikeRoot.position.z = START_Z - state.grabWaitTimer * 2.5;
        }

        const forwardSign = isReturn ? 1 : -1;
        const yawRad = THREE.MathUtils.degToRad(state.grabCameraAngleDeg);
        if (state.cameraViewMode === 'fpp') {
          camTargetPos.set(
            worldBikeX + Math.sin(yawRad) * 0.18,
            1.42 + (isRagdollReturn ? Math.sin(time * 3.6) * 0.08 : 0),
            worldBikeZ - forwardSign * 0.36
          );
          camLookAt.set(
            worldBikeX + Math.sin(yawRad) * 6.0,
            1.18,
            worldBikeZ + forwardSign * Math.cos(yawRad) * 6.0
          );
          camera.fov = THREE.MathUtils.damp(camera.fov, 60, 8, delta);
        } else {
          const orbitR = 3.1;
          camTargetPos.set(
            worldBikeX + Math.sin(yawRad) * orbitR,
            1.82,
            worldBikeZ - forwardSign * Math.cos(yawRad) * orbitR
          );
          camLookAt.set(worldBikeX, 1.05, worldBikeZ + forwardSign * 0.8);
          camera.fov = THREE.MathUtils.damp(camera.fov, 52, 8, delta);
        }
        camera.updateProjectionMatrix();
        return true;
      }

      if (state.stage === 'checkpoint_20m_breathalyzer_qte') {
        grabDriverGroup.visible = false;
        passengerGroup.visible = false;
        playerBikeRoot.position.set(0, 0, START_Z - 5.4);
        playerBikeRoot.rotation.set(0, Math.PI, 0);

        const sway = Math.sin(time * 2.8) * 0.14;
        camTargetPos.set(sway, 1.38, START_Z - 5.55);
        camLookAt.set(sway * 0.4, 1.22, START_Z - 4.2);
        camera.fov = THREE.MathUtils.damp(camera.fov, 48, 8, delta);
        camera.updateProjectionMatrix();
        return true;
      }

      if (state.stage === 'impound_cutscene_summary') {
        grabDriverGroup.visible = false;
        passengerGroup.visible = true;
        safetyBeltMesh.visible = false;
        playerBikeRoot.position.set(2.05, 0.68, START_Z - 3.4);
        playerBikeRoot.rotation.set(0, Math.PI, 0.08);
        passengerGroup.position.set(-2.2, -0.68, Math.sin(time * 2) * 0.5);
        passengerGroup.rotation.set(0.15, 0, Math.sin(time * 5) * 0.12);

        camTargetPos.set(
          -1.6 + Math.sin(time * 0.6) * 0.35,
          1.82,
          START_Z - 6.8
        );
        camLookAt.set(1.0, 1.12, START_Z - 3.4);
        camera.fov = THREE.MathUtils.damp(camera.fov, 50, 6, delta);
        camera.updateProjectionMatrix();
        return true;
      }

      // -------------------------------------------------------------------------
      // FPP / TPP ACTIVE MOTORBIKE DRIVING (`outbound_fpp_drive` & `return_drunk_fpp_drive`)
      // -------------------------------------------------------------------------
      grabDriverGroup.visible = false;
      const forwardDir = isReturn ? 1 : -1;
      const drunkFactor =
        state.stage === 'return_drunk_fpp_drive'
          ? THREE.MathUtils.clamp((state.alcoholLevel - 40) / 60, 0.35, 1)
          : 0;
      const drunkSwayX =
        drunkFactor * (Math.sin(time * 2.4) * 0.32 + Math.cos(time * 3.9) * 0.18);
      const drunkSwayY = drunkFactor * Math.sin(time * 3.1) * 0.1;

      if (state.cameraViewMode === 'fpp') {
        passengerGroup.visible = false;

        // Place FPP camera inside the half-helmet at y = 1.29, z = worldBikeZ - forwardDir * 0.08
        // Looking slightly downward across the 3D speedometer, mirrors & plush paws toward the 3D alley ahead!
        const engineJitter = state.isEngineRunning
          ? Math.sin(time * 48) * 0.004
          : 0;
        camTargetPos.set(
          worldBikeX - state.steerInput * 0.06 + drunkSwayX * 0.2,
          1.29 + engineJitter + drunkSwayY * 0.2,
          worldBikeZ - forwardDir * 0.06
        );
        camLookAt.set(
          worldBikeX - state.steerInput * 1.2 * (isReturn ? -1 : 1) + drunkSwayX,
          0.88 + drunkSwayY,
          worldBikeZ + forwardDir * 4.2
        );
        const targetFov =
          62 +
          (state.speedKmh / 65) * 14 +
          drunkFactor * Math.sin(time * 2.6) * 8;
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 8, delta);
      } else {
        passengerGroup.visible = true;
        safetyBeltMesh.visible = false;
        passengerGroup.position.set(0, 0.48, 0.18);
        passengerGroup.rotation.set(0.25, 0, 0);

        camTargetPos.set(
          worldBikeX + drunkSwayX * 0.5,
          1.92 + drunkSwayY * 0.4,
          worldBikeZ - forwardDir * 2.75
        );
        camLookAt.set(
          worldBikeX,
          1.02,
          worldBikeZ + forwardDir * 3.4
        );
        camera.fov = THREE.MathUtils.damp(
          camera.fov,
          54 + (state.speedKmh / 65) * 10,
          8,
          delta
        );
      }
      camera.updateProjectionMatrix();
      return true;
    },
  };
}
