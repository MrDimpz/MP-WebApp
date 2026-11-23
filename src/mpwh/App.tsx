import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Eye,
  Play,
  Radio,
  RotateCcw,
  Sparkles,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { LiveOverlayButton } from '@/components/interactive-games/live-overlay-button';
import { LanguageMenu } from '@/components/language-menu';
import {
  getDictionaryLanguageMeta,
  useDictionaryLanguage,
} from '@/lib/dictionary-languages';
import {
  recordInteractiveRoundCompleted,
  tryConsumeOrCheckNextRound,
  useInteractiveDailyLimit,
} from '@/lib/interactive-daily-limits';
import {
  getActiveInteractiveStreamerSession,
  touchActiveInteractiveStreamerSession,
} from '@/lib/interactive-key-auth';
import {
  createEventDeduplicator,
  liveChatBridge,
} from '@/lib/live-chat-bridge';
import { useOverlayConfig, useOverlaySync } from '@/lib/live-overlay';
import {
  creditInteractiveScoreByTikTokHandle,
  useUnifiedAuth,
} from '@/lib/unified-game-auth';
import { GuessInputBar } from './components/GuessInputBar';
import { GuessMarquee } from './components/GuessMarquee';
import { HowToPlayView } from './components/HowToPlayView';
import { LadderBoard } from './components/LadderBoard';
import { LeaderboardView } from './components/LeaderboardView';
import { MpwhOverlayView } from './components/MpwhOverlayView';
import { TikTokLiveModal } from './components/TikTokLiveModal';
import { WinnerModal } from './components/WinnerModal';
import { useMpwhSocket } from './hooks/useMpwhSocket';
import type {
  GuessOutcomePayload,
  LadderMode,
  MpwhOverlayState,
  MpwhTikTokStatus,
} from './shared/types';
import { formatDuration, formatModeLabel } from './utils/format';
import { soundFX } from './utils/sound';

type ActiveTab = 'play' | 'leaderboard' | 'rules';

function normalizeChannelSlug(raw: string): string {
  const clean = raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 48);
  return clean || 'global';
}

/**
 * Extracts a single 4-8 letter guess word from TikTok chat comments.
 * Ignores multi-word conversational messages so normal chat stays noise-free.
 */
function parseTikTokChatGuess(comment: string): string | null {
  const trimmed = String(comment || '').trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  const cmdMatch = trimmed.match(/^(?:!guess|!g|!word|!w|\/g)\s+([^\s]+)$/i);
  if (cmdMatch) {
    candidate = cmdMatch[1];
  } else {
    const stripped = trimmed.replace(
      /^[.,!?;:'"()[\]]+|[.,!?;:'"()[\]]+$/g,
      ''
    );
    if (/\s/.test(stripped)) return null;
    candidate = stripped;
  }
  const normalized = candidate
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (normalized.length < 4 || normalized.length > 8) return null;
  return normalized;
}

export default function App() {
  const overlayConfig = useOverlayConfig();
  if (overlayConfig.isOverlay) {
    return <MpwhOverlayRoute />;
  }
  return <MpwhHostApp />;
}

function MpwhOverlayRoute() {
  const overlayConfig = useOverlayConfig();
  const [syncedState, setSyncedState] = useState<MpwhOverlayState | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('mpwh-overlay-lock');
    return () => {
      html.classList.remove('mpwh-overlay-lock');
    };
  }, []);

  const { isReceivingHostSync } = useOverlaySync<MpwhOverlayState>({
    gameId: 'mpwh',
    streamer: overlayConfig.streamer,
    channel: overlayConfig.channel,
    isOverlay: true,
    localState: null,
    onSyncedState: (next) => setSyncedState(next),
  });

  return (
    <MpwhOverlayView
      state={syncedState}
      bgMode={overlayConfig.bg}
      isReceivingHostSync={isReceivingHostSync}
    />
  );
}

