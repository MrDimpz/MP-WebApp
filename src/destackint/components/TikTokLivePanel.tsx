import React, { useState, useRef, useEffect } from 'react';
import {
  Radio,
  Trophy,
  MessageSquare,
  Zap,
  Send,
  Crown,
  Medal,
  Award,
  RotateCcw,
  Users,
  CheckCircle2,
  Sparkles,
  Settings,
} from 'lucide-react';
import { RunningScoreboardPlayer, LiveChatItem } from '../types';
import { getSafeAvatarUrl, handleAvatarError } from '../utils/avatar';

interface TikTokLivePanelProps {
  tiktokUsername: string;
  isConnected: boolean;
  roomId?: string;
  scoreboard: RunningScoreboardPlayer[];
  chatFeed: LiveChatItem[];
  currentWordIndex: number;
  totalWords: number;
  targetWord: string;
  currentWordSolvers: string[]; // uniqueIds of players who solved the current word
  onOpenConnectModal: () => void;
  onResetScoreboard: () => void;
  onSimulateChat: (data: {
    uniqueId: string;
    nickname: string;
    comment: string;
    profilePictureUrl: string;
  }) => void;
  onSimulateWave: () => void;
}

export const SAMPLE_PERSONAS = [
  {
    uniqueId: 'wordmaster_uk',
    nickname: 'WordMaster_UK',
    profilePictureUrl: 'https://i.pravatar.cc/150?u=wordmaster_uk',
  },
  {
    uniqueId: 'sarah_stacks',
    nickname: 'SarahStacks',
    profilePictureUrl: 'https://i.pravatar.cc/150?u=sarah_stacks',
  },
  {
    uniqueId: 'leo_lightning',
    nickname: 'LeoLightning',
    profilePictureUrl: 'https://i.pravatar.cc/150?u=leo_lightning',
  },
  {
    uniqueId: 'pixel_queen',
    nickname: 'PixelQueen',
    profilePictureUrl: 'https://i.pravatar.cc/150?u=pixel_queen',
  },
  {
    uniqueId: 'jax_turbo',
    nickname: 'JaxTurbo',
    profilePictureUrl: 'https://i.pravatar.cc/150?u=jax_turbo',
  },
  {
    uniqueId: 'chloe_solves',
    nickname: 'ChloeSolves',
    profilePictureUrl: 'https://i.pravatar.cc/150?u=chloe_solves',
  },
  {
    uniqueId: 'nova_knight',
    nickname: 'NovaKnight',
    profilePictureUrl: 'https://i.pravatar.cc/150?u=nova_knight',
  },
];

const NICKNAME_COLORS = [
  'text-amber-300',
  'text-emerald-300',
  'text-sky-300',
  'text-pink-300',
  'text-purple-300',
  'text-orange-300',
];

function getNicknameColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return NICKNAME_COLORS[Math.abs(hash) % NICKNAME_COLORS.length];
}

