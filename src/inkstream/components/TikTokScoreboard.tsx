import React from 'react';
import { Check, Radio, Settings2 } from 'lucide-react';
import type { TikTokChatItem, TikTokPlayerScore, TikTokStatus } from '../shared/types.ts';

interface TikTokScoreboardProps {
  status: TikTokStatus;
  leaderboard: TikTokPlayerScore[];
  recentChat: TikTokChatItem[];
  isOwner: boolean;
  onOpenConnectModal: () => void;
}

export const TikTokScoreboard: React.FC<TikTokScoreboardProps> = ({
  status,
  leaderboard,
  recentChat,
  isOwner,
  onOpenConnectModal,
}) => {
  return (
    <section className="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-[#19042a]">
        <div className="flex items-center gap-2 min-w-0">
          <Radio
            className={`w-4 h-4 shrink-0 ${
              status.connected ? 'text-rose-400' : 'text-[#C9B9DC]'
            }`}
          />
          <div className="min-w-0">
            <h2 className="font-display font-bold text-sm text-[#F6C915] truncate">
              TikTok Chat Scoreboard
            </h2>
            <p className="text-[11px] text-[#E3D5F5] truncate font-mono-tabular">
              {status.connected
                ? `@${status.username} · ${status.viewerCount} viewers`
                : 'Not connected'}
            </p>
          </div>
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={onOpenConnectModal}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Settings2 className="w-3 h-3" />
            {status.connected ? 'Manage' : 'Connect'}
          </button>
        )}
      </div>

      {/* Ranked TikTok Viewers */}
      <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto thin-scrollbar">
        {leaderboard.length === 0 ? (
          <div className="px-3.5 py-5 text-center text-xs text-slate-500">
            {status.connected
              ? 'TikTok viewers who guess the word in chat appear here.'
              : 'Connect TikTok LIVE to score viewer guesses separately.'}
          </div>
        ) : (
          leaderboard.map((viewer, idx) => {
            const rank = idx + 1;
            const initial = (viewer.nickname || viewer.uniqueId || 'T').slice(0, 1).toUpperCase();

            return (
              <div
                key={viewer.uniqueId}
                className={`px-3 py-2 flex items-center gap-2.5 ${
                  viewer.hasGuessed ? 'bg-emerald-950/65' : 'bg-[#210736]'
                }`}
              >
                <span
                  className={`font-mono-tabular text-xs font-bold w-6 text-center shrink-0 ${
                    rank === 1
                      ? 'text-[#F6C915]'
                      : rank === 2
                        ? 'text-slate-200'
                        : rank === 3
                          ? 'text-amber-400'
                          : 'text-[#C9B9DC]'
                  }`}
                >
                  #{rank}
                </span>

                {viewer.profilePictureUrl ? (
                  <img
                    src={viewer.profilePictureUrl}
                    alt={viewer.nickname}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-[#D4A437]/50 shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#38105c] border border-[#D4A437]/40 text-[#F6C915] text-xs font-bold flex items-center justify-center shrink-0">
                    {initial}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white truncate">
                      {viewer.nickname}
                    </span>
                    {viewer.hasGuessed && (
                      <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#D9C8EE]">
                    <span className="font-mono-tabular font-semibold text-white">
                      {viewer.score} pts
                    </span>
                    {viewer.roundScore > 0 && (
                      <span className="font-mono-tabular text-emerald-300 font-bold">
                        +{viewer.roundScore}
                      </span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {viewer.wordsGuessed} {viewer.wordsGuessed === 1 ? 'word' : 'words'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Compact Spoiler-Free Live TikTok Chat Strip */}
      {status.connected && recentChat.length > 0 && (
        <div className="px-3 py-2.5 border-t border-[#D4A437]/35 bg-[#140321] max-h-28 overflow-y-auto thin-scrollbar flex flex-col gap-1.5">
          {recentChat.slice(-6).map((item) => (
            <div
              key={item.id}
              className={`text-xs leading-snug truncate px-2 py-1 rounded-md ${
                item.isCorrect
                  ? 'font-bold text-emerald-200 bg-emerald-900/60 border border-emerald-400/50'
                  : 'text-white bg-[#24093c] border border-white/10'
              }`}
            >
              <span className="font-bold text-[#F6C915] mr-1.5">@{item.nickname}:</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
