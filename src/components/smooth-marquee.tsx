import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface SmoothMarqueeProps<T> {
  items: T[];
  getItemKey: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Scroll speed in pixels per second (default: 48) */
  speedPxPerSec?: number;
  /** Horizontal gap between adjacent items in pixels (default: 16) */
  gapPx?: number;
  /** Viewport height utility class (default: 'h-6') */
  heightClassName?: string;
  /** Additional classes for the outer viewport */
  className?: string;
  /** Pause smoothly on hover or touch (default: true) */
  pauseOnHover?: boolean;
  /** Apply soft left/right edge fade mask (default: true) */
  fadeMask?: boolean;
  /**
   * Order of incoming `items` array:
   * - 'newest-first': index 0 is the newest item (e.g. recentTicker / burnedWords)
   * - 'oldest-first': last index is the newest item
   */
  order?: 'newest-first' | 'oldest-first';
  /** Accessible label for the marquee region */
  ariaLabel?: string;
}

interface PositionedEntry {
  x: number;
  width: number;
}

/**
 * Smooth 60fps GPU-transform horizontal conveyor marquee.
 *
 * Unlike CSS `@keyframes translateX(-50%)` marquees, items are positioned
 * individually in pixels and advanced via `requestAnimationFrame` + `translate3d`.
 * Adding, updating, or removing items NEVER changes animation duration or track
 * percentage, so existing on-screen items glide smoothly with zero jumping.
 */
