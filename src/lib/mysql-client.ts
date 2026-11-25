import { auth } from "@/firebase";

export interface DatabaseBackendStatus {
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

const DEFAULT_STATUS: DatabaseBackendStatus = {
  configured: false,
  connected: false,
  mode: "firestore-fallback",
  error: null,
  tables: null,
};

let cachedStatus: DatabaseBackendStatus | null = null;
let statusCheckedAt = 0;
let inFlightCheck: Promise<DatabaseBackendStatus> | null = null;

export function isMysqlBackendActiveSync(): boolean {
  return Boolean(cachedStatus?.connected && cachedStatus.mode === "mysql");
}

export async function fetchDatabaseBackendStatus(options?: {
  force?: boolean;
  includeCounts?: boolean;
}): Promise<DatabaseBackendStatus> {
  if (typeof window === "undefined") return DEFAULT_STATUS;
  const force = Boolean(options?.force);
  const includeCounts = Boolean(options?.includeCounts);

  if (
    !force &&
    !includeCounts &&
    cachedStatus &&
    Date.now() - statusCheckedAt < 60_000
  ) {
    return cachedStatus;
  }

  if (!force && !includeCounts && inFlightCheck) {
    return inFlightCheck;
  }

  const reqPromise = (async (): Promise<DatabaseBackendStatus> => {
    try {
      const url = includeCounts ? "/api/db/status?counts=1" : "/api/db/status";
      const res = await fetch(url, { cache: "no-store" });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.includes("application/json")) {
        return cachedStatus || DEFAULT_STATUS;
      }
      const data = await res.json();
      const next: DatabaseBackendStatus = {
        configured: Boolean(data?.configured),
        connected: Boolean(data?.connected),
        mode: data?.mode === "mysql" ? "mysql" : "firestore-fallback",
        error: typeof data?.error === "string" ? data.error : null,
        missingEnvVars: Array.isArray(data?.missingEnvVars)
          ? data.missingEnvVars.filter((v: unknown): v is string => typeof v === "string")
          : undefined,
        tables: data?.tables && typeof data.tables === "object" ? data.tables : null,
      };
      cachedStatus = next;
      statusCheckedAt = Date.now();
      return next;
    } catch {
      return cachedStatus || DEFAULT_STATUS;
    } finally {
      if (!includeCounts) {
        inFlightCheck = null;
      }
    }
  })();

  if (!includeCounts) {
    inFlightCheck = reqPromise;
  }
  return reqPromise;
}

export async function shouldUseMysqlBackend(): Promise<boolean> {
  const status = await fetchDatabaseBackendStatus();
  return status.connected && status.mode === "mysql";
}

async function getFirebaseAuthHeaders(): Promise<Record<string, string> | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const token = await user.getIdToken();
    if (!token) return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  } catch {
    return null;
  }
}

export async function mysqlGetProfile(): Promise<Record<string, unknown> | null> {
  const headers = await getFirebaseAuthHeaders();
  if (!headers) return null;
  try {
    const res = await fetch("/api/db/me/profile", {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.profile && typeof data.profile === "object" ? data.profile : null;
  } catch {
    return null;
  }
}

export async function mysqlUpsertProfile(payload: {
  displayName?: string;
  linkedTikTokHandle?: string;
  preferredLanguage?: string;
  darkMode?: boolean;
}): Promise<Record<string, unknown> | null> {
  const headers = await getFirebaseAuthHeaders();
  if (!headers) return null;
  try {
    const res = await fetch("/api/db/me/profile", {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.profile && typeof data.profile === "object" ? data.profile : null;
  } catch {
    return null;
  }
}

export async function mysqlGetAllProgress(): Promise<
  Record<string, Record<string, unknown>> | null
> {
  const headers = await getFirebaseAuthHeaders();
  if (!headers) return null;
  try {
    const res = await fetch("/api/db/me/progress", {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.buckets && typeof data.buckets === "object" ? data.buckets : {};
  } catch {
    return null;
  }
}

export async function mysqlUpsertProgressBucket(
  bucketId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const headers = await getFirebaseAuthHeaders();
  if (!headers) return false;
  try {
    const res = await fetch(`/api/db/me/progress/${encodeURIComponent(bucketId)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ payload }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface MysqlLeaderboardRow {
  id: string;
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

export async function mysqlGetLeaderboard(): Promise<MysqlLeaderboardRow[] | null> {
  try {
    const res = await fetch("/api/db/leaderboard", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.entries) ? data.entries : [];
  } catch {
    return null;
  }
}

export async function mysqlUpsertLeaderboard(payload: {
  entryId: string;
  gameId: string;
  puzzleId: string;
  puzzleTitle: string;
  score: number;
  metricLabel: string;
  subMetricLabel: string;
  displayName: string;
}): Promise<boolean> {
  const headers = await getFirebaseAuthHeaders();
  if (!headers) return false;
  try {
    const res = await fetch("/api/db/leaderboard", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface MysqlHighScoreRow {
  id: string;
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

export async function mysqlGetHighScores(
  userId?: string,
): Promise<MysqlHighScoreRow[] | null> {
  try {
    const url = userId
      ? `/api/db/highscores?userId=${encodeURIComponent(userId)}`
      : "/api/db/highscores";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.scores) ? data.scores : [];
  } catch {
    return null;
  }
}

export async function mysqlUpsertHighScore(payload: {
  puzzleId: string;
  mode: string;
  score: number;
  wordsFound: number;
  totalWords: number;
  bonusWordsCount: number;
  foundFeatured: boolean;
  displayName: string;
}): Promise<boolean> {
  const headers = await getFirebaseAuthHeaders();
  if (!headers) return false;
  try {
    const res = await fetch("/api/db/highscores", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface MysqlRegisteredUserItem {
  uid: string;
  displayName: string;
  tiktokConnected: boolean;
  linkedTikTokHandle: string;
  authProvider: "email" | "google" | "site";
  createdAt: number;
  updatedAt: number;
}

export async function mysqlGetRegisteredUsers(): Promise<
  MysqlRegisteredUserItem[] | null
> {
  try {
    const res = await fetch("/api/db/registered-users", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.users) ? data.users : [];
  } catch {
    return null;
  }
}

export async function mysqlUpsertRegisteredUser(payload: {
  displayName: string;
  linkedTikTokHandle: string;
  authProvider: "email" | "google" | "site";
  explicitTikTokUpdate?: boolean;
}): Promise<boolean> {
  const headers = await getFirebaseAuthHeaders();
  if (!headers) return false;
  try {
    const res = await fetch("/api/db/registered-users", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function mysqlAdminImportSnapshot(snapshot: {
  users: unknown[];
  userProgress: unknown[];
  registeredUsers: unknown[];
  leaderboard: unknown[];
  highscores: unknown[];
}): Promise<{
  ok: boolean;
  imported?: {
    users: number;
    userProgress: number;
    registeredUsers: number;
    leaderboard: number;
    highscores: number;
  };
  error?: string;
}> {
  const headers = await getFirebaseAuthHeaders();
  if (!headers) {
    return {
      ok: false,
      error: "Please sign in with your Firebase Admin account first.",
    };
  }
  try {
    const res = await fetch("/api/db/admin/import", {
      method: "POST",
      headers,
      body: JSON.stringify(snapshot),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data?.error === "string" ? data.error : `Import failed (HTTP ${res.status})`,
      };
    }
    return { ok: true, imported: data.imported };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error during MySQL import.",
    };
  }
}

// Kick off background DB mode check on client boot
if (typeof window !== "undefined") {
  void fetchDatabaseBackendStatus();
}
