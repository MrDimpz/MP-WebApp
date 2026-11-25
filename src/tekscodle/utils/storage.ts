import { Difficulty } from '../data/items';
import { scheduleCloudProgressSync } from '@/lib/cloud-progress';
import { getCurrentUserSessionPrefix } from '@/lib/unified-game-auth';

const DARK_MODE_STORAGE_KEY = 'tekscodle_dark_mode_v2';
const MUTED_STORAGE_KEY = 'tekscodle_muted_v1';

export interface TekscodleRunSummary {
  id: string;
  date: string;
  mode: 'daily' | 'practice';
  difficulty: Difficulty;
  round1Score: number;
  round2Score: number;
  round3Score: number;
  totalScore: number;
  avgErrorPct: number;
  timestamp: number;
}

export interface TekscodleLocalStats {
  bestScore: number;
  gamesPlayed: number;
  quickPlays: number;
  dailyCompletedDates: string[];
  recentRuns: TekscodleRunSummary[];
}

function getStatsKey(): string {
  return `tekscodle_stats_v1_${getCurrentUserSessionPrefix()}`;
}

export function loadDarkModePreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(DARK_MODE_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveDarkModePreference(darkMode: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DARK_MODE_STORAGE_KEY, darkMode ? 'true' : 'false');
  } catch {
    // ignore
  }
}

export function loadLocalMuted(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(MUTED_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveLocalMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTED_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // ignore
  }
}

export function readTekscodleStats(): TekscodleLocalStats {
  const empty: TekscodleLocalStats = {
    bestScore: 0,
    gamesPlayed: 0,
    quickPlays: 0,
    dailyCompletedDates: [],
    recentRuns: [],
  };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(getStatsKey());
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<TekscodleLocalStats>;
    return {
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      gamesPlayed: typeof parsed.gamesPlayed === 'number' ? parsed.gamesPlayed : 0,
      quickPlays: typeof parsed.quickPlays === 'number' ? parsed.quickPlays : 0,
      dailyCompletedDates: Array.isArray(parsed.dailyCompletedDates)
        ? parsed.dailyCompletedDates
        : [],
      recentRuns: Array.isArray(parsed.recentRuns) ? parsed.recentRuns : [],
    };
  } catch {
    return empty;
  }
}

export function writeTekscodleStats(stats: TekscodleLocalStats): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStatsKey(), JSON.stringify(stats));
    if (stats.gamesPlayed > 0 || stats.dailyCompletedDates.length > 0) {
      scheduleCloudProgressSync('tekscodle', { stats });
    }
  } catch {
    // ignore
  }
}
