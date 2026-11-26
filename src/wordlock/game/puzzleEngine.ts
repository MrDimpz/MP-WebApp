import { COMMON_PUZZLE_WORDS, isValidWord } from './dictionary';

export type PinState = 'green' | 'amber' | 'slate';

export type GameMode = 'daily' | 'unlimited';

export type DifficultyId = 'easy' | 'standard' | 'hard' | 'master';

export type GameStatus = 'playing' | 'unlocking' | 'won' | 'lost';

export interface DifficultyConfig {
  id: DifficultyId;
  label: string;
  shortLabel: string;
  rowCount: 5 | 7;
  maxClicks: number;
  parMin: number;
  parMax: number;
  description: string;
}

export const DIFFICULTY_LIST: DifficultyConfig[] = [
  {
    id: 'easy',
    label: 'Easy',
    shortLabel: 'Easy',
    rowCount: 5,
    maxClicks: 15,
    parMin: 4,
    parMax: 5,
    description: '5 rows · 15 clicks · gentler scramble',
  },
  {
    id: 'standard',
    label: 'Standard',
    shortLabel: 'Std',
    rowCount: 5,
    maxClicks: 12,
    parMin: 5,
    parMax: 8,
    description: '5 rows · 12 clicks · classic vault',
  },
  {
    id: 'hard',
    label: 'Hard',
    shortLabel: 'Hard',
    rowCount: 7,
    maxClicks: 16,
    parMin: 8,
    parMax: 10,
    description: '7 rows · 16 clicks · extended conveyor',
  },
  {
    id: 'master',
    label: 'Master',
    shortLabel: 'Master',
    rowCount: 7,
    maxClicks: 13,
    parMin: 9,
    parMax: 12,
    description: '7 rows · 13 clicks · tight margin',
  },
];

export const DIFFICULTY_CONFIGS: Record<DifficultyId, DifficultyConfig> = {
  easy: DIFFICULTY_LIST[0],
  standard: DIFFICULTY_LIST[1],
  hard: DIFFICULTY_LIST[2],
  master: DIFFICULTY_LIST[3],
};

export const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'standard', 'hard', 'master'];

export const ARCHIVE_DAYS_COUNT = 183;

export interface PuzzleDefinition {
  id: string;
  label: string;
  mode: GameMode;
  difficulty: DifficultyId;
  dailyIndex?: number; // Daily puzzle number
  dateKey?: string; // YYYY-MM-DD for calendar daily/archive puzzles
  /** Number of visible rows & unique letters per wheel (5 or 7) */
  rowCount: 5 | 7;
  /** Center row index containing the secret Master Key (2 for 5-row, 3 for 7-row) */
  masterRowIndex: number;
  /** Click budget for this lock */
  maxClicks: number;
  /** Solved 4-letter words (index `masterRowIndex` is the secret Master Key) */
  solutionWords: string[];
  /** 4 wheels, each with `rowCount` unique letters */
  wheels: [string[], string[], string[], string[]];
  /** The secret Master Key (solutionWords[masterRowIndex]) */
  masterKey: string;
  /** Starting integer offsets per wheel */
  startOffsets: [number, number, number, number];
  /** Exact minimum number of clicks required to reach the solved state */
  par: number;
}

export interface BoardEvaluation {
  rows: string[];
  rowValid: boolean[];
  masterKeyPins: [PinState, PinState, PinState, PinState];
  allRowsValid: boolean;
  isMasterKeyMatched: boolean;
  isSolved: boolean;
}

export const MAX_CLICKS = 12;

interface HandcraftedSeed {
  words: [string, string, string, string, string];
  startOffsets: [number, number, number, number];
  easyOffsets: [number, number, number, number];
}

