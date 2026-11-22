// Deterministic 10x10 Daily Word Search Generator with 12-Month Archive (368 Days)
import { getLondonTodayDateStr } from '@/lib/daily-streak';
import {
  getDictionaryLanguage,
  normalizeDictionaryLanguage,
  stripDiacritics,
  type DictionaryLanguageCode,
} from '../../lib/dictionary-languages';
import { getMultiLangPack } from '../../data/dictionaries/multilang-word-packs';
import { MULTILANG_MPSEARCH_THEMES } from '../../data/dictionaries/multilang-search-themes';

export interface CellCoord {
  row: number;
  col: number;
}

export type WordOrientation = 'Horizontal' | 'Vertical' | 'Diagonal';

export interface PlacedWord {
  word: string;
  start: CellCoord;
  end: CellCoord;
  cells: CellCoord[];
  orientation: WordOrientation;
  directionArrow: string;
  directionLabel: string;
  isBackwards: boolean;
  startColumnLetter: string; // 'A' - 'J'
  startRowNumber: number; // 1 - 10
  colorIndex: number;
}

export interface DailyPuzzle {
  dateKey: string; // YYYY-MM-DD
  displayDate: string; // e.g., "Nov 14, 2026"
  weekdayShort: string; // e.g., "Sat"
  monthKey: string; // e.g., "2026-11"
  monthLabel: string; // e.g., "November 2026"
  puzzleNumber: number; // 1 to 368
  themeTitle: string;
  category: string;
  grid: string[][]; // 10x10
  words: PlacedWord[]; // 8-12 words per puzzle
}

interface ThemeDefinition {
  title: string;
  category: string;
  pool: string[];
}

