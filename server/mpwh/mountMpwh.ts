import crypto from 'node:crypto';
import type express from 'express';
import type { Namespace, Server as SocketIOServer } from 'socket.io';
import { getDictionarySize, normalizeGuessWord, pickTargetWords } from './dictionary.ts';
import {
  applyGuess,
  applyHint,
  calculateWinnerScore,
  checkAndFinalizeRound,
  createLadderSet,
  getInitialHints,
  NEXT_ROUND_DELAY_MS,
  STREAM_LAG_BUFFER_MS,
  toBoardView,
  type InternalLadderSet,
} from './gameEngine.ts';
import { addLeaderboardEntry, getLeaderboard } from './leaderboardStore.ts';
import {
  normalizeDictionaryLanguage,
  type DictionaryLanguageCode,
} from '../../src/lib/dictionary-languages.ts';
import type {
  ActivityFeedItem,
  GuessFeedItem,
  GuessOutcomePayload,
  LadderMode,
  LeaderboardEntry,
  LiveGameStateView,
  RoundWinnerSummary,
} from '../../src/mpwh/shared/types.ts';

interface ChannelSession {
  channel: string;
  roundId: string;
  roundNumber: number;
  mode: LadderMode;
  language: DictionaryLanguageCode;
  ladderSet: InternalLadderSet | null;
  nextRoundAt: number | null;
  roundWinners: RoundWinnerSummary[];
  recentActivity: ActivityFeedItem[];
  guessFeed: GuessFeedItem[];
  bufferTimers: Set<ReturnType<typeof setTimeout>>;
  nextRoundTimer: ReturnType<typeof setTimeout> | null;
  autoNextRound: boolean;
  lastActiveAt: number;
}

function sanitizeChannel(raw: unknown): string {
  const cleaned = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 48);
  return cleaned || 'global';
}

function sanitizeName(raw: unknown): string {
  const cleaned = String(raw ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 26);
  return cleaned || 'Player';
}

function isValidMode(mode: unknown): mode is LadderMode {
  return mode === 'classic' || mode === 'dual' || mode === 'quad';
}

/**
 * Extracts a candidate 4-8 letter guess word from a TikTok chat comment.
 * Supports plain single-word guesses ("castle") and optional command prefix ("!guess castle" or "/g castle").
 * Multi-word conversational sentences return null so normal chat doesn't spam invalid errors.
 */
