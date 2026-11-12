import { useState, useEffect, useRef, useCallback } from 'react';
import { GameFullState, DiscoveredWordEntry, ProcessedGiftRecord } from '../types/game.ts';
import { soundEngine } from './soundEngine.ts';
import { gameEngine } from '../server/gameEngine.ts';
import { scoringEngine } from '../server/scoringEngine.ts';
import { leaderboardManager } from '../server/leaderboard.ts';
import { eventManager } from '../server/eventManager.ts';
import { tiktokService } from '../integrations/tiktok.ts';
import { giftHandler } from '../integrations/giftHandler.ts';
import { runAutomatedTestSuite } from '../tests/gameSuite.ts';

export interface ActiveCelebration {
  id: string;
  type: 'word' | 'gift' | 'milestone' | 'follow' | 'share';
  title: string;
  subtitle: string;
  points?: number;
  badgeText?: string;
  simulated?: boolean;
  tier?: 'small' | 'medium' | 'large';
}

export interface RoundSummaryPayload {
  roundNumber: number;
  reason: string;
  roundScore: number;
  targetScore: number;
  targetReached: boolean;
  discoveredWords: DiscoveredWordEntry[];
  missedWords: string[];
  totalPossibleWords: number;
}

function buildCompleteState(): GameFullState {
  return {
    ...gameEngine.getFullState(),
    tiktok: tiktokService.getState(),
    giftsConfig: giftHandler.getConfig(),
    giftHistory: giftHandler.getGiftHistory(30),
    connectedDisplays: 1,
    systemHealth: {
      uptimeSeconds: Math.floor(performance.now() / 1000),
      memoryRssMb: 48,
      wsClients: 1,
    },
  };
}

