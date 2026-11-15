import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export type OverlayBackgroundMode = 'transparent' | 'dark';

export interface OverlayConfig {
  isOverlay: boolean;
  bg: OverlayBackgroundMode;
  streamer: string;
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
  const streamer = (params.get('streamer') || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
  return { isOverlay, bg, streamer };
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
  const clean = String(streamerHandle || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
  if (clean) {
    params.set('streamer', clean);
  }
  return `${origin}/interactive-games/${gameSlug}/overlay?${params.toString()}`;
}

interface UseOverlaySyncOptions<T> {
  gameId: string;
  streamer?: string | null;
  isOverlay: boolean;
  localState: T | null;
  onSyncedState: (state: T) => void;
}

interface OverlaySyncPacket<T> {
  state?: T;
  streamer?: string;
  hostSessionId?: string;
  seq?: number;
  updatedAt?: number;
}

/**
 * Syncs live host game state to TikTok LIVE Studio Browser Source overlays via 4 redundant channels:
 * 1) Same-origin BroadcastChannel (zero latency when host & overlay share browser)
 * 2) Same-origin localStorage + 'storage' event (instant fallback when BroadcastChannel is throttled)
 * 3) Socket.IO overlay room relay (real-time push into TikTok LIVE Studio CEF)
 * 4) HTTP REST /api/overlay/state (guaranteed delivery even when WebSocket/polling frames drop on new round)
 */
export function useOverlaySync<T>({
  gameId,
  streamer,
  isOverlay,
  localState,
  onSyncedState,
}: UseOverlaySyncOptions<T>): { isReceivingHostSync: boolean } {
  const [isReceivingHostSync, setIsReceivingHostSync] = useState(false);
  const cleanStreamer = String(streamer || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();

  const localStateRef = useRef<T | null>(localState);
  localStateRef.current = localState;

  const onSyncedRef = useRef(onSyncedState);
  onSyncedRef.current = onSyncedState;

  const socketRef = useRef<Socket | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastEmitAtRef = useRef<number>(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followUpTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const hostSessionIdRef = useRef<string>(
    `host_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  );
  const seqRef = useRef<number>(0);
  const lastRemoteMetaRef = useRef<{
    hostSessionId: string;
    seq: number;
    updatedAt: number;
  } | null>(null);

  const storageKey = `mp_overlay_snap_${gameId}`;

  useEffect(() => {
    const channelName = `mp_overlay_${gameId}`;
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(channelName);
        channelRef.current = bc;
      } catch {
        bc = null;
      }
    }

    const socket = io({
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnectionAttempts: Infinity,
      query: { gameId: `${gameId}-overlay` },
    });
    socketRef.current = socket;

    const pushHostSnapshotNow = (forceNetwork = true) => {
      if (isOverlay || localStateRef.current === null) return;
      const seq = ++seqRef.current;
      const hostSessionId = hostSessionIdRef.current;
      const updatedAt = Date.now();
      lastEmitAtRef.current = performance.now();

      const packet: OverlaySyncPacket<T> & { type: string; gameId: string } = {
        type: 'state-sync',
        gameId,
        streamer: cleanStreamer,
        state: localStateRef.current,
        hostSessionId,
        seq,
        updatedAt,
      };

      if (bc) {
        try {
          bc.postMessage(packet);
        } catch {}
      }

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(packet));
        } catch {}
      }

      if (forceNetwork) {
        if (socket.connected) {
          socket.emit('overlay-state-update', packet);
        }
        fetch('/api/overlay/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(packet),
        }).catch(() => {});
      }
    };

    const acceptRemotePacket = (packet: OverlaySyncPacket<T> | null | undefined) => {
      if (!packet || packet.state === undefined) return;
      const prev = lastRemoteMetaRef.current;
      const pktUpdatedAt = typeof packet.updatedAt === 'number' ? packet.updatedAt : Date.now();

      if (packet.hostSessionId && typeof packet.seq === 'number') {
        if (prev) {
          if (prev.hostSessionId === packet.hostSessionId && packet.seq < prev.seq) {
            return;
          }
          if (
            prev.hostSessionId !== packet.hostSessionId &&
            prev.updatedAt > 0 &&
            pktUpdatedAt > 0 &&
            pktUpdatedAt + 2000 < prev.updatedAt
          ) {
            return;
          }
        }
        lastRemoteMetaRef.current = {
          hostSessionId: packet.hostSessionId,
          seq: packet.seq,
          updatedAt: Math.max(prev?.updatedAt || 0, pktUpdatedAt),
        };
      }
      setIsReceivingHostSync(true);
      onSyncedRef.current(packet.state);
    };

    if (isOverlay) {
      // 1) Read immediate same-origin localStorage snapshot if present
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw) as OverlaySyncPacket<T>;
            acceptRemotePacket(parsed);
          }
        } catch {}
      }

      // 2) Listen for cross-tab localStorage updates
      const handleStorage = (ev: StorageEvent) => {
        if (ev.key !== storageKey || !ev.newValue) return;
        try {
          const parsed = JSON.parse(ev.newValue) as OverlaySyncPacket<T>;
          acceptRemotePacket(parsed);
        } catch {}
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorage);
      }

      // 3) Socket.IO overlay room subscription
      socket.emit('join-overlay', { gameId, streamer: cleanStreamer });
      socket.on('connect', () => {
        socket.emit('join-overlay', { gameId, streamer: cleanStreamer });
        if (bc) {
          try {
            bc.postMessage({ type: 'request-state', streamer: cleanStreamer });
          } catch {}
        }
      });
      socket.on('overlay-state-sync', (packet: OverlaySyncPacket<T>) => {
        acceptRemotePacket(packet);
      });

      // 4) BroadcastChannel subscription
      if (bc) {
        bc.onmessage = (ev) => {
          const msg = ev.data;
          if (!msg || msg.type !== 'state-sync') return;
          acceptRemotePacket(msg);
        };
        try {
          bc.postMessage({ type: 'request-state', streamer: cleanStreamer });
        } catch {}
      }

      // 5) Resilient HTTP /api/overlay/state polling so new rounds always sync even if WS frames drop
      let isCancelled = false;
      const pollHttpSnapshot = async () => {
        if (isCancelled) return;
        try {
          const qs = new URLSearchParams({ gameId });
          if (cleanStreamer) qs.set('streamer', cleanStreamer);
          const res = await fetch(`/api/overlay/state?${qs.toString()}`, {
            cache: 'no-store',
          });
          if (!res.ok || isCancelled) return;
          const data = await res.json();
          if (data && data.hasSnapshot && data.state !== undefined) {
            acceptRemotePacket(data as OverlaySyncPacket<T>);
          }
        } catch {}
      };
      void pollHttpSnapshot();
      const pollTimer = setInterval(pollHttpSnapshot, 900);

      return () => {
        isCancelled = true;
        clearInterval(pollTimer);
        if (typeof window !== 'undefined') {
          window.removeEventListener('storage', handleStorage);
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
      const announceAndPushHostState = () => {
        socket.emit('register-overlay-host', {
          gameId,
          streamer: cleanStreamer,
          hostSessionId: hostSessionIdRef.current,
        });
        pushHostSnapshotNow(true);
      };

      if (socket.connected) {
        announceAndPushHostState();
      }
      socket.on('connect', announceAndPushHostState);

      socket.on('overlay-request-state', (req: { gameId?: string; streamer?: string }) => {
        if (req?.gameId && req.gameId !== gameId) return;
        pushHostSnapshotNow(true);
      });

      if (bc) {
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'request-state' && localStateRef.current !== null) {
            pushHostSnapshotNow(true);
          }
        };
      }

      // Periodic host heartbeat so late-joining or reconnecting overlays stay 100% in sync
      const hostHeartbeat = setInterval(() => {
        if (localStateRef.current !== null) {
          pushHostSnapshotNow(true);
        }
      }, 2500);

      return () => {
        clearInterval(hostHeartbeat);
        if (pendingTimerRef.current) {
          clearTimeout(pendingTimerRef.current);
          pendingTimerRef.current = null;
        }
        followUpTimersRef.current.forEach((t) => clearTimeout(t));
        followUpTimersRef.current = [];
        if (socket.connected) {
          socket.emit('overlay-host-leave', {
            gameId,
            streamer: cleanStreamer,
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
  }, [gameId, cleanStreamer, isOverlay, storageKey]);

  // Host emits state updates immediately + follow-up confirmation bursts (250ms & 900ms) for new round reliability
  useEffect(() => {
    if (isOverlay || localState === null) return;

    const transmitSnapshot = () => {
      if (localStateRef.current === null) return;
      lastEmitAtRef.current = performance.now();
      const seq = ++seqRef.current;
      const hostSessionId = hostSessionIdRef.current;
      const updatedAt = Date.now();
      const packet = {
        type: 'state-sync',
        gameId,
        streamer: cleanStreamer,
        state: localStateRef.current,
        hostSessionId,
        seq,
        updatedAt,
      };

      if (channelRef.current) {
        try {
          channelRef.current.postMessage(packet);
        } catch {}
      }
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(packet));
        } catch {}
      }
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('overlay-state-update', packet);
      }
      fetch('/api/overlay/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packet),
      }).catch(() => {});
    };

    const scheduleWithFollowUps = () => {
      pendingTimerRef.current = null;
      transmitSnapshot();
      followUpTimersRef.current.forEach((t) => clearTimeout(t));
      followUpTimersRef.current = [
        setTimeout(transmitSnapshot, 250),
        setTimeout(transmitSnapshot, 900),
      ];
    };

    const elapsed = performance.now() - lastEmitAtRef.current;
    if (elapsed >= 45) {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      scheduleWithFollowUps();
    } else {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(scheduleWithFollowUps, 50 - elapsed);
    }
  }, [isOverlay, localState, gameId, cleanStreamer, storageKey]);

  return { isReceivingHostSync };
}
