import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { GameStats } from '../types';
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  MINI_GAME_META,
  MINI_GAME_ORDER,
} from '../data/dailyGenerator';

interface StatsModalProps {
  open: boolean;
  stats: GameStats;
  isSignedIn: boolean;
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  open,
  stats,
  isSignedIn,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const winRate =
    stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
  const maxDist = Math.max(1, ...stats.mistakeDistribution);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stats-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0216]/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl bg-[#F7F2FC] dark:bg-[#1E0633] border-2 border-[#D4A437]/60 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 mb-5 border-b border-[#DAC6F0] dark:border-[#D4A437]/25">
          <div>
            <h2
              id="stats-modal-title"
              className="font-display text-2xl font-bold text-[#2B0938] dark:text-[#FAF7FF]"
            >
              Going Deep Stats
            </h2>
            <p className="text-xs text-[#5C3A78] dark:text-[#C5B3DA] mt-0.5">
              {isSignedIn
                ? 'Synced to your Missing Piece account'
                : 'Saved locally — sign in to sync across devices'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close statistics"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5C3A78] dark:text-[#D6CBE2] hover:bg-[#EAE0F8] dark:hover:bg-[#310C4F] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Key Metrics */}
        <div className="grid grid-cols-4 gap-2.5 text-center mb-6">
          <div className="p-3 rounded-xl bg-white dark:bg-[#290A44] border border-[#DAC6F0] dark:border-[#D4A437]/30">
            <div className="font-mono text-2xl font-bold tabular-nums text-[#2B0938] dark:text-[#FAF7FF]">
              {stats.played}
            </div>
            <div className="text-[11px] text-[#5C3A78] dark:text-[#C5B3DA] mt-0.5">
              Played
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-[#290A44] border border-[#DAC6F0] dark:border-[#D4A437]/30">
            <div className="font-mono text-2xl font-bold tabular-nums text-[#2B0938] dark:text-[#FAF7FF]">
              {winRate}%
            </div>
            <div className="text-[11px] text-[#5C3A78] dark:text-[#C5B3DA] mt-0.5">
              Win Rate
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-[#290A44] border border-[#DAC6F0] dark:border-[#D4A437]/30">
            <div className="font-mono text-2xl font-bold tabular-nums text-[#8F6500] dark:text-[#F6C915]">
              {stats.currentStreak}
            </div>
            <div className="text-[11px] text-[#5C3A78] dark:text-[#C5B3DA] mt-0.5">
              Streak
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-[#290A44] border border-[#DAC6F0] dark:border-[#D4A437]/30">
            <div className="font-mono text-2xl font-bold tabular-nums text-[#2B0938] dark:text-[#FAF7FF]">
              {stats.perfectGames}
            </div>
            <div className="text-[11px] text-[#5C3A78] dark:text-[#C5B3DA] mt-0.5">
              Perfect
            </div>
          </div>
        </div>

        {/* Wins by Difficulty */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5C3A78] dark:text-[#F6C915] mb-2.5">
            Boards Solved by Difficulty
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTY_ORDER.map((level) => {
              const cfg = DIFFICULTIES[level];
              return (
                <div
                  key={level}
                  className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#290A44] border border-[#DAC6F0] dark:border-[#D4A437]/30 text-center"
                >
                  <div className="font-mono text-lg font-bold tabular-nums text-[#2B0938] dark:text-[#FAF7FF]">
                    {stats.winsByDifficulty[level]}
                  </div>
                  <div className="text-[11px] text-[#5C3A78] dark:text-[#C5B3DA]">
                    {cfg.label} ({cfg.keyCount})
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mistake Distribution */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5C3A78] dark:text-[#F6C915] mb-2.5">
            Mistakes on Solved Boards
          </h3>
          <div className="space-y-2">
            {stats.mistakeDistribution.slice(0, 4).map((count, idx) => {
              const pct = Math.max(8, Math.round((count / maxDist) * 100));
              return (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <span className="w-20 font-mono text-[#5C3A78] dark:text-[#D6CBE2] tabular-nums shrink-0">
                    {idx} {idx === 1 ? 'mistake' : 'mistakes'}
                  </span>
                  <div className="flex-1 h-6 bg-[#E8DAF7] dark:bg-[#2D0C4A] rounded-md overflow-hidden">
                    <div
                      className="h-full bg-[#2B0938] dark:bg-[#F6C915] flex items-center justify-end px-2 font-mono text-[11px] font-bold text-[#F6C915] dark:text-[#1D0830] tabular-nums transition-all duration-300"
                      style={{ width: count > 0 ? `${pct}%` : '28px' }}
                    >
                      {count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mini-game Solves */}
        <div className="pt-4 border-t border-[#DAC6F0] dark:border-[#D4A437]/25">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5C3A78] dark:text-[#F6C915] mb-2.5">
            Layer Keys Solved Cleanly
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {MINI_GAME_ORDER.map((id) => (
              <div
                key={id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-[#290A44] border border-[#DAC6F0] dark:border-[#D4A437]/30 text-xs"
              >
                <span className="text-[#4A1C6E] dark:text-[#D6CBE2] font-medium">
                  {MINI_GAME_META[id].label}
                </span>
                <span className="font-mono font-bold tabular-nums text-[#2B0938] dark:text-[#F6C915]">
                  {stats.miniGamesSolved[id]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