export function useGameClient() {
  const [gameState, setGameState] = useState<GameFullState | null>(() => buildCompleteState());
  const [wsConnected, setWsConnected] = useState<boolean>(true);
  const [lastHighlightedIndices, setLastHighlightedIndices] = useState<number[]>([]);
  const [lastWordBanner, setLastWordBanner] = useState<{
    word: string;
    finder: string;
    points: number;
    isPangram: boolean;
    comboCount: number;
  } | null>(null);
  const [activeCelebration, setActiveCelebration] = useState<ActiveCelebration | null>(null);
  const [roundSummary, setRoundSummary] = useState<RoundSummaryPayload | null>(null);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const highlightTimeoutRef = useRef<number | null>(null);
  const celebrationTimeoutRef = useRef<number | null>(null);

  const triggerCelebration = useCallback((cel: ActiveCelebration, durationMs = 4200) => {
    setActiveCelebration(cel);
    if (celebrationTimeoutRef.current) {
      window.clearTimeout(celebrationTimeoutRef.current);
    }
    celebrationTimeoutRef.current = window.setTimeout(() => {
      setActiveCelebration(null);
    }, durationMs);
  }, []);

  useEffect(() => {
    const initial = buildCompleteState();
    setGameState(initial);
    soundEngine.configure(initial.settingsConfig?.audio);
    setWsConnected(true);

    const handleServerEvent = (msg: any) => {
      const { type, payload, simulated } = msg;

      if (type === 'state:sync') {
        setGameState(payload);
        soundEngine.configure(payload.settingsConfig?.audio);
        return;
      }

      if (type === 'submission:Ack') {
        if (!payload.accepted) {
          setSubmissionFeedback({ type: 'error', message: payload.message });
        } else {
          setSubmissionFeedback({
            type: 'success',
            message: `+${payload.scoreBreakdown?.totalPoints || 0} pts · ${payload.word}`,
          });
        }
        return;
      }

      setGameState((prev) => {
        if (!prev) return buildCompleteState();
        const next = { ...prev };

        switch (type) {
          case 'round:countdown':
            next.status = payload.status;
            next.roundNumber = payload.roundNumber;
            next.countdownSeconds = payload.countdownSeconds;
            setRoundSummary(null);
            soundEngine.play('countdown', payload.countdownSeconds <= 1 ? 1 : 0);
            break;

          case 'board:generated':
            next.board = {
              ...next.board,
              letters: payload.letters,
              centerLetter: payload.centerLetter,
              centerIndex: payload.centerIndex,
              totalPossibleWords: payload.totalPossibleWords,
              pangramCount: payload.pangramCount,
              modifiers: payload.modifiers || next.board.modifiers,
              wordSlots: payload.wordSlots || next.board.wordSlots,
            };
            next.targetScore = payload.targetScore;
            if (payload.difficulty) next.difficulty = payload.difficulty;
            break;

          case 'board:modifier_updated':
            next.board = {
              ...next.board,
              letters: payload.letters,
              centerLetter: payload.centerLetter,
              centerIndex: payload.centerIndex,
              modifiers: payload.modifiers || next.board.modifiers,
            };
            if (payload.notice) {
              setSubmissionFeedback({ type: 'success', message: payload.notice });
            }
            break;

          case 'difficulty:adapted':
            next.difficulty = payload.newDifficulty;
            if (payload.metrics) {
              next.performanceMetrics = payload.metrics;
            }
            triggerCelebration({
              id: `diff-${Date.now()}`,
              type: 'milestone',
              title: `Adaptive Difficulty: ${payload.newDifficulty.toUpperCase()}`,
              subtitle: payload.reason,
              badgeText: 'DYNAMIC AI PACING',
            });
            break;

          case 'round:started':
            next.status = payload.status;
            next.roundNumber = payload.roundNumber;
            next.remainingSeconds = payload.remainingSeconds;
            next.discoveredWords = [];
            next.revealedHints = [];
            next.roundScore = 0;
            if (payload.modifiers || payload.wordSlots) {
              next.board = {
                ...next.board,
                letters: payload.letters || next.board.letters,
                modifiers: payload.modifiers || next.board.modifiers,
                wordSlots: payload.wordSlots || next.board.wordSlots,
              };
            }
            setRoundSummary(null);
            soundEngine.play('gameStart');
            break;

          case 'round:timer':
            next.status = payload.status;
            next.remainingSeconds = payload.remainingSeconds;
            if (typeof payload.intermissionSeconds === 'number') {
              next.intermissionSeconds = payload.intermissionSeconds;
            }
            if (payload.isFinalCountdown && payload.remainingSeconds <= 5 && payload.remainingSeconds > 0) {
              soundEngine.play('countdown', payload.remainingSeconds <= 2 ? 1 : 0);
            }
            break;

          case 'game:paused':
          case 'game:resumed':
            next.status = payload.status;
            next.remainingSeconds = payload.remainingSeconds;
            break;

          case 'game:reset':
            return { ...prev, ...payload };

          case 'word:accepted': {
            const entry: DiscoveredWordEntry = payload.entry;
            const exists = next.discoveredWords.some((w) => w.word === entry.word);
            if (!exists) {
              next.discoveredWords = [entry, ...next.discoveredWords];
            }
            if (payload.wordSlots) {
              next.board = {
                ...next.board,
                wordSlots: payload.wordSlots,
              };
            }
            next.roundScore = payload.roundScore;
            next.targetScore = payload.targetScore;
            if (payload.performanceMetrics) {
              next.performanceMetrics = payload.performanceMetrics;
            }

            setLastHighlightedIndices(entry.usedTileIndices || []);
            setLastWordBanner({
              word: entry.word,
              finder: entry.foundByNickname,
              points: entry.points,
              isPangram: entry.isPangram,
              comboCount: entry.comboCount,
            });
            if (highlightTimeoutRef.current) {
              window.clearTimeout(highlightTimeoutRef.current);
            }
            highlightTimeoutRef.current = window.setTimeout(() => {
              setLastHighlightedIndices([]);
              setLastWordBanner(null);
            }, 2200);

            if (payload.isNewPersonalHigh || entry.isPangram) {
              soundEngine.play('highScore');
            } else {
              soundEngine.play('validWord', entry.word.length - 3);
            }

            if (payload.scoreBreakdown?.milestoneTriggered) {
              soundEngine.play('milestone');
              triggerCelebration({
                id: `ms-${Date.now()}`,
                type: 'milestone',
                title: 'Community Score Milestone!',
                subtitle: `+${payload.scoreBreakdown.milestoneBonusPoints} Bonus Community Points Unlocked!`,
                points: payload.scoreBreakdown.milestoneBonusPoints,
                simulated,
              });
            }
            break;
          }

          case 'word:rejected':
            soundEngine.play('invalidWord');
            break;

          case 'hint:revealed':
            next.revealedHints = payload.revealedHints || [...next.revealedHints, payload.hint];
            if (payload.wordSlots) {
              next.board = {
                ...next.board,
                wordSlots: payload.wordSlots,
              };
            }
            soundEngine.play('milestone');
            break;

          case 'score:updated':
            next.roundScore = payload.roundScore;
            next.targetScore = payload.targetScore;
            if (payload.activeMultiplier) {
              next.activeMultiplier = payload.activeMultiplier;
            }
            break;

          case 'leaderboard:updated':
            next.leaderboards = payload;
            break;

          case 'chat:message': {
            const exists = next.chatFeed.some((c) => c.id === payload.id);
            if (!exists) {
              next.chatFeed = [payload, ...next.chatFeed].slice(0, 60);
            }
            break;
          }

          case 'gift:received': {
            const giftRec: ProcessedGiftRecord = payload;
            next.giftHistory = [giftRec, ...(next.giftHistory || [])].slice(0, 30);
            soundEngine.play('giftReceived');
            triggerCelebration(
              {
                id: giftRec.id,
                type: 'gift',
                title: `${giftRec.nickname} sent ${giftRec.giftName}${giftRec.repeatCount > 1 ? ` x${giftRec.repeatCount}` : ''}!`,
                subtitle: giftRec.message,
                points: giftRec.pointsAwarded,
                badgeText: giftRec.tier.toUpperCase() + ' GIFT',
                tier: giftRec.tier,
                simulated: giftRec.simulated,
              },
              5000
            );
            break;
          }

          case 'like:updated':
            next.roundLikes = payload.roundLikes;
            next.nextLikeMilestone = payload.nextMilestone;
            break;

          case 'like:milestone':
            soundEngine.play('milestone');
            triggerCelebration({
              id: `like-ms-${Date.now()}`,
              type: 'milestone',
              title: `${payload.milestone} Stream Likes Reached!`,
              subtitle: `Triggered by ${payload.triggeredBy} · +${payload.bonusPoints} Pts & +${payload.bonusTimeSeconds}s Time!`,
              points: payload.bonusPoints,
              simulated,
            });
            break;

          case 'follow:received':
            soundEngine.play('newFollower');
            triggerCelebration({
              id: `follow-${Date.now()}`,
              type: 'follow',
              title: `Welcome New Follower: ${payload.nickname}!`,
              subtitle: `Joined the leaderboard +${payload.bonusPoints} Community Points!`,
              points: payload.bonusPoints,
              simulated,
            });
            break;

          case 'share:received':
            soundEngine.play('milestone');
            triggerCelebration({
              id: `share-${Date.now()}`,
              type: 'share',
              title: `${payload.nickname} Shared the Stream!`,
              subtitle: `Community Celebration +${payload.bonusPoints} Points!`,
              points: payload.bonusPoints,
              simulated,
            });
            break;

          case 'round:ended':
            next.status = payload.status;
            next.leaderboards = payload.leaderboards || next.leaderboards;
            if (payload.difficulty) next.difficulty = payload.difficulty;
            if (payload.performanceMetrics) next.performanceMetrics = payload.performanceMetrics;
            setRoundSummary({
              roundNumber: payload.roundNumber,
              reason: payload.reason,
              roundScore: payload.roundScore,
              targetScore: payload.targetScore,
              targetReached: payload.targetReached,
              discoveredWords: payload.discoveredWords,
              missedWords: payload.missedWords,
              totalPossibleWords: payload.totalPossibleWords,
            });
            if (payload.targetReached) {
              soundEngine.play('victory');
            } else {
              soundEngine.play('roundEnd');
            }
            break;

          case 'tiktok:connected':
          case 'tiktok:disconnected':
            next.tiktok = payload;
            break;

          case 'tiktok:error':
            next.tiktok = payload.state || next.tiktok;
            break;

          case 'config:updated':
            if (payload.gameConfig) {
              next.gameConfig = payload.gameConfig;
              next.difficulty = payload.gameConfig.difficulty;
              next.autoDifficulty = payload.gameConfig.autoDifficulty;
              next.progressiveElementsEnabled = payload.gameConfig.progressiveElementsEnabled;
            }
            if (payload.scoringConfig) next.scoringConfig = payload.scoringConfig;
            if (payload.settingsConfig) {
              next.settingsConfig = payload.settingsConfig;
              soundEngine.configure(payload.settingsConfig.audio);
            }
            if (payload.giftsConfig) next.giftsConfig = payload.giftsConfig;
            break;
        }

        return next;
      });
    };

    eventManager.on('broadcast', handleServerEvent);

    return () => {
      eventManager.off('broadcast', handleServerEvent);
      if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
      if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
    };
  }, [triggerCelebration]);

  const sendControlAction = async (action: string) => {
    switch (action) {
      case 'start_game':
      case 'start_round':
        gameEngine.startRound(false);
        break;
      case 'pause':
        gameEngine.pauseRound();
        break;
      case 'resume':
        gameEngine.resumeRound();
        break;
      case 'end_round':
        gameEngine.endCurrentRound('HOST_ENDED');
        break;
      case 'next_round':
      case 'skip_round':
        gameEngine.nextRound();
        break;
      case 'restart_round':
        gameEngine.restartRound();
        break;
      case 'shuffle_board':
        gameEngine.shuffleCurrentBoard();
        break;
      case 'reveal_hint':
        gameEngine.revealHint('Host', false);
        break;
      case 'reset_scores':
        gameEngine.resetGame(true);
        break;
      case 'reset_game':
        gameEngine.resetGame(false);
        break;
      case 'add_hidden':
      case 'add_decoy':
      case 'add_locked':
      case 'add_bonus':
      case 'unlock_and_reveal_all':
        gameEngine.triggerModifierAction(action);
        break;
    }
    const nextState = buildCompleteState();
    setGameState(nextState);
    return { success: true, action, state: nextState };
  };

  const submitWord = async (word: string, username = 'SoloPlayer') => {
    setSubmissionFeedback(null);
    let activeStreamerHandle = '';
    try {
      const rawSession = window.localStorage.getItem('mp_interactive_active_streamer_v1');
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed?.username) activeStreamerHandle = String(parsed.username);
      }
    } catch {
      // ignore
    }
    const effectiveUser =
      username === 'SoloPlayer' && activeStreamerHandle
        ? activeStreamerHandle
        : username;
    const cleanUser = String(effectiveUser || 'SoloPlayer').trim();
    const data = gameEngine.submitWord({
      userId: `web_${cleanUser.toLowerCase()}`,
      username: cleanUser,
      nickname: cleanUser,
      word: String(word || ''),
      source: 'web',
    });
    if (!data.accepted) {
      setSubmissionFeedback({ type: 'error', message: data.message });
    } else {
      setSubmissionFeedback({
        type: 'success',
        message: `+${data.scoreBreakdown?.totalPoints || 0} pts · "${data.word}" accepted!`,
      });
    }
    setGameState(buildCompleteState());
    return data;
  };

  const updateGameConfig = async (partial: any) => {
    const updated = gameEngine.updateGameConfig(partial || {});
    const nextState = buildCompleteState();
    setGameState(nextState);
    return { success: true, gameConfig: updated, state: nextState };
  };

  const updateScoringConfig = async (partial: any) => {
    const updated = scoringEngine.saveConfig(partial || {});
    eventManager.emitGameEvent('config:updated', { scoringConfig: updated });
    setGameState(buildCompleteState());
    return { success: true, scoringConfig: updated };
  };

  const updateGiftsConfig = async (partial: any) => {
    const updated = giftHandler.saveConfig(partial || {});
    setGameState(buildCompleteState());
    return { success: true, giftsConfig: updated };
  };

  const updateSettingsConfig = async (partial: any) => {
    const updated = gameEngine.updateSettingsConfig(partial || {});
    setGameState(buildCompleteState());
    return { success: true, settingsConfig: updated };
  };

  const sendModerationAction = async (action: string, target?: string) => {
    const currentSettings = gameEngine.getSettingsConfig();
    const cleanTarget = String(target || '').trim();

    switch (action) {
      case 'block_user': {
        if (cleanTarget && !currentSettings.moderation.blockedUsers.includes(cleanTarget)) {
          gameEngine.updateSettingsConfig({
            moderation: {
              ...currentSettings.moderation,
              blockedUsers: [...currentSettings.moderation.blockedUsers, cleanTarget],
            },
          });
        }
        break;
      }
      case 'unblock_user': {
        gameEngine.updateSettingsConfig({
          moderation: {
            ...currentSettings.moderation,
            blockedUsers: currentSettings.moderation.blockedUsers.filter(
              (u) => u.toLowerCase() !== cleanTarget.toLowerCase()
            ),
          },
        });
        break;
      }
      case 'remove_from_leaderboard': {
        leaderboardManager.removeUserFromLeaderboards(cleanTarget);
        eventManager.emitGameEvent('leaderboard:updated', leaderboardManager.getAllLeaderboards());
        break;
      }
      case 'clear_activity': {
        gameEngine.clearActivityLogs();
        giftHandler.clearGiftHistory();
        break;
      }
      case 'add_custom_word': {
        const w = cleanTarget.toLowerCase().replace(/[^a-z]/g, '');
        if (w.length >= 3 && !currentSettings.moderation.customWords.includes(w)) {
          gameEngine.updateSettingsConfig({
            moderation: {
              ...currentSettings.moderation,
              customWords: [...currentSettings.moderation.customWords, w],
            },
          });
        }
        break;
      }
      case 'remove_custom_word': {
        gameEngine.updateSettingsConfig({
          moderation: {
            ...currentSettings.moderation,
            customWords: currentSettings.moderation.customWords.filter(
              (w) => w !== cleanTarget.toLowerCase()
            ),
          },
        });
        break;
      }
      case 'add_excluded_word': {
        const w = cleanTarget.toLowerCase().replace(/[^a-z]/g, '');
        if (w && !currentSettings.moderation.excludedWords.includes(w)) {
          gameEngine.updateSettingsConfig({
            moderation: {
              ...currentSettings.moderation,
              excludedWords: [...currentSettings.moderation.excludedWords, w],
            },
          });
        }
        break;
      }
      case 'remove_excluded_word': {
        gameEngine.updateSettingsConfig({
          moderation: {
            ...currentSettings.moderation,
            excludedWords: currentSettings.moderation.excludedWords.filter(
              (w) => w !== cleanTarget.toLowerCase()
            ),
          },
        });
        break;
      }
    }

    const nextState = buildCompleteState();
    setGameState(nextState);
    return {
      success: true,
      settingsConfig: gameEngine.getSettingsConfig(),
      leaderboards: leaderboardManager.getAllLeaderboards(),
    };
  };

  const connectTikTok = async (username: string) => {
    const result = await tiktokService.connect(username);
    setGameState(buildCompleteState());
    return {
      ...result,
      tiktok: tiktokService.getState(),
    };
  };

  const disconnectTikTok = async () => {
    await tiktokService.disconnect();
    setGameState(buildCompleteState());
    return {
      success: true,
      tiktok: tiktokService.getState(),
    };
  };

  const reconnectTikTok = async () => {
    const result = await tiktokService.reconnect();
    setGameState(buildCompleteState());
    return {
      ...result,
      tiktok: tiktokService.getState(),
    };
  };

  const simulateEvent = async (payload: any) => {
    const result = tiktokService.simulateEvent(payload || {});
    const nextState = buildCompleteState();
    setGameState(nextState);
    return {
      success: true,
      simulated: true,
      result,
      state: nextState,
      tiktok: tiktokService.getState(),
    };
  };

  const runTestSuite = async () => {
    return runAutomatedTestSuite();
  };

  return {
    gameState,
    wsConnected,
    lastHighlightedIndices,
    lastWordBanner,
    activeCelebration,
    roundSummary,
    setRoundSummary,
    submissionFeedback,
    setSubmissionFeedback,
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
  };
}
