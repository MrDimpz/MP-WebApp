export type ClueDifficulty = 'easy' | 'medium' | 'hard';

export type GridSizeOption = 8 | 20;

export type VisualThemeId = 'editorial' | 'observatory' | 'botanical' | 'mahogany';

export type EditionType = 'quick-8x8' | 'standard-20x20';

export interface VisualTheme {
  id: VisualThemeId;
  name: string;
  subtitle: string;
  bgCanvas: string;
  bgSurface: string;
  bgElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSubtle: string;
  gridBlocked: string;
  gridCellBg: string;
  gridCellActiveWord: string;
  gridCellFocused: string;
  gridCellText: string;
  gridCellFocusedText: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
}

export interface GridCellData {
  row: number;
  col: number;
  isBlocked: boolean;
  solution: string;
  number?: number;
}

export interface PlacedClue {
  id: string;
  number: number;
  direction: 'across' | 'down';
  row: number;
  col: number;
  length: number;
  answer: string;
  standardClue: string;
  easyClue: string;
  mediumClue: string;
  hardClue: string;
  crypticClue: string;
}

export interface PuzzleDefinition {
  id: string;
  title: string;
  subtitle: string;
  themeName: string;
  editionType: EditionType;
  editionDate: string;
  archiveDate: string;
  gridSize: GridSizeOption;
  recommendedVisualTheme: VisualThemeId;
  grid: GridCellData[][];
  clues: {
    across: PlacedClue[];
    down: PlacedClue[];
  };
  totalWhiteCells: number;
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  puzzleId: string;
  puzzleTitle: string;
  themeName: string;
  gridSize: GridSizeOption;
  score: number;
  timeSeconds: number;
  hintsUsed: number;
  easiestDifficultyUsed: ClueDifficulty;
  clueDifficulty: ClueDifficulty;
  accuracy: number;
  completedAt: string;
  isCloudSynced: boolean;
}
