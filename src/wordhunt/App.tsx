import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  Clock,
  Copy,
  Eye,
  Infinity as InfinityIcon,
  Moon,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import { LanguageMenu } from '@/components/language-menu';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';
import { UserProfileIcon } from '@/components/user-profile-icon';
import { CLOUD_HYDRATED_EVENT, scheduleCloudProgressSync } from '@/lib/cloud-progress';
import { useSiteTheme } from '@/lib/site-theme';
import {
  getLocalTodayDateStr,
  recordDailyPuzzleSolved,
  useDailyStreak,
} from '@/lib/daily-streak';
import {
  getDictionaryLanguageMeta,
  useDictionaryLanguage,
  type DictionaryLanguageCode,
} from '@/lib/dictionary-languages';
import {
  getCleanDisplayName,
  getCurrentUserSessionPrefix,
  saveUnifiedLeaderboardScore,
  subscribeToAllLeaderboards,
  useUnifiedAuth,
  type UnifiedLeaderboardEntry,
} from '@/lib/unified-game-auth';
import { GuessInputBar } from '@/mpwh/components/GuessInputBar';
import { LadderBoard } from '@/mpwh/components/LadderBoard';
import type { GuessFeedItem, LadderInstanceView, LadderMode } from '@/mpwh/shared/types';
import { formatDuration, formatModeLabel } from '@/mpwh/utils/format';
import { soundFX } from '@/mpwh/utils/sound';

type PlayStyle = 'daily' | 'practice';
type ActiveTab = 'play' | 'leaderboard' | 'rules';

interface SoloWordHuntState {
  gameId: string;
  mode: LadderMode;
  language: DictionaryLanguageCode;
  dailyDate: string | null;
  status: 'playing' | 'won' | 'gave_up';
  boards: LadderInstanceView[];
  totalGuesses: number;
  hintsRemaining: number;
  hintsUsed: number;
  startedAt: number;
  finishedAt: number | null;
  score: number;
  pieces: number;
  guessFeed: GuessFeedItem[];
  dictionarySize: number;
}

type ReplayAction =
  | { type: 'guess'; word: string; targetBoardIndex?: number | null }
  | { type: 'hint'; hintType: 'bracket' | 'clue'; boardIndex: number; targetIndex: number }
  | { type: 'reveal' };

interface SoloWordHuntStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  bestStreak: number;
  bestScore: number;
  fewestClassic: number | null;
  fewestDual: number | null;
  fewestQuad: number | null;
  dailyCompletedDates: string[];
}

const DEFAULT_STATS: SoloWordHuntStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  bestStreak: 0,
  bestScore: 0,
  fewestClassic: null,
  fewestDual: null,
  fewestQuad: null,
  dailyCompletedDates: [],
};

function getStatsKey(): string {
  return `wordhunt_solo_stats_v1_${getCurrentUserSessionPrefix()}`;
}

function getDailyLogKey(date: string, mode: LadderMode, lang: DictionaryLanguageCode): string {
  return `wordhunt_solo_daily_v1_${getCurrentUserSessionPrefix()}_${date}_${mode}_${lang}`;
}

function readStats(): SoloWordHuntStats {
  if (typeof window === 'undefined') return { ...DEFAULT_STATS };
  try {
    const raw = window.localStorage.getItem(getStatsKey());
    if (!raw) return { ...DEFAULT_STATS };
    const parsed = JSON.parse(raw);
    return {
      gamesPlayed: Number(parsed?.gamesPlayed || 0),
      gamesWon: Number(parsed?.gamesWon || 0),
      currentStreak: Number(parsed?.currentStreak || 0),
      bestStreak: Number(parsed?.bestStreak || 0),
      bestScore: Number(parsed?.bestScore || 0),
      fewestClassic: typeof parsed?.fewestClassic === 'number' ? parsed.fewestClassic : null,
      fewestDual: typeof parsed?.fewestDual === 'number' ? parsed.fewestDual : null,
      fewestQuad: typeof parsed?.fewestQuad === 'number' ? parsed.fewestQuad : null,
      dailyCompletedDates: Array.isArray(parsed?.dailyCompletedDates)
        ? parsed.dailyCompletedDates
        : [],
    };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

function writeStats(next: SoloWordHuntStats): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getStatsKey(), JSON.stringify(next));
    scheduleCloudProgressSync('wordhunt', { stats: next });
  } catch {
    // ignore storage errors
  }
}

function readDailyActions(
  date: string,
  mode: LadderMode,
  lang: DictionaryLanguageCode
): ReplayAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getDailyLogKey(date, mode, lang));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDailyActions(
  date: string,
  mode: LadderMode,
  lang: DictionaryLanguageCode,
  actions: ReplayAction[]
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getDailyLogKey(date, mode, lang),
      JSON.stringify(actions.slice(0, 200))
    );
  } catch {
    // ignore storage errors
  }
}

function buildShareSummary(
  game: SoloWordHuntState,
  elapsedMs: number,
  langLabel: string
): string {
  const header = game.dailyDate
    ? `Word Hunt Daily (${game.dailyDate}) · ${formatModeLabel(game.mode)}`
    : `Word Hunt Practice · ${formatModeLabel(game.mode)}`;
  const outcome =
    game.status === 'won'
      ? `Solved in ${game.totalGuesses} ${game.totalGuesses === 1 ? 'guess' : 'guesses'} · ${formatDuration(elapsedMs)} · ${game.score.toLocaleString()} pts`
      : `Revealed after ${game.totalGuesses} guesses`;
  const boardIcons = game.boards
    .map((b) => (b.solved ? '🟨' : '⬜'))
    .join('');
  return `${header} (${langLabel})\n${boardIcons} ${outcome}\nHints used: ${game.hintsUsed}\nmissingpiecepuzzles.fun/solo-games/wordhunt`;
}

