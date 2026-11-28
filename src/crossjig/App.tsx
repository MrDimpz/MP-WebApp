import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, CheckCircle2, Lightbulb, Pin, PinOff, Undo2 } from 'lucide-react';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';
import { CLOUD_HYDRATED_EVENT } from '@/lib/cloud-progress';
import {
  getLondonTodayDateStr,
  recordDailyPuzzleSolved,
  useDailyStreak,
} from '@/lib/daily-streak';
import { useSiteTheme } from '@/lib/site-theme';
import {
  saveUnifiedLeaderboardScore,
  useUnifiedAuth,
} from '@/lib/unified-game-auth';
import { ArchiveModal } from './components/ArchiveModal';
import { CrosswordBoard } from './components/CrosswordBoard';
import { Header } from './components/Header';
import { HowToPlayModal } from './components/HowToPlayModal';
import { formatDuration, PuzzleLedger } from './components/PuzzleLedger';
import { CheckFeedbackState } from './components/TileFragment';
import { VictoryCelebration } from './components/VictoryCelebration';
import { getDictionary } from './game/dictionary';
import {
  formatShortDate,
  generatePuzzle,
  isDateInArchive,
} from './game/generator';
import { soundFX } from './game/sound';
import {
  loadPrefs,
  loadStats,
  recordSolve,
  saveDailyInProgress,
  savePrefs,
} from './game/storage';
import { GameMode, GeneratedPuzzle, MODE_CONFIGS, PlayerStats } from './game/types';
import { validateBoard } from './game/validator';
import './index.css';

interface UndoSnapshot {
  tileOrder: number[];
  pinnedSlots: number[];
}