const THEME_BANK: ThemeDefinition[] = [
  {
    title: 'Autumn Harvest',
    category: 'Seasons & Nature',
    pool: ['ACORN', 'MAPLE', 'CIDER', 'ORCHARD', 'PUMPKIN', 'HARVEST', 'AMBER', 'WHEAT', 'GOURD', 'CRISP', 'FOLIAGE', 'RUSTIC'],
  },
  {
    title: 'Celestial Observatory',
    category: 'Astronomy',
    pool: ['COMET', 'NEBULA', 'ORBIT', 'QUASAR', 'ECLIPSE', 'PULSAR', 'GALAXY', 'ZENITH', 'METEOR', 'COSMOS', 'SATURN', 'CORONA'],
  },
  {
    title: 'Botanical Conservatory',
    category: 'Flora & Gardens',
    pool: ['ORCHID', 'FERN', 'JASMINE', 'PEONY', 'PETAL', 'POLLEN', 'NECTAR', 'BONSAI', 'DAHLIA', 'THISTLE', 'WILLOW', 'CLOVER'],
  },
  {
    title: 'Artisan Roastery',
    category: 'Food & Drink',
    pool: ['AROMA', 'ROAST', 'BARISTA', 'MOCHA', 'CREMA', 'FILTER', 'CARAMEL', 'VELVET', 'STEAM', 'GRIND', 'COCOA', 'LATTE'],
  },
  {
    title: 'Oceanic Voyages',
    category: 'Maritime',
    pool: ['ANCHOR', 'COMPASS', 'HARBOR', 'BEACON', 'VOYAGE', 'GALLEON', 'MARINER', 'LAGOON', 'ATOLL', 'FATHOM', 'CORAL', 'TRIDENT'],
  },
  {
    title: 'Classical Symphony',
    category: 'Music & Arts',
    pool: ['SONATA', 'TIMPANI', 'CELLO', 'PRELUDE', 'VIOLIN', 'CHORUS', 'MAESTRO', 'ADAGIO', 'CADENCE', 'OBOE', 'LYRIC', 'OCTAVE'],
  },
  {
    title: 'Alpine Expedition',
    category: 'Geography',
    pool: ['SUMMIT', 'GLACIER', 'RIDGE', 'GRANITE', 'VALLEY', 'RAVINE', 'TIMBER', 'CHALET', 'PLATEAU', 'CAIRN', 'ASCENT', 'FJORD'],
  },
  {
    title: 'Printmaker Studio',
    category: 'Visual Arts',
    pool: ['ETCHING', 'LINEN', 'PIGMENT', 'CHISEL', 'CANVAS', 'STENCIL', 'CHARCOAL', 'GALLERY', 'PATINA', 'SKETCH', 'BRUSH', 'OCHRE'],
  },
  {
    title: 'Culinary Herb Garden',
    category: 'Gastronomy',
    pool: ['THYME', 'BASIL', 'OREGANO', 'SAFFRON', 'FENNEL', 'SAGE', 'PARSLEY', 'CHIVES', 'TARRAGON', 'MINT', 'NUTMEG', 'CLOVE'],
  },
  {
    title: 'Watchmaker Bench',
    category: 'Craftsmanship',
    pool: ['PENDULUM', 'PINION', 'BEZEL', 'CHRONO', 'SPRING', 'JEWEL', 'CALIBER', 'BALANCE', 'QUARTZ', 'DIAL', 'MOVEMENT', 'CHIME'],
  },
  {
    title: 'Woodland Wildlife',
    category: 'Fauna',
    pool: ['BADGER', 'FALCON', 'OTTER', 'FOXGLOVE', 'HERON', 'MARTEN', 'WREN', 'WARBLER', 'BEAVER', 'LYNX', 'FINCH', 'SPARROW'],
  },
  {
    title: 'Rare Bookshop',
    category: 'Literature',
    pool: ['FOLIO', 'VELLUM', 'SONNET', 'ARCHIVE', 'MEMOIR', 'BINDING', 'CHAPTER', 'EDITION', 'INDEX', 'PROSE', 'SCROLL', 'STANZA'],
  },
  {
    title: 'Mineral Cabinet',
    category: 'Geology',
    pool: ['GARNET', 'TOPAZ', 'AGATE', 'COBALT', 'JASPER', 'OBSIDIAN', 'PYRITE', 'CRYSTAL', 'OPAL', 'BERYL', 'MARBLE', 'SLATE'],
  },
  {
    title: 'Meteorology Station',
    category: 'Weather',
    pool: ['CIRRUS', 'MONSOON', 'TEMPEST', 'BREEZE', 'CYCLONE', 'STRATUS', 'FORECAST', 'SQUALL', 'THUNDER', 'CUMULUS', 'FROST', 'MIST'],
  },
  {
    title: 'Sourdough Bakery',
    category: 'Baking',
    pool: ['BRIOCHE', 'CRUST', 'LEAVEN', 'WHEAT', 'PASTRY', 'SESAME', 'PRETZEL', 'CIABATTA', 'FLOUR', 'CRUMB', 'GALETTE', 'YEAST'],
  },
  {
    title: 'Architectural Marvels',
    category: 'Architecture',
    pool: ['ARCADE', 'CUPOLA', 'CORNICE', 'PORTICO', 'ATRIUM', 'PARAPET', 'VAULT', 'PILLAR', 'FRIEZE', 'LOGGIA', 'GABLE', 'DOMED'],
  },
  {
    title: 'Midnight Jazz Club',
    category: 'Music & Arts',
    pool: ['TRUMPET', 'SWING', 'RHYTHM', 'BALLAD', 'BLUES', 'CYMBAL', 'GROOVE', 'QUARTET', 'SOLOIST', 'TEMPO', 'CHORD', 'BRASS'],
  },
  {
    title: 'Silk Road Caravans',
    category: 'World History',
    pool: ['OASIS', 'BAZAAR', 'NOMAD', 'CAMEL', 'BROCADE', 'LANTERN', 'SPICE', 'MERCHANT', 'TAPESTRY', 'CITADEL', 'CARAVAN', 'AMBER'],
  },
  {
    title: 'Apothecary Jars',
    category: 'Botanicals',
    pool: ['LAVENDER', 'CAMPHOR', 'ELIXIR', 'MORTAR', 'BALSAM', 'VERVAIN', 'TINCTURE', 'GINSENG', 'MYRRH', 'YARROW', 'ALOE', 'TONIC'],
  },
  {
    title: 'Grand Chess Match',
    category: 'Board Games',
    pool: ['GAMBIT', 'KNIGHT', 'BISHOP', 'CASTLE', 'ENDGAME', 'ROOK', 'CHECK', 'PAWN', 'TACTIC', 'DEFENSE', 'TEMPO', 'BOARD'],
  },
  {
    title: 'Mediterranean Grove',
    category: 'Travel & Places',
    pool: ['CYPRESS', 'OLIVE', 'TERRACE', 'HARBOR', 'CITRUS', 'VINEYARD', 'MOSAIC', 'PIAZZA', 'SIESTA', 'COAST', 'VILLA', 'FIG'],
  },
  {
    title: 'Ceramics Kiln',
    category: 'Craftsmanship',
    pool: ['PORCELAIN', 'GLAZE', 'POTTERY', 'CERAMICS', 'EARTHEN', 'VESSEL', 'AMPHORA', 'CLAY', 'SHARD', 'WHEEL', 'BISQUE', 'KILN'],
  },
  {
    title: 'Northern Lights',
    category: 'Polar Nature',
    pool: ['AURORA', 'TUNDRA', 'CARIBOU', 'ICEBERG', 'HALO', 'ARCTIC', 'SOLSTICE', 'FJORD', 'SNOWCAP', 'GLOW', 'TAIGA', 'POLAR'],
  },
  {
    title: 'Vintage Cinema',
    category: 'Film & Stage',
    pool: ['MATINEE', 'SHUTTER', 'CLASSIC', 'THEATER', 'CURTAIN', 'SILENT', 'POSTER', 'PREMIERE', 'SCRIPT', 'CAMERA', 'SCENE', 'REEL'],
  },
  {
    title: 'Tea Ceremony',
    category: 'Culture',
    pool: ['MATCHA', 'OOLONG', 'BAMBOO', 'TEAPOT', 'SENCHA', 'INFUSION', 'JASMINE', 'KETTLE', 'CERAMIC', 'STEEP', 'SERENE', 'LEAF'],
  },
  {
    title: 'Tidal Pool Life',
    category: 'Marine Biology',
    pool: ['ANEMONE', 'STARFISH', 'BARNACLE', 'MUSSEL', 'URCHIN', 'KELP', 'PEBBLE', 'SHELL', 'LIMPET', 'CRAB', 'SHORE', 'TIDE'],
  },
  {
    title: 'Clockwork Automaton',
    category: 'Inventions',
    pool: ['GEARS', 'LEVER', 'PULLEY', 'BRASS', 'PISTON', 'FLYWHEEL', 'VALVE', 'TORQUE', 'RATCHET', 'COGS', 'DYNAMO', 'SPRING'],
  },
  {
    title: 'Japanese Woodblock',
    category: 'Art History',
    pool: ['PAGODA', 'CRANE', 'MAPLE', 'BRIDGE', 'BAMBOO', 'WAVE', 'LANTERN', 'BLOSSOM', 'MIST', 'KIMONO', 'CEDAR', 'INK'],
  },
  {
    title: 'Honeybee Apiary',
    category: 'Nature',
    pool: ['POLLEN', 'NECTAR', 'BEEHIVE', 'CLOVER', 'BEESWAX', 'MEADOW', 'SWARM', 'PROPOLIS', 'WORKER', 'QUEEN', 'AMBER', 'BLOOM'],
  },
  {
    title: 'Steam Locomotive',
    category: 'Railways',
    pool: ['CABOOSE', 'VIADUCT', 'STATION', 'WHISTLE', 'TUNNEL', 'SLEEPER', 'EXPRESS', 'BOILER', 'SIGNAL', 'TICKET', 'TRACKS', 'DEPOT'],
  },
  {
    title: 'Coral Reef Sanctuary',
    category: 'Marine Life',
    pool: ['DOLPHIN', 'MANATEE', 'SEAHORSE', 'OCTOPUS', 'LOBSTER', 'SNAPPER', 'HALIBUT', 'MORAY', 'SPONGE', 'PLANKTON', 'REEF', 'TIDE'],
  },
  {
    title: 'Renaissance Atelier',
    category: 'Fine Art',
    pool: ['FRESCO', 'TEMPERA', 'PALETTE', 'EASEL', 'PORTRAIT', 'PASTEL', 'MOSAIC', 'SCULPT', 'STUDIO', 'MARBLE', 'GLAZE', 'MURAL'],
  },
  {
    title: 'Vintner Cellar',
    category: 'Viticulture',
    pool: ['HARVEST', 'BARREL', 'VINTAGE', 'DECANTER', 'TANNIN', 'GRAPES', 'TRELLIS', 'CELLAR', 'TERROIR', 'CHATEAU', 'CORK', 'VINE'],
  },
  {
    title: 'Highland Moorland',
    category: 'Landscapes',
    pool: ['HEATHER', 'THISTLE', 'BRACKEN', 'CAIRN', 'LOCH', 'GLEN', 'TARTAN', 'GRANITE', 'CURLEW', 'PEAT', 'CRAG', 'MIST'],
  },
  {
    title: 'Cartographer Desk',
    category: 'Exploration',
    pool: ['MERIDIAN', 'LATITUDE', 'COMPASS', 'SEXTANT', 'ATLAS', 'CHART', 'LEGEND', 'TERRAIN', 'EQUATOR', 'TROPIC', 'GLOBE', 'SCALE'],
  },
  {
    title: 'Luthier Workshop',
    category: 'Musical Craft',
    pool: ['SPRUCE', 'VARNISH', 'FRET', 'BRIDGE', 'STRINGS', 'EBONY', 'SCROLL', 'TUNING', 'RESIN', 'MAPLE', 'ROSETTE', 'NECK'],
  },
  {
    title: 'Desert Mirage',
    category: 'Arid Worlds',
    pool: ['CACTUS', 'CANYON', 'DUNES', 'MIRAGE', 'PLATEAU', 'NOMAD', 'ARROYO', 'JACKAL', 'SCORPION', 'MESA', 'SAND', 'SUN'],
  },
  {
    title: 'Victorian Conservatory',
    category: 'Architecture & Flora',
    pool: ['VERANDA', 'TRELLIS', 'GAZEBO', 'CAMELLIA', 'BEGONIA', 'FOUNTAIN', 'GLASS', 'PARLOR', 'WROUGHT', 'IVY', 'FERN', 'PALM'],
  },
  {
    title: 'Blacksmith Forge',
    category: 'Metalwork',
    pool: ['ANVIL', 'HAMMER', 'BELLOWS', 'TEMPER', 'FURNACE', 'QUENCH', 'CHISEL', 'INGOT', 'TONGS', 'EMBER', 'STEEL', 'IRON'],
  },
  {
    title: 'Tropical Rainforest',
    category: 'Biodiversity',
    pool: ['CANOPY', 'TOUCAN', 'JAGUAR', 'MONSOON', 'ORCHID', 'LIANA', 'MANGROVE', 'MACAW', 'SLOTH', 'BAMBOO', 'FERN', 'VINE'],
  },
  {
    title: 'Broadsheet Newsroom',
    category: 'Journalism',
    pool: ['HEADLINE', 'GAZETTE', 'COLUMN', 'BYLINE', 'ARCHIVE', 'EDITION', 'SCOOP', 'PRESS', 'EDITOR', 'ARTICLE', 'CAPTION', 'INK'],
  },
  {
    title: 'Perfumer Laboratory',
    category: 'Fragrance',
    pool: ['BERGAMOT', 'VETIVER', 'JASMINE', 'AMBER', 'ESSENCE', 'VANILLA', 'GARDENIA', 'NEROLI', 'CITRUS', 'MUSK', 'ROSE', 'IRIS'],
  },
  {
    title: 'Cathedral Choir',
    category: 'Sacred Architecture',
    pool: ['BELFRY', 'TRANSEPT', 'CLOISTER', 'GARGOYLE', 'STAINED', 'CHANCEL', 'CHIME', 'NAVE', 'ORGAN', 'SPIRE', 'ALTAR', 'ARCH'],
  },
  {
    title: 'Fossil Excavation',
    category: 'Paleontology',
    pool: ['AMMONITE', 'DINOSAUR', 'SHALE', 'AMBER', 'BEDROCK', 'STRATA', 'CHISEL', 'MAMMOTH', 'CALCITE', 'RELIC', 'BONE', 'CLAY'],
  },
  {
    title: 'Regatta Spinnaker',
    category: 'Sailing',
    pool: ['HALYARD', 'BOWSPRIT', 'CAPSTAN', 'SCHOONER', 'RUDDER', 'WINDWARD', 'BALLAST', 'KEEL', 'GUST', 'MAST', 'TACK', 'HELM'],
  },
  {
    title: 'Chocolatier Kitchen',
    category: 'Confectionery',
    pool: ['GANACHE', 'PRALINE', 'TRUFFLE', 'NOUGAT', 'CARAMEL', 'TEMPER', 'VANILLA', 'ALMOND', 'COCOA', 'FUDGE', 'MINT', 'SYRUP'],
  },
  {
    title: 'Norse Mythology',
    category: 'Legends',
    pool: ['VALKYRIE', 'VALHALLA', 'MJOLNIR', 'ASGARD', 'VIKING', 'BIFROST', 'LONGSHIP', 'SHIELD', 'RAVEN', 'REALM', 'SAGA', 'HELM'],
  },
  {
    title: 'Grand Opera House',
    category: 'Performing Arts',
    pool: ['SOPRANO', 'LIBRETTO', 'OVERTURE', 'BARITONE', 'BALCONY', 'BRAVO', 'CURTAIN', 'ENCORE', 'STAGE', 'ARIA', 'DUET', 'ACT'],
  },
  {
    title: 'Weaver Tapestry Loom',
    category: 'Textiles',
    pool: ['SHUTTLE', 'BOBBIN', 'SPINDLE', 'DAMASK', 'VELVET', 'TARTAN', 'PATTERN', 'THREAD', 'COTTON', 'LINEN', 'SILK', 'WOOL'],
  },
  {
    title: 'Antiquarian Library',
    category: 'Scholarship',
    pool: ['CODEX', 'PAPYRUS', 'INKWELL', 'LEXICON', 'GLOSSARY', 'TREATISE', 'SCROLL', 'QUILL', 'SCRIPT', 'MARGIN', 'PAGE', 'TOME'],
  },
  {
    title: 'Boreal Forest',
    category: 'Wilderness',
    pool: ['SPRUCE', 'HEMLOCK', 'CARIBOU', 'SNOWSHOE', 'LICHEN', 'PINECONE', 'TIMBER', 'MOOSE', 'CEDAR', 'BIRCH', 'TRAIL', 'PINE'],
  },
  {
    title: 'Glassblower Furnace',
    category: 'Studio Craft',
    pool: ['CRUCIBLE', 'MOLTEN', 'CRYSTAL', 'PRISM', 'GOBLET', 'ANNEAL', 'BLOWPIPE', 'VESSEL', 'SILICA', 'FLAME', 'VASE', 'GLOW'],
  },
  {
    title: 'Equestrian Paddock',
    category: 'Horsemanship',
    pool: ['STIRRUP', 'BRIDLE', 'GALLOP', 'CANTER', 'SADDLE', 'PASTURE', 'HALTER', 'STABLE', 'TROPHY', 'FENCE', 'MANE', 'REIN'],
  },
  {
    title: 'Deep Space Probe',
    category: 'Spaceflight',
    pool: ['VOYAGER', 'BOOSTER', 'CAPSULE', 'THRUSTER', 'HORIZON', 'GRAVITY', 'MODULE', 'BEACON', 'SOLAR', 'LUNAR', 'PROBE', 'MARS'],
  },
  {
    title: 'Farmers Market Stall',
    category: 'Harvest & Produce',
    pool: ['APRICOT', 'RHUBARB', 'PARSNIP', 'SHALLOT', 'WALNUT', 'RADISH', 'TURNIP', 'BASKET', 'MELON', 'PLUM', 'PEAR', 'BEET'],
  },
  {
    title: 'Venetian Lagoon',
    category: 'World Cities',
    pool: ['GONDOLA', 'PALAZZO', 'BRIDGE', 'CARNIVAL', 'MOSAIC', 'LANTERN', 'CANAL', 'PLAZA', 'VELVET', 'MASK', 'ARCH', 'TIDE'],
  },
  {
    title: 'Beekeeper Meadow',
    category: 'Countryside',
    pool: ['LAVENDER', 'DAFFODIL', 'BLOSSOM', 'NECTAR', 'POLLEN', 'APIARY', 'BONNET', 'SMOKER', 'CLOVER', 'HONEY', 'COMB', 'HIVE'],
  },
  {
    title: 'Classic Detective Case',
    category: 'Mystery',
    pool: ['CIPHER', 'WITNESS', 'SLEUTH', 'MOTIVE', 'VERDICT', 'ALIBI', 'LOCKET', 'SHADOW', 'RIDDLE', 'SECRET', 'TRAIL', 'CLUE'],
  },
  {
    title: 'Mountain Observatory',
    category: 'Stargazing',
    pool: ['ZENITH', 'SOLSTICE', 'EQUINOX', 'SPECTRA', 'CLUSTER', 'TRANSIT', 'MIRROR', 'OPTICS', 'DOME', 'STAR', 'LENS', 'DARK'],
  },
  {
    title: 'Botanical Apothecary',
    category: 'Herbalism',
    pool: ['VALERIAN', 'ROSEMARY', 'MARIGOLD', 'HIBISCUS', 'PRIMROSE', 'INFUSION', 'MORTAR', 'BALSAM', 'TONIC', 'ROOT', 'LEAF', 'HERB'],
  },
];

