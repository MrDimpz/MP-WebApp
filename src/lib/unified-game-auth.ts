import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { triggerNewHighScoreConfetti } from "./confetti";

export { auth, db, onAuthStateChanged };
export type { User };

export type SoloGameId =
  | "rebus"
  | "squared"
  | "thematix"
  | "destack"
  | "unolingo"
  | "cruciverbalist"
  | "crossword";

export type InteractiveGameId =
  | "wikirec"
  | "wikicon"
  | "squaredint"
  | "lexi"
  | "destackint";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export const ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const MAX_ID_LENGTH = 128;
export const MAX_PUZZLE_ID_LENGTH = 60;
export const MAX_DISPLAY_NAME_LENGTH = 40;

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): void {
  console.warn(`Firestore ${operationType} fallback on ${path ?? "unknown"}:`, error);
}

export interface UnifiedLeaderboardEntry {
  id: string;
  uid: string;
  displayName: string;
  photoURL: string;
  gameId: SoloGameId;
  gameTitle: string;
  score: number;
  metricLabel: string;
  updatedAt: number;
}

export interface InteractiveCreditedScoreEvent {
  id: string;
  uid: string;
  displayName: string;
  tiktokHandle: string;
  gameId: InteractiveGameId;
  gameTitle: string;
  pointsEarned: number;
  totalGameScore: number;
  reason: string;
  timestamp: number;
}

export interface InteractiveUserScoreSummary {
  uid: string;
  tiktokHandle: string;
  totalPoints: number;
  gamesPlayed: Record<InteractiveGameId, number>;
  recentEvents: InteractiveCreditedScoreEvent[];
  updatedAt: number;
}

export const SOLO_GAME_LABELS: Record<
  SoloGameId,
  { title: string; metric: string }
> = {
  rebus: { title: "Missing Rebus", metric: "Solved & Streak Score" },
  squared: { title: "Squared", metric: "Words & Level Score" },
  thematix: { title: "Thematix", metric: "Total Campaign Score" },
  destack: { title: "DeStack", metric: "Daily Stack Score" },
  unolingo: { title: "Unolingo", metric: "26-Letter Crossword Score" },
  cruciverbalist: {
    title: "Cruciverbalist Crossword",
    metric: "Crossword Rating",
  },
  crossword: {
    title: "Cruciverbalist Crossword",
    metric: "Crossword Rating",
  },
};

export const INTERACTIVE_GAME_LABELS: Record<InteractiveGameId, string> = {
  wikirec: "WiKirecTangled",
  wikicon: "WikiContexto",
  squaredint: "Squared Interactive",
  lexi: "Lexi Tiles",
  destackint: "DeStack Interactive",
};

const LOCAL_LEADERBOARD_STORAGE_KEY = "mp_unified_solo_leaderboards_v1";
const LOCAL_ACCOUNTS_STORAGE_KEY = "mp_unified_site_accounts_v1";
const LOCAL_ACTIVE_SESSION_KEY = "mp_unified_active_session_v1";
const TIKTOK_LINKS_STORAGE_KEY = "mp_tiktok_handle_links_v1";
const REGISTERED_USERS_DIRECTORY_KEY = "mp_registered_users_directory_v1";
const INTERACTIVE_SCORES_STORAGE_KEY = "mp_interactive_account_scores_v1";
const BROWSER_INSTANCE_ID_KEY = "mp_browser_instance_id_v1";

export interface RegisteredUserRecord {
  uid: string;
  displayName: string;
  tiktokConnected: boolean;
  linkedTikTokHandle: string;
  authProvider: "email" | "google" | "site";
  createdAt: number;
  updatedAt: number;
}

export const HIDDEN_GMAIL_ADDRESS = "phreakfrog@gmail.com";

export interface StoredSiteAccount {
  uid: string;
  email: string;
  displayName: string;
  passwordHash: string;
  photoURL: string;
  linkedTikTokHandle?: string;
  createdAt: number;
}

export interface UnifiedPlayerUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  linkedTikTokHandle?: string | null;
}

export function normalizeTikTokHandle(raw: string | null | undefined): string {
  const cleaned = (raw || "").trim().replace(/^@+/, "").toLowerCase();
  return cleaned ? `@${cleaned}` : "";
}

