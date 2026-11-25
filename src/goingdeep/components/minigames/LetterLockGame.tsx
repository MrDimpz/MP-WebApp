import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Delete,
  HelpCircle,
  KeyRound,
  Unlock,
} from 'lucide-react';
import { LetterLockData, MiniGameStatus } from '../../types';
import { sound } from '../../utils/sound';

type LetterState = 'correct' | 'present' | 'absent' | 'empty';

export interface SiblingKeyItem {
  keyId: string;
  label: string;
  status: MiniGameStatus;
}

interface LetterLockGameProps {
  data: LetterLockData;
  status: MiniGameStatus;
  initialGuesses: string[];
  siblings: SiblingKeyItem[];
  activeKeyId: string;
  onSelectKey: (keyId: string) => void;
  onUpdateGuesses: (guesses: string[]) => void;
  onComplete: (mode: 'solved' | 'revealed', hintsUsed: number) => void;
  onBack: () => void;
}

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

function evaluateGuess(guess: string, target: string): LetterState[] {
  const len = target.length;
  const result: LetterState[] = Array(len).fill('absent');
  const remainingCounts: Record<string, number> = {};

  for (let i = 0; i < len; i++) {
    if (guess[i] === target[i]) {
      result[i] = 'correct';
    } else {
      const ch = target[i];
      remainingCounts[ch] = (remainingCounts[ch] || 0) + 1;
    }
  }

  for (let i = 0; i < len; i++) {
    if (result[i] === 'correct') continue;
    const ch = guess[i];
    if (remainingCounts[ch] && remainingCounts[ch] > 0) {
      result[i] = 'present';
      remainingCounts[ch] -= 1;
    }
  }

  return result;
}

function validateStrictGuess(
  guess: string,
  prevGuesses: string[],
  prevEvals: LetterState[][]
): string | null {
  if (prevGuesses.length === 0) return null;
  const lastGuess = prevGuesses[prevGuesses.length - 1];
  const lastEval = prevEvals[prevEvals.length - 1];

  for (let i = 0; i < lastEval.length; i++) {
    if (lastEval[i] === 'correct' && guess[i] !== lastGuess[i]) {
      return `Strict mode: position ${i + 1} must be "${lastGuess[i]}"`;
    }
  }
  for (let i = 0; i < lastEval.length; i++) {
    if (lastEval[i] === 'present' && !guess.includes(lastGuess[i])) {
      return `Strict mode: guess must include "${lastGuess[i]}"`;
    }
  }
  return null;
}

const STATE_PRIORITY: Record<LetterState, number> = {
  empty: 0,
  absent: 1,
  present: 2,
  correct: 3,
};

