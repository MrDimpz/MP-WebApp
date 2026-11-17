import React from 'react';
import { UserEconomyProfile } from '../types';
import { Coins, Trophy, Sparkles, Building2, Check, ArrowUpRight } from 'lucide-react';

interface WordTycoonHubViewProps {
  profile: UserEconomyProfile;
  onUpgradeBusiness: (businessId: string) => void;
  onBuyOrEquipCosmetic: (cosmeticId: string) => void;
  onRenameUser: (newName: string) => void;
}

export const WordTycoonHubView: React.FC<WordTycoonHubViewProps> = ({
  profile,
  onUpgradeBusiness,
  onBuyOrEquipCosmetic,
  onRenameUser,
}) => {
  const [nameDraft, setNameDraft] = React.useState(profile.displayName);

  const totalPassiveIncome = profile.businesses.reduce(
    (acc, b) => acc + b.coinsPerMinute * b.level,
    0
  );
  const totalWordBonus = profile.businesses.reduce(
    (acc, b) => acc + b.wordBonusPct * b.level,
    0
  );

  return (
    <div className="w-full max-w-[490px] mx-auto px-4 py-5 space-y-6">
      {/* Profile & Economy Overview Card */}
      <section className="p-4 rounded-2xl bg-[#240630] border-2 border-[#7e22ce] shadow-[0_0_24px_rgba(250,204,21,0.12)] space-y-4">
        <div className="flex items-center gap-3.5">
          <div
            className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center text-xl font-extrabold text-[#2d0938]"
            style={{
              background: 'linear-gradient(135deg, #facc15, #a855f7)',
              border: `3px solid ${profile.equippedFrame}`,
            }}
          >
            {profile.displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-[#facc15] font-semibold">
              {profile.equippedTitle} · Level {profile.level}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  if (nameDraft.trim()) onRenameUser(nameDraft.trim());
                }}
                className="w-full bg-transparent border-b border-[#6b21a8] focus:border-[#facc15] text-lg font-extrabold text-white focus:outline-none px-1 py-0.5"
                aria-label="Player Display Name"
              />
            </div>
            <div className="text-[11px] text-[#d8b4fe] mt-1 font-mono tabular-nums truncate">
              {profile.roundsWon} Wins · {profile.totalWordsFound} Words · {profile.dailyStreak}d Streak
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-xl bg-[#16041c] border border-[#6b21a8]">
            <div className="text-[10px] text-[#d8b4fe] flex items-center gap-1">
              <Coins className="w-3 h-3 text-[#facc15]" /> Coins
            </div>
            <div className="mt-1 text-base font-extrabold text-[#facc15] font-mono tabular-nums">
              {Math.floor(profile.coins).toLocaleString()}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#16041c] border border-[#6b21a8]">
            <div className="text-[10px] text-[#d8b4fe] flex items-center gap-1">
              <Trophy className="w-3 h-3 text-[#c084fc]" /> ELO
            </div>
            <div className="mt-1 text-base font-extrabold text-white font-mono tabular-nums">
              {profile.elo}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#16041c] border border-[#6b21a8]">
            <div className="text-[10px] text-[#d8b4fe] flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-[#4ade80]" /> Bonus
            </div>
            <div className="mt-1 text-base font-extrabold text-[#4ade80] font-mono tabular-nums">
              +{totalWordBonus}%
            </div>
          </div>
        </div>
      </section>

      {/* Word Tycoon Businesses */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#facc15]" /> Publishing Ventures
          </h2>
          <p className="text-xs text-[#d8b4fe]">
            Passive income: +{totalPassiveIncome} coins/min
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {profile.businesses.map((b) => {
            const upgradeCost = Math.round(b.baseCost * Math.pow(1.45, b.level));
            const canAfford = profile.coins >= upgradeCost;
            return (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-[#240630] border border-[#6b21a8] flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#facc15] font-semibold">
                      {b.category} · Level {b.level}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-[#4ade80]">
                      +{b.coinsPerMinute * b.level}/min · +{b.wordBonusPct * b.level}% pts
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-0.5">{b.name}</h3>
                  <p className="text-xs text-[#d8b4fe] mt-0.5">{b.description}</p>
                </div>

                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => onUpgradeBusiness(b.id)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                    canAfford
                      ? 'bg-[#facc15] hover:bg-[#fde047] text-[#2d0938]'
                      : 'bg-[#16041c] text-[#d8b4fe] border border-[#6b21a8]/40 cursor-not-allowed'
                  }`}
                >
                  <span>Upgrade to Level {b.level + 1}</span>
                  <span className="font-mono tabular-nums">{upgradeCost.toLocaleString()} Coins</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Cosmetics & Rack Locker */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#facc15]" /> Cosmetics &amp; Podium Titles
          </h2>
          <p className="text-xs text-[#d8b4fe]">
            Customize your appearance on the Podium and Rank Cards.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {profile.cosmetics.map((c) => {
            const canAfford = profile.coins >= c.price;
            return (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl bg-[#240630] border border-[#6b21a8] flex flex-col justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl shrink-0 border-2"
                    style={{
                      backgroundColor: '#16041c',
                      borderColor: c.previewHex,
                      boxShadow: `0 0 10px ${c.previewHex}44`,
                    }}
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] text-[#d8b4fe] capitalize">{c.slot.replace('_', ' ')}</div>
                    <div className="text-xs font-bold text-white truncate">{c.name}</div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!c.unlocked && !canAfford}
                  onClick={() => onBuyOrEquipCosmetic(c.id)}
                  className={`w-full py-1.5 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                    c.equipped
                      ? 'bg-[#4ade80]/20 border border-[#4ade80] text-[#4ade80]'
                      : c.unlocked
                      ? 'bg-[#360b42] hover:bg-[#6b21a8] text-white'
                      : canAfford
                      ? 'bg-[#facc15] hover:bg-[#fde047] text-[#2d0938]'
                      : 'bg-[#16041c] text-[#d8b4fe] cursor-not-allowed'
                  }`}
                >
                  {c.equipped ? (
                    <>
                      <Check className="w-3 h-3" /> Equipped
                    </>
                  ) : c.unlocked ? (
                    'Equip'
                  ) : (
                    `${c.price.toLocaleString()} Coins`
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
