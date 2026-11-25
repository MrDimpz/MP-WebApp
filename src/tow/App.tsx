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
import { soundEngine } from './audio/soundEngine';
import { BattlefieldCanvas } from './components/BattlefieldCanvas';
import { BottomDock } from './components/BottomDock';
import { HorizonCommandDeck } from './components/HorizonCommandDeck';
import { HostDrawer } from './components/HostDrawer';
import { TopHud } from './components/TopHud';
import { VictoryOverlay } from './components/VictoryOverlay';
import { gameEngine } from './engine/gameEngine';
import type {
  HudSnapshot,
  TikTokChatMessage,
  TowOverlaySnapshot,
  WsConnectionStatus,
} from './types';

const STORAGE_KEY_LIVE_HANDLE = 'tow_live_handle_v1';

function parseIncomingTikTokJson(raw: string): TikTokChatMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    // Standard TikFinity / TikTok-Live-Connector wrapper: { event: 'chat', data: { nickname, uniqueId, profilePictureUrl, comment } }
    if (parsed.event && parsed.event !== 'chat') return null;
    const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;

    const comment =
      typeof data.comment === 'string'
        ? data.comment
        : typeof data.text === 'string'
          ? data.text
          : typeof data.message === 'string'
            ? data.message
            : '';

    const nickname =
      (typeof data.nickname === 'string' && data.nickname.trim()) ||
      (typeof data.uniqueId === 'string' && data.uniqueId.trim()) ||
      (typeof data.username === 'string' && data.username.trim()) ||
      '';

    const username =
      (typeof data.uniqueId === 'string' && data.uniqueId.trim()) ||
      (typeof data.username === 'string' && data.username.trim()) ||
      nickname;

    const avatarUrl =
      typeof data.profilePictureUrl === 'string'
        ? data.profilePictureUrl
        : typeof data.avatarUrl === 'string'
          ? data.avatarUrl
          : undefined;

    if (!username || !comment) return null;
    return { username, nickname, avatarUrl, comment };
  } catch {
    return null;
  }
}

