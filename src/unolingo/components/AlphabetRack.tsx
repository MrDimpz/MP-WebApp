import React from 'react';
import {
  ArrowLeftRight,
  CheckCheck,
  Eraser,
  Lightbulb,
  Undo2,
} from 'lucide-react';

interface AlphabetRackProps {
  boardLetters: string[];
  hintIndices: number[];
  isSolved: boolean;
  canUndo: boolean;
  canClearSelected: boolean;
  direction: 'across' | 'down';
  autoCheck: boolean;
  onLetterPress: (letter: string) => void;
  onUndo: () => void;
  onClearCell: () => void;
  onToggleDirection: () => void;
  onCheckBoard: () => void;
  onUseHint: () => void;
  onToggleAutoCheck: () => void;
}

const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const ROW_1 = ALL_LETTERS.slice(0, 9);
const ROW_2 = ALL_LETTERS.slice(9, 18);
const ROW_3 = ALL_LETTERS.slice(18, 26);

export const AlphabetRack: React.FC<AlphabetRackProps> = ({
  boardLetters,
  hintIndices,
  isSolved,
  canUndo,
  canClearSelected,
  direction,
  autoCheck,
  onLetterPress,
  onUndo,
  onClearCell,
  onToggleDirection,
  onCheckBoard,
  onUseHint,
  onToggleAutoCheck,
}) => {
  const placedLetters = React.useMemo(() => {
    const map = new Map<string, number>();
    boardLetters.forEach((ch, idx) => {
      if (ch) map.set(ch, idx);
    });
    return map;
  }, [boardLetters]);

  const hintSet = React.useMemo(() => new Set(hintIndices), [hintIndices]);
  const remainingCount = 26 - placedLetters.size;

  const renderKey = (letter: string, desktopLarge = false) => {
    const placedIdx = placedLetters.get(letter);
    const isPlaced = placedIdx !== undefined;
    const isLockedHint = isPlaced && hintSet.has(placedIdx);

    return (
      <button
        key={letter}
        type="button"
        disabled={isSolved}
        draggable={!isSolved && !isLockedHint}
        onDragStart={(e) => {
          if (isSolved || isLockedHint) return;
          e.dataTransfer.setData('text/plain', letter);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={() => onLetterPress(letter)}
        title={
          isLockedHint
            ? `${letter} is locked by hint`
            : isPlaced
            ? `${letter} placed — tap to locate or swap`
            : `Place ${letter}`
        }
        className={`relative flex items-center justify-center rounded-xl font-black transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 select-none ${
          desktopLarge
            ? 'h-11 xl:h-12 text-lg'
            : 'min-h-[42px] h-11 text-base'
        } ${
          isLockedHint
            ? 'bg-amber-400/20 text-amber-200 border border-amber-400/50 cursor-pointer'
            : isPlaced
            ? 'bg-[#2a073d] dark:bg-[#190425] text-purple-300/35 border border-purple-700/40 shadow-inner hover:text-amber-200/80 cursor-pointer'
            : 'bg-[#fbf6e8] hover:bg-white text-[#2d0938] border border-amber-300 border-b-[4px] border-b-[#92400e] shadow-[0_3px_10px_rgba(0,0,0,0.28)] hover:brightness-105 cursor-pointer'
        }`}
      >
        <span>{letter}</span>
      </button>
    );
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Desktop 3-Column Rack Container matching Missing Piece Royal Purple & Gold styling */}
      <div className="hidden lg:flex flex-col gap-3 bg-[#360b42] dark:bg-[#1d0528] border border-purple-400/30 dark:border-amber-400/25 rounded-2xl p-4 shadow-[0_14px_34px_rgba(45,9,56,0.34)]">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-amber-300/90 px-0.5">
          <span>26-Letter Bank</span>
          <span className="font-mono tabular-nums text-purple-200/80">
            {remainingCount === 0 ? 'All Placed' : `${remainingCount} Left`}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {ALL_LETTERS.slice(0, 24).map((l) => renderKey(l, true))}
          <div className="col-span-3 grid grid-cols-3 gap-2.5 px-[17%]">
            <div className="col-span-3 grid grid-cols-2 gap-2.5">
              {renderKey('Y', true)}
              {renderKey('Z', true)}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile / Tablet Compact 9-9-8 Rack Container */}
      <div className="flex lg:hidden flex-col gap-1.5 bg-[#360b42] dark:bg-[#1d0528] border border-purple-400/30 dark:border-amber-400/25 rounded-2xl p-2 sm:p-3 shadow-[0_12px_28px_rgba(45,9,56,0.34)]">
        <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
          {ROW_1.map((l) => renderKey(l, false))}
        </div>
        <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
          {ROW_2.map((l) => renderKey(l, false))}
        </div>
        <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
          <div className="col-span-9 grid grid-cols-8 gap-1 sm:gap-1.5 px-[5.5%]">
            {ROW_3.map((l) => renderKey(l, false))}
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo || isSolved}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/95 dark:bg-[#240930] border border-purple-200 dark:border-purple-700/60 text-[#3b0d47] dark:text-purple-100 hover:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <Undo2 className="w-3.5 h-3.5 text-[#581c6b] dark:text-amber-400" aria-hidden="true" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            onClick={onClearCell}
            disabled={!canClearSelected || isSolved}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/95 dark:bg-[#240930] border border-purple-200 dark:border-purple-700/60 text-[#3b0d47] dark:text-purple-100 hover:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <Eraser className="w-3.5 h-3.5 text-[#581c6b] dark:text-amber-400" aria-hidden="true" />
            <span>Clear</span>
          </button>
          <button
            type="button"
            onClick={onToggleDirection}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/95 dark:bg-[#240930] border border-purple-200 dark:border-purple-700/60 text-[#3b0d47] dark:text-purple-100 hover:border-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
            <span className="capitalize">{direction}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCheckBoard}
            disabled={isSolved}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/95 dark:bg-[#240930] border border-purple-200 dark:border-purple-700/60 text-[#3b0d47] dark:text-purple-100 hover:border-emerald-400 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
            <span>Check</span>
          </button>
          <button
            type="button"
            onClick={onUseHint}
            disabled={isSolved}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-extrabold bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-300 text-[#2d0938] hover:brightness-105 disabled:opacity-40 transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <Lightbulb className="w-3.5 h-3.5 text-[#2d0938]" aria-hidden="true" />
            <span>Hint</span>
          </button>
        </div>
      </div>

      {/* Rack metadata & auto-check */}
      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-purple-200/80 px-0.5">
        <span className="font-mono tabular-nums font-semibold">
          {remainingCount === 0
            ? 'All 26 letters placed'
            : `${remainingCount} letters remaining`}
        </span>
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none min-h-[32px]">
          <input
            type="checkbox"
            checked={autoCheck}
            onChange={onToggleAutoCheck}
            className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
          />
          <span className="font-semibold text-[#3b0d47] dark:text-purple-100">Auto-check</span>
        </label>
      </div>
    </div>
  );
};
