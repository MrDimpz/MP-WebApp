import { useEffect, useState } from 'react';
import { getActiveInteractiveStreamerSession } from './interactive-key-auth';

export type InteractiveGameSlug =
  | 'wikirec'
  | 'wikicon'
  | 'squaredint'
  | 'lexi'
  | 'destackint'
  | 'crowdle'
  | 'mpsearchint'
  | 'inkstream'
  | 'mpwh';

export const MAX_FREE_INTERACTIVE_ROUNDS_PER_DAY = 3;
export const INTERACTIVE_CONTACT_EMAIL = 'admin@missingpiecepuzzles.fun';
export const INTERACTIVE_CONTACT_TIKTOK_HANDLE = '@luverlycuppatea';
export const INTERACTIVE_CONTACT_TIKTOK_URL = 'https://www.tiktok.com/@luverlycuppatea';

const DAILY_ROUNDS_STORAGE_KEY = 'mp_interactive_daily_rounds_v1';
const LIMITS_UPDATED_EVENT = 'mp-interactive-daily-limits-updated';
const LIMIT_LOCK_NOW_EVENT = 'mp-interactive-daily-limit-lock-now';
const AUTH_SYNC_EVENT = 'mp-interactive-auth-updated';

interface StoredDailyRounds {
  date: string;
  counts: Partial<Record<InteractiveGameSlug, number>>;
  recordedTokens: Partial<Record<InteractiveGameSlug, string[]>>;
}

export interface InteractiveDailyUsage {
  date: string;
  used: number;
  remaining: number;
  limit: number;
  isLimitReached: boolean;
  isUnlimited: boolean;
}

export function getInteractiveLimitDateStr(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

function createEmptyStore(date: string): StoredDailyRounds {
  return {
    date,
    counts: {},
    recordedTokens: {},
  };
}

function readDailyRoundsStore(): StoredDailyRounds {
  const today = getInteractiveLimitDateStr();
  if (typeof window === 'undefined') {
    return createEmptyStore(today);
  }
  try {
    const raw = window.localStorage.getItem(DAILY_ROUNDS_STORAGE_KEY);
    if (!raw) return createEmptyStore(today);
    const parsed = JSON.parse(raw) as Partial<StoredDailyRounds>;
    if (!parsed || parsed.date !== today) {
      const fresh = createEmptyStore(today);
      window.localStorage.setItem(DAILY_ROUNDS_STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    return {
      date: today,
      counts: parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : {},
      recordedTokens:
        parsed.recordedTokens && typeof parsed.recordedTokens === 'object'
          ? parsed.recordedTokens
          : {},
    };
  } catch {
    return createEmptyStore(today);
  }
}

function writeDailyRoundsStore(store: StoredDailyRounds): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DAILY_ROUNDS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
}

function dispatchLimitsUpdated(gameSlug?: InteractiveGameSlug): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(LIMITS_UPDATED_EVENT, { detail: { gameSlug } })
  );
}

export function triggerImmediateLimitLock(gameSlug: InteractiveGameSlug): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(LIMIT_LOCK_NOW_EVENT, { detail: { gameSlug } })
  );
}

export function hasUnlimitedInteractiveAccess(): boolean {
  return Boolean(getActiveInteractiveStreamerSession());
}

export function getInteractiveGameDailyUsage(
  gameSlug: InteractiveGameSlug
): InteractiveDailyUsage {
  const today = getInteractiveLimitDateStr();
  const isUnlimited = hasUnlimitedInteractiveAccess();
  const store = readDailyRoundsStore();
  const used = Math.max(0, Number(store.counts[gameSlug] || 0));

  if (isUnlimited) {
    return {
      date: today,
      used,
      remaining: Number.POSITIVE_INFINITY,
      limit: MAX_FREE_INTERACTIVE_ROUNDS_PER_DAY,
      isLimitReached: false,
      isUnlimited: true,
    };
  }

  const remaining = Math.max(0, MAX_FREE_INTERACTIVE_ROUNDS_PER_DAY - used);
  return {
    date: today,
    used,
    remaining,
    limit: MAX_FREE_INTERACTIVE_ROUNDS_PER_DAY,
    isLimitReached: used >= MAX_FREE_INTERACTIVE_ROUNDS_PER_DAY,
    isUnlimited: false,
  };
}

/**
 * Records a completed (or consumed) round for a non-key user.
 * Deduplicated by `roundToken` so completion + clicking "Next Round"
 * for the same round never double-counts.
 */
