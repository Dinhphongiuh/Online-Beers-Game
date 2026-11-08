import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { sound } from '../game/audio';
import type { CharacterAvatar } from '../game/types';
import { AVATAR_ICON, drinkingRank } from './lobbyData';
import { DRUNK_ARCHETYPES } from '../components/AuthPanelModal';

/** What /api/auth/me tells us about the account behind the passport. */
export interface AccountInfo {
  userId: string;
  username: string;
  isGuest?: boolean;
  createdAt?: string;
  drunkArchetype?: string;
  declaredTolerance?: number;
}

const MARKS: Record<CharacterAvatar, string> = {
  dog: 'Vẫy đuôi khi nghe tiếng khui bia',
  cat: 'Cào ghế nhựa sau lon thứ 3',
  panda: 'Quầng thâm mắt do thức nhậu kinh niên',
  duck: 'Đi lạch bạch sau ly thứ 5',
  bear: 'Ôm cây xanh khi quá 80% cồn',
  hamster: 'Má phồng vì nhét đầy đậu phộng',
};

const BLOOD_TYPES = ['Bia Hơi (+)', 'Tiger Nâu (O)', 'Rượu Đế (AB)', 'Sài Gòn Xanh (A)', 'Trà Đá (−)'];

const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/** "Nguyễn Văn Bợm" → "NGUYEN<VAN<BOM" for the machine-readable zone. */
const mrzText = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '<')
    .replace(/^<+|<+$/g, '');

const mrzLine = (s: string, len = 44) => (s + '<'.repeat(len)).slice(0, len);