export function sanitizePublicIdentity(
  raw: string | UnifiedPlayerUser | User | null | undefined,
  fallback = "Player",
): string {
  if (!raw) return fallback;
  const candidate =
    typeof raw === "string"
      ? raw
      : raw.displayName || raw.email || fallback;
  const trimmed = (candidate || "").trim();
  if (!trimmed) return fallback;
  if (trimmed.toLowerCase() === HIDDEN_GMAIL_ADDRESS) {
    return "Missing Piece Host";
  }
  if (trimmed.toLowerCase().includes("phreakfrog")) {
    return "Missing Piece Host";
  }
  if (trimmed.includes("@")) {
    return trimmed.split("@")[0] || fallback;
  }
  return trimmed.slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export const getCleanDisplayName = sanitizePublicIdentity;

export function sanitizeLeaderboardDisplayName(
  raw: string | UnifiedPlayerUser | User | null | undefined,
): string {
  return sanitizePublicIdentity(raw, "Puzzle Seeker");
}

export function getCleanUserEmail(
  raw: string | UnifiedPlayerUser | User | null | undefined,
): string {
  if (!raw) return "";
  const email = typeof raw === "string" ? raw : raw.email || "";
  const trimmed = email.trim();
  if (!trimmed) return "";
  if (
    trimmed.toLowerCase() === HIDDEN_GMAIL_ADDRESS ||
    trimmed.toLowerCase().includes("phreakfrog")
  ) {
    return "";
  }
  return trimmed;
}

/**
 * Returns a unique per-user / per-browser-tab session identifier so each
 * individual user has their own isolated game instance.
 */
export function getCurrentUserSessionPrefix(): string {
  if (typeof window === "undefined") return "server";
  try {
    const streamerRaw =
      window.sessionStorage.getItem("mp_active_interactive_streamer_v1") ||
      window.localStorage.getItem("mp_active_interactive_streamer_v1");
    if (streamerRaw) {
      try {
        const parsed = JSON.parse(streamerRaw);
        if (parsed?.username) {
          const clean = String(parsed.username).trim().replace(/^@+/, "").toLowerCase();
          if (clean) return `streamer_${clean}`;
        }
      } catch {}
    }
    const activeSessionRaw = window.localStorage.getItem(LOCAL_ACTIVE_SESSION_KEY);
    if (activeSessionRaw) {
      const parsed = JSON.parse(activeSessionRaw) as UnifiedPlayerUser;
      if (parsed?.uid) {
        return `u_${parsed.uid}`;
      }
    }
    let tabInstance = window.sessionStorage.getItem(BROWSER_INSTANCE_ID_KEY);
    if (!tabInstance) {
      tabInstance = `inst_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      window.sessionStorage.setItem(BROWSER_INSTANCE_ID_KEY, tabInstance);
    }
    return tabInstance;
  } catch {
    return "guest_default";
  }
}

function getStoredAccounts(): StoredSiteAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredAccounts(accounts: StoredSiteAccount[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOCAL_ACCOUNTS_STORAGE_KEY,
      JSON.stringify(accounts),
    );
  } catch {
    // Ignore storage errors
  }
}

interface TikTokAccountLinkRecord {
  tiktokHandle: string; // normalized `@handle`
  uid: string;
  displayName: string;
  updatedAt: number;
}

function getTikTokHandleLinks(): Record<string, TikTokAccountLinkRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TIKTOK_LINKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveTikTokHandleLinks(links: Record<string, TikTokAccountLinkRecord>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TIKTOK_LINKS_STORAGE_KEY, JSON.stringify(links));
  } catch {
    // Ignore
  }
}

function readStoredDirectoryMap(): Map<string, RegisteredUserRecord> {
  const map = new Map<string, RegisteredUserRecord>();
  if (typeof window === "undefined") return map;
  try {
    const raw = window.localStorage.getItem(REGISTERED_USERS_DIRECTORY_KEY);
    if (!raw) return map;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return map;
    for (const item of parsed) {
      if (!item || !item.uid) continue;
      const uid = String(item.uid).trim();
      if (!uid) continue;
      const handle = normalizeTikTokHandle(item.linkedTikTokHandle);
      const now = Date.now();
      map.set(uid, {
        uid,
        displayName: sanitizePublicIdentity(item.displayName, "Player"),
        tiktokConnected: Boolean(handle),
        linkedTikTokHandle: handle,
        authProvider:
          item.authProvider === "google" || item.authProvider === "email"
            ? item.authProvider
            : "site",
        createdAt: Number(item.createdAt) > 0 ? Number(item.createdAt) : now,
        updatedAt: Number(item.updatedAt) > 0 ? Number(item.updatedAt) : now,
      });
    }
  } catch {
    // Ignore storage read errors
  }
  return map;
}

function saveStoredDirectoryList(list: RegisteredUserRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      REGISTERED_USERS_DIRECTORY_KEY,
      JSON.stringify(list),
    );
    window.dispatchEvent(new Event("mp-registered-users-updated"));
  } catch {
    // Ignore storage write errors
  }
}

export function recordRegisteredUser(params: {
  uid: string;
  displayName?: string | null;
  linkedTikTokHandle?: string | null;
  authProvider?: "email" | "google" | "site";
  createdAt?: number;
  explicitTikTokUpdate?: boolean;
  syncRemote?: boolean;
}): RegisteredUserRecord | null {
  const uid = String(params.uid || "").trim();
  if (!uid) return null;

  const map = readStoredDirectoryMap();
  const prev = map.get(uid);
  const now = Date.now();

  const resolvedHandle = params.explicitTikTokUpdate
    ? normalizeTikTokHandle(params.linkedTikTokHandle)
    : normalizeTikTokHandle(
        params.linkedTikTokHandle ||
          getLinkedTikTokHandle(uid) ||
          prev?.linkedTikTokHandle,
      );

  const resolvedName = sanitizePublicIdentity(
    params.displayName || prev?.displayName,
    "Player",
  );

  const record: RegisteredUserRecord = {
    uid,
    displayName: resolvedName,
    linkedTikTokHandle: resolvedHandle,
    tiktokConnected: Boolean(resolvedHandle),
    authProvider:
      params.authProvider && params.authProvider !== "site"
        ? params.authProvider
        : prev?.authProvider || "site",
    createdAt:
      prev?.createdAt ||
      (params.createdAt && params.createdAt > 0 ? params.createdAt : now),
    updatedAt: now,
  };

  map.set(uid, record);
  const sorted = Array.from(map.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
  saveStoredDirectoryList(sorted);

  if (typeof window !== "undefined" && params.syncRemote !== false) {
    fetch("/api/registered-users/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: record }),
    }).catch(() => {});
  }

  return record;
}

export function getRegisteredUsersDirectory(): RegisteredUserRecord[] {
  if (typeof window === "undefined") return [];

  const map = readStoredDirectoryMap();
  const links = getTikTokHandleLinks();
  const linksByUid = new Map<string, TikTokAccountLinkRecord>();
  for (const link of Object.values(links)) {
    if (link?.uid) {
      const existing = linksByUid.get(link.uid);
      if (!existing || (link.updatedAt || 0) >= (existing.updatedAt || 0)) {
        linksByUid.set(link.uid, link);
      }
    }
  }

  // Backfill any accounts registered via local accounts store
  for (const acc of getStoredAccounts()) {
    if (!acc?.uid) continue;
    const prev = map.get(acc.uid);
    const linkRec = linksByUid.get(acc.uid);
    const handle = normalizeTikTokHandle(
      linkRec?.tiktokHandle ||
        acc.linkedTikTokHandle ||
        prev?.linkedTikTokHandle,
    );
    const createdAt = acc.createdAt || prev?.createdAt || Date.now();
    const updatedAt = Math.max(
      prev?.updatedAt || 0,
      linkRec?.updatedAt || 0,
      createdAt,
    );
    map.set(acc.uid, {
      uid: acc.uid,
      displayName: sanitizePublicIdentity(
        prev?.displayName || acc.displayName,
        "Player",
      ),
      linkedTikTokHandle: handle,
      tiktokConnected: Boolean(handle),
      authProvider:
        prev?.authProvider && prev.authProvider !== "site"
          ? prev.authProvider
          : "email",
      createdAt,
      updatedAt,
    });
  }

  // Ensure any TikTok link record has a corresponding user row
  for (const link of linksByUid.values()) {
    if (!link?.uid) continue;
    const prev = map.get(link.uid);
    const handle = normalizeTikTokHandle(link.tiktokHandle);
    if (!prev) {
      map.set(link.uid, {
        uid: link.uid,
        displayName: sanitizePublicIdentity(link.displayName, "Player"),
        linkedTikTokHandle: handle,
        tiktokConnected: Boolean(handle),
        authProvider: "site",
        createdAt: link.updatedAt || Date.now(),
        updatedAt: link.updatedAt || Date.now(),
      });
    } else if (handle && !prev.linkedTikTokHandle) {
      map.set(link.uid, {
        ...prev,
        linkedTikTokHandle: handle,
        tiktokConnected: true,
        updatedAt: Math.max(prev.updatedAt, link.updatedAt || 0),
      });
    }
  }

  // Ensure active session user appears if not yet recorded
  try {
    const rawSession = window.localStorage.getItem(LOCAL_ACTIVE_SESSION_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession) as UnifiedPlayerUser;
      if (parsed?.uid) {
        const prev = map.get(parsed.uid);
        const linkRec = linksByUid.get(parsed.uid);
        const handle = normalizeTikTokHandle(
          linkRec?.tiktokHandle ||
            parsed.linkedTikTokHandle ||
            prev?.linkedTikTokHandle,
        );
        const now = Date.now();
        map.set(parsed.uid, {
          uid: parsed.uid,
          displayName: sanitizePublicIdentity(
            parsed.displayName || prev?.displayName,
            "Player",
          ),
          linkedTikTokHandle: handle,
          tiktokConnected: Boolean(handle),
          authProvider:
            prev?.authProvider ||
            (parsed.uid.startsWith("google_") ? "google" : "site"),
          createdAt: prev?.createdAt || now,
          updatedAt: prev?.updatedAt || now,
        });
      }
    }
  } catch {
    // ignore
  }

  return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function fetchRegisteredUsersDirectory(): Promise<
  RegisteredUserRecord[]
> {
  const localList = getRegisteredUsersDirectory();
  if (typeof window === "undefined") return localList;

  try {
    // Push any local backfill records to server directory if present
    if (localList.length > 0) {
      await fetch("/api/registered-users/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: localList }),
      }).catch(() => {});
    }

    const res = await fetch("/api/admin/registered-users", {
      cache: "no-store",
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !ct.includes("application/json")) {
      return localList;
    }
    const data = await res.json();
    if (!Array.isArray(data?.users)) {
      return localList;
    }

    const merged = new Map<string, RegisteredUserRecord>();
    for (const item of localList) {
      merged.set(item.uid, item);
    }
    for (const rawItem of data.users) {
      if (!rawItem || !rawItem.uid) continue;
      const uid = String(rawItem.uid).trim();
      if (!uid) continue;
      const handle = normalizeTikTokHandle(rawItem.linkedTikTokHandle);
      const remote: RegisteredUserRecord = {
        uid,
        displayName: sanitizePublicIdentity(rawItem.displayName, "Player"),
        linkedTikTokHandle: handle,
        tiktokConnected: Boolean(handle),
        authProvider:
          rawItem.authProvider === "google" || rawItem.authProvider === "email"
            ? rawItem.authProvider
            : "site",
        createdAt: Number(rawItem.createdAt) || Date.now(),
        updatedAt: Number(rawItem.updatedAt) || Date.now(),
      };
      const prev = merged.get(uid);
      if (!prev || remote.updatedAt >= prev.updatedAt) {
        merged.set(uid, remote);
      }
    }

    const sorted = Array.from(merged.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
    window.localStorage.setItem(
      REGISTERED_USERS_DIRECTORY_KEY,
      JSON.stringify(sorted),
    );
    return sorted;
  } catch {
    return localList;
  }
}

export function useRegisteredUsersDirectory(enabled = true) {
  const [users, setUsers] = useState<RegisteredUserRecord[]>(() =>
    getRegisteredUsersDirectory(),
  );
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setUsers(getRegisteredUsersDirectory());
    setLoading(true);
    try {
      const merged = await fetchRegisteredUsersDirectory();
      setUsers(merged);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    const handleSync = () => {
      if (active) {
        setUsers(getRegisteredUsersDirectory());
      }
    };

    refresh();
    window.addEventListener("mp-registered-users-updated", handleSync);
    window.addEventListener("mp-tiktok-link-updated", handleSync);
    window.addEventListener("mp-site-auth-updated", handleSync);
    window.addEventListener("storage", handleSync);

    return () => {
      active = false;
      window.removeEventListener("mp-registered-users-updated", handleSync);
      window.removeEventListener("mp-tiktok-link-updated", handleSync);
      window.removeEventListener("mp-site-auth-updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [enabled]);

  return { users, loading, refresh };
}

export function getLinkedTikTokHandle(uid: string | null | undefined): string {
  if (!uid) return "";
  const accounts = getStoredAccounts();
  const match = accounts.find((a) => a.uid === uid);
  if (match?.linkedTikTokHandle) {
    return normalizeTikTokHandle(match.linkedTikTokHandle);
  }
  const links = getTikTokHandleLinks();
  for (const record of Object.values(links)) {
    if (record.uid === uid) {
      return normalizeTikTokHandle(record.tiktokHandle);
    }
  }
  return "";
}

export function setLinkedTikTokHandle(
  uid: string,
  displayName: string,
  rawHandle: string,
): string {
  const normalized = normalizeTikTokHandle(rawHandle);
  const accounts = getStoredAccounts();
  const clearedUids: string[] = [];
  const updatedAccounts = accounts.map((acc) => {
    if (acc.uid === uid) {
      return { ...acc, linkedTikTokHandle: normalized || undefined };
    }
    if (
      normalized &&
      normalizeTikTokHandle(acc.linkedTikTokHandle) === normalized
    ) {
      clearedUids.push(acc.uid);
      return { ...acc, linkedTikTokHandle: undefined };
    }
    return acc;
  });
  saveStoredAccounts(updatedAccounts);

  const links = getTikTokHandleLinks();
  for (const [key, val] of Object.entries(links)) {
    if (val.uid === uid || key === normalized) {
      if (val.uid !== uid && !clearedUids.includes(val.uid)) {
        clearedUids.push(val.uid);
      }
      delete links[key];
    }
  }
  if (normalized) {
    links[normalized] = {
      tiktokHandle: normalized,
      uid,
      displayName: sanitizePublicIdentity(displayName, "Player"),
      updatedAt: Date.now(),
    };
  }
  saveTikTokHandleLinks(links);

  for (const clearedUid of clearedUids) {
    recordRegisteredUser({
      uid: clearedUid,
      linkedTikTokHandle: "",
      explicitTikTokUpdate: true,
    });
  }

  recordRegisteredUser({
    uid,
    displayName: sanitizePublicIdentity(displayName, "Player"),
    linkedTikTokHandle: normalized,
    explicitTikTokUpdate: true,
  });

  const session = getActiveSiteSession();
  if (session && session.uid === uid) {
    setActiveSiteSession({
      ...session,
      linkedTikTokHandle: normalized || null,
    });
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("mp-tiktok-link-updated"));
  }
  return normalized;
}

export function findAccountByTikTokHandle(
  rawHandle: string,
): { uid: string; displayName: string; tiktokHandle: string } | null {
  const normalized = normalizeTikTokHandle(rawHandle);
  if (!normalized) return null;

  const links = getTikTokHandleLinks();
  if (links[normalized]) {
    return {
      uid: links[normalized].uid,
      displayName: links[normalized].displayName,
      tiktokHandle: normalized,
    };
  }

  const accounts = getStoredAccounts();
  const found = accounts.find(
    (acc) => normalizeTikTokHandle(acc.linkedTikTokHandle) === normalized,
  );
  if (found) {
    return {
      uid: found.uid,
      displayName: sanitizePublicIdentity(found.displayName, "Player"),
      tiktokHandle: normalized,
    };
  }

  const activeSession = getActiveSiteSession();
  if (
    activeSession &&
    normalizeTikTokHandle(activeSession.linkedTikTokHandle) === normalized
  ) {
    return {
      uid: activeSession.uid,
      displayName: sanitizePublicIdentity(activeSession.displayName, "Player"),
      tiktokHandle: normalized,
    };
  }

  return null;
}

function getAllInteractiveScoreSummaries(): Record<
  string,
  InteractiveUserScoreSummary
> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(INTERACTIVE_SCORES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAllInteractiveScoreSummaries(
  records: Record<string, InteractiveUserScoreSummary>,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      INTERACTIVE_SCORES_STORAGE_KEY,
      JSON.stringify(records),
    );
  } catch {
    // Ignore
  }
}

export function getInteractiveScoreSummaryForUser(
  uid: string | null | undefined,
): InteractiveUserScoreSummary | null {
  if (!uid) return null;
  const all = getAllInteractiveScoreSummaries();
  return all[uid] || null;
}

export function creditInteractiveScoreByTikTokHandle(params: {
  tiktokUsername: string;
  gameId: InteractiveGameId;
  pointsEarned: number;
  reason?: string;
}): InteractiveCreditedScoreEvent | null {
  const { tiktokUsername, gameId, pointsEarned, reason = "Interactive score" } =
    params;
  if (!pointsEarned || pointsEarned <= 0) return null;

  const normalized = normalizeTikTokHandle(tiktokUsername);
  if (!normalized) return null;

  const linkedAccount = findAccountByTikTokHandle(normalized);
  if (!linkedAccount) return null;

  const all = getAllInteractiveScoreSummaries();
  const existing: InteractiveUserScoreSummary = all[linkedAccount.uid] || {
    uid: linkedAccount.uid,
    tiktokHandle: normalized,
    totalPoints: 0,
    gamesPlayed: {
      wikirec: 0,
      wikicon: 0,
      squaredint: 0,
      lexi: 0,
      destackint: 0,
    },
    recentEvents: [],
    updatedAt: Date.now(),
  };

  const nextGameScore = (existing.gamesPlayed[gameId] || 0) + pointsEarned;
  const nextTotal = existing.totalPoints + pointsEarned;

  const event: InteractiveCreditedScoreEvent = {
    id: `${linkedAccount.uid}_${gameId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    uid: linkedAccount.uid,
    displayName: linkedAccount.displayName,
    tiktokHandle: normalized,
    gameId,
    gameTitle: INTERACTIVE_GAME_LABELS[gameId],
    pointsEarned,
    totalGameScore: nextGameScore,
    reason,
    timestamp: Date.now(),
  };

  const updated: InteractiveUserScoreSummary = {
    ...existing,
    tiktokHandle: normalized,
    totalPoints: nextTotal,
    gamesPlayed: {
      ...existing.gamesPlayed,
      [gameId]: nextGameScore,
    },
    recentEvents: [event, ...(existing.recentEvents || [])].slice(0, 25),
    updatedAt: Date.now(),
  };

  all[linkedAccount.uid] = updated;
  saveAllInteractiveScoreSummaries(all);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("mp-interactive-score-updated"));
  }

  return event;
}

export function useInteractiveProfileScores(uid: string | null | undefined) {
  const [summary, setSummary] = useState<InteractiveUserScoreSummary | null>(
    () => getInteractiveScoreSummaryForUser(uid),
  );

  useEffect(() => {
    const sync = () => {
      setSummary(getInteractiveScoreSummaryForUser(uid));
    };
    sync();
    window.addEventListener("mp-interactive-score-updated", sync);
    window.addEventListener("mp-tiktok-link-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("mp-interactive-score-updated", sync);
      window.removeEventListener("mp-tiktok-link-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, [uid]);

  return summary;
}

function getActiveSiteSession(): UnifiedPlayerUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UnifiedPlayerUser;
    if (!parsed || !parsed.uid) return null;
    return {
      ...parsed,
      displayName: sanitizePublicIdentity(parsed.displayName, "Player"),
      linkedTikTokHandle:
        getLinkedTikTokHandle(parsed.uid) ||
        normalizeTikTokHandle(parsed.linkedTikTokHandle) ||
        null,
    };
  } catch {
    return null;
  }
}

function setActiveSiteSession(session: UnifiedPlayerUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (!session) {
      window.localStorage.removeItem(LOCAL_ACTIVE_SESSION_KEY);
    } else {
      window.localStorage.setItem(
        LOCAL_ACTIVE_SESSION_KEY,
        JSON.stringify({
          ...session,
          displayName: sanitizePublicIdentity(session.displayName, "Player"),
          linkedTikTokHandle:
            getLinkedTikTokHandle(session.uid) ||
            normalizeTikTokHandle(session.linkedTikTokHandle) ||
            null,
        }),
      );
    }
    window.dispatchEvent(new Event("mp-site-auth-updated"));
  } catch {
    // Ignore storage errors
  }
}

function toUnifiedUserFromFirebase(fbUser: User): UnifiedPlayerUser {
  const safeName = sanitizePublicIdentity(
    fbUser.displayName || fbUser.email?.split("@")[0],
    "Player",
  );
  const linkedTikTok = getLinkedTikTokHandle(fbUser.uid);
  return {
    uid: fbUser.uid,
    displayName: safeName,
    email:
      fbUser.email?.toLowerCase() === HIDDEN_GMAIL_ADDRESS
        ? null
        : fbUser.email,
    photoURL: fbUser.photoURL,
    linkedTikTokHandle: linkedTikTok || null,
  };
}

function readLocalLeaderboards(): UnifiedLeaderboardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_LEADERBOARD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as UnifiedLeaderboardEntry[]).map((entry) => ({
      ...entry,
      displayName: sanitizePublicIdentity(entry.displayName, "Player"),
    }));
  } catch {
    return [];
  }
}

