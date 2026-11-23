import crypto from 'node:crypto';
import type express from 'express';
import {
  getDictionarySize,
  isValidDictionaryWord,
  normalizeGuessWord,
  pickTargetWords,
} from './dictionary.ts';
import {
  applyHint,
  calculateWinnerScore,
  createLadderSet,
  isBoardAllFound,
  toBoardView,
  type InternalLadderSet,
} from './gameEngine.ts';
import {
  normalizeDictionaryLanguage,
  type DictionaryLanguageCode,
} from '../../src/lib/dictionary-languages.ts';
import type {
  GuessFeedItem,
  LadderInstanceView,
  LadderMode,
} from '../../src/mpwh/shared/types.ts';

export interface SoloWordHuntStateView {
  gameId: string;
  mode: LadderMode;
  language: DictionaryLanguageCode;
  dailyDate: string | null;
  status: 'playing' | 'won' | 'gave_up';
  boards: LadderInstanceView[];
  totalGuesses: number;
  hintsRemaining: number;
  hintsUsed: number;
  startedAt: number;
  finishedAt: number | null;
  score: number;
  pieces: number;
  guessFeed: GuessFeedItem[];
  dictionarySize: number;
}

interface SoloSession {
  gameId: string;
  dailyDate: string | null;
  ladderSet: InternalLadderSet;
  guessFeed: GuessFeedItem[];
  score: number;
  pieces: number;
  lastActiveAt: number;
}

const MAX_SOLO_SESSIONS = 4000;
const SOLO_TTL_MS = 2 * 60 * 60 * 1000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidMode(mode: unknown): mode is LadderMode {
  return mode === 'classic' || mode === 'dual' || mode === 'quad';
}

function serializeSoloSession(sess: SoloSession): SoloWordHuntStateView {
  const set = sess.ladderSet;
  const now = Date.now();
  const revealAll = set.status === 'won' || set.status === 'gave_up';

  return {
    gameId: sess.gameId,
    mode: set.mode,
    language: set.language,
    dailyDate: sess.dailyDate,
    status: set.status === 'idle' ? 'playing' : set.status,
    boards: set.boards.map((b) => toBoardView(b, revealAll, set.language, now)),
    totalGuesses: set.totalGuesses,
    hintsRemaining: set.hintsRemaining,
    hintsUsed: set.hintsUsed,
    startedAt: set.startedAt ?? now,
    finishedAt: set.finishedAt,
    score: sess.score,
    pieces: sess.pieces,
    guessFeed: sess.guessFeed,
    dictionarySize: getDictionarySize(set.language),
  };
}

function pushSoloGuessFeed(
  sess: SoloSession,
  word: string,
  status: GuessFeedItem['status'],
  alreadyGuessed = false
): void {
  sess.guessFeed.unshift({
    id: crypto.randomUUID(),
    playerName: 'You',
    word,
    alreadyGuessed,
    status,
    timestamp: Date.now(),
  });
  if (sess.guessFeed.length > 60) {
    sess.guessFeed.length = 60;
  }
}

