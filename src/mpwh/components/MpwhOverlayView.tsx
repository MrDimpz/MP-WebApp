import { Radio, Trophy } from 'lucide-react';
import type { OverlayBackgroundMode } from '../../lib/live-overlay';
import type { MpwhOverlayState } from '../shared/types';
import { formatModeLabel } from '../utils/format';
import { GuessMarquee } from './GuessMarquee';
import { LadderBoard } from './LadderBoard';
import { QuadFinalPopup } from './QuadFinalPopup';

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

  const hasBoards = Boolean(state && state.boards.length > 0 && state.status !== 'idle');
  const isWon = Boolean(state && state.status === 'won');
  const isGaveUp = state?.status === 'gave_up';
  const hasWinners = Boolean(state && state.roundWinners.length > 0);

  return (
    <div
      className={`dark w-full max-w-[620px] h-[900px] max-h-screen mx-auto ${bgClass} text-white p-2.5 flex flex-col overflow-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
    >
      <div className="w-full flex-1 min-h-0 rounded-2xl border border-[#F6C915]/55 bg-[#1B052E]/95 shadow-2xl overflow-hidden flex flex-col">
        {/* Fixed-Height Overlay Brand Bar */}
        <div className="h-12 px-4 border-b border-[#D4A437]/30 bg-[#140321]/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="The Missing Piece"
              className="h-7 w-7 rounded-full object-contain shrink-0"
            />
            <div className="min-w-0 flex items-center gap-2">
              <span className="text-sm font-black tracking-tight text-white truncate">
                WORD HUNT EXTREME
              </span>
              {state && (
                <span className="text-[11px] font-bold text-[#F6C915] font-mono tabular-nums whitespace-nowrap shrink-0">
                  R#{state.roundNumber} · {formatModeLabel(state.mode)}
                </span>
              )}
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

        {/* Fixed-Height Body */}
        <div className="relative flex-1 min-h-0 overflow-hidden p-3 flex flex-col gap-2">
          {/* Missing Piece Emblem Watermark (25% opacity, 90% size of main board section) */}
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

          <div className="relative z-10 flex-1 min-h-0 flex flex-col gap-2">
            {/* Always-Rendered Fixed-Height Status / Winner Strip */}
            <div
              className={`h-10 shrink-0 rounded-xl border px-3.5 flex items-center justify-between gap-2 ${
                isWon
                  ? 'border-[#F6C915]/60 bg-[#F6C915]/15'
                  : isGaveUp
                  ? 'border-rose-400/45 bg-rose-950/35'
                  : 'border-[#D4A437]/25 bg-[#140321]/80'
              }`}
            >
              {isWon && hasWinners && state ? (
                <>
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
                </>
              ) : isWon && state ? (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <Trophy className="w-4 h-4 text-[#F6C915] shrink-0" />
                    <span className="text-xs sm:text-sm font-black text-white truncate">
                      Round #{state.roundNumber} Complete!
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-[#F5EEFF] tabular-nums shrink-0">
                    {state.totalGuesses} guesses
                  </span>
                </>
              ) : isGaveUp && state ? (
                <>
                  <span className="text-xs font-extrabold text-rose-200 truncate">
                    Round #{state.roundNumber} Revealed
                  </span>
                  <span className="font-mono text-[11px] text-[#D4C0EC] tabular-nums shrink-0">
                    {state.totalGuesses} guesses
                  </span>
                </>
              ) : hasBoards && state ? (
                <>
                  <span className="text-xs font-extrabold text-[#F6C915] truncate">
                    Type any word in chat to climb A–Z!
                  </span>
                  <span className="font-mono text-[11px] font-bold text-[#D4C0EC] tabular-nums shrink-0">
                    {state.totalGuesses} {state.totalGuesses === 1 ? 'guess' : 'guesses'}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs font-extrabold text-[#F6C915] truncate">
                    Word Hunt Extreme · Waiting for Host
                  </span>
                  <span className="font-mono text-[11px] text-[#D4C0EC] shrink-0">
                    620 × 900
                  </span>
                </>
              )}
            </div>

            {/* Fixed-Height Game Field Stage */}
            <div className="relative flex-1 min-h-0 flex flex-col justify-center overflow-hidden">
              {!hasBoards || !state ? (
                <div className="text-center px-6 py-8 space-y-2">
                  <p className="text-lg font-black text-white">
                    Word Hunt Extreme Ready
                  </p>
                  <p className="text-xs text-[#D4C0EC] max-w-sm mx-auto leading-relaxed">
                    Start a round on the host screen — guesses from TikTok LIVE chat
                    appear here automatically.
                  </p>
                </div>
              ) : (
                <div
                  className={
                    state.mode === 'quad'
                      ? 'grid grid-cols-2 grid-rows-2 gap-2.5 h-full items-stretch'
                      : 'w-full'
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
                      hideQuadSolvedPopup={isWon || isGaveUp}
                      clockOffsetMs={0}
                      overlayMode={true}
                    />
                  ))}
                </div>
              )}

              {/* Central Winners Popup when Quad round ends (lasts 15s until next round) */}
              {(isWon || isGaveUp) && state && state.mode === 'quad' && (
                <QuadFinalPopup
                  roundNumber={state.roundNumber}
                  status={state.status}
                  boards={state.boards}
                  roundWinners={state.roundWinners}
                  nextRoundAt={state.nextRoundAt}
                  totalGuesses={state.totalGuesses}
                  clockOffsetMs={state.serverClockOffsetMs ?? 0}
                />
              )}
            </div>

            {/* Always-Rendered Fixed-Height Sideways Guess Marquee */}
            <div className="rounded-xl overflow-hidden border border-[#D4A437]/25 shrink-0">
              <GuessMarquee items={state?.guessFeed ?? []} embedded />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
