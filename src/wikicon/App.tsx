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
  decodeHtmlEntities,
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
  recordInteractiveRoundCompleted,
  tryConsumeOrCheckNextRound,
} from '@/lib/interactive-daily-limits';
import {
  triggerResilientConnect,
  forceReconnectBridge,
  emitResilientEvent,
  createEventDeduplicator,
  attachResilientChatListeners,
  normalizeIncomingChatPayload,
} from '@/lib/live-chat-bridge';
import {
  creditInteractiveScoreByTikTokHandle,
  getCurrentUserSessionPrefix,
  saveUnifiedLeaderboardScore,
  getUserProfileAvatarUrl,
} from '../lib/unified-game-auth';
import { useOverlayConfig, useOverlaySync } from '@/lib/live-overlay';
import { LiveOverlayButton } from '@/components/interactive-games/live-overlay-button';
import { LoggedInIndicator } from '@/components/logged-in-indicator';
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
  equippedFrame: '#facc15',
  equippedTileSkin: 'royal-purple',
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
      previewHex: '#facc15',
      unlocked: true,
      equipped: true,
    },
    {
      id: 'cos-title-oracle',
      name: 'Contexto Grandmaster',
      slot: 'title',
      price: 2500,
      previewHex: '#fde047',
      unlocked: false,
      equipped: false,
    },
    {
      id: 'cos-title-tiktok',
      name: 'Stream Legend',
      slot: 'title',
      price: 3500,
      previewHex: '#4ade80',
      unlocked: false,
      equipped: false,
    },
    {
      id: 'cos-frame-cyan',
      name: 'Royal Amethyst Halo',
      slot: 'frame',
      price: 0,
      previewHex: '#c084fc',
      unlocked: true,
      equipped: true,
    },
    {
      id: 'cos-frame-gold',
      name: 'Sovereign Gold Crown',
      slot: 'frame',
      price: 4000,
      previewHex: '#facc15',
      unlocked: false,
      equipped: false,
    },
    {
      id: 'cos-frame-mint',
      name: 'Emerald Matrix Frame',
      slot: 'frame',
      price: 3000,
      previewHex: '#4ade80',
      unlocked: false,
      equipped: false,
    },
  ],
};

