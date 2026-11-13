import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lightbulb,
  RotateCcw,
  ArrowLeft,
  Flame,
  Layers,
  Timer,
  Pause,
  Play,
  FastForward,
  Zap,
  Sparkles,
} from 'lucide-react';
import {
  WordPuzzle,
  TileData,
  GameState,
  DifficultyMode,
  TimerDuration,
  RunningScoreboardPlayer,
  LiveChatItem,
} from '../types';
import { soundManager } from '../utils/audio';
import { TikTokLivePanel, SAMPLE_PERSONAS } from './TikTokLivePanel';

interface GameBoardProps {
  puzzle: WordPuzzle;
  difficulty: DifficultyMode;
  onChangeDifficulty: (mode: DifficultyMode) => void;
  onVictory: (timeSeconds: number, hintsUsed: number, score: number, words: string[]) => void;
  setCurrentView: (view: GameState) => void;
  onOpenHowToPlay: () => void;
  // Interactive TikTok & Scoreboard props
  timerDuration: TimerDuration;
  onChangeTimerDuration: (duration: TimerDuration) => void;
  tiktokUsername: string;
  isLiveConnected: boolean;
  roomId?: string;
  scoreboard: RunningScoreboardPlayer[];
  chatFeed: LiveChatItem[];
  onRecordCorrectChatAnswer: (
    user: { uniqueId: string; nickname: string; profilePictureUrl: string },
    wordIndex: number,
    word: string,
    solveTimeSeconds: number,
    timerDuration: TimerDuration,
    comment: string
  ) => void;
  onRecordRegularChatMessage: (data: {
    uniqueId: string;
    nickname: string;
    comment: string;
    profilePictureUrl: string;
  }) => void;
  onOpenConnectModal: () => void;
  onResetScoreboard: () => void;
  onSimulateChat: (data: {
    uniqueId: string;
    nickname: string;
    comment: string;
    profilePictureUrl: string;
  }) => void;
  incomingChatQueue: Array<{
    id: string;
    uniqueId: string;
    nickname: string;
    comment: string;
    profilePictureUrl: string;
  }>;
  onConsumeChatQueue: () => void;
  resetSignal: number;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  puzzle,
  difficulty,
  onChangeDifficulty,
  onVictory,
  setCurrentView,
  onOpenHowToPlay,
  timerDuration,
  onChangeTimerDuration,
  tiktokUsername,
  isLiveConnected,
  roomId,
  scoreboard,
  chatFeed,
  onRecordCorrectChatAnswer,
  onRecordRegularChatMessage,
  onOpenConnectModal,
  onResetScoreboard,
  onSimulateChat,
  incomingChatQueue,
  onConsumeChatQueue,
  resetSignal,
}) => {
  const [tiles, setTiles] = useState<TileData[]>(() => JSON.parse(JSON.stringify(puzzle.tiles)));
  const [rack, setRack] = useState<Array<TileData | null>>([null, null, null, null, null]);
  const [completedWordLetters, setCompletedWordLetters] = useState<string[] | null>(null);
  const [goldFlashKey, setGoldFlashKey] = useState(0);

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [wordsFound, setWordsFound] = useState<string[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHintText, setShowHintText] = useState(false);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [isErrorShake, setIsErrorShake] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Word Reveal Countdown Timer State (30s, 45s, 60s)
  const [wordTimeLeft, setWordTimeLeft] = useState<number>(timerDuration);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);
  const wordStartTimestampRef = useRef<number>(Date.now());
  const [currentWordSolvers, setCurrentWordSolvers] = useState<string[]>([]);
  const isRoundFinishedRef = useRef<boolean>(false);

  // Swipe-to-reveal hint state
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isDraggingHint, setIsDraggingHint] = useState(false);
  const swipeTrackRef = useRef<HTMLDivElement | null>(null);

  // Reset board if puzzle date, difficulty, or resetSignal changes
  useEffect(() => {
    setTiles(JSON.parse(JSON.stringify(puzzle.tiles)));
    setRack([null, null, null, null, null]);
    setCompletedWordLetters(null);
    setCurrentWordIndex(0);
    setWordsFound([]);
    setHintsUsed(0);
    setShowHintText(false);
    setTimeSeconds(0);
    setSwipeProgress(0);
    setWordTimeLeft(timerDuration);
    wordStartTimestampRef.current = Date.now();
    setCurrentWordSolvers([]);
    isRoundFinishedRef.current = false;
  }, [puzzle, resetSignal]);

  // When user changes timer duration (30 / 45 / 60s), update current word countdown
  const handleSelectTimerDuration = (newDuration: TimerDuration) => {
    onChangeTimerDuration(newDuration);
    setWordTimeLeft(newDuration);
    wordStartTimestampRef.current = Date.now();
  };

  const targetWord = puzzle.words[currentWordIndex] || '';
  const currentHint = puzzle.hints[currentWordIndex] || 'Find the next 5-letter word in the stack.';

  // Recompute which tiles are exposed based on cleared tiles and tiles currently in the rack
  const recomputeExposed = useCallback(
    (currentTiles: TileData[], currentRack: Array<TileData | null>) => {
      const rackIds = new Set(currentRack.filter(Boolean).map((t) => t!.id));
      const clearedIds = new Set(currentTiles.filter((t) => t.isCleared).map((t) => t.id));

      return currentTiles.map((tile) => {
        if (tile.isCleared) {
          return { ...tile, isExposed: false, inRackIndex: null };
        }
        const rIdx = currentRack.findIndex((r) => r?.id === tile.id);
        if (rIdx !== -1) {
          return { ...tile, isExposed: false, inRackIndex: rIdx };
        }
        const isStillCovered = tile.coveredBy.some(
          (covId) => !clearedIds.has(covId) && !rackIds.has(covId)
        );
        return {
          ...tile,
          isExposed: !isStillCovered,
          inRackIndex: null,
        };
      });
    },
    []
  );

  // Automatically reveal & unstack the current targetWord (triggered when 30/45/60s timer hits 0 or "Reveal Word" clicked)
  const revealCurrentWordOnBoard = useCallback(
    (reason: 'timer' | 'manual_button') => {
      if (isRoundFinishedRef.current || !targetWord) return;

      // Return any tiles currently sitting in the rack back to the pool so we can cleanly clear the 5 tiles of targetWord
      const workingTiles: TileData[] = tiles.map((t) => ({
        ...t,
        inRackIndex: null,
      }));

      // Step through the 5 letters of targetWord and pick valid uncleared tiles (preferring exposed/highest layer)
      const chosenIds = new Set<string>();
      const clearedIds = new Set(
        workingTiles.filter((t) => t.isCleared).map((t) => t.id)
      );

      for (const letter of targetWord.split('')) {
        // Recompute which uncleared tiles are currently uncovered
        const candidates = workingTiles.filter(
          (t) =>
            !t.isCleared &&
            !chosenIds.has(t.id) &&
            t.letter === letter
        );

        // Sort uncovered & highest layer first
        candidates.sort((a, b) => {
          const aUncovered = a.coveredBy.every((cid) => clearedIds.has(cid));
          const bUncovered = b.coveredBy.every((cid) => clearedIds.has(cid));
          if (aUncovered !== bUncovered) return aUncovered ? -1 : 1;
          return b.layer - a.layer;
        });

        const picked = candidates[0];
        if (picked) {
          chosenIds.add(picked.id);
          clearedIds.add(picked.id);
        }
      }

      soundManager.playWordCorrect();

      const updatedTiles = workingTiles.map((t) =>
        chosenIds.has(t.id)
          ? { ...t, isCleared: true, isExposed: false, inRackIndex: null }
          : t
      );

      const nextWordsFound = [...wordsFound, targetWord];
      const emptyRack: Array<TileData | null> = [null, null, null, null, null];

      setCompletedWordLetters(targetWord.split(''));
      setGoldFlashKey((prev) => prev + 1);
      setWordsFound(nextWordsFound);
      setRack(emptyRack);
      setShowHintText(false);
      setSwipeProgress(0);
      setTiles(recomputeExposed(updatedTiles, emptyRack));

      const solverCount = currentWordSolvers.length;
      setStatusMessage(
        reason === 'timer'
          ? `⏰ Time's up! Word #${currentWordIndex + 1} revealed: ${targetWord} (${solverCount} ${
              solverCount === 1 ? 'player' : 'players'
            } scored)`
          : `✨ Word #${currentWordIndex + 1} revealed: ${targetWord} (${solverCount} ${
              solverCount === 1 ? 'player' : 'players'
            } scored)`
      );

      if (currentWordIndex + 1 >= puzzle.words.length) {
        isRoundFinishedRef.current = true;
        setTimeout(() => {
          soundManager.playVictory();
          const maxBase = difficulty === 'hard' ? 2800 : 1800;
          const minBase = difficulty === 'hard' ? 900 : 500;
          const baseScore = Math.max(minBase, maxBase - timeSeconds * 3 - hintsUsed * 150);
          onVictory(timeSeconds, hintsUsed, baseScore, nextWordsFound);
        }, 900);
      } else {
        setCurrentWordIndex((prev) => prev + 1);
        setWordTimeLeft(timerDuration);
        wordStartTimestampRef.current = Date.now();
        setCurrentWordSolvers([]);
      }
    },
    [
      targetWord,
      tiles,
      wordsFound,
      currentWordIndex,
      puzzle.words.length,
      difficulty,
      timeSeconds,
      hintsUsed,
      timerDuration,
      currentWordSolvers.length,
      onVictory,
      recomputeExposed,
    ]
  );

  // Keep a ref to revealCurrentWordOnBoard so the 1-second interval always invokes the latest closure
  const revealWordRef = useRef(revealCurrentWordOnBoard);
  useEffect(() => {
    revealWordRef.current = revealCurrentWordOnBoard;
  }, [revealCurrentWordOnBoard]);

  // 1-second interval for total elapsed time AND the 30/45/60s Word Auto-Reveal Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      if (isRoundFinishedRef.current) return;

      setTimeSeconds((t) => t + 1);

      if (!isTimerPaused) {
        setWordTimeLeft((prev) => {
          if (prev <= 1) {
            // Trigger auto-reveal of the current word on next tick
            setTimeout(() => {
              revealWordRef.current('timer');
            }, 0);
            return timerDuration;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isTimerPaused, timerDuration]);

  // Process incoming chat messages from TikTok LIVE or Simulator
  useEffect(() => {
    if (incomingChatQueue.length === 0) return;

    incomingChatQueue.forEach((msg) => {
      const cleanId = (msg.uniqueId || 'viewer').replace(/^@+/, '').toLowerCase();
      const cleanNick = (msg.nickname || msg.uniqueId || 'Player').replace(/^@+/, '');
      const rawComment = (msg.comment || '').trim();
      if (!rawComment) return;

      // Check if comment contains the current 5-letter targetWord
      const upperComment = rawComment.toUpperCase();
      const candidateWords: string[] = upperComment.match(/[A-Z]{5}/g) || [];
      const isCorrect =
        !isRoundFinishedRef.current &&
        Boolean(targetWord) &&
        (upperComment === targetWord || candidateWords.includes(targetWord));

      if (isCorrect) {
        // Check if this viewer already solved the current word
        if (currentWordSolvers.includes(cleanId)) {
          return;
        }

        const elapsedSeconds = Math.max(
          0.2,
          Math.min(timerDuration, (Date.now() - wordStartTimestampRef.current) / 1000)
        );

        setCurrentWordSolvers((prev) =>
          prev.includes(cleanId) ? prev : [...prev, cleanId]
        );

        soundManager.playTileSelect();

        onRecordCorrectChatAnswer(
          {
            uniqueId: cleanId,
            nickname: cleanNick,
            profilePictureUrl: msg.profilePictureUrl,
          },
          currentWordIndex,
          targetWord,
          elapsedSeconds,
          timerDuration,
          rawComment
        );

        setStatusMessage(
          `⚡ ${cleanNick} got Word #${currentWordIndex + 1} in ${elapsedSeconds.toFixed(1)}s!`
        );
      } else {
        onRecordRegularChatMessage({
          uniqueId: cleanId,
          nickname: cleanNick,
          comment: rawComment,
          profilePictureUrl: msg.profilePictureUrl,
        });
      }
    });

    onConsumeChatQueue();
  }, [
    incomingChatQueue,
    targetWord,
    currentWordIndex,
    currentWordSolvers,
    timerDuration,
    onRecordCorrectChatAnswer,
    onRecordRegularChatMessage,
    onConsumeChatQueue,
  ]);

  // Simulate a wave of viewers answering the current word at different speeds
  const handleSimulateWave = useCallback(() => {
    if (!targetWord || isRoundFinishedRef.current) return;

    // Shuffle sample personas so different players get 1st, 2nd, 3rd across words
    const shuffled = [...SAMPLE_PERSONAS].sort(() => Math.random() - 0.5);
    const wavePlayers = shuffled.slice(0, 6);

    wavePlayers.forEach((persona, idx) => {
      const delayMs = 200 + idx * 550 + Math.floor(Math.random() * 250);
      setTimeout(() => {
        onSimulateChat({
          uniqueId: persona.uniqueId,
          nickname: persona.nickname,
          comment: targetWord,
          profilePictureUrl: persona.profilePictureUrl,
        });
      }, delayMs);
    });
  }, [targetWord, onSimulateChat]);

  // Validate 5-letter word when rack fills up manually
  const validateRackWord = useCallback(
    (currentRack: Array<TileData | null>, currentTiles: TileData[]) => {
      const formedWord = currentRack.map((t) => t?.letter || '').join('');

      if (formedWord === targetWord) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([25, 40, 35]);
        }
        soundManager.playWordCorrect();

        const clearedIds = new Set(currentRack.map((t) => t!.id));
        const updatedTiles = currentTiles.map((t) =>
          clearedIds.has(t.id)
            ? { ...t, isCleared: true, isExposed: false, inRackIndex: null }
            : t
        );

        const nextWordsFound = [...wordsFound, targetWord];
        const emptyRack: Array<TileData | null> = [null, null, null, null, null];

        setCompletedWordLetters(formedWord.split(''));
        setGoldFlashKey((prev) => prev + 1);
        setWordsFound(nextWordsFound);
        setRack(emptyRack);
        setShowHintText(false);
        setSwipeProgress(0);
        setTiles(recomputeExposed(updatedTiles, emptyRack));

        if (currentWordIndex + 1 >= puzzle.words.length) {
          isRoundFinishedRef.current = true;
          setTimeout(() => {
            soundManager.playVictory();
            const maxBase = difficulty === 'hard' ? 2800 : 1800;
            const minBase = difficulty === 'hard' ? 900 : 500;
            const baseScore = Math.max(
              minBase,
              maxBase - timeSeconds * 3 - hintsUsed * 150
            );
            onVictory(timeSeconds, hintsUsed, baseScore, nextWordsFound);
          }, 850);
        } else {
          setCurrentWordIndex((prev) => prev + 1);
          setWordTimeLeft(timerDuration);
          wordStartTimestampRef.current = Date.now();
          setCurrentWordSolvers([]);
        }
      } else {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([45, 45, 45]);
        }
        soundManager.playError();
        setIsErrorShake(true);
        setStatusMessage(`"${formedWord}" is not the next word — returning tiles`);

        setTimeout(() => {
          setIsErrorShake(false);
          setStatusMessage(null);
          const emptyRack: Array<TileData | null> = [null, null, null, null, null];
          setRack(emptyRack);
          setTiles(recomputeExposed(currentTiles, emptyRack));
        }, 620);
      }
    },
    [
      targetWord,
      wordsFound,
      currentWordIndex,
      puzzle.words.length,
      difficulty,
      timeSeconds,
      hintsUsed,
      timerDuration,
      onVictory,
      recomputeExposed,
    ]
  );

  // Pick an exposed tile from the stack into the next open rack slot
  const handleTileClick = useCallback(
    (tile: TileData) => {
      if (!tile.isExposed || tile.isCleared || isErrorShake) return;

      const emptyIndex = rack.findIndex((slot) => slot === null);
      if (emptyIndex === -1) return;

      if (completedWordLetters !== null) {
        setCompletedWordLetters(null);
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(14);
      }
      soundManager.playTileSelect();

      const newRack = [...rack];
      newRack[emptyIndex] = tile;
      setRack(newRack);

      const newTiles = recomputeExposed(tiles, newRack);
      setTiles(newTiles);

      if (newRack.every((slot) => slot !== null)) {
        validateRackWord(newRack, newTiles);
      }
    },
    [rack, tiles, isErrorShake, completedWordLetters, recomputeExposed, validateRackWord]
  );

  // Tap a tile in the rack to move it AND any subsequent rack tiles back to the Stack
  const handleRackClick = useCallback(
    (rackIndex: number) => {
      if (!rack[rackIndex] || isErrorShake) return;

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
      soundManager.playTileReturn();

      const newRack = rack.map((item, idx) => (idx >= rackIndex ? null : item));
      setRack(newRack);

      const newTiles = recomputeExposed(tiles, newRack);
      setTiles(newTiles);
    },
    [rack, tiles, isErrorShake, recomputeExposed]
  );

  // Keyboard support: A-Z picks an exposed tile when not typing in an input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key)) {
        const matchingTile = tiles
          .filter(
            (t) =>
              t.isExposed &&
              !t.isCleared &&
              t.inRackIndex === null &&
              t.letter === key
          )
          .sort((a, b) => b.layer - a.layer)[0];
        if (matchingTile) {
          handleTileClick(matchingTile);
        }
      } else if (e.key === 'Backspace') {
        const lastFilledIdx = rack.reduce(
          (acc, item, idx) => (item !== null ? idx : acc),
          -1
        );
        if (lastFilledIdx !== -1) {
          handleRackClick(lastFilledIdx);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tiles, rack, handleTileClick, handleRackClick]);

  // Reveal hint handler
  const revealHint = () => {
    if (!showHintText) {
      setHintsUsed((prev) => prev + 1);
      setShowHintText(true);
      setSwipeProgress(1);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(20);
      }
    }
  };

  const handlePointerDownHint = (e: React.PointerEvent) => {
    if (showHintText) return;
    setIsDraggingHint(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveHint = (e: React.PointerEvent) => {
    if (!isDraggingHint || !swipeTrackRef.current || showHintText) return;
    const rect = swipeTrackRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width - 48, e.clientX - rect.left - 24));
    const progress = relX / Math.max(1, rect.width - 48);
    setSwipeProgress(progress);
    if (progress > 0.65) {
      setIsDraggingHint(false);
      revealHint();
    }
  };

  const handlePointerUpHint = () => {
    if (!isDraggingHint) return;
    setIsDraggingHint(false);
    if (swipeProgress > 0.45) {
      revealHint();
    } else {
      if (swipeProgress < 0.08) {
        revealHint();
      } else {
        setSwipeProgress(0);
      }
    }
  };

  const handleReset = () => {
    const freshTiles = JSON.parse(JSON.stringify(puzzle.tiles));
    setTiles(freshTiles);
    setRack([null, null, null, null, null]);
    setCompletedWordLetters(null);
    setCurrentWordIndex(0);
    setWordsFound([]);
    setShowHintText(false);
    setSwipeProgress(0);
    setWordTimeLeft(timerDuration);
    wordStartTimestampRef.current = Date.now();
    setCurrentWordSolvers([]);
    isRoundFinishedRef.current = false;
  };

  const wordsRemaining = puzzle.words.length - wordsFound.length;
  const isShowingCompletedWord =
    rack.every((t) => t === null) && completedWordLetters !== null;
  const isHardMode = difficulty === 'hard';
  const tileSizePct = isHardMode ? '11.4%' : '16.2%';
  const timerPct = Math.max(0, Math.min(100, (wordTimeLeft / timerDuration) * 100));

  return (
    <div className="relative flex-1 w-full bg-[#4a1259] dark:bg-[#22072b] flex flex-col items-center justify-start px-3 py-4 sm:py-6 select-none transition-colors overflow-x-hidden">
      {/* Tiled Icon Background at 20% Opacity */}
      <div
        aria-hidden="true"
        style={{
          backgroundImage: "url('/assets/aistudio/3d_logo_944e5372.png')",
          backgroundRepeat: 'repeat',
          backgroundSize: '88px 88px',
        }}
        className="absolute inset-0 opacity-20 pointer-events-none"
      />

      {/* Responsive 2-Column Layout: Left = Game Stack Board + Control Timer, Right = Running Scoreboard & Live Chat */}
      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ===================================================================== */}
        {/* LEFT COLUMN (5 cols on lg): Stackdown Board + 30/45/60s Control Timer */}
        {/* ===================================================================== */}
        <div className="lg:col-span-5 w-full max-w-[460px] mx-auto flex flex-col items-center">
          {/* Top Utility Strip (Exit / Difficulty Switch / Elapsed Time / Reset) */}
          <div className="w-full flex items-center justify-between px-1 mb-2 text-purple-100/85 text-xs font-semibold">
            <button
              onClick={() => setCurrentView('TITLE')}
              className="inline-flex items-center gap-1 hover:text-amber-300 transition-colors py-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Menu
            </button>

            {/* Normal (4 Layers) vs Hard Mode (6 Layers) Toggle */}
            <div className="flex items-center p-0.5 rounded-xl bg-[#360b42] dark:bg-[#16041c] border border-purple-400/25">
              <button
                type="button"
                onClick={() => onChangeDifficulty('normal')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                  !isHardMode
                    ? 'bg-amber-400 text-[#2d0938] shadow-sm'
                    : 'text-purple-200/75 hover:text-white'
                }`}
              >
                <Layers className="w-3 h-3" /> 4 Layers
              </button>
              <button
                type="button"
                onClick={() => onChangeDifficulty('hard')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                  isHardMode
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-[#2d0938] shadow-sm'
                    : 'text-purple-200/75 hover:text-white'
                }`}
              >
                <Flame className="w-3 h-3" /> Hard (6 Layers)
              </button>
            </div>

            <div className="flex items-center gap-2 font-mono tabular-nums">
              <span className="text-purple-200/80 text-[11px]">
                Total {Math.floor(timeSeconds / 60)}:
                {timeSeconds % 60 < 10 ? '0' : ''}
                {timeSeconds % 60}
              </span>
              <button
                onClick={handleReset}
                title="Restart Puzzle"
                className="p-1.5 rounded-lg hover:bg-black/25 text-purple-100 hover:text-amber-300 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ================================================================= */}
          {/* INTERACTIVE WORD REVEAL CONTROL TIMER BAR (30s / 45s / 60s)       */}
          {/* ================================================================= */}
          <div className="w-full mb-3 p-2.5 rounded-2xl bg-[#310a3d] dark:bg-[#16041c] border border-amber-400/35 shadow-lg">
            <div className="flex items-center justify-between gap-2 mb-2">
              {/* 30s / 45s / 60s Selector Pills */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1 mr-1">
                  <Timer className="w-3.5 h-3.5 text-amber-400" />
                  Timer:
                </span>
                {([30, 45, 60] as TimerDuration[]).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => handleSelectTimerDuration(sec)}
                    className={`px-2.5 py-1 rounded-lg font-mono text-xs font-extrabold transition-all cursor-pointer ${
                      timerDuration === sec
                        ? 'bg-amber-400 text-[#2d0938] shadow-sm scale-105'
                        : 'bg-white/10 text-purple-200 hover:bg-white/15'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>

              {/* Countdown Readout + Pause/Play + Reveal Next Word Now */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`font-mono font-black text-sm px-2 py-0.5 rounded-lg border tabular-nums ${
                    wordTimeLeft <= 5
                      ? 'bg-rose-500/30 border-rose-400 text-rose-200 animate-pulse'
                      : 'bg-black/40 border-amber-400/30 text-amber-300'
                  }`}
                >
                  {wordTimeLeft}s
                </span>

                <button
                  type="button"
                  onClick={() => setIsTimerPaused((p) => !p)}
                  title={isTimerPaused ? 'Resume Auto-Reveal Timer' : 'Pause Auto-Reveal Timer'}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-amber-300 cursor-pointer"
                >
                  {isTimerPaused ? (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => revealCurrentWordOnBoard('manual_button')}
                  title="Reveal Next Word Immediately"
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-300 to-amber-500 hover:brightness-105 text-[#2d0938] font-extrabold text-[11px] flex items-center gap-1 cursor-pointer shadow-sm"
                >
                  <FastForward className="w-3 h-3 fill-current" />
                  <span>Reveal</span>
                </button>
              </div>
            </div>

            {/* Smooth Progress Bar */}
            <div className="w-full h-2 rounded-full bg-black/50 overflow-hidden">
              <div
                style={{ width: `${timerPct}%` }}
                className={`h-full transition-all duration-500 rounded-full ${
                  wordTimeLeft <= 5
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                    : 'bg-gradient-to-r from-amber-300 via-amber-400 to-emerald-400'
                }`}
              />
            </div>

            <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono text-purple-200/80">
              <span>
                Next word auto-reveals in <strong className="text-amber-300">{wordTimeLeft}s</strong>
              </span>
              <span className="text-emerald-300 font-bold">
                {currentWordSolvers.length} chat {currentWordSolvers.length === 1 ? 'solver' : 'solvers'} locked in
              </span>
            </div>
          </div>

          {/* Stackdown Header Pill ("HOW TO PLAY" + Logo Emblem + "X WORDS REMAINING") */}
          <div className="flex flex-col items-center gap-1 mb-2">
            <div className="flex items-center gap-2.5">
              <img
                src="/assets/aistudio/3d_logo_944e5372.png"
                alt="Game Logo"
                className="w-7 h-7 rounded-full object-contain drop-shadow-md"
              />
              <button
                onClick={onOpenHowToPlay}
                className="px-4 py-1 rounded-full bg-white text-[#3b0d47] font-extrabold text-[11px] tracking-wider uppercase shadow-[0_3px_0_rgba(0,0,0,0.3)] hover:bg-amber-50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                HOW TO PLAY
              </button>
            </div>
            <div className="text-purple-100/90 text-xs tracking-widest uppercase font-medium mt-0.5 flex items-center gap-2">
              <span>
                <strong className="font-black text-amber-300 tabular-nums">{wordsRemaining}</strong>{' '}
                {wordsRemaining === 1 ? 'WORD REMAINING' : 'WORDS REMAINING'}
              </span>
              <span aria-hidden="true" className="text-purple-300/40">·</span>
              <span className="text-xs text-amber-300/90 font-bold">
                WORD #{Math.min(currentWordIndex + 1, puzzle.words.length)} OF {puzzle.words.length}
              </span>
            </div>
          </div>

          {/* Recessed Square Stack Board — 4-Layer (30 Tiles) or 6-Layer Hard Mode (50 Tiles) */}
          <div className="relative w-full aspect-square bg-[#360b42] dark:bg-[#16041c] border border-purple-400/15 rounded-2xl shadow-[inset_0_5px_14px_rgba(0,0,0,0.45)] p-2.5 sm:p-4 overflow-hidden">
            {tiles.map((tile) => {
              if (tile.isCleared || tile.inRackIndex !== null) return null;

              const isExposed = tile.isExposed;

              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => handleTileClick(tile)}
                  disabled={!isExposed}
                  aria-label={`Tile ${tile.letter}, layer ${tile.layer + 1}, ${
                    isExposed ? 'exposed' : 'covered'
                  }`}
                  style={{
                    left: `${tile.x}%`,
                    top: `${tile.y}%`,
                    width: tileSizePct,
                    height: tileSizePct,
                    zIndex: tile.layer * 10 + (isExposed ? 5 : 0),
                  }}
                  className={`-translate-x-1/2 -translate-y-1/2 absolute rounded-xl flex items-center justify-center font-extrabold ${
                    isHardMode ? 'text-base sm:text-xl' : 'text-xl sm:text-2xl'
                  } tracking-tight transition-transform duration-150 ${
                    isExposed
                      ? 'bg-[#fbf6e8] hover:bg-white text-[#231929] border border-amber-300/70 shadow-[0_5px_0_#7c581e,0_8px_15px_rgba(0,0,0,0.38)] hover:scale-[1.06] active:scale-[0.97] cursor-pointer'
                      : 'bg-[#bfa97a] dark:bg-[#8f7b53] text-[#2c2233] shadow-[0_5px_0_rgba(0,0,0,0.52),0_4px_8px_rgba(0,0,0,0.3)] cursor-default'
                  }`}
                >
                  <span className="-mt-0.5 select-none">{tile.letter}</span>
                </button>
              );
            })}
          </div>

          {/* Status Toast if invalid word, chat solve, or word revealed */}
          <div className="min-h-[22px] mt-1.5 flex items-center justify-center text-center px-2">
            {statusMessage ? (
              <span className="text-xs font-bold text-amber-200 tracking-wide animate-fadeIn">
                {statusMessage}
              </span>
            ) : isShowingCompletedWord ? (
              <span className="text-xs font-bold text-amber-300 tracking-wider uppercase flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Word Revealed: {completedWordLetters?.join('')}
              </span>
            ) : null}
          </div>

          {/* 5-Letter Slot Rack */}
          <div
            key={isShowingCompletedWord ? `gold-${goldFlashKey}` : 'active-rack'}
            className={`w-full grid grid-cols-5 gap-2.5 sm:gap-3 mt-1 mb-3 px-1 ${
              isErrorShake ? 'animate-shake' : ''
            }`}
          >
            {[0, 1, 2, 3, 4].map((idx) => {
              const activeTile = rack[idx];
              const completedLetter = isShowingCompletedWord ? completedWordLetters?.[idx] : null;
              const displayLetter = activeTile ? activeTile.letter : completedLetter;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (activeTile) handleRackClick(idx);
                  }}
                  disabled={!activeTile}
                  className={`aspect-square rounded-xl flex items-center justify-center font-extrabold text-xl sm:text-2xl transition-all duration-150 ${
                    isShowingCompletedWord && completedLetter
                      ? 'bg-gradient-to-b from-[#fffbeb] to-[#fef08a] text-[#2d0938] border-[3px] border-amber-400 animate-gold-flash cursor-default'
                      : activeTile
                      ? 'bg-[#fbf6e8] hover:bg-white text-[#231929] border-2 border-amber-300 shadow-[0_5px_0_#7c581e] animate-tile-pop cursor-pointer'
                      : 'bg-[#360b42] dark:bg-[#16041c] border border-purple-400/15 shadow-[inset_0_2px_6px_rgba(0,0,0,0.38)] cursor-default'
                  }`}
                >
                  {displayLetter ? <span className="-mt-0.5">{displayLetter}</span> : null}
                </button>
              );
            })}
          </div>

          {/* Bottom Swipe-to-Reveal Hint Pill */}
          <div className="w-full px-1">
            {showHintText ? (
              <div className="w-full min-h-[44px] px-4 py-2.5 rounded-full bg-white text-[#2d0938] border-2 border-amber-400 text-xs sm:text-sm font-bold text-center shadow-[0_4px_0_rgba(0,0,0,0.3)] flex items-center justify-center animate-tile-pop">
                💡 Hint: {currentHint}
              </div>
            ) : (
              <div
                ref={swipeTrackRef}
                onPointerDown={handlePointerDownHint}
                onPointerMove={handlePointerMoveHint}
                onPointerUp={handlePointerUpHint}
                onPointerCancel={handlePointerUpHint}
                className="relative w-full h-11 rounded-full bg-[#360b42] dark:bg-[#16041c] border border-purple-400/20 shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)] flex items-center justify-center cursor-pointer overflow-hidden touch-none"
              >
                <span className="text-[11px] font-bold tracking-widest uppercase text-purple-200/50 pointer-events-none pl-8">
                  SWIPE TO REVEAL CLUE FOR CHAT
                </span>

                <div
                  style={{
                    transform: `translateX(${swipeProgress * 220}px)`,
                  }}
                  className="absolute left-1.5 w-8 h-8 rounded-full bg-gradient-to-b from-white to-slate-100 border border-amber-300 shadow-md flex items-center justify-center transition-transform duration-75"
                >
                  <Lightbulb className="w-4 h-4 text-amber-500 fill-amber-400" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* RIGHT COLUMN (7 cols on lg): Running Scoreboard + Live TikTok Chat    */}
        {/* ===================================================================== */}
        <div className="lg:col-span-7 w-full">
          <TikTokLivePanel
            tiktokUsername={tiktokUsername}
            isConnected={isLiveConnected}
            roomId={roomId}
            scoreboard={scoreboard}
            chatFeed={chatFeed}
            currentWordIndex={currentWordIndex}
            totalWords={puzzle.words.length}
            targetWord={targetWord}
            currentWordSolvers={currentWordSolvers}
            onOpenConnectModal={onOpenConnectModal}
            onResetScoreboard={onResetScoreboard}
            onSimulateChat={onSimulateChat}
            onSimulateWave={handleSimulateWave}
          />
        </div>
      </div>
    </div>
  );
};
