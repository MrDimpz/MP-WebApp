import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  FlaskConical,
  Radio,
  RefreshCw,
  Send,
  Unplug,
  Webhook,
  X,
} from 'lucide-react';
import type { MpwhTikTokStatus } from '../shared/types';

interface TikTokLiveModalProps {
  isOpen: boolean;
  status: MpwhTikTokStatus;
  defaultHandle?: string;
  onConnect: (
    username: string,
    isTestMode: boolean
  ) => Promise<{ ok: boolean; error?: string }>;
  onDisconnect: () => void;
  onSendTestChat: (nickname: string, text: string) => void;
  onClose: () => void;
}

export const TikTokLiveModal: React.FC<TikTokLiveModalProps> = ({
  isOpen,
  status,
  defaultHandle,
  onConnect,
  onDisconnect,
  onSendTestChat,
  onClose,
}) => {
  const [mode, setMode] = useState<'live' | 'test'>(
    status.mode === 'test' ? 'test' : 'live'
  );
  const [username, setUsername] = useState(status.username || defaultHandle || '');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testViewerName, setTestViewerName] = useState('tiktok_solver');
  const [testGuessText, setTestGuessText] = useState('');
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);

  const siteOrigin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://missingpiecepuzzles.fun';
  const tikfinityUrl = `${siteOrigin}/api/tikfinity/event`;
  const bettertokUrl = `${siteOrigin}/api/bettertok/event`;

  useEffect(() => {
    if (status.username) setUsername(status.username);
    else if (defaultHandle && !username) setUsername(defaultHandle);
  }, [status.username, defaultHandle]);

  useEffect(() => {
    if (status.lastError) setError(status.lastError);
  }, [status.lastError]);

  if (!isOpen) return null;

  const handleCopyWebhook = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedWebhook(label);
      setTimeout(() => setCopiedWebhook(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim().replace(/^@+/, '');
    if (!clean && mode === 'live') {
      setError('Enter your TikTok @username.');
      return;
    }
    setError(null);
    setConnecting(true);
    try {
      const res = await onConnect(clean || 'test_streamer', mode === 'test');
      if (!res.ok && res.error) {
        setError(res.error);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleTestChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testGuessText.trim()) return;
    onSendTestChat(testViewerName.trim() || 'tiktok_solver', testGuessText.trim());
    setTestGuessText('');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="TikTok LIVE Connectivity"
      onClick={onClose}
    >
      <div
        className="bg-[#210736] border border-[#F6C915]/45 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F6C915] text-[#1D0830] flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-lg text-white">
                TikTok LIVE Connectivity
              </h2>
              <p className="text-xs text-[#D4C0EC]">
                Read live TikTok chat guesses directly onto the Word Hunt Extreme ladder
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close TikTok settings"
            className="w-8 h-8 rounded-lg border border-white/15 flex items-center justify-center text-[#D4C0EC] hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 max-h-[82vh] overflow-y-auto">
          {/* Active Connection Banner */}
          {status.connected && (
            <div className="p-4 rounded-xl bg-emerald-950/55 border border-emerald-400/45 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-white truncate">
                    {status.mode === 'test'
                      ? `Test Simulator Active (@${status.username})`
                      : `Connected to @${status.username} LIVE`}
                  </p>
                  <p className="text-xs text-emerald-200 font-mono tabular-nums">
                    {status.chatEventsProcessed} messages · {status.guessesAccepted} word guesses
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {status.mode === 'live' && status.username && (
                  <button
                    type="button"
                    onClick={() => void onConnect(status.username!, false)}
                    title="Reconnect"
                    className="p-2 rounded-lg bg-white/10 border border-emerald-400/40 text-emerald-200 hover:bg-white/20 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-400/40 text-rose-200 text-xs font-bold hover:bg-rose-900/60 cursor-pointer whitespace-nowrap"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#140321] border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('live');
                setError(null);
              }}
              className={`inline-flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                mode === 'live'
                  ? 'bg-[#F6C915] text-[#1D0830]'
                  : 'text-[#D4C0EC] hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              TikTok LIVE Stream
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('test');
                setError(null);
              }}
              className={`inline-flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                mode === 'test'
                  ? 'bg-[#F6C915] text-[#1D0830]'
                  : 'text-[#D4C0EC] hover:text-white'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Test Simulator
            </button>
          </div>

          {/* Connection Form */}
          <form onSubmit={handleConnectSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-bold text-[#E5D7F7]"
                htmlFor="mpwh-tiktok-handle-input"
              >
                {mode === 'live'
                  ? 'TikTok Creator @username (must be LIVE)'
                  : 'Simulated Channel @username'}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B8A0D6] font-bold text-sm">
                    @
                  </span>
                  <input
                    id="mpwh-tiktok-handle-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={mode === 'live' ? 'your_tiktok_handle' : 'test_streamer'}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-[#D4A437]/40 bg-[#140321] text-sm text-white placeholder:text-[#8E73B2] focus:outline-none focus:border-[#F6C915]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={connecting}
                  className="px-4 py-2.5 rounded-xl bg-[#F6C915] text-[#1D0830] text-sm font-extrabold hover:bg-[#FFE047] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {connecting
                    ? 'Connecting...'
                    : mode === 'live'
                    ? 'Connect LIVE'
                    : 'Start Simulator'}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3.5 py-2.5 rounded-xl bg-rose-950/60 border border-rose-400/40 text-xs font-semibold text-rose-200">
                {error}
              </div>
            )}
          </form>

          {/* Test Chat Injector */}
          <div className="rounded-xl border border-white/12 bg-[#140321] p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#F6C915]">
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Simulate TikTok Chat Guess</span>
            </div>
            <form onSubmit={handleTestChatSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={testViewerName}
                onChange={(e) => setTestViewerName(e.target.value)}
                placeholder="@viewer"
                className="sm:w-36 px-3 py-2 rounded-lg border border-white/15 bg-[#210736] text-xs text-white placeholder:text-[#967BB8] focus:outline-none focus:border-[#F6C915]"
              />
              <input
                type="text"
                value={testGuessText}
                onChange={(e) => setTestGuessText(e.target.value)}
                placeholder="Type a 4–8 letter word..."
                className="flex-1 px-3 py-2 rounded-lg border border-white/15 bg-[#210736] text-xs text-white placeholder:text-[#967BB8] focus:outline-none focus:border-[#F6C915]"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F6C915]/20 border border-[#F6C915]/50 text-[#F6C915] hover:bg-[#F6C915] hover:text-[#1D0830] text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </form>
          </div>

          {/* TikFinity & BetterTok Webhook URLs */}
          <div className="rounded-xl border border-[#D4A437]/30 bg-[#140321] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#F6C915]">
              <Webhook className="w-3.5 h-3.5" />
              <span>TikFinity &amp; BetterTok Webhooks</span>
            </div>
            <p className="text-xs text-[#D4C0EC] leading-relaxed">
              Prefer desktop chat relays? Point TikFinity or BetterTok chat
              webhooks here to feed viewer words directly into your live Word
              Hunt ladder:
            </p>
            <div className="space-y-2">
              {[
                { label: 'TikFinity', url: tikfinityUrl },
                { label: 'BetterTok', url: bettertokUrl },
              ].map((hook) => (
                <div
                  key={hook.label}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#210736] px-3 py-2"
                >
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#F6C915] block">
                      {hook.label} Webhook URL
                    </span>
                    <code className="text-[11px] font-mono text-[#E9DCF8] truncate block">
                      {hook.url}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyWebhook(hook.url, hook.label)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#D4A437]/40 bg-[#140321] text-[11px] font-bold text-[#F6C915] hover:bg-[#F6C915] hover:text-[#1D0830] transition-colors cursor-pointer shrink-0"
                  >
                    {copiedWebhook === hook.label ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