function MpwhHostApp() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('mpwh-hide-scrollbar');
    return () => {
      html.classList.remove('mpwh-hide-scrollbar');
    };
  }, []);
  const { user: siteUser } = useUnifiedAuth();
  const activeStreamer = getActiveInteractiveStreamerSession();
  const [dictionaryLanguage] = useDictionaryLanguage();
  const dailyLimit = useInteractiveDailyLimit('mpwh');

  const [activeTab, setActiveTab] = useState<ActiveTab>('play');
  const [muted, setMuted] = useState(() => soundFX.isMuted());
  const [selectedBoardIndex, setSelectedBoardIndex] = useState<number | null>(
    null
  );
  const [feedback, setFeedback] = useState<{
    text: string;
    tone: 'error' | 'success' | 'info';
  } | null>(null);
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [showTikTokModal, setShowTikTokModal] = useState(false);

  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('mpwh_player_name');
      if (saved && saved.trim()) return saved.trim().slice(0, 24);
    } catch {
      // ignore
    }
    return (
      activeStreamer?.displayHandle ||
      siteUser?.displayName?.trim() ||
      'Host'
    ).slice(0, 24);
  });

  // Derive an isolated channel slug for this streamer/host so multiple hosts don't collide
  const hostChannel = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const explicit = params.get('channel') || params.get('room');
      if (explicit) return normalizeChannelSlug(explicit);
    }
    if (activeStreamer?.username) {
      return normalizeChannelSlug(activeStreamer.username);
    }
    if (siteUser?.linkedTikTokHandle) {
      return normalizeChannelSlug(siteUser.linkedTikTokHandle);
    }
    try {
      const existing = localStorage.getItem('mpwh_local_channel');
      if (existing) return normalizeChannelSlug(existing);
      const created = `mpwh_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('mpwh_local_channel', created);
      return created;
    } catch {
      return 'global';
    }
  }, [activeStreamer?.username, siteUser?.linkedTikTokHandle]);

  const [tiktokStatus, setTiktokStatus] = useState<MpwhTikTokStatus>({
    connected: false,
    mode: 'live',
    username:
      activeStreamer?.username?.replace(/^@+/, '') ||
      siteUser?.linkedTikTokHandle?.replace(/^@+/, '') ||
      null,
    chatEventsProcessed: 0,
    guessesAccepted: 0,
    lastError: null,
  });

  const feedbackTimerRef = useRef<number | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const prevRoundIdRef = useRef<string | null>(null);
  const creditedRoundsRef = useRef<Set<string>>(new Set());
  const chatDedupRef = useRef(createEventDeduplicator());

  const showFeedback = useCallback(
    (text: string, tone: 'error' | 'success' | 'info' = 'info') => {
      setFeedback({ text, tone });
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
      }, 3600);
    },
    []
  );

  const handleGuessResult = useCallback(
    (res: GuessOutcomePayload) => {
      if (!res.accepted) {
        soundFX.playInvalid();
        if (res.reason) showFeedback(res.reason, 'error');
        return;
      }
      if (res.matchedWords && res.matchedWords.length > 0) {
        soundFX.playWordSolved();
        if (res.wasLagBufferHit) {
          showFeedback(
            `Caught inside the 4-second lag window! Winner credit earned!`,
            'success'
          );
        } else {
          showFeedback(
            `Word found! 4-second stream-lag window is open for delayed viewers.`,
            'success'
          );
        }
        return;
      }
      soundFX.playPlace();
      setFeedback(null);
    },
    [showFeedback]
  );

  const handleSocketError = useCallback(
    (message: string) => {
      soundFX.playInvalid();
      showFeedback(message, 'error');
    },
    [showFeedback]
  );

  const {
    connected,
    onlineCount,
    game,
    leaderboard,
    clockOffsetMs,
    setMode,
    startGame,
    submitGuess,
    useHint,
    revealGame,
  } = useMpwhSocket({
    channel: hostChannel,
    playerName,
    language: dictionaryLanguage,
    onGuessResult: handleGuessResult,
    onError: handleSocketError,
  });

  // Live elapsed timer during active round
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!game?.startedAt) {
      setElapsedMs(0);
      return;
    }
    if (game.status !== 'playing') {
      setElapsedMs(
        game.finishedAt ? Math.max(0, game.finishedAt - game.startedAt) : 0
      );
      return;
    }
    const update = () => {
      setElapsedMs(Math.max(0, Date.now() + clockOffsetMs - game.startedAt!));
    };
    update();
    const id = window.setInterval(update, 500);
    return () => window.clearInterval(id);
  }, [game?.startedAt, game?.finishedAt, game?.status, clockOffsetMs]);

  // Reset board selection & winner modal on new round
  useEffect(() => {
    if (!game) return;
    if (prevRoundIdRef.current !== game.roundId) {
      prevRoundIdRef.current = game.roundId;
      setSelectedBoardIndex(null);
      setWinnerModalOpen(false);
    }
  }, [game?.roundId]);

  // Trigger celebratory confetti, sound, daily round completion, and Missing Piece profile score crediting on win
  useEffect(() => {
    if (!game) return;
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = game.status;

    if (
      (game.status === 'won' || game.status === 'gave_up') &&
      prevStatus === 'playing' &&
      game.roundNumber >= 1
    ) {
      recordInteractiveRoundCompleted('mpwh', `${game.roundId}-${game.status}`);
      touchActiveInteractiveStreamerSession();
    }

    if (game.status === 'won' && prevStatus !== 'won') {
      setWinnerModalOpen(true);
      soundFX.playVictory();
      void confetti({
        particleCount: 85,
        spread: 72,
        origin: { y: 0.58 },
        colors: ['#F6C915', '#A855F7', '#34D399', '#FFE46B'],
      });

      // Credit winners to linked Missing Piece profiles once per roundId
      if (!creditedRoundsRef.current.has(game.roundId)) {
        creditedRoundsRef.current.add(game.roundId);
        for (const winner of game.roundWinners) {
          const handle = winner.tiktokHandle || winner.name;
          if (!handle) continue;
          creditInteractiveScoreByTikTokHandle({
            tiktokUsername: handle,
            gameId: 'mpwh',
            pointsEarned: winner.score,
            reason: `Word Hunt Extreme R#${game.roundNumber} (${winner.wordsFound.join(', ').toUpperCase()})`,
          });
        }
      }
    }
  }, [game]);

  // Subscribe to site-wide liveChatBridge status & chat comments (Direct TikTok LIVE, TikFinity, BetterTok, Test Simulator)
  useEffect(() => {
    const unsubStatus = liveChatBridge.onStatus((st) => {
      setTiktokStatus((prev) => ({
        ...prev,
        connected: st.connected,
        username: st.username || prev.username,
        lastError: st.error || null,
      }));
    });

    const unsubChat = liveChatBridge.onChat((evt) => {
      if (!chatDedupRef.current.shouldProcess('chat', evt)) return;
      if (!evt.comment?.trim()) return;
      touchActiveInteractiveStreamerSession();

      const candidateWord = parseTikTokChatGuess(evt.comment);
      setTiktokStatus((prev) => ({
        ...prev,
        chatEventsProcessed: prev.chatEventsProcessed + 1,
        guessesAccepted: prev.guessesAccepted + (candidateWord ? 1 : 0),
      }));

      if (!candidateWord) return;
      submitGuess(candidateWord, {
        playerName: evt.nickname || evt.username || evt.uniqueId || 'Viewer',
        tiktokHandle: evt.uniqueId || evt.username || evt.nickname || undefined,
        avatarUrl: evt.profilePictureUrl || evt.avatar || undefined,
        targetBoardIndex: null,
        silent: true,
      });
    });

    return () => {
      unsubStatus();
      unsubChat();
    };
  }, [submitGuess]);

  // Sync live state to TikTok LIVE Studio / OBS Overlay
  const overlayState = useMemo<MpwhOverlayState | null>(() => {
    if (!game) return null;
    return {
      roundId: game.roundId,
      roundNumber: game.roundNumber,
      mode: game.mode,
      language: game.language,
      status: game.status,
      boards: game.boards,
      totalGuesses: game.totalGuesses,
      hintsRemaining: game.hintsRemaining,
      startedAt: game.startedAt,
      finishedAt: game.finishedAt,
      nextRoundAt: game.nextRoundAt,
      roundWinners: game.roundWinners,
      recentActivity: game.recentActivity.slice(0, 6),
      guessFeed: (game.guessFeed ?? []).slice(0, 20),
      tiktokConnected: tiktokStatus.connected,
      tiktokUsername: tiktokStatus.username,
      updatedAt: Date.now(),
    };
  }, [game, tiktokStatus.connected, tiktokStatus.username]);

  const resolvedOverlayStreamer =
    tiktokStatus.username ||
    activeStreamer?.username ||
    siteUser?.linkedTikTokHandle ||
    '';

  useOverlaySync<MpwhOverlayState>({
    gameId: 'mpwh',
    streamer: resolvedOverlayStreamer,
    isOverlay: false,
    localState: overlayState,
    onSyncedState: () => {},
  });

  const handleConnectTikTok = useCallback(
    async (username: string, isTestMode: boolean) => {
      setTiktokStatus((prev) => ({
        ...prev,
        mode: isTestMode ? 'test' : 'live',
        username,
        lastError: null,
      }));
      const res = await liveChatBridge.connectStream(username, 'mpwh', {
        isTestMode,
      });
      if (!res.connected) {
        return {
          ok: false,
          error: res.error || 'Could not connect to TikTok LIVE.',
        };
      }
      return { ok: true };
    },
    []
  );

  const handleDisconnectTikTok = useCallback(() => {
    void liveChatBridge.disconnectStream('mpwh');
    setTiktokStatus((prev) => ({
      ...prev,
      connected: false,
      lastError: null,
    }));
  }, []);

  const handleSendTestChat = useCallback((nickname: string, text: string) => {
    liveChatBridge.emitSimulatedChat(nickname, text);
  }, []);

  const handleStartRound = useCallback(
    (overrideMode?: LadderMode) => {
      if (!tryConsumeOrCheckNextRound('mpwh')) {
        return;
      }
      setWinnerModalOpen(false);
      // Only allow server auto-next-round if unlimited or player still has spare daily rounds
      const allowAutoNext =
        dailyLimit.isUnlimited || dailyLimit.remaining > 1;
      startGame({
        mode: overrideMode ?? game?.mode ?? 'classic',
        language: dictionaryLanguage,
        autoNextRound: allowAutoNext,
      });
    },
    [startGame, game?.mode, dictionaryLanguage, dailyLimit.isUnlimited, dailyLimit.remaining]
  );

  const handleModeSwitch = useCallback(
    (nextMode: LadderMode) => {
      if (game && game.status !== 'idle' && !tryConsumeOrCheckNextRound('mpwh')) {
        return;
      }
      setMode(nextMode);
    },
    [game, setMode]
  );

  const handleUseHint = useCallback(
    (hintType: 'bracket' | 'clue', boardIndex: number, targetIndex: number) => {
      soundFX.playHint();
      useHint(hintType, boardIndex, targetIndex);
    },
    [useHint]
  );

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundFX.setMuted(next);
  };

  const handlePlayerNameChange = (next: string) => {
    const clean = next.slice(0, 24);
    setPlayerName(clean);
    try {
      localStorage.setItem('mpwh_player_name', clean);
    } catch {
      // ignore
    }
  };

  const langMeta = getDictionaryLanguageMeta(dictionaryLanguage);
  const currentMode: LadderMode = game?.mode ?? 'classic';
  const isPlaying = game?.status === 'playing';
  const isIdle = !game || game.status === 'idle';
  const isWon = game?.status === 'won';
  const isGaveUp = game?.status === 'gave_up';

  const modeOptions: Array<{
    id: LadderMode;
    label: string;
    detail: string;
  }> = [
    { id: 'classic', label: 'Classic', detail: '1 Word' },
    { id: 'dual', label: 'Dual Ladder', detail: '2 Words' },
    { id: 'quad', label: 'Quad Hunt', detail: '4 Boards' },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#1D0630] via-[#140321] to-[#0E0218] text-white flex flex-col">
      {/* Top Studio Header */}
      <header className="sticky top-0 z-30 border-b border-[#D4A437]/30 bg-[#160426]/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Back + Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              to="/interactive-games"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#24083B] px-2.5 py-1.5 text-xs font-bold text-[#E5D7F7] hover:border-[#F6C915]/60 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Interactive Games</span>
            </Link>

            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/assets/aistudio/3d_logo_944e5372.png"
                alt="The Missing Piece Emblem"
                className="h-8 w-8 rounded-full object-contain shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-none">
                  Word Hunt Extreme
                </h1>
                <p className="text-[11px] font-medium text-[#C8B2E4] truncate mt-0.5">
                  The Missing Piece · {langMeta.flag} {langMeta.label}
                </p>
              </div>
            </div>
          </div>

          {/* Center: Navigation Tabs */}
          <nav
            aria-label="Word Hunt Extreme views"
            className="flex items-center gap-1 rounded-xl border border-[#D4A437]/25 bg-[#12031E] p-1"
          >
            <button
              type="button"
              onClick={() => setActiveTab('play')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'play'
                  ? 'bg-[#F6C915] text-[#1D0830]'
                  : 'text-[#D4C0EC] hover:text-white'
              }`}
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Play</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'leaderboard'
                  ? 'bg-[#F6C915] text-[#1D0830]'
                  : 'text-[#D4C0EC] hover:text-white'
              }`}
            >
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Leaderboard</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'rules'
                  ? 'bg-[#F6C915] text-[#1D0830]'
                  : 'text-[#D4C0EC] hover:text-white'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>How to Play</span>
            </button>
          </nav>

          {/* Right: Language, Overlay, TikTok LIVE, Sound */}
          <div className="flex items-center gap-2 shrink-0">
            <LanguageMenu variant="compact" />

            <LiveOverlayButton
              gameTitle="Word Hunt Extreme"
              gameSlug="mpwh"
              streamerHandle={resolvedOverlayStreamer || undefined}
              recommendedSize="620 × 900 or 1080 × 1920"
              label="Overlay"
            />

            <button
              type="button"
              onClick={() => setShowTikTokModal(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
                tiktokStatus.connected
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/30'
                  : 'bg-[#F6C915] border-[#F6C915] text-[#1D0830] hover:bg-[#FFE047]'
              }`}
            >
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {tiktokStatus.connected && tiktokStatus.username
                  ? `@${tiktokStatus.username}`
                  : 'TikTok LIVE'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-[#24083B] text-[#E5D7F7] hover:border-[#F6C915]/60 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              {muted ? (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-3 sm:px-5 py-5 sm:py-6">
        {activeTab === 'leaderboard' ? (
          <LeaderboardView entries={leaderboard} />
        ) : activeTab === 'rules' ? (
          <HowToPlayView />
        ) : (
          <div className="space-y-5">
            {/* Control Strip: Mode Selector, Player Name, Metadata, Start/Reveal */}
            <div className="rounded-2xl border border-[#D4A437]/30 bg-[#210736]/90 p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Mode Switcher */}
              <div className="flex flex-wrap items-center gap-1.5">
                {modeOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleModeSwitch(opt.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      currentMode === opt.id
                        ? 'bg-[#F6C915] text-[#1D0830]'
                        : 'bg-[#140321] border border-[#D4A437]/25 text-[#D9C7EE] hover:border-[#F6C915]/50 hover:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span
                      className={`text-[10px] font-semibold ${
                        currentMode === opt.id
                          ? 'text-[#3A1658]'
                          : 'text-[#A78BC9]'
                      }`}
                    >
                      {opt.detail}
                    </span>
                  </button>
                ))}
              </div>

              {/* Unboxed Round Metadata + Name + Action */}
              <div className="flex flex-wrap items-center gap-3 justify-between lg:justify-end">
                {/* Inline Player Name */}
                <label className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#140321] px-2.5 py-1.5 text-xs">
                  <User className="h-3.5 w-3.5 text-[#F6C915]" aria-hidden="true" />
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => handlePlayerNameChange(e.target.value)}
                    aria-label="Your display name"
                    className="w-24 sm:w-28 bg-transparent text-xs font-bold leading-normal py-0.5 text-white focus:outline-none"
                  />
                </label>

                {/* Tabular Live Stats */}
                <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-[#D4C0EC]">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[#F6C915]" aria-hidden="true" />
                    {onlineCount}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-[#F6C915]" aria-hidden="true" />
                    {formatDuration(elapsedMs)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-[#F6C915]" aria-hidden="true" />
                    {game?.hintsRemaining ?? 3} hints
                  </span>
                </div>

                {/* Primary Round Action */}
                <div className="flex items-center gap-2">
                  {isPlaying && (
                    <button
                      type="button"
                      onClick={revealGame}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/18 bg-[#2B0B46] px-3 py-2 text-xs font-bold text-[#E5D7F7] hover:bg-[#3A105E] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reveal</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleStartRound()}
                    disabled={!connected}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#F6C915] px-4 py-2 text-xs font-extrabold text-[#1D0830] hover:bg-[#FFE047] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {isIdle ? (
                      <>
                        <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        <span>Start Game</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>New Round</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Main Play Area + Live Activity Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left / Primary Stage — Fixed-height unified panel across all round states */}
              <div className="lg:col-span-8 space-y-4">
                <div
                  className={`relative rounded-2xl border bg-[#210736]/95 shadow-xl overflow-hidden transition-colors ${
                    !isIdle && game && game.boards.every((b) => b.lockedSolved)
                      ? 'border-emerald-400/50'
                      : !isIdle &&
                        game &&
                        game.boards.some((b) =>
                          b.targets.some((t) => t.bufferActive)
                        )
                      ? 'border-[#F6C915] shadow-[0_0_0_1px_rgba(246,201,21,0.3)]'
                      : 'border-[#D4A437]/35'
                  }`}
                >
                  {/* Missing Piece Emblem Watermark (25% opacity, 90% size of main board section) */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none select-none absolute inset-0 flex items-center justify-center z-0"
                  >
                    <img
                      src="/assets/aistudio/3d_logo_944e5372.png"
                      alt=""
                      className="w-[90%] h-[90%] object-contain opacity-25"
                    />
                  </div>

                  <div className="relative z-10 flex flex-col">
                    {/* Fixed-Height Game Field Stage */}
                    <div
                      className={
                        !isIdle && game?.mode === 'quad'
                          ? 'min-h-[524px] sm:h-[524px] flex flex-col justify-center overflow-hidden'
                          : 'h-[524px] flex flex-col justify-center overflow-hidden'
                      }
                    >
                      {isIdle || !game || game.boards.length === 0 ? (
                        <div className="p-6 sm:p-8 text-center space-y-5">
                          <img
                            src="/assets/aistudio/3d_logo_944e5372.png"
                            alt="The Missing Piece Word Hunt Extreme"
                            className="mx-auto h-16 w-16 rounded-full object-contain drop-shadow-lg"
                          />
                          <div className="space-y-2 max-w-md mx-auto">
                            <p className="text-xs font-extrabold uppercase tracking-widest text-[#F6C915]">
                              {formatModeLabel(currentMode)} · {langMeta.flag}{' '}
                              {langMeta.label}
                            </p>
                            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                              Ready for Word Hunt Extreme?
                            </h2>
                            <p className="text-sm text-[#D9C7EE] leading-relaxed">
                              Press Start Game to generate a secret 4–8 letter word.
                              Every guess narrows the alphabetical ladder above and
                              below—with a 4-second TikTok LIVE stream-lag window on
                              every win.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() => handleStartRound()}
                              className="inline-flex items-center gap-2 rounded-xl bg-[#F6C915] px-6 py-3 text-sm font-black text-[#1D0830] hover:bg-[#FFE047] transition-colors cursor-pointer shadow-lg whitespace-nowrap shrink-0"
                            >
                              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                              <span>Start {formatModeLabel(currentMode)}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowTikTokModal(true)}
                              className="inline-flex items-center gap-2 rounded-xl border border-[#D4A437]/45 bg-[#140321] px-5 py-3 text-sm font-bold text-[#F6C915] hover:bg-[#2C0C47] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <Radio className="h-4 w-4" aria-hidden="true" />
                              <span>
                                {tiktokStatus.connected
                                  ? `LIVE: @${tiktokStatus.username}`
                                  : 'Connect TikTok LIVE'}
                              </span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={
                            game.mode === 'quad'
                              ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3'
                              : 'w-full'
                          }
                        >
                          {game.boards.map((board) => (
                            <LadderBoard
                              key={board.boardIndex}
                              board={board}
                              isQuad={game.mode === 'quad'}
                              embedded={game.mode !== 'quad'}
                              isSelected={
                                game.mode === 'quad' &&
                                selectedBoardIndex === board.boardIndex
                              }
                              onSelectBoard={
                                game.mode === 'quad'
                                  ? () =>
                                      setSelectedBoardIndex((prev) =>
                                        prev === board.boardIndex
                                          ? null
                                          : board.boardIndex
                                      )
                                  : undefined
                              }
                              canUseHints={isPlaying}
                              hintsRemaining={game.hintsRemaining}
                              onUseHint={handleUseHint}
                              isGaveUp={isGaveUp}
                              hideQuadSolvedPopup={isWon || isGaveUp}
                              clockOffsetMs={clockOffsetMs}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Merged Sideways-Scrolling Player Guess Marquee (Always Rendered) */}
                    <GuessMarquee items={game?.guessFeed ?? []} embedded />
                  </div>
                </div>

                {/* Guess Input Bar (Always Mounted) */}
                <div className="rounded-2xl border border-[#D4A437]/30 bg-[#210736]/95 p-4 shadow-xl">
                  <GuessInputBar
                    mode={game?.mode ?? currentMode}
                    disabled={!isPlaying}
                    selectedBoardIndex={selectedBoardIndex}
                    onSelectBoard={setSelectedBoardIndex}
                    onSubmitGuess={(word) =>
                      submitGuess(word, {
                        playerName,
                        tiktokHandle:
                          activeStreamer?.username?.replace(/^@+/, '') ||
                          siteUser?.linkedTikTokHandle?.replace(/^@+/, '') ||
                          undefined,
                        avatarUrl: siteUser?.photoURL || undefined,
                        targetBoardIndex: selectedBoardIndex,
                      })
                    }
                    feedback={feedback}
                    winNotice={
                      isWon && game
                        ? {
                            roundNumber: game.roundNumber,
                            onViewWinners: () => setWinnerModalOpen(true),
                          }
                        : null
                    }
                  />
                </div>
              </div>

              {/* Right Sidebar: Live Activity Feed & Stream Status */}
              <aside className="lg:col-span-4 space-y-4">
                {/* TikTok LIVE Quick Panel */}
                <div className="rounded-2xl border border-[#D4A437]/30 bg-[#210736]/95 p-4 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#F6C915]">
                      TikTok LIVE Feed
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTikTokModal(true)}
                      className="text-xs font-bold text-[#E5D7F7] hover:text-[#F6C915] underline underline-offset-2 cursor-pointer"
                    >
                      Configure
                    </button>
                  </div>
                  <p className="text-xs text-[#D4C0EC] leading-relaxed">
                    {tiktokStatus.connected && tiktokStatus.username ? (
                      <>
                        Connected to{' '}
                        <strong className="text-emerald-300">
                          @{tiktokStatus.username}
                        </strong>
                        . Viewers type any 4–8 letter word in chat to climb the
                        ladder.
                      </>
                    ) : (
                      <>
                        Connect your TikTok LIVE stream, TikFinity/BetterTok
                        webhooks, or the Test Simulator so viewers can solve
                        together in real time.
                      </>
                    )}
                  </p>
                </div>

                {/* Live Activity Log */}
                <div className="rounded-2xl border border-[#D4A437]/30 bg-[#210736]/95 p-4 shadow-xl">
                  <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/10">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#F6C915]">
                      Live Activity
                    </h3>
                    <span className="font-mono text-[11px] tabular-nums text-[#C8B2E4]">
                      {game?.totalGuesses ?? 0} guesses
                    </span>
                  </div>

                  {!game || game.recentActivity.length === 0 ? (
                    <p className="text-xs text-[#B8A0D6] py-6 text-center">
                      Guesses, hints, and winners will appear here live.
                    </p>
                  ) : (
                    <ul className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {game.recentActivity.map((item) => (
                        <li
                          key={item.id}
                          className={`rounded-lg px-3 py-2 text-xs font-medium border ${
                            item.tone === 'solve'
                              ? 'border-emerald-400/40 bg-emerald-950/45 text-emerald-100'
                              : item.tone === 'buffer'
                              ? 'border-[#F6C915]/55 bg-[#F6C915]/15 text-[#FFF3B0]'
                              : item.tone === 'hint'
                              ? 'border-purple-400/40 bg-purple-950/60 text-purple-100'
                              : item.tone === 'system'
                              ? 'border-white/12 bg-[#140321] text-[#D9C7EE]'
                              : 'border-white/8 bg-[#180528] text-[#F2EAFF]'
                          }`}
                        >
                          {item.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>

      {/* Winner Celebration Modal */}
      {game && (
        <WinnerModal
          game={game}
          clockOffsetMs={clockOffsetMs}
          open={winnerModalOpen}
          onClose={() => setWinnerModalOpen(false)}
          onStartNextRound={() => handleStartRound()}
        />
      )}

      {/* TikTok LIVE Connectivity & Test Simulator Modal */}
      <TikTokLiveModal
        isOpen={showTikTokModal}
        status={tiktokStatus}
        defaultHandle={
          activeStreamer?.username?.replace(/^@+/, '') ||
          siteUser?.linkedTikTokHandle?.replace(/^@+/, '') ||
          ''
        }
        onConnect={handleConnectTikTok}
        onDisconnect={handleDisconnectTikTok}
        onSendTestChat={handleSendTestChat}
        onClose={() => setShowTikTokModal(false)}
      />
    </div>
  );
}
