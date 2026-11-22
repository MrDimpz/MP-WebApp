import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Maximize2,
  Minimize2,
  MonitorPlay,
  RefreshCw,
  X,
} from 'lucide-react';
import { useInteractiveAuthStore } from '@/lib/interactive-key-auth';
import {
  buildLiveOverlayUrl,
  DEFAULT_PUBLIC_STUDIO_ORIGIN,
  getOrCreateHostOverlayChannel,
  getPublicStudioOrigin,
  isAiStudioProxyHost,
  setPublicStudioOrigin,
  type OverlayBackgroundMode,
} from '@/lib/live-overlay';

interface OverlayGameSpec {
  id: string;
  title: string;
  hostPath: string;
  overlaySlug: string;
  virtualWidth: number;
  virtualHeight: number;
  sizeLabel: string;
  colSpanTwo?: boolean;
}

const INTERACTIVE_OVERLAY_SPECS: OverlayGameSpec[] = [
  {
    id: 'wikirec',
    title: 'WiKirecTangled',
    hostPath: '/interactive-games/wikirec',
    overlaySlug: 'wikirec',
    virtualWidth: 540,
    virtualHeight: 1200,
    sizeLabel: '540 × 1200 · 20:9',
  },
  {
    id: 'wikicon',
    title: 'WikiContexto',
    hostPath: '/interactive-games/wikicon',
    overlaySlug: 'wikicon',
    virtualWidth: 540,
    virtualHeight: 1200,
    sizeLabel: '540 × 1200 · 20:9',
  },
  {
    id: 'squaredint',
    title: 'Squared Interactive',
    hostPath: '/interactive-games/squaredint',
    overlaySlug: 'squaredint',
    virtualWidth: 540,
    virtualHeight: 1200,
    sizeLabel: '540 × 1200 · 20:9',
  },
  {
    id: 'lexi',
    title: 'Lexi Tiles',
    hostPath: '/interactive-games/lexi',
    overlaySlug: 'lexi',
    virtualWidth: 540,
    virtualHeight: 1200,
    sizeLabel: '540 × 1200 · 20:9',
  },
  {
    id: 'destackint',
    title: 'DeStack Interactive',
    hostPath: '/interactive-games/destackint',
    overlaySlug: 'destackint',
    virtualWidth: 540,
    virtualHeight: 1200,
    sizeLabel: '540 × 1200 · 20:9',
  },
  {
    id: 'crowdle',
    title: 'Crowdle',
    hostPath: '/interactive-games/crowdle',
    overlaySlug: 'crowdle',
    virtualWidth: 540,
    virtualHeight: 1200,
    sizeLabel: '540 × 1200 · 20:9',
  },
  {
    id: 'mpsearch',
    title: 'MP Search Interactive',
    hostPath: '/interactive-games/mpsearch',
    overlaySlug: 'mpsearch',
    virtualWidth: 580,
    virtualHeight: 660,
    sizeLabel: '580 × 660 · Board',
  },
  {
    id: 'inkstream',
    title: 'InkStream',
    hostPath: '/interactive-games/inkstream',
    overlaySlug: 'inkstream',
    virtualWidth: 640,
    virtualHeight: 720,
    sizeLabel: '640 × 720 · Studio',
  },
];

interface ScaledOverlayStageProps {
  src: string;
  title: string;
  virtualWidth: number;
  virtualHeight: number;
  bgMode: OverlayBackgroundMode;
  reloadKey: number;
  shouldMount?: boolean;
}

const CHECKERBOARD_STYLE: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #171b26 25%, transparent 25%), linear-gradient(-45deg, #171b26 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #171b26 75%), linear-gradient(-45deg, transparent 75%, #171b26 75%)',
  backgroundSize: '18px 18px',
  backgroundPosition: '0 0, 0 9px, 9px -9px, -9px 0',
  backgroundColor: '#0f131c',
};

