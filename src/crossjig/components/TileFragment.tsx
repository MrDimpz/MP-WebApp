import React from 'react';
import { Check, Lock, Pin, X } from 'lucide-react';
import { PuzzleTile } from '../game/types';

export type CheckFeedbackState = 'correct' | 'wrong' | null;

interface TileFragmentProps {
  tile: PuzzleTile;
  isSelected?: boolean;
  isDropTarget?: boolean;
  isLocked?: boolean;
  isPinned?: boolean;
  isDraggingSource?: boolean;
  isFloating?: boolean;
  isSolved?: boolean;
  justSettled?: boolean;
  checkState?: CheckFeedbackState;
  compact?: boolean;
}

export const TileFragment: React.FC<TileFragmentProps> = React.memo(
  ({
    tile,
    isSelected = false,
    isDropTarget = false,
    isLocked = false,
    isPinned = false,
    isDraggingSource = false,
    isFloating = false,
    isSolved = false,
    justSettled = false,
    checkState = null,
    compact = false,
  }) => {
    const borderClass = isSolved
      ? 'border-[0.5px] border-[#2B0938]'
      : isDropTarget
        ? 'border-2 border-[#F6C915] shadow-[0_0_12px_rgba(246,201,21,0.45)]'
        : isSelected
          ? 'border-2 border-[#F6C915] shadow-[0_0_14px_rgba(246,201,21,0.5)]'
          : checkState === 'correct'
            ? 'border-2 border-[#10B981]'
            : checkState === 'wrong'
              ? 'border-2 border-[#E11D48]'
              : isLocked
                ? 'border-[1.5px] border-[#10B981]/85'
                : isPinned
                  ? 'border-[1.5px] border-[#F59E0B]'
                  : 'border-[1.5px] border-[#38104F] dark:border-[#D4A437]/55';

    const containerStateClass = isSolved
      ? 'rounded-none shadow-none'
      : isFloating
        ? 'rounded-[5px] shadow-[0_18px_36px_-6px_rgba(14,2,24,0.6)] ring-2 ring-[#F6C915]'
        : isDraggingSource
          ? 'rounded-[5px] opacity-25 scale-[0.96]'
          : isDropTarget
            ? 'rounded-[5px] scale-[0.96] bg-[#FEF3C7]'
            : 'rounded-[5px] shadow-[0_2px_0_0_rgba(29,8,48,0.28)] hover:shadow-[0_4px_12px_rgba(246,201,21,0.22)]';

    return (
      <div
        className={`relative aspect-square w-full overflow-hidden bg-[#1D0830] select-none transition-transform duration-150 ease-out ${borderClass} ${containerStateClass} ${
          justSettled ? 'animate-tile-settle' : ''
        } ${checkState ? 'animate-check-pulse' : ''}`}
      >
        <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-[1px] bg-[#3B1054]">
          {tile.cells.map((row, rIdx) =>
            row.map((cell, cIdx) => {
              const isBlack = cell === '#';
              if (isBlack) {
                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className="h-full w-full bg-[#160424]"
                    aria-hidden="true"
                  />
                );
              }
              return (
                <div
                  key={`${rIdx}-${cIdx}`}
                  className={`flex h-full w-full items-center justify-center font-extrabold leading-none transition-colors duration-150 ${
                    isSolved
                      ? 'bg-[#FFFDF7] text-[#1D0830]'
                      : isDropTarget
                        ? 'bg-[#FEF3C7] text-[#1D0830]'
                        : isSelected
                          ? 'bg-[#FFF8DB] text-[#1D0830]'
                          : isLocked
                            ? 'bg-[#ECFDF5] text-[#064E3B]'
                            : checkState === 'correct'
                              ? 'bg-[#D1FAE5] text-[#064E3B]'
                              : checkState === 'wrong'
                                ? 'bg-[#FFE4E6] text-[#881337]'
                                : 'bg-[#FAF7F0] text-[#1D0830]'
                  } ${
                    compact
                      ? 'text-[15px] sm:text-[18px] md:text-[20px]'
                      : 'text-[17px] sm:text-[21px] md:text-[23px]'
                  }`}
                >
                  {cell}
                </div>
              );
            })
          )}
        </div>

        {/* Non-hue-only state indicators (hidden when puzzle is solved & fused) */}
        {!isSolved && !isDraggingSource && (
          <>
            {checkState === 'correct' && (
              <span
                className="pointer-events-none absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#10B981] text-white shadow-xs"
                aria-label="Correct placement"
              >
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </span>
            )}
            {checkState === 'wrong' && (
              <span
                className="pointer-events-none absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#E11D48] text-white shadow-xs"
                aria-label="Misplaced tile"
              >
                <X className="h-2.5 w-2.5 stroke-[3]" />
              </span>
            )}
            {!checkState && isLocked && (
              <span
                className="pointer-events-none absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#10B981] text-white shadow-xs"
                aria-label="Locked in place"
              >
                <Lock className="h-2.5 w-2.5 stroke-[2.5]" />
              </span>
            )}
            {!checkState && !isLocked && isPinned && (
              <span
                className="pointer-events-none absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#F6C915] text-[#1D0830] shadow-xs"
                aria-label="Pinned by player"
              >
                <Pin className="h-2.5 w-2.5 stroke-[2.5]" />
              </span>
            )}
          </>
        )}
      </div>
    );
  }
);

TileFragment.displayName = 'TileFragment';
