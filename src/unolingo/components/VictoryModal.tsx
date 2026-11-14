import React, { useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Flame,
  Lightbulb,
  LogIn,
  Play,
  Share2,
  Trophy,
  X,
} from 'lucide-react';
import {
  getCleanDisplayName,
  type UnifiedPlayerUser,
  type User,
} from '@/lib/unified-game-auth';
import { formatDisplayDate, formatDuration } from '../engine/londonTime';
import { GameView, UnolingoVictoryData } from '../types';
import { VictoryConfetti } from './VictoryConfetti';

interface VictoryModalProps {
  victoryData: UnolingoVictoryData;
  currentStreak: number;
  setCurrentView: (view: GameView) => void;
  onClose: () => void;
  currentUser?: UnifiedPlayerUser | User | null;
  onOpenSignIn: () => void;
  onOpenUnifiedLeaderboard: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  victoryData,
  currentStreak,
  setCurrentView,
  onClose,
  currentUser,
  onOpenSignIn,
  onOpenUnifiedLeaderboard,
}) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareText = `Unolingo — The Missing Piece (${victoryData.puzzleDate}) Solved!\n⏱️ Time: ${formatDuration(
      victoryData.elapsedSec
    )} · 💡 Hints: ${victoryData.hintsUsed} · ⭐ Score: ${
      victoryData.score
    }\n🔥 Streak: ${currentStreak}d\nPlay Unolingo: ${window.location.origin}/solo-games/unolingo`;

    if (navigator.share) {
      navigator.share({ title: 'Unolingo Score', text: shareText }).catch(() => {});
      return;
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <>
      <VictoryConfetti
        active
        isDaily={Boolean(victoryData.isDailyPuzzle)}
        isNewHighScore={Boolean(victoryData.isNewHighScore)}
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-unolingo-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label="Puzzle Solved"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-[#22072b] border border-purple-200 dark:border-purple-800/80 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl text-center relative overflow-hidden max-h-[92vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Close victory modal"
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-purple-50 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <img
            src="/assets/aistudio/3d_logo_944e5372.png"
            alt="Unolingo Emblem"
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain mx-auto mb-2.5 drop-shadow-xl"
          />

          <h2 className="text-2xl sm:text-3xl font-black text-[#3b0d47] dark:text-white mb-1">
            All 26 Letters Solved!
          </h2>
          <p className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 mb-4">
            {formatDisplayDate(victoryData.puzzleDate)}
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-2.5 mb-4">
            <div className="p-2.5 rounded-2xl bg-purple-50/70 dark:bg-[#310b3e]/70 border border-purple-100 dark:border-purple-800/60">
              <Clock className="w-4 h-4 text-[#581c6b] dark:text-purple-300 mx-auto mb-1" />
              <div className="text-[11px] text-slate-500 dark:text-purple-200/70">Time</div>
              <div className="text-sm sm:text-base font-extrabold text-[#2d0938] dark:text-white font-mono tabular-nums">
                {formatDuration(victoryData.elapsedSec)}
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-purple-50/70 dark:bg-[#310b3e]/70 border border-purple-100 dark:border-purple-800/60">
              <Lightbulb className="w-4 h-4 text-amber-500 mx-auto mb-1" />
              <div className="text-[11px] text-slate-500 dark:text-purple-200/70">Hints</div>
              <div className="text-sm sm:text-base font-extrabold text-[#2d0938] dark:text-white font-mono tabular-nums">
                {victoryData.hintsUsed}
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-purple-50/70 dark:bg-[#310b3e]/70 border border-purple-100 dark:border-purple-800/60">
              <Flame className="w-4 h-4 text-amber-500 mx-auto mb-1" />
              <div className="text-[11px] text-slate-500 dark:text-purple-200/70">Streak</div>
              <div className="text-sm sm:text-base font-extrabold text-[#2d0938] dark:text-white font-mono tabular-nums">
                {currentStreak}d
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-purple-50/70 dark:bg-[#310b3e]/70 border border-purple-100 dark:border-purple-800/60">
              <Trophy className="w-4 h-4 text-amber-500 mx-auto mb-1" />
              <div className="text-[11px] text-slate-500 dark:text-purple-200/70">Score</div>
              <div className="text-sm sm:text-base font-extrabold text-[#2d0938] dark:text-white font-mono tabular-nums">
                {victoryData.score}
              </div>
            </div>
          </div>

          {/* Leaderboard Sync Status */}
          <div className="mb-5 px-3.5 py-2.5 rounded-2xl bg-purple-950/90 text-purple-100 border border-amber-400/40 flex items-center justify-between gap-2 text-left">
            <div className="text-xs">
              {currentUser ? (
                <span className="font-semibold text-emerald-300">
                  ✓ Score posted as <strong>{getCleanDisplayName(currentUser)}</strong>
                </span>
              ) : (
                <span className="text-purple-200">
                  Sign in to post your <strong>{victoryData.score} pts</strong> score publicly
                </span>
              )}
            </div>
            {currentUser ? (
              <button
                type="button"
                onClick={onOpenUnifiedLeaderboard}
                className="px-2.5 py-1 rounded-lg bg-amber-400 text-[#2d0938] font-extrabold text-[11px] shrink-0 cursor-pointer hover:bg-amber-300 transition-colors"
              >
                Leaderboard
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenSignIn}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 text-[#2d0938] font-extrabold text-[11px] shrink-0 cursor-pointer hover:bg-amber-300 transition-colors"
              >
                <LogIn className="w-3 h-3" /> Sign In
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleShare}
              className="w-full py-3 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-[#2d0938] font-black rounded-2xl shadow-[0_5px_0_#92400e] transition-all flex items-center justify-center gap-2 border border-amber-200 cursor-pointer text-sm"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> Copied Score to Clipboard!
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" /> Share Result
                </>
              )}
            </button>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setCurrentView('LEADERBOARD');
                }}
                className="py-2.5 bg-purple-50 dark:bg-[#310b3e] hover:bg-purple-100 dark:hover:bg-purple-900/80 text-[#2d0938] dark:text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-500" /> Ranks
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setCurrentView('ARCHIVE');
                }}
                className="py-2.5 bg-purple-50 dark:bg-[#310b3e] hover:bg-purple-100 dark:hover:bg-purple-900/80 text-[#2d0938] dark:text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-500" /> Archive
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setCurrentView('TITLE');
                }}
                className="py-2.5 bg-purple-50 dark:bg-[#310b3e] hover:bg-purple-100 dark:hover:bg-purple-900/80 text-[#2d0938] dark:text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-amber-500" /> Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
