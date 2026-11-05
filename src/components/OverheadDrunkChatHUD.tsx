import React, { useEffect, useRef, useState } from 'react';
import { Player } from '../game/types';
import { sound } from '../game/audio';
import {
  MessageCircle,
  Send,
  Compass,
  Volume2,
  Flame,
  PhoneCall,
  CloudRain,
  Sparkles,
  X,
} from 'lucide-react';

export type BubbleVisualStyle =
  | 'NORMAL'
  | 'TIPS_BUBBLE'
  | 'WOBBLE_DRUNK'
  | 'BROKEN_SLUR';

export interface ProcessedDrunkChat {
  rawText: string;
  displayText: string;
  bubbleStyle: BubbleVisualStyle;
  isShoutSpike: boolean;
  wasKeywordMutated: boolean;
}

const DRUNK_QUOTES = [
  'Tao nói thật với mày nhé, tao coi mày như anh em ruột!',
  'Tao chưa say! Đứa nào bảo tao say bước ra đây?!',
  'Uống vì tương lai con em chúng ta... ực... 100% nhé!',
  'Tiền bạc phù du! Đêm nay anh bao... ủa ví anh đâu rồi?',
  'Sao cái bàn hôm nay nó cứ xoay vòng vòng thế nhỉ anh em?',
];

const BROKEN_SLUR_QUOTES = [
  'Huhu tại saooo cô ấy lại bỏ taooo... ực... đưa thêm két nữa coi!',
  'Anh em ơiii... tao nhìn thấy 3 bà chủ quán đang cầm 6 chiếc dép tổ ong... ợ...',
  'Đứa nào vừa lấy cái ghế nhựa của taooo... tao đang ngồi dưới đất hả?! 🥴',
  'Sếp ơi mai cho em nghỉ phép... em bị ngộ độc thực phẩm... ực... 1, 2, 3 Dzô!',
];

export const QUICK_CHAT_WHEEL_ITEMS = [
  { label: '🍻 Dzô đi!', text: '1, 2, 3 Dzô đi anh em ơi!' },
  { label: '🥢 Gắp mồi coi!', text: 'Gắp miếng mồi coi!' },
  { label: '🛎️ Gọi chủ quán!', text: 'Ai gọi chủ quán thêm đá đi!' },
  { label: '🙏 Tha cho tao!', text: 'Tha cho tao chuyến này đi!' },
  { label: '🏃 Xin về trước', text: 'Thôi muộn rồi tao xin về nghỉ trước nhé' },
  { label: '🤬 Ai bảo tao say?!', text: 'ĐỨA NÀO BẢO TAO SAY HẢ?!' },
  { label: '🧾 Tính tiền đi', text: 'Tính tiền bill đi anh em ơi' },
  { label: '❤️ Tâm sự bạn hiền', text: 'Phi Quân ơi tao nói cái này với mày nhé' },
];

