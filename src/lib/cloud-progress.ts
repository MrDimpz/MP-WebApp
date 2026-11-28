import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  getDictionaryLanguage,
  normalizeDictionaryLanguage,
  setDictionaryLanguage,
  type DictionaryLanguageCode,
} from "./dictionary-languages";
import { handleFirestoreError, OperationType } from "./firestore-errors";
import {
  isFirestoreQuotaError,
  isFirestoreWritePaused,
  markFirestoreQuotaExhausted,
} from "./firestore-quota";
import {
  isMysqlBackendActiveSync,
  mysqlGetAllProgress,
  mysqlGetProfile,
  mysqlUpsertProfile,
  mysqlUpsertProgressBucket,
  shouldUseMysqlBackend,
} from "./mysql-client";

export type ProgressBucketId =
  | "daily_streaks"
  | "interactive_scores"
  | "crossword"
  | "rebus"
  | "squared"
  | "thematix"
  | "destack"
  | "unolingo"
  | "mpsearch"
  | "mpdifference"
  | "mpcolossal"
  | "tekscodle"
  | "wordhunt"
  | "goingdeep"
  | "wordlock"
  | "crossjig";

export const VALID_PROGRESS_BUCKETS: ReadonlySet<ProgressBucketId> = new Set([
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
  "goingdeep",
  "wordlock",
  "crossjig",
]);

export const CLOUD_HYDRATED_EVENT = "mp-cloud-progress-hydrated";

const ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const BROWSER_INSTANCE_ID_KEY = "mp_browser_instance_id_v1";
const PERSISTENT_GUEST_ID_KEY = "mp_persistent_guest_id_v1";
const SITE_DARK_MODE_KEY = "mp_site_dark_mode_v2";
const INTERACTIVE_SCORES_STORAGE_KEY = "mp_interactive_account_scores_v1";

export interface CloudSyncStatus {
  status: "idle" | "syncing" | "synced" | "error";
  lastSyncedAt: number | null;
  syncedBuckets: number;
  lastError: string | null;
}

let currentSyncStatus: CloudSyncStatus = {
  status: "idle",
  lastSyncedAt: null,
  syncedBuckets: 0,
  lastError: null,
};

const syncStatusListeners = new Set<(status: CloudSyncStatus) => void>();

function updateSyncStatus(partial: Partial<CloudSyncStatus>) {
  currentSyncStatus = { ...currentSyncStatus, ...partial };
  syncStatusListeners.forEach((listener) => listener(currentSyncStatus));
}

export function getCloudSyncStatus(): CloudSyncStatus {
  return currentSyncStatus;
}

export function useCloudSyncStatus(): CloudSyncStatus {
  const [status, setStatus] = useState<CloudSyncStatus>(() => currentSyncStatus);
  useEffect(() => {
    setStatus(currentSyncStatus);
    syncStatusListeners.add(setStatus);
    return () => {
      syncStatusListeners.delete(setStatus);
    };
  }, []);
  return status;
}

function getSafeDarkMode(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SITE_DARK_MODE_KEY) !== "false";
  } catch {
    return true;
  }
}

function normalizeHandle(raw: unknown): string {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
  if (!cleaned) return "";
  const formatted = `@${cleaned}`;
  return /^@[a-zA-Z0-9_.-]+$/.test(formatted) && formatted.length <= 40
    ? formatted
    : "";
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

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === "object" && !Array.isArray(val);
}

/**
 * Recursively converts JS data into Firestore-safe native Maps/Lists/primitives.
 * Eliminates `undefined`, `NaN`/`Infinity`, and converts any nested arrays
 * (like Crossword 2D `string[][]` or Squared `Array<[string, number]>`) into
 * flat maps so Firestore never rejects nested arrays.
 */
