import { type FormEvent, useRef, useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import type { LadderMode } from '../shared/types';

interface GuessInputBarProps {
  mode: LadderMode;
  disabled: boolean;
  selectedBoardIndex: number | null;
  onSelectBoard: (idx: number | null) => void;
  onSubmitGuess: (word: string) => void;
  feedback: { text: string; tone: 'error' | 'success' | 'info' } | null;
  winNotice?: {
    roundNumber: number;
    onViewWinners: () => void;
  } | null;
  placeholder?: string;
  disabledPlaceholder?: string;
  helperText?: string;
  disabledHelperText?: string;
}

export function GuessInputBar({
  mode,
  disabled,
  selectedBoardIndex,
  onSelectBoard,
  onSubmitGuess,
  feedback,
  winNotice,
  placeholder = 'Type any dictionary word (any length) or let chat guess...',
  disabledPlaceholder = 'Press Start Game to begin guessing...',
  helperText = 'Viewers in chat can type any dictionary word or !guess <word>.',
  disabledHelperText = 'Start a round or connect TikTok LIVE chat to play.',
}: GuessInputBarProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = value.trim();
    if (!cleaned || disabled) return;
    onSubmitGuess(cleaned);
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      {mode === 'quad' && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-[#5C3A78] dark:text-[#C8B2E4] mr-1">Target:</span>
          <button
            type="button"
            onClick={() => onSelectBoard(null)}
            className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              selectedBoardIndex === null
                ? 'bg-[#F6C915] text-[#1D0830]'
                : 'bg-white dark:bg-[#210736] text-[#4C266D] dark:text-[#D9C7EE] border border-[#D7C4EC] dark:border-[#D4A437]/30 hover:text-[#2B0938] dark:hover:text-white'
            }`}
          >
            All 4 Boards
          </button>
          {[0, 1, 2, 3].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectBoard(idx)}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                selectedBoardIndex === idx
                  ? 'bg-[#F6C915] text-[#1D0830]'
                  : 'bg-white dark:bg-[#210736] text-[#4C266D] dark:text-[#D9C7EE] border border-[#D7C4EC] dark:border-[#D4A437]/30 hover:text-[#2B0938] dark:hover:text-white'
              }`}
            >
              Board {idx + 1}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-stretch gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          placeholder={disabled ? disabledPlaceholder : placeholder}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
          aria-label="Enter any dictionary word guess"
          className="flex-1 min-w-0 rounded-xl border border-[#C8AEDF] dark:border-[#D4A437]/40 bg-white dark:bg-[#140321] px-4 py-3 font-mono text-base font-bold tracking-wider uppercase text-[#2B0938] dark:text-white placeholder:normal-case placeholder:tracking-normal placeholder:font-sans placeholder:font-normal placeholder:text-[#7E5E9B] dark:placeholder:text-[#9F84C2] focus:border-[#B58100] dark:focus:border-[#F6C915] focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || value.trim().length < 2}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F6C915] px-5 py-3 text-sm font-extrabold text-[#1D0830] hover:bg-[#FFE047] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
        >
          <span>Guess</span>
          <CornerDownLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      {/* Fixed-height status/feedback row so errors, solves, and wins never resize the container */}
      <div className="h-5 flex items-center justify-between gap-3">
        {feedback ? (
          <p
            role="status"
            className={`text-xs font-semibold truncate ${
              feedback.tone === 'error'
                ? 'text-rose-600 dark:text-rose-300'
                : feedback.tone === 'success'
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-[#8F6500] dark:text-[#F6C915]'
            }`}
          >
            {feedback.text}
          </p>
        ) : winNotice ? (
          <div className="flex items-center justify-between gap-3 w-full">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 truncate">
              Round #{winNotice.roundNumber} solved!
            </span>
            <button
              type="button"
              onClick={winNotice.onViewWinners}
              className="text-xs font-extrabold text-[#8F6500] dark:text-[#F6C915] hover:underline cursor-pointer whitespace-nowrap shrink-0"
            >
              View Winners
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-[#6E4D8B] dark:text-[#9F84C2] truncate">
            {disabled ? disabledHelperText : helperText}
          </span>
        )}
      </div>
    </div>
  );
}