export function recordInteractiveRoundCompleted(
  gameSlug: InteractiveGameSlug,
  roundToken?: string
): InteractiveDailyUsage & { didIncrement: boolean; justReachedLimit: boolean } {
  if (hasUnlimitedInteractiveAccess()) {
    return {
      ...getInteractiveGameDailyUsage(gameSlug),
      didIncrement: false,
      justReachedLimit: false,
    };
  }

  const store = readDailyRoundsStore();
  const prevUsed = Math.max(0, Number(store.counts[gameSlug] || 0));
  const tokens = Array.isArray(store.recordedTokens[gameSlug])
    ? [...store.recordedTokens[gameSlug]!]
    : [];

  if (roundToken && tokens.includes(roundToken)) {
    const usage = getInteractiveGameDailyUsage(gameSlug);
    return { ...usage, didIncrement: false, justReachedLimit: false };
  }

  const nextUsed = prevUsed + 1;
  store.counts[gameSlug] = nextUsed;
  if (roundToken) {
    tokens.push(roundToken);
    store.recordedTokens[gameSlug] = tokens.slice(-24);
  }
  writeDailyRoundsStore(store);
  dispatchLimitsUpdated(gameSlug);

  const usage = getInteractiveGameDailyUsage(gameSlug);
  return {
    ...usage,
    didIncrement: true,
    justReachedLimit:
      prevUsed < MAX_FREE_INTERACTIVE_ROUNDS_PER_DAY &&
      nextUsed >= MAX_FREE_INTERACTIVE_ROUNDS_PER_DAY,
  };
}

/**
 * Called right before starting / advancing to a new round.
 * - Stream key holders always pass (`true`).
 * - If `prevRoundToken` was active and not yet counted (e.g. player skipped mid-round),
 *   counts that round so skipping cannot bypass the 3-round daily limit.
 * - If the daily 3-round limit is now reached, signals immediate lock and returns `false`.
 */
export function tryConsumeOrCheckNextRound(
  gameSlug: InteractiveGameSlug,
  prevRoundToken?: string
): boolean {
  if (hasUnlimitedInteractiveAccess()) {
    return true;
  }

  if (prevRoundToken) {
    recordInteractiveRoundCompleted(gameSlug, prevRoundToken);
  }

  const usage = getInteractiveGameDailyUsage(gameSlug);
  if (usage.isLimitReached) {
    triggerImmediateLimitLock(gameSlug);
    return false;
  }

  return true;
}

export function useInteractiveDailyLimit(
  gameSlug: InteractiveGameSlug
): InteractiveDailyUsage & { lockImmediately: boolean } {
  const [usage, setUsage] = useState<InteractiveDailyUsage>(() =>
    getInteractiveGameDailyUsage(gameSlug)
  );
  const [lockImmediately, setLockImmediately] = useState<boolean>(() => {
    const initial = getInteractiveGameDailyUsage(gameSlug);
    return initial.isLimitReached && !initial.isUnlimited;
  });

  useEffect(() => {
    const refresh = () => {
      const next = getInteractiveGameDailyUsage(gameSlug);
      setUsage(next);
      if (next.isUnlimited || !next.isLimitReached) {
        setLockImmediately(false);
      }
    };

    const onLockNow = (e: Event) => {
      const detail = (e as CustomEvent<{ gameSlug?: InteractiveGameSlug }>).detail;
      if (!detail?.gameSlug || detail.gameSlug === gameSlug) {
        const next = getInteractiveGameDailyUsage(gameSlug);
        setUsage(next);
        if (next.isLimitReached && !next.isUnlimited) {
          setLockImmediately(true);
        }
      }
    };

    refresh();
    window.addEventListener(LIMITS_UPDATED_EVENT, refresh);
    window.addEventListener(AUTH_SYNC_EVENT, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener(LIMIT_LOCK_NOW_EVENT, onLockNow);

    return () => {
      window.removeEventListener(LIMITS_UPDATED_EVENT, refresh);
      window.removeEventListener(AUTH_SYNC_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener(LIMIT_LOCK_NOW_EVENT, onLockNow);
    };
  }, [gameSlug]);

  return { ...usage, lockImmediately };
}

export function useAllInteractiveDailyLimits(): Record<
  InteractiveGameSlug,
  InteractiveDailyUsage
> {
  const readAll = (): Record<InteractiveGameSlug, InteractiveDailyUsage> => ({
    wikirec: getInteractiveGameDailyUsage('wikirec'),
    wikicon: getInteractiveGameDailyUsage('wikicon'),
    squaredint: getInteractiveGameDailyUsage('squaredint'),
    lexi: getInteractiveGameDailyUsage('lexi'),
    destackint: getInteractiveGameDailyUsage('destackint'),
    crowdle: getInteractiveGameDailyUsage('crowdle'),
    mpsearchint: getInteractiveGameDailyUsage('mpsearchint'),
    inkstream: getInteractiveGameDailyUsage('inkstream'),
    mpwh: getInteractiveGameDailyUsage('mpwh'),
  });

  const [allUsage, setAllUsage] = useState<
    Record<InteractiveGameSlug, InteractiveDailyUsage>
  >(() => readAll());

  useEffect(() => {
    const refresh = () => setAllUsage(readAll());
    refresh();
    window.addEventListener(LIMITS_UPDATED_EVENT, refresh);
    window.addEventListener(AUTH_SYNC_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(LIMITS_UPDATED_EVENT, refresh);
      window.removeEventListener(AUTH_SYNC_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return allUsage;
}