function ScaledOverlayStage({
  src,
  title,
  virtualWidth,
  virtualHeight,
  bgMode,
  reloadKey,
  shouldMount = true,
}: ScaledOverlayStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [boxSize, setBoxSize] = useState<{ width: number; height: number }>({
    width: 300,
    height: 360,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setBoxSize({ width: rect.width, height: rect.height });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = 8;
  const availW = Math.max(80, boxSize.width - pad * 2);
  const availH = Math.max(80, boxSize.height - pad * 2);
  const scale = Math.min(availW / virtualWidth, availH / virtualHeight);
  const scaledW = Math.round(virtualWidth * scale);
  const scaledH = Math.round(virtualHeight * scale);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center bg-[#090b10]"
      style={bgMode === 'transparent' ? CHECKERBOARD_STYLE : undefined}
    >
      <div
        className="relative overflow-hidden rounded-lg border border-white/10 shadow-inner"
        style={{
          width: `${scaledW}px`,
          height: `${scaledH}px`,
        }}
      >
        {shouldMount ? (
          <iframe
            key={`${src}-${reloadKey}`}
            src={src}
            title={`${title} live overlay preview`}
            loading="lazy"
            className="border-0 block pointer-events-none bg-transparent"
            style={{
              width: `${virtualWidth}px`,
              height: `${virtualHeight}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#0d111a] text-xs font-mono text-slate-400">
            Loading {title}…
          </div>
        )}
      </div>
    </div>
  );
}

export function InteractiveOverlaysWallPage() {
  const { activeStreamer } = useInteractiveAuthStore();
  const [bgMode, setBgMode] = useState<OverlayBackgroundMode>('dark');
  const [layoutMode, setLayoutMode] = useState<'fit' | 'expanded'>('fit');
  const [streamerInput, setStreamerInput] = useState<string>(
    () => activeStreamer?.username || ''
  );
  const [appliedStreamer, setAppliedStreamer] = useState<string>(
    () => activeStreamer?.username || ''
  );
  const [globalReloadNonce, setGlobalReloadNonce] = useState(0);
  const [cardReloadNonces, setCardReloadNonces] = useState<Record<string, number>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [mountLimit, setMountLimit] = useState<number>(1);
  const [studioOrigin, setStudioOrigin] = useState<string>(() => getPublicStudioOrigin());
  const [originDraft, setOriginDraft] = useState<string>(() => getPublicStudioOrigin());
  const [originSaved, setOriginSaved] = useState(false);

  const isProxyHost = isAiStudioProxyHost();

  useEffect(() => {
    document.title = 'All Interactive Overlays — The Missing Piece';
  }, []);

  useEffect(() => {
    if (mountLimit >= INTERACTIVE_OVERLAY_SPECS.length) return;
    const t = setTimeout(() => {
      setMountLimit((prev) => Math.min(INTERACTIVE_OVERLAY_SPECS.length, prev + 1));
    }, 140);
    return () => clearTimeout(t);
  }, [mountLimit]);

  useEffect(() => {
    if (activeStreamer?.username && !appliedStreamer) {
      setStreamerInput(activeStreamer.username);
      setAppliedStreamer(activeStreamer.username);
    }
  }, [activeStreamer?.username, appliedStreamer]);

  const activeChannel = useMemo(() => getOrCreateHostOverlayChannel(), []);

  const cards = useMemo(
    () =>
      INTERACTIVE_OVERLAY_SPECS.map((spec) => {
        const previewSrc = buildLiveOverlayUrl(
          spec.overlaySlug,
          appliedStreamer || undefined,
          bgMode,
          { preferPublicOrigin: false, embed: true }
        );
        const tabPreviewUrl = buildLiveOverlayUrl(
          spec.overlaySlug,
          appliedStreamer || undefined,
          bgMode,
          { preferPublicOrigin: false }
        );
        const studioUrl = buildLiveOverlayUrl(
          spec.overlaySlug,
          appliedStreamer || undefined,
          bgMode,
          { preferPublicOrigin: true, publicOriginOverride: studioOrigin }
        );
        return { ...spec, previewSrc, tabPreviewUrl, studioUrl };
      }),
    [appliedStreamer, bgMode, studioOrigin]
  );

  const focusedCard = useMemo(
    () => cards.find((c) => c.id === focusedId) || null,
    [cards, focusedId]
  );

  const handleCopyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 1800);
  };

  const handleStreamerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedStreamer(streamerInput.trim().replace(/^@+/, '').toLowerCase());
  };

  const handleClearStreamer = () => {
    setStreamerInput('');
    setAppliedStreamer('');
  };

  const bumpCardReload = (id: string) => {
    setCardReloadNonces((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const handleApplyOrigin = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = setPublicStudioOrigin(originDraft);
    setStudioOrigin(updated);
    setOriginDraft(updated);
    setOriginSaved(true);
    setTimeout(() => setOriginSaved(false), 1800);
  };

  return (
    <div
      className={`min-h-screen bg-[#090B10] text-slate-100 flex flex-col ${
        layoutMode === 'fit' ? 'lg:h-screen lg:overflow-hidden' : ''
      }`}
    >
      {/* Top Broadcast Wall Header */}
      <header className="shrink-0 border-b border-slate-800/90 bg-[#0F121B] px-4 py-2.5">
        <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 whitespace-nowrap shrink-0 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Main Page</span>
            </Link>
            <div className="h-5 w-px bg-slate-800 hidden sm:block" aria-hidden="true" />
            <div className="flex items-center gap-2 min-w-0">
              <MonitorPlay className="w-4 h-4 text-[#F6C915] shrink-0" />
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                All Interactive Overlays
              </h1>
              <span className="hidden md:inline text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap">
                · 7 Live Feeds · Channel {activeChannel || 'default'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Streamer Handle Filter */}
            <form onSubmit={handleStreamerSubmit} className="flex items-center gap-1.5">
              <input
                type="text"
                value={streamerInput}
                onChange={(e) => setStreamerInput(e.target.value)}
                placeholder="@streamer filter"
                aria-label="Filter overlays by TikTok streamer handle"
                className="w-36 sm:w-44 px-2.5 py-1.5 rounded-lg bg-[#090B10] border border-slate-700/90 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#F6C915]"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Apply
              </button>
              {appliedStreamer && (
                <button
                  type="button"
                  onClick={handleClearStreamer}
                  aria-label="Clear streamer filter"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {isProxyHost && (
              <form onSubmit={handleApplyOrigin} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={originDraft}
                  onChange={(e) => setOriginDraft(e.target.value)}
                  placeholder={DEFAULT_PUBLIC_STUDIO_ORIGIN}
                  aria-label="Public Studio Domain for copied overlay URLs"
                  title="Public domain used when copying TikTok LIVE Studio Browser Source URLs"
                  className="w-40 sm:w-48 px-2.5 py-1.5 rounded-lg bg-[#090B10] border border-slate-700/90 font-mono text-xs text-amber-300 placeholder:text-slate-500 focus:outline-none focus:border-[#F6C915]"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {originSaved ? 'Saved' : 'Domain'}
                </button>
              </form>
            )}

            {/* Backdrop Toggle */}
            <div
              className="flex items-center p-0.5 rounded-lg bg-[#090B10] border border-slate-800"
              role="group"
              aria-label="Overlay background preview mode"
            >
              <button
                type="button"
                onClick={() => setBgMode('dark')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  bgMode === 'dark'
                    ? 'bg-[#F6C915] text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Dark Backdrop
              </button>
              <button
                type="button"
                onClick={() => setBgMode('transparent')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  bgMode === 'transparent'
                    ? 'bg-[#F6C915] text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Transparent
              </button>
            </div>

            {/* Layout Density Toggle */}
            <div
              className="hidden lg:flex items-center p-0.5 rounded-lg bg-[#090B10] border border-slate-800"
              role="group"
              aria-label="Grid layout density"
            >
              <button
                type="button"
                onClick={() => setLayoutMode('fit')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  layoutMode === 'fit'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Fit One Screen
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('expanded')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  layoutMode === 'expanded'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Expanded
              </button>
            </div>

            <button
              type="button"
              onClick={() => setGlobalReloadNonce((n) => n + 1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F6C915] hover:bg-[#ffe047] text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh All</span>
            </button>
          </div>
        </div>
      </header>

      {/* 7-Overlay Multiview Grid */}
      <main
        className={`flex-1 min-h-0 p-3 sm:p-4 max-w-[1920px] w-full mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 ${
          layoutMode === 'fit' ? 'lg:grid-rows-2' : 'auto-rows-[520px]'
        }`}
      >
        {cards.map((card, idx) => {
          const isCopied = copiedId === card.id;
          const reloadKey = globalReloadNonce + (cardReloadNonces[card.id] || 0);
          return (
            <section
              key={card.id}
              aria-label={`${card.title} overlay`}
              className={`rounded-xl border border-slate-800 bg-[#11141D] flex flex-col overflow-hidden ${
                layoutMode === 'fit'
                  ? 'min-h-[340px] lg:min-h-0'
                  : 'min-h-[440px]'
              } ${card.colSpanTwo ? 'md:col-span-2 lg:col-span-2' : ''}`}
            >
              <div className="shrink-0 px-3 py-2 border-b border-slate-800/90 flex items-center justify-between gap-2 bg-[#151925]">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {card.title}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                    {card.sizeLabel}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(card.id, card.studioUrl)}
                    title="Copy TikTok LIVE Studio Browser Source URL"
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      isCopied
                        ? 'bg-[#F6C915] text-slate-950 border-[#F6C915]'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    {isCopied ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{isCopied ? 'Copied' : 'Copy URL'}</span>
                  </button>

                  <a
                    href={card.hostPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${card.title} host window`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <span>Host</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    type="button"
                    onClick={() => bumpCardReload(card.id)}
                    title={`Reload ${card.title} overlay`}
                    aria-label={`Reload ${card.title} overlay`}
                    className="p-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setFocusedId(card.id)}
                    title={`Expand ${card.title} overlay`}
                    aria-label={`Expand ${card.title} overlay`}
                    className="p-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <ScaledOverlayStage
                src={card.previewSrc}
                title={card.title}
                virtualWidth={card.virtualWidth}
                virtualHeight={card.virtualHeight}
                bgMode={bgMode}
                reloadKey={reloadKey}
                shouldMount={idx < mountLimit}
              />
            </section>
          );
        })}
      </main>

      {/* Enlarged Single Overlay Modal */}
      {focusedCard && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center"
          onClick={() => setFocusedId(null)}
        >
          <div
            className="w-full max-w-5xl h-[88vh] rounded-2xl border border-slate-700 bg-[#11141D] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-4 py-3 border-b border-slate-800 bg-[#151925] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white truncate">
                  {focusedCard.title}
                </h2>
                <p className="text-xs text-slate-400 font-mono tabular-nums truncate">
                  {focusedCard.sizeLabel} · {focusedCard.studioUrl}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyUrl(focusedCard.id, focusedCard.studioUrl)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F6C915] hover:bg-[#ffe047] text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  {copiedId === focusedCard.id ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {copiedId === focusedCard.id ? 'Copied Studio URL' : 'Copy Studio URL'}
                  </span>
                </button>
                <a
                  href={focusedCard.tabPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Tab</span>
                </a>
                <button
                  type="button"
                  onClick={() => setFocusedId(null)}
                  aria-label="Close expanded overlay preview"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <ScaledOverlayStage
              src={focusedCard.previewSrc}
              title={focusedCard.title}
              virtualWidth={focusedCard.virtualWidth}
              virtualHeight={focusedCard.virtualHeight}
              bgMode={bgMode}
              reloadKey={globalReloadNonce + (cardReloadNonces[focusedCard.id] || 0)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default InteractiveOverlaysWallPage;
