import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  Trophy,
  Calendar,
  Search,
  Play,
  RotateCcw,
  Cloud,
  LogIn,
  X,
  ListFilter,
  LayoutGrid,
  User as UserIcon,
} from 'lucide-react';
import {
  getCleanDisplayName,
  type UnifiedPlayerUser,
  type User,
} from '@/lib/unified-game-auth';
import { UserProfileIcon } from '@/components/user-profile-icon';
import { DailyPuzzle, formatDuration } from '../utils/puzzleGenerator';
import { LocalPuzzleProgress } from '../firebase';

interface ProgressArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  archive: DailyPuzzle[];
  progressMap: Record<string, LocalPuzzleProgress>;
  currentDateKey: string;
  onSelectPuzzle: (dateKey: string) => void;
  onResetPuzzle: (dateKey: string) => void;
  user: UnifiedPlayerUser | User | null;
  onOpenSignIn: () => void;
  onOpenLeaderboard: () => void;
}

type StatusFilter = 'all' | 'completed' | 'in_progress' | 'unplayed';
type ViewMode = 'calendar' | 'list' | 'highscores';

export const ProgressArchiveModal: React.FC<ProgressArchiveModalProps> = ({
  isOpen,
  onClose,
  archive,
  progressMap,
  currentDateKey,
  onSelectPuzzle,
  onResetPuzzle,
  user,
  onOpenSignIn,
  onOpenLeaderboard,
}) => {
  // Unique months in reverse chronological order
  const months = useMemo(() => {
    const map = new Map<string, string>();
    for (let i = archive.length - 1; i >= 0; i--) {
      const p = archive[i];
      if (!map.has(p.monthKey)) {
        map.set(p.monthKey, p.monthLabel);
      }
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [archive]);

  const [selectedMonth, setSelectedMonth] = useState<string>(
    months[0]?.key || ''
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [scoreSort, setScoreSort] = useState<'score' | 'time'>('score');

  // Aggregate Player Progress Statistics across all 184 days
  const stats = useMemo(() => {
    let completedPuzzles = 0;
    let inProgressPuzzles = 0;
    let allTimeHighScore = 0;
    let fastestTime = 0;
    let totalTimeSpent = 0;

    archive.forEach((p) => {
      const rec = progressMap[p.dateKey];
      if (!rec) return;
      totalTimeSpent += rec.elapsedSeconds || 0;
      if (rec.completedCount >= 1) {
        completedPuzzles++;
        if (rec.highScore > allTimeHighScore) {
          allTimeHighScore = rec.highScore;
        }
        if (
          rec.bestTimeSeconds > 0 &&
          (fastestTime === 0 || rec.bestTimeSeconds < fastestTime)
        ) {
          fastestTime = rec.bestTimeSeconds;
        }
      } else if (rec.foundWords.length > 0) {
        inProgressPuzzles++;
      }
    });

    // Compute current completion streak (counting backwards from latest puzzle)
    let streak = 0;
    for (let i = archive.length - 1; i >= 0; i--) {
      const rec = progressMap[archive[i].dateKey];
      if (rec && rec.completedCount >= 1) {
        streak++;
      } else if (i === archive.length - 1) {
        continue;
      } else {
        break;
      }
    }

    const completionRate = Math.round((completedPuzzles / archive.length) * 100);

    return {
      completedPuzzles,
      inProgressPuzzles,
      allTimeHighScore,
      fastestTime,
      totalTimeSpent,
      streak,
      completionRate,
    };
  }, [archive, progressMap]);

  // Filtered puzzles for archive browsing
  const filteredPuzzles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const activeMonthKey = selectedMonth || months[0]?.key || '';
    return archive
      .filter((p) => {
        if (!q && viewMode === 'calendar' && p.monthKey !== activeMonthKey) {
          return false;
        }
        const rec = progressMap[p.dateKey];
        const isCompleted = Boolean(rec && rec.completedCount >= 1);
        const isInProgress = Boolean(rec && !isCompleted && rec.foundWords.length > 0);

        if (statusFilter === 'completed' && !isCompleted) return false;
        if (statusFilter === 'in_progress' && !isInProgress) return false;
        if (statusFilter === 'unplayed' && (isCompleted || isInProgress)) return false;

        if (q) {
          const matchTitle = p.themeTitle.toLowerCase().includes(q);
          const matchCategory = p.category.toLowerCase().includes(q);
          const matchDate = p.displayDate.toLowerCase().includes(q) || p.dateKey.includes(q);
          const matchNum = `#${p.puzzleNumber}`.includes(q) || String(p.puzzleNumber) === q;
          return matchTitle || matchCategory || matchDate || matchNum;
        }
        return true;
      })
      .slice()
      .reverse();
  }, [archive, progressMap, selectedMonth, months, statusFilter, searchQuery, viewMode]);

  // High Scores & Personal Bests list
  const completedRecords = useMemo(() => {
    const list: { puzzle: DailyPuzzle; record: LocalPuzzleProgress }[] = [];
    archive.forEach((p) => {
      const rec = progressMap[p.dateKey];
      if (rec && rec.completedCount >= 1) {
        list.push({ puzzle: p, record: rec });
      }
    });

    list.sort((a, b) => {
      if (scoreSort === 'score') {
        return b.record.highScore - a.record.highScore;
      }
      const tA = a.record.bestTimeSeconds || 999999;
      const tB = b.record.bestTimeSeconds || 999999;
      return tA - tB;
    });

    return list;
  }, [archive, progressMap, scoreSort]);

  if (!isOpen) return null;

  const firstPuzzleDate = archive[0]?.displayDate || '';
  const latestPuzzleDate = archive[archive.length - 1]?.displayDate || '';
  const activeMonthKey = selectedMonth || months[0]?.key || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#12031d]/75 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Progress Tracker and 6-Month Puzzle Archive"
    >
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#FAF6EE] dark:bg-[#1a0529] border-2 border-purple-200 dark:border-amber-400/35 shadow-2xl overflow-hidden">
        {/* Mobile Sheet Handle */}
        <div className="sm:hidden w-10 h-1.5 bg-purple-300 dark:bg-purple-800 rounded-full mx-auto mt-2.5" />

        {/* Header Bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-purple-200/80 dark:border-purple-800/70 bg-white/90 dark:bg-[#220835]/90">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="The Missing Piece"
              className="w-9 h-9 rounded-full object-contain shrink-0 drop-shadow"
            />
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#2B0938] dark:text-white tracking-tight">
                MP Search · 12-Month Archive &amp; Progress
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-purple-200/75 mt-0.5">
                <span>{archive.length} Daily 10×10 Puzzles (8–12 Words)</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>
                  {firstPuzzleDate} – {latestPuzzleDate}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-[#2B0938] hover:bg-purple-100/70 dark:text-purple-200 dark:hover:text-white dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
            aria-label="Close Progress Tracker"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Unified Solo Games Account & Public Leaderboard Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-[#23063A] via-[#340A54] to-[#23063A] border border-[#D4A437]/70 text-[#F5F3F7] shadow-md">
            <div className="flex items-center gap-3">
              {user ? (
                <UserProfileIcon
                  user={user}
                  imgClassName="w-8 h-8 rounded-full object-cover border border-[#F6C915] shrink-0"
                  fallback={<Cloud className="w-5 h-5 text-[#F6C915] shrink-0" />}
                />
              ) : (
                <Cloud className="w-5 h-5 text-[#F6C915] shrink-0" />
              )}
              <div className="text-xs sm:text-sm">
                {user ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-white">
                    <span className="font-extrabold text-[#F6C915]">
                      Unified Solo Account Active
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Signed in as {getCleanDisplayName(user)}</span>
                  </div>
                ) : (
                  <div className="text-[#E2D6EE]">
                    <span className="font-extrabold text-[#F6C915]">
                      Unified Solo Games Account
                    </span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>
                      Sign in with Google or Email &amp; Password to post your MP Search high scores to the public visitor leaderboard.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSignIn();
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-extrabold text-[#1D0830] bg-[#F6C915] hover:bg-[#FFE047] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {user ? (
                  <UserProfileIcon user={user} className="w-4 h-4 shrink-0" />
                ) : (
                  <LogIn className="w-3.5 h-3.5" />
                )}
                <span>{user ? 'Account' : 'Sign In'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLeaderboard();
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold text-[#F6C915] bg-white/10 hover:bg-white/20 border border-[#F6C915]/50 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Public Leaderboards</span>
              </button>
            </div>
          </div>

          {/* 4-Column KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-[#220835] border border-purple-200/80 dark:border-purple-800/70 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500 dark:text-purple-200/75">
                Puzzles Completed
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono tabular-nums text-2xl sm:text-3xl font-black text-[#2B0938] dark:text-white">
                  {stats.completedPuzzles}
                </span>
                <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-purple-200/70">
                  / {archive.length} ({stats.completionRate}%)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#220835] border border-purple-200/80 dark:border-purple-800/70 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500 dark:text-purple-200/75">
                All-Time High Score
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono tabular-nums text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
                  {stats.allTimeHighScore.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 dark:text-purple-200/70">pts</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#220835] border border-purple-200/80 dark:border-purple-800/70 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500 dark:text-purple-200/75">
                Fastest Completion
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono tabular-nums text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {stats.fastestTime > 0 ? formatDuration(stats.fastestTime) : '—'}
                </span>
                <span className="text-xs text-slate-500 dark:text-purple-200/70">min:sec</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#220835] border border-purple-200/80 dark:border-purple-800/70 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500 dark:text-purple-200/75">
                Archive Activity
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono tabular-nums text-2xl sm:text-3xl font-black text-[#2B0938] dark:text-white">
                  {stats.streak}
                </span>
                <span className="text-xs text-slate-500 dark:text-purple-200/70">
                  day streak · {stats.inProgressPuzzles} active
                </span>
              </div>
            </div>
          </div>

          {/* Primary Mode Switcher & Search Filter Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-t border-purple-200/80 dark:border-purple-800/70">
            {/* Segmented View Tabs */}
            <div className="flex items-center gap-1 p-1 bg-purple-100/80 dark:bg-[#2a0940] rounded-xl self-start">
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'calendar'
                    ? 'bg-[#2B0938] text-amber-300 dark:bg-amber-400 dark:text-[#1D0830] shadow-xs'
                    : 'text-[#4a1259] dark:text-purple-200 hover:text-[#2B0938] dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>12-Month Calendar</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#2B0938] text-amber-300 dark:bg-amber-400 dark:text-[#1D0830] shadow-xs'
                    : 'text-[#4a1259] dark:text-purple-200 hover:text-[#2B0938] dark:hover:text-white'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>All {archive.length} List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('highscores')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'highscores'
                    ? 'bg-[#2B0938] text-amber-300 dark:bg-amber-400 dark:text-[#1D0830] shadow-xs'
                    : 'text-[#4a1259] dark:text-purple-200 hover:text-[#2B0938] dark:hover:text-white'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Personal Bests ({completedRecords.length})</span>
              </button>
            </div>

            {/* Filter & Search Row */}
            {viewMode !== 'highscores' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-purple-100/80 dark:bg-[#2a0940] rounded-xl">
                  {(
                    [
                      ['all', 'All'],
                      ['completed', 'Completed'],
                      ['in_progress', 'In Progress'],
                      ['unplayed', 'Unplayed'],
                    ] as [StatusFilter, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStatusFilter(key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        statusFilter === key
                          ? 'bg-white dark:bg-[#1a0529] text-[#2B0938] dark:text-amber-300 shadow-xs'
                          : 'text-[#4a1259] dark:text-purple-200 hover:text-[#2B0938] dark:hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search theme, date, #..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#220835] border border-purple-200 dark:border-purple-700 text-[#2B0938] dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* VIEW 1: HIGH SCORES & FASTEST TIMES TABLE */}
          {viewMode === 'highscores' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs sm:text-sm text-slate-600 dark:text-purple-200/80">
                  Personal best completion times and high scores across solved daily puzzles.
                </p>
                <div className="flex items-center gap-1 p-1 bg-purple-100/80 dark:bg-[#2a0940] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setScoreSort('score')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      scoreSort === 'score'
                        ? 'bg-white dark:bg-[#1a0529] text-[#2B0938] dark:text-amber-300 shadow-xs'
                        : 'text-[#4a1259] dark:text-purple-200'
                    }`}
                  >
                    Sort by High Score
                  </button>
                  <button
                    type="button"
                    onClick={() => setScoreSort('time')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      scoreSort === 'time'
                        ? 'bg-white dark:bg-[#1a0529] text-[#2B0938] dark:text-amber-300 shadow-xs'
                        : 'text-[#4a1259] dark:text-purple-200'
                    }`}
                  >
                    Sort by Fastest Time
                  </button>
                </div>
              </div>

              {completedRecords.length === 0 ? (
                <div className="p-10 text-center rounded-2xl border border-purple-200 dark:border-purple-800 bg-white/70 dark:bg-[#220835]/50">
                  <Trophy className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-80" />
                  <h3 className="text-base font-bold text-[#2B0938] dark:text-white">
                    No Completed Puzzles Yet
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-purple-200/70 mt-1 max-w-md mx-auto">
                    Complete any 10×10 daily word search to record your completion time and high score here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-[#220835]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-purple-200 dark:border-purple-800 bg-purple-50/70 dark:bg-[#2a0940] text-[11px] font-bold text-[#4a1259] dark:text-amber-300">
                        <th className="py-3 px-4">Rank</th>
                        <th className="py-3 px-4">Puzzle &amp; Date</th>
                        <th className="py-3 px-4">Theme</th>
                        <th className="py-3 px-4 text-right">Best Time</th>
                        <th className="py-3 px-4 text-right">High Score</th>
                        <th className="py-3 px-4 text-right">Hints</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100 dark:divide-purple-800/70 text-xs sm:text-sm">
                      {completedRecords.map(({ puzzle, record }, idx) => (
                        <tr
                          key={puzzle.dateKey}
                          className="hover:bg-purple-50/50 dark:hover:bg-purple-900/30 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono tabular-nums font-bold text-slate-500 dark:text-purple-200/75">
                            #{idx + 1}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-[#2B0938] dark:text-white whitespace-nowrap">
                            <span>#{puzzle.puzzleNumber}</span>
                            <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
                            <span>{puzzle.displayDate}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-[#2B0938] dark:text-white">
                              {puzzle.themeTitle}
                            </span>
                            <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
                            <span className="text-xs text-slate-500 dark:text-purple-200/70">
                              {puzzle.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                            {formatDuration(record.bestTimeSeconds || record.elapsedSeconds)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-extrabold text-amber-600 dark:text-amber-400">
                            {record.highScore.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 dark:text-purple-200/70">
                            {record.hintsUsed}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectPuzzle(puzzle.dateKey);
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#2B0938] dark:text-white bg-purple-100 hover:bg-amber-400 hover:text-[#1D0830] dark:bg-purple-900/60 dark:hover:bg-amber-400 dark:hover:text-[#1D0830] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Replay
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2 & 3: 6-MONTH ARCHIVE CALENDAR OR LIST */}
          {viewMode !== 'highscores' && (
            <div className="space-y-4">
              {/* Month Tabs Bar (shown in Calendar mode when not searching) */}
              {viewMode === 'calendar' && !searchQuery.trim() && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {months.map((m) => {
                    const monthPuzzles = archive.filter((p) => p.monthKey === m.key);
                    const solvedInMonth = monthPuzzles.filter(
                      (p) => (progressMap[p.dateKey]?.completedCount || 0) >= 1
                    ).length;

                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setSelectedMonth(m.key)}
                        className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 border cursor-pointer ${
                          activeMonthKey === m.key
                            ? 'bg-[#2B0938] text-amber-300 border-[#2B0938] dark:bg-amber-400 dark:text-[#1D0830] dark:border-amber-400'
                            : 'bg-white text-[#3b0d47] border-purple-200/80 hover:bg-purple-50 dark:bg-[#220835] dark:text-purple-100 dark:border-purple-800 dark:hover:bg-purple-900/50'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5 opacity-80" />
                        <span>{m.label}</span>
                        <span className="font-mono tabular-nums opacity-75">
                          ({solvedInMonth}/{monthPuzzles.length})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Grid of Archive Puzzle Cards */}
              {filteredPuzzles.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-purple-200 dark:border-purple-800 text-sm text-slate-500 dark:text-purple-200/70">
                  No puzzles match your current filter.
                </div>
              ) : viewMode === 'calendar' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredPuzzles.map((p) => {
                    const rec = progressMap[p.dateKey];
                    const isCompleted = Boolean(rec && rec.completedCount >= 1);
                    const isInProgress = Boolean(
                      rec && !isCompleted && rec.foundWords.length > 0
                    );
                    const isCurrent = p.dateKey === currentDateKey;

                    return (
                      <div
                        key={p.dateKey}
                        className={`flex flex-col justify-between p-4 rounded-xl border transition-colors ${
                          isCurrent
                            ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/25'
                            : isCompleted
                            ? 'border-emerald-500/40 bg-emerald-50/25 dark:border-emerald-500/30 dark:bg-emerald-950/15'
                            : 'border-purple-200/80 dark:border-purple-800/70 bg-white dark:bg-[#220835]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-purple-200/75 font-mono tabular-nums">
                            <div>
                              <span className="font-bold text-[#3b0d47] dark:text-amber-300">
                                #{p.puzzleNumber}
                              </span>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>
                                {p.weekdayShort}, {p.displayDate}
                              </span>
                            </div>
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-sans font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Solved</span>
                              </span>
                            ) : isInProgress ? (
                              <span className="text-amber-600 dark:text-amber-400 font-sans font-bold">
                                {rec.foundWords.length}/{p.words.length} Found
                              </span>
                            ) : (
                              <span>Unplayed</span>
                            )}
                          </div>

                          <h3 className="text-base font-extrabold text-[#2B0938] dark:text-white mt-1.5">
                            {p.themeTitle}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-purple-200/70 mt-0.5">
                            {p.category} · 10×10 Grid · {p.words.length} Words
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-purple-100 dark:border-purple-800/70 flex items-center justify-between gap-2">
                          <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-purple-200">
                            {isCompleted ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  {formatDuration(rec.bestTimeSeconds || rec.elapsedSeconds)}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-bold text-amber-600 dark:text-amber-400">
                                  {rec.highScore.toLocaleString()} pts
                                </span>
                              </div>
                            ) : isInProgress ? (
                              <span>Elapsed {formatDuration(rec.elapsedSeconds)}</span>
                            ) : (
                              <span className="text-slate-400 dark:text-purple-300/60">
                                Ready to play
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {(isCompleted || isInProgress) && (
                              <button
                                type="button"
                                onClick={() => onResetPuzzle(p.dateKey)}
                                title="Reset puzzle progress"
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-[#2B0938] hover:bg-purple-100/70 dark:hover:text-white dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
                                aria-label={`Reset puzzle ${p.themeTitle}`}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                onSelectPuzzle(p.dateKey);
                                onClose();
                              }}
                              className="min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-extrabold bg-[#2B0938] text-amber-300 hover:bg-[#3b0d47] dark:bg-amber-400 dark:text-[#1D0830] dark:hover:bg-amber-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>
                                {isCurrent
                                  ? 'Active'
                                  : isCompleted
                                  ? 'Replay'
                                  : isInProgress
                                  ? 'Resume'
                                  : 'Play'}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Ergonomic Interactive Tap List View */
                <div className="divide-y divide-purple-100 dark:divide-purple-800/70 rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-[#220835]">
                  {filteredPuzzles.map((p) => {
                    const rec = progressMap[p.dateKey];
                    const isCompleted = Boolean(rec && rec.completedCount >= 1);
                    const isInProgress = Boolean(
                      rec && !isCompleted && rec.foundWords.length > 0
                    );

                    return (
                      <div
                        key={p.dateKey}
                        className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-purple-50/50 dark:hover:bg-purple-900/30 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-purple-200/75 font-mono tabular-nums">
                            <span className="font-bold text-[#3b0d47] dark:text-amber-300">
                              #{p.puzzleNumber}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{p.displayDate}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-sans">{p.category}</span>
                          </div>
                          <div className="text-sm sm:text-base font-extrabold text-[#2B0938] dark:text-white truncate mt-0.5">
                            {p.themeTitle}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="hidden sm:block text-right font-mono tabular-nums text-xs">
                            {isCompleted ? (
                              <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                                Solved in {formatDuration(rec.bestTimeSeconds || rec.elapsedSeconds)} ·{' '}
                                {rec.highScore.toLocaleString()} pts
                              </div>
                            ) : isInProgress ? (
                              <div className="text-amber-600 dark:text-amber-400 font-bold">
                                {rec.foundWords.length}/{p.words.length} words ·{' '}
                                {formatDuration(rec.elapsedSeconds)}
                              </div>
                            ) : (
                              <div className="text-slate-400">Unplayed</div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              onSelectPuzzle(p.dateKey);
                              onClose();
                            }}
                            className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-extrabold bg-[#2B0938] text-amber-300 hover:bg-[#3b0d47] dark:bg-amber-400 dark:text-[#1D0830] dark:hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {isCompleted ? 'Replay' : isInProgress ? 'Resume' : 'Play'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
