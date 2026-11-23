import {
  computeBisectHint,
  computeProximityPct,
  isValidDictionaryWord,
  normalizeGuessWord,
} from './dictionary.ts';
import type { DictionaryLanguageCode } from '../../src/lib/dictionary-languages.ts';
import type {
  GameStatus,
  GuessEntry,
  LadderInstanceView,
  LadderMode,
  LadderTargetView,
  TargetWinner,
} from '../../src/mpwh/shared/types.ts';

/** 4-second grace window so delayed TikTok LIVE viewers submitting the right word still count as winners */
export const STREAM_LAG_BUFFER_MS = 4000;

/** 15-second celebration delay before the next round auto-starts */
export const NEXT_ROUND_DELAY_MS = 15000;

export interface InternalTarget {
  index: number;
  word: string;
  solved: boolean;
  firstSolvedAt: number | null;
  bufferEndsAt: number | null;
  solvedAtGuess: number | null;
  clueLevel: number;
  winners: TargetWinner[];
}

export interface InternalBoard {
  boardIndex: number;
  label: string;
  targets: InternalTarget[];
  guesses: GuessEntry[];
  guessWordSet: Set<string>;
  lastGuessWord: string | null;
}

export interface InternalLadderSet {
  mode: LadderMode;
  language: DictionaryLanguageCode;
  status: GameStatus;
  boards: InternalBoard[];
  totalGuesses: number;
  hintsRemaining: number;
  hintsUsed: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export function getInitialHints(mode: LadderMode): number {
  if (mode === 'classic') return 3;
  if (mode === 'dual') return 4;
  return 6;
}

export function createLadderSet(
  mode: LadderMode,
  secretWords: string[],
  language: DictionaryLanguageCode = 'en'
): InternalLadderSet {
  const boards: InternalBoard[] = [];

  if (mode === 'classic') {
    boards.push({
      boardIndex: 0,
      label: 'Word Hunt Extreme',
      targets: [
        {
          index: 0,
          word: secretWords[0],
          solved: false,
          firstSolvedAt: null,
          bufferEndsAt: null,
          solvedAtGuess: null,
          clueLevel: 0,
          winners: [],
        },
      ],
      guesses: [],
      guessWordSet: new Set(),
      lastGuessWord: null,
    });
  } else if (mode === 'dual') {
    const sorted = [...secretWords].slice(0, 2).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    boards.push({
      boardIndex: 0,
      label: 'Dual Ladder',
      targets: sorted.map((w, idx) => ({
        index: idx,
        word: w,
        solved: false,
        firstSolvedAt: null,
        bufferEndsAt: null,
        solvedAtGuess: null,
        clueLevel: 0,
        winners: [],
      })),
      guesses: [],
      guessWordSet: new Set(),
      lastGuessWord: null,
    });
  } else {
    secretWords.slice(0, 4).forEach((w, bIdx) => {
      boards.push({
        boardIndex: bIdx,
        label: `Board ${bIdx + 1}`,
        targets: [
          {
            index: 0,
            word: w,
            solved: false,
            firstSolvedAt: null,
            bufferEndsAt: null,
            solvedAtGuess: null,
            clueLevel: 0,
            winners: [],
          },
        ],
        guesses: [],
        guessWordSet: new Set(),
        lastGuessWord: null,
      });
    });
  }

  return {
    mode,
    language,
    status: 'playing',
    boards,
    totalGuesses: 0,
    hintsRemaining: getInitialHints(mode),
    hintsUsed: 0,
    startedAt: Date.now(),
    finishedAt: null,
  };
}

export function isTargetBufferActive(target: InternalTarget, now: number): boolean {
  return target.solved && target.bufferEndsAt !== null && now < target.bufferEndsAt;
}

export function isTargetLockedSolved(target: InternalTarget, now: number): boolean {
  return target.solved && !isTargetBufferActive(target, now);
}

export function isBoardAllFound(board: InternalBoard): boolean {
  return board.targets.every((t) => t.solved);
}

export function isBoardLockedSolved(board: InternalBoard, now: number): boolean {
  return board.targets.every((t) => isTargetLockedSolved(t, now));
}

export function areAllTargetsLockedSolved(set: InternalLadderSet, now: number): boolean {
  return set.boards.every((b) => isBoardLockedSolved(b, now));
}

export function getLongestCommonPrefix(a: string | null, b: string | null): string {
  if (!a || !b) return '';
  const len = Math.min(a.length, b.length);
  let i = 0;
  while (i < len && a[i] === b[i]) {
    i++;
  }
  return a.slice(0, i);
}

export interface ApplyGuessResult {
  accepted: boolean;
  alreadyGuessed?: boolean;
  reason?: string;
  word: string;
  firstSolvedWords: string[];
  bufferMatchedWords: string[];
  newBufferEndsAt: number | null;
}

export function applyGuess(
  set: InternalLadderSet,
  rawWord: string,
  guessedBy: string,
  targetBoardIndex?: number | null,
  tiktokHandle?: string,
  avatarUrl?: string
): ApplyGuessResult {
  if (set.status !== 'playing') {
    return {
      accepted: false,
      reason: 'Press Start Game to begin a round.',
      word: '',
      firstSolvedWords: [],
      bufferMatchedWords: [],
      newBufferEndsAt: null,
    };
  }

  const word = normalizeGuessWord(rawWord);
  if (word.length < 4 || word.length > 8) {
    return {
      accepted: false,
      reason: 'Words must be 4–8 letters long.',
      word,
      firstSolvedWords: [],
      bufferMatchedWords: [],
      newBufferEndsAt: null,
    };
  }

  if (!isValidDictionaryWord(word, set.language)) {
    return {
      accepted: false,
      reason: `"${word.toUpperCase()}" is not in the active dictionary.`,
      word,
      firstSolvedWords: [],
      bufferMatchedWords: [],
      newBufferEndsAt: null,
    };
  }

  const now = Date.now();

  // First check if this exact word matches any target currently inside its 4-second stream-lag buffer
  const bufferMatchedWords: string[] = [];
  for (const board of set.boards) {
    for (const target of board.targets) {
      if (isTargetBufferActive(target, now) && target.word === word) {
        const alreadyWinner = target.winners.some(
          (w) => w.name.toLowerCase() === guessedBy.toLowerCase()
        );
        if (!alreadyWinner) {
          target.winners.push({
            name: guessedBy,
            tiktokHandle,
            avatarUrl,
            guessedAt: now,
            isFirst: false,
            word: target.word,
          });
        }
        bufferMatchedWords.push(target.word);
      }
    }
  }

  if (bufferMatchedWords.length > 0) {
    return {
      accepted: true,
      word,
      firstSolvedWords: [],
      bufferMatchedWords,
      newBufferEndsAt: null,
    };
  }

  // Apply guess to unsolved boards
  const candidateBoards =
    set.mode === 'quad' &&
    typeof targetBoardIndex === 'number' &&
    targetBoardIndex >= 0 &&
    targetBoardIndex < 4
      ? [set.boards[targetBoardIndex]]
      : set.boards.filter((b) => !isBoardAllFound(b));

  const activeUnsolvedBoards = candidateBoards.filter((b) => !isBoardAllFound(b));
  if (activeUnsolvedBoards.length === 0) {
    return {
      accepted: false,
      reason: 'All words found — finishing 4-second lag window...',
      word,
      firstSolvedWords: [],
      bufferMatchedWords: [],
      newBufferEndsAt: null,
    };
  }

  const boardsNeedingWord = activeUnsolvedBoards.filter((b) => !b.guessWordSet.has(word));
  if (boardsNeedingWord.length === 0) {
    return {
      accepted: false,
      alreadyGuessed: true,
      reason: `Already guessed "${word.toUpperCase()}".`,
      word,
      firstSolvedWords: [],
      bufferMatchedWords: [],
      newBufferEndsAt: null,
    };
  }

  set.totalGuesses += 1;
  const firstSolvedWords: string[] = [];
  let newBufferEndsAt: number | null = null;

  for (const board of boardsNeedingWord) {
    board.guessWordSet.add(word);
    board.lastGuessWord = word;
    let matchedTarget = false;

    for (const target of board.targets) {
      if (!target.solved && target.word === word) {
        target.solved = true;
        target.firstSolvedAt = now;
        target.bufferEndsAt = now + STREAM_LAG_BUFFER_MS;
        target.solvedAtGuess = set.totalGuesses;
        target.winners.push({
          name: guessedBy,
          tiktokHandle,
          avatarUrl,
          guessedAt: now,
          isFirst: true,
          word: target.word,
        });
        matchedTarget = true;
        firstSolvedWords.push(target.word);
        newBufferEndsAt = target.bufferEndsAt;
      }
    }

    if (!matchedTarget) {
      board.guesses.push({
        word,
        order: set.totalGuesses,
        isHint: false,
        guessedBy,
        timestamp: now,
      });
    }
  }

  return {
    accepted: true,
    word,
    firstSolvedWords,
    bufferMatchedWords: [],
    newBufferEndsAt,
  };
}

export function checkAndFinalizeRound(set: InternalLadderSet, now = Date.now()): boolean {
  if (set.status !== 'playing') return false;
  if (areAllTargetsLockedSolved(set, now)) {
    set.status = 'won';
    set.finishedAt = now;
    return true;
  }
  return false;
}

export interface ApplyHintResult {
  accepted: boolean;
  reason?: string;
  hintWord?: string;
  clueText?: string;
}

export function applyHint(
  set: InternalLadderSet,
  hintType: 'bracket' | 'clue',
  boardIndex: number,
  targetIndex: number,
  requestedBy?: string
): ApplyHintResult {
  if (set.status !== 'playing') {
    return { accepted: false, reason: 'Round is not active.' };
  }
  if (set.hintsRemaining <= 0) {
    return { accepted: false, reason: 'No hints remaining for this round.' };
  }
  const board = set.boards[boardIndex];
  if (!board) {
    return { accepted: false, reason: 'Invalid board.' };
  }
  const target = board.targets[targetIndex];
  if (!target || target.solved) {
    return { accepted: false, reason: 'That word is already found.' };
  }

  if (hintType === 'clue') {
    const maxClue = Math.min(3, target.word.length - 1);
    if (target.clueLevel >= maxClue) {
      return { accepted: false, reason: 'Maximum letter clues already revealed.' };
    }
    target.clueLevel += 1;
    set.hintsRemaining -= 1;
    set.hintsUsed += 1;
    return {
      accepted: true,
      clueText: `${target.word.length} letters · starts with "${target.word
        .slice(0, target.clueLevel)
        .toUpperCase()}"`,
    };
  }

  const now = Date.now();
  const { closestBefore, closestAfter } = getClosestBoundsForTarget(board, targetIndex, now);
  const used = new Set(board.guessWordSet);
  for (const t of board.targets) {
    used.add(t.word);
  }

  const hintWord = computeBisectHint(
    target.word,
    closestBefore?.word ?? null,
    closestAfter?.word ?? null,
    used,
    set.language
  );

  if (!hintWord) {
    return {
      accepted: false,
      reason: 'Bracket is already maximally tight — try a Letter Clue!',
    };
  }

  set.hintsRemaining -= 1;
  set.hintsUsed += 1;
  board.guessWordSet.add(hintWord);
  board.lastGuessWord = hintWord;
  board.guesses.push({
    word: hintWord,
    order: set.totalGuesses,
    isHint: true,
    guessedBy: requestedBy,
    timestamp: now,
  });

  return {
    accepted: true,
    hintWord,
  };
}

function getClosestBoundsForTarget(
  board: InternalBoard,
  targetIndex: number,
  now: number
): { closestBefore: GuessEntry | null; closestAfter: GuessEntry | null } {
  const targetWord = board.targets[targetIndex].word;
  let closestBefore: GuessEntry | null = null;
  let closestAfter: GuessEntry | null = null;

  const candidates: GuessEntry[] = [...board.guesses];

  // In Dual mode, once the sibling target's 4s buffer finishes, it also acts as a bound
  for (const other of board.targets) {
    if (other.index !== targetIndex && isTargetLockedSolved(other, now)) {
      candidates.push({
        word: other.word,
        order: other.solvedAtGuess ?? 0,
        isHint: false,
        guessedBy: other.winners[0]?.name,
        timestamp: other.firstSolvedAt ?? now,
      });
    }
  }

  for (const entry of candidates) {
    if (entry.word < targetWord) {
      if (!closestBefore || entry.word > closestBefore.word) {
        closestBefore = entry;
      }
    } else if (entry.word > targetWord) {
      if (!closestAfter || entry.word < closestAfter.word) {
        closestAfter = entry;
      }
    }
  }

  return { closestBefore, closestAfter };
}

export function calculateWinnerScore(
  mode: LadderMode,
  guesses: number,
  hintsUsed: number,
  durationMs: number,
  wordsFoundCount: number,
  firstSolvesCount: number
): { score: number; pieces: number } {
  const basePerWord = mode === 'classic' ? 1000 : mode === 'dual' ? 950 : 850;
  const parGuesses = mode === 'classic' ? 8 : mode === 'dual' ? 14 : 20;
  const extraGuesses = Math.max(0, guesses - parGuesses);
  const guessPenalty = extraGuesses * 18;
  const efficiencyBonus = Math.max(0, (parGuesses - guesses) * 45);
  const hintPenalty = hintsUsed * 80;
  const seconds = Math.max(1, Math.floor(durationMs / 1000));
  const speedBonus = Math.max(0, Math.round(180 - seconds * 0.8));
  const firstSolveBonus = firstSolvesCount * 150;

  const score = Math.max(
    150,
    Math.round(
      basePerWord * wordsFoundCount +
        efficiencyBonus +
        speedBonus +
        firstSolveBonus -
        guessPenalty -
        hintPenalty
    )
  );

  const pieces = Math.max(5, Math.round(score / 45));
  return { score, pieces };
}

export function toBoardView(
  board: InternalBoard,
  revealAll: boolean,
  language: DictionaryLanguageCode = 'en',
  now = Date.now()
): LadderInstanceView {
  const targets: LadderTargetView[] = board.targets.map((t, idx) => {
    const { closestBefore, closestAfter } = getClosestBoundsForTarget(board, idx, now);
    const bufferActive = isTargetBufferActive(t, now);
    const revealed = revealAll || t.solved;
    const sharedPrefix = getLongestCommonPrefix(
      closestBefore?.word ?? null,
      closestAfter?.word ?? null
    );

    return {
      index: t.index,
      solved: t.solved,
      bufferActive,
      bufferEndsAt: bufferActive ? t.bufferEndsAt : null,
      word: revealed ? t.word : null,
      revealedLength: t.word.length,
      revealedPrefix: revealed
        ? t.word
        : t.clueLevel > 0
        ? t.word.slice(0, t.clueLevel)
        : null,
      sharedPrefix,
      solvedAtGuess: t.solvedAtGuess,
      winners: t.winners.map((w) => ({
        ...w,
        word: revealed ? w.word : '',
      })),
      closestBefore,
      closestAfter,
      proximityPct: computeProximityPct(
        t.word,
        closestBefore?.word ?? null,
        closestAfter?.word ?? null,
        t.solved,
        language
      ),
    };
  });

  return {
    boardIndex: board.boardIndex,
    label: board.label,
    targets,
    solved: isBoardAllFound(board),
    lockedSolved: isBoardLockedSolved(board, now),
    guessCount: board.guesses.length + board.targets.filter((t) => t.solved).length,
    lastGuessWord: board.lastGuessWord,
  };
}