function applySoloGuessInternal(
  sess: SoloSession,
  rawWord: string,
  targetBoardIndex?: number | null
): {
  accepted: boolean;
  alreadyGuessed?: boolean;
  reason?: string;
  word: string;
  matchedWords: string[];
  allSolved: boolean;
} {
  const set = sess.ladderSet;
  if (set.status !== 'playing') {
    return {
      accepted: false,
      word: '',
      reason: 'This round has already ended. Start a new round!',
      matchedWords: [],
      allSolved: set.status === 'won',
    };
  }

  const word = normalizeGuessWord(rawWord);
  if (word.length < 2 || word.length > 32) {
    return {
      accepted: false,
      word,
      reason: 'Words must be at least 2 letters long.',
      matchedWords: [],
      allSolved: false,
    };
  }

  if (!isValidDictionaryWord(word, set.language)) {
    return {
      accepted: false,
      word,
      reason: `"${word.toUpperCase()}" is not in the active dictionary.`,
      matchedWords: [],
      allSolved: false,
    };
  }

  const candidateBoards =
    set.mode === 'quad' &&
    typeof targetBoardIndex === 'number' &&
    targetBoardIndex >= 0 &&
    targetBoardIndex < set.boards.length
      ? [set.boards[targetBoardIndex]]
      : set.boards.filter((b) => !isBoardAllFound(b));

  const activeUnsolvedBoards = candidateBoards.filter((b) => !isBoardAllFound(b));
  if (activeUnsolvedBoards.length === 0) {
    return {
      accepted: false,
      word,
      reason: 'That board is already solved.',
      matchedWords: [],
      allSolved: set.boards.every((b) => isBoardAllFound(b)),
    };
  }

  const boardsNeedingWord = activeUnsolvedBoards.filter((b) => !b.guessWordSet.has(word));
  if (boardsNeedingWord.length === 0) {
    pushSoloGuessFeed(sess, word, 'duplicate', true);
    return {
      accepted: false,
      alreadyGuessed: true,
      word,
      reason: `You already guessed "${word.toUpperCase()}".`,
      matchedWords: [],
      allSolved: false,
    };
  }

  const now = Date.now();
  set.totalGuesses += 1;
  const matchedWords: string[] = [];

  for (const board of boardsNeedingWord) {
    board.guessWordSet.add(word);
    board.lastGuessWord = word;
    let matchedTarget = false;

    for (const target of board.targets) {
      if (!target.solved && target.word === word) {
        target.solved = true;
        target.firstSolvedAt = now;
        // Single-player resolves immediately with zero stream-lag delay
        target.bufferEndsAt = null;
        target.solvedAtGuess = set.totalGuesses;
        target.winners.push({
          name: 'You',
          guessedAt: now,
          isFirst: true,
          word: target.word,
        });
        matchedTarget = true;
        matchedWords.push(target.word);
      }
    }

    if (!matchedTarget) {
      board.guesses.push({
        word,
        order: set.totalGuesses,
        isHint: false,
        guessedBy: 'You',
        timestamp: now,
      });
    }
  }

  pushSoloGuessFeed(sess, word, matchedWords.length > 0 ? 'solved' : 'guess', false);

  const allSolved = set.boards.every((b) => isBoardAllFound(b));
  if (allSolved) {
    set.status = 'won';
    set.finishedAt = now;
    const totalTargets = set.boards.reduce((acc, b) => acc + b.targets.length, 0);
    const durationMs = Math.max(1000, now - (set.startedAt ?? now));
    const { score, pieces } = calculateWinnerScore(
      set.mode,
      set.totalGuesses,
      set.hintsUsed,
      durationMs,
      totalTargets,
      totalTargets
    );
    sess.score = score;
    sess.pieces = pieces;
  }

  sess.lastActiveAt = now;
  return {
    accepted: true,
    word,
    matchedWords,
    allSolved,
  };
}

