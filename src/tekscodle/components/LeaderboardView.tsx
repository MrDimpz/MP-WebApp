import React, { useState } from 'react';
import { Award, Crown, Flame, LogIn, Trophy } from 'lucide-react';
import {
  getCleanDisplayName,
  type UnifiedLeaderboardEntry,
  type UnifiedPlayerUser,
} from '@/lib/unified-game-auth';
import { UserProfileIcon } from '@/components/user-profile-icon';
import { TekscodleLocalStats } from '../utils/storage';

interface LeaderboardViewProps {
  user: UnifiedPlayerUser | null;
  stats: TekscodleLocalStats;
  dailyStreak: number;
  entries: UnifiedLeaderboardEntry[];
  todayDate: string;
  onOpenAuth: (tab: 'account' | 'leaderboards') => void;
  onStartPlay: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  user,
  stats,
  dailyStreak,
  entries,
  todayDate,
  onOpenAuth,
  onStartPlay,
}) => {
  const [boardTab, setBoardTab] = useState<'global' | 'recent'>('global');

  const currentUserRank = user
    ? entries.findIndex((row) => row.uid === user.uid) + 1
    : 0;

  return (
    <section className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#581c6b] dark:text-[#F6C915] mb-1">
            The Missing Piece · Checkout Rankings
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#2B0938] dark:text-white text-balance">
            TEKSCOdle Leaderboard
          </h1>
          <p className="text-sm text-slate-600 dark:text-purple-100/80 mt-1.5 max-w-2xl">
            Ranked by your highest 3-round basket score across Express (1 item), Midweek Top-Up (3 items), and The Big Shop (5 items).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenAuth('leaderboards')}
            className="px-4 py-2.5 text-sm font-bold text-[#2B0938] dark:text-[#F6C915] bg-purple-100 dark:bg-purple-900/60 hover:bg-purple-200 dark:hover:bg-purple-800/70 border border-purple-200 dark:border-purple-700/70 rounded-xl transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer"
          >
            <Trophy className="w-4 h-4" />
            <span>All 12 Game Boards</span>
          </button>
          <button
            type="button"
            onClick={onStartPlay}
            className="px-5 py-2.5 text-sm font-extrabold text-[#1D0830] bg-[#F6C915] hover:bg-[#FFE047] rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-sm"
          >
            Play a Basket
          </button>
        </div>
      </div>

      {/* Signed-in Player Stats Bar or Sign-In Prompt */}
      {user ? (
        <div className="bg-white/95 dark:bg-[#220836]/95 border border-purple-200 dark:border-purple-800/80 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-sm">
          <div className="flex items-center gap-3.5 min-w-0">
            <UserProfileIcon
              user={user}
              imgClassName="w-11 h-11 rounded-full object-cover border-2 border-[#F6C915] shrink-0"
              fallback={
                <div className="w-11 h-11 rounded-full bg-[#2B0938] border-2 border-[#F6C915] text-[#F6C915] font-display font-bold text-lg flex items-center justify-center shrink-0">
                  {getCleanDisplayName(user).charAt(0).toUpperCase()}
                </div>
              }
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-[#2B0938] dark:text-white truncate">
                  {getCleanDisplayName(user)}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenAuth('account')}
                  className="text-xs font-bold text-[#581c6b] dark:text-[#F6C915] hover:underline cursor-pointer"
                >
                  Account Settings
                </button>
              </div>
              <div className="text-xs text-slate-500 dark:text-purple-200/75">
                {currentUserRank > 0
                  ? `Currently ranked #${currentUserRank} on the TEKSCOdle leaderboard`
                  : 'Complete a 3-round game to post your score to the public board'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 text-left sm:text-right">
            <div>
              <div className="text-xs text-slate-500 dark:text-purple-200/75">Personal Best</div>
              <div className="font-mono text-lg font-extrabold text-[#2B0938] dark:text-[#F6C915] tabular-nums">
                {stats.bestScore.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-purple-200/75">3-Round Games</div>
              <div className="font-mono text-lg font-bold text-[#2B0938] dark:text-white tabular-nums">
                {stats.gamesPlayed}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-purple-200/75">Quick Plays</div>
              <div className="font-mono text-lg font-bold text-[#2B0938] dark:text-white tabular-nums">
                {stats.quickPlays}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-purple-200/75">Daily Streak</div>
              <div className="font-mono text-lg font-bold text-amber-600 dark:text-[#F6C915] tabular-nums inline-flex items-center gap-1">
                <Flame className="w-4 h-4" />
                {dailyStreak}d
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/95 dark:bg-[#220836]/95 border border-purple-200 dark:border-purple-800/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div>
            <h2 className="font-display text-base font-bold text-[#2B0938] dark:text-white">
              Want your score on the public TEKSCOdle board?
            </h2>
            <p className="text-sm text-slate-600 dark:text-purple-100/80 mt-0.5">
              Sign in with Google or Email &amp; Password to sync your personal bests and compete across all 12 Missing Piece solo games.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenAuth('account')}
            className="px-4 py-2.5 text-sm font-extrabold text-[#1D0830] bg-[#F6C915] hover:bg-[#FFE047] rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In / Create Account</span>
          </button>
        </div>
      )}

      {/* Board Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 bg-purple-100/80 dark:bg-[#220836] border border-purple-200 dark:border-purple-800/70 rounded-xl">
          <button
            type="button"
            onClick={() => setBoardTab('global')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              boardTab === 'global'
                ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                : 'text-slate-600 dark:text-purple-200 hover:text-[#2B0938] dark:hover:text-white'
            }`}
          >
            Public TEKSCOdle Rankings ({entries.length})
          </button>
          <button
            type="button"
            onClick={() => setBoardTab('recent')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              boardTab === 'recent'
                ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                : 'text-slate-600 dark:text-purple-200 hover:text-[#2B0938] dark:hover:text-white'
            }`}
          >
            Your Recent Receipts ({stats.recentRuns.length})
          </button>
        </div>

        <span className="text-xs font-mono text-slate-500 dark:text-purple-200/75">
          Daily Basket Date: {todayDate}
        </span>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white/95 dark:bg-[#220836]/95 border border-purple-200 dark:border-purple-800/80 rounded-2xl overflow-hidden shadow-md">
        {boardTab === 'global' ? (
          entries.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="w-9 h-9 text-purple-300 dark:text-[#F6C915]/60 mx-auto mb-3" />
              <h3 className="font-display text-lg font-bold text-[#2B0938] dark:text-white mb-1">
                No scores posted on TEKSCOdle yet
              </h3>
              <p className="text-sm text-slate-500 dark:text-purple-200/75 mb-5 max-w-sm mx-auto">
                Complete a 3-round Daily Basket or Endless Practice run to claim the #1 checkout spot.
              </p>
              <button
                type="button"
                onClick={onStartPlay}
                className="px-5 py-2.5 text-xs font-extrabold text-[#1D0830] bg-[#F6C915] hover:bg-[#FFE047] rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                Start a Basket
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-purple-200 dark:border-purple-800/80 bg-purple-50/70 dark:bg-[#190529] text-xs font-bold text-slate-500 dark:text-purple-200/75">
                    <th className="py-3.5 pl-6 pr-3 w-16">Rank</th>
                    <th className="py-3.5 px-3">Shopper</th>
                    <th className="py-3.5 px-3">Summary</th>
                    <th className="py-3.5 pl-3 pr-6 text-right">Best Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100 dark:divide-purple-800/60 text-sm">
                  {entries.map((row, idx) => {
                    const rank = idx + 1;
                    const isMe = Boolean(user && row.uid === user.uid);
                    return (
                      <tr
                        key={row.id}
                        className={
                          isMe
                            ? 'bg-amber-50/70 dark:bg-[#351058]/80'
                            : 'hover:bg-purple-50/50 dark:hover:bg-purple-900/25 transition-colors'
                        }
                      >
                        <td className="py-3.5 pl-6 pr-3 font-mono font-bold tabular-nums">
                          {rank === 1 ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-[#F6C915]">
                              <Crown className="w-4 h-4" />1
                            </span>
                          ) : rank <= 3 ? (
                            <span className="inline-flex items-center gap-1 text-[#581c6b] dark:text-amber-300">
                              <Award className="w-4 h-4" />
                              {rank}
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-purple-200/75">#{rank}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-[#2B0938] dark:text-white">
                          <div className="flex items-center gap-2.5">
                            <UserProfileIcon
                              user={{ uid: row.uid, photoURL: row.photoURL }}
                              className="w-6 h-6 shrink-0"
                              fallback={null}
                            />
                            <span className="truncate max-w-[180px]">{row.displayName}</span>
                            {isMe && (
                              <span className="px-1.5 py-0.5 rounded bg-[#F6C915]/20 text-[#581c6b] dark:text-[#F6C915] text-[10px] font-mono font-bold">
                                YOU
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-600 dark:text-purple-200/80">
                          {row.metricLabel}
                        </td>
                        <td className="py-3.5 pl-3 pr-6 text-right font-mono text-base font-extrabold text-[#581c6b] dark:text-[#F6C915] tabular-nums">
                          {row.score.toLocaleString()} pts
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : stats.recentRuns.length === 0 ? (
          <div className="p-12 text-center">
            <Trophy className="w-9 h-9 text-purple-300 dark:text-[#F6C915]/60 mx-auto mb-3" />
            <h3 className="font-display text-lg font-bold text-[#2B0938] dark:text-white mb-1">
              No completed baskets yet
            </h3>
            <p className="text-sm text-slate-500 dark:text-purple-200/75 mb-5 max-w-sm mx-auto">
              Finish a 3-round Daily Basket or Endless Practice run to save your till receipts here.
            </p>
            <button
              type="button"
              onClick={onStartPlay}
              className="px-5 py-2.5 text-xs font-extrabold text-[#1D0830] bg-[#F6C915] hover:bg-[#FFE047] rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              Start a Basket
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-purple-200 dark:border-purple-800/80 bg-purple-50/70 dark:bg-[#190529] text-xs font-bold text-slate-500 dark:text-purple-200/75">
                  <th className="py-3.5 pl-6 pr-3">Date / Mode</th>
                  <th className="py-3.5 px-3">Difficulty</th>
                  <th className="py-3.5 px-3 text-right">1 / 3 / 5 Items</th>
                  <th className="py-3.5 px-3 text-right">Avg Error</th>
                  <th className="py-3.5 pl-3 pr-6 text-right">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-100 dark:divide-purple-800/60 text-sm">
                {stats.recentRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-purple-50/50 dark:hover:bg-purple-900/25">
                    <td className="py-3.5 pl-6 pr-3 font-semibold text-[#2B0938] dark:text-white">
                      <span>{run.date}</span>
                      <span className="ml-2 text-xs font-normal text-slate-500 dark:text-purple-200/75 capitalize">
                        ({run.mode})
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-xs text-slate-600 dark:text-purple-200 capitalize">
                      {run.difficulty}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-xs text-slate-500 dark:text-purple-200/80 tabular-nums">
                      {run.round1Score} / {run.round2Score} / {run.round3Score}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-xs text-slate-700 dark:text-purple-100 tabular-nums">
                      {run.avgErrorPct.toFixed(1)}%
                    </td>
                    <td className="py-3.5 pl-3 pr-6 text-right font-mono text-base font-extrabold text-[#581c6b] dark:text-[#F6C915] tabular-nums">
                      {run.totalScore.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