export function SmoothMarquee<T>({
  items,
  getItemKey,
  renderItem,
  speedPxPerSec = 48,
  gapPx = 16,
  heightClassName = 'h-6',
  className = '',
  pauseOnHover = true,
  fadeMask = true,
  order = 'newest-first',
  ariaLabel,
}: SmoothMarqueeProps<T>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const reducedMotionRef = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Store latest item data & index by stable key so in-place styling updates
  // (e.g. newest highlight) apply without remounting or shifting positions.
  const latestMapRef = useRef<Map<string, { item: T; index: number }>>(new Map());
  const nextLatestMap = new Map<string, { item: T; index: number }>();
  for (let i = 0; i < items.length; i++) {
    const key = getItemKey(items[i]);
    if (!nextLatestMap.has(key)) {
      nextLatestMap.set(key, { item: items[i], index: i });
    }
  }
  latestMapRef.current = nextLatestMap;

  const [renderKeys, setRenderKeys] = useState<string[]>(() => {
    const initial: string[] = [];
    const seen = new Set<string>();
    const list = order === 'newest-first' ? items : [...items].reverse();
    for (const item of list) {
      const key = getItemKey(item);
      if (!seen.has(key)) {
        seen.add(key);
        initial.push(key);
      }
    }
    return initial;
  });

  // Retain last known item payload while an expired item finishes exiting off-screen left
  const fallbackItemRef = useRef<Map<string, { item: T; index: number }>>(new Map());
  for (const [k, v] of nextLatestMap.entries()) {
    fallbackItemRef.current.set(k, v);
  }

  const seenKeysRef = useRef<Set<string>>(new Set(renderKeys));
  const positionsRef = useRef<Map<string, PositionedEntry>>(new Map());
  const elMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const isInitialSeedRef = useRef(true);

  const getItemKeyRef = useRef(getItemKey);
  getItemKeyRef.current = getItemKey;

  useEffect(() => {
    if (items.length === 0) {
      seenKeysRef.current.clear();
      positionsRef.current.clear();
      fallbackItemRef.current.clear();
      isInitialSeedRef.current = true;
      setRenderKeys((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    // Collect newly arrived keys in chronological order (oldest -> newest among the batch)
    const freshKeys: string[] = [];
    if (order === 'newest-first') {
      for (let i = items.length - 1; i >= 0; i--) {
        const key = getItemKeyRef.current(items[i]);
        if (!seenKeysRef.current.has(key)) {
          seenKeysRef.current.add(key);
          freshKeys.push(key);
        }
      }
    } else {
      for (let i = 0; i < items.length; i++) {
        const key = getItemKeyRef.current(items[i]);
        if (!seenKeysRef.current.has(key)) {
          seenKeysRef.current.add(key);
          freshKeys.push(key);
        }
      }
    }

    if (freshKeys.length > 0) {
      setRenderKeys((prev) => [...prev, ...freshKeys]);
    }
  }, [items, order]);

  // Measure unpositioned chips synchronously before paint and insert them off the right edge
  // without ever moving or jumping items currently visible on screen.
  useLayoutEffect(() => {
    if (reducedMotionRef.current) return;
    const viewport = viewportRef.current;
    if (!viewport || renderKeys.length === 0) return;

    const viewportWidth = viewport.clientWidth || 360;
    const unpositioned: Array<{ key: string; el: HTMLDivElement; width: number }> = [];

    for (const key of renderKeys) {
      if (positionsRef.current.has(key)) continue;
      const el = elMapRef.current.get(key);
      if (!el) continue;
      const width = el.offsetWidth || 80;
      unpositioned.push({ key, el, width });
    }

    if (unpositioned.length === 0) {
      isInitialSeedRef.current = false;
      return;
    }

    if (isInitialSeedRef.current && positionsRef.current.size === 0) {
      // Initial population: start neatly near the left so content is immediately readable
      let cursorX = 12;
      for (const { key, el, width } of unpositioned) {
        positionsRef.current.set(key, { x: cursorX, width });
        el.style.transform = `translate3d(${cursorX.toFixed(2)}px, -50%, 0)`;
        cursorX += width + gapPx;
      }
      isInitialSeedRef.current = false;
      return;
    }

    // Live arrival: compute rightmost edge of items currently visible on screen (pos.x < viewportWidth)
    // and insert the newly arrived items immediately after them off the right edge, shifting ONLY
    // already off-screen queued items if necessary so visible items NEVER jump!
    let insertX = viewportWidth + 12;
    let minOffscreenX = Infinity;
    const offscreenEntries: Array<{ key: string; pos: PositionedEntry }> = [];

    for (const [key, pos] of positionsRef.current.entries()) {
      if (pos.x < viewportWidth) {
        const rightEdge = pos.x + pos.width + gapPx;
        if (rightEdge > insertX) {
          insertX = rightEdge;
        }
      } else {
        offscreenEntries.push({ key, pos });
        if (pos.x < minOffscreenX) {
          minOffscreenX = pos.x;
        }
      }
    }

    let cursorX = insertX;
    for (const { key, el, width } of unpositioned) {
      positionsRef.current.set(key, { x: cursorX, width });
      el.style.transform = `translate3d(${cursorX.toFixed(2)}px, -50%, 0)`;
      cursorX += width + gapPx;
    }

    // Push only off-screen queued items right so they never overlap the newly inserted batch
    if (offscreenEntries.length > 0 && minOffscreenX < cursorX) {
      const shift = cursorX - minOffscreenX;
      for (const { key, pos } of offscreenEntries) {
        pos.x += shift;
        const el = elMapRef.current.get(key);
        if (el) {
          el.style.transform = `translate3d(${pos.x.toFixed(2)}px, -50%, 0)`;
        }
      }
    }

    isInitialSeedRef.current = false;
  }, [renderKeys, gapPx]);

  const hasItems = renderKeys.length > 0;

  // Continuous 60fps GPU-transform loop — NEVER restarts when new items arrive!
  useEffect(() => {
    if (reducedMotionRef.current || !hasItems) return;

    let rafId = 0;
    let lastTs = performance.now();

    const tick = (ts: number) => {
      const dt = Math.min(0.08, Math.max(0, (ts - lastTs) / 1000));
      lastTs = ts;

      const viewport = viewportRef.current;
      const viewportWidth = viewport?.clientWidth || 360;
      const expiredKeys: string[] = [];

      if (viewport && !pausedRef.current) {
        const dx = dt * speedPxPerSec;

        for (const [key, pos] of positionsRef.current.entries()) {
          if (pos.width === 0) {
            const el = elMapRef.current.get(key);
            if (el) pos.width = el.offsetWidth || 80;
          }
          pos.x -= dx;
        }

        // Compute rightmost edge once for seamless off-screen wrapping
        let maxRight = viewportWidth + 12;
        for (const pos of positionsRef.current.values()) {
          const rightEdge = pos.x + pos.width + gapPx;
          if (rightEdge > maxRight) {
            maxRight = rightEdge;
          }
        }

        for (const [key, pos] of positionsRef.current.entries()) {
          if (pos.x + pos.width < -24) {
            if (latestMapRef.current.has(key)) {
              pos.x = maxRight;
              maxRight = pos.x + pos.width + gapPx;
            } else {
              expiredKeys.push(key);
              continue;
            }
          }

          const el = elMapRef.current.get(key);
          if (el) {
            el.style.transform = `translate3d(${pos.x.toFixed(2)}px, -50%, 0)`;
          }
        }
      }

      if (expiredKeys.length > 0) {
        const expiredSet = new Set(expiredKeys);
        for (const key of expiredKeys) {
          positionsRef.current.delete(key);
          seenKeysRef.current.delete(key);
          fallbackItemRef.current.delete(key);
        }
        setRenderKeys((prev) => prev.filter((k) => !expiredSet.has(k)));
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [hasItems, speedPxPerSec, gapPx]);

  if (reducedMotionRef.current) {
    return (
      <div
        aria-label={ariaLabel}
        className={`flex items-center gap-3 overflow-x-auto whitespace-nowrap ${heightClassName} ${className}`}
      >
        {items.map((item, idx) => (
          <div key={getItemKey(item)} className="shrink-0 flex items-center">
            {renderItem(item, idx)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      aria-label={ariaLabel}
      onMouseEnter={
        pauseOnHover
          ? () => {
              pausedRef.current = true;
            }
          : undefined
      }
      onMouseLeave={
        pauseOnHover
          ? () => {
              pausedRef.current = false;
            }
          : undefined
      }
      onTouchStart={
        pauseOnHover
          ? () => {
              pausedRef.current = true;
            }
          : undefined
      }
      onTouchEnd={
        pauseOnHover
          ? () => {
              pausedRef.current = false;
            }
          : undefined
      }
      className={`relative w-full overflow-hidden select-none ${heightClassName} ${
        fadeMask
          ? '[mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]'
          : ''
      } ${className}`}
    >
      {renderKeys.map((key) => {
        const entry = latestMapRef.current.get(key) ?? fallbackItemRef.current.get(key);
        if (!entry) return null;
        return (
          <div
            key={key}
            ref={(node) => {
              if (node) {
                elMapRef.current.set(key, node);
                const existing = positionsRef.current.get(key);
                if (existing) {
                  node.style.transform = `translate3d(${existing.x.toFixed(2)}px, -50%, 0)`;
                } else {
                  node.style.transform = 'translate3d(9999px, -50%, 0)';
                }
              } else {
                elMapRef.current.delete(key);
              }
            }}
            style={{ willChange: 'transform' }}
            className="absolute top-1/2 left-0 whitespace-nowrap flex items-center"
          >
            {renderItem(entry.item, entry.index)}
          </div>
        );
      })}
    </div>
  );
}
