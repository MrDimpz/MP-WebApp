import { scheduleCloudProgressSync } from '@/lib/cloud-progress';
import { getCurrentUserSessionPrefix } from '@/lib/unified-game-auth';
import { PuzzleProgressRecord, UnolingoPrefs, UnolingoStats } from '../types';
import { shiftDateStr } from './londonTime';

export const DEFAULT_STATS: UnolingoStats = {
  currentStreak: 0,
  longestStreak: 0,
  totalSolved: 0,
  bestTimeSec: 0,
  totalHintsUsed: 0,
  totalMistakes: 0,
  lastDailyStreakDate: '',
};

export const DEFAULT_PREFS: UnolingoPrefs = {
  soundEnabled: true,
  autoCheck: false,
};

function getProgressKey(): string {
  return `tmp_unolingo_progress_v1_${getCurrentUserSessionPrefix()}`;
}

function getStatsKey(): string {
  return `tmp_unolingo_stats_v1_${getCurrentUserSessionPrefix()}`;
}

function getPrefsKey(): string {
  return `tmp_unolingo_prefs_v1_${getCurrentUserSessionPrefix()}`;
}

export function sanitizeBoardLetters(arr: unknown): string[] {
  const out = new Array<string>(26).fill('');
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i < 26; i++) {
    const ch = String(arr[i] ?? '')
      .toUpperCase()
      .slice(0, 1);
    out[i] = /^[A-Z]$/.test(ch) ? ch : '';
  }
  return out;
}

export function sanitizeHintIndices(arr: unknown): number[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<number>();
  for (const idx of arr) {
    if (Number.isInteger(idx) && idx >= 0 && idx < 26) {
      seen.add(idx);
    }
  }
  return Array.from(seen).slice(0, 26);
}

export function readProgressMap(): Record<string, PuzzleProgressRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(getProgressKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, PuzzleProgressRecord>)
      : {};
  } catch {
    return {};
  }
}

export function writeProgressMap(map: Record<string, PuzzleProgressRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getProgressKey(), JSON.stringify(map));
    if (Object.keys(map).length > 0) {
      scheduleCloudProgressSync('unolingo', {
        progress: map,
        stats: readStats(),
        prefs: readPrefs(),
      });
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function readStats(): UnolingoStats {
  if (typeof window === 'undefined') return { ...DEFAULT_STATS };
  try {
    const raw = window.localStorage.getItem(getStatsKey());
    if (!raw) return { ...DEFAULT_STATS };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? { ...DEFAULT_STATS, ...parsed }
      : { ...DEFAULT_STATS };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function writeStats(stats: UnolingoStats): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStatsKey(), JSON.stringify(stats));
    scheduleCloudProgressSync('unolingo', {
      progress: readProgressMap(),
      stats,
      prefs: readPrefs(),
    });
  } catch {
    // Ignore storage quota errors
  }
}

export function readPrefs(): UnolingoPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(getPrefsKey());
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? { ...DEFAULT_PREFS, ...parsed }
      : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writePrefs(prefs: UnolingoPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getPrefsKey(), JSON.stringify(prefs));
    const progress = readProgressMap();
    const stats = readStats();
    if (Object.keys(progress).length > 0 || stats.totalSolved > 0) {
      scheduleCloudProgressSync('unolingo', { progress, stats, prefs });
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function computeEffectiveStreak(
  stats: UnolingoStats,
  todayLondonStr: string
): number {
  if (!stats.lastDailyStreakDate) return 0;
  const yesterday = shiftDateStr(todayLondonStr, -1);
  if (
    stats.lastDailyStreakDate === todayLondonStr ||
    stats.lastDailyStreakDate === yesterday
  ) {
    return stats.currentStreak;
  }
  return 0;
}

export function calculateUnolingoScore(
  elapsedSec: number,
  hintsUsed: number,
  mistakes: number
): number {
  const timeBonus = Math.max(0, 900 - Math.max(0, elapsedSec) * 2);
  const raw = 1500 + timeBonus - hintsUsed * 120 - mistakes * 60;
  return Math.max(250, Math.round(raw));
}
