import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  GameState,
  GameStats,
  DifficultyMode,
  TimerDuration,
  LayoutMode,
  RunningScoreboardPlayer,
  LiveChatItem,
  WordPuzzle,
} from './types';
import { getLondonDateString, generateDailyPuzzle } from './utils/puzzles';
import { getSafeAvatarUrl } from './utils/avatar';
import { deduplicateScoreboardPlayers, normalizePlayerKey } from './utils/scoreboard';
import { Header } from './components/Header';
import { TitleMenu } from './components/TitleMenu';
import { GameBoard, type DeStackBoardSnapshot } from './components/GameBoard';
import { RoundScoreboardModal } from './components/RoundScoreboardModal';
import { OverallScoreboardModal } from './components/OverallScoreboardModal';
import { TikTokConnectModal } from './components/TikTokConnectModal';
import { ArchiveModal } from './components/ArchiveModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { StatsModal } from './components/StatsModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import {
  useUnifiedAuth,
  saveUnifiedLeaderboardScore,
  creditInteractiveScoreByTikTokHandle,
  getLiveConnectionSessionId,
} from '@/lib/unified-game-auth';
import {
  getActiveInteractiveStreamerSession,
  touchActiveInteractiveStreamerSession,
} from '@/lib/interactive-key-auth';
import {
  recordInteractiveRoundCompleted,
  tryConsumeOrCheckNextRound,
} from '@/lib/interactive-daily-limits';
import {
  attachResilientChatListeners,
  createEventDeduplicator,
  emitResilientEvent,
  forceReconnectBridge,
  triggerResilientConnect,
} from '@/lib/live-chat-bridge';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';
import { useOverlayConfig, useOverlaySync } from '@/lib/live-overlay';
import { triggerVictoryConfetti } from '@/lib/confetti';
import { useDictionaryLanguage } from '@/lib/dictionary-languages';
import './index.css';

interface DeStackOverlayPayload {
  puzzle: WordPuzzle;
  difficulty: DifficultyMode;
  layoutMode: LayoutMode;
  timerDuration: TimerDuration;
  scoreboard: RunningScoreboardPlayer[];
  victoryData: {
    timeSeconds: number;
    hintsUsed: number;
    score: number;
    words: string[];
    difficulty: DifficultyMode;
  } | null;
  boardSnapshot: DeStackBoardSnapshot | null;
  tiktokUsername: string;
  isLiveConnected: boolean;
  resetSignal?: number;
  puzzleRoundNonce?: number;
}

const STATS_STORAGE_KEY = 'destackint_game_stats_v1';
const OVERALL_SCOREBOARD_STORAGE_KEY = 'destackint_overall_permanent_scoreboard_v1';
const TIKTOK_USER_STORAGE_KEY = 'missing_piece_tiktok_username';

const DEFAULT_STATS: GameStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  bestTimeSeconds: 9999,
  totalHintsUsed: 0,
  completedDays: {},
  completedHardDays: {},
};

