import React, { useState } from 'react';
import { Player, CharacterAvatar, ClothingType, HatType, GlassType } from '../game/types';
import { BIKE_SKINS, BikeSkinId, IMPOUNDED_BIKE_TAG_TEMPLATE } from '../game/commuteLoopLogic';
import { sound } from '../game/audio';
import { ShoppingBag, Check, Coins, Lock } from 'lucide-react';

interface ShopModalProps {
  userPlayer: Player;
  onUpdateCosmetics: (updates: {
    avatar?: CharacterAvatar;
    clothing?: ClothingType;
    hat?: HatType;
    glassType?: GlassType;
    selectedBikeSkin?: BikeSkinId;
  }) => void;
  onClose: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  userPlayer,
  onUpdateCosmetics,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    'avatar' | 'clothing' | 'hat' | 'glass' | 'bike'
  >('avatar');

  const impoundLeft = userPlayer.bikeImpoundMatchesLeft || 0;
  const currentBikeSkin: BikeSkinId = userPlayer.selectedBikeSkin || 'dream_chien';

  const avatars: { id: CharacterAvatar; name: string; icon: string; desc: string }[] = [
    { id: 'dog', name: 'Chó Cỏ Vàng', icon: '🐕', desc: 'Trung thành, chuyên húp trọn đáy ly' },
    { id: 'panda', name: 'Gấu Trúc Đêm (Phi Quân)', icon: '🐼', desc: 'Mắt thâm quầng vì nhậu thâu đêm suốt sáng' },
    { id: 'bear', name: 'Gấu Nâu (Khoa Nguyên)', icon: '🐻', desc: 'Đô bất tử, dũng sĩ diệt mồi số 1 bàn nhậu' },
    { id: 'cat', name: 'Mèo Mướp (Bảo Nguyễn)', icon: '🐱', desc: 'Chảnh chọe, chực gắp miếng mồi ngon nhất' },
    { id: 'hamster', name: 'Chuột Hamster Đuôi Dài (Nga Phan)', icon: '🐹', desc: 'Chỉ uống Coca 0% cồn, chuyên gia càn quét sạch đĩa mồi' },
    { id: 'duck', name: 'Vịt Vàng', icon: '🦆', desc: 'Cạp cạp, bơi trong biển bia không biết say' },
  ];

  const clothes: { id: ClothingType; name: string; icon: string; desc: string }[] = [
    { id: 'tanktop_red', name: 'Áo Ba Lỗ Đỏ', icon: '🎽', desc: 'Chuẩn phong cách bợm nhậu vỉa hè' },
    { id: 'tanktop_white', name: 'Áo Ba Lỗ Trắng', icon: '👕', desc: 'Thoáng mát, sẵn sàng chiến tới bến' },
    { id: 'floral_shirt', name: 'Áo Sơ Mi Hoa Hòe', icon: '🌺', desc: 'Dân chơi phố biển sang chảnh' },
    { id: 'gold_chain', name: 'Dây Chuyền Vàng To Bản', icon: '🪙', desc: 'Đại gia phố núi, bao cả quán' },
  ];

  const hats: { id: HatType; name: string; icon: string; desc: string }[] = [
    { id: 'none', name: 'Đầu Trần Thoáng Mát', icon: '🧑', desc: 'Tự nhiên như ruồi' },
    { id: 'sunglasses', name: 'Kính Râm Đen Ngầu', icon: '🕶️', desc: 'Giấu đôi mắt đỏ lừ vì quá chén' },
    { id: 'traffic_helmet', name: 'Nón Bảo Hiểm Tổ Ong', icon: '🪖', desc: 'Đã uống rượu bia thì không lái xe!' },
    { id: 'towel', name: 'Khăn Lạnh Vắt Vai', icon: '🧣', desc: 'Lau mồ hôi, giải nhiệt cấp tốc' },
  ];

  const glasses: { id: GlassType; name: string; icon: string; desc: string }[] = [
    { id: 'beer_mug', name: 'Ly Quai Thủy Tinh', icon: '🍺', desc: 'Ly quai tiêu chuẩn, cụng kêu leng keng' },
    { id: 'coi_glass', name: 'Ly Cối Bia Hơi', icon: '🥛', desc: 'Huyền thoại bia hơi vỉa hè Hà Nội' },
    { id: 'horn', name: 'Sừng Trâu Chiến Thần', icon: '📯', desc: 'Uống cạn một hơi không thể đặt xuống' },
    { id: 'jade_cup', name: 'Chén Ngọc Hoàng Gia', icon: '🏺', desc: 'Nhậu quý tộc sang chảnh' },
  ];

