/**
 * Getting to and from a table on the "Quán Ốc Bờ Sông" map: replaces the generic
 * commute (CommuteLoopModal) with the Quán Ốc ride from the frozen snapshot.
 *
 *  - Outbound (start of the night): ride from the home alley to the quán's parking lot,
 *    or take a xe ôm.
 *  - Return (end of the night): ride home with your real Độ Cồn past the checkpoint at
 *    the alley, take a xe ôm, or leave the bike overnight.
 *
 * Results go through the game's own commute rules (coins, fines, impound, titles) so
 * the night recap and the profile stay consistent with the other maps.
 * Hand-written glue (not overwritten by `yarn promote:quan-oc`).
 */
import React, { useState } from 'react';
import type { Player } from '../../game/types';
import {
  DAN_TO_BONUS_POINTS,
  GRAB_VIP_COST_COINS,
  OVERNIGHT_PARKING_COST_COINS,
  resolveReturnCommuteOutcome,
  type BikeSkinId,
  type CommuteTransportMode,
  type ReturnCommuteOption,
  type ReturnCommuteResolutionResult,
} from '../../game/commuteLoopLogic';
import { RIDE_BIKES } from './game/rideLab/bikePhysics';
import type { CameraMode } from './game/rideLab/rideWorld';
import { RideView } from './ui/RideView';

export interface OutboundCommutePayload {
  mode: CommuteTransportMode;
  bikeSkin: BikeSkinId;
  coinsDelta: number;
  danToBonusPoints: number;
  pubSignCrashPenaltyVnd: number;
  headline: string;
}

interface Props {
  phase: 'outbound' | 'return';
  userPlayer: Player;
  onOutbound: (payload: OutboundCommutePayload) => void;
  onReturn: (result: ReturnCommuteResolutionResult) => void;
}

const bikeOf = (player: Player): BikeSkinId => {
  const id = player.selectedBikeSkin ?? 'dream_chien';
  return RIDE_BIKES.some((b) => b.id === id) ? id : 'dream_chien';
};

