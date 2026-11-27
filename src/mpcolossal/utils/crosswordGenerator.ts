import { SECTORS, VOCAB_BANK, VocabEntry, SectorInfo } from '../data/wordBank';
import { COLOSSAL_EXTENDED_BANK } from '../data/colossalExtendedBank';

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
  cells: CellData[][];
  words: PlacedWord[];
  wordMap: Record<string, PlacedWord>;
  quests: QuestData[];
  sectors: SectorInfo[];
  totalWhiteCells: number;
}

export const SCALE_CONFIG: Record<GridScale, {
  size: number;
  label: string;
  sublabel: string;
  sectorsPerSide: number;
  badge: string;
}> = {
  colossal: {
    size: 250,
    label: 'Colossal Atlas (250 × 250)',
    sublabel: '62,500 Squares · 25 Sectors · 6,400+ Clues',
    sectorsPerSide: 5,
    badge: '6.25X BIGGER THAN A 100×100 CROSSWORD'
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

function normalizeClueKey(clue: string): string {
  return clue
    .trim()
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function buildDistinctClue(
  entry: VocabEntry,
  occurrenceIndex: number,
  sectorName: string
): { clue: string; isCryptic: boolean } {
  const cleanWord = entry.word.toUpperCase();
  const len = cleanWord.length;
  const stdClue = entry.standardClue.trim().replace(/\s*\(\d+\)\s*$/, '');

  if (occurrenceIndex === 0) {
    return {
      clue: `${stdClue} (${len})`,
      isCryptic: false
    };
  }

  if (occurrenceIndex === 1 && entry.crypticClue) {
    const cry = entry.crypticClue.trim();
    if (normalizeClueKey(cry) !== normalizeClueKey(stdClue)) {
      return {
        clue: /\(\d+\)$/.test(cry) ? cry : `${cry} (${len})`,
        isCryptic: true
      };
    }
  }

  const shortSector = sectorName.replace(/^\d+\.\s*/, '');
  return {
    clue: `[${shortSector} · ${entry.category}] ${stdClue} (${len})`,
    isCryptic: false
  };
}

/**
 * Post-placement check-and-replace pass:
 * Scans all placed words in the crossword for any repeating answers (words) or repeating questions (clues),
 * and replaces them in-place with unused vocabulary entries that match all crossing letters at every
 * intersection so the crossword grid and crossing words never break.
 */
function checkAndReplaceRepeatingQuestionsAndAnswers(
  cells: CellData[][],
  words: PlacedWord[],
  wordMap: Record<string, PlacedWord>,
  vocabPool: VocabEntry[],
  usedWords: Set<string>,
  usedClueKeys: Set<string>
): void {
  const poolByLen = new Map<number, VocabEntry[]>();
  const entryByWord = new Map<string, VocabEntry>();
  for (const entry of vocabPool) {
    entryByWord.set(entry.word, entry);
    const len = entry.word.length;
    let bucket = poolByLen.get(len);
    if (!bucket) {
      bucket = [];
      poolByLen.set(len, bucket);
    }
    bucket.push(entry);
  }

  function matchesFixedPattern(candidateWord: string, fixedChars: string[]): boolean {
    for (let i = 0; i < fixedChars.length; i++) {
      if (fixedChars[i] !== '' && candidateWord[i] !== fixedChars[i]) {
        return false;
      }
    }
    return true;
  }

  function applyWordReplacement(target: PlacedWord, newEntry: VocabEntry) {
    const dr = target.direction === 'down' ? 1 : 0;
    const dc = target.direction === 'across' ? 1 : 0;
    const newWord = newEntry.word;

    for (let i = 0; i < target.length; i++) {
      const r = target.row + dr * i;
      const c = target.col + dc * i;
      cells[r][c].solution = newWord[i];
    }

    const stdClue = newEntry.standardClue.trim().replace(/\s*\(\d+\)\s*$/, '');
    let nextClue = `${stdClue} (${newWord.length})`;
    let clueKey = normalizeClueKey(nextClue);

    if (usedClueKeys.has(clueKey) && newEntry.crypticClue) {
      const alt = newEntry.crypticClue.trim().replace(/\s*\(\d+\)\s*$/, '');
      if (!usedClueKeys.has(normalizeClueKey(alt))) {
        nextClue = `${alt} (${newWord.length})`;
        clueKey = normalizeClueKey(nextClue);
      }
    }
    if (usedClueKeys.has(clueKey)) {
      const sectorInfo = SECTORS[target.sectorId % SECTORS.length];
      nextClue = `${stdClue} [${sectorInfo.name.replace(/^\d+\.\s*/, '')}] (${newWord.length})`;
      clueKey = normalizeClueKey(nextClue);
    }

    target.word = newWord;
    target.clue = nextClue;
    target.crypticClue = newEntry.crypticClue;
    target.category = newEntry.category;
    usedWords.add(newWord);
    usedClueKeys.add(clueKey);
  }

  // 1. Check for repeating answers (word) and replace in-place without breaking intersections
  const seenAnswers = new Set<string>();
  const duplicateAnswerWords: PlacedWord[] = [];

  for (const w of words) {
    if (seenAnswers.has(w.word)) {
      duplicateAnswerWords.push(w);
    } else {
      seenAnswers.add(w.word);
    }
  }

  for (const dup of duplicateAnswerWords) {
    const dr = dup.direction === 'down' ? 1 : 0;
    const dc = dup.direction === 'across' ? 1 : 0;
    const fixedChars: string[] = Array(dup.length).fill('');
    const crossingAtPos: Array<PlacedWord | null> = Array(dup.length).fill(null);

    for (let i = 0; i < dup.length; i++) {
      const r = dup.row + dr * i;
      const c = dup.col + dc * i;
      const cell = cells[r][c];
      const crossId = dup.direction === 'across' ? cell.downWordId : cell.acrossWordId;
      if (crossId && wordMap[crossId]) {
        fixedChars[i] = cell.solution;
        crossingAtPos[i] = wordMap[crossId];
      }
    }

    const candidates = poolByLen.get(dup.length) || [];
    let replaced = false;

    // 0-hop direct replacement: matches all existing crossing letters
    for (const cand of candidates) {
      if (usedWords.has(cand.word)) continue;
      if (matchesFixedPattern(cand.word, fixedChars)) {
        applyWordReplacement(dup, cand);
        replaced = true;
        break;
      }
    }

    // 1-star relaxation fallback: if 0-hop had no unused match, simultaneously swap one crossing word
    if (!replaced) {
      for (let i = 0; i < dup.length && !replaced; i++) {
        const crossWord = crossingAtPos[i];
        if (!crossWord) continue;

        const relaxedFixed = [...fixedChars];
        relaxedFixed[i] = '';

        const cdr = crossWord.direction === 'down' ? 1 : 0;
        const cdc = crossWord.direction === 'across' ? 1 : 0;
        const crossPos =
          crossWord.direction === 'down'
            ? dup.row + dr * i - crossWord.row
            : dup.col + dc * i - crossWord.col;

        const crossFixed: string[] = Array(crossWord.length).fill('');
        for (let k = 0; k < crossWord.length; k++) {
          if (k === crossPos) continue;
          const cr = crossWord.row + cdr * k;
          const cc = crossWord.col + cdc * k;
          const cCell = cells[cr][cc];
          const otherId = crossWord.direction === 'across' ? cCell.downWordId : cCell.acrossWordId;
          if (otherId) {
            crossFixed[k] = cCell.solution;
          }
        }

        const crossCandidates = poolByLen.get(crossWord.length) || [];
        for (const cand of candidates) {
          if (usedWords.has(cand.word)) continue;
          if (!matchesFixedPattern(cand.word, relaxedFixed)) continue;

          const neededChar = cand.word[i];
          crossFixed[crossPos] = neededChar;

          let matchingCross: VocabEntry | null = null;
          for (const cCand of crossCandidates) {
            if (usedWords.has(cCand.word) || cCand.word === cand.word) continue;
            if (matchesFixedPattern(cCand.word, crossFixed)) {
              matchingCross = cCand;
              break;
            }
          }

          if (matchingCross) {
            applyWordReplacement(crossWord, matchingCross);
            applyWordReplacement(dup, cand);
            replaced = true;
            break;
          }
        }
      }
    }
  }

  // 2. Check for repeating questions (clues) across all placed words and replace if any collide
  const seenClues = new Set<string>();
  for (const w of words) {
    const key = normalizeClueKey(w.clue);
    if (!seenClues.has(key)) {
      seenClues.add(key);
      continue;
    }

    // First try replacing the entire word in-place with an unused entry that has a fresh clue
    const dr = w.direction === 'down' ? 1 : 0;
    const dc = w.direction === 'across' ? 1 : 0;
    const fixedChars: string[] = Array(w.length).fill('');
    for (let i = 0; i < w.length; i++) {
      const r = w.row + dr * i;
      const c = w.col + dc * i;
      const cell = cells[r][c];
      const crossId = w.direction === 'across' ? cell.downWordId : cell.acrossWordId;
      if (crossId) {
        fixedChars[i] = cell.solution;
      }
    }

    const candidates = poolByLen.get(w.length) || [];
    let swappedWord = false;
    for (const cand of candidates) {
      if (usedWords.has(cand.word)) continue;
      const candKey = normalizeClueKey(cand.standardClue);
      if (seenClues.has(candKey)) continue;
      if (matchesFixedPattern(cand.word, fixedChars)) {
        applyWordReplacement(w, cand);
        seenClues.add(normalizeClueKey(w.clue));
        swappedWord = true;
        break;
      }
    }

    if (!swappedWord) {
      const entry = entryByWord.get(w.word);
      const baseText = entry
        ? entry.standardClue.trim().replace(/\s*\(\d+\)\s*$/, '')
        : w.clue.replace(/\s*\(\d+\)\s*$/, '');
      const altCryptic = entry?.crypticClue?.trim().replace(/\s*\(\d+\)\s*$/, '');

      if (altCryptic && !seenClues.has(normalizeClueKey(altCryptic))) {
        w.clue = `${altCryptic} (${w.length})`;
        w.isCryptic = true;
      } else {
        const sectorInfo = SECTORS[w.sectorId % SECTORS.length];
        w.clue = `${baseText} — ${sectorInfo.name.replace(/^\d+\.\s*/, '')} clue #${w.number} (${w.length})`;
      }
      seenClues.add(normalizeClueKey(w.clue));
      usedClueKeys.add(normalizeClueKey(w.clue));
    }
  }
}

export function generateColossalCrossword(scale: GridScale): CrosswordPuzzle {
  const config = SCALE_CONFIG[scale];
  const size = config.size;
  const sectorsPerSide = config.sectorsPerSide;
  const sectorSpan = Math.floor(size / sectorsPerSide);

  const rng = createRng(size * 1337 + 42);

  // Deduplicate combined vocabulary bank by BOTH word and normalized question/clue
  const uniqueMap = new Map<string, VocabEntry>();
  const uniqueClueKeys = new Set<string>();

  for (const item of [...VOCAB_BANK, ...COLOSSAL_EXTENDED_BANK]) {
    const w = item.word.toUpperCase().replace(/[^A-Z]/g, '');
    if (w.length < 4 || w.length > 12 || uniqueMap.has(w)) continue;
    const cKey = normalizeClueKey(item.standardClue);
    if (!cKey || uniqueClueKeys.has(cKey)) continue;
    uniqueClueKeys.add(cKey);
    uniqueMap.set(w, { ...item, word: w });
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

  const usedWords = new Set<string>();
  const usedClueKeys = new Set<string>();

  function getMaxSpanBounds(r: number, c: number, direction: Direction): { maxBefore: number; maxAfter: number } {
    const dr = direction === 'down' ? 1 : 0;
    const dc = direction === 'across' ? 1 : 0;
    let maxBefore = 0;
    for (let step = 1; step <= 11; step++) {
      const nr = r - dr * step;
      const nc = c - dc * step;
      if (nr < 0 || nc < 0) break;
      if (charGrid[nr][nc] === '') {
        if (direction === 'across') {
          if ((nr > 0 && charGrid[nr - 1][nc] !== '') || (nr < size - 1 && charGrid[nr + 1][nc] !== '')) break;
        } else {
          if ((nc > 0 && charGrid[nr][nc - 1] !== '') || (nc < size - 1 && charGrid[nr][nc + 1] !== '')) break;
        }
      } else {
        if (direction === 'across' && hasAcross[nr][nc]) break;
        if (direction === 'down' && hasDown[nr][nc]) break;
      }
      maxBefore = step;
    }

    let maxAfter = 0;
    for (let step = 1; step <= 11; step++) {
      const nr = r + dr * step;
      const nc = c + dc * step;
      if (nr >= size || nc >= size) break;
      if (charGrid[nr][nc] === '') {
        if (direction === 'across') {
          if ((nr > 0 && charGrid[nr - 1][nc] !== '') || (nr < size - 1 && charGrid[nr + 1][nc] !== '')) break;
        } else {
          if ((nc > 0 && charGrid[nr][nc - 1] !== '') || (nc < size - 1 && charGrid[nr][nc + 1] !== '')) break;
        }
      } else {
        if (direction === 'across' && hasAcross[nr][nc]) break;
        if (direction === 'down' && hasDown[nr][nc]) break;
      }
      maxAfter = step;
    }

    return { maxBefore, maxAfter };
  }

  function canPlaceWord(
    word: string,
    row: number,
    col: number,
    direction: Direction,
    requireIntersection: boolean
  ): number {
    if (usedWords.has(word)) return -1;

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
    usedWords.add(word);
    usedClueKeys.add(normalizeClueKey(entry.standardClue));
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
      const { maxBefore, maxAfter } = getMaxSpanBounds(r, c, targetDir);
      if (maxBefore + maxAfter + 1 < 4) continue;

      const candidates = wordsByChar[ch];
      if (!candidates || candidates.length === 0) continue;

      const startOffset = Math.floor(rng() * candidates.length);
      let bestCandidate: { entry: VocabEntry; startR: number; startC: number; score: number } | null = null;

      const sampleCount = Math.min(candidates.length, 220);
      const step = Math.max(1, Math.floor(candidates.length / sampleCount));

      for (let s = 0; s < sampleCount; s++) {
        const cand = candidates[(startOffset + s * step) % candidates.length];
        if (usedWords.has(cand.entry.word)) continue;
        if (cand.charIdx > maxBefore || cand.entry.word.length - 1 - cand.charIdx > maxAfter) continue;

        const startR = targetDir === 'down' ? r - cand.charIdx : r;
        const startC = targetDir === 'across' ? c - cand.charIdx : c;

        const intersections = canPlaceWord(cand.entry.word, startR, startC, targetDir, true);
        if (intersections > 0) {
          const isPop =
            cand.entry.category === 'Cinema' ||
            cand.entry.category === 'Pop Music' ||
            cand.entry.category === 'Pop Culture';
          const score =
            intersections * 25 +
            cand.entry.word.length * 2 +
            (isPop ? 8 : 0);
          if (!bestCandidate || score > bestCandidate.score) {
            bestCandidate = { entry: cand.entry, startR, startC, score };
            if (intersections >= 2) break;
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
  for (let pass = 0; pass < 3; pass++) {
    let addedInPass = 0;
    for (let r = 1; r < size - 1; r++) {
      for (let c = 1; c < size - 1; c++) {
        const ch = charGrid[r][c];
        if (!ch) continue;
        const needAcross = !hasAcross[r][c];
        const needDown = !hasDown[r][c];
        if (!needAcross && !needDown) continue;

        const targetDir: Direction = needAcross ? 'across' : 'down';
        const { maxBefore, maxAfter } = getMaxSpanBounds(r, c, targetDir);
        if (maxBefore + maxAfter + 1 < 4) continue;

        const candidates = wordsByChar[ch];
        const startOffset = (r * 31 + c * 17 + pass * 101) % candidates.length;

        let bestCandidate: { entry: VocabEntry; startR: number; startC: number; score: number } | null = null;
        const sampleCount = Math.min(180, candidates.length);
        const step = Math.max(1, Math.floor(candidates.length / sampleCount));

        for (let s = 0; s < sampleCount; s++) {
          const cand = candidates[(startOffset + s * step) % candidates.length];
          if (usedWords.has(cand.entry.word)) continue;
          if (cand.charIdx > maxBefore || cand.entry.word.length - 1 - cand.charIdx > maxAfter) continue;

          const startR = targetDir === 'down' ? r - cand.charIdx : r;
          const startC = targetDir === 'across' ? c - cand.charIdx : c;
          const intersections = canPlaceWord(cand.entry.word, startR, startC, targetDir, true);
          if (intersections > 0) {
            const score = intersections * 20 + cand.entry.word.length;
            if (!bestCandidate || score > bestCandidate.score) {
              bestCandidate = { entry: cand.entry, startR, startC, score };
              if (intersections >= 2) break;
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
          const { clue, isCryptic } = buildDistinctClue(aPlacement.entry, occ, sectorInfo.name);
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
          const { clue, isCryptic } = buildDistinctClue(dPlacement.entry, occ, sectorInfo.name);
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

  // Step 4b: Verify and replace any repeating questions or answers in-place without breaking intersections
  checkAndReplaceRepeatingQuestionsAndAnswers(
    cells,
    words,
    wordMap,
    vocabList,
    usedWords,
    usedClueKeys
  );

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
    cells,
    words,
    wordMap,
    quests,
    sectors: activeSectors,
    totalWhiteCells
  };
}