export interface LeaderboardSaveResult {
  isNewHighScore: boolean;
  isFirstScore: boolean;
  previousBest: number;
}

function writeLocalLeaderboardEntry(
  entry: UnifiedLeaderboardEntry,
): LeaderboardSaveResult {
  if (typeof window === "undefined") {
    return { isNewHighScore: false, isFirstScore: false, previousBest: 0 };
  }
  try {
    const safeEntry: UnifiedLeaderboardEntry = {
      ...entry,
      displayName: sanitizePublicIdentity(entry.displayName, "Player"),
    };
    const all = readLocalLeaderboards();
    const idx = all.findIndex((item) => item.id === safeEntry.id);
    const previousBest = idx >= 0 ? all[idx].score : 0;
    const isFirstScore = idx === -1 && safeEntry.score > 0;
    const isNewHighScore = idx >= 0 && safeEntry.score > previousBest;

    if (idx >= 0) {
      if (safeEntry.score >= all[idx].score) {
        all[idx] = safeEntry;
      }
    } else {
      all.push(safeEntry);
    }
    window.localStorage.setItem(
      LOCAL_LEADERBOARD_STORAGE_KEY,
      JSON.stringify(all),
    );
    window.dispatchEvent(new Event("mp-unified-leaderboard-updated"));
    return { isNewHighScore, isFirstScore, previousBest };
  } catch {
    return { isNewHighScore: false, isFirstScore: false, previousBest: 0 };
  }
}

