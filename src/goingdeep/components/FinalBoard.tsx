import React from 'react';
import {
  Check,
  Clock,
  Grid3X3,
  KeyRound,
  Lock,
  RotateCcw,
  Search,
  Shuffle,
  TextCursorInput,
  X,
} from 'lucide-react';
import {
  DifficultyLevel,
  MiniGameType,
  PuzzleData,
  PuzzleProgress,
  TierId,
} from '../types';
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  getMiniGameForWord,
  MINI_GAME_META,
  MINI_GAME_ORDER,
  TIERS,
} from '../data/dailyGenerator';
import { formatTime } from '../utils/storage';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import type { DailyStreakState } from '@/lib/daily-streak';

interface FinalBoardProps {
  puzzle: PuzzleData;
  progress: PuzzleProgress;
  difficulty: DifficultyLevel;
  countdownLabel: string;
  isNewDayAvailable: boolean;
  dailyStreak: DailyStreakState;
  selectedWords: string[];
  shakingWords: string[];
  recentlyUnlockedKeyId: string | null;
  toastMessage: string | null;
  onSelectDifficulty: (level: DifficultyLevel) => void;
  onLoadNewDaily: () => void;
  onOpenMiniGameKey: (keyId: string) => void;
  onOpenMiniGameType: (type: MiniGameType) => void;
  onToggleWord: (word: string) => void;
  onShuffle: () => void;
  onDeselectAll: () => void;
  onSubmit: () => void;
  onOpenResults: () => void;
  onResetPuzzle: () => void;
}

const MINI_GAME_ICONS: Record<MiniGameType, React.FC<{ className?: string }>> = {
  letterlock: KeyRound,
  anagram: TextCursorInput,
  crossword: Grid3X3,
  wordsearch: Search,
};

function TierRankBars({ rank }: { rank: 1 | 2 | 3 | 4 }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`Difficulty level ${rank} of 4`}
    >
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`w-1.5 h-1.5 rounded-[1px] ${
            n <= rank ? 'bg-current opacity-95' : 'bg-current opacity-25'
          }`}
        />
      ))}
    </span>
  );
}

