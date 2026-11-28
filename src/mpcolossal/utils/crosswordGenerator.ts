import { SECTORS, VOCAB_BANK, VocabEntry, SectorInfo } from '../data/wordBank';
import { EXPANDED_VOCAB_BANK } from '../data/expandedWordBank';

export type Direction = 'across' | 'down';
export type GridScale = 'colossal' | 'grand' | 'district';

export interface PlacedWord {
  id: string;
  number: number;
  word: string;
  direction: Direction;
  row: number;
  col: number;
  length: number;
  clue: string;
  crypticClue?: string;
  isCryptic: boolean;
  category: string;
  sectorId: number;
  questId?: number;
  questStep?: number;
  isSecret?: boolean;
}

export interface CellData {
  row: number;
  col: number;
  solution: string; // '' if black block
  number?: number;
  acrossWordId?: string;
  downWordId?: string;
  sectorId: number;
  isQuestCell?: boolean;
}

export interface QuestData {
  id: number;
  sectorId: number;
  title: string;
  subtitle: string;
  description: string;
  wordIds: string[];
}

export interface CrosswordPuzzle {
  scale: GridScale;
  size: number;
  rows: number;
  cols: number;
  cells: CellData[][];
  words: PlacedWord[];
  wordMap: Record<string, PlacedWord>;
  quests: QuestData[];
  sectors: SectorInfo[];
  totalWhiteCells: number;
  mainWordCount: number;
  secretStartRow?: number;
}

export const SCALE_CONFIG: Record<GridScale, {
  size: number;
  label: string;
  sublabel: string;
  sectorsPerSide: number;
  badge: string;
}> = {
  colossal: {
    size: 200,
    label: 'Colossal Atlas (200 × 200)',
    sublabel: '40,000 Squares · 25 Sectors · 4,100+ Clues',
    sectorsPerSide: 5,
    badge: '4X BIGGER THAN A 100×100 CROSSWORD'
  },
  grand: {
    size: 120,
    label: 'Grand Broadsheet (120 × 120)',
    sublabel: '14,400 Squares · 9 Sectors · 1,450+ Clues',
    sectorsPerSide: 3,
    badge: 'BROADSHEET EDITION'
  },
  district: {
    size: 60,
    label: 'District Folio (60 × 60)',
    sublabel: '3,600 Squares · 4 Sectors · 350+ Clues',
    sectorsPerSide: 2,
    badge: 'QUICK EXPEDITION'
  }
};

// Deterministic Mulberry32 PRNG
function createRng(seed: number) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDistinctClue(
  entry: VocabEntry,
  occurrenceIndex: number,
  sectorName: string
): { clue: string; isCryptic: boolean } {
  const cleanWord = entry.word.toUpperCase();
  const len = cleanWord.length;
  const stdClue = entry.standardClue.trim();

  if (occurrenceIndex === 0) {
    return {
      clue: `${stdClue} (${len})`,
      isCryptic: false
    };
  }

  if (occurrenceIndex === 1 && entry.crypticClue) {
    return {
      clue: entry.crypticClue.trim(),
      isCryptic: true
    };
  }

  const variant = occurrenceIndex % 5;
  if (variant === 1) {
    const chars = cleanWord.split('');
    for (let i = chars.length - 1; i > 0; i--) {
      const j = (i * 7 + occurrenceIndex * 3) % (i + 1);
      const tmp = chars[i];
      chars[i] = chars[j];
      chars[j] = tmp;
    }
    if (chars.join('') === cleanWord) {
      for (let i = 1; i < chars.length; i++) {
        if (chars[i] !== chars[0]) {
          const tmp = chars[0];
          chars[0] = chars[i];
          chars[i] = tmp;
          break;
        }
      }
    }
    return {
      clue: `Cryptic anagram (${chars.join('')}): ${stdClue} (${len})`,
      isCryptic: true
    };
  }

  if (variant === 2) {
    return {
      clue: `[${entry.category}] ${stdClue}; starts with ‘${cleanWord[0]}’ and ends with ‘${cleanWord[len - 1]}’ (${len})`,
      isCryptic: false
    };
  }

  if (variant === 3) {
    return {
      clue: `${stdClue} [2nd letter ‘${cleanWord[1]}’, last letter ‘${cleanWord[len - 1]}’] (${len})`,
      isCryptic: false
    };
  }

  return {
    clue: `${sectorName.replace(/^\d+\.\s*/, '')} archive: ${stdClue} (${len})`,
    isCryptic: false
  };
}

function buildPost1200Clue(
  entry: VocabEntry,
  clueNumber: number,
  direction: Direction
): { clue: string; isCryptic: boolean } {
  const len = entry.word.length;
  const stdClue = entry.standardClue.trim();

  if (entry.crypticClue) {
    // Deterministically choose ~55% of cryptic-capable entries (~20% of all 1201+ clues overall)
    const dirSalt = direction === 'down' ? 17 : 0;
    const hash = (clueNumber * 31 + dirSalt + entry.word.charCodeAt(0) * 7) % 100;
    if (hash < 55) {
      return {
        clue: entry.crypticClue.trim(),
        isCryptic: true
      };
    }
  }

  return {
    clue: `${stdClue} (${len})`,
    isCryptic: false
  };
}

const COLOSSAL_PRESERVE_MAX_NUMBER = 1200;
const COLOSSAL_SECRET_EXTRA_ROWS = 25;

const SECRET_SECTORS: SectorInfo[] = [
  {
    id: 25,
    name: '26. Deep Vault West',
    subtitle: 'Western wing of the hidden lower broadsheet',
    questTitle: 'The Trapdoor Opens',
    questDescription: 'Chart the western wing of the secret 25×200 underground vault.'
  },
  {
    id: 26,
    name: '27. Cipher Catacombs',
    subtitle: 'Second chamber beneath the main atlas border',
    questTitle: 'Beneath the Border',
    questDescription: 'Crack the second chamber hidden beneath the colossal atlas.'
  },
  {
    id: 27,
    name: '28. Mastermind Sanctum',
    subtitle: 'Heart of the secret 25×200 extension',
    questTitle: 'The Centerpiece Twist',
    questDescription: 'Conquer the heart of the secret lower broadsheet.'
  },
  {
    id: 28,
    name: '29. Sunken Archive',
    subtitle: 'Eastern passages of the extended atlas',
    questTitle: 'Echoes Below',
    questDescription: 'Decode the eastern passages of the extended crossword.'
  },
  {
    id: 29,
    name: '30. Final Horizon',
    subtitle: 'The ultimate corner of the Colossal Atlas',
    questTitle: 'The Last Word',
    questDescription: 'Finish the final corner of the true Colossal Atlas.'
  }
];

