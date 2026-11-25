import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  Archive,
  ArrowLeft,
  Award,
  Calendar,
  Check,
  ChevronRight,
  Eye,
  Flame,
  HelpCircle,
  Lightbulb,
  LogIn,
  Moon,
  Pause,
  Play,
  RotateCcw,
  SearchCheck,
  Sparkles,
  Star,
  Sun,
  Trophy,
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
import { triggerVictoryConfetti } from '@/lib/confetti';
import { CLOUD_HYDRATED_EVENT } from '@/lib/cloud-progress';
import { ArchiveModal } from './components/ArchiveModal';
import { SceneCanvas } from './components/SceneCanvas';
import {
  calculateScoreBreakdown,
  formatDuration,
  formatReadableDate,
  generatePuzzleForDate,
  getArchiveDateKeys,
} from './engine/puzzleGenerator';
import { soundEngine } from './engine/sound';
import {
  computeCompletionStats,
  loadDarkModePreference,
  loadLocalMuted,
  readStoredCompletions,
  saveDarkModePreference,
  saveLocalMuted,
  writeStoredCompletions,
} from './utils/storage';
import type {
  DifferenceCompletion,
  GameScreen,
  PlayOverlay,
  ScoreBreakdown,
} from './types/game';

export default function MPDifferenceApp() {
  const todayKey = useMemo(() => getLondonTodayDateStr(), []);
  const archiveDates = useMemo(() => getArchiveDateKeys(todayKey), [todayKey]);

  const { user: currentUser } = useUnifiedAuth();

  const [screen, setScreen] = useState<GameScreen>('TITLE');
  const [overlay, setOverlay] = useState<PlayOverlay>('NONE');
  const [activeDate, setActiveDate] = useState<string>(todayKey);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  // Unified Solo Games Auth & Leaderboard Modal State
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'account' | 'leaderboards'>('leaderboards');

  const openSignInModal = useCallback(() => {
    setAuthModalTab('account');
    setShowAuthModal(true);
  }, []);

  const openLeaderboardModal = useCallback(() => {
    setAuthModalTab('leaderboards');
    setShowAuthModal(true);
  }, []);

  // Theme & Audio State
  const [darkMode, setDarkMode] = useState<boolean>(() => loadDarkModePreference());
  const [muted, setMuted] = useState<boolean>(() => {
    const initial = loadLocalMuted();
    soundEngine.setMuted(initial);
    return initial;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveDarkModePreference(darkMode);
  }, [darkMode]);

  // Per-user local completions
  const [completions, setCompletions] = useState<Record<string, DifferenceCompletion>>(() =>
    readStoredCompletions()
  );

  useEffect(() => {
    const syncStores = () => {
      setCompletions(readStoredCompletions());
    };
    syncStores();
    window.addEventListener('unified-auth-updated', syncStores);
    window.addEventListener('mp-site-auth-updated', syncStores);
    window.addEventListener(CLOUD_HYDRATED_EVENT, syncStores);
    return () => {
      window.removeEventListener('unified-auth-updated', syncStores);
      window.removeEventListener('mp-site-auth-updated', syncStores);
      window.removeEventListener(CLOUD_HYDRATED_EVENT, syncStores);
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    writeStoredCompletions(completions);
  }, [completions]);

  // Active Gameplay State
  const [foundIds, setFoundIds] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState<number>(0);
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [hintDiffId, setHintDiffId] = useState<string | null>(null);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [runningScore, setRunningScore] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [loupeActive, setLoupeActive] = useState<boolean>(false);
  const [hoverPos, setHoverPos] = useState<{
    x: number;
    y: number;
    source: 'original' | 'altered';
  } | null>(null);
  const [missFlash, setMissFlash] = useState<{ x: number; y: number; key: number } | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    text: string;
    tone: 'hit' | 'miss' | 'hint';
  } | null>(null);

  // Victory state
  const [victoryBreakdown, setVictoryBreakdown] = useState<ScoreBreakdown | null>(null);
  const [isNewPersonalBest, setIsNewPersonalBest] = useState<boolean>(false);

  const feedbackTimerRef = useRef<number | null>(null);

  const activePuzzle = useMemo(
    () => generatePuzzleForDate(activeDate, todayKey),
    [activeDate, todayKey]
  );

  const todayPuzzle = useMemo(
    () => generatePuzzleForDate(todayKey, todayKey),
    [todayKey]
  );

  const stats = useMemo(
    () => computeCompletionStats(completions, todayKey),
    [completions, todayKey]
  );

  const dailyStreak = useDailyStreak(
    'mpdifference',
    todayKey,
    stats.solvedToday,
    stats.streak
  );

  const showToast = useCallback((text: string, tone: 'hit' | 'miss' | 'hint') => {
    setFeedbackBanner({ text, tone });
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackBanner(null);
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  // Precision game timer (runs only during active unpaused play when modals are closed)
  useEffect(() => {
    if (
      screen !== 'PLAYING' ||
      overlay !== 'NONE' ||
      showHowToPlay ||
      showAuthModal
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => Math.min(86400, prev + 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [screen, overlay, showHowToPlay, showAuthModal]);

  const startPuzzle = useCallback((dateKey: string) => {
    soundEngine.playClick();
    setActiveDate(dateKey);
    setFoundIds([]);
    setMistakes(0);
    setHintsUsed(0);
    setHintDiffId(null);
    setCombo(0);
    setMaxCombo(0);
    setRunningScore(0);
    setElapsedSeconds(0);
    setHoverPos(null);
    setMissFlash(null);
    setFeedbackBanner(null);
    setVictoryBreakdown(null);
    setIsNewPersonalBest(false);
    setOverlay('NONE');
    setScreen('PLAYING');
  }, []);

  const toggleMute = useCallback(() => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    soundEngine.setMuted(nextMuted);
    saveLocalMuted(nextMuted);
  }, [muted]);

  const triggerHint = useCallback(() => {
    if (screen !== 'PLAYING' || overlay !== 'NONE') return;
    const remaining = activePuzzle.differences.filter((d) => !foundIds.includes(d.id));
    if (remaining.length === 0) return;
    const target = remaining[0];
    setHintDiffId(target.id);
    setHintsUsed((h) => h + 1);
    setRunningScore((s) => Math.max(0, s - 180));
    soundEngine.playHint();
    showToast(`Hint revealed · ${target.description} (-180 pts)`, 'hint');
  }, [screen, overlay, activePuzzle.differences, foundIds, showToast]);

  const handleCompletePuzzle = useCallback(
    (
      finalFoundCount: number,
      nextMaxCombo: number,
      finalMistakes: number,
      finalHints: number
    ) => {
      const safeTime = Math.max(1, elapsedSeconds);
      const breakdown = calculateScoreBreakdown({
        totalDiffs: finalFoundCount,
        maxCombo: nextMaxCombo,
        elapsedSeconds: safeTime,
        parSeconds: activePuzzle.parSeconds,
        hintsUsed: finalHints,
        mistakes: finalMistakes,
      });

      setVictoryBreakdown(breakdown);
      setOverlay('VICTORY');
      soundEngine.playVictory();
      triggerVictoryConfetti();

      const existing = completions[activePuzzle.date];
      const prevBest = existing?.bestScore || 0;
      const personalBestNow = breakdown.finalScore > prevBest;
      setIsNewPersonalBest(personalBestNow);

      const nextBestScore = Math.max(prevBest, breakdown.finalScore);
      const nextBestTime =
        existing?.bestTimeSeconds && existing.bestTimeSeconds > 0
          ? Math.min(existing.bestTimeSeconds, safeTime)
          : safeTime;
      const nextBestAccuracy = Math.max(existing?.bestAccuracy || 0, breakdown.accuracy);
      const nextStars = Math.max(existing?.stars || 1, breakdown.stars) as 1 | 2 | 3;

      const nextCompletions: Record<string, DifferenceCompletion> = {
        ...completions,
        [activePuzzle.date]: {
          puzzleDate: activePuzzle.date,
          issueNumber: activePuzzle.issueNumber,
          title: activePuzzle.title,
          bestScore: nextBestScore,
          bestTimeSeconds: nextBestTime,
          bestAccuracy: nextBestAccuracy,
          hintsUsed: finalHints,
          mistakes: finalMistakes,
          stars: nextStars,
          attempts: (existing?.attempts || 0) + 1,
          completedAtIso: new Date().toISOString(),
        },
      };

      setCompletions(nextCompletions);
      writeStoredCompletions(nextCompletions);

      if (activePuzzle.isToday) {
        recordDailyPuzzleSolved('mpdifference', todayKey, stats.streak + 1);
      }

      const nextStats = computeCompletionStats(nextCompletions, todayKey);
      const allTimeBest = Math.max(nextStats.allTimeBestScore, breakdown.finalScore);

      saveUnifiedLeaderboardScore({
        user: currentUser,
        gameId: 'mpdifference',
        puzzleId: activePuzzle.date,
        puzzleTitle: activePuzzle.title,
        score: allTimeBest,
        metricLabel: `${allTimeBest.toLocaleString()} pts (${formatDuration(nextBestTime)})`,
        subMetricLabel: `#${activePuzzle.issueNumber} · ${activePuzzle.title} · ${breakdown.accuracy.toFixed(0)}% acc`,
      }).catch(() => {});
    },
    [
      elapsedSeconds,
      activePuzzle,
      completions,
      todayKey,
      stats.streak,
      currentUser,
    ]
  );

  const handleCanvasClick = useCallback(
    (x: number, y: number) => {
      if (screen !== 'PLAYING' || overlay !== 'NONE') return;

      const isInsideDiffBounds = (
        px: number,
        py: number,
        diff: (typeof activePuzzle.differences)[number]
      ) => {
        const halfW = diff.hitWidth / 2 + 8;
        const halfH = diff.hitHeight / 2 + 8;
        const inOrig = Math.abs(px - diff.origX) <= halfW && Math.abs(py - diff.origY) <= halfH;
        const inAlt = Math.abs(px - diff.altX) <= halfW && Math.abs(py - diff.altY) <= halfH;
        return inOrig || inAlt;
      };

      let matched: (typeof activePuzzle.differences)[number] | null = null;
      let bestDist = Infinity;
      for (const diff of activePuzzle.differences) {
        if (foundIds.includes(diff.id)) continue;
        if (isInsideDiffBounds(x, y, diff)) {
          const dOrig = Math.hypot(diff.origX - x, diff.origY - y);
          const dAlt = Math.hypot(diff.altX - x, diff.altY - y);
          const dist = Math.min(dOrig, dAlt);
          if (dist < bestDist) {
            bestDist = dist;
            matched = diff;
          }
        }
      }

      if (!matched) {
        const clickedAlreadyFound = activePuzzle.differences.some(
          (diff) => foundIds.includes(diff.id) && isInsideDiffBounds(x, y, diff)
        );
        if (clickedAlreadyFound) {
          return;
        }
      }

      if (matched) {
        const nextFound = [...foundIds, matched.id];
        const nextCombo = combo + 1;
        const nextMaxCombo = Math.max(maxCombo, nextCombo);
        const pointsGained = 500 + (nextCombo - 1) * 140;

        setFoundIds(nextFound);
        setCombo(nextCombo);
        setMaxCombo(nextMaxCombo);
        setRunningScore((s) => s + pointsGained);
        if (hintDiffId === matched.id) {
          setHintDiffId(null);
        }

        soundEngine.playSpotHit(nextCombo);
        showToast(
          `${matched.description} · +${pointsGained} pts${nextCombo > 1 ? ` (×${nextCombo} streak)` : ''}`,
          'hit'
        );

        if (nextFound.length === activePuzzle.differences.length) {
          handleCompletePuzzle(nextFound.length, nextMaxCombo, mistakes, hintsUsed);
        }
      } else {
        setCombo(0);
        setMistakes((m) => m + 1);
        setRunningScore((s) => Math.max(0, s - 85));
        setMissFlash({ x, y, key: Date.now() });
        soundEngine.playMiss();
        showToast('No difference there · -85 pts', 'miss');
      }
    },
    [
      screen,
      overlay,
      activePuzzle.differences,
      foundIds,
      combo,
      maxCombo,
      hintDiffId,
      mistakes,
      hintsUsed,
      showToast,
      handleCompletePuzzle,
    ]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        showAuthModal ||
        showHowToPlay
      ) {
        return;
      }

      if (screen === 'TITLE') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startPuzzle(todayKey);
        }
        return;
      }

      if (screen === 'PLAYING') {
        if (e.key === ' ' || e.key === 'Escape') {
          if (overlay === 'VICTORY') return;
          e.preventDefault();
          soundEngine.playClick();
          setOverlay((prev) => (prev === 'PAUSED' ? 'NONE' : 'PAUSED'));
        } else if (e.key.toLowerCase() === 'z' && overlay === 'NONE') {
          e.preventDefault();
          soundEngine.playClick();
          setLoupeActive((l) => !l);
        } else if (e.key.toLowerCase() === 'h' && overlay === 'NONE') {
          e.preventDefault();
          triggerHint();
        } else if (e.key.toLowerCase() === 'm') {
          e.preventDefault();
          toggleMute();
        }
      } else if (e.key === 'Escape') {
        setScreen('TITLE');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    screen,
    overlay,
    todayKey,
    startPuzzle,
    triggerHint,
    toggleMute,
    showAuthModal,
    showHowToPlay,
  ]);

  const todayCompletion = completions[todayKey];

  const nextArchiveDate = useMemo(() => {
    const idx = archiveDates.indexOf(activeDate);
    if (idx === -1) return todayKey;
    return archiveDates[(idx + 1) % archiveDates.length];
  }, [archiveDates, activeDate, todayKey]);

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
          className="w-[340px] h-[340px] sm:w-[680px] sm:h-[680px] object-contain opacity-25 select-none"
        />
      </div>

      {/* =====================================================================
          UNIFIED MISSING PIECE TOP NAVIGATION HEADER
      ===================================================================== */}
      <header className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-2 sm:gap-3 px-2.5 sm:px-6 py-2 sm:py-3 border-b border-purple-200/80 dark:border-purple-900/60 bg-white/90 dark:bg-[#1a0624]/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
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
              soundEngine.playClick();
              setOverlay('NONE');
              setScreen('TITLE');
            }}
            className="flex items-center gap-1.5 sm:gap-2.5 text-left group shrink-0 focus:outline-none cursor-pointer"
          >
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="MP Difference - The Missing Piece Logo"
              className="w-8 h-8 sm:w-11 sm:h-11 rounded-full object-contain drop-shadow-md group-hover:scale-105 transition-transform"
            />
            <div>
              <span className="text-sm sm:text-xl font-extrabold tracking-tight text-[#3b0d47] dark:text-white block leading-none">
                MP <span className="text-amber-500 dark:text-amber-400">Difference</span>
              </span>
              <span className="hidden sm:block text-[10px] uppercase font-bold text-[#581c6b] dark:text-amber-300/80 tracking-wider">
                The Missing Piece
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Center Navigation (Title) OR Active Telemetry */}
        {screen === 'TITLE' ? (
          <nav className="hidden lg:flex items-center gap-5 text-sm font-semibold text-slate-600 dark:text-purple-200/80">
            <button
              type="button"
              onClick={() => startPuzzle(todayKey)}
              className="hover:text-[#581c6b] dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer font-bold text-[#581c6b] dark:text-amber-400"
            >
              Today&apos;s Edition (#{todayPuzzle.issueNumber})
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setScreen('ARCHIVE');
              }}
              className="hover:text-[#581c6b] dark:hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-4 h-4" /> 6-Month Archive ({archiveDates.length})
            </button>
            <button
              type="button"
              onClick={openLeaderboardModal}
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
          <div className="hidden md:flex items-center gap-3 text-xs sm:text-sm font-mono-tabular bg-purple-50/90 dark:bg-[#240938]/90 px-3.5 py-1.5 rounded-xl border border-purple-200/80 dark:border-purple-800/70">
            <span className="font-bold text-[#3b0d47] dark:text-amber-300">
              #{activePuzzle.issueNumber}
            </span>
            <span className="text-purple-300 dark:text-purple-700" aria-hidden="true">
              ·
            </span>
            <span>
              Spotted{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {foundIds.length}/{activePuzzle.differences.length}
              </strong>
            </span>
            <span className="text-purple-300 dark:text-purple-700" aria-hidden="true">
              ·
            </span>
            <span>
              Time{' '}
              <strong className="text-[#2B0938] dark:text-white">
                {formatDuration(elapsedSeconds)}
              </strong>
            </span>
            <span className="text-purple-300 dark:text-purple-700" aria-hidden="true">
              ·
            </span>
            <span>
              Score{' '}
              <strong className="text-amber-600 dark:text-amber-400">
                {runningScore.toLocaleString()}
              </strong>
            </span>
            {combo > 1 && (
              <>
                <span className="text-purple-300 dark:text-purple-700" aria-hidden="true">
                  ·
                </span>
                <strong className="text-emerald-600 dark:text-emerald-400">×{combo} Streak</strong>
              </>
            )}
          </div>
        )}

        {/* Zone 3: Right Actions */}
        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          <DailyStreakBadge
            streak={dailyStreak.streak}
            solvedToday={dailyStreak.solvedToday}
            variant="light"
            compact
          />

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setScreen('ARCHIVE');
            }}
            title="6-Month Archive & Progress Tracker"
            className="p-1.5 sm:p-2 rounded-xl text-[#4a1259] dark:text-purple-200 hover:bg-purple-100/70 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
          >
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={openLeaderboardModal}
            title="Public Solo Games Leaderboards"
            className="p-1.5 sm:p-2 rounded-xl text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 transition-colors cursor-pointer"
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
                fallback={
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shrink-0" />
                    <UserIcon className="w-3.5 h-3.5 shrink-0" />
                  </>
                }
              />
              <span className="hidden xs:inline max-w-[70px] sm:max-w-[120px] truncate">
                {getCleanDisplayName(currentUser)}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openSignInModal}
              title="Sign in with Google or Email & Password"
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#2d0938] dark:bg-purple-900/70 hover:bg-[#3b0d47] text-amber-300 border border-amber-400/40 text-xs font-bold transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline">Sign In</span>
            </button>
          )}

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
            onClick={toggleMute}
            title={muted ? 'Unmute sound' : 'Mute sound'}
            className="hidden sm:flex p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
          >
            {muted ? (
              <VolumeX className="w-5 h-5 text-rose-500" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-[#4a1259]" />
            )}
          </button>

          {screen === 'PLAYING' && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setOverlay((prev) => (prev === 'PAUSED' ? 'NONE' : 'PAUSED'));
              }}
              title="Pause Game"
              aria-label="Pause Game"
              className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
            >
              <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>
      </header>

      {/* =====================================================================
          SCREEN 1: MISSING PIECE TITLE SCREEN
      ===================================================================== */}
      {screen === 'TITLE' && (
        <main className="relative z-10 max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-12 flex flex-col items-center justify-center flex-1 w-full">
          <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-12">
            {/* Left Side: Brand Lockup & CTAs */}
            <div className="flex flex-col items-center lg:items-start lg:text-left text-center max-w-xl w-full">
              <div className="relative mb-2 sm:mb-3 group">
                <div className="absolute inset-0 rounded-full bg-amber-400/25 blur-2xl group-hover:bg-amber-400/35 transition-all pointer-events-none" />
                <img
                  src="/assets/aistudio/3d_logo_944e5372.png"
                  alt="MP Difference - The Missing Piece Spot the Difference"
                  className="relative w-20 h-20 sm:w-36 sm:h-36 object-contain drop-shadow-[0_14px_28px_rgba(59,13,71,0.35)] hover:scale-105 transition-transform duration-300"
                />
              </div>

              <h1 className="text-3xl sm:text-6xl font-black tracking-tight text-[#3b0d47] dark:text-white mb-1.5 sm:mb-2">
                MP <span className="text-amber-500 dark:text-amber-400">Difference</span>
              </h1>
              <p className="text-[11px] sm:text-sm font-bold uppercase tracking-[0.2em] text-[#581c6b] dark:text-amber-300/90 mb-2.5 sm:mb-3">
                The Missing Piece · Daily Spot the Difference
              </p>
              <p className="text-xs sm:text-base text-slate-600 dark:text-purple-100/80 mb-4 sm:mb-5 leading-relaxed">
                Inspect paired illustrated pictures with a <strong>2.2× optical loupe</strong>. Spot missing elements, palette shifts, flipped orientations, and swapped details faster to build combo streaks and climb the leaderboard.
              </p>

              {/* Today's Edition Metadata */}
              <div className="w-full rounded-2xl bg-white/85 dark:bg-[#240830]/85 border border-purple-200 dark:border-purple-800/80 p-3.5 sm:p-4 mb-4 sm:mb-5 shadow-sm text-left">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular text-[#581c6b] dark:text-amber-300 mb-1">
                  <span className="font-bold">
                    Today&apos;s Daily · Issue #{todayPuzzle.issueNumber}
                  </span>
                  <span>{formatReadableDate(todayKey)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-slate-600 dark:text-purple-200/80">
                    <span>{todayPuzzle.differences.length} differences</span>
                    <span aria-hidden="true">·</span>
                    <span>{todayPuzzle.difficulty}</span>
                    <span aria-hidden="true">·</span>
                    <span>Par {formatDuration(todayPuzzle.parSeconds)}</span>
                  </div>
                  {todayCompletion && (
                    <span className="font-mono-tabular text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 shrink-0">
                      <Check className="w-3.5 h-3.5" />
                      Best {todayCompletion.bestScore.toLocaleString()} pts
                    </span>
                  )}
                </div>
              </div>

              {/* Compact Stats Strip */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-3 gap-y-1 text-xs sm:text-sm font-bold text-[#4a1259] dark:text-purple-200 mb-4 sm:mb-6">
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300 font-mono-tabular">
                  <Flame className="w-4 h-4 text-amber-500" />
                  {dailyStreak.streak}d Streak
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">
                  {stats.solvedCount} / {archiveDates.length} Solved
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">
                  Best {stats.allTimeBestScore.toLocaleString()} pts
                </span>
              </div>

              {/* Primary Play CTAs */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 sm:gap-3 w-full">
                <button
                  type="button"
                  onClick={() => startPuzzle(todayKey)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm sm:text-base font-extrabold bg-gradient-to-b from-[#FDE047] to-[#F59E0B] text-[#2d0938] shadow-[0_5px_0_#b45309] hover:brightness-105 active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{todayCompletion ? "Replay Today's Daily" : "Play Today's Daily"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setScreen('ARCHIVE');
                  }}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-bold bg-white/90 dark:bg-[#2d0938]/90 text-[#3b0d47] dark:text-[#F6C915] border-2 border-[#3b0d47]/20 dark:border-[#D4A437]/50 hover:border-amber-400 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Archive className="w-4 h-4 text-amber-500" />
                  <span>Archive ({archiveDates.length})</span>
                </button>

                <button
                  type="button"
                  onClick={openLeaderboardModal}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-bold bg-purple-100/80 dark:bg-purple-900/50 text-[#4a1259] dark:text-purple-100 hover:bg-purple-200 dark:hover:bg-purple-800/70 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>Leaderboard</span>
                </button>
              </div>

              <p className="hidden sm:block text-xs font-mono-tabular text-slate-500 dark:text-purple-300/70 mt-4">
                Tap Difference · H Hint · Z Optical Loupe · Space Pause
              </p>
            </div>

            {/* Right Side: Live Preview Card */}
            <div className="w-full max-w-lg shrink-0">
              <button
                type="button"
                onClick={() => startPuzzle(todayKey)}
                className="w-full text-left group rounded-2xl bg-white/95 dark:bg-[#240830]/95 border-2 border-[#4a1259]/25 dark:border-[#D4A437]/60 p-3 sm:p-5 shadow-xl hover:border-amber-400 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div>
                    <span className="text-[10px] font-mono-tabular uppercase tracking-widest font-bold text-amber-600 dark:text-[#F6C915]">
                      TODAY&apos;S DAILY PREVIEW
                    </span>
                    <h3 className="text-sm sm:text-lg font-black text-[#3b0d47] dark:text-white">
                      Issue #{todayPuzzle.issueNumber}
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-lg bg-[#3b0d47] text-[#F6C915] shrink-0">
                    Play <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5 pointer-events-none">
                  <SceneCanvas
                    puzzle={todayPuzzle}
                    mode="original"
                    foundIds={[]}
                    hintDiffId={null}
                    missFlash={null}
                    loupeActive={false}
                    hoverPos={null}
                    onHoverChange={() => {}}
                    onCanvasClick={() => {}}
                    disabled
                    compactHeader
                  />
                  <SceneCanvas
                    puzzle={todayPuzzle}
                    mode="altered"
                    foundIds={[]}
                    hintDiffId={null}
                    missFlash={null}
                    loupeActive={false}
                    hoverPos={null}
                    onHoverChange={() => {}}
                    onCanvasClick={() => {}}
                    disabled
                    compactHeader
                  />
                </div>

                <div className="mt-2.5 pt-2 border-t border-purple-100 dark:border-purple-800/60 flex items-center justify-between text-xs text-slate-600 dark:text-purple-200/80 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <SearchCheck className="w-3.5 h-3.5 text-amber-500" />
                    2.2× Synchronized Loupe
                  </span>
                  <span className="font-mono-tabular font-bold text-[#3b0d47] dark:text-amber-300">
                    {todayPuzzle.differences.length} differences
                  </span>
                </div>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* =====================================================================
          SCREEN 2: ACTIVE GAMEPLAY WORKBENCH (>80% picture area)
      ===================================================================== */}
      {screen === 'PLAYING' && (
        <main className="relative z-10 flex-1 flex flex-col min-h-0 max-w-[1440px] w-full mx-auto px-1.5 sm:px-6 py-1 sm:py-3">
          {/* Compact Inspection Action Bar */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pb-1.5 sm:pb-2.5">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setOverlay('PAUSED');
                }}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-white/90 dark:bg-[#240830] text-[#3b0d47] dark:text-purple-100 border border-purple-200 dark:border-purple-800 hover:border-amber-400 transition-colors cursor-pointer shrink-0"
              >
                <Pause className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Pause</span>
              </button>

              <div className="flex md:hidden items-center gap-1.5 text-xs font-mono-tabular bg-white/85 dark:bg-[#240830] px-2.5 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800">
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {foundIds.length}/{activePuzzle.differences.length}
                </strong>
                <span>·</span>
                <span>{formatDuration(elapsedSeconds)}</span>
                <span>·</span>
                <strong className="text-amber-600 dark:text-amber-400">
                  {runningScore.toLocaleString()}
                </strong>
              </div>

              <span className="hidden lg:inline text-xs font-semibold text-slate-600 dark:text-purple-200/80 truncate">
                Tap any difference on either picture · {activePuzzle.difficulty} Mode
              </span>
            </div>

            {/* Interactive Controls: Progress + Optical Loupe + Hint */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/85 dark:bg-[#240830] border border-purple-200 dark:border-purple-800">
                {activePuzzle.differences.map((d) => {
                  const found = foundIds.includes(d.id);
                  return (
                    <span
                      key={d.id}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        found
                          ? 'bg-emerald-500 scale-110 shadow-[0_0_6px_rgba(16,185,129,0.7)]'
                          : 'bg-purple-200 dark:bg-purple-800'
                      }`}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setLoupeActive((l) => !l);
                }}
                title="Toggle 2.2× Synchronized Optical Loupe (Z)"
                className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  loupeActive
                    ? 'bg-gradient-to-b from-[#FDE047] to-[#F59E0B] text-[#2d0938] border-amber-500 shadow-xs'
                    : 'bg-white/90 dark:bg-[#240830] text-[#3b0d47] dark:text-purple-100 border-purple-200 dark:border-purple-800 hover:border-amber-400'
                }`}
              >
                <SearchCheck className="w-3.5 h-3.5" />
                <span>
                  Loupe<span className="hidden sm:inline"> (Z)</span>
                </span>
              </button>

              <button
                type="button"
                onClick={triggerHint}
                title="Reveal a Difference Hint (H) — costs 180 pts"
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-[#3b0d47] text-[#F6C915] border border-[#F6C915]/40 hover:bg-[#4a1259] transition-colors cursor-pointer whitespace-nowrap shadow-xs"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>
                  Hint<span className="hidden sm:inline"> (H)</span>
                </span>
              </button>
            </div>
          </div>

          {/* Twin Illustrated Pictures — Tight vertical stack on mobile, side-by-side on desktop */}
          <div className="flex-1 min-h-0 flex items-start lg:items-center justify-center">
            <div className="w-full lg:h-full flex flex-col lg:grid lg:grid-cols-2 gap-1 sm:gap-2 lg:gap-4 items-center justify-center">
              <SceneCanvas
                puzzle={activePuzzle}
                mode="original"
                foundIds={foundIds}
                hintDiffId={hintDiffId}
                missFlash={missFlash}
                loupeActive={loupeActive}
                hoverPos={hoverPos}
                onHoverChange={setHoverPos}
                onCanvasClick={handleCanvasClick}
                disabled={overlay !== 'NONE'}
              />
              <SceneCanvas
                puzzle={activePuzzle}
                mode="altered"
                foundIds={foundIds}
                hintDiffId={hintDiffId}
                missFlash={missFlash}
                loupeActive={loupeActive}
                hoverPos={hoverPos}
                onHoverChange={setHoverPos}
                onCanvasClick={handleCanvasClick}
                disabled={overlay !== 'NONE'}
              />
            </div>
          </div>

          {/* Non-blocking ephemeral discovery toast */}
          {feedbackBanner && (
            <div className="pointer-events-none fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92vw] max-w-md flex justify-center">
              <div
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shadow-xl border text-center ${
                  feedbackBanner.tone === 'hit'
                    ? 'bg-emerald-950/95 border-emerald-400/60 text-emerald-100'
                    : feedbackBanner.tone === 'hint'
                      ? 'bg-[#2B0938]/95 border-[#F6C915]/60 text-[#FDE68A]'
                      : 'bg-rose-950/95 border-rose-400/60 text-rose-100'
                }`}
              >
                {feedbackBanner.text}
              </div>
            </div>
          )}
        </main>
      )}

      {/* =====================================================================
          PAUSE MODAL
      ===================================================================== */}
      {screen === 'PLAYING' && overlay === 'PAUSED' && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-5">
          <div className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#2B0948] to-[#160326] border-2 border-[#D4A437] p-6 space-y-5 shadow-2xl text-[#F5F3F7]">
            <div className="space-y-1">
              <p className="text-xs font-mono-tabular font-bold text-[#F6C915]">
                Issue #{activePuzzle.issueNumber} · {formatDuration(elapsedSeconds)}
              </p>
              <h2 className="text-2xl font-black text-white">Inspection Paused</h2>
              <p className="text-sm text-[#D6CBE2]">
                {foundIds.length} of {activePuzzle.differences.length} differences spotted.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setOverlay('NONE');
                }}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-extrabold bg-gradient-to-b from-[#FDE047] to-[#F59E0B] text-[#2d0938] hover:brightness-105 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume Inspection</span>
              </button>

              <button
                type="button"
                onClick={() => startPuzzle(activeDate)}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold bg-white/10 text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart Edition</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setOverlay('NONE');
                  setScreen('ARCHIVE');
                }}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold bg-white/10 text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                <Archive className="w-4 h-4 text-[#F6C915]" />
                <span>6-Month Archive</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setOverlay('NONE');
                  setScreen('TITLE');
                }}
                className="w-full py-2 text-xs font-semibold text-[#D6CBE2] hover:text-white transition-colors cursor-pointer"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VICTORY / COMPLETION MODAL
      ===================================================================== */}
      {screen === 'PLAYING' && overlay === 'VICTORY' && victoryBreakdown && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-lg rounded-2xl bg-gradient-to-b from-[#2B0948] to-[#160326] border-2 border-[#D4A437] p-6 sm:p-7 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto custom-scrollbar text-[#F5F3F7]">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-mono-tabular font-bold text-[#F6C915]">
                  Issue #{activePuzzle.issueNumber} · {formatReadableDate(activePuzzle.date)}
                </p>
                <h2 className="text-2xl sm:text-3xl font-black text-white">Edition Complete</h2>
                <p className="text-sm text-[#D6CBE2]">{activePuzzle.title}</p>
              </div>
              <div className="flex items-center gap-1 pt-1 shrink-0">
                {[1, 2, 3].map((s) => (
                  <Star
                    key={s}
                    className={`w-6 h-6 ${
                      s <= victoryBreakdown.stars
                        ? 'fill-[#F6C915] text-[#F6C915]'
                        : 'text-white/15'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Primary Score Hero */}
            <div className="rounded-xl bg-black/35 border border-[#D4A437]/40 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-[#D6CBE2]">Final Score</p>
                <p className="font-mono-tabular text-3xl font-black text-[#F6C915]">
                  {victoryBreakdown.finalScore.toLocaleString()}
                </p>
                {isNewPersonalBest && (
                  <p className="text-xs text-emerald-400 font-bold inline-flex items-center gap-1 mt-0.5">
                    <Award className="w-3.5 h-3.5" />
                    New Personal Best
                  </p>
                )}
              </div>

              <div className="text-right space-y-0.5 text-xs font-mono-tabular">
                <p className="text-white">
                  Time <span className="font-bold">{formatDuration(elapsedSeconds)}</span>
                </p>
                <p className="text-white">
                  Accuracy <span className="font-bold">{victoryBreakdown.accuracy.toFixed(0)}%</span>
                </p>
                <p className="text-[#D6CBE2]">
                  Max Streak <span className="text-white font-bold">×{Math.max(1, maxCombo)}</span>
                </p>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="space-y-1.5 text-xs border-t border-b border-white/10 py-3 font-mono-tabular">
              <div className="flex justify-between text-[#D6CBE2]">
                <span>Differences Spotted ({activePuzzle.differences.length})</span>
                <span className="text-white font-bold">+{victoryBreakdown.baseScore.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[#D6CBE2]">
                <span>Streak Bonus</span>
                <span className="text-white font-bold">+{victoryBreakdown.comboBonus.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[#D6CBE2]">
                <span>Speed Bonus (Par {formatDuration(activePuzzle.parSeconds)})</span>
                <span className="text-white font-bold">+{victoryBreakdown.speedBonus.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[#D6CBE2]">
                <span>Accuracy Bonus</span>
                <span className="text-white font-bold">+{victoryBreakdown.accuracyBonus.toLocaleString()}</span>
              </div>
              {(victoryBreakdown.hintPenalty > 0 || victoryBreakdown.mistakePenalty > 0) && (
                <div className="flex justify-between text-rose-400">
                  <span>
                    Penalties ({hintsUsed} hints · {mistakes} misses)
                  </span>
                  <span>
                    -{(victoryBreakdown.hintPenalty + victoryBreakdown.mistakePenalty).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Unified Account Sync Status */}
            {!currentUser ? (
              <div className="rounded-xl bg-[#F6C915]/10 border border-[#F6C915]/35 p-3.5 flex items-center justify-between gap-3">
                <p className="text-xs text-[#F5F3F7] leading-relaxed">
                  Saved locally. Sign in with Google or Email to post this score to the Solo Games leaderboard.
                </p>
                <button
                  type="button"
                  onClick={openSignInModal}
                  className="px-3.5 py-2 rounded-lg text-xs font-extrabold bg-[#F6C915] text-[#2d0938] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            ) : (
              <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Synced with {getCleanDisplayName(currentUser)} on the Solo Games leaderboard.</span>
              </p>
            )}

            {/* End-State CTAs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => startPuzzle(nextArchiveDate)}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-extrabold bg-gradient-to-b from-[#FDE047] to-[#F59E0B] text-[#2d0938] hover:brightness-105 transition-all cursor-pointer"
              >
                <span>Next Archive Edition</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={openLeaderboardModal}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold bg-white/10 text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-[#F6C915]" />
                <span>View Leaderboard</span>
              </button>
              <button
                type="button"
                onClick={() => startPuzzle(activeDate)}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-white/10 text-[#D6CBE2] hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setOverlay('NONE');
                  setScreen('TITLE');
                }}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-white/10 text-[#D6CBE2] hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Title Screen</span>
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
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowHowToPlay(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-gradient-to-b from-[#2B0948] to-[#160326] border-2 border-[#D4A437] p-6 text-[#F5F3F7] shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#F6C915]" />
                <h2 className="text-lg font-black text-white">How to Play MP Difference</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowHowToPlay(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#D6CBE2] hover:text-white cursor-pointer"
                aria-label="Close How to Play"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-[#D6CBE2] leading-relaxed">
              <p>
                Compare <strong className="text-white">Plate A (Original)</strong> and{' '}
                <strong className="text-[#F6C915]">Plate B (Altered Print)</strong> side by side. Click any visual difference on either plate to mark it.
              </p>
              <ul className="space-y-2 text-xs sm:text-sm list-disc pl-5">
                <li>
                  <strong className="text-white">6 Mutation Types:</strong> Watch for missing objects, added props, color palette shifts, flipped orientations, swapped patterns, and shifted positions.
                </li>
                <li>
                  <strong className="text-white">2.2× Optical Loupe (Z):</strong> Activate the synchronized magnifier to inspect fine details simultaneously across both plates.
                </li>
                <li>
                  <strong className="text-white">Streaks &amp; Accuracy:</strong> Consecutive accurate hits build a streak bonus (+140 pts per chain); misses reset streaks (-85 pts).
                </li>
                <li>
                  <strong className="text-white">Hints (H):</strong> Highlights an unspotted difference with a pulsing gold ring (-180 pts).
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setShowHowToPlay(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#FDE047] to-[#F59E0B] text-[#2d0938] font-extrabold text-sm cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          6-MONTH FOLIO ARCHIVE
      ===================================================================== */}
      {screen === 'ARCHIVE' && (
        <ArchiveModal
          completions={completions}
          activeDate={activeDate}
          onSelectPuzzle={(dateKey) => startPuzzle(dateKey)}
          onClose={() => {
            soundEngine.playClick();
            setScreen('TITLE');
          }}
        />
      )}

      {/* =====================================================================
          UNIFIED MISSING PIECE AUTH & LEADERBOARDS MODAL
      ===================================================================== */}
      <UnifiedAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialGameId="mpdifference"
        initialTab={authModalTab}
        user={currentUser}
      />
    </div>
  );
}
