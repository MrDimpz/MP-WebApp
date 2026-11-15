import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CellCoord, DailyPuzzle } from '../utils/puzzleGenerator';
import { soundFX } from '../utils/sound';

interface WordSearchBoardProps {
  puzzle: DailyPuzzle;
  foundWords: string[];
  onWordFound: (word: string) => void;
  hintTargetWord: string | null;
  hintTier: number; // 0 = none, 1 = orientation, 2 = row/col, 3 = first letter beacon, 4 = full word path
  largePrint: boolean;
  disabled?: boolean;
  boardOverlay?: React.ReactNode;
}

const COLUMN_HEADERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// High-contrast accessible capsule colors tuned for The Missing Piece Light & Dark themes (12 colors for 8-12 words)
const CAPSULE_STROKES_LIGHT = [
  'rgba(245, 158, 11, 0.42)', // Sovereign Gold
  'rgba(147, 51, 234, 0.36)', // Royal Purple
  'rgba(16, 185, 129, 0.38)', // Emerald
  'rgba(59, 130, 246, 0.36)', // Sapphire Blue
  'rgba(236, 72, 153, 0.36)', // Magenta Rose
  'rgba(20, 184, 166, 0.38)', // Teal
  'rgba(249, 115, 22, 0.38)', // Amber Orange
  'rgba(99, 102, 241, 0.36)', // Indigo
  'rgba(220, 38, 38, 0.34)',  // Crimson
  'rgba(132, 204, 22, 0.38)', // Lime
  'rgba(6, 182, 212, 0.38)',  // Cyan
  'rgba(168, 85, 247, 0.36)', // Violet
];

const CAPSULE_STROKES_DARK = [
  'rgba(250, 204, 21, 0.46)', // Sovereign Gold
  'rgba(192, 132, 252, 0.44)', // Royal Purple
  'rgba(52, 211, 153, 0.44)', // Emerald
  'rgba(96, 165, 250, 0.44)', // Sapphire Blue
  'rgba(244, 114, 182, 0.42)', // Magenta Rose
  'rgba(45, 212, 191, 0.44)', // Teal
  'rgba(251, 146, 60, 0.44)', // Amber Orange
  'rgba(129, 140, 248, 0.44)', // Indigo
  'rgba(248, 113, 113, 0.42)', // Coral Red
  'rgba(163, 230, 53, 0.42)', // Chartreuse
  'rgba(34, 211, 238, 0.42)', // Sky Cyan
  'rgba(216, 180, 254, 0.42)', // Lavender
];

// Compute cells along a valid 8-way straight line (Horizontal, Vertical, or 45-deg Diagonal)
function computeLineCells(start: CellCoord, target: CellCoord): CellCoord[] {
  const dRow = target.row - start.row;
  const dCol = target.col - start.col;

  if (dRow === 0 && dCol === 0) {
    return [start];
  }

  // Snap to nearest 45-degree angle for forgiving touch/mouse dragging
  const angle = Math.atan2(dRow, dCol);
  const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  const stepR = Math.round(Math.sin(snappedAngle));
  const stepC = Math.round(Math.cos(snappedAngle));

  const distance = Math.max(Math.abs(dRow), Math.abs(dCol));
  const cells: CellCoord[] = [];

  for (let i = 0; i <= distance; i++) {
    const r = start.row + stepR * i;
    const c = start.col + stepC * i;
    if (r < 0 || r >= 10 || c < 0 || c >= 10) break;
    cells.push({ row: r, col: c });
  }

  return cells;
}

