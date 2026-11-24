import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Radio,
  RefreshCw,
  Scale,
  Send,
  Sparkles,
  Users,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DICTIONARY_COUNT } from '../data/dictionary';
import { gameEngine } from '../engine/gameEngine';
import type { HudSnapshot, SimIntensity, WsConnectionStatus } from '../types';

interface HostDrawerProps {
  open: boolean;
  onClose: () => void;
  hud: HudSnapshot;
  // Built-in Site TikTok LIVE Resilient Bridge
  liveHandle: string;
  isLiveConnected: boolean;
  isLiveConnecting: boolean;
  liveError: string | null;
  onLiveHandleChange: (val: string) => void;
  onConnectLive: () => void;
  onDisconnectLive: () => void;
  onForceReconnectLive: () => void;
  // External TikFinity / WebSocket Bridge
  wsUrl: string;
  wsStatus: WsConnectionStatus;
  wsError: string | null;
  wsMessageCount: number;
  onWsUrlChange: (url: string) => void;
  onConnectWs: () => void;
  onDisconnectWs: () => void;
  // Simulator
  onToggleSim: (enabled: boolean) => void;
  onChangeIntensity: (intensity: SimIntensity) => void;
}

export function HostDrawer({
  open,
  onClose,
  hud,
  liveHandle,
  isLiveConnected,
  isLiveConnecting,
  liveError,
  onLiveHandleChange,
  onConnectLive,
  onDisconnectLive,
  onForceReconnectLive,
  wsUrl,
  wsStatus,
  wsError,
  wsMessageCount,
  onWsUrlChange,
  onConnectWs,
  onDisconnectWs,
  onToggleSim,
  onChangeIntensity,
}: HostDrawerProps) {
  const [testNickname, setTestNickname] = useState('Host Tester');
  const [testWord, setTestWord] = useState('');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [submitCue, setSubmitCue] = useState<{
    kind: 'VALID' | 'ERROR';
    message: string;
    key: number;
  } | null>(null);

  if (!open) return null;

  const preview = gameEngine.validateWordPreview(testWord);
  const isInvalidPreview =
    preview.status === 'TAKEN' ||
    preview.status === 'RULE_MISS' ||
    preview.status === 'MODIFIER_MISS' ||
    preview.status === 'NOT_IN_DICT';

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanedWord = testWord.trim();
    const cleanedNick = testNickname.trim() || 'Host Tester';
    if (!cleanedWord) return;
    const res = gameEngine.processChatMessage({
      username: cleanedNick.toLowerCase().replace(/\s+/g, '_'),
      nickname: cleanedNick,
      comment: cleanedWord,
    });
    if (res.outcome === 'VALID' || res.outcome === 'SWITCH') {
      setSubmitCue({ kind: 'VALID', message: res.reason, key: Date.now() });
      setTestWord('');
    } else if (
      res.outcome === 'TAKEN' ||
      res.outcome === 'INVALID' ||
      res.outcome === 'COOLDOWN'
    ) {
      setSubmitCue({ kind: 'ERROR', message: res.reason, key: Date.now() });
    }
  };

  const handleQuickFill = () => {
    setTestWord(gameEngine.getSampleValidWord());
    setSubmitCue(null);
  };

  const handleCopyBridgeSnippet = () => {
    const snippet = `window.onTikTokChatMessage({ username: "viewer_one", nickname: "Alex", comment: "${gameEngine.getSampleValidWord()}" })`;
    navigator.clipboard
      ?.writeText(snippet)
      .then(() => {
        setCopiedSnippet(true);
        setTimeout(() => setCopiedSnippet(false), 1800);
      })
      .catch(() => {});
  };

  const intensities: { id: SimIntensity; label: string }[] = [
    { id: 'CHILL', label: 'Chill' },
    { id: 'HYPE', label: 'Hype' },
    { id: 'CHAOS', label: 'Chaos' },
  ];

  return (
    <div
      className="absolute inset-0 z-40 bg-[#10021A]/80 backdrop-blur-sm flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Live TikTok Bridge and Simulator Controls"
    >
      <div className="w-full max-h-[88%] bg-[#1B052C] border-t-2 border-[#F6C915]/50 rounded-t-2xl flex flex-col overflow-hidden shadow-[0_-16px_48px_rgba(0,0,0,0.88)]">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F6C915]/20 bg-[#24073A] shrink-0">
          <div>
            <h3 className="tow-font-display text-xl font-black tracking-wide text-[#F6C915] leading-none">
              HOST STUDIO · LIVE &amp; SIMULATOR
            </h3>
            <p className="text-[11px] text-purple-200/75 mt-0.5 tabular-nums">
              {DICTIONARY_COUNT.toLocaleString()}+ English words · Red {hud.redPlayerCount} vs Blue{' '}
              {hud.bluePlayerCount} (auto-balanced)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Host Drawer"
            className="w-9 h-9 rounded-lg bg-[#2E0A48] hover:bg-[#3F1060] border border-[#F6C915]/25 flex items-center justify-center text-purple-100 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto tow-thin-scroll p-4 space-y-5">
          {/* 0. Direct Site TikTok LIVE Connection */}
          <div className="p-3 rounded-xl bg-[#24073A] border border-[#F6C915]/35 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#F6C915]">
                <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Direct TikTok LIVE Bridge</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                {isLiveConnected ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    <span className="text-emerald-400">CONNECTED</span>
                  </>
                ) : isLiveConnecting ? (
                  <span className="text-[#F6C915]">CONNECTING...</span>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-purple-300/60" aria-hidden="true" />
                    <span className="text-purple-300/60">OFFLINE</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-[11px] text-purple-200/80 leading-relaxed">
              Enter your TikTok <strong className="text-white">@handle</strong> while live — chat
              messages automatically draft viewers into balanced Red &amp; Blue teams and fire words
              straight onto the battlefield.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={liveHandle}
                onChange={(e) => onLiveHandleChange(e.target.value)}
                disabled={isLiveConnecting}
                placeholder="@yourtiktokhandle"
                aria-label="TikTok LIVE Handle"
                className="flex-1 h-9 px-3 rounded-lg bg-[#140321] border border-[#F6C915]/30 text-xs font-bold text-white placeholder:text-purple-300/50 focus:outline-none focus:border-[#F6C915]"
              />
              {isLiveConnected ? (
                <>
                  <button
                    type="button"
                    onClick={onForceReconnectLive}
                    title="Reconnect TikTok LIVE"
                    className="h-9 px-2.5 rounded-lg bg-[#2B0938] hover:bg-[#3A0E4D] border border-[#F6C915]/35 text-[#F6C915] font-bold text-xs inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onDisconnectLive}
                    className="h-9 px-3.5 rounded-lg bg-[#FF2A5F] hover:bg-[#ff4271] text-white font-bold text-xs cursor-pointer shrink-0"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onConnectLive}
                  disabled={isLiveConnecting}
                  className="h-9 px-4 rounded-lg bg-[#F6C915] hover:bg-[#FFE047] text-[#180424] font-extrabold text-xs cursor-pointer shrink-0 disabled:opacity-60"
                >
                  {isLiveConnecting ? 'Linking...' : 'Go LIVE'}
                </button>
              )}
            </div>
            {liveError && <p className="text-[11px] text-rose-300 font-semibold">{liveError}</p>}
          </div>

          {/* 1. Manual Test Input Bar with Real-Time Validation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold tracking-wider text-white">
                Manual Test Fire (Real-Time Validation)
              </span>
              <button
                type="button"
                onClick={handleQuickFill}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F6C915] hover:text-[#FFE047] cursor-pointer"
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                Fill Valid Word
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-2">
              <div className="grid grid-cols-[120px_1fr_auto] gap-1.5">
                <input
                  type="text"
                  value={testNickname}
                  onChange={(e) => setTestNickname(e.target.value)}
                  placeholder="Nickname"
                  aria-label="Test Viewer Nickname"
                  className="h-9 px-2.5 rounded-lg bg-[#140321] border border-[#F6C915]/25 text-xs font-semibold text-white placeholder:text-purple-300/45 focus:outline-none focus:border-[#F6C915]"
                />
                <input
                  type="text"
                  value={testWord}
                  onChange={(e) => {
                    setTestWord(e.target.value);
                    if (submitCue) setSubmitCue(null);
                  }}
                  placeholder={`Word (${hud.baseRule.label})`}
                  aria-label="Test Word Input"
                  className={`h-9 px-2.5 rounded-lg bg-[#140321] border text-xs font-bold uppercase text-white placeholder:text-purple-300/45 focus:outline-none ${
                    isInvalidPreview
                      ? 'border-[#FF2A5F]'
                      : preview.status === 'VALID'
                        ? 'border-emerald-400'
                        : 'border-[#F6C915]/25 focus:border-[#F6C915]'
                  }`}
                />
                <button
                  type="submit"
                  className="h-9 px-3 rounded-lg bg-[#F6C915] hover:bg-[#FFE047] text-[#180424] font-extrabold text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3 h-3" aria-hidden="true" />
                  Fire
                </button>
              </div>
              {(testWord.trim().length > 0 || submitCue) && (
                <div
                  className={`text-[11px] font-bold flex items-center gap-1.5 ${
                    submitCue
                      ? submitCue.kind === 'VALID'
                        ? 'text-emerald-400'
                        : 'text-rose-300'
                      : preview.status === 'VALID'
                        ? 'text-emerald-400'
                        : isInvalidPreview
                          ? 'text-rose-300'
                          : 'text-[#F6C915]'
                  }`}
                >
                  {preview.status === 'VALID' || submitCue?.kind === 'VALID' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{submitCue ? submitCue.message : preview.message}</span>
                </div>
              )}
            </form>
          </div>

          {/* 2. Battlefield Power-Ups & Team Balance */}
          <div className="pt-4 border-t border-[#F6C915]/15">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Zap className="w-3.5 h-3.5 text-[#F6C915]" aria-hidden="true" />
                <span>Battlefield Power-Ups &amp; Team Balance</span>
              </div>
            </div>
            <p className="text-[11px] text-purple-200/75 mb-2.5 leading-relaxed">
              Orbs spawn on the battlefield and are also awarded for{' '}
              <strong className="text-white">Longest Word</strong> (Double Push),{' '}
              <strong className="text-white">Fastest Word</strong> (Invert Control), and{' '}
              <strong className="text-white">3x Streaks</strong> (Shield Break).
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => gameEngine.spawnFieldPowerUp()}
                className="h-9 px-3 rounded-lg bg-[#2B0938] hover:bg-[#3A0E4D] border border-[#F6C915]/30 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-[#F6C915]" aria-hidden="true" />
                Spawn Power-Up
              </button>
              <button
                type="button"
                onClick={() => gameEngine.rebalanceTeamsIfNeeded(false)}
                className="h-9 px-3 rounded-lg bg-[#2B0938] hover:bg-[#3A0E4D] border border-[#F6C915]/30 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5 text-[#00E5FF]" aria-hidden="true" />
                Balance Teams
              </button>
            </div>
          </div>

          {/* 3. Built-In Live Match Simulator */}
          <div className="pt-4 border-t border-[#F6C915]/15">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Users className="w-3.5 h-3.5 text-[#F6C915]" aria-hidden="true" />
                  <span>Simulate Live TikTok Chat (30 Viewers)</span>
                </div>
                <p className="text-[11px] text-purple-200/70 mt-0.5">
                  Auto-balanced nicknames, profile portraits, power-ups &amp; mistakes
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={hud.simulatorEnabled}
                onClick={() => onToggleSim(!hud.simulatorEnabled)}
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 cursor-pointer ${
                  hud.simulatorEnabled ? 'bg-[#F6C915]' : 'bg-white/15'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-[#180424] shadow transition-transform duration-150 ${
                    hud.simulatorEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {hud.simulatorEnabled && (
              <div className="mt-3 flex items-center gap-1.5 p-1 rounded-lg bg-[#140321] border border-[#F6C915]/20">
                {intensities.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChangeIntensity(item.id)}
                    className={`flex-1 h-8 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      hud.simIntensity === item.id
                        ? 'bg-[#F6C915] text-[#180424]'
                        : 'text-purple-200/75 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. External TikFinity / Local WebSocket Integration */}
          <div className="pt-4 border-t border-[#F6C915]/15">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Radio className="w-3.5 h-3.5 text-[#00E5FF]" aria-hidden="true" />
                <span>TikFinity / Local WebSocket Bridge</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                {wsStatus === 'CONNECTED' ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    <span className="text-emerald-400">CONNECTED</span>
                  </>
                ) : wsStatus === 'CONNECTING' ? (
                  <span className="text-[#F6C915]">CONNECTING...</span>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-purple-300/60" aria-hidden="true" />
                    <span className="text-purple-300/60">DISCONNECTED</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-[11px] text-purple-200/70 mb-2">
              Optional local relay for TikFinity or TikTok-Live-Connector JSON events (
              <code className="text-purple-100">data.nickname</code>,{' '}
              <code className="text-purple-100">data.profilePictureUrl</code>,{' '}
              <code className="text-purple-100">data.comment</code>).
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => onWsUrlChange(e.target.value)}
                disabled={wsStatus === 'CONNECTED' || wsStatus === 'CONNECTING'}
                placeholder="ws://localhost:21213"
                aria-label="WebSocket Server URL"
                className="flex-1 h-9 px-3 rounded-lg bg-[#140321] border border-[#F6C915]/25 tow-font-mono text-xs text-white placeholder:text-purple-300/45 disabled:opacity-60 focus:outline-none focus:border-[#F6C915]"
              />
              {wsStatus === 'CONNECTED' || wsStatus === 'CONNECTING' ? (
                <button
                  type="button"
                  onClick={onDisconnectWs}
                  className="h-9 px-4 rounded-lg bg-[#FF2A5F] hover:bg-[#ff4271] text-white font-bold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onConnectWs}
                  className="h-9 px-4 rounded-lg bg-[#2B0938] hover:bg-[#3A0E4D] border border-[#F6C915]/35 text-[#F6C915] font-bold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Connect
                </button>
              )}
            </div>
            {wsError && <p className="mt-1.5 text-[11px] text-rose-300">{wsError}</p>}
            {wsStatus === 'CONNECTED' && (
              <p className="mt-1.5 text-[11px] text-emerald-400 tabular-nums">
                Listening live · {wsMessageCount} chat events received
              </p>
            )}

            <div className="mt-3 p-2.5 rounded-lg bg-[#140321] border border-[#F6C915]/20">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-bold tracking-wider text-purple-200/70">
                  GLOBAL WINDOW HOOK (BROWSER SOURCE)
                </span>
                <button
                  type="button"
                  onClick={handleCopyBridgeSnippet}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#F6C915] hover:text-[#FFE047] cursor-pointer"
                >
                  {copiedSnippet ? (
                    <>
                      <Check className="w-3 h-3" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" aria-hidden="true" />
                      Copy snippet
                    </>
                  )}
                </button>
              </div>
              <code className="block text-[10.5px] font-mono text-purple-100/85 break-all">
                window.onTikTokChatMessage(&#123; username, nickname, avatarUrl, comment &#125;)
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
