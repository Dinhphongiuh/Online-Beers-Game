import React, { useState, useEffect } from 'react';
import {
  Beer,
  KeyRound,
  Shirt,
  Volume2,
  VolumeX,
  Sparkles,
  Flame,
  X,
  PartyPopper,
  RotateCcw,
  AlertTriangle,
  Eye,
  EyeOff,
  Database,
  CheckCircle2,
  Copy,
  Check,
  Dices,
  LogOut,
  ShieldCheck,
  PhoneIncoming,
  Wallet
} from 'lucide-react';
import { CharacterAvatar } from '../game/types';

// ============================================================================
// 1. PROCEDURAL WEB AUDIO ENGINE (ZERO EXTERNAL MP3 DEPENDENCY)
// ============================================================================
class StreetSoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClink() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [1480, 2217, 2960].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.03);
      gain.gain.setValueAtTime(0.18, now + idx * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55 + idx * 0.05);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + idx * 0.03);
      osc.stop(now + 0.65);
    });
  }

  playPop() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playBottleCapOpen() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(1250, now + 0.06);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);

    const bufferSize = this.ctx.sampleRate * 0.22;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.5));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.18, now + 0.05);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    noise.connect(nGain);
    nGain.connect(this.ctx.destination);
    noise.start(now + 0.05);
  }

  playBuzzer() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.setValueAtTime(115, now + 0.12);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  playPouringTick(pitchFactor = 1) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280 + pitchFactor * 420, now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}

const sfx = new StreetSoundEngine();

// ============================================================================
// 2. DỮ LIỆU CẤU HÌNH NHÂN VẬT & ARCHETYPES
// ============================================================================
export interface SpeciesInfo {
  id: string;
  avatarKey: CharacterAvatar;
  name: string;
  title: string;
  emoji: string;
  bodyColor: string;
  desc: string;
}

export const SPECIES_LIST: SpeciesInfo[] = [
  {
    id: 'cau_vang',
    avatarKey: 'dog',
    name: 'Cậu Vàng',
    title: 'Hệ Nhiệt Tình',
    emoji: '🐕',
    bodyColor: '#f59e0b',
    desc: 'Áo ba lỗ trắng • Quần đùi hoa • Dép tổ ong huyền thoại',
  },
  {
    id: 'capybara',
    avatarKey: 'bear',
    name: 'Đại Ca Capy',
    title: 'Hệ Đô Bất Tử',
    emoji: '🦫',
    bodyColor: '#92400e',
    desc: 'Kính râm đen • Dây chuyền vàng 9999 • Ngồi im gắp mồi',
  },
  {
    id: 'meo_cam',
    avatarKey: 'cat',
    name: 'Hoàng Thượng',
    title: 'Hệ Lươn Lẹo',
    emoji: '🐱',
    bodyColor: '#f97316',
    desc: 'Áo sơ mi bông Hawaii • Chuyên gia nhấp môi & trốn bill',
  },
  {
    id: 'vit_vang',
    avatarKey: 'duck',
    name: 'Vịt Nón Lá',
    title: 'Tấm Chiếu Mới',
    emoji: '🦆',
    bodyColor: '#facc15',
    desc: 'Đội nón lá • Mới ngửi mùi bia đã đỏ mặt',
  },
  {
    id: 'gau_truc',
    avatarKey: 'panda',
    name: 'Gấu Tăng Ca',
    title: 'Hệ Dân Văn Phòng',
    emoji: '🐼',
    bodyColor: '#f8fafc',
    desc: 'Sơ mi trắng cà vạt • Vừa chạy deadline vừa cụng ly',
  },
];

export const DRUNK_ARCHETYPES = [
  {
    id: 'TRIET_GIA',
    name: 'Hệ Triết Gia',
    icon: '🧐',
    quote: 'Đứng lên ghế nhựa giảng đạo lý làm cả bàn buồn ngủ',
  },
  {
    id: 'VO_SI',
    name: 'Hệ Võ Sĩ',
    icon: '🥊',
    quote: 'Nhìn cột điện tưởng đối thủ, lực ném ghế nhựa x200%',
  },
  {
    id: 'HAO_PHONG',
    name: 'Hệ Hào Phóng',
    icon: '💸',
    quote: 'Cứ trên 80% cồn là tự rút ví ném xu tung tóe khắp bàn',
  },
  {
    id: 'NINJA_TRON_BILL',
    name: 'Hệ Ninja Trốn Bill',
    icon: '🥷',
    quote: 'Tàng hình lủi ra bãi giữ xe ngay khi bà chủ cầm hóa đơn ra',
  },
  {
    id: 'SUY_TINH',
    name: 'Hệ Suy Tình',
    icon: '💔',
    quote: 'Chui xuống gầm bàn khóc ròng và bấm số gọi Người Yêu Cũ',
  },
];

export const FUNNY_RANDOM_NAMES = [
  'Thần Cồn Quận 4',
  'Chúa Tể Gắp Mồi',
  'Sát Thủ Chân Gà',
  'Thánh Trốn Bill',
  'Dũng Sĩ Diệt Mồi',
  'Cậu Vàng Bờ Kè',
  'Tấm Chiếu Mới Nhậu',
  'Kiện Tướng Nhấp Môi',
  'Đại Gia Bao Chầu',
  'Chiến Thần Rượu Đế',
  'Trùm Xúc Xắc Sài Gòn',
  'Vua Lẩu Thái Tomyum'
];

// ============================================================================
// 3. MASCOT BẢO VỆ CỔNG QUÁN "CẬU VÀNG" (INTERACTIVE SVG BOUNCER GUARD)
// ============================================================================
interface CauVangBouncerProps {
  isPasswordFocused: boolean;
  showPassword: boolean;
  captchaStatus: 'IDLE' | 'POURING' | 'SUCCESS' | 'OVERFLOW';
}

