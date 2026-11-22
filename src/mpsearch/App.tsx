import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  Flame,
  HelpCircle,
  Lightbulb,
  LogIn,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Trophy,
  Type,
  User as UserIcon,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  getCleanDisplayName,
  saveUnifiedLeaderboardScore,
  useUnifiedAuth,
} from '@/lib/unified-game-auth';
import {
  getLondonTodayDateStr,
  recordDailyPuzzleSolved,
  useDailyStreak,
} from '@/lib/daily-streak';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import { UserProfileIcon } from '@/components/user-profile-icon';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';
import { LanguageMenu } from '@/components/language-menu';
import { useDictionaryLanguage } from '@/lib/dictionary-languages';
import { triggerVictoryConfetti } from '@/lib/confetti';
import {
  generateSixMonthArchive,
  calculatePuzzleScore,
  formatDuration,
} from './utils/puzzleGenerator';
import { WordSearchBoard } from './components/WordSearchBoard';
import { ProgressArchiveModal } from './components/ProgressArchiveModal';
import { soundFX } from './utils/sound';
import {
  LocalPuzzleProgress,
  readStoredProgressMap,
  writeStoredProgressMap,
} from './firebase';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'ROUND_SUMMARY';

const LOCAL_STORAGE_THEME_KEY = 'mpsearch_dark_mode_v2';
const LOCAL_STORAGE_LARGE_PRINT_KEY = 'mpsearch_large_print';

