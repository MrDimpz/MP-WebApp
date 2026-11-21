import React, { useLayoutEffect, useRef, useState } from 'react';
import { Crown, Keyboard } from 'lucide-react';
import { GameMode, GameStats, WordValidationStatus } from '../types/game';
import { getWordBreakAfterIndices } from '../utils/wordSplits';

const GUESS_COUNT_BUCKETS: Array<{
  key: string;
  label: string;
  isAchievement?: boolean;
  getCount: (dist: Record<number, number>) => number;
}> = [
  { key: '0', label: '0 guesses', isAchievement: true, getCount: (d) => d[0] || 0 },
  { key: '1', label: '1 guess', getCount: (d) => d[1] || 0 },
  { key: '2', label: '2 guesses', getCount: (d) => d[2] || 0 },
  { key: '3', label: '3 guesses', getCount: (d) => d[3] || 0 },
  { key: '4', label: '4 guesses', getCount: (d) => d[4] || 0 },
  { key: '5', label: '5 guesses', getCount: (d) => d[5] || 0 },
  { key: '6', label: '6 guesses', getCount: (d) => d[6] || 0 },
  { key: '7', label: '7 guesses', getCount: (d) => d[7] || 0 },
  {
    key: '8+',
    label: '8+ guesses',
    getCount: (d) =>
      Object.entries(d).reduce((sum, [k, v]) => {
        const num = Number(k);
        return Number.isFinite(num) && num >= 8 ? sum + (Number(v) || 0) : sum;
      }, 0),
  },
];

interface ThematikBoardProps {
  themeClue: string;
  themeWord: string;
  filledThemeWord: string;
  themeValidation: WordValidationStatus;
  words: string[];
  filledWords: string[];
  guessedLetters: string[];
  mode: GameMode;
  isHardMode: boolean;
  activeRowIndex: number; // -1 for theme row, 0..5 for words
  activeLetterIndex: number;
  validationStatus: WordValidationStatus[];
  isSolved: boolean;
  stats: GameStats;
  onSelectCell: (wordIndex: number, letterIndex: number) => void;
  onSelectThemeCell: (letterIndex: number) => void;
  onOpenMobileKeyboard?: () => void;
}

