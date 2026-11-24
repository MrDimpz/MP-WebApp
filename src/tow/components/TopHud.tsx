import { Radio, RefreshCw, Shield, ShieldOff, Users, Zap } from 'lucide-react';
import type { HudSnapshot } from '../types';

interface TopHudProps {
  hud: HudSnapshot;
  isLiveConnected?: boolean;
  liveHandle?: string;
}

function formatClock(sec: number): string {
  const clamped = Math.max(0, Math.ceil(sec));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TopHud({ hud, isLiveConnected = false, liveHandle }: TopHudProps) {
  const redPct = Math.round(hud.redPercent);
  const bluePct = 100 - redPct;
  const isOverdrive = hud.phase === 3 && hud.status === 'PLAYING';
  const isSuddenDeath = hud.status === 'SUDDEN_DEATH';
  const clockSec = isSuddenDeath ? hud.suddenDeathSec : hud.timeRemainingSec;
  const now = Date.now();
  const redInverted = now < hud.redPowerUps.invertedUntil;
  const blueInverted = now < hud.bluePowerUps.invertedUntil;

  const phaseText = isSuddenDeath
    ? 'SUDDEN DEATH'
    : hud.status === 'PAUSED'
      ? 'MATCH PAUSED'
      : hud.status === 'VICTORY'
        ? 'MATCH COMPLETE'
        : hud.phase === 1
          ? 'PHASE 1 · SKIRMISH'
          : hud.phase === 2
            ? 'PHASE 2 · MODIFIER'
            : 'OVERDRIVE 2X';

  return (
    <header className="relative z-20 shrink-0 bg-[#180424]/96 border-b border-[#F6C915]/25 flex flex-col justify-between select-none">
      {/* Top Session Score Tracker / Auto-Balance Notice + LIVE indicator */}
      <div className="flex items-center justify-center gap-2 px-3 pt-1.5 pb-1 text-[10px] font-bold tracking-wider text-purple-200/80 tabular-nums truncate">
        {hud.balanceNotice ? (
          <span className="text-[#F6C915] font-extrabold truncate">{hud.balanceNotice}</span>
        ) : (
          <>
            <span className="shrink-0">
              RED WINS: <strong className="text-[#FF2A5F] tow-font-mono">{hud.redWins}</strong>
            </span>
            <span aria-hidden="true" className="text-purple-400/40 shrink-0">|</span>
            <span className="text-[#F6C915]/95 font-extrabold truncate">
              TUG OF WORDS · #{hud.matchNumber}
            </span>
            {isLiveConnected && (
              <span className="inline-flex items-center gap-1 text-emerald-300 font-extrabold shrink-0">
                <Radio className="w-2.5 h-2.5 animate-pulse" aria-hidden="true" />
                <span>{liveHandle ? `@${liveHandle.replace(/^@+/, '')}` : 'LIVE'}</span>
              </span>
            )}
            <span aria-hidden="true" className="text-purple-400/40 shrink-0">|</span>
            <span className="shrink-0">
              BLUE WINS: <strong className="text-[#00E5FF] tow-font-mono">{hud.blueWins}</strong>
            </span>
          </>
        )}
      </div>

      {/* Main 3-Column Broadcast HUD with generous spacing around center clock */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3 pt-0.5 pb-2 gap-2.5">
        {/* LEFT: TEAM RED */}
        <div className="flex flex-col items-start min-w-0 overflow-hidden">
          <span className="text-[9.5px] font-extrabold tracking-widest text-[#FF6B93] leading-none truncate max-w-full">
            TEAM RED
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5 max-w-full">
            <span className="tow-font-display text-2xl sm:text-[28px] font-black leading-none text-[#FF2A5F] tabular-nums tracking-tight shrink-0">
              {redPct}%
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-purple-100/85 tabular-nums shrink-0">
              <Users className="w-2.5 h-2.5 text-[#FF2A5F]" aria-hidden="true" />
              {hud.redPlayerCount}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9.5px] text-purple-100/90 mt-0.5 min-h-[13px] tabular-nums">
            {hud.redShields > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[#F6C915] font-bold">
                <Shield className="w-2.5 h-2.5" aria-hidden="true" />
                {hud.redShields}
              </span>
            )}
            {hud.redPowerUps.doublePushCharges > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[#F6C915] font-extrabold">
                <Zap className="w-2.5 h-2.5" aria-hidden="true" />
                2X
              </span>
            )}
            {hud.redPowerUps.shieldBreakReady && (
              <span className="inline-flex items-center gap-0.5 text-[#FB7185] font-extrabold">
                <ShieldOff className="w-2.5 h-2.5" aria-hidden="true" />
                BRK
              </span>
            )}
            {redInverted && (
              <span className="inline-flex items-center gap-0.5 text-[#D8B4FE] font-extrabold">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" aria-hidden="true" />
                INV
              </span>
            )}
          </div>
        </div>

        {/* CENTER: 60s CLOCK + PHASE */}
        <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-lg bg-[#2B0938]/95 border border-[#F6C915]/45 shadow-[0_0_16px_rgba(246,201,21,0.16)] shrink-0">
          <div
            className={`tow-font-mono text-lg sm:text-xl font-extrabold leading-none tracking-tight ${
              isSuddenDeath || (isOverdrive && clockSec <= 10)
                ? 'text-[#F6C915]'
                : 'text-white'
            }`}
          >
            {formatClock(clockSec)}
          </div>
          <div
            className={`text-[8.5px] font-extrabold tracking-widest mt-1 leading-none whitespace-nowrap ${
              isOverdrive || isSuddenDeath
                ? 'text-[#F6C915]'
                : hud.phase === 2
                  ? 'text-amber-300'
                  : 'text-purple-200'
            }`}
          >
            {phaseText}
          </div>
        </div>

        {/* RIGHT: TEAM BLUE */}
        <div className="flex flex-col items-end min-w-0 overflow-hidden">
          <span className="text-[9.5px] font-extrabold tracking-widest text-[#67E8F9] leading-none truncate max-w-full">
            TEAM BLUE
          </span>
          <div className="flex items-baseline justify-end gap-1.5 mt-0.5 max-w-full">
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-purple-100/85 tabular-nums shrink-0">
              {hud.bluePlayerCount}
              <Users className="w-2.5 h-2.5 text-[#00E5FF]" aria-hidden="true" />
            </span>
            <span className="tow-font-display text-2xl sm:text-[28px] font-black leading-none text-[#00E5FF] tabular-nums tracking-tight shrink-0">
              {bluePct}%
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 text-[9.5px] text-purple-100/90 mt-0.5 min-h-[13px] tabular-nums">
            {blueInverted && (
              <span className="inline-flex items-center gap-0.5 text-[#D8B4FE] font-extrabold">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" aria-hidden="true" />
                INV
              </span>
            )}
            {hud.bluePowerUps.shieldBreakReady && (
              <span className="inline-flex items-center gap-0.5 text-[#FB7185] font-extrabold">
                <ShieldOff className="w-2.5 h-2.5" aria-hidden="true" />
                BRK
              </span>
            )}
            {hud.bluePowerUps.doublePushCharges > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[#F6C915] font-extrabold">
                <Zap className="w-2.5 h-2.5" aria-hidden="true" />
                2X
              </span>
            )}
            {hud.blueShields > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[#F6C915] font-bold">
                <Shield className="w-2.5 h-2.5" aria-hidden="true" />
                {hud.blueShields}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Crisp Territory Balance Hairline Bar */}
      <div className="w-full h-[3.5px] bg-[#0B1C30] flex overflow-hidden">
        <div
          className="h-full bg-[#FF2A5F] transition-[width] duration-150 ease-out"
          style={{ width: `${hud.redPercent}%` }}
        />
        <div className="w-[2.5px] h-full bg-[#F6C915] shrink-0" />
        <div className="h-full flex-1 bg-[#00E5FF]" />
      </div>
    </header>
  );
}
