import React from 'react';
import {
  Crown,
  Medal,
  Award,
  Trophy,
  Zap,
  CheckCircle2,
  Play,
  Flame,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { RunningScoreboardPlayer, DifficultyMode, GameState } from '../types';
import { getSafeAvatarUrl, handleAvatarError } from '../utils/avatar';

interface RoundScoreboardModalProps {
  dateStr: string;
  difficulty: DifficultyMode;
  words: string[];
  scoreboard: RunningScoreboardPlayer[];
  setCurrentView: (view: GameState) => void;
  onPlayAgain: (resetScores: boolean) => void;
  onPlayHardMode: () => void;
}

export const RoundScoreboardModal: React.FC<RoundScoreboardModalProps> = ({
  dateStr,
  difficulty,
  words,
  scoreboard,
  setCurrentView,
  onPlayAgain,
  onPlayHardMode,
}) => {
  // Top 5 players sorted by totalScore descending, then wordsSolved, then bestSpeedSeconds
  const top5 = [...scoreboard]
    .sort(
      (a, b) =>
        b.totalScore - a.totalScore ||
        b.wordsSolved - a.wordsSolved ||
        a.bestSpeedSeconds - b.bestSpeedSeconds
    )
    .slice(0, 5);

  const firstPlace = top5[0] || null;
  const secondPlace = top5[1] || null;
  const thirdPlace = top5[2] || null;
  const fourthAndFifth = top5.slice(3, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-[#1e0528] border-2 border-amber-400/50 rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-[0_24px_90px_rgba(0,0,0,0.9)] text-white relative overflow-hidden my-auto">
        {/* Ambient Gold Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-56 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[11px] font-extrabold uppercase tracking-widest mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            All {words.length} Words Revealed · Round Complete
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Round <span className="text-amber-400">Scoreboard</span>
          </h2>
          <p className="text-xs font-mono text-purple-200/80 mt-1">
            {dateStr} · {difficulty === 'hard' ? 'Hard Mode (6 Layers · 10 Words)' : 'Standard (4 Layers · 6 Words)'} · Top 5 Fastest Players
          </p>
        </div>

        {/* TOP 5 HIERARCHY SHOWCASE (1st Most Important -> 2nd -> 3rd -> 4th & 5th) */}
        {top5.length === 0 ? (
          <div className="p-8 rounded-2xl bg-black/35 border border-purple-400/20 text-center mb-6">
            <Trophy className="w-12 h-12 text-amber-400/50 mx-auto mb-2" />
            <h3 className="text-lg font-extrabold text-white mb-1">
              All {words.length} Words Unstacked!
            </h3>
            <p className="text-xs text-purple-200/75 max-w-md mx-auto">
              No chat answers were recorded during this round. Use the Live TikTok connection or the Chat Rush simulator during the timer countdown to rank players on the Top 5 Podium!
            </p>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {/* =================================================================== */}
            {/* 1ST PLACE — GRAND CHAMPION HERO SPOTLIGHT (Highest Importance)      */}
            {/* =================================================================== */}
            {firstPlace && (
              <div className="relative rounded-3xl bg-gradient-to-b from-amber-400/30 via-amber-500/15 to-[#2b0838] border-[3px] border-amber-400 p-5 sm:p-6 shadow-[0_0_40px_rgba(250,204,21,0.3)] flex flex-col sm:flex-row items-center justify-between gap-4 animate-gold-flash">
                <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                  <div className="relative">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 text-[#2d0938] font-black text-[10px] uppercase tracking-wider shadow-md flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 fill-current" /> 1ST PLACE
                    </div>
                    <img
                      src={getSafeAvatarUrl(firstPlace.profilePictureUrl, firstPlace.nickname)}
                      alt={firstPlace.nickname}
                      referrerPolicy="no-referrer"
                      onError={(e) => handleAvatarError(e, firstPlace.nickname)}
                      className="w-24 h-24 rounded-full object-cover border-4 border-amber-300 shadow-[0_0_25px_rgba(250,204,21,0.5)]"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-widest text-amber-300 mb-0.5 flex items-center justify-center sm:justify-start gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-400 fill-amber-400" />
                      Round Champion
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      {firstPlace.nickname}
                    </h3>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-1.5 text-xs font-mono text-amber-200/90">
                      <span className="px-2 py-0.5 rounded-lg bg-black/40 border border-amber-400/30">
                        {firstPlace.wordsSolved}/{words.length} Words Solved
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-black/40 border border-amber-400/30 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                        Best: {firstPlace.bestSpeedSeconds.toFixed(1)}s
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-center sm:text-right bg-black/40 px-5 py-3 rounded-2xl border border-amber-300/40 shrink-0">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-amber-300">
                    Champion Score
                  </div>
                  <div className="text-3xl sm:text-4xl font-black font-mono text-amber-300 tabular-nums">
                    {firstPlace.totalScore.toLocaleString()}
                  </div>
                  <div className="text-[11px] font-bold text-emerald-300">
                    pts earned
                  </div>
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* 2ND PLACE (High Importance) & 3RD PLACE (Elevated Importance)       */}
            {/* =================================================================== */}
            {(secondPlace || thirdPlace) && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-stretch">
                {/* 2ND PLACE — Takes 7 of 12 columns for higher prominence than 3rd */}
                {secondPlace && (
                  <div className="sm:col-span-7 rounded-2xl bg-gradient-to-br from-slate-200/20 via-slate-400/10 to-[#250732] border-2 border-slate-300/75 p-4 shadow-[0_8px_24px_rgba(203,213,225,0.15)] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-slate-100 to-slate-300 text-slate-900 font-black text-[9px] uppercase tracking-wider shadow">
                          2ND
                        </div>
                        <img
                          src={getSafeAvatarUrl(secondPlace.profilePictureUrl, secondPlace.nickname)}
                          alt={secondPlace.nickname}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleAvatarError(e, secondPlace.nickname)}
                          className="w-16 h-16 rounded-full object-cover border-[3px] border-slate-200 shadow-lg"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                          <Medal className="w-3.5 h-3.5 text-slate-200" /> Silver Runner-Up
                        </div>
                        <div className="text-lg sm:text-xl font-black text-white truncate">
                          {secondPlace.nickname}
                        </div>
                        <div className="text-[11px] font-mono text-slate-300/90 mt-0.5">
                          {secondPlace.wordsSolved} words · ⚡ {secondPlace.bestSpeedSeconds.toFixed(1)}s
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 bg-black/35 px-3.5 py-2 rounded-xl border border-slate-300/30">
                      <div className="text-xl sm:text-2xl font-black font-mono text-slate-100 tabular-nums">
                        {secondPlace.totalScore.toLocaleString()}
                      </div>
                      <div className="text-[10px] font-mono text-slate-300">pts</div>
                    </div>
                  </div>
                )}

                {/* 3RD PLACE — Takes 5 of 12 columns, distinct warm bronze */}
                {thirdPlace && (
                  <div className="sm:col-span-5 rounded-2xl bg-gradient-to-br from-amber-700/25 via-orange-800/15 to-[#250732] border-2 border-amber-600/70 p-3.5 shadow-[0_6px_18px_rgba(217,119,6,0.15)] flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-700 text-white font-black text-[9px] uppercase tracking-wider shadow">
                          3RD
                        </div>
                        <img
                          src={getSafeAvatarUrl(thirdPlace.profilePictureUrl, thirdPlace.nickname)}
                          alt={thirdPlace.nickname}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleAvatarError(e, thirdPlace.nickname)}
                          className="w-13 h-13 rounded-full object-cover border-2 border-amber-500 shadow-md"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                          <Award className="w-3 h-3 text-amber-500" /> Bronze
                        </div>
                        <div className="text-base font-extrabold text-white truncate">
                          {thirdPlace.nickname}
                        </div>
                        <div className="text-[10px] font-mono text-amber-200/80">
                          {thirdPlace.wordsSolved}w · ⚡{thirdPlace.bestSpeedSeconds.toFixed(1)}s
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-black font-mono text-amber-400 tabular-nums">
                        {thirdPlace.totalScore.toLocaleString()}
                      </div>
                      <div className="text-[10px] font-mono text-amber-300/70">pts</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* =================================================================== */}
            {/* 4TH & 5TH PLACE — Compact Top-5 Finalists                           */}
            {/* =================================================================== */}
            {fourthAndFifth.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {fourthAndFifth.map((player, idx) => {
                  const rank = idx + 4;
                  return (
                    <div
                      key={player.id}
                      className="rounded-xl bg-black/35 border border-purple-400/25 px-3.5 py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-purple-900/60 border border-purple-400/30 font-mono font-extrabold text-xs text-purple-200 flex items-center justify-center shrink-0">
                          #{rank}
                        </span>
                        <img
                          src={getSafeAvatarUrl(player.profilePictureUrl, player.nickname)}
                          alt={player.nickname}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleAvatarError(e, player.nickname)}
                          className="w-8 h-8 rounded-full object-cover border border-white/20 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {player.nickname}
                          </div>
                          <div className="text-[10px] font-mono text-purple-300/80">
                            {player.wordsSolved} words · ⚡ {player.bestSpeedSeconds.toFixed(1)}s
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono font-extrabold text-sm text-purple-100 tabular-nums">
                        {player.totalScore.toLocaleString()} <span className="text-[10px] opacity-70">pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Revealed Words Summary */}
        <div className="mb-6 p-3.5 rounded-2xl bg-black/35 border border-amber-400/25">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
            Revealed Stack Words ({words.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {words.map((w, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg bg-[#2d0938] text-amber-300 font-bold text-xs font-mono border border-amber-400/40"
              >
                {idx + 1}. {w}
              </span>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => onPlayAgain(true)}
            className="py-3.5 px-4 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:brightness-105 text-[#2d0938] font-black rounded-2xl shadow-[0_5px_0_#92400e] transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> New Round (Reset Scores)
          </button>

          <button
            type="button"
            onClick={() => onPlayAgain(false)}
            className="py-3.5 px-4 bg-purple-800/80 hover:bg-purple-700/80 text-white font-bold rounded-2xl border border-purple-400/40 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
          >
            <Play className="w-4 h-4 text-amber-300" /> Replay (Keep Scores)
          </button>

          {difficulty === 'normal' ? (
            <button
              type="button"
              onClick={onPlayHardMode}
              className="py-3.5 px-4 bg-[#3b0d47] hover:bg-[#4a1259] text-amber-300 font-black rounded-2xl border border-amber-400/50 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
            >
              <Flame className="w-4 h-4 fill-current text-amber-400" /> 6-Layer Hard Mode
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentView('TITLE')}
              className="py-3.5 px-4 bg-white/10 hover:bg-white/15 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
            >
              Main Menu
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