export function mountMpwhSoloRoutes(app: express.Express): void {
  const soloSessions = new Map<string, SoloSession>();

  const pruneSessions = () => {
    const cutoff = Date.now() - SOLO_TTL_MS;
    for (const [id, sess] of soloSessions.entries()) {
      if (sess.lastActiveAt < cutoff) {
        soloSessions.delete(id);
      }
    }
    if (soloSessions.size > MAX_SOLO_SESSIONS) {
      const oldest = Array.from(soloSessions.entries()).sort(
        (a, b) => a[1].lastActiveAt - b[1].lastActiveAt
      );
      const excess = soloSessions.size - MAX_SOLO_SESSIONS;
      for (let i = 0; i < excess; i++) {
        soloSessions.delete(oldest[i][0]);
      }
    }
  };

  const cleanupTimer = setInterval(pruneSessions, 15 * 60 * 1000);
  cleanupTimer.unref();

  app.post('/api/mpwh/solo/start', (req, res) => {
    pruneSessions();
    const mode: LadderMode = isValidMode(req.body?.mode) ? req.body.mode : 'classic';
    const language = normalizeDictionaryLanguage(req.body?.language);
    const rawDaily = typeof req.body?.dailyDate === 'string' ? req.body.dailyDate.trim() : '';
    const dailyDate = ISO_DATE_RE.test(rawDaily) ? rawDaily : null;

    const secretWords = pickTargetWords(mode, language, dailyDate ?? undefined);
    const ladderSet = createLadderSet(mode, secretWords, language);
    if (mode === 'classic' && ladderSet.boards[0]) {
      ladderSet.boards[0].label = dailyDate ? 'Daily Word Hunt' : 'Word Hunt';
    }

    const gameId = crypto.randomUUID();
    const sess: SoloSession = {
      gameId,
      dailyDate,
      ladderSet,
      guessFeed: [],
      score: 0,
      pieces: 0,
      lastActiveAt: Date.now(),
    };

    // Optional deterministic replay for restoring in-progress Daily puzzles after reload
    const replayActions = Array.isArray(req.body?.replayActions)
      ? req.body.replayActions.slice(0, 200)
      : [];
    for (const action of replayActions) {
      if (!action || typeof action !== 'object') continue;
      if (action.type === 'guess' && typeof action.word === 'string') {
        const boardIdx =
          typeof action.targetBoardIndex === 'number' ? action.targetBoardIndex : null;
        applySoloGuessInternal(sess, action.word, boardIdx);
      } else if (
        action.type === 'hint' &&
        (action.hintType === 'bracket' || action.hintType === 'clue') &&
        typeof action.boardIndex === 'number' &&
        typeof action.targetIndex === 'number'
      ) {
        applyHint(sess.ladderSet, action.hintType, action.boardIndex, action.targetIndex, 'You');
      } else if (action.type === 'reveal') {
        sess.ladderSet.status = 'gave_up';
        sess.ladderSet.finishedAt = Date.now();
      }
    }

    soloSessions.set(gameId, sess);
    res.json({ state: serializeSoloSession(sess) });
  });

  app.post('/api/mpwh/solo/guess', (req, res) => {
    const gameId = typeof req.body?.gameId === 'string' ? req.body.gameId.trim() : '';
    const sess = soloSessions.get(gameId);
    if (!sess) {
      res.status(404).json({
        accepted: false,
        reason: 'Session expired. Starting a fresh board...',
        expired: true,
      });
      return;
    }

    const word = typeof req.body?.word === 'string' ? req.body.word : '';
    const targetBoardIndex =
      typeof req.body?.targetBoardIndex === 'number' ? req.body.targetBoardIndex : null;

    const outcome = applySoloGuessInternal(sess, word, targetBoardIndex);
    res.json({
      outcome,
      state: serializeSoloSession(sess),
    });
  });

  app.post('/api/mpwh/solo/hint', (req, res) => {
    const gameId = typeof req.body?.gameId === 'string' ? req.body.gameId.trim() : '';
    const sess = soloSessions.get(gameId);
    if (!sess) {
      res.status(404).json({ ok: false, error: 'Session expired.', expired: true });
      return;
    }

    const hintType = req.body?.hintType === 'clue' ? 'clue' : 'bracket';
    const boardIndex = Number(req.body?.boardIndex ?? 0);
    const targetIndex = Number(req.body?.targetIndex ?? 0);
    if (!Number.isInteger(boardIndex) || !Number.isInteger(targetIndex)) {
      res.status(400).json({ ok: false, error: 'Invalid hint target.' });
      return;
    }

    const result = applyHint(sess.ladderSet, hintType, boardIndex, targetIndex, 'You');
    sess.lastActiveAt = Date.now();
    if (!result.accepted) {
      res.json({
        ok: false,
        error: result.reason ?? 'Hint unavailable.',
        state: serializeSoloSession(sess),
      });
      return;
    }

    res.json({
      ok: true,
      hintWord: result.hintWord,
      clueText: result.clueText,
      state: serializeSoloSession(sess),
    });
  });

  app.post('/api/mpwh/solo/reveal', (req, res) => {
    const gameId = typeof req.body?.gameId === 'string' ? req.body.gameId.trim() : '';
    const sess = soloSessions.get(gameId);
    if (!sess) {
      res.status(404).json({ ok: false, error: 'Session expired.', expired: true });
      return;
    }

    if (sess.ladderSet.status === 'playing') {
      sess.ladderSet.status = 'gave_up';
      sess.ladderSet.finishedAt = Date.now();
    }
    sess.lastActiveAt = Date.now();
    res.json({ ok: true, state: serializeSoloSession(sess) });
  });
}
