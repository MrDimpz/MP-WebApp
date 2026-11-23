import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpCircle,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {
  saveUnifiedLeaderboardScore,
  useUnifiedAuth,
} from '@/lib/unified-game-auth';
import { recordDailyPuzzleSolved } from '@/lib/daily-streak';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';
import { AlphabetRack } from './components/AlphabetRack';
import { ArchiveModal } from './components/ArchiveModal';
import { CrosswordBoard } from './components/CrosswordBoard';
import { Header } from './components/Header';
import { HowToPlayModal } from './components/HowToPlayModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { StatsModal } from './components/StatsModal';
import { TitleMenu } from './components/TitleMenu';
import { VictoryModal } from './components/VictoryModal';
import {
  formatCountdown,
  formatDisplayDate,
  formatDuration,
  getLondonDateStr,
  getMsUntilNextLondonMidnight,
  isDateInArchive,
  shiftDateStr,
} from './engine/londonTime';
import {
  getPuzzleForDate,
  UnolingoPuzzle,
  validateSolvedBoard,
  WordSlot,
} from './engine/puzzleGenerator';
import { soundFx } from './engine/soundFx';
import {
  calculateUnolingoScore,
  computeEffectiveStreak,
  getProgressDateKey,
  readPrefs,
  readProgressMap,
  readStats,
  sanitizeBoardLetters,
  sanitizeHintIndices,
  writePrefs,
  writeProgressMap,
  writeStats,
} from './engine/storage';
import { isValidUnolingoWord } from './engine/wordBank';
import {
  GameView,
  PuzzleProgressRecord,
  UndoSnapshot,
  UnolingoPrefs,
  UnolingoStats,
  UnolingoVictoryData,
} from './types';
import { CLOUD_HYDRATED_EVENT } from '@/lib/cloud-progress';
import { stripDiacritics, useDictionaryLanguage } from '@/lib/dictionary-languages';
import './index.css';

