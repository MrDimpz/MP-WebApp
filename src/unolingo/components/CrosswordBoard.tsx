import React from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { UnolingoPuzzle, WordSlot } from '../engine/puzzleGenerator';

interface CrosswordBoardProps {
  puzzle: UnolingoPuzzle;
  boardLetters: string[];
  hintIndices: number[];
  selectedCell: { r: number; c: number } | null;
  activeSlot: WordSlot | null;
  errorBlankIndices: Set<number>;
  isSolved: boolean;
  onSelectCell: (r: number, c: number) => void;
  onDropLetterOnCell: (blankIdx: number, letter: string) => void;
}

export const CrosswordBoard: React.FC<CrosswordBoardProps> = ({
  puzzle,
  boardLetters,
  hintIndices,
  selectedCell,
  activeSlot,
  errorBlankIndices,
  isSolved,
  onSelectCell,
  onDropLetterOnCell,
}) => {
  const hintSet = React.useMemo(() => new Set(hintIndices), [hintIndices]);

  const activeWordKeys = React.useMemo(() => {
    const set = new Set<string>();
    if (!activeSlot) return set;
    for (const cell of activeSlot.cells) {
      set.add(`${cell.r},${cell.c}`);
    }
    return set;
  }, [activeSlot]);

  return (
    <div
      className="w-full max-w-[396px] sm:max-w-[490px] lg:max-w-[520px] aspect-square mx-auto p-2.5 sm:p-3.5 bg-[#230633] dark:bg-[#0f0216] rounded-2xl border-2 border-[#4a1259] dark:border-amber-400/40 shadow-[0_18px_42px_rgba(45,9,56,0.38)] select-none"
      role="grid"
      aria-label="10 by 10 Unolingo crossword board"
    >
      <div className="grid grid-cols-10 grid-rows-10 gap-[3px] sm:gap-[4px] w-full h-full">
        {puzzle.layout.map((row, r) =>
          row.map((cell, c) => {
            const key = `${r},${c}`;
            const entranceDelay = `${(r + c) * 16}ms`;

            if (cell === '#') {
              return (
                <div
                  key={`${puzzle.dateStr}-block-${key}`}
                  aria-hidden="true"
                  className="bg-[#12031b] dark:bg-[#07010b] rounded-[4px] sm:rounded-[6px]"
                />
              );
            }

            const blankIdx = puzzle.blankIndexMap[key];
            const isBlankSlot = blankIdx !== undefined;
            const givenChar = puzzle.givens[r][c];
            const placedChar = isBlankSlot ? boardLetters[blankIdx] || '' : givenChar;
            const isHinted = isBlankSlot && hintSet.has(blankIdx);
            const isSelected = selectedCell?.r === r && selectedCell?.c === c;
            const isInActiveWord = activeWordKeys.has(key);
            const hasError = isBlankSlot && errorBlankIndices.has(blankIdx);

            let tileClasses =
              'puzzle-tile-enter relative flex items-center justify-center rounded-[5px] sm:rounded-[7px] font-extrabold uppercase transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer ';

            if (isSolved && isBlankSlot) {
              tileClasses +=
                'bg-emerald-50 text-emerald-800 ring-2 ring-emerald-400 ring-inset shadow-[inset_0_-2px_0_rgba(16,185,129,0.28)] ';
            } else if (!isBlankSlot) {
              // Fixed anchor letter: warm porcelain cream square + jet-plum bold letter
              tileClasses += isSelected
                ? 'bg-[#fbf6e8] text-[#230633] ring-2 sm:ring-[3px] ring-amber-400 ring-inset shadow-[inset_0_-2px_0_rgba(180,83,9,0.28)] '
                : isInActiveWord
                ? 'bg-[#fdf8eb] text-[#230633] ring-1 ring-amber-300/80 ring-inset shadow-[inset_0_-2px_0_rgba(180,83,9,0.18)] '
                : 'bg-[#f4ebd4] text-[#1e062b] border border-amber-300/60 shadow-[inset_0_-2px_0_rgba(124,88,30,0.22)] ';
            } else if (isHinted) {
              // Hint-revealed letter: brushed metallic gold highlight
              tileClasses += isSelected
                ? 'bg-amber-200 text-[#2d0938] ring-2 sm:ring-[3px] ring-[#4a1259] dark:ring-amber-300 ring-inset shadow-[inset_0_-2px_0_rgba(180,83,9,0.35)] '
                : 'bg-amber-100 text-[#3b0d47] ring-1 ring-amber-400 ring-inset shadow-[inset_0_-2px_0_rgba(180,83,9,0.28)] ';
            } else if (hasError) {
              tileClasses +=
                'bg-rose-100 text-rose-700 ring-2 sm:ring-[3px] ring-rose-500 ring-inset animate-unolingo-shake ';
            } else if (isSelected) {
              tileClasses +=
                'bg-[#fffbeb] text-[#581c6b] ring-2 sm:ring-[3px] ring-amber-400 ring-inset shadow-[0_0_12px_rgba(251,191,36,0.45)] ';
            } else if (isInActiveWord) {
              tileClasses +=
                'bg-[#f5ebff] text-[#4a1259] ring-1 ring-purple-400/70 ring-inset ';
            } else {
              // Player blank / placed letter: crisp pure white tile + deep royal purple ink
              tileClasses +=
                'bg-white text-[#581c6b] border border-purple-200/80 shadow-[inset_0_-2px_0_rgba(88,28,107,0.12)] ';
            }

            return (
              <button
                key={`${puzzle.dateStr}-cell-${key}`}
                type="button"
                role="gridcell"
                style={{ '--tile-delay': entranceDelay } as React.CSSProperties}
                aria-label={`Row ${r + 1} Column ${c + 1}${
                  !isBlankSlot
                    ? `, fixed letter ${givenChar}`
                    : placedChar
                    ? `, placed letter ${placedChar}${isHinted ? ' (hint)' : ''}`
                    : ', empty'
                }`}
                onClick={() => onSelectCell(r, c)}
                onDragOver={(e) => {
                  if (isBlankSlot && !isHinted && !isSolved) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={(e) => {
                  if (!isBlankSlot || isHinted || isSolved) return;
                  e.preventDefault();
                  const dropped = e.dataTransfer.getData('text/plain').trim().toUpperCase();
                  if (/^[A-Z]$/.test(dropped)) {
                    onDropLetterOnCell(blankIdx, dropped);
                  }
                }}
                className={tileClasses}
              >
                {hasError ? (
                  <AlertCircle
                    className="absolute bottom-[2px] right-[2px] w-2.5 h-2.5 text-rose-600 pointer-events-none"
                    aria-hidden="true"
                  />
                ) : isHinted ? (
                  <Lock
                    className="absolute top-[2px] right-[2px] w-2 h-2 sm:w-2.5 sm:h-2.5 text-amber-700/70 pointer-events-none"
                    aria-hidden="true"
                  />
                ) : null}

                <span
                  key={`${key}-${placedChar}`}
                  className={`text-[18px] sm:text-[23px] md:text-[26px] leading-none tracking-tight ${
                    placedChar && isBlankSlot ? 'animate-unolingo-pop' : ''
                  }`}
                >
                  {placedChar}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
