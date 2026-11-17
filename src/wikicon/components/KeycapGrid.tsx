import React, { useRef, useState, useEffect, useCallback } from 'react';
import { GridBoard, GridTargetCard } from '../types';
import { soundFX } from '../utils/sound';

interface KeycapGridProps {
  gridBoard: GridBoard;
  onWordSubmit: (word: string) => void;
  isLightMode?: boolean;
  compactOverlay?: boolean;
}

export const KeycapGrid: React.FC<KeycapGridProps> = ({
  gridBoard,
  onWordSubmit,
  isLightMode = false,
  compactOverlay = false,
}) => {
  const { rows, cols, cells, targets } = gridBoard;
  const [activePath, setActivePath] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [flashedIndices, setFlashedIndices] = useState<Set<number>>(new Set());
  const gridRef = useRef<HTMLDivElement>(null);

  // Flash revealed target paths when targets update
  const prevRevealedCountRef = useRef<number>(0);
  useEffect(() => {
    const revealedTargets = targets.filter((t) => t.revealed && t.path && t.path.length > 0);
    if (revealedTargets.length > prevRevealedCountRef.current) {
      const latest = revealedTargets[revealedTargets.length - 1];
      if (latest && latest.path) {
        const nextSet = new Set(latest.path);
        setFlashedIndices(nextSet);
        const timer = setTimeout(() => setFlashedIndices(new Set()), 900);
        prevRevealedCountRef.current = revealedTargets.length;
        return () => clearTimeout(timer);
      }
    }
    prevRevealedCountRef.current = revealedTargets.length;
  }, [targets]);

  const areNeighbors = (idxA: number, idxB: number) => {
    const rA = Math.floor(idxA / cols);
    const cA = idxA % cols;
    const rB = Math.floor(idxB / cols);
    const cB = idxB % cols;
    return Math.abs(rA - rB) <= 1 && Math.abs(cA - cB) <= 1 && idxA !== idxB;
  };

  const handleCellEnter = useCallback(
    (idx: number) => {
      setActivePath((prev) => {
        if (prev.length === 0) return [idx];
        const last = prev[prev.length - 1];
        if (last === idx) return prev;
        // Allow backtracking one step if user drags back to second-to-last tile
        if (prev.length >= 2 && prev[prev.length - 2] === idx) {
          soundFX.playKeycapTap(prev.length - 2);
          return prev.slice(0, -1);
        }
        if (prev.includes(idx)) return prev;
        if (areNeighbors(last, idx)) {
          soundFX.playKeycapTap(prev.length);
          return [...prev, idx];
        }
        return prev;
      });
    },
    [cols]
  );

  const finishSwipe = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (activePath.length >= 2) {
      const formedWord = activePath.map((i) => cells[i]).join('');
      onWordSubmit(formedWord);
    }
    setActivePath([]);
  }, [isDragging, activePath, cells, onWordSubmit]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDragging) finishSwipe();
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [isDragging, finishSwipe]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const elem = document.elementFromPoint(e.clientX, e.clientY);
    if (!elem) return;
    const cellEl = elem.closest('[data-cell-idx]') as HTMLElement | null;
    if (cellEl && cellEl.dataset.cellIdx !== undefined) {
      const idx = parseInt(cellEl.dataset.cellIdx, 10);
      if (!isNaN(idx)) {
        handleCellEnter(idx);
      }
    }
  };

  // Compute SVG polyline coordinates for active swipe path
  const getCellCenterPercent = (idx: number) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const x = ((c + 0.5) / cols) * 100;
    const y = ((r + 0.5) / rows) * 100;
    return { x, y };
  };

  const currentWordPreview = activePath.map((i) => cells[i]).join('');

  // Group targets into Title targets and Pyramid rows (1 top, 2 middle, 3 bottom)
  const pyramidRow1 = targets.filter((t) => t.tier === 'PYRAMID_1');
  const pyramidRow2 = targets.filter((t) => t.tier === 'PYRAMID_2');
  const pyramidRow3 = targets.filter((t) => t.tier === 'PYRAMID_3');

  const renderTargetCard = (t: GridTargetCard, heightClass: string, textClass: string) => {
    const isRevealed = t.revealed;
    const fillPct = isRevealed ? 100 : t.closeness;
    const hue = isRevealed ? 135 : Math.round(25 + (t.closeness / 100) * 95);

    return (
      <div
        key={t.id}
        className={`relative flex-1 min-w-0 ${heightClass} rounded-xl overflow-hidden border transition-all ${
          isRevealed
            ? 'border-[#4ade80] bg-[#17281e] shadow-[0_0_16px_rgba(74,222,128,0.28)]'
            : 'border-[#6b21a8] bg-[#2c0938]'
        }`}
      >
        {/* Closeness / Revealed Fill Bar */}
        <div
          className="absolute inset-y-0 left-0 transition-all duration-300 pointer-events-none"
          style={{
            width: `${fillPct}%`,
            background: isRevealed
              ? 'linear-gradient(90deg, rgba(74,222,128,0.35), rgba(34,197,94,0.2))'
              : `linear-gradient(90deg, hsla(${hue}, 88%, 50%, 0.35), transparent)`,
          }}
        />
        <div className={`relative z-10 h-full ${compactOverlay ? 'px-2' : 'px-3'} flex items-center justify-between gap-2`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`font-bold tracking-wider truncate ${textClass} ${
                isRevealed ? 'text-[#4ade80]' : 'text-[#faf5ff]'
              }`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {isRevealed
                ? t.word
                : t.hintLetters
                    .map((l) => l || '•')
                    .join(' ')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono tabular-nums text-[#d8b4fe]">
            {isRevealed && t.finder ? (
              <span className="text-[#4ade80] font-semibold truncate max-w-[80px]">
                {t.finder.displayName}
              </span>
            ) : (
              <span>{t.length}L {t.closeness > 0 ? `· ${t.closeness}%` : ''}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col w-full ${compactOverlay ? 'gap-2' : 'gap-4'}`}>
      {/* Target-Card Pyramid (1 Large on top, 2 in Middle, 3 on Bottom) */}
      {(pyramidRow1.length > 0 || pyramidRow2.length > 0 || pyramidRow3.length > 0) && (
        <div className={`flex flex-col ${compactOverlay ? 'gap-1.5' : 'gap-2'}`}>
          <div className="flex items-center justify-between text-[11px] text-[#d8b4fe] px-1">
            <span className="truncate">
              {compactOverlay ? 'Target Pyramid' : 'Target Article Pyramid · Fill grows green as guesses get closer'}
            </span>
            <span className="font-mono tabular-nums shrink-0">
              {targets.filter((t) => t.revealed).length}/{targets.length} Found
            </span>
          </div>
          {pyramidRow1.length > 0 && (
            <div className="flex gap-1.5">
              {pyramidRow1.map((t) =>
                renderTargetCard(
                  t,
                  compactOverlay ? 'h-10' : 'h-14',
                  compactOverlay ? 'text-base' : 'text-xl'
                )
              )}
            </div>
          )}
          {pyramidRow2.length > 0 && (
            <div className="flex gap-1.5">
              {pyramidRow2.map((t) =>
                renderTargetCard(
                  t,
                  compactOverlay ? 'h-9' : 'h-12',
                  compactOverlay ? 'text-sm' : 'text-base'
                )
              )}
            </div>
          )}
          {pyramidRow3.length > 0 && (
            <div className="flex gap-1.5">
              {pyramidRow3.map((t) =>
                renderTargetCard(
                  t,
                  compactOverlay ? 'h-8' : 'h-11',
                  compactOverlay ? 'text-xs' : 'text-sm'
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* Active Swipe Word Preview Floating Bar */}
      {!compactOverlay && (
        <div className="h-9 flex items-center justify-center">
          {currentWordPreview ? (
            <div
              className="px-4 py-1 rounded-lg bg-[#facc15] text-[#2d0938] font-bold tracking-widest text-lg shadow-lg"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {currentWordPreview}
            </div>
          ) : (
            <span className="text-xs text-[#d8b4fe]">
              Drag across adjacent 8-connected arcade keycaps or type below to discover hidden words
            </span>
          )}
        </div>
      )}

      {/* Physical Arcade Keycap Matrix + SVG Swipe Line */}
      <div
        ref={gridRef}
        onPointerMove={handlePointerMove}
        className={`relative mx-auto w-full rounded-2xl bg-[#16041c] border-2 border-[#7e22ce] shadow-[0_0_24px_rgba(250,204,21,0.16)] select-none touch-none ${
          compactOverlay ? 'max-w-[376px] p-2.5' : 'max-w-[460px] p-3.5'
        }`}
      >
        {/* SVG Swipe Connector Overlay */}
        <svg
          className={`absolute pointer-events-none z-20 ${
            compactOverlay
              ? 'inset-2.5 w-[calc(100%-20px)] h-[calc(100%-20px)]'
              : 'inset-3.5 w-[calc(100%-28px)] h-[calc(100%-28px)]'
          }`}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {activePath.length > 1 && (
            <polyline
              fill="none"
              stroke="#facc15"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={activePath
                .map((idx) => {
                  const { x, y } = getCellCenterPercent(idx);
                  return `${x},${y}`;
                })
                .join(' ')}
            />
          )}
        </svg>

        <div
          key={`${rows}x${cols}:${cells.join('')}`}
          className={`grid relative z-10 ${compactOverlay ? 'gap-1.5' : 'gap-2'}`}
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {cells.map((letter, idx) => {
            const isSelected = activePath.includes(idx);
            const isFlashed = flashedIndices.has(idx);
            const tileDelayMs = (Math.floor(idx / (cols || 1)) + (idx % (cols || 1))) * 16;
            return (
              <button
                key={idx}
                type="button"
                data-cell-idx={idx}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                  soundFX.playKeycapTap(0);
                  setActivePath([idx]);
                }}
                style={{ '--tile-delay': `${tileDelayMs}ms` } as React.CSSProperties}
                className={`puzzle-tile-enter aspect-square rounded-xl flex items-center justify-center font-bold cursor-pointer ${
                  compactOverlay ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
                } ${
                  isLightMode ? 'keycap-tile-light' : 'keycap-tile text-[#faf5ff]'
                } ${isSelected ? 'active-swipe' : ''} ${isFlashed ? 'found-flash' : ''}`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