export function App({ soloOnly = false }: { soloOnly?: boolean }) {
  const { isOverlay: rawIsOverlay, bg: overlayBg, streamer: overlayStreamer } = useOverlayConfig();
  const isSoloRoute =
    soloOnly ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/solo-games'));
  const isOverlay = isSoloRoute ? false : rawIsOverlay;
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
  const [isAutoNextRound, setIsAutoNextRound] = useState<boolean>(() => {
    try {
      return localStorage.getItem('wk_auto_next_round_v1') !== 'false';
    } catch {
      return true;
    }
  });
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);

  const toggleAutoNextRound = useCallback(() => {
    setIsAutoNextRound((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('wk_auto_next_round_v1', String(next));
      } catch {}
      return next;
    });
  }, []);

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
    if (isOverlay) return;
    try {
      localStorage.setItem(
        `wk_tycoon_profile_v1_${getCurrentUserSessionPrefix()}`,
        JSON.stringify(profile),
      );
    } catch (_) {}
  }, [profile, isOverlay]);

  // Passive coin generation from Word Tycoon businesses
  useEffect(() => {
    if (isOverlay) return;
    const interval = setInterval(() => {
      const perMin = profile.businesses.reduce((acc, b) => acc + b.coinsPerMinute * b.level, 0);
      const perTick = perMin / 12;
      setProfile((p) => ({ ...p, coins: p.coins + perTick }));
    }, 5000);
    return () => clearInterval(interval);
  }, [profile.businesses, isOverlay]);

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
    if (!isOverlay) {
      createNewWikiconRound({ mode: 'WIKICONTEXTO', isDaily: false }).then((init) => {
        internalRoundRef.current = init;
        setRound(serializeWikiconRound(init));
      });
    }
    setArchiveList(getArchiveList());

    if (isSoloRoute || isOverlay) return;

    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      timeout: 5000,
      query: {
        sessionId: getCurrentUserSessionPrefix(),
        gameId: 'wikicon',
      },
    });
    socketRef.current = socket;
    const deduplicator = createEventDeduplicator();

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

    const processChatEvent = (rawData: any) => {
      recordActivity();
      const normalized = normalizeIncomingChatPayload(rawData);
      if (!normalized) return;

      const rawComment = String(normalized.comment || '');
      const cleanUniqueId = (normalized.uniqueId || normalized.nickname || 'viewer').replace(/^@+/, '');
      const cleanNickname = (normalized.nickname || normalized.uniqueId || 'Viewer').replace(/^@+/, '');
      const rawPfp = (normalized.profilePictureUrl || '').trim();
      const normalizedPfp = rawPfp.startsWith('//') ? `https:${rawPfp}` : rawPfp;
      const validPfp = normalizedPfp.startsWith('http')
        ? normalizedPfp
        : `https://i.pravatar.cc/150?u=${encodeURIComponent(cleanUniqueId || cleanNickname)}`;

      const msg: TikTokChatMessage = {
        id: normalized.id || `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        uniqueId: cleanUniqueId,
        nickname: cleanNickname,
        comment: rawComment,
        profilePictureUrl: validPfp,
        timestamp: normalized.timestamp || Date.now(),
      };
      // Append all chat messages (even if not part of puzzle, multi-word, or numbers)
      setChatMessages((prev) => [...prev.slice(-199), msg]);

      if (isOverlay) {
        return;
      }

      // Evaluate chat message words against the active WikiContexto round (frozen once solved)
      if (internalRoundRef.current && !internalRoundRef.current.solved && rawComment.trim()) {
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
    processChatEventRef.current = (data: any) => {
      if (deduplicator.shouldProcess('chat', data)) {
        processChatEvent(data);
      }
    };

    const processLikeEvent = (data: TikTokLikeEvent) => {
      recordActivity();
      setTotalLikesCount((prev) => prev + (Number(data.likeCount) || 1));
    };

    const processGiftEvent = (data: TikTokGiftEvent) => {
      recordActivity();
      if (data.repeatEnd === false) return;
      const count = Number(data.repeatCount) || 1;
      setTotalGiftsCount((prev) => prev + count);
      if (isOverlay) return;
      if (internalRoundRef.current && !internalRoundRef.current.solved) {
        const hintWord = revealWikiconHint(internalRoundRef.current);
        setRound(serializeWikiconRound(internalRoundRef.current));
        soundFX.playWordHit('UNCOMMON');
        showToast(
          `${data.nickname || 'Viewer'} sent ${count}× ${data.giftName || 'Gift'}! ${
            hintWord ? `Hint revealed: "${hintWord.toUpperCase()}"` : 'Hint unlocked!'
          }`,
          'gold'
        );
      } else if (!internalRoundRef.current) {
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
      detachBridge();
      socket.disconnect();
    };
  }, [recordActivity, showToast, isOverlay, isSoloRoute]);

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
        if (topPlayerScore > 0) {
          saveUnifiedLeaderboardScore({
            gameId: 'wikicon',
            score: topPlayerScore,
            metricLabel: `${topPlayerScore.toLocaleString()} pts`,
          }).catch(() => {});
        }
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
    setActiveNav((prev) => (prev === 'HOME' || prev === 'DAILY' ? 'ONLINE' : prev));
    if (!internalRoundRef.current || internalRoundRef.current.isDaily) {
      createNewWikiconRound({
        mode: internalRoundRef.current?.mode || 'WIKICONTEXTO',
        isDaily: false,
      })
        .then((fresh) => {
          internalRoundRef.current = fresh;
          setRound(serializeWikiconRound(fresh));
        })
        .catch(() => {});
    }
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
  const startModeRound = useCallback(
    async (
      targetNav: GameMode,
      opts: {
        mode: 'WIKICONTEXTO' | 'WIKIREC_GRID' | 'WIKIWORD_QUOTE';
        isDaily?: boolean;
        dailyDate?: string;
        customTitle?: string;
      }
    ) => {
      if (!isOverlay && !isSoloRoute && internalRoundRef.current) {
        const allowed = tryConsumeOrCheckNextRound('wikicon', internalRoundRef.current.roundId);
        if (!allowed) return;
      }
      recordActivity();
      setFeedbackToast(null);
      setAutoNextCountdown(null);
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
    },
    [isOverlay, isSoloRoute, recordActivity, showToast]
  );

  // Count solved interactive rounds toward the 3/day free limit (unlimited for key holders)
  useEffect(() => {
    if (isOverlay || isSoloRoute) return;
    if (round?.solved && round.roundId) {
      recordInteractiveRoundCompleted('wikicon', round.roundId);
    }
  }, [isOverlay, isSoloRoute, round?.solved, round?.roundId]);

  // Automatic 15-second progression to the next round when a round ends and Auto is enabled
  useEffect(() => {
    if (isOverlay) return;
    if (!round?.solved || !isAutoNextRound) {
      setAutoNextCountdown(null);
      return;
    }

    let remaining = 15;
    setAutoNextCountdown(remaining);
    const currentRoundMode = round.mode;
    const defaultModeNav: GameMode = isSoloRoute ? 'SOLO' : 'ONLINE';
    const nextNav: GameMode = activeNav === 'DAILY' ? defaultModeNav : activeNav;

    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        setAutoNextCountdown(null);
        void startModeRound(nextNav, {
          mode: currentRoundMode,
          isDaily: false,
        });
      } else {
        setAutoNextCountdown(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [round?.solved, round?.roundId, round?.mode, activeNav, isAutoNextRound, isOverlay, isSoloRoute, startModeRound]);

  // Submit a word guess (from input bar or 8-connected KeycapGrid swipe)
  const submitWordGuess = async (rawWord: string) => {
    recordActivity();
    const clean = rawWord.trim();
    if (!clean) return;
    setGuessInput('');

    if (internalRoundRef.current) {
      if (internalRoundRef.current.solved) {
        showToast('Round complete! Start Next Round to keep guessing.', 'muted');
        return;
      }
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

      if (isSoloRoute) {
        const nextSnap = serializeWikiconRound(internalRoundRef.current);
        const topScore =
          nextSnap.leaderboard && nextSnap.leaderboard.length > 0
            ? Math.max(...nextSnap.leaderboard.map((p) => p.score || 0))
            : 0;
        if (topScore > 0) {
          saveUnifiedLeaderboardScore({
            gameId: 'wikicon',
            score: topScore,
            metricLabel: `${topScore.toLocaleString()} pts`,
          }).catch(() => {});
        }
      } else {
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
    if (internalRoundRef.current?.solved) return;
    if (internalRoundRef.current) {
      const hintWord = revealWikiconHint(internalRoundRef.current);
      if (hintWord) {
        soundFX.playWordHit('UNCOMMON');
        setRound(serializeWikiconRound(internalRoundRef.current));
        showToast(`Hint revealed word: "${hintWord.toUpperCase()}"`, 'gold');
      }
    }
  };

  const handleRevealRound = async () => {
    recordActivity();
    if (internalRoundRef.current) {
      revealEntireWikiconRound(internalRoundRef.current);
      setRound(serializeWikiconRound(internalRoundRef.current));
      soundFX.playVictoryFanfare();
      showToast(`Article revealed: "${internalRoundRef.current.articleTitle}"`, 'gold');
    }
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
    if (rank <= 400) return 48;
    if (rank <= 1200) return 36;
    return 275;
  };

  const paddedRankCards: (RankCard | null)[] = Array.from({ length: 6 }, (_, i) =>
    round && round.topRankCards[i] ? round.topRankCards[i] : null
  );

  const sortedLeaderboard = useMemo(() => {
    return [...(round?.leaderboard || [])]
      .filter((p) => (Number(p.score) || 0) > 0)
      .sort(
        (a, b) =>
          (Number(b.score) || 0) - (Number(a.score) || 0) ||
          (b.titleWordsFound || 0) - (a.titleWordsFound || 0) ||
          (b.wordsFound || 0) - (a.wordsFound || 0) ||
          (a.bestRank || 9999) - (b.bestRank || 9999) ||
          (a.displayName || '').localeCompare(b.displayName || '')
      );
  }, [round?.leaderboard]);

  const goldPlayer =
    round?.solved && round.topPlayer
      ? round.topPlayer
      : sortedLeaderboard[0] || null;
  const remainingPodiumPlayers = useMemo(() => {
    if (!goldPlayer) return sortedLeaderboard;
    return sortedLeaderboard.filter((p) => p.id !== goldPlayer.id);
  }, [sortedLeaderboard, goldPlayer]);
  const silverPlayer = remainingPodiumPlayers[0] || null;
  const bronzePlayer = remainingPodiumPlayers[1] || null;

  const renderPlayerAvatar = (
    avatarUrlOrInitials: string | undefined,
    displayName: string,
    sizeClasses: string,
    borderClasses: string
  ) => {
    const cleanName = (displayName || 'Player').replace(/^@+/, '');
    const fallbackUrl = `https://i.pravatar.cc/150?u=${encodeURIComponent(cleanName)}`;
    const userAvatar = getUserProfileAvatarUrl();
    const src =
      avatarUrlOrInitials &&
      (avatarUrlOrInitials.startsWith('http') ||
        avatarUrlOrInitials.startsWith('/') ||
        avatarUrlOrInitials.startsWith('data:image/'))
        ? avatarUrlOrInitials
        : userAvatar || fallbackUrl;
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
        className={`${sizeClasses} rounded-full object-cover bg-[#2c0938] ${borderClasses}`}
      />
    );
  };

  const syncedSnapshot = useMemo(
    () =>
      !isOverlay && !isSoloRoute && round
        ? {
            round,
            activeNav,
            showGridInHybrid,
            showLengthsOnBlocks,
            feedbackToast,
            isManuscriptAutoScroll,
            isLightMode,
            isAutoNextRound,
            autoNextCountdown,
          }
        : null,
    [
      isOverlay,
      isSoloRoute,
      round,
      activeNav,
      showGridInHybrid,
      showLengthsOnBlocks,
      feedbackToast,
      isManuscriptAutoScroll,
      isLightMode,
      isAutoNextRound,
      autoNextCountdown,
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
    isAutoNextRound?: boolean;
    autoNextCountdown?: number | null;
  }>({
    gameId: 'wikicon',
    streamer: isOverlay
      ? overlayStreamer || undefined
      : connectedUsername || authenticatedStreamer || undefined,
    isOverlay,
    localState: syncedSnapshot,
    onSyncedState: useCallback((remote) => {
      if (!remote || !remote.round) return;
      hasReceivedHostSyncRef.current = true;
      internalRoundRef.current = null;
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
      if (typeof remote.isAutoNextRound === 'boolean') {
        setIsAutoNextRound(remote.isAutoNextRound);
      }
      setAutoNextCountdown(
        typeof remote.autoNextCountdown === 'number' ? remote.autoNextCountdown : null
      );
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
      className={`wikicon-root relative z-10 ${
        isOverlay
          ? `min-h-screen justify-center py-3 ${overlayBg === 'transparent' ? 'bg-transparent' : ''}`
          : 'min-h-screen'
      } flex flex-col items-center transition-colors duration-200 ${
        isOverlay && overlayBg === 'transparent'
          ? isLightMode
            ? 'text-[#2d0938]'
            : 'text-[#faf5ff]'
          : isLightMode
          ? 'wk-canvas-light text-[#2d0938]'
          : 'wk-canvas-dark text-[#faf5ff]'
      }`}
    >
      {/* ── Horizontal Flex Wrapper: Live Chat Box on Left (Only when Authorised User Logged In) + 50px Gap + 490px Game Shell ── */}
      <div className="w-full flex flex-col lg:flex-row items-center lg:items-start justify-center gap-[50px] px-2 sm:px-4">
        {/* Live Chat Stream Box to the left of the game with 50px gap — hidden in LIVE Studio overlay & Solo Games mode */}
        {!isOverlay && !isSoloRoute && (authenticatedStreamer || connectedUsername) && (
          <div className="pt-4">
            <LiveChatBox
              messages={chatMessages}
              connectedUsername={connectedUsername || authenticatedStreamer || ''}
              isLightMode={isLightMode}
            />
          </div>
        )}

        {/* ── Centered 490px (or 520px 20:9 overlay) App Shell ── */}
        <div className={`w-full ${isOverlay ? 'max-w-[520px]' : 'max-w-[490px] min-h-screen'} flex flex-col shrink-0`}>
          {/* ── Top Navigation Bar (hidden in LIVE Studio overlay) ── */}
          {!isOverlay && (
          <header
            className={`w-full flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b ${
              isLightMode
                ? 'bg-white border-[#c084fc]'
                : 'bg-[#16041c] border-[#6b21a8]'
            } sticky top-0 z-30`}
          >
            {/* Zone 1: Brand Wordmark (Links back to Home Screen /) + Back Link */}
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to={isSoloRoute ? '/solo-games' : '/interactive-games'}
                className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 shrink-0 ${
                  isLightMode
                    ? 'bg-[#f3edfc] hover:bg-[#e9d5ff] text-[#4a1259] border-[#c084fc]'
                    : 'bg-[#2c0938] hover:bg-[#4a1259] text-[#d8b4fe] hover:text-white border-[#6b21a8]'
                }`}
                title={isSoloRoute ? 'Back to Solo Games' : 'Back to Interactive Games'}
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
                  className="w-5 h-5 rounded object-cover border border-[#facc15]/60"
                />
                <span>
                  Wiki<span className={isLightMode ? 'text-[#7e22ce]' : 'text-[#facc15]'}>Contexto</span>
                </span>
              </Link>
            </div>

            {/* Zone 2: Navigation Links (Home Hub, WikiContexto, Past Dailies, Admin) */}
            <nav className="flex items-center gap-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveNav('HOME')}
                className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeNav === 'HOME'
                    ? `${isLightMode ? 'text-[#7e22ce]' : 'text-[#facc15]'} underline underline-offset-8 decoration-2`
                    : isLightMode
                    ? 'text-[#4a1259] hover:text-[#7e22ce]'
                    : 'text-[#e9d5ff] hover:text-[#facc15]'
                }`}
              >
                Home Hub
              </button>
              <button
                type="button"
                onClick={() => {
                  const defaultNav: GameMode = isSoloRoute ? 'SOLO' : 'ONLINE';
                  if (round && !round.isDaily) {
                    setActiveNav((prev) =>
                      prev === 'SOLO' ||
                      (!isSoloRoute && prev === 'ONLINE') ||
                      prev === 'WIKIREC_GRID' ||
                      prev === 'WIKIWORD_QUOTE'
                        ? prev
                        : defaultNav
                    );
                  } else {
                    startModeRound(defaultNav, {
                      mode: 'WIKICONTEXTO',
                      isDaily: false,
                    });
                  }
                }}
                className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeNav === 'DAILY' ||
                  activeNav === 'SOLO' ||
                  activeNav === 'ONLINE' ||
                  activeNav === 'WIKIREC_GRID' ||
                  activeNav === 'WIKIWORD_QUOTE'
                    ? `${isLightMode ? 'text-[#7e22ce]' : 'text-[#facc15]'} underline underline-offset-8 decoration-2`
                    : isLightMode
                    ? 'text-[#4a1259] hover:text-[#7e22ce]'
                    : 'text-[#e9d5ff] hover:text-[#facc15]'
                }`}
              >
                WikiContexto
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('ARCHIVE')}
                className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeNav === 'ARCHIVE'
                    ? `${isLightMode ? 'text-[#7e22ce]' : 'text-[#facc15]'} underline underline-offset-8 decoration-2`
                    : isLightMode
                    ? 'text-[#4a1259] hover:text-[#7e22ce]'
                    : 'text-[#e9d5ff] hover:text-[#facc15]'
                }`}
              >
                Past Dailies
              </button>
              {!isSoloRoute && (
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(true)}
                  className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isLightMode
                      ? 'text-[#4a1259] hover:text-[#b45309]'
                      : 'text-[#e9d5ff] hover:text-[#facc15]'
                  }`}
                >
                  Admin
                </button>
              )}
            </nav>

            {/* Zone 3: Daily Streak + LIVE Overlay / TikTok Live or Solo Account Indicator */}
            <div className="flex items-center gap-1.5 shrink-0">
              <DailyStreakBadge
                streak={dailyStreak.streak}
                solvedToday={dailyStreak.solvedToday}
                variant={isLightMode ? 'light' : 'gold'}
                compact
              />
              {isSoloRoute ? (
                <LoggedInIndicator />
              ) : (
                <>
                  <LiveOverlayButton
                    gameTitle="WikiContexto"
                    gameSlug="wikicon"
                    streamerHandle={connectedUsername || authenticatedStreamer}
                    recommendedSize="540 × 1200 or 1080 × 2400 (20:9)"
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
                        ? 'bg-[#4ade80] text-[#2d0938] shadow-[0_0_16px_rgba(74,222,128,0.35)]'
                        : authenticatedStreamer
                        ? 'bg-[#fde047] text-[#2d0938]'
                        : 'bg-[#facc15] hover:bg-[#fde047] text-[#2d0938] shadow-[0_0_14px_rgba(250,204,21,0.28)]'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    {tiktokConnState === 'connected' && connectedUsername
                      ? `@${connectedUsername}`
                      : authenticatedStreamer
                      ? authenticatedStreamer
                      : 'TikTok Live'}
                  </button>
                </>
              )}
            </div>
          </header>
          )}

          {/* ── VIEW 1: WIKICONTEXTO 6-BUBBLE HOME PORTAL (490px width) ── */}
          {!isOverlay && effectiveNav === 'HOME' && (
            <main className="flex-1 w-full px-4 py-6 flex flex-col justify-between">
              {/* Suite Top Subbar */}
              <div className={`flex items-center justify-between text-[11px] gap-2 ${isLightMode ? 'text-[#6b21a8]' : 'text-[#d8b4fe]'}`}>
                <button
                  type="button"
                  onClick={() => setActiveNav('TYCOON_HUB')}
                  className={`flex items-center gap-1.5 font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    isLightMode
                      ? 'text-[#2d0938] hover:text-[#7e22ce]'
                      : 'text-[#faf5ff] hover:text-[#facc15]'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5 text-[#facc15]" />
                  <span>Word Tycoon · {Math.floor(profile.coins).toLocaleString()} Coins</span>
                </button>
                <span className="truncate font-mono tabular-nums">
                  {profile.displayName} · ELO {profile.elo}
                </span>
              </div>

              {/* Center Wordmark & Tagline */}
              <section className="my-6 text-center">
                <div className="inline-flex items-center justify-center gap-2.5 mb-1.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#facc15] to-[#a855f7] flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.38)] text-[#2d0938] font-black text-xl">
                    W
                  </div>
                  <h1
                    className="text-3xl font-black tracking-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    Wiki<span className={isLightMode ? 'text-[#7e22ce]' : 'text-[#facc15]'}>Contexto</span>{' '}
                    <span className={`text-base font-bold ${isLightMode ? 'text-[#a16207]' : 'text-[#fde047]'}`}>× Wikirec</span>
                  </h1>
                </div>
                <p className={`text-xs mt-1.5 leading-relaxed ${isLightMode ? 'text-[#6b21a8]' : 'text-[#d8b4fe]'}`}>
                  {isSoloRoute
                    ? 'One hidden Wikipedia article. Semantic rank cards, 8-connected arcade keycaps, daily puzzles, and word tycoon progression.'
                    : 'One hidden Wikipedia article. Semantic rank cards, 8-connected arcade keycaps, and live TikTok stream play.'}
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
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#360b42] to-[#16041c] border-2 border-[#a855f7]/80 hover:border-[#facc15] shadow-[0_0_20px_rgba(168,85,247,0.2)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#a855f7]/20 text-[#e9d5ff] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Compass className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-white whitespace-nowrap">
                    Solo
                  </span>
                  <span className="text-[11px] text-[#d8b4fe]">
                    Explore random articles
                  </span>
                </button>

                {/* Bubble 2: WikiWord Quote (in Solo mode) OR Online + TikTok Stream (in Interactive mode) */}
                {isSoloRoute ? (
                  <button
                    type="button"
                    onClick={() =>
                      startModeRound('WIKIWORD_QUOTE', {
                        mode: 'WIKIWORD_QUOTE',
                        isDaily: false,
                      })
                    }
                    className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#360b42] to-[#16041c] border-2 border-[#4ade80]/70 hover:border-[#4ade80] shadow-[0_0_20px_rgba(74,222,128,0.15)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#4ade80]/15 text-[#4ade80] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Quote className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-extrabold text-white whitespace-nowrap">
                      WikiWord 5×7
                    </span>
                    <span className="text-[11px] text-[#d8b4fe]">
                      Quote &amp; 5×7 keycaps
                    </span>
                  </button>
                ) : (
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
                    className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#360b42] to-[#16041c] border-2 border-[#4ade80]/70 hover:border-[#4ade80] shadow-[0_0_20px_rgba(74,222,128,0.15)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#4ade80]/15 text-[#4ade80] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Globe className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-extrabold text-white whitespace-nowrap">
                      Online &amp; TikTok
                    </span>
                    <span className="text-[11px] text-[#d8b4fe]">
                      Discover together live
                    </span>
                  </button>
                )}

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
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#4a1259] via-[#2c0938] to-[#16041c] border-2 border-[#facc15] shadow-[0_0_22px_rgba(250,204,21,0.22)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#facc15]/20 text-[#facc15] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-[#facc15] whitespace-nowrap">
                    Daily Puzzle
                  </span>
                  <span className="text-[11px] text-[#f3e8ff]">
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
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#3b0d47] to-[#16041c] border-2 border-[#c084fc] hover:border-[#facc15] shadow-[0_0_20px_rgba(192,132,252,0.2)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#facc15]/20 text-[#facc15] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Grid className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-white whitespace-nowrap">
                    Wikirec Grid
                  </span>
                  <span className="text-[11px] text-[#d8b4fe]">
                    7×7 Keycaps &amp; Pyramid
                  </span>
                </button>

                {/* Bubble 5: Previous Dailies Archive */}
                <button
                  type="button"
                  onClick={() => setActiveNav('ARCHIVE')}
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#360b42] to-[#16041c] border-2 border-[#7e22ce] hover:border-[#facc15] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#7e22ce]/30 text-[#d8b4fe] group-hover:text-[#facc15] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <History className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-white whitespace-nowrap">
                    Previous Dailies
                  </span>
                  <span className="text-[11px] text-[#d8b4fe]">
                    Revisit past puzzles
                  </span>
                </button>

                {/* Bubble 6: Profile & Cosmetics (Word Tycoon Hub) */}
                <button
                  type="button"
                  onClick={() => setActiveNav('TYCOON_HUB')}
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#4a1259] to-[#16041c] border-2 border-[#e879f9] hover:border-[#facc15] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#e879f9]/20 text-[#f0abfc] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-white whitespace-nowrap">
                    Profile &amp; Tycoon
                  </span>
                  <span className="text-[11px] text-[#d8b4fe]">
                    Cosmetics &amp; Empire
                  </span>
                </button>
              </nav>

              {/* Footer */}
              <footer className={`mt-6 pt-3.5 border-t flex items-center justify-between text-[11px] ${
                isLightMode ? 'border-[#d8b4fe] text-[#6b21a8]' : 'border-[#6b21a8]/40 text-[#d8b4fe]'
              }`}>
                <span>Pick a bubble. Follow your curiosity.</span>
                <button
                  type="button"
                  onClick={() =>
                    startModeRound('WIKIWORD_QUOTE', {
                      mode: 'WIKIWORD_QUOTE',
                      isDaily: false,
                    })
                  }
                  className={`transition-colors cursor-pointer whitespace-nowrap font-semibold ${
                    isLightMode ? 'hover:text-[#4a1259]' : 'hover:text-[#facc15]'
                  }`}
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
                <p className={`text-xs mt-1 ${isLightMode ? 'text-[#6b21a8]' : 'text-[#d8b4fe]'}`}>
                  Play any archived Wikipedia article in WikiContexto or Wikirec Keycap Grid Mode.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {archiveList.map((item) => {
                  const isDone = profile.completedDailies.includes(item.date);
                  return (
                    <div
                      key={item.date}
                      className="p-4 rounded-2xl bg-[#240630] border-2 border-[#7e22ce] flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-[#d8b4fe]">
                          <span className="font-mono tabular-nums">{item.date} · {item.difficulty}</span>
                          {isDone && (
                            <span className="text-[#4ade80] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Solved
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-extrabold text-white mt-0.5">
                          {item.category}
                        </h3>
                        <p className="text-[11px] text-[#d8b4fe] mt-0.5 font-mono tabular-nums">
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
                          className="flex-1 py-2 px-3 rounded-xl bg-[#facc15] hover:bg-[#fde047] text-[#2d0938] text-xs font-bold cursor-pointer whitespace-nowrap"
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
                          className="flex-1 py-2 px-3 rounded-xl bg-[#360b42] hover:bg-[#6b21a8] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
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

          {isOverlay && !round && (
            <main className="relative z-10 flex-1 w-full px-3.5 py-6">
              <div className="p-5 rounded-2xl bg-[#240630] border-2 border-[#7e22ce] text-center shadow-lg space-y-2 opacity-100">
                <div className="text-xs font-extrabold uppercase tracking-widest text-[#facc15]">
                  WikiContexto LIVE Overlay
                </div>
                <div className="text-sm font-bold text-white">
                  Waiting for Host Game Sync...
                </div>
              </div>
            </main>
          )}

          {/* ── VIEW 4: ACTIVE GAMEPLAY ARENA (490px Portrait Width) ── */}
          {(effectiveNav === 'DAILY' ||
            effectiveNav === 'SOLO' ||
            effectiveNav === 'ONLINE' ||
            effectiveNav === 'WIKIREC_GRID' ||
            effectiveNav === 'WIKIWORD_QUOTE') &&
            round && (
              <main key={`wk-arena-${round.roundId}`} className="relative z-10 flex-1 w-full px-3.5 py-2.5 space-y-2">
                {/* Compact Workspace Mode & Utility Toolbar (hidden in LIVE Studio overlay) */}
                {!isOverlay && (
                <div className="flex flex-col gap-1.5 p-1.5 rounded-xl bg-[#240630] border border-[#6b21a8]">
                  {/* Row 1: Mode Switcher Tabs */}
                  <div className={`grid ${isSoloRoute ? 'grid-cols-4' : 'grid-cols-5'} gap-1 p-0.5 rounded-lg bg-[#16041c]`}>
                    {!isSoloRoute && (
                      <button
                        type="button"
                        onClick={() =>
                          startModeRound('ONLINE', {
                            mode: 'WIKICONTEXTO',
                            isDaily: false,
                          })
                        }
                        className={`py-1 px-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate ${
                          activeNav === 'ONLINE'
                            ? 'bg-[#4ade80] text-[#2d0938]'
                            : 'text-[#d8b4fe] hover:text-white'
                        }`}
                      >
                        Online
                      </button>
                    )}
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
                          ? 'bg-[#facc15] text-[#2d0938]'
                          : 'text-[#d8b4fe] hover:text-white'
                      }`}
                    >
                      Solo
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
                      className={`py-1 px-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate ${
                        activeNav === 'DAILY'
                          ? 'bg-[#fde047] text-[#2d0938]'
                          : 'text-[#d8b4fe] hover:text-white'
                      }`}
                    >
                      Daily
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
                          ? 'bg-[#a855f7] text-white'
                          : 'text-[#d8b4fe] hover:text-white'
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
                          ? 'bg-[#4ade80] text-[#2d0938]'
                          : 'text-[#d8b4fe] hover:text-white'
                      }`}
                    >
                      <Quote className="w-3 h-3 shrink-0" /> 5×7 Quote
                    </button>
                  </div>

                  {/* Row 2: Game Utilities */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          startModeRound(
                            activeNav === 'DAILY' ? (isSoloRoute ? 'SOLO' : 'ONLINE') : activeNav,
                            {
                              mode: round.mode,
                              isDaily: false,
                            }
                          )
                        }
                        title="Start a new random Wikipedia article round"
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#2c0938] hover:bg-[#360b42] border border-[#4ade80]/60 text-[#4ade80] flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="w-3 h-3" /> New Round
                      </button>
                      <button
                        type="button"
                        onClick={toggleAutoNextRound}
                        title="When enabled, automatically waits 15 seconds after a round ends and starts the next round"
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors ${
                          isAutoNextRound
                            ? 'bg-[#4ade80]/20 border-[#4ade80] text-[#4ade80]'
                            : 'bg-[#2c0938] border-[#6b21a8] text-[#d8b4fe] hover:text-white'
                        }`}
                      >
                        {isAutoNextRound ? (
                          <Play className="w-3 h-3 fill-current" />
                        ) : (
                          <Pause className="w-3 h-3" />
                        )}
                        {round.solved && isAutoNextRound && autoNextCountdown !== null
                          ? `Auto (${autoNextCountdown}s)`
                          : `Auto 15s: ${isAutoNextRound ? 'ON' : 'OFF'}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowGridInHybrid((v) => !v)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                          showGridInHybrid
                            ? 'bg-[#facc15]/20 border-[#facc15] text-[#facc15]'
                            : 'bg-[#2c0938] border-[#6b21a8] text-[#f3e8ff]'
                        }`}
                      >
                        {showGridInHybrid ? 'Hide Grid' : 'Show Grid'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLengthsOnBlocks((v) => !v)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                          showLengthsOnBlocks
                            ? 'bg-[#c084fc]/20 border-[#c084fc] text-[#e9d5ff]'
                            : 'bg-[#2c0938] border-[#6b21a8] text-[#f3e8ff]'
                        }`}
                      >
                        {showLengthsOnBlocks ? 'Hide Lengths' : 'Lengths'}
                      </button>
                      <button
                        type="button"
                        onClick={handleRequestHint}
                        disabled={round.solved}
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#2c0938] hover:bg-[#360b42] border border-[#facc15]/60 text-[#facc15] flex items-center gap-1 cursor-pointer whitespace-nowrap disabled:opacity-40"
                      >
                        <Lightbulb className="w-3 h-3" /> Hint
                      </button>
                      <button
                        type="button"
                        onClick={handleRevealRound}
                        disabled={round.solved}
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#2c0938] hover:bg-[#360b42] border border-[#6b21a8] text-[#d8b4fe] hover:text-white flex items-center gap-1 cursor-pointer whitespace-nowrap disabled:opacity-40"
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
                        className="p-1 rounded-md bg-[#2c0938] border border-[#6b21a8] text-[#f3e8ff] hover:text-white cursor-pointer"
                      >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsLightMode((v) => !v)}
                        aria-label="Toggle Light/Dark Theme"
                        className="p-1 rounded-md bg-[#2c0938] border border-[#6b21a8] text-[#f3e8ff] hover:text-white cursor-pointer"
                      >
                        {isLightMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
                )}

                {/* ── Round Complete Overlay Card (Shows Top Player Profile Picture, Display Name, and Score + Current Article Info) ── */}
                {round.solved && (
                  <div className="p-4 rounded-2xl bg-[#240630] bg-gradient-to-r from-[#2c0938] via-[#240630] to-[#3b0d47] border-2 border-[#4ade80] shadow-[0_0_24px_rgba(74,222,128,0.28)] space-y-3 opacity-100">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold text-[#4ade80]">
                          ROUND COMPLETE · {round.articleCategory}
                        </div>
                        <h2 className="text-xl font-black text-white">
                          {round.articleTitle}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!isOverlay ? (
                          <>
                            <button
                              type="button"
                              onClick={toggleAutoNextRound}
                              title="Automatically advance to the next round 15 seconds after round completion"
                              className={`px-3 py-2 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                                isAutoNextRound
                                  ? 'bg-[#16041c] border-[#4ade80] text-[#4ade80] hover:bg-[#2c0938]'
                                  : 'bg-[#16041c] border-[#6b21a8] text-[#d8b4fe] hover:text-white'
                              }`}
                            >
                              {isAutoNextRound ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                              <span className="font-mono tabular-nums">
                                {isAutoNextRound
                                  ? `Auto: ${autoNextCountdown ?? 15}s`
                                  : 'Auto 15s: OFF'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                startModeRound(
                                  activeNav === 'DAILY' ? (isSoloRoute ? 'SOLO' : 'ONLINE') : activeNav,
                                  {
                                    mode: round.mode,
                                    isDaily: false,
                                  }
                                )
                              }
                              className="px-3.5 py-2 rounded-xl bg-[#4ade80] hover:bg-[#86efac] text-[#2d0938] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Next Round
                            </button>
                          </>
                        ) : (
                          isAutoNextRound &&
                          autoNextCountdown !== null && (
                            <div className="px-3 py-1.5 rounded-xl bg-[#16041c] border border-[#4ade80] text-[#4ade80] text-xs font-extrabold font-mono tabular-nums whitespace-nowrap">
                              Next Round in {autoNextCountdown}s
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {round.articleSummaryQuote && (
                      <p className="text-xs text-[#f3e8ff]">
                        {round.articleSummaryQuote}
                      </p>
                    )}

                    {/* Top Player MVP Highlight on Round Complete Overlay */}
                    <div className="p-3 rounded-xl bg-[#16041c] border border-[#facc15] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <Crown className="w-4 h-4 text-[#facc15] absolute -top-2.5 -left-1 -rotate-12" />
                          {renderPlayerAvatar(
                            goldPlayer?.avatar,
                            goldPlayer?.displayName || profile.displayName,
                            'w-11 h-11 text-xs text-[#facc15]',
                            'border-2 border-[#facc15]'
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-[#facc15] flex items-center gap-1">
                            <Trophy className="w-3 h-3" /> TOP PLAYER OF THE ROUND
                          </div>
                          <div className="text-sm font-extrabold text-white truncate">
                            {goldPlayer ? goldPlayer.displayName : profile.displayName}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-[#d8b4fe]">Top Score</div>
                        <div className="text-base font-extrabold font-mono tabular-nums text-[#4ade80]">
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
                      <div className="flex-1 p-2 rounded-xl bg-[#240630] bg-gradient-to-br from-[#360b42] to-[#16041c] border-2 border-[#7e22ce] shadow-[inset_0_1px_7px_rgba(250,204,21,0.16)] flex flex-col justify-between opacity-100">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-bold tracking-wider text-[#d8b4fe]">
                            TITLE
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-[#f3e8ff]">
                            <span className="flex items-center gap-0.5">
                              <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-b from-[#fde047] to-[#eab308] text-[#2d0938] font-black text-[9px] inline-flex items-center justify-center">
                                G
                              </span>
                              {round.guessCount}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-b from-[#fde047] to-[#eab308] text-[#2d0938] font-black text-[9px] inline-flex items-center justify-center">
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
                                  ? 'bg-[#4ade80] bg-gradient-to-br from-[#86efac] to-[#22c55e] text-[#052e16] shadow-[0_0_10px_rgba(74,222,128,0.3)]'
                                  : 'bg-[#facc15] bg-gradient-to-br from-[#fef08a] to-[#facc15] text-[#2d0938] border border-[#fef9c3]'
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
                      <div className="p-1.5 rounded-xl bg-[#240630] bg-gradient-to-br from-[#360b42] to-[#16041c] border-2 border-[#7e22ce] flex items-end justify-center gap-1 min-h-[86px] opacity-100">
                        {/* Silver #2 */}
                        <div className="relative flex-1 min-w-0 h-[66px] rounded-lg border border-[#e2e8f0] bg-[#360b42] bg-gradient-to-br from-[#4a1259] to-[#240630] p-1 flex flex-col items-center justify-between text-center">
                          <span className="absolute -top-1.5 left-1 px-1 rounded bg-[#e2e8f0] text-[#15041c] text-[8px] font-black leading-tight">
                            2nd
                          </span>
                          {silverPlayer ? (
                            renderPlayerAvatar(
                              silverPlayer.avatar,
                              silverPlayer.displayName,
                              'w-6 h-6 text-[9px] text-white mt-0.5',
                              'border border-[#e2e8f0]'
                            )
                          ) : (
                            <div className="w-6 h-6 mt-0.5 rounded-full border border-[#e2e8f0] bg-[#240630] flex items-center justify-center text-[9px] font-bold text-[#e2e8f0]">
                              2
                            </div>
                          )}
                          <div className="text-[9px] font-bold text-[#f3e8ff] truncate w-full leading-tight">
                            {silverPlayer ? silverPlayer.displayName : '—'}
                          </div>
                          <div className="text-[9px] font-mono tabular-nums text-white font-bold leading-tight">
                            {silverPlayer ? silverPlayer.score.toLocaleString() : '0'}
                          </div>
                        </div>

                        {/* Gold #1 */}
                        <div className="relative flex-1 min-w-0 h-[76px] rounded-lg border-2 border-[#facc15] bg-[#4a1259] bg-gradient-to-br from-[#7e22ce] to-[#2d0938] shadow-[0_0_12px_rgba(250,204,21,0.3)] p-1 flex flex-col items-center justify-between text-center">
                          <Crown className="w-3.5 h-3.5 text-[#facc15] absolute -top-2 -left-0.5 -rotate-12" />
                          <span className="absolute -top-1.5 right-1 px-1 rounded bg-[#facc15] text-[#2d0938] text-[8px] font-black leading-tight">
                            1st
                          </span>
                          {goldPlayer ? (
                            renderPlayerAvatar(
                              goldPlayer.avatar,
                              goldPlayer.displayName,
                              'w-6 h-6 text-[10px] text-[#facc15] mt-0.5',
                              'border border-[#facc15]'
                            )
                          ) : (
                            <div className="w-6 h-6 mt-0.5 rounded-full border border-[#facc15] bg-[#2d0938] flex items-center justify-center text-[9px] font-extrabold text-[#facc15]">
                              1
                            </div>
                          )}
                          <div className="text-[9px] font-extrabold text-[#facc15] truncate w-full leading-tight">
                            {goldPlayer ? goldPlayer.displayName : '—'}
                          </div>
                          <div className="text-[9px] font-mono tabular-nums text-white font-bold leading-tight">
                            {goldPlayer ? goldPlayer.score.toLocaleString() : '0'}
                          </div>
                        </div>

                        {/* Bronze #3 */}
                        <div className="relative flex-1 min-w-0 h-[60px] rounded-lg border border-[#d97706] bg-[#240630] bg-gradient-to-br from-[#3b0d47] to-[#16041c] p-1 flex flex-col items-center justify-between text-center">
                          <span className="absolute -top-1.5 left-1 px-1 rounded bg-[#d97706] text-[#15041c] text-[8px] font-black leading-tight">
                            3rd
                          </span>
                          {bronzePlayer ? (
                            renderPlayerAvatar(
                              bronzePlayer.avatar,
                              bronzePlayer.displayName,
                              'w-5 h-5 text-[9px] text-white mt-0.5',
                              'border border-[#d97706]'
                            )
                          ) : (
                            <div className="w-5 h-5 mt-0.5 rounded-full border border-[#d97706] bg-[#16041c] flex items-center justify-center text-[8px] font-bold text-[#fbbf24]">
                              3
                            </div>
                          )}
                          <div className="text-[9px] font-bold text-[#f3e8ff] truncate w-full leading-tight">
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
                              className="rounded-lg bg-[#16041c] border border-[#6b21a8] px-2.5 py-0.5 flex items-center justify-between text-[10px] text-[#d8b4fe] opacity-100"
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
                            className="relative rounded-lg bg-[#16041c] overflow-hidden flex items-center justify-between px-2 py-0.5 opacity-100"
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
                                {idx === 0 && <span className="text-[#facc15]">♛</span>}#{card.rank}
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
                                'border border-[#facc15]'
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* ── Full-Width Word Announce Banner + Feedback Toast ── */}
                <div className="min-h-[34px] rounded-xl border-2 border-[#facc15] bg-[#16041c] bg-gradient-to-r from-[#3b0d47] via-[#16041c] to-[#2c0938] shadow-[0_0_12px_rgba(250,204,21,0.22)] px-2.5 py-1 flex items-center justify-between gap-2 opacity-100">
                  {feedbackToast ? (
                    <div className="flex items-center justify-between w-full text-[11px] font-bold gap-2">
                      <span
                        className={`truncate ${
                          feedbackToast.tone === 'gold'
                            ? 'text-[#facc15]'
                            : feedbackToast.tone === 'green'
                            ? 'text-[#4ade80]'
                            : feedbackToast.tone === 'cyan'
                            ? 'text-[#e879f9]'
                            : 'text-[#f3e8ff]'
                        }`}
                      >
                        {feedbackToast.text}
                      </span>
                      <span className="text-[10px] text-[#d8b4fe] font-mono tabular-nums shrink-0">
                        #{round.guessCount}
                      </span>
                    </div>
                  ) : round.lastAnnouncement ? (
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {renderPlayerAvatar(
                          round.lastAnnouncement.avatar,
                          round.lastAnnouncement.displayName,
                          'w-5 h-5 text-[9px] text-[#facc15] shrink-0',
                          'border border-[#facc15]'
                        )}
                        <div className="text-[11px] text-[#f3e8ff] truncate">
                          <strong className="text-white">{round.lastAnnouncement.displayName}</strong>{' '}
                          found <strong className="text-[#facc15]">{round.lastAnnouncement.word}</strong>
                        </div>
                      </div>
                      <div className="text-[11px] font-extrabold font-mono tabular-nums text-[#4ade80] shrink-0">
                        +{round.lastAnnouncement.pointsEarned.toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full text-[11px] text-[#f3e8ff]">
                      <span className="truncate">
                        Guess words below to uncover the hidden Wikipedia article!
                      </span>
                      <span className="font-mono tabular-nums text-[#facc15] shrink-0">
                        +50k Title
                      </span>
                    </div>
                  )}
                </div>

                {/* ── Scrolling Marquee for Guessed Words ── */}
                {round.recentTicker.length > 0 && (
                  <div
                    className={`wk-marquee-wrap relative flex items-center overflow-hidden py-1.5 px-2.5 rounded-xl border opacity-100 ${
                      isLightMode
                        ? 'bg-white border-[#c084fc] text-[#2d0938]'
                        : 'bg-[#240630] border-[#6b21a8] text-[#f3e8ff]'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold shrink-0 pr-2 mr-2 border-r z-10 ${
                        isLightMode
                          ? 'bg-white text-[#6b21a8] border-[#c084fc]'
                          : 'bg-[#240630] text-[#d8b4fe] border-[#6b21a8]'
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
                                <strong className={isLightMode ? 'text-[#2d0938]' : 'text-white'}>
                                  {item.word}
                                </strong>{' '}
                                <span className={isLightMode ? 'text-[#7e22ce]' : 'text-[#facc15]'}>
                                  #{item.rank}
                                </span>
                                <span className="ml-2 text-[#6b21a8]">·</span>
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
                    <section className="p-3 rounded-2xl bg-[#240630] bg-gradient-to-br from-[#360b42] to-[#16041c] border-2 border-[#7e22ce] opacity-100">
                      <KeycapGrid
                        key={`wk-kc-${round.roundId}`}
                        gridBoard={round.gridBoard}
                        onWordSubmit={submitWordGuess}
                        isLightMode={isLightMode}
                      />
                    </section>
                  )}

                {/* ── Redacted Wikipedia Article Body Panel (Auto-Scrolling Viewport) ── */}
                <section
                  key={`wk-ms-${round.roundId}`}
                  className={`wk-manuscript-box p-3.5 rounded-2xl border-2 border-[#7e22ce] shadow-[inset_0_1px_7px_rgba(250,204,21,0.15)] space-y-2.5 opacity-100 ${
                    isLightMode
                      ? 'bg-white text-[#2d0938]'
                      : 'bg-[#240630] bg-gradient-to-br from-[#360b42] to-[#16041c] text-[#faf5ff]'
                  }`}
                  style={{ fontFamily: 'var(--font-article)' }}
                >
                  <div className={`flex items-center justify-between border-b pb-1.5 text-[11px] ${
                    isLightMode ? 'border-[#d8b4fe] text-[#6b21a8]' : 'border-[#6b21a8] text-[#d8b4fe]'
                  }`}>
                    <span>Wikipedia Redacted Manuscript</span>
                    <div className="flex items-center gap-2.5">
                      {!isOverlay && (
                      <button
                        type="button"
                        onClick={() => setIsManuscriptAutoScroll((v) => !v)}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          isLightMode
                            ? 'hover:bg-[#f3edfc] text-[#6b21a8]'
                            : 'hover:bg-[#360b42] text-[#d8b4fe]'
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
                    className={`wk-manuscript-scroll ${
                      isOverlay ? 'max-h-[400px]' : 'max-h-[245px]'
                    } overflow-y-auto overscroll-contain pr-1.5 space-y-3 leading-7 text-[15px]`}
                  >
                    {round.paragraphs.map((para, pIdx) => (
                      <p key={pIdx} className="break-words">
                        {para.map((tok) => {
                          if (tok.type === 'space') {
                            return <span key={tok.id}>{decodeHtmlEntities(tok.text)}</span>;
                          }
                          if (tok.revealed) {
                            return (
                              <span
                                key={tok.id}
                                className={`font-semibold transition-colors ${
                                  tok.isStop
                                    ? isLightMode
                                      ? 'text-[#4a1259]'
                                      : 'text-[#e9d5ff]'
                                    : isLightMode
                                    ? 'text-[#15803d] font-bold wk-word-reveal'
                                    : 'text-[#4ade80] font-bold wk-word-reveal'
                                }`}
                              >
                                {decodeHtmlEntities(tok.text)}
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
                                  ? 'bg-[#f59e0b] text-[#2d0938] border border-[#fde047]'
                                  : tok.isTitleWord
                                  ? 'bg-[#facc15] text-[#2d0938] border border-[#fef08a]'
                                  : isLightMode
                                  ? 'bg-[#e9d5ff] text-[#4a1259] hover:bg-[#d8b4fe]'
                                  : 'bg-[#3b0d47] text-[#e9d5ff] hover:bg-[#4a1259] border border-[#6b21a8]'
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
                  className={`flex items-center gap-2 p-1.5 rounded-2xl border-2 shadow-[0_0_16px_rgba(168,85,247,0.2)] ${
                    isLightMode
                      ? 'bg-white border-[#c084fc]'
                      : 'bg-[#240630] border-[#7e22ce]'
                  }`}
                >
                  <input
                    type="text"
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    disabled={round.solved}
                    placeholder={
                      round.solved
                        ? 'Round complete — start Next Round to keep guessing...'
                        : 'Guess a word...'
                    }
                    className={`flex-1 min-w-0 px-3.5 py-2 rounded-xl border text-sm font-bold focus:outline-none focus:border-[#facc15] disabled:opacity-60 ${
                      isLightMode
                        ? 'bg-[#faf7fc] border-[#c084fc] text-[#2d0938] placeholder-[#6b21a8]/60'
                        : 'bg-[#16041c] border-[#6b21a8] text-white placeholder-[#d8b4fe]/60'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={round.solved}
                    className="px-4 py-2 rounded-xl bg-gradient-to-b from-[#fde047] to-[#facc15] hover:from-[#fef08a] hover:to-[#fde047] text-[#2d0938] font-extrabold text-xs border border-[#fef08a] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" /> Guess
                  </button>
                </form>
                )}
              </main>
            )}
        </div>
      </div>

      {!isOverlay && !isSoloRoute && (
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
          const payload = {
            ...data,
            id: `sim_chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            gameId: 'wikicon',
          };
          processChatEventRef.current?.(payload);
          emitResilientEvent(socketRef.current, 'chat-message', payload);
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