export function sanitizeForFirestore(value: unknown, depth = 0): unknown {
  if (depth > 8) return null;
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    return value.length > 10000 ? value.slice(0, 10000) : value;
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    const limit = Math.min(value.length, 500);
    for (let i = 0; i < limit; i++) {
      const item = value[i];
      if (item === undefined) continue;
      if (Array.isArray(item)) {
        // Convert nested row array into a Firestore map keyed by column or wrap as row object
        const rowMap: Record<string, unknown> = { __nestedRow: true };
        const innerLimit = Math.min(item.length, 100);
        for (let c = 0; c < innerLimit; c++) {
          rowMap[`c${c}`] = sanitizeForFirestore(item[c], depth + 2);
        }
        out.push(rowMap);
      } else {
        out.push(sanitizeForFirestore(item, depth + 1));
      }
    }
    return out;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(value);
    const maxKeys = depth === 0 ? 190 : 400;
    for (let i = 0; i < keys.length && Object.keys(out).length < maxKeys; i++) {
      const k = keys[i];
      if (!k || k.startsWith("__proto__") || k === "constructor") continue;
      const v = value[k];
      if (v === undefined || typeof v === "function" || typeof v === "symbol") continue;
      const safeKey = k.slice(0, 120);
      out[safeKey] = sanitizeForFirestore(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function encodeCrosswordGrid(grid: string[][]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (let r = 0; r < grid.length && r < 40; r++) {
    const row = Array.isArray(grid[r]) ? grid[r] : [];
    out[`r${String(r).padStart(2, "0")}`] = row.map((cell) =>
      typeof cell === "string" ? cell.slice(0, 4) : "",
    );
  }
  return out;
}

function decodeCrosswordGrid(raw: unknown): string[][] | null {
  if (Array.isArray(raw)) {
    return raw.map((row) => {
      if (Array.isArray(row)) return row.map((c) => String(c || ""));
      if (isPlainObject(row) && row.__nestedRow) {
        return Object.keys(row)
          .filter((k) => /^c\d+$/.test(k))
          .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
          .map((k) => String(row[k] || ""));
      }
      return [];
    });
  }
  if (isPlainObject(raw)) {
    const rowKeys = Object.keys(raw)
      .filter((k) => /^r\d+$/.test(k))
      .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    if (rowKeys.length === 0) return null;
    return rowKeys.map((rk) => {
      const rVal = raw[rk];
      return Array.isArray(rVal) ? rVal.map((c) => String(c || "")) : [];
    });
  }
  return null;
}

const ensuredProfiles = new Set<string>();
const profileEnsureInFlight = new Map<string, Promise<Record<string, unknown> | null>>();

export async function ensureUserProfileDoc(
  fbUser: User,
  overrides?: {
    displayName?: string | null;
    linkedTikTokHandle?: string | null;
    preferredLanguage?: DictionaryLanguageCode;
    darkMode?: boolean;
  },
): Promise<Record<string, unknown> | null> {
  if (typeof window === "undefined") return null;
  const uid = String(fbUser?.uid || "").trim();
  if (!uid || !ID_REGEX.test(uid) || uid.length > 128) return null;

  const existingPromise = profileEnsureInFlight.get(uid);
  if (existingPromise && !overrides) {
    return existingPromise;
  }

  const task = (async (): Promise<Record<string, unknown> | null> => {
    const fallbackName = sanitizeDisplayName(
      overrides?.displayName || fbUser.displayName || fbUser.email?.split("@")[0],
    );
    const fallbackHandle = normalizeHandle(overrides?.linkedTikTokHandle || "");
    const localLang = overrides?.preferredLanguage || getDictionaryLanguage();
    const localDark =
      typeof overrides?.darkMode === "boolean" ? overrides.darkMode : getSafeDarkMode();

    // Hostinger MySQL mode: keep Firebase Auth, store profiles in MySQL
    if (await shouldUseMysqlBackend()) {
      try {
        const existing = await mysqlGetProfile();
        if (!existing) {
          const created = await mysqlUpsertProfile({
            displayName: fallbackName,
            linkedTikTokHandle: fallbackHandle,
            preferredLanguage: localLang,
            darkMode: localDark,
          });
          if (created) ensuredProfiles.add(uid);
          return created;
        }
        ensuredProfiles.add(uid);
        if (overrides) {
          const nextName =
            overrides.displayName !== undefined
              ? sanitizeDisplayName(overrides.displayName)
              : sanitizeDisplayName(existing.displayName);
          const nextHandle =
            overrides.linkedTikTokHandle !== undefined
              ? normalizeHandle(overrides.linkedTikTokHandle)
              : normalizeHandle(existing.linkedTikTokHandle);
          const nextLang =
            overrides.preferredLanguage !== undefined
              ? normalizeDictionaryLanguage(overrides.preferredLanguage)
              : normalizeDictionaryLanguage(existing.preferredLanguage);
          const nextDark =
            overrides.darkMode !== undefined
              ? overrides.darkMode
              : typeof existing.darkMode === "boolean"
                ? existing.darkMode
                : localDark;
          if (
            nextName !== existing.displayName ||
            nextHandle !== (existing.linkedTikTokHandle || "") ||
            nextLang !== existing.preferredLanguage ||
            nextDark !== existing.darkMode
          ) {
            return (
              (await mysqlUpsertProfile({
                displayName: nextName,
                linkedTikTokHandle: nextHandle,
                preferredLanguage: nextLang,
                darkMode: nextDark,
              })) || existing
            );
          }
        }
        return existing;
      } finally {
        profileEnsureInFlight.delete(uid);
      }
    }

    const docPath = `users/${uid}`;
    const ref = doc(db, "users", uid);
    try {
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        if (isFirestoreWritePaused()) return null;
        const payload = {
          userId: uid,
          displayName: fallbackName,
          linkedTikTokHandle: fallbackHandle,
          preferredLanguage: localLang,
          darkMode: localDark,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(ref, payload);
        ensuredProfiles.add(uid);
        return payload;
      }

      ensuredProfiles.add(uid);
      const existingData = snap.data() as Record<string, unknown>;
      if (overrides) {
        const nextName =
          overrides.displayName !== undefined
            ? sanitizeDisplayName(overrides.displayName)
            : sanitizeDisplayName(existingData.displayName);
        const nextHandle =
          overrides.linkedTikTokHandle !== undefined
            ? normalizeHandle(overrides.linkedTikTokHandle)
            : normalizeHandle(existingData.linkedTikTokHandle);
        const nextLang =
          overrides.preferredLanguage !== undefined
            ? normalizeDictionaryLanguage(overrides.preferredLanguage)
            : normalizeDictionaryLanguage(existingData.preferredLanguage);
        const nextDark =
          overrides.darkMode !== undefined
            ? overrides.darkMode
            : typeof existingData.darkMode === "boolean"
              ? existingData.darkMode
              : localDark;

        if (
          !isFirestoreWritePaused() &&
          (nextName !== existingData.displayName ||
            nextHandle !== (existingData.linkedTikTokHandle || "") ||
            nextLang !== existingData.preferredLanguage ||
            nextDark !== existingData.darkMode)
        ) {
          await updateDoc(ref, {
            userId: existingData.userId,
            displayName: nextName,
            linkedTikTokHandle: nextHandle,
            preferredLanguage: nextLang,
            darkMode: nextDark,
            createdAt: existingData.createdAt,
            updatedAt: serverTimestamp(),
          });
          return {
            ...existingData,
            displayName: nextName,
            linkedTikTokHandle: nextHandle,
            preferredLanguage: nextLang,
            darkMode: nextDark,
          };
        }
      }
      return existingData;
    } catch (err) {
      if (isFirestoreQuotaError(err)) {
        markFirestoreQuotaExhausted(err);
      } else {
        handleFirestoreError(err, OperationType.WRITE, docPath);
      }
      return null;
    } finally {
      profileEnsureInFlight.delete(uid);
    }
  })();

  profileEnsureInFlight.set(uid, task);
  return task;
}

export async function saveUserProfilePreferences(params: {
  displayName?: string | null;
  linkedTikTokHandle?: string | null;
  preferredLanguage?: DictionaryLanguageCode;
  darkMode?: boolean;
}): Promise<void> {
  if (typeof window === "undefined") return;
  const fbUser = auth.currentUser;
  if (!fbUser?.uid) return;
  if (!isMysqlBackendActiveSync() && isFirestoreWritePaused()) return;
  await ensureUserProfileDoc(fbUser, params);
}

const pendingBucketTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastWrittenHashes = new Map<string, string>();
const hydratedUids = new Set<string>();

function mergePositiveMin(a: unknown, b: unknown): number | null {
  const na = typeof a === "number" && Number.isFinite(a) && a > 0 ? a : null;
  const nb = typeof b === "number" && Number.isFinite(b) && b > 0 ? b : null;
  if (na === null) return nb;
  if (nb === null) return na;
  return Math.min(na, nb);
}

function mergeColossalScaleEntry(
  existing: Record<string, any> | null,
  incoming: Record<string, any> | null,
): Record<string, any> | null {
  if (!existing && !incoming) return null;
  if (!existing) return incoming;
  if (!incoming) return existing;

  const mergedGrid: Record<string, string> = {};
  if (isPlainObject(existing.userGrid)) {
    for (const [cellKey, val] of Object.entries(existing.userGrid)) {
      if (typeof val === "string" && val.trim() !== "") {
        mergedGrid[cellKey] = val;
      }
    }
  }
  if (isPlainObject(incoming.userGrid)) {
    for (const [cellKey, val] of Object.entries(incoming.userGrid)) {
      if (typeof val === "string" && val.trim() !== "") {
        mergedGrid[cellKey] = val;
      }
    }
  }

  const mergeCellCollection = (eVal: unknown, iVal: unknown): unknown => {
    if (Array.isArray(eVal) || Array.isArray(iVal)) {
      return Array.from(
        new Set([
          ...(Array.isArray(eVal) ? eVal : []),
          ...(Array.isArray(iVal) ? iVal : []),
        ]),
      );
    }
    if (isPlainObject(eVal) || isPlainObject(iVal)) {
      return {
        ...(isPlainObject(eVal) ? eVal : {}),
        ...(isPlainObject(iVal) ? iVal : {}),
      };
    }
    return iVal !== undefined ? iVal : eVal;
  };

  const merged: Record<string, any> = {
    ...existing,
    ...incoming,
    userGrid: mergedGrid,
    elapsedSeconds: Math.max(
      Number(existing.elapsedSeconds || 0),
      Number(incoming.elapsedSeconds || 0),
    ),
    solved: Boolean(existing.solved || incoming.solved),
  };

  if (existing.revealedCells !== undefined || incoming.revealedCells !== undefined) {
    merged.revealedCells = mergeCellCollection(existing.revealedCells, incoming.revealedCells);
  }
  if (existing.checkedCells !== undefined || incoming.checkedCells !== undefined) {
    merged.checkedCells = mergeCellCollection(existing.checkedCells, incoming.checkedCells);
  }
  return merged;
}

function mergeCrosswordGrids(
  existingRaw: unknown,
  incomingRaw: unknown,
): Record<string, string[]> | null {
  const eGrid = decodeCrosswordGrid(existingRaw);
  const iGrid = decodeCrosswordGrid(incomingRaw);
  if (!eGrid && !iGrid) return null;
  if (!eGrid && iGrid) return encodeCrosswordGrid(iGrid);
  if (eGrid && !iGrid) return encodeCrosswordGrid(eGrid);

  const rowCount = Math.max(eGrid!.length, iGrid!.length);
  const merged: string[][] = [];
  for (let r = 0; r < rowCount; r++) {
    const eRow = eGrid![r] || [];
    const iRow = iGrid![r] || [];
    const colCount = Math.max(eRow.length, iRow.length);
    const rowOut: string[] = [];
    for (let c = 0; c < colCount; c++) {
      const iv = String(iRow[c] || "");
      const ev = String(eRow[c] || "");
      rowOut.push(iv.trim() !== "" ? iv : ev);
    }
    merged.push(rowOut);
  }
  return encodeCrosswordGrid(merged);
}

/**
 * Monotonically merges an existing Firestore bucket payload with a newly incoming
 * client payload so stale tabs, fresh browsers, or new website deployments can
 * NEVER overwrite or erase a player's saved progress on any game.
 */
export function mergeCloudBucketPayloads(
  bucketId: ProgressBucketId,
  existingPayload: Record<string, unknown>,
  incomingPayload: Record<string, unknown>,
): Record<string, unknown> {
  const existing = isPlainObject(existingPayload) ? existingPayload : {};
  const incoming = isPlainObject(incomingPayload) ? incomingPayload : {};

  switch (bucketId) {
    case "daily_streaks": {
      const allGames = new Set([...Object.keys(existing), ...Object.keys(incoming)]);
      const merged: Record<string, unknown> = {};
      for (const gameId of allGames) {
        const e = isPlainObject(existing[gameId]) ? (existing[gameId] as Record<string, any>) : {};
        const i = isPlainObject(incoming[gameId]) ? (incoming[gameId] as Record<string, any>) : {};
        const unionDates = Array.from(
          new Set([
            ...(Array.isArray(e.solvedDates) ? e.solvedDates : []),
            ...(Array.isArray(i.solvedDates) ? i.solvedDates : []),
          ]),
        )
          .filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
          .sort()
          .slice(-400);
        const maxBase = Math.max(Number(e.baseStreak || 0), Number(i.baseStreak || 0));
        const baseStreakDate =
          Number(i.baseStreak || 0) >= Number(e.baseStreak || 0) && i.baseStreakDate
            ? String(i.baseStreakDate)
            : e.baseStreakDate
              ? String(e.baseStreakDate)
              : undefined;
        merged[gameId] = {
          solvedDates: unionDates,
          ...(maxBase > 0 ? { baseStreak: maxBase } : {}),
          ...(baseStreakDate ? { baseStreakDate } : {}),
        };
      }
      return merged;
    }

    case "interactive_scores": {
      const eGames = isPlainObject(existing.gamesPlayed)
        ? (existing.gamesPlayed as Record<string, unknown>)
        : {};
      const iGames = isPlainObject(incoming.gamesPlayed)
        ? (incoming.gamesPlayed as Record<string, unknown>)
        : {};
      const allGameKeys = new Set([...Object.keys(eGames), ...Object.keys(iGames)]);
      const gamesPlayed: Record<string, number> = {};
      for (const k of allGameKeys) {
        gamesPlayed[k] = Math.max(Number(eGames[k] || 0), Number(iGames[k] || 0));
      }
      const eventMap = new Map<string, any>();
      for (const ev of Array.isArray(existing.recentEvents) ? existing.recentEvents : []) {
        if (ev && typeof ev === "object" && (ev as any).id) {
          eventMap.set(String((ev as any).id), ev);
        }
      }
      for (const ev of Array.isArray(incoming.recentEvents) ? incoming.recentEvents : []) {
        if (ev && typeof ev === "object" && (ev as any).id) {
          eventMap.set(String((ev as any).id), ev);
        }
      }
      const recentEvents = Array.from(eventMap.values())
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
        .slice(0, 30);
      const summedPoints = Object.values(gamesPlayed).reduce((s, n) => s + n, 0);
      const totalPoints = Math.max(
        summedPoints,
        Number(existing.totalPoints || 0),
        Number(incoming.totalPoints || 0),
      );
      return {
        ...existing,
        ...incoming,
        tiktokHandle: String(incoming.tiktokHandle || existing.tiktokHandle || ""),
        totalPoints,
        gamesPlayed,
        recentEvents,
        updatedAt: Math.max(
          Number(existing.updatedAt || 0),
          Number(incoming.updatedAt || 0),
          Date.now(),
        ),
      };
    }

    case "crossword": {
      const eProg = isPlainObject(existing.progress)
        ? (existing.progress as Record<string, any>)
        : {};
      const iProg = isPlainObject(incoming.progress)
        ? (incoming.progress as Record<string, any>)
        : {};
      const mergedProg: Record<string, any> = { ...eProg };
      for (const [pid, iItem] of Object.entries(iProg)) {
        const eItem = mergedProg[pid];
        if (!eItem) {
          mergedProg[pid] = iItem;
        } else if (
          (iItem?.solved && !eItem?.solved) ||
          (Boolean(iItem?.solved) === Boolean(eItem?.solved) &&
            Number(iItem?.score || 0) >= Number(eItem?.score || 0))
        ) {
          mergedProg[pid] = {
            ...eItem,
            ...iItem,
            solved: Boolean(eItem?.solved || iItem?.solved),
            score: Math.max(Number(eItem?.score || 0), Number(iItem?.score || 0)),
          };
        }
      }

      const eGrids = isPlainObject(existing.grids)
        ? (existing.grids as Record<string, unknown>)
        : {};
      const iGrids = isPlainObject(incoming.grids)
        ? (incoming.grids as Record<string, unknown>)
        : {};
      const mergedGrids: Record<string, unknown> = {};
      const allGridIds = new Set([...Object.keys(eGrids), ...Object.keys(iGrids)]);
      for (const pid of allGridIds) {
        const mg = mergeCrosswordGrids(eGrids[pid], iGrids[pid]);
        if (mg) mergedGrids[pid] = mg;
      }

      const lbMap = new Map<string, any>();
      for (const item of Array.isArray(existing.leaderboard) ? existing.leaderboard : []) {
        if (item && typeof item === "object" && (item as any).id) {
          lbMap.set(String((item as any).id), item);
        }
      }
      for (const item of Array.isArray(incoming.leaderboard) ? incoming.leaderboard : []) {
        if (item && typeof item === "object" && (item as any).id) {
          lbMap.set(String((item as any).id), item);
        }
      }
      const leaderboard = Array.from(lbMap.values())
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, 50);

      return { progress: mergedProg, grids: mergedGrids, leaderboard };
    }

    case "rebus": {
      const eProg = isPlainObject(existing.progress)
        ? (existing.progress as Record<string, any>)
        : {};
      const iProg = isPlainObject(incoming.progress)
        ? (incoming.progress as Record<string, any>)
        : {};
      const mergedProgress = {
        solvedIds: {
          ...(isPlainObject(eProg.solvedIds) ? eProg.solvedIds : {}),
          ...(isPlainObject(iProg.solvedIds) ? iProg.solvedIds : {}),
        },
        revealedIds: {
          ...(isPlainObject(eProg.revealedIds) ? eProg.revealedIds : {}),
          ...(isPlainObject(iProg.revealedIds) ? iProg.revealedIds : {}),
        },
        worksheetSolved: {
          ...(isPlainObject(eProg.worksheetSolved) ? eProg.worksheetSolved : {}),
          ...(isPlainObject(iProg.worksheetSolved) ? iProg.worksheetSolved : {}),
        },
        hintsUsedByPuzzle: {
          ...(isPlainObject(eProg.hintsUsedByPuzzle) ? eProg.hintsUsedByPuzzle : {}),
          ...(isPlainObject(iProg.hintsUsedByPuzzle) ? iProg.hintsUsedByPuzzle : {}),
        },
        score: Math.max(Number(eProg.score || 0), Number(iProg.score || 0)),
        currentStreak: Math.max(
          Number(eProg.currentStreak || 0),
          Number(iProg.currentStreak || 0),
        ),
        bestStreak: Math.max(Number(eProg.bestStreak || 0), Number(iProg.bestStreak || 0)),
        lastPlayedId: String(iProg.lastPlayedId || eProg.lastPlayedId || ""),
      };
      return {
        progress: mergedProgress,
        bestSprint: Math.max(Number(existing.bestSprint || 0), Number(incoming.bestSprint || 0)),
      };
    }

    case "squared": {
      const ePuzzles = isPlainObject(existing.puzzles)
        ? (existing.puzzles as Record<string, any>)
        : {};
      const iPuzzles = isPlainObject(incoming.puzzles)
        ? (incoming.puzzles as Record<string, any>)
        : {};
      const allIds = Array.from(new Set([...Object.keys(ePuzzles), ...Object.keys(iPuzzles)])).slice(
        -80,
      );
      const mergedPuzzles: Record<string, unknown> = {};
      for (const pid of allIds) {
        const e = isPlainObject(ePuzzles[pid]) ? ePuzzles[pid] : {};
        const i = isPlainObject(iPuzzles[pid]) ? iPuzzles[pid] : {};
        const foundWords = Array.from(
          new Set([
            ...(Array.isArray(e.foundWords) ? e.foundWords : []),
            ...(Array.isArray(i.foundWords) ? i.foundWords : []),
          ]),
        );
        const bonusWords = Array.from(
          new Set([
            ...(Array.isArray(e.bonusWords) ? e.bonusWords : []),
            ...(Array.isArray(i.bonusWords) ? i.bonusWords : []),
          ]),
        );
        const prefMap: Record<string, number> = {};
        if (isPlainObject(e.revealedPrefixesMap)) {
          for (const [pk, pv] of Object.entries(e.revealedPrefixesMap)) {
            prefMap[pk] = Number(pv || 0);
          }
        }
        if (isPlainObject(i.revealedPrefixesMap)) {
          for (const [pk, pv] of Object.entries(i.revealedPrefixesMap)) {
            prefMap[pk] = Math.max(prefMap[pk] || 0, Number(pv || 0));
          }
        }
        mergedPuzzles[pid] = {
          foundWords,
          bonusWords,
          score: Math.max(Number(e.score || 0), Number(i.score || 0)),
          revealedPrefixesMap: prefMap,
        };
      }
      return { puzzles: mergedPuzzles };
    }

    case "thematix": {
      const eStats = isPlainObject(existing.stats) ? (existing.stats as Record<string, any>) : {};
      const iStats = isPlainObject(incoming.stats) ? (incoming.stats as Record<string, any>) : {};
      const mergedStats = {
        played: Math.max(Number(eStats.played || 0), Number(iStats.played || 0)),
        won: Math.max(Number(eStats.won || 0), Number(iStats.won || 0)),
        currentStreak: Math.max(
          Number(eStats.currentStreak || 0),
          Number(iStats.currentStreak || 0),
        ),
        maxStreak: Math.max(Number(eStats.maxStreak || 0), Number(iStats.maxStreak || 0)),
        guessDistribution:
          Number(iStats.won || 0) >= Number(eStats.won || 0) &&
          isPlainObject(iStats.guessDistribution)
            ? iStats.guessDistribution
            : eStats.guessDistribution || {},
        lastPlayedDate: String(iStats.lastPlayedDate || eStats.lastPlayedDate || ""),
      };

      const ePuzzles = isPlainObject(existing.puzzles)
        ? (existing.puzzles as Record<string, any>)
        : {};
      const iPuzzles = isPlainObject(incoming.puzzles)
        ? (incoming.puzzles as Record<string, any>)
        : {};
      const allPids = Array.from(new Set([...Object.keys(ePuzzles), ...Object.keys(iPuzzles)])).slice(
        -100,
      );
      const mergedPuzzles: Record<string, unknown> = {};
      for (const pid of allPids) {
        const e = isPlainObject(ePuzzles[pid]) ? ePuzzles[pid] : null;
        const i = isPlainObject(iPuzzles[pid]) ? iPuzzles[pid] : null;
        if (!e && i) {
          mergedPuzzles[pid] = i;
        } else if (e && !i) {
          mergedPuzzles[pid] = e;
        } else if (e && i) {
          const eGuesses = Array.isArray(e.guesses) ? e.guesses.length : 0;
          const iGuesses = Array.isArray(i.guesses) ? i.guesses.length : 0;
          mergedPuzzles[pid] =
            (i.isSolved && !e.isSolved) ||
            (Boolean(i.isSolved) === Boolean(e.isSolved) && iGuesses >= eGuesses)
              ? i
              : e;
        }
      }
      return { stats: mergedStats, puzzles: mergedPuzzles };
    }

    case "destack": {
      const eStats = isPlainObject(existing.stats) ? (existing.stats as Record<string, any>) : {};
      const iStats = isPlainObject(incoming.stats) ? (incoming.stats as Record<string, any>) : {};
      const bestTime = mergePositiveMin(eStats.bestTimeSeconds, iStats.bestTimeSeconds) ?? 9999;
      return {
        stats: {
          gamesPlayed: Math.max(Number(eStats.gamesPlayed || 0), Number(iStats.gamesPlayed || 0)),
          gamesWon: Math.max(Number(eStats.gamesWon || 0), Number(iStats.gamesWon || 0)),
          currentStreak: Math.max(
            Number(eStats.currentStreak || 0),
            Number(iStats.currentStreak || 0),
          ),
          maxStreak: Math.max(Number(eStats.maxStreak || 0), Number(iStats.maxStreak || 0)),
          bestTimeSeconds: bestTime,
          totalHintsUsed: Math.max(
            Number(eStats.totalHintsUsed || 0),
            Number(iStats.totalHintsUsed || 0),
          ),
          completedDays: {
            ...(isPlainObject(eStats.completedDays) ? eStats.completedDays : {}),
            ...(isPlainObject(iStats.completedDays) ? iStats.completedDays : {}),
          },
          completedHardDays: {
            ...(isPlainObject(eStats.completedHardDays) ? eStats.completedHardDays : {}),
            ...(isPlainObject(iStats.completedHardDays) ? iStats.completedHardDays : {}),
          },
        },
      };
    }

    case "unolingo": {
      const eProg = isPlainObject(existing.progress)
        ? (existing.progress as Record<string, any>)
        : {};
      const iProg = isPlainObject(incoming.progress)
        ? (incoming.progress as Record<string, any>)
        : {};
      const mergedProg: Record<string, any> = { ...eProg };
      for (const [k, iVal] of Object.entries(iProg)) {
        const eVal = mergedProg[k];
        if (!eVal) {
          mergedProg[k] = iVal;
        } else if (iVal?.status === "completed" || eVal?.status !== "completed") {
          const eCells = isPlainObject(eVal?.cells) ? Object.keys(eVal.cells).length : 0;
          const iCells = isPlainObject(iVal?.cells) ? Object.keys(iVal.cells).length : 0;
          if (iVal?.status === "completed" || iCells >= eCells) {
            mergedProg[k] = iVal;
          }
        }
      }
      const eStats = isPlainObject(existing.stats) ? (existing.stats as Record<string, any>) : {};
      const iStats = isPlainObject(incoming.stats) ? (incoming.stats as Record<string, any>) : {};
      const bestTimeSec = mergePositiveMin(eStats.bestTimeSec, iStats.bestTimeSec) ?? 0;
      return {
        progress: mergedProg,
        stats: {
          currentStreak: Math.max(
            Number(eStats.currentStreak || 0),
            Number(iStats.currentStreak || 0),
          ),
          longestStreak: Math.max(
            Number(eStats.longestStreak || 0),
            Number(iStats.longestStreak || 0),
          ),
          totalSolved: Math.max(Number(eStats.totalSolved || 0), Number(iStats.totalSolved || 0)),
          bestTimeSec,
          totalHintsUsed: Math.max(
            Number(eStats.totalHintsUsed || 0),
            Number(iStats.totalHintsUsed || 0),
          ),
          totalMistakes: Math.max(
            Number(eStats.totalMistakes || 0),
            Number(iStats.totalMistakes || 0),
          ),
          lastDailyStreakDate: String(
            iStats.lastDailyStreakDate || eStats.lastDailyStreakDate || "",
          ),
        },
        prefs: {
          ...(isPlainObject(existing.prefs) ? existing.prefs : {}),
          ...(isPlainObject(incoming.prefs) ? incoming.prefs : {}),
        },
      };
    }

    case "mpsearch": {
      const eProg = isPlainObject(existing.progress)
        ? (existing.progress as Record<string, any>)
        : {};
      const iProg = isPlainObject(incoming.progress)
        ? (incoming.progress as Record<string, any>)
        : {};
      const merged: Record<string, any> = { ...eProg };
      for (const [dk, iVal] of Object.entries(iProg)) {
        const eVal = merged[dk];
        if (!eVal) {
          merged[dk] = iVal;
        } else {
          const foundWords = Array.from(
            new Set([
              ...(Array.isArray(eVal.foundWords) ? eVal.foundWords : []),
              ...(Array.isArray(iVal?.foundWords) ? iVal.foundWords : []),
            ]),
          );
          merged[dk] = {
            ...eVal,
            ...iVal,
            foundWords,
            highScore: Math.max(Number(eVal.highScore || 0), Number(iVal?.highScore || 0)),
            solved: Boolean(eVal.solved || iVal?.solved),
          };
        }
      }
      return { progress: merged };
    }

    case "mpdifference": {
      const eComp = isPlainObject(existing.completions)
        ? (existing.completions as Record<string, any>)
        : {};
      const iComp = isPlainObject(incoming.completions)
        ? (incoming.completions as Record<string, any>)
        : {};
      const merged: Record<string, any> = { ...eComp };
      for (const [dk, iVal] of Object.entries(iComp)) {
        const eVal = merged[dk];
        if (!eVal || Number(iVal?.bestScore || 0) >= Number(eVal?.bestScore || 0)) {
          merged[dk] = eVal
            ? {
                ...eVal,
                ...iVal,
                bestScore: Math.max(Number(eVal.bestScore || 0), Number(iVal?.bestScore || 0)),
              }
            : iVal;
        }
      }
      return { completions: merged };
    }

    case "mpcolossal": {
      const eScales = isPlainObject(existing.scales)
        ? (existing.scales as Record<string, any>)
        : {};
      const iScales = isPlainObject(incoming.scales)
        ? (incoming.scales as Record<string, any>)
        : {};
      const allScales = new Set([...Object.keys(eScales), ...Object.keys(iScales)]);
      const mergedScales: Record<string, unknown> = {};
      for (const s of allScales) {
        const mergedEntry = mergeColossalScaleEntry(
          isPlainObject(eScales[s]) ? eScales[s] : null,
          isPlainObject(iScales[s]) ? iScales[s] : null,
        );
        if (mergedEntry) mergedScales[s] = mergedEntry;
      }
      return { scales: mergedScales };
    }

    case "tekscodle": {
      const e = isPlainObject(existing.stats) ? (existing.stats as Record<string, any>) : {};
      const i = isPlainObject(incoming.stats) ? (incoming.stats as Record<string, any>) : {};
      const dailyCompletedDates = Array.from(
        new Set([
          ...(Array.isArray(e.dailyCompletedDates) ? e.dailyCompletedDates : []),
          ...(Array.isArray(i.dailyCompletedDates) ? i.dailyCompletedDates : []),
        ]),
      ).sort();
      const runMap = new Map<string, any>();
      for (const run of Array.isArray(e.recentRuns) ? e.recentRuns : []) {
        if (run?.id) runMap.set(String(run.id), run);
      }
      for (const run of Array.isArray(i.recentRuns) ? i.recentRuns : []) {
        if (run?.id) runMap.set(String(run.id), run);
      }
      const recentRuns = Array.from(runMap.values())
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
        .slice(0, 30);
      return {
        stats: {
          bestScore: Math.max(Number(e.bestScore || 0), Number(i.bestScore || 0)),
          gamesPlayed: Math.max(Number(e.gamesPlayed || 0), Number(i.gamesPlayed || 0)),
          quickPlays: Math.max(Number(e.quickPlays || 0), Number(i.quickPlays || 0)),
          dailyCompletedDates,
          recentRuns,
        },
      };
    }

    case "wordhunt": {
      const e = isPlainObject(existing.stats) ? (existing.stats as Record<string, any>) : {};
      const i = isPlainObject(incoming.stats) ? (incoming.stats as Record<string, any>) : {};
      const dailyCompletedDates = Array.from(
        new Set([
          ...(Array.isArray(e.dailyCompletedDates) ? e.dailyCompletedDates : []),
          ...(Array.isArray(i.dailyCompletedDates) ? i.dailyCompletedDates : []),
        ]),
      ).sort();
      return {
        stats: {
          gamesPlayed: Math.max(Number(e.gamesPlayed || 0), Number(i.gamesPlayed || 0)),
          gamesWon: Math.max(Number(e.gamesWon || 0), Number(i.gamesWon || 0)),
          currentStreak: Math.max(Number(e.currentStreak || 0), Number(i.currentStreak || 0)),
          bestStreak: Math.max(Number(e.bestStreak || 0), Number(i.bestStreak || 0)),
          bestScore: Math.max(Number(e.bestScore || 0), Number(i.bestScore || 0)),
          fewestClassic: mergePositiveMin(e.fewestClassic, i.fewestClassic),
          fewestDual: mergePositiveMin(e.fewestDual, i.fewestDual),
          fewestQuad: mergePositiveMin(e.fewestQuad, i.fewestQuad),
          dailyCompletedDates,
        },
      };
    }

    case "goingdeep": {
      const eProg = isPlainObject(existing.progress) ? (existing.progress as Record<string, any>) : {};
      const iProg = isPlainObject(incoming.progress) ? (incoming.progress as Record<string, any>) : {};
      const mergedProgress: Record<string, any> = { ...eProg };
      const statusRank = (s: unknown) => (s === "won" ? 3 : s === "lost" ? 2 : 1);
      for (const key of Object.keys(iProg)) {
        const prev = eProg[key];
        const next = iProg[key];
        if (!prev) {
          mergedProgress[key] = next;
        } else {
          const prevRank = statusRank(prev.status);
          const nextRank = statusRank(next?.status);
          const prevSolved = Array.isArray(prev.solvedTiers) ? prev.solvedTiers.length : 0;
          const nextSolved = Array.isArray(next?.solvedTiers) ? next.solvedTiers.length : 0;
          if (nextRank > prevRank || (nextRank === prevRank && nextSolved >= prevSolved)) {
            mergedProgress[key] = next;
          }
        }
      }
      const eStats = isPlainObject(existing.stats) ? (existing.stats as Record<string, any>) : {};
      const iStats = isPlainObject(incoming.stats) ? (incoming.stats as Record<string, any>) : {};
      const eDist = Array.isArray(eStats.mistakeDistribution) ? eStats.mistakeDistribution : [0, 0, 0, 0, 0];
      const iDist = Array.isArray(iStats.mistakeDistribution) ? iStats.mistakeDistribution : [0, 0, 0, 0, 0];
      const eMini = isPlainObject(eStats.miniGamesSolved) ? eStats.miniGamesSolved : {};
      const iMini = isPlainObject(iStats.miniGamesSolved) ? iStats.miniGamesSolved : {};
      const eWins = isPlainObject(eStats.winsByDifficulty) ? eStats.winsByDifficulty : {};
      const iWins = isPlainObject(iStats.winsByDifficulty) ? iStats.winsByDifficulty : {};
      return {
        progress: mergedProgress,
        stats: {
          played: Math.max(Number(eStats.played || 0), Number(iStats.played || 0)),
          won: Math.max(Number(eStats.won || 0), Number(iStats.won || 0)),
          currentStreak: Math.max(Number(eStats.currentStreak || 0), Number(iStats.currentStreak || 0)),
          maxStreak: Math.max(Number(eStats.maxStreak || 0), Number(iStats.maxStreak || 0)),
          perfectGames: Math.max(Number(eStats.perfectGames || 0), Number(iStats.perfectGames || 0)),
          mistakeDistribution: [0, 1, 2, 3, 4].map((idx) =>
            Math.max(Number(eDist[idx] || 0), Number(iDist[idx] || 0))
          ),
          miniGamesSolved: {
            letterlock: Math.max(Number(eMini.letterlock || 0), Number(iMini.letterlock || 0)),
            anagram: Math.max(Number(eMini.anagram || 0), Number(iMini.anagram || 0)),
            crossword: Math.max(Number(eMini.crossword || 0), Number(iMini.crossword || 0)),
            wordsearch: Math.max(Number(eMini.wordsearch || 0), Number(iMini.wordsearch || 0)),
          },
          winsByDifficulty: {
            standard: Math.max(Number(eWins.standard || 0), Number(iWins.standard || 0)),
            hard: Math.max(Number(eWins.hard || 0), Number(iWins.hard || 0)),
            expert: Math.max(Number(eWins.expert || 0), Number(iWins.expert || 0)),
          },
        },
      };
    }

    case "wordlock": {
      const eProg = isPlainObject(existing.progress) ? (existing.progress as Record<string, any>) : {};
      const iProg = isPlainObject(incoming.progress) ? (incoming.progress as Record<string, any>) : {};
      const mergedProgress: Record<string, any> = { ...eProg };
      for (const key of Object.keys(iProg)) {
        const prev = eProg[key];
        const next = iProg[key];
        if (!prev) {
          mergedProgress[key] = next;
        } else {
          const prevWon = prev.status === "won";
          const nextWon = next?.status === "won";
          if (nextWon && !prevWon) {
            mergedProgress[key] = next;
          } else if (nextWon && prevWon) {
            mergedProgress[key] = {
              ...prev,
              ...next,
              bestClicks:
                prev.bestClicks != null && next.bestClicks != null
                  ? Math.min(Number(prev.bestClicks), Number(next.bestClicks))
                  : (next.bestClicks ?? prev.bestClicks ?? null),
              bestScore: Math.max(Number(prev.bestScore || 0), Number(next.bestScore || 0)),
            };
          }
        }
      }
      const eStats = isPlainObject(existing.stats) ? (existing.stats as Record<string, any>) : {};
      const iStats = isPlainObject(incoming.stats) ? (incoming.stats as Record<string, any>) : {};
      const eWins = isPlainObject(eStats.winsByDifficulty) ? eStats.winsByDifficulty : {};
      const iWins = isPlainObject(iStats.winsByDifficulty) ? iStats.winsByDifficulty : {};
      return {
        progress: mergedProgress,
        stats: {
          played: Math.max(Number(eStats.played || 0), Number(iStats.played || 0)),
          won: Math.max(Number(eStats.won || 0), Number(iStats.won || 0)),
          currentStreak: Math.max(Number(eStats.currentStreak || 0), Number(iStats.currentStreak || 0)),
          maxStreak: Math.max(Number(eStats.maxStreak || 0), Number(iStats.maxStreak || 0)),
          parSolves: Math.max(Number(eStats.parSolves || 0), Number(iStats.parSolves || 0)),
          totalScore: Math.max(Number(eStats.totalScore || 0), Number(iStats.totalScore || 0)),
          bestScore: Math.max(Number(eStats.bestScore || 0), Number(iStats.bestScore || 0)),
          winsByDifficulty: {
            easy: Math.max(Number(eWins.easy || 0), Number(iWins.easy || 0)),
            standard: Math.max(Number(eWins.standard || 0), Number(iWins.standard || 0)),
            hard: Math.max(Number(eWins.hard || 0), Number(iWins.hard || 0)),
            master: Math.max(Number(eWins.master || 0), Number(iWins.master || 0)),
          },
          lastWonDate: iStats.lastWonDate || eStats.lastWonDate || null,
        },
      };
    }

    case "crossjig": {
      const eStats = isPlainObject(existing.stats) ? (existing.stats as Record<string, any>) : {};
      const iStats = isPlainObject(incoming.stats) ? (incoming.stats as Record<string, any>) : {};
      const eBest = isPlainObject(eStats.bestTimes) ? eStats.bestTimes : {};
      const iBest = isPlainObject(iStats.bestTimes) ? iStats.bestTimes : {};
      const bestTimes: Record<string, number> = {};
      for (const m of ["daily", "mini", "classic", "master"]) {
        const minVal = mergePositiveMin(eBest[m], iBest[m]);
        if (minVal !== null) bestTimes[m] = minVal;
      }
      const eArch = isPlainObject(eStats.dailyArchive)
        ? (eStats.dailyArchive as Record<string, any>)
        : {};
      const iArch = isPlainObject(iStats.dailyArchive)
        ? (iStats.dailyArchive as Record<string, any>)
        : {};
      const dailyArchive: Record<string, any> = { ...eArch };
      for (const [dk, iRec] of Object.entries(iArch)) {
        if (!isPlainObject(iRec)) continue;
        const eRec = isPlainObject(dailyArchive[dk]) ? dailyArchive[dk] : null;
        if (!eRec) {
          dailyArchive[dk] = iRec;
        } else {
          const solved = Boolean(eRec.solved || iRec.solved);
          const bestSeconds = mergePositiveMin(eRec.bestSeconds, iRec.bestSeconds);
          const bestMoves = mergePositiveMin(eRec.bestMoves, iRec.bestMoves);
          const bestScore = Math.max(Number(eRec.bestScore || 0), Number(iRec.bestScore || 0));
          dailyArchive[dk] = {
            ...eRec,
            ...iRec,
            dateStr: dk,
            solved,
            ...(bestSeconds !== null ? { bestSeconds } : {}),
            ...(bestMoves !== null ? { bestMoves } : {}),
            ...(bestScore > 0 ? { bestScore } : {}),
          };
        }
      }
      const dailyCompletedDates = Array.from(
        new Set([
          ...(Array.isArray(eStats.dailyCompletedDates) ? eStats.dailyCompletedDates : []),
          ...(Array.isArray(iStats.dailyCompletedDates) ? iStats.dailyCompletedDates : []),
          ...Object.entries(dailyArchive)
            .filter(([, r]) => r && r.solved)
            .map(([k]) => k),
        ]),
      ).sort();
      return {
        stats: {
          totalSolved: Math.max(
            Number(eStats.totalSolved || 0),
            Number(iStats.totalSolved || 0),
          ),
          dailyStreak: Math.max(
            Number(eStats.dailyStreak || 0),
            Number(iStats.dailyStreak || 0),
          ),
          bestStreak: Math.max(
            Number(eStats.bestStreak || 0),
            Number(iStats.bestStreak || 0),
          ),
          bestScore: Math.max(
            Number(eStats.bestScore || 0),
            Number(iStats.bestScore || 0),
          ),
          totalScore: Math.max(
            Number(eStats.totalScore || 0),
            Number(iStats.totalScore || 0),
          ),
          lastDailyDate:
            String(iStats.lastDailyDate || "") >= String(eStats.lastDailyDate || "")
              ? iStats.lastDailyDate || eStats.lastDailyDate || null
              : eStats.lastDailyDate || null,
          bestTimes,
          dailyCompletedDates,
          dailyArchive,
        },
      };
    }

    default:
      return { ...existing, ...incoming };
  }
}

function capPayloadKeys(payload: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(payload);
  if (keys.length <= 200) return payload;
  const trimmed: Record<string, unknown> = {};
  for (const k of keys.slice(0, 200)) {
    trimmed[k] = payload[k];
  }
  return trimmed;
}

async function writeProgressBucketNow(
  uid: string,
  bucketId: ProgressBucketId,
  rawPayload: Record<string, unknown>,
  options?: { skipHydrationWait?: boolean },
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!auth.currentUser || auth.currentUser.uid !== uid) return false;
  if (!ID_REGEX.test(uid) || !VALID_PROGRESS_BUCKETS.has(bucketId)) return false;

  const useMysql = await shouldUseMysqlBackend();
  if (!useMysql && isFirestoreWritePaused()) return false;

  // Never allow a freshly mounted game (e.g. right after a deployment reload) to
  // push to cloud before the player's existing cloud progress has hydrated.
  if (!options?.skipHydrationWait && !hydratedUids.has(uid)) {
    await hydrateAllUserProgressFromCloud(auth.currentUser);
    if (!auth.currentUser || auth.currentUser.uid !== uid) return false;
  }

  const sanitizedIncoming = sanitizeForFirestore(rawPayload) as Record<string, unknown>;
  if (!isPlainObject(sanitizedIncoming)) return false;
  const cleanPayload = capPayloadKeys(sanitizedIncoming);

  let signature = "";
  try {
    signature = JSON.stringify(cleanPayload);
  } catch {
    return false;
  }
  const cacheKey = `${uid}:${bucketId}`;
  if (lastWrittenHashes.get(cacheKey) === signature) {
    return true;
  }

  if (!ensuredProfiles.has(uid)) {
    const profile = await ensureUserProfileDoc(auth.currentUser);
    if (!profile) return false;
  }

  // Hostinger MySQL write path (with monotonic merge against current MySQL bucket)
  if (useMysql) {
    updateSyncStatus({ status: "syncing", lastError: null });
    try {
      const existingAll = await mysqlGetAllProgress();
      const existingPayload =
        existingAll && isPlainObject(existingAll[bucketId])
          ? existingAll[bucketId]
          : null;
      const payloadToSave = existingPayload
        ? capPayloadKeys(
            sanitizeForFirestore(
              mergeCloudBucketPayloads(bucketId, existingPayload, cleanPayload),
            ) as Record<string, unknown>,
          )
        : cleanPayload;

      let finalSignature = signature;
      let existingSig = "";
      try {
        existingSig = existingPayload ? JSON.stringify(existingPayload) : "";
        finalSignature = JSON.stringify(payloadToSave);
      } catch {
        finalSignature = signature;
      }

      if (!existingPayload || finalSignature !== existingSig) {
        const ok = await mysqlUpsertProgressBucket(bucketId, payloadToSave);
        if (!ok) {
          updateSyncStatus({
            status: "error",
            lastError: "Could not save progress to Hostinger MySQL.",
          });
          return false;
        }
      }

      lastWrittenHashes.set(cacheKey, finalSignature);
      updateSyncStatus({
        status: "synced",
        lastSyncedAt: Date.now(),
        syncedBuckets: lastWrittenHashes.size,
        lastError: null,
      });
      return true;
    } catch (err) {
      updateSyncStatus({
        status: "error",
        lastError: err instanceof Error ? err.message : "Could not sync progress.",
      });
      return false;
    }
  }

  const docPath = `users/${uid}/progress/${bucketId}`;
  const docRef = doc(db, "users", uid, "progress", bucketId);
  updateSyncStatus({ status: "syncing", lastError: null });

  try {
    const snap = await getDoc(docRef);
    let finalSignature = signature;
    if (!snap.exists()) {
      await setDoc(docRef, {
        userId: uid,
        bucketId,
        payload: cleanPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = snap.data();
      const existingPayload = isPlainObject(existingData?.payload)
        ? (existingData.payload as Record<string, unknown>)
        : {};
      const mergedRaw = mergeCloudBucketPayloads(bucketId, existingPayload, cleanPayload);
      const safeMerged = capPayloadKeys(
        sanitizeForFirestore(mergedRaw) as Record<string, unknown>,
      );

      let existingSig = "";
      try {
        existingSig = JSON.stringify(existingPayload);
        finalSignature = JSON.stringify(safeMerged);
      } catch {
        finalSignature = signature;
      }

      if (finalSignature !== existingSig) {
        await updateDoc(docRef, {
          userId: existingData.userId,
          bucketId: existingData.bucketId,
          payload: safeMerged,
          createdAt: existingData.createdAt,
          updatedAt: serverTimestamp(),
        });
      }
    }
    lastWrittenHashes.set(cacheKey, finalSignature);
    updateSyncStatus({
      status: "synced",
      lastSyncedAt: Date.now(),
      syncedBuckets: lastWrittenHashes.size,
      lastError: null,
    });
    return true;
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      markFirestoreQuotaExhausted(err);
      updateSyncStatus({
        status: "error",
        lastError: "Firestore daily write quota paused.",
      });
      return false;
    }
    handleFirestoreError(err, OperationType.WRITE, docPath);
    updateSyncStatus({
      status: "error",
      lastError: err instanceof Error ? err.message : "Could not sync progress.",
    });
    return false;
  }
}

export function scheduleCloudProgressSync(
  bucketId: ProgressBucketId,
  payload: Record<string, unknown>,
  immediate = false,
): void {
  if (typeof window === "undefined") return;
  const fbUser = auth.currentUser;
  if (!fbUser?.uid) return;
  if (!isMysqlBackendActiveSync() && isFirestoreWritePaused()) return;
  const uid = fbUser.uid;
  const timerKey = `${uid}:${bucketId}`;

  const prevTimer = pendingBucketTimers.get(timerKey);
  if (prevTimer) {
    clearTimeout(prevTimer);
    pendingBucketTimers.delete(timerKey);
  }

  if (immediate) {
    void writeProgressBucketNow(uid, bucketId, payload);
    return;
  }

  const timer = setTimeout(() => {
    pendingBucketTimers.delete(timerKey);
    void writeProgressBucketNow(uid, bucketId, payload);
  }, 600);
  pendingBucketTimers.set(timerKey, timer);
}

function readJsonLocal<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonLocal(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function getGuestPrefixes(): string[] {
  if (typeof window === "undefined") return [];
  const prefixes = new Set<string>();
  try {
    const persistentGuest = window.localStorage.getItem(PERSISTENT_GUEST_ID_KEY);
    if (persistentGuest && persistentGuest.trim()) {
      prefixes.add(persistentGuest.trim());
    }
  } catch {}
  try {
    const tabInst = window.sessionStorage.getItem(BROWSER_INSTANCE_ID_KEY);
    if (tabInst && tabInst.trim()) prefixes.add(tabInst.trim());
  } catch {}
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      const match = k.match(/_((?:inst|guest)_[a-z0-9]+_[a-z0-9]+)(?:_|$)/i);
      if (match?.[1]) {
        prefixes.add(match[1]);
      }
    }
  } catch {}
  prefixes.add("guest_default");
  return Array.from(prefixes);
}

function mergeBucketWithLocal(
  uid: string,
  bucketId: ProgressBucketId,
  cloudPayload: Record<string, unknown> | null,
): { merged: Record<string, unknown> | null; shouldPushToCloud: boolean } {
  const userPrefix = `u_${uid}`;
  const guestPrefixes = getGuestPrefixes();

  switch (bucketId) {
    case "daily_streaks": {
      const localKey = `tmp_daily_streaks_v1_${userPrefix}`;
      const localData = readJsonLocal<Record<string, any>>(localKey) || {};
      const guestMerged: Record<string, any> = {};
      for (const gp of guestPrefixes) {
        const gData = readJsonLocal<Record<string, any>>(`tmp_daily_streaks_v1_${gp}`);
        if (gData && isPlainObject(gData)) {
          Object.assign(guestMerged, gData);
        }
      }
      const remoteData = isPlainObject(cloudPayload) ? cloudPayload : {};
      const allGames = new Set([
        ...Object.keys(remoteData),
        ...Object.keys(localData),
        ...Object.keys(guestMerged),
      ]);
      if (allGames.size === 0) return { merged: null, shouldPushToCloud: false };

      const merged: Record<string, any> = {};
      let localHadExtra = false;
      for (const gameId of allGames) {
        const r = isPlainObject(remoteData[gameId]) ? (remoteData[gameId] as any) : {};
        const l = isPlainObject(localData[gameId]) ? localData[gameId] : {};
        const g = isPlainObject(guestMerged[gameId]) ? guestMerged[gameId] : {};
        const rDates = Array.isArray(r.solvedDates) ? r.solvedDates : [];
        const lDates = Array.isArray(l.solvedDates) ? l.solvedDates : [];
        const gDates = Array.isArray(g.solvedDates) ? g.solvedDates : [];
        const unionDates = Array.from(new Set([...rDates, ...lDates, ...gDates]))
          .filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
          .sort()
          .slice(-400);
        if (unionDates.length > rDates.length) localHadExtra = true;
        const maxBase = Math.max(
          Number(r.baseStreak || 0),
          Number(l.baseStreak || 0),
          Number(g.baseStreak || 0),
        );
        const baseStreakDate =
          Number(l.baseStreak || 0) >= Number(r.baseStreak || 0) && l.baseStreakDate
            ? String(l.baseStreakDate)
            : r.baseStreakDate
              ? String(r.baseStreakDate)
              : g.baseStreakDate
                ? String(g.baseStreakDate)
                : undefined;
        merged[gameId] = {
          solvedDates: unionDates,
          ...(maxBase > 0 ? { baseStreak: maxBase } : {}),
          ...(baseStreakDate ? { baseStreakDate } : {}),
        };
      }
      writeJsonLocal(localKey, merged);
      return { merged, shouldPushToCloud: localHadExtra || !cloudPayload };
    }

    case "interactive_scores": {
      const allLocal = readJsonLocal<Record<string, any>>(INTERACTIVE_SCORES_STORAGE_KEY) || {};
      const localSummary = isPlainObject(allLocal[uid]) ? allLocal[uid] : null;
      const remoteSummary = isPlainObject(cloudPayload) ? cloudPayload : null;
      if (!localSummary && !remoteSummary) return { merged: null, shouldPushToCloud: false };

      const gamesPlayed: Record<string, number> = {
        wikirec: 0,
        wikicon: 0,
        squaredint: 0,
        lexi: 0,
        destackint: 0,
        crowdle: 0,
        mpsearchint: 0,
        inkstream: 0,
        mpwh: 0,
        wbr: 0,
        tow: 0,
      };
      const localGames = isPlainObject(localSummary?.gamesPlayed)
        ? (localSummary!.gamesPlayed as Record<string, unknown>)
        : {};
      const remoteGames = isPlainObject(remoteSummary?.gamesPlayed)
        ? (remoteSummary!.gamesPlayed as Record<string, unknown>)
        : {};
      let localHadExtra = !remoteSummary;
      for (const k of Object.keys(gamesPlayed)) {
        const lVal = Number(localGames[k] || 0);
        const rVal = Number(remoteGames[k] || 0);
        gamesPlayed[k] = Math.max(lVal, rVal);
        if (lVal > rVal) localHadExtra = true;
      }

      const eventMap = new Map<string, any>();
      const remoteEvents = Array.isArray(remoteSummary?.recentEvents)
        ? (remoteSummary!.recentEvents as any[])
        : [];
      const localEvents = Array.isArray(localSummary?.recentEvents)
        ? (localSummary!.recentEvents as any[])
        : [];
      for (const ev of remoteEvents) {
        if (ev?.id) eventMap.set(String(ev.id), ev);
      }
      for (const ev of localEvents) {
        if (ev?.id && !eventMap.has(String(ev.id))) {
          eventMap.set(String(ev.id), ev);
          localHadExtra = true;
        }
      }
      const recentEvents = Array.from(eventMap.values())
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
        .slice(0, 30);

      const summedPoints = Object.values(gamesPlayed).reduce((s, n) => s + n, 0);
      const totalPoints = Math.max(
        summedPoints,
        Number(localSummary?.totalPoints || 0),
        Number(remoteSummary?.totalPoints || 0),
      );
      if (Number(localSummary?.totalPoints || 0) > Number(remoteSummary?.totalPoints || 0)) {
        localHadExtra = true;
      }

      const merged = {
        uid,
        tiktokHandle: String(
          localSummary?.tiktokHandle || remoteSummary?.tiktokHandle || "",
        ),
        totalPoints,
        gamesPlayed,
        recentEvents,
        updatedAt: Math.max(
          Number(localSummary?.updatedAt || 0),
          Number(remoteSummary?.updatedAt || 0),
          Date.now(),
        ),
      };
      allLocal[uid] = merged;
      writeJsonLocal(INTERACTIVE_SCORES_STORAGE_KEY, allLocal);
      return { merged, shouldPushToCloud: localHadExtra };
    }

    case "crossword": {
      const progressKey = `tmp_crossword_progress_v1_${userPrefix}`;
      const gridsKey = `tmp_crossword_grids_v1_${userPrefix}`;
      const lbKey = `tmp_crossword_leaderboard_v1_${userPrefix}`;

      const localProg =
        readJsonLocal<Record<string, any>>(progressKey) ||
        readJsonLocal<Record<string, any>>("tmp_crossword_progress_v1") ||
        {};
      const localGrids =
        readJsonLocal<Record<string, string[][]>>(gridsKey) ||
        readJsonLocal<Record<string, string[][]>>("tmp_crossword_grids_v1") ||
        {};
      const localLb =
        readJsonLocal<any[]>(lbKey) ||
        readJsonLocal<any[]>("tmp_crossword_leaderboard_v1") ||
        [];

      const remoteProg = isPlainObject(cloudPayload?.progress)
        ? (cloudPayload!.progress as Record<string, any>)
        : {};
      const remoteGridsRaw = isPlainObject(cloudPayload?.grids)
        ? (cloudPayload!.grids as Record<string, unknown>)
        : {};
      const remoteLb = Array.isArray(cloudPayload?.leaderboard)
        ? (cloudPayload!.leaderboard as any[])
        : [];

      const hasAny =
        Object.keys(localProg).length > 0 ||
        Object.keys(remoteProg).length > 0 ||
        Object.keys(localGrids).length > 0 ||
        Object.keys(remoteGridsRaw).length > 0 ||
        localLb.length > 0 ||
        remoteLb.length > 0;
      if (!hasAny) return { merged: null, shouldPushToCloud: false };

      let localHadExtra = !cloudPayload;
      const mergedProg: Record<string, any> = { ...remoteProg };
      for (const [pid, lItem] of Object.entries(localProg)) {
        const rItem = mergedProg[pid];
        if (!rItem) {
          mergedProg[pid] = lItem;
          localHadExtra = true;
        } else if (
          (lItem?.solved && !rItem?.solved) ||
          Number(lItem?.score || 0) > Number(rItem?.score || 0)
        ) {
          mergedProg[pid] = lItem;
          localHadExtra = true;
        }
      }

      const mergedGrids: Record<string, string[][]> = {};
      const encodedGrids: Record<string, Record<string, string[]>> = {};
      for (const [pid, rGrid] of Object.entries(remoteGridsRaw)) {
        const decoded = decodeCrosswordGrid(rGrid);
        if (decoded) {
          mergedGrids[pid] = decoded;
          encodedGrids[pid] = encodeCrosswordGrid(decoded);
        }
      }
      for (const [pid, lGrid] of Object.entries(localGrids)) {
        if (!mergedGrids[pid] && Array.isArray(lGrid)) {
          mergedGrids[pid] = lGrid;
          encodedGrids[pid] = encodeCrosswordGrid(lGrid);
          localHadExtra = true;
        }
      }

      const lbMap = new Map<string, any>();
      for (const item of remoteLb) {
        if (item?.id) lbMap.set(String(item.id), item);
      }
      for (const item of localLb) {
        if (item?.id && !lbMap.has(String(item.id))) {
          lbMap.set(String(item.id), item);
          localHadExtra = true;
        }
      }
      const mergedLb = Array.from(lbMap.values())
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, 50);

      writeJsonLocal(progressKey, mergedProg);
      writeJsonLocal(gridsKey, mergedGrids);
      writeJsonLocal(lbKey, mergedLb);

      return {
        merged: {
          progress: mergedProg,
          grids: encodedGrids,
          leaderboard: mergedLb,
        },
        shouldPushToCloud: localHadExtra,
      };
    }

    case "rebus": {
      const localKey = `pad_rebus_edition_v3_${userPrefix}`;
      let localProg = readJsonLocal<Record<string, any>>(localKey);
      if (!localProg) {
        for (const gp of guestPrefixes) {
          const gpData = readJsonLocal<Record<string, any>>(`pad_rebus_edition_v3_${gp}`);
          if (gpData) {
            localProg = gpData;
            break;
          }
        }
      }
      const remoteProg = isPlainObject(cloudPayload?.progress)
        ? (cloudPayload!.progress as Record<string, any>)
        : null;
      const localBestSprint = Number(
        readJsonLocal<number>(`mp_rebus_best_sprint_${userPrefix}`) || 0,
      );
      const remoteBestSprint = Number(cloudPayload?.bestSprint || 0);

      if (!localProg && !remoteProg && localBestSprint === 0 && remoteBestSprint === 0) {
        return { merged: null, shouldPushToCloud: false };
      }

      const lSolved = isPlainObject(localProg?.solvedIds) ? localProg!.solvedIds : {};
      const rSolved = isPlainObject(remoteProg?.solvedIds) ? remoteProg!.solvedIds : {};
      const lRev = isPlainObject(localProg?.revealedIds) ? localProg!.revealedIds : {};
      const rRev = isPlainObject(remoteProg?.revealedIds) ? remoteProg!.revealedIds : {};
      const lWs = isPlainObject(localProg?.worksheetSolved) ? localProg!.worksheetSolved : {};
      const rWs = isPlainObject(remoteProg?.worksheetSolved) ? remoteProg!.worksheetSolved : {};
      const lHints = isPlainObject(localProg?.hintsUsedByPuzzle)
        ? localProg!.hintsUsedByPuzzle
        : {};
      const rHints = isPlainObject(remoteProg?.hintsUsedByPuzzle)
        ? remoteProg!.hintsUsedByPuzzle
        : {};

      const solvedIds = { ...rSolved, ...lSolved };
      const revealedIds = { ...rRev, ...lRev };
      const worksheetSolved = { ...rWs, ...lWs };
      const hintsUsedByPuzzle = { ...rHints, ...lHints };
      const score = Math.max(Number(localProg?.score || 0), Number(remoteProg?.score || 0));
      const currentStreak = Math.max(
        Number(localProg?.currentStreak || 0),
        Number(remoteProg?.currentStreak || 0),
      );
      const bestStreak = Math.max(
        Number(localProg?.bestStreak || 0),
        Number(remoteProg?.bestStreak || 0),
      );
      const lastPlayedId = String(localProg?.lastPlayedId || remoteProg?.lastPlayedId || "");
      const bestSprint = Math.max(localBestSprint, remoteBestSprint);

      const mergedProgress = {
        solvedIds,
        revealedIds,
        worksheetSolved,
        hintsUsedByPuzzle,
        score,
        currentStreak,
        bestStreak,
        lastPlayedId,
      };
      writeJsonLocal(localKey, mergedProgress);
      if (bestSprint > 0) {
        writeJsonLocal(`mp_rebus_best_sprint_${userPrefix}`, bestSprint);
      }
      const localHadExtra =
        !cloudPayload ||
        Object.keys(solvedIds).length > Object.keys(rSolved).length ||
        score > Number(remoteProg?.score || 0) ||
        bestSprint > remoteBestSprint;
      return {
        merged: { progress: mergedProgress, bestSprint },
        shouldPushToCloud: localHadExtra,
      };
    }

    case "squared": {
      const localPuzzles: Record<string, any> = {};
      const scanPrefix = `missing_piece_solo_save_${userPrefix}_`;
      if (typeof window !== "undefined") {
        try {
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith(scanPrefix)) {
              const pid = k.slice(scanPrefix.length);
              const val = readJsonLocal<any>(k);
              if (pid && val) localPuzzles[pid] = val;
            }
          }
          for (const gp of guestPrefixes) {
            const gpPrefix = `missing_piece_solo_save_${gp}_`;
            for (let i = 0; i < window.localStorage.length; i++) {
              const k = window.localStorage.key(i);
              if (k && k.startsWith(gpPrefix)) {
                const pid = k.slice(gpPrefix.length);
                const val = readJsonLocal<any>(k);
                if (pid && val && !localPuzzles[pid]) localPuzzles[pid] = val;
              }
            }
          }
        } catch {}
      }

      const remotePuzzles = isPlainObject(cloudPayload?.puzzles)
        ? (cloudPayload!.puzzles as Record<string, any>)
        : {};
      const allIds = new Set([...Object.keys(remotePuzzles), ...Object.keys(localPuzzles)]);
      if (allIds.size === 0) return { merged: null, shouldPushToCloud: false };

      const mergedPuzzlesLocal: Record<string, any> = {};
      const mergedPuzzlesCloud: Record<string, Record<string, unknown>> = {};
      let localHadExtra = !cloudPayload;

      // Keep most recent 80 puzzles bounded
      for (const pid of Array.from(allIds).slice(-80)) {
        const l = isPlainObject(localPuzzles[pid]) ? localPuzzles[pid] : {};
        const r = isPlainObject(remotePuzzles[pid]) ? remotePuzzles[pid] : {};
        const lWords = Array.isArray(l.foundWords) ? l.foundWords : [];
        const rWords = Array.isArray(r.foundWords) ? r.foundWords : [];
        const foundWords = Array.from(new Set([...rWords, ...lWords]));
        const bonusWords = Array.from(
          new Set([
            ...(Array.isArray(r.bonusWords) ? r.bonusWords : []),
            ...(Array.isArray(l.bonusWords) ? l.bonusWords : []),
          ]),
        );
        const score = Math.max(Number(l.score || 0), Number(r.score || 0));

        // Convert revealedPrefixes array<[string, number]> <-> map for Firestore safety
        const prefMap: Record<string, number> = {};
        if (isPlainObject(r.revealedPrefixesMap)) {
          for (const [pk, pv] of Object.entries(r.revealedPrefixesMap)) {
            prefMap[pk] = Number(pv || 0);
          }
        }
        if (Array.isArray(l.revealedPrefixes)) {
          for (const pair of l.revealedPrefixes) {
            if (Array.isArray(pair) && pair.length >= 2) {
              const pk = String(pair[0]);
              prefMap[pk] = Math.max(prefMap[pk] || 0, Number(pair[1] || 0));
            }
          }
        }
        const revealedPrefixes = Object.entries(prefMap);

        if (foundWords.length > rWords.length || score > Number(r.score || 0)) {
          localHadExtra = true;
        }

        const localEntry = { foundWords, bonusWords, score, revealedPrefixes };
        mergedPuzzlesLocal[pid] = localEntry;
        mergedPuzzlesCloud[pid] = {
          foundWords,
          bonusWords,
          score,
          revealedPrefixesMap: prefMap,
        };
        writeJsonLocal(`${scanPrefix}${pid}`, localEntry);
      }

      return {
        merged: { puzzles: mergedPuzzlesCloud },
        shouldPushToCloud: localHadExtra,
      };
    }

    case "thematix": {
      const statsKey = `thematik_game_stats_${userPrefix}`;
      const progPrefix = `thematik_progress_${userPrefix}_`;
      const localStats = readJsonLocal<Record<string, any>>(statsKey);
      const remoteStats = isPlainObject(cloudPayload?.stats)
        ? (cloudPayload!.stats as Record<string, any>)
        : null;

      const localPuzzles: Record<string, any> = {};
      if (typeof window !== "undefined") {
        try {
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith(progPrefix)) {
              const pid = k.slice(progPrefix.length);
              const v = readJsonLocal<any>(k);
              if (pid && v) localPuzzles[pid] = v;
            }
          }
        } catch {}
      }
      const remotePuzzles = isPlainObject(cloudPayload?.puzzles)
        ? (cloudPayload!.puzzles as Record<string, any>)
        : {};
      const allPids = new Set([...Object.keys(remotePuzzles), ...Object.keys(localPuzzles)]);
      if (!localStats && !remoteStats && allPids.size === 0) {
        return { merged: null, shouldPushToCloud: false };
      }

      const mergedStats = {
        played: Math.max(Number(localStats?.played || 0), Number(remoteStats?.played || 0)),
        won: Math.max(Number(localStats?.won || 0), Number(remoteStats?.won || 0)),
        currentStreak: Math.max(
          Number(localStats?.currentStreak || 0),
          Number(remoteStats?.currentStreak || 0),
        ),
        maxStreak: Math.max(
          Number(localStats?.maxStreak || 0),
          Number(remoteStats?.maxStreak || 0),
        ),
        guessDistribution:
          Number(localStats?.won || 0) >= Number(remoteStats?.won || 0) &&
          isPlainObject(localStats?.guessDistribution)
            ? localStats!.guessDistribution
            : remoteStats?.guessDistribution || {},
        lastPlayedDate: String(
          localStats?.lastPlayedDate || remoteStats?.lastPlayedDate || "",
        ),
      };
      writeJsonLocal(statsKey, mergedStats);

      const mergedPuzzles: Record<string, any> = {};
      let localHadExtra = !cloudPayload || Number(localStats?.played || 0) > Number(remoteStats?.played || 0);
      for (const pid of Array.from(allPids).slice(-100)) {
        const l = isPlainObject(localPuzzles[pid]) ? localPuzzles[pid] : null;
        const r = isPlainObject(remotePuzzles[pid]) ? remotePuzzles[pid] : null;
        if (l && (!r || (l.isSolved && !r.isSolved))) {
          mergedPuzzles[pid] = l;
          localHadExtra = true;
        } else if (r) {
          mergedPuzzles[pid] = r;
        }
        if (mergedPuzzles[pid]) {
          writeJsonLocal(`${progPrefix}${pid}`, mergedPuzzles[pid]);
        }
      }

      return {
        merged: { stats: mergedStats, puzzles: mergedPuzzles },
        shouldPushToCloud: localHadExtra,
      };
    }

    case "destack": {
      const localKey = `destack_game_stats_v1_${userPrefix}`;
      const localStats =
        readJsonLocal<Record<string, any>>(localKey) ||
        readJsonLocal<Record<string, any>>("destack_game_stats_v1");
      const remoteStats = isPlainObject(cloudPayload?.stats)
        ? (cloudPayload!.stats as Record<string, any>)
        : null;
      if (!localStats && !remoteStats) return { merged: null, shouldPushToCloud: false };

      const completedDays = {
        ...(isPlainObject(remoteStats?.completedDays) ? remoteStats!.completedDays : {}),
        ...(isPlainObject(localStats?.completedDays) ? localStats!.completedDays : {}),
      };
      const completedHardDays = {
        ...(isPlainObject(remoteStats?.completedHardDays) ? remoteStats!.completedHardDays : {}),
        ...(isPlainObject(localStats?.completedHardDays) ? localStats!.completedHardDays : {}),
      };
      const bestTime = Math.min(
        Number(localStats?.bestTimeSeconds || 9999),
        Number(remoteStats?.bestTimeSeconds || 9999),
      );
      const mergedStats = {
        gamesPlayed: Math.max(
          Number(localStats?.gamesPlayed || 0),
          Number(remoteStats?.gamesPlayed || 0),
        ),
        gamesWon: Math.max(
          Number(localStats?.gamesWon || 0),
          Number(remoteStats?.gamesWon || 0),
        ),
        currentStreak: Math.max(
          Number(localStats?.currentStreak || 0),
          Number(remoteStats?.currentStreak || 0),
        ),
        maxStreak: Math.max(
          Number(localStats?.maxStreak || 0),
          Number(remoteStats?.maxStreak || 0),
        ),
        bestTimeSeconds: bestTime,
        totalHintsUsed: Math.max(
          Number(localStats?.totalHintsUsed || 0),
          Number(remoteStats?.totalHintsUsed || 0),
        ),
        completedDays,
        completedHardDays,
      };
      writeJsonLocal(localKey, mergedStats);
      const localHadExtra =
        !cloudPayload ||
        Object.keys(completedDays).length >
          Object.keys((remoteStats?.completedDays as object) || {}).length;
      return { merged: { stats: mergedStats }, shouldPushToCloud: localHadExtra };
    }

    case "unolingo": {
      const pKey = `tmp_unolingo_progress_v1_${userPrefix}`;
      const sKey = `tmp_unolingo_stats_v1_${userPrefix}`;
      const fKey = `tmp_unolingo_prefs_v1_${userPrefix}`;
      const localP = readJsonLocal<Record<string, any>>(pKey) || {};
      const localS = readJsonLocal<Record<string, any>>(sKey);
      const localF = readJsonLocal<Record<string, any>>(fKey);

      const remoteP = isPlainObject(cloudPayload?.progress)
        ? (cloudPayload!.progress as Record<string, any>)
        : {};
      const remoteS = isPlainObject(cloudPayload?.stats)
        ? (cloudPayload!.stats as Record<string, any>)
        : null;
      const remoteF = isPlainObject(cloudPayload?.prefs)
        ? (cloudPayload!.prefs as Record<string, any>)
        : null;

      if (
        Object.keys(localP).length === 0 &&
        Object.keys(remoteP).length === 0 &&
        !localS &&
        !remoteS
      ) {
        return { merged: null, shouldPushToCloud: false };
      }

      const mergedP: Record<string, any> = { ...remoteP };
      let localHadExtra = !cloudPayload;
      for (const [k, lVal] of Object.entries(localP)) {
        const rVal = mergedP[k];
        if (!rVal || (lVal?.status === "completed" && rVal?.status !== "completed")) {
          mergedP[k] = lVal;
          localHadExtra = true;
        }
      }
      const mergedS = {
        currentStreak: Math.max(
          Number(localS?.currentStreak || 0),
          Number(remoteS?.currentStreak || 0),
        ),
        longestStreak: Math.max(
          Number(localS?.longestStreak || 0),
          Number(remoteS?.longestStreak || 0),
        ),
        totalSolved: Math.max(
          Number(localS?.totalSolved || 0),
          Number(remoteS?.totalSolved || 0),
        ),
        bestTimeSec:
          Number(localS?.bestTimeSec || 0) > 0 && Number(remoteS?.bestTimeSec || 0) > 0
            ? Math.min(Number(localS!.bestTimeSec), Number(remoteS!.bestTimeSec))
            : Math.max(Number(localS?.bestTimeSec || 0), Number(remoteS?.bestTimeSec || 0)),
        totalHintsUsed: Math.max(
          Number(localS?.totalHintsUsed || 0),
          Number(remoteS?.totalHintsUsed || 0),
        ),
        totalMistakes: Math.max(
          Number(localS?.totalMistakes || 0),
          Number(remoteS?.totalMistakes || 0),
        ),
        lastDailyStreakDate: String(
          localS?.lastDailyStreakDate || remoteS?.lastDailyStreakDate || "",
        ),
      };
      const mergedF = localF || remoteF || { soundEnabled: true, autoCheck: false };

      writeJsonLocal(pKey, mergedP);
      writeJsonLocal(sKey, mergedS);
      writeJsonLocal(fKey, mergedF);
      return {
        merged: { progress: mergedP, stats: mergedS, prefs: mergedF },
        shouldPushToCloud: localHadExtra,
      };
    }

    case "mpsearch": {
      const localKey = `mp_search_progress_v1_${userPrefix}`;
      const localMap = readJsonLocal<Record<string, any>>(localKey) || {};
      const remoteMap = isPlainObject(cloudPayload?.progress)
        ? (cloudPayload!.progress as Record<string, any>)
        : {};
      const allKeys = new Set([...Object.keys(remoteMap), ...Object.keys(localMap)]);
      if (allKeys.size === 0) return { merged: null, shouldPushToCloud: false };

      const merged: Record<string, any> = { ...remoteMap };
      let localHadExtra = !cloudPayload;
      for (const dk of allKeys) {
        const l = localMap[dk];
        const r = remoteMap[dk];
        if (
          l &&
          (!r ||
            Number(l.highScore || 0) > Number(r.highScore || 0) ||
            (Array.isArray(l.foundWords) ? l.foundWords.length : 0) >
              (Array.isArray(r.foundWords) ? r.foundWords.length : 0))
        ) {
          merged[dk] = l;
          localHadExtra = true;
        }
      }
      writeJsonLocal(localKey, merged);
      return { merged: { progress: merged }, shouldPushToCloud: localHadExtra };
    }

    case "mpdifference": {
      const localKey = `mp_difference_completions_v1_${userPrefix}`;
      const localMap = readJsonLocal<Record<string, any>>(localKey) || {};
      const remoteMap = isPlainObject(cloudPayload?.completions)
        ? (cloudPayload!.completions as Record<string, any>)
        : {};
      const allKeys = new Set([...Object.keys(remoteMap), ...Object.keys(localMap)]);
      if (allKeys.size === 0) return { merged: null, shouldPushToCloud: false };

      const merged: Record<string, any> = { ...remoteMap };
      let localHadExtra = !cloudPayload;
      for (const dk of allKeys) {
        const l = localMap[dk];
        const r = remoteMap[dk];
        if (l && (!r || Number(l.bestScore || 0) > Number(r.bestScore || 0))) {
          merged[dk] = l;
          localHadExtra = true;
        }
      }
      writeJsonLocal(localKey, merged);
      return { merged: { completions: merged }, shouldPushToCloud: localHadExtra };
    }

    case "mpcolossal": {
      const scales = ["colossal", "grand", "district"] as const;
      const remoteScales = isPlainObject(cloudPayload?.scales)
        ? (cloudPayload!.scales as Record<string, any>)
        : {};
      const mergedScales: Record<string, any> = {};
      let hasAny = false;
      let localHadExtra = !cloudPayload;

      for (const s of scales) {
        const k = `mpcolossal_save_v2_${userPrefix}_${s}`;
        let l = readJsonLocal<Record<string, any>>(k);
        for (const gp of guestPrefixes) {
          const gpData = readJsonLocal<Record<string, any>>(`mpcolossal_save_v2_${gp}_${s}`);
          if (gpData) {
            l = mergeColossalScaleEntry(gpData, l);
          }
        }
        const r = isPlainObject(remoteScales[s]) ? remoteScales[s] : null;
        if (l || r) {
          hasAny = true;
          const mergedEntry = mergeColossalScaleEntry(r, l);
          if (mergedEntry) {
            mergedScales[s] = mergedEntry;
            const rCount = isPlainObject(r?.userGrid) ? Object.keys(r!.userGrid).length : 0;
            const mCount = isPlainObject(mergedEntry.userGrid)
              ? Object.keys(mergedEntry.userGrid).length
              : 0;
            if (mCount > rCount || (!r && l)) {
              localHadExtra = true;
            }
            writeJsonLocal(k, mergedEntry);
          }
        }
      }
      if (!hasAny) return { merged: null, shouldPushToCloud: false };
      return { merged: { scales: mergedScales }, shouldPushToCloud: localHadExtra };
    }

    case "tekscodle": {
      const localKey = `tekscodle_stats_v1_${userPrefix}`;
      const l = readJsonLocal<Record<string, any>>(localKey);
      const r = isPlainObject(cloudPayload?.stats)
        ? (cloudPayload!.stats as Record<string, any>)
        : null;
      if (!l && !r) return { merged: null, shouldPushToCloud: false };

      const dailyDates = Array.from(
        new Set([
          ...(Array.isArray(r?.dailyCompletedDates) ? r!.dailyCompletedDates : []),
          ...(Array.isArray(l?.dailyCompletedDates) ? l!.dailyCompletedDates : []),
        ]),
      ).sort();
      const runMap = new Map<string, any>();
      for (const run of Array.isArray(r?.recentRuns) ? r!.recentRuns : []) {
        if (run?.id) runMap.set(String(run.id), run);
      }
      for (const run of Array.isArray(l?.recentRuns) ? l!.recentRuns : []) {
        if (run?.id) runMap.set(String(run.id), run);
      }
      const recentRuns = Array.from(runMap.values())
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
        .slice(0, 30);

      const merged = {
        bestScore: Math.max(Number(l?.bestScore || 0), Number(r?.bestScore || 0)),
        gamesPlayed: Math.max(Number(l?.gamesPlayed || 0), Number(r?.gamesPlayed || 0)),
        quickPlays: Math.max(Number(l?.quickPlays || 0), Number(r?.quickPlays || 0)),
        dailyCompletedDates: dailyDates,
        recentRuns,
      };
      writeJsonLocal(localKey, merged);
      const localHadExtra =
        !cloudPayload ||
        Number(l?.gamesPlayed || 0) > Number(r?.gamesPlayed || 0) ||
        dailyDates.length > (Array.isArray(r?.dailyCompletedDates) ? r!.dailyCompletedDates.length : 0);
      return { merged: { stats: merged }, shouldPushToCloud: localHadExtra };
    }

    case "wordhunt": {
      const localKey = `wordhunt_solo_stats_v1_${userPrefix}`;
      const l = readJsonLocal<Record<string, any>>(localKey);
      const r = isPlainObject(cloudPayload?.stats)
        ? (cloudPayload!.stats as Record<string, any>)
        : null;
      if (!l && !r) return { merged: null, shouldPushToCloud: false };

      const dailyDates = Array.from(
        new Set([
          ...(Array.isArray(r?.dailyCompletedDates) ? r!.dailyCompletedDates : []),
          ...(Array.isArray(l?.dailyCompletedDates) ? l!.dailyCompletedDates : []),
        ]),
      ).sort();

      const mergeFewest = (a: unknown, b: unknown): number | null => {
        const na = typeof a === "number" && a > 0 ? a : null;
        const nb = typeof b === "number" && b > 0 ? b : null;
        if (na === null) return nb;
        if (nb === null) return na;
        return Math.min(na, nb);
      };

      const merged = {
        gamesPlayed: Math.max(Number(l?.gamesPlayed || 0), Number(r?.gamesPlayed || 0)),
        gamesWon: Math.max(Number(l?.gamesWon || 0), Number(r?.gamesWon || 0)),
        currentStreak: Math.max(Number(l?.currentStreak || 0), Number(r?.currentStreak || 0)),
        bestStreak: Math.max(Number(l?.bestStreak || 0), Number(r?.bestStreak || 0)),
        bestScore: Math.max(Number(l?.bestScore || 0), Number(r?.bestScore || 0)),
        fewestClassic: mergeFewest(l?.fewestClassic, r?.fewestClassic),
        fewestDual: mergeFewest(l?.fewestDual, r?.fewestDual),
        fewestQuad: mergeFewest(l?.fewestQuad, r?.fewestQuad),
        dailyCompletedDates: dailyDates,
      };
      writeJsonLocal(localKey, merged);
      const localHadExtra =
        !cloudPayload ||
        Number(l?.gamesPlayed || 0) > Number(r?.gamesPlayed || 0) ||
        Number(l?.bestScore || 0) > Number(r?.bestScore || 0) ||
        dailyDates.length > (Array.isArray(r?.dailyCompletedDates) ? r!.dailyCompletedDates.length : 0);
      return { merged: { stats: merged }, shouldPushToCloud: localHadExtra };
    }

    case "goingdeep": {
      const progressKey = `goingdeep_progress_v1_${userPrefix}`;
      const statsKey = `goingdeep_stats_v1_${userPrefix}`;
      const lProg = readJsonLocal<Record<string, any>>(progressKey);
      const lStats = readJsonLocal<Record<string, any>>(statsKey);
      const rProg = isPlainObject(cloudPayload?.progress)
        ? (cloudPayload!.progress as Record<string, any>)
        : null;
      const rStats = isPlainObject(cloudPayload?.stats)
        ? (cloudPayload!.stats as Record<string, any>)
        : null;
      if (!lProg && !lStats && !rProg && !rStats) {
        return { merged: null, shouldPushToCloud: false };
      }
      const mergedPayload = mergeCloudBucketPayloads(
        "goingdeep",
        { progress: rProg || {}, stats: rStats || {} },
        { progress: lProg || {}, stats: lStats || {} },
      );
      if (isPlainObject(mergedPayload.progress)) {
        writeJsonLocal(progressKey, mergedPayload.progress);
      }
      if (isPlainObject(mergedPayload.stats)) {
        writeJsonLocal(statsKey, mergedPayload.stats);
      }
      const localHadExtra =
        !cloudPayload ||
        Number(lStats?.played || 0) > Number(rStats?.played || 0) ||
        Object.keys(lProg || {}).length > Object.keys(rProg || {}).length;
      return { merged: mergedPayload, shouldPushToCloud: localHadExtra };
    }

    case "wordlock": {
      const progressKey = `wordlock_progress_v1_${userPrefix}`;
      const statsKey = `wordlock_stats_v1_${userPrefix}`;
      const lProg = readJsonLocal<Record<string, any>>(progressKey);
      const lStats = readJsonLocal<Record<string, any>>(statsKey);
      const rProg = isPlainObject(cloudPayload?.progress)
        ? (cloudPayload!.progress as Record<string, any>)
        : null;
      const rStats = isPlainObject(cloudPayload?.stats)
        ? (cloudPayload!.stats as Record<string, any>)
        : null;
      if (!lProg && !lStats && !rProg && !rStats) {
        return { merged: null, shouldPushToCloud: false };
      }
      const mergedPayload = mergeCloudBucketPayloads(
        "wordlock",
        { progress: rProg || {}, stats: rStats || {} },
        { progress: lProg || {}, stats: lStats || {} },
      );
      if (isPlainObject(mergedPayload.progress)) {
        writeJsonLocal(progressKey, mergedPayload.progress);
      }
      if (isPlainObject(mergedPayload.stats)) {
        writeJsonLocal(statsKey, mergedPayload.stats);
      }
      const localHadExtra =
        !cloudPayload ||
        Number(lStats?.played || 0) > Number(rStats?.played || 0) ||
        Object.keys(lProg || {}).length > Object.keys(rProg || {}).length;
      return { merged: mergedPayload, shouldPushToCloud: localHadExtra };
    }

    case "crossjig": {
      const statsKey = `crossjig_stats_v1_${userPrefix}`;
      const lStats = readJsonLocal<Record<string, any>>(statsKey);
      const rStats = isPlainObject(cloudPayload?.stats)
        ? (cloudPayload!.stats as Record<string, any>)
        : null;
      let guestStats: Record<string, any> | null = null;
      for (const gp of guestPrefixes) {
        const g = readJsonLocal<Record<string, any>>(`crossjig_stats_v1_${gp}`);
        if (g && isPlainObject(g)) {
          guestStats = guestStats
            ? (mergeCloudBucketPayloads("crossjig", { stats: guestStats }, { stats: g }).stats as Record<string, any>)
            : g;
        }
      }
      const legacyGlobal = readJsonLocal<Record<string, any>>("crossjig_stats_v1");
      if (legacyGlobal && isPlainObject(legacyGlobal)) {
        guestStats = guestStats
          ? (mergeCloudBucketPayloads("crossjig", { stats: guestStats }, { stats: legacyGlobal }).stats as Record<string, any>)
          : legacyGlobal;
      }
      const combinedLocal =
        lStats && guestStats
          ? (mergeCloudBucketPayloads("crossjig", { stats: guestStats }, { stats: lStats }).stats as Record<string, any>)
          : lStats || guestStats;
      if (!combinedLocal && !rStats) {
        return { merged: null, shouldPushToCloud: false };
      }
      const mergedPayload = mergeCloudBucketPayloads(
        "crossjig",
        { stats: rStats || {} },
        { stats: combinedLocal || {} },
      );
      if (isPlainObject(mergedPayload.stats)) {
        writeJsonLocal(statsKey, mergedPayload.stats);
      }
      const localHadExtra =
        !cloudPayload ||
        Number(combinedLocal?.totalSolved || 0) > Number(rStats?.totalSolved || 0);
      return { merged: mergedPayload, shouldPushToCloud: localHadExtra };
    }

    default:
      return { merged: null, shouldPushToCloud: false };
  }
}

