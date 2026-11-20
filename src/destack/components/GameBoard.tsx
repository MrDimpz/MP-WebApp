import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lightbulb, RotateCcw, ArrowLeft, Flame, Layers, Sparkles } from 'lucide-react';
import { WordPuzzle, TileData, GameState, DifficultyMode, LayoutSelection } from '../types';
import { soundManager } from '../utils/audio';

interface GameBoardProps {
  puzzle: WordPuzzle;
  difficulty: DifficultyMode;
  onChangeDifficulty: (mode: DifficultyMode) => void;
  layoutSelection: LayoutSelection;
  onChangeLayout: (layout: LayoutSelection) => void;
  onVictory: (timeSeconds: number, hintsUsed: number, score: number, words: string[]) => void;
  setCurrentView: (view: GameState) => void;
  onOpenHowToPlay: () => void;
}

const LAYER_KEY_ITEMS = [
  { label: 'L1', color: 'bg-[#ffb703] border-[#ffd166]' },
  { label: 'L2', color: 'bg-[#2bff88] border-[#7dffb3]' },
  { label: 'L3', color: 'bg-[#19e4ff] border-[#75f0ff]' },
  { label: 'L4', color: 'bg-[#e08aff] border-[#f0c2ff]' },
  { label: 'L5', color: 'bg-[#ff5c97] border-[#ff99be]' },
  { label: 'L6', color: 'bg-[#fff34d] border-[#fff999]' },
];

const getLayerOutlineClass = (layer: number, isExposed: boolean) => {
  const bgClass = isExposed
    ? 'bg-[#fbf6e8] hover:bg-white text-[#231929] shadow-[0_5px_0_#7c581e,0_8px_15px_rgba(0,0,0,0.38)]'
    : 'bg-[#241136] dark:bg-[#190926] text-[#fff8e7] shadow-[0_4px_0_rgba(0,0,0,0.55)]';

  switch (layer) {
    case 0:
      return `border-[3px] border-[#ffb703] ${bgClass}`;
    case 1:
      return `border-[3px] border-[#2bff88] ${bgClass}`;
    case 2:
      return `border-[3px] border-[#19e4ff] ${bgClass}`;
    case 3:
      return `border-[3px] border-[#e08aff] ${bgClass}`;
    case 4:
      return `border-[3px] border-[#ff5c97] ${bgClass}`;
    case 5:
      return `border-[3px] border-[#fff34d] ${bgClass}`;
    default:
      return `border-[3px] border-[#ffd166] ${bgClass}`;
  }
};

