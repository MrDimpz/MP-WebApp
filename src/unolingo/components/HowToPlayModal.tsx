import React from 'react';
import { ArrowRight, X } from 'lucide-react';

interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-unolingo-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="How To Play Unolingo"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#22072b] border border-purple-200 dark:border-purple-800/70 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close rules"
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3.5 mb-6">
          <img
            src="/assets/aistudio/3d_logo_944e5372.png"
            alt="Unolingo Logo"
            className="w-12 h-12 rounded-full object-contain drop-shadow-md"
          />
          <div>
            <h2 className="text-2xl font-black text-[#3b0d47] dark:text-white">
              How To Play Unolingo
            </h2>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
              The Missing Piece · 26-Letter Crossword
            </p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-600 dark:text-purple-100/85">
          <div className="flex gap-4 items-start p-4 rounded-2xl bg-purple-50/60 dark:bg-[#310b3e]/60 border border-purple-100 dark:border-purple-800/50">
            <span className="w-7 h-7 rounded-xl bg-amber-400/25 text-[#4a1259] dark:text-amber-300 font-extrabold flex items-center justify-center shrink-0">
              1
            </span>
            <div>
              <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">
                Pure Crossword Deduction
              </h3>
              <p>
                There are no written clues. Every horizontal and vertical sequence of 3–6 squares
                must form a valid common English word.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-2xl bg-purple-50/60 dark:bg-[#310b3e]/60 border border-purple-100 dark:border-purple-800/50">
            <span className="w-7 h-7 rounded-xl bg-amber-400/25 text-[#4a1259] dark:text-amber-300 font-extrabold flex items-center justify-center shrink-0">
              2
            </span>
            <div>
              <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">
                Use Every Letter A–Z Once
              </h3>
              <p>
                The 26 blank white squares accept each letter from{' '}
                <strong className="text-[#3b0d47] dark:text-amber-300">A to Z</strong> once.
                Cream-tinted tiles with dark letters are fixed anchor letters to help you deduce
                intersections.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-2xl bg-purple-50/60 dark:bg-[#310b3e]/60 border border-purple-100 dark:border-purple-800/50">
            <span className="w-7 h-7 rounded-xl bg-amber-400/25 text-[#4a1259] dark:text-amber-300 font-extrabold flex items-center justify-center shrink-0">
              3
            </span>
            <div>
              <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">
                Fast Controls &amp; Drag-and-Drop
              </h3>
              <p>
                Tap any empty cell and type A–Z, click letters in the 26-letter rack, or drag tiles
                directly onto squares. Press <strong className="font-mono">Space</strong> to switch
                Across/Down and use Arrow keys to navigate.
              </p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-2xl bg-purple-50/60 dark:bg-[#310b3e]/60 border border-purple-100 dark:border-purple-800/50">
            <span className="w-7 h-7 rounded-xl bg-amber-400/25 text-[#4a1259] dark:text-amber-300 font-extrabold flex items-center justify-center shrink-0">
              4
            </span>
            <div>
              <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">
                London Reset, Archive &amp; Leaderboards
              </h3>
              <p>
                A new puzzle drops daily at 00:00 London, UK time. Solving today&apos;s puzzle builds
                your Daily Streak and posts your score to the unified public Solo Games
                leaderboard.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-7 w-full py-4 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-[#2d0938] font-black rounded-2xl shadow-[0_5px_0_#92400e] transition-all flex items-center justify-center gap-2 border border-amber-200 cursor-pointer"
        >
          Got It, Let&apos;s Play <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
