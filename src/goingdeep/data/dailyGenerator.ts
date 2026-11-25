import {
  CategoryGroup,
  CrosswordClueRow,
  DifficultyConfig,
  DifficultyLevel,
  MiniGameInstance,
  MiniGameType,
  PuzzleData,
  TierId,
  TierMeta,
  WordSearchData,
} from '../types';
import { CATEGORY_BANK, CategoryBankEntry, WordEntry } from './puzzleBank';
import { CROSSWORD_LEXICON } from './crosswordLexicon';

export const TIER_ORDER: TierId[] = ['amber', 'moss', 'surf', 'void'];

export const TIERS: Record<TierId, TierMeta> = {
  amber: {
    id: 'amber',
    name: 'Gold',
    difficulty: 'Straightforward',
    rank: 1,
    emoji: '🟨',
    bgClass: 'bg-[#F6C915] dark:bg-[#EAB308]',
    textClass: 'text-[#1D0830] dark:text-[#180528]',
    borderClass: 'border-[#D4A437] dark:border-[#CA9A04]',
    swatchHex: '#F6C915',
  },
  moss: {
    id: 'moss',
    name: 'Emerald',
    difficulty: 'Moderate',
    rank: 2,
    emoji: '🟩',
    bgClass: 'bg-[#2E7D52] dark:bg-[#286E48]',
    textClass: 'text-white dark:text-[#F2FFF8]',
    borderClass: 'border-[#21613E] dark:border-[#3FA06C]',
    swatchHex: '#2E7D52',
  },
  surf: {
    id: 'surf',
    name: 'Sapphire',
    difficulty: 'Tricky',
    rank: 3,
    emoji: '🟦',
    bgClass: 'bg-[#2C6FB0] dark:bg-[#255F9A]',
    textClass: 'text-white dark:text-[#F2F8FF]',
    borderClass: 'border-[#1F5489] dark:border-[#498ED4]',
    swatchHex: '#2C6FB0',
  },
  void: {
    id: 'void',
    name: 'Royal',
    difficulty: 'Devious',
    rank: 4,
    emoji: '🟪',
    bgClass: 'bg-[#4D1475] dark:bg-[#6D28D9]',
    textClass: 'text-[#FFF9E6] dark:text-[#FAF7FF]',
    borderClass: 'border-[#340A54] dark:border-[#9363F8]',
    swatchHex: '#4D1475',
  },
};

export interface MiniGameMeta {
  id: MiniGameType;
  label: string;
  shortLabel: string;
  description: string;
}

export const MINI_GAME_ORDER: MiniGameType[] = [
  'letterlock',
  'anagram',
  'crossword',
  'wordsearch',
];

export const MINI_GAME_META: Record<MiniGameType, MiniGameMeta> = {
  letterlock: {
    id: 'letterlock',
    label: 'LetterLock',
    shortLabel: 'LetterLock',
    description: 'Deduce the hidden word using color-coded letter feedback.',
  },
  anagram: {
    id: 'anagram',
    label: 'Anagram',
    shortLabel: 'Anagram',
    description: 'Rearrange the scrambled tiles to uncover the hidden word.',
  },
  crossword: {
    id: 'crossword',
    label: 'Crossword',
    shortLabel: 'Crossword',
    description: 'Solve intersecting across clues to reveal the vertical key word.',
  },
  wordsearch: {
    id: 'wordsearch',
    label: 'Word Search',
    shortLabel: 'Word Search',
    description: 'Trace the hidden word inside the letter grid.',
  },
};

export const DIFFICULTY_ORDER: DifficultyLevel[] = ['standard', 'hard', 'expert'];

