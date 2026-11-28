import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  CrosswordPuzzle,
  Direction,
  GridScale,
  SCALE_CONFIG,
  PlacedWord,
  generateColossalCrossword,
} from './utils/crosswordGenerator';
import { sound } from './utils/sound';
import { TitleScreen } from './components/TitleScreen';
import { CrosswordBoard } from './components/CrosswordBoard';
import { MiniMap } from './components/MiniMap';
import { AtlasSidebar } from './components/AtlasSidebar';
import { SummaryModal } from './components/SummaryModal';
import {
  SecretCelebrationModal,
  SecretModalVariant,
} from './components/SecretCelebrationModal';
import {
  ArrowLeft,
  ArrowLeftRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  HelpCircle,
  LayoutGrid,
  LocateFixed,
  LogIn,
  Map as MapIcon,
  Menu,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Sparkles,
  Sun,
  Trophy,
  User as UserIcon,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  getCleanDisplayName,
  getCurrentUserSessionPrefix,
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
import { CLOUD_HYDRATED_EVENT, scheduleCloudProgressSync } from '@/lib/cloud-progress';
import { triggerVictoryConfetti } from '@/lib/confetti';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

interface SavedScaleState {
  userGrid: Record<string, string>;
  revealedCells: Record<string, boolean>;
  hintsUsed: number;
  elapsedSeconds: number;
  solvedTodayDate?: string;
  secretRevealed?: boolean;
  secretCompleted?: boolean;
}

const THEME_STORAGE_KEY = 'mpcolossal_dark_mode_v2';

function getScaleStorageKey(scale: GridScale): string {
  return `mpcolossal_save_v2_${getCurrentUserSessionPrefix()}_${scale}`;
}

function loadSavedScaleState(scale: GridScale): SavedScaleState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      window.localStorage.getItem(getScaleStorageKey(scale)) ||
      window.localStorage.getItem(`colossal_crossword_save_v1_${scale}`);
    if (!raw) return null;
    return JSON.parse(raw) as SavedScaleState;
  } catch {
    return null;
  }
}

interface DynamicClueTextProps {
  text: string;
  maxPx?: number;
  minPx?: number;
  centered?: boolean;
}

const DynamicClueText: React.FC<DynamicClueTextProps> = ({
  text,
  maxPx = 17,
  minPx = 9.5,
  centered = false,
}) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [fontSize, setFontSize] = useState<number>(maxPx);

  const fitText = useCallback(() => {
    const box = boxRef.current;
    const p = textRef.current;
    if (!box || !p) return;
    if (box.clientHeight <= 0 || box.clientWidth <= 0) return;

    let size = maxPx;
    p.style.fontSize = `${size}px`;
    while (size > minPx && (p.scrollHeight > box.clientHeight || p.scrollWidth > box.clientWidth)) {
      size -= 0.5;
      p.style.fontSize = `${size}px`;
    }
    setFontSize(size);
  }, [maxPx, minPx]);

  useLayoutEffect(() => {
    fitText();
  }, [text, centered, fitText]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(fitText);
    ro.observe(box);
    return () => ro.disconnect();
  }, [fitText]);

  return (
    <div
      ref={boxRef}
      className={`w-full h-full flex items-center ${centered ? 'justify-center' : ''} overflow-hidden`}
    >
      <p
        ref={textRef}
        style={{ fontSize: `${fontSize}px` }}
        className={`w-full font-semibold text-[#2B0938] dark:text-[#F5F3F7] leading-snug break-words ${
          centered ? 'text-center' : ''
        }`}
      >
        {text}
      </p>
    </div>
  );
};

