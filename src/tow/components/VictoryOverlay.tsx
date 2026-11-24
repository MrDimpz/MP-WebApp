import { Crown, Play, Trophy } from 'lucide-react';
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

  return (
    <div className="absolute inset-0 z-30 bg-[#140321]/88 backdrop-blur-md flex flex-col items-center justify-center p-5 select-none">
      <div
        className="w-full max-w-[360px] rounded-2xl bg-gradient-to-b from-[#290840] to-[#170426] border-2 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.88)]"
        style={{ borderColor: accentColor }}
      >
        {/* Winner Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center gap-1.5 text-xs font-extrabold tracking-widest text-[#F6C915]">
            <Trophy className="w-4 h-4" aria-hidden="true" />
            <span>{reasonLabel}</span>
          </div>
          <h2
            className="tow-font-display text-4xl sm:text-5xl font-black tracking-wide leading-none mt-1.5"
            style={{ color: accentColor }}
          >
            TEAM {victory.winner} WINS!
          </h2>
          <div className="mt-2 flex items-center justify-center gap-3 text-xs font-semibold text-purple-100/85 tabular-nums">
            <span>
              RED <strong className="text-[#FF2A5F] tow-font-mono">{victory.finalRedPercent}%</strong>
            </span>
            <span aria-hidden="true" className="text-purple-400/50">·</span>
            <span>
              BLUE <strong className="text-[#00E5FF] tow-font-mono">{victory.finalBluePercent}%</strong>
            </span>
          </div>
        </div>

        {/* Top 3 MVPs Podium */}
        <div className="mt-5">
          <div className="text-[11px] font-extrabold tracking-widest text-[#F6C915]/90 mb-2 text-center">
            TOP 3 WINNING MVPS
          </div>
          {victory.mvps.length === 0 ? (
            <div className="text-center text-xs text-purple-200/70 py-4">
              No words landed this match.
            </div>
          ) : (
            <div className="space-y-2">
              {victory.mvps.map((mvp, index) => (
                <div
                  key={mvp.username}
                  className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-[#160424]/85 border border-[#F6C915]/25"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <div
                        className="w-10 h-10 rounded-full overflow-hidden border-2 bg-[#160424]"
                        style={{
                          borderColor: index === 0 ? '#F6C915' : 'rgba(246, 201, 21, 0.4)',
                        }}
                      >
                        <img
                          src={mvp.avatarUrl}
                          alt={`${mvp.nickname} profile picture`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {index === 0 && (
                        <Crown
                          className="w-3.5 h-3.5 text-[#F6C915] absolute -top-2 -right-1 drop-shadow"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="tow-font-mono text-[11px] font-bold text-[#F6C915]">
                          #{index + 1}
                        </span>
                        <span className="text-sm font-bold text-white truncate">
                          {mvp.nickname}
                        </span>
                      </div>
                      <div className="text-[11px] text-purple-200/75 truncate">
                        Best: <strong className="text-[#F6C915]">{mvp.biggestWord}</strong>{' '}
                        <span className="tow-font-mono">(+{mvp.biggestWordPush.toFixed(1)}%)</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className="tow-font-mono text-sm font-extrabold"
                      style={{ color: accentColor }}
                    >
                      +{mvp.totalPush.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-purple-200/70 tabular-nums">
                      {mvp.wordsCount} {mvp.wordsCount === 1 ? 'word' : 'words'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* !SWITCH Intermission Prompt */}
        <div className="mt-4 pt-3 border-t border-[#F6C915]/20 text-center">
          {hud.recentSwitchMessage ? (
            <div className="text-xs font-bold text-[#F6C915] mb-2">
              {hud.recentSwitchMessage}
            </div>
          ) : (
            <div className="text-[11px] text-purple-200/80 mb-3">
              Type <strong className="text-[#F6C915] tow-font-mono">!SWITCH</strong> in chat now to
              swap to the underdog team
            </div>
          )}
          {!isOverlay ? (
            <button
              type="button"
              onClick={onStartNextMatch}
              className="w-full h-10 rounded-xl font-extrabold text-sm text-[#160524] bg-[#F6C915] hover:bg-[#FFE047] flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" aria-hidden="true" />
              <span>Next Match in {victory.nextMatchInSeconds}s · Start Now</span>
            </button>
          ) : (
            <div className="text-xs font-extrabold text-[#F6C915] tow-font-mono">
              NEXT MATCH IN {victory.nextMatchInSeconds}s
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
