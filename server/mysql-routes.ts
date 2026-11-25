import type { Express, Request, Response } from "express";
import type { RowDataPacket } from "mysql2";
import {
  getMysqlPool,
  getMysqlStatus,
  initMysqlDatabase,
} from "./mysql-db.ts";
import {
  isVerifiedAdminUser,
  verifyFirebaseBearerToken,
  type VerifiedFirebaseUser,
} from "./firebase-token.ts";

const ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const TIKTOK_HANDLE_REGEX = /^(@[a-zA-Z0-9_.-]+)?$/;

const ALLOWED_LANGUAGES = new Set(["en", "es", "fr", "de", "it", "pt", "tl"]);
const ALLOWED_PROVIDERS = new Set(["email", "google", "site"]);
const ALLOWED_SQUARED_MODES = new Set(["express-3x3", "daily-4x4", "royal-5x5"]);
const ALLOWED_LEADERBOARD_GAMES = new Set([
  "crossword",
  "rebus",
  "squared",
  "thematix",
  "destack",
  "unolingo",
  "wikirec",
  "wikicon",
  "mpsearch",
  "mpdifference",
  "mpcolossal",
  "tekscodle",
  "wordhunt",
]);
const ALLOWED_PROGRESS_BUCKETS = new Set([
  "daily_streaks",
  "interactive_scores",
  "crossword",
  "rebus",
  "squared",
  "thematix",
  "destack",
  "unolingo",
  "mpsearch",
  "mpdifference",
  "mpcolossal",
  "tekscodle",
  "wordhunt",
]);

function isValidId(val: unknown, maxLen = 128): val is string {
  return (
    typeof val === "string" &&
    val.length >= 1 &&
    val.length <= maxLen &&
    ID_REGEX.test(val)
  );
}

function sanitizeDisplayName(raw: unknown): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "Player";
  if (trimmed.toLowerCase().includes("phreakfrog")) {
    return "Missing Piece Host";
  }
  const clean = trimmed.includes("@") ? trimmed.split("@")[0] || "Player" : trimmed;
  return clean.slice(0, 60) || "Player";
}

function sanitizeTikTokHandle(raw: unknown): string {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
  if (!cleaned) return "";
  const formatted = `@${cleaned}`;
  if (formatted.length > 40 || !TIKTOK_HANDLE_REGEX.test(formatted)) return "";
  return formatted;
}

function sanitizeLanguage(raw: unknown): string {
  const code = String(raw || "en").trim().toLowerCase();
  return ALLOWED_LANGUAGES.has(code) ? code : "en";
}

function sanitizeProvider(raw: unknown, fallback = "email"): string {
  const p = String(raw || fallback).trim().toLowerCase();
  return ALLOWED_PROVIDERS.has(p) ? p : fallback;
}

function toSafeTimestamp(raw: unknown, fallback = Date.now()): number {
  const num = Number(raw);
  if (Number.isFinite(num) && num > 0) return Math.floor(num);
  return fallback;
}

async function requireAuthUser(
  req: Request,
  res: Response,
): Promise<VerifiedFirebaseUser | null> {
  const authUser = await verifyFirebaseBearerToken(req);
  if (!authUser || !isValidId(authUser.uid, 128)) {
    res.status(401).json({ ok: false, error: "Valid Firebase sign-in token required." });
    return null;
  }
  return authUser;
}

export interface MysqlRegisteredUserRow {
  uid: string;
  displayName: string;
  tiktokConnected: boolean;
  linkedTikTokHandle: string;
  authProvider: "email" | "google" | "site";
  createdAt: number;
  updatedAt: number;
}

export async function getMysqlRegisteredUsersForAdmin(): Promise<
  MysqlRegisteredUserRow[] | null
