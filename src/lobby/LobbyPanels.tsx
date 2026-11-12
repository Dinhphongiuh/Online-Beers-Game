import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, Mic, MicOff, Volume2 } from 'lucide-react';
import { PubTheme } from '../game/types';
import { sound } from '../game/audio';
import {
  DRUNK_SPEEDS,
  DrunkSpeedId,
  LOBBY_MAPS,
  LobbyFriend,
  LobbySkin,
  RULE_LABELS,
  SKIN_AVATARS,
  SKIN_CLOTHES,
  SKIN_GLASSES,
  SKIN_HATS,
  TableRules,
  AVATAR_ICON,
  drinkingRank,
} from './lobbyData';
import { HangoverBook } from '../components/HangoverBook';
import { PassportCard } from './PassportCard';
import { getNetPlayerId } from '../net/useTableNet';
import type { MatchReceipt } from '../../shared/receipts';
import {
  CHIBI_SKIN_TONES,
  DEFAULT_CHIBI_APPEARANCE,
  DEFAULT_HUMAN_APPEARANCE,
  HUMAN_SKIN_TONES,
} from '../../shared/appearance';

// Browsers keep audio locked until the first gesture; don't spam a suspended context on hover.
let audioUnlocked = false;
export const markAudioUnlocked = () => {
  audioUnlocked = true;
};
export const isAudioUnlocked = () => audioUnlocked;

/** Hover SFX shared by every lobby button: chopstick tap / ice-cube clink. */
export const sfx = {
  onMouseEnter: () => {
    if (audioUnlocked) sound.playUiHover();
  },
};

