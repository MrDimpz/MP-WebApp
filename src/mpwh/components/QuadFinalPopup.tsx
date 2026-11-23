import { useEffect, useState } from 'react';
import { Clock, Play, Trophy } from 'lucide-react';
import type { GameStatus, LadderInstanceView, RoundWinnerSummary } from '../shared/types';

interface QuadFinalPopupProps {
  roundNumber: number;
  status: GameStatus;
  boards: LadderInstanceView[];
  roundWinners: RoundWinnerSummary[];
  nextRoundAt: number | null;
  totalGuesses: number;
  clockOffsetMs?: number;
  onStartNow?: () => void;
}

export function QuadFinalPopup({
  roundNumber,
  status,
  boards,
  roundWinners,
  nextRoundAt,
  totalGuesses,
  clockOffsetMs = 0,
  onStartNow,
}: QuadFinalPopupProps) {
  const [nowMs, setNowMs] = useState(() => Date.now() + clockOffsetMs);

  useEffect(() => {
    setNowMs(Date.now() + clockOffsetMs);
    if (!nextRoundAt) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now() + clockOffsetMs);
    }, 100);
    return () => window.clearInterval(id);
  }, [nextRoundAt, clockOffsetMs]);

  if (status !== 'won' && status !== 'gave_up') {
    return null;
  }

  const words = boards.flatMap((b) =>
    b.targets.map((t) => t.word).filter((w): w is string => Boolean(w))
  );

  const remainingMs = nextRoundAt ? Math.max(0, nextRoundAt - nowMs) : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const countdownPct = Math.min(100, (remainingMs / 15000) * 100);

  return (
    <div
      role="dialog"
      aria-label="Quad Hunt Winners"
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/68 backdrop-blur-[3px] p-3 animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="w-full max-w-[460px] rounded-2xl border-2 border-[#F6C915]/75 bg-[#1B052E]/96 p-4 sm:p-5 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl border border-[#F6C915]/55 bg-[#F6C915]/15 text-[#F6C915]">
            <Trophy className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#F6C915]">
            Round #{roundNumber} · Quad Hunt Complete
          </p>
          <h3 className="mt-0.5 text-2xl font-black tracking-tight text-white">
            {status === 'won' ? 'All 4 Words Found!' : 'Round Revealed'}
          </h3>
          <p className="mt-0.5 text-[11px] font-mono tabular-nums text-[#D4C0EC]">
            {totalGuesses} {totalGuesses === 1 ? 'guess' : 'guesses'}
          </p>
        </div>

        {words.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {words.map((word) => (
              <span
                key={word}
                className="rounded-lg border border-emerald-400/55 bg-emerald-600/25 px-2.5 py-1 font-mono text-xs font-black uppercase tracking-[0.12em] text-emerald-100"
              >
                {word}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3.5">
          {roundWinners.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#25093E] px-3 py-3 text-center text-xs font-semibold text-[#D4C0EC]">
              Answers revealed — get ready for the next round!
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-[200px] overflow-hidden">
              {roundWinners.slice(0, 4).map((winner, idx) => (
                <li
                  key={winner.name}
                  className={`flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 ${
                    idx === 0
                      ? 'border border-[#F6C915]/55 bg-[#F6C915]/15'
                      : 'border border-white/12 bg-[#25093E]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-extrabold text-[#F6C915] tabular-nums">
                        #{idx + 1}
                      </span>
                      <span className="text-sm font-extrabold text-white truncate">
                        {winner.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#D4C0EC] truncate">
                      Found:{' '}
                      <span className="font-bold uppercase text-emerald-300">
                        {winner.wordsFound.join(', ')}
                      </span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-extrabold tabular-nums text-white">
                      {winner.score.toLocaleString()} pts
                    </div>
                    <div className="font-mono text-[10px] font-bold tabular-nums text-[#F6C915]">
                      +{winner.pieces} pcs
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {nextRoundAt && (
          <div className="mt-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#D9C7EE]">
                <Clock className="h-3.5 w-3.5 text-[#F6C915]" aria-hidden="true" />
                <span>Next round starts in</span>
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

        {onStartNow && (
          <div className="mt-3.5 flex justify-end">
            <button
              type="button"
              onClick={onStartNow}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F6C915] px-4 py-2 text-xs font-extrabold text-[#1D0830] hover:bg-[#FFE047] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              <span>Start Next Round Now</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