export default function CrossJigApp() {
  const { user } = useUnifiedAuth();
  const { darkMode, toggleDarkMode } = useSiteTheme();
  const todayDateKey = useMemo(() => getLondonTodayDateStr(), []);

  const dictionaryWordCount = useMemo(() => getDictionary().totalWordCount, []);

  const [mode, setMode] = useState<GameMode>('master');
  const [puzzle, setPuzzle] = useState<GeneratedPuzzle>(() => generatePuzzle('master'));
  const [tileOrder, setTileOrder] = useState<number[]>(() => puzzle.initialOrder);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [hintLockedSlots, setHintLockedSlots] = useState<Set<number>>(() => new Set());
  const [pinnedSlots, setPinnedSlots] = useState<Set<number>>(() => new Set());
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  const [movesCount, setMovesCount] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);

  const [checkFeedback, setCheckFeedback] = useState<Map<number, CheckFeedbackState>>(
    () => new Map()
  );
  const [checkSummary, setCheckSummary] = useState<string | null>(null);
  const [settledSlots, setSettledSlots] = useState<Set<number>>(() => new Set());
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'account' | 'leaderboards'>('leaderboards');

  const [prefs, setPrefs] = useState(() => loadPrefs());
  const [stats, setStats] = useState<PlayerStats>(() => loadStats());

  const checkTimerRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const solveRecordedRef = useRef(false);

  useEffect(() => {
    const refreshFromStorage = () => {
      setStats(loadStats());
    };
    refreshFromStorage();
    window.addEventListener(CLOUD_HYDRATED_EVENT, refreshFromStorage);
    window.addEventListener('unified-auth-updated', refreshFromStorage);
    window.addEventListener('mp-site-auth-updated', refreshFromStorage);
    return () => {
      window.removeEventListener(CLOUD_HYDRATED_EVENT, refreshFromStorage);
      window.removeEventListener('unified-auth-updated', refreshFromStorage);
      window.removeEventListener('mp-site-auth-updated', refreshFromStorage);
    };
  }, [user?.uid]);

  const solvedToday = useMemo(
    () =>
      stats.lastDailyDate === todayDateKey ||
      stats.dailyCompletedDates.includes(todayDateKey),
    [stats.lastDailyDate, stats.dailyCompletedDates, todayDateKey]
  );

  const dailyStreak = useDailyStreak('crossjig', todayDateKey, solvedToday, stats.dailyStreak);

  const validation = useMemo(
    () =>
      validateBoard(
        tileOrder,
        puzzle.solvedTiles,
        puzzle.tileRows,
        puzzle.tileCols,
        puzzle.targetWordCount
      ),
    [tileOrder, puzzle]
  );

  const effectiveLockedSlots = useMemo(() => {
    const set = new Set<number>(hintLockedSlots);
    if (prefs.autoLockCorrect) {
      for (let i = 0; i < tileOrder.length; i++) {
        if (tileOrder[i] === i) {
          set.add(i);
        }
      }
    }
    return set;
  }, [hintLockedSlots, prefs.autoLockCorrect, tileOrder]);

  const clearFeedbackTimers = useCallback(() => {
    if (checkTimerRef.current !== null) {
      window.clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const flashSettled = useCallback((slots: number[]) => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }
    setSettledSlots(new Set(slots));
    settleTimerRef.current = window.setTimeout(() => {
      setSettledSlots(new Set());
      settleTimerRef.current = null;
    }, 200);
  }, []);

  const startFreshPuzzle = useCallback(
    (targetMode: GameMode, targetDailyDate?: string) => {
      clearFeedbackTimers();
      const dateToUse =
        targetMode === 'daily'
          ? targetDailyDate && isDateInArchive(targetDailyDate, todayDateKey)
            ? targetDailyDate
            : todayDateKey
          : undefined;
      const next = generatePuzzle(targetMode, undefined, dateToUse);
      const currentStats = loadStats();
      const savedRec =
        targetMode === 'daily' && dateToUse
          ? currentStats.dailyArchive?.[dateToUse]
          : undefined;
      const isAlreadySolved =
        targetMode === 'daily' &&
        Boolean(
          dateToUse &&
            (savedRec?.solved || currentStats.dailyCompletedDates.includes(dateToUse))
        );

      setMode(targetMode);
      setPuzzle(next);

      if (isAlreadySolved) {
        setTileOrder(next.solvedTiles.map((t) => t.id));
        setMovesCount(savedRec?.bestMoves ?? savedRec?.movesCount ?? 0);
        setHintsUsed(savedRec?.hintsUsed ?? 0);
        setElapsedSeconds(savedRec?.bestSeconds ?? savedRec?.elapsedSeconds ?? 0);
        setIsSolved(true);
        setLastScore(savedRec?.bestScore ?? null);
        solveRecordedRef.current = true;
      } else if (
        savedRec &&
        !savedRec.solved &&
        Array.isArray(savedRec.tileOrder) &&
        savedRec.tileOrder.length === next.initialOrder.length
      ) {
        setTileOrder(savedRec.tileOrder);
        setMovesCount(savedRec.movesCount ?? 0);
        setHintsUsed(savedRec.hintsUsed ?? 0);
        setElapsedSeconds(savedRec.elapsedSeconds ?? 0);
        setIsSolved(false);
        setLastScore(null);
        solveRecordedRef.current = false;
      } else {
        setTileOrder(next.initialOrder);
        setMovesCount(0);
        setHintsUsed(0);
        setElapsedSeconds(0);
        setIsSolved(false);
        setLastScore(null);
        solveRecordedRef.current = false;
      }

      setSelectedSlot(null);
      setHintLockedSlots(new Set());
      setPinnedSlots(new Set());
      setUndoStack([]);
      setCheckFeedback(new Map());
      setCheckSummary(null);
      setSettledSlots(new Set());
    },
    [clearFeedbackTimers, todayDateKey]
  );

  const handleSelectMode = useCallback(
    (nextMode: GameMode) => {
      if (nextMode === 'daily') {
        startFreshPuzzle('daily', todayDateKey);
        return;
      }
      startFreshPuzzle(nextMode);
    },
    [startFreshPuzzle, todayDateKey]
  );

  const handleSelectArchiveDate = useCallback(
    (dateStr: string) => {
      if (!isDateInArchive(dateStr, todayDateKey)) return;
      startFreshPuzzle('daily', dateStr);
    },
    [startFreshPuzzle, todayDateKey]
  );

  const handleNewPuzzle = useCallback(() => {
    const nextMode: GameMode = mode === 'daily' ? 'master' : mode;
    startFreshPuzzle(nextMode);
  }, [mode, startFreshPuzzle]);

  const handleResetCurrent = useCallback(() => {
    clearFeedbackTimers();
    setTileOrder(puzzle.initialOrder);
    setSelectedSlot(null);
    setHintLockedSlots(new Set());
    setPinnedSlots(new Set());
    setUndoStack([]);
    setMovesCount(0);
    setHintsUsed(0);
    setElapsedSeconds(0);
    setIsSolved(false);
    setLastScore(null);
    setCheckFeedback(new Map());
    setCheckSummary(null);
    setSettledSlots(new Set());
    solveRecordedRef.current = false;
    soundFX.swap(prefs.soundEnabled);
  }, [clearFeedbackTimers, puzzle.initialOrder, prefs.soundEnabled]);

  // Game clock
  useEffect(() => {
    if (isSolved || showHowToPlay || showArchive || authModalOpen) return;
    const id = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isSolved, showHowToPlay, showArchive, authModalOpen]);

  // Cleanup timers on unmount
  useEffect(() => clearFeedbackTimers, [clearFeedbackTimers]);

  // Detect victory
  useEffect(() => {
    if (validation.isSolved && !isSolved) {
      setIsSolved(true);
      setSelectedSlot(null);
      setCheckFeedback(new Map());
      setCheckSummary(null);
      soundFX.solved(prefs.soundEnabled);

      if (!solveRecordedRef.current) {
        solveRecordedRef.current = true;
        const solvedDate = puzzle.dailyDate || todayDateKey;
        const { stats: updated, score } = recordSolve(
          mode,
          elapsedSeconds,
          movesCount,
          hintsUsed,
          solvedDate,
          todayDateKey
        );
        setStats(updated);
        setLastScore(score);

        recordDailyPuzzleSolved('crossjig', solvedDate, 1);

        if (user) {
          const modeCfg = MODE_CONFIGS[mode];
          const puzzleId =
            mode === 'daily' && puzzle.dailyDate
              ? `daily-${puzzle.dailyDate}`
              : `${mode}-best`;
          const puzzleTitle =
            mode === 'daily' && puzzle.dailyDate
              ? `Daily CrossJig (${puzzle.dailyDate})`
              : `CrossJig ${modeCfg.label}`;
          void saveUnifiedLeaderboardScore({
            user,
            gameId: 'crossjig',
            puzzleId,
            puzzleTitle,
            score,
            metricLabel: `${score.toLocaleString()} pts (${formatDuration(elapsedSeconds)})`,
            subMetricLabel: `${modeCfg.label} · ${movesCount} moves${
              hintsUsed > 0 ? ` · ${hintsUsed}h` : ''
            }`,
          });
        }
      }
    }
  }, [
    validation.isSolved,
    isSolved,
    prefs.soundEnabled,
    mode,
    elapsedSeconds,
    movesCount,
    hintsUsed,
    puzzle.dailyDate,
    todayDateKey,
    user,
  ]);

  const handleSwap = useCallback(
    (fromSlot: number, toSlot: number) => {
      if (isSolved || fromSlot === toSlot) return;
      if (effectiveLockedSlots.has(fromSlot) || effectiveLockedSlots.has(toSlot)) {
        soundFX.bump(prefs.soundEnabled);
        return;
      }
      if (pinnedSlots.has(fromSlot) || pinnedSlots.has(toSlot)) {
        soundFX.bump(prefs.soundEnabled);
        return;
      }

      const prevCrossSeamCount = validation.validCrossSeamWords.length;

      setUndoStack((prev) => [
        ...prev.slice(-39),
        { tileOrder: [...tileOrder], pinnedSlots: Array.from(pinnedSlots) },
      ]);

      const nextOrder = [...tileOrder];
      const tmp = nextOrder[fromSlot];
      nextOrder[fromSlot] = nextOrder[toSlot];
      nextOrder[toSlot] = tmp;

      setTileOrder(nextOrder);
      const nextMoves = movesCount + 1;
      setMovesCount(nextMoves);
      setCheckFeedback(new Map());
      setCheckSummary(null);
      flashSettled([fromSlot, toSlot]);

      const nextVal = validateBoard(
        nextOrder,
        puzzle.solvedTiles,
        puzzle.tileRows,
        puzzle.tileCols,
        puzzle.targetWordCount
      );

      if (!nextVal.isSolved) {
        if (mode === 'daily' && puzzle.dailyDate) {
          setStats(
            saveDailyInProgress(
              puzzle.dailyDate,
              nextOrder,
              elapsedSeconds,
              nextMoves,
              hintsUsed
            )
          );
        }
        if (nextVal.validCrossSeamWords.length > prevCrossSeamCount) {
          soundFX.wordLinked(prefs.soundEnabled);
        } else {
          soundFX.swap(prefs.soundEnabled);
        }
      }
    },
    [
      isSolved,
      effectiveLockedSlots,
      pinnedSlots,
      validation.validCrossSeamWords.length,
      tileOrder,
      movesCount,
      mode,
      elapsedSeconds,
      hintsUsed,
      puzzle,
      prefs.soundEnabled,
      flashSettled,
    ]
  );

  const handleUndo = useCallback(() => {
    if (isSolved || undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setTileOrder(last.tileOrder);
    setPinnedSlots(new Set(last.pinnedSlots));
    setSelectedSlot(null);
    setCheckFeedback(new Map());
    setCheckSummary(null);
    soundFX.swap(prefs.soundEnabled);
  }, [isSolved, undoStack, prefs.soundEnabled]);

  const handleCheck = useCallback(() => {
    if (isSolved) return;
    if (checkTimerRef.current !== null) {
      window.clearTimeout(checkTimerRef.current);
    }

    const nextMap = new Map<number, CheckFeedbackState>();
    let correctCount = 0;
    for (let slot = 0; slot < tileOrder.length; slot++) {
      if (tileOrder[slot] === slot) {
        nextMap.set(slot, 'correct');
        correctCount++;
      } else {
        nextMap.set(slot, 'wrong');
      }
    }

    setCheckFeedback(nextMap);
    setCheckSummary(`${correctCount} of ${tileOrder.length} fragments in place`);
    soundFX.pickup(prefs.soundEnabled);

    checkTimerRef.current = window.setTimeout(() => {
      setCheckFeedback(new Map());
      checkTimerRef.current = null;
    }, 2600);
  }, [isSolved, tileOrder, prefs.soundEnabled]);

  const handleHint = useCallback(() => {
    if (isSolved) return;

    const misplacedSlots: number[] = [];
    for (let slot = 0; slot < tileOrder.length; slot++) {
      if (tileOrder[slot] !== slot && !effectiveLockedSlots.has(slot)) {
        misplacedSlots.push(slot);
      }
    }

    if (misplacedSlots.length === 0) return;

    const targetSlot = misplacedSlots[0];
    const sourceSlot = tileOrder.indexOf(targetSlot);
    if (sourceSlot === -1) return;

    const nextOrder = [...tileOrder];
    const tmp = nextOrder[targetSlot];
    nextOrder[targetSlot] = nextOrder[sourceSlot];
    nextOrder[sourceSlot] = tmp;

    setTileOrder(nextOrder);
    setHintLockedSlots((prev) => new Set(prev).add(targetSlot));
    setPinnedSlots((prev) => {
      const next = new Set(prev);
      next.delete(targetSlot);
      next.delete(sourceSlot);
      return next;
    });
    setUndoStack([]);
    setSelectedSlot(null);
    const nextHints = hintsUsed + 1;
    const nextMoves = movesCount + 1;
    setHintsUsed(nextHints);
    setMovesCount(nextMoves);
    setCheckFeedback(new Map());
    setCheckSummary(`Fragment placed and locked in slot ${targetSlot + 1}`);
    flashSettled([targetSlot, sourceSlot]);
    soundFX.hint(prefs.soundEnabled);

    if (mode === 'daily' && puzzle.dailyDate) {
      setStats(
        saveDailyInProgress(
          puzzle.dailyDate,
          nextOrder,
          elapsedSeconds,
          nextMoves,
          nextHints
        )
      );
    }
  }, [
    isSolved,
    tileOrder,
    effectiveLockedSlots,
    flashSettled,
    prefs.soundEnabled,
    hintsUsed,
    movesCount,
    mode,
    puzzle.dailyDate,
    elapsedSeconds,
  ]);

  const handleTogglePinSelected = useCallback(() => {
    if (selectedSlot === null || isSolved || effectiveLockedSlots.has(selectedSlot)) return;
    setPinnedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(selectedSlot)) {
        next.delete(selectedSlot);
      } else {
        next.add(selectedSlot);
      }
      return next;
    });
    soundFX.pickup(prefs.soundEnabled);
    setSelectedSlot(null);
  }, [selectedSlot, isSolved, effectiveLockedSlots, prefs.soundEnabled]);

  const handleToggleAutoLock = useCallback(() => {
    setPrefs((prev) => {
      const next = { ...prev, autoLockCorrect: !prev.autoLockCorrect };
      savePrefs(next);
      return next;
    });
  }, []);

  const handleToggleSound = useCallback(() => {
    setPrefs((prev) => {
      const next = { ...prev, soundEnabled: !prev.soundEnabled };
      savePrefs(next);
      return next;
    });
  }, []);

  const openLeaderboardModal = useCallback(() => {
    setAuthModalTab('leaderboards');
    setAuthModalOpen(true);
  }, []);

  const openAccountModal = useCallback(() => {
    setAuthModalTab('account');
    setAuthModalOpen(true);
  }, []);

  const isSelectedPinned = selectedSlot !== null && pinnedSlots.has(selectedSlot);
  const isSelectedLocked = selectedSlot !== null && effectiveLockedSlots.has(selectedSlot);
  const linkedCount = isSolved
    ? validation.allWords.filter((w) => w.isValid).length
    : validation.validCrossSeamWords.length;
  const isViewingPastArchive =
    mode === 'daily' && Boolean(puzzle.dailyDate && puzzle.dailyDate !== todayDateKey);

  return (
    <div
      className={`crossjig-root min-h-screen transition-colors ${
        darkMode
          ? 'bg-gradient-to-b from-[#130320] via-[#1B052C] to-[#12021D] text-[#FAF7FF]'
          : 'bg-gradient-to-b from-[#F7F3FB] via-[#EFE6F7] to-[#F7F3FB] text-[#1D0830]'
      }`}
    >
      <Header
        activeMode={mode}
        darkMode={darkMode}
        soundEnabled={prefs.soundEnabled}
        user={user}
        dailyStreak={dailyStreak}
        isViewingPastArchive={isViewingPastArchive}
        onSelectMode={handleSelectMode}
        onNewPuzzle={handleNewPuzzle}
        onOpenArchive={() => setShowArchive(true)}
        onOpenHowToPlay={() => setShowHowToPlay(true)}
        onToggleDarkMode={toggleDarkMode}
        onToggleSound={handleToggleSound}
        onOpenLeaderboard={openLeaderboardModal}
        onOpenAccount={openAccountModal}
      />

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:py-8">
        {/* Compact Mobile Telemetry Strip (visible below lg) */}
        <div className="mb-3.5 flex items-center justify-between gap-2 lg:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <h1
              className={`font-display text-lg font-extrabold tracking-tight truncate ${
                darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
              }`}
            >
              {mode === 'daily'
                ? isViewingPastArchive
                  ? `Archive · ${formatShortDate(puzzle.dailyDate!)}`
                  : 'Daily Crossword'
                : MODE_CONFIGS[mode].label}
            </h1>
            {mode === 'daily' && (
              <button
                type="button"
                onClick={() => setShowArchive(true)}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold shrink-0 cursor-pointer ${
                  darkMode
                    ? 'border-[#D4A437]/45 bg-[#2B0944] text-[#F6C915]'
                    : 'border-[#D9C6EC] bg-[#F5EFFA] text-[#2B0938]'
                }`}
              >
                <Calendar className="h-3 w-3" />
                <span>Calendar</span>
              </button>
            )}
          </div>
          <div
            className={`flex items-center gap-2 text-xs shrink-0 ${
              darkMode ? 'text-[#D6CBE2]' : 'text-[#5E3A73]'
            }`}
          >
            <span
              className={`font-mono-tabular font-bold ${
                darkMode ? 'text-[#FAF7FF]' : 'text-[#1D0830]'
              }`}
            >
              {formatDuration(elapsedSeconds)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{movesCount} moves</span>
            <span aria-hidden="true">·</span>
            <span
              className={`font-mono-tabular font-bold ${
                darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
              }`}
            >
              {linkedCount}/{validation.totalExpectedWords}
            </span>
          </div>
        </div>

        {/* Desktop 2-Column Studio Grid: Dominant Board Stage + Companion Ledger */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_364px] lg:gap-10">
          {/* Dominant Focal Anchor: Tactile Crossword Jigsaw Board */}
          <section className="flex flex-col items-center">
            <CrosswordBoard
              tileOrder={tileOrder}
              solvedTiles={puzzle.solvedTiles}
              tileCols={puzzle.tileCols}
              tileRows={puzzle.tileRows}
              selectedSlot={selectedSlot}
              lockedSlots={effectiveLockedSlots}
              pinnedSlots={pinnedSlots}
              checkFeedback={checkFeedback}
              settledSlots={settledSlots}
              isSolved={isSolved}
              darkMode={darkMode}
              onSwap={handleSwap}
              onSelectSlot={setSelectedSlot}
              onDragStartAudio={() => soundFX.pickup(prefs.soundEnabled)}
              onInvalidDropAudio={() => soundFX.bump(prefs.soundEnabled)}
            />

            {/* Mobile Thumb-Zone Action Strip (44px+ hitboxes, directly beneath board) */}
            {!isSolved && (
              <div className="mt-4 w-full max-w-[420px] lg:hidden">
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold active:scale-[0.98] disabled:opacity-40 whitespace-nowrap ${
                      darkMode
                        ? 'border-[#D4A437]/40 bg-[#2B0944] text-[#FAF7FF]'
                        : 'border-[#D9C6EC] bg-white text-[#1D0830]'
                    }`}
                  >
                    <Undo2 className="h-3.5 w-3.5 shrink-0 text-[#F6C915]" />
                    <span>Undo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCheck}
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold active:scale-[0.98] whitespace-nowrap ${
                      darkMode
                        ? 'border-[#D4A437]/40 bg-[#2B0944] text-[#FAF7FF]'
                        : 'border-[#D9C6EC] bg-white text-[#1D0830]'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#10B981]" />
                    <span>Check</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleHint}
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold active:scale-[0.98] whitespace-nowrap ${
                      darkMode
                        ? 'border-[#D4A437]/40 bg-[#2B0944] text-[#FAF7FF]'
                        : 'border-[#D9C6EC] bg-white text-[#1D0830]'
                    }`}
                  >
                    <Lightbulb className="h-3.5 w-3.5 shrink-0 text-[#F59E0B]" />
                    <span>Hint</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTogglePinSelected}
                    disabled={selectedSlot === null || isSelectedLocked}
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold active:scale-[0.98] disabled:opacity-40 whitespace-nowrap ${
                      darkMode
                        ? 'border-[#D4A437]/40 bg-[#2B0944] text-[#FAF7FF]'
                        : 'border-[#D9C6EC] bg-white text-[#1D0830]'
                    }`}
                  >
                    {isSelectedPinned ? (
                      <>
                        <PinOff className="h-3.5 w-3.5 shrink-0 text-[#F59E0B]" />
                        <span>Unpin</span>
                      </>
                    ) : (
                      <>
                        <Pin className="h-3.5 w-3.5 shrink-0 text-[#D4A437]" />
                        <span>Pin</span>
                      </>
                    )}
                  </button>
                </div>

                {checkSummary && (
                  <p
                    className={`mt-2 text-center text-xs font-bold ${
                      darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
                    }`}
                    role="status"
                  >
                    {checkSummary}
                  </p>
                )}
              </div>
            )}

            {/* Quiet interaction cue on desktop below the board */}
            {!isSolved && (
              <p
                className={`mt-3.5 hidden text-center text-xs lg:block ${
                  darkMode ? 'text-[#C2B2D4]' : 'text-[#5E3A73]'
                }`}
              >
                Drag any 3×3 fragment onto another to swap · Tap a tile then tap another to swap ·
                Arrow keys + Enter supported
              </p>
            )}
          </section>

          {/* Companion Puzzle Ledger */}
          <PuzzleLedger
            mode={mode}
            dailyDate={puzzle.dailyDate}
            todayDateKey={todayDateKey}
            elapsedSeconds={elapsedSeconds}
            movesCount={movesCount}
            hintsUsed={hintsUsed}
            canUndo={undoStack.length > 0}
            selectedSlot={selectedSlot}
            isSelectedPinned={isSelectedPinned}
            isSelectedLocked={isSelectedLocked}
            validation={validation}
            isSolved={isSolved}
            lastScore={lastScore}
            checkSummary={checkSummary}
            autoLockCorrect={prefs.autoLockCorrect}
            soundEnabled={prefs.soundEnabled}
            darkMode={darkMode}
            dictionaryWordCount={dictionaryWordCount}
            stats={stats}
            onUndo={handleUndo}
            onCheck={handleCheck}
            onHint={handleHint}
            onTogglePinSelected={handleTogglePinSelected}
            onResetCurrent={handleResetCurrent}
            onPlayAgain={handleNewPuzzle}
            onToggleAutoLock={handleToggleAutoLock}
            onToggleSound={handleToggleSound}
            onOpenLeaderboard={openLeaderboardModal}
            onOpenArchive={() => setShowArchive(true)}
            onSelectArchiveDate={handleSelectArchiveDate}
          />
        </div>
      </main>

      <ArchiveModal
        open={showArchive}
        darkMode={darkMode}
        stats={stats}
        todayDateStr={todayDateKey}
        selectedDateStr={mode === 'daily' ? puzzle.dailyDate || todayDateKey : todayDateKey}
        onSelectDate={handleSelectArchiveDate}
        onClose={() => setShowArchive(false)}
      />

      <HowToPlayModal
        open={showHowToPlay}
        darkMode={darkMode}
        onClose={() => setShowHowToPlay(false)}
      />
      <VictoryCelebration active={isSolved} />

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        user={user}
        initialGameId="crossjig"
        initialTab={authModalTab}
      />
    </div>
  );
}
