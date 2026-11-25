import React from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarDays,
  HelpCircle,
  LogIn,
  Moon,
  Sun,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import { UserProfileIcon } from '@/components/user-profile-icon';
import {
  getCleanDisplayName,
  type UnifiedPlayerUser,
  type User,
} from '@/lib/unified-game-auth';
import type { DailyStreakState } from '@/lib/daily-streak';

export type ActiveTab = 'play' | 'archive';

interface HeaderProps {
  activeTab: ActiveTab;
  darkMode: boolean;
  soundEnabled: boolean;
  user: UnifiedPlayerUser | User | null;
  dailyStreak: DailyStreakState;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenStats: () => void;
  onOpenHowToPlay: () => void;
  onOpenLeaderboard: () => void;
  onOpenAccount: () => void;
  onToggleTheme: () => void;
  onToggleSound: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  darkMode,
  soundEnabled,
  user,
  dailyStreak,
  onSelectTab,
  onOpenStats,
  onOpenHowToPlay,
  onOpenLeaderboard,
  onOpenAccount,
  onToggleTheme,
  onToggleSound,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#FFFFFF]/95 dark:bg-[#1B052D]/95 backdrop-blur-md border-b border-[#D9C7EE] dark:border-[#D4A437]/30 shadow-xs">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 min-h-14 sm:min-h-16 py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Zone 1: Back link + Missing Piece Brand Wordmark */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <Link
            to="/solo-games"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#D5C0EE] dark:border-[#D4A437]/35 bg-[#F4EBFC] dark:bg-[#27093F] text-xs font-bold text-[#2B0938] dark:text-[#F6C915] hover:bg-[#EBDDFB] dark:hover:bg-[#350D54] transition-colors whitespace-nowrap shrink-0"
            title="Back to Solo Games"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Solo Games</span>
          </Link>

          <button
            type="button"
            onClick={() => onSelectTab('play')}
            className="inline-flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C915] rounded-lg"
          >
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="The Missing Piece"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0 drop-shadow-xs"
            />
            <div className="leading-tight">
              <div className="text-[10px] font-mono uppercase tracking-[0.16em] font-bold text-[#8F6500] dark:text-[#F6C915]">
                The Missing Piece
              </div>
              <div className="font-display text-base sm:text-lg font-extrabold tracking-tight text-[#2B0938] dark:text-[#FAF7FF]">
                Going Deep
              </div>
            </div>
          </button>

          <div className="hidden md:block">
            <DailyStreakBadge
              streak={dailyStreak.streak}
              solvedToday={dailyStreak.solvedToday}
              variant="light"
              compact
            />
          </div>
        </div>

        {/* Zone 2: Navigation & Site Controls */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
          <nav
            aria-label="Primary"
            className="flex items-center gap-1 p-1 rounded-xl bg-[#EFE5FA] dark:bg-[#25083B] border border-[#DAC6F0] dark:border-[#D4A437]/25"
          >
            <button
              type="button"
              onClick={() => onSelectTab('play')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'play'
                  ? 'bg-[#2B0938] text-[#F6C915] dark:bg-[#F6C915] dark:text-[#1D0830] shadow-xs'
                  : 'text-[#5C3A78] dark:text-[#D6CBE2] hover:text-[#2B0938] dark:hover:text-white'
              }`}
            >
              Play
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('archive')}
              className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'archive'
                  ? 'bg-[#2B0938] text-[#F6C915] dark:bg-[#F6C915] dark:text-[#1D0830] shadow-xs'
                  : 'text-[#5C3A78] dark:text-[#D6CBE2] hover:text-[#2B0938] dark:hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 hidden sm:inline" />
              Archive
            </button>
          </nav>

          <button
            type="button"
            onClick={onOpenStats}
            aria-label="Statistics"
            title="Statistics"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-[#D5C0EE] dark:border-[#D4A437]/30 bg-white dark:bg-[#25083B] text-[#4A1C6E] dark:text-[#E7DAF2] hover:border-[#2B0938] dark:hover:border-[#F6C915] hover:text-[#2B0938] dark:hover:text-[#F6C915] flex items-center justify-center transition-colors cursor-pointer"
          >
            <BarChart3 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenLeaderboard}
            aria-label="Leaderboards"
            title="Leaderboards"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-[#D5C0EE] dark:border-[#D4A437]/30 bg-white dark:bg-[#25083B] text-[#8F6500] dark:text-[#F6C915] hover:border-[#2B0938] dark:hover:border-[#F6C915] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Trophy className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenHowToPlay}
            aria-label="How to Play"
            title="How to Play"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-[#D5C0EE] dark:border-[#D4A437]/30 bg-white dark:bg-[#25083B] text-[#4A1C6E] dark:text-[#E7DAF2] hover:border-[#2B0938] dark:hover:border-[#F6C915] hover:text-[#2B0938] dark:hover:text-[#F6C915] flex items-center justify-center transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 sm:hidden" />
            <BookOpen className="w-4 h-4 hidden sm:block" />
          </button>

          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            title={soundEnabled ? 'Sound on' : 'Sound muted'}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-[#D5C0EE] dark:border-[#D4A437]/30 bg-white dark:bg-[#25083B] text-[#4A1C6E] dark:text-[#E7DAF2] hover:border-[#2B0938] dark:hover:border-[#F6C915] flex items-center justify-center transition-colors cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={darkMode ? 'Light mode' : 'Dark mode'}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-[#D5C0EE] dark:border-[#D4A437]/30 bg-white dark:bg-[#25083B] text-[#4A1C6E] dark:text-[#F6C915] hover:border-[#2B0938] dark:hover:border-[#F6C915] flex items-center justify-center transition-colors cursor-pointer"
          >
            {darkMode ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenAccount}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 h-8 sm:h-9 rounded-lg bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-extrabold text-xs shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title={user ? `Signed in as ${getCleanDisplayName(user)}` : 'Sign in to sync progress & leaderboards'}
          >
            {user ? (
              <>
                <UserProfileIcon
                  user={user}
                  size={16}
                  className="w-4 h-4 shrink-0"
                  imgClassName="w-5 h-5 rounded-full object-cover border border-[#1D0830]/30"
                />
                <span className="hidden sm:inline max-w-[96px] truncate">
                  {getCleanDisplayName(user)}
                </span>
              </>
            ) : (
              <>
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
