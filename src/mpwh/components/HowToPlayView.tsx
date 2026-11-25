import { ArrowDown, ArrowUp, Clock, Globe, Lightbulb, Radio, Sparkles } from 'lucide-react';

export function HowToPlayView() {
  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      <div className="rounded-2xl border border-[#D7C4EC] dark:border-[#D4A437]/35 bg-white/95 dark:bg-[#210736]/95 p-6 sm:p-8 shadow-xl">
        <p className="text-xs font-extrabold uppercase tracking-widest text-[#8F6500] dark:text-[#F6C915]">
          The Missing Piece · Word Hunt Extreme Rules
        </p>
        <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-[#2B0938] dark:text-white">
          Pinch the Secret Word Alphabetically
        </h2>
        <p className="mt-2.5 text-sm sm:text-base text-[#5C3A78] dark:text-[#E2D4F4] leading-relaxed">
          Every secret word is chosen from the 500 most common 4–8 letter words
          hidden between <strong className="text-[#2B0938] dark:text-white">A</strong> and{' '}
          <strong className="text-[#2B0938] dark:text-white">Z</strong>. Type any full-dictionary
          word of any length—or let your TikTok LIVE chat guess together—and
          watch the ladder tighten around the answer.
        </p>

        {/* Example Ladder Illustration */}
        <div className="mt-6 rounded-xl border border-[#D7C4EC] dark:border-[#D4A437]/30 bg-[#F8F3FD] dark:bg-[#140321] p-4 sm:p-5 space-y-2.5 max-w-md mx-auto">
          <div className="flex items-center justify-between rounded-lg border border-[#D7C4EC] dark:border-[#D4A437]/35 bg-white dark:bg-[#24093D] px-3.5 py-2.5 text-sm">
            <span className="inline-flex items-center gap-2 font-mono font-extrabold tracking-widest text-[#2B0938] dark:text-white">
              <ArrowDown className="h-4 w-4 text-[#A57A10] dark:text-[#D4A437]" aria-hidden="true" />
              CARGO
            </span>
            <span className="text-[11px] font-semibold text-[#6B4A8A] dark:text-[#C8B2E4]">
              Closest Above
            </span>
          </div>

          <div className="rounded-xl border border-[#C99A14]/60 dark:border-[#F6C915]/55 bg-[#F3EAFC] dark:bg-[#0C0216] px-3.5 py-3 text-center">
            <div className="flex items-center justify-center gap-1.5">
              {['C', 'A', 'R', '?', '?', '?'].map((ch, idx) => (
                <span
                  key={idx}
                  className={`inline-flex h-10 w-8 items-center justify-center rounded-lg font-black text-base ${
                    ch !== '?'
                      ? 'bg-gradient-to-b from-[#FFEA7A] to-[#F6C915] border-2 border-[#C99A14] dark:border-[#FFF6C2] border-b-4 border-b-[#9E6B0C] text-[#1D0830]'
                      : 'bg-gradient-to-b from-white to-[#EFE6FA] dark:from-[#F2EAFF] dark:to-[#D5C0F4] border-2 border-[#C8AEDF] dark:border-white/90 border-b-4 border-b-[#B89BD4] dark:border-b-[#7A56A8] text-[#5C3A78] dark:text-[#3A1658]'
                  }`}
                >
                  {ch}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] font-semibold text-[#8F6500] dark:text-[#F6C915]">
              Shared prefix &ldquo;CAR&rdquo; auto-fills automatically!
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[#D7C4EC] dark:border-[#D4A437]/35 bg-white dark:bg-[#24093D] px-3.5 py-2.5 text-sm">
            <span className="inline-flex items-center gap-2 font-mono font-extrabold tracking-widest text-[#2B0938] dark:text-white">
              <ArrowUp className="h-4 w-4 text-[#A57A10] dark:text-[#D4A437]" aria-hidden="true" />
              CARROT
            </span>
            <span className="text-[11px] font-semibold text-[#6B4A8A] dark:text-[#C8B2E4]">
              Closest Below
            </span>
          </div>
        </div>
      </div>

      {/* Key Mechanics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[#D7C4EC] dark:border-[#D4A437]/30 bg-white/95 dark:bg-[#210736]/90 p-5 space-y-2">
          <div className="flex items-center gap-2 text-[#8F6500] dark:text-[#F6C915] font-extrabold text-sm">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>Silent Stream-Lag Protection</span>
          </div>
          <p className="text-sm text-[#5C3A78] dark:text-[#D9C7EE] leading-relaxed">
            When the first player nails the secret word, the game silently waits
            4 seconds behind the scenes so delayed TikTok LIVE viewers submitting
            the exact word are collected fairly before revealing the word and all
            winners together.
          </p>
        </div>

        <div className="rounded-2xl border border-[#D7C4EC] dark:border-[#D4A437]/30 bg-white/95 dark:bg-[#210736]/90 p-5 space-y-2">
          <div className="flex items-center gap-2 text-[#8F6500] dark:text-[#F6C915] font-extrabold text-sm">
            <Radio className="h-4 w-4" aria-hidden="true" />
            <span>TikTok LIVE &amp; Webhooks</span>
          </div>
          <p className="text-sm text-[#5C3A78] dark:text-[#D9C7EE] leading-relaxed">
            Connect directly to your TikTok LIVE stream, plug in TikFinity or
            BetterTok webhooks, or test with the built-in Simulator. Any
            valid single word in chat (or <code>!guess word</code>) of any
            length counts immediately.
          </p>
        </div>

        <div className="rounded-2xl border border-[#D7C4EC] dark:border-[#D4A437]/30 bg-white/95 dark:bg-[#210736]/90 p-5 space-y-2">
          <div className="flex items-center gap-2 text-[#8F6500] dark:text-[#F6C915] font-extrabold text-sm">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>Bisect Hint &amp; Letter Clue</span>
          </div>
          <p className="text-sm text-[#5C3A78] dark:text-[#D9C7EE] leading-relaxed">
            Stuck in a tight bracket? Click{' '}
            <strong className="text-[#2B0938] dark:text-white">Hint</strong> to place a smart word
            halfway closer to the secret word, or{' '}
            <strong className="text-[#2B0938] dark:text-white">Clue</strong>{' '}
            <Lightbulb className="inline h-3.5 w-3.5 text-[#8F6500] dark:text-[#F6C915]" /> to
            reveal starting letters directly in the 3D tiles.
          </p>
        </div>

        <div className="rounded-2xl border border-[#D7C4EC] dark:border-[#D4A437]/30 bg-white/95 dark:bg-[#210736]/90 p-5 space-y-2">
          <div className="flex items-center gap-2 text-[#8F6500] dark:text-[#F6C915] font-extrabold text-sm">
            <Globe className="h-4 w-4" aria-hidden="true" />
            <span>3 Modes &amp; 7 Languages</span>
          </div>
          <p className="text-sm text-[#5C3A78] dark:text-[#D9C7EE] leading-relaxed">
            Play <strong className="text-[#2B0938] dark:text-white">Classic</strong> (1 word),{' '}
            <strong className="text-[#2B0938] dark:text-white">Dual Ladder</strong> (2 words on one
            ladder), or <strong className="text-[#2B0938] dark:text-white">Quad Hunt</strong> (4
            boards at once) in English, Spanish, French, German, Italian,
            Portuguese, or Filipino / Tagalog.
          </p>
        </div>
      </div>
    </section>
  );
}
