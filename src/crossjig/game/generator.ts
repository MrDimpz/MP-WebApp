import { getLondonTodayDateStr } from '@/lib/daily-streak';
import { getDictionary } from './dictionary';
import { TEMPLATES } from './templates';
import { DifficultySize, GameMode, GeneratedPuzzle, MODE_CONFIGS, PuzzleTile } from './types';
import { validateBoard } from './validator';

/** Deterministic seeded PRNG (Mulberry32) */
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

export function hashDateSeed(dateStr: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const ARCHIVE_DAYS_COUNT = 365;

export function getTodayDateString(): string {
  return getLondonTodayDateStr();
}

export function shiftDateStr(baseDateStr: string, deltaDays: number): string {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0);
  const dt = new Date(utc);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getArchiveBounds(todayLondonStr: string = getTodayDateString()): {
  minDateStr: string;
  maxDateStr: string;
} {
  return {
    minDateStr: shiftDateStr(todayLondonStr, -(ARCHIVE_DAYS_COUNT - 1)),
    maxDateStr: todayLondonStr,
  };
}

export function isDateInArchive(
  dateStr: string,
  todayLondonStr: string = getTodayDateString()
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const { minDateStr, maxDateStr } = getArchiveBounds(todayLondonStr);
  return dateStr >= minDateStr && dateStr <= maxDateStr;
}

export function formatDisplayDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dt);
}

export function formatShortDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(dt);
}

interface WordSlot {
  id: number;
  direction: 'across' | 'down';
  row: number;
  col: number;
  length: number;
  cells: Array<[number, number]>;
}

interface Crossing {
  otherSlotId: number;
  myPos: number;
  otherPos: number;
}

interface LengthBitIndex {
  words: string[];
  numBlocks: number;
  /** posMasks[pos][charIdx 0..25] -> Uint32Array bitset */
  posMasks: Uint32Array[][];
  allMask: Uint32Array;
}

const commonBitCache = new Map<number, LengthBitIndex>();
const extendedBitCache = new Map<number, LengthBitIndex>();

function getBitIndex(length: number, useExtended: boolean): LengthBitIndex {
  const cache = useExtended ? extendedBitCache : commonBitCache;
  const existing = cache.get(length);
  if (existing) return existing;

  const dict = getDictionary();
  const words = (useExtended ? dict.extendedByLength.get(length) : dict.commonByLength.get(length)) ?? [];
  const numBlocks = Math.ceil(words.length / 32);

  const posMasks: Uint32Array[][] = Array.from({ length }, () =>
    Array.from({ length: 26 }, () => new Uint32Array(numBlocks))
  );
  const allMask = new Uint32Array(numBlocks);

  for (let i = 0; i < words.length; i++) {
    const block = i >>> 5;
    const bit = 1 << (i & 31);
    allMask[block] |= bit;
    const w = words[i];
    for (let p = 0; p < length; p++) {
      const ch = w.charCodeAt(p) - 65;
      if (ch >= 0 && ch < 26) {
        posMasks[p][ch][block] |= bit;
      }
    }
  }

  const index: LengthBitIndex = { words, numBlocks, posMasks, allMask };
  cache.set(length, index);
  return index;
}

function popcount32(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function extractSlots(template: string[]): { slots: WordSlot[]; crossings: Crossing[][] } {
  const rows = template.length;
  const cols = template[0].length;
  const slots: WordSlot[] = [];

  // Across slots
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (template[r][c] === '#') {
        c++;
        continue;
      }
      const start = c;
      const cells: Array<[number, number]> = [];
      while (c < cols && template[r][c] !== '#') {
        cells.push([r, c]);
        c++;
      }
      if (cells.length >= 2) {
        slots.push({
          id: slots.length,
          direction: 'across',
          row: r,
          col: start,
          length: cells.length,
          cells,
        });
      }
    }
  }

  // Down slots
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      if (template[r][c] === '#') {
        r++;
        continue;
      }
      const start = r;
      const cells: Array<[number, number]> = [];
      while (r < rows && template[r][c] !== '#') {
        cells.push([r, c]);
        r++;
      }
      if (cells.length >= 2) {
        slots.push({
          id: slots.length,
          direction: 'down',
          row: start,
          col: c,
          length: cells.length,
          cells,
        });
      }
    }
  }

  // Map cell -> slots to compute crossings
  const cellMap = new Map<string, Array<{ slotId: number; pos: number }>>();
  for (const slot of slots) {
    slot.cells.forEach(([r, c], pos) => {
      const key = `${r},${c}`;
      const list = cellMap.get(key) ?? [];
      list.push({ slotId: slot.id, pos });
      cellMap.set(key, list);
    });
  }

  const crossings: Crossing[][] = Array.from({ length: slots.length }, () => []);
  for (const entries of cellMap.values()) {
    if (entries.length === 2) {
      const [a, b] = entries;
      crossings[a.slotId].push({ otherSlotId: b.slotId, myPos: a.pos, otherPos: b.pos });
      crossings[b.slotId].push({ otherSlotId: a.slotId, myPos: b.pos, otherPos: a.pos });
    }
  }

  return { slots, crossings };
}