const DIRECTIONS: {
  dr: number;
  dc: number;
  orientation: WordOrientation;
  arrow: string;
  label: string;
  isBackwards: boolean;
}[] = [
  { dr: 0, dc: 1, orientation: 'Horizontal', arrow: '→', label: 'Horizontal (Left to Right)', isBackwards: false },
  { dr: 1, dc: 0, orientation: 'Vertical', arrow: '↓', label: 'Vertical (Top to Bottom)', isBackwards: false },
  { dr: 1, dc: 1, orientation: 'Diagonal', arrow: '↘', label: 'Diagonal (Down-Right)', isBackwards: false },
  { dr: -1, dc: 1, orientation: 'Diagonal', arrow: '↗', label: 'Diagonal (Up-Right)', isBackwards: false },
  { dr: 0, dc: -1, orientation: 'Horizontal', arrow: '←', label: 'Horizontal Backwards (Right to Left)', isBackwards: true },
  { dr: -1, dc: 0, orientation: 'Vertical', arrow: '↑', label: 'Vertical Backwards (Bottom to Top)', isBackwards: true },
  { dr: -1, dc: -1, orientation: 'Diagonal', arrow: '↖', label: 'Diagonal Backwards (Up-Left)', isBackwards: true },
  { dr: 1, dc: -1, orientation: 'Diagonal', arrow: '↙', label: 'Diagonal Backwards (Down-Left)', isBackwards: true },
];

