import React, { useEffect, useRef, useState } from 'react';
import { Player } from '../game/types';
import {
  ALLEY_TOTAL_DISTANCE_METERS,
  BIKE_SKINS,
  breathalyzerReadingFor,
  BikeSkinId,
  CommuteTransportMode,
  DAN_TO_BONUS_POINTS,
  EXEMPLARY_TAXPAYER_TITLE,
  GRAB_VIP_COST_COINS,
  GUARD_ASSIST_TIP_COINS,
  IMPOUNDED_BIKE_TAG_TEMPLATE,
  MotorbikeFPPState,
  OVERNIGHT_PARKING_COST_COINS,
  POLICE_CHECKPOINT_DISTANCE_FROM_HOME_METERS,
  POLICE_CHECKPOINT_FINE_COINS,
  PUB_SIGN_CRASH_BILL_PENALTY_VND,
  ReturnCommuteOption,
  ReturnCommuteResolutionResult,
  computeDrunkDrivingDistortion,
  createInitialMotorbikeState,
  evaluateSpawnCommuteChoice,
  pressMotorbikeIgnition,
  resolveReturnCommuteOutcome,
  stepMotorbikePhysics,
  toggleMotorbikeKickstand,
} from '../game/commuteLoopLogic';
import { Commute3DState } from '../game/commute3DScene';
import { sound } from '../game/audio';
import { Camera, Compass, Eye, Gauge, Volume2, X } from 'lucide-react';

export type CommuteModalStage =
  | 'spawn_house_decision'
  | 'outbound_fpp_drive'
  | 'outbound_grab_vip'
  | 'return_parking_decision'
  | 'return_drunk_fpp_drive'
  | 'return_grab_vip'
  | 'checkpoint_20m_breathalyzer_qte'
  | 'impound_cutscene_summary';

interface CommuteLoopModalProps {
  isOpen: boolean;
  initialPhase: 'outbound' | 'return';
  userPlayer: Player;
  totalBill: number;
  onApplyOutboundResult: (payload: {
    mode: CommuteTransportMode;
    bikeSkin: BikeSkinId;
    coinsDelta: number;
    danToBonusPoints: number;
    pubSignCrashPenaltyVnd: number;
    headline: string;
  }) => void;
  onApplyReturnResult: (result: ReturnCommuteResolutionResult) => void;
  onRedeemImpoundedBikeForTest?: () => void;
  onUpdateCommute3DState?: (partial: Partial<Commute3DState>) => void;
  onClose: () => void;
}

const AVATAR_PAW_EMOJI: Record<Player['avatar'], string> = {
  dog: '🐾🐕',
  cat: '🐾🐱',
  panda: '🐾🐼',
  duck: '🪶🦆',
  bear: '🐾🐻',
  hamster: '🐾🐹',
};

const AVATAR_FACE_EMOJI: Record<Player['avatar'], string> = {
  dog: '🐕',
  cat: '🐱',
  panda: '🐼',
  duck: '🦆',
  bear: '🐻',
  hamster: '🐹',
};

