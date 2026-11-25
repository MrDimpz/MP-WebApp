import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  LogIn,
  Moon,
  ShoppingBasket,
  Sun,
  Trophy,
  User as UserIcon,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  getCleanDisplayName,
  saveUnifiedLeaderboardScore,
  subscribeToAllLeaderboards,
  useUnifiedAuth,
  type UnifiedLeaderboardEntry,
} from '@/lib/unified-game-auth';
import {
  getLondonTodayDateStr,
  recordDailyPuzzleSolved,
  useDailyStreak,
} from '@/lib/daily-streak';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import { LoggedInIndicator } from '@/components/logged-in-indicator';
import { UserProfileIcon } from '@/components/user-profile-icon';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';
import { triggerVictoryConfetti } from '@/lib/confetti';
import { CheckoutPanel } from './components/CheckoutPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FinalReceiptView } from './components/FinalReceiptView';
import { HowToPlayView } from './components/HowToPlayView';
import { ItemCard } from './components/ItemCard';
import { LeaderboardView } from './components/LeaderboardView';
import { ProductPackVisual } from './components/ProductPackVisual';
import {
  Difficulty,
  getItemsPoolForDifficulty,
  SUPERMARKET_ITEMS,
} from './data/items';
import {
  buildQuickPlayRound,
  buildThreeRoundSession,
  DIFFICULTY_CONFIGS,
  RoundConfig,
  RoundResult,
  scoreRoundGuess,
} from './utils/gameLogic';
import { playScannerBeep, playTillMiss, playTillSuccess } from './utils/sound';
import {
  loadDarkModePreference,
  loadLocalMuted,
  readTekscodleStats,
  saveDarkModePreference,
  saveLocalMuted,
  writeTekscodleStats,
  type TekscodleLocalStats,
} from './utils/storage';
import { CLOUD_HYDRATED_EVENT } from '@/lib/cloud-progress';

type NavTab = 'play' | 'leaderboard' | 'rules';
type PlayState = 'TITLE_MENU' | 'PLAYING' | 'ROUND_REVEAL' | 'GAME_OVER';
type GameMode = 'daily' | 'practice' | 'quick';