export const FinalBoard: React.FC<FinalBoardProps> = ({
  puzzle,
  progress,
  difficulty,
  countdownLabel,
  isNewDayAvailable,
  dailyStreak,
  selectedWords,
  shakingWords,
  recentlyUnlockedKeyId,
  toastMessage,
  onSelectDifficulty,
  onLoadNewDaily,
  onOpenMiniGameKey,
  onOpenMiniGameType,
  onToggleWord,
  onShuffle,
  onDeselectAll,
  onSubmit,
  onOpenResults,
  onResetPuzzle,
}) => {
  const diffConfig = DIFFICULTIES[difficulty];

  const solvedWordSet = new Set(
    puzzle.categories
      .filter((c) => progress.solvedTiers.includes(c.tier))
      .flatMap((c) => c.words)
  );

  const remainingTiles = progress.tileOrder.filter(
    (word) => !solvedWordSet.has(word)
  );

  const totalKeys = puzzle.miniGames.length;
  const unlockedCount = puzzle.miniGames.filter(
    (mg) => progress.miniGames[mg.keyId]?.status !== 'locked'
  ).length;

  const isFinished = progress.status !== 'in_progress';

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Midnight New Daily Rollover Notice */}
      {isNewDayAvailable && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-[#FFF6D1] dark:bg-[#3A2706] border border-[#D4A437] flex flex-wrap items-center justify-between gap-3 animate-band-enter">
          <span className="text-xs sm:text-sm font-semibold text-[#2B0938] dark:text-[#FCE8A8]">
            A brand-new daily Going Deep puzzle is ready for today.
          </span>
          <button
            type="button"
            onClick={onLoadNewDaily}
            className="px-3.5 py-1.5 rounded-lg bg-[#2B0938] dark:bg-[#F6C915] text-[#F6C915] dark:text-[#1D0830] text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer"
          >
            Load Today’s Puzzle
          </button>
        </div>
      )}

      {/* Puzzle Info & Utility Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 mb-4 border-b border-[#DAC6F0] dark:border-[#D4A437]/25">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#2B0938] dark:text-[#FAF7FF] text-balance">
            {puzzle.dateLabel}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5C3A78] dark:text-[#D6CBE2]">
            <span className="font-semibold text-[#8F6500] dark:text-[#F6C915]">
              {puzzle.subtitle}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Keys {unlockedCount}/{totalKeys}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {formatTime(progress.elapsedSeconds)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
              <Clock className="w-3 h-3 text-[#8F6500] dark:text-[#F6C915]" />
              Next {countdownLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="md:hidden">
            <DailyStreakBadge
              streak={dailyStreak.streak}
              solvedToday={dailyStreak.solvedToday}
              variant="light"
              compact
            />
          </div>
          {isFinished && (
            <button
              type="button"
              onClick={onResetPuzzle}
              aria-label="Replay this puzzle"
              title="Replay puzzle"
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[#D5C0EE] dark:border-[#D4A437]/35 bg-white dark:bg-[#230738] text-[#2B0938] dark:text-[#F6C915] hover:bg-[#F3E9FC] dark:hover:bg-[#300B4D] text-xs font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Replay
            </button>
          )}
        </div>
      </div>

      {/* Difficulty Level Selector */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div
          role="group"
          aria-label="Difficulty level"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#EDE0FA] dark:bg-[#230738] border border-[#D7C2EF] dark:border-[#D4A437]/25 self-start"
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
                {cfg.label} · {cfg.keyCount}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[#5C3A78] dark:text-[#C5B3DA] font-mono tabular-nums">
          {diffConfig.summary}
        </p>
      </div>

      {/* Step 1: Four Mini-Game Layer Key Buckets */}
      <section aria-label="Layer key mini-games" className="mb-6">
        <div className="flex items-center justify-between mb-2.5 gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#5C3A78] dark:text-[#F6C915]">
            Layer Keys — Unlock {totalKeys} Hidden Words
          </h2>
          <span className="text-xs text-[#6E4B8A] dark:text-[#C5B3DA]">
            {unlockedCount === totalKeys
              ? 'All keys unlocked'
              : `${totalKeys - unlockedCount} remaining`}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MINI_GAME_ORDER.map((typeId) => {
            const meta = MINI_GAME_META[typeId];
            const Icon = MINI_GAME_ICONS[typeId];
            const instances = puzzle.miniGames.filter((mg) => mg.type === typeId);
            const unlockedInstances = instances.filter(
              (mg) => progress.miniGames[mg.keyId]?.status !== 'locked'
            );
            const allDone = unlockedInstances.length === instances.length;

            const sublabel =
              instances.length === 1
                ? allDone
                  ? instances[0].word
                  : 'Play to unlock'
                : `${unlockedInstances.length}/${instances.length} unlocked`;

            return (
              <button
                key={typeId}
                type="button"
                onClick={() => onOpenMiniGameType(typeId)}
                className={`group text-left px-3 py-2.5 rounded-xl border transition-all duration-150 cursor-pointer flex items-center gap-2.5 ${
                  allDone
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/45 hover:border-emerald-500'
                    : 'bg-white dark:bg-[#210736] border-[#D7C2EF] dark:border-[#D4A437]/30 hover:border-[#2B0938] dark:hover:border-[#F6C915]'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    allDone
                      ? 'bg-[#2E7D52] text-white'
                      : 'bg-[#EFE5FA] dark:bg-[#310C4F] text-[#4A1C6E] dark:text-[#F6C915] group-hover:bg-[#2B0938] group-hover:text-[#F6C915] dark:group-hover:bg-[#F6C915] dark:group-hover:text-[#1D0830]'
                  }`}
                >
                  {allDone ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#2B0938] dark:text-[#FAF7FF] truncate">
                    {meta.shortLabel}
                  </div>
                  <div
                    className={`text-[11px] truncate font-mono ${
                      allDone
                        ? 'font-bold text-[#1E633E] dark:text-emerald-300'
                        : unlockedInstances.length > 0
                        ? 'font-semibold text-[#8F6500] dark:text-[#F6C915]'
                        : 'text-[#6E4B8A] dark:text-[#B9A4D1]'
                    }`}
                  >
                    {sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Toast Feedback Area */}
      <div
        aria-live="polite"
        className="h-8 mb-2.5 flex items-center justify-center"
      >
        {toastMessage ? (
          <div className="px-4 py-1 rounded-lg bg-[#2B0938] dark:bg-[#F6C915] text-[#F6C915] dark:text-[#1D0830] text-xs font-bold shadow-sm animate-band-enter">
            {toastMessage}
          </div>
        ) : (
          <p className="text-xs text-[#5C3A78] dark:text-[#C5B3DA] text-center">
            {isFinished
              ? progress.status === 'won'
                ? 'All four connection layers solved.'
                : 'Out of guesses — all four layers revealed.'
              : 'Tap any locked tile to unlock its word, then group all 16 into four sets.'}
          </p>
        )}
      </div>

      {/* Step 2: 16-Word Final Connections Board */}
      <section aria-label="16-word connections board" className="space-y-2.5">
        {/* Solved Category Bands */}
        {progress.solvedTiers.map((tierId: TierId) => {
          const cat = puzzle.categories.find((c) => c.tier === tierId);
          if (!cat) return null;
          const meta = TIERS[tierId];

          return (
            <div
              key={tierId}
              className={`w-full rounded-xl border-2 px-4 py-3.5 text-center shadow-sm animate-band-enter ${meta.bgClass} ${meta.borderClass} ${meta.textClass}`}
            >
              <div className="flex items-center justify-center gap-2 text-[11px] font-bold tracking-wide opacity-85 mb-0.5">
                <TierRankBars rank={meta.rank} />
                <span>{meta.name}</span>
                <span aria-hidden="true">·</span>
                <span>{meta.difficulty}</span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold tracking-tight">
                {cat.title}
              </h3>
              <p className="mt-1 font-mono text-xs sm:text-sm font-semibold tracking-wide opacity-95">
                {cat.words.join('  ·  ')}
              </p>
            </div>
          );
        })}

        {/* Remaining 4-Column Word Grid */}
        {remainingTiles.length > 0 && (
          <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
            {remainingTiles.map((word) => {
              const mgInstance = getMiniGameForWord(puzzle, word);
              const mgProg = mgInstance
                ? progress.miniGames[mgInstance.keyId]
                : null;
              const isLocked = mgInstance !== null && mgProg?.status === 'locked';
              const isSelected = selectedWords.includes(word);
              const isShaking = shakingWords.includes(word);
              const isFreshUnlock =
                mgInstance !== null &&
                mgInstance.keyId === recentlyUnlockedKeyId;

              if (isLocked && mgInstance) {
                const Icon = MINI_GAME_ICONS[mgInstance.type];
                const meta = MINI_GAME_META[mgInstance.type];
                const showNumber = diffConfig.keysPerType > 1;
                return (
                  <button
                    key={word}
                    type="button"
                    onClick={() => onOpenMiniGameKey(mgInstance.keyId)}
                    className="min-h-20 sm:min-h-22 py-2 px-1.5 rounded-xl border-2 border-dashed border-[#6E3E9E] dark:border-[#F6C915]/75 bg-[#E6D4FA] dark:bg-[#2E0F50] hover:bg-[#DAC0F7] dark:hover:bg-[#3F166C] hover:border-[#2B0938] dark:hover:border-[#F6C915] shadow-xs transition-all duration-150 flex flex-col items-center justify-center gap-1 cursor-pointer group"
                  >
                    <div className="flex items-center gap-1 text-[#4A1C6E] dark:text-[#F6C915] group-hover:text-[#2B0938] dark:group-hover:text-[#FFE047]">
                      <Lock className="w-3.5 h-3.5" />
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[14px] sm:text-[15px] font-extrabold text-[#1F062C] dark:text-white leading-tight text-center">
                      {meta.shortLabel}
                      {showNumber ? ` #${mgInstance.indexInType + 1}` : ''}
                    </span>
                  </button>
                );
              }

              const longWord = word.length >= 9;

              return (
                <button
                  key={word}
                  type="button"
                  disabled={isFinished}
                  onClick={() => onToggleWord(word)}
                  aria-pressed={isSelected}
                  className={`relative min-h-20 sm:min-h-22 py-2 px-1.5 sm:px-2 rounded-xl border-2 font-extrabold tracking-tight flex items-center justify-center text-center select-none transition-all duration-150 cursor-pointer ${
                    longWord
                      ? 'text-[14px] sm:text-[16px]'
                      : 'text-[16px] sm:text-[18px]'
                  } ${
                    isSelected
                      ? 'bg-[#2B0938] dark:bg-[#F6C915] text-[#FFE047] dark:text-[#140321] border-[#F6C915] dark:border-white -translate-y-0.5 shadow-md'
                      : 'bg-white dark:bg-[#3A1563] text-[#1A0424] dark:text-white border-[#7E4EA8] dark:border-[#F6C915]/75 border-b-4 shadow-sm hover:bg-[#FAF4FF] dark:hover:bg-[#4D1D82] dark:hover:border-[#F6C915]'
                  } ${isShaking ? 'animate-tile-shake' : ''} ${
                    isFreshUnlock ? 'animate-tile-pop ring-2 ring-emerald-400' : ''
                  }`}
                >
                  <span className="break-words leading-tight">{word}</span>
                  {mgInstance && !isSelected && (
                    <span
                      title={`Unlocked via ${MINI_GAME_META[mgInstance.type].label}`}
                      className="absolute top-1.5 right-1.5 text-[#1F7A4C] dark:text-emerald-300"
                      aria-hidden="true"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer Controls: Mistakes + Shuffle / Deselect / Submit */}
      <div className="mt-6 pt-5 border-t border-[#DAC6F0] dark:border-[#D4A437]/25 flex flex-col items-center gap-4">
        {!isFinished ? (
          <>
            <div className="flex items-center gap-3 text-sm text-[#4A1C6E] dark:text-[#D6CBE2]">
              <span className="font-medium">Mistakes remaining</span>
              <div
                className="flex items-center gap-1.5"
                aria-label={`${progress.mistakesRemaining} of ${progress.maxMistakes} mistakes remaining`}
              >
                {Array.from({ length: progress.maxMistakes }).map((_, idx) => {
                  const active = idx < progress.mistakesRemaining;
                  return (
                    <span
                      key={idx}
                      className={`w-3 h-3 rounded-sm transition-all duration-200 ${
                        active
                          ? 'bg-[#2B0938] dark:bg-[#F6C915] scale-100'
                          : 'bg-[#DAC6F0] dark:bg-[#3A1659] scale-75'
                      }`}
                    />
                  );
                })}
              </div>
              <span className="font-mono text-xs font-bold tabular-nums text-[#2B0938] dark:text-[#F6C915]">
                {progress.mistakesRemaining}/{progress.maxMistakes}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={onShuffle}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D5C0EE] dark:border-[#D4A437]/35 bg-white dark:bg-[#230738] text-sm font-semibold text-[#2B0938] dark:text-[#FAF7FF] hover:bg-[#F3E9FC] dark:hover:bg-[#310C4F] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Shuffle className="w-4 h-4" />
                Shuffle
              </button>
              <button
                type="button"
                disabled={selectedWords.length === 0}
                onClick={onDeselectAll}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D5C0EE] dark:border-[#D4A437]/35 bg-white dark:bg-[#230738] text-sm font-semibold text-[#2B0938] dark:text-[#FAF7FF] hover:bg-[#F3E9FC] dark:hover:bg-[#310C4F] disabled:opacity-35 transition-colors whitespace-nowrap cursor-pointer"
              >
                <X className="w-4 h-4" />
                Deselect All
              </button>
              <button
                type="button"
                disabled={selectedWords.length !== 4}
                onClick={onSubmit}
                className="px-6 py-2.5 rounded-xl bg-[#2B0938] hover:bg-[#3F1054] dark:bg-[#F6C915] dark:hover:bg-[#FFE047] text-[#F6C915] dark:text-[#1D0830] text-sm font-extrabold disabled:opacity-35 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
              >
                Submit
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenResults}
              className="px-6 py-2.5 rounded-xl bg-[#2B0938] hover:bg-[#3F1054] dark:bg-[#F6C915] dark:hover:bg-[#FFE047] text-[#F6C915] dark:text-[#1D0830] text-sm font-extrabold transition-colors whitespace-nowrap cursor-pointer shadow-sm"
            >
              View Results &amp; Share
            </button>
            <button
              type="button"
              onClick={onResetPuzzle}
              className="px-4 py-2.5 rounded-xl border border-[#D5C0EE] dark:border-[#D4A437]/35 bg-white dark:bg-[#230738] text-sm font-semibold text-[#2B0938] dark:text-[#FAF7FF] hover:bg-[#F3E9FC] dark:hover:bg-[#310C4F] transition-colors whitespace-nowrap cursor-pointer"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
