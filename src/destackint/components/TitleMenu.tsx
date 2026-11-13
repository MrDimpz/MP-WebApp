import React from 'react';
import {
  Play,
  Calendar,
  Trophy,
  BarChart2,
  Clock,
  Flame,
  Layers,
  Radio,
  LogIn,
  User as UserIcon,
  CheckCircle2,
} from 'lucide-react';
import { GameState, GameStats, DifficultyMode, LayoutMode } from '../types';
import {
  getCleanDisplayName,
  normalizeTikTokHandle,
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
  layoutMode: LayoutMode;
  onChangeLayoutMode: (mode: LayoutMode) => void;
  currentUser?: UnifiedPlayerUser | User | null;
  isLiveConnected: boolean;
  tiktokUsername: string;
  onOpenTikTokModal: () => void;
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
  layoutMode,
  onChangeLayoutMode,
  currentUser,
  isLiveConnected,
  tiktokUsername,
  onOpenTikTokModal,
  onOpenSignIn,
  onOpenUnifiedLeaderboard,
}) => {
  const isTodayNormalDone = !!stats.completedDays[todayDateStr];
  const isTodayHardDone = !!stats.completedHardDays?.[todayDateStr];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[82vh] text-center">
      {/* 3D Emblem Game Logo */}
      <div className="relative mb-4 group">
        <div className="absolute inset-0 rounded-full bg-amber-400/25 blur-2xl group-hover:bg-amber-400/35 transition-all pointer-events-none" />
        <img
          src="/assets/aistudio/3d_logo_944e5372.png"
          alt="DeStack Interactive - The Missing Piece Logo"
          className="relative w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-[0_14px_28px_rgba(59,13,71,0.35)] hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Game Title & Tagline */}
      <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-[#3b0d47] dark:text-white mb-2">
        De<span className="text-amber-500 dark:text-amber-400">Stack</span>{' '}
        <span className="text-2xl sm:text-3xl font-extrabold text-[#581c6b] dark:text-amber-300">
          Interactive
        </span>
      </h1>
      <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.22em] text-[#581c6b] dark:text-amber-300/90 mb-3">
        Interactive TikTok LIVE Edition · Speed Scoreboard · 30s / 45s / 60s Auto-Reveal
      </p>
      <p className="text-sm sm:text-base text-slate-600 dark:text-purple-100/80 max-w-xl mb-5 leading-relaxed">
        Clear the stack of tiles by finding each 5-letter word before the auto-reveal timer runs out! Viewers in TikTok LIVE chat earn speed-based points on the running scoreboard and compete for the Top 5 Podium.
      </p>

      {/* Tile Layout Feature Header & Pill Selector Bar (Placed ABOVE Play buttons) */}
      <div className="w-full max-w-xl mb-5 flex flex-col items-center">
        <div className="text-[11px] font-extrabold text-amber-500 dark:text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" />
          <span>TILE LAYOUT · TODAY'S FEATURE: TWIN TOWERS</span>
        </div>

        <div className="w-full p-2.5 rounded-2xl bg-white/95 dark:bg-[#22072b]/95 border border-purple-200 dark:border-purple-800/60 shadow-sm flex flex-wrap items-center justify-center gap-1.5">
          {(
            [
              { id: 'daily', label: 'Daily Auto' },
              { id: 'pyramid', label: 'Diamond' },
              { id: 'twin_towers', label: 'Towers' },
              { id: 'cross_fortress', label: 'Fortress' },
              { id: 'hourglass', label: 'Hourglass' },
              { id: 'staircase', label: 'Cascade' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeLayoutMode(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border whitespace-nowrap ${
                layoutMode === item.id
                  ? 'bg-[#2d0938] text-white border-[#2d0938] shadow-md'
                  : 'bg-slate-100 dark:bg-purple-950/60 text-slate-700 dark:text-purple-200 border-slate-200 dark:border-purple-800/60 hover:border-amber-400'
              }`}
            >
              {item.label}
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
            {isTodayNormalDone ? 'Host Standard Again' : 'Host Standard (4 Layers)'}
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
            {isTodayHardDone ? 'Host Hard Mode Again' : 'Host Hard Mode (6 Layers)'}
          </span>
          <span className="text-[11px] font-bold opacity-90 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> 6 Layers · 10 Words · 50 Tiles
            {isTodayHardDone && ' ✓'}
          </span>
        </button>
      </div>

      {/* Unified TikTok LIVE & Website Account Banner */}
      <div className="w-full max-w-2xl mb-6 rounded-2xl bg-gradient-to-r from-[#23063A] via-[#340A54] to-[#23063A] border border-[#D4A437]/70 p-4 text-left text-[#F5F3F7] shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/3d_logo_944e5372.png"
            alt="The Missing Piece Emblem"
            className="w-10 h-10 rounded-full object-contain shrink-0 drop-shadow"
          />
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-amber-300 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {isLiveConnected
                  ? `TIKTOK LIVE CONNECTED (@${tiktokUsername})`
                  : 'TIKTOK LIVE BRIDGE · UNIFIED ACCOUNT SYNC'}
              </span>
            </div>
            <div className="text-sm sm:text-base font-extrabold text-white">
              {currentUser
                ? `${getCleanDisplayName(currentUser)}${
                    (currentUser as UnifiedPlayerUser).linkedTikTokHandle
                      ? ` · Linked ${normalizeTikTokHandle((currentUser as UnifiedPlayerUser).linkedTikTokHandle)}`
                      : ''
                  }`
                : 'Connect TikTok LIVE & Link Your Website Account'}
            </div>
            <p className="text-xs text-[#D6CBE2]">
              Viewers who link their TikTok <code>@username</code> automatically receive DeStack Interactive points on their profile.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={onOpenTikTokModal}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-xs transition-all cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isLiveConnected ? `@${tiktokUsername}` : 'Connect TikTok'}</span>
          </button>
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
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-[#F6C915]/50 text-[#F6C915] font-bold text-xs transition-all cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5" />
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
          <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">Scoreboards</h3>
          <p className="text-xs text-slate-500 dark:text-purple-200/70">Live TikTok stream ranks &amp; global leaderboards</p>
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
        <span>30s / 45s / 60s Auto-Reveal Timer</span>
        <span>·</span>
        <span>TikTok LIVE Interactive Scoreboard</span>
      </div>
    </div>
  );
};