const HANDCRAFTED_DAILY_SEEDS: HandcraftedSeed[] = [
  { words: ['TIME', 'DARK', 'GOLD', 'SPIN', 'CHEF'], startOffsets: [2, -1, 2, -1], easyOffsets: [1, -1, 2, -1] }, // PAR 6 / 5
  { words: ['STAR', 'MIND', 'LOCK', 'BLUE', 'FAWN'], startOffsets: [-1, 2, -1, 2], easyOffsets: [-1, 1, -1, 1] }, // PAR 6 / 4
  { words: ['IRON', 'CLUB', 'SAFE', 'MYTH', 'WORD'], startOffsets: [1, -2, 1, -1], easyOffsets: [1, -1, 1, -1] }, // PAR 5 / 4
  { words: ['BANK', 'FILM', 'CODE', 'SHUT', 'GRIP'], startOffsets: [-2, 2, -1, 2], easyOffsets: [-1, 2, -1, 1] }, // PAR 7 / 5
  { words: ['FIRE', 'SAND', 'BOLT', 'PLUG', 'WREN'], startOffsets: [2, -1, -2, 1], easyOffsets: [1, -1, -1, 1] }, // PAR 6 / 4
  { words: ['GATE', 'DRUM', 'COIN', 'KELP', 'WISH'], startOffsets: [-2, -2, 2, -1], easyOffsets: [-1, -2, 1, -1] }, // PAR 7 / 5
  { words: ['MINT', 'PLOW', 'GEAR', 'DUSK', 'CHEF'], startOffsets: [1, 2, -1, 1], easyOffsets: [1, 1, -1, 1] }, // PAR 5 / 4
  { words: ['NOTE', 'BRIG', 'DIAL', 'SPUN', 'FARM'], startOffsets: [-2, 2, -2, 2], easyOffsets: [-1, 2, -1, 1] }, // PAR 8 / 5
  { words: ['OPEN', 'RING', 'KEYS', 'CAMP', 'BLUR'], startOffsets: [2, -2, 1, -1], easyOffsets: [1, -1, 1, -1] }, // PAR 6 / 4
  { words: ['WIND', 'ECHO', 'TURN', 'JADE', 'SLIM'], startOffsets: [-1, 2, 2, -2], easyOffsets: [-1, 1, 2, -1] }, // PAR 7 / 5
];

/** Guaranteed unique-column 7-word fallback for Hard & Master modes */
const FALLBACK_SEVEN_ROW_WORDS: string[] = [
  'TIME',
  'DARK',
  'GOLD',
  'SPIN',
  'CHEF',
  'BUZZ',
  'LYNX',
];

/** Fast deterministic PRNG (Mulberry32) for reproducible Daily locks across difficulties */
function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Compute shortest rotation distance on an N-row conveyor loop for an integer step offset */
export function shortestWheelClicks(offset: number, rowCount: number): number {
  const mod = ((offset % rowCount) + rowCount) % rowCount;
  return Math.min(mod, rowCount - mod);
}

/** Build the 4 wheel arrays from `rowCount` solved horizontal words */
function wordsToWheels(words: string[]): [string[], string[], string[], string[]] {
  const wheels: [string[], string[], string[], string[]] = [[], [], [], []];
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < words.length; row++) {
      wheels[col].push(words[row][col]);
    }
  }
  return wheels;
}

/** Verify no column has duplicate letters across all rows */
export function hasUniqueColumns(words: string[], expectedRows: number): boolean {
  if (words.length !== expectedRows) return false;
  for (let col = 0; col < 4; col++) {
    const seen = new Set<string>();
    for (let row = 0; row < expectedRows; row++) {
      const ch = words[row][col];
      if (seen.has(ch)) return false;
      seen.add(ch);
    }
  }
  return true;
}

/** Compute exact Par for a starting offset vector */
export function computePar(
  offsets: [number, number, number, number],
  rowCount: number
): number {
  return offsets.reduce((sum, off) => sum + shortestWheelClicks(off, rowCount), 0);
}