export const LetterLockGame: React.FC<LetterLockGameProps> = ({
  data,
  status,
  initialGuesses,
  siblings,
  activeKeyId,
  onSelectKey,
  onUpdateGuesses,
  onComplete,
  onBack,
}) => {
  const target = data.word.toUpperCase();
  const wordLength = target.length;
  const maxAttempts = data.maxAttempts;

  const [guesses, setGuesses] = useState<string[]>(initialGuesses);
  const [currentInput, setCurrentInput] = useState('');
  const [shakeRow, setShakeRow] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showClue, setShowClue] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);

  const isDone = status !== 'locked';

  const evaluatedRows = useMemo(
    () => guesses.map((g) => evaluateGuess(g, target)),
    [guesses, target]
  );

  const keyStates = useMemo(() => {
    const map: Record<string, LetterState> = {};
    guesses.forEach((guess, rowIdx) => {
      const states = evaluatedRows[rowIdx];
      for (let i = 0; i < guess.length; i++) {
        const ch = guess[i];
        const st = states[i];
        if (!map[ch] || STATE_PRIORITY[st] > STATE_PRIORITY[map[ch]]) {
          map[ch] = st;
        }
      }
    });
    return map;
  }, [guesses, evaluatedRows]);

  const nextLockedSibling = siblings.find(
    (s) => s.keyId !== activeKeyId && s.status === 'locked'
  );

  const triggerShake = (msg: string) => {
    setFeedback(msg);
    setShakeRow(true);
    sound.error();
    window.setTimeout(() => setShakeRow(false), 360);
  };

  const handleSubmit = useCallback(() => {
    if (isDone) return;
    if (currentInput.length < wordLength) {
      triggerShake(`Enter a ${wordLength}-letter word`);
      return;
    }

    if (data.strictMode) {
      const violation = validateStrictGuess(currentInput, guesses, evaluatedRows);
      if (violation) {
        triggerShake(violation);
        return;
      }
    }

    const nextGuesses = [...guesses, currentInput];
    setGuesses(nextGuesses);
    onUpdateGuesses(nextGuesses);
    setCurrentInput('');
    setFeedback(null);

    if (currentInput === target) {
      sound.unlock();
      onComplete('solved', hintsUsed);
    } else if (nextGuesses.length >= maxAttempts) {
      sound.error();
      onComplete('revealed', hintsUsed);
    } else {
      sound.tap();
    }
  }, [
    currentInput,
    data.strictMode,
    evaluatedRows,
    guesses,
    hintsUsed,
    isDone,
    maxAttempts,
    onComplete,
    onUpdateGuesses,
    target,
    wordLength,
  ]);

  const handleChar = useCallback(
    (ch: string) => {
      if (isDone) return;
      if (currentInput.length >= wordLength) return;
      sound.tap();
      setCurrentInput((prev) => prev + ch);
      setFeedback(null);
    },
    [currentInput.length, isDone, wordLength]
  );

  const handleBackspace = useCallback(() => {
    if (isDone) return;
    if (currentInput.length === 0) return;
    sound.deselect();
    setCurrentInput((prev) => prev.slice(0, -1));
  }, [currentInput.length, isDone]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        onBack();
        return;
      }
      if (isDone) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleChar(e.key.toUpperCase());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleBackspace, handleChar, handleSubmit, isDone, onBack]);

  const handleToggleClue = () => {
    if (!showClue) {
      setShowClue(true);
      setHintsUsed((h) => h + 1);
      sound.tap();
    }
  };

  const handleReveal = () => {
    if (isDone) return;
    sound.unlock();
    onComplete('revealed', hintsUsed + 1);
  };

  const tileStyle = (state: LetterState, filled: boolean) => {
    switch (state) {
      case 'correct':
        return 'bg-[#1F7A4C] border-[#145333] dark:border-emerald-300 text-white shadow-sm';
      case 'present':
        return 'bg-[#F6C915] border-[#B37E00] dark:border-[#FFE478] text-[#140321] shadow-sm';
      case 'absent':
        return 'bg-[#55416E] dark:bg-[#24103B] border-[#3F2E54] dark:border-[#6A4A8F] text-white dark:text-[#D5C4E8]';
      default:
        return filled
          ? 'bg-white dark:bg-[#461A75] border-[#2B0938] dark:border-[#F6C915] text-[#1A0424] dark:text-white shadow-sm'
          : 'bg-white dark:bg-[#2F1052] border-[#8B5EC0] dark:border-[#F6C915]/60 text-[#1A0424] dark:text-white shadow-xs';
    }
  };

  const keyStyle = (ch: string) => {
    const st = keyStates[ch];
    if (st === 'correct')
      return 'bg-[#1F7A4C] text-white border-[#145333] dark:border-emerald-300';
    if (st === 'present')
      return 'bg-[#F6C915] text-[#140321] border-[#B37E00] dark:border-[#FFE478]';
    if (st === 'absent')
      return 'bg-[#D0C1E3] dark:bg-[#1E0833] text-[#4E3B66] dark:text-[#8E77AA] border-[#B29DCE] dark:border-[#4A2B6E]';
    return 'bg-white dark:bg-[#3C1666] text-[#1A0424] dark:text-white border-[#8B5EC0] dark:border-[#F6C915]/65 hover:bg-[#F3E9FC] dark:hover:bg-[#501E87] shadow-xs';
  };

  const cellSizeClass =
    wordLength >= 7
      ? 'w-11 h-11 sm:w-13 sm:h-13 text-[24px]'
      : wordLength === 6
      ? 'w-12 h-12 sm:w-14 sm:h-14 text-[26px]'
      : 'w-14 h-14 sm:w-16 sm:h-16 text-[31px]';

  return (
    <div className="w-full max-w-xl mx-auto">
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
            LetterLock
          </h2>
          <p className="text-xs text-[#5C3A78] dark:text-[#C5B3DA]">
            {wordLength} letters · {maxAttempts} tries
            {data.strictMode ? ' · Strict mode' : ''}
          </p>
        </div>
      </div>

      {/* Sibling Switcher when Hard (2) or Expert (3) */}
      {siblings.length > 1 && (
        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[#5C3A78] dark:text-[#C5B3DA]">
            Select LetterLock key
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

      {/* Clue or Completed Banner */}
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 min-h-[36px]">
          {showClue ? (
            <p className="text-sm text-[#4A1C6E] dark:text-[#E2D4F0]">
              <span className="font-bold text-[#2B0938] dark:text-[#F6C915]">Clue:</span>{' '}
              {data.clue}
            </p>
          ) : (
            <p className="text-xs text-[#5C3A78] dark:text-[#C5B3DA]">
              Emerald = right spot · Gold = wrong spot
              {data.strictMode ? ' · Revealed clues required' : ''}
            </p>
          )}
          <div className="flex items-center gap-3 shrink-0">
            {!showClue && (
              <button
                type="button"
                onClick={handleToggleClue}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C3A78] dark:text-[#D6CBE2] hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors whitespace-nowrap cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Show Clue
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

      {/* Feedback line */}
      <div className="h-6 mb-2 flex items-center justify-center">
        {feedback && (
          <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
            {feedback}
          </span>
        )}
      </div>

      {/* Dynamic Rows x WordLength Grid */}
      <div className="flex flex-col items-center gap-2 mb-7">
        {Array.from({ length: maxAttempts }).map((_, rowIdx) => {
          const isSubmitted = rowIdx < guesses.length;
          const isCurrent = rowIdx === guesses.length && !isDone;
          const rowWord = isSubmitted
            ? guesses[rowIdx]
            : isCurrent
            ? currentInput
            : '';
          const states = isSubmitted
            ? evaluatedRows[rowIdx]
            : Array<LetterState>(wordLength).fill('empty');

          return (
            <div
              key={rowIdx}
              style={{
                gridTemplateColumns: `repeat(${wordLength}, minmax(0, 1fr))`,
              }}
              className={`grid gap-1.5 sm:gap-2 ${
                isCurrent && shakeRow ? 'animate-tile-shake' : ''
              }`}
            >
              {Array.from({ length: wordLength }).map((__, colIdx) => {
                const ch = rowWord[colIdx] ?? '';
                const st = states[colIdx];
                return (
                  <div
                    key={colIdx}
                    className={`rounded-lg border-2 flex items-center justify-center font-mono font-bold select-none transition-colors duration-150 ${cellSizeClass} ${tileStyle(
                      st,
                      Boolean(ch)
                    )} ${ch && isCurrent ? 'animate-tile-pop' : ''}`}
                  >
                    {ch}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* On-screen QWERTY Keyboard */}
      <div className="flex flex-col gap-1.5 select-none">
        {KEYBOARD_ROWS.map((row, rIdx) => (
          <div key={rIdx} className="flex justify-center gap-1 sm:gap-1.5">
            {row.map((key) => {
              if (key === 'ENTER') {
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isDone}
                    onClick={handleSubmit}
                    className="h-12 px-2.5 sm:px-4 rounded-lg bg-[#2B0938] dark:bg-[#F6C915] text-[#F6C915] dark:text-[#1D0830] text-xs font-extrabold tracking-wide disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
                  >
                    Enter
                  </button>
                );
              }
              if (key === 'BACK') {
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isDone}
                    onClick={handleBackspace}
                    aria-label="Backspace"
                    className="h-12 px-3 sm:px-4 rounded-lg bg-white dark:bg-[#3C1666] text-[#1A0424] dark:text-white border-2 border-[#8B5EC0] dark:border-[#F6C915]/65 flex items-center justify-center disabled:opacity-40 hover:bg-[#F3E9FC] dark:hover:bg-[#501E87] transition-colors cursor-pointer shadow-xs"
                  >
                    <Delete className="w-4 h-4" />
                  </button>
                );
              }
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isDone}
                  onClick={() => handleChar(key)}
                  className={`h-12 min-w-[30px] sm:min-w-[40px] flex-1 max-w-[46px] rounded-lg border-2 font-mono text-[18px] font-extrabold transition-colors disabled:opacity-50 cursor-pointer ${keyStyle(
                    key
                  )}`}
                >
                  {key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
