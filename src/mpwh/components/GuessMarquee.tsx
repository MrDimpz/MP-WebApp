import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import type { GuessFeedItem } from '../shared/types';

interface GuessMarqueeProps {
  items: GuessFeedItem[];
  /** Render seamlessly inside the main game panel without an outer card frame */
  embedded?: boolean;
}

const TRACK_HEIGHT_PX = 128; // h-32 (128px) -> 144px total bar height (triple original 48px)
const CHIP_HEIGHT_PX = 28; // h-7
const MIN_TOP_OFFSET_PX = 4;
const MAX_TOP_OFFSET_PX = TRACK_HEIGHT_PX - CHIP_HEIGHT_PX - 4; // 96px

/**
 * Deterministic 32-bit FNV-1a + avalanche hash of the guess ID so each entry
 * spawns at a scattered random vertical height that stays identical across loops.
 */
function getRandomTopOffset(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;

  const span = MAX_TOP_OFFSET_PX - MIN_TOP_OFFSET_PX + 1;
  return MIN_TOP_OFFSET_PX + ((hash >>> 0) % span);
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
        className="h-5 w-5 rounded-full bg-gradient-to-br from-[#F6C915] to-[#B57B10] border border-[#FFE46B]/70 text-[#1D0830] flex items-center justify-center text-[8px] font-black leading-none shrink-0 select-none"
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
      className="h-5 w-5 rounded-full object-cover border border-[#F6C915]/55 bg-[#140321] shrink-0"
    />
  );
}

function GuessChip({
  item,
  isNewest = false,
}: {
  item: GuessFeedItem;
  isNewest?: boolean;
}) {
  const isDuplicate = item.alreadyGuessed || item.status === 'duplicate';
  const isSolved = item.status === 'solved';
  const isBuffer = item.status === 'buffer';
  const topOffsetPx = getRandomTopOffset(item.id);

  return (
    <div
      style={{ marginTop: `${topOffsetPx}px` }}
      className={`h-7 px-2.5 rounded-lg border inline-flex items-center gap-1.5 shrink-0 transition-colors ${
        isNewest ? 'animate-pop' : ''
      } ${
        isDuplicate
          ? 'border-amber-400/50 bg-amber-950/40'
          : isSolved
          ? 'border-emerald-400/60 bg-emerald-950/50'
          : isBuffer
          ? 'border-[#F6C915]/70 bg-[#361156]'
          : 'border-[#D4A437]/25 bg-[#150424]'
      }`}
    >
      <PlayerAvatar item={item} />

      <span className="text-[11px] font-bold text-white max-w-[110px] truncate leading-none">
        {item.playerName}
      </span>

      <span
        className={`font-mono text-[11px] font-black tracking-[0.08em] uppercase px-1.5 py-[1px] rounded border leading-tight whitespace-nowrap shrink-0 ${
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
    </div>
  );
}

/**
 * Triple-height horizontal sideways-scrolling player guess ticker showing player
 * pictures, names, guessed words, and duplicate/solve badges entering at random heights.
 */
export function GuessMarquee({ items, embedded = false }: GuessMarqueeProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const singleTrackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const lastTopIdRef = useRef<string | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const measureOverflow = useCallback(() => {
    const viewport = viewportRef.current;
    const track = singleTrackRef.current;
    if (!viewport || !track) {
      setIsOverflowing(false);
      return;
    }
    setIsOverflowing(track.scrollWidth > viewport.clientWidth + 4);
  }, []);

  useLayoutEffect(() => {
    measureOverflow();
  }, [items, measureOverflow]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measureOverflow());
    ro.observe(viewport);
    if (singleTrackRef.current) {
      ro.observe(singleTrackRef.current);
    }
    return () => ro.disconnect();
  }, [measureOverflow, items.length]);

  // Snap back to the leading edge whenever a brand-new guess arrives so it enters immediately
  useEffect(() => {
    const newestId = items[0]?.id ?? null;
    if (newestId && newestId !== lastTopIdRef.current) {
      lastTopIdRef.current = newestId;
      if (viewportRef.current) {
        viewportRef.current.scrollLeft = 0;
      }
    }
  }, [items]);

  // Smooth continuous sideways marquee scroll when guesses exceed the viewport width
  useEffect(() => {
    if (!isOverflowing || items.length === 0) {
      if (viewportRef.current) {
        viewportRef.current.scrollLeft = 0;
      }
      return;
    }

    let rafId = 0;
    let lastTs = performance.now();
    let carryPx = 0;
    const SPEED_PX_PER_SEC = 42;

    const tick = (ts: number) => {
      const dt = Math.min(0.1, (ts - lastTs) / 1000);
      lastTs = ts;

      const el = viewportRef.current;
      const singleTrack = singleTrackRef.current;
      if (el && singleTrack && !pausedRef.current) {
        const cycleWidth = singleTrack.offsetWidth;
        if (cycleWidth > 0) {
          carryPx += dt * SPEED_PX_PER_SEC;
          if (carryPx >= 0.5) {
            const step = Math.floor(carryPx);
            carryPx -= step;
            el.scrollLeft += step;
            if (el.scrollLeft >= cycleWidth) {
              el.scrollLeft -= cycleWidth;
            }
          }
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isOverflowing, items.length]);

  return (
    <div
      aria-label="Recent player guesses marquee"
      className={
        embedded
          ? 'border-t border-white/10 bg-[#180528]/85 px-3.5 sm:px-4 py-2 shrink-0'
          : 'rounded-2xl border border-[#D4A437]/35 bg-[#210736]/95 px-3 py-2 shadow-xl shrink-0'
      }
    >
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
        onWheel={(e) => {
          if (viewportRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            viewportRef.current.scrollLeft += e.deltaY;
          }
        }}
        className={`h-32 flex items-start overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
          isOverflowing
            ? '[mask-image:linear-gradient(to_right,black,black_calc(100%-24px),transparent)]'
            : ''
        }`}
      >
        {items.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-center px-3 rounded-lg border border-dashed border-[#D4A437]/25 bg-[#12031E]/70">
            <p className="text-[11px] font-medium text-[#B8A0D6] truncate">
              Player pictures, names, guesses &amp; duplicate alerts scroll here live.
            </p>
          </div>
        ) : (
          <div className="flex flex-row items-start h-full w-max">
            <div ref={singleTrackRef} className="flex flex-row items-start gap-2.5 pr-2.5 h-full">
              {items.map((item, idx) => (
                <GuessChip key={item.id} item={item} isNewest={idx === 0} />
              ))}
            </div>
            {isOverflowing && (
              <div aria-hidden="true" className="flex flex-row items-start gap-2.5 pr-2.5 h-full">
                {items.map((item) => (
                  <GuessChip key={`${item.id}-dup`} item={item} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