export default function App() {
  const [dictionaryLanguage] = useDictionaryLanguage();
  const [todayLondonStr, setTodayLondonStr] = useState<string>(() => getLondonDateStr());
  const [countdownMs, setCountdownMs] = useState<number>(() =>
    getMsUntilNextLondonMidnight()
  );

  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const qDate = new URLSearchParams(window.location.search).get('date');
      const today = getLondonDateStr();
      if (qDate && isDateInArchive(qDate, today)) {
        return qDate;
      }
    }
    return getLondonDateStr();
  });

  const [currentView, setCurrentView] = useState<GameView>(() => {
    if (typeof window !== 'undefined') {
      const qDate = new URLSearchParams(window.location.search).get('date');
      const today = getLondonDateStr();
      if (qDate && isDateInArchive(qDate, today)) {
        return 'PLAYING';
      }
    }
    return 'TITLE';
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
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

  // Per-user persistent state
  const [progressMap, setProgressMap] = useState<Record<string, PuzzleProgressRecord>>(() =>
    readProgressMap()
  );
  const [stats, setStats] = useState<UnolingoStats>(() => readStats());
  const [prefs, setPrefs] = useState<UnolingoPrefs>(() => readPrefs());

  // Reload per-user stores when unified auth session changes
  useEffect(() => {
    const syncStores = () => {
      setProgressMap(readProgressMap());
      setStats(readStats());
      setPrefs(readPrefs());
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
    soundFx.setMuted(!prefs.soundEnabled);
    writePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // London midnight countdown & rollover detection
  const [newDayNotice, setNewDayNotice] = useState<string | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      const currentLondon = getLondonDateStr();
      if (currentLondon !== todayLondonStr) {
        setTodayLondonStr(currentLondon);
        setNewDayNotice(currentLondon);
      }
      setCountdownMs(getMsUntilNextLondonMidnight());
    }, 1000);
    return () => window.clearInterval(id);
  }, [todayLondonStr]);

  const effectiveStreak = useMemo(
    () => computeEffectiveStreak(stats, todayLondonStr),
    [stats, todayLondonStr]
  );

  const progressDateKey = useMemo(
    () => getProgressDateKey(selectedDateStr, dictionaryLanguage),
    [selectedDateStr, dictionaryLanguage]
  );

  // Puzzles
  const puzzle: UnolingoPuzzle = useMemo(
    () => getPuzzleForDate(selectedDateStr, dictionaryLanguage),
    [selectedDateStr, dictionaryLanguage]
  );
  const todayPuzzle: UnolingoPuzzle = useMemo(
    () => getPuzzleForDate(todayLondonStr, dictionaryLanguage),
    [todayLondonStr, dictionaryLanguage]
  );

  // Active board state
  const [boardLetters, setBoardLetters] = useState<string[]>(() => new Array(26).fill(''));
  const [hintIndices, setHintIndices] = useState<number[]>([]);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [mistakes, setMistakes] = useState<number>(0);
  const [isSolved, setIsSolved] = useState<boolean>(false);

  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [direction, setDirection] = useState<'across' | 'down'>('across');
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [errorBlankIndices, setErrorBlankIndices] = useState<Set<number>>(new Set());
  const [victoryData, setVictoryData] = useState<UnolingoVictoryData | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const hydratedKeyRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  // Hydrate board state whenever date, language, or account changes
  useEffect(() => {
    const hydrationKey = `${currentUser?.uid || 'guest'}:${selectedDateStr}:${dictionaryLanguage}`;
    if (hydratedKeyRef.current === hydrationKey) return;
    hydratedKeyRef.current = hydrationKey;

    setVictoryData(null);
    const saved = progressMap[progressDateKey];
    if (saved) {
      setBoardLetters(sanitizeBoardLetters(saved.boardLetters));
      setHintIndices(sanitizeHintIndices(saved.hintIndices));
      setElapsedSec(Math.max(0, Number(saved.elapsedSec) || 0));
      setHintsUsed(Math.max(0, Number(saved.hintsUsed) || 0));
      setMistakes(Math.max(0, Number(saved.mistakes) || 0));
      setIsSolved(saved.status === 'completed');
    } else {
      setBoardLetters(new Array(26).fill(''));
      setHintIndices([]);
      setElapsedSec(0);
      setHintsUsed(0);
      setMistakes(0);
      setIsSolved(false);
    }

    setUndoStack([]);
    setErrorBlankIndices(new Set());

    const firstBlank = puzzle.blankCells[0];
    if (firstBlank) {
      setSelectedCell({ r: firstBlank.r, c: firstBlank.c });
      const hasAcross = puzzle.slots.some(
        (s) =>
          s.direction === 'across' &&
          s.cells.some((c) => c.r === firstBlank.r && c.c === firstBlank.c)
      );
      setDirection(hasAcross ? 'across' : 'down');
    }
  }, [selectedDateStr, dictionaryLanguage, progressDateKey, currentUser?.uid, progressMap, puzzle]);

  // Elapsed timer when actively playing
  useEffect(() => {
    if (currentView !== 'PLAYING' || isSolved || showHowToPlay || showAuthModal || victoryData) {
      return;
    }
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [currentView, isSolved, showHowToPlay, showAuthModal, victoryData]);

  // Persist in-progress board state whenever meaningful changes occur
  const persistProgress = useCallback(
    (
      nextLetters: string[],
      nextHints: number[],
      nextElapsed: number,
      nextHintsCount: number,
      nextMistakes: number,
      solvedStatus: 'in_progress' | 'completed',
      scoreValue?: number
    ) => {
      if (solvedStatus === 'in_progress' && !nextLetters.some(Boolean) && nextHints.length === 0) {
        return;
      }
      setProgressMap((prev) => {
        const existing = prev[progressDateKey];
        // Don't overwrite a completed puzzle back to in_progress
        if (existing?.status === 'completed' && solvedStatus !== 'completed') {
          return prev;
        }
        const updatedRecord: PuzzleProgressRecord = {
          puzzleDate: selectedDateStr,
          boardLetters: sanitizeBoardLetters(nextLetters),
          hintIndices: sanitizeHintIndices(nextHints),
          elapsedSec: Math.max(0, Math.floor(nextElapsed)),
          hintsUsed: Math.max(0, nextHintsCount),
          mistakes: Math.max(0, nextMistakes),
          score: scoreValue ?? existing?.score,
          status: solvedStatus,
          completedAt: solvedStatus === 'completed' ? Date.now() : existing?.completedAt,
        };
        const nextMap = { ...prev, [progressDateKey]: updatedRecord };
        writeProgressMap(nextMap);
        return nextMap;
      });
    },
    [progressDateKey, selectedDateStr]
  );

  // Save elapsed time cleanly every 5s while playing
  useEffect(() => {
    if (currentView !== 'PLAYING' || isSolved) return;
    if (elapsedSec > 0 && elapsedSec % 5 === 0 && (boardLetters.some(Boolean) || hintIndices.length > 0)) {
      persistProgress(boardLetters, hintIndices, elapsedSec, hintsUsed, mistakes, 'in_progress');
    }
  }, [elapsedSec, currentView, isSolved, boardLetters, hintIndices, hintsUsed, mistakes, persistProgress]);

  const activeSlot: WordSlot | null = useMemo(() => {
    if (!selectedCell) return puzzle.slots[0] ?? null;
    const matching = puzzle.slots.filter((s) =>
      s.cells.some((c) => c.r === selectedCell.r && c.c === selectedCell.c)
    );
    if (matching.length === 0) return null;
    const preferred = matching.find((s) => s.direction === direction);
    return preferred ?? matching[0];
  }, [puzzle.slots, selectedCell, direction]);

  const advanceSelection = useCallback(
    (fromR: number, fromC: number, nextLetters: string[]) => {
      if (activeSlot) {
        const idxInSlot = activeSlot.cells.findIndex(
          (c) => c.r === fromR && c.c === fromC
        );
        if (idxInSlot !== -1) {
          for (let i = idxInSlot + 1; i < activeSlot.cells.length; i++) {
            const cell = activeSlot.cells[i];
            const bIdx = puzzle.blankIndexMap[`${cell.r},${cell.c}`];
            if (bIdx !== undefined && !nextLetters[bIdx]) {
              setSelectedCell({ r: cell.r, c: cell.c });
              return;
            }
          }
        }
      }

      const curBIdx = puzzle.blankIndexMap[`${fromR},${fromC}`] ?? -1;
      for (let offset = 1; offset <= 26; offset++) {
        const candIdx = (curBIdx + offset) % 26;
        if (!nextLetters[candIdx]) {
          const cell = puzzle.blankCells[candIdx];
          setSelectedCell({ r: cell.r, c: cell.c });
          return;
        }
      }
    },
    [activeSlot, puzzle]
  );

  const handleCompleteCheck = useCallback(
    (
      nextLetters: string[],
      nextHints: number[],
      nextHintsCount: number,
      nextMistakes: number
    ) => {
      const check = validateSolvedBoard(puzzle, nextLetters, dictionaryLanguage);
      if (!check.isComplete) return;

      if (check.isSolved) {
        soundFx.playVictory();
        setIsSolved(true);
        setErrorBlankIndices(new Set());

        const finalTime = Math.max(1, elapsedSec);
        const finalScore = calculateUnolingoScore(finalTime, nextHintsCount, nextMistakes);
        const isFirstCompletion = progressMap[progressDateKey]?.status !== 'completed';
        const isDailyToday = selectedDateStr === todayLondonStr;
        const prevBestScore = Object.values(progressMap).reduce(
          (max, rec) => Math.max(max, rec.score || 0),
          0
        );
        const isNewBestScore = prevBestScore > 0 && finalScore > prevBestScore;
        const isNewBestTime = stats.bestTimeSec > 0 && finalTime < stats.bestTimeSec;
        const isNewHighScore = isNewBestScore || isNewBestTime;

        persistProgress(
          nextLetters,
          nextHints,
          finalTime,
          nextHintsCount,
          nextMistakes,
          'completed',
          finalScore
        );

        let nextStreakValue = effectiveStreak;
        let streakAdvanced = false;

        if (isFirstCompletion) {
          const prevStats = stats;
          let newStreak = prevStats.currentStreak;
          let newLastStreakDate = prevStats.lastDailyStreakDate;

          if (isDailyToday) {
            const yesterday = shiftDateStr(todayLondonStr, -1);
            if (prevStats.lastDailyStreakDate === todayLondonStr) {
              newStreak = prevStats.currentStreak;
            } else if (prevStats.lastDailyStreakDate === yesterday) {
              newStreak = prevStats.currentStreak + 1;
              newLastStreakDate = todayLondonStr;
              streakAdvanced = true;
            } else {
              newStreak = 1;
              newLastStreakDate = todayLondonStr;
              streakAdvanced = true;
            }
          }

          const updatedStats: UnolingoStats = {
            currentStreak: newStreak,
            longestStreak: Math.max(prevStats.longestStreak, newStreak),
            totalSolved: prevStats.totalSolved + 1,
            bestTimeSec:
              prevStats.bestTimeSec === 0
                ? finalTime
                : Math.min(prevStats.bestTimeSec, finalTime),
            totalHintsUsed: prevStats.totalHintsUsed + nextHintsCount,
            totalMistakes: prevStats.totalMistakes + nextMistakes,
            lastDailyStreakDate: newLastStreakDate,
          };

          nextStreakValue = computeEffectiveStreak(updatedStats, todayLondonStr);
          setStats(updatedStats);
          writeStats(updatedStats);
        }

        if (isDailyToday) {
          recordDailyPuzzleSolved('unolingo', todayLondonStr, Math.max(1, nextStreakValue));
        }

        void saveUnifiedLeaderboardScore({
          user: currentUser,
          gameId: 'unolingo',
          puzzleId: progressDateKey,
          puzzleTitle:
            dictionaryLanguage === 'en'
              ? `Unolingo ${selectedDateStr}`
              : `Unolingo ${selectedDateStr} (${dictionaryLanguage.toUpperCase()})`,
          score: finalScore,
          metricLabel: `${formatDuration(finalTime)} · ${nextHintsCount} hint${
            nextHintsCount === 1 ? '' : 's'
          } · ${selectedDateStr}`,
        });

        setVictoryData({
          puzzleDate: selectedDateStr,
          elapsedSec: finalTime,
          hintsUsed: nextHintsCount,
          mistakes: nextMistakes,
          score: finalScore,
          isDailyStreakAdvance: streakAdvanced,
          isDailyPuzzle: isDailyToday,
          isNewHighScore,
        });
      } else {
        soundFx.playError();
        const errSet = new Set<number>();
        for (const sId of check.invalidSlotIds) {
          const slot = puzzle.slots.find((s) => s.id === sId);
          if (!slot) continue;
          for (const cell of slot.cells) {
            const bIdx = puzzle.blankIndexMap[`${cell.r},${cell.c}`];
            if (bIdx !== undefined && !nextHints.includes(bIdx)) {
              errSet.add(bIdx);
            }
          }
        }
        setErrorBlankIndices(errSet);
        const bumpedMistakes = nextMistakes + 1;
        setMistakes(bumpedMistakes);
        persistProgress(
          nextLetters,
          nextHints,
          elapsedSec,
          nextHintsCount,
          bumpedMistakes,
          'in_progress'
        );
        showToast('All 26 letters placed, but some intersecting words need adjustment.');
      }
    },
    [
      puzzle,
      dictionaryLanguage,
      elapsedSec,
      progressMap,
      progressDateKey,
      selectedDateStr,
      todayLondonStr,
      persistProgress,
      effectiveStreak,
      stats,
      currentUser,
      showToast,
    ]
  );

  const placeLetterAtBlankIndex = useCallback(
    (targetBlankIdx: number, rawLetter: string) => {
      if (isSolved) return;
      const letter = stripDiacritics(rawLetter).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
      if (!/^[A-Z]$/.test(letter)) return;
      if (hintIndices.includes(targetBlankIdx)) {
        soundFx.playError();
        showToast('Hinted tiles are locked in place.');
        return;
      }

      const existingIdx = boardLetters.findIndex((ch) => ch === letter);
      if (existingIdx !== -1 && hintIndices.includes(existingIdx)) {
        soundFx.playError();
        showToast(`${letter} is already locked by a hint.`);
        return;
      }

      const nextLetters = [...boardLetters];
      if (existingIdx !== -1 && existingIdx !== targetBlankIdx) {
        nextLetters[existingIdx] = '';
      }

      const prevChar = nextLetters[targetBlankIdx];
      if (prevChar === letter) {
        const cell = puzzle.blankCells[targetBlankIdx];
        advanceSelection(cell.r, cell.c, nextLetters);
        return;
      }

      setUndoStack((prev) => [
        ...prev.slice(-39),
        { boardLetters: [...boardLetters], selectedCell },
      ]);
      nextLetters[targetBlankIdx] = letter;
      setBoardLetters(nextLetters);

      let nextMistakes = mistakes;
      if (prefs.autoCheck) {
        const expected = puzzle.blankCells[targetBlankIdx].solutionLetter;
        if (letter !== expected) {
          setErrorBlankIndices((prev) => {
            const next = new Set(prev);
            next.add(targetBlankIdx);
            return next;
          });
          nextMistakes = mistakes + 1;
          setMistakes(nextMistakes);
          soundFx.playError();
        } else {
          setErrorBlankIndices((prev) => {
            const next = new Set(prev);
            next.delete(targetBlankIdx);
            return next;
          });
          soundFx.playPlace();
        }
      } else {
        setErrorBlankIndices((prev) => {
          if (!prev.has(targetBlankIdx)) return prev;
          const next = new Set(prev);
          next.delete(targetBlankIdx);
          return next;
        });
        soundFx.playPlace();
      }

      persistProgress(
        nextLetters,
        hintIndices,
        elapsedSec,
        hintsUsed,
        nextMistakes,
        'in_progress'
      );

      const cell = puzzle.blankCells[targetBlankIdx];
      advanceSelection(cell.r, cell.c, nextLetters);

      if (nextLetters.some((ch) => !ch) && activeSlot) {
        const formed = activeSlot.cells
          .map(({ r, c }) => {
            const idx = puzzle.blankIndexMap[`${r},${c}`];
            return idx !== undefined ? nextLetters[idx] : puzzle.givens[r][c];
          })
          .join('');
        if (formed.length === activeSlot.length && isValidUnolingoWord(formed, dictionaryLanguage)) {
          soundFx.playWordValid();
        }
      }

      handleCompleteCheck(nextLetters, hintIndices, hintsUsed, nextMistakes);
    },
    [
      isSolved,
      hintIndices,
      boardLetters,
      puzzle,
      dictionaryLanguage,
      selectedCell,
      mistakes,
      prefs.autoCheck,
      elapsedSec,
      hintsUsed,
      persistProgress,
      advanceSelection,
      activeSlot,
      handleCompleteCheck,
      showToast,
    ]
  );

  const handleSelectCell = useCallback(
    (r: number, c: number) => {
      if (puzzle.layout[r][c] !== '.') return;
      soundFx.playSelect();

      const hasAcross = puzzle.slots.some(
        (s) =>
          s.direction === 'across' &&
          s.cells.some((cell) => cell.r === r && cell.c === c)
      );
      const hasDown = puzzle.slots.some(
        (s) =>
          s.direction === 'down' &&
          s.cells.some((cell) => cell.r === r && cell.c === c)
      );

      if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
        if (hasAcross && hasDown) {
          setDirection((d) => (d === 'across' ? 'down' : 'across'));
        }
        return;
      }

      setSelectedCell({ r, c });
      if (direction === 'across' && !hasAcross && hasDown) {
        setDirection('down');
      } else if (direction === 'down' && !hasDown && hasAcross) {
        setDirection('across');
      }
    },
    [puzzle, selectedCell, direction]
  );

  const handleLetterPress = useCallback(
    (letter: string) => {
      if (isSolved) return;

      const selectedBlankIdx = selectedCell
        ? puzzle.blankIndexMap[`${selectedCell.r},${selectedCell.c}`]
        : undefined;

      const existingIdx = boardLetters.findIndex((ch) => ch === letter);
      if (selectedBlankIdx === undefined || hintIndices.includes(selectedBlankIdx)) {
        if (existingIdx !== -1) {
          const cell = puzzle.blankCells[existingIdx];
          setSelectedCell({ r: cell.r, c: cell.c });
          soundFx.playSelect();
          return;
        }
        const firstEmpty = boardLetters.findIndex((ch) => !ch);
        if (firstEmpty !== -1) {
          const cell = puzzle.blankCells[firstEmpty];
          setSelectedCell({ r: cell.r, c: cell.c });
          placeLetterAtBlankIndex(firstEmpty, letter);
        }
        return;
      }

      if (boardLetters[selectedBlankIdx] === letter && existingIdx === selectedBlankIdx) {
        setUndoStack((prev) => [
          ...prev.slice(-39),
          { boardLetters: [...boardLetters], selectedCell },
        ]);
        const next = [...boardLetters];
        next[selectedBlankIdx] = '';
        setBoardLetters(next);
        persistProgress(next, hintIndices, elapsedSec, hintsUsed, mistakes, 'in_progress');
        soundFx.playRemove();
        return;
      }

      placeLetterAtBlankIndex(selectedBlankIdx, letter);
    },
    [
      isSolved,
      selectedCell,
      puzzle,
      boardLetters,
      hintIndices,
      elapsedSec,
      hintsUsed,
      mistakes,
      persistProgress,
      placeLetterAtBlankIndex,
    ]
  );

  const handleClearCell = useCallback(() => {
    if (isSolved || !selectedCell) return;
    const bIdx = puzzle.blankIndexMap[`${selectedCell.r},${selectedCell.c}`];
    if (bIdx === undefined || hintIndices.includes(bIdx)) return;

    if (boardLetters[bIdx]) {
      setUndoStack((prev) => [
        ...prev.slice(-39),
        { boardLetters: [...boardLetters], selectedCell },
      ]);
      const next = [...boardLetters];
      next[bIdx] = '';
      setBoardLetters(next);
      setErrorBlankIndices((prev) => {
        if (!prev.has(bIdx)) return prev;
        const n = new Set(prev);
        n.delete(bIdx);
        return n;
      });
      persistProgress(next, hintIndices, elapsedSec, hintsUsed, mistakes, 'in_progress');
      soundFx.playRemove();
      return;
    }

    if (activeSlot) {
      const pos = activeSlot.cells.findIndex(
        (c) => c.r === selectedCell.r && c.c === selectedCell.c
      );
      for (let i = pos - 1; i >= 0; i--) {
        const prevCell = activeSlot.cells[i];
        const prevBIdx = puzzle.blankIndexMap[`${prevCell.r},${prevCell.c}`];
        if (prevBIdx !== undefined && !hintIndices.includes(prevBIdx)) {
          setSelectedCell({ r: prevCell.r, c: prevCell.c });
          if (boardLetters[prevBIdx]) {
            setUndoStack((prev) => [
              ...prev.slice(-39),
              { boardLetters: [...boardLetters], selectedCell },
            ]);
            const next = [...boardLetters];
            next[prevBIdx] = '';
            setBoardLetters(next);
            persistProgress(next, hintIndices, elapsedSec, hintsUsed, mistakes, 'in_progress');
            soundFx.playRemove();
          }
          break;
        }
      }
    }
  }, [
    isSolved,
    selectedCell,
    puzzle,
    hintIndices,
    boardLetters,
    elapsedSec,
    hintsUsed,
    mistakes,
    persistProgress,
    activeSlot,
  ]);

  const handleUndo = useCallback(() => {
    if (isSolved || undoStack.length === 0) return;
    const snap = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setBoardLetters(snap.boardLetters);
    if (snap.selectedCell) setSelectedCell(snap.selectedCell);
    setErrorBlankIndices(new Set());
    persistProgress(snap.boardLetters, hintIndices, elapsedSec, hintsUsed, mistakes, 'in_progress');
    soundFx.playRemove();
  }, [isSolved, undoStack, hintIndices, elapsedSec, hintsUsed, mistakes, persistProgress]);

  const handleCheckBoard = useCallback(() => {
    if (isSolved) return;
    const errs = new Set<number>();
    let placedCount = 0;
    for (let i = 0; i < 26; i++) {
      const ch = boardLetters[i];
      if (!ch) continue;
      placedCount++;
      if (ch !== puzzle.blankCells[i].solutionLetter) {
        errs.add(i);
      }
    }
    setErrorBlankIndices(errs);
    if (placedCount === 0) {
      showToast('Place some letters on the board first.');
      return;
    }
    if (errs.size === 0) {
      soundFx.playWordValid();
      showToast(
        placedCount === 26
          ? 'Every letter matches!'
          : `All ${placedCount} placed letters look solid.`
      );
    } else {
      soundFx.playError();
      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes);
      persistProgress(
        boardLetters,
        hintIndices,
        elapsedSec,
        hintsUsed,
        nextMistakes,
        'in_progress'
      );
      showToast(`${errs.size} ${errs.size === 1 ? 'letter needs' : 'letters need'} attention.`);
    }
  }, [
    isSolved,
    boardLetters,
    puzzle.blankCells,
    mistakes,
    hintIndices,
    elapsedSec,
    hintsUsed,
    persistProgress,
    showToast,
  ]);

  const handleUseHint = useCallback(() => {
    if (isSolved) return;
    let targetIdx = -1;
    if (selectedCell) {
      const selBIdx = puzzle.blankIndexMap[`${selectedCell.r},${selectedCell.c}`];
      if (
        selBIdx !== undefined &&
        !hintIndices.includes(selBIdx) &&
        boardLetters[selBIdx] !== puzzle.blankCells[selBIdx].solutionLetter
      ) {
        targetIdx = selBIdx;
      }
    }
    if (targetIdx === -1) {
      targetIdx = puzzle.blankCells.findIndex(
        (b, idx) => !hintIndices.includes(idx) && boardLetters[idx] !== b.solutionLetter
      );
    }
    if (targetIdx === -1) return;

    const solutionLetter = puzzle.blankCells[targetIdx].solutionLetter;
    const nextLetters = [...boardLetters];

    const oldIdx = nextLetters.findIndex((ch) => ch === solutionLetter);
    if (oldIdx !== -1 && oldIdx !== targetIdx && !hintIndices.includes(oldIdx)) {
      nextLetters[oldIdx] = '';
    }
    nextLetters[targetIdx] = solutionLetter;

    const nextHints = [...hintIndices, targetIdx];
    const nextHintsUsed = hintsUsed + 1;

    setBoardLetters(nextLetters);
    setHintIndices(nextHints);
    setHintsUsed(nextHintsUsed);
    setErrorBlankIndices((prev) => {
      const n = new Set(prev);
      n.delete(targetIdx);
      return n;
    });
    const cell = puzzle.blankCells[targetIdx];
    setSelectedCell({ r: cell.r, c: cell.c });
    soundFx.playHint();

    persistProgress(nextLetters, nextHints, elapsedSec, nextHintsUsed, mistakes, 'in_progress');
    handleCompleteCheck(nextLetters, nextHints, nextHintsUsed, mistakes);
  }, [
    isSolved,
    selectedCell,
    puzzle,
    hintIndices,
    boardLetters,
    hintsUsed,
    elapsedSec,
    mistakes,
    persistProgress,
    handleCompleteCheck,
  ]);

  const handleToggleDirection = useCallback(() => {
    soundFx.playSelect();
    setDirection((d) => (d === 'across' ? 'down' : 'across'));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const anyModalOpen = showHowToPlay || showAuthModal || Boolean(victoryData);

    const onKeyDown = (e: KeyboardEvent) => {
      if (anyModalOpen) {
        if (e.key === 'Escape') {
          setShowHowToPlay(false);
          setShowAuthModal(false);
          setVictoryData(null);
        }
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (currentView === 'TITLE') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setCurrentView('PLAYING');
        }
        return;
      }

      if (currentView !== 'PLAYING') return;

      if (e.key === ' ') {
        e.preventDefault();
        handleToggleDirection();
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleClearCell();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      const normalizedKey = stripDiacritics(e.key).toUpperCase();
      if (/^[A-Z]$/.test(normalizedKey) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleLetterPress(normalizedKey);
        return;
      }

      if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight'
      ) {
        e.preventDefault();
        const startR = selectedCell?.r ?? 0;
        const startC = selectedCell?.c ?? 0;
        const dr = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        const dc = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;

        let r = startR + dr;
        let c = startC + dc;
        while (r >= 0 && r < 10 && c >= 0 && c < 10) {
          if (puzzle.layout[r][c] === '.') {
            setSelectedCell({ r, c });
            soundFx.playSelect();
            return;
          }
          r += dr;
          c += dc;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    currentView,
    showHowToPlay,
    showAuthModal,
    victoryData,
    handleToggleDirection,
    handleClearCell,
    handleUndo,
    handleLetterPress,
    selectedCell,
    puzzle.layout,
  ]);

  const handleSelectDate = useCallback((dateStr: string) => {
    hydratedKeyRef.current = null;
    setSelectedDateStr(dateStr);
    setNewDayNotice(null);
  }, []);

  const canClearSelected = useMemo(() => {
    if (!selectedCell || isSolved) return false;
    const bIdx = puzzle.blankIndexMap[`${selectedCell.r},${selectedCell.c}`];
    return bIdx !== undefined && !hintIndices.includes(bIdx) && Boolean(boardLetters[bIdx]);
  }, [selectedCell, isSolved, puzzle.blankIndexMap, hintIndices, boardLetters]);

  const placedCount = boardLetters.filter(Boolean).length;
  const isTodayPuzzle = selectedDateStr === todayLondonStr;
  const prevDateStr = shiftDateStr(selectedDateStr, -1);
  const nextDateStr = shiftDateStr(selectedDateStr, 1);
  const canStepPrev = isDateInArchive(prevDateStr, todayLondonStr);
  const canStepNext = isDateInArchive(nextDateStr, todayLondonStr);

  return (
    <div className="relative min-h-screen bg-[#faf7fc] dark:bg-[#15041c] text-[#2d0938] dark:text-purple-50 flex flex-col font-sans transition-colors overflow-x-hidden">
      {/* Tiled Missing Piece 3D Emblem Backdrop (20% opacity matching DeStack) */}
      <div
        aria-hidden="true"
        style={{
          backgroundImage: "url('/assets/aistudio/3d_logo_944e5372.png')",
          backgroundRepeat: 'repeat',
          backgroundSize: '88px 88px',
        }}
        className="fixed inset-0 opacity-20 pointer-events-none z-0"
      />

      <Header
        currentView={currentView}
        setCurrentView={(view) => {
          if (view === 'HOW_TO_PLAY') {
            setShowHowToPlay(true);
          } else {
            setCurrentView(view);
          }
        }}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        isMuted={!prefs.soundEnabled}
        setIsMuted={(muted) => setPrefs((p) => ({ ...p, soundEnabled: !muted }))}
        todayLondonStr={todayLondonStr}
        selectedDateStr={selectedDateStr}
        onSelectDate={handleSelectDate}
        progressMap={progressMap}
        stats={stats}
        effectiveStreak={effectiveStreak}
        currentUser={currentUser}
        onOpenSignIn={openSignInModal}
        onOpenUnifiedLeaderboard={openUnifiedLeaderboardModal}
      />

      <main className="relative z-10 flex-1 flex flex-col">
        {currentView === 'TITLE' && (
          <TitleMenu
            setCurrentView={setCurrentView}
            todayLondonStr={todayLondonStr}
            countdownMs={countdownMs}
            todayPuzzle={todayPuzzle}
            progressMap={progressMap}
            dictionaryLanguage={dictionaryLanguage}
            stats={stats}
            effectiveStreak={effectiveStreak}
            onSelectDate={handleSelectDate}
            currentUser={currentUser}
            onOpenSignIn={openSignInModal}
            onOpenUnifiedLeaderboard={openUnifiedLeaderboardModal}
          />
        )}

        {currentView === 'PLAYING' && (
          <div className="max-w-5xl mx-auto w-full px-4 py-5 sm:py-7 flex flex-col items-center">
            {/* London Midnight New Puzzle Alert */}
            {newDayNotice && (
              <div className="w-full max-w-4xl mb-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-amber-400/20 border border-amber-400/60 text-xs sm:text-sm text-[#3b0d47] dark:text-amber-200 font-bold">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>New daily puzzle unlocked for {formatDisplayDate(newDayNotice)}!</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleSelectDate(newDayNotice);
                    setCurrentView('PLAYING');
                  }}
                  className="px-3 py-1 rounded-xl bg-amber-400 text-[#2d0938] text-xs font-extrabold hover:bg-amber-300 transition-colors shrink-0 cursor-pointer"
                >
                  Load Today
                </button>
              </div>
            )}

            {/* Sub-header Utility Strip */}
            <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentView('TITLE')}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#581c6b] dark:text-amber-300 hover:underline cursor-pointer px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#240930]/80 border border-purple-200/70 dark:border-purple-800/60"
                >
                  <ArrowLeft className="w-4 h-4" /> Menu
                </button>

                {/* Archive Quick Date Navigation */}
                <div className="inline-flex items-center gap-1 rounded-xl bg-white/90 dark:bg-[#240930]/90 border border-purple-200/80 dark:border-purple-800/60 p-1 shadow-xs">
                  <button
                    type="button"
                    disabled={!canStepPrev}
                    onClick={() => canStepPrev && handleSelectDate(prevDateStr)}
                    title="Previous Archive Day"
                    className="p-1.5 rounded-lg text-[#4a1259] dark:text-amber-300 hover:bg-purple-50 dark:hover:bg-purple-900/50 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('ARCHIVE')}
                    className="px-2 py-1 text-xs sm:text-sm font-extrabold text-[#3b0d47] dark:text-white flex items-center gap-1.5 cursor-pointer hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
                    title="Open 6-Month Archive Calendar"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    <span>{formatDisplayDate(selectedDateStr)}</span>
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      · {isTodayPuzzle ? 'Today' : 'Archive'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={!canStepNext}
                    onClick={() => canStepNext && handleSelectDate(nextDateStr)}
                    title="Next Archive Day"
                    className="p-1.5 rounded-lg text-[#4a1259] dark:text-amber-300 hover:bg-purple-50 dark:hover:bg-purple-900/50 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Metrics: Placed / Timer / Reset / Help */}
              <div className="flex items-center gap-3 text-xs sm:text-sm font-bold text-[#4a1259] dark:text-purple-100">
                <span className="font-mono tabular-nums">{placedCount}/26 placed</span>
                <span aria-hidden="true" className="opacity-40">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-amber-700 dark:text-amber-300">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  {formatDuration(elapsedSec)}
                </span>
                {isTodayPuzzle && (
                  <>
                    <span aria-hidden="true" className="hidden sm:inline opacity-40">
                      ·
                    </span>
                    <span className="hidden sm:inline font-mono tabular-nums text-xs text-slate-500 dark:text-purple-300/75">
                      Next {formatCountdown(countdownMs)}
                    </span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowHowToPlay(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-[#240930] border border-purple-200 dark:border-purple-800 text-xs font-bold text-[#4a1259] dark:text-amber-300 hover:border-amber-400 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-500" /> Rules
                </button>
              </div>
            </div>

            {/* Toast Notification */}
            {toastMsg && (
              <div
                role="status"
                aria-live="polite"
                className="mb-4 px-4 py-2 rounded-xl bg-[#2d0938] text-amber-200 border border-amber-400/50 text-xs sm:text-sm font-bold shadow-lg animate-unolingo-fade-in"
              >
                {toastMsg}
              </div>
            )}

            {/* Solved Review Banner */}
            {isSolved && (
              <div className="w-full max-w-4xl mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/45 text-emerald-900 dark:text-emerald-200">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold">
                  <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    Solved in {formatDuration(elapsedSec)} ·{' '}
                    {calculateUnolingoScore(elapsedSec, hintsUsed, mistakes)} pts
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setVictoryData({
                        puzzleDate: selectedDateStr,
                        elapsedSec,
                        hintsUsed,
                        mistakes,
                        score:
                          progressMap[progressDateKey]?.score ??
                          calculateUnolingoScore(elapsedSec, hintsUsed, mistakes),
                        isDailyStreakAdvance: false,
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-amber-400 text-[#2d0938] text-xs font-extrabold hover:bg-amber-300 transition-colors cursor-pointer"
                  >
                    View Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('LEADERBOARD')}
                    className="px-3 py-1.5 rounded-xl bg-[#2d0938] text-amber-300 text-xs font-bold hover:bg-[#3b0d47] transition-colors cursor-pointer"
                  >
                    Leaderboard
                  </button>
                </div>
              </div>
            )}

            {/* Main Play Workspace: 10x10 Crossword Board + A-Z Rack */}
            <div className="w-full max-w-4xl flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 lg:gap-8">
              <div className="w-full flex-1 flex justify-center">
                <CrosswordBoard
                  puzzle={puzzle}
                  boardLetters={boardLetters}
                  hintIndices={hintIndices}
                  selectedCell={selectedCell}
                  activeSlot={activeSlot}
                  errorBlankIndices={errorBlankIndices}
                  isSolved={isSolved}
                  onSelectCell={handleSelectCell}
                  onDropLetterOnCell={placeLetterAtBlankIndex}
                />
              </div>

              <div className="w-full max-w-[490px] lg:max-w-[320px] shrink-0">
                <AlphabetRack
                  boardLetters={boardLetters}
                  hintIndices={hintIndices}
                  isSolved={isSolved}
                  canUndo={undoStack.length > 0}
                  canClearSelected={canClearSelected}
                  direction={direction}
                  autoCheck={prefs.autoCheck}
                  onLetterPress={handleLetterPress}
                  onUndo={handleUndo}
                  onClearCell={handleClearCell}
                  onToggleDirection={handleToggleDirection}
                  onCheckBoard={handleCheckBoard}
                  onUseHint={handleUseHint}
                  onToggleAutoCheck={() =>
                    setPrefs((p) => ({ ...p, autoCheck: !p.autoCheck }))
                  }
                />
              </div>
            </div>
          </div>
        )}

        {currentView === 'ARCHIVE' && (
          <ArchiveModal
            setCurrentView={setCurrentView}
            onSelectDate={handleSelectDate}
            progressMap={progressMap}
            dictionaryLanguage={dictionaryLanguage}
            todayLondonStr={todayLondonStr}
            selectedDateStr={selectedDateStr}
          />
        )}

        {currentView === 'LEADERBOARD' && (
          <LeaderboardModal
            setCurrentView={setCurrentView}
            progressMap={progressMap}
            currentUser={currentUser}
            onOpenSignIn={openSignInModal}
          />
        )}

        {currentView === 'STATS' && (
          <StatsModal
            setCurrentView={setCurrentView}
            stats={stats}
            effectiveStreak={effectiveStreak}
            progressMap={progressMap}
          />
        )}
      </main>

      {/* Modals */}
      {(currentView === 'HOW_TO_PLAY' || showHowToPlay) && (
        <HowToPlayModal
          onClose={() => {
            setShowHowToPlay(false);
            if (currentView === 'HOW_TO_PLAY') {
              setCurrentView('PLAYING');
            }
          }}
        />
      )}

      {victoryData && (
        <VictoryModal
          victoryData={victoryData}
          currentStreak={effectiveStreak}
          setCurrentView={(view) => {
            setVictoryData(null);
            setCurrentView(view);
          }}
          onClose={() => setVictoryData(null)}
          currentUser={currentUser}
          onOpenSignIn={() => {
            setVictoryData(null);
            openSignInModal();
          }}
          onOpenUnifiedLeaderboard={() => {
            setVictoryData(null);
            openUnifiedLeaderboardModal();
          }}
        />
      )}

      <UnifiedAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        user={currentUser}
        initialGameId="unolingo"
        initialTab={authModalTab}
      />
    </div>
  );
}
