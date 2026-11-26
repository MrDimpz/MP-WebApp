import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FastForward,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { SmoothMarquee } from '@/components/smooth-marquee';
import { gameEngine } from '../engine/gameEngine';
import type { HudSnapshot, WsConnectionStatus } from '../types';

interface BottomDockProps {
  hud: HudSnapshot;
  wsStatus: WsConnectionStatus;
  isLiveConnected?: boolean;
  isOverlay?: boolean;
  onTogglePause: () => void;
  onResetTeams: () => void;
  onNextPhase: () => void;
  onToggleMute: () => void;
  onOpenDrawer: () => void;
}

export function BottomDock({
  hud,
  wsStatus,
  isLiveConnected = false,
  isOverlay = false,
  onTogglePause,
  onResetTeams,
  onNextPhase,
  onToggleMute,
  onOpenDrawer,
}: BottomDockProps) {
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [quickWord, setQuickWord] = useState('');
  const [submitCue, setSubmitCue] = useState<{
    kind: 'VALID' | 'ERROR';
    message: string;
    key: number;
  } | null>(null);

  const isPaused = hud.status === 'PAUSED';
  const preview = gameEngine.validateWordPreview(quickWord);
  const isInvalidPreview =
    preview.status === 'TAKEN' ||
    preview.status === 'RULE_MISS' ||
    preview.status === 'MODIFIER_MISS' ||
    preview.status === 'NOT_IN_DICT';

  const handleQuickSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!quickWord.trim()) return;
    const res = gameEngine.processChatMessage({
      username: 'player_you',
      nickname: 'You',
      comment: quickWord,
    });
    if (res.outcome === 'VALID' || res.outcome === 'SWITCH') {
      setSubmitCue({ kind: 'VALID', message: res.reason, key: Date.now() });
      setQuickWord('');
    } else if (
      res.outcome === 'TAKEN' ||
      res.outcome === 'INVALID' ||
      res.outcome === 'COOLDOWN'
    ) {
      setSubmitCue({ kind: 'ERROR', message: res.reason, key: Date.now() });
    }
    setTimeout(() => {
      setSubmitCue((curr) => (curr && Date.now() - curr.key >= 1400 ? null : curr));
    }, 1500);
  };

  return (
    <section
      aria-label="Used words feed, quick type validator, and streamer controls"
      className={`relative z-20 shrink-0 ${
        isOverlay ? 'min-h-[62px]' : 'min-h-[126px]'
      } bg-[#180424]/96 border-t border-[#F6C915]/25 flex flex-col justify-between select-none`}
    >
      {/* 1. Smooth Non-Jumping Burned Words Marquee */}
      <div className="px-3 pt-1.5 pb-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-purple-200/75 mb-1">
          <span>
            USED-WORDS TICKER · LOCKED OUT{' '}
            <span className="tow-font-mono text-[#F6C915]">({hud.burnedWords.length}/10)</span>
          </span>
          <span className="text-purple-300/60">SCORE IMPACT</span>
        </div>

        <div className="w-full overflow-hidden rounded-lg bg-[#24073A] border border-[#D4A437]/25 py-1 min-h-[30px] flex items-center relative">
          {hud.burnedWords.length === 0 ? (
            <span className="text-[11px] text-purple-200/60 font-medium px-2.5 truncate">
              Waiting for first validated word...
            </span>
          ) : (
            <SmoothMarquee
              key={`tow-burned-${hud.matchNumber}`}
              items={hud.burnedWords}
              getItemKey={(entry) => entry.id}
              speedPxPerSec={48}
              gapPx={14}
              heightClassName="h-[22px]"
              order="newest-first"
              ariaLabel="Used words marquee"
              renderItem={(entry) => {
                const isRed = entry.team === 'RED';
                const isInverted = entry.effectLabel === 'INVERTED!';
                return (
                  <span className="inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap shrink-0">
                    <span
                      className={`tow-font-display font-extrabold text-[13.5px] tracking-wide ${
                        isInverted
                          ? 'text-[#D8B4FE]'
                          : entry.tier === 'BOUNTY'
                            ? 'text-[#F6C915]'
                            : isRed
                              ? 'text-[#FF4D79]'
                              : 'text-[#00E5FF]'
                      }`}
                    >
                      {entry.word}
                    </span>
                    <span className="text-[10px] text-purple-200/70 max-w-[74px] truncate">
                      {entry.nickname}
                    </span>
                    <span
                      className={`tow-font-mono text-[10px] font-extrabold ${
                        isInverted
                          ? 'text-[#D8B4FE]'
                          : entry.tier === 'BOUNTY'
                            ? 'text-[#F6C915]'
                            : isRed
                              ? 'text-[#FF7AA0]'
                              : 'text-[#67E8F9]'
                      }`}
                    >
                      {entry.effectLabel
                        ? entry.effectLabel
                        : `${isRed ? 'R' : 'B'}+${entry.pushPercent.toFixed(1)}%`}
                    </span>
                    <span className="text-purple-400/45 text-[10px] pl-1">·</span>
                  </span>
                );
              }}
            />
          )}
        </div>
      </div>

      {/* 2. Quick-Type Validator Input Bar (Hidden in LIVE Studio Overlay) */}
      {!isOverlay && (
        <form onSubmit={handleQuickSubmit} className="px-3 pb-1.5">
          <div
            key={submitCue?.key ?? 'idle'}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-colors ${
              submitCue?.kind === 'ERROR'
                ? 'tow-animate-input-shake border-[#FF2A5F] bg-[#FF2A5F]/15'
                : submitCue?.kind === 'VALID'
                  ? 'tow-animate-valid-flash border-[#4ADE80] bg-[#4ADE80]/15'
                  : isInvalidPreview
                    ? 'border-[#FF2A5F]/75 bg-[#2A0622]'
                    : preview.status === 'VALID'
                      ? 'border-[#4ADE80]/80 bg-[#0F2A1E]'
                      : 'border-[#F6C915]/25 bg-[#24073A]'
            }`}
          >
            <input
              type="text"
              value={quickWord}
              onChange={(e) => {
                setQuickWord(e.target.value);
                if (submitCue) setSubmitCue(null);
              }}
              placeholder={`Type word (${hud.baseRule.label}) or !SWITCH...`}
              aria-label="Type a word to fire"
              className="flex-1 min-w-0 bg-transparent text-xs font-bold text-white placeholder:text-purple-300/50 focus:outline-none uppercase tracking-wide"
            />
            {quickWord.trim().length > 0 && (
              <span
                className={`text-[10px] font-extrabold whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${
                  preview.status === 'VALID'
                    ? 'text-[#4ADE80]'
                    : isInvalidPreview
                      ? 'text-[#FF8FA3]'
                      : 'text-[#F6C915]'
                }`}
              >
                {preview.status === 'VALID' ? (
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                ) : isInvalidPreview ? (
                  <AlertCircle className="w-3 h-3" aria-hidden="true" />
                ) : null}
                {preview.status === 'VALID'
                  ? `+${preview.estimatedPush?.toFixed(1)}%`
                  : preview.status === 'TAKEN'
                    ? 'TAKEN'
                    : preview.status === 'RULE_MISS'
                      ? 'RULE MISS'
                      : preview.status === 'MODIFIER_MISS'
                        ? 'MODIFIER'
                        : preview.status === 'NOT_IN_DICT'
                          ? 'NOT A WORD'
                          : preview.status === 'COMMAND'
                            ? 'CMD'
                            : '3+ LTRS'}
              </span>
            )}
            {!quickWord.trim() && submitCue && (
              <span
                className={`text-[10px] font-extrabold whitespace-nowrap shrink-0 ${
                  submitCue.kind === 'VALID' ? 'text-[#4ADE80]' : 'text-[#FF8FA3]'
                }`}
              >
                {submitCue.message}
              </span>
            )}
            <button
              type="submit"
              aria-label="Send Word"
              className="h-6 px-2.5 rounded-md bg-[#F6C915] hover:bg-[#FFE047] text-[#180424] text-[10.5px] font-extrabold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              <Send className="w-2.5 h-2.5" aria-hidden="true" />
              <span>FIRE</span>
            </button>
          </div>
        </form>
      )}

      {/* 3. Collapsible Streamer Control Bar (Hidden in LIVE Studio Overlay) */}
      {!isOverlay && (
        <div className="border-t border-[#F6C915]/15 bg-[#13031D] px-2.5 py-1.5">
          {controlsCollapsed ? (
            <button
              type="button"
              onClick={() => setControlsCollapsed(false)}
              className="w-full h-6 flex items-center justify-center gap-1.5 text-[11px] font-bold text-purple-200/80 hover:text-[#F6C915] transition-colors cursor-pointer"
            >
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Host Controls</span>
              {(isLiveConnected || wsStatus === 'CONNECTED') && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" aria-label="Live Connected" />
              )}
            </button>
          ) : (
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onTogglePause}
                  className={`inline-flex items-center justify-center gap-1 h-7.5 px-2.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isPaused
                      ? 'bg-[#F6C915] text-[#180424]'
                      : 'bg-[#2B0938] hover:bg-[#3A0E4D] text-purple-100 border border-[#D4A437]/30'
                  }`}
                >
                  {isPaused ? (
                    <>
                      <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                      <span>{hud.awaitingStart ? 'Start' : 'Resume'}</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3" aria-hidden="true" />
                      <span>Pause</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onNextPhase}
                  title="Advance Phase or Trigger Sudden Death"
                  className="inline-flex items-center justify-center gap-1 h-7.5 px-2 rounded-md bg-[#2B0938] hover:bg-[#3A0E4D] border border-[#D4A437]/30 text-purple-100 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FastForward className="w-3 h-3 text-[#F6C915]" aria-hidden="true" />
                  <span>Phase</span>
                </button>

                <button
                  type="button"
                  onClick={onResetTeams}
                  title="Reset Teams & Session Wins"
                  className="inline-flex items-center justify-center gap-1 h-7.5 px-2 rounded-md bg-[#2B0938] hover:bg-[#3A0E4D] border border-[#D4A437]/30 text-purple-100 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3 h-3 text-[#F6C915]" aria-hidden="true" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={hud.muted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
                  title={hud.muted ? 'Unmute Audio' : 'Mute Audio'}
                  className="inline-flex items-center justify-center h-7.5 w-8 rounded-md bg-[#2B0938] hover:bg-[#3A0E4D] border border-[#D4A437]/30 text-[#F6C915] transition-colors cursor-pointer shrink-0"
                >
                  {hud.muted ? (
                    <VolumeX className="w-3.5 h-3.5 text-[#FF2A5F]" aria-hidden="true" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-[#F6C915]" aria-hidden="true" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={onOpenDrawer}
                  className={`inline-flex items-center justify-center gap-1.5 h-7.5 px-2.5 rounded-md text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isLiveConnected || wsStatus === 'CONNECTED'
                      ? 'bg-emerald-400 hover:bg-emerald-300 text-[#180424]'
                      : 'bg-[#F6C915] hover:bg-[#FFE047] text-[#180424]'
                  }`}
                >
                  {isLiveConnected || wsStatus === 'CONNECTED' ? (
                    <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{isLiveConnected ? 'LIVE' : 'Live / Sim'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setControlsCollapsed(true)}
                  aria-label="Collapse Host Controls"
                  title="Hide Host Bar"
                  className="inline-flex items-center justify-center h-7.5 w-7 rounded-md bg-[#2B0938]/70 hover:bg-[#3A0E4D] text-purple-200/75 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
