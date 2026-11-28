import React from 'react';
import { CrosswordPuzzle, GridScale, SCALE_CONFIG } from '../utils/crosswordGenerator';
import { Award, CheckCircle2, Compass, Play, RotateCcw, Sparkles, Trophy, X } from 'lucide-react';

interface SummaryModalProps {
  isOpen: boolean;
  isVictory: boolean;
  puzzle: CrosswordPuzzle;
  solvedWordsCount: number;
  filledCellsCount: number;
  hintsUsed: number;
  elapsedSeconds: number;
  atlasScore: number;
  streamLayout: boolean;
  onChangeStreamLayout: (stream: boolean) => void;
  onClose: () => void;
  onRestartPuzzle: () => void;
  onChangeScale: (scale: GridScale) => void;
  onReturnToTitle: () => void;
  onAutoSolveEntireBoard: () => void;
  onOpenLeaderboard: () => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({
  isOpen,
  isVictory,
  puzzle,
  solvedWordsCount,
  filledCellsCount,
  hintsUsed,
  elapsedSeconds,
  atlasScore,
  streamLayout,
  onChangeStreamLayout,
  onClose,
  onRestartPuzzle,
  onChangeScale,
  onReturnToTitle,
  onAutoSolveEntireBoard,
  onOpenLeaderboard,
}) => {
  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const rem = secs % 60;
    if (hrs > 0) {
      return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(rem).padStart(2, '0')}s`;
    }
    return `${String(mins).padStart(2, '0')}m ${String(rem).padStart(2, '0')}s`;
  };

  const wordCompletionPct =
    puzzle.words.length > 0 ? Math.round((solvedWordsCount / puzzle.words.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white dark:bg-[#1a0624] border-2 border-[#D4A437] rounded-2xl shadow-2xl overflow-hidden text-[#2B0938] dark:text-[#F5F3F7] max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-purple-200 dark:border-purple-800/70 bg-purple-50/80 dark:bg-[#240938]">
          <div className="flex items-center gap-2.5">
            {isVictory ? (
              <Award className="w-5 h-5 text-amber-500 dark:text-[#F6C915]" />
            ) : (
              <Compass className="w-5 h-5 text-amber-500 dark:text-[#F6C915]" />
            )}
            <h2 className="text-lg font-extrabold tracking-tight text-[#3b0d47] dark:text-white">
              {isVictory ? 'MP Colossal Atlas Completed!' : 'Atlas Pause & Expedition Log'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Resume Game"
            className="p-1.5 text-slate-500 dark:text-purple-300 hover:text-[#3b0d47] dark:hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs text-amber-600 dark:text-[#F6C915] font-mono-tabular font-bold">
                {SCALE_CONFIG[puzzle.scale].label} · {puzzle.rows}×{puzzle.cols} Grid
              </div>
              <p className="text-sm text-slate-600 dark:text-purple-200/85">
                {isVictory
                  ? 'Every interlocking word across the Missing Piece broadsheet has been verified.'
                  : 'Progress saves automatically to your profile session. Switch scales or view leaderboards below.'}
              </p>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-[#2B0938] text-[#F6C915] border border-[#D4A437]/60 text-right shrink-0">
              <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-purple-200">
                Atlas Score
              </div>
              <div className="text-lg font-extrabold font-mono-tabular">
                {atlasScore.toLocaleString()} pts
              </div>
            </div>
          </div>

          {/* Tabular Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-purple-50 dark:bg-[#11031A] border border-purple-200 dark:border-purple-800/70 rounded-xl">
              <div className="text-xs text-slate-500 dark:text-purple-300">Words Solved</div>
              <div className="text-lg font-bold font-mono-tabular text-[#3b0d47] dark:text-white mt-1">
                {solvedWordsCount.toLocaleString()} / {puzzle.words.length.toLocaleString()}
              </div>
              <div className="text-[11px] font-mono-tabular text-emerald-600 dark:text-emerald-400 mt-0.5 font-semibold">
                {wordCompletionPct}% Complete
              </div>
            </div>

            <div className="p-3.5 bg-purple-50 dark:bg-[#11031A] border border-purple-200 dark:border-purple-800/70 rounded-xl">
              <div className="text-xs text-slate-500 dark:text-purple-300">Squares Filled</div>
              <div className="text-lg font-bold font-mono-tabular text-[#3b0d47] dark:text-white mt-1">
                {filledCellsCount.toLocaleString()}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-500 dark:text-purple-300/75 mt-0.5">
                of {puzzle.totalWhiteCells.toLocaleString()} letters
              </div>
            </div>

            <div className="p-3.5 bg-purple-50 dark:bg-[#11031A] border border-purple-200 dark:border-purple-800/70 rounded-xl">
              <div className="text-xs text-slate-500 dark:text-purple-300">Elapsed Time</div>
              <div className="text-lg font-bold font-mono-tabular text-[#3b0d47] dark:text-white mt-1">
                {formatTime(elapsedSeconds)}
              </div>
              <div className="text-[11px] font-mono-tabular text-slate-500 dark:text-purple-300/75 mt-0.5">
                Active session
              </div>
            </div>

            <div className="p-3.5 bg-purple-50 dark:bg-[#11031A] border border-purple-200 dark:border-purple-800/70 rounded-xl">
              <div className="text-xs text-slate-500 dark:text-purple-300">Hints Used</div>
              <div className="text-lg font-bold font-mono-tabular text-[#3b0d47] dark:text-white mt-1">
                {hintsUsed}
              </div>
              <div className="text-[11px] font-mono-tabular text-amber-600 dark:text-[#F6C915] mt-0.5 font-semibold">
                3-Tier Assist
              </div>
            </div>
          </div>

          {/* Switch Scale Quickly */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#581c6b] dark:text-purple-300">
              Switch Atlas Grid Size
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['colossal', 'grand', 'district'] as GridScale[]).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => {
                    onChangeScale(sc);
                    onClose();
                  }}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer whitespace-nowrap ${
                    puzzle.scale === sc
                      ? 'bg-[#F6C915] border-[#D4A437] text-[#1D0830]'
                      : 'bg-purple-50 dark:bg-[#11031A] border-purple-200 dark:border-purple-800/70 text-[#4a1259] dark:text-purple-200 hover:border-[#F6C915]'
                  }`}
                >
                  {SCALE_CONFIG[sc].size}×{SCALE_CONFIG[sc].size} Grid
                </button>
              ))}
            </div>
          </div>

          {/* Viewport Layout Selector */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#581c6b] dark:text-purple-300">
              Viewport Layout
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onChangeStreamLayout(false);
                  onClose();
                }}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer whitespace-nowrap ${
                  !streamLayout
                    ? 'bg-[#F6C915] border-[#D4A437] text-[#1D0830]'
                    : 'bg-purple-50 dark:bg-[#11031A] border-purple-200 dark:border-purple-800/70 text-[#4a1259] dark:text-purple-200 hover:border-[#F6C915]'
                }`}
              >
                Full Atlas Viewport
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeStreamLayout(true);
                  onClose();
                }}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer whitespace-nowrap ${
                  streamLayout
                    ? 'bg-[#F6C915] border-[#D4A437] text-[#1D0830]'
                    : 'bg-purple-50 dark:bg-[#11031A] border-purple-200 dark:border-purple-800/70 text-[#4a1259] dark:text-purple-200 hover:border-[#F6C915]'
                }`}
              >
                Stream Layout (12×12)
              </button>
            </div>
          </div>

          {/* Primary & Secondary Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-purple-200 dark:border-purple-800/70">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRestartPuzzle}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#4a1259] dark:text-purple-100 bg-purple-100 dark:bg-[#240938] hover:bg-purple-200 dark:hover:bg-purple-900 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Grid</span>
              </button>

              {!isVictory && (
                <button
                  type="button"
                  onClick={onAutoSolveEntireBoard}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-700 dark:text-[#F6C915] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/35 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Reveal Full Atlas</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-700 dark:text-[#F6C915] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/35 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Leaderboard</span>
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onReturnToTitle}
                className="px-3.5 py-2 text-xs font-bold text-[#4a1259] dark:text-purple-200 bg-purple-50 dark:bg-[#11031A] border border-purple-200 dark:border-purple-800/70 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              >
                Title Screen
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold text-[#1D0830] bg-[#F6C915] hover:bg-[#FFE047] rounded-xl shadow-md transition-colors cursor-pointer whitespace-nowrap"
              >
                {isVictory ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isVictory ? 'Inspect Board' : 'Resume'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
