/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import './index.css';
import { useGameClient } from './services/gameClient.ts';
import { LetterBoard } from './components/LetterBoard.tsx';
import { DiscoveredWordsGrid } from './components/DiscoveredWordsGrid.tsx';
import { LiveLeaderboardPanel } from './components/LiveLeaderboardPanel.tsx';
import { LiveStreamChatPanel } from './components/LiveStreamChatPanel.tsx';
import { StreamOverlays } from './components/StreamOverlays.tsx';
import { VerticalTikTokView } from './components/VerticalTikTokView.tsx';
import { ObsOverlayView } from './components/ObsOverlayView.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { BrandLogo, BRAND_NAME, BRAND_TAGLINE } from './components/BrandLogo.tsx';
import {
  Clock,
  Heart,
  Flame,
  MessageSquare,
  Gift,
  Wifi,
  WifiOff,
  Play,
  Pause,
  Sparkles,
  Lock,
  Moon,
  Unlock,
  ArrowLeft,
  Sun,
  Trophy,
} from 'lucide-react';
import { useOverlayConfig, useOverlaySync } from '@/lib/live-overlay';
import { LiveOverlayButton } from '@/components/interactive-games/live-overlay-button';
import { getLocalTodayDateStr, useDailyStreak } from '@/lib/daily-streak';
import { triggerVictoryConfetti } from '@/lib/confetti';
import { DailyStreakBadge } from '@/components/daily-streak-badge';
import { LanguageMenu } from '@/components/language-menu';
import { useSiteTheme } from '@/lib/site-theme';
import { GameFullState } from './types/game.ts';
import type { ActiveCelebration, RoundSummaryPayload } from './services/gameClient.ts';
import { recordInteractiveWin } from '@/lib/interactive-win-tally';

type ActiveRoute = 'game' | 'vertical' | 'overlay' | 'display' | 'leaderboard' | 'admin';

function resolveRouteFromPathname(pathname: string): ActiveRoute {
  const clean = pathname.toLowerCase().replace(/\/+$/, '');
  if (clean === '/vertical') return 'vertical';
  if (clean === '/overlay' || clean.endsWith('/overlay')) return 'overlay';
  if (clean === '/display') return 'display';
  if (clean === '/leaderboard') return 'leaderboard';
  if (clean === '/admin') return 'admin';
  return 'game';
}

