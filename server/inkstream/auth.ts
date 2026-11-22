import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { AvatarConfig, PublicUser } from '../../src/inkstream/shared/types.ts';
import { AVATAR_COLORS } from '../../src/inkstream/shared/words.ts';
import { store } from './store.ts';

export interface ActiveSession {
  token: string;
  user: PublicUser;
  createdAt: number;
}

// Guest sessions are kept in memory; registered user sessions are persisted as SHA-256 hashes in SQLite.
const guestSessions = new Map<string, ActiveSession>();

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function sanitizeAvatar(raw: unknown): AvatarConfig {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<AvatarConfig>;
  const color =
    typeof input.color === 'string' && HEX_COLOR_RE.test(input.color)
      ? input.color
      : AVATAR_COLORS[0];
  const eyes =
    typeof input.eyes === 'number' && Number.isInteger(input.eyes)
      ? Math.max(0, Math.min(5, input.eyes))
      : 0;
  const mouth =
    typeof input.mouth === 'number' && Number.isInteger(input.mouth)
      ? Math.max(0, Math.min(5, input.mouth))
      : 0;
  const accessory =
    typeof input.accessory === 'number' && Number.isInteger(input.accessory)
      ? Math.max(0, Math.min(5, input.accessory))
      : 0;
  return { color, eyes, mouth, accessory };
}

export function sanitizeUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (cleaned.length < 2 || cleaned.length > 20) return null;
  if (!/^[a-zA-Z0-9 _.-]+$/.test(cleaned)) return null;
  return cleaned;
}

export function sanitizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toLowerCase();
  if (cleaned.length < 5 || cleaned.length > 120) return null;
  if (!EMAIL_RE.test(cleaned)) return null;
  return cleaned;
}

export function sanitizeTikTokHandle(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 32);
}

function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString('hex'));
    });
  });
}

async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const derived = await hashPassword(password, salt);
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function issueRegisteredSession(user: PublicUser): ActiveSession {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  store.createPersistentSession(tokenHash, user.id, Date.now() + SESSION_TTL_MS);
  return {
    token,
    user,
    createdAt: Date.now(),
  };
}

function issueGuestSession(user: PublicUser): ActiveSession {
  const token = crypto.randomBytes(32).toString('hex');
  const session: ActiveSession = {
    token,
    user,
    createdAt: Date.now(),
  };
  guestSessions.set(token, session);
  return session;
}

export function getSessionByToken(token: string | undefined): ActiveSession | null {
  if (!token || typeof token !== 'string') return null;

  const guest = guestSessions.get(token);
  if (guest) return guest;

  const tokenHash = hashSessionToken(token);
  const dbSession = store.findPersistentSession(tokenHash);
  if (!dbSession) return null;

  const record = store.findUserById(dbSession.user_id);
  if (!record) return null;

  return {
    token,
    user: store.toPublicUser(record),
    createdAt: Date.now(),
  };
}

export function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return undefined;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;
  return token.trim();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  const session = getSessionByToken(token);
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  (req as Request & { session?: ActiveSession }).session = session;
  next();
}

export async function handleRegister(req: Request, res: Response): Promise<void> {
  const email = sanitizeEmail(req.body?.email);
  const username = sanitizeUsername(req.body?.username);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const avatar = sanitizeAvatar(req.body?.avatar);
  const isStreamer = Boolean(req.body?.isStreamer);
  const tiktokHandle = sanitizeTikTokHandle(req.body?.tiktokHandle);

  if (!email) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (!username) {
    res.status(400).json({
      error: 'Display name must be 2–20 characters (letters, numbers, spaces, _, -, .).',
    });
    return;
  }
  if (password.length < 6 || password.length > 100) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  if (store.findUserByEmail(email)) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }
  if (store.findUserByUsername(username)) {
    res.status(409).json({ error: 'That display name is already taken.' });
    return;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = await hashPassword(password, salt);
  const userId = `u_${crypto.randomBytes(8).toString('hex')}`;

  const created = store.createUser({
    id: userId,
    email,
    emailLower: email.toLowerCase(),
    username,
    usernameLower: username.toLowerCase(),
    passwordSalt: salt,
    passwordHash,
    isStreamer,
    tiktokHandle,
    avatar,
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      wordsGuessed: 0,
      bestScore: 0,
    },
    createdAt: Date.now(),
  });

  const publicUser = store.toPublicUser(created);
  const session = issueRegisteredSession(publicUser);
  res.status(201).json({ token: session.token, user: publicUser });
}

