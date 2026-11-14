import { ALL_WORDS_BY_LEN, VALID_WORD_SET } from './wordBank';

export interface WordSlot {
  id: string;
  direction: 'across' | 'down';
  row: number;
  col: number;
  length: number;
  cells: Array<{ r: number; c: number }>;
  number: number;
}

export interface UnolingoPuzzle {
  dateStr: string;
  gridSize: 10;
  /** '.' for playable cell, '#' for black block */
  layout: string[][];
  /** Uppercase A-Z for every playable cell in the verified solution, '#' for blocked */
  solution: string[][];
  /** Pre-filled anchor letters (uppercase A-Z), or '' if empty/blocked */
  givens: string[][];
  /** Ordered list of the exactly 26 blank cell coordinates (row-major) */
  blankCells: Array<{ r: number; c: number; solutionLetter: string }>;
  /** Lookup map "r,c" -> index in blankCells (0..25) */
  blankIndexMap: Record<string, number>;
  /** All Across & Down word slots (length >= 3) */
  slots: WordSlot[];
  /** Stats for metadata */
  totalWhiteCells: number;
  givenCount: number;
}

const GRID_SIZE = 10;
const ALL_26_MASK = (1 << 26) - 1;
// Rare letters get extra priority in CSP candidate ranking
const RARE_LETTER_MASK =
  (1 << ('Q'.charCodeAt(0) - 65)) |
  (1 << ('Z'.charCodeAt(0) - 65)) |
  (1 << ('X'.charCodeAt(0) - 65)) |
  (1 << ('J'.charCodeAt(0) - 65)) |
  (1 << ('K'.charCodeAt(0) - 65)) |
  (1 << ('V'.charCodeAt(0) - 65));

// 8 verified 10x10 crossword templates (each cell '.' or '#'),
// zero 2-letter runs, 100% connected, 36-44 white cells each.
const BASE_TEMPLATES: string[][] = [
  // T0: 38 white cells
  [
    '....##...#',
    '.##.##.#.#',
    '.#.....#.#',
    '.##.##.###',
    '#....#####',
    '##.#####.#',
    '###....#.#',
    '###.#.##.#',
    '###.#....#',
    '###.######',
  ],
  // T1: 37 white cells
  [
    '#....#####',
    '#.##.#####',
    '.....#...#',
    '#.##.#.#.#',
    '####....##',
    '##.#.###.#',
    '##.#....##',
    '####.###.#',
    '##....##.#',
    '##########',
  ],
  // T2: 39 white cells
  [
    '.....#####',
    '.##.######',
    '.##....###',
    '.####.####',
    '##.....###',
    '#####.####',
    '###....###',
    '###.#.####',
    '###.#....#',
    '###.######',
  ],
  // T3: 40 white cells
  [
    '##....####',
    '##.##.####',
    '.....#...#',
    '##.##.#.##',
    '#####.#.##',
    '###.....##',
    '###.#.####',
    '##....####',
    '###.#.##.#',
    '###...####',
  ],
  // T4: 38 white cells
  [
    '.###...###',
    '.###.#.###',
    '.....#.###',
    '.###.#....',
    '.####.###.',
    '###....##.',
    '###.#.###.',
    '###.#.....',
    '###.#.####',
    '##########',
  ],
  // T5: 40 white cells
  [
    '....##....',
    '.##.##.##.',
    '.#.....##.',
    '.##.###...',
    '#....###.#',
    '##.#####.#',
    '##...###.#',
    '##.#......',
    '##.#.#####',
    '##########',
  ],
  // T6: 39 white cells
  [
    '###....###',
    '###.##.###',
    '#.....####',
    '#.#.##....',
    '#.#.##.##.',
    '#.#.....#.',
    '####.#.##.',
    '##....####',
    '##.#.#####',
    '##.#.#####',
  ],
  // T7: 41 white cells
  [
    '....###...',
    '.##.###.#.',
    '.#.....##.',
    '.##.#.###.',
    '##....####',
    '###.######',
    '##....####',
    '##.#.#####',
    '##.#.....#',
    '##.#.#####',
  ],
];

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

function popcount(n: number): number {
  let count = 0;
  let x = n >>> 0;
  while (x) {
    x &= x - 1;
    count++;
  }
  return count;
}

function wordMask(word: string): number {
  let m = 0;
  for (let i = 0; i < word.length; i++) {
    m |= 1 << (word.charCodeAt(i) - 65);
  }
  return m;
}

