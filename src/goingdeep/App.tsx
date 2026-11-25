import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { ActiveTab, Header } from './components/Header';
import { FinalBoard } from './components/FinalBoard';
import { ArchiveView } from './components/ArchiveView';
import {
  LetterLockGame,
  SiblingKeyItem,
} from './components/minigames/LetterLockGame';
import { AnagramGame } from './components/minigames/AnagramGame';
import { CrosswordGame } from './components/minigames/CrosswordGame';
import { WordSearchGame } from './components/minigames/WordSearchGame';
import { HowToPlayModal } from './components/HowToPlayModal';
import { StatsModal } from './components/StatsModal';
import { ResultsModal } from './components/ResultsModal';
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  formatCountdown,
  generateDailyPuzzle,
  getDailyNumber,
  getMillisecondsUntilMidnight,
  getProgressKey,
  getRecentDateKeys,
  getTierForWord,
  getTodayDateKey,
  MINI_GAME_META,
  TIER_ORDER,
} from './data/dailyGenerator';
import {
  DifficultyLevel,
  GameStats,
  MiniGameType,
  PuzzleProgress,
  TierId,
} from './types';
import {
  computeGoingDeepScore,
  createInitialProgress,
  formatTime,
  loadAllProgress,
  loadPrefs,
  loadStats,
  saveAllProgress,
  savePrefs,
  saveStats,
} from './utils/storage';
import { sound } from './utils/sound';
import { useSiteTheme } from '@/lib/site-theme';
import {
  saveUnifiedLeaderboardScore,
  useUnifiedAuth,
} from '@/lib/unified-game-auth';
import { CLOUD_HYDRATED_EVENT } from '@/lib/cloud-progress';
import { recordDailyPuzzleSolved, useDailyStreak } from '@/lib/daily-streak';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';

const ARCHIVE_DAY_COUNT = 14;

