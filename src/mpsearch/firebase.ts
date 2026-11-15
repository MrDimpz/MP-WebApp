import { getCurrentUserSessionPrefix } from '@/lib/unified-game-auth';

export interface LocalPuzzleProgress {
  dateKey: string;
  puzzleNumber: number;
  themeTitle: string;
  category: string;
  foundWords: string[];
  totalWords: number;
  elapsedSeconds: number;
  bestTimeSeconds: number;
  highScore: number;
  hintsUsed: number;
  completedCount: number;
  updatedAtIso: string;
  existsInCloud?: boolean;
}

const LEGACY_PROGRESS_KEY = 'lexicon10_progress_v1';

export function getProgressStorageKey(): string {
  return `mp_search_progress_v1_${getCurrentUserSessionPrefix()}`;
}

export function readStoredProgressMap(): Record<string, LocalPuzzleProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const key = getProgressStorageKey();
    const raw = window.localStorage.getItem(key) || window.localStorage.getItem(LEGACY_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeStoredProgressMap(map: Record<string, LocalPuzzleProgress>): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(map);
    window.localStorage.setItem(getProgressStorageKey(), serialized);
    window.localStorage.setItem(LEGACY_PROGRESS_KEY, serialized);
  } catch {
    // Ignore storage quota errors
  }
}
