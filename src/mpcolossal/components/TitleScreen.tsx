import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { GridScale, SCALE_CONFIG } from '../utils/crosswordGenerator';
import {
  ArrowLeft,
  Compass,
  LogIn,
  Moon,
  Play,
  Sun,
  Trophy,
  User as UserIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import { UserProfileIcon } from '@/components/user-profile-icon';
import { getCleanDisplayName, type UnifiedPlayerUser } from '@/lib/unified-game-auth';
import heroAtlasImg from '../assets/images/hero_crossword_atlas_1794974606559.jpg';

interface TitleScreenProps {
  selectedScale: GridScale;
  onSelectScale: (scale: GridScale) => void;
  initialMode: 'classic' | 'quest';
  onSelectMode: (mode: 'classic' | 'quest') => void;
  streamLayout: boolean;
  onSelectStreamLayout: (stream: boolean) => void;
  hasSavedProgress: boolean;
  savedStats: { solvedWords: number; totalWords: number } | null;
  isMuted: boolean;
  onToggleMute: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  currentUser: UnifiedPlayerUser | null;
  streak: number;
  solvedToday: boolean;
  onOpenSignIn: () => void;
  onOpenLeaderboard: () => void;
  onStartGame: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedScale,
  onSelectScale,
  initialMode,
  onSelectMode,
  streamLayout,
  onSelectStreamLayout,
  hasSavedProgress,
  savedStats,
  isMuted,
  onToggleMute,
  darkMode,
  onToggleDarkMode,
  currentUser,
  streak,
  solvedToday,
  onOpenSignIn,
  onOpenLeaderboard,
  onStartGame,
}) => {
  const [imgError, setImgError] = useState(false);

  // Allow Enter or Space to start the game from the Title Screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'A') return;
        e.preventDefault();
        onStartGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStartGame]);

  const scales: GridScale[] = ['colossal', 'grand', 'district'];

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-[#FBF8F1] via-[#F4EFE4] to-[#EDE4D3] text-[#2B0938] dark:from-[#160524] dark:via-[#1E0633] dark:to-[#11031A] dark:text-[#F5F3F7] flex flex-col">
      {/* 20% Opacity Missing Piece Background Watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 flex items-center justify-center z-0 overflow-hidden"
      >
        <img
          src="/brand-logo.png"
          alt=""
          className="w-[340px] h-[340px] sm:w-[680px] sm:h-[680px] object-contain opacity-20 select-none"
        />
      </div>

      {/* Unified Missing Piece Top Navigation Header */}
      <header className="relative z-30 flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 sm:py-3 border-b border-purple-200/80 dark:border-purple-900/60 bg-white/90 dark:bg-[#1a0624]/90 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            to="/solo-games"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#4a1259] dark:text-amber-300 bg-purple-100/80 dark:bg-purple-900/50 hover:bg-purple-200/80 dark:hover:bg-purple-800/60 border border-purple-200/80 dark:border-purple-700/60 transition-colors whitespace-nowrap"
            title="Back to Solo Games"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Solo Games</span>
          </Link>

          <div className="flex items-center gap-2">
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="MP Colossal - The Missing Piece Logo"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-contain drop-shadow-md"
            />
            <div>
              <span className="text-sm sm:text-xl font-extrabold tracking-tight text-[#3b0d47] dark:text-white block leading-none">
                MP <span className="text-amber-500 dark:text-amber-400">Colossal</span>
              </span>
              <span className="hidden sm:block text-[10px] uppercase font-bold text-[#581c6b] dark:text-amber-300/80 tracking-wider">
                The Missing Piece
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <DailyStreakBadge
            streak={streak}
            solvedToday={solvedToday}
            variant="light"
            compact
          />

          <button
            type="button"
            onClick={onOpenLeaderboard}
            title="Public Solo Games Leaderboards"
            className="p-1.5 sm:p-2 rounded-xl text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 transition-colors cursor-pointer"
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
              <span className="hidden xs:inline max-w-[75px] sm:max-w-[120px] truncate">
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
              <span className="hidden xs:inline">Sign In</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMute}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="p-1.5 sm:p-2 rounded-xl text-[#4a1259] dark:text-purple-200 hover:bg-purple-100/70 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" />
            ) : (
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 dark:text-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 sm:p-2 rounded-xl text-[#4a1259] dark:text-purple-200 hover:bg-purple-100/70 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-[#4a1259]" />
            )}
          </button>
        </div>
      </header>

      {/* Main Split Showcase */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-stretch">
        {/* Left Key-Art Showcase (52% on desktop) */}
        <div className="relative lg:w-[52%] h-[28vh] min-h-[200px] lg:h-auto overflow-hidden bg-[#23063A] shrink-0 border-b lg:border-b-0 lg:border-r border-purple-200/60 dark:border-purple-900/60">
          {!imgError ? (
            <img
              src={heroAtlasImg}
              alt="Vintage cartographic crossword broadsheet atlas with brass magnifying glass and compass"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover object-center scale-[1.02] transition-transform duration-700 opacity-90"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2B0938] via-[#1E0633] to-amber-950/40 p-12">
              <Compass className="w-28 h-28 text-[#F6C915]/50" />
            </div>
          )}

          {/* Royal purple / obsidian contrast scrim */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-[#160524]/45 via-[#160524]/60 to-[#160524]/90" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#160524] via-transparent to-[#160524]/35" />

          {/* Centered 3D Emblem badge on showcase */}
          <div className="hidden lg:flex flex-col justify-end absolute inset-0 p-10 pointer-events-none">
            <div className="max-w-md space-y-2.5 bg-[#1a0624]/88 backdrop-blur-sm p-5 rounded-2xl border border-[#D4A437]/50 shadow-2xl">
              <div className="flex items-center gap-2 text-xs text-[#F6C915] font-mono-tabular font-bold">
                <span>Cartographic Atlas Edition</span>
                <span aria-hidden="true">·</span>
                <span>40,000 Squares</span>
                <span aria-hidden="true">·</span>
                <span>25 Sectors</span>
              </div>
              <p className="text-sm text-purple-100/90 leading-relaxed">
                Explore a monumental continent of Cinema, Pop Music, Television, Gaming, Science, and World Lore clues. Complete themed quests or warp across sectors with the pop-up Atlas Radar.
              </p>
            </div>
          </div>
        </div>

        {/* Right Control & SVG Lockup Panel */}
        <div className="relative flex-1 flex flex-col justify-between p-5 sm:p-8 lg:p-10">
          <div className="my-auto space-y-6 max-w-xl mx-auto w-full">
            {/* Bespoke Royal Purple & Gold SVG Lockup */}
            <div className="space-y-3">
              <svg
                viewBox="0 0 520 116"
                className="w-full max-w-[440px] h-auto select-none"
                role="img"
                aria-label="MP Colossal Crossword Atlas"
              >
                <g transform="translate(4, 10)">
                  <rect x="0" y="0" width="92" height="92" rx="8" fill="#2B0938" stroke="#F6C915" strokeWidth="2.5" />
                  <rect x="6" y="6" width="24" height="24" rx="2" fill="#FAF7F0" />
                  <rect x="34" y="6" width="24" height="24" rx="2" fill="#FAF7F0" />
                  <rect x="62" y="6" width="24" height="24" rx="2" fill="#160524" />

                  <rect x="6" y="34" width="24" height="24" rx="2" fill="#F6C915" />
                  <rect x="34" y="34" width="24" height="24" rx="2" fill="#FAF7F0" />
                  <rect x="62" y="34" width="24" height="24" rx="2" fill="#FAF7F0" />

                  <rect x="6" y="62" width="24" height="24" rx="2" fill="#160524" />
                  <rect x="34" y="62" width="24" height="24" rx="2" fill="#FAF7F0" />
                  <rect x="62" y="62" width="24" height="24" rx="2" fill="#FAF7F0" />

                  <text x="18" y="23" textAnchor="middle" fill="#1D0830" fontSize="14" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">B</text>
                  <text x="46" y="23" textAnchor="middle" fill="#1D0830" fontSize="14" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">I</text>
                  <text x="18" y="51" textAnchor="middle" fill="#1D0830" fontSize="14" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">G</text>
                  <text x="46" y="51" textAnchor="middle" fill="#1D0830" fontSize="14" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">G</text>
                  <text x="74" y="51" textAnchor="middle" fill="#1D0830" fontSize="14" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">E</text>
                  <text x="46" y="79" textAnchor="middle" fill="#1D0830" fontSize="14" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">R</text>
                  <text x="74" y="79" textAnchor="middle" fill="#1D0830" fontSize="14" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif">!</text>
                </g>

                <text
                  x="114"
                  y="28"
                  fill={darkMode ? '#F6C915' : '#B45309'}
                  fontSize="12"
                  fontWeight="700"
                  letterSpacing="3"
                  fontFamily="JetBrains Mono, monospace"
                >
                  THE MISSING PIECE ATLAS
                </text>
                <text
                  x="112"
                  y="68"
                  fill={darkMode ? '#FFFFFF' : '#3B0D47'}
                  fontSize="42"
                  fontWeight="800"
                  fontFamily="Fraunces, Georgia, serif"
                >
                  MP Colossal
                </text>
                <text
                  x="112"
                  y="102"
                  fill={darkMode ? '#E2D4EE' : '#581C6B'}
                  fontSize="30"
                  fontWeight="600"
                  fontStyle="italic"
                  fontFamily="Fraunces, Georgia, serif"
                >
                  200×200 Crossword
                </text>
              </svg>

              <p className="text-sm text-slate-600 dark:text-purple-100/85 leading-relaxed max-w-lg">
                A monumental interlocking word puzzle built on a 200×200 broadsheet canvas—4× the area of a 100×100 giant crossword, packed with Cinema, Pop Music, TV, Gaming, and World Lore.
              </p>
            </div>

            {/* Grid Scale Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#581c6b] dark:text-purple-300">
                01. Select Atlas Grid Scale
              </label>
              <div className="grid grid-cols-1 gap-2">
                {scales.map((sc) => {
                  const info = SCALE_CONFIG[sc];
                  const active = selectedScale === sc;
                  return (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => onSelectScale(sc)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-4 ${
                        active
                          ? 'bg-[#2B0938] border-[#F6C915] text-white shadow-md'
                          : 'bg-white/80 dark:bg-[#1E0833]/85 border-purple-200 dark:border-purple-800/70 text-[#2B0938] dark:text-purple-100 hover:border-[#D4A437]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className={`text-sm font-bold truncate ${active ? 'text-[#F6C915]' : ''}`}>
                          {info.label}
                        </div>
                        <div className={`text-xs font-mono-tabular mt-0.5 ${active ? 'text-purple-200' : 'text-slate-500 dark:text-purple-300/75'}`}>
                          {info.sublabel}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-mono-tabular font-bold whitespace-nowrap shrink-0 ${
                          active ? 'text-[#F6C915]' : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {active ? 'Selected' : 'Choose'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gameplay Mode + Viewport Layout Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#581c6b] dark:text-purple-300">
                  02. Expedition Mode
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-purple-100/80 dark:bg-[#11031A] rounded-xl border border-purple-200 dark:border-purple-800/70">
                  <button
                    type="button"
                    onClick={() => onSelectMode('quest')}
                    className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      initialMode === 'quest'
                        ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                        : 'text-[#4a1259] dark:text-purple-200 hover:bg-white/50 dark:hover:bg-purple-900/40'
                    }`}
                  >
                    Quest Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectMode('classic')}
                    className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      initialMode === 'classic'
                        ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                        : 'text-[#4a1259] dark:text-purple-200 hover:bg-white/50 dark:hover:bg-purple-900/40'
                    }`}
                  >
                    All Clues
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#581c6b] dark:text-purple-300">
                  03. Viewport Layout
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-purple-100/80 dark:bg-[#11031A] rounded-xl border border-purple-200 dark:border-purple-800/70">
                  <button
                    type="button"
                    onClick={() => onSelectStreamLayout(false)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      !streamLayout
                        ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                        : 'text-[#4a1259] dark:text-purple-200 hover:bg-white/50 dark:hover:bg-purple-900/40'
                    }`}
                  >
                    Full Atlas
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectStreamLayout(true)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      streamLayout
                        ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                        : 'text-[#4a1259] dark:text-purple-200 hover:bg-white/50 dark:hover:bg-purple-900/40'
                    }`}
                  >
                    Stream 12×12
                  </button>
                </div>
              </div>
            </div>

            {/* Primary Start CTA */}
            <div className="pt-1">
              <button
                type="button"
                onClick={onStartGame}
                className="w-full py-3.5 px-6 bg-gradient-to-b from-[#FFE566] to-[#E5B012] hover:brightness-105 active:translate-y-0.5 text-[#1D0830] font-extrabold text-base rounded-xl shadow-[0_10px_28px_rgba(246,201,21,0.3)] border border-[#F6C915] transition-all flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>
                  {hasSavedProgress && savedStats
                    ? `Resume Atlas (${savedStats.solvedWords.toLocaleString()} / ${savedStats.totalWords.toLocaleString()} Words Solved)`
                    : 'Enter The Colossal Grid'}
                </span>
              </button>
            </div>
          </div>

          {/* Single flat control-hint line */}
          <div className="pt-4 mt-5 border-t border-purple-200/80 dark:border-purple-900/60 text-[11px] sm:text-xs text-slate-500 dark:text-purple-300/80 font-mono-tabular flex flex-wrap items-center justify-between gap-2 max-w-xl mx-auto w-full">
            <span>Drag Grid to Pan · Type A–Z to Fill · Space Flip Dir · Esc Menu</span>
            <span>Enter to Start</span>
          </div>
        </div>
      </div>
    </div>
  );
};
