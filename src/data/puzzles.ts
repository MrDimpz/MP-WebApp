import type {
  GridCellData,
  GridSizeOption,
  PlacedClue,
  PuzzleDefinition,
  VisualThemeId,
} from '@/data/crossword-types';
import { VOCAB_BANK, type VocabEntry } from '@/mpcolossal/data/wordBank';

interface SeedEntry {
  answer: string;
  standardClue: string;
  crypticClue?: string;
}

const THEMES: { id: VisualThemeId; name: string }[] = [
  { id: 'editorial', name: 'Broadsheet Ink' },
  { id: 'observatory', name: 'Velvet Observatory' },
  { id: 'botanical', name: 'Conservatory Felt' },
  { id: 'mahogany', name: 'Archive Study' },
];

const ARCHIVE_TITLES = [
  'Morning Broadsheet',
  'Velvet Edition',
  'Cryptic Chronicle',
  'Ink & Ivory',
  'Midnight Press',
  'Observatory Folio',
  'Conservatory Gazette',
  'Archive Ledger',
  'Sunday Supplement',
  'Crown Crossword',
  'Golden Quill',
  'Atlas Compendium',
  'Starlight Grid',
  'Editorial Standard',
  'Clockwork Edition',
  'Lantern Press',
  'Meridian Folio',
  'Bespoke Broadsheet',
  'Veritas Gazette',
  'Parlour Compendium',
  'Camberwell Edition',
];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function offsetIsoDate(baseIso: string, deltaDays: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function buildClueVariants(answer: string, standardClue: string, crypticClue?: string) {
  const len = answer.length;
  const first = answer[0];
  const last = answer[len - 1];
  return {
    standardClue,
    easyClue: `${standardClue} (${len} letters, starts with ${first})`,
    mediumClue: `${standardClue} (${len})`,
    hardClue: `${standardClue.replace(/\.$/, '')} — ${len} letters ending in ${last}`,
    crypticClue: crypticClue?.trim() || `${standardClue} (${len})`,
  };
}

interface RawPlacement {
  answer: string;
  standardClue: string;
  crypticClue?: string;
  row: number;
  col: number;
  direction: 'across' | 'down';
}

function canPlaceWord(
  board: (string | null)[][],
  size: number,
  word: string,
  row: number,
  col: number,
  direction: 'across' | 'down',
  requireIntersection: boolean,
): number {
  const len = word.length;
  if (direction === 'across') {
    if (col < 0 || col + len > size || row < 0 || row >= size) return -1;
    if (col > 0 && board[row][col - 1] !== null) return -1;
    if (col + len < size && board[row][col + len] !== null) return -1;
  } else {
    if (row < 0 || row + len > size || col < 0 || col >= size) return -1;
    if (row > 0 && board[row - 1][col] !== null) return -1;
    if (row + len < size && board[row + len][col] !== null) return -1;
  }

  let intersections = 0;
  for (let i = 0; i < len; i++) {
    const r = direction === 'across' ? row : row + i;
    const c = direction === 'across' ? col + i : col;
    const existing = board[r][c];
    if (existing !== null) {
      if (existing !== word[i]) return -1;
      intersections++;
    } else {
      if (direction === 'across') {
        if ((r > 0 && board[r - 1][c] !== null) || (r + 1 < size && board[r + 1][c] !== null)) {
          return -1;
        }
      } else {
        if ((c > 0 && board[r][c - 1] !== null) || (c + 1 < size && board[r][c + 1] !== null)) {
          return -1;
        }
      }
    }
  }

  if (requireIntersection && intersections === 0) return -1;
  return intersections;
}

function compileCrosswordGrid(
  entries: SeedEntry[],
  size: GridSizeOption,
  seedKey: string,
): {
  grid: GridCellData[][];
  clues: { across: PlacedClue[]; down: PlacedClue[] };
  totalWhiteCells: number;
} {
  const rng = mulberry32(hashSeed(seedKey));
  const board: (string | null)[][] = Array.from({ length: size }, () =>
    Array<string | null>(size).fill(null),
  );

  const sanitized = entries
    .map((e) => ({
      answer: e.answer.toUpperCase().replace(/[^A-Z]/g, ''),
      standardClue: e.standardClue,
      crypticClue: e.crypticClue,
    }))
    .filter((e) => e.answer.length >= 3 && e.answer.length <= size);

  const uniqueMap = new Map<string, SeedEntry>();
  for (const item of sanitized) {
    if (!uniqueMap.has(item.answer)) uniqueMap.set(item.answer, item);
  }
  const pool = Array.from(uniqueMap.values());
  const targetWords = size === 20 ? 34 : 11;
  const placements: RawPlacement[] = [];

  if (pool.length > 0) {
    // Place first anchor word near the middle
    const first = pool[0];
    const startRow = Math.floor(size / 2);
    const startCol = Math.max(0, Math.floor((size - first.answer.length) / 2));
    for (let i = 0; i < first.answer.length; i++) {
      board[startRow][startCol + i] = first.answer[i];
    }
    placements.push({
      ...first,
      row: startRow,
      col: startCol,
      direction: 'across',
    });

    const used = new Set<string>([first.answer]);
    for (let pass = 0; pass < 3 && placements.length < targetWords; pass++) {
      for (const candidate of pool) {
        if (used.has(candidate.answer)) continue;
        if (placements.length >= targetWords) break;

        let best: { row: number; col: number; direction: 'across' | 'down'; score: number } | null =
          null;

        for (let i = 0; i < candidate.answer.length; i++) {
          const ch = candidate.answer[i];
          for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
              if (board[r][c] !== ch) continue;
              const dirs: ('across' | 'down')[] =
                rng() > 0.5 ? ['down', 'across'] : ['across', 'down'];
              for (const dir of dirs) {
                const startR = dir === 'down' ? r - i : r;
                const startC = dir === 'across' ? c - i : c;
                const hits = canPlaceWord(board, size, candidate.answer, startR, startC, dir, true);
                if (hits > 0) {
                  const centerBias =
                    size -
                    (Math.abs(startR - size / 2) + Math.abs(startC - size / 2)) * 0.25;
                  const score = hits * 10 + centerBias + rng();
                  if (!best || score > best.score) {
                    best = { row: startR, col: startC, direction: dir, score };
                  }
                }
              }
            }
          }
        }

        if (best) {
          for (let i = 0; i < candidate.answer.length; i++) {
            const r = best.direction === 'across' ? best.row : best.row + i;
            const c = best.direction === 'across' ? best.col + i : best.col;
            board[r][c] = candidate.answer[i];
          }
          placements.push({
            ...candidate,
            row: best.row,
            col: best.col,
            direction: best.direction,
          });
          used.add(candidate.answer);
        }
      }
    }
  }

  // Assign standard crossword clue numbers in top-to-bottom, left-to-right order
  const startCoordToNumber = new Map<string, number>();
  let nextNum = 1;
  const grid: GridCellData[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      const letter = board[r][c];
      return {
        row: r,
        col: c,
        isBlocked: letter === null,
        solution: letter ?? '',
      };
    }),
  );

  const placementKeySet = new Set<string>(placements.map((p) => `${p.row},${p.col}`));
  let totalWhiteCells = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!grid[r][c].isBlocked) {
        totalWhiteCells++;
        const k = `${r},${c}`;
        if (placementKeySet.has(k)) {
          startCoordToNumber.set(k, nextNum);
          grid[r][c].number = nextNum;
          nextNum++;
        }
      }
    }
  }

  const across: PlacedClue[] = [];
  const down: PlacedClue[] = [];

  for (const p of placements) {
    const num = startCoordToNumber.get(`${p.row},${p.col}`) ?? 1;
    const variants = buildClueVariants(p.answer, p.standardClue, p.crypticClue);
    const placed: PlacedClue = {
      id: `${p.direction}-${num}-${p.row}-${p.col}`,
      number: num,
      direction: p.direction,
      row: p.row,
      col: p.col,
      length: p.answer.length,
      answer: p.answer,
      ...variants,
    };
    if (p.direction === 'across') across.push(placed);
    else down.push(placed);
  }

  across.sort((a, b) => a.number - b.number);
  down.sort((a, b) => a.number - b.number);

  return { grid, clues: { across, down }, totalWhiteCells };
}

