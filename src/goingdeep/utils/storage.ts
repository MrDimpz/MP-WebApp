import {
  DifficultyLevel,
  GameStats,
  MiniGameProgress,
  PuzzleData,
  PuzzleProgress,
} from '../types';
import {
  DIFFICULTIES,
  getInitialTileOrder,
  getProgressKey,
  TIERS,
} from '../data/dailyGenerator';
import { getCurrentUserSessionPrefix } from '@/lib/unified-game-auth';
import { scheduleCloudProgressSync } from '@/lib/cloud-progress';

export const GOING_DEEP_PROGRESS_PREFIX = 'goingdeep_progress_v1_';
export const GOING_DEEP_STATS_PREFIX = 'goingdeep_stats_v1_';
const PREFS_KEY = 'goingdeep_prefs_v1';

function getProgressStorageKey(): string {
  return `${GOING_DEEP_PROGRESS_PREFIX}${getCurrentUserSessionPrefix()}`;
}

function getStatsStorageKey(): string {
  return `${GOING_DEEP_STATS_PREFIX}${getCurrentUserSessionPrefix()}`;
}

export function createInitialProgress(puzzle: PuzzleData): PuzzleProgress {
  const miniGames: Record<string, MiniGameProgress> = {};
  for (const mg of puzzle.miniGames) {
    miniGames[mg.keyId] = {
      status: 'locked',
      hintsUsed: 0,
      ...(mg.type === 'letterlock' ? { letterLockGuesses: [] } : {}),
    };
  }

  return {
    progressKey: getProgressKey(puzzle.dateKey, puzzle.difficulty),
    puzzleId: puzzle.id,
    dateKey: puzzle.dateKey,
    difficulty: puzzle.difficulty,
    status: 'in_progress',
    mistakesRemaining: puzzle.maxMistakes,
    maxMistakes: puzzle.maxMistakes,
    solvedTiers: [],
    tileOrder: getInitialTileOrder(puzzle),
    guesses: [],
    miniGames,
    elapsedSeconds: 0,
  };
}

export function loadAllProgress(): Record<string, PuzzleProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(getProgressStorageKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PuzzleProgress>;
    for (const key of Object.keys(parsed)) {
      const entry = parsed[key];
      if (
        entry &&
        entry.status === 'in_progress' &&
        typeof entry.maxMistakes === 'number' &&
        entry.maxMistakes < 4
      ) {
        const used = Math.max(0, entry.maxMistakes - entry.mistakesRemaining);
        parsed[key] = {
          ...entry,
          maxMistakes: 4,
          mistakesRemaining: Math.max(1, 4 - used),
        };
      }
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveAllProgress(
  map: Record<string, PuzzleProgress>,
  stats?: GameStats
): void {
  if (typeof window === 'undefined') return;
  try {
    // Cap stored daily progress entries to cover the full 6-month archive across all 3 difficulties
    const keys = Object.keys(map).sort().reverse().slice(0, 560);
    const trimmed: Record<string, PuzzleProgress> = {};
    for (const k of keys) {
      trimmed[k] = map[k];
    }
    window.localStorage.setItem(getProgressStorageKey(), JSON.stringify(trimmed));
    scheduleCloudProgressSync('goingdeep', {
      progress: trimmed,
      stats: stats ?? loadStats(),
    });
  } catch {
    // Ignore storage quota errors
  }
}

export function createDefaultStats(): GameStats {
  return {
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    perfectGames: 0,
    mistakeDistribution: [0, 0, 0, 0, 0],
    miniGamesSolved: {
      letterlock: 0,
      anagram: 0,
      crossword: 0,
      wordsearch: 0,
    },
    winsByDifficulty: {
      standard: 0,
      hard: 0,
      expert: 0,
    },
  };
}

export function loadStats(): GameStats {
  if (typeof window === 'undefined') return createDefaultStats();
  try {
    const raw = window.localStorage.getItem(getStatsStorageKey());
    if (!raw) return createDefaultStats();
    const parsed = JSON.parse(raw) as Partial<GameStats>;
    const defaults = createDefaultStats();
    return {
      ...defaults,
      ...parsed,
      mistakeDistribution:
        parsed.mistakeDistribution && parsed.mistakeDistribution.length === 5
          ? parsed.mistakeDistribution
          : defaults.mistakeDistribution,
      miniGamesSolved: {
        ...defaults.miniGamesSolved,
        ...(parsed.miniGamesSolved ?? {}),
      },
      winsByDifficulty: {
        ...defaults.winsByDifficulty,
        ...(parsed.winsByDifficulty ?? {}),
      },
    };
  } catch {
    return createDefaultStats();
  }
}

export function saveStats(
  stats: GameStats,
  progressMap?: Record<string, PuzzleProgress>
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStatsStorageKey(), JSON.stringify(stats));
    scheduleCloudProgressSync('goingdeep', {
      progress: progressMap ?? loadAllProgress(),
      stats,
    });
  } catch {
    // Ignore storage quota errors
  }
}

