import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/firebase';
import {
  isFirestorePermissionError,
  isFirestoreQuotaError,
  isFirestoreWritePaused,
  markFirestoreQuotaExhausted,
} from './firestore-quota';

export type OverlayBackgroundMode = 'transparent' | 'dark';

export interface OverlayConfig {
  isOverlay: boolean;
  bg: OverlayBackgroundMode;
  streamer: string;
  channel: string;
  embed?: boolean;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const OVERLAY_CHANNEL_STORAGE_KEY = 'mp_overlay_channel_v1';
const PUBLIC_STUDIO_ORIGIN_STORAGE_KEY = 'mp_overlay_public_origin_v1';
export const DEFAULT_PUBLIC_STUDIO_ORIGIN = 'https://missingpiecepuzzles.fun';
const OVERLAY_FIRESTORE_COLLECTION = 'overlaySessions';
const ALLOWED_FIRESTORE_GAMES = new Set([
  'crowdle',
  'destackint',
  'mpsearchint',
  'squaredint',
  'wikicon',
  'wikirec',
  'lexi',
]);
const MAX_FIRESTORE_STATE_BYTES = 750_000;

let inMemoryFallbackChannel = '';

function sanitizeChannelToken(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64);
}

function sanitizeStreamerHandle(raw: unknown): string {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 80);
}

function toFirestoreSafeDocSegment(raw: string): string {
  return raw
    .replace(/\./g, '_dot_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80);
}

function buildOverlayFirestoreDocIds(
  gameId: string,
  streamer: string,
  channel: string
): string[] {
  const cleanGame = String(gameId || '').trim().toLowerCase();
  if (!ALLOWED_FIRESTORE_GAMES.has(cleanGame)) return [];
  const ids: string[] = [];
  if (channel) {
    const chId = `${cleanGame}__ch_${toFirestoreSafeDocSegment(channel)}`.slice(0, 128);
    if (/^[a-zA-Z0-9_-]{1,128}$/.test(chId)) {
      ids.push(chId);
    }
  }
  if (streamer) {
    const sId = `${cleanGame}__s_${toFirestoreSafeDocSegment(streamer)}`.slice(0, 128);
    if (/^[a-zA-Z0-9_-]{1,128}$/.test(sId) && !ids.includes(sId)) {
      ids.push(sId);
    }
  }
  if (ids.length === 0) {
    ids.push(`${cleanGame}__default`);
  }
  return ids;
}

/**
 * Converts plain JS objects/arrays into Firestore-native Maps and Lists:
 * - Strips undefined / function / symbol fields
 * - Converts non-finite numbers to null
 * - Wraps nested arrays (`Array<Array<...>>`) in `{ __fsArr: [...] }` so Firestore never rejects 2D boards/pairs
 */
function toFirestoreSafeValue(val: unknown, insideArray = false): unknown {
  if (val === null || typeof val === 'boolean' || typeof val === 'string') {
    return val;
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (val === undefined || typeof val === 'function' || typeof val === 'symbol') {
    return null;
  }
  if (Array.isArray(val)) {
    const mapped = val.map((item) => toFirestoreSafeValue(item, true));
    return insideArray ? { __fsArr: mapped } : mapped;
  }
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') {
        continue;
      }
      out[k] = toFirestoreSafeValue(v, false);
    }
    return out;
  }
  return String(val);
}

function fromFirestoreSafeValue(val: unknown): unknown {
  if (Array.isArray(val)) {
    return val.map((item) => fromFirestoreSafeValue(item));
  }
  if (val && typeof val === 'object') {
    const rec = val as Record<string, unknown>;
    const keys = Object.keys(rec);
    if (keys.length === 1 && keys[0] === '__fsArr' && Array.isArray(rec.__fsArr)) {
      return rec.__fsArr.map((item) => fromFirestoreSafeValue(item));
    }
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      out[k] = fromFirestoreSafeValue(rec[k]);
    }
    return out;
  }
  return val;
}

export function getOrCreateHostOverlayChannel(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = sanitizeChannelToken(
      window.localStorage.getItem(OVERLAY_CHANNEL_STORAGE_KEY)
    );
    if (existing) {
      inMemoryFallbackChannel = existing;
      return existing;
    }
    const generated = `ch_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    window.localStorage.setItem(OVERLAY_CHANNEL_STORAGE_KEY, generated);
    inMemoryFallbackChannel = generated;
    return generated;
  } catch {
    if (!inMemoryFallbackChannel) {
      inMemoryFallbackChannel = `ch_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
    }
    return inMemoryFallbackChannel;
  }
}

export function getOverlayConfigFromLocation(
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '',
  search: string = typeof window !== 'undefined' ? window.location.search : ''
): OverlayConfig {
  const cleanPath = pathname.toLowerCase().replace(/\/+$/, '');
  const params = new URLSearchParams(search);
  const isOverlay =
    cleanPath.endsWith('/overlay') ||
    params.get('overlay') === '1' ||
    params.get('clean') === '1';
  const bgParam = (params.get('bg') || '').toLowerCase();
  const bg: OverlayBackgroundMode = bgParam === 'dark' ? 'dark' : 'transparent';
  const streamer = sanitizeStreamerHandle(params.get('streamer'));
  const channel = sanitizeChannelToken(params.get('channel'));
  const embed = params.get('embed') === '1';
  return { isOverlay, bg, streamer, channel, embed };
}

export function useOverlayConfig(): OverlayConfig {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const search = typeof window !== 'undefined' ? window.location.search : '';

  const config = useMemo(
    () => getOverlayConfigFromLocation(pathname, search),
    [pathname, search]
  );

  useEffect(() => {
    if (!config.isOverlay || typeof document === 'undefined') return;
    if (config.bg === 'transparent') {
      document.documentElement.classList.add('tiktok-live-overlay');
    } else {
      document.documentElement.classList.remove('tiktok-live-overlay');
    }
    return () => {
      document.documentElement.classList.remove('tiktok-live-overlay');
    };
  }, [config.isOverlay, config.bg]);

  return config;
}

export function isAiStudioProxyHost(
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''
): boolean {
  return hostname.startsWith('ais-dev-') || hostname.startsWith('ais-pre-');
}

export function isAiStudioDevHost(): boolean {
  return isAiStudioProxyHost();
}

export function normalizeOriginUrl(raw: unknown): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

export function getPublicStudioOrigin(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_PUBLIC_STUDIO_ORIGIN;
  }
  try {
    const stored = normalizeOriginUrl(
      window.localStorage.getItem(PUBLIC_STUDIO_ORIGIN_STORAGE_KEY)
    );
    if (stored) {
      const host = new URL(stored).hostname;
      if (!isAiStudioProxyHost(host)) {
        return stored;
      }
    }
  } catch {}

  const envUrl = normalizeOriginUrl(
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_PUBLIC_APP_URL
  );
  if (envUrl) {
    try {
      if (!isAiStudioProxyHost(new URL(envUrl).hostname)) {
        return envUrl;
      }
    } catch {}
  }

  if (!isAiStudioProxyHost(window.location.hostname)) {
    return window.location.origin;
  }

  return DEFAULT_PUBLIC_STUDIO_ORIGIN;
}