/** Pick `rowCount` common 4-letter English words with strictly unique letters in each column */
function generateWordStack(rowCount: 5 | 7, rng: () => number): string[] {
  const pool = COMMON_PUZZLE_WORDS;
  const n = pool.length;
  const maxAttempts = rowCount === 7 ? 700 : 400;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const selected: string[] = [];
    const colUsed: [Set<string>, Set<string>, Set<string>, Set<string>] = [
      new Set(),
      new Set(),
      new Set(),
      new Set(),
    ];

    const first = pool[Math.floor(rng() * n)];
    selected.push(first);
    for (let c = 0; c < 4; c++) colUsed[c].add(first[c]);

    let ok = true;
    for (let row = 1; row < rowCount; row++) {
      const startIdx = Math.floor(rng() * n);
      let found: string | null = null;
      for (let step = 0; step < n; step++) {
        const candidate = pool[(startIdx + step) % n];
        if (
          !colUsed[0].has(candidate[0]) &&
          !colUsed[1].has(candidate[1]) &&
          !colUsed[2].has(candidate[2]) &&
          !colUsed[3].has(candidate[3])
        ) {
          found = candidate;
          break;
        }
      }
      if (!found) {
        ok = false;
        break;
      }
      selected.push(found);
      for (let c = 0; c < 4; c++) colUsed[c].add(found[c]);
    }

    if (ok && hasUniqueColumns(selected, rowCount)) {
      return selected;
    }
  }

  return rowCount === 7
    ? [...FALLBACK_SEVEN_ROW_WORDS]
    : [...HANDCRAFTED_DAILY_SEEDS[0].words];
}

/** Generate scramble offsets whose exact shortest-path Par lies in [parMin, parMax] */
function generateOffsets(
  config: DifficultyConfig,
  rng: () => number
): [number, number, number, number] {
  const maxPerWheel = Math.floor(config.rowCount / 2); // 2 for 5-row, 3 for 7-row
  const span = config.parMax - config.parMin + 1;
  const targetPar = config.parMin + Math.floor(rng() * span);

  const magnitudes: [number, number, number, number] = [1, 1, 1, 1];
  let remaining = Math.max(0, targetPar - 4);

  // Shuffle wheel order to distribute additional offsets fairly
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  let cursor = 0;
  let guard = 0;
  while (remaining > 0 && guard < 32) {
    const idx = order[cursor % 4];
    if (magnitudes[idx] < maxPerWheel) {
      magnitudes[idx] += 1;
      remaining -= 1;
    }
    cursor += 1;
    guard += 1;
  }

  return magnitudes.map((mag) => (rng() < 0.5 ? mag : -mag)) as [
    number,
    number,
    number,
    number,
  ];
}

const dailyPuzzleCache = new Map<string, PuzzleDefinition>();

