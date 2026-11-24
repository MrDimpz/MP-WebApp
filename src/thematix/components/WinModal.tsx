import React from 'react';
import { Trophy, Star, Eye, Calendar, Shuffle, Sparkles, X, Crown } from 'lucide-react';
import { Puzzle } from '../types/game';

interface WinModalProps {
  isOpen: boolean;
  puzzle: Puzzle;
  letterGuessesCount: number;
  showGrumpySprayBanner?: boolean;
  onClose: () => void;
  onSelectNext: () => void;
  onSelectRandom: () => void;
  onOpenArchive: () => void;
  onOpenLeaderboardPopup?: () => void;
}

export const WinModal: React.FC<WinModalProps> = ({
  isOpen,
  puzzle,
  letterGuessesCount,
  showGrumpySprayBanner = false,
  onClose,
  onSelectRandom,
  onOpenArchive,
  onOpenLeaderboardPopup,
}) => {
  if (!isOpen) return null;

  // Star rating logic
  const getRating = (count: number) => {
    if (count === 0) {
      return { stars: 3, label: 'Flawless! 0-Guess Achievement', color: 'text-amber-500', isZero: true };
    }
    if (count <= 3) return { stars: 3, label: 'Mastermind!', color: 'text-amber-500', isZero: false };
    if (count <= 7) return { stars: 2, label: 'Word Detective!', color: 'text-purple-500', isZero: false };
    return { stars: 1, label: 'Puzzle Solved!', color: 'text-emerald-500', isZero: false };
  };

  const rating = getRating(letterGuessesCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative max-w-lg w-full">
        {showGrumpySprayBanner && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none select-none absolute -inset-x-4 sm:-inset-x-8 top-[16%] sm:top-[18%] z-30 -rotate-6 animate-in zoom-in-95 fade-in duration-300 drop-shadow-[0_14px_24px_rgba(0,0,0,0.65)]"
          >
            <svg
              viewBox="0 0 640 215"
              className="w-full h-auto overflow-visible"
              aria-label="I'm sure you lot are cheating! LoL"
            >
              <defs>
                <filter id="thematix-spray-edge" x="-15%" y="-25%" width="130%" height="160%">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.065 0.14"
                    numOctaves="4"
                    seed="17"
                    result="noise"
                  />
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="noise"
                    scale="14"
                    xChannelSelector="R"
                    yChannelSelector="G"
                  />
                </filter>
                <filter id="thematix-spray-mist" x="-20%" y="-30%" width="140%" height="170%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.22"
                    numOctaves="3"
                    seed="9"
                    result="grain"
                  />
                  <feDisplacementMap
                    in="blur"
                    in2="grain"
                    scale="10"
                    xChannelSelector="R"
                    yChannelSelector="B"
                  />
                </filter>
                <linearGradient id="thematix-spray-fill" x1="0%" y1="0%" x2="100%" y2="12%">
                  <stop offset="0%" stopColor="#14081c" stopOpacity="0.96" />
                  <stop offset="50%" stopColor="#1e0a2b" stopOpacity="0.98" />
                  <stop offset="100%" stopColor="#120718" stopOpacity="0.96" />
                </linearGradient>
                <linearGradient id="thematix-spray-text" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#d9ff2e" />
                  <stop offset="52%" stopColor="#fff14d" />
                  <stop offset="100%" stopColor="#ff6b9d" />
                </linearGradient>
              </defs>

              {/* Soft neon aerosol overspray cloud */}
              <path
                d="M 28 72 C 130 34, 515 26, 616 62 C 632 95, 622 140, 602 152 C 475 170, 145 174, 34 156 C 14 132, 12 92, 28 72 Z"
                fill="#ec4899"
                opacity="0.48"
                filter="url(#thematix-spray-mist)"
              />
              <path
                d="M 42 58 C 170 28, 490 36, 606 72 C 622 104, 608 142, 588 156 C 460 176, 150 166, 44 148 C 24 124, 24 84, 42 58 Z"
                fill="#a3e635"
                opacity="0.34"
                filter="url(#thematix-spray-mist)"
              />

              {/* Main jagged spray-painted banner body */}
              <path
                d="M 26 62 L 154 44 L 315 50 L 490 38 L 614 54 L 626 98 L 610 144 L 468 154 L 296 149 L 136 158 L 20 142 L 12 96 Z"
                fill="url(#thematix-spray-fill)"
                stroke="#d9ff2e"
                strokeWidth="4.5"
                strokeOpacity="0.88"
                filter="url(#thematix-spray-edge)"
              />

              {/* Secondary accent spray streak */}
              <path
                d="M 48 134 C 190 142, 435 138, 594 126"
                fill="none"
                stroke="#ff3d8b"
                strokeWidth="7"
                strokeLinecap="round"
                opacity="0.78"
                filter="url(#thematix-spray-edge)"
              />

              {/* Paint drips hanging off bottom of the sprayed banner */}
              <g fill="#d9ff2e" opacity="0.92">
                <path d="M 96 150 C 94 168, 92 184, 96 191 C 100 197, 104 190, 102 180 C 101 169, 102 158, 102 150 Z" />
                <path d="M 218 148 C 216 160, 216 168, 220 173 C 223 176, 226 171, 225 163 C 224 156, 224 152, 224 148 Z" />
                <path d="M 526 146 C 524 166, 522 188, 527 196 C 531 202, 536 194, 534 182 C 532 169, 533 156, 533 146 Z" />
              </g>
              <g fill="#ff3d8b" opacity="0.9">
                <path d="M 152 152 C 150 165, 149 175, 153 180 C 156 184, 159 179, 158 171 C 157 163, 158 156, 158 152 Z" />
                <path d="M 404 149 C 402 168, 401 182, 405 188 C 409 193, 413 186, 411 176 C 410 166, 410 155, 410 149 Z" />
                <path d="M 578 140 C 577 154, 576 163, 580 168 C 583 172, 586 167, 585 159 C 584 151, 584 145, 584 140 Z" />
              </g>

              {/* Aerosol splatter dots around edges */}
              <g fill="#d9ff2e" opacity="0.88">
                <circle cx="14" cy="54" r="3.2" />
                <circle cx="32" cy="36" r="2.2" />
                <circle cx="72" cy="30" r="2.8" />
                <circle cx="268" cy="24" r="2.1" />
                <circle cx="566" cy="28" r="3.4" />
                <circle cx="624" cy="40" r="2.6" />
                <circle cx="634" cy="128" r="2.8" />
                <circle cx="48" cy="172" r="2.6" />
                <circle cx="298" cy="176" r="2.4" />
                <circle cx="596" cy="176" r="3.1" />
              </g>
              <g fill="#ff3d8b" opacity="0.85">
                <circle cx="22" cy="162" r="3.6" />
                <circle cx="118" cy="24" r="2.4" />
                <circle cx="446" cy="22" r="3.1" />
                <circle cx="614" cy="164" r="2.5" />
                <circle cx="352" cy="178" r="2.9" />
                <circle cx="632" cy="72" r="2.2" />
                <circle cx="6" cy="112" r="2.4" />
              </g>

              {/* Stenciled spray-painted message */}
              <text
                x="320"
                y="93"
                textAnchor="middle"
                fill="#09030f"
                stroke="#09030f"
                strokeWidth="10"
                strokeLinejoin="round"
                fontFamily="'Marker Felt', 'Comic Sans MS', 'Impact', system-ui, sans-serif"
                fontWeight="900"
                fontSize="35"
                letterSpacing="0.5"
              >
                I&apos;m sure you lot are
              </text>
              <text
                x="320"
                y="93"
                textAnchor="middle"
                fill="url(#thematix-spray-text)"
                fontFamily="'Marker Felt', 'Comic Sans MS', 'Impact', system-ui, sans-serif"
                fontWeight="900"
                fontSize="35"
                letterSpacing="0.5"
              >
                I&apos;m sure you lot are
              </text>

              <text
                x="320"
                y="134"
                textAnchor="middle"
                fill="#09030f"
                stroke="#09030f"
                strokeWidth="11"
                strokeLinejoin="round"
                fontFamily="'Marker Felt', 'Comic Sans MS', 'Impact', system-ui, sans-serif"
                fontWeight="900"
                fontSize="41"
                letterSpacing="1"
              >
                cheating! LoL
              </text>
              <text
                x="320"
                y="134"
                textAnchor="middle"
                fill="#ffffff"
                stroke="#ff3d8b"
                strokeWidth="1.6"
                fontFamily="'Marker Felt', 'Comic Sans MS', 'Impact', system-ui, sans-serif"
                fontWeight="900"
                fontSize="41"
                letterSpacing="1"
              >
                cheating! LoL
              </text>
            </svg>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full p-6 text-center relative overflow-hidden">
          {/* Confetti header graphic */}
          <div className="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-[#f5b82e] via-purple-600 to-[#ffd166]" />

          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-40 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close to view board"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Trophy icon */}
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center shadow-inner border border-amber-300/40">
            <Trophy className="w-9 h-9 stroke-[2.2]" />
          </div>

          <h3 className="text-2xl font-serif-title font-bold text-slate-900 dark:text-white">
            Brilliant Solving!
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {puzzle.formattedDate}
          </p>

        {/* Rating stars with spinning 100% larger logo on either side with a 20px gap */}
        <div className="flex items-center justify-center my-4 gap-[20px]">
          <img
            src="/assets/aistudio/3d_logo_944e5372.png"
            alt="The Missing Piece Logo"
            className="w-32 h-32 sm:w-40 sm:h-40 shrink-0 object-contain drop-shadow-md select-none animate-[spin_4s_linear_infinite]"
          />
          <div className="flex items-center justify-center gap-1.5 shrink-0">
            {[1, 2, 3].map((star) => (
              <Star
                key={star}
                className={`w-7 h-7 ${
                  star <= rating.stars
                    ? 'text-amber-400 fill-amber-400 scale-105'
                    : 'text-slate-200 dark:text-slate-700'
                }`}
              />
            ))}
          </div>
          <img
            src="/assets/aistudio/3d_logo_944e5372.png"
            alt="The Missing Piece Logo"
            className="w-32 h-32 sm:w-40 sm:h-40 shrink-0 object-contain drop-shadow-md select-none animate-[spin_4s_linear_infinite]"
          />
        </div>
        <div
          className={`text-sm font-bold mb-4 flex items-center justify-center gap-1.5 ${
            rating.isZero
              ? 'text-amber-500 dark:text-amber-400'
              : 'text-slate-800 dark:text-slate-200'
          }`}
        >
          {rating.isZero && <Crown className="w-4 h-4 fill-amber-400 text-amber-500" />}
          <span>{rating.label}</span>
        </div>

        {/* Score metrics */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div
            className={`p-3 rounded-2xl border ${
              rating.isZero
                ? 'bg-gradient-to-b from-amber-100 to-amber-50 dark:from-amber-950/60 dark:to-amber-900/30 border-amber-400/70 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800'
            }`}
          >
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Letter Guesses
            </span>
            <span className="text-2xl font-bold font-mono text-amber-500 dark:text-amber-400 inline-flex items-center justify-center gap-1">
              {rating.isZero && <Crown className="w-5 h-5 fill-amber-400/40" />}
              {letterGuessesCount}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Words Solved
            </span>
            <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
              6 / 6
            </span>
          </div>
        </div>

        {/* Fun Fact / Trivia Card */}
        {puzzle.funFact && (
          <div className="text-left bg-purple-50/60 dark:bg-purple-950/20 p-3.5 rounded-2xl border border-purple-100 dark:border-purple-900/40 mb-5">
            <div className="flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[#f5b82e]" />
              <span>Theme Trivia</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {puzzle.funFact}
            </p>
          </div>
        )}

        {/* View Game Button (Closes popup to view completed board) */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-[#f5b82e] via-[#ffd166] to-[#f5b82e] hover:brightness-105 active:scale-98 text-[#220536] flex items-center justify-center gap-2 shadow-md shadow-amber-500/25 transition-all cursor-pointer mb-2.5 border border-amber-300"
        >
          <Eye className="w-4 h-4 text-[#220536]" />
          <span>View Game</span>
        </button>

        {onOpenLeaderboardPopup && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLeaderboardPopup();
            }}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#2B0938] text-[#F6C915] hover:opacity-95 flex items-center justify-center gap-1.5 transition-opacity cursor-pointer mb-2.5"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>View Thematix Leaderboard</span>
          </button>
        )}

        {/* Next / Archive actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenArchive();
            }}
            className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Select Date</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectRandom();
            }}
            className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Random Puzzle</span>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};