export function generateColossalCrossword(
  scale: GridScale,
  includeSecretExtension = false
): CrosswordPuzzle {
  const config = SCALE_CONFIG[scale];
  const size = config.size;
  const sectorsPerSide = config.sectorsPerSide;
  const sectorSpan = Math.floor(size / sectorsPerSide);

  const rng = createRng(size * 1337 + 42);

  // Deduplicate vocabulary bank by word
  const uniqueMap = new Map<string, VocabEntry>();
  for (const item of VOCAB_BANK) {
    const w = item.word.toUpperCase().replace(/[^A-Z]/g, '');
    if (w.length >= 4 && !uniqueMap.has(w)) {
      uniqueMap.set(w, { ...item, word: w });
    }
  }
  const vocabList = Array.from(uniqueMap.values());

  // Index words by character they contain -> list of { entry, charIdx }
  const wordsByChar: Record<string, Array<{ entry: VocabEntry; charIdx: number }>> = {};
  for (let c = 65; c <= 90; c++) {
    wordsByChar[String.fromCharCode(c)] = [];
  }
  for (const entry of vocabList) {
    for (let i = 0; i < entry.word.length; i++) {
      const ch = entry.word[i];
      if (wordsByChar[ch]) {
        wordsByChar[ch].push({ entry, charIdx: i });
      }
    }
  }

  // Board arrays for ultra-fast generation
  // charGrid[r][c] = '' or 'A'..'Z'
  const charGrid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
  const hasAcross: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const hasDown: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const acrossWordAt: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
  const downWordAt: string[][] = Array.from({ length: size }, () => Array(size).fill(''));

  const rawPlacements: Array<{
    entry: VocabEntry;
    row: number;
    col: number;
    direction: Direction;
  }> = [];

  const wordUsageCount: Record<string, number> = {};

  function canPlaceWord(
    word: string,
    row: number,
    col: number,
    direction: Direction,
    requireIntersection: boolean
  ): number {
    const len = word.length;
    const dr = direction === 'down' ? 1 : 0;
    const dc = direction === 'across' ? 1 : 0;

    if (row < 0 || col < 0) return -1;
    if (row + dr * (len - 1) >= size || col + dc * (len - 1) >= size) return -1;

    // Check cell immediately before word start
    const beforeR = row - dr;
    const beforeC = col - dc;
    if (beforeR >= 0 && beforeC >= 0 && charGrid[beforeR][beforeC] !== '') {
      return -1;
    }

    // Check cell immediately after word end
    const afterR = row + dr * len;
    const afterC = col + dc * len;
    if (afterR < size && afterC < size && charGrid[afterR][afterC] !== '') {
      return -1;
    }

    let intersections = 0;

    for (let i = 0; i < len; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const existing = charGrid[r][c];

      if (existing !== '') {
        if (existing !== word[i]) return -1;
        // Cannot overlap another word in the same direction
        if (direction === 'across' && hasAcross[r][c]) return -1;
        if (direction === 'down' && hasDown[r][c]) return -1;
        // Prevent a word from intersecting an identical copy of itself
        if (direction === 'across' && downWordAt[r][c] === word) return -1;
        if (direction === 'down' && acrossWordAt[r][c] === word) return -1;
        intersections++;
      } else {
        // Cell is currently empty; check perpendicular neighbors to prevent invalid 2-letter side-by-side contact
        if (direction === 'across') {
          if (r > 0 && charGrid[r - 1][c] !== '') return -1;
          if (r < size - 1 && charGrid[r + 1][c] !== '') return -1;
        } else {
          if (c > 0 && charGrid[r][c - 1] !== '') return -1;
          if (c < size - 1 && charGrid[r][c + 1] !== '') return -1;
        }
      }
    }

    if (requireIntersection && intersections === 0) return -1;
    return intersections;
  }

  function commitWord(entry: VocabEntry, row: number, col: number, direction: Direction) {
    const word = entry.word;
    const len = word.length;
    const dr = direction === 'down' ? 1 : 0;
    const dc = direction === 'across' ? 1 : 0;

    for (let i = 0; i < len; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      charGrid[r][c] = word[i];
      if (direction === 'across') {
        hasAcross[r][c] = true;
        acrossWordAt[r][c] = word;
      } else {
        hasDown[r][c] = true;
        downWordAt[r][c] = word;
      }
    }

    rawPlacements.push({ entry, row, col, direction });
    wordUsageCount[word] = (wordUsageCount[word] || 0) + 1;
  }

  // Active frontier cells that can spawn perpendicular crossing words
  const frontier: Array<{ r: number; c: number }> = [];

  function addWordAndFrontier(entry: VocabEntry, row: number, col: number, direction: Direction) {
    commitWord(entry, row, col, direction);
    const dr = direction === 'down' ? 1 : 0;
    const dc = direction === 'across' ? 1 : 0;
    for (let i = 0; i < entry.word.length; i++) {
      frontier.push({ r: row + dr * i, c: col + dc * i });
    }
  }

  // Step 1: Seed a single central anchor word so the entire crossword grows as ONE connected component
  const longWords = vocabList.filter((v) => v.word.length >= 7);
  const popLongWords = longWords.filter(
    (v) => v.category === 'Cinema' || v.category === 'Pop Music' || v.category === 'Pop Culture'
  );
  const seedPool = popLongWords.length > 0 ? popLongWords : longWords;
  const seedEntry = seedPool[Math.floor(rng() * seedPool.length)];
  const centerR = Math.floor(size / 2);
  const centerC = Math.max(1, Math.floor(size / 2) - Math.floor(seedEntry.word.length / 2));
  addWordAndFrontier(seedEntry, centerR, centerC, 'across');

  function expandFrontier(startHead: number): number {
    let head = startHead;
    while (head < frontier.length) {
      const remaining = frontier.length - head;
      if (remaining > 1) {
        const pick = head + Math.floor(rng() * Math.min(remaining, 24));
        const tmp = frontier[head];
        frontier[head] = frontier[pick];
        frontier[pick] = tmp;
      }

      const { r, c } = frontier[head++];
      const ch = charGrid[r][c];
      if (!ch) continue;

      const needAcross = !hasAcross[r][c];
      const needDown = !hasDown[r][c];
      if (!needAcross && !needDown) continue;

      const targetDir: Direction = needAcross ? 'across' : 'down';
      const candidates = wordsByChar[ch];
      if (!candidates || candidates.length === 0) continue;

      const startOffset = Math.floor(rng() * candidates.length);
      let bestCandidate: { entry: VocabEntry; startR: number; startC: number; score: number } | null = null;

      const sampleCount = Math.min(candidates.length, 64);
      const step = Math.max(1, Math.floor(candidates.length / sampleCount));

      for (let s = 0; s < sampleCount; s++) {
        const cand = candidates[(startOffset + s * step) % candidates.length];
        const startR = targetDir === 'down' ? r - cand.charIdx : r;
        const startC = targetDir === 'across' ? c - cand.charIdx : c;

        const intersections = canPlaceWord(cand.entry.word, startR, startC, targetDir, true);
        if (intersections > 0) {
          const usage = wordUsageCount[cand.entry.word] || 0;
          const isPop =
            cand.entry.category === 'Cinema' ||
            cand.entry.category === 'Pop Music' ||
            cand.entry.category === 'Pop Culture';
          const score =
            intersections * 25 +
            cand.entry.word.length * 2 +
            (isPop ? 8 : 0) -
            usage * 28;
          if (!bestCandidate || score > bestCandidate.score) {
            bestCandidate = { entry: cand.entry, startR, startC, score };
            if (intersections >= 2 && usage === 0) break;
          }
        }
      }

      if (bestCandidate) {
        addWordAndFrontier(bestCandidate.entry, bestCandidate.startR, bestCandidate.startC, targetDir);
      }
    }
    return head;
  }

  // Step 2: Primary outward frontier expansion from the central seed
  let frontierHead = expandFrontier(0);

  // Step 3: Density sweeps that only attach via valid intersections and re-expand the frontier into any sparse pockets
  for (let pass = 0; pass < 2; pass++) {
    let addedInPass = 0;
    for (let r = 1; r < size - 1; r++) {
      for (let c = 1; c < size - 1; c++) {
        const ch = charGrid[r][c];
        if (!ch) continue;
        const needAcross = !hasAcross[r][c];
        const needDown = !hasDown[r][c];
        if (!needAcross && !needDown) continue;

        const targetDir: Direction = needAcross ? 'across' : 'down';
        const candidates = wordsByChar[ch];
        const startOffset = (r * 31 + c * 17 + pass * 101) % candidates.length;

        let bestCandidate: { entry: VocabEntry; startR: number; startC: number; score: number } | null = null;
        const sampleCount = Math.min(36, candidates.length);
        const step = Math.max(1, Math.floor(candidates.length / sampleCount));

        for (let s = 0; s < sampleCount; s++) {
          const cand = candidates[(startOffset + s * step) % candidates.length];
          const startR = targetDir === 'down' ? r - cand.charIdx : r;
          const startC = targetDir === 'across' ? c - cand.charIdx : c;
          const intersections = canPlaceWord(cand.entry.word, startR, startC, targetDir, true);
          if (intersections > 0) {
            const usage = wordUsageCount[cand.entry.word] || 0;
            const score = intersections * 20 + cand.entry.word.length - usage * 28;
            if (!bestCandidate || score > bestCandidate.score) {
              bestCandidate = { entry: cand.entry, startR, startC, score };
              if (intersections >= 2 && usage === 0) break;
            }
          }
        }

        if (bestCandidate) {
          addWordAndFrontier(bestCandidate.entry, bestCandidate.startR, bestCandidate.startC, targetDir);
          addedInPass++;
        }
      }
    }
    frontierHead = expandFrontier(frontierHead);
    if (addedInPass === 0) break;
  }

  // Step 4: Canonical crossword numbering (top-to-bottom, left-to-right)
  const acrossStartMap = new Map<string, typeof rawPlacements[0]>();
  const downStartMap = new Map<string, typeof rawPlacements[0]>();

  for (const p of rawPlacements) {
    const key = `${p.row},${p.col}`;
    if (p.direction === 'across') {
      acrossStartMap.set(key, p);
    } else {
      downStartMap.set(key, p);
    }
  }

  const cells: CellData[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      const sRow = Math.min(sectorsPerSide - 1, Math.floor(r / sectorSpan));
      const sCol = Math.min(sectorsPerSide - 1, Math.floor(c / sectorSpan));
      const sectorId = sRow * sectorsPerSide + sCol;
      return {
        row: r,
        col: c,
        solution: charGrid[r][c],
        sectorId
      };
    })
  );

  const words: PlacedWord[] = [];
  const wordMap: Record<string, PlacedWord> = {};
  const clueOccurrenceCounter: Record<string, number> = {};
  let currentNumber = 1;
  let totalWhiteCells = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (charGrid[r][c] !== '') {
        totalWhiteCells++;
      }
      const key = `${r},${c}`;
      const aPlacement = acrossStartMap.get(key);
      const dPlacement = downStartMap.get(key);

      if (aPlacement || dPlacement) {
        const num = currentNumber++;
        cells[r][c].number = num;

        if (aPlacement) {
          const wStr = aPlacement.entry.word;
          const occ = clueOccurrenceCounter[wStr] || 0;
          clueOccurrenceCounter[wStr] = occ + 1;

          const sectorId = cells[r][c].sectorId;
          const sectorInfo = SECTORS[sectorId % SECTORS.length];
          const { clue, isCryptic } = buildDistinctClue(
            aPlacement.entry,
            occ,
            sectorInfo.name
          );
          const id = `${num}-across`;

          const placed: PlacedWord = {
            id,
            number: num,
            word: wStr,
            direction: 'across',
            row: r,
            col: c,
            length: wStr.length,
            clue,
            crypticClue: aPlacement.entry.crypticClue,
            isCryptic,
            category: aPlacement.entry.category,
            sectorId
          };
          words.push(placed);
          wordMap[id] = placed;

          for (let i = 0; i < wStr.length; i++) {
            cells[r][c + i].acrossWordId = id;
          }
        }

        if (dPlacement) {
          const wStr = dPlacement.entry.word;
          const occ = clueOccurrenceCounter[wStr] || 0;
          clueOccurrenceCounter[wStr] = occ + 1;

          const sectorId = cells[r][c].sectorId;
          const sectorInfo = SECTORS[sectorId % SECTORS.length];
          const { clue, isCryptic } = buildDistinctClue(
            dPlacement.entry,
            occ,
            sectorInfo.name
          );
          const id = `${num}-down`;

          const placed: PlacedWord = {
            id,
            number: num,
            word: wStr,
            direction: 'down',
            row: r,
            col: c,
            length: wStr.length,
            clue,
            crypticClue: dPlacement.entry.crypticClue,
            isCryptic,
            category: dPlacement.entry.category,
            sectorId
          };
          words.push(placed);
          wordMap[id] = placed;

          for (let i = 0; i < wStr.length; i++) {
            cells[r + i][c].downWordId = id;
          }
        }
      }
    }
  }

  // For MP Colossal ONLY: preserve clues & answers 1-1200 verbatim, then rebuild 1201+
  // using the expanded dictionary with strictly unique answers and genuine cryptic clues.
  if (scale === 'colossal') {
    const keptWords = words.filter((w) => w.number <= COLOSSAL_PRESERVE_MAX_NUMBER);
    let cutoffRow = 0;
    let cutoffCol = 0;
    for (const kw of keptWords) {
      if (kw.row > cutoffRow || (kw.row === cutoffRow && kw.col > cutoffCol)) {
        cutoffRow = kw.row;
        cutoffCol = kw.col;
      }
    }

    const isAfterCutoff = (r: number, c: number) =>
      r > cutoffRow || (r === cutoffRow && c > cutoffCol);

    // Reset working grids and commit ONLY the preserved 1-1200 words
    const rCharGrid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
    const rHasAcross: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    const rHasDown: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    const rAcrossWordAt: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
    const rDownWordAt: string[][] = Array.from({ length: size }, () => Array(size).fill(''));

    const usedWords = new Set<string>();
    const keptAcrossStart = new Map<string, PlacedWord>();
    const keptDownStart = new Map<string, PlacedWord>();
    const bridgeCells: Array<{ r: number; c: number }> = [];
    const seenBridge = new Set<string>();

    for (const kw of keptWords) {
      const dr = kw.direction === 'down' ? 1 : 0;
      const dc = kw.direction === 'across' ? 1 : 0;
      usedWords.add(kw.word);
      const startKey = `${kw.row},${kw.col}`;
      if (kw.direction === 'across') keptAcrossStart.set(startKey, kw);
      else keptDownStart.set(startKey, kw);

      for (let i = 0; i < kw.length; i++) {
        const r = kw.row + dr * i;
        const c = kw.col + dc * i;
        rCharGrid[r][c] = kw.word[i];
        if (kw.direction === 'across') {
          rHasAcross[r][c] = true;
          rAcrossWordAt[r][c] = kw.word;
        } else {
          rHasDown[r][c] = true;
          rDownWordAt[r][c] = kw.word;
        }
        if (isAfterCutoff(r, c)) {
          const bk = `${r},${c}`;
          if (!seenBridge.has(bk)) {
            seenBridge.add(bk);
            bridgeCells.push({ r, c });
          }
        }
      }
    }

    // Build expanded candidate dictionary excluding all words already used in clues 1-1200
    const rebuildMap = new Map<string, VocabEntry>();
    for (const item of [...VOCAB_BANK, ...EXPANDED_VOCAB_BANK]) {
      const w = item.word.toUpperCase().replace(/[^A-Z]/g, '');
      if (w.length >= 4 && !usedWords.has(w) && !rebuildMap.has(w)) {
        rebuildMap.set(w, { ...item, word: w });
      }
    }
    const rebuildVocab = Array.from(rebuildMap.values());

    const rWordsByChar: Record<string, Array<{ entry: VocabEntry; charIdx: number }>> = {};
    for (let chCode = 65; chCode <= 90; chCode++) {
      rWordsByChar[String.fromCharCode(chCode)] = [];
    }
    for (const entry of rebuildVocab) {
      for (let i = 0; i < entry.word.length; i++) {
        const ch = entry.word[i];
        if (rWordsByChar[ch]) {
          rWordsByChar[ch].push({ entry, charIdx: i });
        }
      }
    }

    const rRng = createRng(size * 7919 + 1201);
    const newPlacements: Array<{
      entry: VocabEntry;
      row: number;
      col: number;
      direction: Direction;
    }> = [];
    const rFrontier: Array<{ r: number; c: number }> = [];

    function canPlaceRebuildWord(
      word: string,
      row: number,
      col: number,
      direction: Direction
    ): number {
      if (usedWords.has(word)) return -1;
      if (!isAfterCutoff(row, col)) return -1;

      const len = word.length;
      const dr = direction === 'down' ? 1 : 0;
      const dc = direction === 'across' ? 1 : 0;

      if (row < 0 || col < 0) return -1;
      if (row + dr * (len - 1) >= size || col + dc * (len - 1) >= size) return -1;

      const beforeR = row - dr;
      const beforeC = col - dc;
      if (beforeR >= 0 && beforeC >= 0 && rCharGrid[beforeR][beforeC] !== '') return -1;

      const afterR = row + dr * len;
      const afterC = col + dc * len;
      if (afterR < size && afterC < size && rCharGrid[afterR][afterC] !== '') return -1;

      let intersections = 0;
      for (let i = 0; i < len; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        const existing = rCharGrid[r][c];
        if (existing !== '') {
          if (existing !== word[i]) return -1;
          if (direction === 'across' && rHasAcross[r][c]) return -1;
          if (direction === 'down' && rHasDown[r][c]) return -1;
          if (direction === 'across' && rDownWordAt[r][c] === word) return -1;
          if (direction === 'down' && rAcrossWordAt[r][c] === word) return -1;
          intersections++;
        } else {
          if (direction === 'across') {
            if (r > 0 && rCharGrid[r - 1][c] !== '') return -1;
            if (r < size - 1 && rCharGrid[r + 1][c] !== '') return -1;
          } else {
            if (c > 0 && rCharGrid[r][c - 1] !== '') return -1;
            if (c < size - 1 && rCharGrid[r][c + 1] !== '') return -1;
          }
        }
      }

      return intersections > 0 ? intersections : -1;
    }

    function commitRebuildWord(entry: VocabEntry, row: number, col: number, direction: Direction) {
      const word = entry.word;
      const dr = direction === 'down' ? 1 : 0;
      const dc = direction === 'across' ? 1 : 0;
      for (let i = 0; i < word.length; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        rCharGrid[r][c] = word[i];
        if (direction === 'across') {
          rHasAcross[r][c] = true;
          rAcrossWordAt[r][c] = word;
        } else {
          rHasDown[r][c] = true;
          rDownWordAt[r][c] = word;
        }
        rFrontier.push({ r, c });
      }
      usedWords.add(word);
      newPlacements.push({ entry, row, col, direction });
    }

    function pickBestRebuildCandidate(
      r: number,
      c: number,
      targetDir: Direction,
      startOffset: number,
      maxChecks: number
    ) {
      const ch = rCharGrid[r][c];
      const candidates = rWordsByChar[ch];
      if (!candidates || candidates.length === 0) return null;

      let best: { entry: VocabEntry; startR: number; startC: number; score: number } | null = null;
      const total = candidates.length;
      const step = Math.max(1, Math.floor(total / Math.min(total, maxChecks * 2)));
      let checkedUnused = 0;

      for (let s = 0; s < total && checkedUnused < maxChecks; s++) {
        const cand = candidates[(startOffset + s * step) % total];
        if (usedWords.has(cand.entry.word)) continue;
        checkedUnused++;

        const startR = targetDir === 'down' ? r - cand.charIdx : r;
        const startC = targetDir === 'across' ? c - cand.charIdx : c;
        const intersections = canPlaceRebuildWord(cand.entry.word, startR, startC, targetDir);
        if (intersections > 0) {
          // Slightly favor medium-length words (5-8 letters) and multiple intersections for dense packing
          const lenBonus = cand.entry.word.length <= 8 ? cand.entry.word.length * 2 : 12;
          const score = intersections * 28 + lenBonus + (cand.entry.crypticClue ? 3 : 0);
          if (!best || score > best.score) {
            best = { entry: cand.entry, startR, startC, score };
            if (intersections >= 2) break;
          }
        }
      }
      return best;
    }

    function expandRebuildFrontier(startHead: number): number {
      let head = startHead;
      while (head < rFrontier.length) {
        const remaining = rFrontier.length - head;
        if (remaining > 1) {
          const pick = head + Math.floor(rRng() * Math.min(remaining, 24));
          const tmp = rFrontier[head];
          rFrontier[head] = rFrontier[pick];
          rFrontier[pick] = tmp;
        }
        const { r, c } = rFrontier[head++];
        const ch = rCharGrid[r][c];
        if (!ch) continue;
        const needAcross = !rHasAcross[r][c];
        const needDown = !rHasDown[r][c];
        if (!needAcross && !needDown) continue;

        const targetDir: Direction = needAcross ? 'across' : 'down';
        const candidates = rWordsByChar[ch];
        if (!candidates || candidates.length === 0) continue;

        const startOffset = Math.floor(rRng() * candidates.length);
        const budget = r <= cutoffRow + 12 ? 96 : 52;
        const best = pickBestRebuildCandidate(r, c, targetDir, startOffset, budget);
        if (best) {
          commitRebuildWord(best.entry, best.startR, best.startC, targetDir);
        }
      }
      return head;
    }

    // Seed frontier with all bridge cells from kept clues 1-1200 strictly after (cutoffRow, cutoffCol)
    bridgeCells.sort((a, b) => (a.r !== b.r ? a.r - b.r : a.c - b.c));
    for (const cell of bridgeCells) {
      rFrontier.push(cell);
    }

    let rFrontierHead = expandRebuildFrontier(0);

    // Density sweeps across the rebuilt lower region to fill pockets cleanly with unique words
    for (let pass = 0; pass < 2; pass++) {
      let addedInPass = 0;
      for (let r = cutoffRow; r < size - 1; r++) {
        const startCScan = r === cutoffRow ? cutoffCol + 1 : 1;
        for (let c = startCScan; c < size - 1; c++) {
          const ch = rCharGrid[r][c];
          if (!ch) continue;
          const needAcross = !rHasAcross[r][c];
          const needDown = !rHasDown[r][c];
          if (!needAcross && !needDown) continue;

          const targetDir: Direction = needAcross ? 'across' : 'down';
          const candidates = rWordsByChar[ch];
          if (!candidates || candidates.length === 0) continue;

          const startOffset = (r * 37 + c * 19 + pass * 131) % candidates.length;
          const sweepBudget = r <= cutoffRow + 12 ? 96 : 40;
          const best = pickBestRebuildCandidate(r, c, targetDir, startOffset, sweepBudget);
          if (best) {
            commitRebuildWord(best.entry, best.startR, best.startC, targetDir);
            addedInPass++;
          }
        }
      }
      rFrontierHead = expandRebuildFrontier(rFrontierHead);
      if (addedInPass === 0) break;
    }

    // Build final canonical numbering & cells preserving clues 1-1200 identically
    const newAcrossStart = new Map<string, typeof newPlacements[0]>();
    const newDownStart = new Map<string, typeof newPlacements[0]>();
    for (const p of newPlacements) {
      const key = `${p.row},${p.col}`;
      if (p.direction === 'across') newAcrossStart.set(key, p);
      else newDownStart.set(key, p);
    }

    const finalCells: CellData[][] = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => {
        const sRow = Math.min(sectorsPerSide - 1, Math.floor(r / sectorSpan));
        const sCol = Math.min(sectorsPerSide - 1, Math.floor(c / sectorSpan));
        const sectorId = sRow * sectorsPerSide + sCol;
        return {
          row: r,
          col: c,
          solution: rCharGrid[r][c],
          sectorId
        };
      })
    );

    const finalWords: PlacedWord[] = [];
    const finalWordMap: Record<string, PlacedWord> = {};
    let finalNum = 1;
    let finalWhiteCells = 0;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (rCharGrid[r][c] !== '') {
          finalWhiteCells++;
        }
        const key = `${r},${c}`;
        const kA = keptAcrossStart.get(key);
        const kD = keptDownStart.get(key);
        const nA = newAcrossStart.get(key);
        const nD = newDownStart.get(key);

        if (kA || kD || nA || nD) {
          const num = finalNum++;
          finalCells[r][c].number = num;

          if (kA) {
            const preserved: PlacedWord = { ...kA, questId: undefined, questStep: undefined };
            finalWords.push(preserved);
            finalWordMap[preserved.id] = preserved;
            for (let i = 0; i < preserved.length; i++) {
              finalCells[r][c + i].acrossWordId = preserved.id;
            }
          } else if (nA) {
            const wStr = nA.entry.word;
            const sectorId = finalCells[r][c].sectorId;
            const { clue, isCryptic } = buildPost1200Clue(nA.entry, num, 'across');
            const id = `${num}-across`;
            const placed: PlacedWord = {
              id,
              number: num,
              word: wStr,
              direction: 'across',
              row: r,
              col: c,
              length: wStr.length,
              clue,
              crypticClue: nA.entry.crypticClue,
              isCryptic,
              category: nA.entry.category,
              sectorId
            };
            finalWords.push(placed);
            finalWordMap[id] = placed;
            for (let i = 0; i < wStr.length; i++) {
              finalCells[r][c + i].acrossWordId = id;
            }
          }

          if (kD) {
            const preserved: PlacedWord = { ...kD, questId: undefined, questStep: undefined };
            finalWords.push(preserved);
            finalWordMap[preserved.id] = preserved;
            for (let i = 0; i < preserved.length; i++) {
              finalCells[r + i][c].downWordId = preserved.id;
            }
          } else if (nD) {
            const wStr = nD.entry.word;
            const sectorId = finalCells[r][c].sectorId;
            const { clue, isCryptic } = buildPost1200Clue(nD.entry, num, 'down');
            const id = `${num}-down`;
            const placed: PlacedWord = {
              id,
              number: num,
              word: wStr,
              direction: 'down',
              row: r,
              col: c,
              length: wStr.length,
              clue,
              crypticClue: nD.entry.crypticClue,
              isCryptic,
              category: nD.entry.category,
              sectorId
            };
            finalWords.push(placed);
            finalWordMap[id] = placed;
            for (let i = 0; i < wStr.length; i++) {
              finalCells[r + i][c].downWordId = id;
            }
          }
        }
      }
    }

    // Build structured Quests across all 25 main sectors
    const totalSectors = sectorsPerSide * sectorsPerSide;
    const activeSectors = SECTORS.slice(0, totalSectors);
    const finalQuests: QuestData[] = [];

    for (let sId = 0; sId < totalSectors; sId++) {
      const sectorWords = finalWords.filter((w) => w.sectorId === sId && w.length >= 6);
      const stepCount = Math.min(8, Math.max(5, Math.floor(sectorWords.length / 8)));
      const chosenWords: string[] = [];

      if (sectorWords.length > 0) {
        const stride = Math.max(1, Math.floor(sectorWords.length / stepCount));
        for (let i = 0; i < stepCount && i * stride < sectorWords.length; i++) {
          const w = sectorWords[i * stride];
          w.questId = sId;
          w.questStep = i + 1;
          chosenWords.push(w.id);

          const dr = w.direction === 'down' ? 1 : 0;
          const dc = w.direction === 'across' ? 1 : 0;
          for (let k = 0; k < w.length; k++) {
            finalCells[w.row + dr * k][w.col + dc * k].isQuestCell = true;
          }
        }
      }

      const sInfo = activeSectors[sId % activeSectors.length];
      finalQuests.push({
        id: sId,
        sectorId: sId,
        title: sInfo.questTitle,
        subtitle: sInfo.name,
        description: sInfo.questDescription,
        wordIds: chosenWords
      });
    }

    const mainWordCount = finalWords.length;

    // When the secret extension is not yet unlocked, return the exact 200x200 puzzle
    if (!includeSecretExtension) {
      return {
        scale,
        size,
        rows: size,
        cols: size,
        cells: finalCells,
        words: finalWords,
        wordMap: finalWordMap,
        quests: finalQuests,
        sectors: activeSectors,
        totalWhiteCells: finalWhiteCells,
        mainWordCount
      };
    }

    // Secret 25h x 200w bottom extension (rows 200..224), populated with all new unique
    // words & clues stitched directly onto the bottom edge of the 200x200 main grid.
    const extRows = size + COLOSSAL_SECRET_EXTRA_ROWS;
    const extCharGrid: string[][] = [
      ...rCharGrid.map((row) => [...row]),
      ...Array.from({ length: COLOSSAL_SECRET_EXTRA_ROWS }, () => Array(size).fill(''))
    ];
    const extHasAcross: boolean[][] = [
      ...rHasAcross.map((row) => [...row]),
      ...Array.from({ length: COLOSSAL_SECRET_EXTRA_ROWS }, () => Array(size).fill(false))
    ];
    const extHasDown: boolean[][] = [
      ...rHasDown.map((row) => [...row]),
      ...Array.from({ length: COLOSSAL_SECRET_EXTRA_ROWS }, () => Array(size).fill(false))
    ];
    const extAcrossWordAt: string[][] = [
      ...rAcrossWordAt.map((row) => [...row]),
      ...Array.from({ length: COLOSSAL_SECRET_EXTRA_ROWS }, () => Array(size).fill(''))
    ];
    const extDownWordAt: string[][] = [
      ...rDownWordAt.map((row) => [...row]),
      ...Array.from({ length: COLOSSAL_SECRET_EXTRA_ROWS }, () => Array(size).fill(''))
    ];

    const secretRng = createRng(size * 104729 + 25200);
    const secretPlacements: Array<{
      entry: VocabEntry;
      row: number;
      col: number;
      direction: Direction;
    }> = [];
    const sFrontier: Array<{ r: number; c: number }> = [];

    function canPlaceSecretWord(
      word: string,
      row: number,
      col: number,
      direction: Direction,
      allowBridgeStart = false
    ): number {
      if (usedWords.has(word)) return -1;
      if (!allowBridgeStart && row < size) return -1;

      const len = word.length;
      const dr = direction === 'down' ? 1 : 0;
      const dc = direction === 'across' ? 1 : 0;

      if (row < 0 || col < 0) return -1;
      const endR = row + dr * (len - 1);
      const endC = col + dc * (len - 1);
      if (endR >= extRows || endC >= size) return -1;
      // Must actually enter the secret 25x200 zone
      if (endR < size) return -1;

      const beforeR = row - dr;
      const beforeC = col - dc;
      if (beforeR >= 0 && beforeC >= 0 && extCharGrid[beforeR][beforeC] !== '') return -1;

      const afterR = row + dr * len;
      const afterC = col + dc * len;
      if (afterR < extRows && afterC < size && extCharGrid[afterR][afterC] !== '') return -1;

      let intersections = 0;
      for (let i = 0; i < len; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        const existing = extCharGrid[r][c];
        if (existing !== '') {
          if (existing !== word[i]) return -1;
          if (direction === 'across' && extHasAcross[r][c]) return -1;
          if (direction === 'down' && extHasDown[r][c]) return -1;
          if (direction === 'across' && extDownWordAt[r][c] === word) return -1;
          if (direction === 'down' && extAcrossWordAt[r][c] === word) return -1;
          intersections++;
        } else {
          if (direction === 'across') {
            if (r > 0 && extCharGrid[r - 1][c] !== '') return -1;
            if (r < extRows - 1 && extCharGrid[r + 1][c] !== '') return -1;
          } else {
            if (c > 0 && extCharGrid[r][c - 1] !== '') return -1;
            if (c < size - 1 && extCharGrid[r][c + 1] !== '') return -1;
          }
        }
      }

      return intersections > 0 ? intersections : -1;
    }

    function commitSecretWord(entry: VocabEntry, row: number, col: number, direction: Direction) {
      const word = entry.word;
      const dr = direction === 'down' ? 1 : 0;
      const dc = direction === 'across' ? 1 : 0;
      for (let i = 0; i < word.length; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        extCharGrid[r][c] = word[i];
        if (direction === 'across') {
          extHasAcross[r][c] = true;
          extAcrossWordAt[r][c] = word;
        } else {
          extHasDown[r][c] = true;
          extDownWordAt[r][c] = word;
        }
        if (r >= size) {
          sFrontier.push({ r, c });
        }
      }
      usedWords.add(word);
      secretPlacements.push({ entry, row, col, direction });
    }

    function pickBestSecretCandidate(
      r: number,
      c: number,
      targetDir: Direction,
      startOffset: number,
      maxChecks: number,
      allowBridgeStart = false,
      forceStartAtCell = false
    ) {
      const ch = extCharGrid[r][c];
      const candidates = rWordsByChar[ch];
      if (!candidates || candidates.length === 0) return null;

      let best: { entry: VocabEntry; startR: number; startC: number; score: number } | null = null;
      const total = candidates.length;
      const step = Math.max(1, Math.floor(total / Math.min(total, maxChecks * 2)));
      let checkedUnused = 0;

      for (let s = 0; s < total && checkedUnused < maxChecks; s++) {
        const cand = candidates[(startOffset + s * step) % total];
        if (forceStartAtCell && cand.charIdx !== 0) continue;
        if (usedWords.has(cand.entry.word)) continue;
        checkedUnused++;

        const startR = targetDir === 'down' ? r - cand.charIdx : r;
        const startC = targetDir === 'across' ? c - cand.charIdx : c;
        const intersections = canPlaceSecretWord(
          cand.entry.word,
          startR,
          startC,
          targetDir,
          allowBridgeStart
        );
        if (intersections > 0) {
          const lenBonus = cand.entry.word.length <= 8 ? cand.entry.word.length * 2 : 12;
          const score = intersections * 28 + lenBonus + (cand.entry.crypticClue ? 3 : 0);
          if (!best || score > best.score) {
            best = { entry: cand.entry, startR, startC, score };
            if (intersections >= 2) break;
          }
        }
      }
      return best;
    }

    // Step S1: Drop Down bridge words cleanly from unnumbered bottom-edge Across cells (rows 197..199)
    // so the secret 25x200 vault stitches seamlessly onto the solved main grid without changing any 1..3882 numbers
    const secretBridgeAnchors: Array<{ r: number; c: number }> = [];
    for (let r = size - 3; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!extCharGrid[r][c]) continue;
        if (!extHasAcross[r][c] || extHasDown[r][c]) continue;
        if (finalCells[r][c].number !== undefined) continue;
        if (r > 0 && extCharGrid[r - 1][c] !== '') continue;
        let belowClear = true;
        for (let rr = r + 1; rr < size; rr++) {
          if (extCharGrid[rr][c] !== '') {
            belowClear = false;
            break;
          }
          if (c > 0 && extCharGrid[rr][c - 1] !== '') {
            belowClear = false;
            break;
          }
          if (c < size - 1 && extCharGrid[rr][c + 1] !== '') {
            belowClear = false;
            break;
          }
        }
        if (belowClear) {
          secretBridgeAnchors.push({ r, c });
        }
      }
    }

    for (const anchor of secretBridgeAnchors) {
      const ch = extCharGrid[anchor.r][anchor.c];
      const candidates = rWordsByChar[ch];
      if (!candidates || candidates.length === 0) continue;
      const startOffset = Math.floor(secretRng() * candidates.length);
      const best = pickBestSecretCandidate(
        anchor.r,
        anchor.c,
        'down',
        startOffset,
        140,
        true,
        true
      );
      if (best) {
        commitSecretWord(best.entry, best.startR, best.startC, 'down');
      }
    }

    function expandSecretFrontier(startHead: number): number {
      let head = startHead;
      while (head < sFrontier.length) {
        const remaining = sFrontier.length - head;
        if (remaining > 1) {
          const pick = head + Math.floor(secretRng() * Math.min(remaining, 24));
          const tmp = sFrontier[head];
          sFrontier[head] = sFrontier[pick];
          sFrontier[pick] = tmp;
        }
        const { r, c } = sFrontier[head++];
        const ch = extCharGrid[r][c];
        if (!ch) continue;
        const needAcross = !extHasAcross[r][c];
        const needDown = !extHasDown[r][c];
        if (!needAcross && !needDown) continue;

        const targetDir: Direction = needAcross ? 'across' : 'down';
        const candidates = rWordsByChar[ch];
        if (!candidates || candidates.length === 0) continue;

        const startOffset = Math.floor(secretRng() * candidates.length);
        const best = pickBestSecretCandidate(r, c, targetDir, startOffset, 80, false, false);
        if (best) {
          commitSecretWord(best.entry, best.startR, best.startC, targetDir);
        }
      }
      return head;
    }

    let sFrontierHead = expandSecretFrontier(0);

    // Step S2: Density sweeps across rows 200..224 to pack the 25x200 vault densely with unique words
    for (let pass = 0; pass < 3; pass++) {
      let addedInPass = 0;
      for (let r = size; r < extRows; r++) {
        for (let c = 1; c < size - 1; c++) {
          const ch = extCharGrid[r][c];
          if (!ch) continue;
          const needAcross = !extHasAcross[r][c];
          const needDown = !extHasDown[r][c];
          if (!needAcross && !needDown) continue;

          const targetDir: Direction = needAcross ? 'across' : 'down';
          const candidates = rWordsByChar[ch];
          if (!candidates || candidates.length === 0) continue;

          const startOffset = (r * 41 + c * 23 + pass * 137) % candidates.length;
          const best = pickBestSecretCandidate(r, c, targetDir, startOffset, 64, false, false);
          if (best) {
            commitSecretWord(best.entry, best.startR, best.startC, targetDir);
            addedInPass++;
          }
        }
      }
      sFrontierHead = expandSecretFrontier(sFrontierHead);
      if (addedInPass === 0) break;
    }

    // Build extended cells array (rows 0..199 synced with bridge cells, rows 200..224 assigned secret sectors 25..29)
    const extCells: CellData[][] = [
      ...finalCells.map((rowArr, r) =>
        r >= size - 3
          ? rowArr.map((cell, c) => ({
              ...cell,
              solution: extCharGrid[r][c]
            }))
          : rowArr
      ),
      ...Array.from({ length: COLOSSAL_SECRET_EXTRA_ROWS }, (_, offsetR) => {
        const r = size + offsetR;
        return Array.from({ length: size }, (_, c) => {
          const sCol = Math.min(sectorsPerSide - 1, Math.floor(c / sectorSpan));
          return {
            row: r,
            col: c,
            solution: extCharGrid[r][c],
            sectorId: totalSectors + sCol
          };
        });
      })
    ];

    let extWhiteCells = 0;
    for (let r = 0; r < extRows; r++) {
      for (let c = 0; c < size; c++) {
        if (extCharGrid[r][c] !== '') extWhiteCells++;
      }
    }

    // Number secret words cleanly starting right after main max number (3883+) in top-to-bottom, left-to-right order
    const secretAcrossStart = new Map<string, typeof secretPlacements[0]>();
    const secretDownStart = new Map<string, typeof secretPlacements[0]>();
    for (const p of secretPlacements) {
      const key = `${p.row},${p.col}`;
      if (p.direction === 'across') secretAcrossStart.set(key, p);
      else secretDownStart.set(key, p);
    }

    const extWords = [...finalWords];
    const extWordMap: Record<string, PlacedWord> = { ...finalWordMap };
    let extNum = finalNum;

    for (let r = size - 3; r < extRows; r++) {
      for (let c = 0; c < size; c++) {
        const key = `${r},${c}`;
        const sA = secretAcrossStart.get(key);
        const sD = secretDownStart.get(key);
        if (!sA && !sD) continue;

        const num = extNum++;
        extCells[r][c].number = num;
        const sectorId =
          r >= size
            ? extCells[r][c].sectorId
            : totalSectors + Math.min(sectorsPerSide - 1, Math.floor(c / sectorSpan));

        if (sA) {
          const wStr = sA.entry.word;
          const { clue, isCryptic } = buildPost1200Clue(sA.entry, num, 'across');
          const id = `${num}-across`;
          const placed: PlacedWord = {
            id,
            number: num,
            word: wStr,
            direction: 'across',
            row: r,
            col: c,
            length: wStr.length,
            clue,
            crypticClue: sA.entry.crypticClue,
            isCryptic,
            category: sA.entry.category,
            sectorId,
            isSecret: true
          };
          extWords.push(placed);
          extWordMap[id] = placed;
          for (let i = 0; i < wStr.length; i++) {
            extCells[r][c + i].acrossWordId = id;
          }
        }

        if (sD) {
          const wStr = sD.entry.word;
          const { clue, isCryptic } = buildPost1200Clue(sD.entry, num, 'down');
          const id = `${num}-down`;
          const placed: PlacedWord = {
            id,
            number: num,
            word: wStr,
            direction: 'down',
            row: r,
            col: c,
            length: wStr.length,
            clue,
            crypticClue: sD.entry.crypticClue,
            isCryptic,
            category: sD.entry.category,
            sectorId,
            isSecret: true
          };
          extWords.push(placed);
          extWordMap[id] = placed;
          for (let i = 0; i < wStr.length; i++) {
            extCells[r + i][c].downWordId = id;
          }
        }
      }
    }

    // Build bonus quests for the 5 newly revealed secret sectors (25..29)
    const extSectors = [...activeSectors, ...SECRET_SECTORS];
    const extQuests = [...finalQuests];

    for (let i = 0; i < SECRET_SECTORS.length; i++) {
      const sInfo = SECRET_SECTORS[i];
      const sId = sInfo.id;
      const sectorWords = extWords.filter((w) => w.sectorId === sId && w.length >= 5);
      const stepCount = Math.min(7, Math.max(4, Math.floor(sectorWords.length / 6)));
      const chosenWords: string[] = [];

      if (sectorWords.length > 0) {
        const stride = Math.max(1, Math.floor(sectorWords.length / stepCount));
        for (let k = 0; k < stepCount && k * stride < sectorWords.length; k++) {
          const w = sectorWords[k * stride];
          w.questId = sId;
          w.questStep = k + 1;
          chosenWords.push(w.id);

          const dr = w.direction === 'down' ? 1 : 0;
          const dc = w.direction === 'across' ? 1 : 0;
          for (let m = 0; m < w.length; m++) {
            extCells[w.row + dr * m][w.col + dc * m].isQuestCell = true;
          }
        }
      }

      extQuests.push({
        id: sId,
        sectorId: sId,
        title: sInfo.questTitle,
        subtitle: sInfo.name,
        description: sInfo.questDescription,
        wordIds: chosenWords
      });
    }

    return {
      scale,
      size,
      rows: extRows,
      cols: size,
      cells: extCells,
      words: extWords,
      wordMap: extWordMap,
      quests: extQuests,
      sectors: extSectors,
      totalWhiteCells: extWhiteCells,
      mainWordCount,
      secretStartRow: size
    };
  }

  // Step 5: Build structured Quests (1 quest per active sector, 6-8 curated words per quest)
  const totalSectors = sectorsPerSide * sectorsPerSide;
  const activeSectors = SECTORS.slice(0, totalSectors);
  const quests: QuestData[] = [];

  for (let sId = 0; sId < totalSectors; sId++) {
    const sectorWords = words.filter((w) => w.sectorId === sId && w.length >= 6);
    const stepCount = Math.min(8, Math.max(5, Math.floor(sectorWords.length / 8)));
    const chosenWords: string[] = [];

    if (sectorWords.length > 0) {
      const stride = Math.max(1, Math.floor(sectorWords.length / stepCount));
      for (let i = 0; i < stepCount && i * stride < sectorWords.length; i++) {
        const w = sectorWords[i * stride];
        w.questId = sId;
        w.questStep = i + 1;
        chosenWords.push(w.id);

        // Mark cells as quest cells for subtle cartographic gold highlight
        const dr = w.direction === 'down' ? 1 : 0;
        const dc = w.direction === 'across' ? 1 : 0;
        for (let k = 0; k < w.length; k++) {
          cells[w.row + dr * k][w.col + dc * k].isQuestCell = true;
        }
      }
    }

    const sInfo = activeSectors[sId % activeSectors.length];
    quests.push({
      id: sId,
      sectorId: sId,
      title: sInfo.questTitle,
      subtitle: sInfo.name,
      description: sInfo.questDescription,
      wordIds: chosenWords
    });
  }

  return {
    scale,
    size,
    rows: size,
    cols: size,
    cells,
    words,
    wordMap,
    quests,
    sectors: activeSectors,
    totalWhiteCells,
    mainWordCount: words.length
  };
}
