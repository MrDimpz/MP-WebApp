import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  Check,
  Copy,
  KeyRound,
  Lock,
  RotateCcw,
  Sparkles,
  Trophy,
  Unlock,
  X,
} from 'lucide-react';
import { getWordDefinition } from '../game/dictionary';
import {
  BoardEvaluation,
  buildShareableKeycard,
  computeWordlockScore,
  DIFFICULTY_CONFIGS,
  formatShortDisplayDate,
  getLocksmithRank,
  PuzzleDefinition,
} from '../game/puzzleEngine';

interface EndGameModalProps {
  isOpen: boolean;
  won: boolean;
  puzzle: PuzzleDefinition;
  clicksUsed: number;
  evaluation: BoardEvaluation;
  onClose: () => void;
  onRetry: () => void;
  onNextPuzzle: () => void;
  onOpenArchive: () => void;
  onOpenLeaderboard: () => void;
  darkMode: boolean;
}

export const EndGameModal: React.FC<EndGameModalProps> = ({
  isOpen,
  won,
  puzzle,
  clicksUsed,
  evaluation,
  onClose,
  onRetry,
  onNextPuzzle,
  onOpenArchive,
  onOpenLeaderboard,
  darkMode,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCopied(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const diffConfig = DIFFICULTY_CONFIGS[puzzle.difficulty];
  const rank = getLocksmithRank(won, clicksUsed, puzzle.par, puzzle.rowCount);
  const score = won ? computeWordlockScore(puzzle, clicksUsed) : 0;
  const shareText = buildShareableKeycard(puzzle, won, clicksUsed, evaluation);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#12031E]/82"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wordlock-endgame-title"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-lg max-h-[90dvh] flex flex-col rounded-2xl border-2 shadow-[0_24px_80px_rgba(0,0,0,0.72)] overflow-hidden ${
          darkMode
            ? 'bg-[#1D0731] border-[#D4A437]/55 text-[#F7F3FB]'
            : 'bg-[#FFFFFF] border-[#D5C0EE] text-[#2B0938]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`h-1.5 w-full ${
            won
              ? 'bg-gradient-to-r from-emerald-500 via-[#F6C915] to-emerald-400'
              : 'bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600'
          }`}
        />

        {/* Header */}
        <div
          className={`flex items-start justify-between gap-3 px-5 py-4 border-b ${
            darkMode ? 'border-[#D4A437]/25 bg-[#250A3E]' : 'border-[#E5D7F6] bg-[#F7F1FC]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${
                won
                  ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-400'
                  : 'bg-rose-500/15 border-rose-400/50 text-rose-400'
              }`}
            >
              {won ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.16em] font-bold text-[#F6C915]">
                <span className={darkMode ? 'text-[#F6C915]' : 'text-[#8F6500]'}>
                  {puzzle.label}
                  {puzzle.dateKey ? ` · ${formatShortDisplayDate(puzzle.dateKey)}` : ''} ·{' '}
                  {diffConfig.label} ({puzzle.rowCount}R)
                </span>
              </div>
              <h2
                id="wordlock-endgame-title"
                className="text-xl font-extrabold tracking-tight truncate"
              >
                {rank.title}
              </h2>
              <p className={`text-xs ${darkMode ? 'text-[#D6CBE2]' : 'text-[#5A3E73]'}`}>
                {rank.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close summary"
            className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 cursor-pointer transition-colors ${
              darkMode
                ? 'border-[#D4A437]/30 bg-[#1B052D] text-[#E7DAF2] hover:border-[#F6C915]'
                : 'border-[#D5C0EE] bg-white text-[#4A1C6E] hover:border-[#2B0938]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="wordlock-scroll overflow-y-auto px-5 py-4 space-y-4">
          {/* Metric Strip */}
          <div className="grid grid-cols-3 gap-2.5">
            <div
              className={`rounded-xl border p-3 text-center ${
                darkMode
                  ? 'bg-[#260B3F]/80 border-[#D4A437]/25'
                  : 'bg-[#F7F1FC] border-[#DFCEF4]'
              }`}
            >
              <div
                className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
                  darkMode ? 'text-[#C8B7DB]' : 'text-[#6A4A85]'
                }`}
              >
                Clicks
              </div>
              <div className="font-mono-tabular text-lg font-extrabold mt-0.5">
                {clicksUsed}
                <span className="text-xs opacity-60">/{puzzle.maxClicks}</span>
              </div>
            </div>

            <div
              className={`rounded-xl border p-3 text-center ${
                darkMode
                  ? 'bg-[#260B3F]/80 border-[#D4A437]/25'
                  : 'bg-[#F7F1FC] border-[#DFCEF4]'
              }`}
            >
              <div
                className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
                  darkMode ? 'text-[#C8B7DB]' : 'text-[#6A4A85]'
                }`}
              >
                Vault Par
              </div>
              <div className="font-mono-tabular text-lg font-extrabold mt-0.5 text-[#F6C915]">
                <span className={darkMode ? 'text-[#F6C915]' : 'text-[#9A6E00]'}>
                  {puzzle.par}
                </span>
              </div>
            </div>

            <div
              className={`rounded-xl border p-3 text-center ${
                darkMode
                  ? 'bg-[#260B3F]/80 border-[#D4A437]/25'
                  : 'bg-[#F7F1FC] border-[#DFCEF4]'
              }`}
            >
              <div
                className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
                  darkMode ? 'text-[#C8B7DB]' : 'text-[#6A4A85]'
                }`}
              >
                Score
              </div>
              <div
                className={`font-mono-tabular text-lg font-extrabold mt-0.5 ${
                  won ? 'text-emerald-400' : 'opacity-60'
                }`}
              >
                {won ? score.toLocaleString() : '0'}
              </div>
            </div>
          </div>

          {/* Solution Stack */}
          <div
            className={`rounded-xl border p-3.5 space-y-2 ${
              darkMode
                ? 'bg-[#160524] border-[#D4A437]/25'
                : 'bg-[#FAF6FE] border-[#DFCEF4]'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.14em] font-bold">
              <span className={`flex items-center gap-1.5 ${darkMode ? 'text-[#F6C915]' : 'text-[#8F6500]'}`}>
                <KeyRound className="w-3.5 h-3.5" />
                Vault Combination ({puzzle.rowCount} Rows)
              </span>
              <span className="text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Key: {puzzle.masterKey}
              </span>
            </div>

            <div className="space-y-1.5">
              {puzzle.solutionWords.map((word, idx) => {
                const isMaster = idx === puzzle.masterRowIndex;
                return (
                  <div
                    key={`${word}-${idx}`}
                    className={`flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg border text-xs ${
                      isMaster
                        ? darkMode
                          ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-200'
                          : 'bg-emerald-50 border-emerald-400/60 text-emerald-900'
                        : darkMode
                          ? 'bg-[#24093B]/80 border-[#D4A437]/15 text-[#E8DFF2]'
                          : 'bg-white border-[#E4D6F5] text-[#2B0938]'
                    }`}
                  >
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono-tabular font-extrabold tracking-[0.2em] text-sm">
                        {word}
                      </span>
                      {isMaster && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[9px] font-mono uppercase font-bold text-emerald-400">
                          Master Key
                        </span>
                      )}
                    </div>
                    <span
                      className={`truncate text-right text-[11px] ${
                        darkMode ? 'text-[#C2B0D8]' : 'text-[#6A4A85]'
                      }`}
                    >
                      {getWordDefinition(word)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Share & Leaderboard Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-extrabold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Keycard Copied!' : 'Share Keycard'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenLeaderboard}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs sm:text-sm transition-colors cursor-pointer ${
                darkMode
                  ? 'border-[#D4A437]/40 bg-[#270A42] text-[#F6C915] hover:bg-[#351058]'
                  : 'border-[#D5C0EE] bg-[#F4EBFC] text-[#2B0938] hover:bg-[#EBDDFB]'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Leaderboard</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className={`px-5 py-3.5 border-t flex flex-wrap items-center justify-between gap-2 ${
            darkMode ? 'border-[#D4A437]/25 bg-[#250A3E]' : 'border-[#E5D7F6] bg-[#F7F1FC]'
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                darkMode
                  ? 'border-[#D4A437]/30 bg-[#1B052D] text-[#E7DAF2] hover:border-[#F6C915]'
                  : 'border-[#D5C0EE] bg-white text-[#2B0938] hover:border-[#2B0938]'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry Lock
            </button>

            <button
              type="button"
              onClick={onOpenArchive}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                darkMode
                  ? 'border-[#D4A437]/30 bg-[#1B052D] text-[#E7DAF2] hover:border-[#F6C915]'
                  : 'border-[#D5C0EE] bg-white text-[#2B0938] hover:border-[#2B0938]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              6-Mo Archive
            </button>
          </div>

          <button
            type="button"
            onClick={onNextPuzzle}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0B1C14] font-extrabold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            {puzzle.mode === 'unlimited' ? 'New Unlimited Lock' : 'Play Unlimited Lock'}
          </button>
        </div>
      </div>
    </div>
  );
};
