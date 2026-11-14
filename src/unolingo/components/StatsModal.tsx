import React from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  Clock,
  Flame,
  Lightbulb,
  Trophy,
} from 'lucide-react';
import { formatDuration } from '../engine/londonTime';
import { GameView, PuzzleProgressRecord, UnolingoStats } from '../types';

interface StatsModalProps {
  setCurrentView: (view: GameView) => void;
  stats: UnolingoStats;
  effectiveStreak: number;
  progressMap: Record<string, PuzzleProgressRecord>;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  setCurrentView,
  stats,
  effectiveStreak,
  progressMap,
}) => {
  const allRecords = Object.values(progressMap);
  const completedCount = allRecords.filter((r) => r.status === 'completed').length;
  const inProgressCount = allRecords.filter((r) => r.status === 'in_progress').length;
  const avgTimeSec =
    completedCount > 0
      ? Math.round(
          allRecords
            .filter((r) => r.status === 'completed')
            .reduce((acc, r) => acc + r.elapsedSec, 0) / completedCount
        )
      : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full">
      {/* Header */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => setCurrentView('TITLE')}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#581c6b] dark:text-amber-400 mb-2 hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Menu
        </button>
        <h1 className="text-3xl font-black text-[#3b0d47] dark:text-white flex items-center gap-3">
          <BarChart2 className="w-8 h-8 text-amber-500" />
          Player Statistics
        </h1>
        <p className="text-sm text-slate-500 dark:text-purple-200/70">
          Your Unolingo solving speed, daily streak consistency, and archive progress.
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#240930] border border-purple-200/80 dark:border-purple-800/60 text-center shadow-sm">
          <CheckCircle2 className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <div className="text-2xl sm:text-3xl font-black text-[#2d0938] dark:text-white font-mono tabular-nums">
            {stats.totalSolved}
          </div>
          <div className="text-xs text-slate-500 dark:text-purple-200/70 font-medium">
            Puzzles Solved
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#240930] border border-purple-200/80 dark:border-purple-800/60 text-center shadow-sm">
          <Flame className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <div className="text-2xl sm:text-3xl font-black text-[#2d0938] dark:text-white font-mono tabular-nums">
            {effectiveStreak}
          </div>
          <div className="text-xs text-slate-500 dark:text-purple-200/70 font-medium">
            Current Streak
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#240930] border border-purple-200/80 dark:border-purple-800/60 text-center shadow-sm">
          <Trophy className="w-6 h-6 text-[#581c6b] dark:text-amber-400 mx-auto mb-2" />
          <div className="text-2xl sm:text-3xl font-black text-[#2d0938] dark:text-white font-mono tabular-nums">
            {stats.longestStreak}
          </div>
          <div className="text-xs text-slate-500 dark:text-purple-200/70 font-medium">
            Longest Streak
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#240930] border border-purple-200/80 dark:border-purple-800/60 text-center shadow-sm">
          <Clock className="w-6 h-6 text-[#581c6b] dark:text-purple-300 mx-auto mb-2" />
          <div className="text-2xl sm:text-3xl font-black text-[#2d0938] dark:text-white font-mono tabular-nums">
            {stats.bestTimeSec > 0 ? formatDuration(stats.bestTimeSec) : '—'}
          </div>
          <div className="text-xs text-slate-500 dark:text-purple-200/70 font-medium">
            Best Solve Time
          </div>
        </div>
      </div>

      {/* Secondary Details */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#240930] border border-purple-200/80 dark:border-purple-800/60 shadow-xl space-y-4">
        <h3 className="font-bold text-[#2d0938] dark:text-white text-lg mb-2">
          Performance Summary
        </h3>
        <div className="flex items-center justify-between py-3 border-b border-purple-100 dark:border-purple-800/60">
          <span className="text-sm text-slate-600 dark:text-purple-200/75">Average Solve Time</span>
          <span className="font-bold text-[#2d0938] dark:text-white font-mono tabular-nums">
            {avgTimeSec > 0 ? formatDuration(avgTimeSec) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-purple-100 dark:border-purple-800/60">
          <span className="text-sm text-slate-600 dark:text-purple-200/75">Total Hints Used</span>
          <span className="font-bold text-[#2d0938] dark:text-white font-mono tabular-nums flex items-center gap-1">
            <Lightbulb className="w-4 h-4 text-amber-500" /> {stats.totalHintsUsed}
          </span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-purple-100 dark:border-purple-800/60">
          <span className="text-sm text-slate-600 dark:text-purple-200/75">
            Checks / Mistakes Logged
          </span>
          <span className="font-bold text-[#2d0938] dark:text-white font-mono tabular-nums flex items-center gap-1">
            <AlertCircle className="w-4 h-4 text-rose-500" /> {stats.totalMistakes}
          </span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-slate-600 dark:text-purple-200/75">
            Archive Puzzles In Progress
          </span>
          <span className="font-bold text-[#2d0938] dark:text-white font-mono tabular-nums">
            {inProgressCount}
          </span>
        </div>
      </div>
    </div>
  );
};
