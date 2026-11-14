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
      reconnectionAttempts: 10,
      query: { gameId: `${gameId}-overlay` },
    });
    socketRef.current = socket;

    if (isOverlay) {
      socket.emit('join-overlay', { gameId, streamer: cleanStreamer });
      socket.on('connect', () => {
        socket.emit('join-overlay', { gameId, streamer: cleanStreamer });
      });
      socket.on('overlay-state-sync', (packet: { state?: T; streamer?: string }) => {
        if (!packet || packet.state === undefined) return;
        if (
          cleanStreamer &&
          packet.streamer &&
          packet.streamer !== cleanStreamer
        ) {
          return;
        }
        setIsReceivingHostSync(true);
        onSyncedRef.current(packet.state);
      });

      if (bc) {
        bc.onmessage = (ev) => {
          const msg = ev.data;
          if (!msg || msg.type !== 'state-sync' || msg.state === undefined) return;
          if (cleanStreamer && msg.streamer && msg.streamer !== cleanStreamer) {
            return;
          }
          setIsReceivingHostSync(true);
          onSyncedRef.current(msg.state);
        };
        bc.postMessage({ type: 'request-state', streamer: cleanStreamer });
      }
    } else if (bc) {
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'request-state' && localStateRef.current !== null) {
          bc?.postMessage({
            type: 'state-sync',
            streamer: cleanStreamer,
            state: localStateRef.current,
          });
        }
      };
    }

    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
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
      lastEmitAtRef.current = performance.now();
      if (channelRef.current) {
        try {
          channelRef.current.postMessage({
            type: 'state-sync',
            streamer: cleanStreamer,
            state: localStateRef.current,
          });
        } catch {}
      }
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('overlay-state-update', {
          gameId,
          streamer: cleanStreamer,
          state: localStateRef.current,
        });
      }
    };

    const elapsed = performance.now() - lastEmitAtRef.current;
    if (elapsed >= 60) {
      pushNow();
    } else {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(pushNow, 65 - elapsed);
    }
  }, [isOverlay, localState, gameId, cleanStreamer]);

  return { isReceivingHostSync };
}