export function processDrunkChat(
  rawText: string,
  alcoholLevel: number
): ProcessedDrunkChat {
  const trimmed = rawText.trim();
  // Detect Physics Text Shout: contains '!' or >= 50% uppercase letters
  const letters = trimmed.replace(/[^a-zA-ZÀ-ỹ]/g, '');
  const upperLetters = letters.replace(/[^A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]/g, '');
  const isAllCaps = letters.length >= 4 && upperLetters.length / letters.length >= 0.6;
  const isShoutSpike = trimmed.includes('!') || isAllCaps;

  // 1. Tỉnh táo (0 - 30%): 100% nguyên bản
  if (alcoholLevel <= 30) {
    return {
      rawText: trimmed,
      displayText: trimmed,
      bubbleStyle: 'NORMAL',
      isShoutSpike,
      wasKeywordMutated: false,
    };
  }

  // 2. Ngà ngà say (31 - 60%): Kéo dài nguyên âm & chèn tiếng nấc "...ực..."
  if (alcoholLevel <= 60) {
    const slurred = trimmed
      .replace(/([aăâeêioôơuưy])/gi, (match) =>
        Math.random() < 0.35 ? match.repeat(3) : match
      )
      .replace(/\s+/g, () => (Math.random() < 0.28 ? ' ...ực... ' : ' '));
    return {
      rawText: trimmed,
      displayText: slurred,
      bubbleStyle: 'TIPS_BUBBLE',
      isShoutSpike,
      wasKeywordMutated: false,
    };
  }

  // 3. Kho Tàng "Văn Mẫu Dân Nhậu" (Keyword Matching khi cồn > 60%)
  if (/về|nghỉ|thôi|tạm biệt/i.test(trimmed)) {
    return {
      rawText: trimmed,
      displayText:
        'Về là về thế nào?! Hôm nay không say không về! Đứa nào về làm con cún! 🍺',
      bubbleStyle: alcoholLevel > 80 ? 'BROKEN_SLUR' : 'WOBBLE_DRUNK',
      isShoutSpike: true,
      wasKeywordMutated: true,
    };
  }

  if (/say|xỉn|mệt|chóng mặt|đô/i.test(trimmed)) {
    return {
      rawText: trimmed,
      displayText:
        'Tao chưa say nhé! Đứa nào bảo tao say bước ra đây uống solo 1-1 với tao!',
      bubbleStyle: alcoholLevel > 80 ? 'BROKEN_SLUR' : 'WOBBLE_DRUNK',
      isShoutSpike: true,
      wasKeywordMutated: true,
    };
  }

  if (/tiền|bill|tính tiền|hóa đơn|trả|bao/i.test(trimmed)) {
    return {
      rawText: trimmed,
      displayText:
        'Tiền bạc tầm này quan trọng gì! Để tao... ủa mà ví tao để quên ở quần kia rồi anh em ơi...',
      bubbleStyle: alcoholLevel > 80 ? 'BROKEN_SLUR' : 'WOBBLE_DRUNK',
      isShoutSpike,
      wasKeywordMutated: true,
    };
  }

  const friendMatch = trimmed.match(
    /phi quân|quân|khoa nguyên|khoa|nguyên|bảo nguyễn|bảo|bạn|mày/i
  );
  if (friendMatch) {
    const matchedLower = friendMatch[0].toLowerCase();
    const friendName =
      matchedLower.includes('quân')
        ? 'Phi Quân (Gấu Trúc)'
        : matchedLower.includes('khoa') || matchedLower.includes('nguyên')
        ? 'Khoa Nguyên (Gấu Nâu)'
        : matchedLower.includes('bảo')
        ? 'Bảo Nguyễn'
        : 'Phi Quân';
    return {
      rawText: trimmed,
      displayText: `Ê ${friendName}, tao giấu mày chuyện này lâu lắm rồi... hồi xưa tao lỡ lấy dép tổ ong của mày! 😭`,
      bubbleStyle: alcoholLevel > 80 ? 'BROKEN_SLUR' : 'WOBBLE_DRUNK',
      isShoutSpike,
      wasKeywordMutated: true,
    };
  }

  // 4. Quắc cần câu (81% - 99%): Mất kiểm soát hoàn toàn, chữ rơi rụng
  if (alcoholLevel > 80) {
    const brokenQuote =
      BROKEN_SLUR_QUOTES[Math.floor(Math.random() * BROKEN_SLUR_QUOTES.length)];
    return {
      rawText: trimmed,
      displayText: brokenQuote,
      bubbleStyle: 'BROKEN_SLUR',
      isShoutSpike,
      wasKeywordMutated: true,
    };
  }

  // 5. Say mềm (61% - 80%): 55% tỉ lệ "Rượu vào lời ra" hoặc đảo chữ cái + chèn icon 🍺🥴
  const replaceChance = Math.max(0.45, (alcoholLevel - 50) / 50);
  if (Math.random() < replaceChance) {
    const randomQuote =
      DRUNK_QUOTES[Math.floor(Math.random() * DRUNK_QUOTES.length)];
    return {
      rawText: trimmed,
      displayText: randomQuote,
      bubbleStyle: 'WOBBLE_DRUNK',
      isShoutSpike,
      wasKeywordMutated: true,
    };
  }

  const heavySlur =
    trimmed
      .split('')
      .map((char) => (Math.random() < 0.25 ? char.toUpperCase() : char))
      .join('') + ' ...ợ... 🍺🥴';

  return {
    rawText: trimmed,
    displayText: heavySlur,
    bubbleStyle: 'WOBBLE_DRUNK',
    isShoutSpike,
    wasKeywordMutated: false,
  };
}