export default function WordHuntSoloApp() {
  const { user } = useUnifiedAuth();
  const { darkMode, toggleDarkMode } = useSiteTheme();
  const [dictionaryLanguage] = useDictionaryLanguage();
  const todayDate = useMemo(() => getLocalTodayDateStr(), []);

  const [activeTab, setActiveTab] = useState<ActiveTab>('play');
  const [playStyle, setPlayStyle] = useState<PlayStyle>('daily');
  const [mode, setMode] = useState<LadderMode>('classic');
  const [game, setGame] = useState<SoloWordHuntState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedBoardIndex, setSelectedBoardIndex] = useState<number | null>(null);
  const [muted, setMuted] = useState(() => soundFX.isMuted());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [feedback, setFeedback] = useState<{
    text: string;
    tone: 'error' | 'success' | 'info';
  } | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'account' | 'leaderboards'>('leaderboards');
  const [stats, setStats] = useState<SoloWordHuntStats>(() => readStats());
  const [leaderboardEntries, setLeaderboardEntries] = useState<UnifiedLeaderboardEntry[]>([]);

  const dailyActionsRef = useRef<ReplayAction[]>([]);
  const recordedGameIdsRef = useRef<Set<string>>(new Set());
  const feedbackTimerRef = useRef<number | null>(null);

  const dailySolvedToday = stats.dailyCompletedDates.includes(todayDate);
  const dailyStreak = useDailyStreak('wordhunt', todayDate, dailySolvedToday);

  useEffect(() => {
    const refresh = () => setStats(readStats());
    refresh();
    window.addEventListener(CLOUD_HYDRATED_EVENT, refresh);
    return () => window.removeEventListener(CLOUD_HYDRATED_EVENT, refresh);
  }, [user?.uid]);

  useEffect(() => {
    const unsub = subscribeToAllLeaderboards((grouped) => {
      setLeaderboardEntries(grouped.wordhunt || []);
    });
    return () => unsub();
  }, []);

  const showFeedback = useCallback(
    (text: string, tone: 'error' | 'success' | 'info' = 'info') => {
      setFeedback({ text, tone });
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
      }, 3400);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const startBoard = useCallback(
    async (
      nextPlayStyle: PlayStyle,
      nextMode: LadderMode,
      nextLang: DictionaryLanguageCode,
      forceFreshPractice = false
    ) => {
      setLoading(true);
      setSelectedBoardIndex(null);
      setCopiedShare(false);

      const dailyDate = nextPlayStyle === 'daily' ? todayDate : null;
      const savedActions =
        dailyDate && !forceFreshPractice
          ? readDailyActions(dailyDate, nextMode, nextLang)
          : [];
      dailyActionsRef.current = [...savedActions];

      try {
        const res = await fetch('/api/mpwh/solo/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: nextMode,
            language: nextLang,
            dailyDate: dailyDate ?? undefined,
            replayActions: savedActions,
          }),
        });
        if (!res.ok) throw new Error('Could not start Word Hunt round.');
        const data = await res.json();
        const nextState = data.state as SoloWordHuntState;
        // Avoid double-counting an already-completed daily round loaded from replay
        if (savedActions.length > 0 && nextState.status !== 'playing') {
          recordedGameIdsRef.current.add(nextState.gameId);
        }
        setGame(nextState);
        setElapsedMs(
          nextState.finishedAt
            ? Math.max(0, nextState.finishedAt - nextState.startedAt)
            : 0
        );
      } catch {
        showFeedback('Unable to reach the dictionary server. Please try again.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [todayDate, showFeedback]
  );

  useEffect(() => {
    void startBoard(playStyle, mode, dictionaryLanguage);
  }, [playStyle, mode, dictionaryLanguage, startBoard]);

  // Live round elapsed timer
  useEffect(() => {
    if (!game) {
      setElapsedMs(0);
      return;
    }
    if (game.status !== 'playing') {
      setElapsedMs(
        game.finishedAt ? Math.max(0, game.finishedAt - game.startedAt) : 0
      );
      return;
    }
    const tick = () => {
      setElapsedMs(Math.max(0, Date.now() - game.startedAt));
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [game?.gameId, game?.status, game?.startedAt, game?.finishedAt]);

  const recordFinishedRound = useCallback(
    (finishedGame: SoloWordHuntState) => {
      if (recordedGameIdsRef.current.has(finishedGame.gameId)) return;
      recordedGameIdsRef.current.add(finishedGame.gameId);

      const won = finishedGame.status === 'won';
      const prev = readStats();
      const nextStreak = won ? prev.currentStreak + 1 : 0;
      const nextBestScore = Math.max(prev.bestScore, finishedGame.score);

      const updateFewest = (cur: number | null, guesses: number): number | null => {
        if (!won || guesses <= 0) return cur;
        return cur === null ? guesses : Math.min(cur, guesses);
      };

      const nextDailyDates =
        won && finishedGame.dailyDate
          ? Array.from(new Set([...prev.dailyCompletedDates, finishedGame.dailyDate])).sort()
          : prev.dailyCompletedDates;

      const nextStats: SoloWordHuntStats = {
        gamesPlayed: prev.gamesPlayed + 1,
        gamesWon: prev.gamesWon + (won ? 1 : 0),
        currentStreak: nextStreak,
        bestStreak: Math.max(prev.bestStreak, nextStreak),
        bestScore: nextBestScore,
        fewestClassic:
          finishedGame.mode === 'classic'
            ? updateFewest(prev.fewestClassic, finishedGame.totalGuesses)
            : prev.fewestClassic,
        fewestDual:
          finishedGame.mode === 'dual'
            ? updateFewest(prev.fewestDual, finishedGame.totalGuesses)
            : prev.fewestDual,
        fewestQuad:
          finishedGame.mode === 'quad'
            ? updateFewest(prev.fewestQuad, finishedGame.totalGuesses)
            : prev.fewestQuad,
        dailyCompletedDates: nextDailyDates,
      };

      writeStats(nextStats);
      setStats(nextStats);

      if (won) {
        soundFX.playVictory();
        void confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.56 },
          colors: ['#F6C915', '#A855F7', '#34D399', '#FFE46B'],
        });

        if (finishedGame.dailyDate) {
          recordDailyPuzzleSolved('wordhunt', finishedGame.dailyDate, 1);
        }

        if (user) {
          void saveUnifiedLeaderboardScore({
            user,
            gameId: 'wordhunt',
            puzzleId: finishedGame.dailyDate
              ? `daily_${finishedGame.dailyDate}_${finishedGame.mode}`
              : `practice_${finishedGame.mode}`,
            puzzleTitle: `Word Hunt ${finishedGame.dailyDate ? 'Daily' : 'Practice'} (${formatModeLabel(finishedGame.mode)})`,
            score: nextBestScore,
            metricLabel: `${nextBestScore.toLocaleString()} pts (${finishedGame.totalGuesses} guesses)`,
            subMetricLabel: `${formatModeLabel(finishedGame.mode)} · ${finishedGame.dailyDate ?? 'Practice'}`,
          });
        }
      }
    },
    [user]
  );

  const handleSubmitGuess = useCallback(
    async (rawWord: string) => {
      if (!game || game.status !== 'playing' || submitting) return;
      const clean = rawWord.trim();
      if (!clean) return;
      setSubmitting(true);
      try {
        const res = await fetch('/api/mpwh/solo/guess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: game.gameId,
            word: clean,
            targetBoardIndex: game.mode === 'quad' ? selectedBoardIndex : null,
          }),
        });
        const data = await res.json();
        if (data.expired) {
          showFeedback('Session refreshed — starting a new board.', 'info');
          void startBoard(playStyle, mode, dictionaryLanguage);
          return;
        }
        const nextState = data.state as SoloWordHuntState;
        const outcome = data.outcome as {
          accepted: boolean;
          alreadyGuessed?: boolean;
          reason?: string;
          word: string;
          matchedWords: string[];
          allSolved: boolean;
        };

        if (nextState) {
          setGame(nextState);
        }

        if (!outcome?.accepted) {
          soundFX.playInvalid();
          if (outcome?.reason) showFeedback(outcome.reason, 'error');
          return;
        }

        if (game.dailyDate) {
          const nextLog: ReplayAction[] = [
            ...dailyActionsRef.current,
            {
              type: 'guess',
              word: outcome.word,
              targetBoardIndex: game.mode === 'quad' ? selectedBoardIndex : null,
            },
          ];
          dailyActionsRef.current = nextLog;
          writeDailyActions(game.dailyDate, game.mode, game.language, nextLog);
        }

        if (outcome.allSolved && nextState) {
          recordFinishedRound(nextState);
          showFeedback(
            `Solved in ${nextState.totalGuesses} ${nextState.totalGuesses === 1 ? 'guess' : 'guesses'}! +${nextState.score.toLocaleString()} pts`,
            'success'
          );
        } else if (outcome.matchedWords.length > 0) {
          soundFX.playWordSolved();
          showFeedback(
            `Found ${outcome.matchedWords.map((w) => w.toUpperCase()).join(', ')}! Keep hunting!`,
            'success'
          );
          if (game.mode === 'quad') {
            setSelectedBoardIndex(null);
          }
        } else {
          soundFX.playPlace();
        }
      } catch {
        showFeedback('Could not submit guess. Please retry.', 'error');
      } finally {
        setSubmitting(false);
      }
    },
    [
      game,
      submitting,
      selectedBoardIndex,
      playStyle,
      mode,
      dictionaryLanguage,
      startBoard,
      recordFinishedRound,
      showFeedback,
    ]
  );

  const handleUseHint = useCallback(
    async (hintType: 'bracket' | 'clue', boardIndex: number, targetIndex: number) => {
      if (!game || game.status !== 'playing') return;
      try {
        const res = await fetch('/api/mpwh/solo/hint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: game.gameId,
            hintType,
            boardIndex,
            targetIndex,
          }),
        });
        const data = await res.json();
        if (data.expired) {
          void startBoard(playStyle, mode, dictionaryLanguage);
          return;
        }
        if (data.state) setGame(data.state);
        if (!data.ok) {
          showFeedback(data.error || 'Hint unavailable.', 'error');
          return;
        }
        soundFX.playHint();
        if (game.dailyDate) {
          const nextLog: ReplayAction[] = [
            ...dailyActionsRef.current,
            { type: 'hint', hintType, boardIndex, targetIndex },
          ];
          dailyActionsRef.current = nextLog;
          writeDailyActions(game.dailyDate, game.mode, game.language, nextLog);
        }
        if (data.hintWord) {
          showFeedback(`Bracket narrowed with "${String(data.hintWord).toUpperCase()}".`, 'info');
        } else if (data.clueText) {
          showFeedback(`Letter clue: ${data.clueText}`, 'info');
        }
      } catch {
        showFeedback('Could not apply hint right now.', 'error');
      }
    },
    [game, playStyle, mode, dictionaryLanguage, startBoard, showFeedback]
  );

  const handleReveal = useCallback(async () => {
    if (!game || game.status !== 'playing') return;
    try {
      const res = await fetch('/api/mpwh/solo/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.gameId }),
      });
      const data = await res.json();
      if (data.state) {
        const nextState = data.state as SoloWordHuntState;
        setGame(nextState);
        if (game.dailyDate) {
          const nextLog: ReplayAction[] = [...dailyActionsRef.current, { type: 'reveal' }];
          dailyActionsRef.current = nextLog;
          writeDailyActions(game.dailyDate, game.mode, game.language, nextLog);
        }
        recordFinishedRound(nextState);
      }
    } catch {
      showFeedback('Could not reveal answers right now.', 'error');
    }
  }, [game, recordFinishedRound, showFeedback]);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundFX.setMuted(next);
  };

  const handleCopyResults = async () => {
    if (!game) return;
    const text = buildShareSummary(game, elapsedMs, langMeta.label);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2200);
    } catch {
      showFeedback('Clipboard access unavailable.', 'error');
    }
  };

  const langMeta = getDictionaryLanguageMeta(dictionaryLanguage);
  const isPlaying = game?.status === 'playing';
  const isWon = game?.status === 'won';
  const isGaveUp = game?.status === 'gave_up';
  const isFinished = Boolean(isWon || isGaveUp);
  const winRate =
    stats.gamesPlayed > 0
      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
      : 0;

  const revealedWords = useMemo(() => {
    if (!game) return [];
    return game.boards.flatMap((b) =>
      b.targets.map((t) => t.word).filter((w): w is string => Boolean(w))
    );
  }, [game]);

  const modeOptions: Array<{ id: LadderMode; label: string; detail: string }> = [
    { id: 'classic', label: 'Classic', detail: '1 Word' },
    { id: 'dual', label: 'Dual', detail: '2 Words' },
    { id: 'quad', label: 'Quad', detail: '4 Boards' },
  ];

  return (
    <div className="relative min-h-screen bg-[#F7F2FC] dark:bg-[#160524] text-[#2B0938] dark:text-[#F5F0FF] flex flex-col transition-colors overflow-x-hidden">
      {/* 25% Opacity Missing Piece Background Watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 flex items-center justify-center z-0 overflow-hidden"
      >
        <img
          src="/assets/aistudio/3d_logo_944e5372.png"
          alt=""
          className="w-[340px] h-[340px] sm:w-[640px] sm:h-[640px] object-contain opacity-25 select-none"
        />
      </div>

      {/* Clean 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E3D4F4] dark:border-[#D4A437]/25 bg-white/95 dark:bg-[#160524]/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-3 sm:px-5 min-h-14 sm:min-h-16 py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-8">
          {/* Zone 1: Back link + Wordmark */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <Link
              to="/solo-games"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D7C4EC] dark:border-[#D4A437]/30 bg-[#F4ECFC] dark:bg-[#24083B] px-3 py-2 text-xs font-bold text-[#4C266D] dark:text-[#F6C915] hover:bg-[#EADBF9] dark:hover:bg-[#310D4F] transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Solo Games</span>
            </Link>
            <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
              <img
                src="/assets/aistudio/3d_logo_944e5372.png"
                alt="The Missing Piece"
                className="h-8 w-8 rounded-full object-contain shrink-0"
              />
              <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-[#2B0938] dark:text-white">
                Word Hunt
              </span>
            </div>
          </div>

          {/* Zone 2: Clean Single-Line Text Navigation */}
          <nav
            aria-label="Word Hunt sections"
            className="hidden md:flex items-center gap-6 text-sm font-semibold"
          >
            {(
              [
                { id: 'play', label: 'Play' },
                { id: 'leaderboard', label: 'Leaderboard' },
                { id: 'rules', label: 'How to Play' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? 'text-[#8F6500] dark:text-[#F6C915] border-b-2 border-[#B58100] dark:border-[#F6C915]'
                    : 'text-[#5C3A78] dark:text-[#D4C0EC] hover:text-[#2B0938] dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Language, Streak, Theme, Audio & Account */}
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <LanguageMenu variant="compact" />
            <DailyStreakBadge
              streak={dailyStreak.streak}
              solvedToday={dailyStreak.solvedToday}
              variant={darkMode ? 'amber-dark' : 'amber-light'}
              compact
            />
            <button
              type="button"
              onClick={toggleDarkMode}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#D7C4EC] dark:border-white/15 bg-[#F4ECFC] dark:bg-[#24083B] text-[#4C266D] dark:text-[#E6D6F7] hover:border-[#B58100] dark:hover:border-[#F6C915]/50 hover:text-[#8F6500] dark:hover:text-[#F6C915] transition-colors cursor-pointer shrink-0"
            >
              {darkMode ? (
                <Sun className="h-4 w-4 text-[#F6C915]" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#D7C4EC] dark:border-white/15 bg-[#F4ECFC] dark:bg-[#24083B] text-[#4C266D] dark:text-[#E6D6F7] hover:border-[#B58100] dark:hover:border-[#F6C915]/50 hover:text-[#8F6500] dark:hover:text-[#F6C915] transition-colors cursor-pointer shrink-0"
            >
              {muted ? (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthModalTab(user ? 'leaderboards' : 'account');
                setAuthModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F6C915] px-3 py-2 text-xs font-extrabold text-[#1D0830] hover:bg-[#FFE047] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {user ? (
                <>
                  <UserProfileIcon user={user} size={15} className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline max-w-[100px] truncate">
                    {getCleanDisplayName(user)}
                  </span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Tab Strip */}
        <div className="flex md:hidden items-center justify-center gap-6 border-t border-[#E6D9F5] dark:border-white/10 px-3 py-2 text-xs font-semibold">
          {(
            [
              { id: 'play', label: 'Play' },
              { id: 'leaderboard', label: 'Leaderboard' },
              { id: 'rules', label: 'How to Play' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === tab.id ? 'text-[#8F6500] dark:text-[#F6C915]' : 'text-[#5C3A78] dark:text-[#C8B2E4]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 mx-auto w-full max-w-6xl px-2.5 sm:px-5 py-3.5 sm:py-6">
        {activeTab === 'rules' ? (
          <section className="mx-auto max-w-3xl rounded-2xl border border-[#D7C4EC] dark:border-[#D4A437]/30 bg-white/95 dark:bg-[#210736]/95 p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-[#8F6500] dark:text-[#F6C915]">Single-Player Guide</p>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#2B0938] dark:text-white">
                How to Play Solo Word Hunt
              </h1>
              <p className="text-sm text-[#5C3A78] dark:text-[#D9C7EE] leading-relaxed">
                Crack the hidden 4–8 letter word using pure alphabetical binary search. Every valid
                dictionary word of any length narrows the bracket above or below the target.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl border border-[#E6D9F5] dark:border-white/10 bg-[#F8F3FD] dark:bg-[#160425] p-4 space-y-1.5">
                <h2 className="text-sm font-extrabold text-[#8F6500] dark:text-[#F6C915]">
                  01. Narrow the A–Z Ladder
                </h2>
                <p className="text-xs text-[#5C3A78] dark:text-[#D4C0EC] leading-relaxed">
                  Type any real word in the active language ({langMeta.label}). If it comes before
                  the secret word alphabetically, it slots above; if it comes after, it slots below.
                </p>
              </div>
              <div className="rounded-xl border border-[#E6D9F5] dark:border-white/10 bg-[#F8F3FD] dark:bg-[#160425] p-4 space-y-1.5">
                <h2 className="text-sm font-extrabold text-[#8F6500] dark:text-[#F6C915]">
                  02. Auto-Filled Prefix Letters
                </h2>
                <p className="text-xs text-[#5C3A78] dark:text-[#D4C0EC] leading-relaxed">
                  Whenever your closest word above and closest word below share starting letters,
                  those shared prefix letters fill into the secret word tiles automatically.
                </p>
              </div>
              <div className="rounded-xl border border-[#E6D9F5] dark:border-white/10 bg-[#F8F3FD] dark:bg-[#160425] p-4 space-y-1.5">
                <h2 className="text-sm font-extrabold text-[#8F6500] dark:text-[#F6C915]">
                  03. Classic, Dual &amp; Quad Modes
                </h2>
                <p className="text-xs text-[#5C3A78] dark:text-[#D4C0EC] leading-relaxed">
                  Play Classic (1 word), Dual Ladder (2 words sorted A→Z on one board), or Quad Hunt
                  (4 simultaneous boards—click any board to target it, or broadcast across all
                  unsolved boards).
                </p>
              </div>
              <div className="rounded-xl border border-[#E6D9F5] dark:border-white/10 bg-[#F8F3FD] dark:bg-[#160425] p-4 space-y-1.5">
                <h2 className="text-sm font-extrabold text-[#8F6500] dark:text-[#F6C915]">
                  04. Daily Streaks &amp; Smart Hints
                </h2>
                <p className="text-xs text-[#5C3A78] dark:text-[#D4C0EC] leading-relaxed">
                  Solve today&apos;s Daily Challenge to extend your Daily Streak and post your score
                  to the Solo Leaderboard. Use Bisect Hints to halve the bracket or Letter Clues to
                  reveal the next character.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('play')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#F6C915] px-5 py-2.5 text-xs font-extrabold text-[#1D0830] hover:bg-[#FFE047] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                <span>Back to Game</span>
              </button>
            </div>
          </section>
        ) : activeTab === 'leaderboard' ? (
          <section className="mx-auto max-w-3xl rounded-2xl border border-[#D7C4EC] dark:border-[#D4A437]/30 bg-white/95 dark:bg-[#210736]/95 p-6 sm:p-8 space-y-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[#2B0938] dark:text-white">
                  Solo Word Hunt Leaderboard
                </h1>
                <p className="text-xs text-[#6B4A8A] dark:text-[#C8B2E4] mt-1">
                  Top single-player scores across Classic, Dual, and Quad ladders
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAuthModalTab('leaderboards');
                  setAuthModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#C99A14]/55 dark:border-[#F6C915]/45 bg-[#FDF7E2] dark:bg-[#2B0B46] px-3.5 py-2 text-xs font-bold text-[#8F6500] dark:text-[#F6C915] hover:bg-[#FAF0C8] dark:hover:bg-[#3A105E] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>All Solo Leaderboards</span>
              </button>
            </div>

            {leaderboardEntries.length === 0 ? (
              <div className="rounded-xl border border-[#E6D9F5] dark:border-white/10 bg-[#F8F3FD] dark:bg-[#160425] p-8 text-center space-y-2">
                <p className="text-sm font-bold text-[#2B0938] dark:text-white">No scores recorded yet</p>
                <p className="text-xs text-[#6B4A8A] dark:text-[#C8B2E4]">
                  Sign in and solve a Solo Word Hunt board to claim the #1 spot.
                </p>
              </div>
            ) : (
              <ol className="divide-y divide-[#E6D9F5] dark:divide-white/10 rounded-xl border border-[#E6D9F5] dark:border-white/10 bg-[#F8F3FD] dark:bg-[#160425] overflow-hidden">
                {leaderboardEntries.map((entry, idx) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-sm font-extrabold tabular-nums text-[#8F6500] dark:text-[#F6C915] w-6 shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#2B0938] dark:text-white truncate">
                          {entry.displayName}
                        </p>
                        <p className="text-xs text-[#6B4A8A] dark:text-[#BFA8DC] truncate">
                          {entry.metricLabel}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-sm font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300 shrink-0">
                      {entry.score.toLocaleString()} pts
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : (
          <div className="space-y-5">
            {/* Control Strip: Daily/Practice + Mode Selector + Unboxed Stats + Reveal/New */}
            <div className="rounded-2xl border border-[#D7C4EC] dark:border-[#D4A437]/30 bg-white/95 dark:bg-[#210736]/90 p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                {/* Daily vs Practice Segmented Toggle */}
                <div className="inline-flex items-center gap-1 rounded-xl bg-[#F4ECFC] dark:bg-[#140321] border border-[#D7C4EC] dark:border-[#D4A437]/25 p-1">
                  <button
                    type="button"
                    onClick={() => setPlayStyle('daily')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      playStyle === 'daily'
                        ? 'bg-[#F6C915] text-[#1D0830]'
                        : 'text-[#5C3A78] dark:text-[#D4C0EC] hover:text-[#2B0938] dark:hover:text-white'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Daily</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayStyle('practice')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      playStyle === 'practice'
                        ? 'bg-[#F6C915] text-[#1D0830]'
                        : 'text-[#5C3A78] dark:text-[#D4C0EC] hover:text-[#2B0938] dark:hover:text-white'
                    }`}
                  >
                    <InfinityIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Practice</span>
                  </button>
                </div>

                {/* Classic / Dual / Quad Mode Switcher */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {modeOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMode(opt.id)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        mode === opt.id
                          ? 'bg-[#F2E7FC] dark:bg-[#361156] border border-[#C99A14] dark:border-[#F6C915] text-[#7A5400] dark:text-[#F6C915]'
                          : 'bg-[#F8F3FD] dark:bg-[#140321] border border-[#D7C4EC] dark:border-[#D4A437]/20 text-[#5C3A78] dark:text-[#D9C7EE] hover:border-[#B58100] dark:hover:border-[#F6C915]/45 hover:text-[#2B0938] dark:hover:text-white'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className="text-[10px] font-semibold opacity-80">
                        {opt.detail}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Clean Unboxed Metadata + Actions */}
              <div className="flex flex-wrap items-center gap-3 justify-between lg:justify-end">
                <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-[#5C3A78] dark:text-[#D4C0EC]">
                  <span>
                    {langMeta.flag} {langMeta.label}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-[#9A6E00] dark:text-[#F6C915]" aria-hidden="true" />
                    {formatDuration(elapsedMs)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-[#9A6E00] dark:text-[#F6C915]" aria-hidden="true" />
                    {game?.hintsRemaining ?? 3} hints
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isPlaying && (
                    <button
                      type="button"
                      onClick={handleReveal}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#D7C4EC] dark:border-white/18 bg-[#F4ECFC] dark:bg-[#2B0B46] px-3 py-2 text-xs font-bold text-[#4C266D] dark:text-[#E5D7F7] hover:bg-[#EADBF9] dark:hover:bg-[#3A105E] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reveal</span>
                    </button>
                  )}

                  {playStyle === 'practice' ? (
                    <button
                      type="button"
                      onClick={() => void startBoard('practice', mode, dictionaryLanguage, true)}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#F6C915] px-4 py-2 text-xs font-extrabold text-[#1D0830] hover:bg-[#FFE047] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>New Puzzle</span>
                    </button>
                  ) : isFinished ? (
                    <button
                      type="button"
                      onClick={() => setPlayStyle('practice')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#F6C915] px-4 py-2 text-xs font-extrabold text-[#1D0830] hover:bg-[#FFE047] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <InfinityIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Play Endless</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Main 12-Col Layout: 8 Cols Primary Stage + 4 Cols Stats & Guess Log */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Primary Game Stage */}
              <div className="lg:col-span-8 space-y-4">
                <div
                  className={`relative rounded-2xl border bg-white/95 dark:bg-[#210736]/95 shadow-xl overflow-hidden transition-colors ${
                    isWon
                      ? 'border-emerald-500/60 dark:border-emerald-400/55'
                      : isGaveUp
                      ? 'border-rose-400/55 dark:border-rose-400/45'
                      : 'border-[#D7C4EC] dark:border-[#D4A437]/35'
                  }`}
                >
                  {/* Subtle Brand Watermark */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none select-none absolute inset-0 flex items-center justify-center z-0"
                  >
                    <img
                      src="/assets/aistudio/3d_logo_944e5372.png"
                      alt=""
                      className="w-[85%] h-[85%] object-contain opacity-[0.06] dark:opacity-15"
                    />
                  </div>

                  <div className="relative z-10 flex flex-col">
                    {/* Mode-fitted Ladder Stage */}
                    <div
                      className={
                        game?.mode === 'quad'
                          ? 'relative min-h-[520px] sm:h-[520px] flex flex-col justify-center overflow-hidden'
                          : game?.mode === 'dual'
                          ? 'relative min-h-[450px] flex flex-col justify-center overflow-hidden'
                          : 'relative min-h-[360px] flex flex-col justify-center overflow-hidden'
                      }
                    >
                      {loading || !game ? (
                        <div className="p-8 text-center space-y-2">
                          <p className="text-sm font-bold text-[#8F6500] dark:text-[#F6C915]">
                            Preparing {playStyle === 'daily' ? 'Daily' : 'Practice'}{' '}
                            {formatModeLabel(mode)}...
                          </p>
                          <p className="text-xs text-[#6B4A8A] dark:text-[#C8B2E4]">
                            Loading {langMeta.label} dictionary
                          </p>
                        </div>
                      ) : game.mode === 'quad' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 grid-rows-4 sm:grid-rows-2 gap-2.5 p-3 h-full">
                          {game.boards.map((board) => (
                            <LadderBoard
                              key={board.boardIndex}
                              board={board}
                              isQuad={true}
                              isSelected={selectedBoardIndex === board.boardIndex}
                              onSelectBoard={() =>
                                setSelectedBoardIndex((prev) =>
                                  prev === board.boardIndex ? null : board.boardIndex
                                )
                              }
                              canUseHints={isPlaying}
                              hintsRemaining={game.hintsRemaining}
                              onUseHint={handleUseHint}
                              isGaveUp={Boolean(isGaveUp)}
                              clockOffsetMs={0}
                              hideQuadSolvedPopup={isFinished}
                            />
                          ))}
                        </div>
                      ) : (
                        game.boards.map((board) => (
                          <LadderBoard
                            key={board.boardIndex}
                            board={board}
                            isQuad={false}
                            embedded={true}
                            canUseHints={isPlaying}
                            hintsRemaining={game.hintsRemaining}
                            onUseHint={handleUseHint}
                            isGaveUp={Boolean(isGaveUp)}
                            clockOffsetMs={0}
                          />
                        ))
                      )}

                      {/* Centered Solo Round Summary Overlay */}
                      {game && isFinished && (
                        <div
                          role="dialog"
                          aria-label="Round Summary"
                          className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-[3px] p-4 animate-in fade-in zoom-in-95 duration-200"
                        >
                          <div className="w-full max-w-[440px] rounded-2xl border-2 border-[#F6C915]/75 bg-[#1B052E]/96 p-5 sm:p-6 shadow-2xl space-y-4">
                            <div className="text-center space-y-1">
                              <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#F6C915]/50 bg-[#F6C915]/15 text-[#F6C915]">
                                <Trophy className="h-5 w-5" aria-hidden="true" />
                              </div>
                              <p className="text-xs font-bold text-[#F6C915]">
                                {game.dailyDate
                                  ? `Daily ${formatModeLabel(game.mode)} · ${game.dailyDate}`
                                  : `Practice ${formatModeLabel(game.mode)}`}
                              </p>
                              <h2 className="text-2xl font-black tracking-tight text-white">
                                {isWon ? 'Puzzle Solved!' : 'Words Revealed'}
                              </h2>
                            </div>

                            {revealedWords.length > 0 && (
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                {revealedWords.map((word) => (
                                  <span
                                    key={word}
                                    className="rounded-lg border border-emerald-400/55 bg-emerald-600/25 px-3 py-1 font-mono text-sm font-black uppercase tracking-[0.14em] text-emerald-100"
                                  >
                                    {word}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-[#140321] p-3 text-center">
                              <div>
                                <div className="text-[11px] text-[#BFA8DC]">Score</div>
                                <div className="font-mono text-base font-extrabold tabular-nums text-[#F6C915]">
                                  {game.score.toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] text-[#BFA8DC]">Guesses</div>
                                <div className="font-mono text-base font-extrabold tabular-nums text-white">
                                  {game.totalGuesses}
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] text-[#BFA8DC]">Time</div>
                                <div className="font-mono text-base font-extrabold tabular-nums text-emerald-300">
                                  {formatDuration(elapsedMs)}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleCopyResults}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-[#2B0B46] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#3A105E] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                              >
                                {copiedShare ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>Share Result</span>
                                  </>
                                )}
                              </button>

                              {playStyle === 'daily' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (mode === 'classic') setMode('dual');
                                    else if (mode === 'dual') setMode('quad');
                                    else setPlayStyle('practice');
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#F6C915] px-4 py-2.5 text-xs font-extrabold text-[#1D0830] hover:bg-[#FFE047] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                                  <span>
                                    {mode === 'classic'
                                      ? 'Try Daily Dual'
                                      : mode === 'dual'
                                      ? 'Try Daily Quad'
                                      : 'Play Endless Practice'}
                                  </span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void startBoard('practice', mode, dictionaryLanguage, true)
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#F6C915] px-4 py-2.5 text-xs font-extrabold text-[#1D0830] hover:bg-[#FFE047] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>Play Again</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Typed Guess Input Bar docked directly beneath the board */}
                    <div className="border-t border-[#E6D9F5] dark:border-[#D4A437]/25 bg-[#F8F3FD]/90 dark:bg-[#19052B]/90 px-4 py-3.5">
                      <GuessInputBar
                        mode={game?.mode ?? mode}
                        disabled={!isPlaying || submitting || loading}
                        selectedBoardIndex={selectedBoardIndex}
                        onSelectBoard={setSelectedBoardIndex}
                        onSubmitGuess={(rawWord) => {
                          void handleSubmitGuess(rawWord);
                        }}
                        feedback={feedback}
                        placeholder="Type any dictionary word (any length)..."
                        disabledPlaceholder={
                          isFinished
                            ? 'Round complete — start a new puzzle to keep playing.'
                            : 'Loading puzzle...'
                        }
                        helperText="Enter any valid dictionary word (2+ letters) to narrow the A–Z bracket."
                        disabledHelperText={
                          isFinished
                            ? 'Round finished. Switch modes or start a new puzzle.'
                            : 'Preparing your puzzle...'
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Sidebar: Personal Stats + Current Round Guesses */}
              <aside className="lg:col-span-4 space-y-4">
                {/* Personal Stats Card */}
                <section className="rounded-2xl border border-[#D7C4EC] dark:border-[#D4A437]/25 bg-white/95 dark:bg-[#210736]/90 p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-extrabold text-[#2B0938] dark:text-white">Your Solo Stats</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthModalTab('leaderboards');
                        setAuthModalOpen(true);
                      }}
                      className="text-xs font-bold text-[#8F6500] dark:text-[#F6C915] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Leaderboard
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-[#F8F3FD] dark:bg-[#140321] border border-[#E6D9F5] dark:border-white/10 p-3">
                      <div className="text-[11px] text-[#6B4A8A] dark:text-[#BFA8DC]">Best Score</div>
                      <div className="font-mono text-lg font-extrabold tabular-nums text-[#8F6500] dark:text-[#F6C915]">
                        {stats.bestScore.toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F8F3FD] dark:bg-[#140321] border border-[#E6D9F5] dark:border-white/10 p-3">
                      <div className="text-[11px] text-[#6B4A8A] dark:text-[#BFA8DC]">Win Rate</div>
                      <div className="font-mono text-lg font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {winRate}%
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F8F3FD] dark:bg-[#140321] border border-[#E6D9F5] dark:border-white/10 p-3">
                      <div className="text-[11px] text-[#6B4A8A] dark:text-[#BFA8DC]">Win Streak</div>
                      <div className="font-mono text-lg font-extrabold tabular-nums text-[#2B0938] dark:text-white">
                        {stats.currentStreak}{' '}
                        <span className="text-[11px] font-semibold text-[#6B4A8A] dark:text-[#BFA8DC]">
                          (best {stats.bestStreak})
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F8F3FD] dark:bg-[#140321] border border-[#E6D9F5] dark:border-white/10 p-3">
                      <div className="text-[11px] text-[#6B4A8A] dark:text-[#BFA8DC]">Solved</div>
                      <div className="font-mono text-lg font-extrabold tabular-nums text-[#2B0938] dark:text-white">
                        {stats.gamesWon}
                        <span className="text-[11px] font-semibold text-[#6B4A8A] dark:text-[#BFA8DC]">
                          /{stats.gamesPlayed}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#6B4A8A] dark:text-[#C8B2E4] pt-1 border-t border-[#E6D9F5] dark:border-white/10 font-mono tabular-nums">
                    <span>Best Classic: {stats.fewestClassic ?? '—'}</span>
                    <span>Dual: {stats.fewestDual ?? '—'}</span>
                    <span>Quad: {stats.fewestQuad ?? '—'}</span>
                  </div>
                </section>

                {/* Guess History Log */}
                <section className="rounded-2xl border border-[#D7C4EC] dark:border-[#D4A437]/25 bg-white/95 dark:bg-[#210736]/90 p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-extrabold text-[#2B0938] dark:text-white">Round Guesses</h2>
                    <span className="font-mono text-xs tabular-nums text-[#6B4A8A] dark:text-[#C8B2E4]">
                      {game?.totalGuesses ?? 0} total
                    </span>
                  </div>

                  {!game || game.guessFeed.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#D7C4EC] dark:border-white/15 bg-[#F8F3FD] dark:bg-[#140321]/70 px-3 py-6 text-center text-xs text-[#6B4A8A] dark:text-[#BFA8DC]">
                      Type any {langMeta.label} word below to place your first bracket on the
                      alphabetical ladder.
                    </div>
                  ) : (
                    <ul className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                      {game.guessFeed.slice(0, 30).map((item, idx) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-[#E6D9F5] dark:border-white/10 bg-[#F8F3FD] dark:bg-[#140321] px-3 py-2 text-xs"
                        >
                          <span className="font-mono font-extrabold uppercase tracking-[0.12em] text-[#2B0938] dark:text-white truncate">
                            {item.word}
                          </span>
                          <span
                            className={`font-semibold shrink-0 ${
                              item.status === 'solved'
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : item.status === 'duplicate'
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-[#6B4A8A] dark:text-[#BFA8DC]'
                            }`}
                          >
                            {item.status === 'solved'
                              ? 'Solved'
                              : item.status === 'duplicate'
                              ? 'Already tried'
                              : `#${Math.max(1, game.guessFeed.length - idx)}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-[#E6D9F5] dark:border-white/10 text-[11px] text-[#6B4A8A] dark:text-[#BFA8DC]">
                    <span>
                      {(game?.dictionarySize ?? 0).toLocaleString()} {langMeta.label} words active
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('rules')}
                      className="inline-flex items-center gap-1 font-semibold text-[#8F6500] dark:text-[#F6C915] hover:underline cursor-pointer"
                    >
                      <BookOpen className="h-3 w-3" aria-hidden="true" />
                      <span>Rules</span>
                    </button>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        )}
      </main>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        user={user}
        initialGameId="wordhunt"
        initialTab={authModalTab}
      />
    </div>
  );
}