/** Build a Daily Showcase puzzle (1..10) tailored to the selected difficulty (cached O(1)) */
export function getDailyPuzzle(
  dailyNumber: number,
  difficulty: DifficultyId = 'standard'
): PuzzleDefinition {
  const config = DIFFICULTY_CONFIGS[difficulty];
  const clamped =
    (((dailyNumber - 1) % HANDCRAFTED_DAILY_SEEDS.length) + HANDCRAFTED_DAILY_SEEDS.length) %
    HANDCRAFTED_DAILY_SEEDS.length;
  const cacheKey = `${clamped + 1}-${difficulty}`;
  const cached = dailyPuzzleCache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      startOffsets: [...cached.startOffsets] as [number, number, number, number],
    };
  }

  const masterRowIndex = Math.floor(config.rowCount / 2);

  if (config.rowCount === 5) {
    const seed = HANDCRAFTED_DAILY_SEEDS[clamped];
    const startOffsets =
      difficulty === 'easy'
        ? ([...seed.easyOffsets] as [number, number, number, number])
        : ([...seed.startOffsets] as [number, number, number, number]);
    const words = [...seed.words];
    const wheels = wordsToWheels(words);
    const par = computePar(startOffsets, 5);

    const def: PuzzleDefinition = {
      id: `daily-${clamped + 1}-${difficulty}`,
      label: `Daily #${clamped + 1}`,
      mode: 'daily',
      difficulty,
      dailyIndex: clamped + 1,
      rowCount: 5,
      masterRowIndex,
      maxClicks: config.maxClicks,
      solutionWords: words,
      wheels,
      masterKey: words[masterRowIndex],
      startOffsets,
      par,
    };
    dailyPuzzleCache.set(cacheKey, def);
    return { ...def, startOffsets: [...def.startOffsets] as [number, number, number, number] };
  }

  // Deterministic 7-row Daily lock seeded by daily index + difficulty
  const salt = difficulty === 'master' ? 9973 : 4219;
  const rng = createSeededRng((clamped + 1) * 7919 + salt);
  const words = generateWordStack(7, rng);
  const startOffsets = generateOffsets(config, rng);
  const wheels = wordsToWheels(words);
  const par = computePar(startOffsets, 7);

  const def: PuzzleDefinition = {
    id: `daily-${clamped + 1}-${difficulty}`,
    label: `Daily #${clamped + 1}`,
    mode: 'daily',
    difficulty,
    dailyIndex: clamped + 1,
    rowCount: 7,
    masterRowIndex,
    maxClicks: config.maxClicks,
    solutionWords: words,
    wheels,
    masterKey: words[masterRowIndex],
    startOffsets,
    par,
  };
  dailyPuzzleCache.set(cacheKey, def);
  return { ...def, startOffsets: [...def.startOffsets] as [number, number, number, number] };
}

/** Deterministic daily puzzle index (1..10) seeded by today's calendar date */
export function getTodayDailyNumber(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / 86_400_000);
  return (dayOfYear % HANDCRAFTED_DAILY_SEEDS.length) + 1;
}

export const DAILY_COUNT = HANDCRAFTED_DAILY_SEEDS.length;

/** Format a local Date as YYYY-MM-DD */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayDateKey(): string {
  return formatDateKey(new Date());
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function getRecentDateKeys(count = ARCHIVE_DAYS_COUNT, todayKey = getTodayDateKey()): string[] {
  const base = parseDateKey(todayKey);
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(base);
    dt.setDate(base.getDate() - i);
    keys.push(formatDateKey(dt));
  }
  return keys;
}

export function getDailyNumberForDate(dateKey: string): number {
  const anchor = Date.UTC(2025, 0, 1);
  const [y, m, d] = dateKey.split('-').map(Number);
  const target = Date.UTC(y, (m || 1) - 1, d || 1);
  const diffDays = Math.floor((target - anchor) / 86_400_000);
  return Math.max(1, diffDays + 1);
}

export function formatShortDisplayDate(dateKey: string): string {
  const dt = parseDateKey(dateKey);
  return dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function hashStringToSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const dateDailyCache = new Map<string, PuzzleDefinition>();

/**
 * Deterministic calendar-based Daily/Archive Wordlock generator (183-day 6-month archive).
 * Each dateKey + difficulty yields a reproducible, guaranteed-solvable 5-row or 7-row lock.
 */
export function getDailyPuzzleByDate(
  dateKey: string,
  difficulty: DifficultyId = 'standard'
): PuzzleDefinition {
  const cacheKey = `${dateKey}::${difficulty}`;
  const cached = dateDailyCache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      startOffsets: [...cached.startOffsets] as [number, number, number, number],
    };
  }

  const config = DIFFICULTY_CONFIGS[difficulty];
  const masterRowIndex = Math.floor(config.rowCount / 2);
  const dailyNum = getDailyNumberForDate(dateKey);

  // Share the same 5-word stack for Easy & Standard on a given day (different scramble par),
  // and the same 7-word stack for Hard & Master on a given day (different click budget & par).
  const wordSeed = hashStringToSeed(`mp-wordlock-words-${dateKey}-${config.rowCount}r`);
  const wordRng = createSeededRng(wordSeed);
  const words = generateWordStack(config.rowCount, wordRng);

  const offsetSeed = hashStringToSeed(`mp-wordlock-offsets-${dateKey}-${difficulty}`);
  const offsetRng = createSeededRng(offsetSeed);
  const startOffsets = generateOffsets(config, offsetRng);
  const wheels = wordsToWheels(words);
  const par = computePar(startOffsets, config.rowCount);

  const def: PuzzleDefinition = {
    id: `daily-${dateKey}-${difficulty}`,
    label: `Daily #${dailyNum}`,
    mode: 'daily',
    difficulty,
    dailyIndex: dailyNum,
    dateKey,
    rowCount: config.rowCount,
    masterRowIndex,
    maxClicks: config.maxClicks,
    solutionWords: words,
    wheels,
    masterKey: words[masterRowIndex],
    startOffsets,
    par,
  };
  dateDailyCache.set(cacheKey, def);
  return { ...def, startOffsets: [...def.startOffsets] as [number, number, number, number] };
}

