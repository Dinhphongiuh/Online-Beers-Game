/**
 * Dev Mode: area for features still in development, for accounts whose roles
 * grant `dev_mode.access` (admin, tester). The server re-checks the permission
 * (GET /api/dev/features), so a client that edits its own access gets nothing.
 */
import React, { Suspense, lazy, useEffect, useState } from 'react';
import type { DevFeature } from '../../shared/devFeatures';

// three-vrm / WebGPU only load once someone actually opens a lab.
const VrmCharacterLab = lazy(() =>
  import('./VrmCharacterLab').then((module) => ({ default: module.VrmCharacterLab }))
);
const NextGenBarLab = lazy(() =>
  import('./NextGenBarLab').then((module) => ({ default: module.NextGenBarLab }))
);
const UiLab = lazy(() => import('./UiLab').then((module) => ({ default: module.UiLab })));

const TOKEN_KEY = 'tram_nhau_auth_token';

type FeatureState =
  | { kind: 'loading' }
  | { kind: 'ready'; features: DevFeature[] }
  | { kind: 'error'; message: string };

export const DevModePanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [features, setFeatures] = useState<FeatureState>({ kind: 'loading' });
  const [openFeature, setOpenFeature] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem(TOKEN_KEY);
    fetch('/api/dev/features', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setFeatures({ kind: 'error', message: data.error || `Lỗi ${res.status}` });
        else setFeatures({ kind: 'ready', features: data.features || [] });
      })
      .catch((error) => !cancelled && setFeatures({ kind: 'error', message: String(error) }));
    return () => {
      cancelled = true;
    };
  }, []);

  const current = features.kind === 'ready' ? features.features.find((f) => f.id === openFeature) : undefined;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-6">
      <div
        data-testid="dev-mode-panel"
        className="flex flex-col w-full max-w-6xl h-full max-h-[860px] rounded-3xl border-2 border-fuchsia-500/70 bg-zinc-950 shadow-2xl overflow-hidden"
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800 bg-fuchsia-950/40">
          <div className="flex items-center gap-2 min-w-0">
            {current && (
              <button
                onClick={() => setOpenFeature(null)}
                className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-black text-zinc-200"
              >
                ← Danh sách
              </button>
            )}
            <span className="text-lg">🧪</span>
            <div className="min-w-0">
              <h2 className="font-black text-fuchsia-200 truncate">{current ? current.title : 'Dev Mode'}</h2>
              <p className="text-[11px] text-zinc-400">Quyền dev_mode.access • Tính năng đang phát triển</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-600 text-sm font-black text-zinc-100"
          >
            ✕ Đóng
          </button>
        </header>

        <div className="flex-1 min-h-0 p-3 sm:p-4">
          {features.kind === 'loading' && <p className="text-zinc-400 text-sm">Đang kiểm tra quyền…</p>}
          {features.kind === 'error' && <p className="text-rose-300 text-sm font-bold">⛔ {features.message}</p>}

          {features.kind === 'ready' && !current && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {features.features.map((feature) => (
                <button
                  key={feature.id}
                  onClick={() => setOpenFeature(feature.id)}
                  className="text-left rounded-2xl border border-zinc-700 hover:border-fuchsia-400 bg-zinc-900/70 p-4 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-amber-200">{feature.title}</span>
                    <span className="text-[10px] font-black uppercase rounded-full px-2 py-0.5 bg-fuchsia-500/20 text-fuchsia-200">
                      {feature.status}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-400 leading-snug">{feature.description}</p>
                </button>
              ))}
            </div>
          )}

          {current?.id === 'vrm-character' && (
            <Suspense fallback={<p className="text-zinc-400 text-sm">Đang tải VRM Lab…</p>}>
              <VrmCharacterLab />
            </Suspense>
          )}
          {current?.id === 'nextgen-bar' && (
            <Suspense fallback={<p className="text-zinc-400 text-sm">Đang tải WebGPU…</p>}>
              <NextGenBarLab />
            </Suspense>
          )}
          {current?.id === 'ui-lab' && (
            <Suspense fallback={<p className="text-zinc-400 text-sm">Đang tải UI Lab…</p>}>
              <UiLab />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
};
