import React, { useState } from 'react';
import type { NightReport } from '../game/nightReportLogic';

interface NightReportModalProps {
  report: NightReport;
  playerName: string;
  /** Saved to the Hộ Chiếu Tửu Lượng (MongoDB) — null while saving, false if it failed. */
  saved: boolean | null;
  onExitToMenu: () => void;
}

const vnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

const ENDING_STYLE: Record<NightReport['ending']['kind'], { label: string; tone: string }> = {
  rode_home_safe: { label: '🛵 Tự chạy xe về tới nhà', tone: 'text-emerald-300 border-emerald-500/60' },
  grab_home: { label: '🚕 Gọi Grab về an toàn', tone: 'text-sky-300 border-sky-500/60' },
  caught_checkpoint: { label: '🚨 Dính chốt CSGT — xe về đồn', tone: 'text-red-300 border-red-500/60' },
  left_table: { label: '🚪 Rời bàn sớm', tone: 'text-zinc-300 border-zinc-500/60' },
  passed_out: { label: '💤 Gục tại bàn = Đầu hàng — bị khiêng về', tone: 'text-purple-300 border-purple-500/60' },
};

/** "Biên Bản Cuối Buổi": the night is over — stats, rank, table ranking, then menu or tăng 2. */
export const NightReportModal: React.FC<NightReportModalProps> = ({
  report,
  playerName,
  saved,
  onExitToMenu,
}) => {
  const [bidaSoon, setBidaSoon] = useState(false);
  const ending = ENDING_STYLE[report.ending.kind];
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border-4 border-amber-400 bg-[#fdf6e3] text-zinc-900 shadow-2xl rotate-[-0.6deg]">
        {/* Stamp */}
        <div className="absolute right-4 top-4 rotate-[12deg] rounded-lg border-4 border-red-600 px-2 py-1 text-red-600 font-black text-xs uppercase opacity-80">
          Đã tàn tiệc
        </div>

        <div className="px-5 pt-5 pb-3 border-b-2 border-dashed border-zinc-400">
          <div className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">
            Cộng hòa bàn nhậu • Độc lập – Tự do – Say xỉn
          </div>
          <h2 className="text-2xl font-black uppercase mt-1">📜 Biên Bản Cuối Buổi</h2>
          <div className="text-xs text-zinc-600">
            Bợm nhậu: <b>{playerName}</b> • Thời lượng: <b>{report.durationMinutes} phút</b>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Rank */}
          <div className="flex items-center gap-3 rounded-xl bg-zinc-900 text-amber-200 px-4 py-3">
            <div className="text-4xl">{report.rankEmoji}</div>
            <div className="flex-1">
              <div className="text-[10px] uppercase font-black text-zinc-400">Danh hiệu đêm nay</div>
              <div className="text-lg font-black">{report.rankTitle}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-black text-zinc-400">Điểm</div>
              <div className="text-2xl font-black text-amber-300">{report.score}</div>
            </div>
          </div>

          {/* Ending */}
          <div className={`rounded-xl border-2 bg-zinc-900 px-4 py-2 ${ending.tone}`}>
            <div className="text-sm font-black">{ending.label}</div>
            {report.ending.headline && <div className="text-xs text-zinc-300 mt-0.5">{report.ending.headline}</div>}
            {report.ending.breathalyzerText && (
              <div className="text-xs font-mono text-red-300 mt-1">🎈 {report.ending.breathalyzerText}</div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['🍺', 'Số ly', `${report.stats.drinks}`],
              ['🔥', 'Cồn đỉnh', `${Math.round(report.stats.peakAlcohol)}%`],
              ['📣', 'Hét DZÔ', report.stats.loudestDzoDb ? `${Math.round(report.stats.loudestDzoDb)} dB` : '—'],
              ['🩴', 'Dép trúng', `${report.stats.slipperHits}/${report.stats.slippersThrown}`],
              ['💥', 'Lật bàn', `${report.stats.tablesFlipped}`],
              ['💤', 'Gục', `${report.stats.timesPassedOut}`],
            ].map(([icon, label, value]) => (
              <div key={label} className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5">
                <div className="text-lg leading-none">{icon}</div>
                <div className="text-[10px] uppercase font-bold text-zinc-500 mt-0.5">{label}</div>
                <div className="text-sm font-black">{value}</div>
              </div>
            ))}
          </div>

          {/* Bill */}
          <div className="rounded-xl border-2 border-dashed border-zinc-400 bg-white px-4 py-2 text-sm">
            <div className="flex justify-between">
              <span>Tổng hóa đơn cả bàn</span>
              <b>{vnd(report.stats.billTotal)}</b>
            </div>
            <div className="flex justify-between">
              <span>Phần của bạn</span>
              <b className={report.billShare === 0 ? 'text-emerald-700' : 'text-red-700'}>
                {report.billShare === 0 ? 'Trốn được 😎' : vnd(report.billShare)}
              </b>
            </div>
          </div>

          {/* Highlights */}
          <ul className="space-y-1 text-sm">
            {report.highlights.map((h) => (
              <li key={h} className="rounded-md bg-amber-100/80 px-2 py-1">
                {h}
              </li>
            ))}
          </ul>

          {/* Table ranking */}
          {report.tableRanking.length > 1 && (
            <div>
              <div className="text-[10px] font-black uppercase text-zinc-500 mb-1">Bảng say cả bàn</div>
              <div className="space-y-0.5">
                {report.tableRanking.map((p, i) => (
                  <div
                    key={`${p.name}_${i}`}
                    className={`flex text-xs px-2 py-0.5 rounded ${p.isUser ? 'bg-amber-200 font-black' : ''}`}
                  >
                    <span className="w-5">{i + 1}.</span>
                    <span className="flex-1 truncate">
                      {p.name}
                      {p.isRemote ? ' 🌐' : ''}
                      {p.isUser ? ' (bạn)' : ''}
                    </span>
                    <span>{Math.round(p.alcohol)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-amber-700">🪙 +{report.coinsReward} Nắp bia thưởng</span>
            <span className="text-zinc-500">
              {saved === null
                ? '⏳ Đang lưu vào Hộ Chiếu…'
                : saved
                ? '✅ Đã lưu vào Hộ Chiếu Tửu Lượng'
                : '⚠️ Chưa lưu được (máy chủ dữ liệu lỗi)'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 px-5 pb-5">
          <button
            type="button"
            data-testid="after-party-bida-btn"
            onClick={() => setBidaSoon(true)}
            className="relative rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black py-3 text-sm shadow-lg"
          >
            🎱 Tăng 2 (Bida)
            {bidaSoon && (
              <span
                data-testid="after-party-coming-soon"
                className="absolute -top-3 left-1/2 -translate-x-1/2 rotate-[-6deg] whitespace-nowrap rounded-md border-2 border-amber-300 bg-zinc-900 px-2 py-0.5 text-[11px] text-amber-300 shadow-lg"
              >
                🚧 COMING SOON
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onExitToMenu}
            className="rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 font-black py-3 text-sm shadow-lg"
          >
            🏠 Về Menu
          </button>
        </div>
      </div>
    </div>
  );
};
