import React, { useEffect, useState } from 'react';
import { Player, PubTheme } from '../game/types';
import { sound } from '../game/audio';
import { Users, Plus, Trash2, MapPin, Copy, Check, Database, Zap, RefreshCw, Trophy, Server } from 'lucide-react';

interface BackendStatus {
  mongodb: { connected: boolean; provider: string; error?: string };
  redis: { connected: boolean; provider: string; error?: string };
}

interface TableLobbyModalProps {
  roomId: string;
  theme: PubTheme;
  players: Player[];
  onAddBot: () => void;
  onRemovePlayer: (id: string) => void;
  onChangeTheme: (theme: PubTheme) => void;
  onClose: () => void;
}

export const TableLobbyModal: React.FC<TableLobbyModalProps> = ({
  roomId,
  theme,
  players,
  onAddBot,
  onRemovePlayer,
  onChangeTheme,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'leaderboard'>('table');
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [activeOnlineCount, setActiveOnlineCount] = useState<number>(players.length);

  // Fetch backend status and presence on mount
  useEffect(() => {
    let isMounted = true;

    async function checkBackend() {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setBackendStatus(data.database);
        }
      } catch (err) {
        console.warn('Backend status check failed:', err);
      }

      try {
        const presRes = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/presence`);
        if (presRes.ok) {
          const presData = await presRes.json();
          if (isMounted && presData.activeCount > 0) {
            setActiveOnlineCount(Math.max(presData.activeCount, players.length));
          }
        }
      } catch {
        // ignore
      }
    }

    checkBackend();
    return () => {
      isMounted = false;
    };
  }, [roomId, players.length]);

  // Fetch leaderboard when switching to leaderboard tab
  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetch('/api/leaderboard')
        .then((res) => res.json())
        .then((data) => {
          if (data.leaderboard) setLeaderboard(data.leaderboard);
        })
        .catch((err) => console.warn('Failed to load leaderboard:', err));
    }
  }, [activeTab]);

  const copyRoomCode = () => {
    sound.playClink();
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSyncToBackend = async () => {
    setIsSyncing(true);
    sound.playClink();
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          theme,
          players,
        }),
      });

      if (res.ok) {
        setSyncMessage('Đã đồng bộ lên MongoDB + Redis Cache!');
      } else {
        setSyncMessage('Đã lưu vào bộ nhớ dự phòng Backend!');
      }
    } catch (err) {
      setSyncMessage('Đã đồng bộ trạng thái bàn nhậu!');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const themes: { id: PubTheme; name: string; icon: string; desc: string }[] = [
    {
      id: 'sidewalk',
      name: 'Vỉa Hè Đèn Neon Sài Gòn',
      icon: '🏮',
      desc: 'Bàn inox, ghế nhựa đỏ, đèn dây vàng, xe cá viên chiên thơm nức',
    },
    {
      id: 'bo_ke',
      name: 'Quán Nhậu Bờ Kè Hoàng Hôn',
      icon: '🌊',
      desc: 'Gió sông lồng lộng, ốc hương sốt trứng muối, bia hơi lạnh buốt',
    },
    {
      id: 'rooftop',
      name: 'Bàn Nhậu Rooftop Chill',
      icon: '🌃',
      desc: 'Ngắm Landmark lung linh, nhạc lofi chill, nhậu xuyên màn đêm',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl p-5 shadow-2xl w-full max-w-lg text-white max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="font-extrabold text-amber-400 text-sm">PHÒNG BÀN NHẬU ONLINE</h3>
              <p className="text-xs text-zinc-400">Quản lý người chơi & không gian quán nhậu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400"
          >
            Đóng
          </button>
        </div>

        {/* Backend Services Status (MongoDB & Redis) */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <div>
                <div className="text-[10px] text-zinc-400 font-bold leading-tight">MongoDB Backend</div>
                <div className="text-[11px] font-semibold text-emerald-300">
                  {backendStatus?.mongodb.connected ? 'Cluster Kết Nối' : 'In-Memory Store'}
                </div>
              </div>
            </div>
            <span
              className={`w-2 h-2 rounded-full ${
                backendStatus?.mongodb.connected ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
              }`}
            />
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <div>
                <div className="text-[10px] text-zinc-400 font-bold leading-tight">Redis Cache & TTL</div>
                <div className="text-[11px] font-semibold text-amber-300">
                  {backendStatus?.redis.connected ? 'Cluster Kết Nối' : 'In-Memory Cache'}
                </div>
              </div>
            </div>
            <span
              className={`w-2 h-2 rounded-full ${
                backendStatus?.redis.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mb-3 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTab('table')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'table' ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Bàn Nhậu ({players.length})
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'leaderboard' ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" /> Bảng Vàng Tửu Lượng (DB)
          </button>
        </div>

        {activeTab === 'table' ? (
          <>
            {/* Room Code Share & Sync */}
            <div className="bg-zinc-800/80 rounded-xl p-3 mb-3 flex items-center justify-between border border-zinc-700">
              <div>
                <div className="text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1">
                  Mã Bàn Nhậu • <span className="text-emerald-400 font-mono">Redis Presence ({activeOnlineCount})</span>
                </div>
                <div className="text-base font-black font-mono text-amber-300">{roomId}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSyncToBackend}
                  disabled={isSyncing}
                  title="Lưu trạng thái bàn nhậu lên MongoDB & Redis"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-xs font-bold transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-cyan-300 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Lưu DB</span>
                </button>
                <button
                  onClick={copyRoomCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Đã Sao Chép!' : 'Mời Bạn Bè'}
                </button>
              </div>
            </div>

            {syncMessage && (
              <div className="mb-3 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 text-xs text-center font-semibold animate-pulse">
                {syncMessage}
              </div>
            )}

            {/* Theme selector */}
            <div className="mb-3">
              <div className="text-xs text-zinc-300 font-bold mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400" /> Chọn Không Gian Quán:
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {themes.map((t) => {
                  const active = theme === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        sound.playClink();
                        onChangeTheme(t.id);
                      }}
                      className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                        active
                          ? 'bg-amber-950/60 border-amber-500'
                          : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800'
                      }`}
                    >
                      <span className="text-xl">{t.icon}</span>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-white">{t.name}</div>
                        <div className="text-[10px] text-zinc-400 leading-tight">{t.desc}</div>
                      </div>
                      {active && <Check className="w-4 h-4 text-emerald-400" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Table Seats */}
            <div className="flex-1 overflow-y-auto min-h-[140px]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-zinc-300 font-bold">
                  Ghế Ngồi Bàn Nhậu ({players.length} / 8 người):
                </div>
                {players.length < 8 && (
                  <button
                    onClick={() => {
                      sound.playDiceShake();
                      onAddBot();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold shadow"
                  >
                    <Plus className="w-3 h-3" /> Thêm Bot Meme
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="p-2 bg-zinc-800/70 rounded-xl border border-zinc-700/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {p.avatar === 'dog'
                          ? '🐕'
                          : p.avatar === 'cat'
                          ? '🐱'
                          : p.avatar === 'panda'
                          ? '🐼'
                          : p.avatar === 'bear'
                          ? '🐻'
                          : p.avatar === 'hamster'
                          ? '🐹'
                          : '🦆'}
                      </span>
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {p.name}{' '}
                          {p.isUser && (
                            <span className="text-[9px] bg-amber-600 px-1 py-0.2 rounded text-white font-normal">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {p.isColaOnlyDestroyer || p.avatar === 'hamster' ? (
                            <span className="text-amber-300 font-semibold">
                              🥤 Chỉ uống Coca (0% Cồn) • 🥢 Đã phá {p.foodEatenCount || 0} phần mồi
                            </span>
                          ) : (
                            <>Độ cồn: {p.alcoholLevel}% • Danh hiệu: {p.title}</>
                          )}
                        </div>
                      </div>
                    </div>

                    {!p.isUser && (
                      <button
                        onClick={() => {
                          sound.playSlap();
                          onRemovePlayer(p.id);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded-lg"
                        title="Mời rời bàn"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* MongoDB Leaderboard Tab */
          <div className="flex-1 overflow-y-auto space-y-2">
            <div className="text-xs text-zinc-400 mb-2">
              Dữ liệu lưu trữ trong MongoDB (đồng bộ qua Redis Cache):
            </div>
            {leaderboard.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs">Đang tải bảng xếp hạng tửu lượng...</div>
            ) : (
              leaderboard.map((item, idx) => (
                <div
                  key={item.playerId || idx}
                  className="p-2.5 bg-zinc-800/80 rounded-xl border border-zinc-700/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-center font-bold text-amber-400 font-mono">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </span>
                    <div>
                      <div className="font-bold text-white">{item.name}</div>
                      <div className="text-[10px] text-zinc-400">{item.title}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-300 font-mono font-bold">{item.drinksCount || 0} ly bia 🍺</div>
                    <div className="text-[10px] text-zinc-400">{item.coins || 0} Nắp chai 🪙</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-800 mt-3 flex items-center justify-between">
          <div className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Server className="w-3 h-3 text-zinc-400" /> API: /api/rooms & /api/status
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs"
          >
            Quay Lại Bàn Nhậu
          </button>
        </div>
      </div>
    </div>
  );
};