export const ThematikBoard: React.FC<ThematikBoardProps> = ({
  themeClue,
  themeWord,
  filledThemeWord,
  themeValidation,
  words,
  filledWords,
  guessedLetters,
  mode,
  isHardMode,
  activeRowIndex,
  activeLetterIndex,
  validationStatus,
  isSolved,
  stats,
  onSelectCell,
  onSelectThemeCell,
  onOpenMobileKeyboard,
}) => {
  const isGuessMode = mode === 'GUESS';

  // Compute maximum row length across all words and the theme word (at least 7 as seen in GoComics)
  const maxWordLength = Math.max(
    7,
    themeWord.length,
    ...words.map((w) => w.length)
  );

  const themeWordBreaks = getWordBreakAfterIndices(themeWord);

  const isThemeIncorrect = themeValidation === 'incorrect';
  const isThemeEvaluated = themeValidation === 'incorrect' || themeValidation === 'incomplete';
  const isAnyEvaluatedWrong =
    isThemeEvaluated ||
    validationStatus.some((s) => s === 'incorrect' || s === 'incomplete');

  const boardStyle = {
    '--board-cols': maxWordLength,
    '--tile-sz': `clamp(28px, min(calc((100vw - 32px) / ${maxWordLength} - 5px), 52px), 52px)`,
    '--tile-font': `clamp(15px, calc(var(--tile-sz) * 0.52), 26px)`,
  } as React.CSSProperties;

  const tileRowRef = useRef<HTMLDivElement | null>(null);
  const clueMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [clueLayout, setClueLayout] = useState<{
    maxWidth?: number;
    fontSize?: number;
    allowWrap: boolean;
  }>({ allowWrap: false });

  useLayoutEffect(() => {
    let isMounted = true;
    const updateClueSize = () => {
      if (!isMounted) return;
      const rowEl = tileRowRef.current;
      const measureEl = clueMeasureRef.current;
      if (!rowEl || !measureEl) return;

      const availableWidth = Math.floor(rowEl.getBoundingClientRect().width);
      if (availableWidth <= 0) return;

      const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 640;
      const maxFont = isSmallScreen ? 24 : 30;
      const minSingleLineFont = 10;

      measureEl.style.fontSize = `${maxFont}px`;
      if (measureEl.getBoundingClientRect().width <= availableWidth) {
        setClueLayout({ maxWidth: availableWidth, fontSize: maxFont, allowWrap: false });
        return;
      }

      let low = minSingleLineFont;
      let high = maxFont;
      let best = minSingleLineFont;
      let fitsOnOneLine = false;

      for (let i = 0; i < 12; i++) {
        const mid = (low + high) / 2;
        measureEl.style.fontSize = `${mid}px`;
        if (measureEl.getBoundingClientRect().width <= availableWidth) {
          best = mid;
          fitsOnOneLine = true;
          low = mid;
        } else {
          high = mid;
        }
      }

      if (fitsOnOneLine) {
        setClueLayout({
          maxWidth: availableWidth,
          fontSize: Math.floor(best * 2) / 2,
          allowWrap: false,
        });
      } else {
        setClueLayout({
          maxWidth: availableWidth,
          fontSize: minSingleLineFont,
          allowWrap: true,
        });
      }
    };

    updateClueSize();

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (isMounted) updateClueSize();
      });
    }

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateClueSize())
        : null;
    if (observer && tileRowRef.current) {
      observer.observe(tileRowRef.current);
    }
    window.addEventListener('resize', updateClueSize);
    return () => {
      isMounted = false;
      observer?.disconnect();
      window.removeEventListener('resize', updateClueSize);
    };
  }, [themeClue, maxWordLength]);

  return (
    <div
      style={boardStyle}
      className={`relative flex flex-col select-none shrink-0 w-fit max-w-full ${
        isHardMode && isAnyEvaluatedWrong ? 'animate-shake' : ''
      }`}
    >
      {/* Hidden off-flow text measurer matching clue typography */}
      <span
        ref={clueMeasureRef}
        aria-hidden="true"
        className="invisible fixed -top-[9999px] -left-[9999px] pointer-events-none whitespace-nowrap font-extrabold tracking-wide leading-tight"
      >
        {themeClue}
      </span>

      {/* The Clue (dynamically scaled so it never exceeds the width of the tiles) */}
      <h1
        style={{
          maxWidth: clueLayout.maxWidth ? `${clueLayout.maxWidth}px` : undefined,
          fontSize: clueLayout.fontSize ? `${clueLayout.fontSize}px` : undefined,
        }}
        className={`w-0 min-w-full font-extrabold text-white tracking-wide mb-3 leading-tight ${
          clueLayout.fontSize ? '' : 'text-2xl sm:text-3xl'
        } ${clueLayout.allowWrap ? 'whitespace-normal break-words' : 'whitespace-nowrap'}`}
      >
        {themeClue}
      </h1>

      {/* Theme Anchor Word Row (Fillable & affected by Guess and Fill Mode) */}
      <div
        ref={tileRowRef}
        className={`inline-flex w-fit items-center gap-1.5 sm:gap-2 mb-3 max-w-full ${
          !isHardMode && isThemeIncorrect ? 'animate-shake' : ''
        }`}
      >
        {Array.from({ length: maxWordLength }).map((_, colIdx) => {
          const isPartOfWord = colIdx < themeWord.length;
          const targetChar = isPartOfWord ? themeWord[colIdx] : '';
          const userChar = isPartOfWord ? filledThemeWord[colIdx] || '' : '';
          const isRevealedByGuess =
            isPartOfWord && guessedLetters.includes(targetChar);
          const hasWordBreakAfter =
            isPartOfWord && themeWordBreaks.includes(colIdx);

          const isThemeCellFocused =
            !isGuessMode &&
            activeRowIndex === -1 &&
            activeLetterIndex === colIdx &&
            isPartOfWord;

          if (!isPartOfWord) {
            // Dark recessed inactive padding tile
            return (
              <div
                key={colIdx}
                style={{
                  width: 'var(--tile-sz)',
                  height: 'var(--tile-sz)',
                  '--tile-delay': `${colIdx * 18}ms`,
                } as React.CSSProperties}
                className="puzzle-tile-enter shrink-0 rounded-md transition-colors duration-200 bg-[#160224]/60 border border-purple-950/30 opacity-60"
              />
            );
          }

          // In Guess Mode, show target if guessed or solved. Guessed letter takes precedence over any manually typed character.
          const displayChar = isSolved
            ? targetChar
            : isRevealedByGuess
            ? targetChar
            : userChar.trim();
          const isFilled = Boolean(displayChar && displayChar.trim().length > 0);

          // Only highlight in red if not in Hard Mode and this specific tile has a wrong typed letter during validation
          const isTileWrong =
            !isHardMode &&
            isPartOfWord &&
            isThemeEvaluated &&
            !isRevealedByGuess &&
            Boolean(userChar.trim()) &&
            userChar.trim().toUpperCase() !== targetChar.toUpperCase();

          return (
            <div key={colIdx} className="relative flex items-center shrink-0">
              <div
                onClick={() => onSelectThemeCell(colIdx)}
                style={{
                  width: 'var(--tile-sz)',
                  height: 'var(--tile-sz)',
                  fontSize: 'var(--tile-font)',
                  '--tile-delay': `${colIdx * 18}ms`,
                } as React.CSSProperties}
                className={`puzzle-tile-enter shrink-0 rounded-md font-mono font-black leading-none flex items-center justify-center transition-all duration-200 cursor-pointer select-none ${
                  isTileWrong
                    ? 'bg-rose-500 text-white shadow-md ring-2 ring-rose-400'
                    : isRevealedByGuess
                    ? 'bg-gradient-to-b from-[#ffcf48] via-[#f5b82e] to-[#e6a822] text-[#220536] shadow-lg border-t-2 border-amber-100 ring-2 ring-amber-300/80 scale-[1.02]'
                    : isFilled
                    ? 'bg-white text-[#220536] shadow-md border-t-2 border-slate-100 ring-2 ring-amber-300/80 scale-[1.02]'
                    : 'bg-[#5e1d85] border-2 border-[#f5b82e]/90 shadow-md shadow-black/40 hover:bg-[#6e249b] hover:border-[#f5b82e]'
                } ${
                  isThemeCellFocused
                    ? 'ring-3 sm:ring-4 ring-[#f5b82e] ring-offset-2 ring-offset-[#250838] scale-105 z-10'
                    : ''
                }`}
              >
                <span className="leading-none">{displayChar}</span>
              </div>
              {hasWordBreakAfter && (
                <div
                  aria-hidden="true"
                  title="Word break"
                  className="pointer-events-none absolute -top-1 -bottom-1 left-full ml-[1px] sm:ml-[2px] w-[2.5px] sm:w-[4px] rounded-full bg-[#f5b82e] shadow-[0_0_6px_rgba(24,4,36,0.95)] z-20"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Horizontal Divider Line */}
      <div className="w-full h-[3px] bg-gradient-to-r from-amber-400/30 via-[#f5b82e] to-amber-400/30 my-3 sm:my-[16px] rounded-full shadow-xs" />

      {/* The 6 Word Rows (6 rows x maxWordLength columns) */}
      <div className="space-y-1.5 sm:space-y-2 mt-2 max-w-full">
        {words.map((word, rowIdx) => {
          const wordLen = word.length;
          const userFilled = filledWords[rowIdx] || '';
          const isRowIncorrect = validationStatus[rowIdx] === 'incorrect';
          const isRowEvaluated =
            validationStatus[rowIdx] === 'incorrect' || validationStatus[rowIdx] === 'incomplete';
          const rowWordBreaks = getWordBreakAfterIndices(word);

          return (
            <div
              key={rowIdx}
              className={`flex items-center gap-1.5 sm:gap-2 max-w-full ${
                !isHardMode && isRowIncorrect ? 'animate-shake' : ''
              }`}
            >
              {Array.from({ length: maxWordLength }).map((_, colIdx) => {
                const isPartOfWord = colIdx < wordLen;
                const targetChar = isPartOfWord ? word[colIdx] : '';
                const userChar = isPartOfWord ? userFilled[colIdx] || '' : '';
                const isRevealedByGuess =
                  isPartOfWord && guessedLetters.includes(targetChar);
                const hasWordBreakAfter =
                  isPartOfWord && rowWordBreaks.includes(colIdx);
                const isFocused =
                  !isGuessMode &&
                  activeRowIndex === rowIdx &&
                  activeLetterIndex === colIdx;

                if (!isPartOfWord) {
                  // Dark recessed inactive padding tile
                  return (
                    <div
                      key={colIdx}
                      style={{
                        width: 'var(--tile-sz)',
                        height: 'var(--tile-sz)',
                        '--tile-delay': `${(rowIdx + 1) * 26 + colIdx * 16}ms`,
                      } as React.CSSProperties}
                      className="puzzle-tile-enter shrink-0 rounded-md transition-colors duration-200 bg-[#160224]/60 border border-purple-950/30 opacity-60"
                    />
                  );
                }

                // Displayed letter
                const displayChar = isSolved
                  ? targetChar
                  : isRevealedByGuess
                  ? targetChar
                  : userChar.trim();
                const isFilled = Boolean(displayChar && displayChar.trim().length > 0);

                // Highlight wrong letter
                const isTileWrong =
                  !isHardMode &&
                  isPartOfWord &&
                  isRowEvaluated &&
                  !isRevealedByGuess &&
                  Boolean(userChar.trim()) &&
                  userChar.trim().toUpperCase() !== targetChar.toUpperCase();

                return (
                  <div key={colIdx} className="relative flex items-center shrink-0">
                    <div
                      onClick={() => onSelectCell(rowIdx, colIdx)}
                      style={{
                        width: 'var(--tile-sz)',
                        height: 'var(--tile-sz)',
                        fontSize: 'var(--tile-font)',
                        '--tile-delay': `${(rowIdx + 1) * 26 + colIdx * 16}ms`,
                      } as React.CSSProperties}
                      className={`puzzle-tile-enter shrink-0 rounded-md font-mono font-black leading-none flex items-center justify-center transition-all duration-200 cursor-pointer select-none ${
                        isTileWrong
                          ? 'bg-rose-500 text-white shadow-md ring-2 ring-rose-400'
                          : isRevealedByGuess
                          ? 'bg-gradient-to-b from-[#ffcf48] via-[#f5b82e] to-[#e6a822] text-[#220536] shadow-lg border-t-2 border-amber-100 ring-2 ring-amber-300/80 scale-[1.02]'
                          : isFilled
                          ? 'bg-white text-[#220536] shadow-md border-t-2 border-slate-100 ring-2 ring-amber-300/80 scale-[1.02]'
                          : isGuessMode
                          ? 'bg-[#5e1d85] border-2 border-[#f5b82e]/90 shadow-md shadow-black/40 hover:bg-[#6e249b] hover:border-[#f5b82e]'
                          : 'bg-[#561a7a] border-2 border-amber-200/80 shadow-md shadow-black/40 hover:bg-[#662090] hover:border-white'
                      } ${
                        isFocused
                          ? 'ring-3 sm:ring-4 ring-[#f5b82e] ring-offset-2 ring-offset-[#250838] scale-105 z-10'
                          : ''
                      }`}
                    >
                      <span className="leading-none">{displayChar}</span>
                    </div>
                    {hasWordBreakAfter && (
                      <div
                        aria-hidden="true"
                        title="Word break"
                        className="pointer-events-none absolute -top-1 -bottom-1 left-full ml-[1px] sm:ml-[2px] w-[2.5px] sm:w-[4px] rounded-full bg-[#f5b82e] shadow-[0_0_6px_rgba(24,4,36,0.95)] z-20"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Bottom Row beneath the grid: Copied Logo on bottom-left + Authentic Speech Bubble Pointer */}
      <div className="w-full flex items-center justify-between gap-3 mt-4 sm:mt-5">
        {/* Logo & Title */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <img
            src="/brand-logo.png"
            alt="The Missing Piece Logo"
            className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-md drop-shadow-md hover:scale-105 transition-transform"
          />
          <div className="flex flex-col">
            <span className="font-black text-xs sm:text-sm tracking-wider text-[#f5b82e] uppercase font-serif leading-tight drop-shadow-xs">
              The Missing Piece
            </span>
            <span className="text-[9px] sm:text-[10px] text-white/70 tracking-widest uppercase font-semibold leading-none">
              Find Your Space
            </span>
          </div>
        </div>

        {/* Speech Bubble Pointer (tappable on mobile to pop up device keyboard) */}
        <div className="flex-1 flex justify-center sm:justify-end">
          <button
            type="button"
            onClick={onOpenMobileKeyboard}
            className={`relative px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm tracking-wide shadow-lg transition-colors duration-200 bg-[#3d0f57] hover:bg-[#4b136b] border border-[#f5b82e]/50 flex items-center gap-2 cursor-pointer ${
              isGuessMode ? 'text-[#f5b82e]' : 'text-white'
            }`}
            title="Tap to open device keyboard"
          >
            {/* Triangular pointer pointing UP */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-6 sm:border-x-8 border-x-transparent border-b-6 sm:border-b-8 border-b-[#3d0f57]" />
            <Keyboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-85 shrink-0" />
            <span>{isGuessMode ? 'Guess a letter' : 'Tap any tile to type'}</span>
          </button>
        </div>
      </div>

      {/* Centralised 1-Line Counter: 0-Guess Achievement + Guess Distribution (1 guess .. 8+ guesses) */}
      <div
        className="w-full mt-3 sm:mt-3.5 mx-auto rounded-xl sm:rounded-2xl bg-[#1c042b]/90 border border-[#f5b82e]/30 px-1 py-2 sm:px-2 sm:py-2.5 shadow-lg text-center"
        aria-label="Guess count summary"
      >
        <div className="grid grid-cols-[1.28fr_repeat(8,minmax(0,1fr))] gap-[3px] sm:gap-1.5 items-stretch">
          {GUESS_COUNT_BUCKETS.map((bucket) => {
            const count = bucket.getCount(stats.guessDistribution || {});
            const hasCount = count > 0;

            if (bucket.isAchievement) {
              return (
                <div
                  key={bucket.key}
                  title="Flawless Achievement: Solved with 0 letter guesses"
                  className={`relative min-w-0 flex flex-col items-center justify-center rounded-lg sm:rounded-xl px-1 py-1.5 border transition-all ${
                    hasCount
                      ? 'bg-gradient-to-b from-[#ffe57f] via-[#f5b82e] to-[#d9940a] border-[#fff3b8] text-[#220536] shadow-[0_0_14px_rgba(245,184,46,0.55)] ring-1 ring-[#ffe680]'
                      : 'bg-gradient-to-b from-[#4a2608]/80 via-[#2f0d42]/90 to-[#1e052c]/95 border-[#f5b82e]/75 text-[#fde68a] shadow-[0_0_10px_rgba(245,184,46,0.2)] ring-1 ring-[#f5b82e]/30'
                  }`}
                >
                  <div className="flex items-center justify-center gap-0.5 sm:gap-1 leading-none">
                    <Crown
                      className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 shrink-0 ${
                        hasCount
                          ? 'text-[#220536] fill-[#220536]/20'
                          : 'text-[#f5b82e] fill-[#f5b82e]/25'
                      }`}
                    />
                    <span
                      className={`text-xs sm:text-sm font-mono font-black tabular-nums leading-none ${
                        hasCount ? 'text-[#220536]' : 'text-[#ffd86b]'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                  <span
                    className={`mt-1 text-[6.5px] sm:text-[8.5px] font-black uppercase tracking-tighter sm:tracking-tight leading-none whitespace-nowrap ${
                      hasCount ? 'text-[#220536]' : 'text-[#f5b82e]'
                    }`}
                  >
                    {bucket.label}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={bucket.key}
                className={`min-w-0 flex flex-col items-center justify-center rounded-lg sm:rounded-xl px-0.5 py-1.5 border transition-colors ${
                  hasCount
                    ? 'bg-[#3b0f54]/85 border-[#f5b82e]/50 text-white shadow-xs'
                    : 'bg-[#14021f]/75 border-purple-900/40 text-purple-300/60'
                }`}
              >
                <span
                  className={`text-xs sm:text-sm font-mono font-black tabular-nums leading-none ${
                    hasCount ? 'text-[#f5b82e]' : 'text-purple-300/45'
                  }`}
                >
                  {count}
                </span>
                <span className="mt-1 text-[6.5px] sm:text-[8.5px] font-semibold tracking-tighter sm:tracking-tight leading-none whitespace-nowrap">
                  {bucket.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