export default function App() {
  // Platform Overlay, Unified Auth & Daily Streak Hooks
  const overlayConfig = useOverlayConfig();
  const isOverlay = overlayConfig.isOverlay;
  const { user: currentUser } = useUnifiedAuth();
  const dailyStreak = useDailyStreak('tow');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Core Game HUD Snapshot
  const [hud, setHud] = useState<HudSnapshot>(() => gameEngine.getSnapshot());
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Built-in Site TikTok LIVE Resilient Bridge State
  const activeStreamerSession = getActiveInteractiveStreamerSession();
  const [liveHandle, setLiveHandle] = useState<string>(() => {
    const fromSession = getActiveInteractiveStreamerSession()?.username || '';
    if (fromSession) return fromSession;
    try {
      return localStorage.getItem(STORAGE_KEY_LIVE_HANDLE) || '';
    } catch {
      return '';
    }
  });
  const { darkMode, toggleDarkMode } = useSiteTheme();
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isLiveConnecting, setIsLiveConnecting] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const liveSessionId = useMemo(
    () => getLiveConnectionSessionId('tow'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser?.uid, activeStreamerSession?.username]
  );

  // External TikFinity / Local WebSocket Bridge State
  const [wsUrl, setWsUrl] = useState('ws://localhost:21213');
  const [wsStatus, setWsStatus] = useState<WsConnectionStatus>('DISCONNECTED');
  const [wsError, setWsError] = useState<string | null>(null);
  const [wsMessageCount, setWsMessageCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Track real (non-simulator) viewer usernames so we only credit real TikTok viewers
  const realViewerUsernamesRef = useRef<Set<string>>(new Set());

  // Persist liveHandle
  useEffect(() => {
    if (isOverlay) return;
    try {
      localStorage.setItem(STORAGE_KEY_LIVE_HANDLE, liveHandle);
    } catch {
      // ignore storage errors
    }
  }, [liveHandle, isOverlay]);

  // Configure engine overlay mode
  useEffect(() => {
    gameEngine.setOverlayMode(isOverlay);
  }, [isOverlay]);

  // Subscribe to game engine HUD snapshots
  useEffect(() => {
    return gameEngine.subscribe((snapshot) => {
      setHud(snapshot);
    });
  }, []);

  // Wire engine Victory & Next-Match callbacks for platform confetti, daily streak, daily limits & MVP score crediting
  useEffect(() => {
    if (isOverlay) {
      gameEngine.onVictoryCallback = null;
      gameEngine.onBeforeNextMatchCallback = null;
      return;
    }

    gameEngine.onVictoryCallback = (summary, matchNumber) => {
      triggerVictoryConfetti();
      recordInteractiveRoundCompleted('tow', `tow-round-${matchNumber}`);
      recordDailyPuzzleSolved('tow', getLocalTodayDateStr());

      // Credit real winning MVPs on linked Missing Piece accounts
      summary.mvps.forEach((mvp, index) => {
        const key = mvp.username.trim().replace(/^@+/, '').toLowerCase();
        if (realViewerUsernamesRef.current.has(key)) {
          creditInteractiveScoreByTikTokHandle({
            tiktokUsername: mvp.username,
            gameId: 'tow',
            pointsEarned: index === 0 ? 150 : 90,
            reason: `Tug of Words #${index + 1} MVP (${mvp.biggestWord})`,
          });
        }
      });
    };

    gameEngine.onBeforeNextMatchCallback = (completedMatchNumber) => {
      return tryConsumeOrCheckNextRound('tow', `tow-round-${completedMatchNumber}`);
    };

    return () => {
      gameEngine.onVictoryCallback = null;
      gameEngine.onBeforeNextMatchCallback = null;
    };
  }, [isOverlay]);

  // Helper to ingest a real viewer message and credit valid words
  const handleRealChatMessage = useCallback(
    (msg: TikTokChatMessage) => {
      if (isOverlay) return;
      const cleanUser = msg.username.trim().replace(/^@+/, '');
      if (cleanUser) {
        realViewerUsernamesRef.current.add(cleanUser.toLowerCase());
      }
      const res = gameEngine.processChatMessage(msg);
      if (res.outcome === 'VALID' && cleanUser) {
        creditInteractiveScoreByTikTokHandle({
          tiktokUsername: cleanUser,
          gameId: 'tow',
          pointsEarned: 25,
          reason: `Tug of Words hit (${res.word || 'word'})`,
        });
      }
    },
    [isOverlay]
  );

  // Attach Built-in Site TikTok LIVE Resilient Bridge (Socket.IO + HTTP Poll + Webhook)
  useEffect(() => {
    if (isOverlay) return;
    const deduplicator = createEventDeduplicator();
    const detach = attachResilientChatListeners({
      gameId: 'tow',
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
        const nickname = (ev.nickname || ev.uniqueId || '').trim();
        const comment = (ev.comment || '').trim();
        if (!handle || !comment) return;
        handleRealChatMessage({
          username: handle,
          nickname,
          avatarUrl: ev.profilePictureUrl || undefined,
          comment,
        });
      },
    });
    return () => {
      detach();
    };
  }, [isOverlay, handleRealChatMessage]);

  // Expose global window.onTikTokChatMessage({ username, nickname, avatarUrl, comment }) bridge
  useEffect(() => {
    if (isOverlay) return;
    window.onTikTokChatMessage = (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const username = (payload.username || payload.nickname || '').trim();
      const comment = (payload.comment || '').trim();
      if (!username || !comment) return;
      handleRealChatMessage({
        username,
        nickname: payload.nickname || username,
        avatarUrl: payload.avatarUrl,
        comment,
      });
    };
    return () => {
      delete window.onTikTokChatMessage;
    };
  }, [isOverlay, handleRealChatMessage]);

  // Unlock Web Audio API on first user gesture anywhere in the window
  useEffect(() => {
    if (isOverlay) return;
    const unlock = () => {
      soundEngine.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [isOverlay]);

  // Clean up external WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Direct Site TikTok LIVE Bridge Handlers
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
        gameId: 'tow',
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
    void liveChatBridge.disconnectStream('tow', liveSessionId);
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
        gameId: 'tow',
      },
      () => {
        setIsLiveConnecting(false);
      }
    );
  }, [liveHandle, liveSessionId]);

  // External TikFinity / Local WebSocket Handlers
  const handleDisconnectWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsStatus('DISCONNECTED');
    setWsError(null);
  }, []);

  const handleConnectWs = useCallback(() => {
    const trimmed = wsUrl.trim();
    if (!/^wss?:\/\/.+/.test(trimmed)) {
      setWsError('URL must start with ws:// or wss://');
      return;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsError(null);
    setWsStatus('CONNECTING');
    try {
      const socket = new WebSocket(trimmed);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsStatus('CONNECTED');
        setWsError(null);
      };
      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        const msg = parseIncomingTikTokJson(event.data);
        if (msg) {
          setWsMessageCount((c) => c + 1);
          handleRealChatMessage(msg);
        }
      };
      socket.onerror = () => {
        setWsError('Unable to reach local TikFinity / TikTok-Live-Connector bridge.');
        setWsStatus('ERROR');
      };
      socket.onclose = () => {
        setWsStatus((prev) => (prev === 'ERROR' ? 'ERROR' : 'DISCONNECTED'));
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
      };
    } catch {
      setWsError('Failed to open WebSocket connection.');
      setWsStatus('ERROR');
    }
  }, [wsUrl, handleRealChatMessage]);

  // TikTok LIVE Studio Overlay Real-Time Sync (Host broadcasts -> Overlay mirrors)
  const overlaySnapshot = useMemo<TowOverlaySnapshot | null>(() => {
    if (isOverlay) return null;
    return gameEngine.exportOverlaySnapshot({
      isLiveConnected,
      liveHandle,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOverlay, hud, isLiveConnected, liveHandle]);

  useOverlaySync<TowOverlaySnapshot>({
    gameId: 'tow',
    streamer: overlayConfig.streamer || liveHandle || activeStreamerSession?.username || '',
    channel: overlayConfig.channel,
    isOverlay,
    localState: overlaySnapshot,
    onSyncedState: (synced) => {
      if (!synced) return;
      gameEngine.applyOverlaySnapshot(synced);
      setIsLiveConnected(Boolean(synced.isLiveConnected));
      if (synced.liveHandle) {
        setLiveHandle(synced.liveHandle);
      }
    },
  });

  const isTransparentOverlay = isOverlay && overlayConfig.bg === 'transparent';
  const memberLabel = currentUser ? getCleanDisplayName(currentUser) : 'Sign In';

  return (
    <main
      className={`tow-root w-full ${
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
              ? 'radial-gradient(circle at 50% 45%, rgba(246, 201, 21, 0.10) 0%, rgba(43, 9, 56, 0.58) 46%, #12031E 100%)'
              : 'radial-gradient(circle at 50% 45%, rgba(246, 201, 21, 0.16) 0%, rgba(232, 218, 250, 0.72) 48%, #F3ECFB 100%)',
          }}
        />
      )}

      {/* Host Studio Top Navigation Bar (Hidden in LIVE Studio Overlay Mode) */}
      {!isOverlay && (
        <header className="relative z-40 shrink-0 w-full bg-white/95 dark:bg-[#160524]/95 backdrop-blur-md border-b border-[#E3D4F4] dark:border-[#F6C915]/20 px-3 py-1.5 flex items-center justify-between gap-2">
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
                  TUG OF <span className="text-[#9A6E00] dark:text-[#F6C915]">WORDS</span>
                </p>
                <p className="text-[9px] font-bold tracking-widest uppercase text-[#6B4A8A] dark:text-[#E2C9F2]/60 truncate">
                  The Missing Piece · Live Arena
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
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
              gameTitle="Tug of Words"
              gameSlug="tow"
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
          className={`relative h-full w-full sm:w-auto sm:aspect-[9/16] max-w-[540px] flex flex-col overflow-hidden ${
            isTransparentOverlay ? 'tow-studio-grid-bg-transparent' : 'tow-studio-grid-bg'
          } ${
            isOverlay
              ? ''
              : 'sm:rounded-[24px] sm:border sm:border-[#C5A8E8] dark:sm:border-[#F6C915]/25 sm:shadow-[0_18px_48px_rgba(43,9,56,0.25)] dark:sm:shadow-[0_0_60px_rgba(0,0,0,0.85),0_0_28px_rgba(246,201,21,0.14)]'
          }`}
        >
          {/* Subtle CRT Scanline Overlay */}
          {!isTransparentOverlay && (
            <div className="absolute inset-0 tow-crt-scanlines z-30 opacity-35" />
          )}

          {/* 1. TOP STATUS HUD */}
          <TopHud
            hud={hud}
            isLiveConnected={isLiveConnected}
            liveHandle={liveHandle}
          />

          {/* 2. TERRITORY BATTLEFIELD (60fps HTML5 Canvas + Horizon Command Deck + Victory Podium) */}
          <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-[#140321]">
            <BattlefieldCanvas />
            <HorizonCommandDeck hud={hud} />
            <VictoryOverlay
              hud={hud}
              isOverlay={isOverlay}
              onStartNextMatch={() => gameEngine.startNextMatch()}
            />
          </div>

          {/* 3. BOTTOM USED-WORDS TICKER & STREAMER HOST DOCK */}
          <BottomDock
            hud={hud}
            wsStatus={wsStatus}
            isLiveConnected={isLiveConnected}
            isOverlay={isOverlay}
            onTogglePause={() => gameEngine.togglePause()}
            onResetTeams={() => gameEngine.resetTeams()}
            onNextPhase={() => gameEngine.advancePhase()}
            onToggleMute={() => gameEngine.toggleMute()}
            onOpenDrawer={() => setDrawerOpen(true)}
          />

          {/* 4. HOST STUDIO DRAWER (Direct TikTok LIVE / Simulator / Manual Test / WebSocket Bridge) */}
          {!isOverlay && (
            <HostDrawer
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              hud={hud}
              liveHandle={liveHandle}
              isLiveConnected={isLiveConnected}
              isLiveConnecting={isLiveConnecting}
              liveError={liveError}
              onLiveHandleChange={setLiveHandle}
              onConnectLive={handleConnectLive}
              onDisconnectLive={handleDisconnectLive}
              onForceReconnectLive={handleForceReconnectLive}
              wsUrl={wsUrl}
              wsStatus={wsStatus}
              wsError={wsError}
              wsMessageCount={wsMessageCount}
              onWsUrlChange={setWsUrl}
              onConnectWs={handleConnectWs}
              onDisconnectWs={handleDisconnectWs}
              onToggleSim={(enabled) => gameEngine.setSimulatorEnabled(enabled)}
              onChangeIntensity={(intensity) => gameEngine.setSimIntensity(intensity)}
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
