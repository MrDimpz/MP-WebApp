import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight, ArrowLeft, ChevronDown } from 'lucide-react';
import { GameState, GameStats } from '../types';
import { getArchiveDateBounds, isPuzzleDateAvailable } from '../utils/puzzles';

interface ArchiveCalendarProps {
  onSelectDate: (dateStr: string) => void;
  stats: GameStats;
  todayDateStr: string;
  selectedDateStr?: string;
  onClose?: () => void;
  compact?: boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const ArchiveCalendarPicker: React.FC<ArchiveCalendarProps> = ({
  onSelectDate,
  stats,
  todayDateStr,
  selectedDateStr,
  onClose,
  compact = false,
}) => {
  const { minDateStr, maxDateStr } = useMemo(() => getArchiveDateBounds(), []);

  const initialDateStr = selectedDateStr && isPuzzleDateAvailable(selectedDateStr) ? selectedDateStr : todayDateStr;
  const [initYear, initMonth] = initialDateStr.split('-').map(Number);

  const [viewYear, setViewYear] = useState<number>(initYear);
  const [viewMonth, setViewMonth] = useState<number>(initMonth - 1); // 0-indexed (0 = Jan)

  // Generate list of months between minDateStr and maxDateStr for the dropdown
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
  const currentMonthIdx = availableMonths.findIndex(m => m.key === currentMonthKey);

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

  // Build calendar cells for (viewYear, viewMonth)
  const calendarCells = useMemo(() => {
    const firstDayUtc = new Date(Date.UTC(viewYear, viewMonth, 1));
    // Convert Sunday=0..Saturday=6 to Monday=0..Sunday=6
    const startWeekday = (firstDayUtc.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

    const cells: Array<{
      day: number | null;
      dateStr: string | null;
      available: boolean;
    }> = [];

    // Leading blank padding cells
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, dateStr: null, available: false });
    }

    // Actual days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const available = isPuzzleDateAvailable(dateStr);
      cells.push({ day: d, dateStr, available });
    }

    // Trailing blank padding cells to complete the 7-column row
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, dateStr: null, available: false });
    }

    return cells;
  }, [viewYear, viewMonth]);

  return (
    <div className={`bg-white/95 dark:bg-[#240930]/95 backdrop-blur-md border border-purple-200 dark:border-purple-800/80 rounded-3xl shadow-2xl ${compact ? 'p-4 w-[320px] sm:w-[350px]' : 'p-6 sm:p-8 w-full max-w-md mx-auto'}`}>
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

        {/* Month Selector Dropdown */}
        <div className="relative flex-1">
          <select
            aria-label="Select Archive Month"
            value={currentMonthKey}
            onChange={(e) => {
              const found = availableMonths.find(m => m.key === e.target.value);
              if (found) {
                setViewYear(found.year);
                setViewMonth(found.month);
              }
            }}
            className="w-full appearance-none pl-4 pr-9 py-2 rounded-xl bg-purple-50/80 dark:bg-[#360b42] border border-purple-200 dark:border-purple-700 text-[#2d0938] dark:text-amber-300 font-extrabold text-sm text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {availableMonths.map(m => (
              <option key={m.key} value={m.key} className="bg-white dark:bg-[#240930] text-[#2d0938] dark:text-white">
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
        {WEEKDAYS.map(day => (
          <div key={day} className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-purple-300/60 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarCells.map((cell, idx) => {
          if (cell.day === null || !cell.dateStr) {
            // Blank padding cell
            return (
              <div
                key={`empty-${idx}`}
                className="aspect-square rounded-xl bg-slate-100/40 dark:bg-purple-950/20 border border-transparent"
              />
            );
          }

          const isCompleted = !!stats.completedDays[cell.dateStr];
          const isHardCompleted = !!stats.completedHardDays?.[cell.dateStr];
          const isToday = cell.dateStr === todayDateStr;
          const isSelected = cell.dateStr === selectedDateStr;

          if (!cell.available) {
            // Blanked-out unavailable date
            return (
              <button
                key={cell.dateStr}
                type="button"
                disabled
                title="Unavailable date"
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
              className={`relative aspect-square rounded-xl font-extrabold text-xs sm:text-sm flex flex-col items-center justify-center transition-all cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#2d0938] border-2 border-white shadow-md scale-105'
                  : isToday
                  ? 'bg-amber-400/20 dark:bg-amber-400/25 text-[#3b0d47] dark:text-amber-300 border-2 border-amber-400 hover:bg-amber-400/35'
                  : isCompleted || isHardCompleted
                  ? 'bg-purple-100/80 dark:bg-[#3b0d47] text-[#2d0938] dark:text-amber-200 border border-amber-400/50 hover:border-amber-400'
                  : 'bg-purple-50/70 dark:bg-[#310a3d] text-[#2d0938] dark:text-purple-100 border border-purple-200/70 dark:border-purple-800/60 hover:bg-amber-400 hover:text-[#2d0938] hover:border-amber-300'
              }`}
            >
              <span className="tabular-nums leading-none">{cell.day}</span>
              {(isCompleted || isHardCompleted) && (
                <div className="mt-0.5 flex items-center gap-0.5">
                  {isCompleted && (
                    <span title="Standard (4 Layers) Solved" className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-400 text-[#2d0938]">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                  {isHardCompleted && (
                    <span title="Hard Mode (6 Layers) Solved" className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-orange-500 text-white text-[8px] font-black">
                      6L
                    </span>
                  )}
                </div>
              )}
              {!isCompleted && !isHardCompleted && isToday && (
                <span className="text-[8px] font-black uppercase tracking-tighter text-amber-600 dark:text-amber-300 leading-none mt-0.5">
                  TODAY
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-purple-100 dark:border-purple-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-purple-200/70">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> 4L Solved
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> 6L Hard Solved
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-slate-200 dark:bg-purple-950 opacity-50 inline-block" /> Unavailable
        </span>
      </div>
    </div>
  );
};

interface ArchiveModalProps {
  setCurrentView: (view: GameState) => void;
  onSelectDate: (dateStr: string) => void;
  stats: GameStats;
  todayDateStr: string;
  selectedDateStr?: string;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  setCurrentView,
  onSelectDate,
  stats,
  todayDateStr,
  selectedDateStr,
}) => {
  return (
    <div className="max-w-xl mx-auto px-4 py-8 w-full">
      <div className="mb-6 text-center sm:text-left">
        <button
          onClick={() => setCurrentView('TITLE')}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#581c6b] dark:text-amber-400 mb-2 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Menu
        </button>
        <h1 className="text-3xl font-black text-[#3b0d47] dark:text-white flex items-center justify-center sm:justify-start gap-3">
          <CalendarIcon className="w-8 h-8 text-amber-500" />
          Archive
        </h1>
        <p className="text-sm text-slate-500 dark:text-purple-200/70">
          Select an available date from the calendar below to play its puzzle.
        </p>
      </div>

      <ArchiveCalendarPicker
        stats={stats}
        todayDateStr={todayDateStr}
        selectedDateStr={selectedDateStr}
        onSelectDate={(dateStr) => {
          onSelectDate(dateStr);
          setCurrentView('PLAYING');
        }}
      />
    </div>
  );
};
