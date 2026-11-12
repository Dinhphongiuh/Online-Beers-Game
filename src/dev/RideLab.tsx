/**
 * Dev Mode → Ride Lab: develop the motorbike ride (physics, bike HUD, the route).
 * The 3D world lives in game/rideLab/rideWorld.ts; this file is the HUD and the
 * lab controls. Not wired into the live commute yet.
 */
import React, { useEffect, useRef, useState } from 'react';
import { RIDE_BIKES } from '../game/rideLab/bikePhysics';
import { createRideWorld, type CameraMode, type RideEventKind, type RideTelemetry, type RideWorld } from '../game/rideLab/rideWorld';

type Toast = { id: number; text: string; kind: RideEventKind; at: number };

const DRUNK_LABELS: [number, string][] = [
  [0, 'Tỉnh táo'],
  [16, 'Ngà ngà'],
  [45, 'Say'],
  [75, 'Xỉn quắc cần câu'],
];
const drunkLabel = (value: number) => [...DRUNK_LABELS].reverse().find(([min]) => value >= min)![1];

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};

// ---------------------------------------------------------------- speedometer

const DIAL_MAX = 80;
const START = -225;
const SWEEP = 270;
const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r] as const;
};
const arc = (r: number, from: number, to: number) => {
  const [x1, y1] = polar(r, from);
  const [x2, y2] = polar(r, to);
  return `M${x1} ${y1} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};

const Speedometer: React.FC<{ t: RideTelemetry }> = ({ t }) => {
  const speed = Math.min(DIAL_MAX, t.speedKmh);
  const needle = START + (speed / DIAL_MAX) * SWEEP;
  const [nx, ny] = polar(70, needle);
  const rpmEnd = START + Math.max(0.001, t.rpm) * SWEEP;
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)]" data-testid="ride-speedometer">
      <defs>
        <radialGradient id="dialFace" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#1f2937" />
          <stop offset="1" stopColor="#030712" />
        </radialGradient>
        <linearGradient id="rpmGrad" x1="0" x2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.7" stopColor="#facc15" />
          <stop offset="1" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill="url(#dialFace)" stroke="#52525b" strokeWidth="3" />
      {/* RPM ring with a redline */}
      <path d={arc(88, START, START + SWEEP)} stroke="#27272a" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d={arc(88, START + SWEEP * 0.85, START + SWEEP)} stroke="#7f1d1d" strokeWidth="7" fill="none" />
      <path d={arc(88, START, rpmEnd)} stroke="url(#rpmGrad)" strokeWidth="7" fill="none" strokeLinecap="round" />
      {/* Speed ticks */}
      {Array.from({ length: DIAL_MAX / 5 + 1 }, (_, i) => {
        const deg = START + (i / (DIAL_MAX / 5)) * SWEEP;
        const major = i % 2 === 0;
        const [x1, y1] = polar(major ? 70 : 74, deg);
        const [x2, y2] = polar(79, deg);
        const [lx, ly] = polar(58, deg);
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={i * 5 > 60 ? '#f87171' : '#e5e7eb'} strokeWidth={major ? 2.4 : 1.2} />
            {major && (
              <text x={lx} y={ly + 4} textAnchor="middle" fontSize="11" fontWeight={800} fill="#d4d4d8">
                {i * 5}
              </text>
            )}
          </g>
        );
      })}
      {/* Needle */}
      <line x1="100" y1="100" x2={nx} y2={ny} stroke="#f97316" strokeWidth="3.2" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px #f97316)' }} />
      <circle cx="100" cy="100" r="7" fill="#18181b" stroke="#f97316" strokeWidth="2" />
      {/* Digital readout and gear */}
      <text x="100" y="140" textAnchor="middle" fontSize="30" fontWeight={900} fill="#ffffff" fontFamily="ui-monospace, monospace">
        {Math.round(t.speedKmh)}
      </text>
      <text x="100" y="153" textAnchor="middle" fontSize="9" fontWeight={700} fill="#a1a1aa">
        km/h
      </text>
      <rect x="84" y="160" width="32" height="22" rx="5" fill="#0c0a09" stroke="#3f3f46" />
      <text x="100" y="177" textAnchor="middle" fontSize="16" fontWeight={900} fill={t.engineOn ? '#4ade80' : '#52525b'}>
        {t.engineOn ? (t.speedKmh < 0.5 ? 'N' : t.gear) : '–'}
      </text>
      <text x="100" y="72" textAnchor="middle" fontSize="8" fontWeight={800} fill="#71717a">
        RPM ×1000
      </text>
    </svg>
  );
};

const Lamp: React.FC<{ on: boolean; color: string; label: string; title: string }> = ({ on, color, label, title }) => (
  <span
    title={title}
    className="flex h-7 min-w-7 items-center justify-center rounded-md border px-1 text-[11px] font-black transition"
    style={{
      borderColor: on ? color : '#3f3f46',
      color: on ? '#0a0a0a' : '#52525b',
      background: on ? color : 'rgba(9,9,11,0.8)',
      boxShadow: on ? `0 0 12px ${color}` : 'none',
    }}
  >
    {label}
  </span>
);

// ---------------------------------------------------------------- minimap

const Minimap: React.FC<{ outline: { x: number; z: number }[]; t: RideTelemetry }> = ({ outline, t }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const size = canvas.width;
    const scale = size / 260; // ~130 m around the rider
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(9,9,11,0.85)';
    ctx.fillRect(0, 0, size, size);
    // Heading-up: rotate the world around the rider.
    ctx.translate(size / 2, size / 2 + size * 0.12);
    ctx.rotate(t.heading + Math.PI);
    ctx.scale(-scale, scale);
    ctx.translate(-t.x, -t.z);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 12;
    ctx.beginPath();
    outline.forEach((p, i) => (i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z)));
    ctx.stroke();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.stroke();
    const end = outline[outline.length - 1];
    const start = outline[0];
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(end.x, end.z, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(start.x, start.z, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5e7eb';
    t.traffic.forEach((v) => {
      ctx.beginPath();
      ctx.arc(v.x, v.z, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    // The rider: an arrow pointing up.
    ctx.save();
    ctx.translate(size / 2, size / 2 + size * 0.12);
    ctx.fillStyle = '#22c55e';
    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }, [outline, t]);
  return <canvas ref={ref} width={170} height={170} className="h-full w-full" data-testid="ride-minimap" />;
};

// ---------------------------------------------------------------- lab

export const RideLab: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<RideWorld | null>(null);
  const [telemetry, setTelemetry] = useState<RideTelemetry | null>(null);
  const [outline, setOutline] = useState<{ x: number; z: number }[]>([]);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState('');
  const [bikeId, setBikeId] = useState(RIDE_BIKES[0].id);
  const [cameraMode, setCameraMode] = useState<CameraMode>('tpp');
  const [alcohol, setAlcohol] = useState(0);
  const [trafficOn, setTrafficOn] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [crashFlash, setCrashFlash] = useState(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let world: RideWorld;
    try {
      world = createRideWorld(mount);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    worldRef.current = world;
    setOutline(world.routeOutline);
    world.onFps = setFps;
    world.onCameraChange = setCameraMode;
    let id = 0;
    world.onEvent = (text, kind) => {
      const toast = { id: ++id, text, kind, at: performance.now() };
      setToasts((list) => [...list.slice(-3), toast]);
      if (kind === 'crash') setCrashFlash(performance.now());
    };
    const poll = window.setInterval(() => {
      setTelemetry(world.telemetry());
      setToasts((list) => list.filter((t) => performance.now() - t.at < 3800));
    }, 50);
    return () => {
      window.clearInterval(poll);
      world.dispose();
      worldRef.current = null;
    };
  }, []);

  useEffect(() => worldRef.current?.setBike(bikeId), [bikeId]);
  useEffect(() => worldRef.current?.setCamera(cameraMode), [cameraMode]);
  useEffect(() => worldRef.current?.setAlcohol(alcohol), [alcohol]);
  useEffect(() => worldRef.current?.setTraffic(trafficOn), [trafficOn]);

  const t = telemetry;
  const spec = RIDE_BIKES.find((b) => b.id === bikeId)!;
  const drunk = Math.max(0, (alcohol - 15) / 85);
  const pill = (active: boolean) =>
    `px-2 py-1 rounded-lg text-xs font-black border transition ${
      active ? 'bg-amber-400 text-zinc-950 border-amber-200' : 'bg-zinc-900 text-amber-100 border-zinc-700'
    }`;
  const toastColor: Record<RideEventKind, string> = {
    info: 'border-zinc-600 bg-zinc-900/90 text-zinc-100',
    warn: 'border-amber-400 bg-amber-950/90 text-amber-100',
    crash: 'border-rose-500 bg-rose-950/90 text-rose-100',
    success: 'border-emerald-400 bg-emerald-950/90 text-emerald-100',
  };

  return (
    <div className="flex flex-col md:flex-row gap-3 h-full min-h-0">
      <div className="relative flex-1 min-h-[360px] rounded-2xl overflow-hidden border-2 border-zinc-800 bg-black select-none" tabIndex={0}>
        <div ref={mountRef} className="absolute inset-0" data-testid="ride-canvas" />

        {/* Drunk vignette and crash flash */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity"
          style={{ opacity: drunk, background: 'radial-gradient(ellipse at center, transparent 45%, rgba(88,28,135,0.55) 100%)', backdropFilter: drunk > 0.3 ? 'blur(0.4px)' : undefined }}
        />
        <div
          key={crashFlash}
          className="pointer-events-none absolute inset-0 animate-[pulse_0.6s_ease-out_1]"
          style={{ background: t?.crashed ? 'radial-gradient(ellipse at center, transparent 40%, rgba(220,38,38,0.6) 100%)' : 'transparent' }}
        />

        {error && <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm font-bold text-rose-300">❌ {error}</p>}

        {t && (
          <>
            {/* Top: route progress, zone, timer */}
            <div className="pointer-events-none absolute left-1/2 top-2 w-[min(560px,92%)] -translate-x-1/2 rounded-xl bg-black/65 px-3 py-2 backdrop-blur-sm">
              <div className="flex items-center justify-between text-[11px] font-black">
                <span className="text-sky-300">🏠 Nhà</span>
                <span className="text-zinc-300">
                  {t.zone} • còn {Math.round(t.distanceLeft)} m
                </span>
                <span className="text-rose-300">Quán ốc 🍻</span>
              </div>
              <div className="relative mt-1.5 h-2 rounded-full bg-zinc-800">
                <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-400 via-amber-400 to-rose-500" style={{ width: `${t.progress * 100}%` }} />
                <div className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-emerald-400" style={{ left: `${t.progress * 100}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] font-bold text-zinc-400">
                <span>⏱ {formatTime(t.elapsed)}</span>
                <span>Kỷ lục: {t.bestTime === null ? '—' : formatTime(t.bestTime)}</span>
              </div>
            </div>

            {/* Toasts */}
            <div className="pointer-events-none absolute left-1/2 top-24 flex w-[min(460px,90%)] -translate-x-1/2 flex-col items-center gap-1.5">
              {toasts.map((toast) => (
                <div key={toast.id} className={`rounded-xl border px-3 py-1.5 text-center text-xs font-black shadow-lg ${toastColor[toast.kind]}`}>
                  {toast.text}
                </div>
              ))}
            </div>

            {/* Start hint */}
            {!t.engineOn && (
              <div className="pointer-events-none absolute bottom-48 left-1/2 -translate-x-1/2 rounded-xl bg-black/70 px-4 py-2 text-center text-xs font-black text-amber-200">
                Nhấn <kbd className="rounded bg-zinc-700 px-1.5">E</kbd> đạp nổ máy ({t.kickCount}/{t.kicksNeeded}) • <kbd className="rounded bg-zinc-700 px-1.5">F</kbd> gạt chân chống •{' '}
                <kbd className="rounded bg-zinc-700 px-1.5">W</kbd> vặn ga
              </div>
            )}
            {t.engineOn && t.kickstandDown && (
              <div className="pointer-events-none absolute bottom-48 left-1/2 -translate-x-1/2 animate-pulse rounded-xl border border-rose-500 bg-rose-950/80 px-4 py-1.5 text-xs font-black text-rose-100">
                ⚠️ Chưa gạt chân chống! Nhấn [F]
              </div>
            )}

            {/* Finish */}
            {t.finished && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="rounded-3xl border-2 border-emerald-400 bg-zinc-950/90 px-8 py-6 text-center">
                  <p className="text-4xl">🅿️🍻</p>
                  <p className="mt-2 font-neon text-2xl text-emerald-300">Tới quán rồi!</p>
                  <p className="mt-1 text-sm text-zinc-300">Thời gian: {formatTime(t.elapsed)}</p>
                  <button onClick={() => worldRef.current?.reset()} className="mt-3 rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-zinc-950">
                    Chạy lại [R]
                  </button>
                </div>
              </div>
            )}

            {/* Bottom-left: minimap */}
            <div className="pointer-events-none absolute bottom-3 left-3 h-[150px] w-[150px] md:h-[170px] md:w-[170px]">
              <Minimap outline={outline} t={t} />
            </div>

            {/* Bottom-right: cluster */}
            <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
              <div className="flex gap-1">
                <Lamp on={t.signal === 'left' && t.blinkOn} color="#22c55e" label="◀" title="Xi-nhan trái [Z]" />
                <Lamp on={t.engineOn} color="#4ade80" label="⚙" title="Máy" />
                <Lamp on={t.kickstandDown && t.blinkOn} color="#ef4444" label="P" title="Chân chống [F]" />
                <Lamp on={t.braking} color="#f87171" label="(!)" title="Phanh" />
                <Lamp on={t.horn} color="#facc15" label="📯" title="Còi [H]" />
                <Lamp on={t.signal === 'right' && t.blinkOn} color="#22c55e" label="▶" title="Xi-nhan phải [C]" />
              </div>
              <div className="h-[170px] w-[170px] md:h-[200px] md:w-[200px]">
                <Speedometer t={t} />
              </div>
            </div>

            <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              {fps} FPS
            </div>
          </>
        )}
      </div>

      {/* Lab controls */}
      <div className="md:w-72 shrink-0 space-y-3 overflow-y-auto text-sm">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">Chọn xe</span>
          <div className="mt-1 space-y-1.5">
            {RIDE_BIKES.map((b) => (
              <button
                key={b.id}
                onClick={() => setBikeId(b.id)}
                className={`w-full rounded-xl border px-2.5 py-1.5 text-left transition ${
                  bikeId === b.id ? 'border-amber-400 bg-amber-400/10' : 'border-zinc-800 bg-zinc-900/70 hover:border-amber-400/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-amber-100">{b.name}</span>
                  <span className="h-3 w-3 rounded-full border border-white/40" style={{ background: b.color }} />
                </div>
                <p className="text-[10px] text-zinc-400">
                  {b.subtitle} • {b.gearTopKmh[b.gearTopKmh.length - 1]} km/h • {b.kickstartsNeeded} lần đạp
                </p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">Camera [V]</span>
          <div className="mt-1 flex gap-1.5">
            <button className={pill(cameraMode === 'tpp')} onClick={() => setCameraMode('tpp')}>
              Sau lưng
            </button>
            <button className={pill(cameraMode === 'fpp')} onClick={() => setCameraMode('fpp')}>
              Góc nhìn lái
            </button>
          </div>
        </div>

        <label className="block">
          <span className="flex justify-between text-[11px] font-black uppercase tracking-wider text-amber-300">
            <span>Độ say</span>
            <span className="normal-case text-amber-100">
              {alcohol} • {drunkLabel(alcohol)}
            </span>
          </span>
          <input type="range" min={0} max={100} value={alcohol} onChange={(e) => setAlcohol(Number(e.target.value))} className="w-full accent-rose-500" />
          <span className="text-[10px] text-zinc-500">
            Tay lái lệch theo nhịp thở, phản xạ trễ {t?.inputLagMs ?? 0} ms, nhòe mắt, CSGT thổi phạt.
          </span>
        </label>

        <label className="flex items-center gap-2 text-xs font-bold text-zinc-200">
          <input type="checkbox" checked={trafficOn} onChange={(e) => setTrafficOn(e.target.checked)} />
          Xe cộ lưu thông
        </label>

        <button
          onClick={() => worldRef.current?.reset()}
          className="w-full rounded-lg border border-amber-500/60 py-1.5 text-xs font-black text-amber-200 hover:bg-amber-500/10"
        >
          ↺ Về đầu hẻm [R]
        </button>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-fuchsia-300">Thông số (debug)</span>
          {t && (
            <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
              <dt className="text-zinc-500">Tốc độ</dt>
              <dd className="font-mono text-zinc-200">{t.speedKmh.toFixed(1)} km/h</dd>
              <dt className="text-zinc-500">Số / vòng tua</dt>
              <dd className="font-mono text-zinc-200">
                {t.gear} / {Math.round(t.rpm * 100)}%
              </dd>
              <dt className="text-zinc-500">Nghiêng</dt>
              <dd className="font-mono text-zinc-200">{t.leanDeg.toFixed(1)}° (tối đa {spec.maxLeanDeg}°)</dd>
              <dt className="text-zinc-500">Lệch tâm đường</dt>
              <dd className="font-mono text-zinc-200">
                {t.lateral.toFixed(2)} / ±{t.roadHalfWidth.toFixed(1)} m
              </dd>
              <dt className="text-zinc-500">Mặt đường</dt>
              <dd className="text-zinc-200">{t.surface}</dd>
              <dt className="text-zinc-500">Khu vực</dt>
              <dd className="text-zinc-200">{t.zone}</dd>
              <dt className="text-zinc-500">FPS</dt>
              <dd className="font-mono text-zinc-200">{fps}</dd>
            </dl>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 text-[11px] leading-relaxed text-zinc-300">
          <span className="text-[11px] font-black uppercase tracking-wider text-sky-300">Phím</span>
          <p>
            <b>E</b> đạp nổ máy • <b>F</b> chân chống • <b>W/↑</b> ga • <b>S/↓/Space</b> phanh • <b>A D / ← →</b> lái
          </p>
          <p>
            <b>Z / C</b> xi-nhan trái/phải • <b>X</b> tắt • <b>H</b> còi • <b>V</b> camera • <b>R</b> chạy lại
          </p>
          <p className="mt-1 text-zinc-500">Bấm vào khung 3D trước khi lái. Tới vạch vôi trước quán thì giảm tốc dưới 8 km/h để đỗ.</p>
        </div>
      </div>
    </div>
  );
};
