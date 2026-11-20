import React, { useState } from 'react';
import { Check, Copy, LogIn, RotateCcw, Trophy, Zap } from 'lucide-react';
import type { UnifiedPlayerUser } from '@/lib/unified-game-auth';
import { Difficulty } from '../data/items';
import {
  DIFFICULTY_CONFIGS,
  RoundResult,
  buildShareSummary,
  formatGBP,
} from '../utils/gameLogic';

interface FinalReceiptViewProps {
  results: RoundResult[];
  difficulty: Difficulty;
  mode: 'daily' | 'practice';
  dailyDate: string;
  user: UnifiedPlayerUser | null;
  postingStatus: 'idle' | 'posting' | 'posted' | 'error';
  isNewBest: boolean;
  onSignInAndPost: () => void;
  onPlayAgain: () => void;
  onQuickPlay: () => void;
  onViewLeaderboard: () => void;
}

export const FinalReceiptView: React.FC<FinalReceiptViewProps> = ({
  results,
  difficulty,
  mode,
  dailyDate,
  user,
  postingStatus,
  isNewBest,
  onSignInAndPost,
  onPlayAgain,
  onQuickPlay,
  onViewLeaderboard,
}) => {
  const [copied, setCopied] = useState(false);
  const cfg = DIFFICULTY_CONFIGS[difficulty];
  const totalScore = results.reduce((sum, r) => sum + r.points, 0);
  const avgErrorPct =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.absErrorPct, 0) / results.length
      : 0;
  const totalActualPence = results.reduce((sum, r) => sum + r.actualTotalPence, 0);
  const totalGuessPence = results.reduce((sum, r) => sum + r.guessPence, 0);

  const handleCopy = () => {
    const text = buildShareSummary(results, difficulty, mode, dailyDate);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Thermal Receipt Card */}
        <div className="lg:col-span-7 bg-white dark:bg-[#220836] border border-purple-200 dark:border-purple-800/80 rounded-t-2xl receipt-serrated shadow-lg">
          <div className="px-6 py-6 border-b border-dashed border-purple-200 dark:border-purple-700/80">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-purple-200/75 mb-1">
              <span>
                {mode === 'daily'
                  ? `Daily Basket · ${dailyDate}`
                  : 'Practice Shop Receipt'}
              </span>
              <span className="font-mono text-[#581c6b] dark:text-[#F6C915] font-semibold">
                {cfg.label} · ±{cfg.marginPct}%
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#2B0938] dark:text-white">
              Checkout Complete
            </h1>
          </div>

          <div className="divide-y divide-dashed divide-purple-100 dark:divide-purple-800/70">
            {results.map((r) => (
              <div key={r.roundNumber} className="px-6 py-4">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <div>
                    <span className="font-display font-bold text-[#2B0938] dark:text-white text-base">
                      Round {r.roundNumber}: {r.title}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-purple-200/75 ml-2">
                      {r.itemCount} {r.itemCount === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <span
                    className={`font-mono font-bold text-base tabular-nums ${
                      r.inZone
                        ? 'text-[#581c6b] dark:text-[#F6C915]'
                        : 'text-slate-400 dark:text-purple-400/50'
                    }`}
                  >
                    +{r.points.toLocaleString()} pts
                  </span>
                </div>

                <div className="space-y-1 mb-2.5">
                  {r.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-xs text-slate-600 dark:text-purple-100/80"
                    >
                      <span className="truncate pr-3">
                        {item.name} ({item.packSize})
                      </span>
                      <span className="font-mono tabular-nums shrink-0 text-slate-800 dark:text-white font-semibold">
                        {formatGBP(item.pricePence)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-purple-100 dark:border-purple-800/60">
                  <span className="font-mono text-slate-600 dark:text-purple-200/80 tabular-nums">
                    Guess {formatGBP(r.guessPence)} vs Actual {formatGBP(r.actualTotalPence)}
                  </span>
                  <span
                    className={`font-semibold ${
                      r.diffPence === 0
                        ? 'text-[#581c6b] dark:text-[#F6C915]'
                        : r.inZone
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {r.ratingLabel} ({r.absErrorPct.toFixed(1)}% off)
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="px-6 py-5 bg-purple-50/70 dark:bg-[#190529] border-t border-dashed border-purple-200 dark:border-purple-700/80 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-purple-200/75">
              <span>Combined Basket Value</span>
              <span className="font-mono tabular-nums text-slate-700 dark:text-purple-100">
                Guessed {formatGBP(totalGuessPence)} / Actual {formatGBP(totalActualPence)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-purple-200/75">
              <span>Average Accuracy Error</span>
              <span className="font-mono font-semibold tabular-nums text-[#2B0938] dark:text-white">
                {avgErrorPct.toFixed(2)}%
              </span>
            </div>
            <div className="pt-2 flex items-baseline justify-between">
              <span className="font-display text-lg font-bold text-[#2B0938] dark:text-white">
                Final Score
              </span>
              <span className="font-mono text-3xl font-extrabold text-[#581c6b] dark:text-[#F6C915] tabular-nums">
                {totalScore.toLocaleString()}
                <span className="text-sm font-medium text-slate-400 dark:text-purple-300/60 ml-1">
                  / {cfg.maxTotalPoints.toLocaleString()}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Action & Leaderboard Sync Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white/95 dark:bg-[#220836]/95 border border-purple-200 dark:border-purple-800/80 rounded-2xl p-6 space-y-4 shadow-md">
            <h2 className="font-display text-lg font-bold text-[#2B0938] dark:text-white">
              Missing Piece Leaderboard Sync
            </h2>
            {!user ? (
              <>
                <p className="text-sm text-slate-600 dark:text-purple-100/80 leading-relaxed">
                  Sign in with Google or Email &amp; Password to submit your{' '}
                  <span className="font-mono font-bold text-[#2B0938] dark:text-[#F6C915]">
                    {totalScore.toLocaleString()} pts
                  </span>{' '}
                  score to the live TEKSCOdle public leaderboard.
                </p>
                <button
                  type="button"
                  onClick={onSignInAndPost}
                  className="w-full py-3 px-4 bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-extrabold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-sm"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In &amp; Post Score</span>
                </button>
              </>
            ) : postingStatus === 'posting' ? (
              <p className="text-sm text-slate-600 dark:text-purple-200">
                Saving your checkout score to the leaderboard...
              </p>
            ) : postingStatus === 'error' ? (
              <p className="text-sm text-rose-600 dark:text-rose-400">
                Could not sync remotely right now. Your receipt &amp; local score are saved below.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {isNewBest
                    ? 'New Personal Best recorded on the TEKSCOdle leaderboard!'
                    : 'Run synced to your Missing Piece shopper profile.'}
                </p>
                {mode === 'daily' && (
                  <p className="text-xs text-slate-600 dark:text-purple-200/80">
                    Daily Basket ({dailyDate}) completion recorded toward your TEKSCOdle Daily Streak.
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onViewLeaderboard}
              className="w-full py-2.5 px-4 bg-purple-50 dark:bg-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-800/70 text-[#2B0938] dark:text-[#F6C915] border border-purple-200 dark:border-purple-700/70 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Trophy className="w-4 h-4" />
              <span>View Public Leaderboard</span>
            </button>
          </div>

          <div className="bg-white/95 dark:bg-[#220836]/95 border border-purple-200 dark:border-purple-800/80 rounded-2xl p-6 space-y-3 shadow-md">
            <button
              type="button"
              onClick={handleCopy}
              className="w-full py-2.5 px-4 bg-white dark:bg-purple-950/60 hover:bg-purple-50 dark:hover:bg-purple-900/60 text-[#2B0938] dark:text-white border border-purple-200 dark:border-purple-700/70 font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Receipt Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Shareable Receipt</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onPlayAgain}
              className="w-full py-3 px-4 bg-[#2B0938] dark:bg-purple-800/80 hover:bg-[#3B0F54] dark:hover:bg-purple-700 text-[#F6C915] font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Endless Practice</span>
            </button>

            <button
              type="button"
              onClick={onQuickPlay}
              className="w-full py-2.5 px-4 bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-extrabold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>Quick Play Round</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
