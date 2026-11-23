import crypto from 'node:crypto';
import type { Namespace } from 'socket.io';
import type {
  AvatarConfig,
  CanvasCommand,
  ChatMessage,
  GamePhase,
  PlayerEngagementMetric,
  PlayerState,
  PublicRoomSummary,
  PublicUser,
  RoomAnalyticsSnapshot,
  RoomClientState,
  RoomSettings,
  RoundArtwork,
  RoundHistoryEntry,
  StreamerPopupState,
  TikTokChatItem,
  TikTokPlayerScore,
  TikTokStatus,
  TurnSummaryData,
} from '../../src/inkstream/shared/types.ts';
import {
  DEFAULT_WORDS,
  getInkStreamWords,
  isCloseGuess,
} from '../../src/inkstream/shared/words.ts';
import {
  normalizeDictionaryLanguage,
  stripDiacritics,
} from '../../src/lib/dictionary-languages.ts';
import { store } from './store.ts';
import { TikTokRoomBridge, type IncomingTikTokChat } from './tiktokManager.ts';

interface PlayerAnalyticsInternal {
  playerId: string;
  username: string;
  avatar: AvatarConfig;
  totalScore: number;
  turnsDrawn: number;
  drawerPointsTotal: number;
  guessesAttempted: number;
  guessesCorrect: number;
  guessTimesSec: number[];
  messagesSent: number;
  reactionsGiven: number;
  likesReceived: number;
  dislikesReceived: number;
}

interface InternalRoom {
  id: string;
  ownerId: string;
  ownerSessionId?: string;
  streamerSecret: string;
  createdAt: number;
  settings: RoomSettings;
  phase: GamePhase;
  currentRound: number;
  turnNumber: number;
  drawOrder: string[];
  drawOrderIndex: number;
  drawerId: string | null;
  secretWord: string | null;
  wordOptions: string[];
  revealedIndices: Set<number>;
  usedWords: Set<string>;
  timeRemaining: number;
  phaseTotalTime: number;
  turnStartedAt: number;
  players: Map<string, PlayerState>;
  messages: ChatMessage[];
  commands: CanvasCommand[];
  hasFirstStroke: boolean;
  redoStack: CanvasCommand[];
  turnSummary: TurnSummaryData | null;
  artworks: RoundArtwork[];
  reactions: Map<string, 'like' | 'dislike'>;
  turnGuessTimes: Map<string, { username: string; sec: number }>;
  turnChatCount: number;
  turnScoreDeltas: Map<string, number>;
  turnGuessOrder: number;
  turnTikTokGuessOrder: number;
  turnDrawerTikTokBonusAwarded: number;
  isSoloMode: boolean;
  // TikTok Live state
  tiktokBridge: TikTokRoomBridge;
  tiktokLeaderboard: Map<string, TikTokPlayerScore>;
  tiktokChat: TikTokChatItem[];
  // Analytics state
  peakPlayersCount: number;
  totalChatMessages: number;
  totalStrokesDrawn: number;
  playerAnalytics: Map<string, PlayerAnalyticsInternal>;
  roundHistory: RoundHistoryEntry[];
  timer: ReturnType<typeof setInterval> | null;
}

const DEFAULT_SETTINGS: RoomSettings = {
  name: 'Studio Room',
  isPrivate: true,
  streamerMode: false,
  maxPlayers: 12,
  rounds: 3,
  drawTime: 80,
  wordChoices: 3,
  hintsCount: 2,
  customWords: [],
  customWordsOnly: false,
  language: 'en',
};

const WORD_SELECT_SECONDS = 15;
const TURN_SUMMARY_SECONDS = 6;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normalizeGuessText(raw: string): string {
  return stripDiacritics(raw)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function doesTikTokCommentMatchWord(rawComment: string, secretWord: string): boolean {
  const cleanComment = normalizeGuessText(rawComment);
  const cleanTarget = normalizeGuessText(secretWord);
  if (!cleanComment || !cleanTarget) return false;
  if (cleanComment === cleanTarget) return true;
  // Allow short TikTok chat answers like "is it elephant" or "elephant!!" (max 4 words)
  const words = cleanComment.split(' ');
  if (words.length <= 4) {
    const padded = ` ${cleanComment} `;
    if (padded.includes(` ${cleanTarget} `)) {
      return true;
    }
  }
  return false;
}

function sanitizeSettings(
  current: RoomSettings,
  patch: Partial<RoomSettings>
): RoomSettings {
  const name =
    typeof patch.name === 'string' && patch.name.trim().length > 0
      ? patch.name.trim().slice(0, 40)
      : current.name;
  const isPrivate =
    typeof patch.isPrivate === 'boolean' ? patch.isPrivate : current.isPrivate;
  const streamerMode =
    typeof patch.streamerMode === 'boolean' ? patch.streamerMode : current.streamerMode;
  const maxPlayers =
    typeof patch.maxPlayers === 'number' && Number.isFinite(patch.maxPlayers)
      ? clamp(Math.round(patch.maxPlayers), 2, 20)
      : current.maxPlayers;
  const rounds =
    typeof patch.rounds === 'number' && Number.isFinite(patch.rounds)
      ? clamp(Math.round(patch.rounds), 1, 10)
      : current.rounds;
  const drawTime =
    typeof patch.drawTime === 'number' && Number.isFinite(patch.drawTime)
      ? clamp(Math.round(patch.drawTime), 30, 180)
      : current.drawTime;
  const wordChoices =
    typeof patch.wordChoices === 'number' && Number.isFinite(patch.wordChoices)
      ? clamp(Math.round(patch.wordChoices), 2, 5)
      : current.wordChoices;
  const hintsCount =
    typeof patch.hintsCount === 'number' && Number.isFinite(patch.hintsCount)
      ? clamp(Math.round(patch.hintsCount), 0, 3)
      : current.hintsCount;
  let customWords = current.customWords;
  if (Array.isArray(patch.customWords)) {
    customWords = patch.customWords
      .filter((w): w is string => typeof w === 'string')
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length >= 2 && w.length <= 32)
      .slice(0, 200);
  }
  const customWordsOnly =
    typeof patch.customWordsOnly === 'boolean'
      ? patch.customWordsOnly
      : current.customWordsOnly;
  const language =
    patch.language !== undefined
      ? normalizeDictionaryLanguage(patch.language)
      : normalizeDictionaryLanguage(current.language);

  return {
    name,
    isPrivate,
    streamerMode,
    maxPlayers,
    rounds,
    drawTime,
    wordChoices,
    hintsCount,
    customWords,
    customWordsOnly,
    language,
  };
}

export function sanitizeCanvasCommand(raw: unknown): CanvasCommand | null {
  if (!raw || typeof raw !== 'object') return null;
  const cmd = raw as Record<string, unknown>;
  const id =
    typeof cmd.id === 'string' && cmd.id.length > 0 && cmd.id.length <= 64
      ? cmd.id
      : crypto.randomBytes(6).toString('hex');

  if (cmd.kind === 'fill') {
    const color =
      typeof cmd.color === 'string' && HEX_COLOR_RE.test(cmd.color) ? cmd.color : null;
    const x = typeof cmd.x === 'number' && Number.isFinite(cmd.x) ? clamp(cmd.x, 0, 1) : null;
    const y = typeof cmd.y === 'number' && Number.isFinite(cmd.y) ? clamp(cmd.y, 0, 1) : null;
    if (!color || x === null || y === null) return null;
    return { id, kind: 'fill', color, x, y };
  }

  if (cmd.kind === 'stroke') {
    const validTools = ['pencil', 'eraser'];
    const tool = cmd.tool;
    if (typeof tool !== 'string' || !validTools.includes(tool)) return null;
    const color =
      typeof cmd.color === 'string' && HEX_COLOR_RE.test(cmd.color) ? cmd.color : '#0F172A';
    const size =
      typeof cmd.size === 'number' && Number.isFinite(cmd.size) ? clamp(cmd.size, 1, 48) : 6;
    const seed =
      typeof cmd.seed === 'number' && Number.isFinite(cmd.seed)
        ? Math.floor(Math.abs(cmd.seed)) % 1_000_000
        : 1337;
    if (!Array.isArray(cmd.points) || cmd.points.length === 0) return null;
    const points = cmd.points
      .slice(0, 1200)
      .filter(
        (p): p is { x: number; y: number } =>
          Boolean(p) &&
          typeof p === 'object' &&
          typeof (p as { x?: unknown }).x === 'number' &&
          typeof (p as { y?: unknown }).y === 'number'
      )
      .map((p) => ({ x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) }));
    if (points.length === 0) return null;
    return {
      id,
      kind: 'stroke',
      tool: tool as 'pencil' | 'eraser',
      color: tool === 'eraser' ? '#FFFFFF' : color,
      size,
      seed,
      points,
    };
  }

  return null;
}

