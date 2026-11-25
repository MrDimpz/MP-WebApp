import './index.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Moon, Radio, Sun, User } from 'lucide-react';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import { LiveOverlayButton } from '@/components/interactive-games/live-overlay-button';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';
import { triggerVictoryConfetti } from '@/lib/confetti';
import { useSiteTheme } from '@/lib/site-theme';
import {
  getLocalTodayDateStr,
  recordDailyPuzzleSolved,
  useDailyStreak,
} from '@/lib/daily-streak';
import {
  recordInteractiveRoundCompleted,
  tryConsumeOrCheckNextRound,
} from '@/lib/interactive-daily-limits';
import {
  getActiveInteractiveStreamerSession,
  touchActiveInteractiveStreamerSession,
} from '@/lib/interactive-key-auth';
import {
  attachResilientChatListeners,
  createEventDeduplicator,
  forceReconnectBridge,
  liveChatBridge,
  triggerResilientConnect,
} from '@/lib/live-chat-bridge';
import { useOverlayConfig, useOverlaySync } from '@/lib/live-overlay';
import {
  creditInteractiveScoreByTikTokHandle,
  getCleanDisplayName,
  getLiveConnectionSessionId,
  useUnifiedAuth,
} from '@/lib/unified-game-auth';
import { BottomDock, HostDrawerTab } from './components/BottomDock';
import { CommandDeck } from './components/CommandDeck';
import { HostDrawer } from './components/HostDrawer';
import { PhysicsArenaCanvas } from './components/PhysicsArenaCanvas';
import { TopHeader } from './components/TopHeader';
import { generateProfilePicture } from './data/avatarGenerator';
import { DEFAULT_LOADOUT, randomBotLoadout } from './data/cosmetics';
import { isValidEnglishWord } from './data/dictionary';
import {
  AVATAR_PALETTE,
  BOT_POOL,
  computeBotWaveAction,
  getBotSubset,
  pickBotWordForWave,
  pickRandomJoinMessage,
} from './engine/botSimulator';
import {
  ALL_PROMPT_RULES,
  DEFAULT_CUSTOM_RULES,
  getWaveDurationSec,
  hasBannedLetter,
  pickNextPromptRule,
  validatePromptRule,
} from './engine/prompts';
import { soundEngine } from './engine/soundEngine';
import { TikTokBridgeClient } from './engine/tiktokBridge';
import {
  ArenaFeedbackEvent,
  ChatMessagePayload,
  CosmeticItem,
  CustomGameRules,
  GamePhase,
  HallOfFameEntry,
  IncomingChatLog,
  Player,
  PlayerLoadout,
  PromptRule,
  WsConnectionState,
} from './types/game';

const STORAGE_KEYS = {
  COINS: 'wbr_coins_v1',
  UNLOCKED: 'wbr_unlocked_v1',
  LOADOUT: 'wbr_loadout_v1',
  HOF: 'wbr_hof_v1',
  LIVE_HANDLE: 'wbr_live_handle_v1',
};

const WAVE_INTRO_DURATION = 2.5;
const ELIMINATION_DURATION = 2.5;
const VICTORY_DURATION = 8.0;

interface WbrOverlaySnapshot {
  phase: GamePhase;
  wave: number;
  timeRemaining: number;
  totalPhaseDuration: number;
  isPaused: boolean;
  players: Player[];
  currentRule: PromptRule | null;
  spinDisplayRule: PromptRule | null;
  burnedWordsList: string[];
  feedbackEvent: ArenaFeedbackEvent | null;
  wipeoutMessage: string | null;
  hallOfFame: HallOfFameEntry[];
  customRules: CustomGameRules;
  isLiveConnected: boolean;
  liveHandle: string;
}

function makePlayerId(username: string): string {
  return username.trim().replace(/^@/, '').toLowerCase();
}

function makeInitials(username: string): string {
  const clean = username.replace(/^@/, '').replace(/[^a-zA-Z0-9]/g, '');
  if (clean.length >= 2) return clean.slice(0, 2).toUpperCase();
  return (clean || 'PL').toUpperCase();
}

function hashColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function loadNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  // Platform Overlay, Unified Auth & Daily Streak Hooks
  const overlayConfig = useOverlayConfig();
  const isOverlay = overlayConfig.isOverlay;
  const { user: currentUser } = useUnifiedAuth();
  const dailyStreak = useDailyStreak('wbr');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  // Core Game State Machine
  const [phase, setPhase] = useState<GamePhase>('LOBBY');
  const [wave, setWave] = useState<number>(1);
  const [customRules, setCustomRules] = useState<CustomGameRules>(DEFAULT_CUSTOM_RULES);
  const [timeRemaining, setTimeRemaining] = useState<number>(DEFAULT_CUSTOM_RULES.lobbyDurationSec);
  const [totalPhaseDuration, setTotalPhaseDuration] = useState<number>(
    DEFAULT_CUSTOM_RULES.lobbyDurationSec
  );
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const [players, setPlayers] = useState<Player[]>([]);
  const [currentRule, setCurrentRule] = useState<PromptRule | null>(null);
  const [spinDisplayRule, setSpinDisplayRule] = useState<PromptRule | null>(null);
  const [burnedWordsList, setBurnedWordsList] = useState<string[]>([]);
  const [feedbackEvent, setFeedbackEvent] = useState<ArenaFeedbackEvent | null>(null);
  const [wipeoutMessage, setWipeoutMessage] = useState<string | null>(null);

  // Audio & UI Controls
  const [muted, setMuted] = useState<boolean>(true);
  const [controlsCollapsed, setControlsCollapsed] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<HostDrawerTab>('chat');

  // Hall of Fame
  const [hallOfFame, setHallOfFame] = useState<HallOfFameEntry[]>(() =>
    loadJson<HallOfFameEntry[]>(STORAGE_KEYS.HOF, [])
  );

  // Avatar Store & Economy
  const [coins, setCoins] = useState<number>(() => loadNumber(STORAGE_KEYS.COINS, 450));
  const [unlockedCosmetics, setUnlockedCosmetics] = useState<Set<string>>(() => {
    const saved = loadJson<string[]>(STORAGE_KEYS.UNLOCKED, [
      'hat:none',
      'trail:none',
      'elimEffect:classic_sparks',
    ]);
    return new Set(saved);
  });
  const [playerLoadout, setPlayerLoadout] = useState<PlayerLoadout>(() =>
    loadJson<PlayerLoadout>(STORAGE_KEYS.LOADOUT, DEFAULT_LOADOUT)
  );
  const [botCosmeticsEnabled, setBotCosmeticsEnabled] = useState<boolean>(true);

  // Simulator & Manual Chat State
  const [testUsername, setTestUsername] = useState<string>('You Live');
  const [simEnabled, setSimEnabled] = useState<boolean>(true);
  const [botCount, setBotCount] = useState<number>(35);
  const [chatLogs, setChatLogs] = useState<IncomingChatLog[]>([]);

  // Built-in Site TikTok LIVE Server Connection State
  const activeStreamerSession = getActiveInteractiveStreamerSession();
  const [liveHandle, setLiveHandle] = useState<string>(() => {
    const fromSession = getActiveInteractiveStreamerSession()?.username || '';
    if (fromSession) return fromSession;
    try {
      return localStorage.getItem(STORAGE_KEYS.LIVE_HANDLE) || '';
    } catch {
      return '';
    }
  });
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isLiveConnecting, setIsLiveConnecting] = useState<boolean>(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const liveSessionId = useMemo(
    () => getLiveConnectionSessionId('wbr'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser?.uid, activeStreamerSession?.username]
  );

  // Local WebSocket Bridge State (TikFinity / EulerStream / Local Relay)
  const [wsUrl, setWsUrl] = useState<string>('ws://localhost:21213');
  const [wsState, setWsState] = useState<WsConnectionState>('DISCONNECTED');
  const [wsError, setWsError] = useState<string | null>(null);
  const [wsMessageCount, setWsMessageCount] = useState<number>(0);

  // Interactive Daily Round Tracking Refs
  const roundCounterRef = useRef<number>(1);
  const roundStartedRef = useRef<boolean>(false);

  // Mutable Refs for Zero-Stale-Closure High-Frequency Loop & Chat Ingestion
  const phaseRef = useRef<GamePhase>(phase);
  const waveRef = useRef<number>(wave);
  const playersRef = useRef<Player[]>(players);
  const currentRuleRef = useRef<PromptRule | null>(currentRule);
  const burnedWordsSetRef = useRef<Set<string>>(new Set());
  const burnedWordsListRef = useRef<string[]>([]);
  const customRulesRef = useRef<CustomGameRules>(customRules);
  const waveComboRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(99);
  const isPausedRef = useRef<boolean>(isPaused);
  const testUsernameRef = useRef<string>(testUsername);
  const playerLoadoutRef = useRef<PlayerLoadout>(playerLoadout);
  const { darkMode, toggleDarkMode } = useSiteTheme();
  const botCosmeticsRef = useRef<boolean>(botCosmeticsEnabled);
  const botTimersRef = useRef<number[]>([]);
  const bridgeRef = useRef<TikTokBridgeClient | null>(null);

  // Keep refs synchronized with state
  phaseRef.current = phase;
  waveRef.current = wave;
  playersRef.current = players;
  currentRuleRef.current = currentRule;
  customRulesRef.current = customRules;
  isPausedRef.current = isPaused;
  testUsernameRef.current = testUsername;
  playerLoadoutRef.current = playerLoadout;
  botCosmeticsRef.current = botCosmeticsEnabled;

  // Persist Coins, Cosmetics, Loadout, Hall of Fame, Live Handle
  useEffect(() => {
    if (isOverlay) return;
    try {
      localStorage.setItem(STORAGE_KEYS.COINS, String(coins));
    } catch {
      // ignore storage quota errors
    }
  }, [coins, isOverlay]);

  useEffect(() => {
    if (isOverlay) return;
    try {
      localStorage.setItem(STORAGE_KEYS.UNLOCKED, JSON.stringify(Array.from(unlockedCosmetics)));
    } catch {
      // ignore
    }
  }, [unlockedCosmetics, isOverlay]);

  useEffect(() => {
    if (isOverlay) return;
    try {
      localStorage.setItem(STORAGE_KEYS.LOADOUT, JSON.stringify(playerLoadout));
    } catch {
      // ignore
    }
  }, [playerLoadout, isOverlay]);

  useEffect(() => {
    if (isOverlay) return;
    try {
      localStorage.setItem(STORAGE_KEYS.HOF, JSON.stringify(hallOfFame));
    } catch {
      // ignore
    }
  }, [hallOfFame, isOverlay]);

  useEffect(() => {
    if (isOverlay) return;
    try {
      localStorage.setItem(STORAGE_KEYS.LIVE_HANDLE, liveHandle);
    } catch {
      // ignore
    }
  }, [liveHandle, isOverlay]);

  // Sync testUsername with signed-in member name if untouched
  useEffect(() => {
    if (currentUser && testUsername === 'You Live') {
      const cleanName = getCleanDisplayName(currentUser);
      if (cleanName && cleanName !== 'Guest Solver' && cleanName !== 'Player') {
        setTestUsername(cleanName);
      }
    }
  }, [currentUser, testUsername]);

  // Unlock Web Audio on first user interaction anywhere in viewport
  useEffect(() => {
    if (isOverlay) return;
    const unlockAudio = () => {
      soundEngine.unlock();
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [isOverlay]);

  // Immediately reflect loadout changes onto the player's live avatar in the arena
  useEffect(() => {
    if (isOverlay) return;
    const myId = makePlayerId(testUsername);
    if (!myId) return;
    setPlayers((prev) =>
      prev.map((p) => (p.id === myId ? { ...p, loadout: { ...playerLoadout } } : p))
    );
  }, [playerLoadout, testUsername, isOverlay]);

  const clearBotTimers = useCallback(() => {
    for (const tid of botTimersRef.current) {
      window.clearTimeout(tid);
    }
    botTimersRef.current = [];
  }, []);

  const pushChatLog = useCallback(
    (username: string, comment: string, result: IncomingChatLog['result']) => {
      setChatLogs((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          username,
          comment,
          result,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 24),
      ]);
    },
    []
  );

  /**
   * Core Incoming Chat Validation Pipeline
   * Used identically by Built-in Site TikTok LIVE Bridge, Manual Test Chat,
   * Built-In 35-Bot Simulator, Local WebSocket Bridge, and window.onTikTokChatMessage()
   */
  const processChatMessage = useCallback(
    (payload: ChatMessagePayload) => {
      if (isOverlay) return;
      const rawUser = (payload.username || '').trim().replace(/^@/, '');
      const rawComment = (payload.comment || '').trim();
      if (!rawUser || !rawComment) return;

      const playerId = makePlayerId(rawUser);
      const currentPhase = phaseRef.current;
      const rules = customRulesRef.current;
      const myTestId = makePlayerId(testUsernameRef.current);

      const currentPlayers = playersRef.current;
      let existingPlayer = currentPlayers.find((p) => p.id === playerId);

      // Helper to spawn a new player into the arena
      const spawnPlayer = (): Player | null => {
        if (currentPlayers.length >= rules.maxPlayers) return null;
        const color = hashColor(rawUser);
        const isMyTestUser = playerId === myTestId;
        const newPlayer: Player = {
          id: playerId,
          username: rawUser,
          avatarUrl: payload.avatarUrl || generateProfilePicture(rawUser),
          color,
          accentColor: color,
          initials: makeInitials(rawUser),
          alive: true,
          safe: false,
          isBot: payload.isBot ?? false,
          loadout: isMyTestUser
            ? { ...playerLoadoutRef.current }
            : payload.isBot
              ? randomBotLoadout(botCosmeticsRef.current)
              : { ...DEFAULT_LOADOUT },
        };
        const updated = [...playersRef.current, newPlayer];
        playersRef.current = updated;
        setPlayers(updated);
        soundEngine.playJoin();
        return newPlayer;
      };

      // 1) LOBBY PHASE: Any incoming message joins the player
      if (currentPhase === 'LOBBY') {
        if (!existingPlayer) {
          const spawned = spawnPlayer();
          if (spawned) {
            pushChatLog(rawUser, rawComment, 'JOINED');
          }
        }
        return;
      }

      // 2) ACTIVE WAVE PHASE: Validate words for ALIVE + UNSAFE players (and optional Wave 1 latecomers)
      if (currentPhase !== 'ACTIVE_WAVE') {
        return;
      }

      if (!existingPlayer) {
        if (waveRef.current === 1 && rules.allowWave1LateJoin) {
          existingPlayer = spawnPlayer() ?? undefined;
        }
        if (!existingPlayer) {
          return;
        }
      }

      if (!existingPlayer.alive || existingPlayer.safe) {
        return;
      }

      const activeRule = currentRuleRef.current;
      if (!activeRule) return;

      // Clean and uppercase the first word token
      const firstToken = rawComment.split(/\s+/)[0] || '';
      const cleanWord = firstToken.replace(/[^a-zA-Z]/g, '').toUpperCase();

      if (cleanWord.length < 3) {
        soundEngine.playError();
        setFeedbackEvent({
          type: 'INVALID',
          playerId,
          timestamp: Date.now() + Math.random(),
        });
        pushChatLog(rawUser, firstToken, 'INVALID');
        return;
      }

      // Check globally banned letters first
      const bannedHit = hasBannedLetter(cleanWord, rules.bannedLetters);
      if (bannedHit) {
        soundEngine.playError();
        setFeedbackEvent({
          type: 'BANNED',
          playerId,
          text: `NO "${bannedHit}"!`,
          timestamp: Date.now() + Math.random(),
        });
        pushChatLog(rawUser, cleanWord, 'BANNED');
        return;
      }

      // Check Burned Words Set
      if (burnedWordsSetRef.current.has(cleanWord)) {
        soundEngine.playError();
        setFeedbackEvent({
          type: 'TAKEN',
          playerId,
          timestamp: Date.now() + Math.random(),
        });
        pushChatLog(rawUser, cleanWord, 'TAKEN');
        return;
      }

      // Check Dictionary + Current Wave Prompt Rule
      const validDict = isValidEnglishWord(cleanWord, rules.globalCategory);
      const validRule = validatePromptRule(cleanWord, activeRule);

      if (!validDict || !validRule) {
        soundEngine.playError();
        setFeedbackEvent({
          type: 'INVALID',
          playerId,
          timestamp: Date.now() + Math.random(),
        });
        pushChatLog(rawUser, cleanWord, 'INVALID');
        return;
      }

      // VALID & UNIQUE WORD -> Mark player SAFE!
      burnedWordsSetRef.current.add(cleanWord);
      const nextBurned = [cleanWord, ...burnedWordsListRef.current];
      burnedWordsListRef.current = nextBurned;
      setBurnedWordsList(nextBurned);

      const nextPlayers = playersRef.current.map((p) =>
        p.id === playerId
          ? {
              ...p,
              safe: true,
              lastWord: cleanWord,
              lastWordTimestamp: Date.now(),
            }
          : p
      );
      playersRef.current = nextPlayers;
      setPlayers(nextPlayers);

      waveComboRef.current += 1;
      soundEngine.playSafe(waveComboRef.current);

      setFeedbackEvent({
        type: 'SAFE',
        playerId,
        text: cleanWord,
        timestamp: Date.now() + Math.random(),
      });
      pushChatLog(rawUser, cleanWord, 'SAFE');

      // Award Royale Coins + credit linked Missing Piece website account for real viewers
      if (!payload.isBot) {
        setCoins((c) => c + 15);
        creditInteractiveScoreByTikTokHandle({
          tiktokUsername: rawUser,
          gameId: 'wbr',
          pointsEarned: 25,
          reason: `Word Bomb Royale safe word (${cleanWord})`,
        });
      }

      // Early Wave End: If 100% of alive players are SAFE, fast-forward timer to 0.5s!
      const aliveList = nextPlayers.filter((p) => p.alive);
      if (aliveList.length > 0 && aliveList.every((p) => p.safe)) {
        setTimeRemaining((prev) => (prev > 0.5 ? 0.5 : prev));
      }
    },
    [pushChatLog, isOverlay]
  );

  // Attach Built-in Site TikTok LIVE Resilient Bridge (Socket.IO + HTTP Poll + Webhook)
  useEffect(() => {
    if (isOverlay) return;
    const deduplicator = createEventDeduplicator();
    const detach = attachResilientChatListeners({
      gameId: 'wbr',
      deduplicator,
      onStatus: (status) => {
        setIsLiveConnected(Boolean(status.connected));
        setIsLiveConnecting(false);
        if (status.error) {
          setLiveError(status.error);
        } else if (status.connected) {
          setLiveError(null);
          if (status.username) {
            setLiveHandle(status.username);
          }
        }
      },
      onChat: (ev) => {
        touchActiveInteractiveStreamerSession();
        setWsMessageCount((c) => c + 1);
        const handle = (ev.uniqueId || ev.nickname || '').trim();
        const comment = (ev.comment || '').trim();
        if (!handle || !comment) return;
        processChatMessage({
          username: handle,
          avatarUrl: ev.profilePictureUrl || undefined,
          comment,
          isBot: false,
        });
      },
    });
    return () => {
      detach();
    };
  }, [isOverlay, processChatMessage]);

  // Attach global window.onTikTokChatMessage & Local WebSocket Bridge client
  useEffect(() => {
    if (isOverlay) return;
    const client = new TikTokBridgeClient(
      (msg) => {
        setWsMessageCount((c) => c + 1);
        processChatMessage(msg);
      },
      (status, error) => {
        setWsState(status);
        setWsError(error ?? null);
      }
    );
    bridgeRef.current = client;
    const detachHook = client.attachWindowHook();

    return () => {
      detachHook();
      client.disconnect();
      bridgeRef.current = null;
    };
  }, [processChatMessage, isOverlay]);

  // Built-in Site TikTok LIVE Connect / Disconnect / Force Reconnect Handlers
  const handleConnectLive = useCallback(() => {
    const clean = liveHandle.trim().replace(/^@+/, '');
    if (!clean) {
      setLiveError('Enter your TikTok @handle first.');
      return;
    }
    setLiveError(null);
    setIsLiveConnecting(true);
    triggerResilientConnect(
      null,
      {
        username: clean,
        sessionId: liveSessionId,
        gameId: 'wbr',
      },
      () => {
        setIsLiveConnecting(false);
      }
    );
  }, [liveHandle, liveSessionId]);

  const handleDisconnectLive = useCallback(() => {
    setIsLiveConnecting(false);
    setIsLiveConnected(false);
    setLiveError(null);
    void liveChatBridge.disconnectStream('wbr', liveSessionId);
  }, [liveSessionId]);

  const handleForceReconnectLive = useCallback(() => {
    const clean = liveHandle.trim().replace(/^@+/, '');
    if (!clean) return;
    setLiveError(null);
    setIsLiveConnecting(true);
    forceReconnectBridge(
      null,
      {
        username: clean,
        sessionId: liveSessionId,
        gameId: 'wbr',
      },
      () => {
        setIsLiveConnecting(false);
      }
    );
  }, [liveHandle, liveSessionId]);

  // Phase Transition Helpers
  const startLobbyPhase = useCallback(() => {
    if (roundStartedRef.current) {
      const token = `wbr-round-${roundCounterRef.current}`;
      const canContinue = tryConsumeOrCheckNextRound('wbr', token);
      if (!canContinue) {
        clearBotTimers();
        setIsPaused(true);
        return;
      }
      roundCounterRef.current += 1;
      roundStartedRef.current = false;
    }

    clearBotTimers();
    const dur = customRulesRef.current.lobbyDurationSec;
    playersRef.current = [];
    setPlayers([]);
    burnedWordsSetRef.current = new Set();
    burnedWordsListRef.current = [];
    setBurnedWordsList([]);
    setCurrentRule(null);
    setSpinDisplayRule(null);
    setWipeoutMessage(null);
    setWave(1);
    setPhase('LOBBY');
    setTotalPhaseDuration(dur);
    setTimeRemaining(dur);
    lastTickSecRef.current = 99;
  }, [clearBotTimers]);

  const startWaveIntroPhase = useCallback(
    (nextWave: number) => {
      if (nextWave === 1) {
        roundStartedRef.current = true;
      }
      clearBotTimers();
      setWipeoutMessage(null);
      burnedWordsSetRef.current = new Set();
      burnedWordsListRef.current = [];
      setBurnedWordsList([]);
      waveComboRef.current = 0;

      // Reset safe status for all alive players
      const resetPlayers = playersRef.current.map((p) =>
        p.alive ? { ...p, safe: false, lastWord: undefined } : p
      );
      playersRef.current = resetPlayers;
      setPlayers(resetPlayers);

      const chosen = pickNextPromptRule(
        nextWave,
        customRulesRef.current,
        currentRuleRef.current?.id
      );
      currentRuleRef.current = chosen;
      setCurrentRule(chosen);
      setWave(nextWave);
      setPhase('WAVE_INTRO');
      setTotalPhaseDuration(WAVE_INTRO_DURATION);
      setTimeRemaining(WAVE_INTRO_DURATION);
      lastTickSecRef.current = 99;
    },
    [clearBotTimers]
  );

  const startActiveWavePhase = useCallback(() => {
    const dur = getWaveDurationSec(waveRef.current, customRulesRef.current);
    setSpinDisplayRule(null);
    setPhase('ACTIVE_WAVE');
    setTotalPhaseDuration(dur);
    setTimeRemaining(dur);
    lastTickSecRef.current = 99;
  }, []);

  const startVictoryPhase = useCallback(
    (winner: Player) => {
      clearBotTimers();
      setPhase('VICTORY');
      setTotalPhaseDuration(VICTORY_DURATION);
      setTimeRemaining(VICTORY_DURATION);
      soundEngine.playVictory();
      triggerVictoryConfetti();
      setFeedbackEvent({
        type: 'VICTORY',
        playerId: winner.id,
        timestamp: Date.now() + Math.random(),
      });

      // Record Daily Limit Round Completion + Daily Streak
      recordInteractiveRoundCompleted('wbr', `wbr-round-${roundCounterRef.current}`);
      recordDailyPuzzleSolved('wbr', getLocalTodayDateStr());

      // Award coins for round completion
      setCoins((c) => c + (winner.isBot ? 35 : 120));

      // Credit winner's linked Missing Piece account if real viewer
      if (!winner.isBot) {
        creditInteractiveScoreByTikTokHandle({
          tiktokUsername: winner.username,
          gameId: 'wbr',
          pointsEarned: 150,
          reason: `Word Bomb Royale Champion (Wave ${waveRef.current})`,
        });
      }

      // Update Live Hall of Fame
      setHallOfFame((prev) => {
        const idx = prev.findIndex(
          (e) => e.username.toLowerCase() === winner.username.toLowerCase()
        );
        let updated: HallOfFameEntry[];
        if (idx >= 0) {
          updated = prev.map((entry, i) =>
            i === idx ? { ...entry, wins: entry.wins + 1 } : entry
          );
        } else {
          updated = [
            ...prev,
            {
              username: winner.username,
              avatarUrl: winner.avatarUrl,
              color: winner.color,
              initials: winner.initials,
              wins: 1,
            },
          ];
        }
        return updated.sort((a, b) => b.wins - a.wins).slice(0, 12);
      });
    },
    [clearBotTimers]
  );

  const runEliminationResolution = useCallback(() => {
    clearBotTimers();
    const alivePlayers = playersRef.current.filter((p) => p.alive);
    const unsafePlayers = alivePlayers.filter((p) => !p.safe);
    const safePlayers = alivePlayers.filter((p) => p.safe);

    // Edge case: 0 survivors -> TOTAL WIPEOUT REVIVE!
    if (alivePlayers.length > 0 && safePlayers.length === 0) {
      soundEngine.playRevive();
      setWipeoutMessage('TOTAL WIPEOUT! REVIVING LAST WAVE!');
      setFeedbackEvent({
        type: 'REVIVE',
        timestamp: Date.now() + Math.random(),
      });
      setPhase('ELIMINATION');
      setTotalPhaseDuration(ELIMINATION_DURATION);
      setTimeRemaining(ELIMINATION_DURATION);
      return;
    }

    // Standard Elimination: detonate all unsafe players
    if (unsafePlayers.length > 0) {
      const eliminatedIds = unsafePlayers.map((p) => p.id);
      soundEngine.playExplosion();
      setFeedbackEvent({
        type: 'ELIMINATE',
        playerIds: eliminatedIds,
        timestamp: Date.now() + Math.random(),
      });

      const elimSet = new Set(eliminatedIds);
      const nextPlayers = playersRef.current.map((p) =>
        elimSet.has(p.id) ? { ...p, alive: false, safe: false } : p
      );
      playersRef.current = nextPlayers;
      setPlayers(nextPlayers);
    }

    setPhase('ELIMINATION');
    setTotalPhaseDuration(ELIMINATION_DURATION);
    setTimeRemaining(ELIMINATION_DURATION);
  }, [clearBotTimers]);

  // Handle transition when a phase timer reaches 0.0s
  const advanceFromCurrentPhase = useCallback(() => {
    const current = phaseRef.current;

    if (current === 'LOBBY') {
      const alive = playersRef.current.filter((p) => p.alive);
      if (alive.length < 2) {
        if (alive.length === 1 && !simEnabled) {
          startWaveIntroPhase(1);
        } else {
          const dur = customRulesRef.current.lobbyDurationSec;
          setTotalPhaseDuration(dur);
          setTimeRemaining(dur);
        }
        return;
      }
      startWaveIntroPhase(1);
      return;
    }

    if (current === 'WAVE_INTRO') {
      startActiveWavePhase();
      return;
    }

    if (current === 'ACTIVE_WAVE') {
      runEliminationResolution();
      return;
    }

    if (current === 'ELIMINATION') {
      setWipeoutMessage(null);
      const survivors = playersRef.current.filter((p) => p.alive);
      if (survivors.length === 1) {
        startVictoryPhase(survivors[0]);
      } else if (survivors.length === 0) {
        startLobbyPhase();
      } else {
        startWaveIntroPhase(waveRef.current + 1);
      }
      return;
    }

    if (current === 'VICTORY') {
      startLobbyPhase();
    }
  }, [
    runEliminationResolution,
    simEnabled,
    startActiveWavePhase,
    startLobbyPhase,
    startVictoryPhase,
    startWaveIntroPhase,
  ]);

  // Master 100ms Precision State Machine Countdown Clock (Host only)
  useEffect(() => {
    if (isPaused || isOverlay) return;

    const interval = window.setInterval(() => {
      setTimeRemaining((prev) => {
        const next = Math.max(0, Math.round((prev - 0.1) * 10) / 10);

        if (phaseRef.current === 'ACTIVE_WAVE' && next <= 3.0 && next > 0) {
          const wholeSec = Math.ceil(next);
          if (wholeSec < lastTickSecRef.current) {
            lastTickSecRef.current = wholeSec;
            soundEngine.playTick(wholeSec === 1);
          }
        }

        if (next <= 0) {
          window.setTimeout(() => advanceFromCurrentPhase(), 0);
          return 0;
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [isPaused, isOverlay, advanceFromCurrentPhase]);

  // Dramatic Slot-Machine Spin Animation during WAVE_INTRO (Host only)
  useEffect(() => {
    if (phase !== 'WAVE_INTRO' || isPaused || isOverlay) return;

    let ticks = 0;
    const maxTicks = 17;
    const spinInterval = window.setInterval(() => {
      ticks += 1;
      if (ticks >= maxTicks) {
        setSpinDisplayRule(currentRuleRef.current);
        window.clearInterval(spinInterval);
        return;
      }
      const randomRule =
        ALL_PROMPT_RULES[Math.floor(Math.random() * ALL_PROMPT_RULES.length)];
      setSpinDisplayRule(randomRule);
      soundEngine.playSlotTick();
    }, 105);

    return () => window.clearInterval(spinInterval);
  }, [phase, isPaused, isOverlay]);

  // Built-In Realistic Bot Simulator (Host only)
  useEffect(() => {
    clearBotTimers();
    if (!simEnabled || isPaused || isOverlay) return;

    if (phase === 'LOBBY') {
      const targetBots = getBotSubset(
        Math.min(botCount, customRulesRef.current.maxPlayers)
      );
      const joinWindowMs = Math.max(
        3500,
        (customRulesRef.current.lobbyDurationSec - 3.5) * 1000
      );

      targetBots.forEach((bot, idx) => {
        const delayMs =
          idx < 4
            ? 250 + idx * 240
            : 800 + Math.random() * Math.max(1500, joinWindowMs - 800);

        const tid = window.setTimeout(() => {
          if (phaseRef.current !== 'LOBBY' || isPausedRef.current) return;
          processChatMessage({
            username: bot.username,
            avatarUrl: bot.avatarUrl,
            comment: pickRandomJoinMessage(),
            isBot: true,
          });
        }, delayMs);
        botTimersRef.current.push(tid);
      });
    } else if (phase === 'ACTIVE_WAVE') {
      const activeRule = currentRuleRef.current;
      if (!activeRule) return;

      const aliveBots = playersRef.current.filter((p) => p.alive && p.isBot);
      const waveDurSec = getWaveDurationSec(waveRef.current, customRulesRef.current);

      aliveBots.forEach((botPlayer) => {
        const profile = BOT_POOL.find(
          (b) => makePlayerId(b.username) === botPlayer.id
        );
        const skill = profile?.skill ?? 0.65;

        const plan = computeBotWaveAction(
          skill,
          waveRef.current,
          waveDurSec,
          aliveBots.length
        );

        const tid = window.setTimeout(() => {
          if (phaseRef.current !== 'ACTIVE_WAVE' || isPausedRef.current) return;
          const livePlayer = playersRef.current.find((p) => p.id === botPlayer.id);
          if (!livePlayer || !livePlayer.alive || livePlayer.safe) return;

          if (plan.willSubmitValid) {
            const word = pickBotWordForWave(
              activeRule,
              customRulesRef.current,
              burnedWordsSetRef.current,
              burnedWordsListRef.current
            );
            if (word) {
              processChatMessage({
                username: botPlayer.username,
                comment: word,
                isBot: true,
              });
            }

            if (plan.retryDelayMs) {
              const retryTid = window.setTimeout(() => {
                if (phaseRef.current !== 'ACTIVE_WAVE' || isPausedRef.current) return;
                const stillUnsafe = playersRef.current.find(
                  (p) => p.id === botPlayer.id && p.alive && !p.safe
                );
                if (!stillUnsafe || !currentRuleRef.current) return;
                const retryWord = pickBotWordForWave(
                  currentRuleRef.current,
                  customRulesRef.current,
                  burnedWordsSetRef.current,
                  []
                );
                if (retryWord) {
                  processChatMessage({
                    username: botPlayer.username,
                    comment: retryWord,
                    isBot: true,
                  });
                }
              }, Math.max(700, plan.retryDelayMs - plan.delayMs));
              botTimersRef.current.push(retryTid);
            }
          } else if (Math.random() < 0.35) {
            const panicWord =
              burnedWordsListRef.current[0] ||
              ['WAIT', 'NOOO', 'HELP', 'UHHH'][Math.floor(Math.random() * 4)];
            processChatMessage({
              username: botPlayer.username,
              comment: panicWord,
              isBot: true,
            });
          }
        }, plan.delayMs);

        botTimersRef.current.push(tid);
      });
    }

    return () => {
      clearBotTimers();
    };
  }, [phase, wave, simEnabled, botCount, isPaused, isOverlay, clearBotTimers, processChatMessage]);

  // TikTok LIVE Studio Overlay Real-Time Sync (Host broadcasts -> Overlay mirrors)
  const overlaySnapshot = useMemo<WbrOverlaySnapshot | null>(
    () =>
      isOverlay
        ? null
        : {
            phase,
            wave,
            timeRemaining,
            totalPhaseDuration,
            isPaused,
            players,
            currentRule,
            spinDisplayRule,
            burnedWordsList: burnedWordsList.slice(0, 30),
            feedbackEvent,
            wipeoutMessage,
            hallOfFame: hallOfFame.slice(0, 6),
            customRules,
            isLiveConnected,
            liveHandle,
          },
    [
      isOverlay,
      phase,
      wave,
      timeRemaining,
      totalPhaseDuration,
      isPaused,
      players,
      currentRule,
      spinDisplayRule,
      burnedWordsList,
      feedbackEvent,
      wipeoutMessage,
      hallOfFame,
      customRules,
      isLiveConnected,
      liveHandle,
    ]
  );

  useOverlaySync<WbrOverlaySnapshot>({
    gameId: 'wbr',
    streamer: overlayConfig.streamer || liveHandle || activeStreamerSession?.username || '',
    channel: overlayConfig.channel,
    isOverlay,
    localState: overlaySnapshot,
    onSyncedState: (synced) => {
      if (!synced) return;
      setPhase(synced.phase);
      setWave(synced.wave);
      setTimeRemaining(synced.timeRemaining);
      setTotalPhaseDuration(synced.totalPhaseDuration);
      setIsPaused(synced.isPaused);
      setPlayers(synced.players || []);
      setCurrentRule(synced.currentRule || null);
      setSpinDisplayRule(synced.spinDisplayRule || null);
      setBurnedWordsList(synced.burnedWordsList || []);
      if (synced.feedbackEvent) {
        setFeedbackEvent(synced.feedbackEvent);
      }
      setWipeoutMessage(synced.wipeoutMessage || null);
      setHallOfFame(synced.hallOfFame || []);
      if (synced.customRules) {
        setCustomRules(synced.customRules);
      }
      setIsLiveConnected(Boolean(synced.isLiveConnected));
      if (synced.liveHandle) {
        setLiveHandle(synced.liveHandle);
      }
    },
  });

  // Host Control Handlers
  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
    if (!next) soundEngine.unlock();
  };

  const handleForceNewPrompt = () => {
    if (phase === 'LOBBY') {
      startWaveIntroPhase(1);
      return;
    }
    if (phase === 'VICTORY') {
      startLobbyPhase();
      return;
    }
    const nextRule = pickNextPromptRule(
      wave,
      customRulesRef.current,
      currentRuleRef.current?.id
    );
    currentRuleRef.current = nextRule;
    setCurrentRule(nextRule);
    burnedWordsSetRef.current = new Set();
    burnedWordsListRef.current = [];
    setBurnedWordsList([]);
    waveComboRef.current = 0;

    const resetPlayers = playersRef.current.map((p) =>
      p.alive ? { ...p, safe: false, lastWord: undefined } : p
    );
    playersRef.current = resetPlayers;
    setPlayers(resetPlayers);

    const dur = getWaveDurationSec(wave, customRulesRef.current);
    setPhase('ACTIVE_WAVE');
    setTotalPhaseDuration(dur);
    setTimeRemaining(dur);
    soundEngine.playSlotTick();
  };

  const handleSpawnBotsNow = (count: number) => {
    const existingIds = new Set(playersRef.current.map((p) => p.id));
    const available = BOT_POOL.filter((b) => !existingIds.has(makePlayerId(b.username)));
    const picks = available.slice(0, count);
    picks.forEach((bot, idx) => {
      window.setTimeout(() => {
        if (phaseRef.current === 'LOBBY' || (phaseRef.current === 'ACTIVE_WAVE' && waveRef.current === 1)) {
          processChatMessage({
            username: bot.username,
            avatarUrl: bot.avatarUrl,
            comment: pickRandomJoinMessage(),
            isBot: true,
          });
        } else {
          if (playersRef.current.length >= customRulesRef.current.maxPlayers) return;
          const color = hashColor(bot.username);
          const p: Player = {
            id: makePlayerId(bot.username),
            username: bot.username,
            avatarUrl: bot.avatarUrl,
            color,
            accentColor: color,
            initials: makeInitials(bot.username),
            alive: true,
            safe: false,
            isBot: true,
            loadout: randomBotLoadout(botCosmeticsRef.current),
          };
          const next = [...playersRef.current, p];
          playersRef.current = next;
          setPlayers(next);
          soundEngine.playJoin();
        }
      }, idx * 75);
    });
  };

  const handleBuyOrEquipCosmetic = (item: CosmeticItem) => {
    const key = `${item.category}:${item.id}`;
    const alreadyOwned = item.price === 0 || unlockedCosmetics.has(key);

    if (!alreadyOwned) {
      if (coins < item.price) return;
      setCoins((c) => c - item.price);
      setUnlockedCosmetics((prev) => new Set([...prev, key]));
      soundEngine.playPurchase();
    } else {
      soundEngine.playJoin();
    }

    setPlayerLoadout((prev) => ({
      ...prev,
      [item.category]: item.id,
    }));
  };

  // Derived counters for TopHeader & Arena
  const alivePlayers = useMemo(() => players.filter((p) => p.alive), [players]);
  const safeCount = useMemo(
    () => alivePlayers.filter((p) => p.safe).length,
    [alivePlayers]
  );
  const champion = phase === 'VICTORY' && alivePlayers.length === 1 ? alivePlayers[0] : null;
  const isTransparentOverlay = isOverlay && overlayConfig.bg === 'transparent';

  const memberLabel = currentUser
    ? getCleanDisplayName(currentUser)
    : 'Sign In';

  return (
    <main
      className={`w-full ${
        isOverlay ? 'h-dvh' : 'h-[calc(100dvh-46px)]'
      } flex flex-col overflow-hidden relative select-none transition-colors ${
        isTransparentOverlay
          ? 'bg-transparent'
          : 'bg-[#F3ECFB] dark:bg-[#12031E]'
      }`}
    >
      {/* Ambient Royal Purple & Starlight Gold Studio Backdrop */}
      {!isTransparentOverlay && (
        <div
          className="hidden sm:block absolute inset-0 pointer-events-none"
          style={{
            background: darkMode
              ? 'radial-gradient(circle at 50% 45%, rgba(246, 201, 21, 0.10) 0%, rgba(43, 9, 56, 0.55) 45%, #12031E 100%)'
              : 'radial-gradient(circle at 50% 45%, rgba(246, 201, 21, 0.16) 0%, rgba(232, 218, 250, 0.72) 48%, #F3ECFB 100%)',
          }}
        />
      )}

      {/* 25% Opacity Missing Piece Background Watermark (hidden in transparent overlay) */}
      {!isTransparentOverlay && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center z-0 overflow-hidden"
        >
          <img
            src="/assets/aistudio/3d_logo_944e5372.png"
            alt=""
            className="w-[340px] h-[340px] sm:w-[600px] sm:h-[600px] object-contain opacity-25 select-none"
          />
        </div>
      )}

      {/* Host Studio Top Navigation Bar (Hidden in LIVE Studio Overlay Mode) */}
      {!isOverlay && (
        <header className="relative z-40 shrink-0 w-full bg-white/95 dark:bg-[#160524]/95 backdrop-blur-md border-b border-[#E3D4F4] dark:border-[#F6C915]/20 px-2.5 sm:px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              to="/interactive-games"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F4ECFC] dark:bg-[#2B0938] hover:bg-[#EADBF9] dark:hover:bg-[#3A0F4D] border border-[#D7C4EC] dark:border-[#F6C915]/30 text-[#4C266D] dark:text-[#F6C915] text-xs font-bold transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Interactive Games</span>
              <span className="sm:hidden">Back</span>
            </Link>

            <div className="hidden md:flex items-center gap-2 min-w-0 pl-1">
              <img
                src="/brand-logo.png"
                alt="The Missing Piece"
                className="w-6 h-6 rounded-md object-contain bg-[#2B0938] p-0.5 border border-[#F6C915]/35 shrink-0"
              />
              <div className="leading-tight min-w-0">
                <p className="text-xs font-black tracking-tight text-[#2B0938] dark:text-white truncate">
                  WORD BOMB <span className="text-[#9A6E00] dark:text-[#F6C915]">ROYALE</span>
                </p>
                <p className="text-[9px] font-bold tracking-widest uppercase text-[#6B4A8A] dark:text-[#E2C9F2]/60 truncate">
                  The Missing Piece · Live Arena
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setDrawerTab('bridge');
                setDrawerOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                isLiveConnected
                  ? 'bg-emerald-50 dark:bg-[#00F59B]/15 border-emerald-500/60 dark:border-[#00F59B]/55 text-emerald-700 dark:text-[#00F59B] hover:bg-emerald-100 dark:hover:bg-[#00F59B]/25'
                  : 'bg-[#F4ECFC] dark:bg-[#2B0938] border-[#D7C4EC] dark:border-[#F6C915]/35 text-[#4C266D] dark:text-[#F6C915] hover:bg-[#EADBF9] dark:hover:bg-[#3A0F4D]'
              }`}
              title="Connect your TikTok LIVE chat"
            >
              <Radio className={`w-3.5 h-3.5 shrink-0 ${isLiveConnected ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">
                {isLiveConnected && liveHandle ? `@${liveHandle}` : 'Connect TikTok LIVE'}
              </span>
              <span className="sm:hidden">{isLiveConnected ? 'LIVE' : 'TikTok'}</span>
            </button>

            <LiveOverlayButton
              gameTitle="Word Bomb Royale"
              gameSlug="wbr"
              streamerHandle={liveHandle || activeStreamerSession?.username || ''}
              recommendedSize="540 × 960 or 1080 × 1920 (9:16)"
              label="LIVE Overlay"
            />

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
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#F4ECFC] dark:bg-[#2B0938] hover:bg-[#EADBF9] dark:hover:bg-[#3A0F4D] border border-[#D7C4EC] dark:border-[#F6C915]/30 text-[#4C266D] dark:text-[#F6C915] transition-colors cursor-pointer shrink-0"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F4ECFC] dark:bg-[#2B0938] hover:bg-[#EADBF9] dark:hover:bg-[#3A0F4D] border border-[#D7C4EC] dark:border-[#F6C915]/30 text-[#2B0938] dark:text-white text-xs font-bold transition-colors cursor-pointer max-w-[140px]"
              title="Account & Interactive Scores"
            >
              <User className="w-3.5 h-3.5 text-[#9A6E00] dark:text-[#F6C915] shrink-0" />
              <span className="truncate hidden sm:inline">{memberLabel}</span>
            </button>
          </div>
        </header>
      )}

      {/* Centered 9:16 Vertical Broadcast Viewport */}
      <div
        className={`relative z-10 flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden ${
          isOverlay ? 'p-0' : 'p-0 sm:p-2'
        }`}
      >
        <div
          className={`relative h-full w-full sm:w-auto sm:aspect-[9/16] max-w-full flex flex-col overflow-hidden ${
            isTransparentOverlay ? 'wbr-studio-grid-bg-transparent' : 'wbr-studio-grid-bg'
          } ${
            isOverlay
              ? ''
              : 'sm:rounded-[24px] sm:border sm:border-[#C5A8E8] dark:sm:border-[#F6C915]/25 sm:shadow-[0_18px_48px_rgba(43,9,56,0.25)] dark:sm:shadow-[0_0_60px_rgba(0,0,0,0.85),0_0_28px_rgba(246,201,21,0.14)]'
          }`}
        >
          {/* Subtle CRT Scanline Overlay */}
          {!isTransparentOverlay && (
            <div className="absolute inset-0 wbr-crt-scanlines z-30 opacity-40" />
          )}

          {/* ZONE 1: Top Header (12%) */}
          <TopHeader
            phase={phase}
            wave={wave}
            aliveCount={alivePlayers.length}
            totalJoinedCount={players.length}
            safeCount={safeCount}
            hallOfFame={hallOfFame}
            muted={muted}
            onToggleMute={handleToggleMute}
            isLiveConnected={isLiveConnected}
            liveHandle={liveHandle}
            isOverlay={isOverlay}
          />

          {/* ZONE 2: Command & Timer Deck (22%) */}
          <CommandDeck
            phase={phase}
            wave={wave}
            currentRule={currentRule}
            spinDisplayRule={spinDisplayRule}
            timeRemaining={timeRemaining}
            totalPhaseDuration={totalPhaseDuration}
            customRules={customRules}
            isPaused={isPaused}
            wipeoutMessage={wipeoutMessage}
          />

          {/* ZONE 3: Physics Avatar Arena (48% host / 54% overlay) */}
          <PhysicsArenaCanvas
            players={players}
            phase={phase}
            timeRemaining={timeRemaining}
            feedbackEvent={feedbackEvent}
            champion={champion}
            wipeoutMessage={wipeoutMessage}
            isOverlay={isOverlay}
          />

          {/* ZONE 4: Burned Words Ticker & Streamer Host Dock */}
          <BottomDock
            burnedWords={burnedWordsList}
            isPaused={isPaused}
            controlsCollapsed={controlsCollapsed}
            coins={coins}
            simEnabled={simEnabled}
            isLiveConnected={isLiveConnected}
            isOverlay={isOverlay}
            onTogglePause={() => setIsPaused((p) => !p)}
            onSkipPhase={advanceFromCurrentPhase}
            onForceNewPrompt={handleForceNewPrompt}
            onClearLeaderboard={() => setHallOfFame([])}
            onToggleCollapse={() => setControlsCollapsed((c) => !c)}
            onOpenDrawer={(tab) => {
              setDrawerTab(tab);
              setDrawerOpen(true);
            }}
          />

          {/* Slide-Up Host Studio Drawer (Hidden in Overlay Mode) */}
          {!isOverlay && (
            <HostDrawer
              open={drawerOpen}
              activeTab={drawerTab}
              onChangeTab={setDrawerTab}
              onClose={() => setDrawerOpen(false)}
              phase={phase}
              currentRule={currentRule}
              testUsername={testUsername}
              onChangeTestUsername={setTestUsername}
              onSendManualChat={(username, comment) =>
                processChatMessage({ username, comment, isBot: false })
              }
              simEnabled={simEnabled}
              onToggleSim={setSimEnabled}
              botCount={botCount}
              onChangeBotCount={setBotCount}
              onSpawnBotsNow={handleSpawnBotsNow}
              chatLogs={chatLogs}
              coins={coins}
              onGrantBonusCoins={() => {
                setCoins((c) => c + 250);
                soundEngine.playPurchase();
              }}
              unlockedCosmetics={unlockedCosmetics}
              playerLoadout={playerLoadout}
              botCosmeticsEnabled={botCosmeticsEnabled}
              onToggleBotCosmetics={setBotCosmeticsEnabled}
              onBuyOrEquipCosmetic={handleBuyOrEquipCosmetic}
              customRules={customRules}
              onUpdateCustomRules={setCustomRules}
              liveHandle={liveHandle}
              onChangeLiveHandle={setLiveHandle}
              isLiveConnected={isLiveConnected}
              isLiveConnecting={isLiveConnecting}
              liveError={liveError}
              liveSessionId={liveSessionId}
              onConnectLive={handleConnectLive}
              onDisconnectLive={handleDisconnectLive}
              onForceReconnectLive={handleForceReconnectLive}
              wsUrl={wsUrl}
              onChangeWsUrl={setWsUrl}
              wsState={wsState}
              wsError={wsError}
              wsMessageCount={wsMessageCount}
              onConnectWs={() => bridgeRef.current?.connect(wsUrl)}
              onDisconnectWs={() => bridgeRef.current?.disconnect()}
            />
          )}
        </div>
      </div>

      {/* Unified Account & Interactive Score Modal */}
      {!isOverlay && (
        <UnifiedAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          user={currentUser}
          initialTab="account"
        />
      )}
    </main>
  );
}
