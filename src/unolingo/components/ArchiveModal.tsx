import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { type DictionaryLanguageCode } from '@/lib/dictionary-languages';
import { GameView, PuzzleProgressRecord } from '../types';
import { getProgressDateKey } from '../engine/storage';
import {
  ARCHIVE_DAYS_COUNT,
  formatDuration,
  getArchiveBounds,
  isDateInArchive,
} from '../engine/londonTime';

interface ArchiveCalendarPickerProps {
  onSelectDate: (dateStr: string) => void;
  progressMap: Record<string, PuzzleProgressRecord>;
  dictionaryLanguage?: DictionaryLanguageCode;
  todayLondonStr: string;
  selectedDateStr?: string;
  onClose?: () => void;
  compact?: boolean;
}

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

export const ArchiveCalendarPicker: React.FC<ArchiveCalendarPickerProps> = ({
  onSelectDate,
  progressMap,
  dictionaryLanguage = 'en',
  todayLondonStr,
  selectedDateStr,
  onClose,
  compact = false,
}) => {
  const { minDateStr, maxDateStr } = useMemo(
    () => getArchiveBounds(todayLondonStr),
    [todayLondonStr]
  );

  const initialDateStr =
    selectedDateStr && isDateInArchive(selectedDateStr, todayLondonStr)
      ? selectedDateStr
      : todayLondonStr;
  const [initYear, initMonth] = initialDateStr.split('-').map(Number);

  const [viewYear, setViewYear] = useState<number>(initYear);
  const [viewMonth, setViewMonth] = useState<number>(initMonth - 1);

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
      const available = isDateInArchive(dateStr, todayLondonStr);
      cells.push({ day: d, dateStr, available });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ day: null, dateStr: null, available: false });
    }

    return cells;
  }, [viewYear, viewMonth, todayLondonStr]);

  return (
    <div
      className={`bg-white/95 dark:bg-[#240930]/95 backdrop-blur-md border border-purple-200 dark:border-purple-800/80 rounded-3xl shadow-2xl ${
        compact ? 'p-4 w-[320px] sm:w-[360px]' : 'p-6 sm:p-8 w-full max-w-md mx-auto'
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
          if (cell.day === null || !cell.dateStr) {
            return (
              <div
                key={`empty-${idx}`}
                className="aspect-square rounded-xl bg-slate-100/40 dark:bg-purple-950/20 border border-transparent"
              />
            );
          }

          const rec = progressMap[getProgressDateKey(cell.dateStr, dictionaryLanguage)];
          const isCompleted = rec?.status === 'completed';
          const isInProgress = rec?.status === 'in_progress';
          const isToday = cell.dateStr === todayLondonStr;
          const isSelected = cell.dateStr === selectedDateStr;
          const placedCount = rec ? rec.boardLetters.filter(Boolean).length : 0;

          if (!cell.available) {
            return (
              <button
                key={cell.dateStr}
                type="button"
                disabled
                title="Outside 183-day archive"
                className="aspect-square rounded-xl bg-slate-100/70 dark:bg-[#180420]/70 border border-slate-200/50 dark:border-purple-900/20 text-slate-300 dark:text-purple-800/40 font-bold text-xs flex flex-col items-center justify-center cursor-not-allowed select-none opacity-45 line-through"
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
                isCompleted && rec
                  ? `${cell.dateStr} · Solved in ${formatDuration(rec.elapsedSec)}`
                  : isInProgress
                  ? `${cell.dateStr} · ${placedCount}/26 placed`
                  : cell.dateStr
              }
              className={`relative aspect-square rounded-xl font-extrabold text-xs sm:text-sm flex flex-col items-center justify-center transition-all cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#2d0938] border-2 border-white shadow-md scale-105'
                  : isToday
                  ? 'bg-amber-400/20 dark:bg-amber-400/25 text-[#3b0d47] dark:text-amber-300 border-2 border-amber-400 hover:bg-amber-400/35'
                  : isCompleted
                  ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/45 hover:border-emerald-400'
                  : isInProgress
                  ? 'bg-amber-500/15 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-400/50'
                  : 'bg-purple-50/70 dark:bg-[#310a3d] text-[#2d0938] dark:text-purple-100 border border-purple-200/70 dark:border-purple-800/60 hover:bg-amber-400 hover:text-[#2d0938] hover:border-amber-300'
              }`}
            >
              <span className="tabular-nums leading-none">{cell.day}</span>
              {isCompleted && rec ? (
                <span className="mt-0.5 text-[9px] font-mono tabular-nums leading-none flex items-center gap-0.5 opacity-85">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                  {!compact && formatDuration(rec.elapsedSec)}
                </span>
              ) : isInProgress ? (
                <span className="mt-0.5 text-[9px] font-mono tabular-nums leading-none flex items-center gap-0.5 opacity-85">
                  <Clock className="w-2.5 h-2.5" />
                  {!compact && `${placedCount}`}
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

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-purple-100 dark:border-purple-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-purple-200/70">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Solved
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> In Progress
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-slate-200 dark:bg-purple-950 opacity-50 inline-block" /> Locked
        </span>
      </div>
    </div>
  );
};

interface ArchiveModalProps {
  setCurrentView: (view: GameView) => void;
  onSelectDate: (dateStr: string) => void;
  progressMap: Record<string, PuzzleProgressRecord>;
  dictionaryLanguage?: DictionaryLanguageCode;
  todayLondonStr: string;
  selectedDateStr?: string;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  setCurrentView,
  onSelectDate,
  progressMap,
  dictionaryLanguage = 'en',
  todayLondonStr,
  selectedDateStr,
}) => {
  const solvedCount = useMemo(
    () =>
      Object.entries(progressMap).filter(([key, p]) => {
        if (p.status !== 'completed') return false;
        return dictionaryLanguage === 'en'
          ? !key.includes(':')
          : key.endsWith(`:${dictionaryLanguage}`);
      }).length,
    [progressMap, dictionaryLanguage]
  );

  return (
    <div className="max-w-xl mx-auto px-4 py-8 w-full">
      <div className="mb-6 text-center sm:text-left">
        <button
          type="button"
          onClick={() => setCurrentView('TITLE')}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#581c6b] dark:text-amber-400 mb-2 hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Menu
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-3xl font-black text-[#3b0d47] dark:text-white flex items-center justify-center sm:justify-start gap-3">
            <CalendarIcon className="w-8 h-8 text-amber-500" />
            6-Month Archive
          </h1>
          <span className="text-xs font-mono font-bold text-slate-500 dark:text-amber-300/80 tabular-nums">
            {solvedCount} / {ARCHIVE_DAYS_COUNT} solved
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-purple-200/70 mt-1">
          Select any date from the trailing {ARCHIVE_DAYS_COUNT} London daily puzzles to play or review.
        </p>
      </div>

      <ArchiveCalendarPicker
        progressMap={progressMap}
        dictionaryLanguage={dictionaryLanguage}
        todayLondonStr={todayLondonStr}
        selectedDateStr={selectedDateStr}
        onSelectDate={(dateStr) => {
          onSelectDate(dateStr);
          setCurrentView('PLAYING');
        }}
      />
    </div>
  );
};