export const WordSearchBoard: React.FC<WordSearchBoardProps> = ({
  puzzle,
  foundWords,
  onWordFound,
  hintTargetWord,
  hintTier,
  largePrint,
  disabled = false,
  boardOverlay,
}) => {
  const [dragStart, setDragStart] = useState<CellCoord | null>(null);
  const [dragCurrent, setDragCurrent] = useState<CellCoord | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tapAnchor, setTapAnchor] = useState<CellCoord | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const lastStepLenRef = useRef<number>(0);

  // Track newly discovered words to trigger a smooth highlight burst + fade-out animation
  const [recentBursts, setRecentBursts] = useState<{ word: string; burstId: string }[]>([]);
  const prevPuzzleDateRef = useRef<string>(puzzle.dateKey);
  const prevFoundSetRef = useRef<Set<string>>(new Set(foundWords));

  useEffect(() => {
    // If switching puzzles or resetting the board, sync refs without firing burst animations
    if (prevPuzzleDateRef.current !== puzzle.dateKey || foundWords.length === 0) {
      prevPuzzleDateRef.current = puzzle.dateKey;
      prevFoundSetRef.current = new Set(foundWords);
      setRecentBursts([]);
      return;
    }

    const newlyAdded = foundWords.filter((w) => !prevFoundSetRef.current.has(w));
    if (newlyAdded.length === 0) return;

    prevFoundSetRef.current = new Set(foundWords);
    const now = Date.now();
    const newEntries = newlyAdded.map((w) => ({
      word: w,
      burstId: `${w}_${now}`,
    }));

    setRecentBursts((prev) => [...prev, ...newEntries]);

    const timer = window.setTimeout(() => {
      const expireIds = new Set(newEntries.map((e) => e.burstId));
      setRecentBursts((prev) => prev.filter((item) => !expireIds.has(item.burstId)));
    }, 1750);

    return () => window.clearTimeout(timer);
  }, [foundWords, puzzle.dateKey]);

  // Map each cell coordinate ("r,c") of a newly discovered word to its staggered letter index
  const burstCellMap = React.useMemo(() => {
    const map = new Map<string, { stepIndex: number; burstId: string }>();
    recentBursts.forEach(({ word, burstId }) => {
      const pw = puzzle.words.find((w) => w.word === word);
      if (!pw) return;
      pw.cells.forEach((cell, idx) => {
        map.set(`${cell.row},${cell.col}`, { stepIndex: idx, burstId });
      });
    });
    return map;
  }, [recentBursts, puzzle.words]);

  const activeCells = React.useMemo(() => {
    if (isDragging && dragStart && dragCurrent) {
      return computeLineCells(dragStart, dragCurrent);
    }
    if (tapAnchor && dragCurrent) {
      return computeLineCells(tapAnchor, dragCurrent);
    }
    if (tapAnchor) {
      return [tapAnchor];
    }
    return [];
  }, [isDragging, dragStart, dragCurrent, tapAnchor]);

  const activeWordPreview = React.useMemo(() => {
    const forward = activeCells.map((c) => puzzle.grid[c.row][c.col]).join('');
    if (forward.length < 2) return forward;
    const reversed = forward.split('').reverse().join('');
    const matchesReversed = puzzle.words.some(
      (pw) => !foundWords.includes(pw.word) && pw.word === reversed && pw.word !== forward
    );
    return matchesReversed ? `${forward} (${reversed})` : forward;
  }, [activeCells, puzzle.grid, puzzle.words, foundWords]);

  // Evaluate whether selected cells match any unfound word (forward or reverse)
  const evaluateSelection = useCallback(
    (cells: CellCoord[]): boolean => {
      if (cells.length < 2) return false;
      const forwardStr = cells.map((c) => puzzle.grid[c.row][c.col]).join('');
      const reverseStr = forwardStr.split('').reverse().join('');

      for (const pw of puzzle.words) {
        if (foundWords.includes(pw.word)) continue;
        if (pw.word === forwardStr || pw.word === reverseStr) {
          onWordFound(pw.word);
          return true;
        }
      }
      return false;
    },
    [puzzle, foundWords, onWordFound]
  );

  const getCellFromPointerEvent = (clientX: number, clientY: number): CellCoord | null => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) return null;

    const col = Math.min(9, Math.max(0, Math.floor((relX / rect.width) * 10)));
    const row = Math.min(9, Math.max(0, Math.floor((relY / rect.height) * 10)));
    return { row, col };
  };

  const handlePointerDown = (row: number, col: number, e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    const coord = { row, col };

    // If user previously tapped an anchor cell and now taps another cell, check if it forms a word
    if (tapAnchor && (tapAnchor.row !== row || tapAnchor.col !== col)) {
      const lineCells = computeLineCells(tapAnchor, coord);
      if (evaluateSelection(lineCells)) {
        setTapAnchor(null);
        setDragStart(null);
        setDragCurrent(null);
        setIsDragging(false);
        return;
      }
    }

    setIsDragging(true);
    setDragStart(coord);
    setDragCurrent(coord);
    lastStepLenRef.current = 1;
    soundFX.playTileTap(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (disabled) return;
    const cell = getCellFromPointerEvent(e.clientX, e.clientY);
    if (!cell) return;

    if (isDragging && dragStart) {
      if (!dragCurrent || dragCurrent.row !== cell.row || dragCurrent.col !== cell.col) {
        setDragCurrent(cell);
        const line = computeLineCells(dragStart, cell);
        if (line.length !== lastStepLenRef.current) {
          lastStepLenRef.current = line.length;
          soundFX.playTileTap(line.length - 1);
        }
      }
    } else if (tapAnchor) {
      if (!dragCurrent || dragCurrent.row !== cell.row || dragCurrent.col !== cell.col) {
        setDragCurrent(cell);
      }
    }
  };

  const handlePointerUp = () => {
    if (disabled || !isDragging) return;
    setIsDragging(false);

    if (dragStart && dragCurrent) {
      const moved = dragStart.row !== dragCurrent.row || dragStart.col !== dragCurrent.col;
      if (moved) {
        const lineCells = computeLineCells(dragStart, dragCurrent);
        const matched = evaluateSelection(lineCells);
        if (!matched) {
          soundFX.playInvalidSelection();
        }
        setTapAnchor(null);
      } else {
        // Single cell tap: toggle or set tapAnchor for two-tap selection mode
        if (tapAnchor && tapAnchor.row === dragStart.row && tapAnchor.col === dragStart.col) {
          setTapAnchor(null);
        } else {
          setTapAnchor(dragStart);
        }
      }
    }
    setDragStart(null);
    setDragCurrent(null);
  };

  // Identify hinted word object for Tier 3 & Tier 4 visual overlays
  const hintedWordObj = React.useMemo(() => {
    if (!hintTargetWord || hintTier < 3) return null;
    return puzzle.words.find((w) => w.word === hintTargetWord && !foundWords.includes(w.word)) || null;
  }, [hintTargetWord, hintTier, puzzle.words, foundWords]);

  // Track how many found words overlap at each cell (for '+' and 'X' intersections)
  const foundCellOverlapMap = React.useMemo(() => {
    const map = new Map<string, number>();
    puzzle.words.forEach((pw) => {
      if (foundWords.includes(pw.word)) {
        pw.cells.forEach((c) => {
          const k = `${c.row},${c.col}`;
          map.set(k, (map.get(k) || 0) + 1);
        });
      }
    });
    return map;
  }, [puzzle.words, foundWords]);

  const activeCellSet = React.useMemo(() => {
    const set = new Set<string>();
    activeCells.forEach((c) => set.add(`${c.row},${c.col}`));
    return set;
  }, [activeCells]);

  const hintPathCellSet = React.useMemo(() => {
    const set = new Set<string>();
    if (hintedWordObj && hintTier >= 4) {
      hintedWordObj.cells.forEach((c) => set.add(`${c.row},${c.col}`));
    }
    return set;
  }, [hintedWordObj, hintTier]);

  return (
    <div className="flex flex-col items-center w-full select-none">
      {/* Live Selection Readout Bar above the 10x10 Board */}
      <div className="w-full max-w-[540px] flex items-center justify-between px-3.5 py-2 mb-2.5 rounded-xl bg-white/95 dark:bg-[#220835]/95 border border-purple-200/90 dark:border-purple-800/70 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-purple-200/80">
          <span className="font-bold text-[#3b0d47] dark:text-amber-300">Selection</span>
          <span aria-hidden="true">·</span>
          <span>
            {tapAnchor
              ? `Start locked at ${COLUMN_HEADERS[tapAnchor.col]}${tapAnchor.row + 1} — tap end letter`
              : 'Drag across letters or tap first & last'}
          </span>
        </div>
        <div className="font-mono tabular-nums text-sm font-extrabold tracking-wider text-amber-600 dark:text-amber-400 min-h-[20px]">
          {activeWordPreview || '—'}
        </div>
      </div>

      {/* Board Outer Frame with Column (A-J) & Row (1-10) Coordinates */}
      <div className="relative w-full max-w-[540px] p-2.5 sm:p-4 rounded-2xl bg-white/95 dark:bg-[#1e0631]/95 border-2 border-purple-200/90 dark:border-amber-400/35 shadow-[0_16px_40px_rgba(43,9,56,0.16)] overflow-hidden">
        {/* Subtle 20% Opacity Missing Piece Emblem Watermark */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center z-0"
        >
          <img
            src="/brand-logo.png"
            alt=""
            className="w-3/5 h-3/5 object-contain opacity-20 select-none"
          />
        </div>

        {/* Column Headers A-J */}
        <div className="relative z-10 grid grid-cols-[24px_1fr] sm:grid-cols-[28px_1fr] gap-1.5 mb-1">
          <div aria-hidden="true" />
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5 text-center">
            {COLUMN_HEADERS.map((colChar) => (
              <span
                key={colChar}
                className="font-mono tabular-nums text-[11px] sm:text-xs font-extrabold text-[#581c6b]/70 dark:text-amber-300/75"
              >
                {colChar}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-[24px_1fr] sm:grid-cols-[28px_1fr] gap-1.5 items-center">
          {/* Row Headers 1-10 */}
          <div className="grid grid-rows-10 gap-1 sm:gap-1.5 h-full items-center text-right pr-1">
            {Array.from({ length: 10 }, (_, idx) => (
              <span
                key={idx}
                className="font-mono tabular-nums text-[11px] sm:text-xs font-extrabold text-[#581c6b]/70 dark:text-amber-300/75 flex items-center justify-end h-full"
              >
                {idx + 1}
              </span>
            ))}
          </div>

          {/* 10x10 Interactive Grid + SVG Capsule Overlay */}
          <div
            ref={boardRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="relative aspect-square w-full touch-none"
          >
            {/* SVG Overlay for Found Word Capsules, Highlight Fade-Out Halos & Active Selection Line */}
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
            >
              {/* Settled Found Words Capsules */}
              {puzzle.words.map((pw) => {
                if (!foundWords.includes(pw.word)) return null;
                const x1 = pw.start.col * 10 + 5;
                const y1 = pw.start.row * 10 + 5;
                const x2 = pw.end.col * 10 + 5;
                const y2 = pw.end.row * 10 + 5;
                const colorIdx = pw.colorIndex % CAPSULE_STROKES_LIGHT.length;
                return (
                  <g key={pw.word}>
                    <motion.line
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={CAPSULE_STROKES_LIGHT[colorIdx]}
                      strokeWidth="7.4"
                      strokeLinecap="round"
                      className="dark:hidden"
                    />
                    <motion.line
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={CAPSULE_STROKES_DARK[colorIdx]}
                      strokeWidth="7.4"
                      strokeLinecap="round"
                      className="hidden dark:block"
                    />
                  </g>
                );
              })}

              {/* Newly Found Word Golden Highlight Burst + Smooth Fade-Out Halo */}
              <AnimatePresence>
                {recentBursts.map(({ word, burstId }) => {
                  const pw = puzzle.words.find((w) => w.word === word);
                  if (!pw) return null;
                  const x1 = pw.start.col * 10 + 5;
                  const y1 = pw.start.row * 10 + 5;
                  const x2 = pw.end.col * 10 + 5;
                  const y2 = pw.end.row * 10 + 5;
                  return (
                    <motion.line
                      key={`halo_${burstId}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="rgba(250, 204, 21, 0.95)"
                      strokeLinecap="round"
                      initial={{ opacity: 0.95, strokeWidth: 8.2 }}
                      animate={{ opacity: [0.95, 0.72, 0], strokeWidth: [8.2, 11.4, 12.6] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.45, ease: 'easeOut' }}
                    />
                  );
                })}
              </AnimatePresence>

              {/* Tier 4 Hint Full Path Dashed Line */}
              {hintedWordObj && hintTier >= 4 && (
                <line
                  x1={hintedWordObj.start.col * 10 + 5}
                  y1={hintedWordObj.start.row * 10 + 5}
                  x2={hintedWordObj.end.col * 10 + 5}
                  y2={hintedWordObj.end.row * 10 + 5}
                  stroke="rgba(245, 158, 11, 0.58)"
                  strokeWidth="6.8"
                  strokeDasharray="2.5 1.8"
                  strokeLinecap="round"
                />
              )}

              {/* Active Drag / Selection Capsule */}
              {activeCells.length > 0 && (
                <line
                  x1={activeCells[0].col * 10 + 5}
                  y1={activeCells[0].row * 10 + 5}
                  x2={activeCells[activeCells.length - 1].col * 10 + 5}
                  y2={activeCells[activeCells.length - 1].row * 10 + 5}
                  stroke="rgba(246, 201, 21, 0.52)"
                  strokeWidth="7.8"
                  strokeLinecap="round"
                />
              )}
            </svg>

            {/* Floating Word Discovery Callouts at Word Midpoints (Smooth Rise & Fade-Out) */}
            <AnimatePresence>
              {recentBursts.map(({ word, burstId }) => {
                const pw = puzzle.words.find((w) => w.word === word);
                if (!pw) return null;
                const midColPct = ((pw.start.col + pw.end.col) / 2) * 10 + 5;
                const midRowPct = ((pw.start.row + pw.end.row) / 2) * 10 + 5;
                return (
                  <motion.div
                    key={`badge_${burstId}`}
                    style={{
                      left: `${midColPct}%`,
                      top: `${midRowPct}%`,
                    }}
                    initial={{ opacity: 0, y: 6, scale: 0.82 }}
                    animate={{
                      opacity: [0, 1, 1, 0],
                      y: [6, -6, -16],
                      scale: [0.82, 1.06, 1, 0.94],
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.45, ease: 'easeOut' }}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-30 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-300 text-[#1A052A] font-mono text-[11px] sm:text-xs font-black tracking-wider shadow-[0_6px_20px_rgba(245,158,11,0.55)] border border-white/80 whitespace-nowrap"
                  >
                    ✦ {pw.word} +{pw.word.length * 10}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* 10x10 Button Cells */}
            <div className="grid grid-cols-10 grid-rows-10 gap-1 sm:gap-1.5 w-full h-full">
              {puzzle.grid.map((rowArr, rIdx) =>
                rowArr.map((letter, cIdx) => {
                  const key = `${rIdx},${cIdx}`;
                  const overlapCount = foundCellOverlapMap.get(key) || 0;
                  const isFound = overlapCount > 0;
                  const isCrossIntersection = overlapCount >= 2;
                  const isActive = activeCellSet.has(key);
                  const isTapStart =
                    tapAnchor !== null && tapAnchor.row === rIdx && tapAnchor.col === cIdx;
                  const isHintStart =
                    hintedWordObj !== null &&
                    hintTier >= 3 &&
                    hintedWordObj.start.row === rIdx &&
                    hintedWordObj.start.col === cIdx;
                  const isHintPath = hintPathCellSet.has(key);
                  const burstCell = burstCellMap.get(key);

                  return (
                    <button
                      key={key}
                      type="button"
                      onPointerDown={(e) => handlePointerDown(rIdx, cIdx, e)}
                      aria-label={`Row ${rIdx + 1} Column ${COLUMN_HEADERS[cIdx]}, Letter ${letter}`}
                      className={`relative z-20 flex items-center justify-center w-full h-full min-h-[32px] sm:min-h-[44px] rounded-lg sm:rounded-xl font-black transition-all duration-300 focus-visible:outline-2 focus-visible:outline-amber-500 cursor-pointer overflow-hidden ${
                        largePrint
                          ? 'text-lg sm:text-2xl tracking-wide'
                          : 'text-base sm:text-xl tracking-normal'
                      } ${
                        isActive || isTapStart
                          ? 'bg-amber-400/30 dark:bg-amber-400/30 text-[#2B0938] dark:text-white scale-[1.05] border-2 border-amber-500 dark:border-amber-400 shadow-xs'
                          : isHintStart
                          ? 'bg-amber-100 dark:bg-amber-950/85 text-amber-900 dark:text-amber-200 border-2 border-amber-500 dark:border-amber-400'
                          : isHintPath
                          ? 'bg-amber-50/90 dark:bg-amber-950/45 text-[#2B0938] dark:text-amber-100 border border-amber-400/75'
                          : isCrossIntersection
                          ? 'bg-emerald-500/20 dark:bg-emerald-400/25 text-[#13051F] dark:text-white border-2 border-emerald-500/70 dark:border-emerald-400/70'
                          : isFound
                          ? 'bg-purple-100/80 dark:bg-[#310b4e]/85 text-[#2B0938] dark:text-white border border-purple-300/80 dark:border-purple-600/70'
                          : 'bg-[#FAF6EE]/90 hover:bg-purple-50 dark:bg-[#2a0942]/75 dark:hover:bg-[#380d57] text-[#2B0938] dark:text-purple-50 border border-purple-200/80 dark:border-purple-800/70'
                      }`}
                    >
                      {/* Smooth Staggered Highlight Flash & Fade-Out Overlay when Word is Discovered */}
                      <AnimatePresence>
                        {burstCell && (
                          <motion.span
                            key={`cell_glow_${burstCell.burstId}`}
                            aria-hidden="true"
                            initial={{ opacity: 0.95, scale: 1.12 }}
                            animate={{ opacity: [0.95, 0.78, 0], scale: [1.12, 1.04, 1] }}
                            exit={{ opacity: 0 }}
                            transition={{
                              duration: 1.35,
                              delay: burstCell.stepIndex * 0.045,
                              ease: 'easeOut',
                            }}
                            className="pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-300 via-yellow-400/90 to-emerald-400/85 shadow-[0_0_16px_rgba(250,204,21,0.8)] z-0"
                          />
                        )}
                      </AnimatePresence>

                      <motion.span
                        key={burstCell ? `letter_${burstCell.burstId}` : 'letter_idle'}
                        initial={burstCell ? { scale: 1.28 } : false}
                        animate={{ scale: 1 }}
                        transition={{
                          duration: 0.5,
                          delay: burstCell ? burstCell.stepIndex * 0.045 : 0,
                          ease: 'easeOut',
                        }}
                        className="relative z-10"
                      >
                        {letter}
                      </motion.span>

                      {isHintStart && (
                        <span className="absolute -top-1 -right-1 z-20 text-[9px] font-mono tabular-nums font-extrabold px-1 rounded bg-amber-400 text-[#1D0830] leading-tight shadow-2xs">
                          1st
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Pop-up Overlay directly over the main 10x10 board (e.g. Places 1-5 Final Screen) */}
        {boardOverlay && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-2.5 sm:p-4 bg-[#140421]/88 backdrop-blur-md animate-in fade-in duration-200">
            {boardOverlay}
          </div>
        )}
      </div>
    </div>
  );
};
