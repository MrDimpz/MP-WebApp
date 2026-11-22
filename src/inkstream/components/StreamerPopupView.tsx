import React, { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Clock, EyeOff, Lock, Radio } from 'lucide-react';
import type { StreamerPopupState } from '../shared/types.ts';

interface StreamerPopupViewProps {
  roomId: string;
  streamerSecret: string;
}

export const StreamerPopupView: React.FC<StreamerPopupViewProps> = ({
  roomId,
  streamerSecret,
}) => {
  const [state, setState] = useState<StreamerPopupState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io('/inkstream', {
      path: '/socket.io',
      auth: {
        streamerRoomId: roomId,
        streamerSecret,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      setConnected(false);
      setError(
        err.message === 'INVALID_STREAMER_POPUP_KEY'
          ? 'This private streamer link is invalid or the room has closed.'
          : 'Connecting to room...'
      );
    });

    socket.on('streamer:state', (next: StreamerPopupState) => {
      setState(next);
      setError(null);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, streamerSecret]);

  const handleSelectWord = (index: number) => {
    socketRef.current?.emit('streamer:select-word', { index });
  };

  return (
    <div className="min-h-screen bg-[#150424] text-[#F5F3F7] flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-md bg-[#210736] border-2 border-[#D4A437]/70 rounded-2xl overflow-hidden shadow-[0_18px_46px_rgba(9,2,18,0.75)]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#D4A437]/30 flex items-center justify-between gap-3 bg-[#19042a]">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="The Missing Piece"
              className="w-8 h-8 rounded-full object-contain shrink-0"
            />
            <div className="min-w-0">
              <h1 className="font-display font-bold text-base text-[#F6C915] truncate flex items-center gap-1.5">
                <EyeOff className="w-4 h-4 shrink-0" />
                <span>Private Streamer Word Picker</span>
              </h1>
              <p className="text-xs text-[#C9B9DC] truncate">
                {state ? `${state.roomName} · ${state.roomId}` : `Room ${roomId}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium shrink-0">
            <Radio className={`w-3.5 h-3.5 ${connected ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className={connected ? 'text-emerald-300' : 'text-amber-300'}>
              {connected ? 'Synced' : 'Reconnecting'}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {error ? (
            <div className="p-4 rounded-lg bg-rose-950/60 border border-rose-700 text-sm text-rose-200 text-center">
              {error}
            </div>
          ) : !state ? (
            <div className="py-10 text-center text-sm text-[#C9B9DC]">
              Connecting to private streamer channel...
            </div>
          ) : state.isStreamerTurn && state.phase === 'WORD_SELECT' ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs text-[#C9B9DC]">
                <span>
                  Round {state.currentRound} of {state.totalRounds} · Your Turn
                </span>
                <span className="inline-flex items-center gap-1 font-mono font-bold text-[#F6C915]">
                  <Clock className="w-3.5 h-3.5" />
                  {state.timeRemaining}s
                </span>
              </div>

              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Pick your secret word
                </h2>
                <p className="text-xs text-[#C9B9DC] mt-1">
                  Keep this window off your stream capture. Click a word to start drawing.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 mt-1">
                {state.wordOptions.map((word, idx) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => handleSelectWord(idx)}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-display font-extrabold text-lg capitalize transition-colors cursor-pointer text-center shadow-md"
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          ) : state.isStreamerTurn && state.phase === 'DRAWING' && state.secretWord ? (
            <div className="text-center py-4 flex flex-col gap-3">
              <div className="flex items-center justify-center gap-2 text-xs text-[#C9B9DC]">
                <span>Round {state.currentRound} of {state.totalRounds}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-[#F6C915]">
                  {state.timeRemaining}s left
                </span>
              </div>
              <p className="text-xs font-semibold text-[#F6C915]">Your Secret Word</p>
              <div className="py-4 px-5 rounded-xl bg-[#130320] border-2 border-[#F6C915]/70 font-display text-3xl font-extrabold text-white tracking-wide capitalize">
                {state.secretWord}
              </div>
              <p className="text-xs text-[#C9B9DC]">
                Hidden on the main stream screen so viewers can&apos;t see it.
              </p>
            </div>
          ) : (
            <div className="text-center py-6 flex flex-col items-center gap-2">
              <Lock className="w-7 h-7 text-[#F6C915]/70 mb-1" />
              <h2 className="font-display font-bold text-lg text-white">
                {state.phase === 'LOBBY'
                  ? 'Waiting in Lobby'
                  : state.phase === 'GAME_OVER'
                    ? 'Match Complete'
                    : state.phase === 'TURN_SUMMARY' && state.secretWord
                      ? `Word was: ${state.secretWord}`
                      : `${state.drawerName} is drawing`}
              </h2>
              <p className="text-xs text-[#C9B9DC] max-w-xs">
                When it&apos;s your turn to draw, your secret word choices will appear right here
                automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
