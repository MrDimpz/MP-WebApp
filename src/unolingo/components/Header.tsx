import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  ChevronDown,
  HelpCircle,
  LogIn,
  Moon,
  Sun,
  Trophy,
  User as UserIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GameView, PuzzleProgressRecord, UnolingoStats } from '../types';
import { soundFx } from '../engine/soundFx';
import { ArchiveCalendarPicker } from './ArchiveModal';
import {
  getCleanDisplayName,
  type UnifiedPlayerUser,
  type User,
} from '@/lib/unified-game-auth';
import { useDailyStreak } from '@/lib/daily-streak';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import { LanguageMenu } from '@/components/language-menu';
import { useDictionaryLanguage } from '@/lib/dictionary-languages';
import { UserProfileIcon } from '@/components/user-profile-icon';
import { getProgressDateKey } from '../engine/storage';

interface HeaderProps {
  currentView: GameView;
  setCurrentView: (view: GameView) => void;
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  todayLondonStr: string;
  selectedDateStr: string;
  onSelectDate: (dateStr: string) => void;
  progressMap: Record<string, PuzzleProgressRecord>;
  stats: UnolingoStats;
  effectiveStreak: number;
  currentUser?: UnifiedPlayerUser | User | null;
  onOpenSignIn: () => void;
  onOpenUnifiedLeaderboard: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  isDarkMode,
  setIsDarkMode,
  isMuted,
  setIsMuted,
  todayLondonStr,
  selectedDateStr,
  onSelectDate,
  progressMap,
  effectiveStreak,
  currentUser,
  onOpenSignIn,
  onOpenUnifiedLeaderboard,
}) => {
  const [archiveDropdownOpen, setArchiveDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [dictionaryLanguage] = useDictionaryLanguage();

  const solvedToday =
    progressMap[getProgressDateKey(todayLondonStr, dictionaryLanguage)]?.status === 'completed';
  const dailyStreak = useDailyStreak('unolingo', todayLondonStr, solvedToday, effectiveStreak);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setArchiveDropdownOpen(false);
      }
    };
    if (archiveDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [archiveDropdownOpen]);

  const toggleAudio = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundFx.setMuted(next);
  };

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 sm:gap-3 px-3 sm:px-6 py-2 sm:py-3 border-b border-purple-200/80 dark:border-purple-900/60 bg-white/90 dark:bg-[#1a0624]/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
      {/* Zone 1: Back to Solo Games & Brand Wordmark */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Link
          to="/solo-games"
          className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#4a1259] dark:text-amber-300 bg-purple-100/80 dark:bg-purple-900/50 hover:bg-purple-200/80 dark:hover:bg-purple-800/60 border border-purple-200/80 dark:border-purple-700/60 transition-colors whitespace-nowrap"
          title="Back to Solo Games"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Solo Games</span>
        </Link>

        <button
          type="button"
          onClick={() => setCurrentView('TITLE')}
          className="flex items-center gap-2 sm:gap-2.5 text-left group shrink-0 focus:outline-none cursor-pointer"
        >
          <img
            src="/assets/aistudio/3d_logo_944e5372.png"
            alt="Unolingo - The Missing Piece Logo"
            className="w-8 h-8 sm:w-11 sm:h-11 rounded-full object-contain drop-shadow-md group-hover:scale-105 transition-transform"
          />
          <div>
            <span className="text-base sm:text-xl font-extrabold tracking-tight text-[#3b0d47] dark:text-white block leading-none">
              Uno<span className="text-amber-500 dark:text-amber-400">lingo</span>
            </span>
            <span className="hidden sm:block text-[10px] uppercase font-bold text-[#581c6b] dark:text-amber-300/80 tracking-wider">
              The Missing Piece
            </span>
          </div>
        </button>
      </div>

      {/* Zone 2: Navigation Links */}
      <nav className="hidden lg:flex items-center gap-5 text-sm font-semibold text-slate-600 dark:text-purple-200/80">
        <button
          type="button"
          onClick={() => {
            onSelectDate(todayLondonStr);
            setCurrentView('TITLE');
          }}
          className={`hover:text-[#581c6b] dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            currentView === 'TITLE' ? 'text-[#581c6b] dark:text-amber-400 font-bold' : ''
          }`}
        >
          Today&apos;s Puzzle
        </button>

        {/* Archive Calendar Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setArchiveDropdownOpen((prev) => !prev)}
            className={`hover:text-[#581c6b] dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              currentView === 'ARCHIVE' || archiveDropdownOpen
                ? 'text-[#581c6b] dark:text-amber-400 font-bold'
                : ''
            }`}
          >
            <Calendar className="w-4 h-4" /> Archive{' '}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                archiveDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {archiveDropdownOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 mt-3 z-50 animate-unolingo-fade-in">
              <ArchiveCalendarPicker
                compact
                progressMap={progressMap}
                dictionaryLanguage={dictionaryLanguage}
                todayLondonStr={todayLondonStr}
                selectedDateStr={selectedDateStr}
                onSelectDate={(dateStr) => {
                  onSelectDate(dateStr);
                  setArchiveDropdownOpen(false);
                  setCurrentView('PLAYING');
                }}
                onClose={() => setArchiveDropdownOpen(false)}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCurrentView('LEADERBOARD')}
          className={`hover:text-[#581c6b] dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            currentView === 'LEADERBOARD' ? 'text-[#581c6b] dark:text-amber-400 font-bold' : ''
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-500" /> Leaderboard
        </button>

        <button
          type="button"
          onClick={() => setCurrentView('STATS')}
          className={`hover:text-[#581c6b] dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            currentView === 'STATS' ? 'text-[#581c6b] dark:text-amber-400 font-bold' : ''
          }`}
        >
          <BarChart2 className="w-4 h-4" /> Statistics
        </button>
      </nav>

      {/* Zone 3: Actions */}
      <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
        <DailyStreakBadge
          streak={dailyStreak.streak}
          solvedToday={dailyStreak.solvedToday}
          variant="light"
          compact
        />

        <LanguageMenu variant="compact" />

        <button
          type="button"
          onClick={() => setCurrentView('ARCHIVE')}
          title="Archive"
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
        >
          <Calendar className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onOpenUnifiedLeaderboard}
          title="Public Solo Games Leaderboards"
          className="p-2 rounded-xl text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 transition-colors cursor-pointer"
        >
          <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {currentUser ? (
          <button
            type="button"
            onClick={onOpenSignIn}
            title="Account & Display Name"
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-colors cursor-pointer"
          >
            <UserProfileIcon
              user={currentUser}
              className="w-4 h-4 shrink-0"
              fallback={
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shrink-0" />
                  <UserIcon className="w-3.5 h-3.5 shrink-0" />
                </>
              }
            />
            <span className="max-w-[85px] sm:max-w-[120px] truncate">
              {getCleanDisplayName(currentUser)}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenSignIn}
            title="Sign in with Google or Email & Password"
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#2d0938] dark:bg-purple-900/70 hover:bg-[#3b0d47] text-amber-300 border border-amber-400/40 text-xs font-bold transition-colors cursor-pointer shadow-xs whitespace-nowrap"
          >
            <LogIn className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setCurrentView('HOW_TO_PLAY')}
          title="How to Play"
          className="p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={toggleAudio}
          title={isMuted ? 'Unmute sound' : 'Mute sound'}
          className="p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-rose-500" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-[#4a1259]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onSelectDate(todayLondonStr);
            setCurrentView('PLAYING');
          }}
          className="hidden xl:inline-flex px-3.5 py-2 text-xs font-extrabold text-[#2d0938] bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 rounded-xl shadow-md shadow-amber-500/20 border border-amber-300 transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          Play Today ({todayLondonStr})
        </button>
      </div>
    </header>
  );
};
