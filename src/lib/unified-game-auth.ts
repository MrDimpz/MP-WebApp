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
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { triggerNewHighScoreConfetti } from "./confetti";
import {
  isFirestoreQuotaError,
  isFirestoreWritePaused,
  markFirestoreQuotaExhausted,
} from "./firestore-quota";

export { auth, db, onAuthStateChanged };
export type { User };

export type SoloGameId =
  | "rebus"
  | "squared"
  | "thematix"
  | "destack"
  | "unolingo"
  | "wikirec"
  | "wikicon"
  | "mpsearch"
  | "mpdifference"
  | "mpcolossal"
  | "cruciverbalist"
  | "crossword";

export type InteractiveGameId =
  | "wikirec"
  | "wikicon"
  | "squaredint"
  | "lexi"
  | "destackint"
  | "crowdle"
  | "mpsearchint";

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

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn("Firestore Error:", JSON.stringify(errInfo));
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
  wikirec: { title: "WiKirecTangled", metric: "Solo Article & Grid Score" },
  wikicon: { title: "WikiContexto", metric: "Solo Discovery Score" },
  mpsearch: { title: "MP Search", metric: "Daily 10×10 Word Search Score" },
  mpdifference: {
    title: "MP Difference",
    metric: "Daily Spot-the-Difference Score",
  },
  mpcolossal: {
    title: "MP Colossal",
    metric: "Colossal Atlas Score",
  },
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
  crowdle: "Crowdle",
  mpsearchint: "MP Search Interactive",
};

const LOCAL_LEADERBOARD_STORAGE_KEY = "mp_unified_solo_leaderboards_v1";
const LOCAL_ACCOUNTS_STORAGE_KEY = "mp_unified_site_accounts_v1";
const LOCAL_ACTIVE_SESSION_KEY = "mp_unified_active_session_v1";
const TIKTOK_LINKS_STORAGE_KEY = "mp_tiktok_handle_links_v1";
const TIKTOK_AVATARS_CACHE_KEY = "mp_tiktok_avatars_cache_v1";
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

const clientAvatarFetchInFlight = new Map<string, Promise<string>>();

function readTikTokAvatarCache(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TIKTOK_AVATARS_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeTikTokAvatarCache(cache: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TIKTOK_AVATARS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore quota errors
  }
}

export function getCachedTikTokAvatar(rawHandle: string | null | undefined): string {
  const normalized = normalizeTikTokHandle(rawHandle);
  if (!normalized) return "";
  const cache = readTikTokAvatarCache();
  return cache[normalized] || "";
}

