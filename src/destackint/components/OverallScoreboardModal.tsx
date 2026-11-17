import React, { useState } from 'react';
import {
  Crown,
  Medal,
  Award,
  Trophy,
  Zap,
  X,
  RotateCcw,
  Users,
  Sparkles,
} from 'lucide-react';
import { RunningScoreboardPlayer } from '../types';
import { getSafeAvatarUrl, handleAvatarError } from '../utils/avatar';
import { deduplicateScoreboardPlayers } from '../utils/scoreboard';

interface OverallScoreboardModalProps {
  isOpen: boolean;
  overallScoreboard: RunningScoreboardPlayer[];
  onClose: () => void;
  onResetOverallScoreboard: () => void;
}

export const OverallScoreboardModal: React.FC<OverallScoreboardModalProps> = ({
  isOpen,
  overallScoreboard,
  onClose,
  onResetOverallScoreboard,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  if (!isOpen) return null;

  const uniquePlayers = deduplicateScoreboardPlayers(overallScoreboard);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#1b0424] border-2 border-amber-400/60 rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-[0_24px_90px_rgba(0,0,0,0.9)] text-white relative overflow-hidden"
      >
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-48 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative px-5 py-4 bg-[#2c0838]/90 border-b border-purple-300/25 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-[#2d0938] flex items-center justify-center shadow-lg shrink-0">
              <Crown className="w-5 h-5 fill-current" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
                <Sparkles className="w-3 h-3" /> Permanent Running Standings
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white truncate">
                Overall Running Scoreboard
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-black/35 border border-purple-300/25 text-xs font-mono text-purple-200">
              <Users className="w-3.5 h-3.5 text-amber-300" />
              {uniquePlayers.length} {uniquePlayers.length === 1 ? 'Player' : 'Players'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-purple-100 hover:text-white transition-colors cursor-pointer"
              aria-label="Close Overall Scoreboard"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {uniquePlayers.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-2xl bg-black/30 border border-purple-400/20">
              <Trophy className="w-12 h-12 text-amber-400/45 mx-auto mb-3" />
              <h3 className="text-base font-extrabold text-white mb-1">
                No Overall Scores Recorded Yet
              </h3>
              <p className="text-xs text-purple-200/75 max-w-md mx-auto leading-relaxed">
                Points earned by viewers across every round accumulate here permanently, while Round Wins go to the highest scorer of each individual round.
              </p>
            </div>
          ) : (
            uniquePlayers.map((player, index) => {
              const rank = index + 1;
              const roundsWon = player.roundsWon || 0;
              const avgSpeed =
                player.wordsSolved > 0
                  ? player.totalSpeedSeconds / player.wordsSolved
                  : player.bestSpeedSeconds;

              const rowStyle =
                rank === 1
                  ? 'bg-gradient-to-r from-amber-500/30 via-amber-400/15 to-[#2b0838] border-2 border-amber-400 shadow-[0_0_24px_rgba(250,204,21,0.22)] py-3 px-3.5'
                  : rank === 2
                  ? 'bg-gradient-to-r from-slate-300/20 to-[#250732] border border-slate-300/65 py-2.5 px-3.5'
                  : rank === 3
                  ? 'bg-gradient-to-r from-amber-700/25 to-[#250732] border border-amber-600/65 py-2.5 px-3.5'
                  : 'bg-black/30 border border-white/10 py-2 px-3';

              return (
                <div
                  key={player.id}
                  className={`rounded-2xl flex items-center justify-between gap-3 transition-all ${rowStyle}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`shrink-0 flex items-center justify-center rounded-xl font-black font-mono ${
                        rank === 1
                          ? 'w-9 h-9 bg-gradient-to-b from-amber-300 to-amber-500 text-[#2d0938] text-sm shadow-md'
                          : rank === 2
                          ? 'w-8 h-8 bg-gradient-to-b from-slate-100 to-slate-300 text-slate-900 text-xs'
                          : rank === 3
                          ? 'w-8 h-8 bg-gradient-to-b from-amber-600 to-amber-800 text-amber-100 text-xs'
                          : 'w-7 h-7 bg-white/10 text-purple-200 text-xs'
                      }`}
                    >
                      {rank === 1 ? (
                        <Crown className="w-4.5 h-4.5 fill-current" />
                      ) : rank === 2 ? (
                        <Medal className="w-4 h-4" />
                      ) : rank === 3 ? (
                        <Award className="w-4 h-4" />
                      ) : (
                        `#${rank}`
                      )}
                    </div>

                    <img
                      src={getSafeAvatarUrl(player.profilePictureUrl, player.nickname)}
                      alt={player.nickname}
                      referrerPolicy="no-referrer"
                      onError={(e) => handleAvatarError(e, player.nickname)}
                      className={`rounded-full object-cover shrink-0 ${
                        rank === 1
                          ? 'w-11 h-11 border-2 border-amber-300'
                          : rank === 2 || rank === 3
                          ? 'w-9 h-9 border-2 border-white/40'
                          : 'w-8 h-8 border border-white/20'
                      }`}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-extrabold truncate ${
                            rank === 1
                              ? 'text-amber-200 text-sm sm:text-base'
                              : 'text-white text-xs sm:text-sm'
                          }`}
                        >
                          {player.nickname}
                        </span>
                        {roundsWon > 0 && (
                          <span
                            title="Won by scoring highest in an individual round"
                            className="px-1.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-300/40 text-amber-300 font-mono text-[10px] font-bold"
                          >
                            {roundsWon} {roundsWon === 1 ? 'Round Win' : 'Round Wins'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-[11px] font-mono text-purple-200/80 mt-0.5">
                        <span>{player.wordsSolved} words</span>
                        <span>·</span>
                        <span className="text-amber-300/90 inline-flex items-center gap-0.5">
                          <Zap className="w-3 h-3" /> Best {player.bestSpeedSeconds.toFixed(1)}s
                        </span>
                        <span className="hidden sm:inline">· Avg {avgSpeed.toFixed(1)}s</span>
                        {player.firstPlaceCount > 0 && (
                          <>
                            <span className="hidden sm:inline">·</span>
                            <span className="hidden sm:inline text-emerald-300">
                              {player.firstPlaceCount}× 1st
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono font-black tabular-nums ${
                        rank === 1
                          ? 'text-lg sm:text-xl text-amber-300'
                          : rank === 2
                          ? 'text-base sm:text-lg text-slate-100'
                          : rank === 3
                          ? 'text-base text-amber-400'
                          : 'text-sm text-white'
                      }`}
                    >
                      {player.totalScore.toLocaleString()}{' '}
                      <span className="text-[10px] font-normal opacity-75">pts</span>
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400 font-bold">
                      +{player.lastPoints} last
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="relative px-5 py-3.5 bg-[#2c0838]/80 border-t border-purple-300/25 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <p className="text-[11px] text-purple-200/75">
            Round Wins = highest scorer per round · Permanent points persist across rounds
          </p>
          <div className="flex items-center gap-2 ml-auto">
            {uniquePlayers.length > 0 && (
              confirmReset ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onResetOverallScoreboard();
                      setConfirmReset(false);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-extrabold cursor-pointer transition-colors"
                  >
                    Confirm Clear All
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-purple-100 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/15 hover:border-rose-400/40 text-purple-200 hover:text-rose-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Permanent</span>
                </button>
              )
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#2d0938] font-black text-xs cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
