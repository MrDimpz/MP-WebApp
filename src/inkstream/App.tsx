import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { io, type Socket } from 'socket.io-client';
import {
  ArrowLeft,
  BarChart3,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  LogOut,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react';
import './inkstream.css';
import type {
  AvatarConfig,
  CanvasCommand,
  ChatMessage,
  NormalizedPoint,
  PublicRoomSummary,
  PublicUser,
  RoomAnalyticsSnapshot,
  RoomClientState,
  RoomSettings,
  SavedArtworkRecord,
} from './shared/types.ts';
import { playGameSound, type GameSoundType } from './utils/sound.ts';
import { LobbyScreen } from './components/LobbyScreen.tsx';
import { Scoreboard } from './components/Scoreboard.tsx';
import { TikTokScoreboard } from './components/TikTokScoreboard.tsx';
import { TikTokConnectModal } from './components/TikTokConnectModal.tsx';
import { StreamerPopupView } from './components/StreamerPopupView.tsx';
import { DrawingCanvas } from './components/DrawingCanvas.tsx';
import { ChatPanel } from './components/ChatPanel.tsx';
import { RoomSettingsPanel } from './components/RoomSettingsPanel.tsx';
import { AnalyticsPanel } from './components/AnalyticsPanel.tsx';
import { ArtworkGalleryModal } from './components/ArtworkGalleryModal.tsx';
import { GameOverPodium } from './components/GameOverPodium.tsx';
import {
  InkStreamOverlayView,
  type InkStreamOverlayState,
} from './components/InkStreamOverlayView.tsx';
import { LiveOverlayButton } from '@/components/interactive-games/live-overlay-button';
import {
  getActiveInteractiveStreamerSession,
  touchActiveInteractiveStreamerSession,
} from '@/lib/interactive-key-auth';
import {
  recordInteractiveRoundCompleted,
  tryConsumeOrCheckNextRound,
} from '@/lib/interactive-daily-limits';
import { useOverlayConfig, useOverlaySync } from '@/lib/live-overlay';
import {
  creditInteractiveScoreByTikTokHandle,
  useUnifiedAuth,
} from '@/lib/unified-game-auth';
import {
  createEventDeduplicator,
  liveChatBridge,
} from '@/lib/live-chat-bridge';
import { LanguageMenu } from '@/components/language-menu';
import { useDictionaryLanguage } from '@/lib/dictionary-languages';

interface LiveSegmentEvent {
  strokeId: string;
  tool: string;
  color: string;
  size: number;
  seed: number;
  points: NormalizedPoint[];
}

function getStreamerPopupParams(): { roomId: string; streamerSecret: string } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('streamerPopup') !== '1') return null;
  const roomId = params.get('room')?.trim().toUpperCase();
  const streamerSecret = params.get('secret')?.trim();
  if (!roomId || !streamerSecret) return null;
  return { roomId, streamerSecret };
}

function getInitialRoomFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('streamerPopup') === '1') return null;
  const code = params.get('room')?.trim().toUpperCase();
  return code && code.length >= 4 && code.length <= 8 ? code : null;
}

export default function App() {
  const popupParams = useMemo(() => getStreamerPopupParams(), []);
  const overlayConfig = useOverlayConfig();

  if (popupParams) {
    return (
      <StreamerPopupView
        roomId={popupParams.roomId}
        streamerSecret={popupParams.streamerSecret}
      />
    );
  }
  if (overlayConfig.isOverlay) {
    return <InkStreamOverlayRoute />;
  }
  return <InkStreamApp />;
}

function InkStreamOverlayRoute() {
  const overlayConfig = useOverlayConfig();
  const [syncedState, setSyncedState] = useState<InkStreamOverlayState | null>(null);
  const { isReceivingHostSync } = useOverlaySync<InkStreamOverlayState>({
    gameId: 'inkstream',
    streamer: overlayConfig.streamer,
    channel: overlayConfig.channel,
    isOverlay: true,
    localState: null,
    onSyncedState: (next) => setSyncedState(next),
  });

  return (
    <InkStreamOverlayView
      state={syncedState}
      bgMode={overlayConfig.bg}
      isReceivingHostSync={isReceivingHostSync}
    />
  );
}

