export const SITE_ORIGIN = "https://missingpiecepuzzles.fun";
export const SITE_NAME = "The Missing Piece";
export const TIKTOK_OFFICIAL_URL = "https://www.tiktok.com/@MissingPiecePuzzles";
export const DEFAULT_OG_IMAGE_PATH = "/hero-image.png";

export interface RouteSeoMeta {
  canonicalPath: string;
  title: string; // Optimal 30-60 chars
  description: string; // Optimal 120-160 chars
  keywords: string;
  ogImagePath: string;
  ogImageAlt: string;
  robots: string;
  heading: string;
  summary: string;
  gameGenre?: string;
  isInteractive?: boolean;
  isSolo?: boolean;
  inLanguages?: string[];
  breadcrumbs: Array<{ name: string; path: string }>;
  faqs?: Array<{ question: string; answer: string }>;
}

const ALL_7_LANGUAGES = ["en", "es", "fr", "de", "it", "pt", "tl"];

export const HOME_FAQS: Array<{ question: string; answer: string }> = [
  {
    question: "How do TikTok LIVE interactive word games work?",
    answer:
      "Connect your TikTok LIVE stream via TikTok LIVE, TikFinity, BetterTok webhooks, or the built-in test simulator. Viewers type word guesses directly in TikTok chat and see their names, avatars, and scores update live on your stream overlay.",
  },
  {
    question: "What overlays work with TikTok LIVE Studio and OBS Studio?",
    answer:
      "Every interactive game includes a dedicated transparent /overlay URL built as a browser source for TikTok LIVE Studio and OBS Studio, supporting portrait 9:16 mobile streams and custom canvas layouts.",
  },
  {
    question: "Are the solo word games free to play in a browser?",
    answer:
      "Yes. All 12 solo word, crossword, rebus, and visual puzzles are 100% free to play directly in desktop or mobile browsers with no downloads required, and players can sign in with Google or Email to sync progress and streaks across sessions.",
  },
  {
    question: "Which languages are supported in The Missing Piece word games?",
    answer:
      "Word games including Crowdle, Word Hunt Extreme, Squared, DeStack, MP Search, Lexi Tiles, and InkStream support 7 dictionary languages: English, Spanish, French, German, Italian, Portuguese, and Filipino / Tagalog.",
  },
];

export const INTERACTIVE_FAQS: Array<{ question: string; answer: string }> = [
  {
    question: "Which TikTok interactive games can I play with my stream viewers?",
    answer:
      "Streamers can host 9 live viewer-driven games: Word Hunt Extreme, Crowdle (crowd Wordle), InkStream (draw & guess), Squared Interactive, Lexi Tiles, DeStack Interactive, MP Search Interactive, WiKirecTangled, and WikiContexto.",
  },
  {
    question: "Can viewers earn points across TikTok LIVE games?",
    answer:
      "Yes. Players can link their TikTok @username to their free Missing Piece account so scores earned during TikTok LIVE interactive streams are credited automatically to their profile.",
  },
  {
    question: "How does the 4-second TikTok LIVE stream-lag buffer work in Word Hunt Extreme?",
    answer:
      "When a viewer solves the secret word in Word Hunt Extreme, a 4-second stream-lag winner window allows simultaneous chat guesses sent during stream delay to be credited fairly.",
  },
];

export const SOLO_FAQS: Array<{ question: string; answer: string }> = [
  {
    question: "What daily word games are included in the Solo Games hub?",
    answer:
      "The Solo Games hub features 12 free browser puzzles: MP Colossal (200x200 crossword atlas), Cruciverbalist Daily Crossword, Missing Rebus (733+ puzzles), Squared, Thematix, DeStack, Unolingo, WiKirecTangled, WikiContexto, MP Search, MP Difference, and TEKSCOdle.",
  },
  {
    question: "Is my word game progress saved across sessions and devices?",
    answer:
      "Yes. Signing in with Google or Email & Password activates Firebase multi-session cloud sync so your active boards, daily streaks, preferred dictionary language, and leaderboard scores follow you across sessions.",
  },
];

const DEFAULT_ROBOTS =
  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