function selectVocabForSeed(seedKey: string, maxWordLen: number, count: number): SeedEntry[] {
  const rng = mulberry32(hashSeed(seedKey));
  const filtered: VocabEntry[] = VOCAB_BANK.filter((v) => {
    const clean = v.word.toUpperCase().replace(/[^A-Z]/g, '');
    return clean.length >= 3 && clean.length <= maxWordLen;
  });
  const copy = filtered.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count).map((v) => ({
    answer: v.word,
    standardClue: v.standardClue,
    crypticClue: v.crypticClue,
  }));
}

function generateArchivePuzzles(): PuzzleDefinition[] {
  const todayIso = getTodayIsoDate();
  const list: PuzzleDefinition[] = [];

  for (let dayOffset = 0; dayOffset < 21; dayOffset++) {
    const iso = offsetIsoDate(todayIso, -dayOffset);
    const theme = THEMES[dayOffset % THEMES.length];
    const baseTitle = ARCHIVE_TITLES[dayOffset % ARCHIVE_TITLES.length];

    // Standard 20x20
    const stdSeed = `cw-20-${iso}`;
    const stdEntries = selectVocabForSeed(stdSeed, 14, 140);
    const stdCompiled = compileCrosswordGrid(stdEntries, 20, stdSeed);
    list.push({
      id: `daily-20x20-${iso}`,
      title: `${baseTitle} (20×20)`,
      subtitle: 'Standard daily broadsheet crossword',
      themeName: theme.name,
      editionType: 'standard-20x20',
      editionDate: iso,
      archiveDate: iso,
      gridSize: 20,
      recommendedVisualTheme: theme.id,
      grid: stdCompiled.grid,
      clues: stdCompiled.clues,
      totalWhiteCells: stdCompiled.totalWhiteCells,
    });

    // Quick 8x8
    const quickSeed = `cw-8-${iso}`;
    const quickEntries = selectVocabForSeed(quickSeed, 8, 90);
    const quickCompiled = compileCrosswordGrid(quickEntries, 8, quickSeed);
    list.push({
      id: `daily-8x8-${iso}`,
      title: `${baseTitle} Quick`,
      subtitle: 'Bite-sized 8×8 coffee-break grid',
      themeName: theme.name,
      editionType: 'quick-8x8',
      editionDate: iso,
      archiveDate: iso,
      gridSize: 8,
      recommendedVisualTheme: THEMES[(dayOffset + 1) % THEMES.length].id,
      grid: quickCompiled.grid,
      clues: quickCompiled.clues,
      totalWhiteCells: quickCompiled.totalWhiteCells,
    });
  }

  return list;
}

export const CURATED_PUZZLES: PuzzleDefinition[] = generateArchivePuzzles();

export function createCustomThemePuzzle(
  title: string,
  entries: { answer: string; standardClue: string }[],
  visualTheme: VisualThemeId,
  gridSize: GridSizeOption,
): PuzzleDefinition {
  const todayIso = getTodayIsoDate();
  const seedKey = `custom-${title}-${Date.now()}`;
  const fallbackFillers = selectVocabForSeed(seedKey, gridSize, 40);
  const combined: SeedEntry[] = [...entries, ...fallbackFillers];
  const compiled = compileCrosswordGrid(combined, gridSize, seedKey);
  const themeObj = THEMES.find((t) => t.id === visualTheme) ?? THEMES[0];

  return {
    id: `custom-${Date.now()}`,
    title,
    subtitle: 'Custom themed crossword',
    themeName: themeObj.name,
    editionType: gridSize === 8 ? 'quick-8x8' : 'standard-20x20',
    editionDate: todayIso,
    archiveDate: todayIso,
    gridSize,
    recommendedVisualTheme: visualTheme,
    grid: compiled.grid,
    clues: compiled.clues,
    totalWhiteCells: compiled.totalWhiteCells,
  };
}
