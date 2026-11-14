import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { Link } from 'react-router';
import {
  createNewWikiconRound,
  handleWikiconGuess,
  evaluateTikTokChatIntoWikiconRound,
  revealWikiconHint,
  revealEntireWikiconRound,
  getArchiveList,
  serializeWikiconRound,
  type InternalWikiconRound,
} from './engine';
import {
  validateInteractiveStreamerKey,
  getActiveInteractiveStreamerSession,
  setActiveInteractiveStreamerSession,
  clearActiveInteractiveStreamerSession,
  touchActiveInteractiveStreamerSession,
} from '@/lib/interactive-key-auth';
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
} from '../lib/unified-game-auth';
import { useOverlayConfig, useOverlaySync } from '@/lib/live-overlay';
import { LiveOverlayButton } from '@/components/interactive-games/live-overlay-button';
import {
  getLocalTodayDateStr,
  recordDailyPuzzleSolved,
  useDailyStreak,
} from '@/lib/daily-streak';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import { triggerVictoryConfetti } from '@/lib/confetti';
import './index.css';
import {
  GameMode,
  RoundState,
  TikTokChatMessage,
  TikTokLikeEvent,
  TikTokGiftEvent,
  UserEconomyProfile,
  ArchivePuzzleItem,
  RankCard,
} from './types';
import { KeycapGrid } from './components/KeycapGrid';
import { TikTokStreamModal } from './components/TikTokStreamModal';
import { AdminModal } from './components/AdminModal';
import { LiveChatBox } from './components/LiveChatBox';
import { WordTycoonHubView } from './components/WordTycoonHubView';
import { soundFX } from './utils/sound';
import {
  Compass,
  Globe,
  Calendar,
  History,
  Sparkles,
  Radio,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Lightbulb,
  Flag,
  RotateCcw,
  Crown,
  Grid,
  Quote,
  Send,
  Coins,
  CheckCircle2,
  Trophy,
  Pause,
  Play,
} from 'lucide-react';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of combined user + chat inactivity

const INITIAL_PROFILE: UserEconomyProfile = {
  username: 'wiki_explorer',
  displayName: 'Wiki Explorer',
  avatar: 'WE',
  coins: 4250,
  elo: 1340,
  xp: 2800,
  level: 5,
  roundsWon: 4,
  totalWordsFound: 68,
  dailyStreak: 0,
  equippedTitle: 'Tycoon Scholar',
  equippedFrame: '#19e4ff',
  equippedTileSkin: 'arcade-teal',
  completedDailies: [],
  businesses: [
    {
      id: 'biz-lexicon',
      name: 'Encyclopedia Printing Press',
      category: 'Publishing',
      level: 2,
      baseCost: 1200,
      coinsPerMinute: 45,
      wordBonusPct: 10,
      description: 'Generates passive coins and increases points for Common & Uncommon discoveries.',
    },
    {
      id: 'biz-semantic',
      name: 'Semantic Vector Observatory',
      category: 'Research AI',
      level: 1,
      baseCost: 2500,
      coinsPerMinute: 95,
      wordBonusPct: 15,
      description: 'Boosts coin rewards for Top-100 Semantic Rank hits and Title Word breakthroughs.',
    },
    {
      id: 'biz-relay',
      name: 'TikTok Stream Relay Studio',
      category: 'Broadcast Media',
      level: 1,
      baseCost: 3800,
      coinsPerMinute: 150,
      wordBonusPct: 20,
      description: 'Amplifies multiplayer crowd rewards when TikTok Live chat solves words together.',
    },
    {
      id: 'biz-keycap',
      name: 'Mechanical Keycap Foundry',
      category: 'Hardware',
      level: 1,
      baseCost: 5000,
      coinsPerMinute: 220,
      wordBonusPct: 25,
      description: 'Increases score multipliers on 8-connected Wikirec Grid & WikiWord Quote target cards.',
    },
  ],
  cosmetics: [
    {
      id: 'cos-title-scholar',
      name: 'Tycoon Scholar',
      slot: 'title',
      price: 0,
      previewHex: '#19e4ff',
      unlocked: true,
      equipped: true,
    },
    {
      id: 'cos-title-oracle',
      name: 'Contexto Grandmaster',
      slot: 'title',
      price: 2500,
      previewHex: '#ffe536',
      unlocked: false,
      equipped: false,
    },
    {
      id: 'cos-title-tiktok',
      name: 'Stream Legend',
      slot: 'title',
      price: 3500,
      previewHex: '#2bff86',
      unlocked: false,
      equipped: false,
    },
    {
      id: 'cos-frame-cyan',
      name: 'Neon Cyan Halo',
      slot: 'frame',
      price: 0,
      previewHex: '#19e4ff',
      unlocked: true,
      equipped: true,
    },
    {
      id: 'cos-frame-gold',
      name: 'Sovereign Gold Crown',
      slot: 'frame',
      price: 4000,
      previewHex: '#ffe536',
      unlocked: false,
      equipped: false,
    },
    {
      id: 'cos-frame-mint',
      name: 'Emerald Matrix Frame',
      slot: 'frame',
      price: 3000,
      previewHex: '#2bff86',
      unlocked: false,
      equipped: false,
    },
  ],
};

