import { getDictionary } from './dictionary';
import { BoardValidation, PuzzleTile, WordSpan } from './types';

/**
 * Reconstructs the full character grid (tileRows*3 by tileCols*3) from the current tile order.
 */
export function buildFullGrid(
  tileOrder: number[],
  solvedTiles: PuzzleTile[],
  tileRows: number,
  tileCols: number
): string[][] {
  const rows = tileRows * 3;
  const cols = tileCols * 3;
  const grid: string[][] = Array.from({ length: rows }, () => Array<string>(cols).fill('#'));

  for (let slot = 0; slot < tileOrder.length; slot++) {
    const tileId = tileOrder[slot];
    const tile = solvedTiles[tileId];
    const tRow = Math.floor(slot / tileCols);
    const tCol = slot % tileCols;

    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        grid[tRow * 3 + dr][tCol * 3 + dc] = tile.cells[dr][dc];
      }
    }
  }

  return grid;
}

/**
 * Validates the current tile arrangement against the standard word game dictionary.
 * A board is solved if:
 * 1) Either it matches the exact target tile arrangement, OR
 * 2) Every horizontal and vertical run of length >= 2 is a valid dictionary word,
 *    there are zero isolated single-letter white cells, and at least one word exists.
 */
export function validateBoard(
  tileOrder: number[],
  solvedTiles: PuzzleTile[],
  tileRows: number,
  tileCols: number,
  targetWordCount: number
): BoardValidation {
  const { validWords } = getDictionary();
  const grid = buildFullGrid(tileOrder, solvedTiles, tileRows, tileCols);
  const rows = tileRows * 3;
  const cols = tileCols * 3;

  const allWords: WordSpan[] = [];
  const validCrossSeamWords: WordSpan[] = [];

  // Extract horizontal runs
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (grid[r][c] === '#') {
        c++;
        continue;
      }
      const start = c;
      let word = '';
      while (c < cols && grid[r][c] !== '#') {
        word += grid[r][c];
        c++;
      }
      if (word.length >= 2) {
        const end = c - 1;
        const spansMultipleTiles = Math.floor(start / 3) !== Math.floor(end / 3);
        const isValid = validWords.has(word);
        const span: WordSpan = {
          word,
          direction: 'across',
          row: r,
          col: start,
          length: word.length,
          isValid,
          spansMultipleTiles,
        };
        allWords.push(span);
        if (isValid && spansMultipleTiles) {
          validCrossSeamWords.push(span);
        }
      }
    }
  }

  // Extract vertical runs
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      if (grid[r][c] === '#') {
        r++;
        continue;
      }
      const start = r;
      let word = '';
      while (r < rows && grid[r][c] !== '#') {
        word += grid[r][c];
        r++;
      }
      if (word.length >= 2) {
        const end = r - 1;
        const spansMultipleTiles = Math.floor(start / 3) !== Math.floor(end / 3);
        const isValid = validWords.has(word);
        const span: WordSpan = {
          word,
          direction: 'down',
          row: start,
          col: c,
          length: word.length,
          isValid,
          spansMultipleTiles,
        };
        allWords.push(span);
        if (isValid && spansMultipleTiles) {
          validCrossSeamWords.push(span);
        }
      }
    }
  }

  // Count isolated white cells (not part of any horizontal or vertical run of length >= 2)
  let isolatedCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === '#') continue;
      const hasH =
        (c > 0 && grid[r][c - 1] !== '#') || (c + 1 < cols && grid[r][c + 1] !== '#');
      const hasV =
        (r > 0 && grid[r - 1][c] !== '#') || (r + 1 < rows && grid[r + 1][c] !== '#');
      if (!hasH && !hasV) {
        isolatedCount++;
      }
    }
  }

  const isExactSolution = tileOrder.every((tileId, slotIdx) => tileId === slotIdx);
  const allDictionaryValid =
    allWords.length > 0 && isolatedCount === 0 && allWords.every((w) => w.isValid);

  return {
    isSolved: isExactSolution || allDictionaryValid,
    allWords,
    validCrossSeamWords,
    totalExpectedWords: targetWordCount,
    isolatedCount,
  };
}
