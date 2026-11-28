import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowUpRight, CheckCircle2, LogIn, LogOut, Trees, Trophy } from 'lucide-react';
import {
  getCleanDisplayName,
  logoutUser,
  useUnifiedAuth,
  type SoloGameId,
} from '@/lib/unified-game-auth';
import { UserProfileIcon } from '../user-profile-icon';
import { UnifiedAuthModal } from './unified-auth-modal';
import { GorillaShackTile } from '../gorilla-shack-tile';
import { SeoGuideSection } from '../seo-guide-section';

const CRUCI_URL = 'https://cruci.missingpiecepuzzles.fun/';

export function SoloGameList() {
  const { user } = useUnifiedAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'account' | 'leaderboards'>('leaderboards');
  const [activeLeaderboardGame, setActiveLeaderboardGame] = useState<SoloGameId>('crossword');

  const openModal = (
    gameId: SoloGameId = 'crossword',
    tab: 'account' | 'leaderboards' = 'leaderboards'
  ) => {
    setActiveLeaderboardGame(gameId);
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  return (
    <section className="solo-page" aria-labelledby="solo-title">
      <Link to="/" className="solo-back">
        <ArrowLeft size={15} /> Back to Home
      </Link>

      <div className="solo-hero">
        <p className="eyebrow">
          <span className="status-dot" /> SOLO GAMES
        </p>
        <h1 id="solo-title">Your game, your moment.</h1>
        <p>
          Solo games to play on your own and weave into your creator content. Explore our daily
          20×20 &amp; 8×8 crosswords, alphabetical Word Hunt ladders, 733+ visual rebus challenges,
          tactile daily word grids, daily word association puzzles, 3D layered word unstacking
          towers, the colossal 250×250 crossword atlas, 26-letter zero-clue crosswords, 8-connected
          Wikipedia word grids, redacted Wikipedia article discovery, daily 10×10 word searches,
          twin-plate spot-the-difference challenges, UK supermarket basket price-guessing in
          TEKSCOdle, 4-in-1 layered word puzzles in Going Deep, and 3D mechanical vault cracking in
          WORDLOCK.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a
            href="https://thegorillashack.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 underline underline-offset-4 transition-colors"
          >
            <span>Visit The Gorilla Shack for more fun and games</span>
            <ArrowUpRight size={14} />
          </a>
          <a
            href="https://wildgrove.missingpiecepuzzles.fun/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#072e22] via-[#0d4633] to-[#08291f] border border-emerald-400/75 px-3.5 py-1.5 text-xs font-bold text-emerald-100 hover:border-[#facc15] hover:text-[#fef08a] shadow-sm transition-all"
          >
            <Trees size={14} className="text-emerald-300 shrink-0" aria-hidden="true" />
            <span>Visit Wildgrove</span>
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>

      <div className="mb-10 rounded-2xl bg-gradient-to-r from-[#23063A] via-[#340A54] to-[#23063A] border-2 border-[#D4A437] p-4 sm:p-6 text-[#F5F3F7] shadow-[0_14px_34px_rgba(35,6,58,0.22)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <UserProfileIcon
            user={user}
            imgClassName="w-11 h-11 rounded-full object-cover shrink-0 border-2 border-[#F6C915] shadow-md"
            fallback={
              <img
                src="/assets/aistudio/3d_logo_944e5372.png"
                alt="The Missing Piece Emblem"
                className="w-11 h-11 rounded-full object-contain shrink-0 drop-shadow"
              />
            }
          />
          <div>
            {user ? (
              <>
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-300 font-bold">
                  <CheckCircle2 size={14} />
                  <span>UNIFIED SOLO GAMES ACCOUNT ACTIVE</span>
                </div>
                <div className="text-lg sm:text-xl font-extrabold text-[#F6C915] tracking-tight mt-0.5">
                  Welcome back, {getCleanDisplayName(user)}
                </div>
                <p className="text-xs sm:text-sm text-[#D6CBE2] mt-0.5">
                  Your Google / Email login is synced across Crossword, Missing Rebus, Squared,
                  Thematix, DeStack, MP Colossal, Unolingo, WiKirecTangled, WikiContexto, MP Search,
                  MP Difference, TEKSCOdle, Word Hunt, Going Deep &amp; WORDLOCK.
                </p>
              </>
            ) : (
              <>
                <div className="text-xs font-mono uppercase tracking-widest text-[#F6C915] font-bold">
                  ONE LOGIN · ALL SOLO GAMES · PUBLIC LEADERBOARDS
                </div>
                <div className="text-lg sm:text-xl font-extrabold text-white tracking-tight mt-0.5">
                  Sign in with Google or Email &amp; Password
                </div>
                <p className="text-xs sm:text-sm text-[#D6CBE2] mt-0.5">
                  Use a single account across all 14 solo games to record your high scores and
                  compete on the visitor leaderboards.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto">
          {user ? (
            <>
              <button
                type="button"
                onClick={() => openModal(activeLeaderboardGame, 'account')}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-bold text-xs transition-all cursor-pointer"
              >
                <UserProfileIcon user={user} size={15} className="w-4 h-4 shrink-0" />
                <span>Account &amp; Display Name</span>
              </button>
              <button
                type="button"
                onClick={() => openModal(activeLeaderboardGame, 'leaderboards')}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-[#F6C915]/40 text-[#F6C915] font-bold text-xs transition-all cursor-pointer"
              >
                <Trophy size={15} />
                <span>Leaderboards</span>
              </button>
              <button
                type="button"
                onClick={() => logoutUser()}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-rose-500/25 text-[#D6CBE2] hover:text-rose-200 font-semibold text-xs transition-all cursor-pointer"
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openModal('crossword', 'account')}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              >
                <LogIn size={16} />
                <span>Sign In / Create Account</span>
              </button>
              <button
                type="button"
                onClick={() => openModal('crossword', 'leaderboards')}
                className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-[#F6C915]/50 text-[#F6C915] font-bold text-xs sm:text-sm transition-all cursor-pointer"
              >
                <Trophy size={16} />
                <span>Leaderboards</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="game-list">
        <article className="game-card is-first">
          <div className="card-top">
            <span className="category-label">
              <span className="status-dot" /> NOW PLAYING
            </span>
            <span className="card-number">01 /</span>
          </div>
          <a
            href={CRUCI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="game-art game-art-thumb"
            aria-label="Open Cruciverbalist 20×20 Daily Crossword at cruci.missingpiecepuzzles.fun"
          >
            <img
              className="game-thumbnail"
              src="/cruci-website-thumbnail.svg"
              alt="Cruciverbalist 20×20 Daily Crossword website thumbnail"
              referrerPolicy="no-referrer"
            />
          </a>
          <h3>Cruciverbalist Daily Crossword</h3>
          <p>
            A 20×20 and 8×8 daily crossword game featuring custom thematic puzzles, a mixture of
            standard and cryptic clues, a tiered hint system, and cloud leaderboards.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
            <a
              className="game-link flex-1"
              href={CRUCI_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Play crossword{' '}
              <span>
                <ArrowUpRight size={22} />
              </span>
            </a>
            <button
              type="button"
              onClick={() => openModal('crossword', 'leaderboards')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B0938] text-[#F6C915] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer mt-3"
            >
              <Trophy size={13} />
              <span>Leaderboard</span>
            </button>
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
            to="/solo-games/rebus"
            className="game-art game-art-thumb"
            aria-label="Open Missing Rebus Challenge Archive"
          >
            <img
              className="game-thumbnail"
              src="/rebus-website-thumbnail.svg"
              alt="Missing Rebus — Rebus Challenge Archive website thumbnail"
              referrerPolicy="no-referrer"
            />
          </Link>
          <h3>Missing Rebus</h3>
          <p>
            Interactive rebus puzzle archive featuring 733+ visual wordplay challenges, 53 printable
            worksheet grids, 4-tier progressive hints, and a 5-round timed sprint mode.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
            <Link className="game-link flex-1" to="/solo-games/rebus">
              Play Missing Rebus{' '}
              <span>
                <ArrowUpRight size={22} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => openModal('rebus', 'leaderboards')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B0938] text-[#F6C915] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer mt-3"
            >
              <Trophy size={13} />
              <span>Leaderboard</span>
            </button>
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
            to="/solo-games/squared"
            className="game-art game-art-thumb"
            aria-label="Open Squared Daily Word Grid Puzzle"
          >
            <img
              className="game-thumbnail"
              src="/squared-website-thumbnail.svg"
              alt="Squared — Daily Word Grid Puzzle website thumbnail"
              referrerPolicy="no-referrer"
            />
          </Link>
          <h3>Squared — Daily Word Grid</h3>
          <p>
            A tactile daily word-finding grid puzzle across 3×3 Express, 4×4 Classic, and 5×5 Royal
            boards. Swipe adjacent letters, rotate the board 90°, and uncover the daily Missing
            Piece word.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
            <Link className="game-link flex-1" to="/solo-games/squared">
              Play Squared{' '}
              <span>
                <ArrowUpRight size={22} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => openModal('squared', 'leaderboards')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B0938] text-[#F6C915] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer mt-3"
            >
              <Trophy size={13} />
              <span>Leaderboard</span>
            </button>
          </div>
        </article>

        <article className="game-card is-wide-pair">
          <div className="card-top">
            <span className="category-label">
              <span className="status-dot" /> NOW PLAYING
            </span>
            <span className="card-number">04 /</span>
          </div>
          <Link
            to="/solo-games/thematix"
            className="game-art game-art-thumb"
            aria-label="Open Thematix Daily Word Association Puzzle"
          >
            <img
              className="game-thumbnail"
              src="/thematix-website-thumbnail.svg"
              alt="Thematix — Daily Word Association Puzzle website thumbnail"
              referrerPolicy="no-referrer"
            />
          </Link>
          <h3>Thematix — Word Association</h3>
          <p>
            Daily word association and trivia puzzle featuring Guess Mode, Fill Mode, six
            alphabetical theme-linked words, custom puzzle creation, daily archive, and streaks.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
            <Link className="game-link flex-1" to="/solo-games/thematix">
              Play Thematix{' '}
              <span>
                <ArrowUpRight size={22} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => openModal('thematix', 'leaderboards')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B0938] text-[#F6C915] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer mt-3"
            >
              <Trophy size={13} />
              <span>Leaderboard</span>
            </button>
          </div>
        </article>

        <article className="game-card is-wide-pair">
          <div className="card-top">
            <span className="category-label">
              <span className="status-dot" /> NOW PLAYING
            </span>
            <span className="card-number">05 /</span>
          </div>
          <Link
            to="/solo-games/destack"
            className="game-art game-art-thumb"
            aria-label="Open DeStack Daily Word Unstacking Puzzle"
          >
            <img
              className="game-thumbnail"
              src="/destack-website-thumbnail.svg"
              alt="DeStack — Daily Word Unstacking Puzzle website thumbnail"
              referrerPolicy="no-referrer"
            />
          </Link>
          <h3>DeStack — Word Unstacking</h3>
          <p>
            Unstack the daily 3D letter tower by finding 6 hidden five-letter words. Features
            Standard (4-layer) and Hard (6-layer) stack modes, progressive hints, daily archive,
            and leaderboards.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
            <Link className="game-link flex-1" to="/solo-games/destack">
              Play DeStack{' '}
              <span>
                <ArrowUpRight size={22} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => openModal('destack', 'leaderboards')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B0938] text-[#F6C915] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer mt-3"
            >
              <Trophy size={13} />
              <span>Leaderboard</span>
            </button>
          </div>
        </article>

        <article className="game-card is-featured">
          <div className="card-top">
            <span className="category-label">
              <span className="status-dot" /> CENTERPIECE · 250×250 CROSSWORD ATLAS
            </span>
            <span className="card-number">11 /</span>
          </div>
          <div className="featured-layout">
            <Link
              to="/solo-games/mpcolossal"
              className="game-art game-art-thumb"
              aria-label="Open MP Colossal 250×250 Giant Crossword Atlas"
            >
              <img
                className="game-thumbnail"
                src="/mpcolossal-website-thumbnail.svg"
                alt="MP Colossal — 250×250 Giant Crossword Atlas website thumbnail"
                referrerPolicy="no-referrer"
              />
            </Link>
            <div className="featured-body">
              <h3>
                MP <span className="text-[#F6C915]">Colossal</span> — Giant Atlas
              </h3>
              <p>
                Navigate a seamless 62,500-square pan-and-zoom crossword atlas spanning 25 themed
                knowledge sectors and over 6,400 clues. Choose Colossal (250×250), Grand (120×120),
                or District (60×60) scales, embark on Expedition Quests, jump instantly with the
                Atlas Radar minimap, or switch on 12×12 Stream Layout.
              </p>
              <div className="featured-meta">
                <span>62,500 Squares</span>
                <span aria-hidden="true">·</span>
                <span>25 Quest Sectors</span>
                <span aria-hidden="true">·</span>
                <span>Atlas Radar</span>
                <span aria-hidden="true">·</span>
                <span>3-Tier Hints</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
                <Link className="game-link flex-1" to="/solo-games/mpcolossal">
                  Enter MP Colossal Atlas{' '}
                  <span>
                    <ArrowUpRight size={22} />
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => openModal('mpcolossal', 'leaderboards')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#F6C915] text-[#1D0830] hover:bg-[#FFE047] text-xs font-extrabold transition-colors cursor-pointer mt-3 shadow-sm"
                >
                  <Trophy size={14} />
                  <span>Leaderboard</span>
                </button>
              </div>
            </div>
          </div>
        </article>

        <article className="game-card is-wide-pair">
          <div className="card-top">
            <span className="category-label">
              <span className="status-dot" /> NOW PLAYING
            </span>
            <span className="card-number">06 /</span>
          </div>
          <Link
            to="/solo-games/unolingo"
            className="game-art game-art-thumb"
            aria-label="Open Unolingo Daily 26-Letter Crossword"
          >
            <img
              className="game-thumbnail"
              src="/unolingo-website-thumbnail.svg"
              alt="Unolingo — Daily 26-Letter Crossword website thumbnail"
              referrerPolicy="no-referrer"
            />
          </Link>
          <h3>Unolingo — 26-Letter Crossword</h3>
          <p>
            Place every letter A–Z once into a zero-clue 10×10 crossword grid using pure word
            deduction. Features daily London resets, a 183-day archive calendar, drag-and-drop
            tiles, daily streaks, and leaderboards.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
            <Link className="game-link flex-1" to="/solo-games/unolingo">
              Play Unolingo{' '}
              <span>
                <ArrowUpRight size={22} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => openModal('unolingo', 'leaderboards')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B0938] text-[#F6C915] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer mt-3"
            >
              <Trophy size={13} />
              <span>Leaderboard</span>
            </button>
          </div>
        </article>

        <article className="game-card is-wide-pair">
          <div className="card-top">
            <span className="category-label">
              <span className="status-dot" /> NOW PLAYING
            </span>
            <span className="card-number">07 /</span>
          </div>
          <Link
            to="/solo-games/wikirec"
            className="game-art game-art-thumb"
            aria-label="Open WiKirecTangled Solo Wikipedia Word Grid"
          >
            <img
              className="game-thumbnail"
              src="/wikirec-website-thumbnail.svg"
              alt="WiKirecTangled — Solo Wikipedia Word Grid website thumbnail"
              referrerPolicy="no-referrer"
            />
          </Link>
          <h3>WiKirecTangled</h3>
          <p>
            Trace 8-connected word paths across a tactile 3D keycap board to unlock Common, Rare,
            and Ultra tiers while uncovering the hidden Wikipedia Article Title. Play Daily Solo
            and Endless Practice rounds at your own pace.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
            <Link className="game-link flex-1" to="/solo-games/wikirec">
              Play WiKirecTangled{' '}
              <span>
                <ArrowUpRight size={22} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => openModal('wikirec', 'leaderboards')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B0938] text-[#F6C915] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer mt-3"
            >
              <Trophy size={13} />
              <span>Leaderboard</span>
            </button>
          </div>
        </article>

        <article className="game-card">
          <div className="card-top">
            <span className="category-label">
              <span className="status-dot" /> NOW PLAYING
            </span>
            <span className="card-number">08 /</span>
          </div>
          <Link
            to="/solo-games/wikicon"
            className="game-art game-art-thumb"
            aria-label="Open WikiContexto Solo Redacted Article Discovery"
          >
            <img
              className="game-thumbnail"
              src="/wikicon-website-thumbnail.svg"
              alt="WikiContexto — Solo Redacted Wikipedia Article Discovery website thumbnail"
              referrerPolicy="no-referrer"
            />
          </Link>
          <h3>WikiContexto</h3>
          <p>
            Uncover a redacted Wikipedia article word-by-word using semantic closeness rankings,
            explore Daily Puzzles and the Previous Dailies Archive, or swipe hidden target words on
            the 7×7 Keycap Grid &amp; 5×7 Quote modes in solo play.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
            <Link className="game-link flex-1" to="/solo-games/wikicon">
              Play WikiContexto{' '}
              <span>
                <ArrowUpRight size={22} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => openModal('wikicon', 'leaderboards')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B0938] text-[#F6C915] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer mt-3"
            >
              <Trophy size={13} />
              <span>Leaderboard</span>
            </button>
          </div>
        </article>

        <article className="game-card">
          <div className="card-top">
            <span className="category-label">
              <span className="status-dot" /> NOW PLAYING
            </span>
            <span className="card-number">09 /</span>
          </div>
          <Link
            to="/solo-games/mpsearch"
            className="game-art game-art-thumb"
            aria-label="Open MP Search Daily 10x10 Word Search"
          >
            <img
              className="game-thumbnail"
              src="/mpsearch-website-thumbnail.svg"
              alt="MP Search — Daily 10×10 Word Search website thumbnail"
              referrerPolicy="no-referrer"
            />
          </Link>
          <h3>MP Search — Daily Word Search</h3>
          <p>
            Discover 8 to 12 randomized thematic words hidden across a tactile 10×10 letterpress
            grid—horizontally, vertically, diagonally, and backwards with intersecting crossings.
            Features a 4-tier progressive hint system and a full 12-month (368-day) playable archive.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
            <Link className="game-link flex-1" to="/solo-games/mpsearch">
              Play MP Search{' '}
              <span>
                <ArrowUpRight size={22} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => openModal('mpsearch', 'leaderboards')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B0938] text-[#F6C915] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer mt-3"
            >
              <Trophy size={13} />
              <span>Leaderboard</span>
            </button>
          </div>
        </article>

        <article className="game-card">
          <div className="card-top">
            <span className="category-label">
              <span className="status-dot" /> NOW PLAYING
            </span>
            <span className="card-number">10 /</span>
          </div>
          <Link
            to="/solo-games/mpdifference"
            className="game-art game-art-thumb"
            aria-label="Open MP Difference Daily Spot the Difference"
          >
            <img
              className="game-thumbnail"
              src="/mpdifference-website-thumbnail.svg"
              alt="MP Difference — Daily Spot the Difference website thumbnail"
              referrerPolicy="no-referrer"
            />
          </Link>
          <h3>MP Difference — Spot the Difference</h3>
          <p>
            Compare paired illustrated plates across 8 curated worlds under a 2.2× synchronized
            optical loupe. Spot missing objects, color shifts, flipped shapes, and swapped details
            across a 6-month daily archive with streak multipliers.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
            <Link className="game-link flex-1" to="/solo-games/mpdifference">
              Play MP Difference{' '}
              <span>
                <ArrowUpRight size={22} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => openModal('mpdifference', 'leaderboards')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B0938] text-[#F6C915] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer mt-3"
            >
              <Trophy size={13} />
              <span>Leaderboard</span>
            </button>
          </div>
        </article>

        <article className="game-card">
          <div className="card-top">
            <span className="category-label">
              <span className="status-dot" /> NOW PLAYING
            </span>
            <span className="card-number">12 /</span>
          </div>
          <Link
            to="/solo-games/tekscodle"
            className="game-art game-art-thumb"
            aria-label="Open TEKSCOdle UK Supermarket Price Guesser"
          >
            <img
              className="game-thumbnail"
              src="/tekscodle-website-thumbnail.svg"
              alt="TEKSCOdle — UK Supermarket Price Guesser website thumbnail"
              referrerPolicy="no-referrer"
            />
          </Link>
          <h3>TEKSCOdle — Price Guesser</h3>
          <p>
            Price UK supermarket baskets across 1-item, 3-item, and 5-item rounds before the till
            rings. Features Daily Basket challenges, Endless Practice, instant Quick Play, 3 difficulty
            margins, and proximity till scoring.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
            <Link className="game-link flex-1" to="/solo-games/tekscodle">
              Play TEKSCOdle{' '}
              <span>
                <ArrowUpRight size={22} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => openModal('tekscodle', 'leaderboards')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B0938] text-[#F6C915] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer mt-3"
            >
              <Trophy size={13} />
              <span>Leaderboard</span>
            </button>
          </div>
        </article>

        <article className="game-card">
          <div className="card-top">
            <span className="category-label">
              <span className="status-dot" /> NOW PLAYING
            </span>
            <span className="card-number">13 /</span>
          </div>
          <Link
            to="/solo-games/wordhunt"
            className="game-art game-art-thumb"
            aria-label="Open Word Hunt Solo Alphabetical Ladder Game"
          >
            <img
              className="game-thumbnail"
              src="/mpwh-website-thumbnail.svg"
              alt="Word Hunt — Solo Alphabetical Word Ladder website thumbnail"
              referrerPolicy="no-referrer"
            />
          </Link>
          <h3>Word Hunt — Alphabetical Ladder</h3>
          <p>
            Narrow the A–Z dictionary bracket above and below to crack hidden 4–8 letter words in
            Classic (1 word), Dual (2 words), and Quad (4 boards) modes. Play Daily Challenges or
            Endless Practice across 7 languages with smart bisect hints.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
            <Link className="game-link flex-1" to="/solo-games/wordhunt">
              Play Word Hunt{' '}
              <span>
                <ArrowUpRight size={22} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => openModal('wordhunt', 'leaderboards')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B0938] text-[#F6C915] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer mt-3"
            >
              <Trophy size={13} />
              <span>Leaderboard</span>
            </button>
          </div>
        </article>

        <article className="game-card">
          <div className="card-top">
            <span className="category-label">
              <span className="status-dot" /> NOW PLAYING
            </span>
            <span className="card-number">14 /</span>
          </div>
          <Link
            to="/solo-games/goingdeep"
            className="game-art game-art-thumb"
            aria-label="Open Going Deep 4-in-1 Layered Daily Puzzle"
          >
            <img
              className="game-thumbnail"
              src="/goingdeep-website-thumbnail.svg"
              alt="Going Deep — 4-in-1 Layered Daily Puzzle website thumbnail"
              referrerPolicy="no-referrer"
            />
          </Link>
          <h3>Going Deep — 4-in-1 Layered Puzzle</h3>
          <p>
            Unlock hidden words via LetterLock, Anagram, Mini Crossword, and Word Search keys to
            sort a 16-word Connections board into four thematic layers. Play Standard (4 keys), Hard
            (8 keys), or Expert (12 keys) with a 14-day daily archive.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
            <Link className="game-link flex-1" to="/solo-games/goingdeep">
              Play Going Deep{' '}
              <span>
                <ArrowUpRight size={22} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => openModal('goingdeep', 'leaderboards')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B0938] text-[#F6C915] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer mt-3"
            >
              <Trophy size={13} />
              <span>Leaderboard</span>
            </button>
          </div>
        </article>

        <article className="game-card">
          <div className="card-top">
            <span className="category-label">
              <span className="status-dot" /> NOW PLAYING
            </span>
            <span className="card-number">15 /</span>
          </div>
          <Link
            to="/solo-games/wordlock"
            className="game-art game-art-thumb"
            aria-label="Open WORDLOCK 3D Mechanical Vault Puzzle"
          >
            <img
              className="game-thumbnail"
              src="/wordlock-website-thumbnail.svg"
              alt="WORDLOCK — 3D Mechanical Conveyor Vault Puzzle website thumbnail"
              referrerPolicy="no-referrer"
            />
          </Link>
          <h3>WORDLOCK — 3D Mechanical Vault</h3>
          <p>
            Spin four interconnected 3D conveyor tumbler tracks until every horizontal row forms a
            valid 4-letter English word and the center bezel locks onto the secret Master Key.
            Features Easy, Standard, Hard &amp; Master tiers, a 6-month daily archive, and Unlimited
            locks.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2">
            <Link className="game-link flex-1" to="/solo-games/wordlock">
              Play WORDLOCK{' '}
              <span>
                <ArrowUpRight size={22} />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => openModal('wordlock', 'leaderboards')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B0938] text-[#F6C915] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer mt-3"
            >
              <Trophy size={13} />
              <span>Leaderboard</span>
            </button>
          </div>
        </article>
      </div>

      <GorillaShackTile />

      <SeoGuideSection variant="solo" />

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        user={user}
        initialGameId={activeLeaderboardGame}
        initialTab={authModalTab}
      />
    </section>
  );
}
