import React, { useEffect } from 'react';
import { Calendar, Shuffle, Sparkles, Trophy, X } from 'lucide-react';
import { formatDisplayDate } from '../game/generator';
import { computeCrossjigScore, GameMode, MODE_CONFIGS, PlayerStats } from '../game/types';
import { formatDuration } from './PuzzleLedger';

interface CompletionModalProps {
  open: boolean;
  darkMode: boolean;
  mode: GameMode;
  dailyDate?: string;
  todayDateKey: string;
  elapsedSeconds: number;
  movesCount: number;
  hintsUsed: number;
  wordCount: number;
  lastScore: number | null;
  stats: PlayerStats;
  onClose: () => void;
  onPlayRandom: () => void;
  onOpenCalendar: () => void;
  onOpenLeaderboard: () => void;
}

export const CompletionModal: React.FC<CompletionModalProps> = ({
  open,
  darkMode,
  mode,
  dailyDate,
  todayDateKey,
  elapsedSeconds,
  movesCount,
  hintsUsed,
  wordCount,
  lastScore,
  stats,
  onClose,
  onPlayRandom,
  onOpenCalendar,
  onOpenLeaderboard,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const modeCfg = MODE_CONFIGS[mode];
  const score =
    lastScore ?? computeCrossjigScore(mode, elapsedSeconds, movesCount, hintsUsed);
  const isTodayDaily = mode === 'daily' && (!dailyDate || dailyDate === todayDateKey);
  const subtitle =
    mode === 'daily'
      ? `${isTodayDaily ? 'Daily Challenge' : 'Archive Challenge'} · ${formatDisplayDate(
          dailyDate || todayDateKey
        )}`
      : `${modeCfg.label} · ${modeCfg.description}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crossjig-completion-title"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-md rounded-3xl border-2 p-6 shadow-2xl transition-colors ${
          darkMode
            ? 'border-[#D4A437] bg-[#1E0530] text-[#FAF7FF]'
            : 'border-[#D4A437] bg-[#FFFFFF] text-[#1D0830]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close completion pop-up"
          className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl transition-colors cursor-pointer ${
            darkMode
              ? 'text-[#D6CBE2] hover:bg-white/10 hover:text-[#F6C915]'
              : 'text-[#5E3A73] hover:bg-[#F3EBF9] hover:text-[#2B0938]'
          }`}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="pr-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F6C915]/20 border border-[#F6C915]/50 px-3 py-1 text-[11px] font-mono font-extrabold uppercase tracking-wider text-[#D4A437] dark:text-[#F6C915]">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>Crossword Fused</span>
          </div>

          <h2
            id="crossjig-completion-title"
            className={`mt-2.5 font-display text-2xl sm:text-3xl font-extrabold tracking-tight ${
              darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
            }`}
          >
            Puzzle Complete!
          </h2>

          <p
            className={`mt-1 text-xs sm:text-sm font-medium ${
              darkMode ? 'text-[#D6CBE2]' : 'text-[#5E3A73]'
            }`}
          >
            {subtitle}
          </p>
        </div>

        {/* Score Banner */}
        <div
          className={`mt-5 flex items-center justify-between rounded-2xl border px-4 py-3 ${
            darkMode
              ? 'border-[#F6C915]/45 bg-[#2A0944]'
              : 'border-[#D4A437] bg-[#FBF7EE]'
          }`}
        >
          <span
            className={`text-xs font-extrabold uppercase tracking-wider ${
              darkMode ? 'text-[#D6CBE2]' : 'text-[#5E3A73]'
            }`}
          >
            Puzzle Score
          </span>
          <span className="font-mono-tabular text-xl font-black text-[#10B981]">
            +{score.toLocaleString()} pts
          </span>
        </div>

        {/* Telemetry Grid */}
        <div className="mt-3.5 grid grid-cols-3 gap-2.5 text-center">
          <div
            className={`rounded-xl border p-2.5 ${
              darkMode
                ? 'border-[#D4A437]/25 bg-[#150324]'
                : 'border-[#E6DAF2] bg-[#F8F4FC]'
            }`}
          >
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${
                darkMode ? 'text-[#C2B2D4]' : 'text-[#6D4C82]'
              }`}
            >
              Time
            </div>
            <div className="mt-0.5 font-mono-tabular text-base font-extrabold">
              {formatDuration(elapsedSeconds)}
            </div>
          </div>

          <div
            className={`rounded-xl border p-2.5 ${
              darkMode
                ? 'border-[#D4A437]/25 bg-[#150324]'
                : 'border-[#E6DAF2] bg-[#F8F4FC]'
            }`}
          >
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${
                darkMode ? 'text-[#C2B2D4]' : 'text-[#6D4C82]'
              }`}
            >
              Moves
            </div>
            <div className="mt-0.5 font-mono-tabular text-base font-extrabold">
              {movesCount}
            </div>
          </div>

          <div
            className={`rounded-xl border p-2.5 ${
              darkMode
                ? 'border-[#D4A437]/25 bg-[#150324]'
                : 'border-[#E6DAF2] bg-[#F8F4FC]'
            }`}
          >
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${
                darkMode ? 'text-[#C2B2D4]' : 'text-[#6D4C82]'
              }`}
            >
              Words
            </div>
            <div
              className={`mt-0.5 font-mono-tabular text-base font-extrabold ${
                darkMode ? 'text-[#F6C915]' : 'text-[#2B0938]'
              }`}
            >
              {wordCount}
            </div>
          </div>
        </div>

        {/* Primary Action Buttons: Random & Calendar */}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onPlayRandom}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#F6C915] px-4 py-2.5 text-sm font-extrabold text-[#1D0830] shadow-sm transition-all hover:bg-[#FFE047] active:scale-[0.98] cursor-pointer"
          >
            <Shuffle className="h-4 w-4 shrink-0" />
            <span>Random</span>
          </button>

          <button
            type="button"
            onClick={onOpenCalendar}
            className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-extrabold transition-all active:scale-[0.98] cursor-pointer ${
              darkMode
                ? 'border-[#F6C915] bg-[#2B0944] text-[#F6C915] hover:bg-[#380C59]'
                : 'border-[#2B0938] bg-[#2B0938] text-[#F6C915] hover:bg-[#3B0D4E]'
            }`}
          >
            <Calendar className="h-4 w-4 shrink-0" />
            <span>Calendar</span>
          </button>
        </div>

        {/* Secondary Footer Row: Leaderboard & Close */}
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
              darkMode
                ? 'border-[#D4A437]/40 bg-white/5 text-[#D6CBE2] hover:bg-white/10 hover:text-[#F6C915]'
                : 'border-[#D9C6EC] bg-[#F5EFFA] text-[#2B0938] hover:bg-[#EADBF6]'
            }`}
          >
            <Trophy className="h-3.5 w-3.5 shrink-0 text-[#F6C915]" />
            <span>Leaderboard ({stats.totalSolved} solved)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className={`inline-flex min-h-[40px] items-center justify-center rounded-xl border px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
              darkMode
                ? 'border-[#D4A437]/30 bg-transparent text-[#D6CBE2] hover:bg-white/10 hover:text-white'
                : 'border-[#D9C6EC] bg-white text-[#5E3A73] hover:bg-[#F5EFFA] hover:text-[#1D0830]'
            }`}
          >
            Close &amp; View Grid
          </button>
        </div>
      </div>
    </div>
  );
};