interface OverheadDrunkChatHUDProps {
  userPlayer: Player;
  activeChatBubble: ProcessedDrunkChat | null;
  exCallQTEActive: boolean;
  exCallTargetName: 'Người Yêu Cũ 💔' | 'Sếp Tổng 🤬';
  exCallCountdown: number;
  exCallSnatchClicks: number;
  exCallResultReply: string | null;
  isLovesickUnderTable: boolean;
  lovesickTimer: number;
  onSendChat: (rawText: string, processed: ProcessedDrunkChat) => void;
  onSnatchExPhonePhysical: () => void;
  onInterruptExPhoneWithPeanutOrIce: () => void;
}

export const OverheadDrunkChatHUD: React.FC<OverheadDrunkChatHUDProps> = ({
  userPlayer,
  activeChatBubble,
  exCallQTEActive,
  exCallTargetName,
  exCallCountdown,
  exCallSnatchClicks,
  exCallResultReply,
  isLovesickUnderTable,
  lovesickTimer,
  onSendChat,
  onSnatchExPhonePhysical,
  onInterruptExPhoneWithPeanutOrIce,
}) => {
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [isWheelOpen, setIsWheelOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [typedLength, setTypedLength] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Typewriter effect + Animalese / Minions Gibberish TTS per character
  useEffect(() => {
    if (!activeChatBubble) {
      setTypedLength(0);
      return;
    }
    setTypedLength(0);
    const fullText = activeChatBubble.displayText;
    let current = 0;

    const interval = setInterval(() => {
      current += 1;
      setTypedLength(current);
      if (current <= fullText.length) {
        const ch = fullText.charCodeAt(current - 1);
        if (ch > 32 && current % 2 === 1) {
          sound.playAnimaleseBlip(ch, userPlayer.alcoholLevel);
        }
      } else {
        clearInterval(interval);
      }
    }, 32);

    return () => clearInterval(interval);
  }, [activeChatBubble]);

  // Global keyboard shortcuts: [Enter] to type chat, [Q] to toggle Quick-Chat Wheel
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') {
          setIsInputOpen(false);
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        setIsWheelOpen(false);
        setIsInputOpen(true);
        setTimeout(() => inputRef.current?.focus(), 40);
      } else if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setIsInputOpen(false);
        setIsWheelOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSubmitText = (textToProcess: string) => {
    if (!textToProcess.trim()) return;
    const processed = processDrunkChat(textToProcess, userPlayer.alcoholLevel);
    onSendChat(textToProcess, processed);
    setInputText('');
    setIsInputOpen(false);
    setIsWheelOpen(false);
  };

  // Auto-typing message for Ex / Boss Nokia Messenger QTE
  const nokiaDraftText =
    exCallTargetName === 'Người Yêu Cũ 💔'
      ? 'Em ngủ chưa... anh nhớ em quá quay lại với anh đi huhu...'
      : 'Sếp ơi mai em nghỉ việc nhé công ty hãm quá em đi nhậu đây...';
  const nokiaProgressRatio = Math.max(0, Math.min(1, (10 - exCallCountdown) / 10));
  const nokiaTypedChars = Math.max(
    4,
    Math.floor(nokiaDraftText.length * nokiaProgressRatio)
  );

  return (
    <>
      {/* 1. 3D BILLBOARD OVERHEAD CHAT BUBBLE (Floating directly above User Character at bottom-center) */}
      {activeChatBubble && (
        <div className="fixed bottom-44 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center max-w-md w-[92vw]">
          <div
            className={`relative px-4 py-3 shadow-2xl transition-all duration-200 ${
              activeChatBubble.isShoutSpike
                ? 'bg-red-950/95 border-4 border-red-500 text-amber-200 rounded-3xl scale-105 shadow-[0_0_35px_rgba(239,68,68,0.75)]'
                : activeChatBubble.bubbleStyle === 'NORMAL'
                ? 'bg-white text-zinc-950 border-2 border-zinc-300 rounded-2xl'
                : activeChatBubble.bubbleStyle === 'TIPS_BUBBLE'
                ? 'bg-amber-50 text-zinc-900 border-2 border-amber-400 rounded-2xl -rotate-2'
                : activeChatBubble.bubbleStyle === 'WOBBLE_DRUNK'
                ? 'bg-pink-100 text-rose-950 border-2 border-pink-400 rounded-3xl rotate-2 animate-bounce'
                : 'bg-purple-950/95 text-purple-100 border-2 border-dashed border-amber-400 rounded-3xl -rotate-3'
            }`}
          >
            {/* Header badge showing Alcohol Mutator status */}
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-80 flex items-center gap-1">
                <Volume2 className="w-3 h-3" />
                {userPlayer.name} ({userPlayer.alcoholLevel}% Cồn)
              </span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-black/15">
                {activeChatBubble.isShoutSpike
                  ? '💥 ĐẬP BÀN RẦM!'
                  : activeChatBubble.bubbleStyle === 'NORMAL'
                  ? 'Tỉnh Táo 100%'
                  : activeChatBubble.bubbleStyle === 'TIPS_BUBBLE'
                  ? '🍺 Dính Chữ & Nấc Cụt'
                  : activeChatBubble.bubbleStyle === 'WOBBLE_DRUNK'
                  ? '🥴 Rượu Vào Lời Ra!'
                  : '💀 Quắc Cần Câu Rơi Chữ'}
              </span>
            </div>

            {/* If mutated from original rawText, show tiny strikethrough of what player intended to say */}
            {activeChatBubble.wasKeywordMutated && (
              <div className="text-[10px] opacity-70 line-through mb-0.5">
                Định nói: "{activeChatBubble.rawText}"
              </div>
            )}

            {/* Animated Physics Text Content */}
            <div
              className={`font-black leading-snug ${
                activeChatBubble.isShoutSpike ? 'text-base sm:text-lg uppercase' : 'text-sm sm:text-base'
              }`}
            >
              {activeChatBubble.bubbleStyle === 'WOBBLE_DRUNK' ||
              activeChatBubble.bubbleStyle === 'BROKEN_SLUR'
                ? activeChatBubble.displayText
                    .slice(0, typedLength)
                    .split('')
                    .map((ch, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-block',
                          transform:
                            activeChatBubble.bubbleStyle === 'BROKEN_SLUR' && idx % 5 === 0
                              ? 'translateY(5px) rotate(12deg)'
                              : idx % 2 === 0
                              ? 'translateY(-1.5px)'
                              : 'translateY(1.5px)',
                          fontSize: idx % 3 === 0 ? '1.12em' : '0.94em',
                        }}
                      >
                        {ch === ' ' ? '\u00A0' : ch}
                      </span>
                    ))
                : activeChatBubble.displayText.slice(0, typedLength)}
            </div>

            {/* Speech bubble pointer triangle */}
            <div className="w-3.5 h-3.5 bg-inherit border-b-2 border-r-2 border-inherit rotate-45 absolute -bottom-2 left-1/2 -translate-x-1/2" />
          </div>
        </div>
      )}

      {/* 2. OVERHEAD NOKIA / MESSENGER BUBBLE FOR "GỌI ĐIỆN / NHẮN TIN NGƯỜI YÊU CŨ & SẾP TỔNG" (85% CỒN) */}
      {exCallQTEActive && (
        <div className="fixed top-36 left-1/2 -translate-x-1/2 z-40 pointer-events-auto w-[min(460px,94vw)]">
          <div className="bg-zinc-950/95 border-2 border-rose-500 rounded-3xl p-3.5 shadow-[0_0_45px_rgba(244,63,94,0.55)] text-white">
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-rose-500/30">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-600 flex items-center justify-center animate-ping">
                  <PhoneCall className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-black text-rose-300 uppercase">
                    📱 ĐANG SOẠN TIN GỬI: "{exCallTargetName}"
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Cấp cứu trong <strong className="text-rose-400">{exCallCountdown}s</strong> trước khi bấm nút GỬI!
                  </div>
                </div>
              </div>
              <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Đã cản: {exCallSnatchClicks}/5
              </span>
            </div>

            {/* Nokia / Messenger Screen Bubble */}
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-2.5 mb-2.5 font-mono text-xs text-emerald-300">
              <div className="text-[10px] text-zinc-400 mb-0.5">
                💬 Màn hình điện thoại đang tự bấm:
              </div>
              <div>
                "{nokiaDraftText.slice(0, nokiaTypedChars)}
                <span className="animate-pulse">▋</span>"
              </div>
            </div>

            {/* 2 Rescue Methods */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onSnatchExPhonePhysical}
                className="py-2 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer transition active:scale-95"
              >
                🔥 Cách 1: Giật ĐT Ném Vào Nồi Lẩu!
              </button>
              <button
                onClick={onInterruptExPhoneWithPeanutOrIce}
                className="py-2 px-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs cursor-pointer transition active:scale-95"
              >
                🥜🧊 Cách 2: Ném Đậu / Tạt Đá Cứu Bạn!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. GIANT BLOCK REPLY & BLACK RAINCLOUD WHEN EX/BOSS MESSAGE IS SENT */}
      {exCallResultReply && (
        <div className="fixed top-36 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="bg-red-950 border-4 border-red-500 rounded-3xl px-5 py-3 text-center shadow-2xl animate-bounce">
            <div className="text-[10px] font-black text-emerald-300 mb-0.5">
              ĐÃ GỬI ✔️ — Tin nhắn phản hồi tức thì:
            </div>
            <div className="text-lg sm:text-xl font-black text-white tracking-wider">
              {exCallResultReply}
            </div>
          </div>
        </div>
      )}

      {isLovesickUnderTable && (
        <div className="fixed bottom-44 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center">
          <div className="bg-zinc-900/95 border border-sky-500/50 rounded-2xl px-3.5 py-2 text-xs font-bold text-sky-300 flex items-center gap-2 shadow-xl">
            <CloudRain className="w-5 h-5 text-sky-400 animate-bounce" />
            <span>
              🌧️ Đám Mây Đen Suy Tình Dưới Gầm Bàn ({lovesickTimer}s) — Giảm 50% tốc độ!
            </span>
          </div>
        </div>
      )}

      {/* 4. FLOATING QUICK-CHAT & KEYBOARD BUTTONS (Bottom-Left above Dock; bottom-right belongs to the Open-World HUD) */}
      <div className="fixed bottom-[6.5rem] left-3 z-30 flex flex-col items-start gap-2 pointer-events-auto">
        {/* Quick-Chat Wheel Popup [Q] */}
        {isWheelOpen && (
          <div className="w-72 sm:w-80 bg-zinc-950/95 border-2 border-amber-500/80 rounded-3xl p-3 shadow-2xl text-white mb-1">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800">
              <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                <Compass className="w-4 h-4" />
                <span>BÁNH XE CÂU THOẠI NHANH [Q]</span>
              </span>
              <button
                onClick={() => setIsWheelOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[10px] text-zinc-400 mb-2">
              Độ cồn hiện tại: <strong className="text-amber-300">{userPlayer.alcoholLevel}%</strong> — Tự động kích hoạt <strong>Bộ Lọc Bàn Phím Say Rượu</strong>!
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_CHAT_WHEEL_ITEMS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSubmitText(item.text)}
                  className="p-2 rounded-xl bg-zinc-900 hover:bg-amber-500 hover:text-zinc-950 border border-zinc-800 text-left text-xs font-bold transition cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Direct Text Chat Input Bar [Enter] */}
        {isInputOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmitText(inputText);
            }}
            className="w-80 sm:w-96 bg-zinc-950/95 border-2 border-amber-500 rounded-2xl p-2 shadow-2xl flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Gõ chat (thêm ! hoặc IN HOA để đập bàn RẦM)..."
              className="flex-1 bg-zinc-900 text-white text-xs px-3 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Compact Trigger Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setIsInputOpen(false);
              setIsWheelOpen((prev) => !prev);
            }}
            className="py-2 px-3 rounded-2xl bg-zinc-900/95 hover:bg-zinc-800 border border-amber-500/60 text-amber-300 font-black text-xs flex items-center gap-1.5 shadow-xl cursor-pointer transition"
            title="Mở Bánh Xe Câu Thoại Nhanh (Phím Q)"
          >
            <Compass className="w-4 h-4" />
            <span className="hidden sm:inline">Thoại Nhanh [Q]</span>
          </button>

          <button
            onClick={() => {
              setIsWheelOpen(false);
              setIsInputOpen((prev) => !prev);
              setTimeout(() => inputRef.current?.focus(), 40);
            }}
            className="py-2 px-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 shadow-xl cursor-pointer transition"
            title="Gõ Bong Bóng Chat 3D & Bộ Lọc Say Rượu (Phím Enter)"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Chat<span className="hidden sm:inline"> Bàn Phím Say [Enter]</span></span>
          </button>
        </div>
      </div>
    </>
  );
};
