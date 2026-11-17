import React, { useState } from 'react';
import { MonitorPlay, Copy, Check, ExternalLink, X } from 'lucide-react';
import {
  buildLiveOverlayUrl,
  isAiStudioDevHost,
  type OverlayBackgroundMode,
} from '@/lib/live-overlay';

interface LiveOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameTitle: string;
  gameSlug: string;
  streamerHandle?: string | null;
  recommendedSize?: string;
}

export const LiveOverlayModal: React.FC<LiveOverlayModalProps> = ({
  isOpen,
  onClose,
  gameTitle,
  gameSlug,
  streamerHandle,
  recommendedSize = '540 × 1200 or 1080 × 2400 (20:9 Vertical)',
}) => {
  const [bgMode, setBgMode] = useState<OverlayBackgroundMode>('transparent');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isDevHost = isAiStudioDevHost();
  const overlayUrl = buildLiveOverlayUrl(gameSlug, streamerHandle, bgMode, {
    preferPublicOrigin: true,
  });
  const previewUrl = buildLiveOverlayUrl(gameSlug, streamerHandle, 'dark', {
    preferPublicOrigin: false,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(overlayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[#0e1222] border border-amber-400/45 shadow-2xl p-5 text-slate-100 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <MonitorPlay className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                {gameTitle} — TikTok LIVE Studio Overlay
              </h2>
              <p className="text-xs text-slate-400">
                Shows essential live gameplay only — synced automatically with your host session.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close overlay modal"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBgMode('transparent')}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
              bgMode === 'transparent'
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Transparent Background
          </button>
          <button
            type="button"
            onClick={() => setBgMode('dark')}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
              bgMode === 'dark'
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Dark Studio Backdrop
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Browser Source URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={overlayUrl}
              onClick={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/50 border border-slate-700 font-mono text-xs text-amber-300 focus:outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy URL'}</span>
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3 text-xs text-slate-300 space-y-1">
          <div className="font-bold text-amber-300">TikTok LIVE Studio Setup</div>
          <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-300">
            <li>In TikTok LIVE Studio, click <strong>Add Source → Browser</strong>.</li>
            <li>Paste the URL above and set size to <strong>{recommendedSize}</strong>.</li>
            <li>
              {isDevHost
                ? 'This link uses the public app URL so TikTok LIVE Studio loads without sign-in while syncing live from your host game.'
                : 'Keep this host game open — all word reveals, timers, and rounds sync automatically across tabs and Studio.'}
            </li>
          </ol>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Preview Overlay</span>
          </a>
        </div>
      </div>
    </div>
  );
};

interface LiveOverlayButtonProps {
  gameTitle: string;
  gameSlug: string;
  streamerHandle?: string | null;
  recommendedSize?: string;
  className?: string;
  label?: string;
}

export const LiveOverlayButton: React.FC<LiveOverlayButtonProps> = ({
  gameTitle,
  gameSlug,
  streamerHandle,
  recommendedSize,
  className = '',
  label = 'LIVE Overlay',
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Get TikTok LIVE Studio Browser Source Overlay URL"
        className={
          className ||
          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/45 text-amber-300 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <MonitorPlay className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </button>
      <LiveOverlayModal
        isOpen={open}
        onClose={() => setOpen(false)}
        gameTitle={gameTitle}
        gameSlug={gameSlug}
        streamerHandle={streamerHandle}
        recommendedSize={recommendedSize}
      />
    </>
  );
};
