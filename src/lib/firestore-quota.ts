import { disableNetwork } from 'firebase/firestore';
import { db } from '../firebase';

const QUOTA_PAUSE_STORAGE_KEY = 'mp_firestore_quota_pause_until_v2';
const MIN_QUOTA_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours minimum
const FALLBACK_QUOTA_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours fallback
const MAX_QUOTA_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours max

let inMemoryQuotaPauseUntil = 0;
let hasLoggedQuotaPauseWarning = false;
let hasDisabledFirestoreNetwork = false;

/**
 * Computes the next midnight America/Los_Angeles (when Google Cloud Firestore
 * free-tier daily read/write quotas reset), bounded between 2h and 24h from now.
 */
function computeNextDailyQuotaResetMs(): number {
  const now = Date.now();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(now));

    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    const second = Number(parts.find((p) => p.type === 'second')?.value ?? '0');

    const secondsSinceMidnightPt = hour * 3600 + minute * 60 + second;
    const secondsUntilReset = Math.max(60, 86400 - secondsSinceMidnightPt + 300); // +5m buffer past midnight PT
    const delayMs = secondsUntilReset * 1000;
    return now + Math.max(MIN_QUOTA_COOLDOWN_MS, Math.min(MAX_QUOTA_COOLDOWN_MS, delayMs));
  } catch {
    return now + FALLBACK_QUOTA_COOLDOWN_MS;
  }
}

function haltFirestoreBackgroundRetries(): void {
  if (hasDisabledFirestoreNetwork) return;
  hasDisabledFirestoreNetwork = true;
  try {
    // Halts the Firestore SDK's queued write retries so it stops spamming
    // "resource-exhausted" and "Using maximum backoff delay" in the console.
    void disableNetwork(db).catch(() => {
      // Ignore shutdown/disabled errors
    });
  } catch {
    // Ignore if db is not ready
  }
}

function readStoredPauseUntil(): number {
  if (typeof window === 'undefined') return 0;
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      const raw = store.getItem(QUOTA_PAUSE_STORAGE_KEY);
      if (raw) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage errors in restricted iframes
    }
  }
  return 0;
}

function writeStoredPauseUntil(until: number): void {
  if (typeof window === 'undefined') return;
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      store.setItem(QUOTA_PAUSE_STORAGE_KEY, String(until));
    } catch {
      // Ignore storage errors
    }
  }
}

function clearStoredPauseUntil(): void {
  if (typeof window === 'undefined') return;
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      store.removeItem(QUOTA_PAUSE_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

function extractErrorCodeAndMessage(err: unknown): { code: string; message: string } {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code || '').toLowerCase()
      : '';
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message || '')
          : '';
  return { code, message };
}

export function isFirestorePermissionError(err: unknown): boolean {
  const { code, message } = extractErrorCodeAndMessage(err);
  return (
    code === 'permission-denied' ||
    message.includes('Missing or insufficient permissions') ||
    message.includes('permission-denied')
  );
}

export function isFirestoreQuotaError(err: unknown): boolean {
  const { code, message } = extractErrorCodeAndMessage(err);
  const lowerMsg = message.toLowerCase();
  return (
    code === 'resource-exhausted' ||
    lowerMsg.includes('resource-exhausted') ||
    lowerMsg.includes('quota limit exceeded') ||
    lowerMsg.includes('quota exceeded')
  );
}

export function isFirestoreWritePaused(): boolean {
  const now = Date.now();
  if (inMemoryQuotaPauseUntil > now) {
    return true;
  }
  if (inMemoryQuotaPauseUntil > 0 && inMemoryQuotaPauseUntil <= now) {
    inMemoryQuotaPauseUntil = 0;
  }
  const storedUntil = readStoredPauseUntil();
  if (storedUntil > now) {
    inMemoryQuotaPauseUntil = storedUntil;
    haltFirestoreBackgroundRetries();
    return true;
  }
  if (storedUntil > 0 && storedUntil <= now) {
    clearStoredPauseUntil();
  }
  return false;
}

export function markFirestoreQuotaExhausted(_err?: unknown): void {
  const until = computeNextDailyQuotaResetMs();
  inMemoryQuotaPauseUntil = until;
  writeStoredPauseUntil(until);
  haltFirestoreBackgroundRetries();
  if (!hasLoggedQuotaPauseWarning) {
    hasLoggedQuotaPauseWarning = true;
    console.warn(
      '[Firestore] Daily free-tier quota limit reached; pausing Firestore network writes until daily reset while local/Socket.IO/HTTP sync continues.'
    );
  }
}