const hydrationInFlight = new Map<string, Promise<void>>();

export async function hydrateAllUserProgressFromCloud(
  fbUser: User,
): Promise<void> {
  if (typeof window === "undefined") return;
  const uid = String(fbUser?.uid || "").trim();
  if (!uid || !ID_REGEX.test(uid)) return;

  const existing = hydrationInFlight.get(uid);
  if (existing) return existing;

  const task = (async () => {
    updateSyncStatus({ status: "syncing", lastError: null });
    const progressPath = `users/${uid}/progress`;
    try {
      const profile = await ensureUserProfileDoc(fbUser);
      if (profile) {
        const cloudLang = profile.preferredLanguage;
        if (typeof cloudLang === "string") {
          const normalized = normalizeDictionaryLanguage(cloudLang);
          if (normalized !== getDictionaryLanguage()) {
            setDictionaryLanguage(normalized, { skipCloudSync: true });
          }
        }
        if (typeof profile.darkMode === "boolean") {
          try {
            window.localStorage.setItem(SITE_DARK_MODE_KEY, String(profile.darkMode));
          } catch {}
        }
        const cloudHandle = normalizeHandle(profile.linkedTikTokHandle);
        if (cloudHandle) {
          try {
            const linksRaw = window.localStorage.getItem("mp_tiktok_handle_links_v1");
            const links = linksRaw ? JSON.parse(linksRaw) : {};
            const key = cloudHandle.toLowerCase();
            if (!links[key] || links[key].uid !== uid) {
              links[key] = {
                tiktokHandle: cloudHandle,
                uid,
                displayName: sanitizeDisplayName(profile.displayName || fbUser.displayName),
                updatedAt: Date.now(),
              };
              window.localStorage.setItem("mp_tiktok_handle_links_v1", JSON.stringify(links));
              window.dispatchEvent(new Event("mp-tiktok-link-updated"));
            }
          } catch {}
        }
      }

      const useMysql = await shouldUseMysqlBackend();
      const remoteBuckets = new Map<ProgressBucketId, Record<string, unknown>>();
      let backfilledFromFirestore = false;

      if (useMysql) {
        const mysqlBuckets = await mysqlGetAllProgress();
        if (mysqlBuckets) {
          for (const [bKey, bPayload] of Object.entries(mysqlBuckets)) {
            const bId = bKey as ProgressBucketId;
            if (VALID_PROGRESS_BUCKETS.has(bId) && isPlainObject(bPayload)) {
              remoteBuckets.set(bId, bPayload);
              try {
                lastWrittenHashes.set(`${uid}:${bId}`, JSON.stringify(bPayload));
              } catch {}
            }
          }
        }
        // Zero-loss lazy migration: if MySQL has no buckets for this user yet,
        // silently check Firestore once and carry their saved progress forward into MySQL.
        if (remoteBuckets.size === 0 && !isFirestoreWritePaused()) {
          try {
            const qLegacy = query(
              collection(db, "users", uid, "progress"),
              where("userId", "==", uid),
            );
            const legacySnap = await getDocs(qLegacy);
            legacySnap.forEach((docSnap) => {
              const d = docSnap.data();
              const bId = String(d?.bucketId || docSnap.id) as ProgressBucketId;
              if (VALID_PROGRESS_BUCKETS.has(bId) && isPlainObject(d?.payload)) {
                remoteBuckets.set(bId, d.payload as Record<string, unknown>);
                backfilledFromFirestore = true;
              }
            });
          } catch {
            // Firestore unavailable or empty — continue cleanly with MySQL + local storage
          }
        }
      } else {
        const q = query(
          collection(db, "users", uid, "progress"),
          where("userId", "==", uid),
        );
        const snap = await getDocs(q);
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const bId = String(d?.bucketId || docSnap.id) as ProgressBucketId;
          if (VALID_PROGRESS_BUCKETS.has(bId) && isPlainObject(d?.payload)) {
            remoteBuckets.set(bId, d.payload as Record<string, unknown>);
            try {
              lastWrittenHashes.set(`${uid}:${bId}`, JSON.stringify(d.payload));
            } catch {}
          }
        });
      }

      const bucketsToPush: Array<{ bucketId: ProgressBucketId; payload: Record<string, unknown> }> = [];
      for (const bucketId of VALID_PROGRESS_BUCKETS) {
        const remotePayload = remoteBuckets.get(bucketId) || null;
        const { merged, shouldPushToCloud } = mergeBucketWithLocal(
          uid,
          bucketId,
          remotePayload,
        );
        if (merged && (shouldPushToCloud || backfilledFromFirestore)) {
          bucketsToPush.push({ bucketId, payload: merged });
        }
      }

      hydratedUids.add(uid);

      if (bucketsToPush.length > 0 && (useMysql || !isFirestoreWritePaused())) {
        await Promise.allSettled(
          bucketsToPush.map((item) =>
            writeProgressBucketNow(uid, item.bucketId, item.payload, {
              skipHydrationWait: true,
            }),
          ),
        );
      }

      updateSyncStatus({
        status: "synced",
        lastSyncedAt: Date.now(),
        syncedBuckets: remoteBuckets.size + bucketsToPush.length,
        lastError: null,
      });

      window.dispatchEvent(new CustomEvent(CLOUD_HYDRATED_EVENT, { detail: { uid } }));
      window.dispatchEvent(new Event("tmp-daily-streak-updated"));
      window.dispatchEvent(new Event("mp-interactive-score-updated"));
      window.dispatchEvent(new Event("unified-auth-updated"));
      window.dispatchEvent(new Event("mp-site-auth-updated"));
    } catch (err) {
      if (isFirestoreQuotaError(err)) {
        markFirestoreQuotaExhausted(err);
      } else {
        handleFirestoreError(err, OperationType.LIST, progressPath);
      }
      updateSyncStatus({
        status: "error",
        lastError: err instanceof Error ? err.message : "Failed to load saved progress.",
      });
    } finally {
      hydrationInFlight.delete(uid);
    }
  })();

  hydrationInFlight.set(uid, task);
  return task;
}

export { encodeCrosswordGrid };
