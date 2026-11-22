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
  Users,
  Webhook,
  X,
} from 'lucide-react';
import type { TikTokStatus } from '../shared/types.ts';

interface TikTokConnectModalProps {
  isOpen: boolean;
  status: TikTokStatus;
  defaultHandle?: string;
  onConnect: (username: string, isTestMode: boolean) => Promise<{ ok: boolean; error?: string }>;
  onDisconnect: () => void;
  onSendTestChat: (nickname: string, text: string) => void;
  onClose: () => void;
}

export const TikTokConnectModal: React.FC<TikTokConnectModalProps> = ({
  isOpen,
  status,
  defaultHandle,
  onConnect,
  onDisconnect,
  onSendTestChat,
  onClose,
}) => {
  const [mode, setMode] = useState<'live' | 'test'>(status.mode === 'test' ? 'test' : 'live');
  const [username, setUsername] = useState(status.username || defaultHandle || '');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test chat injector fields
  const [testViewerName, setTestViewerName] = useState('tiktok_fan');
  const [testGuessText, setTestGuessText] = useState('');
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);

  const siteOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://missingpiecepuzzles.fun';
  const tikfinityUrl = `${siteOrigin}/api/tikfinity/event`;
  const bettertokUrl = `${siteOrigin}/api/bettertok/event`;

  const handleCopyWebhook = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedWebhook(label);
      setTimeout(() => setCopiedWebhook(null), 1800);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (status.username) setUsername(status.username);
    else if (defaultHandle && !username) setUsername(defaultHandle);
  }, [status.username, defaultHandle]);

  useEffect(() => {
    if (status.lastError) setError(status.lastError);
  }, [status.lastError]);

  if (!isOpen) return null;

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
    onSendTestChat(testViewerName.trim() || 'tiktok_fan', testGuessText.trim());
    setTestGuessText('');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="TikTok LIVE Connectivity"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-slate-900">
                TikTok LIVE Connectivity
              </h2>
              <p className="text-xs text-slate-500">
                Read live TikTok chat guesses &amp; track viewers on a separate scoreboard
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close TikTok settings"
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 max-h-[82vh] overflow-y-auto thin-scrollbar">
          {/* Active Connection Banner */}
          {status.connected && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-emerald-950 truncate">
                      {status.mode === 'test'
                        ? `Test Simulator Active (@${status.username})`
                        : `Connected to @${status.username} LIVE`}
                    </p>
                    <p className="text-xs text-emerald-800 font-mono-tabular">
                      {status.viewerCount} viewers · {status.chatEventsProcessed} messages ·{' '}
                      {status.guessesMatched} correct guesses
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {status.mode === 'live' && status.username && (
                    <button
                      type="button"
                      onClick={() => void onConnect(status.username!, false)}
                      title="Reconnect"
                      className="p-2 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onDisconnect}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50 cursor-pointer whitespace-nowrap"
                  >
                    <Unplug className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mode Selector: LIVE vs Test Simulator (matching MP-WebApp) */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('live');
                setError(null);
              }}
              className={`inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'live'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
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
              className={`inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'test'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Test Simulator
            </button>
          </div>

          {/* Connection Form */}
          <form onSubmit={handleConnectSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-700" htmlFor="tiktok-handle-input">
                {mode === 'live' ? 'TikTok Creator @username (must be LIVE)' : 'Simulated Channel @username'}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">
                    @
                  </span>
                  <input
                    id="tiktok-handle-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={mode === 'live' ? 'your_tiktok_handle' : 'test_streamer'}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={connecting}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
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
              <div className="px-3.5 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <p className="text-xs text-slate-500">
              {mode === 'live'
                ? 'Uses tiktok-live-connector directly to stream live viewer comments, likes, and gifts into the game room — plus receives TikFinity & BetterTok webhook events automatically.'
                : 'Test Simulator lets you send simulated TikTok viewer guesses right away without needing an active broadcast.'}
            </p>
          </form>

          {/* TikFinity / BetterTok Webhook Relay Info */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <Webhook className="w-3.5 h-3.5 text-blue-600" />
              <span>TikFinity / BetterTok Webhook Relay (Optional Backup)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Point TikFinity or BetterTok chat webhooks at either URL below — guesses route straight
              into your active InkStream room automatically.
            </p>
            <div className="flex flex-col gap-1.5">
              {[
                { label: 'TikFinity', url: tikfinityUrl },
                { label: 'BetterTok', url: bettertokUrl },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px]"
                >
                  <span className="font-mono-tabular truncate text-slate-700">
                    <strong className="text-slate-900 mr-1.5">{item.label}:</strong>
                    {item.url}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyWebhook(item.url, item.label)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 shrink-0 cursor-pointer"
                  >
                    {copiedWebhook === item.label ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
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

          {/* Interactive Test Chat Injector (active whenever connected) */}
          {status.connected && (
            <div className="pt-4 border-t border-slate-200 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  Send Test TikTok Viewer Comment
                </h3>
                <span className="text-[11px] text-slate-500">Tests scoring &amp; TikTok leaderboard</span>
              </div>

              <form onSubmit={handleTestChatSubmit} className="grid grid-cols-12 gap-2">
                <input
                  type="text"
                  value={testViewerName}
                  onChange={(e) => setTestViewerName(e.target.value)}
                  placeholder="Viewer handle"
                  maxLength={24}
                  className="col-span-4 px-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
                <input
                  type="text"
                  value={testGuessText}
                  onChange={(e) => setTestGuessText(e.target.value)}
                  placeholder="Type a TikTok chat guess..."
                  maxLength={120}
                  className="col-span-6 px-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
                <button
                  type="submit"
                  disabled={!testGuessText.trim()}
                  className="col-span-2 inline-flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-45 cursor-pointer"
                  aria-label="Send simulated TikTok guess"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
