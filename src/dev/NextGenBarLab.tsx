/**
 * Dev Mode → Quán Ốc Bờ Sông: the riverside snail bar on WebGPU with TSL effects and a
 * Gaussian splat backdrop. Effects can be toggled to compare quality and FPS.
 */
import React, { useEffect, useRef, useState } from 'react';
import { RideView } from './RideLab';
import { RIDE_BIKES } from '../game/rideLab/bikePhysics';
import type { RideDirection } from '../game/rideLab/route';
import type { CameraMode } from '../game/rideLab/rideWorld';
import {
  DEFAULT_NEXTGEN_EFFECTS,
  DEFAULT_SPLAT_TRANSFORM,
  SAMPLE_SPLAT_URL,
  createNextGenBar,
  type NextGenBar,
  type NextGenEffects,
  type SplatInfo,
  type SplatTransform,
} from '../game/nextGenBar';

const describeSplat = (name: string, info: SplatInfo) => {
  const size = info.max.map((value, i) => (value - info.min[i]).toFixed(1)).join(' × ');
  return `${name}: ${info.count.toLocaleString('vi-VN')} điểm • kích thước ${size}`;
};

const EFFECT_LABELS: { id: keyof NextGenEffects; label: string; hint: string }[] = [
  { id: 'traa', label: 'TRAA', hint: 'Khử răng cưa theo thời gian: cạnh sắc, không nhấp nháy' },
  { id: 'ssgi', label: 'SSGI', hint: 'Ánh sáng dội giữa các bề mặt + bóng góc khuất' },
  { id: 'gtao', label: 'GTAO', hint: 'Bóng góc khuất (khi tắt SSGI)' },
  { id: 'ssr', label: 'SSR', hint: 'Phản chiếu trên bàn inox, chai, mặt đường' },
  { id: 'bloom', label: 'Bloom', hint: 'Đèn neon, bóng đèn toả sáng' },
  { id: 'splat', label: 'Splat', hint: 'Phông nền Gaussian Splat' },
  { id: 'floor', label: 'Nền bờ kè', hint: 'Tắt nếu splat có sẵn mặt đất' },
];

const TRANSFORM_FIELDS: { id: keyof Omit<SplatTransform, 'flip'>; label: string; min: number; max: number; step: number }[] = [
  { id: 'x', label: 'X', min: -150, max: 150, step: 0.1 },
  { id: 'y', label: 'Y', min: -150, max: 150, step: 0.05 },
  { id: 'z', label: 'Z', min: -250, max: 100, step: 0.1 },
  { id: 'yaw', label: 'Xoay', min: -180, max: 180, step: 1 },
  { id: 'scale', label: 'Tỉ lệ', min: 0.1, max: 10, step: 0.05 },
];

type Status = { kind: 'starting' | 'ready' | 'error'; message?: string };

