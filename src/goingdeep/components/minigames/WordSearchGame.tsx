import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  KeyRound,
  Sparkles,
  Unlock,
} from 'lucide-react';
import { MiniGameStatus, WordSearchData } from '../../types';
import { buildWordSearchGrid } from '../../data/dailyGenerator';
import { SiblingKeyItem } from './LetterLockGame';
import { sound } from '../../utils/sound';

interface WordSearchGameProps {
  seedKey: string;
  data: WordSearchData;
  status: MiniGameStatus;
  siblings: SiblingKeyItem[];
  activeKeyId: string;
  onSelectKey: (keyId: string) => void;
  onComplete: (mode: 'solved' | 'revealed', hintsUsed: number) => void;
  onBack: () => void;
}

type CellCoord = [number, number];

function getLineCells(start: CellCoord, end: CellCoord): CellCoord[] | null {
  const [r1, c1] = start;
  const [r2, c2] = end;
  const dr = r2 - r1;
  const dc = c2 - c1;

  if (dr === 0 && dc === 0) return [start];

  const absR = Math.abs(dr);
  const absC = Math.abs(dc);

  if (dr !== 0 && dc !== 0 && absR !== absC) {
    return null;
  }

  const steps = Math.max(absR, absC);
  const stepR = dr === 0 ? 0 : dr / absR;
  const stepC = dc === 0 ? 0 : dc / absC;

  const cells: CellCoord[] = [];
  for (let i = 0; i <= steps; i++) {
    cells.push([r1 + i * stepR, c1 + i * stepC]);
  }
  return cells;
}

function directionLabel(dr: number, dc: number): string {
  if (dr === 0 && dc > 0) return 'Horizontal (left to right)';
  if (dr === 0 && dc < 0) return 'Horizontal (right to left)';
  if (dr > 0 && dc === 0) return 'Vertical (top to bottom)';
  if (dr < 0 && dc === 0) return 'Vertical (bottom to top)';
  if (dr > 0 && dc > 0) return 'Diagonal (down-right)';
  if (dr > 0 && dc < 0) return 'Diagonal (down-left)';
  if (dr < 0 && dc > 0) return 'Diagonal (up-right)';
  return 'Diagonal (up-left)';
}

