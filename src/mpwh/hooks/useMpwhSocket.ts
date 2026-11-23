import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { DictionaryLanguageCode } from '../../lib/dictionary-languages';
import type {
  GuessOutcomePayload,
  LadderMode,
  LeaderboardEntry,
  LiveGameStateView,
} from '../shared/types';

export interface UseMpwhSocketOptions {
  channel: string;
  playerName: string;
  language: DictionaryLanguageCode;
  onGuessResult?: (res: GuessOutcomePayload) => void;
  onError?: (message: string) => void;
}

export function useMpwhSocket({
  channel,
  playerName,
  language,
  onGuessResult,
  onError,
}: UseMpwhSocketOptions) {
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [game, setGame] = useState<LiveGameStateView | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;

  const onGuessResultRef = useRef(onGuessResult);
  onGuessResultRef.current = onGuessResult;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Hydrate initial game & leaderboard over HTTP immediately
  useEffect(() => {
    let active = true;
    const ch = encodeURIComponent(channel);
    const langParam = encodeURIComponent(language);
    fetch(`/api/mpwh/game?channel=${ch}&language=${langParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { game?: LiveGameStateView } | null) => {
        if (!active || !data?.game) return;
        setClockOffsetMs(data.game.serverNow - Date.now());
        setGame((prev) => prev ?? data.game ?? null);
      })
      .catch(() => {});

    fetch('/api/mpwh/leaderboard?limit=50')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { entries?: LeaderboardEntry[] } | null) => {
        if (!active || !Array.isArray(data?.entries)) return;
        setLeaderboard(data.entries);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [channel, language]);

  useEffect(() => {
    const socket = io('/mpwh', {
      path: '/socket.io',
      auth: {
        channel,
        playerName: playerNameRef.current,
        language,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on(
      'mpwh:welcome',
      (payload: {
        onlineCount: number;
        game: LiveGameStateView;
        leaderboard: LeaderboardEntry[];
      }) => {
        setOnlineCount(payload.onlineCount);
        setClockOffsetMs(payload.game.serverNow - Date.now());
        setGame(payload.game);
        setLeaderboard(payload.leaderboard);
      }
    );

    socket.on('mpwh:presence', (payload: { onlineCount: number }) => {
      setOnlineCount(payload.onlineCount);
    });

    socket.on('mpwh:game_state', (nextGame: LiveGameStateView) => {
      setClockOffsetMs(nextGame.serverNow - Date.now());
      setGame(nextGame);
    });

    socket.on(
      'mpwh:leaderboard_update',
      (payload: { leaderboard: LeaderboardEntry[] }) => {
        setLeaderboard(payload.leaderboard);
      }
    );

    socket.on('mpwh:guess_result', (outcome: GuessOutcomePayload) => {
      onGuessResultRef.current?.(outcome);
    });

    socket.on('mpwh:error', (payload: { message?: string }) => {
      if (payload?.message) {
        onErrorRef.current?.(payload.message);
      }
    });

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [channel]);

  // Sync player name when changed
  useEffect(() => {
    if (connected && socketRef.current) {
      socketRef.current.emit('mpwh:set_name', { playerName });
    }
  }, [connected, playerName]);

  // Sync active language when changed via site LanguageMenu
  useEffect(() => {
    if (connected && socketRef.current) {
      socketRef.current.emit('mpwh:set_language', { language });
    }
  }, [connected, language]);

  const setMode = useCallback((mode: LadderMode) => {
    socketRef.current?.emit('mpwh:set_mode', { mode });
  }, []);

  const startGame = useCallback(
    (opts?: {
      mode?: LadderMode;
      language?: DictionaryLanguageCode;
      autoNextRound?: boolean;
    }) => {
      socketRef.current?.emit('mpwh:start_game', {
        mode: opts?.mode,
        language: opts?.language,
        autoNextRound: opts?.autoNextRound,
      });
    },
    []
  );

  const submitGuess = useCallback(
    (
      word: string,
      opts?: {
        playerName?: string;
        tiktokHandle?: string;
        avatarUrl?: string;
        targetBoardIndex?: number | null;
        silent?: boolean;
      }
    ) => {
      socketRef.current?.emit('mpwh:submit_guess', {
        word,
        playerName: opts?.playerName ?? playerNameRef.current,
        tiktokHandle: opts?.tiktokHandle,
        avatarUrl: opts?.avatarUrl,
        targetBoardIndex: opts?.targetBoardIndex ?? null,
        silent: opts?.silent,
      });
    },
    []
  );

  const useHint = useCallback(
    (hintType: 'bracket' | 'clue', boardIndex: number, targetIndex: number) => {
      socketRef.current?.emit('mpwh:use_hint', {
        hintType,
        boardIndex,
        targetIndex,
      });
    },
    []
  );

  const revealGame = useCallback(() => {
    socketRef.current?.emit('mpwh:reveal_game');
  }, []);

  return {
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
  };
}
