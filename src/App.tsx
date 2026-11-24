/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, Suspense, lazy, useEffect, type ComponentType, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { CookieBanner } from '@/components/cookie-banner';
import HomePage from '@/routes/home';

function isDynamicImportError(err: unknown): boolean {
  const msg = String((err as { message?: unknown })?.message ?? err ?? '').toLowerCase();
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('failed to fetch') ||
    msg.includes('importing a module script failed') ||
    msg.includes('loading chunk') ||
    msg.includes('load failed')
  );
}

function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const delays = [350, 900];
    let lastError: unknown;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        return await importer();
      } catch (err) {
        lastError = err;
        if (!isDynamicImportError(err)) {
          throw err;
        }
        if (attempt < delays.length) {
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        }
      }
    }

    // If retries still failed due to a stale Vite dep/chunk hash, perform one guarded reload
    if (typeof window !== 'undefined' && isDynamicImportError(lastError)) {
      const storageKey = `mp_chunk_reload:${window.location.pathname}`;
      try {
        const lastReload = Number(window.sessionStorage.getItem(storageKey) || '0');
        if (!lastReload || Date.now() - lastReload > 15_000) {
          window.sessionStorage.setItem(storageKey, String(Date.now()));
          window.location.reload();
          // Keep Suspense pending while the browser reloads cleanly
          return await new Promise<{ default: T }>(() => {});
        }
      } catch {
        // Ignore sessionStorage errors and fall through to ErrorBoundary
      }
    }

    throw lastError;
  });
}

const InteractiveGamesPage = lazyWithRetry(() => import('@/routes/interactive-games'));
const SoloGamesPage = lazyWithRetry(() => import('@/routes/solo-games'));
const RebusPage = lazyWithRetry(() => import('@/routes/rebus'));
const SquaredPage = lazyWithRetry(() => import('@/routes/squared'));
const ThematixPage = lazyWithRetry(() => import('@/routes/thematix'));
const DeStackPage = lazyWithRetry(() => import('@/routes/destack'));
const UnolingoPage = lazyWithRetry(() => import('@/routes/unolingo'));
const WikiRecSoloPage = lazyWithRetry(() => import('@/routes/wikirec-solo'));
const WikiConSoloPage = lazyWithRetry(() => import('@/routes/wikicon-solo'));
const MPSearchPage = lazyWithRetry(() => import('@/routes/mpsearch'));
const MPDifferencePage = lazyWithRetry(() => import('@/routes/mpdifference'));
const MPColossalPage = lazyWithRetry(() => import('@/routes/mpcolossal'));
const TekscodlePage = lazyWithRetry(() => import('@/routes/tekscodle'));
const WordHuntSoloPage = lazyWithRetry(() => import('@/routes/wordhunt'));
const SquaredIntGamePage = lazyWithRetry(() => import('@/routes/squaredint-game'));
const WikirecGamePage = lazyWithRetry(() => import('@/routes/wikirec-game'));
const WikiconGamePage = lazyWithRetry(() => import('@/routes/wikicon-game'));
const LexiGamePage = lazyWithRetry(() => import('@/routes/lexi-game'));
const DeStackIntGamePage = lazyWithRetry(() => import('@/routes/destackint-game'));
const CrowdleGamePage = lazyWithRetry(() =>
  import('@/routes/crowdle-game').then((m) => ({ default: m.CrowdleGamePage }))
);
const MPSearchIntGamePage = lazyWithRetry(() => import('@/routes/mpsearchint-game'));
const InkStreamGamePage = lazyWithRetry(() => import('@/routes/inkstream-game'));
const MpwhGamePage = lazyWithRetry(() => import('@/routes/mpwh-game'));
const WbrGamePage = lazyWithRetry(() => import('@/routes/wbr-game'));
const TowGamePage = lazyWithRetry(() => import('@/routes/tow-game'));
const InteractiveOverlaysWallPage = lazyWithRetry(() => import('@/routes/interactive-overlays'));

import {
  buildStructuredData,
  resolveSeoForPath,
  SITE_ORIGIN,
} from '@/lib/seo-catalog';