const ModalBackdrop: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({
  onClose,
  children,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/55 backdrop-blur-[2px] animate-in fade-in duration-150"
    onPointerDown={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
    {children}
  </div>
);

const CloseButton: React.FC<{ onClose: () => void; className?: string }> = ({ onClose, className }) => (
  <button
    onClick={onClose}
    {...sfx}
    className={`absolute top-2 right-2 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white/80 hover:text-white cursor-pointer ${className || ''}`}
    aria-label="Đóng"
  >
    <X className="w-4 h-4" />
  </button>
);

// ============================================================================
// 1. TẠO BÀN RIÊNG — chalkboard order menu
// ============================================================================
export const HostRoomPanel: React.FC<{
  map: PubTheme;
  drunkSpeed: DrunkSpeedId;
  rules: TableRules;
  roomCode: string;
  /** Step badge above the title, e.g. "BƯỚC 1/2 • CHỌN QUÁN". */
  stepLabel?: string;
  title?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (map: PubTheme, drunkSpeed: DrunkSpeedId, rules: TableRules) => void;
}> = ({ map, drunkSpeed, rules, roomCode, stepLabel, title, confirmLabel, onClose, onConfirm }) => {
  const [m, setM] = useState(map);
  const [speed, setSpeed] = useState(drunkSpeed);
  const [r, setR] = useState(rules);

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="chalkboard relative w-[min(560px,96vw)] max-h-[92vh] overflow-y-auto rounded-2xl p-5 chalk-text">
        <CloseButton onClose={onClose} />
        <div className="text-center mb-4">
          <div className="text-[11px] tracking-[0.3em] text-amber-200/80">{stepLabel ?? 'THỰC ĐƠN GỌI MÓN'}</div>
          <h2 className="font-neon text-2xl text-amber-300">{title ?? '🔑 Tạo Bàn Riêng'}</h2>
          <div className="text-xs text-white/70 mt-1">
            Mã bàn: <span className="font-mono font-bold text-amber-200 tracking-widest">#{roomCode}</span>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm font-black mb-2 border-b border-dashed border-white/30 pb-1">📍 Chọn Địa Điểm</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {LOBBY_MAPS.map((opt) => (
              <button
                key={opt.id}
                {...sfx}
                onClick={() => {
                  sound.playBottleOpen();
                  setM(opt.id);
                }}
                className={`text-left rounded-xl px-3 py-2 border-2 transition cursor-pointer ${
                  m === opt.id
                    ? 'border-amber-300 bg-amber-300/15'
                    : 'border-white/15 hover:border-white/40'
                }`}
              >
                <div className="text-sm font-bold">
                  {opt.icon} {opt.name}
                </div>
                <div className="text-[11px] text-white/60">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm font-black mb-2 border-b border-dashed border-white/30 pb-1">🌡️ Độ Đô Của Bàn</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {DRUNK_SPEEDS.map((opt) => (
              <button
                key={opt.id}
                {...sfx}
                onClick={() => {
                  sound.playBottleOpen();
                  setSpeed(opt.id);
                }}
                className={`text-left rounded-xl px-3 py-2 border-2 transition cursor-pointer ${
                  speed === opt.id
                    ? 'border-amber-300 bg-amber-300/15'
                    : 'border-white/15 hover:border-white/40'
                }`}
              >
                <div className="text-sm font-bold">
                  {opt.icon} {opt.name}
                </div>
                <div className="text-[11px] text-white/60">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <div className="text-sm font-black mb-2 border-b border-dashed border-white/30 pb-1">📜 Luật Đặc Biệt</div>
          <div className="space-y-2">
            {RULE_LABELS.map((rule) => {
              const on = r[rule.id];
              return (
                <button
                  key={rule.id}
                  {...sfx}
                  onClick={() => {
                    sound.playBottleOpen();
                    setR((prev) => ({ ...prev, [rule.id]: !prev[rule.id] }));
                  }}
                  className="w-full flex items-center gap-3 text-left cursor-pointer group"
                  role="checkbox"
                  aria-checked={on}
                >
                  <span
                    className={`beer-cap shrink-0 w-8 h-8 flex items-center justify-center text-sm font-black transition ${
                      on ? 'bg-amber-400 text-red-800' : 'bg-zinc-500/60 text-transparent group-hover:bg-zinc-400/70'
                    }`}
                  >
                    ✓
                  </span>
                  <span className={`text-[13px] ${on ? 'text-white' : 'text-white/55 line-through decoration-white/30'}`}>
                    {rule.icon} {rule.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          {...sfx}
          onClick={() => onConfirm(m, speed, r)}
          className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-red-900 font-black text-base shadow-lg cursor-pointer active:scale-[0.98] transition"
        >
          {confirmLabel ?? '✍️ Chốt Thực Đơn & Mở Bàn'}
        </button>
      </div>
    </ModalBackdrop>
  );
};

// ============================================================================
// 2. NHẬP MÃ BÀN — bill receipt with a 6-digit PIN
// ============================================================================
export const JoinCodePanel: React.FC<{
  onClose: () => void;
  onJoin: (code: string) => void;
}> = ({ onClose, onJoin }) => {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const fill = (raw: string) => {
    // Accepts a pasted link or code: keep the first 6 digits
    const found = raw.replace(/\D/g, '').slice(0, 6).split('');
    if (found.length === 0) return false;
    const next = Array(6).fill('');
    found.forEach((d, i) => (next[i] = d));
    setDigits(next);
    inputs.current[Math.min(found.length, 5)]?.focus();
    return true;
  };

  const code = digits.join('');

  const submit = () => {
    if (code.length !== 6) {
      setError('Mã bàn phải đủ 6 số nha bạn hiền!');
      sound.playHiccup();
      return;
    }
    onJoin(code);
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="relative w-[min(340px,94vw)] rotate-[-1.5deg]">
        <div className="receipt-paper px-5 pt-5 pb-9 shadow-2xl">
          <CloseButton onClose={onClose} className="!bg-black/10 !text-zinc-600 hover:!text-zinc-900" />
          <div className="text-center border-b border-dashed border-zinc-400 pb-2 mb-3">
            <div className="font-black text-lg">ONLINE DRINKING</div>
            <div className="text-[10px] text-zinc-500">Nhậu vỉa hè cùng chiến hữu</div>
            <div className="text-[11px] font-bold mt-1">HÓA ĐƠN TÍNH TIỀN</div>
          </div>
          <div className="text-[11px] flex justify-between"><span>Bàn số:</span><span>??????</span></div>
          <div className="text-[11px] flex justify-between mb-3"><span>Thu ngân:</span><span>Phục vụ</span></div>

          <label className="block text-[11px] font-bold mb-1.5">NHẬP MÃ PIN BÀN (6 SỐ):</label>
          <div
            className="flex justify-between gap-1.5 mb-2"
            onPaste={(e) => {
              if (fill(e.clipboardData.getData('text'))) e.preventDefault();
            }}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={d}
                inputMode="numeric"
                aria-label={`Số thứ ${i + 1}`}
                onChange={(e) => {
                  setError(null);
                  const v = e.target.value.replace(/\D/g, '');
                  // Fast typing can land several digits in one box: spill them into the next boxes
                  const prev = digits[i];
                  const typed = prev && v.length > 1 && v.startsWith(prev) ? v.slice(prev.length) : v;
                  setDigits((cur) => {
                    const next = [...cur];
                    if (!typed) next[i] = '';
                    [...typed].forEach((c, k) => {
                      if (i + k < 6) next[i + k] = c;
                    });
                    return next;
                  });
                  if (typed) {
                    sound.playUiHover();
                    inputs.current[Math.min(i + typed.length, 5)]?.focus();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !digits[i]) inputs.current[i - 1]?.focus();
                  if (e.key === 'Enter') submit();
                }}
                className="w-10 h-12 text-center text-xl font-black bg-white border-2 border-zinc-800 rounded-md focus:outline-none focus:border-red-600 focus:bg-amber-50"
              />
            ))}
          </div>
          <div className="text-[10px] text-zinc-500 mb-1">Hoặc dán link mời — tự động lấy mã.</div>
          {error && <div className="text-[11px] text-red-600 font-bold mb-1">{error}</div>}

          <div className="border-t border-dashed border-zinc-400 my-3" />
          <div className="flex justify-between text-sm font-black mb-3">
            <span>TỔNG CỘNG:</span>
            <span>1 CHẦU VUI</span>
          </div>
          <button
            {...sfx}
            onClick={submit}
            className="w-full py-2.5 rounded-md bg-red-700 hover:bg-red-600 text-white font-black text-sm cursor-pointer active:scale-[0.98] transition"
          >
            🪑 NHẢY VÀO BÀN
          </button>
          <div className="text-center text-[10px] text-zinc-500 mt-3">*** Cảm ơn quý khách — Hẹn gặp lại! ***</div>
        </div>
      </div>
    </ModalBackdrop>
  );
};

// ============================================================================
// 3. TỦ ĐỒ VỈA HÈ — side panel while the camera looks at the barber mirror
// ============================================================================
export const WardrobePanel: React.FC<{
  skin: LobbySkin;
  name: string;
  onboarding?: boolean;
  onNameChange: (name: string) => void;
  onChange: (skin: LobbySkin) => void;
  previewAlcohol: number;
  onPreviewAlcohol: (value: number) => void;
  onClose: () => void;
}> = ({ skin, name, onboarding = false, onNameChange, onChange, previewAlcohol, onPreviewAlcohol, onClose }) => {
  const [creatorStep, setCreatorStep] = useState(0);
  const isHumanCreator = skin.appearance.characterStyle === 'human';
  // VRoid (VRM) characters: pick the character, then skin, hair & clothes colours.
  const creatorSteps = ['Nhân vật', 'Da', 'Tóc & đồ', 'Thử độ say'];
  const updateAppearance = (patch: Partial<LobbySkin['appearance']>) =>
    onChange({
      ...skin,
      appearance: { ...skin.appearance, ...patch, characterStyle: 'human' },
    });
  const sections = [
    { key: 'avatar' as const, title: '🐾 Thú Bông', options: SKIN_AVATARS },
    { key: 'clothing' as const, title: '🎽 Áo Quần', options: SKIN_CLOTHES },
    { key: 'hat' as const, title: '🕶️ Phụ Kiện', options: SKIN_HATS },
    { key: 'glassType' as const, title: '🍺 Ly Cụng', options: SKIN_GLASSES },
  ];
  const humanSliders = (
    sliders: [keyof LobbySkin['appearance'], string][],
    className = 'grid grid-cols-2 gap-x-3 gap-y-2'
  ) => (
    <div className={className}>
      {sliders.map(([key, label]) => (
        <label key={key} className="block min-w-0">
          <span className="flex justify-between gap-1 text-[10px] font-bold text-amber-50">
            <span className="truncate">{label}</span>
            <span className="text-amber-300 tabular-nums">{skin.appearance[key]}%</span>
          </span>
          <input
            aria-label={label}
            type="range"
            min={0}
            max={100}
            value={skin.appearance[key] as number}
            onChange={(event) =>
              updateAppearance({ [key]: Number(event.target.value) } as Partial<LobbySkin['appearance']>)
            }
            className="w-full accent-amber-400"
          />
        </label>
      ))}
    </div>
  );
  return (
    <div className={`fixed ${onboarding ? 'z-[75]' : 'z-40'} left-3 right-3 bottom-3 sm:right-auto sm:top-20 sm:bottom-auto sm:w-[420px] ${onboarding ? 'max-h-[calc(100vh_-_1.5rem)]' : 'max-h-[58vh] sm:max-h-[calc(100vh-7rem)]'} overflow-y-auto laminated-menu rounded-2xl border-4 border-amber-400 shadow-2xl p-4 text-white animate-in slide-in-from-left-6 fade-in duration-200`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-neon text-xl text-amber-300">
            {onboarding && isHumanCreator
              ? `🎨 BƯỚC ${creatorStep + 1}/${creatorSteps.length} • ${creatorSteps[creatorStep].toUpperCase()}`
              : onboarding
              ? '🎨 TẠO NHÂN VẬT'
              : isHumanCreator
              ? '🧍 Tạo Nhân Vật'
              : '👕 Tủ Đồ Vỉa Hè'}
          </h2>
          {onboarding && <div className="text-[10px] text-amber-100/75 mt-0.5">Hồ sơ đã sẵn sàng — tạo người nhậu của bạn trước khi vào sảnh.</div>}
        </div>
        <button
          {...sfx}
          onClick={() => {
            if (onboarding && isHumanCreator && creatorStep < creatorSteps.length - 1) {
              setCreatorStep((step) => step + 1);
              return;
            }
            onClose();
          }}
          className="px-3 py-1.5 rounded-lg bg-amber-400 text-red-900 text-xs font-black cursor-pointer hover:bg-amber-300"
        >
          {onboarding && isHumanCreator && creatorStep < creatorSteps.length - 1
            ? 'Tiếp theo →'
            : onboarding
            ? '✓ Hoàn tất, vào sảnh'
            : '✓ Xong, Về Bàn'}
        </button>
      </div>
      {isHumanCreator && (
        <div className="grid grid-cols-5 gap-1 mb-3">
          {creatorSteps.map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={() => !onboarding && setCreatorStep(index)}
              aria-current={creatorStep === index ? 'step' : undefined}
              className={`rounded-lg px-1 py-1.5 text-[9px] font-black leading-tight ${
                creatorStep === index ? 'bg-amber-300 text-zinc-950' : 'bg-black/25 text-white/60'
              } ${onboarding ? 'cursor-default' : 'cursor-pointer hover:text-amber-100'}`}
            >
              <span className="block">{index + 1}</span>{step}
            </button>
          ))}
        </div>
      )}
      <label className="block text-[11px] font-bold text-amber-100 mb-1">Tên giang hồ</label>
      <input
        value={name}
        maxLength={22}
        onChange={(e) => onNameChange(e.target.value)}
        className="w-full mb-3 px-3 py-2 rounded-lg bg-black/30 border border-amber-300/50 text-sm font-bold focus:outline-none focus:border-amber-300"
      />
      {isHumanCreator ? (
        <section className="mb-3 rounded-xl border border-amber-300/25 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <div className="text-xs font-black text-amber-100">{creatorSteps[creatorStep]}</div>
              <div className="text-[10px] text-white/60">Xem nhân vật thay đổi trực tiếp ở gương phía sau.</div>
            </div>
            <button
              type="button"
              onClick={() => updateAppearance({ ...DEFAULT_HUMAN_APPEARANCE })}
              className="px-2 py-1 rounded-lg border border-white/15 bg-black/30 text-[10px] font-bold text-white/75 hover:text-amber-200 cursor-pointer"
            >
              Đặt lại
            </button>
          </div>

          {creatorStep === 0 && (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {([
                  ['male', '👨 Nam'],
                  ['female', '👩 Nữ'],
                ] as const).map(([gender, label]) => (
                  <button
                    key={gender}
                    type="button"
                    aria-pressed={skin.appearance.gender === gender}
                    onClick={() => updateAppearance({ gender })}
                    className={`rounded-xl border-2 px-3 py-2 text-xs font-black ${
                      skin.appearance.gender === gender
                        ? 'border-amber-200 bg-amber-300 text-zinc-950'
                        : 'border-white/10 bg-black/25 text-white/75'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/55">
                Nhân vật VRoid (anime). Đổi màu da, tóc và áo ở các bước sau.
              </p>
            </>
          )}

          {creatorStep === 1 && (
            <>
              <div className="text-[11px] font-bold text-amber-100 mb-2">🎨 Tông da</div>
              <div className="grid grid-cols-2 gap-2">
                {HUMAN_SKIN_TONES.map((tone) => {
                  const active = skin.appearance.humanSkinTone === tone.id;
                  return (
                    <button
                      key={tone.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => updateAppearance({ humanSkinTone: tone.id })}
                      className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-xs font-bold ${
                        active ? 'border-amber-200 bg-amber-300/20 text-amber-100' : 'border-white/10 bg-black/25 text-white/75'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full border border-white/40" style={{ backgroundColor: tone.color }} />
                      {tone.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[10px] text-white/55">Giữ chi tiết texture gốc của model, chỉ đổi tông màu.</p>
            </>
          )}

          {creatorStep === 2 && (
            <>
              <div className="text-[11px] font-bold text-amber-100 mb-2">🎨 Màu tóc</div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {([
                  ['natural', 'Màu gốc', 'linear-gradient(135deg, #8b5a3c, #3b2519)'],
                  ['black', 'Đen', '#171311'],
                  ['dark_brown', 'Nâu đen', '#34231d'],
                  ['brown', 'Nâu', '#65432e'],
                  ['blonde', 'Vàng nâu', '#a98654'],
                ] as const).map(([hairColor, label, color]) => (
                  <button
                    key={hairColor}
                    type="button"
                    aria-pressed={skin.appearance.hairColor === hairColor}
                    onClick={() => updateAppearance({ hairColor })}
                    className={`flex items-center gap-1.5 rounded-full px-2 py-1 border text-[10px] font-bold ${
                      skin.appearance.hairColor === hairColor ? 'border-amber-200 text-amber-100' : 'border-white/10 text-white/75'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-white/40" style={{ background: color }} />
                    {label}
                  </button>
                ))}
              </div>
              <div className="text-[11px] font-bold text-amber-100 mb-2">👕 Áo vỉa hè</div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['tshirt', 'Đồng phục gốc', '👕'],
                  ['hoodie', 'Xanh xám', '🧥'],
                ] as const).map(([topStyle, label, icon]) => (
                  <button
                    key={topStyle}
                    type="button"
                    aria-pressed={skin.appearance.topStyle === topStyle}
                    onClick={() => updateAppearance({ topStyle })}
                    className={`rounded-xl border-2 px-2 py-2 text-xs font-bold ${
                      skin.appearance.topStyle === topStyle
                        ? 'border-amber-200 bg-amber-300/20 text-amber-100'
                        : 'border-white/10 bg-black/25 text-white/75'
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-white/55">Màu áo được tô lại trên texture của model.</div>
            </>
          )}

          {creatorStep === 3 && (
            <label className="block">
              <span className="flex justify-between text-[11px] font-black text-amber-100">
                <span>🍺 Thử mặt khi say</span>
                <span className="text-rose-300">{previewAlcohol}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={previewAlcohol}
                onChange={(event) => onPreviewAlcohol(Number(event.target.value))}
                className="w-full accent-rose-400"
              />
              <span className="text-[10px] text-white/55">Mặt ửng đỏ, mắt chớp chậm và nhìn lệch dần theo độ cồn.</span>
            </label>
          )}
        </section>
      ) : (
        <>
          {sections.map((sec) => (
            <div key={sec.key} className="mb-3">
              <div className="text-xs font-black text-amber-100 mb-1.5">{sec.title}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {sec.options.map((opt) => {
                  const active = skin[sec.key] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      {...sfx}
                      onClick={() => {
                        sound.playBottleOpen();
                        onChange({ ...skin, [sec.key]: opt.id });
                      }}
                      className={`rounded-xl px-1.5 py-2 text-center border-2 transition cursor-pointer ${
                        active ? 'bg-amber-400 text-red-900 border-amber-200' : 'bg-black/25 border-white/10 hover:border-amber-300/60'
                      }`}
                    >
                      <div className="text-xl leading-none">{opt.icon}</div>
                      <div className="text-[10px] font-bold mt-1 leading-tight">{opt.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <section className="mb-3 rounded-xl border border-amber-300/25 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <div className="text-xs font-black text-amber-100">🪞 Gương nắn mặt</div>
                <div className="text-[10px] text-white/60">Tùy chỉnh sâu cho linh vật của bạn</div>
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...skin, appearance: { ...DEFAULT_CHIBI_APPEARANCE } })}
                className="px-2 py-1 rounded-lg border border-white/15 bg-black/30 text-[10px] font-bold text-white/75 hover:text-amber-200 cursor-pointer"
              >
                Đặt lại
              </button>
            </div>
            <div className="mb-3">
              <div className="text-[11px] font-bold text-amber-100 mb-1.5">🎨 Tông da</div>
              <div className="flex flex-wrap gap-1.5">
                {CHIBI_SKIN_TONES.map((tone) => {
                  const active = skin.appearance.skinTone === tone.id;
                  return (
                    <button
                      key={tone.id}
                      type="button"
                      title={tone.label}
                      aria-label={`Tông da ${tone.label}`}
                      aria-pressed={active}
                      onClick={() => onChange({ ...skin, appearance: { ...skin.appearance, skinTone: tone.id } })}
                      className={`flex items-center gap-1.5 rounded-full px-2 py-1 border text-[10px] font-bold cursor-pointer ${
                        active ? 'border-amber-200 bg-amber-300/20 text-amber-100' : 'border-white/10 bg-black/25 text-white/75'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-white/35" style={{ backgroundColor: tone.color }} />
                      {tone.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {humanSliders([
              ['eyeSize', '👀 Kích thước mắt'],
              ['eyeDistance', '↔️ Khoảng cách mắt'],
              ['eyeSlant', '🎭 Độ xếch mắt'],
              ['snoutWidth', skin.avatar === 'duck' ? '🦆 Bề ngang mỏ' : '🐽 Bề ngang mõm'],
              ['mouthSize', '👄 Kích thước miệng'],
              ['bodyBuild', '🍺 Độ tròn thân'],
            ])}
          </section>
        </>
      )}
      {isHumanCreator && onboarding && creatorStep > 0 && (
        <button
          type="button"
          onClick={() => setCreatorStep((step) => Math.max(0, step - 1))}
          className="w-full rounded-lg border border-white/15 bg-black/25 py-2 text-xs font-bold text-white/75 hover:text-amber-100"
        >
          ← Quay lại bước trước
        </button>
      )}
    </div>
  );
};

// ============================================================================
// 4. HỘ CHIẾU TỬU LƯỢNG — profile, "Thần Cồn" leaderboard, bill-dodging record
// ============================================================================
export const ProfilePanel: React.FC<{
  name: string;
  avatar: LobbySkin['avatar'];
  isHuman?: boolean;
  coins: number;
  toastCount: number;
  onClose: () => void;
}> = ({ name, avatar, isHuman = false, coins, toastCount, onClose }) => {
  const [tab, setTab] = useState<'passport' | 'rank'>('passport');
  const [bookOpen, setBookOpen] = useState(false);
  const [passport, setPassport] = useState<{ escaped: number; nights: number; pinned: MatchReceipt | null } | null>(null);
  const rank = drinkingRank(toastCount);

  // Real numbers + the photo pinned to the front page (from the Sổ Nợ)
  useEffect(() => {
    if (bookOpen) return;
    const token = localStorage.getItem('tram_nhau_auth_token');
    fetch(`/api/players/${encodeURIComponent(getNetPlayerId())}/receipts`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const pinned =
          (d.receipts as MatchReceipt[]).find((r) => r.receiptCode === d.pinnedReceiptCode && r.funnySnapshot) ?? null;
        setPassport({ escaped: d.lifetime.nightsEscaped, nights: d.lifetime.nights, pinned });
      })
      .catch(() => null);
  }, [bookOpen]);
  const leaderboard = [
    { name: 'Phi Quân', icon: '🐼', score: 312, title: 'Thần Cồn' },
    { name: 'Khoa Nguyễn', icon: '🐻', score: 287, title: 'Trùm Vỉa Hè' },
    { name: 'Tuấn Xỉn', icon: '🦆', score: 241, title: 'Trùm Vỉa Hè' },
    { name, icon: isHuman ? '🧑' : AVATAR_ICON[avatar], score: toastCount, title: rank.name, isMe: true },
    { name: 'Bảo Nguyễn', icon: '🐱', score: 96, title: 'Bợm Tập Sự' },
  ].sort((a, b) => b.score - a.score);

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="relative w-[min(480px,95vw)] max-h-[92vh] overflow-y-auto rounded-2xl bg-gradient-to-b from-emerald-900 to-emerald-950 border-4 border-amber-500/80 shadow-2xl text-white">
        <CloseButton onClose={onClose} />
        <div className="px-5 pt-5 pb-3 text-center border-b border-amber-500/30">
          <div className="text-[10px] tracking-[0.35em] text-amber-300/80">CỘNG HÒA BÀN NHẬU VỈA HÈ</div>
          <h2 className="font-neon text-2xl text-amber-300">📜 Hộ Chiếu Tửu Lượng</h2>
        </div>
        <div className="flex gap-1 p-2">
          {[
            { id: 'passport' as const, label: '🪪 Hộ Chiếu' },
            { id: 'rank' as const, label: '🏆 BXH Thần Cồn' },
            { id: 'history' as const, label: '📕 Lịch Sử Nhậu' },
          ].map((t) => (
            <button
              key={t.id}
              {...sfx}
              data-testid={`profile-tab-${t.id}`}
              onClick={() => (t.id === 'history' ? setBookOpen(true) : setTab(t.id))}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-black cursor-pointer ${
                t.id !== 'history' && tab === t.id ? 'bg-amber-400 text-emerald-950' : 'bg-black/25 text-white/80 hover:bg-black/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 pt-2">
          {tab === 'passport' && (
            <PassportCard
              name={name}
              avatar={avatar}
              coins={coins}
              toastCount={toastCount}
              escaped={passport?.escaped ?? null}
              nights={passport?.nights ?? null}
              pinnedPhoto={
                passport?.pinned
                  ? { src: passport.pinned.funnySnapshot, caption: passport.pinned.funnySnapshotCaption }
                  : null
              }
            />
          )}

          {tab === 'rank' && (
            <ol className="space-y-1.5">
              {leaderboard.map((row, i) => (
                <li
                  key={row.name}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                    'isMe' in row && row.isMe ? 'bg-amber-400/20 border border-amber-400/60' : 'bg-black/25'
                  }`}
                >
                  <span className="w-6 text-center font-black text-amber-300">{i === 0 ? '👑' : i + 1}</span>
                  <span className="text-xl">{row.icon}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold">{row.name}</span>
                    <span className="block text-[10px] text-white/55">{row.title}</span>
                  </span>
                  <span className="font-mono text-sm font-black">{row.score} 🍻</span>
                </li>
              ))}
            </ol>
          )}

        </div>
      </div>
      {bookOpen && <HangoverBook name={name} avatar={avatar} onClose={() => setBookOpen(false)} />}
    </ModalBackdrop>
  );
};

// ============================================================================
// 5. CÀI ĐẶT — volume, mic test, drunk-voice filter preview, graphics
// ============================================================================
export type GraphicsQuality = 'low' | 'high';

export const SettingsPanel: React.FC<{
  volume: number;
  onVolume: (v: number) => void;
  graphics: GraphicsQuality;
  onGraphics: (q: GraphicsQuality) => void;
  onClose: () => void;
}> = ({ volume, onVolume, graphics, onGraphics, onClose }) => {
  const [drunk, setDrunk] = useState(60);
  const [micLevel, setMicLevel] = useState(0);
  const [micOn, setMicOn] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  useEffect(() => () => sound.stopMicCheers(), []);

  const toggleMic = async () => {
    if (micOn) {
      sound.stopMicCheers();
      setMicOn(false);
      setMicLevel(0);
      return;
    }
    const ok = await sound.startMicCheers(
      () => {},
      () => setMicError('Không mở được micro — kiểm tra quyền truy cập của trình duyệt.'),
      (rms) => setMicLevel(rms)
    );
    setMicOn(ok);
  };

  const previewDrunkVoice = () => {
    const phrase = 'Một hai ba dzô anh em ơi';
    [...phrase].forEach((ch, i) => {
      setTimeout(() => sound.playAnimaleseBlip(ch.charCodeAt(0), drunk), i * 85);
    });
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="relative w-[min(420px,95vw)] rounded-2xl bg-zinc-900 border-2 border-zinc-700 shadow-2xl p-5 text-white">
        <CloseButton onClose={onClose} />
        <h2 className="font-neon text-xl text-amber-300 mb-4">⚙️ Cài Đặt</h2>

        <div className="mb-4">
          <div className="flex justify-between text-xs font-bold mb-1">
            <span className="flex items-center gap-1"><Volume2 className="w-3.5 h-3.5" /> Âm lượng tổng</span>
            <span className="font-mono">{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => onVolume(Number(e.target.value) / 100)}
            onPointerUp={() => sound.playClink()}
            className="w-full accent-amber-400"
          />
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span>🎤 Test Mic</span>
            <button
              {...sfx}
              onClick={toggleMic}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer ${
                micOn ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              {micOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
              {micOn ? 'Đang nghe…' : 'Bật mic'}
            </button>
          </div>
          <div className="h-3 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700">
            <div
              className={`h-full transition-[width] duration-75 ${micLevel > 0.45 ? 'bg-red-500' : 'bg-emerald-400'}`}
              style={{ width: `${Math.min(100, micLevel * 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">
            Hét "DZÔ!" vượt vạch đỏ là cả bàn cụng ly.
          </div>
          {micError && <div className="text-[11px] text-red-400 mt-1">{micError}</div>}
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs font-bold mb-1">
            <span>🥴 Thử bộ lọc "Giọng Say Rượu"</span>
            <span className="font-mono">{drunk}% cồn</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={drunk}
              onChange={(e) => setDrunk(Number(e.target.value))}
              className="flex-1 accent-amber-400"
            />
            <button
              {...sfx}
              onClick={previewDrunkVoice}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[11px] font-black cursor-pointer"
            >
              ▶ Nghe thử
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs font-bold mb-1.5">🖥️ Đồ họa</div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'high', label: 'Đẹp (đổ bóng, khử răng cưa)' },
                { id: 'low', label: 'Mượt (máy yếu / điện thoại)' },
              ] as { id: GraphicsQuality; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                {...sfx}
                onClick={() => {
                  sound.playBottleOpen();
                  onGraphics(opt.id);
                }}
                className={`rounded-lg px-2 py-2 text-[11px] font-bold border-2 cursor-pointer ${
                  graphics === opt.id ? 'border-amber-400 bg-amber-400/15' : 'border-zinc-700 hover:border-zinc-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
};

// ============================================================================
// 6. RỦ NHẬU — invite popup for an empty stool
// ============================================================================
export const InvitePopup: React.FC<{
  roomCode: string;
  friends: LobbyFriend[];
  seatedIds: string[];
  onInvite: (friendId: string) => void;
  onClose: () => void;
}> = ({ roomCode, friends, seatedIds, onInvite, onClose }) => {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/?ban=${roomCode}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard can be blocked in iframes; the link stays visible for manual copy
    }
    sound.playBottleOpen();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="relative w-[min(400px,95vw)] max-h-[88vh] overflow-y-auto rounded-2xl laminated-menu border-4 border-amber-400 shadow-2xl p-4 text-white">
        <CloseButton onClose={onClose} />
        <h2 className="font-neon text-xl text-amber-300 mb-1">➕ Rủ Nhậu</h2>
        <div className="text-[11px] text-white/75 mb-3">Ghế nhựa còn trống — kéo chiến hữu vào bàn!</div>

        <div className="rounded-xl bg-black/30 border border-white/15 p-2.5 mb-3">
          <div className="text-[10px] text-white/60 mb-1">Link mời nhanh (dán vào Discord / Messenger)</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-[11px] text-amber-200 select-all">{link}</code>
            <button
              {...sfx}
              onClick={copy}
              className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-red-900 text-[11px] font-black flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Đã copy' : 'Copy'}
            </button>
          </div>
          <div className="text-[10px] text-white/50 mt-1">
            Mã bàn: <b className="font-mono tracking-widest text-white/80">{roomCode}</b>
          </div>
        </div>

        <div className="text-xs font-black text-amber-100 mb-1.5">👥 Bạn bè & 🤖 NPC</div>
        <div className="space-y-1.5">
          {friends.map((f) => {
            const seated = seatedIds.includes(f.id);
            const disabled = !f.invitable || seated;
            return (
              <div key={f.id} className="flex items-center gap-2.5 rounded-xl bg-black/25 px-2.5 py-2">
                <span className="text-2xl">{AVATAR_ICON[f.avatar]}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate">{f.name}</span>
                  <span className="block text-[10px] text-white/55 truncate">{f.note}</span>
                </span>
                <button
                  {...sfx}
                  disabled={disabled}
                  onClick={() => onInvite(f.id)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-black cursor-pointer disabled:cursor-not-allowed bg-amber-400 hover:bg-amber-300 text-red-900 disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  {seated
                    ? 'Đã ngồi'
                    : f.invitable
                    ? 'Rủ!'
                    : f.status === 'offline'
                    ? '📵 Offline'
                    : f.status === 'drinking' && f.id.startsWith('npc_off_')
                    ? 'Đang nhậu'
                    : 'Đã rủ ⏳'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </ModalBackdrop>
  );
};