export function extractWordGuessFromChat(comment: string): string | null {
  const trimmed = String(comment || '').trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  const cmdMatch = trimmed.match(/^(?:!guess|!g|!word|!w|\/g)\s+([^\s]+)$/i);
  if (cmdMatch) {
    candidate = cmdMatch[1];
  } else {
    // Strip trailing punctuation like "castle!" or "castle?"
    const stripped = trimmed.replace(/^[.,!?;:'"()[\]]+|[.,!?;:'"()[\]]+$/g, '');
    if (/\s/.test(stripped)) return null;
    candidate = stripped;
  }

  const normalized = normalizeGuessWord(candidate);
  if (normalized.length < 4 || normalized.length > 8) return null;
  return normalized;
}

export class MpwhManager {
  private readonly ns: Namespace;
  private readonly channels = new Map<string, ChannelSession>();

  constructor(ns: Namespace) {
    this.ns = ns;
    // Periodically clean up long-idle non-global sessions (older than 4 hours)
    const cleanup = setInterval(() => {
      const cutoff = Date.now() - 4 * 60 * 60 * 1000;
      for (const [ch, sess] of this.channels.entries()) {
        if (ch === 'global') continue;
        const room = this.ns.adapter.rooms.get(ch);
        if ((!room || room.size === 0) && sess.lastActiveAt < cutoff) {
          this.clearChannelTimers(sess);
          this.channels.delete(ch);
        }
      }
    }, 30 * 60 * 1000);
    cleanup.unref();
  }

  public getOrCreateChannel(rawChannel?: string): ChannelSession {
    const channel = sanitizeChannel(rawChannel);
    let sess = this.channels.get(channel);
    if (!sess) {
      sess = {
        channel,
        roundId: 'idle',
        roundNumber: 0,
        mode: 'classic',
        language: 'en',
        ladderSet: null,
        nextRoundAt: null,
        roundWinners: [],
        recentActivity: [],
        guessFeed: [],
        bufferTimers: new Set(),
        nextRoundTimer: null,
        autoNextRound: true,
        lastActiveAt: Date.now(),
      };
      this.channels.set(channel, sess);
    }
    sess.lastActiveAt = Date.now();
    return sess;
  }

  private clearChannelTimers(sess: ChannelSession): void {
    for (const t of sess.bufferTimers) {
      clearTimeout(t);
    }
    sess.bufferTimers.clear();
    if (sess.nextRoundTimer) {
      clearTimeout(sess.nextRoundTimer);
      sess.nextRoundTimer = null;
    }
    sess.nextRoundAt = null;
  }

  private pushActivity(
    sess: ChannelSession,
    text: string,
    tone: ActivityFeedItem['tone'] = 'neutral'
  ): void {
    sess.recentActivity.unshift({
      id: crypto.randomUUID(),
      text,
      timestamp: Date.now(),
      tone,
    });
    if (sess.recentActivity.length > 24) {
      sess.recentActivity.length = 24;
    }
  }

  private pushGuessFeed(
    sess: ChannelSession,
    entry: Omit<GuessFeedItem, 'id' | 'timestamp'>
  ): void {
    sess.guessFeed.unshift({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...entry,
    });
    if (sess.guessFeed.length > 40) {
      sess.guessFeed.length = 40;
    }
  }

  private getOnlineCount(channel: string): number {
    return this.ns.adapter.rooms.get(channel)?.size ?? 0;
  }

  public serializeGame(sess: ChannelSession): LiveGameStateView {
    const now = Date.now();
    if (!sess.ladderSet) {
      return {
        channel: sess.channel,
        roundId: sess.roundId,
        roundNumber: sess.roundNumber,
        mode: sess.mode,
        language: sess.language,
        status: 'idle',
        boards: [],
        totalGuesses: 0,
        hintsRemaining: getInitialHints(sess.mode),
        hintsUsed: 0,
        startedAt: null,
        finishedAt: null,
        nextRoundAt: null,
        serverNow: now,
        roundWinners: [],
        recentActivity: sess.recentActivity,
        guessFeed: sess.guessFeed,
      };
    }

    const revealAll =
      sess.ladderSet.status === 'won' || sess.ladderSet.status === 'gave_up';

    return {
      channel: sess.channel,
      roundId: sess.roundId,
      roundNumber: sess.roundNumber,
      mode: sess.ladderSet.mode,
      language: sess.ladderSet.language,
      status: sess.ladderSet.status,
      boards: sess.ladderSet.boards.map((b) =>
        toBoardView(b, revealAll, sess.ladderSet!.language, now)
      ),
      totalGuesses: sess.ladderSet.totalGuesses,
      hintsRemaining: sess.ladderSet.hintsRemaining,
      hintsUsed: sess.ladderSet.hintsUsed,
      startedAt: sess.ladderSet.startedAt,
      finishedAt: sess.ladderSet.finishedAt,
      nextRoundAt: sess.nextRoundAt,
      serverNow: now,
      roundWinners: sess.roundWinners,
      recentActivity: sess.recentActivity,
      guessFeed: sess.guessFeed,
    };
  }

  private broadcastGameState(sess: ChannelSession): void {
    this.ns.to(sess.channel).emit('mpwh:game_state', this.serializeGame(sess));
  }

  public broadcastPresence(channel: string): void {
    this.ns.to(channel).emit('mpwh:presence', {
      onlineCount: this.getOnlineCount(channel),
    });
  }

  private finalizeRoundAndRecordWinners(sess: ChannelSession): void {
    const set = sess.ladderSet;
    if (!set) return;

    const now = Date.now();
    const durationMs = set.startedAt ? Math.max(1000, now - set.startedAt) : 1000;

    const winnerMap = new Map<
      string,
      { name: string; tiktokHandle?: string; wordsFound: Set<string>; firstSolves: number }
    >();

    for (const board of set.boards) {
      for (const target of board.targets) {
        for (const w of target.winners) {
          const key = w.name.toLowerCase();
          let record = winnerMap.get(key);
          if (!record) {
            record = {
              name: w.name,
              tiktokHandle: w.tiktokHandle,
              wordsFound: new Set(),
              firstSolves: 0,
            };
            winnerMap.set(key, record);
          }
          if (!record.tiktokHandle && w.tiktokHandle) {
            record.tiktokHandle = w.tiktokHandle;
          }
          record.wordsFound.add(target.word);
          if (w.isFirst) record.firstSolves += 1;
        }
      }
    }

    const summaries: RoundWinnerSummary[] = [];
    let latestEntry: LeaderboardEntry | undefined;

    for (const record of winnerMap.values()) {
      const wordsFoundArr = Array.from(record.wordsFound);
      const { score, pieces } = calculateWinnerScore(
        set.mode,
        set.totalGuesses,
        set.hintsUsed,
        durationMs,
        wordsFoundArr.length,
        record.firstSolves
      );
      summaries.push({
        name: record.name,
        tiktokHandle: record.tiktokHandle,
        wordsFound: wordsFoundArr,
        firstSolves: record.firstSolves,
        score,
        pieces,
      });

      const entry: LeaderboardEntry = {
        id: crypto.randomUUID(),
        playerName: record.name,
        mode: set.mode,
        score,
        pieces,
        guesses: set.totalGuesses,
        hintsUsed: set.hintsUsed,
        durationMs,
        wordsFound: wordsFoundArr.length,
        createdAt: now,
      };
      addLeaderboardEntry(entry);
      latestEntry = entry;
    }

    summaries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.firstSolves - a.firstSolves;
    });

    sess.roundWinners = summaries;

    if (summaries.length > 0) {
      const topNames = summaries
        .slice(0, 3)
        .map((w) => w.name)
        .join(', ');
      const extra = summaries.length > 3 ? ` +${summaries.length - 3} more` : '';
      this.pushActivity(sess, `Round won by ${topNames}${extra}!`, 'solve');
    } else {
      this.pushActivity(sess, 'Round complete!', 'solve');
    }

    // Broadcast updated global leaderboard to all connected MPWH clients
    this.ns.emit('mpwh:leaderboard_update', {
      leaderboard: getLeaderboard('all', 50),
      latestEntry,
    });

    // Schedule 15-second auto-next-round countdown if enabled
    if (sess.autoNextRound) {
      const finishedRoundId = sess.roundId;
      sess.nextRoundAt = now + NEXT_ROUND_DELAY_MS;
      sess.nextRoundTimer = setTimeout(() => {
        if (sess.roundId !== finishedRoundId) return;
        this.startRound(sess.channel, sess.mode, sess.language);
      }, NEXT_ROUND_DELAY_MS);
    }

    this.broadcastGameState(sess);
  }

  private scheduleBufferExpiry(
    sess: ChannelSession,
    roundId: string,
    solvedWords: string[],
    delayMs: number
  ): void {
    const timer = setTimeout(() => {
      sess.bufferTimers.delete(timer);
      if (!sess.ladderSet || sess.roundId !== roundId) return;
      if (sess.ladderSet.status !== 'playing') return;

      const now = Date.now();
      for (const word of solvedWords) {
        this.pushActivity(sess, `Word revealed: ${word.toUpperCase()}`, 'solve');
      }

      const finalized = checkAndFinalizeRound(sess.ladderSet, now);
      if (finalized) {
        this.finalizeRoundAndRecordWinners(sess);
      } else {
        this.broadcastGameState(sess);
      }
    }, delayMs);

    sess.bufferTimers.add(timer);
  }

  public startRound(
    rawChannel: string,
    mode?: LadderMode,
    language?: DictionaryLanguageCode,
    autoNextRound?: boolean
  ): LiveGameStateView {
    const sess = this.getOrCreateChannel(rawChannel);
    this.clearChannelTimers(sess);

    if (mode && isValidMode(mode)) {
      sess.mode = mode;
    }
    if (language) {
      sess.language = normalizeDictionaryLanguage(language);
    }
    if (typeof autoNextRound === 'boolean') {
      sess.autoNextRound = autoNextRound;
    }

    sess.roundNumber += 1;
    sess.roundId = crypto.randomUUID();
    const secretWords = pickTargetWords(sess.mode, sess.language);
    sess.ladderSet = createLadderSet(sess.mode, secretWords, sess.language);
    sess.roundWinners = [];
    sess.recentActivity = [];
    sess.guessFeed = [];

    const modeLabel =
      sess.mode === 'classic'
        ? 'Classic (1 Word)'
        : sess.mode === 'dual'
        ? 'Dual Ladder (2 Words)'
        : 'Quad Hunt (4 Boards)';

    this.pushActivity(
      sess,
      `Round #${sess.roundNumber} started — ${modeLabel}. Type a word!`,
      'system'
    );
    this.broadcastGameState(sess);
    return this.serializeGame(sess);
  }

  public setMode(rawChannel: string, mode: LadderMode): LiveGameStateView {
    const sess = this.getOrCreateChannel(rawChannel);
    if (!isValidMode(mode)) return this.serializeGame(sess);
    sess.mode = mode;
    if (!sess.ladderSet || sess.ladderSet.status === 'idle') {
      this.broadcastGameState(sess);
      return this.serializeGame(sess);
    }
    return this.startRound(sess.channel, mode, sess.language);
  }

  public setLanguage(rawChannel: string, rawLang: string): LiveGameStateView {
    const sess = this.getOrCreateChannel(rawChannel);
    const nextLang = normalizeDictionaryLanguage(rawLang);
    if (sess.language === nextLang) return this.serializeGame(sess);
    sess.language = nextLang;
    if (!sess.ladderSet || sess.ladderSet.status === 'idle') {
      this.broadcastGameState(sess);
      return this.serializeGame(sess);
    }
    return this.startRound(sess.channel, sess.mode, nextLang);
  }

  public submitGuess(
    rawChannel: string,
    rawWord: string,
    playerName: string,
    targetBoardIndex?: number | null,
    tiktokHandle?: string,
    avatarUrl?: string
  ): GuessOutcomePayload {
    const sess = this.getOrCreateChannel(rawChannel);
    if (!sess.ladderSet || sess.ladderSet.status !== 'playing') {
      return {
        accepted: false,
        word: '',
        reason: 'Press Start Game to begin a round.',
        matchedWords: [],
        wasLagBufferHit: false,
      };
    }

    const cleanName = sanitizeName(playerName);
    const cleanAvatar =
      typeof avatarUrl === 'string' && avatarUrl.trim()
        ? avatarUrl.trim().slice(0, 500)
        : undefined;
    const result = applyGuess(
      sess.ladderSet,
      rawWord,
      cleanName,
      targetBoardIndex,
      tiktokHandle,
      cleanAvatar
    );

    if (!result.accepted) {
      if (result.alreadyGuessed && result.word) {
        this.pushGuessFeed(sess, {
          playerName: cleanName,
          tiktokHandle,
          avatarUrl: cleanAvatar,
          word: result.word,
          alreadyGuessed: true,
          status: 'duplicate',
        });
        this.broadcastGameState(sess);
      }
      return {
        accepted: false,
        word: result.word,
        reason: result.reason,
        matchedWords: [],
        wasLagBufferHit: false,
      };
    }

    if (result.firstSolvedWords.length > 0) {
      this.pushGuessFeed(sess, {
        playerName: cleanName,
        tiktokHandle,
        avatarUrl: cleanAvatar,
        word: result.word,
        alreadyGuessed: false,
        status: 'solved',
      });
      const countLabel =
        result.firstSolvedWords.length > 1
          ? `${result.firstSolvedWords.length} secret words`
          : 'a secret word';
      this.pushActivity(
        sess,
        `${cleanName} found ${countLabel}! 4s stream-lag buffer open...`,
        'buffer'
      );
      const delayMs = result.newBufferEndsAt
        ? Math.max(100, result.newBufferEndsAt - Date.now() + 40)
        : STREAM_LAG_BUFFER_MS + 40;
      this.scheduleBufferExpiry(sess, sess.roundId, result.firstSolvedWords, delayMs);
      this.broadcastGameState(sess);
      return {
        accepted: true,
        word: result.word,
        matchedWords: result.firstSolvedWords,
        wasLagBufferHit: false,
      };
    }

    if (result.bufferMatchedWords.length > 0) {
      this.pushGuessFeed(sess, {
        playerName: cleanName,
        tiktokHandle,
        avatarUrl: cleanAvatar,
        word: result.word,
        alreadyGuessed: false,
        status: 'buffer',
      });
      this.pushActivity(
        sess,
        `${cleanName} also got it during the 4s lag buffer!`,
        'solve'
      );
      this.broadcastGameState(sess);
      return {
        accepted: true,
        word: result.word,
        matchedWords: result.bufferMatchedWords,
        wasLagBufferHit: true,
      };
    }

    this.pushGuessFeed(sess, {
      playerName: cleanName,
      tiktokHandle,
      avatarUrl: cleanAvatar,
      word: result.word,
      alreadyGuessed: false,
      status: 'guess',
    });
    this.pushActivity(sess, `${cleanName} guessed ${result.word.toUpperCase()}`, 'neutral');
    this.broadcastGameState(sess);
    return {
      accepted: true,
      word: result.word,
      matchedWords: [],
      wasLagBufferHit: false,
    };
  }

  public useHint(
    rawChannel: string,
    hintType: 'bracket' | 'clue',
    boardIndex: number,
    targetIndex: number,
    requestedBy?: string
  ): { ok: boolean; error?: string } {
    const sess = this.getOrCreateChannel(rawChannel);
    if (!sess.ladderSet || sess.ladderSet.status !== 'playing') {
      return { ok: false, error: 'Start a game first to use hints.' };
    }
    const res = applyHint(
      sess.ladderSet,
      hintType,
      boardIndex,
      targetIndex,
      requestedBy
    );
    if (!res.accepted) {
      return { ok: false, error: res.reason ?? 'Hint unavailable.' };
    }
    if (res.hintWord) {
      this.pushActivity(sess, `Hint placed ${res.hintWord.toUpperCase()}`, 'hint');
    } else if (res.clueText) {
      this.pushActivity(sess, `Letter clue revealed: ${res.clueText}`, 'hint');
    }
    this.broadcastGameState(sess);
    return { ok: true };
  }

  public revealGame(rawChannel: string): void {
    const sess = this.getOrCreateChannel(rawChannel);
    if (!sess.ladderSet || sess.ladderSet.status !== 'playing') return;
    this.clearChannelTimers(sess);
    sess.ladderSet.status = 'gave_up';
    sess.ladderSet.finishedAt = Date.now();
    this.pushActivity(sess, 'Round revealed by host.', 'system');
    this.broadcastGameState(sess);
  }

  /**
   * Forwards external TikFinity / BetterTok webhook chat messages into active Word Hunt Extreme rooms.
   */
  public injectExternalWebhookChat(
    streamerHint: string,
    payload: {
      uniqueId?: string;
      nickname?: string;
      comment: string;
      profilePictureUrl?: string;
    }
  ): void {
    const candidateWord = extractWordGuessFromChat(payload.comment);
    if (!candidateWord) return;

    const cleanHint = streamerHint ? sanitizeChannel(streamerHint) : '';
    const displayName = sanitizeName(payload.nickname || payload.uniqueId || 'Viewer');
    const tiktokHandle = payload.uniqueId || payload.nickname || undefined;

    const targetSessions: ChannelSession[] = [];
    if (cleanHint && this.channels.has(cleanHint)) {
      targetSessions.push(this.channels.get(cleanHint)!);
    } else {
      for (const sess of this.channels.values()) {
        if (sess.ladderSet && sess.ladderSet.status === 'playing') {
          targetSessions.push(sess);
        }
      }
    }

    for (const sess of targetSessions) {
      if (sess.ladderSet?.status !== 'playing') continue;
      this.submitGuess(
        sess.channel,
        candidateWord,
        displayName,
        null,
        tiktokHandle,
        payload.profilePictureUrl
      );
    }
  }
}

