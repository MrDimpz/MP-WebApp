import { scheduleCloudProgressSync } from '@/lib/cloud-progress';
import { getCurrentUserSessionPrefix } from '@/lib/unified-game-auth';
import { computeCrossjigScore, GameMode, PlayerStats } from './types';

const LEGACY_STATS_KEY = 'crossjig_stats_v1';
const PREFS_KEY = 'crossjig_prefs_v1';

function getStatsStorageKey(): string {
  return `crossjig_stats_v1_${getCurrentUserSessionPrefix()}`;
}

export interface PlayerPrefs {
  soundEnabled: boolean;
  autoLockCorrect: boolean;
}

const DEFAULT_STATS: PlayerStats = {
  totalSolved: 0,
  dailyStreak: 0,
  bestStreak: 0,
  bestScore: 0,
  totalScore: 0,
  lastDailyDate: null,
  bestTimes: {},
  dailyCompletedDates: [],
  dailyArchive: {},
};

const DEFAULT_PREFS: PlayerPrefs = {
  soundEnabled: true,
  autoLockCorrect: false,
};

export function loadStats(): PlayerStats {
  try {
    const scopedRaw = localStorage.getItem(getStatsStorageKey());
    const raw = scopedRaw || localStorage.getItem(LEGACY_STATS_KEY);
    if (!raw) return { ...DEFAULT_STATS, dailyArchive: {} };
    const parsed = JSON.parse(raw) as Partial<PlayerStats>;
    const completedDates = Array.isArray(parsed.dailyCompletedDates)
      ? parsed.dailyCompletedDates.filter((d): d is string => typeof d === 'string')
      : [];
    const archiveMap: Record<string, any> =
      parsed.dailyArchive && typeof parsed.dailyArchive === 'object'
        ? { ...parsed.dailyArchive }
        : {};
    for (const d of completedDates) {
      if (!archiveMap[d]) {
        archiveMap[d] = { dateStr: d, solved: true };
      } else {
        archiveMap[d] = { ...archiveMap[d], dateStr: d, solved: true };
      }
    }
    const allSolvedDates = Array.from(
      new Set([
        ...completedDates,
        ...Object.entries(archiveMap)
          .filter(([, rec]) => rec && rec.solved)
          .map(([k]) => k),
      ])
    ).sort();

    return {
      totalSolved: typeof parsed.totalSolved === 'number' ? parsed.totalSolved : 0,
      dailyStreak: typeof parsed.dailyStreak === 'number' ? parsed.dailyStreak : 0,
      bestStreak:
        typeof parsed.bestStreak === 'number'
          ? parsed.bestStreak
          : typeof parsed.dailyStreak === 'number'
            ? parsed.dailyStreak
            : 0,
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      totalScore: typeof parsed.totalScore === 'number' ? parsed.totalScore : 0,
      lastDailyDate: typeof parsed.lastDailyDate === 'string' ? parsed.lastDailyDate : null,
      bestTimes: parsed.bestTimes && typeof parsed.bestTimes === 'object' ? parsed.bestTimes : {},
      dailyCompletedDates: allSolvedDates,
      dailyArchive: archiveMap,
    };
  } catch {
    return { ...DEFAULT_STATS, dailyArchive: {} };
  }
}

export function saveDailyInProgress(
  dailyDate: string,
  tileOrder: number[],
  elapsedSeconds: number,
  movesCount: number,
  hintsUsed: number
): PlayerStats {
  const current = loadStats();
  const existingRec = current.dailyArchive[dailyDate];
  if (existingRec?.solved) return current;

  const nextArchive = {
    ...current.dailyArchive,
    [dailyDate]: {
      ...existingRec,
      dateStr: dailyDate,
      solved: false,
      tileOrder: [...tileOrder],
      elapsedSeconds,
      movesCount,
      hintsUsed,
    },
  };
  const next: PlayerStats = {
    ...current,
    dailyArchive: nextArchive,
  };
  try {
    localStorage.setItem(getStatsStorageKey(), JSON.stringify(next));
    scheduleCloudProgressSync('crossjig', { stats: next });
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function recordSolve(
  mode: GameMode,
  elapsedSeconds: number,
  movesCount: number,
  hintsUsed: number,
  dailyDate?: string,
  todayDateKey?: string
): { stats: PlayerStats; score: number } {
  const current = loadStats();
  const score = computeCrossjigScore(mode, elapsedSeconds, movesCount, hintsUsed);

  const completedSet = new Set<string>(current.dailyCompletedDates);
  const nextArchive = { ...current.dailyArchive };

  if (mode === 'daily' && dailyDate) {
    completedSet.add(dailyDate);
    const prevRec = nextArchive[dailyDate];
    nextArchive[dailyDate] = {
      dateStr: dailyDate,
      solved: true,
      bestSeconds:
        prevRec?.bestSeconds !== undefined
          ? Math.min(prevRec.bestSeconds, elapsedSeconds)
          : elapsedSeconds,
      bestMoves:
        prevRec?.bestMoves !== undefined ? Math.min(prevRec.bestMoves, movesCount) : movesCount,
      bestScore:
        prevRec?.bestScore !== undefined ? Math.max(prevRec.bestScore, score) : score,
      hintsUsed:
        prevRec?.hintsUsed !== undefined ? Math.min(prevRec.hintsUsed, hintsUsed) : hintsUsed,
      elapsedSeconds,
      movesCount,
    };
  }

  const next: PlayerStats = {
    ...current,
    totalSolved: current.totalSolved + 1,
    bestScore: Math.max(current.bestScore, score),
    totalScore: current.totalScore + score,
    bestTimes: { ...current.bestTimes },
    dailyCompletedDates: Array.from(completedSet).sort(),
    dailyArchive: nextArchive,
  };

  const prevBest = next.bestTimes[mode];
  if (prevBest === undefined || elapsedSeconds < prevBest) {
    next.bestTimes[mode] = elapsedSeconds;
  }

  if (mode === 'daily' && dailyDate && (!todayDateKey || dailyDate === todayDateKey)) {
    if (current.lastDailyDate !== dailyDate) {
      const today = new Date(`${dailyDate}T12:00:00`);
      const yesterday = new Date(today.getTime() - 86400000);
      const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      next.dailyStreak = current.lastDailyDate === yStr ? current.dailyStreak + 1 : 1;
      next.bestStreak = Math.max(current.bestStreak, next.dailyStreak);
      next.lastDailyDate = dailyDate;
    }
  }

  try {
    localStorage.setItem(getStatsStorageKey(), JSON.stringify(next));
    scheduleCloudProgressSync('crossjig', { stats: next });
  } catch {
    // Ignore storage quota errors
  }
  return { stats: next, score };
}

export function loadPrefs(): PlayerPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<PlayerPrefs>;
    return {
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
      autoLockCorrect: typeof parsed.autoLockCorrect === 'boolean' ? parsed.autoLockCorrect : false,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: PlayerPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}
