import React from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  Calendar,
  HelpCircle,
  LogIn,
  Moon,
  Sparkles,
  Sun,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import { UserProfileIcon } from '@/components/user-profile-icon';
import { getCleanDisplayName, type UnifiedPlayerUser } from '@/lib/unified-game-auth';
import { GameMode, MODE_CONFIGS } from '../game/types';

interface HeaderProps {
  activeMode: GameMode;
  darkMode: boolean;
  soundEnabled: boolean;
  user: UnifiedPlayerUser | null;
  dailyStreak: { solvedToday: boolean; streak: number };
  isViewingPastArchive?: boolean;
  onSelectMode: (mode: GameMode) => void;
  onNewPuzzle: () => void;
  onOpenArchive: () => void;
  onOpenHowToPlay: () => void;
  onToggleDarkMode: () => void;
  onToggleSound: () => void;
  onOpenLeaderboard: () => void;
  onOpenAccount: () => void;
}

const MODES: GameMode[] = ['daily', 'mini', 'classic', 'master'];

export const Header: React.FC<HeaderProps> = ({
  activeMode,
  darkMode,
  soundEnabled,
  user,
  dailyStreak,
  isViewingPastArchive = false,
  onSelectMode,
  onNewPuzzle,
  onOpenArchive,
  onOpenHowToPlay,
  onToggleDarkMode,
  onToggleSound,
  onOpenLeaderboard,
  onOpenAccount,
}) => {
  return (
    <header
      className={`w-full border-b transition-colors ${
        darkMode
          ? 'border-[#D4A437]/40 bg-[#1B052C]/95 text-[#FAF7FF]'
          : 'border-[#D4A437]/50 bg-[#FFFFFF]/95 text-[#220636]'
      } backdrop-blur-md`}
    >
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-3 px-3 py-2 sm:px-6">
        {/* Left: Back to Solo Games & Brand Lockup */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          <Link
            to="/solo-games"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
              darkMode
                ? 'border-[#D4A437]/45 bg-[#2B0944] text-[#F6C915] hover:bg-[#380C59]'
                : 'border-[#D4A437]/60 bg-[#2B0938] text-[#F6C915] hover:bg-[#3D0D52]'
            }`}
            title="Back to Solo Games"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Solo Games</span>
          </Link>

          <button
            type="button"
            onClick={() => onSelectMode('master')}
            className="flex items-center gap-2.5 text-left cursor-pointer shrink-0"
          >
            <img
              src="/brand-logo.png"
              alt="The Missing Piece"
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-full border border-[#F6C915] object-contain shadow-sm shrink-0 bg-[#1D0830]"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`font-display text-lg sm:text-xl font-extrabold tracking-tight leading-none ${
                    darkMode ? 'text-[#FAF7FF]' : 'text-[#2B0938]'
                  }`}
                >
                  Cross<span className="text-[#D4A437] dark:text-[#F6C915]">Jig</span>
                </span>
              </div>
              <p
                className={`hidden sm:block text-[10px] font-bold tracking-wider uppercase ${
                  darkMode ? 'text-[#D6CBE2]' : 'text-[#5E3A73]'
                }`}
              >
                Tactile Crossword Jigsaw
              </p>
            </div>
          </button>
        </div>

        {/* Center: Puzzle Mode Navigation (Desktop) */}
        <nav
          className={`hidden lg:flex items-center gap-1 rounded-xl border p-1 ${
            darkMode
              ? 'border-[#D4A437]/35 bg-[#12031F]/80'
              : 'border-[#D9C6EC] bg-[#F5EFFA]'
          }`}
          aria-label="Puzzle modes"
        >
          {MODES.map((mode) => {
            const isActive = activeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onSelectMode(mode)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                    : darkMode
                      ? 'text-[#D6CBE2] hover:text-white hover:bg-white/5'
                      : 'text-[#4A1C63] hover:text-[#1D0830] hover:bg-[#E7D8F3]/60'
                }`}
              >
                {MODE_CONFIGS[mode].label}
              </button>
            );
          })}
        </nav>

        {/* Right: Actions, Streak, Leaderboard, Account, Theme & Help */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onNewPuzzle}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#F6C915] px-3 py-1.5 text-xs font-extrabold text-[#1D0830] shadow-xs transition-all hover:bg-[#FFE047] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>New Puzzle</span>
          </button>

          <DailyStreakBadge
            streak={dailyStreak.streak}
            solvedToday={dailyStreak.solvedToday}
            variant={darkMode ? 'gold' : 'amber-light'}
          />

          <button
            type="button"
            onClick={onOpenArchive}
            title="1-Year Daily Calendar Archive (365 Puzzles)"
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isViewingPastArchive
                ? 'border-[#F6C915] bg-[#F6C915] text-[#1D0830] shadow-xs'
                : darkMode
                  ? 'border-[#D4A437]/45 bg-[#2B0944] text-[#F6C915] hover:bg-[#380C59]'
                  : 'border-[#D4A437]/60 bg-[#2B0938] text-[#F6C915] hover:bg-[#3D0D52]'
            }`}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden md:inline">Archive</span>
          </button>

          <button
            type="button"
            onClick={onOpenLeaderboard}
            title="Leaderboards"
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              darkMode
                ? 'border-[#D4A437]/45 bg-[#2B0944] text-[#F6C915] hover:bg-[#380C59]'
                : 'border-[#D4A437]/60 bg-[#2B0938] text-[#F6C915] hover:bg-[#3D0D52]'
            }`}
          >
            <Trophy className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden xl:inline">Leaderboard</span>
          </button>

          <button
            type="button"
            onClick={onOpenAccount}
            title={user ? `Signed in as ${getCleanDisplayName(user)}` : 'Sign In / Account'}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              user
                ? darkMode
                  ? 'border-emerald-400/50 bg-emerald-950/50 text-emerald-200 hover:bg-emerald-900/60'
                  : 'border-emerald-600/40 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                : darkMode
                  ? 'border-[#D4A437]/40 bg-white/10 text-[#FAF7FF] hover:bg-white/15'
                  : 'border-[#D9C6EC] bg-[#F5EFFA] text-[#2B0938] hover:bg-[#EADBF6]'
            }`}
          >
            {user ? (
              <>
                <UserProfileIcon
                  user={user}
                  size={16}
                  imgClassName="w-4 h-4 rounded-full object-cover shrink-0 border border-[#F6C915]"
                />
                <span className="hidden md:inline max-w-[96px] truncate">
                  {getCleanDisplayName(user)}
                </span>
              </>
            ) : (
              <>
                <LogIn className="h-3.5 w-3.5 shrink-0 text-[#D4A437] dark:text-[#F6C915]" />
                <span className="hidden md:inline">Sign In</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleSound}
            title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors shrink-0 cursor-pointer ${
              darkMode
                ? 'border-[#D4A437]/35 bg-[#2B0944]/80 text-[#FAF7FF] hover:border-[#F6C915]'
                : 'border-[#D9C6EC] bg-[#F5EFFA] text-[#2B0938] hover:border-[#2B0938]'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 opacity-60" />}
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors shrink-0 cursor-pointer ${
              darkMode
                ? 'border-[#D4A437]/35 bg-[#2B0944]/80 text-[#F6C915] hover:border-[#F6C915]'
                : 'border-[#D9C6EC] bg-[#F5EFFA] text-[#2B0938] hover:border-[#2B0938]'
            }`}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenHowToPlay}
            title="How to Play"
            aria-label="How to Play"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors shrink-0 cursor-pointer ${
              darkMode
                ? 'border-[#D4A437]/35 bg-[#2B0944]/80 text-[#FAF7FF] hover:border-[#F6C915]'
                : 'border-[#D9C6EC] bg-[#F5EFFA] text-[#2B0938] hover:border-[#2B0938]'
            }`}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile / Tablet compact mode bar (visible below lg) */}
      <div
        className={`border-t px-3 py-1.5 lg:hidden ${
          darkMode ? 'border-[#D4A437]/25 bg-[#140322]' : 'border-[#E5D8F2] bg-[#F8F4FC]'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-1.5 overflow-x-auto">
          <div className="flex items-center gap-1">
            {MODES.map((mode) => {
              const isActive = activeMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSelectMode(mode)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#F6C915] text-[#1D0830]'
                      : darkMode
                        ? 'text-[#D6CBE2] hover:text-white'
                        : 'text-[#4A1C63] hover:text-[#1D0830]'
                  }`}
                >
                  {MODE_CONFIGS[mode].label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenArchive}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Archive</span>
            </button>
            <button
              type="button"
              onClick={onOpenHowToPlay}
              className={`px-2 py-1 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                darkMode ? 'text-[#D6CBE2]' : 'text-[#5E3A73]'
              }`}
            >
              Rules
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