function CauVangBouncerSVG({ isPasswordFocused, showPassword, captchaStatus }: CauVangBouncerProps) {
  return (
    <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto select-none">
      {/* Hào quang đèn Neon phía sau Cậu Vàng */}
      <div
        className={`absolute inset-0 rounded-full blur-xl transition-all duration-500 ${
          captchaStatus === 'OVERFLOW'
            ? 'bg-rose-500/50 scale-110'
            : captchaStatus === 'SUCCESS'
            ? 'bg-emerald-400/50 scale-110'
            : 'bg-amber-400/35'
        }`}
      />

      <svg viewBox="0 0 200 200" className="relative z-10 w-full h-full drop-shadow-xl">
        {/* Hai tai Cậu Vàng */}
        <ellipse
          cx="42"
          cy="82"
          rx="20"
          ry="36"
          transform={isPasswordFocused ? 'rotate(18 42 82)' : 'rotate(10 42 82)'}
          fill="#d97706"
          className="transition-all duration-300"
        />
        <ellipse
          cx="158"
          cy="82"
          rx="20"
          ry="36"
          transform={isPasswordFocused ? 'rotate(-18 158 82)' : 'rotate(-10 158 82)'}
          fill="#d97706"
          className="transition-all duration-300"
        />

        {/* Thân mặc Áo Ba Lỗ Trắng & Dây Chuyền Vàng 9999 */}
        <path
          d="M 48 145 Q 100 130 152 145 L 164 195 L 36 195 Z"
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth="3"
        />
        <path
          d="M 66 150 Q 100 176 134 150"
          fill="none"
          stroke="#facc15"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray="8 5"
        />

        {/* Đầu Chibi Cậu Vàng */}
        <circle cx="100" cy="92" r="54" fill="#f59e0b" />
        <ellipse cx="100" cy="108" rx="34" ry="25" fill="#fde68a" />

        {/* Hai má hồng ngà ngà say */}
        <ellipse cx="60" cy="102" rx="11" ry="6" fill="#f43f5e" opacity="0.55" />
        <ellipse cx="140" cy="102" rx="11" ry="6" fill="#f43f5e" opacity="0.55" />

        {/* Mắt & Kính Râm Đen Bảo Vệ Quán */}
        {!isPasswordFocused && (
          <g className="transition-all duration-300">
            <rect x="54" y="66" width="38" height="22" rx="5" fill="#0f172a" stroke="#facc15" strokeWidth="2.5" />
            <rect x="108" y="66" width="38" height="22" rx="5" fill="#0f172a" stroke="#facc15" strokeWidth="2.5" />
            <line x1="92" y1="74" x2="108" y2="74" stroke="#facc15" strokeWidth="3" />
            <line x1="60" y1="71" x2="74" y2="82" stroke="#38bdf8" strokeWidth="2" opacity="0.7" />
            <line x1="114" y1="71" x2="128" y2="82" stroke="#38bdf8" strokeWidth="2" opacity="0.7" />
          </g>
        )}

        {isPasswordFocused && (
          <g className="transition-all duration-300">
            {/* Mắt mở to khi người chơi bật "Hiện Mật Khẩu" để nhìn lén */}
            <circle cx="74" cy="78" r="8" fill="#111827" />
            <circle cx="76" cy="75" r="2.5" fill="#ffffff" />
            <circle cx="126" cy="78" r="8" fill="#111827" />
            <circle cx="128" cy="75" r="2.5" fill="#ffffff" />
          </g>
        )}

        {/* Mũi & Miệng cười bựa */}
        <ellipse cx="100" cy="98" rx="10" ry="7" fill="#1e293b" />
        {captchaStatus === 'OVERFLOW' ? (
          <circle cx="100" cy="118" r="9" fill="#991b1b" />
        ) : (
          <path
            d="M 82 113 Q 100 128 118 113"
            fill="none"
            stroke="#1e293b"
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}
        <path d="M 94 120 Q 100 132 106 120 Z" fill="#fb7185" />

        {/* HAI TAY CẦM LY BIA CHE MẮT KHI NHẬP PASSWORD */}
        <g
          style={{
            transform: isPasswordFocused
              ? showPassword
                ? 'translate(0px, 14px)' // Hé ly bia xuống nhìn trộm mật khẩu!
                : 'translate(0px, -36px)' // Đưa 2 ly bia lên che kín mắt!
              : 'translate(0px, 32px)',
            transition: 'transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Tay trái + Ly bia trái */}
          <g transform="translate(38, 95)">
            <rect x="0" y="0" width="34" height="42" rx="6" fill="#fef08a" stroke="#f59e0b" strokeWidth="3" />
            <rect x="-2" y="-7" width="38" height="12" rx="6" fill="#ffffff" />
            <circle cx="32" cy="20" r="14" fill="#d97706" />
          </g>

          {/* Tay phải + Ly bia phải */}
          <g transform="translate(128, 95)">
            <rect x="0" y="0" width="34" height="42" rx="6" fill="#fef08a" stroke="#f59e0b" strokeWidth="3" />
            <rect x="-2" y="-7" width="38" height="12" rx="6" fill="#ffffff" />
            <circle cx="2" cy="20" r="14" fill="#d97706" />
          </g>
        </g>
      </svg>

      {/* Bong bóng thoại nhỏ của Cậu Vàng */}
      <div className="-mt-1 bg-slate-950/95 border border-amber-400 text-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-black text-center shadow-lg truncate max-w-[200px] mx-auto">
        {isPasswordFocused
          ? showPassword
            ? '👀 Á đù! Mật khẩu dễ đoán thế!'
            : '🙈 Cậu Vàng đã che mắt, yên tâm gõ!'
          : captchaStatus === 'OVERFLOW'
          ? '💦 Rót tràn bọt hết ra bàn rồi kìa!'
          : captchaStatus === 'SUCCESS'
          ? '🍻 Chuẩn đét! Mời đại ca vào bàn!'
          : '🩴 Xuất trình Hộ Chiếu Tửu Lượng!'}
      </div>
    </div>
  );
}

// ============================================================================
// 4. MAIN AUTH PANEL MODAL COMPONENT
// ============================================================================
export interface AuthUserSession {
  authMode: 'LOGIN' | 'SIGNUP' | 'GUEST';
  username: string;
  email?: string;
  roomPin?: string;
  avatar: CharacterAvatar;
  drunkArchetype: string;
  declaredTolerance: number;
  coins: number;
  title: string;
}

export interface AuthPanelModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (session: AuthUserSession) => void;
  initialTab?: 'LOGIN' | 'SIGNUP' | 'GUEST';
}

export const AuthPanelModal: React.FC<AuthPanelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'LOGIN',
}) => {
  const [authTab, setAuthTab] = useState<'LOGIN' | 'SIGNUP' | 'GUEST'>(initialTab);
  const [authSuccessModal, setAuthSuccessModal] = useState(false);
  const [forgotPassModal, setForgotPassModal] = useState(false);
  const [forgotPassSent, setForgotPassSent] = useState(false);
  const [showMongoDrawer, setShowMongoDrawer] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Form State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Sign Up State
  const [signupNickname, setSignupNickname] = useState('Chiến Thần Bờ Kè');
  const [signupEmail, setSignupEmail] = useState('chienthan_boke@nhau.vn');
  const [signupPassword, setSignupPassword] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesInfo>(SPECIES_LIST[0]);
  const [signupArchetype, setSignupArchetype] = useState(DRUNK_ARCHETYPES[0]);
  const [signupTolerance, setSignupTolerance] = useState(75);

  // Guest State
  const [guestNickname, setGuestNickname] = useState('Thần Cồn Quận 4');
  const [guestRoomPin, setGuestRoomPin] = useState('686868');

  // Captcha & Submission State
  const [ageVerified, setAgeVerified] = useState(true);
  const [beerPourLevel, setBeerPourLevel] = useState(0);
  const [isPouringCaptcha, setIsPouringCaptcha] = useState(false);
  const [captchaStatus, setCaptchaStatus] = useState<'IDLE' | 'POURING' | 'SUCCESS' | 'OVERFLOW'>('IDLE');
  const [authErrorMsg, setAuthErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSessionData, setLastSessionData] = useState<AuthUserSession | null>(null);

  // Pouring logic
  useEffect(() => {
    if (!isPouringCaptcha) return;
    const interval = setInterval(() => {
      setBeerPourLevel((prev) => {
        const next = prev + 3.2;
        sfx.playPouringTick(next / 100);
        if (next >= 100) {
          setIsPouringCaptcha(false);
          setCaptchaStatus('OVERFLOW');
          sfx.playBuzzer();
          return 100;
        }
        return next;
      });
    }, 55);
    return () => clearInterval(interval);
  }, [isPouringCaptcha]);

  const handleStartPourCaptcha = () => {
    if (captchaStatus === 'OVERFLOW') {
      setBeerPourLevel(0);
    }
    setAuthErrorMsg('');
    setCaptchaStatus('POURING');
    setIsPouringCaptcha(true);
  };

  const handleStopPourCaptcha = () => {
    if (!isPouringCaptcha) return;
    setIsPouringCaptcha(false);
    if (beerPourLevel >= 70 && beerPourLevel <= 95) {
      setCaptchaStatus('SUCCESS');
      sfx.playClink();
    } else if (beerPourLevel > 95) {
      setCaptchaStatus('OVERFLOW');
      sfx.playBuzzer();
    } else {
      setCaptchaStatus('IDLE');
    }
  };

  const handleResetPourCaptcha = () => {
    sfx.playPop();
    setBeerPourLevel(0);
    setCaptchaStatus('IDLE');
    setAuthErrorMsg('');
  };

  const liveMongoDocument = {
    _id: 'ObjectId("6729c8f4a91d04e8b2106868")',
    authMode: authTab,
    username:
      authTab === 'SIGNUP'
        ? signupNickname
        : authTab === 'GUEST'
        ? guestNickname
        : loginIdentifier.split('@')[0],
    email: authTab === 'GUEST' ? null : authTab === 'SIGNUP' ? signupEmail : loginIdentifier,
    roomPinJoin: authTab === 'GUEST' ? guestRoomPin : null,
    wallet: {
      bottleCaps: 740,
      rice: 15,
    },
    equipped: {
      character: `char_${selectedSpecies.id}`,
      avatar: selectedSpecies.avatarKey,
      shoes: 'shoes_dep_to_ong_gold_9999',
    },
    alcoholicPassport: {
      drunkArchetype: signupArchetype.id,
      declaredTolerance: `${signupTolerance}%`,
      rankTier:
        signupTolerance >= 85 ? 'THAN_CON' : signupTolerance >= 50 ? 'KIEN_TUONG' : 'TAM_CHIEU_MOI',
      captchaPourAccuracy: `${Math.round(beerPourLevel)}%`,
      committedNoExCall: ageVerified,
      stamp: 'DA_KIEM_DINH_DO_LAY_2026',
    },
    sessionJwtPreview: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.QUAN_TU_DUC_BO_KE.8899',
    createdAt: new Date().toISOString(),
  };

  const handleCompleteAuthSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthErrorMsg('');

    if (!ageVerified) {
      sfx.playBuzzer();
      setAuthErrorMsg('⚠️ Ê khoan! Phải tích cam kết đủ 18+ và không gọi cho Người Yêu Cũ khi say!');
      return;
    }

    if (captchaStatus !== 'SUCCESS') {
      sfx.playBuzzer();
      setAuthErrorMsg('🍺 Bạn chưa qua bài test tỉnh táo! Hãy giữ nút Rót Bia dừng đúng vạch vàng (70% - 95%)!');
      return;
    }

    setIsSubmitting(true);

    try {
      if (authTab === 'LOGIN') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: loginIdentifier, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          sfx.playBuzzer();
          setAuthErrorMsg(data.error || 'Đăng nhập không thành công');
          setIsSubmitting(false);
          return;
        }

        if (data.token) {
          localStorage.setItem('tram_nhau_auth_token', data.token);
        }

        const session: AuthUserSession = {
          authMode: 'LOGIN',
          username: data.user.username,
          email: data.user.email,
          avatar: data.user.avatar || 'dog',
          drunkArchetype: data.user.drunkArchetype || 'TRIET_GIA',
          declaredTolerance: data.user.declaredTolerance || 50,
          coins: data.user.coins || 740,
          title: data.user.title || 'Khách Quen Bờ Kè',
        };

        sfx.playBottleCapOpen();
        setTimeout(() => sfx.playClink(), 180);
        setLastSessionData(session);
        setAuthSuccessModal(true);
      } else if (authTab === 'SIGNUP') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: signupNickname,
            email: signupEmail,
            password: signupPassword,
            avatar: selectedSpecies.avatarKey,
            drunkArchetype: signupArchetype.id,
            declaredTolerance: signupTolerance,
            title:
              signupTolerance >= 85
                ? 'Tửu Tướng Bất Bại'
                : signupTolerance >= 50
                ? 'Kiện Tướng Bàn Nhậu'
                : 'Tấm Chiếu Mới',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          sfx.playBuzzer();
          setAuthErrorMsg(data.error || 'Đăng ký thất bại');
          setIsSubmitting(false);
          return;
        }

        if (data.token) {
          localStorage.setItem('tram_nhau_auth_token', data.token);
        }

        const session: AuthUserSession = {
          authMode: 'SIGNUP',
          username: data.user.username,
          email: data.user.email,
          avatar: data.user.avatar || selectedSpecies.avatarKey,
          drunkArchetype: data.user.drunkArchetype || signupArchetype.id,
          declaredTolerance: data.user.declaredTolerance || signupTolerance,
          coins: data.user.coins || 740,
          title: data.user.title || 'Tấm Chiếu Mới',
        };

        sfx.playBottleCapOpen();
        setTimeout(() => sfx.playClink(), 180);
        setLastSessionData(session);
        setAuthSuccessModal(true);
      } else {
        // GUEST AUTH
        const res = await fetch('/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nickname: guestNickname,
            roomPin: guestRoomPin,
            avatar: selectedSpecies.avatarKey,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          sfx.playBuzzer();
          setAuthErrorMsg(data.error || 'Không thể tạo phiên nhậu chui');
          setIsSubmitting(false);
          return;
        }

        if (data.token) {
          localStorage.setItem('tram_nhau_auth_token', data.token);
        }

        const session: AuthUserSession = {
          authMode: 'GUEST',
          username: data.user.username,
          roomPin: guestRoomPin,
          avatar: data.user.avatar || selectedSpecies.avatarKey,
          drunkArchetype: 'TRIET_GIA',
          declaredTolerance: 50,
          coins: data.user.coins || 500,
          title: 'Khách Nhậu Vãng Lai',
        };

        sfx.playBottleCapOpen();
        setTimeout(() => sfx.playClink(), 180);
        setLastSessionData(session);
        setAuthSuccessModal(true);
      }
    } catch (err: any) {
      console.error('Auth request failed:', err);
      sfx.playBuzzer();
      setAuthErrorMsg('Không thể kết nối đến máy chủ quán nhậu! Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col justify-between overflow-y-auto p-3 sm:p-5 text-amber-50">
      {/* Decorative LED Garland */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-8 flex justify-around items-start overflow-hidden z-0">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full -mt-1 shadow-[0_0_15px_#facc15] ${
              i % 2 === 0 ? 'bg-yellow-300 animate-pulse' : 'bg-amber-400'
            }`}
          />
        ))}
      </div>

      {/* Top Header of Auth Panel */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 max-w-6xl w-full mx-auto pt-1">
        <div className="flex items-center gap-2 bg-slate-900/90 border border-amber-500/40 px-3 py-1.5 rounded-full">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[11px] font-black text-amber-200 tracking-wide">
            CỔNG QUÁN NHẬU TƯ ĐỰC BỜ KÈ • SERVER ĐÔNG NGHỊT (1,428 BÀN ĐANG DZÔ)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sfx.playPop();
              setShowMongoDrawer(!showMongoDrawer);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-black border flex items-center gap-1.5 transition ${
              showMongoDrawer
                ? 'bg-emerald-500 text-slate-950 border-white shadow-[0_0_20px_rgba(16,185,129,0.7)]'
                : 'bg-slate-900/90 hover:bg-slate-800 text-emerald-300 border-emerald-500/40'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>🔍 Xem MongoDB Payload (`players`)</span>
          </button>

          {onClose && (
            <button
              onClick={() => {
                sfx.playPop();
                onClose();
              }}
              className="p-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
              title="Đóng / Vào Bàn Ngay"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="relative z-10 my-auto max-w-6xl w-full mx-auto py-3">
        {/* Neon Pub Signboard */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-red-950/90 border-2 border-amber-400 text-amber-300 text-[11px] font-black uppercase tracking-widest shadow-[0_0_25px_rgba(245,158,11,0.5)]">
            <span>🍻 QUÁN NHẬU ONLINE 3D • VẬT LÝ RAGDOLL LẦY LỘI</span>
          </div>
          <h1 className="mt-1.5 text-3xl sm:text-5xl font-black italic tracking-tight text-white drop-shadow-[0_0_20px_rgba(245,158,11,0.95)]">
            ONLINE DRINKING{' '}
            <span className="text-amber-400 underline decoration-wavy decoration-rose-500">
              KHÔNG SAY KHÔNG VỀ!
            </span>
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* ===============================================================
              CỘT TRÁI (7 CỘT): FORM ĐĂNG NHẬP / ĐĂNG KÝ / NHẬU CHUI
          =============================================================== */}
          <div className="lg:col-span-7 bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-900/95 border-2 border-amber-400/80 rounded-3xl p-4 sm:p-6 shadow-[0_0_50px_rgba(0,0,0,0.85)] flex flex-col justify-between">
            <div>
              {/* 3 Tab Mode Switcher */}
              <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-amber-500/30 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    sfx.playPop();
                    setAuthTab('LOGIN');
                    setAuthErrorMsg('');
                  }}
                  className={`py-2 px-2 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${
                    authTab === 'LOGIN'
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-[0_3px_0_#9a3412]'
                      : 'text-slate-300 hover:text-amber-300 hover:bg-slate-900'
                  }`}
                >
                  <span>🎫</span>
                  <span>Vé Vào Bàn (Login)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sfx.playPop();
                    setAuthTab('SIGNUP');
                    setAuthErrorMsg('');
                  }}
                  className={`py-2 px-2 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${
                    authTab === 'SIGNUP'
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-[0_3px_0_#9a3412]'
                      : 'text-slate-300 hover:text-amber-300 hover:bg-slate-900'
                  }`}
                >
                  <span>🪪</span>
                  <span>Làm Hộ Chiếu (Sign Up)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sfx.playPop();
                    setAuthTab('GUEST');
                    setAuthErrorMsg('');
                  }}
                  className={`py-2 px-2 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${
                    authTab === 'GUEST'
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 shadow-[0_3px_0_#065f46]'
                      : 'text-slate-300 hover:text-emerald-300 hover:bg-slate-900'
                  }`}
                >
                  <span>⚡</span>
                  <span>Nhậu Chui (3 Giây)</span>
                </button>
              </div>

              {/* TAB 1: LOGIN */}
              {authTab === 'LOGIN' && (
                <form onSubmit={handleCompleteAuthSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-black uppercase text-amber-300 mb-1">
                      🍺 Biệt Danh Bàn Nhậu / Email:
                    </label>
                    <input
                      type="text"
                      value={loginIdentifier}
                      onChange={(e) => {
                        sfx.playPop();
                        setLoginIdentifier(e.target.value);
                      }}
                      placeholder="VD: cauvang_doluc@nhau.vn"
                      className="w-full bg-slate-950 border-2 border-amber-500/40 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white placeholder-slate-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-black uppercase text-amber-300">
                        🔑 Mật Khẩu / Ám Hiệu Vào Quán:
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          sfx.playPop();
                          setForgotPassSent(false);
                          setForgotPassModal(true);
                        }}
                        className="text-[11px] font-bold text-rose-400 hover:text-rose-300 underline"
                      >
                        Quên mật khẩu vì hôm qua say quá?
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onFocus={() => setIsPasswordFocused(true)}
                        onBlur={() => setIsPasswordFocused(false)}
                        onChange={(e) => {
                          sfx.playPop();
                          setPassword(e.target.value);
                        }}
                        placeholder="Nhập ám hiệu..."
                        className="w-full bg-slate-950 border-2 border-amber-500/40 focus:border-amber-400 rounded-xl pl-3.5 pr-28 py-2.5 text-sm font-bold text-white outline-none transition"
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          sfx.playPop();
                          setIsPasswordFocused(true);
                          setShowPassword(!showPassword);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-amber-300 text-[11px] font-black flex items-center gap-1 transition"
                      >
                        {showPassword ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" /> <span>Che Mắt</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> <span>Hé Nhìn</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Quick OAuth options */}
                  <div className="pt-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-2 text-center">
                      — HOẶC VÀO BÀN NHANH BẰNG THẺ QUEN —
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Google', icon: '🌐', color: 'hover:border-red-400' },
                        { label: 'Discord', icon: '🎧', color: 'hover:border-indigo-400' },
                        { label: 'Apple ID', icon: '🍎', color: 'hover:border-slate-300' },
                        { label: 'Ví Web3', icon: '🦊', color: 'hover:border-amber-400' },
                      ].map((soc) => (
                        <button
                          key={soc.label}
                          type="button"
                          onClick={() => {
                            sfx.playClink();
                            setLoginIdentifier(`${soc.label.toLowerCase()}_chienthan@nhau.vn`);
                            setCaptchaStatus('SUCCESS');
                            setBeerPourLevel(84);
                          }}
                          className={`py-2 px-2 rounded-xl bg-slate-950 border border-slate-700 ${soc.color} text-xs font-extrabold text-slate-200 flex items-center justify-center gap-1.5 transition hover:bg-slate-900`}
                        >
                          <span>{soc.icon}</span>
                          <span className="truncate">{soc.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              )}

              {/* TAB 2: SIGNUP */}
              {authTab === 'SIGNUP' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-black uppercase text-amber-300 mb-1">
                        🏷️ Biệt Danh Trên Bàn Nhậu:
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={signupNickname}
                          onChange={(e) => setSignupNickname(e.target.value)}
                          maxLength={22}
                          className="w-full bg-slate-950 border-2 border-amber-500/40 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            sfx.playPop();
                            const pick = FUNNY_RANDOM_NAMES[Math.floor(Math.random() * FUNNY_RANDOM_NAMES.length)];
                            setSignupNickname(pick);
                          }}
                          className="px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-400 hover:text-slate-950 border border-amber-400/50 text-amber-300 text-xs font-black"
                          title="Random Biệt Danh Lầy Lội"
                        >
                          🎲
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-amber-300 mb-1">
                        📧 Email Nhận Hóa Đơn Đền Bù:
                      </label>
                      <input
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="w-full bg-slate-950 border-2 border-amber-500/40 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                      />
                    </div>
                  </div>

                  {/* Password Input for Signup */}
                  <div>
                    <label className="block text-[11px] font-black uppercase text-amber-300 mb-1">
                      🔑 Mật Khẩu Ám Hiệu Vào Bàn (Ít Nhất 6 Ký Tự):
                    </label>
                    <input
                      type="password"
                      value={signupPassword}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Nhập mật khẩu..."
                      className="w-full bg-slate-950 border-2 border-amber-500/40 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                    />
                  </div>

                  {/* Character Avatar Picker */}
                  <div>
                    <label className="block text-[11px] font-black uppercase text-amber-300 mb-1">
                      🐾 Chọn Thú Bông 3D Ngồi Ghế Nhựa Đỏ:
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {SPECIES_LIST.map((sp) => (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => {
                            sfx.playPop();
                            setSelectedSpecies(sp);
                          }}
                          className={`p-2 rounded-xl border text-center transition ${
                            selectedSpecies.id === sp.id
                              ? 'bg-amber-500/30 border-amber-400 scale-105 shadow'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div className="text-xl">{sp.emoji}</div>
                          <div className="text-[10px] font-extrabold text-white truncate">
                            {sp.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Drunk Archetype Picker */}
                  <div>
                    <label className="block text-[11px] font-black uppercase text-amber-300 mb-1">
                      🌀 Hệ Tư Tưởng Khi Say (&gt;80% Cồn Tự Động Bộc Phát):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {DRUNK_ARCHETYPES.map((arch) => (
                        <button
                          key={arch.id}
                          type="button"
                          onClick={() => {
                            sfx.playPop();
                            setSignupArchetype(arch);
                          }}
                          className={`p-2 rounded-xl border text-left transition ${
                            signupArchetype.id === arch.id
                              ? 'bg-purple-500/30 border-purple-400 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                          }`}
                        >
                          <div className="text-xs font-black flex items-center gap-1">
                            <span>{arch.icon}</span>
                            <span className="truncate">{arch.name}</span>
                          </div>
                          <p className="text-[9px] text-slate-400 line-clamp-1 mt-0.5">
                            {arch.quote}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tolerance Slider */}
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-amber-500/30">
                    <div className="flex justify-between text-xs font-black">
                      <span className="text-amber-300">🍻 Tửu Lượng Tự Khai Báo:</span>
                      <span className="text-yellow-300">
                        {signupTolerance < 30
                          ? `${signupTolerance}% (1 Lon Là Gục 😴)`
                          : signupTolerance < 75
                          ? `${signupTolerance}% (Đô Vỉa Hè 🍺)`
                          : `${signupTolerance}% (Bất Tử Cồn 🔥)`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={signupTolerance}
                      onChange={(e) => setSignupTolerance(Number(e.target.value))}
                      className="w-full accent-amber-400 h-2 mt-1 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: GUEST (NHẬU CHUI) */}
              {authTab === 'GUEST' && (
                <div className="space-y-3.5">
                  <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-3 text-xs text-emerald-200 flex items-center gap-2.5">
                    <span className="text-2xl">🏃‍♂️💨</span>
                    <div>
                      <p className="font-black text-emerald-300 uppercase">
                        Chế Độ Nhậu Chui Cấp Tốc (Không Cần Mật Khẩu)
                      </p>
                      <p className="text-[11px] text-emerald-100/80">
                        Dành cho anh em vừa bấm link rủ nhậu trên Messenger/Discord muốn nhảy tọt
                        lên ghế nhựa đỏ trong 3 giây!
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-emerald-300 mb-1">
                      🎲 Biệt Danh Tạm Thời Của Bạn:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={guestNickname}
                        onChange={(e) => setGuestNickname(e.target.value)}
                        className="w-full bg-slate-950 border-2 border-emerald-500/50 rounded-xl px-3.5 py-2.5 text-sm font-black text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          sfx.playPop();
                          const nextName = FUNNY_RANDOM_NAMES[Math.floor(Math.random() * FUNNY_RANDOM_NAMES.length)];
                          setGuestNickname(nextName);
                        }}
                        className="px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shrink-0 flex items-center gap-1 shadow"
                      >
                        <Dices className="w-4 h-4" /> Random Tên Bựa
                      </button>
                    </div>
                  </div>

                  {/* PIN Input */}
                  <div className="bg-[#fdf8e7] text-slate-900 p-3.5 rounded-2xl border-2 border-dashed border-stone-400 shadow-inner">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-red-700 mb-1">
                      <span>🧾 PHIẾU VÀO BÀN NHẬU (MÃ PIN 6 SỐ)</span>
                      <span>BÀN SỐ #04</span>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={guestRoomPin}
                      onChange={(e) => setGuestRoomPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="686868"
                      className="w-full bg-amber-100/80 border-2 border-stone-400 rounded-xl py-2 text-center font-mono text-2xl font-black tracking-[0.45em] text-red-800 outline-none"
                    />
                    <p className="text-[10px] text-stone-600 text-center mt-1 font-semibold">
                      Để trống nếu muốn ghép vào bàn nhậu ngẫu nhiên đang thiếu chân!
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* =============================================================
                MINI-GAME CAPTCHA: RÓT BIA TỈNH TÁO & CAM KẾT 18+
            ============================================================= */}
            <div className="mt-4 pt-3 border-t border-slate-800 space-y-3">
              {/* Checkbox 18+ */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none bg-slate-950/90 px-3 py-2 rounded-xl border border-amber-500/30 hover:border-amber-400 transition">
                <input
                  type="checkbox"
                  checked={ageVerified}
                  onChange={(e) => {
                    sfx.playPop();
                    setAgeVerified(e.target.checked);
                  }}
                  className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-amber-100">
                  Tôi đã đủ <b className="text-amber-400">18 tuổi</b> và cam kết khi say trên
                  85% <b className="text-rose-400">không gọi điện cho Người Yêu Cũ</b>!
                </span>
              </label>

              {/* Captcha Beer Glass */}
              <div className="bg-slate-950 border-2 border-amber-500/40 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {/* Virtual Glass */}
                  <div className="relative w-14 h-20 rounded-b-xl rounded-t-sm border-2 border-white/80 bg-slate-900 overflow-hidden shrink-0 shadow-inner">
                    {/* Sweet spot (70% - 95%) */}
                    <div
                      style={{ bottom: '70%', height: '25%' }}
                      className="absolute inset-x-0 bg-emerald-400/25 border-y border-dashed border-emerald-300 z-10 flex items-center justify-center"
                    >
                      <span className="text-[8px] font-black text-emerald-200 uppercase">
                        CHUẨN
                      </span>
                    </div>

                    {/* Beer liquid */}
                    <div
                      style={{ height: `${beerPourLevel}%` }}
                      className={`absolute bottom-0 inset-x-0 transition-all duration-75 ${
                        captchaStatus === 'OVERFLOW'
                          ? 'bg-rose-500'
                          : captchaStatus === 'SUCCESS'
                          ? 'bg-gradient-to-t from-amber-500 via-yellow-400 to-white'
                          : 'bg-gradient-to-t from-amber-600 to-yellow-300'
                      }`}
                    >
                      {beerPourLevel > 5 && (
                        <div className="w-full h-2.5 bg-white rounded-t-sm animate-pulse" />
                      )}
                    </div>
                  </div>

                  <div className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black uppercase text-amber-300">
                        🍺 CAPTCHA RÓT BIA TỈNH TÁO:
                      </span>
                      <span
                        className={`font-mono font-black px-1.5 py-0.2 rounded text-[11px] ${
                          captchaStatus === 'SUCCESS'
                            ? 'bg-emerald-500 text-slate-950'
                            : captchaStatus === 'OVERFLOW'
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-800 text-amber-300'
                        }`}
                      >
                        {Math.round(beerPourLevel)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {captchaStatus === 'SUCCESS'
                        ? '✅ Bọt bia chuẩn đét (70-95%)! Đã mở khóa cổng bàn nhậu!'
                        : captchaStatus === 'OVERFLOW'
                        ? '💦 Tràn bọt lênh láng rồi! Bấm "Hớt Bọt" để rót lại!'
                        : 'Nhấn giữ nút bên phải để rót bia dừng trong vạch CHUẨN (70% - 95%)'}
                    </p>
                  </div>
                </div>

                {/* Pour Buttons */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                  {captchaStatus === 'OVERFLOW' || beerPourLevel > 0 ? (
                    <button
                      type="button"
                      onClick={handleResetPourCaptcha}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600"
                      title="Đổ bớt bọt rót lại"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onMouseDown={handleStartPourCaptcha}
                    onMouseUp={handleStopPourCaptcha}
                    onMouseLeave={handleStopPourCaptcha}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      handleStartPourCaptcha();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleStopPourCaptcha();
                    }}
                    className={`px-4 py-2.5 rounded-xl font-black text-xs select-none transition shadow-lg ${
                      captchaStatus === 'SUCCESS'
                        ? 'bg-emerald-400 text-slate-950'
                        : isPouringCaptcha
                        ? 'bg-amber-300 text-slate-950 scale-95'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    {captchaStatus === 'SUCCESS'
                      ? '🍻 ĐÃ RÓT CHUẨN!'
                      : isPouringCaptcha
                      ? '⏳ THẢ TAY ĐÚNG VẠCH...'
                      : '🍺 GIỮ ĐỂ RÓT BIA'}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {authErrorMsg && (
                <div className="bg-rose-950/90 border border-rose-500 text-rose-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{authErrorMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleCompleteAuthSubmit()}
                className={`w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-base shadow-[0_5px_0_#9a3412] active:translate-y-1 transition flex items-center justify-center gap-2 ${
                  isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                <Beer className={`w-5 h-5 fill-slate-950 ${isSubmitting ? 'animate-spin' : ''}`} />
                <span>
                  {isSubmitting
                    ? 'ĐANG KẾT NỐI MÁY CHỦ BÀN NHẬU...'
                    : authTab === 'SIGNUP'
                    ? 'CẤP HỘ CHIẾU TỬU LƯỢNG & VÀO BÀN NGAY!'
                    : authTab === 'GUEST'
                    ? 'NHẢY LÊN GHẾ NHỰA ĐỎ NGAY (1, 2, 3 DZÔ!)'
                    : 'XUẤT TRÌNH VÉ & VÀO BÀN NHẬU NGAY!'}
                </span>
              </button>
            </div>
          </div>

          {/* ===============================================================
              CỘT PHẢI (5 CỘT): MASCOT CẬU VÀNG + HỘ CHIẾU TỬU LƯỢNG LIVE
          =============================================================== */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4 bg-slate-900/90 border-2 border-amber-500/50 rounded-3xl p-4 sm:p-5 shadow-2xl">
            {/* Mascot Bouncer Guard */}
            <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-3 text-center">
              <div className="flex items-center justify-between text-[10px] font-black uppercase text-amber-400 mb-1">
                <span>🐕 BẢO VỆ CỔNG QUÁN: CẬU VÀNG</span>
                <span className="text-emerald-400">● ĐANG CANH CỬA</span>
              </div>
              <CauVangBouncerSVG
                isPasswordFocused={isPasswordFocused}
                showPassword={showPassword}
                captchaStatus={captchaStatus}
              />
            </div>

            {/* LIVE PREVIEW: HỘ CHIẾU TỬU LƯỢNG */}
            <div className="relative bg-gradient-to-br from-[#fef3c7] via-[#fde68a] to-[#f59e0b] text-slate-950 rounded-2xl p-4 border-4 border-amber-700 shadow-[0_12px_30px_rgba(0,0,0,0.6)] overflow-hidden">
              {/* Red Stamp */}
              <div className="absolute -right-2 top-8 rotate-12 border-4 border-red-700/80 text-red-700/85 px-2.5 py-1 rounded-xl font-black text-[10px] uppercase tracking-wider pointer-events-none shadow-sm bg-amber-100/60">
                ★ ĐÃ KIỂM ĐỊNH ĐỘ LẦY ★
              </div>

              {/* Header */}
              <div className="border-b-2 border-amber-900/30 pb-2 mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-red-800">
                    CỘNG HÒA XÃ HỘI DÂN NHẬU BỜ KÈ
                  </p>
                  <h3 className="text-base font-black uppercase tracking-tight text-slate-950">
                    🪪 HỘ CHIẾU TỬU LƯỢNG (LIVE ID)
                  </h3>
                </div>
                <span className="font-mono text-[10px] font-black bg-amber-900 text-amber-100 px-2 py-0.5 rounded">
                  No. 6868-VN
                </span>
              </div>

              {/* Passport Details */}
              <div className="flex items-center gap-3.5">
                <div className="w-20 h-20 rounded-2xl bg-slate-900 border-2 border-amber-800 flex flex-col items-center justify-center shrink-0 shadow-inner">
                  <span className="text-4xl">{selectedSpecies.emoji}</span>
                  <span className="text-[9px] font-black text-amber-300 uppercase mt-0.5">
                    {selectedSpecies.name}
                  </span>
                </div>

                <div className="space-y-1 text-xs flex-1 min-w-0">
                  <div>
                    <span className="text-[9px] font-black uppercase text-amber-900 block">
                      BIỆT DANH BÀN NHẬU:
                    </span>
                    <p className="font-black text-sm text-red-900 truncate">
                      {authTab === 'SIGNUP'
                        ? signupNickname || 'Chiến Thần Bờ Kè'
                        : authTab === 'GUEST'
                        ? guestNickname
                        : loginIdentifier.split('@')[0]}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-1 pt-0.5">
                    <div>
                      <span className="text-[9px] font-black uppercase text-amber-900 block">
                        HỆ KHI SAY:
                      </span>
                      <p className="font-extrabold text-[11px] text-slate-900 truncate">
                        {signupArchetype.icon} {signupArchetype.name}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-amber-900 block">
                        ĐÔ KHAI BÁO:
                      </span>
                      <p className="font-extrabold text-[11px] text-red-800">
                        {signupTolerance}% Cồn ({Math.round(signupTolerance / 8)} Lon)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Passport Footer */}
              <div className="mt-3 pt-2 border-t border-amber-900/25 flex items-center justify-between text-[10px] font-black">
                <span className="text-amber-950">
                  🩴 Vũ khí: Dép Tổ Ong Vàng + Đậu Phộng
                </span>
                <span className="bg-red-700 text-white px-2 py-0.5 rounded-full">
                  Quà vào bàn: +500 🪙
                </span>
              </div>
            </div>

            {/* Hint */}
            <div className="text-[11px] text-slate-400 text-center italic">
              💡 Mẹo: Bấm vào ô Mật Khẩu để xem Cậu Vàng lấy ly bia che mắt, hoặc bấm nút{' '}
              <b className="text-emerald-300">Xem MongoDB Payload</b> ở góc trên!
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================
          DRAWER: MONGODB LIVE DOCUMENT PREVIEW (`players` collection)
      ================================================================= */}
      {showMongoDrawer && (
        <div className="relative z-20 max-w-6xl w-full mx-auto mt-2 bg-slate-950/95 border-2 border-emerald-400 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-black uppercase text-emerald-300">
                MONGODB LIVE DOCUMENT PREVIEW — db.players.insertOne(...)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(JSON.stringify(liveMongoDocument, null, 2));
                  setCopiedJson(true);
                  setTimeout(() => setCopiedJson(false), 1800);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 hover:text-slate-950 text-emerald-300 text-[11px] font-black flex items-center gap-1 transition"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedJson ? 'Đã Copy JSON' : 'Copy JSON'}</span>
              </button>
              <button
                onClick={() => setShowMongoDrawer(false)}
                className="text-xs text-slate-400 hover:text-white px-2"
              >
                Đóng ✕
              </button>
            </div>
          </div>
          <pre className="text-[11px] font-mono text-emerald-300 bg-slate-900/90 p-3 rounded-xl overflow-x-auto max-h-44">
            {JSON.stringify(liveMongoDocument, null, 2)}
          </pre>
        </div>
      )}

      {/* Footer */}
      <div className="relative z-10 text-center text-[11px] text-slate-400 py-1">
        © 2026 QUÁN NHẬU TƯ ĐỰC BỜ KÈ • Chơi game có trách nhiệm, uống bia ảo không lái xe thật!
      </div>

      {/* =====================================================================
          MODAL: QUÊN MẬT KHẨU "KHÔI PHỤC TRÍ NHỚ SAU CƠN SAY"
      ===================================================================== */}
      {forgotPassModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-400 rounded-3xl p-6 text-center shadow-2xl">
            <div className="text-5xl mb-2">🧊🧻</div>
            <h3 className="text-xl font-black text-amber-300 uppercase">
              KHÔI PHỤC TRÍ NHỚ SAU CƠN SAY
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Hôm qua uống tới bến quên mất ám hiệu vào bàn? Nhập email để Bà Chủ Quán gửi ngay{' '}
              <b className="text-sky-300">1 Chiếc Khăn Lạnh Ướp Đá</b> giúp bạn tỉnh rượu nhớ lại
              mật khẩu!
            </p>

            {!forgotPassSent ? (
              <div className="mt-4 space-y-3 text-left">
                <div>
                  <label className="text-[11px] font-black uppercase text-amber-300">
                    Câu hỏi kiểm tra trí nhớ: Đêm qua ai là người trả Bill?
                  </label>
                  <select className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white">
                    <option>Em ngủ gục từ phút thứ 5 nên không biết gì hết!</option>
                    <option>Thằng Hùng Đại Ca bị dán giấy lên trán trả!</option>
                    <option>Cả bàn chạy trốn bị Bà Chủ phi dép tổ ong!</option>
                  </select>
                </div>
                <button
                  onClick={async () => {
                    sfx.playBottleCapOpen();
                    try {
                      await fetch('/api/auth/forgot-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: loginIdentifier }),
                      });
                    } catch (e) {
                      // ignore
                    }
                    setForgotPassSent(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-black text-xs shadow"
                >
                  🧊 GỬI KHĂN LẠNH KHÔI PHỤC MẬT KHẨU!
                </button>
              </div>
            ) : (
              <div className="mt-4 bg-emerald-950/60 border border-emerald-400 rounded-2xl p-3 text-xs text-emerald-200 font-bold">
                ✅ Đã ném 1 chiếc Khăn Lạnh Giải Rượu vào hòm thư <b>{loginIdentifier}</b>! Mật khẩu
                tạm của bạn là: <code className="text-yellow-300">khongsaykhongve123</code>
              </div>
            )}

            <button
              onClick={() => setForgotPassModal(false)}
              className="mt-4 w-full py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
            >
              Quay Lại Cổng Quán
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CHÚC MỪNG VÀO BÀN THÀNH CÔNG
      ===================================================================== */}
      {authSuccessModal && lastSessionData && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border-4 border-amber-400 rounded-3xl p-6 text-center shadow-[0_0_60px_rgba(245,158,11,0.85)] animate-bounce">
            <div className="text-5xl mb-2">🍻🎉</div>
            <span className="text-[10px] font-black uppercase bg-emerald-400 text-slate-950 px-3 py-0.5 rounded-full">
              ĐÃ ĐÓNG MỘC HỘ CHIẾU TỬU LƯỢNG
            </span>
            <h2 className="text-2xl font-black text-white mt-2">
              CHÀO MỪNG {lastSessionData.username.toUpperCase()}!
            </h2>
            <p className="text-xs text-amber-200 mt-1">
              Ghế nhựa đỏ số #1 đã sẵn sàng! Bà Chủ Quán Tư Đực tặng bạn quà nhập tiệc:
            </p>

            <div className="grid grid-cols-2 gap-2.5 my-4">
              <div className="bg-slate-900 border border-amber-400/50 rounded-2xl p-3">
                <div className="text-2xl">🪙</div>
                <p className="font-black text-sm text-amber-300 mt-1">+500 Nắp Bia</p>
                <p className="text-[10px] text-slate-400">Vốn liếng gọi mồi & mua vé số</p>
              </div>
              <div className="bg-slate-900 border border-yellow-400/50 rounded-2xl p-3">
                <div className="text-2xl">🩴</div>
                <p className="font-black text-sm text-yellow-300 mt-1">Dép Tổ Ong 9999</p>
                <p className="text-[10px] text-slate-400">Vũ khí phi tầm xa chuẩn 100%</p>
              </div>
            </div>

            <button
              onClick={() => {
                setAuthSuccessModal(false);
                onSuccess(lastSessionData);
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-500 text-slate-950 font-black text-sm shadow-lg hover:scale-105 transition"
            >
              🍺 NGỒI VÀO GHẾ NHỰA & HÔ "1, 2, 3 DZÔ!"
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
