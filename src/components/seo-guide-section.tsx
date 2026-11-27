import { Link } from 'react-router';
import { ArrowUpRight, Globe2, HelpCircle, Radio, Sparkles } from 'lucide-react';
import { HOME_FAQS, INTERACTIVE_FAQS, SOLO_FAQS } from '@/lib/seo-catalog';

interface SeoGuideSectionProps {
  variant: 'home' | 'interactive' | 'solo';
}

const INTERACTIVE_HIGHLIGHTS = [
  {
    name: 'Word Hunt Extreme',
    to: '/interactive-games/mpwh',
    tag: 'A–Z Word Ladder',
    desc: 'Pinch secret 4–8 letter words in Classic, Dual, and Quad Hunt modes with 4s stream-lag protection.',
  },
  {
    name: 'Crowdle',
    to: '/interactive-games/crowdle',
    tag: 'Crowd Wordle',
    desc: 'Let TikTok chat vote during Decision Sync on 5–8 letter words and Endless Chain streaks.',
  },
  {
    name: 'InkStream',
    to: '/interactive-games/inkstream',
    tag: 'Draw & Guess',
    desc: 'Draw live on screen while TikTok chat races to guess the secret word in solo or 20-player rooms.',
  },
  {
    name: 'Squared Interactive',
    to: '/interactive-games/squared',
    tag: '4×4 Word Grid',
    desc: 'Audience race to find 4+ letter words across a 4×4 grid with live !rotate and !hint chat commands.',
  },
  {
    name: 'Lexi Tiles',
    to: '/interactive-games/lexi',
    tag: 'Live Anagrams',
    desc: 'Build high-scoring anagram words from dynamic letter racks with chat combo multipliers.',
  },
  {
    name: 'DeStack Interactive',
    to: '/interactive-games/destack',
    tag: '3D Word Tower',
    desc: 'Unstack 4-layer 5-letter word pyramids live with your viewers before each tile auto-reveals.',
  },
];

const SOLO_HIGHLIGHTS = [
  {
    name: 'MP Colossal Atlas',
    to: '/solo-games/mpcolossal',
    tag: '250×250 Crossword',
    desc: 'Explore 62,500 squares across 25 themed sectors and 6,400+ clues with Atlas Radar.',
  },
  {
    name: 'Squared Daily Grid',
    to: '/solo-games/squared',
    tag: '7 Languages',
    desc: 'Swipe or type words on daily 3×3, 4×4, and 5×5 letter grids with 90° board rotation.',
  },
  {
    name: 'Unolingo',
    to: '/solo-games/unolingo',
    tag: 'Zero-Clue A–Z',
    desc: 'Place all 26 letters once into an interlocking 10×10 crossword with a 183-day archive.',
  },
  {
    name: 'DeStack Solo',
    to: '/solo-games/destack',
    tag: '3D Word Pyramid',
    desc: 'Peel away 4-layer Standard and 6-layer Hard 5-letter word towers in 7 languages.',
  },
  {
    name: 'Thematix',
    to: '/solo-games/thematix',
    tag: 'Word Association',
    desc: 'Crack 6 alphabetically ordered words linked by one secret theme plus a custom builder.',
  },
  {
    name: 'Missing Rebus',
    to: '/solo-games/rebus',
    tag: '733+ Puzzles',
    desc: 'Decode typographic visual wordplay riddles, timed 5-round sprints, and printable sheets.',
  },
];