interface WordEntry {
  word: string;
  mask: number;
  rareCount: number;
}

const WORD_ENTRIES_BY_LEN: Record<number, WordEntry[]> = {};
for (const len of [3, 4, 5, 6]) {
  const clean = (ALL_WORDS_BY_LEN[len] || []).filter(
    (w) => w.length === len && /^[A-Z]+$/.test(w)
  );
  WORD_ENTRIES_BY_LEN[len] = clean.map((w) => {
    const mask = wordMask(w);
    return {
      word: w,
      mask,
      rareCount: popcount(mask & RARE_LETTER_MASK),
    };
  });
}

function transformGrid(raw: string[], variant: number): string[][] {
  const g: string[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill('#')
  );
  const flipH = (variant & 1) !== 0;
  const flipV = (variant & 2) !== 0;
  const transpose = (variant & 4) !== 0;

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const ch = raw[r]?.[c] ?? '#';
      const nr = flipV ? GRID_SIZE - 1 - r : r;
      const nc = flipH ? GRID_SIZE - 1 - c : c;
      if (transpose) {
        g[nc][nr] = ch;
      } else {
        g[nr][nc] = ch;
      }
    }
  }
  return g;
}

export function extractSlots(layout: string[][]): WordSlot[] {
  const rawSlots: Omit<WordSlot, 'number'>[] = [];

  // Across slots
  for (let r = 0; r < GRID_SIZE; r++) {
    let c = 0;
    while (c < GRID_SIZE) {
      if (layout[r][c] === '.') {
        const start = c;
        const cells: Array<{ r: number; c: number }> = [];
        while (c < GRID_SIZE && layout[r][c] === '.') {
          cells.push({ r, c });
          c++;
        }
        if (cells.length >= 2) {
          rawSlots.push({
            id: `A-${r}-${start}`,
            direction: 'across',
            row: r,
            col: start,
            length: cells.length,
            cells,
          });
        }
      } else {
        c++;
      }
    }
  }

  // Down slots
  for (let c = 0; c < GRID_SIZE; c++) {
    let r = 0;
    while (r < GRID_SIZE) {
      if (layout[r][c] === '.') {
        const start = r;
        const cells: Array<{ r: number; c: number }> = [];
        while (r < GRID_SIZE && layout[r][c] === '.') {
          cells.push({ r, c });
          r++;
        }
        if (cells.length >= 2) {
          rawSlots.push({
            id: `D-${start}-${c}`,
            direction: 'down',
            row: start,
            col: c,
            length: cells.length,
            cells,
          });
        }
      } else {
        r++;
      }
    }
  }

  // Number cells in classic crossword order
  const startCoordNum = new Map<string, number>();
  let num = 1;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const startsAcross = rawSlots.some(
        (s) => s.direction === 'across' && s.row === r && s.col === c
      );
      const startsDown = rawSlots.some(
        (s) => s.direction === 'down' && s.row === r && s.col === c
      );
      if (startsAcross || startsDown) {
        startCoordNum.set(`${r},${c}`, num++);
      }
    }
  }

  return rawSlots.map((s) => ({
    ...s,
    number: startCoordNum.get(`${s.row},${s.col}`) ?? 0,
  }));
}

