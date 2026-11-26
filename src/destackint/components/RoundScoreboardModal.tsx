import React, { useState, useEffect, useRef } from 'react';
import {
  Crown,
  Medal,
  Award,
  Trophy,
  Zap,
  CheckCircle2,
  Play,
  Pause,
  Flame,
  RotateCcw,
  Sparkles,
  FastForward,
} from 'lucide-react';
import { WinTallyBadge } from '@/components/interactive-games/win-tally-badge';
import { RunningScoreboardPlayer, DifficultyMode, GameState } from '../types';
import { getSafeAvatarUrl, handleAvatarError } from '../utils/avatar';
import { deduplicateScoreboardPlayers } from '../utils/scoreboard';

interface RoundScoreboardModalProps {
  dateStr: string;
  difficulty: DifficultyMode;
  words: string[];
  scoreboard: RunningScoreboardPlayer[];
  setCurrentView: (view: GameState) => void;
  onAutoAdvance: () => void;
  onPlayAgain: (resetScores: boolean) => void;
  onPlayHardMode: () => void;
  onOpenOverallScoreboard?: () => void;
  isOverlay?: boolean;
}

const AUTO_ADVANCE_SECONDS = 5;

export const RoundScoreboardModal: React.FC<RoundScoreboardModalProps> = ({
  dateStr,
  difficulty,
  words,
  scoreboard,
  setCurrentView,
  onAutoAdvance,
  onPlayAgain,
  onPlayHardMode,
  onOpenOverallScoreboard,
  isOverlay = false,
}) => {
  const [countdown, setCountdown] = useState<number>(AUTO_ADVANCE_SECONDS);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const autoAdvanceRef = useRef(onAutoAdvance);
  useEffect(() => {
    autoAdvanceRef.current = onAutoAdvance;
  }, [onAutoAdvance]);

  useEffect(() => {
    if (isOverlay || isPaused) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimeout(() => {
            autoAdvanceRef.current();
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused, isOverlay]);

  // Top 5 players sorted by highest score in THIS round (each player listed once)
  const top5 = deduplicateScoreboardPlayers(scoreboard).slice(0, 5);

  const firstPlace = top5[0] || null;
  const secondPlace = top5[1] || null;
  const thirdPlace = top5[2] || null;
  const fourthAndFifth = top5.slice(3, 5);

  return (
    <div className="w-full h-full flex flex-col justify-between bg-gradient-to-b from-[#1f062d]/98 via-[#170422]/98 to-[#100218]/98 border-2 border-amber-400/75 rounded-2xl p-2.5 sm:p-4 shadow-[0_0_45px_rgba(250,204,21,0.28)] text-white relative overflow-y-auto overscroll-contain">
      {/* Ambient Gold Glow */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-56 h-32 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="relative text-center pb-2 border-b border-purple-300/20 shrink-0">
        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest mb-1">
          <Sparkles className="w-3 h-3" />
          All {words.length} Words Revealed · Round Complete
        </div>
        <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white leading-tight">
          Round <span className="text-amber-400">Scoreboard</span>
        </h2>
        <p className="text-[10px] font-mono text-purple-200/75 mt-0.5">
          {dateStr} · {difficulty === 'hard' ? 'Hard (6 Layers)' : 'Standard (4 Layers)'} · Top 5 Fastest
        </p>
      </div>

      {/* TOP 5 HIERARCHY SHOWCASE */}
      <div className="relative my-2 flex-1 flex flex-col justify-center space-y-1.5 sm:space-y-2 min-h-0">
        {top5.length === 0 ? (
          <div className="p-4 sm:p-5 rounded-xl bg-black/35 border border-purple-400/20 text-center">
            <Trophy className="w-8 h-8 text-amber-400/50 mx-auto mb-1.5" />
            <h3 className="text-sm sm:text-base font-extrabold text-white mb-0.5">
              All {words.length} Words Unstacked!
            </h3>
            <p className="text-[11px] text-purple-200/75 max-w-xs mx-auto">
              No chat answers were recorded this round. Viewers can answer in TikTok chat to claim the Top 5 Podium!
            </p>
          </div>
        ) : (
          <>
            {/* 1ST PLACE — GRAND CHAMPION */}
            {firstPlace && (
              <div className="relative rounded-xl bg-gradient-to-r from-amber-400/30 via-amber-500/15 to-[#2b0838] border-2 border-amber-400 px-3 py-2 sm:py-2.5 shadow-[0_0_24px_rgba(250,204,21,0.28)] flex items-center justify-between gap-2 animate-gold-flash">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 px-1.5 py-0.2 rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 text-[#2d0938] font-black text-[8px] uppercase tracking-wider shadow flex items-center gap-0.5 whitespace-nowrap">
                      <Crown className="w-2.5 h-2.5 fill-current" /> 1ST
                    </div>
                    <img
                      src={getSafeAvatarUrl(firstPlace.profilePictureUrl, firstPlace.nickname)}
                      alt={firstPlace.nickname}
                      referrerPolicy="no-referrer"
                      onError={(e) => handleAvatarError(e, firstPlace.nickname)}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-amber-300 shadow-[0_0_16px_rgba(250,204,21,0.45)]"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-amber-400 fill-amber-400" />
                        Round Winner
                      </span>
                      <WinTallyBadge
                        gameId="destackint"
                        winnerName={firstPlace.nickname}
                        compact
                      />
                    </div>
                    <h3 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                      {firstPlace.nickname}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-amber-200/90">
                      <span>{firstPlace.wordsSolved}/{words.length}w</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5 text-amber-300 fill-amber-300" />
                        {firstPlace.bestSpeedSeconds.toFixed(1)}s
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right bg-black/40 px-2.5 py-1.5 rounded-xl border border-amber-300/40 shrink-0">
                  <div className="text-base sm:text-xl font-black font-mono text-amber-300 tabular-nums leading-none">
                    {firstPlace.totalScore.toLocaleString()}
                  </div>
                  <div className="text-[9px] font-bold text-emerald-300 uppercase">pts</div>
                </div>
              </div>
            )}

            {/* 2ND PLACE & 3RD PLACE */}
            {(secondPlace || thirdPlace) && (
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {secondPlace && (
                  <div className="rounded-xl bg-gradient-to-br from-slate-200/20 via-slate-400/10 to-[#250732] border border-slate-300/75 px-2.5 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={getSafeAvatarUrl(secondPlace.profilePictureUrl, secondPlace.nickname)}
                          alt={secondPlace.nickname}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleAvatarError(e, secondPlace.nickname)}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-slate-200"
                        />
                        <span className="absolute -top-1 -left-1 px-1 rounded bg-slate-200 text-slate-900 font-black text-[8px]">
                          2
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase text-slate-300 flex items-center gap-0.5">
                          <Medal className="w-2.5 h-2.5 text-slate-200" /> 2nd
                        </div>
                        <div className="text-xs font-black text-white truncate">
                          {secondPlace.nickname}
                        </div>
                        <div className="text-[9px] font-mono text-slate-300/85">
                          {secondPlace.wordsSolved}w · ⚡{secondPlace.bestSpeedSeconds.toFixed(1)}s
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs sm:text-sm font-black font-mono text-slate-100 tabular-nums">
                        {secondPlace.totalScore.toLocaleString()}
                      </div>
                      <div className="text-[8px] font-mono text-slate-300">pts</div>
                    </div>
                  </div>
                )}

                {thirdPlace && (
                  <div className="rounded-xl bg-gradient-to-br from-amber-700/25 via-orange-800/15 to-[#250732] border border-amber-600/70 px-2.5 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={getSafeAvatarUrl(thirdPlace.profilePictureUrl, thirdPlace.nickname)}
                          alt={thirdPlace.nickname}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleAvatarError(e, thirdPlace.nickname)}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-amber-500"
                        />
                        <span className="absolute -top-1 -left-1 px-1 rounded bg-amber-600 text-white font-black text-[8px]">
                          3
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase text-amber-400 flex items-center gap-0.5">
                          <Award className="w-2.5 h-2.5 text-amber-500" /> 3rd
                        </div>
                        <div className="text-xs font-extrabold text-white truncate">
                          {thirdPlace.nickname}
                        </div>
                        <div className="text-[9px] font-mono text-amber-200/80">
                          {thirdPlace.wordsSolved}w · ⚡{thirdPlace.bestSpeedSeconds.toFixed(1)}s
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs sm:text-sm font-black font-mono text-amber-400 tabular-nums">
                        {thirdPlace.totalScore.toLocaleString()}
                      </div>
                      <div className="text-[8px] font-mono text-amber-300/70">pts</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4TH & 5TH PLACE */}
            {fourthAndFifth.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                {fourthAndFifth.map((player, idx) => {
                  const rank = idx + 4;
                  return (
                    <div
                      key={player.id}
                      className="rounded-lg bg-black/35 border border-purple-400/25 px-2 py-1.5 flex items-center justify-between gap-1.5 min-w-0"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded bg-purple-900/70 border border-purple-400/30 font-mono font-extrabold text-[10px] text-purple-200 flex items-center justify-center shrink-0">
                          #{rank}
                        </span>
                        <img
                          src={getSafeAvatarUrl(player.profilePictureUrl, player.nickname)}
                          alt={player.nickname}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleAvatarError(e, player.nickname)}
                          className="w-6 h-6 rounded-full object-cover border border-white/20 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-white truncate">
                            {player.nickname}
                          </div>
                          <div className="text-[9px] font-mono text-purple-300/80">
                            {player.wordsSolved}w · ⚡{player.bestSpeedSeconds.toFixed(1)}s
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono font-extrabold text-xs text-purple-100 tabular-nums">
                        {player.totalScore.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Revealed Words Summary */}
        <div className="p-2 sm:p-2.5 rounded-xl bg-black/35 border border-amber-400/25">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-amber-400" />
            Revealed Words ({words.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {words.map((w, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 rounded bg-[#2d0938] text-amber-300 font-bold text-[10px] font-mono border border-amber-400/40"
              >
                {idx + 1}. {w}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Auto-Advance & Action Buttons (Host Only) */}
      {!isOverlay && (
        <div className="relative pt-2 border-t border-purple-300/20 space-y-2 shrink-0">
          <div className="px-2.5 py-1.5 rounded-xl bg-amber-400/15 border border-amber-300/40 flex flex-wrap items-center justify-between gap-1.5">
            <div className="text-[11px] font-bold text-amber-200 flex items-center gap-1.5">
              <FastForward className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              {isPaused ? (
                <span>Auto-advance paused</span>
              ) : (
                <span>
                  Next round in{' '}
                  <strong className="text-amber-300 font-mono tabular-nums">{countdown}s</strong>...
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                className="px-2 py-0.5 rounded-lg bg-black/40 hover:bg-black/60 border border-purple-300/35 text-[10px] font-bold text-purple-100 inline-flex items-center gap-1 cursor-pointer"
              >
                {isPaused ? <Play className="w-2.5 h-2.5" /> : <Pause className="w-2.5 h-2.5" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                type="button"
                onClick={onAutoAdvance}
                className="px-2.5 py-0.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#2d0938] text-[10px] font-black inline-flex items-center gap-1 cursor-pointer"
              >
                Next Now
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => onPlayAgain(true)}
              className="py-2 px-2 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:brightness-105 text-[#2d0938] font-black rounded-xl shadow-[0_3px_0_#92400e] transition-all flex items-center justify-center gap-1 text-[10px] sm:text-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Next Round</span>
            </button>

            {onOpenOverallScoreboard ? (
              <button
                type="button"
                onClick={onOpenOverallScoreboard}
                className="py-2 px-2 bg-purple-800/85 hover:bg-purple-700/85 text-amber-200 font-extrabold rounded-xl border border-amber-400/40 transition-all flex items-center justify-center gap-1 text-[10px] sm:text-xs cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Overall</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentView('LEADERBOARD')}
                className="py-2 px-2 bg-purple-800/85 hover:bg-purple-700/85 text-white font-bold rounded-xl border border-purple-400/40 transition-all flex items-center justify-center gap-1 text-[10px] sm:text-xs cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Standings</span>
              </button>
            )}

            {difficulty === 'normal' ? (
              <button
                type="button"
                onClick={onPlayHardMode}
                className="py-2 px-2 bg-[#3b0d47] hover:bg-[#4a1259] text-amber-300 font-black rounded-xl border border-amber-400/50 transition-all flex items-center justify-center gap-1 text-[10px] sm:text-xs cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5 fill-current text-amber-400 shrink-0" />
                <span>6-Layer</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentView('TITLE')}
                className="py-2 px-2 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1 text-[10px] sm:text-xs cursor-pointer"
              >
                Main Menu
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
