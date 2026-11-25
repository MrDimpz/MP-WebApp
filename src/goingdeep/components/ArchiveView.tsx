import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  X as XIcon,
} from 'lucide-react';
import { DifficultyLevel, PuzzleProgress } from '../types';
import {
  ARCHIVE_DAYS_COUNT,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  formatHumanDate,
  getArchiveBounds,
  getDailyNumber,
  getProgressKey,
  isDateInArchive,
} from '../data/dailyGenerator';
import { formatTime } from '../utils/storage';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface ArchiveCalendarPickerProps {
  todayDateKey: string;
  currentDateKey: string;
  difficulty: DifficultyLevel;
  progressMap: Record<string, PuzzleProgress>;
  onSelectDate: (dateKey: string) => void;
  onClose?: () => void;
  compact?: boolean;
}

export const ArchiveCalendarPicker: React.FC<ArchiveCalendarPickerProps> = ({
  todayDateKey,
  currentDateKey,
  difficulty,
  progressMap,
  onSelectDate,
  onClose,
  compact = false,
}) => {
  const { minDateKey, maxDateKey } = useMemo(
    () => getArchiveBounds(todayDateKey),
    [todayDateKey]
  );

  const initialDateKey =
    currentDateKey && isDateInArchive(currentDateKey, todayDateKey)
      ? currentDateKey
      : todayDateKey;
  const [initYear, initMonth] = initialDateKey.split('-').map(Number);

  const [viewYear, setViewYear] = useState<number>(initYear);
  const [viewMonth, setViewMonth] = useState<number>(initMonth - 1);

  const availableMonths = useMemo(() => {
    const [minY, minM] = minDateKey.split('-').map(Number);
    const [maxY, maxM] = maxDateKey.split('-').map(Number);
    const list: Array<{ year: number; month: number; label: string; key: string }> = [];
    let y = minY;
    let m = minM - 1;
    while (y < maxY || (y === maxY && m <= maxM - 1)) {
      list.push({
        year: y,
        month: m,
        label: `${MONTH_NAMES[m]} ${y}`,
        key: `${y}-${String(m + 1).padStart(2, '0')}`,
      });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    return list;
  }, [minDateKey, maxDateKey]);

  const currentMonthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const currentMonthIdx = availableMonths.findIndex((m) => m.key === currentMonthKey);
  const activeMonth = availableMonths[currentMonthIdx];

  const canGoPrev = currentMonthIdx > 0;
  const canGoNext = currentMonthIdx >= 0 && currentMonthIdx < availableMonths.length - 1;

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    const prev = availableMonths[currentMonthIdx - 1];
    setViewYear(prev.year);
    setViewMonth(prev.month);
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    const next = availableMonths[currentMonthIdx + 1];
    setViewYear(next.year);
    setViewMonth(next.month);
  };

  const calendarCells = useMemo(() => {
    const firstDayUtc = new Date(Date.UTC(viewYear, viewMonth, 1));
    const startWeekday = (firstDayUtc.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

    const cells: Array<{
      day: number | null;
      dateKey: string | null;
      available: boolean;
    }> = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, dateKey: null, available: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const available = isDateInArchive(dateKey, todayDateKey);
      cells.push({ day: d, dateKey, available });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ day: null, dateKey: null, available: false });
    }

    return cells;
  }, [viewYear, viewMonth, todayDateKey]);

  const monthStats = useMemo(() => {
    let available = 0;
    let solved = 0;
    for (const cell of calendarCells) {
      if (!cell.available || !cell.dateKey) continue;
      available++;
      const prog = progressMap[getProgressKey(cell.dateKey, difficulty)];
      if (prog?.status === 'won') solved++;
    }
    return { available, solved };
  }, [calendarCells, difficulty, progressMap]);

  return (
    <div
      className={`bg-white/95 dark:bg-[#240930]/95 backdrop-blur-md border border-purple-200 dark:border-purple-800/80 rounded-3xl shadow-2xl ${
        compact ? 'p-4 w-[320px] sm:w-[360px]' : 'p-4 sm:p-7 w-full max-w-md mx-auto'
      }`}
    >
      {/* Month Dropdown & Prev/Next Controls */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={!canGoPrev}
          aria-label="Previous Month"
          className={`p-2 rounded-xl border transition-colors ${
            canGoPrev
              ? 'border-purple-200 dark:border-purple-700 text-[#3b0d47] dark:text-amber-300 hover:bg-purple-50 dark:hover:bg-purple-900/50 cursor-pointer'
              : 'border-transparent text-slate-300 dark:text-purple-800/50 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="relative flex-1">
          <select
            aria-label="Select Archive Month"
            value={currentMonthKey}
            onChange={(e) => {
              const found = availableMonths.find((m) => m.key === e.target.value);
              if (found) {
                setViewYear(found.year);
                setViewMonth(found.month);
              }
            }}
            className="w-full appearance-none pl-4 pr-9 py-2 rounded-xl bg-purple-50/80 dark:bg-[#360b42] border border-purple-200 dark:border-purple-700 text-[#2d0938] dark:text-amber-300 font-extrabold text-sm text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {availableMonths.map((m) => (
              <option
                key={m.key}
                value={m.key}
                className="bg-white dark:bg-[#240930] text-[#2d0938] dark:text-white"
              >
                {m.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-[#4a1259] dark:text-amber-300 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          disabled={!canGoNext}
          aria-label="Next Month"
          className={`p-2 rounded-xl border transition-colors ${
            canGoNext
              ? 'border-purple-200 dark:border-purple-700 text-[#3b0d47] dark:text-amber-300 hover:bg-purple-50 dark:hover:bg-purple-900/50 cursor-pointer'
              : 'border-transparent text-slate-300 dark:text-purple-800/50 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1.5 mb-2 text-center">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-purple-300/60 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarCells.map((cell, idx) => {
          if (cell.day === null || !cell.dateKey) {
            return (
              <div
                key={`empty-${idx}`}
                className="aspect-square rounded-xl bg-slate-100/40 dark:bg-purple-950/20 border border-transparent"
              />
            );
          }

          const prog = progressMap[getProgressKey(cell.dateKey, difficulty)];
          const isWon = prog?.status === 'won';
          const isLost = prog?.status === 'lost';
          const keysDone = prog
            ? Object.values(prog.miniGames).filter((mg) => mg.status !== 'locked').length
            : 0;
          const solvedTiersCount = prog?.solvedTiers.length ?? 0;
          const isInProgress =
            Boolean(prog) &&
            prog.status === 'in_progress' &&
            (keysDone > 0 || solvedTiersCount > 0 || prog.guesses.length > 0 || prog.elapsedSeconds > 0);
          const isToday = cell.dateKey === todayDateKey;
          const isSelected = cell.dateKey === currentDateKey;

          if (!cell.available) {
            return (
              <button
                key={cell.dateKey}
                type="button"
                disabled
                title={`Outside ${ARCHIVE_DAYS_COUNT}-day archive`}
                className="aspect-square rounded-xl bg-slate-100/70 dark:bg-[#180420]/70 border border-slate-200/50 dark:border-purple-900/20 text-slate-300 dark:text-purple-800/40 font-bold text-xs flex flex-col items-center justify-center cursor-not-allowed select-none opacity-45 line-through"
              >
                <span>{cell.day}</span>
              </button>
            );
          }

          const puzzleNum = getDailyNumber(cell.dateKey);
          const dateLabel = formatHumanDate(cell.dateKey);
          const titleText = isWon && prog
            ? `#${puzzleNum} (${dateLabel}) · Solved in ${formatTime(prog.elapsedSeconds)}`
            : isLost
            ? `#${puzzleNum} (${dateLabel}) · Completed`
            : isInProgress
            ? `#${puzzleNum} (${dateLabel}) · ${solvedTiersCount}/4 layers · ${keysDone} keys`
            : `#${puzzleNum} (${dateLabel}) · Unplayed`;

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => {
                onSelectDate(cell.dateKey!);
                if (onClose) onClose();
              }}
              title={titleText}
              className={`relative aspect-square rounded-xl font-extrabold text-xs sm:text-sm flex flex-col items-center justify-center transition-all cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#2d0938] border-2 border-white shadow-md scale-105'
                  : isToday
                  ? 'bg-amber-400/20 dark:bg-amber-400/25 text-[#3b0d47] dark:text-amber-300 border-2 border-amber-400 hover:bg-amber-400/35'
                  : isWon
                  ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/45 hover:border-emerald-400'
                  : isLost
                  ? 'bg-rose-500/12 dark:bg-rose-500/15 text-rose-700 dark:text-rose-200 border border-rose-400/45 hover:border-rose-400'
                  : isInProgress
                  ? 'bg-amber-500/15 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-400/50'
                  : 'bg-purple-50/70 dark:bg-[#310a3d] text-[#2d0938] dark:text-purple-100 border border-purple-200/70 dark:border-purple-800/60 hover:bg-amber-400 hover:text-[#2d0938] hover:border-amber-300'
              }`}
            >
              <span className="tabular-nums leading-none">{cell.day}</span>
              {isWon && prog ? (
                <span className="mt-0.5 text-[9px] font-mono tabular-nums leading-none flex items-center gap-0.5 opacity-85">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                  {!compact && prog.elapsedSeconds > 0 && formatTime(prog.elapsedSeconds)}
                </span>
              ) : isLost ? (
                <span className="mt-0.5 text-[9px] font-mono tabular-nums leading-none flex items-center gap-0.5 opacity-85">
                  <XIcon className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              ) : isInProgress ? (
                <span className="mt-0.5 text-[9px] font-mono tabular-nums leading-none flex items-center gap-0.5 opacity-85">
                  <Clock className="w-2.5 h-2.5" />
                  {!compact && `${solvedTiersCount}/4`}
                </span>
              ) : isToday ? (
                <span className="text-[8px] font-black uppercase tracking-tighter text-amber-600 dark:text-amber-300 leading-none mt-0.5">
                  TODAY
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Month Progress & Legend */}
      <div className="mt-4 pt-3 border-t border-purple-100 dark:border-purple-800/60 space-y-2">
        {activeMonth && (
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-purple-200/75">
            <span>{activeMonth.label}</span>
            <span className="font-bold text-[#4a1259] dark:text-amber-300">
              {monthStats.solved} / {monthStats.available} solved
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-purple-200/70">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Solved
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> In Progress
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" /> Completed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-slate-200 dark:bg-purple-950 opacity-50 inline-block" /> Locked
          </span>
        </div>
      </div>
    </div>
  );
};

interface ArchiveViewProps {
  dateKeys: string[];
  todayDateKey: string;
  currentDateKey: string;
  difficulty: DifficultyLevel;
  progressMap: Record<string, PuzzleProgress>;
  onSelectDifficulty: (level: DifficultyLevel) => void;
  onSelectDaily: (dateKey: string, difficulty: DifficultyLevel) => void;
  onBackToPlay?: () => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  dateKeys,
  todayDateKey,
  currentDateKey,
  difficulty,
  progressMap,
  onSelectDifficulty,
  onSelectDaily,
  onBackToPlay,
}) => {
  const diffConfig = DIFFICULTIES[difficulty];

  const solvedCount = useMemo(
    () =>
      dateKeys.filter(
        (dk) => progressMap[getProgressKey(dk, difficulty)]?.status === 'won'
      ).length,
    [dateKeys, difficulty, progressMap]
  );

  return (
    <div className="max-w-xl mx-auto w-full px-1 sm:px-4 py-2 sm:py-4">
      <div className="mb-5 text-center sm:text-left">
        {onBackToPlay && (
          <button
            type="button"
            onClick={onBackToPlay}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#581c6b] dark:text-amber-400 mb-2 hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Puzzle
          </button>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl sm:text-3xl font-black text-[#3b0d47] dark:text-white flex items-center justify-center sm:justify-start gap-2.5">
            <CalendarIcon className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500" />
            6-Month Archive
          </h1>
          <span className="text-xs font-mono font-bold text-[#5C3A78] dark:text-amber-300/85 tabular-nums">
            {solvedCount} / {dateKeys.length} solved ({diffConfig.label})
          </span>
        </div>
        <p className="text-sm text-[#5C3A78] dark:text-purple-200/75 mt-1">
          Select any date from the trailing {ARCHIVE_DAYS_COUNT} daily puzzles to play or review across all three difficulty levels.
        </p>
      </div>

      {/* Difficulty Filter & Quick Jump to Today */}
      <div className="mb-5 flex flex-wrap items-center justify-center sm:justify-between gap-2.5">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#2B0938] text-[#F6C915] dark:bg-[#F6C915] dark:text-[#1D0830] shadow-xs'
                    : 'text-[#5C3A78] dark:text-[#D6CBE2] hover:text-[#2B0938] dark:hover:text-white'
                }`}
              >
                {cfg.label} · {cfg.keyCount}K
              </button>
            );
          })}
        </div>

        {currentDateKey !== todayDateKey && (
          <button
            type="button"
            onClick={() => onSelectDaily(todayDateKey, difficulty)}
            className="px-3.5 py-1.5 rounded-xl bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] text-xs font-extrabold shadow-xs transition-colors whitespace-nowrap cursor-pointer"
          >
            Play Today
          </button>
        )}
      </div>

      <ArchiveCalendarPicker
        todayDateKey={todayDateKey}
        currentDateKey={currentDateKey}
        difficulty={difficulty}
        progressMap={progressMap}
        onSelectDate={(dateKey) => onSelectDaily(dateKey, difficulty)}
      />
    </div>
  );
};
