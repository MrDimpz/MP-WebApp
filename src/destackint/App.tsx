import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  GameState,
  GameStats,
  DifficultyMode,
  TimerDuration,
  RunningScoreboardPlayer,
  LiveChatItem,
} from './types';
import { getLondonDateString, generateDailyPuzzle } from './utils/puzzles';
import { getSafeAvatarUrl } from './utils/avatar';
import { Header } from './components/Header';
import { TitleMenu } from './components/TitleMenu';
import { GameBoard } from './components/GameBoard';
import { RoundScoreboardModal } from './components/RoundScoreboardModal';
import { TikTokConnectModal } from './components/TikTokConnectModal';
import { ArchiveModal } from './components/ArchiveModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { StatsModal } from './components/StatsModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import {
  useUnifiedAuth,
  saveUnifiedLeaderboardScore,
  creditInteractiveScoreByTikTokHandle,
  getCurrentUserSessionPrefix,
} from '@/lib/unified-game-auth';
import {
  getActiveInteractiveStreamerSession,
  touchActiveInteractiveStreamerSession,
} from '@/lib/interactive-key-auth';
import { emitResilientEvent } from '@/lib/live-chat-bridge';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';
import './index.css';

const STATS_STORAGE_KEY = 'destackint_game_stats_v1';
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
  const [currentView, setCurrentView] = useState<GameState>('TITLE');
  const [todayDateStr] = useState<string>(() => getLondonDateString());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => getLondonDateString());
  const [difficulty, setDifficulty] = useState<DifficultyMode>('normal');
  const [timerDuration, setTimerDuration] = useState<TimerDuration>(30);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
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

  // Save stats
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
      } catch {}
    }
  }, [stats]);

  // Sync dark mode class on root html
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Connect to persistent Socket.IO server scoped to isolated streamer session & destackint game
  useEffect(() => {
    const newSocket = io({
      query: {
        sessionId: getCurrentUserSessionPrefix(),
        gameId: 'destackint',
      },
    });
    setSocket(newSocket);

    newSocket.on(
      'tiktok-connected',
      ({ username, roomId: rId, gameId }: { username: string; roomId?: string; gameId?: string }) => {
        if (!gameId || gameId === 'destackint') {
          setIsLiveConnected(true);
          setTiktokUsername(username.replace(/^@+/, ''));
          setRoomId(rId || '');
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
      setTiktokError(msg || 'Failed to connect to TikTok Live');
      setIsLiveConnected(false);
    });

    newSocket.on('tiktok-disconnected', (payload?: { gameId?: string }) => {
      if (!payload?.gameId || payload.gameId === 'destackint') {
        setIsLiveConnected(false);
        setRoomId('');
      }
    });

    newSocket.on('chat-message', (data: any) => {
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
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleConnectTikTok = useCallback(
    (username: string, isTestMode?: boolean) => {
      const clean = username.trim().replace(/^@+/, '') || 'test_streamer';
      setTiktokUsername(clean);
      setTiktokError(null);
      try {
        localStorage.setItem(TIKTOK_USER_STORAGE_KEY, clean);
      } catch {}

      if (isTestMode) {
        setIsLiveConnected(true);
        setRoomId('TEST_SIMULATION_ROOM');
      } else {
        socket?.emit('connect-tiktok', {
          username: clean,
          gameId: 'destackint',
          sessionId: getCurrentUserSessionPrefix(),
        });
      }
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
      if (isTestMode) {
        setIsLiveConnected(true);
        setRoomId('TEST_SIMULATION_ROOM');
      } else {
        socket?.emit('connect-tiktok', {
          username: clean,
          gameId: 'destackint',
          sessionId: getCurrentUserSessionPrefix(),
        });
      }
      setIsConnectModalOpen(false);
    },
    [socket, tiktokUsername]
  );

  const handleDisconnectTikTok = useCallback(() => {
    socket?.emit('disconnect-tiktok', {
      gameId: 'destackint',
      sessionId: getCurrentUserSessionPrefix(),
    });
    setIsLiveConnected(false);
    setRoomId('');
  }, [socket]);

  const handleSimulateChat = useCallback(
    (data: { uniqueId: string; nickname: string; comment: string; profilePictureUrl: string }) => {
      touchActiveInteractiveStreamerSession();
      if (socket && socket.connected && roomId !== 'TEST_SIMULATION_ROOM') {
        void emitResilientEvent(socket, 'chat-message', data);
      } else {
        setIncomingChatQueue((prev) => [
          ...prev,
          {
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            ...data,
          },
        ]);
      }
    },
    [socket, roomId]
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
      const pfp = getSafeAvatarUrl(user.profilePictureUrl, user.uniqueId || user.nickname);

      setScoreboard((prev) => {
        const existingIdx = prev.findIndex((p) => p.id === user.uniqueId);
        if (existingIdx >= 0 && prev[existingIdx].answers.some((a) => a.wordIndex === wordIndex)) {
          return prev;
        }

        // Count how many players have already solved this specific wordIndex
        const existingSolversForWord = prev.filter((p) =>
          p.answers.some((a) => a.wordIndex === wordIndex)
        ).length;
        const rankInWord = existingSolversForWord + 1;

        // Speed score: Base 400 + up to 600 speed bonus based on remaining time ratio + podium bonus for 1st/2nd/3rd fastest on this word
        const timeRatio = Math.max(
          0,
          (activeTimerDuration - solveTimeSeconds) / activeTimerDuration
        );
        const speedBonus = Math.round(timeRatio * 600);
        const orderBonus =
          rankInWord === 1 ? 250 : rankInWord === 2 ? 150 : rankInWord === 3 ? 75 : 0;
        const pointsEarned = 400 + speedBonus + orderBonus;

        // Credit linked website account if viewer's TikTok @username is linked
        creditInteractiveScoreByTikTokHandle({
          tiktokUsername: user.uniqueId || user.nickname,
          gameId: 'destackint',
          pointsEarned,
          reason: `DeStack Interactive word: ${word} (#${rankInWord}, ${solveTimeSeconds.toFixed(1)}s)`,
        });

        // Also append to chat feed with earned points & rank
        setChatFeed((feedPrev) => [
          ...feedPrev.slice(-99),
          {
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            uniqueId: user.uniqueId,
            nickname: user.nickname,
            profilePictureUrl: pfp,
            comment,
            isCorrectAnswer: true,
            pointsEarned,
            solveTimeSeconds,
            rankInWord,
            timestamp: Date.now(),
          },
        ]);

        const newAnswerRecord = {
          wordIndex,
          word,
          points: pointsEarned,
          solveTimeSeconds,
          rankInWord,
          timestamp: Date.now(),
        };

        let updated: RunningScoreboardPlayer[];
        if (existingIdx >= 0) {
          const ex = prev[existingIdx];
          const updatedPlayer: RunningScoreboardPlayer = {
            ...ex,
            nickname: user.nickname,
            profilePictureUrl: pfp || ex.profilePictureUrl,
            totalScore: ex.totalScore + pointsEarned,
            wordsSolved: ex.wordsSolved + 1,
            bestSpeedSeconds: Math.min(ex.bestSpeedSeconds, solveTimeSeconds),
            totalSpeedSeconds: ex.totalSpeedSeconds + solveTimeSeconds,
            lastPoints: pointsEarned,
            lastSolveTimeSeconds: solveTimeSeconds,
            lastWordIndex: wordIndex,
            firstPlaceCount: ex.firstPlaceCount + (rankInWord === 1 ? 1 : 0),
            answers: [newAnswerRecord, ...ex.answers],
            updatedAt: Date.now(),
          };
          updated = [...prev];
          updated[existingIdx] = updatedPlayer;
        } else {
          const newPlayer: RunningScoreboardPlayer = {
            id: user.uniqueId,
            nickname: user.nickname,
            profilePictureUrl: pfp,
            totalScore: pointsEarned,
            wordsSolved: 1,
            bestSpeedSeconds: solveTimeSeconds,
            totalSpeedSeconds: solveTimeSeconds,
            lastPoints: pointsEarned,
            lastSolveTimeSeconds: solveTimeSeconds,
            lastWordIndex: wordIndex,
            firstPlaceCount: rankInWord === 1 ? 1 : 0,
            answers: [newAnswerRecord],
            updatedAt: Date.now(),
          };
          updated = [newPlayer, ...prev];
        }

        return updated.sort(
          (a, b) =>
            b.totalScore - a.totalScore ||
            b.wordsSolved - a.wordsSolved ||
            a.bestSpeedSeconds - b.bestSpeedSeconds
        );
      });
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
  }, []);

  const currentPuzzle = generateDailyPuzzle(selectedDateStr, difficulty);

  const handleVictory = (
    timeSeconds: number,
    hintsUsed: number,
    score: number,
    words: string[]
  ) => {
    setVictoryData({ timeSeconds, hintsUsed, score, words, difficulty });

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

  return (
    <div className="relative min-h-screen bg-[#faf7fc] dark:bg-[#15041c] text-[#2d0938] dark:text-purple-50 flex flex-col font-sans transition-colors overflow-x-hidden">
      {/* Tiled Icon across background with 20% opacity */}
      <div
        aria-hidden="true"
        style={{
          backgroundImage: "url('/assets/aistudio/3d_logo_944e5372.png')",
          backgroundRepeat: 'repeat',
          backgroundSize: '88px 88px',
        }}
        className="fixed inset-0 opacity-20 pointer-events-none z-0"
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

      {victoryData && (
        <RoundScoreboardModal
          dateStr={selectedDateStr}
          difficulty={victoryData.difficulty}
          words={victoryData.words}
          scoreboard={scoreboard}
          setCurrentView={(view) => {
            setVictoryData(null);
            setCurrentView(view);
          }}
          onPlayAgain={(resetScores) => {
            if (resetScores) {
              setScoreboard([]);
              setChatFeed([]);
            }
            setVictoryData(null);
            setResetSignal((prev) => prev + 1);
            setCurrentView('PLAYING');
          }}
          onPlayHardMode={() => {
            setVictoryData(null);
            setDifficulty('hard');
            setResetSignal((prev) => prev + 1);
            setCurrentView('PLAYING');
          }}
        />
      )}

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
