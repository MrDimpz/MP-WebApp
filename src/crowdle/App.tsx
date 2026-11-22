import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import {
  Trophy,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  HelpCircle,
  RefreshCw,
  FastForward,
  ShieldAlert,
  Radio,
  Send,
  Zap,
  Award,
  CheckCircle2,
  X,
  Flame,
  Infinity as InfinityIcon,
  Lock,
  MessageSquare,
} from 'lucide-react';
import './index.css';
import {
  dictionary,
  isValidCrowdleWord,
  pickTargetWord,
  evaluateCrowdleGuess,
  EvaluatedLetter,
  LetterStatus,
} from './dictionary';
import { crowdleSounds } from './sound';
import {
  useOverlayConfig,
  useOverlaySync,
} from '@/lib/live-overlay';
import { LiveOverlayButton } from '@/components/interactive-games/live-overlay-button';
import {
  triggerResilientConnect,
  forceReconnectBridge,
  createEventDeduplicator,
  attachResilientChatListeners,
} from '@/lib/live-chat-bridge';
import {
  useUnifiedAuth,
  getCleanDisplayName,
  saveUnifiedLeaderboardScore,
  creditInteractiveScoreByTikTokHandle,
  getCurrentUserSessionPrefix,
} from '@/lib/unified-game-auth';
import {
  getActiveInteractiveStreamerSession,
  touchActiveInteractiveStreamerSession,
} from '@/lib/interactive-key-auth';
import {
  recordInteractiveRoundCompleted,
  tryConsumeOrCheckNextRound,
} from '@/lib/interactive-daily-limits';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';
import {
  getLocalTodayDateStr,
  recordDailyPuzzleSolved,
  useDailyStreak,
} from '@/lib/daily-streak';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import { triggerVictoryConfetti } from '@/lib/confetti';
import { LanguageMenu } from '@/components/language-menu';
import { useDictionaryLanguage } from '@/lib/dictionary-languages';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const MAX_GUESSES = 5;

export type CrowdleStatus =
  | 'PLAYING'
  | 'WON'
  | 'CELEBRATING'
  | 'LOST'
  | 'DEFEATED';

export interface CrowdleGuess {
  word: string;
  evaluation: EvaluatedLetter[];
  votes: number;
  topVoter?: string;
}

export interface TargetWordGuesser {
  uniqueId: string;
  nickname: string;
  avatar: string;
}

export interface LiveVoteFeedItem {
  id: string;
  uniqueId: string;
  nickname: string;
  avatar: string;
  word: string;
  isValid: boolean;
  isExactMatch?: boolean;
  timestamp: number;
}

interface CrowdleOverlaySnapshot {
  roundId: number;
  guesses: CrowdleGuess[];
  status: CrowdleStatus;
  timeLeft: number;
  delayLeft: number;
  resetTimeLeft: number;
  roundTimerDuration: number;
  topVotes: [string, number][];
  totalVotes: number;
  wordLength: number;
  streak: number;
  totalStreak: number;
  endlessStreak: number;
  isEndlessMode: boolean;
  revealedTargetWord?: string;
  targetWordGuesser: TargetWordGuesser | null;
}

