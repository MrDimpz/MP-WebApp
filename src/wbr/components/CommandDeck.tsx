import { Ban, Flame, Sparkles, Tag, Timer } from 'lucide-react';
import { CATEGORY_LABELS } from '../data/dictionary';
import { CustomGameRules, GamePhase, PromptRule } from '../types/game';

interface CommandDeckProps {
  phase: GamePhase;
  wave: number;
  currentRule: PromptRule | null;
  spinDisplayRule: PromptRule | null;
  timeRemaining: number;
  totalPhaseDuration: number;
  customRules: CustomGameRules;
  isPaused: boolean;
  waitingForStart?: boolean;
  isOverlay?: boolean;
  wipeoutMessage: string | null;
}

export function CommandDeck({
  phase,
  wave,
  currentRule,
  spinDisplayRule,
  timeRemaining,
  totalPhaseDuration,
  customRules,
  isPaused,
  waitingForStart = false,
  isOverlay = false,
  wipeoutMessage,
}: CommandDeckProps) {
  const ratio =
    totalPhaseDuration > 0
      ? Math.max(0, Math.min(1, timeRemaining / totalPhaseDuration))
      : 0;

  const isActiveWave = phase === 'ACTIVE_WAVE';
  const isLagGrace = phase === 'LAG_GRACE';
  const isDanger = isActiveWave && timeRemaining <= 3.05 && timeRemaining > 0;
  const isWarning = isActiveWave && timeRemaining <= 6.0 && timeRemaining > 3.05;
  const isRuleLockedInIntro =
    phase === 'WAVE_INTRO' && !!currentRule && spinDisplayRule?.id === currentRule.id;

  // Fuse color shifts starlight gold -> warm amber -> flashing crimson
  let fuseBarColor = 'bg-[#F6C915]';
  let timerTextColor = 'text-[#F6C915]';
  let sparkColor = '#F6C915';

  if (phase === 'VICTORY') {
    fuseBarColor = 'bg-[#F6C915]';
    timerTextColor = 'text-[#F6C915]';
    sparkColor = '#F6C915';
  } else if (isLagGrace) {
    fuseBarColor = 'bg-amber-400';
    timerTextColor = 'text-amber-300';
    sparkColor = '#FBBF24';
  } else if (isDanger || phase === 'ELIMINATION' || phase === 'MEMORIAL') {
    fuseBarColor = 'bg-[#FF2A6D]';
    timerTextColor = 'text-[#FF2A6D]';
    sparkColor = '#FF2A6D';
  } else if (isWarning) {
    fuseBarColor = 'bg-amber-400';
    timerTextColor = 'text-amber-300';
    sparkColor = '#FBBF24';
  } else if (phase === 'LOBBY') {
    fuseBarColor = 'bg-emerald-400';
    timerTextColor = 'text-emerald-300';
    sparkColor = '#34D399';
  }

  const displayedRule = phase === 'WAVE_INTRO' ? spinDisplayRule ?? currentRule : currentRule;

  const hasModifiers =
    customRules.bannedLetters.length > 0 || customRules.globalCategory !== 'ALL';

  const tierLabel =
    displayedRule?.tier === 3
      ? 'TIER 3 · SUDDEN DEATH'
      : displayedRule?.tier === 2
        ? 'TIER 2 · MEDIUM'
        : 'TIER 1 · FAST';

  return (
    <section className="h-[22%] min-h-[138px] w-full shrink-0 px-3 py-2 flex flex-col justify-between gap-1.5 relative z-20">
      {/* Main Rule / Prompt Card */}
      <div
        className={`flex-1 rounded-xl border px-3.5 py-2 flex flex-col justify-center items-center text-center relative overflow-hidden transition-colors duration-150 ${
          isLagGrace
            ? 'bg-[#34160A] border-amber-400 wbr-danger-pulse'
            : isDanger
              ? 'bg-[#340A24] border-[#FF2A6D] wbr-danger-pulse'
              : phase === 'VICTORY'
                ? 'bg-[#2E1B0A] border-[#F6C915]/85'
                : 'bg-[#26083B]/95 border-[#D4A437]/40'
        }`}
      >
        {/* Top micro-meta row */}
        <div className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-purple-200/75 mb-0.5">
          <span className={`truncate ${isLagGrace ? 'text-amber-300' : ''}`}>
            {phase === 'LOBBY'
              ? 'CHAT TO ENTER ARENA'
              : phase === 'WAVE_INTRO'
                ? isRuleLockedInIntro
                  ? `WAVE ${wave} LOCKED · GET READY!`
                  : `LOCKING WAVE ${wave} RULE...`
                : isLagGrace
                  ? "TIME'S UP · STREAM LAG (+3S)"
                  : phase === 'ELIMINATION'
                    ? 'BATTLE SEQUENCE · KNOCKOUT!'
                    : phase === 'MEMORIAL'
                      ? 'IN MEMORIAM · FALLEN PLAYERS'
                      : phase === 'VICTORY'
                        ? 'SOLE SURVIVOR CROWNED'
                        : tierLabel}
          </span>
          {isPaused ? (
            <span className="text-[#F6C915] shrink-0">
              {waitingForStart ? 'READY · PRESS START' : 'PAUSED'}
            </span>
          ) : (
            <span className="font-mono tabular-nums text-amber-200/90 shrink-0">
              {phase === 'ACTIVE_WAVE'
                ? 'UNLIMITED GUESSES · NO REPEATS'
                : isLagGrace
                  ? 'LATE WORDS ACCEPTED'
                  : `MAX ${customRules.maxPlayers}`}
            </span>
          )}
        </div>

        {/* Giant Unmistakable Rule Prompt */}
        {wipeoutMessage ? (
          <div className="font-display font-black text-[23px] sm:text-[26px] leading-tight tracking-tight text-[#F6C915] uppercase">
            {wipeoutMessage}
          </div>
        ) : phase === 'LOBBY' ? (
          <div className="flex flex-col items-center">
            <div className="font-display font-black text-[25px] sm:text-[28px] leading-none tracking-tight text-white uppercase">
              TYPE <span className="text-[#F6C915]">&quot;JOIN&quot;</span> OR ANY WORD!
            </div>
            <p className="text-[11px] font-semibold text-purple-100/85 mt-1">
              {waitingForStart
                ? 'Holding in Lobby — press Start when ready to begin the countdown'
                : 'Comment in TikTok LIVE chat to drop your avatar in the arena'}
            </p>
          </div>
        ) : phase === 'VICTORY' ? (
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 font-display font-black text-[27px] leading-none tracking-tight text-[#F6C915] uppercase">
              <Sparkles className="w-5 h-5 shrink-0" />
              <span>CHAMPION CROWNED!</span>
            </div>
            <p className="text-[11px] font-semibold text-purple-100/85 mt-1">
              Next round lobby opens automatically
            </p>
          </div>
        ) : displayedRule ? (
          <div className="flex flex-col items-center w-full">
            <div
              className={`font-display font-black text-[27px] sm:text-[31px] leading-none tracking-tight uppercase transition-transform duration-75 ${
                phase === 'WAVE_INTRO'
                  ? 'text-[#F6C915] scale-[1.03]'
                  : 'text-white'
              }`}
            >
              {displayedRule.label}
            </div>
            {displayedRule.sublabel && (
              <p className="text-[11px] font-medium text-purple-100/85 mt-1 truncate max-w-full">
                {displayedRule.sublabel}
              </p>
            )}
          </div>
        ) : null}

        {/* Active Custom Rules Modifiers Strip */}
        {hasModifiers && (
          <div className="mt-1 flex items-center justify-center gap-2.5 text-[10px] font-bold uppercase tracking-wide text-purple-100 flex-wrap">
            {customRules.globalCategory !== 'ALL' && (
              <span className="flex items-center gap-1 text-[#F6C915]">
                <Tag className="w-3 h-3" />
                {CATEGORY_LABELS[customRules.globalCategory]}
              </span>
            )}
            {customRules.bannedLetters.length > 0 && (
              <span className="flex items-center gap-1 text-[#FF2A6D]">
                <Ban className="w-3 h-3" />
                BANNED: {customRules.bannedLetters.join(', ')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* High-Tension Fuse Countdown Bar */}
      <div className="flex items-center gap-2.5 px-1">
        <div className="flex items-center gap-1 shrink-0 min-w-[66px]">
          {isDanger ? (
            <Flame className="w-4 h-4 text-[#FF2A6D] shrink-0" />
          ) : (
            <Timer className={`w-4 h-4 shrink-0 ${timerTextColor}`} />
          )}
          <span
            className={`font-mono tabular-nums font-extrabold text-[17px] leading-none ${timerTextColor}`}
          >
            {Math.max(0, timeRemaining).toFixed(1)}s
          </span>
        </div>

        {/* Fuse track */}
        <div className="flex-1 h-3 rounded-full bg-[#24073A] border border-[#D4A437]/30 relative overflow-visible">
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-75 ${fuseBarColor}`}
            style={{
              width: `${Math.max(0, Math.min(100, ratio * 100))}%`,
              boxShadow: isOverlay ? undefined : `0 0 10px ${sparkColor}`,
            }}
          />
          {ratio > 0.01 && !isPaused && !isOverlay && (
            <span
              className="w-3.5 h-3.5 rounded-full absolute top-1/2 -ml-1.5 pointer-events-none wbr-fuse-spark"
              style={{
                left: `${Math.min(100, ratio * 100)}%`,
                backgroundColor: '#FFFFFF',
                boxShadow: `0 0 8px 2px ${sparkColor}`,
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
