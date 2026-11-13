import React, { useState } from 'react';
import { Trophy, ArrowLeft, User as UserIcon, Globe, Award, LogIn, Flame, Layers } from 'lucide-react';
import { GameState, GameStats } from '../types';
import { UnifiedLeaderboardPanel } from '@/components/solo-games/unified-auth-modal';
import {
  getCleanDisplayName,
  type UnifiedPlayerUser,
  type User,
} from '@/lib/unified-game-auth';

interface LeaderboardModalProps {
  setCurrentView: (view: GameState) => void;
  stats: GameStats;
  currentUser?: UnifiedPlayerUser | User | null;
  onOpenSignIn: () => void;
  onOpenUnifiedLeaderboard: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  setCurrentView,
  stats,
  currentUser,
  onOpenSignIn,
}) => {
  const [tab, setTab] = useState<'global' | 'local'>('global');

  const normalEntries = Object.entries(stats.completedDays || {}).map(([date, data]) => ({
    id: `${date}_normal`,
    date,
    modeLabel: 'Standard (4 Layers)',
    isHard: false,
    ...data,
  }));

  const hardEntries = Object.entries(stats.completedHardDays || {}).map(([date, data]) => ({
    id: `${date}_hard`,
    date,
    modeLabel: 'Hard Mode (6 Layers)',
    isHard: true,
    ...data,
  }));

  const completedEntries = [...normalEntries, ...hardEntries].sort((a, b) => b.score - a.score);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => setCurrentView('TITLE')}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#581c6b] dark:text-amber-400 mb-2 hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Menu
          </button>
          <h1 className="text-3xl font-black text-[#3b0d47] dark:text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-500" />
            Leaderboard &amp; High Scores
          </h1>
          <p className="text-sm text-slate-500 dark:text-purple-200/70">
            Live public Solo Games leaderboard and your personal DeStack history.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Account / Sign In Button */}
          <button
            type="button"
            onClick={onOpenSignIn}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2d0938] text-amber-300 border border-amber-400/40 text-xs font-bold hover:bg-[#3b0d47] transition-colors cursor-pointer"
          >
            {currentUser ? <UserIcon className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
            <span>{currentUser ? getCleanDisplayName(currentUser) : 'Sign In / Account'}</span>
          </button>

          {/* Tab Switcher */}
          <div className="flex items-center p-1 bg-purple-100/70 dark:bg-[#240930] rounded-xl border border-purple-200 dark:border-purple-800">
            <button
              onClick={() => setTab('global')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                tab === 'global'
                  ? 'bg-white dark:bg-[#3b0d47] text-[#2d0938] dark:text-amber-300 shadow-sm'
                  : 'text-slate-600 dark:text-purple-200/70 hover:text-[#2d0938]'
              }`}
            >
              <Globe className="w-4 h-4 text-amber-500" /> Public Leaderboard
            </button>
            <button
              onClick={() => setTab('local')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                tab === 'local'
                  ? 'bg-white dark:bg-[#3b0d47] text-[#2d0938] dark:text-amber-300 shadow-sm'
                  : 'text-slate-600 dark:text-purple-200/70 hover:text-[#2d0938]'
              }`}
            >
              <UserIcon className="w-4 h-4 text-amber-500" /> Your Records ({completedEntries.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {tab === 'global' ? (
        <div className="rounded-3xl bg-gradient-to-b from-[#23063A] to-[#160324] border-2 border-[#D4A437]/70 p-5 sm:p-6 shadow-2xl text-white">
          <UnifiedLeaderboardPanel
            initialGameId="destack"
            currentUser={currentUser}
            onRequestSignIn={onOpenSignIn}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-[#240930] border border-purple-200/80 dark:border-purple-800/70 rounded-3xl overflow-hidden shadow-xl">
          {completedEntries.length === 0 ? (
            <div className="p-12 text-center">
              <Award className="w-12 h-12 text-purple-300 dark:text-purple-700 mx-auto mb-3" />
              <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">No Puzzles Completed Yet</h3>
              <p className="text-xs text-slate-500 dark:text-purple-200/70">
                Play and solve daily Standard or Hard Mode puzzles to populate your personal records!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-purple-100 dark:divide-purple-800/60">
              {completedEntries.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="p-4 sm:p-5 flex items-center justify-between hover:bg-purple-50/50 dark:hover:bg-purple-900/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-[#4a1259] dark:text-amber-300 flex items-center justify-center font-bold font-mono">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="font-bold text-[#2d0938] dark:text-white flex items-center gap-2">
                        <span>Puzzle Date: {entry.date}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            entry.isHard
                              ? 'bg-orange-500/15 text-orange-600 dark:text-amber-300 border border-orange-400/30'
                              : 'bg-purple-100 dark:bg-purple-900/50 text-[#4a1259] dark:text-purple-200'
                          }`}
                        >
                          {entry.isHard ? <Flame className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                          {entry.modeLabel}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 dark:text-purple-300/60 font-mono mt-0.5">
                        Hints used: {entry.hintsUsed}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-extrabold text-[#4a1259] dark:text-amber-400 font-mono tabular-nums text-lg">
                      {entry.score} pts
                    </div>
                    <div className="text-xs text-slate-400 dark:text-purple-300/60 font-mono tabular-nums">
                      ⏱️ {entry.timeSeconds}s
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