// Mulberry32 deterministic PRNG
function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const COLUMN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const FILLER_ALPHABET = 'EARIOTNSLCUDPMHGBFYWKVXZJQ';

// Check whether two directions form a valid '+' (Horizontal x Vertical) or 'X' (perpendicular Diagonal) intersection
function isOrthogonalOrDiagonalCross(
  dirA: { dr: number; dc: number; orientation: WordOrientation },
  dirB: { dr: number; dc: number; orientation: WordOrientation }
): boolean {
  // Forbid collinear overlap along the same axis
  if (dirA.dr * dirB.dc === dirA.dc * dirB.dr) {
    return false;
  }
  // '+' shape: one Horizontal and one Vertical
  const isPlusCross =
    (dirA.orientation === 'Horizontal' && dirB.orientation === 'Vertical') ||
    (dirA.orientation === 'Vertical' && dirB.orientation === 'Horizontal');

  // 'X' shape: two perpendicular Diagonals (\ and /)
  const isXCross =
    dirA.orientation === 'Diagonal' &&
    dirB.orientation === 'Diagonal' &&
    dirA.dr * dirA.dc !== dirB.dr * dirB.dc;

  return isPlusCross || isXCross;
}

const SUPPLEMENTAL_SHORT_WORDS = [
  'AMBER', 'ATLAS', 'BIRCH', 'BLOOM', 'BRASS', 'CEDAR', 'CHIME', 'CORAL',
  'CRANE', 'CREST', 'CROWN', 'DELTA', 'EMBER', 'FAUNA', 'FJORD', 'FLINT',
  'FLORA', 'FORGE', 'FROST', 'GLADE', 'GLEAM', 'GLOBE', 'GROVE', 'HAVEN',
  'IVORY', 'JEWEL', 'LOTUS', 'LUNAR', 'LYRIC', 'MAPLE', 'MIRTH', 'OASIS',
  'OPAL', 'ORBIT', 'PEARL', 'PETAL', 'PLUME', 'PRISM', 'PULSE', 'QUARTZ',
  'QUILL', 'RAVEN', 'RELIC', 'RIDGE', 'ROBIN', 'RUNIC', 'SABER', 'SHARD',
  'SOLAR', 'SPARK', 'SPIRE', 'STONE', 'STORM', 'SWIFT', 'TIDAL', 'TORCH',
  'TRAIL', 'VAULT', 'VERVE', 'VISTA', 'WAVE', 'WREN', 'ZEPHYR',
];

