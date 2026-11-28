import React from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Pin,
  PinOff,
  RotateCcw,
  Sparkles,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ARCHIVE_DAYS_COUNT,
  formatDisplayDate,
  isDateInArchive,
  shiftDateStr,
} from '../game/generator';
import {
  BoardValidation,
  computeCrossjigScore,
  GameMode,
  MODE_CONFIGS,
  PlayerStats,
} from '../game/types';

interface PuzzleLedgerProps {
  mode: GameMode;
  dailyDate?: string;
  todayDateKey: string;
  elapsedSeconds: number;
  movesCount: number;
  hintsUsed: number;
  canUndo: boolean;
  selectedSlot: number | null;
  isSelectedPinned: boolean;
  isSelectedLocked: boolean;
  validation: BoardValidation;
  isSolved: boolean;
  lastScore: number | null;
  checkSummary: string | null;
  autoLockCorrect: boolean;
  soundEnabled: boolean;
  darkMode: boolean;
  dictionaryWordCount: number;
  stats: PlayerStats;
  onUndo: () => void;
  onCheck: () => void;
  onHint: () => void;
  onTogglePinSelected: () => void;
  onResetCurrent: () => void;
  onPlayAgain: () => void;
  onToggleAutoLock: () => void;
  onToggleSound: () => void;
  onOpenLeaderboard: () => void;
  onOpenArchive: () => void;
  onSelectArchiveDate: (dateStr: string) => void;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const PuzzleLedger: React.FC<PuzzleLedgerProps> = ({
  mode,
  dailyDate,
  todayDateKey,
  elapsedSeconds,
  movesCount,
  hintsUsed,
  canUndo,
  selectedSlot,
  isSelectedPinned,
  isSelectedLocked,
  validation,
  isSolved,
  lastScore,
  checkSummary,
  autoLockCorrect,
  soundEnabled,
  darkMode,
  dictionaryWordCount,
  stats,
  onUndo,
  onCheck,
  onHint,
  onTogglePinSelected,
  onResetCurrent,
  onPlayAgain,
  onToggleAutoLock,
  onToggleSound,
  onOpenLeaderboard,
  onOpenArchive,
  onSelectArchiveDate,
}) => {
  const modeConfig = MODE_CONFIGS[mode];
  const linkedWords = isSolved
    ? validation.allWords.filter((w) => w.isValid)
    : validation.validCrossSeamWords;

  const displayedWords = Array.from(
    new Map(linkedWords.map((w) => [`${w.word}-${w.direction}-${w.row}-${w.col}`, w])).values()
  ).sort((a, b) => b.length - a.length || a.word.localeCompare(b.word));

  const bestForMode = stats.bestTimes[mode];
  const solvedScore =
    lastScore ?? computeCrossjigScore(mode, elapsedSeconds, movesCount, hintsUsed);

  const activeDailyDate = dailyDate || todayDateKey;
  const isTodayPuzzle = activeDailyDate === todayDateKey;
  const prevDateStr = shiftDateStr(activeDailyDate, -1);
  const nextDateStr = shiftDateStr(activeDailyDate, 1);
  const canStepPrev = isDateInArchive(prevDateStr, todayDateKey);
  const canStepNext = isDateInArchive(nextDateStr, todayDateKey);

  return (
    <aside
      className={`flex w-full flex-col gap-5 rounded-2xl border-2 p-5 sm:p-6 transition-colors ${
        darkMode
          ? 'border-[#D4A437]/40 bg-[#1E0530]/95 text-[#FAF7FF] shadow-[0_14px_34px_rgba(11,2,20,0.45)]'
          : 'border-[#D4A437]/55 bg-[#FFFFFF] text-[#1D0830] shadow-sm'
      }`}
    >
      {/* Puzzle Heading & Quiet Metadata */}
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h1
            className={`font-display text-2xl font-extrabold tracking-tight ${
              darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
            }`}
          >
            {mode === 'daily'
              ? isTodayPuzzle
                ? 'Daily Crossword'
                : 'Archive Crossword'
              : modeConfig.label}
          </h1>
          <button
            type="button"
            onClick={onOpenArchive}
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
              darkMode
                ? 'border-[#D4A437]/40 bg-[#2B0944] text-[#F6C915] hover:bg-[#380C59]'
                : 'border-[#D9C6EC] bg-[#F5EFFA] text-[#2B0938] hover:bg-[#EADBF6]'
            }`}
            title={`Open 1-Year Calendar Archive (${ARCHIVE_DAYS_COUNT} Daily Puzzles)`}
          >
            <Calendar className="h-3 w-3 shrink-0" />
            <span>1-Yr Archive</span>
          </button>
        </div>

        {/* Daily Archive Quick Date Stepper */}
        {mode === 'daily' && (
          <div className="mt-2.5 flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => canStepPrev && onSelectArchiveDate(prevDateStr)}
              disabled={!canStepPrev}
              title="Previous Archive Day"
              aria-label="Previous Archive Day"
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                canStepPrev
                  ? darkMode
                    ? 'border-[#D4A437]/40 bg-[#2B0944] text-[#F6C915] hover:bg-[#380C59] cursor-pointer'
                    : 'border-[#D9C6EC] bg-[#F5EFFA] text-[#2B0938] hover:bg-[#EADBF6] cursor-pointer'
                  : 'border-transparent opacity-30 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onOpenArchive}
              title="Open 1-Year Archive Calendar"
              className={`flex-1 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-extrabold transition-colors cursor-pointer ${
                darkMode
                  ? 'border-[#D4A437]/45 bg-[#2B0944] text-[#FAF7FF] hover:border-[#F6C915]'
                  : 'border-[#D9C6EC] bg-[#F5EFFA] text-[#2B0938] hover:border-[#2B0938]'
              }`}
            >
              <Calendar className="h-3.5 w-3.5 text-[#F6C915] shrink-0" />
              <span className="truncate">{formatDisplayDate(activeDailyDate)}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase font-black ${
                  isTodayPuzzle
                    ? 'bg-[#F6C915] text-[#1D0830]'
                    : darkMode
                      ? 'bg-purple-800/80 text-amber-300'
                      : 'bg-purple-200 text-[#2B0938]'
                }`}
              >
                {isTodayPuzzle ? 'Today' : 'Archive'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => canStepNext && onSelectArchiveDate(nextDateStr)}
              disabled={!canStepNext}
              title="Next Archive Day"
              aria-label="Next Archive Day"
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                canStepNext
                  ? darkMode
                    ? 'border-[#D4A437]/40 bg-[#2B0944] text-[#F6C915] hover:bg-[#380C59] cursor-pointer'
                    : 'border-[#D9C6EC] bg-[#F5EFFA] text-[#2B0938] hover:bg-[#EADBF6] cursor-pointer'
                  : 'border-transparent opacity-30 cursor-not-allowed'
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <p className={`mt-2 text-sm ${darkMode ? 'text-[#D6CBE2]' : 'text-[#5E3A73]'}`}>
          {isSolved
            ? 'Every across and down word verified in the dictionary.'
            : 'Drag fragments to swap them, or tap two tiles in turn.'}
        </p>