export async function downloadAndCacheTikTokAvatar(
  rawHandle: string | null | undefined,
  forceRefresh = false,
): Promise<string> {
  if (typeof window === "undefined") return "";
  const normalized = normalizeTikTokHandle(rawHandle);
  if (!normalized) return "";
  const cleanUsername = normalized.replace(/^@+/, "");

  if (!forceRefresh) {
    const existing = getCachedTikTokAvatar(normalized);
    if (existing && existing.startsWith("data:image/")) {
      return existing;
    }
  }

  const inflight = clientAvatarFetchInFlight.get(normalized);
  if (inflight) return inflight;

  const task = (async (): Promise<string> => {
    try {
      const res = await fetch(
        `/api/tiktok/profile-avatar?username=${encodeURIComponent(cleanUsername)}${forceRefresh ? "&force=1" : ""}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = await res.json();
        const downloadedUrl =
          typeof data?.avatarUrl === "string" && data.avatarUrl.startsWith("data:image/")
            ? data.avatarUrl
            : typeof data?.endpointUrl === "string"
              ? data.endpointUrl
              : "";
        if (downloadedUrl) {
          const cache = readTikTokAvatarCache();
          cache[normalized] = downloadedUrl;
          writeTikTokAvatarCache(cache);

          // Update stored site accounts that have this TikTok handle
          const accounts = getStoredAccounts();
          let accountsChanged = false;
          const updatedAccounts = accounts.map((acc) => {
            if (normalizeTikTokHandle(acc.linkedTikTokHandle) === normalized) {
              accountsChanged = true;
              return { ...acc, photoURL: downloadedUrl };
            }
            return acc;
          });
          if (accountsChanged) {
            saveStoredAccounts(updatedAccounts);
          }

          // Update active session if it belongs to this TikTok handle
          try {
            const rawSession = window.localStorage.getItem(LOCAL_ACTIVE_SESSION_KEY);
            if (rawSession) {
              const parsed = JSON.parse(rawSession) as UnifiedPlayerUser;
              const sessionHandle =
                getLinkedTikTokHandle(parsed?.uid) ||
                normalizeTikTokHandle(parsed?.linkedTikTokHandle);
              if (sessionHandle === normalized && parsed.photoURL !== downloadedUrl) {
                parsed.photoURL = downloadedUrl;
                window.localStorage.setItem(
                  LOCAL_ACTIVE_SESSION_KEY,
                  JSON.stringify(parsed),
                );
              }
            }
          } catch {
            // ignore
          }

          window.dispatchEvent(new Event("mp-tiktok-avatar-updated"));
          window.dispatchEvent(new Event("mp-site-auth-updated"));
          return downloadedUrl;
        }
      }
    } catch {
      // ignore network error
    } finally {
      clientAvatarFetchInFlight.delete(normalized);
    }
    return `/api/tiktok/avatar/${encodeURIComponent(cleanUsername)}`;
  })();

  clientAvatarFetchInFlight.set(normalized, task);
  return task;
}

/**
 * Resolves the profile icon to display in solo games for a user.
 * If the user has registered/linked a TikTok @ handle, their downloaded
 * TikTok profile icon is always prioritized over the default icon.
 */
export function getUserProfileAvatarUrl(
  user?:
    | UnifiedPlayerUser
    | User
    | { uid?: string; photoURL?: string | null; linkedTikTokHandle?: string | null }
    | null,
): string {
  let targetUser = user;
  if (!targetUser && typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(LOCAL_ACTIVE_SESSION_KEY);
      if (raw) {
        targetUser = JSON.parse(raw) as UnifiedPlayerUser;
      }
    } catch {
      // ignore
    }
  }
  if (!targetUser && typeof auth !== "undefined" && auth?.currentUser) {
    targetUser = auth.currentUser;
  }
  if (!targetUser) return "";
  const uid = (targetUser as { uid?: string }).uid || "";
  const explicitHandle = (targetUser as { linkedTikTokHandle?: string | null }).linkedTikTokHandle;
  const linkedHandle = normalizeTikTokHandle(
    explicitHandle || (uid ? getLinkedTikTokHandle(uid) : ""),
  );

  if (linkedHandle) {
    const cached = getCachedTikTokAvatar(linkedHandle);
    if (cached) return cached;
    void downloadAndCacheTikTokAvatar(linkedHandle);
    const clean = linkedHandle.replace(/^@+/, "");
    return `/api/tiktok/avatar/${encodeURIComponent(clean)}`;
  }

  return (targetUser as { photoURL?: string | null }).photoURL || "";
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

function toMillisSafe(val: unknown, fallback = Date.now()): number {
  if (typeof val === "number" && Number.isFinite(val) && val > 0) return val;
  if (val && typeof val === "object") {
    const maybe = val as {
      toMillis?: () => number;
      seconds?: number;
      nanoseconds?: number;
    };
    if (typeof maybe.toMillis === "function") {
      try {
        const ms = maybe.toMillis();
        if (Number.isFinite(ms) && ms > 0) return ms;
      } catch {
        // ignore
      }
    }
    if (typeof maybe.seconds === "number") {
      return maybe.seconds * 1000;
    }
  }
  if (typeof val === "string") {
    const parsed = Date.parse(val);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

const firebaseSyncQueue = new Map<string, Promise<void>>();
const syncedRegisteredUserSignatures = new Set<string>();
let didInitialLocalDirectorySync = false;
let pendingRegistrationMeta: {
  email: string;
  displayName: string;
  linkedTikTokHandle: string;
} | null = null;

export async function syncFirebaseRegisteredUser(
  record: RegisteredUserRecord,
  explicitTikTokUpdate = false,
): Promise<void> {
  if (typeof window === "undefined") return;
  if (isFirestoreWritePaused()) return;
  const uid = String(record.uid || "").trim();
  if (!uid || uid === "local-guest") return;
  if (!ID_REGEX.test(uid) || uid.length > MAX_ID_LENGTH) return;

  const safeNamePreview = sanitizePublicIdentity(record.displayName, "Player").slice(
    0,
    60,
  );
  const safeHandlePreview = normalizeTikTokHandle(record.linkedTikTokHandle).slice(
    0,
    40,
  );
  const safeProviderPreview =
    record.authProvider === "google" ||
    record.authProvider === "email" ||
    record.authProvider === "site"
      ? record.authProvider
      : uid.startsWith("google_")
        ? "google"
        : "email";
  const syncSignature = `${uid}|${safeNamePreview}|${safeHandlePreview}|${safeProviderPreview}`;
  if (!explicitTikTokUpdate && syncedRegisteredUserSignatures.has(syncSignature)) {
    return;
  }

  const previousTask = firebaseSyncQueue.get(uid) || Promise.resolve();
  const nextTask = previousTask
    .catch(() => {})
    .then(async () => {
      if (isFirestoreWritePaused()) return;
      const fbUser = auth.currentUser;
      const safeName = sanitizePublicIdentity(record.displayName, "Player").slice(
        0,
        60,
      );
      const safeHandle = normalizeTikTokHandle(record.linkedTikTokHandle).slice(
        0,
        40,
      );
      const safeProvider: "email" | "google" | "site" =
        record.authProvider === "google" ||
        record.authProvider === "email" ||
        record.authProvider === "site"
          ? record.authProvider
          : fbUser &&
              fbUser.uid === uid &&
              fbUser.providerData?.some((p) => p?.providerId === "google.com")
            ? "google"
            : uid.startsWith("google_")
              ? "google"
              : "email";

      const docPath = `registeredUsers/${uid}`;
      const docRef = doc(db, "registeredUsers", uid);

      try {
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          if (isFirestoreWritePaused()) return;
          await setDoc(docRef, {
            userId: uid,
            displayName: safeName,
            tiktokConnected: Boolean(safeHandle),
            linkedTikTokHandle: safeHandle,
            authProvider: safeProvider,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          syncedRegisteredUserSignatures.add(syncSignature);
        } else {
          const existing = snap.data();
          const prevHandle = normalizeTikTokHandle(existing?.linkedTikTokHandle);
          const finalHandle = explicitTikTokUpdate
            ? safeHandle
            : safeHandle || prevHandle;
          const prevName = sanitizePublicIdentity(existing?.displayName, "Player");
          const isGenericIncoming =
            safeName === "Player" || safeName === "Puzzle Seeker";
          const finalName =
            isGenericIncoming && prevName !== "Player" ? prevName : safeName;
          const finalProvider: "email" | "google" | "site" =
            safeProvider !== "site"
              ? safeProvider
              : existing?.authProvider === "google" ||
                  existing?.authProvider === "email"
                ? existing.authProvider
                : "site";

          const shouldUpdate =
            existing?.displayName !== finalName ||
            existing?.linkedTikTokHandle !== finalHandle ||
            existing?.tiktokConnected !== Boolean(finalHandle) ||
            existing?.authProvider !== finalProvider;

          if (shouldUpdate) {
            if (isFirestoreWritePaused()) return;
            await updateDoc(docRef, {
              userId: uid,
              displayName: finalName,
              tiktokConnected: Boolean(finalHandle),
              linkedTikTokHandle: finalHandle,
              authProvider: finalProvider,
              updatedAt: serverTimestamp(),
            });
          }
          syncedRegisteredUserSignatures.add(syncSignature);
          syncedRegisteredUserSignatures.add(
            `${uid}|${finalName}|${finalHandle}|${finalProvider}`,
          );
        }
      } catch (err) {
        if (isFirestoreQuotaError(err)) {
          markFirestoreQuotaExhausted(err);
          return;
        }
        handleFirestoreError(err, OperationType.WRITE, docPath);
      }
    });

  firebaseSyncQueue.set(uid, nextTask);
  return nextTask;
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
  if (!uid || uid === "local-guest") return null;

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

  const incomingCleanName = sanitizePublicIdentity(params.displayName, "Player");
  const prevCleanName = prev?.displayName
    ? sanitizePublicIdentity(prev.displayName, "Player")
    : "";
  const isIncomingGeneric =
    !params.displayName ||
    incomingCleanName === "Player" ||
    incomingCleanName === "Puzzle Seeker";
  const resolvedName =
    isIncomingGeneric && prevCleanName && prevCleanName !== "Player"
      ? prevCleanName
      : incomingCleanName || prevCleanName || "Player";

  const record: RegisteredUserRecord = {
    uid,
    displayName: resolvedName,
    linkedTikTokHandle: resolvedHandle,
    tiktokConnected: Boolean(resolvedHandle),
    authProvider:
      params.authProvider && params.authProvider !== "site"
        ? params.authProvider
        : prev?.authProvider ||
          (uid.startsWith("google_") ? "google" : "site"),
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
      body: JSON.stringify({
        user: record,
        explicitTikTokUpdate: Boolean(params.explicitTikTokUpdate),
      }),
    }).catch(() => {});
    void syncFirebaseRegisteredUser(record, Boolean(params.explicitTikTokUpdate));
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

  // Backfill any previously signed-in users recorded in local solo leaderboards or Squared high scores
  try {
    for (const lbEntry of readLocalLeaderboards()) {
      const uid = String(lbEntry.uid || "").trim();
      if (!uid || uid === "local-guest") continue;
      if (!map.has(uid)) {
        const linkRec = linksByUid.get(uid);
        const handle = normalizeTikTokHandle(linkRec?.tiktokHandle);
        const ts = Number(lbEntry.updatedAt) || Date.now();
        map.set(uid, {
          uid,
          displayName: sanitizePublicIdentity(lbEntry.displayName, "Player"),
          linkedTikTokHandle: handle,
          tiktokConnected: Boolean(handle),
          authProvider: uid.startsWith("google_") ? "google" : "site",
          createdAt: ts,
          updatedAt: Math.max(ts, linkRec?.updatedAt || 0),
        });
      }
    }

    const rawSquared = window.localStorage.getItem("mp_squared_highscores_local_v1");
    if (rawSquared) {
      const parsedSquared = JSON.parse(rawSquared);
      if (Array.isArray(parsedSquared)) {
        for (const item of parsedSquared) {
          const uid = String(item?.userId || "").trim();
          if (!uid || uid === "local-guest") continue;
          if (!map.has(uid)) {
            const linkRec = linksByUid.get(uid);
            const handle = normalizeTikTokHandle(linkRec?.tiktokHandle);
            const now = Date.now();
            map.set(uid, {
              uid,
              displayName: sanitizePublicIdentity(item.displayName, "Player"),
              linkedTikTokHandle: handle,
              tiktokConnected: Boolean(handle),
              authProvider: uid.startsWith("google_") ? "google" : "site",
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function fetchRegisteredUsersFromFirestore(): Promise<
  RegisteredUserRecord[]
> {
  if (typeof window === "undefined") return [];

  const byUid = new Map<string, RegisteredUserRecord>();
  const links = getTikTokHandleLinks();
  const linksByUid = new Map<string, TikTokAccountLinkRecord>();
  for (const link of Object.values(links)) {
    if (link?.uid) {
      linksByUid.set(link.uid, link);
    }
  }

  const mergeDocUser = (raw: {
    uid: string;
    displayName: unknown;
    linkedTikTokHandle?: unknown;
    authProvider?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    fromProfileCollection?: boolean;
  }) => {
    const uid = String(raw.uid || "").trim();
    if (!uid || uid === "local-guest") return;

    const prev = byUid.get(uid);
    const localLink = linksByUid.get(uid);
    const rawHandleStr =
      typeof raw.linkedTikTokHandle === "string" ? raw.linkedTikTokHandle : "";
    const rawNameStr =
      typeof raw.displayName === "string" ? raw.displayName : "";
    const docHandle = normalizeTikTokHandle(rawHandleStr);
    const resolvedHandle =
      docHandle ||
      (prev?.linkedTikTokHandle ?? "") ||
      normalizeTikTokHandle(localLink?.tiktokHandle);
    const createdAt = Math.min(
      prev?.createdAt || Number.MAX_SAFE_INTEGER,
      toMillisSafe(raw.createdAt, Date.now()),
    );
    const updatedAt = Math.max(
      prev?.updatedAt || 0,
      toMillisSafe(raw.updatedAt, Date.now()),
    );
    const provider: "email" | "google" | "site" =
      raw.authProvider === "google" || raw.authProvider === "email"
        ? raw.authProvider
        : prev?.authProvider || "site";

    byUid.set(uid, {
      uid,
      displayName: sanitizePublicIdentity(
        raw.fromProfileCollection
          ? rawNameStr || prev?.displayName
          : prev?.displayName || rawNameStr,
        "Player",
      ),
      linkedTikTokHandle: resolvedHandle,
      tiktokConnected: Boolean(resolvedHandle),
      authProvider: provider,
      createdAt:
        createdAt === Number.MAX_SAFE_INTEGER ? Date.now() : createdAt,
      updatedAt,
    });
  };

  const [profilesRes, highscoresRes, leaderboardRes] = await Promise.allSettled([
    getDocs(query(collection(db, "registeredUsers"), limit(500))),
    getDocs(query(collection(db, "highscores"), limit(500))),
    getDocs(query(collection(db, "leaderboard"), limit(500))),
  ]);

  if (profilesRes.status === "fulfilled") {
    profilesRes.value.forEach((docSnap) => {
      const d = docSnap.data();
      mergeDocUser({
        uid: String(d?.userId || docSnap.id || ""),
        displayName: d?.displayName,
        linkedTikTokHandle: d?.linkedTikTokHandle,
        authProvider: d?.authProvider,
        createdAt: d?.createdAt,
        updatedAt: d?.updatedAt,
        fromProfileCollection: true,
      });
    });
  } else {
    handleFirestoreError(
      profilesRes.reason,
      OperationType.LIST,
      "registeredUsers",
    );
  }

  if (highscoresRes.status === "fulfilled") {
    highscoresRes.value.forEach((docSnap) => {
      const d = docSnap.data();
      if (d?.userId) {
        mergeDocUser({
          uid: String(d.userId),
          displayName: d.displayName,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        });
      }
    });
  } else {
    handleFirestoreError(
      highscoresRes.reason,
      OperationType.LIST,
      "highscores",
    );
  }

  if (leaderboardRes.status === "fulfilled") {
    leaderboardRes.value.forEach((docSnap) => {
      const d = docSnap.data();
      const uid = String(d?.userId || d?.uid || "");
      if (uid) {
        mergeDocUser({
          uid,
          displayName: d.displayName,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        });
      }
    });
  } else {
    handleFirestoreError(
      leaderboardRes.reason,
      OperationType.LIST,
      "leaderboard",
    );
  }

  // Also ensure the currently active Firebase Auth user is represented immediately
  if (auth.currentUser?.uid) {
    const fb = auth.currentUser;
    const isGoogle = fb.providerData?.some(
      (p) => p?.providerId === "google.com",
    );
    mergeDocUser({
      uid: fb.uid,
      displayName: sanitizePublicIdentity(
        fb.displayName || fb.email?.split("@")[0],
        "Player",
      ),
      linkedTikTokHandle: getLinkedTikTokHandle(fb.uid),
      authProvider: isGoogle ? "google" : "email",
      createdAt: fb.metadata?.creationTime || Date.now(),
      updatedAt: fb.metadata?.lastSignInTime || Date.now(),
    });
  }

  return Array.from(byUid.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function fetchRegisteredUsersDirectory(): Promise<
  RegisteredUserRecord[]
> {
  const localList = getRegisteredUsersDirectory();
  if (typeof window === "undefined") return localList;

  try {
    const [serverRes, firestoreUsers] = await Promise.all([
      fetch("/api/admin/registered-users", { cache: "no-store" })
        .then(async (res) => {
          const ct = res.headers.get("content-type") || "";
          if (!res.ok || !ct.includes("application/json")) return [];
          const data = await res.json();
          return Array.isArray(data?.users) ? data.users : [];
        })
        .catch(() => []),
      fetchRegisteredUsersFromFirestore().catch(() => []),
    ]);

    const merged = new Map<string, RegisteredUserRecord>();
    for (const item of localList) {
      merged.set(item.uid, item);
    }

    const upsertCandidate = (rawItem: any) => {
      if (!rawItem || !rawItem.uid) return;
      const uid = String(rawItem.uid).trim();
      if (!uid || uid === "local-guest") return;
      const prev = merged.get(uid);
      const handle =
        normalizeTikTokHandle(rawItem.linkedTikTokHandle) ||
        prev?.linkedTikTokHandle ||
        "";
      const createdAt = Math.min(
        prev?.createdAt || Number.MAX_SAFE_INTEGER,
        Number(rawItem.createdAt) || Date.now(),
      );
      const updatedAt = Math.max(
        prev?.updatedAt || 0,
        Number(rawItem.updatedAt) || Date.now(),
      );
      const incomingName = sanitizePublicIdentity(rawItem.displayName, "Player");
      const prevName = prev?.displayName
        ? sanitizePublicIdentity(prev.displayName, "Player")
        : "";
      const isIncomingGeneric =
        incomingName === "Player" || incomingName === "Puzzle Seeker";
      const chosenName =
        isIncomingGeneric && prevName && prevName !== "Player"
          ? prevName
          : (Number(rawItem.updatedAt) || 0) >= (prev?.updatedAt || 0)
            ? incomingName || prevName || "Player"
            : prevName || incomingName || "Player";

      const candidate: RegisteredUserRecord = {
        uid,
        displayName: chosenName,
        linkedTikTokHandle: handle,
        tiktokConnected: Boolean(handle),
        authProvider:
          rawItem.authProvider === "google" || rawItem.authProvider === "email"
            ? rawItem.authProvider
            : prev?.authProvider ||
              (uid.startsWith("google_") ? "google" : "site"),
        createdAt:
          createdAt === Number.MAX_SAFE_INTEGER ? Date.now() : createdAt,
        updatedAt,
      };
      merged.set(uid, candidate);
    };

    for (const rawItem of serverRes) {
      upsertCandidate(rawItem);
    }
    for (const fbItem of firestoreUsers) {
      upsertCandidate(fbItem);
    }

    const sorted = Array.from(merged.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );

    if (sorted.length > 0) {
      window.localStorage.setItem(
        REGISTERED_USERS_DIRECTORY_KEY,
        JSON.stringify(sorted),
      );
      // Sync newly discovered local/Firestore records back to server directory and missing Firestore entries
      fetch("/api/registered-users/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: sorted }),
      }).catch(() => {});

      if (!isFirestoreWritePaused()) {
        const firestoreByUid = new Map<string, Partial<RegisteredUserRecord>>();
        for (const fbItem of firestoreUsers) {
          if (fbItem?.uid) {
            firestoreByUid.set(fbItem.uid, fbItem);
          }
        }
        for (const item of localList) {
          const existingRemote = firestoreByUid.get(item.uid);
          const needsRemoteSync =
            !existingRemote ||
            (item.linkedTikTokHandle &&
              normalizeTikTokHandle(existingRemote.linkedTikTokHandle) !==
                normalizeTikTokHandle(item.linkedTikTokHandle)) ||
            (item.displayName &&
              item.displayName !== "Player" &&
              existingRemote.displayName !== item.displayName);
          if (needsRemoteSync) {
            void syncFirebaseRegisteredUser(item, false);
          }
        }
      }
    }

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
    const nextPhoto = normalized
      ? getCachedTikTokAvatar(normalized) ||
        `/api/tiktok/avatar/${encodeURIComponent(normalized.replace(/^@+/, ""))}`
      : session.photoURL;
    setActiveSiteSession({
      ...session,
      photoURL: nextPhoto,
      linkedTikTokHandle: normalized || null,
    });
  }

  if (normalized) {
    void downloadAndCacheTikTokAvatar(normalized, true);
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
      crowdle: 0,
      mpsearchint: 0,
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
    const linkedHandle =
      getLinkedTikTokHandle(parsed.uid) ||
      normalizeTikTokHandle(parsed.linkedTikTokHandle) ||
      null;
    const tiktokAvatar = linkedHandle
      ? getCachedTikTokAvatar(linkedHandle) ||
        `/api/tiktok/avatar/${encodeURIComponent(linkedHandle.replace(/^@+/, ""))}`
      : "";
    if (linkedHandle && !getCachedTikTokAvatar(linkedHandle)) {
      void downloadAndCacheTikTokAvatar(linkedHandle);
    }
    return {
      ...parsed,
      displayName: sanitizePublicIdentity(parsed.displayName, "Player"),
      photoURL: tiktokAvatar || parsed.photoURL || null,
      linkedTikTokHandle: linkedHandle,
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
      const linkedHandle =
        getLinkedTikTokHandle(session.uid) ||
        normalizeTikTokHandle(session.linkedTikTokHandle) ||
        null;
      const tiktokAvatar = linkedHandle
        ? getCachedTikTokAvatar(linkedHandle) ||
          `/api/tiktok/avatar/${encodeURIComponent(linkedHandle.replace(/^@+/, ""))}`
        : "";
      window.localStorage.setItem(
        LOCAL_ACTIVE_SESSION_KEY,
        JSON.stringify({
          ...session,
          displayName: sanitizePublicIdentity(session.displayName, "Player"),
          photoURL: tiktokAvatar || session.photoURL || null,
          linkedTikTokHandle: linkedHandle,
        }),
      );
    }
    window.dispatchEvent(new Event("mp-site-auth-updated"));
  } catch {
    // Ignore storage errors
  }
}

function toUnifiedUserFromFirebase(fbUser: User): UnifiedPlayerUser {
  const emailLower = (fbUser.email || "").trim().toLowerCase();
  const pendingMatch =
    pendingRegistrationMeta &&
    emailLower &&
    pendingRegistrationMeta.email === emailLower
      ? pendingRegistrationMeta
      : null;
  const safeName = sanitizePublicIdentity(
    fbUser.displayName ||
      pendingMatch?.displayName ||
      fbUser.email?.split("@")[0],
    "Player",
  );
  const linkedTikTok =
    getLinkedTikTokHandle(fbUser.uid) ||
    pendingMatch?.linkedTikTokHandle ||
    "";
  const tiktokAvatar = linkedTikTok
    ? getCachedTikTokAvatar(linkedTikTok) ||
      `/api/tiktok/avatar/${encodeURIComponent(linkedTikTok.replace(/^@+/, ""))}`
    : "";
  if (linkedTikTok && !getCachedTikTokAvatar(linkedTikTok)) {
    void downloadAndCacheTikTokAvatar(linkedTikTok);
  }
  return {
    uid: fbUser.uid,
    displayName: safeName,
    email:
      fbUser.email?.toLowerCase() === HIDDEN_GMAIL_ADDRESS
        ? null
        : fbUser.email,
    photoURL: tiktokAvatar || fbUser.photoURL,
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
    pendingRegistrationMeta = {
      email: cleanEmail,
      displayName: cleanName,
      linkedTikTokHandle: cleanTikTok,
    };
    const cred = await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      params.password,
    );
    if (cleanTikTok) {
      setLinkedTikTokHandle(cred.user.uid, cleanName, cleanTikTok);
    }
    if (cleanName) {
      await updateProfile(cred.user, { displayName: cleanName });
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
    pendingRegistrationMeta = null;
    return unified;
  } catch (err: unknown) {
    pendingRegistrationMeta = null;
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
    // Proactively sync locally stored registered users once per session
    if (!didInitialLocalDirectorySync) {
      didInitialLocalDirectorySync = true;
      const existingLocalUsers = getRegisteredUsersDirectory();
      if (existingLocalUsers.length > 0) {
        fetch("/api/registered-users/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ users: existingLocalUsers }),
        }).catch(() => {});
        if (!isFirestoreWritePaused()) {
          for (const item of existingLocalUsers) {
            void syncFirebaseRegisteredUser(item, false);
          }
        }
      }
    }

    const syncLocalSession = () => {
      const localSession = getActiveSiteSession();
      if (localSession) {
        recordRegisteredUser({
          uid: localSession.uid,
          displayName: localSession.displayName,
          linkedTikTokHandle: localSession.linkedTikTokHandle,
          authProvider: localSession.uid.startsWith("google_")
            ? "google"
            : "email",
        });
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
        const localSession = getActiveSiteSession();
        if (localSession) {
          recordRegisteredUser({
            uid: localSession.uid,
            displayName: localSession.displayName,
            linkedTikTokHandle: localSession.linkedTikTokHandle,
            authProvider: localSession.uid.startsWith("google_")
              ? "google"
              : "email",
          });
        }
        setUser(localSession);
      }
      setLoading(false);
    });

    window.addEventListener("mp-site-auth-updated", syncLocalSession);
    window.addEventListener("mp-tiktok-link-updated", syncLocalSession);
    window.addEventListener("mp-tiktok-avatar-updated", syncLocalSession);
    window.addEventListener("storage", syncLocalSession);
    return () => {
      unsub();
      window.removeEventListener("mp-site-auth-updated", syncLocalSession);
      window.removeEventListener("mp-tiktok-link-updated", syncLocalSession);
      window.removeEventListener("mp-tiktok-avatar-updated", syncLocalSession);
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
  const photoURL = getUserProfileAvatarUrl(activeUser);
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

  const safeUid = auth.currentUser.uid
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
  const safePuzzleId = String(params.puzzleId || normalizedGameId)
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
  const safeDocId = `${normalizedGameId}_${safeUid}`.slice(0, MAX_ID_LENGTH);

  if (
    !isFirestoreWritePaused() &&
    ID_REGEX.test(safeUid) &&
    ID_REGEX.test(safePuzzleId) &&
    ID_REGEX.test(safeDocId)
  ) {
    const docPath = `leaderboard/${safeDocId}`;
    const docRef = doc(db, "leaderboard", safeDocId);
    try {
      const snap = await getDoc(docRef);
      const safeTitle = String(params.puzzleTitle || meta.title).slice(0, 100);
      const safeMetric = String(metricLabel || meta.metric).slice(0, 60);
      const safeSubMetric = String(params.subMetricLabel || meta.metric).slice(0, 80);
      const safeScore = Math.max(0, Math.min(1000000, Math.round(score)));
      const safeDisplayName = displayName.slice(0, 60) || "Player";
      const firestoreGameId =
        normalizedGameId === "cruciverbalist" ? "crossword" : normalizedGameId;

      if (!snap.exists()) {
        await setDoc(docRef, {
          userId: auth.currentUser.uid,
          displayName: safeDisplayName,
          gameId: firestoreGameId,
          puzzleId: safePuzzleId,
          puzzleTitle: safeTitle,
          score: safeScore,
          metricLabel: safeMetric,
          subMetricLabel: safeSubMetric,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const existingData = snap.data();
        const prevScore =
          typeof existingData?.score === "number" ? existingData.score : 0;
        if (safeScore >= prevScore) {
          await updateDoc(docRef, {
            userId: existingData.userId,
            displayName: safeDisplayName,
            gameId: existingData.gameId,
            puzzleId: existingData.puzzleId,
            puzzleTitle: safeTitle,
            score: safeScore,
            metricLabel: safeMetric,
            subMetricLabel: safeSubMetric,
            createdAt: existingData.createdAt,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      if (isFirestoreQuotaError(err)) {
        markFirestoreQuotaExhausted(err);
      } else {
        handleFirestoreError(err, OperationType.WRITE, docPath);
      }
    }
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
      wikirec: [],
      wikicon: [],
      mpsearch: [],
      mpdifference: [],
      mpcolossal: [],
      cruciverbalist: [],
      crossword: [],
    };
    const mergedMap = new Map<string, UnifiedLeaderboardEntry>();
    for (const item of readLocalLeaderboards()) {
      mergedMap.set(item.id, {
        ...item,
        photoURL: getUserProfileAvatarUrl({ uid: item.uid, photoURL: item.photoURL }),
      });
    }
    for (const item of list) {
      const normalizedId: SoloGameId =
        item.gameId === "crossword" ? "cruciverbalist" : item.gameId;
      const prev = mergedMap.get(item.id);
      const safeItem: UnifiedLeaderboardEntry = {
        ...item,
        gameId: normalizedId,
        displayName: sanitizePublicIdentity(item.displayName, "Player"),
        photoURL: getUserProfileAvatarUrl({
          uid: item.uid,
          photoURL: item.photoURL || prev?.photoURL || "",
        }),
      };
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

  let latestRemote: UnifiedLeaderboardEntry[] = [];
  callback(groupEntries([]));

  const onLocalUpdate = () => {
    callback(groupEntries(latestRemote));
  };
  window.addEventListener("mp-unified-leaderboard-updated", onLocalUpdate);
  window.addEventListener("mp-tiktok-avatar-updated", onLocalUpdate);
  window.addEventListener("mp-tiktok-link-updated", onLocalUpdate);

  let unsubFirestore = () => {};
  try {
    const q = query(
      collection(db, "leaderboard"),
      orderBy("score", "desc"),
      limit(60),
    );
    unsubFirestore = onSnapshot(
      q,
      (snap) => {
        const remote: UnifiedLeaderboardEntry[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.gameId && typeof data.score === "number") {
            const gid =
              data.gameId === "crossword"
                ? "cruciverbalist"
                : (data.gameId as SoloGameId);
            const entryUid = String(data.userId || data.uid || "");
            remote.push({
              id: docSnap.id,
              uid: entryUid,
              displayName: sanitizePublicIdentity(data.displayName, "Player"),
              photoURL: getUserProfileAvatarUrl({ uid: entryUid }),
              gameId: gid,
              gameTitle:
                SOLO_GAME_LABELS[gid]?.title || String(data.puzzleTitle || ""),
              score: data.score,
              metricLabel: String(data.metricLabel || `${data.score} pts`),
              updatedAt: toMillisSafe(data.updatedAt),
            });
          }
        });
        latestRemote = remote;
        callback(groupEntries(remote));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "leaderboard");
        callback(groupEntries(latestRemote));
      },
    );
  } catch {
    callback(groupEntries(latestRemote));
  }

  return () => {
    window.removeEventListener("mp-unified-leaderboard-updated", onLocalUpdate);
    window.removeEventListener("mp-tiktok-avatar-updated", onLocalUpdate);
    window.removeEventListener("mp-tiktok-link-updated", onLocalUpdate);
    unsubFirestore();
  };
}