export function buildPuzzleForDate(
  dateKey: string,
  puzzleNumber: number,
  language?: DictionaryLanguageCode
): DailyPuzzle {
  const activeLang = normalizeDictionaryLanguage(language ?? getDictionaryLanguage());
  const seed = hashString(
    activeLang === 'en'
      ? `lexicon10_v3_${dateKey}_${puzzleNumber}`
      : `lexicon10_v3_${dateKey}_${puzzleNumber}_${activeLang}`
  );
  const rng = createSeededRng(seed);

  // Randomize target word count between 8 and 12 (inclusive: 8, 9, 10, 11, or 12)
  const targetWordCount = 8 + Math.floor(rng() * 5);

  const activeThemeBank =
    activeLang === 'en' ? THEME_BANK : MULTILANG_MPSEARCH_THEMES[activeLang];
  const themeIndex = (puzzleNumber - 1) % activeThemeBank.length;
  const cycleIndex = Math.floor((puzzleNumber - 1) / activeThemeBank.length);
  const baseTheme = activeThemeBank[themeIndex];
  const companionOffset =
    activeLang === 'en' ? 7 : 5 + (cycleIndex % Math.max(1, activeThemeBank.length - 1));
  const companionIndex =
    (themeIndex + (companionOffset % activeThemeBank.length === 0 ? 1 : companionOffset)) %
    activeThemeBank.length;
  const companionTheme = activeThemeBank[companionIndex];

  const cycleSuffixes = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII'];
  const themeTitle =
    activeLang === 'en'
      ? `${baseTheme.title}${cycleSuffixes[cycleIndex] || ''}`
      : cycleIndex > 0
      ? `${baseTheme.title} #${cycleIndex + 1}`
      : baseTheme.title;

  // Deterministically shuffle primary theme pool
  const primaryPool = [...baseTheme.pool]
    .map((w) => stripDiacritics(w).toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((w) => w.length >= 3 && w.length <= 9);

  for (let i = primaryPool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [primaryPool[i], primaryPool[j]] = [primaryPool[j], primaryPool[i]];
  }

  // Backup words (companion theme + supplemental crisp words) in case a 10x10 grid needs extra candidates to hit 11-12 words
  const langPack = activeLang === 'en' ? null : getMultiLangPack(activeLang);
  const supplementalSource =
    activeLang === 'en'
      ? SUPPLEMENTAL_SHORT_WORDS
      : (langPack?.words || []).filter((w) => w.length >= 4 && w.length <= 7).slice(0, 80);

  const backupPool = [...companionTheme.pool, ...supplementalSource]
    .map((w) => stripDiacritics(w).toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((w) => w.length >= 4 && w.length <= 7 && !primaryPool.includes(w));

  for (let i = backupPool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [backupPool[i], backupPool[j]] = [backupPool[j], backupPool[i]];
  }

  // Primary theme words sorted longer-first, followed by backup candidates
  const candidateWords = [
    ...Array.from(new Set(primaryPool)).sort((a, b) => b.length - a.length),
    ...Array.from(new Set(backupPool)).slice(0, 14),
  ];

  const grid: string[][] = Array.from({ length: 10 }, () => Array(10).fill(''));
  const cellDirs: { dr: number; dc: number; orientation: WordOrientation }[][][] = Array.from(
    { length: 10 },
    () => Array.from({ length: 10 }, () => [])
  );
  const placedWords: PlacedWord[] = [];

  const canPlaceWordAt = (
    word: string,
    startRow: number,
    startCol: number,
    dir: (typeof DIRECTIONS)[number],
    allowDiagonalOrthogonalCross = false
  ): { valid: boolean; cells: CellCoord[]; crossScore: number } => {
    const endRow = startRow + dir.dr * (word.length - 1);
    const endCol = startCol + dir.dc * (word.length - 1);
    if (endRow < 0 || endRow >= 10 || endCol < 0 || endCol >= 10) {
      return { valid: false, cells: [], crossScore: 0 };
    }

    const cells: CellCoord[] = [];
    let crossScore = 0;

    for (let k = 0; k < word.length; k++) {
      const r = startRow + dir.dr * k;
      const c = startCol + dir.dc * k;
      const existingChar = grid[r][c];

      if (existingChar !== '') {
        if (existingChar !== word[k]) {
          return { valid: false, cells: [], crossScore: 0 };
        }
        const existingDirsAtCell = cellDirs[r][c];
        if (existingDirsAtCell.length === 0) {
          return { valid: false, cells: [], crossScore: 0 };
        }
        // Always forbid collinear overlap along the same axis
        const hasCollinearOverlap = existingDirsAtCell.some(
          (ed) => ed.dr * dir.dc === ed.dc * dir.dr
        );
        if (hasCollinearOverlap) {
          return { valid: false, cells: [], crossScore: 0 };
        }
        if (
          !allowDiagonalOrthogonalCross &&
          !existingDirsAtCell.every((ed) => isOrthogonalOrDiagonalCross(ed, dir))
        ) {
          return { valid: false, cells: [], crossScore: 0 };
        }
        // Reward interior crossings
        const isInteriorLetter = k > 0 && k < word.length - 1;
        crossScore += isInteriorLetter ? 3 : 1;
      }
      cells.push({ row: r, col: c });
    }

    return { valid: true, cells, crossScore };
  };

  for (const word of candidateWords) {
    if (placedWords.length >= targetWordCount) break;
    if (placedWords.some((pw) => pw.word === word)) continue;

    const preferBackwards = placedWords.length % 2 === 1;
    let chosenPlacement: {
      startRow: number;
      startCol: number;
      dir: (typeof DIRECTIONS)[number];
      cells: CellCoord[];
      score: number;
    } | null = null;

    // Phase 1: Actively search for '+' (Horizontal x Vertical) and 'X' (Diagonal x Diagonal) overlaps
    if (placedWords.length > 0) {
      const crossCandidates: {
        startRow: number;
        startCol: number;
        dir: (typeof DIRECTIONS)[number];
        cells: CellCoord[];
        score: number;
      }[] = [];

      for (const dir of DIRECTIONS) {
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 10; c++) {
            const check = canPlaceWordAt(word, r, c, dir, false);
            if (check.valid && check.crossScore > 0) {
              const dirBonus = dir.isBackwards === preferBackwards ? 2 : 0;
              crossCandidates.push({
                startRow: r,
                startCol: c,
                dir,
                cells: check.cells,
                score: check.crossScore + dirBonus,
              });
            }
          }
        }
      }

      if (crossCandidates.length > 0) {
        crossCandidates.sort((a, b) => b.score - a.score);
        const topTierScore = crossCandidates[0].score;
        const bestPool = crossCandidates.filter((c) => c.score >= topTierScore - 1);
        chosenPlacement = bestPool[Math.floor(rng() * bestPool.length)];
      }
    }

    // Phase 2: Random placement if no '+' or 'X' crossing was available for this word
    if (!chosenPlacement) {
      for (let attempt = 0; attempt < 260; attempt++) {
        const dirIndex =
          attempt < 160
            ? preferBackwards
              ? 4 + Math.floor(rng() * 4)
              : Math.floor(rng() * DIRECTIONS.length)
            : Math.floor(rng() * DIRECTIONS.length);
        const dir = DIRECTIONS[dirIndex];
        const startRow = Math.floor(rng() * 10);
        const startCol = Math.floor(rng() * 10);
        const check = canPlaceWordAt(word, startRow, startCol, dir, false);
        if (check.valid) {
          chosenPlacement = {
            startRow,
            startCol,
            dir,
            cells: check.cells,
            score: check.crossScore,
          };
          break;
        }
      }
    }

    // Phase 3: Exhaustive scan (allowing any non-collinear intersection) so 10-12 word boards always fill cleanly
    if (!chosenPlacement) {
      const fallbackCandidates: {
        startRow: number;
        startCol: number;
        dir: (typeof DIRECTIONS)[number];
        cells: CellCoord[];
        score: number;
      }[] = [];

      for (const dir of DIRECTIONS) {
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 10; c++) {
            const check = canPlaceWordAt(word, r, c, dir, true);
            if (check.valid) {
              fallbackCandidates.push({
                startRow: r,
                startCol: c,
                dir,
                cells: check.cells,
                score: check.crossScore,
              });
            }
          }
        }
      }

      if (fallbackCandidates.length > 0) {
        fallbackCandidates.sort((a, b) => b.score - a.score);
        const pickIdx = Math.floor(rng() * Math.min(8, fallbackCandidates.length));
        chosenPlacement = fallbackCandidates[pickIdx];
      }
    }

    if (chosenPlacement) {
      const { startRow, startCol, dir, cells } = chosenPlacement;
      for (let k = 0; k < word.length; k++) {
        const r = cells[k].row;
        const c = cells[k].col;
        grid[r][c] = word[k];
        cellDirs[r][c].push({ dr: dir.dr, dc: dir.dc, orientation: dir.orientation });
      }
      placedWords.push({
        word,
        start: { row: startRow, col: startCol },
        end: {
          row: startRow + dir.dr * (word.length - 1),
          col: startCol + dir.dc * (word.length - 1),
        },
        cells,
        orientation: dir.orientation,
        directionArrow: dir.arrow,
        directionLabel: dir.label,
        isBackwards: dir.isBackwards,
        startColumnLetter: COLUMN_LETTERS[startCol],
        startRowNumber: startRow + 1,
        colorIndex: placedWords.length % 12,
      });
    }
  }

  // Fill remaining empty cells deterministically
  const activeFillerAlphabet =
    activeLang === 'en'
      ? FILLER_ALPHABET
      : langPack?.friendlyLetters || FILLER_ALPHABET;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (grid[r][c] === '') {
        const charIdx = Math.floor(rng() * activeFillerAlphabet.length);
        grid[r][c] = activeFillerAlphabet[charIdx];
      }
    }
  }

  // Sort placed words alphabetically for clean scanning in the word bank
  placedWords.sort((a, b) => a.word.localeCompare(b.word));
  placedWords.forEach((pw, idx) => {
    pw.colorIndex = idx % 12;
  });

  const [y, m, d] = dateKey.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const displayDate = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const weekdayShort = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  });
  const monthLabel = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const monthKey = `${y}-${String(m).padStart(2, '0')}`;

  return {
    dateKey,
    displayDate,
    weekdayShort,
    monthKey,
    monthLabel,
    puzzleNumber,
    themeTitle,
    category: baseTheme.category,
    grid,
    words: placedWords,
  };
}