export function setPublicStudioOrigin(nextOrigin: string): string {
  const normalized = normalizeOriginUrl(nextOrigin);
  if (typeof window !== 'undefined') {
    try {
      if (!normalized) {
        window.localStorage.removeItem(PUBLIC_STUDIO_ORIGIN_STORAGE_KEY);
      } else {
        const host = new URL(normalized).hostname;
        if (!isAiStudioProxyHost(host)) {
          window.localStorage.setItem(PUBLIC_STUDIO_ORIGIN_STORAGE_KEY, normalized);
        }
      }
    } catch {}
  }
  return getPublicStudioOrigin();
}

export function buildLiveOverlayUrl(
  gameSlug: string,
  streamerHandle?: string | null,
  bg: OverlayBackgroundMode = 'transparent',
  options?: {
    preferPublicOrigin?: boolean;
    embed?: boolean;
    publicOriginOverride?: string;
  }
): string {
  let origin = '';
  if (typeof window !== 'undefined') {
    if (options?.preferPublicOrigin) {
      const override = normalizeOriginUrl(options.publicOriginOverride);
      if (override && !isAiStudioProxyHost(new URL(override).hostname)) {
        origin = override;
      } else {
        origin = getPublicStudioOrigin();
      }
    } else {
      origin = window.location.origin;
    }
  }
  const params = new URLSearchParams();
  params.set('bg', bg);
  const channel = getOrCreateHostOverlayChannel();
  if (channel) {
    params.set('channel', channel);
  }
  const clean = sanitizeStreamerHandle(streamerHandle);
  if (clean) {
    params.set('streamer', clean);
  }
  if (options?.embed) {
    params.set('embed', '1');
  }
  return `${origin}/interactive-games/${gameSlug}/overlay?${params.toString()}`;
}

