import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import {
  ArrowLeft,
  Award,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  HelpCircle,
  Lightbulb,
  LogIn,
  Medal,
  Moon,
  Play,
  Radio,
  RefreshCw,
  Send,
  Shuffle,
  Sparkles,
  Sun,
  Trophy,
  Type,
  User as UserIcon,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  X,
  Zap,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  creditInteractiveScoreByTikTokHandle,
  getCleanDisplayName,
  saveUnifiedLeaderboardScore,
  useUnifiedAuth,
} from '@/lib/unified-game-auth';
import {
  getLondonTodayDateStr,
  recordDailyPuzzleSolved,
  useDailyStreak,
} from '@/lib/daily-streak';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';
import { LiveOverlayButton } from '@/components/interactive-games/live-overlay-button';
import { useOverlayConfig, useOverlaySync } from '@/lib/live-overlay';
import {
  attachResilientChatListeners,
  createEventDeduplicator,
  forceReconnectBridge,
  triggerResilientConnect,
} from '@/lib/live-chat-bridge';
import { triggerVictoryConfetti } from '@/lib/confetti';
import {
  DailyPuzzle,
  generateTwelveMonthArchive,
  pickRandomArchivePuzzle,
  calculateWordLengthPoints,
  formatDuration,
} from '../mpsearch/utils/puzzleGenerator';
import { WordSearchBoard } from '../mpsearch/components/WordSearchBoard';
import { ProgressArchiveModal } from '../mpsearch/components/ProgressArchiveModal';
import { soundFX } from '../mpsearch/utils/sound';
import {
  LocalPuzzleProgress,
  readStoredProgressMap,
  writeStoredProgressMap,
} from '../mpsearch/firebase';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED';

export interface FoundWordEntry {
  word: string;
  length: number;
  points: number;
  finderId: string;
  finderName: string;
  finderAvatar: string;
  timestamp: number;
}

export interface RoundPlayerEntry {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  score: number;
  wordsFound: number;
  words: { word: string; length: number; points: number }[];
  lastWordAt: number;
}

interface MPSearchOverlayPayload {
  roundNumber: number;
  dateKey: string;
  puzzleNumber: number;
  themeTitle: string;
  category: string;
  foundWords: string[];
  foundEntries: FoundWordEntry[];
  scoreboard: RoundPlayerEntry[];
  elapsedSeconds: number;
  isCompleted: boolean;
  autoNextCountdown: number | null;
  autoAdvanceEnabled: boolean;
  hintTargetWord: string | null;
  hintTier: number;
}

const LOCAL_STORAGE_THEME_KEY = 'mpsearchint_dark_mode_v2';
const LOCAL_STORAGE_LARGE_PRINT_KEY = 'mpsearchint_large_print';
const AUTO_ADVANCE_SECONDS = 15;

const SIMULATED_CROWD_PLAYERS = [
  {
    id: 'sim_lexi_queen',
    username: 'lexi_queen',
    nickname: 'LexiQueen',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=lexi_queen',
  },
  {
    id: 'sim_grid_hawk',
    username: 'grid_hawk',
    nickname: 'GridHawk',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=grid_hawk',
  },
  {
    id: 'sim_puzzle_knight',
    username: 'puzzle_knight',
    nickname: 'PuzzleKnight',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=puzzle_knight',
  },
  {
    id: 'sim_nova_scout',
    username: 'nova_scout',
    nickname: 'NovaScout',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=nova_scout',
  },
  {
    id: 'sim_velvet_fox',
    username: 'velvet_fox',
    nickname: 'VelvetFox',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=velvet_fox',
  },
];