export default function MPColossalApp() {
  const todayKey = useMemo(() => getLondonTodayDateStr(), []);
  const { user: currentUser } = useUnifiedAuth();

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [scale, setScale] = useState<GridScale>('colossal');
  const [mode, setMode] = useState<'classic' | 'quest'>('quest');

  // Dark Mode defaults to true across all Missing Piece games
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved !== null) return saved !== 'false';
    } catch {
      // Ignore storage error
    }
    return true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, String(darkMode));
    } catch {
      // Ignore storage error
    }
  }, [darkMode]);

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

  // Hidden 25x200 extension state (MP Colossal only — completely invisible until main grid is solved)
  const [secretRevealed, setSecretRevealed] = useState<boolean>(false);
  const [secretCompleted, setSecretCompleted] = useState<boolean>(false);
  const [secretModalVariant, setSecretModalVariant] = useState<SecretModalVariant | null>(null);
  const secretRevealTimerRef = useRef<number | null>(null);
  const secretRevealScheduledRef = useRef<boolean>(false);
  const secretFinaleTriggeredRef = useRef<boolean>(false);

  // Generate puzzle for current scale (only appends the 25x200 extension after main colossal is solved)
  const puzzle: CrosswordPuzzle = useMemo(
    () => generateColossalCrossword(scale, scale === 'colossal' && secretRevealed),
    [scale, secretRevealed]
  );

  // Player state
  const [userGrid, setUserGrid] = useState<Record<string, string>>({});
  const [revealedCells, setRevealedCells] = useState<Record<string, boolean>>({});
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [solvedTodayFlag, setSolvedTodayFlag] = useState<boolean>(false);

  // Active selection & camera
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number }>({
    row: 10,
    col: 10,
  });
  const [direction, setDirection] = useState<Direction>('across');
  const [cellSize, setCellSize] = useState<number>(48);
  const [showErrors, setShowErrors] = useState<boolean>(false);
  const [streamLayout, setStreamLayout] = useState<boolean>(false);
  const [streamGridWidthPx, setStreamGridWidthPx] = useState<number>(0);
  const [showStreamMenu, setShowStreamMenu] = useState<boolean>(false);
  const [showRadarPopup, setShowRadarPopup] = useState<boolean>(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<number | 'all'>('all');
  const [isMuted, setIsMuted] = useState<boolean>(() => sound.isMuted());

  const [panTarget, setPanTarget] = useState<{
    row: number;
    col: number;
    timestamp: number;
  } | null>(null);

  const [viewportRect, setViewportRect] = useState<{
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  }>({ startRow: 0, endRow: 20, startCol: 0, endCol: 25 });

  // Notification popup when a quest is completed (displays for 10 seconds)
  const [questCompletePopup, setQuestCompletePopup] = useState<{
    title: string;
    subtitle: string;
    completedCount: number;
    totalCount: number;
  } | null>(null);
  const questPopupTimerRef = useRef<number | null>(null);
  const prevCompletedQuestIdsRef = useRef<Set<number> | null>(null);
  const lastRecordedScoreRef = useRef<number>(0);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  // Load saved progress when scale or signed-in user changes
  const syncSavedProgress = useCallback(() => {
    const parsed = loadSavedScaleState(scale);
    if (parsed) {
      setUserGrid(parsed.userGrid || {});
      setRevealedCells(parsed.revealedCells || {});
      setHintsUsed(parsed.hintsUsed || 0);
      setElapsedSeconds(parsed.elapsedSeconds || 0);
      if (parsed.solvedTodayDate === todayKey) {
        setSolvedTodayFlag(true);
      }
      const isColossal = scale === 'colossal';
      const restoredSecretRevealed = isColossal && Boolean(parsed.secretRevealed);
      const restoredSecretCompleted = isColossal && Boolean(parsed.secretCompleted);
      setSecretRevealed(restoredSecretRevealed);
      setSecretCompleted(restoredSecretCompleted);
      secretRevealScheduledRef.current = restoredSecretRevealed;
      secretFinaleTriggeredRef.current = restoredSecretCompleted;
    } else {
      setUserGrid({});
      setRevealedCells({});
      setHintsUsed(0);
      setElapsedSeconds(0);
      setSecretRevealed(false);
      setSecretCompleted(false);
      secretRevealScheduledRef.current = false;
      secretFinaleTriggeredRef.current = false;
    }
  }, [scale, todayKey]);

  const prevScaleInitRef = useRef<GridScale | null>(null);
  useEffect(() => {
    if (prevScaleInitRef.current === scale) return;
    prevScaleInitRef.current = scale;

    if (secretRevealTimerRef.current !== null) {
      window.clearTimeout(secretRevealTimerRef.current);
      secretRevealTimerRef.current = null;
    }
    setSecretModalVariant(null);
    syncSavedProgress();

    const firstWord = puzzle.words[0];
    if (firstWord) {
      setSelectedCell({ row: firstWord.row, col: firstWord.col });
      setDirection(firstWord.direction);
      setPanTarget({ row: firstWord.row, col: firstWord.col, timestamp: Date.now() });
    }
    prevCompletedQuestIdsRef.current = null;
    setQuestCompletePopup(null);
  }, [scale, puzzle.words, syncSavedProgress]);

  useEffect(() => {
    window.addEventListener('unified-auth-updated', syncSavedProgress);
    window.addEventListener('mp-site-auth-updated', syncSavedProgress);
    window.addEventListener(CLOUD_HYDRATED_EVENT, syncSavedProgress);
    return () => {
      window.removeEventListener('unified-auth-updated', syncSavedProgress);
      window.removeEventListener('mp-site-auth-updated', syncSavedProgress);
      window.removeEventListener(CLOUD_HYDRATED_EVENT, syncSavedProgress);
    };
  }, [syncSavedProgress, currentUser?.uid]);

  // Save state to user-scoped localStorage and sync scales to Firestore cloud progress
  useEffect(() => {
    if (gameState === 'TITLE_MENU') return;
    try {
      const payload: SavedScaleState = {
        userGrid,
        revealedCells,
        hintsUsed,
        elapsedSeconds,
        solvedTodayDate: solvedTodayFlag ? todayKey : undefined,
        ...(scale === 'colossal' && secretRevealed ? { secretRevealed: true } : {}),
        ...(scale === 'colossal' && secretCompleted ? { secretCompleted: true } : {}),
      };
      window.localStorage.setItem(getScaleStorageKey(scale), JSON.stringify(payload));
      if (Object.keys(userGrid).length > 0 || solvedTodayFlag) {
        const scalesMap: Record<string, SavedScaleState> = {};
        for (const s of ['colossal', 'grand', 'district'] as const) {
          const st = s === scale ? payload : loadSavedScaleState(s);
          if (st && (Object.keys(st.userGrid || {}).length > 0 || st.solvedTodayDate)) {
            scalesMap[s] = st;
          }
        }
        if (Object.keys(scalesMap).length > 0) {
          scheduleCloudProgressSync('mpcolossal', { scales: scalesMap });
        }
      }
    } catch {
      // Ignore quota errors
    }
  }, [
    userGrid,
    revealedCells,
    hintsUsed,
    elapsedSeconds,
    solvedTodayFlag,
    secretRevealed,
    secretCompleted,
    todayKey,
    scale,
    gameState,
  ]);

  // Session timer when actively playing and modals are closed
  useEffect(() => {
    if (gameState !== 'PLAYING' || showAuthModal || secretModalVariant !== null) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [gameState, showAuthModal, secretModalVariant]);

  // Compute solved words set
  const solvedWordIds = useMemo(() => {
    const set = new Set<string>();
    for (const w of puzzle.words) {
      const dr = w.direction === 'down' ? 1 : 0;
      const dc = w.direction === 'across' ? 1 : 0;
      let allMatch = true;
      for (let i = 0; i < w.length; i++) {
        const key = `${w.row + dr * i},${w.col + dc * i}`;
        if (userGrid[key] !== w.word[i]) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        set.add(w.id);
      }
    }
    return set;
  }, [puzzle.words, userGrid]);

  // Lock every cell belonging to a completely solved word or revealed hint
  const lockedCells = useMemo(() => {
    const locked = new Set<string>();
    for (const key of Object.keys(revealedCells)) {
      if (revealedCells[key]) locked.add(key);
    }
    solvedWordIds.forEach((wordId) => {
      const w = puzzle.wordMap[wordId];
      if (!w) return;
      const dr = w.direction === 'down' ? 1 : 0;
      const dc = w.direction === 'across' ? 1 : 0;
      for (let i = 0; i < w.length; i++) {
        locked.add(`${w.row + dr * i},${w.col + dc * i}`);
      }
    });
    return locked;
  }, [puzzle.wordMap, revealedCells, solvedWordIds]);

  const completedQuestList = useMemo(
    () =>
      puzzle.quests.filter(
        (q) => q.wordIds.length > 0 && q.wordIds.every((id) => solvedWordIds.has(id))
      ),
    [puzzle.quests, solvedWordIds]
  );

  const completedQuestsCount = completedQuestList.length;

  // Atlas Score formula
  const atlasScore = useMemo(() => {
    if (solvedWordIds.size === 0) return 0;
    const multiplier = scale === 'colossal' ? 1.35 : scale === 'grand' ? 1.15 : 1;
    const raw =
      (solvedWordIds.size * 100 + completedQuestsCount * 500 - hintsUsed * 40) * multiplier;
    return Math.min(1000000, Math.max(solvedWordIds.size * 25, Math.round(raw)));
  }, [solvedWordIds.size, completedQuestsCount, hintsUsed, scale]);

  const dailyStreak = useDailyStreak('mpcolossal', todayKey, solvedTodayFlag, 1);

  const syncLeaderboardProgress = useCallback(
    (force = false) => {
      if (atlasScore <= 0) return;
      if (!force && atlasScore <= lastRecordedScoreRef.current) return;
      lastRecordedScoreRef.current = Math.max(lastRecordedScoreRef.current, atlasScore);
      const mins = Math.floor(elapsedSeconds / 60);
      const secs = elapsedSeconds % 60;
      const timeFmt = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      saveUnifiedLeaderboardScore({
        user: currentUser,
        gameId: 'mpcolossal',
        puzzleId: `mpcolossal_${scale}`,
        puzzleTitle: `MP Colossal · ${SCALE_CONFIG[scale].size}×${SCALE_CONFIG[scale].size}`,
        score: atlasScore,
        metricLabel: `${atlasScore.toLocaleString()} pts (${solvedWordIds.size} words)`,
        subMetricLabel: `${SCALE_CONFIG[scale].size}×${SCALE_CONFIG[scale].size} · ${completedQuestsCount} quests · ${timeFmt}`,
      }).catch(() => {});
    },
    [atlasScore, completedQuestsCount, currentUser, elapsedSeconds, scale, solvedWordIds.size]
  );

  // Record Daily Streak & confetti & leaderboard when quests or milestones hit
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    if (solvedWordIds.size >= 5 && !solvedTodayFlag) {
      setSolvedTodayFlag(true);
      recordDailyPuzzleSolved('mpcolossal', todayKey, 1);
    }

    const currentCompletedIds = new Set(completedQuestList.map((q) => q.id));

    if (prevCompletedQuestIdsRef.current === null) {
      prevCompletedQuestIdsRef.current = currentCompletedIds;
      return;
    }

    const newlyCompleted = completedQuestList.filter(
      (q) => !prevCompletedQuestIdsRef.current?.has(q.id)
    );
    prevCompletedQuestIdsRef.current = currentCompletedIds;

    if (newlyCompleted.length > 0) {
      const latestQuest = newlyCompleted[newlyCompleted.length - 1];
      sound.playQuestComplete();
      triggerVictoryConfetti();
      setSolvedTodayFlag(true);
      recordDailyPuzzleSolved('mpcolossal', todayKey, 1);
      syncLeaderboardProgress(true);

      setQuestCompletePopup({
        title: latestQuest.title,
        subtitle: latestQuest.subtitle,
        completedCount: currentCompletedIds.size,
        totalCount: puzzle.quests.length,
      });

      if (questPopupTimerRef.current !== null) {
        window.clearTimeout(questPopupTimerRef.current);
      }
      questPopupTimerRef.current = window.setTimeout(() => {
        setQuestCompletePopup(null);
        questPopupTimerRef.current = null;
      }, 10000);
      return;
    }

    if (solvedWordIds.size > 0 && solvedWordIds.size % 10 === 0) {
      syncLeaderboardProgress(false);
    }
  }, [
    solvedWordIds.size,
    completedQuestList,
    puzzle.quests.length,
    gameState,
    solvedTodayFlag,
    todayKey,
    syncLeaderboardProgress,
  ]);

  useEffect(() => {
    return () => {
      if (questPopupTimerRef.current !== null) {
        window.clearTimeout(questPopupTimerRef.current);
      }
      if (secretRevealTimerRef.current !== null) {
        window.clearTimeout(secretRevealTimerRef.current);
      }
    };
  }, []);

  // Trigger Victory / Hidden 25x200 Reveal / Grand Finale when all words solved
  useEffect(() => {
    if (
      gameState !== 'PLAYING' ||
      puzzle.words.length === 0 ||
      solvedWordIds.size !== puzzle.words.length
    ) {
      return;
    }

    if (scale === 'colossal') {
      if (!secretRevealed) {
        // Silent 10-second pause after final main-grid clue, then explosive cartoon reveal of 25x200 vault
        if (!secretRevealScheduledRef.current) {
          secretRevealScheduledRef.current = true;
          setSolvedTodayFlag(true);
          recordDailyPuzzleSolved('mpcolossal', todayKey, 1);
          syncLeaderboardProgress(true);

          secretRevealTimerRef.current = window.setTimeout(() => {
            secretRevealTimerRef.current = null;
            setGameState('PLAYING');
            setQuestCompletePopup(null);
            setSecretRevealed(true);
            setSecretModalVariant('reveal');
            sound.playSecretExplosion();
            triggerVictoryConfetti();
            window.setTimeout(() => triggerVictoryConfetti(), 550);
          }, 10000);
        }
        return;
      }

      // Extended 225x200 puzzle completed: explosive visual flair + fanfare + grand finale popup
      if (!secretFinaleTriggeredRef.current) {
        secretFinaleTriggeredRef.current = true;
        setSecretCompleted(true);
        setSolvedTodayFlag(true);
        recordDailyPuzzleSolved('mpcolossal', todayKey, 1);
        syncLeaderboardProgress(true);
        sound.playGrandFanfare();
        triggerVictoryConfetti();
        window.setTimeout(() => triggerVictoryConfetti(), 650);
        window.setTimeout(() => triggerVictoryConfetti(), 1350);
        setSecretModalVariant('finale');
      }
      return;
    }

    sound.playQuestComplete();
    triggerVictoryConfetti();
    setSolvedTodayFlag(true);
    recordDailyPuzzleSolved('mpcolossal', todayKey, 1);
    syncLeaderboardProgress(true);
    setGameState('GAME_OVER');
  }, [
    solvedWordIds.size,
    puzzle.words.length,
    gameState,
    scale,
    secretRevealed,
    todayKey,
    syncLeaderboardProgress,
  ]);

  // Determine active word from selectedCell and direction
  const activeWord: PlacedWord | null = useMemo(() => {
    const cell = puzzle.cells[selectedCell.row]?.[selectedCell.col];
    if (!cell || !cell.solution) return null;

    if (direction === 'across' && cell.acrossWordId) {
      return puzzle.wordMap[cell.acrossWordId] || null;
    }
    if (direction === 'down' && cell.downWordId) {
      return puzzle.wordMap[cell.downWordId] || null;
    }
    const fallbackId = cell.acrossWordId || cell.downWordId;
    return fallbackId ? puzzle.wordMap[fallbackId] || null : null;
  }, [puzzle, selectedCell, direction]);

  // Keep direction synced if cell only has one valid direction
  useEffect(() => {
    const cell = puzzle.cells[selectedCell.row]?.[selectedCell.col];
    if (!cell || !cell.solution) return;
    if (direction === 'across' && !cell.acrossWordId && cell.downWordId) {
      setDirection('down');
    } else if (direction === 'down' && !cell.downWordId && cell.acrossWordId) {
      setDirection('across');
    }
  }, [puzzle.cells, selectedCell, direction]);

  const handleSelectCell = useCallback(
    (row: number, col: number, toggleDirectionIfSame = false) => {
      const cell = puzzle.cells[row]?.[col];
      if (!cell || !cell.solution) return;

      // Focus hidden input on touch devices to summon mobile keyboard smoothly
      if (
        typeof window !== 'undefined' &&
        window.matchMedia?.('(pointer: coarse)').matches &&
        mobileInputRef.current
      ) {
        mobileInputRef.current.focus({ preventScroll: true });
      }

      if (
        toggleDirectionIfSame &&
        row === selectedCell.row &&
        col === selectedCell.col
      ) {
        if (direction === 'across' && cell.downWordId) {
          setDirection('down');
          sound.playStep();
          return;
        }
        if (direction === 'down' && cell.acrossWordId) {
          setDirection('across');
          sound.playStep();
          return;
        }
      }

      setSelectedCell({ row, col });
      if (direction === 'across' && !cell.acrossWordId && cell.downWordId) {
        setDirection('down');
      } else if (direction === 'down' && !cell.downWordId && cell.acrossWordId) {
        setDirection('across');
      }
      sound.playStep();
    },
    [puzzle.cells, selectedCell, direction]
  );

  const handleSelectWord = useCallback(
    (word: PlacedWord) => {
      setDirection(word.direction);
      const dr = word.direction === 'down' ? 1 : 0;
      const dc = word.direction === 'across' ? 1 : 0;
      let targetRow = word.row;
      let targetCol = word.col;

      // Auto-skip filled and locked boxes when selecting a word
      let foundEmpty = false;
      for (let i = 0; i < word.length; i++) {
        const r = word.row + dr * i;
        const c = word.col + dc * i;
        const k = `${r},${c}`;
        if (!userGrid[k] && !lockedCells.has(k)) {
          targetRow = r;
          targetCol = c;
          foundEmpty = true;
          break;
        }
      }
      if (!foundEmpty) {
        for (let i = 0; i < word.length; i++) {
          const r = word.row + dr * i;
          const c = word.col + dc * i;
          if (!lockedCells.has(`${r},${c}`)) {
            targetRow = r;
            targetCol = c;
            break;
          }
        }
      }

      setSelectedCell({ row: targetRow, col: targetCol });
      setPanTarget({
        row: word.row + (word.direction === 'down' ? Math.floor(word.length / 2) : 0),
        col: word.col + (word.direction === 'across' ? Math.floor(word.length / 2) : 0),
        timestamp: Date.now(),
      });
      sound.playStep();
    },
    [userGrid, lockedCells]
  );

  const handleCenterCell = useCallback(
    (row: number, col: number) => {
      const clampedRow = Math.max(0, Math.min((puzzle.rows || puzzle.size) - 1, row));
      const clampedCol = Math.max(0, Math.min((puzzle.cols || puzzle.size) - 1, col));
      setPanTarget({ row: clampedRow, col: clampedCol, timestamp: Date.now() });

      for (let rad = 0; rad <= 6; rad++) {
        for (let dr = -rad; dr <= rad; dr++) {
          for (let dc = -rad; dc <= rad; dc++) {
            const nr = clampedRow + dr;
            const nc = clampedCol + dc;
            const cData = puzzle.cells[nr]?.[nc];
            if (cData && cData.solution) {
              setSelectedCell({ row: nr, col: nc });
              return;
            }
          }
        }
      }
    },
    [puzzle]
  );

  const advanceCursorInWord = useCallback(
    (
      step: 1 | -1,
      updatedGrid?: Record<string, string>,
      fromCell?: { row: number; col: number },
      extraLocked?: Set<string>
    ) => {
      if (!activeWord) return;
      const gridToUse = updatedGrid || userGrid;
      const origin = fromCell || selectedCell;
      const isLocked = (k: string) => lockedCells.has(k) || Boolean(extraLocked?.has(k));
      const dr = activeWord.direction === 'down' ? 1 : 0;
      const dc = activeWord.direction === 'across' ? 1 : 0;

      const currentOffset =
        activeWord.direction === 'down'
          ? origin.row - activeWord.row
          : origin.col - activeWord.col;

      if (step === 1) {
        // 1. Scan forward for next empty, unlocked box
        for (let i = currentOffset + 1; i < activeWord.length; i++) {
          const r = activeWord.row + dr * i;
          const c = activeWord.col + dc * i;
          const k = `${r},${c}`;
          if (!gridToUse[k] && !isLocked(k)) {
            setSelectedCell({ row: r, col: c });
            return;
          }
        }
        // 2. Wrap around from start of word for any earlier empty, unlocked box
        for (let i = 0; i < currentOffset; i++) {
          const r = activeWord.row + dr * i;
          const c = activeWord.col + dc * i;
          const k = `${r},${c}`;
          if (!gridToUse[k] && !isLocked(k)) {
            setSelectedCell({ row: r, col: c });
            return;
          }
        }
        // 3. Fallback: next unlocked cell forward if all cells are filled
        for (let i = currentOffset + 1; i < activeWord.length; i++) {
          const r = activeWord.row + dr * i;
          const c = activeWord.col + dc * i;
          if (!isLocked(`${r},${c}`)) {
            setSelectedCell({ row: r, col: c });
            return;
          }
        }
      } else {
        // Step backward skipping locked boxes
        for (let i = currentOffset - 1; i >= 0; i--) {
          const r = activeWord.row + dr * i;
          const c = activeWord.col + dc * i;
          if (!isLocked(`${r},${c}`)) {
            setSelectedCell({ row: r, col: c });
            return;
          }
        }
      }
    },
    [activeWord, selectedCell, userGrid, lockedCells]
  );

  const handleLetterInput = useCallback(
    (letter: string) => {
      const char = letter.toUpperCase();
      let targetRow = selectedCell.row;
      let targetCol = selectedCell.col;
      let cell = puzzle.cells[targetRow]?.[targetCol];
      if (!cell || !cell.solution) return;

      let key = `${targetRow},${targetCol}`;

      // If current square is locked in (solved word or hint), auto-skip to next empty/unlocked square in active word
      if (lockedCells.has(key)) {
        if (!activeWord) return;
        const dr = activeWord.direction === 'down' ? 1 : 0;
        const dc = activeWord.direction === 'across' ? 1 : 0;
        const currentOffset =
          activeWord.direction === 'down'
            ? targetRow - activeWord.row
            : targetCol - activeWord.col;

        let found: { row: number; col: number } | null = null;
        for (let i = currentOffset + 1; i < activeWord.length; i++) {
          const r = activeWord.row + dr * i;
          const c = activeWord.col + dc * i;
          const k = `${r},${c}`;
          if (!userGrid[k] && !lockedCells.has(k)) {
            found = { row: r, col: c };
            break;
          }
        }
        if (!found) {
          for (let i = 0; i < currentOffset; i++) {
            const r = activeWord.row + dr * i;
            const c = activeWord.col + dc * i;
            const k = `${r},${c}`;
            if (!userGrid[k] && !lockedCells.has(k)) {
              found = { row: r, col: c };
              break;
            }
          }
        }
        if (!found) return;
        targetRow = found.row;
        targetCol = found.col;
        key = `${targetRow},${targetCol}`;
        cell = puzzle.cells[targetRow]?.[targetCol];
        if (!cell || !cell.solution) return;
        setSelectedCell({ row: targetRow, col: targetCol });
      }

      const nextGrid = { ...userGrid, [key]: char };
      setUserGrid(nextGrid);

      // Check if either across or down word touching this cell just became completely solved
      const newlyLocked = new Set<string>();
      let justSolvedAny = false;
      const candidateWordIds = [cell.acrossWordId, cell.downWordId].filter(
        (id): id is string => Boolean(id)
      );
      for (const wId of candidateWordIds) {
        const w = puzzle.wordMap[wId];
        if (!w) continue;
        const dr = w.direction === 'down' ? 1 : 0;
        const dc = w.direction === 'across' ? 1 : 0;
        let allMatch = true;
        for (let i = 0; i < w.length; i++) {
          const k = `${w.row + dr * i},${w.col + dc * i}`;
          if (nextGrid[k] !== w.word[i]) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) {
          if (!solvedWordIds.has(w.id)) justSolvedAny = true;
          for (let i = 0; i < w.length; i++) {
            newlyLocked.add(`${w.row + dr * i},${w.col + dc * i}`);
          }
        }
      }

      if (justSolvedAny) {
        sound.playWordSolved();
      } else {
        sound.playKeyPress(char.charCodeAt(0) - 65);
      }

      advanceCursorInWord(1, nextGrid, { row: targetRow, col: targetCol }, newlyLocked);
    },
    [puzzle.cells, puzzle.wordMap, selectedCell, userGrid, activeWord, solvedWordIds, lockedCells, advanceCursorInWord]
  );

  const handleBackspace = useCallback(() => {
    const key = `${selectedCell.row},${selectedCell.col}`;
    if (lockedCells.has(key)) {
      advanceCursorInWord(-1);
      return;
    }

    if (userGrid[key]) {
      const next = { ...userGrid };
      delete next[key];
      setUserGrid(next);
      sound.playBackspace();
    } else if (activeWord) {
      const dr = activeWord.direction === 'down' ? 1 : 0;
      const dc = activeWord.direction === 'across' ? 1 : 0;
      const currentOffset =
        activeWord.direction === 'down'
          ? selectedCell.row - activeWord.row
          : selectedCell.col - activeWord.col;

      // Skip backwards past any locked cells to reach the nearest unlocked cell
      for (let i = currentOffset - 1; i >= 0; i--) {
        const prevR = activeWord.row + dr * i;
        const prevC = activeWord.col + dc * i;
        const prevKey = `${prevR},${prevC}`;
        if (lockedCells.has(prevKey)) continue;
        setSelectedCell({ row: prevR, col: prevC });
        if (userGrid[prevKey]) {
          const next = { ...userGrid };
          delete next[prevKey];
          setUserGrid(next);
        }
        sound.playBackspace();
        break;
      }
    }
  }, [selectedCell, userGrid, lockedCells, activeWord, advanceCursorInWord]);

  const stepToAdjacentWord = useCallback(
    (delta: 1 | -1) => {
      if (puzzle.words.length === 0) return;
      const currentIdx = activeWord
        ? puzzle.words.findIndex((w) => w.id === activeWord.id)
        : 0;
      const nextIdx = (currentIdx + delta + puzzle.words.length) % puzzle.words.length;
      handleSelectWord(puzzle.words[nextIdx]);
    },
    [puzzle.words, activeWord, handleSelectWord]
  );

  // Global keyboard shortcuts during PLAYING state
  useEffect(() => {
    if (gameState !== 'PLAYING' || showAuthModal || secretModalVariant !== null) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const targetEl = e.target as HTMLElement | null;
      const isMobileHelper = targetEl === mobileInputRef.current;
      const tag = targetEl?.tagName;
      if (!isMobileHelper && (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (showStreamMenu) {
          setShowStreamMenu(false);
          return;
        }
        syncLeaderboardProgress(false);
        setGameState('PAUSED');
        return;
      }

      if (showStreamMenu) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        stepToAdjacentWord(e.shiftKey ? -1 : 1);
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        const cell = puzzle.cells[selectedCell.row]?.[selectedCell.col];
        if (direction === 'across' && cell?.downWordId) {
          setDirection('down');
          sound.playStep();
        } else if (direction === 'down' && cell?.acrossWordId) {
          setDirection('across');
          sound.playStep();
        }
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleBackspace();
        return;
      }

      if (
        e.key === 'ArrowRight' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowUp'
      ) {
        e.preventDefault();
        const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
        const dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;

        for (let dist = 1; dist < 15; dist++) {
          const nr = selectedCell.row + dr * dist;
          const nc = selectedCell.col + dc * dist;
          const target = puzzle.cells[nr]?.[nc];
          if (target && target.solution) {
            setSelectedCell({ row: nr, col: nc });
            sound.playStep();
            break;
          }
        }
        return;
      }

      if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleLetterInput(e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    showAuthModal,
    secretModalVariant,
    showStreamMenu,
    selectedCell,
    direction,
    puzzle.cells,
    handleLetterInput,
    handleBackspace,
    stepToAdjacentWord,
    syncLeaderboardProgress,
  ]);

  // 3-Tier Assistive Hint Handlers
  const handleHintStartOrEnd = () => {
    if (!activeWord) return;
    const dr = activeWord.direction === 'down' ? 1 : 0;
    const dc = activeWord.direction === 'across' ? 1 : 0;

    const indices = [0, activeWord.length - 1];
    for (let i = 1; i < activeWord.length - 1; i++) indices.push(i);

    for (const idx of indices) {
      const r: number = activeWord.row + dr * idx;
      const c: number = activeWord.col + dc * idx;
      const key = `${r},${c}`;
      if (userGrid[key] !== activeWord.word[idx]) {
        setUserGrid((prev) => ({ ...prev, [key]: activeWord.word[idx] }));
        setRevealedCells((prev) => ({ ...prev, [key]: true }));
        setHintsUsed((h) => h + 1);
        setSelectedCell({ row: r, col: c });
        sound.playHint();
        return;
      }
    }
  };

  const handleHintRevealCell = () => {
    const cell = puzzle.cells[selectedCell.row]?.[selectedCell.col];
    if (!cell || !cell.solution) return;
    const key = `${cell.row},${cell.col}`;
    setUserGrid((prev) => ({ ...prev, [key]: cell.solution }));
    setRevealedCells((prev) => ({ ...prev, [key]: true }));
    setHintsUsed((h) => h + 1);
    sound.playHint();
    advanceCursorInWord(1);
  };

  const handleHintRevealWord = () => {
    if (!activeWord) return;
    const dr = activeWord.direction === 'down' ? 1 : 0;
    const dc = activeWord.direction === 'across' ? 1 : 0;
    const nextGrid = { ...userGrid };
    const nextRevealed = { ...revealedCells };

    for (let i = 0; i < activeWord.length; i++) {
      const r = activeWord.row + dr * i;
      const c = activeWord.col + dc * i;
      const key = `${r},${c}`;
      nextGrid[key] = activeWord.word[i];
      nextRevealed[key] = true;
    }

    setUserGrid(nextGrid);
    setRevealedCells(nextRevealed);
    setHintsUsed((h) => h + 1);
    sound.playWordSolved();
  };

  const handleCompleteQuestWords = (sectorId: number) => {
    const quest = puzzle.quests.find((q) => q.sectorId === sectorId);
    if (!quest) return;
    const nextGrid = { ...userGrid };
    const nextRevealed = { ...revealedCells };

    for (const wId of quest.wordIds) {
      const w = puzzle.wordMap[wId];
      if (!w) continue;
      const dr = w.direction === 'down' ? 1 : 0;
      const dc = w.direction === 'across' ? 1 : 0;
      for (let i = 0; i < w.length; i++) {
        const key = `${w.row + dr * i},${w.col + dc * i}`;
        nextGrid[key] = w.word[i];
        nextRevealed[key] = true;
      }
    }
    setUserGrid(nextGrid);
    setRevealedCells(nextRevealed);
    setHintsUsed((h) => h + 1);
    sound.playQuestComplete();
  };

  const handleAutoSolveEntireBoard = () => {
    const nextGrid: Record<string, string> = {};
    const maxR = puzzle.rows || puzzle.size;
    const maxC = puzzle.cols || puzzle.size;
    for (let r = 0; r < maxR; r++) {
      const rowArr = puzzle.cells[r];
      if (!rowArr) continue;
      for (let c = 0; c < maxC; c++) {
        const sol = rowArr[c]?.solution;
        if (sol) {
          nextGrid[`${r},${c}`] = sol;
        }
      }
    }
    setUserGrid(nextGrid);
    if (scale === 'colossal') {
      // Return to active board so the 10-second secret reveal or grand finale flow triggers authentically
      setGameState('PLAYING');
      return;
    }
    sound.playQuestComplete();
    triggerVictoryConfetti();
    setGameState('GAME_OVER');
  };

  const handleRestartPuzzle = () => {
    if (secretRevealTimerRef.current !== null) {
      window.clearTimeout(secretRevealTimerRef.current);
      secretRevealTimerRef.current = null;
    }
    secretRevealScheduledRef.current = false;
    secretFinaleTriggeredRef.current = false;
    setSecretRevealed(false);
    setSecretCompleted(false);
    setSecretModalVariant(null);
    setUserGrid({});
    setRevealedCells({});
    setHintsUsed(0);
    setElapsedSeconds(0);
    try {
      window.localStorage.removeItem(getScaleStorageKey(scale));
      window.localStorage.removeItem(`colossal_crossword_save_v1_${scale}`);
    } catch {
      // Ignore storage error
    }
    setGameState('PLAYING');
    prevCompletedQuestIdsRef.current = new Set();
    setQuestCompletePopup(null);
  };

  const currentSector = useMemo(() => {
    const cell = puzzle.cells[selectedCell.row]?.[selectedCell.col];
    const sId = cell ? cell.sectorId : 0;
    return puzzle.sectors[sId % puzzle.sectors.length];
  }, [puzzle, selectedCell]);

  const handleChangeStreamLayout = useCallback(
    (enabled: boolean) => {
      setStreamLayout(enabled);
      setShowStreamMenu(false);
      if (enabled) {
        setIsDesktopSidebarOpen(false);
        setIsMobileSidebarOpen(false);
        setShowRadarPopup(true);
      }
      setPanTarget({
        row: selectedCell.row,
        col: selectedCell.col,
        timestamp: Date.now(),
      });
    },
    [selectedCell.row, selectedCell.col]
  );

  const toggleActiveDirection = () => {
    const cell = puzzle.cells[selectedCell.row]?.[selectedCell.col];
    if (direction === 'across' && cell?.downWordId) {
      setDirection('down');
      sound.playStep();
    } else if (direction === 'down' && cell?.acrossWordId) {
      setDirection('across');
      sound.playStep();
    }
  };

  if (gameState === 'TITLE_MENU') {
    const hasProgress = Object.keys(userGrid).length > 0;
    return (
      <>
        <TitleScreen
          selectedScale={scale}
          onSelectScale={(newScale) => setScale(newScale)}
          initialMode={mode}
          onSelectMode={(m) => setMode(m)}
          streamLayout={streamLayout}
          onSelectStreamLayout={handleChangeStreamLayout}
          hasSavedProgress={hasProgress}
          savedStats={{
            solvedWords: solvedWordIds.size,
            totalWords: puzzle.words.length,
          }}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(sound.toggleMute())}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          currentUser={currentUser}
          streak={dailyStreak.streak}
          solvedToday={dailyStreak.solvedToday}
          onOpenSignIn={openSignInModal}
          onOpenLeaderboard={openLeaderboardModal}
          onStartGame={() => setGameState('PLAYING')}
        />
        <UnifiedAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          user={currentUser}
          initialGameId="mpcolossal"
          initialTab={authModalTab}
        />
      </>
    );
  }

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden flex flex-col bg-[#FBF8F1] dark:bg-[#11031A] text-[#2B0938] dark:text-[#F5F3F7] select-none transition-colors">
      {/* 25% Opacity Missing Piece Background Watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 flex items-center justify-center z-0 overflow-hidden"
      >
        <img
          src="/assets/aistudio/3d_logo_944e5372.png"
          alt=""
          className="w-[340px] h-[340px] sm:w-[640px] sm:h-[640px] object-contain opacity-25 select-none"
        />
      </div>
      {/* Hidden touch-friendly input so mobile OS soft keyboards can type into the grid */}
      <input
        ref={mobileInputRef}
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-hidden="true"
        tabIndex={-1}
        value=""
        onChange={(e) => {
          const val = e.target.value.replace(/[^a-zA-Z]/g, '');
          if (val) {
            handleLetterInput(val.slice(-1).toUpperCase());
          }
          e.target.value = '';
        }}
        className="sr-only fixed -top-96 left-0 opacity-0 pointer-events-none"
      />

      {/* Top Missing Piece HUD Bar (hidden completely in Stream View; options live behind bottom Menu button) */}
      {!streamLayout && (
        <header className="min-h-12 sm:min-h-14 py-1.5 px-2 sm:px-4 gap-1.5 sm:gap-3 bg-white/95 dark:bg-[#1a0624]/95 border-b border-purple-200 dark:border-purple-900/60 flex flex-wrap items-center justify-between shrink-0 z-30 backdrop-blur-md">
          {/* Left: Solo Games Back + 3D Logo + Title */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <Link
              to="/solo-games"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold text-[#4a1259] dark:text-amber-300 bg-purple-100/80 dark:bg-purple-900/50 hover:bg-purple-200/80 dark:hover:bg-purple-800/60 border border-purple-200/80 dark:border-purple-700/60 transition-colors whitespace-nowrap shrink-0"
              title="Back to Solo Games"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Solo Games</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                syncLeaderboardProgress(false);
                setGameState('TITLE_MENU');
              }}
              className="flex items-center gap-1.5 sm:gap-2 text-left group shrink-0 cursor-pointer"
            >
              <img
                src="/assets/aistudio/3d_logo_944e5372.png"
                alt="MP Colossal"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-contain drop-shadow"
              />
              <span className="text-sm sm:text-base font-extrabold tracking-tight text-[#3b0d47] dark:text-white group-hover:text-amber-500 dark:group-hover:text-[#F6C915] transition-colors whitespace-nowrap">
                MP <span className="text-amber-500 dark:text-[#F6C915]">Colossal</span>
              </span>
            </button>

            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-purple-300/80 font-mono-tabular truncate">
              <span aria-hidden="true">·</span>
              <span className="text-amber-600 dark:text-[#F6C915] font-bold">
                {puzzle.rows}×{puzzle.cols}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate text-[#4a1259] dark:text-purple-200 font-medium">
                {currentSector?.name}
              </span>
            </div>
          </div>

          {/* Center Telemetry */}
          <div className="hidden xl:flex items-center gap-3 text-xs font-mono-tabular text-slate-600 dark:text-purple-200/85 bg-purple-50/80 dark:bg-[#240938] px-3 py-1.5 rounded-xl border border-purple-200/70 dark:border-purple-800/60">
            <span>
              Words:{' '}
              <strong className="text-[#3b0d47] dark:text-white">
                {solvedWordIds.size.toLocaleString()}
              </strong>
              /{puzzle.words.length.toLocaleString()}
            </span>
            <span aria-hidden="true" className="opacity-40">·</span>
            <span>
              Quests:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {completedQuestsCount}
              </strong>
              /{puzzle.quests.length}
            </span>
            <span aria-hidden="true" className="opacity-40">·</span>
            <span>
              Score:{' '}
              <strong className="text-amber-600 dark:text-[#F6C915]">
                {atlasScore.toLocaleString()}
              </strong>
            </span>
          </div>

          {/* Right Utility Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="hidden sm:flex items-center bg-purple-50 dark:bg-[#11031A] border border-purple-200 dark:border-purple-800/70 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setCellSize((s) => Math.max(32, s - 6))}
                title="Zoom Out Grid"
                className="p-1 text-[#4a1259] dark:text-purple-200 hover:text-[#2B0938] dark:hover:text-white rounded transition-colors cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCellSize((s) => (s >= 60 ? 48 : 64))}
                title="Toggle Jumbo 64px Type"
                className="px-1.5 py-0.5 text-[11px] font-mono-tabular font-bold text-amber-600 dark:text-[#F6C915] transition-colors cursor-pointer whitespace-nowrap"
              >
                {cellSize}px
              </button>
              <button
                type="button"
                onClick={() => setCellSize((s) => Math.min(72, s + 6))}
                title="Zoom In Grid"
                className="p-1 text-[#4a1259] dark:text-purple-200 hover:text-[#2B0938] dark:hover:text-white rounded transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                setPanTarget({
                  row: selectedCell.row,
                  col: selectedCell.col,
                  timestamp: Date.now(),
                })
              }
              title="Center Active Cell"
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-[#4a1259] dark:text-purple-100 bg-purple-50 dark:bg-[#240938] border border-purple-200 dark:border-purple-800/70 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <LocateFixed className="w-3.5 h-3.5 text-amber-500 dark:text-[#F6C915]" />
              <span className="hidden md:inline">Center</span>
            </button>

            <button
              type="button"
              onClick={() => setShowErrors((prev) => !prev)}
              title="Highlight Incorrect Letters"
              className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                showErrors
                  ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-700 dark:text-emerald-300'
                  : 'bg-purple-50 dark:bg-[#240938] border-purple-200 dark:border-purple-800/70 text-[#4a1259] dark:text-purple-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Check</span>
            </button>

            {/* Clues Drawer Toggle */}
            <button
              type="button"
              onClick={() => setIsDesktopSidebarOpen((prev) => !prev)}
              title={isDesktopSidebarOpen ? 'Hide Side Clue Bar' : 'Show Side Clue Bar'}
              className={`hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                isDesktopSidebarOpen
                  ? 'bg-[#F6C915] text-[#1D0830] border-[#D4A437]'
                  : 'bg-purple-50 dark:bg-[#240938] text-[#4a1259] dark:text-purple-100 border-purple-200 dark:border-purple-800/70'
              }`}
            >
              {isDesktopSidebarOpen ? (
                <PanelRightClose className="w-3.5 h-3.5" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" />
              )}
              <span>Clues</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
              title="Open Quests & Clue List"
              className="lg:hidden inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-[#1D0830] bg-[#F6C915] border border-[#D4A437] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Clues</span>
            </button>

            <button
              type="button"
              onClick={openLeaderboardModal}
              title="Leaderboard"
              className="hidden sm:inline-flex p-1.5 text-amber-600 dark:text-[#F6C915] bg-amber-500/10 border border-amber-400/35 rounded-lg transition-colors cursor-pointer"
            >
              <Trophy className="w-4 h-4" />
            </button>

            {currentUser ? (
              <button
                type="button"
                onClick={openSignInModal}
                title="Account"
                className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold cursor-pointer"
              >
                <UserProfileIcon
                  user={currentUser}
                  className="w-4 h-4 shrink-0"
                  fallback={<UserIcon className="w-3.5 h-3.5" />}
                />
                <span className="max-w-[80px] truncate">{getCleanDisplayName(currentUser)}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openSignInModal}
                title="Sign In"
                className="hidden md:inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#2d0938] text-amber-300 border border-amber-400/40 text-xs font-bold cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            <DailyStreakBadge
              streak={dailyStreak.streak}
              solvedToday={dailyStreak.solvedToday}
              variant="light"
              compact
            />

            <button
              type="button"
              onClick={() => setIsMuted(sound.toggleMute())}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="hidden sm:inline-flex p-1.5 text-[#4a1259] dark:text-purple-200 bg-purple-50 dark:bg-[#240938] border border-purple-200 dark:border-purple-800/70 rounded-lg transition-colors cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-amber-500 dark:text-[#F6C915]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-1.5 text-[#4a1259] dark:text-purple-200 bg-purple-50 dark:bg-[#240938] border border-purple-200 dark:border-purple-800/70 rounded-lg transition-colors cursor-pointer"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-[#4a1259]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                syncLeaderboardProgress(false);
                setGameState('PAUSED');
              }}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-extrabold text-[#1D0830] bg-[#F6C915] hover:bg-[#FFE047] rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-xs"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Menu</span>
            </button>
          </div>
        </header>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left/Center Playfield Column */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {streamLayout ? (
            /* STREAM LAYOUT TOP CLUE BANNER — expanded using reclaimed header space for high readability */
            <div className="w-full bg-white/95 dark:bg-[#1a0624] border-b border-purple-200 dark:border-purple-900/60 flex justify-center shrink-0 z-20 px-2">
              <button
                type="button"
                onClick={toggleActiveDirection}
                title="Click or press Space to toggle Across/Down"
                style={{
                  width: streamGridWidthPx > 0 ? `${streamGridWidthPx}px` : '100%',
                  maxWidth: '100%',
                }}
                className="px-3 py-2.5 sm:py-3 hover:bg-purple-50 dark:hover:bg-[#240938] flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer"
              >
                {activeWord ? (
                  <>
                    <div className="flex items-center justify-center gap-2.5 text-xs sm:text-sm">
                      <span className="font-mono-tabular text-xs sm:text-sm font-extrabold text-[#1D0830] bg-[#F6C915] px-2.5 py-0.5 rounded-md whitespace-nowrap">
                        {activeWord.number} {activeWord.direction === 'across' ? 'ACROSS' : 'DOWN'}
                      </span>
                      <span className="text-xs sm:text-sm font-mono-tabular font-medium text-slate-600 dark:text-purple-200 whitespace-nowrap">
                        {activeWord.category}
                      </span>
                    </div>
                    <div className="w-full h-20 sm:h-24">
                      <DynamicClueText
                        text={activeWord.clue}
                        centered
                        maxPx={28}
                        minPx={13}
                      />
                    </div>
                  </>
                ) : (
                  <div className="h-20 sm:h-24 flex items-center justify-center text-base sm:text-lg font-medium text-slate-500 dark:text-purple-300 text-center">
                    Select any white square on the 12×12 grid to view its clue
                  </div>
                )}
              </button>
            </div>
          ) : (
            /* FULL ATLAS TOP CLUE BAR */
            <div className="hidden md:flex items-center justify-between gap-3 px-4 py-2 bg-white/95 dark:bg-[#1a0624] border-b border-purple-200 dark:border-purple-900/60 shrink-0 z-20">
              <button
                type="button"
                onClick={() => stepToAdjacentWord(-1)}
                title="Previous Clue (Shift+Tab)"
                className="p-1.5 text-[#4a1259] dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/50 bg-purple-50 dark:bg-[#240938] border border-purple-200 dark:border-purple-800/70 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={toggleActiveDirection}
                title="Click or press Space to toggle Across/Down"
                className="flex-1 min-w-0 flex items-center justify-between gap-4 px-3.5 py-1.5 bg-purple-50/90 dark:bg-[#240938] hover:border-[#F6C915] border border-purple-200 dark:border-purple-800/70 rounded-lg text-left transition-colors cursor-pointer"
              >
                {activeWord ? (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono-tabular text-xs font-extrabold text-[#1D0830] bg-[#F6C915] px-2 py-0.5 rounded whitespace-nowrap shrink-0">
                        {activeWord.number} {activeWord.direction.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-[#2B0938] dark:text-white truncate">
                        {activeWord.clue}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-purple-300 font-mono-tabular whitespace-nowrap shrink-0">
                      <span>{activeWord.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>R{activeWord.row + 1}:C{activeWord.col + 1}</span>
                      <ArrowLeftRight className="w-3.5 h-3.5 text-amber-500 dark:text-[#F6C915] ml-1" />
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-purple-300">
                    Select any white square on the grid to inspect its clue
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => stepToAdjacentWord(1)}
                title="Next Clue (Tab)"
                className="p-1.5 text-[#4a1259] dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/50 bg-purple-50 dark:bg-[#240938] border border-purple-200 dark:border-purple-800/70 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Interactive Crossword Viewport */}
          <div className="flex-1 relative min-h-0">
            <CrosswordBoard
              puzzle={puzzle}
              userGrid={userGrid}
              revealedCells={revealedCells}
              lockedCells={lockedCells}
              selectedCell={selectedCell}
              direction={direction}
              activeWord={activeWord}
              cellSize={cellSize}
              streamMode={streamLayout}
              showErrors={showErrors}
              darkMode={darkMode}
              panTarget={panTarget}
              onSelectCell={handleSelectCell}
              onViewportChange={setViewportRect}
              onStreamWidthChange={setStreamGridWidthPx}
              overlayContent={
                <>
                  {/* 10-Second Quest Completion Pop-up */}
                  {questCompletePopup && (
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-sm bg-gradient-to-b from-[#2B0938]/98 via-[#21062C]/98 to-[#16041F]/98 border-2 border-[#F6C915] text-[#F5F3F7] px-4 py-3 rounded-2xl shadow-[0_14px_40px_rgba(0,0,0,0.75)] animate-in fade-in zoom-in-95 duration-200"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#F6C915]/20 border border-[#F6C915]/60 flex items-center justify-center shrink-0">
                            <Trophy className="w-5 h-5 text-[#F6C915]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono-tabular font-extrabold uppercase tracking-wider text-[#F6C915]">
                              <Sparkles className="w-3 h-3 shrink-0" />
                              <span>
                                Quest Completed · {questCompletePopup.completedCount}/
                                {questCompletePopup.totalCount}
                              </span>
                            </div>
                            <h4 className="text-sm font-extrabold text-white truncate mt-0.5">
                              {questCompletePopup.title}
                            </h4>
                            <p className="text-[11px] text-purple-200/85 truncate">
                              {questCompletePopup.subtitle}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pop-up Atlas Radar over the bottom-right of the grid */}
                  {showRadarPopup && (
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      onWheel={(e) => e.stopPropagation()}
                      className="absolute bottom-2.5 right-2.5 z-30"
                    >
                      <MiniMap
                        puzzle={puzzle}
                        userGrid={userGrid}
                        activeWord={activeWord}
                        viewportRect={viewportRect}
                        onCenterCell={handleCenterCell}
                        onClose={() => setShowRadarPopup(false)}
                      />
                    </div>
                  )}
                </>
              }
            />

            {/* Right-edge pop-in tab when desktop Side Clue Bar is collapsed */}
            {!isDesktopSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsDesktopSidebarOpen(true)}
                title="Show Side Clue Bar"
                aria-label="Show Side Clue Bar"
                className="hidden lg:flex items-center gap-1.5 absolute top-1/2 -translate-y-1/2 right-0 z-30 pl-2 pr-1.5 py-3 bg-[#2B0938]/95 hover:bg-[#3b0d47] text-[#F6C915] border border-r-0 border-[#D4A437] rounded-l-xl shadow-xl transition-colors cursor-pointer"
              >
                <PanelRightOpen className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Bottom Action & Clue Bar */}
          <div
            className={`relative bg-white/95 dark:bg-[#1a0624]/95 border-t border-purple-200 dark:border-purple-900/60 ${
              streamLayout ? 'px-2.5 py-2' : 'px-2.5 sm:px-4 py-2 space-y-2'
            } z-30 shrink-0`}
          >
            {/* Stream View Menu Popover containing all header options */}
            {streamLayout && showStreamMenu && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
                  onClick={() => setShowStreamMenu(false)}
                />
                <div
                  role="dialog"
                  aria-label="Stream View Menu"
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-[min(94vw,420px)] bg-white dark:bg-[#1c0729] border-2 border-[#D4A437]/70 rounded-2xl shadow-2xl p-3.5 space-y-3"
                >
                  {/* Brand, Solo Games, and Close */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-purple-200 dark:border-purple-800/70">
                    <button
                      type="button"
                      onClick={() => {
                        setShowStreamMenu(false);
                        syncLeaderboardProgress(false);
                        setGameState('TITLE_MENU');
                      }}
                      className="flex items-center gap-2 text-left group cursor-pointer min-w-0"
                    >
                      <img
                        src="/assets/aistudio/3d_logo_944e5372.png"
                        alt="MP Colossal"
                        className="w-7 h-7 rounded-full object-contain drop-shadow shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold tracking-tight text-[#3b0d47] dark:text-white group-hover:text-amber-500 dark:group-hover:text-[#F6C915] transition-colors truncate">
                          MP <span className="text-amber-500 dark:text-[#F6C915]">Colossal</span>
                        </div>
                        <div className="text-[11px] font-mono-tabular text-slate-500 dark:text-purple-300 truncate">
                          12×12 Stream · {currentSector?.name}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        to="/solo-games"
                        onClick={() => setShowStreamMenu(false)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#4a1259] dark:text-amber-300 bg-purple-100/80 dark:bg-purple-900/50 hover:bg-purple-200/80 dark:hover:bg-purple-800/60 border border-purple-200/80 dark:border-purple-700/60 transition-colors whitespace-nowrap"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Solo Games</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setShowStreamMenu(false)}
                        aria-label="Close Menu"
                        className="p-1.5 rounded-lg text-[#4a1259] dark:text-purple-200 bg-purple-50 dark:bg-[#2a0c3f] hover:bg-purple-100 dark:hover:bg-purple-900/70 border border-purple-200 dark:border-purple-800/70 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress & Streak Summary */}
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-purple-50/90 dark:bg-[#240938] border border-purple-200/80 dark:border-purple-800/60 text-xs font-mono-tabular">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-slate-600 dark:text-purple-200">
                      <span>
                        Words:{' '}
                        <strong className="text-[#3b0d47] dark:text-white">
                          {solvedWordIds.size.toLocaleString()}
                        </strong>
                        /{puzzle.words.length.toLocaleString()}
                      </span>
                      <span>
                        Quests:{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {completedQuestsCount}
                        </strong>
                        /{puzzle.quests.length}
                      </span>
                      <span>
                        Score:{' '}
                        <strong className="text-amber-600 dark:text-[#F6C915]">
                          {atlasScore.toLocaleString()}
                        </strong>
                      </span>
                    </div>
                    <DailyStreakBadge
                      streak={dailyStreak.streak}
                      solvedToday={dailyStreak.solvedToday}
                      variant="light"
                      compact
                    />
                  </div>

                  {/* All Header Controls Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPanTarget({
                          row: selectedCell.row,
                          col: selectedCell.col,
                          timestamp: Date.now(),
                        });
                        setShowStreamMenu(false);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#4a1259] dark:text-purple-100 bg-purple-50 dark:bg-[#240938] hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/70 rounded-xl transition-colors cursor-pointer"
                    >
                      <LocateFixed className="w-4 h-4 text-amber-500 dark:text-[#F6C915] shrink-0" />
                      <span>Center Cell</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowErrors((prev) => !prev)}
                      className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                        showErrors
                          ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-purple-50 dark:bg-[#240938] border-purple-200 dark:border-purple-800/70 text-[#4a1259] dark:text-purple-100 hover:bg-purple-100 dark:hover:bg-purple-900/60'
                      }`}
                    >
                      <Eye className="w-4 h-4 shrink-0" />
                      <span>Check Errors: {showErrors ? 'On' : 'Off'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.innerWidth >= 1024) {
                          setIsDesktopSidebarOpen((prev) => !prev);
                        } else {
                          setIsMobileSidebarOpen((prev) => !prev);
                        }
                        setShowStreamMenu(false);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#1D0830] bg-[#F6C915] hover:bg-[#FFE047] border border-[#D4A437] rounded-xl transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 shrink-0" />
                      <span>Clues &amp; Quests</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowStreamMenu(false);
                        openLeaderboardModal();
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-[#F6C915] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/35 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trophy className="w-4 h-4 shrink-0" />
                      <span>Leaderboard</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowStreamMenu(false);
                        openSignInModal();
                      }}
                      className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                        currentUser
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                          : 'bg-[#2d0938] text-amber-300 border-amber-400/40 hover:bg-[#3e0e4d]'
                      }`}
                    >
                      {currentUser ? (
                        <>
                          <UserProfileIcon
                            user={currentUser}
                            className="w-4 h-4 shrink-0"
                            fallback={<UserIcon className="w-3.5 h-3.5 shrink-0" />}
                          />
                          <span className="truncate">{getCleanDisplayName(currentUser)}</span>
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4 shrink-0" />
                          <span>Sign In</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsMuted(sound.toggleMute())}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#4a1259] dark:text-purple-100 bg-purple-50 dark:bg-[#240938] hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/70 rounded-xl transition-colors cursor-pointer"
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4 text-rose-500 shrink-0" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-amber-500 dark:text-[#F6C915] shrink-0" />
                      )}
                      <span>{isMuted ? 'Audio Muted' : 'Audio On'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDarkMode((d) => !d)}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#4a1259] dark:text-purple-100 bg-purple-50 dark:bg-[#240938] hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/70 rounded-xl transition-colors cursor-pointer"
                    >
                      {darkMode ? (
                        <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <Moon className="w-4 h-4 text-[#4a1259] shrink-0" />
                      )}
                      <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChangeStreamLayout(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#4a1259] dark:text-purple-100 bg-purple-50 dark:bg-[#240938] hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/70 rounded-xl transition-colors cursor-pointer"
                    >
                      <LayoutGrid className="w-4 h-4 text-amber-500 dark:text-[#F6C915] shrink-0" />
                      <span>Full Atlas View</span>
                    </button>
                  </div>

                  {/* Atlas Pause / Scale / Reset Menu Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowStreamMenu(false);
                      syncLeaderboardProgress(false);
                      setGameState('PAUSED');
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-extrabold text-[#1D0830] bg-[#F6C915] hover:bg-[#FFE047] rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Atlas Pause, Grid Scale &amp; Reset</span>
                  </button>
                </div>
              </>
            )}

            {!streamLayout && (
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => stepToAdjacentWord(-1)}
                  aria-label="Previous Clue"
                  title="Previous Clue (Shift+Tab)"
                  className="min-w-[44px] min-h-[44px] px-3 flex items-center justify-center text-[#4a1259] dark:text-purple-100 bg-purple-50 dark:bg-[#240938] hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/70 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={toggleActiveDirection}
                  title="Tap to switch Across / Down direction"
                  className="flex-1 min-w-0 min-h-[44px] px-3 py-1.5 bg-purple-50/90 dark:bg-[#240938] border border-purple-200 dark:border-purple-800/70 hover:border-[#F6C915] rounded-xl flex flex-col justify-center text-left cursor-pointer transition-colors"
                >
                  {activeWord ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-tabular text-[11px] font-bold text-amber-600 dark:text-[#F6C915] whitespace-nowrap">
                          {activeWord.number} {activeWord.direction.toUpperCase()} ·{' '}
                          {activeWord.category}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-purple-300 font-mono-tabular whitespace-nowrap">
                          <ArrowLeftRight className="w-3 h-3 text-amber-500 dark:text-[#F6C915]" />
                          <span>Flip Dir</span>
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-[#2B0938] dark:text-white line-clamp-2 leading-snug mt-0.5">
                        {activeWord.clue}
                      </p>
                    </>
                  ) : (
                    <span className="text-xs sm:text-sm text-slate-500 dark:text-purple-300">
                      Tap any square on the grid to view its clue
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => stepToAdjacentWord(1)}
                  aria-label="Next Clue"
                  title="Next Clue (Tab)"
                  className="min-w-[44px] min-h-[44px] px-3 flex items-center justify-center text-[#4a1259] dark:text-purple-100 bg-purple-50 dark:bg-[#240938] hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/70 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Hint & Radar Buttons */}
            <div
              className={`flex items-center gap-1.5 flex-wrap ${
                streamLayout ? 'justify-center' : 'justify-center sm:justify-end'
              }`}
            >
              {streamLayout && (
                <>
                  <button
                    type="button"
                    onClick={() => stepToAdjacentWord(-1)}
                    aria-label="Previous Clue"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#4a1259] dark:text-purple-100 bg-purple-50 dark:bg-[#240938] border border-purple-200 dark:border-purple-800/70 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleActiveDirection}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#4a1259] dark:text-purple-100 bg-purple-50 dark:bg-[#240938] border border-purple-200 dark:border-purple-800/70 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-amber-500 dark:text-[#F6C915]" />
                    <span>Flip</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleHintStartOrEnd}
                disabled={!activeWord}
                title="Hint 1: Reveal the first or last letter of this word"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#4a1259] dark:text-purple-100 bg-purple-50 dark:bg-[#240938] hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/70 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-500 dark:text-[#F6C915]" />
                <span>{streamLayout ? '1. Edge' : '1. Edge Letter'}</span>
              </button>

              <button
                type="button"
                onClick={handleHintRevealCell}
                disabled={!activeWord}
                title="Hint 2: Reveal currently focused square"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#4a1259] dark:text-purple-100 bg-purple-50 dark:bg-[#240938] hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/70 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
              >
                <Compass className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{streamLayout ? '2. Square' : '2. Reveal Square'}</span>
              </button>

              <button
                type="button"
                onClick={handleHintRevealWord}
                disabled={!activeWord}
                title="Hint 3: Reveal entire active word"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-amber-700 dark:text-[#F6C915] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/35 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{streamLayout ? '3. Word' : '3. Reveal Word'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRadarPopup((prev) => !prev)}
                title="Toggle Pop-up Atlas Radar Minimap"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                  showRadarPopup
                    ? 'bg-[#F6C915] text-[#1D0830] border-[#D4A437]'
                    : 'bg-purple-50 dark:bg-[#240938] text-[#4a1259] dark:text-purple-100 border-purple-200 dark:border-purple-800/70'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>{streamLayout ? 'Radar' : 'Atlas Radar'}</span>
              </button>

              {streamLayout && (
                <>
                  <button
                    type="button"
                    onClick={() => stepToAdjacentWord(1)}
                    aria-label="Next Clue"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#4a1259] dark:text-purple-100 bg-purple-50 dark:bg-[#240938] border border-purple-200 dark:border-purple-800/70 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowStreamMenu((prev) => !prev)}
                    aria-expanded={showStreamMenu}
                    aria-label="Toggle Stream Menu"
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shadow-xs ${
                      showStreamMenu
                        ? 'bg-[#2B0938] text-[#F6C915] border-[#F6C915]'
                        : 'bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] border-[#D4A437]'
                    }`}
                  >
                    {showStreamMenu ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
                    <span>Menu</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <AtlasSidebar
          puzzle={puzzle}
          mode={mode}
          onChangeMode={setMode}
          activeWord={activeWord}
          solvedWordIds={solvedWordIds}
          selectedSectorFilter={selectedSectorFilter}
          onChangeSectorFilter={setSelectedSectorFilter}
          onSelectWord={handleSelectWord}
          onSolveCurrentSectorDemo={handleCompleteQuestWords}
          isDesktopOpen={isDesktopSidebarOpen}
          onToggleDesktop={() => setIsDesktopSidebarOpen((prev) => !prev)}
          isOpenOnMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      </div>

      {/* Pause / Victory / Summary Modal */}
      <SummaryModal
        isOpen={gameState === 'PAUSED' || gameState === 'GAME_OVER'}
        isVictory={gameState === 'GAME_OVER'}
        puzzle={puzzle}
        solvedWordsCount={solvedWordIds.size}
        filledCellsCount={Object.keys(userGrid).length}
        hintsUsed={hintsUsed}
        elapsedSeconds={elapsedSeconds}
        atlasScore={atlasScore}
        streamLayout={streamLayout}
        onChangeStreamLayout={handleChangeStreamLayout}
        onClose={() => setGameState('PLAYING')}
        onRestartPuzzle={handleRestartPuzzle}
        onChangeScale={(newScale) => setScale(newScale)}
        onReturnToTitle={() => setGameState('TITLE_MENU')}
        onAutoSolveEntireBoard={handleAutoSolveEntireBoard}
        onOpenLeaderboard={openLeaderboardModal}
      />

      {/* Secret 25x200 Reveal & Grand Finale Celebration Modal (MP Colossal only) */}
      <SecretCelebrationModal
        variant={secretModalVariant}
        secretWordCount={Math.max(0, puzzle.words.length - puzzle.mainWordCount)}
        totalWordsSolved={solvedWordIds.size}
        elapsedSeconds={elapsedSeconds}
        atlasScore={atlasScore}
        onPrimaryAction={() => {
          const currentVariant = secretModalVariant;
          setSecretModalVariant(null);
          if (currentVariant === 'reveal') {
            const firstSecret = puzzle.words.find((w) => w.isSecret);
            if (firstSecret) {
              handleSelectWord(firstSecret);
            } else {
              handleCenterCell(puzzle.secretStartRow ?? 200, Math.floor((puzzle.cols || 200) / 2));
            }
          }
        }}
        onReplayFanfare={
          secretModalVariant === 'finale'
            ? () => {
                sound.playGrandFanfare();
                triggerVictoryConfetti();
              }
            : undefined
        }
        onOpenLeaderboard={() => {
          setSecretModalVariant(null);
          openLeaderboardModal();
        }}
        onReturnToTitle={() => {
          setSecretModalVariant(null);
          setGameState('TITLE_MENU');
        }}
      />

      {/* Unified Solo Games Auth & Public Leaderboard Modal */}
      <UnifiedAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        user={currentUser}
        initialGameId="mpcolossal"
        initialTab={authModalTab}
      />
    </div>
  );
}