export class GameManager {
  private io: Namespace;
  private rooms = new Map<string, InternalRoom>();
  private socketRoomMap = new Map<string, { roomId: string; userId: string }>();

  constructor(io: Namespace) {
    this.io = io;
    const cleanup = setInterval(() => {
      const cutoff = Date.now() - 4 * 60 * 60 * 1000;
      for (const [roomId, room] of this.rooms.entries()) {
        const connected = this.getConnectedPlayers(room);
        if (connected.length === 0 || (room.turnStartedAt || room.createdAt) < cutoff) {
          this.clearTimer(room);
          room.tiktokBridge.disconnect(false);
          this.rooms.delete(roomId);
        }
      }
    }, 15 * 60 * 1000);
    cleanup.unref();
  }

  getRoomOwnerId(roomId: string): string | null {
    return this.rooms.get(roomId.toUpperCase())?.ownerId ?? null;
  }

  verifyStreamerPopupCredentials(roomId: string, secret: string): boolean {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    if (!room || !secret) return false;
    const a = Buffer.from(room.streamerSecret, 'utf8');
    const b = Buffer.from(secret, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  getStreamerPopupState(roomId: string): StreamerPopupState | null {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    if (!room) return null;
    return this.buildStreamerPopupState(room);
  }

  selectWordFromStreamerPopup(roomId: string, wordIndex: number): void {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    if (!room) return;
    if (room.phase !== 'WORD_SELECT' || room.drawerId !== room.ownerId) return;
    if (
      !Number.isInteger(wordIndex) ||
      wordIndex < 0 ||
      wordIndex >= room.wordOptions.length
    ) {
      return;
    }
    this.startDrawingPhase(room, room.wordOptions[wordIndex]);
  }

  listPublicRooms(): PublicRoomSummary[] {
    const list: PublicRoomSummary[] = [];
    for (const room of this.rooms.values()) {
      const connectedCount = this.getConnectedPlayers(room).length;
      if (room.settings.isPrivate || connectedCount === 0) continue;
      const owner = room.players.get(room.ownerId);
      list.push({
        id: room.id,
        name: room.settings.name,
        ownerName: owner?.username ?? 'Host',
        playerCount: connectedCount,
        maxPlayers: room.settings.maxPlayers,
        phase: room.phase,
        currentRound: room.currentRound,
        totalRounds: room.settings.rounds,
        streamerMode: room.settings.streamerMode,
      });
    }
    return list.sort((a, b) => b.playerCount - a.playerCount);
  }

  createRoom(
    user: PublicUser,
    socketId: string,
    partialSettings?: Partial<RoomSettings>,
    ownerSessionId?: string
  ): InternalRoom {
    this.leaveCurrentRoom(socketId);

    let roomId = generateRoomCode();
    while (this.rooms.has(roomId)) {
      roomId = generateRoomCode();
    }

    const settings = sanitizeSettings(
      {
        ...DEFAULT_SETTINGS,
        name: `${user.username}'s Studio`,
        streamerMode: Boolean(user.isStreamer),
      },
      partialSettings ?? {}
    );

    const streamerSecret = crypto.randomBytes(16).toString('hex');

    // Placeholder bridge wired to room reference immediately below
    let roomRef: InternalRoom | null = null;
    const tiktokBridge = new TikTokRoomBridge({
      onChat: (chat) => {
        if (roomRef) this.handleIncomingTikTokChat(roomRef, chat);
      },
      onStatusChange: () => {
        if (roomRef) this.broadcastRoomState(roomRef);
      },
    });

    const room: InternalRoom = {
      id: roomId,
      ownerId: user.id,
      ownerSessionId: ownerSessionId?.trim() || undefined,
      streamerSecret,
      createdAt: Date.now(),
      settings,
      phase: 'LOBBY',
      currentRound: 0,
      turnNumber: 0,
      drawOrder: [],
      drawOrderIndex: 0,
      drawerId: null,
      secretWord: null,
      wordOptions: [],
      revealedIndices: new Set<number>(),
      usedWords: new Set<string>(),
      timeRemaining: 0,
      phaseTotalTime: 0,
      turnStartedAt: 0,
      players: new Map(),
      messages: [],
      commands: [],
      hasFirstStroke: false,
      redoStack: [],
      turnSummary: null,
      artworks: [],
      reactions: new Map(),
      turnGuessTimes: new Map(),
      turnChatCount: 0,
      turnScoreDeltas: new Map(),
      turnGuessOrder: 0,
      turnTikTokGuessOrder: 0,
      turnDrawerTikTokBonusAwarded: 0,
      isSoloMode: false,
      tiktokBridge,
      tiktokLeaderboard: new Map(),
      tiktokChat: [],
      peakPlayersCount: 1,
      totalChatMessages: 0,
      totalStrokesDrawn: 0,
      playerAnalytics: new Map(),
      roundHistory: [],
      timer: null,
    };
    roomRef = room;

    this.rooms.set(roomId, room);
    this.addPlayerToRoom(room, user, socketId, true);
    this.pushSystemMessage(room, `${user.username} created the room (${roomId}).`);
    this.broadcastRoomState(room);
    return room;
  }

  joinOrQuickPlay(
    user: PublicUser,
    socketId: string,
    language?: RoomSettings['language'],
    ownerSessionId?: string
  ): InternalRoom {
    const requestedLang = language ?? 'en';
    for (const room of this.rooms.values()) {
      const connected = this.getConnectedPlayers(room);
      if (
        !room.settings.isPrivate &&
        connected.length < room.settings.maxPlayers &&
        (room.settings.language ?? 'en') === requestedLang
      ) {
        const res = this.joinRoom(room.id, user, socketId);
        if (res.room) return res.room;
      }
    }
    return this.createRoom(
      user,
      socketId,
      {
        name: `${user.username}'s Public Room`,
        isPrivate: false,
        language: requestedLang,
      },
      ownerSessionId
    );
  }

  joinRoom(
    rawRoomId: string,
    user: PublicUser,
    socketId: string
  ): { room?: InternalRoom; error?: string } {
    const roomId = rawRoomId.trim().toUpperCase();
    const room = this.rooms.get(roomId);
    if (!room) {
      return { error: `Room "${roomId}" was not found.` };
    }

    const existing = room.players.get(user.id);
    const connectedPlayers = this.getConnectedPlayers(room);
    if (!existing && connectedPlayers.length >= room.settings.maxPlayers) {
      return { error: 'This room is full.' };
    }

    this.leaveCurrentRoom(socketId);
    this.addPlayerToRoom(room, user, socketId, room.ownerId === user.id);

    if (connectedPlayers.length + (existing ? 0 : 1) > room.peakPlayersCount) {
      room.peakPlayersCount = this.getConnectedPlayers(room).length;
    }

    if (room.isSoloMode && this.getConnectedPlayers(room).length >= 2) {
      room.isSoloMode = false;
    }

    this.pushSystemMessage(room, `${user.username} joined the room.`);
    this.broadcastRoomState(room);
    this.emitAnalyticsToOwner(room);
    return { room };
  }

  private addPlayerToRoom(
    room: InternalRoom,
    user: PublicUser,
    socketId: string,
    isOwner: boolean
  ): void {
    const existing = room.players.get(user.id);
    if (existing) {
      existing.socketId = socketId;
      existing.username = user.username;
      existing.avatar = user.avatar;
      existing.connected = true;
      existing.isOwner = room.ownerId === user.id;
    } else {
      room.players.set(user.id, {
        id: user.id,
        socketId,
        username: user.username,
        avatar: user.avatar,
        score: 0,
        roundScore: 0,
        hasGuessed: false,
        isDrawing: false,
        isOwner,
        connected: true,
      });
    }

    this.ensurePlayerAnalytics(room, user.id, user.username, user.avatar);
    this.socketRoomMap.set(socketId, { roomId: room.id, userId: user.id });

    const socket = this.io.sockets.get(socketId);
    if (socket) {
      socket.join(room.id);
    }
  }

  private ensurePlayerAnalytics(
    room: InternalRoom,
    playerId: string,
    username: string,
    avatar: AvatarConfig
  ): PlayerAnalyticsInternal {
    let entry = room.playerAnalytics.get(playerId);
    if (!entry) {
      entry = {
        playerId,
        username,
        avatar,
        totalScore: 0,
        turnsDrawn: 0,
        drawerPointsTotal: 0,
        guessesAttempted: 0,
        guessesCorrect: 0,
        guessTimesSec: [],
        messagesSent: 0,
        reactionsGiven: 0,
        likesReceived: 0,
        dislikesReceived: 0,
      };
      room.playerAnalytics.set(playerId, entry);
    } else {
      entry.username = username;
      entry.avatar = avatar;
    }
    return entry;
  }

  leaveCurrentRoom(socketId: string): void {
    const mapping = this.socketRoomMap.get(socketId);
    if (!mapping) return;
    this.socketRoomMap.delete(socketId);

    const room = this.rooms.get(mapping.roomId);
    if (!room) return;

    const socket = this.io.sockets.get(socketId);
    if (socket) {
      socket.leave(room.id);
    }

    const player = room.players.get(mapping.userId);
    if (!player) return;
    if (player.socketId !== socketId) return;

    player.connected = false;
    this.pushSystemMessage(room, `${player.username} left the room.`);

    const remaining = this.getConnectedPlayers(room);
    if (remaining.length === 0) {
      this.clearTimer(room);
      room.tiktokBridge.disconnect(false);
      this.rooms.delete(room.id);
      return;
    }

    if (room.ownerId === player.id) {
      const nextOwner = remaining[0];
      room.ownerId = nextOwner.id;
      for (const p of room.players.values()) {
        p.isOwner = p.id === nextOwner.id;
      }
      this.pushSystemMessage(room, `${nextOwner.username} is now the room owner.`);
    }

    if (
      room.drawerId === player.id &&
      (room.phase === 'WORD_SELECT' || room.phase === 'DRAWING')
    ) {
      this.finishTurn(room, 'drawer_left');
      return;
    }

    if (room.phase === 'DRAWING' && !room.isSoloMode) {
      this.checkAllGuessed(room);
    }

    this.broadcastRoomState(room);
    this.emitAnalyticsToOwner(room);
  }

  updateSettings(
    socketId: string,
    patch: Partial<RoomSettings>
  ): { error?: string } {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return { error: 'Not in a room.' };
    const { room, userId } = ctx;
    if (room.ownerId !== userId) {
      return { error: 'Only the lobby owner can update room settings.' };
    }
    if (room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER') {
      // Allow toggling streamerMode and dictionary language mid-game cleanly
      const patchKeys = Object.keys(patch);
      const onlyLiveSafe = patchKeys.every(
        (k) => k === 'streamerMode' || k === 'language'
      );
      if (onlyLiveSafe && patchKeys.length > 0) {
        const prevLang = room.settings.language;
        room.settings = sanitizeSettings(room.settings, patch);
        if (room.settings.language !== prevLang) {
          room.usedWords.clear();
          if (room.phase === 'WORD_SELECT') {
            room.wordOptions = this.pickWordOptions(room);
          }
          this.pushSystemMessage(
            room,
            `Dictionary language switched to ${(room.settings.language || 'en').toUpperCase()}.`
          );
        }
        this.broadcastRoomState(room);
        return {};
      }
      return { error: 'Settings can only be edited between games.' };
    }
    room.settings = sanitizeSettings(room.settings, patch);
    this.pushSystemMessage(room, 'Room settings updated.');
    this.broadcastRoomState(room);
    return {};
  }

  // --- TikTok LIVE Integration (Host Only) ---
  async connectTikTok(
    socketId: string,
    username: string,
    isTestMode: boolean
  ): Promise<{ ok: boolean; status?: TikTokStatus; error?: string }> {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    const { room, userId } = ctx;
    if (room.ownerId !== userId) {
      return { ok: false, error: 'Only the lobby owner can connect TikTok LIVE.' };
    }

    const result = await room.tiktokBridge.connect(username, isTestMode);
    if (result.ok) {
      this.pushSystemMessage(
        room,
        isTestMode
          ? `TikTok Test Simulator connected as @${result.status.username}.`
          : `Connected to TikTok LIVE (@${result.status.username}). Chat answers are now active!`
      );
      this.broadcastRoomState(room);
    }
    return result;
  }

  disconnectTikTok(socketId: string): { ok: boolean; error?: string } {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    const { room, userId } = ctx;
    if (room.ownerId !== userId) {
      return { ok: false, error: 'Only the lobby owner can disconnect TikTok LIVE.' };
    }
    room.tiktokBridge.disconnect(true);
    this.pushSystemMessage(room, 'TikTok LIVE disconnected.');
    this.broadcastRoomState(room);
    return { ok: true };
  }

  injectTikTokTestChat(
    socketId: string,
    nickname: string,
    comment: string,
    profilePictureUrl?: string,
    uniqueId?: string
  ): { ok: boolean; error?: string } {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return { ok: false, error: 'Not in a room.' };
    const { room, userId } = ctx;
    if (room.ownerId !== userId) {
      return { ok: false, error: 'Only the lobby owner can send simulated TikTok chat.' };
    }
    const status = room.tiktokBridge.getStatus();
    if (!status.connected) {
      return { ok: false, error: 'Connect TikTok LIVE or Test Simulator first.' };
    }
    const cleanNick = String(nickname || 'viewer').trim().slice(0, 28) || 'viewer';
    const cleanUid =
      String(uniqueId || cleanNick)
        .trim()
        .replace(/^@+/, '')
        .toLowerCase()
        .replace(/[^a-z0-9_.]/g, '') || 'viewer';
    room.tiktokBridge.injectChat({
      uniqueId: cleanUid,
      nickname: cleanNick,
      comment,
      profilePictureUrl,
    });
    return { ok: true };
  }

  injectTikTokWebhook(
    roomId: string,
    ownerUserId: string,
    payload: { uniqueId?: string; nickname?: string; comment: string; profilePictureUrl?: string }
  ): { ok: boolean; error?: string } {
    const room = this.rooms.get(roomId.trim().toUpperCase());
    if (!room) return { ok: false, error: 'Room not found.' };
    if (room.ownerId !== ownerUserId) {
      return { ok: false, error: 'Only the room owner can push TikTok webhook events.' };
    }
    room.tiktokBridge.injectChat(payload);
    return { ok: true };
  }

  /**
   * Forward incoming site-wide TikFinity / BetterTok / TikTok webhook chat messages
   * strictly into matching active InkStream rooms (scoped by roomId, ownerSessionId, or streamerHandle).
   */
  injectExternalWebhookChat(
    target:
      | string
      | {
          streamerHint?: string;
          roomId?: string;
          sessionId?: string;
        }
      | undefined,
    payload: { uniqueId?: string; nickname?: string; comment: string; profilePictureUrl?: string }
  ): number {
    const targetObj = typeof target === 'string' ? { streamerHint: target } : target || {};
    const cleanRoomId = String(targetObj.roomId || '').trim().toUpperCase();
    const cleanSessionId = String(targetObj.sessionId || '').trim().toLowerCase();
    const cleanHint = String(targetObj.streamerHint || '')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();

    if (!cleanRoomId && !cleanSessionId && !cleanHint) {
      return 0;
    }

    let forwarded = 0;
    for (const room of this.rooms.values()) {
      const status = room.tiktokBridge.getStatus();
      const roomHandle = String(status.username || '').trim().replace(/^@+/, '').toLowerCase();
      const matchesRoomId = Boolean(cleanRoomId && room.id === cleanRoomId);
      const matchesSession = Boolean(
        cleanSessionId && room.ownerSessionId && room.ownerSessionId.toLowerCase() === cleanSessionId
      );
      const matchesHandle = Boolean(
        status.connected && cleanHint && roomHandle && roomHandle === cleanHint
      );
      if (matchesRoomId || matchesSession || matchesHandle) {
        room.tiktokBridge.injectChat(payload);
        forwarded += 1;
      }
    }
    return forwarded;
  }

  private handleIncomingTikTokChat(room: InternalRoom, chat: IncomingTikTokChat): void {
    const comment = chat.comment.trim().slice(0, 160);
    if (!comment) return;

    if (room.phase === 'DRAWING' && room.secretWord) {
      // Do not count guesses made before the drawer's first stroke
      if (!room.hasFirstStroke) {
        if (
          doesTikTokCommentMatchWord(comment, room.secretWord) ||
          isCloseGuess(comment, room.secretWord)
        ) {
          return;
        }
      } else {
        const existing = room.tiktokLeaderboard.get(chat.uniqueId);

        // Check for correct guess from TikTok viewer
        if (doesTikTokCommentMatchWord(comment, room.secretWord)) {
          if (existing?.hasGuessed) {
            return; // Viewer already guessed this turn; do not echo secret word
          }

          room.turnTikTokGuessOrder += 1;
          const elapsedSec = Math.max(
            0.5,
            Number(((Date.now() - room.turnStartedAt) / 1000).toFixed(1))
          );
          const timeRatio = clamp(room.timeRemaining / Math.max(1, room.settings.drawTime), 0, 1);
          const speedBonus = Math.round(timeRatio * 250);
          const orderBonus = Math.max(0, 150 - (room.turnTikTokGuessOrder - 1) * 25);
          const points = 150 + speedBonus + orderBonus;

          const nextEntry: TikTokPlayerScore = existing
            ? {
                ...existing,
                nickname: chat.nickname || existing.nickname,
                profilePictureUrl: chat.profilePictureUrl || existing.profilePictureUrl,
                score: existing.score + points,
                roundScore: existing.roundScore + points,
                wordsGuessed: existing.wordsGuessed + 1,
                hasGuessed: true,
                lastGuessSec: elapsedSec,
              }
            : {
                uniqueId: chat.uniqueId,
                nickname: chat.nickname,
                profilePictureUrl: chat.profilePictureUrl,
                score: points,
                roundScore: points,
                wordsGuessed: 1,
                hasGuessed: true,
                lastGuessSec: elapsedSec,
              };

          room.tiktokLeaderboard.set(chat.uniqueId, nextEntry);
          room.tiktokBridge.incrementMatchedGuess();

          // Award drawer a modest TikTok chat bonus (capped at 280 pts/turn from TikTok)
          if (room.drawerId && room.turnDrawerTikTokBonusAwarded < 280) {
            const drawer = room.players.get(room.drawerId);
            if (drawer) {
              const bonus = Math.min(40, 280 - room.turnDrawerTikTokBonusAwarded);
              room.turnDrawerTikTokBonusAwarded += bonus;
              drawer.score += bonus;
              drawer.roundScore += bonus;
              room.turnScoreDeltas.set(
                drawer.id,
                (room.turnScoreDeltas.get(drawer.id) ?? 0) + bonus
              );
              const drawerAnalytics = this.ensurePlayerAnalytics(
                room,
                drawer.id,
                drawer.username,
                drawer.avatar
              );
              drawerAnalytics.drawerPointsTotal += bonus;
              drawerAnalytics.totalScore = drawer.score;
            }
          }

          // Record spoiler-free TikTok chat item
          room.tiktokChat.push({
            id: crypto.randomBytes(6).toString('hex'),
            uniqueId: chat.uniqueId,
            nickname: chat.nickname,
            profilePictureUrl: chat.profilePictureUrl,
            text: `Guessed the word! (+${points} pts)`,
            isCorrect: true,
            pointsAwarded: points,
            timestamp: Date.now(),
          });
          if (room.tiktokChat.length > 40) room.tiktokChat.shift();

          // Announce correct TikTok guess in room chat (without spoiling word)
          this.pushChatMessage(room, {
            id: crypto.randomBytes(6).toString('hex'),
            type: 'correct',
            text: `@${chat.nickname} (TikTok) guessed the word! (+${points} pts)`,
            timestamp: Date.now(),
          });

          this.io.to(room.id).emit('game:sound', { sound: 'correct' });
          this.broadcastRoomState(room);
          this.emitAnalyticsToOwner(room);
          return;
        }

        // Hide close guesses from TikTok chat too so they don't spoil for stream viewers
        if (isCloseGuess(comment, room.secretWord)) {
          return;
        }
      }
    }

    // Normal non-spoiling TikTok chat message
    room.tiktokChat.push({
      id: crypto.randomBytes(6).toString('hex'),
      uniqueId: chat.uniqueId,
      nickname: chat.nickname,
      profilePictureUrl: chat.profilePictureUrl,
      text: comment,
      isCorrect: false,
      timestamp: Date.now(),
    });
    if (room.tiktokChat.length > 40) room.tiktokChat.shift();
    this.broadcastRoomState(room);
  }

  kickPlayer(socketId: string, targetUserId: string): { error?: string } {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return { error: 'Not in a room.' };
    const { room, userId } = ctx;
    if (room.ownerId !== userId) {
      return { error: 'Only the lobby owner can kick players.' };
    }
    if (targetUserId === userId) {
      return { error: 'You cannot kick yourself.' };
    }
    const target = room.players.get(targetUserId);
    if (!target) return { error: 'Player not found.' };

    const targetSocket = this.io.sockets.get(target.socketId);
    if (targetSocket) {
      targetSocket.emit('room:kicked', { reason: 'Removed by the room owner.' });
      this.leaveCurrentRoom(target.socketId);
    } else {
      room.players.delete(targetUserId);
      this.broadcastRoomState(room);
    }
    return {};
  }

  startGame(socketId: string, soloPractice = false): { error?: string } {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return { error: 'Not in a room.' };
    const { room, userId } = ctx;

    if (room.ownerId !== userId) {
      return { error: 'Only the lobby owner can start the game.' };
    }

    const connected = this.getConnectedPlayers(room);
    const tiktokConnected = room.tiktokBridge.getStatus().connected;
    if (connected.length < 2 && !soloPractice && !tiktokConnected) {
      return {
        error:
          'Invite at least 1 friend, connect TikTok LIVE, or click Solo Practice to sketch now.',
      };
    }

    this.clearTimer(room);
    room.isSoloMode = connected.length === 1;
    room.currentRound = 1;
    room.turnNumber = 0;
    room.usedWords.clear();
    room.turnSummary = null;
    room.commands = [];
    room.hasFirstStroke = false;
    room.redoStack = [];
    room.artworks = [];
    room.tiktokLeaderboard.clear();
    room.tiktokChat = [];

    for (const p of room.players.values()) {
      p.score = 0;
      p.roundScore = 0;
      p.hasGuessed = false;
      p.isDrawing = false;
    }

    room.drawOrder = connected.map((p) => p.id);
    room.drawOrderIndex = 0;

    this.pushSystemMessage(
      room,
      room.isSoloMode && tiktokConnected
        ? `Live Stream Game started! TikTok chat can guess every drawing.`
        : room.isSoloMode
          ? 'Solo Practice started! Pick a word and sketch away.'
          : `Game started! ${room.settings.rounds} rounds · ${room.settings.drawTime}s per turn.`
    );

    this.beginNextTurn(room);
    return {};
  }

  finishSoloTurnEarly(socketId: string): void {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return;
    const { room, userId } = ctx;
    if (room.phase === 'DRAWING' && room.drawerId === userId && room.isSoloMode) {
      this.finishTurn(room, 'solo_finished');
    }
  }

  returnToLobby(socketId: string): { error?: string } {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return { error: 'Not in a room.' };
    const { room, userId } = ctx;
    if (room.ownerId !== userId) {
      return { error: 'Only the lobby owner can reset the room.' };
    }
    this.clearTimer(room);
    room.phase = 'LOBBY';
    room.drawerId = null;
    room.secretWord = null;
    room.wordOptions = [];
    room.turnSummary = null;
    room.commands = [];
    room.hasFirstStroke = false;
    room.redoStack = [];
    room.timeRemaining = 0;
    for (const p of room.players.values()) {
      p.isDrawing = false;
      p.hasGuessed = false;
      p.roundScore = 0;
    }
    this.broadcastRoomState(room);
    return {};
  }

  selectWord(socketId: string, wordIndex: number): void {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return;
    const { room, userId } = ctx;
    if (room.phase !== 'WORD_SELECT' || room.drawerId !== userId) return;
    if (
      !Number.isInteger(wordIndex) ||
      wordIndex < 0 ||
      wordIndex >= room.wordOptions.length
    ) {
      return;
    }
    this.startDrawingPhase(room, room.wordOptions[wordIndex]);
  }

  handleCanvasCommand(socketId: string, rawCommand: unknown): void {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return;
    const { room, userId } = ctx;
    if (room.phase !== 'DRAWING' || room.drawerId !== userId) return;

    const cmd = sanitizeCanvasCommand(rawCommand);
    if (!cmd) return;

    if (room.commands.some((existing) => existing.id === cmd.id)) return;
    if (room.commands.length >= 1500) return;

    room.commands.push(cmd);
    room.redoStack = [];
    room.totalStrokesDrawn += 1;

    const isVisibleMark =
      (cmd.kind === 'fill' && cmd.color.toUpperCase() !== '#FFFFFF') ||
      (cmd.kind === 'stroke' &&
        cmd.tool !== 'eraser' &&
        cmd.color.toUpperCase() !== '#FFFFFF');
    if (isVisibleMark) {
      this.markFirstStrokeIfNeeded(room);
    }

    const senderSocket = this.io.sockets.get(socketId);
    if (senderSocket) {
      senderSocket.to(room.id).emit('canvas:command', cmd);
    }
  }

  handleLiveStrokeSegment(
    socketId: string,
    payload: {
      strokeId: string;
      tool: string;
      color: string;
      size: number;
      seed: number;
      points: Array<{ x: number; y: number }>;
    }
  ): void {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return;
    const { room, userId } = ctx;
    if (room.phase !== 'DRAWING' || room.drawerId !== userId) return;
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.points)) return;

    const validTools = ['pencil', 'eraser'];
    if (!validTools.includes(payload.tool)) return;
    const color = HEX_COLOR_RE.test(payload.color) ? payload.color : '#0F172A';
    const size = clamp(Number(payload.size) || 6, 1, 48);
    const seed = Math.floor(Math.abs(Number(payload.seed) || 1337)) % 1_000_000;
    const points = payload.points
      .slice(0, 64)
      .filter((p) => typeof p?.x === 'number' && typeof p?.y === 'number')
      .map((p) => ({ x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) }));
    if (points.length === 0) return;