export default function App() {
  const todayDateStr = useMemo(() => getLondonTodayDateStr(), []);
  const [dictionaryLanguage] = useDictionaryLanguage();
  // Generate 12-month (368 days) deterministic daily archive anchored to today's London date
  const archive = useMemo(
    () => generateSixMonthArchive(todayDateStr, dictionaryLanguage),
    [todayDateStr, dictionaryLanguage]
  );
  const latestPuzzle = archive[archive.length - 1];

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [currentDateKey, setCurrentDateKey] = useState<string>(latestPuzzle.dateKey);
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  // Unified Solo Games Auth & Leaderboard Modal State
  const { user: currentUser } = useUnifiedAuth();
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'account' | 'leaderboards'>('leaderboards');

  const openSignInModal = useCallback(() => {
    setAuthModalTab('account');
    setShowAuthModal(true);
  }, []);

  const openUnifiedLeaderboardModal = useCallback(() => {
    setAuthModalTab('leaderboards');
    setShowAuthModal(true);
  }, []);

  // Dark Mode & Readability state (defaults to dark mode)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_THEME_KEY);
      if (saved !== null) return saved !== 'false';
    } catch {
      // Ignore
    }
    return true;
  });

  const [largePrint, setLargePrint] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_LARGE_PRINT_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => soundFX.isMuted());

  // Per-user Progress Map keyed by dateKey (YYYY-MM-DD)
  const [progressMap, setProgressMap] = useState<Record<string, LocalPuzzleProgress>>(() =>
    readStoredProgressMap()
  );

  // Reload per-user progress when unified auth session changes
  useEffect(() => {
    const syncStores = () => {
      setProgressMap(readStoredProgressMap());
    };
    syncStores();
    window.addEventListener('unified-auth-updated', syncStores);
    window.addEventListener('mp-site-auth-updated', syncStores);
    return () => {
      window.removeEventListener('unified-auth-updated', syncStores);
      window.removeEventListener('mp-site-auth-updated', syncStores);
    };
  }, [currentUser?.uid]);

  // Active Puzzle Session State
  const currentPuzzle = useMemo(
    () => archive.find((p) => p.dateKey === currentDateKey) || latestPuzzle,
    [archive, currentDateKey, latestPuzzle]
  );

  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [recentlyFoundWord, setRecentlyFoundWord] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [hintTargetWord, setHintTargetWord] = useState<string | null>(null);
  const [hintTier, setHintTier] = useState<number>(0); // 0..4

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_THEME_KEY, String(darkMode));
    } catch {
      // Ignore
    }
  }, [darkMode]);

  // Persist largePrint setting
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_LARGE_PRINT_KEY, String(largePrint));
    } catch {
      // Ignore
    }
  }, [largePrint]);

  // Persist progressMap to localStorage
  useEffect(() => {
    writeStoredProgressMap(progressMap);
  }, [progressMap]);

  // Load saved state when switching currentDateKey
  const loadPuzzleSession = useCallback(
    (dateKey: string, forceFreshReplay = false) => {
      const targetPuzzle = archive.find((p) => p.dateKey === dateKey) || latestPuzzle;
      const saved = progressMap[targetPuzzle.dateKey];
      const validWordSet = new Set(targetPuzzle.words.map((w) => w.word));
      const matchingSavedWords = saved
        ? saved.foundWords.filter((w) => validWordSet.has(w))
        : [];
      const savedMatchesCurrentPuzzle =
        Boolean(saved) &&
        (saved.foundWords.length === 0 || matchingSavedWords.length === saved.foundWords.length);

      if (
        saved &&
        savedMatchesCurrentPuzzle &&
        !forceFreshReplay &&
        saved.completedCount === 0 &&
        matchingSavedWords.length < targetPuzzle.words.length
      ) {
        setFoundWords(matchingSavedWords);
        setElapsedSeconds(saved.elapsedSeconds);
        setHintsUsed(saved.hintsUsed);
      } else if (
        saved &&
        savedMatchesCurrentPuzzle &&
        !forceFreshReplay &&
        saved.completedCount >= 1 &&
        matchingSavedWords.length === targetPuzzle.words.length
      ) {
        setFoundWords(matchingSavedWords);
        setElapsedSeconds(saved.bestTimeSeconds || saved.elapsedSeconds);
        setHintsUsed(saved.hintsUsed);
      } else {
        setFoundWords([]);
        setElapsedSeconds(0);
        setHintsUsed(0);
      }
      setHintTargetWord(null);
      setHintTier(0);
    },
    [archive, latestPuzzle, progressMap]
  );

  // Initialize session on first mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      loadPuzzleSession(latestPuzzle.dateKey);
    }
  }, [latestPuzzle.dateKey, loadPuzzleSession]);

  // Reset active board state cleanly when switching dictionary language
  const prevDictionaryLangRef = useRef(dictionaryLanguage);
  useEffect(() => {
    if (prevDictionaryLangRef.current !== dictionaryLanguage) {
      prevDictionaryLangRef.current = dictionaryLanguage;
      loadPuzzleSession(currentDateKey, true);
      setRecentlyFoundWord(null);
      setGameState((prev) => (prev === 'ROUND_SUMMARY' ? 'PLAYING' : prev));
    }
  }, [dictionaryLanguage, currentDateKey, loadPuzzleSession]);

  const isPuzzleComplete = foundWords.length === currentPuzzle.words.length;

  // 1-second Gameplay Timer
  useEffect(() => {
    if (gameState !== 'PLAYING' || isPuzzleComplete || isArchiveOpen || showHowToPlay || showAuthModal) {
      return;
    }
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => Math.min(86400, prev + 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [gameState, isPuzzleComplete, isArchiveOpen, showHowToPlay, showAuthModal]);

  // Overall summary stats & streak
  const globalStats = useMemo(() => {
    let solved = 0;
    let bestScore = 0;
    let fastest = 0;
    archive.forEach((p) => {
      const rec = progressMap[p.dateKey];
      if (rec && rec.completedCount >= 1) {
        solved++;
        if (rec.highScore > bestScore) bestScore = rec.highScore;
        if (rec.bestTimeSeconds > 0 && (fastest === 0 || rec.bestTimeSeconds < fastest)) {
          fastest = rec.bestTimeSeconds;
        }
      }
    });

    let streak = 0;
    for (let i = archive.length - 1; i >= 0; i--) {
      const rec = progressMap[archive[i].dateKey];
      if (rec && rec.completedCount >= 1) {
        streak++;
      } else if (i === archive.length - 1) {
        continue;
      } else {
        break;
      }
    }

    return { solved, bestScore, fastest, streak };
  }, [archive, progressMap]);

  const solvedToday = (progressMap[latestPuzzle.dateKey]?.completedCount || 0) >= 1;
  const dailyStreak = useDailyStreak('mpsearch', latestPuzzle.dateKey, solvedToday, globalStats.streak);

  // Helper to persist progress locally and to the Unified Solo Games Leaderboard
  const recordProgressUpdate = useCallback(
    (
      nextFoundWords: string[],
      nextElapsed: number,
      nextHintsUsed: number,
      justCompleted: boolean
    ) => {
      const existing = progressMap[currentPuzzle.dateKey];
      const prevCompletedCount = existing?.completedCount || 0;
      const nextCompletedCount = justCompleted
        ? prevCompletedCount + 1
        : prevCompletedCount;

      const currentRunScore = calculatePuzzleScore(
        nextFoundWords.length,
        currentPuzzle.words.length,
        nextElapsed,
        nextHintsUsed,
        justCompleted || prevCompletedCount >= 1
      );

      const nextHighScore = Math.max(existing?.highScore || 0, currentRunScore);
      const prevBestTime = existing?.bestTimeSeconds || 0;
      const nextBestTime = justCompleted
        ? prevBestTime > 0
          ? Math.min(prevBestTime, nextElapsed)
          : nextElapsed
        : prevBestTime;

      const updatedRecord: LocalPuzzleProgress = {
        dateKey: currentPuzzle.dateKey,
        puzzleNumber: currentPuzzle.puzzleNumber,
        themeTitle: currentPuzzle.themeTitle,
        category: currentPuzzle.category,
        foundWords: nextFoundWords,
        totalWords: currentPuzzle.words.length,
        elapsedSeconds: nextElapsed,
        bestTimeSeconds: nextBestTime,
        highScore: nextHighScore,
        hintsUsed: nextHintsUsed,
        completedCount: nextCompletedCount,
        updatedAtIso: new Date().toISOString(),
        existsInCloud: Boolean(currentUser),
      };

      setProgressMap((prev) => ({
        ...prev,
        [currentPuzzle.dateKey]: updatedRecord,
      }));

      if (justCompleted) {
        recordDailyPuzzleSolved('mpsearch', latestPuzzle.dateKey, globalStats.streak + 1);
        const allTimeBest = Math.max(globalStats.bestScore, nextHighScore);
        saveUnifiedLeaderboardScore({
          user: currentUser,
          gameId: 'mpsearch',
          puzzleId: currentPuzzle.dateKey,
          puzzleTitle: currentPuzzle.themeTitle,
          score: allTimeBest,
          metricLabel: `${allTimeBest.toLocaleString()} pts (${formatDuration(nextBestTime || nextElapsed)})`,
          subMetricLabel: `#${currentPuzzle.puzzleNumber} · ${currentPuzzle.themeTitle} · ${formatDuration(nextBestTime || nextElapsed)}`,
        }).catch(() => {});
      }
    },
    [currentPuzzle, progressMap, currentUser, latestPuzzle.dateKey, globalStats.streak, globalStats.bestScore]
  );

  // Handle finding a word on the 10x10 board
  const handleWordFound = useCallback(
    (word: string) => {
      if (foundWords.includes(word)) return;
      const nextFound = [...foundWords, word];
      setFoundWords(nextFound);
      setRecentlyFoundWord(word);
      window.setTimeout(() => {
        setRecentlyFoundWord((prev) => (prev === word ? null : prev));
      }, 1500);

      if (hintTargetWord === word) {
        setHintTargetWord(null);
        setHintTier(0);
      }

      const completedNow = nextFound.length === currentPuzzle.words.length;
      if (completedNow) {
        soundFX.playPuzzleVictory();
        triggerVictoryConfetti();
        recordProgressUpdate(nextFound, elapsedSeconds, hintsUsed, true);
        setGameState('ROUND_SUMMARY');
      } else {
        soundFX.playWordFound();
        recordProgressUpdate(nextFound, elapsedSeconds, hintsUsed, false);
      }
    },
    [
      foundWords,
      hintTargetWord,
      currentPuzzle.words.length,
      elapsedSeconds,
      hintsUsed,
      recordProgressUpdate,
    ]
  );

  // 4-Tier Progressive Hint System
  const handleRevealHint = useCallback(() => {
    if (isPuzzleComplete) return;
    const unfoundWords = currentPuzzle.words.filter((w) => !foundWords.includes(w.word));
    if (unfoundWords.length === 0) return;

    let target = hintTargetWord;
    if (!target || foundWords.includes(target)) {
      target = unfoundWords[0].word;
      setHintTargetWord(target);
      setHintTier(1);
      const nextHints = hintsUsed + 1;
      setHintsUsed(nextHints);
      soundFX.playHintReveal(1);
      recordProgressUpdate(foundWords, elapsedSeconds, nextHints, false);
      return;
    }

    if (hintTier < 4) {
      const nextTier = hintTier + 1;
      setHintTier(nextTier);
      const nextHints = hintsUsed + 1;
      setHintsUsed(nextHints);
      soundFX.playHintReveal(nextTier);
      recordProgressUpdate(foundWords, elapsedSeconds, nextHints, false);
    } else {
      const currentIdx = unfoundWords.findIndex((w) => w.word === target);
      const nextWordObj = unfoundWords[(currentIdx + 1) % unfoundWords.length];
      setHintTargetWord(nextWordObj.word);
      setHintTier(1);
      const nextHints = hintsUsed + 1;
      setHintsUsed(nextHints);
      soundFX.playHintReveal(1);
      recordProgressUpdate(foundWords, elapsedSeconds, nextHints, false);
    }
  }, [
    isPuzzleComplete,
    currentPuzzle.words,
    foundWords,
    hintTargetWord,
    hintTier,
    hintsUsed,
    elapsedSeconds,
    recordProgressUpdate,
  ]);

  // Select a specific word in the Word Bank to target for hints
  const handleSelectWordForHint = (word: string) => {
    if (foundWords.includes(word)) return;
    if (hintTargetWord !== word) {
      setHintTargetWord(word);
      setHintTier(0);
    }
  };

  // Switch to any puzzle from the 6-month archive
  const handleSelectArchivePuzzle = useCallback(
    (dateKey: string, forceFreshReplay = false) => {
      setCurrentDateKey(dateKey);
      loadPuzzleSession(dateKey, forceFreshReplay);
      setGameState('PLAYING');
    },
    [loadPuzzleSession]
  );

  // Reset a puzzle's progress
  const handleResetPuzzle = useCallback(
    (dateKey: string) => {
      setProgressMap((prev) => {
        const copy = { ...prev };
        delete copy[dateKey];
        return copy;
      });
      if (dateKey === currentDateKey) {
        setFoundWords([]);
        setElapsedSeconds(0);
        setHintsUsed(0);
        setHintTargetWord(null);
        setHintTier(0);
        setGameState('PLAYING');
      }
    },
    [currentDateKey]
  );

  // Replay current puzzle from scratch while keeping high score / best time record intact
  const handleReplayCurrentPuzzle = () => {
    setFoundWords([]);
    setElapsedSeconds(0);
    setHintsUsed(0);
    setHintTargetWord(null);
    setHintTier(0);
    setGameState('PLAYING');
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (showAuthModal || showHowToPlay) return;

      if (gameState === 'TITLE_MENU') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setGameState('PLAYING');
        }
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        if (gameState === 'PLAYING' && !isArchiveOpen) {
          handleRevealHint();
        }
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setIsArchiveOpen((prev) => !prev);
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setDarkMode((prev) => !prev);
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (isArchiveOpen) {
          setIsArchiveOpen(false);
        } else if (gameState === 'PLAYING') {
          setGameState('PAUSED');
        } else if (gameState === 'PAUSED') {
          setGameState('PLAYING');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, isArchiveOpen, showAuthModal, showHowToPlay, handleRevealHint]);

  const currentLiveScore = useMemo(
    () =>
      calculatePuzzleScore(
        foundWords.length,
        currentPuzzle.words.length,
        elapsedSeconds,
        hintsUsed,
        isPuzzleComplete
      ),
    [foundWords.length, currentPuzzle.words.length, elapsedSeconds, hintsUsed, isPuzzleComplete]
  );

  const activeHintWordObj = useMemo(
    () => currentPuzzle.words.find((w) => w.word === hintTargetWord) || null,
    [currentPuzzle.words, hintTargetWord]
  );

  // Recent 7 days strip for quick navigation
  const recentSevenDays = useMemo(() => {
    const idx = archive.findIndex((p) => p.dateKey === currentDateKey);
    const endIdx = Math.min(archive.length - 1, Math.max(6, idx + 2));
    const startIdx = Math.max(0, endIdx - 6);
    return archive.slice(startIdx, endIdx + 1);
  }, [archive, currentDateKey]);

  const currentArchiveIndex = useMemo(
    () => archive.findIndex((p) => p.dateKey === currentDateKey),
    [archive, currentDateKey]
  );

  const currentSavedRecord = progressMap[currentPuzzle.dateKey];
  const todaySavedRecord = progressMap[latestPuzzle.dateKey];

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-gradient-to-b from-[#FBF8F1] via-[#F4EFE4] to-[#EDE4D3] text-[#2B0938] dark:from-[#160524] dark:via-[#1E0633] dark:to-[#11031A] dark:text-[#F5F3F7] transition-colors overflow-x-hidden">
      {/* 20% Opacity Missing Piece Background Watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 flex items-center justify-center z-0 overflow-hidden"
      >
        <img
          src="/brand-logo.png"
          alt=""
          className="w-[520px] h-[520px] sm:w-[680px] sm:h-[680px] object-contain opacity-20 select-none"
        />
      </div>

      {/* =====================================================================
          UNIFIED MISSING PIECE TOP NAVIGATION HEADER
      ===================================================================== */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-purple-200/80 dark:border-purple-900/60 bg-white/90 dark:bg-[#1a0624]/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
        {/* Zone 1: Back to Solo Games & Brand Wordmark */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <Link
            to="/solo-games"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#4a1259] dark:text-amber-300 bg-purple-100/80 dark:bg-purple-900/50 hover:bg-purple-200/80 dark:hover:bg-purple-800/60 border border-purple-200/80 dark:border-purple-700/60 transition-colors whitespace-nowrap"
            title="Back to Solo Games"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Solo Games</span>
          </Link>

          <button
            type="button"
            onClick={() => setGameState('TITLE_MENU')}
            className="flex items-center gap-2.5 text-left group shrink-0 focus:outline-none cursor-pointer"
          >
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="MP Search - The Missing Piece Logo"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-contain drop-shadow-md group-hover:scale-105 transition-transform"
            />
            <div>
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-[#3b0d47] dark:text-white block leading-none">
                MP <span className="text-amber-500 dark:text-amber-400">Search</span>
              </span>
              <span className="text-[10px] uppercase font-bold text-[#581c6b] dark:text-amber-300/80 tracking-wider">
                The Missing Piece
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Center Navigation / Active Telemetry */}
        {gameState === 'TITLE_MENU' ? (
          <nav className="hidden lg:flex items-center gap-5 text-sm font-semibold text-slate-600 dark:text-purple-200/80">
            <button
              type="button"
              onClick={() => handleSelectArchivePuzzle(latestPuzzle.dateKey)}
              className="hover:text-[#581c6b] dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer font-bold text-[#581c6b] dark:text-amber-400"
            >
              Today&apos;s Puzzle (#{latestPuzzle.puzzleNumber})
            </button>
            <button
              type="button"
              onClick={() => setIsArchiveOpen(true)}
              className="hover:text-[#581c6b] dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-4 h-4" /> 12-Month Archive ({archive.length})
            </button>
            <button
              type="button"
              onClick={openUnifiedLeaderboardModal}
              className="hover:text-[#581c6b] dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-amber-500" /> Leaderboard
            </button>
            <button
              type="button"
              onClick={() => setShowHowToPlay(true)}
              className="hover:text-[#581c6b] dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" /> How to Play
            </button>
          </nav>
        ) : (
          <div className="hidden md:flex items-center gap-3 text-xs sm:text-sm font-mono tabular-nums bg-purple-50/90 dark:bg-[#240938]/90 px-3.5 py-1.5 rounded-xl border border-purple-200/80 dark:border-purple-800/70">
            <span className="font-bold text-[#3b0d47] dark:text-amber-300">
              #{currentPuzzle.puzzleNumber} · {currentPuzzle.themeTitle}
            </span>
            <span className="text-purple-300 dark:text-purple-700" aria-hidden="true">·</span>
            <span>
              Found{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {foundWords.length}/{currentPuzzle.words.length}
              </strong>
            </span>
            <span className="text-purple-300 dark:text-purple-700" aria-hidden="true">·</span>
            <span>
              Time{' '}
              <strong className="text-[#2B0938] dark:text-white">
                {formatDuration(elapsedSeconds)}
              </strong>
            </span>
            <span className="text-purple-300 dark:text-purple-700" aria-hidden="true">·</span>
            <span>
              Score{' '}
              <strong className="text-amber-600 dark:text-amber-400">
                {currentLiveScore.toLocaleString()}
              </strong>
            </span>
          </div>
        )}

        {/* Zone 3: Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <LanguageMenu variant="compact" />
          <DailyStreakBadge
            streak={dailyStreak.streak}
            solvedToday={dailyStreak.solvedToday}
            variant="light"
            compact
          />

          <button
            type="button"
            onClick={() => setIsArchiveOpen(true)}
            title="6-Month Archive & Progress Tracker"
            className="p-2 rounded-xl text-[#4a1259] dark:text-purple-200 hover:bg-purple-100/70 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
          >
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={openUnifiedLeaderboardModal}
            title="Public Solo Games Leaderboards"
            className="p-2 rounded-xl text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 transition-colors cursor-pointer"
          >
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {currentUser ? (
            <button
              type="button"
              onClick={openSignInModal}
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
              onClick={openSignInModal}
              title="Sign in with Google or Email & Password"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2d0938] dark:bg-purple-900/70 hover:bg-[#3b0d47] text-amber-300 border border-amber-400/40 text-xs font-bold transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span>Sign In</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setLargePrint((p) => !p)}
            title="Toggle Large Print Readability"
            aria-label="Toggle Large Print Readability"
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              largePrint
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                : 'text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40'
            }`}
          >
            <Type className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            title="How to Play"
            className="hidden sm:flex p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setIsMuted(soundFX.toggleMute())}
            title={isMuted ? 'Unmute sound' : 'Mute sound'}
            className="hidden sm:flex p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-rose-500" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
          >
            {darkMode ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-[#4a1259]" />
            )}
          </button>

          {gameState !== 'TITLE_MENU' && (
            <button
              type="button"
              onClick={() => setGameState((s) => (s === 'PAUSED' ? 'PLAYING' : 'PAUSED'))}
              title="Pause Game"
              aria-label="Pause Game"
              className="p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
            >
              <Pause className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* =====================================================================
          STATE 1: MISSING PIECE TITLE SCREEN
      ===================================================================== */}
      {gameState === 'TITLE_MENU' && (
        <main className="relative z-10 max-w-5xl mx-auto px-4 py-8 sm:py-10 flex flex-col items-center justify-center min-h-[82vh] text-center">
          {/* Hero Grid: Title Copy + Live 10x10 Board Preview */}
          <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 mb-8">
            <div className="flex flex-col items-center lg:items-start lg:text-left max-w-xl w-full">
              {/* 3D Emblem Game Logo */}
              <div className="relative mb-3 group">
                <div className="absolute inset-0 rounded-full bg-amber-400/25 blur-2xl group-hover:bg-amber-400/35 transition-all pointer-events-none" />
                <img
                  src="/assets/aistudio/3d_logo_944e5372.png"
                  alt="MP Search - The Missing Piece Daily Word Search"
                  className="relative w-28 h-28 sm:w-36 sm:h-36 object-contain drop-shadow-[0_14px_28px_rgba(59,13,71,0.35)] hover:scale-105 transition-transform duration-300"
                />
              </div>

              <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-[#3b0d47] dark:text-white mb-2">
                MP <span className="text-amber-500 dark:text-amber-400">Search</span>
              </h1>
              <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.22em] text-[#581c6b] dark:text-amber-300/90 mb-3">
                The Missing Piece · Daily 10×10 Word Search
              </p>
              <p className="text-sm sm:text-base text-slate-600 dark:text-purple-100/80 mb-5 leading-relaxed">
                Discover <strong>8 to 12 curated thematic words</strong> hidden across a tactile{' '}
                <strong>10×10 letterpress grid</strong>—horizontally, vertically, diagonally, and
                backwards with intersecting crossings. Features a 4-tier progressive hint system
                and 12 full months ({archive.length} days) of daily archives.
              </p>

              {/* Compact Metadata Strip */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-3 gap-y-1 text-xs sm:text-sm font-bold text-[#4a1259] dark:text-purple-200 mb-5">
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300 font-mono tabular-nums">
                  <Flame className="w-4 h-4 text-amber-500" />
                  {dailyStreak.streak}d Streak
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {globalStats.solved} / {archive.length} Solved
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{archive.length}-Day Archive</span>
              </div>

              {/* Primary Play CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleSelectArchivePuzzle(latestPuzzle.dateKey)}
                  className="px-7 py-4 rounded-2xl font-black text-sm sm:text-base bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-[#2d0938] shadow-[0_6px_0_#92400e,0_12px_24px_rgba(234,179,8,0.3)] border border-amber-200 hover:scale-[1.02] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {(todaySavedRecord?.completedCount || 0) >= 1
                      ? `Review Today's Puzzle (#${latestPuzzle.puzzleNumber}) ✓`
                      : (todaySavedRecord?.foundWords.length || 0) > 0
                      ? `Continue Today (${todaySavedRecord?.foundWords.length}/${latestPuzzle.words.length})`
                      : `Play Today's Puzzle (#${latestPuzzle.puzzleNumber})`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsArchiveOpen(true)}
                  className="px-5 py-4 rounded-2xl font-bold text-sm bg-white/95 dark:bg-[#240930]/95 text-[#3b0d47] dark:text-amber-300 border border-purple-200 dark:border-purple-700/70 hover:border-amber-400 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <span>12-Month Archive ({archive.length})</span>
                </button>
              </div>
            </div>

            {/* Interactive Live 10x10 Daily Puzzle Preview Card */}
            <div className="w-full max-w-[360px] sm:max-w-[390px] flex flex-col items-center shrink-0">
              <div className="w-full p-4 bg-[#230633] dark:bg-[#14031f] rounded-2xl border-2 border-[#4a1259] dark:border-amber-400/40 shadow-[0_20px_48px_rgba(45,9,56,0.38)] space-y-3.5 text-left">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-mono tabular-nums uppercase tracking-wider text-amber-300 font-bold">
                      TODAY&apos;S THEME · #{latestPuzzle.puzzleNumber}
                    </div>
                    <div className="text-lg font-extrabold text-white leading-tight">
                      {latestPuzzle.themeTitle}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30">
                    {latestPuzzle.category}
                  </span>
                </div>

                {/* Mini 10x10 Board Preview */}
                <button
                  type="button"
                  onClick={() => handleSelectArchivePuzzle(latestPuzzle.dateKey)}
                  aria-label="Open today's 10 by 10 MP Search board"
                  className="w-full aspect-square p-2 bg-[#160322] rounded-xl border border-purple-700/60 hover:border-amber-400/60 transition-colors cursor-pointer group"
                >
                  <div className="grid grid-cols-10 grid-rows-10 gap-[3px] w-full h-full pointer-events-none">
                    {latestPuzzle.grid.map((rowArr, r) =>
                      rowArr.map((letter, c) => {
                        const isFirstLetterOfAnyWord = latestPuzzle.words.some(
                          (pw) => pw.start.row === r && pw.start.col === c
                        );
                        return (
                          <div
                            key={`${r},${c}`}
                            className={`rounded-[4px] flex items-center justify-center font-black text-[11px] sm:text-xs ${
                              isFirstLetterOfAnyWord
                                ? 'bg-amber-400/90 text-[#1D0830]'
                                : 'bg-[#2a0a3d] text-purple-100'
                            }`}
                          >
                            {letter}
                          </div>
                        );
                      })
                    )}
                  </div>
                </button>

                {/* Today's 8 Target Words Pills */}
                <div className="grid grid-cols-4 gap-1.5">
                  {latestPuzzle.words.map((pw) => {
                    const isSolvedToday = todaySavedRecord?.foundWords.includes(pw.word);
                    return (
                      <div
                        key={pw.word}
                        className={`px-2 py-1 rounded-md text-[10px] font-mono tabular-nums font-bold text-center truncate border ${
                          isSolvedToday
                            ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 line-through'
                            : 'bg-white/10 border-purple-700/60 text-amber-200'
                        }`}
                      >
                        {pw.word}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-purple-200/75">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  {latestPuzzle.displayDate} · {latestPuzzle.words.length} Target Words (8–12 Random) · 4-Tier Hints
                </span>
              </div>
            </div>
          </div>

          {/* Unified Solo Games Account & Public Leaderboard Banner */}
          <div className="w-full max-w-3xl mb-6 rounded-2xl bg-gradient-to-r from-[#23063A] via-[#340A54] to-[#23063A] border border-[#D4A437]/70 p-4 text-left text-[#F5F3F7] shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <UserProfileIcon
                user={currentUser}
                imgClassName="w-10 h-10 rounded-full object-cover shrink-0 border-2 border-[#F6C915] shadow-md"
                fallback={
                  <img
                    src="/assets/aistudio/3d_logo_944e5372.png"
                    alt="The Missing Piece Emblem"
                    className="w-10 h-10 rounded-full object-contain shrink-0 drop-shadow"
                  />
                }
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
                      Your MP Search high scores automatically post to the public visitor leaderboard.
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
                      Use one account across all 12 solo games to record your MP Search high scores.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={openSignInModal}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-extrabold text-xs transition-all cursor-pointer"
              >
                {currentUser ? (
                  <UserProfileIcon user={currentUser} className="w-4 h-4 shrink-0" />
                ) : (
                  <LogIn className="w-3.5 h-3.5" />
                )}
                <span>{currentUser ? 'Account' : 'Sign In'}</span>
              </button>
              <button
                type="button"
                onClick={openUnifiedLeaderboardModal}
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
              onClick={() => setIsArchiveOpen(true)}
              className="p-5 rounded-2xl bg-white/95 dark:bg-[#240930]/95 backdrop-blur-sm border border-purple-200/80 dark:border-purple-800/60 hover:border-amber-400 dark:hover:border-amber-400 transition-all text-left group shadow-sm hover:shadow-md cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#4a1259]/10 dark:bg-amber-400/15 text-[#4a1259] dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">12-Month Archive</h3>
              <p className="text-xs text-slate-500 dark:text-purple-200/70">
                Play any of the past {archive.length} daily 10×10 word search puzzles (8–12 words each)
              </p>
            </button>

            <button
              type="button"
              onClick={openUnifiedLeaderboardModal}
              className="p-5 rounded-2xl bg-white/95 dark:bg-[#240930]/95 backdrop-blur-sm border border-purple-200/80 dark:border-purple-800/60 hover:border-amber-400 dark:hover:border-amber-400 transition-all text-left group shadow-sm hover:shadow-md cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Trophy className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">Public Leaderboard</h3>
              <p className="text-xs text-slate-500 dark:text-purple-200/70">
                Compare MP Search high scores &amp; fastest completion times
              </p>
            </button>

            <button
              type="button"
              onClick={() => setIsArchiveOpen(true)}
              className="p-5 rounded-2xl bg-white/95 dark:bg-[#240930]/95 backdrop-blur-sm border border-purple-200/80 dark:border-purple-800/60 hover:border-amber-400 dark:hover:border-amber-400 transition-all text-left group shadow-sm hover:shadow-md cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#4a1259]/10 dark:bg-purple-500/20 text-[#4a1259] dark:text-purple-300 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <BarChart2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">Your Statistics</h3>
              <p className="text-xs text-slate-500 dark:text-purple-200/70">
                Solved: {globalStats.solved}/{archive.length} · Best:{' '}
                {globalStats.bestScore > 0 ? `${globalStats.bestScore.toLocaleString()} pts` : '—'}{' '}
                · Fastest: {globalStats.fastest > 0 ? formatDuration(globalStats.fastest) : '—'}
              </p>
            </button>
          </div>

          {/* Footer Info */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 dark:text-purple-300/60 font-medium">
            <span>Drag across letters or tap First &amp; Last Letter</span>
            <span>·</span>
            <span>8 Directions + Intersecting Crossings</span>
            <span>·</span>
            <span>Press H for 4-Tier Hints · A for Archive</span>
          </div>
        </main>
      )}

      {/* =====================================================================
          STATE 2: ACTIVE PLAYING SHELL (ADAPTIVE MOBILE + DESKTOP)
      ===================================================================== */}
      {gameState !== 'TITLE_MENU' && (
        <div className="relative z-10 flex-1 flex flex-col max-w-7xl w-full mx-auto">
          {/* Mobile Subbar for Puzzle Title & Live Stats */}
          <div className="md:hidden flex items-center justify-between gap-2 px-3.5 py-2 bg-white/85 dark:bg-[#220835]/85 border-b border-purple-200/80 dark:border-purple-800/70 text-xs font-mono tabular-nums">
            <div className="truncate font-sans font-bold text-[#2B0938] dark:text-white">
              #{currentPuzzle.puzzleNumber} · {currentPuzzle.themeTitle}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {foundWords.length}/{currentPuzzle.words.length}
              </span>
              <span>·</span>
              <span className="font-bold text-[#2B0938] dark:text-white">
                {formatDuration(elapsedSeconds)}
              </span>
              <span>·</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {currentLiveScore.toLocaleString()} pts
              </span>
            </div>
          </div>

          {/* Main Adaptive Playfield: 12-Column Grid on Desktop */}
          <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 px-3 sm:px-6 py-4 sm:py-6 items-start">
            {/* LEFT / CENTER COLUMN (7 cols on desktop): 10x10 Grid & 4-Tier Hint Bar */}
            <div className="lg:col-span-7 flex flex-col items-center space-y-3">
              <WordSearchBoard
                puzzle={currentPuzzle}
                foundWords={foundWords}
                onWordFound={handleWordFound}
                hintTargetWord={hintTargetWord}
                hintTier={hintTier}
                largePrint={largePrint}
                disabled={gameState !== 'PLAYING'}
              />

              {/* 4-Tier Progressive Hint System Bar */}
              <div className="w-full max-w-[540px] p-3.5 sm:p-4 rounded-2xl bg-white/95 dark:bg-[#220835]/95 border border-purple-200/90 dark:border-purple-800/70 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-extrabold text-[#2B0938] dark:text-white">
                      4-Tier Hint System
                    </span>
                    <span className="text-slate-400" aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-slate-600 dark:text-purple-200/80">
                      {hintTargetWord
                        ? `Target: ${hintTargetWord} (Tier ${hintTier}/4)`
                        : 'Tap a word or click Reveal Hint'}
                    </span>
                  </div>

                  {/* Active Clues Revealed for Target Word */}
                  {activeHintWordObj && hintTier > 0 ? (
                    <div className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>
                        1. {activeHintWordObj.directionArrow} {activeHintWordObj.orientation}
                        {activeHintWordObj.isBackwards ? ' (Backwards)' : ''}
                      </span>
                      {hintTier >= 2 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            2. Starts Col {activeHintWordObj.startColumnLetter}, Row{' '}
                            {activeHintWordObj.startRowNumber}
                          </span>
                        </>
                      )}
                      {hintTier >= 3 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>3. 1st Letter Highlighted</span>
                        </>
                      )}
                      {hintTier >= 4 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>4. Full Path Outlined</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-purple-200/70">
                      1: Direction · 2: Row/Col · 3: First Letter · 4: Full Word Path
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isPuzzleComplete}
                  onClick={handleRevealHint}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold bg-gradient-to-b from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 disabled:opacity-40 text-[#1D0830] shadow-xs transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Lightbulb className="w-4 h-4" />
                  <span>
                    {hintTier === 0
                      ? 'Reveal Hint (H)'
                      : hintTier < 4
                      ? `Next Hint Tier (${hintTier + 1}/4)`
                      : 'Hint Next Word'}
                  </span>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN (5 cols on desktop): Word Bank, Personal Best Tracker, & Quick Date Switcher */}
            <aside className="lg:col-span-5 w-full space-y-4">
              {/* Target Word Bank Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white/95 dark:bg-[#220835]/95 border border-purple-200/90 dark:border-purple-800/70 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-[#2B0938] dark:text-white">
                      Target Word Bank
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-purple-200/75">
                      {currentPuzzle.themeTitle} ({currentPuzzle.category}) · Tap any unfound word to focus hints
                    </p>
                  </div>
                  <div className="font-mono tabular-nums text-xs font-extrabold text-[#4a1259] dark:text-amber-300">
                    {foundWords.length} of {currentPuzzle.words.length} Found
                  </div>
                </div>

                {/* Responsive Adaptive Word Grid for 8 to 12 Target Words */}
                <div
                  className={`grid gap-2 ${
                    currentPuzzle.words.length >= 10
                      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3'
                      : 'grid-cols-2'
                  }`}
                >
                  {currentPuzzle.words.map((pw) => {
                    const isFound = foundWords.includes(pw.word);
                    const isJustFound = recentlyFoundWord === pw.word;
                    const isHintTarget = hintTargetWord === pw.word && !isFound;

                    return (
                      <button
                        key={pw.word}
                        type="button"
                        onClick={() => handleSelectWordForHint(pw.word)}
                        disabled={isFound}
                        className={`relative overflow-hidden min-h-[42px] px-3 py-1.5 rounded-xl text-left transition-colors flex items-center justify-between gap-1.5 border cursor-pointer ${
                          isFound
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                            : isHintTarget
                            ? 'bg-amber-50 dark:bg-amber-950/45 border-amber-500 text-[#2B0938] dark:text-white'
                            : 'bg-[#FAF6EE] hover:bg-purple-50 dark:bg-[#2a0942]/70 dark:hover:bg-[#350c54] border-purple-200/80 dark:border-purple-800/70 text-[#2B0938] dark:text-purple-50'
                        }`}
                      >
                        {/* Smooth Highlight Burst & Fade-Out when Word is Newly Found */}
                        <AnimatePresence>
                          {isJustFound && (
                            <motion.span
                              key={`bank_glow_${pw.word}`}
                              aria-hidden="true"
                              initial={{ opacity: 0.92, scale: 1.04 }}
                              animate={{ opacity: [0.92, 0.65, 0], scale: [1.04, 1.01, 1] }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 1.35, ease: 'easeOut' }}
                              className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-amber-300/90 via-yellow-300/80 to-emerald-400/80 shadow-[0_0_20px_rgba(245,158,11,0.65)] z-0"
                            />
                          )}
                        </AnimatePresence>

                        <div className="relative z-10 min-w-0">
                          <div
                            className={`font-mono tabular-nums font-extrabold tracking-wider truncate ${
                              largePrint ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                            } ${isFound ? 'line-through opacity-75' : ''}`}
                          >
                            {pw.word}
                          </div>
                          {isFound && (
                            <div className="text-[10px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                              {pw.directionArrow} Col {pw.startColumnLetter}
                              {pw.startRowNumber}
                              {pw.isBackwards ? ' · Rev' : ''}
                            </div>
                          )}
                          {isHintTarget && hintTier >= 1 && (
                            <div className="text-[10px] font-mono tabular-nums text-amber-600 dark:text-amber-400">
                              {pw.directionArrow} {pw.orientation}
                              {pw.isBackwards ? ' (Rev)' : ''}
                              {hintTier >= 2 ? ` · ${pw.startColumnLetter}${pw.startRowNumber}` : ''}
                            </div>
                          )}
                        </div>

                        <div className="relative z-10 shrink-0 flex items-center gap-1">
                          {isFound ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <span className="font-mono tabular-nums text-[11px] text-slate-400 dark:text-purple-300/60">
                              {pw.word.length}L
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Puzzle Record & Personal Best Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white/95 dark:bg-[#220835]/95 border border-purple-200/90 dark:border-purple-800/70 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-extrabold text-[#4a1259] dark:text-amber-300">
                    Puzzle #{currentPuzzle.puzzleNumber} Progress Record
                  </div>
                  <button
                    type="button"
                    onClick={handleReplayCurrentPuzzle}
                    className="text-xs font-bold text-slate-600 hover:text-[#2B0938] dark:text-purple-200 dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restart Run</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-[#FAF6EE] dark:bg-[#2a0942]/60 border border-purple-200/70 dark:border-purple-800/70">
                    <div className="text-[11px] text-slate-500 dark:text-purple-200/70">Status</div>
                    <div className="font-mono tabular-nums text-sm font-extrabold text-[#2B0938] dark:text-white mt-0.5">
                      {(currentSavedRecord?.completedCount || 0) >= 1
                        ? `Solved (${currentSavedRecord.completedCount}×)`
                        : `${foundWords.length}/${currentPuzzle.words.length} Words`}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#FAF6EE] dark:bg-[#2a0942]/60 border border-purple-200/70 dark:border-purple-800/70">
                    <div className="text-[11px] text-slate-500 dark:text-purple-200/70">Best Time</div>
                    <div className="font-mono tabular-nums text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {currentSavedRecord?.bestTimeSeconds
                        ? formatDuration(currentSavedRecord.bestTimeSeconds)
                        : '—'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#FAF6EE] dark:bg-[#2a0942]/60 border border-purple-200/70 dark:border-purple-800/70">
                    <div className="text-[11px] text-slate-500 dark:text-purple-200/70">High Score</div>
                    <div className="font-mono tabular-nums text-sm font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                      {currentSavedRecord?.highScore
                        ? currentSavedRecord.highScore.toLocaleString()
                        : currentLiveScore.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Unified Account Sync Status Strip */}
                <div className="pt-2 border-t border-purple-100 dark:border-purple-800/70 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-purple-200/75">
                  <div className="flex items-center gap-1.5 truncate">
                    <Cloud className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">
                      {currentUser
                        ? `Synced to ${getCleanDisplayName(currentUser)}`
                        : 'Saved locally · Sign in to post to public leaderboards'}
                    </span>
                  </div>
                  {!currentUser ? (
                    <button
                      type="button"
                      onClick={openSignInModal}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <LogIn className="w-3 h-3" />
                      <span>Sign In</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openUnifiedLeaderboardModal}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Trophy className="w-3 h-3" />
                      <span>Leaderboards</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 6-Month Archive Quick Date Scroller */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white/95 dark:bg-[#220835]/95 border border-purple-200/90 dark:border-purple-800/70 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#2B0938] dark:text-white">
                    12-Month Daily Archive ({archive.length} Days)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentArchiveIndex <= 0}
                      onClick={() => {
                        if (currentArchiveIndex > 0) {
                          handleSelectArchivePuzzle(archive[currentArchiveIndex - 1].dateKey);
                        }
                      }}
                      className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border border-purple-200 dark:border-purple-800 text-[#4a1259] dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/50 disabled:opacity-30 transition-colors cursor-pointer"
                      aria-label="Previous Day Puzzle"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={currentArchiveIndex >= archive.length - 1}
                      onClick={() => {
                        if (currentArchiveIndex < archive.length - 1) {
                          handleSelectArchivePuzzle(archive[currentArchiveIndex + 1].dateKey);
                        }
                      }}
                      className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border border-purple-200 dark:border-purple-800 text-[#4a1259] dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/50 disabled:opacity-30 transition-colors cursor-pointer"
                      aria-label="Next Day Puzzle"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Horizontal 7-Day Scroller */}
                <div className="grid grid-cols-7 gap-1.5">
                  {recentSevenDays.map((p) => {
                    const isSelected = p.dateKey === currentDateKey;
                    const isSolved = (progressMap[p.dateKey]?.completedCount || 0) >= 1;
                    const dayNum = p.dateKey.split('-')[2];

                    return (
                      <button
                        key={p.dateKey}
                        type="button"
                        onClick={() => handleSelectArchivePuzzle(p.dateKey)}
                        className={`min-h-[52px] py-1.5 px-1 rounded-xl flex flex-col items-center justify-center border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#2B0938] text-amber-300 border-[#2B0938] dark:bg-amber-400 dark:text-[#1D0830] dark:border-amber-400 font-extrabold'
                            : isSolved
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                            : 'bg-[#FAF6EE] dark:bg-[#2a0942]/60 border-purple-200/70 dark:border-purple-800 text-[#2B0938] dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/50'
                        }`}
                      >
                        <span className="text-[10px] opacity-75">{p.weekdayShort}</span>
                        <span className="font-mono tabular-nums text-xs sm:text-sm font-extrabold mt-0.5">
                          {dayNum}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setIsArchiveOpen(true)}
                  className="w-full min-h-[42px] py-2 px-4 rounded-xl text-xs font-extrabold text-[#2B0938] dark:text-amber-300 bg-purple-100/80 hover:bg-purple-200/80 dark:bg-purple-900/50 dark:hover:bg-purple-800/60 border border-purple-200/80 dark:border-purple-700/60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Browse All 12 Months &amp; Personal Bests ({globalStats.solved}/{archive.length} Solved)</span>
                </button>
              </div>
            </aside>
          </main>
        </div>
      )}

      {/* =====================================================================
          STATE 3: PAUSE MODAL
      ===================================================================== */}
      {gameState === 'PAUSED' && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#12031d]/75 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Game Paused"
        >
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-[#220835] border-2 border-purple-200 dark:border-amber-400/40 shadow-2xl space-y-5 text-center">
            <div className="space-y-1">
              <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-purple-200/75">
                PUZZLE #{currentPuzzle.puzzleNumber} · {currentPuzzle.displayDate}
              </div>
              <h2 className="text-2xl font-black text-[#2B0938] dark:text-white">
                Game Paused
              </h2>
              <p className="text-xs text-slate-500 dark:text-purple-200/75">
                Timer is paused at {formatDuration(elapsedSeconds)} · {foundWords.length} of{' '}
                {currentPuzzle.words.length} words found
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setGameState('PLAYING')}
                className="w-full min-h-[46px] py-2.5 px-4 rounded-xl text-sm font-extrabold bg-gradient-to-b from-amber-300 to-amber-500 text-[#1D0830] hover:from-amber-200 hover:to-amber-400 transition-all cursor-pointer"
              >
                Resume Puzzle
              </button>
              <button
                type="button"
                onClick={handleReplayCurrentPuzzle}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-sm font-bold text-[#2B0938] dark:text-white bg-purple-100/80 hover:bg-purple-200/80 dark:bg-purple-900/50 dark:hover:bg-purple-800/60 transition-colors cursor-pointer"
              >
                Restart Current Puzzle
              </button>
              <button
                type="button"
                onClick={() => {
                  setGameState('PLAYING');
                  setIsArchiveOpen(true);
                }}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-sm font-bold text-[#2B0938] dark:text-white bg-purple-100/80 hover:bg-purple-200/80 dark:bg-purple-900/50 dark:hover:bg-purple-800/60 transition-colors cursor-pointer"
              >
                Open 6-Month Archive &amp; Progress
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 4: VICTORY / ROUND SUMMARY MODAL
      ===================================================================== */}
      {gameState === 'ROUND_SUMMARY' && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#12031d]/75 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Puzzle Completed"
        >
          <div className="w-full max-w-lg p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#220835] border-2 border-purple-200 dark:border-amber-400/45 shadow-2xl space-y-6">
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-500 mb-1">
                <Trophy className="w-7 h-7" />
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-purple-200/75">
                PUZZLE #{currentPuzzle.puzzleNumber} COMPLETED · {currentPuzzle.displayDate}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#2B0938] dark:text-white">
                {currentPuzzle.themeTitle} Solved!
              </h2>
            </div>

            {/* Final Run Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[#FAF6EE] dark:bg-[#2a0942]/70 border border-purple-200/80 dark:border-purple-800 text-center">
                <div className="text-xs text-slate-500 dark:text-purple-200/75">Completion Time</div>
                <div className="font-mono tabular-nums text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatDuration(elapsedSeconds)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF6EE] dark:bg-[#2a0942]/70 border border-purple-200/80 dark:border-purple-800 text-center">
                <div className="text-xs text-slate-500 dark:text-purple-200/75">Final Score</div>
                <div className="font-mono tabular-nums text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
                  {currentLiveScore.toLocaleString()}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF6EE] dark:bg-[#2a0942]/70 border border-purple-200/80 dark:border-purple-800 text-center">
                <div className="text-xs text-slate-500 dark:text-purple-200/75">Hints Used</div>
                <div className="font-mono tabular-nums text-xl font-black text-[#2B0938] dark:text-white mt-1">
                  {hintsUsed}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              {currentArchiveIndex > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handleSelectArchivePuzzle(archive[currentArchiveIndex - 1].dateKey)
                  }
                  className="w-full min-h-[46px] py-2.5 px-4 rounded-xl text-sm font-extrabold bg-gradient-to-b from-amber-300 to-amber-500 text-[#1D0830] hover:from-amber-200 hover:to-amber-400 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Play Previous Day (#{archive[currentArchiveIndex - 1].puzzleNumber})
                </button>
              )}

              <button
                type="button"
                onClick={handleReplayCurrentPuzzle}
                className="w-full min-h-[46px] py-2.5 px-4 rounded-xl text-sm font-bold text-[#2B0938] dark:text-white bg-purple-100/80 hover:bg-purple-200/80 dark:bg-purple-900/50 dark:hover:bg-purple-800/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Play Again
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-purple-200 dark:border-purple-800 text-xs">
              <button
                type="button"
                onClick={() => setGameState('PLAYING')}
                className="font-bold text-slate-500 hover:text-[#2B0938] dark:text-purple-200 dark:hover:text-white cursor-pointer"
              >
                Inspect Solved Board
              </button>
              <button
                type="button"
                onClick={() => {
                  setGameState('PLAYING');
                  openUnifiedLeaderboardModal();
                }}
                className="font-extrabold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                View Public Leaderboards →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          HOW TO PLAY MODAL
      ===================================================================== */}
      {showHowToPlay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#12031d]/75 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="How to Play MP Search"
        >
          <div className="w-full max-w-lg p-6 rounded-2xl bg-white dark:bg-[#220835] border-2 border-purple-200 dark:border-amber-400/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/aistudio/3d_logo_944e5372.png"
                  alt="The Missing Piece"
                  className="w-8 h-8 rounded-full object-contain"
                />
                <h2 className="text-xl font-black text-[#2B0938] dark:text-white">
                  How to Play MP Search
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowHowToPlay(false)}
                className="p-2 rounded-xl text-slate-500 hover:text-[#2B0938] dark:text-purple-200 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-purple-100/85 leading-relaxed">
              <p>
                Find all <strong>8 to 12 thematic target words</strong> hidden inside the 10×10 grid.
                Words can run horizontally, vertically, or diagonally—both forwards and backwards—and
                can cross each other in <strong>+</strong> or <strong>X</strong> intersections.
              </p>
              <div className="p-3.5 rounded-xl bg-[#FAF6EE] dark:bg-[#2a0942]/70 border border-purple-200/80 dark:border-purple-800 space-y-1.5">
                <div className="font-extrabold text-[#2B0938] dark:text-amber-300">
                  Two Ways to Select Words
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>
                    <strong>Drag / Swipe:</strong> Press and drag smoothly from the first letter to
                    the last letter of a word.
                  </li>
                  <li>
                    <strong>Two-Tap Mode:</strong> Tap the starting letter once to lock an anchor,
                    then tap the ending letter to complete the word.
                  </li>
                </ul>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF6EE] dark:bg-[#2a0942]/70 border border-purple-200/80 dark:border-purple-800 space-y-1.5">
                <div className="font-extrabold text-[#2B0938] dark:text-amber-300">
                  4-Tier Progressive Hint System
                </div>
                <p className="text-xs">
                  Tap any unfound word in the Word Bank to target it, then press{' '}
                  <strong>Reveal Hint (H)</strong> to unlock up to 4 progressive clues:
                </p>
                <ol className="list-decimal list-inside space-y-0.5 text-xs font-mono">
                  <li>Word Direction &amp; Orientation</li>
                  <li>Starting Column (A–J) &amp; Row (1–10)</li>
                  <li>First Letter Highlighted on the 10×10 Grid</li>
                  <li>Full Word Path Outlined</li>
                </ol>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHowToPlay(false)}
              className="w-full py-3 rounded-xl font-extrabold text-sm bg-gradient-to-b from-amber-300 to-amber-500 text-[#1D0830] hover:from-amber-200 hover:to-amber-400 transition-all cursor-pointer"
            >
              Got It — Let&apos;s Play!
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          PROGRESS TRACKER & 6-MONTH ARCHIVE MODAL
      ===================================================================== */}
      <ProgressArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        archive={archive}
        progressMap={progressMap}
        currentDateKey={currentDateKey}
        onSelectPuzzle={(dKey) => handleSelectArchivePuzzle(dKey)}
        onResetPuzzle={handleResetPuzzle}
        user={currentUser}
        onOpenSignIn={openSignInModal}
        onOpenLeaderboard={openUnifiedLeaderboardModal}
      />

      {/* =====================================================================
          UNIFIED SOLO GAMES AUTH & LEADERBOARD MODAL
      ===================================================================== */}
      <UnifiedAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        user={currentUser}
        initialGameId="mpsearch"
        initialTab={authModalTab}
      />
    </div>
  );
}
