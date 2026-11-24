import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
const CHIP_GAP_PX = 12;
const SPEED_PX_PER_SEC = 54;

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

function GuessChipContent({ item }: { item: GuessFeedItem }) {
  const isDuplicate = item.alreadyGuessed || item.status === 'duplicate';
  const isSolved = item.status === 'solved';
  const isBuffer = item.status === 'buffer';

  return (
    <div
      className={`h-7 px-2.5 rounded-lg border inline-flex items-center gap-1.5 shrink-0 select-none ${
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
 * Triple-height horizontal conveyor marquee: new guesses smoothly enter from the
 * right edge at random vertical heights and glide leftward without shifting or jumping
 * existing guesses already on screen.
 */
export function GuessMarquee({ items, embedded = false }: GuessMarqueeProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  const [renderEntries, setRenderEntries] = useState<GuessFeedItem[]>(() =>
    [...items].reverse()
  );

  const latestIdsRef = useRef<Set<string>>(new Set(items.map((i) => i.id)));
  const seenIdsRef = useRef<Set<string>>(new Set(items.map((i) => i.id)));
  const positionsRef = useRef<Map<string, { x: number; y: number; width: number }>>(
    new Map()
  );
  const elMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const isInitialSeedRef = useRef(true);

  useEffect(() => {
    latestIdsRef.current = new Set(items.map((i) => i.id));

    if (items.length === 0) {
      seenIdsRef.current.clear();
      positionsRef.current.clear();
      isInitialSeedRef.current = true;
      setRenderEntries((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    // Collect newly arrived guesses in chronological order (oldest -> newest)
    const freshChronological: GuessFeedItem[] = [];
    for (let i = items.length - 1; i >= 0; i--) {
      const candidate = items[i];
      if (!seenIdsRef.current.has(candidate.id)) {
        seenIdsRef.current.add(candidate.id);
        freshChronological.push(candidate);
      }
    }

    if (freshChronological.length > 0) {
      isInitialSeedRef.current = false;
      setRenderEntries((prev) => [...prev, ...freshChronological]);
    }
  }, [items]);

  // Measure any unpositioned chips synchronously before paint and spawn them off the right edge
  // without shifting or jumping any existing guesses currently visible on screen.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || renderEntries.length === 0) return;

    const viewportWidth = viewport.clientWidth || 560;
    const unpositioned: Array<{ id: string; el: HTMLDivElement; width: number; y: number }> = [];

    for (const entry of renderEntries) {
      if (positionsRef.current.has(entry.id)) continue;
      const el = elMapRef.current.get(entry.id);
      if (!el) continue;
      const width = el.offsetWidth || 150;
      const y = getRandomTopOffset(entry.id);
      unpositioned.push({ id: entry.id, el, width, y });
    }

    if (unpositioned.length === 0) {
      isInitialSeedRef.current = false;
      return;
    }

    if (isInitialSeedRef.current && positionsRef.current.size === 0) {
      let cursorX = Math.max(40, viewportWidth - 80);
      for (const { id, el, width, y } of unpositioned) {
        positionsRef.current.set(id, { x: cursorX, y, width });
        el.style.transform = `translate3d(${cursorX.toFixed(2)}px, ${y}px, 0)`;
        cursorX += width + CHIP_GAP_PX;
      }
      isInitialSeedRef.current = false;
      return;
    }

    const BAND_CLEARANCE = CHIP_HEIGHT_PX + 6;
    for (const { id, el, width, y } of unpositioned) {
      // Only check vertical neighbors that could visually overlap this chip's height band
      let insertX = viewportWidth + 10;
      let minOffscreenX = Infinity;
      const bandOffscreen: Array<{ id: string; pos: { x: number; y: number; width: number } }> = [];

      for (const [otherId, pos] of positionsRef.current.entries()) {
        if (Math.abs(pos.y - y) >= BAND_CLEARANCE) continue;
        if (pos.x < viewportWidth) {
          const rightEdge = pos.x + pos.width + CHIP_GAP_PX;
          if (rightEdge > insertX) {
            insertX = rightEdge;
          }
        } else {
          bandOffscreen.push({ id: otherId, pos });
          if (pos.x < minOffscreenX) {
            minOffscreenX = pos.x;
          }
        }
      }

      positionsRef.current.set(id, { x: insertX, y, width });
      el.style.transform = `translate3d(${insertX.toFixed(2)}px, ${y}px, 0)`;

      // Shift only invisible off-screen chips in the same vertical band so nothing overlaps
      const newEnd = insertX + width + CHIP_GAP_PX;
      if (bandOffscreen.length > 0 && minOffscreenX < newEnd) {
        const shift = newEnd - minOffscreenX;
        for (const item of bandOffscreen) {
          item.pos.x += shift;
          const otherEl = elMapRef.current.get(item.id);
          if (otherEl) {
            otherEl.style.transform = `translate3d(${item.pos.x.toFixed(2)}px, ${item.pos.y}px, 0)`;
          }
        }
      }
    }

    isInitialSeedRef.current = false;
  }, [renderEntries]);

  const hasEntries = renderEntries.length > 0;

  // Continuous 60fps GPU-transform marquee loop — never restarts when new guesses/players arrive!
  useEffect(() => {
    if (!hasEntries) return;

    let rafId = 0;
    let lastTs = performance.now();

    const tick = (ts: number) => {
      const dt = Math.min(0.08, Math.max(0, (ts - lastTs) / 1000));
      lastTs = ts;

      const viewport = viewportRef.current;
      const viewportWidth = viewport?.clientWidth || 560;
      const expiredIds: string[] = [];

      if (viewport && !pausedRef.current) {
        const dx = dt * SPEED_PX_PER_SEC;

        // First advance all active positions smoothly leftward
        for (const [id, pos] of positionsRef.current.entries()) {
          if (pos.width === 0) {
            const el = elMapRef.current.get(id);
            if (el) pos.width = el.offsetWidth || 150;
          }
          pos.x -= dx;
        }

        const BAND_CLEARANCE = CHIP_HEIGHT_PX + 6;
        for (const [id, pos] of positionsRef.current.entries()) {
          if (pos.x + pos.width < -24) {
            if (latestIdsRef.current.has(id)) {
              let bandRight = viewportWidth + 10;
              for (const [otherId, other] of positionsRef.current.entries()) {
                if (otherId === id) continue;
                if (Math.abs(other.y - pos.y) >= BAND_CLEARANCE) continue;
                const rightEdge = other.x + other.width + CHIP_GAP_PX;
                if (rightEdge > bandRight) {
                  bandRight = rightEdge;
                }
              }
              pos.x = bandRight;
            } else {
              expiredIds.push(id);
              continue;
            }
          }
          const el = elMapRef.current.get(id);
          if (el) {
            el.style.transform = `translate3d(${pos.x.toFixed(2)}px, ${pos.y}px, 0)`;
          }
        }
      }

      if (expiredIds.length > 0) {
        const expiredSet = new Set(expiredIds);
        for (const id of expiredIds) {
          positionsRef.current.delete(id);
          seenIdsRef.current.delete(id);
        }
        setRenderEntries((prev) => prev.filter((item) => !expiredSet.has(item.id)));
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [hasEntries]);

  const handleWheelNudge = (delta: number) => {
    const viewport = viewportRef.current;
    if (!viewport || positionsRef.current.size === 0 || delta === 0) return;
    const viewportWidth = viewport.clientWidth || 560;

    for (const pos of positionsRef.current.values()) {
      pos.x -= delta;
    }

    let maxRight = viewportWidth + 10;
    for (const pos of positionsRef.current.values()) {
      const rightEdge = pos.x + pos.width + CHIP_GAP_PX;
      if (rightEdge > maxRight) {
        maxRight = rightEdge;
      }
    }

    for (const [id, pos] of positionsRef.current.entries()) {
      if (pos.x + pos.width < -24 && latestIdsRef.current.has(id)) {
        pos.x = maxRight;
        maxRight = pos.x + pos.width + CHIP_GAP_PX;
      }
      const el = elMapRef.current.get(id);
      if (el) {
        el.style.transform = `translate3d(${pos.x.toFixed(2)}px, ${pos.y}px, 0)`;
      }
    }
  };

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
          const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          handleWheelNudge(delta);
        }}
        className={`relative h-32 w-full overflow-hidden ${
          renderEntries.length > 0
            ? '[mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-24px),transparent)]'
            : ''
        }`}
      >
        {renderEntries.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-center px-3 rounded-lg border border-dashed border-[#D4A437]/25 bg-[#12031E]/70">
            <p className="text-[11px] font-medium text-[#B8A0D6] truncate">
              Player pictures, names, guesses &amp; duplicate alerts scroll here live.
            </p>
          </div>
        ) : (
          renderEntries.map((item) => (
            <div
              key={item.id}
              ref={(node) => {
                if (node) {
                  elMapRef.current.set(item.id, node);
                  const existing = positionsRef.current.get(item.id);
                  if (existing) {
                    node.style.transform = `translate3d(${existing.x.toFixed(2)}px, ${existing.y}px, 0)`;
                  } else {
                    node.style.transform = `translate3d(9999px, ${getRandomTopOffset(item.id)}px, 0)`;
                  }
                } else {
                  elMapRef.current.delete(item.id);
                }
              }}
              style={{ willChange: 'transform' }}
              className="absolute top-0 left-0"
            >
              <GuessChipContent item={item} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