export const WordSearchGame: React.FC<WordSearchGameProps> = ({
  seedKey,
  data,
  status,
  siblings,
  activeKeyId,
  onSelectKey,
  onComplete,
  onBack,
}) => {
  const target = data.word.toUpperCase();
  const isDone = status !== 'locked';

  const { grid, targetCells } = useMemo(
    () => buildWordSearchGrid(seedKey, data),
    [seedKey, data]
  );

  const [dragStart, setDragStart] = useState<CellCoord | null>(null);
  const [dragCurrent, setDragCurrent] = useState<CellCoord | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tapAnchor, setTapAnchor] = useState<CellCoord | null>(null);
  const [hintTier, setHintTier] = useState<0 | 1 | 2>(0);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const nextLockedSibling = siblings.find(
    (s) => s.keyId !== activeKeyId && s.status === 'locked'
  );

  const activeSelection = useMemo<CellCoord[]>(() => {
    if (isDone) return targetCells;
    if (dragStart && dragCurrent) {
      return getLineCells(dragStart, dragCurrent) ?? [dragStart];
    }
    if (tapAnchor) return [tapAnchor];
    return [];
  }, [dragCurrent, dragStart, isDone, tapAnchor, targetCells]);

  const activeSet = useMemo(
    () => new Set(activeSelection.map(([r, c]) => `${r}-${c}`)),
    [activeSelection]
  );

  const evaluateCells = (cells: CellCoord[]) => {
    if (cells.length < 2) return;
    const forward = cells.map(([r, c]) => grid[r][c]).join('');
    const backward = forward.split('').reverse().join('');

    if (forward === target || backward === target) {
      sound.unlock();
      setFeedback(null);
      setTapAnchor(null);
      onComplete('solved', hintTier);
    } else {
      sound.error();
      setWrongFlash(true);
      setFeedback(`"${forward}" isn’t the hidden word — try again`);
      window.setTimeout(() => setWrongFlash(false), 360);
    }
  };

  const handlePointerDown = (r: number, c: number) => {
    if (isDone) return;
    setFeedback(null);
    setDragStart([r, c]);
    setDragCurrent([r, c]);
    setIsDragging(true);
    sound.tap();
  };

  const handlePointerEnter = (r: number, c: number) => {
    if (!isDragging || !dragStart || isDone) return;
    const line = getLineCells(dragStart, [r, c]);
    if (line) {
      setDragCurrent([r, c]);
    }
  };

  const handlePointerUp = () => {
    if (!isDragging || !dragStart || isDone) return;
    const end = dragCurrent ?? dragStart;
    const cells = getLineCells(dragStart, end);

    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);

    if (cells && cells.length > 1) {
      setTapAnchor(null);
      evaluateCells(cells);
      return;
    }

    if (!tapAnchor) {
      setTapAnchor(end);
    } else if (tapAnchor[0] === end[0] && tapAnchor[1] === end[1]) {
      setTapAnchor(null);
    } else {
      const tapLine = getLineCells(tapAnchor, end);
      if (tapLine && tapLine.length > 1) {
        evaluateCells(tapLine);
        setTapAnchor(null);
      } else {
        setTapAnchor(end);
      }
    }
  };

  const handleHint = () => {
    if (isDone) return;
    if (hintTier < 2) {
      setHintTier((prev) => (prev + 1) as 1 | 2);
      sound.tap();
    }
  };

  const handleReveal = () => {
    if (isDone) return;
    sound.unlock();
    onComplete('revealed', hintTier + 1);
  };

  const previewWord =
    !isDone && activeSelection.length > 0
      ? activeSelection.map(([r, c]) => grid[r][c]).join('')
      : '';

  const cellSizeClass =
    data.gridSize >= 9
      ? 'w-9 h-9 sm:w-11 sm:h-11 text-[18px] sm:text-[21px] rounded-lg'
      : data.gridSize === 8
      ? 'w-10 h-10 sm:w-12 sm:h-12 text-[21px] sm:text-[24px] rounded-lg'
      : 'w-11 h-11 sm:w-13 sm:h-13 text-[24px] sm:text-[26px] rounded-xl';

  return (
    <div
      className="w-full max-w-2xl mx-auto"
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        if (isDragging) handlePointerUp();
      }}
    >
      {/* Sub-header */}
      <div className="flex items-center justify-between gap-4 pb-4 mb-5 border-b border-[#DAC6F0] dark:border-[#D4A437]/25">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#5C3A78] dark:text-[#D6CBE2] hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Board
        </button>
        <div className="text-right">
          <h2 className="font-display text-xl font-bold tracking-tight text-[#2B0938] dark:text-[#FAF7FF]">
            Word Search
          </h2>
          <p className="text-xs text-[#5C3A78] dark:text-[#C5B3DA]">
            {data.gridSize}×{data.gridSize} grid · Drag or tap start &amp; end letters
          </p>
        </div>
      </div>

      {/* Sibling Switcher */}
      {siblings.length > 1 && (
        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[#5C3A78] dark:text-[#C5B3DA]">
            Select Word Search key
          </span>
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#EDE0FA] dark:bg-[#230738] border border-[#D7C2EF] dark:border-[#D4A437]/25">
            {siblings.map((s) => {
              const isActive = s.keyId === activeKeyId;
              return (
                <button
                  key={s.keyId}
                  type="button"
                  onClick={() => onSelectKey(s.keyId)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#2B0938] text-[#F6C915] dark:bg-[#F6C915] dark:text-[#1D0830] shadow-xs'
                      : 'text-[#5C3A78] dark:text-[#D6CBE2] hover:text-[#2B0938] dark:hover:text-white'
                  }`}
                >
                  {s.status !== 'locked' && (
                    <Check className="w-3 h-3 text-emerald-500" />
                  )}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Solved Banner or Clue Card */}
      {isDone ? (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/45 border border-emerald-300 dark:border-emerald-500/45 flex flex-wrap items-center justify-between gap-3 animate-band-enter">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2E7D52] text-white flex items-center justify-center shrink-0">
              {status === 'solved' ? <Check className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-bold text-[#1E633E] dark:text-emerald-300">
                {status === 'solved' ? 'Key word unlocked' : 'Key word revealed'}
              </p>
              <p className="font-mono text-lg font-bold tracking-widest text-[#2B0938] dark:text-[#FAF7FF]">
                {target}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {nextLockedSibling && (
              <button
                type="button"
                onClick={() => onSelectKey(nextLockedSibling.keyId)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-600/40 bg-white dark:bg-[#1D0630] text-[#2B0938] dark:text-[#FAF7FF] text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer"
              >
                Next {nextLockedSibling.label}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 rounded-lg bg-[#2B0938] dark:bg-[#F6C915] text-[#F6C915] dark:text-[#1D0830] text-xs font-extrabold hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer"
            >
              Place on Board
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-5 p-4 rounded-xl bg-white dark:bg-[#210736] border border-[#DAC6F0] dark:border-[#D4A437]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#8F6500] dark:text-[#F6C915] mb-0.5">
              Hidden word clue · {target.length} letters
            </p>
            <p className="text-sm font-semibold text-[#2B0938] dark:text-[#FAF7FF]">
              {data.clue}
            </p>
            {hintTier >= 2 && (
              <p className="text-xs font-semibold text-[#8F6500] dark:text-[#F6C915] mt-1">
                Direction: {directionLabel(data.deltaRow, data.deltaCol)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {hintTier < 2 && (
              <button
                type="button"
                onClick={handleHint}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C3A78] dark:text-[#D6CBE2] hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {hintTier === 0 ? 'Highlight First Letter' : 'Show Direction'}
              </button>
            )}
            <button
              type="button"
              onClick={handleReveal}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8F6500] dark:text-[#F6C915] hover:opacity-80 transition-opacity whitespace-nowrap cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Reveal Word
            </button>
          </div>
        </div>
      )}

      {/* Selection preview / error feedback */}
      <div className="h-7 mb-2 flex items-center justify-center">
        {previewWord ? (
          <span className="font-mono text-sm font-extrabold tracking-widest text-[#2B0938] dark:text-[#F6C915]">
            {previewWord}
          </span>
        ) : feedback ? (
          <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
            {feedback}
          </span>
        ) : (
          <span className="text-xs text-[#6E4B8A] dark:text-[#B9A4D1]">
            {isDone
              ? 'Found inside the grid below'
              : data.denseDecoys
              ? 'Watch for reverse diagonals and decoy letters'
              : 'Trace straight horizontally, vertically, or diagonally'}
          </span>
        )}
      </div>

      {/* Dynamic Grid */}
      <div
        className={`bg-[#E2D1F7] dark:bg-[#11021D] border-2 border-[#A77FD4] dark:border-[#D4A437]/45 rounded-2xl p-2.5 sm:p-5 flex justify-center select-none touch-none shadow-xs ${
          wrongFlash ? 'animate-tile-shake' : ''
        }`}
      >
        <div
          className="grid gap-1 sm:gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${data.gridSize}, minmax(0, 1fr))`,
          }}
        >
          {grid.map((row, rIdx) =>
            row.map((letter, cIdx) => {
              const key = `${rIdx}-${cIdx}`;
              const isSelected = activeSet.has(key);
              const isHintStart =
                !isDone &&
                hintTier >= 1 &&
                rIdx === data.startRow &&
                cIdx === data.startCol;

              return (
                <button
                  key={key}
                  type="button"
                  onPointerDown={() => handlePointerDown(rIdx, cIdx)}
                  onPointerEnter={() => handlePointerEnter(rIdx, cIdx)}
                  className={`font-mono font-extrabold flex items-center justify-center transition-colors duration-100 cursor-pointer ${cellSizeClass} ${
                    isDone && isSelected
                      ? 'bg-[#1F7A4C] text-white border-2 border-[#145333] dark:border-emerald-300 shadow-sm'
                      : isSelected
                      ? 'bg-[#2B0938] dark:bg-[#F6C915] text-[#FFE047] dark:text-[#140321] border-2 border-[#F6C915] dark:border-white scale-[1.04] shadow-sm'
                      : isHintStart
                      ? 'bg-[#FFE673] dark:bg-[#664500] text-[#1A0424] dark:text-[#FFF3B0] border-2 border-[#B37E00] dark:border-[#F6C915] shadow-xs'
                      : 'bg-white dark:bg-[#3A1563] text-[#1A0424] dark:text-white border-2 border-[#7E4EA8] dark:border-[#F6C915]/70 shadow-xs hover:bg-[#FFF8DC] dark:hover:bg-[#4F1D85] dark:hover:border-[#F6C915]'
                  }`}
                >
                  {letter}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
