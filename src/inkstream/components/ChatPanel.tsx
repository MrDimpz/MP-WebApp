import React, { useEffect, useRef, useState } from 'react';
import { Flame, Send, X } from 'lucide-react';
import type { ChatMessage, GamePhase } from '../shared/types.ts';

interface ChatPanelProps {
  messages: ChatMessage[];
  phase: GamePhase;
  isDrawer: boolean;
  hasGuessed: boolean;
  hasFirstStroke: boolean;
  closeGuessNotice: { guess: string; message: string } | null;
  onDismissCloseGuess: () => void;
  onSendMessage: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  phase,
  isDrawer,
  hasGuessed,
  hasFirstStroke,
  closeGuessNotice,
  onDismissCloseGuess,
  onSendMessage,
}) => {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInput('');
  };

  const waitingForFirstStroke = phase === 'DRAWING' && !hasFirstStroke;

  const placeholder =
    phase === 'DRAWING'
      ? isDrawer
        ? 'Chat with players (do not spoil the word)...'
        : hasGuessed
          ? 'You guessed it! Chat with other guessers...'
          : waitingForFirstStroke
            ? 'Wait for the first stroke to guess...'
            : 'Type your guess here...'
      : 'Type a chat message...';

  return (
    <aside className="bg-[#210736] border border-[#D4A437]/45 rounded-xl flex flex-col overflow-hidden h-full min-h-[360px] lg:min-h-0 shadow-[0_12px_30px_rgba(9,2,18,0.45)]">
      <div className="px-4 py-3 border-b border-[#D4A437]/35 bg-[#19042a] flex items-center justify-between gap-2">
        <h2 className="font-display font-bold text-sm text-[#F6C915] tracking-tight">
          Guesses &amp; Chat
        </h2>
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
            phase === 'DRAWING' && !isDrawer && !hasGuessed
              ? hasFirstStroke
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                : 'bg-amber-500/20 border-amber-400/50 text-amber-200'
              : 'bg-white/10 border-white/15 text-[#E8DCF8]'
          }`}
        >
          {phase === 'DRAWING' && !isDrawer && !hasGuessed
            ? hasFirstStroke
              ? 'Guessing open'
              : 'Waiting for 1st stroke'
            : 'Live room chat'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar px-3 py-3 flex flex-col gap-2 text-sm bg-[#140321]">
        {messages.length === 0 && (
          <p className="text-xs font-medium text-[#D6C5EC] text-center py-8">
            Messages and guesses will appear here.
          </p>
        )}

        {messages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <div
                key={msg.id}
                className="text-xs font-medium text-[#EAE0F8] py-1.5 px-2.5 bg-[#2a0c46] border border-[#D4A437]/30 rounded-lg leading-snug"
              >
                {msg.text}
              </div>
            );
          }

          if (msg.type === 'correct') {
            return (
              <div
                key={msg.id}
                className="text-xs font-bold text-emerald-100 bg-emerald-900/75 border border-emerald-400/70 py-2 px-2.5 rounded-lg shadow-sm"
              >
                {msg.text}
              </div>
            );
          }

          if (msg.type === 'guessed-chat') {
            return (
              <div
                key={msg.id}
                className="text-xs text-emerald-50 bg-emerald-950/70 border border-emerald-500/40 py-1.5 px-2.5 rounded-lg break-words leading-snug"
              >
                <span className="font-bold text-emerald-300 mr-1.5">
                  {msg.senderName} (guessed):
                </span>
                <span>{msg.text}</span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className="text-sm text-white bg-[#24093c] border border-white/10 px-2.5 py-1.5 rounded-lg break-words leading-snug"
            >
              <span className="font-bold text-[#F6C915] mr-1.5">{msg.senderName}:</span>
              <span className="text-white">{msg.text}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Private Close-Guess Banner (ONLY shown to the guesser, NEVER in shared chat!) */}
      {closeGuessNotice && (
        <div
          role="status"
          aria-live="polite"
          className="mx-2.5 my-2 px-3 py-2 rounded-lg bg-amber-950/90 border border-[#F6C915] flex items-center justify-between gap-2 text-xs font-bold text-[#FEF08A]"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Flame className="w-4 h-4 text-[#F6C915] shrink-0" />
            <span className="truncate">{closeGuessNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={onDismissCloseGuess}
            aria-label="Dismiss hint"
            className="text-[#F6C915] hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-2.5 border-t border-[#D4A437]/35 bg-[#19042a]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={160}
            placeholder={placeholder}
            className="flex-1 min-w-0 px-3 py-2 text-sm bg-[#11021d] border border-[#D4A437]/50 rounded-lg text-white placeholder:text-[#C5B3DE] focus:outline-none focus:ring-2 focus:ring-[#F6C915]/40 focus:border-[#F6C915]"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send message"
            className="w-9 h-9 rounded-lg bg-[#F6C915] text-[#1D0830] flex items-center justify-center hover:bg-[#FFE047] disabled:opacity-40 transition-colors cursor-pointer shrink-0 font-bold"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </aside>
  );
};
