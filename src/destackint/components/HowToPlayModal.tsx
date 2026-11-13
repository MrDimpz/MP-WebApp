import React from 'react';
import { X, ArrowRight } from 'lucide-react';

interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#22072b] border border-purple-200 dark:border-purple-800/70 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/50 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3.5 mb-6">
          <img
            src="/assets/aistudio/3d_logo_944e5372.png"
            alt="DeStack Logo"
            className="w-12 h-12 rounded-full object-contain drop-shadow-md"
          />
          <div>
            <h2 className="text-2xl font-black text-[#3b0d47] dark:text-white">How To Play DeStack</h2>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
              The Missing Piece · Find Your Space
            </p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-600 dark:text-purple-100/85">
          <div className="flex gap-4 items-start p-4 rounded-2xl bg-purple-50/60 dark:bg-[#310b3e]/60 border border-purple-100 dark:border-purple-800/50">
            <span className="w-7 h-7 rounded-xl bg-amber-400/25 text-[#4a1259] dark:text-amber-300 font-extrabold flex items-center justify-center shrink-0">1</span>
            <div>
              <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">Clear the 4-Layer Stack</h3>
              <p>Your aim is to clear the 30-tile Stack by finding each of the 6 five-letter words in order. There is always one valid word to find at each step.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-2xl bg-purple-50/60 dark:bg-[#310b3e]/60 border border-purple-100 dark:border-purple-800/50">
            <span className="w-7 h-7 rounded-xl bg-amber-400/25 text-[#4a1259] dark:text-amber-300 font-extrabold flex items-center justify-center shrink-0">2</span>
            <div>
              <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">Pick Exposed Tiles</h3>
              <p>Tap on an <strong className="text-[#3b0d47] dark:text-amber-300">exposed</strong> bright tile. It moves into one of the 5 letter boxes at the bottom, uncovering tiles underneath it in the Stack.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-2xl bg-purple-50/60 dark:bg-[#310b3e]/60 border border-purple-100 dark:border-purple-800/50">
            <span className="w-7 h-7 rounded-xl bg-amber-400/25 text-[#4a1259] dark:text-amber-300 font-extrabold flex items-center justify-center shrink-0">3</span>
            <div>
              <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">Gold Word Flash & Rack Return</h3>
              <p>When you find a valid word, the 5 boxes flash with a <strong className="text-amber-600 dark:text-amber-400">gold border</strong> and keep the word visible until you pick the first letter of the next word. Tap any active rack tile to return it (and subsequent tiles) to the Stack.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start p-4 rounded-2xl bg-purple-50/60 dark:bg-[#310b3e]/60 border border-purple-100 dark:border-purple-800/50">
            <span className="w-7 h-7 rounded-xl bg-amber-400/25 text-[#4a1259] dark:text-amber-300 font-extrabold flex items-center justify-center shrink-0">4</span>
            <div>
              <h3 className="font-bold text-[#2d0938] dark:text-white mb-1">Swipe to Reveal Hint</h3>
              <p>Stuck on a word? Swipe or tap the lightbulb bar at the bottom to reveal a clue for the current 5-letter word.</p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-7 w-full py-4 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-[#2d0938] font-black rounded-2xl shadow-[0_5px_0_#92400e] transition-all flex items-center justify-center gap-2 border border-amber-200"
        >
          Got It, Let's Play <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
