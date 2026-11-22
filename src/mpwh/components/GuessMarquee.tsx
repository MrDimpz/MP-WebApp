import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import type { GuessFeedItem } from '../shared/types';

interface GuessMarqueeProps {
  items: GuessFeedItem[];
  /** Render seamlessly inside the main game panel without an outer card frame */
  embedded?: boolean;
}

function getPlayerInitials(name: string): string {
  const clean = name.replace(/^@+/, '').trim();
  if (!clean) return '?';
  const parts = clean.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function PlayerAvatar({ item }: { item: GuessFeedItem }) {
  const [imgFailed, setImgFailed] = useState(false);

  const fallbackHandle = item.tiktokHandle?.replace(/^@+/, '').trim();
  const resolvedSrc =
    item.avatarUrl && item.avatarUrl.trim()
      ? item.avatarUrl.trim()
      : fallbackHandle
      ? `/api/tiktok/avatar/${encodeURIComponent(fallbackHandle)}`
      : '';

  if (!resolvedSrc || imgFailed) {
    return (
      <div
        aria-hidden="true"
        className="h-[18px] w-[18px] rounded-full bg-gradient-to-br from-[#F6C915] to-[#B57B10] border border-[#FFE46B]/70 text-[#1D0830] flex items-center justify-center text-[8px] font-black leading-none shrink-0 select-none"
      >
        {getPlayerInitials(item.playerName)}
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={item.playerName}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setImgFailed(true)}
      className="h-[18px] w-[18px] rounded-full object-cover border border-[#F6C915]/55 bg-[#140321] shrink-0"
    />
  );
}

function GuessRow({ item }: { item: GuessFeedItem }) {
  const isDuplicate = item.alreadyGuessed || item.status === 'duplicate';
  const isSolved = item.status === 'solved';
  const isBuffer = item.status === 'buffer';

  return (
    <div
      className={`h-6 px-2 rounded-md border flex items-center justify-between gap-2 shrink-0 transition-colors ${
        isDuplicate
          ? 'border-amber-400/45 bg-amber-950/35'
          : isSolved
          ? 'border-emerald-400/55 bg-emerald-950/45'
          : isBuffer
          ? 'border-[#F6C915]/65 bg-[#361156]'
          : 'border-[#D4A437]/20 bg-[#150424]'
      }`}
    >
      {/* Left: Player picture & name */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <PlayerAvatar item={item} />
        <span className="text-[11px] font-bold text-white truncate leading-none">
          {item.playerName}
        </span>
      </div>

      {/* Right: Already Guessed / status label & guessed word */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isDuplicate && (
          <span className="inline-flex items-center gap-0.5 rounded border border-amber-400/60 bg-amber-500/20 px-1.5 py-[1px] text-[9px] font-extrabold uppercase tracking-wider text-amber-200 leading-none whitespace-nowrap shrink-0">
            <RotateCcw className="h-2.5 w-2.5" aria-hidden="true" />
            Already guessed
          </span>
        )}
        {isSolved && (
          <span className="inline-flex items-center gap-0.5 rounded border border-emerald-400/60 bg-emerald-500/20 px-1.5 py-[1px] text-[9px] font-extrabold uppercase tracking-wider text-emerald-200 leading-none whitespace-nowrap shrink-0">
            <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
            Found
          </span>
        )}
        {isBuffer && (
          <span className="inline-flex items-center gap-0.5 rounded border border-[#F6C915]/70 bg-[#F6C915]/20 px-1.5 py-[1px] text-[9px] font-extrabold uppercase tracking-wider text-[#FFE46B] leading-none whitespace-nowrap shrink-0">
            <Clock className="h-2.5 w-2.5" aria-hidden="true" />
            4s Buffer
          </span>
        )}

        <span
          className={`font-mono text-[11px] font-black tracking-[0.1em] uppercase px-1.5 py-[1px] rounded border leading-tight whitespace-nowrap shrink-0 ${
            isDuplicate
              ? 'border-amber-400/35 bg-[#12031E] text-amber-200/90 line-through decoration-amber-400/75'
              : isSolved
              ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-100'
              : isBuffer
              ? 'border-[#F6C915]/60 bg-[#F6C915]/20 text-[#FFE46B]'
              : 'border-[#D4A437]/30 bg-[#24083C] text-[#FFE46B]'
          }`}
        >
          {item.word}
        </span>
      </div>
    </div>
  );
}

/**
 * Compact 4-name-high vertical scrolling marquee (102px viewport) showing
 * player pictures, names, guessed words, and an "Already guessed" label.
 */
export function GuessMarquee({ items, embedded = false }: GuessMarqueeProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const lastTopIdRef = useRef<string | null>(null);

  const shouldScroll = items.length > 4;

  // Snap back to top when a brand-new guess arrives
  useEffect(() => {
    const newestId = items[0]?.id ?? null;
    if (newestId && newestId !== lastTopIdRef.current) {
      lastTopIdRef.current = newestId;
      if (viewportRef.current) {
        viewportRef.current.scrollTop = 0;
      }
    }
  }, [items]);

  // Smooth continuous vertical marquee scroll when more than 4 guesses exist
  useEffect(() => {
    if (!shouldScroll) return;
    let rafId = 0;
    let lastTs = performance.now();
    let carryPx = 0;
    const SPEED_PX_PER_SEC = 16;

    const tick = (ts: number) => {
      const dt = Math.min(0.1, (ts - lastTs) / 1000);
      lastTs = ts;

      const el = viewportRef.current;
      if (el && !pausedRef.current) {
        const halfHeight = el.scrollHeight / 2;
        if (halfHeight > 0) {
          carryPx += dt * SPEED_PX_PER_SEC;
          if (carryPx >= 0.5) {
            const step = Math.floor(carryPx);
            carryPx -= step;
            el.scrollTop += step;
            if (el.scrollTop >= halfHeight) {
              el.scrollTop -= halfHeight;
            }
          }
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [shouldScroll, items.length]);

  const renderedList = shouldScroll ? [...items, ...items] : items;

  return (
    <div
      aria-label="Recent player guesses marquee"
      className={
        embedded
          ? 'border-t border-white/10 bg-[#180528]/85 px-3.5 sm:px-4 py-2.5'
          : 'rounded-2xl border border-[#D4A437]/35 bg-[#210736]/95 px-3 py-2.5 shadow-xl'
      }
    >
      {/* Fixed 4-row high viewport (4 × 24px rows + 3 × 2px gaps = 102px) */}
      <div
        ref={viewportRef}
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
        onTouchStart={() => {
          pausedRef.current = true;
        }}
        onTouchEnd={() => {
          pausedRef.current = false;
        }}
        className="h-[102px] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center px-3 rounded-lg border border-dashed border-[#D4A437]/25 bg-[#12031E]/70">
            <p className="text-[11px] font-medium text-[#B8A0D6]">
              Player pictures, names, guesses &amp; duplicate alerts appear here
              live.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {renderedList.map((item, idx) => (
              <GuessRow key={`${item.id}-${idx}`} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
