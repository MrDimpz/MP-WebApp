import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Infinity as InfinityIcon,
  LogIn,
  Moon,
  RotateCcw,
  Sun,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import { UserProfileIcon } from '@/components/user-profile-icon';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';
import { CLOUD_HYDRATED_EVENT } from '@/lib/cloud-progress';
import { recordDailyPuzzleSolved, useDailyStreak } from '@/lib/daily-streak';
import { useSiteTheme } from '@/lib/site-theme';
import {
  getCleanDisplayName,
  saveUnifiedLeaderboardScore,
  useUnifiedAuth,
} from '@/lib/unified-game-auth';
import { ArchiveModal } from './components/ArchiveModal';
import { EndGameModal } from './components/EndGameModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import {
  BoardEvaluation,
  computeWordlockScore,
  DIFFICULTY_CONFIGS,
  DIFFICULTY_ORDER,
  DifficultyId,
  evaluateBoard,
  formatShortDisplayDate,
  GameMode,
  GameStatus,
  generateUnlimitedPuzzle,
  getDailyPuzzleByDate,
  getProgressKey,
  getTodayDateKey,
  PuzzleDefinition,
} from './game/puzzleEngine';
import { soundEngine } from './game/soundEngine';
import { WordlockScene } from './scene/WordlockScene';
import {
  loadAllProgress,
  loadPrefs,
  loadStats,
  saveAllProgress,
  savePrefs,
  saveStats,
  WordlockDayRecord,
  WordlockStats,
} from './utils/storage';
import './index.css';

function triggerVaultConfetti(): void {
  try {
    confetti({
      particleCount: 70,
      spread: 75,
      origin: { y: 0.62 },
      colors: ['#F6C915', '#D4A437', '#10B981', '#A855F7', '#FAF7FF'],
    });
  } catch {
    // Ignore if canvas-confetti is unavailable
  }
}

