import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql, { type Pool, type PoolOptions } from "mysql2/promise";

// Ensure .env is loaded even when Hostinger launches Node from a parent working directory
try {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidateEnvPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(currentDir, ".env"),
    path.resolve(currentDir, "..", ".env"),
  ];
  for (const envPath of candidateEnvPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
    }
  }
} catch {
  // Ignore filesystem lookup issues on restricted runtimes
}

export interface MysqlDatabaseStatus {
  configured: boolean;
  connected: boolean;
  mode: "mysql" | "firestore-fallback";
  error: string | null;
  missingEnvVars?: string[];
  tables: {
    users: number;
    user_progress: number;
    registered_users: number;
    leaderboard: number;
    highscores: number;
  } | null;
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(128) NOT NULL,
    display_name VARCHAR(60) NOT NULL DEFAULT 'Player',
    linked_tiktok_handle VARCHAR(40) NOT NULL DEFAULT '',
    preferred_language VARCHAR(8) NOT NULL DEFAULT 'en',
    dark_mode TINYINT(1) NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id),
    KEY idx_users_updated_at (updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS user_progress (
    user_id VARCHAR(128) NOT NULL,
    bucket_id VARCHAR(40) NOT NULL,
    payload_json LONGTEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, bucket_id),
    KEY idx_user_progress_updated_at (updated_at),
    CONSTRAINT fk_user_progress_user
      FOREIGN KEY (user_id) REFERENCES users (user_id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS registered_users (
    user_id VARCHAR(128) NOT NULL,
    display_name VARCHAR(60) NOT NULL DEFAULT 'Player',
    tiktok_connected TINYINT(1) NOT NULL DEFAULT 0,
    linked_tiktok_handle VARCHAR(40) NOT NULL DEFAULT '',
    auth_provider VARCHAR(16) NOT NULL DEFAULT 'email',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id),
    KEY idx_registered_users_updated_at (updated_at),
    KEY idx_registered_users_tiktok (linked_tiktok_handle)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS leaderboard (
    entry_id VARCHAR(128) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    display_name VARCHAR(60) NOT NULL DEFAULT 'Player',
    game_id VARCHAR(32) NOT NULL,
    puzzle_id VARCHAR(64) NOT NULL,
    puzzle_title VARCHAR(100) NOT NULL,
    score INT NOT NULL DEFAULT 0,
    metric_label VARCHAR(60) NOT NULL,
    sub_metric_label VARCHAR(80) NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (entry_id),
    KEY idx_leaderboard_game_score (game_id, score DESC),
    KEY idx_leaderboard_score (score DESC),
    KEY idx_leaderboard_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS highscores (
    score_id VARCHAR(128) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    display_name VARCHAR(60) NOT NULL DEFAULT 'Player',
    puzzle_id VARCHAR(64) NOT NULL,
    mode VARCHAR(32) NOT NULL,
    score INT NOT NULL DEFAULT 0,
    words_found INT NOT NULL DEFAULT 0,
    total_words INT NOT NULL DEFAULT 1,
    bonus_words_count INT NOT NULL DEFAULT 0,
    found_featured TINYINT(1) NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (score_id),
    KEY idx_highscores_user_score (user_id, score DESC),
    KEY idx_highscores_score (score DESC)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

let pool: Pool | null = null;
let initPromise: Promise<boolean> | null = null;
let isConnected = false;
let lastError: string | null = null;
let nextRetryAt = 0;
let lastLoggedError: string | null = null;

const RETRY_COOLDOWN_MS = 60_000;

interface ResolvedPoolConfig {
  options: PoolOptions;
  targetHost: string;
  targetPort: number;
}

function readEnvTrimmed(key: string): string {
  const raw = String(process.env[key] || "").trim();
  if (
    raw.length >= 2 &&
    ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'")))
  ) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

function readFirstEnv(keys: string[]): string {
  for (const key of keys) {
    const val = readEnvTrimmed(key);
    if (val) return val;
  }
  return "";
}

function readFirstRawEnv(keys: string[]): string {
  for (const key of keys) {
    const raw = process.env[key];
    if (typeof raw === "string" && raw.length > 0) {
      return raw;
    }
  }
  return "";
}

function getMissingMysqlEnvVars(): string[] {
  const mysqlUrl = readFirstEnv(["MYSQL_URL", "DATABASE_URL"]);
  if (mysqlUrl && /^mysql2?:\/\//i.test(mysqlUrl)) {
    return [];
  }
  const missing: string[] = [];
  if (!readFirstEnv(["MYSQL_HOST", "DB_HOST", "HOSTINGER_MYSQL_HOST"])) {
    missing.push("MYSQL_HOST");
  }
  if (!readFirstEnv(["MYSQL_USER", "MYSQL_USERNAME", "DB_USER", "DB_USERNAME"])) {
    missing.push("MYSQL_USER");
  }
  if (!readFirstEnv(["MYSQL_DATABASE", "MYSQL_DB", "MYSQL_NAME", "DB_DATABASE", "DB_NAME"])) {
    missing.push("MYSQL_DATABASE");
  }
  if (!readFirstRawEnv(["MYSQL_PASSWORD", "MYSQL_PASS", "DB_PASSWORD", "DB_PASS"])) {
    missing.push("MYSQL_PASSWORD");
  }
  return missing;
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized === "0.0.0.0"
  );
}

function formatSafeMysqlError(
  err: unknown,
  targetHost: string,
  targetPort: number,
): string {
  const errObj = err as { code?: string; message?: string } | null;
  const code = String(errObj?.code || "").toUpperCase();
  const rawMsg = String(errObj?.message || "");
  const isRefused = code === "ECONNREFUSED" || rawMsg.includes("ECONNREFUSED");

  if (isRefused && isLoopbackHost(targetHost)) {
    return `Cannot reach MySQL at localhost:${targetPort} from this preview server (Firestore fallback is active). Keep MYSQL_HOST=localhost when deploying on Hostinger, or set MYSQL_HOST to Hostinger's Remote MySQL hostname (and enable Remote MySQL in Hostinger) to connect from preview.`;
  }
  if (isRefused) {
    return `MySQL server refused the connection on port ${targetPort} (Firestore fallback is active). Verify your MySQL host, port, and Remote MySQL access settings.`;
  }
  if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ENOTFOUND") {
    return `MySQL server is unreachable (${code}; Firestore fallback is active). Verify MYSQL_HOST and Remote MySQL permissions in Hostinger.`;
  }
  if (code === "ER_ACCESS_DENIED_ERROR") {
    return "MySQL authentication failed (access denied; Firestore fallback is active). Check MYSQL_USER, MYSQL_PASSWORD, and Remote MySQL host permissions.";
  }
  if (code === "ER_BAD_DB_ERROR") {
    return "MySQL database name was not found (Firestore fallback is active). Verify MYSQL_DATABASE matches your Hostinger database name.";
  }
  const sanitized = rawMsg.replace(/mysql2?:\/\/[^\s]+/gi, "mysql://***").trim();
  return sanitized || "MySQL connection unavailable (Firestore fallback is active).";
}

function buildPoolConfig(): ResolvedPoolConfig | null {
  const mysqlUrl = readFirstEnv(["MYSQL_URL", "DATABASE_URL"]);
  const useSsl = readFirstEnv(["MYSQL_SSL", "DB_SSL"]).toLowerCase() === "true";

  if (mysqlUrl && /^mysql2?:\/\//i.test(mysqlUrl)) {
    let targetHost = "mysql";
    let targetPort = 3306;
    try {
      const parsed = new URL(mysqlUrl);
      targetHost = parsed.hostname || "mysql";
      const parsedPort = Number(parsed.port || 3306);
      targetPort = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3306;
    } catch {
      // Fall back to default host/port metadata for diagnostics
    }
    return {
      targetHost,
      targetPort,
      options: {
        uri: mysqlUrl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 8000,
        ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      },
    };
  }

  let host = readFirstEnv(["MYSQL_HOST", "DB_HOST", "HOSTINGER_MYSQL_HOST"]);
  const user = readFirstEnv(["MYSQL_USER", "MYSQL_USERNAME", "DB_USER", "DB_USERNAME"]);
  const database = readFirstEnv([
    "MYSQL_DATABASE",
    "MYSQL_DB",
    "MYSQL_NAME",
    "DB_DATABASE",
    "DB_NAME",
  ]);
  const password = readFirstRawEnv(["MYSQL_PASSWORD", "MYSQL_PASS", "DB_PASSWORD", "DB_PASS"]);
  const portEnv = readFirstEnv(["MYSQL_PORT", "DB_PORT"]);
  let port = Number(portEnv || 3306);

  // If user and database are explicitly configured on Hostinger but MYSQL_HOST was left blank, default to localhost
  if (!host && user && database) {
    host = "localhost";
  }

  // Support accidental host:port format in MYSQL_HOST (non-IPv6)
  if (host && host.includes(":") && !host.startsWith("[")) {
    const colonIdx = host.lastIndexOf(":");
    const maybePort = Number(host.slice(colonIdx + 1));
    if (Number.isFinite(maybePort) && maybePort > 0 && maybePort <= 65535) {
      host = host.slice(0, colonIdx).trim();
      if (!portEnv) {
        port = maybePort;
      }
    }
  }

  if (!host || !user || !database) {
    return null;
  }

  const resolvedPort = Number.isFinite(port) && port > 0 ? port : 3306;

  return {
    targetHost: host,
    targetPort: resolvedPort,
    options: {
      host,
      port: resolvedPort,
      user,
      password,
      database,
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 8000,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    },
  };
}

export function isMysqlConfigured(): boolean {
  return buildPoolConfig() !== null;
}

export async function initMysqlDatabase(force = false): Promise<boolean> {
  if (isConnected && pool) return true;
  if (initPromise) return initPromise;

  const resolved = buildPoolConfig();
  if (!resolved) {
    isConnected = false;
    lastError = null;
    nextRetryAt = 0;
    return false;
  }

  if (!force && nextRetryAt > Date.now()) {
    return false;
  }

  initPromise = (async () => {
    let nextPool: Pool | null = null;
    try {
      nextPool = mysql.createPool(resolved.options);
      const conn = await nextPool.getConnection();
      try {
        await conn.ping();
        for (const sql of SCHEMA_STATEMENTS) {
          await conn.execute(sql);
        }
      } finally {
        conn.release();
      }
      pool = nextPool;
      isConnected = true;
      lastError = null;
      nextRetryAt = 0;
      lastLoggedError = null;
      console.log("[MySQL] Connected to Hostinger MySQL and verified schema.");
      return true;
    } catch (err) {
      if (nextPool) {
        void nextPool.end().catch(() => {});
      }
      isConnected = false;
      pool = null;
      nextRetryAt = Date.now() + RETRY_COOLDOWN_MS;
      const friendlyError = formatSafeMysqlError(
        err,
        resolved.targetHost,
        resolved.targetPort,
      );
      lastError = friendlyError;
      if (lastLoggedError !== friendlyError) {
        lastLoggedError = friendlyError;
        console.warn("[MySQL] Fallback to Firestore:", friendlyError);
      }
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

export function getMysqlPool(): Pool | null {
  return isConnected ? pool : null;
}

export function isMysqlActive(): boolean {
  return isConnected && pool !== null;
}

export async function getMysqlStatus(includeCounts = false): Promise<MysqlDatabaseStatus> {
  const configured = isMysqlConfigured();
  if (!configured) {
    return {
      configured: false,
      connected: false,
      mode: "firestore-fallback",
      error: null,
      missingEnvVars: getMissingMysqlEnvVars(),
      tables: null,
    };
  }

  if (!isConnected && !pool) {
    await initMysqlDatabase(includeCounts);
  }

  if (!isConnected || !pool) {
    return {
      configured: true,
      connected: false,
      mode: "firestore-fallback",
      error: lastError || "Could not connect to MySQL database.",
      tables: null,
    };
  }

  if (!includeCounts) {
    return {
      configured: true,
      connected: true,
      mode: "mysql",
      error: null,
      tables: null,
    };
  }

  try {
    const [
      [uRows],
      [pRows],
      [rRows],
      [lRows],
      [hRows],
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS cnt FROM users"),
      pool.query("SELECT COUNT(*) AS cnt FROM user_progress"),
      pool.query("SELECT COUNT(*) AS cnt FROM registered_users"),
      pool.query("SELECT COUNT(*) AS cnt FROM leaderboard"),
      pool.query("SELECT COUNT(*) AS cnt FROM highscores"),
    ]);

    const readCnt = (rows: unknown) =>
      Number((Array.isArray(rows) && (rows[0] as { cnt?: number })?.cnt) || 0);

    return {
      configured: true,
      connected: true,
      mode: "mysql",
      error: null,
      tables: {
        users: readCnt(uRows),
        user_progress: readCnt(pRows),
        registered_users: readCnt(rRows),
        leaderboard: readCnt(lRows),
        highscores: readCnt(hRows),
      },
    };
  } catch (err) {
    const resolved = buildPoolConfig();
    return {
      configured: true,
      connected: false,
      mode: "firestore-fallback",
      error: formatSafeMysqlError(
        err,
        resolved?.targetHost || "mysql",
        resolved?.targetPort || 3306,
      ),
      tables: null,
    };
  }
}