export const DIFFICULTIES: Record<DifficultyLevel, DifficultyConfig> = {
  standard: {
    id: 'standard',
    label: 'Standard',
    keyCount: 4,
    keysPerType: 1,
    maxBoardMistakes: 4,
    letterLockAttempts: 6,
    letterLockStrict: false,
    wordSearchGridSize: 7,
    allowReverseWordSearch: false,
    summary: '4 keys · 7×7 grid · 4 mistakes',
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    keyCount: 8,
    keysPerType: 2,
    maxBoardMistakes: 4,
    letterLockAttempts: 5,
    letterLockStrict: false,
    wordSearchGridSize: 8,
    allowReverseWordSearch: true,
    summary: '8 keys · 8×8 grid · 4 mistakes',
  },
  expert: {
    id: 'expert',
    label: 'Expert',
    keyCount: 12,
    keysPerType: 3,
    maxBoardMistakes: 4,
    letterLockAttempts: 5,
    letterLockStrict: true,
    wordSearchGridSize: 9,
    allowReverseWordSearch: true,
    summary: '12 keys · 9×9 grid · 4 mistakes',
  },
};

// ==================== DATE HELPERS ====================

const EPOCH_DATE_UTC = Date.UTC(2026, 7, 14); // 2026-08-14 -> 2026-11-25 is #104

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayDateKey(): string {
  return formatDateKey(new Date());
}

export function parseDateKeyUTC(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function getDailyNumber(dateKey: string): number {
  const diffMs = parseDateKeyUTC(dateKey) - EPOCH_DATE_UTC;
  const days = Math.floor(diffMs / 86_400_000);
  return Math.max(1, days + 1);
}

export function formatHumanDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getRecentDateKeys(count = 14): string[] {
  const today = new Date();
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    keys.push(formatDateKey(dt));
  }
  return keys;
}