export const GameBoard: React.FC<GameBoardProps> = ({
  puzzle,
  difficulty,
  onChangeDifficulty,
  layoutSelection,
  onChangeLayout,
  onVictory,
  setCurrentView,
  onOpenHowToPlay,
}) => {
  const [tiles, setTiles] = useState<TileData[]>(() => JSON.parse(JSON.stringify(puzzle.tiles)));
  const [rack, setRack] = useState<Array<TileData | null>>([null, null, null, null, null]);
  // Holds the 5 letters of a just-found word so it stays visible in the rack boxes with a gold border until the next letter is picked
  const [completedWordLetters, setCompletedWordLetters] = useState<string[] | null>(null);
  const [goldFlashKey, setGoldFlashKey] = useState(0);

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [wordsFound, setWordsFound] = useState<string[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHintText, setShowHintText] = useState(false);
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [isErrorShake, setIsErrorShake] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [resetCount, setResetCount] = useState(0);

  const isRoundFinishedRef = useRef<boolean>(false);
  const timeSecondsRef = useRef<number>(0);
  const hintsUsedRef = useRef<number>(0);

  // Swipe-to-reveal hint state
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isDraggingHint, setIsDraggingHint] = useState(false);
  const swipeTrackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    timeSecondsRef.current = timeSeconds;
  }, [timeSeconds]);

  useEffect(() => {
    hintsUsedRef.current = hintsUsed;
  }, [hintsUsed]);

  // Reset board if puzzle date, difficulty, or layout changes
  useEffect(() => {
    setTiles(JSON.parse(JSON.stringify(puzzle.tiles)));
    setRack([null, null, null, null, null]);
    setCompletedWordLetters(null);
    setCurrentWordIndex(0);
    setWordsFound([]);
    setHintsUsed(0);
    hintsUsedRef.current = 0;
    setShowHintText(false);
    setTimeSeconds(0);
    timeSecondsRef.current = 0;
    setSwipeProgress(0);
    setStatusMessage(null);
    setIsErrorShake(false);
    isRoundFinishedRef.current = false;
  }, [puzzle]);

  const targetWord = puzzle.words[currentWordIndex] || '';
  const currentHint = puzzle.hints[currentWordIndex] || 'Find the next 5-letter word in the stack.';

  // Timer effect (pauses once the final word is completed)
  useEffect(() => {
    const timer = setInterval(() => {
      if (isRoundFinishedRef.current) return;
      setTimeSeconds((t) => {
        const next = t + 1;
        timeSecondsRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Recompute which tiles are exposed based on cleared tiles and tiles currently in the rack
  const recomputeExposed = useCallback((currentTiles: TileData[], currentRack: Array<TileData | null>) => {
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
  }, []);

  // Validate 5-letter word when rack fills up
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
          clearedIds.has(t.id) ? { ...t, isCleared: true, isExposed: false, inRackIndex: null } : t
        );

        const nextWordsFound = [...wordsFound, targetWord];
        const emptyRack: Array<TileData | null> = [null, null, null, null, null];

        // Keep the found word visible in the 5 boxes with a flashing gold border
        // until the player selects the first letter of the next word
        setCompletedWordLetters(formedWord.split(''));
        setGoldFlashKey((prev) => prev + 1);
        setWordsFound(nextWordsFound);
        setRack(emptyRack);
        setShowHintText(false);
        setSwipeProgress(0);
        setStatusMessage(null);
        setTiles(recomputeExposed(updatedTiles, emptyRack));

        if (currentWordIndex + 1 >= puzzle.words.length) {
          isRoundFinishedRef.current = true;
          const finalTime = timeSecondsRef.current;
          const finalHints = hintsUsedRef.current;
          setTimeout(() => {
            soundManager.playVictory();
            const maxBase = difficulty === 'hard' ? 2800 : 1800;
            const minBase = difficulty === 'hard' ? 900 : 500;
            const baseScore = Math.max(minBase, maxBase - finalTime * 3 - finalHints * 150);
            onVictory(finalTime, finalHints, baseScore, nextWordsFound);
          }, 850);
        } else {
          setCurrentWordIndex((prev) => prev + 1);
        }
      } else {
        // Invalid word — shake rack and return tiles back to the Stack automatically
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([45, 45, 45]);
        }
        soundManager.playError();
        setIsErrorShake(true);
        setStatusMessage(`"${formedWord}" is not the word — returning tiles`);

        setTimeout(() => {
          setIsErrorShake(false);
          setStatusMessage(null);
          const emptyRack: Array<TileData | null> = [null, null, null, null, null];
          setRack(emptyRack);
          setTiles(recomputeExposed(currentTiles, emptyRack));
        }, 620);
      }
    },
    [targetWord, wordsFound, currentWordIndex, puzzle.words.length, difficulty, onVictory, recomputeExposed]
  );

  // Pick an exposed tile from the stack into the next open rack slot
  const handleTileClick = useCallback(
    (tile: TileData) => {
      if (isRoundFinishedRef.current || !tile.isExposed || tile.isCleared || isErrorShake) return;

      const emptyIndex = rack.findIndex((slot) => slot === null);
      if (emptyIndex === -1) return;

      // If the previous found word was still displayed in the boxes, clear it now as the new word begins
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
      if (isRoundFinishedRef.current || !rack[rackIndex] || isErrorShake) return;

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
      soundManager.playTileReturn();

      // Clear clicked slot and all subsequent slots in the rack
      const newRack = rack.map((item, idx) => (idx >= rackIndex ? null : item));
      setRack(newRack);

      const newTiles = recomputeExposed(tiles, newRack);
      setTiles(newTiles);
    },
    [rack, tiles, isErrorShake, recomputeExposed]
  );

  // Keyboard support: A-Z picks an exposed tile when not typing in an input, Backspace returns last rack tile
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
      if (e.ctrlKey || e.metaKey || e.altKey || isRoundFinishedRef.current) return;
      const key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key)) {
        const matchingTile = tiles
          .filter((t) => t.isExposed && !t.isCleared && t.inRackIndex === null && t.letter === key)
          .sort((a, b) => b.layer - a.layer)[0];
        if (matchingTile) {
          handleTileClick(matchingTile);
        }
      } else if (e.key === 'Backspace') {
        const lastFilledIdx = rack.reduce((acc, item, idx) => (item !== null ? idx : acc), -1);
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
    if (isRoundFinishedRef.current) return;
    if (!showHintText) {
      setHintsUsed((prev) => {
        const next = prev + 1;
        hintsUsedRef.current = next;
        return next;
      });
      setShowHintText(true);
      setSwipeProgress(1);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(20);
      }
    }
  };

  // Pointer drag handling for "SWIPE TO REVEAL HINT"
  const handlePointerDownHint = (e: React.PointerEvent) => {
    if (showHintText || isRoundFinishedRef.current) return;
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
    setStatusMessage(null);
    setIsErrorShake(false);
    isRoundFinishedRef.current = false;
    setResetCount((prev) => prev + 1);
  };

  const boardEntranceKey = `${difficulty}-${layoutSelection}-${puzzle.words.join(',')}-${resetCount}`;
  const wordsRemaining = Math.max(0, puzzle.words.length - wordsFound.length);
  const isShowingCompletedWord = rack.every((t) => t === null) && completedWordLetters !== null;
  const isHardMode = difficulty === 'hard';
  const tileSizePct = isHardMode ? '10.2%' : '13.6%';

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

      {/* Main DeStack Card Shell — Aligned with DeStack Interactive Board */}
      <div className="relative z-10 w-full max-w-[550px] mx-auto flex flex-col items-center">
        {/* Top Utility Strip (Exit / Difficulty Switch / Elapsed Time / Reset) */}
        <div className="w-full flex items-center justify-between px-1 mb-2 text-purple-100/85 text-xs font-semibold">
          <button
            onClick={() => setCurrentView('TITLE')}
            className="inline-flex items-center gap-1 hover:text-amber-300 transition-colors py-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Menu
          </button>

          {/* Normal (4 Layers) vs Hard Mode (6 Layers) Toggle */}
          <div className="flex items-center p-0.5 rounded-xl bg-[#360b42] dark:bg-[#16041c] border border-purple-300/50">
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
            <span className="text-amber-300/90 text-[11px]">
              {Math.floor(timeSeconds / 60)}:{timeSeconds % 60 < 10 ? '0' : ''}
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

        {/* Layout Mode Selector Bar */}
        <div className="w-full flex items-center justify-between gap-1 mb-2.5 px-1 overflow-x-auto py-0.5">
          <span className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Layers className="w-3 h-3 text-amber-400" /> Layout:
          </span>
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'daily', label: 'Daily' },
                { id: 'pyramid', label: 'Diamond' },
                { id: 'twin_towers', label: 'Towers' },
                { id: 'cross_fortress', label: 'Fortress' },
                { id: 'hourglass', label: 'Hourglass' },
                { id: 'staircase', label: 'Cascade' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeLayout(item.id)}
                className={`px-2 py-1 rounded-md text-[10px] font-extrabold transition-all cursor-pointer border whitespace-nowrap ${
                  layoutSelection === item.id
                    ? 'bg-amber-400 text-[#2d0938] border-amber-300 shadow-sm'
                    : 'bg-black/30 text-purple-200 border-white/10 hover:border-amber-400'
                }`}
              >
                {item.label}
              </button>
            ))}
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
          <div className="text-purple-100/90 text-xs tracking-widest uppercase font-medium mt-0.5 flex flex-wrap items-center justify-center gap-2">
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
        <div className="relative w-full aspect-square bg-[#360b42] dark:bg-[#16041c] border-2 border-purple-300/45 rounded-2xl shadow-[inset_0_5px_14px_rgba(0,0,0,0.45)] p-[36px] sm:p-[44px] overflow-hidden pt-18 sm:pt-22">
          {/* Centered Logo Watermark (94% of board at 20% opacity) */}
          <div
            aria-hidden="true"
            className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none select-none"
          >
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt=""
              className="w-[94%] h-[94%] object-contain opacity-20"
            />
          </div>

          {/* Layer Key Bar Above Tiles But On The Board */}
          <div className="absolute top-2 left-2 right-2 z-30 flex items-center justify-center gap-1 sm:gap-1.5 bg-black/50 backdrop-blur-md px-2 py-1 rounded-xl border border-purple-200/35 text-[10px] text-purple-100 font-bold overflow-x-auto no-scrollbar">
            <span className="text-amber-300 uppercase tracking-wider text-[9px] font-black shrink-0">Layer Key:</span>
            {Array.from({ length: puzzle.totalLayers }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-1 shrink-0 px-1 py-0.5 rounded bg-white/5 border border-white/25">
                <span className={`w-2.5 h-2.5 rounded-full border ${LAYER_KEY_ITEMS[idx]?.color || 'bg-[#ffd166] border-[#fff099]'}`} />
                <span>L{idx + 1}</span>
              </div>
            ))}
          </div>

          <div key={boardEntranceKey} className="contents">
            {tiles.map((tile, idx) => {
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
                    '--tile-delay': `${Math.min(idx, 30) * 14}ms`,
                  } as React.CSSProperties}
                  className={`puzzle-tile-enter -translate-x-1/2 -translate-y-1/2 absolute rounded-xl flex items-center justify-center font-extrabold ${
                    isHardMode ? 'text-xs sm:text-[15px]' : 'text-lg sm:text-2xl'
                  } tracking-tight transition-transform duration-150 ${getLayerOutlineClass(
                    tile.layer,
                    isExposed
                  )} ${isExposed ? 'hover:scale-[1.06] active:scale-[0.97] cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="select-none">{tile.letter}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Toast if invalid word or word found */}
        <div className="min-h-[22px] mt-1.5 flex items-center justify-center text-center px-2">
          {statusMessage ? (
            <span className="text-xs font-bold text-amber-200 tracking-wide animate-fadeIn">
              {statusMessage}
            </span>
          ) : isShowingCompletedWord ? (
            <span className="text-xs font-bold text-amber-300 tracking-wider uppercase flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Word Found: {completedWordLetters?.join('')}
            </span>
          ) : null}
        </div>

        {/* 5-Letter Slot Rack (Guess Bar) */}
        <div
          key={isShowingCompletedWord ? `gold-${goldFlashKey}` : 'active-rack'}
          className={`w-full grid grid-cols-5 gap-2.5 sm:gap-3 mt-1 mb-2.5 px-1 ${
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
                    ? 'bg-[#fbf6e8] hover:bg-white text-[#231929] border-2 border-[#fff04d] shadow-[0_5px_0_#7c581e] animate-tile-pop cursor-pointer'
                    : 'bg-[#360b42] dark:bg-[#16041c] border border-purple-300/45 shadow-[inset_0_2px_6px_rgba(0,0,0,0.38)] cursor-default'
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
            <div className="w-full min-h-[44px] px-4 py-2.5 rounded-full bg-white text-[#2d0938] border-2 border-amber-400 text-xs sm:text-sm font-bold text-center shadow-[0_4px_0_rgba(0,0,0,0.3)] flex items-center justify-center gap-2 flex-wrap animate-tile-pop">
              <span>💡 Hint: {currentHint}</span>
            </div>
          ) : (
            <div
              ref={swipeTrackRef}
              onPointerDown={handlePointerDownHint}
              onPointerMove={handlePointerMoveHint}
              onPointerUp={handlePointerUpHint}
              onPointerCancel={handlePointerUpHint}
              className="relative w-full h-11 rounded-full bg-[#360b42] dark:bg-[#16041c] border border-purple-300/45 shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)] flex items-center justify-center cursor-pointer overflow-hidden touch-none"
            >
              <span className="text-[11px] font-bold tracking-widest uppercase text-purple-200/50 pointer-events-none pl-8">
                SWIPE TO REVEAL HINT
              </span>

              {/* Draggable / Clickable Lightbulb Knob */}
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
    </div>
  );
};
