import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export type OverlayBackgroundMode = 'transparent' | 'dark';

export interface OverlayConfig {
  isOverlay: boolean;
  bg: OverlayBackgroundMode;
  streamer: string;
  channel: string;
}

const OVERLAY_CHANNEL_STORAGE_KEY = 'mp_overlay_channel_v1';
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
    .slice(0, 80);
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
  return { isOverlay, bg, streamer, channel };
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

export function buildLiveOverlayUrl(
  gameSlug: string,
  streamerHandle?: string | null,
  bg: OverlayBackgroundMode = 'transparent'
): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
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
 * Syncs live host game state to TikTok LIVE Studio Browser Source overlays with minimal CPU/memory overhead:
 * 1) Same-origin BroadcastChannel (zero serialization overhead for same-browser Preview Overlay)
 * 2) Throttled/deferred localStorage snapshot (for initial mount hydration without blocking input/frames)
 * 3) Primary Socket.IO overlay room relay (real-time push into TikTok LIVE Studio CEF)
 * 4) Version-checked HTTP REST /api/overlay/state fallback (short-circuits with ~70B when unchanged)
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
  const lastLocalStorageAtRef = useRef<number>(0);
  const hostSessionIdRef = useRef<string>(
    `host_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  );
  const seqRef = useRef<number>(0);

  // Coalesced single-flight HTTP POST state so bursts never exhaust Chromium keepalive/socket limits
  const postInFlightRef = useRef<boolean>(false);
  const postStartedAtRef = useRef<number>(0);
  const queuedPostBodyRef = useRef<{ body: string; seq: number } | null>(null);
  const lastHttpConfirmedSeqRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const lastRemoteMetaRef = useRef<{
    hostSessionId: string;
    seq: number;
    serverVersion: number;
    bootId: string;
    stateHash: string;
    hasDelivered: boolean;
    source: 'local' | 'network';
  } | null>(null);

  const roomScope = resolvedChannel || cleanStreamer || 'default';
  const storageKey = `mp_overlay_snap_${gameId}_${roomScope}`;

  const flushHttpPost = (serializedBody: string, packetSeq = 0) => {
    if (isOverlay || !isMountedRef.current || !serializedBody) return;

    const now = Date.now();
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
          if (res.ok && seqToSend > lastHttpConfirmedSeqRef.current) {
            lastHttpConfirmedSeqRef.current = seqToSend;
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
          if (queued && isMountedRef.current && !isOverlay) {
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
      gameId,
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
    lastLocalStorageAtRef.current = 0;
    lastHttpConfirmedSeqRef.current = 0;
    if (isOverlay) {
      lastRemoteMetaRef.current = null;
    }

    const bcName = `mp_overlay_${gameId}`;
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(bcName);
        channelRef.current = bc;
      } catch {
        bc = null;
      }
    }

    const socket = io({
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
      query: { gameId: `${gameId}-overlay` },
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
        gameId,
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
        if (socket.connected) {
          socket.emit('overlay-state-update', packet);
          if (
            lastHttpPostAtRef.current === 0 ||
            nowMs - lastHttpPostAtRef.current >= 500
          ) {
            if (httpTrailingTimerRef.current) {
              clearTimeout(httpTrailingTimerRef.current);
              httpTrailingTimerRef.current = null;
            }
            flushHttpPost(serialized, pktSeq);
          } else if (!httpTrailingTimerRef.current) {
            httpTrailingTimerRef.current = setTimeout(() => {
              httpTrailingTimerRef.current = null;
              if (lastSerializedPacketRef.current) {
                flushHttpPost(
                  lastSerializedPacketRef.current,
                  lastPacketRef.current?.seq || 0
                );
              }
            }, 350);
          }
        } else {
          if (httpTrailingTimerRef.current) {
            clearTimeout(httpTrailingTimerRef.current);
            httpTrailingTimerRef.current = null;
          }
          flushHttpPost(serialized, pktSeq);
        }
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
        } else if (
          source === 'local' &&
          prev.source === 'network' &&
          !pktSession
        ) {
          return;
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
        hasDelivered: true,
        source,
      };

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

      // 3) Socket.IO overlay room subscription
      const joinOverlayRoom = () => {
        if (socket.connected) {
          socket.emit('join-overlay', {
            gameId,
            streamer: cleanStreamer,
            channel: resolvedChannel,
          });
        }
      };
      joinOverlayRoom();

      // 5) Version-checked HTTP /api/overlay/state fallback polling for TikTok LIVE Studio CEF
      let isCancelled = false;
      let pollInFlight = false;
      let pollStartedAt = 0;

      const pollHttpSnapshot = async () => {
        const now = Date.now();
        if (isCancelled) return;
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
            gameId,
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
          if (!res.ok || isCancelled) return;
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

      socket.on('connect', () => {
        joinOverlayRoom();
        void pollHttpSnapshot();
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

      // 4) BroadcastChannel subscription (same-browser preview tabs)
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

      void pollHttpSnapshot();
      let tickCount = 0;
      const pollTimer = setInterval(() => {
        tickCount += 1;
        if (socket.disconnected) {
          void pollHttpSnapshot();
          if (!socket.active) {
            socket.connect();
          }
        } else {
          // Lightweight version-checked HTTP poll (~900ms) guarantees Studio CEF updates even if WS frames stall
          if (tickCount % 2 === 0) {
            void pollHttpSnapshot();
          }
          if (tickCount % 24 === 0) {
            joinOverlayRoom();
          }
        }
      }, 450);

      const handleOverlayFocusOrWake = () => {
        if (socket.disconnected && !socket.active) socket.connect();
        joinOverlayRoom();
        void pollHttpSnapshot();
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('focus', handleOverlayFocusOrWake);
        document.addEventListener('visibilitychange', handleOverlayFocusOrWake);
      }

      return () => {
        isCancelled = true;
        isMountedRef.current = false;
        clearInterval(pollTimer);
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
        socket.disconnect();
        socketRef.current = null;
      };
    } else {
      const announceAndPushHostState = (reuseCached = false) => {
        if (socket.connected) {
          socket.emit('register-overlay-host', {
            gameId,
            streamer: cleanStreamer,
            channel: resolvedChannel,
            hostSessionId: hostSessionIdRef.current,
          });
        }
        pushHostSnapshotNow(true, undefined, reuseCached);
      };

      if (socket.connected) {
        announceAndPushHostState(true);
      } else {
        pushHostSnapshotNow(true, undefined, true);
      }
      socket.on('connect', () => announceAndPushHostState(true));

      socket.on(
        'overlay-request-state',
        (req: { gameId?: string; streamer?: string; channel?: string }) => {
          if (req?.gameId && req.gameId !== gameId) return;
          const reqCh = sanitizeChannelToken(req?.channel);
          const reqStr = sanitizeStreamerHandle(req?.streamer);
          if (reqCh && resolvedChannel && reqCh !== resolvedChannel) return;
          if (!reqCh && reqStr && cleanStreamer && reqStr !== cleanStreamer) return;
          pushHostSnapshotNow(true, undefined, true);
        }
      );

      if (bc) {
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'request-state' && localStateRef.current !== null) {
            const reqCh = sanitizeChannelToken(ev.data?.channel);
            if (reqCh && resolvedChannel && reqCh !== resolvedChannel) return;
            // Send directly over BroadcastChannel using cached packet without bumping seq
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

      // Keepalive: ensure dropped sockets reconnect, confirm latest seq via HTTP, and reinforce room membership
      let beatCount = 0;
      const hostHeartbeat = setInterval(() => {
        beatCount += 1;
        if (localStateRef.current === null) return;
        const latestSeq = lastPacketRef.current?.seq || 0;
        if (socket.disconnected && !socket.active) {
          socket.connect();
        }
        if (
          lastSerializedPacketRef.current &&
          (socket.disconnected || lastHttpConfirmedSeqRef.current < latestSeq)
        ) {
          flushHttpPost(lastSerializedPacketRef.current, latestSeq);
        }
        if (socket.connected && beatCount % 3 === 0) {
          socket.emit('register-overlay-host', {
            gameId,
            streamer: cleanStreamer,
            channel: resolvedChannel,
            hostSessionId: hostSessionIdRef.current,
          });
        }
      }, 3500);

      const handleHostWake = () => {
        if (localStateRef.current !== null) {
          if (socket.disconnected && !socket.active) socket.connect();
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
        queuedPostBodyRef.current = null;
        postInFlightRef.current = false;
        if (typeof window !== 'undefined') {
          window.removeEventListener('focus', handleHostWake);
          window.removeEventListener('pagehide', handleHostHide);
          document.removeEventListener('visibilitychange', handleHostWake);
        }
        if (socket.connected) {
          socket.emit('overlay-host-leave', {
            gameId,
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
        socket.disconnect();
        socketRef.current = null;
      };
    }
  }, [gameId, cleanStreamer, resolvedChannel, isOverlay, storageKey]);

  // Host emits state updates cleanly (single pass JSON stringify, coalesced at 120ms, zero redundant 350ms duplicate emit)
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
        gameId,
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
      if (sock && sock.connected) {
        sock.emit('overlay-state-update', packet);
        if (
          lastHttpPostAtRef.current === 0 ||
          nowMs - lastHttpPostAtRef.current >= 500
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
          httpTrailingTimerRef.current = setTimeout(() => {
            httpTrailingTimerRef.current = null;
            if (lastSerializedPacketRef.current) {
              flushHttpPost(
                lastSerializedPacketRef.current,
                lastPacketRef.current?.seq || 0
              );
            }
          }, 350);
        }
      } else {
        if (httpTrailingTimerRef.current) {
          clearTimeout(httpTrailingTimerRef.current);
          httpTrailingTimerRef.current = null;
        }
        flushHttpPost(serialized, seq);
      }
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
  }, [isOverlay, localState, gameId, cleanStreamer, resolvedChannel, storageKey]);

  return { isReceivingHostSync };
}
