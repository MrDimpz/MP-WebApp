import React, { useState, useEffect, useMemo } from 'react';
import { GameState, GameStats, DifficultyMode, LayoutSelection } from './types';
import { getLondonDateString, generateDailyPuzzle } from './utils/puzzles';
import { Header } from './components/Header';
import { TitleMenu } from './components/TitleMenu';
import { GameBoard } from './components/GameBoard';
import { VictoryModal } from './components/VictoryModal';
import { ArchiveModal } from './components/ArchiveModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { StatsModal } from './components/StatsModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import {
  useUnifiedAuth,
  saveUnifiedLeaderboardScore,
} from '@/lib/unified-game-auth';
import { recordDailyPuzzleSolved } from '@/lib/daily-streak';
import { triggerVictoryConfetti } from '@/lib/confetti';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';
import './index.css';

const STATS_STORAGE_KEY = 'destack_game_stats_v1';

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
  const [layoutSelection, setLayoutSelection] = useState<LayoutSelection>('daily');

  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  // Unified Solo Games Auth & Leaderboard Modal State
  const { user: currentUser } = useUnifiedAuth();
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'account' | 'leaderboards'>('leaderboards');

  const openSignInModal = () => {
    setAuthModalTab('account');
    setShowAuthModal(true);
  };

  const openUnifiedLeaderboardModal = () => {
    setAuthModalTab('leaderboards');
    setShowAuthModal(true);
  };

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
    layoutName: string;
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

  const currentPuzzle = useMemo(
    () => generateDailyPuzzle(selectedDateStr, difficulty, layoutSelection),
    [selectedDateStr, difficulty, layoutSelection]
  );

  const handleVictory = (timeSeconds: number, hintsUsed: number, score: number, words: string[]) => {
    const prevBestScore = Math.max(
      0,
      ...Object.values(stats.completedDays || {}).map((d) => d.score || 0),
      ...Object.values(stats.completedHardDays || {}).map((d) => d.score || 0)
    );
    const isNewBestScore = prevBestScore > 0 && score > prevBestScore;
    const isNewBestTime = stats.bestTimeSeconds < 9999 && timeSeconds < stats.bestTimeSeconds;
    const isDailyToday = selectedDateStr === todayDateStr;

    setVictoryData({
      timeSeconds,
      hintsUsed,
      score,
      words,
      difficulty,
      layoutName: currentPuzzle.layoutName,
    });

    if (isDailyToday) {
      recordDailyPuzzleSolved('destack', todayDateStr);
    }

    triggerVictoryConfetti({
      isDaily: isDailyToday && layoutSelection === 'daily',
      isNewHighScore: isNewBestScore || isNewBestTime,
    });

    void saveUnifiedLeaderboardScore({
      user: currentUser,
      gameId: 'destack',
      score,
      puzzleId: `${selectedDateStr}_${difficulty}_${currentPuzzle.layoutId}`,
      puzzleTitle: `DeStack ${selectedDateStr} (${difficulty === 'hard' ? 'Hard' : 'Standard'} · ${currentPuzzle.layoutName})`,
      metricLabel: `${difficulty === 'hard' ? 'Hard (6-Layer)' : 'Standard (4-Layer)'} · ${currentPuzzle.layoutName} · ${timeSeconds}s`,
    });

    setStats(prev => {
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
            layoutSelection={layoutSelection}
            onSelectLayout={(layout) => setLayoutSelection(layout)}
            currentUser={currentUser}
            onOpenSignIn={openSignInModal}
            onOpenUnifiedLeaderboard={openUnifiedLeaderboardModal}
          />
        )}

        {currentView === 'PLAYING' && (
          <GameBoard
            puzzle={currentPuzzle}
            difficulty={difficulty}
            onChangeDifficulty={(mode) => setDifficulty(mode)}
            layoutSelection={layoutSelection}
            onChangeLayout={(layout) => setLayoutSelection(layout)}
            onVictory={handleVictory}
            setCurrentView={setCurrentView}
            onOpenHowToPlay={() => setShowHowToPlay(true)}
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
            currentUser={currentUser}
            onOpenSignIn={openSignInModal}
            onOpenUnifiedLeaderboard={openUnifiedLeaderboardModal}
          />
        )}

        {currentView === 'STATS' && (
          <StatsModal
            setCurrentView={setCurrentView}
            stats={stats}
          />
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

      {victoryData && (
        <VictoryModal
          dateStr={selectedDateStr}
          difficulty={victoryData.difficulty}
          layoutName={victoryData.layoutName}
          timeSeconds={victoryData.timeSeconds}
          hintsUsed={victoryData.hintsUsed}
          score={victoryData.score}
          words={victoryData.words}
          setCurrentView={(view) => {
            setVictoryData(null);
            setCurrentView(view);
          }}
          onPlayHardMode={() => {
            setVictoryData(null);
            setDifficulty('hard');
            setCurrentView('PLAYING');
          }}
          currentUser={currentUser}
          onOpenSignIn={() => {
            setVictoryData(null);
            openSignInModal();
          }}
          onOpenUnifiedLeaderboard={() => {
            setVictoryData(null);
            openUnifiedLeaderboardModal();
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