export const QuanOcCommute: React.FC<Props> = ({ phase, userPlayer, onOutbound, onReturn }) => {
  const [riding, setRiding] = useState(false);
  const [camera, setCamera] = useState<CameraMode>('tpp');
  const bike = bikeOf(userPlayer);
  const bikeName = RIDE_BIKES.find((b) => b.id === bike)?.name ?? bike;
  const impounded = (userPlayer.bikeImpoundMatchesLeft ?? 0) > 0;
  const alcohol = Math.round(userPlayer.alcoholLevel);

  const resolveReturn = (option: ReturnCommuteOption) =>
    onReturn(
      resolveReturnCommuteOutcome({
        option,
        currentCoins: userPlayer.coins,
        currentImpoundMatchesLeft: userPlayer.bikeImpoundMatchesLeft ?? 0,
        alcoholLevel: userPlayer.alcoholLevel,
        playerName: userPlayer.name,
      })
    );

  if (riding) {
    return (
      <div className="fixed inset-0 z-[80] bg-black" data-testid="quan-oc-commute-ride">
        <RideView
          direction={phase}
          alcohol={phase === 'return' ? userPlayer.alcoholLevel : 0}
          bikeId={bike}
          cameraMode={camera}
          traffic
          onCameraChange={setCamera}
          renderArrival={(result, rideAgain) =>
            result.direction === 'outbound' ? (
              <>
                <button
                  onClick={() =>
                    onOutbound({
                      mode: 'self_bike',
                      bikeSkin: bike,
                      coinsDelta: 0,
                      danToBonusPoints: DAN_TO_BONUS_POINTS,
                      pubSignCrashPenaltyVnd: 0,
                      headline: `🅿️ Đã gửi ${bikeName} ở bãi Quán Ốc Bờ Sông (+${DAN_TO_BONUS_POINTS} nắp bia Dân Tổ). Vào bàn thôi!`,
                    })
                  }
                  className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-zinc-950"
                  data-testid="quan-oc-commute-enter"
                >
                  Vào bàn nhậu 🍻
                </button>
                <button onClick={rideAgain} className="rounded-xl border border-zinc-600 px-3 py-2 text-xs font-black text-zinc-200">
                  Chạy lại
                </button>
              </>
            ) : (
              <button
                onClick={() => resolveReturn('drunk_self_drive')}
                className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-zinc-950"
                data-testid="quan-oc-commute-home"
              >
                Kết thúc buổi nhậu 🌙
              </button>
            )
          }
        />
      </div>
    );
  }

  const card = 'w-full rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" data-testid="quan-oc-commute">
      <div className="w-full max-w-md rounded-3xl border-2 border-amber-400/70 bg-zinc-950/95 p-5 box-neon-yellow">
        <p className="text-center text-3xl">{phase === 'outbound' ? '🏠➜🦪' : '🦪➜🏠'}</p>
        <h2 className="mt-1 text-center font-neon text-2xl text-amber-200 text-neon-yellow">
          {phase === 'outbound' ? 'Tới Quán Ốc Bờ Sông' : 'Về nhà thôi!'}
        </h2>
        <p className="mt-1 text-center text-xs text-zinc-400">
          {phase === 'outbound'
            ? '~1,4 km: hẻm nhà → ngã tư có đèn → bờ kè → bãi giữ xe của quán.'
            : `Độ cồn hiện tại: ${alcohol}%. Chốt CSGT đứng ngay đầu hẻm nhà.`}
        </p>
        <div className="mt-4 space-y-2">
          {phase === 'outbound' ? (
            <>
              <button
                disabled={impounded}
                onClick={() => setRiding(true)}
                className={`${card} border-amber-400 bg-amber-400/10 hover:bg-amber-400/20`}
                data-testid="quan-oc-commute-self"
              >
                <p className="font-black text-amber-100">🛵 Tự chạy {bikeName} tới quán</p>
                <p className="text-[11px] text-zinc-400">
                  {impounded ? `Xe đang bị giam ở đồn (${userPlayer.bikeImpoundMatchesLeft} trận nữa).` : `Gửi xe vào ô xanh ở bãi • +${DAN_TO_BONUS_POINTS} nắp bia Dân Tổ`}
                </p>
              </button>
              <button
                onClick={() =>
                  onOutbound({
                    mode: 'grab_vip',
                    bikeSkin: bike,
                    coinsDelta: -GRAB_VIP_COST_COINS,
                    danToBonusPoints: 0,
                    pubSignCrashPenaltyVnd: 0,
                    headline: `🚕 Xe ôm thả bạn trước cửa Quán Ốc Bờ Sông (−${GRAB_VIP_COST_COINS} nắp bia).`,
                  })
                }
                className={`${card} border-zinc-700 bg-zinc-900 hover:border-amber-400/60`}
              >
                <p className="font-black text-zinc-100">🚕 Đi xe ôm tới quán</p>
                <p className="text-[11px] text-zinc-400">−{GRAB_VIP_COST_COINS} nắp bia, khỏi lái</p>
              </button>
            </>
          ) : (
            <>
              <button
                disabled={impounded}
                onClick={() => setRiding(true)}
                className={`${card} border-rose-500 bg-rose-500/10 hover:bg-rose-500/20`}
                data-testid="quan-oc-commute-self"
              >
                <p className="font-black text-rose-100">🛵 Tự lái {bikeName} về</p>
                <p className="text-[11px] text-zinc-400">
                  {impounded
                    ? 'Xe đang bị giam ở đồn.'
                    : alcohol > 0
                    ? `Đang ${alcohol}% cồn: tay lái lảo đảo, và CSGT sẽ thổi ở đầu hẻm.`
                    : 'Tỉnh táo: chạy về an toàn.'}
                </p>
              </button>
              <button onClick={() => resolveReturn('grab_vip_return')} className={`${card} border-zinc-700 bg-zinc-900 hover:border-amber-400/60`}>
                <p className="font-black text-zinc-100">🚕 Gọi xe ôm về</p>
                <p className="text-[11px] text-zinc-400">−{GRAB_VIP_COST_COINS} nắp bia, an toàn tuyệt đối</p>
              </button>
              <button onClick={() => resolveReturn('walk_overnight_parking')} className={`${card} border-zinc-700 bg-zinc-900 hover:border-amber-400/60`}>
                <p className="font-black text-zinc-100">🅿️ Gửi xe qua đêm ở bãi, đi bộ về</p>
                <p className="text-[11px] text-zinc-400">−{OVERNIGHT_PARKING_COST_COINS} nắp bia, mai quay lại lấy xe</p>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