export const TikTokLivePanel: React.FC<TikTokLivePanelProps> = ({
  tiktokUsername,
  isConnected,
  roomId,
  scoreboard,
  chatFeed,
  currentWordIndex,
  totalWords,
  targetWord,
  currentWordSolvers,
  onOpenConnectModal,
  onResetScoreboard,
  onSimulateChat,
  onSimulateWave,
}) => {
  const [activeTab, setActiveTab] = useState<'both' | 'scoreboard' | 'chat'>('both');
  const [selectedPersonaIdx, setSelectedPersonaIdx] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const activePersona = SAMPLE_PERSONAS[selectedPersonaIdx % SAMPLE_PERSONAS.length];
  const isTestRoom = roomId === 'TEST_SIMULATION_ROOM';

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatFeed]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    onSimulateChat({
      uniqueId: activePersona.uniqueId,
      nickname: activePersona.nickname,
      comment: trimmed,
      profilePictureUrl: activePersona.profilePictureUrl,
    });
    setChatInput('');
    setSelectedPersonaIdx((prev) => (prev + 1) % SAMPLE_PERSONAS.length);
  };

  return (
    <div className="w-full flex flex-col rounded-2xl bg-[#2c0938]/95 dark:bg-[#16041c]/95 border border-purple-400/25 shadow-[0_12px_36px_rgba(0,0,0,0.45)] overflow-hidden text-white">
      {/* Top Status & Connection Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-[#390c47] dark:bg-[#1e0526] border-b border-purple-400/20">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenConnectModal}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
              isConnected
                ? isTestRoom
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border-rose-400/40'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected
                  ? isTestRoom
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-emerald-400 animate-ping'
                  : 'bg-rose-400'
              }`}
            />
            <Radio className="w-3.5 h-3.5" />
            <span>
              {isConnected
                ? isTestRoom
                  ? `Test Stream (@${tiktokUsername || 'test_streamer'})`
                  : `LIVE: @${tiktokUsername}`
                : 'Connect TikTok LIVE'}
            </span>
            <Settings className="w-3.5 h-3.5 opacity-75" />
          </button>

          <span className="text-[11px] font-mono text-purple-200/80 hidden sm:inline">
            Word {Math.min(currentWordIndex + 1, totalWords)}/{totalWords} ·{' '}
            <strong className="text-amber-300">{currentWordSolvers.length}</strong> solved current word
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSimulateWave}
            title="Simulate 5 viewers answering at different speeds to test the running & round scoreboards"
            className="px-2.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/40 text-amber-200 font-extrabold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>Simulate Chat Rush</span>
          </button>

          {scoreboard.length > 0 && (
            <button
              type="button"
              onClick={onResetScoreboard}
              title="Reset Running Scoreboard"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-purple-200 hover:text-amber-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile View Switcher */}
      <div className="flex sm:hidden border-b border-purple-400/15 bg-black/20 p-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('both')}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-extrabold ${
            activeTab === 'both' ? 'bg-amber-400 text-[#2d0938]' : 'text-purple-200'
          }`}
        >
          Split View
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('scoreboard')}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-extrabold ${
            activeTab === 'scoreboard' ? 'bg-amber-400 text-[#2d0938]' : 'text-purple-200'
          }`}
        >
          Scoreboard ({scoreboard.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-extrabold ${
            activeTab === 'chat' ? 'bg-amber-400 text-[#2d0938]' : 'text-purple-200'
          }`}
        >
          Live Chat ({chatFeed.length})
        </button>
      </div>

      {/* Main Content Grid: Running Scoreboard + Live TikTok Chat */}
      <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-purple-400/20">
        {/* LEFT / TOP: RUNNING SCOREBOARD (Speed-Based Ranking) */}
        <div
          className={`flex flex-col h-[340px] sm:h-[420px] ${
            activeTab === 'chat' ? 'hidden sm:flex' : 'flex'
          }`}
        >
          <div className="px-3.5 py-2.5 bg-black/25 border-b border-purple-400/15 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300 uppercase tracking-wider">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Running Scoreboard</span>
            </div>
            <span className="text-[11px] font-mono text-purple-200/75 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-amber-300" />
              {scoreboard.length} {scoreboard.length === 1 ? 'Player' : 'Players'} Scored
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {scoreboard.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-purple-200/60">
                <Trophy className="w-8 h-8 text-amber-400/40 mb-2" />
                <p className="text-xs font-bold text-purple-100 mb-1">
                  Waiting for Correct Chat Answers...
                </p>
                <p className="text-[11px] max-w-[240px] leading-relaxed">
                  Everyone who types the correct 5-letter word in chat before the timer runs out earns speed-based points!
                </p>
              </div>
            ) : (
              scoreboard.map((player, index) => {
                const rank = index + 1;
                const solvedCurrent = currentWordSolvers.includes(player.id);

                // Visual emphasis on 1st, then 2nd, then 3rd
                const rankCardStyle =
                  rank === 1
                    ? 'bg-gradient-to-r from-amber-500/25 via-amber-400/15 to-purple-900/40 border-2 border-amber-400 shadow-[0_0_16px_rgba(250,204,21,0.22)] py-2.5 px-3'
                    : rank === 2
                    ? 'bg-gradient-to-r from-slate-300/20 to-purple-900/30 border border-slate-300/60 py-2 px-3'
                    : rank === 3
                    ? 'bg-gradient-to-r from-amber-700/25 to-purple-900/30 border border-amber-600/60 py-2 px-3'
                    : 'bg-black/25 border border-white/10 py-1.5 px-2.5';

                return (
                  <div
                    key={player.id}
                    className={`rounded-xl flex items-center justify-between gap-2.5 transition-all ${rankCardStyle}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Rank Badge */}
                      <div
                        className={`shrink-0 flex items-center justify-center rounded-lg font-black font-mono ${
                          rank === 1
                            ? 'w-8 h-8 bg-gradient-to-b from-amber-300 to-amber-500 text-[#2d0938] text-sm shadow-md'
                            : rank === 2
                            ? 'w-7 h-7 bg-gradient-to-b from-slate-200 to-slate-400 text-slate-900 text-xs'
                            : rank === 3
                            ? 'w-6.5 h-6.5 bg-gradient-to-b from-amber-600 to-amber-800 text-amber-100 text-xs'
                            : 'w-6 h-6 bg-white/10 text-purple-200 text-[11px]'
                        }`}
                      >
                        {rank === 1 ? (
                          <Crown className="w-4 h-4 fill-current" />
                        ) : rank === 2 ? (
                          <Medal className="w-3.5 h-3.5" />
                        ) : rank === 3 ? (
                          <Award className="w-3.5 h-3.5" />
                        ) : (
                          `#${rank}`
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <img
                          src={getSafeAvatarUrl(player.profilePictureUrl, player.nickname)}
                          alt={player.nickname}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleAvatarError(e, player.nickname)}
                          className={`rounded-full object-cover ${
                            rank === 1
                              ? 'w-10 h-10 border-2 border-amber-300'
                              : rank === 2
                              ? 'w-8 h-8 border border-slate-300'
                              : rank === 3
                              ? 'w-8 h-8 border border-amber-600'
                              : 'w-7 h-7 border border-white/20'
                          }`}
                        />
                        {solvedCurrent && (
                          <span
                            title="Solved current word!"
                            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border border-[#16041c] flex items-center justify-center"
                          >
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          </span>
                        )}
                      </div>

                      {/* Name & Stats */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-extrabold truncate ${
                              rank === 1
                                ? 'text-amber-200 text-sm'
                                : rank === 2
                                ? 'text-white text-xs sm:text-sm'
                                : 'text-purple-100 text-xs'
                            }`}
                          >
                            {player.nickname}
                          </span>
                          {solvedCurrent && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-mono text-[9px] font-bold uppercase shrink-0">
                              Locked In
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-purple-200/75">
                          <span>
                            {player.wordsSolved} {player.wordsSolved === 1 ? 'word' : 'words'}
                          </span>
                          <span>·</span>
                          <span className="text-amber-300/90">
                            ⚡ {player.lastSolveTimeSeconds.toFixed(1)}s (best {player.bestSpeedSeconds.toFixed(1)}s)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Score Column */}
                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono font-black tabular-nums ${
                          rank === 1
                            ? 'text-base sm:text-lg text-amber-300'
                            : rank === 2
                            ? 'text-sm sm:text-base text-slate-200'
                            : rank === 3
                            ? 'text-sm text-amber-400'
                            : 'text-xs sm:text-sm text-white'
                        }`}
                      >
                        {player.totalScore.toLocaleString()} <span className="text-[10px] font-normal opacity-75">pts</span>
                      </div>
                      <div className="text-[10px] font-mono text-emerald-400 font-bold">
                        +{player.lastPoints} last
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT / BOTTOM: LIVE STREAM CHAT & ANSWER SIMULATOR */}
        <div
          className={`flex flex-col h-[340px] sm:h-[420px] ${
            activeTab === 'scoreboard' ? 'hidden sm:flex' : 'flex'
          }`}
        >
          <div className="px-3.5 py-2.5 bg-black/25 border-b border-purple-400/15 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-white uppercase tracking-wider">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span>TikTok Live Chat</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {chatFeed.length} comments
            </span>
          </div>

          {/* Chat Messages List */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {chatFeed.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-purple-200/60">
                <MessageSquare className="w-8 h-8 text-purple-300/30 mb-2" />
                <p className="text-xs font-bold text-purple-100 mb-1">
                  Live Chat Stream Ready
                </p>
                <p className="text-[11px] max-w-[230px] leading-relaxed">
                  Type a guess below or click <strong>Simulate Chat Rush</strong> to watch multiple players score based on speed!
                </p>
              </div>
            ) : (
              chatFeed.map((item) => {
                const colorClass = getNicknameColor(item.nickname);
                // Mask the exact correct answer letters in the live chat log while the round is still active so other players have to solve it themselves
                const displayedComment = item.isCorrectAnswer
                  ? '★★★★★ (Correct Word Locked In!)'
                  : item.comment;

                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-2 py-1.5 px-2.5 rounded-xl text-xs transition-colors ${
                      item.isCorrectAnswer
                        ? 'bg-emerald-500/15 border border-emerald-400/35'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <img
                      src={getSafeAvatarUrl(item.profilePictureUrl, item.nickname)}
                      alt={item.nickname}
                      referrerPolicy="no-referrer"
                      onError={(e) => handleAvatarError(e, item.nickname)}
                      className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5 border border-white/20"
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`font-bold ${colorClass} mr-1.5`}>
                        {item.nickname}:
                      </span>
                      <span
                        className={`break-words ${
                          item.isCorrectAnswer ? 'text-emerald-200 font-bold' : 'text-purple-100'
                        }`}
                      >
                        {displayedComment}
                      </span>

                      {item.isCorrectAnswer && (
                        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-300/50 text-amber-300 font-mono text-[10px] font-extrabold">
                          <Sparkles className="w-2.5 h-2.5" />
                          +#{item.rankInWord} ({item.solveTimeSeconds?.toFixed(1)}s) +{item.pointsEarned} pts
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Input / Simulator Bar */}
          <div className="p-2.5 bg-black/35 border-t border-purple-400/20 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-purple-200/75 px-0.5">
              <span>
                Simulating as:{' '}
                <strong className="text-amber-300">{activePersona.nickname}</strong> (tap avatar to switch)
              </span>
              <button
                type="button"
                onClick={() => setChatInput(targetWord)}
                className="text-amber-300 hover:underline font-mono cursor-pointer"
              >
                Fill Answer ({targetWord})
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedPersonaIdx((prev) => (prev + 1) % SAMPLE_PERSONAS.length)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs shrink-0 cursor-pointer"
                title="Click to switch test viewer persona"
              >
                <img
                  src={getSafeAvatarUrl(activePersona.profilePictureUrl, activePersona.nickname)}
                  alt={activePersona.nickname}
                  referrerPolicy="no-referrer"
                  onError={(e) => handleAvatarError(e, activePersona.nickname)}
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span className="font-bold text-[11px] max-w-[72px] truncate">
                  {activePersona.nickname}
                </span>
              </button>

              <form onSubmit={handleSendChat} className="flex-1 flex items-center gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type 5-letter answer in chat..."
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-black/45 border border-white/15 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#2d0938] font-extrabold text-xs flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
