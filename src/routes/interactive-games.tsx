import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowUpRight, CheckCircle2, KeyRound, LogOut, User, Users } from 'lucide-react';
import {
  clearActiveInteractiveStreamerSession,
  useInteractiveAuthStore,
  validateInteractiveStreamerKey,
} from '@/lib/interactive-key-auth';
import {
  normalizeTikTokHandle,
  setLinkedTikTokHandle,
  useInteractiveProfileScores,
  useUnifiedAuth,
} from '@/lib/unified-game-auth';
import { AdminPortalModal } from '@/components/interactive-games/admin-portal-modal';
import { AdminPanelModal } from '@/components/admin-panel-modal';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';
import { GorillaShackTile } from '@/components/gorilla-shack-tile';
import { LiveOverlayButton } from '@/components/interactive-games/live-overlay-button';

export function InteractiveGamesPage() {
  const { activeStreamer } = useInteractiveAuthStore();
  const { user: siteUser } = useUnifiedAuth();
  const profileScores = useInteractiveProfileScores(siteUser?.uid);

  const [usernameInput, setUsernameInput] = useState('');
  const [streamKeyInput, setStreamKeyInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    document.title = 'Interactive Live Games | The Missing Piece';
  }, []);

  const handleUnifiedKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const res = validateInteractiveStreamerKey(usernameInput, streamKeyInput);
    if (!res.valid || !res.streamer) {
      setAuthError(
        res.error || 'Enter a registered @username and LIVE-xxxx-xxxx key.'
      );
      return;
    }
    if (siteUser && !siteUser.linkedTikTokHandle) {
      setLinkedTikTokHandle(
        siteUser.uid,
        siteUser.displayName || 'Player',
        res.streamer.username
      );
    }
  };

  return (
    <main aria-label="Interactive live games">
      <section className="solo-page" aria-labelledby="interactive-title">
        <Link to="/" className="solo-back">
          <ArrowLeft size={15} /> Back to Home
        </Link>

        <div className="solo-hero">
          <p className="eyebrow">
            <span className="status-dot" /> TIKTOK INTERACTIVE GAMES
          </p>
          <h1 id="interactive-title">Interactive live games.</h1>
          <p>
            Built for chat, speed, and shared momentum. Jump in when the stream goes live or host
            interactive sessions directly with your TikTok Live chat community.
          </p>
        </div>

        {/* Unified Interactive Streamer Key & Admin Portal Banner */}
        <div className="mb-10 rounded-2xl bg-gradient-to-r from-[#23063A] via-[#340A54] to-[#23063A] border-2 border-[#D4A437] p-4 sm:p-6 text-[#F5F3F7] shadow-[0_14px_34px_rgba(35,6,58,0.22)] space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <img
                src="/assets/aistudio/3d_logo_944e5372.png"
                alt="The Missing Piece Emblem"
                className="w-11 h-11 rounded-full object-contain shrink-0 drop-shadow"
              />
              <div>
                {activeStreamer ? (
                  <>
                    <div className="flex items-center gap-2 text-xs font-mono text-emerald-300 font-bold">
                      <CheckCircle2 size={14} />
                      <span>UNIFIED STREAM KEY ACTIVE · ISOLATED SESSION</span>
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-[#F6C915] tracking-tight mt-0.5">
                      Streamer {activeStreamer.displayHandle}
                    </div>
                    <p className="text-xs sm:text-sm text-[#D6CBE2] mt-0.5">
                      All 6 interactive games are unlocked. Scores for linked TikTok @ accounts sync
                      automatically to their website profile.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-mono uppercase tracking-widest text-[#F6C915] font-bold">
                      UNIFIED INTERACTIVE LOGIN · STREAM KEY REQUIRED
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-white tracking-tight mt-0.5">
                      Enter your TikTok @username &amp; LIVE-xxxx-xxxx Stream Key
                    </div>
                    <p className="text-xs sm:text-sm text-[#D6CBE2] mt-0.5">
                      Sign in once below to unlock WiKirecTangled, WikiContexto, Squared Interactive,
                      Lexi Tiles, DeStack Interactive &amp; Crowdle, or open the Admin Portal to register stream keys.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-[#F6C915]/40 text-[#F6C915] font-bold text-xs transition-all cursor-pointer"
              >
                <User size={15} />
                <span>
                  {siteUser?.linkedTikTokHandle
                    ? `Linked ${normalizeTikTokHandle(siteUser.linkedTikTokHandle)}`
                    : 'Link TikTok @ in Profile'}
                  {profileScores && profileScores.totalPoints > 0
                    ? ` (${profileScores.totalPoints.toLocaleString()} pts)`
                    : ''}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowAdminModal(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-bold text-xs transition-all cursor-pointer"
              >
                <KeyRound size={15} />
                <span>Admin Portal (Register Keys)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAdminPanel(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white font-bold text-xs transition-all cursor-pointer"
              >
                <Users size={15} />
                <span>Admin Panel</span>
              </button>

              {activeStreamer && (
                <button
                  type="button"
                  onClick={() => clearActiveInteractiveStreamerSession()}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-rose-500/25 text-[#D6CBE2] hover:text-rose-200 font-semibold text-xs transition-all cursor-pointer"
                >
                  <LogOut size={15} />
                  <span>Switch Key</span>
                </button>
              )}
            </div>
          </div>

          {!activeStreamer && (
            <form
              onSubmit={handleUnifiedKeySubmit}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2 border-t border-white/10"
            >
              <input
                type="text"
                placeholder="TikTok @username (e.g. @mrdimpz)"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                required
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/20 text-xs sm:text-sm text-white placeholder-[#9E8BB5] focus:outline-none focus:border-[#F6C915]"
              />
              <input
                type="password"
                placeholder="LIVE-XXXX-XXXX"
                value={streamKeyInput}
                onChange={(e) => setStreamKeyInput(e.target.value.toUpperCase())}
                required
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/20 text-xs sm:text-sm font-mono uppercase text-white placeholder-[#9E8BB5] focus:outline-none focus:border-[#F6C915]"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              >
                Unlock Interactive Games
              </button>
            </form>
          )}

          {authError && (
            <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-400/40 text-xs text-rose-200 font-semibold">
              {authError}
            </div>
          )}
        </div>

        <div className="game-list">
          <article className="game-card is-first">
            <div className="card-top">
              <span className="category-label">
                <span className="status-dot" /> NOW PLAYING
              </span>
              <span className="card-number">01 /</span>
            </div>
            <Link
              to="/interactive-games/wikirec"
              className="game-art game-art-thumb"
              aria-label="Play WiKirecTangled interactive game"
            >
              <img
                className="game-thumbnail"
                src="/wikirec-website-thumbnail.svg"
                alt="Preview of the WiKirecTangled 8-connected Wikipedia word grid and TikTok Live chat bridge"
              />
            </Link>
            <h3>WiKirecTangled</h3>
            <p>
              Trace 8-connected word paths across a tactile 3D keycap board to unlock Common, Rare,
              and Ultra tiers while racing to uncover the hidden Wikipedia Article Title. Supports
              Solo Daily, Endless Practice, 4×4 Blitz, and TikTok Live Streamer mode.
            </p>
            <div className="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
              <Link className="game-link" to="/interactive-games/wikirec">
                Play WiKirecTangled{' '}
                <span>
                  <ArrowUpRight size={22} />
                </span>
              </Link>
              <LiveOverlayButton
                gameTitle="WiKirecTangled"
                gameSlug="wikirec"
                streamerHandle={activeStreamer?.username}
                recommendedSize="560 × 940 or 1080 × 1920"
                label="LIVE Overlay"
              />
            </div>
          </article>

          <article className="game-card">
            <div className="card-top">
              <span className="category-label">
                <span className="status-dot" /> NOW PLAYING
              </span>
              <span className="card-number">02 /</span>
            </div>
            <Link
              to="/interactive-games/wikicon"
              className="game-art game-art-thumb"
              aria-label="Play WikiContexto interactive game"
            >
              <img
                className="game-thumbnail"
                src="/wikicon-website-thumbnail.svg"
                alt="Preview of the WikiContexto redacted Wikipedia article discovery arena and 3D keycap matrix"
              />
            </Link>
            <h3>WikiContexto</h3>
            <p>
              Uncover a redacted Wikipedia article word-by-word using semantic closeness rankings,
              swipe hidden target words on the 3D keycap matrix, or connect your TikTok Live chat so
              viewers can solve the article together in real time.
            </p>
            <div className="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
              <Link className="game-link" to="/interactive-games/wikicon">
                Play WikiContexto{' '}
                <span>
                  <ArrowUpRight size={22} />
                </span>
              </Link>
              <LiveOverlayButton
                gameTitle="WikiContexto"
                gameSlug="wikicon"
                streamerHandle={activeStreamer?.username}
                recommendedSize="560 × 960 or 1080 × 1920"
                label="LIVE Overlay"
              />
            </div>
          </article>

          <article className="game-card">
            <div className="card-top">
              <span className="category-label">
                <span className="status-dot" /> NOW PLAYING
              </span>
              <span className="card-number">03 /</span>
            </div>
            <Link
              to="/interactive-games/squaredint"
              className="game-art game-art-thumb"
              aria-label="Play Squared Interactive game"
            >
              <img
                className="game-thumbnail"
                src="/squaredint-website-thumbnail.svg"
                alt="Preview of the Squared Interactive 4x4 grid, TikTok Live chat commands, and live leaderboard"
              />
            </Link>
            <h3>Squared Interactive</h3>
            <p>
              Host the 4×4 word grid live on TikTok. Viewers race in chat to claim 4+ letter words
              and bonus words, trigger <code>!rotate</code> and <code>!hint</code> commands, and
              climb the live stream leaderboard.
            </p>
            <div className="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
              <Link className="game-link" to="/interactive-games/squaredint">
                Play Squared Interactive{' '}
                <span>
                  <ArrowUpRight size={22} />
                </span>
              </Link>
              <LiveOverlayButton
                gameTitle="Squared Interactive"
                gameSlug="squaredint"
                streamerHandle={activeStreamer?.username}
                recommendedSize="540 × 920 or 1080 × 1920"
                label="LIVE Overlay"
              />
            </div>
          </article>

          <article className="game-card">
            <div className="card-top">
              <span className="category-label">
                <span className="status-dot" /> NOW PLAYING
              </span>
              <span className="card-number">04 /</span>
            </div>
            <Link
              to="/interactive-games/lexi"
              className="game-art game-art-thumb"
              aria-label="Play Lexi Tiles interactive game"
            >
              <img
                className="game-thumbnail"
                src="/lexi-website-thumbnail.svg"
                alt="Preview of Lexi Tiles interactive lexicon word arena and TikTok Live chat duel"
              />
            </Link>
            <h3>Lexi Tiles</h3>
            <p>
              The fast-paced live lexicon showdown. Race against the clock and chat to assemble
              words from dynamic letter pools, score combo multipliers, and discover rare high-value
              vocabulary in real time.
            </p>
            <div className="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
              <Link className="game-link" to="/interactive-games/lexi">
                Play Lexi Tiles{' '}
                <span>
                  <ArrowUpRight size={22} />
                </span>
              </Link>
              <LiveOverlayButton
                gameTitle="Lexi Tiles"
                gameSlug="lexi"
                streamerHandle={activeStreamer?.username}
                recommendedSize="540 × 860 or 1080 × 1920"
                label="LIVE Overlay"
              />
            </div>
          </article>

          <article className="game-card">
            <div className="card-top">
              <span className="category-label">
                <span className="status-dot" /> NOW PLAYING
              </span>
              <span className="card-number">05 /</span>
            </div>
            <Link
              to="/interactive-games/destackint"
              className="game-art game-art-thumb"
              aria-label="Play DeStack Interactive game"
            >
              <img
                className="game-thumbnail"
                src="/destackint-website-thumbnail.svg"
                alt="Preview of the DeStack Interactive 4-layer word pyramid, auto-reveal timer, and TikTok Live chat speed leaderboard"
              />
            </Link>
            <h3>DeStack Interactive</h3>
            <p>
              Unstack the 4-layer word pyramid live on TikTok. Viewers race in chat to spot valid
              5-letter words from exposed top-layer tiles before the auto-reveal timer expires,
              earning speed-bonus points on the running stream scoreboard.
            </p>
            <div className="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
              <Link className="game-link" to="/interactive-games/destackint">
                Play DeStack Interactive{' '}
                <span>
                  <ArrowUpRight size={22} />
                </span>
              </Link>
              <LiveOverlayButton
                gameTitle="DeStack Interactive"
                gameSlug="destackint"
                streamerHandle={activeStreamer?.username}
                recommendedSize="560 × 940 or 1080 × 1920"
                label="LIVE Overlay"
              />
            </div>
          </article>

          <article className="game-card">
            <div className="card-top">
              <span className="category-label">
                <span className="status-dot" /> NOW PLAYING
              </span>
              <span className="card-number">06 /</span>
            </div>
            <Link
              to="/interactive-games/crowdle"
              className="game-art game-art-thumb"
              aria-label="Play Crowdle interactive game"
            >
              <img
                className="game-thumbnail"
                src="/crowdle-website-thumbnail.svg"
                alt="Preview of Crowdle live crowd-voted Wordle grid, Decision Sync timer, and streak progression"
              />
            </Link>
            <h3>Crowdle</h3>
            <p>
              Crowd-voted Wordle built for TikTok Live. Viewers cast votes in chat during the
              Decision Sync timer to lock in the #1 consensus word across 5- to 8-letter stages,
              Endless Chain mode, and First-to-Find bonuses.
            </p>
            <div className="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
              <Link className="game-link" to="/interactive-games/crowdle">
                Play Crowdle{' '}
                <span>
                  <ArrowUpRight size={22} />
                </span>
              </Link>
              <LiveOverlayButton
                gameTitle="Crowdle"
                gameSlug="crowdle"
                streamerHandle={activeStreamer?.username}
                recommendedSize="540 × 940 or 1080 × 1920"
                label="LIVE Overlay"
              />
            </div>
          </article>
        </div>

        <GorillaShackTile />

        <div className="collection-notice">
          <div>
            <h3>Live interactive stream schedule</h3>
            <p>
              Streaming live soon on TikTok: Follow <strong>@MissingPiecePuzzles</strong> to play
              along in chat with fellow solvers and join the interactive live community.
            </p>
          </div>
          <a
            className="button button-dark"
            style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
            href="https://www.tiktok.com/@MissingPiecePuzzles"
            target="_blank"
            rel="noopener noreferrer"
          >
            Follow on TikTok <ArrowUpRight size={16} />
          </a>
        </div>

        <AdminPortalModal
          open={showAdminModal}
          onClose={() => setShowAdminModal(false)}
        />
        <AdminPanelModal
          open={showAdminPanel}
          onClose={() => setShowAdminPanel(false)}
        />
        <UnifiedAuthModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          user={siteUser}
          initialTab="account"
        />
      </section>
    </main>
  );
}

export default InteractiveGamesPage;
