import React from 'react';
import { Link } from 'react-router';
import { ChevronDown, Clock, Flame, Trophy } from 'lucide-react';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import { LoggedInIndicator } from '@/components/logged-in-indicator';

interface GoComicsNavProps {
  currentDateStr: string;
  countdownText: string;
  containerWidth?: number;
  isHardMode: boolean;
  onToggleHardMode: () => void;
  onOpenArchive: () => void;
  onOpenHowToPlay: () => void;
  onOpenLeaderboardPopup?: () => void;
  isSignedIn?: boolean;
  userDisplayName?: string;
  onResetOrClose?: () => void;
  dailyStreak?: number;
  solvedToday?: boolean;
  onTestSprayBanner?: () => void;
}

export const GoComicsNav: React.FC<GoComicsNavProps> = ({
  currentDateStr,
  countdownText,
  containerWidth,
  isHardMode,
  onToggleHardMode,
  onOpenArchive,
  onOpenHowToPlay,
  onOpenLeaderboardPopup,
  isSignedIn,
  userDisplayName,
  dailyStreak = 0,
  solvedToday = false,
  onTestSprayBanner,
}) => {
  return (
    <nav className="w-full bg-[#180424] text-white select-none border-b border-[#f5b82e]/25 text-xs sm:text-sm shadow-md">
      <div className="w-full flex justify-center px-2 sm:px-4">
        <div
          style={{ width: containerWidth ? `${containerWidth}px` : undefined }}
          className="w-full max-w-6xl min-h-14 py-2 sm:py-0 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 transition-all duration-150 flex-wrap sm:flex-nowrap"
        >
          {/* Left: Back Button + Brand Logo linking back to Home Screen (/) */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link
              to="/solo-games"
              className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-[#2d0a3d] hover:bg-[#3d0e52] border border-[#f5b82e]/50 text-[#f5b82e] font-bold text-xs transition-colors shrink-0"
              title="Back to Solo Games"
            >
              ← Back
            </Link>
            {onTestSprayBanner && (
              <button
                type="button"
                aria-label="Test spray paint win banner"
                onClick={onTestSprayBanner}
                className="block w-[5px] h-[5px] min-w-0 min-h-0 p-0 m-0 border-0 rounded-full bg-[#f5b82e] hover:brightness-125 cursor-pointer appearance-none focus:outline-none shrink-0"
              />
            )}
            <Link
              to="/"
              className="flex items-center gap-2 sm:gap-3 shrink-0 group"
              title="Return to Home Screen"
            >
              <img
                src="/brand-logo.png"
                alt="The Missing Piece Logo"
                className="w-7 h-7 sm:w-10 sm:h-10 object-contain rounded-md drop-shadow-md group-hover:scale-105 transition-transform"
              />
              <div className="flex flex-col">
                <span className="font-black text-xs sm:text-sm tracking-wider text-[#f5b82e] uppercase font-serif leading-tight drop-shadow-xs">
                  The Missing Piece
                </span>
                <span className="hidden sm:block text-[9px] sm:text-[10px] text-white/70 tracking-widest uppercase font-semibold leading-none">
                  Find Your Space
                </span>
              </div>
            </Link>
          </div>

          {/* Center / Navigation Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap justify-end">
            <DailyStreakBadge
              streak={dailyStreak}
              solvedToday={solvedToday}
              variant="amber-dark"
              compact
            />
            <LoggedInIndicator />

            {/* Help button (?) */}
            <button
              type="button"
              onClick={onOpenHowToPlay}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-[#f5b82e]/50 hover:border-[#f5b82e] bg-[#2d0a3d] hover:bg-[#3d0e52] text-[#f5b82e] hover:text-white flex items-center justify-center font-bold text-xs sm:text-sm transition-colors cursor-pointer shadow-xs shrink-0"
              title="How to Play"
            >
              ?
            </button>

            {/* Leaderboard & Account Pop-up Button (compact icon matching ? button) */}
            {onOpenLeaderboardPopup && (
              <button
                type="button"
                onClick={onOpenLeaderboardPopup}
                className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-[#f5b82e]/50 hover:border-[#f5b82e] bg-[#2d0a3d] hover:bg-[#3d0e52] text-[#f5b82e] hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs shrink-0"
                title={
                  isSignedIn
                    ? `Leaderboards & Account (${userDisplayName || 'Signed In'})`
                    : 'Leaderboards & Sign In'
                }
              >
                <Trophy className="w-3.5 h-3.5" />
                {isSignedIn && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#180424]" />
                )}
              </button>
            )}

            {/* Hard Mode Toggle */}
            <button
              type="button"
              onClick={onToggleHardMode}
              className={`flex items-center gap-1 sm:gap-1.5 font-bold text-xs py-1 sm:py-1.5 px-2 sm:px-3 rounded-full border transition-all cursor-pointer shadow-xs shrink-0 ${
                isHardMode
                  ? 'bg-[#f5b82e] text-[#220536] border-amber-300 shadow-amber-500/20'
                  : 'bg-[#2a073a] hover:bg-[#380c4d] text-white/80 hover:text-[#f5b82e] border-purple-800/60'
              }`}
              title="Hard Mode: Hides red incorrect letter indicators upon solve"
            >
              <Flame
                className={`w-3.5 h-3.5 ${
                  isHardMode ? 'text-[#220536] fill-[#220536]' : 'text-[#f5b82e]'
                }`}
              />
              <span className="hidden sm:inline">Hard Mode: {isHardMode ? 'ON' : 'OFF'}</span>
              <span className="sm:hidden">{isHardMode ? 'HM: ON' : 'HM: OFF'}</span>
            </button>

            {/* Date Selector */}
            <button
              type="button"
              onClick={onOpenArchive}
              className="flex items-center gap-1 sm:gap-1.5 font-bold text-xs sm:text-sm text-white hover:text-[#f5b82e] py-1 sm:py-1.5 px-2 sm:px-3 rounded-full bg-[#2a073a] hover:bg-[#380c4d] border border-purple-800/60 transition-colors cursor-pointer shadow-xs shrink-0"
              title="Choose Date or Archive"
            >
              <span className="max-w-[130px] sm:max-w-none truncate">{currentDateStr}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#f5b82e] shrink-0" />
            </button>

            {/* London UK 00:00 Countdown Pill */}
            <div
              className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-amber-200/90 bg-[#250634] border border-[#f5b82e]/30 px-2.5 py-1 rounded-full cursor-help shadow-xs"
              title="New puzzle releases daily at 00:00 London (UK) time"
            >
              <Clock className="w-3.5 h-3.5 text-[#f5b82e] animate-pulse" />
              <span>Next: {countdownText}</span>
              <span className="text-[10px] text-[#f5b82e] font-sans font-black">UK</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