  const handleSelect = (
    category: 'avatar' | 'clothing' | 'hat' | 'glass' | 'bike',
    value: string
  ) => {
    if (category === 'bike' && impoundLeft > 0) {
      sound.playPoliceWhistleAndBreathalyzer(true);
      return;
    }
    sound.playClink();
    if (category === 'bike') {
      onUpdateCosmetics({ selectedBikeSkin: value as BikeSkinId });
    } else {
      onUpdateCosmetics({ [category === 'glass' ? 'glassType' : category]: value });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl p-5 shadow-2xl w-full max-w-lg text-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="font-extrabold text-amber-400 text-sm">TIỆM TẠP HÓA CÔ BA & TỦ ĐỒ</h3>
              <p className="text-xs text-zinc-400">Trang phục, phụ kiện, ly chiến & chiến cơ đi nhậu</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-amber-950/80 px-2 py-1 rounded-lg text-xs font-bold text-amber-300 border border-amber-600/30">
              <Coins className="w-3.5 h-3.5" /> {userPlayer.coins} Nắp
            </div>
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800 pb-2 mb-3 overflow-x-auto">
          {[
            { id: 'avatar', label: '🐾 Thú Chibi' },
            { id: 'clothing', label: '🎽 Quần Áo' },
            { id: 'hat', label: '🕶️ Phụ Kiện' },
            { id: 'glass', label: '🍺 Ly Cụng' },
            { id: 'bike', label: '🛵 Chiến Cơ' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as typeof activeTab);
                sound.playDiceShake();
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {activeTab === 'avatar' &&
            avatars.map((item) => {
              const isEquipped = userPlayer.avatar === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect('avatar', item.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isEquipped
                      ? 'bg-amber-950/60 border-amber-500'
                      : 'bg-zinc-800/60 border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        {item.name}
                        {isEquipped && (
                          <span className="text-[10px] bg-emerald-600 px-1.5 py-0.2 rounded text-white">
                            Đang dùng
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400">{item.desc}</div>
                    </div>
                  </div>
                  {isEquipped ? (
                    <Check className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <button className="px-3 py-1 bg-zinc-700 hover:bg-amber-600 rounded-lg text-xs font-semibold text-white">
                      Chọn
                    </button>
                  )}
                </div>
              );
            })}

          {activeTab === 'clothing' &&
            clothes.map((item) => {
              const isEquipped = userPlayer.clothing === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect('clothing', item.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isEquipped
                      ? 'bg-amber-950/60 border-amber-500'
                      : 'bg-zinc-800/60 border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        {item.name}
                        {isEquipped && (
                          <span className="text-[10px] bg-emerald-600 px-1.5 py-0.2 rounded text-white">
                            Đang mặc
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400">{item.desc}</div>
                    </div>
                  </div>
                  {isEquipped ? (
                    <Check className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <button className="px-3 py-1 bg-zinc-700 hover:bg-amber-600 rounded-lg text-xs font-semibold text-white">
                      Mặc
                    </button>
                  )}
                </div>
              );
            })}

          {activeTab === 'hat' &&
            hats.map((item) => {
              const isEquipped = userPlayer.hat === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect('hat', item.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isEquipped
                      ? 'bg-amber-950/60 border-amber-500'
                      : 'bg-zinc-800/60 border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        {item.name}
                        {isEquipped && (
                          <span className="text-[10px] bg-emerald-600 px-1.5 py-0.2 rounded text-white">
                            Đang đeo
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400">{item.desc}</div>
                    </div>
                  </div>
                  {isEquipped ? (
                    <Check className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <button className="px-3 py-1 bg-zinc-700 hover:bg-amber-600 rounded-lg text-xs font-semibold text-white">
                      Đeo
                    </button>
                  )}
                </div>
              );
            })}

          {activeTab === 'glass' &&
            glasses.map((item) => {
              const isEquipped = userPlayer.glassType === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect('glass', item.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isEquipped
                      ? 'bg-amber-950/60 border-amber-500'
                      : 'bg-zinc-800/60 border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        {item.name}
                        {isEquipped && (
                          <span className="text-[10px] bg-emerald-600 px-1.5 py-0.2 rounded text-white">
                            Đang cầm
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400">{item.desc}</div>
                    </div>
                  </div>
                  {isEquipped ? (
                    <Check className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <button className="px-3 py-1 bg-zinc-700 hover:bg-amber-600 rounded-lg text-xs font-semibold text-white">
                      Cầm
                    </button>
                  )}
                </div>
              );
            })}

          {activeTab === 'bike' && (
            <>
              {impoundLeft > 0 && (
                <div className="p-3 rounded-xl bg-red-950/90 border-2 border-red-500 text-red-200 text-xs font-black flex items-center gap-2">
                  <Lock className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{IMPOUNDED_BIKE_TAG_TEMPLATE(impoundLeft)}</span>
                </div>
              )}
              {(Object.keys(BIKE_SKINS) as BikeSkinId[]).map((skinId) => {
                const spec = BIKE_SKINS[skinId];
                const isEquipped = currentBikeSkin === skinId;
                return (
                  <div
                    key={skinId}
                    onClick={() => handleSelect('bike', skinId)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      impoundLeft > 0
                        ? 'bg-red-950/30 border-red-800/70 opacity-80'
                        : isEquipped
                        ? 'bg-amber-950/60 border-amber-500'
                        : 'bg-zinc-800/60 border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🛵</span>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                          <span>{spec.name}</span>
                          {impoundLeft > 0 ? (
                            <span className="text-[10px] bg-red-700 px-1.5 py-0.5 rounded text-white font-black">
                              {IMPOUNDED_BIKE_TAG_TEMPLATE(impoundLeft)}
                            </span>
                          ) : (
                            isEquipped && (
                              <span className="text-[10px] bg-emerald-600 px-1.5 py-0.5 rounded text-white">
                                Đang dựng ở sân nhà
                              </span>
                            )
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400">{spec.subtitle}</div>
                        <div className="text-[10px] text-amber-300 font-semibold mt-0.5">
                          Tốc độ tối đa: {spec.maxSpeedKmh} km/h • Đề máy: {spec.kickstartPressesRequired} phát [E]
                        </div>
                      </div>
                    </div>
                    {impoundLeft > 0 ? (
                      <Lock className="w-5 h-5 text-red-400 shrink-0" />
                    ) : isEquipped ? (
                      <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <button className="px-3 py-1 bg-zinc-700 hover:bg-amber-600 rounded-lg text-xs font-semibold text-white">
                        Trang bị
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
          <span>✨ Đã uống rượu bia thì đi Xe Ôm Công Nghệ (50 Nắp) kẻo mất 500 Nắp ở chốt!</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs cursor-pointer"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  );
};
