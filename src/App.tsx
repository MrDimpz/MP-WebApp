/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { CookieBanner } from '@/components/cookie-banner';
import HomePage from '@/routes/home';

const InteractiveGamesPage = lazy(() => import('@/routes/interactive-games'));
const SoloGamesPage = lazy(() => import('@/routes/solo-games'));
const RebusPage = lazy(() => import('@/routes/rebus'));
const SquaredPage = lazy(() => import('@/routes/squared'));
const ThematixPage = lazy(() => import('@/routes/thematix'));
const DeStackPage = lazy(() => import('@/routes/destack'));
const UnolingoPage = lazy(() => import('@/routes/unolingo'));
const WikiRecSoloPage = lazy(() => import('@/routes/wikirec-solo'));
const WikiConSoloPage = lazy(() => import('@/routes/wikicon-solo'));
const MPSearchPage = lazy(() => import('@/routes/mpsearch'));
const MPDifferencePage = lazy(() => import('@/routes/mpdifference'));
const MPColossalPage = lazy(() => import('@/routes/mpcolossal'));
const TekscodlePage = lazy(() => import('@/routes/tekscodle'));
const SquaredIntGamePage = lazy(() => import('@/routes/squaredint-game'));
const WikirecGamePage = lazy(() => import('@/routes/wikirec-game'));
const WikiconGamePage = lazy(() => import('@/routes/wikicon-game'));
const LexiGamePage = lazy(() => import('@/routes/lexi-game'));
const DeStackIntGamePage = lazy(() => import('@/routes/destackint-game'));
const CrowdleGamePage = lazy(() =>
  import('@/routes/crowdle-game').then((m) => ({ default: m.CrowdleGamePage }))
);
const MPSearchIntGamePage = lazy(() => import('@/routes/mpsearchint-game'));
const InkStreamGamePage = lazy(() => import('@/routes/inkstream-game'));
const MpwhGamePage = lazy(() => import('@/routes/mpwh-game'));
const InteractiveOverlaysWallPage = lazy(() => import('@/routes/interactive-overlays'));

const SITE_ORIGIN = 'https://missingpiecepuzzles.fun';

const DEFAULT_TITLE = 'The Missing Piece — TikTok Interactive & Solo Games';
const DEFAULT_DESCRIPTION =
  'Play free TikTok LIVE interactive games and 12 solo word, trivia, crossword, and supermarket price puzzles—including MP Colossal, Rebus, Squared, Thematix, Unolingo, and TEKSCOdle.';

const PAGE_TITLES: Record<string, string> = {
  '/': DEFAULT_TITLE,
  '/interactive-games': 'TikTok Interactive Games — The Missing Piece',
  '/interactive-games/overlays': 'All Interactive Overlays — The Missing Piece',
  '/interactive-games/wikirec': 'WiKirecTangled — TikTok Interactive Game — The Missing Piece',
  '/interactive-games/wikirec/overlay': 'WiKirecTangled — TikTok LIVE Studio Overlay',
  '/interactive-games/wikicon': 'WikiContexto — TikTok Interactive Game — The Missing Piece',
  '/interactive-games/wikicon/overlay': 'WikiContexto — TikTok LIVE Studio Overlay',
  '/interactive-games/squared': 'Squared Interactive — TikTok Live Game — The Missing Piece',
  '/interactive-games/squared/overlay': 'Squared Interactive — TikTok LIVE Studio Overlay',
  '/interactive-games/squaredint': 'Squared Interactive — TikTok Live Game — The Missing Piece',
  '/interactive-games/squaredint/overlay': 'Squared Interactive — TikTok LIVE Studio Overlay',
  '/interactive-games/lexi': 'Lexi Tiles — TikTok Interactive Game — The Missing Piece',
  '/interactive-games/lexi/overlay': 'Lexi Tiles — TikTok LIVE Studio Overlay',
  '/interactive-games/destack': 'DeStack Interactive — TikTok Live Game — The Missing Piece',
  '/interactive-games/destack/overlay': 'DeStack Interactive — TikTok LIVE Studio Overlay',
  '/interactive-games/destackint': 'DeStack Interactive — TikTok Live Game — The Missing Piece',
  '/interactive-games/destackint/overlay': 'DeStack Interactive — TikTok LIVE Studio Overlay',
  '/interactive-games/crowdle': 'Crowdle — TikTok Live Crowd Wordle — The Missing Piece',
  '/interactive-games/crowdle/overlay': 'Crowdle — TikTok LIVE Studio Overlay',
  '/interactive-games/mpsearch': 'MP Search Interactive — TikTok Live Word Search — The Missing Piece',
  '/interactive-games/mpsearch/overlay': 'MP Search Interactive — TikTok LIVE Studio Overlay',
  '/interactive-games/mpsearchint': 'MP Search Interactive — TikTok Live Word Search — The Missing Piece',
  '/interactive-games/mpsearchint/overlay': 'MP Search Interactive — TikTok LIVE Studio Overlay',
  '/interactive-games/inkstream': 'InkStream — TikTok LIVE Drawing & Chat Guessing — The Missing Piece',
  '/interactive-games/inkstream/overlay': 'InkStream — TikTok LIVE Studio Overlay',
  '/interactive-games/mpwh': 'Word Hunt Extreme — TikTok LIVE Alphabetical Word Ladder — The Missing Piece',
  '/interactive-games/mpwh/overlay': 'Word Hunt Extreme — TikTok LIVE Studio Overlay',
  '/solo-games': 'Solo Games Hub (12 Puzzles) — The Missing Piece',
  '/solo-games/rebus': 'Missing Rebus — Visual Rebus Archive — The Missing Piece',
  '/solo-games/squared': 'Squared — Daily Word Grid — The Missing Piece',
  '/solo-games/thematix': 'Thematix — Daily Word Association — The Missing Piece',
  '/solo-games/destack': 'DeStack — 3D Word Unstacking — The Missing Piece',
  '/solo-games/unolingo': 'Unolingo — 26-Letter Crossword — The Missing Piece',
  '/solo-games/wikirec': 'WiKirecTangled — Solo Wikipedia Word Grid — The Missing Piece',
  '/solo-games/wikicon': 'WikiContexto — Solo Article Discovery — The Missing Piece',
  '/solo-games/mpsearch': 'MP Search — Daily 10×10 Word Search — The Missing Piece',
  '/solo-games/mpdifference': 'MP Difference — Daily Spot the Difference — The Missing Piece',
  '/solo-games/mpcolossal': 'MP Colossal — 200×200 Giant Crossword Atlas — The Missing Piece',
  '/solo-games/tekscodle': 'TEKSCOdle — UK Supermarket Price Guesser — The Missing Piece',
};