async function copyText(text: string) {
  try {
    // Some browsers leave the promise pending (unfocused / background tab): give up after 800ms
    const ok = await Promise.race([
      navigator.clipboard.writeText(text).then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 800)),
    ]);
    if (ok) return true;
    throw new Error('clipboard timeout');
  } catch {
    // Clipboard API can be blocked (iframes / http): fall back to a hidden textarea
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

const CopyField: React.FC<{ label: string; value: string; mono?: boolean; testId: string }> = ({
  label,
  value,
  mono,
  testId,
}) => {
  const [copied, setCopied] = useState<'ok' | 'manual' | null>(null);
  const valueRef = React.useRef<HTMLSpanElement>(null);
  const onCopy = async () => {
    if (!value) return;
    if (await copyText(value)) {
      sound.playBottleOpen();
      setCopied('ok');
    } else {
      // Clipboard blocked: pre-select the text so Ctrl+C just works
      const el = valueRef.current;
      const sel = window.getSelection();
      if (el && sel) {
        const range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      setCopied('manual');
    }
    window.setTimeout(() => setCopied(null), 2200);
  };
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-[#7a5c3a]">{label}</div>
      <div className="flex items-center gap-1.5">
        <span
          ref={valueRef}
          data-testid={`${testId}-value`}
          className={`min-w-0 flex-1 truncate select-all font-black text-[#2b1a0e] ${mono ? 'font-mono text-[13px] tracking-wide' : 'text-[15px]'}`}
          title={value}
        >
          {value || '—'}
        </span>
        <button
          type="button"
          data-testid={`${testId}-copy`}
          onClick={onCopy}
          disabled={!value}
          className={`shrink-0 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black cursor-pointer transition ${
            copied === 'ok'
              ? 'bg-emerald-600 text-white'
              : copied === 'manual'
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-[#7f1d1d] text-amber-100 hover:bg-[#991b1b]'
          } disabled:opacity-40`}
        >
          {copied === 'ok' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied === 'ok' ? 'Đã copy' : copied === 'manual' ? 'Bấm Ctrl+C' : 'Copy'}
        </button>
      </div>
    </div>
  );
};

/**
 * Hộ Chiếu Tửu Lượng — a passport booklet page: crest, photo with a seal, funny official
 * fields, entry/exit stamps, and the copyable name + passport ID (share it to get friended).
 */
export const PassportCard: React.FC<{
  name: string;
  avatar: CharacterAvatar;
  coins: number;
  toastCount: number;
  escaped: number | null;
  nights: number | null;
  pinnedPhoto?: { src: string; caption: string } | null;
  /** Someone else's passport (friend view): use this account instead of /api/auth/me. */
  account?: AccountInfo;
}> = ({ name, avatar, coins, toastCount, escaped, nights, pinnedPhoto, account: givenAccount }) => {
  const [ownAccount, setAccount] = useState<AccountInfo | null>(null);
  const account = givenAccount ?? ownAccount;
  const isFriendView = Boolean(givenAccount);
  const rank = drinkingRank(toastCount);

  useEffect(() => {
    if (givenAccount) return;
    const token = localStorage.getItem('tram_nhau_auth_token');
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.user && setAccount(d.user))
      .catch(() => null);
  }, [givenAccount]);

  const displayName = account?.username || name;
  const passportId = account?.userId ?? '';
  const issued = account?.createdAt ? new Date(account.createdAt) : null;
  const archetype = DRUNK_ARCHETYPES.find((a) => a.id === account?.drunkArchetype);
  const blood = BLOOD_TYPES[(passportId.length + displayName.length) % BLOOD_TYPES.length];
  const dodgeRate = nights ? Math.round(((escaped ?? 0) / nights) * 100) : 0;

  const mrz1 = mrzLine(`P<VNM${mrzText(displayName)}<<BOM<NHAU`);
  const mrz2 = mrzLine(`${mrzText(passportId || 'KHACH')}<0VNM<BIA<HOI<${String(toastCount).padStart(4, '0')}`);

  return (
    <div data-testid="passport-card" className="relative">
      {/* Cover strip */}
      <div className="rounded-t-xl bg-gradient-to-b from-[#7f1d1d] to-[#5b1414] px-4 py-2.5 text-center shadow-inner border-b-4 border-amber-500/70">
        <div className="text-[9px] font-black tracking-[0.25em] text-amber-200/90">
          CỘNG HÒA XÃ HỘI CHỦ NGHĨA BÀN NHẬU
        </div>
        <div className="text-[9px] italic text-amber-200/70">Độc lập – Tự do – Say xỉn</div>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-amber-300 bg-amber-400/20 text-lg">
            🍺
          </span>
          <div className="text-left leading-none">
            <div className="font-neon text-lg text-amber-300">HỘ CHIẾU TỬU LƯỢNG</div>
            <div className="text-[9px] font-bold tracking-[0.3em] text-amber-200/80">DRINKING PASSPORT</div>
          </div>
        </div>
      </div>

      {/* Data page */}
      <div
        className="relative overflow-hidden rounded-b-xl border-x-2 border-b-2 border-[#c9a66b] px-3.5 pt-3 pb-2 text-[#2b1a0e]"
        style={{
          backgroundColor: '#f6ead0',
          backgroundImage:
            'repeating-linear-gradient(135deg, rgba(122,92,58,0.05) 0 2px, transparent 2px 9px), radial-gradient(circle at 80% 20%, rgba(220,38,38,0.08), transparent 45%)',
        }}
      >
        {/* Watermark */}
        <div className="pointer-events-none absolute right-2 top-16 text-[90px] opacity-[0.06] rotate-[-15deg] select-none">🍻</div>

        <div className="flex gap-3">
          {/* Photo */}
          <div className="relative shrink-0">
            {pinnedPhoto ? (
              <div className="w-[104px] bg-white p-1 pb-5 shadow-md rotate-[-3deg] relative" title="Ảnh ghim trang nhất">
                <img src={pinnedPhoto.src} alt="" className="w-full aspect-[3/4] object-cover sepia-[30%]" />
                <div className="absolute bottom-0.5 left-1 right-1 text-[7px] leading-tight text-zinc-600 line-clamp-2">
                  {pinnedPhoto.caption}
                </div>
              </div>
            ) : (
              <div className="w-[96px] h-[120px] rounded-sm border-2 border-[#7a5c3a] bg-gradient-to-b from-sky-100 to-sky-200 flex flex-col items-center justify-center shadow-inner">
                <span className="text-6xl blur-[0.3px]">{AVATAR_ICON[avatar]}</span>
                <span className="text-[7px] text-sky-900/70">ảnh chụp lúc 2h sáng</span>
              </div>
            )}
            {/* Seal over the photo corner */}
            <div className="absolute -bottom-2 -right-3 grid h-12 w-12 place-items-center rounded-full border-2 border-red-700/80 text-center text-[6px] font-black leading-tight text-red-700/80 rotate-[-18deg] bg-red-50/30">
              QUÁN
              <br />
              TƯ ĐỰC
              <br />★
            </div>
          </div>

          {/* Fields */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <CopyField label="Họ và tên / Name" value={displayName} testId="passport-name" />
            <CopyField label="Mã hộ chiếu / Passport ID" value={passportId} mono testId="passport-id" />
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#7a5c3a]">Loại / Type</div>
                <div className="font-black">{account?.isGuest ? '⚡ Nhậu Chui' : '🎫 Bợm Chính Hiệu'}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#7a5c3a]">Quốc tịch</div>
                <div className="font-black">Vỉa Hè 🇻🇳</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#7a5c3a]">Nhóm máu</div>
                <div className="font-black">{blood}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#7a5c3a]">Hệ khi say</div>
                <div className="font-black truncate">{archetype ? `${archetype.icon} ${archetype.name}` : '🧐 Chưa khai báo'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#7a5c3a]">Ngày cấp</div>
            <div className="font-black">{issued ? fmtDate(issued) : 'Hôm qua (không nhớ)'}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#7a5c3a]">Có giá trị đến</div>
            <div className="font-black text-red-800">Khi vợ phát hiện</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#7a5c3a]">Nơi cấp</div>
            <div className="font-black">Quán Tư Đực, Bờ Kè</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#7a5c3a]">Cấp tửu lượng</div>
            <div className="font-black text-amber-800">
              Lv.{rank.level} {rank.name}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#7a5c3a]">Đặc điểm nhận dạng</div>
            <div className="font-black">{MARKS[avatar]}</div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
          {[
            ['🍻', 'Hô Dzô', `${toastCount} lần`],
            ['🪙', 'Nắp bia', `${coins}`],
            ['🥷', 'Trốn bill', nights === null ? '—' : `${escaped ?? 0}/${nights} (${dodgeRate}%)`],
          ].map(([icon, label, value]) => (
            <div key={label} className="rounded-md border border-[#c9a66b] bg-white/50 px-1 py-1">
              <div className="text-sm leading-none">{icon}</div>
              <div className="text-[8px] font-bold uppercase text-[#7a5c3a]">{label}</div>
              <div className="text-[11px] font-black">{value}</div>
            </div>
          ))}
        </div>

        {/* Visa page: entry/exit stamps (own row so they never cover the data) */}
        <div className="mt-2.5 flex items-center justify-around gap-2 rounded-md border border-dashed border-[#c9a66b] bg-white/30 px-2 py-2">
          <span className="text-[8px] font-bold uppercase tracking-wider text-[#7a5c3a] [writing-mode:vertical-rl] rotate-180">
            Thị thực
          </span>
          <span className="rotate-[-8deg] rounded border-[3px] border-double border-emerald-700/75 px-1.5 py-0.5 text-center text-[8px] font-black leading-tight text-emerald-700/80">
            NHẬP CẢNH BỜ KÈ
            <br />
            18:00 ✓
          </span>
          <span className="rotate-[6deg] rounded-full border-[3px] border-red-700/65 px-2 py-1 text-center text-[8px] font-black leading-tight text-red-700/75">
            XUẤT CẢNH
            <br />
            2H SÁNG
          </span>
          <span className="rotate-[-4deg] rounded border-2 border-blue-800/60 px-1.5 py-0.5 text-center text-[8px] font-black leading-tight text-blue-800/75">
            CẤM LÁI XE
            <br />
            SAU 1 LON
          </span>
          <span className="rotate-[10deg] rounded-sm border-2 border-amber-700/70 px-1.5 py-0.5 text-center text-[8px] font-black leading-tight text-amber-800/80">
            ĐÃ KIỂM ĐỊNH
            <br />
            ĐỘ LẦY ★★★
          </span>
        </div>

        {/* Machine readable zone */}
        <div className="mt-2.5 rounded bg-white/60 px-1.5 py-1 font-mono text-[9.5px] leading-tight tracking-[0.12em] text-[#2b1a0e]/80 overflow-hidden whitespace-nowrap">
          <div>{mrz1}</div>
          <div>{mrz2}</div>
        </div>
        {!isFriendView && (
          <div className="mt-1 text-center text-[9px] text-[#7a5c3a]">
            💡 Gửi <b>Mã hộ chiếu</b> hoặc biệt danh cho bạn bè để họ kết bạn với bạn
          </div>
        )}
      </div>
    </div>
  );
};
