import {
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/firebase";
import { VALID_PROGRESS_BUCKETS, type ProgressBucketId } from "./cloud-progress";

export interface ExportedUserRow {
  userId: string;
  displayName: string;
  linkedTikTokHandle: string;
  preferredLanguage: string;
  darkMode: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ExportedProgressRow {
  userId: string;
  bucketId: ProgressBucketId;
  payload: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface ExportedRegisteredUserRow {
  userId: string;
  displayName: string;
  tiktokConnected: boolean;
  linkedTikTokHandle: string;
  authProvider: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExportedLeaderboardRow {
  entryId: string;
  userId: string;
  displayName: string;
  gameId: string;
  puzzleId: string;
  puzzleTitle: string;
  score: number;
  metricLabel: string;
  subMetricLabel: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExportedHighScoreRow {
  scoreId: string;
  userId: string;
  displayName: string;
  puzzleId: string;
  mode: string;
  score: number;
  wordsFound: number;
  totalWords: number;
  bonusWordsCount: number;
  foundFeatured: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FirestoreExportSnapshot {
  exportedAt: string;
  exportedByEmail: string | null;
  includedPrivateUserData: boolean;
  users: ExportedUserRow[];
  userProgress: ExportedProgressRow[];
  registeredUsers: ExportedRegisteredUserRow[];
  leaderboard: ExportedLeaderboardRow[];
  highscores: ExportedHighScoreRow[];
  warnings: string[];
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const ADMIN_EMAILS = new Set(["phreakfrog@gmail.com"]);

function toMillis(raw: unknown, fallback = Date.now()): number {
  if (raw instanceof Timestamp) return raw.toMillis();
  if (
    raw &&
    typeof (raw as { toMillis?: () => number }).toMillis === "function"
  ) {
    return (raw as { toMillis: () => number }).toMillis();
  }
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

export function isSignedInAsFirebaseAdmin(): boolean {
  const user = auth.currentUser;
  if (!user?.email || !user.emailVerified) return false;
  return ADMIN_EMAILS.has(user.email.trim().toLowerCase());
}

/**
 * Reads all collections from Firestore using the active Firebase session.
 * When signed in as verified Firebase Admin (Phreakfrog@gmail.com), also reads
 * every discovered user's private profile (`users/{uid}`) and all 13 game
 * progress buckets (`users/{uid}/progress/{bucketId}`) in compliance with firestore.rules.
 */
export async function exportFirestoreSnapshot(
  onProgress?: (status: string) => void,
): Promise<FirestoreExportSnapshot> {
  const warnings: string[] = [];
  const now = Date.now();
  const isAdmin = isSignedInAsFirebaseAdmin();
  const discoveredUids = new Set<string>();

  onProgress?.("Reading registered users, leaderboards, and high scores...");

  const registeredUsers: ExportedRegisteredUserRow[] = [];
  const leaderboard: ExportedLeaderboardRow[] = [];
  const highscores: ExportedHighScoreRow[] = [];

  try {
    const snap = await getDocs(collection(db, "registeredUsers"));
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const userId = String(d?.userId || docSnap.id || "").trim();
      if (!userId || !VALID_ID_REGEX.test(userId)) return;
      discoveredUids.add(userId);
      registeredUsers.push({
        userId,
        displayName: String(d?.displayName || "Player").slice(0, 60),
        tiktokConnected: Boolean(d?.tiktokConnected),
        linkedTikTokHandle: String(d?.linkedTikTokHandle || "").slice(0, 40),
        authProvider: String(d?.authProvider || "email").slice(0, 16),
        createdAt: toMillis(d?.createdAt, now),
        updatedAt: toMillis(d?.updatedAt, now),
      });
    });
  } catch (err) {
    warnings.push(
      `Could not read registeredUsers: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    const snap = await getDocs(collection(db, "leaderboard"));
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const entryId = String(docSnap.id || "").trim();
      const userId = String(d?.userId || "").trim();
      if (!entryId || !userId || !VALID_ID_REGEX.test(userId)) return;
      discoveredUids.add(userId);
      leaderboard.push({
        entryId,
        userId,
        displayName: String(d?.displayName || "Player").slice(0, 60),
        gameId: String(d?.gameId || "").trim(),
        puzzleId: String(d?.puzzleId || d?.gameId || "daily").slice(0, 64),
        puzzleTitle: String(d?.puzzleTitle || d?.gameId || "").slice(0, 100),
        score: Math.max(0, Math.round(Number(d?.score) || 0)),
        metricLabel: String(d?.metricLabel || `${Number(d?.score) || 0} pts`).slice(0, 60),
        subMetricLabel: String(d?.subMetricLabel || "").slice(0, 80),
        createdAt: toMillis(d?.createdAt, now),
        updatedAt: toMillis(d?.updatedAt, now),
      });
    });
  } catch (err) {
    warnings.push(
      `Could not read leaderboard: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    const snap = await getDocs(collection(db, "highscores"));
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const scoreId = String(docSnap.id || "").trim();
      const userId = String(d?.userId || "").trim();
      if (!scoreId || !userId || !VALID_ID_REGEX.test(userId)) return;
      discoveredUids.add(userId);
      highscores.push({
        scoreId,
        userId,
        displayName: String(d?.displayName || "Player").slice(0, 60),
        puzzleId: String(d?.puzzleId || "daily").slice(0, 64),
        mode: String(d?.mode || "daily-4x4").slice(0, 32),
        score: Math.max(0, Math.floor(Number(d?.score) || 0)),
        wordsFound: Math.max(0, Math.floor(Number(d?.wordsFound) || 0)),
        totalWords: Math.max(1, Math.floor(Number(d?.totalWords) || 1)),
        bonusWordsCount: Math.max(0, Math.floor(Number(d?.bonusWordsCount) || 0)),
        foundFeatured: Boolean(d?.foundFeatured),
        createdAt: toMillis(d?.createdAt, now),
        updatedAt: toMillis(d?.updatedAt, now),
      });
    });
  } catch (err) {
    warnings.push(
      `Could not read highscores: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Also include the currently signed-in user UID if present
  if (auth.currentUser?.uid && VALID_ID_REGEX.test(auth.currentUser.uid)) {
    discoveredUids.add(auth.currentUser.uid);
  }

  const users: ExportedUserRow[] = [];
  const userProgress: ExportedProgressRow[] = [];
  const uidList = Array.from(discoveredUids);
  const bucketIds = Array.from(VALID_PROGRESS_BUCKETS);

  if (isAdmin) {
    let processed = 0;
    for (const uid of uidList) {
      processed += 1;
      onProgress?.(
        `Reading private profiles & game progress (${processed}/${uidList.length})...`,
      );
      try {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (!userSnap.exists()) continue;
        const d = userSnap.data();
        users.push({
          userId: uid,
          displayName: String(d?.displayName || "Player").slice(0, 60),
          linkedTikTokHandle: String(d?.linkedTikTokHandle || "").slice(0, 40),
          preferredLanguage: String(d?.preferredLanguage || "en").slice(0, 8),
          darkMode: d?.darkMode !== false,
          createdAt: toMillis(d?.createdAt, now),
          updatedAt: toMillis(d?.updatedAt, now),
        });

        // Fetch all 13 known progress buckets in parallel for this user
        const bucketResults = await Promise.allSettled(
          bucketIds.map((bId) => getDoc(doc(db, "users", uid, "progress", bId))),
        );
        bucketResults.forEach((res, idx) => {
          if (res.status !== "fulfilled" || !res.value.exists()) return;
          const bData = res.value.data();
          const bId = bucketIds[idx];
          if (bData?.payload && typeof bData.payload === "object") {
            userProgress.push({
              userId: uid,
              bucketId: bId,
              payload: bData.payload as Record<string, unknown>,
              createdAt: toMillis(bData?.createdAt, now),
              updatedAt: toMillis(bData?.updatedAt, now),
            });
          }
        });
      } catch (err) {
        warnings.push(
          `Skipped private profile for ${uid.slice(0, 8)}...: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } else {
    warnings.push(
      "Not signed into Firebase Auth as Phreakfrog@gmail.com — exported public tables (registered_users, leaderboard, highscores), but private user profiles & game progress buckets require Firebase Admin sign-in.",
    );
  }

  onProgress?.("Formatting Hostinger MySQL export...");

  return {
    exportedAt: new Date().toISOString(),
    exportedByEmail: auth.currentUser?.email || null,
    includedPrivateUserData: isAdmin,
    users,
    userProgress,
    registeredUsers,
    leaderboard,
    highscores,
    warnings,
  };
}

function sqlString(value: unknown): string {
  const str = String(value ?? "");
  const escaped = str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\0/g, "\\0")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1a/g, "\\Z");
  return `'${escaped}'`;
}

function sqlInt(value: unknown): string {
  const n = Math.floor(Number(value) || 0);
  return Number.isFinite(n) ? String(n) : "0";
}

function sqlBool(value: unknown): string {
  return value ? "1" : "0";
}

export function getHostingerBlankSchemaSql(): string {
  return `-- The Missing Piece — Hostinger MySQL Schema
-- Import via Hostinger -> Websites -> Manage -> Databases -> Management -> Import (or phpMyAdmin)
-- Firebase Authentication remains active for sign-in, keyed by user_id (Firebase UID).

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS \`users\` (
  \`user_id\` VARCHAR(128) NOT NULL,
  \`display_name\` VARCHAR(60) NOT NULL DEFAULT 'Player',
  \`linked_tiktok_handle\` VARCHAR(40) NOT NULL DEFAULT '',
  \`preferred_language\` VARCHAR(8) NOT NULL DEFAULT 'en',
  \`dark_mode\` TINYINT(1) NOT NULL DEFAULT 1,
  \`created_at\` BIGINT NOT NULL,
  \`updated_at\` BIGINT NOT NULL,
  PRIMARY KEY (\`user_id\`),
  KEY \`idx_users_updated_at\` (\`updated_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`user_progress\` (
  \`user_id\` VARCHAR(128) NOT NULL,
  \`bucket_id\` VARCHAR(40) NOT NULL,
  \`payload_json\` LONGTEXT NOT NULL,
  \`created_at\` BIGINT NOT NULL,
  \`updated_at\` BIGINT NOT NULL,
  PRIMARY KEY (\`user_id\`, \`bucket_id\`),
  KEY \`idx_user_progress_updated_at\` (\`updated_at\`),
  CONSTRAINT \`fk_user_progress_user\`
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`user_id\`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`registered_users\` (
  \`user_id\` VARCHAR(128) NOT NULL,
  \`display_name\` VARCHAR(60) NOT NULL DEFAULT 'Player',
  \`tiktok_connected\` TINYINT(1) NOT NULL DEFAULT 0,
  \`linked_tiktok_handle\` VARCHAR(40) NOT NULL DEFAULT '',
  \`auth_provider\` VARCHAR(16) NOT NULL DEFAULT 'email',
  \`created_at\` BIGINT NOT NULL,
  \`updated_at\` BIGINT NOT NULL,
  PRIMARY KEY (\`user_id\`),
  KEY \`idx_registered_users_updated_at\` (\`updated_at\`),
  KEY \`idx_registered_users_tiktok\` (\`linked_tiktok_handle\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`leaderboard\` (
  \`entry_id\` VARCHAR(128) NOT NULL,
  \`user_id\` VARCHAR(128) NOT NULL,
  \`display_name\` VARCHAR(60) NOT NULL DEFAULT 'Player',
  \`game_id\` VARCHAR(32) NOT NULL,
  \`puzzle_id\` VARCHAR(64) NOT NULL,
  \`puzzle_title\` VARCHAR(100) NOT NULL,
  \`score\` INT NOT NULL DEFAULT 0,
  \`metric_label\` VARCHAR(60) NOT NULL,
  \`sub_metric_label\` VARCHAR(80) NOT NULL,
  \`created_at\` BIGINT NOT NULL,
  \`updated_at\` BIGINT NOT NULL,
  PRIMARY KEY (\`entry_id\`),
  KEY \`idx_leaderboard_game_score\` (\`game_id\`, \`score\` DESC),
  KEY \`idx_leaderboard_score\` (\`score\` DESC),
  KEY \`idx_leaderboard_user\` (\`user_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`highscores\` (
  \`score_id\` VARCHAR(128) NOT NULL,
  \`user_id\` VARCHAR(128) NOT NULL,
  \`display_name\` VARCHAR(60) NOT NULL DEFAULT 'Player',
  \`puzzle_id\` VARCHAR(64) NOT NULL,
  \`mode\` VARCHAR(32) NOT NULL,
  \`score\` INT NOT NULL DEFAULT 0,
  \`words_found\` INT NOT NULL DEFAULT 0,
  \`total_words\` INT NOT NULL DEFAULT 1,
  \`bonus_words_count\` INT NOT NULL DEFAULT 0,
  \`found_featured\` TINYINT(1) NOT NULL DEFAULT 0,
  \`created_at\` BIGINT NOT NULL,
  \`updated_at\` BIGINT NOT NULL,
  PRIMARY KEY (\`score_id\`),
  KEY \`idx_highscores_user_score\` (\`user_id\`, \`score\` DESC),
  KEY \`idx_highscores_score\` (\`score\` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
`;
}

export function buildHostingerMigrationSql(snapshot: FirestoreExportSnapshot): string {
  const lines: string[] = [
    `-- The Missing Piece — Firestore to Hostinger MySQL Migration Dump`,
    `-- Exported at: ${snapshot.exportedAt}`,
    `-- Rows: users=${snapshot.users.length}, user_progress=${snapshot.userProgress.length}, registered_users=${snapshot.registeredUsers.length}, leaderboard=${snapshot.leaderboard.length}, highscores=${snapshot.highscores.length}`,
    ``,
    getHostingerBlankSchemaSql(),
    `START TRANSACTION;`,
    ``,
  ];

  // Ensure every user referenced by user_progress exists in users
  const emittedUserIds = new Set<string>();
  for (const u of snapshot.users) {
    emittedUserIds.add(u.userId);
    lines.push(
      `INSERT INTO \`users\` (\`user_id\`, \`display_name\`, \`linked_tiktok_handle\`, \`preferred_language\`, \`dark_mode\`, \`created_at\`, \`updated_at\`) VALUES (${sqlString(u.userId)}, ${sqlString(u.displayName)}, ${sqlString(u.linkedTikTokHandle)}, ${sqlString(u.preferredLanguage)}, ${sqlBool(u.darkMode)}, ${sqlInt(u.createdAt)}, ${sqlInt(u.updatedAt)}) ON DUPLICATE KEY UPDATE \`display_name\`=VALUES(\`display_name\`), \`linked_tiktok_handle\`=VALUES(\`linked_tiktok_handle\`), \`preferred_language\`=VALUES(\`preferred_language\`), \`dark_mode\`=VALUES(\`dark_mode\`), \`updated_at\`=GREATEST(\`updated_at\`, VALUES(\`updated_at\`));`,
    );
  }

  for (const p of snapshot.userProgress) {
    if (!emittedUserIds.has(p.userId)) {
      emittedUserIds.add(p.userId);
      lines.push(
        `INSERT IGNORE INTO \`users\` (\`user_id\`, \`display_name\`, \`linked_tiktok_handle\`, \`preferred_language\`, \`dark_mode\`, \`created_at\`, \`updated_at\`) VALUES (${sqlString(p.userId)}, 'Player', '', 'en', 1, ${sqlInt(p.createdAt)}, ${sqlInt(p.updatedAt)});`,
      );
    }
    const payloadJson = JSON.stringify(p.payload);
    lines.push(
      `INSERT INTO \`user_progress\` (\`user_id\`, \`bucket_id\`, \`payload_json\`, \`created_at\`, \`updated_at\`) VALUES (${sqlString(p.userId)}, ${sqlString(p.bucketId)}, ${sqlString(payloadJson)}, ${sqlInt(p.createdAt)}, ${sqlInt(p.updatedAt)}) ON DUPLICATE KEY UPDATE \`payload_json\`=IF(VALUES(\`updated_at\`)>=\`updated_at\`, VALUES(\`payload_json\`), \`payload_json\`), \`updated_at\`=GREATEST(\`updated_at\`, VALUES(\`updated_at\`));`,
    );
  }

  for (const r of snapshot.registeredUsers) {
    lines.push(
      `INSERT INTO \`registered_users\` (\`user_id\`, \`display_name\`, \`tiktok_connected\`, \`linked_tiktok_handle\`, \`auth_provider\`, \`created_at\`, \`updated_at\`) VALUES (${sqlString(r.userId)}, ${sqlString(r.displayName)}, ${sqlBool(r.tiktokConnected)}, ${sqlString(r.linkedTikTokHandle)}, ${sqlString(r.authProvider)}, ${sqlInt(r.createdAt)}, ${sqlInt(r.updatedAt)}) ON DUPLICATE KEY UPDATE \`display_name\`=VALUES(\`display_name\`), \`tiktok_connected\`=VALUES(\`tiktok_connected\`), \`linked_tiktok_handle\`=VALUES(\`linked_tiktok_handle\`), \`auth_provider\`=VALUES(\`auth_provider\`), \`updated_at\`=GREATEST(\`updated_at\`, VALUES(\`updated_at\`));`,
    );
  }

  for (const l of snapshot.leaderboard) {
    lines.push(
      `INSERT INTO \`leaderboard\` (\`entry_id\`, \`user_id\`, \`display_name\`, \`game_id\`, \`puzzle_id\`, \`puzzle_title\`, \`score\`, \`metric_label\`, \`sub_metric_label\`, \`created_at\`, \`updated_at\`) VALUES (${sqlString(l.entryId)}, ${sqlString(l.userId)}, ${sqlString(l.displayName)}, ${sqlString(l.gameId)}, ${sqlString(l.puzzleId)}, ${sqlString(l.puzzleTitle)}, ${sqlInt(l.score)}, ${sqlString(l.metricLabel)}, ${sqlString(l.subMetricLabel)}, ${sqlInt(l.createdAt)}, ${sqlInt(l.updatedAt)}) ON DUPLICATE KEY UPDATE \`display_name\`=IF(VALUES(\`score\`)>=\`score\`, VALUES(\`display_name\`), \`display_name\`), \`puzzle_title\`=IF(VALUES(\`score\`)>=\`score\`, VALUES(\`puzzle_title\`), \`puzzle_title\`), \`metric_label\`=IF(VALUES(\`score\`)>=\`score\`, VALUES(\`metric_label\`), \`metric_label\`), \`sub_metric_label\`=IF(VALUES(\`score\`)>=\`score\`, VALUES(\`sub_metric_label\`), \`sub_metric_label\`), \`score\`=GREATEST(\`score\`, VALUES(\`score\`)), \`updated_at\`=GREATEST(\`updated_at\`, VALUES(\`updated_at\`));`,
    );
  }

  for (const h of snapshot.highscores) {
    lines.push(
      `INSERT INTO \`highscores\` (\`score_id\`, \`user_id\`, \`display_name\`, \`puzzle_id\`, \`mode\`, \`score\`, \`words_found\`, \`total_words\`, \`bonus_words_count\`, \`found_featured\`, \`created_at\`, \`updated_at\`) VALUES (${sqlString(h.scoreId)}, ${sqlString(h.userId)}, ${sqlString(h.displayName)}, ${sqlString(h.puzzleId)}, ${sqlString(h.mode)}, ${sqlInt(h.score)}, ${sqlInt(h.wordsFound)}, ${sqlInt(h.totalWords)}, ${sqlInt(h.bonusWordsCount)}, ${sqlBool(h.foundFeatured)}, ${sqlInt(h.createdAt)}, ${sqlInt(h.updatedAt)}) ON DUPLICATE KEY UPDATE \`display_name\`=IF(VALUES(\`score\`)>=\`score\`, VALUES(\`display_name\`), \`display_name\`), \`words_found\`=GREATEST(\`words_found\`, VALUES(\`words_found\`)), \`bonus_words_count\`=GREATEST(\`bonus_words_count\`, VALUES(\`bonus_words_count\`)), \`found_featured\`=GREATEST(\`found_featured\`, VALUES(\`found_featured\`)), \`score\`=GREATEST(\`score\`, VALUES(\`score\`)), \`updated_at\`=GREATEST(\`updated_at\`, VALUES(\`updated_at\`));`,
    );
  }

  lines.push(``, `COMMIT;`, ``);
  return lines.join("\n");
}

export function triggerTextFileDownload(
  filename: string,
  content: string,
  mimeType = "application/sql;charset=utf-8",
): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