// Generate 12 full months (368 days = original 6 months + another 6 months) of daily puzzles ending on reference date
export function generateTwelveMonthArchive(
  referenceDateStr: string = getLondonTodayDateStr(),
  language?: DictionaryLanguageCode
): DailyPuzzle[] {
  const activeLang = normalizeDictionaryLanguage(language ?? getDictionaryLanguage());
  const [ry, rm, rd] = referenceDateStr.split('-').map(Number);
  const endUtc = Date.UTC(ry, rm - 1, rd, 12, 0, 0);
  const totalDays = 368; // 12 full months (368 daily puzzles)
  const puzzles: DailyPuzzle[] = [];

  for (let i = 0; i < totalDays; i++) {
    const dayOffset = totalDays - 1 - i; // i=0 is oldest (#1), i=367 is today (#368)
    const dayTime = endUtc - dayOffset * 86400 * 1000;
    const dt = new Date(dayTime);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    const dateKey = `${yyyy}-${mm}-${dd}`;
    puzzles.push(buildPuzzleForDate(dateKey, i + 1, activeLang));
  }

  return puzzles;
}

// Keep generateSixMonthArchive alias returning the full expanded 12-month (368-day) archive
export function generateSixMonthArchive(
  referenceDateStr: string = getLondonTodayDateStr(),
  language?: DictionaryLanguageCode
): DailyPuzzle[] {
  return generateTwelveMonthArchive(referenceDateStr, language);
}