function TekscodleGameContent() {
  const todayDate = useMemo(() => getLondonTodayDateStr(), []);
  const { user: currentUser } = useUnifiedAuth();

  // Navigation, theme & audio
  const [activeTab, setActiveTab] = useState<NavTab>('play');
  const [darkMode, setDarkMode] = useState<boolean>(() => loadDarkModePreference());
  const [muted, setMuted] = useState<boolean>(() => loadLocalMuted());

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveDarkModePreference(darkMode);
  }, [darkMode]);

  useEffect(() => {
    saveLocalMuted(muted);
  }, [muted]);

  // Unified Auth Modal state
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'account' | 'leaderboards'>('account');

  const openSignInModal = useCallback(() => {
    setAuthModalTab('account');
    setShowAuthModal(true);
  }, []);

  const openLeaderboardModal = useCallback(() => {
    setAuthModalTab('leaderboards');
    setShowAuthModal(true);
  }, []);

  // Per-user local stats + public leaderboard entries
  const [stats, setStats] = useState<TekscodleLocalStats>(() => readTekscodleStats());
  const [leaderboardEntries, setLeaderboardEntries] = useState<UnifiedLeaderboardEntry[]>([]);

  useEffect(() => {
    const syncStats = () => {
      setStats(readTekscodleStats());
    };
    syncStats();
    window.addEventListener('unified-auth-updated', syncStats);
    window.addEventListener('mp-site-auth-updated', syncStats);
    window.addEventListener(CLOUD_HYDRATED_EVENT, syncStats);
    return () => {
      window.removeEventListener('unified-auth-updated', syncStats);
      window.removeEventListener('mp-site-auth-updated', syncStats);
      window.removeEventListener(CLOUD_HYDRATED_EVENT, syncStats);
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    const unsub = subscribeToAllLeaderboards((grouped) => {
      setLeaderboardEntries(grouped.tekscodle || []);
    });
    return () => unsub();
  }, []);

  const solvedTodayFlag = useMemo(
    () => stats.dailyCompletedDates.includes(todayDate),
    [stats.dailyCompletedDates, todayDate]
  );

  const dailyStreak = useDailyStreak('tekscodle', todayDate, solvedTodayFlag, 1);

  // Game state machine
  const [playState, setPlayState] = useState<PlayState>('TITLE_MENU');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [selectedMode, setSelectedMode] = useState<'daily' | 'practice'>('daily');
  const [activeMode, setActiveMode] = useState<GameMode>('daily');
  const [rounds, setRounds] = useState<RoundConfig[]>([]);
  const [roundIndex, setRoundIndex] = useState<number>(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [currentReveal, setCurrentReveal] = useState<RoundResult | null>(null);

  // Score posting state
  const [postingStatus, setPostingStatus] = useState<'idle' | 'posting' | 'posted' | 'error'>('idle');
  const [isNewBest, setIsNewBest] = useState<boolean>(false);
  const lastSubmittedRunRef = useRef<string | null>(null);

  const persistAndPublishRun = useCallback(
    async (
      completedResults: RoundResult[],
      completedMode: 'daily' | 'practice',
      completedDiff: Difficulty,
      targetUser: typeof currentUser
    ) => {
      if (completedResults.length < 3) return;
      const totalScore = completedResults.reduce((sum, r) => sum + r.points, 0);
      const avgErr =
        completedResults.reduce((sum, r) => sum + r.absErrorPct, 0) / completedResults.length;

      const currentStats = readTekscodleStats();
      const prevBest = currentStats.bestScore;
      const nextBestScore = Math.max(prevBest, totalScore);
      const personalBestNow = totalScore > prevBest;
      setIsNewBest(personalBestNow);

      const nextDailyDates =
        completedMode === 'daily' && !currentStats.dailyCompletedDates.includes(todayDate)
          ? [...currentStats.dailyCompletedDates, todayDate]
          : currentStats.dailyCompletedDates;

      const runId = `${completedMode}_${completedDiff}_${todayDate}_${Date.now()}`;
      const nextStats: TekscodleLocalStats = {
        ...currentStats,
        bestScore: nextBestScore,
        gamesPlayed: currentStats.gamesPlayed + 1,
        dailyCompletedDates: nextDailyDates,
        recentRuns: [
          {
            id: runId,
            date: todayDate,
            mode: completedMode,
            difficulty: completedDiff,
            round1Score: completedResults[0].points,
            round2Score: completedResults[1].points,
            round3Score: completedResults[2].points,
            totalScore,
            avgErrorPct: avgErr,
            timestamp: Date.now(),
          },
          ...currentStats.recentRuns,
        ].slice(0, 20),
      };

      writeTekscodleStats(nextStats);
      setStats(nextStats);

      if (completedMode === 'daily') {
        recordDailyPuzzleSolved('tekscodle', todayDate, 1);
      }

      setPostingStatus('posting');
      try {
        await saveUnifiedLeaderboardScore({
          user: targetUser,
          gameId: 'tekscodle',
          puzzleId:
            completedMode === 'daily'
              ? `daily_${todayDate}_${completedDiff}`
              : `practice_${completedDiff}`,
          puzzleTitle: `TEKSCOdle ${completedMode === 'daily' ? 'Daily Basket' : 'Practice'} (${DIFFICULTY_CONFIGS[completedDiff].label})`,
          score: nextBestScore,
          metricLabel: `${nextBestScore.toLocaleString()} pts (${avgErr.toFixed(1)}% err)`,
          subMetricLabel: `${DIFFICULTY_CONFIGS[completedDiff].label} · ${completedMode === 'daily' ? todayDate : 'Practice'}`,
        });
        setPostingStatus('posted');
      } catch {
        setPostingStatus('error');
      }
    },
    [todayDate]
  );

  // If user signs in on GAME_OVER screen after playing as guest, sync their score automatically
  useEffect(() => {
    if (
      playState === 'GAME_OVER' &&
      currentUser &&
      (activeMode === 'daily' || activeMode === 'practice') &&
      results.length === 3
    ) {
      const signature = `${currentUser.uid}_${results.map((r) => r.points).join('_')}`;
      if (lastSubmittedRunRef.current !== signature) {
        lastSubmittedRunRef.current = signature;
        setPostingStatus('posting');
        const totalScore = results.reduce((sum, r) => sum + r.points, 0);
        const avgErr = results.reduce((sum, r) => sum + r.absErrorPct, 0) / results.length;
        const bestToPost = Math.max(stats.bestScore, totalScore);
        saveUnifiedLeaderboardScore({
          user: currentUser,
          gameId: 'tekscodle',
          puzzleId:
            activeMode === 'daily'
              ? `daily_${todayDate}_${difficulty}`
              : `practice_${difficulty}`,
          puzzleTitle: `TEKSCOdle ${activeMode === 'daily' ? 'Daily Basket' : 'Practice'} (${DIFFICULTY_CONFIGS[difficulty].label})`,
          score: bestToPost,
          metricLabel: `${bestToPost.toLocaleString()} pts (${avgErr.toFixed(1)}% err)`,
          subMetricLabel: `${DIFFICULTY_CONFIGS[difficulty].label} · ${activeMode === 'daily' ? todayDate : 'Practice'}`,
        })
          .then(() => setPostingStatus('posted'))
          .catch(() => setPostingStatus('error'));
      }
    }
  }, [playState, currentUser, activeMode, results, difficulty, todayDate, stats.bestScore]);

  const startFullGame = useCallback(
    (modeOverride?: 'daily' | 'practice', diffOverride?: Difficulty) => {
      const modeToUse = modeOverride ?? selectedMode;
      const diffToUse = diffOverride ?? difficulty;
      const sessionRounds = buildThreeRoundSession(diffToUse, modeToUse, todayDate);
      setActiveMode(modeToUse);
      setDifficulty(diffToUse);
      setRounds(sessionRounds);
      setRoundIndex(0);
      setResults([]);
      setCurrentReveal(null);
      setPostingStatus('idle');
      setIsNewBest(false);
      lastSubmittedRunRef.current = null;
      setPlayState('PLAYING');
      setActiveTab('play');
      playScannerBeep(muted);
    },
    [selectedMode, difficulty, todayDate, muted]
  );

  const startQuickPlay = useCallback(
    (diffOverride?: Difficulty) => {
      const diffToUse = diffOverride ?? difficulty;
      const previousIds = rounds[0]?.items.map((i) => i.id) ?? [];
      const quickRound = buildQuickPlayRound(diffToUse, previousIds);
      setActiveMode('quick');
      setDifficulty(diffToUse);
      setRounds([quickRound]);
      setRoundIndex(0);
      setResults([]);
      setCurrentReveal(null);
      setPostingStatus('idle');
      lastSubmittedRunRef.current = null;
      setPlayState('PLAYING');
      setActiveTab('play');
      playScannerBeep(muted);
    },
    [difficulty, muted, rounds]
  );

  const handleSubmitGuess = useCallback(
    (guessPence: number) => {
      const activeRound = rounds[roundIndex];
      if (!activeRound) return;
      const result = scoreRoundGuess(activeRound, guessPence, difficulty);
      setCurrentReveal(result);
      setResults((prev) => [...prev, result]);
      setPlayState('ROUND_REVEAL');

      if (result.inZone) {
        playTillSuccess(muted, result.diffPence === 0);
      } else {
        playTillMiss(muted);
      }

      if (activeMode === 'quick') {
        const currentStats = readTekscodleStats();
        const nextStats: TekscodleLocalStats = {
          ...currentStats,
          quickPlays: currentStats.quickPlays + 1,
        };
        writeTekscodleStats(nextStats);
        setStats(nextStats);
      }
    },
    [rounds, roundIndex, difficulty, muted, activeMode]
  );

  const handleNextRound = useCallback(async () => {
    if (roundIndex + 1 < rounds.length) {
      setRoundIndex((prev) => prev + 1);
      setCurrentReveal(null);
      setPlayState('PLAYING');
      playScannerBeep(muted);
    } else {
      setCurrentReveal(null);
      setPlayState('GAME_OVER');
      triggerVictoryConfetti();
      if (activeMode === 'daily' || activeMode === 'practice') {
        if (currentUser) {
          lastSubmittedRunRef.current = `${currentUser.uid}_${results.map((r) => r.points).join('_')}`;
        }
        await persistAndPublishRun(results, activeMode, difficulty, currentUser);
      }
    }
  }, [
    roundIndex,
    rounds.length,
    muted,
    activeMode,
    results,
    difficulty,
    currentUser,
    persistAndPublishRun,
  ]);

  const activeDifficultyCfg = DIFFICULTY_CONFIGS[difficulty];
  const activePool = useMemo(() => getItemsPoolForDifficulty(difficulty), [difficulty]);
  const previewItems = useMemo(() => {
    const photographed = activePool.filter((item) => Boolean(item.image));
    const source = photographed.length >= 3 ? photographed : activePool;
    if (source.length <= 3) return source;
    const mid = Math.floor(source.length / 2);
    return [source[0], source[mid], source[source.length - 1]];
  }, [activePool]);

  const totalCatalogCount = SUPERMARKET_ITEMS.length;
  const totalAisleCount = useMemo(
    () => new Set(SUPERMARKET_ITEMS.map((item) => item.aisle)).size,
    []
  );

  const currentRound = rounds[roundIndex];
  const cumulativeScore = results.reduce((sum, r) => sum + r.points, 0);

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-gradient-to-b from-[#FBF8F1] via-[#F4EFE4] to-[#EDE4D3] text-[#2B0938] dark:from-[#160524] dark:via-[#1E0633] dark:to-[#11031A] dark:text-[#F5F3F7] transition-colors overflow-x-hidden">
      {/* 25% Opacity Missing Piece Background Watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 flex items-center justify-center z-0 overflow-hidden"
      >
        <img
          src="/brand-logo.png"
          alt=""
          className="w-[340px] h-[340px] sm:w-[680px] sm:h-[680px] object-contain opacity-25 select-none"
        />
      </div>

      {/* UNIFIED MISSING PIECE TOP NAVIGATION HEADER */}
      <header className="sticky top-0 z-40 border-b border-purple-200/80 dark:border-purple-900/60 bg-white/90 dark:bg-[#1a0624]/90 backdrop-blur-md transition-colors">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 min-h-14 sm:min-h-16 py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          {/* Zone 1: Back to Solo Games & Brand Wordmark */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link
              to="/solo-games"
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#4a1259] dark:text-amber-300 bg-purple-100/80 dark:bg-purple-900/50 hover:bg-purple-200/80 dark:hover:bg-purple-800/60 border border-purple-200/80 dark:border-purple-700/60 transition-colors whitespace-nowrap"
              title="Back to Solo Games"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Solo Games</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setActiveTab('play');
                setPlayState('TITLE_MENU');
              }}
              className="flex items-center gap-1.5 sm:gap-2.5 text-left group shrink-0 focus:outline-none cursor-pointer"
            >
              <img
                src="/assets/aistudio/3d_logo_944e5372.png"
                alt="TEKSCOdle - The Missing Piece Logo"
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-contain drop-shadow-md group-hover:scale-105 transition-transform"
              />
              <div>
                <span className="text-base sm:text-xl font-black tracking-tight text-[#3b0d47] dark:text-white block leading-none">
                  TEKSCO<span className="text-amber-500 dark:text-[#F6C915]">dle</span>
                </span>
                <span className="block h-1 w-full mt-0.5 teksco-chevrons rounded-xs" />
                <span className="hidden sm:block text-[9px] uppercase font-bold text-[#581c6b] dark:text-amber-300/80 tracking-wider mt-0.5">
                  The Missing Piece
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation Tabs */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-5 text-sm font-bold text-slate-600 dark:text-purple-200/80"
          >
            <button
              type="button"
              onClick={() => setActiveTab('play')}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                activeTab === 'play' && activeMode !== 'quick'
                  ? 'border-[#581c6b] dark:border-[#F6C915] text-[#581c6b] dark:text-[#F6C915]'
                  : 'border-transparent hover:text-[#2B0938] dark:hover:text-white'
              }`}
            >
              Play
            </button>
            <button
              type="button"
              onClick={() => startQuickPlay()}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer flex items-center gap-1 ${
                activeTab === 'play' && activeMode === 'quick' && playState !== 'TITLE_MENU'
                  ? 'border-[#581c6b] dark:border-[#F6C915] text-[#581c6b] dark:text-[#F6C915]'
                  : 'border-transparent hover:text-[#2B0938] dark:hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-[#F6C915]" />
              <span>Quick Play</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer flex items-center gap-1 ${
                activeTab === 'leaderboard'
                  ? 'border-[#581c6b] dark:border-[#F6C915] text-[#581c6b] dark:text-[#F6C915]'
                  : 'border-transparent hover:text-[#2B0938] dark:hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500 dark:text-[#F6C915]" />
              <span>Leaderboard</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer flex items-center gap-1 ${
                activeTab === 'rules'
                  ? 'border-[#581c6b] dark:border-[#F6C915] text-[#581c6b] dark:text-[#F6C915]'
                  : 'border-transparent hover:text-[#2B0938] dark:hover:text-white'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>How to Play</span>
            </button>
          </nav>

          {/* Zone 3: Streaks, Unified Account, Leaderboards, Audio & Theme */}
          <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
            <DailyStreakBadge
              streak={dailyStreak.streak}
              solvedToday={dailyStreak.solvedToday}
              variant="gold"
              compact
            />

            <div className="hidden lg:block">
              <LoggedInIndicator />
            </div>

            <button
              type="button"
              onClick={openLeaderboardModal}
              title="All Missing Piece Solo Leaderboards"
              className="p-1.5 sm:p-2 rounded-xl text-amber-600 dark:text-[#F6C915] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 transition-colors cursor-pointer"
            >
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {currentUser ? (
              <button
                type="button"
                onClick={openSignInModal}
                title="Account & Display Name"
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-colors cursor-pointer"
              >
                <UserProfileIcon
                  user={currentUser}
                  className="w-4 h-4 shrink-0"
                  fallback={<UserIcon className="w-3.5 h-3.5 shrink-0" />}
                />
                <span className="hidden xs:inline max-w-[75px] sm:max-w-[115px] truncate">
                  {getCleanDisplayName(currentUser)}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openSignInModal}
                title="Sign in with Google or Email & Password"
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#2d0938] dark:bg-purple-900/70 hover:bg-[#3b0d47] text-[#F6C915] border border-[#F6C915]/40 text-xs font-bold transition-colors cursor-pointer shadow-xs whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xs:inline">Sign In</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              title={muted ? 'Unmute till sounds' : 'Mute till sounds'}
              className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-100/70 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" />
              ) : (
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-100/70 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-[#F6C915]" />
              ) : (
                <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-[#4a1259]" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Secondary Sub-Nav */}
        <div className="md:hidden border-t border-purple-200/60 dark:border-purple-900/60 px-3 py-1.5 flex items-center justify-around text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('play')}
            className={`px-2.5 py-1 rounded-lg ${
              activeTab === 'play' && activeMode !== 'quick'
                ? 'bg-[#F6C915] text-[#1D0830]'
                : 'text-slate-600 dark:text-purple-200'
            }`}
          >
            Play
          </button>
          <button
            type="button"
            onClick={() => startQuickPlay()}
            className={`px-2.5 py-1 rounded-lg ${
              activeTab === 'play' && activeMode === 'quick' && playState !== 'TITLE_MENU'
                ? 'bg-[#F6C915] text-[#1D0830]'
                : 'text-slate-600 dark:text-purple-200'
            }`}
          >
            Quick Play
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            className={`px-2.5 py-1 rounded-lg ${
              activeTab === 'leaderboard'
                ? 'bg-[#F6C915] text-[#1D0830]'
                : 'text-slate-600 dark:text-purple-200'
            }`}
          >
            Leaderboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-2.5 py-1 rounded-lg ${
              activeTab === 'rules'
                ? 'bg-[#F6C915] text-[#1D0830]'
                : 'text-slate-600 dark:text-purple-200'
            }`}
          >
            Rules
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* TAB 1: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <LeaderboardView
            user={currentUser}
            stats={stats}
            dailyStreak={dailyStreak.streak}
            entries={leaderboardEntries}
            todayDate={todayDate}
            onOpenAuth={(tab) => {
              setAuthModalTab(tab);
              setShowAuthModal(true);
            }}
            onStartPlay={() => {
              setActiveTab('play');
              if (playState === 'GAME_OVER') setPlayState('TITLE_MENU');
            }}
          />
        )}

        {/* TAB 2: HOW TO PLAY */}
        {activeTab === 'rules' && (
          <HowToPlayView
            onStartPlay={() => startFullGame()}
            onQuickPlay={() => startQuickPlay()}
          />
        )}

        {/* TAB 3: PLAY - TITLE MENU */}
        {activeTab === 'play' && playState === 'TITLE_MENU' && (
          <div className="space-y-8">
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Left Column: Setup & Primary Actions */}
              <div className="lg:col-span-7 bg-white/95 dark:bg-[#220836]/95 border border-purple-200 dark:border-purple-800/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-lg">
                <div>
                  <div className="flex items-center flex-wrap gap-2 text-xs font-bold text-[#581c6b] dark:text-[#F6C915] mb-2">
                    <span>UK Supermarket Checkout Challenge</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-500 dark:text-purple-200/80 font-medium">
                      {totalCatalogCount} Products across {totalAisleCount} Aisles
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-500 dark:text-purple-200/80 font-mono font-medium">
                      Daily {todayDate}
                    </span>
                  </div>

                  <h1 className="font-display text-3xl sm:text-5xl font-black text-[#2B0938] dark:text-white tracking-tight leading-[1.1] text-balance mb-4">
                    Price the basket before the till rings.
                  </h1>
                  <p className="text-base text-slate-600 dark:text-purple-100/85 leading-relaxed max-w-xl">
                    Guess real UK supermarket prices across <strong>1 item</strong>,{' '}
                    <strong>3 items</strong>, and <strong>5 items</strong>. Land within the
                    accuracy margin to score points—the closer your guess, the higher you
                    climb on The Missing Piece leaderboard.
                  </p>
                </div>

                {/* Difficulty & Mode Selectors */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#2B0938] dark:text-white">
                        Select Difficulty
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-[#F6C915] tabular-nums font-semibold">
                        ±{activeDifficultyCfg.marginPct}% margin · Up to{' '}
                        {activeDifficultyCfg.maxTotalPoints.toLocaleString()} pts
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-1.5 bg-purple-100/80 dark:bg-[#160524] border border-purple-200/70 dark:border-purple-800/70 rounded-xl">
                      {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => {
                        const cfg = DIFFICULTY_CONFIGS[level];
                        const isActive = difficulty === level;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setDifficulty(level)}
                            className={`py-2.5 px-3 rounded-lg text-left transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-[#F6C915] text-[#1D0830] shadow-sm'
                                : 'text-slate-600 dark:text-purple-200 hover:text-[#2B0938] dark:hover:text-white'
                            }`}
                          >
                            <div className="text-sm font-extrabold leading-tight">
                              {cfg.label}
                            </div>
                            <div
                              className={`text-[11px] font-mono mt-0.5 tabular-nums ${
                                isActive
                                  ? 'text-[#1D0830]/80 font-bold'
                                  : 'text-slate-500 dark:text-purple-300/75'
                              }`}
                            >
                              ±{cfg.marginPct}% · {cfg.subtitle}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-purple-200/75 mt-2">
                      {activeDifficultyCfg.poolDescription}
                    </p>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-purple-100 dark:border-purple-800/70">
                    <div className="inline-flex items-center p-1 bg-purple-100/80 dark:bg-[#160524] border border-purple-200/70 dark:border-purple-800/70 rounded-xl self-start">
                      <button
                        type="button"
                        onClick={() => setSelectedMode('daily')}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                          selectedMode === 'daily'
                            ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                            : 'text-slate-600 dark:text-purple-200 hover:text-[#2B0938] dark:hover:text-white'
                        }`}
                      >
                        Daily Basket
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMode('practice')}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                          selectedMode === 'practice'
                            ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                            : 'text-slate-600 dark:text-purple-200 hover:text-[#2B0938] dark:hover:text-white'
                        }`}
                      >
                        Endless Practice
                      </button>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-purple-200/75">
                      {selectedMode === 'daily'
                        ? 'Same 9 items for everyone worldwide today.'
                        : 'Freshly shuffled 1, 3 & 5 item baskets every run.'}
                    </span>
                  </div>

                  {/* Primary Action Row */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => startFullGame()}
                      className="flex-1 py-3.5 px-6 bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-extrabold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-md"
                    >
                      <span>
                        Start {selectedMode === 'daily' ? 'Daily Basket' : '3-Round Game'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startQuickPlay()}
                      className="py-3.5 px-5 bg-[#2B0938] dark:bg-purple-800/80 hover:bg-[#3B0F54] dark:hover:bg-purple-700 text-[#F6C915] border border-[#F6C915]/40 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Quick Play</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Difficulty Shelf Preview */}
              <div className="lg:col-span-5 bg-white/95 dark:bg-[#220836]/95 border border-purple-200 dark:border-purple-800/80 rounded-2xl p-6 flex flex-col justify-between gap-5 shadow-lg">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-purple-200/75 mb-3">
                    <span className="font-bold text-[#2B0938] dark:text-[#F6C915]">
                      Sample {activeDifficultyCfg.label} Aisle ({activePool.length} items)
                    </span>
                    <span className="font-mono">Prices hidden until checkout</span>
                  </div>
                  <div className="space-y-3">
                    {previewItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-2.5 bg-purple-50/70 dark:bg-[#190529] rounded-xl border border-purple-100 dark:border-purple-800/70"
                      >
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className={
                              item.image.startsWith('/tekscodle/images/catalog/')
                                ? 'w-20 h-16 object-contain rounded-lg bg-white border border-purple-100 p-1 shrink-0'
                                : 'w-20 h-16 object-cover rounded-lg bg-slate-200 shrink-0'
                            }
                          />
                        ) : (
                          <div className="w-20 h-16 rounded-lg overflow-hidden bg-[#EEF2F6] shrink-0">
                            <ProductPackVisual item={item} compact />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-slate-500 dark:text-purple-200/75 truncate">
                            {item.aisle} · {item.packSize}
                          </div>
                          <div className="font-display font-bold text-sm text-[#2B0938] dark:text-white truncate">
                            {item.name}
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold text-[#581c6b] dark:text-[#F6C915] pr-1 shrink-0">
                          £?.??
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3-Round Escalation Summary */}
                <div className="pt-4 border-t border-purple-100 dark:border-purple-800/70 grid grid-cols-3 gap-3 text-center">
                  <div className="bg-purple-50/80 dark:bg-[#190529] border border-purple-100 dark:border-purple-800/60 rounded-xl py-2.5 px-2">
                    <div className="text-[11px] text-slate-500 dark:text-purple-200/75">Round 1</div>
                    <div className="font-display font-bold text-sm text-[#2B0938] dark:text-white">
                      1 Item
                    </div>
                  </div>
                  <div className="bg-purple-50/80 dark:bg-[#190529] border border-purple-100 dark:border-purple-800/60 rounded-xl py-2.5 px-2">
                    <div className="text-[11px] text-slate-500 dark:text-purple-200/75">Round 2</div>
                    <div className="font-display font-bold text-sm text-[#2B0938] dark:text-white">
                      3 Items
                    </div>
                  </div>
                  <div className="bg-purple-50/80 dark:bg-[#190529] border border-purple-100 dark:border-purple-800/60 rounded-xl py-2.5 px-2">
                    <div className="text-[11px] text-slate-500 dark:text-purple-200/75">Round 3</div>
                    <div className="font-display font-bold text-sm text-[#2B0938] dark:text-white">
                      5 Items
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: PLAY - ACTIVE GAMEPLAY & ROUND REVEAL */}
        {activeTab === 'play' &&
          (playState === 'PLAYING' || playState === 'ROUND_REVEAL') &&
          currentRound && (
            <div className="space-y-6">
              {/* Top Workspace HUD Bar */}
              <div className="bg-white/95 dark:bg-[#220836]/95 border border-purple-200 dark:border-purple-800/80 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3 flex-wrap">
                  <ShoppingBasket className="w-4 h-4 text-[#581c6b] dark:text-[#F6C915] shrink-0" />
                  <span className="font-display font-bold text-sm text-[#2B0938] dark:text-white">
                    {activeMode === 'quick'
                      ? 'Quick Play'
                      : activeMode === 'daily'
                        ? `Daily Basket · ${todayDate}`
                        : 'Practice Shop'}
                  </span>
                  <span className="text-purple-300 dark:text-purple-700" aria-hidden="true">
                    /
                  </span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-purple-200">
                    {activeDifficultyCfg.label} (±{activeDifficultyCfg.marginPct}%)
                  </span>
                </div>

                {activeMode !== 'quick' ? (
                  <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                    {[1, 3, 5].map((cnt, idx) => {
                      const done =
                        idx < results.length &&
                        !(idx === roundIndex && playState === 'ROUND_REVEAL');
                      const isCurrent = idx === roundIndex;
                      return (
                        <span
                          key={cnt}
                          className={
                            isCurrent
                              ? 'font-extrabold text-[#581c6b] dark:text-[#F6C915]'
                              : done
                                ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                : 'text-slate-400 dark:text-purple-300/50'
                          }
                        >
                          R{idx + 1}: {cnt} {cnt === 1 ? 'Item' : 'Items'}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="inline-flex items-center p-0.5 bg-purple-100/80 dark:bg-[#160524] rounded-lg">
                    {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => startQuickPlay(level)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md capitalize transition-colors whitespace-nowrap cursor-pointer ${
                          difficulty === level
                            ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                            : 'text-slate-500 dark:text-purple-200 hover:text-[#2B0938] dark:hover:text-white'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPlayState('TITLE_MENU')}
                    className="text-xs font-bold text-[#581c6b] dark:text-[#F6C915] hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Change Setup
                  </button>
                </div>
              </div>

              {/* 12-Column Play Arena: Basket Items (8 cols) + Checkout Till (4 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <h1 className="font-display text-2xl font-bold text-[#2B0938] dark:text-white">
                        {currentRound.title}
                      </h1>
                      <p className="text-sm text-slate-600 dark:text-purple-200/80">
                        {currentRound.itemCount === 1
                          ? 'Inspect the product, pack size, and aisle note, then estimate its exact UK shelf price.'
                          : `Estimate the combined checkout total for all ${currentRound.itemCount} items in this basket.`}
                      </p>
                    </div>
                  </div>

                  <div
                    className={
                      currentRound.itemCount === 1
                        ? 'grid grid-cols-1 gap-5'
                        : currentRound.itemCount === 3
                          ? 'grid grid-cols-1 sm:grid-cols-3 gap-4'
                          : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'
                    }
                  >
                    {currentRound.items.map((item, idx) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        index={idx}
                        totalInBasket={currentRound.itemCount}
                        revealed={playState === 'ROUND_REVEAL'}
                      />
                    ))}
                  </div>
                </div>

                {/* Sticky Checkout Till Panel */}
                <div className="lg:col-span-4 lg:sticky lg:top-24">
                  <CheckoutPanel
                    round={currentRound}
                    roundIndex={roundIndex}
                    totalRounds={rounds.length}
                    difficulty={difficulty}
                    mode={activeMode}
                    cumulativeScore={cumulativeScore}
                    revealedResult={currentReveal}
                    onSubmitGuess={handleSubmitGuess}
                    onNextRound={handleNextRound}
                    onNextQuickPlay={() => startQuickPlay()}
                    onSwitchToFullGame={() => startFullGame('daily')}
                  />
                </div>
              </div>
            </div>
          )}

        {/* TAB 3: PLAY - FINAL RECEIPT VIEW */}
        {activeTab === 'play' &&
          playState === 'GAME_OVER' &&
          (activeMode === 'daily' || activeMode === 'practice') && (
            <FinalReceiptView
              results={results}
              difficulty={difficulty}
              mode={activeMode}
              dailyDate={todayDate}
              user={currentUser}
              postingStatus={postingStatus}
              isNewBest={isNewBest}
              onSignInAndPost={openSignInModal}
              onPlayAgain={() => startFullGame('practice')}
              onQuickPlay={() => startQuickPlay()}
              onViewLeaderboard={() => setActiveTab('leaderboard')}
            />
          )}
      </main>

      {/* Quiet Footer */}
      <footer className="relative z-10 border-t border-purple-200/80 dark:border-purple-900/60 bg-white/85 dark:bg-[#1a0624]/85 backdrop-blur-sm mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-purple-200/75">
          <span>
            TEKSCOdle by The Missing Piece — UK supermarket price-guessing challenge. Prices reflect typical UK retail benchmarks.
          </span>
          <div className="flex items-center gap-5 font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className="hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors whitespace-nowrap cursor-pointer"
            >
              Scoring Rules
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className="hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors whitespace-nowrap cursor-pointer"
            >
              Public Rankings
            </button>
            <Link
              to="/solo-games"
              className="hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors whitespace-nowrap"
            >
              All Solo Games
            </Link>
          </div>
        </div>
      </footer>

      <UnifiedAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        user={currentUser}
        initialGameId="tekscodle"
        initialTab={authModalTab}
      />
    </div>
  );
}

export default function TekscodleApp() {
  return (
    <ErrorBoundary>
      <TekscodleGameContent />
    </ErrorBoundary>
  );
}
