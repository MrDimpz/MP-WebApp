import { TierId } from '../types';

export interface WordEntry {
  word: string;
  clue: string;
  hardClue: string;
}

export interface CategoryBankEntry {
  id: string;
  tier: TierId;
  complexity: 1 | 2 | 3; // 1 = standard-friendly, 2 = medium-hard, 3 = devious/expert
  title: string;
  words: [WordEntry, WordEntry, WordEntry, WordEntry];
}

/**
 * 48 curated, tightly-edited categories (12 per tier: Amber, Moss, Surf, Void).
 * Every word is clean A–Z (4–9 letters) with both standard and harder clues
 * so any 1, 2, or 3 words per category can serve as a mini-game key.
 */
export const CATEGORY_BANK: CategoryBankEntry[] = [
  // ==================== AMBER (12) ====================
  {
    id: 'amber-book-parts',
    tier: 'amber',
    complexity: 1,
    title: 'Parts of a Book',
    words: [
      { word: 'SPINE', clue: 'The bound backbone along a book’s edge', hardClue: 'Vertebral ridge or jacket hinge' },
      { word: 'INDEX', clue: 'Alphabetical back-of-book guide', hardClue: 'Reference roster after the final page' },
      { word: 'COVER', clue: 'Protective outer jacket of a volume', hardClue: 'What you shouldn’t judge a work by' },
      { word: 'MARGIN', clue: 'Blank border framing printed text', hardClue: 'Narrow white frame for notes' },
    ],
  },
  {
    id: 'amber-coffee-drinks',
    tier: 'amber',
    complexity: 1,
    title: 'Coffee Drinks',
    words: [
      { word: 'MOCHA', clue: 'Chocolate-infused espresso drink', hardClue: 'Yemeni port lending its name to a roast' },
      { word: 'LATTE', clue: 'Espresso topped with steamed milk', hardClue: 'Italian word for milk, ordered hot' },
      { word: 'BREVE', clue: 'Espresso made with half-and-half', hardClue: 'Short café pour rich with cream' },
      { word: 'CORTADO', clue: 'Equal parts espresso and warm milk', hardClue: 'Spanish "cut" café serving' },
    ],
  },
  {
    id: 'amber-citrus-fruits',
    tier: 'amber',
    complexity: 1,
    title: 'Citrus Fruits',
    words: [
      { word: 'LEMON', clue: 'Bright yellow tart fruit prized for zest', hardClue: 'Sour orchard staple or dud purchase' },
      { word: 'POMELO', clue: 'Large sweet ancestor of grapefruit', hardClue: 'Thick-rinded giant of the orchard' },
      { word: 'KUMQUAT', clue: 'Tiny oval citrus eaten whole with peel', hardClue: 'Bite-sized fruit with sweet skin' },
      { word: 'CITRON', clue: 'Fragrant bumpy-skinned antique citrus', hardClue: 'Candied peel source in fruitcake' },
    ],
  },
  {
    id: 'amber-kitchen-utensils',
    tier: 'amber',
    complexity: 1,
    title: 'Kitchen Utensils',
    words: [
      { word: 'WHISK', clue: 'Wire-loop tool for whipping cream or eggs', hardClue: 'Balloon-shaped aerator for batter' },
      { word: 'LADLE', clue: 'Deep-bowled long-handled soup spoon', hardClue: 'Tureen companion with a curved lip' },
      { word: 'GRATER', clue: 'Perforated metal tool for shredding cheese', hardClue: 'Box-shaped kitchen shredder' },
      { word: 'TONGS', clue: 'Hinged pincers for turning hot food', hardClue: 'Spring-loaded grill grabbers' },
    ],
  },
  {
    id: 'amber-breads',
    tier: 'amber',
    complexity: 1,
    title: 'Bread Varieties',
    words: [
      { word: 'BAGEL', clue: 'Boiled-then-baked ring-shaped roll', hardClue: 'Deli torus often dusted with sesame' },
      { word: 'BRIOCHE', clue: 'Rich buttery French egg loaf', hardClue: 'Golden enriched bakery favorite' },
      { word: 'NAAN', clue: 'Leavened tandoor-baked flatbread', hardClue: 'Blistered hearth companion to curry' },
      { word: 'CHALLAH', clue: 'Braided glossy egg-washed loaf', hardClue: 'Plaited golden Sabbath bread' },
    ],
  },
  {
    id: 'amber-fabrics',
    tier: 'amber',
    complexity: 2,
    title: 'Fabric Patterns',
    words: [
      { word: 'PLAID', clue: 'Checkered pattern of intersecting stripes', hardClue: 'Tartan-inspired woven grid' },
      { word: 'PAISLEY', clue: 'Ornate teardrop-shaped textile motif', hardClue: 'Curved Persian-rooted fabric print' },
      { word: 'GINGHAM', clue: 'Crisp two-tone checked cotton weave', hardClue: 'Picnic-cloth checkered print' },
      { word: 'TWEED', clue: 'Rough flecked woolen twill cloth', hardClue: 'Scottish riverside country weave' },
    ],
  },
  {
    id: 'amber-tempo',
    tier: 'amber',
    complexity: 2,
    title: 'Musical Tempo Markings',
    words: [
      { word: 'LENTO', clue: 'Italian direction meaning played slowly', hardClue: 'Unhurried score pacing' },
      { word: 'ADAGIO', clue: 'Slow, stately musical passage', hardClue: 'Unrushed symphonic movement' },
      { word: 'PRESTO', clue: 'Extremely brisk tempo or magic cue', hardClue: 'Lightning-fast baton pace' },
      { word: 'ALLEGRO', clue: 'Lively bright musical speed', hardClue: 'Cheerful brisk concerto opening' },
    ],
  },
  {
    id: 'amber-gemstones',
    tier: 'amber',
    complexity: 2,
    title: 'Precious & Semi-Precious Stones',
    words: [
      { word: 'TOPAZ', clue: 'Golden-amber silicate gemstone', hardClue: 'November’s faceted crystal' },
      { word: 'GARNET', clue: 'Deep pomegranate-red mineral crystal', hardClue: 'January’s claret birthstone' },
      { word: 'ONYX', clue: 'Banded jet-black quartz stone', hardClue: 'Cameo carver’s dark chalcedony' },
      { word: 'BERYL', clue: 'Mineral family containing emerald', hardClue: 'Hexagonal silicate behind aquamarine' },
    ],
  },
  {
    id: 'amber-woodwinds',
    tier: 'amber',
    complexity: 2,
    title: 'Woodwind Instruments',
    words: [
      { word: 'FLUTE', clue: 'Side-blown silver orchestral pipe', hardClue: 'Keyed reedless orchestra treble' },
      { word: 'OBOE', clue: 'Double-reed orchestra tuning lead', hardClue: 'Plaintive A-440 pitch setter' },
      { word: 'FIFE', clue: 'High-pitched marching woodwind', hardClue: 'Companion to a colonial snare drum' },
      { word: 'BASSOON', clue: 'Deep folded double-reed bass woodwind', hardClue: 'Grandfather’s voice in Peter and the Wolf' },
    ],
  },
  {
    id: 'amber-pasta',
    tier: 'amber',
    complexity: 2,
    title: 'Pasta Shapes',
    words: [
      { word: 'PENNE', clue: 'Angled hollow quill-shaped pasta', hardClue: 'Italian for quills, served al dente' },
      { word: 'ORZO', clue: 'Rice-shaped semolina pasta grains', hardClue: 'Italian for barley, simmered in broth' },
      { word: 'FUSILLI', clue: 'Tightly twisted corkscrew pasta', hardClue: 'Spindle-wound sauce trapper' },
      { word: 'GNOCCHI', clue: 'Soft pillowy potato dumplings', hardClue: 'Fork-ridged Italian comfort bites' },
    ],
  },
  {
    id: 'amber-spices',
    tier: 'amber',
    complexity: 3,
    title: 'Aromatic Spices',
    words: [
      { word: 'CUMIN', clue: 'Earthy warm seed used in chili and curry', hardClue: 'Toasted umbellifer seed in garam masala' },
      { word: 'ANISE', clue: 'Sweet licorice-scented baking seed', hardClue: 'Flavoring behind pizzelle and ouzo' },
      { word: 'SUMAC', clue: 'Tangy crimson crushed berry spice', hardClue: 'Lemony Levantine finishing dust' },
      { word: 'SAFFRON', clue: 'Crimson crocus threads prized in paella', hardClue: 'World’s costliest stigma harvest' },
    ],
  },
  {
    id: 'amber-tree-types',
    tier: 'amber',
    complexity: 3,
    title: 'Deciduous & Conifer Trees',
    words: [
      { word: 'BIRCH', clue: 'Slender white-barked northern tree', hardClue: 'Papery peeling canoe-maker’s trunk' },
      { word: 'ALDER', clue: 'Streamside tree used for smoking salmon', hardClue: 'Wetland member of the birch family' },
      { word: 'LARCH', clue: 'Conifer that sheds its golden needles', hardClue: 'Deciduous alpine needle-bearer' },
      { word: 'ASPEN', clue: 'High-altitude tree with quaking leaves', hardClue: 'Clonal grove glowing gold in autumn' },
    ],
  },

  // ==================== MOSS (12) ====================
  {
    id: 'moss-with-keys',
    tier: 'moss',
    complexity: 1,
    title: 'Things With Keys',
    words: [
      { word: 'PIANO', clue: 'Eighty-eight-key concert instrument', hardClue: 'Hammer-struck parlor centerpiece' },
      { word: 'CIPHER', clue: 'Coded system used to conceal text', hardClue: 'Cryptographer’s substitution method' },
      { word: 'FLORIDA', clue: 'Sunshine State with a southern island chain', hardClue: 'Peninsula ending in coral islets' },
      { word: 'ATLAS', clue: 'Bound reference book of cartography', hardClue: 'Volume needing a legend to decode' },
    ],
  },
  {
    id: 'moss-chess-pieces',
    tier: 'moss',
    complexity: 1,
    title: 'Chess Pieces',
    words: [
      { word: 'KNIGHT', clue: 'L-shaped jumper on a sixty-four square board', hardClue: 'Only piece able to leap over ranks' },
      { word: 'BISHOP', clue: 'Diagonal-gliding corner adviser', hardClue: 'Color-bound mitered attacker' },
      { word: 'ROOK', clue: 'Straight-line castle-topped piece', hardClue: 'Partner in a castling maneuver' },
      { word: 'PAWN', clue: 'Front-rank soldier that promotes on row eight', hardClue: 'En passant participant' },
    ],
  },
  {
    id: 'moss-clouds',
    tier: 'moss',
    complexity: 1,
    title: 'Types of Clouds',
    words: [
      { word: 'CIRRUS', clue: 'High, wispy feather-like cloud formation', hardClue: 'Ice-crystal mare’s tail aloft' },
      { word: 'STRATUS', clue: 'Low flat gray blanket of cloud', hardClue: 'Layered overcast ceiling' },
      { word: 'CUMULUS', clue: 'Puffy fair-weather cotton-ball cloud', hardClue: 'Heaped thermal-born sky tower' },
      { word: 'NIMBUS', clue: 'Dark rain-bearing storm cloud', hardClue: 'Latin aureole or downpour bringer' },
    ],
  },
  {
    id: 'moss-poker-terms',
    tier: 'moss',
    complexity: 2,
    title: 'Poker Terms',
    words: [
      { word: 'FLUSH', clue: 'Five cards sharing the same suit', hardClue: 'Level with the surface or one-suit hand' },
      { word: 'BLIND', clue: 'Forced pre-deal bet left of the dealer', hardClue: 'Window shade or mandatory ante' },
      { word: 'RIVER', clue: 'Fifth and final community card dealt', hardClue: 'Last street before the showdown' },
      { word: 'FLOP', clue: 'First three shared cards turned face-up', hardClue: 'Box-office dud or midday turn' },
    ],
  },
  {
    id: 'moss-desert-features',
    tier: 'moss',
    complexity: 1,
    title: 'Desert Features',
    words: [
      { word: 'DUNES', clue: 'Wind-sculpted ridges of shifting sand', hardClue: 'Crescent barchans of the erg' },
      { word: 'OASIS', clue: 'Fertile palm-ringed spring in arid land', hardClue: 'Aquifer-fed caravan haven' },
      { word: 'MIRAGE', clue: 'Shimmering heat-bent optical illusion', hardClue: 'Refracted sky mistaken for water' },
      { word: 'CANYON', clue: 'Deep river-carved gorge between cliffs', hardClue: 'Steep-walled arid chasm' },
    ],
  },
  {
    id: 'moss-weather-tools',
    tier: 'moss',
    complexity: 2,
    title: 'Weather Instruments',
    words: [
      { word: 'VANE', clue: 'Rooftop pointer turning into the wind', hardClue: 'Weathercock’s rotating arrow' },
      { word: 'GAUGE', clue: 'Calibrated cylinder measuring rainfall', hardClue: 'Track width or precipitation tube' },
      { word: 'SONDE', clue: 'Balloon-borne upper-air sensor', hardClue: 'Telemetry probe sent aloft' },
      { word: 'LIDAR', clue: 'Laser-pulsed atmospheric scanner', hardClue: 'Optical cousin of storm echo sweeps' },
    ],
  },
  {
    id: 'moss-myth-creatures',
    tier: 'moss',
    complexity: 2,
    title: 'Mythical Creatures',
    words: [
      { word: 'SPHINX', clue: 'Riddle-posing winged guardian of legend', hardClue: 'Theban keeper of the four-legs puzzle' },
      { word: 'HYDRA', clue: 'Many-headed serpent of Greek myth', hardClue: 'Swamp foe that doubled when cut' },
      { word: 'GRIFFIN', clue: 'Lion-bodied, eagle-winged treasure guard', hardClue: 'Heraldic hybrid of sky and savanna' },
      { word: 'PEGASUS', clue: 'Winged immortal white steed', hardClue: 'Spring-striking equine constellation' },
    ],
  },
  {
    id: 'moss-boat-parts',
    tier: 'moss',
    complexity: 2,
    title: 'Parts of a Sailboat',
    words: [
      { word: 'STERN', clue: 'Rearmost end of a vessel', hardClue: 'Aftmost transom or austere manner' },
      { word: 'KEEL', clue: 'Weighted underwater spine of a hull', hardClue: 'Centerline fin preventing leeway' },
      { word: 'MAST', clue: 'Tall vertical spar supporting sails', hardClue: 'Fallen forest nuts or rigging pole' },
      { word: 'TILLER', clue: 'Lever bar used to turn a rudder', hardClue: 'Helmsman’s wooden steering arm' },
    ],
  },
  {
    id: 'moss-typography',
    tier: 'moss',
    complexity: 3,
    title: 'Typography Terms',
    words: [
      { word: 'SERIF', clue: 'Small finishing stroke on a letterform', hardClue: 'Bracketed foot on roman type' },
      { word: 'GLYPH', clue: 'Single shaped symbol inside a font', hardClue: 'Carved or digitized character form' },
      { word: 'KERNING', clue: 'Adjusting space between specific letter pairs', hardClue: 'Optical tucking of A beside V' },
      { word: 'LEADING', clue: 'Vertical baseline spacing between lines', hardClue: 'Named for metal strips in hot type' },
    ],
  },
  {
    id: 'moss-architecture',
    tier: 'moss',
    complexity: 3,
    title: 'Architectural Elements',
    words: [
      { word: 'VAULT', clue: 'Arched stone or brick ceiling', hardClue: 'Ribbed cathedral overhead span' },
      { word: 'FRIEZE', clue: 'Sculpted horizontal band below a cornice', hardClue: 'Parthenon’s marble relief strip' },
      { word: 'PLINTH', clue: 'Heavy square base supporting a column', hardClue: 'Pedestal block anchoring a statue' },
      { word: 'GABLE', clue: 'Triangular wall beneath a pitched roof', hardClue: 'Green house feature of Avonlea' },
    ],
  },
  {
    id: 'moss-stagecraft',
    tier: 'moss',
    complexity: 3,
    title: 'Theater & Stage Terms',
    words: [
      { word: 'PROPS', clue: 'Movable objects handled by actors', hardClue: 'Backstage table’s curated items' },
      { word: 'WINGS', clue: 'Offstage side areas hidden from view', hardClue: 'Where understudies wait for cues' },
      { word: 'APRON', clue: 'Front strip of stage jutting past the curtain', hardClue: 'Forestage lip toward the orchestra' },
      { word: 'RIGGING', clue: 'Overhead pulleys lifting scenery drops', hardClue: 'Fly-tower ropes and counterweights' },
    ],
  },
  {
    id: 'moss-geology',
    tier: 'moss',
    complexity: 3,
    title: 'Types of Rock',
    words: [
      { word: 'SHALE', clue: 'Fine layered sedimentary mudstone', hardClue: 'Fissile host of ancient fossils' },
      { word: 'BASALT', clue: 'Dark fine-grained volcanic rock', hardClue: 'Hexagonal columns of the ocean floor' },
      { word: 'GNEISS', clue: 'Banded high-grade metamorphic rock', hardClue: 'Polite-sounding foliated stone' },
      { word: 'PUMICE', clue: 'Froth-filled volcanic stone that floats', hardClue: 'Vesicular glass from explosive magma' },
    ],
  },

  // ==================== SURF (12) ====================
  {
    id: 'surf-before-light',
    tier: 'surf',
    complexity: 1,
    title: 'Words Before "Light"',
    words: [
      { word: 'FLASH', clue: 'Sudden brief burst of bright illumination', hardClue: 'Camera’s split-second strobe' },
      { word: 'LIME', clue: 'Green citrus or theatrical spotlight prefix', hardClue: 'Calcium oxide stage glow' },
      { word: 'FLOOD', clue: 'Broad wide-angle outdoor lamp prefix', hardClue: 'Overflowing deluge or stadium wash' },
      { word: 'TRAFFIC', clue: 'Intersection signal controller prefix', hardClue: 'Gridlock of red, amber, and green' },
    ],
  },
  {
    id: 'surf-can-be-drawn',
    tier: 'surf',
    complexity: 1,
    title: 'Things That Can Be Drawn',
    words: [
      { word: 'SWORD', clue: 'Long bladed weapon pulled from a scabbard', hardClue: 'Unsheathed steel at a duel' },
      { word: 'CURTAIN', clue: 'Window drape pulled open or shut', hardClue: 'Velvet divider at act’s end' },
      { word: 'BATH', clue: 'Warm tub filled for soaking', hardClue: 'Roman spa town or evening soak' },
      { word: 'BLANK', clue: 'Empty space when memory stalls', hardClue: 'Unfilled form line or cartridge' },
    ],
  },
  {
    id: 'surf-moons',
    tier: 'surf',
    complexity: 2,
    title: 'Solar System Moons',
    words: [
      { word: 'TITAN', clue: 'Saturn’s largest haze-shrouded moon', hardClue: 'Methane-lake world beyond the rings' },
      { word: 'EUROPA', clue: 'Icy ocean-harboring moon of Jupiter', hardClue: 'Criss-crossed Jovian ice shell' },
      { word: 'PHOBOS', clue: 'Larger, closer inner moon of Mars', hardClue: 'Greek god of fear orbiting red dust' },
      { word: 'TRITON', clue: 'Neptune’s backward-orbiting icy moon', hardClue: 'Retrograde geyser-spewing satellite' },
    ],
  },
  {
    id: 'surf-shades-green',
    tier: 'surf',
    complexity: 1,
    title: 'Shades of Green',
    words: [
      { word: 'OLIVE', clue: 'Muted yellow-green Mediterranean hue', hardClue: 'Drab military tint or grove fruit' },
      { word: 'SAGE', clue: 'Soft silvery-green herb shade', hardClue: 'Wise thinker or dusty botanical tone' },
      { word: 'JADE', clue: 'Rich translucent ornamental green', hardClue: 'Carved imperial stone tint' },
      { word: 'EMERALD', clue: 'Deep vivid jewel-toned green', hardClue: 'Color of Oz’s glittering city' },
    ],
  },
  {
    id: 'surf-things-roll',
    tier: 'surf',
    complexity: 2,
    title: 'Things That Roll',
    words: [
      { word: 'STONE', clue: 'Hard mineral piece that gathers no moss', hardClue: 'Fourteen-pound measure or river rock' },
      { word: 'DICE', clue: 'Spotted cubes tossed on felt', hardClue: 'Cut vegetables into uniform cubes' },
      { word: 'THUNDER', clue: 'Deep booming rumble after lightning', hardClue: 'Acoustic shockwave across storm clouds' },
      { word: 'CREDITS', clue: 'Scrolling cast and crew names at film’s end', hardClue: 'Final crawl over exit music' },
    ],
  },
  {
    id: 'surf-film-noir',
    tier: 'surf',
    complexity: 2,
    title: 'Film Noir Staples',
    words: [
      { word: 'SHADOW', clue: 'Dark silhouette cast beneath a streetlamp', hardClue: 'Tail a suspect or Venetian-blind silhouette' },
      { word: 'FEDORA', clue: 'Soft creased-crown felt detective hat', hardClue: 'Brimmed trademark of Bogart’s Marlowe' },
      { word: 'TRENCH', clue: 'Belted belted rain coat of classic gumshoes', hardClue: 'Waterproof gabardine overcoat' },
      { word: 'ALIBI', clue: 'Proof of being elsewhere during a crime', hardClue: 'Latin for "elsewhere," tested by sleuths' },
    ],
  },
  {
    id: 'surf-synonyms-peak',
    tier: 'surf',
    complexity: 2,
    title: 'Synonyms for "Peak"',
    words: [
      { word: 'CREST', clue: 'Curling top of a ridge or ocean wave', hardClue: 'Heraldic crown atop a shield' },
      { word: 'APEX', clue: 'Sharp topmost point of a triangle', hardClue: 'Corner clipping point on a racetrack' },
      { word: 'SUMMIT', clue: 'Highest climbable point of a mountain', hardClue: 'High-level diplomatic conference' },
      { word: 'ZENITH', clue: 'Celestial point directly overhead', hardClue: 'Antonym of nadir' },
    ],
  },
  {
    id: 'surf-can-be-broken',
    tier: 'surf',
    complexity: 2,
    title: 'Things You Can Break',
    words: [
      { word: 'BREAD', clue: 'Shared loaf symbolizing fellowship', hardClue: 'Sourdough or rye shared at table' },
      { word: 'RECORD', clue: 'Best official mark awaiting a challenger', hardClue: 'Vinyl platter or top athletic feat' },
      { word: 'SILENCE', clue: 'Quiet shattered by a sudden remark', hardClue: 'Golden hush before a confession' },
      { word: 'GROUND', clue: 'Earth ceremonially turned with a shovel', hardClue: 'First spadeful at a new build' },
    ],
  },
  {
    id: 'surf-after-double',
    tier: 'surf',
    complexity: 3,
    title: 'Words After "Double"',
    words: [
      { word: 'AGENT', clue: 'Undercover spy working for two sides', hardClue: 'Operative playing both camps' },
      { word: 'DUTCH', clue: 'Two-rope jump game spun in alternation', hardClue: 'Twin turning skip-ropes on asphalt' },
      { word: 'CHECK', clue: 'Verify a calculation a second time', hardClue: 'Review twice for peace of mind' },
      { word: 'HEADER', clue: 'Pair of games played on the same day', hardClue: 'Back-to-back ballpark twinbill' },
    ],
  },
  {
    id: 'surf-card-games',
    tier: 'surf',
    complexity: 3,
    title: 'Classic Card Games',
    words: [
      { word: 'WHIST', clue: 'Trick-taking ancestor of contract bridge', hardClue: 'Victorian parlor four-hand contest' },
      { word: 'HEARTS', clue: 'Trick-avoidance game with the Queen of Spades', hardClue: 'Where shooting the moon reverses the score' },
      { word: 'BRIDGE', clue: 'Partnership bidding and trick-taking classic', hardClue: 'Vulnerable slam-bidding duel' },
      { word: 'EUCHRE', clue: 'Five-card trump game featuring bowers', hardClue: 'Midwestern parlor battle of jacks' },
    ],
  },
  {
    id: 'surf-units-measure',
    tier: 'surf',
    complexity: 3,
    title: 'Nautical & Archaic Units',
    words: [
      { word: 'FATHOM', clue: 'Six-foot measure of water depth', hardClue: 'Comprehend deeply or sound a channel' },
      { word: 'LEAGUE', clue: 'Three-mile maritime distance unit', hardClue: 'Twenty thousand under the sea' },
      { word: 'KNOT', clue: 'One nautical mile per hour', hardClue: 'Speed once gauged by a log line' },
      { word: 'CUBIT', clue: 'Ancient forearm-length measure', hardClue: 'Blueprint unit of Noah’s ark' },
    ],
  },
  {
    id: 'surf-words-with-silent-k',
    tier: 'surf',
    complexity: 3,
    title: 'Starting With a Silent "K"',
    words: [
      { word: 'KNAVE', clue: 'Roguish jack in an old deck of cards', hardClue: 'Dishonest foil to a truth-teller' },
      { word: 'KNEAD', clue: 'Work and fold bread dough by hand', hardClue: 'Homophone of an urgent necessity' },
      { word: 'KNELL', clue: 'Slow solemn tolling of a bell', hardClue: 'Poetic sound of parting day' },
      { word: 'KNOLL', clue: 'Small gently rounded grassy hill', hardClue: 'Low rise in a meadow' },
    ],
  },

  // ==================== VOID (12) ====================
  {
    id: 'void-palindromes',
    tier: 'void',
    complexity: 1,
    title: 'Palindromes',
    words: [
      { word: 'KAYAK', clue: 'Narrow paddled watercraft spelling the same backward', hardClue: 'Symmetrical Inuit-origin boat' },
      { word: 'LEVEL', clue: 'Flat carpenter’s bubble tool', hardClue: 'Evenly balanced either way you read it' },
      { word: 'RADAR', clue: 'Radio-wave storm and aircraft tracker', hardClue: 'Reversible air-traffic acronym' },
      { word: 'CIVIC', clue: 'Relating to a city or citizenship', hardClue: 'Municipal duty mirrored end to end' },
    ],
  },
  {
    id: 'void-before-board',
    tier: 'void',
    complexity: 1,
    title: '___ Board',
    words: [
      { word: 'SPRING', clue: 'Coiled elastic metal or season of bloom', hardClue: 'Diving launch plank prefix' },
      { word: 'STORY', clue: 'Visual panel sequence used by filmmakers', hardClue: 'Scene-by-scene director’s wall prefix' },
      { word: 'CHECKER', clue: 'Alternating dark-and-light square pattern', hardClue: 'Draughts grid prefix' },
      { word: 'DART', clue: 'Feathered pub target missile', hardClue: 'Bullseye cork circle prefix' },
    ],
  },
  {
    id: 'void-car-models',
    tier: 'void',
    complexity: 2,
    title: 'Car Models',
    words: [
      { word: 'BRONCO', clue: 'Untamed mustang or rugged off-road SUV', hardClue: 'Bucking equestrian nameplate' },
      { word: 'MUSTANG', clue: 'Wild plains horse or iconic pony car', hardClue: 'Galloping emblem launched in 1964' },
      { word: 'COROLLA', clue: 'Ring of flower petals or bestselling sedan', hardClue: 'Botanical crown on four wheels' },
      { word: 'IMPALA', clue: 'Swift African antelope or classic cruiser', hardClue: 'Leaping savanna badge' },
    ],
  },
  {
    id: 'void-silent-letters',
    tier: 'void',
    complexity: 2,
    title: 'Words With a Silent Letter',
    words: [
      { word: 'GNOME', clue: 'Pointy-hatted folklore garden guardian', hardClue: 'Earth spirit with a mute opener' },
      { word: 'PSALM', clue: 'Sacred lyric song from scripture', hardClue: 'Hymn opening with an unheard P' },
      { word: 'WRIST', clue: 'Flexible joint where a watch rests', hardClue: 'Silent-W forearm hinge' },
      { word: 'DOUBT', clue: 'Lingering uncertainty in the mind', hardClue: 'Skepticism hiding a quiet B' },
    ],
  },
  {
    id: 'void-double-letter-animals',
    tier: 'void',
    complexity: 1,
    title: 'Animals With Double Letters',
    words: [
      { word: 'OTTER', clue: 'Playful sleek river mammal', hardClue: 'Pebble-juggling twin-T swimmer' },
      { word: 'LLAMA', clue: 'Andean wool-bearing pack animal', hardClue: 'Mountain camelid starting with twins' },
      { word: 'HIPPO', clue: 'Heavy amphibious river grazer', hardClue: 'Greek "river horse" with paired Ps' },
      { word: 'MOOSE', clue: 'Antlered giant of northern bogs', hardClue: 'Twin-O boreal browser' },
    ],
  },
  {
    id: 'void-things-pitch',
    tier: 'void',
    complexity: 2,
    title: 'Things You Can Pitch',
    words: [
      { word: 'TENT', clue: 'Canvas shelter staked at a campsite', hardClue: 'Pegged fabric roof in the woods' },
      { word: 'CURVE', clue: 'Spinning breaking baseball throw', hardClue: 'Bending arc from the mound' },
      { word: 'VOICE', clue: 'Musical register or spoken opinion', hardClue: 'Soprano or baritone instrument' },
      { word: 'IDEA', clue: 'Fresh concept presented to backers', hardClue: 'Spark sold in an elevator ride' },
    ],
  },
  {
    id: 'void-before-wave',
    tier: 'void',
    complexity: 2,
    title: '___ Wave',
    words: [
      { word: 'TIDAL', clue: 'Driven by the lunar rise and fall of the sea', hardClue: 'Oceanic surge modifier' },
      { word: 'HEAT', clue: 'Prolonged stretch of sweltering weather', hardClue: 'Summer dome of scorching air' },
      { word: 'BRAIN', clue: 'Sudden flash of creative inspiration', hardClue: 'Electroencephalogram ripple' },
      { word: 'SOUND', clue: 'Acoustic pressure ripple through air', hardClue: 'Longitudinal medium of music' },
    ],
  },
  {
    id: 'void-hidden-numbers',
    tier: 'void',
    complexity: 3,
    title: 'Words Ending in a Number',
    words: [
      { word: 'STONE', clue: 'Mineral rock hiding ONE at its tail', hardClue: 'Quarry block concealing a unit' },
      { word: 'OFTEN', clue: 'Frequently, ending with TEN', hardClue: 'Adverb closing on a decade' },
      { word: 'WEIGHT', clue: 'Gravitational pull ending with EIGHT', hardClue: 'Scale reading ending in an octet' },
      { word: 'CANINE', clue: 'Pointed tooth or dog ending with NINE', hardClue: 'Hound family closing on a baseball team count' },
    ],
  },
  {
    id: 'void-anagrams-of-body',
    tier: 'void',
    complexity: 3,
    title: 'Words Starting With a Musical Note',
    words: [
      { word: 'DONUT', clue: 'Glazed ring pastry beginning with DO', hardClue: 'Fried bakery ring on solfège step one' },
      { word: 'RELAY', clue: 'Baton-passing race beginning with RE', hardClue: 'Electrical switch or track handoff' },
      { word: 'MIRTH', clue: 'Merry laughter beginning with MI', hardClue: 'Banquet gaiety opening on the third scale note' },
      { word: 'FABLE', clue: 'Moral folk tale beginning with FA', hardClue: 'Short allegory opening on the fourth scale note' },
    ],
  },
  {
    id: 'void-homophones-letters',
    tier: 'void',
    complexity: 3,
    title: 'Words Containing "ACE"',
    words: [
      { word: 'TRACE', clue: 'Faint remaining mark or copy lines', hardClue: 'Follow lightly over vellum' },
      { word: 'GRACE', clue: 'Effortless elegance in motion', hardClue: 'Pre-meal blessing or poise' },
      { word: 'BRACE', clue: 'Structural support or a pair of hounds', hardClue: 'Steadying strut before impact' },
      { word: 'PLACE', clue: 'Second-place finish or geographic spot', hardClue: 'Set down in its rightful niche' },
    ],
  },
  {
    id: 'void-greek-letters-hidden',
    tier: 'void',
    complexity: 3,
    title: 'Starting With a Greek Letter',
    words: [
      { word: 'PILOT', clue: 'Cockpit aviator opening with PI', hardClue: 'Harbor guide or test broadcast' },
      { word: 'MURAL', clue: 'Large wall painting opening with MU', hardClue: 'Civic fresco on plaster' },
      { word: 'NURSE', clue: 'Hospital caregiver opening with NU', hardClue: 'Tend patiently back to health' },
      { word: 'TAUNT', clue: 'Provoking jeer opening with TAU', hardClue: 'Mocking dare across the field' },
    ],
  },
  {
    id: 'void-planetary-metals',
    tier: 'void',
    complexity: 3,
    title: 'Words That Follow "Silver"',
    words: [
      { word: 'LINING', clue: 'Bright consolation hidden in a dark cloud', hardClue: 'Inner fabric of a storm cloud' },
      { word: 'SCREEN', clue: 'Luminous canvas of classic cinema', hardClue: 'Projector’s shimmering destination' },
      { word: 'SPOON', clue: 'Heirloom utensil of inherited privilege', hardClue: 'Born-in-mouth emblem of wealth' },
      { word: 'BULLET', clue: 'Simple magical cure for a complex problem', hardClue: 'Folklore remedy for a werewolf' },
    ],
  },
];