export function getProgressKey(dateKey: string, difficulty: DifficultyId): string {
  return `${dateKey}__${difficulty}`;
}

export function computeWordlockScore(
  puzzle: PuzzleDefinition,
  clicksUsed: number
): number {
  const baseByDiff: Record<DifficultyId, number> = {
    easy: 650,
    standard: 1000,
    hard: 1550,
    master: 2250,
  };
  const remainingBonus = Math.max(0, puzzle.maxClicks - clicksUsed) * 120;
  const parBonus =
    clicksUsed <= puzzle.par ? 500 : clicksUsed <= puzzle.par + 2 ? 250 : 0;
  return baseByDiff[puzzle.difficulty] + remainingBonus + parBonus;
}

/**
 * Guaranteed-Solvable Reverse-Engineering Puzzle Generator for any difficulty (5 or 7 rows).
 */
export function generateUnlimitedPuzzle(
  sequenceNumber = 1,
  difficulty: DifficultyId = 'standard'
): PuzzleDefinition {
  const config = DIFFICULTY_CONFIGS[difficulty];
  const masterRowIndex = Math.floor(config.rowCount / 2);
  const rng = Math.random;

  const chosen = generateWordStack(config.rowCount, rng);
  const startOffsets = generateOffsets(config, rng);
  const wheels = wordsToWheels(chosen);
  const par = computePar(startOffsets, config.rowCount);

  return {
    id: `unlimited-${difficulty}-${Date.now()}-${sequenceNumber}`,
    label: `Unlimited #${sequenceNumber}`,
    mode: 'unlimited',
    difficulty,
    rowCount: config.rowCount,
    masterRowIndex,
    maxClicks: config.maxClicks,
    solutionWords: chosen,
    wheels,
    masterKey: chosen[masterRowIndex],
    startOffsets,
    par,
  };
}

/**
 * Wordle-style Master Key pin evaluator for the center row against the hidden Master Key.
 * Properly handles duplicate letters using a two-pass frequency table.
 */
export function evaluateMasterKeyPins(
  centerWord: string,
  masterKey: string
): [PinState, PinState, PinState, PinState] {
  const result: [PinState, PinState, PinState, PinState] = ['slate', 'slate', 'slate', 'slate'];
  const remainingCounts: Record<string, number> = {};

  // Pass 1: exact matches (Emerald Green)
  for (let i = 0; i < 4; i++) {
    if (centerWord[i] === masterKey[i]) {
      result[i] = 'green';
    } else {
      const k = masterKey[i];
      remainingCounts[k] = (remainingCounts[k] ?? 0) + 1;
    }
  }

  // Pass 2: misplaced letters (Amber Yellow)
  for (let i = 0; i < 4; i++) {
    if (result[i] === 'green') continue;
    const ch = centerWord[i];
    if ((remainingCounts[ch] ?? 0) > 0) {
      result[i] = 'amber';
      remainingCounts[ch] -= 1;
    }
  }

  return result;
}

