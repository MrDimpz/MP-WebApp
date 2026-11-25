import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { DifficultyLevel, PuzzleProgress } from '../types';
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  generateDailyPuzzle,
  getProgressKey,
  TIER_ORDER,
  TIERS,
} from '../data/dailyGenerator';
import { formatTime } from '../utils/storage';

interface ArchiveViewProps {
  dateKeys: string[];
  todayDateKey: string;
  currentDateKey: string;
  difficulty: DifficultyLevel;
  progressMap: Record<string, PuzzleProgress>;
  onSelectDifficulty: (level: DifficultyLevel) => void;
  onSelectDaily: (dateKey: string, difficulty: DifficultyLevel) => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  dateKeys,
  todayDateKey,
  currentDateKey,
  difficulty,
  progressMap,
  onSelectDifficulty,
  onSelectDaily,
}) => {
  const diffConfig = DIFFICULTIES[difficulty];

  const solvedCount = dateKeys.filter(
    (dk) => progressMap[getProgressKey(dk, difficulty)]?.status === 'won'
  ).length;

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="pb-5 mb-5 border-b border-[#DAC6F0] dark:border-[#D4A437]/25 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[#2B0938] dark:text-[#FAF7FF]">
            Daily Archive
          </h1>
          <p className="mt-1 text-sm text-[#5C3A78] dark:text-[#D6CBE2]">
            A fresh Going Deep puzzle unlocks every calendar day across all three difficulty levels.
          </p>
        </div>
        <div className="text-xs font-mono font-bold tabular-nums text-[#8F6500] dark:text-[#F6C915]">
          {solvedCount} / {dateKeys.length} solved ({diffConfig.label})
        </div>
      </div>

      {/* Difficulty Filter */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Archive difficulty filter"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EDE0FA] dark:bg-[#230738] border border-[#D7C2EF] dark:border-[#D4A437]/25"
        >
          {DIFFICULTY_ORDER.map((level) => {
            const cfg = DIFFICULTIES[level];
            const active = level === difficulty;
            return (
              <button
                key={level}
                type="button"
                onClick={() => onSelectDifficulty(level)}
                aria-pressed={active}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#2B0938] text-[#F6C915] dark:bg-[#F6C915] dark:text-[#1D0830] shadow-xs'
                    : 'text-[#5C3A78] dark:text-[#D6CBE2] hover:text-[#2B0938] dark:hover:text-white'
                }`}
              >
                {cfg.label} · {cfg.keyCount} Keys
              </button>
            );
          })}
        </div>
        <span className="text-xs font-mono text-[#5C3A78] dark:text-[#C5B3DA]">
          {diffConfig.summary}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {dateKeys.map((dateKey) => {
          const puzzle = generateDailyPuzzle(dateKey, difficulty);
          const pKey = getProgressKey(dateKey, difficulty);
          const prog = progressMap[pKey];
          const status = prog?.status ?? 'unstarted';
          const totalKeys = puzzle.miniGames.length;
          const keysDone = prog
            ? puzzle.miniGames.filter(
                (mg) => prog.miniGames[mg.keyId]?.status !== 'locked'
              ).length
            : 0;
          const solvedTiers = prog?.solvedTiers ?? [];
          const isCurrent = dateKey === currentDateKey;
          const isToday = dateKey === todayDateKey;

          return (
            <button
              key={pKey}
              type="button"
              onClick={() => onSelectDaily(dateKey, difficulty)}
              className={`text-left p-5 rounded-2xl border transition-all duration-150 cursor-pointer flex flex-col justify-between gap-4 ${
                isCurrent
                  ? 'bg-white dark:bg-[#290A44] border-2 border-[#2B0938] dark:border-[#F6C915] shadow-sm'
                  : 'bg-white dark:bg-[#210736] border-[#DAC6F0] dark:border-[#D4A437]/25 hover:border-[#6E4B8A] dark:hover:border-[#F6C915]/70'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-xs font-bold tabular-nums text-[#5C3A78] dark:text-[#D6CBE2]">
                    #{puzzle.id} · {isToday ? 'Today' : puzzle.dateDisplay}
                  </span>
                  <span
                    className={`text-xs font-bold inline-flex items-center gap-1 ${
                      status === 'won'
                        ? 'text-[#1E633E] dark:text-emerald-300'
                        : status === 'lost'
                        ? 'text-rose-700 dark:text-rose-300'
                        : prog && (keysDone > 0 || solvedTiers.length > 0)
                        ? 'text-[#8F6500] dark:text-[#F6C915]'
                        : 'text-[#6E4B8A] dark:text-[#B9A4D1]'
                    }`}
                  >
                    {status === 'won' && <Check className="w-3.5 h-3.5" />}
                    {status === 'won'
                      ? 'Solved'
                      : status === 'lost'
                      ? 'Completed'
                      : prog && (keysDone > 0 || solvedTiers.length > 0)
                      ? 'In progress'
                      : 'Unplayed'}
                  </span>
                </div>

                <h2 className="font-display text-lg font-bold text-[#2B0938] dark:text-[#FAF7FF]">
                  {puzzle.subtitle}
                </h2>

                <div className="mt-2 flex items-center gap-2 text-xs text-[#5C3A78] dark:text-[#C5B3DA] font-mono tabular-nums">
                  <span>
                    Keys {keysDone}/{totalKeys}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Layers {solvedTiers.length}/4</span>
                  {prog && prog.elapsedSeconds > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{formatTime(prog.elapsedSeconds)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#EFE5FA] dark:border-[#D4A437]/20">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  {TIER_ORDER.map((tierId) => {
                    const isSolved = solvedTiers.includes(tierId);
                    return (
                      <span
                        key={tierId}
                        className={`w-6 h-2 rounded-xs transition-opacity ${
                          isSolved
                            ? TIERS[tierId].bgClass
                            : 'bg-[#E6D6F7] dark:bg-[#341152]'
                        }`}
                      />
                    );
                  })}
                </div>

                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2B0938] dark:text-[#F6C915]">
                  {status === 'won' || status === 'lost'
                    ? 'Review'
                    : isCurrent
                    ? 'Resume'
                    : 'Play'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