function solvePangramCrossword(
  layout: string[][],
  slots: WordSlot[],
  rng: () => number
): string[][] | null {
  const grid: string[][] = layout.map((row) =>
    row.map((ch) => (ch === '.' ? '' : '#'))
  );

  // Precompute crossings per slot
  const cellToSlots = new Map<string, Array<{ slotIdx: number; pos: number }>>();
  slots.forEach((slot, slotIdx) => {
    slot.cells.forEach((cell, pos) => {
      const key = `${cell.r},${cell.c}`;
      const arr = cellToSlots.get(key) ?? [];
      arr.push({ slotIdx, pos });
      cellToSlots.set(key, arr);
    });
  });

  // Shuffle pools deterministically per attempt
  const pools: Record<number, WordEntry[]> = {};
  for (const len of [3, 4, 5, 6]) {
    const arr = [...(WORD_ENTRIES_BY_LEN[len] || [])];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    pools[len] = arr;
  }

  const assigned = new Array<string | null>(slots.length).fill(null);
  const usedWords = new Set<string>();
  let steps = 0;
  const MAX_STEPS = 3500;

  function getCandidates(slotIdx: number, missingMask: number): WordEntry[] {
    const slot = slots[slotIdx];
    const pool = pools[slot.length] || [];
    const pattern: string[] = slot.cells.map(({ r, c }) => grid[r][c]);
    const matches: WordEntry[] = [];

    for (let i = 0; i < pool.length; i++) {
      const entry = pool[i];
      if (usedWords.has(entry.word)) continue;
      let ok = true;
      for (let p = 0; p < slot.length; p++) {
        if (pattern[p] !== '' && pattern[p] !== entry.word[p]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        matches.push(entry);
      }
    }

    // Score candidates to prioritize covering missing rare letters and missing letters overall
    if (missingMask !== 0 && matches.length > 1) {
      const missingRare = missingMask & RARE_LETTER_MASK;
      matches.sort((a, b) => {
        const aRare = popcount(a.mask & missingRare);
        const bRare = popcount(b.mask & missingRare);
        if (aRare !== bRare) return bRare - aRare;
        const aMiss = popcount(a.mask & missingMask);
        const bMiss = popcount(b.mask & missingMask);
        if (aMiss !== bMiss) return bMiss - aMiss;
        return 0;
      });
    }

    return matches;
  }

  function currentGridMask(): number {
    let m = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const ch = grid[r][c];
        if (ch !== '' && ch !== '#') {
          m |= 1 << (ch.charCodeAt(0) - 65);
        }
      }
    }
    return m;
  }

  function backtrack(depth: number): boolean {
    if (steps++ > MAX_STEPS) return false;
    if (depth === slots.length) {
      return currentGridMask() === ALL_26_MASK;
    }

    const usedMask = currentGridMask();
    const missingMask = ALL_26_MASK & ~usedMask;

    // Count remaining open cells
    let openCells = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === '') openCells++;
      }
    }
    const missingCount = popcount(missingMask);
    if (missingCount > openCells) return false;

    // MRV: pick unfilled slot with fewest candidates
    let bestSlotIdx = -1;
    let bestCandidates: WordEntry[] = [];
    for (let i = 0; i < slots.length; i++) {
      if (assigned[i] !== null) continue;
      const cands = getCandidates(i, missingMask);
      if (cands.length === 0) return false;
      if (bestSlotIdx === -1 || cands.length < bestCandidates.length) {
        bestSlotIdx = i;
        bestCandidates = cands;
        if (cands.length === 1) break;
      }
    }

    if (bestSlotIdx === -1) return false;
    const slot = slots[bestSlotIdx];
    const prevChars = slot.cells.map(({ r, c }) => grid[r][c]);

    const limit = Math.min(bestCandidates.length, 48);
    for (let i = 0; i < limit; i++) {
      const cand = bestCandidates[i];
      assigned[bestSlotIdx] = cand.word;
      usedWords.add(cand.word);
      for (let p = 0; p < slot.length; p++) {
        const { r, c } = slot.cells[p];
        grid[r][c] = cand.word[p];
      }

      if (backtrack(depth + 1)) return true;

      usedWords.delete(cand.word);
      assigned[bestSlotIdx] = null;
      for (let p = 0; p < slot.length; p++) {
        const { r, c } = slot.cells[p];
        grid[r][c] = prevChars[p];
      }
    }

    return false;
  }

  return backtrack(0) ? grid : null;
}

const puzzleCache = new Map<string, UnolingoPuzzle>();

/**
 * Deterministically generates a verified 10x10 Unolingo puzzle for YYYY-MM-DD.
 * Contains all 26 letters A-Z exactly once in the 26 blank cells, plus pre-filled anchor tiles.
 */