export const SEO_ROUTES: Record<string, RouteSeoMeta> = {
  "/": {
    canonicalPath: "/",
    title: "The Missing Piece — TikTok Interactive & Word Games",
    description:
      "Play free TikTok LIVE interactive chat games and 12 daily browser word, crossword, rebus, and puzzle games—with live stream overlays and cloud leaderboards.",
    keywords:
      "tiktok games, tiktok interactive games, tiktok live word games, word games, free online word games, daily crossword, crowd wordle, word hunt extreme, browser puzzle games",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "The Missing Piece gold controller and puzzle pieces for TikTok LIVE and word games",
    robots: DEFAULT_ROBOTS,
    heading: "TikTok Interactive Games & Free Daily Word Games",
    summary:
      "Discover 9 real-time TikTok LIVE interactive games for livestream creators and 12 free solo word, crossword, and puzzle games playable right in your browser.",
    inLanguages: ALL_7_LANGUAGES,
    breadcrumbs: [{ name: "Home", path: "/" }],
    faqs: HOME_FAQS,
  },
  "/interactive-games": {
    canonicalPath: "/interactive-games",
    title: "TikTok LIVE Interactive Word Games | The Missing Piece",
    description:
      "Launch 9 free TikTok LIVE interactive word and drawing games with transparent OBS & LIVE Studio overlays, TikFinity webhooks, and viewer scoreboards.",
    keywords:
      "tiktok interactive games, tiktok live games, games to play on tiktok live, tiktok chat word games, tiktok live studio overlays, tikfinity word games, crowdle, word hunt extreme, inkstream",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "The Missing Piece TikTok LIVE interactive word games and transparent stream overlays",
    robots: DEFAULT_ROBOTS,
    heading: "TikTok LIVE Interactive Games for Streamers & Chat",
    summary:
      "Host real-time TikTok LIVE word games, crowd Wordle battles, drawing rounds, and 3D letter-grid hunts directly with your chat audience.",
    inLanguages: ALL_7_LANGUAGES,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "TikTok Interactive Games", path: "/interactive-games" },
    ],
    faqs: INTERACTIVE_FAQS,
  },
  "/interactive-games/overlays": {
    canonicalPath: "/interactive-games/overlays",
    title: "TikTok LIVE Studio Game Overlays | The Missing Piece",
    description:
      "Configure transparent browser-source overlays for TikTok LIVE Studio and OBS across all 9 interactive word, drawing, and chat guessing games.",
    keywords:
      "tiktok live studio overlay, obs browser source word games, transparent tiktok game overlay, interactive stream overlay",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "All interactive TikTok LIVE Studio and OBS overlays from The Missing Piece",
    robots: DEFAULT_ROBOTS,
    heading: "All TikTok Interactive LIVE Overlays",
    summary:
      "Copy transparent browser-source overlay URLs for TikTok LIVE Studio and OBS Studio for every interactive word and chat game.",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "TikTok Interactive Games", path: "/interactive-games" },
      { name: "All Interactive Overlays", path: "/interactive-games/overlays" },
    ],
  },
  "/solo-games": {
    canonicalPath: "/solo-games",
    title: "Free Daily Word & Crossword Games | The Missing Piece",
    description:
      "Play 13 free daily word games, crosswords, alphabetical word hunts, visual rebuses, word searches, and price puzzles in your browser with daily streaks and cloud leaderboards.",
    keywords:
      "free word games, daily word games, online crossword puzzles, browser word games, word hunt, squared word grid, thematix, destack, unolingo, rebus puzzles, mp colossal",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "13 free solo word, crossword, and visual puzzle games on The Missing Piece",
    robots: DEFAULT_ROBOTS,
    heading: "Free Daily Solo Word, Crossword & Puzzle Games",
    summary:
      "Play 13 daily and endless browser word games including Word Hunt, 200x200 MP Colossal crossword, Squared word grids, Unolingo, Thematix, DeStack, and Missing Rebus.",
    inLanguages: ALL_7_LANGUAGES,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Solo Word Games", path: "/solo-games" },
    ],
    faqs: SOLO_FAQS,
  },
  "/interactive-games/wikirec": {
    canonicalPath: "/interactive-games/wikirec",
    title: "WiKirecTangled — TikTok LIVE Wikipedia Word Game",
    description:
      "Trace 8-connected paths across a 3D keycap board with your TikTok LIVE chat to uncover hidden Wikipedia article titles in real time.",
    keywords:
      "wikirectangled, tiktok live wikipedia game, tiktok interactive word grid, chat word search game",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "WiKirecTangled TikTok LIVE interactive Wikipedia word grid game",
    robots: DEFAULT_ROBOTS,
    heading: "WiKirecTangled — TikTok LIVE Interactive Word Grid",
    summary:
      "Trace 8-connected word paths on a 3D keycap grid with your TikTok chat to unlock Common, Rare, and Ultra tiers and solve the hidden Wikipedia title.",
    gameGenre: "Word Game",
    isInteractive: true,
    inLanguages: ["en"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "TikTok Interactive Games", path: "/interactive-games" },
      { name: "WiKirecTangled", path: "/interactive-games/wikirec" },
    ],
  },
  "/interactive-games/wikicon": {
    canonicalPath: "/interactive-games/wikicon",
    title: "WikiContexto — TikTok LIVE Chat Word Game",
    description:
      "Play WikiContexto live on TikTok! Viewers guess semantically close words in chat to unredact a hidden Wikipedia article word by word.",
    keywords:
      "wikicontexto, contexto tiktok live game, wikipedia redactle live, tiktok chat guessing game",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "WikiContexto TikTok LIVE semantic word guessing game",
    robots: DEFAULT_ROBOTS,
    heading: "WikiContexto — TikTok LIVE Article Word Discovery",
    summary:
      "Uncover a redacted Wikipedia article live with your TikTok chat audience using semantic similarity rankings and keycap word discovery.",
    gameGenre: "Word Game",
    isInteractive: true,
    inLanguages: ["en"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "TikTok Interactive Games", path: "/interactive-games" },
      { name: "WikiContexto", path: "/interactive-games/wikicon" },
    ],
  },
  "/interactive-games/squared": {
    canonicalPath: "/interactive-games/squared",
    title: "Squared Live — TikTok LIVE 4×4 Word Grid Game",
    description:
      "Host a live 4x4 word hunt on TikTok LIVE! Viewers race in chat to spot 4+ letter words, trigger !rotate and !hint, and top the stream leaderboard.",
    keywords:
      "squared interactive, tiktok live word grid, squared tiktok game, boggle tiktok live, 4x4 word hunt chat game",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "Squared Interactive TikTok LIVE 4x4 letter grid word game",
    robots: DEFAULT_ROBOTS,
    heading: "Squared Interactive — TikTok LIVE 4×4 Word Grid",
    summary:
      "Host a fast-paced 4x4 letter grid on TikTok LIVE where chat players claim words, rotate the board with !rotate, and climb the live leaderboard.",
    gameGenre: "Word Game",
    isInteractive: true,
    inLanguages: ALL_7_LANGUAGES,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "TikTok Interactive Games", path: "/interactive-games" },
      { name: "Squared Interactive", path: "/interactive-games/squared" },
    ],
  },
  "/interactive-games/lexi": {
    canonicalPath: "/interactive-games/lexi",
    title: "Lexi Tiles — TikTok LIVE Anagram Word Game",
    description:
      "Play Lexi Tiles live with TikTok chat! Assemble anagram words from dynamic letter racks, stack combo multipliers, and discover rare words in real time.",
    keywords:
      "lexi tiles, tiktok anagram game, tiktok live word tiles, live chat anagram game, scrabble style tiktok game",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "Lexi Tiles TikTok LIVE interactive anagram word game",
    robots: DEFAULT_ROBOTS,
    heading: "Lexi Tiles — TikTok LIVE Anagram Word Arena",
    summary:
      "Challenge your TikTok LIVE chat to build high-scoring anagram words from dynamic letter tiles across 7 language dictionaries.",
    gameGenre: "Word Game",
    isInteractive: true,
    inLanguages: ALL_7_LANGUAGES,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "TikTok Interactive Games", path: "/interactive-games" },
      { name: "Lexi Tiles", path: "/interactive-games/lexi" },
    ],
  },
  "/interactive-games/destack": {
    canonicalPath: "/interactive-games/destack",
    title: "DeStack Live — TikTok Chat Word Pyramid Game",
    description:
      "Unstack the 4-layer 3D word pyramid live on TikTok! Chat viewers race to find valid 5-letter words from exposed top tiles before the timer reveals.",
    keywords:
      "destack interactive, tiktok word pyramid game, 3d word stack tiktok live, 5 letter word game chat",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "DeStack Interactive 4-layer 3D word pyramid game for TikTok LIVE",
    robots: DEFAULT_ROBOTS,
    heading: "DeStack Interactive — TikTok LIVE 3D Word Pyramid",
    summary:
      "Viewers race in TikTok chat to unstack hidden 5-letter words from a layered 3D letter tower before each tile auto-reveals.",
    gameGenre: "Word Game",
    isInteractive: true,
    inLanguages: ALL_7_LANGUAGES,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "TikTok Interactive Games", path: "/interactive-games" },
      { name: "DeStack Interactive", path: "/interactive-games/destack" },
    ],
  },
  "/interactive-games/crowdle": {
    canonicalPath: "/interactive-games/crowdle",
    title: "Crowdle — TikTok LIVE Crowd Wordle Game",
    description:
      "Host crowd-voted Wordle on TikTok LIVE! Viewers vote in chat during Decision Sync to lock guesses across 5- to 8-letter words in 7 languages.",
    keywords:
      "crowdle, crowd wordle tiktok live, wordle on tiktok live, multiplayer chat wordle, tiktok interactive wordle",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "Crowdle multiplayer TikTok LIVE crowd-voted Wordle game",
    robots: DEFAULT_ROBOTS,
    heading: "Crowdle — TikTok LIVE Crowd-Voted Wordle",
    summary:
      "Bring crowd-voted 5-to-8 letter Wordle battles to TikTok LIVE with Decision Sync chat voting, Endless Chain streaks, and First-to-Find bonuses.",
    gameGenre: "Word Game",
    isInteractive: true,
    inLanguages: ALL_7_LANGUAGES,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "TikTok Interactive Games", path: "/interactive-games" },
      { name: "Crowdle", path: "/interactive-games/crowdle" },
    ],
  },
  "/interactive-games/mpsearch": {
    canonicalPath: "/interactive-games/mpsearch",
    title: "MP Search Live — TikTok LIVE Word Search Game",
    description:
      "Host a blind 10x10 word search on TikTok LIVE! Chat viewers scan the board without a word bank to spot hidden words and reach the Places 1-5 podium.",
    keywords:
      "mp search interactive, tiktok live word search, live chat word search, 10x10 word search tiktok",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "MP Search Interactive 10x10 TikTok LIVE word search game",
    robots: DEFAULT_ROBOTS,
    heading: "MP Search Interactive — TikTok LIVE 10×10 Word Search",
    summary:
      "No word bank given: TikTok viewers scan the 10x10 letter grid together to find 8 to 12 hidden words and claim podium points.",
    gameGenre: "Word Game",
    isInteractive: true,
    inLanguages: ALL_7_LANGUAGES,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "TikTok Interactive Games", path: "/interactive-games" },
      { name: "MP Search Interactive", path: "/interactive-games/mpsearch" },
    ],
  },
  "/interactive-games/inkstream": {
    canonicalPath: "/interactive-games/inkstream",
    title: "InkStream — TikTok LIVE Draw & Word Guess Game",
    description:
      "Draw live while TikTok chat races to guess the word! Features private streamer word picker, 20-player rooms, and TikFinity/BetterTok webhooks.",
    keywords:
      "inkstream, draw and guess tiktok live, pictionary tiktok live, tiktok chat drawing game, guess the drawing tiktok",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "InkStream live drawing and TikTok LIVE chat word guessing game",
    robots: DEFAULT_ROBOTS,
    heading: "InkStream — TikTok LIVE Drawing & Word Guessing Game",
    summary:
      "Draw live on screen while TikTok chat races to guess the secret word, complete with private streamer word selection and transparent LIVE overlays.",
    gameGenre: "Word & Drawing Game",
    isInteractive: true,
    inLanguages: ALL_7_LANGUAGES,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "TikTok Interactive Games", path: "/interactive-games" },
      { name: "InkStream", path: "/interactive-games/inkstream" },
    ],
  },
  "/interactive-games/mpwh": {
    canonicalPath: "/interactive-games/mpwh",
    title: "Word Hunt Extreme — TikTok LIVE Word Ladder Game",
    description:
      "Play Word Hunt Extreme live on TikTok! Pinch secret 4-8 letter words alphabetically from A to Z in Classic, Dual, or Quad modes with 4s stream-lag protection.",
    keywords:
      "word hunt extreme, tiktok word ladder game, alphabetical word guess game, tiktok live word hunt, dual ladder quad hunt",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "Word Hunt Extreme alphabetical A-Z word ladder game for TikTok LIVE",
    robots: DEFAULT_ROBOTS,
    heading: "Word Hunt Extreme — TikTok LIVE Alphabetical Word Ladder",
    summary:
      "Pinch secret words alphabetically between A and Z in Classic, Dual Ladder, and Quad Hunt modes with TikTok LIVE chat, hints, and 7 language dictionaries.",
    gameGenre: "Word Game",
    isInteractive: true,
    inLanguages: ALL_7_LANGUAGES,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "TikTok Interactive Games", path: "/interactive-games" },
      { name: "Word Hunt Extreme", path: "/interactive-games/mpwh" },
    ],
  },
  "/interactive-games/wbr": {
    canonicalPath: "/interactive-games/wbr",
    title: "Word Bomb Royale — TikTok LIVE Physics Word Elimination Game",
    description:
      "Host Word Bomb Royale live on TikTok! Viewers drop physics avatars into the arena and race to type unique words matching escalating wave rules before the bomb fuse detonates.",
    keywords:
      "word bomb royale, tiktok live word game, interactive word elimination, tiktok chat game, physics avatar word battle",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "Word Bomb Royale 9:16 TikTok LIVE physics word elimination game show",
    robots: DEFAULT_ROBOTS,
    heading: "Word Bomb Royale — TikTok LIVE Word Elimination Arena",
    summary:
      "9:16 vertical interactive TikTok LIVE word elimination game show with real-time 2D physics avatars, escalating wave rules, cosmetics, bot simulator, and live chat bridge.",
    gameGenre: "Word Game",
    isInteractive: true,
    inLanguages: ["en"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "TikTok Interactive Games", path: "/interactive-games" },
      { name: "Word Bomb Royale", path: "/interactive-games/wbr" },
    ],
  },
  "/interactive-games/tow": {
    canonicalPath: "/interactive-games/tow",
    title: "Tug of Words — TikTok LIVE Red vs Blue Territory Word War",
    description:
      "Host Tug of Words live on TikTok! Viewers auto-balance into Team Red vs Team Blue and fire validated words to push the laser horizon border, claim power-up orbs, activate shields, and win 60-second territory wars.",
    keywords:
      "tug of words, tiktok live word game, red vs blue chat game, territory word war, tiktok interactive stream game",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "Tug of Words 9:16 TikTok LIVE Team Red vs Team Blue territory word battle",
    robots: DEFAULT_ROBOTS,
    heading: "Tug of Words — TikTok LIVE Territory Word War",
    summary:
      "9:16 vertical TikTok LIVE team tug-of-war word battle with 10,000+ validated words, 60-second 3-phase Overdrive matches, shields, Golden Bounties, battlefield power-up orbs, and Top 3 MVPs.",
    gameGenre: "Word Game",
    isInteractive: true,
    inLanguages: ["en"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "TikTok Interactive Games", path: "/interactive-games" },
      { name: "Tug of Words", path: "/interactive-games/tow" },
    ],
  },
  "/solo-games/mpcolossal": {
    canonicalPath: "/solo-games/mpcolossal",
    title: "MP Colossal — 200×200 Giant Crossword Word Game",
    description:
      "Explore a free 40,000-square 200x200 giant crossword atlas across 25 themed sectors with Expedition Quests, Radar minimap, 3-tier hints, and Stream Layout.",
    keywords:
      "mp colossal, 200x200 giant crossword, massive online crossword, free browser crossword game, cryptic crossword atlas",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "MP Colossal 200x200 giant crossword atlas game",
    robots: DEFAULT_ROBOTS,
    heading: "MP Colossal — 200×200 Giant Crossword Atlas",
    summary:
      "Solve over 4,100 clues across a 200x200 pan-and-zoom crossword world featuring 25 themed sectors, Expedition Quests, and cloud progress saving.",
    gameGenre: "Crossword & Word Game",
    isSolo: true,
    inLanguages: ["en"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Solo Word Games", path: "/solo-games" },
      { name: "MP Colossal", path: "/solo-games/mpcolossal" },
    ],
  },
  "/solo-games/rebus": {
    canonicalPath: "/solo-games/rebus",
    title: "Missing Rebus — 733+ Visual Wordplay Puzzles",
    description:
      "Decode 733+ free visual rebus wordplay puzzles, word picture riddles, printable grid worksheets, and timed 5-round sprint mode right in your browser.",
    keywords:
      "rebus puzzles online, visual word puzzles, picture word riddles, free rebus game, dingbat puzzles",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "Missing Rebus visual wordplay puzzle archive",
    robots: DEFAULT_ROBOTS,
    heading: "Missing Rebus — 733+ Visual Wordplay Challenges",
    summary:
      "Crack over 733 typographic and visual rebus puzzles, compete in 5-round timed sprints, and save solved progress across sessions.",
    gameGenre: "Wordplay & Rebus Game",
    isSolo: true,
    inLanguages: ["en"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Solo Word Games", path: "/solo-games" },
      { name: "Missing Rebus", path: "/solo-games/rebus" },
    ],
  },
  "/solo-games/squared": {
    canonicalPath: "/solo-games/squared",
    title: "Squared — Free Daily 3×3 to 5×5 Word Grid Game",
    description:
      "Swipe or type words across daily 3x3, 4x4, and 5x5 letter grids in 7 languages! Rotate the board, discover bonus words, and keep your daily streak alive.",
    keywords:
      "squared word game, daily word grid game, free boggle style word game, 4x4 word puzzle, multilingual word grid",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "Squared daily 3x3, 4x4, and 5x5 letter grid word game",
    robots: DEFAULT_ROBOTS,
    heading: "Squared — Daily 3×3, 4×4 & 5×5 Word Grid Game",
    summary:
      "Play daily 3x3, 4x4, and 5x5 word grid puzzles in 7 languages with smooth 90-degree board rotation, bonus words, and cloud leaderboards.",
    gameGenre: "Word Game",
    isSolo: true,
    inLanguages: ALL_7_LANGUAGES,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Solo Word Games", path: "/solo-games" },
      { name: "Squared", path: "/solo-games/squared" },
    ],
  },
  "/solo-games/thematix": {
    canonicalPath: "/solo-games/thematix",
    title: "Thematix — Daily Theme Word Association Game",
    description:
      "Solve 6 alphabetically ordered words tied to one secret theme in Thematix! Play today's puzzle, explore the daily archive, or build custom word themes.",
    keywords:
      "thematix, word association game online, daily theme word puzzle, alphabetical word clue game",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "Thematix daily alphabetical word association puzzle",
    robots: DEFAULT_ROBOTS,
    heading: "Thematix — Daily Word Association Game",
    summary:
      "Deduce the hidden category and six alphabetically sorted words using letter guesses, keyboard solves, and custom puzzle challenges.",
    gameGenre: "Word Game",
    isSolo: true,
    inLanguages: ["en"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Solo Word Games", path: "/solo-games" },
      { name: "Thematix", path: "/solo-games/thematix" },
    ],
  },
  "/solo-games/destack": {
    canonicalPath: "/solo-games/destack",
    title: "DeStack — Free 3D Word Unstacking Puzzle Game",
    description:
      "Unstack 3D 4-layer and 6-layer letter towers by spotting 5-letter words from exposed top tiles in DeStack. Supports Standard, Hard, and 7 languages.",
    keywords:
      "destack word game, 3d word unstacking game, 5 letter word tower puzzle, daily word stack game",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "DeStack 3D layered word unstacking puzzle",
    robots: DEFAULT_ROBOTS,
    heading: "DeStack — 3D Layered Word Unstacking Game",
    summary:
      "Peel away layered 5-letter words layer by layer across daily Standard and 6-layer Hard towers in 7 dictionary languages.",
    gameGenre: "Word Game",
    isSolo: true,
    inLanguages: ALL_7_LANGUAGES,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Solo Word Games", path: "/solo-games" },
      { name: "DeStack", path: "/solo-games/destack" },
    ],
  },
  "/solo-games/unolingo": {
    canonicalPath: "/solo-games/unolingo",
    title: "Unolingo — Free 26-Letter Zero-Clue Crossword",
    description:
      "Solve a 10x10 zero-clue crossword using all 26 letters A-Z exactly once! Play today's London daily puzzle or browse the 183-day archive for free.",
    keywords:
      "unolingo, zero clue crossword, 26 letter crossword puzzle, daily logic word game, free online unolingo",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "Unolingo 10x10 26-letter zero-clue crossword puzzle",
    robots: DEFAULT_ROBOTS,
    heading: "Unolingo — 26-Letter Zero-Clue Crossword",
    summary:
      "Place each letter A–Z exactly once into a 10x10 interlocking word grid without traditional clues across a 183-day daily puzzle archive.",
    gameGenre: "Crossword & Word Game",
    isSolo: true,
    inLanguages: ["en"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Solo Word Games", path: "/solo-games" },
      { name: "Unolingo", path: "/solo-games/unolingo" },
    ],
  },
  "/solo-games/wikirec": {
    canonicalPath: "/solo-games/wikirec",
    title: "WiKirecTangled — Free Wikipedia Word Grid Game",
    description:
      "Trace connected paths across a 3D keycap board in WiKirecTangled Solo to find Common, Rare, and Ultra words and reveal the mystery Wikipedia article.",
    keywords:
      "wikirectangled solo, wikipedia word grid game, 3d keycap word game, daily trivia word puzzle",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "WiKirecTangled solo Wikipedia word grid puzzle",
    robots: DEFAULT_ROBOTS,
    heading: "WiKirecTangled — Solo Wikipedia Word Grid",
    summary:
      "Play daily, endless practice, or 4x4 Blitz Wikipedia word-grid challenges in your browser with synced solo leaderboards.",
    gameGenre: "Word & Trivia Game",
    isSolo: true,
    inLanguages: ["en"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Solo Word Games", path: "/solo-games" },
      { name: "WiKirecTangled", path: "/solo-games/wikirec" },
    ],
  },
  "/solo-games/wikicon": {
    canonicalPath: "/solo-games/wikicon",
    title: "WikiContexto — Daily Semantic Word Puzzle Game",
    description:
      "Reveal a redacted Wikipedia article using semantic closeness rankings and word-grid discovery in WikiContexto Solo. Free daily and endless browser modes.",
    keywords:
      "wikicontexto solo, redactle style game, semantic word guessing game, daily wikipedia puzzle",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "WikiContexto solo semantic Wikipedia article word puzzle",
    robots: DEFAULT_ROBOTS,
    heading: "WikiContexto — Solo Semantic Article Discovery",
    summary:
      "Guess words by semantic similarity to unredact mystery Wikipedia articles in Daily and Endless solo browser modes.",
    gameGenre: "Word & Trivia Game",
    isSolo: true,
    inLanguages: ["en"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Solo Word Games", path: "/solo-games" },
      { name: "WikiContexto", path: "/solo-games/wikicon" },
    ],
  },
  "/solo-games/mpsearch": {
    canonicalPath: "/solo-games/mpsearch",
    title: "MP Search — Free Daily 10×10 Word Search Game",
    description:
      "Play tactile 10x10 letterpress word searches across a 368-day daily archive in 7 languages! Spot hidden theme words and track streaks with cloud saves.",
    keywords:
      "mp search, free daily word search, online 10x10 word search, 368 day word search archive, multilingual word search",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "MP Search daily 10x10 letterpress word search puzzle",
    robots: DEFAULT_ROBOTS,
    heading: "MP Search — Daily 10×10 Word Search Game",
    summary:
      "Find hidden theme words in a tactile 10x10 letterpress grid across 368 daily puzzles and 7 selectable language dictionaries.",
    gameGenre: "Word Search Game",
    isSolo: true,
    inLanguages: ALL_7_LANGUAGES,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Solo Word Games", path: "/solo-games" },
      { name: "MP Search", path: "/solo-games/mpsearch" },
    ],
  },
  "/solo-games/mpdifference": {
    canonicalPath: "/solo-games/mpdifference",
    title: "MP Difference — Free Daily Spot the Difference",
    description:
      "Compare paired illustrated plates under a 2.2x optical loupe in MP Difference. Explore 8 themed worlds and a 6-month daily archive with cloud leaderboards.",
    keywords:
      "mp difference, spot the difference online free, daily visual puzzle game, optical loupe spot the difference",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "MP Difference twin-plate spot the difference visual puzzle game",
    robots: DEFAULT_ROBOTS,
    heading: "MP Difference — Daily Spot the Difference",
    summary:
      "Inspect crisp illustrated twin plates with a 2.2x optical loupe across 8 worlds and a 6-month daily puzzle archive.",
    gameGenre: "Visual Puzzle Game",
    isSolo: true,
    inLanguages: ["en"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Solo Word Games", path: "/solo-games" },
      { name: "MP Difference", path: "/solo-games/mpdifference" },
    ],
  },
  "/solo-games/tekscodle": {
    canonicalPath: "/solo-games/tekscodle",
    title: "TEKSCOdle — Free UK Supermarket Price Guessing Game",
    description:
      "Guess real UK supermarket prices across 1-item, 3-item, and 5-item baskets in TEKSCOdle—featuring Daily Basket, Endless Practice, and Quick Play modes.",
    keywords:
      "tekscodle, uk supermarket price guesser, grocery price guessing game, daily basket game, pricele uk",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "TEKSCOdle UK supermarket basket price guessing game",
    robots: DEFAULT_ROBOTS,
    heading: "TEKSCOdle — UK Supermarket Price Guesser",
    summary:
      "Test your UK grocery pricing instincts across 3-round Daily Basket, Endless Practice, and Quick Play supermarket checkout modes.",
    gameGenre: "Trivia & Price Guessing Game",
    isSolo: true,
    inLanguages: ["en"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Solo Word Games", path: "/solo-games" },
      { name: "TEKSCOdle", path: "/solo-games/tekscodle" },
    ],
  },
  "/solo-games/wordhunt": {
    canonicalPath: "/solo-games/wordhunt",
    title: "Word Hunt — Free Solo Alphabetical Word Ladder Game",
    description:
      "Play solo Word Hunt in Classic (1 word), Dual (2 words), and Quad (4 boards) modes. Narrow the A–Z alphabetical ladder using any dictionary word across 7 languages.",
    keywords:
      "word hunt solo, alphabetical word ladder game, binary search word game, daily word hunt, quad word hunt, free browser word puzzle",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "Word Hunt solo alphabetical word ladder puzzle game",
    robots: DEFAULT_ROBOTS,
    heading: "Word Hunt — Solo Alphabetical Word Ladder",
    summary:
      "Crack hidden 4–8 letter words by narrowing the alphabetical bracket above and below across Classic, Dual, and Quad solo modes in 7 languages.",
    gameGenre: "Word Game",
    isSolo: true,
    inLanguages: ALL_7_LANGUAGES,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Solo Word Games", path: "/solo-games" },
      { name: "Word Hunt", path: "/solo-games/wordhunt" },
    ],
  },
  "/solo-games/goingdeep": {
    canonicalPath: "/solo-games/goingdeep",
    title: "Going Deep — Free 4-in-1 Layered Daily Word Puzzle",
    description:
      "Unlock hidden board words via LetterLock, Anagram, Mini Crossword, and Word Search mini-games to solve four thematic layers in Going Deep across Standard, Hard, and Expert modes.",
    keywords:
      "going deep puzzle, layered connections game, 4-in-1 daily word game, letterlock anagram crossword wordsearch, free browser word puzzle",
    ogImagePath: DEFAULT_OG_IMAGE_PATH,
    ogImageAlt: "Going Deep 4-in-1 layered daily word puzzle game",
    robots: DEFAULT_ROBOTS,
    heading: "Going Deep — 4-in-1 Layered Word Puzzle",
    summary:
      "Solve LetterLock, Anagram, Mini Crossword, and Word Search key puzzles to uncover hidden tiles and sort a 16-word board into four thematic layers.",
    gameGenre: "Word & Puzzle Game",
    isSolo: true,
    inLanguages: ["en"],
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Solo Word Games", path: "/solo-games" },
      { name: "Going Deep", path: "/solo-games/goingdeep" },
    ],
  },
};

