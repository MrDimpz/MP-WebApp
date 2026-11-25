import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Trophy, X } from 'lucide-react';
import { PuzzleData, PuzzleProgress } from '../types';
import { DIFFICULTIES, MINI_GAME_META, TIERS } from '../data/dailyGenerator';
import {
  buildShareText,
  computeGoingDeepScore,
  formatTime,
} from '../utils/storage';

interface ResultsModalProps {
  open: boolean;
  puzzle: PuzzleData;
  progress: PuzzleProgress;
  nextDateKey: string | null;
  nextPuzzleNumber: number | null;
  onClose: () => void;
  onPlayNext: (dateKey: string) => void;
  onOpenLeaderboard: () => void;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  open,
  puzzle,
  progress,
  nextDateKey,
  nextPuzzleNumber,
  onClose,
  onPlayNext,
  onOpenLeaderboard,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const won = progress.status === 'won';
  const diffMeta = DIFFICULTIES[puzzle.difficulty];
  const mistakesUsed = progress.maxMistakes - progress.mistakesRemaining;
  const totalKeys = puzzle.miniGames.length;
  const cleanKeys = puzzle.miniGames.filter(
    (mg) => progress.miniGames[mg.keyId]?.status === 'solved'
  ).length;
  const score = computeGoingDeepScore(puzzle, progress);

  const handleCopy = async () => {
    const text = buildShareText(puzzle, progress);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="results-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0216]/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl bg-[#F7F2FC] dark:bg-[#1E0633] border-2 border-[#D4A437]/60 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 mb-5 border-b border-[#DAC6F0] dark:border-[#D4A437]/25">
          <div>
            <p className="text-xs font-mono font-bold text-[#8F6500] dark:text-[#F6C915]">
              Going Deep #{puzzle.id} · {diffMeta.label} ({diffMeta.keyCount} Keys)
            </p>
            <h2
              id="results-modal-title"
              className="font-display text-2xl font-bold text-[#2B0938] dark:text-[#FAF7FF] mt-0.5"
            >
              {won
                ? mistakesUsed === 0
                  ? 'Flawless Clear'
                  : 'All Layers Solved'
                : 'Board Revealed'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close results"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5C3A78] dark:text-[#D6CBE2] hover:bg-[#EAE0F8] dark:hover:bg-[#310C4F] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mb-5">
          <div className="p-3 rounded-xl bg-white dark:bg-[#290A44] border border-[#DAC6F0] dark:border-[#D4A437]/30">
            <div className="font-mono text-lg font-extrabold tabular-nums text-[#8F6500] dark:text-[#F6C915]">
              {score.toLocaleString()}
            </div>
            <div className="text-[11px] text-[#5C3A78] dark:text-[#C5B3DA]">
              Score
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-[#290A44] border border-[#DAC6F0] dark:border-[#D4A437]/30">
            <div className="font-mono text-lg font-bold tabular-nums text-[#2B0938] dark:text-[#FAF7FF]">
              {cleanKeys}/{totalKeys}
            </div>
            <div className="text-[11px] text-[#5C3A78] dark:text-[#C5B3DA]">
              Keys Solved
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-[#290A44] border border-[#DAC6F0] dark:border-[#D4A437]/30">
            <div className="font-mono text-lg font-bold tabular-nums text-[#2B0938] dark:text-[#FAF7FF]">
              {mistakesUsed}/{progress.maxMistakes}
            </div>
            <div className="text-[11px] text-[#5C3A78] dark:text-[#C5B3DA]">
              Mistakes
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-[#290A44] border border-[#DAC6F0] dark:border-[#D4A437]/30">
            <div className="font-mono text-lg font-bold tabular-nums text-[#2B0938] dark:text-[#FAF7FF]">
              {formatTime(progress.elapsedSeconds)}
            </div>
            <div className="text-[11px] text-[#5C3A78] dark:text-[#C5B3DA]">
              Time
            </div>
          </div>
        </div>

        {/* Visual Spoiler-Free Guess Grid */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#290A44] border border-[#DAC6F0] dark:border-[#D4A437]/30 mb-5">
          <div className="flex items-center justify-between text-xs text-[#5C3A78] dark:text-[#C5B3DA] mb-3">
            <span className="font-semibold">Guess Sequence</span>
            <span className="font-mono tabular-nums">
              {progress.guesses.length}{' '}
              {progress.guesses.length === 1 ? 'turn' : 'turns'}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            {progress.guesses.map((guess, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                {guess.tiers.map((tierId, tIdx) => (
                  <span
                    key={tIdx}
                    title={TIERS[tierId].name}
                    className={`w-7 h-7 rounded-md ${TIERS[tierId].bgClass}`}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-[#EFE5FA] dark:border-[#D4A437]/20">
            <div className="text-xs text-[#5C3A78] dark:text-[#C5B3DA] mb-2">
              Unlocked Keys ({cleanKeys}/{totalKeys} solved cleanly)
            </div>
            <div className="flex flex-wrap gap-x-2.5 gap-y-1 font-mono text-[11px]">
              {puzzle.miniGames.map((mg) => (
                <span
                  key={mg.keyId}
                  title={MINI_GAME_META[mg.type].label}
                  className={
                    progress.miniGames[mg.keyId]?.status === 'solved'
                      ? 'text-[#1E633E] dark:text-emerald-300 font-bold'
                      : 'text-[#6E4B8A] dark:text-[#A993C4]'
                  }
                >
                  {mg.word}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2B0938] hover:bg-[#3F1054] dark:bg-[#F6C915] dark:hover:bg-[#FFE047] text-[#F6C915] dark:text-[#1D0830] text-sm font-extrabold transition-colors whitespace-nowrap cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied Results
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Share Results
                </>
              )}
            </button>
            {nextDateKey !== null && nextPuzzleNumber !== null && (
              <button
                type="button"
                onClick={() => onPlayNext(nextDateKey)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#D5C0EE] dark:border-[#D4A437]/35 bg-white dark:bg-[#290A44] text-sm font-bold text-[#2B0938] dark:text-[#FAF7FF] hover:bg-[#F3E9FC] dark:hover:bg-[#360E57] transition-colors whitespace-nowrap cursor-pointer"
              >
                Play #{nextPuzzleNumber}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLeaderboard();
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#D4A437]/50 bg-[#FFF7D6] dark:bg-[#2B0B45] text-xs font-bold text-[#2B0938] dark:text-[#F6C915] hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5" />
            View Going Deep Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
};
