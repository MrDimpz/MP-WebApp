import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import type {
  GuessEntry,
  LadderInstanceView,
  LadderTargetView,
} from '../shared/types';

interface LadderBoardProps {
  board: LadderInstanceView;
  isQuad: boolean;
  isSelected?: boolean;
  onSelectBoard?: () => void;
  canUseHints: boolean;
  hintsRemaining: number;
  onUseHint: (
    hintType: 'bracket' | 'clue',
    boardIndex: number,
    targetIndex: number
  ) => void;
  isGaveUp: boolean;
  clockOffsetMs: number;
  /** Read-only presentation for OBS / LIVE Studio overlays */
  overlayMode?: boolean;
  /** Render seamlessly inside a parent unified main panel without outer card chrome */
  embedded?: boolean;
}

function BracketWordRow({
  entry,
  direction,
  isLatest,
  compact,
  emptyLabel,
  subLabel,
}: {
  entry: GuessEntry | null;
  direction: 'above' | 'below' | 'between';
  isLatest: boolean;
  compact: boolean;
  emptyLabel: string;
  subLabel?: string;
}) {
  const ArrowIcon = direction === 'below' ? ArrowUp : ArrowDown;

  if (!entry) {
    return (
      <div
        className={`flex items-center justify-between gap-2 rounded-xl border border-dashed border-[#D4A437]/25 bg-[#12031E]/80 ${
          compact ? 'px-3 py-2.5' : 'px-4 py-3'
        }`}
      >
        <span className="inline-flex items-center gap-2 text-xs font-medium text-[#B8A0D6]">
          <ArrowIcon className="h-3.5 w-3.5 text-[#D4A437]/70" aria-hidden="true" />
          <span>{emptyLabel}</span>
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-[#957AB8]">
          {direction === 'above' ? 'A' : direction === 'below' ? 'Z' : 'A–Z'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border transition-colors ${
        compact ? 'px-3 py-2.5' : 'px-4 py-3'
      } ${
        entry.isHint
          ? 'border-[#F6C915]/55 bg-[#F6C915]/12 text-[#FFF3B0]'
          : isLatest
          ? 'border-[#F6C915]/70 bg-[#31104F]/75 text-white'
          : 'border-[#D4A437]/28 bg-[#180528]/72 text-[#F5F0FF]'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <ArrowIcon
          className={`h-4 w-4 shrink-0 ${
            entry.isHint ? 'text-[#F6C915]' : 'text-[#D4A437]'
          }`}
          aria-hidden="true"
        />
        <span
          className={`font-mono font-extrabold tracking-[0.14em] uppercase truncate ${
            compact ? 'text-sm' : 'text-lg'
          }`}
        >
          {entry.word}
        </span>
        {subLabel && (
          <span className="hidden sm:inline text-[11px] font-semibold text-[#C8B2E4]">
            {subLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 text-[11px] text-[#C8B2E4]">
        {entry.isHint ? (
          <span className="font-bold uppercase tracking-wider text-[#F6C915]">
            Hint
          </span>
        ) : (
          <>
            {entry.guessedBy && !compact && (
              <span className="max-w-[120px] truncate font-semibold text-[#E5D7F7]">
                {entry.guessedBy}
              </span>
            )}
            <span className="font-mono tabular-nums text-[#B399D6]">
              #{entry.order}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function TargetWordCard({
  target,
  boardIndex,
  isDual,
  compact,
  canUseHints,
  hintsRemaining,
  onUseHint,
  isGaveUp,
  nowMs,
  overlayMode,
}: {
  target: LadderTargetView;
  boardIndex: number;
  isDual: boolean;
  compact: boolean;
  canUseHints: boolean;
  hintsRemaining: number;
  onUseHint: (
    hintType: 'bracket' | 'clue',
    boardIndex: number,
    targetIndex: number
  ) => void;
  isGaveUp: boolean;
  nowMs: number;
  overlayMode?: boolean;
}) {
  const isRevealed = Boolean(target.word);
  const isBufferActive = target.bufferActive;
  const bufferRemainingMs =
    isBufferActive && target.bufferEndsAt
      ? Math.max(0, target.bufferEndsAt - nowMs)
      : 0;
  const bufferPct = Math.min(100, (bufferRemainingMs / 4000) * 100);
  const bufferSec = (bufferRemainingMs / 1000).toFixed(1);

  const letterCount = target.revealedLength ?? target.word?.length ?? 5;
  const sharedPrefix = !isRevealed ? target.sharedPrefix : '';
  const cluePrefix = !isRevealed ? (target.revealedPrefix ?? '') : '';

  const slots: Array<{
    char: string;
    state: 'solved' | 'autofill' | 'clue' | 'empty';
  }> = [];

  for (let i = 0; i < letterCount; i++) {
    if (isRevealed && target.word) {
      slots.push({ char: target.word[i] ?? '', state: 'solved' });
    } else if (i < sharedPrefix.length) {
      slots.push({ char: sharedPrefix[i], state: 'autofill' });
    } else if (i < cluePrefix.length) {
      slots.push({ char: cluePrefix[i], state: 'clue' });
    } else {
      slots.push({ char: '', state: 'empty' });
    }
  }

  return (
    <div
      className={`rounded-2xl border transition-all ${
        compact ? 'px-3 py-3' : 'px-4 py-4'
      } ${
        target.solved && !isBufferActive
          ? 'border-emerald-400/60 bg-emerald-950/35'
          : isBufferActive
          ? 'border-[#F6C915] bg-[#361156]/75'
          : isGaveUp
          ? 'border-rose-400/50 bg-rose-950/25'
          : 'border-[#F6C915]/45 bg-[#150424]/72'
      }`}
    >
      {/* Target Header Line */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {target.solved && !isBufferActive ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
          ) : isBufferActive ? (
            <Clock className="h-4 w-4 text-[#F6C915] shrink-0" aria-hidden="true" />
          ) : null}
          <span
            className={`text-xs font-extrabold uppercase tracking-wider truncate ${
              target.solved && !isBufferActive
                ? 'text-emerald-300'
                : isBufferActive
                ? 'text-[#F6C915]'
                : isGaveUp
                ? 'text-rose-300'
                : 'text-[#F6C915]'
            }`}
          >
            {isBufferActive
              ? 'Word Found — 4s Lag Window'
              : target.solved
              ? isDual
                ? `Word #${target.index + 1} Solved`
                : 'Solved'
              : isGaveUp
              ? 'Revealed'
              : isDual
              ? `Secret Word #${target.index + 1}`
              : 'Secret Word'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs font-mono tabular-nums">
          {isBufferActive ? (
            <span className="font-extrabold text-[#F6C915]">{bufferSec}s</span>
          ) : target.solved && target.winners.length > 0 ? (
            <span className="text-emerald-200 font-semibold truncate max-w-[160px]">
              {target.winners.length === 1
                ? target.winners[0].name
                : `${target.winners[0].name} +${target.winners.length - 1}`}
            </span>
          ) : (
            <span className="text-[#D4C0EC] font-semibold">
              {letterCount} letters
            </span>
          )}
        </div>
      </div>

      {/* 3D Sculpted Letter Tiles */}
      <div
        className={`flex items-center justify-center flex-nowrap ${
          compact ? 'gap-1.5' : 'gap-2 sm:gap-2.5'
        }`}
        aria-label={
          isRevealed && target.word
            ? `Word ${target.word.toUpperCase()}`
            : `Secret word with ${letterCount} letters`
        }
      >
        {slots.map((slot, i) => {
          const isSolvedTile = slot.state === 'solved';
          const isAutoFilled = slot.state === 'autofill';
          const isClueFilled = slot.state === 'clue';
          return (
            <div
              key={i}
              className={`relative flex items-center justify-center rounded-xl font-black uppercase select-none transition-all duration-200 ${
                compact
                  ? 'h-10 w-8 sm:h-11 sm:w-9 text-base'
                  : 'h-12 w-10 sm:h-14 sm:w-12 text-xl sm:text-2xl'
              } ${
                isSolvedTile
                  ? isGaveUp && !target.solved
                    ? 'bg-gradient-to-b from-rose-500/85 to-rose-700/95 border border-rose-300/70 border-b-[5px] border-b-rose-950 shadow-[0_6px_14px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] text-white'
                    : isBufferActive
                    ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 border-2 border-[#F6C915] border-b-[6px] border-b-emerald-950 shadow-[0_8px_20px_rgba(246,201,21,0.38),inset_0_1px_0_rgba(255,255,255,0.45)] text-white'
                    : 'bg-gradient-to-b from-emerald-500 to-emerald-700 border border-emerald-300/75 border-b-[6px] border-b-emerald-950 shadow-[0_8px_18px_rgba(16,185,129,0.32),inset_0_1px_0_rgba(255,255,255,0.35)] text-white'
                  : isAutoFilled
                  ? 'bg-gradient-to-b from-[#523308] to-[#2B1903] border-2 border-[#F6C915] border-b-[6px] border-b-[#9E6B0C] shadow-[0_7px_18px_rgba(246,201,21,0.34),inset_0_1px_0_rgba(255,234,167,0.5)] text-[#FFE46B]'
                  : isClueFilled
                  ? 'bg-gradient-to-b from-[#3E1D59] to-[#220B36] border border-[#F6C915]/80 border-b-[5px] border-b-[#8F6212] shadow-[0_6px_14px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,224,138,0.32)] text-[#F6C915]'
                  : 'bg-gradient-to-b from-[#331354] to-[#1C0731] border border-[#D4A437]/30 border-b-[5px] border-b-[#0B0115] shadow-[0_6px_14px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.14)] text-[#A187C6]'
              }`}
            >
              <span className="leading-none">{slot.char || '?'}</span>
            </div>
          );
        })}
      </div>

      {/* 4-Second Lag Buffer Progress */}
      {isBufferActive && (
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#12031E]">
            <div
              className="h-full bg-[#F6C915] transition-[width] duration-75 ease-linear"
              style={{ width: `${bufferPct}%` }}
            />
          </div>
          <p className="text-[11px] font-medium text-[#F5E6FF] text-center">
            {target.winners.length}{' '}
            {target.winners.length === 1 ? 'player' : 'players'} in — delayed
            TikTok viewers can still submit!
          </p>
        </div>
      )}

      {/* Auto-filled shared prefix note */}
      {!isRevealed && sharedPrefix.length > 0 && !compact && (
        <p className="mt-2.5 text-center text-xs font-semibold text-[#F6C915]">
          Auto-filled &ldquo;{sharedPrefix.toUpperCase()}&rdquo; from matching
          guesses above &amp; below
        </p>
      )}

      {/* Proximity Bar & Hint Controls when Active */}
      {!target.solved && !isGaveUp && (
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#11021C]">
              <div
                className="h-full bg-[#F6C915] transition-all duration-300"
                style={{ width: `${Math.max(4, target.proximityPct)}%` }}
              />
            </div>
          </div>

          {canUseHints && !overlayMode && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={hintsRemaining <= 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onUseHint('bracket', boardIndex, target.index);
                }}
                title="Place a dictionary word halfway closer to the secret word"
                className="inline-flex items-center gap-1 rounded-md border border-[#D4A437]/40 bg-[#25093D] px-2.5 py-1 text-[11px] font-bold text-[#F5EEFF] hover:border-[#F6C915] hover:text-[#F6C915] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                <span>Hint</span>
              </button>
              <button
                type="button"
                disabled={hintsRemaining <= 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onUseHint('clue', boardIndex, target.index);
                }}
                title="Reveal starting letter clue"
                className="inline-flex items-center gap-1 rounded-md border border-[#D4A437]/40 bg-[#25093D] px-2.5 py-1 text-[11px] font-bold text-[#F5EEFF] hover:border-[#F6C915] hover:text-[#F6C915] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                <Lightbulb className="h-3 w-3" aria-hidden="true" />
                <span>Clue</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LadderBoard({
  board,
  isQuad,
  isSelected,
  onSelectBoard,
  canUseHints,
  hintsRemaining,
  onUseHint,
  isGaveUp,
  clockOffsetMs,
  overlayMode = false,
  embedded = false,
}: LadderBoardProps) {
  const isDual = board.targets.length === 2;
  const hasActiveBuffer = board.targets.some((t) => t.bufferActive);
  const [nowMs, setNowMs] = useState(() => Date.now() + clockOffsetMs);

  useEffect(() => {
    setNowMs(Date.now() + clockOffsetMs);
    if (!hasActiveBuffer) return;
    const interval = window.setInterval(() => {
      setNowMs(Date.now() + clockOffsetMs);
    }, 80);
    return () => window.clearInterval(interval);
  }, [hasActiveBuffer, clockOffsetMs]);

  const t0 = board.targets[0];
  const t1 = isDual ? board.targets[1] : null;

  const middleSameWord =
    isDual &&
    t0.closestAfter &&
    t1?.closestBefore &&
    t0.closestAfter.word === t1.closestBefore.word;

  return (
    <section
      onClick={isQuad && onSelectBoard ? onSelectBoard : undefined}
      className={
        embedded
          ? 'p-4 sm:p-5 transition-all flex flex-col'
          : `rounded-2xl border bg-[#210736]/80 transition-all flex flex-col shadow-xl ${
              isQuad ? 'p-3.5 cursor-pointer' : 'p-4 sm:p-5'
            } ${
              board.lockedSolved
                ? 'border-emerald-400/50'
                : hasActiveBuffer
                ? 'border-[#F6C915] shadow-[0_0_0_1px_rgba(246,201,21,0.3)]'
                : isSelected
                ? 'border-[#F6C915] shadow-[0_0_0_1px_rgba(246,201,21,0.35)]'
                : 'border-[#D4A437]/30 hover:border-[#D4A437]/55'
            }`
      }
    >
      {/* Board Header */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h3 className="text-sm font-extrabold text-white truncate tracking-tight">
            {board.label}
          </h3>
          {board.lockedSolved && (
            <span className="text-xs font-bold text-emerald-400">Solved</span>
          )}
          {!board.lockedSolved && hasActiveBuffer && (
            <span className="text-xs font-bold text-[#F6C915]">4s Buffer</span>
          )}
        </div>
        <span className="font-mono text-xs tabular-nums text-[#C8B2E4]">
          {board.guessCount} {board.guessCount === 1 ? 'guess' : 'guesses'}
        </span>
      </div>

      {/* Closest-Only Alphabetical Ladder */}
      <div className="space-y-2.5 flex-1 flex flex-col justify-center">
        <BracketWordRow
          entry={t0.closestBefore}
          direction="above"
          isLatest={Boolean(
            t0.closestBefore && board.lastGuessWord === t0.closestBefore.word
          )}
          compact={isQuad}
          emptyLabel="No word above yet"
        />

        <TargetWordCard
          target={t0}
          boardIndex={board.boardIndex}
          isDual={isDual}
          compact={isQuad}
          canUseHints={canUseHints}
          hintsRemaining={hintsRemaining}
          onUseHint={onUseHint}
          isGaveUp={isGaveUp}
          nowMs={nowMs}
          overlayMode={overlayMode}
        />

        {isDual && t1 ? (
          <>
            {middleSameWord ? (
              <BracketWordRow
                entry={t0.closestAfter}
                direction="between"
                isLatest={Boolean(
                  t0.closestAfter && board.lastGuessWord === t0.closestAfter.word
                )}
                compact={false}
                emptyLabel="No word between yet"
                subLabel="Between #1 & #2"
              />
            ) : (
              <div className="space-y-2">
                {t0.closestAfter && (
                  <BracketWordRow
                    entry={t0.closestAfter}
                    direction="below"
                    isLatest={board.lastGuessWord === t0.closestAfter.word}
                    compact={false}
                    emptyLabel="No word after #1 yet"
                    subLabel="After #1"
                  />
                )}
                {t1.closestBefore && (
                  <BracketWordRow
                    entry={t1.closestBefore}
                    direction="above"
                    isLatest={board.lastGuessWord === t1.closestBefore.word}
                    compact={false}
                    emptyLabel="No word before #2 yet"
                    subLabel="Before #2"
                  />
                )}
                {!t0.closestAfter && !t1.closestBefore && (
                  <BracketWordRow
                    entry={null}
                    direction="between"
                    isLatest={false}
                    compact={false}
                    emptyLabel="No word between #1 & #2 yet"
                  />
                )}
              </div>
            )}

            <TargetWordCard
              target={t1}
              boardIndex={board.boardIndex}
              isDual={true}
              compact={false}
              canUseHints={canUseHints}
              hintsRemaining={hintsRemaining}
              onUseHint={onUseHint}
              isGaveUp={isGaveUp}
              nowMs={nowMs}
              overlayMode={overlayMode}
            />

            <BracketWordRow
              entry={t1.closestAfter}
              direction="below"
              isLatest={Boolean(
                t1.closestAfter && board.lastGuessWord === t1.closestAfter.word
              )}
              compact={false}
              emptyLabel="No word below yet"
            />
          </>
        ) : (
          <BracketWordRow
            entry={t0.closestAfter}
            direction="below"
            isLatest={Boolean(
              t0.closestAfter && board.lastGuessWord === t0.closestAfter.word
            )}
            compact={isQuad}
            emptyLabel="No word below yet"
          />
        )}
      </div>
    </section>
  );
}
