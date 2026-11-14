import React from 'react';
import {
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  LogIn,
  Play,
  Sparkles,
  Trophy,
  User as UserIcon,
} from 'lucide-react';
import {
  getCleanDisplayName,
  type UnifiedPlayerUser,
  type User,
} from '@/lib/unified-game-auth';
import {
  ARCHIVE_DAYS_COUNT,
  formatCountdown,
  formatDisplayDate,
} from '../engine/londonTime';
import { UnolingoPuzzle } from '../engine/puzzleGenerator';
import { GameView, PuzzleProgressRecord, UnolingoStats } from '../types';

interface TitleMenuProps {
  setCurrentView: (view: GameView) => void;
  todayLondonStr: string;
  countdownMs: number;
  todayPuzzle: UnolingoPuzzle;
  progressMap: Record<string, PuzzleProgressRecord>;
  stats: UnolingoStats;
  effectiveStreak: number;
  onSelectDate: (dateStr: string) => void;
  currentUser?: UnifiedPlayerUser | User | null;
  onOpenSignIn: () => void;
  onOpenUnifiedLeaderboard: () => void;
}

export const TitleMenu: React.FC<TitleMenuProps> = ({
  setCurrentView,
  todayLondonStr,
  countdownMs,
  todayPuzzle,
  progressMap,
  stats,
  effectiveStreak,
  onSelectDate,
  currentUser,
  onOpenSignIn,
  onOpenUnifiedLeaderboard,
}) => {
  const todayRecord = progressMap[todayLondonStr];
  const todayStatus = todayRecord?.status;
  const placedCount = todayRecord ? todayRecord.boardLetters.filter(Boolean).length : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10 flex flex-col items-center justify-center min-h-[82vh] text-center">
      {/* Hero Grid: Title Copy + Live 10x10 Board Preview */}
      <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 mb-8">
        <div className="flex flex-col items-center lg:items-start lg:text-left max-w-xl w-full">
          {/* 3D Emblem Game Logo */}
          <div className="relative mb-3 group">
            <div className="absolute inset-0 rounded-full bg-amber-400/25 blur-2xl group-hover:bg-amber-400/35 transition-all pointer-events-none" />
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="Unolingo - The Missing Piece 26-Letter Crossword"
              className="relative w-28 h-28 sm:w-36 sm:h-36 object-contain drop-shadow-[0_14px_28px_rgba(59,13,71,0.35)] hover:scale-105 transition-transform duration-300"
            />
          </div>

          <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-[#3b0d47] dark:text-white mb-2">
            Uno<span className="text-amber-500 dark:text-amber-400">lingo</span>
          </h1>
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.22em] text-[#581c6b] dark:text-amber-300/90 mb-3">
            The Missing Piece · 26-Letter Crossword
          </p>
          <p className="text-sm sm:text-base text-slate-600 dark:text-purple-100/80 mb-5 leading-relaxed">
            Place every letter from <strong>A to Z</strong> exactly once into the 26 blank squares
            of a 10×10 crossword. No written clues — just pure word deduction and intersecting
            anchor tiles.
          </p>

          {/* Compact Metadata Strip */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-3 gap-y-1 text-xs sm:text-sm font-bold text-[#4a1259] dark:text-purple-200 mb-5">
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300 font-mono tabular-nums">
              <Flame className="w-4 h-4 text-amber-500" />
              {effectiveStreak}d Streak
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{stats.totalSolved} Solved</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{ARCHIVE_DAYS_COUNT}-Day Archive</span>
          </div>

          {/* Primary Play CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                onSelectDate(todayLondonStr);
                setCurrentView('PLAYING');
              }}
              className="px-7 py-4 rounded-2xl font-black text-sm sm:text-base bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-[#2d0938] shadow-[0_6px_0_#92400e,0_12px_24px_rgba(234,179,8,0.3)] border border-amber-200 hover:scale-[1.02] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {todayStatus === 'completed'
                  ? "Review Today's Puzzle ✓"
                  : todayStatus === 'in_progress'
                  ? `Continue Today (${placedCount}/26)`
                  : "Play Today's Puzzle"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentView('ARCHIVE')}
              className="px-5 py-4 rounded-2xl font-bold text-sm bg-white/95 dark:bg-[#240930]/95 text-[#3b0d47] dark:text-amber-300 border border-purple-200 dark:border-purple-700/70 hover:border-amber-400 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>Browse Archive</span>
            </button>
          </div>
        </div>

        {/* Interactive Live 10x10 Daily Puzzle Preview */}
        <div className="w-full max-w-[320px] sm:max-w-[360px] flex flex-col items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              onSelectDate(todayLondonStr);
              setCurrentView('PLAYING');
            }}
            aria-label="Open today's 10 by 10 Unolingo board"
            className="w-full aspect-square p-3 bg-[#230633] dark:bg-[#0f0216] rounded-2xl border-2 border-[#4a1259] dark:border-amber-400/40 shadow-[0_20px_48px_rgba(45,9,56,0.38)] hover:scale-[1.02] transition-transform cursor-pointer group"
          >
            <div className="grid grid-cols-10 grid-rows-10 gap-[3px] w-full h-full pointer-events-none">
              {todayPuzzle.layout.map((row, r) =>
                row.map((cell, c) => {
                  const key = `${r},${c}`;
                  if (cell === '#') {
                    return (
                      <div
                        key={key}
                        className="bg-[#12031b] dark:bg-[#07010b] rounded-[4px]"
                      />
                    );
                  }
                  const bIdx = todayPuzzle.blankIndexMap[key];
                  const savedChar =
                    bIdx !== undefined ? todayRecord?.boardLetters?.[bIdx] || '' : '';
                  const given = todayPuzzle.givens[r][c];
                  const display = given || savedChar;

                  return (
                    <div
                      key={key}
                      style={{ '--tile-delay': `${(r + c) * 14}ms` } as React.CSSProperties}
                      className={`puzzle-tile-enter rounded-[4px] sm:rounded-[5px] flex items-center justify-center font-black text-xs sm:text-sm md:text-base ${
                        given
                          ? 'bg-[#f4ebd4] text-[#1e062b]'
                          : savedChar
                          ? 'bg-white text-[#581c6b]'
                          : 'bg-white/95 text-[#581c6b]'
                      }`}
                    >
                      {display}
                    </div>
                  );
                })
              )}
            </div>
          </button>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-purple-200/75">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>
              {formatDisplayDate(todayLondonStr)} · {todayPuzzle.givenCount} Anchor Letters · 26
              Blanks
            </span>
          </div>
        </div>
      </div>

      {/* Unified Solo Games Account & Public Leaderboard Banner */}
      <div className="w-full max-w-3xl mb-6 rounded-2xl bg-gradient-to-r from-[#23063A] via-[#340A54] to-[#23063A] border border-[#D4A437]/70 p-4 text-left text-[#F5F3F7] shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/3d_logo_944e5372.png"
            alt="The Missing Piece Emblem"
            className="w-10 h-10 rounded-full object-contain shrink-0 drop-shadow"
          />
          <div>
            {currentUser ? (
              <>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-300 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>UNIFIED SOLO ACCOUNT ACTIVE</span>
                </div>
                <div className="text-sm sm:text-base font-extrabold text-[#F6C915]">
                  Signed in as {getCleanDisplayName(currentUser)}
                </div>
                <p className="text-xs text-[#D6CBE2]">
                  Your Unolingo scores automatically post to the public visitor leaderboard.
                </p>
              </>
            ) : (
              <>
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#F6C915] font-bold">
                  UNIFIED SOLO GAMES ACCOUNT · PUBLIC LEADERBOARDS
                </div>
                <div className="text-sm sm:text-base font-extrabold text-white">
                  Sign in with Google or Email &amp; Password
                </div>
                <p className="text-xs text-[#D6CBE2]">
                  Use one account across all 6 solo games to record your Unolingo high scores.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={onOpenSignIn}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-extrabold text-xs transition-all cursor-pointer"
          >
            {currentUser ? <UserIcon className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
            <span>{currentUser ? 'Account' : 'Sign In'}</span>
          </button>
          <button
            type="button"
            onClick={onOpenUnifiedLeaderboard}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-[#F6C915]/50 text-[#F6C915] font-bold text-xs transition-all cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>All Leaderboards</span>
          </button>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
        <button
          type="button"
          onClick={() => setCurrentView('ARCHIVE')}
          className="p-5 rounded-2xl bg-white/95 dark:bg-[#240930]/95 backdrop-blur-sm border border-purple-200/80 dark:border-purple-800/60 hover:border-amber-400 dark:hover:border-amber-400 transition-all text-left group shadow-sm hover:shadow-md cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#4a1259]/10 dark:bg-amber-400/15 text-[#4a1259] dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">Archive Calendar</h3>
          <p className="text-xs text-slate-500 dark:text-purple-200/70">
            Play any of the past {ARCHIVE_DAYS_COUNT} daily puzzles
          </p>
        </button>

        <button
          type="button"
          onClick={() => setCurrentView('LEADERBOARD')}
          className="p-5 rounded-2xl bg-white/95 dark:bg-[#240930]/95 backdrop-blur-sm border border-purple-200/80 dark:border-purple-800/60 hover:border-amber-400 dark:hover:border-amber-400 transition-all text-left group shadow-sm hover:shadow-md cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Trophy className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">Public Leaderboard</h3>
          <p className="text-xs text-slate-500 dark:text-purple-200/70">
            Compare live Unolingo scores &amp; personal solve records
          </p>
        </button>

        <button
          type="button"
          onClick={() => setCurrentView('STATS')}
          className="p-5 rounded-2xl bg-white/95 dark:bg-[#240930]/95 backdrop-blur-sm border border-purple-200/80 dark:border-purple-800/60 hover:border-amber-400 dark:hover:border-amber-400 transition-all text-left group shadow-sm hover:shadow-md cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#4a1259]/10 dark:bg-purple-500/20 text-[#4a1259] dark:text-purple-300 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <BarChart2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">Your Statistics</h3>
          <p className="text-xs text-slate-500 dark:text-purple-200/70">
            Streak: {effectiveStreak}d · Longest: {stats.longestStreak}d · Solved:{' '}
            {stats.totalSolved}
          </p>
        </button>
      </div>

      {/* Footer Info */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 dark:text-purple-300/60 font-medium">
        <span className="flex items-center gap-1.5 font-mono tabular-nums">
          <Clock className="w-4 h-4 text-amber-500" /> Next Puzzle in {formatCountdown(countdownMs)}{' '}
          (London)
        </span>
        <span>·</span>
        <span>Every Letter A–Z Placed Once</span>
        <span>·</span>
        <span>Zero Clues · Pure Deduction</span>
      </div>
    </div>
  );
};