const STANDALONE_GAME_PATHS = new Set([
  '/solo-games/rebus',
  '/solo-games/squared',
  '/solo-games/thematix',
  '/solo-games/destack',
  '/solo-games/unolingo',
  '/solo-games/wikirec',
  '/solo-games/wikicon',
  '/solo-games/mpsearch',
  '/solo-games/mpdifference',
  '/solo-games/mpcolossal',
  '/solo-games/tekscodle',
  '/solo-games/wordhunt',
  '/interactive-games/overlays',
  '/interactive-games/wikirec',
  '/interactive-games/wikirec/overlay',
  '/interactive-games/wikicon',
  '/interactive-games/wikicon/overlay',
  '/interactive-games/squared',
  '/interactive-games/squared/overlay',
  '/interactive-games/squaredint',
  '/interactive-games/squaredint/overlay',
  '/interactive-games/lexi',
  '/interactive-games/lexi/overlay',
  '/interactive-games/destack',
  '/interactive-games/destack/overlay',
  '/interactive-games/destackint',
  '/interactive-games/destackint/overlay',
  '/interactive-games/crowdle',
  '/interactive-games/crowdle/overlay',
  '/interactive-games/mpsearch',
  '/interactive-games/mpsearch/overlay',
  '/interactive-games/mpsearchint',
  '/interactive-games/mpsearchint/overlay',
  '/interactive-games/inkstream',
  '/interactive-games/inkstream/overlay',
  '/interactive-games/mpwh',
  '/interactive-games/mpwh/overlay',
  '/interactive-games/wbr',
  '/interactive-games/wbr/overlay',
  '/interactive-games/tow',
  '/interactive-games/tow/overlay',
]);

function RouteFallback({ transparent = false }: { transparent?: boolean }) {
  return (
    <div
      className={
        transparent
          ? 'min-h-screen w-full bg-transparent'
          : 'min-h-screen w-full flex items-center justify-center bg-[#160524] text-[#F6C915] font-sans text-sm font-semibold'
      }
      aria-busy="true"
    >
      {!transparent && <span>Loading game...</span>}
    </div>
  );
}