    if (payload.tool !== 'eraser' && color.toUpperCase() !== '#FFFFFF') {
      this.markFirstStrokeIfNeeded(room);
    }

    const senderSocket = this.io.sockets.get(socketId);
    if (senderSocket) {
      senderSocket.to(room.id).emit('canvas:live-segment', {
        strokeId: String(payload.strokeId).slice(0, 64),
        tool: payload.tool,
        color: payload.tool === 'eraser' ? '#FFFFFF' : color,
        size,
        seed,
        points,
      });
    }
  }

  handleCanvasUndo(socketId: string): void {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return;
    const { room, userId } = ctx;
    if (room.phase !== 'DRAWING' || room.drawerId !== userId) return;
    const popped = room.commands.pop();
    if (!popped) return;
    room.redoStack.push(popped);
    this.io.to(room.id).emit('canvas:sync', {
      commands: room.commands,
      canUndo: room.commands.length > 0,
      canRedo: room.redoStack.length > 0,
    });
  }

  handleCanvasRedo(socketId: string): void {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return;
    const { room, userId } = ctx;
    if (room.phase !== 'DRAWING' || room.drawerId !== userId) return;
    const restored = room.redoStack.pop();
    if (!restored) return;
    room.commands.push(restored);
    this.io.to(room.id).emit('canvas:sync', {
      commands: room.commands,
      canUndo: room.commands.length > 0,
      canRedo: room.redoStack.length > 0,
    });
  }

  handleCanvasClear(socketId: string): void {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return;
    const { room, userId } = ctx;
    if (room.phase !== 'DRAWING' || room.drawerId !== userId) return;
    room.commands = [];
    room.redoStack = [];
    this.io.to(room.id).emit('canvas:sync', {
      commands: [],
      canUndo: false,
      canRedo: false,
    });
  }

  handleChatMessage(socketId: string, rawText: unknown): void {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return;
    const { room, userId } = ctx;
    const player = room.players.get(userId);
    if (!player) return;

    if (typeof rawText !== 'string') return;
    const text = rawText.trim().slice(0, 160);
    if (!text) return;

    const analytics = this.ensurePlayerAnalytics(
      room,
      player.id,
      player.username,
      player.avatar
    );
    analytics.messagesSent += 1;
    room.totalChatMessages += 1;

    if (room.phase === 'DRAWING' && room.secretWord) {
      room.turnChatCount += 1;

      // Active drawer cannot leak the word in chat
      if (room.drawerId === userId) {
        if (text.toLowerCase().includes(room.secretWord.toLowerCase())) {
          this.io.to(socketId).emit('game:close-guess', {
            guess: '',
            message: 'You are drawing — do not type the secret word in chat.',
          });
          return;
        }
        this.pushChatMessage(room, {
          id: crypto.randomBytes(6).toString('hex'),
          type: 'chat',
          senderId: player.id,
          senderName: player.username,
          text,
          timestamp: Date.now(),
        });
        this.emitAnalyticsToOwner(room);
        return;
      }

      // Already-guessed players chat privately among themselves & drawer
      if (player.hasGuessed) {
        const msg: ChatMessage = {
          id: crypto.randomBytes(6).toString('hex'),
          type: 'guessed-chat',
          senderId: player.id,
          senderName: player.username,
          text,
          timestamp: Date.now(),
        };
        for (const p of room.players.values()) {
          if (p.connected && (p.hasGuessed || p.id === room.drawerId)) {
            this.io.to(p.socketId).emit('chat:message', msg);
          }
        }
        this.emitAnalyticsToOwner(room);
        return;
      }

      // Guesses made before the first stroke do not count (prevents anticipating the answer)
      if (!room.hasFirstStroke) {
        this.io.to(socketId).emit('game:close-guess', {
          guess: '',
          message: 'Wait for the first stroke — guesses do not count until drawing starts.',
        });
        this.emitAnalyticsToOwner(room);
        return;
      }

      // Active guess attempt
      analytics.guessesAttempted += 1;
      const normalizedGuess = normalizeGuessText(text);
      const normalizedTarget = normalizeGuessText(room.secretWord);

      if (normalizedGuess === normalizedTarget) {
        player.hasGuessed = true;
        room.turnGuessOrder += 1;
        const elapsedSec = Math.max(
          0.5,
          Number(((Date.now() - room.turnStartedAt) / 1000).toFixed(1))
        );
        const timeRatio = clamp(room.timeRemaining / Math.max(1, room.settings.drawTime), 0, 1);
        const speedBonus = Math.round(timeRatio * 250);
        const orderBonus = Math.max(0, 150 - (room.turnGuessOrder - 1) * 35);
        const guessPoints = 150 + speedBonus + orderBonus;

        player.score += guessPoints;
        player.roundScore += guessPoints;
        room.turnScoreDeltas.set(
          player.id,
          (room.turnScoreDeltas.get(player.id) ?? 0) + guessPoints
        );
        analytics.guessesCorrect += 1;
        analytics.guessTimesSec.push(elapsedSec);
        analytics.totalScore = player.score;

        room.turnGuessTimes.set(player.id, {
          username: player.username,
          sec: elapsedSec,
        });

        if (room.drawerId) {
          const drawer = room.players.get(room.drawerId);
          if (drawer) {
            const eligible = Math.max(1, this.getConnectedPlayers(room).length - 1);
            const drawerBonus = Math.max(45, Math.round(280 / eligible));
            drawer.score += drawerBonus;
            drawer.roundScore += drawerBonus;
            room.turnScoreDeltas.set(
              drawer.id,
              (room.turnScoreDeltas.get(drawer.id) ?? 0) + drawerBonus
            );
            const drawerAnalytics = this.ensurePlayerAnalytics(
              room,
              drawer.id,
              drawer.username,
              drawer.avatar
            );
            drawerAnalytics.drawerPointsTotal += drawerBonus;
            drawerAnalytics.totalScore = drawer.score;
          }
        }

        this.pushChatMessage(room, {
          id: crypto.randomBytes(6).toString('hex'),
          type: 'correct',
          senderId: player.id,
          senderName: player.username,
          text: `${player.username} guessed the word! (+${guessPoints} pts)`,
          timestamp: Date.now(),
        });

        this.io.to(room.id).emit('game:sound', { sound: 'correct' });
        this.broadcastRoomState(room);
        this.emitAnalyticsToOwner(room);
        this.checkAllGuessed(room);
        return;
      }

      // Close guess: inform ONLY this player privately and DO NOT show it in chat!
      if (isCloseGuess(normalizedGuess, normalizedTarget)) {
        this.io.to(socketId).emit('game:close-guess', {
          guess: text,
          message: `"${text}" is close! Keep going.`,
        });
        this.io.to(socketId).emit('game:sound', { sound: 'close' });
        this.emitAnalyticsToOwner(room);
        return;
      }
    }

    // Standard chat message
    this.pushChatMessage(room, {
      id: crypto.randomBytes(6).toString('hex'),
      type: 'chat',
      senderId: player.id,
      senderName: player.username,
      text,
      timestamp: Date.now(),
    });
    this.emitAnalyticsToOwner(room);
  }

  handleReaction(socketId: string, reaction: 'like' | 'dislike'): void {
    const ctx = this.getSocketContext(socketId);
    if (!ctx) return;
    const { room, userId } = ctx;
    if (room.phase !== 'DRAWING' && room.phase !== 'TURN_SUMMARY') return;
    if (room.drawerId === userId) return;
    if (reaction !== 'like' && reaction !== 'dislike') return;

    const prev = room.reactions.get(userId);
    if (prev === reaction) return;
    room.reactions.set(userId, reaction);

    const voter = room.players.get(userId);
    if (voter) {
      const voterAnalytics = this.ensurePlayerAnalytics(
        room,
        voter.id,
        voter.username,
        voter.avatar
      );
      if (!prev) voterAnalytics.reactionsGiven += 1;
    }

    if (room.drawerId) {
      const drawer = room.players.get(room.drawerId);
      if (drawer) {
        const drawerAnalytics = this.ensurePlayerAnalytics(
          room,
          drawer.id,
          drawer.username,
          drawer.avatar
        );
        if (prev === 'like')
          drawerAnalytics.likesReceived = Math.max(0, drawerAnalytics.likesReceived - 1);
        if (prev === 'dislike')
          drawerAnalytics.dislikesReceived = Math.max(0, drawerAnalytics.dislikesReceived - 1);
        if (reaction === 'like') drawerAnalytics.likesReceived += 1;
        if (reaction === 'dislike') drawerAnalytics.dislikesReceived += 1;
      }
    }

    if (room.phase === 'TURN_SUMMARY' && room.turnSummary) {
      let likes = 0;
      let dislikes = 0;
      for (const r of room.reactions.values()) {
        if (r === 'like') likes += 1;
        if (r === 'dislike') dislikes += 1;
      }
      room.turnSummary.artwork.likes = likes;
      room.turnSummary.artwork.dislikes = dislikes;
      const latestHistory = room.roundHistory[0];
      if (latestHistory && latestHistory.artworkId === room.turnSummary.artwork.id) {
        latestHistory.likes = likes;
        latestHistory.dislikes = dislikes;
      }
    }

    this.broadcastRoomState(room);
    this.emitAnalyticsToOwner(room);
  }

  getAnalyticsForRoom(roomId: string, requesterUserId: string): RoomAnalyticsSnapshot | null {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return null;
    if (room.ownerId !== requesterUserId) return null;
    return this.buildAnalyticsSnapshot(room);
  }

  private buildAnalyticsSnapshot(room: InternalRoom): RoomAnalyticsSnapshot {
    const allGuessTimes: number[] = [];
    let totalEligible = 0;
    let totalCorrect = 0;

    for (const h of room.roundHistory) {
      totalEligible += h.eligibleGuessers;
      totalCorrect += h.correctGuessers;
    }

    const playerMetrics: PlayerEngagementMetric[] = [];
    for (const a of room.playerAnalytics.values()) {
      for (const t of a.guessTimesSec) allGuessTimes.push(t);
      const avgGuessTimeSec =
        a.guessTimesSec.length > 0
          ? Number(
              (
                a.guessTimesSec.reduce((sum, v) => sum + v, 0) / a.guessTimesSec.length
              ).toFixed(1)
            )
          : null;
      const guessAccuracy =
        a.guessesAttempted > 0
          ? Math.round((a.guessesCorrect / a.guessesAttempted) * 100)
          : 0;
      const avgPointsAsDrawer =
        a.turnsDrawn > 0 ? Math.round(a.drawerPointsTotal / a.turnsDrawn) : 0;

      const rawActivity =
        a.guessesCorrect * 22 +
        a.turnsDrawn * 25 +
        Math.min(a.messagesSent, 20) * 2 +
        a.reactionsGiven * 6;
      const engagementIndex = clamp(Math.round(rawActivity), 0, 100);

      playerMetrics.push({
        playerId: a.playerId,
        username: a.username,
        avatar: a.avatar,
        totalScore: room.players.get(a.playerId)?.score ?? a.totalScore,
        turnsDrawn: a.turnsDrawn,
        avgPointsAsDrawer,
        guessesAttempted: a.guessesAttempted,
        guessesCorrect: a.guessesCorrect,
        guessAccuracy,
        avgGuessTimeSec,
        messagesSent: a.messagesSent,
        reactionsGiven: a.reactionsGiven,
        likesReceived: a.likesReceived,
        dislikesReceived: a.dislikesReceived,
        engagementIndex,
      });
    }

    playerMetrics.sort((a, b) => b.totalScore - a.totalScore);

    const overallGuessRate =
      totalEligible > 0 ? Math.round((totalCorrect / totalEligible) * 100) : 0;
    const avgGuessTimeSec =
      allGuessTimes.length > 0
        ? Number(
            (allGuessTimes.reduce((s, v) => s + v, 0) / allGuessTimes.length).toFixed(1)
          )
        : null;

    const completedRounds = new Set(room.roundHistory.map((r) => r.roundNumber)).size;

    return {
      roomId: room.id,
      roomName: room.settings.name,
      createdAt: room.createdAt,
      totalRoundsCompleted: completedRounds,
      totalTurnsCompleted: room.roundHistory.length,
      overallGuessRate,
      avgGuessTimeSec,
      totalChatMessages: room.totalChatMessages,
      totalStrokesDrawn: room.totalStrokesDrawn,
      activePlayersCount: this.getConnectedPlayers(room).length,
      peakPlayersCount: room.peakPlayersCount,
      playerMetrics,
      roundHistory: room.roundHistory,
    };
  }

  private emitAnalyticsToOwner(room: InternalRoom): void {
    const owner = room.players.get(room.ownerId);
    if (!owner || !owner.connected) return;
    const snapshot = this.buildAnalyticsSnapshot(room);
    this.io.to(owner.socketId).emit('room:analytics', snapshot);
  }

  private beginNextTurn(room: InternalRoom): void {
    this.clearTimer(room);

    const connectedIds = new Set(this.getConnectedPlayers(room).map((p) => p.id));
    while (
      room.drawOrderIndex < room.drawOrder.length &&
      !connectedIds.has(room.drawOrder[room.drawOrderIndex])
    ) {
      room.drawOrderIndex += 1;
    }

    if (room.drawOrderIndex >= room.drawOrder.length) {
      room.currentRound += 1;
      if (room.currentRound > room.settings.rounds) {
        this.finishGame(room);
        return;
      }
      room.drawOrder = this.getConnectedPlayers(room).map((p) => p.id);
      room.drawOrderIndex = 0;
      if (room.drawOrder.length === 0) {
        this.finishGame(room);
        return;
      }
      this.pushSystemMessage(room, `Round ${room.currentRound} of ${room.settings.rounds} begins!`);
    }

    const drawerId = room.drawOrder[room.drawOrderIndex];
    room.drawOrderIndex += 1;
    room.turnNumber += 1;
    room.drawerId = drawerId;
    room.secretWord = null;
    room.revealedIndices.clear();
    room.commands = [];
    room.hasFirstStroke = false;
    room.redoStack = [];
    room.turnSummary = null;
    room.reactions.clear();
    room.turnGuessTimes.clear();
    room.turnChatCount = 0;
    room.turnScoreDeltas.clear();
    room.turnGuessOrder = 0;
    room.turnTikTokGuessOrder = 0;
    room.turnDrawerTikTokBonusAwarded = 0;

    for (const p of room.players.values()) {
      p.isDrawing = p.id === drawerId;
      p.hasGuessed = false;
      p.roundScore = 0;
    }

    for (const tk of room.tiktokLeaderboard.values()) {
      tk.hasGuessed = false;
      tk.roundScore = 0;
    }

    room.wordOptions = this.pickWordOptions(room);
    room.phase = 'WORD_SELECT';
    room.timeRemaining = WORD_SELECT_SECONDS;
    room.phaseTotalTime = WORD_SELECT_SECONDS;

    const drawer = room.players.get(drawerId);
    this.pushSystemMessage(room, `${drawer?.username ?? 'Artist'} is choosing a word...`);
    this.broadcastRoomState(room);

    room.timer = setInterval(() => {
      room.timeRemaining -= 1;
      if (room.timeRemaining <= 0) {
        const langPool = getInkStreamWords(room.settings.language);
        const autoWord =
          room.wordOptions[Math.floor(Math.random() * room.wordOptions.length)] ??
          langPool[0] ??
          (room.settings.language === 'en' ? DEFAULT_WORDS[0] : 'word');
        this.startDrawingPhase(room, autoWord);
      } else {
        this.io.to(room.id).emit('game:tick', {
          timeRemaining: room.timeRemaining,
          maskedWord: '',
        });
        this.emitStreamerPopupState(room);
      }
    }, 1000);
  }

  private startDrawingPhase(room: InternalRoom, word: string): void {
    this.clearTimer(room);
    room.secretWord = word;
    room.usedWords.add(word.toLowerCase());
    room.wordOptions = [];
    room.revealedIndices.clear();
    room.phase = 'DRAWING';
    room.hasFirstStroke = false;
    room.timeRemaining = room.settings.drawTime;
    room.phaseTotalTime = room.settings.drawTime;
    room.turnStartedAt = Date.now();

    if (room.drawerId) {
      const drawer = room.players.get(room.drawerId);
      if (drawer) {
        const a = this.ensurePlayerAnalytics(room, drawer.id, drawer.username, drawer.avatar);
        a.turnsDrawn += 1;
      }
    }

    this.io.to(room.id).emit('game:sound', { sound: 'round_start' });
    this.broadcastRoomState(room);

    const hintRevealTimes: number[] = [];
    const total = room.settings.drawTime;
    if (room.settings.hintsCount >= 1) hintRevealTimes.push(Math.floor(total * 0.5));
    if (room.settings.hintsCount >= 2) hintRevealTimes.push(Math.floor(total * 0.25));
    if (room.settings.hintsCount >= 3) hintRevealTimes.push(Math.floor(total * 0.12));

    room.timer = setInterval(() => {
      room.timeRemaining -= 1;

      if (hintRevealTimes.includes(room.timeRemaining)) {
        this.revealOneLetter(room);
      }

      if (room.timeRemaining <= 0) {
        this.finishTurn(room, 'time_up');
        return;
      }

      this.io.to(room.id).emit('game:tick', {
        timeRemaining: room.timeRemaining,
        maskedWord: this.buildMaskedWord(room),
      });
      this.emitStreamerPopupState(room);
    }, 1000);
  }

  private finishTurn(
    room: InternalRoom,
    reason: 'all_guessed' | 'time_up' | 'drawer_left' | 'solo_finished'
  ): void {
    this.clearTimer(room);
    const word =
      room.secretWord ??
      room.wordOptions[0] ??
      getInkStreamWords(room.settings.language)[0] ??
      'sketch';
    const drawer = room.drawerId ? room.players.get(room.drawerId) : undefined;

    let likes = 0;
    let dislikes = 0;
    for (const r of room.reactions.values()) {
      if (r === 'like') likes += 1;
      if (r === 'dislike') dislikes += 1;
    }

    const artwork: RoundArtwork = {
      id: `art_${crypto.randomBytes(6).toString('hex')}`,
      roomId: room.id,
      roundNumber: room.currentRound,
      turnNumber: room.turnNumber,
      word,
      drawerId: room.drawerId ?? '',
      drawerName: drawer?.username ?? 'Artist',
      drawerAvatar: drawer?.avatar ?? { color: '#2563EB', eyes: 0, mouth: 0, accessory: 0 },
      commands: [...room.commands],
      createdAt: Date.now(),
      likes,
      dislikes,
    };
    room.artworks.unshift(artwork);
    if (room.artworks.length > 30) room.artworks.length = 30;

    const scoreDeltas = Array.from(room.players.values())
      .filter((p) => p.connected || room.turnScoreDeltas.has(p.id))
      .map((p) => ({
        playerId: p.id,
        username: p.username,
        points: room.turnScoreDeltas.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.points - a.points);

    const eligibleGuessers = Math.max(
      0,
      this.getConnectedPlayers(room).filter((p) => p.id !== room.drawerId).length
    );
    const guessList = Array.from(room.turnGuessTimes.values()).sort((a, b) => a.sec - b.sec);
    const fastest = guessList[0] ?? null;
    const avgSec =
      guessList.length > 0
        ? Number((guessList.reduce((s, g) => s + g.sec, 0) / guessList.length).toFixed(1))
        : null;
    const guessRate =
      eligibleGuessers > 0 ? Math.round((guessList.length / eligibleGuessers) * 100) : 0;

    const historyEntry: RoundHistoryEntry = {
      turnNumber: room.turnNumber,
      roundNumber: room.currentRound,
      word,
      drawerId: room.drawerId ?? '',
      drawerName: drawer?.username ?? 'Artist',
      startedAt: room.turnStartedAt || Date.now(),
      endedAt: Date.now(),
      durationSec: Math.max(
        1,
        Math.round((Date.now() - (room.turnStartedAt || Date.now())) / 1000)
      ),
      eligibleGuessers,
      correctGuessers: guessList.length,
      guessRate,
      fastestGuesserName: fastest?.username ?? null,
      fastestGuessSec: fastest?.sec ?? null,
      averageGuessSec: avgSec,
      strokeCount: room.commands.length,
      chatMessagesCount: room.turnChatCount,
      likes,
      dislikes,
      artworkId: artwork.id,
      scoreDeltas,
    };

    room.roundHistory.unshift(historyEntry);
    try {
      store.logRoundAnalytics(room.id, room.settings.name, room.ownerId, historyEntry);
    } catch {
      // ignore non-fatal logging error
    }

    room.phase = 'TURN_SUMMARY';
    room.timeRemaining = TURN_SUMMARY_SECONDS;
    room.phaseTotalTime = TURN_SUMMARY_SECONDS;
    room.turnSummary = {
      word,
      drawerId: room.drawerId ?? '',
      drawerName: drawer?.username ?? 'Artist',
      reason,
      scoreDeltas,
      artwork,
    };

    this.pushSystemMessage(room, `The word was "${word}"!`);
    this.io.to(room.id).emit('game:sound', { sound: 'turn_end' });
    this.broadcastRoomState(room);
    this.emitAnalyticsToOwner(room);

    room.timer = setInterval(() => {
      room.timeRemaining -= 1;
      if (room.timeRemaining <= 0) {
        this.beginNextTurn(room);
      } else {
        this.io.to(room.id).emit('game:tick', {
          timeRemaining: room.timeRemaining,
          maskedWord: word,
        });
        this.emitStreamerPopupState(room);
      }
    }, 1000);
  }

  private finishGame(room: InternalRoom): void {
    this.clearTimer(room);
    room.phase = 'GAME_OVER';
    room.hasFirstStroke = false;
    room.drawerId = null;
    room.secretWord = null;
    room.wordOptions = [];
    room.timeRemaining = 0;
    room.phaseTotalTime = 0;

    const ranked = this.getConnectedPlayers(room).sort((a, b) => b.score - a.score);
    const topScore = ranked[0]?.score ?? 0;

    for (const p of ranked) {
      const a = room.playerAnalytics.get(p.id);
      const won = !room.isSoloMode && ranked.length >= 2 && p.score === topScore && topScore > 0;
      store.recordGameResult(p.id, p.score, won, a?.guessesCorrect ?? 0);
    }

    if (ranked[0]) {
      this.pushSystemMessage(
        room,
        `Game over! ${ranked[0].username} finished #1 with ${ranked[0].score} pts.`
      );
    }

    this.io.to(room.id).emit('game:sound', { sound: 'victory' });
    this.broadcastRoomState(room);
    this.emitAnalyticsToOwner(room);
  }

  private checkAllGuessed(room: InternalRoom): void {
    // If TikTok LIVE is connected, let the timer run so TikTok viewers still have time to guess
    if (room.tiktokBridge.getStatus().connected) return;
    const guessers = this.getConnectedPlayers(room).filter((p) => p.id !== room.drawerId);
    if (guessers.length === 0) return;
    if (guessers.every((p) => p.hasGuessed)) {
      this.finishTurn(room, 'all_guessed');
    }
  }

  private pickWordOptions(room: InternalRoom): string[] {
    let pool: string[] = [];
    if (room.settings.customWordsOnly && room.settings.customWords.length >= 2) {
      pool = [...room.settings.customWords];
    } else {
      pool = [...getInkStreamWords(room.settings.language), ...room.settings.customWords];
    }
    const fresh = pool.filter((w) => !room.usedWords.has(w.toLowerCase()));
    const source = fresh.length >= room.settings.wordChoices ? fresh : pool;
    const shuffled = [...source].sort(() => Math.random() - 0.5);
    const unique: string[] = [];
    for (const w of shuffled) {
      if (!unique.includes(w)) unique.push(w);
      if (unique.length >= room.settings.wordChoices) break;
    }
    return unique;
  }

  private revealOneLetter(room: InternalRoom): void {
    const word = room.secretWord;
    if (!word) return;
    const candidates: number[] = [];
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      if (ch !== ' ' && ch !== '-' && !room.revealedIndices.has(i)) {
        candidates.push(i);
      }
    }
    const maxRevealed = Math.max(1, Math.floor(word.replace(/[^a-zA-Z0-9]/g, '').length * 0.45));
    if (candidates.length === 0 || room.revealedIndices.size >= maxRevealed) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    room.revealedIndices.add(pick);
  }

  private buildMaskedWord(room: InternalRoom): string {
    if (!room.secretWord) return '';
    return room.secretWord
      .split('')
      .map((ch, idx) => {
        if (ch === ' ') return '  ';
        if (ch === '-') return '-';
        return room.revealedIndices.has(idx) ? ch.toUpperCase() : '_';
      })
      .join(' ');
  }

  private getWordLengthHints(word: string | null): number[] {
    if (!word) return [];
    return word.split(' ').map((seg) => seg.length);
  }

  private pushSystemMessage(room: InternalRoom, text: string): void {
    this.pushChatMessage(room, {
      id: crypto.randomBytes(6).toString('hex'),
      type: 'system',
      text,
      timestamp: Date.now(),
    });
  }

  private pushChatMessage(room: InternalRoom, msg: ChatMessage): void {
    room.messages.push(msg);
    if (room.messages.length > 100) {
      room.messages.shift();
    }
    this.io.to(room.id).emit('chat:message', msg);
  }

  private buildStreamerPopupState(room: InternalRoom): StreamerPopupState {
    const isStreamerTurn = room.drawerId === room.ownerId;
    const drawer = room.drawerId ? room.players.get(room.drawerId) : undefined;
    return {
      roomId: room.id,
      roomName: room.settings.name,
      phase: room.phase,
      currentRound: room.currentRound,
      totalRounds: room.settings.rounds,
      isStreamerTurn,
      drawerName: drawer?.username ?? 'Waiting',
      wordOptions: isStreamerTurn && room.phase === 'WORD_SELECT' ? room.wordOptions : [],
      secretWord:
        isStreamerTurn && (room.phase === 'DRAWING' || room.phase === 'TURN_SUMMARY')
          ? room.secretWord
          : room.phase === 'TURN_SUMMARY'
            ? room.secretWord
            : null,
      timeRemaining: room.timeRemaining,
    };
  }

  private emitStreamerPopupState(room: InternalRoom): void {
    const popupState = this.buildStreamerPopupState(room);
    this.io.to(`streamer:${room.id}`).emit('streamer:state', popupState);
  }

  private broadcastRoomState(room: InternalRoom): void {
    for (const player of room.players.values()) {
      if (!player.connected) continue;
      const clientState = this.buildClientStateForPlayer(room, player.id);
      this.io.to(player.socketId).emit('room:state', clientState);
    }
    this.emitStreamerPopupState(room);
  }

  buildClientStateForPlayer(room: InternalRoom, playerId: string): RoomClientState {
    const isOwner = room.ownerId === playerId;
    const isDrawer = room.drawerId === playerId;
    const hideOnMainStreamScreen = room.settings.streamerMode && isOwner && isDrawer;

    const revealSecret =
      room.phase === 'TURN_SUMMARY' || (isDrawer && !hideOnMainStreamScreen);
    const revealWordOptions =
      isDrawer && room.phase === 'WORD_SELECT' && !hideOnMainStreamScreen;

    const sortedPlayers = Array.from(room.players.values())
      .filter((p) => p.connected)
      .sort((a, b) => b.score - a.score);

    const sortedTikTokLeaderboard = Array.from(room.tiktokLeaderboard.values()).sort(
      (a, b) => b.score - a.score || b.wordsGuessed - a.wordsGuessed
    );

    return {
      id: room.id,
      ownerId: room.ownerId,
      streamerSecret: isOwner ? room.streamerSecret : null,
      settings: room.settings,
      phase: room.phase,
      currentRound: room.currentRound,
      totalRounds: room.settings.rounds,
      turnNumber: room.turnNumber,
      drawerId: room.drawerId,
      maskedWord:
        room.phase === 'DRAWING'
          ? this.buildMaskedWord(room)
          : room.phase === 'TURN_SUMMARY'
            ? room.secretWord ?? ''
            : '',
      wordLengthHint: this.getWordLengthHints(room.secretWord),
      secretWord: revealSecret ? room.secretWord : null,
      wordOptions: revealWordOptions ? room.wordOptions : [],
      timeRemaining: room.timeRemaining,
      phaseTotalTime: room.phaseTotalTime,
      players: sortedPlayers,
      messages: room.messages.slice(-60),
      commands: room.commands,
      hasFirstStroke: room.hasFirstStroke,
      canUndo: room.commands.length > 0,
      canRedo: room.redoStack.length > 0,
      turnSummary: room.turnSummary,
      artworks: room.artworks,
      myReaction: room.reactions.get(playerId) ?? null,
      isSoloMode: room.isSoloMode,
      tiktokStatus: room.tiktokBridge.getStatus(),
      tiktokLeaderboard: sortedTikTokLeaderboard,
      tiktokChat: room.tiktokChat.slice(-30),
    };
  }

  private getConnectedPlayers(room: InternalRoom): PlayerState[] {
    return Array.from(room.players.values()).filter((p) => p.connected);
  }

  private getSocketContext(
    socketId: string
  ): { room: InternalRoom; userId: string } | null {
    const mapping = this.socketRoomMap.get(socketId);
    if (!mapping) return null;
    const room = this.rooms.get(mapping.roomId);
    if (!room) return null;
    return { room, userId: mapping.userId };
  }

  private markFirstStrokeIfNeeded(room: InternalRoom): void {
    if (room.hasFirstStroke) return;
    room.hasFirstStroke = true;
    this.broadcastRoomState(room);
  }

  private clearTimer(room: InternalRoom): void {
    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }
  }
}