export const NextGenBarLab: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<NextGenBar | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'starting' });
  const [backend, setBackend] = useState('');
  const [fps, setFps] = useState(0);
  const [effects, setEffects] = useState<NextGenEffects>(DEFAULT_NEXTGEN_EFFECTS);
  const [transform, setTransform] = useState<SplatTransform>(DEFAULT_SPLAT_TRANSFORM);
  const [splatInfo, setSplatInfo] = useState('');
  const [splatResolution, setSplatResolution] = useState(0.6);
  const [playMode, setPlayMode] = useState(false);
  const [playerStatus, setPlayerStatus] = useState('');
  // Riding to / from the quán (the bar pauses while the ride is on screen).
  const [journey, setJourney] = useState<RideDirection | null>(null);
  const [rideBike, setRideBike] = useState(RIDE_BIKES[0].id);
  const [rideCamera, setRideCamera] = useState<CameraMode>('tpp');
  const [homeAlcohol, setHomeAlcohol] = useState(55);
  const [journeyNote, setJourneyNote] = useState('');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let bar: NextGenBar | null = null;
    createNextGenBar(mount)
      .then(async (created) => {
        if (disposed) {
          created.dispose();
          return;
        }
        bar = created;
        barRef.current = created;
        created.onStats = setFps;
        created.onPlayerStatus = setPlayerStatus;
        // [G] beside the bike in the parking lot: ride home.
        created.onRideHome = () => setJourney('return');
        setBackend(created.backend);
        setStatus({ kind: 'ready' });
        if (created.backend !== 'webgpu') {
          setSplatInfo('Trình duyệt không có WebGPU: splat cần compute shader nên bị tắt.');
          return;
        }
        try {
          setSplatInfo('Đang tải splat mẫu…');
          const info = await created.loadSplat(SAMPLE_SPLAT_URL);
          setSplatInfo(describeSplat('Splat mẫu', info));
          const fitted = created.fitSplat(DEFAULT_SPLAT_TRANSFORM);
          if (fitted) setTransform(fitted);
        } catch {
          setSplatInfo('Chưa có splat mẫu. Kéo thả file .spz / .ply / .splat vào đây.');
        }
      })
      .catch((error) => setStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error) }));
    return () => {
      disposed = true;
      bar?.dispose();
      barRef.current = null;
    };
  }, []);

  useEffect(() => {
    barRef.current?.setEffects(effects);
  }, [effects, status.kind]);

  useEffect(() => {
    barRef.current?.setSplatTransform(transform);
  }, [transform, status.kind]);

  useEffect(() => {
    barRef.current?.setSplatResolution(splatResolution);
  }, [splatResolution, status.kind]);

  useEffect(() => {
    barRef.current?.setPlayMode(playMode);
  }, [playMode, status.kind]);

  useEffect(() => {
    barRef.current?.setPaused(journey !== null);
  }, [journey, status.kind]);

  useEffect(() => {
    barRef.current?.setBike(rideBike);
  }, [rideBike, status.kind]);

  /** Parked at the quán: back to the bar, standing beside the bike. */
  const enterBar = () => {
    setJourney(null);
    barRef.current?.arriveByBike();
    setPlayMode(true);
    setJourneyNote('🅿️ Đã gửi xe ô số 27. Đi bộ vào quán; tới cạnh xe nhấn G để chạy về.');
  };
  const leaveRide = (note: string) => {
    setJourney(null);
    setJourneyNote(note);
  };

  const loadFile = async (file: File | undefined) => {
    if (!file || !barRef.current) return;
    setSplatInfo(`Đang tải ${file.name}…`);
    try {
      const info = await barRef.current.loadSplat(file);
      setSplatInfo(describeSplat(file.name, info));
      const fitted = barRef.current.fitSplat(transform);
      if (fitted) setTransform(fitted);
    } catch (error) {
      setSplatInfo(`❌ ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const pill = (active: boolean) =>
    `px-2 py-1 rounded-lg text-xs font-black border transition ${
      active ? 'bg-amber-400 text-zinc-950 border-amber-200' : 'bg-zinc-900 text-amber-100 border-zinc-700'
    }`;

  return (
    <div className="flex flex-col md:flex-row gap-3 h-full min-h-0">
      <div
        className="relative flex-1 min-h-[320px] rounded-2xl overflow-hidden border-2 border-zinc-800 bg-black"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void loadFile(e.dataTransfer.files[0]);
        }}
      >
        <div ref={mountRef} className="absolute inset-0" data-testid="nextgen-canvas" />
        <div className="absolute top-2 left-2 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-bold text-emerald-300 pointer-events-none">
          {status.kind === 'ready' ? `${backend.toUpperCase()} • ${fps} FPS` : status.kind === 'error' ? '' : 'Đang khởi động WebGPU…'}
        </div>
        {playMode && playerStatus && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-xl bg-black/70 px-3 py-1.5 text-xs font-black text-amber-200 pointer-events-none">
            {playerStatus}
          </div>
        )}
        {status.kind === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="max-w-sm text-center text-sm font-bold text-rose-300">❌ {status.message}</p>
          </div>
        )}
        {journey && (
          <div className="absolute inset-0 z-10" data-testid="nextgen-journey">
            <RideView
              key={journey}
              direction={journey}
              alcohol={journey === 'return' ? homeAlcohol : 0}
              bikeId={rideBike}
              cameraMode={rideCamera}
              traffic
              onCameraChange={setRideCamera}
              renderArrival={(result, rideAgain) =>
                result.direction === 'outbound' ? (
                  <>
                    <button onClick={enterBar} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-zinc-950" data-testid="journey-enter-bar">
                      Vào quán nhậu 🍻
                    </button>
                    <button onClick={rideAgain} className="rounded-xl border border-zinc-600 px-3 py-2 text-xs font-black text-zinc-200">
                      Chạy lại
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        leaveRide(
                          result.fined
                            ? '🚨 Về tới nhà nhưng dính chốt CSGT ở đầu hẻm. Lần sau gọi xe ôm!'
                            : '🏠 Về tới nhà an toàn. Ngủ ngon!'
                        )
                      }
                      className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-zinc-950"
                    >
                      Quay lại quán
                    </button>
                    <button onClick={rideAgain} className="rounded-xl border border-zinc-600 px-3 py-2 text-xs font-black text-zinc-200">
                      Chạy lại
                    </button>
                  </>
                )
              }
            />
            <button
              onClick={() => leaveRide('')}
              className="absolute left-2 top-14 z-20 rounded-lg border border-zinc-600 bg-black/70 px-2 py-1 text-[11px] font-black text-zinc-200 hover:border-amber-400"
            >
              ✕ Bỏ chuyến, về quán
            </button>
          </div>
        )}
      </div>

      <div className="md:w-72 shrink-0 space-y-3 text-sm overflow-y-auto">
        <div className="rounded-xl border border-sky-700/60 bg-sky-950/40 p-2.5 space-y-1.5" data-testid="nextgen-journey-panel">
          <span className="text-[11px] font-black uppercase tracking-wider text-sky-300">🛵 Đi lại bằng xe máy</span>
          <div className="flex flex-wrap gap-1">
            {RIDE_BIKES.map((b) => (
              <button key={b.id} className={pill(rideBike === b.id)} onClick={() => setRideBike(b.id)} title={b.subtitle}>
                {b.name}
              </button>
            ))}
          </div>
          <button
            data-testid="journey-outbound"
            disabled={status.kind !== 'ready'}
            onClick={(e) => {
              e.currentTarget.blur();
              setJourney('outbound');
            }}
            className="w-full rounded-lg border border-sky-500 bg-sky-500/15 py-1.5 text-xs font-black text-sky-100 hover:bg-sky-500/30 disabled:opacity-40"
          >
            🛵 Chạy xe đi nhậu (Nhà → Quán)
          </button>
          <button
            data-testid="journey-return"
            disabled={status.kind !== 'ready'}
            onClick={(e) => {
              e.currentTarget.blur();
              setJourney('return');
            }}
            className="w-full rounded-lg border border-rose-500 bg-rose-500/15 py-1.5 text-xs font-black text-rose-100 hover:bg-rose-500/30 disabled:opacity-40"
          >
            🛵 Chạy xe về (Quán → Nhà)
          </button>
          <label className="block">
            <span className="flex justify-between text-[10px] font-bold text-sky-100">
              <span>Độ say khi về</span>
              <span>{homeAlcohol}</span>
            </span>
            <input type="range" min={0} max={100} value={homeAlcohol} onChange={(e) => setHomeAlcohol(Number(e.target.value))} className="w-full accent-rose-400" />
          </label>
          <p className="text-[10px] leading-snug text-sky-100/70">
            Đi nhậu: ~1,4 km qua hẻm, ngã tư có đèn, bờ kè; gửi xe vào ô xanh ở bãi giữ xe rồi vào quán. Về: tới cạnh xe ở bãi (ô số 27) nhấn <b>G</b>, hoặc bấm nút trên. Đứng yên giữ <b>S</b> để chống chân lùi xe.
          </p>
          {journeyNote && <p className="rounded-lg bg-black/40 px-2 py-1 text-[11px] font-bold text-amber-100">{journeyNote}</p>}
        </div>
        <div className="rounded-xl border border-emerald-700/60 bg-emerald-950/40 p-2.5 space-y-1.5">
          <button
            data-testid="nextgen-play-toggle"
            className={`w-full rounded-lg py-1.5 text-xs font-black border transition ${
              playMode ? 'bg-emerald-400 text-zinc-950 border-emerald-200' : 'bg-zinc-900 text-emerald-200 border-emerald-700'
            }`}
            onClick={(e) => {
              setPlayMode((current) => !current);
              // Keep focus off the button so Space/Enter don't re-toggle while walking.
              e.currentTarget.blur();
            }}
          >
            {playMode ? '🎮 Đang điều khiển nhân vật (bấm để tắt)' : '🎮 Điều khiển nhân vật'}
          </button>
          <p className="text-[10px] leading-snug text-emerald-100/70">
            WASD / mũi tên: đi • Shift: chạy • E: ngồi xuống / đứng dậy • Kéo chuột: xoay camera • Cuộn: zoom
          </p>
        </div>
        <div>
          <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider">Hiệu ứng WebGPU (TSL)</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {EFFECT_LABELS.map((effect) => (
              <button
                key={effect.id}
                title={effect.hint}
                className={pill(effects[effect.id])}
                onClick={() => setEffects((current) => ({ ...current, [effect.id]: !current[effect.id] }))}
              >
                {effect.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">Bật/tắt từng hiệu ứng để so chất lượng và FPS.</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 space-y-2">
          <span className="text-[11px] font-black text-fuchsia-300 uppercase tracking-wider">🌆 Phông nền Gaussian Splat</span>
          <p className="text-[11px] text-zinc-400">{splatInfo}</p>
          <input
            type="file"
            accept=".spz,.ply,.splat,.ksplat"
            onChange={(e) => void loadFile(e.target.files?.[0])}
            className="block w-full text-xs text-zinc-300 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-400 file:px-3 file:py-1.5 file:font-black file:text-zinc-950"
          />
          {TRANSFORM_FIELDS.map((field) => (
            <label key={field.id} className="block">
              <span className="flex justify-between text-[10px] font-bold text-amber-100">
                <span>{field.label}</span>
                <span>{transform[field.id]}</span>
              </span>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={transform[field.id]}
                onChange={(e) => setTransform((current) => ({ ...current, [field.id]: Number(e.target.value) }))}
                className="w-full accent-fuchsia-400"
              />
            </label>
          ))}
          <button
            className="w-full rounded-lg border border-fuchsia-500/60 py-1 text-[11px] font-black text-fuchsia-200 hover:bg-fuchsia-500/20"
            onClick={() => {
              const fitted = barRef.current?.fitSplat(transform);
              if (fitted) setTransform(fitted);
            }}
          >
            🎯 Căn tự động sau quán
          </button>
          <label className="block">
            <span className="flex justify-between text-[10px] font-bold text-amber-100">
              <span>Độ phân giải splat (nhẹ máy ↔ nét)</span>
              <span>{Math.round(splatResolution * 100)}%</span>
            </span>
            <input
              type="range"
              min={0.25}
              max={1}
              step={0.05}
              value={splatResolution}
              onChange={(e) => setSplatResolution(Number(e.target.value))}
              className="w-full accent-fuchsia-400"
            />
          </label>
          <label className="flex items-center gap-2 text-[11px] text-zinc-300">
            <input
              type="checkbox"
              checked={transform.flip}
              onChange={(e) => setTransform((current) => ({ ...current, flip: e.target.checked }))}
            />
            Lật ngược (file quét bị lộn đầu)
          </label>
        </div>

        <p className="text-[11px] leading-snug text-zinc-500">
          Quay quán thật bằng Polycam / Luma / Postshot rồi xuất .spz hoặc .ply và kéo thả vào khung 3D. Kéo chuột để xoay,
          cuộn để zoom.
        </p>
      </div>
    </div>
  );
};