/**
 * Evaluate all visible rows (5 or 7) and Master Key pin states for a given wheel offset array.
 * Formula: faceIndex = ((row + wheelSteps[col]) % rowCount + rowCount) % rowCount
 */
export function evaluateBoard(
  puzzle: PuzzleDefinition,
  wheelSteps: [number, number, number, number]
): BoardEvaluation {
  const rows: string[] = [];
  const rowValid: boolean[] = [];
  const rowCount = puzzle.rowCount;

  for (let row = 0; row < rowCount; row++) {
    let word = '';
    for (let col = 0; col < 4; col++) {
      const faceIdx = (((row + wheelSteps[col]) % rowCount) + rowCount) % rowCount;
      word += puzzle.wheels[col][faceIdx];
    }
    rows.push(word);
    rowValid.push(isValidWord(word));
  }

  const centerWord = rows[puzzle.masterRowIndex];
  const masterKeyPins = evaluateMasterKeyPins(centerWord, puzzle.masterKey);
  const allRowsValid = rowValid.every(Boolean);
  const isMasterKeyMatched = centerWord === puzzle.masterKey;
  const isSolved = allRowsValid && isMasterKeyMatched;

  return {
    rows,
    rowValid,
    masterKeyPins,
    allRowsValid,
    isMasterKeyMatched,
    isSolved,
  };
}

export function getLocksmithRank(
  won: boolean,
  clicksUsed: number,
  par: number,
  rowCount = 5
): { title: string; subtitle: string; tier: 'master' | 'expert' | 'solved' | 'locked' } {
  if (!won) {
    return {
      title: 'VAULT LOCKED',
      subtitle: 'Click budget exhausted before the tumblers aligned.',
      tier: 'locked',
    };
  }
  if (clicksUsed <= par) {
    return {
      title: 'MASTER LOCKSMITH',
      subtitle: 'Solved at optimal mechanical efficiency.',
      tier: 'master',
    };
  }
  if (clicksUsed <= par + 2) {
    return {
      title: 'PRECISION CRACKER',
      subtitle: 'Clean deduction within two clicks of Par.',
      tier: 'expert',
    };
  }
  return {
    title: 'VAULT BREACHED',
    subtitle: `All ${rowCount} tumbler rows aligned under budget.`,
    tier: 'solved',
  };
}

/** Build a shareable emoji keycard string for clipboard export */
export function buildShareableKeycard(
  puzzle: PuzzleDefinition,
  won: boolean,
  clicksUsed: number,
  evaluation: BoardEvaluation
): string {
  const diffConfig = DIFFICULTY_CONFIGS[puzzle.difficulty];
  const rank = getLocksmithRank(won, clicksUsed, puzzle.par, puzzle.rowCount);
  const scoreText = won
    ? `${clicksUsed}/${puzzle.maxClicks} Clicks`
    : `X/${puzzle.maxClicks} Locked`;

  const gridLines = evaluation.rows.map((_, rowIdx) => {
    if (rowIdx === puzzle.masterRowIndex) {
      const pins = evaluation.masterKeyPins
        .map((p) => (p === 'green' ? '🟩' : p === 'amber' ? '🟨' : '⬛'))
        .join('');
      return `${pins} 🔑`;
    }
    const valid = evaluation.rowValid[rowIdx];
    return valid ? '🟧🟧🟧🟧' : '⬛⬛⬛⬛';
  });

  return [
    `The Missing Piece · WORDLOCK ${puzzle.label} (${diffConfig.label} · ${puzzle.rowCount}R)`,
    `${scoreText} · PAR ${puzzle.par} · ${rank.title}`,
    '',
    ...gridLines,
    '',
    'missingpiecepuzzles.fun/solo-games/wordlock',
  ].join('\n');
}
