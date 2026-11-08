import React from 'react';

/** Any render crash shows what happened + a reload button instead of a blank black screen. */
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 p-6 text-center text-white">
        <div className="max-w-md space-y-3">
          <div className="text-6xl">🍺💥</div>
          <h1 className="font-neon text-2xl text-amber-300">Quán bị cúp điện đột xuất!</h1>
          <p className="text-sm text-zinc-300">
            Có lỗi khi hiển thị game. Nếu bạn vừa cập nhật code, hãy khởi động lại server (<code>yarn dev</code>) rồi tải lại trang.
          </p>
          <pre className="max-h-32 overflow-auto rounded-lg bg-black/60 p-2 text-left text-[11px] text-red-300 whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-amber-500 px-5 py-2 font-black text-zinc-950 hover:bg-amber-400 cursor-pointer"
          >
            🔄 Tải lại trang
          </button>
        </div>
      </div>
    );
  }
}