export default function App() {
  const { isOverlay, bg: overlayBg, streamer: overlayStreamer } = useOverlayConfig();
  const [currentView, setCurrentView] = useState<GameState>(() =>
    isOverlay ? 'PLAYING' : 'TITLE'
  );
  const [todayDateStr] = useState<string>(() => getLondonDateString());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => getLondonDateString());
  const [difficulty, setDifficulty] = useState<DifficultyMode>('normal');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('daily');
  const [timerDuration, setTimerDuration] = useState<TimerDuration>(30);
  const [dictionaryLanguage] = useDictionaryLanguage();

  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  // Unified Account & Leaderboard Modal State
  const { user: currentUser } = useUnifiedAuth();
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'account' | 'leaderboards'>('account');

  const openSignInModal = () => {
    setAuthModalTab('account');
    setShowAuthModal(true);
  };

  const openUnifiedLeaderboardModal = () => {
    setAuthModalTab('leaderboards');
    setShowAuthModal(true);
  };

  // TikTok Live Socket & Interactive Scoreboard State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [tiktokUsername, setTiktokUsername] = useState<string>(() => {
    const activeStreamer = getActiveInteractiveStreamerSession();
    if (activeStreamer?.username) {
      return activeStreamer.username.replace(/^@+/, '');
    }
    try {
      return (localStorage.getItem(TIKTOK_USER_STORAGE_KEY) || '').replace(/^@+/, '');
    } catch {
      return '';
    }
  });
  const [roomId, setRoomId] = useState<string>('');
  const [tiktokError, setTiktokError] = useState<string | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);

  const [scoreboard, setScoreboard] = useState<RunningScoreboardPlayer[]>([]);
  const [overallScoreboard, setOverallScoreboard] = useState<RunningScoreboardPlayer[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(OVERALL_SCOREBOARD_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return deduplicateScoreboardPlayers(parsed);
        }
      } catch {}
    }
    return [];
  });
  const [isOverallScoreboardOpen, setIsOverallScoreboardOpen] = useState<boolean>(false);
  const [chatFeed, setChatFeed] = useState<LiveChatItem[]>([]);
  const [incomingChatQueue, setIncomingChatQueue] = useState<
    Array<{
      id: string;
      uniqueId: string;
      nickname: string;
      comment: string;
      profilePictureUrl: string;
    }>
  >([]);
  const [resetSignal, setResetSignal] = useState<number>(0);
  const [puzzleRoundNonce, setPuzzleRoundNonce] = useState<number>(0);

  const roundIdRef = useRef<number>(1);
  const creditedSolversByWordRef = useRef<
    Map<string, { ids: Set<string>; names: Set<string> }>
  >(new Map());
  const roundWinnerCreditedRef = useRef<Set<number>>(new Set());
  const deduplicatorRef = useRef(createEventDeduplicator());
  const scoreboardRef = useRef<RunningScoreboardPlayer[]>(scoreboard);
  useEffect(() => {
    scoreboardRef.current = scoreboard;
  }, [scoreboard]);

  const [stats, setStats] = useState<GameStats>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STATS_STORAGE_KEY);
        if (saved) return { ...DEFAULT_STATS, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_STATS;
  });

  const [victoryData, setVictoryData] = useState<{
    timeSeconds: number;
    hintsUsed: number;
    score: number;
    words: string[];
    difficulty: DifficultyMode;
  } | null>(null);

  const [hostBoardSnapshot, setHostBoardSnapshot] = useState<DeStackBoardSnapshot | null>(null);
  const [syncedOverlayPayload, setSyncedOverlayPayload] = useState<DeStackOverlayPayload | null>(null);
  const hasReceivedHostSyncRef = useRef<boolean>(false);

  // Force PLAYING view whenever overlay mode is active
  useEffect(() => {
    if (isOverlay && currentView !== 'PLAYING') {
      setCurrentView('PLAYING');
    }
  }, [isOverlay, currentView]);

  // Save stats (host mode only)
  useEffect(() => {
    if (isOverlay) return;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
      } catch {}
    }
  }, [stats, isOverlay]);

  // Save overall permanent scoreboard (host mode only)
  useEffect(() => {
    if (isOverlay) return;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(OVERALL_SCOREBOARD_STORAGE_KEY, JSON.stringify(overallScoreboard));
      } catch {}
    }
  }, [overallScoreboard, isOverlay]);

  // Sync dark mode class on root html (host mode only)
  useEffect(() => {
    if (isOverlay) return;
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode, isOverlay]);

  // Connect to persistent Socket.IO server scoped to isolated streamer session & destackint game
  useEffect(() => {
    if (isOverlay) return;
    const deduplicator = deduplicatorRef.current;
    const newSocket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 10000,
      timeout: 15000,
      query: {
        sessionId: getLiveConnectionSessionId('destackint'),
        gameId: 'destackint',
      },
    });
    setSocket(newSocket);

    const enqueueChatPayload = (data: any) => {
      if (isOverlay && hasReceivedHostSyncRef.current) return;
      const commentText = data?.comment ?? data?.text;
      if (!data || !commentText) return;
      touchActiveInteractiveStreamerSession();
      setIncomingChatQueue((prev) => [
        ...prev,
        {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          uniqueId: String(data.uniqueId || data.userId || data.username || 'viewer').replace(/^@+/, ''),
          nickname: String(data.nickname || data.uniqueId || 'Player').replace(/^@+/, ''),
          comment: String(commentText),
          profilePictureUrl: String(data.profilePictureUrl || data.avatar || ''),
        },
      ]);
    };

    newSocket.on(
      'tiktok-connected',
      ({ username, roomId: rId, gameId }: { username: string; roomId?: string; gameId?: string }) => {
        if (!gameId || gameId === 'destackint') {
          setIsLiveConnected(true);
          setTiktokUsername(username.replace(/^@+/, ''));
          setRoomId(rId || `LIVE_${username.replace(/^@+/, '')}`);
          setTiktokError(null);
          try {
            localStorage.setItem(TIKTOK_USER_STORAGE_KEY, username.replace(/^@+/, ''));
          } catch {}
        }
      }
    );

    newSocket.on(
      'tiktok-status',
      (status: { connected: boolean; username?: string; roomId?: string; gameId?: string }) => {
        if (status && (!status.gameId || status.gameId === 'destackint')) {
          setIsLiveConnected(Boolean(status.connected));
          if (status.username) setTiktokUsername(status.username.replace(/^@+/, ''));
          if (status.roomId) setRoomId(status.roomId);
        }
      }
    );

    newSocket.on('tiktok-error', (msg: string) => {
      console.warn('TikTok connection notice:', msg);
    });

    newSocket.on('tiktok-disconnected', (payload?: { gameId?: string }) => {
      if (!payload?.gameId || payload.gameId === 'destackint') {
        setIsLiveConnected(false);
        setRoomId('');
      }
    });

    newSocket.on('chat-message', (data: any) => {
      if (deduplicator.shouldProcess('chat', data)) {
        enqueueChatPayload(data);
      }
    });

    const detachBridge = attachResilientChatListeners({
      gameId: 'destackint',
      onChat: enqueueChatPayload,
      deduplicator,
    });

    return () => {
      detachBridge();
      newSocket.disconnect();
    };
  }, [isOverlay]);

  const handleConnectTikTok = useCallback(
    (username: string, isTestMode?: boolean) => {
      const clean = username.trim().replace(/^@+/, '') || 'test_streamer';
      setTiktokUsername(clean);
      setTiktokError(null);
      setIsLiveConnected(true);
      setRoomId(isTestMode ? 'TEST_SIMULATION_ROOM' : `LIVE_${clean}`);
      try {
        localStorage.setItem(TIKTOK_USER_STORAGE_KEY, clean);
      } catch {}

      triggerResilientConnect(
        socket,
        {
          username: clean,
          isTestMode: Boolean(isTestMode),
          gameId: 'destackint',
          sessionId: getLiveConnectionSessionId('destackint'),
        },
        ({ username: uname, roomId: rId }) => {
          setIsLiveConnected(true);
          setTiktokUsername((uname || clean).replace(/^@+/, ''));
          if (rId) setRoomId(rId);
        }
      );

      setIsConnectModalOpen(false);
      if (currentView === 'TITLE') {
        setCurrentView('PLAYING');
      }
    },
    [socket, currentView]
  );

  const handleReconnectTikTok = useCallback(
    (username: string, isTestMode?: boolean) => {
      const clean = username.trim().replace(/^@+/, '') || tiktokUsername || 'streamer';
      setTiktokUsername(clean);
      setTiktokError(null);
      setIsLiveConnected(true);
      setRoomId(isTestMode ? 'TEST_SIMULATION_ROOM' : `LIVE_${clean}`);

      forceReconnectBridge(
        socket,
        {
          username: clean,
          isTestMode: Boolean(isTestMode),
          gameId: 'destackint',
          sessionId: getLiveConnectionSessionId('destackint'),
        },
        ({ username: uname, roomId: rId }) => {
          setIsLiveConnected(true);
          setTiktokUsername((uname || clean).replace(/^@+/, ''));
          if (rId) setRoomId(rId);
        }
      );
      setIsConnectModalOpen(false);
    },
    [socket, tiktokUsername]
  );

  const handleDisconnectTikTok = useCallback(() => {
    const liveSessionId = getLiveConnectionSessionId('destackint');
    fetch('/api/tiktok/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: liveSessionId,
        gameId: 'destackint',
      }),
    }).catch(() => {});
    socket?.emit('disconnect-tiktok', {
      gameId: 'destackint',
      sessionId: liveSessionId,
    });
    setIsLiveConnected(false);
    setRoomId('');
  }, [socket]);

  const handleSimulateChat = useCallback(
    (data: { uniqueId: string; nickname: string; comment: string; profilePictureUrl: string }) => {
      touchActiveInteractiveStreamerSession();
      const msgId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      deduplicatorRef.current.shouldProcess('chat', { id: msgId });
      setIncomingChatQueue((prev) => [
        ...prev,
        {
          id: msgId,
          ...data,
        },
      ]);
      emitResilientEvent(socket, 'chat-message', {
        id: msgId,
        ...data,
        gameId: 'destackint',
        sessionId: getLiveConnectionSessionId('destackint'),
      });
    },
    [socket]
  );

  const handleConsumeChatQueue = useCallback(() => {
    setIncomingChatQueue([]);
  }, []);

  // Score calculation based on speed when a chat player guesses the current word
  const handleRecordCorrectChatAnswer = useCallback(
    (
      user: { uniqueId: string; nickname: string; profilePictureUrl: string },
      wordIndex: number,
      word: string,
      solveTimeSeconds: number,
      activeTimerDuration: TimerDuration,
      comment: string
    ) => {
      touchActiveInteractiveStreamerSession();
      const rawNick = (user.nickname || user.uniqueId || 'Player').trim().replace(/^@+/, '');
      const nameKey = normalizePlayerKey(rawNick);
      const rawIdKey = normalizePlayerKey(user.uniqueId);
      const cleanId =
        rawIdKey && rawIdKey !== 'viewer' ? rawIdKey : nameKey || 'viewer';

      const wordKey = `${roundIdRef.current}:${wordIndex}`;
      let solversForWord = creditedSolversByWordRef.current.get(wordKey);
      if (!solversForWord) {
        solversForWord = { ids: new Set<string>(), names: new Set<string>() };
        creditedSolversByWordRef.current.set(wordKey, solversForWord);
      }
      if (
        (cleanId !== 'viewer' && solversForWord.ids.has(cleanId)) ||
        (nameKey && solversForWord.names.has(nameKey))
      ) {
        return;
      }
      if (cleanId !== 'viewer') solversForWord.ids.add(cleanId);
      if (nameKey) solversForWord.names.add(nameKey);
      const rankInWord = Math.max(solversForWord.ids.size, solversForWord.names.size);

      // Speed score: Base 400 + up to 600 speed bonus based on remaining time ratio + podium bonus for 1st/2nd/3rd fastest on this word
      const timeRatio = Math.max(
        0,
        (activeTimerDuration - solveTimeSeconds) / Math.max(1, activeTimerDuration)
      );
      const speedBonus = Math.round(timeRatio * 600);
      const orderBonus =
        rankInWord === 1 ? 250 : rankInWord === 2 ? 150 : rankInWord === 3 ? 75 : 0;
      const pointsEarned = 400 + speedBonus + orderBonus;

      const pfp = getSafeAvatarUrl(user.profilePictureUrl, cleanId || rawNick);

      // Credit linked website account if viewer's TikTok @username is linked
      creditInteractiveScoreByTikTokHandle({
        tiktokUsername: user.uniqueId || rawNick,
        gameId: 'destackint',
        pointsEarned,
        reason: `DeStack Interactive word: ${word} (#${rankInWord}, ${solveTimeSeconds.toFixed(1)}s)`,
      });

      const now = Date.now();
      const newAnswerRecord = {
        wordIndex,
        word,
        points: pointsEarned,
        solveTimeSeconds,
        rankInWord,
        timestamp: now,
      };

      setChatFeed((feedPrev) => [
        ...feedPrev.slice(-99),
        {
          id: `${now}_${Math.random().toString(36).substring(2, 7)}`,
          uniqueId: cleanId,
          nickname: rawNick,
          profilePictureUrl: pfp,
          comment,
          isCorrectAnswer: true,
          pointsEarned,
          solveTimeSeconds,
          rankInWord,
          timestamp: now,
        },
      ]);

      const upsertPlayer = (
        prev: RunningScoreboardPlayer[],
        initRoundsWon: boolean
      ): RunningScoreboardPlayer[] => {
        const dedupedPrev = deduplicateScoreboardPlayers(prev);
        const existingIdx = dedupedPrev.findIndex((p) => {
          const pId = normalizePlayerKey(p.id);
          const pName = normalizePlayerKey(p.nickname);
          const idMatch =
            Boolean(cleanId && pId && cleanId !== 'viewer' && pId !== 'viewer' && pId === cleanId);
          const nameMatch = Boolean(nameKey && pName && pName === nameKey);
          return idMatch || nameMatch;
        });

        let updated: RunningScoreboardPlayer[];
        if (existingIdx >= 0) {
          const ex = dedupedPrev[existingIdx];
          const updatedPlayer: RunningScoreboardPlayer = {
            ...ex,
            nickname: rawNick || ex.nickname,
            profilePictureUrl: pfp || ex.profilePictureUrl,
            totalScore: ex.totalScore + pointsEarned,
            wordsSolved: ex.wordsSolved + 1,
            bestSpeedSeconds: Math.min(ex.bestSpeedSeconds, solveTimeSeconds),
            totalSpeedSeconds: ex.totalSpeedSeconds + solveTimeSeconds,
            lastPoints: pointsEarned,
            lastSolveTimeSeconds: solveTimeSeconds,
            lastWordIndex: wordIndex,
            firstPlaceCount: ex.firstPlaceCount + (rankInWord === 1 ? 1 : 0),
            answers: [newAnswerRecord, ...ex.answers].slice(0, 60),
            updatedAt: now,
          };
          updated = [...dedupedPrev];
          updated[existingIdx] = updatedPlayer;
        } else {
          const newPlayer: RunningScoreboardPlayer = {
            id: cleanId,
            nickname: rawNick,
            profilePictureUrl: pfp,
            totalScore: pointsEarned,
            wordsSolved: 1,
            bestSpeedSeconds: solveTimeSeconds,
            totalSpeedSeconds: solveTimeSeconds,
            lastPoints: pointsEarned,
            lastSolveTimeSeconds: solveTimeSeconds,
            lastWordIndex: wordIndex,
            firstPlaceCount: rankInWord === 1 ? 1 : 0,
            ...(initRoundsWon ? { roundsWon: 0 } : {}),
            answers: [newAnswerRecord],
            updatedAt: now,
          };
          updated = [newPlayer, ...dedupedPrev];
        }

        return deduplicateScoreboardPlayers(updated);
      };

      setScoreboard((prev) => upsertPlayer(prev, false));
      setOverallScoreboard((prev) => upsertPlayer(prev, true));
    },
    []
  );

  const handleRecordRegularChatMessage = useCallback(
    (data: { uniqueId: string; nickname: string; comment: string; profilePictureUrl: string }) => {
      const pfp = getSafeAvatarUrl(data.profilePictureUrl, data.uniqueId || data.nickname);
      setChatFeed((prev) => [
        ...prev.slice(-99),
        {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: pfp,
          comment: data.comment,
          isCorrectAnswer: false,
          timestamp: Date.now(),
        },
      ]);
    },
    []
  );

  const handleResetScoreboard = useCallback(() => {
    setScoreboard([]);
    setChatFeed([]);
    roundIdRef.current += 1;
    creditedSolversByWordRef.current.clear();
  }, []);

  const handleResetOverallScoreboard = useCallback(() => {
    setOverallScoreboard([]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(OVERALL_SCOREBOARD_STORAGE_KEY);
      } catch {}
    }
  }, []);

  const advanceToNextRound = useCallback(() => {
    if (!isOverlay) {
      const allowed = tryConsumeOrCheckNextRound(
        'destackint',
        `round-${roundIdRef.current}`
      );
      if (!allowed) return;
    }
    setVictoryData(null);
    setScoreboard([]);
    setChatFeed([]);
    roundIdRef.current += 1;
    creditedSolversByWordRef.current.clear();
    setPuzzleRoundNonce((prev) => prev + 1);
    setResetSignal((prev) => prev + 1);
    setCurrentView('PLAYING');
  }, [isOverlay]);

  const currentPuzzle = useMemo(() => {
    return generateDailyPuzzle(
      selectedDateStr,
      difficulty,
      layoutMode,
      puzzleRoundNonce,
      dictionaryLanguage
    );
  }, [selectedDateStr, difficulty, layoutMode, puzzleRoundNonce, dictionaryLanguage]);

  const isFirstRoundEffectRef = useRef(true);
  useEffect(() => {
    if (isOverlay) return;
    if (isFirstRoundEffectRef.current) {
      isFirstRoundEffectRef.current = false;
      return;
    }
    setVictoryData(null);
    setScoreboard([]);
    setChatFeed([]);
    roundIdRef.current += 1;
    creditedSolversByWordRef.current.clear();
  }, [
    isOverlay,
    selectedDateStr,
    difficulty,
    layoutMode,
    puzzleRoundNonce,
    resetSignal,
    dictionaryLanguage,
  ]);

  const hostOverlayPayload = useMemo<DeStackOverlayPayload>(
    () => ({
      puzzle: currentPuzzle,
      difficulty,
      layoutMode,
      timerDuration,
      scoreboard,
      victoryData,
      boardSnapshot: hostBoardSnapshot,
      tiktokUsername,
      isLiveConnected,
      resetSignal,
      puzzleRoundNonce,
    }),
    [
      currentPuzzle,
      difficulty,
      layoutMode,
      timerDuration,
      scoreboard,
      victoryData,
      hostBoardSnapshot,
      tiktokUsername,
      isLiveConnected,
      resetSignal,
      puzzleRoundNonce,
    ]
  );

  const handleSyncedOverlayState = useCallback((state: DeStackOverlayPayload) => {
    hasReceivedHostSyncRef.current = true;
    setSyncedOverlayPayload(state);
  }, []);

  const { isReceivingHostSync } = useOverlaySync<DeStackOverlayPayload>({
    gameId: 'destackint',
    streamer: isOverlay ? overlayStreamer || undefined : tiktokUsername || undefined,
    isOverlay,
    localState: isOverlay ? null : hostOverlayPayload,
    onSyncedState: handleSyncedOverlayState,
  });

  const effectivePuzzle =
    isOverlay && syncedOverlayPayload?.puzzle ? syncedOverlayPayload.puzzle : currentPuzzle;
  const effectiveDifficulty =
    isOverlay && syncedOverlayPayload?.difficulty ? syncedOverlayPayload.difficulty : difficulty;
  const effectiveLayoutMode =
    isOverlay && syncedOverlayPayload?.layoutMode ? syncedOverlayPayload.layoutMode : layoutMode;
  const effectiveTimerDuration =
    isOverlay && syncedOverlayPayload?.timerDuration
      ? syncedOverlayPayload.timerDuration
      : timerDuration;
  const effectiveScoreboard =
    isOverlay && syncedOverlayPayload?.scoreboard ? syncedOverlayPayload.scoreboard : scoreboard;
  const effectiveVictoryData = isOverlay
    ? syncedOverlayPayload
      ? syncedOverlayPayload.victoryData
      : victoryData
    : victoryData;
  const effectiveTiktokUsername =
    isOverlay && syncedOverlayPayload?.tiktokUsername
      ? syncedOverlayPayload.tiktokUsername
      : tiktokUsername;
  const effectiveIsLiveConnected =
    isOverlay && syncedOverlayPayload !== null
      ? syncedOverlayPayload.isLiveConnected
      : isLiveConnected;
  const effectiveResetSignal =
    isOverlay && typeof syncedOverlayPayload?.resetSignal === 'number'
      ? syncedOverlayPayload.resetSignal
      : resetSignal;
  const effectivePuzzleRoundNonce =
    isOverlay && typeof syncedOverlayPayload?.puzzleRoundNonce === 'number'
      ? syncedOverlayPayload.puzzleRoundNonce
      : puzzleRoundNonce;

  const handleVictory = (
    timeSeconds: number,
    hintsUsed: number,
    score: number,
    words: string[]
  ) => {
    const prevBestScore = Math.max(
      0,
      ...Object.values(stats.completedDays || {}).map((d) => d.score || 0),
      ...Object.values(stats.completedHardDays || {}).map((d) => d.score || 0)
    );
    const isNewBestScore = prevBestScore > 0 && score > prevBestScore;
    const isNewBestTime = stats.bestTimeSeconds < 9999 && timeSeconds < stats.bestTimeSeconds;

    setVictoryData({ timeSeconds, hintsUsed, score, words, difficulty });

    // Credit +1 Round Win strictly to this round's highest scorer (per-round scoreboard, NOT permanent standings)
    const completedRoundId = roundIdRef.current;
    if (!isOverlay) {
      recordInteractiveRoundCompleted('destackint', `round-${completedRoundId}`);
    }
    const roundWinner = deduplicateScoreboardPlayers(scoreboardRef.current)[0];
    if (roundWinner && !roundWinnerCreditedRef.current.has(completedRoundId)) {
      roundWinnerCreditedRef.current.add(completedRoundId);
      const winnerIdKey = normalizePlayerKey(roundWinner.id);
      const winnerNameKey = normalizePlayerKey(roundWinner.nickname);
      setOverallScoreboard((prev) =>
        deduplicateScoreboardPlayers(
          prev.map((p) => {
            const pId = normalizePlayerKey(p.id);
            const pName = normalizePlayerKey(p.nickname);
            const isMatch =
              (pId && winnerIdKey && pId !== 'viewer' && pId === winnerIdKey) ||
              (pName && winnerNameKey && pName === winnerNameKey);
            return isMatch ? { ...p, roundsWon: (p.roundsWon || 0) + 1 } : p;
          })
        )
      );
    }

    if (!isOverlay) {
      triggerVictoryConfetti({
        isDaily: selectedDateStr === todayDateStr,
        isNewHighScore: isNewBestScore || isNewBestTime,
      });
    }

    void saveUnifiedLeaderboardScore({
      user: currentUser,
      gameId: 'destack',
      score,
      puzzleId: `${selectedDateStr}_${difficulty}_int`,
      puzzleTitle: `DeStack Interactive ${selectedDateStr} (${difficulty === 'hard' ? 'Hard' : 'Standard'})`,
      metricLabel: `Interactive ${difficulty === 'hard' ? 'Hard (6-Layer)' : 'Standard (4-Layer)'} · ${timeSeconds}s`,
    });

    setStats((prev) => {
      const isHard = difficulty === 'hard';
      const isAlreadyCompleted = isHard
        ? !!prev.completedHardDays?.[selectedDateStr]
        : !!prev.completedDays[selectedDateStr];

      const completedDays: GameStats['completedDays'] = isHard
        ? prev.completedDays
        : {
            ...prev.completedDays,
            [selectedDateStr]: { timeSeconds, hintsUsed, score, difficulty: 'normal' as const },
          };

      const completedHardDays: NonNullable<GameStats['completedHardDays']> = isHard
        ? {
            ...(prev.completedHardDays || {}),
            [selectedDateStr]: { timeSeconds, hintsUsed, score, difficulty: 'hard' as const },
          }
        : prev.completedHardDays || {};

      const gamesPlayed = isAlreadyCompleted ? prev.gamesPlayed : prev.gamesPlayed + 1;
      const gamesWon = isAlreadyCompleted ? prev.gamesWon : prev.gamesWon + 1;
      const currentStreak = isAlreadyCompleted ? prev.currentStreak : prev.currentStreak + 1;
      const maxStreak = Math.max(prev.maxStreak, currentStreak);
      const bestTimeSeconds = Math.min(prev.bestTimeSeconds, timeSeconds);
      const totalHintsUsed = prev.totalHintsUsed + hintsUsed;

      return {
        gamesPlayed,
        gamesWon,
        currentStreak,
        maxStreak,
        bestTimeSeconds,
        totalHintsUsed,
        completedDays,
        completedHardDays,
      };
    });
  };

  const overlayBoardOverlay =
    isOverlay && effectiveVictoryData ? (
      <RoundScoreboardModal
        dateStr={selectedDateStr}
        difficulty={effectiveVictoryData.difficulty}
        words={effectiveVictoryData.words}
        scoreboard={effectiveScoreboard}
        setCurrentView={setCurrentView}
        onAutoAdvance={() => {}}
        onPlayAgain={() => {}}
        onPlayHardMode={() => {}}
        isOverlay={true}
      />
    ) : null;

  const hostBoardOverlay =
    !isOverlay && victoryData ? (
      <RoundScoreboardModal
        dateStr={selectedDateStr}
        difficulty={victoryData.difficulty}
        words={victoryData.words}
        scoreboard={scoreboard}
        setCurrentView={(view) => {
          setVictoryData(null);
          setScoreboard([]);
          setChatFeed([]);
          roundIdRef.current += 1;
          creditedSolversByWordRef.current.clear();
          setCurrentView(view);
        }}
        onAutoAdvance={advanceToNextRound}
        onPlayAgain={() => {
          advanceToNextRound();
        }}
        onPlayHardMode={() => {
          setVictoryData(null);
          setScoreboard([]);
          setChatFeed([]);
          roundIdRef.current += 1;
          creditedSolversByWordRef.current.clear();
          setDifficulty('hard');
          setPuzzleRoundNonce((prev) => prev + 1);
          setResetSignal((prev) => prev + 1);
          setCurrentView('PLAYING');
        }}
        onOpenOverallScoreboard={() => setIsOverallScoreboardOpen(true)}
        isOverlay={false}
      />
    ) : null;

  if (isOverlay) {
    return (
      <div
        className={`relative min-h-screen flex flex-col font-sans overflow-hidden ${
          overlayBg === 'transparent'
            ? 'bg-transparent text-purple-50'
            : 'bg-[#15041c] text-purple-50'
        }`}
      >
        <main className="relative z-10 flex-1 flex flex-col">
          <GameBoard
            puzzle={effectivePuzzle}
            difficulty={effectiveDifficulty}
            onChangeDifficulty={(mode) => setDifficulty(mode)}
            layoutMode={effectiveLayoutMode}
            onChangeLayoutMode={setLayoutMode}
            onVictory={handleVictory}
            setCurrentView={setCurrentView}
            onOpenHowToPlay={() => {}}
            timerDuration={effectiveTimerDuration}
            onChangeTimerDuration={setTimerDuration}
            tiktokUsername={effectiveTiktokUsername}
            isLiveConnected={effectiveIsLiveConnected}
            roomId={roomId}
            scoreboard={effectiveScoreboard}
            chatFeed={chatFeed}
            onRecordCorrectChatAnswer={handleRecordCorrectChatAnswer}
            onRecordRegularChatMessage={handleRecordRegularChatMessage}
            onOpenConnectModal={() => {}}
            onResetScoreboard={handleResetScoreboard}
            onSimulateChat={handleSimulateChat}
            incomingChatQueue={incomingChatQueue}
            onConsumeChatQueue={handleConsumeChatQueue}
            resetSignal={effectiveResetSignal}
            puzzleRoundNonce={effectivePuzzleRoundNonce}
            isOverlay={true}
            overlayBg={overlayBg}
            hasHostSync={isReceivingHostSync}
            syncedBoardState={syncedOverlayPayload?.boardSnapshot || null}
            overlayVictoryData={effectiveVictoryData}
            boardOverlay={overlayBoardOverlay}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#faf7fc] dark:bg-[#15041c] text-[#2d0938] dark:text-purple-50 flex flex-col font-sans transition-colors overflow-x-hidden">
      {/* Tiled Icon across background with 25% opacity */}
      <div
        aria-hidden="true"
        style={{
          backgroundImage: "url('/assets/aistudio/3d_logo_944e5372.png')",
          backgroundRepeat: 'repeat',
          backgroundSize: '88px 88px',
        }}
        className="fixed inset-0 opacity-25 pointer-events-none z-0"
      />

      <Header
        currentView={currentView}
        setCurrentView={(view) => {
          if (view === 'HOW_TO_PLAY') {
            setShowHowToPlay(true);
          } else {
            setCurrentView(view);
          }
        }}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        todayDateStr={todayDateStr}
        selectedDateStr={selectedDateStr}
        onSelectDate={(date) => setSelectedDateStr(date)}
        stats={stats}
        isLiveConnected={isLiveConnected}
        tiktokUsername={tiktokUsername}
        onOpenTikTokModal={() => setIsConnectModalOpen(true)}
        currentUser={currentUser}
        onOpenSignIn={openSignInModal}
        onOpenUnifiedLeaderboard={openUnifiedLeaderboardModal}
      />

      <main className="relative z-10 flex-1 flex flex-col">
        {currentView === 'TITLE' && (
          <TitleMenu
            setCurrentView={setCurrentView}
            todayDateStr={todayDateStr}
            stats={stats}
            onSelectDate={(date) => setSelectedDateStr(date)}
            difficulty={difficulty}
            onSelectDifficulty={(mode) => setDifficulty(mode)}
            layoutMode={layoutMode}
            onChangeLayoutMode={setLayoutMode}
            currentUser={currentUser}
            isLiveConnected={isLiveConnected}
            tiktokUsername={tiktokUsername}
            onOpenTikTokModal={() => setIsConnectModalOpen(true)}
            onOpenSignIn={openSignInModal}
            onOpenUnifiedLeaderboard={openUnifiedLeaderboardModal}
          />
        )}

        {currentView === 'PLAYING' && (
          <GameBoard
            puzzle={currentPuzzle}
            difficulty={difficulty}
            onChangeDifficulty={(mode) => setDifficulty(mode)}
            layoutMode={layoutMode}
            onChangeLayoutMode={setLayoutMode}
            onVictory={handleVictory}
            setCurrentView={setCurrentView}
            onOpenHowToPlay={() => setShowHowToPlay(true)}
            timerDuration={timerDuration}
            onChangeTimerDuration={setTimerDuration}
            tiktokUsername={tiktokUsername}
            isLiveConnected={isLiveConnected}
            roomId={roomId}
            scoreboard={scoreboard}
            chatFeed={chatFeed}
            onRecordCorrectChatAnswer={handleRecordCorrectChatAnswer}
            onRecordRegularChatMessage={handleRecordRegularChatMessage}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onResetScoreboard={handleResetScoreboard}
            onSimulateChat={handleSimulateChat}
            incomingChatQueue={incomingChatQueue}
            onConsumeChatQueue={handleConsumeChatQueue}
            resetSignal={resetSignal}
            puzzleRoundNonce={puzzleRoundNonce}
            onBoardStateChange={setHostBoardSnapshot}
            onRoundReset={() => {
              setVictoryData(null);
              handleResetScoreboard();
              setResetSignal((prev) => prev + 1);
            }}
            overallScoreboardCount={overallScoreboard.length}
            onOpenOverallScoreboard={() => setIsOverallScoreboardOpen(true)}
            boardOverlay={hostBoardOverlay}
          />
        )}

        {currentView === 'ARCHIVE' && (
          <ArchiveModal
            setCurrentView={setCurrentView}
            onSelectDate={(date) => setSelectedDateStr(date)}
            stats={stats}
            todayDateStr={todayDateStr}
            selectedDateStr={selectedDateStr}
          />
        )}

        {currentView === 'LEADERBOARD' && (
          <LeaderboardModal
            setCurrentView={setCurrentView}
            stats={stats}
            scoreboard={scoreboard}
            overallScoreboard={overallScoreboard}
            currentUser={currentUser}
            onOpenSignIn={openSignInModal}
          />
        )}

        {currentView === 'STATS' && (
          <StatsModal setCurrentView={setCurrentView} stats={stats} />
        )}
      </main>

      {/* Modals */}
      {(currentView === 'HOW_TO_PLAY' || showHowToPlay) && (
        <HowToPlayModal
          onClose={() => {
            setShowHowToPlay(false);
            if (currentView === 'HOW_TO_PLAY') {
              setCurrentView('PLAYING');
            }
          }}
        />
      )}

      <TikTokConnectModal
        isOpen={isConnectModalOpen}
        isConnected={isLiveConnected}
        currentUsername={tiktokUsername}
        roomId={roomId}
        tiktokError={tiktokError}
        timerDuration={timerDuration}
        onChangeTimerDuration={setTimerDuration}
        onClose={() => setIsConnectModalOpen(false)}
        onConnect={handleConnectTikTok}
        onReconnect={handleReconnectTikTok}
        onDisconnect={handleDisconnectTikTok}
        onOpenSimulator={() => {
          setIsConnectModalOpen(false);
          setCurrentView('PLAYING');
        }}
      />

      <OverallScoreboardModal
        isOpen={isOverallScoreboardOpen}
        overallScoreboard={overallScoreboard}
        onClose={() => setIsOverallScoreboardOpen(false)}
        onResetOverallScoreboard={handleResetOverallScoreboard}
      />

      <UnifiedAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        user={currentUser}
        initialGameId="destack"
        initialTab={authModalTab}
      />
    </div>
  );
}