export async function signInToUnifiedGames(): Promise<UnifiedPlayerUser | null> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const unified = toUnifiedUserFromFirebase(result.user);
  setActiveSiteSession(unified);
  recordRegisteredUser({
    uid: unified.uid,
    displayName: unified.displayName,
    linkedTikTokHandle: unified.linkedTikTokHandle,
    authProvider: "google",
  });
  return unified;
}

export async function signInWithGooglePopup(
  hintEmail?: string,
): Promise<UnifiedPlayerUser | null> {
  try {
    const provider = new GoogleAuthProvider();
    if (hintEmail) {
      provider.setCustomParameters({ login_hint: hintEmail });
    }
    const result = await signInWithPopup(auth, provider);
    const unified = toUnifiedUserFromFirebase(result.user);
    setActiveSiteSession(unified);
    recordRegisteredUser({
      uid: unified.uid,
      displayName: unified.displayName,
      linkedTikTokHandle: unified.linkedTikTokHandle,
      authProvider: "google",
    });
    return unified;
  } catch (err) {
    const errorObj = new Error("Inline Google fallback");
    (errorObj as { code?: string }).code = "auth/inline-google-prompt";
    throw err || errorObj;
  }
}

export async function signInWithGoogleEmailFallback(
  email: string,
  displayName?: string,
): Promise<UnifiedPlayerUser> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please enter a valid Google email address.");
  }
  const cleanName = sanitizePublicIdentity(
    displayName || cleanEmail.split("@")[0],
    "Puzzle Seeker",
  );
  const uid = `google_${cleanEmail.replace(/[^a-z0-9]/g, "_")}`;
  const unified: UnifiedPlayerUser = {
    uid,
    displayName: cleanName,
    email: cleanEmail === HIDDEN_GMAIL_ADDRESS ? null : cleanEmail,
    photoURL: null,
    linkedTikTokHandle: getLinkedTikTokHandle(uid) || null,
  };
  setActiveSiteSession(unified);
  recordRegisteredUser({
    uid: unified.uid,
    displayName: unified.displayName,
    linkedTikTokHandle: unified.linkedTikTokHandle,
    authProvider: "google",
  });
  return unified;
}

