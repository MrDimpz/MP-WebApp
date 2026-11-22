import { useEffect, useState } from 'react';
import { Clock, Play, Trophy, X } from 'lucide-react';
import type { LiveGameStateView } from '../shared/types';
import { formatDuration, formatModeLabel } from '../utils/format';

interface WinnerModalProps {
  game: LiveGameStateView;
  clockOffsetMs: number;
  open: boolean;
  onClose: () => void;
  onStartNextRound: () => void;
}

export function WinnerModal({
  game,
  clockOffsetMs,
  open,
  onClose,
  onStartNextRound,
}: WinnerModalProps) {
  const [nowMs, setNowMs] = useState(() => Date.now() + clockOffsetMs);

  useEffect(() => {
    if (!open || game.status !== 'won' || !game.nextRoundAt) return;
    setNowMs(Date.now() + clockOffsetMs);
    const id = window.setInterval(() => {
      setNowMs(Date.now() + clockOffsetMs);
    }, 100);
    return () => window.clearInterval(id);
  }, [open, game.status, game.nextRoundAt, clockOffsetMs]);

  if (!open || game.status !== 'won') return null;

  const winners = game.roundWinners;
  const allRevealedWords = game.boards.flatMap((b) =>
    b.targets.map((t) => t.word).filter((w): w is string => Boolean(w))
  );
  const durationMs =
    game.startedAt && game.finishedAt ? game.finishedAt - game.startedAt : 0;

  const remainingMs = game.nextRoundAt
    ? Math.max(0, game.nextRoundAt - nowMs)
    : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const countdownPct = Math.min(100, (remainingMs / 15000) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mpwh-winner-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-[#F6C915]/50 bg-[#210736] p-6 sm:p-7 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close winner popup"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#C8B2E4] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Celebratory Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F6C915]/15 border border-[#F6C915]/50 text-[#F6C915]">
            <Trophy className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#F6C915]">
            Round #{game.roundNumber} · {formatModeLabel(game.mode)}
          </p>
          <h2
            id="mpwh-winner-modal-title"
            className="mt-1 text-3xl font-black tracking-tight text-white"
          >
            {allRevealedWords.length > 1 ? 'All Words Found!' : 'Word Found!'}
          </h2>
          <p className="mt-1 text-xs text-[#D4C0EC] tabular-nums">
            {game.totalGuesses} guesses · {formatDuration(durationMs)}
          </p>
        </div>

        {/* Secret Word(s) Found */}
        {allRevealedWords.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {allRevealedWords.map((word) => (
              <span
                key={word}
                className="rounded-xl border border-emerald-400/55 border-b-4 border-b-emerald-950 bg-gradient-to-b from-emerald-500/35 to-emerald-700/40 px-4 py-2 font-mono text-lg font-black tracking-[0.14em] uppercase text-emerald-100 shadow-md"
              >
                {word}
              </span>
            ))}
          </div>
        )}

        {/* Winner(s) List */}
        <div className="mt-5 rounded-xl border border-[#D4A437]/30 bg-[#140321] p-4">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#C8B2E4] mb-3">
            <span>
              {winners.length === 1
                ? 'Round Winner'
                : `Round Winners (${winners.length})`}
            </span>
            <span>Score</span>
          </div>

          {winners.length === 0 ? (
            <p className="text-center text-sm text-[#D4C0EC] py-2">
              Great hunt!
            </p>
          ) : (
            <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {winners.map((winner, idx) => (
                <li
                  key={winner.name}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${
                    idx === 0
                      ? 'border border-[#F6C915]/45 bg-[#F6C915]/12'
                      : 'border border-white/10 bg-[#210736]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-[#F6C915] tabular-nums">
                        #{idx + 1}
                      </span>
                      <span className="text-base font-extrabold text-white truncate">
                        {winner.name}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#D4C0EC] truncate">
                      Found:{' '}
                      <span className="font-bold uppercase text-emerald-300">
                        {winner.wordsFound.join(', ')}
                      </span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-extrabold tabular-nums text-white">
                      {winner.score.toLocaleString()} pts
                    </div>
                    <div className="font-mono text-[11px] font-bold tabular-nums text-[#F6C915]">
                      +{winner.pieces} pieces
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 15-Second Auto-Start Countdown */}
        {game.nextRoundAt && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#D9C7EE]">
                <Clock className="h-3.5 w-3.5 text-[#F6C915]" aria-hidden="true" />
                <span>Next round starts automatically</span>
              </span>
              <span className="font-mono font-extrabold tabular-nums text-[#F6C915]">
                {remainingSec}s
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#12031E]">
              <div
                className="h-full bg-[#F6C915] transition-[width] duration-100 ease-linear"
                style={{ width: `${countdownPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/18 bg-[#2C0C47] px-4 py-2.5 text-sm font-bold text-[#F3ECFF] hover:bg-[#3A115D] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            View Board
          </button>
          <button
            type="button"
            onClick={onStartNextRound}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F6C915] px-5 py-2.5 text-sm font-extrabold text-[#1D0830] hover:bg-[#FFE047] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            <span>Start Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
