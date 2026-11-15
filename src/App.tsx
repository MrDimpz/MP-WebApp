/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { CookieBanner } from '@/components/cookie-banner';
import HomePage from '@/routes/home';
import InteractiveGamesPage from '@/routes/interactive-games';
import SoloGamesPage from '@/routes/solo-games';
import RebusPage from '@/routes/rebus';
import SquaredPage from '@/routes/squared';
import ThematixPage from '@/routes/thematix';
import DeStackPage from '@/routes/destack';
import UnolingoPage from '@/routes/unolingo';
import WikiRecSoloPage from '@/routes/wikirec-solo';
import WikiConSoloPage from '@/routes/wikicon-solo';
import MPSearchPage from '@/routes/mpsearch';
import SquaredIntGamePage from '@/routes/squaredint-game';
import WikirecGamePage from '@/routes/wikirec-game';
import WikiconGamePage from '@/routes/wikicon-game';
import LexiGamePage from '@/routes/lexi-game';
import DeStackIntGamePage from '@/routes/destackint-game';
import { CrowdleGamePage } from '@/routes/crowdle-game';
import MPSearchIntGamePage from '@/routes/mpsearchint-game';

const PAGE_TITLES: Record<string, string> = {
  '/': 'The Missing Piece — TikTok interactive & solo games',
  '/interactive-games': 'TikTok interactive games — The Missing Piece',
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
  '/solo-games': 'Solo games — The Missing Piece',
  '/solo-games/rebus': 'Missing Rebus — Solo game — The Missing Piece',
  '/solo-games/squared': 'Squared — Daily Word Grid — The Missing Piece',
  '/solo-games/thematix': 'Thematix — Word Association — The Missing Piece',
  '/solo-games/destack': 'DeStack — Word Unstacking — The Missing Piece',
  '/solo-games/unolingo': 'Unolingo — 26-Letter Crossword — The Missing Piece',
  '/solo-games/wikirec': 'WiKirecTangled — Solo Wikipedia Word Grid — The Missing Piece',
  '/solo-games/wikicon': 'WikiContexto — Solo Article Discovery — The Missing Piece',
  '/solo-games/mpsearch': 'MP Search — Daily 10×10 Word Search — The Missing Piece',
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
]);

function AppShell() {
  const location = useLocation();
  const isStandaloneGame = STANDALONE_GAME_PATHS.has(location.pathname);

  useEffect(() => {
    const title =
      PAGE_TITLES[location.pathname] ?? 'The Missing Piece — TikTok interactive & solo games';
    document.title = title;

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
      <Routes>
        <Route path="/solo-games/rebus" element={<RebusPage />} />
        <Route path="/solo-games/squared" element={<SquaredPage />} />
        <Route path="/solo-games/thematix" element={<ThematixPage />} />
        <Route path="/solo-games/destack" element={<DeStackPage />} />
        <Route path="/solo-games/unolingo" element={<UnolingoPage />} />
        <Route path="/solo-games/wikirec" element={<WikiRecSoloPage />} />
        <Route path="/solo-games/wikicon" element={<WikiConSoloPage />} />
        <Route path="/solo-games/mpsearch" element={<MPSearchPage />} />
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
      </Routes>
    );
  }

  return (
    <div className="mp-site">
      <SiteHeader />
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
        <Route path="/solo-games" element={<SoloGamesPage />} />
      </Routes>
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




