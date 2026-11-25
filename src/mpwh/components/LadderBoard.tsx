import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Crown,
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
  /** When true (all words found / round won or revealed), hide the per-grid Quad solver popup */
  hideQuadSolvedPopup?: boolean;
}

function BracketWordRow({
  entry,
  direction,
  isLatest,
  density,
  emptyLabel,
  subLabel,
}: {
  entry: GuessEntry | null;
  direction: 'above' | 'below' | 'between';
  isLatest: boolean;
  density: 'quad' | 'dual' | 'classic';
  emptyLabel: string;
  subLabel?: string;
}) {
  const ArrowIcon = direction === 'below' ? ArrowUp : ArrowDown;
  const heightClass =
    density === 'quad'
      ? 'h-8 px-2.5'
      : density === 'dual'
      ? 'h-9 px-3'
      : 'h-11 px-4';

  if (!entry) {
    return (
      <div
        className={`flex items-center justify-between gap-2 rounded-xl border border-dashed border-[#D7C4EC] dark:border-[#D4A437]/25 bg-[#F8F3FD]/85 dark:bg-[#12031E]/80 overflow-hidden ${heightClass}`}
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6C4B8C] dark:text-[#B8A0D6] min-w-0 truncate">
          <ArrowIcon
            className="h-3.5 w-3.5 text-[#A57A10] dark:text-[#D4A437]/70 shrink-0"
            aria-hidden="true"
          />
          <span className="truncate">{emptyLabel}</span>
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-[#8C6CA8] dark:text-[#957AB8] shrink-0">
          {direction === 'above' ? 'A' : direction === 'below' ? 'Z' : 'A–Z'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl border transition-colors overflow-hidden ${heightClass} ${
        entry.isHint
          ? 'border-[#C99A14]/65 dark:border-[#F6C915]/70 bg-amber-50 dark:bg-[#F6C915]/18 text-[#7A5200] dark:text-[#FFF3B0]'
          : isLatest
          ? 'border-[#C99A14] dark:border-[#F6C915] bg-[#EFE4FA] dark:bg-[#3A145E] text-[#2B0938] dark:text-white'
          : 'border-[#D7C4EC] dark:border-[#D4A437]/42 bg-white/95 dark:bg-[#24093D]/95 text-[#2B0938] dark:text-white'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <ArrowIcon
          className={`h-3.5 w-3.5 shrink-0 ${
            entry.isHint ? 'text-[#B58100] dark:text-[#F6C915]' : 'text-[#A57A10] dark:text-[#D4A437]'
          }`}
          aria-hidden="true"
        />
        <span
          className={`font-mono font-extrabold tracking-[0.12em] uppercase truncate ${
            density === 'quad'
              ? 'text-xs'
              : density === 'dual'
              ? 'text-sm'
              : 'text-base sm:text-lg'
          }`}
        >
          {entry.word}
        </span>
        {subLabel && density !== 'quad' && (
          <span className="hidden sm:inline text-[11px] font-semibold text-[#6C4B8C] dark:text-[#C8B2E4] whitespace-nowrap shrink-0">
            {subLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-[#6C4B8C] dark:text-[#C8B2E4]">
        {entry.isHint ? (
          <span className="font-bold uppercase tracking-wider text-[#9A6E00] dark:text-[#F6C915]">
            Hint
          </span>
        ) : (
          <>
            {entry.guessedBy && density === 'classic' && (
              <span className="max-w-[110px] truncate font-semibold text-[#4C266D] dark:text-[#E5D7F7]">
                {entry.guessedBy}
              </span>
            )}
            <span className="font-mono tabular-nums text-[#7C5B9E] dark:text-[#B399D6]">
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
  isQuad,
  canUseHints,
  hintsRemaining,
  onUseHint,
  isGaveUp,
  overlayMode,
}: {
  target: LadderTargetView;
  boardIndex: number;
  isDual: boolean;
  isQuad: boolean;
  canUseHints: boolean;
  hintsRemaining: number;
  onUseHint: (
    hintType: 'bracket' | 'clue',
    boardIndex: number,
    targetIndex: number
  ) => void;
  isGaveUp: boolean;
  overlayMode?: boolean;
}) {
  const isRevealed = Boolean(target.word);

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
      className={`rounded-2xl border transition-colors ${
        isQuad
          ? 'px-2.5 py-2'
          : isDual
          ? 'px-3.5 py-2.5'
          : 'px-4 py-3.5'
      } ${
        target.solved
          ? 'border-emerald-400/75 dark:border-emerald-400/65 bg-emerald-50/90 dark:bg-[#071D17]/95'
          : isGaveUp
          ? 'border-rose-400/60 dark:border-rose-400/55 bg-rose-50/90 dark:bg-[#220714]/95'
          : 'border-[#C99A14]/55 dark:border-[#F6C915]/50 bg-[#F8F3FD]/90 dark:bg-[#0C0216]/95'
      }`}
    >
      {/* Fixed-Height Target Header Line */}
      <div
        className={`flex items-center justify-between gap-2 h-5 ${
          isQuad ? 'mb-1.5' : isDual ? 'mb-2' : 'mb-2.5'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {target.solved ? (
            <CheckCircle2
              className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
              aria-hidden="true"
            />
          ) : null}
          <span
            className={`font-extrabold uppercase tracking-wider truncate ${
              isQuad ? 'text-[10px]' : 'text-xs'
            } ${
              target.solved
                ? 'text-emerald-700 dark:text-emerald-300'
                : isGaveUp
                ? 'text-rose-700 dark:text-rose-300'
                : 'text-[#8F6500] dark:text-[#F6C915]'
            }`}
          >
            {target.solved
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

        <div
          className={`flex items-center gap-1.5 shrink-0 font-mono tabular-nums ${
            isQuad ? 'text-[10px]' : 'text-xs'
          }`}
        >
          {target.solved && target.winners.length > 0 ? (
            <span className="text-emerald-700 dark:text-emerald-200 font-semibold truncate max-w-[140px]">
              {target.winners.length === 1
                ? target.winners[0].name
                : `${target.winners[0].name} +${target.winners.length - 1}`}
            </span>
          ) : (
            <span className="text-[#5C3A78] dark:text-[#E2D2F7] font-semibold whitespace-nowrap">
              {!isRevealed && sharedPrefix.length > 0 && !isQuad
                ? `${sharedPrefix.toUpperCase()}·${letterCount}L`
                : `${letterCount} letters`}
            </span>
          )}
        </div>
      </div>

      {/* High-Contrast 3D Sculpted Letter Tiles (Fixed Height, Responsive Width in Quad) */}
      <div
        className={`flex items-center justify-center flex-nowrap ${
          isQuad ? 'gap-1' : isDual ? 'gap-1.5' : 'gap-2 sm:gap-2.5'
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
                isQuad
                  ? 'h-9 flex-1 max-w-[34px] min-w-0 text-sm'
                  : isDual
                  ? 'h-10 w-8 sm:h-11 sm:w-9 text-base'
                  : 'h-12 w-10 sm:h-14 sm:w-12 text-xl sm:text-2xl'
              } ${
                isSolvedTile
                  ? isGaveUp && !target.solved
                    ? 'bg-gradient-to-b from-rose-500 to-rose-700 border-2 border-rose-200/90 border-b-[5px] border-b-rose-950 shadow-[0_6px_16px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.38)] text-white'
                    : 'bg-gradient-to-b from-emerald-500 to-emerald-700 border-2 border-emerald-200/90 border-b-[5px] border-b-emerald-950 shadow-[0_8px_20px_rgba(16,185,129,0.42),inset_0_1px_0_rgba(255,255,255,0.42)] text-white'
                  : isAutoFilled
                  ? 'bg-gradient-to-b from-[#FFEA7A] to-[#F6C915] border-2 border-[#C99A14] dark:border-[#FFF6C2] border-b-[5px] border-b-[#9E6B0C] shadow-[0_7px_18px_rgba(246,201,21,0.42),inset_0_1px_0_rgba(255,255,255,0.75)] text-[#1D0830]'
                  : isClueFilled
                  ? 'bg-gradient-to-b from-[#EDE0FB] to-[#D9C2F5] dark:from-[#FFF4C4] dark:to-[#F7D364] border-2 border-[#B58100]/80 dark:border-[#FFE899] border-b-[5px] border-b-[#8F6212] dark:border-b-[#A67108] shadow-[0_6px_16px_rgba(246,201,21,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] text-[#5B21B6] dark:text-[#2B0938]'
                  : 'bg-gradient-to-b from-white to-[#EFE6FA] dark:from-[#F2EAFF] dark:to-[#D5C0F4] border-2 border-[#C8AEDF] dark:border-white/90 border-b-[5px] border-b-[#B89BD4] dark:border-b-[#7A56A8] shadow-[0_6px_16px_rgba(0,0,0,0.16)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.92)] text-[#5C3A78] dark:text-[#3A1658]'
              }`}
            >
              <span className="leading-none">{slot.char || '?'}</span>
            </div>
          );
        })}
      </div>

      {/* Always-Rendered Fixed-Height Footer Slot */}
      <div
        className={`border-t border-[#E6D9F5] dark:border-white/12 flex items-center justify-between gap-2 ${
          isQuad ? 'mt-1.5 pt-1.5 h-6' : 'mt-2 pt-2 h-7'
        }`}
      >
        {target.solved ? (
          <>
            <div className="flex-1 min-w-0">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E6D9F5] dark:bg-[#11021C]">
                <div className="h-full w-full bg-emerald-500 dark:bg-emerald-400" />
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 truncate max-w-[160px] shrink-0">
              {target.winners.length > 1
                ? `Won by ${target.winners[0].name} +${target.winners.length - 1}`
                : target.winners[0]?.name
                ? `Won by ${target.winners[0].name}`
                : 'Solved'}
            </span>
          </>
        ) : isGaveUp ? (
          <>
            <div className="flex-1 min-w-0">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E6D9F5] dark:bg-[#11021C]">
                <div className="h-full w-full bg-rose-500/80 dark:bg-rose-400/70" />
              </div>
            </div>
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 whitespace-nowrap shrink-0">
              Answer revealed
            </span>
          </>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E6D9F5] dark:bg-[#1F0936]">
                <div
                  className="h-full bg-[#D9A600] dark:bg-[#F6C915] transition-all duration-300"
                  style={{ width: `${Math.max(4, target.proximityPct)}%` }}
                />
              </div>
            </div>

            {canUseHints && !overlayMode ? (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={hintsRemaining <= 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUseHint('bracket', boardIndex, target.index);
                  }}
                  title="Place a dictionary word halfway closer to the secret word"
                  className={`inline-flex items-center gap-1 rounded-md border border-[#C8AEDF] dark:border-[#D4A437]/40 bg-white dark:bg-[#25093D] font-bold text-[#3B1759] dark:text-[#F5EEFF] hover:border-[#B58100] dark:hover:border-[#F6C915] hover:text-[#8F6500] dark:hover:text-[#F6C915] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed whitespace-nowrap shrink-0 ${
                    isQuad ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
                  }`}
                >
                  <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
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
                  className={`inline-flex items-center gap-1 rounded-md border border-[#C8AEDF] dark:border-[#D4A437]/40 bg-white dark:bg-[#25093D] font-bold text-[#3B1759] dark:text-[#F5EEFF] hover:border-[#B58100] dark:hover:border-[#F6C915] hover:text-[#8F6500] dark:hover:text-[#F6C915] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed whitespace-nowrap shrink-0 ${
                    isQuad ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
                  }`}
                >
                  <Lightbulb className="h-2.5 w-2.5" aria-hidden="true" />
                  <span>Clue</span>
                </button>
              </div>
            ) : (
              <span className="font-mono text-[10px] font-bold text-[#5C3A78] dark:text-[#C8B2E4] tabular-nums shrink-0">
                {Math.round(target.proximityPct)}%
              </span>
            )}
          </>
        )}
      </div>
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
  overlayMode = false,
  embedded = false,
  hideQuadSolvedPopup = false,
}: LadderBoardProps) {
  const isDual = board.targets.length === 2;
  const density: 'quad' | 'dual' | 'classic' = isQuad
    ? 'quad'
    : isDual
    ? 'dual'
    : 'classic';

  const t0 = board.targets[0];
  const t1 = isDual ? board.targets[1] : null;
  const showQuadSolverPopup =
    isQuad &&
    board.lockedSolved &&
    !hideQuadSolvedPopup &&
    !isGaveUp &&
    t0.winners.length > 0;
  const firstQuadWinner = t0.winners[0];
  const quadCoWinners = t0.winners.slice(1);

  const middleSameWord =
    isDual &&
    t0.closestAfter &&
    t1?.closestBefore &&
    t0.closestAfter.word === t1.closestBefore.word;

  const bothDistinctMiddle =
    isDual && Boolean(t0.closestAfter) && Boolean(t1?.closestBefore) && !middleSameWord;

  return (
    <section
      onClick={isQuad && onSelectBoard ? onSelectBoard : undefined}
      className={
        embedded
          ? isDual
            ? 'relative p-3.5 sm:p-4 transition-all flex flex-col'
            : 'relative p-4 sm:p-5 transition-all flex flex-col'
          : `relative overflow-hidden rounded-2xl border bg-white/95 dark:bg-[#210736]/80 transition-all flex flex-col shadow-xl ${
              isQuad
                ? 'p-2.5 cursor-pointer'
                : isDual
                ? 'p-3.5'
                : 'p-4 sm:p-5'
            } ${
              board.lockedSolved
                ? 'border-emerald-500/60 dark:border-emerald-400/50'
                : isSelected
                ? 'border-[#C99A14] dark:border-[#F6C915] shadow-[0_0_0_1px_rgba(246,201,21,0.35)]'
                : 'border-[#D7C4EC] dark:border-[#D4A437]/30 hover:border-[#B58100] dark:hover:border-[#D4A437]/55'
            }`
      }
    >
      {/* Fixed-Height Board Header */}
      <div
        className={`flex items-center justify-between gap-2 border-b border-[#E6D9F5] dark:border-white/10 ${
          isQuad ? 'pb-1.5 mb-1.5' : isDual ? 'pb-2 mb-2' : 'pb-2.5 mb-2.5'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h3
            className={`font-extrabold text-[#2B0938] dark:text-white truncate tracking-tight ${
              isQuad ? 'text-xs' : 'text-sm'
            }`}
          >
            {board.label}
          </h3>
          {board.lockedSolved && (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
              Solved
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] tabular-nums text-[#6B4A8A] dark:text-[#C8B2E4] shrink-0">
          {board.guessCount} {board.guessCount === 1 ? 'guess' : 'guesses'}
        </span>
      </div>

      {/* Closest-Only Alphabetical Ladder */}
      <div
        className={`flex-1 flex flex-col justify-center ${
          isQuad ? 'space-y-1.5' : isDual ? 'space-y-2' : 'space-y-2.5'
        }`}
      >
        <BracketWordRow
          entry={t0.closestBefore}
          direction="above"
          isLatest={Boolean(
            t0.closestBefore && board.lastGuessWord === t0.closestBefore.word
          )}
          density={density}
          emptyLabel="No word above yet"
        />

        <TargetWordCard
          target={t0}
          boardIndex={board.boardIndex}
          isDual={isDual}
          isQuad={isQuad}
          canUseHints={canUseHints}
          hintsRemaining={hintsRemaining}
          onUseHint={onUseHint}
          isGaveUp={isGaveUp}
          overlayMode={overlayMode}
        />

        {isDual && t1 ? (
          <>
            {/* Fixed single-row middle bracket slot */}
            <div className="h-9">
              {middleSameWord ? (
                <BracketWordRow
                  entry={t0.closestAfter}
                  direction="between"
                  isLatest={Boolean(
                    t0.closestAfter && board.lastGuessWord === t0.closestAfter.word
                  )}
                  density="dual"
                  emptyLabel="No word between yet"
                  subLabel="Between #1 & #2"
                />
              ) : bothDistinctMiddle ? (
                <div className="grid grid-cols-2 gap-2 h-9">
                  <BracketWordRow
                    entry={t0.closestAfter}
                    direction="below"
                    isLatest={Boolean(
                      t0.closestAfter && board.lastGuessWord === t0.closestAfter.word
                    )}
                    density="dual"
                    emptyLabel="After #1"
                  />
                  <BracketWordRow
                    entry={t1.closestBefore}
                    direction="above"
                    isLatest={Boolean(
                      t1.closestBefore && board.lastGuessWord === t1.closestBefore.word
                    )}
                    density="dual"
                    emptyLabel="Before #2"
                  />
                </div>
              ) : t0.closestAfter ? (
                <BracketWordRow
                  entry={t0.closestAfter}
                  direction="below"
                  isLatest={board.lastGuessWord === t0.closestAfter.word}
                  density="dual"
                  emptyLabel="No word after #1 yet"
                  subLabel="After #1"
                />
              ) : t1.closestBefore ? (
                <BracketWordRow
                  entry={t1.closestBefore}
                  direction="above"
                  isLatest={board.lastGuessWord === t1.closestBefore.word}
                  density="dual"
                  emptyLabel="No word before #2 yet"
                  subLabel="Before #2"
                />
              ) : (
                <BracketWordRow
                  entry={null}
                  direction="between"
                  isLatest={false}
                  density="dual"
                  emptyLabel="No word between #1 & #2 yet"
                />
              )}
            </div>

            <TargetWordCard
              target={t1}
              boardIndex={board.boardIndex}
              isDual={true}
              isQuad={false}
              canUseHints={canUseHints}
              hintsRemaining={hintsRemaining}
              onUseHint={onUseHint}
              isGaveUp={isGaveUp}
              overlayMode={overlayMode}
            />

            <BracketWordRow
              entry={t1.closestAfter}
              direction="below"
              isLatest={Boolean(
                t1.closestAfter && board.lastGuessWord === t1.closestAfter.word
              )}
              density="dual"
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
            density={density}
            emptyLabel="No word below yet"
          />
        )}
      </div>

      {/* Persistent Per-Grid Solver Popup in Quad Mode (stays until all 4 words are found) */}
      {showQuadSolverPopup && firstQuadWinner && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-20 flex flex-col justify-between rounded-2xl bg-[#160425]/92 backdrop-blur-[3px] p-3 border border-emerald-400/70 shadow-[inset_0_0_24px_rgba(16,185,129,0.22)] animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/45 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
              <CheckCircle2 className="h-3 w-3 text-emerald-300 shrink-0" aria-hidden="true" />
              {board.label}
            </span>
            {t0.word && (
              <span className="rounded-lg border border-[#F6C915]/55 bg-[#2A0B44] px-2 py-0.5 font-mono text-xs font-black uppercase tracking-[0.14em] text-[#F6C915]">
                {t0.word}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center text-center my-auto py-1">
            <div className="relative mb-1.5">
              {firstQuadWinner.avatarUrl ? (
                <img
                  src={firstQuadWinner.avatarUrl}
                  alt={firstQuadWinner.name}
                  className="h-11 w-11 rounded-full object-cover border-2 border-[#F6C915] shadow-md"
                />
              ) : (
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-[#F6C915] to-[#D4A437] border-2 border-white/40 flex items-center justify-center text-base font-black text-[#1D0830] shadow-md">
                  {firstQuadWinner.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#160425] border border-[#F6C915] text-[#F6C915]">
                <Crown className="h-3 w-3" aria-hidden="true" />
              </span>
            </div>

            <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300">
              Word Found By
            </p>
            <p className="mt-0.5 max-w-full truncate px-1 text-base font-black text-white leading-tight">
              {firstQuadWinner.name}
            </p>
            {firstQuadWinner.tiktokHandle &&
              firstQuadWinner.tiktokHandle.toLowerCase() !==
                firstQuadWinner.name.toLowerCase() && (
                <p className="text-[11px] font-semibold text-[#C8B2E4] truncate max-w-full">
                  @{firstQuadWinner.tiktokHandle}
                </p>
              )}

            {quadCoWinners.length > 0 && (
              <p className="mt-1 max-w-full truncate px-1 text-[11px] font-semibold text-[#FFE46B]">
                +{quadCoWinners.length}{' '}
                {quadCoWinners.length === 1 ? 'co-winner' : 'co-winners'}:{' '}
                {quadCoWinners.map((w) => w.name).join(', ')}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-[#C8B2E4] border-t border-white/10 pt-1.5">
            <span>Solved in {board.guessCount} guesses</span>
            <span className="text-emerald-300">Hunting remaining grids...</span>
          </div>
        </div>
      )}
    </section>
  );
}
