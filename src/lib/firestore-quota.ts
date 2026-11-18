const QUOTA_PAUSE_STORAGE_KEY = 'mp_firestore_quota_pause_until_v1';
const QUOTA_COOLDOWN_MS = 30 * 60 * 1000;

let inMemoryQuotaPauseUntil = 0;
let hasLoggedQuotaPauseWarning = false;

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
  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(QUOTA_PAUSE_STORAGE_KEY);
      if (raw) {
        const storedUntil = Number(raw);
        if (Number.isFinite(storedUntil) && storedUntil > now) {
          inMemoryQuotaPauseUntil = storedUntil;
          return true;
        }
        window.sessionStorage.removeItem(QUOTA_PAUSE_STORAGE_KEY);
      }
    } catch {
      // Ignore storage access errors in restricted iframes
    }
  }
  return false;
}

export function markFirestoreQuotaExhausted(_err?: unknown): void {
  const until = Date.now() + QUOTA_COOLDOWN_MS;
  inMemoryQuotaPauseUntil = until;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(QUOTA_PAUSE_STORAGE_KEY, String(until));
    } catch {
      // Ignore storage access errors
    }
  }
  if (!hasLoggedQuotaPauseWarning) {
    hasLoggedQuotaPauseWarning = true;
    console.warn(
      '[Firestore] Daily free-tier quota limit reached; pausing Firestore writes for this session while local/Socket.IO/HTTP sync continues.'
    );
  }
}