function updateMetaTag(attrName: 'name' | 'property', key: string, content: string) {
  let tag = document.querySelector(`meta[${attrName}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attrName, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertRouteJsonLd(data: Record<string, unknown>) {
  let script = document.getElementById('mp-route-jsonld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'mp-route-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

function AppShell() {
  const location = useLocation();
  const isStandaloneGame = STANDALONE_GAME_PATHS.has(location.pathname);
  const isOverlayRoute = location.pathname.endsWith('/overlay');

  useEffect(() => {
    const origin =
      typeof window !== 'undefined' && window.location.hostname === 'missingpiecepuzzles.fun'
        ? SITE_ORIGIN
        : typeof window !== 'undefined'
          ? window.location.origin
          : SITE_ORIGIN;

    const meta = resolveSeoForPath(location.pathname, origin);
    const canonicalUrl = `${origin}${meta.canonicalPath}`;
    const ogImageUrl = `${origin}${meta.ogImagePath}`;

    document.title = meta.title;
    updateMetaTag('name', 'robots', meta.robots);
    updateMetaTag('name', 'description', meta.description);
    updateMetaTag('name', 'keywords', meta.keywords);
    updateMetaTag('property', 'og:title', meta.title);
    updateMetaTag('property', 'og:description', meta.description);
    updateMetaTag('property', 'og:url', canonicalUrl);
    updateMetaTag('property', 'og:image', ogImageUrl);
    updateMetaTag('property', 'og:image:alt', meta.ogImageAlt);
    updateMetaTag('name', 'twitter:title', meta.title);
    updateMetaTag('name', 'twitter:description', meta.description);
    updateMetaTag('name', 'twitter:image', ogImageUrl);

    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalUrl);

    upsertRouteJsonLd(buildStructuredData(meta, origin));

    if (location.hash) {
      const id = location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname, location.hash]);

  if (isStandaloneGame) {
    return (
      <Suspense fallback={<RouteFallback transparent={isOverlayRoute} />}>
        <Routes>
          <Route path="/solo-games/rebus" element={<RebusPage />} />
          <Route path="/solo-games/squared" element={<SquaredPage />} />
          <Route path="/solo-games/thematix" element={<ThematixPage />} />
          <Route path="/solo-games/destack" element={<DeStackPage />} />
          <Route path="/solo-games/unolingo" element={<UnolingoPage />} />
          <Route path="/solo-games/wikirec" element={<WikiRecSoloPage />} />
          <Route path="/solo-games/wikicon" element={<WikiConSoloPage />} />
          <Route path="/solo-games/mpsearch" element={<MPSearchPage />} />
          <Route path="/solo-games/mpdifference" element={<MPDifferencePage />} />
          <Route path="/solo-games/mpcolossal" element={<MPColossalPage />} />
          <Route path="/solo-games/tekscodle" element={<TekscodlePage />} />
          <Route path="/solo-games/wordhunt" element={<WordHuntSoloPage />} />
          <Route path="/interactive-games/overlays" element={<InteractiveOverlaysWallPage />} />
          <Route path="/interactive-games/wikirec" element={<WikirecGamePage />} />
          <Route path="/interactive-games/wikirec/overlay" element={<WikirecGamePage />} />
          <Route path="/interactive-games/wikicon" element={<WikiconGamePage />} />
          <Route path="/interactive-games/wikicon/overlay" element={<WikiconGamePage />} />
          <Route path="/interactive-games/squared" element={<SquaredIntGamePage />} />
          <Route path="/interactive-games/squared/overlay" element={<SquaredIntGamePage />} />
          <Route path="/interactive-games/squaredint" element={<SquaredIntGamePage />} />
          <Route path="/interactive-games/squaredint/overlay" element={<SquaredIntGamePage />} />
          <Route path="/interactive-games/lexi" element={<LexiGamePage />} />
          <Route path="/interactive-games/lexi/overlay" element={<LexiGamePage />} />
          <Route path="/interactive-games/destack" element={<DeStackIntGamePage />} />
          <Route path="/interactive-games/destack/overlay" element={<DeStackIntGamePage />} />
          <Route path="/interactive-games/destackint" element={<DeStackIntGamePage />} />
          <Route path="/interactive-games/destackint/overlay" element={<DeStackIntGamePage />} />
          <Route path="/interactive-games/crowdle" element={<CrowdleGamePage />} />
          <Route path="/interactive-games/crowdle/overlay" element={<CrowdleGamePage />} />
          <Route path="/interactive-games/mpsearch" element={<MPSearchIntGamePage />} />
          <Route path="/interactive-games/mpsearch/overlay" element={<MPSearchIntGamePage />} />
          <Route path="/interactive-games/mpsearchint" element={<MPSearchIntGamePage />} />
          <Route path="/interactive-games/mpsearchint/overlay" element={<MPSearchIntGamePage />} />
          <Route path="/interactive-games/inkstream" element={<InkStreamGamePage />} />
          <Route path="/interactive-games/inkstream/overlay" element={<InkStreamGamePage />} />
          <Route path="/interactive-games/mpwh" element={<MpwhGamePage />} />
          <Route path="/interactive-games/mpwh/overlay" element={<MpwhGamePage />} />
          <Route path="/interactive-games/wbr" element={<WbrGamePage />} />
          <Route path="/interactive-games/wbr/overlay" element={<WbrGamePage />} />
          <Route path="/interactive-games/tow" element={<TowGamePage />} />
          <Route path="/interactive-games/tow/overlay" element={<TowGamePage />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="mp-site">
      <SiteHeader />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/interactive-games" element={<InteractiveGamesPage />} />
          <Route path="/interactive-games/wikirec" element={<WikirecGamePage />} />
          <Route path="/interactive-games/wikicon" element={<WikiconGamePage />} />
          <Route path="/interactive-games/squared" element={<SquaredIntGamePage />} />
          <Route path="/interactive-games/squaredint" element={<SquaredIntGamePage />} />
          <Route path="/interactive-games/lexi" element={<LexiGamePage />} />
          <Route path="/interactive-games/destack" element={<DeStackIntGamePage />} />
          <Route path="/interactive-games/destackint" element={<DeStackIntGamePage />} />
          <Route path="/interactive-games/crowdle" element={<CrowdleGamePage />} />
          <Route path="/interactive-games/mpsearch" element={<MPSearchIntGamePage />} />
          <Route path="/interactive-games/mpsearchint" element={<MPSearchIntGamePage />} />
          <Route path="/interactive-games/inkstream" element={<InkStreamGamePage />} />
          <Route path="/interactive-games/mpwh" element={<MpwhGamePage />} />
          <Route path="/interactive-games/wbr" element={<WbrGamePage />} />
          <Route path="/interactive-games/tow" element={<TowGamePage />} />
          <Route path="/solo-games" element={<SoloGamesPage />} />
        </Routes>
      </Suspense>
      <SiteFooter />
      <CookieBanner />
    </div>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#160524] text-[#F5F3F7] p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#2B0948] border-2 border-[#D4A437] p-6 text-center space-y-4 shadow-2xl">
            <img
              src="/brand-logo.png"
              alt="The Missing Piece"
              className="w-12 h-12 rounded-full mx-auto object-contain"
            />
            <h1 className="text-lg font-extrabold text-[#F6C915]">
              Something went wrong
            </h1>
            <p className="text-xs text-[#D6CBE2] leading-relaxed">
              We ran into an unexpected issue loading your session or game state. Your saved
              progress remains safely stored.
            </p>
            {this.state.message && (
              <p className="text-[11px] font-mono text-rose-200 bg-black/40 border border-rose-400/30 rounded-xl p-2.5 break-words">
                {this.state.message}
              </p>
            )}
            <div className="flex items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, message: '' });
                  window.location.href = '/';
                }}
                className="px-4 py-2 rounded-xl bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-bold text-xs cursor-pointer"
              >
                Return Home
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs cursor-pointer"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