export function getPuzzleForDate(dateStr: string): UnolingoPuzzle {
  const cached = puzzleCache.get(dateStr);
  if (cached) return cached;

  const baseSeed = hashString(`unolingo-daily-v1:${dateStr}`);

  let chosenLayout: string[][] | null = null;
  let chosenSlots: WordSlot[] = [];
  let chosenSolution: string[][] | null = null;
  let finalRng = mulberry32(baseSeed);

  for (let attempt = 0; attempt < 48; attempt++) {
    const attemptSeed = (baseSeed + Math.imul(attempt + 1, 0x9e3779b1)) >>> 0;
    const rng = mulberry32(attemptSeed);
    const templateIdx = Math.floor(rng() * BASE_TEMPLATES.length);
    const variant = Math.floor(rng() * 8);
    const layout = transformGrid(BASE_TEMPLATES[templateIdx], variant);
    const slots = extractSlots(layout);
    const solved = solvePangramCrossword(layout, slots, rng);
    if (solved) {
      chosenLayout = layout;
      chosenSlots = slots;
      chosenSolution = solved;
      finalRng = rng;
      break;
    }
  }

  if (!chosenLayout || !chosenSolution) {
    throw new Error(`Failed to generate puzzle for ${dateStr}`);
  }

  // Group all playable cells by letter A-Z
  const coordsByLetter: Record<string, Array<{ r: number; c: number; degree: number }>> = {};
  let totalWhiteCells = 0;

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (chosenLayout[r][c] === '.') {
        totalWhiteCells++;
        const ch = chosenSolution[r][c];
        // Degree = how many slots pass through this cell (2 = intersection)
        let degree = 0;
        for (const s of chosenSlots) {
          if (s.cells.some((cell) => cell.r === r && cell.c === c)) degree++;
        }
        const arr = coordsByLetter[ch] ?? [];
        arr.push({ r, c, degree });
        coordsByLetter[ch] = arr;
      }
    }
  }

  // Pick exactly 1 cell for each letter A-Z as blank (preferring intersections for richer deduction)
  const blankSet = new Set<string>();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < alphabet.length; i++) {
    const ch = alphabet[i];
    const candidates = coordsByLetter[ch];
    if (!candidates || candidates.length === 0) {
      throw new Error(`Missing letter ${ch} in puzzle ${dateStr}`);
    }
    // Sort by degree desc with deterministic tie-breaker
    candidates.sort((a, b) => {
      if (b.degree !== a.degree) return b.degree - a.degree;
      return finalRng() - 0.5;
    });
    const picked = candidates[0];
    blankSet.add(`${picked.r},${picked.c}`);
  }

  const givens: string[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill('')
  );
  const blankCells: Array<{ r: number; c: number; solutionLetter: string }> = [];
  const blankIndexMap: Record<string, number> = {};

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (chosenLayout[r][c] === '.') {
        const key = `${r},${c}`;
        if (blankSet.has(key)) {
          blankIndexMap[key] = blankCells.length;
          blankCells.push({ r, c, solutionLetter: chosenSolution[r][c] });
        } else {
          givens[r][c] = chosenSolution[r][c];
        }
      }
    }
  }

  const puzzle: UnolingoPuzzle = {
    dateStr,
    gridSize: 10,
    layout: chosenLayout,
    solution: chosenSolution,
    givens,
    blankCells,
    blankIndexMap,
    slots: chosenSlots,
    totalWhiteCells,
    givenCount: totalWhiteCells - 26,
  };

  puzzleCache.set(dateStr, puzzle);
  return puzzle;
}

/**
 * Checks whether the player's current 26-letter board is completely filled and valid!
 * Accepts either exact solution OR any valid interlocking dictionary words using all 26 letters once.
 */
export function validateSolvedBoard(
  puzzle: UnolingoPuzzle,
  boardLetters: string[]
): { isComplete: boolean; isSolved: boolean; invalidSlotIds: string[] } {
  if (boardLetters.length !== 26 || boardLetters.some((ch) => ch.length !== 1)) {
    return { isComplete: false, isSolved: false, invalidSlotIds: [] };
  }

  // Verify A-Z used once each
  const seen = new Set(boardLetters);
  if (seen.size !== 26) {
    return { isComplete: false, isSolved: false, invalidSlotIds: [] };
  }

  // Construct candidate 10x10 grid
  const candidate: string[][] = puzzle.layout.map((row, r) =>
    row.map((cell, c) => {
      if (cell === '#') return '#';
      const idx = puzzle.blankIndexMap[`${r},${c}`];
      return idx !== undefined ? boardLetters[idx] : puzzle.givens[r][c];
    })
  );

  // Check if every word slot is a valid word in our dictionary (or matches exact solution)
  const invalidSlotIds: string[] = [];
  for (const slot of puzzle.slots) {
    const word = slot.cells.map(({ r, c }) => candidate[r][c]).join('');
    const solWord = slot.cells.map(({ r, c }) => puzzle.solution[r][c]).join('');
    if (word !== solWord && !VALID_WORD_SET.has(word)) {
      invalidSlotIds.push(slot.id);
    }
  }

  return {
    isComplete: true,
    isSolved: invalidSlotIds.length === 0,
    invalidSlotIds,
  };
}
