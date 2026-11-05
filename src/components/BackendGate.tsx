import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, RefreshCw, ShieldCheck, Terminal, WifiOff, Wrench } from 'lucide-react';
import { sound } from '../game/audio';

interface ServiceStatus {
  configured: boolean;
  connected: boolean;
  mode?: string;
  error?: string;
}

interface StatusResponse {
  ready: boolean;
  database: { mongodb: ServiceStatus; redis: ServiceStatus };
  gemini?: { configured: boolean };
}

type GateState =
  | { kind: 'checking' }
  | { kind: 'ready' }
  | {
      kind: 'down';
      /** false = couldn't even reach the game server's /api/status */
      serverReachable: boolean;
      serverError?: string;
      mongodb?: ServiceStatus;
      redis?: ServiceStatus;
      geminiConfigured?: boolean;
    };

const RETRY_SECONDS = 12;

// Incident stories from the mockup. The default one is picked from the REAL failure cause;
// the "Đổi lý do rớt mạng" buttons only change the story shown, not the connection state.
const SERVER_OUTAGE_REASONS = [
  {
    id: 'DOG_ATE_CABLE',
    code: 'ERR_CAU_VANG_CAN_CAP_503',
    title: 'Cậu Vàng Cắn Đứt Dây Cáp Quang Quán!',
    desc: 'Con chó cỏ dưới gầm bàn tưởng dây mạng LAN là khúc dồi trường nên đã nhai đứt làm đôi.',
    fixer: 'Thằng nhỏ phục vụ đang lấy băng keo đen quấn lại dây mạng...',
    icon: '🐕🔌',
  },
  {
    id: 'POWER_OUTAGE',
    code: 'ERR_QUAN_CUP_DIEN_502',
    title: 'Quán Tư Đực Bị Cúp Điện Cầu Dao Tổng!',
    desc: 'Anh kéo loa kẹo kéo cắm nhờ ổ điện công suất lớn làm nổ cầu chì cả dãy phố nhậu bờ kè.',
    fixer: 'Bà Chủ Quán đang cầm đèn pin đi gạt lại cầu dao tổng...',
    icon: '⚡🕯️',
  },
  {
    id: 'POLICE_CONFISCATED',
    code: 'ERR_PHUONG_THU_ROUTER_408',
    title: 'Đội Trật Tự Phường Thu Luôn Cục Wifi!',
    desc: 'Lúc nãy bê bàn inox chạy lùi vào vạch sơn trắng quên bê theo cục Router để ngoài vỉa hè.',
    fixer: 'Đang phát tạm 4G từ điện thoại Nokia của Bà Chủ Quán...',
    icon: '🚨📡',
  },
  {
    id: 'MONGO_CHOKED_BEER',
    code: 'ERR_MONGODB_SAC_BIA_504',
    title: 'Server MongoDB Bị Đổ Bia Vào Thùng Máy!',
    desc: 'Ai đó vừa lật bàn Inox làm văng nửa ca bia tươi thẳng vào quạt tản nhiệt của Game Server.',
    fixer: 'Kỹ sư bờ kè đang lấy khăn lạnh ướp đá lau khô bo mạch...',
    icon: '🍺🖥️',
  },
];

/** Index of the story that matches what actually failed. */
function reasonIndexFor(s: Extract<GateState, { kind: 'down' }>): number {
  if (!s.serverReachable) return 1; // cúp điện: server không phản hồi
  if (s.mongodb?.configured === false || s.redis?.configured === false) return 2; // chưa có cấu hình
  if (!s.mongodb?.connected) return 3; // MongoDB
  return 0; // Redis
}

const timeNow = () => new Date().toLocaleTimeString('vi-VN', { hour12: false });

/**
 * Blocks the game until the backend (MongoDB + Redis) is reachable.
 * There is no offline / in-memory mode: if the server can't connect, the player sees why.
 */
