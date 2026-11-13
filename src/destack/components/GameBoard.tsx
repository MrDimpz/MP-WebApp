import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lightbulb, RotateCcw, ArrowLeft, Flame, Layers } from 'lucide-react';
import { WordPuzzle, TileData, GameState, DifficultyMode } from '../types';
import { soundManager } from '../utils/audio';

interface GameBoardProps {
  puzzle: WordPuzzle;
  difficulty: DifficultyMode;
  onChangeDifficulty: (mode: DifficultyMode) => void;
  onVictory: (timeSeconds: number, hintsUsed: number, score: number, words: string[]) => void;
  setCurrentView: (view: GameState) => void;
  onOpenHowToPlay: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  puzzle,
  difficulty,
  onChangeDifficulty,
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

  // Swipe-to-reveal hint state
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isDraggingHint, setIsDraggingHint] = useState(false);
  const swipeTrackRef = useRef<HTMLDivElement | null>(null);

  // Reset board if puzzle date or difficulty changes
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
  }, [puzzle]);

  const targetWord = puzzle.words[currentWordIndex] || '';
  const currentHint = puzzle.hints[currentWordIndex] || 'Find the next 5-letter word in the stack.';

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSeconds(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Recompute which tiles are exposed based on cleared tiles and tiles currently in the rack
  const recomputeExposed = useCallback((currentTiles: TileData[], currentRack: Array<TileData | null>) => {
    const rackIds = new Set(currentRack.filter(Boolean).map(t => t!.id));
    const clearedIds = new Set(currentTiles.filter(t => t.isCleared).map(t => t.id));

    return currentTiles.map(tile => {
      if (tile.isCleared) {
        return { ...tile, isExposed: false, inRackIndex: null };
      }
      const rIdx = currentRack.findIndex(r => r?.id === tile.id);
      if (rIdx !== -1) {
        return { ...tile, isExposed: false, inRackIndex: rIdx };
      }
      const isStillCovered = tile.coveredBy.some(
        covId => !clearedIds.has(covId) && !rackIds.has(covId)
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
      const formedWord = currentRack.map(t => t?.letter || '').join('');

      if (formedWord === targetWord) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([25, 40, 35]);
        }
        soundManager.playWordCorrect();

        const clearedIds = new Set(currentRack.map(t => t!.id));
        const updatedTiles = currentTiles.map(t =>
          clearedIds.has(t.id) ? { ...t, isCleared: true, isExposed: false, inRackIndex: null } : t
        );

        const nextWordsFound = [...wordsFound, targetWord];
        const emptyRack: Array<TileData | null> = [null, null, null, null, null];

        // Keep the found word visible in the 5 boxes with a flashing gold border
        // until the player selects the first letter of the next word!
        setCompletedWordLetters(formedWord.split(''));
        setGoldFlashKey(prev => prev + 1);
        setWordsFound(nextWordsFound);
        setRack(emptyRack);
        setShowHintText(false);
        setSwipeProgress(0);
        setTiles(recomputeExposed(updatedTiles, emptyRack));

        if (currentWordIndex + 1 >= puzzle.words.length) {
          setTimeout(() => {
            soundManager.playVictory();
            const maxBase = difficulty === 'hard' ? 2800 : 1800;
            const minBase = difficulty === 'hard' ? 900 : 500;
            const baseScore = Math.max(minBase, maxBase - timeSeconds * 3 - hintsUsed * 150);
            onVictory(timeSeconds, hintsUsed, baseScore, nextWordsFound);
          }, 850);
        } else {
          setCurrentWordIndex(prev => prev + 1);
        }
      } else {
        // Invalid word — shake rack and return tiles back to the Stack automatically
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
    [targetWord, wordsFound, currentWordIndex, puzzle.words.length, difficulty, timeSeconds, hintsUsed, onVictory, recomputeExposed]
  );

  // Pick an exposed tile from the stack into the next open rack slot
  const handleTileClick = useCallback(
    (tile: TileData) => {
      if (!tile.isExposed || tile.isCleared || isErrorShake) return;

      const emptyIndex = rack.findIndex(slot => slot === null);
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

      if (newRack.every(slot => slot !== null)) {
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

      // Clear clicked slot and all subsequent slots in the rack
      const newRack = rack.map((item, idx) => (idx >= rackIndex ? null : item));
      setRack(newRack);

      const newTiles = recomputeExposed(tiles, newRack);
      setTiles(newTiles);
    },
    [rack, tiles, isErrorShake, recomputeExposed]
  );

  // Keyboard support: A-Z picks an exposed tile, Backspace returns last rack tile
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key)) {
        const matchingTile = tiles
          .filter(t => t.isExposed && !t.isCleared && t.inRackIndex === null && t.letter === key)
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
    if (!showHintText) {
      setHintsUsed(prev => prev + 1);
      setShowHintText(true);
      setSwipeProgress(1);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(20);
      }
    }
  };

  // Pointer drag handling for "SWIPE TO REVEAL HINT"
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
  };

  const wordsRemaining = puzzle.words.length - wordsFound.length;
  const isShowingCompletedWord = rack.every(t => t === null) && completedWordLetters !== null;
  const isHardMode = difficulty === 'hard';
  const tileSizePct = isHardMode ? '11.4%' : '16.2%';

  return (
    <div className="relative flex-1 w-full bg-[#4a1259] dark:bg-[#22072b] flex flex-col items-center justify-center px-3 py-4 sm:py-6 select-none transition-colors overflow-hidden">
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

      {/* Main Stackdown Card Shell */}
      <div className="relative z-10 w-full max-w-[460px] flex flex-col items-center">
        {/* Top Utility Strip (Exit / Difficulty Switch / Timer / Reset) */}
        <div className="w-full flex items-center justify-between px-1 mb-2.5 text-purple-100/85 text-xs font-semibold">
          <button
            onClick={() => setCurrentView('TITLE')}
            className="inline-flex items-center gap-1 hover:text-amber-300 transition-colors py-1"
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

          <div className="flex items-center gap-2.5 font-mono tabular-nums">
            <span className="text-amber-300/90">
              {Math.floor(timeSeconds / 60)}:{timeSeconds % 60 < 10 ? '0' : ''}
              {timeSeconds % 60}
            </span>
            <button
              onClick={handleReset}
              title="Restart Puzzle"
              className="p-1.5 rounded-lg hover:bg-black/25 text-purple-100 hover:text-amber-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stackdown Header Pill ("HOW TO PLAY" + Logo Emblem + "X WORDS REMAINING") */}
        <div className="flex flex-col items-center gap-1 mb-2.5">
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="Game Logo"
              className="w-8 h-8 rounded-full object-contain drop-shadow-md"
            />
            <button
              onClick={onOpenHowToPlay}
              className="px-5 py-1.5 rounded-full bg-white text-[#3b0d47] font-extrabold text-xs tracking-wider uppercase shadow-[0_3px_0_rgba(0,0,0,0.3)] hover:bg-amber-50 hover:scale-105 active:scale-95 transition-all"
            >
              HOW TO PLAY
            </button>
          </div>
          <div className="text-purple-100/90 text-xs sm:text-sm tracking-widest uppercase font-medium mt-1 flex items-center gap-2">
            <span>
              <strong className="font-black text-amber-300 tabular-nums">{wordsRemaining}</strong>{' '}
              {wordsRemaining === 1 ? 'WORD REMAINING' : 'WORDS REMAINING'}
            </span>
            <span aria-hidden="true" className="text-purple-300/40">·</span>
            <span className="text-xs text-amber-300/90 font-bold">
              {puzzle.totalLayers} LAYERS ({puzzle.tiles.length} TILES)
            </span>
          </div>
        </div>

        {/* Recessed Square Stack Board — 4-Layer (30 Tiles) or 6-Layer Hard Mode (50 Tiles) */}
        <div className="relative w-full aspect-square bg-[#360b42] dark:bg-[#16041c] border border-purple-400/15 rounded-2xl shadow-[inset_0_5px_14px_rgba(0,0,0,0.45)] p-2.5 sm:p-4 overflow-hidden">
          {tiles.map(tile => {
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

        {/* Status Toast if invalid word or word found */}
        <div className="h-5 mt-1.5 flex items-center justify-center">
          {statusMessage ? (
            <span className="text-xs font-bold text-amber-200 tracking-wide animate-fadeIn">
              {statusMessage}
            </span>
          ) : isShowingCompletedWord ? (
            <span className="text-xs font-bold text-amber-300 tracking-wider uppercase">
              ✨ Word Found! Tap next exposed tile to continue
            </span>
          ) : null}
        </div>

        {/* 5-Letter Slot Rack */}
        <div
          key={isShowingCompletedWord ? `gold-${goldFlashKey}` : 'active-rack'}
          className={`w-full grid grid-cols-5 gap-2.5 sm:gap-3 mt-1 mb-4 px-1 ${
            isErrorShake ? 'animate-shake' : ''
          }`}
        >
          {[0, 1, 2, 3, 4].map(idx => {
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
        <div className="w-full px-3">
          {showHintText ? (
            <div className="w-full min-h-[48px] px-5 py-3 rounded-full bg-white text-[#2d0938] border-2 border-amber-400 text-xs sm:text-sm font-bold text-center shadow-[0_4px_0_rgba(0,0,0,0.3)] flex items-center justify-center animate-tile-pop">
              {currentHint}
            </div>
          ) : (
            <div
              ref={swipeTrackRef}
              onPointerDown={handlePointerDownHint}
              onPointerMove={handlePointerMoveHint}
              onPointerUp={handlePointerUpHint}
              onPointerCancel={handlePointerUpHint}
              className="relative w-full h-12 rounded-full bg-[#360b42] dark:bg-[#16041c] border border-purple-400/20 shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)] flex items-center justify-center cursor-pointer overflow-hidden touch-none"
            >
              <span className="text-[11px] sm:text-xs font-bold tracking-widest uppercase text-purple-200/50 pointer-events-none pl-8">
                SWIPE TO REVEAL HINT
              </span>

              {/* Draggable / Clickable Lightbulb Knob */}
              <div
                style={{
                  transform: `translateX(${swipeProgress * 220}px)`,
                }}
                className="absolute left-1.5 w-9 h-9 rounded-full bg-gradient-to-b from-white to-slate-100 border border-amber-300 shadow-md flex items-center justify-center transition-transform duration-75"
              >
                <Lightbulb className="w-5 h-5 text-amber-500 fill-amber-400" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
