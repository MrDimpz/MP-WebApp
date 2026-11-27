import { Award, Crown, Medal, Play, Trophy } from 'lucide-react';
import { WinTallyBadge } from '@/components/interactive-games/win-tally-badge';
import type { HudSnapshot } from '../types';

interface VictoryOverlayProps {
  hud: HudSnapshot;
  isOverlay?: boolean;
  onStartNextMatch: () => void;
}

export function VictoryOverlay({
  hud,
  isOverlay = false,
  onStartNextMatch,
}: VictoryOverlayProps) {
  const victory = hud.victory;
  if (!victory || hud.status !== 'VICTORY') return null;

  const isRed = victory.winner === 'RED';
  const accentColor = isRed ? '#FF2A5F' : '#00E5FF';
  const reasonLabel =
    victory.reason === 'KNOCKOUT'
      ? '100% BASE KNOCKOUT'
      : victory.reason === 'SUDDEN_DEATH'
        ? 'SUDDEN DEATH WINNER'
        : `TERRITORY VICTORY · ${isRed ? victory.finalRedPercent : victory.finalBluePercent}%`;

  const top5 = victory.mvps.slice(0, 5);
  const firstPlace = top5[0] ?? null;
  const secondPlace = top5[1] ?? null;
  const thirdPlace = top5[2] ?? null;
  const runnersUp = top5.slice(3, 5);

  const teamColor = (team: 'RED' | 'BLUE') => (team === 'RED' ? '#FF2A5F' : '#00E5FF');

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-between px-4 py-2.5 select-none overflow-hidden">
      {/* Split Red (Top Half) / Blue (Bottom Half) Field Backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="flex-1 bg-gradient-to-b from-[#6B0A2B]/90 via-[#3B0722]/85 to-[#1C0526]/88 backdrop-blur-sm border-b border-white/15" />
        <div className="flex-1 bg-gradient-to-t from-[#063B6B]/90 via-[#091E46]/85 to-[#1C0526]/88 backdrop-blur-sm" />
      </div>

      {/* TOP HALF — TEAM RED CURRENT WINS */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center shrink-0 pt-0.5">
        <span className="text-[11px] font-black tracking-[0.22em] uppercase text-[#FFF3B0] drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
          TEAM RED WINS
        </span>
        <div
          className={`tow-font-mono text-5xl sm:text-6xl font-black leading-none tabular-nums mt-0.5 ${
            isRed
              ? 'text-[#FFE600] drop-shadow-[0_0_22px_rgba(255,230,0,0.85)]'
              : 'text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.65)]'
          }`}
          style={{
            WebkitTextStroke: '1.5px rgba(20, 3, 33, 0.85)',
          }}
          aria-label={`Team Red total wins: ${hud.redWins}`}
        >
          {hud.redWins}
        </div>
      </div>

      {/* CENTER — VICTORY SUMMARY & TOP 5 PODIUM */}
      <div
        className="relative z-10 w-full max-w-[364px] max-h-[66%] overflow-y-auto tow-thin-scroll rounded-2xl bg-gradient-to-b from-[#290840]/96 to-[#170426]/96 border-2 p-3 sm:p-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.88)] my-1"
        style={{ borderColor: accentColor }}
      >
        {/* Winner Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center gap-1.5 text-[10.5px] font-extrabold tracking-widest text-[#F6C915]">
            <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{reasonLabel}</span>
          </div>
          <h2
            className="tow-font-display text-3xl sm:text-4xl font-black tracking-wide leading-none mt-1"
            style={{ color: accentColor }}
          >
            TEAM {victory.winner} WINS!
          </h2>
          <div className="mt-1 flex items-center justify-center gap-3 text-xs font-semibold text-purple-100/85 tabular-nums">
            <span>
              RED <strong className="text-[#FF2A5F] tow-font-mono">{victory.finalRedPercent}%</strong>
            </span>
            <span aria-hidden="true" className="text-purple-400/50">·</span>
            <span>
              BLUE <strong className="text-[#00E5FF] tow-font-mono">{victory.finalBluePercent}%</strong>
            </span>
          </div>
          <div className="mt-1.5 flex justify-center">
            <WinTallyBadge
              gameId="tow"
              winnerName={`Team ${victory.winner}`}
              label={`Team ${victory.winner} Tally`}
            />
          </div>
        </div>

        {/* Top 5 Players — Elevated Top 3 Podium + Compact #4–#5 */}
        <div className="mt-2.5">
          <div className="text-[10px] font-extrabold tracking-widest text-[#F6C915]/90 mb-1.5 text-center uppercase">
            TOP 5 PLAYERS
          </div>
          {top5.length === 0 ? (
            <div className="text-center text-xs text-purple-200/70 py-2.5">
              No words landed this match.
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* 1ST PLACE — GOLD CHAMPION SPOTLIGHT */}
              {firstPlace && (
                <div className="relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-gradient-to-r from-[#F6C915]/28 via-[#F6C915]/14 to-[#160424]/95 border-2 border-[#F6C915] shadow-[0_0_20px_rgba(246,201,21,0.28)]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#F6C915] bg-[#160424] shadow-[0_0_12px_rgba(246,201,21,0.45)]">
                        <img
                          src={firstPlace.avatarUrl}
                          alt={`${firstPlace.nickname} profile picture`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Crown
                        className="w-3.5 h-3.5 text-[#F6C915] fill-[#F6C915] absolute -top-2 -right-1 drop-shadow"
                        aria-hidden="true"
                      />
                      <span className="absolute -bottom-1 -left-1 px-1 rounded bg-[#F6C915] text-[#170426] font-black text-[8.5px] leading-tight shadow">
                        1ST
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: teamColor(firstPlace.team) }}
                          aria-label={`Team ${firstPlace.team}`}
                        />
                        <span className="text-sm font-black text-white truncate">
                          {firstPlace.nickname}
                        </span>
                        <WinTallyBadge
                          gameId="tow"
                          winnerName={firstPlace.nickname}
                          compact
                        />
                      </div>
                      <div className="text-[10px] text-amber-100/85 truncate mt-0.5">
                        Best: <strong className="text-[#F6C915]">{firstPlace.biggestWord}</strong>{' '}
                        <span className="tow-font-mono">
                          (+{firstPlace.biggestWordPush.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 bg-black/35 px-2 py-1 rounded-lg border border-[#F6C915]/40">
                    <div className="tow-font-mono text-sm sm:text-base font-black text-[#F6C915] leading-none tabular-nums">
                      +{firstPlace.totalPush.toFixed(1)}%
                    </div>
                    <div className="text-[9px] text-amber-100/75 tabular-nums mt-0.5">
                      {firstPlace.wordsCount} {firstPlace.wordsCount === 1 ? 'word' : 'words'}
                    </div>
                  </div>
                </div>
              )}

              {/* 2ND & 3RD PLACE — PROMINENT SILVER & BRONZE CARDS */}
              {(secondPlace || thirdPlace) && (
                <div className={`grid gap-1.5 ${secondPlace && thirdPlace ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {secondPlace && (
                    <div className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-xl bg-gradient-to-br from-slate-200/20 via-slate-400/10 to-[#160424]/92 border border-slate-300/75 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-slate-200 bg-[#160424]">
                            <img
                              src={secondPlace.avatarUrl}
                              alt={`${secondPlace.nickname} profile picture`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="absolute -top-1 -left-1 px-1 rounded bg-slate-200 text-slate-900 font-black text-[8px] leading-tight">
                            2
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 text-[8.5px] font-extrabold uppercase text-slate-200">
                            <Medal className="w-2.5 h-2.5 text-slate-200 shrink-0" aria-hidden="true" />
                            <span>2ND</span>
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: teamColor(secondPlace.team) }}
                            />
                          </div>
                          <div className="text-xs font-extrabold text-white truncate">
                            {secondPlace.nickname}
                          </div>
                          <div className="text-[9px] text-slate-200/75 truncate">
                            {secondPlace.biggestWord}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="tow-font-mono text-xs font-black text-slate-100 tabular-nums leading-tight">
                          +{secondPlace.totalPush.toFixed(1)}%
                        </div>
                        <div className="text-[8.5px] text-slate-300/75 tabular-nums">
                          {secondPlace.wordsCount}w
                        </div>
                      </div>
                    </div>
                  )}

                  {thirdPlace && (
                    <div className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-xl bg-gradient-to-br from-amber-600/24 via-orange-700/12 to-[#160424]/92 border border-amber-500/70 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-amber-500 bg-[#160424]">
                            <img
                              src={thirdPlace.avatarUrl}
                              alt={`${thirdPlace.nickname} profile picture`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="absolute -top-1 -left-1 px-1 rounded bg-amber-600 text-white font-black text-[8px] leading-tight">
                            3
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 text-[8.5px] font-extrabold uppercase text-amber-300">
                            <Award className="w-2.5 h-2.5 text-amber-400 shrink-0" aria-hidden="true" />
                            <span>3RD</span>
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: teamColor(thirdPlace.team) }}
                            />
                          </div>
                          <div className="text-xs font-extrabold text-white truncate">
                            {thirdPlace.nickname}
                          </div>
                          <div className="text-[9px] text-amber-200/75 truncate">
                            {thirdPlace.biggestWord}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="tow-font-mono text-xs font-black text-amber-300 tabular-nums leading-tight">
                          +{thirdPlace.totalPush.toFixed(1)}%
                        </div>
                        <div className="text-[8.5px] text-amber-200/75 tabular-nums">
                          {thirdPlace.wordsCount}w
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4TH & 5TH PLACE — COMPACT SECONDARY RUNNERS-UP */}
              {runnersUp.length > 0 && (
                <div className={`grid gap-1.5 ${runnersUp.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {runnersUp.map((mvp, idx) => (
                    <div
                      key={mvp.username}
                      className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-[#12031E]/75 border border-purple-300/20 min-w-0"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="tow-font-mono text-[9.5px] font-bold text-purple-300/80 shrink-0">
                          #{idx + 4}
                        </span>
                        <img
                          src={mvp.avatarUrl}
                          alt={`${mvp.nickname} profile picture`}
                          referrerPolicy="no-referrer"
                          className="w-5 h-5 rounded-full object-cover border border-white/20 shrink-0"
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: teamColor(mvp.team) }}
                        />
                        <span className="text-[11px] font-semibold text-purple-100/90 truncate">
                          {mvp.nickname}
                        </span>
                      </div>
                      <span className="tow-font-mono text-[10.5px] font-bold text-purple-200/90 tabular-nums shrink-0">
                        +{mvp.totalPush.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* !SWITCH Intermission Prompt */}
        <div className="mt-2.5 pt-2 border-t border-[#F6C915]/20 text-center">
          {hud.recentSwitchMessage ? (
            <div className="text-xs font-bold text-[#F6C915] mb-1.5">
              {hud.recentSwitchMessage}
            </div>
          ) : (
            <div className="text-[10.5px] text-purple-200/80 mb-1.5">
              Type <strong className="text-[#F6C915] tow-font-mono">!SWITCH</strong> in chat now to
              swap to the underdog team
            </div>
          )}
          {!isOverlay ? (
            <button
              type="button"
              onClick={onStartNextMatch}
              className="w-full h-9 rounded-xl font-extrabold text-xs sm:text-sm text-[#160524] bg-[#F6C915] hover:bg-[#FFE047] flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg"
            >
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>Next Match in {victory.nextMatchInSeconds}s · Start Now</span>
            </button>
          ) : (
            <div className="text-xs font-extrabold text-[#F6C915] tow-font-mono">
              NEXT MATCH IN {victory.nextMatchInSeconds}s
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM HALF — TEAM BLUE CURRENT WINS */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center shrink-0 pb-0.5">
        <div
          className={`tow-font-mono text-5xl sm:text-6xl font-black leading-none tabular-nums ${
            !isRed
              ? 'text-[#FFE600] drop-shadow-[0_0_22px_rgba(255,230,0,0.85)]'
              : 'text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.65)]'
          }`}
          style={{
            WebkitTextStroke: '1.5px rgba(20, 3, 33, 0.85)',
          }}
          aria-label={`Team Blue total wins: ${hud.blueWins}`}
        >
          {hud.blueWins}
        </div>
        <span className="text-[11px] font-black tracking-[0.22em] uppercase text-[#FFF3B0] drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] mt-0.5">
          TEAM BLUE WINS
        </span>
      </div>
    </div>
  );
}