const PAGE_DESCRIPTIONS: Record<string, string> = {
  '/': DEFAULT_DESCRIPTION,
  '/solo-games':
    'Play all 12 free solo browser games from The Missing Piece including MP Colossal, Cruciverbalist, Missing Rebus, Squared, Thematix, DeStack, Unolingo, MP Difference, and TEKSCOdle.',
  '/solo-games/mpcolossal':
    'Explore a 40,000-square 200x200 giant crossword atlas across 25 themed sectors with Expedition Quests, Atlas Radar minimap, 3-tier hints, and 12x12 Stream Layout.',
  '/solo-games/mpdifference':
    'Compare paired illustrated plates under a 2.2x optical loupe in MP Difference, featuring 8 worlds and a 6-month daily archive.',
  '/solo-games/tekscodle':
    'Guess real UK supermarket prices across 1-item, 3-item, and 5-item baskets in TEKSCOdle—featuring Daily Basket, Endless Practice, and Quick Play modes.',
  '/interactive-games':
    'Launch real-time TikTok LIVE interactive games with transparent browser-source overlays for TikTok LIVE Studio and OBS Studio.',
};

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

function AppShell() {
  const location = useLocation();
  const isStandaloneGame = STANDALONE_GAME_PATHS.has(location.pathname);
  const isOverlayRoute = location.pathname.endsWith('/overlay');

  useEffect(() => {
    const title = PAGE_TITLES[location.pathname] ?? DEFAULT_TITLE;
    const description = PAGE_DESCRIPTIONS[location.pathname] ?? DEFAULT_DESCRIPTION;
    const canonicalPath = location.pathname === '/' ? '/' : location.pathname.replace(/\/+$/, '');
    const origin =
      typeof window !== 'undefined' && window.location.hostname === 'missingpiecepuzzles.fun'
        ? SITE_ORIGIN
        : typeof window !== 'undefined'
          ? window.location.origin
          : SITE_ORIGIN;
    const canonicalUrl = `${origin}${canonicalPath}`;

    document.title = title;
    updateMetaTag('name', 'description', description);
    updateMetaTag('property', 'og:title', title);
    updateMetaTag('property', 'og:description', description);
    updateMetaTag('property', 'og:url', canonicalUrl);
    updateMetaTag('name', 'twitter:title', title);
    updateMetaTag('name', 'twitter:description', description);

    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalUrl);

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
          <Route path="/solo-games" element={<SoloGamesPage />} />
        </Routes>
      </Suspense>
      <SiteFooter />
      <CookieBanner />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