function InkStreamApp() {
  const { user: siteUser } = useUnifiedAuth();
  const activeStreamer = getActiveInteractiveStreamerSession();
  const [dictionaryLanguage] = useDictionaryLanguage();

  // Bearer token kept strictly in JS memory (never localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);

  const [pendingInviteRoomId, setPendingInviteRoomId] = useState<string | null>(
    getInitialRoomFromUrl
  );
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const [room, setRoom] = useState<RoomClientState | null>(null);
  const [liveSegmentEvent, setLiveSegmentEvent] = useState<LiveSegmentEvent | null>(null);
  const [analytics, setAnalytics] = useState<RoomAnalyticsSnapshot | null>(null);
  const [savedArtworks, setSavedArtworks] = useState<SavedArtworkRecord[]>([]);
  const [closeGuessNotice, setCloseGuessNotice] = useState<{
    guess: string;
    message: string;
  } | null>(null);

  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showTikTokModal, setShowTikTokModal] = useState(false);
  const [muted, setMuted] = useState(false);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const closeGuessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSignedInRef = useRef(false);
  const prevTikTokScoresRef = useRef<Map<string, number>>(new Map());
  const chatDedupRef = useRef(createEventDeduplicator());

  const clearCloseGuessNotice = useCallback(() => {
    if (closeGuessTimerRef.current) {
      clearTimeout(closeGuessTimerRef.current);
      closeGuessTimerRef.current = null;
    }
    setCloseGuessNotice(null);
  }, []);

  const authHeaders = useCallback(
    (overrideToken?: string | null): Record<string, string> => {
      const active = overrideToken ?? token;
      return active
        ? {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${active}`,
          }
        : { 'Content-Type': 'application/json' };
    },
    [token]
  );

  const fetchPublicRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const res = await fetch('/api/inkstream/rooms/public');
      if (res.ok) {
        const data = (await res.json()) as { rooms: PublicRoomSummary[] };
        setPublicRooms(data.rooms ?? []);
      }
    } catch {
      // ignore transient network failure
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const fetchSavedArtworks = useCallback(
    async (activeToken?: string | null) => {
      const tok = activeToken ?? token;
      if (!tok) return;
      try {
        const res = await fetch('/api/inkstream/artworks', {
          headers: authHeaders(tok),
        });
        if (res.ok) {
          const data = (await res.json()) as { artworks: SavedArtworkRecord[] };
          setSavedArtworks(data.artworks ?? []);
        }
      } catch {
        // ignore
      }
    },
    [token, authHeaders]
  );

  useEffect(() => {
    void fetchPublicRooms();
    const interval = setInterval(() => {
      void fetchPublicRooms();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchPublicRooms]);

  // Auto-start a studio session when arriving from The Missing Piece with a Stream Key or signed-in profile
  useEffect(() => {
    if (autoSignedInRef.current || token || user) return;
    const streamerHandle = activeStreamer?.username?.replace(/^@+/, '') || '';
    const linkedHandle = siteUser?.linkedTikTokHandle?.replace(/^@+/, '') || '';
    const resolvedHandle = streamerHandle || linkedHandle;
    const resolvedName =
      streamerHandle ||
      siteUser?.displayName?.trim() ||
      (pendingInviteRoomId ? `Guest_${Math.floor(100 + Math.random() * 900)}` : '');

    if (!resolvedName) return;
    autoSignedInRef.current = true;

    void fetch('/api/inkstream/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: resolvedName.slice(0, 20),
        avatar: { color: '#F6C915', eyes: 0, mouth: 0, accessory: 2 },
        isStreamer: Boolean(activeStreamer || resolvedHandle),
        tiktokHandle: resolvedHandle,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { token?: string; user?: PublicUser } | null) => {
        if (data?.token && data?.user) {
          setToken(data.token);
          setUser(data.user);
        }
      })
      .catch(() => undefined);
  }, [activeStreamer, siteUser, token, user, pendingInviteRoomId]);

  // Clear private close-guess notice whenever turn or phase changes
  useEffect(() => {
    clearCloseGuessNotice();
  }, [room?.phase, room?.turnNumber, clearCloseGuessNotice]);

  // Record completed InkStream rounds toward the 3 free rounds/day limit (unlimited with Stream Key)
  useEffect(() => {
    if (!room) return;
    if (room.phase === 'TURN_SUMMARY' && room.currentRound >= 1) {
      recordInteractiveRoundCompleted(
        'inkstream',
        `${room.id}-r${room.currentRound}-t${room.turnNumber}`
      );
      touchActiveInteractiveStreamerSession();
    } else if (room.phase === 'GAME_OVER' && room.currentRound >= 1) {
      recordInteractiveRoundCompleted(
        'inkstream',
        `${room.id}-gameover-r${room.currentRound}`
      );
    }
  }, [room?.id, room?.phase, room?.currentRound, room?.turnNumber]);

  // Credit TikTok viewer scores to linked Missing Piece website profiles automatically
  useEffect(() => {
    if (!room || !room.tiktokLeaderboard.length) return;
    const prevMap = prevTikTokScoresRef.current;
    for (const viewer of room.tiktokLeaderboard) {
      const key = (viewer.uniqueId || viewer.nickname).toLowerCase();
      const prevScore = prevMap.get(key) ?? 0;
      if (viewer.score > prevScore) {
        const delta = viewer.score - prevScore;
        prevMap.set(key, viewer.score);
        creditInteractiveScoreByTikTokHandle({
          tiktokUsername: viewer.uniqueId || viewer.nickname,
          gameId: 'inkstream',
          pointsEarned: delta,
          reason: `InkStream guess (+${delta})`,
        });
      }
    }
  }, [room?.tiktokLeaderboard]);

  // Bridge site-wide TikFinity / BetterTok liveChatBridge messages into active InkStream room
  useEffect(() => {
    if (!room || !user || room.ownerId !== user.id) return;
    const unsub = liveChatBridge.onChat((evt) => {
      if (!chatDedupRef.current.shouldProcess('chat', evt)) return;
      if (!evt.comment?.trim()) return;
      touchActiveInteractiveStreamerSession();
      socketRef.current?.emit('tiktok:test-chat', {
        nickname: evt.nickname || evt.username || evt.uniqueId || 'Viewer',
        uniqueId: evt.uniqueId || evt.username || evt.nickname || 'viewer',
        text: evt.comment.trim(),
        profilePictureUrl: evt.profilePictureUrl || evt.avatar || '',
      });
    });
    return unsub;
  }, [room?.id, room?.ownerId, user?.id]);

  // Build broadcast-safe state for LIVE Studio / OBS Overlay sync (never leaks host secretWord)
  const overlayState = useMemo<InkStreamOverlayState | null>(() => {
    if (!room) return null;
    const drawer = room.players.find((p) => p.id === room.drawerId);
    const latestWinMsg = [...room.messages]
      .reverse()
      .find((m) => m.type === 'correct');
    return {
      roomId: room.id,
      roomName: room.settings.name,
      phase: room.phase,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      timeRemaining: room.timeRemaining,
      maskedWord: room.maskedWord,
      wordLengthHint: room.wordLengthHint,
      drawerName: drawer?.username ?? 'Artist',
      revealedWord: room.phase === 'TURN_SUMMARY' ? room.turnSummary?.word ?? null : null,
      commands: room.commands,
      tiktokConnected: room.tiktokStatus.connected,
      tiktokUsername: room.tiktokStatus.username,
      tiktokLeaderboard: room.tiktokLeaderboard.slice(0, 5),
      recentWinnerText: latestWinMsg ? latestWinMsg.text : null,
    };
  }, [room]);

  const resolvedOverlayStreamer =
    room?.tiktokStatus.username ||
    activeStreamer?.username ||
    user?.tiktokHandle ||
    '';

  useOverlaySync<InkStreamOverlayState>({
    gameId: 'inkstream',
    streamer: resolvedOverlayStreamer,
    isOverlay: false,
    localState: overlayState,
    onSyncedState: () => {},
  });

  // Connect Socket.io to isolated /inkstream namespace whenever authenticated token changes
  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io('/inkstream', {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('room:state', (nextState: RoomClientState) => {
      setRoom(nextState);
      setRoomError(null);
      setLiveSegmentEvent(null);
      // Sync URL query param without reloading
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('room', nextState.id);
        window.history.replaceState({}, '', url.toString());
      }
    });

    socket.on('game:tick', (payload: { timeRemaining: number; maskedWord: string }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        if (
          prev.phase === 'DRAWING' &&
          payload.timeRemaining > 0 &&
          payload.timeRemaining <= 10
        ) {
          playGameSound('tick', mutedRef.current);
        }
        return {
          ...prev,
          timeRemaining: payload.timeRemaining,
          maskedWord: payload.maskedWord || prev.maskedWord,
        };
      });
    });

    socket.on('game:close-guess', (payload: { guess: string; message: string }) => {
      if (closeGuessTimerRef.current) {
        clearTimeout(closeGuessTimerRef.current);
      }
      setCloseGuessNotice({
        guess: payload.guess,
        message: payload.message || `"${payload.guess}" is close!`,
      });
      closeGuessTimerRef.current = setTimeout(() => {
        setCloseGuessNotice(null);
        closeGuessTimerRef.current = null;
      }, 4500);
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      setRoom((prev) => {
        if (!prev) return prev;
        if (prev.messages.some((m) => m.id === msg.id)) return prev;
        return {
          ...prev,
          messages: [...prev.messages.slice(-80), msg],
        };
      });
    });

    socket.on('canvas:command', (cmd: CanvasCommand) => {
      setLiveSegmentEvent(null);
      setRoom((prev) => {
        if (!prev) return prev;
        if (prev.commands.some((c) => c.id === cmd.id)) return prev;
        return {
          ...prev,
          commands: [...prev.commands, cmd],
          canUndo: true,
        };
      });
    });

    socket.on('canvas:live-segment', (segment: LiveSegmentEvent) => {
      setLiveSegmentEvent(segment);
    });

    socket.on(
      'canvas:sync',
      (payload: { commands: CanvasCommand[]; canUndo: boolean; canRedo: boolean }) => {
        setLiveSegmentEvent(null);
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                commands: payload.commands,
                canUndo: payload.canUndo,
                canRedo: payload.canRedo,
              }
            : prev
        );
      }
    );

    socket.on('room:analytics', (snapshot: RoomAnalyticsSnapshot) => {
      setAnalytics(snapshot);
    });

    socket.on('game:sound', (payload: { sound: GameSoundType }) => {
      playGameSound(payload.sound, mutedRef.current);
    });

    socket.on('room:kicked', (payload: { reason?: string }) => {
      setRoom(null);
      setAnalytics(null);
      setShowAnalytics(false);
      setShowTikTokModal(false);
      clearCloseGuessNotice();
      setRoomError(payload?.reason || 'You were removed from the room.');
    });

    // Auto-join invited room if link had ?room=CODE
    if (pendingInviteRoomId) {
      socket.emit(
        'room:join',
        { roomId: pendingInviteRoomId },
        (res: { ok: boolean; error?: string }) => {
          if (!res.ok && res.error) {
            setRoomError(res.error);
          }
          setPendingInviteRoomId(null);
        }
      );
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user?.id, clearCloseGuessNotice]);

  // --- Auth Handlers ---
  const handleRegister = async (payload: {
    email: string;
    username: string;
    password: string;
    avatar: AvatarConfig;
    isStreamer: boolean;
    tiktokHandle: string;
  }) => {
    setAuthError(null);
    const res = await fetch('/api/inkstream/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { token?: string; user?: PublicUser; error?: string };
    if (!res.ok || !data.token || !data.user) {
      setAuthError(data.error ?? 'Could not create account.');
      return;
    }
    setToken(data.token);
    setUser(data.user);
    void fetchSavedArtworks(data.token);
  };

  const handleLogin = async (payload: {
    email: string;
    password: string;
    avatar: AvatarConfig;
    isStreamer: boolean;
    tiktokHandle: string;
  }) => {
    setAuthError(null);
    const res = await fetch('/api/inkstream/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { token?: string; user?: PublicUser; error?: string };
    if (!res.ok || !data.token || !data.user) {
      setAuthError(data.error ?? 'Invalid email or password.');
      return;
    }
    setToken(data.token);
    setUser(data.user);
    void fetchSavedArtworks(data.token);
  };

  const handleGuestLogin = async (payload: {
    username: string;
    avatar: AvatarConfig;
    isStreamer: boolean;
    tiktokHandle: string;
  }) => {
    setAuthError(null);
    const res = await fetch('/api/inkstream/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { token?: string; user?: PublicUser; error?: string };
    if (!res.ok || !data.token || !data.user) {
      setAuthError(data.error ?? 'Could not start guest session.');
      return;
    }
    setToken(data.token);
    setUser(data.user);
    void fetchSavedArtworks(data.token);
  };

  const handleUpdateAvatar = async (avatar: AvatarConfig) => {
    if (!token) return;
    const res = await fetch('/api/inkstream/auth/profile', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ avatar }),
    });
    if (res.ok) {
      const data = (await res.json()) as { user: PublicUser };
      setUser(data.user);
    }
  };

  const handleUpdateStreamerProfile = async (isStreamer: boolean, tiktokHandle: string) => {
    if (!token) return;
    const res = await fetch('/api/inkstream/auth/profile', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ isStreamer, tiktokHandle }),
    });
    if (res.ok) {
      const data = (await res.json()) as { user: PublicUser };
      setUser(data.user);
    }
  };

  const handleLogout = async () => {
    if (socketRef.current) {
      socketRef.current.emit('room:leave');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (token) {
      await fetch('/api/inkstream/auth/logout', {
        method: 'POST',
        headers: authHeaders(),
      }).catch(() => undefined);
    }
    setToken(null);
    setUser(null);
    setRoom(null);
    setAnalytics(null);
    setSavedArtworks([]);
    setShowAnalytics(false);
    setShowGallery(false);
    setShowTikTokModal(false);
    clearCloseGuessNotice();
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
    }
  };

  // --- Room Actions ---
  const handleQuickPlay = () => {
    setRoomError(null);
    socketRef.current?.emit(
      'room:quick-play',
      { language: dictionaryLanguage },
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) setRoomError(res.error);
      }
    );
  };

  const handleCreatePrivateRoom = (config: {
    name: string;
    rounds: number;
    drawTime: number;
    maxPlayers: number;
    streamerMode: boolean;
  }) => {
    setRoomError(null);
    socketRef.current?.emit(
      'room:create',
      {
        name: config.name,
        isPrivate: true,
        rounds: config.rounds,
        drawTime: config.drawTime,
        maxPlayers: config.maxPlayers,
        streamerMode: config.streamerMode,
        language: dictionaryLanguage,
      },
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) setRoomError(res.error);
      }
    );
  };

  const handleJoinRoom = (roomId: string) => {
    setRoomError(null);
    socketRef.current?.emit(
      'room:join',
      { roomId },
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) setRoomError(res.error);
      }
    );
  };

  const handleLeaveRoom = async () => {
    socketRef.current?.emit('room:leave');
    setRoom(null);
    setAnalytics(null);
    setShowAnalytics(false);
    setShowTikTokModal(false);
    clearCloseGuessNotice();
    setRoomError(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
    }
    // Refresh user career stats from server
    if (token) {
      const res = await fetch('/api/inkstream/auth/me', { headers: authHeaders() }).catch(() => null);
      if (res?.ok) {
        const data = (await res.json()) as { user: PublicUser };
        setUser(data.user);
      }
    }
    void fetchPublicRooms();
  };

  const handleUpdateSettings = (patch: Partial<RoomSettings>) => {
    socketRef.current?.emit(
      'room:update-settings',
      patch,
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) setRoomError(res.error);
      }
    );
  };

  useEffect(() => {
    if (!room || !user || room.ownerId !== user.id) return;
    if (room.settings.language === dictionaryLanguage) return;
    socketRef.current?.emit('room:update-settings', { language: dictionaryLanguage });
  }, [dictionaryLanguage, room, user]);

  const handleStartGame = (solo: boolean) => {
    if (!tryConsumeOrCheckNextRound('inkstream')) {
      return;
    }
    setRoomError(null);
    touchActiveInteractiveStreamerSession();
    socketRef.current?.emit(
      'game:start',
      { solo },
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok && res.error) setRoomError(res.error);
      }
    );
  };

  const handleReturnToLobby = () => {
    socketRef.current?.emit('game:return-lobby');
  };

  const handleKickPlayer = (targetUserId: string) => {
    socketRef.current?.emit('room:kick', { targetUserId });
  };

  const handleSelectWord = (index: number) => {
    socketRef.current?.emit('game:select-word', { index });
  };

  // --- TikTok LIVE Actions ---
  const handleConnectTikTok = (
    username: string,
    isTestMode: boolean
  ): Promise<{ ok: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ ok: false, error: 'Not connected to game server.' });
        return;
      }
      socketRef.current.emit(
        'tiktok:connect',
        { username, isTestMode },
        (res: { ok: boolean; error?: string }) => {
          resolve(res ?? { ok: false, error: 'Unexpected response.' });
        }
      );
    });
  };

  const handleDisconnectTikTok = () => {
    socketRef.current?.emit('tiktok:disconnect');
  };

  const handleSendTikTokTestChat = (nickname: string, text: string) => {
    socketRef.current?.emit('tiktok:test-chat', { nickname, text });
  };

  // --- Canvas & Chat Actions ---
  const handleEmitCommand = (cmd: CanvasCommand) => {
    setRoom((prev) =>
      prev
        ? {
            ...prev,
            commands: [...prev.commands, cmd],
            canUndo: true,
            canRedo: false,
          }
        : prev
    );
    socketRef.current?.emit('canvas:command', cmd);
  };

  const handleEmitLiveSegment = (segment: LiveSegmentEvent) => {
    socketRef.current?.emit('canvas:live-segment', segment);
  };

  const handleUndo = () => socketRef.current?.emit('canvas:undo');
  const handleRedo = () => socketRef.current?.emit('canvas:redo');
  const handleClear = () => socketRef.current?.emit('canvas:clear');
  const handleSendMessage = (text: string) => socketRef.current?.emit('chat:send', { text });
  const handleReact = (reaction: 'like' | 'dislike') =>
    socketRef.current?.emit('game:react', { reaction });
  const handleFinishSoloTurn = () => socketRef.current?.emit('game:solo-finish');

  const requestAnalytics = useCallback(() => {
    if (!room) return;
    socketRef.current?.emit(
      'room:request-analytics',
      { roomId: room.id },
      (res: { ok: boolean; analytics?: RoomAnalyticsSnapshot }) => {
        if (res.ok && res.analytics) {
          setAnalytics(res.analytics);
        }
      }
    );
  }, [room]);

  const handleOpenAnalytics = () => {
    setShowAnalytics(true);
    requestAnalytics();
  };

  const handleSaveArtwork = async (dataUrl: string, word: string, artistName: string) => {
    if (!token) return;
    const res = await fetch('/api/inkstream/artworks', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        dataUrl,
        word,
        artistName,
        roomName: room?.settings.name ?? 'InkStream Studio',
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { artwork: SavedArtworkRecord };
      setSavedArtworks((prev) => [data.artwork, ...prev]);
    }
  };

  const handleDeleteSavedArtwork = async (id: string) => {
    if (!token) return;
    const res = await fetch(`/api/inkstream/artworks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) {
      setSavedArtworks((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleCopyInviteCode = async () => {
    if (!room || typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}?room=${room.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedRoomCode(true);
      setTimeout(() => setCopiedRoomCode(false), 1800);
    } catch {
      // ignore
    }
  };

  // Show LobbyScreen when not inside an active room
  if (!room || !user) {
    return (
      <div className="inkstream-root">
        <LobbyScreen
          user={user}
          pendingInviteRoomId={pendingInviteRoomId}
          publicRooms={publicRooms}
          loadingRooms={loadingRooms}
          savedArtworksCount={savedArtworks.length}
          authError={authError}
          roomError={roomError}
          onRegister={handleRegister}
          onLogin={handleLogin}
          onGuestLogin={handleGuestLogin}
          onUpdateAvatar={handleUpdateAvatar}
          onUpdateStreamerProfile={handleUpdateStreamerProfile}
          onLogout={handleLogout}
          onQuickPlay={handleQuickPlay}
          onCreatePrivateRoom={handleCreatePrivateRoom}
          onJoinRoom={handleJoinRoom}
          onRefreshPublicRooms={() => void fetchPublicRooms()}
          onOpenGallery={() => setShowGallery(true)}
        />
        {showGallery && user && (
          <ArtworkGalleryModal
            sessionArtworks={[]}
            savedArtworks={savedArtworks}
            roomName="Saved Gallery"
            isGuest={user.isGuest}
            onSaveArtwork={handleSaveArtwork}
            onDeleteSavedArtwork={handleDeleteSavedArtwork}
            onClose={() => setShowGallery(false)}
          />
        )}
      </div>
    );
  }

  // --- Active Multiplayer Game Room View ---
  const isOwner = room.ownerId === user.id;
  const isDrawer = room.drawerId === user.id;
  const me = room.players.find((p) => p.id === user.id);
  const timerUrgent = room.phase === 'DRAWING' && room.timeRemaining <= 10;
  const streamerHiddenWord = Boolean(
    isOwner && isDrawer && room.settings.streamerMode && !room.secretWord
  );

  const streamerPopupUrl =
    isOwner && room.streamerSecret && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?streamerPopup=1&room=${encodeURIComponent(
          room.id
        )}&secret=${encodeURIComponent(room.streamerSecret)}`
      : null;

  return (
    <div className="inkstream-root min-h-screen studio-desk-bg flex flex-col">
      {/* Compact Game HUD Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3">
          {/* Left: Back + Brand + Room Code + Round */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/interactive-games"
              title="Back to Interactive Games Hub"
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="The Missing Piece"
              className="w-7 h-7 rounded-full object-contain shrink-0 hidden sm:block"
            />
            <span className="font-display font-extrabold text-xl tracking-tight text-[#F6C915] whitespace-nowrap shrink-0">
              InkStream
            </span>

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 min-w-0">
              <button
                type="button"
                onClick={handleCopyInviteCode}
                title="Copy invite link"
                className="inline-flex items-center gap-1.5 font-mono-tabular font-bold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                {room.id}
                {copiedRoomCode ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
              <span aria-hidden="true">·</span>
              <span className="font-medium whitespace-nowrap">
                {room.phase === 'LOBBY'
                  ? 'Lobby'
                  : `Round ${Math.max(1, room.currentRound)} of ${room.totalRounds}`}
              </span>
            </div>
          </div>

          {/* Center: Countdown Clock + Secret / Masked Word Prompt */}
          <div className="flex items-center gap-3.5 min-w-0">
            {room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER' && (
              <div
                className={`inline-flex items-center gap-1.5 font-mono-tabular text-sm font-bold px-2.5 py-1 rounded-lg border shrink-0 ${
                  timerUrgent
                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{room.timeRemaining}s</span>
              </div>
            )}

            <div className="text-center min-w-0">
              {room.phase === 'DRAWING' && (
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-lg sm:text-xl tracking-widest text-slate-900 truncate">
                    {isDrawer && room.secretWord
                      ? room.secretWord.toUpperCase()
                      : room.maskedWord}
                  </span>
                  {streamerHiddenWord ? (
                    <span className="text-xs font-medium text-blue-700 shrink-0 hidden md:inline">
                      (Word in popup)
                    </span>
                  ) : (
                    room.wordLengthHint.length > 0 &&
                    !isDrawer && (
                      <span className="font-mono-tabular text-xs text-slate-500 shrink-0">
                        ({room.wordLengthHint.join(', ')})
                      </span>
                    )
                  )}
                </div>
              )}
              {room.phase === 'WORD_SELECT' && (
                <span className="font-display font-bold text-base text-slate-700">
                  Selecting word...
                </span>
              )}
              {room.phase === 'TURN_SUMMARY' && room.turnSummary && (
                <span className="font-display font-bold text-lg text-emerald-700 capitalize">
                  {room.turnSummary.word}
                </span>
              )}
              {room.phase === 'LOBBY' && (
                <span className="font-display font-bold text-base text-slate-800 truncate">
                  {room.settings.name}
                </span>
              )}
              {room.phase === 'GAME_OVER' && (
                <span className="font-display font-bold text-base text-slate-900">
                  Final Results
                </span>
              )}
            </div>
          </div>

          {/* Right: Utility Controls (LIVE Overlay, Streamer Word Popup, TikTok LIVE, Sound, Gallery, Analytics, Leave) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <LanguageMenu variant="compact" />
            <LiveOverlayButton
              gameTitle="InkStream"
              gameSlug="inkstream"
              streamerHandle={resolvedOverlayStreamer}
              recommendedSize="640 × 720 or 1080 × 1920"
              label="Overlay"
            />

            {isOwner && room.settings.streamerMode && streamerPopupUrl && (
              <a
                href={streamerPopupUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open private word popup window for off-stream monitor"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-900 bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Word Popup</span>
              </a>
            )}

            {isOwner && (
              <button
                type="button"
                onClick={() => setShowTikTokModal(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  room.tiktokStatus.connected
                    ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Radio className="w-4 h-4" />
                <span className="hidden lg:inline">
                  {room.tiktokStatus.connected
                    ? `@${room.tiktokStatus.username}`
                    : 'TikTok LIVE'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              title={muted ? 'Unmute game sounds' : 'Mute game sounds'}
              className="w-9 h-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
              aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setShowGallery(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ImageIcon className="w-4 h-4 text-blue-600" />
              <span className="hidden md:inline">Gallery</span>
              <span className="font-mono-tabular text-slate-500">{room.artworks.length}</span>
            </button>

            {isOwner && (
              <button
                type="button"
                onClick={handleOpenAnalytics}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden md:inline">Analytics</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleLeaveRoom()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main 3-Column InkStream Arena */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Room Scoreboard + Separate TikTok Chat Scoreboard */}
        <div className="lg:col-span-3 lg:h-[calc(100vh-88px)] lg:sticky lg:top-[72px] flex flex-col gap-3">
          <div className="flex-1 min-h-[240px]">
            <Scoreboard
              players={room.players}
              currentUserId={user.id}
              isCurrentUserOwner={isOwner}
              onKickPlayer={handleKickPlayer}
            />
          </div>
          <div className="shrink-0">
            <TikTokScoreboard
              status={room.tiktokStatus}
              leaderboard={room.tiktokLeaderboard}
              recentChat={room.tiktokChat}
              isOwner={isOwner}
              onOpenConnectModal={() => setShowTikTokModal(true)}
            />
          </div>
        </div>

        {/* Center Column: Interactive Drawing Canvas / Lobby Settings / Match Complete Top 3 Podium */}
        <div className="lg:col-span-6 min-w-0">
          {room.phase === 'GAME_OVER' ? (
            <GameOverPodium
              room={room}
              isOwner={isOwner}
              onPlayAgain={() => handleStartGame(room.players.length < 2)}
              onReturnToLobby={handleReturnToLobby}
              onOpenAnalytics={handleOpenAnalytics}
            />
          ) : (
            <DrawingCanvas
              room={room}
              currentUserId={user.id}
              isOwner={isOwner}
              canDraw={isDrawer}
              streamerPopupUrl={streamerPopupUrl}
              onEmitCommand={handleEmitCommand}
              onEmitLiveSegment={handleEmitLiveSegment}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClear={handleClear}
              onSelectWord={handleSelectWord}
              onReact={handleReact}
              onSaveArtwork={handleSaveArtwork}
              onFinishSoloTurn={handleFinishSoloTurn}
              liveSegmentEvent={liveSegmentEvent}
              lobbyContent={
                <RoomSettingsPanel
                  room={room}
                  isOwner={isOwner}
                  streamerPopupUrl={streamerPopupUrl}
                  onUpdateSettings={handleUpdateSettings}
                  onStartGame={handleStartGame}
                  onOpenTikTokModal={() => setShowTikTokModal(true)}
                  errorMessage={roomError}
                />
              }
            />
          )}
        </div>

        {/* Right Column: Real-Time Guessing & Chat Feed */}
        <div className="lg:col-span-3 lg:h-[calc(100vh-88px)] lg:sticky lg:top-[72px]">
          <ChatPanel
            messages={room.messages}
            phase={room.phase}
            isDrawer={isDrawer}
            hasGuessed={Boolean(me?.hasGuessed)}
            closeGuessNotice={closeGuessNotice}
            onDismissCloseGuess={clearCloseGuessNotice}
            onSendMessage={handleSendMessage}
          />
        </div>
      </main>

      {/* Modals */}
      {showAnalytics && (
        <AnalyticsPanel
          analytics={analytics}
          artworks={room.artworks}
          isOwner={isOwner}
          onClose={() => setShowAnalytics(false)}
          onRefresh={requestAnalytics}
        />
      )}

      {showGallery && (
        <ArtworkGalleryModal
          sessionArtworks={room.artworks}
          savedArtworks={savedArtworks}
          roomName={room.settings.name}
          isGuest={user.isGuest}
          onSaveArtwork={handleSaveArtwork}
          onDeleteSavedArtwork={handleDeleteSavedArtwork}
          onClose={() => setShowGallery(false)}
        />
      )}

      {showTikTokModal && isOwner && (
        <TikTokConnectModal
          isOpen={showTikTokModal}
          status={room.tiktokStatus}
          defaultHandle={user.tiktokHandle || activeStreamer?.username}
          onConnect={handleConnectTikTok}
          onDisconnect={handleDisconnectTikTok}
          onSendTestChat={handleSendTikTokTestChat}
          onClose={() => setShowTikTokModal(false)}
        />
      )}
    </div>
  );
}
