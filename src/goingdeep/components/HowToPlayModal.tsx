import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  MINI_GAME_META,
  MINI_GAME_ORDER,
  TIER_ORDER,
  TIERS,
} from '../data/dailyGenerator';

interface HowToPlayModalProps {
  open: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  open,
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0216]/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl bg-[#F7F2FC] dark:bg-[#1E0633] border-2 border-[#D4A437]/60 p-6 sm:p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 mb-5 border-b border-[#DAC6F0] dark:border-[#D4A437]/25">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest font-bold text-[#8F6500] dark:text-[#F6C915]">
              The Missing Piece · Solo Game
            </p>
            <h2
              id="how-to-play-title"
              className="font-display text-2xl font-bold text-[#2B0938] dark:text-[#FAF7FF]"
            >
              How to Play Going Deep
            </h2>
            <p className="text-xs text-[#5C3A78] dark:text-[#C5B3DA] mt-0.5">
              A new daily puzzle generates every day across three difficulty levels.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close instructions"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5C3A78] dark:text-[#D6CBE2] hover:bg-[#EAE0F8] dark:hover:bg-[#310C4F] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-6 text-sm text-[#3F1B5C] dark:text-[#E2D4F0]">
          {/* Step 1 */}
          <div>
            <h3 className="font-bold text-[#2B0938] dark:text-[#F6C915] mb-2">
              1. Solve the Layer Keys
            </h3>
            <p className="leading-relaxed mb-3">
              Locked tiles on the 16-word board hide words behind four mini-game types. Tap any locked tile or key card to solve them in any order:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm">
              {MINI_GAME_ORDER.map((id) => {
                const m = MINI_GAME_META[id];
                return (
                  <li key={id} className="flex items-baseline gap-2">
                    <span className="font-bold text-[#2B0938] dark:text-[#FAF7FF] whitespace-nowrap">
                      {m.label}:
                    </span>
                    <span className="text-[#5C3A78] dark:text-[#C5B3DA]">
                      {m.description}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Step 2: Difficulty Scaling */}
          <div className="pt-4 border-t border-[#DAC6F0] dark:border-[#D4A437]/25">
            <h3 className="font-bold text-[#2B0938] dark:text-[#F6C915] mb-2.5">
              2. Choose Your Difficulty
            </h3>
            <div className="space-y-2">
              {DIFFICULTY_ORDER.map((level) => {
                const cfg = DIFFICULTIES[level];
                return (
                  <div
                    key={level}
                    className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#290A44] border border-[#DAC6F0] dark:border-[#D4A437]/30 flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="font-bold text-[#2B0938] dark:text-[#FAF7FF]">
                      {cfg.label} ({cfg.keyCount} Keys)
                    </span>
                    <span className="font-mono text-[#5C3A78] dark:text-[#C5B3DA]">
                      {cfg.summary}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-[#5C3A78] dark:text-[#C5B3DA]">
              Higher difficulties introduce trickier clues, reverse-diagonal word searches, strict clue reuse in LetterLock, and bigger leaderboard point bonuses.
            </p>
          </div>

          {/* Step 3: Difficulty Tiers */}
          <div className="pt-4 border-t border-[#DAC6F0] dark:border-[#D4A437]/25">
            <h3 className="font-bold text-[#2B0938] dark:text-[#F6C915] mb-3">
              3. Sort the 16-Word Board
            </h3>
            <div className="space-y-2">
              {TIER_ORDER.map((tierId) => {
                const t = TIERS[tierId];
                return (
                  <div
                    key={tierId}
                    className={`px-3.5 py-2 rounded-lg border flex items-center justify-between text-xs font-bold ${t.bgClass} ${t.borderClass} ${t.textClass}`}
                  >
                    <span>
                      {t.rank}. {t.name}
                    </span>
                    <span className="opacity-90">{t.difficulty}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[#DAC6F0] dark:border-[#D4A437]/25 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#2B0938] hover:bg-[#3F1054] dark:bg-[#F6C915] dark:hover:bg-[#FFE047] text-[#F6C915] dark:text-[#1D0830] text-sm font-extrabold transition-colors cursor-pointer"
          >
            Start Playing
          </button>
        </div>
      </div>
    </div>
  );
};