export default function GoingDeepApp() {
  const { user } = useUnifiedAuth();
  const { darkMode, toggleDarkMode } = useSiteTheme();

  const initialPrefs = useMemo(() => loadPrefs(), []);
  const [todayDateKey, setTodayDateKey] = useState<string>(() =>
    getTodayDateKey()
  );
  const [countdownMs, setCountdownMs] = useState<number>(() =>
    getMillisecondsUntilMidnight()
  );

  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    initialPrefs.soundEnabled
  );
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(
    initialPrefs.difficulty
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('play');
  const [currentDateKey, setCurrentDateKey] = useState<string>(() =>
    getTodayDateKey()
  );
  const [activeMiniGameKeyId, setActiveMiniGameKeyId] = useState<string | null>(
    null
  );

  const loadHydratedProgressMap = useCallback((diff: DifficultyLevel) => {
    const saved = loadAllProgress();
    const todayKey = getTodayDateKey();
    const firstPuzzle = generateDailyPuzzle(todayKey, diff);
    const firstKey = getProgressKey(firstPuzzle.dateKey, firstPuzzle.difficulty);
    if (!saved[firstKey]) {
      saved[firstKey] = createInitialProgress(firstPuzzle);
    }
    return saved;
  }, []);

  const [progressMap, setProgressMap] = useState<Record<string, PuzzleProgress>>(
    () => loadHydratedProgressMap(initialPrefs.difficulty)
  );
  const [stats, setStats] = useState<GameStats>(() => loadStats());

  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [shakingWords, setShakingWords] = useState<string[]>([]);
  const [recentlyUnlockedKeyId, setRecentlyUnlockedKeyId] = useState<
    string | null
  >(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'account' | 'leaderboards'>(
    'leaderboards'
  );

  const toastTimerRef = useRef<number | null>(null);
  const isInitialMountRef = useRef(true);

  const recentDateKeys = useMemo(
    () => getRecentDateKeys(ARCHIVE_DAY_COUNT),
    [todayDateKey]
  );

  const currentPuzzle = useMemo(
    () => generateDailyPuzzle(currentDateKey, difficulty),
    [currentDateKey, difficulty]
  );

  const currentProgressKey = getProgressKey(currentDateKey, difficulty);

  const currentProgress = useMemo<PuzzleProgress>(() => {
    return (
      progressMap[currentProgressKey] ?? createInitialProgress(currentPuzzle)
    );
  }, [currentProgressKey, currentPuzzle, progressMap]);

  const activeMiniGameInstance = useMemo(() => {
    if (!activeMiniGameKeyId) return null;
    return (
      currentPuzzle.miniGames.find((mg) => mg.keyId === activeMiniGameKeyId) ??
      null
    );
  }, [activeMiniGameKeyId, currentPuzzle.miniGames]);

  const solvedToday = useMemo(() => {
    return DIFFICULTY_ORDER.some(
      (lvl) =>
        progressMap[getProgressKey(todayDateKey, lvl)]?.status === 'won'
    );
  }, [progressMap, todayDateKey]);

  const dailyStreak = useDailyStreak(
    'goingdeep',
    todayDateKey,
    solvedToday,
    stats.currentStreak
  );

  // Reload per-user progress & stats on sign-in/out or cloud hydration
  useEffect(() => {
    const refreshFromStorage = () => {
      setProgressMap(loadHydratedProgressMap(difficulty));
      setStats(loadStats());
    };
    refreshFromStorage();
    window.addEventListener(CLOUD_HYDRATED_EVENT, refreshFromStorage);
    return () =>
      window.removeEventListener(CLOUD_HYDRATED_EVENT, refreshFromStorage);
  }, [user?.uid, difficulty, loadHydratedProgressMap]);

  // Live midnight countdown & automatic new-day detection
  useEffect(() => {
    const tick = window.setInterval(() => {
      setCountdownMs(getMillisecondsUntilMidnight());
      const nowKey = getTodayDateKey();
      if (nowKey !== todayDateKey) {
        setTodayDateKey(nowKey);
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [todayDateKey]);

  // Sync audio & local preferences
  useEffect(() => {
    sound.setEnabled(soundEnabled);
    savePrefs({ soundEnabled, difficulty });
  }, [soundEnabled, difficulty]);

  // Persist progressMap (skip writing on initial mount before hydration settles)
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    saveAllProgress(progressMap, stats);
  }, [progressMap, stats]);

  // Active puzzle elapsed timer
  useEffect(() => {
    if (
      activeTab !== 'play' ||
      currentProgress.status !== 'in_progress' ||
      showHowToPlay ||
      showStats ||
      authModalOpen
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      setProgressMap((prev) => {
        const pKey = getProgressKey(currentDateKey, difficulty);
        const existing =
          prev[pKey] ??
          createInitialProgress(generateDailyPuzzle(currentDateKey, difficulty));
        if (existing.status !== 'in_progress') return prev;
        return {
          ...prev,
          [pKey]: {
            ...existing,
            elapsedSeconds: existing.elapsedSeconds + 1,
          },
        };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [
    activeTab,
    authModalOpen,
    currentDateKey,
    currentProgress.status,
    difficulty,
    showHowToPlay,
    showStats,
  ]);

  const showToast = useCallback((msg: string, duration = 2200) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, duration);
  }, []);

  const updateCurrentProgress = useCallback(
    (updater: (prev: PuzzleProgress) => PuzzleProgress) => {
      setProgressMap((prevMap) => {
        const current =
          prevMap[currentProgressKey] ?? createInitialProgress(currentPuzzle);
        return {
          ...prevMap,
          [currentProgressKey]: updater(current),
        };
      });
    },
    [currentProgressKey, currentPuzzle]
  );

  const recordFinishedStats = useCallback(
    (finalProgress: PuzzleProgress) => {
      const puzzle = generateDailyPuzzle(
        finalProgress.dateKey,
        finalProgress.difficulty
      );
      const won = finalProgress.status === 'won';
      const mistakesUsed =
        finalProgress.maxMistakes - finalProgress.mistakesRemaining;
      const totalHints = puzzle.miniGames.reduce(
        (sum, mg) => sum + (finalProgress.miniGames[mg.keyId]?.hintsUsed ?? 0),
        0
      );
      const cleanKeys = puzzle.miniGames.filter(
        (mg) => finalProgress.miniGames[mg.keyId]?.status === 'solved'
      ).length;
      const allKeysClean = cleanKeys === puzzle.miniGames.length;

      setStats((prev) => {
        const nextStreak = won ? prev.currentStreak + 1 : 0;
        const nextDist: [number, number, number, number, number] = [
          ...prev.mistakeDistribution,
        ];
        if (won && mistakesUsed >= 0 && mistakesUsed <= 4) {
          nextDist[mistakesUsed] += 1;
        }
        const nextMini = { ...prev.miniGamesSolved };
        puzzle.miniGames.forEach((mg) => {
          if (finalProgress.miniGames[mg.keyId]?.status === 'solved') {
            nextMini[mg.type] += 1;
          }
        });
        const nextWinsByDiff = { ...prev.winsByDifficulty };
        if (won) {
          nextWinsByDiff[finalProgress.difficulty] += 1;
        }

        const nextStats: GameStats = {
          played: prev.played + 1,
          won: prev.won + (won ? 1 : 0),
          currentStreak: nextStreak,
          maxStreak: Math.max(prev.maxStreak, nextStreak),
          perfectGames:
            prev.perfectGames +
            (won && mistakesUsed === 0 && totalHints === 0 && allKeysClean
              ? 1
              : 0),
          mistakeDistribution: nextDist,
          miniGamesSolved: nextMini,
          winsByDifficulty: nextWinsByDiff,
        };
        saveStats(nextStats);
        return nextStats;
      });

      if (won) {
        recordDailyPuzzleSolved('goingdeep', finalProgress.dateKey, 1);

        if (user) {
          const score = computeGoingDeepScore(puzzle, finalProgress);
          const diffMeta = DIFFICULTIES[puzzle.difficulty];
          void saveUnifiedLeaderboardScore({
            user,
            gameId: 'goingdeep',
            puzzleId: `goingdeep_${finalProgress.dateKey}_${finalProgress.difficulty}`,
            puzzleTitle: `Going Deep #${puzzle.id} (${diffMeta.label})`,
            score,
            metricLabel: `${score.toLocaleString()} pts (${cleanKeys}/${puzzle.miniGames.length} keys)`,
            subMetricLabel: `${diffMeta.label} · ${mistakesUsed} mistakes · ${formatTime(finalProgress.elapsedSeconds)}`,
          });
        }
      }
    },
    [user]
  );

  const handleCompleteMiniGame = useCallback(
    (keyId: string, mode: 'solved' | 'revealed', hintsUsed: number) => {
      updateCurrentProgress((prev) => {
        const existing = prev.miniGames[keyId];
        if (!existing || existing.status !== 'locked') return prev;
        return {
          ...prev,
          miniGames: {
            ...prev.miniGames,
            [keyId]: {
              ...existing,
              status: mode,
              hintsUsed,
            },
          },
        };
      });
      setRecentlyUnlockedKeyId(keyId);
      window.setTimeout(() => setRecentlyUnlockedKeyId(null), 1600);
    },
    [updateCurrentProgress]
  );

  const handleUpdateLetterLockGuesses = useCallback(
    (keyId: string, guesses: string[]) => {
      updateCurrentProgress((prev) => ({
        ...prev,
        miniGames: {
          ...prev.miniGames,
          [keyId]: {
            ...(prev.miniGames[keyId] ?? { status: 'locked', hintsUsed: 0 }),
            letterLockGuesses: guesses,
          },
        },
      }));
    },
    [updateCurrentProgress]
  );

  const handleSelectDifficulty = useCallback(
    (nextLevel: DifficultyLevel) => {
      if (nextLevel === difficulty) return;
      sound.tap();
      const targetPuzzle = generateDailyPuzzle(currentDateKey, nextLevel);
      const targetKey = getProgressKey(currentDateKey, nextLevel);
      setProgressMap((prev) => {
        if (prev[targetKey]) return prev;
        return {
          ...prev,
          [targetKey]: createInitialProgress(targetPuzzle),
        };
      });
      setDifficulty(nextLevel);
      setSelectedWords([]);
      setActiveMiniGameKeyId(null);
      setShowResults(false);
      const cfg = DIFFICULTIES[nextLevel];
      showToast(`${cfg.label} mode · ${cfg.keyCount} hidden keys`);
    },
    [currentDateKey, difficulty, showToast]
  );

  const handleOpenMiniGameType = useCallback(
    (type: MiniGameType) => {
      sound.tap();
      const ofType = currentPuzzle.miniGames.filter((mg) => mg.type === type);
      const firstLocked = ofType.find(
        (mg) => currentProgress.miniGames[mg.keyId]?.status === 'locked'
      );
      const chosen = firstLocked ?? ofType[0];
      if (chosen) {
        setActiveMiniGameKeyId(chosen.keyId);
      }
    },
    [currentProgress.miniGames, currentPuzzle.miniGames]
  );

  const handleToggleWord = useCallback(
    (word: string) => {
      if (currentProgress.status !== 'in_progress') return;
      setSelectedWords((prev) => {
        if (prev.includes(word)) {
          sound.deselect();
          return prev.filter((w) => w !== word);
        }
        if (prev.length >= 4) {
          return prev;
        }
        sound.tap();
        return [...prev, word];
      });
    },
    [currentProgress.status]
  );

  const handleShuffle = useCallback(() => {
    sound.tap();
    updateCurrentProgress((prev) => {
      const next = [...prev.tileOrder];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return { ...prev, tileOrder: next };
    });
  }, [updateCurrentProgress]);

  const handleDeselectAll = useCallback(() => {
    if (selectedWords.length === 0) return;
    sound.deselect();
    setSelectedWords([]);
  }, [selectedWords.length]);

  const handleSubmitGroup = useCallback(() => {
    if (
      selectedWords.length !== 4 ||
      currentProgress.status !== 'in_progress'
    ) {
      return;
    }

    const sortedSelection = [...selectedWords].sort().join('|');
    const alreadyGuessed = currentProgress.guesses.some(
      (g) => [...g.words].sort().join('|') === sortedSelection
    );

    if (alreadyGuessed) {
      sound.error();
      showToast('Already guessed that combination');
      setShakingWords([...selectedWords]);
      window.setTimeout(() => setShakingWords([]), 360);
      return;
    }

    const tiers = selectedWords.map((w) => getTierForWord(currentPuzzle, w));
    const counts: Partial<Record<TierId, number>> = {};
    tiers.forEach((t) => {
      counts[t] = (counts[t] ?? 0) + 1;
    });

    const matchedTier = (Object.keys(counts) as TierId[]).find(
      (t) => counts[t] === 4
    );

    if (matchedTier) {
      const nextSolvedTiers = [...currentProgress.solvedTiers, matchedTier];
      const isVictory = nextSolvedTiers.length === 4;
      const nextProgress: PuzzleProgress = {
        ...currentProgress,
        solvedTiers: nextSolvedTiers,
        status: isVictory ? 'won' : 'in_progress',
        completedAt: isVictory ? Date.now() : undefined,
        guesses: [
          ...currentProgress.guesses,
          { words: [...selectedWords], tiers, correct: true },
        ],
      };

      setProgressMap((prev) => ({
        ...prev,
        [currentProgressKey]: nextProgress,
      }));
      setSelectedWords([]);

      if (isVictory) {
        sound.victory();
        void confetti({
          particleCount: 85,
          spread: 72,
          origin: { y: 0.58 },
          colors: ['#F6C915', '#7C3AED', '#2E7D52', '#FFE46B'],
        });
        recordFinishedStats(nextProgress);
        showToast('All four layers solved!', 2600);
        window.setTimeout(() => setShowResults(true), 650);
      } else {
        sound.groupSolved();
        const cat = currentPuzzle.categories.find(
          (c) => c.tier === matchedTier
        );
        if (cat) {
          showToast(`${cat.title}`, 1800);
        }
      }
      return;
    }

    const isOneAway = Object.values(counts).some((c) => c === 3);
    const nextMistakes = Math.max(0, currentProgress.mistakesRemaining - 1);
    const isLoss = nextMistakes === 0;

    setShakingWords([...selectedWords]);
    window.setTimeout(() => setShakingWords([]), 380);
    sound.error();

    if (isLoss) {
      const remainingTiers = TIER_ORDER.filter(
        (t) => !currentProgress.solvedTiers.includes(t)
      );
      const revealedMiniGames = { ...currentProgress.miniGames };
      currentPuzzle.miniGames.forEach((mg) => {
        if (revealedMiniGames[mg.keyId]?.status === 'locked') {
          revealedMiniGames[mg.keyId] = {
            ...revealedMiniGames[mg.keyId],
            status: 'revealed',
          };
        }
      });

      const finalProgress: PuzzleProgress = {
        ...currentProgress,
        mistakesRemaining: 0,
        status: 'lost',
        solvedTiers: [...currentProgress.solvedTiers, ...remainingTiers],
        miniGames: revealedMiniGames,
        completedAt: Date.now(),
        guesses: [
          ...currentProgress.guesses,
          { words: [...selectedWords], tiers, correct: false },
        ],
      };

      setProgressMap((prev) => ({
        ...prev,
        [currentProgressKey]: finalProgress,
      }));
      setSelectedWords([]);
      recordFinishedStats(finalProgress);
      showToast('Out of mistakes — remaining layers revealed', 2800);
      window.setTimeout(() => setShowResults(true), 750);
    } else {
      updateCurrentProgress((prev) => ({
        ...prev,
        mistakesRemaining: nextMistakes,
        guesses: [
          ...prev.guesses,
          { words: [...selectedWords], tiers, correct: false },
        ],
      }));
      showToast(
        isOneAway
          ? 'One away…'
          : `Not a match — ${nextMistakes} ${
              nextMistakes === 1 ? 'mistake' : 'mistakes'
            } left`
      );
    }
  }, [
    currentProgress,
    currentProgressKey,
    currentPuzzle,
    recordFinishedStats,
    selectedWords,
    showToast,
    updateCurrentProgress,
  ]);

  const handleSelectDaily = useCallback(
    (dateKey: string, level: DifficultyLevel) => {
      const puzzle = generateDailyPuzzle(dateKey, level);
      const pKey = getProgressKey(dateKey, level);
      setProgressMap((prev) => {
        if (prev[pKey]) return prev;
        return {
          ...prev,
          [pKey]: createInitialProgress(puzzle),
        };
      });
      setCurrentDateKey(dateKey);
      setDifficulty(level);
      setSelectedWords([]);
      setActiveMiniGameKeyId(null);
      setActiveTab('play');
      setShowResults(false);
      setToastMessage(null);
    },
    []
  );

  const handleResetPuzzle = useCallback(() => {
    sound.tap();
    setProgressMap((prev) => ({
      ...prev,
      [currentProgressKey]: createInitialProgress(currentPuzzle),
    }));
    setSelectedWords([]);
    setActiveMiniGameKeyId(null);
    setShowResults(false);
    showToast(`Reset Daily #${currentPuzzle.id}`);
  }, [currentProgressKey, currentPuzzle, showToast]);

  const nextArchiveDateKey = useMemo(() => {
    const unplayed = recentDateKeys.find((dk) => {
      if (dk === currentDateKey) return false;
      const prog = progressMap[getProgressKey(dk, difficulty)];
      return !prog || prog.status === 'in_progress';
    });
    if (unplayed) return unplayed;
    const idx = recentDateKeys.indexOf(currentDateKey);
    if (idx !== -1 && idx < recentDateKeys.length - 1) {
      return recentDateKeys[idx + 1];
    }
    return recentDateKeys[0] !== currentDateKey ? recentDateKeys[0] : null;
  }, [currentDateKey, difficulty, progressMap, recentDateKeys]);

  const buildSiblingsForType = useCallback(
    (type: MiniGameType): SiblingKeyItem[] => {
      return currentPuzzle.miniGames
        .filter((mg) => mg.type === type)
        .map((mg) => ({
          keyId: mg.keyId,
          label: `#${mg.indexInType + 1}`,
          status: currentProgress.miniGames[mg.keyId]?.status ?? 'locked',
        }));
    },
    [currentProgress.miniGames, currentPuzzle.miniGames]
  );

  const isNewDayAvailable = currentDateKey !== todayDateKey;

  const openAuthModal = (tab: 'account' | 'leaderboards') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F2FC] dark:bg-[#140321] text-[#2B0938] dark:text-[#FAF7FF] transition-colors duration-200 relative z-10">
      <Header
        activeTab={activeTab}
        darkMode={darkMode}
        soundEnabled={soundEnabled}
        user={user}
        dailyStreak={dailyStreak}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'play') setActiveMiniGameKeyId(null);
        }}
        onOpenStats={() => setShowStats(true)}
        onOpenHowToPlay={() => setShowHowToPlay(true)}
        onOpenLeaderboard={() => openAuthModal('leaderboards')}
        onOpenAccount={() => openAuthModal('account')}
        onToggleTheme={toggleDarkMode}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
      />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-7 sm:py-10">
        {activeTab === 'archive' ? (
          <ArchiveView
            dateKeys={recentDateKeys}
            todayDateKey={todayDateKey}
            currentDateKey={currentDateKey}
            difficulty={difficulty}
            progressMap={progressMap}
            onSelectDifficulty={handleSelectDifficulty}
            onSelectDaily={handleSelectDaily}
          />
        ) : activeMiniGameInstance?.type === 'letterlock' &&
          activeMiniGameInstance.letterlock ? (
          <LetterLockGame
            key={`${currentProgressKey}-${activeMiniGameInstance.keyId}`}
            data={activeMiniGameInstance.letterlock}
            status={
              currentProgress.miniGames[activeMiniGameInstance.keyId]?.status ??
              'locked'
            }
            initialGuesses={
              currentProgress.miniGames[activeMiniGameInstance.keyId]
                ?.letterLockGuesses ?? []
            }
            siblings={buildSiblingsForType('letterlock')}
            activeKeyId={activeMiniGameInstance.keyId}
            onSelectKey={(id) => {
              sound.tap();
              setActiveMiniGameKeyId(id);
            }}
            onUpdateGuesses={(g) =>
              handleUpdateLetterLockGuesses(activeMiniGameInstance.keyId, g)
            }
            onComplete={(mode, hints) =>
              handleCompleteMiniGame(activeMiniGameInstance.keyId, mode, hints)
            }
            onBack={() => {
              const st =
                currentProgress.miniGames[activeMiniGameInstance.keyId]?.status;
              setActiveMiniGameKeyId(null);
              if (st && st !== 'locked') {
                showToast(
                  `${MINI_GAME_META.letterlock.label} unlocked: ${activeMiniGameInstance.word}`
                );
              }
            }}
          />
        ) : activeMiniGameInstance?.type === 'anagram' &&
          activeMiniGameInstance.anagram ? (
          <AnagramGame
            key={`${currentProgressKey}-${activeMiniGameInstance.keyId}`}
            data={activeMiniGameInstance.anagram}
            status={
              currentProgress.miniGames[activeMiniGameInstance.keyId]?.status ??
              'locked'
            }
            siblings={buildSiblingsForType('anagram')}
            activeKeyId={activeMiniGameInstance.keyId}
            onSelectKey={(id) => {
              sound.tap();
              setActiveMiniGameKeyId(id);
            }}
            onComplete={(mode, hints) =>
              handleCompleteMiniGame(activeMiniGameInstance.keyId, mode, hints)
            }
            onBack={() => {
              const st =
                currentProgress.miniGames[activeMiniGameInstance.keyId]?.status;
              setActiveMiniGameKeyId(null);
              if (st && st !== 'locked') {
                showToast(
                  `${MINI_GAME_META.anagram.label} unlocked: ${activeMiniGameInstance.word}`
                );
              }
            }}
          />
        ) : activeMiniGameInstance?.type === 'crossword' &&
          activeMiniGameInstance.crossword ? (
          <CrosswordGame
            key={`${currentProgressKey}-${activeMiniGameInstance.keyId}`}
            data={activeMiniGameInstance.crossword}
            status={
              currentProgress.miniGames[activeMiniGameInstance.keyId]?.status ??
              'locked'
            }
            siblings={buildSiblingsForType('crossword')}
            activeKeyId={activeMiniGameInstance.keyId}
            onSelectKey={(id) => {
              sound.tap();
              setActiveMiniGameKeyId(id);
            }}
            onComplete={(mode, hints) =>
              handleCompleteMiniGame(activeMiniGameInstance.keyId, mode, hints)
            }
            onBack={() => {
              const st =
                currentProgress.miniGames[activeMiniGameInstance.keyId]?.status;
              setActiveMiniGameKeyId(null);
              if (st && st !== 'locked') {
                showToast(
                  `${MINI_GAME_META.crossword.label} unlocked: ${activeMiniGameInstance.word}`
                );
              }
            }}
          />
        ) : activeMiniGameInstance?.type === 'wordsearch' &&
          activeMiniGameInstance.wordsearch ? (
          <WordSearchGame
            key={`${currentProgressKey}-${activeMiniGameInstance.keyId}`}
            seedKey={`${currentProgressKey}-${activeMiniGameInstance.keyId}`}
            data={activeMiniGameInstance.wordsearch}
            status={
              currentProgress.miniGames[activeMiniGameInstance.keyId]?.status ??
              'locked'
            }
            siblings={buildSiblingsForType('wordsearch')}
            activeKeyId={activeMiniGameInstance.keyId}
            onSelectKey={(id) => {
              sound.tap();
              setActiveMiniGameKeyId(id);
            }}
            onComplete={(mode, hints) =>
              handleCompleteMiniGame(activeMiniGameInstance.keyId, mode, hints)
            }
            onBack={() => {
              const st =
                currentProgress.miniGames[activeMiniGameInstance.keyId]?.status;
              setActiveMiniGameKeyId(null);
              if (st && st !== 'locked') {
                showToast(
                  `${MINI_GAME_META.wordsearch.label} unlocked: ${activeMiniGameInstance.word}`
                );
              }
            }}
          />
        ) : (
          <FinalBoard
            puzzle={currentPuzzle}
            progress={currentProgress}
            difficulty={difficulty}
            countdownLabel={formatCountdown(countdownMs)}
            isNewDayAvailable={isNewDayAvailable}
            dailyStreak={dailyStreak}
            selectedWords={selectedWords}
            shakingWords={shakingWords}
            recentlyUnlockedKeyId={recentlyUnlockedKeyId}
            toastMessage={toastMessage}
            onSelectDifficulty={handleSelectDifficulty}
            onLoadNewDaily={() => handleSelectDaily(todayDateKey, difficulty)}
            onOpenMiniGameKey={(keyId) => {
              sound.tap();
              setActiveMiniGameKeyId(keyId);
            }}
            onOpenMiniGameType={handleOpenMiniGameType}
            onToggleWord={handleToggleWord}
            onShuffle={handleShuffle}
            onDeselectAll={handleDeselectAll}
            onSubmit={handleSubmitGroup}
            onOpenResults={() => setShowResults(true)}
            onResetPuzzle={handleResetPuzzle}
          />
        )}
      </main>

      <footer className="border-t border-[#DAC6F0] dark:border-[#D4A437]/25 py-5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[#5C3A78] dark:text-[#C5B3DA]">
          <span className="font-semibold text-[#2B0938] dark:text-[#F6C915]">
            The Missing Piece · Going Deep
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowHowToPlay(true)}
              className="hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors cursor-pointer"
            >
              Rules
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('archive')}
              className="hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors cursor-pointer"
            >
              Daily Archive ({ARCHIVE_DAY_COUNT} days)
            </button>
            <button
              type="button"
              onClick={() => setShowStats(true)}
              className="hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors cursor-pointer"
            >
              Stats
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('leaderboards')}
              className="hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors cursor-pointer"
            >
              Leaderboard
            </button>
          </div>
        </div>
      </footer>

      <HowToPlayModal
        open={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />
      <StatsModal
        open={showStats}
        stats={stats}
        isSignedIn={Boolean(user)}
        onClose={() => setShowStats(false)}
      />
      <ResultsModal
        open={showResults}
        puzzle={currentPuzzle}
        progress={currentProgress}
        nextDateKey={nextArchiveDateKey}
        nextPuzzleNumber={
          nextArchiveDateKey ? getDailyNumber(nextArchiveDateKey) : null
        }
        onClose={() => setShowResults(false)}
        onPlayNext={(dateKey) => handleSelectDaily(dateKey, difficulty)}
        onOpenLeaderboard={() => openAuthModal('leaderboards')}
      />
      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        user={user}
        initialGameId="goingdeep"
        initialTab={authModalTab}
      />
    </div>
  );
}