function fillTemplate(
  template: string[],
  rng: () => number,
  useExtended: boolean,
  maxNodes: number
): string[][] | null {
  const rows = template.length;
  const cols = template[0].length;
  const { slots, crossings } = extractSlots(template);

  const grid: string[][] = template.map((row) =>
    row.split('').map((ch) => (ch === '#' ? '#' : ''))
  );
  const assigned: Array<string | null> = Array(slots.length).fill(null);
  const usedWords = new Set<string>();
  const bitIndices = slots.map((s) => getBitIndex(s.length, useExtended));

  // Reusable scratch buffer per slot to avoid heap thrashing
  const scratchMasks = bitIndices.map((idx) => new Uint32Array(idx.numBlocks));

  function computeSlotMask(slotId: number): number {
    const slot = slots[slotId];
    const idx = bitIndices[slotId];
    const buf = scratchMasks[slotId];
    buf.set(idx.allMask);

    for (let p = 0; p < slot.length; p++) {
      const [r, c] = slot.cells[p];
      const ch = grid[r][c];
      if (ch !== '') {
        const chMask = idx.posMasks[p][ch.charCodeAt(0) - 65];
        for (let b = 0; b < idx.numBlocks; b++) {
          buf[b] &= chMask[b];
        }
      }
    }

    let count = 0;
    for (let b = 0; b < idx.numBlocks; b++) {
      count += popcount32(buf[b]);
    }
    return count;
  }

  let nodesVisited = 0;

  function backtrack(filledCount: number): boolean {
    if (filledCount === slots.length) return true;
    if (nodesVisited >= maxNodes) return false;
    nodesVisited++;

    // MRV heuristic: choose the unfilled slot with the fewest matching candidates
    let bestSlotId = -1;
    let bestCount = Infinity;

    for (let i = 0; i < slots.length; i++) {
      if (assigned[i] !== null) continue;
      const count = computeSlotMask(i);
      if (count === 0) return false;
      if (count < bestCount) {
        bestCount = count;
        bestSlotId = i;
        if (count === 1) break;
      }
    }

    if (bestSlotId === -1) return false;

    // Recompute mask for bestSlotId (already in scratchMasks[bestSlotId])
    const slot = slots[bestSlotId];
    const idx = bitIndices[bestSlotId];
    const mask = scratchMasks[bestSlotId];

    // Collect candidate word indices
    const candidates: number[] = [];
    for (let b = 0; b < idx.numBlocks; b++) {
      let bits = mask[b];
      while (bits !== 0) {
        const lsb = bits & -bits;
        const bitPos = 31 - Math.clz32(lsb);
        const wordIdx = (b << 5) + bitPos;
        if (!usedWords.has(idx.words[wordIdx])) {
          candidates.push(wordIdx);
        }
        bits ^= lsb;
      }
    }

    if (candidates.length === 0) return false;

    // Shuffle candidates using seeded RNG, and cap branching factor for large domains
    const maxTry = Math.min(candidates.length, bestCount > 25 ? 28 : candidates.length);
    for (let i = 0; i < maxTry; i++) {
      const j = i + Math.floor(rng() * (candidates.length - i));
      const tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }

    // Save previous letters on this slot to restore on backtrack
    const prevLetters = slot.cells.map(([r, c]) => grid[r][c]);

    for (let k = 0; k < maxTry; k++) {
      const word = idx.words[candidates[k]];
      assigned[bestSlotId] = word;
      usedWords.add(word);

      for (let p = 0; p < slot.length; p++) {
        const [r, c] = slot.cells[p];
        grid[r][c] = word[p];
      }

      // Forward-check all unassigned intersecting slots
      let consistent = true;
      for (const cross of crossings[bestSlotId]) {
        if (assigned[cross.otherSlotId] === null) {
          if (computeSlotMask(cross.otherSlotId) === 0) {
            consistent = false;
            break;
          }
        }
      }

      if (consistent && backtrack(filledCount + 1)) {
        return true;
      }

      // Restore
      usedWords.delete(word);
      assigned[bestSlotId] = null;
      for (let p = 0; p < slot.length; p++) {
        const [r, c] = slot.cells[p];
        grid[r][c] = prevLetters[p];
      }
    }

    return false;
  }

  return backtrack(0) ? grid : null;
}

