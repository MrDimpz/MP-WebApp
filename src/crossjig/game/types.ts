export type GameMode = 'daily' | 'mini' | 'classic' | 'master';

export type DifficultySize = 'mini' | 'classic' | 'master';

export interface ModeConfig {
  id: GameMode;
  label: string;
  shortLabel: string;
  size: DifficultySize;
  tileCols: number;
  tileRows: number;
  description: string;
  baseScore: number;
  parMoves: number;
  parSeconds: number;
}

export const MODE_CONFIGS: Record<GameMode, ModeConfig> = {
  daily: {
    id: 'daily',
    label: 'Daily',
    shortLabel: 'Daily',
    size: 'master',
    tileCols: 3,
    tileRows: 5,
    description: 'Today’s shared 3×5 crossword jigsaw',
    baseScore: 2500,
    parMoves: 18,
    parSeconds: 240,
  },
  mini: {
    id: 'mini',
    label: 'Mini 3×3',
    shortLabel: 'Mini',
    size: 'mini',
    tileCols: 3,
    tileRows: 3,
    description: '9 fragments · 9×9 grid',
    baseScore: 1200,
    parMoves: 10,
    parSeconds: 120,
  },
  classic: {
    id: 'classic',
    label: 'Classic 3×4',
    shortLabel: 'Classic',
    size: 'classic',
    tileCols: 3,
    tileRows: 4,
    description: '12 fragments · 9×12 grid',
    baseScore: 1800,
    parMoves: 14,
    parSeconds: 180,
  },
  master: {
    id: 'master',
    label: 'Master 3×5',
    shortLabel: 'Master',
    size: 'master',
    tileCols: 3,
    tileRows: 5,
    description: '15 fragments · 9×15 grid',
    baseScore: 2400,
    parMoves: 18,
    parSeconds: 240,
  },
};

export interface PuzzleTile {
  /** Stable unique ID corresponding to the tile's true solved slot index (0..tileCount-1) */
  id: number;
  /** The solved slot index (row * tileCols + col) */
  solvedIndex: number;
  /** 3x3 matrix of uppercase letters ('A'-'Z') or '#' for black square */
  cells: string[][];
}

export interface WordSpan {
  word: string;
  direction: 'across' | 'down';
  row: number;
  col: number;
  length: number;
  isValid: boolean;
  spansMultipleTiles: boolean;
}

export interface BoardValidation {
  isSolved: boolean;
  allWords: WordSpan[];
  validCrossSeamWords: WordSpan[];
  totalExpectedWords: number;
  isolatedCount: number;
}

export interface GeneratedPuzzle {
  seed: number;
  mode: GameMode;
  size: DifficultySize;
  tileCols: number;
  tileRows: number;
  /** Full solved character grid (rows x cols) */
  solvedGrid: string[][];
  /** Solved tiles indexed by solvedIndex */
  solvedTiles: PuzzleTile[];
  /** Initial scrambled arrangement: slotIndex -> tileId */
  initialOrder: number[];
  /** Target word count in the solved grid */
  targetWordCount: number;
  /** Optional date string for daily mode (YYYY-MM-DD) */
  dailyDate?: string;
}

export interface MoveRecord {
  fromSlot: number;
  toSlot: number;
}

export interface DailyArchiveRecord {
  dateStr: string;
  solved: boolean;
  bestSeconds?: number;
  bestMoves?: number;
  bestScore?: number;
  hintsUsed?: number;
  /** Saved in-progress board arrangement (slotIndex -> tileId) */
  tileOrder?: number[];
  elapsedSeconds?: number;
  movesCount?: number;
}

export interface PlayerStats {
  totalSolved: number;
  dailyStreak: number;
  bestStreak: number;
  bestScore: number;
  totalScore: number;
  lastDailyDate: string | null;
  bestTimes: Partial<Record<GameMode, number>>;
  dailyCompletedDates: string[];
  dailyArchive: Record<string, DailyArchiveRecord>;
}

export function computeCrossjigScore(
  mode: GameMode,
  elapsedSeconds: number,
  movesCount: number,
  hintsUsed: number
): number {
  const cfg = MODE_CONFIGS[mode];
  const speedBonus = Math.max(0, Math.round((cfg.parSeconds - elapsedSeconds) * 3));
  const movePenalty = Math.max(0, movesCount - cfg.parMoves) * 25;
  const moveBonus = movesCount <= cfg.parMoves ? (cfg.parMoves - movesCount) * 35 : 0;
  const hintPenalty = hintsUsed * 180;
  return Math.max(250, cfg.baseScore + speedBonus + moveBonus - movePenalty - hintPenalty);
}