export default function MPSearchInteractiveApp() {
  const overlayConfig = useOverlayConfig();
  const { isOverlay } = overlayConfig;
  const todayDateStr = useMemo(() => getLondonTodayDateStr(), []);

  // 12-Month Archive (368 Daily Puzzles = original 6 months + another 6 months)
  const archive = useMemo(() => generateTwelveMonthArchive(todayDateStr), [todayDateStr]);

  // Pick a random puzzle from the 368-puzzle archive for the initial round
  const [currentDateKey, setCurrentDateKey] = useState<string>(() => {
    const initialRandom = pickRandomArchivePuzzle(archive);
    return initialRandom.dateKey;
  });
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [gameState, setGameState] = useState<GameState>(() =>
    isOverlay ? 'PLAYING' : 'PLAYING'
  );

  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  // Unified Auth & Leaderboard Modal State
  const { user: currentUser } = useUnifiedAuth();
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'account' | 'leaderboards'>('leaderboards');

  const openSignInModal = useCallback(() => {
    setAuthModalTab('account');
    setShowAuthModal(true);
  }, []);

  const openUnifiedLeaderboardModal = useCallback(() => {
    setAuthModalTab('leaderboards');
    setShowAuthModal(true);
  }, []);

  // Dark Mode & Readability state (Interactive defaults to Dark Mode like other interactive games)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_THEME_KEY);
      if (saved !== null) return saved === 'true';
    } catch {
      // Ignore
    }
    return true;
  });

  const [largePrint, setLargePrint] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_LARGE_PRINT_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => soundFX.isMuted());

  // Round Gameplay State
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [foundEntries, setFoundEntries] = useState<FoundWordEntry[]>([]);
  const [playersMap, setPlayersMap] = useState<Record<string, RoundPlayerEntry>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [hintTargetWord, setHintTargetWord] = useState<string | null>(null);
  const [hintTier, setHintTier] = useState<number>(0);
  const [showRequiredWordsPopup, setShowRequiredWordsPopup] = useState<boolean>(false);

  // Auto-Next Round Countdown when all 8 words are found
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState<boolean>(true);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);

  // Live Discovery Toast Banner
  const [recentDiscoveryBanner, setRecentDiscoveryBanner] = useState<{
    word: string;
    length: number;
    points: number;
    finderName: string;
  } | null>(null);

  // TikTok Live Connection State
  const [tiktokUsername, setTiktokUsername] = useState<string>(() => {
    try {
      return localStorage.getItem('mp_tiktok_bridge_username') || '';
    } catch {
      return '';
    }
  });
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [chatInputWord, setChatInputWord] = useState<string>('');
  const [chatInputHandle, setChatInputHandle] = useState<string>('crowd_spotter');
  const [chatFeed, setChatFeed] = useState<
    { id: string; user: string; text: string; matchedWord?: string; points?: number }[]
  >([]);

  const socketRef = useRef<Socket | null>(null);

  // Per-user Progress Map for Archive Modal compatibility
  const [progressMap, setProgressMap] = useState<Record<string, LocalPuzzleProgress>>(() =>
    readStoredProgressMap()
  );

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_THEME_KEY, String(darkMode));
    } catch {
      // Ignore
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_LARGE_PRINT_KEY, String(largePrint));
    } catch {
      // Ignore
    }
  }, [largePrint]);

  const currentPuzzle: DailyPuzzle = useMemo(() => {
    return archive.find((p) => p.dateKey === currentDateKey) || archive[archive.length - 1];
  }, [archive, currentDateKey]);

  const isPuzzleCompleted =
    foundWords.length >= currentPuzzle.words.length && currentPuzzle.words.length > 0;

  // Sorted Live Scoreboard (Ranked by points desc, then wordsFound desc, then earlier lastWordAt)
  const scoreboard: RoundPlayerEntry[] = useMemo(() => {
    return Object.values(playersMap).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.wordsFound !== a.wordsFound) return b.wordsFound - a.wordsFound;
      return a.lastWordAt - b.lastWordAt;
    });
  }, [playersMap]);

  // Daily Streak integration
  const dailyStreak = useDailyStreak('mpsearchint', todayDateStr, false, 0);

  // Elapsed timer during active play
  useEffect(() => {
    if (isOverlay) return;
    if (gameState !== 'PLAYING' || isPuzzleCompleted) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isOverlay, gameState, isPuzzleCompleted]);

  // Start a new random round from the 12-month (368-puzzle) archive
  const startNewRandomRound = useCallback(
    (specificDateKey?: string) => {
      const nextPuzzle = specificDateKey
        ? archive.find((p) => p.dateKey === specificDateKey) ||
          pickRandomArchivePuzzle(archive, currentDateKey)
        : pickRandomArchivePuzzle(archive, currentDateKey);

      setCurrentDateKey(nextPuzzle.dateKey);
      setRoundNumber((r) => r + 1);
      setFoundWords([]);
      setFoundEntries([]);
      setPlayersMap({});
      setElapsedSeconds(0);
      setHintsUsed(0);
      setHintTargetWord(null);
      setHintTier(0);
      setShowRequiredWordsPopup(false);
      setAutoNextCountdown(null);
      setRecentDiscoveryBanner(null);
      setGameState('PLAYING');
    },
    [archive, currentDateKey]
  );

  // Trigger Auto-Next Round Countdown when all required words (8-12) are found
  useEffect(() => {
    if (isOverlay) return;
    if (!isPuzzleCompleted) {
      setAutoNextCountdown(null);
      return;
    }

    setAutoNextCountdown(AUTO_ADVANCE_SECONDS);
  }, [isOverlay, isPuzzleCompleted]);

  useEffect(() => {
    if (isOverlay) return;
    if (!isPuzzleCompleted || !autoAdvanceEnabled || autoNextCountdown === null) return;

    if (autoNextCountdown <= 0) {
      startNewRandomRound();
      return;
    }

    const timer = window.setTimeout(() => {
      setAutoNextCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [isOverlay, isPuzzleCompleted, autoAdvanceEnabled, autoNextCountdown, startNewRandomRound]);

  // Sync state in real time to TikTok LIVE Studio Overlay (`/interactive-games/mpsearch/overlay`)
  const overlayPayload: MPSearchOverlayPayload = useMemo(
    () => ({
      roundNumber,
      dateKey: currentPuzzle.dateKey,
      puzzleNumber: currentPuzzle.puzzleNumber,
      themeTitle: currentPuzzle.themeTitle,
      category: currentPuzzle.category,
      foundWords,
      foundEntries,
      scoreboard,
      elapsedSeconds,
      isCompleted: isPuzzleCompleted,
      autoNextCountdown,
      autoAdvanceEnabled,
      hintTargetWord,
      hintTier,
    }),
    [
      roundNumber,
      currentPuzzle,
      foundWords,
      foundEntries,
      scoreboard,
      elapsedSeconds,
      isPuzzleCompleted,
      autoNextCountdown,
      autoAdvanceEnabled,
      hintTargetWord,
      hintTier,
    ]
  );

  const handleOverlayUpdate = useCallback((data: MPSearchOverlayPayload) => {
    if (!data) return;
    setRoundNumber(data.roundNumber ?? 1);
    if (data.dateKey) setCurrentDateKey(data.dateKey);
    if (Array.isArray(data.foundWords)) setFoundWords(data.foundWords);
    if (Array.isArray(data.foundEntries)) setFoundEntries(data.foundEntries);
    if (Array.isArray(data.scoreboard)) {
      const nextMap: Record<string, RoundPlayerEntry> = {};
      data.scoreboard.forEach((p) => {
        nextMap[p.id] = p;
      });
      setPlayersMap(nextMap);
    }
    if (typeof data.elapsedSeconds === 'number') setElapsedSeconds(data.elapsedSeconds);
    setAutoNextCountdown(data.autoNextCountdown ?? null);
    if (typeof data.autoAdvanceEnabled === 'boolean') {
      setAutoAdvanceEnabled(data.autoAdvanceEnabled);
    }
    setHintTargetWord(data.hintTargetWord ?? null);
    setHintTier(data.hintTier ?? 0);
  }, []);

  useOverlaySync<MPSearchOverlayPayload>({
    gameId: 'mpsearchint',
    streamer: isOverlay ? overlayConfig.streamer || undefined : tiktokUsername || undefined,
    isOverlay,
    localState: isOverlay ? null : overlayPayload,
    onSyncedState: handleOverlayUpdate,
  });

  // Core handler to award a discovered word to a player (from board drag/tap OR TikTok Live chat)
  const awardWordToPlayer = useCallback(
    (
      rawWord: string,
      playerInfo?: { id?: string; username?: string; nickname?: string; avatar?: string }
    ): boolean => {
      const normalizedWord = rawWord.trim().toUpperCase().replace(/[^A-Z]/g, '');
      if (!normalizedWord) return false;

      // Verify word is in currentPuzzle.words and not yet found
      const placedObj = currentPuzzle.words.find((w) => w.word === normalizedWord);
      if (!placedObj) return false;
      if (foundWords.includes(normalizedWord)) return false;

      const points = calculateWordLengthPoints(normalizedWord);
      const wordLen = normalizedWord.length;

      const defaultHostName = currentUser
        ? getCleanDisplayName(currentUser)
        : tiktokUsername
        ? `@${tiktokUsername.replace(/^@/, '')}`
        : 'Host Spotter';
      const finderUsername = (
        playerInfo?.username ||
        tiktokUsername ||
        defaultHostName
      ).replace(/^@/, '');
      const finderDisplayName = playerInfo?.nickname || finderUsername || defaultHostName;
      const finderId = (playerInfo?.id || finderUsername || 'host_player').toLowerCase();
      const finderAvatar =
        playerInfo?.avatar ||
        (!playerInfo?.username && currentUser?.photoURL ? currentUser.photoURL : '') ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(finderId)}`;

      const nextFoundWords = [...foundWords, normalizedWord];
      const now = Date.now();

      const newEntry: FoundWordEntry = {
        word: normalizedWord,
        length: wordLen,
        points,
        finderId,
        finderName: finderDisplayName,
        finderAvatar,
        timestamp: now,
      };

      setFoundWords(nextFoundWords);
      setFoundEntries((prev) => [newEntry, ...prev]);

      setPlayersMap((prev) => {
        const existing = prev[finderId] || {
          id: finderId,
          username: finderUsername,
          nickname: finderDisplayName,
          avatar: finderAvatar,
          score: 0,
          wordsFound: 0,
          words: [],
          lastWordAt: now,
        };
        return {
          ...prev,
          [finderId]: {
            ...existing,
            nickname: finderDisplayName,
            avatar: finderAvatar || existing.avatar,
            score: existing.score + points,
            wordsFound: existing.wordsFound + 1,
            words: [...existing.words, { word: normalizedWord, length: wordLen, points }],
            lastWordAt: now,
          },
        };
      });

      setRecentDiscoveryBanner({
        word: normalizedWord,
        length: wordLen,
        points,
        finderName: finderDisplayName,
      });

      // Clear active hint if the hinted word was just found
      if (hintTargetWord === normalizedWord) {
        setHintTargetWord(null);
        setHintTier(0);
      }

      // Credit unified profile score if player has a linked TikTok handle
      creditInteractiveScoreByTikTokHandle({
        tiktokUsername: finderUsername,
        gameId: 'mpsearchint',
        pointsEarned: points,
        reason: `Found ${normalizedWord} (${wordLen} letters) in MP Search Interactive`,
      });

      const willComplete = nextFoundWords.length >= currentPuzzle.words.length;
      if (willComplete) {
        soundFX.playPuzzleVictory();
        triggerVictoryConfetti();
        recordDailyPuzzleSolved('mpsearchint', todayDateStr);

        const totalRoundPts = nextFoundWords.reduce(
          (acc, w) => acc + calculateWordLengthPoints(w),
          0
        );

        // Save archive progress record
        setProgressMap((prevMap) => {
          const existing = prevMap[currentPuzzle.dateKey];
          const prevCompletedCount = existing?.completedCount || 0;
          const prevBestTime = existing?.bestTimeSeconds || 0;
          const nextBestTime =
            prevBestTime > 0 ? Math.min(prevBestTime, elapsedSeconds) : elapsedSeconds;
          const nextHighScore = Math.max(existing?.highScore || 0, totalRoundPts);

          const updated = {
            ...prevMap,
            [currentPuzzle.dateKey]: {
              dateKey: currentPuzzle.dateKey,
              puzzleNumber: currentPuzzle.puzzleNumber,
              themeTitle: currentPuzzle.themeTitle,
              category: currentPuzzle.category,
              foundWords: nextFoundWords,
              totalWords: currentPuzzle.words.length,
              elapsedSeconds,
              bestTimeSeconds: nextBestTime,
              highScore: nextHighScore,
              hintsUsed,
              completedCount: prevCompletedCount + 1,
              updatedAtIso: new Date().toISOString(),
              existsInCloud: Boolean(currentUser),
            },
          };
          writeStoredProgressMap(updated);
          return updated;
        });

        if (currentUser) {
          saveUnifiedLeaderboardScore({
            user: currentUser,
            gameId: 'mpsearch',
            puzzleId: currentPuzzle.dateKey,
            puzzleTitle: currentPuzzle.themeTitle,
            score: totalRoundPts,
            metricLabel: `${totalRoundPts.toLocaleString()} pts (${formatDuration(elapsedSeconds)})`,
            subMetricLabel: `#${currentPuzzle.puzzleNumber} · ${currentPuzzle.themeTitle}`,
          }).catch(() => {});
        }
      } else {
        soundFX.playWordFound();
      }

      return true;
    },
    [
      currentPuzzle,
      foundWords,
      currentUser,
      tiktokUsername,
      hintTargetWord,
      todayDateStr,
      elapsedSeconds,
      hintsUsed,
    ]
  );

  // Refs for latest callback inside Socket.IO listeners
  const awardWordRef = useRef(awardWordToPlayer);
  useEffect(() => {
    awardWordRef.current = awardWordToPlayer;
  }, [awardWordToPlayer]);

  const currentPuzzleRef = useRef(currentPuzzle);
  const foundWordsRef = useRef(foundWords);
  useEffect(() => {
    currentPuzzleRef.current = currentPuzzle;
    foundWordsRef.current = foundWords;
  }, [currentPuzzle, foundWords]);

  // Connect to TikTok Live via Socket.IO Bridge
  useEffect(() => {
    if (isOverlay) return;
    const newSocket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
    });
    socketRef.current = newSocket;

    const deduplicator = createEventDeduplicator();

    const handleConnectedEvent = (data: { username?: string; gameId?: string }) => {
      if (data?.gameId && data.gameId !== 'mpsearchint') return;
      setIsConnected(true);
      setConnectionError(null);
      setShowConnectModal(false);
      if (data?.username) {
        const clean = data.username.replace(/^@+/, '');
        setTiktokUsername(clean);
        try {
          localStorage.setItem('mp_tiktok_bridge_username', clean);
        } catch {
          // Ignore
        }
      }
    };

    newSocket.on('tiktok-connected', handleConnectedEvent);
    newSocket.on('tiktokConnected', handleConnectedEvent);

    newSocket.on('tiktok-status', (st: { connected?: boolean; username?: string; gameId?: string }) => {
      if (st && (!st.gameId || st.gameId === 'mpsearchint')) {
        if (st.connected) {
          setIsConnected(true);
          setConnectionError(null);
          if (st.username) setTiktokUsername(st.username.replace(/^@+/, ''));
        } else {
          setIsConnected(false);
        }
      }
    });

    newSocket.on('tiktok-disconnected', (payload?: { gameId?: string }) => {
      if (!payload?.gameId || payload.gameId === 'mpsearchint') setIsConnected(false);
    });
    newSocket.on('tiktokDisconnected', () => {
      setIsConnected(false);
    });

    const handleSocketErr = (err: string) => {
      setConnectionError(typeof err === 'string' ? err : 'Connection failed');
      setIsConnected(false);
    };
    newSocket.on('tiktok-error', handleSocketErr);
    newSocket.on('tiktokError', handleSocketErr);

    const handleIncomingChat = (data: {
      id?: string;
      uniqueId?: string;
      user?: string;
      nickname?: string;
      comment?: string;
      text?: string;
      avatar?: string;
      profilePictureUrl?: string;
    }) => {
      const rawComment = String(data.comment || data.text || '').trim();
      if (!rawComment) return;

      const handle = String(data.uniqueId || data.user || 'viewer').replace(/^@/, '');
      const nickname = String(data.nickname || handle);
      const avatar =
        data.profilePictureUrl ||
        data.avatar ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(handle)}`;

      // Tokenize incoming chat comment into candidate uppercase words
      const tokens = rawComment
        .toUpperCase()
        .split(/[^A-Z]+/)
        .filter((t) => t.length >= 3 && t.length <= 10);

      let matchedWord: string | undefined;
      let earnedPoints: number | undefined;

      for (const token of tokens) {
        const existsUnfound = currentPuzzleRef.current.words.some(
          (pw) => pw.word === token && !foundWordsRef.current.includes(pw.word)
        );
        if (existsUnfound) {
          const ok = awardWordRef.current(token, {
            id: handle.toLowerCase(),
            username: handle,
            nickname,
            avatar,
          });
          if (ok) {
            matchedWord = token;
            earnedPoints = calculateWordLengthPoints(token);
            break;
          }
        }
      }

      setChatFeed((prev) => [
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          user: nickname,
          text: rawComment,
          matchedWord,
          points: earnedPoints,
        },
        ...prev.slice(0, 24),
      ]);
    };

    const detachChat = attachResilientChatListeners({
      onChat: handleIncomingChat,
      onStatus: (status) => {
        if (status.connected) {
          setIsConnected(true);
          setConnectionError(null);
        }
      },
      deduplicator,
    });

    return () => {
      detachChat();
      newSocket.disconnect();
    };
  }, [isOverlay]);

  const handleConnectTikTok = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socketRef.current || !tiktokUsername.trim()) return;
    setConnectionError(null);
    const clean = tiktokUsername.trim().replace(/^@/, '');
    triggerResilientConnect(socketRef.current, { username: clean, gameId: 'mpsearchint' });
  };

  const handleForceReconnect = () => {
    if (!socketRef.current || !tiktokUsername.trim()) return;
    const clean = tiktokUsername.trim().replace(/^@/, '');
    forceReconnectBridge(socketRef.current, { username: clean, gameId: 'mpsearchint' });
  };

  // Submit word from Host / Simulator Chat Input
  const handleManualChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = chatInputWord.trim();
    if (!raw) return;
    const handle = (chatInputHandle.trim() || 'crowd_spotter').replace(/^@/, '');
    const upper = raw.toUpperCase().replace(/[^A-Z]/g, '');

    const ok = awardWordToPlayer(upper, {
      id: handle.toLowerCase(),
      username: handle,
      nickname: handle,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(handle)}`,
    });

    setChatFeed((prev) => [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user: handle,
        text: raw,
        matchedWord: ok ? upper : undefined,
        points: ok ? calculateWordLengthPoints(upper) : undefined,
      },
      ...prev.slice(0, 24),
    ]);
    setChatInputWord('');
  };

  // Simulate a single random crowd player spotting an unfound word on the board
  const handleSimulateCrowdFind = () => {
    const remaining = currentPuzzle.words.filter((w) => !foundWords.includes(w.word));
    if (remaining.length === 0) return;
    const randomWordObj = remaining[Math.floor(Math.random() * remaining.length)];
    const simPlayer =
      SIMULATED_CROWD_PLAYERS[Math.floor(Math.random() * SIMULATED_CROWD_PLAYERS.length)];

    awardWordToPlayer(randomWordObj.word, simPlayer);
    setChatFeed((prev) => [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user: simPlayer.nickname,
        text: randomWordObj.word,
        matchedWord: randomWordObj.word,
        points: calculateWordLengthPoints(randomWordObj.word),
      },
      ...prev.slice(0, 24),
    ]);
  };

  // Progressive 4-Tier Hint System (highlights board coordinates/direction/1st letter/path WITHOUT revealing unfound word text)
  const handleRequestHint = () => {
    if (isPuzzleCompleted) return;
    const unfound = currentPuzzle.words.filter((w) => !foundWords.includes(w.word));
    if (unfound.length === 0) return;

    setHintsUsed((h) => h + 1);

    let target = hintTargetWord;
    if (!target || foundWords.includes(target)) {
      target = unfound[0].word;
      setHintTargetWord(target);
      setHintTier(1);
      soundFX.playHintReveal(1);
    } else {
      const nextTier = hintTier < 4 ? hintTier + 1 : 4;
      setHintTier(nextTier);
      soundFX.playHintReveal(nextTier);
    }
  };

  const toggleMute = () => {
    const next = soundFX.toggleMute();
    setIsMuted(next);
  };

  const activeHintWordObj = useMemo(() => {
    if (!hintTargetWord || hintTier === 0) return null;
    return (
      currentPuzzle.words.find(
        (w) => w.word === hintTargetWord && !foundWords.includes(w.word)
      ) || null
    );
  }, [hintTargetWord, hintTier, currentPuzzle.words, foundWords]);

  // Top 5 Places for the Pop-Up Final Screen Over the Main Board
  const topFivePlaces = useMemo(() => {
    const slots: (RoundPlayerEntry | null)[] = [null, null, null, null, null];
    for (let i = 0; i < 5; i++) {
      slots[i] = scoreboard[i] || null;
    }
    return slots;
  }, [scoreboard]);

  // Pop-Up Final Screen Over the Main Board (Places 1-5 highlighting 1st, 2nd & 3rd)
  const finalBoardOverlayNode = isPuzzleCompleted ? (
    <div className="w-full h-full flex flex-col justify-between rounded-xl bg-gradient-to-b from-[#1E0631]/98 via-[#150424]/98 to-[#0E0219]/98 border-2 border-amber-400/70 p-3 sm:p-4 text-white shadow-[0_0_50px_rgba(245,158,11,0.3)] overflow-y-auto">
      {/* Header Banner */}
      <div className="text-center border-b border-purple-700/60 pb-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 text-[10px] font-black uppercase tracking-widest mb-1">
          <Trophy className="w-3 h-3 text-amber-400" />
          All {currentPuzzle.words.length} Hidden Words Found!
        </div>
        <h3 className="text-base sm:text-xl font-black tracking-tight text-white">
          Round #{roundNumber} Final Standings — Top 5
        </h3>
        <p className="text-[11px] text-purple-200/80 font-medium">
          {currentPuzzle.themeTitle} · Archive #{currentPuzzle.puzzleNumber} / {archive.length}
        </p>
      </div>

      {/* Places 1, 2 & 3 Highlighted Podium Cards */}
      <div className="my-2 space-y-1.5">
        {/* 1ST PLACE — GOLD HIGHLIGHT */}
        {(() => {
          const first = topFivePlaces[0];
          return (
            <div className="relative flex items-center justify-between gap-2.5 px-3 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-amber-400/30 via-yellow-500/20 to-[#290942]/90 border-2 border-amber-400 shadow-[0_0_24px_rgba(250,204,21,0.32)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-400 text-[#1A052A] flex items-center justify-center font-black text-xs sm:text-sm shrink-0 shadow-md">
                  <Crown className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                </div>
                {first ? (
                  <img
                    src={first.avatar}
                    alt=""
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-amber-300 bg-purple-950 shrink-0"
                  />
                ) : null}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-amber-400 text-[#1A052A] text-[9px] font-black uppercase tracking-wider">
                      1st Place
                    </span>
                    <span className="text-xs sm:text-sm font-black text-amber-200 truncate">
                      {first ? first.nickname : 'Unclaimed'}
                    </span>
                  </div>
                  <div className="text-[10px] text-amber-100/85 truncate">
                    {first
                      ? `${first.wordsFound} word${first.wordsFound === 1 ? '' : 's'} (${first.words
                          .map((w) => `${w.word} ${w.length}L`)
                          .join(', ')})`
                      : 'Spot words in chat or on the grid'}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono tabular-nums text-base sm:text-lg font-black text-amber-300 leading-none">
                  {first ? `${first.score} PTS` : '0 PTS'}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-amber-200/80">
                  Champion
                </div>
              </div>
            </div>
          );
        })()}

        {/* 2ND & 3RD PLACE — SILVER & BRONZE HIGHLIGHTS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {/* 2ND PLACE — SILVER HIGHLIGHT */}
          {(() => {
            const second = topFivePlaces[1];
            return (
              <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-gradient-to-r from-slate-300/25 via-slate-400/15 to-[#25083B]/90 border-2 border-slate-300/85 shadow-[0_0_16px_rgba(203,213,225,0.2)]">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-900 flex items-center justify-center font-black text-xs shrink-0">
                    <Medal className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-900 text-[9px] font-black uppercase">
                        2nd
                      </span>
                      <span className="text-xs font-black text-slate-100 truncate">
                        {second ? second.nickname : '—'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-300/85 truncate">
                      {second
                        ? `${second.wordsFound} word${second.wordsFound === 1 ? '' : 's'} found`
                        : 'Open slot'}
                    </div>
                  </div>
                </div>
                <div className="font-mono tabular-nums text-sm font-black text-slate-100 shrink-0">
                  {second ? `${second.score} PTS` : '0 PTS'}
                </div>
              </div>
            );
          })()}

          {/* 3RD PLACE — BRONZE HIGHLIGHT */}
          {(() => {
            const third = topFivePlaces[2];
            return (
              <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-gradient-to-r from-amber-600/30 via-orange-500/15 to-[#25083B]/90 border-2 border-amber-500/80 shadow-[0_0_16px_rgba(245,158,11,0.18)]">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                    <Award className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="px-1.5 py-0.2 rounded bg-amber-600 text-white text-[9px] font-black uppercase">
                        3rd
                      </span>
                      <span className="text-xs font-black text-amber-200 truncate">
                        {third ? third.nickname : '—'}
                      </span>
                    </div>
                    <div className="text-[10px] text-amber-200/80 truncate">
                      {third
                        ? `${third.wordsFound} word${third.wordsFound === 1 ? '' : 's'} found`
                        : 'Open slot'}
                    </div>
                  </div>
                </div>
                <div className="font-mono tabular-nums text-sm font-black text-amber-300 shrink-0">
                  {third ? `${third.score} PTS` : '0 PTS'}
                </div>
              </div>
            );
          })()}
        </div>

        {/* 4TH & 5TH PLACE — RUNNER-UP FINALIST ROWS */}
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          {[3, 4].map((slotIdx) => {
            const placeNum = slotIdx + 1;
            const entry = topFivePlaces[slotIdx];
            return (
              <div
                key={placeNum}
                className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#24083A]/90 border border-purple-700/60"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-5 h-5 rounded bg-purple-800/80 text-purple-200 font-mono text-[10px] font-black flex items-center justify-center shrink-0">
                    #{placeNum}
                  </span>
                  <span className="text-xs font-bold text-purple-100 truncate">
                    {entry ? entry.nickname : '—'}
                  </span>
                </div>
                <span className="font-mono tabular-nums text-xs font-extrabold text-amber-300/90 shrink-0">
                  {entry ? `${entry.score} PTS` : '0 PTS'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Auto-Advance & Next Random Puzzle Controls */}
      <div className="pt-2 border-t border-purple-700/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-purple-200">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          {autoAdvanceEnabled && autoNextCountdown !== null ? (
            <span>
              Next random puzzle in{' '}
              <strong className="font-mono text-amber-300">{autoNextCountdown}s</strong>
            </span>
          ) : (
            <span>Auto-advance paused</span>
          )}
        </div>
        {!isOverlay && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAutoAdvanceEnabled((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg bg-purple-900/80 hover:bg-purple-800 text-purple-100 text-[11px] font-bold border border-purple-600/60 cursor-pointer"
            >
              {autoAdvanceEnabled ? 'Pause Timer' : 'Resume Timer'}
            </button>
            <button
              type="button"
              onClick={() => startNewRandomRound()}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#1F0630] text-xs font-black shadow-sm cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
              Next Random Puzzle
            </button>
          </div>
        )}
      </div>
    </div>
  ) : undefined;

  // ============================================================================
  // TIKTOK LIVE STUDIO OVERLAY VIEW (`/interactive-games/mpsearch/overlay`)
  // ============================================================================
  if (isOverlay) {
    const isTransparent = overlayConfig.bg === 'transparent';
    return (
      <div
        className={`dark w-screen h-screen overflow-hidden flex items-center justify-center p-3 select-none ${
          isTransparent ? 'bg-transparent' : 'bg-[#12031E]'
        }`}
      >
        <div
          key={`ov-arena-${roundNumber}-${currentPuzzle.dateKey}`}
          className="w-full max-w-[540px] flex flex-col"
        >
          <div className="mb-2 flex items-center justify-between px-3 py-2 rounded-xl bg-[#1F0632] border border-amber-400/50 text-white">
            <div className="flex items-center gap-2">
              <img src="/brand-logo.png" alt="" className="w-6 h-6 object-contain" />
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
                  Round #{roundNumber} · {currentPuzzle.category}
                </div>
                <div className="text-sm font-black leading-tight">{currentPuzzle.themeTitle}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-purple-900 border border-purple-700 text-xs font-mono font-black text-amber-300">
                {foundWords.length} / {currentPuzzle.words.length} Words
              </span>
            </div>
          </div>

          <WordSearchBoard
            key={`ov-board-${roundNumber}-${currentPuzzle.dateKey}`}
            puzzle={currentPuzzle}
            foundWords={foundWords}
            foundWordFinders={foundEntries}
            onWordFound={() => {}}
            hintTargetWord={hintTargetWord}
            hintTier={hintTier}
            largePrint={true}
            disabled={true}
            boardOverlay={finalBoardOverlayNode}
          />
        </div>
      </div>
    );
  }

  // ============================================================================
  // FULL INTERACTIVE GAME VIEW (`/interactive-games/mpsearch`)
  // ============================================================================
  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="relative min-h-screen flex flex-col bg-[#F7F1E5] dark:bg-[#140421] text-[#2B0938] dark:text-[#F8F3FF] transition-colors duration-200 overflow-x-hidden">
        {/* Global 20% Opacity Missing Piece Logo Background Watermark */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 flex items-center justify-center z-0 overflow-hidden"
        >
          <img
            src="/brand-logo.png"
            alt=""
            className="w-[500px] h-[500px] object-contain opacity-20 select-none"
          />
        </div>

        {/* Top Navigation Header */}
        <header className="sticky top-0 z-30 w-full bg-[#240736] dark:bg-[#180428] text-white border-b border-purple-800/80 shadow-md">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
            {/* Left: Back to Interactive Games + Brand Identity */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Link
                to="/interactive-games"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-900/70 hover:bg-purple-800/90 text-amber-300 text-xs sm:text-sm font-bold border border-purple-700/70 transition-colors shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Interactive Games</span>
              </Link>

              <button
                type="button"
                onClick={() => setGameState('TITLE_MENU')}
                className="flex items-center gap-2.5 text-left group cursor-pointer min-w-0"
              >
                <img
                  src="/brand-logo.png"
                  alt="The Missing Piece"
                  className="w-9 h-9 rounded-lg object-contain bg-purple-950/90 p-1 border border-amber-400/50 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base sm:text-lg tracking-tight text-white group-hover:text-amber-300 transition-colors truncate">
                      MP Search Live
                    </span>
                    <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono tabular-nums font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                      Round #{roundNumber} · Archive #{currentPuzzle.puzzleNumber}/368
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-200/80 truncate hidden sm:block">
                    {currentPuzzle.themeTitle} · 12-Month Archive ({archive.length} Puzzles)
                  </p>
                </div>
              </button>

              {/* TikTok Live Status Pill (Moved 20px right for breathing room) */}
              <button
                type="button"
                onClick={() => setShowConnectModal(true)}
                className={`ml-[20px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-colors cursor-pointer shrink-0 ${
                  isConnected
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                    : 'bg-purple-900/70 hover:bg-purple-800 border-amber-400/40 text-amber-200'
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
                <span>{isConnected ? `@${tiktokUsername}` : 'Connect TikTok LIVE'}</span>
              </button>
            </div>

            {/* Right: Overlay URL Button, Random Round, Archive, Streak, Theme & Auth */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <LiveOverlayButton
                gameTitle="MP Search Interactive"
                gameSlug="mpsearch"
                streamerHandle={tiktokUsername}
                recommendedSize="580 × 660 or 1080 × 1920"
              />

              <DailyStreakBadge
                streak={dailyStreak.streak}
                solvedToday={dailyStreak.solvedToday}
                variant="light"
                compact
              />

              <button
                type="button"
                onClick={() => startNewRandomRound()}
                title="Draw a random puzzle from the 12-month (368-puzzle) archive"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#1F0630] text-xs font-black shadow-xs transition-colors cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Random Puzzle</span>
              </button>

              <button
                type="button"
                onClick={() => setIsArchiveOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-900/80 hover:bg-purple-800 text-amber-200 text-xs font-bold border border-purple-700/70 transition-colors cursor-pointer"
                title="Browse 12-Month Archive (368 Daily Puzzles)"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xl:inline">12M Archive</span>
              </button>

              <button
                type="button"
                onClick={() => setLargePrint((lp) => !lp)}
                aria-pressed={largePrint}
                title="Toggle Large Print Letters"
                className={`p-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                  largePrint
                    ? 'bg-amber-400 text-[#1F0630] border-amber-300'
                    : 'bg-purple-900/70 hover:bg-purple-800 text-purple-100 border-purple-700/70'
                }`}
              >
                <Type className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={toggleMute}
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                className="p-2 rounded-xl bg-purple-900/70 hover:bg-purple-800 text-purple-100 border border-purple-700/70 transition-colors cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-300" /> : <Volume2 className="w-4 h-4 text-amber-300" />}
              </button>

              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="p-2 rounded-xl bg-purple-900/70 hover:bg-purple-800 text-purple-100 border border-purple-700/70 transition-colors cursor-pointer"
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-purple-200" />}
              </button>

              <button
                type="button"
                onClick={() => setShowHowToPlay(true)}
                title="How to Play"
                className="p-2 rounded-xl bg-purple-900/70 hover:bg-purple-800 text-purple-100 border border-purple-700/70 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={openUnifiedLeaderboardModal}
                title="Leaderboards"
                className="p-2 rounded-xl bg-purple-900/70 hover:bg-purple-800 text-amber-300 border border-purple-700/70 transition-colors cursor-pointer"
              >
                <BarChart2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={openSignInModal}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/50 text-xs font-extrabold transition-colors cursor-pointer"
              >
                {currentUser ? (
                  <>
                    <UserIcon className="w-3.5 h-3.5 text-amber-300" />
                    <span className="hidden md:inline max-w-[96px] truncate">
                      {getCleanDisplayName(currentUser)}
                    </span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5 text-amber-300" />
                    <span className="hidden md:inline">Sign In</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col justify-center">
          {gameState === 'TITLE_MENU' ? (
            <div className="max-w-4xl mx-auto w-full rounded-3xl bg-white/95 dark:bg-[#1F0632]/95 border-2 border-purple-200/90 dark:border-amber-400/35 shadow-2xl p-6 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/80 text-[#4A0E5C] dark:text-amber-300 text-xs font-extrabold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    TikTok Live Interactive 10×10 Word Search
                  </div>

                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#230630] dark:text-white leading-tight">
                    MP Search{' '}
                    <span className="text-amber-600 dark:text-amber-400">Interactive</span>
                  </h1>

                  <p className="text-sm sm:text-base text-slate-600 dark:text-purple-200/85 leading-relaxed">
                    Every round randomly draws from a <strong>12-month archive (368 puzzles)</strong>{' '}
                    with <strong>8 to 12 randomized target words</strong> per board. There is no
                    target word bank — viewers scan the 10×10 grid and earn{' '}
                    <strong>points based on the length of each word found</strong>! When all{' '}
                    {currentPuzzle.words.length} required words are found, the{' '}
                    <strong>Top 1–5 Final Standings</strong> pop up directly over the main board.
                  </p>

                  <div className="flex flex-wrap gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setGameState('PLAYING')}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#4A0E5C] hover:bg-[#5E1475] dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-[#1F0630] font-black text-sm shadow-md transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Launch Round #{roundNumber}
                    </button>

                    <button
                      type="button"
                      onClick={() => startNewRandomRound()}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/70 dark:hover:bg-purple-800/80 text-[#3B0D47] dark:text-amber-200 font-bold text-sm border border-purple-200 dark:border-purple-700 transition-colors cursor-pointer"
                    >
                      <Shuffle className="w-4 h-4 text-amber-500" />
                      Pick Another Random Puzzle
                    </button>
                  </div>
                </div>

                {/* Right: Word-Length Scoring Breakdown Card (Replaces Target Word Bank Preview) */}
                <div className="lg:col-span-5 rounded-2xl bg-[#FAF6EE] dark:bg-[#160426] border border-purple-200/90 dark:border-purple-800/80 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#581c6b] dark:text-amber-300">
                      Word-Length Scoring System
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-500 dark:text-purple-300">
                      Length × 10 PTS
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { len: '4 Letters', pts: '+40 PTS' },
                      { len: '5 Letters', pts: '+50 PTS' },
                      { len: '6 Letters', pts: '+60 PTS' },
                      { len: '7 Letters', pts: '+70 PTS' },
                      { len: '8 Letters', pts: '+80 PTS' },
                      { len: '9 Letters', pts: '+90 PTS' },
                    ].map((row) => (
                      <div
                        key={row.len}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-[#230838] border border-purple-200/70 dark:border-purple-800/70 font-bold"
                      >
                        <span className="text-slate-700 dark:text-purple-100">{row.len}</span>
                        <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                          {row.pts}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-purple-300/80">
                    All {currentPuzzle.words.length} target words (randomized 8–12 per round) are
                    hidden in the 10×10 grid. Find all {currentPuzzle.words.length} to trigger the
                    Places 1–5 Podium Pop-Up over the main board!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* ACTIVE PLAYFIELD: 12-Col Grid with 10x10 Board + Live Word-Length Scoreboard */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left 7 Columns: Puzzle Header Bar + 10x10 WordSearchBoard (with Final Screen Pop-up over main board) */}
              <div className="lg:col-span-7 flex flex-col items-center w-full">
                {/* Round Info & Controls Bar */}
                <div className="w-full max-w-[540px] mb-3 rounded-2xl bg-white/95 dark:bg-[#1F0632]/95 border border-purple-200/90 dark:border-purple-800/80 px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Round #{roundNumber} · {currentPuzzle.category}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-purple-400">•</span>
                      <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-purple-300">
                        Archive #{currentPuzzle.puzzleNumber}/368 ({currentPuzzle.displayDate})
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-[#230630] dark:text-white leading-tight">
                      {currentPuzzle.themeTitle}
                    </h2>
                  </div>

                  {/* Timer & Words Found Counter */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/90 border border-purple-200/80 dark:border-purple-800/80 font-mono tabular-nums text-xs font-extrabold text-[#3b0d47] dark:text-purple-100">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>{formatDuration(elapsedSeconds)}</span>
                    </div>

                    <div className="px-2.5 py-1.5 rounded-xl bg-amber-400/20 border border-amber-400/50 font-mono tabular-nums text-xs font-black text-amber-800 dark:text-amber-300">
                      {foundWords.length} / {currentPuzzle.words.length} Found
                    </div>
                  </div>
                </div>

                {/* Recent Word Discovery Banner */}
                {recentDiscoveryBanner && !isPuzzleCompleted && (
                  <div className="w-full max-w-[540px] mb-2.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/60 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>
                        <strong>{recentDiscoveryBanner.finderName}</strong> found{' '}
                        <strong className="font-mono tracking-wider">
                          {recentDiscoveryBanner.word}
                        </strong>{' '}
                        ({recentDiscoveryBanner.length} letters)
                      </span>
                    </div>
                    <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">
                      +{recentDiscoveryBanner.points} PTS
                    </span>
                  </div>
                )}

                {/* 10x10 WordSearchBoard with Pop-Up Final Screen Over Main Board when all 8 words found */}
                <WordSearchBoard
                  puzzle={currentPuzzle}
                  foundWords={foundWords}
                  foundWordFinders={foundEntries}
                  onWordFound={(word) => awardWordToPlayer(word)}
                  hintTargetWord={hintTargetWord}
                  hintTier={hintTier}
                  largePrint={largePrint}
                  disabled={isPuzzleCompleted}
                  boardOverlay={finalBoardOverlayNode}
                />
              </div>

              {/* Right 5 Columns: Live Round Scoreboard + Live Chat Spotter + Hint Pill Below */}
              <div className="lg:col-span-5 flex flex-col gap-3.5 w-full">
                {/* SCOREBOARD PANEL (REPLACES TARGET WORD BANK PILL) WITH HOST REQUIRED WORDS POP-UP OVERLAY */}
                <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-[#1F0632]/95 border-2 border-purple-200/90 dark:border-amber-400/35 shadow-xl p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-purple-200/80 dark:border-purple-800/80">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-[#2B0938] dark:text-white">
                          Word-Length Scoreboard
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-purple-200/75 mt-0.5">
                        Points awarded by word length found ({foundWords.length}/
                        {currentPuzzle.words.length} words found)
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-400/50 font-mono text-[11px] font-black text-amber-800 dark:text-amber-300">
                        LENGTH × 10 PTS
                      </span>
                    </div>
                  </div>

                  {/* Word Length Points Legend Bar */}
                  <div className="grid grid-cols-5 gap-1 mb-3 text-center font-mono text-[10px] font-extrabold">
                    {[
                      { l: '4L', p: '40p' },
                      { l: '5L', p: '50p' },
                      { l: '6L', p: '60p' },
                      { l: '7L', p: '70p' },
                      { l: '8L+', p: '80p+' },
                    ].map((b) => (
                      <div
                        key={b.l}
                        className="py-1 px-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/80 border border-purple-200/70 dark:border-purple-800/70 text-[#3b0d47] dark:text-purple-200"
                      >
                        <span>{b.l}</span>{' '}
                        <span className="text-amber-600 dark:text-amber-400">{b.p}</span>
                      </div>
                    ))}
                  </div>

                  {/* Ranked Player Standings */}
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                    {scoreboard.length === 0 ? (
                      <div className="py-6 px-4 text-center rounded-xl bg-[#FAF6EE] dark:bg-purple-950/45 border border-dashed border-purple-300 dark:border-purple-800">
                        <Users className="w-6 h-6 text-amber-500 mx-auto mb-1.5" />
                        <p className="text-xs font-extrabold text-[#2B0938] dark:text-purple-100">
                          No words claimed yet this round!
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-purple-300/80 mt-0.5">
                          Drag across the 10×10 grid, type a word below, or let TikTok LIVE chat
                          spot hidden words to climb Places 1–5.
                        </p>
                      </div>
                    ) : (
                      <AnimatePresence initial={false}>
                        {scoreboard.map((player, index) => {
                          const rank = index + 1;
                          const latestWord = player.words[player.words.length - 1];
                          return (
                            <motion.div
                              key={player.id}
                              layout="position"
                              initial={{ opacity: 0, y: 10, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                              className={`flex items-center justify-between gap-2.5 p-2.5 rounded-xl border transition-colors ${
                                rank === 1
                                  ? 'bg-amber-400/15 border-amber-400/80 shadow-xs'
                                  : rank === 2
                                  ? 'bg-slate-300/15 border-slate-300/70'
                                  : rank === 3
                                  ? 'bg-amber-600/15 border-amber-500/70'
                                  : 'bg-[#FAF6EE]/90 dark:bg-purple-950/60 border-purple-200/70 dark:border-purple-800/70'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-black shrink-0 ${
                                    rank === 1
                                      ? 'bg-amber-400 text-[#1F0630]'
                                      : rank === 2
                                      ? 'bg-slate-200 text-slate-900'
                                      : rank === 3
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-purple-200 dark:bg-purple-800 text-[#2B0938] dark:text-purple-100'
                                  }`}
                                >
                                  #{rank}
                                </span>
                                <img
                                  src={player.avatar}
                                  alt=""
                                  className="w-7 h-7 rounded-full bg-purple-900 border border-purple-400/40 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs sm:text-sm font-black text-[#2B0938] dark:text-white truncate">
                                      {player.nickname}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-purple-300">
                                      ({player.wordsFound}w)
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    <AnimatePresence initial={false}>
                                      {player.words.map((w) => (
                                        <motion.span
                                          key={w.word}
                                          initial={{ opacity: 0, scale: 0.72, y: 6 }}
                                          animate={{ opacity: 1, scale: 1, y: 0 }}
                                          transition={{
                                            type: 'spring',
                                            stiffness: 420,
                                            damping: 22,
                                          }}
                                          className="relative overflow-hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-purple-100 to-amber-50 dark:from-purple-900/95 dark:to-[#2e0948] border border-purple-300/75 dark:border-amber-400/35 text-[10px] font-mono font-bold text-[#3b0d47] dark:text-purple-100 shadow-xs"
                                        >
                                          <motion.span
                                            aria-hidden="true"
                                            initial={{ x: '-115%', opacity: 0.9 }}
                                            animate={{ x: '130%', opacity: 0 }}
                                            transition={{ duration: 0.85, ease: 'easeOut' }}
                                            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/80 to-emerald-300/65 z-0"
                                          />
                                          <span className="relative z-10 tracking-wide">
                                            {w.word}
                                          </span>
                                          <span className="relative z-10 px-1 rounded bg-amber-400/20 text-amber-700 dark:text-amber-300 font-black">
                                            {w.length}L · +{w.points}
                                          </span>
                                        </motion.span>
                                      ))}
                                    </AnimatePresence>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <motion.div
                                  key={player.score}
                                  initial={{ scale: 1.18 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                                  className="font-mono tabular-nums text-sm sm:text-base font-black text-amber-600 dark:text-amber-300 origin-right"
                                >
                                  {player.score} PTS
                                </motion.div>
                                {latestWord && (
                                  <motion.div
                                    key={`${player.id}-${player.lastWordAt}`}
                                    initial={{ opacity: 0, y: 4, scale: 0.85 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.3, ease: 'easeOut' }}
                                    className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-300"
                                  >
                                    +{latestWord.points} {latestWord.word}
                                  </motion.div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    )}
                  </div>

                  {/* Discovered Words Feed (Only shows found words + hidden word count remaining) */}
                  <div className="mt-3.5 pt-3 border-t border-purple-200/80 dark:border-purple-800/80">
                    <div className="flex items-center justify-between text-xs font-extrabold text-slate-600 dark:text-purple-200 mb-2">
                      <span>
                        Discovered Words ({foundEntries.length} / {currentPuzzle.words.length})
                      </span>
                      <span className="font-mono text-amber-600 dark:text-amber-300">
                        {currentPuzzle.words.length - foundEntries.length} Hidden Remaining
                      </span>
                    </div>

                    {foundEntries.length === 0 ? (
                      <div className="text-xs text-slate-500 dark:text-purple-300/75 italic">
                        Target words are hidden! Spot them in the 10×10 grid to score points by word
                        length.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        <AnimatePresence initial={false}>
                          {foundEntries.map((item) => (
                            <motion.span
                              key={item.word}
                              initial={{ opacity: 0, scale: 0.76, y: 6 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                              className="relative overflow-hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/45 text-xs font-mono font-bold text-emerald-900 dark:text-emerald-200 shadow-xs"
                            >
                              <motion.span
                                aria-hidden="true"
                                initial={{ x: '-115%', opacity: 0.9 }}
                                animate={{ x: '130%', opacity: 0 }}
                                transition={{ duration: 0.95, ease: 'easeOut' }}
                                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/85 to-emerald-400/75 z-0"
                              />
                              <span className="relative z-10">{item.word}</span>
                              <span className="relative z-10 text-[10px] px-1 rounded bg-emerald-500/25 text-emerald-800 dark:text-emerald-100">
                                {item.length}L · +{item.points}
                              </span>
                              <span className="relative z-10 text-[10px] text-slate-500 dark:text-purple-300">
                                @{item.finderName}
                              </span>
                            </motion.span>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                  {/* HOST-ONLY REQUIRED WORDS POP-UP OVER THE SCOREBOARD */}
                  <AnimatePresence>
                    {showRequiredWordsPopup && (
                      <motion.div
                        key="required_words_popup"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="absolute inset-0 z-30 flex flex-col justify-between p-4 sm:p-5 bg-[#190529]/98 backdrop-blur-md text-white rounded-2xl border-2 border-amber-400/75 shadow-2xl"
                      >
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-purple-700/70">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Eye className="w-4 h-4 text-amber-400" />
                              <h4 className="text-sm font-black uppercase tracking-wider text-amber-300">
                                Host Required Words ({foundWords.length}/{currentPuzzle.words.length})
                              </h4>
                            </div>
                            <p className="text-[11px] text-purple-200/80">
                              {currentPuzzle.themeTitle} · Click any unfound word to target it for hints
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowRequiredWordsPopup(false)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-800/80 hover:bg-purple-700 text-amber-200 text-xs font-bold border border-purple-600/60 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Close</span>
                          </button>
                        </div>

                        <div className="my-2.5 flex-1 overflow-y-auto pr-1 grid grid-cols-2 gap-1.5 content-start">
                          {currentPuzzle.words.map((pw) => {
                            const isFound = foundWords.includes(pw.word);
                            const isHinted = hintTargetWord === pw.word && !isFound;
                            const pts = calculateWordLengthPoints(pw.word);
                            return (
                              <button
                                key={pw.word}
                                type="button"
                                onClick={() => {
                                  if (!isFound) {
                                    setHintTargetWord(pw.word);
                                    if (hintTier === 0) setHintTier(1);
                                  }
                                }}
                                className={`px-2.5 py-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
                                  isFound
                                    ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200 opacity-75'
                                    : isHinted
                                    ? 'bg-amber-400/25 border-amber-400 text-white shadow-xs'
                                    : 'bg-purple-950/80 hover:bg-purple-900/80 border-purple-700/70 text-purple-100'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div
                                    className={`font-mono text-xs sm:text-sm font-black tracking-wider truncate ${
                                      isFound ? 'line-through text-emerald-300' : 'text-white'
                                    }`}
                                  >
                                    {pw.word}
                                  </div>
                                  <div className="text-[10px] font-mono text-purple-300/90">
                                    {pw.directionArrow} Col {pw.startColumnLetter}
                                    {pw.startRowNumber}
                                    {pw.isBackwards ? ' · Rev' : ''}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  {isFound ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
                                  ) : (
                                    <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40">
                                      +{pts}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <div className="pt-2 border-t border-purple-700/70 flex items-center justify-between text-[11px] text-purple-200/85">
                          <span>Hidden from TikTok LIVE Overlay</span>
                          <span className="font-mono font-bold text-amber-300">
                            {currentPuzzle.words.length - foundWords.length} Still Needed
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* LIVE CHAT WORD SPOTTER & CROWD SIMULATOR */}
                <div className="rounded-2xl bg-white/95 dark:bg-[#1F0632]/95 border border-purple-200/90 dark:border-purple-800/80 shadow-lg p-4">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#2B0938] dark:text-white">
                        Live Chat Word Spotter
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={handleSimulateCrowdFind}
                      disabled={isPuzzleCompleted}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/80 dark:hover:bg-purple-800 disabled:opacity-40 text-[#3b0d47] dark:text-amber-300 text-[11px] font-extrabold border border-purple-300/70 dark:border-purple-700 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Simulate Crowd Spot
                    </button>
                  </div>

                  <form onSubmit={handleManualChatSubmit} className="flex gap-1.5 mb-2.5">
                    <input
                      type="text"
                      value={chatInputHandle}
                      onChange={(e) => setChatInputHandle(e.target.value)}
                      placeholder="@player"
                      aria-label="Player handle"
                      className="w-28 px-2.5 py-1.5 rounded-xl bg-[#FAF6EE] dark:bg-purple-950/90 border border-purple-200 dark:border-purple-800 text-xs font-mono font-bold text-[#2B0938] dark:text-white"
                    />
                    <input
                      type="text"
                      value={chatInputWord}
                      onChange={(e) => setChatInputWord(e.target.value)}
                      placeholder="Type a grid word..."
                      aria-label="Type a grid word"
                      className="flex-1 px-3 py-1.5 rounded-xl bg-[#FAF6EE] dark:bg-purple-950/90 border border-purple-200 dark:border-purple-800 text-xs font-mono font-bold uppercase text-[#2B0938] dark:text-white"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#1F0630] font-black text-xs flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Spot
                    </button>
                  </form>

                  {/* Recent Chat Activity Mini-Feed */}
                  {chatFeed.length > 0 && (
                    <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] pr-1">
                      {chatFeed.slice(0, 6).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-[#FAF6EE]/80 dark:bg-purple-950/60"
                        >
                          <div className="truncate">
                            <span className="font-extrabold text-[#4A0E5C] dark:text-amber-300">
                              @{item.user}:
                            </span>{' '}
                            <span className="font-mono text-slate-700 dark:text-purple-100">
                              {item.text}
                            </span>
                          </div>
                          {item.matchedWord && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-black shrink-0">
                              +{item.points} PTS
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* HINT PILL & REQUIRED WORDS BUTTON (MOVED BELOW LIVE CHAT WORD SPOTTER) */}
                <div className="rounded-2xl bg-white/95 dark:bg-[#1F0632]/95 border border-purple-200/90 dark:border-purple-800/80 shadow-lg p-3.5 sm:p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider text-[#2B0938] dark:text-white">
                          4-Tier Board Hint &amp; Host Controls
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-purple-200/75">
                          {hintTier > 0
                            ? `Active Hint Tier ${hintTier}/4 on board`
                            : '1: Direction · 2: Row/Col · 3: 1st Letter · 4: Path'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowRequiredWordsPopup((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border transition-colors cursor-pointer ${
                          showRequiredWordsPopup
                            ? 'bg-purple-800 text-amber-300 border-amber-400/70'
                            : 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/80 dark:hover:bg-purple-800 text-[#3b0d47] dark:text-amber-200 border-purple-300/80 dark:border-purple-700'
                        }`}
                      >
                        {showRequiredWordsPopup ? (
                          <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        <span>Required Words</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRequestHint}
                        disabled={isPuzzleCompleted}
                        title="Progressive Board Hint (Direction -> Coordinates -> 1st Letter -> Path)"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-[#1F0630] text-xs font-black shadow-xs transition-colors cursor-pointer"
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        <span>{hintTier > 0 ? `Hint Tier ${hintTier}/4` : 'Hint'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Hint Clue Pill Readout (Never reveals unfound word text) */}
                  {activeHintWordObj && hintTier > 0 && !isPuzzleCompleted && (
                    <div className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/60 flex items-center justify-between gap-2 text-xs">
                      <div className="font-bold text-amber-900 dark:text-amber-200">
                        Hidden <strong>{activeHintWordObj.word.length}-letter word</strong> (
                        {calculateWordLengthPoints(activeHintWordObj.word)} pts):{' '}
                        {hintTier >= 1 && (
                          <span>
                            {activeHintWordObj.directionArrow} {activeHintWordObj.directionLabel}
                          </span>
                        )}
                        {hintTier >= 2 && (
                          <span>
                            {' '}
                            · Starts at{' '}
                            <strong className="font-mono underline">
                              Col {activeHintWordObj.startColumnLetter}, Row{' '}
                              {activeHintWordObj.startRowNumber}
                            </strong>
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400 text-[#1F0630] shrink-0">
                        Tier {hintTier}/4
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* TikTok LIVE Connect Modal */}
        {showConnectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1F0632] border-2 border-purple-300 dark:border-amber-400/50 p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-black text-[#2B0938] dark:text-white">
                    TikTok LIVE Chat Bridge
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConnectTikTok} className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-purple-200 mb-1.5">
                    TikTok Username (@handle)
                  </label>
                  <input
                    type="text"
                    value={tiktokUsername}
                    onChange={(e) => setTiktokUsername(e.target.value)}
                    placeholder="e.g. the.missing.piece"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] dark:bg-purple-950 border border-purple-300 dark:border-purple-700 text-sm font-bold text-[#2B0938] dark:text-white"
                  />
                </div>

                {connectionError && (
                  <p className="text-xs font-bold text-rose-500">{connectionError}</p>
                )}

                <div className="flex items-center justify-end gap-2">
                  {isConnected && (
                    <button
                      type="button"
                      onClick={handleForceReconnect}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-800 text-purple-100 text-xs font-bold"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Reconnect
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#1F0630] font-black text-xs cursor-pointer"
                  >
                    {isConnected ? 'Update Stream Connection' : 'Connect Live Chat'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* How to Play Modal */}
        {showHowToPlay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1F0632] border-2 border-purple-300 dark:border-amber-400/50 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-purple-200 dark:border-purple-800">
                <h3 className="text-lg font-black text-[#2B0938] dark:text-white">
                  How to Play MP Search Interactive
                </h3>
                <button
                  type="button"
                  onClick={() => setShowHowToPlay(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-purple-100">
                <li>
                  • <strong>No Target Word Bank (8–12 Hidden Words):</strong> Unfound words are never
                  shown in a word bank pill. Scan the 10×10 grid horizontally, vertically, or
                  diagonally (forward or backward) to spot all {currentPuzzle.words.length} hidden
                  thematic words (randomized between 8 and 12 words per puzzle)!
                </li>
                <li>
                  • <strong>Word-Length Points:</strong> Every discovered word awards{' '}
                  <strong>Word Length × 10 PTS</strong> (e.g., 5 letters = 50 PTS, 7 letters = 70
                  PTS, 8 letters = 80 PTS).
                </li>
                <li>
                  • <strong>Places 1–5 Final Screen Over Main Board:</strong> As soon as all{' '}
                  {currentPuzzle.words.length} required words are found, the Final Standings pop up
                  directly over the main 10×10 board showcasing Places 1–5 and highlighting 1st, 2nd
                  &amp; 3rd place!
                </li>
                <li>
                  • <strong>12-Month Archive (368 Puzzles):</strong> Each round randomly selects a
                  puzzle from the full 12-month archive.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* 12-Month Archive & Stats Modal */}
        <ProgressArchiveModal
          isOpen={isArchiveOpen}
          onClose={() => setIsArchiveOpen(false)}
          archive={archive}
          currentDateKey={currentPuzzle.dateKey}
          progressMap={progressMap}
          onSelectPuzzle={(dateKey) => {
            startNewRandomRound(dateKey);
            setIsArchiveOpen(false);
          }}
          onResetPuzzle={(dateKey) => {
            setProgressMap((prev) => {
              const copy = { ...prev };
              delete copy[dateKey];
              writeStoredProgressMap(copy);
              return copy;
            });
          }}
          user={currentUser}
          onOpenSignIn={openSignInModal}
          onOpenLeaderboard={openUnifiedLeaderboardModal}
        />

        {/* Unified Account & Leaderboards Modal */}
        <UnifiedAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          user={currentUser}
          initialGameId="mpsearch"
          initialTab={authModalTab}
        />
      </div>
    </div>
  );
}
