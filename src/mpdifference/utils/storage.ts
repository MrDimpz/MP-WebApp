import { getLondonTodayDateStr } from '@/lib/daily-streak';
import { getCurrentUserSessionPrefix } from '@/lib/unified-game-auth';
import type { DifferenceCompletion } from '../types/game';

const BASE_COMPLETIONS_KEY = 'mp_difference_completions_v1';
const MUTED_STORAGE_KEY = 'mp_difference_muted_v1';
const DARK_MODE_STORAGE_KEY = 'mpdifference_dark_mode';

function getCompletionsStorageKey(): string {
  return `${BASE_COMPLETIONS_KEY}_${getCurrentUserSessionPrefix()}`;
}

export function readStoredCompletions(): Record<string, DifferenceCompletion> {
  if (typeof window === 'undefined') return {};
  try {
    const scopedRaw = window.localStorage.getItem(getCompletionsStorageKey());
    if (scopedRaw) {
      const parsed = JSON.parse(scopedRaw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    }
    return {};
  } catch {
    return {};
  }
}

export function writeStoredCompletions(map: Record<string, DifferenceCompletion>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getCompletionsStorageKey(), JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadLocalMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveLocalMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTED_STORAGE_KEY, String(muted));
  } catch {
    // Ignore
  }
}

export function loadDarkModePreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = window.localStorage.getItem(DARK_MODE_STORAGE_KEY);
    if (saved !== null) return saved === 'true';
  } catch {
    // Ignore
  }
  return false;
}

export function saveDarkModePreference(dark: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DARK_MODE_STORAGE_KEY, String(dark));
  } catch {
    // Ignore
  }
}

export function computeCompletionStats(
  completions: Record<string, DifferenceCompletion>,
  todayDateKey: string = getLondonTodayDateStr()
) {
  const entries = Object.values(completions);
  const solvedCount = entries.length;
  let allTimeBestScore = 0;
  let bestTimeSeconds = 0;

  entries.forEach((rec) => {
    if (rec.bestScore > allTimeBestScore) allTimeBestScore = rec.bestScore;
    if (rec.bestTimeSeconds > 0 && (bestTimeSeconds === 0 || rec.bestTimeSeconds < bestTimeSeconds)) {
      bestTimeSeconds = rec.bestTimeSeconds;
    }
  });

  // Compute current consecutive day streak ending at today or yesterday
  const dates = new Set(entries.map((e) => e.puzzleDate));
  let streak = 0;
  const cursor = new Date(`${todayDateKey}T12:00:00Z`);
  if (!dates.has(todayDateKey)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dates.has(key)) break;
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return {
    solvedCount,
    allTimeBestScore,
    bestTimeSeconds,
    streak,
    solvedToday: dates.has(todayDateKey),
  };
}