function computeFastStateHash(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + ((i & 255) << 1);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${str.length}:${(h1 >>> 0).toString(36)}_${(h2 >>> 0).toString(36)}`;
}

const VOLATILE_OVERLAY_TIMER_KEYS = new Set([
  'timeLeft',
  'delayLeft',
  'resetTimeLeft',
  'autoNextCountdown',
  'elapsedSeconds',
  'timerRemaining',
  'remainingSeconds',
  'secondsLeft',
  'countdown',
  'countdownSeconds',
  'timeRemaining',
  'roundTimerSeconds',
]);

function stripVolatileOverlayTimerFields(val: unknown, depth = 0): unknown {
  if (val === null || typeof val !== 'object' || depth > 2) {
    return val;
  }
  if (Array.isArray(val)) {
    return val;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (VOLATILE_OVERLAY_TIMER_KEYS.has(k)) continue;
    out[k] = depth < 2 ? stripVolatileOverlayTimerFields(v, depth + 1) : v;
  }
  return out;
}

function computeSemanticOverlayHash(state: unknown): string {
  try {
    const stripped = stripVolatileOverlayTimerFields(state, 0);
    return computeFastStateHash(JSON.stringify(stripped) || '');
  } catch {
    return '';
  }
}

interface UseOverlaySyncOptions<T> {
  gameId: string;
  streamer?: string | null;
  channel?: string | null;
  isOverlay: boolean;
  localState: T | null;
  onSyncedState: (state: T) => void;
}

interface OverlaySyncPacket<T> {
  type?: string;
  gameId?: string;
  state?: T;
  streamer?: string;
  channel?: string;
  hostSessionId?: string;
  seq?: number;
  stateHash?: string;
  serverVersion?: number;
  bootId?: string;
  unchanged?: boolean;
  updatedAt?: number;
}

/**
 * Syncs live host game state to TikTok LIVE Studio Browser Source overlays across same-origin AND cross-origin environments:
 * 1) Same-origin BroadcastChannel & deferred localStorage (instant preview tabs)
 * 2) Socket.IO overlay room relay (real-time push on same origin/instance)
 * 3) Version-checked HTTP REST /api/overlay/state fallback
 * 4) Firebase Firestore real-time onSnapshot relay (`overlaySessions/{sessionKey}`) for cross-origin / multi-instance Cloud Run sync
 */
export function useOverlaySync<T>({
  gameId,
  streamer,
  channel,
  isOverlay,
  localState,
  onSyncedState,
}: UseOverlaySyncOptions<T>): { isReceivingHostSync: boolean } {
  const [isReceivingHostSync, setIsReceivingHostSync] = useState(false);
  const hasReceivingSyncRef = useRef<boolean>(false);
  const cleanGameId = String(gameId || '').trim().toLowerCase();
  const cleanStreamer = sanitizeStreamerHandle(streamer);

  const locationChannel =
    typeof window !== 'undefined'
      ? sanitizeChannelToken(new URLSearchParams(window.location.search).get('channel'))
      : '';

  const resolvedChannel = useMemo(() => {
    const explicit = sanitizeChannelToken(channel);
    if (explicit) return explicit;
    if (isOverlay) return locationChannel;
    return getOrCreateHostOverlayChannel();
  }, [channel, isOverlay, locationChannel]);

  const localStateRef = useRef<T | null>(localState);
  localStateRef.current = localState;

  const onSyncedRef = useRef(onSyncedState);
  onSyncedRef.current = onSyncedState;

  const socketRef = useRef<Socket | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastEmitAtRef = useRef<number>(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const httpTrailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localStorageTrailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firestoreTrailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastTransmittedJsonRef = useRef<string>('');
  const lastTransmittedHashRef = useRef<string>('');
  const latestPreparedRef = useRef<{
    state: T;
    json: string;
    hash: string;
  } | null>(null);
  const lastPacketRef = useRef<OverlaySyncPacket<T> | null>(null);
  const lastSerializedPacketRef = useRef<string>('');

  const lastHttpPostAtRef = useRef<number>(0);
  const httpCooldownUntilRef = useRef<number>(0);
  const httpBackoffMsRef = useRef<number>(0);
  const lastDirectSyncAtRef = useRef<number>(0);
  const lastLocalStorageAtRef = useRef<number>(0);
  const lastFirestoreWriteAtRef = useRef<number>(0);
  const lastFirestoreSuccessAtRef = useRef<number>(0);
  const lastFirestoreSentHashRef = useRef<string>('');
  const lastFirestoreSentSemanticHashRef = useRef<string>('');
  const lastSecondaryAliasWriteAtRef = useRef<number>(0);
  const fsCooldownUntilRef = useRef<number>(0);
  const fsBackoffMsRef = useRef<number>(0);
  const hostSessionIdRef = useRef<string>(
    `host_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  );
  const seqRef = useRef<number>(0);

  // Coalesced single-flight HTTP & Firestore write state
  const postInFlightRef = useRef<boolean>(false);
  const postStartedAtRef = useRef<number>(0);
  const queuedPostBodyRef = useRef<{ body: string; seq: number } | null>(null);
  const lastHttpConfirmedSeqRef = useRef<number>(0);

  const fsInFlightRef = useRef<boolean>(false);
  const fsStartedAtRef = useRef<number>(0);
  const fsQueuedPacketRef = useRef<OverlaySyncPacket<T> | null>(null);

  const isMountedRef = useRef<boolean>(true);

  const lastRemoteMetaRef = useRef<{
    hostSessionId: string;
    seq: number;
    serverVersion: number;
    bootId: string;
    stateHash: string;
    channel: string;
    updatedAt: number;
    hasDelivered: boolean;
    source: 'local' | 'network';
  } | null>(null);

  const roomScope = resolvedChannel || cleanStreamer || 'default';
  const storageKey = `mp_overlay_snap_${cleanGameId}_${roomScope}`;

  const clearPendingFirestorePush = () => {
    if (firestoreTrailingTimerRef.current) {
      clearTimeout(firestoreTrailingTimerRef.current);
      firestoreTrailingTimerRef.current = null;
    }
    fsQueuedPacketRef.current = null;
  };

  const flushFirestoreWrite = (packet: OverlaySyncPacket<T>) => {
    if (isOverlay || !isMountedRef.current || !packet || packet.state === undefined) {
      return;
    }
    if (!ALLOWED_FIRESTORE_GAMES.has(cleanGameId)) return;
    if (isFirestoreWritePaused()) {
      clearPendingFirestorePush();
      return;
    }

    const docIds = buildOverlayFirestoreDocIds(
      cleanGameId,
      cleanStreamer,
      resolvedChannel
    );
    if (docIds.length === 0) return;

    const now = Date.now();
    if (now < fsCooldownUntilRef.current) {
      return;
    }
    if (fsInFlightRef.current && now - fsStartedAtRef.current < 25000) {
      fsQueuedPacketRef.current = packet;
      return;
    }

    const sendNextFirestore = (pktToSend: OverlaySyncPacket<T>) => {
      if (
        !isMountedRef.current ||
        isOverlay ||
        pktToSend.state === undefined ||
        isFirestoreWritePaused() ||
        Date.now() < fsCooldownUntilRef.current
      ) {
        fsInFlightRef.current = false;
        clearPendingFirestorePush();
        return;
      }
      const pktHash = (pktToSend.stateHash || '').slice(0, 64);
      if (
        pktHash &&
        pktHash === lastFirestoreSentHashRef.current &&
        lastFirestoreSuccessAtRef.current > 0
      ) {
        fsInFlightRef.current = false;
        return;
      }

      const semanticHash = computeSemanticOverlayHash(pktToSend.state);
      const semanticChanged =
        !lastFirestoreSentSemanticHashRef.current ||
        semanticHash !== lastFirestoreSentSemanticHashRef.current;

      const safeState = toFirestoreSafeValue(pktToSend.state, false);
      if (
        !safeState ||
        typeof safeState !== 'object' ||
        Array.isArray(safeState)
      ) {
        fsInFlightRef.current = false;
        return;
      }
      const topKeys = Object.keys(safeState as Record<string, unknown>);
      if (topKeys.length === 0 || topKeys.length > 100) {
        fsInFlightRef.current = false;
        return;
      }
      let safeJsonSize = 0;
      try {
        safeJsonSize = JSON.stringify(safeState).length;
      } catch {
        fsInFlightRef.current = false;
        return;
      }
      if (safeJsonSize <= 0 || safeJsonSize > MAX_FIRESTORE_STATE_BYTES) {
        fsInFlightRef.current = false;
        return;
      }

      const safeSeq = Math.max(
        1,
        Math.min(100_000_000, Math.floor(Number(pktToSend.seq) || 1))
      );
      const safeHostSessionId = String(
        pktToSend.hostSessionId || hostSessionIdRef.current
      )
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 64);

      const fsPayload = {
        gameId: cleanGameId,
        channel: resolvedChannel,
        streamer: cleanStreamer.slice(0, 80),
        hostSessionId: safeHostSessionId || 'host_default',
        seq: safeSeq,
        stateHash: pktHash || `${safeJsonSize}:0_0`,
        state: safeState,
        updatedAt: serverTimestamp(),
      };

      // Write primary doc always; only refresh secondary streamer alias doc on initial write or >=60s after semantic change
      const startedAt = Date.now();
      const shouldIncludeAliasDoc =
        docIds.length > 1 &&
        (lastSecondaryAliasWriteAtRef.current === 0 ||
          (semanticChanged && startedAt - lastSecondaryAliasWriteAtRef.current >= 60_000));
      const targetDocIds = shouldIncludeAliasDoc ? docIds : [docIds[0]];

      fsInFlightRef.current = true;
      fsStartedAtRef.current = startedAt;
      lastFirestoreWriteAtRef.current = startedAt;

      Promise.all(
        targetDocIds.map((id) =>
          setDoc(doc(db, OVERLAY_FIRESTORE_COLLECTION, id), fsPayload).catch(
            (err) => {
              if (isFirestorePermissionError(err)) {
                handleFirestoreError(
                  err,
                  OperationType.WRITE,
                  `${OVERLAY_FIRESTORE_COLLECTION}/${id}`
                );
              }
              throw err;
            }
          )
        )
      )
        .then(() => {
          const completedAt = Date.now();
          fsBackoffMsRef.current = 0;
          fsCooldownUntilRef.current = 0;
          lastFirestoreSuccessAtRef.current = completedAt;
          if (pktHash) {
            lastFirestoreSentHashRef.current = pktHash;
          }
          if (semanticHash) {
            lastFirestoreSentSemanticHashRef.current = semanticHash;
          }
          if (targetDocIds.length > 1) {
            lastSecondaryAliasWriteAtRef.current = completedAt;
          }
        })
        .catch((err) => {
          if (isFirestoreQuotaError(err)) {
            markFirestoreQuotaExhausted(err);
            clearPendingFirestorePush();
            return;
          }
          const nextBackoff =
            fsBackoffMsRef.current > 0
              ? Math.min(120_000, fsBackoffMsRef.current * 2)
              : 15_000;
          fsBackoffMsRef.current = nextBackoff;
          fsCooldownUntilRef.current = Date.now() + nextBackoff;
        })
        .finally(() => {
          fsInFlightRef.current = false;
          const queued = fsQueuedPacketRef.current;
          fsQueuedPacketRef.current = null;
          if (
            queued &&
            isMountedRef.current &&
            !isOverlay &&
            !isFirestoreWritePaused() &&
            Date.now() >= fsCooldownUntilRef.current
          ) {
            const qSemanticHash = computeSemanticOverlayHash(queued.state);
            const qSemanticChanged =
              !lastFirestoreSentSemanticHashRef.current ||
              qSemanticHash !== lastFirestoreSentSemanticHashRef.current;
            if (qSemanticChanged) {
              sendNextFirestore(queued);
            }
          }
        });
    };

    sendNextFirestore(packet);
  };

  const scheduleFirestorePush = (packet: OverlaySyncPacket<T>, forceNow = false) => {
    if (isOverlay || !isMountedRef.current || packet.state === undefined) return;
    if (!ALLOWED_FIRESTORE_GAMES.has(cleanGameId)) return;
    if (isFirestoreWritePaused()) {
      clearPendingFirestorePush();
      return;
    }

    const pktHash = packet.stateHash || '';
    if (
      pktHash &&
      pktHash === lastFirestoreSentHashRef.current &&
      lastFirestoreSuccessAtRef.current > 0
    ) {
      return;
    }

    const nowMs = Date.now();
    if (nowMs < fsCooldownUntilRef.current) {
      return;
    }

    const semanticHash = computeSemanticOverlayHash(packet.state);
    const semanticChanged =
      !lastFirestoreSentSemanticHashRef.current ||
      semanticHash !== lastFirestoreSentSemanticHashRef.current;

    // If only countdown/elapsed timers ticked while the tab is hidden, skip Firestore writes
    if (
      !forceNow &&
      !semanticChanged &&
      lastFirestoreSuccessAtRef.current > 0 &&
      typeof document !== 'undefined' &&
      document.hidden
    ) {
      return;
    }

    // Coalesce real gameplay changes at >=3s and routine timer-only updates at >=30s
    const minIntervalMs = semanticChanged ? 3000 : 30_000;
    if (
      (forceNow && semanticChanged) ||
      lastFirestoreWriteAtRef.current === 0 ||
      nowMs - lastFirestoreWriteAtRef.current >= minIntervalMs
    ) {
      if (firestoreTrailingTimerRef.current) {
        clearTimeout(firestoreTrailingTimerRef.current);
        firestoreTrailingTimerRef.current = null;
      }
      flushFirestoreWrite(packet);
    } else if (!firestoreTrailingTimerRef.current) {
      const waitMs = Math.max(
        500,
        minIntervalMs - (nowMs - lastFirestoreWriteAtRef.current) + 50
      );
      firestoreTrailingTimerRef.current = setTimeout(() => {
        firestoreTrailingTimerRef.current = null;
        if (
          lastPacketRef.current &&
          isMountedRef.current &&
          !isOverlay &&
          !isFirestoreWritePaused()
        ) {
          flushFirestoreWrite(lastPacketRef.current);
        }
      }, waitMs);
    }
  };

  const recordHttpFailureBackoff = (status: number) => {
    if (
      status === 401 ||
      status === 403 ||
      status === 426 ||
      status === 429 ||
      status >= 500
    ) {
      const nextBackoff =
        httpBackoffMsRef.current > 0
          ? Math.min(120000, httpBackoffMsRef.current * 2)
          : 20000;
      httpBackoffMsRef.current = nextBackoff;
      httpCooldownUntilRef.current = Date.now() + nextBackoff;
    }
  };

  const resetHttpBackoff = () => {
    httpBackoffMsRef.current = 0;
    httpCooldownUntilRef.current = 0;
  };

  const flushHttpPost = (serializedBody: string, packetSeq = 0) => {
    if (isOverlay || !isMountedRef.current || !serializedBody) return;

    const now = Date.now();
    if (now < httpCooldownUntilRef.current) {
      queuedPostBodyRef.current = { body: serializedBody, seq: packetSeq };
      return;
    }
    // Recover from a stalled fetch older than 4.5s
    if (postInFlightRef.current && now - postStartedAtRef.current < 4500) {
      queuedPostBodyRef.current = { body: serializedBody, seq: packetSeq };
      return;
    }

    const sendNext = (bodyToSend: string, seqToSend: number) => {
      if (!isMountedRef.current || isOverlay) {
        postInFlightRef.current = false;
        return;
      }
      if (Date.now() < httpCooldownUntilRef.current) {
        postInFlightRef.current = false;
        queuedPostBodyRef.current = { body: bodyToSend, seq: seqToSend };
        return;
      }
      postInFlightRef.current = true;
      postStartedAtRef.current = Date.now();
      lastHttpPostAtRef.current = postStartedAtRef.current;

      const controller =
        typeof AbortController !== 'undefined' ? new AbortController() : null;
      const abortTimer = controller
        ? setTimeout(() => controller.abort(), 4000)
        : null;

      fetch('/api/overlay/state', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: bodyToSend,
        signal: controller?.signal,
      })
        .then((res) => {
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            resetHttpBackoff();
            if (seqToSend > lastHttpConfirmedSeqRef.current) {
              lastHttpConfirmedSeqRef.current = seqToSend;
            }
          } else if (res.ok) {
            recordHttpFailureBackoff(403);
          } else {
            recordHttpFailureBackoff(res.status);
          }
        })
        .catch(() => {
          // Ignore transient network errors; keepalive/change will retry
        })
        .finally(() => {
          if (abortTimer) clearTimeout(abortTimer);
          postInFlightRef.current = false;
          const queued = queuedPostBodyRef.current;
          queuedPostBodyRef.current = null;
          if (
            queued &&
            isMountedRef.current &&
            !isOverlay &&
            Date.now() >= httpCooldownUntilRef.current
          ) {
            sendNext(queued.body, queued.seq);
          }
        });
    };

    sendNext(serializedBody, packetSeq);
  };

  const writeLocalStorageDeferred = (serializedBody: string, immediate = false) => {
    if (typeof window === 'undefined' || isOverlay || !serializedBody) return;
    const performWrite = () => {
      if (!isMountedRef.current || isOverlay) return;
      lastLocalStorageAtRef.current = Date.now();
      try {
        window.localStorage.setItem(storageKey, serializedBody);
      } catch {
        // Ignore storage quota errors
      }
    };
    if (immediate) {
      performWrite();
      return;
    }
    setTimeout(performWrite, 0);
  };

  const buildSerializedFromStateJson = (
    packetMeta: {
      seq: number;
      stateHash: string;
      updatedAt: number;
    },
    stateJson: string
  ) => {
    const headerJson = JSON.stringify({
      type: 'state-sync',
      gameId: cleanGameId,
      streamer: cleanStreamer,
      channel: resolvedChannel,
      hostSessionId: hostSessionIdRef.current,
      seq: packetMeta.seq,
      stateHash: packetMeta.stateHash,
      updatedAt: packetMeta.updatedAt,
    });
    return `${headerJson.slice(0, -1)},"state":${stateJson}}`;
  };

  useEffect(() => {
    isMountedRef.current = true;
    // Reset cached state when room scope changes
    lastTransmittedJsonRef.current = '';
    lastTransmittedHashRef.current = '';
    latestPreparedRef.current = null;
    lastPacketRef.current = null;
    lastSerializedPacketRef.current = '';
    lastHttpPostAtRef.current = 0;
    httpCooldownUntilRef.current = 0;
    httpBackoffMsRef.current = 0;
    lastDirectSyncAtRef.current = 0;
    lastLocalStorageAtRef.current = 0;
    lastFirestoreWriteAtRef.current = 0;
    lastFirestoreSuccessAtRef.current = 0;
    lastFirestoreSentHashRef.current = '';
    lastFirestoreSentSemanticHashRef.current = '';
    lastSecondaryAliasWriteAtRef.current = 0;
    fsCooldownUntilRef.current = 0;
    fsBackoffMsRef.current = 0;
    lastHttpConfirmedSeqRef.current = 0;
    if (isOverlay) {
      lastRemoteMetaRef.current = null;
    }

    const bcName = `mp_overlay_${cleanGameId}`;
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(bcName);
        channelRef.current = bc;
      } catch {
        bc = null;
      }
    }

    const isEmbedPreview =
      isOverlay &&
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('embed') === '1';

    const socket = isEmbedPreview
      ? null
      : io({
          path: '/socket.io',
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 3500,
          reconnectionDelayMax: 30000,
          randomizationFactor: 0.5,
          timeout: 8000,
          query: { gameId: `${cleanGameId}-overlay` },
        });
    socketRef.current = socket;

    const buildFreshPacketAndSerialized = (stateObj: T) => {
      let stateJson = '';
      let stateHash = '';
      if (latestPreparedRef.current && latestPreparedRef.current.state === stateObj) {
        stateJson = latestPreparedRef.current.json;
        stateHash = latestPreparedRef.current.hash;
      } else {
        stateJson = JSON.stringify(stateObj);
        stateHash = computeFastStateHash(stateJson);
        latestPreparedRef.current = { state: stateObj, json: stateJson, hash: stateHash };
      }

      const seq = ++seqRef.current;
      const updatedAt = Date.now();
      const packet: OverlaySyncPacket<T> = {
        type: 'state-sync',
        gameId: cleanGameId,
        streamer: cleanStreamer,
        channel: resolvedChannel,
        state: stateObj,
        hostSessionId: hostSessionIdRef.current,
        seq,
        stateHash,
        updatedAt,
      };
      const serialized = buildSerializedFromStateJson(
        { seq, stateHash, updatedAt },
        stateJson
      );
      lastTransmittedJsonRef.current = stateJson;
      lastTransmittedHashRef.current = stateHash;
      lastPacketRef.current = packet;
      lastSerializedPacketRef.current = serialized;
      return { packet, serialized };
    };

    const pushHostSnapshotNow = (
      forceNetwork = true,
      overrideState?: T,
      allowReuseCached = false
    ) => {
      if (isOverlay || !isMountedRef.current) return;
      const stateToSend =
        overrideState !== undefined ? overrideState : localStateRef.current;
      if (stateToSend === null) return;

      let packet: OverlaySyncPacket<T>;
      let serialized: string;

      if (
        allowReuseCached &&
        overrideState === undefined &&
        lastPacketRef.current &&
        lastSerializedPacketRef.current
      ) {
        packet = lastPacketRef.current;
        serialized = lastSerializedPacketRef.current;
      } else {
        const built = buildFreshPacketAndSerialized(stateToSend);
        packet = built.packet;
        serialized = built.serialized;
      }

      lastEmitAtRef.current = performance.now();

      if (bc) {
        try {
          bc.postMessage(packet);
        } catch {}
      }

      const nowMs = Date.now();
      if (nowMs - lastLocalStorageAtRef.current >= 3500) {
        if (localStorageTrailingTimerRef.current) {
          clearTimeout(localStorageTrailingTimerRef.current);
          localStorageTrailingTimerRef.current = null;
        }
        writeLocalStorageDeferred(serialized);
      } else if (!localStorageTrailingTimerRef.current) {
        localStorageTrailingTimerRef.current = setTimeout(() => {
          localStorageTrailingTimerRef.current = null;
          if (lastSerializedPacketRef.current) {
            writeLocalStorageDeferred(lastSerializedPacketRef.current);
          }
        }, 2000);
      }

      if (forceNetwork) {
        const pktSeq = packet.seq || 0;
        const sockConnected = Boolean(socket && socket.connected);
        const minHttpIntervalMs = sockConnected ? 3000 : 1800;
        if (socket && sockConnected) {
          socket.emit('overlay-state-update', packet);
        }
        if (
          lastHttpPostAtRef.current === 0 ||
          nowMs - lastHttpPostAtRef.current >= minHttpIntervalMs
        ) {
          if (httpTrailingTimerRef.current) {
            clearTimeout(httpTrailingTimerRef.current);
            httpTrailingTimerRef.current = null;
          }
          flushHttpPost(serialized, pktSeq);
        } else if (!httpTrailingTimerRef.current) {
          const waitMs = Math.max(
            400,
            minHttpIntervalMs - (nowMs - lastHttpPostAtRef.current) + 50
          );
          httpTrailingTimerRef.current = setTimeout(() => {
            httpTrailingTimerRef.current = null;
            if (lastSerializedPacketRef.current) {
              flushHttpPost(
                lastSerializedPacketRef.current,
                lastPacketRef.current?.seq || 0
              );
            }
          }, waitMs);
        }

        // Cross-origin Firestore sync (immediately if first write or idle, coalesced otherwise)
        scheduleFirestorePush(packet, lastFirestoreSuccessAtRef.current === 0);
      }
    };

    const packetMatchesOverlayScope = (packet: OverlaySyncPacket<T>) => {
      const pktChannel = sanitizeChannelToken(packet.channel);
      const pktStreamer = sanitizeStreamerHandle(packet.streamer);
      if (cleanStreamer && pktStreamer && pktStreamer === cleanStreamer) {
        return true;
      }
      if (resolvedChannel && pktChannel && pktChannel !== resolvedChannel) {
        return false;
      }
      if (!resolvedChannel && cleanStreamer && pktStreamer && pktStreamer !== cleanStreamer) {
        return false;
      }
      return true;
    };

    const acceptRemotePacket = (
      packet: OverlaySyncPacket<T> | null | undefined,
      source: 'local' | 'network'
    ) => {
      if (!packet) return;
      if (packet.unchanged || packet.state === undefined) return;
      if (!packetMatchesOverlayScope(packet)) return;

      const prev = lastRemoteMetaRef.current;
      const pktSession =
        typeof packet.hostSessionId === 'string' ? packet.hostSessionId : '';
      const pktSeq = typeof packet.seq === 'number' ? packet.seq : 0;
      const pktServerVer =
        typeof packet.serverVersion === 'number' ? packet.serverVersion : -1;
      const prevBootId = prev?.bootId || '';
      const pktBootId =
        typeof packet.bootId === 'string' && packet.bootId
          ? packet.bootId
          : prevBootId;
      const sameBoot = !prevBootId || !pktBootId || pktBootId === prevBootId;
      const pktHash = typeof packet.stateHash === 'string' ? packet.stateHash : '';
      const pktChannel = sanitizeChannelToken(packet.channel);
      const pktUpdatedAt =
        typeof packet.updatedAt === 'number' && Number.isFinite(packet.updatedAt)
          ? packet.updatedAt
          : 0;

      if (prev) {
        if (pktSession && pktSession === prev.hostSessionId) {
          if (pktSeq <= prev.seq) {
            if (pktServerVer >= 0) {
              prev.serverVersion = sameBoot
                ? Math.max(prev.serverVersion, pktServerVer)
                : pktServerVer;
            }
            if (pktBootId) {
              prev.bootId = pktBootId;
            }
            return;
          }
        } else {
          if (source === 'local' && prev.source === 'network' && !pktSession) {
            return;
          }
          // When resolvedChannel is paired, reject older packets arriving from a stale streamer fallback doc
          if (
            resolvedChannel &&
            prev.channel === resolvedChannel &&
            pktChannel !== resolvedChannel &&
            prev.updatedAt > 0 &&
            (pktUpdatedAt === 0 || pktUpdatedAt <= prev.updatedAt + 2000)
          ) {
            return;
          }
          // Protect live session from noticeably older cross-session Firestore/cache snapshots
          if (
            pktUpdatedAt > 0 &&
            prev.updatedAt > 0 &&
            pktUpdatedAt + 2000 < prev.updatedAt
          ) {
            return;
          }
        }

        // Skip React re-renders if an on-demand resend or reconnect delivers identical state bytes
        if (pktHash && prev.stateHash && pktHash === prev.stateHash && prev.hasDelivered) {
          const nextServerVer =
            pktServerVer >= 0
              ? sameBoot
                ? Math.max(prev.serverVersion, pktServerVer)
                : pktServerVer
              : sameBoot
                ? prev.serverVersion
                : -1;
          lastRemoteMetaRef.current = {
            hostSessionId: pktSession || prev.hostSessionId,
            seq: pktSession === prev.hostSessionId ? Math.max(prev.seq, pktSeq) : pktSeq,
            serverVersion: nextServerVer,
            bootId: pktBootId,
            stateHash: pktHash,
            channel: pktChannel || prev.channel,
            updatedAt: Math.max(prev.updatedAt, pktUpdatedAt),
            hasDelivered: true,
            source,
          };
          return;
        }
      }

      const resolvedServerVer =
        pktServerVer >= 0
          ? pktServerVer
          : sameBoot
            ? prev?.serverVersion ?? -1
            : -1;

      lastRemoteMetaRef.current = {
        hostSessionId: pktSession || prev?.hostSessionId || '',
        seq: pktSeq,
        serverVersion: resolvedServerVer,
        bootId: pktBootId,
        stateHash: pktHash,
        channel: pktChannel || prev?.channel || '',
        updatedAt: pktUpdatedAt || Date.now(),
        hasDelivered: true,
        source,
      };
      if (source === 'network') {
        lastDirectSyncAtRef.current = Date.now();
      }

      if (!hasReceivingSyncRef.current) {
        hasReceivingSyncRef.current = true;
        setIsReceivingHostSync(true);
      }
      onSyncedRef.current(packet.state);
    };

    if (isOverlay) {
      // 1) Read immediate same-origin localStorage snapshot if present
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw) as OverlaySyncPacket<T>;
            acceptRemotePacket(parsed, 'local');
          }
        } catch {}
      }

      // 2) Listen for cross-tab localStorage updates
      const handleStorage = (ev: StorageEvent) => {
        if (ev.key !== storageKey || !ev.newValue) return;
        try {
          const parsed = JSON.parse(ev.newValue) as OverlaySyncPacket<T>;
          acceptRemotePacket(parsed, 'local');
        } catch {}
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorage);
      }

      // 3) Socket.IO overlay room subscription (skipped for embedded multiview wall previews)
      const joinOverlayRoom = () => {
        if (socket && socket.connected) {
          socket.emit('join-overlay', {
            gameId: cleanGameId,
            streamer: cleanStreamer,
            channel: resolvedChannel,
          });
        }
      };
      joinOverlayRoom();

      // 4) Firebase Firestore real-time overlay subscription (bridges ais-dev <-> ais-pre <-> Hostinger <-> Cloud Run instances)
      const firestoreUnsubs: Array<() => void> = [];
      const fsDocIds = buildOverlayFirestoreDocIds(
        cleanGameId,
        cleanStreamer,
        resolvedChannel
      );
      for (const fsDocId of fsDocIds) {
        const fsDocPath = `${OVERLAY_FIRESTORE_COLLECTION}/${fsDocId}`;
        try {
          const unsub = onSnapshot(
            doc(db, OVERLAY_FIRESTORE_COLLECTION, fsDocId),
            (snap) => {
              if (!isMountedRef.current || !snap.exists()) return;
              const data = snap.data() as Record<string, unknown> | undefined;
              if (!data || data.gameId !== cleanGameId || !data.state) return;

              const rawUpdated = data.updatedAt;
              let updatedAtMs = Date.now();
              if (rawUpdated instanceof Timestamp) {
                updatedAtMs = rawUpdated.toMillis();
              } else if (
                rawUpdated &&
                typeof (rawUpdated as { toMillis?: () => number }).toMillis === 'function'
              ) {
                updatedAtMs = (rawUpdated as { toMillis: () => number }).toMillis();
              } else if (typeof rawUpdated === 'number') {
                updatedAtMs = rawUpdated;
              }

              const unwrappedState = fromFirestoreSafeValue(data.state) as T;
              acceptRemotePacket(
                {
                  type: 'state-sync',
                  gameId: String(data.gameId || cleanGameId),
                  channel: typeof data.channel === 'string' ? data.channel : '',
                  streamer: typeof data.streamer === 'string' ? data.streamer : '',
                  hostSessionId:
                    typeof data.hostSessionId === 'string' ? data.hostSessionId : '',
                  seq: typeof data.seq === 'number' ? data.seq : 0,
                  stateHash:
                    typeof data.stateHash === 'string' ? data.stateHash : '',
                  state: unwrappedState,
                  updatedAt: updatedAtMs,
                },
                'network'
              );
            },
            (err) => {
              if (isFirestorePermissionError(err)) {
                handleFirestoreError(err, OperationType.GET, fsDocPath);
              }
            }
          );
          firestoreUnsubs.push(unsub);
        } catch (err) {
          if (isFirestorePermissionError(err)) {
            handleFirestoreError(err, OperationType.GET, fsDocPath);
          }
        }
      }

      // 5) Version-checked HTTP /api/overlay/state gentle fallback polling (Firestore + Socket.IO handle real-time)
      let isCancelled = false;
      let pollInFlight = false;
      let pollStartedAt = 0;

      const pollHttpSnapshot = async (force = false) => {
        if (isEmbedPreview) return;
        const now = Date.now();
        if (isCancelled) return;
        if (now < httpCooldownUntilRef.current) return;
        if (
          typeof document !== 'undefined' &&
          document.hidden &&
          lastDirectSyncAtRef.current > 0
        ) {
          return;
        }
        if (
          !force &&
          now - lastDirectSyncAtRef.current < 15000 &&
          Boolean(socket?.connected)
        ) {
          return;
        }
        if (pollInFlight && now - pollStartedAt < 4500) return;
        pollInFlight = true;
        pollStartedAt = now;

        const controller =
          typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller
          ? setTimeout(() => controller.abort(), 3500)
          : null;
        try {
          const qs = new URLSearchParams({
            gameId: cleanGameId,
            _t: String(now),
          });
          if (resolvedChannel) qs.set('channel', resolvedChannel);
          if (cleanStreamer) qs.set('streamer', cleanStreamer);
          const meta = lastRemoteMetaRef.current;
          if (meta && meta.serverVersion > 0) {
            qs.set('afterVersion', String(meta.serverVersion));
            if (meta.bootId) {
              qs.set('afterBootId', meta.bootId);
            }
          }

          const res = await fetch(`/api/overlay/state?${qs.toString()}`, {
            cache: 'no-store',
            signal: controller?.signal,
          });
          if (!res.ok || isCancelled) {
            if (!isCancelled) {
              recordHttpFailureBackoff(res.status);
            }
            return;
          }
          const contentType = res.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            if (!isCancelled) {
              recordHttpFailureBackoff(403);
            }
            return;
          }
          resetHttpBackoff();
          const data = (await res.json()) as OverlaySyncPacket<T> & {
            hasSnapshot?: boolean;
          };
          if (data && data.hasSnapshot) {
            if (data.unchanged) {
              if (lastRemoteMetaRef.current && typeof data.serverVersion === 'number') {
                lastRemoteMetaRef.current.serverVersion = Math.max(
                  lastRemoteMetaRef.current.serverVersion,
                  data.serverVersion
                );
                if (typeof data.bootId === 'string') {
                  lastRemoteMetaRef.current.bootId = data.bootId;
                }
              }
            } else if (data.state !== undefined) {
              acceptRemotePacket(data, 'network');
            }
          }
        } catch {
          // Ignore transient abort / network errors
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
          pollInFlight = false;
        }
      };

      if (socket) {
        socket.on('connect', () => {
          joinOverlayRoom();
          if (bc) {
            try {
              bc.postMessage({
                type: 'request-state',
                streamer: cleanStreamer,
                channel: resolvedChannel,
              });
            } catch {}
          }
        });

        socket.on('overlay-state-sync', (packet: OverlaySyncPacket<T>) => {
          acceptRemotePacket(packet, 'network');
        });
      }

      // BroadcastChannel subscription (same-browser preview tabs)
      if (bc) {
        bc.onmessage = (ev) => {
          const msg = ev.data;
          if (!msg || msg.type !== 'state-sync') return;
          acceptRemotePacket(msg, 'local');
        };
        try {
          bc.postMessage({
            type: 'request-state',
            streamer: cleanStreamer,
            channel: resolvedChannel,
          });
        } catch {}
      }

      // Defer initial HTTP fallback fetch so Firestore / Socket.IO / BroadcastChannel deliver first without WAF bursts
      const initialFallbackTimer = !isEmbedPreview
        ? setTimeout(() => {
            if (!isCancelled && lastDirectSyncAtRef.current === 0) {
              void pollHttpSnapshot(true);
            }
          }, 1800)
        : null;

      let tickCount = 0;
      const pollTimer = !isEmbedPreview
        ? setInterval(() => {
            tickCount += 1;
            const now = Date.now();
            const hasRecentDirectSync = now - lastDirectSyncAtRef.current < 15000;
            if (!socket || socket.disconnected) {
              // Only fallback-poll every 10s (2nd tick) when disconnected and Firestore isn't delivering
              if (!hasRecentDirectSync || tickCount % 2 === 0) {
                void pollHttpSnapshot(false);
              }
            } else {
              // When Socket.IO or Firestore is active, only reconcile every 25s (5th tick)
              if (tickCount % 5 === 0) {
                void pollHttpSnapshot(false);
              }
              if (tickCount % 4 === 0) {
                joinOverlayRoom();
              }
            }
          }, 5000)
        : null;

      const handleOverlayFocusOrWake = () => {
        if (isEmbedPreview) {
          if (bc) {
            try {
              bc.postMessage({
                type: 'request-state',
                streamer: cleanStreamer,
                channel: resolvedChannel,
              });
            } catch {}
          }
          return;
        }
        if (socket && socket.disconnected && !socket.active) socket.connect();
        joinOverlayRoom();
        if (Date.now() - lastDirectSyncAtRef.current > 5000) {
          void pollHttpSnapshot(false);
        }
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('focus', handleOverlayFocusOrWake);
        document.addEventListener('visibilitychange', handleOverlayFocusOrWake);
      }

      return () => {
        isCancelled = true;
        isMountedRef.current = false;
        if (initialFallbackTimer) clearTimeout(initialFallbackTimer);
        if (pollTimer) clearInterval(pollTimer);
        for (const unsub of firestoreUnsubs) {
          try {
            unsub();
          } catch {}
        }
        if (typeof window !== 'undefined') {
          window.removeEventListener('storage', handleStorage);
          window.removeEventListener('focus', handleOverlayFocusOrWake);
          document.removeEventListener('visibilitychange', handleOverlayFocusOrWake);
        }
        if (bc) {
          try {
            bc.close();
          } catch {}
        }
        channelRef.current = null;
        if (socket) {
          socket.disconnect();
        }
        socketRef.current = null;
      };
    } else {
      const announceAndPushHostState = (reuseCached = false) => {
        if (socket && socket.connected) {
          socket.emit('register-overlay-host', {
            gameId: cleanGameId,
            streamer: cleanStreamer,
            channel: resolvedChannel,
            hostSessionId: hostSessionIdRef.current,
          });
        }
        pushHostSnapshotNow(true, undefined, reuseCached);
      };

      if (socket && socket.connected) {
        announceAndPushHostState(true);
      } else {
        pushHostSnapshotNow(true, undefined, true);
      }
      if (socket) {
        socket.on('connect', () => announceAndPushHostState(true));

        socket.on(
          'overlay-request-state',
          (req: { gameId?: string; streamer?: string; channel?: string }) => {
            if (req?.gameId && req.gameId !== cleanGameId) return;
            const reqCh = sanitizeChannelToken(req?.channel);
            const reqStr = sanitizeStreamerHandle(req?.streamer);
            if (reqCh && resolvedChannel && reqCh !== resolvedChannel) return;
            if (!reqCh && reqStr && cleanStreamer && reqStr !== cleanStreamer) return;
            pushHostSnapshotNow(true, undefined, true);
          }
        );
      }

      if (bc) {
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'request-state' && localStateRef.current !== null) {
            const reqCh = sanitizeChannelToken(ev.data?.channel);
            if (reqCh && resolvedChannel && reqCh !== resolvedChannel) return;
            if (lastPacketRef.current) {
              try {
                bc.postMessage(lastPacketRef.current);
              } catch {}
            } else {
              pushHostSnapshotNow(false, undefined, false);
            }
          }
        };
      }

      // Keepalive: confirm HTTP & Firestore latest snapshot cleanly without flooding
      let beatCount = 0;
      const hostHeartbeat = setInterval(() => {
        beatCount += 1;
        if (localStateRef.current === null) return;
        const latestPacket = lastPacketRef.current;
        const latestSeq = latestPacket?.seq || 0;
        if (
          lastSerializedPacketRef.current &&
          Date.now() >= httpCooldownUntilRef.current &&
          (!socket || socket.disconnected || lastHttpConfirmedSeqRef.current < latestSeq)
        ) {
          flushHttpPost(lastSerializedPacketRef.current, latestSeq);
        }
        if (
          latestPacket &&
          latestPacket.stateHash &&
          latestPacket.stateHash !== lastFirestoreSentHashRef.current &&
          !isFirestoreWritePaused() &&
          Date.now() >= fsCooldownUntilRef.current
        ) {
          scheduleFirestorePush(latestPacket, false);
        }
        if (socket && socket.connected && beatCount % 2 === 0) {
          socket.emit('register-overlay-host', {
            gameId: cleanGameId,
            streamer: cleanStreamer,
            channel: resolvedChannel,
            hostSessionId: hostSessionIdRef.current,
          });
        }
      }, 10000);

      const handleHostWake = () => {
        if (localStateRef.current !== null) {
          if (socket && socket.disconnected && !socket.active) socket.connect();
          announceAndPushHostState(true);
        }
      };
      const handleHostHide = () => {
        if (lastSerializedPacketRef.current) {
          writeLocalStorageDeferred(lastSerializedPacketRef.current, true);
          flushHttpPost(
            lastSerializedPacketRef.current,
            lastPacketRef.current?.seq || 0
          );
        }
        if (
          lastPacketRef.current &&
          !isFirestoreWritePaused() &&
          lastPacketRef.current.stateHash !== lastFirestoreSentHashRef.current
        ) {
          scheduleFirestorePush(lastPacketRef.current, true);
        }
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('focus', handleHostWake);
        window.addEventListener('pagehide', handleHostHide);
        document.addEventListener('visibilitychange', handleHostWake);
      }

      return () => {
        isMountedRef.current = false;
        clearInterval(hostHeartbeat);
        if (pendingTimerRef.current) {
          clearTimeout(pendingTimerRef.current);
          pendingTimerRef.current = null;
        }
        if (httpTrailingTimerRef.current) {
          clearTimeout(httpTrailingTimerRef.current);
          httpTrailingTimerRef.current = null;
        }
        if (localStorageTrailingTimerRef.current) {
          clearTimeout(localStorageTrailingTimerRef.current);
          localStorageTrailingTimerRef.current = null;
        }
        if (firestoreTrailingTimerRef.current) {
          clearTimeout(firestoreTrailingTimerRef.current);
          firestoreTrailingTimerRef.current = null;
        }
        queuedPostBodyRef.current = null;
        postInFlightRef.current = false;
        fsQueuedPacketRef.current = null;
        fsInFlightRef.current = false;
        if (typeof window !== 'undefined') {
          window.removeEventListener('focus', handleHostWake);
          window.removeEventListener('pagehide', handleHostHide);
          document.removeEventListener('visibilitychange', handleHostWake);
        }
        if (socket && socket.connected) {
          socket.emit('overlay-host-leave', {
            gameId: cleanGameId,
            streamer: cleanStreamer,
            channel: resolvedChannel,
            hostSessionId: hostSessionIdRef.current,
          });
        }
        if (bc) {
          try {
            bc.close();
          } catch {}
        }
        channelRef.current = null;
        if (socket) {
          socket.disconnect();
        }
        socketRef.current = null;
      };
    }
  }, [cleanGameId, cleanStreamer, resolvedChannel, isOverlay, storageKey]);

  // Host emits state updates cleanly (single pass JSON stringify, coalesced at 120ms)
  useEffect(() => {
    if (isOverlay || localState === null) return;

    let currentStateJson = '';
    try {
      currentStateJson = JSON.stringify(localState);
    } catch {
      return;
    }
    if (!currentStateJson || currentStateJson === lastTransmittedJsonRef.current) {
      return;
    }

    const currentStateHash = computeFastStateHash(currentStateJson);
    latestPreparedRef.current = {
      state: localState,
      json: currentStateJson,
      hash: currentStateHash,
    };

    const transmitLatestSnapshot = () => {
      pendingTimerRef.current = null;
      if (!isMountedRef.current) return;
      const prepared = latestPreparedRef.current;
      const stateToSend = prepared ? prepared.state : localStateRef.current;
      if (stateToSend === null) return;

      const stateJson = prepared ? prepared.json : JSON.stringify(stateToSend);
      if (stateJson === lastTransmittedJsonRef.current) return;

      const stateHash = prepared ? prepared.hash : computeFastStateHash(stateJson);
      lastTransmittedJsonRef.current = stateJson;
      lastTransmittedHashRef.current = stateHash;
      lastEmitAtRef.current = performance.now();

      const seq = ++seqRef.current;
      const updatedAt = Date.now();
      const packet: OverlaySyncPacket<T> = {
        type: 'state-sync',
        gameId: cleanGameId,
        streamer: cleanStreamer,
        channel: resolvedChannel,
        state: stateToSend,
        hostSessionId: hostSessionIdRef.current,
        seq,
        stateHash,
        updatedAt,
      };
      const serialized = buildSerializedFromStateJson(
        { seq, stateHash, updatedAt },
        stateJson
      );
      lastPacketRef.current = packet;
      lastSerializedPacketRef.current = serialized;

      if (channelRef.current) {
        try {
          channelRef.current.postMessage(packet);
        } catch {}
      }

      const nowMs = Date.now();
      if (
        lastLocalStorageAtRef.current === 0 ||
        nowMs - lastLocalStorageAtRef.current >= 4000
      ) {
        if (localStorageTrailingTimerRef.current) {
          clearTimeout(localStorageTrailingTimerRef.current);
          localStorageTrailingTimerRef.current = null;
        }
        writeLocalStorageDeferred(serialized);
      } else {
        if (localStorageTrailingTimerRef.current) {
          clearTimeout(localStorageTrailingTimerRef.current);
        }
        localStorageTrailingTimerRef.current = setTimeout(() => {
          localStorageTrailingTimerRef.current = null;
          if (lastSerializedPacketRef.current) {
            writeLocalStorageDeferred(lastSerializedPacketRef.current);
          }
        }, 2000);
      }

      const sock = socketRef.current;
      const sockConnected = Boolean(sock && sock.connected);
      if (sock && sockConnected) {
        sock.emit('overlay-state-update', packet);
      }
      const minHttpIntervalMs = sockConnected ? 3000 : 1800;
      if (
        lastHttpPostAtRef.current === 0 ||
        nowMs - lastHttpPostAtRef.current >= minHttpIntervalMs
      ) {
        if (httpTrailingTimerRef.current) {
          clearTimeout(httpTrailingTimerRef.current);
          httpTrailingTimerRef.current = null;
        }
        flushHttpPost(serialized, seq);
      } else {
        if (httpTrailingTimerRef.current) {
          clearTimeout(httpTrailingTimerRef.current);
        }
        const waitMs = Math.max(
          400,
          minHttpIntervalMs - (nowMs - lastHttpPostAtRef.current) + 50
        );
        httpTrailingTimerRef.current = setTimeout(() => {
          httpTrailingTimerRef.current = null;
          if (lastSerializedPacketRef.current) {
            flushHttpPost(
              lastSerializedPacketRef.current,
              lastPacketRef.current?.seq || 0
            );
          }
        }, waitMs);
      }

      // Cross-origin Firestore sync (runs cleanly across ais-dev, ais-pre, Hostinger, and multi-instance containers)
      scheduleFirestorePush(packet, lastFirestoreSuccessAtRef.current === 0);
    };

    const elapsed = performance.now() - lastEmitAtRef.current;
    if (elapsed >= 120) {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      transmitLatestSnapshot();
    } else {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(transmitLatestSnapshot, 125 - elapsed);
    }
  }, [isOverlay, localState, cleanGameId, cleanStreamer, resolvedChannel, storageKey]);

  return { isReceivingHostSync };
}