export const BackendGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GateState>({ kind: 'checking' });
  const [checking, setChecking] = useState(false);
  // Once the game has loaded, an outage overlays it instead of unmounting the match
  const [wasReady, setWasReady] = useState(false);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(RETRY_SECONDS);
  const [routerSlapCount, setRouterSlapCount] = useState(0);
  const [outageReasonIdx, setOutageReasonIdx] = useState(0);
  const userPickedReason = useRef(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showTechLogs, setShowTechLogs] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);
  // "Búng nắp bia" mini-game to pass the time (score is just for fun, nothing is saved)
  const [miniCapScore, setMiniCapScore] = useState(0);
  const [capTargetX, setCapTargetX] = useState(52);
  const [capShotState, setCapShotState] = useState<'IDLE' | 'HIT' | 'MISS'>('IDLE');
  const inFlight = useRef(false);

  const log = useCallback((line: string) => {
    setLogs((prev) => [...prev.slice(-7), `[${timeNow()}] ${line}`]);
  }, []);

  const check = useCallback(
    async (source: 'auto' | 'manual' | 'slap' = 'auto') => {
      if (inFlight.current) return;
      inFlight.current = true;
      setChecking(true);
      const started = performance.now();
      try {
        const res = await fetch('/api/status', { cache: 'no-store' });
        const latency = Math.round(performance.now() - started);
        setPingMs(latency);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as StatusResponse;
        if (data.ready) {
          if (source !== 'auto' || state.kind === 'down') {
            log(`✅ Đã kết nối lại Quán Tư Đực (Ping ${latency}ms)`);
            sound.playBottleOpen();
          }
          setState({ kind: 'ready' });
          setWasReady(true);
          setRouterSlapCount(0);
          userPickedReason.current = false;
        } else {
          const { mongodb, redis } = data.database;
          log(
            `❌ /api/status (Ping ${latency}ms) → MongoDB: ${mongodb.connected ? 'OK' : mongodb.error || 'lỗi'} • Redis: ${
              redis.connected ? 'OK' : redis.error || 'lỗi'
            }`
          );
          const next = {
            kind: 'down' as const,
            serverReachable: true,
            mongodb,
            redis,
            geminiConfigured: data.gemini?.configured,
          };
          if (!userPickedReason.current) setOutageReasonIdx(reasonIndexFor(next));
          setState(next);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'lỗi mạng';
        setPingMs(null);
        log(`❌ Không gọi được máy chủ game: ${message}`);
        const next = { kind: 'down' as const, serverReachable: false, serverError: message };
        if (!userPickedReason.current) setOutageReasonIdx(reasonIndexFor(next));
        setState(next);
      } finally {
        inFlight.current = false;
        setChecking(false);
        setCountdown(RETRY_SECONDS);
      }
    },
    [log, state.kind]
  );

  // First check on load
  useEffect(() => {
    check('auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While down: count down and auto-retry. While up: quietly re-check every 20s.
  useEffect(() => {
    if (state.kind === 'checking') return;
    if (state.kind === 'ready') {
      const id = window.setTimeout(() => check('auto'), 20000);
      return () => clearTimeout(id);
    }
    const id = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          log(`🔄 Auto-Retry: Đang gõ cửa lại Quán Tư Đực...`);
          check('auto');
          return RETRY_SECONDS;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state.kind, check, log]);

  // Same tree shape in both branches so the match isn't remounted when the overlay appears
  if (state.kind === 'ready') {
    return (
      <>
        {children}
        {null}
      </>
    );
  }

  if (state.kind === 'checking') {
    return (
      <>
        {wasReady ? children : null}
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950 text-amber-200">
          <div className="flex items-center gap-3 font-black">
            <RefreshCw className="h-5 w-5 animate-spin text-amber-400" />
            Đang gõ cửa Quán Tư Đực…
          </div>
        </div>
      </>
    );
  }

  const reason = SERVER_OUTAGE_REASONS[outageReasonIdx];
  const serverOk = state.serverReachable;
  const mongoOk = Boolean(state.mongodb?.connected);
  const redisOk = Boolean(state.redis?.connected);
  // 4 bars like the mockup, but driven by what really answers: server, Mongo, Redis (4th = all good)
  const wifiSignalBars = (serverOk ? 1 : 0) + (mongoOk ? 1 : 0) + (redisOk ? 1 : 0);

  const handleSlapRouter = () => {
    sound.playSlap();
    const nextSlaps = routerSlapCount + 1;
    setRouterSlapCount(nextSlaps);
    log(`👋 Đã vỗ bốp vào cục Router lần #${nextSlaps} -> Thử kết nối lại...`);
    check('slap');
  };

  const handleManualReconnect = () => {
    sound.playBottleOpen();
    log('🚀 Đang cắm lại dây mạng LAN & gọi lại máy chủ...');
    check('manual');
  };

  const handleOfflineNpc = () => {
    sound.playHiccup();
    setComingSoon(true);
    log('🤖 Nhậu Offline với 3 NPC: tính năng đang phát triển (Coming soon)');
    window.setTimeout(() => setComingSoon(false), 3200);
  };

  const handleFlickBottleCapGame = (aimZone: number) => {
    if (Math.abs(aimZone - capTargetX) <= 22) {
      sound.playClink();
      setCapShotState('HIT');
      setMiniCapScore((s) => s + 1);
    } else {
      sound.playUiHover();
      setCapShotState('MISS');
    }
    window.setTimeout(() => {
      setCapShotState('IDLE');
      setCapTargetX(Math.floor(20 + Math.random() * 62));
    }, 550);
  };

  const services: { name: string; status: 'ONLINE' | 'DEGRADED' | 'DOWN'; detail: string }[] = [
    {
      name: 'Game Server (HTTP API)',
      status: serverOk ? 'ONLINE' : 'DOWN',
      detail: serverOk ? `Ping ${pingMs ?? '—'}ms` : 'Không phản hồi',
    },
    {
      name: 'MongoDB (`users`, `rooms`, BXH)',
      status: mongoOk ? 'ONLINE' : 'DOWN',
      detail: !serverOk
        ? 'Không rõ'
        : mongoOk
        ? 'Đã kết nối'
        : state.mongodb?.configured === false
        ? 'Chưa cấu hình'
        : 'Mất kết nối',
    },
    {
      name: `Redis${state.redis?.mode ? ` ${state.redis.mode.toUpperCase()}` : ''} (Phiên & Ghế Ngồi)`,
      status: redisOk ? 'ONLINE' : 'DOWN',
      detail: !serverOk
        ? 'Không rõ'
        : redisOk
        ? 'Đã kết nối'
        : state.redis?.configured === false
        ? 'Chưa cấu hình'
        : `Thử lại sau ${countdown}s`,
    },
    {
      name: 'Gemini AI (Thật Hay Thách)',
      status: !serverOk ? 'DOWN' : state.geminiConfigured ? 'ONLINE' : 'DEGRADED',
      detail: !serverOk ? 'Không rõ' : state.geminiConfigured ? 'Sẵn sàng' : 'Dùng câu hỏi dự phòng',
    },
  ];
  const downCount = services.filter((s) => s.status === 'DOWN').length;

  return (
    <>
      {wasReady ? children : null}
      <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto text-amber-50">
        <div className="relative w-full max-w-4xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-4 border-rose-500 rounded-3xl p-4 sm:p-6 shadow-[0_0_80px_rgba(225,29,72,0.75)] my-auto">
          {/* Dải băng cảnh báo góc trên */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/35 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 animate-pulse">
                <WifiOff className="w-3.5 h-3.5" /> MẤT KẾT NỐI MÁY CHỦ BÀN NHẬU
              </span>
              <span className="font-mono text-xs font-black text-amber-300 bg-slate-950 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                {reason.code}
              </span>
            </div>

            {/* Đổi thử các kịch bản lỗi Server khác nhau */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400">Đổi lý do rớt mạng:</span>
              {SERVER_OUTAGE_REASONS.map((r, idx) => (
                <button
                  key={r.id}
                  onClick={() => {
                    sound.playUiHover();
                    userPickedReason.current = true;
                    setOutageReasonIdx(idx);
                  }}
                  className={`px-2 py-1 rounded-lg text-xs font-black border transition ${
                    outageReasonIdx === idx
                      ? 'bg-amber-400 text-slate-950 border-white scale-105'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400'
                  }`}
                  title={r.title}
                >
                  {r.icon}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* CỘT TRÁI (7 CỘT): MINH HỌA SỰ CỐ + VỖ CỤC ROUTER */}
            <div className="lg:col-span-7 flex flex-col justify-between bg-slate-950/90 border border-rose-500/30 rounded-2xl p-4">
              <div>
                <div className="relative bg-slate-900/90 border border-slate-800 rounded-2xl p-3 mb-3 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative w-28 h-24 shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 160 120" className="w-full h-full">
                      <path d="M 8 75 Q 40 60 62 75" fill="none" stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" />
                      <path d="M 98 75 Q 120 90 152 72" fill="none" stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" />
                      <polygon points="78,48 70,70 84,70 74,95 96,66 82,66" fill="#facc15" className="animate-ping" />
                      <rect x="46" y="18" width="68" height="22" rx="6" fill="#1e293b" stroke="#f43f5e" strokeWidth="2.5" />
                      <line x1="58" y1="18" x2="48" y2="3" stroke="#94a3b8" strokeWidth="3.5" />
                      <line x1="102" y1="18" x2="112" y2="3" stroke="#94a3b8" strokeWidth="3.5" />
                      <circle cx="62" cy="29" r="3.5" fill="#ef4444" className="animate-ping" />
                      <circle cx="76" cy="29" r="3.5" fill="#f59e0b" />
                      <circle cx="90" cy="29" r="3.5" fill={wifiSignalBars >= 3 ? '#10b981' : '#ef4444'} />
                    </svg>
                    <span className="absolute -bottom-1 right-0 text-2xl animate-bounce">{reason.icon}</span>
                  </div>

                  <div className="text-left flex-1">
                    <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider">
                      BÁO CÁO SỰ CỐ TỪ BÀN NHẬU:
                    </span>
                    <h2 className="text-lg sm:text-xl font-black text-white leading-snug mt-0.5">{reason.title}</h2>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{reason.desc}</p>
                    <p className="text-[11px] text-amber-300 font-bold mt-1.5 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>{reason.fixer}</span>
                    </p>
                  </div>
                </div>

                {/* TƯƠNG TÁC ĐẶC BIỆT: "VỖ CỤC ROUTER WIFI CHO LÊN SÓNG" (mỗi cái vỗ = thử kết nối lại thật) */}
                <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-3 mb-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-end gap-1 h-9 px-2.5 py-1.5 bg-slate-950 rounded-xl border border-slate-700">
                      {[1, 2, 3, 4].map((bar) => (
                        <div
                          key={bar}
                          style={{ height: `${bar * 23}%` }}
                          className={`w-2 rounded-sm transition-all ${
                            wifiSignalBars >= bar
                              ? wifiSignalBars >= 3
                                ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                                : 'bg-amber-400'
                              : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-amber-300 uppercase">
                          📡 SÓNG WIFI QUÁN TƯ ĐỰC: {wifiSignalBars}/4 VẠCH
                        </span>
                        <span className="font-mono text-[10px] bg-rose-950 text-rose-300 border border-rose-500/40 px-1.5 rounded">
                          Ping: {pingMs != null ? `${pingMs}ms` : '999ms'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Mẹo dân gian: Đập nhẹ vào cục Router — mỗi cái là một lần <b>thử kết nối lại</b>!
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleSlapRouter}
                    disabled={checking}
                    className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs shadow-lg flex items-center justify-center gap-1.5 shrink-0 transition disabled:opacity-70"
                  >
                    <span>👋 VỖ BỐP CỤC WIFI ({Math.min(routerSlapCount, 4)}/4)</span>
                  </button>
                </div>
              </div>

              {/* CÁC NÚT HÀNH ĐỘNG CHÍNH */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={handleManualReconnect}
                    disabled={checking}
                    className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm shadow-[0_4px_0_#065f46] active:translate-y-0.5 transition flex items-center justify-center gap-2 disabled:opacity-80"
                  >
                    <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                    <span>{checking ? 'ĐANG CẮM LẠI DÂY MẠNG...' : `CẮM LẠI DÂY MẠNG NGAY (${countdown}s)`}</span>
                  </button>

                  <div className="relative">
                    <button
                      onClick={handleOfflineNpc}
                      className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm shadow-[0_4px_0_#9a3412] active:translate-y-0.5 transition flex items-center justify-center gap-2"
                    >
                      <Bot className="w-4 h-4" />
                      <span>NHẬU TẠM VỚI 3 NPC (OFFLINE)</span>
                    </button>
                    {comingSoon && (
                      <div className="absolute -top-11 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-white bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 px-4 py-1.5 text-xs font-black text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.8)] animate-bounce">
                        🚧 COMING SOON — Sắp ra mắt!
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                  <span className="flex items-center gap-1.5 text-emerald-300 font-bold">
                    <ShieldCheck className="w-4 h-4" /> Hộ chiếu & nắp bia của bạn vẫn nằm an toàn trên MongoDB!
                  </span>
                  <button
                    onClick={() => setShowTechLogs((v) => !v)}
                    className="text-amber-300 hover:underline font-bold flex items-center gap-1"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>{showTechLogs ? 'Ẩn Log Kỹ Thuật' : 'Xem Log Kỹ Thuật'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI (5 CỘT): MINIGAME "BÚNG NẮP BIA CHỜ MẠNG" + TRẠNG THÁI BACKEND */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-3 bg-slate-950/90 border border-amber-500/35 rounded-2xl p-4">
              <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase text-amber-300 flex items-center gap-1">
                    🎯 MINIGAME CHỜ MẠNG: BÚNG NẮP BIA VÀO XÔ ĐÁ
                  </span>
                  <span className="text-[11px] font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                    Trúng: {miniCapScore}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2.5">
                  Trong lúc chờ thằng nhỏ nối lại dây cáp, canh vị trí <b>Xô Đá Inox 🪣</b> rồi bấm búng nắp bia cho đỡ buồn!
                </p>

                <div className="relative h-24 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden mb-2.5 flex flex-col justify-between p-2">
                  <div
                    style={{ left: `${capTargetX}%` }}
                    className="absolute top-2 -translate-x-1/2 transition-all duration-300 flex flex-col items-center"
                  >
                    <div className="px-2.5 py-1 rounded-b-xl bg-slate-300 text-slate-950 font-black text-xs border-2 border-white shadow">
                      🪣 XÔ ĐÁ
                    </div>
                  </div>

                  {capShotState !== 'IDLE' && (
                    <div className="m-auto z-10 px-3 py-1 rounded-full text-xs font-black animate-bounce bg-slate-900/95 border border-amber-400">
                      {capShotState === 'HIT' ? (
                        <span className="text-emerald-400">🎉 LỌT TỎM VÀO XÔ ĐÁ!</span>
                      ) : (
                        <span className="text-rose-400">💨 TRƯỢT RỒI! Văng trúng đầu Cậu Vàng!</span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto text-center text-[10px] font-bold text-amber-300/80">
                    🪙 Chọn hướng búng nắp bia bên dưới:
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '↖ Búng Trái', zone: 25 },
                    { label: '⬆ Búng Giữa', zone: 50 },
                    { label: '↗ Búng Phải', zone: 75 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      onClick={() => handleFlickBottleCapGame(btn.zone)}
                      className="py-2 rounded-xl bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-amber-200 font-black text-xs border border-amber-500/30 transition active:scale-95"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* BẢNG CHẨN ĐOÁN HẠ TẦNG (trạng thái thật từ /api/status) */}
              <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3 text-xs space-y-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 border-b border-slate-800 pb-1.5">
                  <span>🖧 TRẠNG THÁI HẠ TẦNG QUÁN NHẬU</span>
                  <span className={downCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                    {downCount}/4 DỊCH VỤ ĐỨT
                  </span>
                </div>

                {services.map((srv) => (
                  <div
                    key={srv.name}
                    className="flex items-center justify-between bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800/80"
                  >
                    <span className="font-bold text-[11px] text-slate-200 truncate pr-2">{srv.name}</span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                        srv.status === 'ONLINE'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : srv.status === 'DEGRADED'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                      }`}
                    >
                      {srv.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CỬA SỐ TERMINAL LOG KỸ THUẬT */}
          {showTechLogs && (
            <div className="mt-4 bg-black/95 border border-rose-500/40 rounded-2xl p-3 font-mono text-[11px] text-rose-300 space-y-1 max-h-36 overflow-y-auto">
              {logs.map((line, index) => (
                <div key={index} className="leading-relaxed">
                  {line}
                </div>
              ))}
              {[state.mongodb?.error && `MongoDB: ${state.mongodb.error}`, state.redis?.error && `Redis: ${state.redis.error}`]
                .filter(Boolean)
                .map((line) => (
                  <div key={line as string} className="leading-relaxed text-amber-300">
                    {line}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
