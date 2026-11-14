export type GameView =
  | 'TITLE'
  | 'PLAYING'
  | 'ARCHIVE'
  | 'LEADERBOARD'
  | 'STATS'
  | 'HOW_TO_PLAY';

export interface PuzzleProgressRecord {
  puzzleDate: string;
  boardLetters: string[];
  hintIndices: number[];
  elapsedSec: number;
  hintsUsed: number;
  mistakes: number;
  score?: number;
  status: 'in_progress' | 'completed';
  completedAt?: number;
}

export interface UnolingoStats {
  currentStreak: number;
  longestStreak: number;
  totalSolved: number;
  bestTimeSec: number;
  totalHintsUsed: number;
  totalMistakes: number;
  lastDailyStreakDate: string;
}

export interface UnolingoPrefs {
  soundEnabled: boolean;
  autoCheck: boolean;
}

export interface UndoSnapshot {
  boardLetters: string[];
  selectedCell: { r: number; c: number } | null;
}

export interface UnolingoVictoryData {
  puzzleDate: string;
  elapsedSec: number;
  hintsUsed: number;
  mistakes: number;
  score: number;
  isDailyStreakAdvance: boolean;
  isDailyPuzzle?: boolean;
  isNewHighScore?: boolean;
}