const DEMO_VIEWERS = [
  { uniqueId: 'wordmaster_uk', nickname: 'WordMaster', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=WordMaster' },
  { uniqueId: 'lexi_queen', nickname: 'LexiQueen', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=LexiQueen' },
  { uniqueId: 'puzzle_knight', nickname: 'PuzzleKnight', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=PuzzleKnight' },
  { uniqueId: 'neon_solver', nickname: 'NeonSolver', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=NeonSolver' },
  { uniqueId: 'gold_striker', nickname: 'GoldStriker', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=GoldStriker' },
  { uniqueId: 'sky_vortex', nickname: 'SkyVortex', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=SkyVortex' },
];

export default function CrowdleApp() {
  const { isOverlay, streamer: overlayStreamer, bg: overlayBg } = useOverlayConfig();
  const transparent = overlayBg === 'transparent';
  const todayDateStr = useMemo(() => getLocalTodayDateStr(), []);
  const dailyStreak = useDailyStreak('crowdle', todayDateStr);
  const [dictionaryLanguage] = useDictionaryLanguage();
  const prevDictLangRef = useRef(dictionaryLanguage);

  // Theme & Audio
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('mp_crowdle_theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [isMuted, setIsMuted] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Unified Account State
  const { user: unifiedUser } = useUnifiedAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('mp_crowdle_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    crowdleSounds.muted = next;
  };

  // Core Game State
  const [roundId, setRoundId] = useState<number>(1);
  const [wordLength, setWordLength] = useState<number>(5);
  const [targetWord, setTargetWord] = useState<string>(() => pickTargetWord(5));
  const [guesses, setGuesses] = useState<CrowdleGuess[]>([]);
  const [status, setStatus] = useState<CrowdleStatus>('PLAYING');
  const [roundTimerDuration, setRoundTimerDuration] = useState<number>(30);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [delayLeft, setDelayLeft] = useState<number>(3);
  const [resetTimeLeft, setResetTimeLeft] = useState<number>(0);

  // Streaks & Modes
  const [streak, setStreak] = useState<number>(0);
  const [totalStreak, setTotalStreak] = useState<number>(0);
  const [endlessStreak, setEndlessStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('mp_crowdle_best_streak') || '0');
    } catch {
      return 0;
    }
  });
  const [isEndlessMode, setIsEndlessMode] = useState<boolean>(false);
  const [lastWinningWord, setLastWinningWord] = useState<string | null>(null);

  // Crowd Votes & Solver Tracking
  const [currentVotes, setCurrentVotes] = useState<Record<string, number>>({});
  const [voteOrder, setVoteOrder] = useState<string[]>([]);
  const [userVotedWordMap, setUserVotedWordMap] = useState<Record<string, string>>({});
  const [wordTopVoterMap, setWordTopVoterMap] = useState<Record<string, string>>({});
  const [allowMultiVotePerUser, setAllowMultiVotePerUser] = useState<boolean>(false);

  const [targetWordGuesser, setTargetWordGuesser] = useState<TargetWordGuesser | null>(null);
  const [voteFeed, setVoteFeed] = useState<LiveVoteFeedItem[]>([]);

  // Host Interactive Controls
  const [hostDraftWord, setHostDraftWord] = useState<string>('');
  const [hostVoteInput, setHostVoteInput] = useState<string>('');

  // TikTok Live Connection State
  const [tiktokUsername, setTiktokUsername] = useState<string>(() => {
    const activeStreamer = getActiveInteractiveStreamerSession();
    if (activeStreamer?.username) {
      return activeStreamer.username.replace(/^@+/, '');
    }
    try {
      return localStorage.getItem('crowdle_tiktok_user') || overlayStreamer || '';
    } catch {
      return overlayStreamer || '';
    }
  });
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Refs for latest state inside intervals/socket callbacks
  const stateRef = useRef({
    roundId,
    wordLength,
    targetWord,
    guesses,
    status,
    roundTimerDuration,
    timeLeft,
    delayLeft,
    resetTimeLeft,
    streak,
    totalStreak,
    endlessStreak,
    bestStreak,
    isEndlessMode,
    lastWinningWord,
    currentVotes,
    voteOrder,
    userVotedWordMap,
    wordTopVoterMap,
    allowMultiVotePerUser,
    targetWordGuesser,
  });

  useEffect(() => {
    stateRef.current = {
      roundId,
      wordLength,
      targetWord,
      guesses,
      status,
      roundTimerDuration,
      timeLeft,
      delayLeft,
      resetTimeLeft,
      streak,
      totalStreak,
      endlessStreak,
      bestStreak,
      isEndlessMode,
      lastWinningWord,
      currentVotes,
      voteOrder,
      userVotedWordMap,
      wordTopVoterMap,
      allowMultiVotePerUser,
      targetWordGuesser,
    };
  });

  // Compute sorted top votes
  const topVotes = useMemo<[string, number][]>(() => {
    return Object.entries(currentVotes)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return voteOrder.indexOf(a[0]) - voteOrder.indexOf(b[0]);
      })
      .slice(0, 12);
  }, [currentVotes, voteOrder]);

  const totalVotes = useMemo(() => {
    return Object.values(currentVotes).reduce((acc, v) => acc + v, 0);
  }, [currentVotes]);

  // Credit a crowd player's score in Unified Auth if linked
  const awardPlayerPoints = useCallback(
    (
      uniqueId: string,
      nickname: string,
      pointsDelta: number,
      reason: string
    ) => {
      const cleanId = (uniqueId || nickname || 'viewer').trim();
      if (pointsDelta > 0 && cleanId && cleanId !== 'host') {
        creditInteractiveScoreByTikTokHandle({
          tiktokUsername: cleanId,
          gameId: 'crowdle',
          pointsEarned: pointsDelta,
          reason,
        });
      }
    },
    []
  );

  // Start a fresh round
  const startNewRound = useCallback(
    (overrideLength?: number, overrideEndless?: boolean) => {
      const st = stateRef.current;
      if (!isOverlay) {
        const allowed = tryConsumeOrCheckNextRound('crowdle', `round-${st.roundId}`);
        if (!allowed) return;
      }
      const endless = overrideEndless !== undefined ? overrideEndless : st.isEndlessMode;
      const nextLen = endless ? 5 : overrideLength !== undefined ? overrideLength : st.wordLength;
      const nextTarget = pickTargetWord(nextLen, st.lastWinningWord || st.targetWord);

      const initialGuesses: CrowdleGuess[] = [];
      if (endless && st.lastWinningWord && st.lastWinningWord.length === 5 && st.lastWinningWord !== nextTarget) {
        initialGuesses.push({
          word: st.lastWinningWord,
          evaluation: evaluateCrowdleGuess(st.lastWinningWord, nextTarget),
          votes: 0,
          topVoter: 'Chain Carryover',
        });
      }

      setRoundId((prev) => prev + 1);
      setWordLength(nextLen);
      setTargetWord(nextTarget);
      setGuesses(initialGuesses);
      setStatus('PLAYING');
      setCurrentVotes({});
      setVoteOrder([]);
      setUserVotedWordMap({});
      setWordTopVoterMap({});
      setTimeLeft(st.roundTimerDuration);
      setDelayLeft(3);
      setResetTimeLeft(0);
      setTargetWordGuesser(null);
      setHostDraftWord('');
    },
    [isOverlay]
  );

  // Switch active target word & clear current round guesses when dictionary language changes
  useEffect(() => {
    if (prevDictLangRef.current === dictionaryLanguage) return;
    prevDictLangRef.current = dictionaryLanguage;
    if (isOverlay) return;
    const st = stateRef.current;
    const nextTarget = pickTargetWord(st.wordLength, null, dictionaryLanguage);
    setTargetWord(nextTarget);
    setGuesses([]);
    setStatus('PLAYING');
    setCurrentVotes({});
    setVoteOrder([]);
    setUserVotedWordMap({});
    setWordTopVoterMap({});
    setTimeLeft(st.roundTimerDuration);
    setDelayLeft(3);
    setResetTimeLeft(0);
    setTargetWordGuesser(null);
    setLastWinningWord(null);
    setHostDraftWord('');
  }, [dictionaryLanguage, isOverlay]);

  // Record finished Crowdle rounds toward the 3/day free limit (unlimited for key holders)
  useEffect(() => {
    if (isOverlay) return;
    if (status === 'WON' || status === 'LOST') {
      recordInteractiveRoundCompleted('crowdle', `round-${roundId}`);
    }
  }, [isOverlay, status, roundId]);

  // Submit a guess word (either from top crowd vote or host lock)
  const submitGuessWord = useCallback(
    (wordToSubmit: string, voteCount: number = 1, topVoterName?: string) => {
      const st = stateRef.current;
      if (st.status !== 'PLAYING') return;
      const clean = wordToSubmit.trim().toUpperCase();
      if (clean.length !== st.wordLength) return;

      const evaluation = evaluateCrowdleGuess(clean, st.targetWord);
      const newGuess: CrowdleGuess = {
        word: clean,
        evaluation,
        votes: voteCount,
        topVoter: topVoterName || st.wordTopVoterMap[clean] || 'Crowd Consensus',
      };

      const nextGuesses = [...st.guesses, newGuess];
      setGuesses(nextGuesses);
      setCurrentVotes({});
      setVoteOrder([]);
      setUserVotedWordMap({});
      setWordTopVoterMap({});
      setHostDraftWord('');

      // Play tile flip sounds
      for (let i = 0; i < st.wordLength; i++) {
        crowdleSounds.playTileFlip(i);
      }

      if (clean === st.targetWord) {
        // ROUND WON!
        setStatus('WON');
        setResetTimeLeft(11);
        setLastWinningWord(st.targetWord);
        crowdleSounds.playVictory();
        recordDailyPuzzleSolved('crowdle', todayDateStr);
        triggerVictoryConfetti();

        let nextStreak = st.streak;
        let nextTotalStreak = st.totalStreak;
        let nextEndlessStreak = st.endlessStreak;
        let nextWordLen = st.wordLength;

        if (st.isEndlessMode) {
          nextEndlessStreak = st.endlessStreak + 1;
          setEndlessStreak(nextEndlessStreak);
        } else {
          nextStreak = st.streak + 1;
          nextTotalStreak = st.totalStreak + 1;
          if (nextStreak >= 5) {
            if (st.wordLength < 8) {
              nextWordLen = st.wordLength + 1;
              nextStreak = 0;
            }
          }
          setStreak(nextStreak);
          setTotalStreak(nextTotalStreak);
          setWordLength(nextWordLen);
        }

        const effectiveStreak = Math.max(nextTotalStreak, nextEndlessStreak, st.bestStreak);
        if (effectiveStreak > st.bestStreak) {
          setBestStreak(effectiveStreak);
          try {
            localStorage.setItem('mp_crowdle_best_streak', String(effectiveStreak));
          } catch {
            // ignore
          }
        }
        saveUnifiedLeaderboardScore({
          gameId: 'squared',
          score: Math.max(100, effectiveStreak * 150),
        });
      } else if (nextGuesses.length >= MAX_GUESSES) {
        // ROUND LOST! Wait 20 seconds on defeat before starting the next round
        setStreak(0);
        setTotalStreak(0);
        setEndlessStreak(0);
        setLastWinningWord(null);
        if (!st.isEndlessMode) {
          setWordLength(5);
        }
        setStatus('LOST');
        setResetTimeLeft(23); // 3s tile flip + 20s defeat screen before next round
        crowdleSounds.playDefeat();
      } else {
        // Continue to next row
        crowdleSounds.playRowLock();
        setTimeLeft(st.roundTimerDuration);
        setDelayLeft(3);
      }
    },
    [todayDateStr]
  );

  // Process an incoming vote from TikTok Live chat or simulator
  const processIncomingVote = useCallback(
    (rawComment: string, uniqueId: string, nickname: string, avatar: string) => {
      const st = stateRef.current;
      if (st.status !== 'PLAYING') return;

      // Extract first candidate token matching wordLength or exact trimmed word
      const cleanedMsg = rawComment.trim().toUpperCase();
      const tokens = cleanedMsg.split(/[^A-Z]+/).filter(Boolean);
      const candidate =
        tokens.find((t) => t.length === st.wordLength) ||
        (cleanedMsg.replace(/[^A-Z]/g, '').length === st.wordLength
          ? cleanedMsg.replace(/[^A-Z]/g, '')
          : '');

      if (!candidate || candidate.length !== st.wordLength) return;

      // Prevent voting for a word already guessed in this round
      if (st.guesses.some((g) => g.word === candidate)) return;

      const valid = isValidCrowdleWord(candidate, st.wordLength);
      const feedItem: LiveVoteFeedItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        uniqueId,
        nickname,
        avatar,
        word: candidate,
        isValid: valid,
        isExactMatch: candidate === st.targetWord,
        timestamp: Date.now(),
      };
      setVoteFeed((prev) => [feedItem, ...prev.slice(0, 39)]);

      if (!valid) return;

      const voterKey = (uniqueId || nickname || 'anon').toLowerCase();
      const previousWord = st.userVotedWordMap[voterKey];

      // If user already voted this exact word on this row and multi-vote is off, ignore duplicate
      if (!st.allowMultiVotePerUser && previousWord === candidate) {
        return;
      }

      crowdleSounds.playVoteTick();

      setCurrentVotes((prev) => {
        const next = { ...prev };
        if (!st.allowMultiVotePerUser && previousWord && next[previousWord]) {
          next[previousWord] = Math.max(0, next[previousWord] - 1);
          if (next[previousWord] === 0) {
            delete next[previousWord];
          }
        }
        next[candidate] = (next[candidate] || 0) + 1;
        return next;
      });

      setVoteOrder((prev) => (prev.includes(candidate) ? prev : [...prev, candidate]));
      setUserVotedWordMap((prev) => ({ ...prev, [voterKey]: candidate }));
      setWordTopVoterMap((prev) => ({
        ...prev,
        [candidate]: prev[candidate] || nickname || uniqueId,
      }));

      // Check if this viewer is the FIRST to find the target word!
      const isFirstSolver = candidate === st.targetWord && !st.targetWordGuesser;
      if (isFirstSolver) {
        setTargetWordGuesser({
          uniqueId,
          nickname: nickname || uniqueId,
          avatar:
            avatar ||
            `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(uniqueId)}`,
        });
        awardPlayerPoints(
          uniqueId,
          nickname,
          50,
          `First to find "${st.targetWord}" in Crowdle!`
        );
      } else {
        awardPlayerPoints(
          uniqueId,
          nickname,
          10,
          `Voted "${candidate}" in Crowdle`
        );
      }
    },
    [awardPlayerPoints]
  );

  // 100ms Master Game Loop (Host only; Overlay receives state via useOverlaySync)
  useEffect(() => {
    if (isOverlay) return;

    const interval = setInterval(() => {
      const st = stateRef.current;

      if (st.status === 'PLAYING') {
        if (st.delayLeft > 0) {
          setDelayLeft((prev) => Math.max(0, +(prev - 0.1).toFixed(2)));
        } else if (st.timeLeft > 0) {
          setTimeLeft((prev) => Math.max(0, +(prev - 0.1).toFixed(2)));
        } else {
          // Time is up for this row! Check if we have votes
          const entries = Object.entries(st.currentVotes);
          if (entries.length > 0) {
            const sorted = entries.sort((a, b) => {
              if (b[1] !== a[1]) return b[1] - a[1];
              return st.voteOrder.indexOf(a[0]) - st.voteOrder.indexOf(b[0]);
            });
            const [winningWord, topCount] = sorted[0];
            submitGuessWord(winningWord, topCount);
          } else {
            // No votes cast yet — reset timer for another sync cycle
            setTimeLeft(st.roundTimerDuration);
          }
        }
      } else if (
        st.status === 'WON' ||
        st.status === 'CELEBRATING' ||
        st.status === 'LOST' ||
        st.status === 'DEFEATED'
      ) {
        const nextReset = +(st.resetTimeLeft - 0.1).toFixed(2);
        if (st.status === 'WON' && nextReset <= 8) {
          setStatus('CELEBRATING');
        } else if (st.status === 'LOST' && nextReset <= 20) {
          setStatus('DEFEATED');
        }

        if (nextReset <= 0) {
          startNewRound();
        } else {
          setResetTimeLeft(Math.max(0, nextReset));
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isOverlay, startNewRound, submitGuessWord]);

  // Connect to TikTok Live Bridge via Socket.IO
  useEffect(() => {
    if (isOverlay) return;

    const deduplicator = createEventDeduplicator();
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      query: {
        sessionId: getCurrentUserSessionPrefix(),
        gameId: 'crowdle',
      },
    });
    socketRef.current = socket;

    const handleChatPayload = (data: Record<string, unknown>) => {
      const commentText = String(data?.comment ?? data?.text ?? '').trim();
      if (!commentText) return;
      touchActiveInteractiveStreamerSession();
      const uid = String(data?.uniqueId || data?.userId || data?.username || 'viewer').replace(
        /^@+/,
        ''
      );
      const nick = String(data?.nickname || uid).replace(/^@+/, '');
      const avatar = String(
        data?.profilePictureUrl ||
          data?.avatar ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(uid)}`
      );
      processIncomingVote(commentText, uid, nick, avatar);
    };

    socket.on(
      'tiktok-connected',
      ({ username, gameId }: { username: string; gameId?: string }) => {
        if (!gameId || gameId === 'crowdle') {
          setIsConnected(true);
          setIsConnecting(false);
          if (username) setTiktokUsername(username.replace(/^@+/, ''));
          setConnectionError(null);
        }
      }
    );

    socket.on(
      'tiktok-status',
      (st: { connected: boolean; username?: string; gameId?: string }) => {
        if (st && (!st.gameId || st.gameId === 'crowdle')) {
          setIsConnected(Boolean(st.connected));
          setIsConnecting(false);
          if (st.username) setTiktokUsername(st.username.replace(/^@+/, ''));
        }
      }
    );

    socket.on('tiktok-disconnected', (payload?: { gameId?: string }) => {
      if (!payload?.gameId || payload.gameId === 'crowdle') {
        setIsConnected(false);
        setIsConnecting(false);
      }
    });

    socket.on('tiktok-error', (msg: string) => {
      setIsConnecting(false);
      setConnectionError(msg || 'Connection error');
    });

    socket.on('chat-message', (data: Record<string, unknown>) => {
      if (deduplicator.shouldProcess('chat', data)) {
        handleChatPayload(data);
      }
    });

    const detachChat = attachResilientChatListeners({
      onChat: handleChatPayload,
      deduplicator,
    });

    return () => {
      detachChat();
      socket.disconnect();
    };
  }, [isOverlay, processIncomingVote]);

  const handleConnectTikTok = () => {
    if (!socketRef.current || !tiktokUsername.trim()) return;
    const clean = tiktokUsername.trim().replace(/^@/, '');
    setTiktokUsername(clean);
    try {
      localStorage.setItem('crowdle_tiktok_user', clean);
    } catch {
      // ignore
    }
    setIsConnecting(true);
    setConnectionError(null);
    triggerResilientConnect(
      socketRef.current,
      {
        username: clean,
        isTestMode: false,
        gameId: 'crowdle',
        sessionId: getCurrentUserSessionPrefix(),
      },
      ({ username: uname }) => {
        setIsConnected(true);
        setIsConnecting(false);
        if (uname) setTiktokUsername(uname.replace(/^@+/, ''));
      }
    );
  };

  const handleDisconnectTikTok = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('disconnect-tiktok', {
      gameId: 'crowdle',
      sessionId: getCurrentUserSessionPrefix(),
    });
    setIsConnected(false);
    setIsConnecting(false);
  };

  // Overlay Real-Time Sync Snapshot (quantize 100ms timer ticks to whole seconds so network/CEF aren't flooded 10x/sec)
  const ceilTimeLeft = Math.ceil(timeLeft);
  const ceilDelayLeft = Math.ceil(delayLeft);
  const ceilResetTimeLeft = Math.ceil(resetTimeLeft);

  const hostOverlaySnapshot = useMemo<CrowdleOverlaySnapshot>(
    () => ({
      roundId,
      guesses,
      status,
      timeLeft: ceilTimeLeft,
      delayLeft: ceilDelayLeft,
      resetTimeLeft: ceilResetTimeLeft,
      roundTimerDuration,
      topVotes,
      totalVotes,
      wordLength,
      streak,
      totalStreak,
      endlessStreak,
      isEndlessMode,
      revealedTargetWord: status !== 'PLAYING' ? targetWord : undefined,
      targetWordGuesser,
    }),
    [
      roundId,
      guesses,
      status,
      ceilTimeLeft,
      ceilDelayLeft,
      ceilResetTimeLeft,
      roundTimerDuration,
      topVotes,
      totalVotes,
      wordLength,
      streak,
      totalStreak,
      endlessStreak,
      isEndlessMode,
      targetWord,
      targetWordGuesser,
    ]
  );

  const [overlayRemoteState, setOverlayRemoteState] =
    useState<CrowdleOverlaySnapshot | null>(null);

  useOverlaySync<CrowdleOverlaySnapshot>({
    gameId: 'crowdle',
    streamer: isOverlay ? overlayStreamer || undefined : tiktokUsername || undefined,
    isOverlay,
    localState: isOverlay ? null : hostOverlaySnapshot,
    onSyncedState: useCallback((synced) => {
      setOverlayRemoteState(synced);
    }, []),
  });

  // Active display state (uses synced remote state when running inside OBS/TikTok overlay)
  const activeState: CrowdleOverlaySnapshot =
    isOverlay && overlayRemoteState ? overlayRemoteState : hostOverlaySnapshot;

  // Compute keyboard letter statuses from active guesses
  const keyboardStatus = useMemo<Record<string, LetterStatus>>(() => {
    const map: Record<string, LetterStatus> = {};
    activeState.guesses.forEach((guess) => {
      guess.evaluation.forEach(({ letter, status: st }) => {
        const current = map[letter];
        if (st === 'correct') {
          map[letter] = 'correct';
        } else if (st === 'present' && current !== 'correct') {
          map[letter] = 'present';
        } else if (st === 'absent' && !current) {
          map[letter] = 'absent';
        }
      });
    });
    return map;
  }, [activeState.guesses]);

  // Simulate a burst of realistic viewer votes so the streamer can test/demo anytime
  const handleSimulateCrowdRush = () => {
    const pool = dictionary[wordLength] || dictionary[5];
    const available = pool.filter((w) => !guesses.some((g) => g.word === w));
    if (available.length === 0) return;

    // Pick 3-4 candidate words (occasionally including the target word if on row 3+)
    const candidates: string[] = [];
    if (guesses.length >= 2 && Math.random() < 0.45) {
      candidates.push(targetWord);
    }
    while (candidates.length < 4) {
      const rand = available[Math.floor(Math.random() * available.length)];
      if (!candidates.includes(rand)) candidates.push(rand);
    }

    DEMO_VIEWERS.forEach((viewer, idx) => {
      setTimeout(() => {
        const chosen =
          idx < 3 ? candidates[0] : candidates[idx % candidates.length];
        processIncomingVote(
          chosen,
          `${viewer.uniqueId}_${Math.floor(Math.random() * 90 + 10)}`,
          viewer.nickname,
          viewer.avatar
        );
      }, idx * 140);
    });
  };

  const handleHostVoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = hostVoteInput.trim().toUpperCase();
    if (!clean) return;
    const displayName = unifiedUser ? getCleanDisplayName(unifiedUser) : 'Stream Host';
    processIncomingVote(
      clean,
      displayName,
      displayName,
      'https://api.dicebear.com/7.x/bottts/svg?seed=Host'
    );
    setHostVoteInput('');
  };

  const handleLockTopVoteNow = () => {
    if (status !== 'PLAYING') return;
    if (topVotes.length > 0) {
      const [topWord, topCount] = topVotes[0];
      submitGuessWord(topWord, topCount);
    } else if (
      hostDraftWord.length === wordLength &&
      isValidCrowdleWord(hostDraftWord, wordLength)
    ) {
      submitGuessWord(hostDraftWord, 1, 'Stream Host');
    }
  };

  // Handle physical or on-screen keyboard clicks for host draft word
  const handleKeyPress = useCallback(
    (key: string) => {
      if (isOverlay || status !== 'PLAYING') return;
      if (key === 'BACKSPACE') {
        setHostDraftWord((prev) => prev.slice(0, -1));
      } else if (key === 'ENTER') {
        if (
          hostDraftWord.length === wordLength &&
          isValidCrowdleWord(hostDraftWord, wordLength)
        ) {
          const displayName = unifiedUser ? getCleanDisplayName(unifiedUser) : 'Stream Host';
          processIncomingVote(
            hostDraftWord,
            displayName,
            displayName,
            'https://api.dicebear.com/7.x/bottts/svg?seed=Host'
          );
          setHostDraftWord('');
        }
      } else if (/^[A-Z]$/.test(key)) {
        setHostDraftWord((prev) => (prev.length < wordLength ? prev + key : prev));
      }
    },
    [hostDraftWord, isOverlay, processIncomingVote, status, unifiedUser, wordLength]
  );

  // Render the core Crowdle Broadcast Arena (shared between Host center column and OBS Overlay)
  const renderBroadcastArena = () => {
    const isTumbling =
      activeState.status === 'CELEBRATING' ||
      activeState.status === 'DEFEATED';
    const isDark = theme === 'dark' || isOverlay;

    const getTileSize = () => {
      switch (activeState.wordLength) {
        case 6:
          return 'w-12 h-11 text-3xl leading-none';
        case 7:
          return 'w-10 h-10 text-[27px] leading-none';
        case 8:
          return 'w-9 h-10 text-2xl leading-none';
        default:
          return 'w-13 h-11 text-3xl leading-none';
      }
    };

    const getStatusBg = (st: string) => {
      switch (st) {
        case 'correct':
          return 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.45)]';
        case 'present':
          return 'bg-amber-500 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]';
        case 'absent':
          return isDark
            ? 'bg-[#10031c] border-purple-400/55 text-white shadow-inner'
            : 'bg-slate-700 border-slate-800 text-white shadow-inner';
        default:
          return isDark
            ? 'bg-[#23063A]/85 border-purple-500/30 text-white'
            : 'bg-white border-purple-300 text-slate-900';
      }
    };

    const getKeyColor = (key: string) => {
      const st = keyboardStatus[key];
      switch (st) {
        case 'correct':
          return 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.35)]';
        case 'present':
          return 'bg-amber-500 text-white border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]';
        case 'absent':
          return isDark
            ? 'bg-[#0e0219] text-white/85 border-purple-500/45'
            : 'bg-slate-700 text-white border-slate-800';
        default:
          return isDark
            ? 'bg-[#2c0b49] text-purple-100 border-purple-500/30 hover:border-amber-400/60'
            : 'bg-purple-100 text-purple-950 border-purple-300 hover:border-purple-500';
      }
    };

    const revealedAnswer = activeState.revealedTargetWord || targetWord;

    return (
      <div
        className={`w-full rounded-[28px] flex flex-col relative overflow-hidden border transition-all ${
          isOverlay ? 'max-w-[508px] p-5 gap-4' : 'max-w-[430px] p-4 gap-3'
        } ${
          transparent && isOverlay
            ? 'bg-[#170428]/90 border-amber-400/40 shadow-[0_0_45px_rgba(0,0,0,0.85)]'
            : isDark
              ? 'bg-gradient-to-b from-[#23063A] via-[#170428] to-[#11021f] border-amber-400/30 shadow-[0_24px_70px_rgba(0,0,0,0.65)]'
              : 'bg-gradient-to-b from-white via-[#F9F6FF] to-[#F1EAFF] border-purple-300 shadow-xl'
        }`}
      >
        {/* 20% Opacity Background Logo Watermark inside Game Arena */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 flex items-center justify-center z-0"
        >
          <img
            src="/assets/aistudio/3d_logo_944e5372.png"
            alt=""
            className="w-64 h-64 object-contain opacity-20"
          />
        </div>

        {/* Top Live Status Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-purple-500/20 pb-2.5">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <img
                src="/assets/aistudio/3d_logo_944e5372.png"
                alt="The Missing Piece"
                className="w-6 h-6 object-contain drop-shadow-[0_2px_6px_rgba(246,201,21,0.4)]"
              />
              <span className="text-xl font-black tracking-tighter italic bg-gradient-to-r from-[#FFE55C] via-[#F6C915] to-[#10b981] bg-clip-text text-transparent">
                CROWDLE
              </span>
              <span className="ml-[20px] bg-rose-500/20 text-rose-400 text-[9px] font-black px-1.5 py-0.5 rounded border border-rose-500/30 animate-pulse">
                LIVE
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {!activeState.isEndlessMode ? (
                <>
                  <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25 w-fit">
                    <Trophy className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                      Sync: {activeState.streak}/5
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25 w-fit">
                    <Flame className="w-2.5 h-2.5 text-amber-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">
                      Streak: {activeState.totalStreak}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-400/30 w-fit">
                  <InfinityIcon className="w-3 h-3 text-purple-300" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-purple-300">
                    Endless Chain: {activeState.endlessStreak}
                  </span>
                </div>
              )}
              <div className="bg-amber-400/15 text-amber-300 border border-amber-400/30 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                {activeState.wordLength} Letters
              </div>
            </div>
          </div>

          {/* Decision Sync Countdown Clock */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
              isDark
                ? 'bg-[#120221]/90 border-purple-500/30'
                : 'bg-purple-100 border-purple-300'
            }`}
          >
            <Clock
              className={`w-3.5 h-3.5 ${
                activeState.timeLeft <= 5 && activeState.delayLeft === 0
                  ? 'text-rose-400 animate-bounce'
                  : 'text-amber-400'
              }`}
            />
            <span
              className={`font-mono text-base font-black ${
                activeState.timeLeft <= 5 && activeState.delayLeft === 0
                  ? 'text-rose-400'
                  : isDark
                    ? 'text-white'
                    : 'text-purple-950'
              }`}
            >
              00:
              {(activeState.delayLeft > 0
                ? activeState.delayLeft
                : activeState.timeLeft
              )
                .toString()
                .padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Decision Sync Progress Bar */}
        <div className="relative z-10 space-y-1">
          <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-purple-300/75 px-0.5">
            <span>
              {activeState.delayLeft > 0 ? 'Initiating Sync' : 'Decision Sync — Type Word in Chat'}
            </span>
            <span>
              {activeState.delayLeft > 0
                ? `Starting in ${activeState.delayLeft}s`
                : `${activeState.timeLeft}s`}
            </span>
          </div>
          <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden p-0.5 border border-purple-500/20">
            <motion.div
              className={`h-full rounded-full ${
                activeState.delayLeft > 0
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                  : activeState.timeLeft <= 5
                    ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                    : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
              }`}
              initial={{ width: '100%' }}
              animate={{
                width: `${
                  activeState.delayLeft > 0
                    ? (activeState.delayLeft / 3) * 100
                    : (activeState.timeLeft / Math.max(1, activeState.roundTimerDuration)) * 100
                }%`,
              }}
              transition={{ duration: 0.2, ease: 'linear' }}
            />
          </div>
        </div>

        {/* 5-Row Wordle Grid + Behind-the-Grid End-of-Round Celebration/Defeat Reveal */}
        <div className="relative z-10 py-1 flex items-center justify-center min-h-[248px]">
          {/* Victory / Defeat Message (Revealed as tiles tumble away) */}
          <AnimatePresence>
            {isTumbling && (
              <motion.div
                key={`outcome-${activeState.status}-${activeState.roundId}`}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ delay: 0.25, duration: 0.45, type: 'spring' }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 z-10 rounded-2xl bg-[#160327]/95 border border-amber-400/30 backdrop-blur-md shadow-2xl"
              >
                {activeState.status === 'CELEBRATING' ? (
                  <div className="space-y-2 flex flex-col items-center">
                    <div className="w-11 h-11 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                      <Trophy className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tighter text-white uppercase italic">
                      Victory!
                    </h2>
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-black text-purple-300/70 uppercase tracking-widest">
                        The secret word was
                      </p>
                      <p className="text-xl font-black text-emerald-400 tracking-[0.22em] uppercase bg-emerald-500/10 px-4 py-1 rounded-xl border border-emerald-500/30">
                        {revealedAnswer}
                      </p>
                    </div>
                    {activeState.targetWordGuesser && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center space-y-1 pt-1"
                      >
                        <span className="text-[8px] font-black text-amber-300 uppercase tracking-widest">
                          First to find it (+50 PTS)
                        </span>
                        <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full border border-amber-400/30">
                          <img
                            src={activeState.targetWordGuesser.avatar}
                            alt={activeState.targetWordGuesser.nickname}
                            className="w-5 h-5 rounded-full border border-emerald-400 object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-xs font-black text-white">
                            {activeState.targetWordGuesser.nickname}
                          </span>
                        </div>
                      </motion.div>
                    )}
                    <p className="text-[10px] font-bold text-purple-200/70 uppercase tracking-widest pt-1">
                      Next round in {activeState.resetTimeLeft}s...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 flex flex-col items-center w-full">
                    <div className="w-11 h-11 bg-rose-500/20 rounded-full flex items-center justify-center border border-rose-500/40">
                      <ShieldAlert className="w-6 h-6 text-rose-400" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tighter text-white uppercase italic">
                      Defeated
                    </h2>
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-black text-purple-300/70 uppercase tracking-widest">
                        The word was
                      </p>
                      <p className="text-xl font-black text-rose-400 tracking-[0.22em] uppercase bg-rose-500/10 px-4 py-1 rounded-xl border border-rose-500/30">
                        {revealedAnswer}
                      </p>
                    </div>
                    <p className="text-[10px] font-bold text-purple-200/70 uppercase tracking-widest pt-1">
                      Next round in {activeState.resetTimeLeft}s...
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 5-Row Wordle Grid */}
          <div className="grid grid-rows-5 gap-1.5 relative z-0">
            {Array.from({ length: MAX_GUESSES }).map((_, rowIndex) => {
              const guess = activeState.guesses[rowIndex];
              const isCurrentDraftRow =
                !isOverlay &&
                activeState.status === 'PLAYING' &&
                rowIndex === activeState.guesses.length &&
                hostDraftWord.length > 0;

              return (
                <div
                  key={rowIndex}
                  className="flex gap-1.5 justify-center crowdle-perspective-1000"
                >
                  {Array.from({ length: activeState.wordLength }).map((__, colIndex) => {
                    const letterData = guess?.evaluation[colIndex];
                    const draftChar = isCurrentDraftRow ? hostDraftWord[colIndex] : '';

                    const tumbleDelay = (rowIndex * activeState.wordLength + colIndex) * 0.03;
                    const randomX = ((rowIndex * 7 + colIndex * 13) % 240) - 120;
                    const randomRotate = ((rowIndex * 11 + colIndex * 17) % 90) - 45;

                    return (
                      <motion.div
                        key={`${activeState.roundId}-${rowIndex}-${colIndex}`}
                        initial={false}
                        animate={
                          isTumbling
                            ? {
                                y: 420,
                                x: randomX,
                                rotateZ: randomRotate,
                                rotateX: 180,
                                opacity: 0,
                              }
                            : {
                                rotateX: letterData ? 180 : 0,
                                scale: letterData ? [1, 1.08, 1] : draftChar ? 1.04 : 1,
                                y: 0,
                                x: 0,
                                rotateZ: 0,
                                opacity: 1,
                              }
                        }
                        transition={
                          isTumbling
                            ? {
                                duration: 0.75,
                                delay: tumbleDelay,
                                ease: [0.4, 0, 1, 1],
                              }
                            : {
                                duration: 0.55,
                                delay: letterData ? colIndex * 0.09 : 0,
                                ease: 'easeInOut',
                              }
                        }
                        className={`${getTileSize()} relative crowdle-preserve-3d font-black`}
                      >
                        {/* Front of tile (unflipped) */}
                        <div
                          className={`absolute inset-0 border-2 rounded-xl flex items-center justify-center crowdle-backface-hidden transition-colors ${
                            draftChar
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                              : isDark
                                ? 'bg-[#1c0530]/80 border-purple-500/30 text-white'
                                : 'bg-white border-purple-300 text-purple-950'
                          }`}
                        >
                          {draftChar || ''}
                        </div>

                        {/* Back of tile (flipped with evaluation status) */}
                        <div
                          style={{ transform: 'rotateX(180deg)' }}
                          className={`absolute inset-0 border-2 rounded-xl flex items-center justify-center crowdle-backface-hidden ${
                            letterData
                              ? getStatusBg(letterData.status)
                              : 'bg-[#1c0530] border-purple-500/30'
                          }`}
                        >
                          {letterData?.letter || ''}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Crowd Consensus + Other Guesses */}
        <div className="relative z-10 space-y-2">
          <div className="text-center space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400/90 block">
              Crowd Consensus
            </span>
            <div className="flex flex-col items-center justify-center">
              <AnimatePresence initial={false}>
                {activeState.topVotes.length > 0 ? (
                  <motion.div
                    key={`${activeState.roundId}-${activeState.topVotes[0][0]}`}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-baseline gap-2.5"
                  >
                    <span className="text-2xl font-black tracking-[0.18em] text-emerald-400 font-mono uppercase drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]">
                      {activeState.topVotes[0][0]}
                    </span>
                    <span className="text-[11px] font-black text-amber-300 bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 rounded-full">
                      {activeState.topVotes[0][1]}{' '}
                      {activeState.topVotes[0][1] === 1 ? 'Vote' : 'Votes'}
                    </span>
                  </motion.div>
                ) : (
                  <div
                    key={`empty-${activeState.roundId}`}
                    className="h-8 flex items-center justify-center"
                  >
                    <span className="text-xl font-black tracking-[0.25em] text-purple-300/30 font-mono uppercase italic">
                      {Array(activeState.wordLength).fill('?').join('')}
                    </span>
                  </div>
                )}
              </AnimatePresence>
              <span className="text-[9px] font-bold text-purple-300/60 uppercase tracking-widest mt-0.5">
                {activeState.totalVotes} Total{' '}
                {activeState.totalVotes === 1 ? 'Vote' : 'Votes'} Cast
              </span>
            </div>
          </div>

          {/* Other Guesses Runner-Up Bar */}
          <div
            className={`pt-2 border-t border-purple-500/20 rounded-xl px-2.5 py-2 ${
              isDark ? 'bg-[#120221]/75' : 'bg-purple-100/70'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-purple-300/70">
                Runner-Up Crowd Votes
              </span>
              <span className="text-[8px] font-bold uppercase text-amber-400/80">
                Type {activeState.wordLength}-letter word in chat
              </span>
            </div>
            <div className="h-6 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {activeState.topVotes.length > 1 ? (
                activeState.topVotes.slice(1, 6).map(([word, count]) => (
                  <div
                    key={word}
                    className="flex items-center gap-1.5 bg-purple-950/80 px-2.5 py-0.5 rounded-lg border border-purple-500/30 shrink-0"
                  >
                    <span className="font-mono font-black text-[10px] tracking-widest text-purple-100">
                      {word}
                    </span>
                    <span className="text-[9px] font-black text-emerald-400">{count}</span>
                  </div>
                ))
              ) : (
                <span className="text-[10px] font-bold text-purple-300/40 uppercase tracking-widest italic">
                  Waiting for more crowd guesses...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* QWERTY Letter Tracker Keyboard */}
        <div className="relative z-10 pt-2 border-t border-purple-500/20 space-y-1 select-none">
          {KEYBOARD_ROWS.map((row, rowIdx) => (
            <div key={rowIdx} className="flex justify-center gap-1">
              {rowIdx === 2 && !isOverlay && (
                <button
                  type="button"
                  onClick={() => handleKeyPress('ENTER')}
                  className="px-2 h-7 rounded-md font-black text-[9px] uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/40 hover:bg-amber-500/30 transition-colors"
                >
                  Vote
                </button>
              )}
              {row.map((key) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  className={`w-7 h-7 rounded-md font-black text-[15px] leading-none flex items-center justify-center border transition-all duration-200 ${getKeyColor(
                    key
                  )}`}
                >
                  {key}
                </button>
              ))}
              {rowIdx === 2 && !isOverlay && (
                <button
                  type="button"
                  onClick={() => handleKeyPress('BACKSPACE')}
                  className="px-2 h-7 rounded-md font-black text-[9px] uppercase tracking-wider bg-purple-500/20 text-purple-200 border border-purple-400/30 hover:bg-purple-500/30 transition-colors"
                >
                  Del
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Pure OBS / TikTok LIVE Studio Overlay Mode
  if (isOverlay) {
    return (
      <div
        className={`w-screen min-h-screen flex items-center justify-center p-3 overflow-hidden select-none ${
          transparent ? 'bg-transparent' : 'bg-[#0e021a]'
        }`}
      >
        {renderBroadcastArena()}
      </div>
    );
  }

  const isDark = theme === 'dark';

  return (
    <div
      className={`relative overflow-hidden min-h-screen w-full flex flex-col font-sans selection:bg-amber-400/30 ${
        isDark
          ? 'bg-gradient-to-b from-[#170428] via-[#120221] to-[#0b0114] text-white'
          : 'bg-gradient-to-b from-[#F9F6FF] via-[#F3ECFF] to-[#EAE0FF] text-slate-900'
      }`}
    >
      {/* 20% Opacity Background Logo Watermark on Main Page */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none fixed inset-0 flex items-center justify-center z-0"
      >
        <img
          src="/assets/aistudio/3d_logo_944e5372.png"
          alt=""
          className="w-[460px] h-[460px] object-contain opacity-20"
        />
      </div>

      {/* Top Missing Piece Branded Navigation Header */}
      <header
        className={`w-full border-b px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md sticky top-0 z-30 ${
          isDark
            ? 'bg-[#170428]/90 border-purple-500/25'
            : 'bg-white/90 border-purple-200 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3">
          <a
            href="/interactive-games"
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
              isDark
                ? 'bg-purple-950/60 border-purple-500/30 text-purple-200 hover:border-amber-400/60 hover:text-amber-300'
                : 'bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100'
            }`}
          >
            ← Interactive Games
          </a>

          <div className="flex items-center gap-2.5">
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="The Missing Piece"
              className="w-9 h-9 object-contain drop-shadow-[0_2px_10px_rgba(246,201,21,0.35)]"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight uppercase bg-gradient-to-r from-[#FFE55C] via-[#F6C915] to-[#10b981] bg-clip-text text-transparent">
                  Crowdle
                </h1>
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Interactive Live
                </span>
              </div>
              <p
                className={`text-[10px] font-bold uppercase tracking-widest ${
                  isDark ? 'text-purple-300/60' : 'text-purple-700/70'
                }`}
              >
                The Missing Piece // Crowd-Voted Wordle Arena
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <LanguageMenu variant="compact" />
          <DailyStreakBadge streak={dailyStreak.streak} solvedToday={dailyStreak.solvedToday} />

          <LiveOverlayButton
            gameTitle="Crowdle"
            gameSlug="crowdle"
            streamerHandle={tiktokUsername}
            recommendedSize="540 × 1200 or 1080 × 2400 (20:9)"
            label="LIVE Overlay"
          />

          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 transition-all ${
              isDark
                ? 'bg-amber-400/15 border-amber-400/40 text-amber-300 hover:bg-amber-400/25'
                : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            {unifiedUser ? getCleanDisplayName(unifiedUser) : 'Account & Ranks'}
          </button>

          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className={`p-2 rounded-xl border transition-colors ${
              isDark
                ? 'bg-purple-950/60 border-purple-500/30 text-purple-200 hover:text-amber-300'
                : 'bg-purple-50 border-purple-200 text-purple-900'
            }`}
            title="How to Play Crowdle"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className={`p-2 rounded-xl border transition-colors ${
              isDark
                ? 'bg-purple-950/60 border-purple-500/30 text-purple-200 hover:text-amber-300'
                : 'bg-purple-50 border-purple-200 text-purple-900'
            }`}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-2 rounded-xl border transition-colors ${
              isDark
                ? 'bg-purple-950/60 border-purple-500/30 text-purple-200 hover:text-amber-300'
                : 'bg-purple-50 border-purple-200 text-purple-900'
            }`}
            title="Toggle Light/Dark Mode"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main 3-Column Interactive Studio Layout */}
      <main className="relative z-10 flex-1 max-w-[1440px] w-full mx-auto px-4 lg:px-8 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Live Vote Stream */}
        <section className="lg:col-span-4 flex flex-col gap-4 order-2 lg:order-1">
          {/* Live Chat Vote Feed */}
          <div
            className={`rounded-3xl p-4 border ${
              isDark
                ? 'bg-[#23063A]/70 border-purple-500/30 shadow-xl'
                : 'bg-white border-purple-200 shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-purple-500/20">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-black uppercase tracking-widest">
                  Live Crowd Vote Feed
                </h2>
              </div>
              <span className="text-[10px] font-bold text-emerald-400">
                {wordLength}-Letter Filter Active
              </span>
            </div>

            <div className="space-y-1.5 max-h-[230px] overflow-y-auto pr-1">
              {voteFeed.length === 0 ? (
                <p className="text-xs text-purple-300/50 text-center py-6 italic">
                  Waiting for {wordLength}-letter words from chat...
                </p>
              ) : (
                voteFeed.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs ${
                      item.isValid
                        ? 'bg-emerald-500/10 border-emerald-500/25'
                        : 'bg-rose-500/10 border-rose-500/20 opacity-65'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={item.avatar}
                        alt={item.nickname}
                        className="w-5 h-5 rounded-full object-cover shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <span className="font-bold truncate max-w-[120px]">{item.nickname}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-black tracking-widest uppercase">
                        {item.word}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          item.isValid
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {item.isValid ? 'Counted' : 'Not in Dict'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Host / Test Vote Input */}
            <form onSubmit={handleHostVoteSubmit} className="mt-3 flex gap-2">
              <input
                type="text"
                value={hostVoteInput}
                maxLength={wordLength}
                onChange={(e) => setHostVoteInput(e.target.value.toUpperCase())}
                placeholder={`Cast ${wordLength}-letter vote...`}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-mono font-black uppercase tracking-widest border outline-none ${
                  isDark
                    ? 'bg-[#140224] border-purple-500/35 text-white placeholder:text-purple-300/35 focus:border-amber-400'
                    : 'bg-purple-50 border-purple-200 text-purple-950 focus:border-purple-500'
                }`}
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Vote
              </button>
            </form>
          </div>
        </section>

        {/* CENTER COLUMN: 9:16 Broadcast Arena */}
        <section className="lg:col-span-4 flex flex-col items-center justify-center order-1 lg:order-2">
          {renderBroadcastArena()}
        </section>

        {/* RIGHT COLUMN: TikTok LIVE Connection & Streamer Game Controls */}
        <section className="lg:col-span-4 flex flex-col gap-4 order-3">
          {/* TikTok Live Connection Card */}
          <div
            className={`rounded-3xl p-4 border ${
              isDark
                ? 'bg-[#23063A]/70 border-purple-500/30 shadow-xl'
                : 'bg-white border-purple-200 shadow-md'
            }`}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-purple-500/20">
              <div className="flex items-center gap-2">
                <Radio
                  className={`w-4 h-4 ${
                    isConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'
                  }`}
                />
                <h2 className="text-xs font-black uppercase tracking-widest">
                  TikTok LIVE Chat Bridge
                </h2>
              </div>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  isConnected
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : isConnecting
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                }`}
              >
                {isConnected ? `Connected @${tiktokUsername}` : isConnecting ? 'Connecting...' : 'Ready'}
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={tiktokUsername}
                onChange={(e) => setTiktokUsername(e.target.value)}
                placeholder="TikTok @username"
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border outline-none ${
                  isDark
                    ? 'bg-[#140224] border-purple-500/35 text-white placeholder:text-purple-300/35 focus:border-amber-400'
                    : 'bg-purple-50 border-purple-200 text-purple-950'
                }`}
              />
              {!isConnected ? (
                <button
                  type="button"
                  onClick={handleConnectTikTok}
                  disabled={isConnecting || !tiktokUsername.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#F6C915] to-[#D4A437] text-slate-950 font-black text-xs uppercase tracking-wider disabled:opacity-50"
                >
                  {isConnecting ? 'Syncing...' : 'Connect'}
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (socketRef.current && tiktokUsername) {
                        forceReconnectBridge(socketRef.current, {
                          username: tiktokUsername,
                          gameId: 'crowdle',
                          sessionId: getCurrentUserSessionPrefix(),
                        });
                      }
                    }}
                    className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 hover:bg-amber-500/30"
                    title="Force Reconnect"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectTikTok}
                    className="px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-black text-xs uppercase"
                  >
                    Stop
                  </button>
                </div>
              )}
            </div>

            {connectionError && (
              <p className="mt-2 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3 py-1.5">
                {connectionError}
              </p>
            )}
          </div>

          {/* Host Game Mode & Round Controls */}
          <div
            className={`rounded-3xl p-4 border space-y-4 ${
              isDark
                ? 'bg-[#23063A]/70 border-purple-500/30 shadow-xl'
                : 'bg-white border-purple-200 shadow-md'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-black uppercase tracking-widest">
                  Host Arena Controls
                </h2>
              </div>
              <span className="text-[10px] font-black text-amber-400 uppercase">
                Best Streak: {bestStreak}
              </span>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleLockTopVoteNow}
                disabled={status !== 'PLAYING' || (topVotes.length === 0 && hostDraftWord.length !== wordLength)}
                className="px-3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
              >
                <Lock className="w-3.5 h-3.5" />
                Lock Top Vote
              </button>

              <button
                type="button"
                onClick={() => startNewRound()}
                className="px-3 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-amber-400/20 transition-all"
              >
                <FastForward className="w-3.5 h-3.5" />
                Next Round
              </button>
            </div>

            {/* Endless Chain Mode Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-950/50 border border-purple-500/25">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <InfinityIcon className="w-4 h-4" />
                  Endless Chain Mode
                </p>
                <p className="text-[10px] text-purple-300/70">
                  Each winning 5-letter word becomes Guess #1 of the next round!
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextEndless = !isEndlessMode;
                  setIsEndlessMode(nextEndless);
                  startNewRound(nextEndless ? 5 : wordLength, nextEndless);
                }}
                className={`px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider border transition-all ${
                  isEndlessMode
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-purple-900/60 text-purple-200 border-purple-500/30'
                }`}
              >
                {isEndlessMode ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Word Length Selector (5, 6, 7, 8 Letters) */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-purple-300/80">
                <span>Target Word Length</span>
                <span>{isEndlessMode ? 'Locked to 5L in Endless' : `${wordLength} Letters`}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[5, 6, 7, 8].map((len) => (
                  <button
                    type="button"
                    key={len}
                    disabled={isEndlessMode}
                    onClick={() => startNewRound(len, false)}
                    className={`py-2 rounded-xl font-black text-xs uppercase border transition-all ${
                      wordLength === len
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                        : 'bg-purple-950/50 text-purple-200 border-purple-500/25 hover:border-amber-400/50 disabled:opacity-40'
                    }`}
                  >
                    {len}L
                  </button>
                ))}
              </div>
            </div>

            {/* Decision Sync Timer Duration Selector */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-purple-300/80">
                <span>Decision Sync Timer</span>
                <span>{roundTimerDuration} Seconds</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[20, 30, 45, 60].map((sec) => (
                  <button
                    type="button"
                    key={sec}
                    onClick={() => {
                      setRoundTimerDuration(sec);
                      if (status === 'PLAYING') setTimeLeft(sec);
                    }}
                    className={`py-2 rounded-xl font-black text-xs uppercase border transition-all ${
                      roundTimerDuration === sec
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                        : 'bg-purple-950/50 text-purple-200 border-purple-500/25 hover:border-emerald-400/50'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            {/* Crowd Testing & Stream Simulation Tools */}
            <div className="pt-2 border-t border-purple-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-300/70">
                  Interactive Stream Simulator
                </span>
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-purple-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowMultiVotePerUser}
                    onChange={(e) => setAllowMultiVotePerUser(e.target.checked)}
                    className="rounded accent-amber-400"
                  />
                  Multi-vote per viewer
                </label>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleSimulateCrowdRush}
                  disabled={status !== 'PLAYING'}
                  className="px-3 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/45 border border-purple-400/40 text-purple-100 font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  Simulate Crowd Rush
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* How to Play Modal */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowHelpModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl bg-[#1c0433] border border-amber-400/40 p-6 text-white shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-purple-500/25 pb-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/assets/aistudio/3d_logo_944e5372.png"
                    alt="Logo"
                    className="w-7 h-7 object-contain"
                  />
                  <h3 className="text-lg font-black uppercase tracking-tight text-amber-300">
                    How to Play Crowdle Live
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="p-1.5 rounded-xl bg-purple-900/50 text-purple-200 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-purple-100/90 leading-relaxed">
                <div className="flex gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-white">Crowd Consensus Voting:</strong> Viewers in TikTok LIVE chat type valid N-letter words during the Decision Sync timer. The word with the most votes locks in as the crowd&apos;s official guess!
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-white">Sync Progression (5L → 8L):</strong> Every 5 streak wins in Standard Mode upgrades the word length from 5 letters up to 8 letters. Or switch on <strong className="text-amber-300">Endless Chain Mode</strong> where each winning 5-letter word becomes Guess #1 of the next round!
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-white">First-Finder Bonus:</strong> The first viewer to type the exact hidden word earns a <strong className="text-emerald-300">+50 PT First-to-Find</strong> spotlight. When a round ends in defeat, the next round starts automatically after 20 seconds!
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#F6C915] to-[#D4A437] text-slate-950 font-black text-xs uppercase tracking-wider"
                >
                  Got It, Let&apos;s Play
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Account & Global Leaderboard Modal */}
      <UnifiedAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        user={unifiedUser}
        initialGameId="squared"
      />
    </div>
  );
}