export function mountMpwh(
  app: express.Express,
  io: SocketIOServer
): { manager: MpwhManager } {
  const mpwhIo = io.of('/mpwh');
  const manager = new MpwhManager(mpwhIo);

  // --- REST API Routes (/api/mpwh/*) ---
  app.get('/api/mpwh/health', (req, res) => {
    const channel = sanitizeChannel(req.query.channel);
    const sess = manager.getOrCreateChannel(channel);
    res.json({
      ok: true,
      channel: sess.channel,
      language: sess.language,
      dictionarySize: getDictionarySize(sess.language),
      status: sess.ladderSet?.status ?? 'idle',
      roundNumber: sess.roundNumber,
    });
  });

  app.get('/api/mpwh/game', (req, res) => {
    const channel = sanitizeChannel(req.query.channel);
    const sess = manager.getOrCreateChannel(channel);
    if (
      typeof req.query.language === 'string' &&
      (!sess.ladderSet || sess.ladderSet.status === 'idle')
    ) {
      sess.language = normalizeDictionaryLanguage(req.query.language);
    }
    res.json({ game: manager.serializeGame(sess) });
  });

  app.post('/api/mpwh/game/start', (req, res) => {
    const channel = sanitizeChannel(req.body?.channel ?? req.query.channel);
    const requestedMode = req.body?.mode;
    const requestedLang = req.body?.language;
    const mode = isValidMode(requestedMode) ? requestedMode : undefined;
    const lang =
      typeof requestedLang === 'string'
        ? normalizeDictionaryLanguage(requestedLang)
        : undefined;
    const game = manager.startRound(channel, mode, lang);
    res.json({ game });
  });

  // External stream bridge endpoint (e.g. TikTok LIVE connectors / custom scripts)
  app.post('/api/mpwh/stream/guess', (req, res) => {
    const channel = sanitizeChannel(req.body?.channel ?? req.query.channel);
    const word = typeof req.body?.word === 'string' ? req.body.word : '';
    const username = sanitizeName(req.body?.username ?? req.body?.playerName ?? 'Viewer');
    const tiktokHandle =
      typeof req.body?.uniqueId === 'string' ? req.body.uniqueId : username;
    const avatarUrl =
      typeof req.body?.avatarUrl === 'string'
        ? req.body.avatarUrl
        : typeof req.body?.profilePictureUrl === 'string'
        ? req.body.profilePictureUrl
        : undefined;
    const targetBoardIndex =
      typeof req.body?.targetBoardIndex === 'number' ? req.body.targetBoardIndex : null;
    const outcome = manager.submitGuess(
      channel,
      word,
      username,
      targetBoardIndex,
      tiktokHandle,
      avatarUrl
    );
    const sess = manager.getOrCreateChannel(channel);
    res.json({ ...outcome, game: manager.serializeGame(sess) });
  });

  app.get('/api/mpwh/leaderboard', (req, res) => {
    const rawFilter = typeof req.query.mode === 'string' ? req.query.mode : 'all';
    const filter: 'all' | LadderMode = isValidMode(rawFilter) ? rawFilter : 'all';
    const limit = Number(req.query.limit ?? 50);
    res.json({
      entries: getLeaderboard(filter, Number.isFinite(limit) ? limit : 50),
    });
  });

  // --- Isolated Socket.IO Namespace (/mpwh) ---
  mpwhIo.on('connection', (socket) => {
    const auth = (socket.handshake.auth || {}) as {
      channel?: string;
      playerName?: string;
      language?: string;
    };
    const channel = sanitizeChannel(auth.channel || socket.handshake.query.channel);
    let playerName = sanitizeName(
      auth.playerName || `Player-${Math.floor(100 + Math.random() * 900)}`
    );

    void socket.join(channel);
    const sess = manager.getOrCreateChannel(channel);
    if (
      typeof auth.language === 'string' &&
      (!sess.ladderSet || sess.ladderSet.status === 'idle')
    ) {
      sess.language = normalizeDictionaryLanguage(auth.language);
    }

    socket.emit('mpwh:welcome', {
      clientId: socket.id,
      onlineCount: mpwhIo.adapter.rooms.get(channel)?.size ?? 1,
      game: manager.serializeGame(sess),
      leaderboard: getLeaderboard('all', 50),
    });
    manager.broadcastPresence(channel);

    socket.on('mpwh:set_name', (payload: { playerName?: string }) => {
      if (payload?.playerName) {
        playerName = sanitizeName(payload.playerName);
      }
    });

    socket.on('mpwh:set_mode', (payload: { mode?: LadderMode }) => {
      if (payload?.mode && isValidMode(payload.mode)) {
        manager.setMode(channel, payload.mode);
      }
    });

    socket.on('mpwh:set_language', (payload: { language?: string }) => {
      if (typeof payload?.language === 'string') {
        manager.setLanguage(channel, payload.language);
      }
    });

    socket.on(
      'mpwh:start_game',
      (payload?: {
        mode?: LadderMode;
        language?: string;
        autoNextRound?: boolean;
      }) => {
        const mode = payload?.mode && isValidMode(payload.mode) ? payload.mode : undefined;
        const lang =
          typeof payload?.language === 'string'
            ? normalizeDictionaryLanguage(payload.language)
            : undefined;
        manager.startRound(channel, mode, lang, payload?.autoNextRound);
      }
    );

    socket.on(
      'mpwh:submit_guess',
      (payload: {
        word?: string;
        playerName?: string;
        tiktokHandle?: string;
        avatarUrl?: string;
        targetBoardIndex?: number | null;
        silent?: boolean;
      }) => {
        const guesser =
          typeof payload?.playerName === 'string' && payload.playerName.trim()
            ? sanitizeName(payload.playerName)
            : playerName;
        const outcome = manager.submitGuess(
          channel,
          payload?.word ?? '',
          guesser,
          payload?.targetBoardIndex ?? null,
          payload?.tiktokHandle,
          payload?.avatarUrl
        );
        if (!payload?.silent) {
          socket.emit('mpwh:guess_result', outcome);
        }
      }
    );

    socket.on(
      'mpwh:use_hint',
      (payload: {
        hintType?: 'bracket' | 'clue';
        boardIndex?: number;
        targetIndex?: number;
      }) => {
        const hintType = payload?.hintType === 'clue' ? 'clue' : 'bracket';
        const boardIndex = typeof payload?.boardIndex === 'number' ? payload.boardIndex : 0;
        const targetIndex = typeof payload?.targetIndex === 'number' ? payload.targetIndex : 0;
        const res = manager.useHint(channel, hintType, boardIndex, targetIndex, playerName);
        if (!res.ok && res.error) {
          socket.emit('mpwh:error', { message: res.error });
        }
      }
    );

    socket.on('mpwh:reveal_game', () => {
      manager.revealGame(channel);
    });

    socket.on('disconnect', () => {
      manager.broadcastPresence(channel);
    });
  });

  return { manager };
}
