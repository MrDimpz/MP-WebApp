import { GameStats } from '../types/game';
import { getCurrentUserSessionPrefix } from '../../lib/unified-game-auth';
import { scheduleCloudProgressSync } from '../../lib/cloud-progress';

function getStatsKey(): string {
  return `thematik_game_stats_${getCurrentUserSessionPrefix()}`;
}
function getProgressPrefix(): string {
  return `thematik_progress_${getCurrentUserSessionPrefix()}_`;
}

const DEFAULT_STATS: GameStats = {
  played: 0,
  won: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 },
  lastPlayedDate: '',
};

export function loadStats(): GameStats {
  try {
    const raw = localStorage.getItem(getStatsKey());
    if (!raw) return DEFAULT_STATS;
    return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATS;
  }
}

function pushThematixCloudBucket(statsOverride?: GameStats) {
  try {
    const stats = statsOverride || loadStats();
    const prefix = getProgressPrefix();
    const puzzles: Record<string, unknown> = {};
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys.slice(-100)) {
      const pid = k.slice(prefix.length);
      const raw = localStorage.getItem(k);
      if (!pid || !raw) continue;
      try {
        puzzles[pid] = JSON.parse(raw);
      } catch {}
    }
    scheduleCloudProgressSync('thematix', { stats, puzzles });
  } catch {
    // Ignore
  }
}

export function saveStats(stats: GameStats) {
  try {
    localStorage.setItem(getStatsKey(), JSON.stringify(stats));
    pushThematixCloudBucket(stats);
  } catch {
    // Ignore storage quota
  }
}

export function recordWin(guessesCount: number, puzzleDate: string) {
  const stats = loadStats();
  stats.played += 1;
  stats.won += 1;

  // Streak logic
  stats.currentStreak += 1;
  if (stats.currentStreak > stats.maxStreak) {
    stats.maxStreak = stats.currentStreak;
  }

  // Distribution
  const bucket = Math.min(guessesCount, 10);
  stats.guessDistribution[bucket] = (stats.guessDistribution[bucket] || 0) + 1;
  stats.lastPlayedDate = puzzleDate;

  saveStats(stats);
  return stats;
}

export function recordLoss(puzzleDate: string) {
  const stats = loadStats();
  stats.played += 1;
  stats.currentStreak = 0;
  stats.lastPlayedDate = puzzleDate;
  saveStats(stats);
  return stats;
}

export interface SavedPuzzleProgress {
  guessedLetters: string[];
  letterGuessesCount: number;
  filledWords: string[];
  filledThemeWord?: string;
  themeWord?: string;
  isSolved: boolean;
  isGivenUp: boolean;
}

export function loadPuzzleProgress(puzzleId: string): SavedPuzzleProgress | null {
  try {
    const raw = localStorage.getItem(getProgressPrefix() + puzzleId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function savePuzzleProgress(puzzleId: string, progress: SavedPuzzleProgress) {
  try {
    localStorage.setItem(getProgressPrefix() + puzzleId, JSON.stringify(progress));
    pushThematixCloudBucket();
  } catch {
    // Ignore
  }
}
