/**
 * "Quán Ốc Bờ Sông" (Dev Mode): a riverside snail bar on three.js WebGPURenderer.
 *
 * - Background: a Gaussian splat capture (three r186+ GaussianSplat, .spz/.ply/.splat/.ksplat),
 *   rendered in its own pass and composited behind the bar.
 * - Foreground: the embankment, river and far bank (riversideScenery.ts), the procedural
 *   bar props + VRM characters, rendered with an MRT pass and TSL post effects:
 *   SSGI (bounce light + AO) or GTAO, SSR (river reflections), bloom and TRAA.
 *
 * The main game still runs on WebGLRenderer; this scene is a self-contained preview.
 */
import * as THREE from 'three/webgpu';
import {
  colorToDirection,
  diffuseColor,
  directionToColor,
  exp,
  float,
  mix,
  metalness,
  mrt,
  normalView,
  output,
  pass,
  roughness,
  sample,
  uniform,
  vec3,
  vec4,
  velocity,
} from 'three/tsl';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GaussianSplat } from 'three/addons/objects/GaussianSplat.js';
import { SPZLoader } from 'three/addons/loaders/SPZLoader.js';
import { GaussianSplatPLYLoader } from 'three/addons/loaders/GaussianSplatPLYLoader.js';
import { SPLATLoader } from 'three/addons/loaders/SPLATLoader.js';
import { KSPLATLoader } from 'three/addons/loaders/KSPLATLoader.js';
import { MToonMaterialLoaderPlugin, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { MToonNodeMaterial } from '@pixiv/three-vrm/nodes';
import {
  createBeerTower,
  createFloorLitterAndBottles,
  createIceBucket,
  createPlasticStool,
  createStainlessTable,
} from './proceduralModels';
import { createRiversideScenery } from './riversideScenery';
import { createPlayerController, type Collider, type PlayerController, type Seat } from './playerController';
import { createFoodPlatter, createTableClutter } from './foodModels';
import { createShellBucket, mergeStatic } from './quanOcProps';
import type { VrmOutfit } from './vrmOutfit';
import { VRM_MOVE_SPEED, createVrmCharacter, fetchVrmBuffer, prepareVrm, type VrmCharacter } from './vrmCharacter';

export const SAMPLE_SPLAT_URL = '/assets/splats/sample-street.spz';

export interface NextGenEffects {
  traa: boolean;
  ssgi: boolean;
  /** GTAO, used when SSGI is off (SSGI already includes ambient occlusion). */
  gtao: boolean;
  ssr: boolean;
  bloom: boolean;
  splat: boolean;
  /** Sidewalk patch under the bar (hide it when the splat has its own ground). */
  floor: boolean;
}

export const DEFAULT_NEXTGEN_EFFECTS: NextGenEffects = {
  traa: true,
  ssgi: true,
  gtao: true,
  ssr: true,
  bloom: true,
  // The river scene fills the view; the splat is opt-in (it only shows in the sky).
  splat: false,
  floor: true,
};

export interface SplatTransform {
  x: number;
  y: number;
  z: number;
  /** Degrees around Y. */
  yaw: number;
  scale: number;
  /** Most captures are Y-down (COLMAP); flip them upright. */
  flip: boolean;
}

export const DEFAULT_SPLAT_TRANSFORM: SplatTransform = { x: 0, y: 1.2, z: -3, yaw: 0, scale: 1.6, flip: true };

export interface SplatInfo {
  count: number;
  /** Bounding box of the raw (untransformed) splat, in its own units. */
  min: [number, number, number];
  max: [number, number, number];
}

export interface NextGenBar {
  /** 'webgpu' or 'webgl2' (fallback: no compute, so splats are unavailable). */
  backend: string;
  setEffects: (effects: NextGenEffects) => void;
  loadSplat: (source: string | File) => Promise<SplatInfo>;
  setSplatTransform: (transform: SplatTransform) => void;
  /**
   * Splats are fill-rate heavy (many overlapping translucent quads): render them at
   * a fraction of the screen resolution. 1 = full resolution.
   */
  setSplatResolution: (scale: number) => void;
  /** A transform that puts the splat behind the bar with its floor at y = 0. */
  fitSplat: (current: SplatTransform) => SplatTransform | null;
  /**
   * Walk the seat-0 character around the map (WASD / arrows, Shift runs, E sits);
   * the camera follows it. Off: the character goes back to its stool.
   */
  setPlayMode: (enabled: boolean) => void;
  /** Control hints while playing ("Nhấn E để ngồi" …). */
  onPlayerStatus?: (status: string) => void;
  /**
   * Stop / restart rendering and the keyboard while another view (the ride) is on
   * screen. Characters and state stay as they are.
   */
  setPaused: (paused: boolean) => void;
  /** Just ridden in: play mode on, standing beside the bike in the parking lot. */
  arriveByBike: () => void;
  /** Which bike is parked in the player's bay. */
  setBike: (bikeId: string) => void;
  /** Fired when the player presses G beside their bike in the lot. */
  onRideHome?: () => void;
  onStats?: (fps: number) => void;
  dispose: () => void;
}

// Bar layout copied from the lobby (threeScene.ts).
const TABLE_RADIUS = 1.95;
const SEATS = 6;
const seatAngle = (index: number) => (index / SEATS) * Math.PI * 2 + Math.PI / 2;

function createWebGPUVrmLoader() {
  const loader = new GLTFLoader();
  loader.register(
    (parser) =>
      new VRMLoaderPlugin(parser, {
        mtoonMaterialPlugin: new MToonMaterialLoaderPlugin(parser, { materialType: MToonNodeMaterial }),
      })
  );
  return loader;
}

function splatLoaderFor(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.ply')) return new GaussianSplatPLYLoader();
  if (lower.endsWith('.ksplat')) return new KSPLATLoader();
  if (lower.endsWith('.splat')) return new SPLATLoader();
  return new SPZLoader();
}

/**
 * Bounds of the bulk of the splat (5th..95th percentile per axis). Outdoor captures
 * carry "sky" splats far away, and SPZ stores out-of-range ones saturated at
 * ±131072: both would swamp a plain bounding box.
 */
function robustBounds(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined) {
  const box = new THREE.Box3();
  if (!position || position.count === 0) return box;
  const step = Math.max(1, Math.floor(position.count / 20000));
  const axes: number[][] = [[], [], []];
  for (let i = 0; i < position.count; i += step) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (Math.abs(x) > 1e4 || Math.abs(y) > 1e4 || Math.abs(z) > 1e4) continue;
    axes[0].push(x);
    axes[1].push(y);
    axes[2].push(z);
  }
  if (axes[0].length === 0) return box;
  const low = new THREE.Vector3();
  const high = new THREE.Vector3();
  axes.forEach((values, axis) => {
    values.sort((a, b) => a - b);
    low.setComponent(axis, values[Math.floor(values.length * 0.05)]);
    high.setComponent(axis, values[Math.floor(values.length * 0.95)]);
  });
  return box.set(low, high);
}

