/**
 * "Quán Nhậu Next-Gen" (Dev Mode): the bar rebuilt on three.js WebGPURenderer.
 *
 * - Background: a Gaussian splat capture (three r186+ GaussianSplat, .spz/.ply/.splat/.ksplat),
 *   rendered in its own pass and composited behind the bar.
 * - Foreground: the existing procedural bar props + VRM characters, rendered with an MRT
 *   pass and TSL post effects: SSGI (bounce light + AO) or GTAO, SSR, bloom and TRAA.
 *
 * The main game still runs on WebGLRenderer; this scene is a self-contained preview.
 */
import * as THREE from 'three/webgpu';
import {
  colorToDirection,
  diffuseColor,
  directionToColor,
  float,
  metalness,
  mrt,
  normalView,
  output,
  pass,
  roughness,
  sample,
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
  createBeerCrates,
  createBeerTower,
  createFairyLights,
  createFloorLitterAndBottles,
  createIceBucket,
  createNeonSign,
  createPlasticStool,
  createSidewalkTexture,
  createStainlessTable,
  createStreetFoodCart,
  createStreetMotorbike,
} from './proceduralModels';
import { createTableClutter } from './foodModels';
import { createVrmCharacter, fetchVrmBuffer, prepareVrm, type VrmCharacter } from './vrmCharacter';

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
  splat: true,
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
  // Cool street-lamp rim from behind.
  const rim = new THREE.SpotLight(0x9ab8ff, 30, 14, 0.6, 0.6, 1.5);
  rim.position.set(-4, 5, -5);
  rim.target.position.set(0, 0.6, 0);
  scene.add(rim, rim.target);

  const sidewalk = createSidewalkTexture();
  sidewalk.wrapS = sidewalk.wrapT = THREE.RepeatWrapping;
  sidewalk.repeat.set(5, 5);
  sidewalk.anisotropy = 8;
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(5, 64),
    new THREE.MeshStandardMaterial({ map: sidewalk, roughness: 0.55, metalness: 0.05, color: 0x9a9690 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const table = createStainlessTable();
  scene.add(table);
  scene.add(createTableClutter());
  const tower = createBeerTower(0.9);
  tower.position.set(-0.6, 0.98, -0.3);
  tower.scale.setScalar(0.85);
  scene.add(tower);
  const bucket = createIceBucket();
  bucket.position.set(-0.42, 0.98, 0.06);
  bucket.scale.setScalar(0.88);
  scene.add(bucket);
  const crates = createBeerCrates();
  crates.position.set(-2.4, 0, -2.2);
  crates.rotation.y = 0.35;
  scene.add(crates);
  const cart = createStreetFoodCart();
  cart.position.set(3.1, 0, -2.2);
  cart.rotation.y = -0.4;
  scene.add(cart);
  const bike = createStreetMotorbike();
  bike.position.set(-3.6, 0, 1.6);
  bike.rotation.y = 1.2;
  scene.add(bike);
  scene.add(createFloorLitterAndBottles());
  scene.add(createFairyLights());
  const sign = createNeonSign('NHẬU VỈA HÈ', 'BIA HƠI • LẨU • HẢI SẢN');
  sign.position.set(0, 2.8, -3.6);
  scene.add(sign);

  const stoolColors = [0xdc2626, 0x0284c7];
  for (let i = 0; i < SEATS; i++) {
    const stool = createPlasticStool(stoolColors[i % 2]);
    const angle = seatAngle(i);
    stool.position.set(Math.cos(angle) * TABLE_RADIUS, 0, Math.sin(angle) * TABLE_RADIUS);
    stool.rotation.y = -angle + Math.PI / 2;
    scene.add(stool);
  }
  enableShadows(scene);
  floor.castShadow = false;

  // ---- Characters (VRM with WebGPU MToon materials) ----
  const characters: VrmCharacter[] = [];
  const vrmLoader = createWebGPUVrmLoader();
  const seatCharacter = async (url: string, seat: number, alcohol: number) => {
    try {
      const gltf = await vrmLoader.parseAsync(await fetchVrmBuffer(url), '');
      const character = createVrmCharacter(
        prepareVrm(gltf as unknown as Parameters<typeof prepareVrm>[0]),
        { pose: 'seated', alcohol, mood: 'neutral', cheers: false },
        { targetHeight: seat === 0 ? 1.62 : 1.52 }
      );
      const angle = seatAngle(seat);
      character.root.position.set(Math.cos(angle) * TABLE_RADIUS, 0, Math.sin(angle) * TABLE_RADIUS);
      character.root.rotation.y = -angle - Math.PI / 2;
      enableShadows(character.root);
      scene.add(character.root);
      characters.push(character);
    } catch (error) {
      console.warn('[next-gen bar] character failed to load', url, error);
    }
  };
  void seatCharacter('/assets/characters/vrm/male_fumiriya.vrm', 0, 35);
  void seatCharacter('/assets/characters/vrm/female_pixiv.vrm', 2, 55);

  // ---- Splat backdrop (separate scene / pass) ----
  const splatScene = new THREE.Scene();
  splatScene.background = new THREE.Color(0x0b0d1a); // night sky when there is no splat
  const splatRoot = new THREE.Group();
  splatScene.add(splatRoot);
  let splat: GaussianSplat | null = null;
  let splatBounds: THREE.Box3 | null = null;

  // ---- Camera ----
  const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.05, 200);
  camera.position.set(3.4, 2.1, 4.2);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.9, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
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
    // Bar over the splat backdrop (the bar pass is premultiplied with alpha 0 behind it).
    const background = effects.splat ? splatColor.rgb : vec4(0.043, 0.051, 0.1, 1).rgb;
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
    dispose: () => {
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

  let cheersTimer = 4;
  renderer.setAnimationLoop(() => {
    const rawDelta = clock.getDelta();
    const delta = Math.min(rawDelta, 0.05);
    controls.update();
    // Every few seconds the table raises a toast.
    cheersTimer -= delta;
    const cheering = cheersTimer < 1.2;
    if (cheersTimer < 0) cheersTimer = 6 + Math.random() * 4;
    characters.forEach((character) => {
      character.state.cheers = cheering;
      character.update(delta);
    });
    bulb.intensity = 14 + Math.sin(clock.elapsedTime * 13) * 0.6; // filament flicker
    pipeline.render();

    frames++;
    fpsTime += rawDelta; // real time, not the clamped animation step
    if (fpsTime > 0.5) {
      api.onStats?.(Math.round(frames / fpsTime));
      frames = 0;
      fpsTime = 0;
    }
  });

  const observer = new ResizeObserver(() => {
    if (!container.clientWidth || !container.clientHeight) return;
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  });
  observer.observe(container);

  return api;
}
