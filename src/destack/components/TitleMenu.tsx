import React from 'react';
import {
  Play,
  Calendar,
  Trophy,
  BarChart2,
  Clock,
  Flame,
  Layers,
  LayoutGrid,
  LogIn,
  User as UserIcon,
  CheckCircle2,
} from 'lucide-react';
import { GameState, GameStats, DifficultyMode, LayoutSelection } from '../types';
import { TILE_LAYOUTS, getDailyLayoutForDate } from '../utils/puzzles';
import {
  getCleanDisplayName,
  type UnifiedPlayerUser,
  type User,
} from '@/lib/unified-game-auth';

interface TitleMenuProps {
  setCurrentView: (view: GameState) => void;
  todayDateStr: string;
  stats: GameStats;
  onSelectDate: (dateStr: string) => void;
  difficulty: DifficultyMode;
  onSelectDifficulty: (mode: DifficultyMode) => void;
  layoutSelection: LayoutSelection;
  onSelectLayout: (layout: LayoutSelection) => void;
  currentUser?: UnifiedPlayerUser | User | null;
  onOpenSignIn: () => void;
  onOpenUnifiedLeaderboard: () => void;
}

export const TitleMenu: React.FC<TitleMenuProps> = ({
  setCurrentView,
  todayDateStr,
  stats,
  onSelectDate,
  difficulty,
  onSelectDifficulty,
  layoutSelection,
  onSelectLayout,
  currentUser,
  onOpenSignIn,
  onOpenUnifiedLeaderboard,
}) => {
  const isTodayNormalDone = !!stats.completedDays[todayDateStr];
  const isTodayHardDone = !!stats.completedHardDays?.[todayDateStr];
  const todayAutoLayoutId = getDailyLayoutForDate(todayDateStr);
  const todayAutoLayout = TILE_LAYOUTS.find((l) => l.id === todayAutoLayoutId) || TILE_LAYOUTS[0];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-10 flex flex-col items-center justify-center min-h-[82vh] text-center">
      {/* 3D Emblem Game Logo */}
      <div className="relative mb-4 group">
        <div className="absolute inset-0 rounded-full bg-amber-400/25 blur-2xl group-hover:bg-amber-400/35 transition-all pointer-events-none" />
        <img
          src="/assets/aistudio/3d_logo_944e5372.png"
          alt="DeStack - The Missing Piece Find Your Space Logo"
          className="relative w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-[0_14px_28px_rgba(59,13,71,0.35)] hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Game Title & Tagline */}
      <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-[#3b0d47] dark:text-white mb-2">
        De<span className="text-amber-500 dark:text-amber-400">Stack</span>
      </h1>
      <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.22em] text-[#581c6b] dark:text-amber-300/90 mb-3">
        The Missing Piece · Find Your Space
      </p>
      <p className="text-sm sm:text-base text-slate-600 dark:text-purple-100/80 max-w-xl mb-5 leading-relaxed">
        Clear the stack of tiles by finding each of the 5-letter words in order. Every day rotates through unique multi-layer tile formations.
      </p>

      {/* Tile Layout Picker */}
      <div className="mb-6 w-full max-w-xl">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-purple-200/70 mb-2 flex items-center justify-center gap-1.5">
          <LayoutGrid className="w-3.5 h-3.5 text-amber-500" />
          Tile Layout · Today's Feature:{' '}
          <span className="text-[#3b0d47] dark:text-amber-300 font-extrabold">
            {todayAutoLayout.name}
          </span>
        </div>
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 p-1.5 rounded-2xl bg-white/90 dark:bg-[#240930]/90 border border-purple-200 dark:border-purple-800/70 shadow-sm">
          <button
            type="button"
            onClick={() => onSelectLayout('daily')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              layoutSelection === 'daily'
                ? 'bg-[#3b0d47] dark:bg-amber-400 text-amber-300 dark:text-[#2d0938] shadow-sm'
                : 'text-slate-600 dark:text-purple-200/80 hover:bg-purple-50 dark:hover:bg-purple-900/40'
            }`}
          >
            Daily Auto
          </button>
          {TILE_LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              type="button"
              onClick={() => onSelectLayout(layout.id)}
              title={layout.description}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                layoutSelection === layout.id
                  ? 'bg-[#3b0d47] dark:bg-amber-400 text-amber-300 dark:text-[#2d0938] shadow-sm'
                  : 'text-slate-600 dark:text-purple-200/80 hover:bg-purple-50 dark:hover:bg-purple-900/40'
              }`}
            >
              {layout.shortName}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty Selector & Primary Start CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 w-full max-w-xl justify-center">
        {/* Standard 4-Layer Mode Button */}
        <button
          onClick={() => {
            onSelectDate(todayDateStr);
            onSelectDifficulty('normal');
            setCurrentView('PLAYING');
          }}
          className={`w-full sm:w-1/2 px-6 py-4 rounded-2xl font-black text-sm sm:text-base transition-all flex flex-col items-center justify-center gap-1 group cursor-pointer border ${
            difficulty === 'normal'
              ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-[#2d0938] shadow-[0_6px_0_#92400e,0_12px_24px_rgba(234,179,8,0.3)] border-amber-200 hover:scale-[1.02]'
              : 'bg-white/95 dark:bg-[#240930]/95 text-[#2d0938] dark:text-white border-purple-200 dark:border-purple-800 hover:border-amber-400 shadow-md'
          }`}
        >
          <span className="flex items-center gap-2">
            <Play className="w-4 h-4 fill-current" />
            {isTodayNormalDone ? 'Play Standard Again' : 'Play Standard'}
          </span>
          <span className="text-[11px] font-bold opacity-80 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> 4 Layers · 6 Words · 30 Tiles
            {isTodayNormalDone && ' ✓'}
          </span>
        </button>

        {/* Hard Mode (6 Layers) Button */}
        <button
          onClick={() => {
            onSelectDate(todayDateStr);
            onSelectDifficulty('hard');
            setCurrentView('PLAYING');
          }}
          className={`w-full sm:w-1/2 px-6 py-4 rounded-2xl font-black text-sm sm:text-base transition-all flex flex-col items-center justify-center gap-1 group cursor-pointer border ${
            difficulty === 'hard'
              ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 text-[#2d0938] shadow-[0_6px_0_#92400e,0_12px_24px_rgba(234,179,8,0.3)] border-amber-200 hover:scale-[1.02]'
              : 'bg-[#3b0d47] dark:bg-[#310a3d] text-amber-300 border-amber-400/50 hover:border-amber-400 shadow-[0_6px_0_#1e0526] hover:scale-[1.02]'
          }`}
        >
          <span className="flex items-center gap-2">
            <Flame className="w-4 h-4 fill-current" />
            {isTodayHardDone ? 'Play Hard Mode Again' : 'Play Hard Mode'}
          </span>
          <span className="text-[11px] font-bold opacity-90 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> 6 Layers · 10 Words · 50 Tiles
            {isTodayHardDone && ' ✓'}
          </span>
        </button>
      </div>

      {/* Unified Solo Games Account & Public Leaderboard Banner */}
      <div className="w-full max-w-2xl mb-6 rounded-2xl bg-gradient-to-r from-[#23063A] via-[#340A54] to-[#23063A] border border-[#D4A437]/70 p-4 text-left text-[#F5F3F7] shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                  Your DeStack scores automatically post to the public visitor leaderboard.
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
                  Use one account across all 5 solo games to record your DeStack high scores.
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        <button
          onClick={() => setCurrentView('ARCHIVE')}
          className="p-5 rounded-2xl bg-white/95 dark:bg-[#240930]/95 backdrop-blur-sm border border-purple-200/80 dark:border-purple-800/60 hover:border-amber-400 dark:hover:border-amber-400 transition-all text-left group shadow-sm hover:shadow-md cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#4a1259]/10 dark:bg-amber-400/15 text-[#4a1259] dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">Archive</h3>
          <p className="text-xs text-slate-500 dark:text-purple-200/70">Pick any available date from the calendar</p>
        </button>

        <button
          onClick={() => setCurrentView('LEADERBOARD')}
          className="p-5 rounded-2xl bg-white/95 dark:bg-[#240930]/95 backdrop-blur-sm border border-purple-200/80 dark:border-purple-800/60 hover:border-amber-400 dark:hover:border-amber-400 transition-all text-left group shadow-sm hover:shadow-md cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Trophy className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">Public Leaderboard</h3>
          <p className="text-xs text-slate-500 dark:text-purple-200/70">Compare live DeStack scores &amp; personal records</p>
        </button>

        <button
          onClick={() => setCurrentView('STATS')}
          className="p-5 rounded-2xl bg-white/95 dark:bg-[#240930]/95 backdrop-blur-sm border border-purple-200/80 dark:border-purple-800/60 hover:border-amber-400 dark:hover:border-amber-400 transition-all text-left group shadow-sm hover:shadow-md cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#4a1259]/10 dark:bg-purple-500/20 text-[#4a1259] dark:text-purple-300 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <BarChart2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">Your Statistics</h3>
          <p className="text-xs text-slate-500 dark:text-purple-200/70">
            Streak: {stats.currentStreak} days · Win Rate: {stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0}%
          </p>
        </button>
      </div>

      {/* Footer Info */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 dark:text-purple-300/60">
        <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-500" /> Daily Reset at 00:00 London, UK</span>
        <span>·</span>
        <span>5 Distinct Tile Layouts</span>
        <span>·</span>
        <span>4-Layer Standard &amp; 6-Layer Hard Mode</span>
      </div>
    </div>
  );
};
