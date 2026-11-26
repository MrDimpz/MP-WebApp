import { scheduleCloudProgressSync } from '@/lib/cloud-progress';
import { getCurrentUserSessionPrefix } from '@/lib/unified-game-auth';
import type { DifficultyId } from '../game/puzzleEngine';

export const WORDLOCK_PROGRESS_PREFIX = 'wordlock_progress_v1_';
export const WORDLOCK_STATS_PREFIX = 'wordlock_stats_v1_';
const PREFS_KEY = 'wordlock_prefs_v1';

export interface WordlockDayRecord {
  dateKey: string;
  difficulty: DifficultyId;
  status: 'won' | 'lost';
  bestClicks: number | null;
  par: number;
  maxClicks: number;
  bestScore: number;
  completedAt: number;
}

export interface WordlockStats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  parSolves: number;
  totalScore: number;
  bestScore: number;
  winsByDifficulty: Record<DifficultyId, number>;
  lastWonDate: string | null;
}

export interface WordlockPrefs {
  soundEnabled: boolean;
  difficulty: DifficultyId;
}

export function createEmptyStats(): WordlockStats {
  return {
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    parSolves: 0,
    totalScore: 0,
    bestScore: 0,
    winsByDifficulty: {
      easy: 0,
      standard: 0,
      hard: 0,
      master: 0,
    },
    lastWonDate: null,
  };
}

function getProgressKey(): string {
  return `${WORDLOCK_PROGRESS_PREFIX}${getCurrentUserSessionPrefix()}`;
}

function getStatsKey(): string {
  return `${WORDLOCK_STATS_PREFIX}${getCurrentUserSessionPrefix()}`;
}

export function loadAllProgress(): Record<string, WordlockDayRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(getProgressKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, WordlockDayRecord>;
  } catch {
    return {};
  }
}

export function saveAllProgress(progress: Record<string, WordlockDayRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getProgressKey(), JSON.stringify(progress));
    scheduleCloudProgressSync('wordlock', {
      progress,
      stats: loadStats(),
    });
  } catch {
    // Ignore storage quota errors
  }
}

export function loadStats(): WordlockStats {
  if (typeof window === 'undefined') return createEmptyStats();
  try {
    const raw = window.localStorage.getItem(getStatsKey());
    if (!raw) return createEmptyStats();
    const parsed = JSON.parse(raw) as Partial<WordlockStats>;
    return {
      ...createEmptyStats(),
      ...parsed,
      winsByDifficulty: {
        easy: Number(parsed?.winsByDifficulty?.easy || 0),
        standard: Number(parsed?.winsByDifficulty?.standard || 0),
        hard: Number(parsed?.winsByDifficulty?.hard || 0),
        master: Number(parsed?.winsByDifficulty?.master || 0),
      },
    };
  } catch {
    return createEmptyStats();
  }
}

export function saveStats(stats: WordlockStats): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStatsKey(), JSON.stringify(stats));
    scheduleCloudProgressSync('wordlock', {
      progress: loadAllProgress(),
      stats,
    });
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPrefs(): WordlockPrefs {
  if (typeof window === 'undefined') {
    return { soundEnabled: true, difficulty: 'standard' };
  }
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { soundEnabled: true, difficulty: 'standard' };
    const parsed = JSON.parse(raw) as Partial<WordlockPrefs>;
    const validDiffs: DifficultyId[] = ['easy', 'standard', 'hard', 'master'];
    return {
      soundEnabled: parsed.soundEnabled !== false,
      difficulty:
        parsed.difficulty && validDiffs.includes(parsed.difficulty)
          ? parsed.difficulty
          : 'standard',
    };
  } catch {
    return { soundEnabled: true, difficulty: 'standard' };
  }
}

export function savePrefs(prefs: WordlockPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore
  }
}
