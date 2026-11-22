import React, { useEffect, useRef } from 'react';
import { Clock, Crown, Radio, Sparkles } from 'lucide-react';
import type { CanvasCommand, GamePhase, TikTokPlayerScore } from '../shared/types.ts';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  renderCommandsToCanvas,
} from '../utils/canvasEngine.ts';
import type { OverlayBackgroundMode } from '@/lib/live-overlay';

export interface InkStreamOverlayState {
  roomId: string;
  roomName: string;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  timeRemaining: number;
  maskedWord: string;
  wordLengthHint: number[];
  drawerName: string;
  revealedWord: string | null;
  commands: CanvasCommand[];
  tiktokConnected: boolean;
  tiktokUsername: string | null;
  tiktokLeaderboard: TikTokPlayerScore[];
  recentWinnerText: string | null;
}

interface InkStreamOverlayViewProps {
  state: InkStreamOverlayState | null;
  bgMode: OverlayBackgroundMode;
  isReceivingHostSync: boolean;
}

export const InkStreamOverlayView: React.FC<InkStreamOverlayViewProps> = ({
  state,
  bgMode,
  isReceivingHostSync,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    renderCommandsToCanvas(ctx, state?.commands ?? []);
  }, [state?.commands, state?.phase, state?.currentRound]);

  const isTransparent = bgMode === 'transparent';

  return (
    <div
      className={`min-h-screen w-full flex flex-col items-center justify-center p-3 select-none ${
        isTransparent
          ? 'bg-transparent'
          : 'bg-gradient-to-b from-[#170426] via-[#220739] to-[#130320]'
      }`}
    >
      <div className="w-full max-w-[640px] flex flex-col gap-2.5">
        {/* Top Broadcast Bar */}
        <div className="rounded-2xl bg-[#1a052c]/95 border-2 border-[#D4A437]/75 px-4 py-2.5 shadow-[0_10px_28px_rgba(9,2,18,0.65)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="The Missing Piece"
              className="w-8 h-8 rounded-full object-contain shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-[#F6C915] truncate">
                  INKSTREAM
                </span>
                {state && state.phase !== 'LOBBY' && (
                  <span className="text-[11px] font-bold text-[#D9C7EE] whitespace-nowrap">
                    · R{Math.max(1, state.currentRound)}/{state.totalRounds}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#C9B6DF] truncate">
                {state
                  ? state.phase === 'DRAWING'
                    ? `${state.drawerName} is drawing — guess in chat!`
                    : state.phase === 'WORD_SELECT'
                      ? `${state.drawerName} is picking a secret word...`
                      : state.phase === 'TURN_SUMMARY' && state.revealedWord
                        ? `Word revealed: ${state.revealedWord.toUpperCase()}`
                        : state.phase === 'GAME_OVER'
                          ? 'Match Complete!'
                          : 'Waiting in Studio Lobby'
                  : isReceivingHostSync
                    ? 'Connected to InkStream host'
                    : 'Waiting for InkStream host session...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {state && state.phase !== 'LOBBY' && state.phase !== 'GAME_OVER' && (
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-sm font-extrabold ${
                  state.phase === 'DRAWING' && state.timeRemaining <= 10
                    ? 'bg-rose-600/25 border-rose-400 text-rose-200'
                    : 'bg-[#2c0947] border-[#F6C915]/55 text-[#F6C915]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{state.timeRemaining}s</span>
              </div>
            )}
            {state?.tiktokConnected && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/20 border border-rose-400/50 text-[10px] font-extrabold uppercase tracking-wider text-rose-200">
                <Radio className="w-3 h-3" />
                LIVE
              </span>
            )}
          </div>
        </div>

        {/* Masked Word / Revealed Word Banner */}
        <div className="rounded-xl bg-[#220738]/95 border border-[#F6C915]/50 px-4 py-2 text-center shadow-lg">
          {state?.phase === 'DRAWING' ? (
            <div className="flex items-center justify-center gap-2.5 flex-wrap">
              <span className="font-mono text-xl sm:text-2xl font-black tracking-[0.22em] text-white">
                {state.maskedWord || '_ _ _ _ _'}
              </span>
              {state.wordLengthHint.length > 0 && (
                <span className="text-xs font-mono font-bold text-[#F6C915]">
                  ({state.wordLengthHint.join(', ')})
                </span>
              )}
            </div>
          ) : state?.phase === 'TURN_SUMMARY' && state.revealedWord ? (
            <div className="flex items-center justify-center gap-2 text-[#F6C915]">
              <Sparkles className="w-4 h-4" />
              <span className="font-extrabold text-lg tracking-wider uppercase">
                {state.revealedWord}
              </span>
            </div>
          ) : (
            <span className="text-xs font-bold uppercase tracking-widest text-[#D9C7EE]">
              Type your guesses in TikTok LIVE chat!
            </span>
          )}
        </div>

        {/* Crisp White 4:3 Drawing Canvas */}
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-white border-2 border-[#F6C915] shadow-[0_16px_40px_rgba(9,2,18,0.7)]">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full h-full block"
          />

          {state?.recentWinnerText && state.phase === 'DRAWING' && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[#1a052c]/95 border border-[#F6C915] text-[#F6C915] text-xs font-extrabold shadow-lg whitespace-nowrap">
              {state.recentWinnerText}
            </div>
          )}
        </div>

        {/* Compact Top TikTok Chat Leaderboard */}
        {state && state.tiktokLeaderboard.length > 0 && (
          <div className="rounded-2xl bg-[#1a052c]/95 border border-[#D4A437]/60 px-3.5 py-2.5 shadow-lg">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#F6C915]">
                <Crown className="w-3.5 h-3.5" />
                Top Chat Guessers
              </span>
              {state.tiktokUsername && (
                <span className="text-[10px] font-semibold text-[#C9B6DF]">
                  @{state.tiktokUsername}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {state.tiktokLeaderboard.slice(0, 3).map((viewer, idx) => (
                <div
                  key={viewer.uniqueId || `${viewer.nickname}-${idx}`}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white/8 border border-white/10 text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono font-black text-[#F6C915] shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-white truncate">{viewer.nickname}</span>
                  </div>
                  <span className="font-mono font-extrabold text-emerald-300 shrink-0">
                    {viewer.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