function sliceGridIntoTiles(
  grid: string[][],
  tileRows: number,
  tileCols: number
): PuzzleTile[] {
  const tiles: PuzzleTile[] = [];
  for (let tr = 0; tr < tileRows; tr++) {
    for (let tc = 0; tc < tileCols; tc++) {
      const cells: string[][] = [];
      for (let dr = 0; dr < 3; dr++) {
        const row: string[] = [];
        for (let dc = 0; dc < 3; dc++) {
          row.push(grid[tr * 3 + dr][tc * 3 + dc]);
        }
        cells.push(row);
      }
      const id = tr * tileCols + tc;
      tiles.push({ id, solvedIndex: id, cells });
    }
  }
  return tiles;
}

function scrambleDerangement(
  count: number,
  rng: () => number,
  solvedTiles: PuzzleTile[],
  tileRows: number,
  tileCols: number,
  targetWordCount: number
): number[] {
  const arr = Array.from({ length: count }, (_, i) => i);

  for (let attempt = 0; attempt < 30; attempt++) {
    // Fisher-Yates shuffle
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }

    // Ensure no tile starts in its exact home position (clean derangement)
    let fixedPoints = 0;
    for (let i = 0; i < count; i++) {
      if (arr[i] === i) fixedPoints++;
    }
    if (fixedPoints > 0) {
      // Fix any remaining fixed points by swapping with a neighbor
      for (let i = 0; i < count; i++) {
        if (arr[i] === i) {
          const swapIdx = (i + 1) % count;
          const tmp = arr[i];
          arr[i] = arr[swapIdx];
          arr[swapIdx] = tmp;
        }
      }
    }

    // Verify the scrambled board is not accidentally already solved
    const check = validateBoard(arr, solvedTiles, tileRows, tileCols, targetWordCount);
    if (!check.isSolved) {
      return [...arr];
    }
  }

  return [...arr];
}

export function generatePuzzle(
  mode: GameMode,
  customSeed?: number,
  targetDailyDate?: string
): GeneratedPuzzle {
  const config = MODE_CONFIGS[mode];
  const size: DifficultySize = config.size;
  const templates = TEMPLATES[size];

  const dailyDate =
    mode === 'daily'
      ? targetDailyDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDailyDate)
        ? targetDailyDate
        : getTodayDateString()
      : undefined;
  const baseSeed =
    customSeed !== undefined
      ? customSeed
      : dailyDate
        ? hashDateSeed(`crossjig-daily-${dailyDate}`)
        : Math.floor(Math.random() * 0xffffffff);

  let solvedGrid: string[][] | null = null;
  let chosenTemplate = templates[0];

  // Attempt with everyday common words first across multiple seeded tries
  for (let attempt = 0; attempt < 18 && !solvedGrid; attempt++) {
    const attemptSeed = (baseSeed + Math.imul(attempt, 2654435761)) >>> 0;
    const rng = mulberry32(attemptSeed);
    const tplIdx = attempt === 0 ? baseSeed % templates.length : Math.floor(rng() * templates.length);
    chosenTemplate = templates[tplIdx];
    const useExtended = attempt >= 10;
    solvedGrid = fillTemplate(chosenTemplate, rng, useExtended, useExtended ? 4500 : 2200);
  }

  if (!solvedGrid) {
    // Guaranteed ultra-safe fallback using extended dictionary on simplest template
    const rng = mulberry32(baseSeed ^ 0x9e3779b9);
    chosenTemplate = templates[0];
    solvedGrid = fillTemplate(chosenTemplate, rng, true, 12000);
  }

  if (!solvedGrid) {
    throw new Error(`Unable to generate crossword grid for mode ${mode}`);
  }

  const solvedTiles = sliceGridIntoTiles(solvedGrid, config.tileRows, config.tileCols);
  const solvedOrder = solvedTiles.map((t) => t.id);
  const solvedValidation = validateBoard(
    solvedOrder,
    solvedTiles,
    config.tileRows,
    config.tileCols,
    0
  );
  const targetWordCount = solvedValidation.allWords.length;

  const scrambleRng = mulberry32((baseSeed ^ 0x5bd1e995) >>> 0);
  const initialOrder = scrambleDerangement(
    solvedTiles.length,
    scrambleRng,
    solvedTiles,
    config.tileRows,
    config.tileCols,
    targetWordCount
  );

  return {
    seed: baseSeed,
    mode,
    size,
    tileCols: config.tileCols,
    tileRows: config.tileRows,
    solvedGrid,
    solvedTiles,
    initialOrder,
    targetWordCount,
    dailyDate,
  };
}
