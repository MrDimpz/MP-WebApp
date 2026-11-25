import React from 'react';
import { Settings, Pen, HelpCircle, Delete } from 'lucide-react';
import { GameMode } from '../types/game';
import { sound } from '../utils/sound';

interface GameSidebarProps {
  mode: GameMode;
  guessesCount: number;
  view: 'CHOICE' | 'KEYBOARD';
  guessedLetters: string[];
  puzzleLetters: Set<string>;
  isSolved: boolean;
  onSelectGuessMode: () => void;
  onSelectFillMode: () => void;
  onGuessLetter: (letter: string) => void;
  onTypeLetter: (letter: string) => void;
  onBackspace: () => void;
  onSolve: () => void;
  onOpenSettings: () => void;
}

const ALPHABET_ROWS = [
  ['A', 'B', 'C', 'D'],
  ['E', 'F', 'G', 'H'],
  ['I', 'J', 'K', 'L'],
  ['M', 'N', 'O', 'P'],
  ['Q', 'R', 'S', 'T'],
  ['U', 'V', 'W', 'X'],
  ['Y', 'Z'],
];

export const GameSidebar: React.FC<GameSidebarProps> = ({
  mode,
  guessesCount,
  view,
  guessedLetters,
  puzzleLetters,
  isSolved,
  onSelectGuessMode,
  onSelectFillMode,
  onGuessLetter,
  onTypeLetter,
  onBackspace,
  onSolve,
  onOpenSettings,
}) => {
  const isGuessMode = mode === 'GUESS';
  const formattedGuesses = String(guessesCount).padStart(2, '0');

  return (
    <aside
      className="w-full max-w-sm sm:max-w-[340px] lg:max-w-[320px] rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 flex flex-col justify-between relative shadow-xl dark:shadow-2xl transition-colors duration-300 min-h-0 lg:min-h-[520px] bg-white dark:bg-[#1c042b] border border-[#4a1259]/20 dark:border-[#f5b82e]/25 text-[#2b0938] dark:text-white shrink-0"
    >
      {/* Top Banner: 00 GUESSES ribbon & settings icon */}
      <div className="flex items-start justify-between -mt-3.5 -mx-3.5 sm:-mt-5 sm:-mx-5 px-3.5 sm:px-5 pt-0 mb-3 sm:mb-4 relative">
        <div className="w-6" /> {/* spacer */}

        {/* The Hanging Ribbon Badge */}
        <div
          className="w-20 sm:w-24 pt-2 sm:pt-3 pb-1.5 sm:pb-2.5 rounded-b-xl sm:rounded-b-2xl flex flex-col items-center justify-center shadow-md select-none transition-colors duration-300 bg-[#4a1259] dark:bg-[#14021f] text-[#f5b82e] border-x border-b-2 border-[#f5b82e]/80"
        >
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none font-mono">
            {formattedGuesses}
          </span>
          <span className="text-[9px] sm:text-[10px] font-bold tracking-widest uppercase mt-0.5 sm:mt-1 opacity-90 text-[#f5b82e]/90">
            Guesses
          </span>
        </div>

        {/* Settings gear icon */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-2 sm:mt-3 p-1.5 rounded-full text-[#4a1259] hover:bg-[#efe7fb] dark:text-amber-300 dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer"
          title="Game Settings"
        >
          <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Main Controls inside Sidebar */}
      {view === 'CHOICE' ? (
        /* View 1: Initial Large Cards Choice (Image 1) */
        <div className="flex-1 flex flex-col justify-center gap-3 sm:gap-4 py-2">
          {/* GUESS a letter Card */}
          <button
            type="button"
            onClick={onSelectGuessMode}
            className="w-full bg-[#4a1259] hover:bg-[#5c1870] dark:bg-[#3b0f54] dark:hover:bg-[#4a1469] active:scale-[0.98] text-white rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col items-center justify-center gap-2 shadow-lg transition-all cursor-pointer group border border-[#f5b82e]/40"
          >
            <HelpCircle className="w-9 h-9 sm:w-12 sm:h-12 stroke-[2.2] text-[#f5b82e] group-hover:scale-110 transition-transform" />
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-black tracking-wider text-[#f5b82e]">GUESS</div>
              <div className="text-xs font-medium text-purple-100 dark:text-purple-200">a letter</div>
            </div>
          </button>

          {/* FILL IN answers Card */}
          <button
            type="button"
            onClick={onSelectFillMode}
            className="w-full bg-gradient-to-br from-[#f5b82e] via-[#e5a820] to-[#cca028] hover:brightness-105 active:scale-[0.98] text-[#220536] rounded-2xl p-6 flex flex-col items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer group border border-amber-200"
          >
            <Pen className="w-10 h-10 stroke-[2.4] text-[#220536] group-hover:scale-110 transition-transform" />
            <div className="text-center">
              <div className="text-2xl font-black tracking-wider text-[#220536]">FILL IN</div>
              <div className="text-xs font-bold text-[#220536]/80">answers</div>
            </div>
          </button>
        </div>
      ) : (
        /* View 2: Authentic 4x7 Alphabetical Keyboard (Image 2 & 3) */
        <div className="flex-1 flex flex-col justify-between py-1">
          {/* The 4-column Alphabetical Keyboard */}
          <div className="space-y-1.5 sm:space-y-2 select-none">
            {ALPHABET_ROWS.map((row, rIdx) => (
              <div key={rIdx} className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {row.map((letter) => {
                  const isGuessed = guessedLetters.includes(letter);
                  const isMatch = isGuessed && puzzleLetters.has(letter);
                  const isMissed = isGuessed && !puzzleLetters.has(letter);

                  let keyBg = '';
                  if (isMatch) {
                    keyBg = 'bg-[#f5b82e] text-[#220536] font-black shadow-md border-t border-amber-200 cursor-not-allowed opacity-90';
                  } else if (isMissed) {
                    keyBg = 'bg-[#ede5f7] text-[#8b7a99] dark:bg-[#2b083d] dark:text-purple-400/40 line-through cursor-not-allowed opacity-60 dark:opacity-50';
                  } else if (isGuessMode) {
                    keyBg = 'bg-[#f2ebfc] hover:bg-[#e5d6f9] text-[#2b0938] border border-[#4a1259]/20 dark:bg-[#491666] dark:hover:bg-[#5b1c7f] dark:text-white dark:border-purple-900/40 active:scale-95 shadow-xs';
                  } else {
                    // Fill Mode keyboard (Image 3)
                    keyBg = 'bg-[#f6f1fc] hover:bg-[#e5d6f9] text-[#2b0938] border border-[#4a1259]/20 dark:bg-[#3b0f54] dark:hover:bg-[#4a1469] dark:text-white dark:border-purple-800/40 active:scale-95 shadow-xs';
                  }

                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={isSolved || isGuessed}
                      onClick={() => {
                        if (isGuessMode) {
                          onGuessLetter(letter);
                        } else {
                          sound.playKeyClick();
                          onTypeLetter(letter);
                        }
                      }}
                      className={`h-9 sm:h-10 lg:h-11 rounded-lg font-black text-sm sm:text-base lg:text-lg flex items-center justify-center transition-all cursor-pointer ${keyBg}`}
                    >
                      {letter}
                    </button>
                  );
                })}

                {/* Last Row 7: contains Y, Z, empty slot, and Backspace */}
                {rIdx === 6 && (
                  <>
                    <div className="h-9 sm:h-10 lg:h-11" /> {/* empty 3rd slot */}
                    <button
                      type="button"
                      onClick={() => {
                        sound.playKeyClick();
                        onBackspace();
                      }}
                      disabled={isSolved}
                      className="h-9 sm:h-10 lg:h-11 rounded-lg font-bold flex items-center justify-center transition-all cursor-pointer bg-[#f2ebfc] hover:bg-[#e5d6f9] text-[#2b0938] border border-[#4a1259]/20 dark:bg-[#491666] dark:hover:bg-[#5b1c7f] dark:text-white dark:border-purple-900/40"
                      title="Backspace"
                    >
                      <Delete className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Mode Switcher Toggle Pill: [? GUESS | ✎ FILL] */}
          <div className="mt-2.5 sm:mt-3 bg-[#f2ebfc] dark:bg-black/30 p-1 rounded-xl flex items-center justify-between border border-[#4a1259]/15 dark:border-purple-900/40">
            <button
              type="button"
              onClick={onSelectGuessMode}
              className={`flex-1 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isGuessMode
                  ? 'bg-[#f5b82e] text-[#220536] font-extrabold shadow-sm'
                  : 'text-[#4a1259]/80 hover:text-[#2b0938] dark:text-purple-300 dark:hover:text-white'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>GUESS</span>
            </button>

            <button
              type="button"
              onClick={onSelectFillMode}
              className={`flex-1 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                !isGuessMode
                  ? 'bg-[#4a1259] text-white dark:bg-white dark:text-[#220536] font-extrabold shadow-sm'
                  : 'text-[#4a1259]/80 hover:text-[#2b0938] dark:text-purple-300 dark:hover:text-white'
              }`}
            >
              <Pen className="w-3.5 h-3.5" />
              <span>FILL</span>
            </button>
          </div>
        </div>
      )}

      {/* Big Bottom SOLVE Button (always visible) */}
      <div className="mt-3 sm:mt-4 pt-1">
        <button
          type="button"
          onClick={onSolve}
          disabled={view === 'CHOICE' && !isSolved}
          className={`w-full py-3 sm:py-3.5 rounded-xl font-extrabold text-sm sm:text-base tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${
            view === 'CHOICE' && !isSolved
              ? 'bg-[#e7dcf5] text-[#8b7a99] dark:bg-[#310c44] dark:text-purple-300/30 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-[#f5b82e] via-[#ffd166] to-[#f5b82e] hover:brightness-105 active:scale-[0.98] text-[#220536] font-black shadow-amber-500/25 border border-amber-300 cursor-pointer'
          }`}
        >
          SOLVE
        </button>
      </div>
    </aside>
  );
};