export interface UserPrefs {
  soundEnabled: boolean;
  difficulty: DifficultyLevel;
}

export function loadPrefs(): UserPrefs {
  if (typeof window === 'undefined') {
    return { soundEnabled: true, difficulty: 'standard' };
  }
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) {
      return { soundEnabled: true, difficulty: 'standard' };
    }
    const parsed = JSON.parse(raw) as Partial<UserPrefs>;
    const difficulty: DifficultyLevel =
      parsed.difficulty === 'hard' || parsed.difficulty === 'expert'
        ? parsed.difficulty
        : 'standard';
    return {
      soundEnabled: parsed.soundEnabled !== false,
      difficulty,
    };
  } catch {
    return { soundEnabled: true, difficulty: 'standard' };
  }
}

export function savePrefs(prefs: UserPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function computeGoingDeepScore(
  puzzle: PuzzleData,
  progress: PuzzleProgress
): number {
  if (progress.status !== 'won') return 0;
  const baseByDifficulty: Record<DifficultyLevel, number> = {
    standard: 1000,
    hard: 1600,
    expert: 2400,
  };
  const cleanKeys = puzzle.miniGames.filter(
    (mg) => progress.miniGames[mg.keyId]?.status === 'solved'
  ).length;
  const totalHints = puzzle.miniGames.reduce(
    (sum, mg) => sum + (progress.miniGames[mg.keyId]?.hintsUsed ?? 0),
    0
  );
  const mistakesUsed = progress.maxMistakes - progress.mistakesRemaining;
  const flawlessBonus =
    mistakesUsed === 0 &&
    totalHints === 0 &&
    cleanKeys === puzzle.miniGames.length
      ? 400
      : 0;
  const speedBonus = Math.max(
    0,
    300 - Math.floor(progress.elapsedSeconds / 4)
  );
  return Math.max(
    100,
    baseByDifficulty[puzzle.difficulty] +
      progress.mistakesRemaining * 150 +
      cleanKeys * 100 +
      flawlessBonus +
      speedBonus -
      totalHints * 35
  );
}

export function buildShareText(
  puzzle: PuzzleData,
  progress: PuzzleProgress
): string {
  const diffMeta = DIFFICULTIES[puzzle.difficulty];
  const solvedKeys = puzzle.miniGames.filter(
    (mg) => progress.miniGames[mg.keyId]?.status === 'solved'
  ).length;
  const keyIcons = puzzle.miniGames
    .map((mg) => {
      const st = progress.miniGames[mg.keyId]?.status;
      if (st === 'solved') return '🔑';
      if (st === 'revealed') return '🔓';
      return '🔒';
    })
    .join('');

  const guessLines = progress.guesses.map((g) =>
    g.tiers.map((t) => TIERS[t].emoji).join('')
  );

  const mistakesUsed = progress.maxMistakes - progress.mistakesRemaining;
  const score = computeGoingDeepScore(puzzle, progress);
  const outcomeLine =
    progress.status === 'won'
      ? `Solved · ${score.toLocaleString()} pts · ${mistakesUsed}/${progress.maxMistakes} mistakes · ${formatTime(progress.elapsedSeconds)}`
      : `Out of guesses · ${progress.solvedTiers.length}/4 layers`;

  return [
    `The Missing Piece · Going Deep #${puzzle.id} (${diffMeta.label} · ${diffMeta.keyCount} Keys)`,
    `Keys (${solvedKeys}/${puzzle.miniGames.length}): ${keyIcons}`,
    ...guessLines,
    outcomeLine,
    'missingpiecepuzzles.fun/solo-games/goingdeep',
  ].join('\n');
}
