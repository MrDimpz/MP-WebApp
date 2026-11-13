import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Trophy,
  BarChart2,
  HelpCircle,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  ChevronDown,
  Radio,
  LogIn,
  User as UserIcon,
} from 'lucide-react';
import { GameState, GameStats } from '../types';
import { soundManager } from '../utils/audio';
import { ArchiveCalendarPicker } from './ArchiveModal';
import {
  getCleanDisplayName,
  type UnifiedPlayerUser,
  type User,
} from '@/lib/unified-game-auth';

interface HeaderProps {
  currentView: GameState;
  setCurrentView: (view: GameState) => void;
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  todayDateStr: string;
  selectedDateStr: string;
  onSelectDate: (dateStr: string) => void;
  stats: GameStats;
  isLiveConnected: boolean;
  tiktokUsername: string;
  onOpenTikTokModal: () => void;
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
  todayDateStr,
  selectedDateStr,
  onSelectDate,
  stats,
  isLiveConnected,
  tiktokUsername,
  onOpenTikTokModal,
  currentUser,
  onOpenSignIn,
  onOpenUnifiedLeaderboard,
}) => {
  const [archiveDropdownOpen, setArchiveDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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
    soundManager.setMuted(next);
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
    <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-purple-200/80 dark:border-purple-900/60 bg-white/90 dark:bg-[#1a0624]/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
      {/* Zone 1: Brand Wordmark with 3D Logo */}
      <button
        onClick={() => setCurrentView('TITLE')}
        className="flex items-center gap-3 text-left group shrink-0 focus:outline-none cursor-pointer"
      >
        <img
          src="/assets/aistudio/3d_logo_944e5372.png"
          alt="DeStack Interactive - The Missing Piece Logo"
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-contain drop-shadow-md group-hover:scale-105 transition-transform"
        />
        <div>
          <span className="text-xl font-extrabold tracking-tight text-[#3b0d47] dark:text-white block leading-none">
            De<span className="text-amber-500 dark:text-amber-400">Stack</span>
          </span>
          <span className="text-[10px] uppercase font-bold text-[#581c6b] dark:text-amber-300/80 tracking-wider">
            Interactive LIVE
          </span>
        </div>
      </button>

      {/* Zone 2: Navigation Links */}
      <nav className="hidden lg:flex items-center gap-5 text-sm font-semibold text-slate-600 dark:text-purple-200/80">
        <button
          onClick={() => {
            onSelectDate(todayDateStr);
            setCurrentView('TITLE');
          }}
          className={`hover:text-[#581c6b] dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            currentView === 'TITLE' ? 'text-[#581c6b] dark:text-amber-400 font-bold' : ''
          }`}
        >
          Today's Puzzle
        </button>

        {/* Archive Calendar Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setArchiveDropdownOpen(prev => !prev)}
            className={`hover:text-[#581c6b] dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              currentView === 'ARCHIVE' || archiveDropdownOpen ? 'text-[#581c6b] dark:text-amber-400 font-bold' : ''
            }`}
          >
            <Calendar className="w-4 h-4" /> Archive <ChevronDown className={`w-3.5 h-3.5 transition-transform ${archiveDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {archiveDropdownOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 mt-3 z-50 animate-tile-pop">
              <ArchiveCalendarPicker
                compact
                stats={stats}
                todayDateStr={todayDateStr}
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
          onClick={() => setCurrentView('LEADERBOARD')}
          className={`hover:text-[#581c6b] dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            currentView === 'LEADERBOARD' ? 'text-[#581c6b] dark:text-amber-400 font-bold' : ''
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-500" /> Scoreboards
        </button>
        <button
          onClick={() => setCurrentView('STATS')}
          className={`hover:text-[#581c6b] dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            currentView === 'STATS' ? 'text-[#581c6b] dark:text-amber-400 font-bold' : ''
          }`}
        >
          <BarChart2 className="w-4 h-4" /> Statistics
        </button>
      </nav>

      {/* Zone 3: Actions (TikTok LIVE Connect, Unified Account, Leaderboards, Archive, Sound, Theme, Play CTA) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* TikTok LIVE Settings Button */}
        <button
          type="button"
          onClick={onOpenTikTokModal}
          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer border ${
            isLiveConnected
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
              : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border-rose-500/35'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isLiveConnected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'
            }`}
          />
          <Radio className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {isLiveConnected ? `@${tiktokUsername}` : 'TikTok LIVE'}
          </span>
        </button>

        {/* Unified Account & TikTok @ Link Button */}
        {currentUser ? (
          <button
            type="button"
            onClick={onOpenSignIn}
            title="Account & Linked TikTok @"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800/60 border border-purple-300/70 dark:border-purple-700/60 text-[#3b0d47] dark:text-amber-300 text-xs font-bold transition-colors cursor-pointer"
          >
            <UserIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline max-w-[100px] truncate">
              {getCleanDisplayName(currentUser)}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenSignIn}
            title="Sign In & Link TikTok @"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#2d0938] dark:bg-purple-900/70 hover:bg-[#3b0d47] text-amber-300 border border-amber-400/40 text-xs font-bold transition-colors cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenUnifiedLeaderboard}
          title="All Leaderboards"
          className="p-2 rounded-xl text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 transition-colors cursor-pointer"
        >
          <Trophy className="w-4 h-4" />
        </button>

        <button
          onClick={() => setCurrentView('ARCHIVE')}
          title="Archive"
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
        >
          <Calendar className="w-5 h-5" />
        </button>
        <button
          onClick={() => setCurrentView('HOW_TO_PLAY')}
          title="How to Play"
          className="p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        <button
          onClick={toggleAudio}
          title={isMuted ? 'Unmute sound' : 'Mute sound'}
          className="p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-rose-500" /> : <Volume2 className="w-5 h-5" />}
        </button>
        <button
          onClick={toggleTheme}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
        >
          {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-[#4a1259]" />}
        </button>
        <button
          onClick={() => {
            onSelectDate(todayDateStr);
            setCurrentView('PLAYING');
          }}
          className="hidden xl:inline-flex px-4 py-2 text-xs font-extrabold text-[#2d0938] bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 rounded-xl shadow-md shadow-amber-500/20 border border-amber-300 transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          Play Today
        </button>
      </div>
    </header>
  );
};
