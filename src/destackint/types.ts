export type GameState = 'TITLE' | 'PLAYING' | 'VICTORY' | 'ARCHIVE' | 'LEADERBOARD' | 'STATS' | 'HOW_TO_PLAY';

export type DifficultyMode = 'normal' | 'hard';

export type LayoutMode = 'daily' | 'pyramid' | 'twin_towers' | 'cross_fortress' | 'hourglass' | 'staircase';

export type TimerDuration = 30 | 45 | 60;

export interface TileData {
  id: string;
  letter: string;
  x: number; // percentage (0-100)
  y: number;
  layer: number; // 0-3 in normal mode, 0-5 in hard mode (higher sits on top)
  coveredBy: string[]; // IDs of tiles covering this tile
  isExposed: boolean;
  inRackIndex?: number | null; // 0-4 if currently in rack
  isCleared?: boolean;
}

export interface WordPuzzle {
  id: string; // e.g. "2026-11-13"
  difficulty: DifficultyMode;
  totalLayers: number; // 4 for normal, 6 for hard
  dayIndex: number; // Day number in archive
  dateString: string;
  words: string[]; // 6 words (30 tiles) in normal, 10 words (50 tiles) in hard
  hints: string[]; // hint for each word
  tiles: TileData[];
}

export interface CompletedDayRecord {
  timeSeconds: number;
  hintsUsed: number;
  score: number;
  difficulty?: DifficultyMode;
}

export interface GameStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  bestTimeSeconds: number;
  totalHintsUsed: number;
  completedDays: Record<string, CompletedDayRecord>;
  completedHardDays?: Record<string, CompletedDayRecord>;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  timeSeconds: number;
  hintsUsed: number;
  date: string;
  difficulty?: DifficultyMode;
}

export interface PlayerAnswerRecord {
  wordIndex: number;
  word: string;
  points: number;
  solveTimeSeconds: number;
  rankInWord: number; // 1st, 2nd, 3rd... to solve this specific word
  timestamp: number;
}

export interface RunningScoreboardPlayer {
  id: string; // uniqueId
  nickname: string;
  profilePictureUrl: string;
  totalScore: number;
  wordsSolved: number;
  bestSpeedSeconds: number;
  totalSpeedSeconds: number;
  lastPoints: number;
  lastSolveTimeSeconds: number;
  lastWordIndex: number;
  firstPlaceCount: number; // how many words they were 1st on
  answers: PlayerAnswerRecord[];
  updatedAt: number;
}

export interface LiveChatItem {
  id: string;
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
  comment: string;
  isCorrectAnswer?: boolean;
  pointsEarned?: number;
  solveTimeSeconds?: number;
  rankInWord?: number;
  isCommand?: boolean;
  timestamp: number;
}