export default function WordlockApp() {
  const { user } = useUnifiedAuth();
  const { darkMode, toggleDarkMode } = useSiteTheme();

  const initialPrefs = useMemo(() => loadPrefs(), []);
  const [todayDateKey] = useState<string>(() => getTodayDateKey());
  const [mode, setMode] = useState<GameMode>('daily');
  const [activeDateKey, setActiveDateKey] = useState<string>(() => getTodayDateKey());
  const [difficulty, setDifficulty] = useState<DifficultyId>(initialPrefs.difficulty);
  const [unlimitedSeq, setUnlimitedSeq] = useState<number>(1);

  const [puzzle, setPuzzle] = useState<PuzzleDefinition>(() =>
    getDailyPuzzleByDate(getTodayDateKey(), initialPrefs.difficulty)
  );
  const [wheelSteps, setWheelSteps] = useState<[number, number, number, number]>(() => [
    ...puzzle.startOffsets,
  ]);
  const [clicksUsed, setClicksUsed] = useState<number>(0);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [selectedCol, setSelectedCol] = useState<number>(0);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(initialPrefs.soundEnabled);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [showArchive, setShowArchive] = useState<boolean>(false);
  const [showEndModal, setShowEndModal] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'account' | 'leaderboards'>('leaderboards');

  const [progressMap, setProgressMap] = useState<Record<string, WordlockDayRecord>>(() =>
    loadAllProgress()
  );
  const [stats, setStats] = useState<WordlockStats>(() => loadStats());

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<WordlockScene | null>(null);
  const unlockTimerRef = useRef<number | null>(null);

  // Refs for fresh access inside Three.js event callbacks (prevents tearing down WebGL canvas)
  const puzzleRef = useRef(puzzle);
  const wheelStepsRef = useRef(wheelSteps);
  const clicksUsedRef = useRef(clicksUsed);
  const statusRef = useRef(status);
  const userRef = useRef(user);
  const todayDateKeyRef = useRef(todayDateKey);
  puzzleRef.current = puzzle;
  wheelStepsRef.current = wheelSteps;
  clicksUsedRef.current = clicksUsed;
  statusRef.current = status;
  userRef.current = user;
  todayDateKeyRef.current = todayDateKey;

  const evaluation = useMemo<BoardEvaluation>(
    () => evaluateBoard(puzzle, wheelSteps),
    [puzzle, wheelSteps]
  );

  const clicksRemaining = Math.max(0, puzzle.maxClicks - clicksUsed);
  const validRowsCount = useMemo(
    () => evaluation.rowValid.filter(Boolean).length,
    [evaluation.rowValid]
  );
  const centerWord = evaluation.rows[puzzle.masterRowIndex] ?? '----';

  // Sync mute state with SoundEngine
  useEffect(() => {
    soundEngine.setMuted(!soundEnabled);
    savePrefs({ soundEnabled, difficulty });
  }, [soundEnabled, difficulty]);

  // Reload per-user storage on login/logout or cloud hydration
  useEffect(() => {
    const refreshFromStorage = () => {
      setProgressMap(loadAllProgress());
      setStats(loadStats());
    };
    refreshFromStorage();
    window.addEventListener(CLOUD_HYDRATED_EVENT, refreshFromStorage);
    return () => window.removeEventListener(CLOUD_HYDRATED_EVENT, refreshFromStorage);
  }, [user?.uid]);

  const solvedToday = useMemo(() => {
    return DIFFICULTY_ORDER.some(
      (lvl) => progressMap[getProgressKey(todayDateKey, lvl)]?.status === 'won'
    );
  }, [progressMap, todayDateKey]);

  const dailyStreak = useDailyStreak('wordlock', todayDateKey, solvedToday, stats.currentStreak);

  // Record finished puzzle (stats, archive completion, daily streak, leaderboard)
  const recordPuzzleOutcome = useCallback(
    (finishedPuzzle: PuzzleDefinition, won: boolean, finalClicks: number) => {
      const score = won ? computeWordlockScore(finishedPuzzle, finalClicks) : 0;

      if (finishedPuzzle.mode === 'daily' && finishedPuzzle.dateKey) {
        const key = getProgressKey(finishedPuzzle.dateKey, finishedPuzzle.difficulty);
        setProgressMap((prev) => {
          const existing = prev[key];
          const shouldKeepWon = existing?.status === 'won' && !won;
          const nextBestClicks = won
            ? existing?.bestClicks != null
              ? Math.min(existing.bestClicks, finalClicks)
              : finalClicks
            : existing?.bestClicks ?? null;
          const nextBestScore = Math.max(existing?.bestScore ?? 0, score);

          const updated: Record<string, WordlockDayRecord> = {
            ...prev,
            [key]: {
              dateKey: finishedPuzzle.dateKey!,
              difficulty: finishedPuzzle.difficulty,
              status: shouldKeepWon ? 'won' : won ? 'won' : 'lost',
              bestClicks: nextBestClicks,
              par: finishedPuzzle.par,
              maxClicks: finishedPuzzle.maxClicks,
              bestScore: nextBestScore,
              completedAt: Date.now(),
            },
          };
          saveAllProgress(updated);
          return updated;
        });
      }

      setStats((prev) => {
        const nextStreak = won ? prev.currentStreak + 1 : 0;
        const nextStats: WordlockStats = {
          played: prev.played + 1,
          won: prev.won + (won ? 1 : 0),
          currentStreak: nextStreak,
          maxStreak: Math.max(prev.maxStreak, nextStreak),
          parSolves: prev.parSolves + (won && finalClicks <= finishedPuzzle.par ? 1 : 0),
          totalScore: prev.totalScore + score,
          bestScore: Math.max(prev.bestScore, score),
          winsByDifficulty: {
            ...prev.winsByDifficulty,
            [finishedPuzzle.difficulty]:
              (prev.winsByDifficulty[finishedPuzzle.difficulty] || 0) + (won ? 1 : 0),
          },
          lastWonDate: won ? todayDateKeyRef.current : prev.lastWonDate,
        };
        saveStats(nextStats);
        return nextStats;
      });

      if (won) {
        if (finishedPuzzle.mode === 'daily' && finishedPuzzle.dateKey) {
          recordDailyPuzzleSolved('wordlock', finishedPuzzle.dateKey, 1);
        }

        const activeUser = userRef.current;
        if (activeUser) {
          const diffMeta = DIFFICULTY_CONFIGS[finishedPuzzle.difficulty];
          void saveUnifiedLeaderboardScore({
            user: activeUser,
            gameId: 'wordlock',
            puzzleId: finishedPuzzle.id,
            puzzleTitle: `Wordlock ${finishedPuzzle.label} (${diffMeta.label})`,
            score,
            metricLabel: `${score.toLocaleString()} pts (${finalClicks}/${finishedPuzzle.maxClicks} clicks)`,
            subMetricLabel: `${diffMeta.label} · ${finishedPuzzle.rowCount}R · PAR ${finishedPuzzle.par}`,
          });
        }
      }
    },
    []
  );

  // Core rotation handler used by 3D scene drag/click/scroll, bottom dock, and keyboard
  const handleWheelRotate = useCallback(
    (col: number, delta: number) => {
      if (statusRef.current !== 'playing') return;
      const currentPuzzle = puzzleRef.current;
      const currentSteps = wheelStepsRef.current;
      const currentClicks = clicksUsedRef.current;
      const remaining = Math.max(0, currentPuzzle.maxClicks - currentClicks);
      if (delta === 0 || remaining <= 0) return;

      const clampedDelta =
        Math.sign(delta) * Math.min(Math.abs(Math.round(delta)), remaining);
      if (clampedDelta === 0) return;

      const stepCost = Math.abs(clampedDelta);
      const prevEval = evaluateBoard(currentPuzzle, currentSteps);

      const nextSteps: [number, number, number, number] = [...currentSteps];
      nextSteps[col] = nextSteps[col] + clampedDelta;
      const nextClicks = currentClicks + stepCost;
      const nextEval = evaluateBoard(currentPuzzle, nextSteps);

      setSelectedCol(col);
      setWheelSteps(nextSteps);
      setClicksUsed(nextClicks);

      soundEngine.playTumblerClick((col - 1.5) * 0.45);

      const prevValidCount = prevEval.rowValid.filter(Boolean).length;
      const nextValidCount = nextEval.rowValid.filter(Boolean).length;
      const prevGreenCount = prevEval.masterKeyPins.filter((p) => p === 'green').length;
      const nextGreenCount = nextEval.masterKeyPins.filter((p) => p === 'green').length;

      if (nextEval.isSolved) {
        setStatus('unlocking');
        soundEngine.playLeverPull();
        soundEngine.playVaultUnlock();
        triggerVaultConfetti();
        recordPuzzleOutcome(currentPuzzle, true, nextClicks);

        if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = window.setTimeout(() => {
          setStatus('won');
          setShowEndModal(true);
        }, 1150);
      } else if (nextClicks >= currentPuzzle.maxClicks) {
        setStatus('lost');
        soundEngine.playLockout();
        recordPuzzleOutcome(currentPuzzle, false, nextClicks);

        if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = window.setTimeout(() => {
          setShowEndModal(true);
        }, 550);
      } else {
        if (nextGreenCount > prevGreenCount) {
          soundEngine.playPinGreen();
        } else if (nextValidCount > prevValidCount) {
          soundEngine.playRowValid();
        }
      }
    },
    [recordPuzzleOutcome]
  );

  const rotateHandlerRef = useRef(handleWheelRotate);
  rotateHandlerRef.current = handleWheelRotate;

  // Mount Three.js WordlockScene ONCE inside isolated container
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const scene = new WordlockScene(
      mount,
      {
        onWheelRotate: (col, delta) => rotateHandlerRef.current(col, delta),
        onHoverWheelChange: (col) => setHoveredCol(col),
        onDragDetentTick: (col) => soundEngine.playDragTick((col - 1.5) * 0.35),
      },
      darkMode
    );
    sceneRef.current = scene;

    const initPuzzle = puzzleRef.current;
    const initSteps = wheelStepsRef.current;
    scene.loadPuzzle(initPuzzle, initSteps, evaluateBoard(initPuzzle, initSteps));
    scene.setMaxDragSteps(initPuzzle.maxClicks);

    return () => {
      if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current);
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync Dark/Light theme to 3D studio lighting & backdrop
  useEffect(() => {
    sceneRef.current?.setTheme(darkMode);
  }, [darkMode]);

  // Sync evaluation, wheel steps, lock state & remaining drag clicks to 3D scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const isUnlockingOrWon = status === 'unlocking' || status === 'won';
    scene.syncEvaluationState(wheelSteps, evaluation, isUnlockingOrWon);
    scene.setInteractionLocked(status !== 'playing');
    scene.setMaxDragSteps(clicksRemaining);
  }, [wheelSteps, evaluation, status, clicksRemaining]);

  // Helper to activate a new puzzle and animate the 3D conveyor transition
  const activatePuzzle = useCallback((nextPuzzle: PuzzleDefinition) => {
    if (unlockTimerRef.current) {
      window.clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
    const initSteps: [number, number, number, number] = [...nextPuzzle.startOffsets];
    const initEval = evaluateBoard(nextPuzzle, initSteps);

    setPuzzle(nextPuzzle);
    setWheelSteps(initSteps);
    setClicksUsed(0);
    setStatus('playing');
    setShowEndModal(false);

    const scene = sceneRef.current;
    if (scene) {
      scene.loadPuzzle(nextPuzzle, initSteps, initEval);
      scene.setInteractionLocked(false);
      scene.setMaxDragSteps(nextPuzzle.maxClicks);
    }
  }, []);

  const handleSelectArchiveDay = useCallback(
    (dateKey: string, nextDiff: DifficultyId) => {
      setMode('daily');
      setActiveDateKey(dateKey);
      setDifficulty(nextDiff);
      activatePuzzle(getDailyPuzzleByDate(dateKey, nextDiff));
    },
    [activatePuzzle]
  );

  const handleChangeDifficulty = useCallback(
    (nextDiff: DifficultyId) => {
      setDifficulty(nextDiff);
      if (mode === 'daily') {
        activatePuzzle(getDailyPuzzleByDate(activeDateKey, nextDiff));
      } else {
        const nextSeq = unlimitedSeq + 1;
        setUnlimitedSeq(nextSeq);
        activatePuzzle(generateUnlimitedPuzzle(nextSeq, nextDiff));
      }
    },
    [mode, activeDateKey, unlimitedSeq, activatePuzzle]
  );

  const handleStartUnlimited = useCallback(
    (targetDiff?: DifficultyId) => {
      const diffToUse = targetDiff ?? difficulty;
      setMode('unlimited');
      setDifficulty(diffToUse);
      const nextSeq = unlimitedSeq + 1;
      setUnlimitedSeq(nextSeq);
      activatePuzzle(generateUnlimitedPuzzle(nextSeq, diffToUse));
    },
    [difficulty, unlimitedSeq, activatePuzzle]
  );

  const handleRetry = useCallback(() => {
    activatePuzzle({
      ...puzzle,
      startOffsets: [...puzzle.startOffsets] as [number, number, number, number],
    });
  }, [puzzle, activatePuzzle]);

  // Keyboard shortcuts (1-4, Arrows, H for dock toggle, R for retry)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showHelp || showArchive || showEndModal || authModalOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key >= '1' && e.key <= '4') {
        setSelectedCol(Number(e.key) - 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedCol((c) => (c + 3) % 4);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedCol((c) => (c + 1) % 4);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleWheelRotate(selectedCol, 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleWheelRotate(selectedCol, -1);
      } else if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        handleRetry();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    showHelp,
    showArchive,
    showEndModal,
    authModalOpen,
    selectedCol,
    handleWheelRotate,
    handleRetry,
  ]);

  const openAuthModal = (tab: 'account' | 'leaderboards') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const diffMeta = DIFFICULTY_CONFIGS[difficulty];
  const lowBudget = clicksRemaining <= 3 && status === 'playing';

  return (
    <div
      className={`wordlock-root relative h-dvh w-screen overflow-hidden ${
        darkMode ? 'bg-[#160524] text-[#F7F3FB]' : 'bg-[#EFE8F8] text-[#2B0938]'
      }`}
    >
      {/* Dedicated Isolated WebGL Viewport Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 z-0"
        aria-label="3D Wordlock mechanical conveyor vault"
      />

      {/* TOP HEADER BAR — Missing Piece Branded, Solid Surface (Zero backdrop-blur over WebGL) */}
      <header
        className={`relative z-20 border-b shadow-sm ${
          darkMode
            ? 'bg-[#1B052D]/94 border-[#D4A437]/30'
            : 'bg-white/95 border-[#D8C5EE]'
        }`}
      >
        <div className="max-w-6xl mx-auto px-2.5 sm:px-5 h-13 sm:h-15 flex items-center justify-between gap-2">
          {/* Left: Back + Brand + Streak */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              to="/solo-games"
              className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                darkMode
                  ? 'border-[#D4A437]/35 bg-[#27093F] text-[#F6C915] hover:bg-[#350D54]'
                  : 'border-[#D5C0EE] bg-[#F4EBFC] text-[#2B0938] hover:bg-[#EBDDFB]'
              }`}
              title="Back to Solo Games"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Solo Games</span>
            </Link>

            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/assets/aistudio/3d_logo_944e5372.png"
                alt="The Missing Piece"
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain shrink-0"
              />
              <div className="leading-tight min-w-0">
                <div
                  className={`text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.16em] font-bold truncate ${
                    darkMode ? 'text-[#F6C915]' : 'text-[#8F6500]'
                  }`}
                >
                  The Missing Piece
                </div>
                <div className="text-sm sm:text-base font-extrabold tracking-tight truncate">
                  WORDLOCK
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <DailyStreakBadge
                streak={dailyStreak.streak}
                solvedToday={dailyStreak.solvedToday}
                variant={darkMode ? 'amber-dark' : 'amber-light'}
                compact
              />
            </div>
          </div>

          {/* Center: Active Lock + Click Budget */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setShowArchive(true)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                darkMode
                  ? 'border-[#D4A437]/35 bg-[#260A3F] text-[#F7F3FB] hover:border-[#F6C915]'
                  : 'border-[#D5C0EE] bg-[#F7F1FC] text-[#2B0938] hover:border-[#2B0938]'
              }`}
              title="Open 6-Month Daily Archive"
            >
              <CalendarDays
                className={`w-3.5 h-3.5 shrink-0 ${darkMode ? 'text-[#F6C915]' : 'text-[#8F6500]'}`}
              />
              <span className="font-mono-tabular">
                {puzzle.mode === 'daily'
                  ? puzzle.dateKey === todayDateKey
                    ? 'Today'
                    : puzzle.label
                  : puzzle.label}
              </span>
              <span
                className={`hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  darkMode
                    ? 'bg-[#3A1161] text-[#F6C915]'
                    : 'bg-[#E9DBFA] text-[#4A1C6E]'
                }`}
              >
                {diffMeta.shortLabel} · {puzzle.rowCount}R
              </span>
            </button>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-mono-tabular text-xs font-extrabold whitespace-nowrap ${
                status === 'won' || status === 'unlocking'
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-400'
                  : lowBudget
                    ? 'border-rose-400/60 bg-rose-500/15 text-rose-400'
                    : darkMode
                      ? 'border-[#D4A437]/35 bg-[#260A3F] text-[#F6C915]'
                      : 'border-[#D5C0EE] bg-[#F7F1FC] text-[#2B0938]'
              }`}
              title={`Clicks remaining (${clicksUsed} used of ${puzzle.maxClicks}, Par ${puzzle.par})`}
            >
              <span>{clicksRemaining}</span>
              <span className="text-[10px] opacity-70 font-semibold hidden xs:inline">
                / {puzzle.maxClicks}
              </span>
              <span className="hidden sm:inline text-[10px] opacity-75 pl-1 border-l border-current/20">
                PAR {puzzle.par}
              </span>
            </div>
          </div>

          {/* Right: Site Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => openAuthModal('leaderboards')}
              aria-label="Leaderboards"
              title="Leaderboards"
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                darkMode
                  ? 'border-[#D4A437]/30 bg-[#25083B] text-[#F6C915] hover:border-[#F6C915]'
                  : 'border-[#D5C0EE] bg-white text-[#8F6500] hover:border-[#2B0938]'
              }`}
            >
              <Trophy className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowHelp(true)}
              aria-label="How to Play"
              title="How to Play"
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                darkMode
                  ? 'border-[#D4A437]/30 bg-[#25083B] text-[#E7DAF2] hover:border-[#F6C915] hover:text-[#F6C915]'
                  : 'border-[#D5C0EE] bg-white text-[#4A1C6E] hover:border-[#2B0938]'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
              title={soundEnabled ? 'Sound on' : 'Sound muted'}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                darkMode
                  ? 'border-[#D4A437]/30 bg-[#25083B] text-[#E7DAF2] hover:border-[#F6C915] hover:text-[#F6C915]'
                  : 'border-[#D5C0EE] bg-white text-[#4A1C6E] hover:border-[#2B0938]'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={darkMode ? 'Light mode' : 'Dark mode'}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                darkMode
                  ? 'border-[#D4A437]/30 bg-[#25083B] text-[#F6C915] hover:border-[#F6C915]'
                  : 'border-[#D5C0EE] bg-white text-[#4A1C6E] hover:border-[#2B0938]'
              }`}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => openAuthModal('account')}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 h-8 rounded-lg bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-extrabold text-xs shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title={
                user
                  ? `Signed in as ${getCleanDisplayName(user)}`
                  : 'Sign in to sync progress & leaderboards'
              }
            >
              {user ? (
                <>
                  <UserProfileIcon
                    user={user}
                    size={16}
                    className="w-4 h-4 shrink-0"
                    imgClassName="w-5 h-5 rounded-full object-cover border border-[#1D0830]/30"
                  />
                  <span className="hidden md:inline max-w-[88px] truncate">
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

      {/* Subtle Archive Date Banner when playing a past archive date */}
      {puzzle.mode === 'daily' && puzzle.dateKey && puzzle.dateKey !== todayDateKey && (
        <div className="pointer-events-none absolute top-15 sm:top-17 left-1/2 -translate-x-1/2 z-10">
          <div
            className={`pointer-events-auto inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-[11px] font-mono font-bold shadow-sm ${
              darkMode
                ? 'bg-[#24093B]/95 border-[#D4A437]/40 text-[#F6C915]'
                : 'bg-white/95 border-[#D5C0EE] text-[#2B0938]'
            }`}
          >
            <span>Archive: {formatShortDisplayDate(puzzle.dateKey)}</span>
            <button
              type="button"
              onClick={() => handleSelectArchiveDay(todayDateKey, difficulty)}
              className="underline underline-offset-2 hover:opacity-80 cursor-pointer"
            >
              Jump to Today
            </button>
          </div>
        </div>
      )}

      {/* COLLAPSIBLE BOTTOM TACTILE ROCKER DOCK (Zero Viewport Occlusion) */}
      <div className="pointer-events-none fixed bottom-2 sm:bottom-3.5 left-1/2 -translate-x-1/2 z-20 w-[min(660px,96vw)] flex flex-col items-center">
        {/* Collapse / Expand Handle */}
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          className={`pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-t-xl border border-b-0 text-[11px] font-mono uppercase tracking-wider font-bold transition-colors cursor-pointer ${
            darkMode
              ? 'bg-[#1D0731]/95 border-[#D4A437]/40 text-[#F6C915] hover:bg-[#2A0B46]'
              : 'bg-white/95 border-[#D5C0EE] text-[#2B0938] hover:bg-[#F5ECFC]'
          }`}
          title="Toggle Controls (H)"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div
            className={`pointer-events-auto w-full rounded-2xl border-2 p-2 sm:p-2.5 shadow-[0_18px_45px_rgba(0,0,0,0.45)] space-y-2 ${
              darkMode
                ? 'bg-[#1C0730]/95 border-[#D4A437]/40'
                : 'bg-white/96 border-[#D5C0EE]'
            }`}
          >
            {/* Row 1: Difficulty Tiers + Status Readout + Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1">
                {DIFFICULTY_ORDER.map((diffId) => {
                  const cfg = DIFFICULTY_CONFIGS[diffId];
                  const active = difficulty === diffId;
                  return (
                    <button
                      key={diffId}
                      type="button"
                      onClick={() => handleChangeDifficulty(diffId)}
                      className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                          : darkMode
                            ? 'bg-[#2B0C48] text-[#D6CBE2] hover:bg-[#3A1260]'
                            : 'bg-[#F4EBFC] text-[#4A1C6E] hover:bg-[#E9DAFA]'
                      }`}
                    >
                      {cfg.shortLabel}
                    </button>
                  );
                })}
              </div>

              {/* Valid Rows & Key Readout */}
              <div className="flex items-center gap-2 text-[11px] font-mono-tabular font-bold">
                <span
                  className={
                    validRowsCount === puzzle.rowCount
                      ? 'text-emerald-400'
                      : darkMode
                        ? 'text-amber-300'
                        : 'text-[#8F6500]'
                  }
                >
                  {validRowsCount}/{puzzle.rowCount} Words
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleRetry}
                    title="Retry this lock (R)"
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                      darkMode
                        ? 'border-[#D4A437]/30 bg-[#270A42] text-[#E7DAF2] hover:border-[#F6C915]'
                        : 'border-[#D5C0EE] bg-[#F7F1FC] text-[#2B0938] hover:border-[#2B0938]'
                    }`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span className="hidden sm:inline">Retry</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartUnlimited()}
                    title="Generate a fresh Unlimited lock"
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                      mode === 'unlimited'
                        ? 'border-[#F6C915] bg-[#F6C915]/20 text-[#F6C915]'
                        : darkMode
                          ? 'border-[#D4A437]/30 bg-[#270A42] text-[#F6C915] hover:border-[#F6C915]'
                          : 'border-[#D5C0EE] bg-[#2B0938] text-[#F6C915] hover:opacity-90'
                    }`}
                  >
                    <InfinityIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Unlimited</span>
                  </button>

                  {(status === 'won' || status === 'lost') && (
                    <button
                      type="button"
                      onClick={() => setShowEndModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 text-[#0B1C14] font-extrabold text-[11px] cursor-pointer"
                    >
                      Keycard
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: 4 Tactile Wheel Rocker Columns */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {[0, 1, 2, 3].map((col) => {
                const pin = evaluation.masterKeyPins[col];
                const letter = centerWord[col] ?? '-';
                const isSelected = selectedCol === col || hoveredCol === col;

                const pinBadgeClass =
                  pin === 'green'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400'
                    : pin === 'amber'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-400'
                      : darkMode
                        ? 'bg-[#160524] border-[#5D3F7A] text-[#C8B7DB]'
                        : 'bg-[#F4EBFC] border-[#D5C0EE] text-[#4A1C6E]';

                return (
                  <div
                    key={col}
                    onClick={() => setSelectedCol(col)}
                    className={`flex items-center justify-between gap-1 rounded-xl border px-1.5 sm:px-2 py-1 transition-colors ${
                      isSelected
                        ? darkMode
                          ? 'border-[#F6C915]/75 bg-[#2B0B47]'
                          : 'border-[#2B0938] bg-[#F2E6FC]'
                        : darkMode
                          ? 'border-[#D4A437]/20 bg-[#220839]'
                          : 'border-[#E2D2F5] bg-[#FAF6FE]'
                    }`}
                  >
                    <button
                      type="button"
                      disabled={status !== 'playing'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWheelRotate(col, 1);
                      }}
                      aria-label={`Rotate wheel ${col + 1} up`}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border transition-colors cursor-pointer disabled:opacity-40 ${
                        darkMode
                          ? 'border-[#D4A437]/30 bg-[#180529] text-[#F6C915] hover:bg-[#37105A] active:scale-95'
                          : 'border-[#D5C0EE] bg-white text-[#2B0938] hover:bg-[#EFE2FA] active:scale-95'
                      }`}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>

                    <div className="flex flex-col items-center leading-none">
                      <span
                        className={`text-[9px] font-mono font-bold opacity-65 mb-0.5`}
                      >
                        W{col + 1}
                      </span>
                      <span
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md border flex items-center justify-center font-mono-tabular text-xs sm:text-sm font-extrabold ${pinBadgeClass}`}
                      >
                        {letter}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={status !== 'playing'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWheelRotate(col, -1);
                      }}
                      aria-label={`Rotate wheel ${col + 1} down`}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border transition-colors cursor-pointer disabled:opacity-40 ${
                        darkMode
                          ? 'border-[#D4A437]/30 bg-[#180529] text-[#F6C915] hover:bg-[#37105A] active:scale-95'
                          : 'border-[#D5C0EE] bg-white text-[#2B0938] hover:bg-[#EFE2FA] active:scale-95'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      <HowToPlayModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        darkMode={darkMode}
      />

      <ArchiveModal
        isOpen={showArchive}
        onClose={() => setShowArchive(false)}
        todayDateKey={todayDateKey}
        activeDateKey={activeDateKey}
        activeDifficulty={difficulty}
        activeMode={mode}
        progressMap={progressMap}
        onSelectArchiveDay={handleSelectArchiveDay}
        onStartUnlimited={handleStartUnlimited}
        darkMode={darkMode}
      />

      <EndGameModal
        isOpen={showEndModal}
        won={status === 'won'}
        puzzle={puzzle}
        clicksUsed={clicksUsed}
        evaluation={evaluation}
        onClose={() => setShowEndModal(false)}
        onRetry={handleRetry}
        onNextPuzzle={() => handleStartUnlimited()}
        onOpenArchive={() => {
          setShowEndModal(false);
          setShowArchive(true);
        }}
        onOpenLeaderboard={() => {
          setShowEndModal(false);
          openAuthModal('leaderboards');
        }}
        darkMode={darkMode}
      />

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        user={user}
        initialGameId="wordlock"
        initialTab={authModalTab}
      />
    </div>
  );
}