export const CommuteLoopModal: React.FC<CommuteLoopModalProps> = ({
  isOpen,
  initialPhase,
  userPlayer,
  totalBill,
  onApplyOutboundResult,
  onApplyReturnResult,
  onRedeemImpoundedBikeForTest,
  onUpdateCommute3DState,
  onClose,
}) => {
  const [stage, setStage] = useState<CommuteModalStage>(
    initialPhase === 'return'
      ? 'return_parking_decision'
      : 'spawn_house_decision'
  );
  const [spawnDecisionTimer, setSpawnDecisionTimer] = useState(10);
  const [selectedBikeSkin, setSelectedBikeSkin] = useState<BikeSkinId>(
    userPlayer.selectedBikeSkin || 'dream_chien'
  );
  const [, setChosenTransport] = useState<CommuteTransportMode>(
    userPlayer.commuteModeUsed || 'self_bike'
  );

  // 3D Camera Perspective Mode ('fpp' helmet handlebar cockpit vs 'tpp' chase cam)
  const [cameraViewMode, setCameraViewMode] = useState<'fpp' | 'tpp'>('fpp');
  const [grabOrbitDeg, setGrabOrbitDeg] = useState<number>(18);

  // Motorbike FPP physics state
  const [bikeState, setBikeState] = useState<MotorbikeFPPState>(() =>
    createInitialMotorbikeState(userPlayer.selectedBikeSkin || 'dream_chien')
  );
  const [isHoldingThrottle, setIsHoldingThrottle] = useState(false);
  const [isHoldingBrake, setIsHoldingBrake] = useState(false);
  const [steerDir, setSteerDir] = useState<number>(0); // -1 left, 0 center, +1 right
  const [laggedSteerDir, setLaggedSteerDir] = useState<number>(0);
  const [driveElapsedSec, setDriveElapsedSec] = useState(0);

  // Grab VIP state
  const [grabWaitTimer, setGrabWaitTimer] = useState(3);
  const [grabViewAngle, setGrabViewAngle] = useState<'fpp' | 'tpp_360'>('tpp_360');
  const [grabTauntLog, setGrabTauntLog] = useState<string>(
    'Đang ngồi yên sau 3D ngắm phố đêm lồng lộng gió...'
  );

  // 20m Police Checkpoint Breathalyzer QTE state
  const [breathHoldProgress, setBreathHoldProgress] = useState(0);
  const [isBlowingCompleted, setIsBlowingCompleted] = useState(false);
  const [returnResolution, setReturnResolution] =
    useState<ReturnCommuteResolutionResult | null>(null);

  const lagTimeoutRef = useRef<number | null>(null);

  const impoundMatchesLeft = userPlayer.bikeImpoundMatchesLeft || 0;
  const effectiveDrunkAlcohol =
    stage === 'return_drunk_fpp_drive' ||
    stage === 'return_parking_decision' ||
    stage === 'checkpoint_20m_breathalyzer_qte'
      ? Math.round(userPlayer.alcoholLevel)
      : 0;
  // Đi về uses the player's real Độ Cồn (it used to be forced to at least 78%)
  const returnAlcohol = Math.round(userPlayer.alcoholLevel);
  const isSoberForReturn = returnAlcohol < 1;

  // Sync initial stage when modal opens
  useEffect(() => {
    if (!isOpen) {
      onUpdateCommute3DState?.({ active: false });
      return;
    }
    if (initialPhase === 'return') {
      if (userPlayer.commuteModeUsed === 'grab_vip') {
        setStage('return_grab_vip');
      } else {
        setStage('return_parking_decision');
      }
    } else {
      setStage('spawn_house_decision');
      setSpawnDecisionTimer(10);
    }
    setCameraViewMode('fpp');
    setBikeState(
      createInitialMotorbikeState(userPlayer.selectedBikeSkin || 'dream_chien')
    );
    setDriveElapsedSec(0);
    setBreathHoldProgress(0);
    setIsBlowingCompleted(false);
    setReturnResolution(null);
  }, [
    isOpen,
    initialPhase,
    userPlayer.commuteModeUsed,
    userPlayer.selectedBikeSkin,
  ]);

  // Continuously sync commute state into the live Three.js 3D Alley & Handlebar Cockpit
  useEffect(() => {
    if (!onUpdateCommute3DState) return;
    if (!isOpen) {
      onUpdateCommute3DState({ active: false });
      return;
    }
    const effectiveCamMode: 'fpp' | 'tpp' =
      stage === 'outbound_grab_vip' || stage === 'return_grab_vip'
        ? grabViewAngle === 'fpp'
          ? 'fpp'
          : 'tpp'
        : cameraViewMode;

    onUpdateCommute3DState({
      active: true,
      stage,
      bikeSkin: selectedBikeSkin,
      userAvatar: userPlayer.avatar,
      isEngineRunning: bikeState.isEngineRunning,
      kickstartCount: bikeState.kickstartCount,
      isKickstandDown: bikeState.isKickstandDown,
      speedKmh: bikeState.speedKmh,
      lateralOffset: bikeState.laneX * 1.45,
      steerInput:
        stage === 'return_drunk_fpp_drive' ? laggedSteerDir : steerDir,
      isHoldingThrottle,
      isHoldingBrake,
      isHornPressed: bikeState.isHornPressed,
      distanceTraveledM: bikeState.distanceTraveledMeters,
      targetDistanceM: ALLEY_TOTAL_DISTANCE_METERS,
      isWipedOut: bikeState.hasKickstandSparksWipeout,
      isSignboardHit: bikeState.hasCrashedPubSign,
      isParkedInChalkBox: bikeState.isParkedInWhiteBox,
      alcoholLevel: effectiveDrunkAlcohol,
      cameraViewMode: effectiveCamMode,
      grabCameraAngleDeg: grabOrbitDeg,
      grabWaitTimer,
      breathHoldProgress,
    });
  }, [
    isOpen,
    stage,
    selectedBikeSkin,
    userPlayer.avatar,
    bikeState,
    laggedSteerDir,
    steerDir,
    isHoldingThrottle,
    isHoldingBrake,
    effectiveDrunkAlcohol,
    cameraViewMode,
    grabViewAngle,
    grabOrbitDeg,
    grabWaitTimer,
    breathHoldProgress,
    onUpdateCommute3DState,
  ]);

  // Ensure 3D commute mode turns off on unmount
  useEffect(() => {
    return () => {
      onUpdateCommute3DState?.({ active: false });
    };
  }, [onUpdateCommute3DState]);

  // 10-second countdown on the Spawn Decision Popup
  useEffect(() => {
    if (!isOpen || stage !== 'spawn_house_decision') return;
    if (spawnDecisionTimer <= 0) return;
    const t = window.setTimeout(() => {
      setSpawnDecisionTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(t);
  }, [isOpen, stage, spawnDecisionTimer]);

  // 3-second countdown when waiting for NPC Tài Xế Áo Xanh
  useEffect(() => {
    if (!isOpen || stage !== 'outbound_grab_vip') return;
    if (grabWaitTimer <= 0) return;
    const t = window.setTimeout(() => {
      setGrabWaitTimer((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          sound.playGrabBrakeScreech();
        }
        return next;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [isOpen, stage, grabWaitTimer]);

  // Apply ~0.5s Input Lag when driving drunk on the return trip
  const updateSteeringWithLag = (rawDir: number, isReturnDrunk: boolean) => {
    setSteerDir(rawDir);
    if (!isReturnDrunk) {
      setLaggedSteerDir(rawDir);
      return;
    }
    if (lagTimeoutRef.current) {
      clearTimeout(lagTimeoutRef.current);
    }
    lagTimeoutRef.current = window.setTimeout(() => {
      setLaggedSteerDir(rawDir);
    }, 480);
  };

  // Real-time 3D FPP Driving Physics Loop (60ms tick for smooth 3D motion)
  useEffect(() => {
    if (
      !isOpen ||
      (stage !== 'outbound_fpp_drive' && stage !== 'return_drunk_fpp_drive')
    ) {
      return;
    }
    const isReturnTrip = stage === 'return_drunk_fpp_drive';
    const interval = window.setInterval(() => {
      setDriveElapsedSec((prev) => prev + 0.08);
      setBikeState((prev) => {
        if (
          !prev.isEngineRunning ||
          prev.hasKickstandSparksWipeout ||
          prev.distanceTraveledMeters >= ALLEY_TOTAL_DISTANCE_METERS
        ) {
          return prev;
        }
        const step = stepMotorbikePhysics(prev, {
          throttle: isHoldingThrottle,
          brake: isHoldingBrake,
          steerInput: isReturnTrip ? laggedSteerDir : steerDir,
          dtSeconds: 0.1,
          alcoholLevel: isReturnTrip ? effectiveDrunkAlcohol : 0,
          elapsedTimeSeconds: driveElapsedSec,
          isReturnTrip,
        });

        if (
          step.nextState.hasKickstandSparksWipeout &&
          !prev.hasKickstandSparksWipeout
        ) {
          sound.playKickstandScrape();
        }

        if (step.hitCheckpoint20m) {
          sound.playSiren();
          sound.playPoliceWhistleAndBreathalyzer(false);
          setIsHoldingThrottle(false);
          setStage('checkpoint_20m_breathalyzer_qte');
        }

        return step.nextState;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [
    isOpen,
    stage,
    isHoldingThrottle,
    isHoldingBrake,
    steerDir,
    laggedSteerDir,
    driveElapsedSec,
    effectiveDrunkAlcohol,
  ]);

  // Keyboard shortcuts for 3D FPP Driving (E, F, W, S, A, D, Space, V)
  useEffect(() => {
    if (!isOpen) return;
    const isDrivingStage =
      stage === 'outbound_fpp_drive' || stage === 'return_drunk_fpp_drive';
    const isReturnDrunk = stage === 'return_drunk_fpp_drive';

    const onKeyDown = (e: KeyboardEvent) => {
      if (stage === 'checkpoint_20m_breathalyzer_qte' && e.code === 'Space') {
        e.preventDefault();
        handleHoldBreathalyzerSpace();
        return;
      }
      if (!isDrivingStage) return;

      const key = e.key.toLowerCase();
      if (key === 'e') {
        e.preventDefault();
        handlePressIgnition();
      } else if (key === 'f') {
        e.preventDefault();
        handleToggleKickstand();
      } else if (key === 'v') {
        e.preventDefault();
        setCameraViewMode((m) => (m === 'fpp' ? 'tpp' : 'fpp'));
      } else if (key === 'w' || e.key === 'ArrowUp') {
        setIsHoldingThrottle(true);
        sound.playEngineRev(0.65);
      } else if (key === 's' || e.key === 'ArrowDown') {
        setIsHoldingBrake(true);
      } else if (key === 'a' || e.key === 'ArrowLeft') {
        updateSteeringWithLag(-0.8, isReturnDrunk);
      } else if (key === 'd' || e.key === 'ArrowRight') {
        updateSteeringWithLag(0.8, isReturnDrunk);
      } else if (e.code === 'Space') {
        e.preventDefault();
        sound.playHornBeep();
        setBikeState((prev) => ({
          ...prev,
          isHornPressed: true,
          lastEventMessage:
            '📯 "BÍP BÍP!" — Còi xe 3D inh ỏi làm chó ngủ giữa hẻm giật mình nhảy vọt lên vỉa hè!',
        }));
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!isDrivingStage) return;
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') {
        setIsHoldingThrottle(false);
      } else if (key === 's' || e.key === 'ArrowDown') {
        setIsHoldingBrake(false);
      } else if (
        key === 'a' ||
        key === 'd' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight'
      ) {
        updateSteeringWithLag(0, isReturnDrunk);
      } else if (e.code === 'Space') {
        setBikeState((prev) => ({ ...prev, isHornPressed: false }));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isOpen, stage, selectedBikeSkin]);

  if (!isOpen) return null;

  const currentBikeSpec = BIKE_SKINS[selectedBikeSkin];
  const drunkDistortion = computeDrunkDrivingDistortion(
    stage === 'return_drunk_fpp_drive' ? effectiveDrunkAlcohol : 0,
    driveElapsedSec,
    steerDir
  );

  // Handlers
  const handleChooseSelfDriveOutbound = () => {
    const check = evaluateSpawnCommuteChoice({
      mode: 'self_bike',
      selectedBikeSkin,
      currentCoins: userPlayer.coins,
      bikeImpoundMatchesLeft: impoundMatchesLeft,
      playerName: userPlayer.name,
    });
    if (!check.allowed) {
      sound.playPoliceWhistleAndBreathalyzer(true);
      return;
    }
    sound.playBottleOpen();
    setChosenTransport('self_bike');
    setCameraViewMode('fpp');
    setBikeState(createInitialMotorbikeState(selectedBikeSkin));
    setStage('outbound_fpp_drive');
  };

  const handleChooseGrabOutbound = () => {
    sound.playBell();
    setChosenTransport('grab_vip');
    setGrabWaitTimer(3);
    setStage('outbound_grab_vip');
  };

  const handlePressIgnition = () => {
    setBikeState((prev) => {
      const next = pressMotorbikeIgnition(prev);
      sound.playKickstartCough(next.isEngineRunning);
      return next;
    });
  };

  const handleToggleKickstand = () => {
    sound.playChopstickClack();
    setBikeState((prev) => toggleMotorbikeKickstand(prev));
  };

  const handleFinishOutboundParking = (crashedPubSign: boolean) => {
    if (crashedPubSign) {
      sound.playCrateDropCrash();
      setBikeState((prev) => ({
        ...prev,
        hasCrashedPubSign: true,
        distanceTraveledMeters: ALLEY_TOTAL_DISTANCE_METERS,
      }));
    } else {
      sound.playClink(1.15);
      setBikeState((prev) => ({
        ...prev,
        isParkedInWhiteBox: true,
        distanceTraveledMeters: ALLEY_TOTAL_DISTANCE_METERS,
      }));
    }
    onApplyOutboundResult({
      mode: 'self_bike',
      bikeSkin: selectedBikeSkin,
      coinsDelta: 0,
      danToBonusPoints: DAN_TO_BONUS_POINTS,
      pubSignCrashPenaltyVnd: crashedPubSign
        ? PUB_SIGN_CRASH_BILL_PENALTY_VND
        : 0,
      headline: crashedPubSign
        ? `💥 Tay lái lụa ${userPlayer.name} phóng ${currentBikeSpec.name} tông đổ biển hiệu quán! (+50.000đ vào Bill cuối trận, +${DAN_TO_BONUS_POINTS} điểm Dân Tổ)`
        : `🛵 ${userPlayer.name} lùi đít ${currentBikeSpec.name} chuẩn vạch vôi trắng bảo vệ quán, rút chìa khóa đút túi! (+${DAN_TO_BONUS_POINTS} điểm Dân Tổ)`,
    });
  };

  const handleFinishOutboundGrab = () => {
    sound.playCheer();
    onApplyOutboundResult({
      mode: 'grab_vip',
      bikeSkin: selectedBikeSkin,
      coinsDelta: -GRAB_VIP_COST_COINS,
      danToBonusPoints: 0,
      pubSignCrashPenaltyVnd: 0,
      headline: `🛵🛡️ Đã đặt Xe Ôm Công Nghệ (-50 Nắp Bia) ra tới Quán Nhậu! Đặc quyền Hòa Bình bảo hiểm 100% lúc về!`,
    });
  };

  const handleStartReturnDrunkDrive = () => {
    sound.playKickstartCough(true);
    const readyBike: MotorbikeFPPState = {
      ...createInitialMotorbikeState(selectedBikeSkin),
      isEngineRunning: true,
      isKickstandDown: false,
      speedKmh: 28,
      distanceTraveledMeters: 40,
      lastEventMessage: isSoberForReturn
        ? '😎 Tỉnh táo 0% cồn leo lên xe 3D — tay lái chắc nịch, cứ thong thả về nhà!'
        : returnAlcohol <= 15
        ? `🙂 Mới ${returnAlcohol}% cồn: tay lái còn khá vững, cứ từ từ mà về!`
        : `🥴 Leo lên xe 3D với ${returnAlcohol}% cồn trong máu! Thị giác phân thân, tay lái trễ 0.5s & tự lạng phải ghì ngược chiều!`,
    };
    setCameraViewMode('fpp');
    setBikeState(readyBike);
    setDriveElapsedSec(1.2);
    setStage('return_drunk_fpp_drive');
  };

  const handleTriggerCheckpoint20mImmediately = () => {
    sound.playSiren();
    sound.playPoliceWhistleAndBreathalyzer(false);
    setBikeState((prev) => ({
      ...prev,
      speedKmh: 0,
      distanceTraveledMeters:
        ALLEY_TOTAL_DISTANCE_METERS -
        POLICE_CHECKPOINT_DISTANCE_FROM_HOME_METERS,
    }));
    setStage('checkpoint_20m_breathalyzer_qte');
  };

  const handleHoldBreathalyzerSpace = () => {
    sound.playPoliceWhistleAndBreathalyzer(true);
    setBreathHoldProgress((prev) => {
      const next = Math.min(100, prev + 35);
      if (next >= 100 && !isBlowingCompleted) {
        setIsBlowingCompleted(true);
        const outcome = resolveReturnCommuteOutcome({
          option: 'drunk_self_drive',
          currentCoins: userPlayer.coins,
          currentImpoundMatchesLeft: impoundMatchesLeft,
          alcoholLevel: effectiveDrunkAlcohol,
          playerName: userPlayer.name,
        });
        setReturnResolution(outcome);
      }
      return next;
    });
  };

  const handleSelectLoopholeOrGrabReturn = (option: ReturnCommuteOption) => {
    sound.playBottleOpen();
    const outcome = resolveReturnCommuteOutcome({
      option,
      currentCoins: userPlayer.coins,
      currentImpoundMatchesLeft: impoundMatchesLeft,
      alcoholLevel: effectiveDrunkAlcohol,
      playerName: userPlayer.name,
    });
    setReturnResolution(outcome);
    setStage('impound_cutscene_summary');
  };

  const distanceRemainingToDest = Math.max(
    0,
    ALLEY_TOTAL_DISTANCE_METERS - bikeState.distanceTraveledMeters
  );
  const progressPct = Math.min(
    100,
    Math.round(
      (bikeState.distanceTraveledMeters / ALLEY_TOTAL_DISTANCE_METERS) * 100
    )
  );

  // ===========================================================================
  // TRUE 3D MOTORBIKE FPP / TPP HUD OVERLAY
  // Leaves 80%+ of the center screen completely transparent so the live Three.js
  // 3D Handlebar Cockpit, 3D Speedometer, 3D Vibrating Mirrors, 3D Plush Paws,
  // and 3D Alley Obstacles fill the player's viewport!
  // ===========================================================================
  const renderMotorbike3DDrivingHUD = (isReturnDrunk: boolean) => {
    return (
      <div
        data-testid="fpp-motorbike-viewport"
        className="flex-1 flex flex-col justify-between pointer-events-none relative"
      >
        {/* Subtle Half-Shell Helmet Rim ("Vành mũ bảo hiểm nửa đầu 3D") at top edge */}
        <div className="mx-auto w-full max-w-4xl flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 rounded-2xl bg-zinc-950/80 border border-amber-500/50 text-[11px] font-black text-amber-200 pointer-events-auto shadow-lg">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 font-black">
              {cameraViewMode === 'fpp'
                ? '🪖 GÓC NHÌN 3D FPP (CẦM GHI-ĐÔNG)'
                : '🎥 GÓC NHÌN 3D TPP (CAMERA ĐUỔI SAU XE)'}
            </span>
            <span>
              {isReturnDrunk
                ? `🥴 ĐỘ CỒN ${effectiveDrunkAlcohol}% • TRỄ TAY LÁI 0.5s • ĐỘ LẠNG ${drunkDistortion.gyroDriftSteering.toFixed(2)}`
                : `✨ LÚC ĐI TỈNH TÁO 0% CỒN • ${currentBikeSpec.name}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Distance Progress Pill */}
            <div className="flex items-center gap-1.5 bg-zinc-900 px-2.5 py-0.5 rounded-lg border border-zinc-700">
              <span className="text-emerald-400">
                📍 Cách {isReturnDrunk ? 'Cổng Nhà' : 'Quán Nhậu'}:{' '}
                <b>{distanceRemainingToDest}m</b>
              </span>
              <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-full bg-amber-400 transition-all"
                />
              </div>
            </div>

            {/* 3D Camera Perspective Toggle Button */}
            <button
              type="button"
              data-testid="toggle-3d-camera-pov-btn"
              onClick={() =>
                setCameraViewMode((m) => (m === 'fpp' ? 'tpp' : 'fpp'))
              }
              className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-black text-[11px] cursor-pointer flex items-center gap-1 shadow"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>
                Đổi Góc 3D: {cameraViewMode === 'fpp' ? 'FPP ➔ TPP' : 'TPP ➔ FPP'} [V]
              </span>
            </button>
          </div>
        </div>

        {/* ===================================================================
            OPEN 3D VIEWPORT CENTER (100% transparent so WebGL 3D Alley,
            3D Handlebar Cockpit, 3D Speedometer, 3D Mirrors & 3D Paws shine!)
           =================================================================== */}
        <div className="flex-1 flex flex-col items-center justify-center relative pointer-events-none my-1">
          {/* Drunk Double-Vision HUD Warning Badge (Top-Right Floating) */}

          {/* White Exhaust Smoke Puff Floating Callout when cranking E */}
          {bikeState.smokePuffCount > 0 && !bikeState.isEngineRunning && (
            <div className="px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-amber-400 text-amber-200 text-xs font-black shadow-lg animate-bounce">
              💨 Khói trắng phụt bô 3D: "{currentBikeSpec.exhaustSoundText}" (Nhấp [E] thêm lần nữa!)
            </div>
          )}

          {/* Kickstand Sparks Wipeout Alert Overlay */}
          {bikeState.hasKickstandSparksWipeout && (
            <div
              data-testid="kickstand-wipeout-alert"
              className="pointer-events-auto max-w-md bg-red-950/95 border-2 border-amber-400 rounded-3xl p-4 text-center shadow-2xl"
            >
              <div className="text-2xl mb-1">⚡🔥🛵💥</div>
              <h4 className="text-sm font-black text-amber-300 uppercase">
                QUÊN GẠT CHÂN CHỐNG [PHÍM F] KHI VÀO CUA 3D!
              </h4>
              <p className="text-xs text-zinc-200 mt-1 mb-3">
                Chân chống 3D quệt xuống mặt đường nhựa tóe lửa đỏ rực làm xe
                trượt bánh xoè ngay giữa hẻm!
              </p>
              <button
                type="button"
                data-testid="recover-kickstand-wipeout-btn"
                onClick={handleToggleKickstand}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs cursor-pointer shadow-lg"
              >
                🦵 Dựng Xe 3D Dậy & Đá Gọn Chân Chống Lên [Phím F]
              </button>
            </div>
          )}
        </div>

        {/* ===================================================================
            COMPACT BOTTOM 3D DRIVING CONTROL DOCK (pointer-events-auto)
           =================================================================== */}
        <div className="mx-auto w-full max-w-4xl bg-zinc-950/88 border-2 border-amber-500/80 rounded-3xl p-2.5 sm:p-3 text-white pointer-events-auto shadow-2xl space-y-2">
          {/* Compact Telemetry Row + Event Status */}
          <div
            data-testid="motorbike-dashboard-hud"
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-2xl bg-zinc-900/95 border border-zinc-800 text-xs"
          >
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/60 text-amber-300 font-black">
                ⏱️ {bikeState.speedKmh} km/h
              </span>
              <span className="text-[11px] font-bold text-emerald-400">
                ⛽ Xăng: F • Xi-nhan:{' '}
                {bikeState.turnSignal === 'off'
                  ? 'Tắt'
                  : bikeState.turnSignal === 'left'
                  ? '◄ Trái'
                  : '► Phải'}
              </span>
              <span className="hidden sm:inline text-[11px] text-zinc-400">
                | {AVATAR_PAW_EMOJI[userPlayer.avatar]} 2 Tay Thú Bông & 2 Gương 3D Rung Bần Bật
              </span>
            </div>

            <div className="text-[11px] font-bold text-amber-200 truncate max-w-md">
              {bikeState.lastEventMessage}
            </div>
          </div>

          {/* 5 Core Physical Motorbike Controls ([E], [F], [W], [A/D], [Space]) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {/* [E] Đề máy */}
            <button
              type="button"
              data-testid="fpp-ignition-e-btn"
              onClick={handlePressIgnition}
              className={`p-2 rounded-xl border-2 font-black text-xs flex flex-col items-center gap-0.5 cursor-pointer transition active:scale-95 ${
                bikeState.isEngineRunning
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
                  : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-zinc-950 animate-pulse'
              }`}
            >
              <span>🔑 [Phím E] Đề Máy 3D</span>
              <span className="text-[10px] font-bold">
                {bikeState.isEngineRunning
                  ? 'Đã nổ giòn tan!'
                  : `Đạp nổ (${bikeState.kickstartCount}/${currentBikeSpec.kickstartPressesRequired})`}
              </span>
            </button>

            {/* [F] Gạt chân chống */}
            <button
              type="button"
              data-testid="fpp-kickstand-f-btn"
              onClick={handleToggleKickstand}
              className={`p-2 rounded-xl border-2 font-black text-xs flex flex-col items-center gap-0.5 cursor-pointer transition active:scale-95 ${
                bikeState.isKickstandDown
                  ? 'bg-red-900/90 border-red-400 text-amber-200 animate-pulse'
                  : 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
              }`}
            >
              <span>🦵 [Phím F] Chân Chống</span>
              <span className="text-[10px] font-bold">
                {bikeState.isKickstandDown
                  ? '⚠️ Đang hạ (Tóe lửa!)'
                  : '✅ Đã gạt lên an toàn'}
              </span>
            </button>

            {/* [W] Vặn Ga */}
            <button
              type="button"
              data-testid="fpp-throttle-w-btn"
              onMouseDown={() => {
                setIsHoldingThrottle(true);
                sound.playEngineRev(0.75);
              }}
              onMouseUp={() => setIsHoldingThrottle(false)}
              onClick={() => {
                sound.playEngineRev(0.8);
                setBikeState((prev) => {
                  const step = stepMotorbikePhysics(prev, {
                    throttle: true,
                    brake: false,
                    steerInput: isReturnDrunk ? laggedSteerDir : steerDir,
                    dtSeconds: 1.4,
                    alcoholLevel: isReturnDrunk ? effectiveDrunkAlcohol : 0,
                    elapsedTimeSeconds: driveElapsedSec + 1,
                    isReturnTrip: isReturnDrunk,
                  });
                  if (step.hitCheckpoint20m) {
                    sound.playSiren();
                    sound.playPoliceWhistleAndBreathalyzer(false);
                    setStage('checkpoint_20m_breathalyzer_qte');
                  }
                  return step.nextState;
                });
              }}
              className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 border-2 border-sky-300 text-white font-black text-xs flex flex-col items-center gap-0.5 cursor-pointer active:scale-95"
            >
              <span>⚡ [Giữ W] Vặn Ga 3D</span>
              <span className="text-[10px] font-semibold text-sky-100">
                Tay phải xoắn ống ga
              </span>
            </button>

            {/* [A / D] Đánh lái nghiêng xe 3D */}
            <div className="p-1 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-between gap-1">
              <button
                type="button"
                data-testid="fpp-steer-left-btn"
                onClick={() => updateSteeringWithLag(-0.75, isReturnDrunk)}
                className="flex-1 h-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-black text-[11px] cursor-pointer"
              >
                [A] Trái
              </button>
              <button
                type="button"
                data-testid="fpp-steer-right-btn"
                onClick={() => updateSteeringWithLag(0.75, isReturnDrunk)}
                className="flex-1 h-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-black text-[11px] cursor-pointer"
              >
                [D] Phải
              </button>
            </div>

            {/* [Space] Bóp còi */}
            <button
              type="button"
              data-testid="fpp-horn-space-btn"
              onClick={() => {
                sound.playHornBeep();
                setBikeState((prev) => ({
                  ...prev,
                  isHornPressed: true,
                  lastEventMessage:
                    '📯 "BÍP BÍP!" — Còi xe 3D làm chó ngủ giữa đường giật mình chạy lên vỉa hè!',
                }));
              }}
              className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 border-2 border-amber-200 text-zinc-950 font-black text-xs flex flex-col items-center gap-0.5 cursor-pointer active:scale-95"
            >
              <span>📯 [Space] Bóp Còi</span>
              <span className="text-[10px] font-bold">Chó 3D nhảy tránh</span>
            </button>
          </div>

          {/* Arrival / Parking Actions at Pub (Outbound) OR 20m Checkpoint Trigger (Inbound Return) */}
          {!isReturnDrunk ? (
            <div className="pt-1.5 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-zinc-300">
                🅿️ Đỗ xe tại vạch vôi trắng vỉa hè Quán Nhậu 3D:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  data-testid="park-white-chalk-box-btn"
                  onClick={() => handleFinishOutboundParking(false)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs cursor-pointer shadow"
                >
                  🅿️ Lùi Đít Vào Vạch Vôi Trắng & Rút Chìa Khóa (+35đ Dân Tổ)
                </button>
                <button
                  type="button"
                  data-testid="crash-pub-sign-btn"
                  onClick={() => handleFinishOutboundParking(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-900/90 hover:bg-rose-800 border border-rose-400 text-rose-100 font-black text-xs cursor-pointer"
                >
                  💥 Tông Đổ Biển Hiệu Quán 3D (+50.000đ vào Bill!)
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-1.5 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-amber-300">
                🏠 Đang phóng 3D về cổng sắt nhà (Còn {distanceRemainingToDest}m):
              </span>
              <button
                type="button"
                data-testid="trigger-checkpoint-20m-btn"
                onClick={handleTriggerCheckpoint20mImmediately}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 border-2 border-amber-300 text-white font-black text-xs cursor-pointer shadow-lg animate-pulse"
              >
                🏁 Phóng một mạch về nhà!
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid="commute-loop-modal"
      className="fixed inset-0 z-[75] pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 select-none overflow-y-auto"
    >
      {/* =====================================================================
          COMPACT TOP 3D HUD BAR (Always leaves the 3D WebGL scene open below!)
         ===================================================================== */}
      <div className="mx-auto w-full max-w-5xl bg-zinc-950/88 border-2 border-amber-500/80 rounded-2xl px-3.5 py-2 text-white shadow-xl pointer-events-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-zinc-950 font-black flex items-center justify-center text-base shadow">
            🛵
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
              NHẬP VAI 3D TRỰC TIẾP • HẺM PHỐ ĐÊM 3D
            </div>
            <h2 className="text-xs sm:text-sm font-black text-white">
              LỘ TRÌNH DI CHUYỂN 3D: ĐI TỈNH VỀ QUẮC (3D FPP / TPP COMMUTE)
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="close-commute-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white cursor-pointer"
            title="Vào thẳng bàn nhậu / Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* =====================================================================
          STAGE 1: GIAI ĐOẠN KHỞI HÀNH — XUẤT PHÁT TỪ CĂN NHÀ TRONG HẺM 3D
          (Top/Center shows the live 3D Tube House, Folding Iron Gate & Bike!)
         ===================================================================== */}
      {stage === 'spawn_house_decision' && (
        <div
          data-testid="spawn-house-decision-stage"
          className="flex-1 flex flex-col justify-between pointer-events-none mt-2"
        >
          {/* Floating 3D Scene Callout Pill at Top of 3D Viewport */}
          <div className="mx-auto w-full max-w-4xl bg-zinc-950/80 border border-amber-400/70 rounded-2xl px-4 py-2 flex flex-wrap items-center justify-between gap-2 pointer-events-auto shadow-lg">
            <div className="flex items-center gap-2 text-xs font-black text-amber-300">
              <span className="px-2 py-0.5 rounded bg-amber-400 text-zinc-950 text-[10px]">
                SPAWN TẠI NHÀ 3D
              </span>
              <span>
                🏠 Cửa sắt kéo căn nhà ống đang mở trước mắt bạn • Khoảng cách ra Quán Nhậu Ngã Tư: 250m
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-xs font-black animate-pulse">
              ⏱️ Quyết định sinh tử đầu trận: {spawnDecisionTimer}s
            </span>
          </div>

          {/* Open 3D Viewport Middle (Shows the 3D Vietnamese Tube House, Iron Gate, Bollard & Parked Bike!) */}
          <div className="flex-1 min-h-[180px]" />

          {/* Bottom Docked Decision & Bike Skin Selector Panel */}
          <div className="mx-auto w-full max-w-5xl bg-zinc-950/90 border-2 border-amber-500/80 rounded-3xl p-3 sm:p-4 text-white pointer-events-auto shadow-2xl space-y-3">
            {/* Bike Skin Selector Row */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-black text-amber-300 flex items-center gap-2">
                <Compass className="w-4 h-4" />
                <span>
                  CHỌN SKIN CHIẾN CƠ 3D TRƯỚC SÂN NHÀ (ĐỔI MÀU XE 3D TRỰC TIẾP):
                </span>
              </div>
              <span className="text-xs font-black text-emerald-300">
                Ví hiện tại: {userPlayer.coins} Nắp Bia
              </span>
            </div>

            {impoundMatchesLeft > 0 && (
              <div
                data-testid="impounded-bike-warning-banner"
                className="p-2 rounded-xl bg-red-950 border-2 border-red-500 text-red-200 text-xs font-black flex items-center justify-between gap-2"
              >
                <span>{IMPOUNDED_BIKE_TAG_TEMPLATE(impoundMatchesLeft)}</span>
                {onRedeemImpoundedBikeForTest && (
                  <button
                    type="button"
                    onClick={onRedeemImpoundedBikeForTest}
                    className="px-2 py-1 rounded-lg bg-amber-400 text-zinc-950 text-[10px] font-black cursor-pointer shrink-0"
                  >
                    [Chuộc Xe Ngay Để Test Lái]
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(BIKE_SKINS) as BikeSkinId[]).map((skinId) => {
                const spec = BIKE_SKINS[skinId];
                const active = selectedBikeSkin === skinId;
                return (
                  <button
                    key={skinId}
                    type="button"
                    onClick={() => {
                      sound.playChopstickClack();
                      setSelectedBikeSkin(skinId);
                    }}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                      active
                        ? 'bg-amber-500/25 border-amber-400 text-white shadow'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="text-xs font-black truncate">
                      🛵 {spec.name}
                    </div>
                    <div className="text-[10px] text-amber-300 font-bold">
                      Max {spec.maxSpeedKmh}km/h • Đề {spec.kickstartPressesRequired} phát
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 2 Life-or-Death Spawn Decision Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: [🛵 Tự Lái Chiến Cơ 3D] */}
              <button
                type="button"
                data-testid="spawn-choose-self-bike-btn"
                disabled={impoundMatchesLeft > 0}
                onClick={handleChooseSelfDriveOutbound}
                className={`p-3 rounded-2xl border-2 text-left transition flex flex-col justify-between cursor-pointer ${
                  impoundMatchesLeft > 0
                    ? 'bg-zinc-900/60 border-red-800/60 opacity-60 cursor-not-allowed'
                    : 'bg-gradient-to-br from-amber-950/90 via-zinc-900 to-zinc-950 hover:border-amber-300 border-amber-500 shadow-xl active:scale-[0.99]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-zinc-950 font-black text-[10px]">
                      MIỄN PHÍ 0 NẮP BIA • LÁI XE 3D FPP TRỰC TIẾP
                    </span>
                    <span className="text-xs font-black text-amber-300">
                      +{DAN_TO_BONUS_POINTS} Điểm Dân Tổ
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    [🛵 Tự Lái Chiến Cơ 3D] ({currentBikeSpec.name})
                  </h3>
                  <p className="text-[11px] text-zinc-300 mt-0.5 leading-snug">
                    Leo lên yên xe 3D góc nhìn thứ nhất (FPP): nhìn trọn bàn thờ công-tơ-mét 3D, 2 gương chiếu hậu rung bần bật, 2 bàn tay thú bông vặn ga <b>[W]</b>, đá chống <b>[F]</b>, né xe cá viên chiên & chó ngủ!
                  </p>
                </div>
                <div className="mt-2 pt-1.5 border-t border-amber-500/30 text-[10px] font-bold text-rose-300">
                  ⚠️ Rủi ro: Lúc tàn tiệc phải tự cầm lái 3D về với lượng cồn trong máu!
                </div>
              </button>

              {/* Option 2: [📱 Đặt Cuốc Xe Ôm Công Nghệ 3D] */}
              <button
                type="button"
                data-testid="spawn-choose-grab-vip-btn"
                onClick={handleChooseGrabOutbound}
                className="p-3 rounded-2xl border-2 border-emerald-500 hover:border-emerald-300 bg-gradient-to-br from-emerald-950/90 via-zinc-900 to-zinc-950 text-left transition flex flex-col justify-between cursor-pointer shadow-xl active:scale-[0.99]"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-zinc-950 font-black text-[10px]">
                      TỐN {GRAB_VIP_COST_COINS} NẮP BIA • AN TOÀN TUYỆT ĐỐI 100%
                    </span>
                    <span className="text-xs font-black text-emerald-300">
                      🛡️ Khỏi lo cầm lái
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    [📱 Đặt Cuốc Xe Ôm Công Nghệ 3D] (Grab VIP)
                  </h3>
                  <p className="text-[11px] text-zinc-300 mt-0.5 leading-snug">
                    Đợi 3 giây NPC <b>Tài Xế Áo Xanh 3D</b> phóng tới thắng <i>"Kítttt"</i> đón tận cửa. Ngồi yên sau xoay camera 360° ngắm phố 3D hoặc búng tay trêu bạn nhậu!
                  </p>
                </div>
                <div className="mt-2 pt-1.5 border-t border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                  ✅ Đặc quyền Hòa Bình: Lúc về say gục được tài xế 3D cột dây nịt ngang bụng chở tận nhà!
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 2A: LỰA CHỌN 1 — TỰ LÁI XE MÁY 3D FPP (OUTBOUND SOBER 0%)
         ===================================================================== */}
      {stage === 'outbound_fpp_drive' && renderMotorbike3DDrivingHUD(false)}

      {/* =====================================================================
          STAGE 2B: LỰA CHỌN 2 — ĐI XE ÔM CÔNG NGHỆ 3D (OUTBOUND GRAB VIP)
         ===================================================================== */}
      {stage === 'outbound_grab_vip' && (
        <div
          data-testid="outbound-grab-vip-stage"
          className="flex-1 flex flex-col justify-end pointer-events-none"
        >
          {/* Open 3D Viewport showing the 3D Green-Shirt Driver & Bike in Alley */}
          <div className="flex-1" />

          <div className="mx-auto w-full max-w-4xl bg-zinc-950/90 border-2 border-emerald-500 rounded-3xl p-3.5 sm:p-4 text-white pointer-events-auto shadow-2xl">
            {grabWaitTimer > 0 ? (
              <div className="text-center py-4 space-y-1.5">
                <div className="text-2xl animate-bounce">📱🛵💨</div>
                <div className="text-sm font-black text-emerald-300">
                  ĐANG ĐỢI XE ÔM CÔNG NGHỆ 3D PHÓNG TỚI CỬA NHÀ... ({grabWaitTimer}s)
                </div>
                <p className="text-xs text-zinc-300">
                  Đã trừ {GRAB_VIP_COST_COINS} Nắp Bia cước khứ hồi trọn gói!
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="p-3 rounded-2xl bg-zinc-900 border border-emerald-400 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="text-2xl">🧑‍✈️🟢🛵</div>
                    <div>
                      <div className="text-[10px] font-black text-emerald-400 uppercase">
                        THẮNG "KÍTTTT!" NGAY TRƯỚC CỬA SẮT KÉO • TÀI XẾ ÁO XANH 5 SAO:
                      </div>
                      <div
                        data-testid="grab-driver-greeting-line"
                        className="text-xs sm:text-sm font-black text-white"
                      >
                        "Anh/chị có phải là {userPlayer.name} đi nhậu bờ kè không ạ? Lên xe ôm chặt nha!"
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setGrabViewAngle((v) =>
                          v === 'tpp_360' ? 'fpp' : 'tpp_360'
                        );
                        setGrabOrbitDeg((d) => (d + 55) % 360);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-emerald-300 cursor-pointer border border-emerald-500/40"
                    >
                      🔄 Xoay Camera 3D 360° ({grabViewAngle === 'tpp_360' ? 'TPP' : 'FPP'})
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-amber-200 font-semibold">
                  💬 {grabTauntLog}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sound.playUiHover();
                      setGrabOrbitDeg((d) => (d + 45) % 360);
                      setGrabTauntLog(
                        '📱 Bạn ung dung ngồi yên sau 3D rút điện thoại lướt Tóp Tóp, ngắm phố phường về đêm!'
                      );
                    }}
                    className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs cursor-pointer"
                  >
                    📱 Bấm Điện Thoại & Xoay Góc 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playLaugh();
                      setGrabTauntLog(
                        '🫰 "Ê Bảo Nguyễn! Coi chừng quên gạt chân chống tóe lửa kìa con trai!" — Bạn búng tay trêu thằng bạn đang tự lái xe bên cạnh!'
                      );
                    }}
                    className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-200 font-black text-xs cursor-pointer"
                  >
                    🫰 Búng Tay Trêu Bạn Nhậu Bên Cạnh
                  </button>
                  <button
                    type="button"
                    data-testid="finish-outbound-grab-btn"
                    onClick={handleFinishOutboundGrab}
                    className="py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase cursor-pointer shadow-lg"
                  >
                    🍻 Tới Quán Nhậu An Toàn ➔ Vào Bàn!
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 3: CAO TRÀO CUỐI TRẬN — BÃI GIỮ XE LÚC TAN TIỆC & MẸO LÁCH LUẬT
         ===================================================================== */}
      {stage === 'return_parking_decision' && (
        <div
          data-testid="return-parking-decision-stage"
          className="flex-1 flex flex-col justify-end pointer-events-none"
        >
          <div className="flex-1" />

          <div className="mx-auto w-full max-w-5xl bg-zinc-950/90 border-2 border-rose-500 rounded-3xl p-3.5 sm:p-4 text-white pointer-events-auto shadow-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                  🌙 TÀN TIỆC RA BÃI GIỮ XE 3D • ĐỘ CỒN TRONG MÁU: {returnAlcohol}%
                </span>
                <h3 className="text-sm sm:text-base font-black text-white mt-1">
                  ĐƯỜNG VỀ "THẬP TỬ NHẤT SINH": LỰA CHỌN TẠI BÃI GIỮ XE QUÁN!
                </h3>
              </div>
              <span className="text-xs font-bold text-amber-300">
                Tổng Bill: {totalBill.toLocaleString()}đ • Ví: {userPlayer.coins} Nắp Bia
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Choice 1: Risky Drunk 3D FPP Self-Drive */}
              <button
                type="button"
                data-testid="return-choose-drunk-drive-btn"
                onClick={handleStartReturnDrunkDrive}
                className="p-3 rounded-2xl bg-red-950/85 hover:bg-red-900/85 border-2 border-red-400 text-left flex flex-col justify-between cursor-pointer shadow-xl"
              >
                <div>
                  <span className="px-2 py-0.5 rounded bg-red-500 text-white font-black text-[10px]">
                    {isSoberForReturn
                      ? '✅ 0% CỒN • TỰ LÁI VỀ NHÀ'
                      : `⚠️ ${returnAlcohol}% CỒN • TỰ LÁI VỀ NHÀ`}
                  </span>
                  <h4 className="text-sm font-black text-amber-300 mt-1">
                    {isSoberForReturn
                      ? '[🛵 Tự Cầm Lái Chiến Cơ 3D Về Nhà (Tỉnh Táo)]'
                      : '[🛵 Tự Cầm Lái Chiến Cơ 3D Về Nhà Khi Đang Say]'}
                  </h4>
                  <p className="text-[11px] text-zinc-200 mt-0.5">
                    Lái xe 3D góc nhìn thứ nhất khi say: camera nghiêng ngả, <b>trễ thao tác 0.5 giây</b>, ghi-đông 3D tự lạng phải ghì ngược chiều (Counter-steer)!
                  </p>
                </div>
              </button>

              {/* Choice 2: Grab VIP Ragdoll Belt Return */}
              <button
                type="button"
                data-testid="return-choose-grab-vip-btn"
                onClick={() => setStage('return_grab_vip')}
                className="p-3 rounded-2xl bg-emerald-950/85 hover:bg-emerald-900/85 border-2 border-emerald-400 text-left flex flex-col justify-between cursor-pointer shadow-xl"
              >
                <div>
                  <span className="px-2 py-0.5 rounded bg-emerald-400 text-zinc-950 font-black text-[10px]">
                    🛡️ ĐẶC QUYỀN HÒA BÌNH • AN TOÀN 100%
                  </span>
                  <h4 className="text-sm font-black text-emerald-300 mt-1">
                    [🧑‍✈️🟢 Về Bằng Xe Ôm Công Nghệ 3D (Cột Dây Nịt Ngang Bụng)]
                  </h4>
                  <p className="text-[11px] text-zinc-200 mt-0.5">
                    Tài xế áo xanh 3D vác bạn lên yên sau dạng Ragdoll mềm nhũn, <b>cột dây nịt giữ ngang bụng</b> rồi phóng vèo về tận giường!
                  </p>
                </div>
              </button>

              {/* Choice 3: Loophole 1 — Leave bike at pub & walk home (-30 coins) */}
              <button
                type="button"
                data-testid="return-loophole-walk-btn"
                onClick={() =>
                  handleSelectLoopholeOrGrabReturn('walk_overnight_parking')
                }
                className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border-2 border-sky-400/70 text-left flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <span className="px-2 py-0.5 rounded bg-sky-400 text-zinc-950 font-black text-[10px]">
                    💡 MẸO LÁCH LUẬT #1 • TỐN {OVERNIGHT_PARKING_COST_COINS} NẮP BIA
                  </span>
                  <h4 className="text-xs sm:text-sm font-black text-sky-300 mt-1">
                    [🚶 Bỏ Xe Lại Quán & Đi Bộ Lết Về Nhà]
                  </h4>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    Tốn {OVERNIGHT_PARKING_COST_COINS} Nắp Bia phí gửi xe qua đêm tại quán rồi đi bộ lết về nhà!
                  </p>
                </div>
              </button>

              {/* Choice 4: Loophole 2 — Beg security guard to push bike past checkpoint (-20 coins) */}
              <button
                type="button"
                data-testid="return-loophole-guard-btn"
                onClick={() =>
                  handleSelectLoopholeOrGrabReturn(
                    'beg_guard_push_past_checkpoint'
                  )
                }
                className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border-2 border-purple-400/70 text-left flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <span className="px-2 py-0.5 rounded bg-purple-400 text-zinc-950 font-black text-[10px]">
                    💡 MẸO LÁCH LUẬT #2 • TỐN {GUARD_ASSIST_TIP_COINS} NẮP BIA
                  </span>
                  <h4 className="text-xs sm:text-sm font-black text-purple-300 mt-1">
                    [🙏 Năn Nỉ Anh Bảo Vệ Quán Dắt Xe Về Hộ]
                  </h4>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    Tắt máy hoàn toàn và nhờ anh bảo vệ quán dắt bộ chiếc {currentBikeSpec.name} về tận nhà hộ!
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 3A: DRIVING HOME DRUNK IN 3D (DRUNK 3D FPP MECHANICS)
         ===================================================================== */}
      {stage === 'return_drunk_fpp_drive' && renderMotorbike3DDrivingHUD(true)}

      {/* =====================================================================
          STAGE 3B: GRAB VIP RAGDOLL BELT 3D RETURN ("ĐẶC QUYỀN HÒA BÌNH")
         ===================================================================== */}
      {stage === 'return_grab_vip' && (
        <div
          data-testid="return-grab-vip-stage"
          className="flex-1 flex flex-col justify-end pointer-events-none"
        >
          <div className="flex-1" />
          <div className="mx-auto w-full max-w-4xl p-4 rounded-3xl bg-zinc-950/90 border-2 border-emerald-400 space-y-2.5 text-center text-white pointer-events-auto shadow-2xl">
            <span className="px-3 py-1 rounded-full bg-emerald-400 text-zinc-950 font-black text-xs">
              ĐẶC QUYỀN HÒA BÌNH 3D • VỀ NHÀ AN TOÀN 100%
            </span>
            <h3 className="text-base sm:text-lg font-black text-white">
              TÀI XẾ ÁO XANH 3D CỘT DÂY NỊT GIỮ NGANG BỤNG CHỞ VỀ TẬN GIƯỜNG!
            </h3>
            <p className="text-xs text-zinc-200 max-w-xl mx-auto leading-relaxed">
              {isSoberForReturn ? 'Dù bạn tỉnh táo 0% cồn' : <>Dù bạn đã say <b>{returnAlcohol}%</b> mềm nhũn như Ragdoll lắc lư trên yên xe 3D</>}, anh Tài Xế Áo Xanh vẫn đợi sẵn ở cửa quán, <b>lấy dây nịt cột chặt bụng bạn với bụng tài xế</b> rồi chở thẳng về nhà an toàn!
            </p>
            <button
              type="button"
              data-testid="confirm-grab-vip-return-btn"
              onClick={() => handleSelectLoopholeOrGrabReturn('grab_vip_return')}
              className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-sm uppercase cursor-pointer shadow-lg"
            >
              🛏️ VỀ TỚI TẬN GIƯỜNG AN TOÀN 100%
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 4: THE FINAL BOSS — CHỐT THỔI NỒNG ĐỘ CỒN 3D CÁCH NHÀ 20 MÉT!
         ===================================================================== */}
      {stage === 'checkpoint_20m_breathalyzer_qte' && (
        <div
          data-testid="checkpoint-20m-breathalyzer-qte"
          className="flex-1 flex flex-col justify-end pointer-events-none"
        >
          {/* Top 3D Viewport shows the live 3D Yellow-Shirt Traffic Police Officer, Cones, Baton & Breathalyzer! */}
          <div className="flex-1" />

          <div className="mx-auto w-full max-w-4xl rounded-3xl border-2 border-red-500 bg-zinc-950/90 p-3.5 sm:p-4 text-white shadow-2xl pointer-events-auto space-y-2.5">
            <div
              className="h-2.5 w-full rounded-full border border-white/40"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, #dc2626 0, #dc2626 16px, #ffffff 16px, #ffffff 32px)',
              }}
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-3 py-0.5 rounded-full bg-red-600 text-white font-black text-xs animate-pulse">
                🚨 CHỐT CSGT 3D CÁCH CỔNG SẮT NHÀ ĐÚNG 20 MÉT!
              </span>
              <span className="text-xs font-black text-amber-300">
                👮‍♂️🟡 "Tuýt tuýt tuýt! Yêu cầu tắt máy xuống xe thổi nồng độ cồn!"
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-zinc-900/95 border border-zinc-700 rounded-2xl p-3">
              <div className="sm:col-span-5 text-center">
                <div className="text-[10px] font-bold text-zinc-400 mb-1">
                  MÀN HÌNH LED MÁY ĐO NỒNG ĐỘ CỒN 3D:
                </div>
                <div
                  data-testid="breathalyzer-led-screen"
                  className={`p-2.5 rounded-xl font-mono font-black text-xs border-2 ${
                    isBlowingCompleted && !isSoberForReturn
                      ? 'bg-red-950 border-red-500 text-red-300 animate-pulse'
                      : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  }`}
                >
                  {isBlowingCompleted ? (
                    <>
                      <div>
                        {isSoberForReturn ? '✅ TÍT — ÂM TÍNH, MỜI ĐI!' : '🚨 TÍT TÍT TÍT — BÁO ĐỘNG ĐỎ!'}
                      </div>
                      <div className="text-amber-300 mt-0.5">
                        {breathalyzerReadingFor(returnAlcohol)}
                      </div>
                    </>
                  ) : (
                    `ĐANG ĐO HƠI THỞ... (${breathHoldProgress}%)`
                  )}
                </div>
              </div>

              <div className="sm:col-span-7 space-y-2 text-center sm:text-left">
                <p className="text-xs font-bold text-amber-200">
                  💡 <i>"Bấm giữ Space để... nín thở hoặc hút ngược hơi vào ống thổi 3D!"</i>
                </p>
                {!isBlowingCompleted ? (
                  <button
                    type="button"
                    data-testid="qte-breathalyzer-space-btn"
                    onClick={handleHoldBreathalyzerSpace}
                    className="w-full py-3 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer shadow-xl active:scale-95"
                  >
                    😮‍💨 [BẤM GIỮ SPACE] NÍN THỞ / HÚT NGƯỢC HƠI VÀO ỐNG THỔI! ({breathHoldProgress}%)
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="proceed-to-impound-cutscene-btn"
                    onClick={() => setStage('impound_cutscene_summary')}
                    className={`w-full py-3 px-4 rounded-2xl border-2 border-amber-300 text-white font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer shadow-xl ${
                      isSoberForReturn ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500 animate-pulse'
                    }`}
                  >
                    {isSoberForReturn
                      ? '🏠 CSGT CHÀO TẠM BIỆT — CHẠY NỐT 20M VỀ NHÀ!'
                      : '🚛 XEM CUTSCENE 3D XE LÊN THÙNG & KÝ BIÊN BẢN TẠM GIỮ!'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 5: CUTSCENE 3D XE THÙNG CSGT & HỆ QUẢ KINH TẾ
         ===================================================================== */}
      {stage === 'impound_cutscene_summary' && returnResolution && (
        <div
          data-testid="impound-cutscene-summary-stage"
          className="flex-1 flex flex-col justify-end pointer-events-none"
        >
          {/* Top half of viewport shows the 3D Police Tow Truck with the player's bike loaded on the flatbed! */}
          <div className="flex-1" />

          <div className="mx-auto w-full max-w-5xl bg-zinc-950/92 border-2 border-amber-500 rounded-3xl p-3.5 sm:p-4 text-white pointer-events-auto shadow-2xl space-y-3">
            {returnResolution.caughtByPoliceCheckpoint ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-7 bg-zinc-900 border border-red-500 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[10px]">
                      🎬 CUTSCENE 3D XE LÊN THÙNG CSGT
                    </span>
                    <span className="text-xs font-black text-rose-400">
                      {returnResolution.coinsDelta} Nắp Bia (Đắt gấp 10 lần xe ôm!)
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-black text-amber-300">
                    {returnResolution.summaryHeadline}
                  </h3>

                  <div className="p-2.5 rounded-xl bg-red-950/90 border border-red-400 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span>1. Tiền phạt nộp ngân sách:</span>
                      <strong className="text-rose-300 font-black">
                        -{POLICE_CHECKPOINT_FINE_COINS} Nắp Bia (Còn {returnResolution.newCoins} Nắp)
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>2. Trạng thái xe trong Tủ Đồ:</span>
                      <strong
                        data-testid="impound-tag-badge"
                        className="text-amber-200 font-black"
                      >
                        {returnResolution.impoundTagText}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>3. Danh hiệu độc quyền:</span>
                      <strong
                        data-testid="exemplary-taxpayer-title"
                        className="text-emerald-300 font-black"
                      >
                        🏆 "{returnResolution.awardedTitle}"
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Right: Commemorative Polaroid Snapshot */}
                <div className="md:col-span-5 flex flex-col justify-between bg-stone-100 text-zinc-900 rounded-2xl p-3 border-2 border-white shadow-xl">
                  <div className="flex items-center justify-between text-[10px] font-black text-zinc-600 mb-1">
                    <span className="flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-red-600" />
                      <span>ẢNH KỶ NIỆM CHỐT GIAO THÔNG</span>
                    </span>
                    <span>
                      REC • {returnResolution?.breathalyzerReadingText?.split(' khí thở')[0] ?? `${returnAlcohol}% cồn`}
                    </span>
                  </div>
                  <div className="py-2 px-3 rounded-xl bg-zinc-900 text-white text-center">
                    <div className="text-2xl">
                      {AVATAR_FACE_EMOJI[userPlayer.avatar]}😲🎺
                    </div>
                    <div className="text-[11px] font-black text-amber-300">
                      MẮT CHỮ A — MỒM CHỮ O NGẬM ỐNG THỔI!
                    </div>
                    <div className="text-[10px] text-emerald-300 font-bold mt-0.5">
                      🎖️ "{EXEMPLARY_TAXPAYER_TITLE}"
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-400 text-center space-y-1.5">
                <h3 className="text-base font-black text-emerald-300">
                  {returnResolution.summaryHeadline}
                </h3>
                <p className="text-xs text-zinc-200 max-w-xl mx-auto">
                  {returnResolution.summaryDetail}
                </p>
              </div>
            )}

            <button
              type="button"
              data-testid="confirm-commute-outcome-btn"
              onClick={() => onApplyReturnResult(returnResolution)}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer shadow-xl"
            >
              ✅ XÁC NHẬN LƯU HỒ SƠ & KHÉP LẠI VÒNG LẶP 3D "ĐI TỈNH VỀ QUẮC"!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