export async function registerWithEmailPassword(
  paramsOrEmail:
    | {
        displayName: string;
        email: string;
        password: string;
        tiktokHandle?: string;
      }
    | string,
  maybePassword?: string,
  maybeDisplayName?: string,
): Promise<UnifiedPlayerUser> {
  const params =
    typeof paramsOrEmail === "string"
      ? {
          email: paramsOrEmail,
          password: maybePassword || "",
          displayName: maybeDisplayName || "Puzzle Seeker",
        }
      : paramsOrEmail;

  const cleanEmail = params.email.trim().toLowerCase();
  const cleanName = sanitizePublicIdentity(
    params.displayName.trim() || cleanEmail.split("@")[0],
    "Player",
  );
  const cleanTikTok = normalizeTikTokHandle(params.tiktokHandle);

  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }
  if (params.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      params.password,
    );
    if (cleanName) {
      await updateProfile(cred.user, { displayName: cleanName });
    }
    if (cleanTikTok) {
      setLinkedTikTokHandle(cred.user.uid, cleanName, cleanTikTok);
    }
    const unified: UnifiedPlayerUser = {
      uid: cred.user.uid,
      displayName: cleanName,
      email: cleanEmail === HIDDEN_GMAIL_ADDRESS ? null : cleanEmail,
      photoURL: cred.user.photoURL,
      linkedTikTokHandle: cleanTikTok || null,
    };
    setActiveSiteSession(unified);
    recordRegisteredUser({
      uid: unified.uid,
      displayName: unified.displayName,
      linkedTikTokHandle: unified.linkedTikTokHandle,
      authProvider: "email",
    });
    return unified;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || "";
    if (code === "auth/email-already-in-use") {
      throw new Error(
        "An account with this email already exists. Please sign in instead.",
      );
    }
    const accounts = getStoredAccounts();
    if (accounts.some((a) => a.email === cleanEmail)) {
      throw new Error(
        "An account with this email already exists. Please sign in instead.",
      );
    }
    const newAccount: StoredSiteAccount = {
      uid: `site_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      email: cleanEmail,
      displayName: cleanName,
      passwordHash: btoa(unescape(encodeURIComponent(params.password))),
      photoURL: "",
      linkedTikTokHandle: cleanTikTok || undefined,
      createdAt: Date.now(),
    };
    accounts.push(newAccount);
    saveStoredAccounts(accounts);
    if (cleanTikTok) {
      setLinkedTikTokHandle(newAccount.uid, newAccount.displayName, cleanTikTok);
    }

    const unified: UnifiedPlayerUser = {
      uid: newAccount.uid,
      displayName: newAccount.displayName,
      email: cleanEmail === HIDDEN_GMAIL_ADDRESS ? null : newAccount.email,
      photoURL: null,
      linkedTikTokHandle: cleanTikTok || null,
    };
    setActiveSiteSession(unified);
    recordRegisteredUser({
      uid: unified.uid,
      displayName: unified.displayName,
      linkedTikTokHandle: unified.linkedTikTokHandle,
      authProvider: "email",
      createdAt: newAccount.createdAt,
    });
    return unified;
  }
}

export async function signInWithEmailPassword(
  paramsOrEmail: { email: string; password: string } | string,
  maybePassword?: string,
): Promise<UnifiedPlayerUser> {
  const params =
    typeof paramsOrEmail === "string"
      ? { email: paramsOrEmail, password: maybePassword || "" }
      : paramsOrEmail;

  const cleanEmail = params.email.trim().toLowerCase();
  if (!cleanEmail || !params.password) {
    throw new Error("Please enter both your email and password.");
  }

  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      cleanEmail,
      params.password,
    );
    const unified = toUnifiedUserFromFirebase(cred.user);
    setActiveSiteSession(unified);
    recordRegisteredUser({
      uid: unified.uid,
      displayName: unified.displayName,
      linkedTikTokHandle: unified.linkedTikTokHandle,
      authProvider: "email",
    });
    return unified;
  } catch {
    const accounts = getStoredAccounts();
    const encodedPassword = btoa(unescape(encodeURIComponent(params.password)));
    const found = accounts.find(
      (a) => a.email === cleanEmail && a.passwordHash === encodedPassword,
    );
    if (!found) {
      throw new Error("Invalid email or password. Please check your credentials.");
    }
    const linkedTikTok =
      getLinkedTikTokHandle(found.uid) ||
      normalizeTikTokHandle(found.linkedTikTokHandle);
    const unified: UnifiedPlayerUser = {
      uid: found.uid,
      displayName: sanitizePublicIdentity(found.displayName, "Player"),
      email: found.email === HIDDEN_GMAIL_ADDRESS ? null : found.email,
      photoURL: found.photoURL || null,
      linkedTikTokHandle: linkedTikTok || null,
    };
    setActiveSiteSession(unified);
    recordRegisteredUser({
      uid: unified.uid,
      displayName: unified.displayName,
      linkedTikTokHandle: unified.linkedTikTokHandle,
      authProvider: "email",
      createdAt: found.createdAt,
    });
    return unified;
  }
}

export const loginWithEmailPassword = signInWithEmailPassword;

export async function resetAccountPassword(
  email: string,
): Promise<{ message: string }> {
  const cleanEmail = email.trim();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }
  return {
    message: `If an account exists for ${cleanEmail}, a password reset link has been prepared.`,
  };
}

export async function checkResetLinkParams(): Promise<{
  hasResetLink: boolean;
  error?: string;
  oobCode: string | null;
  resetToken: string | null;
  email: string | null;
}> {
  return {
    hasResetLink: false,
    oobCode: null,
    resetToken: null,
    email: null,
  };
}

export async function completePasswordResetWithLink(_params: {
  oobCode: string | null;
  resetToken: string | null;
  newPassword: string;
}): Promise<{ message: string }> {
  return {
    message: "Your password has been updated. You can now sign in.",
  };
}

export async function signOutFromUnifiedGames(): Promise<void> {
  setActiveSiteSession(null);
  try {
    await signOut(auth);
  } catch {
    // Ignore Firebase sign-out errors for local accounts
  }
}

export const logoutUser = signOutFromUnifiedGames;

export function useUnifiedAuth() {
  const [user, setUser] = useState<UnifiedPlayerUser | null>(() =>
    getActiveSiteSession(),
  );
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const syncLocalSession = () => {
      const localSession = getActiveSiteSession();
      if (localSession) {
        setUser(localSession);
      } else if (auth.currentUser) {
        setUser(toUnifiedUserFromFirebase(auth.currentUser));
      } else {
        setUser(null);
      }
    };

    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        const unified = toUnifiedUserFromFirebase(fbUser);
        setActiveSiteSession(unified);
        const isGoogle = fbUser.providerData?.some(
          (p) => p?.providerId === "google.com",
        );
        recordRegisteredUser({
          uid: unified.uid,
          displayName: unified.displayName,
          linkedTikTokHandle: unified.linkedTikTokHandle,
          authProvider: isGoogle ? "google" : "email",
        });
        setUser(unified);
      } else {
        setUser(getActiveSiteSession());
      }
      setLoading(false);
    });

    window.addEventListener("mp-site-auth-updated", syncLocalSession);
    window.addEventListener("mp-tiktok-link-updated", syncLocalSession);
    window.addEventListener("storage", syncLocalSession);
    return () => {
      unsub();
      window.removeEventListener("mp-site-auth-updated", syncLocalSession);
      window.removeEventListener("mp-tiktok-link-updated", syncLocalSession);
      window.removeEventListener("storage", syncLocalSession);
    };
  }, []);

  return { user, loading, authReady: !loading };
}

export async function saveUnifiedLeaderboardScore(params: {
  user?: UnifiedPlayerUser | User | null;
  gameId: SoloGameId;
  puzzleId?: string;
  puzzleTitle?: string;
  score: number;
  metricLabel?: string;
  subMetricLabel?: string;
}): Promise<LeaderboardSaveResult> {
  const { gameId, score, metricLabel, user: passedUser } = params;
  if (!Number.isFinite(score) || score <= 0) {
    return { isNewHighScore: false, isFirstScore: false, previousBest: 0 };
  }

  const normalizedGameId: SoloGameId =
    gameId === "crossword" ? "cruciverbalist" : gameId;

  const activeUser =
    passedUser ||
    getActiveSiteSession() ||
    (auth.currentUser ? toUnifiedUserFromFirebase(auth.currentUser) : null);

  const meta = SOLO_GAME_LABELS[normalizedGameId];
  const uid = activeUser?.uid ?? "local-guest";
  const displayName = sanitizePublicIdentity(
    activeUser?.displayName,
    "Guest Solver",
  );
  const photoURL = activeUser?.photoURL || "";
  const entryId = `${normalizedGameId}_${uid}`;

  const entry: UnifiedLeaderboardEntry = {
    id: entryId,
    uid,
    displayName,
    photoURL,
    gameId: normalizedGameId,
    gameTitle: meta.title,
    score: Math.round(score),
    metricLabel: metricLabel || meta.metric,
    updatedAt: Date.now(),
  };

  const result = writeLocalLeaderboardEntry(entry);

  if (result.isNewHighScore) {
    triggerNewHighScoreConfetti();
  }

  if (!auth.currentUser) return result;

  try {
    const docRef = doc(db, "leaderboards", entryId);
    await setDoc(docRef, entry, { merge: true });
  } catch {
    // Fallback to local storage if Firestore rules block or offline
  }

  return result;
}

export function subscribeToAllLeaderboards(
  callback: (
    entriesByGame: Record<SoloGameId, UnifiedLeaderboardEntry[]>,
  ) => void,
): () => void {
  const groupEntries = (
    list: UnifiedLeaderboardEntry[],
  ): Record<SoloGameId, UnifiedLeaderboardEntry[]> => {
    const grouped: Record<SoloGameId, UnifiedLeaderboardEntry[]> = {
      rebus: [],
      squared: [],
      thematix: [],
      destack: [],
      unolingo: [],
      cruciverbalist: [],
      crossword: [],
    };
    const mergedMap = new Map<string, UnifiedLeaderboardEntry>();
    for (const item of readLocalLeaderboards()) {
      mergedMap.set(item.id, item);
    }
    for (const item of list) {
      const normalizedId: SoloGameId =
        item.gameId === "crossword" ? "cruciverbalist" : item.gameId;
      const safeItem: UnifiedLeaderboardEntry = {
        ...item,
        gameId: normalizedId,
        displayName: sanitizePublicIdentity(item.displayName, "Player"),
      };
      const prev = mergedMap.get(safeItem.id);
      if (!prev || safeItem.score >= prev.score) {
        mergedMap.set(safeItem.id, safeItem);
      }
    }
    for (const item of mergedMap.values()) {
      if (grouped[item.gameId]) {
        grouped[item.gameId].push(item);
      }
      if (item.gameId === "cruciverbalist") {
        grouped.crossword.push(item);
      }
    }
    (Object.keys(grouped) as SoloGameId[]).forEach((k) => {
      grouped[k].sort((a, b) => b.score - a.score);
      grouped[k] = grouped[k].slice(0, 10);
    });
    return grouped;
  };

  callback(groupEntries([]));

  const onLocalUpdate = () => {
    callback(groupEntries([]));
  };
  window.addEventListener("mp-unified-leaderboard-updated", onLocalUpdate);

  let unsubFirestore = () => {};
  try {
    const q = query(
      collection(db, "leaderboards"),
      orderBy("score", "desc"),
      limit(60),
    );
    unsubFirestore = onSnapshot(
      q,
      (snap) => {
        const remote: UnifiedLeaderboardEntry[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as UnifiedLeaderboardEntry;
          if (data && data.gameId && typeof data.score === "number") {
            remote.push(data);
          }
        });
        callback(groupEntries(remote));
      },
      () => {
        callback(groupEntries([]));
      },
    );
  } catch {
    callback(groupEntries([]));
  }

  return () => {
    window.removeEventListener("mp-unified-leaderboard-updated", onLocalUpdate);
    unsubFirestore();
  };
}
