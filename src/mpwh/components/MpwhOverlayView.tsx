import { Radio, Trophy } from 'lucide-react';
import type { OverlayBackgroundMode } from '../../lib/live-overlay';
import type { MpwhOverlayState } from '../shared/types';
import { formatModeLabel } from '../utils/format';
import { GuessMarquee } from './GuessMarquee';
import { LadderBoard } from './LadderBoard';

interface MpwhOverlayViewProps {
  state: MpwhOverlayState | null;
  bgMode: OverlayBackgroundMode;
  isReceivingHostSync: boolean;
}

export function MpwhOverlayView({
  state,
  bgMode,
  isReceivingHostSync,
}: MpwhOverlayViewProps) {
  const bgClass =
    bgMode === 'transparent' ? 'bg-transparent' : 'bg-[#12031E]';

  return (
    <div
      className={`min-h-screen w-full ${bgClass} text-white p-3 sm:p-4 flex flex-col justify-start`}
    >
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-[#F6C915]/55 bg-[#1B052E]/95 shadow-2xl overflow-hidden">
        {/* Compact Overlay Brand Bar */}
        <div className="px-4 py-2.5 border-b border-[#D4A437]/30 bg-[#140321]/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="The Missing Piece"
              className="h-7 w-7 rounded-full object-contain shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tight text-white">
                  WORD HUNT EXTREME
                </span>
                {state && (
                  <span className="text-[11px] font-bold text-[#F6C915] font-mono tabular-nums">
                    R#{state.roundNumber} · {formatModeLabel(state.mode)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums shrink-0">
            {state?.tiktokConnected && state.tiktokUsername ? (
              <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
                <Radio className="w-3 h-3" />@{state.tiktokUsername}
              </span>
            ) : (
              <span className="text-[#C8B2E4]">
                {isReceivingHostSync ? 'LIVE SYNC' : 'WAITING FOR HOST'}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="relative overflow-hidden p-3.5 sm:p-4">
          <div
            aria-hidden="true"
            className="pointer-events-none select-none absolute inset-0 flex items-center justify-center z-0"
          >
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt=""
              className="w-[90%] h-[90%] object-contain opacity-25"
            />
          </div>
          <div className="relative z-10">
          {!state || state.boards.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-base font-extrabold text-white">
                Word Hunt Extreme Ready
              </p>
              <p className="text-xs text-[#D4C0EC]">
                Start a round on the host screen — guesses from TikTok LIVE chat
                appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Winner Banner when round won */}
              {state.status === 'won' && state.roundWinners.length > 0 && (
                <div className="rounded-xl border border-[#F6C915]/60 bg-[#F6C915]/15 px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Trophy className="w-4 h-4 text-[#F6C915] shrink-0" />
                    <span className="text-xs sm:text-sm font-black text-white truncate">
                      Winner: {state.roundWinners[0].name}
                      {state.roundWinners.length > 1
                        ? ` +${state.roundWinners.length - 1} more`
                        : ''}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-extrabold text-[#F6C915] tabular-nums shrink-0">
                    +{state.roundWinners[0].score.toLocaleString()} pts
                  </span>
                </div>
              )}

              <div
                className={
                  state.mode === 'quad'
                    ? 'grid grid-cols-2 gap-2.5'
                    : 'space-y-3'
                }
              >
                {state.boards.map((board) => (
                  <LadderBoard
                    key={board.boardIndex}
                    board={board}
                    isQuad={state.mode === 'quad'}
                    canUseHints={false}
                    hintsRemaining={0}
                    onUseHint={() => {}}
                    isGaveUp={state.status === 'gave_up'}
                    clockOffsetMs={0}
                    overlayMode={true}
                  />
                ))}
              </div>

              {(state.guessFeed?.length ?? 0) > 0 && (
                <div className="rounded-xl overflow-hidden border border-[#D4A437]/25">
                  <GuessMarquee items={state.guessFeed} embedded />
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