export async function handleLogin(req: Request, res: Response): Promise<void> {
  const identifier =
    typeof req.body?.email === 'string' && req.body.email.trim()
      ? req.body.email.trim()
      : typeof req.body?.username === 'string'
        ? req.body.username.trim()
        : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!identifier || !password) {
    res.status(400).json({ error: 'Enter your email and password.' });
    return;
  }

  const record = identifier.includes('@')
    ? store.findUserByEmail(identifier)
    : store.findUserByUsername(identifier);

  if (!record) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const valid = await verifyPassword(password, record.passwordSalt, record.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (req.body?.avatar) {
    const avatar = sanitizeAvatar(req.body.avatar);
    store.updateUserAvatar(record.id, avatar);
  }
  if (typeof req.body?.isStreamer === 'boolean' || typeof req.body?.tiktokHandle === 'string') {
    const nextIsStreamer =
      typeof req.body?.isStreamer === 'boolean' ? req.body.isStreamer : record.isStreamer;
    const nextHandle =
      typeof req.body?.tiktokHandle === 'string'
        ? sanitizeTikTokHandle(req.body.tiktokHandle)
        : record.tiktokHandle;
    store.updateUserStreamerInfo(record.id, nextIsStreamer, nextHandle);
  }

  const fresh = store.findUserById(record.id) ?? record;
  const publicUser = store.toPublicUser(fresh);
  const session = issueRegisteredSession(publicUser);
  res.json({ token: session.token, user: publicUser });
}

export function handleGuestLogin(req: Request, res: Response): void {
  const raw = typeof req.body?.username === 'string' ? req.body.username : '';
  const sanitized = sanitizeUsername(raw) ?? `Artist_${Math.floor(100 + Math.random() * 900)}`;
  const avatar = sanitizeAvatar(req.body?.avatar);
  const isStreamer = Boolean(req.body?.isStreamer);
  const tiktokHandle = sanitizeTikTokHandle(req.body?.tiktokHandle);

  const guestUser: PublicUser = {
    id: `g_${crypto.randomBytes(8).toString('hex')}`,
    username: sanitized,
    isGuest: true,
    isStreamer,
    tiktokHandle: tiktokHandle || undefined,
    avatar,
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      wordsGuessed: 0,
      bestScore: 0,
    },
  };

  const session = issueGuestSession(guestUser);
  res.status(201).json({ token: session.token, user: guestUser });
}

export function handleUpdateProfile(req: Request, res: Response): void {
  const session = (req as Request & { session?: ActiveSession }).session;
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.body?.avatar) {
    const avatar = sanitizeAvatar(req.body.avatar);
    session.user.avatar = avatar;
    if (!session.user.isGuest) {
      store.updateUserAvatar(session.user.id, avatar);
    }
  }

  if (typeof req.body?.isStreamer === 'boolean' || typeof req.body?.tiktokHandle === 'string') {
    const nextIsStreamer =
      typeof req.body?.isStreamer === 'boolean'
        ? req.body.isStreamer
        : Boolean(session.user.isStreamer);
    const nextHandle =
      typeof req.body?.tiktokHandle === 'string'
        ? sanitizeTikTokHandle(req.body.tiktokHandle)
        : session.user.tiktokHandle || '';
    session.user.isStreamer = nextIsStreamer;
    session.user.tiktokHandle = nextHandle || undefined;
    if (!session.user.isGuest) {
      store.updateUserStreamerInfo(session.user.id, nextIsStreamer, nextHandle);
    }
  }

  if (session.user.isGuest && req.body?.username) {
    const clean = sanitizeUsername(req.body.username);
    if (clean) {
      session.user.username = clean;
    }
  }

  res.json({ user: session.user });
}

export function handleLogout(req: Request, res: Response): void {
  const token = extractBearerToken(req);
  if (token) {
    guestSessions.delete(token);
    store.deletePersistentSession(hashSessionToken(token));
  }
  res.json({ ok: true });
}
