import React, { useEffect, useRef } from 'react';
import { TikTokChatMessage } from '../types';
import { MessageSquare } from 'lucide-react';

interface LiveChatBoxProps {
  messages: TikTokChatMessage[];
  connectedUsername: string | null;
  isLightMode?: boolean;
}

export const LiveChatBox: React.FC<LiveChatBoxProps> = ({
  messages,
  connectedUsername,
  isLightMode = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Automatically scroll the chat box to show most recent chat
  useEffect(() => {
    const scrollToBottom = () => {
      const el = scrollContainerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    };
    scrollToBottom();
    const rafId = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(rafId);
  }, [messages, messages.length]);

  return (
    <aside
      aria-label="Live Chat Stream"
      className={`relative z-10 w-[280px] shrink-0 rounded-2xl border-2 border-[#7e22ce] shadow-[0_0_24px_rgba(250,204,21,0.14)] flex flex-col h-[680px] sticky top-20 overflow-hidden opacity-100 ${
        isLightMode
          ? 'bg-white text-[#2d0938]'
          : 'bg-gradient-to-b from-[#2c0938] to-[#16041c] text-[#faf5ff]'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#6b21a8] bg-[#240630] text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-[#facc15] shrink-0" />
          <span className="text-xs font-extrabold tracking-wide truncate">
            Live Chat Stream
          </span>
        </div>
        {connectedUsername && (
          <span className="text-[11px] font-mono text-[#4ade80] truncate">
            @{connectedUsername.replace(/^@/, '')}
          </span>
        )}
      </div>

      {/* Chat Messages Only (No likes/gifts in chat box; shows profile picture + display name, not @ name) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 p-3 overflow-y-auto overscroll-contain space-y-2.5"
      >
        {messages.length === 0 ? (
          <div className={`h-full flex flex-col items-center justify-center text-center px-4 text-xs ${isLightMode ? 'text-[#6b21a8]' : 'text-[#d8b4fe]'}`}>
            <p>No chat messages yet.</p>
            <p className="mt-1 text-[11px]">
              All live viewer chat messages (including multi-word comments and numbers) appear here in real time.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const displayName = msg.nickname || 'Viewer';
            const initials = displayName.slice(0, 2).toUpperCase();
            return (
              <div
                key={msg.id}
                className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-colors ${
                  isLightMode
                    ? 'bg-[#faf7fc] border-[#d8b4fe]'
                    : 'bg-[#16041c] border-[#581c87]'
                }`}
              >
                {msg.profilePictureUrl && msg.profilePictureUrl.startsWith('http') ? (
                  <img
                    src={msg.profilePictureUrl}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover border border-[#facc15] shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#240630] border border-[#facc15] flex items-center justify-center text-xs font-extrabold text-[#facc15] shrink-0">
                    {initials}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-extrabold truncate ${isLightMode ? 'text-[#6b21a8]' : 'text-[#facc15]'}`}>
                    {displayName}
                  </div>
                  <div
                    className={`text-xs mt-0.5 break-words leading-snug ${
                      isLightMode ? 'text-[#2d0938]' : 'text-[#faf5ff]'
                    }`}
                  >
                    {msg.comment}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
