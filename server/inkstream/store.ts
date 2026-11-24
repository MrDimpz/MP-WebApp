import fs from 'node:fs';
import path from 'node:path';
import type {
  AvatarConfig,
  PublicUser,
  RoundHistoryEntry,
  SavedArtworkRecord,
} from '../../src/inkstream/shared/types.ts';
import { AVATAR_COLORS } from '../../src/inkstream/shared/words.ts';

export interface StoredUserRecord {
  id: string;
  email: string;
  emailLower: string;
  username: string;
  usernameLower: string;
  passwordSalt: string;
  passwordHash: string;
  isStreamer: boolean;
  tiktokHandle: string;
  avatar: AvatarConfig;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    totalScore: number;
    wordsGuessed: number;
    bestScore: number;
  };
  createdAt: number;
}

interface SessionRow {
  token_hash: string;
  user_id: string;
  expires_at: number;
}

interface AnalyticsRow {
  roomId: string;
  roomName: string;
  ownerId: string;
  entry: RoundHistoryEntry;
  createdAt: number;
}

interface PersistedInkStreamData {
  users: StoredUserRecord[];
  artworks: SavedArtworkRecord[];
  sessions: SessionRow[];
  roundAnalytics: AnalyticsRow[];
}

const customInkStreamDir = (process.env.INKSTREAM_DATA_DIR || '').trim();
const customPersistentDir = (process.env.PERSISTENT_DATA_DIR || '').trim();
const DATA_DIR = path.resolve(
  customInkStreamDir ||
    (customPersistentDir
      ? path.join(customPersistentDir, 'inkstream')
      : path.join(process.cwd(), 'data'))
);
const STORE_PATH = path.resolve(DATA_DIR, 'inkstream-store.json');
const MAX_ARTWORKS_PER_USER = 40;
const MAX_ANALYTICS_ROWS = 200;

class JsonInkStreamStore {
  private data: PersistedInkStreamData = {
    users: [],
    artworks: [],
    sessions: [],
    roundAnalytics: [],
  };

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      if (!fs.existsSync(STORE_PATH)) return;
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      if (!raw.trim()) return;
      const parsed = JSON.parse(raw) as Partial<PersistedInkStreamData>;
      this.data = {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        artworks: Array.isArray(parsed.artworks) ? parsed.artworks : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        roundAnalytics: Array.isArray(parsed.roundAnalytics) ? parsed.roundAnalytics : [],
      };
      // Purge expired sessions on startup
      const now = Date.now();
      this.data.sessions = this.data.sessions.filter((s) => s.expires_at > now);
    } catch {
      this.data = { users: [], artworks: [], sessions: [], roundAnalytics: [] };
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = `${STORE_PATH}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data), 'utf8');
      fs.renameSync(tmp, STORE_PATH);
    } catch {
      // Ignore transient disk write errors
    }
  }

  findUserByEmail(email: string): StoredUserRecord | undefined {
    const lower = email.trim().toLowerCase();
    return this.data.users.find((u) => u.emailLower === lower);
  }

  findUserByUsername(username: string): StoredUserRecord | undefined {
    const lower = username.trim().toLowerCase();
    return this.data.users.find((u) => u.usernameLower === lower);
  }

  findUserById(id: string): StoredUserRecord | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  createUser(record: StoredUserRecord): StoredUserRecord {
    const normalized: StoredUserRecord = {
      ...record,
      avatar: record.avatar || {
        color: AVATAR_COLORS[0],
        eyes: 0,
        mouth: 0,
        accessory: 0,
      },
    };
    this.data.users.push(normalized);
    this.save();
    return normalized;
  }

  updateUserAvatar(userId: string, avatar: AvatarConfig): void {
    const user = this.findUserById(userId);
    if (!user) return;
    user.avatar = avatar;
    this.save();
  }

  updateUserStreamerInfo(userId: string, isStreamer: boolean, tiktokHandle: string): void {
    const user = this.findUserById(userId);
    if (!user) return;
    user.isStreamer = isStreamer;
    user.tiktokHandle = tiktokHandle;
    this.save();
  }

  recordGameResult(userId: string, score: number, won: boolean, wordsGuessed: number): void {
    const user = this.findUserById(userId);
    if (!user) return;
    user.stats.gamesPlayed += 1;
    if (won) user.stats.gamesWon += 1;
    user.stats.totalScore += Math.max(0, score);
    user.stats.wordsGuessed += Math.max(0, wordsGuessed);
    if (score > user.stats.bestScore) user.stats.bestScore = score;
    this.save();
  }

  createPersistentSession(tokenHash: string, userId: string, expiresAt: number): void {
    const now = Date.now();
    this.data.sessions = this.data.sessions.filter(
      (s) => s.expires_at > now && s.token_hash !== tokenHash
    );
    this.data.sessions.push({
      token_hash: tokenHash,
      user_id: userId,
      expires_at: expiresAt,
    });
    this.save();
  }

  findPersistentSession(tokenHash: string): SessionRow | undefined {
    const now = Date.now();
    const row = this.data.sessions.find((s) => s.token_hash === tokenHash);
    if (!row) return undefined;
    if (row.expires_at <= now) {
      this.deletePersistentSession(tokenHash);
      return undefined;
    }
    return row;
  }

  deletePersistentSession(tokenHash: string): void {
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((s) => s.token_hash !== tokenHash);
    if (this.data.sessions.length !== before) {
      this.save();
    }
  }

  toPublicUser(record: StoredUserRecord): PublicUser {
    return {
      id: record.id,
      username: record.username,
      isGuest: false,
      isStreamer: Boolean(record.isStreamer),
      tiktokHandle: record.tiktokHandle || undefined,
      avatar: record.avatar,
      stats: { ...record.stats },
    };
  }

  saveArtwork(record: SavedArtworkRecord): SavedArtworkRecord {
    this.data.artworks.unshift(record);
    // Keep at most MAX_ARTWORKS_PER_USER per user
    let userCount = 0;
    this.data.artworks = this.data.artworks.filter((art) => {
      if (art.userId !== record.userId) return true;
      userCount += 1;
      return userCount <= MAX_ARTWORKS_PER_USER;
    });
    this.save();
    return record;
  }

  listUserArtworks(userId: string): SavedArtworkRecord[] {
    return this.data.artworks
      .filter((art) => art.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  deleteUserArtwork(userId: string, artworkId: string): boolean {
    const before = this.data.artworks.length;
    this.data.artworks = this.data.artworks.filter(
      (art) => !(art.id === artworkId && art.userId === userId)
    );
    const deleted = this.data.artworks.length < before;
    if (deleted) this.save();
    return deleted;
  }

  logRoundAnalytics(
    roomId: string,
    roomName: string,
    ownerId: string,
    entry: RoundHistoryEntry
  ): void {
    this.data.roundAnalytics.unshift({
      roomId,
      roomName,
      ownerId,
      entry,
      createdAt: Date.now(),
    });
    if (this.data.roundAnalytics.length > MAX_ANALYTICS_ROWS) {
      this.data.roundAnalytics = this.data.roundAnalytics.slice(0, MAX_ANALYTICS_ROWS);
    }
    this.save();
  }
}

export const store = new JsonInkStreamStore();