export function getMillisecondsUntilMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  );
  return Math.max(0, tomorrow.getTime() - now.getTime());
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ==================== DETERMINISTIC PRNG ====================

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRand<T>(items: T[], rand: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function scrambleWord(word: string, rand: () => number): string {
  const letters = word.split('');
  for (let attempt = 0; attempt < 18; attempt++) {
    const shuffled = shuffleWithRand(letters, rand);
    const candidate = shuffled.join('');
    if (candidate !== word) {
      // On harder scrambles, avoid leaving too many characters in their original index
      let samePos = 0;
      for (let i = 0; i < word.length; i++) {
        if (candidate[i] === word[i]) samePos++;
      }
      if (samePos <= Math.floor(word.length / 3) || attempt > 10) {
        return candidate;
      }
    }
  }
  return letters.slice(1).concat(letters[0]).join('');
}

function buildCrosswordRows(
  targetWord: string,
  difficulty: DifficultyLevel,
  rand: () => number
): CrosswordClueRow[] {
  const usedWords = new Set<string>([targetWord]);
  const rows: CrosswordClueRow[] = [];

  for (let i = 0; i < targetWord.length; i++) {
    const ch = targetWord[i];
    const candidates = CROSSWORD_LEXICON.filter(
      (entry) => !usedWords.has(entry.word) && entry.word.includes(ch)
    );
    const pool =
      candidates.length > 0
        ? candidates
        : CROSSWORD_LEXICON.filter((entry) => entry.word.includes(ch));

    const chosen = pool[Math.floor(rand() * pool.length)];
    usedWords.add(chosen.word);

    // Pick an occurrence index of `ch` inside `chosen.word`
    const indices: number[] = [];
    for (let k = 0; k < chosen.word.length; k++) {
      if (chosen.word[k] === ch) indices.push(k);
    }
    const intersectIndex = indices[Math.floor(rand() * indices.length)];
    const clueText = difficulty === 'standard' ? chosen.clue : chosen.hardClue;

    rows.push({
      answer: chosen.word,
      intersectIndex,
      clue: `${clueText} (${chosen.word.length})`,
    });
  }

  return rows;
}

function buildWordSearchSpec(
  wordEntry: WordEntry,
  difficulty: DifficultyLevel,
  rand: () => number
): WordSearchData {
  const config = DIFFICULTIES[difficulty];
  const gridSize = config.wordSearchGridSize;
  const word = wordEntry.word;

  const forwardDirs: Array<[-1 | 0 | 1, -1 | 0 | 1]> = [
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  const allDirs: Array<[-1 | 0 | 1, -1 | 0 | 1]> = [
    [0, 1],
    [1, 0],
    [1, 1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];

  const dirPool = config.allowReverseWordSearch ? allDirs : forwardDirs;
  const shuffledDirs = shuffleWithRand(dirPool, rand);

  for (const [dr, dc] of shuffledDirs) {
    const validStarts: [number, number][] = [];
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const endR = r + dr * (word.length - 1);
        const endC = c + dc * (word.length - 1);
        if (endR >= 0 && endR < gridSize && endC >= 0 && endC < gridSize) {
          validStarts.push([r, c]);
        }
      }
    }
    if (validStarts.length > 0) {
      const [startRow, startCol] =
        validStarts[Math.floor(rand() * validStarts.length)];
      return {
        word,
        clue: difficulty === 'standard' ? wordEntry.clue : wordEntry.hardClue,
        gridSize,
        startRow,
        startCol,
        deltaRow: dr,
        deltaCol: dc,
        denseDecoys: difficulty === 'expert',
      };
    }
  }

  // Fallback horizontal placement
  return {
    word,
    clue: difficulty === 'standard' ? wordEntry.clue : wordEntry.hardClue,
    gridSize: Math.max(gridSize, word.length),
    startRow: 0,
    startCol: 0,
    deltaRow: 0,
    deltaCol: 1,
    denseDecoys: difficulty === 'expert',
  };
}

const EDITION_SUBTITLES: Record<DifficultyLevel, string[]> = {
  standard: [
    'Morning Edition',
    'Classic Cut',
    'Fourfold Thread',
    'Paper & Ink',
    'Clear Horizon',
    'Warm Press',
  ],
  hard: [
    'Double-Locked Edition',
    'Tangled Thread',
    'Crossed Signals',
    'Deep Cut',
    'Cipher Desk',
    'High Tide',
  ],
  expert: [
    'Vault Edition',
    'Twelve Keys',
    'Cryptic Press',
    'Midnight Shift',
    'Labyrinth Desk',
    'Master Lock',
  ],
};

// Memoize generated puzzles by `${dateKey}__${difficulty}`
const PUZZLE_CACHE = new Map<string, PuzzleData>();

export function getProgressKey(dateKey: string, difficulty: DifficultyLevel): string {
  return `${dateKey}__${difficulty}`;
}

/**
 * Deterministically generates a unique, verified Layers puzzle for any calendar date
 * and difficulty level (`standard` = 4 keys, `hard` = 8 keys, `expert` = 12 keys).
 */
export function generateDailyPuzzle(
  dateKey: string,
  difficulty: DifficultyLevel
): PuzzleData {
  const cacheKey = getProgressKey(dateKey, difficulty);
  const cached = PUZZLE_CACHE.get(cacheKey);
  if (cached) return cached;

  const config = DIFFICULTIES[difficulty];
  const dailyNum = getDailyNumber(dateKey);
  const seed = hashString(`layers-daily-v2::${dateKey}::${difficulty}`);
  const rand = mulberry32(seed);

  // Choose 1 category per tier, weighted by difficulty complexity, with zero word overlap
  const chosenCategories: CategoryBankEntry[] = [];
  const usedWords = new Set<string>();

  for (const tier of TIER_ORDER) {
    const tierEntries = CATEGORY_BANK.filter((c) => c.tier === tier);

    // Filter by complexity preference for this difficulty
    const preferred = tierEntries.filter((c) => {
      if (difficulty === 'standard') return c.complexity <= 2;
      if (difficulty === 'hard') return c.complexity >= 2 || rand() < 0.35;
      return c.complexity >= 2;
    });
    const orderedCandidates = [
      ...shuffleWithRand(preferred, rand),
      ...shuffleWithRand(tierEntries, rand),
    ];

    let picked: CategoryBankEntry | null = null;
    for (const candidate of orderedCandidates) {
      const hasOverlap = candidate.words.some((w) => usedWords.has(w.word));
      if (!hasOverlap) {
        picked = candidate;
        break;
      }
    }

    if (!picked) {
      picked = tierEntries[0];
    }

    chosenCategories.push(picked);
    picked.words.forEach((w) => usedWords.add(w.word));
  }

  // Pick `keysPerType` (1, 2, or 3) locked words from EACH category = 4, 8, or 12 locked words total
  interface LockedCandidate {
    tier: TierId;
    entry: WordEntry;
  }

  const lockedCandidates: LockedCandidate[] = [];
  const lockedByCategory = new Map<TierId, string[]>();

  for (const cat of chosenCategories) {
    const shuffledWords = shuffleWithRand([...cat.words], rand);
    const chosenLocked = shuffledWords.slice(0, config.keysPerType);
    lockedByCategory.set(
      cat.tier,
      chosenLocked.map((w) => w.word)
    );
    chosenLocked.forEach((entry) => {
      lockedCandidates.push({ tier: cat.tier, entry });
    });
  }

  // Assign mini-game types cleanly:
  // Prefer 5–6 letter words for LetterLock, longer words for Anagram, etc.
  const unassigned = [...lockedCandidates];
  const assignedByType: Record<MiniGameType, LockedCandidate[]> = {
    letterlock: [],
    anagram: [],
    crossword: [],
    wordsearch: [],
  };

  // 1. Assign LetterLock targets (prefer 5-letter on standard, 5-6 on hard/expert)
  unassigned.sort((a, b) => {
    const idealLen = difficulty === 'standard' ? 5 : 6;
    const diffA = Math.abs(a.entry.word.length - idealLen);
    const diffB = Math.abs(b.entry.word.length - idealLen);
    return diffA - diffB;
  });
  for (let i = 0; i < config.keysPerType; i++) {
    const pick = unassigned.shift();
    if (pick) assignedByType.letterlock.push(pick);
  }

  // 2. Assign Word Search targets (must fit cleanly inside gridSize)
  const remainingShuffled = shuffleWithRand(unassigned, rand);
  const wsCandidates = remainingShuffled.filter(
    (c) => c.entry.word.length <= config.wordSearchGridSize - 1
  );
  const wsPicks = wsCandidates.slice(0, config.keysPerType);
  wsPicks.forEach((p) => {
    assignedByType.wordsearch.push(p);
    const idx = remainingShuffled.indexOf(p);
    if (idx !== -1) remainingShuffled.splice(idx, 1);
  });

  // 3. Assign Crossword targets (prefer 4–6 letter words for crisp intersecting grids)
  remainingShuffled.sort((a, b) => a.entry.word.length - b.entry.word.length);
  for (let i = 0; i < config.keysPerType; i++) {
    const pick = remainingShuffled.shift();
    if (pick) assignedByType.crossword.push(pick);
  }

  // 4. Remaining go to Anagram
  while (remainingShuffled.length > 0) {
    const pick = remainingShuffled.shift();
    if (pick) assignedByType.anagram.push(pick);
  }

  // Build concrete MiniGameInstance objects
  const miniGames: MiniGameInstance[] = [];

  for (const type of MINI_GAME_ORDER) {
    assignedByType[type].forEach((item, indexInType) => {
      const keyId = `${type}-${indexInType}`;
      const clueText =
        difficulty === 'standard' ? item.entry.clue : item.entry.hardClue;

      if (type === 'letterlock') {
        miniGames.push({
          keyId,
          type,
          indexInType,
          word: item.entry.word,
          tier: item.tier,
          letterlock: {
            word: item.entry.word,
            clue: clueText,
            maxAttempts: config.letterLockAttempts,
            strictMode: config.letterLockStrict,
          },
        });
      } else if (type === 'anagram') {
        miniGames.push({
          keyId,
          type,
          indexInType,
          word: item.entry.word,
          tier: item.tier,
          anagram: {
            word: item.entry.word,
            scrambled: scrambleWord(item.entry.word, rand),
            clue: clueText,
          },
        });
      } else if (type === 'crossword') {
        miniGames.push({
          keyId,
          type,
          indexInType,
          word: item.entry.word,
          tier: item.tier,
          crossword: {
            word: item.entry.word,
            clue: clueText,
            rows: buildCrosswordRows(item.entry.word, difficulty, rand),
          },
        });
      } else {
        miniGames.push({
          keyId,
          type,
          indexInType,
          word: item.entry.word,
          tier: item.tier,
          wordsearch: buildWordSearchSpec(item.entry, difficulty, rand),
        });
      }
    });
  }

  const categories = chosenCategories.map((cat) => ({
    tier: cat.tier,
    title: cat.title,
    words: cat.words.map((w) => w.word) as [string, string, string, string],
    lockedWords: lockedByCategory.get(cat.tier) ?? [],
  })) as [CategoryGroup, CategoryGroup, CategoryGroup, CategoryGroup];

  const isToday = dateKey === getTodayDateKey();
  const dateDisplay = formatHumanDate(dateKey);
  const subtitleList = EDITION_SUBTITLES[difficulty];
  const subtitle = subtitleList[dailyNum % subtitleList.length];

  const puzzle: PuzzleData = {
    id: dailyNum,
    dateKey,
    dateDisplay,
    dateLabel: isToday
      ? `Today · Daily #${dailyNum}`
      : `${dateDisplay} · #${dailyNum}`,
    subtitle,
    difficulty,
    maxMistakes: config.maxBoardMistakes,
    categories,
    miniGames,
  };

  PUZZLE_CACHE.set(cacheKey, puzzle);
  return puzzle;
}

export function getMiniGameForWord(
  puzzle: PuzzleData,
  word: string
): MiniGameInstance | null {
  return puzzle.miniGames.find((mg) => mg.word === word) ?? null;
}

export function getTierForWord(puzzle: PuzzleData, word: string): TierId {
  for (const cat of puzzle.categories) {
    if (cat.words.includes(word)) {
      return cat.tier;
    }
  }
  return 'amber';
}

export function getInitialTileOrder(puzzle: PuzzleData): string[] {
  const allWords = puzzle.categories.flatMap((c) => [...c.words]);
  const rand = mulberry32(
    hashString(`tile-order::${puzzle.dateKey}::${puzzle.difficulty}`)
  );
  return shuffleWithRand(allWords, rand);
}

const FILLER_ALPHABET = 'ABCDEFGHIKLMNOPRSTUVWY';

export function buildWordSearchGrid(
  seedKey: string,
  data: WordSearchData
): { grid: string[][]; targetCells: [number, number][] } {
  const { gridSize, word, startRow, startCol, deltaRow, deltaCol, denseDecoys } =
    data;
  const grid: string[][] = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => '')
  );

  const targetCells: [number, number][] = [];
  for (let i = 0; i < word.length; i++) {
    const r = startRow + i * deltaRow;
    const c = startCol + i * deltaCol;
    grid[r][c] = word[i];
    targetCells.push([r, c]);
  }

  const rand = mulberry32(hashString(`ws-grid::${seedKey}::${word}`));
  const wordLetters = word.split('');

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (!grid[r][c]) {
        // On Expert, inject more letters from the target word itself as realistic decoys
        if (denseDecoys && rand() < 0.42) {
          grid[r][c] = wordLetters[Math.floor(rand() * wordLetters.length)];
        } else {
          let ch = FILLER_ALPHABET[Math.floor(rand() * FILLER_ALPHABET.length)];
          if (!denseDecoys && ch === word[0] && rand() < 0.55) {
            ch =
              FILLER_ALPHABET[
                (Math.floor(rand() * (FILLER_ALPHABET.length - 1)) + 1) %
                  FILLER_ALPHABET.length
              ];
          }
          grid[r][c] = ch;
        }
      }
    }
  }

  return { grid, targetCells };
}
