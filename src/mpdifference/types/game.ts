export type PuzzleTheme =
  | 'conservatory'
  | 'lighthouse'
  | 'observatory'
  | 'cafe'
  | 'chalet'
  | 'clockshop'
  | 'mesa'
  | 'jazzrooftop';

export type PuzzleDifficulty = 'Standard' | 'Challenging' | 'Master';

export type MutationType =
  | 'color_shift'
  | 'missing'
  | 'added'
  | 'flip'
  | 'pattern_swap'
  | 'position_shift';

export type PropKind =
  | 'sunDisc'
  | 'crescentMoon'
  | 'cloudCluster'
  | 'birdFlock'
  | 'hotAirBalloon'
  | 'weathervane'
  | 'hangingLantern'
  | 'pottedMonstera'
  | 'wateringCan'
  | 'butterfly'
  | 'archWindow'
  | 'lighthouseTower'
  | 'sailboat'
  | 'seagull'
  | 'buoy'
  | 'telescope'
  | 'orrery'
  | 'constellationFrame'
  | 'owl'
  | 'bistroAwning'
  | 'bistroTable'
  | 'bicycle'
  | 'lamppost'
  | 'steamTrain'
  | 'pineTree'
  | 'chaletGable'
  | 'grandfatherClock'
  | 'pocketWatch'
  | 'gearCluster'
  | 'mesaButte'
  | 'saguaro'
  | 'clayAmphora'
  | 'waterTower'
  | 'saxophone'
  | 'vinylShelf'
  | 'catSilhouette'
  | 'teaCup'
  | 'bookStack'
  | 'flowerBox'
  | 'clockDial';

export interface SceneProp {
  id: string;
  kind: PropKind;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  variant: number; // 0, 1, 2
  flipped?: boolean;
  label: string;
}

export interface DifferenceTarget {
  id: string;
  propId: string;
  x: number;
  y: number;
  origX: number;
  origY: number;
  altX: number;
  altY: number;
  hitRadius: number;
  hitWidth: number;
  hitHeight: number;
  mutation: MutationType;
  description: string;
  altColor?: string;
  altAccent?: string;
  altVariant?: number;
  altDx?: number;
  altDy?: number;
}

export interface ThemePalette {
  skyTop: string;
  skyBottom: string;
  horizon: string;
  ground: string;
  groundAccent: string;
  structure: string;
  structureTrim: string;
  ink: string;
  warmAccent: string;
  coolAccent: string;
  highlight: string;
}

export interface DailyPuzzle {
  date: string; // YYYY-MM-DD
  issueNumber: number;
  isToday: boolean;
  title: string;
  theme: PuzzleTheme;
  themeLabel: string;
  difficulty: PuzzleDifficulty;
  parSeconds: number;
  palette: ThemePalette;
  props: SceneProp[];
  differences: DifferenceTarget[];
  seed: number;
}

export interface DifferenceCompletion {
  puzzleDate: string;
  issueNumber: number;
  title: string;
  bestScore: number;
  bestTimeSeconds: number;
  bestAccuracy: number;
  hintsUsed: number;
  mistakes: number;
  stars: 1 | 2 | 3;
  attempts: number;
  completedAtIso: string;
}

export interface ScoreBreakdown {
  baseScore: number;
  comboBonus: number;
  speedBonus: number;
  accuracyBonus: number;
  hintPenalty: number;
  mistakePenalty: number;
  finalScore: number;
  accuracy: number;
  stars: 1 | 2 | 3;
}

export type GameScreen = 'TITLE' | 'PLAYING' | 'ARCHIVE';
export type PlayOverlay = 'NONE' | 'PAUSED' | 'VICTORY';
