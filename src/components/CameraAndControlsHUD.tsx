import React, { useState, useRef } from 'react';
import {
  CameraViewMode,
  CharacterEmote,
  ControlStateMode,
  IKHandControlState,
} from '../game/types';
import {
  Camera,
  Eye,
  Footprints,
  Armchair,
  Snowflake,
  Gamepad,
  Hand,
  Beer,
  Sparkles,
  Volume2,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';

interface CameraAndControlsHUDProps {
  alcoholLevel: number;
  ikState: IKHandControlState;
  isMicActive: boolean;
  crowdDecibel: number; // 0 to 100
  onToggleCameraPOV: () => void;
  onToggleControlMode: () => void;
  onTriggerColdTowel: () => void;
  onTriggerEmote: (emote: CharacterEmote) => void;
  onNudgeChairBalance: (delta: number) => void;
  onRecoverFromChairFall: () => void;
  onUpdateAim: (aimX: number, aimY: number) => void;
  onMoveFreeRoam: (dx: number, dz: number) => void;
  onHoldGrab: (holding: boolean) => void;
  onHoldCheersCenter: (holding: boolean) => void;
  onDrinkOrEat: () => void;
  onHeadbutt: () => void;
  onShoutCrowdDecibel: () => void;
}

export const CameraAndControlsHUD: React.FC<CameraAndControlsHUDProps> = ({
  alcoholLevel,
  ikState,
  isMicActive,
  crowdDecibel,
  onToggleCameraPOV,
  onToggleControlMode,
  onTriggerColdTowel,
  onTriggerEmote,
  onNudgeChairBalance,
  onRecoverFromChairFall,
  onUpdateAim,
  onMoveFreeRoam,
  onHoldGrab,
  onHoldCheersCenter,
  onDrinkOrEat,
  onHeadbutt,
  onShoutCrowdDecibel,
}) => {
  const [showVirtualJoysticks, setShowVirtualJoysticks] = useState(false);
  // Emote/IK action row covers the scene on phones; start it collapsed there.
  const [showQuickActions, setShowQuickActions] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 768
  );
  const [showControlsGuide, setShowControlsGuide] = useState(false);

  const leftPadRef = useRef<HTMLDivElement>(null);
  const rightPadRef = useRef<HTMLDivElement>(null);
  const [leftKnob, setLeftKnob] = useState({ x: 0, y: 0 });
  const [rightKnob, setRightKnob] = useState({ x: 0, y: 0 });

  const cameraLabel: Record<CameraViewMode, string> = {
    seated_3rd: 'Góc Chéo Vai 35° (Thứ 3)',
    first_person: 'Góc Nhìn Thứ Nhất (POV)',
    minigame_focus: 'Zoom Giữa Bàn (Minigame)',
    free_roam: 'Góc Tự Do Sau Lưng (Free-Roam)',
  };

  const handleLeftPadPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0 && e.type !== 'pointerdown') return;
    const rect = leftPadRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
    setLeftKnob({ x: nx * 24, y: ny * 24 });

    if (ikState.controlMode === 'free_roam') {
      onMoveFreeRoam(nx * 0.14, ny * 0.14);
    } else {
      onNudgeChairBalance(nx * 14);
    }
  };

  const handleRightPadPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0 && e.type !== 'pointerdown') return;
    const rect = rightPadRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, -(((e.clientY - rect.top) / rect.height) * 2 - 1)));
    setRightKnob({ x: nx * 24, y: -ny * 24 });
    onUpdateAim(nx, ny);
  };

  return (
    <>
      {/* 1. Top-Left Contextual Camera & Physics Control Bar */}
      <div className="fixed top-14 left-3 z-20 flex flex-col gap-1.5 pointer-events-none max-w-[94vw]">
        <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
          {/* Camera Mode Toggle [Tab / V] */}
          <button
            onClick={onToggleCameraPOV}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 shadow-lg transition-all active:scale-95 ${
              ikState.cameraMode === 'first_person'
                ? 'bg-amber-500 text-zinc-950 border-amber-300'
                : 'bg-zinc-900/95 text-zinc-200 border-zinc-700 hover:border-amber-500/60'
            }`}
            title="Phím Tab hoặc V: Đổi góc nhìn Chéo Vai 35° / Góc Nhìn Thứ Nhất (POV)"
          >
            {ikState.cameraMode === 'first_person' ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <Camera className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="hidden sm:inline">{cameraLabel[ikState.cameraMode]}</span>
            <span className="hidden sm:inline px-1 py-0.2 bg-black/30 rounded text-[9px] font-mono">
              Tab/V
            </span>
          </button>

          {/* State Machine Toggle: Seated vs Free-Roam [Phím E / F] */}
          <button
            onClick={onToggleControlMode}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 shadow-lg transition-all active:scale-95 ${
              ikState.controlMode === 'free_roam'
                ? 'bg-emerald-500 text-zinc-950 border-emerald-300'
                : 'bg-zinc-900/95 text-zinc-200 border-zinc-700 hover:border-emerald-500/60'
            }`}
            title="Phím E hoặc F: Đứng dậy đi lại quanh quán / Ngồi xuống ghế nhựa"
          >
            {ikState.controlMode === 'free_roam' ? (
              <Footprints className="w-3.5 h-3.5" />
            ) : (
              <Armchair className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="hidden sm:inline">
              {ikState.controlMode === 'free_roam'
                ? 'Đang Đứng Tự Do (WASD)'
                : 'Đang Ngồi Ghế Nhựa'}
            </span>
            <span className="sm:hidden">
              {ikState.controlMode === 'free_roam' ? 'Đứng' : 'Ngồi'}
            </span>
            <span className="hidden sm:inline px-1 py-0.2 bg-black/30 rounded text-[9px] font-mono">
              Phím E
            </span>
          </button>

          {/* Cold Towel / Ice Water Splash [Phím C] */}
          <button
            onClick={onTriggerColdTowel}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 shadow-lg transition-all active:scale-95 ${
              ikState.coldTowelBuffTimer > 0
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200'
                : 'bg-zinc-900/95 border-zinc-700 text-cyan-300 hover:bg-zinc-800'
            }`}
            title="Phím C: Đắp khăn lạnh / Tạt nước đá giúp hết lắc Camera trong 30 giây"
          >
            <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {ikState.coldTowelBuffTimer > 0
                ? `${Math.ceil(ikState.coldTowelBuffTimer)}s`
                : 'Khăn Lạnh'}
              <span className="hidden sm:inline">
                {ikState.coldTowelBuffTimer > 0 ? ' Khăn Lạnh' : ' [C]'}
              </span>
            </span>
          </button>

          {/* Toggle Dual Virtual Joysticks (Mobile / Gamepad UI) */}
          <button
            onClick={() => setShowVirtualJoysticks((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 shadow-lg transition-all active:scale-95 ${
              showVirtualJoysticks
                ? 'bg-purple-600 text-white border-purple-400'
                : 'bg-zinc-900/95 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
            }`}
            title="Bật/Tắt 2 Joystick Ảo điều khiển tay IK & giữ thăng bằng"
          >
            <Gamepad className="w-3.5 h-3.5 text-purple-300" />
            <span className="hidden sm:inline">Joystick Ảo</span>
          </button>

          {/* Emote / IK Action Row Toggle */}
          <button
            onClick={() => setShowQuickActions((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 shadow-lg transition-all active:scale-95 ${
              showQuickActions
                ? 'bg-zinc-800 text-amber-300 border-amber-500/60'
                : 'bg-zinc-900/95 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
            }`}
            title="Hiện/Ẩn thanh biểu cảm & thao tác tay"
          >
            <span>😂</span>
            <span className="hidden sm:inline">Biểu Cảm</span>
            <span className="text-zinc-400">{showQuickActions ? '▴' : '▾'}</span>
          </button>

          {/* Controls Cheat-Sheet Toggle */}
          <button
            onClick={() => setShowControlsGuide((prev) => !prev)}
            className="p-1.5 rounded-xl bg-zinc-900/95 border border-zinc-700 text-zinc-300 hover:text-amber-300 shadow-lg transition-all"
            title="Xem hướng dẫn điều khiển Tay Vật Lý IK & Góc Nhìn"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Emotes & Slogan Quick Bar [Phím 1, 2, 3, 4] + IK Hand Actions */}
        {showQuickActions && (
        <div className="flex flex-wrap items-center gap-1 pointer-events-auto">
          {[
            { id: 'laugh_slap' as CharacterEmote, key: '1', label: '😂 Đập Bàn Cười' },
            { id: 'point_taunt' as CharacterEmote, key: '2', label: '👉 Chỉ Tay Gáy' },
            { id: 'beg_mercy' as CharacterEmote, key: '3', label: '🙏 Chắp Tay Xin Tha' },
            { id: 'sleep_table' as CharacterEmote, key: '4', label: '😴 Gục Bàn Ngủ' },
          ].map((em) => (
            <button
              key={em.id}
              onClick={() =>
                onTriggerEmote(ikState.emote === em.id ? 'none' : em.id)
              }
              className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition-all active:scale-95 ${
                ikState.emote === em.id
                  ? 'bg-amber-500 text-zinc-950 border-amber-300'
                  : 'bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <span className="hidden sm:inline opacity-60 mr-1">[{em.key}]</span>
              {em.label}
            </button>
          ))}

          {/* Quick IK Hand Actions on Desktop/Mobile */}
          {ikState.controlMode === 'seated' ? (
            <>
              <button
                onPointerDown={() => onHoldCheersCenter(true)}
                onPointerUp={() => onHoldCheersCenter(false)}
                onPointerLeave={() => onHoldCheersCenter(false)}
                className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all ${
                  ikState.isCheersHolding
                    ? 'bg-amber-500 text-zinc-950 border-amber-300'
                    : 'bg-zinc-900/90 text-amber-300 border-amber-500/40 hover:bg-zinc-800'
                }`}
                title="Giữ Chuột Phải (RMB): Rướn người đưa ly ra giữa bàn chờ hô DZÔ!"
              >
                <Beer className="w-3 h-3" />
                <span>Giữ Ly Giữa Bàn [RMB]</span>
              </button>

              <button
                onClick={onDrinkOrEat}
                className="px-2 py-1 rounded-lg border border-emerald-500/40 bg-zinc-900/90 hover:bg-zinc-800 text-emerald-300 text-[10px] font-bold flex items-center gap-1 active:scale-95"
                title="Phím Space: Đưa ly/đũa vào miệng uống khi ngồi tại bàn"
              >
                <Sparkles className="w-3 h-3" />
                <span>Uống/Đớp [Space]</span>
              </button>
            </>
          ) : (
            <button
              onClick={onHeadbutt}
              className="px-2.5 py-1 rounded-lg border border-red-500/60 bg-red-950/80 hover:bg-red-900 text-red-200 text-[10px] font-bold flex items-center gap-1 active:scale-95"
              title="Chuột Phải (RMB): Húc đầu / Đẩy vai cướp mồi hoặc giành bill"
            >
              <span>💥 Húc Đầu Cản Bạn [RMB]</span>
            </button>
          )}
        </div>
        )}

        {/* Collapsible Controls Guide Card */}
        {showControlsGuide && (
          <div className="pointer-events-auto bg-zinc-950/95 border border-amber-500/50 rounded-2xl p-3 text-[11px] text-zinc-200 max-w-md shadow-2xl space-y-1.5">
            <div className="font-black text-amber-400 flex items-center justify-between border-b border-zinc-800 pb-1">
              <span>🎮 CƠ CHẾ GÓC NHÌN & ĐIỀU KHIỂN TAY VẬT LÝ (IK)</span>
              <button
                onClick={() => setShowControlsGuide(false)}
                className="text-zinc-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <div>
              • <b>Di chuyển (WASD / Đi bộ):</b> Vận động đi lại hóng gió bờ kè giúp toát mồ hôi và <b>GIẢI RƯỢU (hạ nồng độ cồn, tăng thể lực)</b>! Di chuyển không làm tăng cồn.
            </div>
            <div>
              • <b>Di chuyển Chuột / Joystick Phải:</b> Đầu & tay phải vươn theo con trỏ (IK). Càng say tay càng trôi hình số 8.
            </div>
            <div>
              • <b>Giữ Chuột Trái (LMB):</b> Cầm ly/đũa/đá. Thả nút giữa chừng khi vung tay = <b>Ném đồ vào mặt bạn!</b>
            </div>
            <div>
              • <b>Giữ Chuột Phải (RMB):</b> Đưa ly ra giữa bàn (khi ngồi) hoặc <b>Húc đầu</b> (khi đứng dậy Free-Roam).
            </div>
            <div>
              • <b>Phím Space:</b> Khi ngồi bàn nhậu = Đưa ly/mồi vào miệng. Khi đứng dậy Free-Roam = Nhảy vận động giải bớt 2% cồn!
            </div>
            <div>
              • <b>Phím A / D:</b> Giữ thăng bằng trên ghế nhựa khi độ cồn cao để không ngã lộn cổ.
            </div>
            <div>
              • <b>Phím Tab / V:</b> Đổi Góc nhìn Thứ 3 Chéo Vai 35° ↔ Góc nhìn Thứ Nhất (POV).
            </div>
            <div>
              • <b>Phím E / F:</b> Đứng dậy đi lại quanh quán (WASD) ↔ Ngồi xuống ghế nhựa.
            </div>
          </div>
        )}
      </div>

      {/* 2. Plastic Stool Balance Meter (When Seated & Alcohol >= 65% or Tilted) */}
      {ikState.controlMode === 'seated' &&
        (alcoholLevel >= 65 ||
          Math.abs(ikState.chairBalance) > 15 ||
          ikState.isFallenOffChair) && (
          <div className="fixed top-36 right-3 z-20 pointer-events-auto bg-zinc-950/95 border border-red-500/60 rounded-2xl p-2.5 w-60 shadow-2xl">
            <div className="flex items-center justify-between text-[11px] font-black text-amber-300 mb-1">
              <span>🪑 THĂNG BẰNG GHẾ NHỰA</span>
              <span className="text-[10px] text-zinc-400 font-mono">Phím A / D</span>
            </div>

            {ikState.isFallenOffChair ? (
              <div className="text-center space-y-2 py-1">
                <div className="text-xs font-black text-red-400 animate-bounce">
                  🙃 NGÃ LỘN CỔ KHỎI GHẾ NHỰA RỒI!
                </div>
                <button
                  onClick={onRecoverFromChairFall}
                  className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs rounded-xl flex items-center justify-center gap-1 shadow-lg active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Leo Lại Lên Ghế [Space]</span>
                </button>
              </div>
            ) : (
              <>
                <div className="relative h-3.5 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700 mb-1.5">
                  <div className="absolute inset-y-0 left-0 w-1/4 bg-red-600/40" />
                  <div className="absolute inset-y-0 right-0 w-1/4 bg-red-600/40" />
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-emerald-400" />
                  {/* Balance Indicator Needle */}
                  <div
                    style={{
                      left: `${Math.max(4, Math.min(96, 50 + ikState.chairBalance * 0.45))}%`,
                    }}
                    className="absolute top-0 bottom-0 w-2.5 -translate-x-1/2 bg-amber-400 rounded-full shadow"
                  />
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <button
                    onClick={() => onNudgeChairBalance(-28)}
                    className="flex-1 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] font-bold text-zinc-200 border border-zinc-700 active:scale-95"
                  >
                    ⬅️ Nghiêng Trái [A]
                  </button>
                  <button
                    onClick={() => onNudgeChairBalance(28)}
                    className="flex-1 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] font-bold text-zinc-200 border border-zinc-700 active:scale-95"
                  >
                    Nghiêng Phải [D] ➡️
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      {/* 3. Crowd Decibel Meter ("Hô 1, 2, 3 DZÔ!" Voice Trigger & Lip-Sync) */}
      {(ikState.isCheersHolding || isMicActive) && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-auto bg-zinc-950/95 border border-amber-500/80 rounded-2xl px-4 py-2.5 shadow-2xl w-80 max-w-[92vw]">
          <div className="flex items-center justify-between text-xs font-black text-amber-300 mb-1">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-red-400 animate-pulse" />
              THANH ÂM LƯỢNG HÔ "1, 2, 3 DZÔ!"
            </span>
            <span className="font-mono text-[11px] text-white">
              {Math.round(crowdDecibel)} dB
            </span>
          </div>

          <div className="relative h-4 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700 mb-2">
            {/* Red Threshold Line at 75% */}
            <div
              style={{ left: '75%' }}
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
            />
            <div
              style={{ width: `${Math.min(100, crowdDecibel)}%` }}
              className={`h-full transition-all duration-75 ${
                crowdDecibel >= 75
                  ? 'bg-gradient-to-r from-amber-400 to-red-500'
                  : 'bg-gradient-to-r from-emerald-500 to-amber-400'
              }`}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-zinc-400">
              {isMicActive
                ? '🎤 Lip-Sync đang mở: Nói/Cười vào Mic để mấp máy môi!'
                : 'Hét to vượt vạch đỏ (75 dB) để cụng ly Slow-Mo!'}
            </span>
            <button
              onClick={onShoutCrowdDecibel}
              className="px-2.5 py-1 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black text-[10px] rounded-lg shadow active:scale-95 shrink-0"
            >
              🗣️ HÔ "DZÔ!" NGAY
            </button>
          </div>
        </div>
      )}

      {/* 4. Dual Virtual Joysticks Overlay (Mobile / Touch / Gamepad Mode) */}
      {showVirtualJoysticks && (
        <div className="fixed inset-x-4 bottom-24 z-20 flex items-end justify-between pointer-events-none">
          {/* Left Virtual Joystick: Balance A/D or Free-Roam WASD */}
          <div className="pointer-events-auto flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-zinc-300 bg-zinc-900/90 px-2 py-0.5 rounded-full border border-zinc-700">
              {ikState.controlMode === 'free_roam'
                ? 'Joystick Trái: Đi Lại'
                : 'Joystick Trái: Giữ Ghế'}
            </span>
            <div
              ref={leftPadRef}
              onPointerDown={handleLeftPadPointer}
              onPointerMove={handleLeftPadPointer}
              onPointerUp={() => setLeftKnob({ x: 0, y: 0 })}
              className="w-24 h-24 rounded-full bg-zinc-900/90 border-2 border-zinc-600 flex items-center justify-center relative touch-none shadow-2xl"
            >
              <div
                style={{
                  transform: `translate(${leftKnob.x}px, ${leftKnob.y}px)`,
                }}
                className="w-9 h-9 rounded-full bg-emerald-500 border-2 border-white shadow-md"
              />
            </div>
          </div>

          {/* Right Virtual Joystick + Hand Action Buttons: IK Arm Reach */}
          <div className="pointer-events-auto flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <button
                onPointerDown={() => onHoldGrab(true)}
                onPointerUp={() => onHoldGrab(false)}
                className="px-3 py-2 rounded-xl bg-amber-500 text-zinc-950 font-black text-xs shadow-lg flex items-center gap-1 active:scale-95"
              >
                <Hand className="w-3.5 h-3.5" />
                <span>Cầm / Ném</span>
              </button>
              <button
                onClick={onDrinkOrEat}
                className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs shadow-lg flex items-center gap-1 active:scale-95"
              >
                <Beer className="w-3.5 h-3.5" />
                <span>Uống / Đớp</span>
              </button>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-amber-300 bg-zinc-900/90 px-2 py-0.5 rounded-full border border-amber-500/40">
                Joystick Phải: Vươn Tay IK
              </span>
              <div
                ref={rightPadRef}
                onPointerDown={handleRightPadPointer}
                onPointerMove={handleRightPadPointer}
                onPointerUp={() => setRightKnob({ x: 0, y: 0 })}
                className="w-24 h-24 rounded-full bg-zinc-900/90 border-2 border-amber-500/70 flex items-center justify-center relative touch-none shadow-2xl"
              >
                <div
                  style={{
                    transform: `translate(${rightKnob.x}px, ${rightKnob.y}px)`,
                  }}
                  className="w-9 h-9 rounded-full bg-amber-400 border-2 border-white shadow-md"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
