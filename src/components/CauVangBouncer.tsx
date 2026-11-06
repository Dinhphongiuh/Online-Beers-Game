import React, { useEffect, useId, useRef, useState } from 'react';

export type BouncerCaptchaStatus = 'IDLE' | 'POURING' | 'SUCCESS' | 'OVERFLOW';

interface CauVangBouncerProps {
  isPasswordFocused: boolean;
  showPassword: boolean;
  captchaStatus: BouncerCaptchaStatus;
}

/** Normalised gaze direction, each axis in -1..1 */
interface Gaze {
  x: number;
  y: number;
}

const PUPIL_TRAVEL = 4.6; // SVG units the iris can move inside the eye
const HEAD_TRAVEL = 3; // SVG units the whole head leans toward the cursor

/**
 * "Cậu Vàng" — the golden dog bouncer at the login gate.
 * Eyes follow the mouse anywhere on screen; he covers his eyes with two beer mugs while the
 * password is typed, peeks over them when "Hé Nhìn" is on, and reacts to the beer-pour captcha.
 */
export function CauVangBouncer({ isPasswordFocused, showPassword, captchaStatus }: CauVangBouncerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [gaze, setGaze] = useState<Gaze>({ x: 0, y: 0.15 });
  const [blinking, setBlinking] = useState(false);
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `${uid}-${name}`;

  const coveringEyes = isPasswordFocused && !showPassword;
  const peeking = isPasswordFocused && showPassword;
  const shocked = captchaStatus === 'OVERFLOW';
  const happy = captchaStatus === 'SUCCESS';

  // Track the cursor anywhere on the page (rAF-throttled)
  useEffect(() => {
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = svgRef.current?.getBoundingClientRect();
        if (!r) return;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height * 0.42; // roughly eye level
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy) || 1;
        // Full deflection once the cursor is ~240px away; gentle near the face
        const strength = Math.min(1, dist / 240);
        setGaze({ x: (dx / dist) * strength, y: (dy / dist) * strength });
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  // Natural random blinking
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setBlinking(true);
        window.setTimeout(() => setBlinking(false), 130);
        schedule();
      }, 2400 + Math.random() * 3200);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  // While peeking he stares down at the password field instead of the cursor
  const look: Gaze = peeking ? { x: -0.35, y: 0.95 } : gaze;
  const pupilX = look.x * PUPIL_TRAVEL;
  const pupilY = look.y * PUPIL_TRAVEL;
  const headX = coveringEyes ? 0 : look.x * HEAD_TRAVEL;
  const headY = coveringEyes ? 2 : look.y * HEAD_TRAVEL * 0.6;
  const headTilt = coveringEyes ? 0 : look.x * 5;

  // Mug positions: resting at chest, raised over the eyes, or lowered just enough to peek
  const mugLift = coveringEyes ? 0 : peeking ? 34 : 78;
  const eyesClosedHappy = happy && !isPasswordFocused;
  const eyeScaleY = blinking && !eyesClosedHappy ? 0.08 : 1;
  const eyeOpenBig = peeking || shocked;

  const ease = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

  return (
    <div className="relative mx-auto h-36 w-36 select-none sm:h-40 sm:w-40">
      {/* Neon halo */}
      <div
        className={`absolute inset-2 rounded-full blur-2xl transition-all duration-500 ${
          shocked ? 'scale-110 bg-rose-500/50' : happy ? 'scale-110 bg-emerald-400/45' : 'bg-amber-400/35'
        }`}
      />

      <svg
        ref={svgRef}
        viewBox="0 0 200 200"
        className="relative z-10 h-full w-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]"
        aria-label="Cậu Vàng bảo vệ cổng"
        role="img"
      >
        <defs>
          <radialGradient id={id('fur')} cx="38%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fdba74" />
            <stop offset="55%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#c2410c" />
          </radialGradient>
          <linearGradient id={id('ear')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#7c2d12" />
          </linearGradient>
          <radialGradient id={id('muzzle')} cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="100%" stopColor="#fde68a" />
          </radialGradient>
          <radialGradient id={id('iris')} cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#92400e" />
            <stop offset="70%" stopColor="#451a03" />
            <stop offset="100%" stopColor="#1c0a02" />
          </radialGradient>
          <linearGradient id={id('beer')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id={id('shirt')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <clipPath id={id('eyeL')}>
            <ellipse cx="77" cy="86" rx="12" ry="13" />
          </clipPath>
          <clipPath id={id('eyeR')}>
            <ellipse cx="123" cy="86" rx="12" ry="13" />
          </clipPath>
        </defs>

        {/* Wagging tail (behind the body) */}
        <path
          d="M 150 176 Q 182 160 176 128 Q 172 144 156 158 Z"
          fill={`url(#${id('fur')})`}
          className="cauvang-tail"
        />

        {/* Body: white tank top + gold chain */}
        <path d="M 46 200 Q 46 150 100 146 Q 154 150 154 200 Z" fill={`url(#${id('fur')})`} />
        <path d="M 60 200 L 64 158 Q 100 172 136 158 L 140 200 Z" fill={`url(#${id('shirt')})`} />
        <path d="M 64 158 L 70 146 M 136 158 L 130 146" stroke="#e2e8f0" strokeWidth="6" strokeLinecap="round" />
        <path d="M 72 152 Q 100 182 128 152" fill="none" stroke="#facc15" strokeWidth="4" strokeDasharray="5 3" strokeLinecap="round" />
        <circle cx="100" cy="168" r="8" fill="#facc15" stroke="#a16207" strokeWidth="1.5" />
        <text x="100" y="171" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#78350f">9999</text>

        {/* HEAD (leans toward the cursor) */}
        <g
          style={{
            transform: `translate(${headX}px, ${headY}px) rotate(${headTilt}deg)`,
            transformOrigin: '100px 120px',
            transition: 'transform 140ms ease-out',
          }}
        >
          {/* Floppy ears */}
          <path
            d="M 52 52 Q 22 58 24 104 Q 30 122 46 112 Q 50 84 64 64 Z"
            fill={`url(#${id('ear')})`}
            style={{
              transform: coveringEyes ? 'rotate(-10deg)' : shocked ? 'rotate(14deg)' : 'rotate(0deg)',
              transformOrigin: '56px 56px',
              transition: `transform 320ms ${ease}`,
            }}
          />
          <path
            d="M 148 52 Q 178 58 176 104 Q 170 122 154 112 Q 150 84 136 64 Z"
            fill={`url(#${id('ear')})`}
            style={{
              transform: coveringEyes ? 'rotate(10deg)' : shocked ? 'rotate(-14deg)' : 'rotate(0deg)',
              transformOrigin: '144px 56px',
              transition: `transform 320ms ${ease}`,
            }}
          />

          {/* Head */}
          <ellipse cx="100" cy="92" rx="56" ry="52" fill={`url(#${id('fur')})`} />
          {/* Forehead tuft */}
          <path d="M 92 42 Q 100 30 106 42 Q 112 36 112 46 Q 100 44 92 42 Z" fill="#fb923c" />

          {/* Sunglasses pushed up on the forehead */}
          <g transform="rotate(-4 100 54)">
            <rect x="68" y="48" width="26" height="13" rx="5" fill="#0f172a" stroke="#facc15" strokeWidth="2" />
            <rect x="106" y="48" width="26" height="13" rx="5" fill="#0f172a" stroke="#facc15" strokeWidth="2" />
            <path d="M 94 53 Q 100 49 106 53" fill="none" stroke="#facc15" strokeWidth="2" />
            <line x1="72" y1="51" x2="80" y2="58" stroke="#7dd3fc" strokeWidth="1.6" opacity="0.8" />
            <line x1="110" y1="51" x2="118" y2="58" stroke="#7dd3fc" strokeWidth="1.6" opacity="0.8" />
          </g>

          {/* Eyebrows: raised when surprised */}
          <g style={{ transform: `translateY(${eyeOpenBig ? -5 : 0}px)`, transition: `transform 220ms ${ease}` }}>
            <path d="M 66 70 Q 77 64 88 69" fill="none" stroke="#7c2d12" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M 112 69 Q 123 64 134 70" fill="none" stroke="#7c2d12" strokeWidth="3.2" strokeLinecap="round" />
          </g>

          {/* Eyes */}
          {eyesClosedHappy ? (
            <g fill="none" stroke="#451a03" strokeWidth="4" strokeLinecap="round">
              <path d="M 67 88 Q 77 77 87 88" />
              <path d="M 113 88 Q 123 77 133 88" />
            </g>
          ) : (
            [
              { cx: 77, clip: id('eyeL') },
              { cx: 123, clip: id('eyeR') },
            ].map((eye) => (
              <g
                key={eye.cx}
                style={{
                  transform: `scaleY(${eyeScaleY}) scale(${eyeOpenBig ? 1.12 : 1})`,
                  transformOrigin: `${eye.cx}px 86px`,
                  transition: 'transform 90ms ease-out',
                }}
              >
                <ellipse cx={eye.cx} cy="86" rx="12" ry="13" fill="#ffffff" />
                <g clipPath={`url(#${eye.clip})`}>
                  <g
                    style={{
                      transform: `translate(${pupilX}px, ${pupilY}px)`,
                      transition: 'transform 110ms ease-out',
                    }}
                  >
                    <circle cx={eye.cx} cy="87" r={eyeOpenBig ? 6.2 : 7.4} fill={`url(#${id('iris')})`} />
                    <circle cx={eye.cx} cy="87" r={eyeOpenBig ? 2.6 : 3.6} fill="#0a0502" />
                    <circle cx={eye.cx - 2.6} cy="83.6" r="2.3" fill="#ffffff" />
                    <circle cx={eye.cx + 2.4} cy="89.6" r="1.1" fill="#ffffff" opacity="0.85" />
                  </g>
                </g>
                <ellipse cx={eye.cx} cy="86" rx="12" ry="13" fill="none" stroke="#7c2d12" strokeWidth="1.6" opacity="0.6" />
              </g>
            ))
          )}

          {/* Muzzle, blush, nose */}
          <ellipse cx="100" cy="112" rx="31" ry="23" fill={`url(#${id('muzzle')})`} />
          <ellipse cx="62" cy="106" rx="9" ry="5" fill="#f43f5e" opacity={happy ? 0.75 : 0.45} />
          <ellipse cx="138" cy="106" rx="9" ry="5" fill="#f43f5e" opacity={happy ? 0.75 : 0.45} />
          <path d="M 90 100 Q 100 95 110 100 Q 108 109 100 111 Q 92 109 90 100 Z" fill="#1e1b18" />
          <ellipse cx="96" cy="100" rx="3.4" ry="1.8" fill="#ffffff" opacity="0.65" />

          {/* Mouth by mood */}
          {shocked ? (
            <ellipse cx="100" cy="124" rx="8" ry="9" fill="#7f1d1d" stroke="#1e1b18" strokeWidth="2" />
          ) : peeking ? (
            <ellipse cx="100" cy="122" rx="5" ry="5.5" fill="#7f1d1d" stroke="#1e1b18" strokeWidth="2" />
          ) : happy || coveringEyes ? (
            <g>
              <path d="M 82 114 Q 100 138 118 114 Z" fill="#7f1d1d" stroke="#1e1b18" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M 92 124 Q 100 134 108 124 Q 100 120 92 124 Z" fill="#fb7185" />
            </g>
          ) : (
            <g>
              <path d="M 86 114 Q 93 121 100 113 Q 107 121 114 114" fill="none" stroke="#1e1b18" strokeWidth="3" strokeLinecap="round" />
              <path d="M 95 118 Q 100 129 105 118 Z" fill="#fb7185" />
            </g>
          )}

          {/* Sweat drop when the beer overflows */}
          {shocked && <path d="M 146 66 Q 152 76 146 80 Q 140 76 146 66 Z" fill="#7dd3fc" className="animate-bounce" />}
          {/* Sparkles when the pour is perfect */}
          {happy && (
            <g fill="#fde047" className="animate-pulse">
              <path d="M 38 48 l 3 7 l 7 3 l -7 3 l -3 7 l -3 -7 l -7 -3 l 7 -3 Z" />
              <path d="M 162 40 l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 Z" />
            </g>
          )}
        </g>

        {/* PAWS + BEER MUGS: rest at the chest, cover the eyes, or drop a bit to peek */}
        <g
          style={{
            transform: `translateY(${mugLift}px)`,
            transition: `transform 360ms ${ease}`,
          }}
        >
          {[
            { x: 59, handleSide: -1 },
            { x: 105, handleSide: 1 },
          ].map(({ x, handleSide }) => (
            <g key={x} transform={`translate(${x}, 68)`}>
              {/* Handle */}
              <path
                d={
                  handleSide < 0
                    ? 'M 2 10 Q -12 12 -11 24 Q -10 34 2 33'
                    : 'M 34 10 Q 48 12 47 24 Q 46 34 34 33'
                }
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.9"
              />
              {/* Glass + beer */}
              <rect x="0" y="2" width="36" height="40" rx="6" fill="#f8fafc" opacity="0.35" stroke="#f1f5f9" strokeWidth="2" />
              <rect x="3" y="9" width="30" height="30" rx="4" fill={`url(#${id('beer')})`} />
              <circle cx="11" cy="22" r="1.6" fill="#fef3c7" opacity="0.8" />
              <circle cx="24" cy="30" r="1.2" fill="#fef3c7" opacity="0.8" />
              <circle cx="19" cy="16" r="1" fill="#fef3c7" opacity="0.8" />
              {/* Foam */}
              <g fill="#ffffff">
                <circle cx="6" cy="6" r="6" />
                <circle cx="15" cy="3" r="7" />
                <circle cx="25" cy="4" r="6.5" />
                <circle cx="32" cy="7" r="5" />
              </g>
              {/* Paw wrapped around the glass, with toe beans */}
              <g transform={`translate(${handleSide < 0 ? 26 : 10}, 30)`}>
                <ellipse cx="0" cy="0" rx="12" ry="11" fill={`url(#${id('fur')})`} stroke="#c2410c" strokeWidth="1.2" />
                <ellipse cx="0" cy="3" rx="4.5" ry="3.6" fill="#fda4af" />
                <circle cx="-5" cy="-3.5" r="2" fill="#fda4af" />
                <circle cx="0" cy="-5.5" r="2" fill="#fda4af" />
                <circle cx="5" cy="-3.5" r="2" fill="#fda4af" />
              </g>
            </g>
          ))}
        </g>
      </svg>

      {/* Speech bubble */}
      <div className="mx-auto -mt-1 w-fit max-w-[260px] rounded-full border border-amber-400 bg-slate-950/95 px-3 py-0.5 text-center text-[10px] font-black leading-snug text-amber-200 shadow-lg">
        {isPasswordFocused
          ? showPassword
            ? '👀 Á đù! Mật khẩu dễ đoán thế!'
            : '🙈 Cậu Vàng đã che mắt, yên tâm gõ!'
          : shocked
          ? '💦 Rót tràn bọt hết ra bàn rồi kìa!'
          : happy
          ? '🍻 Chuẩn đét! Mời đại ca vào bàn!'
          : '🩴 Xuất trình Hộ Chiếu Tửu Lượng!'}
      </div>
    </div>
  );
}