export function App() {
  const { isOverlay, bg: overlayBg, streamer: overlayStreamer } = useOverlayConfig();
  const hasReceivedHostSyncRef = useRef(false);

  const [activeNav, setActiveNav] = useState<GameMode>(() => (isOverlay ? 'ONLINE' : 'HOME'));
  const [round, setRound] = useState<RoundState | null>(null);
  const [archiveList, setArchiveList] = useState<ArchivePuzzleItem[]>([]);

  // Authorised Streamer Login & TikTok Live Socket.IO State
  const [authenticatedStreamer, setAuthenticatedStreamer] = useState<string | null>(() => {
    try {
      const active = getActiveInteractiveStreamerSession();
      if (active) return active.displayHandle;
    } catch {}
    return null;
  });
  const [tiktokConnState, setTiktokConnState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectedUsername, setConnectedUsername] = useState<string | null>(null);
  const [connectedRoomId, setConnectedRoomId] = useState<string | null>(null);
  const [tiktokError, setTiktokError] = useState<string | null>(null);

  // Live Chat Messages (Chats only — likes & gifts excluded from chat box)
  const [chatMessages, setChatMessages] = useState<TikTokChatMessage[]>([]);
  const [totalLikesCount, setTotalLikesCount] = useState<number>(0);
  const [totalGiftsCount, setTotalGiftsCount] = useState<number>(0);

  // Modals
  const [isStreamModalOpen, setIsStreamModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // UI Preferences
  const [isLightMode, setIsLightMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showLengthsOnBlocks, setShowLengthsOnBlocks] = useState(false);
  const [guessInput, setGuessInput] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<{
    text: string;
    tone: 'cyan' | 'gold' | 'green' | 'muted';
  } | null>(null);
  const [showGridInHybrid, setShowGridInHybrid] = useState(false);
  const [isManuscriptAutoScroll, setIsManuscriptAutoScroll] = useState(true);

  const todayDateStr = useMemo(() => getLocalTodayDateStr(), []);
  const dailyStreak = useDailyStreak('wikicon', todayDateStr);

  const [profile, setProfile] = useState<UserEconomyProfile>(() => {
    try {
      const saved = localStorage.getItem('wk_tycoon_profile_v1');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return INITIAL_PROFILE;
  });

  const socketRef = useRef<Socket | null>(null);
  const internalRoundRef = useRef<InternalWikiconRound | null>(null);
  const prevSolvedRef = useRef<boolean>(false);
  const lastActivityRef = useRef<number>(Date.now());
  const processChatEventRef = useRef<((data: any) => void) | null>(null);
  const manuscriptScrollRef = useRef<HTMLDivElement | null>(null);
  const manuscriptHoverPausedRef = useRef<boolean>(false);
  const manuscriptManualPauseUntilRef = useRef<number>(0);
  const manuscriptScrollPosRef = useRef<number>(0);

  const showToast = useCallback((text: string, tone: 'cyan' | 'gold' | 'green' | 'muted' = 'cyan') => {
    setFeedbackToast({ text, tone });
    setTimeout(() => {
      setFeedbackToast((cur) => (cur?.text === text ? null : cur));
    }, 3200);
  }, []);

  // Touch activity timestamp on any user or chat activity
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    touchActiveInteractiveStreamerSession();
  }, []);

  // Logout helper (used by manual logout, 20-minute inactivity timer, and window close)
  const performStreamerLogout = useCallback(
    (reason?: string) => {
      clearActiveInteractiveStreamerSession();
      if (socketRef.current) {
        socketRef.current.emit('streamer-auth-logout');
        socketRef.current.emit('disconnect-tiktok');
      }
      setAuthenticatedStreamer(null);
      setTiktokConnState('disconnected');
      setConnectedUsername(null);
      setConnectedRoomId(null);
      if (reason) {
        showToast(reason, 'muted');
      }
    },
    [showToast]
  );

  // Automatic logout on window close or after 20 minutes of combined user + chat inactivity
  useEffect(() => {
    if (!authenticatedStreamer) return;

    const events = ['pointerdown', 'keydown', 'mousemove', 'touchstart', 'scroll'];
    const onUserActivity = () => {
      lastActivityRef.current = Date.now();
    };
    events.forEach((ev) => window.addEventListener(ev, onUserActivity, { passive: true }));

    const handleBeforeUnload = () => {
      if (socketRef.current) {
        socketRef.current.emit('streamer-auth-logout');
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const timer = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT_MS) {
        performStreamerLogout('Logged out due to 20 minutes of user and chat inactivity.');
      }
    }, 10000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onUserActivity));
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(timer);
    };
  }, [authenticatedStreamer, performStreamerLogout]);

  // Sync profile to localStorage scoped per user session
  useEffect(() => {
    try {
      localStorage.setItem(
        `wk_tycoon_profile_v1_${getCurrentUserSessionPrefix()}`,
        JSON.stringify(profile),
      );
    } catch (_) {}
  }, [profile]);

  // Passive coin generation from Word Tycoon businesses
  useEffect(() => {
    const interval = setInterval(() => {
      const perMin = profile.businesses.reduce((acc, b) => acc + b.coinsPerMinute * b.level, 0);
      const perTick = perMin / 12;
      setProfile((p) => ({ ...p, coins: p.coins + perTick }));
    }, 5000);
    return () => clearInterval(interval);
  }, [profile.businesses]);

  // Sync light/dark theme with documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (isLightMode) {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [isLightMode]);

  // Connect to backend via Socket.IO (scoped to isolated user session) & initialize isolated per-user round
  useEffect(() => {
    createNewWikiconRound({ mode: 'WIKICONTEXTO', isDaily: true }).then((init) => {
      if (isOverlay && hasReceivedHostSyncRef.current) return;
      internalRoundRef.current = init;
      setRound(serializeWikiconRound(init));
    });
    setArchiveList(getArchiveList());

    const socket = io({
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      timeout: 5000,
      query: {
        sessionId: getCurrentUserSessionPrefix(),
        gameId: 'wikicon',
      },
    });
    socketRef.current = socket;
    const deduplicator = createEventDeduplicator();

    // Standalone overlay auto-connect if opened directly with ?streamer=handle and no host tab synced
    let standaloneConnectTimer: ReturnType<typeof setTimeout> | null = null;
    if (isOverlay && overlayStreamer) {
      const cleanOverlayStreamer = overlayStreamer.replace(/^@+/, '').trim();
      if (cleanOverlayStreamer) {
        standaloneConnectTimer = setTimeout(() => {
          if (!hasReceivedHostSyncRef.current) {
            triggerResilientConnect(socket, {
              username: cleanOverlayStreamer,
              isTestMode: false,
              provider: 'tikfinity',
              gameId: 'wikicon',
              sessionId: getCurrentUserSessionPrefix(),
            });
          }
        }, 1200);
      }
    }

    // Exact Socket.IO listeners specified in prompt
    socket.on('tiktok-connected', (data: { username: string; roomId: string; gameId?: string }) => {
      if (!data.gameId || data.gameId === 'wikicon') {
        recordActivity();
        setTiktokConnState('connected');
        setConnectedUsername(data.username);
        setConnectedRoomId(data.roomId || 'LIVE_RELAY');
        setTiktokError(null);
      }
    });

    socket.on(
      'tiktok-status',
      (data: { connected: boolean; username?: string | null; isTestMode?: boolean; roomId?: string; gameId?: string }) => {
        if (!data.gameId || data.gameId === 'wikicon') {
          recordActivity();
          if (data.connected) {
            setTiktokConnState('connected');
            if (data.username) setConnectedUsername(data.username);
            setConnectedRoomId((prev) => data.roomId || prev || (data.isTestMode ? 'TEST_MODE' : 'LIVE'));
            setTiktokError(null);
          } else {
            setTiktokConnState('disconnected');
            setConnectedUsername(null);
            setConnectedRoomId(null);
          }
        }
      }
    );

    socket.on('tiktok-error', (errMsg: string) => {
      console.warn('TikTok socket notice:', errMsg);
    });

    socket.on('tiktok-disconnected', (payload?: { gameId?: string }) => {
      if (!payload?.gameId || payload.gameId === 'wikicon') {
        setTiktokConnState('disconnected');
        setConnectedUsername(null);
        setConnectedRoomId(null);
      }
    });

    const processChatEvent = (data: {
      uniqueId?: string;
      nickname?: string;
      comment?: string;
      profilePictureUrl?: string;
    }) => {
      recordActivity();
      const rawComment = String(data.comment || '');
      const cleanUniqueId = (data.uniqueId || data.nickname || 'viewer').replace(/^@+/, '');
      const cleanNickname = (data.nickname || data.uniqueId || 'Viewer').replace(/^@+/, '');
      const rawPfp = (data.profilePictureUrl || '').trim();
      const normalizedPfp = rawPfp.startsWith('//') ? `https:${rawPfp}` : rawPfp;
      const validPfp = normalizedPfp.startsWith('http')
        ? normalizedPfp
        : `https://i.pravatar.cc/150?u=${encodeURIComponent(cleanUniqueId || cleanNickname)}`;

      const msg: TikTokChatMessage = {
        id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        uniqueId: cleanUniqueId,
        nickname: cleanNickname,
        comment: rawComment,
        profilePictureUrl: validPfp,
        timestamp: Date.now(),
      };
      // Append all chat messages (even if not part of puzzle, multi-word, or numbers)
      setChatMessages((prev) => [...prev.slice(-199), msg]);

      if (isOverlay && hasReceivedHostSyncRef.current) {
        return;
      }

      // Evaluate chat message words against the active WikiContexto round
      if (internalRoundRef.current && rawComment.trim()) {
        if (rawComment.trim().toLowerCase() === '!hint') {
          const hintWord = revealWikiconHint(internalRoundRef.current);
          if (hintWord) {
            soundFX.playWordHit('UNCOMMON');
            setRound(serializeWikiconRound(internalRoundRef.current));
            showToast(
              `${msg.nickname} triggered !hint → "${hintWord.toUpperCase()}"`,
              'gold'
            );
          }
          return;
        }

        const prevAnnouncementId = internalRoundRef.current.lastAnnouncement?.id;
        const anyUpdated = evaluateTikTokChatIntoWikiconRound(internalRoundRef.current, {
          uniqueId: msg.uniqueId,
          nickname: msg.nickname,
          comment: rawComment,
          profilePictureUrl: msg.profilePictureUrl,
        });

        if (anyUpdated) {
          const nextRound = serializeWikiconRound(internalRoundRef.current);
          setRound(nextRound);
          const ann = internalRoundRef.current.lastAnnouncement;
          if (ann && ann.id !== prevAnnouncementId) {
            soundFX.playWordHit(ann.rarity);
            showToast(
              `${msg.nickname} uncovered "${ann.word}" (#${ann.rank} · +${ann.pointsEarned.toLocaleString()} pts)`,
              ann.rarity === 'TITLE' ? 'gold' : 'green'
            );
            if (ann.pointsEarned && ann.pointsEarned > 0) {
              creditInteractiveScoreByTikTokHandle({
                tiktokUsername: msg.uniqueId || msg.nickname,
                gameId: 'wikicon',
                pointsEarned: ann.pointsEarned,
                reason: `WikiContexto word: ${ann.word.toUpperCase()}`,
              });
            }
          } else {
            soundFX.playKeycapTap(3);
          }
        }
      }
    };
    processChatEventRef.current = processChatEvent;

    const processLikeEvent = (data: TikTokLikeEvent) => {
      recordActivity();
      setTotalLikesCount((prev) => prev + (Number(data.likeCount) || 1));
    };

    const processGiftEvent = (data: TikTokGiftEvent) => {
      recordActivity();
      if (data.repeatEnd === false) return;
      const count = Number(data.repeatCount) || 1;
      setTotalGiftsCount((prev) => prev + count);
      if (internalRoundRef.current) {
        const hintWord = revealWikiconHint(internalRoundRef.current);
        setRound(serializeWikiconRound(internalRoundRef.current));
        soundFX.playWordHit('UNCOMMON');
        showToast(
          `${data.nickname || 'Viewer'} sent ${count}× ${data.giftName || 'Gift'}! ${
            hintWord ? `Hint revealed: "${hintWord.toUpperCase()}"` : 'Hint unlocked!'
          }`,
          'gold'
        );
      } else {
        showToast(
          `${data.nickname || 'Viewer'} sent ${count}× ${data.giftName || 'Gift'}! Hint unlocked!`,
          'gold'
        );
      }
    };

    socket.on('chat-message', (data: any) => {
      if (deduplicator.shouldProcess('chat', data)) {
        processChatEvent(data);
      }
    });

    socket.on('like-event', (data: TikTokLikeEvent) => {
      if (deduplicator.shouldProcess('like', data)) {
        processLikeEvent(data);
      }
    });

    socket.on('gift-event', (data: TikTokGiftEvent) => {
      if (deduplicator.shouldProcess('gift', data)) {
        processGiftEvent(data);
      }
    });

    const detachBridge = attachResilientChatListeners({
      onChat: processChatEvent,
      onLike: processLikeEvent,
      onGift: processGiftEvent,
      deduplicator,
    });

    return () => {
      if (standaloneConnectTimer) clearTimeout(standaloneConnectTimer);
      detachBridge();
      socket.disconnect();
    };
  }, [recordActivity, showToast, isOverlay, overlayStreamer]);

  // Trigger Victory Fanfare & Confetti when round transitions to solved
  useEffect(() => {
    if (round?.solved && !prevSolvedRef.current) {
      soundFX.playVictoryFanfare();
      if (!isOverlay) {
        const topPlayerScore =
          round.leaderboard && round.leaderboard.length > 0
            ? Math.max(...round.leaderboard.map((p) => p.score || 0))
            : 0;
        const bestKey = `mp_wikicon_best_score_${getCurrentUserSessionPrefix()}`;
        let prevBest = 0;
        try {
          prevBest = Number(localStorage.getItem(bestKey) || '0') || 0;
          if (topPlayerScore > prevBest) {
            localStorage.setItem(bestKey, String(topPlayerScore));
          }
        } catch {}
        triggerVictoryConfetti({
          isDaily: Boolean(round.isDaily),
          isNewHighScore: prevBest > 0 && topPlayerScore > prevBest,
        });
      }
      const updatedStreakState = !isOverlay
        ? recordDailyPuzzleSolved('wikicon', todayDateStr)
        : null;
      setProfile((p) => ({
        ...p,
        coins: p.coins + 2500,
        elo: p.elo + 18,
        roundsWon: p.roundsWon + 1,
        dailyStreak: updatedStreakState ? updatedStreakState.streak : p.dailyStreak,
        completedDailies:
          round.isDaily && round.dailyDate && !p.completedDailies.includes(round.dailyDate)
            ? [...p.completedDailies, round.dailyDate]
            : p.completedDailies,
      }));
    }
    prevSolvedRef.current = !!round?.solved;
  }, [round?.solved, round?.isDaily, round?.dailyDate, isOverlay, todayDateStr]);

  // Reset manuscript scroll position on new round
  useEffect(() => {
    const el = manuscriptScrollRef.current;
    manuscriptScrollPosRef.current = 0;
    if (el) {
      el.scrollTop = 0;
    }
  }, [round?.roundId]);

  // Automatically scroll through the Wikipedia Redacted Manuscript
  useEffect(() => {
    if (!isManuscriptAutoScroll) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rafId = 0;
    let lastTs = performance.now();
    let holdUntil = performance.now() + 1200;

    const step = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - lastTs) / 1000));
      lastTs = now;
      const el = manuscriptScrollRef.current;
      if (el) {
        const maxScroll = el.scrollHeight - el.clientHeight;
        const isPaused =
          manuscriptHoverPausedRef.current ||
          now < manuscriptManualPauseUntilRef.current ||
          now < holdUntil ||
          maxScroll <= 4;

        if (!isPaused) {
          manuscriptScrollPosRef.current += dt * 18;
          if (manuscriptScrollPosRef.current >= maxScroll) {
            el.scrollTop = maxScroll;
            manuscriptScrollPosRef.current = -1; // flag reset on next tick after pause
            holdUntil = now + 2000;
          } else {
            el.scrollTop = manuscriptScrollPosRef.current;
          }
        } else if (manuscriptScrollPosRef.current < 0 && now >= holdUntil) {
          manuscriptScrollPosRef.current = 0;
          el.scrollTop = 0;
          holdUntil = now + 1200;
        }
      }
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isManuscriptAutoScroll, round?.roundId, activeNav]);

  // Streamer login via validateInteractiveStreamerKey with Socket.IO backup
  const handleStreamerLogin = (
    username: string,
    key: string
  ): Promise<{ ok: boolean; error?: string; username?: string }> => {
    return new Promise((resolve) => {
      const validation = validateInteractiveStreamerKey(username, key);
      if (validation.ok) {
        setActiveInteractiveStreamerSession(validation.user);
        recordActivity();
        const handle = validation.user.displayHandle;
        setAuthenticatedStreamer(handle);
        showToast(`Logged in as ${handle}. Live Chat box enabled!`, 'green');
        if (socketRef.current) {
          socketRef.current.emit('streamer-auth-login', { username, key });
        }
        resolve({ ok: true, username: handle });
        return;
      }

      if (socketRef.current) {
        socketRef.current.emit(
          'streamer-auth-login',
          { username, key },
          (resp: { ok: boolean; error?: string; username?: string }) => {
            if (resp.ok && resp.username) {
              recordActivity();
              setAuthenticatedStreamer(resp.username);
              showToast(`Logged in as ${resp.username}. Live Chat box enabled!`, 'green');
            }
            resolve(resp);
          }
        );
      } else {
        resolve({ ok: false, error: validation.error || 'Invalid credentials' });
      }
    });
  };

  // Emit connect-tiktok / disconnect-tiktok
  const handleConnectTikTok = (username: string, isTestMode = false) => {
    recordActivity();
    const cleaned = username.trim().replace(/^@+/, '') || 'streamer';
    let savedProvider: 'tikfinity' | 'bettertok' = 'tikfinity';
    try {
      const p = localStorage.getItem('chat_integration_provider');
      if (p === 'bettertok' || p === 'tikfinity') savedProvider = p;
    } catch {}

    setTiktokConnState('connected');
    setConnectedUsername(cleaned);
    setConnectedRoomId(isTestMode ? 'TEST_SIMULATION_ROOM' : 'LIVE_RELAY');
    setTiktokError(null);
    showToast(`Connected to TikTok Live @${cleaned}`, 'green');

    triggerResilientConnect(
      socketRef.current,
      {
        username: cleaned,
        isTestMode,
        provider: savedProvider,
        gameId: 'wikicon',
        sessionId: getCurrentUserSessionPrefix(),
      },
      ({ username: uname, roomId }) => {
        setTiktokConnState('connected');
        setConnectedUsername(uname || cleaned);
        if (roomId) setConnectedRoomId(roomId);
      }
    );
  };

  const handleReconnectTikTok = (username: string, isTestMode = false) => {
    recordActivity();
    const cleaned =
      username.trim().replace(/^@+/, '') ||
      connectedUsername?.replace(/^@+/, '') ||
      authenticatedStreamer?.replace(/^@+/, '') ||
      'streamer';
    let savedProvider: 'tikfinity' | 'bettertok' = 'tikfinity';
    try {
      const p = localStorage.getItem('chat_integration_provider');
      if (p === 'bettertok' || p === 'tikfinity') savedProvider = p;
    } catch {}

    setTiktokConnState('connected');
    setConnectedUsername(cleaned);
    setConnectedRoomId(isTestMode ? 'TEST_SIMULATION_ROOM' : 'LIVE_RELAY');
    setTiktokError(null);
    showToast(`Reconnected @${cleaned} · Bridge & Socket refreshed!`, 'green');

    forceReconnectBridge(
      socketRef.current,
      {
        username: cleaned,
        isTestMode,
        provider: savedProvider,
        gameId: 'wikicon',
        sessionId: getCurrentUserSessionPrefix(),
      },
      ({ username: uname, roomId }) => {
        setTiktokConnState('connected');
        setConnectedUsername(uname || cleaned);
        if (roomId) setConnectedRoomId(roomId);
      }
    );
  };

  const handleDisconnectTikTok = () => {
    recordActivity();
    setTiktokConnState('disconnected');
    setConnectedUsername(null);
    setConnectedRoomId(null);
    fetch('/api/tiktok/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: getCurrentUserSessionPrefix(),
        gameId: 'wikicon',
      }),
    }).catch(() => {});
    if (!socketRef.current) return;
    socketRef.current.emit('disconnect-tiktok', {
      gameId: 'wikicon',
      sessionId: getCurrentUserSessionPrefix(),
    });
  };

  // Start a specific game mode / puzzle (Does NOT disconnect from TikTok Live between rounds!)
  const startModeRound = async (
    targetNav: GameMode,
    opts: {
      mode: 'WIKICONTEXTO' | 'WIKIREC_GRID' | 'WIKIWORD_QUOTE';
      isDaily?: boolean;
      dailyDate?: string;
      customTitle?: string;
    }
  ) => {
    recordActivity();
    setActiveNav(targetNav);
    setShowGridInHybrid(opts.mode !== 'WIKICONTEXTO');
    
    // Set immediate local round
    try {
      const localNewRound = await createNewWikiconRound(opts);
      internalRoundRef.current = localNewRound;
      setRound(serializeWikiconRound(localNewRound));
    } catch {}

    showToast(
      opts.isDaily
        ? `Loaded Daily Discovery (${opts.dailyDate || 'Today'})`
        : `Started new ${opts.mode === 'WIKIREC_GRID' ? 'Wikirec Grid' : opts.mode === 'WIKIWORD_QUOTE' ? 'WikiWord Quote' : 'WikiContexto'} round!`,
      'cyan'
    );
  };

  // Submit a word guess (from input bar or 8-connected KeycapGrid swipe)
  const submitWordGuess = async (rawWord: string) => {
    recordActivity();
    const clean = rawWord.trim();
    if (!clean) return;
    setGuessInput('');

    if (internalRoundRef.current) {
      const r = handleWikiconGuess(internalRoundRef.current, clean, {
        username: profile.username,
        displayName: profile.displayName,
        avatar: profile.displayName.slice(0, 2).toUpperCase(),
        platform: 'web',
        cosmeticTitle: profile.equippedTitle,
      });
      setRound(serializeWikiconRound(internalRoundRef.current));

      if (!r.valid) {
        soundFX.playMiss();
        showToast(`"${clean.toUpperCase()}" is a pre-revealed common scaffolding word.`, 'muted');
        return;
      }
      if (r.alreadyRevealed && !r.titleMatched && !r.gridTargetHit) {
        soundFX.playKeycapTap(2);
        showToast(`"${clean.toUpperCase()}" was already discovered (#${r.rank})`, 'muted');
        return;
      }

      const pointsEarned = r.pointsEarned ?? 0;
      const occurrencesRevealed = r.occurrencesRevealed ?? 0;
      const rarity = r.rarity ?? 'COMMON';

      const bonusMult =
        1 +
        profile.businesses.reduce((acc, b) => acc + b.wordBonusPct * b.level, 0) / 100;
      const coinReward = Math.max(25, Math.round((pointsEarned / 25) * bonusMult));

      if (r.titleMatched) {
        soundFX.playWordHit('TITLE');
        showToast(
          `TITLE WORD: ${clean.toUpperCase()}! +${pointsEarned.toLocaleString()} pts`,
          'gold'
        );
      } else if (occurrencesRevealed > 0 || r.gridTargetHit) {
        soundFX.playWordHit(rarity);
        showToast(
          `Found "${clean.toUpperCase()}" (×${occurrencesRevealed} · #${r.rank}) +${pointsEarned.toLocaleString()} pts`,
          'green'
        );
      } else {
        soundFX.playKeycapTap(4);
        showToast(
          `Semantic Rank #${r.rank} for "${clean.toUpperCase()}" (${r.similarity}%)`,
          'cyan'
        );
      }

      const activeStreamerHandle =
        authenticatedStreamer || getActiveInteractiveStreamerSession()?.username;
      if (activeStreamerHandle && pointsEarned > 0) {
        creditInteractiveScoreByTikTokHandle({
          tiktokUsername: activeStreamerHandle,
          gameId: 'wikicon',
          pointsEarned,
          reason: `WikiContexto word: ${clean.toUpperCase()}`,
        });
      }

      setProfile((p) => ({
        ...p,
        coins: p.coins + coinReward,
        totalWordsFound:
          occurrencesRevealed > 0 || r.gridTargetHit
            ? p.totalWordsFound + 1
            : p.totalWordsFound,
      }));
      return;
    }
  };

  const handleRequestHint = async () => {
    recordActivity();
    if (internalRoundRef.current) {
      const hintWord = revealWikiconHint(internalRoundRef.current);
      if (hintWord) {
        soundFX.playWordHit('UNCOMMON');
        setRound(serializeWikiconRound(internalRoundRef.current));
        showToast(`Hint revealed word: "${hintWord.toUpperCase()}"`, 'gold');
      }
    }
    try {
      const res = await fetch('/api/round/hint', { method: 'POST' });
      const data = await res.json();
      if (data && data.ok && data.round) {
        soundFX.playWordHit('UNCOMMON');
        setRound(data.round);
        showToast(
          data.revealedWord
            ? `Hint revealed word: "${data.revealedWord}"`
            : 'Hint revealed a letter in the Target Pyramid!',
          'gold'
        );
      }
    } catch (_) {}
  };

  const handleRevealRound = async () => {
    recordActivity();
    if (internalRoundRef.current) {
      revealEntireWikiconRound(internalRoundRef.current);
      setRound(serializeWikiconRound(internalRoundRef.current));
      soundFX.playVictoryFanfare();
      showToast(`Article revealed: "${internalRoundRef.current.articleTitle}"`, 'gold');
    }
    try {
      const res = await fetch('/api/round/reveal', { method: 'POST' });
      const data = await res.json();
      if (data && data.ok && data.round) {
        setRound(data.round);
        showToast(`Article revealed: "${data.round.articleTitle}"`, 'gold');
      }
    } catch (_) {}
  };

  const handleUpgradeBusiness = (businessId: string) => {
    recordActivity();
    setProfile((prev) => {
      const target = prev.businesses.find((b) => b.id === businessId);
      if (!target) return prev;
      const cost = Math.round(target.baseCost * Math.pow(1.45, target.level));
      if (prev.coins < cost) return prev;
      soundFX.playWordHit('RARE');
      return {
        ...prev,
        coins: prev.coins - cost,
        level: prev.level + 1,
        businesses: prev.businesses.map((b) =>
          b.id === businessId ? { ...b, level: b.level + 1 } : b
        ),
      };
    });
  };

  const handleBuyOrEquipCosmetic = (cosmeticId: string) => {
    recordActivity();
    setProfile((prev) => {
      const target = prev.cosmetics.find((c) => c.id === cosmeticId);
      if (!target) return prev;
      if (!target.unlocked && prev.coins < target.price) return prev;
      soundFX.playWordHit('UNCOMMON');
      const nextCoins = target.unlocked ? prev.coins : prev.coins - target.price;
      const nextCosmetics = prev.cosmetics.map((c) => {
        if (c.id === cosmeticId) {
          return { ...c, unlocked: true, equipped: true };
        }
        if (c.slot === target.slot) {
          return { ...c, equipped: false };
        }
        return c;
      });
      return {
        ...prev,
        coins: nextCoins,
        equippedTitle: target.slot === 'title' ? target.name : prev.equippedTitle,
        equippedFrame: target.slot === 'frame' ? target.previewHex : prev.equippedFrame,
        cosmetics: nextCosmetics,
      };
    });
  };

  const getRankHue = (rank: number) => {
    if (rank <= 10) return 135;
    if (rank <= 100) return 110;
    if (rank <= 400) return 52;
    if (rank <= 1200) return 32;
    return 202;
  };

  const paddedRankCards: (RankCard | null)[] = Array.from({ length: 6 }, (_, i) =>
    round && round.topRankCards[i] ? round.topRankCards[i] : null
  );

  const sortedLeaderboard = useMemo(() => {
    return [...(round?.leaderboard || [])]
      .filter((p) => p.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          (b.wordsFound || 0) - (a.wordsFound || 0) ||
          (b.titleWordsFound || 0) - (a.titleWordsFound || 0) ||
          (a.bestRank || 9999) - (b.bestRank || 9999) ||
          (a.displayName || '').localeCompare(b.displayName || '')
      );
  }, [round?.leaderboard]);

  const goldPlayer = sortedLeaderboard[0] || null;
  const silverPlayer = sortedLeaderboard[1] || null;
  const bronzePlayer = sortedLeaderboard[2] || null;

  const renderPlayerAvatar = (
    avatarUrlOrInitials: string | undefined,
    displayName: string,
    sizeClasses: string,
    borderClasses: string
  ) => {
    const cleanName = (displayName || 'Player').replace(/^@+/, '');
    const fallbackUrl = `https://i.pravatar.cc/150?u=${encodeURIComponent(cleanName)}`;
    const src =
      avatarUrlOrInitials && avatarUrlOrInitials.startsWith('http')
        ? avatarUrlOrInitials
        : fallbackUrl;
    return (
      <img
        src={src}
        alt={cleanName}
        referrerPolicy="no-referrer"
        onError={(e) => {
          const target = e.currentTarget;
          if (target.src !== fallbackUrl) {
            target.src = fallbackUrl;
          }
        }}
        className={`${sizeClasses} rounded-full object-cover ${borderClasses}`}
      />
    );
  };

  const syncedSnapshot = useMemo(
    () =>
      !isOverlay && round
        ? {
            round,
            activeNav,
            showGridInHybrid,
            showLengthsOnBlocks,
            feedbackToast,
            isManuscriptAutoScroll,
            isLightMode,
          }
        : null,
    [
      isOverlay,
      round,
      activeNav,
      showGridInHybrid,
      showLengthsOnBlocks,
      feedbackToast,
      isManuscriptAutoScroll,
      isLightMode,
    ]
  );

  useOverlaySync<{
    round: RoundState | null;
    activeNav: GameMode;
    showGridInHybrid: boolean;
    showLengthsOnBlocks: boolean;
    feedbackToast: { text: string; tone: 'cyan' | 'gold' | 'green' | 'muted' } | null;
    isManuscriptAutoScroll: boolean;
    isLightMode: boolean;
  }>({
    gameId: 'wikicon',
    streamer:
      overlayStreamer ||
      connectedUsername ||
      authenticatedStreamer ||
      undefined,
    isOverlay,
    localState: syncedSnapshot,
    onSyncedState: useCallback((remote) => {
      if (!remote || !remote.round) return;
      hasReceivedHostSyncRef.current = true;
      setRound(remote.round);
      const navIsGameplay =
        remote.activeNav === 'DAILY' ||
        remote.activeNav === 'SOLO' ||
        remote.activeNav === 'ONLINE' ||
        remote.activeNav === 'WIKIREC_GRID' ||
        remote.activeNav === 'WIKIWORD_QUOTE';
      setActiveNav(navIsGameplay ? remote.activeNav : 'ONLINE');
      setShowGridInHybrid(!!remote.showGridInHybrid);
      setShowLengthsOnBlocks(!!remote.showLengthsOnBlocks);
      setFeedbackToast(remote.feedbackToast ?? null);
      if (typeof remote.isManuscriptAutoScroll === 'boolean') {
        setIsManuscriptAutoScroll(remote.isManuscriptAutoScroll);
      }
      if (typeof remote.isLightMode === 'boolean') {
        setIsLightMode(remote.isLightMode);
      }
    }, []),
  });

  const effectiveNav: GameMode =
    isOverlay &&
    activeNav !== 'DAILY' &&
    activeNav !== 'SOLO' &&
    activeNav !== 'ONLINE' &&
    activeNav !== 'WIKIREC_GRID' &&
    activeNav !== 'WIKIWORD_QUOTE'
      ? 'ONLINE'
      : activeNav;

  return (
    <div
      className={`wikicon-root ${isOverlay && overlayBg === 'transparent' ? 'min-h-0 py-2 bg-transparent' : 'min-h-screen'} flex flex-col items-center transition-colors duration-200 ${
        isOverlay && overlayBg === 'transparent'
          ? isLightMode
            ? 'text-[#102c4b]'
            : 'text-[#f3f8ff]'
          : isLightMode
          ? 'wk-canvas-light text-[#102c4b]'
          : 'wk-canvas-dark text-[#f3f8ff]'
      }`}
    >
      {/* ── Horizontal Flex Wrapper: Live Chat Box on Left (Only when Authorised User Logged In) + 50px Gap + 490px Game Shell ── */}
      <div className="w-full flex flex-col lg:flex-row items-center lg:items-start justify-center gap-[50px] px-2 sm:px-4">
        {/* Live Chat Stream Box to the left of the game with 50px gap — hidden in LIVE Studio overlay */}
        {!isOverlay && authenticatedStreamer && (
          <div className="pt-4">
            <LiveChatBox
              messages={chatMessages}
              connectedUsername={connectedUsername || authenticatedStreamer}
              isLightMode={isLightMode}
            />
          </div>
        )}

        {/* ── Centered 490px App Shell ── */}
        <div className={`w-full max-w-[490px] ${isOverlay ? '' : 'min-h-screen'} flex flex-col shrink-0`}>
          {/* ── Top Navigation Bar (hidden in LIVE Studio overlay) ── */}
          {!isOverlay && (
          <header
            className={`w-full flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b ${
              isLightMode
                ? 'bg-white border-[#6498d2]'
                : 'bg-[#020a25] border-[#1768b3]'
            } sticky top-0 z-30`}
          >
            {/* Zone 1: Brand Wordmark (Links back to Home Screen /) + Back Link */}
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/interactive-games"
                className="px-2 py-1 rounded-lg text-xs font-bold bg-[#0e1d3b] hover:bg-[#152e5c] text-[#8ab4f8] hover:text-white border border-[#234b88] transition-all flex items-center gap-1 shrink-0"
                title="Back to Interactive Games"
              >
                ← Back
              </Link>
              <Link
                to="/"
                title="Return to Home Screen"
                className="inline-flex items-center gap-1.5 text-base font-extrabold tracking-tight whitespace-nowrap shrink-0 cursor-pointer text-left hover:opacity-90"
              >
                <img
                  src="/brand-logo.png"
                  alt="The Missing Piece Home"
                  className="w-5 h-5 rounded object-cover border border-[#19e4ff]/50"
                />
                <span>
                  Wiki<span className="text-[#19e4ff]">Contexto</span>
                </span>
              </Link>
            </div>

            {/* Zone 2: Navigation Links (Home Hub, WikiContexto, Past Dailies, Admin) */}
            <nav className="flex items-center gap-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveNav('HOME')}
                className={`hover:text-[#19e4ff] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeNav === 'HOME'
                    ? 'text-[#19e4ff] underline underline-offset-8 decoration-2'
                    : isLightMode
                    ? 'text-[#163a61]'
                    : 'text-[#d8eaff]'
                }`}
              >
                Home Hub
              </button>
              <button
                type="button"
                onClick={() =>
                  startModeRound('DAILY', {
                    mode: 'WIKICONTEXTO',
                    isDaily: true,
                    dailyDate: '2026-10-31',
                  })
                }
                className={`hover:text-[#19e4ff] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeNav === 'DAILY' ||
                  activeNav === 'SOLO' ||
                  activeNav === 'ONLINE' ||
                  activeNav === 'WIKIREC_GRID' ||
                  activeNav === 'WIKIWORD_QUOTE'
                    ? 'text-[#19e4ff] underline underline-offset-8 decoration-2'
                    : isLightMode
                    ? 'text-[#163a61]'
                    : 'text-[#d8eaff]'
                }`}
              >
                WikiContexto
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('ARCHIVE')}
                className={`hover:text-[#19e4ff] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeNav === 'ARCHIVE'
                    ? 'text-[#19e4ff] underline underline-offset-8 decoration-2'
                    : isLightMode
                    ? 'text-[#163a61]'
                    : 'text-[#d8eaff]'
                }`}
              >
                Past Dailies
              </button>
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(true)}
                className={`hover:text-[#ffe536] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isLightMode ? 'text-[#163a61]' : 'text-[#d8eaff]'
                }`}
              >
                Admin
              </button>
            </nav>

            {/* Zone 3: Daily Streak + LIVE Overlay + TikTok Live Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              <DailyStreakBadge
                streak={dailyStreak.streak}
                solvedToday={dailyStreak.solvedToday}
                variant={isLightMode ? 'light' : 'cyan'}
                compact
              />
              <LiveOverlayButton
                gameTitle="WikiContexto"
                gameSlug="wikicon"
                streamerHandle={connectedUsername || authenticatedStreamer}
                recommendedSize="520 × 920 or 1080 × 1920"
                label="Overlay"
                className="!px-2 !py-1.5 !text-[11px] !rounded-xl"
              />
              <button
                type="button"
                onClick={() => setIsStreamModalOpen(true)}
                aria-haspopup="dialog"
                title="Open TikTok Live Connection pop-up"
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  tiktokConnState === 'connected'
                    ? 'bg-[#2bff86] text-[#020a25] shadow-[0_0_16px_rgba(43,255,134,0.35)]'
                    : authenticatedStreamer
                    ? 'bg-[#ffe536] text-[#020a25]'
                    : 'bg-[#19e4ff] hover:bg-[#5cecff] text-[#020a25] shadow-[0_0_14px_rgba(25,228,255,0.28)]'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                {tiktokConnState === 'connected' && connectedUsername
                  ? `@${connectedUsername}`
                  : authenticatedStreamer
                  ? authenticatedStreamer
                  : 'TikTok Live'}
              </button>
            </div>
          </header>
          )}

          {/* ── VIEW 1: WIKICONTEXTO 6-BUBBLE HOME PORTAL (490px width) ── */}
          {!isOverlay && effectiveNav === 'HOME' && (
            <main className="flex-1 w-full px-4 py-6 flex flex-col justify-between">
              {/* Suite Top Subbar */}
              <div className="flex items-center justify-between text-[11px] text-[#96b8dd] gap-2">
                <button
                  type="button"
                  onClick={() => setActiveNav('TYCOON_HUB')}
                  className="flex items-center gap-1.5 font-bold text-[#f3f8ff] hover:text-[#19e4ff] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Coins className="w-3.5 h-3.5 text-[#ffe536]" />
                  <span>Word Tycoon · {Math.floor(profile.coins).toLocaleString()} Coins</span>
                </button>
                <span className="truncate font-mono tabular-nums">
                  {profile.displayName} · ELO {profile.elo}
                </span>
              </div>

              {/* Center Wordmark & Tagline */}
              <section className="my-6 text-center">
                <div className="inline-flex items-center justify-center gap-2.5 mb-1.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#19e4ff] to-[#137bcc] flex items-center justify-center shadow-[0_0_20px_rgba(25,228,255,0.4)] text-[#020a25] font-black text-xl">
                    W
                  </div>
                  <h1
                    className="text-3xl font-black tracking-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    Wiki<span className="text-[#19e4ff]">Contexto</span>{' '}
                    <span className="text-base font-bold text-[#ffe536]">× Wikirec</span>
                  </h1>
                </div>
                <p className="text-xs text-[#96b8dd] mt-1.5 leading-relaxed">
                  One hidden Wikipedia article. Semantic rank cards, 8-connected arcade keycaps, and live TikTok stream play.
                </p>
              </section>

              {/* Authentic 2×3 Bubble Grid Menu inside 490px */}
              <nav
                aria-label="WikiContexto menu"
                className="grid grid-cols-2 gap-3.5 my-2"
              >
                {/* Bubble 1: Solo */}
                <button
                  type="button"
                  onClick={() =>
                    startModeRound('SOLO', {
                      mode: 'WIKICONTEXTO',
                      isDaily: false,
                    })
                  }
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#06244b] to-[#03142f] border-2 border-[#19e4ff]/70 hover:border-[#19e4ff] shadow-[0_0_20px_rgba(25,228,255,0.15)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#19e4ff]/15 text-[#19e4ff] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Compass className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-white whitespace-nowrap">
                    Solo
                  </span>
                  <span className="text-[11px] text-[#96b8dd]">
                    Explore random articles
                  </span>
                </button>

                {/* Bubble 2: Online + TikTok Stream */}
                <button
                  type="button"
                  onClick={() => {
                    startModeRound('ONLINE', {
                      mode: 'WIKICONTEXTO',
                      isDaily: false,
                    });
                    if (!authenticatedStreamer) {
                      setIsStreamModalOpen(true);
                    }
                  }}
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#06244b] to-[#03142f] border-2 border-[#2bff86]/70 hover:border-[#2bff86] shadow-[0_0_20px_rgba(43,255,134,0.15)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#2bff86]/15 text-[#2bff86] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Globe className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-white whitespace-nowrap">
                    Online &amp; TikTok
                  </span>
                  <span className="text-[11px] text-[#96b8dd]">
                    Discover together live
                  </span>
                </button>

                {/* Bubble 3: Daily Puzzle */}
                <button
                  type="button"
                  onClick={() =>
                    startModeRound('DAILY', {
                      mode: 'WIKICONTEXTO',
                      isDaily: true,
                      dailyDate: '2026-10-31',
                    })
                  }
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#2b1f06] via-[#06244b] to-[#03142f] border-2 border-[#ffe536] shadow-[0_0_22px_rgba(255,229,54,0.2)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#ffe536]/20 text-[#ffe536] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-[#ffe536] whitespace-nowrap">
                    Daily Puzzle
                  </span>
                  <span className="text-[11px] text-[#d8eaff]">
                    Oct 31 Discovery
                  </span>
                </button>

                {/* Bubble 4: Wikirec Keycap Grid */}
                <button
                  type="button"
                  onClick={() =>
                    startModeRound('WIKIREC_GRID', {
                      mode: 'WIKIREC_GRID',
                      isDaily: false,
                    })
                  }
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#1b3346] to-[#0a1620] border-2 border-[#ee7a2c] shadow-[0_0_20px_rgba(238,122,44,0.2)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#ee7a2c]/20 text-[#ee7a2c] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Grid className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-white whitespace-nowrap">
                    Wikirec Grid
                  </span>
                  <span className="text-[11px] text-[#96b8dd]">
                    7×7 Keycaps &amp; Pyramid
                  </span>
                </button>

                {/* Bubble 5: Previous Dailies Archive */}
                <button
                  type="button"
                  onClick={() => setActiveNav('ARCHIVE')}
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#06244b] to-[#03142f] border-2 border-[#137bcc] hover:border-[#19e4ff] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#137bcc]/25 text-[#96b8dd] group-hover:text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                    <History className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-white whitespace-nowrap">
                    Previous Dailies
                  </span>
                  <span className="text-[11px] text-[#96b8dd]">
                    Revisit past puzzles
                  </span>
                </button>

                {/* Bubble 6: Profile & Cosmetics (Word Tycoon Hub) */}
                <button
                  type="button"
                  onClick={() => setActiveNav('TYCOON_HUB')}
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#270e28] to-[#03142f] border-2 border-[#d557a7] hover:border-[#ff8cd6] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#d557a7]/20 text-[#ff8cd6] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-white whitespace-nowrap">
                    Profile &amp; Tycoon
                  </span>
                  <span className="text-[11px] text-[#96b8dd]">
                    Cosmetics &amp; Empire
                  </span>
                </button>
              </nav>

              {/* Footer */}
              <footer className="mt-6 pt-3.5 border-t border-[#1768b3]/30 flex items-center justify-between text-[11px] text-[#96b8dd]">
                <span>Pick a bubble. Follow your curiosity.</span>
                <button
                  type="button"
                  onClick={() =>
                    startModeRound('WIKIWORD_QUOTE', {
                      mode: 'WIKIWORD_QUOTE',
                      isDaily: false,
                    })
                  }
                  className="hover:text-[#19e4ff] transition-colors cursor-pointer whitespace-nowrap"
                >
                  WikiWord 5×7 →
                </button>
              </footer>
            </main>
          )}

          {/* ── VIEW 2: PREVIOUS DAILIES ARCHIVE (490px width) ── */}
          {!isOverlay && effectiveNav === 'ARCHIVE' && (
            <main className="flex-1 w-full px-4 py-6 space-y-4">
              <div>
                <h1 className="text-xl font-extrabold">Previous Daily Discoveries</h1>
                <p className="text-xs text-[#96b8dd] mt-1">
                  Play any archived Wikipedia article in WikiContexto or Wikirec Keycap Grid Mode.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {archiveList.map((item) => {
                  const isDone = profile.completedDailies.includes(item.date);
                  return (
                    <div
                      key={item.date}
                      className="p-4 rounded-2xl bg-[#061c3d] border-2 border-[#137bcc] flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-[#96b8dd]">
                          <span className="font-mono tabular-nums">{item.date} · {item.difficulty}</span>
                          {isDone && (
                            <span className="text-[#2bff86] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Solved
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-extrabold text-white mt-0.5">
                          {item.category}
                        </h3>
                        <p className="text-[11px] text-[#96b8dd] mt-0.5 font-mono tabular-nums">
                          Approx. {item.wordCount} tokens · Hidden Wikipedia Article
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            startModeRound('DAILY', {
                              mode: 'WIKICONTEXTO',
                              isDaily: true,
                              dailyDate: item.date,
                              customTitle: item.title,
                            })
                          }
                          className="flex-1 py-2 px-3 rounded-xl bg-[#19e4ff] hover:bg-[#5cecff] text-[#020a25] text-xs font-bold cursor-pointer whitespace-nowrap"
                        >
                          Play WikiContexto
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            startModeRound('WIKIREC_GRID', {
                              mode: 'WIKIREC_GRID',
                              isDaily: true,
                              dailyDate: item.date,
                              customTitle: item.title,
                            })
                          }
                          className="flex-1 py-2 px-3 rounded-xl bg-[#0c2b53] hover:bg-[#1768b3] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                        >
                          Play Wikirec Grid
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </main>
          )}

          {/* ── VIEW 3: WORD TYCOON ECONOMY & COSMETICS HUB (490px width) ── */}
          {!isOverlay && effectiveNav === 'TYCOON_HUB' && (
            <main className="flex-1 w-full">
              <WordTycoonHubView
                profile={profile}
                onUpgradeBusiness={handleUpgradeBusiness}
                onBuyOrEquipCosmetic={handleBuyOrEquipCosmetic}
                onRenameUser={(newName) =>
                  setProfile((p) => ({
                    ...p,
                    displayName: newName,
                    avatar: newName.slice(0, 2).toUpperCase(),
                  }))
                }
              />
            </main>
          )}

          {/* ── VIEW 4: ACTIVE GAMEPLAY ARENA (490px Portrait Width) ── */}
          {(effectiveNav === 'DAILY' ||
            effectiveNav === 'SOLO' ||
            effectiveNav === 'ONLINE' ||
            effectiveNav === 'WIKIREC_GRID' ||
            effectiveNav === 'WIKIWORD_QUOTE') &&
            round && (
              <main className="flex-1 w-full px-3.5 py-2.5 space-y-2">
                {/* Compact Workspace Mode & Utility Toolbar (hidden in LIVE Studio overlay) */}
                {!isOverlay && (
                <div className="flex flex-col gap-1.5 p-1.5 rounded-xl bg-[#03142f] border border-[#1768b3]">
                  {/* Row 1: Mode Switcher Tabs */}
                  <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-[#020a25]">
                    <button
                      type="button"
                      onClick={() =>
                        startModeRound('DAILY', {
                          mode: 'WIKICONTEXTO',
                          isDaily: true,
                          dailyDate: '2026-10-31',
                        })
                      }
                      className={`py-1 px-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate ${
                        activeNav === 'DAILY'
                          ? 'bg-[#19e4ff] text-[#020a25]'
                          : 'text-[#96b8dd] hover:text-white'
                      }`}
                    >
                      Daily
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startModeRound('SOLO', {
                          mode: 'WIKICONTEXTO',
                          isDaily: false,
                        })
                      }
                      className={`py-1 px-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate ${
                        activeNav === 'SOLO'
                          ? 'bg-[#19e4ff] text-[#020a25]'
                          : 'text-[#96b8dd] hover:text-white'
                      }`}
                    >
                      Solo
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startModeRound('WIKIREC_GRID', {
                          mode: 'WIKIREC_GRID',
                          isDaily: false,
                        })
                      }
                      className={`py-1 px-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate flex items-center justify-center gap-1 ${
                        activeNav === 'WIKIREC_GRID'
                          ? 'bg-[#ee7a2c] text-white'
                          : 'text-[#96b8dd] hover:text-white'
                      }`}
                    >
                      <Grid className="w-3 h-3 shrink-0" /> 7×7 Grid
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startModeRound('WIKIWORD_QUOTE', {
                          mode: 'WIKIWORD_QUOTE',
                          isDaily: false,
                        })
                      }
                      className={`py-1 px-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate flex items-center justify-center gap-1 ${
                        activeNav === 'WIKIWORD_QUOTE'
                          ? 'bg-[#2bff86] text-[#020a25]'
                          : 'text-[#96b8dd] hover:text-white'
                      }`}
                    >
                      <Quote className="w-3 h-3 shrink-0" /> 5×7 Quote
                    </button>
                  </div>

                  {/* Row 2: Game Utilities */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowGridInHybrid((v) => !v)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                          showGridInHybrid
                            ? 'bg-[#ee7a2c]/20 border-[#ee7a2c] text-[#ee7a2c]'
                            : 'bg-[#061c3d] border-[#1768b3] text-[#d8eaff]'
                        }`}
                      >
                        {showGridInHybrid ? 'Hide Grid' : 'Show Grid'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLengthsOnBlocks((v) => !v)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                          showLengthsOnBlocks
                            ? 'bg-[#19e4ff]/20 border-[#19e4ff] text-[#19e4ff]'
                            : 'bg-[#061c3d] border-[#1768b3] text-[#d8eaff]'
                        }`}
                      >
                        {showLengthsOnBlocks ? 'Hide Lengths' : 'Lengths'}
                      </button>
                      <button
                        type="button"
                        onClick={handleRequestHint}
                        disabled={round.solved}
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#061c3d] hover:bg-[#0c2b53] border border-[#ffe536]/60 text-[#ffe536] flex items-center gap-1 cursor-pointer whitespace-nowrap disabled:opacity-40"
                      >
                        <Lightbulb className="w-3 h-3" /> Hint
                      </button>
                      <button
                        type="button"
                        onClick={handleRevealRound}
                        disabled={round.solved}
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#061c3d] hover:bg-[#0c2b53] border border-[#1768b3] text-[#96b8dd] hover:text-white flex items-center gap-1 cursor-pointer whitespace-nowrap disabled:opacity-40"
                      >
                        <Flag className="w-3 h-3" /> Reveal
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const nextMute = !isMuted;
                          setIsMuted(nextMute);
                          soundFX.muted = nextMute;
                        }}
                        aria-label="Toggle Sound"
                        className="p-1 rounded-md bg-[#061c3d] border border-[#1768b3] text-[#d8eaff] hover:text-white cursor-pointer"
                      >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsLightMode((v) => !v)}
                        aria-label="Toggle Light/Dark Theme"
                        className="p-1 rounded-md bg-[#061c3d] border border-[#1768b3] text-[#d8eaff] hover:text-white cursor-pointer"
                      >
                        {isLightMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                )}

                {/* ── Round Complete Overlay Card (Shows Top Player Profile Picture, Display Name, and Score + Current Article Info) ── */}
                {round.solved && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0b4937] via-[#06244b] to-[#0b4937] border-2 border-[#2bff86] shadow-[0_0_24px_rgba(43,255,134,0.3)] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold text-[#2bff86]">
                          ROUND COMPLETE · {round.articleCategory}
                        </div>
                        <h2 className="text-xl font-black text-white">
                          {round.articleTitle}
                        </h2>
                      </div>
                      {!isOverlay && (
                      <button
                        type="button"
                        onClick={() =>
                          startModeRound(activeNav, {
                            mode: round.mode,
                            isDaily: false,
                          })
                        }
                        className="px-3.5 py-2 rounded-xl bg-[#2bff86] hover:bg-[#5effa3] text-[#020a25] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Next Round
                      </button>
                      )}
                    </div>

                    {round.articleSummaryQuote && (
                      <p className="text-xs text-[#d8eaff]">
                        {round.articleSummaryQuote}
                      </p>
                    )}

                    {/* Top Player MVP Highlight on Round Complete Overlay */}
                    <div className="p-3 rounded-xl bg-[#020a25] border border-[#ffe536] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <Crown className="w-4 h-4 text-[#ffe536] absolute -top-2.5 -left-1 -rotate-12" />
                          {renderPlayerAvatar(
                            goldPlayer?.avatar,
                            goldPlayer?.displayName || profile.displayName,
                            'w-11 h-11 text-xs text-[#ffe536]',
                            'border-2 border-[#ffe536]'
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-[#ffe536] flex items-center gap-1">
                            <Trophy className="w-3 h-3" /> TOP PLAYER OF THE ROUND
                          </div>
                          <div className="text-sm font-extrabold text-white truncate">
                            {goldPlayer ? goldPlayer.displayName : profile.displayName}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-[#96b8dd]">Top Score</div>
                        <div className="text-base font-extrabold font-mono tabular-nums text-[#2bff86]">
                          {(goldPlayer ? goldPlayer.score : 0).toLocaleString()} pts
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Authentic WikiContexto 2-Column Top Row (Compacted ~25% height) ── */}
                {effectiveNav !== 'WIKIWORD_QUOTE' && (
                  <section className="grid grid-cols-12 gap-2 items-stretch">
                    {/* Left Column (5 cols): Title Block + Podium */}
                    <div className="col-span-5 flex flex-col gap-1.5">
                      {/* Title Block */}
                      <div className="flex-1 p-2 rounded-xl bg-gradient-to-br from-[#06244b] to-[#03142f] border-2 border-[#137bcc] shadow-[inset_0_1px_7px_rgba(25,228,255,0.16)] flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-bold tracking-wider text-[#96b8dd]">
                            TITLE
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-[#d8eaff]">
                            <span className="flex items-center gap-0.5">
                              <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-b from-[#ffec4a] to-[#ffad13] text-[#17210a] font-black text-[9px] inline-flex items-center justify-center">
                                G
                              </span>
                              {round.guessCount}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-b from-[#ffec4a] to-[#ffad13] text-[#17210a] font-black text-[9px] inline-flex items-center justify-center">
                                F
                              </span>
                              {round.revealedWordsCount}/{round.totalWords}
                            </span>
                          </div>
                        </div>

                        {/* Title Word Slots */}
                        <div className="flex flex-wrap items-center gap-1 my-0.5">
                          {round.titleTokens.map((t) => (
                            <div
                              key={t.index}
                              className={`min-h-[26px] px-2 py-0.5 rounded-lg font-extrabold text-xs flex items-center gap-1 transition-all ${
                                t.revealed
                                  ? 'bg-gradient-to-br from-[#64ff54] to-[#22ed3f] text-[#061d0c] shadow-[0_0_10px_rgba(57,255,99,0.3)]'
                                  : 'bg-gradient-to-br from-[#fff780] to-[#ffcf27] text-[#111809] border border-[#ffef86]'
                              }`}
                            >
                              <span className="truncate max-w-[130px]">
                                {t.revealed
                                  ? t.text
                                  : showLengthsOnBlocks
                                  ? `${t.length}L`
                                  : 'HIDDEN'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Gold / Silver / Bronze Scoreboard Podium */}
                      <div className="p-1.5 rounded-xl bg-gradient-to-br from-[#06244b] to-[#03142f] border-2 border-[#137bcc] flex items-end justify-center gap-1 min-h-[86px]">
                        {/* Silver #2 */}
                        <div className="relative flex-1 min-w-0 h-[66px] rounded-lg border border-[#8ab9f5] bg-gradient-to-br from-[#1b467a] to-[#0d3470] p-1 flex flex-col items-center justify-between text-center">
                          <span className="absolute -top-1.5 left-1 px-1 rounded bg-[#8ab9f5] text-[#041838] text-[8px] font-black leading-tight">
                            2nd
                          </span>
                          {silverPlayer ? (
                            renderPlayerAvatar(
                              silverPlayer.avatar,
                              silverPlayer.displayName,
                              'w-6 h-6 text-[9px] text-white mt-0.5',
                              'border border-[#8ab9f5]'
                            )
                          ) : (
                            <div className="w-6 h-6 mt-0.5 rounded-full border border-[#8ab9f5]/60 bg-[#082046] flex items-center justify-center text-[9px] font-bold text-[#8ab9f5]">
                              2
                            </div>
                          )}
                          <div className="text-[9px] font-bold text-[#e6f2ff] truncate w-full leading-tight">
                            {silverPlayer ? silverPlayer.displayName : '—'}
                          </div>
                          <div className="text-[9px] font-mono tabular-nums text-white font-bold leading-tight">
                            {silverPlayer ? silverPlayer.score.toLocaleString() : '0'}
                          </div>
                        </div>

                        {/* Gold #1 */}
                        <div className="relative flex-1 min-w-0 h-[76px] rounded-lg border-2 border-[#ffdd35] bg-gradient-to-br from-[#700432] to-[#270e28] shadow-[0_0_10px_rgba(255,214,48,0.28)] p-1 flex flex-col items-center justify-between text-center">
                          <Crown className="w-3.5 h-3.5 text-[#ffe536] absolute -top-2 -left-0.5 -rotate-12" />
                          <span className="absolute -top-1.5 right-1 px-1 rounded bg-[#ffe536] text-[#270e28] text-[8px] font-black leading-tight">
                            1st
                          </span>
                          {goldPlayer ? (
                            renderPlayerAvatar(
                              goldPlayer.avatar,
                              goldPlayer.displayName,
                              'w-6 h-6 text-[10px] text-[#ffe536] mt-0.5',
                              'border border-[#ffe536]'
                            )
                          ) : (
                            <div className="w-6 h-6 mt-0.5 rounded-full border border-[#ffe536]/70 bg-[#270e28] flex items-center justify-center text-[9px] font-extrabold text-[#ffe536]">
                              1
                            </div>
                          )}
                          <div className="text-[9px] font-extrabold text-[#ffe536] truncate w-full leading-tight">
                            {goldPlayer ? goldPlayer.displayName : '—'}
                          </div>
                          <div className="text-[9px] font-mono tabular-nums text-white font-bold leading-tight">
                            {goldPlayer ? goldPlayer.score.toLocaleString() : '0'}
                          </div>
                        </div>

                        {/* Bronze #3 */}
                        <div className="relative flex-1 min-w-0 h-[60px] rounded-lg border border-[#b07a3d] bg-gradient-to-br from-[#183553] to-[#020c22] p-1 flex flex-col items-center justify-between text-center">
                          <span className="absolute -top-1.5 left-1 px-1 rounded bg-[#d99b52] text-[#1a0d02] text-[8px] font-black leading-tight">
                            3rd
                          </span>
                          {bronzePlayer ? (
                            renderPlayerAvatar(
                              bronzePlayer.avatar,
                              bronzePlayer.displayName,
                              'w-5 h-5 text-[9px] text-white mt-0.5',
                              'border border-[#b07a3d]'
                            )
                          ) : (
                            <div className="w-5 h-5 mt-0.5 rounded-full border border-[#b07a3d]/60 bg-[#0b1f38] flex items-center justify-center text-[8px] font-bold text-[#d99b52]">
                              3
                            </div>
                          )}
                          <div className="text-[9px] font-bold text-[#e6f2ff] truncate w-full leading-tight">
                            {bronzePlayer ? bronzePlayer.displayName : '—'}
                          </div>
                          <div className="text-[9px] font-mono tabular-nums text-white font-bold leading-tight">
                            {bronzePlayer ? bronzePlayer.score.toLocaleString() : '0'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column (7 cols): Top-6 Semantic Rank Cards Stack */}
                    <div className="col-span-7 grid grid-rows-6 gap-1 min-h-[196px]">
                      {paddedRankCards.map((card, idx) => {
                        if (!card) {
                          return (
                            <div
                              key={`empty-${idx}`}
                              className="rounded-lg bg-[#051630] border border-[#21558a] px-2.5 py-0.5 flex items-center justify-between text-[10px] text-[#96b8dd]"
                            >
                              <span>Rank #{idx + 1}</span>
                              <span className="font-mono tabular-nums">—</span>
                            </div>
                          );
                        }

                        const hue = getRankHue(card.rank);
                        const fillWidth = Math.max(18, card.similarity);

                        return (
                          <div
                            key={card.norm}
                            className="relative rounded-lg bg-[#02112a] overflow-hidden flex items-center justify-between px-2 py-0.5"
                            style={{
                              border: `1.5px solid hsl(${hue}, 90%, 55%)`,
                              boxShadow:
                                idx === 0
                                  ? `0 0 10px hsla(${hue}, 90%, 55%, 0.3)`
                                  : `0 0 4px hsla(${hue}, 90%, 55%, 0.18)`,
                            }}
                          >
                            {/* Dynamic HSL Semantic Fill Bar */}
                            <div
                              className="absolute inset-y-0 left-0 pointer-events-none transition-all duration-300"
                              style={{
                                width: `${fillWidth}%`,
                                background: `linear-gradient(90deg, hsla(${hue}, 90%, 50%, 0.52) 0%, hsla(${hue}, 85%, 42%, 0.25) 65%, transparent 100%)`,
                              }}
                            />

                            {/* Left: Rank Number + Word */}
                            <div className="relative z-10 flex items-center gap-1 min-w-0">
                              <span className="min-w-[38px] font-mono tabular-nums text-[11px] font-extrabold text-white flex items-center gap-0.5">
                                {idx === 0 && <span className="text-[#ffe536]">♛</span>}#{card.rank}
                              </span>
                              <span className="text-xs font-extrabold text-white tracking-wide truncate">
                                {card.word}
                              </span>
                            </div>

                            {/* Right: Finder Avatar */}
                            <div className="relative z-10 flex items-center gap-1 shrink-0">
                              {renderPlayerAvatar(
                                card.finder.avatar,
                                card.finder.displayName,
                                'w-5 h-5 text-[9px] text-white',
                                'border border-[#ffe536]'
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* ── Full-Width Word Announce Banner + Feedback Toast ── */}
                <div className="min-h-[34px] rounded-xl border-2 border-[#ffe13a] bg-gradient-to-r from-[#4b003e] via-[#100621] to-[#25082e] shadow-[0_0_10px_rgba(255,222,53,0.2)] px-2.5 py-1 flex items-center justify-between gap-2">
                  {feedbackToast ? (
                    <div className="flex items-center justify-between w-full text-[11px] font-bold gap-2">
                      <span
                        className={`truncate ${
                          feedbackToast.tone === 'gold'
                            ? 'text-[#ffe536]'
                            : feedbackToast.tone === 'green'
                            ? 'text-[#2bff86]'
                            : feedbackToast.tone === 'cyan'
                            ? 'text-[#19e4ff]'
                            : 'text-[#d8eaff]'
                        }`}
                      >
                        {feedbackToast.text}
                      </span>
                      <span className="text-[10px] text-[#96b8dd] font-mono tabular-nums shrink-0">
                        #{round.guessCount}
                      </span>
                    </div>
                  ) : round.lastAnnouncement ? (
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {renderPlayerAvatar(
                          round.lastAnnouncement.avatar,
                          round.lastAnnouncement.displayName,
                          'w-5 h-5 text-[9px] text-[#ffe536] shrink-0',
                          'border border-[#ffe536]'
                        )}
                        <div className="text-[11px] text-[#d8eaff] truncate">
                          <strong className="text-white">{round.lastAnnouncement.displayName}</strong>{' '}
                          found <strong className="text-[#ffe536]">{round.lastAnnouncement.word}</strong>
                        </div>
                      </div>
                      <div className="text-[11px] font-extrabold font-mono tabular-nums text-[#2bff86] shrink-0">
                        +{round.lastAnnouncement.pointsEarned.toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full text-[11px] text-[#d8eaff]">
                      <span className="truncate">
                        Guess words below to uncover the hidden Wikipedia article!
                      </span>
                      <span className="font-mono tabular-nums text-[#ffe536] shrink-0">
                        +50k Title
                      </span>
                    </div>
                  )}
                </div>

                {/* ── Scrolling Marquee for Guessed Words ── */}
                {round.recentTicker.length > 0 && (
                  <div
                    className={`wk-marquee-wrap relative flex items-center overflow-hidden py-1.5 px-2.5 rounded-xl border ${
                      isLightMode
                        ? 'bg-white border-[#6498d2] text-[#102c4b]'
                        : 'bg-[#03142f] border-[#1768b3] text-[#d8eaff]'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold shrink-0 pr-2 mr-2 border-r z-10 ${
                        isLightMode
                          ? 'bg-white text-[#416890] border-[#6498d2]/50'
                          : 'bg-[#03142f] text-[#96b8dd] border-[#1768b3]/60'
                      }`}
                    >
                      Recent
                    </span>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div
                        className="wk-marquee-track"
                        style={
                          {
                            '--wk-marquee-duration': `${Math.max(10, round.recentTicker.length * 3)}s`,
                          } as React.CSSProperties
                        }
                      >
                        {[0, 1].map((dupIdx) => (
                          <div
                            key={dupIdx}
                            aria-hidden={dupIdx === 1}
                            className="flex items-center gap-3 pr-3 min-w-full shrink-0"
                          >
                            {round.recentTicker.map((item) => (
                              <span
                                key={`${dupIdx}-${item.norm}-${item.timestamp}`}
                                className="text-[11px] font-mono tabular-nums whitespace-nowrap shrink-0"
                              >
                                <strong className={isLightMode ? 'text-[#102c4b]' : 'text-white'}>
                                  {item.word}
                                </strong>{' '}
                                <span className={isLightMode ? 'text-[#0e6eb8]' : 'text-[#19e4ff]'}>
                                  #{item.rank}
                                </span>
                                <span className="ml-2 text-[#1768b3]">·</span>
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Wikirec 8-Connected Keycap Grid & Target Pyramid ── */}
                {(effectiveNav === 'WIKIREC_GRID' ||
                  effectiveNav === 'WIKIWORD_QUOTE' ||
                  showGridInHybrid) &&
                  round.gridBoard && (
                    <section className="p-3 rounded-2xl bg-gradient-to-br from-[#06244b] to-[#03142f] border-2 border-[#137bcc]">
                      <KeycapGrid
                        gridBoard={round.gridBoard}
                        onWordSubmit={submitWordGuess}
                        isLightMode={isLightMode}
                      />
                    </section>
                  )}

                {/* ── Redacted Wikipedia Article Body Panel (Auto-Scrolling Viewport) ── */}
                <section
                  className={`wk-manuscript-box p-3.5 rounded-2xl border-2 border-[#137bcc] shadow-[inset_0_1px_7px_rgba(25,228,255,0.15)] space-y-2.5 ${
                    isLightMode
                      ? 'bg-white text-[#102c4b]'
                      : 'bg-gradient-to-br from-[#06244b] to-[#03142f] text-[#f3f8ff]'
                  }`}
                  style={{ fontFamily: 'var(--font-article)' }}
                >
                  <div className="flex items-center justify-between border-b border-[#1768b3]/40 pb-1.5 text-[11px] text-[#96b8dd]">
                    <span>Wikipedia Redacted Manuscript</span>
                    <div className="flex items-center gap-2.5">
                      {!isOverlay && (
                      <button
                        type="button"
                        onClick={() => setIsManuscriptAutoScroll((v) => !v)}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          isLightMode
                            ? 'hover:bg-[#eaf4ff] text-[#416890]'
                            : 'hover:bg-[#0c2b53] text-[#96b8dd]'
                        }`}
                        title={
                          isManuscriptAutoScroll
                            ? 'Pause automatic manuscript scrolling'
                            : 'Resume automatic manuscript scrolling'
                        }
                      >
                        {isManuscriptAutoScroll ? (
                          <Pause className="w-3 h-3" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        {isManuscriptAutoScroll ? 'Auto' : 'Paused'}
                      </button>
                      )}
                      <span className="font-mono tabular-nums">
                        {Math.round((round.revealedWordsCount / Math.max(1, round.totalWords)) * 100)}% Uncovered
                      </span>
                    </div>
                  </div>

                  <div
                    ref={manuscriptScrollRef}
                    onMouseEnter={() => {
                      manuscriptHoverPausedRef.current = true;
                    }}
                    onMouseLeave={() => {
                      manuscriptHoverPausedRef.current = false;
                    }}
                    onWheel={() => {
                      manuscriptManualPauseUntilRef.current = performance.now() + 3000;
                    }}
                    onTouchStart={() => {
                      manuscriptManualPauseUntilRef.current = performance.now() + 3000;
                    }}
                    onScroll={(e) => {
                      const curTop = e.currentTarget.scrollTop;
                      if (Math.abs(curTop - manuscriptScrollPosRef.current) > 4) {
                        manuscriptScrollPosRef.current = curTop;
                        manuscriptManualPauseUntilRef.current = performance.now() + 3000;
                      }
                    }}
                    className="wk-manuscript-scroll max-h-[245px] overflow-y-auto overscroll-contain pr-1.5 space-y-3 leading-7 text-[15px]"
                  >
                    {round.paragraphs.map((para, pIdx) => (
                      <p key={pIdx} className="break-words">
                        {para.map((tok) => {
                          if (tok.type === 'space') {
                            return <span key={tok.id}>{tok.text}</span>;
                          }
                          if (tok.revealed) {
                            return (
                              <span
                                key={tok.id}
                                className={`font-semibold transition-colors ${
                                  tok.isStop
                                    ? isLightMode
                                      ? 'text-[#416890]'
                                      : 'text-[#d8eaff]'
                                    : isLightMode
                                    ? 'text-[#08724c] font-bold wk-word-reveal'
                                    : 'text-[#2bff86] font-bold wk-word-reveal'
                                }`}
                              >
                                {tok.text}
                              </span>
                            );
                          }

                          const blockWidthCh = Math.max(3, Math.min(11, tok.length));
                          return (
                            <button
                              key={tok.id}
                              type="button"
                              onClick={() => setShowLengthsOnBlocks((v) => !v)}
                              title={`${tok.isNumber ? `${tok.digitCount} digits` : `${tok.length} letters`} (Click to toggle lengths)`}
                              style={{ minWidth: `${blockWidthCh * 0.56}rem` }}
                              className={`inline-flex items-center justify-center align-baseline mx-0.5 px-1 py-0.5 rounded-md text-[11px] font-mono tabular-nums font-bold cursor-pointer select-none transition-all ${
                                tok.isNumber
                                  ? 'bg-[#ee7a2c] text-white border border-[#ffad75]'
                                  : tok.isTitleWord
                                  ? 'bg-[#ffe536] text-[#111809] border border-[#fff799]'
                                  : isLightMode
                                  ? 'bg-[#bbd5f0] text-[#102c4b] hover:bg-[#a3c6eb]'
                                  : 'bg-[#123e73] text-[#96b8dd] hover:bg-[#195396] border border-[#1d5ca1]'
                              }`}
                            >
                              {showLengthsOnBlocks
                                ? tok.isNumber
                                  ? `${tok.digitCount}D`
                                  : tok.length
                                : '\u00A0'.repeat(Math.min(7, tok.length))}
                            </button>
                          );
                        })}
                      </p>
                    ))}
                  </div>
                </section>

                {/* ── Guess Composer Input Bar (hidden in LIVE Studio overlay) ── */}
                {!isOverlay && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitWordGuess(guessInput);
                  }}
                  className={`flex items-center gap-2 p-1.5 rounded-2xl border-2 shadow-[0_0_16px_rgba(19,132,211,0.2)] ${
                    isLightMode
                      ? 'bg-white border-[#6498d2]'
                      : 'bg-[#03142f] border-[#2186c6]'
                  }`}
                >
                  <input
                    type="text"
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    placeholder="Guess a word..."
                    className={`flex-1 min-w-0 px-3.5 py-2 rounded-xl border text-sm font-bold focus:outline-none focus:border-[#19e4ff] ${
                      isLightMode
                        ? 'bg-[#eaf4ff] border-[#6498d2] text-[#102c4b] placeholder-[#416890]/60'
                        : 'bg-[#020a25] border-[#286296] text-white placeholder-[#96b8dd]/60'
                    }`}
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-b from-[#ffed60] to-[#ffca27] hover:from-[#fff380] hover:to-[#ffd645] text-[#17210a] font-extrabold text-xs border border-[#ffed6c] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" /> Guess
                  </button>
                </form>
                )}
              </main>
            )}
        </div>
      </div>

      {!isOverlay && (
      <>
      {/* ── TikTok Live Stream Connector & Debug Modal ── */}
      <TikTokStreamModal
        isOpen={isStreamModalOpen}
        onClose={() => setIsStreamModalOpen(false)}
        authenticatedStreamer={authenticatedStreamer}
        onStreamerLogin={handleStreamerLogin}
        onStreamerLogout={() => performStreamerLogout('Logged out of TikTok Live panel.')}
        connectionState={tiktokConnState}
        connectedUsername={connectedUsername}
        connectedRoomId={connectedRoomId}
        errorMessage={tiktokError}
        onConnectTikTok={handleConnectTikTok}
        onReconnectTikTok={() => handleReconnectTikTok(connectedUsername || '')}
        onDisconnectTikTok={handleDisconnectTikTok}
        onSimulateChat={(data) => {
          recordActivity();
          processChatEventRef.current?.(data);
          emitResilientEvent(socketRef.current, 'chat-message', { ...data, gameId: 'wikicon' });
        }}
        onSimulateLike={(data) => {
          recordActivity();
          emitResilientEvent(socketRef.current, 'like-event', data);
        }}
        onSimulateGift={(data) => {
          recordActivity();
          emitResilientEvent(socketRef.current, 'gift-event', data);
        }}
        totalLikesCount={totalLikesCount}
        totalGiftsCount={totalGiftsCount}
      />

      {/* ── Admin Portal Modal ── */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />
      </>
      )}
    </div>
  );
}

export default App;
