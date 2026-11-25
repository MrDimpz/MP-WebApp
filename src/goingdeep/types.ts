export type TierId = 'amber' | 'moss' | 'surf' | 'void';

export type MiniGameType = 'letterlock' | 'anagram' | 'crossword' | 'wordsearch';

export type DifficultyLevel = 'standard' | 'hard' | 'expert';

export interface DifficultyConfig {
  id: DifficultyLevel;
  label: string;
  keyCount: 4 | 8 | 12;
  keysPerType: 1 | 2 | 3;
  maxBoardMistakes: number;
  letterLockAttempts: number;
  letterLockStrict: boolean;
  wordSearchGridSize: number;
  allowReverseWordSearch: boolean;
  summary: string;
}

export interface TierMeta {
  id: TierId;
  name: string;
  difficulty: string;
  rank: 1 | 2 | 3 | 4;
  emoji: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  swatchHex: string;
}

export interface CategoryGroup {
  tier: TierId;
  title: string;
  words: [string, string, string, string];
  lockedWords: string[];
}

export interface LetterLockData {
  word: string;
  clue: string;
  maxAttempts: number;
  strictMode: boolean;
}

export interface AnagramData {
  word: string;
  scrambled: string;
  clue: string;
}

export interface CrosswordClueRow {
  answer: string;
  intersectIndex: number;
  clue: string;
}

export interface CrosswordData {
  word: string;
  clue: string;
  rows: CrosswordClueRow[];
}

export interface WordSearchData {
  word: string;
  clue: string;
  gridSize: number;
  startRow: number;
  startCol: number;
  deltaRow: -1 | 0 | 1;
  deltaCol: -1 | 0 | 1;
  denseDecoys: boolean;
}

export interface MiniGameInstance {
  keyId: string; // e.g., "letterlock-0", "anagram-1"
  type: MiniGameType;
  indexInType: number; // 0-based index within this mini-game type
  word: string;
  tier: TierId;
  letterlock?: LetterLockData;
  anagram?: AnagramData;
  crossword?: CrosswordData;
  wordsearch?: WordSearchData;
}

export interface PuzzleData {
  id: number;
  dateKey: string; // YYYY-MM-DD
  dateDisplay: string; // e.g., "Nov 25, 2026"
  dateLabel: string;
  subtitle: string;
  difficulty: DifficultyLevel;
  maxMistakes: number;
  categories: [CategoryGroup, CategoryGroup, CategoryGroup, CategoryGroup];
  miniGames: MiniGameInstance[];
}

export type MiniGameStatus = 'locked' | 'solved' | 'revealed';

export interface MiniGameProgress {
  status: MiniGameStatus;
  hintsUsed: number;
  letterLockGuesses?: string[];
}

export interface GuessHistoryEntry {
  words: string[];
  tiers: TierId[];
  correct: boolean;
}

export interface PuzzleProgress {
  progressKey: string; // `${dateKey}__${difficulty}`
  puzzleId: number;
  dateKey: string;
  difficulty: DifficultyLevel;
  status: 'in_progress' | 'won' | 'lost';
  mistakesRemaining: number;
  maxMistakes: number;
  solvedTiers: TierId[];
  tileOrder: string[];
  guesses: GuessHistoryEntry[];
  miniGames: Record<string, MiniGameProgress>; // keyed by MiniGameInstance.keyId
  elapsedSeconds: number;
  completedAt?: number;
}

export interface GameStats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  perfectGames: number;
  mistakeDistribution: [number, number, number, number, number]; // 0, 1, 2, 3, 4 mistakes on wins
  miniGamesSolved: Record<MiniGameType, number>;
  winsByDifficulty: Record<DifficultyLevel, number>;
}