function enableShadows(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

export async function createNextGenBar(container: HTMLElement): Promise<NextGenBar> {
  const renderer = new THREE.WebGPURenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The bar pass keeps a transparent background so the splat shows through.
  renderer.setClearColor(0x000000, 0);
  await renderer.init();
  container.appendChild(renderer.domElement);
  const backendName =
    (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';

  // ---- Bar scene ----
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.25;

  scene.add(new THREE.HemisphereLight(0x8fa3ff, 0x2a1d14, 0.35));
  // Warm bulb hanging over the table: the main light of a street bar at night.
  const bulb = new THREE.PointLight(0xffc27a, 14, 9, 2);
  bulb.position.set(0, 2.6, 0);
  bulb.castShadow = true;
  bulb.shadow.mapSize.set(2048, 2048);
  bulb.shadow.bias = -0.0005;
  bulb.shadow.radius = 4;
  scene.add(bulb);
  const bulbMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 6 })
  );
  bulbMesh.position.copy(bulb.position);
  scene.add(bulbMesh);
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.42, 6),
    new THREE.MeshBasicMaterial({ color: 0x111113 })
  );
  cord.position.set(0, 2.85, 0);
  scene.add(cord);

  const scenery = createRiversideScenery();
  const floor = scenery.ground;
  scene.add(floor, scenery.props);

  const table = createStainlessTable();
  scene.add(table);
  scene.add(mergeStatic(createTableClutter()));
  const bucketColliders: Collider[] = [];
  // The six dishes of the main game, at the same spots on the table (threeScene DISH_POSITIONS).
  const animatedDishes: THREE.Object3D[] = [];
  (
    [
      ['hotpot', -12, 0.86],
      ['peanut', 35, 0.92],
      ['xoai_non', 80, 0.92],
      ['oc_huong', 125, 0.92],
      ['ca_vien', -100, 0.92],
      ['chicken_feet', -56, 0.92],
    ] as const
  ).forEach(([type, degrees, radius]) => {
    const dish = createFoodPlatter(type);
    const angle = THREE.MathUtils.degToRad(degrees);
    dish.position.set(Math.cos(angle) * radius, 0.98, Math.sin(angle) * radius);
    if (dish.userData.update) {
      // Hotpot: bubbling broth. Its steam sprites don't blend in the MRT pass (they
      // show as grey discs), so they stay hidden here.
      dish.traverse((object) => {
        if ((object as THREE.Sprite).isSprite) object.visible = false;
      });
      animatedDishes.push(dish);
      scene.add(dish);
    } else {
      scene.add(mergeStatic(dish));
    }
  });
  // Shell buckets between the stools.
  [0.5, 2.5, 4.5].forEach((slot, i) => {
    const bucket = createShellBucket(i % 2 ? 0xdc2626 : 0x2563eb, 40 + i);
    const angle = seatAngle(slot);
    bucket.position.set(Math.cos(angle) * 1.9, 0, Math.sin(angle) * 1.9);
    scene.add(mergeStatic(bucket));
    bucketColliders.push({ kind: 'circle', x: bucket.position.x, z: bucket.position.z, r: 0.16 });
  });
  const tower = createBeerTower(0.9);
  tower.position.set(-0.6, 0.98, -0.3);
  tower.scale.setScalar(0.85);
  scene.add(tower);
  const bucket = createIceBucket();
  bucket.position.set(-0.42, 0.98, 0.06);
  bucket.scale.setScalar(0.88);
  scene.add(bucket);
  scene.add(createFloorLitterAndBottles());

  const stoolColors = [0xdc2626, 0x0284c7];
  for (let i = 0; i < SEATS; i++) {
    const stool = createPlasticStool(stoolColors[i % 2]);
    const angle = seatAngle(i);
    stool.position.set(Math.cos(angle) * TABLE_RADIUS, 0, Math.sin(angle) * TABLE_RADIUS);
    stool.rotation.y = -angle + Math.PI / 2;
    scene.add(stool);
  }
  enableShadows(scene);
  floor.traverse((object) => (object.castShadow = false));
  // The bulb's cube shadow re-draws every caster six times: only props within its
  // reach cast (the far tables, stall, lamps and trees just receive).
  scene.updateMatrixWorld(true);
  const casterCenter = new THREE.Vector3();
  scenery.props.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingSphere();
    casterCenter.copy(mesh.geometry.boundingSphere!.center).applyMatrix4(mesh.matrixWorld);
    mesh.castShadow = !(mesh as THREE.InstancedMesh).isInstancedMesh && casterCenter.distanceTo(bulb.position) < 5.5;
  });
  // Added after enableShadows: the river, far bank and sky neither cast nor receive.
  scene.add(scenery.backdrop);

  // ---- Characters (VRM with WebGPU MToon materials) ----
  const characters: VrmCharacter[] = [];
  // Walkable character: stools at the main table (0..5), then the neighbouring tables.
  const PLAYER_SEAT = 0;
  const seats: Seat[] = [
    ...Array.from({ length: SEATS }, (_, i) => {
      const angle = seatAngle(i);
      return { x: Math.cos(angle) * TABLE_RADIUS, z: Math.sin(angle) * TABLE_RADIUS, facing: -angle - Math.PI / 2 };
    }),
    ...scenery.seats,
  ];
  // Seats taken by the other customers (see PATRONS below).
  const occupiedSeats = new Set<number>();
  /** Which table a seat belongs to: 0 = main table, then one per neighbouring table. */
  const tableOf = (seat: number) => seats[seat].table ?? 0;
  /** Index of the k-th stool of a table (scenery seats carry their table id). */
  const seatAt = (table: number, k: number) => seats.flatMap((seat, i) => (seat.table === table ? [i] : []))[k];
  const house = scenery.house;
  const houseFront = house.interior.min.z + 0.2;
  const characterTable = new Map<VrmCharacter, number>();
  // Main table top is 1.6 m; a little less so the stools stay reachable.
  const colliders: Collider[] = [{ kind: 'circle', x: 0, z: 0, r: 1.5 }, ...bucketColliders, ...scenery.colliders];
  let player: PlayerController | null = null;
  let playerCharacter: VrmCharacter | null = null;
  let playRequested = false;
  let pendingArrival = false;
  const vrmLoader = createWebGPUVrmLoader();
  const seatCharacter = async (
    url: string,
    seat: number,
    alcohol: number,
    look: { height?: number; outfit?: VrmOutfit; mood?: VrmCharacter['state']['mood'] } = {}
  ) => {
    if (seat !== PLAYER_SEAT) occupiedSeats.add(seat);
    try {
      const gltf = await vrmLoader.parseAsync(await fetchVrmBuffer(url), '');
      const character = createVrmCharacter(
        prepareVrm(gltf as unknown as Parameters<typeof prepareVrm>[0]),
        { pose: 'seated', alcohol, mood: look.mood ?? 'neutral', cheers: false },
        { targetHeight: look.height ?? (seat === 0 ? 1.62 : 1.52), outfit: look.outfit }
      );
      character.root.position.set(seats[seat].x, 0, seats[seat].z);
      character.root.rotation.y = seats[seat].facing;
      enableShadows(character.root);
      // VRoid models are dozens of primitives: only the main table (inside the bulb's
      // shadow range) casts into the cube shadow map; everyone else just receives.
      if (seat >= SEATS) character.root.traverse((object) => (object.castShadow = false));
      scene.add(character.root);
      characters.push(character);
      characterTable.set(character, tableOf(seat));
      if (seat === PLAYER_SEAT) {
        playerCharacter = character;
        player = createPlayerController({
          character,
          colliders,
          seats,
          occupied: occupiedSeats,
          homeSeat: PLAYER_SEAT,
          bounds: scenery.bounds,
        });
        player.onStatus = (status) => api.onPlayerStatus?.(status);
        player.interactions.push({
          x: scenery.parking.bike.x,
          z: scenery.parking.bike.z,
          radius: 1.8,
          key: 'KeyG',
          label: '🛵 Nhấn G: lấy xe chạy về nhà',
          onTrigger: () => api.onRideHome?.(),
        });
        player.setEnabled(playRequested);
        if (pendingArrival) {
          pendingArrival = false;
          api.arriveByBike();
        }
      }
    } catch (error) {
      console.warn('[next-gen bar] character failed to load', url, error);
    }
  };
  const MALE = '/assets/characters/vrm/male_fumiriya.vrm';
  const FEMALE = '/assets/characters/vrm/female_pixiv.vrm';
  const outfit = (colors: VrmOutfit['colors'], accessories: VrmOutfit['accessories'] = []): VrmOutfit => ({
    colors,
    skinTone: null,
    accessories,
  });
  void seatCharacter(MALE, PLAYER_SEAT, 35);
  void seatCharacter(FEMALE, 2, 55);
  // Other customers, recoloured so the two base models read as different people.
  // Seats: 0..5 main table, then three per neighbouring table in NEIGHBOUR_TABLES order.
  const PATRONS: [string, number, number, Parameters<typeof seatCharacter>[3]][] = [
    [MALE, 4, 70, { height: 1.58, outfit: outfit({ top: '#f97316', bottom: '#1f2937' }, ['cap']), mood: 'happy' }],
    [MALE, 6, 85, { height: 1.66, outfit: outfit({ top: '#1d4ed8', hair: '#111111' }, ['scarf']), mood: 'happy' }],
    [FEMALE, 7, 30, { height: 1.5, outfit: outfit({ top: '#db2777', hair: '#3f2a1d' }, ['headband']), mood: 'relaxed' }],
    [MALE, 9, 50, { height: 1.6, outfit: outfit({ top: '#16a34a', hair: '#4b2e1a' }, ['sunglasses']) }],
    [FEMALE, 12, 65, { height: 1.54, outfit: outfit({ top: '#e5e7eb', hair: '#1c1917' }), mood: 'happy' }],
    [MALE, 13, 40, { height: 1.62, outfit: outfit({ top: '#7c3aed', bottom: '#334155' }, ['cap']) }],
    [MALE, 16, 95, { height: 1.64, outfit: outfit({ top: '#dc2626', hair: '#111111' }), mood: 'sad' }],
    [FEMALE, 19, 45, { height: 1.52, outfit: outfit({ top: '#0ea5e9', hair: '#5b3a24' }, ['headband']), mood: 'relaxed' }],
  ];
  // Inside the house (indoor tables are 100..103).
  PATRONS.push(
    [MALE, seatAt(100, 0), 60, { height: 1.6, outfit: outfit({ top: '#f59e0b', hair: '#111111' }, ['cap']), mood: 'happy' }],
    [FEMALE, seatAt(100, 2), 35, { height: 1.52, outfit: outfit({ top: '#a855f7', hair: '#3f2a1d' }), mood: 'relaxed' }],
    [MALE, seatAt(103, 1), 90, { height: 1.64, outfit: outfit({ top: '#0f766e', bottom: '#1f2937' }, ['scarf']), mood: 'happy' }],
    [MALE, seatAt(102, 3), 25, { height: 1.58, outfit: outfit({ top: '#e11d48', hair: '#4b2e1a' }, ['sunglasses']) }]
  );
  PATRONS.forEach(([, seat]) => occupiedSeats.add(seat));
  // The waitress loops from the stall round the tables, stopping to serve.
  // Waypoints thread the gaps between tables; `pause` is seconds spent at each.
  const WAITRESS_ROUTE: { x: number; z: number; pause: number }[] = [
    { x: 6.2, z: 0.8, pause: 3 }, // at the stall
    { x: 3.6, z: -1.6, pause: 2 },
    { x: 2.6, z: 1.2, pause: 0 },
    { x: 1.2, z: 3.0, pause: 1.5 },
    { x: -2.4, z: 2.6, pause: 0 },
    { x: -2.6, z: -0.4, pause: 2 },
    { x: -6.8, z: 0.6, pause: 2 },
    { x: -6.6, z: 4.6, pause: 0 },
    { x: -1.0, z: 4.6, pause: 0 },
    // Across the road into the house, round its tables and back out.
    { x: 0, z: houseFront - 2.5, pause: 0 },
    ...house.route,
    { x: 0, z: houseFront - 2.5, pause: 0 },
    { x: 3.0, z: 4.0, pause: 0 },
  ];
  let waitress: { character: VrmCharacter; leg: number; wait: number } | null = null;
  const loadWaitress = async () => {
    try {
      const gltf = await vrmLoader.parseAsync(await fetchVrmBuffer(FEMALE), '');
      const character = createVrmCharacter(
        prepareVrm(gltf as unknown as Parameters<typeof prepareVrm>[0]),
        { pose: 'standing', alcohol: 0, mood: 'happy', cheers: false },
        { targetHeight: 1.56, outfit: outfit({ top: '#166534', bottom: '#111827', hair: '#1c1917' }, ['headband']) }
      );
      character.root.position.set(WAITRESS_ROUTE[0].x, 0, WAITRESS_ROUTE[0].z);
      enableShadows(character.root);
      character.root.traverse((object) => (object.castShadow = false));
      scene.add(character.root);
      characters.push(character);
      characterTable.set(character, -1);
      character.mug.visible = false;
      waitress = { character, leg: 0, wait: WAITRESS_ROUTE[0].pause };
    } catch (error) {
      console.warn('[next-gen bar] waitress failed to load', error);
    }
  };
  /** Standing staff inside the house (no beer in hand). */
  const loadStaff = async (url: string, spot: Seat, look: { height: number; outfit: VrmOutfit }) => {
    try {
      const gltf = await vrmLoader.parseAsync(await fetchVrmBuffer(url), '');
      const character = createVrmCharacter(
        prepareVrm(gltf as unknown as Parameters<typeof prepareVrm>[0]),
        { pose: 'standing', alcohol: 0, mood: 'neutral', cheers: false },
        { targetHeight: look.height, outfit: look.outfit }
      );
      character.root.position.set(spot.x, 0, spot.z);
      character.root.rotation.y = spot.facing;
      character.mug.visible = false;
      enableShadows(character.root);
      character.root.traverse((object) => (object.castShadow = false));
      scene.add(character.root);
      characters.push(character);
      characterTable.set(character, -1);
    } catch (error) {
      console.warn('[next-gen bar] staff failed to load', error);
    }
  };
  // Load them one after another so the parse hitches are spread out.
  void PATRONS.reduce(
    (chain, [url, seat, alcohol, look]) => chain.then(() => seatCharacter(url, seat, alcohol, look)),
    Promise.resolve()
  )
    .then(loadWaitress)
    .then(() => loadStaff(MALE, house.staff.cook, { height: 1.66, outfit: outfit({ top: '#f8fafc', bottom: '#1f2937' }, ['headband']) }))
    .then(() => loadStaff(FEMALE, house.staff.cashier, { height: 1.55, outfit: outfit({ top: '#be123c', hair: '#1c1917' }) }))
    // The parking attendant by his booth.
    .then(() => loadStaff(MALE, scenery.parking.attendantSpot, { height: 1.6, outfit: outfit({ top: '#f97316', bottom: '#1f2937' }, ['cap']) }));
  const waitressStep = new THREE.Vector3();
  const updateWaitress = (delta: number) => {
    if (!waitress) return;
    const { character } = waitress;
    if (waitress.wait > 0) {
      waitress.wait -= delta;
      character.state.pose = 'standing';
      return;
    }
    const next = WAITRESS_ROUTE[(waitress.leg + 1) % WAITRESS_ROUTE.length];
    waitressStep.set(next.x - character.root.position.x, 0, next.z - character.root.position.z);
    const distance = waitressStep.length();
    const step = VRM_MOVE_SPEED.walking * delta;
    character.state.pose = 'walking';
    if (distance <= step) {
      character.root.position.set(next.x, 0, next.z);
      waitress.leg = (waitress.leg + 1) % WAITRESS_ROUTE.length;
      waitress.wait = next.pause;
      return;
    }
    character.root.position.addScaledVector(waitressStep, step / distance);
    const heading = Math.atan2(waitressStep.x, waitressStep.z);
    const turn = Math.atan2(Math.sin(heading - character.root.rotation.y), Math.cos(heading - character.root.rotation.y));
    character.root.rotation.y += turn * (1 - Math.exp(-10 * delta));
  };

  // ---- Splat backdrop (separate scene / pass) ----
  const splatScene = new THREE.Scene();
  splatScene.background = new THREE.Color(0x0b0d1a); // night sky when there is no splat
  const splatRoot = new THREE.Group();
  splatScene.add(splatRoot);
  // Moon and stars live in the backdrop pass so the river haze doesn't swallow them.
  splatScene.add(scenery.sky);
  let splat: GaussianSplat | null = null;
  let splatBounds: THREE.Box3 | null = null;

  // ---- Camera ----
  const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.05, 400);
  camera.position.set(4.6, 2.5, 5.4);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.9, -0.6);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 1.5;
  controls.maxDistance = 24;
  // Keep the orbit centre on the embankment so the camera can't wander off the map.
  const targetLimit = new THREE.Box3(
    new THREE.Vector3(-14, 0.3, -5),
    new THREE.Vector3(28, 3, scenery.house.interior.max.z) // up to the back of the house, east to the parking lot
  );
  controls.update();

  // ---- Post-processing (TSL) ----
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  // WebGPU guarantees only 32 bytes of colour attachments per pixel, so roughness
  // and metalness ride in the alpha of the 8-bit diffuse / normal targets:
  // output (8) + diffuse+roughness (4) + normal+metalness (4) + velocity (8) = 24.
  scenePass.setMRT(
    mrt({
      output,
      diffuseColor: vec4(diffuseColor.rgb, roughness),
      normal: vec4(directionToColor(normalView), metalness),
      velocity,
    })
  );
  for (const name of ['diffuseColor', 'normal']) {
    scenePass.getTexture(name).type = THREE.UnsignedByteType;
  }
  const color = scenePass.getTextureNode('output');
  const diffuse = scenePass.getTextureNode('diffuseColor');
  const depth = scenePass.getTextureNode('depth');
  const normalTexture = scenePass.getTextureNode('normal');
  const motion = scenePass.getTextureNode('velocity');
  const sceneNormal = sample((uv) => colorToDirection(normalTexture.sample(uv).rgb));
  const splatPass = pass(splatScene, camera);
  splatPass.setResolutionScale(0.6);
  const splatColor = splatPass.getTextureNode();

  const giPass = ssgi(color, depth, sceneNormal, camera);
  giPass.sliceCount.value = 2;
  giPass.stepCount.value = 8;
  // Default bounce (10) floods the white table; keep it subtle.
  giPass.giIntensity.value = 3;
  const aoPass = ao(depth, sceneNormal, camera);
  aoPass.resolutionScale = 0.5;
  const ssrPass = ssr(color, depth, sceneNormal, {
    metalnessNode: normalTexture.a,
    roughnessNode: diffuse.a,
    camera,
  });

  const fogColor = uniform(vec3(0.043, 0.051, 0.1));
  const fogDensity = uniform(0.0085);
  let effects = { ...DEFAULT_NEXTGEN_EFFECTS };
  const buildOutput = () => {
    // Lighting: SSGI adds bounce light from diffuse surfaces and its own AO.
    let lit: THREE.Node<'vec4'> = color;
    if (effects.ssgi) {
      lit = vec4(color.rgb.mul(giPass.a).add(diffuse.rgb.mul(giPass.rgb)), color.a);
    } else if (effects.gtao) {
      lit = vec4(color.rgb.mul(aoPass.getTextureNode().r), color.a);
    }
    if (effects.ssr) {
      // Reflections on the steel table, bottles and the wet-looking sidewalk.
      lit = vec4(lit.rgb.add(ssrPass.rgb.mul(ssrPass.a)), lit.a);
    }
    // Haze over the river (exp² by view distance) so the far bank fades into the night.
    // Applied here because scene.fog doesn't reach the MRT output; premultiplied by alpha.
    const viewZ = scenePass.getViewZNode();
    const haze = float(1).sub(exp(viewZ.mul(fogDensity).pow2().negate()));
    lit = vec4(mix(lit.rgb, fogColor.mul(lit.a), haze), lit.a);
    // Bar over the backdrop pass: night sky, moon, stars and the optional splat
    // (the bar pass is premultiplied with alpha 0 behind it).
    const background = splatColor.rgb;
    let composed: THREE.Node<'vec4'> = vec4(background.mul(float(1).sub(lit.a)).add(lit.rgb), 1);
    // Threshold above 1: only real light sources (bulbs, neon) glow, not bright surfaces.
    if (effects.bloom) composed = composed.add(bloom(composed, 0.4, 0.3, 1.1));
    pipeline.outputNode = effects.traa ? traa(composed, depth, motion, camera) : composed;
    pipeline.needsUpdate = true;
  };
  buildOutput();

  // ---- Loop ----
  const clock = new THREE.Clock();
  let frames = 0;
  let fpsTime = 0;
  const api: NextGenBar = {
    backend: backendName,
    setEffects: (next) => {
      effects = { ...next };
      floor.visible = next.floor;
      splatRoot.visible = next.splat;
      buildOutput();
    },
    loadSplat: async (source) => {
      const name = typeof source === 'string' ? source : source.name;
      const url = typeof source === 'string' ? source : URL.createObjectURL(source);
      try {
        const geometry = await splatLoaderFor(name).loadAsync(url);
        if (splat) {
          splatRoot.remove(splat);
          splat.geometry.dispose();
        }
        splat = new GaussianSplat(geometry as THREE.BufferGeometry);
        splatRoot.add(splat);
        const position = (geometry as THREE.BufferGeometry).getAttribute('position');
        splatBounds = robustBounds(position);
        return {
          count: position?.count ?? 0,
          min: splatBounds.min.toArray() as [number, number, number],
          max: splatBounds.max.toArray() as [number, number, number],
        };
      } finally {
        if (typeof source !== 'string') URL.revokeObjectURL(url);
      }
    },
    setSplatTransform: (t) => {
      splatRoot.position.set(t.x, t.y, t.z);
      splatRoot.rotation.set(t.flip ? Math.PI : 0, THREE.MathUtils.degToRad(t.yaw), 0, 'YXZ');
      splatRoot.scale.setScalar(t.scale);
    },
    setSplatResolution: (scale) => splatPass.setResolutionScale(THREE.MathUtils.clamp(scale, 0.25, 1)),
    fitSplat: (current) => {
      if (!splat || !splatBounds) return null;
      const box = splatBounds;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      // Captures are usually tens of metres wide: scale the longest side to ~24 m.
      const scale = THREE.MathUtils.clamp(24 / Math.max(size.x, size.z, 0.001), 0.05, 20);
      // Flipping (180° about X) negates Y and Z of the capture.
      // Y-down captures (COLMAP) have their floor at max.y; upright ones at min.y.
      const floorY = current.flip ? -box.max.y : box.min.y;
      const centerZ = current.flip ? -center.z : center.z;
      // Centre the capture a little behind the bar so the table stands in front of it.
      const targetZ = -(size.z * scale) / 2 - 3;
      return {
        ...current,
        yaw: 0,
        scale: +scale.toFixed(2),
        x: +(-center.x * scale).toFixed(2),
        y: +(-floorY * scale).toFixed(2),
        z: +(targetZ - centerZ * scale).toFixed(2),
      };
    },
    setPaused: (paused) => {
      renderer.setAnimationLoop(paused ? null : loop);
      if (!paused) clock.getDelta(); // don't jump the animation by the paused time
      player?.setSuspended(paused);
    },
    arriveByBike: () => {
      if (!player || !playerCharacter) {
        pendingArrival = true; // the player model is still loading
        return;
      }
      playRequested = true;
      player.setEnabled(true);
      const spot = scenery.parking.arrivalSpot;
      player.spawnAt(spot.x, spot.z, spot.facing);
      // Snap the follow camera down the lot's aisle (under the roof, clear of the booth),
      // so both the rider and the bike are in view.
      controls.target.set(spot.x, 1.1, spot.z + 0.4);
      camera.position.set(spot.x + 4.2, 2.1, spot.z - 0.8);
      controls.update();
      api.onPlayerStatus?.('🍻 Đã gửi xe. Đi vào quán thôi! (G cạnh xe để chạy về)');
    },
    setBike: (bikeId) => scenery.parking.setPlayerBike(bikeId),
    setPlayMode: (enabled) => {
      playRequested = enabled;
      player?.setEnabled(enabled);
      if (!enabled) {
        // Back to the table view.
        cameraOffset.copy(camera.position).sub(controls.target);
        controls.target.set(0, 0.9, -0.6);
        camera.position.copy(controls.target).add(cameraOffset);
      }
    },
    dispose: () => {
      player?.dispose();
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      characters.forEach((character) => character.dispose());
      pipeline.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
  api.setSplatTransform(DEFAULT_SPLAT_TRANSFORM);

  const cameraOffset = new THREE.Vector3();
  const cameraForward = new THREE.Vector3();
  const followTarget = new THREE.Vector3();
  const followShift = new THREE.Vector3();
  const indoorProbe = new THREE.Vector3();
  const cameraRoom = house.interior.clone();
  cameraRoom.min.z -= 3; // allow looking in from just outside the shutter
  const characterProbe = new THREE.Vector3();
  // Each table toasts on its own rhythm.
  const cheersTimers = new Map<number, number>();
  const loop = () => {
    const rawDelta = clock.getDelta();
    const delta = Math.min(rawDelta, 0.05);
    if (player?.enabled) {
      camera.getWorldDirection(cameraForward);
      player.update(delta, cameraForward);
      // Third-person follow: slide the orbit (target and camera together) after the
      // character, so mouse-drag orbiting and zoom keep working while walking.
      if (playerCharacter) {
        const { root } = playerCharacter;
        followTarget.set(root.position.x, root.position.y + 1.2, root.position.z);
        followShift.copy(controls.target);
        controls.target.lerp(followTarget, 1 - Math.exp(-8 * delta));
        followShift.subVectors(controls.target, followShift);
        camera.position.add(followShift);
      }
    } else {
      controls.target.clamp(targetLimit.min, targetLimit.max);
    }
    // Indoors the orbit would put the camera through the walls: pull it in and keep it
    // inside the room (it may lean out of the open shopfront).
    const indoors =
      !!player?.enabled &&
      !!playerCharacter &&
      house.interior.containsPoint(indoorProbe.set(playerCharacter.root.position.x, 1, playerCharacter.root.position.z));
    const inWc = indoors && house.tight.containsPoint(indoorProbe);
    controls.maxDistance = inWc ? 1.7 : indoors ? 4.2 : 24;
    controls.update();
    if (indoors) camera.position.clamp(cameraRoom.min, cameraRoom.max);
    scenery.update(clock.elapsedTime, delta, player?.enabled ? playerCharacter?.root.position : undefined);
    // Every few seconds each table raises a toast.
    for (const [table, timer] of cheersTimers) {
      cheersTimers.set(table, timer < 0 ? 6 + Math.random() * 6 : timer - delta);
    }
    characters.forEach((character) => {
      // Far-away customers are skipped (VRoid models are heavy to draw and animate).
      if (character !== playerCharacter) {
        const far = camera.position.distanceTo(characterProbe.copy(character.root.position)) > 26;
        character.root.visible = !far;
        if (far) return;
      }
      const table = characterTable.get(character) ?? 0;
      if (!cheersTimers.has(table)) cheersTimers.set(table, 2 + table * 1.7);
      // Only people sitting at a table join the toast.
      character.state.cheers = cheersTimers.get(table)! < 1.2 && character.state.pose === 'seated';
      character.update(delta);
    });
    animatedDishes.forEach((dish) => dish.userData.update(clock.elapsedTime));
    updateWaitress(delta);
    bulb.intensity = 14 + Math.sin(clock.elapsedTime * 13) * 0.6; // filament flicker
    pipeline.render();

    frames++;
    fpsTime += rawDelta; // real time, not the clamped animation step
    if (fpsTime > 0.5) {
      api.onStats?.(Math.round(frames / fpsTime));
      frames = 0;
      fpsTime = 0;
    }
  };
  renderer.setAnimationLoop(loop);

  const observer = new ResizeObserver(() => {
    if (!container.clientWidth || !container.clientHeight) return;
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  });
  observer.observe(container);

  return api;
}