// Randomly pick a puzzle from the archive (avoiding the current puzzle if possible)
export function pickRandomArchivePuzzle(
  archive: DailyPuzzle[],
  excludeDateKey?: string,
  language?: DictionaryLanguageCode
): DailyPuzzle {
  if (archive.length === 0) {
    return buildPuzzleForDate(getLondonTodayDateStr(), 1, language);
  }
  const candidates =
    excludeDateKey && archive.length > 1
      ? archive.filter((p) => p.dateKey !== excludeDateKey)
      : archive;
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}

// Points awarded per word found based on word length (e.g., 5 letters = 50 pts, 7 letters = 70 pts, 8 letters = 80 pts)
export function calculateWordLengthPoints(word: string): number {
  const cleanLen = word.trim().length;
  return Math.max(10, cleanLen * 10);
}

export function calculatePuzzleScore(
  foundCount: number,
  totalWords: number,
  elapsedSeconds: number,
  hintsUsed: number,
  isCompleted: boolean
): number {
  const wordPoints = foundCount * 150;
  if (!isCompleted) {
    return Math.max(0, wordPoints - hintsUsed * 50);
  }
  // Completion bonus + speed bonus (up to 800 pts for finishing under 3 minutes)
  const completionBonus = 400;
  const speedBonus = Math.max(0, Math.round((300 - Math.min(300, elapsedSeconds)) * 2.5));
  const hintPenalty = hintsUsed * 75;
  return Math.max(200, wordPoints + completionBonus + speedBonus - hintPenalty);
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
