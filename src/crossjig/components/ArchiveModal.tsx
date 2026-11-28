import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ARCHIVE_DAYS_COUNT,
  formatDisplayDate,
  getArchiveBounds,
  isDateInArchive,
} from '../game/generator';
import { PlayerStats } from '../game/types';
import { formatDuration } from './PuzzleLedger';

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

export interface ArchiveCalendarPickerProps {
  onSelectDate: (dateStr: string) => void;
  stats: PlayerStats;
  todayDateStr: string;
  selectedDateStr?: string;
  darkMode: boolean;
  onClose?: () => void;
  compact?: boolean;
}

export const ArchiveCalendarPicker: React.FC<ArchiveCalendarPickerProps> = ({
  onSelectDate,
  stats,
  todayDateStr,
  selectedDateStr,
  darkMode,
  onClose,
  compact = false,
}) => {
  const { minDateStr, maxDateStr } = useMemo(
    () => getArchiveBounds(todayDateStr),
    [todayDateStr]
  );

  const initialDateStr =
    selectedDateStr && isDateInArchive(selectedDateStr, todayDateStr)
      ? selectedDateStr
      : todayDateStr;
  const [initYear, initMonth] = initialDateStr.split('-').map(Number);

  const [viewYear, setViewYear] = useState<number>(initYear);
  const [viewMonth, setViewMonth] = useState<number>(initMonth - 1);

  useEffect(() => {
    const target =
      selectedDateStr && isDateInArchive(selectedDateStr, todayDateStr)
        ? selectedDateStr
        : todayDateStr;
    const [y, m] = target.split('-').map(Number);
    if (y && m) {
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [selectedDateStr, todayDateStr]);

  const availableMonths = useMemo(() => {
    const [minY, minM] = minDateStr.split('-').map(Number);
    const [maxY, maxM] = maxDateStr.split('-').map(Number);
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
  }, [minDateStr, maxDateStr]);

  const currentMonthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const currentMonthIdx = availableMonths.findIndex((m) => m.key === currentMonthKey);

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
      dateStr: string | null;
      available: boolean;
    }> = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, dateStr: null, available: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const available = isDateInArchive(dateStr, todayDateStr);
      cells.push({ day: d, dateStr, available });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ day: null, dateStr: null, available: false });
    }

    return cells;
  }, [viewYear, viewMonth, todayDateStr]);

  const monthStats = useMemo(() => {
    let available = 0;
    let solved = 0;
    for (const cell of calendarCells) {
      if (!cell.available || !cell.dateStr) continue;
      available++;
      const rec = stats.dailyArchive?.[cell.dateStr];
      if (rec?.solved || stats.dailyCompletedDates.includes(cell.dateStr)) {
        solved++;
      }
    }
    return { available, solved };
  }, [calendarCells, stats.dailyArchive, stats.dailyCompletedDates]);

  return (
    <div
      className={`rounded-3xl border shadow-2xl backdrop-blur-md transition-colors ${
        darkMode
          ? 'bg-[#240930]/95 border-[#D4A437]/40 text-[#FAF7FF]'
          : 'bg-white/95 border-purple-200 text-[#2d0938]'
      } ${compact ? 'p-4 w-[320px] sm:w-[360px]' : 'p-5 sm:p-7 w-full max-w-md mx-auto'}`}
    >
      {/* Month Dropdown & Prev/Next Controls */}
      <div className="flex items-center justify-between gap-2 mb-3.5">
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={!canGoPrev}
          aria-label="Previous Month"
          className={`p-2 rounded-xl border transition-colors ${
            canGoPrev
              ? darkMode
                ? 'border-purple-700 text-[#F6C915] hover:bg-purple-900/50 cursor-pointer'
                : 'border-purple-200 text-[#3b0d47] hover:bg-purple-50 cursor-pointer'
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
            className={`w-full appearance-none pl-4 pr-9 py-2 rounded-xl border font-extrabold text-sm text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#F6C915] ${
              darkMode
                ? 'bg-[#360b42] border-purple-700 text-[#F6C915]'
                : 'bg-purple-50/80 border-purple-200 text-[#2d0938]'
            }`}
          >
            {availableMonths.map((m) => (
              <option
                key={m.key}
                value={m.key}
                className={
                  darkMode ? 'bg-[#240930] text-white' : 'bg-white text-[#2d0938]'
                }
              >
                {m.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className={`w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
              darkMode ? 'text-[#F6C915]' : 'text-[#4a1259]'
            }`}
          />
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          disabled={!canGoNext}
          aria-label="Next Month"
          className={`p-2 rounded-xl border transition-colors ${
            canGoNext
              ? darkMode
                ? 'border-purple-700 text-[#F6C915] hover:bg-purple-900/50 cursor-pointer'
                : 'border-purple-200 text-[#3b0d47] hover:bg-purple-50 cursor-pointer'
              : 'border-transparent text-slate-300 dark:text-purple-800/50 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Month progress bar & quick Today jump */}
      <div className="mb-3 flex items-center justify-between gap-2 text-xs">
        <span
          className={`font-mono-tabular font-bold ${
            darkMode ? 'text-[#D6CBE2]' : 'text-[#5E3A73]'
          }`}
        >
          Month:{' '}
          <strong className={darkMode ? 'text-emerald-300' : 'text-emerald-700'}>
            {monthStats.solved}/{monthStats.available}
          </strong>{' '}
          solved
        </span>
        {selectedDateStr !== todayDateStr && (
          <button
            type="button"
            onClick={() => {
              onSelectDate(todayDateStr);
              if (onClose) onClose();
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-[#F6C915] px-2.5 py-1 text-[11px] font-extrabold text-[#1D0830] hover:bg-[#FFE047] transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            <span>Jump to Today</span>
          </button>
        )}
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1.5 mb-2 text-center">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className={`text-[11px] font-extrabold uppercase tracking-wider py-1 ${
              darkMode ? 'text-purple-300/60' : 'text-slate-400'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarCells.map((cell, idx) => {
          if (cell.day === null || !cell.dateStr) {
            return (
              <div
                key={`empty-${idx}`}
                className={`aspect-square rounded-xl border border-transparent ${
                  darkMode ? 'bg-purple-950/20' : 'bg-slate-100/40'
                }`}
              />
            );
          }

          const rec = stats.dailyArchive?.[cell.dateStr];
          const isCompleted =
            Boolean(rec?.solved) || stats.dailyCompletedDates.includes(cell.dateStr);
          const isInProgress =
            !isCompleted &&
            Boolean(rec && ((rec.movesCount && rec.movesCount > 0) || rec.tileOrder));
          const isToday = cell.dateStr === todayDateStr;
          const isSelected = cell.dateStr === selectedDateStr;

          if (!cell.available) {
            return (
              <button
                key={cell.dateStr}
                type="button"
                disabled
                title={`Outside ${ARCHIVE_DAYS_COUNT}-day archive`}
                className={`aspect-square rounded-xl border font-bold text-xs flex flex-col items-center justify-center cursor-not-allowed select-none opacity-45 line-through ${
                  darkMode
                    ? 'bg-[#180420]/70 border-purple-900/20 text-purple-800/40'
                    : 'bg-slate-100/70 border-slate-200/50 text-slate-300'
                }`}
              >
                <span>{cell.day}</span>
              </button>
            );
          }

          return (
            <button
              key={cell.dateStr}
              type="button"
              onClick={() => {
                onSelectDate(cell.dateStr!);
                if (onClose) onClose();
              }}
              title={
                isCompleted
                  ? `${formatDisplayDate(cell.dateStr)} · Solved${
                      rec?.bestSeconds !== undefined
                        ? ` in ${formatDuration(rec.bestSeconds)}`
                        : ''
                    }`
                  : isInProgress
                    ? `${formatDisplayDate(cell.dateStr)} · In progress (${rec?.movesCount ?? 0} moves)`
                    : formatDisplayDate(cell.dateStr)
              }
              className={`relative aspect-square rounded-xl font-extrabold text-xs sm:text-sm flex flex-col items-center justify-center transition-all cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#2d0938] border-2 border-white shadow-md scale-105'
                  : isToday
                    ? darkMode
                      ? 'bg-amber-400/25 text-amber-300 border-2 border-amber-400 hover:bg-amber-400/35'
                      : 'bg-amber-400/20 text-[#3b0d47] border-2 border-amber-400 hover:bg-amber-400/35'
                    : isCompleted
                      ? darkMode
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/45 hover:border-emerald-400'
                        : 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/45 hover:border-emerald-400'
                      : isInProgress
                        ? darkMode
                          ? 'bg-amber-500/15 text-amber-200 border border-amber-400/50 hover:border-amber-300'
                          : 'bg-amber-500/15 text-amber-800 border border-amber-400/50 hover:border-amber-400'
                        : darkMode
                          ? 'bg-[#310a3d] text-purple-100 border border-purple-800/60 hover:bg-[#F6C915] hover:text-[#2d0938] hover:border-amber-300'
                          : 'bg-purple-50/70 text-[#2d0938] border border-purple-200/70 hover:bg-amber-400 hover:text-[#2d0938] hover:border-amber-300'
              }`}
            >
              <span className="tabular-nums leading-none">{cell.day}</span>
              {isCompleted ? (
                <span className="mt-0.5 text-[9px] font-mono tabular-nums leading-none flex items-center gap-0.5 opacity-90">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                  {!compact && rec?.bestSeconds !== undefined && formatDuration(rec.bestSeconds)}
                </span>
              ) : isInProgress ? (
                <span className="mt-0.5 text-[9px] font-mono tabular-nums leading-none flex items-center gap-0.5 opacity-90">
                  <Clock className="w-2.5 h-2.5" />
                  {!compact && `${rec?.movesCount ?? 0}m`}
                </span>
              ) : isToday ? (
                <span
                  className={`text-[8px] font-black uppercase tracking-tighter leading-none mt-0.5 ${
                    isSelected
                      ? 'text-[#2d0938]'
                      : darkMode
                        ? 'text-amber-300'
                        : 'text-amber-600'
                  }`}
                >
                  TODAY
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div
        className={`mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] ${
          darkMode
            ? 'border-purple-800/60 text-purple-200/70'
            : 'border-purple-100 text-slate-500'
        }`}
      >
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Solved
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> In Progress
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded border border-amber-400 inline-block" /> Today
        </span>
        <span className="flex items-center gap-1">
          <span
            className={`w-2.5 h-2.5 rounded opacity-50 inline-block ${
              darkMode ? 'bg-purple-950' : 'bg-slate-200'
            }`}
          />{' '}
          Locked
        </span>
      </div>
    </div>
  );
};

interface ArchiveModalProps {
  open: boolean;
  darkMode: boolean;
  stats: PlayerStats;
  todayDateStr: string;
  selectedDateStr?: string;
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  open,
  darkMode,
  stats,
  todayDateStr,
  selectedDateStr,
  onSelectDate,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const totalArchiveSolved = useMemo(() => {
    const set = new Set<string>(stats.dailyCompletedDates);
    if (stats.dailyArchive) {
      for (const [d, rec] of Object.entries(stats.dailyArchive)) {
        if (rec?.solved) set.add(d);
      }
    }
    let count = 0;
    for (const d of set) {
      if (isDateInArchive(d, todayDateStr)) count++;
    }
    return count;
  }, [stats.dailyCompletedDates, stats.dailyArchive, todayDateStr]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crossjig-archive-title"
      onClick={onClose}
    >
      <div
        className={`relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border-2 p-5 sm:p-6 shadow-2xl ${
          darkMode
            ? 'border-[#D4A437] bg-[#1E0530] text-[#FAF7FF]'
            : 'border-[#D4A437] bg-[#FFFFFF] text-[#1D0830]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-[#F6C915] shrink-0" />
              <span
                className={`text-[11px] font-mono uppercase tracking-widest font-extrabold ${
                  darkMode ? 'text-[#F6C915]' : 'text-[#8F6500]'
                }`}
              >
                1-Year Daily Archive · {ARCHIVE_DAYS_COUNT} Puzzles
              </span>
            </div>
            <h2
              id="crossjig-archive-title"
              className={`font-display text-2xl font-extrabold tracking-tight mt-0.5 ${
                darkMode ? 'text-[#FAF7FF]' : 'text-[#2B0938]'
              }`}
            >
              CrossJig Calendar Archive
            </h2>
            <p
              className={`text-xs mt-0.5 ${
                darkMode ? 'text-[#D6CBE2]' : 'text-[#5E3A73]'
              }`}
            >
              Play any daily 3×5 crossword jigsaw from the past 12 months ({totalArchiveSolved} /{' '}
              {ARCHIVE_DAYS_COUNT} solved).
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Archive"
            className={`rounded-xl p-2 transition-colors cursor-pointer shrink-0 ${
              darkMode
                ? 'text-[#D6CBE2] hover:bg-white/10 hover:text-[#F6C915]'
                : 'text-[#5E3A73] hover:bg-[#F3EBF9] hover:text-[#2B0938]'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ArchiveCalendarPicker
          stats={stats}
          todayDateStr={todayDateStr}
          selectedDateStr={selectedDateStr}
          darkMode={darkMode}
          onSelectDate={onSelectDate}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
