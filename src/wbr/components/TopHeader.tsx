import { Bomb, Crown, Radio, Users, Volume2, VolumeX } from 'lucide-react';
import { generateProfilePicture } from '../data/avatarGenerator';
import { GamePhase, HallOfFameEntry } from '../types/game';

interface TopHeaderProps {
  phase: GamePhase;
  wave: number;
  aliveCount: number;
  totalJoinedCount: number;
  safeCount: number;
  hallOfFame: HallOfFameEntry[];
  muted: boolean;
  onToggleMute: () => void;
  isLiveConnected?: boolean;
  liveHandle?: string;
  isOverlay?: boolean;
}

export function TopHeader({
  phase,
  wave,
  aliveCount,
  totalJoinedCount,
  safeCount,
  hallOfFame,
  muted,
  onToggleMute,
  isLiveConnected = false,
  liveHandle,
  isOverlay = false,
}: TopHeaderProps) {
  const phaseSubtitle =
    phase === 'LOBBY'
      ? 'LOBBY · OPEN ENTRY'
      : phase === 'VICTORY'
        ? `ROUND COMPLETE · WAVE ${wave}`
        : phase === 'LAG_GRACE'
          ? `WAVE ${wave} · STREAM LAG GRACE`
          : phase === 'ELIMINATION'
            ? `WAVE ${wave} · BATTLE`
            : phase === 'MEMORIAL'
              ? `WAVE ${wave} · IN MEMORIAM`
              : wave >= 5
                ? `WAVE ${wave} · SUDDEN DEATH`
                : wave >= 3
                  ? `WAVE ${wave} · ESCALATION`
                  : `WAVE ${wave} · WARMUP`;

  const subtitleColor =
    phase === 'VICTORY'
      ? 'text-[#F6C915]'
      : phase === 'LAG_GRACE'
        ? 'text-amber-300'
        : wave >= 5 && phase !== 'LOBBY'
          ? 'text-[#FF2A6D]'
          : 'text-[#F6C915]';

  const topThree = hallOfFame.slice(0, 3);
  const rankColors = ['text-[#F6C915]', 'text-purple-200', 'text-amber-400'];

  return (
    <header className="h-[12%] min-h-[78px] w-full shrink-0 px-3 pt-2 pb-1.5 flex flex-col justify-between border-b border-[#F6C915]/25 bg-[#180424]/95 relative z-20">
      {/* Row 1: Logo + Wave Info | Alive Counter + Mute */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F6C915] via-[#F59E0B] to-[#D4A437] flex items-center justify-center shrink-0 shadow-[0_0_14px_rgba(246,201,21,0.45)] border border-amber-200/50">
            <Bomb className="w-4.5 h-4.5 text-[#1B042A] stroke-[2.5]" />
          </div>
          <div className="min-w-0 leading-none">
            <h1 className="font-display font-black text-[18px] tracking-tight text-white uppercase leading-none truncate">
              WORD BOMB <span className="text-[#F6C915]">ROYALE</span>
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className={`text-[10px] font-bold tracking-wider uppercase truncate ${subtitleColor}`}>
                {phaseSubtitle}
              </p>
              {isLiveConnected && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold uppercase text-emerald-300 shrink-0">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  <span>{liveHandle ? `@${liveHandle.replace(/^@+/, '')}` : 'LIVE'}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Alive Counter & Audio Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right leading-none">
            <div className="flex items-center justify-end gap-1 font-mono tabular-nums font-extrabold text-[14px] text-white">
              <Users className="w-3.5 h-3.5 text-[#F6C915] shrink-0" />
              <span>{aliveCount}</span>
              <span className="text-purple-300/60 text-[11px]">/ {Math.max(totalJoinedCount, aliveCount)}</span>
            </div>
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-purple-200/75 mt-0.5 tabular-nums">
              {phase === 'ACTIVE_WAVE' || phase === 'LAG_GRACE' ? (
                <span className="text-emerald-300">{safeCount} SAFE</span>
              ) : (
                <span>ALIVE</span>
              )}
            </div>
          </div>

          {!isOverlay && (
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
              title={muted ? 'Unmute Sound' : 'Mute Sound'}
              className="w-8 h-8 rounded-lg border border-[#F6C915]/35 bg-[#2B0938] hover:bg-[#3A0E4D] text-[#F6C915] flex items-center justify-center transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-[#F6C915]"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-[#FF2A6D]" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#F6C915]" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Compact Live Hall of Fame Strip */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F6C915]/15 min-h-[22px]">
        <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[#F6C915] shrink-0">
          <Crown className="w-3 h-3 shrink-0" />
          <span>HOF</span>
        </div>

        {topThree.length === 0 ? (
          <div className="text-[10.5px] text-purple-200/65 truncate flex-1 text-right">
            Awaiting first champion...
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2.5 overflow-hidden flex-1">
            {topThree.map((entry, idx) => (
              <div
                key={entry.username}
                className="flex items-center gap-1 min-w-0 shrink-0 max-w-[33%]"
              >
                <span className={`font-mono text-[10px] font-extrabold ${rankColors[idx]}`}>
                  #{idx + 1}
                </span>
                <span className="w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 border border-[#F6C915]/40 overflow-hidden bg-[#2B0938]">
                  <img
                    src={entry.avatarUrl || generateProfilePicture(entry.username)}
                    alt={entry.username}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </span>
                <span className="text-[10.5px] font-semibold text-purple-100 truncate max-w-[66px]">
                  {entry.username.replace(/^@/, '')}
                </span>
                <span className="font-mono text-[10px] font-bold text-[#F6C915] tabular-nums shrink-0">
                  {entry.wins}W
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
