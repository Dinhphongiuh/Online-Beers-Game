/**
 * Dev Mode → VRM Character Lab: preview a VRoid Studio (.vrm) character on the
 * bar's plastic stool before it replaces the in-game human model.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createPlasticStool } from '../game/proceduralModels';
import {
  VRM_MOVE_SPEED,
  createVrmCharacter,
  loadVrm,
  type VrmCharacter,
  type VrmMood,
  type VrmPose,
} from '../game/vrmCharacter';
import {
  EMPTY_VRM_OUTFIT,
  VRM_ACCESSORIES,
  type VrmAccessory,
  type VrmOutfit,
  type VrmOutfitPart,
} from '../game/vrmOutfit';

const OUTFIT_PARTS: { id: VrmOutfitPart; label: string; swatches: string[] }[] = [
  { id: 'hair', label: '💇 Tóc', swatches: ['#1c1714', '#5a3420', '#d8b46a', '#c0392b', '#7d5fff', '#e8e8e8'] },
  { id: 'top', label: '👕 Áo', swatches: ['#c0392b', '#2e86de', '#27ae60', '#f1c40f', '#8e44ad', '#2d3436'] },
  { id: 'bottom', label: '👖 Quần / váy', swatches: ['#1e3799', '#2d3436', '#6d4c41', '#b2bec3', '#16a085', '#e17055'] },
  { id: 'shoes', label: '👟 Giày', swatches: ['#2d3436', '#ecf0f1', '#d63031', '#0984e3', '#a0522d', '#fdcb6e'] },
  { id: 'eyes', label: '👁️ Mắt', swatches: ['#3b2a1e', '#2e86de', '#27ae60', '#c0392b', '#8e44ad', '#f39c12'] },
];

const SKIN_SWATCHES: { label: string; color: string | null }[] = [
  { label: 'Gốc', color: null },
  { label: 'Ấm', color: '#f4d6c2' },
  { label: 'Nâu sáng', color: '#d6a684' },
  { label: 'Nâu đậm', color: '#9c6c52' },
];

/** Drop a VRoid Studio export here to have the lab (and later the game) load it by default. */
export const DEFAULT_VRM_URL = '/assets/characters/vrm/default.vrm';

/**
 * Ready-made characters in public/assets/characters/vrm (see LICENSES.md there).
 * Only the files that actually exist are shown.
 */
export const VRM_PRESETS = [
  // The first two are the official in-game characters (vrmHumanRig.ts VRM_HUMAN_MODELS).
  { id: 'male', label: '👨 Nam', name: 'Sakurada Fumiriya', url: '/assets/characters/vrm/male_fumiriya.vrm' },
  { id: 'female', label: '👩 Nữ', name: 'pixiv VRM1 Sample', url: '/assets/characters/vrm/female_pixiv.vrm' },
  { id: 'default', label: '📁 default.vrm', name: 'default.vrm', url: DEFAULT_VRM_URL },
] as const;

type PresetId = (typeof VRM_PRESETS)[number]['id'];

/** The Vite dev server answers unknown paths with index.html, so check the content type too. */
async function assetExists(url: string) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok && !(res.headers.get('content-type') || '').includes('text/html');
  } catch {
    return false;
  }
}

const MOODS: { id: VrmMood; label: string }[] = [
  { id: 'neutral', label: '😐 Bình thường' },
  { id: 'happy', label: '😆 Vui' },
  { id: 'relaxed', label: '😌 Phê' },
  { id: 'surprised', label: '😲 Bất ngờ' },
  { id: 'sad', label: '😢 Buồn' },
  { id: 'angry', label: '😠 Cáu' },
];

type LoadState = { kind: 'idle' | 'loading' | 'ready' | 'error'; message?: string; name?: string };