export function SeoGuideSection({ variant }: SeoGuideSectionProps) {
  const faqs =
    variant === 'interactive'
      ? INTERACTIVE_FAQS
      : variant === 'solo'
        ? SOLO_FAQS
        : HOME_FAQS;

  return (
    <section
      aria-label="Word games directory and frequently asked questions"
      className="mt-12 rounded-2xl border border-[#D4A437]/40 bg-[#1F0732]/90 text-[#F5F3F7] p-6 sm:p-8 shadow-[0_14px_34px_rgba(17,3,26,0.35)] space-y-8"
    >
      {variant === 'home' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F6C915] flex items-center gap-2 mb-2">
                <Sparkles size={14} aria-hidden="true" />
                TIKTOK GAMES &amp; FREE ONLINE WORD GAMES
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Built for TikTok LIVE Creators &amp; Daily Word Solvers
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#D6CBE2] max-w-xl leading-relaxed">
              Launch 9 interactive TikTok chat games with transparent OBS &amp; TikTok LIVE Studio
              overlays, or play 12 free solo word, crossword, and puzzle games in 7 languages right
              in your browser.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-white/10 bg-black/25 p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-[#F6C915] flex items-center gap-2">
                  <Radio size={16} aria-hidden="true" />
                  <span>Popular TikTok LIVE Interactive Games</span>
                </h3>
                <Link
                  to="/interactive-games"
                  className="text-xs font-semibold text-[#F6C915] hover:underline inline-flex items-center gap-1"
                  style={{ color: '#F6C915' }}
                >
                  All 9 Live Games <ArrowUpRight size={13} />
                </Link>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {INTERACTIVE_HIGHLIGHTS.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="block h-full rounded-lg border border-white/10 bg-[#2A0B42]/75 hover:border-[#F6C915]/60 p-3 transition-colors"
                      style={{ color: '#F5F3F7' }}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-bold text-white">
                        <span>{item.name}</span>
                        <span className="text-[10px] font-mono text-[#F6C915]">{item.tag}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-[#D6CBE2]">{item.desc}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-[#F6C915] flex items-center gap-2">
                  <Globe2 size={16} aria-hidden="true" />
                  <span>Popular Free Solo Word &amp; Crossword Games</span>
                </h3>
                <Link
                  to="/solo-games"
                  className="text-xs font-semibold text-[#F6C915] hover:underline inline-flex items-center gap-1"
                  style={{ color: '#F6C915' }}
                >
                  All 12 Solo Games <ArrowUpRight size={13} />
                </Link>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SOLO_HIGHLIGHTS.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="block h-full rounded-lg border border-white/10 bg-[#2A0B42]/75 hover:border-[#F6C915]/60 p-3 transition-colors"
                      style={{ color: '#F5F3F7' }}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-bold text-white">
                        <span>{item.name}</span>
                        <span className="text-[10px] font-mono text-[#F6C915]">{item.tag}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-[#D6CBE2]">{item.desc}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {variant === 'interactive' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-white/10 pb-6">
          <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-1.5">
            <h2 className="text-sm font-bold text-[#F6C915]">TikTok LIVE Chat &amp; Webhook Ready</h2>
            <p className="text-xs text-[#D6CBE2] leading-relaxed">
              Connect any TikTok @handle directly or bridge events from TikFinity and BetterTok
              webhooks. Test rounds anytime with the built-in stream simulator before going live.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-1.5">
            <h2 className="text-sm font-bold text-[#F6C915]">OBS &amp; LIVE Studio Overlays</h2>
            <p className="text-xs text-[#D6CBE2] leading-relaxed">
              Every interactive game ships with a clean transparent <code className="text-[#F6C915]">/overlay</code> URL
              sized for 9:16 portrait broadcasts and multi-board desktop streams.{' '}
              <Link
                to="/interactive-games/overlays"
                className="underline text-[#F6C915] font-semibold"
                style={{ color: '#F6C915' }}
              >
                View all overlays
              </Link>
              .
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-1.5">
            <h2 className="text-sm font-bold text-[#F6C915]">7 Languages &amp; Solo Practice</h2>
            <p className="text-xs text-[#D6CBE2] leading-relaxed">
              Host rounds in English, Spanish, French, German, Italian, Portuguese, or Tagalog. Want
              to warm up offline?{' '}
              <Link
                to="/solo-games"
                className="underline text-[#F6C915] font-semibold"
                style={{ color: '#F6C915' }}
              >
                Explore 12 Solo Word Games
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {variant === 'solo' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-white/10 pb-6">
          <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-1.5">
            <h2 className="text-sm font-bold text-[#F6C915]">Daily Word &amp; Crossword Archives</h2>
            <p className="text-xs text-[#D6CBE2] leading-relaxed">
              Play fresh daily boards across Unolingo (183-day archive), MP Search (368-day archive),
              Missing Rebus (733+ riddles), Squared, Thematix, and MP Colossal&apos;s 250×250 world.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-1.5">
            <h2 className="text-sm font-bold text-[#F6C915]">Multi-Session Cloud Sync</h2>
            <p className="text-xs text-[#D6CBE2] leading-relaxed">
              Sign in with Google or Email &amp; Password to keep your solved puzzles, daily streaks,
              preferred language dictionary, and public leaderboard entries across sessions.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-1.5">
            <h2 className="text-sm font-bold text-[#F6C915]">Play Live With TikTok Viewers</h2>
            <p className="text-xs text-[#D6CBE2] leading-relaxed">
              Streaming on TikTok LIVE? Launch viewer-driven editions like Word Hunt Extreme, Crowdle,
              and InkStream in the{' '}
              <Link
                to="/interactive-games"
                className="underline text-[#F6C915] font-semibold"
                style={{ color: '#F6C915' }}
              >
                TikTok Interactive Games hub
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#F6C915] flex items-center gap-2">
          <HelpCircle size={15} aria-hidden="true" />
          <span>Frequently Asked Questions</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-1.5"
            >
              <h4 className="text-xs sm:text-sm font-bold text-white">{faq.question}</h4>
              <p className="text-xs text-[#D6CBE2] leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
