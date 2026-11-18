import React, { useMemo, useState } from 'react';
import { Calendar, Check, ChevronLeft, Play, Search, Star } from 'lucide-react';
import {
  formatDuration,
  formatMonthHeading,
  formatReadableDate,
  generatePuzzleForDate,
  getArchiveDateKeys,
  getTodayDateKey,
} from '../engine/puzzleGenerator';
import type { DailyPuzzle, DifferenceCompletion, PuzzleTheme } from '../types/game';

interface ArchiveModalProps {
  completions: Record<string, DifferenceCompletion>;
  activeDate: string;
  onSelectPuzzle: (dateKey: string) => void;
  onClose: () => void;
}

const THEME_FILTERS: { id: 'all' | PuzzleTheme; label: string }[] = [
  { id: 'all', label: 'All Worlds' },
  { id: 'conservatory', label: 'Conservatory' },
  { id: 'lighthouse', label: 'Lighthouse' },
  { id: 'observatory', label: 'Observatory' },
  { id: 'cafe', label: 'Café Terrace' },
  { id: 'chalet', label: 'Alpine Chalet' },
  { id: 'clockshop', label: 'Clockmaker' },
  { id: 'mesa', label: 'Canyon Mesa' },
  { id: 'jazzrooftop', label: 'Rooftop Jazz' },
];

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  completions,
  activeDate,
  onSelectPuzzle,
  onClose,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'unsolved' | 'solved'>('all');
  const [themeFilter, setThemeFilter] = useState<'all' | PuzzleTheme>('all');
  const [searchText, setSearchText] = useState('');

  const todayKey = getTodayDateKey();

  const allPuzzles = useMemo(() => {
    const keys = getArchiveDateKeys(todayKey);
    return keys.map((dateKey) => generatePuzzleForDate(dateKey, todayKey));
  }, [todayKey]);

  const solvedCount = useMemo(
    () => allPuzzles.filter((p) => Boolean(completions[p.date])).length,
    [allPuzzles, completions]
  );

  const filteredPuzzles = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return allPuzzles.filter((p) => {
      const isSolved = Boolean(completions[p.date]);
      if (statusFilter === 'solved' && !isSolved) return false;
      if (statusFilter === 'unsolved' && isSolved) return false;
      if (themeFilter !== 'all' && p.theme !== themeFilter) return false;
      if (q) {
        const hay = `${p.title} ${p.date} ${p.themeLabel} #${p.issueNumber}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allPuzzles, completions, statusFilter, themeFilter, searchText]);

  const groupedByMonth = useMemo(() => {
    const groups: { monthKey: string; items: DailyPuzzle[] }[] = [];
    const map = new Map<string, DailyPuzzle[]>();
    filteredPuzzles.forEach((p) => {
      const monthKey = p.date.slice(0, 7);
      if (!map.has(monthKey)) {
        const arr: DailyPuzzle[] = [];
        map.set(monthKey, arr);
        groups.push({ monthKey, items: arr });
      }
      map.get(monthKey)!.push(p);
    });
    return groups;
  }, [filteredPuzzles]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5">
      <div className="w-full max-w-6xl h-[90vh] rounded-2xl bg-purple-50 dark:bg-[#160320] border-2 border-purple-200 dark:border-[#D4A437]/50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 flex items-center justify-between gap-4 px-5 sm:px-8 py-4 border-b border-purple-200 dark:border-purple-800/70 bg-white/95 dark:bg-[#1e052b]">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold text-[#3b0d47] dark:text-[#F6C915] bg-purple-100/80 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-black tracking-tight text-[#3b0d47] dark:text-white truncate">
                6-Month Folio Archive
              </h2>
              <p className="text-xs font-semibold text-[#581c6b] dark:text-purple-200/80 truncate">
                {allPuzzles.length} daily editions · {solvedCount} solved
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectPuzzle(todayKey)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-extrabold bg-gradient-to-b from-[#FDE047] to-[#F59E0B] text-[#2d0938] shadow hover:brightness-105 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>Play Today</span>
          </button>
        </header>

        {/* Filter Toolbar */}
        <div className="shrink-0 px-5 sm:px-8 py-3.5 border-b border-purple-200/70 dark:border-purple-900/60 bg-purple-100/50 dark:bg-[#12021a] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-1 rounded-xl bg-white dark:bg-[#240830] border border-purple-200 dark:border-purple-800">
              {(['all', 'unsolved', 'solved'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-[#3b0d47] text-[#F6C915] dark:bg-[#F6C915] dark:text-[#2d0938]'
                      : 'text-slate-600 dark:text-purple-200/80 hover:text-[#3b0d47] dark:hover:text-white'
                  }`}
                >
                  {st === 'all' ? 'All' : st === 'unsolved' ? 'Remaining' : 'Solved'}
                </button>
              ))}
            </div>

            <select
              value={themeFilter}
              onChange={(e) => setThemeFilter(e.target.value as 'all' | PuzzleTheme)}
              aria-label="Filter by illustration world"
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#240830] border border-purple-200 dark:border-purple-800 text-[#3b0d47] dark:text-purple-100 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              {THEME_FILTERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search title, theme, #issue..."
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-[#240830] border border-purple-200 dark:border-purple-800 text-[#3b0d47] dark:text-white placeholder:text-slate-400 dark:placeholder:text-purple-300/50 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Scrollable Grid */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 space-y-8 custom-scrollbar">
          {groupedByMonth.length === 0 ? (
            <div className="text-center py-16 text-[#581c6b] dark:text-purple-200/80 text-sm font-medium">
              No daily editions match your filter.
            </div>
          ) : (
            groupedByMonth.map((group) => (
              <section key={group.monthKey} className="space-y-3">
                <h3 className="text-base sm:text-lg font-extrabold text-[#3b0d47] dark:text-amber-300 border-b border-purple-200 dark:border-purple-800/70 pb-2">
                  {formatMonthHeading(group.monthKey)}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {group.items.map((puzzle) => {
                    const comp = completions[puzzle.date];
                    const isActive = puzzle.date === activeDate;
                    return (
                      <button
                        key={puzzle.date}
                        type="button"
                        onClick={() => onSelectPuzzle(puzzle.date)}
                        className={`text-left group rounded-xl p-4 border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                          isActive
                            ? 'bg-amber-50 dark:bg-[#351058] border-amber-400 shadow-md'
                            : comp
                              ? 'bg-white dark:bg-[#240830] border-emerald-400/70 hover:border-emerald-500 shadow-xs'
                              : 'bg-white dark:bg-[#240830] border-purple-200 dark:border-purple-800/80 hover:border-amber-400 dark:hover:border-amber-400 shadow-xs'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular">
                            <span
                              className={
                                puzzle.isToday
                                  ? 'text-amber-600 dark:text-[#F6C915] font-extrabold'
                                  : 'text-slate-500 dark:text-purple-300/80 font-semibold'
                              }
                            >
                              #{puzzle.issueNumber} · {puzzle.isToday ? 'Today' : formatReadableDate(puzzle.date)}
                            </span>
                            {comp ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                <Check className="w-3.5 h-3.5" />
                                Solved
                              </span>
                            ) : (
                              <span className="text-slate-500 dark:text-purple-300/80 font-semibold">
                                {puzzle.difficulty}
                              </span>
                            )}
                          </div>

                          <div className="text-base font-extrabold text-[#3b0d47] dark:text-white group-hover:text-amber-600 dark:group-hover:text-[#F6C915] transition-colors truncate">
                            {puzzle.title}
                          </div>

                          <div className="text-xs text-slate-600 dark:text-purple-200/75 truncate">
                            {puzzle.themeLabel} · {puzzle.differences.length} diffs
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-purple-100 dark:border-purple-800/60 text-xs">
                          {comp ? (
                            <div className="flex items-center justify-between w-full font-mono-tabular">
                              <span className="text-[#3b0d47] dark:text-white font-bold">
                                {comp.bestScore.toLocaleString()} pts · {formatDuration(comp.bestTimeSeconds)}
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-amber-500">
                                {[1, 2, 3].map((s) => (
                                  <Star
                                    key={s}
                                    className={`w-3.5 h-3.5 ${
                                      s <= comp.stars
                                        ? 'fill-amber-400 text-amber-500'
                                        : 'text-purple-200 dark:text-purple-800'
                                    }`}
                                  />
                                ))}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#581c6b] dark:text-amber-300 font-bold inline-flex items-center gap-1.5 transition-colors">
                              <Play className="w-3.5 h-3.5 fill-current" />
                              Play Edition
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
