import React from 'react';
import { BarChart2, ArrowLeft, Trophy, Flame, CheckCircle2, Clock, Lightbulb } from 'lucide-react';
import { GameState, GameStats } from '../types';

interface StatsModalProps {
  setCurrentView: (view: GameState) => void;
  stats: GameStats;
}

export const StatsModal: React.FC<StatsModalProps> = ({ setCurrentView, stats }) => {
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => setCurrentView('TITLE')}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#581c6b] dark:text-amber-400 mb-2 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Menu
        </button>
        <h1 className="text-3xl font-black text-[#3b0d47] dark:text-white flex items-center gap-3">
          <BarChart2 className="w-8 h-8 text-amber-500" />
          Player Statistics
        </h1>
        <p className="text-sm text-slate-500 dark:text-purple-200/70">
          Your DeStack performance metrics and daily puzzle progress.
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#240930] border border-purple-200/80 dark:border-purple-800/60 text-center shadow-sm">
          <CheckCircle2 className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <div className="text-2xl sm:text-3xl font-black text-[#2d0938] dark:text-white font-mono tabular-nums">{stats.gamesWon}</div>
          <div className="text-xs text-slate-500 dark:text-purple-200/70 font-medium">Puzzles Solved</div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#240930] border border-purple-200/80 dark:border-purple-800/60 text-center shadow-sm">
          <Flame className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <div className="text-2xl sm:text-3xl font-black text-[#2d0938] dark:text-white font-mono tabular-nums">{stats.currentStreak}</div>
          <div className="text-xs text-slate-500 dark:text-purple-200/70 font-medium">Current Streak</div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#240930] border border-purple-200/80 dark:border-purple-800/60 text-center shadow-sm">
          <Trophy className="w-6 h-6 text-[#581c6b] dark:text-amber-400 mx-auto mb-2" />
          <div className="text-2xl sm:text-3xl font-black text-[#2d0938] dark:text-white font-mono tabular-nums">{winRate}%</div>
          <div className="text-xs text-slate-500 dark:text-purple-200/70 font-medium">Win Rate</div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#240930] border border-purple-200/80 dark:border-purple-800/60 text-center shadow-sm">
          <Clock className="w-6 h-6 text-[#581c6b] dark:text-purple-300 mx-auto mb-2" />
          <div className="text-2xl sm:text-3xl font-black text-[#2d0938] dark:text-white font-mono tabular-nums">
            {stats.bestTimeSeconds === 9999 ? '—' : `${stats.bestTimeSeconds}s`}
          </div>
          <div className="text-xs text-slate-500 dark:text-purple-200/70 font-medium">Best Time</div>
        </div>
      </div>

      {/* Secondary Details */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#240930] border border-purple-200/80 dark:border-purple-800/60 shadow-xl space-y-4">
        <h3 className="font-bold text-[#2d0938] dark:text-white text-lg mb-2">Performance Summary</h3>
        <div className="flex items-center justify-between py-3 border-b border-purple-100 dark:border-purple-800/60">
          <span className="text-sm text-slate-600 dark:text-purple-200/75">Max Win Streak</span>
          <span className="font-bold text-[#2d0938] dark:text-white font-mono tabular-nums">{stats.maxStreak} days</span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-purple-100 dark:border-purple-800/60">
          <span className="text-sm text-slate-600 dark:text-purple-200/75">Total Hints Used</span>
          <span className="font-bold text-[#2d0938] dark:text-white font-mono tabular-nums flex items-center gap-1">
            <Lightbulb className="w-4 h-4 text-amber-500" /> {stats.totalHintsUsed}
          </span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-slate-600 dark:text-purple-200/75">Total Games Played</span>
          <span className="font-bold text-[#2d0938] dark:text-white font-mono tabular-nums">{stats.gamesPlayed}</span>
        </div>
      </div>
    </div>
  );
};
