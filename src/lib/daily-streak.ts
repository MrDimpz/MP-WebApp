import { useEffect, useState } from 'react';
import { getCurrentUserSessionPrefix } from './unified-game-auth';

export type DailyStreakGameId =
  | 'crossword'
  | 'rebus'
  | 'squared'
  | 'thematix'
  | 'destack'
  | 'unolingo'
  | 'destackint'
  | 'squaredint'
  | 'wikirec'
  | 'wikicon'
  | 'mpsearch'
  | 'mpsearchint'
  | 'mpdifference'
  | 'mpcolossal'
  | 'lexi'
  | 'crowdle';

export interface StoredGameStreak {
  solvedDates: string[];
  baseStreak?: number;
  baseStreakDate?: string;
}

export interface DailyStreakState {
  solvedToday: boolean;
  streak: number;
}

const DAILY_STREAK_EVENT = 'tmp-daily-streak-updated';

function getStorageKey(): string {
  return `tmp_daily_streaks_v1_${getCurrentUserSessionPrefix()}`;
}

export function getLocalTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getLondonTodayDateStr(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return getLocalTodayDateStr();
  }
}

function parseIsoDateUtc(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return Date.UTC(y, m - 1, d);
}

function stepIsoDate(isoDate: string, deltaDays: number): string | null {
  const utc = parseIsoDateUtc(isoDate);
  if (utc === null) return null;
  const next = new Date(utc + deltaDays * 86_400_000);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  const d = String(next.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diffDaysUtc(earlierIso: string, laterIso: string): number | null {
  const a = parseIsoDateUtc(earlierIso);
  const b = parseIsoDateUtc(laterIso);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86_400_000);
}

function readAllStreaks(): Partial<Record<DailyStreakGameId, StoredGameStreak>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(getStorageKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllStreaks(data: Partial<Record<DailyStreakGameId, StoredGameStreak>>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStorageKey(), JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function recordDailyPuzzleSolved(
  gameId: DailyStreakGameId,
  todayDateStr: string = getLocalTodayDateStr(),
  legacyStreakHint?: number
): DailyStreakState {
  const all = readAllStreaks();
  const prev: StoredGameStreak = all[gameId] || { solvedDates: [] };
  const dateSet = new Set(Array.isArray(prev.solvedDates) ? prev.solvedDates : []);
  const hadToday = dateSet.has(todayDateStr);
  dateSet.add(todayDateStr);

  const sortedDates = Array.from(dateSet).sort();
  let baseStreak = prev.baseStreak;
  let baseStreakDate = prev.baseStreakDate;

  if (
    typeof legacyStreakHint === 'number' &&
    legacyStreakHint > 0 &&
    (!baseStreak || legacyStreakHint >= baseStreak)
  ) {
    baseStreak = legacyStreakHint;
    baseStreakDate = todayDateStr;
  }

  const nextEntry: StoredGameStreak = {
    solvedDates: sortedDates,
    ...(baseStreak ? { baseStreak } : {}),
    ...(baseStreakDate ? { baseStreakDate } : {}),
  };

  const changed = !hadToday || nextEntry.baseStreak !== prev.baseStreak;
  if (changed) {
    all[gameId] = nextEntry;
    writeAllStreaks(all);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DAILY_STREAK_EVENT, { detail: { gameId } }));
    }
  }

  return getDailyStreakState(gameId, todayDateStr, true, legacyStreakHint || 0);
}

export function getDailyStreakState(
  gameId: DailyStreakGameId,
  todayDateStr: string = getLocalTodayDateStr(),
  legacySolvedToday = false,
  legacyStreakCount = 0
): DailyStreakState {
  const all = readAllStreaks();
  const record = all[gameId];
  const dateSet = new Set(Array.isArray(record?.solvedDates) ? record.solvedDates : []);
  if (legacySolvedToday) {
    dateSet.add(todayDateStr);
  }

  if (!dateSet.has(todayDateStr)) {
    return { solvedToday: false, streak: 0 };
  }

  let streak = 0;
  let cursor: string | null = todayDateStr;
  while (cursor && dateSet.has(cursor)) {
    streak += 1;
    cursor = stepIsoDate(cursor, -1);
  }

  // Respect continuity with an imported legacy streak if every day between
  // baseStreakDate and todayDateStr is solved (or if baseStreakDate === todayDateStr)
  if (record?.baseStreak && record.baseStreakDate) {
    const gap = diffDaysUtc(record.baseStreakDate, todayDateStr);
    if (gap !== null && gap >= 0) {
      let continuous = true;
      let check: string | null = todayDateStr;
      for (let i = 0; i < gap; i++) {
        if (!check || !dateSet.has(check)) {
          continuous = false;
          break;
        }
        check = stepIsoDate(check, -1);
      }
      if (continuous) {
        streak = Math.max(streak, record.baseStreak + gap);
      }
    }
  }

  if (legacySolvedToday && legacyStreakCount > 0) {
    streak = Math.max(streak, legacyStreakCount);
  }

  return {
    solvedToday: true,
    streak: Math.max(1, streak),
  };
}

export function useDailyStreak(
  gameId: DailyStreakGameId,
  todayDateStr: string = getLocalTodayDateStr(),
  legacySolvedToday = false,
  legacyStreakCount = 0
): DailyStreakState {
  const [state, setState] = useState<DailyStreakState>(() =>
    getDailyStreakState(gameId, todayDateStr, legacySolvedToday, legacyStreakCount)
  );

  // Sync legacy completion into persisted streak dates cleanly inside an effect
  useEffect(() => {
    if (legacySolvedToday) {
      recordDailyPuzzleSolved(gameId, todayDateStr, legacyStreakCount);
    }
    setState(getDailyStreakState(gameId, todayDateStr, legacySolvedToday, legacyStreakCount));
  }, [gameId, todayDateStr, legacySolvedToday, legacyStreakCount]);

  useEffect(() => {
    const refresh = () => {
      setState(getDailyStreakState(gameId, todayDateStr, legacySolvedToday, legacyStreakCount));
    };
    window.addEventListener(DAILY_STREAK_EVENT, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('unified-auth-updated', refresh);
    return () => {
      window.removeEventListener(DAILY_STREAK_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('unified-auth-updated', refresh);
    };
  }, [gameId, todayDateStr, legacySolvedToday, legacyStreakCount]);

  return state;
}