const ALIAS_TO_CANONICAL: Record<string, string> = {
  "/interactive-games/squaredint": "/interactive-games/squared",
  "/interactive-games/destackint": "/interactive-games/destack",
  "/interactive-games/mpsearchint": "/interactive-games/mpsearch",
};

export function normalizePathname(rawPath: string): string {
  const clean = (rawPath || "/").split("?")[0].split("#")[0].replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

export function resolveSeoForPath(rawPath: string, origin = SITE_ORIGIN): RouteSeoMeta {
  const normalized = normalizePathname(rawPath);
  void origin;

  // Handle transparent /overlay browser-source URLs (must be noindex)
  if (normalized.endsWith("/overlay")) {
    const basePath = normalized.slice(0, -"/overlay".length) || "/interactive-games";
    const canonicalBase = ALIAS_TO_CANONICAL[basePath] || basePath;
    const parentMeta = SEO_ROUTES[canonicalBase] || SEO_ROUTES["/interactive-games"];
    return {
      ...parentMeta,
      canonicalPath: `${canonicalBase}/overlay`,
      title: `${parentMeta.heading.split("—")[0].trim()} Overlay | The Missing Piece`,
      description: `Transparent TikTok LIVE Studio and OBS browser-source overlay for ${parentMeta.heading}.`,
      robots: "noindex, nofollow",
      breadcrumbs: [
        ...parentMeta.breadcrumbs,
        { name: "LIVE Overlay", path: `${canonicalBase}/overlay` },
      ],
    };
  }

  const mappedPath = ALIAS_TO_CANONICAL[normalized] || normalized;
  return SEO_ROUTES[mappedPath] || SEO_ROUTES["/"];
}

export function buildStructuredData(meta: RouteSeoMeta, origin = SITE_ORIGIN): Record<string, unknown> {
  const canonicalUrl = `${origin}${meta.canonicalPath}`;
  const imageUrl = `${origin}${meta.ogImagePath}`;

  const graph: Array<Record<string, unknown>> = [
    {
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: SITE_NAME,
      url: origin,
      logo: {
        "@type": "ImageObject",
        url: `${origin}/brand-logo.png`,
      },
      sameAs: [TIKTOK_OFFICIAL_URL, "https://thegorillashack.co.uk/"],
    },
    {
      "@type": "WebSite",
      "@id": `${origin}/#website`,
      name: SITE_NAME,
      url: origin,
      publisher: { "@id": `${origin}/#organization` },
      description:
        "Free TikTok LIVE interactive word and drawing games plus 12 daily solo word, crossword, and puzzle games.",
      inLanguage: ALL_7_LANGUAGES,
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: meta.breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: `${origin}${crumb.path}`,
      })),
    },
  ];

  if (meta.canonicalPath === "/") {
    graph.push({
      "@type": "WebApplication",
      name: "The Missing Piece — TikTok Interactive & Word Games",
      url: origin,
      applicationCategory: "GameApplication",
      operatingSystem: "All",
      browserRequirements: "Requires JavaScript",
      description: meta.description,
      image: imageUrl,
      inLanguage: ALL_7_LANGUAGES,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    });
    graph.push({
      "@type": "ItemList",
      name: "TikTok Interactive Games & Daily Word Games",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Word Hunt Extreme (TikTok LIVE)", url: `${origin}/interactive-games/mpwh` },
        { "@type": "ListItem", position: 2, name: "Crowdle — Crowd Wordle (TikTok LIVE)", url: `${origin}/interactive-games/crowdle` },
        { "@type": "ListItem", position: 3, name: "InkStream — Draw & Guess (TikTok LIVE)", url: `${origin}/interactive-games/inkstream` },
        { "@type": "ListItem", position: 4, name: "Squared Interactive (TikTok LIVE)", url: `${origin}/interactive-games/squared` },
        { "@type": "ListItem", position: 5, name: "Lexi Tiles (TikTok LIVE)", url: `${origin}/interactive-games/lexi` },
        { "@type": "ListItem", position: 6, name: "MP Colossal 200x200 Crossword", url: `${origin}/solo-games/mpcolossal` },
        { "@type": "ListItem", position: 7, name: "Squared Daily Word Grid", url: `${origin}/solo-games/squared` },
        { "@type": "ListItem", position: 8, name: "Unolingo 26-Letter Crossword", url: `${origin}/solo-games/unolingo` },
        { "@type": "ListItem", position: 9, name: "Thematix Word Association", url: `${origin}/solo-games/thematix` },
        { "@type": "ListItem", position: 10, name: "DeStack 3D Word Tower", url: `${origin}/solo-games/destack` },
      ],
    });
  } else if (meta.canonicalPath === "/interactive-games") {
    graph.push({
      "@type": "CollectionPage",
      name: meta.title,
      url: canonicalUrl,
      description: meta.description,
      mainEntity: {
        "@type": "ItemList",
        name: "TikTok LIVE Interactive Word & Chat Games",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "WiKirecTangled Live", url: `${origin}/interactive-games/wikirec` },
          { "@type": "ListItem", position: 2, name: "WikiContexto Live", url: `${origin}/interactive-games/wikicon` },
          { "@type": "ListItem", position: 3, name: "Squared Interactive", url: `${origin}/interactive-games/squared` },
          { "@type": "ListItem", position: 4, name: "Lexi Tiles", url: `${origin}/interactive-games/lexi` },
          { "@type": "ListItem", position: 5, name: "DeStack Interactive", url: `${origin}/interactive-games/destack` },
          { "@type": "ListItem", position: 6, name: "Crowdle", url: `${origin}/interactive-games/crowdle` },
          { "@type": "ListItem", position: 7, name: "MP Search Interactive", url: `${origin}/interactive-games/mpsearch` },
          { "@type": "ListItem", position: 8, name: "InkStream", url: `${origin}/interactive-games/inkstream` },
          { "@type": "ListItem", position: 9, name: "Word Hunt Extreme", url: `${origin}/interactive-games/mpwh` },
          { "@type": "ListItem", position: 10, name: "Word Bomb Royale", url: `${origin}/interactive-games/wbr` },
          { "@type": "ListItem", position: 11, name: "Tug of Words", url: `${origin}/interactive-games/tow` },
        ],
      },
    });
  } else if (meta.canonicalPath === "/solo-games") {
    graph.push({
      "@type": "CollectionPage",
      name: meta.title,
      url: canonicalUrl,
      description: meta.description,
      mainEntity: {
        "@type": "ItemList",
        name: "Free Solo Word & Crossword Browser Games",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "MP Colossal 200x200 Crossword", url: `${origin}/solo-games/mpcolossal` },
          { "@type": "ListItem", position: 2, name: "Missing Rebus", url: `${origin}/solo-games/rebus` },
          { "@type": "ListItem", position: 3, name: "Squared Word Grid", url: `${origin}/solo-games/squared` },
          { "@type": "ListItem", position: 4, name: "Thematix Word Association", url: `${origin}/solo-games/thematix` },
          { "@type": "ListItem", position: 5, name: "DeStack 3D Word Tower", url: `${origin}/solo-games/destack` },
          { "@type": "ListItem", position: 6, name: "Unolingo 26-Letter Crossword", url: `${origin}/solo-games/unolingo` },
          { "@type": "ListItem", position: 7, name: "WiKirecTangled Solo", url: `${origin}/solo-games/wikirec` },
          { "@type": "ListItem", position: 8, name: "WikiContexto Solo", url: `${origin}/solo-games/wikicon` },
          { "@type": "ListItem", position: 9, name: "MP Search Word Search", url: `${origin}/solo-games/mpsearch` },
          { "@type": "ListItem", position: 10, name: "MP Difference", url: `${origin}/solo-games/mpdifference` },
          { "@type": "ListItem", position: 11, name: "TEKSCOdle", url: `${origin}/solo-games/tekscodle` },
          { "@type": "ListItem", position: 12, name: "Word Hunt", url: `${origin}/solo-games/wordhunt` },
          { "@type": "ListItem", position: 13, name: "Going Deep", url: `${origin}/solo-games/goingdeep` },
        ],
      },
    });
  } else if (meta.gameGenre) {
    graph.push({
      "@type": "VideoGame",
      name: meta.heading,
      url: canonicalUrl,
      description: meta.description,
      genre: meta.gameGenre,
      gamePlatform: ["Web Browser", "Desktop", "Mobile Web", ...(meta.isInteractive ? ["TikTok LIVE Studio", "OBS Studio"] : [])],
      applicationCategory: "Game",
      operatingSystem: "Any",
      playMode: meta.isInteractive ? ["MultiPlayer", "CoOp", "SinglePlayer"] : "SinglePlayer",
      inLanguage: meta.inLanguages || ["en"],
      image: imageUrl,
      publisher: { "@id": `${origin}/#organization` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    });
  }

  if (meta.faqs && meta.faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: meta.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderSeoHeadHtml(rawPath: string, origin = SITE_ORIGIN): string {
  const meta = resolveSeoForPath(rawPath, origin);
  const canonicalUrl = `${origin}${meta.canonicalPath}`;
  const ogImageUrl = `${origin}${meta.ogImagePath}`;
  const jsonLdStr = JSON.stringify(buildStructuredData(meta, origin));

  return [
    `<meta name="robots" content="${escapeHtmlAttr(meta.robots)}" />`,
    `<title>${escapeHtmlText(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtmlAttr(meta.description)}" />`,
    `<meta name="keywords" content="${escapeHtmlAttr(meta.keywords)}" />`,
    `<meta name="theme-color" content="#160524" />`,
    `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`,
    `<link rel="sitemap" type="application/xml" title="Sitemap" href="${origin}/sitemap.xml" />`,
    `<link rel="alternate" type="text/plain" title="LLM Discovery Guide" href="${origin}/llms.txt" />`,
    `<meta property="og:site_name" content="${escapeHtmlAttr(SITE_NAME)}" />`,
    `<meta property="og:title" content="${escapeHtmlAttr(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttr(meta.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttr(ogImageUrl)}" />`,
    `<meta property="og:image:width" content="1472" />`,
    `<meta property="og:image:height" content="640" />`,
    `<meta property="og:image:alt" content="${escapeHtmlAttr(meta.ogImageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(ogImageUrl)}" />`,
    `<script id="mp-route-jsonld" type="application/ld+json">${jsonLdStr}</script>`,
  ].join("\n    ");
}

export function renderSeoNoscriptHtml(rawPath: string, origin = SITE_ORIGIN): string {
  const meta = resolveSeoForPath(rawPath, origin);
  return `<main>
          <h1>${escapeHtmlText(meta.heading)}</h1>
          <p>${escapeHtmlText(meta.summary)}</p>
          <ul>
            <li><a href="${origin}/interactive-games">TikTok LIVE Interactive Games (9 Live Chat Games)</a></li>
            <li><a href="${origin}/interactive-games/mpwh">Word Hunt Extreme — TikTok LIVE Word Ladder</a></li>
            <li><a href="${origin}/interactive-games/crowdle">Crowdle — TikTok LIVE Crowd Wordle</a></li>
            <li><a href="${origin}/interactive-games/inkstream">InkStream — TikTok LIVE Draw &amp; Guess</a></li>
            <li><a href="${origin}/solo-games">Solo Word &amp; Crossword Games Hub (12 Games)</a></li>
            <li><a href="${origin}/solo-games/mpcolossal">MP Colossal — 200x200 Giant Crossword Atlas</a></li>
            <li><a href="${origin}/solo-games/squared">Squared — Daily Word Grid</a></li>
            <li><a href="${origin}/solo-games/unolingo">Unolingo — 26-Letter Crossword</a></li>
          </ul>
        </main>`;
}
