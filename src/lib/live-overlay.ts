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
}

/**
 * Syncs live host game state to TikTok LIVE Studio Browser Source overlays via:
 * 1) Same-origin BroadcastChannel (zero latency when host & overlay share browser)
 * 2) Socket.IO overlay room relay (cross-process sync into TikTok LIVE Studio CEF)
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
  const hostSessionIdRef = useRef<string>(
    `host_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  );
  const seqRef = useRef<number>(0);
  const lastRemoteMetaRef = useRef<{ hostSessionId: string; seq: number } | null>(null);

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

    const pushHostSnapshotNow = (forceSocket = true) => {
      if (isOverlay || localStateRef.current === null) return;
      const seq = ++seqRef.current;
      const hostSessionId = hostSessionIdRef.current;
      lastEmitAtRef.current = performance.now();

      if (bc) {
        try {
          bc.postMessage({
            type: 'state-sync',
            streamer: cleanStreamer,
            state: localStateRef.current,
            hostSessionId,
            seq,
          });
        } catch {}
      }

      if (forceSocket && socket.connected) {
        socket.emit('overlay-state-update', {
          gameId,
          streamer: cleanStreamer,
          state: localStateRef.current,
          hostSessionId,
          seq,
        });
      }
    };

    const acceptRemotePacket = (packet: OverlaySyncPacket<T> | null | undefined) => {
      if (!packet || packet.state === undefined) return;
      if (cleanStreamer && packet.streamer && packet.streamer !== cleanStreamer) {
        return;
      }
      if (packet.hostSessionId && typeof packet.seq === 'number') {
        const prev = lastRemoteMetaRef.current;
        if (prev && prev.hostSessionId === packet.hostSessionId && packet.seq < prev.seq) {
          return;
        }
        lastRemoteMetaRef.current = {
          hostSessionId: packet.hostSessionId,
          seq: packet.seq,
        };
      }
      setIsReceivingHostSync(true);
      onSyncedRef.current(packet.state);
    };

    if (isOverlay) {
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

      if (bc) {
        bc.onmessage = (ev) => {
          const msg = ev.data;
          if (!msg || msg.type !== 'state-sync') return;
          acceptRemotePacket(msg);
        };
        bc.postMessage({ type: 'request-state', streamer: cleanStreamer });
      }
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
        if (req?.streamer && cleanStreamer && req.streamer !== cleanStreamer) return;
        pushHostSnapshotNow(true);
      });

      if (bc) {
        bc.onmessage = (ev) => {
          if (ev.data?.type === 'request-state' && localStateRef.current !== null) {
            bc?.postMessage({
              type: 'state-sync',
              streamer: cleanStreamer,
              state: localStateRef.current,
              hostSessionId: hostSessionIdRef.current,
              seq: ++seqRef.current,
            });
          }
        };
      }
    }

    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      if (!isOverlay && socket.connected) {
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
  }, [gameId, cleanStreamer, isOverlay]);

  // Host emits state updates (throttled slightly for burst safety)
  useEffect(() => {
    if (isOverlay || localState === null) return;

    const pushNow = () => {
      pendingTimerRef.current = null;
      lastEmitAtRef.current = performance.now();
      const seq = ++seqRef.current;
      const hostSessionId = hostSessionIdRef.current;
      if (channelRef.current) {
        try {
          channelRef.current.postMessage({
            type: 'state-sync',
            streamer: cleanStreamer,
            state: localStateRef.current,
            hostSessionId,
            seq,
          });
        } catch {}
      }
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('overlay-state-update', {
          gameId,
          streamer: cleanStreamer,
          state: localStateRef.current,
          hostSessionId,
          seq,
        });
      }
    };

    const elapsed = performance.now() - lastEmitAtRef.current;
    if (elapsed >= 60) {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      pushNow();
    } else {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(pushNow, 65 - elapsed);
    }
  }, [isOverlay, localState, gameId, cleanStreamer]);

  return { isReceivingHostSync };
}
