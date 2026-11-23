import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AuthorizedUser,
  GameMode,
  GuessResult,
  LiveChatItem,
  PublicGameState,
  TargetCard,
  TikTokConnectionStatus,
} from './shared/types';
import { BoggleGrid } from './components/BoggleGrid';
import { TikTokLivePanel } from './components/TikTokLivePanel';
import { AdminAuthModal } from './components/AdminAuthModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { StreamerLoginModal } from './components/StreamerLoginModal';
import { sfx } from './utils/sfx';
import { Link } from 'react-router';
import { createNewGameInstance, WiKirecGame } from './server/game';
import {
  validateInteractiveStreamerKey,
  getActiveInteractiveStreamerSession,
  setActiveInteractiveStreamerSession,
  clearActiveInteractiveStreamerSession,
  touchActiveInteractiveStreamerSession,
} from '@/lib/interactive-key-auth';
import {
  recordInteractiveRoundCompleted,
  tryConsumeOrCheckNextRound,
} from '@/lib/interactive-daily-limits';
import { io, Socket } from 'socket.io-client';
import type { FinderInfo } from './shared/types';
import { LoggedInIndicator } from '@/components/logged-in-indicator';
import {
  triggerResilientConnect,
  forceReconnectBridge,
  emitResilientEvent,
  createEventDeduplicator,
  attachResilientChatListeners,
} from '@/lib/live-chat-bridge';
import {
  creditInteractiveScoreByTikTokHandle,
  getCurrentUserSessionPrefix,
  getLiveConnectionSessionId,
  saveUnifiedLeaderboardScore,
  getUserProfileAvatarUrl,
} from '../lib/unified-game-auth';
import { useOverlayConfig, useOverlaySync } from '@/lib/live-overlay';
import { LiveOverlayButton } from '@/components/interactive-games/live-overlay-button';
import {
  getLocalTodayDateStr,
  recordDailyPuzzleSolved,
  useDailyStreak,
} from '@/lib/daily-streak';
import { triggerVictoryConfetti } from '@/lib/confetti';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import './index.css';

function resolvePlayerAvatar(rawUrl: string | null | undefined, name: string): string {
  if (rawUrl && (rawUrl.startsWith('http') || rawUrl.startsWith('/') || rawUrl.startsWith('data:image/'))) {
    return rawUrl;
  }
  const cleanName = (name || 'Player').replace(/^@+/, '');
  const userAvatar = getUserProfileAvatarUrl();
  if (userAvatar) return userAvatar;
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(cleanName)}`;
}

const STORAGE_NAME_KEY = 'wkt_display_name';
const STORAGE_SESSION_KEY = 'wkt_session_id';

function getOrInitSessionId(): string {
  try {
    let id = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!id) {
      id = `wkt_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      localStorage.setItem(STORAGE_SESSION_KEY, id);
    }
    return id;
  } catch {
    return `wkt_anon_${Math.random().toString(36).slice(2, 9)}`;
  }
}

function getStoredDisplayName(): string {
  try {
    return localStorage.getItem(STORAGE_NAME_KEY) || 'You';
  } catch {
    return 'You';
  }
}

