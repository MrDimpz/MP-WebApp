import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  AtSign,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  LogOut,
  HelpCircle,
  FlaskConical,
  RefreshCw,
  Wand2,
  Timer,
} from 'lucide-react';
import { TimerDuration } from '../types';

interface TikTokConnectModalProps {
  isOpen: boolean;
  isConnected: boolean;
  currentUsername: string;
  roomId?: string;
  tiktokError: string | null;
  timerDuration: TimerDuration;
  onChangeTimerDuration: (duration: TimerDuration) => void;
  onClose: () => void;
  onConnect: (username: string, isTestMode?: boolean) => void;
  onReconnect?: (username: string, isTestMode?: boolean) => void;
  onDisconnect: () => void;
  onOpenSimulator?: () => void;
}

export const TikTokConnectModal: React.FC<TikTokConnectModalProps> = ({
  isOpen,
  isConnected,
  currentUsername,
  roomId,
  tiktokError,
  timerDuration,
  onChangeTimerDuration,
  onClose,
  onConnect,
  onReconnect,
  onDisconnect,
  onOpenSimulator,
}) => {
  const [usernameInput, setUsernameInput] = useState(currentUsername || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'live' | 'test'>('live');

  useEffect(() => {
    if (currentUsername) {
      setUsernameInput(currentUsername);
    }
  }, [currentUsername]);

  useEffect(() => {
    if (isConnected || tiktokError) {
      setIsSubmitting(false);
    }
  }, [isConnected, tiktokError]);

  if (!isOpen) return null;

  const isTestRoom = roomId === 'TEST_SIMULATION_ROOM';

  const handleLiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = usernameInput.trim().replace(/^@+/, '');
    if (!clean) return;
    setIsSubmitting(true);
    onConnect(clean, false);
    setTimeout(() => setIsSubmitting(false), 3000);
  };

  const handleTestModeStart = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = usernameInput.trim().replace(/^@+/, '') || 'test_streamer';
    setIsSubmitting(true);
    onConnect(clean, true);
    setTimeout(() => setIsSubmitting(false), 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#210738] border border-amber-400/35 shadow-[0_24px_80px_rgba(0,0,0,0.85)] p-5 sm:p-6 text-[#F5F3F7] space-y-4 animate-tile-pop max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/25 to-amber-400/20 border border-rose-400/40 flex items-center justify-center text-rose-400 shadow-inner">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white tracking-tight">
                TikTok LIVE Integration
              </h3>
              <p className="text-[11px] font-mono text-purple-200/75">
                Interactive Chat Guesses · Speed Scoring · Auto-Reveal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-purple-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Word Reveal Timer Setting (30s / 45s / 60s) */}
        <div className="p-3.5 rounded-xl bg-black/35 border border-amber-400/25 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
              <Timer className="w-3.5 h-3.5 text-amber-400" />
              Word Auto-Reveal Timer
            </span>
            <span className="text-[11px] font-mono text-purple-200/80">
              Reveals next word after set time
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([30, 45, 60] as TimerDuration[]).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onChangeTimerDuration(sec)}
                className={`py-2 rounded-xl font-mono font-extrabold text-xs transition-all cursor-pointer border ${
                  timerDuration === sec
                    ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#2d0938] border-amber-200 shadow-[0_3px_0_#92400e]'
                    : 'bg-white/5 hover:bg-white/10 text-purple-100 border-white/10'
                }`}
              >
                {sec} Seconds
              </button>
            ))}
          </div>
        </div>

        {/* Mode Toggle: Live Stream vs Test Mode */}
        {!isConnected && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10">
            <button
              type="button"
              onClick={() => setConnectionMode('live')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                connectionMode === 'live'
                  ? 'bg-amber-400 text-[#1E0836] shadow-sm'
                  : 'text-purple-200/80 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live TikTok Stream</span>
            </button>
            <button
              type="button"
              onClick={() => setConnectionMode('test')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                connectionMode === 'test'
                  ? 'bg-amber-400 text-[#1E0836] shadow-sm'
                  : 'text-purple-200/80 hover:text-white'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Test Mode (Offline)</span>
            </button>
          </div>
        )}

        {/* Status or Input Form */}
        {isConnected ? (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                isTestRoom
                  ? 'bg-amber-950/60 border-amber-400/40'
                  : 'bg-emerald-950/60 border-emerald-400/40'
              }`}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2
                  className={`w-6 h-6 shrink-0 ${
                    isTestRoom ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                />
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-purple-200">
                    {isTestRoom ? 'Test Mode Active (Simulated)' : 'Connected to Live Room'}
                  </div>
                  <div className="font-extrabold text-base text-white">
                    @{currentUsername}
                  </div>
                  {roomId && (
                    <div className="text-[10px] font-mono text-amber-300/80">
                      Room ID: {roomId}
                    </div>
                  )}
                </div>
              </div>
              <span
                className={`w-2.5 h-2.5 rounded-full animate-ping ${
                  isTestRoom ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
            </div>

            <p className="text-xs text-purple-200/90 leading-relaxed">
              {isTestRoom
                ? 'Test Mode is running! Use the Live Chat Simulator to send viewer answers and test the speed scoreboard and Top 5 round podium.'
                : 'Viewer comments from your TikTok LIVE stream are being processed in real time. Correct 5-letter answers earn speed points automatically!'}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {onReconnect && (
                <button
                  type="button"
                  onClick={() => onReconnect(currentUsername, isTestRoom)}
                  className="py-2.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reconnect</span>
                </button>
              )}
              <button
                type="button"
                onClick={onDisconnect}
                className={`py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  onReconnect ? '' : 'col-span-2'
                }`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        ) : connectionMode === 'test' ? (
          /* Test Mode Form */
          <form onSubmit={handleTestModeStart} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-400/30 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <FlaskConical className="w-4 h-4" />
                <span>Test Without Going Live on TikTok</span>
              </div>
              <p className="text-[11px] text-purple-200/85 leading-relaxed">
                Activates the connected state and opens the interactive chat simulator so you can test 30/45/60s auto-reveal timers, speed scoring, and the Top 5 Round Scoreboard immediately.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-300 mb-1.5">
                Simulated Channel Name (Optional)
              </label>
              <div className="relative">
                <AtSign className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value.replace(/^@+/, ''))}
                  placeholder="test_streamer"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/45 border border-white/15 text-xs font-mono text-white placeholder-purple-300/40 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-[#1D0830] font-extrabold text-sm tracking-wide shadow-[0_5px_0_#92400e] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Wand2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Starting Test Mode...' : 'Start Test Connection (Fake Stream)'}</span>
            </button>
          </form>
        ) : (
          /* Live TikTok Stream Form */
          <form onSubmit={handleLiveSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-amber-300 mb-1.5">
                Host TikTok Username (@)
              </label>
              <div className="relative">
                <AtSign className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value.replace(/^@+/, ''))}
                  placeholder="tiktok_username"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/45 border border-white/15 text-xs font-mono text-white placeholder-purple-300/40 focus:outline-none focus:border-amber-400"
                />
              </div>
              <p className="text-[11px] text-purple-200/80 mt-1.5">
                No passwords or login required. Enter the username of the account that is currently streaming on TikTok LIVE.
              </p>
            </div>

            {tiktokError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-400/40 text-xs text-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{tiktokError}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSubmitting || !usernameInput.trim()}
                className="flex-1 py-3 rounded-xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-[#1D0830] font-extrabold text-sm tracking-wide shadow-[0_5px_0_#92400e] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Radio className="w-4 h-4 text-rose-600" />
                <span>{isSubmitting ? 'Connecting to TikTok...' : 'Connect to Live Stream'}</span>
              </button>

              {onReconnect && (
                <button
                  type="button"
                  onClick={() => {
                    const clean = usernameInput.trim().replace(/^@+/, '');
                    if (clean) onReconnect(clean, false);
                  }}
                  className="px-3.5 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-amber-400/50 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-all"
                  title="Force refresh of Socket.IO connection"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reconnect</span>
                </button>
              )}
            </div>
          </form>
        )}

        {/* Quick Offline Test Simulator Callout */}
        <div className="p-3 rounded-xl bg-[#150324]/90 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Not Live Right Now?</span>
            </span>
            {onOpenSimulator && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSimulator();
                }}
                className="text-[11px] text-amber-300 underline hover:text-amber-200 cursor-pointer font-bold"
              >
                Focus Chat Simulator
              </button>
            )}
          </div>
          <p className="text-[11px] text-purple-200/80 leading-relaxed">
            Use <strong>Test Mode</strong> above or the <strong>Live Chat Simulator</strong> panel next to the board to simulate multiple viewers answering at different speeds.
          </p>
        </div>

        {/* Helper Note */}
        <div className="flex items-center gap-2 text-[11px] text-purple-300/70 font-mono">
          <HelpCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>Viewers type 5-letter words in chat before the timer reveals the word!</span>
        </div>
      </div>
    </div>
  );
};
