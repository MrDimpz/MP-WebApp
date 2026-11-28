import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface HowToPlayModalProps {
  open: boolean;
  darkMode: boolean;
  onClose: () => void;
}

const DEMO_LEFT = [
  ['G', 'R', 'A'],
  ['E', '#', '#'],
  ['C', 'E', 'L'],
];

const DEMO_MID = [
  ['P', 'P', 'L'],
  ['P', '#', 'A'],
  ['E', 'B', 'R'],
];

const DEMO_RIGHT = [
  ['I', 'N', 'G'],
  ['#', '#', 'H'],
  ['A', 'N', 'T'],
];

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ open, darkMode, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-2xl border-2 p-6 shadow-2xl ${
          darkMode
            ? 'border-[#D4A437] bg-[#1E0530] text-[#FAF7FF]'
            : 'border-[#D4A437] bg-[#FFFFFF] text-[#1D0830]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2
            id="how-to-play-title"
            className={`font-display text-2xl font-extrabold ${
              darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
            }`}
          >
            How to Play CrossJig
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors cursor-pointer ${
              darkMode
                ? 'text-[#D6CBE2] hover:bg-white/10 hover:text-white'
                : 'text-[#5E3A73] hover:bg-[#F5EFFA] hover:text-[#1D0830]'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p
          className={`mt-2 text-sm leading-relaxed ${
            darkMode ? 'text-[#D6CBE2]' : 'text-[#5E3A73]'
          }`}
        >
          Reassemble a scrambled crossword from 3×3 square word fragments so that every horizontal
          and vertical line spells a real English word.
        </p>

        {/* Visual Mini Diagram */}
        <div
          className={`mt-5 rounded-xl border p-4 ${
            darkMode
              ? 'border-[#D4A437]/40 bg-[#140322]'
              : 'border-[#D9C6EC] bg-[#F6F0FA]'
          }`}
        >
          <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-2">
            {[DEMO_LEFT, DEMO_MID, DEMO_RIGHT].map((block, bIdx) => (
              <div
                key={bIdx}
                className="grid aspect-square grid-cols-3 grid-rows-3 gap-[1px] rounded-[4px] border border-[#D4A437]/60 bg-[#3B1054] overflow-hidden"
              >
                {block.flat().map((ch, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-center text-[11px] font-extrabold ${
                      ch === '#' ? 'bg-[#160424]' : 'bg-[#FAF7F0] text-[#1D0830]'
                    }`}
                  >
                    {ch === '#' ? '' : ch}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p
            className={`mt-3 text-center text-xs ${
              darkMode ? 'text-[#D6CBE2]' : 'text-[#5E3A73]'
            }`}
          >
            Align seams horizontally and vertically:{' '}
            <strong
              className={`font-mono-tabular ${
                darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
              }`}
            >
              GRAPPLING
            </strong>{' '}
            ·{' '}
            <strong
              className={`font-mono-tabular ${
                darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
              }`}
            >
              CELEBRANT
            </strong>
          </p>
        </div>

        <ol
          className={`mt-5 space-y-2.5 text-sm ${
            darkMode ? 'text-[#E7DDF2]' : 'text-[#2B0938]'
          }`}
        >
          <li>
            <strong className={darkMode ? 'font-bold text-[#F6C915]' : 'font-bold text-[#1D0830]'}>
              1. Drag or tap to swap.
            </strong>{' '}
            Touch and drag any 3×3 fragment onto another slot to swap positions, or tap two tiles in
            sequence.
          </li>
          <li>
            <strong className={darkMode ? 'font-bold text-[#F6C915]' : 'font-bold text-[#1D0830]'}>
              2. Watch black-square patterns.
            </strong>{' '}
            Black squares and interlocking letters narrow down where each fragment fits.
          </li>
          <li>
            <strong className={darkMode ? 'font-bold text-[#F6C915]' : 'font-bold text-[#1D0830]'}>
              3. Pin, Check, or use a Hint.
            </strong>{' '}
            Pin tiles you are confident about, use Check for a brief placement check, or turn on
            Auto-lock for a relaxed session.
          </li>
          <li>
            <strong className={darkMode ? 'font-bold text-[#F6C915]' : 'font-bold text-[#1D0830]'}>
              4. 1-Year Daily Archive.
            </strong>{' '}
            Open the Archive calendar anytime to play or revisit any daily 3×5 crossword jigsaw
            from the trailing 365 days.
          </li>
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-[44px] w-full rounded-xl bg-[#F6C915] px-4 py-2.5 text-sm font-extrabold text-[#1D0830] transition-colors hover:bg-[#FFE047] cursor-pointer"
        >
          Back to Puzzle
        </button>
      </div>
    </div>
  );
};