export const VrmCharacterLab: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const characterRef = useRef<VrmCharacter | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const stoolRef = useRef<THREE.Object3D | null>(null);
  const [load, setLoad] = useState<LoadState>({ kind: 'idle' });
  const [pose, setPose] = useState<VrmPose>('seated');
  const [alcohol, setAlcohol] = useState(20);
  const [mood, setMood] = useState<VrmMood>('neutral');
  const [cheers, setCheers] = useState(false);
  const [outfit, setOutfit] = useState<VrmOutfit>(EMPTY_VRM_OUTFIT);
  const outfitRef = useRef(outfit);
  outfitRef.current = outfit;
  const [dragOver, setDragOver] = useState(false);
  const [presets, setPresets] = useState<PresetId[]>([]);
  const [activePreset, setActivePreset] = useState<PresetId | null>(null);
  const loadToken = useRef(0);

  // ---- three.js stage ----
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c1714);
    sceneRef.current = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    pmrem.dispose();

    scene.add(new THREE.HemisphereLight(0xfde68a, 0x1c1917, 0.7));
    const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
    key.position.set(1.5, 3, 2.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -1.5;
    key.shadow.camera.right = 1.5;
    key.shadow.camera.top = 2.2;
    key.shadow.camera.bottom = -0.5;
    key.shadow.bias = -0.0004;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xf97316, 1.1);
    rim.position.set(-2, 2, -2);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4, 48),
      new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const stool = createPlasticStool(0xdc2626);
    stool.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    scene.add(stool);
    stoolRef.current = stool;

    const camera = new THREE.PerspectiveCamera(32, mount.clientWidth / mount.clientHeight, 0.05, 50);
    camera.position.set(0.9, 1.35, 2.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.95, 0);
    controls.enableDamping = true;
    controls.minDistance = 0.4;
    controls.maxDistance = 6;
    controls.update();

    // The character looks at the viewer like at a friend across the table.
    const lookTarget = new THREE.Object3D();
    scene.add(lookTarget);

    const clock = new THREE.Clock();
    // Walking / running path: a circle that starts at the stool, heading +Z.
    const PATH_RADIUS = 1.1;
    const pathCenter = new THREE.Vector3(-PATH_RADIUS, 0, 0);
    let pathAngle = 0;
    const followTarget = new THREE.Vector3();
    const followDelta = new THREE.Vector3();

    renderer.setAnimationLoop(() => {
      const delta = Math.min(clock.getDelta(), 0.05);
      const character = characterRef.current;
      if (character) {
        const { root, state } = character;
        const speed = VRM_MOVE_SPEED[state.pose];
        if (speed > 0) {
          // Drunk players wobble off the line.
          const wobble = Math.sin(clock.elapsedTime * 1.7) * 0.12 * (state.alcohol / 100);
          pathAngle += (delta * speed) / PATH_RADIUS;
          root.position.set(
            pathCenter.x + Math.cos(pathAngle) * (PATH_RADIUS + wobble),
            0,
            pathCenter.z + Math.sin(pathAngle) * (PATH_RADIUS + wobble)
          );
          root.rotation.y = -pathAngle + wobble * 0.8;
        } else if (state.pose === 'seated') {
          // Go back to the stool.
          root.position.x = THREE.MathUtils.damp(root.position.x, 0, 4, delta);
          root.position.z = THREE.MathUtils.damp(root.position.z, 0, 4, delta);
          root.rotation.y = THREE.MathUtils.damp(root.rotation.y, 0, 4, delta);
          pathAngle = 0;
        }
        // Camera follows the character, keeping the orbit the user picked.
        followTarget.set(root.position.x, 0.95, root.position.z);
        followDelta.copy(controls.target);
        controls.target.lerp(followTarget, 1 - Math.exp(-9 * delta));
        followDelta.subVectors(controls.target, followDelta);
        camera.position.add(followDelta);
      }
      controls.update();
      lookTarget.position.copy(camera.position);
      character?.update(delta, lookTarget);
      renderer.render(scene, camera);
    });

    const resize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      characterRef.current?.dispose();
      characterRef.current = null;
      sceneRef.current = null;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  const showCharacter = async (source: string | File, name: string) => {
    // Clicking another model while one is still loading: only the latest wins.
    const token = ++loadToken.current;
    setLoad({ kind: 'loading', name });
    try {
      const vrm = await loadVrm(source);
      const scene = sceneRef.current;
      if (!scene || token !== loadToken.current) return;
      characterRef.current?.root.removeFromParent();
      characterRef.current?.dispose();
      const character = createVrmCharacter(vrm, { pose, alcohol, mood, cheers }, { outfit: outfitRef.current });
      scene.add(character.root);
      characterRef.current = character;
      setLoad({ kind: 'ready', name });
    } catch (error) {
      if (token !== loadToken.current) return;
      setLoad({ kind: 'error', name, message: error instanceof Error ? error.message : String(error) });
    }
  };

  const pickPreset = (id: PresetId) => {
    const preset = VRM_PRESETS.find((entry) => entry.id === id);
    if (!preset) return;
    setActivePreset(id);
    void showCharacter(preset.url, preset.name);
  };

  // Offer the bundled characters that exist in /public and show the first one.
  useEffect(() => {
    let cancelled = false;
    Promise.all(VRM_PRESETS.map(async (preset) => ((await assetExists(preset.url)) ? preset.id : null))).then(
      (found) => {
        if (cancelled) return;
        const available = found.filter((id): id is PresetId => id !== null);
        setPresets(available);
        if (available[0]) pickPreset(available[0]);
      }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recolouring a 2K texture takes a few dozen ms: wait until the picker settles.
  useEffect(() => {
    const timer = window.setTimeout(() => characterRef.current?.setOutfit(outfit), 120);
    return () => window.clearTimeout(timer);
  }, [outfit, load.kind]);

  const setPartColor = (part: VrmOutfitPart, color: string | null) =>
    setOutfit((current) => ({ ...current, colors: { ...current.colors, [part]: color } }));
  const toggleAccessory = (id: VrmAccessory) =>
    setOutfit((current) => ({
      ...current,
      accessories: current.accessories.includes(id)
        ? current.accessories.filter((item) => item !== id)
        : [...current.accessories, id],
    }));

  // Standing on the spot of the stool would put the legs through it.
  useEffect(() => {
    if (stoolRef.current) stoolRef.current.visible = pose === 'seated';
  }, [pose]);

  // Push the controls into the live character.
  useEffect(() => {
    const character = characterRef.current;
    if (!character) return;
    Object.assign(character.state, { pose, alcohol, mood, cheers });
  }, [pose, alcohol, mood, cheers, load.kind]);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.vrm')) {
      setLoad({ kind: 'error', name: file.name, message: 'Chỉ nhận file .vrm (VRoid Studio → Export → VRM).' });
      return;
    }
    setActivePreset(null);
    void showCharacter(file, file.name);
  };

  const pill = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-black border transition ${
      active
        ? 'bg-amber-400 text-zinc-950 border-amber-200'
        : 'bg-zinc-900 text-amber-100 border-zinc-700 hover:border-amber-400'
    }`;

  return (
    <div className="flex flex-col md:flex-row gap-3 h-full min-h-0">
      <div
        className={`relative flex-1 min-h-[320px] rounded-2xl overflow-hidden border-2 ${
          dragOver ? 'border-amber-300' : 'border-zinc-800'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files[0]);
        }}
      >
        <div ref={mountRef} className="absolute inset-0" data-testid="vrm-lab-canvas" />
        {load.kind !== 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="max-w-sm text-center rounded-2xl bg-zinc-950/85 border border-zinc-700 px-5 py-4 text-sm text-zinc-200">
              {load.kind === 'loading' && <p className="font-black text-amber-300">⏳ Đang tải {load.name}…</p>}
              {load.kind === 'error' && (
                <p className="font-bold text-rose-300">
                  ❌ {load.name}: {load.message}
                </p>
              )}
              {load.kind === 'idle' && (
                <>
                  <p className="font-black text-amber-300 text-base">Kéo thả file .vrm vào đây</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Tạo nhân vật trong VRoid Studio → Export VRM. Đặt file ở{' '}
                    <code className="text-amber-200">public{DEFAULT_VRM_URL}</code> để tự tải.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="md:w-72 shrink-0 space-y-3 text-sm overflow-y-auto">
        {presets.length > 0 && (
          <div>
            <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider">Nhân vật có sẵn</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {VRM_PRESETS.filter((preset) => presets.includes(preset.id)).map((preset) => (
                <button
                  key={preset.id}
                  className={pill(activePreset === preset.id)}
                  onClick={() => pickPreset(preset.id)}
                  title={preset.name}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider">Hoặc file VRM của bạn</span>
          <input
            type="file"
            accept=".vrm"
            data-testid="vrm-file-input"
            onChange={(e) => pickFile(e.target.files?.[0])}
            className="mt-1 block w-full text-xs text-zinc-300 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-400 file:px-3 file:py-1.5 file:font-black file:text-zinc-950"
          />
          {load.kind === 'ready' && <span className="text-[11px] text-emerald-300">✅ {load.name}</span>}
        </label>

        <div>
          <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider">Tư thế</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <button className={pill(pose === 'seated')} onClick={() => setPose('seated')}>
              🪑 Ngồi ghế nhựa
            </button>
            <button className={pill(pose === 'standing')} onClick={() => setPose('standing')}>
              🧍 Đứng
            </button>
            <button className={pill(pose === 'walking')} onClick={() => setPose('walking')}>
              🚶 Đi bộ
            </button>
            <button className={pill(pose === 'running')} onClick={() => setPose('running')}>
              🏃 Chạy
            </button>
          </div>
        </div>

        <label className="block">
          <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
            Độ cồn: {alcohol}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={alcohol}
            onChange={(e) => setAlcohol(Number(e.target.value))}
            className="mt-1 w-full accent-amber-400"
          />
        </label>

        <div>
          <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider">Biểu cảm</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <button key={m.id} className={pill(mood === m.id)} onClick={() => setMood(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div data-testid="vrm-outfit-editor" className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-fuchsia-300 uppercase tracking-wider">👗 Trang phục tùy chỉnh</span>
            <button
              className="text-[10px] font-bold text-zinc-400 hover:text-amber-200"
              onClick={() => setOutfit(EMPTY_VRM_OUTFIT)}
            >
              Đặt lại
            </button>
          </div>

          {OUTFIT_PARTS.map((part) => {
            const current = outfit.colors[part.id] ?? null;
            return (
              <div key={part.id}>
                <span className="text-[11px] font-bold text-amber-100">{part.label}</span>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <button
                    title="Màu gốc của model"
                    onClick={() => setPartColor(part.id, null)}
                    className={`h-6 px-1.5 rounded-md border text-[10px] font-bold ${
                      current === null ? 'border-amber-300 text-amber-200' : 'border-zinc-700 text-zinc-400'
                    }`}
                  >
                    Gốc
                  </button>
                  {part.swatches.map((color) => (
                    <button
                      key={color}
                      title={color}
                      aria-label={`${part.label} ${color}`}
                      onClick={() => setPartColor(part.id, color)}
                      className={`w-6 h-6 rounded-full border-2 ${
                        current === color ? 'border-amber-300 scale-110' : 'border-white/20'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    aria-label={`${part.label}: chọn màu khác`}
                    value={current ?? '#888888'}
                    onChange={(e) => setPartColor(part.id, e.target.value)}
                    className="w-7 h-6 rounded cursor-pointer bg-transparent"
                  />
                </div>
              </div>
            );
          })}

          <div>
            <span className="text-[11px] font-bold text-amber-100">🎨 Tông da</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {SKIN_SWATCHES.map((tone) => (
                <button
                  key={tone.label}
                  className={pill(outfit.skinTone === tone.color)}
                  onClick={() => setOutfit((current) => ({ ...current, skinTone: tone.color }))}
                >
                  {tone.color && (
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle border border-white/30"
                      style={{ backgroundColor: tone.color }}
                    />
                  )}
                  {tone.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-amber-100">🎒 Phụ kiện</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {VRM_ACCESSORIES.map((accessory) => (
                <button
                  key={accessory.id}
                  className={pill(outfit.accessories.includes(accessory.id))}
                  onClick={() => toggleAccessory(accessory.id)}
                >
                  {accessory.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onPointerDown={() => setCheers(true)}
          onPointerUp={() => setCheers(false)}
          onPointerLeave={() => setCheers(false)}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-zinc-950 font-black shadow-lg active:scale-95 transition"
        >
          🍻 Giữ để cụng ly "DZÔ!"
        </button>

        <p className="text-[11px] leading-snug text-zinc-500">
          Kéo chuột để xoay camera, cuộn để zoom. Tư thế dùng xương humanoid chuẩn của VRM nên áp dụng được cho mọi model
          VRoid.
        </p>
      </div>
    </div>
  );
};