export default function App() {
  const { isOverlay, bg: overlayBg, streamer: overlayStreamer } = useOverlayConfig();
  const { darkMode, toggleDarkMode } = useSiteTheme();
  const hasReceivedHostSyncRef = React.useRef(false);

  const {
    gameState,
    wsConnected,
    lastHighlightedIndices,
    lastWordBanner,
    activeCelebration,
    roundSummary,
    setRoundSummary,
    submissionFeedback,
    sendControlAction,
    submitWord,
    updateGameConfig,
    updateScoringConfig,
    updateGiftsConfig,
    updateSettingsConfig,
    sendModerationAction,
    connectTikTok,
    disconnectTikTok,
    reconnectTikTok,
    simulateEvent,
    runTestSuite,
  } = useGameClient(isOverlay);

  const [route, setRoute] = useState<ActiveRoute>(() =>
    resolveRouteFromPathname(window.location.pathname)
  );

  interface LexiOverlaySnapshot {
    gameState: GameFullState;
    lastHighlightedIndices: number[];
    lastWordBanner: {
      word: string;
      finder: string;
      points: number;
      isPangram: boolean;
      comboCount: number;
    } | null;
    activeCelebration: ActiveCelebration | null;
    roundSummary: RoundSummaryPayload | null;
    submissionFeedback: { type: 'success' | 'error'; message: string } | null;
  }

  const [syncedPayload, setSyncedPayload] = useState<LexiOverlaySnapshot | null>(null);

  const syncedSnapshot = React.useMemo<LexiOverlaySnapshot | null>(
    () =>
      !isOverlay && gameState
        ? {
            gameState: {
              ...gameState,
              chatFeed: [],
              giftHistory: [],
              gameConfig: {
                ...gameState.gameConfig,
                enabledCommands: {},
                difficulties: {} as GameFullState['gameConfig']['difficulties'],
                modes: {},
              },
              scoringConfig: {} as GameFullState['scoringConfig'],
              settingsConfig: {} as GameFullState['settingsConfig'],
            },
            lastHighlightedIndices,
            lastWordBanner,
            activeCelebration,
            roundSummary: roundSummary
              ? {
                  ...roundSummary,
                  missedWords: roundSummary.missedWords.slice(0, 20),
                }
              : null,
            submissionFeedback,
          }
        : null,
    [
      isOverlay,
      gameState,
      lastHighlightedIndices,
      lastWordBanner,
      activeCelebration,
      roundSummary,
      submissionFeedback,
    ]
  );

  useOverlaySync<LexiOverlaySnapshot>({
    gameId: 'lexi',
    streamer: isOverlay
      ? overlayStreamer || undefined
      : gameState?.tiktok?.username || undefined,
    isOverlay,
    localState: syncedSnapshot,
    onSyncedState: React.useCallback((remote) => {
      if (!remote || !remote.gameState) return;
      hasReceivedHostSyncRef.current = true;
      setSyncedPayload(remote);
    }, []),
  });

  const isCleanObsCapture =
    isOverlay || new URLSearchParams(window.location.search).get('clean') === '1';

  useEffect(() => {
    const onPopState = () => {
      setRoute(resolveRouteFromPathname(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (targetRoute: ActiveRoute, _pathStr?: string) => {
    setRoute(targetRoute);
  };

  const activeGameState =
    isOverlay && syncedPayload?.gameState ? syncedPayload.gameState : gameState;
  const activeHighlights =
    isOverlay && syncedPayload ? syncedPayload.lastHighlightedIndices : lastHighlightedIndices;
  const activeBanner =
    isOverlay && syncedPayload ? syncedPayload.lastWordBanner : lastWordBanner;
  const activeFeedback =
    isOverlay && syncedPayload ? syncedPayload.submissionFeedback : submissionFeedback;
  const activeCelebrationState =
    isOverlay && syncedPayload ? syncedPayload.activeCelebration : activeCelebration;
  const activeRoundSummary =
    isOverlay && syncedPayload ? syncedPayload.roundSummary : roundSummary;

  const todayDateStr = React.useMemo(() => getLocalTodayDateStr(), []);
  const isRoundWonToday =
    !isOverlay &&
    Boolean(
      roundSummary?.targetReached ||
        (activeGameState &&
          activeGameState.board.totalPossibleWords > 0 &&
          activeGameState.discoveredWords.length >= activeGameState.board.totalPossibleWords)
    );
  const dailyStreak = useDailyStreak('lexi', todayDateStr, isRoundWonToday);
  const lastCelebratedRoundRef = React.useRef<number | null>(null);

  useEffect(() => {
    if (isOverlay || !roundSummary) return;
    if (lastCelebratedRoundRef.current === roundSummary.roundNumber) return;
    lastCelebratedRoundRef.current = roundSummary.roundNumber;

    // Record persistent win tally for the round's top contributor
    const roundScores = new Map<string, { name: string; points: number; avatar?: string }>();
    for (const entry of roundSummary.discoveredWords) {
      const displayName = (entry.foundByNickname || entry.foundByUsername || 'Player').trim();
      const key = displayName.toLowerCase();
      const prev = roundScores.get(key);
      if (prev) {
        prev.points += entry.points;
        if (!prev.avatar && entry.foundByAvatar) prev.avatar = entry.foundByAvatar;
      } else {
        roundScores.set(key, {
          name: displayName,
          points: entry.points,
          avatar: entry.foundByAvatar,
        });
      }
    }
    const topContributor = Array.from(roundScores.values()).sort(
      (a, b) => b.points - a.points
    )[0];
    if (topContributor) {
      recordInteractiveWin('lexi', topContributor.name, topContributor.avatar);
    } else if (roundSummary.targetReached) {
      recordInteractiveWin('lexi', 'Chat Community');
    }

    const bestKey = 'mp_lexi_best_round_score_v1';
    let prevBest = 0;
    try {
      prevBest = Number(localStorage.getItem(bestKey) || '0') || 0;
      if (roundSummary.roundScore > prevBest) {
        localStorage.setItem(bestKey, String(roundSummary.roundScore));
      }
    } catch {}

    const isNewHighScore = prevBest > 0 && roundSummary.roundScore > prevBest;
    if (roundSummary.targetReached || isNewHighScore) {
      triggerVictoryConfetti({
        isDaily: roundSummary.targetReached,
        isNewHighScore,
      });
    }
  }, [isOverlay, roundSummary]);

  if (!activeGameState) {
    return (
      <div
        className={`lexi-root min-h-screen flex items-center justify-center p-6 ${
          isOverlay && overlayBg === 'transparent'
            ? 'bg-transparent text-slate-100'
            : 'bg-slate-950 text-slate-100'
        }`}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandLogo size="xl" />
          <div>
            <div className="text-xl font-display font-extrabold text-amber-300">
              {BRAND_NAME}
            </div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 mt-1">
              {isOverlay
                ? `${BRAND_TAGLINE} · Waiting for Host Sync...`
                : `${BRAND_TAGLINE} · Loading Live Puzzle Engine...`}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const progressPct = Math.min(
    100,
    Math.round((activeGameState.roundScore / Math.max(1, activeGameState.targetScore)) * 100)
  );

  if (isOverlay) {
    const topContributors = (activeGameState.leaderboards?.round || []).slice(0, 3);
    return (
      <div
        className={`lexi-root min-h-screen flex flex-col items-center justify-center p-3 ${
          overlayBg === 'transparent'
            ? 'bg-transparent text-slate-100'
            : 'bg-slate-950 text-slate-100'
        }`}
      >
        <div className="w-full max-w-[516px] mx-auto flex flex-col gap-3.5">
          {/* Compact Round Status & Countdown Strip */}
          <div className="px-4 py-2 rounded-2xl bg-[#190429]/92 border-2 border-amber-400/60 shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
            <div className="flex items-center gap-2.5">
              <BrandLogo size="xs" showText={true} />
              <span className="text-slate-500">·</span>
              <span className="font-bold text-white">Round {activeGameState.roundNumber}</span>
              <span className="text-slate-500">·</span>
              <span className="capitalize text-amber-300 font-semibold">
                {activeGameState.difficulty}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-300 font-bold">
                {activeGameState.discoveredWords.length}/{activeGameState.board.totalPossibleWords} words
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-lg border font-extrabold flex items-center gap-1 ${
                  activeGameState.remainingSeconds <= 10 && activeGameState.status === 'ACTIVE'
                    ? 'bg-rose-950/90 border-rose-500 text-rose-300'
                    : 'bg-slate-950 border-amber-400/40 text-amber-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {activeGameState.status === 'COUNTDOWN'
                  ? `${activeGameState.countdownSeconds}s`
                  : `${Math.floor(activeGameState.remainingSeconds / 60)}:${String(
                      activeGameState.remainingSeconds % 60
                    ).padStart(2, '0')}`}
              </span>
            </div>
          </div>

          {/* Arcade Cabinet Game Board + Community Target Bar + Word Slots */}
          <div
            key={`ov-cabinet-${activeGameState.roundNumber}`}
            className="arcade-board-cabinet relative rounded-3xl p-2 sm:p-3 flex flex-col gap-2 overflow-hidden shadow-[0_14px_34px_rgba(0,0,0,0.65)]"
          >
            <StreamOverlays
              key={`ov-so-${activeGameState.roundNumber}`}
              celebration={activeCelebrationState}
              roundSummary={activeRoundSummary}
              intermissionSeconds={activeGameState.intermissionSeconds}
              status={activeGameState.status}
              onStartNextRound={() => {}}
              onDismissSummary={() => {}}
              hideActions={true}
            />

            <LetterBoard
              key={`ov-board-${activeGameState.roundNumber}`}
              letters={activeGameState.board.letters}
              centerLetter={activeGameState.board.centerLetter}
              centerIndex={activeGameState.board.centerIndex}
              modifiers={activeGameState.board.modifiers}
              discoveredCount={activeGameState.discoveredWords.length}
              totalPossibleWords={activeGameState.board.totalPossibleWords}
              roundNumber={activeGameState.roundNumber}
              status={activeGameState.status}
              minWordLength={activeGameState.gameConfig.minWordLength}
              highlightedIndices={activeHighlights}
              lastWordBanner={activeBanner}
              submissionFeedback={activeFeedback}
              onSubmitWord={() => {}}
              onShuffle={() => {}}
              onRevealHint={() => {}}
              hideInteractiveInput={true}
              middleSlot={
                <>
                  {/* Horizontal Progress & 5 Circular Padlock Checkpoints */}
                  <div className="w-full max-w-2xl mx-auto flex flex-col gap-1.5 pt-1 pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] px-2">
                      <div className="flex items-center gap-2 text-purple-100 font-bold uppercase tracking-wider">
                        <span>Community Target</span>
                        {activeGameState.activeMultiplier.multiplier > 1 && (
                          <span className="text-amber-300 font-mono font-extrabold flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 text-amber-400" />
                            {activeGameState.activeMultiplier.multiplier}X (
                            {activeGameState.activeMultiplier.remainingSeconds}s)
                          </span>
                        )}
                      </div>
                      <div className="font-mono font-extrabold text-xs text-amber-300 tabular-nums">
                        {activeGameState.roundScore} / {activeGameState.targetScore} pts ({progressPct}%)
                      </div>
                    </div>

                    <div className="relative w-full h-5 flex items-center">
                      <div className="w-full h-3.5 rounded-full bg-[#19032b] border-2 border-[#230638] overflow-hidden p-0.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 shadow-[0_0_14px_rgba(52,211,153,0.85)] transition-all duration-300"
                          style={{ width: `${Math.max(6, progressPct)}%` }}
                        />
                      </div>

                      {[20, 40, 60, 80, 100].map((threshold, idx) => {
                        const isUnlocked = progressPct >= threshold;
                        const leftPositions = ['16%', '33%', '50%', '67%', '84%'];
                        return (
                          <div
                            key={threshold}
                            style={{ left: leftPositions[idx] }}
                            className={`-translate-x-1/2 absolute w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform ${
                              isUnlocked
                                ? 'bg-gradient-to-b from-amber-300 to-amber-500 border-white text-[#1e0533] scale-105 shadow-[0_0_12px_rgba(250,204,21,0.8)]'
                                : 'bg-[#4a1775] border-[#b78ce8] text-amber-300 shadow-[0_3px_0_0_#230638]'
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-[#210638] flex items-center justify-center">
                              {isUnlocked ? (
                                <Unlock className="w-3.5 h-3.5 text-emerald-300 stroke-[2.5]" />
                              ) : (
                                <Lock className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <DiscoveredWordsGrid
                    discoveredWords={activeGameState.discoveredWords}
                    totalPossibleWords={activeGameState.board.totalPossibleWords}
                    revealedHints={activeGameState.revealedHints}
                    wordSlots={activeGameState.board.wordSlots}
                    compact={true}
                  />
                </>
              }
            />
          </div>

          {/* Compact Top 3 Contributors Strip */}
          {topContributors.length > 0 && (
            <div className="px-3.5 py-2 rounded-2xl bg-[#190429]/92 border border-amber-400/50 shadow-lg flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-300 text-[10px] shrink-0">
                <Trophy className="w-3.5 h-3.5" /> Top Solvers
              </span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {topContributors.map((player, idx) => (
                  <span
                    key={player.userId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2a0a45] border border-purple-400/35 text-xs"
                  >
                    <span className="font-mono font-extrabold text-amber-300">#{idx + 1}</span>
                    <span className="font-bold text-white truncate max-w-[100px]">
                      {player.nickname}
                    </span>
                    <span className="font-mono text-emerald-300 tabular-nums">
                      {player.totalPoints}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!gameState) {
    return null;
  }

  return (
    <div
      className={`lexi-root relative min-h-screen flex flex-col transition-colors overflow-x-hidden ${
        isCleanObsCapture && route === 'overlay'
          ? 'lexi-overlay dark bg-transparent text-slate-100'
          : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* 25% Opacity Missing Piece Background Watermark (hidden in clean OBS overlay capture) */}
      {!isCleanObsCapture && (
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
      )}

      {/* Strict 3-Zone Top Bar Contract (hidden in clean OBS capture mode) */}
      {!isCleanObsCapture && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:gap-6 px-3 sm:px-6 py-2.5 sm:py-3.5 border-b border-slate-800 bg-slate-950 sticky top-0 z-30">
          {/* Zone 1: Back Link + Brand Medallion & Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/interactive-games"
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#8F6500] dark:text-amber-400" />
              <span className="hidden sm:inline">Interactive Games</span>
            </Link>
            <div
              onClick={() => navigate('game', '/game')}
              className="flex items-center gap-3 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BrandLogo size="sm" showText={true} showTagline={true} />
            </div>
          </div>

          {/* Zone 2: 5 clean single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a
              href="/game"
              onClick={(e) => {
                e.preventDefault();
                navigate('game', '/game');
              }}
              className={`hover:text-[#2B0938] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                route === 'game' ? 'text-[#8F6500] dark:text-amber-400 font-semibold underline underline-offset-8' : ''
              }`}
            >
              Game Arena
            </a>
            <a
              href="/vertical"
              onClick={(e) => {
                e.preventDefault();
                navigate('vertical', '/vertical');
              }}
              className={`hover:text-[#2B0938] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                route === 'vertical' ? 'text-[#8F6500] dark:text-amber-400 font-semibold underline underline-offset-8' : ''
              }`}
            >
              Vertical 20:9
            </a>
            <a
              href="/overlay"
              onClick={(e) => {
                e.preventDefault();
                navigate('overlay', '/overlay');
              }}
              className={`hover:text-[#2B0938] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                route === 'overlay' || route === 'display'
                  ? 'text-[#8F6500] dark:text-amber-400 font-semibold underline underline-offset-8'
                  : ''
              }`}
            >
              OBS Overlay
            </a>
            <a
              href="/leaderboard"
              onClick={(e) => {
                e.preventDefault();
                navigate('leaderboard', '/leaderboard');
              }}
              className={`hover:text-[#2B0938] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                route === 'leaderboard' ? 'text-[#8F6500] dark:text-amber-400 font-semibold underline underline-offset-8' : ''
              }`}
            >
              Leaderboard
            </a>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                navigate('admin', '/admin');
              }}
              className={`hover:text-[#2B0938] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                route === 'admin' ? 'text-[#8F6500] dark:text-amber-400 font-semibold underline underline-offset-8' : ''
              }`}
            >
              Admin Studio
            </a>
          </nav>

          {/* Zone 3: Language + Theme + Daily Streak + LIVE Overlay + Connect TikTok + New Round actions */}
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2.5">
            <LanguageMenu variant="compact" />
            <button
              type="button"
              onClick={toggleDarkMode}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors cursor-pointer shrink-0"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <DailyStreakBadge
              streak={dailyStreak.streak}
              solvedToday={dailyStreak.solvedToday}
              variant={darkMode ? 'slate' : 'amber-light'}
              compact
            />
            <LiveOverlayButton
              gameTitle="Lexi Tiles"
              gameSlug="lexi"
              streamerHandle={gameState.tiktok?.username || ''}
              recommendedSize="540 × 1200 or 1080 × 2400 (20:9)"
              label="LIVE Overlay"
            />
            <button
              type="button"
              onClick={() => {
                const usernameInput = prompt('Enter TikTok @username to connect LIVE:', 'streamer');
                if (usernameInput && usernameInput.trim()) {
                  connectTikTok(usernameInput.trim());
                }
              }}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                gameState.tiktok?.status === 'CONNECTED'
                  ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/80'
                  : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Wifi className={`w-3.5 h-3.5 ${gameState.tiktok?.status === 'CONNECTED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
              <span>{gameState.tiktok?.status === 'CONNECTED' ? `@${gameState.tiktok?.username} Connected` : 'Connect TikTok'}</span>
            </button>
            <button
              type="button"
              onClick={() => sendControlAction('next_round')}
              className="px-4 py-2 text-xs font-bold text-[#1D0830] bg-gradient-to-b from-amber-300 to-amber-500 rounded-lg hover:from-amber-200 hover:to-amber-400 shadow-md transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              New Round
            </button>
          </div>
        </header>
      )}

      {/* Mobile Route Switcher when viewport < md */}
      {!isCleanObsCapture && (
        <div className="relative z-20 flex md:hidden items-center justify-around gap-1 px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => navigate('game', '/game')}
            className={`px-2.5 py-1 rounded whitespace-nowrap shrink-0 ${
              route === 'game' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400'
            }`}
          >
            Arena
          </button>
          <button
            type="button"
            onClick={() => navigate('vertical', '/vertical')}
            className={`px-2.5 py-1 rounded whitespace-nowrap shrink-0 ${
              route === 'vertical' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400'
            }`}
          >
            Vertical 20:9
          </button>
          <button
            type="button"
            onClick={() => navigate('overlay', '/overlay')}
            className={`px-2.5 py-1 rounded whitespace-nowrap shrink-0 ${
              route === 'overlay' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400'
            }`}
          >
            OBS
          </button>
          <button
            type="button"
            onClick={() => navigate('leaderboard', '/leaderboard')}
            className={`px-2.5 py-1 rounded whitespace-nowrap shrink-0 ${
              route === 'leaderboard' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400'
            }`}
          >
            Ranks
          </button>
          <button
            type="button"
            onClick={() => navigate('admin', '/admin')}
            className={`px-2.5 py-1 rounded whitespace-nowrap shrink-0 ${
              route === 'admin' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400'
            }`}
          >
            Admin
          </button>
        </div>
      )}



      {/* ROUTE 1: MAIN GAME ARENA (/ or /game) */}
      {route === 'game' && (
        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col justify-between gap-4 sm:gap-6">
          {/* TOP SECTION: 3D Medallion Showcase, Round Number, Status, Mode & Difficulty Switcher, and Countdown Timer */}
          <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-4">
              <BrandLogo size="lg" />
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="font-semibold text-[#8F6500] dark:text-amber-400 uppercase tracking-wider">
                    {BRAND_TAGLINE}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#2B0938] dark:text-white">Round {gameState.roundNumber}</span>
                  <span aria-hidden="true">·</span>
                  <span>Status: {gameState.status}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Mode:{' '}
                    <strong className="text-slate-100 capitalize">
                      {gameState.gameConfig?.modes?.[gameState.gameMode]?.name || gameState.gameMode}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Difficulty:{' '}
                    <strong className="text-[#8F6500] dark:text-amber-300 uppercase">
                      {gameState.difficulty || 'medium'}
                    </strong>
                    {gameState.autoDifficulty && (
                      <span className="text-emerald-700 dark:text-emerald-400 ml-1">(Auto-Adaptive)</span>
                    )}
                  </span>
                  {gameState.performanceMetrics && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-slate-300 tabular-nums">
                        {gameState.performanceMetrics.wordsPerMinute} WPM · Engagement{' '}
                        {gameState.performanceMetrics.engagementScore}/100
                      </span>
                    </>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-display font-extrabold text-[#2B0938] dark:text-white tracking-tight">
                  <span className="text-[#8F6500] dark:text-amber-300">{BRAND_NAME}</span> — Collaborative Live Word Puzzle
                </h1>
                {gameState.performanceMetrics?.lastAdaptationNotice && (
                  <div className="text-xs text-[#8F6500] dark:text-amber-300 font-medium">
                    ⚡ {gameState.performanceMetrics.lastAdaptationNotice}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Mode, Difficulty & Simulation Controls + Authoritative Round Timer */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Game Mode Selector */}
              <select
                value={gameState.gameMode}
                onChange={(e) => updateGameConfig({ gameMode: e.target.value })}
                aria-label="Select Game Mode"
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {Object.entries(gameState.gameConfig?.modes || {}).map(([key, m]) => (
                  <option key={key} value={key}>
                    {m.name}
                  </option>
                ))}
              </select>

              {/* Dynamic Difficulty Selector */}
              <select
                value={gameState.difficulty || 'medium'}
                onChange={(e) => updateGameConfig({ difficulty: e.target.value })}
                aria-label="Select Difficulty Level"
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-[#8F6500] dark:text-amber-300 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="easy">Difficulty: Easy</option>
                <option value="medium">Difficulty: Medium</option>
                <option value="hard">Difficulty: Hard</option>
                <option value="extreme">Difficulty: Extreme</option>
              </select>

              {/* Auto-Adaptive Difficulty Toggle */}
              <button
                type="button"
                onClick={() => updateGameConfig({ autoDifficulty: !gameState.autoDifficulty })}
                title="Automatically scale difficulty between rounds based on viewer WPM, accuracy, and engagement"
                className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  gameState.autoDifficulty
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500/50 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {gameState.autoDifficulty ? 'Auto-Adapt: ON' : 'Auto-Adapt: OFF'}
              </button>

              {/* Pause / Resume Quick Button */}
              {gameState.status === 'PAUSED' ? (
                <button
                  type="button"
                  onClick={() => sendControlAction('resume')}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#1D0830] font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => sendControlAction('pause')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              )}

              {/* Authoritative Countdown / Round Timer */}
              <div
                className={`px-4 py-2 rounded-xl border font-mono font-extrabold text-xl tabular-nums flex items-center gap-2 ${
                  gameState.remainingSeconds <= 10 && gameState.status === 'ACTIVE'
                    ? 'bg-rose-50 dark:bg-rose-950/90 border-rose-500 text-rose-700 dark:text-rose-300 animate-urgent'
                    : 'bg-slate-950 border-slate-800 text-[#8F6500] dark:text-amber-400'
                }`}
              >
                <Clock className="w-4 h-4 text-[#8F6500] dark:text-amber-400 shrink-0" />
                <span>
                  {gameState.status === 'COUNTDOWN'
                    ? `Starting in ${gameState.countdownSeconds}s`
                    : `${Math.floor(gameState.remainingSeconds / 60)}:${String(
                        gameState.remainingSeconds % 60
                      ).padStart(2, '0')}`}
                </span>
              </div>
            </div>
          </section>

          {/* CENTRAL & SIDE SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* CENTRAL SECTION (8 cols): Arcade Game-Show Cabinet Board */}
            <div className="lg:col-span-8 flex flex-col gap-5 relative">
              <div className="arcade-board-cabinet relative rounded-3xl p-2 sm:p-3 flex flex-col gap-2 overflow-hidden">
                {/* Celebrations & Round Summary Modal (centered precisely over the main game board) */}
                <StreamOverlays
                  celebration={activeCelebration}
                  roundSummary={roundSummary}
                  intermissionSeconds={gameState.intermissionSeconds}
                  status={gameState.status}
                  onStartNextRound={() => {
                    setRoundSummary(null);
                    sendControlAction('next_round');
                  }}
                  onDismissSummary={() => setRoundSummary(null)}
                />
                {/* Top & Bottom Beveled Metallic Trim Notches */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-56 h-1.5 rounded-b-full bg-gradient-to-r from-[#b384eb] via-amber-300 to-[#b384eb] opacity-85"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-56 h-1.5 rounded-t-full bg-gradient-to-r from-[#b384eb] via-amber-300 to-[#b384eb] opacity-85"
                />

                {/* Central Animated 3D Letter Board with 5-Padlock Checkpoint Bar & 3-Column Word Slots */}
                <LetterBoard
                  letters={gameState.board.letters}
                  centerLetter={gameState.board.centerLetter}
                  centerIndex={gameState.board.centerIndex}
                  modifiers={gameState.board.modifiers}
                  discoveredCount={gameState.discoveredWords.length}
                  totalPossibleWords={gameState.board.totalPossibleWords}
                  roundNumber={gameState.roundNumber}
                  status={gameState.status}
                  minWordLength={gameState.gameConfig.minWordLength}
                  highlightedIndices={lastHighlightedIndices}
                  lastWordBanner={lastWordBanner}
                  submissionFeedback={submissionFeedback}
                  onSubmitWord={(word, username) => submitWord(word, username)}
                  onShuffle={() => sendControlAction('shuffle_board')}
                  onRevealHint={() => sendControlAction('reveal_hint')}
                  onNewRound={() => sendControlAction('next_round')}
                  onOpenSettings={() => navigate('admin', '/admin')}
                  middleSlot={
                    <>
                      {/* Horizontal Progress & Timer Bar with 5 Circular Padlock Checkpoints (matching reference screenshot) */}
                      <div className="w-full max-w-2xl mx-auto flex flex-col gap-1.5 pt-1 pb-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] px-2">
                          <div className="flex items-center gap-2 text-purple-100 font-bold uppercase tracking-wider">
                            <span>Community Target Progress</span>
                            {gameState.activeMultiplier.multiplier > 1 && (
                              <span className="text-amber-300 font-mono font-extrabold flex items-center gap-1">
                                <Flame className="w-3.5 h-3.5 text-amber-400" />
                                {gameState.activeMultiplier.multiplier}X (
                                {gameState.activeMultiplier.remainingSeconds}s)
                              </span>
                            )}
                          </div>
                          <div className="font-mono font-extrabold text-xs text-amber-300 tabular-nums">
                            {gameState.roundScore} / {gameState.targetScore} pts ({progressPct}%)
                          </div>
                        </div>

                        {/* Glowing Track with 5 Padlock Medallions at 18%, 34%, 50%, 66%, 82% */}
                        <div className="relative w-full h-5 flex items-center">
                          {/* Recessed Dark Track */}
                          <div className="w-full h-3.5 rounded-full bg-[#19032b] border-2 border-[#230638] overflow-hidden p-0.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 shadow-[0_0_14px_rgba(52,211,153,0.85)] transition-all duration-300"
                              style={{ width: `${Math.max(6, progressPct)}%` }}
                            />
                          </div>

                          {/* 5 Circular Padlock Checkpoints */}
                          {[20, 40, 60, 80, 100].map((threshold, idx) => {
                            const isUnlocked = progressPct >= threshold;
                            const leftPositions = ['16%', '33%', '50%', '67%', '84%'];
                            return (
                              <div
                                key={threshold}
                                style={{ left: leftPositions[idx] }}
                                title={
                                  isUnlocked
                                    ? `Milestone #${idx + 1} (${threshold}%) Unlocked!`
                                    : `Reach ${threshold}% of Round Target to unlock Milestone #${idx + 1}`
                                }
                                className={`-translate-x-1/2 absolute w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform ${
                                  isUnlocked
                                    ? 'bg-gradient-to-b from-amber-300 to-amber-500 border-white text-[#1e0533] scale-105 shadow-[0_0_12px_rgba(250,204,21,0.8)]'
                                    : 'bg-[#4a1775] border-[#b78ce8] text-amber-300 shadow-[0_3px_0_0_#230638]'
                                }`}
                              >
                                <span className="w-5 h-5 rounded-full bg-[#210638] flex items-center justify-center">
                                  {isUnlocked ? (
                                    <Unlock className="w-3.5 h-3.5 text-emerald-300 stroke-[2.5]" />
                                  ) : (
                                    <Lock className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3-Column Anagram Word Slots Board */}
                      <DiscoveredWordsGrid
                        discoveredWords={gameState.discoveredWords}
                        totalPossibleWords={gameState.board.totalPossibleWords}
                        revealedHints={gameState.revealedHints}
                        wordSlots={gameState.board.wordSlots}
                      />
                    </>
                  }
                />
              </div>
            </div>

            {/* SIDE SECTION (4 cols): Live TikTok Chat & Answers Stream, Leaderboard, Stream Simulator */}
            <aside className="lg:col-span-4 flex flex-col gap-5">
              <LiveStreamChatPanel
                chatFeed={gameState.chatFeed}
                onSimulateChat={(text, username) =>
                  simulateEvent({ type: 'chat_custom', text, username })
                }
              />
              <LiveLeaderboardPanel leaderboards={gameState.leaderboards} />

              {/* Quick Stream & Progressive Mechanics Simulator Bar */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Quick Stream & Mechanics Studio</span>
                  </div>
                  <span className="text-[11px] font-mono text-amber-400">[HOST TOOLS]</span>
                </div>
                <p className="text-xs text-slate-400 mb-2.5">
                  Simulate TikTok LIVE chat & gifts or inject progressive round elements onto the board:
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <button
                    type="button"
                    onClick={() => simulateEvent({ type: 'chat_valid', username: 'WordMaster_TT' })}
                    className="px-3 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    + Chat Valid Word
                  </button>
                  <button
                    type="button"
                    onClick={() => simulateEvent({ type: 'gift_medium', username: 'SuperGifter' })}
                    className="px-3 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    + Gift 2X Boost
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      simulateEvent({ type: 'like', username: 'HypeSquad', likeCount: 50 })
                    }
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    + 50 Stream Likes
                  </button>
                  <button
                    type="button"
                    onClick={() => simulateEvent({ type: 'follow', username: 'NewFan2026' })}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    + New Follower
                  </button>
                </div>

                <div className="pt-2.5 border-t border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center justify-between">
                    <span>Progressive Board Modifiers (Auto-spawns R2+)</span>
                    <button
                      type="button"
                      onClick={() => sendControlAction('unlock_and_reveal_all')}
                      className="text-amber-400 hover:underline font-mono cursor-pointer"
                    >
                      Reveal/Unlock All
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => sendControlAction('add_hidden')}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900/80 border border-indigo-500/40 text-indigo-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      + Mystery &ldquo;?&rdquo; Tile
                    </button>
                    <button
                      type="button"
                      onClick={() => sendControlAction('add_decoy')}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900/80 border border-rose-500/40 text-rose-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      + Decoy Trap Tile
                    </button>
                    <button
                      type="button"
                      onClick={() => sendControlAction('add_locked')}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900/80 border border-amber-500/40 text-amber-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      + Locked Tile
                    </button>
                    <button
                      type="button"
                      onClick={() => sendControlAction('add_bonus')}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-200 font-medium whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      + Golden +5pt Tile
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Gift & Social Activity */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-rose-400" />
                    <span>Recent TikTok Gifts</span>
                  </h3>
                  <span className="text-xs font-mono text-rose-300 tabular-nums">
                    <Heart className="w-3 h-3 inline mr-1" />
                    {gameState.roundLikes} / {gameState.nextLikeMilestone} likes
                  </span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {!gameState.giftHistory || gameState.giftHistory.length === 0 ? (
                    <div className="text-xs text-slate-500 py-3 text-center">
                      Gifts sent during TikTok LIVE trigger bonus time, hints, and score multipliers.
                    </div>
                  ) : (
                    gameState.giftHistory.slice(0, 6).map((g) => (
                      <div
                        key={g.id}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div className="truncate">
                          {g.simulated && (
                            <span className="text-[10px] font-mono text-amber-400 mr-1">[SIM]</span>
                          )}
                          <strong className="text-rose-300">{g.nickname}</strong> · {g.giftName}
                          {g.repeatCount > 1 ? ` x${g.repeatCount}` : ''}
                        </div>
                        <span className="font-mono text-emerald-400 tabular-nums shrink-0 ml-2">
                          +{g.pointsAwarded} pts
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>

          {/* BOTTOM SECTION: Brand Emblem, Community Score, Total Words, Participating Viewers, TikTok LIVE Status, Recent Chat */}
          <footer className="rounded-2xl bg-slate-900 border border-slate-800 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-7 flex flex-wrap items-center gap-5 text-xs">
              <BrandLogo size="xs" showText={true} />
              <span aria-hidden="true" className="text-slate-700">|</span>
              <div>
                <div className="text-slate-400">Community Score</div>
                <div className="text-base font-mono font-bold text-amber-400 tabular-nums">
                  {gameState.roundScore} pts
                </div>
              </div>
              <span aria-hidden="true" className="text-slate-700">|</span>
              <div>
                <div className="text-slate-400">Words Discovered</div>
                <div className="text-base font-mono font-bold text-emerald-400 tabular-nums">
                  {gameState.discoveredWords.length} / {gameState.board.totalPossibleWords}
                </div>
              </div>
              <span aria-hidden="true" className="text-slate-700">|</span>
              <div>
                <div className="text-slate-400">Participating Viewers</div>
                <div className="text-base font-mono font-bold text-slate-100 tabular-nums">
                  {gameState.leaderboards.participatingViewersCount}
                </div>
              </div>
              <span aria-hidden="true" className="text-slate-700">|</span>
              <div>
                <div className="text-slate-400">TikTok LIVE Connection</div>
                <button
                  type="button"
                  onClick={() => navigate('admin', '/admin')}
                  className="flex items-center gap-1.5 font-mono font-semibold text-xs mt-0.5 hover:underline cursor-pointer"
                >
                  {gameState.tiktok?.status === 'CONNECTED' ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Wifi className="w-3.5 h-3.5" /> @{gameState.tiktok?.username} (LIVE)
                    </span>
                  ) : (
                    <span className="text-slate-300 flex items-center gap-1">
                      <WifiOff className="w-3.5 h-3.5 text-slate-400" /> {gameState.tiktok?.status || 'DISCONNECTED'} (Configure)
                    </span>
                  )}
                </button>
              </div>
              <span aria-hidden="true" className="text-slate-700">|</span>
              <div>
                <div className="text-slate-400">Real-Time Engine</div>
                <div className="text-xs font-mono text-slate-300 mt-0.5">
                  {wsConnected ? 'WebSocket Synced' : 'Reconnecting...'}
                </div>
              </div>
            </div>

            {/* Recent Chat Activity Stream */}
            <div className="lg:col-span-5 rounded-xl bg-slate-950 border border-slate-800/90 px-3.5 py-2.5 flex items-center gap-3 overflow-hidden">
              <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />
              <div className="flex-1 min-w-0 text-xs truncate">
                {gameState.chatFeed.length === 0 ? (
                  <span className="text-slate-500">
                    Live chat submissions and !commands (!score, !top, !words) appear here...
                  </span>
                ) : (
                  <div className="truncate">
                    {gameState.chatFeed[0].simulated && (
                      <span className="font-mono text-amber-400 mr-1.5">[SIM]</span>
                    )}
                    <strong className="text-slate-200">{gameState.chatFeed[0].nickname}: </strong>
                    <span
                      className={
                        gameState.chatFeed[0].status === 'accepted'
                          ? 'text-emerald-400 font-mono font-bold'
                          : gameState.chatFeed[0].status === 'rejected'
                          ? 'text-rose-400'
                          : 'text-sky-300'
                      }
                    >
                      {gameState.chatFeed[0].text}
                    </span>
                    {gameState.chatFeed[0].reason && (
                      <span className="text-slate-500 ml-1.5">
                        ({gameState.chatFeed[0].reason})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </footer>
        </main>
      )}

      {/* ROUTE 2: VERTICAL 9:16 TIKTOK LIVE LAYOUT (/vertical) */}
      {route === 'vertical' && (
        <main className="relative z-10 flex-1 flex items-center justify-center">
          <VerticalTikTokView
            gameState={activeGameState}
            highlightedIndices={activeHighlights}
            lastWordBanner={activeBanner}
            submissionFeedback={activeFeedback}
            onSubmitWord={(word, username) => submitWord(word, username)}
            onShuffle={() => sendControlAction('shuffle_board')}
            onRevealHint={() => sendControlAction('reveal_hint')}
            pureBroadcast={isCleanObsCapture}
          />
        </main>
      )}

      {/* ROUTE 3 & 4: OBS OVERLAY & FULL-SCREEN DISPLAY (/overlay and /display) */}
      {(route === 'overlay' || route === 'display') && (
        <main className="relative z-10 flex-1">
          <ObsOverlayView
            gameState={activeGameState}
            initialPreset={route === 'display' ? 'fullscreen' : 'transparent'}
            highlightedIndices={activeHighlights}
            lastWordBanner={activeBanner}
            submissionFeedback={activeFeedback}
            onSubmitWord={(word, username) => submitWord(word, username)}
            onShuffle={() => sendControlAction('shuffle_board')}
            onRevealHint={() => sendControlAction('reveal_hint')}
            onUpdateSettings={(partial) => updateSettingsConfig(partial)}
          />
        </main>
      )}

      {/* ROUTE 5: STANDALONE LEADERBOARD (/leaderboard) */}
      {route === 'leaderboard' && (
        <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-5 sm:py-8">
          <LiveLeaderboardPanel leaderboards={activeGameState.leaderboards} fullPage={true} />
        </main>
      )}

      {/* ROUTE 6: HOST ADMIN CONTROL PANEL (/admin) */}
      {route === 'admin' && (
        <main className="relative z-10 flex-1">
          <AdminDashboard
            gameState={gameState}
            onControlAction={sendControlAction}
            onUpdateGameConfig={updateGameConfig}
            onUpdateScoringConfig={updateScoringConfig}
            onUpdateGiftsConfig={updateGiftsConfig}
            onUpdateSettingsConfig={updateSettingsConfig}
            onModerationAction={sendModerationAction}
            onConnectTikTok={connectTikTok}
            onDisconnectTikTok={disconnectTikTok}
            onReconnectTikTok={reconnectTikTok}
            onSimulateEvent={simulateEvent}
            onRunTestSuite={runTestSuite}
          />
        </main>
      )}
    </div>
  );
}