        {/* Clean Unboxed Telemetry Row */}
        <div
          className={`mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t pt-3.5 text-xs sm:text-sm ${
            darkMode
              ? 'border-[#D4A437]/25 text-[#D6CBE2]'
              : 'border-[#E9DFF2] text-[#5E3A73]'
          }`}
        >
          <span>
            Time{' '}
            <strong
              className={`font-mono-tabular font-bold ${
                darkMode ? 'text-[#FAF7FF]' : 'text-[#1D0830]'
              }`}
            >
              {formatDuration(elapsedSeconds)}
            </strong>
          </span>
          <span aria-hidden="true" className="opacity-50">
            ·
          </span>
          <span>
            Moves{' '}
            <strong
              className={`font-mono-tabular font-bold ${
                darkMode ? 'text-[#FAF7FF]' : 'text-[#1D0830]'
              }`}
            >
              {movesCount}
            </strong>
          </span>
          <span aria-hidden="true" className="opacity-50">
            ·
          </span>
          <span>
            Linked{' '}
            <strong
              className={`font-mono-tabular font-bold ${
                darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
              }`}
            >
              {displayedWords.length}/{validation.totalExpectedWords}
            </strong>
          </span>
        </div>
      </div>

      {/* Solved Victory Callout */}
      {isSolved ? (
        <div
          className={`rounded-xl border-2 p-4 ${
            darkMode
              ? 'border-[#F6C915]/60 bg-[#2C0946]'
              : 'border-[#D4A437] bg-[#FBF7EE]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[#D4A437] dark:text-[#F6C915]">
              <Sparkles className="h-4 w-4 shrink-0" />
              <h2
                className={`font-display text-lg font-extrabold ${
                  darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
                }`}
              >
                Puzzle Complete
              </h2>
            </div>
            <span className="font-mono-tabular text-sm font-extrabold text-[#10B981]">
              +{solvedScore.toLocaleString()} pts
            </span>
          </div>
          <p className={`mt-1.5 text-sm ${darkMode ? 'text-[#E7DDF2]' : 'text-[#3D1252]'}`}>
            Solved in{' '}
            <span className="font-mono-tabular font-bold">
              {formatDuration(elapsedSeconds)}
            </span>{' '}
            with <span className="font-mono-tabular font-bold">{movesCount}</span> moves
            {hintsUsed > 0 ? ` and ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'}` : ''}.
          </p>
          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={mode === 'daily' ? onOpenArchive : onPlayAgain}
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg bg-[#F6C915] px-4 py-2 text-xs sm:text-sm font-extrabold text-[#1D0830] transition-colors hover:bg-[#FFE047] active:scale-[0.99] whitespace-nowrap cursor-pointer"
            >
              {mode === 'daily' ? (
                <>
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>1-Year Archive</span>
                </>
              ) : (
                <span>Play Again</span>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className={`inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
                darkMode
                  ? 'border-[#D4A437]/50 bg-white/10 text-[#F6C915] hover:bg-white/15'
                  : 'border-[#2B0938] bg-[#2B0938] text-[#F6C915] hover:bg-[#3B0D4E]'
              }`}
            >
              <Trophy className="h-4 w-4 shrink-0" />
              <span>Leaderboard</span>
            </button>
          </div>
        </div>
      ) : (
        /* Primary Puzzle Controls (44px+ touch targets) */
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap cursor-pointer ${
                darkMode
                  ? 'border-[#D4A437]/40 bg-[#2B0944] text-[#FAF7FF] hover:bg-[#380C59]'
                  : 'border-[#D9C6EC] bg-[#F8F4FC] text-[#1D0830] hover:bg-[#EFE5F8]'
              }`}
            >
              <Undo2 className="h-4 w-4 shrink-0 text-[#F6C915]" />
              <span>Undo</span>
            </button>

            <button
              type="button"
              onClick={onCheck}
              className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
                darkMode
                  ? 'border-[#D4A437]/40 bg-[#2B0944] text-[#FAF7FF] hover:bg-[#380C59]'
                  : 'border-[#D9C6EC] bg-[#F8F4FC] text-[#1D0830] hover:bg-[#EFE5F8]'
              }`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
              <span>Check</span>
            </button>

            <button
              type="button"
              onClick={onHint}
              className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
                darkMode
                  ? 'border-[#D4A437]/40 bg-[#2B0944] text-[#FAF7FF] hover:bg-[#380C59]'
                  : 'border-[#D9C6EC] bg-[#F8F4FC] text-[#1D0830] hover:bg-[#EFE5F8]'
              }`}
            >
              <Lightbulb className="h-4 w-4 shrink-0 text-[#F59E0B]" />
              <span>Hint</span>
            </button>

            <button
              type="button"
              onClick={onTogglePinSelected}
              disabled={selectedSlot === null || isSelectedLocked}
              className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap cursor-pointer ${
                darkMode
                  ? 'border-[#D4A437]/40 bg-[#2B0944] text-[#FAF7FF] hover:bg-[#380C59]'
                  : 'border-[#D9C6EC] bg-[#F8F4FC] text-[#1D0830] hover:bg-[#EFE5F8]'
              }`}
            >
              {isSelectedPinned ? (
                <>
                  <PinOff className="h-4 w-4 shrink-0 text-[#F59E0B]" />
                  <span>Unpin</span>
                </>
              ) : (
                <>
                  <Pin className="h-4 w-4 shrink-0 text-[#D4A437]" />
                  <span>Pin Tile</span>
                </>
              )}
            </button>
          </div>

          {checkSummary && (
            <p
              className={`text-center text-xs font-bold ${
                darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
              }`}
              role="status"
              aria-live="polite"
            >
              {checkSummary}
            </p>
          )}
        </div>
      )}

      {/* Clean Preferences Hairline Section */}
      <div
        className={`flex flex-col gap-3 border-t pt-4 ${
          darkMode ? 'border-[#D4A437]/25' : 'border-[#E9DFF2]'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="toggle-autolock"
            className={`text-sm font-semibold cursor-pointer ${
              darkMode ? 'text-[#FAF7FF]' : 'text-[#2B0938]'
            }`}
          >
            Auto-lock correct tiles
          </label>
          <button
            id="toggle-autolock"
            type="button"
            role="switch"
            aria-checked={autoLockCorrect}
            onClick={onToggleAutoLock}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
              autoLockCorrect
                ? 'bg-[#F6C915]'
                : darkMode
                  ? 'bg-[#3C1357]'
                  : 'bg-[#D8C8E8]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                autoLockCorrect
                  ? 'translate-x-6 bg-[#1D0830]'
                  : 'translate-x-1 bg-white'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onToggleSound}
            className={`flex min-h-[36px] items-center gap-2 text-sm font-semibold transition-colors cursor-pointer ${
              darkMode
                ? 'text-[#D6CBE2] hover:text-[#F6C915]'
                : 'text-[#5E3A73] hover:text-[#2B0938]'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-[#F6C915]" />
            ) : (
              <VolumeX className="h-4 w-4 opacity-60" />
            )}
            <span>{soundEnabled ? 'Sound on' : 'Sound muted'}</span>
          </button>

          {!isSolved && movesCount > 0 && (
            <button
              type="button"
              onClick={onResetCurrent}
              className={`flex min-h-[36px] items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                darkMode
                  ? 'text-[#D6CBE2] hover:text-[#F6C915]'
                  : 'text-[#5E3A73] hover:text-[#2B0938]'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reshuffle</span>
            </button>
          )}
        </div>
      </div>

      {/* Linked Dictionary Words Ledger */}
      <div
        className={`border-t pt-4 ${
          darkMode ? 'border-[#D4A437]/25' : 'border-[#E9DFF2]'
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2
            className={`text-sm font-bold ${
              darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
            }`}
          >
            {isSolved ? 'Verified Words' : 'Linked Across Seams'}
          </h2>
          <span
            className={`font-mono-tabular text-xs font-semibold ${
              darkMode ? 'text-[#D6CBE2]' : 'text-[#5E3A73]'
            }`}
          >
            {displayedWords.length} found
          </span>
        </div>

        {displayedWords.length === 0 ? (
          <p
            className={`mt-2.5 text-xs leading-relaxed ${
              darkMode ? 'text-[#C2B2D4]' : 'text-[#6D4C82]'
            }`}
          >
            Words spanning two or more connected fragments appear here as you assemble valid
            crossings.
          </p>
        ) : (
          <div className="mt-3 grid max-h-44 grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto pr-1">
            {displayedWords.map((item) => (
              <div
                key={`${item.word}-${item.direction}-${item.row}-${item.col}`}
                className={`flex items-baseline justify-between border-b pb-1 text-xs ${
                  darkMode ? 'border-white/10' : 'border-[#F0E8F7]'
                }`}
              >
                <span
                  className={`font-mono-tabular font-bold tracking-wider ${
                    darkMode ? 'text-[#FAF7FF]' : 'text-[#1D0830]'
                  }`}
                >
                  {item.word}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    darkMode ? 'text-[#F6C915]/80' : 'text-[#6D4C82]'
                  }`}
                >
                  {item.direction === 'across' ? 'A' : 'D'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quiet Editorial Stats & Dictionary Footer */}
      <div
        className={`border-t pt-3.5 text-xs space-y-1 ${
          darkMode
            ? 'border-[#D4A437]/25 text-[#C2B2D4]'
            : 'border-[#E9DFF2] text-[#6D4C82]'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>
            Solved{' '}
            <strong
              className={`font-mono-tabular ${
                darkMode ? 'text-[#FAF7FF]' : 'text-[#1D0830]'
              }`}
            >
              {stats.totalSolved}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Daily Streak{' '}
            <strong
              className={`font-mono-tabular ${
                darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
              }`}
            >
              {stats.dailyStreak}
            </strong>
          </span>
          {bestForMode !== undefined && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Best{' '}
                <strong
                  className={`font-mono-tabular ${
                    darkMode ? 'text-[#FAF7FF]' : 'text-[#1D0830]'
                  }`}
                >
                  {formatDuration(bestForMode)}
                </strong>
              </span>
            </>
          )}
          {stats.bestScore > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                High Score{' '}
                <strong
                  className={`font-mono-tabular ${
                    darkMode ? 'text-[#10B981]' : 'text-[#047857]'
                  }`}
                >
                  {stats.bestScore.toLocaleString()}
                </strong>
              </span>
            </>
          )}
        </div>
        <p className="text-[11px] opacity-85">
          Standard English word game dictionary ({dictionaryWordCount.toLocaleString()} words)
        </p>
      </div>
    </aside>
  );
};