function formatRank(n: number | null): string {
  if (n == null) return '?';
  if (n >= 9999999) return '???';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function getTargetCardHue(rank: number | null, totalRankedWords: number): string {
  const GREEN_HUE = 120;
  const PURPLE_HUE = 285;
  const total = Math.max(2, totalRankedWords || 50000);
  let gradT = 1;
  if (rank != null && rank > 0) {
    gradT = Math.min(1, Math.log(Math.max(1, rank)) / Math.log(total));
  }
  const hue = GREEN_HUE + (PURPLE_HUE - GREEN_HUE) * gradT;
  return `hsl(${hue.toFixed(1)}, 70%, 55%)`;
}

interface MarqueeDanmakuItem {
  uid: string;
  word: string;
  displayName: string;
  profileImage: string | null;
  badge: string;
  result: string;
  cells: number[];
  topPx: number;
  durationMs: number;
  delayMs: number;
  travelPx: number;
}

export default function App({ soloOnly = false }: { soloOnly?: boolean }) {
  const { isOverlay: rawIsOverlay, bg: overlayBg, streamer: overlayStreamer } = useOverlayConfig();
  const isSoloRoute =
    soloOnly ||
    (typeof window !== 'undefined' &&
      (window.location.pathname === '/solo' ||
        window.location.pathname.startsWith('/solo-games')));
  const isOverlay = isSoloRoute ? false : rawIsOverlay;
  const hasReceivedHostSyncRef = useRef(false);

  const [mode, setMode] = useState<GameMode>(() => {
    if (isSoloRoute) {
      return 'daily-solo';
    }
    return 'multiplayer';
  });

  const isSoloMode = isSoloRoute || mode === 'daily-solo' || mode === 'practice-solo';

  const [gameState, setGameState] = useState<PublicGameState | null>(null);
  const todayDateStr = useMemo(() => getLocalTodayDateStr(), []);
  const dailyStreak = useDailyStreak('wikirec', todayDateStr);

  useEffect(() => {
    if (!isOverlay && gameState?.isComplete) {
      recordDailyPuzzleSolved('wikirec', todayDateStr);
    }
  }, [isOverlay, gameState?.isComplete, todayDateStr]);

  const localGameRef = useRef<WiKirecGame | null>(null);

  const initLocalGame = useCallback(async (selectedMode: GameMode) => {
    if (isOverlay) return;
    setFlashedCells([]);
    setWordAnnounce({ word: '', points: 0, finderName: '', visible: false });
    prevCompleteRef.current = false;
    try {
      const game = await createNewGameInstance(selectedMode);
      if (isOverlay) return;
      localGameRef.current = game;
      const next = game.getPublicState();
      setGameState(next);
    } catch (e) {
      console.warn('Local game fallback error:', e);
    }
  }, [isOverlay]);

  useEffect(() => {
    if (isOverlay) return;
    initLocalGame(mode);
  }, [isOverlay]);

  const [tiktokStatus, setTiktokStatus] = useState<TikTokConnectionStatus>({
    connected: false,
    mode: 'webhook-ready',
    username: null,
    tikfinityUrl: null,
    viewerCount: 0,
    chatEventsProcessed: 0,
    guessesFromChat: 0,
    likesCount: 0,
    giftsDiamonds: 0,
    lastError: null,
  });
  const [chatHistory, setChatHistory] = useState<LiveChatItem[]>([]);
  const [presence, setPresence] = useState({
    totalConnected: 1,
    mpViewers: 1,
    soloViewers: 0,
    wwViewers: 0,
  });

  const [guessInput, setGuessInput] = useState('');
  const [swipePreview, setSwipePreview] = useState('');
  const [flashedCells, setFlashedCells] = useState<number[]>([]);
  const marqueeCardRef = useRef<HTMLDivElement | null>(null);
  const seenMarqueeTagIdsRef = useRef<Set<string>>(new Set());
  const marqueeRoundIdRef = useRef<string | null>(null);
  const laneFreeAtRef = useRef<number[]>([0, 0, 0]);
  const marqueeHoverStartRef = useRef<number | null>(null);
  const [marqueeItems, setMarqueeItems] = useState<MarqueeDanmakuItem[]>([]);
  const [wordAnnounce, setWordAnnounce] = useState<{
    word: string;
    points: number;
    finderName: string;
    visible: boolean;
  }>({
    word: '',
    points: 0,
    finderName: '',
    visible: false,
  });

  const [displayName, setDisplayName] = useState(getStoredDisplayName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);
  const [muted, setMuted] = useState(sfx.muted);
  const [tiktokDrawerOpen, setTiktokDrawerOpen] = useState(false);
  const [dismissedRoundId, setDismissedRoundId] = useState<string | null>(null);

  // Streamer Authorization & Admin popup state
  // Stored in sessionStorage so closing the browser window/tab immediately clears credentials
  const [authorizedStreamer, setAuthorizedStreamer] = useState<{
    username: string;
    key: string;
    label?: string;
    sessionId?: string;
  } | null>(() => {
    try {
      const active = getActiveInteractiveStreamerSession();
      if (active) {
        return {
          username: active.username,
          key: active.key,
          label: active.label,
          sessionId: active.username,
        };
      }
      const saved = sessionStorage.getItem('wkt_streamer_auth');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const authorizedStreamerRef = useRef(authorizedStreamer);
  useEffect(() => {
    authorizedStreamerRef.current = authorizedStreamer;
  }, [authorizedStreamer]);

  const [logoutNotice, setLogoutNotice] = useState<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [adminSession, setAdminSession] = useState<{ username: string; token: string } | null>(() => {
    try {
      const stored = sessionStorage.getItem('wkt_admin_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const handleOpenAdmin = useCallback(() => {
    if (!adminSession) {
      setAdminLoginOpen(true);
    } else {
      setAdminModalOpen(true);
    }
  }, [adminSession]);

  const handleAdminLoginSuccess = useCallback((admin: { username: string; token: string }) => {
    setAdminSession(admin);
    try {
      sessionStorage.setItem('wkt_admin_session', JSON.stringify(admin));
    } catch {}
    setAdminModalOpen(true);
  }, []);

  const handleAdminLogout = useCallback(() => {
    setAdminSession(null);
    try {
      sessionStorage.removeItem('wkt_admin_session');
    } catch {}
  }, []);

  const [streamerLoginOpen, setStreamerLoginOpen] = useState(false);

  // Inline Streamer Login & Live Connect state for the left-hand Live Connect box
  const [inlineAuthUser, setInlineAuthUser] = useState('@');
  const [inlineAuthKey, setInlineAuthKey] = useState('');
  const [inlineAuthError, setInlineAuthError] = useState<string | null>(null);
  const [inlineLiveHandle, setInlineLiveHandle] = useState(() =>
    authorizedStreamer?.username
      ? authorizedStreamer.username.startsWith('@')
        ? authorizedStreamer.username
        : `@${authorizedStreamer.username}`
      : '@'
  );
  const [inlineConnecting, setInlineConnecting] = useState(false);
  const [inlineChatProvider, setInlineChatProvider] = useState<'tikfinity' | 'bettertok'>(() => {
    try {
      const saved = localStorage.getItem('chat_integration_provider');
      if (saved === 'bettertok' || saved === 'tikfinity') return saved;
    } catch {}
    return 'tikfinity';
  });

  const handleInlineProviderChange = (provider: 'tikfinity' | 'bettertok') => {
    setInlineChatProvider(provider);
    try {
      localStorage.setItem('chat_integration_provider', provider);
    } catch {}
  };

  useEffect(() => {
    if (authorizedStreamer?.username) {
      setInlineLiveHandle(
        authorizedStreamer.username.startsWith('@')
          ? authorizedStreamer.username
          : `@${authorizedStreamer.username}`
      );
    }
  }, [authorizedStreamer?.username]);

  useEffect(() => {
    if (tiktokStatus.connected || tiktokStatus.lastError) {
      setInlineConnecting(false);
    }
  }, [tiktokStatus.connected, tiktokStatus.lastError]);

  const handleOpenTikTokLive = useCallback(() => {
    if (!authorizedStreamer) {
      setStreamerLoginOpen(true);
    } else {
      setTiktokDrawerOpen(true);
    }
  }, [authorizedStreamer]);

  const handleStreamerLogout = useCallback((reason = 'manual') => {
    clearActiveInteractiveStreamerSession();
    const currentStreamer = authorizedStreamerRef.current;
    setAuthorizedStreamer(null);
    setTiktokDrawerOpen(false);
    try {
      sessionStorage.removeItem('wkt_streamer_auth');
      localStorage.removeItem('wkt_streamer_auth');
    } catch {}

    const liveSessionId = getLiveConnectionSessionId('wikirec');
    if (currentStreamer?.username) {
      fetch('/api/auth/streamer-logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentStreamer.username,
          sessionId: liveSessionId,
        }),
      }).catch(() => {});
    }

    if (socketRef.current) {
      socketRef.current.emit('disconnect-tiktok', {
        username: currentStreamer?.username || null,
        sessionId: liveSessionId,
        gameId: 'wikirec',
      });
    }

    if (reason === 'inactivity') {
      setLogoutNotice('Logged out after 15 minutes of inactivity (no chat or user activity).');
      setTimeout(() => setLogoutNotice(null), 8000);
    }
  }, []);

  const handleStreamerLoginSuccess = useCallback(
    (
      auth: { username: string; key: string; label?: string; sessionId?: string },
      openDrawer = true
    ) => {
      setAuthorizedStreamer(auth);
      setLogoutNotice(null);
      setInlineAuthError(null);
      setInlineAuthKey('');
      lastActivityRef.current = Date.now();
      try {
        sessionStorage.setItem('wkt_streamer_auth', JSON.stringify(auth));
      } catch {}
      if (openDrawer) {
        setTiktokDrawerOpen(true);
      }

      if (socketRef.current) {
        socketRef.current.emit('register-streamer', {
          username: auth.username,
          sessionId: getLiveConnectionSessionId('wikirec'),
          gameId: 'wikirec',
        });
      }
    },
    []
  );

  const handleInlineStreamerAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = inlineAuthUser.trim().replace(/^@+/, '').toLowerCase();
    const cleanKey = inlineAuthKey.trim();
    if (!cleanUser) {
      setInlineAuthError('Enter your TikTok @username');
      return;
    }
    if (!cleanKey) {
      setInlineAuthError('Enter your LIVE-xxxx-xxxx key');
      return;
    }
    const validation = validateInteractiveStreamerKey(cleanUser, cleanKey);
    if (!validation.ok) {
      setInlineAuthError(validation.error || 'Invalid @username or key');
      return;
    }
    setActiveInteractiveStreamerSession(validation.user);
    handleStreamerLoginSuccess(
      {
        username: validation.user.username,
        key: validation.user.key,
        label: validation.user.label,
        sessionId: validation.session.username,
      },
      false
    );
  };

  const handleInlineConnect = (e: React.FormEvent, isTestMode = false) => {
    e.preventDefault();
    const cleaned = inlineLiveHandle.trim().replace(/^@+/, '');
    if (!cleaned) return;
    setInlineConnecting(false);
    setTiktokStatus((prev) => ({
      ...prev,
      connected: true,
      username: cleaned,
      lastError: null,
    }));
    triggerResilientConnect(
      socketRef.current,
      {
        username: cleaned,
        isTestMode,
        provider: inlineChatProvider,
        key: authorizedStreamer?.key,
        sessionId: getLiveConnectionSessionId('wikirec'),
        gameId: 'wikirec',
      },
      ({ username: uname }) => {
        setInlineConnecting(false);
        setTiktokStatus((prev) => ({
          ...prev,
          connected: true,
          username: uname || cleaned,
          lastError: null,
        }));
      }
    );
  };

  const handleInlineReconnect = () => {
    const cleaned =
      inlineLiveHandle.trim().replace(/^@+/, '') ||
      authorizedStreamer?.username?.replace(/^@+/, '') ||
      'streamer';
    setInlineConnecting(false);
    setTiktokStatus((prev) => ({
      ...prev,
      connected: true,
      username: cleaned,
      lastError: null,
    }));
    forceReconnectBridge(
      socketRef.current,
      {
        username: cleaned,
        isTestMode: false,
        provider: inlineChatProvider,
        key: authorizedStreamer?.key,
        sessionId: getLiveConnectionSessionId('wikirec'),
        gameId: 'wikirec',
      },
      ({ username: uname }) => {
        setInlineConnecting(false);
        setTiktokStatus((prev) => ({
          ...prev,
          connected: true,
          username: uname || cleaned,
          lastError: null,
        }));
      }
    );
  };

  const handleInlineDisconnect = () => {
    const liveSessionId = getLiveConnectionSessionId('wikirec');
    setInlineConnecting(false);
    setTiktokStatus((prev) => ({
      ...prev,
      connected: false,
      username: null,
    }));
    fetch('/api/tiktok/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: liveSessionId,
        gameId: 'wikirec',
      }),
    }).catch(() => {});
    if (!socketRef.current) return;
    socketRef.current.emit('disconnect-tiktok', {
      username: authorizedStreamer?.username || inlineLiveHandle.trim().replace(/^@+/, ''),
      sessionId: liveSessionId,
      gameId: 'wikirec',
    });
  };

  // Automatically log out when window or tab is closed
  useEffect(() => {
    const handleBeforeUnload = () => {
      const current = authorizedStreamerRef.current;
      if (current?.username) {
        const tabSessionId = getLiveConnectionSessionId('wikirec');
        const payload = JSON.stringify({
          username: current.username,
          sessionId: tabSessionId,
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/auth/streamer-logout', payload);
        } else {
          fetch('/api/auth/streamer-logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Track user activity across interactions (mousemove, mousedown, keydown, touchstart, scroll, click)
  useEffect(() => {
    const onUserInteraction = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', onUserInteraction, { passive: true });
    window.addEventListener('mousedown', onUserInteraction, { passive: true });
    window.addEventListener('keydown', onUserInteraction, { passive: true });
    window.addEventListener('touchstart', onUserInteraction, { passive: true });
    window.addEventListener('scroll', onUserInteraction, { passive: true });
    window.addEventListener('click', onUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onUserInteraction);
      window.removeEventListener('mousedown', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
      window.removeEventListener('touchstart', onUserInteraction);
      window.removeEventListener('scroll', onUserInteraction);
      window.removeEventListener('click', onUserInteraction);
    };
  }, []);

  // 15-minute inactivity sweeper (combines user and chat activity) & heartbeat
  useEffect(() => {
    if (!authorizedStreamer) return;

    const INACTIVITY_MS = 15 * 60 * 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= INACTIVITY_MS) {
        handleStreamerLogout('inactivity');
      }
    }, 5000);

    const heartbeat = setInterval(() => {
      const tabSessionId = getLiveConnectionSessionId('wikirec');
      fetch('/api/auth/streamer-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authorizedStreamer.username,
          sessionId: tabSessionId,
        }),
      }).catch(() => {});
    }, 45000);

    return () => {
      clearInterval(interval);
      clearInterval(heartbeat);
    };
  }, [authorizedStreamer, handleStreamerLogout]);

  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string>(getOrInitSessionId());
  const modeRef = useRef<GameMode>(mode);
  const displayNameRef = useRef<string>(displayName);
  const prevCompleteRef = useRef<boolean>(false);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  const triggerWordAnnounce = useCallback((finderName: string, word: string, points: number) => {
    if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    setWordAnnounce({
      finderName,
      word: word.toUpperCase(),
      points,
      visible: true,
    });
    announceTimerRef.current = setTimeout(() => {
      setWordAnnounce((prev) => ({ ...prev, visible: false }));
    }, 2400);
  }, []);

  useEffect(() => {
    if (isSoloRoute || isOverlay) return;
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      timeout: 5000,
      query: {
        sessionId: getLiveConnectionSessionId('wikirec'),
        gameId: 'wikirec',
      },
    });
    socketRef.current = socket;
    const deduplicator = createEventDeduplicator();

    if (authorizedStreamerRef.current?.username) {
      socket.emit('register-streamer', {
        username: authorizedStreamerRef.current.username,
        sessionId: getLiveConnectionSessionId('wikirec'),
        gameId: 'wikirec',
      });
    }

    socket.on('tiktok-connected', (payload: { username: string; roomId: string; gameId?: string }) => {
      if (!payload.gameId || payload.gameId === 'wikirec') {
        lastActivityRef.current = Date.now();
        touchActiveInteractiveStreamerSession();
        setInlineConnecting(false);
        setTiktokStatus((prev) => ({
          ...prev,
          connected: true,
          username: payload.username,
          lastError: null,
        }));
      }
    });

    socket.on('tiktok-status', (payload: { connected: boolean; username?: string | null; gameId?: string }) => {
      if (!payload.gameId || payload.gameId === 'wikirec') {
        lastActivityRef.current = Date.now();
        touchActiveInteractiveStreamerSession();
        setInlineConnecting(false);
        if (payload.connected) {
          setTiktokStatus((prev) => ({
            ...prev,
            connected: true,
            username: payload.username ?? prev.username,
          }));
        } else {
          setTiktokStatus((prev) => ({
            ...prev,
            connected: false,
            username: null,
          }));
        }
      }
    });

    socket.on('tiktok-error', (errMsg: string) => {
      setInlineConnecting(false);
      console.warn('TikTok socket notice:', errMsg);
    });

    socket.on('tiktok-disconnected', (payload?: { gameId?: string }) => {
      if (!payload?.gameId || payload.gameId === 'wikirec') {
        setInlineConnecting(false);
        setTiktokStatus((prev) => ({
          ...prev,
          connected: false,
          username: null,
        }));
      }
    });

    const processChatEvent = (data: {
      uniqueId?: string;
      nickname?: string;
      comment?: string;
      profilePictureUrl?: string;
    }) => {
      lastActivityRef.current = Date.now();
      touchActiveInteractiveStreamerSession();
      const rawComment = String(data.comment || '').trim();
      if (!rawComment) return;

      const rawObj = data as any;
      const nestedUser =
        rawObj.user || rawObj.userDetails || rawObj.author || rawObj.sender || {};
      const candidateDisplay = String(
        rawObj.nickname ||
          rawObj.displayName ||
          nestedUser.nickname ||
          nestedUser.displayName ||
          nestedUser.name ||
          ''
      )
        .trim()
        .replace(/^@+/, '');
      const candidateId = String(
        rawObj.uniqueId ||
          rawObj.username ||
          rawObj.userId ||
          nestedUser.uniqueId ||
          nestedUser.displayId ||
          nestedUser.username ||
          nestedUser.userId ||
          nestedUser.id ||
          ''
      )
        .trim()
        .replace(/^@+/, '');
      const effectiveId =
        candidateId && candidateId.toLowerCase() !== 'viewer'
          ? candidateId
          : candidateDisplay && candidateDisplay.toLowerCase() !== 'viewer'
          ? candidateDisplay
          : candidateId || 'viewer';
      const viewerUsername = effectiveId.toLowerCase() || 'viewer';
      const viewerDisplay = candidateDisplay || effectiveId || 'Viewer';
      const rawPfp = String(
        rawObj.profilePictureUrl ||
          rawObj.avatar ||
          nestedUser.profilePictureUrl ||
          nestedUser.avatar ||
          ''
      ).trim();
      const normalizedPfp = rawPfp.startsWith('//') ? `https:${rawPfp}` : rawPfp;
      const viewerAvatar = normalizedPfp.startsWith('http')
        ? normalizedPfp
        : `https://i.pravatar.cc/150?u=${encodeURIComponent(viewerUsername || viewerDisplay)}`;

      if (isOverlay) {
        return;
      }

      if (rawComment.toLowerCase() === '!hint' && localGameRef.current) {
        localGameRef.current.requestHint();
        setGameState(localGameRef.current.getPublicState());
        sfx.playTileStep(0);
      }

      // Extract candidate words (3..15 letters) from the chat comment
      const candidateWords =
        rawComment
          .replace(/['’`]/g, '')
          .toLowerCase()
          .match(/[a-z]{3,15}/g) || [];

      let bestResult: LiveChatItem['guessResult'] = 'chat';
      let totalPointsEarned = 0;
      let matchedWord: string | undefined;

      if (localGameRef.current && candidateWords.length > 0) {
        const finderInfo: FinderInfo = {
          displayName: viewerDisplay,
          platform: 'tiktok',
          platformUserId: viewerUsername,
          profileImage: viewerAvatar,
        };

        for (const candidate of candidateWords.slice(0, 5)) {
          const outcome = localGameRef.current.guess(candidate, finderInfo);
          if (outcome.result === 'correct') {
            bestResult = 'correct';
            totalPointsEarned += outcome.points || 0;
            matchedWord = outcome.word;
            sfx.playWordFound(outcome.tierName, outcome.isTitleWord);
            if (outcome.cells?.length) {
              setFlashedCells(outcome.cells);
              setTimeout(() => setFlashedCells([]), 900);
            }
            triggerWordAnnounce(viewerDisplay, outcome.word, outcome.points);
            if (outcome.points && outcome.points > 0) {
              creditInteractiveScoreByTikTokHandle({
                tiktokUsername: viewerUsername || viewerDisplay,
                gameId: 'wikirec',
                pointsEarned: outcome.points,
                reason: `WiKirecTangled word: ${outcome.word.toUpperCase()}`,
              });
            }
          } else if (outcome.result === 'already_found' && bestResult !== 'correct') {
            bestResult = 'already_found';
            sfx.playAlreadyFound();
            if (outcome.cells?.length) {
              setFlashedCells(outcome.cells);
              setTimeout(() => setFlashedCells([]), 600);
            }
          } else if (outcome.rankPoints && outcome.rankPoints > 0) {
            totalPointsEarned += outcome.rankPoints;
            if (!matchedWord) matchedWord = outcome.word;
            if (bestResult === 'chat') bestResult = 'miss_in_article';
            sfx.playTileStep(2);
            triggerWordAnnounce(viewerDisplay, outcome.word, outcome.rankPoints);
            creditInteractiveScoreByTikTokHandle({
              tiktokUsername: viewerUsername || viewerDisplay,
              gameId: 'wikirec',
              pointsEarned: outcome.rankPoints,
              reason: `WiKirecTangled close guess: ${outcome.word.toUpperCase()}`,
            });
          } else if (
            outcome.result === 'miss_in_article' &&
            bestResult !== 'correct' &&
            bestResult !== 'already_found'
          ) {
            bestResult = 'miss_in_article';
          }
        }

        const updatedState = localGameRef.current.getPublicState();
        setGameState(updatedState);
        if (updatedState.isComplete && !prevCompleteRef.current) {
          sfx.playRoundWin();
          if (!isOverlay) {
            const topScore = updatedState.topPlayers?.[0]?.score || 0;
            const bestKey = `mp_wikirec_best_score_${getCurrentUserSessionPrefix()}`;
            let prevBest = 0;
            try {
              prevBest = Number(localStorage.getItem(bestKey) || '0') || 0;
              if (topScore > prevBest) {
                localStorage.setItem(bestKey, String(topScore));
              }
            } catch {}
            triggerVictoryConfetti({
              isDaily: mode === 'daily-solo',
              isNewHighScore: prevBest > 0 && topScore > prevBest,
            });
          }
        }
        prevCompleteRef.current = !!updatedState.isComplete;
      }

      setTiktokStatus((prev) => ({
        ...prev,
        chatEventsProcessed: prev.chatEventsProcessed + 1,
        guessesFromChat:
          candidateWords.length > 0 ? prev.guessesFromChat + 1 : prev.guessesFromChat,
      }));

      const chatItem: LiveChatItem = {
        id: `tt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        platform: 'tiktok',
        username: viewerUsername,
        displayName: viewerDisplay,
        profileImage: viewerAvatar,
        comment: matchedWord ? matchedWord.toUpperCase() : rawComment,
        guessResult: bestResult,
        points: totalPointsEarned > 0 ? totalPointsEarned : undefined,
        timestamp: Date.now(),
        eventType: 'chat',
      };
      setChatHistory((prev) => [...prev.slice(-149), chatItem]);
    };

    const processLikeEvent = (data: { likeCount?: number }) => {
      lastActivityRef.current = Date.now();
      const added = Math.max(1, Number(data?.likeCount) || 1);
      setTiktokStatus((prev) => ({
        ...prev,
        chatEventsProcessed: prev.chatEventsProcessed + 1,
        likesCount: prev.likesCount + added,
      }));
    };

    const processGiftEvent = (data: {
      diamondCount?: number;
      repeatCount?: number;
      repeatEnd?: boolean;
    }) => {
      lastActivityRef.current = Date.now();
      if (data?.repeatEnd === false) return;
      const diamonds =
        Math.max(1, Number(data?.diamondCount) || 1) *
        Math.max(1, Number(data?.repeatCount) || 1);
      setTiktokStatus((prev) => ({
        ...prev,
        chatEventsProcessed: prev.chatEventsProcessed + 1,
        giftsDiamonds: prev.giftsDiamonds + diamonds,
      }));
      if (isOverlay) return;
      if (localGameRef.current) {
        localGameRef.current.requestHint();
        setGameState(localGameRef.current.getPublicState());
        sfx.playTileStep(0);
      }
    };

    socket.on('chat-message', (data: any) => {
      if (deduplicator.shouldProcess('chat', data)) {
        processChatEvent(data);
      }
    });

    socket.on('like-event', (data: any) => {
      if (deduplicator.shouldProcess('like', data)) {
        processLikeEvent(data);
      }
    });

    socket.on('gift-event', (data: any) => {
      if (deduplicator.shouldProcess('gift', data)) {
        processGiftEvent(data);
      }
    });

    const detachBridge = attachResilientChatListeners({
      gameId: 'wikirec',
      onChat: processChatEvent,
      onLike: processLikeEvent,
      onGift: processGiftEvent,
      deduplicator,
    });

    return () => {
      detachBridge();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [triggerWordAnnounce, isOverlay, isSoloRoute]);

  const switchMode = useCallback(
    (nextMode: GameMode) => {
      const targetMode = isSoloRoute && nextMode === 'multiplayer' ? 'daily-solo' : nextMode;
      setMode(targetMode);
      setGuessInput('');
      setDismissedRoundId(null);
      initLocalGame(targetMode);
    },
    [initLocalGame, isSoloRoute]
  );

  const submitWordGuess = useCallback(
    (wordRaw: string) => {
      const strippedPunctuation = String(wordRaw || '')
        .replace(/['’`]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim();
      const parts = strippedPunctuation.split(/\s+/).filter(Boolean);
      setGuessInput('');
      if (parts.length !== 1) return;
      const clean = parts[0].toLowerCase();
      if (!/^[a-z]{3,15}$/.test(clean)) return;

      if (localGameRef.current) {
        const finderInfo: FinderInfo = {
          displayName: displayNameRef.current,
          platform: 'web',
          platformUserId: sessionIdRef.current,
        };
        const outcome = localGameRef.current.guess(clean, finderInfo);
        const nextState = localGameRef.current.getPublicState();
        setGameState(nextState);
        if (nextState.isComplete && !prevCompleteRef.current) {
          sfx.playRoundWin();
          if (!isOverlay) {
            const topScore = nextState.topPlayers?.[0]?.score || 0;
            const bestKey = `mp_wikirec_best_score_${getCurrentUserSessionPrefix()}`;
            let prevBest = 0;
            try {
              prevBest = Number(localStorage.getItem(bestKey) || '0') || 0;
              if (topScore > prevBest) {
                localStorage.setItem(bestKey, String(topScore));
              }
            } catch {}
            if (topScore > 0) {
              saveUnifiedLeaderboardScore({
                gameId: 'wikirec',
                score: topScore,
                metricLabel: `${topScore.toLocaleString()} pts`,
              }).catch(() => {});
            }
            triggerVictoryConfetti({
              isDaily: mode === 'daily-solo',
              isNewHighScore: prevBest > 0 && topScore > prevBest,
            });
          }
        }
        prevCompleteRef.current = !!nextState.isComplete;

        if (outcome.result === 'correct') {
          sfx.playWordFound(outcome.tierName, outcome.isTitleWord);
          if (outcome.cells?.length) {
            setFlashedCells(outcome.cells);
            setTimeout(() => setFlashedCells([]), 900);
          }
          triggerWordAnnounce(outcome.finder.displayName, outcome.word, outcome.points);
          if (isSoloRoute) {
            const topScore = nextState.topPlayers?.[0]?.score || 0;
            if (topScore > 0) {
              saveUnifiedLeaderboardScore({
                gameId: 'wikirec',
                score: topScore,
                metricLabel: `${topScore.toLocaleString()} pts`,
              }).catch(() => {});
            }
          } else {
            const activeStreamerHandle =
              authorizedStreamerRef.current?.username ||
              getActiveInteractiveStreamerSession()?.username;
            if (activeStreamerHandle && outcome.points && outcome.points > 0) {
              creditInteractiveScoreByTikTokHandle({
                tiktokUsername: activeStreamerHandle,
                gameId: 'wikirec',
                pointsEarned: outcome.points,
                reason: `WiKirecTangled word: ${outcome.word.toUpperCase()}`,
              });
            }
          }
        } else if (outcome.result === 'already_found') {
          sfx.playAlreadyFound();
          if (outcome.cells?.length) {
            setFlashedCells(outcome.cells);
            setTimeout(() => setFlashedCells([]), 600);
          }
        } else if (outcome.rankPoints && outcome.rankPoints > 0) {
          sfx.playTileStep(2);
          triggerWordAnnounce(outcome.finder.displayName, outcome.word, outcome.rankPoints);
          const activeStreamerHandle =
            authorizedStreamerRef.current?.username ||
            getActiveInteractiveStreamerSession()?.username;
          if (activeStreamerHandle) {
            creditInteractiveScoreByTikTokHandle({
              tiktokUsername: activeStreamerHandle,
              gameId: 'wikirec',
              pointsEarned: outcome.rankPoints,
              reason: `WiKirecTangled close guess: ${outcome.word.toUpperCase()}`,
            });
          }
        } else if (outcome.result === 'miss_in_article') {
          sfx.playMiss(true);
        } else if (outcome.result === 'incorrect') {
          sfx.playMiss(false);
        }
      }
    },
    [triggerWordAnnounce]
  );

  const handleComposerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim()) return;
    submitWordGuess(guessInput);
  };

  const handleRequestHint = () => {
    if (localGameRef.current) {
      localGameRef.current.requestHint();
      setGameState(localGameRef.current.getPublicState());
      sfx.playTileStep(0);
    }
  };

  const handleNewRound = (_forceNewArticle = true) => {
    if (!isOverlay && !isSoloRoute) {
      const allowed = tryConsumeOrCheckNextRound('wikirec', gameState?.roundId);
      if (!allowed) return;
    }
    setDismissedRoundId(null);
    prevCompleteRef.current = false;
    setFlashedCells([]);
    setWordAnnounce({ word: '', points: 0, finderName: '', visible: false });
    initLocalGame(modeRef.current);
  };

  const handleSaveDisplayName = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = nameDraft.trim().slice(0, 24) || 'You';
    setDisplayName(cleaned);
    setIsEditingName(false);
    try {
      localStorage.setItem(STORAGE_NAME_KEY, cleaned);
    } catch {}
    if (localGameRef.current) {
      localGameRef.current.renamePlayer(sessionIdRef.current, cleaned);
      setGameState(localGameRef.current.getPublicState());
    }
  };

  // Scrambled order for unrevealed title chips (matching wikirectangled.com's renderTitleChips)
  const displayedTitleChips = useMemo(() => {
    const chips = gameState?.titleChips || [];
    const allRevealed = chips.length > 0 && chips.every((c) => c.revealed);
    if (allRevealed) return chips;
    const copy = [...chips];
    let seed = (gameState?.roundId || 'seed').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    for (let i = copy.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) | 0;
      const j = Math.abs(seed) % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [gameState?.titleChips, gameState?.roundId]);

  const allTitleRevealed = useMemo(() => {
    const chips = gameState?.titleChips || [];
    return chips.length > 0 && chips.every((c) => c.revealed);
  }, [gameState?.titleChips]);

  const topThreePlayers = useMemo(() => {
    const list = gameState?.topPlayers || [];
    return [list[0] || null, list[1] || null, list[2] || null];
  }, [gameState?.topPlayers]);

  useEffect(() => {
    const roundId = gameState?.roundId || null;
    if (roundId !== marqueeRoundIdRef.current) {
      marqueeRoundIdRef.current = roundId;
      seenMarqueeTagIdsRef.current.clear();
      laneFreeAtRef.current = [0, 0, 0];
      setMarqueeItems([]);
    }

    const tags = gameState?.recentTags || [];
    if (tags.length === 0) return;

    const foundCellLookup = new Map<string, number[]>();
    for (const fw of gameState?.foundWords || []) {
      foundCellLookup.set(fw.word.toLowerCase(), fw.cells || []);
    }

    const LANE_TOPS = [7, 48, 89];
    const SPEED_PX_PER_MS = 0.088;
    const MIN_HORIZONTAL_GAP_PX = 28;
    const stageW = marqueeCardRef.current?.clientWidth || 490;
    const now = performance.now();
    const newItems: MarqueeDanmakuItem[] = [];

    for (let idx = 0; idx < tags.length; idx++) {
      const tag = tags[idx];
      const tagKey = tag.id || `${tag.word}-${tag.ts}-${tag.displayName}-${idx}`;
      if (seenMarqueeTagIdsRef.current.has(tagKey)) continue;
      seenMarqueeTagIdsRef.current.add(tagKey);

      const wordUpper = tag.word.toUpperCase();
      const rawFinder = tag.displayName || displayName || 'You';
      const cleanFinder = rawFinder.replace(/^@/, '');
      const badge =
        tag.points && tag.points > 0
          ? `+${tag.points.toLocaleString()}`
          : tag.rank != null
          ? `#${formatRank(tag.rank)}`
          : tag.result === 'already_found'
          ? 'DUP'
          : tag.result === 'miss_in_article'
          ? 'WIKI'
          : '';

      const estWidthPx = Math.ceil(
        64 +
          wordUpper.length * 11.5 +
          Math.min(110, cleanFinder.length * 8.5) +
          (badge ? badge.length * 8.5 + 10 : 0)
      );

      const freeLanes: number[] = [];
      let earliestFreeAt = Infinity;
      for (let l = 0; l < LANE_TOPS.length; l++) {
        const freeAt = laneFreeAtRef.current[l];
        if (freeAt <= now) {
          freeLanes.push(l);
        }
        if (freeAt < earliestFreeAt) {
          earliestFreeAt = freeAt;
        }
      }

      let chosenLane: number;
      if (freeLanes.length > 0) {
        chosenLane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
      } else {
        const nearEarliest = LANE_TOPS.map((_, l) => l).filter(
          (l) => laneFreeAtRef.current[l] <= earliestFreeAt + 180
        );
        chosenLane = nearEarliest[Math.floor(Math.random() * nearEarliest.length)];
      }

      const launchAt = Math.max(now, laneFreeAtRef.current[chosenLane]);
      const delayMs = Math.max(0, Math.round(launchAt - now));
      const clearRightEdgeMs = (estWidthPx + MIN_HORIZONTAL_GAP_PX) / SPEED_PX_PER_MS;
      laneFreeAtRef.current[chosenLane] = launchAt + clearRightEdgeMs;

      const jitter = Math.round((Math.random() - 0.5) * 4);
      const topPx = LANE_TOPS[chosenLane] + jitter;
      const travelPx = stageW + estWidthPx + 40;
      const durationMs = Math.round(travelPx / SPEED_PX_PER_MS);

      newItems.push({
        uid: `${tagKey}-${Math.random().toString(36).slice(2, 6)}`,
        word: wordUpper,
        displayName: rawFinder,
        profileImage: tag.profileImage || null,
        badge,
        result: tag.result,
        cells: foundCellLookup.get(tag.word.toLowerCase()) || [],
        topPx,
        durationMs,
        delayMs,
        travelPx,
      });
    }

    if (seenMarqueeTagIdsRef.current.size > 400) {
      const activeIds = new Set(
        tags.map((t, idx) => t.id || `${t.word}-${t.ts}-${t.displayName}-${idx}`)
      );
      seenMarqueeTagIdsRef.current = activeIds;
    }

    if (newItems.length > 0) {
      setMarqueeItems((prev) => [...prev, ...newItems]);
    }
  }, [gameState?.roundId, gameState?.recentTags, gameState?.foundWords, displayName]);

  const searchWordGroups = useMemo(() => {
    const all = gameState?.searchWords || [];
    return {
      title: all.filter((w) => w.tier === 'title'),
      common: all.filter((w) => w.tier === 'common'),
      rare: all.filter((w) => w.tier === 'rare'),
      ultra: all.filter((w) => w.tier === 'ultra'),
    };
  }, [gameState?.searchWords]);

  const handleQuickSimChat = () => {
    const unrevealed = (gameState?.searchWords || []).filter(
      (w) => !w.revealed && (w.unmaskedWord || w.word)
    );
    const chosenSlot =
      unrevealed.length > 0
        ? unrevealed[Math.floor(Math.random() * unrevealed.length)]
        : null;
    const chosen = (chosenSlot?.unmaskedWord || chosenSlot?.word || 'planet').toLowerCase();
    const simViewers = [
      { uniqueId: 'lexi_wordsmith', nickname: 'Lexi Wordsmith' },
      { uniqueId: 'boggle_king99', nickname: 'BoggleKing' },
      { uniqueId: 'wiki_hunter_tt', nickname: 'WikiHunter' },
      { uniqueId: 'puzzle_champ', nickname: 'PuzzleChamp' },
    ];
    const viewer = simViewers[Math.floor(Math.random() * simViewers.length)];

    emitResilientEvent(socketRef.current, 'chat-message', {
      uniqueId: viewer.uniqueId,
      nickname: viewer.nickname,
      comment: chosen,
      profilePictureUrl: `https://i.pravatar.cc/150?u=${encodeURIComponent(viewer.uniqueId)}`,
    });
  };

  const chatOnlyItems = useMemo(
    () => chatHistory.filter((item) => !item.eventType || item.eventType === 'chat'),
    [chatHistory]
  );

  useEffect(() => {
    const scrollToLatest = () => {
      const el = chatListRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    };
    scrollToLatest();
    const rafId = requestAnimationFrame(scrollToLatest);
    const timerId = window.setTimeout(scrollToLatest, 60);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [chatOnlyItems, chatOnlyItems.length, authorizedStreamer, tiktokStatus.connected]);

  // Count completed interactive rounds toward the 3/day free limit (unlimited for key holders)
  useEffect(() => {
    if (isOverlay || isSoloRoute) return;
    if (gameState?.isComplete && gameState.roundId) {
      recordInteractiveRoundCompleted('wikirec', gameState.roundId);
    }
  }, [isOverlay, isSoloRoute, gameState?.isComplete, gameState?.roundId]);

  const isSolo = mode === 'daily-solo' || mode === 'practice-solo';
  const showVictoryModal =
    gameState?.isComplete && dismissedRoundId !== gameState.roundId;

  const syncedSnapshot = useMemo(
    () =>
      !isOverlay && !isSoloRoute && gameState
        ? {
            gameState,
            flashedCells,
            wordAnnounce,
            dismissedRoundId,
          }
        : null,
    [isOverlay, isSoloRoute, gameState, flashedCells, wordAnnounce, dismissedRoundId]
  );

  useOverlaySync<{
    gameState: PublicGameState | null;
    flashedCells: number[];
    wordAnnounce: {
      word: string;
      points: number;
      finderName: string;
      visible: boolean;
    };
    dismissedRoundId: string | null;
  }>({
    gameId: 'wikirec',
    streamer: isOverlay
      ? overlayStreamer || undefined
      : authorizedStreamer?.username || tiktokStatus.username || undefined,
    isOverlay,
    localState: syncedSnapshot,
    onSyncedState: useCallback((remote) => {
      if (!remote || !remote.gameState) return;
      hasReceivedHostSyncRef.current = true;
      localGameRef.current = null;
      setGameState(remote.gameState);
      if (!remote.gameState.isComplete) {
        prevCompleteRef.current = false;
      }
      setDismissedRoundId(remote.dismissedRoundId ?? null);
      if (Array.isArray(remote.flashedCells)) {
        setFlashedCells(remote.flashedCells);
      }
      if (remote.wordAnnounce) {
        setWordAnnounce(remote.wordAnnounce);
      }
    }, []),
  });

  return (
    <div
      className={`wikirec-root ${isOverlay ? 'wikirec-overlay' : ''} ${
        isOverlay && overlayBg === 'transparent' ? 'wikirec-overlay-transparent' : ''
      }`}
    >
      {logoutNotice && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            backgroundColor: '#facc15',
            color: '#2d0938',
            padding: '8px 16px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⚠️ {logoutNotice}</span>
          <button
            type="button"
            onClick={() => setLogoutNotice(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#2d0938',
              cursor: 'pointer',
              fontWeight: 'bold',
              marginLeft: '8px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Account & Navigation Bar */}
      {!isOverlay && (
      <div
        style={{
          width: '100%',
          maxWidth: '1220px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 8px 4px',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to={isSoloRoute ? '/solo-games' : '/interactive-games'} className="back-games-btn" style={{ textDecoration: 'none', fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 10px' }}>
            ← Back
          </Link>
          <Link
            to="/"
            title="Return to Home Screen"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              color: '#faf5ff',
              fontWeight: 800,
              fontSize: '13px',
            }}
          >
            <img
              src="/brand-logo.png"
              alt="The Missing Piece Home"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                objectFit: 'cover',
                border: '1px solid rgba(251, 191, 36, 0.5)',
              }}
            />
            <span>WiKirecTangled</span>
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isSoloRoute && (
            <LiveOverlayButton
              gameTitle="WiKirecTangled"
              gameSlug="wikirec"
              streamerHandle={authorizedStreamer?.username || tiktokStatus.username}
              recommendedSize="540 × 1200 or 1080 × 2400 (20:9)"
            />
          )}
          <LoggedInIndicator />
        </div>
      </div>
      )}

      <div className="app-stage">
        {/* LEFT BOX: TIKTOK LIVE CONNECT & LIVE CHAT STREAM (Hidden in overlay & solo games mode) */}
        {!isOverlay && !isSoloRoute && (
        <aside className="side-box left-chat-box" aria-label="TikTok Live Connect & Chat Stream">
          <div className="side-box-header">
            <div className="side-box-title">
              <span className={`live-dot ${tiktokStatus.connected ? 'connected' : ''}`} />
              <span>TIKTOK LIVE CONNECT</span>
            </div>
            {authorizedStreamer ? (
              <button
                type="button"
                className="side-box-action"
                onClick={() => handleStreamerLogout('manual')}
                title="Log out of Streamer Key session"
              >
                Log out
              </button>
            ) : (
              <button
                type="button"
                className="side-box-action"
                onClick={() => setStreamerLoginOpen(true)}
              >
                Key Login
              </button>
            )}
          </div>

          {/* LIVE CONNECT SECTION (Inline inside the left box) */}
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--bg-2)',
              borderBottom: '1.5px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: authorizedStreamer ? '#fbbf24' : 'var(--text-dim)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {authorizedStreamer ? `✓ @${authorizedStreamer.username}` : 'Free Access (3/day)'}
                </span>
                <span
                  style={{
                    color: tiktokStatus.connected ? 'var(--accent-green)' : 'var(--text-dim)',
                    fontWeight: 800,
                    fontSize: '11px',
                  }}
                >
                  {tiktokStatus.connected
                    ? `● Connected (@${tiktokStatus.username || authorizedStreamer?.username || 'live'})`
                    : inlineConnecting
                    ? 'Connecting...'
                    : '○ Disconnected'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => handleInlineProviderChange('tikfinity')}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: '1px solid var(--border-soft)',
                    background: inlineChatProvider === 'tikfinity' ? 'var(--accent-orange)' : 'var(--bg)',
                    color: inlineChatProvider === 'tikfinity' ? '#2d0938' : 'var(--text-dim)',
                  }}
                >
                  Tikfinity
                </button>
                <button
                  type="button"
                  onClick={() => handleInlineProviderChange('bettertok')}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: '1px solid var(--border-soft)',
                    background: inlineChatProvider === 'bettertok' ? 'var(--accent-orange)' : 'var(--bg)',
                    color: inlineChatProvider === 'bettertok' ? '#2d0938' : 'var(--text-dim)',
                  }}
                >
                  BetterTok
                </button>
              </div>

                <form
                  onSubmit={(e) => handleInlineConnect(e, false)}
                  style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
                >
                  <input
                    type="text"
                    value={inlineLiveHandle}
                    onChange={(e) => {
                      const v = e.target.value;
                      setInlineLiveHandle(v.startsWith('@') ? v : `@${v.replace(/^@+/, '')}`);
                    }}
                    placeholder="@username (live on TikTok)"
                    style={{
                      width: '100%',
                      padding: '6px 9px',
                      borderRadius: '8px',
                      background: 'var(--bg)',
                      border: '1px solid var(--border-soft)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                  />
                  {tiktokStatus.connected ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={handleInlineReconnect}
                        className="side-footer-btn"
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderColor: 'rgba(251, 191, 36, 0.5)',
                          color: '#fbbf24',
                        }}
                        title="Force hard refresh of Socket.IO & resilient bridge handshake"
                      >
                        ↻ Reconnect
                      </button>
                      <button
                        type="button"
                        onClick={handleInlineDisconnect}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '8px',
                          background: 'var(--accent-red)',
                          color: '#fff',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      <button
                        type="submit"
                        className="side-footer-btn primary"
                        style={{ flex: 1, padding: '6px 8px' }}
                      >
                        {inlineConnecting ? 'Connecting...' : 'Connect Live'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleInlineConnect(e as unknown as React.FormEvent, true)}
                        className="side-footer-btn"
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderColor: 'rgba(158, 234, 58, 0.5)',
                          color: 'var(--accent-green)',
                        }}
                      >
                        Test Mode
                      </button>
                      <button
                        type="button"
                        onClick={handleInlineReconnect}
                        className="side-footer-btn"
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          borderColor: 'rgba(251, 191, 36, 0.45)',
                          color: '#fbbf24',
                        }}
                        title="Force hard refresh of Socket.IO & resilient bridge handshake"
                      >
                        ↻ Reconnect Bridge
                      </button>
                    </div>
                  )}
                </form>

                {tiktokStatus.lastError && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#fca5a5',
                      background: 'rgba(212, 63, 63, 0.15)',
                      border: '1px solid rgba(212, 63, 63, 0.4)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                    }}
                  >
                    {tiktokStatus.lastError}
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '4px',
                    textAlign: 'center',
                    paddingTop: '4px',
                    borderTop: '1px solid var(--border)',
                    fontSize: '10px',
                    color: 'var(--text-dim)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: '12px' }}>
                      {tiktokStatus.guessesFromChat}
                    </div>
                    <div>Guesses</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: '12px' }}>
                      {tiktokStatus.likesCount}
                    </div>
                    <div>Likes</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--gold)', fontSize: '12px' }}>
                      {tiktokStatus.giftsDiamonds}
                    </div>
                    <div>Gifts</div>
                  </div>
                </div>
              </div>
          </div>

          <div className="side-box-body chat-stream-list" ref={chatListRef}>
            {chatOnlyItems.length === 0 ? (
              <div className="side-box-empty">
                <p>
                  {tiktokStatus.connected
                    ? 'Waiting for live chat & player guesses...'
                    : 'Ready · Click Connect Live or Test Mode above'}
                </p>
                <span>
                  {tiktokStatus.connected
                    ? 'Live chat messages and word guesses from viewers will appear in real-time.'
                    : 'Viewer guesses from TikTok Live chat automatically solve words on the board.'}
                </span>
              </div>
            ) : (
              chatOnlyItems.map((item) => {
                const nameLabel = (item.displayName || item.username || 'Player').replace(/^@/, '');
                const initial = nameLabel[0]?.toUpperCase() || '?';
                return (
                  <div
                    key={item.id}
                    className={`chat-stream-item ${
                      item.guessResult === 'correct' ? 'is-correct' : ''
                    }`}
                  >
                    <div className="csi-avatar">
                      <img
                        src={resolvePlayerAvatar(item.profileImage, nameLabel)}
                        alt={nameLabel}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          const fallback = `https://i.pravatar.cc/150?u=${encodeURIComponent(nameLabel)}`;
                          if (target.src !== fallback) {
                            target.src = fallback;
                          }
                        }}
                      />
                    </div>
                    <div className="csi-content">
                      <div className="csi-top">
                        <span className="csi-name">{nameLabel}</span>
                        {item.points && item.points > 0 ? (
                          <span className="csi-badge correct">
                            +{item.points.toLocaleString()}
                          </span>
                        ) : item.guessResult === 'already_found' ? (
                          <span className="csi-badge dup">DUP</span>
                        ) : item.guessResult === 'miss_in_article' ? (
                          <span className="csi-badge wiki">WIKI</span>
                        ) : (
                          <span className="csi-badge miss">CHAT</span>
                        )}
                      </div>
                      <div className="csi-comment">{item.comment}</div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="side-box-footer">
            <button
              type="button"
              className="side-footer-btn"
              onClick={handleQuickSimChat}
            >
              + Sim Guess
            </button>
            <button
              type="button"
              className="side-footer-btn primary"
              onClick={handleOpenTikTokLive}
            >
              {authorizedStreamer ? 'Live Hub & Key' : 'TikTok Live'}
            </button>
          </div>
        </aside>
        )}

        {/* CENTER COLUMN: MAIN WIKIRECTANGLED GAME */}
        <div className="game-center-col">
          {/* TOPBAR — Exact wikirectangled.com structure */}
          <header className="topbar">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                switchMode(isSoloRoute ? 'daily-solo' : 'multiplayer');
              }}
              className="logo-text"
              id="logo"
            >
              <span>WiKi</span>
              <span className="accent">rec</span>
              <span className="green">Tangled</span>
            </a>

            <div className="topbar-spacer" />

            <div className="counts">
              <span className="count g" title="Grid words found">
                <span className="badge">G</span>
                <b id="grid-found">{gameState?.foundCount || 0}</b>
              </span>
              <span
                className={`count t ${(gameState?.revealedTitleWordCount || 0) > 0 ? 'has-found' : ''}`}
                title="Title words revealed"
              >
                <span className="badge">T</span>
                <b id="title-found">{gameState?.revealedTitleWordCount || 0}</b>
                <span className="slash">/</span>
                <span className="total" id="title-total">
                  {gameState?.titleWordCount || 0}
                </span>
              </span>
              <span className="count c" title="Common words target">
                <span className="badge">C</span>
                <b id="common-found">{gameState?.foundCommonCount || 0}</b>
                <span className="slash">/</span>
                <span className="total" id="common-total">
                  {gameState?.commonWordTarget || 0}
                </span>
              </span>
            </div>

            {!isOverlay && (
              <>
                <DailyStreakBadge
                  streak={dailyStreak.streak}
                  solvedToday={dailyStreak.solvedToday}
                  variant="gold"
                  compact
                />
                {/* Hint button */}
                <button
                  type="button"
                  onClick={handleRequestHint}
                  className="mute-toggle"
                  title="Reveal a tile hint"
                  aria-label="Reveal Hint"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                    <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
                  </svg>
                </button>

                {/* TikTok Live Chat & Streamer Relay Button */}
                {!isSoloRoute && (
                <button
                  type="button"
                  onClick={handleOpenTikTokLive}
                  className={`tiktok-pill-btn ${tiktokStatus.connected ? 'live' : ''} ${authorizedStreamer ? 'authorized' : ''}`}
                  title={
                    authorizedStreamer
                      ? `Logged in as @${authorizedStreamer.username} · Open TikTok Live Hub`
                      : 'Log in with registered @username and key to open TikTok Live'
                  }
                >
                  <span>
                    {tiktokStatus.connected && tiktokStatus.username
                      ? `● @${tiktokStatus.username}`
                      : authorizedStreamer
                      ? `Connect @${authorizedStreamer.username}`
                      : 'Connect Live'}
                  </span>
                  {tiktokStatus.guessesFromChat > 0 && (
                    <span>({tiktokStatus.guessesFromChat})</span>
                  )}
                </button>
                )}

                {/* Sound Mute Toggle */}
                <button
                  className={`mute-toggle ${muted ? 'muted' : ''}`}
                  id="muteToggle"
                  type="button"
                  onClick={() => setMuted(sfx.toggleMute())}
                  aria-pressed={muted}
                  aria-label="Toggle sound"
                >
                  {!muted ? (
                    <svg
                      className="icon-sound"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  ) : (
                    <svg
                      className="icon-muted"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="22" y1="9" x2="16" y2="15" />
                      <line x1="16" y1="9" x2="22" y2="15" />
                    </svg>
                  )}
                </button>
              </>
            )}
          </header>

      {/* MAIN 2-COLUMN LAYOUT — Exact wikirectangled.com structure */}
      <main className="layout">
        {/* LEFT COLUMN: Title Block + 3-Player Podium */}
        <section className="left-col">
          <div className="title-block">
            <div className="title-eyebrow">
              <span>TITLE</span>
              {gameState?.activeHint && (
                <span style={{ color: 'var(--accent-green)', letterSpacing: '0.04em' }}>
                  {gameState.activeHint.revealedPrefix}... ({gameState.activeHint.wordLength}L)
                </span>
              )}
            </div>

            <div className="title-chips" id="title-chips">
              {allTitleRevealed && gameState?.articleTitle ? (
                gameState.articleTitle.split(/\s+/).map((tok, idx) => (
                  <span key={idx} className="title-chip revealed">
                    {tok.toUpperCase()}
                  </span>
                ))
              ) : (
                displayedTitleChips.map((chip) => (
                  <span
                    key={chip.index}
                    className={`title-chip ${chip.revealed ? 'revealed' : 'hidden-word'}`}
                  >
                    {chip.revealed && chip.word ? chip.word.toUpperCase() : 'HIDDEN'}
                  </span>
                ))
              )}
            </div>

            <div
              className="title-tier-status"
              id="title-tier-status"
              data-active={
                allTitleRevealed &&
                gameState?.currentTierPhase &&
                gameState.currentTierPhase !== 'complete'
                  ? 'true'
                  : 'false'
              }
              data-tier={gameState?.currentTierPhase || 'common'}
            >
              {allTitleRevealed &&
              gameState?.currentTierPhase &&
              gameState.currentTierPhase !== 'complete'
                ? `Searching for ${gameState.currentTierPhase} words`
                : ''}
            </div>
          </div>

          <div className="leader-spacer" />

          {/* 3-Player Podium Row (.first, .second, .third) */}
          <div className="players-row" id="players-row">
            {(['first', 'second', 'third'] as const).map((rankClass, i) => {
              const player = topThreePlayers[i];
              const rankLabel = i === 0 ? '1st' : i === 1 ? '2nd' : '3rd';
              const cleanPlayerName = player
                ? (player.displayName || 'Player').replace(/^@/, '')
                : 'Open';
              return (
                <div
                  key={rankClass}
                  className={`player-card ${rankClass}${player ? '' : ' is-empty'}`}
                >
                  <span className="prank-badge">{rankLabel}</span>
                  <div className="pfp">
                    {player ? (
                      <img
                        src={resolvePlayerAvatar(player.profileImage, cleanPlayerName)}
                        alt={cleanPlayerName}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          const fallback = `https://i.pravatar.cc/150?u=${encodeURIComponent(cleanPlayerName)}`;
                          if (target.src !== fallback) {
                            target.src = fallback;
                          }
                        }}
                      />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div className="pname" title={cleanPlayerName}>
                    {cleanPlayerName}
                  </div>
                  <div className="pscore">
                    {player ? player.score.toLocaleString() : '0'}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT COLUMN: Words Being Looked For (in Solo Mode) OR 5 Capsule-in-Capsule Target Cards (in Multiplayer) */}
        <section className="right-col">
          {isSoloMode ? (
            <div className="solo-target-words-card" id="solo-target-words-card">
              <div className="solo-tw-header">
                <span className="solo-tw-title">WORDS BEING LOOKED FOR</span>
                <span className="solo-tw-counter">
                  {(gameState?.revealedTitleWordCount || 0) +
                    (gameState?.foundCommonCount || 0) +
                    (gameState?.foundRareCount || 0) +
                    (gameState?.foundUltraCount || 0)}
                  /
                  {(gameState?.titleWordCount || 0) +
                    (gameState?.commonWordTarget || 0) +
                    (gameState?.rareWordTarget || 0) +
                    (gameState?.ultraWordTarget || 0)}
                </span>
              </div>
              <div className="solo-tw-body">
                {/* Title Words Group */}
                {searchWordGroups.title.length > 0 && (
                  <div className="tw-group">
                    <div className="tw-group-header tier-title">
                      <span className="tw-tier-label">
                        <span className="badge-dot t">T</span> TITLE WORDS
                      </span>
                      <span className="tw-tier-count">
                        {gameState?.revealedTitleWordCount || 0}/{gameState?.titleWordCount || 0}
                      </span>
                    </div>
                    <div className="tw-chips-grid">
                      {searchWordGroups.title.map((slot) => (
                        <div
                          key={slot.id}
                          className={`tw-slot ${slot.revealed ? 'found title-found' : 'unfound'}`}
                          onMouseEnter={() => {
                            if (slot.revealed && slot.cells?.length) setFlashedCells(slot.cells);
                          }}
                          onMouseLeave={() => setFlashedCells([])}
                        >
                          <span className="tw-slot-word">
                            {slot.revealed && slot.word
                              ? slot.word
                              : `${slot.startLetter}${'•'.repeat(Math.max(1, slot.length - 1))}`}
                          </span>
                          <span className="tw-slot-meta">
                            {slot.revealed ? '✓' : `${slot.length}L`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Common Words Group */}
                {searchWordGroups.common.length > 0 && (
                  <div className="tw-group">
                    <div className="tw-group-header tier-common">
                      <span className="tw-tier-label">
                        <span className="badge-dot c">C</span> COMMON WORDS
                      </span>
                      <span className="tw-tier-count">
                        {gameState?.foundCommonCount || 0}/{gameState?.commonWordTarget || 0}
                      </span>
                    </div>
                    <div className="tw-chips-grid">
                      {searchWordGroups.common.map((slot) => (
                        <div
                          key={slot.id}
                          className={`tw-slot ${slot.revealed ? 'found common-found' : 'unfound'}`}
                          onMouseEnter={() => {
                            if (slot.revealed && slot.cells?.length) setFlashedCells(slot.cells);
                          }}
                          onMouseLeave={() => setFlashedCells([])}
                        >
                          <span className="tw-slot-word">
                            {slot.revealed && slot.word
                              ? slot.word
                              : `${slot.startLetter}${'•'.repeat(Math.max(1, slot.length - 1))}`}
                          </span>
                          <span className="tw-slot-meta">
                            {slot.revealed ? '✓' : `${slot.length}L`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rare Words Group */}
                {searchWordGroups.rare.length > 0 && (
                  <div className="tw-group">
                    <div className="tw-group-header tier-rare">
                      <span className="tw-tier-label">
                        <span className="badge-dot r">R</span> RARE WORDS
                      </span>
                      <span className="tw-tier-count">
                        {gameState?.foundRareCount || 0}/{gameState?.rareWordTarget || 0}
                      </span>
                    </div>
                    <div className="tw-chips-grid">
                      {searchWordGroups.rare.map((slot) => (
                        <div
                          key={slot.id}
                          className={`tw-slot ${slot.revealed ? 'found rare-found' : 'unfound'}`}
                          onMouseEnter={() => {
                            if (slot.revealed && slot.cells?.length) setFlashedCells(slot.cells);
                          }}
                          onMouseLeave={() => setFlashedCells([])}
                        >
                          <span className="tw-slot-word">
                            {slot.revealed && slot.word
                              ? slot.word
                              : `${slot.startLetter}${'•'.repeat(Math.max(1, slot.length - 1))}`}
                          </span>
                          <span className="tw-slot-meta">
                            {slot.revealed ? '✓' : `${slot.length}L`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ultra Words Group */}
                {searchWordGroups.ultra.length > 0 && (
                  <div className="tw-group">
                    <div className="tw-group-header tier-ultra">
                      <span className="tw-tier-label">
                        <span className="badge-dot u">U</span> ULTRA RARE
                      </span>
                      <span className="tw-tier-count">
                        {gameState?.foundUltraCount || 0}/{gameState?.ultraWordTarget || 0}
                      </span>
                    </div>
                    <div className="tw-chips-grid">
                      {searchWordGroups.ultra.map((slot) => (
                        <div
                          key={slot.id}
                          className={`tw-slot ${slot.revealed ? 'found ultra-found' : 'unfound'}`}
                          onMouseEnter={() => {
                            if (slot.revealed && slot.cells?.length) setFlashedCells(slot.cells);
                          }}
                          onMouseLeave={() => setFlashedCells([])}
                        >
                          <span className="tw-slot-word">
                            {slot.revealed && slot.word
                              ? slot.word
                              : `${slot.startLetter}${'•'.repeat(Math.max(1, slot.length - 1))}`}
                          </span>
                          <span className="tw-slot-meta">
                            {slot.revealed ? '✓' : `${slot.length}L`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div id="target-cards">
              {(gameState?.targets || []).map((t: TargetCard) => {
                const isPlaceholder = !t.revealed || !t.word;
                const isRevealedTarget = !!t.isTarget;
                const cardColor = getTargetCardHue(
                  t.rank,
                  gameState?.totalRankedWords || 50000
                );
                const finderName = t.finder
                  ? (t.finder.displayName || 'Player').replace(/^@/, '')
                  : '';

                return (
                  <div
                    key={t.position}
                    className={`tcard ${isRevealedTarget ? 'revealed' : ''} ${
                      isPlaceholder ? 'placeholder' : ''
                    }`}
                  >
                    <div
                      className="tcard-body"
                      style={
                        {
                          '--card-color': cardColor,
                          '--close': (t.closeness || 0).toFixed(3),
                        } as React.CSSProperties
                      }
                    >
                      <div className="tcard-fill" />

                      <div className="tlabel">
                        <span className="trank">
                          #{isPlaceholder ? t.position : formatRank(t.rank)}
                        </span>
                        <span className="tword">
                          {t.word ? t.word.toUpperCase() : '•••••'}
                        </span>
                      </div>

                      {t.finder && !isPlaceholder && (
                        <div className="tfinder">
                          <div className="tpfp">
                            <img
                              src={resolvePlayerAvatar(t.finder.profileImage, finderName)}
                            alt={finderName}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.currentTarget;
                              const fallback = `https://i.pravatar.cc/150?u=${encodeURIComponent(finderName)}`;
                              if (target.src !== fallback) {
                                target.src = fallback;
                              }
                            }}
                          />
                        </div>
                        <div className="tname">{finderName}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </section>

      </main>

      {isOverlay && !gameState && (
        <div
          style={{
            margin: '10px 0',
            padding: '10px 14px',
            borderRadius: '12px',
            background: '#240630',
            border: '1.5px solid rgba(250, 204, 21, 0.5)',
            color: '#facc15',
            fontSize: '12px',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          Waiting for Host Game Sync...
        </div>
      )}

      {/* 9x5 BOGGLE KEYCAP LETTER GRID */}
      <BoggleGrid
        key={`wk-grid-${gameState?.roundId || 'none'}`}
        grid={gameState?.grid || []}
        rows={gameState?.rows || 5}
        cols={gameState?.cols || 9}
        activeTierStartCells={gameState?.activeTierStartCells || []}
        activeCommonCells={gameState?.activeCommonCells || []}
        typedWord={guessInput}
        flashedCells={flashedCells}
        activeHint={gameState?.activeHint}
        onSwipeWordSubmit={submitWordGuess}
        onSwipePreviewChange={setSwipePreview}
      />

      {/* 3X HEIGHT SINGLE-PASS NON-OVERLAPPING ANSWER MARQUEE (Between board and guess entry box) */}
      <div
        key={`wk-mq-${gameState?.roundId || 'none'}`}
        ref={marqueeCardRef}
        className="found-words-card"
        id="found-words-card"
        aria-live="polite"
        onMouseEnter={() => {
          marqueeHoverStartRef.current = performance.now();
        }}
        onMouseLeave={() => {
          if (marqueeHoverStartRef.current !== null) {
            const pausedMs = performance.now() - marqueeHoverStartRef.current;
            marqueeHoverStartRef.current = null;
            laneFreeAtRef.current = laneFreeAtRef.current.map((t) =>
              t > 0 ? t + pausedMs : 0
            );
          }
          setFlashedCells([]);
        }}
      >
        {marqueeItems.length === 0 ? (
          <div className="found-word-empty">
            {swipePreview || guessInput
              ? `Preview: ${(swipePreview || guessInput).toUpperCase()}`
              : 'Submitted answers scroll here...'}
          </div>
        ) : (
          <div className="fw-marquee-stage" id="found-words-list">
            {marqueeItems.map((item) => {
              const cleanFinder = (item.displayName || 'You').replace(/^@/, '');
              const fallbackUrl = `https://i.pravatar.cc/150?u=${encodeURIComponent(cleanFinder)}`;
              const itemVars = {
                '--wk-top': `${item.topPx}px`,
                '--wk-dur': `${item.durationMs}ms`,
                '--wk-delay': `${item.delayMs}ms`,
                '--wk-travel': `${item.travelPx}px`,
              } as React.CSSProperties;
              return (
                <div
                  key={item.uid}
                  style={itemVars}
                  className={`found-word-item wk-danmaku-item ${
                    item.cells.length > 0 ? 'is-flashable' : ''
                  }`}
                  onAnimationEnd={() => {
                    setMarqueeItems((prev) => prev.filter((x) => x.uid !== item.uid));
                  }}
                  onMouseEnter={() => {
                    if (item.cells.length > 0) {
                      setFlashedCells(item.cells);
                    }
                  }}
                  onMouseLeave={() => setFlashedCells([])}
                >
                  <span className="fw-avatar-wrap">
                    <img
                      src={resolvePlayerAvatar(item.profileImage, cleanFinder)}
                      alt={cleanFinder}
                      referrerPolicy="no-referrer"
                      className="fw-fallback"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== fallbackUrl) {
                          target.src = fallbackUrl;
                        }
                      }}
                    />
                  </span>
                  <span className="fw-word">{item.word}</span>
                  <span className="fw-finder">{cleanFinder}</span>
                  {item.badge && (
                    <span
                      className={`fw-pts ${
                        item.result === 'already_found'
                          ? 'is-dup'
                          : !item.badge.startsWith('+')
                          ? 'is-neutral'
                          : ''
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COMPOSER (hidden in LIVE Studio overlay) */}
      {!isOverlay && (
      <form
        className="composer"
        id="composer"
        autoComplete="off"
        onSubmit={handleComposerSubmit}
      >
        <input
          type="text"
          id="guess-input"
          value={guessInput}
          onChange={(e) => setGuessInput(e.target.value)}
          aria-label="Guess a word"
          placeholder={swipePreview ? `Swiping: ${swipePreview}` : 'Type or Swipe'}
          autoComplete="off"
        />
        <button type="submit">Guess</button>
        {isSolo ? (
          <button
            type="button"
            id="end-solo"
            className="ghost"
            onClick={() => handleNewRound(true)}
          >
            End run
          </button>
        ) : (
          <button
            type="button"
            className="ghost"
            onClick={() => handleNewRound(true)}
            title="Start a new puzzle article"
          >
            Skip
          </button>
        )}
      </form>
      )}

      {/* WIN-CONDITION STRIP (T, C, R, U) */}
      <div className="win-strip" id="win-strip">
        <span className="count t">
          <span className="badge">T</span>
          <b id="win-title-found">{gameState?.revealedTitleWordCount || 0}</b>
          <span className="slash">/</span>
          <span className="total" id="win-title-total">
            {gameState?.titleWordCount || 0}
          </span>
        </span>
        <span className="count c">
          <span className="badge">C</span>
          <b id="win-common-found">{gameState?.foundCommonCount || 0}</b>
          <span className="slash">/</span>
          <span className="total" id="win-common-total">
            {gameState?.commonWordTarget || 0}
          </span>
        </span>
        <span className="count r">
          <span className="badge">R</span>
          <b id="win-rare-found">{gameState?.foundRareCount || 0}</b>
          <span className="slash">/</span>
          <span className="total" id="win-rare-total">
            {gameState?.rareWordTarget || 0}
          </span>
        </span>
        <span className="count u">
          <span className="badge">U</span>
          <b id="win-ultra-found">{gameState?.foundUltraCount || 0}</b>
          <span className="slash">/</span>
          <span className="total" id="win-ultra-total">
            {gameState?.ultraWordTarget || 0}
          </span>
        </span>
      </div>

      {/* PLAYER STRIP & FOOTER (hidden in LIVE Studio overlay) */}
      {!isOverlay && (
      <>
      <div className="player-strip">
        {isEditingName ? (
          <form
            onSubmit={handleSaveDisplayName}
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
          >
            <span>Playing as</span>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              style={{
                background: 'var(--panel)',
                color: 'var(--text)',
                border: '1px solid var(--accent-orange)',
                borderRadius: '6px',
                padding: '2px 8px',
                width: '120px',
                font: 'inherit',
              }}
              autoFocus
            />
            <button type="submit" className="link-btn">
              Save
            </button>
          </form>
        ) : (
          <>
            Playing as{' '}
            <button
              type="button"
              id="rename-link"
              className="link-btn"
              onClick={() => {
                setNameDraft(displayName);
                setIsEditingName(true);
              }}
              aria-label="Change display name"
            >
              {displayName}
            </button>
          </>
        )}
        {!isSoloRoute && (
          <>
            {' · '}
            <button
              type="button"
              className={`link-btn ${mode === 'multiplayer' ? 'active-mode' : ''}`}
              onClick={() => switchMode('multiplayer')}
            >
              Multiplayer →
            </button>
          </>
        )}
        {' · '}
        <button
          type="button"
          className={`link-btn ${mode === 'daily-solo' ? 'active-mode' : ''}`}
          onClick={() => switchMode('daily-solo')}
        >
          Daily Solo →
        </button>
        {' · '}
        <button
          type="button"
          className={`link-btn ${mode === 'practice-solo' ? 'active-mode' : ''}`}
          onClick={() => switchMode('practice-solo')}
        >
          Practice →
        </button>
      </div>

      {/* LEGAL FOOTER */}
      <footer className="wt-legal-footer">
        {!isSoloRoute && (
          <>
            <button type="button" onClick={() => switchMode('multiplayer')}>
              Multiplayer
            </button>{' '}
            &middot;{' '}
          </>
        )}
        <button type="button" onClick={() => switchMode('daily-solo')}>
          Daily Solo
        </button>{' '}
        &middot;{' '}
        <button type="button" onClick={() => switchMode('practice-solo')}>
          Practice
        </button>{' '}
        {!isSoloRoute && (
          <>
            &middot;{' '}
            <button
              type="button"
              onClick={handleOpenAdmin}
              title="Open Streamer Access Administration"
            >
              Admin
            </button>{' '}
          </>
        )}
        &middot; <span>&copy; 2026 The Missing Piece</span>
      </footer>
      </>
      )}
        </div>

        {/* RIGHT BOX: WORDS BEING LOOKED FOR (hidden in LIVE Studio overlay and solo route) */}
        {!isOverlay && !isSoloRoute && (
        <aside className="side-box right-words-box" aria-label="Words Being Looked For">
          <div className="side-box-header">
            <div className="side-box-title">
              <span>WORDS BEING LOOKED FOR</span>
            </div>
            <span className="side-box-counter">
              {(gameState?.revealedTitleWordCount || 0) +
                (gameState?.foundCommonCount || 0) +
                (gameState?.foundRareCount || 0) +
                (gameState?.foundUltraCount || 0)}
              /
              {(gameState?.titleWordCount || 0) +
                (gameState?.commonWordTarget || 0) +
                (gameState?.rareWordTarget || 0) +
                (gameState?.ultraWordTarget || 0)}
            </span>
          </div>

          <div className="side-box-body target-words-list">
            {/* Title Words Group */}
            <div className="tw-group">
              <div className="tw-group-header tier-title">
                <span className="tw-tier-label">
                  <span className="badge-dot t">T</span> TITLE WORDS
                </span>
                <span className="tw-tier-count">
                  {gameState?.revealedTitleWordCount || 0}/{gameState?.titleWordCount || 0}
                </span>
              </div>
              <div className="tw-chips-grid">
                {searchWordGroups.title.map((slot) => (
                  <div
                    key={slot.id}
                    className={`tw-slot ${slot.revealed ? 'found title-found' : 'unfound'}`}
                    onMouseEnter={() => {
                      if (slot.revealed && slot.cells?.length) setFlashedCells(slot.cells);
                    }}
                    onMouseLeave={() => setFlashedCells([])}
                  >
                    <span className="tw-slot-word">
                      {slot.revealed && slot.word
                        ? slot.word
                        : `${slot.startLetter}${'•'.repeat(Math.max(1, slot.length - 1))}`}
                    </span>
                    <span className="tw-slot-meta">
                      {slot.revealed ? slot.finderName || 'Found' : `${slot.length}L`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Common Words Group */}
            <div className="tw-group">
              <div className="tw-group-header tier-common">
                <span className="tw-tier-label">
                  <span className="badge-dot c">C</span> COMMON WORDS
                </span>
                <span className="tw-tier-count">
                  {gameState?.foundCommonCount || 0}/{gameState?.commonWordTarget || 0}
                </span>
              </div>
              <div className="tw-chips-grid">
                {searchWordGroups.common.map((slot) => (
                  <div
                    key={slot.id}
                    className={`tw-slot ${slot.revealed ? 'found common-found' : 'unfound'}`}
                    onMouseEnter={() => {
                      if (slot.revealed && slot.cells?.length) setFlashedCells(slot.cells);
                    }}
                    onMouseLeave={() => setFlashedCells([])}
                  >
                    <span className="tw-slot-word">
                      {slot.revealed && slot.word
                        ? slot.word
                        : `${slot.startLetter}${'•'.repeat(Math.max(1, slot.length - 1))}`}
                    </span>
                    <span className="tw-slot-meta">
                      {slot.revealed ? slot.finderName || 'Found' : `${slot.length}L`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rare Words Group */}
            <div className="tw-group">
              <div className="tw-group-header tier-rare">
                <span className="tw-tier-label">
                  <span className="badge-dot r">R</span> RARE WORDS
                </span>
                <span className="tw-tier-count">
                  {gameState?.foundRareCount || 0}/{gameState?.rareWordTarget || 0}
                </span>
              </div>
              <div className="tw-chips-grid">
                {searchWordGroups.rare.map((slot) => (
                  <div
                    key={slot.id}
                    className={`tw-slot ${slot.revealed ? 'found rare-found' : 'unfound'}`}
                    onMouseEnter={() => {
                      if (slot.revealed && slot.cells?.length) setFlashedCells(slot.cells);
                    }}
                    onMouseLeave={() => setFlashedCells([])}
                  >
                    <span className="tw-slot-word">
                      {slot.revealed && slot.word
                        ? slot.word
                        : `${slot.startLetter}${'•'.repeat(Math.max(1, slot.length - 1))}`}
                    </span>
                    <span className="tw-slot-meta">
                      {slot.revealed ? slot.finderName || 'Found' : `${slot.length}L`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ultra Words Group */}
            <div className="tw-group">
              <div className="tw-group-header tier-ultra">
                <span className="tw-tier-label">
                  <span className="badge-dot u">U</span> ULTRA RARE WORDS
                </span>
                <span className="tw-tier-count">
                  {gameState?.foundUltraCount || 0}/{gameState?.ultraWordTarget || 0}
                </span>
              </div>
              <div className="tw-chips-grid">
                {searchWordGroups.ultra.map((slot) => (
                  <div
                    key={slot.id}
                    className={`tw-slot ${slot.revealed ? 'found ultra-found' : 'unfound'}`}
                    onMouseEnter={() => {
                      if (slot.revealed && slot.cells?.length) setFlashedCells(slot.cells);
                    }}
                    onMouseLeave={() => setFlashedCells([])}
                  >
                    <span className="tw-slot-word">
                      {slot.revealed && slot.word
                        ? slot.word
                        : `${slot.startLetter}${'•'.repeat(Math.max(1, slot.length - 1))}`}
                    </span>
                    <span className="tw-slot-meta">
                      {slot.revealed ? slot.finderName || 'Found' : `${slot.length}L`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
        )}
      </div>

      {/* WORD ANNOUNCE SLIDE-DOWN TOAST */}
      <div
        id="word-announce"
        className={`word-announce ${wordAnnounce.visible ? 'show' : ''}`}
      >
        <div className="wa-pfp" id="wa-pfp">
          {(wordAnnounce.finderName || '?').replace(/^@/, '')[0]?.toUpperCase() || 'W'}
        </div>
        <div className="wa-info">
          <div className="wa-name" id="wa-name">
            {wordAnnounce.finderName}
          </div>
          <div className="wa-line">
            <span className="wa-word" id="wa-word">
              {wordAnnounce.word}
            </span>
            <span className="wa-pts" id="wa-pts">
              +{wordAnnounce.points.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ROUND-END OVERLAY */}
      {showVictoryModal && gameState && (
        <div className="round-end-overlay" id="solo-end-overlay">
          <div className="round-end-card">
            <h2 id="solo-end-title">
              {isSolo ? 'Run complete' : 'Round complete'}
            </h2>
            <div className="rev-title" id="solo-end-article">
              {gameState.articleTitle || gameState.unmaskedArticleTitle || 'Wikipedia Article Solved'}
            </div>

            {topThreePlayers[0] && (
              <div className="round-end-winner">
                <div className="round-end-winner-pfp">
                  {topThreePlayers[0].profileImage ? (
                    <img
                      src={topThreePlayers[0].profileImage}
                      alt={(topThreePlayers[0].displayName || 'Player').replace(/^@/, '')}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    (topThreePlayers[0].displayName || 'Player')
                      .replace(/^@/, '')[0]
                      ?.toUpperCase() || '1'
                  )}
                </div>
                <div className="round-end-winner-info">
                  <span className="round-end-winner-label">Top Player</span>
                  <span className="round-end-winner-name">
                    {(topThreePlayers[0].displayName || 'Player').replace(/^@/, '')}
                  </span>
                  <span className="round-end-winner-score">
                    {topThreePlayers[0].score.toLocaleString()} pts
                  </span>
                </div>
              </div>
            )}

            {gameState.articleExtract && (
              <p
                style={{
                  color: 'var(--text-dim)',
                  fontSize: '0.92rem',
                  lineHeight: 1.5,
                  marginBottom: '14px',
                }}
              >
                {gameState.articleExtract}
              </p>
            )}
            {gameState.roundEndCountdownSec !== null && (
              <div
                style={{
                  color: 'var(--text-dim)',
                  fontSize: '0.92rem',
                  marginBottom: '12px',
                }}
              >
                Next round in {gameState.roundEndCountdownSec}s
              </div>
            )}
            {!isOverlay && (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="ghost"
                style={{
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  border: '2px solid var(--border)',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                onClick={() => setDismissedRoundId(gameState.roundId)}
              >
                View board
              </button>
              <button
                type="button"
                id="solo-end-again"
                style={{
                  background: 'var(--accent-orange)',
                  color: '#2d0938',
                  border: '2px solid var(--accent-orange-2)',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
                onClick={() => handleNewRound(true)}
              >
                Play again
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {!isOverlay && !isSoloRoute && (
      <>
      {/* TIKTOK LIVE INTERACTIVITY DRAWER */}
      <TikTokLivePanel
        status={tiktokStatus}
        chatItems={chatHistory}
        gameState={gameState}
        isOpen={tiktokDrawerOpen}
        onClose={() => setTiktokDrawerOpen(false)}
        onConnectionStateChange={(connected, username) => {
          setTiktokStatus((prev) => ({
            ...prev,
            connected,
            username,
          }));
        }}
        authorizedStreamer={authorizedStreamer}
        onLogoutStreamer={handleStreamerLogout}
      />

      {/* STREAMER LOGIN MODAL */}
      <StreamerLoginModal
        isOpen={streamerLoginOpen}
        onClose={() => setStreamerLoginOpen(false)}
        onSuccess={handleStreamerLoginSuccess}
      />

      {/* ADMIN LOGIN MODAL */}
      <AdminLoginModal
        isOpen={adminLoginOpen}
        onClose={() => setAdminLoginOpen(false)}
        onSuccess={handleAdminLoginSuccess}
      />

      {/* ADMIN AUTHORIZATION MODAL */}
      <AdminAuthModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        currentAdminUser={adminSession?.username || 'Admin'}
        onLogoutAdmin={handleAdminLogout}
      />
      </>
      )}
    </div>
  );
}

export { App };