> {
  const pool = getMysqlPool();
  if (!pool) return null;
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT user_id, display_name, tiktok_connected, linked_tiktok_handle, auth_provider, created_at, updated_at
       FROM registered_users
       ORDER BY updated_at DESC
       LIMIT 1000`,
    );
    return rows.map((r) => ({
      uid: String(r.user_id),
      displayName: sanitizeDisplayName(r.display_name),
      tiktokConnected: Boolean(r.tiktok_connected),
      linkedTikTokHandle: sanitizeTikTokHandle(r.linked_tiktok_handle),
      authProvider: sanitizeProvider(r.auth_provider, "email") as
        | "email"
        | "google"
        | "site",
      createdAt: Number(r.created_at) || Date.now(),
      updatedAt: Number(r.updated_at) || Date.now(),
    }));
  } catch {
    return null;
  }
}

export function registerMysqlRoutes(app: Express): void {
  // Kick off background MySQL connection check if env vars are present
  void initMysqlDatabase();

  // 1) Public non-sensitive DB status check (never leaks credentials/hosts)
  app.get("/api/db/status", async (req, res) => {
    const includeCounts = req.query.counts === "1" || req.query.counts === "true";
    const status = await getMysqlStatus(includeCounts);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...status });
  });

  // 2) Authenticated user profile (GET + PUT)
  app.get("/api/db/me/profile", async (req, res) => {
    const pool = getMysqlPool();
    if (!pool) {
      res.status(503).json({ ok: false, error: "MySQL backend not configured." });
      return;
    }
    const authUser = await requireAuthUser(req, res);
    if (!authUser) return;

    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT user_id, display_name, linked_tiktok_handle, preferred_language, dark_mode, created_at, updated_at
         FROM users
         WHERE user_id = ?
         LIMIT 1`,
        [authUser.uid],
      );
      if (rows.length === 0) {
        res.json({ ok: true, profile: null });
        return;
      }
      const r = rows[0];
      res.json({
        ok: true,
        profile: {
          userId: String(r.user_id),
          displayName: sanitizeDisplayName(r.display_name),
          linkedTikTokHandle: sanitizeTikTokHandle(r.linked_tiktok_handle),
          preferredLanguage: sanitizeLanguage(r.preferred_language),
          darkMode: Boolean(r.dark_mode),
          createdAt: Number(r.created_at),
          updatedAt: Number(r.updated_at),
        },
      });
    } catch (err) {
      console.error("[MySQL] GET /api/db/me/profile error:", err);
      res.status(500).json({ ok: false, error: "Failed to load user profile." });
    }
  });

  app.put("/api/db/me/profile", async (req, res) => {
    const pool = getMysqlPool();
    if (!pool) {
      res.status(503).json({ ok: false, error: "MySQL backend not configured." });
      return;
    }
    const authUser = await requireAuthUser(req, res);
    if (!authUser) return;

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const now = Date.now();

    try {
      const [existingRows] = await pool.execute<RowDataPacket[]>(
        `SELECT user_id, display_name, linked_tiktok_handle, preferred_language, dark_mode, created_at
         FROM users
         WHERE user_id = ?
         LIMIT 1`,
        [authUser.uid],
      );

      if (existingRows.length === 0) {
        const displayName = sanitizeDisplayName(
          body.displayName ?? authUser.name ?? authUser.email?.split("@")[0],
        );
        const linkedTikTokHandle = sanitizeTikTokHandle(body.linkedTikTokHandle);
        const preferredLanguage = sanitizeLanguage(body.preferredLanguage);
        const darkMode = typeof body.darkMode === "boolean" ? body.darkMode : true;

        await pool.execute(
          `INSERT INTO users (user_id, display_name, linked_tiktok_handle, preferred_language, dark_mode, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            authUser.uid,
            displayName,
            linkedTikTokHandle,
            preferredLanguage,
            darkMode ? 1 : 0,
            now,
            now,
          ],
        );
        res.json({
          ok: true,
          profile: {
            userId: authUser.uid,
            displayName,
            linkedTikTokHandle,
            preferredLanguage,
            darkMode,
            createdAt: now,
            updatedAt: now,
          },
        });
        return;
      }

      const prev = existingRows[0];
      const displayName =
        body.displayName !== undefined
          ? sanitizeDisplayName(body.displayName)
          : sanitizeDisplayName(prev.display_name);
      const linkedTikTokHandle =
        body.linkedTikTokHandle !== undefined
          ? sanitizeTikTokHandle(body.linkedTikTokHandle)
          : sanitizeTikTokHandle(prev.linked_tiktok_handle);
      const preferredLanguage =
        body.preferredLanguage !== undefined
          ? sanitizeLanguage(body.preferredLanguage)
          : sanitizeLanguage(prev.preferred_language);
      const darkMode =
        typeof body.darkMode === "boolean" ? body.darkMode : Boolean(prev.dark_mode);

      await pool.execute(
        `UPDATE users
         SET display_name = ?, linked_tiktok_handle = ?, preferred_language = ?, dark_mode = ?, updated_at = ?
         WHERE user_id = ?`,
        [
          displayName,
          linkedTikTokHandle,
          preferredLanguage,
          darkMode ? 1 : 0,
          now,
          authUser.uid,
        ],
      );

      res.json({
        ok: true,
        profile: {
          userId: authUser.uid,
          displayName,
          linkedTikTokHandle,
          preferredLanguage,
          darkMode,
          createdAt: Number(prev.created_at),
          updatedAt: now,
        },
      });
    } catch (err) {
      console.error("[MySQL] PUT /api/db/me/profile error:", err);
      res.status(500).json({ ok: false, error: "Failed to save user profile." });
    }
  });

  // 3) Authenticated user progress buckets (GET all + PUT single bucket)
  app.get("/api/db/me/progress", async (req, res) => {
    const pool = getMysqlPool();
    if (!pool) {
      res.status(503).json({ ok: false, error: "MySQL backend not configured." });
      return;
    }
    const authUser = await requireAuthUser(req, res);
    if (!authUser) return;

    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT bucket_id, payload_json, created_at, updated_at
         FROM user_progress
         WHERE user_id = ?`,
        [authUser.uid],
      );
      const buckets: Record<string, Record<string, unknown>> = {};
      for (const r of rows) {
        const bId = String(r.bucket_id);
        if (!ALLOWED_PROGRESS_BUCKETS.has(bId)) continue;
        try {
          const parsed =
            typeof r.payload_json === "string"
              ? JSON.parse(r.payload_json)
              : r.payload_json;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            buckets[bId] = parsed as Record<string, unknown>;
          }
        } catch {
          // Ignore malformed JSON row
        }
      }
      res.json({ ok: true, buckets });
    } catch (err) {
      console.error("[MySQL] GET /api/db/me/progress error:", err);
      res.status(500).json({ ok: false, error: "Failed to load saved progress." });
    }
  });

  app.put("/api/db/me/progress/:bucketId", async (req, res) => {
    const pool = getMysqlPool();
    if (!pool) {
      res.status(503).json({ ok: false, error: "MySQL backend not configured." });
      return;
    }
    const authUser = await requireAuthUser(req, res);
    if (!authUser) return;

    const bucketId = String(req.params.bucketId || "").trim();
    if (!ALLOWED_PROGRESS_BUCKETS.has(bucketId)) {
      res.status(400).json({ ok: false, error: "Invalid progress bucket ID." });
      return;
    }

    const payload = req.body?.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      res.status(400).json({ ok: false, error: "Valid JSON object payload required." });
      return;
    }

    let serialized = "";
    try {
      serialized = JSON.stringify(payload);
    } catch {
      res.status(400).json({ ok: false, error: "Payload is not JSON serializable." });
      return;
    }
    if (serialized.length > 1024 * 1024) {
      res.status(413).json({ ok: false, error: "Progress payload exceeds 1 MB limit." });
      return;
    }

    const now = Date.now();
    try {
      // Ensure parent user row exists so FK constraint always holds
      const fallbackName = sanitizeDisplayName(
        authUser.name ?? authUser.email?.split("@")[0],
      );
      await pool.execute(
        `INSERT IGNORE INTO users (user_id, display_name, linked_tiktok_handle, preferred_language, dark_mode, created_at, updated_at)
         VALUES (?, ?, '', 'en', 1, ?, ?)`,
        [authUser.uid, fallbackName, now, now],
      );

      await pool.execute(
        `INSERT INTO user_progress (user_id, bucket_id, payload_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           payload_json = VALUES(payload_json),
           updated_at = VALUES(updated_at)`,
        [authUser.uid, bucketId, serialized, now, now],
      );

      res.json({ ok: true, bucketId, updatedAt: now });
    } catch (err) {
      console.error("[MySQL] PUT /api/db/me/progress error:", err);
      res.status(500).json({ ok: false, error: "Failed to save progress bucket." });
    }
  });

  // 4) Unified Leaderboard (public GET, authenticated POST)
  app.get("/api/db/leaderboard", async (_req, res) => {
    const pool = getMysqlPool();
    if (!pool) {
      res.status(503).json({ ok: false, error: "MySQL backend not configured." });
      return;
    }
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT entry_id, user_id, display_name, game_id, puzzle_id, puzzle_title, score, metric_label, sub_metric_label, created_at, updated_at
         FROM leaderboard
         ORDER BY score DESC
         LIMIT 500`,
      );
      res.json({
        ok: true,
        entries: rows.map((r) => ({
          id: String(r.entry_id),
          userId: String(r.user_id),
          displayName: sanitizeDisplayName(r.display_name),
          gameId: String(r.game_id),
          puzzleId: String(r.puzzle_id),
          puzzleTitle: String(r.puzzle_title),
          score: Number(r.score) || 0,
          metricLabel: String(r.metric_label),
          subMetricLabel: String(r.sub_metric_label),
          createdAt: Number(r.created_at) || Date.now(),
          updatedAt: Number(r.updated_at) || Date.now(),
        })),
      });
    } catch (err) {
      console.error("[MySQL] GET /api/db/leaderboard error:", err);
      res.status(500).json({ ok: false, error: "Failed to load leaderboard." });
    }
  });

  app.post("/api/db/leaderboard", async (req, res) => {
    const pool = getMysqlPool();
    if (!pool) {
      res.status(503).json({ ok: false, error: "MySQL backend not configured." });
      return;
    }
    const authUser = await requireAuthUser(req, res);
    if (!authUser) return;

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const gameId = String(body.gameId || "").trim().toLowerCase();
    if (!ALLOWED_LEADERBOARD_GAMES.has(gameId)) {
      res.status(400).json({ ok: false, error: "Invalid gameId." });
      return;
    }

    const safeUid = authUser.uid.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    const puzzleId = String(body.puzzleId || gameId)
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 64);
    const entryId = isValidId(body.entryId, 128)
      ? body.entryId
      : `${gameId}_${safeUid}`.slice(0, 128);

    // Ensure callers can only write entries scoped to their own UID
    if (!entryId.endsWith(`_${safeUid}`)) {
      res.status(403).json({ ok: false, error: "Entry ID must belong to signed-in user." });
      return;
    }

    const displayName = sanitizeDisplayName(body.displayName ?? authUser.name);
    const puzzleTitle = String(body.puzzleTitle || gameId).trim().slice(0, 100) || gameId;
    const score = Math.max(0, Math.min(1000000, Math.round(Number(body.score) || 0)));
    const metricLabel = String(body.metricLabel || `${score} pts`).trim().slice(0, 60);
    const subMetricLabel = String(body.subMetricLabel || metricLabel).trim().slice(0, 80);
    const now = Date.now();

    try {
      const [existing] = await pool.execute<RowDataPacket[]>(
        `SELECT user_id, score FROM leaderboard WHERE entry_id = ? LIMIT 1`,
        [entryId],
      );
      if (existing.length > 0) {
        if (String(existing[0].user_id) !== authUser.uid) {
          res.status(403).json({ ok: false, error: "Cannot modify another player's score." });
          return;
        }
        const prevScore = Number(existing[0].score) || 0;
        if (score >= prevScore) {
          await pool.execute(
            `UPDATE leaderboard
             SET display_name = ?, puzzle_title = ?, score = ?, metric_label = ?, sub_metric_label = ?, updated_at = ?
             WHERE entry_id = ? AND user_id = ?`,
            [
              displayName,
              puzzleTitle,
              score,
              metricLabel,
              subMetricLabel,
              now,
              entryId,
              authUser.uid,
            ],
          );
        }
      } else {
        await pool.execute(
          `INSERT INTO leaderboard
             (entry_id, user_id, display_name, game_id, puzzle_id, puzzle_title, score, metric_label, sub_metric_label, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entryId,
            authUser.uid,
            displayName,
            gameId,
            puzzleId || gameId,
            puzzleTitle,
            score,
            metricLabel,
            subMetricLabel,
            now,
            now,
          ],
        );
      }
      res.json({ ok: true, entryId, score });
    } catch (err) {
      console.error("[MySQL] POST /api/db/leaderboard error:", err);
      res.status(500).json({ ok: false, error: "Failed to save leaderboard score." });
    }
  });

  // 5) Squared High Scores (public GET with optional ?userId=, authenticated POST)
  app.get("/api/db/highscores", async (req, res) => {
    const pool = getMysqlPool();
    if (!pool) {
      res.status(503).json({ ok: false, error: "MySQL backend not configured." });
      return;
    }
    const rawUserId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    if (rawUserId && !isValidId(rawUserId, 128)) {
      res.status(400).json({ ok: false, error: "Invalid userId filter." });
      return;
    }

    try {
      const [rows] = rawUserId
        ? await pool.execute<RowDataPacket[]>(
            `SELECT score_id, user_id, display_name, puzzle_id, mode, score, words_found, total_words, bonus_words_count, found_featured, created_at, updated_at
             FROM highscores
             WHERE user_id = ?
             ORDER BY score DESC
             LIMIT 500`,
            [rawUserId],
          )
        : await pool.query<RowDataPacket[]>(
            `SELECT score_id, user_id, display_name, puzzle_id, mode, score, words_found, total_words, bonus_words_count, found_featured, created_at, updated_at
             FROM highscores
             ORDER BY score DESC
             LIMIT 500`,
          );

      res.json({
        ok: true,
        scores: rows.map((r) => ({
          id: String(r.score_id),
          userId: String(r.user_id),
          displayName: sanitizeDisplayName(r.display_name),
          puzzleId: String(r.puzzle_id),
          mode: String(r.mode),
          score: Number(r.score) || 0,
          wordsFound: Number(r.words_found) || 0,
          totalWords: Number(r.total_words) || 1,
          bonusWordsCount: Number(r.bonus_words_count) || 0,
          foundFeatured: Boolean(r.found_featured),
          createdAt: Number(r.created_at) || Date.now(),
          updatedAt: Number(r.updated_at) || Date.now(),
        })),
      });
    } catch (err) {
      console.error("[MySQL] GET /api/db/highscores error:", err);
      res.status(500).json({ ok: false, error: "Failed to load high scores." });
    }
  });

  app.post("/api/db/highscores", async (req, res) => {
    const pool = getMysqlPool();
    if (!pool) {
      res.status(503).json({ ok: false, error: "MySQL backend not configured." });
      return;
    }
    const authUser = await requireAuthUser(req, res);
    if (!authUser) return;

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const mode = String(body.mode || "").trim();
    if (!ALLOWED_SQUARED_MODES.has(mode)) {
      res.status(400).json({ ok: false, error: "Invalid Squared mode." });
      return;
    }

    const safeUid = authUser.uid.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
    const safePuzzleId = String(body.puzzleId || "")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 64);
    if (!safePuzzleId) {
      res.status(400).json({ ok: false, error: "Valid puzzleId required." });
      return;
    }

    const scoreId = `${safeUid}_${safePuzzleId}`.slice(0, 128);
    const displayName = sanitizeDisplayName(body.displayName ?? authUser.name);
    const score = Math.max(0, Math.min(100000, Math.floor(Number(body.score) || 0)));
    const totalWords = Math.max(1, Math.min(500, Math.floor(Number(body.totalWords) || 1)));
    const wordsFound = Math.max(
      0,
      Math.min(totalWords, Math.floor(Number(body.wordsFound) || 0)),
    );
    const bonusWordsCount = Math.max(
      0,
      Math.min(500, Math.floor(Number(body.bonusWordsCount) || 0)),
    );
    const foundFeatured = Boolean(body.foundFeatured);
    const now = Date.now();

    try {
      const [existing] = await pool.execute<RowDataPacket[]>(
        `SELECT user_id, score, words_found, bonus_words_count, found_featured FROM highscores WHERE score_id = ? LIMIT 1`,
        [scoreId],
      );
      if (existing.length > 0) {
        if (String(existing[0].user_id) !== authUser.uid) {
          res.status(403).json({ ok: false, error: "Cannot modify another player's high score." });
          return;
        }
        const prevScore = Number(existing[0].score) || 0;
        const prevWords = Number(existing[0].words_found) || 0;
        const prevBonus = Number(existing[0].bonus_words_count) || 0;
        const prevFeatured = Boolean(existing[0].found_featured);
        if (
          score >= prevScore &&
          (score > prevScore ||
            wordsFound > prevWords ||
            bonusWordsCount > prevBonus ||
            (foundFeatured && !prevFeatured))
        ) {
          await pool.execute(
            `UPDATE highscores
             SET display_name = ?, score = ?, words_found = ?, bonus_words_count = ?, found_featured = ?, updated_at = ?
             WHERE score_id = ? AND user_id = ?`,
            [
              displayName,
              score,
              wordsFound,
              bonusWordsCount,
              foundFeatured || prevFeatured ? 1 : 0,
              now,
              scoreId,
              authUser.uid,
            ],
          );
        }
      } else {
        await pool.execute(
          `INSERT INTO highscores
             (score_id, user_id, display_name, puzzle_id, mode, score, words_found, total_words, bonus_words_count, found_featured, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            scoreId,
            authUser.uid,
            displayName,
            safePuzzleId,
            mode,
            score,
            wordsFound,
            totalWords,
            bonusWordsCount,
            foundFeatured ? 1 : 0,
            now,
            now,
          ],
        );
      }
      res.json({ ok: true, scoreId, score });
    } catch (err) {
      console.error("[MySQL] POST /api/db/highscores error:", err);
      res.status(500).json({ ok: false, error: "Failed to save high score." });
    }
  });

  // 6) Registered Users Directory (public non-PII GET, authenticated POST for own UID)
  app.get("/api/db/registered-users", async (_req, res) => {
    const pool = getMysqlPool();
    if (!pool) {
      res.status(503).json({ ok: false, error: "MySQL backend not configured." });
      return;
    }
    try {
      const users = await getMysqlRegisteredUsersForAdmin();
      res.json({ ok: true, users: users || [] });
    } catch (err) {
      console.error("[MySQL] GET /api/db/registered-users error:", err);
      res.status(500).json({ ok: false, error: "Failed to load registered users." });
    }
  });

  app.post("/api/db/registered-users", async (req, res) => {
    const pool = getMysqlPool();
    if (!pool) {
      res.status(503).json({ ok: false, error: "MySQL backend not configured." });
      return;
    }
    const authUser = await requireAuthUser(req, res);
    if (!authUser) return;

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const explicitTikTokUpdate = Boolean(body.explicitTikTokUpdate);
    const incomingName = sanitizeDisplayName(body.displayName ?? authUser.name);
    const incomingHandle = sanitizeTikTokHandle(body.linkedTikTokHandle);
    const defaultProvider =
      authUser.signInProvider === "google.com" ? "google" : "email";
    const incomingProvider = sanitizeProvider(body.authProvider, defaultProvider);
    const now = Date.now();

    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT display_name, linked_tiktok_handle, auth_provider FROM registered_users WHERE user_id = ? LIMIT 1`,
        [authUser.uid],
      );
      if (rows.length === 0) {
        await pool.execute(
          `INSERT INTO registered_users
             (user_id, display_name, tiktok_connected, linked_tiktok_handle, auth_provider, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            authUser.uid,
            incomingName,
            incomingHandle ? 1 : 0,
            incomingHandle,
            incomingProvider,
            now,
            now,
          ],
        );
      } else {
        const prev = rows[0];
        const prevHandle = sanitizeTikTokHandle(prev.linked_tiktok_handle);
        const finalHandle = explicitTikTokUpdate
          ? incomingHandle
          : incomingHandle || prevHandle;
        const prevName = sanitizeDisplayName(prev.display_name);
        const isGeneric =
          incomingName === "Player" || incomingName === "Puzzle Seeker";
        const finalName = isGeneric && prevName !== "Player" ? prevName : incomingName;
        const finalProvider =
          incomingProvider !== "site"
            ? incomingProvider
            : sanitizeProvider(prev.auth_provider, "site");

        await pool.execute(
          `UPDATE registered_users
           SET display_name = ?, tiktok_connected = ?, linked_tiktok_handle = ?, auth_provider = ?, updated_at = ?
           WHERE user_id = ?`,
          [
            finalName,
            finalHandle ? 1 : 0,
            finalHandle,
            finalProvider,
            now,
            authUser.uid,
          ],
        );
      }
      res.json({ ok: true, uid: authUser.uid });
    } catch (err) {
      console.error("[MySQL] POST /api/db/registered-users error:", err);
      res.status(500).json({ ok: false, error: "Failed to sync registered user." });
    }
  });

  // 7) Admin-Only Direct Snapshot Import (Firestore -> Hostinger MySQL inside a transaction)
  app.post("/api/db/admin/import", async (req, res) => {
    const pool = getMysqlPool();
    if (!pool) {
      res.status(503).json({
        ok: false,
        error: "Hostinger MySQL is not connected yet. Set MYSQL_* environment variables first.",
      });
      return;
    }

    const authUser = await requireAuthUser(req, res);
    if (!authUser) return;
    if (!isVerifiedAdminUser(authUser)) {
      res.status(403).json({
        ok: false,
        error: "Verified Firebase Admin account required for direct database import.",
      });
      return;
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const usersList = Array.isArray(body.users) ? body.users : [];
    const progressList = Array.isArray(body.userProgress) ? body.userProgress : [];
    const registeredList = Array.isArray(body.registeredUsers) ? body.registeredUsers : [];
    const leaderboardList = Array.isArray(body.leaderboard) ? body.leaderboard : [];
    const highscoresList = Array.isArray(body.highscores) ? body.highscores : [];

    const now = Date.now();
    const counts = {
      users: 0,
      userProgress: 0,
      registeredUsers: 0,
      leaderboard: 0,
      highscores: 0,
    };

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Users
      for (const raw of usersList) {
        const uid = String(raw?.userId || raw?.uid || "").trim();
        if (!isValidId(uid, 128)) continue;
        await conn.execute(
          `INSERT INTO users
             (user_id, display_name, linked_tiktok_handle, preferred_language, dark_mode, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             display_name = VALUES(display_name),
             linked_tiktok_handle = IF(VALUES(linked_tiktok_handle) != '', VALUES(linked_tiktok_handle), linked_tiktok_handle),
             preferred_language = VALUES(preferred_language),
             dark_mode = VALUES(dark_mode),
             updated_at = GREATEST(updated_at, VALUES(updated_at))`,
          [
            uid,
            sanitizeDisplayName(raw?.displayName),
            sanitizeTikTokHandle(raw?.linkedTikTokHandle),
            sanitizeLanguage(raw?.preferredLanguage),
            raw?.darkMode === false ? 0 : 1,
            toSafeTimestamp(raw?.createdAt, now),
            toSafeTimestamp(raw?.updatedAt, now),
          ],
        );
        counts.users += 1;
      }

      // 2. User Progress Buckets (auto-ensure parent user row exists)
      for (const raw of progressList) {
        const uid = String(raw?.userId || "").trim();
        const bucketId = String(raw?.bucketId || "").trim();
        if (!isValidId(uid, 128) || !ALLOWED_PROGRESS_BUCKETS.has(bucketId)) continue;
        if (!raw?.payload || typeof raw.payload !== "object") continue;
        let payloadJson = "";
        try {
          payloadJson = JSON.stringify(raw.payload);
        } catch {
          continue;
        }
        const createdAt = toSafeTimestamp(raw?.createdAt, now);
        const updatedAt = toSafeTimestamp(raw?.updatedAt, now);

        await conn.execute(
          `INSERT IGNORE INTO users (user_id, display_name, linked_tiktok_handle, preferred_language, dark_mode, created_at, updated_at)
           VALUES (?, 'Player', '', 'en', 1, ?, ?)`,
          [uid, createdAt, updatedAt],
        );
        await conn.execute(
          `INSERT INTO user_progress (user_id, bucket_id, payload_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             payload_json = IF(VALUES(updated_at) >= updated_at, VALUES(payload_json), payload_json),
             updated_at = GREATEST(updated_at, VALUES(updated_at))`,
          [uid, bucketId, payloadJson, createdAt, updatedAt],
        );
        counts.userProgress += 1;
      }

      // 3. Registered Users
      for (const raw of registeredList) {
        const uid = String(raw?.userId || raw?.uid || "").trim();
        if (!isValidId(uid, 128)) continue;
        const handle = sanitizeTikTokHandle(raw?.linkedTikTokHandle);
        await conn.execute(
          `INSERT INTO registered_users
             (user_id, display_name, tiktok_connected, linked_tiktok_handle, auth_provider, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             display_name = VALUES(display_name),
             tiktok_connected = IF(VALUES(linked_tiktok_handle) != '', 1, tiktok_connected),
             linked_tiktok_handle = IF(VALUES(linked_tiktok_handle) != '', VALUES(linked_tiktok_handle), linked_tiktok_handle),
             auth_provider = VALUES(auth_provider),
             updated_at = GREATEST(updated_at, VALUES(updated_at))`,
          [
            uid,
            sanitizeDisplayName(raw?.displayName),
            handle ? 1 : 0,
            handle,
            sanitizeProvider(raw?.authProvider, "email"),
            toSafeTimestamp(raw?.createdAt, now),
            toSafeTimestamp(raw?.updatedAt, now),
          ],
        );
        counts.registeredUsers += 1;
      }

      // 4. Leaderboard
      for (const raw of leaderboardList) {
        const entryId = String(raw?.entryId || raw?.id || "").trim();
        const uid = String(raw?.userId || "").trim();
        const gameId = String(raw?.gameId || "").trim().toLowerCase();
        if (
          !isValidId(entryId, 128) ||
          !isValidId(uid, 128) ||
          !ALLOWED_LEADERBOARD_GAMES.has(gameId)
        ) {
          continue;
        }
        const score = Math.max(0, Math.min(1000000, Math.round(Number(raw?.score) || 0)));
        await conn.execute(
          `INSERT INTO leaderboard
             (entry_id, user_id, display_name, game_id, puzzle_id, puzzle_title, score, metric_label, sub_metric_label, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             display_name = IF(VALUES(score) >= score, VALUES(display_name), display_name),
             puzzle_title = IF(VALUES(score) >= score, VALUES(puzzle_title), puzzle_title),
             metric_label = IF(VALUES(score) >= score, VALUES(metric_label), metric_label),
             sub_metric_label = IF(VALUES(score) >= score, VALUES(sub_metric_label), sub_metric_label),
             score = GREATEST(score, VALUES(score)),
             updated_at = GREATEST(updated_at, VALUES(updated_at))`,
          [
            entryId,
            uid,
            sanitizeDisplayName(raw?.displayName),
            gameId,
            String(raw?.puzzleId || gameId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) ||
              gameId,
            String(raw?.puzzleTitle || gameId).slice(0, 100),
            score,
            String(raw?.metricLabel || `${score} pts`).slice(0, 60),
            String(raw?.subMetricLabel || "").slice(0, 80),
            toSafeTimestamp(raw?.createdAt, now),
            toSafeTimestamp(raw?.updatedAt, now),
          ],
        );
        counts.leaderboard += 1;
      }

      // 5. High Scores
      for (const raw of highscoresList) {
        const scoreId = String(raw?.scoreId || raw?.id || "").trim();
        const uid = String(raw?.userId || "").trim();
        const mode = String(raw?.mode || "").trim();
        if (
          !isValidId(scoreId, 128) ||
          !isValidId(uid, 128) ||
          !ALLOWED_SQUARED_MODES.has(mode)
        ) {
          continue;
        }
        const score = Math.max(0, Math.min(100000, Math.floor(Number(raw?.score) || 0)));
        const totalWords = Math.max(1, Math.min(500, Math.floor(Number(raw?.totalWords) || 1)));
        const wordsFound = Math.max(
          0,
          Math.min(totalWords, Math.floor(Number(raw?.wordsFound) || 0)),
        );
        const bonusWordsCount = Math.max(
          0,
          Math.min(500, Math.floor(Number(raw?.bonusWordsCount) || 0)),
        );
        const foundFeatured = raw?.foundFeatured ? 1 : 0;

        await conn.execute(
          `INSERT INTO highscores
             (score_id, user_id, display_name, puzzle_id, mode, score, words_found, total_words, bonus_words_count, found_featured, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             display_name = IF(VALUES(score) >= score, VALUES(display_name), display_name),
             words_found = GREATEST(words_found, VALUES(words_found)),
             bonus_words_count = GREATEST(bonus_words_count, VALUES(bonus_words_count)),
             found_featured = GREATEST(found_featured, VALUES(found_featured)),
             score = GREATEST(score, VALUES(score)),
             updated_at = GREATEST(updated_at, VALUES(updated_at))`,
          [
            scoreId,
            uid,
            sanitizeDisplayName(raw?.displayName),
            String(raw?.puzzleId || "daily").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) ||
              "daily",
            mode,
            score,
            wordsFound,
            totalWords,
            bonusWordsCount,
            foundFeatured,
            toSafeTimestamp(raw?.createdAt, now),
            toSafeTimestamp(raw?.updatedAt, now),
          ],
        );
        counts.highscores += 1;
      }

      await conn.commit();
      res.json({ ok: true, imported: counts });
    } catch (err) {
      await conn.rollback();
      console.error("[MySQL] POST /api/db/admin/import error:", err);
      res.status(500).json({ ok: false, error: "Failed to import snapshot into MySQL." });
    } finally {
      conn.release();
    }
  });
}
