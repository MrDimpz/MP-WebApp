import { Flame, Shield, Zap } from 'lucide-react';
import type { HudSnapshot } from '../types';

interface HorizonCommandDeckProps {
  hud: HudSnapshot;
}

export function HorizonCommandDeck({ hud }: HorizonCommandDeckProps) {
  // Clamp vertical position between 18% and 80% so the prompt card rides the moving border cleanly
  const clampedY = Math.max(18, Math.min(80, hud.redPercent));
  const isOverdrive = hud.phase === 3;
  const bountyPct = hud.activeBounty
    ? Math.max(
        0,
        Math.min(100, (hud.bountyRemainingSec / (hud.activeBounty.durationMs / 1000)) * 100)
      )
    : 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none">
      {/* Floating Command Deck anchored to the moving Horizon Laser Border */}
      <div
        className="absolute left-1/2 w-[88%] max-w-[380px] transition-[top] duration-150 ease-out"
        style={{
          top: `${clampedY}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div
          className={`rounded-xl bg-[#1A052B]/94 backdrop-blur-md border px-3.5 py-2 shadow-[0_10px_32px_rgba(0,0,0,0.75)] ${
            isOverdrive
              ? 'border-[#F6C915] shadow-[0_0_26px_rgba(246,201,21,0.38)]'
              : 'border-[#F6C915]/45'
          }`}
        >
          {/* Primary Rule Line */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Zap
                className={`w-4 h-4 shrink-0 ${isOverdrive ? 'text-[#F6C915]' : 'text-[#F6C915]'}`}
                aria-hidden="true"
              />
              <h2 className="tow-font-display text-[22px] sm:text-2xl font-black tracking-wide text-white leading-none truncate">
                {hud.baseRule.label}
              </h2>
            </div>
            {isOverdrive && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-extrabold text-[#F6C915] tracking-wider whitespace-nowrap">
                <Flame className="w-3.5 h-3.5" aria-hidden="true" />
                2X POWER
              </span>
            )}
          </div>

          {/* Modifier + Bonus Shield Letter Row */}
          <div className="mt-1.5 pt-1.5 border-t border-[#F6C915]/20 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] font-bold">
            <div className="flex items-center gap-1.5 min-w-0">
              {hud.activeModifier ? (
                <span className="text-[#FF8FA3] tracking-wide truncate">
                  MODIFIER: <strong className="text-white">{hud.activeModifier.label}</strong>
                </span>
              ) : (
                <span className="text-purple-200/75 font-semibold">
                  3+ LETTERS · LONGER = MORE PUSH
                </span>
              )}
            </div>
            <div className="inline-flex items-center gap-1 text-[#F6C915] shrink-0 whitespace-nowrap">
              <Shield className="w-3 h-3" aria-hidden="true" />
              <span>BONUS [{hud.bonusLetter}] = SHIELD</span>
            </div>
          </div>

          {/* Golden Bounty Banner (appears every 18s for 10s) */}
          {hud.activeBounty && (
            <div className="mt-2 pt-1.5 border-t border-[#F6C915]/40">
              <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold text-[#F6C915]">
                <span className="truncate">BOUNTY: {hud.activeBounty.shortLabel}</span>
                <span className="tow-font-mono shrink-0">
                  {hud.bountyRemainingSec.toFixed(1)}s
                </span>
              </div>
              <div className="mt-1 w-full h-1.5 bg-[#2B0938] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#F6C915] transition-[width] duration-100 ease-linear"
                  style={{ width: `${bountyPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dramatic Center-Screen Event Banner */}
      {hud.activeBanner && (
        <div className="pointer-events-none absolute inset-x-0 top-[15%] z-30 flex justify-center px-3">
          <div
            key={hud.activeBanner.id}
            className="tow-animate-banner-pop w-full max-w-[340px]"
          >
            <div
              className={`rounded-xl px-3.5 py-2 text-center border-2 shadow-[0_14px_40px_rgba(0,0,0,0.85)] backdrop-blur-md ${
                hud.activeBanner.accent === 'RED'
                  ? 'bg-[#2E071B]/95 border-[#FF2A5F] text-white'
                  : hud.activeBanner.accent === 'BLUE'
                    ? 'bg-[#081D38]/95 border-[#00E5FF] text-white'
                    : hud.activeBanner.accent === 'GOLD'
                      ? 'bg-[#281606]/95 border-[#F6C915] text-[#F6C915]'
                      : hud.activeBanner.accent === 'PURPLE'
                        ? 'bg-[#2A0845]/95 border-[#C084FC] text-[#E9D5FF]'
                        : 'bg-[#1D0630]/95 border-[#F6C915]/80 text-white'
              }`}
            >
              <div className="tow-font-display text-xl sm:text-2xl font-black tracking-wider leading-tight uppercase">
                {hud.activeBanner.title}
              </div>
              <div className="mt-0.5 text-[11px] sm:text-xs font-bold text-white/95 leading-snug">
                {hud.activeBanner.subtitle}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paused Dimmer */}
      {hud.status === 'PAUSED' && (
        <div className="absolute inset-0 bg-[#12031E]/72 backdrop-blur-[2px] flex items-center justify-center z-20">
          <div className="px-5 py-3 rounded-xl bg-[#1D052F]/96 border border-[#F6C915]/50 text-center shadow-2xl">
            <div className="tow-font-display text-3xl font-black tracking-wider text-[#F6C915]">
              MATCH PAUSED
            </div>
            <div className="text-xs text-purple-200/85 mt-0.5">
              Tap Resume in the host bar to continue the battle
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
