import { WordPuzzle, TileData, DifficultyMode, LayoutMode } from '../types';
import { dictionary } from '../../crowdle/dictionary';
import {
  getDictionaryLanguage,
  normalizeDictionaryLanguage,
  type DictionaryLanguageCode,
} from '../../lib/dictionary-languages';
import { getDeStackLanguageBank } from '../../data/dictionaries/multilang-search-themes';

export interface PatternSlot {
  gridX: number;
  gridY: number;
  layer: number;
}

// Standard Mode: 4 Layers, 30 Tiles (6 five-letter words)
export const STACKDOWN_PATTERN_NORMAL: PatternSlot[] = [
  // Layer 0 (Bottom - 10 tiles)
  { gridX: -1.0, gridY: -2.0, layer: 0 },
  { gridX:  1.0, gridY: -2.0, layer: 0 },
  { gridX: -2.0, gridY: -1.0, layer: 0 },
  { gridX: -2.0, gridY:  0.0, layer: 0 },
  { gridX: -2.0, gridY:  1.0, layer: 0 },
  { gridX:  2.0, gridY: -1.0, layer: 0 },
  { gridX:  2.0, gridY:  0.0, layer: 0 },
  { gridX:  2.0, gridY:  1.0, layer: 0 },
  { gridX: -1.0, gridY:  2.0, layer: 0 },
  { gridX:  1.0, gridY:  2.0, layer: 0 },

  // Layer 1 (8 tiles)
  { gridX: -0.5, gridY: -1.5, layer: 1 },
  { gridX:  0.5, gridY: -1.5, layer: 1 },
  { gridX: -1.5, gridY: -0.5, layer: 1 },
  { gridX: -1.5, gridY:  0.5, layer: 1 },
  { gridX:  1.5, gridY: -0.5, layer: 1 },
  { gridX:  1.5, gridY:  0.5, layer: 1 },
  { gridX: -0.5, gridY:  1.5, layer: 1 },
  { gridX:  0.5, gridY:  1.5, layer: 1 },

  // Layer 2 (8 tiles - 3x3 ring with empty center)
  { gridX: -1.0, gridY: -1.0, layer: 2 },
  { gridX:  0.0, gridY: -1.0, layer: 2 },
  { gridX:  1.0, gridY: -1.0, layer: 2 },
  { gridX: -1.0, gridY:  0.0, layer: 2 },
  { gridX:  1.0, gridY:  0.0, layer: 2 },
  { gridX: -1.0, gridY:  1.0, layer: 2 },
  { gridX:  0.0, gridY:  1.0, layer: 2 },
  { gridX:  1.0, gridY:  1.0, layer: 2 },

  // Layer 3 (Top - 4 tiles - 2x2 center)
  { gridX: -0.5, gridY: -0.5, layer: 3 },
  { gridX:  0.5, gridY: -0.5, layer: 3 },
  { gridX: -0.5, gridY:  0.5, layer: 3 },
  { gridX:  0.5, gridY:  0.5, layer: 3 },
];

// Hard Mode: 6 Layers, 50 Tiles (10 five-letter words)
export const STACKDOWN_PATTERN_HARD: PatternSlot[] = [
  // Layer 0 (Bottom - 8 outer apex & corner tiles)
  { gridX:  0.0, gridY: -3.0, layer: 0 },
  { gridX: -2.0, gridY: -2.0, layer: 0 },
  { gridX:  2.0, gridY: -2.0, layer: 0 },
  { gridX: -3.0, gridY:  0.0, layer: 0 },
  { gridX:  3.0, gridY:  0.0, layer: 0 },
  { gridX: -2.0, gridY:  2.0, layer: 0 },
  { gridX:  2.0, gridY:  2.0, layer: 0 },
  { gridX:  0.0, gridY:  3.0, layer: 0 },

  // Layer 1 (12 tiles)
  { gridX: -1.5, gridY: -2.5, layer: 1 },
  { gridX: -0.5, gridY: -2.5, layer: 1 },
  { gridX:  0.5, gridY: -2.5, layer: 1 },
  { gridX:  1.5, gridY: -2.5, layer: 1 },
  { gridX: -2.5, gridY: -0.5, layer: 1 },
  { gridX: -2.5, gridY:  0.5, layer: 1 },
  { gridX:  2.5, gridY: -0.5, layer: 1 },
  { gridX:  2.5, gridY:  0.5, layer: 1 },
  { gridX: -1.5, gridY:  2.5, layer: 1 },
  { gridX: -0.5, gridY:  2.5, layer: 1 },
  { gridX:  0.5, gridY:  2.5, layer: 1 },
  { gridX:  1.5, gridY:  2.5, layer: 1 },

  // Layer 2 (10 tiles)
  { gridX: -1.0, gridY: -2.0, layer: 2 },
  { gridX:  1.0, gridY: -2.0, layer: 2 },
  { gridX: -2.0, gridY: -1.0, layer: 2 },
  { gridX: -2.0, gridY:  0.0, layer: 2 },
  { gridX: -2.0, gridY:  1.0, layer: 2 },
  { gridX:  2.0, gridY: -1.0, layer: 2 },
  { gridX:  2.0, gridY:  0.0, layer: 2 },
  { gridX:  2.0, gridY:  1.0, layer: 2 },
  { gridX: -1.0, gridY:  2.0, layer: 2 },
  { gridX:  1.0, gridY:  2.0, layer: 2 },

  // Layer 3 (8 tiles)
  { gridX: -0.5, gridY: -1.5, layer: 3 },
  { gridX:  0.5, gridY: -1.5, layer: 3 },
  { gridX: -1.5, gridY: -0.5, layer: 3 },
  { gridX: -1.5, gridY:  0.5, layer: 3 },
  { gridX:  1.5, gridY: -0.5, layer: 3 },
  { gridX:  1.5, gridY:  0.5, layer: 3 },
  { gridX: -0.5, gridY:  1.5, layer: 3 },
  { gridX:  0.5, gridY:  1.5, layer: 3 },

  // Layer 4 (8 tiles - 3x3 ring with empty center)
  { gridX: -1.0, gridY: -1.0, layer: 4 },
  { gridX:  0.0, gridY: -1.0, layer: 4 },
  { gridX:  1.0, gridY: -1.0, layer: 4 },
  { gridX: -1.0, gridY:  0.0, layer: 4 },
  { gridX:  1.0, gridY:  0.0, layer: 4 },
  { gridX: -1.0, gridY:  1.0, layer: 4 },
  { gridX:  0.0, gridY:  1.0, layer: 4 },
  { gridX:  1.0, gridY:  1.0, layer: 4 },

  // Layer 5 (Top - 4 tiles - 2x2 center)
  { gridX: -0.5, gridY: -0.5, layer: 5 },
  { gridX:  0.5, gridY: -0.5, layer: 5 },
  { gridX: -0.5, gridY:  0.5, layer: 5 },
  { gridX:  0.5, gridY:  0.5, layer: 5 },
];

// Curated bank of 5-letter isograms (every word has 5 distinct letters)
const RAW_WORD_BANK: Array<{ word: string; hint: string }> = [
  { word: "WORST", hint: "Most severe or lowest in quality" },
  { word: "FLAME", hint: "Hot glowing tongue of fire" },
  { word: "CHINZ", hint: "Printed multicolored cotton fabric" },
  { word: "VAPOR", hint: "Visible mist or steam in the air" },
  { word: "KLUTZ", hint: "Clumsy or awkward person" },
  { word: "PIANO", hint: "Musical instrument with 88 keys" },
  { word: "GHOST", hint: "Spooky apparition haunting an old manor" },
  { word: "BLADE", hint: "Sharp cutting edge of a sword" },
  { word: "CHAIR", hint: "Four-legged seat with a backrest" },
  { word: "STARE", hint: "To look fixedly with wide eyes" },
  { word: "PLUMB", hint: "Vertical weight on a builder's line" },
  { word: "HOUSE", hint: "Building where a family lives" },
  { word: "TRAIN", hint: "Locomotive pulling railway carriages" },
  { word: "BEACH", hint: "Pebbly or sandy ocean shoreline" },
  { word: "LIGHT", hint: "Illumination that banishes the dark" },
  { word: "CROWN", hint: "Royal headwear adorned with jewels" },
  { word: "WATER", hint: "Clear liquid flowing in rivers and rain" },
  { word: "STONE", hint: "Hard solid mineral rock" },
  { word: "PLANT", hint: "Leafy organism growing in soil" },
  { word: "CLOUD", hint: "White vapor floating high in the sky" },
  { word: "EARTH", hint: "Third planet from the sun" },
  { word: "BRISK", hint: "Active, fast, and energetic pace" },
  { word: "BRAVE", hint: "Showing courage in the face of danger" },
  { word: "SMART", hint: "Quick-witted and intelligent" },
  { word: "SWIFT", hint: "Moving with great speed" },
  { word: "CLEAN", hint: "Spotless and free from dirt" },
  { word: "FRESH", hint: "Newly picked or invigorating" },
  { word: "GLORY", hint: "High renown and honor won by notable deeds" },
  { word: "MUSIC", hint: "Art of harmonious melody and rhythm" },
  { word: "DANCE", hint: "Move rhythmically to a beat" },
  { word: "RADIO", hint: "Wireless receiver for audio broadcasts" },
  { word: "VOICE", hint: "Sound produced by the vocal cords" },
  { word: "SOUND", hint: "Vibrations that travel through the air" },
  { word: "TEMPO", hint: "Speed at which a musical passage is played" },
  { word: "STORM", hint: "Tempest with heavy rain and thunder" },
  { word: "WINDY", hint: "Breezy weather with strong gusts" },
  { word: "FROST", hint: "Ice crystals forming on cold grass" },
  { word: "SPARK", hint: "Tiny fiery particle thrown from embers" },
  { word: "DRIFT", hint: "Pile of snow driven together by the wind" },
  { word: "GLEAM", hint: "Faint or brief light shining softly" },
  { word: "OCEAN", hint: "Vast body of saltwater covering the globe" },
  { word: "CORAL", hint: "Colorful marine reef builder" },
  { word: "SHARK", hint: "Cartilaginous ocean predator with fins" },
  { word: "WHALE", hint: "Giant marine mammal that sings" },
  { word: "PEARL", hint: "Lustrous gem formed inside an oyster" },
  { word: "TIDES", hint: "Daily rise and fall of the sea" },
  { word: "QUEST", hint: "Long search for an elusive goal" },
  { word: "MAGIC", hint: "Supernatural power of wizards" },
  { word: "SWORD", hint: "Knight's forged steel weapon" },
  { word: "TOWER", hint: "Tall castle keep reaching into the sky" },
  { word: "GUARD", hint: "Watchful sentry protecting the gate" },
  { word: "FAIRY", hint: "Winged mythical woodland sprite" },
  { word: "BREAD", hint: "Baked loaf risen with yeast" },
  { word: "ROAST", hint: "Cook meat or vegetables in an oven" },
  { word: "SPICE", hint: "Aromatic seed or bark used for seasoning" },
  { word: "FEAST", hint: "Lavish celebratory banquet" },
  { word: "JUICE", hint: "Liquid pressed from fresh fruit" },
  { word: "HONEY", hint: "Sweet golden nectar made by bees" },
  { word: "TIGER", hint: "Striped big cat prowling the jungle" },
  { word: "ZEBRA", hint: "African equid with black-and-white stripes" },
  { word: "VIPER", hint: "Venomous fanged serpent" },
  { word: "HAWKS", hint: "Keen-eyed birds of prey soaring high" },
  { word: "CRANE", hint: "Tall wading bird or construction hoist" },
  { word: "FINCH", hint: "Small seed-eating songbird" },
  { word: "HOUND", hint: "Scent-tracking hunting dog" },
  { word: "CAMEL", hint: "Desert pack animal with a hump" },
  { word: "BISON", hint: "Shaggy-maned plains buffalo" },
  { word: "SLOTH", hint: "Slow-moving tree-dwelling mammal" },
  { word: "BADGE", hint: "Emblem or shield worn as a sign of office" },
  { word: "VAULT", hint: "Secure underground chamber or arched roof" },
  { word: "PRISM", hint: "Glass wedge that splits white light into rainbows" },
  { word: "TORCH", hint: "Portable handheld flaming light" },
  { word: "ANVIL", hint: "Heavy iron block used by a blacksmith" },
  { word: "LATCH", hint: "Metal bar that fastens a gate or door" },
  { word: "CHALK", hint: "Soft white limestone stick for blackboards" },
  { word: "BRUSH", hint: "Implement with bristles for painting or sweeping" },
  { word: "QUILT", hint: "Warm stitched bedcover made of patchwork" },
  { word: "CLOAK", hint: "Sleeveless outdoor mantle or cape" },
  { word: "SCARF", hint: "Fabric wrap worn around the neck for warmth" },
  { word: "GLOVE", hint: "Hand covering with separate sheaths for each finger" },
  { word: "SANDY", hint: "Covered with fine loose grains of quartz" },
  { word: "ROCKY", hint: "Full of rugged boulders and crags" },
  { word: "MISTY", hint: "Shrouded in light fog or drizzle" },
  { word: "DUSKY", hint: "Dimly lit like twilight" },
  { word: "SNOWY", hint: "Blanketed in white winter flakes" },
  { word: "LEAFY", hint: "Shaded by abundant green foliage" },
  { word: "SPICY", hint: "Seasoned with hot piquant peppers" },
  { word: "SALTY", hint: "Tasting of sea brine" },
  { word: "ZESTY", hint: "Lively, tangy, and full of citrus flavor" },
  { word: "MINTY", hint: "Cool and refreshing like peppermint" },
  { word: "MILKY", hint: "Opaque white like fresh dairy" },
  { word: "SILKY", hint: "Smooth, lustrous, and soft to the touch" },
  { word: "VELDT", hint: "Open uncultivated grassland of southern Africa" },
  { word: "FJORD", hint: "Long narrow sea inlet between steep cliffs" },
  { word: "MARSH", hint: "Low-lying wetland with reeds and sedges" },
  { word: "DELTA", hint: "Triangular river mouth formed by sediment" },
  { word: "BASIN", hint: "Natural depression or bowl for holding water" },
  { word: "RIDGE", hint: "Long narrow hilltop or mountain crest" },
  { word: "SLOPE", hint: "Inclined mountainside or hill" },
  { word: "GLADE", hint: "Open sunlit clearing in a forest" },
  { word: "GROVE", hint: "Small orchard or group of trees" },
  { word: "SHRUB", hint: "Woody plant smaller than a tree" },
  { word: "FERNS", hint: "Feathery flowerless woodland plants" },
  { word: "THORN", hint: "Sharp woody prickle on a rose stem" },
  { word: "PETAL", hint: "Colorful segment of a blooming flower" },
  { word: "ACORN", hint: "Smooth oval nut of the oak tree" },
  { word: "MAPLE", hint: "Tree known for autumn foliage and sweet syrup" },
  { word: "BIRCH", hint: "Slender tree with peeling white bark" },
  { word: "CEDAR", hint: "Fragrant evergreen coniferous tree" },
  { word: "LEMON", hint: "Tart yellow citrus fruit" },
  { word: "MELON", hint: "Sweet juicy gourd fruit" },
  { word: "PEACH", hint: "Fuzzy-skinned stone fruit" },
  { word: "PLUMS", hint: "Smooth purple or red stone fruits" },
  { word: "GRAPE", hint: "Vine fruit pressed to make wine" },
  { word: "MANGO", hint: "Sweet tropical stone fruit with orange flesh" },
  { word: "OLIVE", hint: "Small Mediterranean fruit pressed for oil" },
  { word: "PECAN", hint: "Rich buttery hickory nut" },
  { word: "WHEAT", hint: "Cereal grain ground into flour" },
  { word: "GRAIN", hint: "Harvested seed of cereal crops" },
  { word: "SYRUP", hint: "Thick sweet liquid boiled from sugar or sap" },
  { word: "BACON", hint: "Cured and smoked strips of pork" },
  { word: "STEAK", hint: "Thick slice of grilled beef" },
  { word: "BROTH", hint: "Savory clear soup simmered from stock" },
  { word: "SAUCE", hint: "Flavorful liquid condiment served on food" },
  { word: "CIDER", hint: "Beverage pressed from crisp apples" },
  { word: "YACHT", hint: "Sleek sailing vessel for cruising" },
  { word: "BARGE", hint: "Flat-bottomed canal freight boat" },
  { word: "CANOE", hint: "Light narrow craft propelled with paddles" },
  { word: "PLANE", hint: "Winged aircraft soaring through the sky" },
  { word: "TRUCK", hint: "Heavy motor vehicle for hauling cargo" },
  { word: "WAGON", hint: "Four-wheeled cart drawn by horses" },
  { word: "SPOKE", hint: "Rod connecting the hub of a wheel to its rim" },
  { word: "BRAKE", hint: "Device for slowing or stopping a vehicle" },
  { word: "PEDAL", hint: "Foot-operated lever on a bicycle or piano" },
  { word: "FLOCK", hint: "Group of birds flying or sheep grazing together" },
  { word: "GLYPH", hint: "Carved ancient hieroglyphic symbol" },
  { word: "JOUST", hint: "Medieval mounted combat with lances" },
  { word: "KNIFE", hint: "Sharp kitchen blade with a handle" },
  { word: "QUART", hint: "Liquid unit equal to two pints" },
  { word: "QUASH", hint: "Put a decisive end to a rebellion or rumor" },
  { word: "WRIST", hint: "Joint connecting the hand to the forearm" },
  { word: "WRECK", hint: "Sunken ship or badly damaged vehicle" },
  { word: "PLUCK", hint: "Pull feathers or pick strings boldly" },
  { word: "JUMPY", hint: "Nervous, twitchy, and easily startled" },
  { word: "FUDGE", hint: "Rich soft confection made from sugar and butter" },
  { word: "BULKY", hint: "Large, heavy, and awkward to carry" },
  { word: "GAUZE", hint: "Thin woven medical bandage fabric" },
  { word: "CHIMP", hint: "Clever great ape native to African forests" },
  { word: "BLIMP", hint: "Soft non-rigid airship floating overhead" },
  { word: "CRUMB", hint: "Tiny fragment broken off from bread or cake" },
  { word: "SWAMP", hint: "Wet spongy bog dotted with cypress trees" },
  { word: "DWARF", hint: "Mythical bearded miner of mountains and caves" },
  { word: "NYMPH", hint: "Graceful nature spirit of streams and woods" },
  { word: "BOXER", hint: "Athlete who fights with padded gloves in a ring" },
  { word: "JOKER", hint: "Wild card in a deck wearing a jester's cap" },
  { word: "VIXEN", hint: "Clever female fox with a russet coat" },
  { word: "WALTZ", hint: "Graceful ballroom dance in three-quarter time" },
  { word: "TOXIC", hint: "Poisonous or harmful if swallowed" },
  { word: "OPIUM", hint: "Poppy latex extract studied in pharmacology" },
  { word: "PROXY", hint: "Authorized stand-in voting on someone's behalf" },
  { word: "QUIPU", hint: "Inca record-keeping knotted cord" },
];

// Deduplicate by word and ensure 5 distinct letters
const SEEN_WORDS = new Set<string>();
const WORD_BANK = RAW_WORD_BANK.filter(item => {
  if (item.word.length !== 5) return false;
  if (!/^[A-Z]{5}$/.test(item.word)) return false;
  if (new Set(item.word.split('')).size !== 5) return false;
  if (SEEN_WORDS.has(item.word)) return false;
  SEEN_WORDS.add(item.word);
  return true;
});

const WORD_MASKS = new Uint32Array(WORD_BANK.length);
const WORD_FIRST_BITS = new Uint32Array(WORD_BANK.length);
const WORD_CHAR_BITS = new Uint32Array(WORD_BANK.length * 5);

for (let i = 0; i < WORD_BANK.length; i++) {
  const w = WORD_BANK[i].word;
  let mask = 0;
  for (let k = 0; k < 5; k++) {
    const bit = 1 << (w.charCodeAt(k) - 65);
    WORD_CHAR_BITS[i * 5 + k] = bit;
    mask |= bit;
    if (k === 0) WORD_FIRST_BITS[i] = bit;
  }
  WORD_MASKS[i] = mask;
}

// Comprehensive 5-letter English word dictionary (~7,100+ words including inflections,
// repeated-letter words, plurals, and anagrams) used to enforce STRICT uniqueness so ONLY
// the target word can be spelled from the board at every single step.
const DICT5_SET = new Set<string>();
for (const raw of dictionary[5] || []) {
  const up = raw.trim().toUpperCase();
  if (/^[A-Z]{5}$/.test(up)) DICT5_SET.add(up);
}
for (const item of WORD_BANK) {
  DICT5_SET.add(item.word);
}

const DICT5_WORDS = Array.from(DICT5_SET);
const DICT5_LEN = DICT5_WORDS.length;
const DICT5_MASKS = new Uint32Array(DICT5_LEN);
const DICT5_CHARS = new Uint8Array(DICT5_LEN * 5);
const DICT5_BUCKETS: number[][] = Array.from({ length: 26 }, () => []);

for (let i = 0; i < DICT5_LEN; i++) {
  const w = DICT5_WORDS[i];
  let mask = 0;
  for (let k = 0; k < 5; k++) {
    const code = w.charCodeAt(k);
    DICT5_CHARS[i * 5 + k] = code;
    mask |= 1 << (code - 65);
  }
  DICT5_MASKS[i] = mask;
  DICT5_BUCKETS[w.charCodeAt(0) - 65].push(i);
}

const PUZZLE_CACHE = new Map<string, WordPuzzle>();

// Deterministic PRNG (Mulberry32)
function createPRNG(seed: number) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Helper to get London date string (YYYY-MM-DD)
export function getLondonDateString(date: Date = new Date()): string {
  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    return formatter.format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

export function generateDailyPuzzle(
  dateStr: string,
  difficulty: DifficultyMode = 'normal',
  layoutMode: LayoutMode = 'daily',
  roundSeed: number = 0,
  language?: DictionaryLanguageCode
): WordPuzzle {
  const activeLang = normalizeDictionaryLanguage(language ?? getDictionaryLanguage());
  const cacheKey =
    activeLang === 'en'
      ? `${dateStr}|${difficulty}|${layoutMode}|${roundSeed}`
      : `${dateStr}|${difficulty}|${layoutMode}|${roundSeed}|${activeLang}`;
  const cached = PUZZLE_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const baseSeedKey =
    roundSeed > 0
      ? `${dateStr}-${difficulty}-${layoutMode}-round-${roundSeed}-V5`
      : `${dateStr}-${difficulty}-${layoutMode}-V5`;
  const seedKey = activeLang === 'en' ? baseSeedKey : `${baseSeedKey}-${activeLang}`;
  let baseHash = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    baseHash ^= seedKey.charCodeAt(i);
    baseHash = Math.imul(baseHash, 16777619);
  }

  const langBank = activeLang === 'en' ? null : getDeStackLanguageBank(activeLang);
  const activeWordBank = langBank ? langBank.wordBank : WORD_BANK;
  const activeWordMasks = langBank ? langBank.wordMasks : WORD_MASKS;
  const activeWordCharBits = langBank ? langBank.wordCharBits : WORD_CHAR_BITS;
  const activeDict5Words = langBank ? langBank.dict5Words : DICT5_WORDS;
  const activeDict5Masks = langBank ? langBank.dict5Masks : DICT5_MASKS;
  const activeDict5Chars = langBank ? langBank.dict5Chars : DICT5_CHARS;
  const activeDict5Buckets = langBank ? langBank.dict5Buckets : DICT5_BUCKETS;

  const patternSeedDate = roundSeed > 0 ? `${dateStr}-r${roundSeed}` : dateStr;
  const pattern = getPatternForMode(difficulty, layoutMode, patternSeedDate);
  const wordCount = difficulty === 'hard' ? 10 : 6;
  const totalLayers = difficulty === 'hard' ? 6 : 4;
  const totalSlots = pattern.length;

  // Precompute coverage graph: coveredByIndices[i] = list of slots j on higher layers covering slot i
  const coveredByIndices: number[][] = pattern.map((s1, i) => {
    const covering: number[] = [];
    pattern.forEach((s2, j) => {
      if (i !== j && s2.layer > s1.layer) {
        const dx = Math.abs(s1.gridX - s2.gridX);
        const dy = Math.abs(s1.gridY - s2.gridY);
        if (dx <= 0.55 && dy <= 0.55) {
          covering.push(j);
        }
      }
    });
    return covering;
  });

  const coversIndices: number[][] = pattern.map((_, i) =>
    coveredByIndices
      .map((cs, j) => (cs.includes(i) ? j : -1))
      .filter(j => j >= 0)
  );

  const clearedFlags = new Uint8Array(totalSlots);
  const assignedStepBits = new Uint32Array(totalSlots);
  const assignedSlotCodes = new Uint8Array(totalSlots);
  const chosenWordBankIndices: number[] = new Array(wordCount).fill(0);
  const usedBankSet = new Uint8Array(activeWordBank.length);

  let finalAssignedSlotCodes: Uint8Array | null = null;
  let finalChosenWordBankIndices: number[] | null = null;

  const MAX_ATTEMPTS = 500;
  const MAX_SEARCH_CALLS = 350;
  const MAX_BRANCH_TRIES = 4;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = createPRNG((baseHash + Math.imul(attempt, 2654435761)) >>> 0);

    // Step 1: Build a narrow-frontier unstacking sequence `slotOrder[0 .. totalSlots-1]`
    const slotOrder: number[] = [];
    const exposedAtStep: number[][] = [];
    const removedSlots = new Set<number>();

    for (let step = 0; step < totalSlots; step++) {
      const currentlyExposed: number[] = [];
      for (let s = 0; s < totalSlots; s++) {
        if (removedSlots.has(s)) continue;
        if (coveredByIndices[s].every(cov => removedSlots.has(cov))) {
          currentlyExposed.push(s);
        }
      }
      exposedAtStep.push(currentlyExposed);

      const scoredCandidates = currentlyExposed.map(s => {
        let newlyUncoveredCount = 0;
        const subs = coversIndices[s];
        for (let i = 0; i < subs.length; i++) {
          const sub = subs[i];
          if (removedSlots.has(sub)) continue;
          const allOthersRemoved = coveredByIndices[sub].every(
            cov => cov === s || removedSlots.has(cov)
          );
          if (allOthersRemoved) {
            newlyUncoveredCount++;
          }
        }

        const widePenalty =
          currentlyExposed.length >= 6
            ? newlyUncoveredCount * 12
            : newlyUncoveredCount * 3 - pattern[s].layer * 0.5;

        return { slot: s, score: widePenalty + (rng() - 0.5) * 4 };
      });

      scoredCandidates.sort((a, b) => a.score - b.score);
      const chosenSlot = scoredCandidates[0].slot;

      slotOrder.push(chosenSlot);
      removedSlots.add(chosenSlot);
    }

    const stepOfSlot: number[] = new Array(totalSlots).fill(0);
    for (let t = 0; t < totalSlots; t++) {
      stepOfSlot[slotOrder[t]] = t;
    }

    // Verify every future word wj > wi has at least one slot blocked by a slot in [wi*5 .. wj*5 - 1]
    let blockOk = true;
    for (let wi = 0; wi < wordCount - 1 && blockOk; wi++) {
      for (let wj = wi + 1; wj < wordCount && blockOk; wj++) {
        let hasBlocker = false;
        for (let k = 0; k < 5; k++) {
          const sj = slotOrder[wj * 5 + k];
          const covs = coveredByIndices[sj];
          for (let c = 0; c < covs.length; c++) {
            const stC = stepOfSlot[covs[c]];
            if (stC >= wi * 5 && stC < wj * 5) {
              hasBlocker = true;
              break;
            }
          }
          if (hasBlocker) break;
        }
        if (!hasBlocker) blockOk = false;
      }
    }
    if (!blockOk) continue;

    const otherExposedStepsAtStep: number[][] = Array.from({ length: totalSlots }, (_, t) => {
      const slotT = slotOrder[t];
      return exposedAtStep[t]
        .filter(s => s !== slotT)
        .map(s => stepOfSlot[s]);
    });

    const shuffledBankIndices = activeWordBank.map((_, i) => i);
    for (let i = shuffledBankIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledBankIndices[i], shuffledBankIndices[j]] = [shuffledBankIndices[j], shuffledBankIndices[i]];
    }

    function canFormDictWordFromStep(startStep: number, dictWordOffset: number): boolean {
      clearedFlags.fill(0);
      for (let u = 0; u < startStep; u++) {
        clearedFlags[slotOrder[u]] = 1;
      }

      function dfs(letterIdx: number): boolean {
        if (letterIdx === 5) return true;
        const targetCode = activeDict5Chars[dictWordOffset + letterIdx];

        for (let s = 0; s < totalSlots; s++) {
          if (clearedFlags[s]) continue;
          if (assignedSlotCodes[s] !== targetCode) continue;
          const covs = coveredByIndices[s];
          let isExp = true;
          for (let c = 0; c < covs.length; c++) {
            if (!clearedFlags[covs[c]]) {
              isExp = false;
              break;
            }
          }
          if (!isExp) continue;

          clearedFlags[s] = 1;
          if (dfs(letterIdx + 1)) return true;
          clearedFlags[s] = 0;
        }
        return false;
      }

      return dfs(0);
    }

    usedBankSet.fill(0);
    assignedStepBits.fill(0);
    assignedSlotCodes.fill(0);
    let searchCalls = 0;

    function solveWordReverse(wordIdx: number): boolean {
      if (wordIdx < 0) return true;
      searchCalls++;
      if (searchCalls > MAX_SEARCH_CALLS) return false;

      const baseStep = wordIdx * 5;
      const forbiddenMasks = [0, 0, 0, 0, 0];
      for (let k = 0; k < 5; k++) {
        const otherSteps = otherExposedStepsAtStep[baseStep + k];
        let fMask = 0;
        for (let c = 0; c < otherSteps.length; c++) {
          fMask |= assignedStepBits[otherSteps[c]];
        }
        forbiddenMasks[k] = fMask;
      }

      let remainingMask = 0;
      for (let st = baseStep + 5; st < totalSlots; st++) {
        remainingMask |= assignedStepBits[st];
      }

      let branchTries = 0;

      for (let i = 0; i < shuffledBankIndices.length; i++) {
        const bankIdx = shuffledBankIndices[i];
        if (usedBankSet[bankIdx]) continue;

        const baseOffset = bankIdx * 5;
        if (
          (activeWordCharBits[baseOffset] & forbiddenMasks[0]) ||
          (activeWordCharBits[baseOffset + 1] & forbiddenMasks[1]) ||
          (activeWordCharBits[baseOffset + 2] & forbiddenMasks[2]) ||
          (activeWordCharBits[baseOffset + 3] & forbiddenMasks[3]) ||
          (activeWordCharBits[baseOffset + 4] & forbiddenMasks[4])
        ) {
          continue;
        }

        const candidateWord = activeWordBank[bankIdx].word;
        for (let k = 0; k < 5; k++) {
          const step = baseStep + k;
          assignedStepBits[step] = activeWordCharBits[baseOffset + k];
          assignedSlotCodes[slotOrder[step]] = candidateWord.charCodeAt(k);
        }

        let exposedStartMask = 0;
        const expStartSlots = exposedAtStep[baseStep];
        for (let e = 0; e < expStartSlots.length; e++) {
          exposedStartMask |= assignedStepBits[stepOfSlot[expStartSlots[e]]];
        }
        const totalRemMask = remainingMask | activeWordMasks[bankIdx];

        // Strictly forbid ANY other 5-letter word in the active language dictionary
        // from being formable from the board at this step. Only iterate buckets of exposed first letters.
        let valid = true;
        for (let c = 0; c < 26 && valid; c++) {
          if ((exposedStartMask & (1 << c)) === 0) continue;
          const bucket = activeDict5Buckets[c];
          for (let bi = 0; bi < bucket.length; bi++) {
            const dIdx = bucket[bi];
            if ((activeDict5Masks[dIdx] & totalRemMask) !== activeDict5Masks[dIdx]) continue;
            if (activeDict5Words[dIdx] === candidateWord) continue;
            if (canFormDictWordFromStep(baseStep, dIdx * 5)) {
              valid = false;
              break;
            }
          }
        }

        if (valid) {
          usedBankSet[bankIdx] = 1;
          chosenWordBankIndices[wordIdx] = bankIdx;

          if (solveWordReverse(wordIdx - 1)) {
            return true;
          }

          usedBankSet[bankIdx] = 0;
          branchTries++;
          if (branchTries >= MAX_BRANCH_TRIES) {
            for (let k = 0; k < 5; k++) {
              const step = baseStep + k;
              assignedStepBits[step] = 0;
              assignedSlotCodes[slotOrder[step]] = 0;
            }
            return false;
          }
        }

        for (let k = 0; k < 5; k++) {
          const step = baseStep + k;
          assignedStepBits[step] = 0;
          assignedSlotCodes[slotOrder[step]] = 0;
        }

        if (searchCalls > MAX_SEARCH_CALLS) {
          return false;
        }
      }

      return false;
    }

    if (solveWordReverse(wordCount - 1)) {
      finalAssignedSlotCodes = new Uint8Array(assignedSlotCodes);
      finalChosenWordBankIndices = [...chosenWordBankIndices];
      break;
    }
  }

  // Defensive fallback only if all attempts failed (never expected with 500 attempts)
  const finalAssignedSlotLetters: string[] = new Array(totalSlots).fill('A');
  if (!finalAssignedSlotCodes || !finalChosenWordBankIndices) {
    finalChosenWordBankIndices = activeWordBank.slice(0, wordCount).map((_, i) => i);
    for (let w = 0; w < wordCount; w++) {
      for (let k = 0; k < 5; k++) {
        finalAssignedSlotLetters[w * 5 + k] = activeWordBank[w].word[k];
      }
    }
  } else {
    for (let s = 0; s < totalSlots; s++) {
      finalAssignedSlotLetters[s] = String.fromCharCode(finalAssignedSlotCodes[s]);
    }
  }

  const words = finalChosenWordBankIndices.map(idx => activeWordBank[idx].word);
  const hints = finalChosenWordBankIndices.map(idx => activeWordBank[idx].hint);

  const maxAbsX = pattern.reduce(
    (acc, s) => Math.max(acc, Math.abs(s.gridX)),
    2.0
  );
  const maxAbsY = pattern.reduce(
    (acc, s) => Math.max(acc, Math.abs(s.gridY)),
    2.0
  );
  const targetHalfSpanX = difficulty === 'hard' ? 42.0 : 39.5;
  const targetHalfSpanY = difficulty === 'hard' ? 39.0 : 36.5;
  const stepPctX = targetHalfSpanX / maxAbsX;
  const stepPctY = targetHalfSpanY / maxAbsY;

  const tilePrefix =
    activeLang === 'en'
      ? `tile-${dateStr}-${difficulty}`
      : `tile-${dateStr}-${difficulty}-${activeLang}`;
  const tiles: TileData[] = pattern.map((slot, idx) => {
    const id = `${tilePrefix}-${idx}`;
    const coveredBy = coveredByIndices[idx].map(covIdx => `${tilePrefix}-${covIdx}`);
    return {
      id,
      letter: finalAssignedSlotLetters![idx],
      x: 50 + slot.gridX * stepPctX,
      y: 54 + slot.gridY * stepPctY,
      layer: slot.layer,
      coveredBy,
      isExposed: coveredBy.length === 0,
      inRackIndex: null,
      isCleared: false,
    };
  });

  const baseDate = new Date('2026-01-01');
  const currDate = new Date(dateStr);
  const diffTime = Math.abs(currDate.getTime() - baseDate.getTime());
  const dayIndex = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);

  const puzzle: WordPuzzle = {
    id: dateStr,
    difficulty,
    totalLayers,
    dayIndex: dayIndex > 180 ? (dayIndex % 180) + 1 : dayIndex,
    dateString: dateStr,
    words,
    hints,
    tiles,
  };
  PUZZLE_CACHE.set(cacheKey, puzzle);
  return puzzle;
}

export function getArchiveDateBounds(): { minDateStr: string; maxDateStr: string } {
  const todayStr = getLondonDateString();
  const [y, m, d] = todayStr.split('-').map(Number);
  const todayUtc = new Date(Date.UTC(y, m - 1, d));
  const minUtc = new Date(todayUtc);
  minUtc.setUTCDate(todayUtc.getUTCDate() - 179); // 180 days total ending today
  const minDateStr = minUtc.toISOString().split('T')[0];
  return { minDateStr, maxDateStr: todayStr };
}

export function isPuzzleDateAvailable(dateStr: string): boolean {
  const { minDateStr, maxDateStr } = getArchiveDateBounds();
  return dateStr >= minDateStr && dateStr <= maxDateStr;
}

export function get6MonthsPuzzleDates(): Array<{ dateStr: string; dayIndex: number; title: string }> {
  const dates: Array<{ dateStr: string; dayIndex: number; title: string }> = [];
  const todayStr = getLondonDateString();
  const [y, m, d] = todayStr.split('-').map(Number);
  const todayUtc = new Date(Date.UTC(y, m - 1, d));

  for (let i = -179; i <= 0; i++) {
    const dt = new Date(todayUtc);
    dt.setUTCDate(todayUtc.getUTCDate() + i);
    const dateStr = dt.toISOString().split('T')[0];
    const dayIndex = i + 180;

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
    const title = dt.toLocaleDateString('en-GB', options);

    dates.push({ dateStr, dayIndex, title });
  }

  return dates;
}

// =========================================================================
// 5 DISTINCT MULTI-LAYER TILE LAYOUTS FOR NORMAL MODE (4 Layers, 30 Tiles)
// Every layout uses disjoint integer coords on even layers (0, 2) and
// disjoint half-integer coords on odd layers (1, 3) so all 30 tiles have
// unique positions and only overlap diagonally at corners (>=95% letter visibility).
// =========================================================================

// 1. Classic Diamond (pyramid)
export const PATTERN_NORMAL_PYRAMID: PatternSlot[] = [
  // Layer 0 (10 tiles - integer)
  { gridX: -1.0, gridY: -2.0, layer: 0 }, { gridX:  1.0, gridY: -2.0, layer: 0 },
  { gridX: -2.0, gridY: -1.0, layer: 0 }, { gridX: -2.0, gridY:  0.0, layer: 0 },
  { gridX: -2.0, gridY:  1.0, layer: 0 }, { gridX:  2.0, gridY: -1.0, layer: 0 },
  { gridX:  2.0, gridY:  0.0, layer: 0 }, { gridX:  2.0, gridY:  1.0, layer: 0 },
  { gridX: -1.0, gridY:  2.0, layer: 0 }, { gridX:  1.0, gridY:  2.0, layer: 0 },
  // Layer 1 (8 tiles - half-integer)
  { gridX: -0.5, gridY: -1.5, layer: 1 }, { gridX:  0.5, gridY: -1.5, layer: 1 },
  { gridX: -1.5, gridY: -0.5, layer: 1 }, { gridX: -1.5, gridY:  0.5, layer: 1 },
  { gridX:  1.5, gridY: -0.5, layer: 1 }, { gridX:  1.5, gridY:  0.5, layer: 1 },
  { gridX: -0.5, gridY:  1.5, layer: 1 }, { gridX:  0.5, gridY:  1.5, layer: 1 },
  // Layer 2 (8 tiles - integer)
  { gridX: -1.0, gridY: -1.0, layer: 2 }, { gridX:  0.0, gridY: -1.0, layer: 2 },
  { gridX:  1.0, gridY: -1.0, layer: 2 }, { gridX: -1.0, gridY:  0.0, layer: 2 },
  { gridX:  1.0, gridY:  0.0, layer: 2 }, { gridX: -1.0, gridY:  1.0, layer: 2 },
  { gridX:  0.0, gridY:  1.0, layer: 2 }, { gridX:  1.0, gridY:  1.0, layer: 2 },
  // Layer 3 (4 tiles - half-integer)
  { gridX: -0.5, gridY: -0.5, layer: 3 }, { gridX:  0.5, gridY: -0.5, layer: 3 },
  { gridX: -0.5, gridY:  0.5, layer: 3 }, { gridX:  0.5, gridY:  0.5, layer: 3 },
];

// 2. Twin Towers (twin_towers)
export const PATTERN_NORMAL_TOWERS: PatternSlot[] = [
  // Layer 0 (10 tiles: 5 left, 5 right - integer)
  { gridX: -2.0, gridY: -2.0, layer: 0 }, { gridX: -1.0, gridY: -2.0, layer: 0 },
  { gridX: -2.0, gridY:  0.0, layer: 0 }, { gridX: -2.0, gridY:  2.0, layer: 0 }, { gridX: -1.0, gridY:  2.0, layer: 0 },
  { gridX:  1.0, gridY: -2.0, layer: 0 }, { gridX:  2.0, gridY: -2.0, layer: 0 },
  { gridX:  2.0, gridY:  0.0, layer: 0 }, { gridX:  1.0, gridY:  2.0, layer: 0 }, { gridX:  2.0, gridY:  2.0, layer: 0 },
  // Layer 1 (8 tiles: 4 left, 4 right - half-integer)
  { gridX: -2.5, gridY: -1.5, layer: 1 }, { gridX: -0.5, gridY: -1.5, layer: 1 },
  { gridX: -2.5, gridY:  1.5, layer: 1 }, { gridX: -0.5, gridY:  1.5, layer: 1 },
  { gridX:  0.5, gridY: -1.5, layer: 1 }, { gridX:  2.5, gridY: -1.5, layer: 1 },
  { gridX:  0.5, gridY:  1.5, layer: 1 }, { gridX:  2.5, gridY:  1.5, layer: 1 },
  // Layer 2 (8 tiles: 4 left, 4 right - integer)
  { gridX: -2.0, gridY: -1.0, layer: 2 }, { gridX: -1.0, gridY: -1.0, layer: 2 },
  { gridX: -2.0, gridY:  1.0, layer: 2 }, { gridX: -1.0, gridY:  1.0, layer: 2 },
  { gridX:  1.0, gridY: -1.0, layer: 2 }, { gridX:  2.0, gridY: -1.0, layer: 2 },
  { gridX:  1.0, gridY:  1.0, layer: 2 }, { gridX:  2.0, gridY:  1.0, layer: 2 },
  // Layer 3 (Top - 4 tiles: 2 left, 2 right - half-integer)
  { gridX: -1.5, gridY: -0.5, layer: 3 }, { gridX: -1.5, gridY:  0.5, layer: 3 },
  { gridX:  1.5, gridY: -0.5, layer: 3 }, { gridX:  1.5, gridY:  0.5, layer: 3 },
];

// 3. Cross Fortress (cross_fortress)
export const PATTERN_NORMAL_FORTRESS: PatternSlot[] = [
  // Layer 0 (12 tiles - integer outer bastions)
  { gridX: -1.0, gridY: -2.0, layer: 0 }, { gridX:  0.0, gridY: -2.0, layer: 0 }, { gridX:  1.0, gridY: -2.0, layer: 0 },
  { gridX: -1.0, gridY:  2.0, layer: 0 }, { gridX:  0.0, gridY:  2.0, layer: 0 }, { gridX:  1.0, gridY:  2.0, layer: 0 },
  { gridX: -2.0, gridY: -1.0, layer: 0 }, { gridX: -2.0, gridY:  0.0, layer: 0 }, { gridX: -2.0, gridY:  1.0, layer: 0 },
  { gridX:  2.0, gridY: -1.0, layer: 0 }, { gridX:  2.0, gridY:  0.0, layer: 0 }, { gridX:  2.0, gridY:  1.0, layer: 0 },
  // Layer 1 (8 tiles - half-integer cross wings)
  { gridX: -0.5, gridY: -1.5, layer: 1 }, { gridX:  0.5, gridY: -1.5, layer: 1 },
  { gridX: -0.5, gridY:  1.5, layer: 1 }, { gridX:  0.5, gridY:  1.5, layer: 1 },
  { gridX: -1.5, gridY: -0.5, layer: 1 }, { gridX: -1.5, gridY:  0.5, layer: 1 },
  { gridX:  1.5, gridY: -0.5, layer: 1 }, { gridX:  1.5, gridY:  0.5, layer: 1 },
  // Layer 2 (6 tiles - integer inner citadel)
  { gridX: -1.0, gridY: -1.0, layer: 2 }, { gridX:  1.0, gridY: -1.0, layer: 2 },
  { gridX: -1.0, gridY:  0.0, layer: 2 }, { gridX:  1.0, gridY:  0.0, layer: 2 },
  { gridX: -1.0, gridY:  1.0, layer: 2 }, { gridX:  1.0, gridY:  1.0, layer: 2 },
  // Layer 3 (Top - 4 tiles - half-integer central keep)
  { gridX: -0.5, gridY: -0.5, layer: 3 }, { gridX:  0.5, gridY: -0.5, layer: 3 },
  { gridX: -0.5, gridY:  0.5, layer: 3 }, { gridX:  0.5, gridY:  0.5, layer: 3 },
];

// 4. Hourglass (hourglass)
export const PATTERN_NORMAL_HOURGLASS: PatternSlot[] = [
  // Layer 0 (10 tiles wide top/bottom - integer)
  { gridX: -2.0, gridY: -2.0, layer: 0 }, { gridX: -1.0, gridY: -2.0, layer: 0 },
  { gridX:  0.0, gridY: -2.0, layer: 0 }, { gridX:  1.0, gridY: -2.0, layer: 0 },
  { gridX:  2.0, gridY: -2.0, layer: 0 }, { gridX: -2.0, gridY:  2.0, layer: 0 },
  { gridX: -1.0, gridY:  2.0, layer: 0 }, { gridX:  0.0, gridY:  2.0, layer: 0 },
  { gridX:  1.0, gridY:  2.0, layer: 0 }, { gridX:  2.0, gridY:  2.0, layer: 0 },
  // Layer 1 (8 tiles tapering - half-integer)
  { gridX: -1.5, gridY: -1.5, layer: 1 }, { gridX: -0.5, gridY: -1.5, layer: 1 },
  { gridX:  0.5, gridY: -1.5, layer: 1 }, { gridX:  1.5, gridY: -1.5, layer: 1 },
  { gridX: -1.5, gridY:  1.5, layer: 1 }, { gridX: -0.5, gridY:  1.5, layer: 1 },
  { gridX:  0.5, gridY:  1.5, layer: 1 }, { gridX:  1.5, gridY:  1.5, layer: 1 },
  // Layer 2 (8 tiles waist & collar - integer)
  { gridX: -1.0, gridY: -1.0, layer: 2 }, { gridX:  0.0, gridY: -1.0, layer: 2 },
  { gridX:  1.0, gridY: -1.0, layer: 2 }, { gridX: -1.0, gridY:  0.0, layer: 2 },
  { gridX:  1.0, gridY:  0.0, layer: 2 }, { gridX: -1.0, gridY:  1.0, layer: 2 },
  { gridX:  0.0, gridY:  1.0, layer: 2 }, { gridX:  1.0, gridY:  1.0, layer: 2 },
  // Layer 3 (4 tiles center waist - half-integer)
  { gridX: -0.5, gridY: -0.5, layer: 3 }, { gridX:  0.5, gridY: -0.5, layer: 3 },
  { gridX: -0.5, gridY:  0.5, layer: 3 }, { gridX:  0.5, gridY:  0.5, layer: 3 },
];

// 5. Diagonal Cascade (staircase)
export const PATTERN_NORMAL_STAIRCASE: PatternSlot[] = [
  // Layer 0 (12 tiles - integer)
  { gridX: -2.0, gridY: -2.0, layer: 0 }, { gridX: -1.0, gridY: -2.0, layer: 0 },
  { gridX:  0.0, gridY: -2.0, layer: 0 }, { gridX: -2.0, gridY: -1.0, layer: 0 },
  { gridX: -2.0, gridY:  0.0, layer: 0 }, { gridX:  2.0, gridY:  0.0, layer: 0 },
  { gridX:  2.0, gridY:  1.0, layer: 0 }, { gridX:  0.0, gridY:  2.0, layer: 0 },
  { gridX:  1.0, gridY:  2.0, layer: 0 }, { gridX:  2.0, gridY:  2.0, layer: 0 },
  { gridX: -1.0, gridY:  1.0, layer: 0 }, { gridX:  1.0, gridY: -1.0, layer: 0 },
  // Layer 1 (8 tiles - half-integer)
  { gridX: -1.5, gridY: -1.5, layer: 1 }, { gridX: -0.5, gridY: -1.5, layer: 1 },
  { gridX: -1.5, gridY: -0.5, layer: 1 }, { gridX:  0.5, gridY: -1.5, layer: 1 },
  { gridX: -0.5, gridY:  1.5, layer: 1 }, { gridX:  1.5, gridY:  0.5, layer: 1 },
  { gridX:  0.5, gridY:  1.5, layer: 1 }, { gridX:  1.5, gridY:  1.5, layer: 1 },
  // Layer 2 (6 tiles - integer)
  { gridX: -1.0, gridY: -1.0, layer: 2 }, { gridX:  0.0, gridY: -1.0, layer: 2 },
  { gridX: -1.0, gridY:  0.0, layer: 2 }, { gridX:  1.0, gridY:  0.0, layer: 2 },
  { gridX:  0.0, gridY:  1.0, layer: 2 }, { gridX:  1.0, gridY:  1.0, layer: 2 },
  // Layer 3 (Top - 4 tiles core - half-integer)
  { gridX: -0.5, gridY: -0.5, layer: 3 }, { gridX:  0.5, gridY: -0.5, layer: 3 },
  { gridX: -0.5, gridY:  0.5, layer: 3 }, { gridX:  0.5, gridY:  0.5, layer: 3 },
];

// =========================================================================
// 5 DISTINCT MULTI-LAYER TILE LAYOUTS FOR HARD MODE (6 Layers, 50 Tiles)
// Every layout uses disjoint integer coords on even layers (0, 2, 4) and
// disjoint half-integer coords on odd layers (1, 3, 5) so all 50 tiles have
// unique positions and only overlap diagonally at corners (>=95% letter visibility).
// =========================================================================

// 1. Classic Diamond (pyramid) Hard
export const PATTERN_HARD_PYRAMID: PatternSlot[] = [
  // Layer 0 (8 tiles - integer)
  { gridX:  0.0, gridY: -3.0, layer: 0 }, { gridX: -2.0, gridY: -2.0, layer: 0 },
  { gridX:  2.0, gridY: -2.0, layer: 0 }, { gridX: -3.0, gridY:  0.0, layer: 0 },
  { gridX:  3.0, gridY:  0.0, layer: 0 }, { gridX: -2.0, gridY:  2.0, layer: 0 },
  { gridX:  2.0, gridY:  2.0, layer: 0 }, { gridX:  0.0, gridY:  3.0, layer: 0 },
  // Layer 1 (12 tiles - half-integer)
  { gridX: -1.5, gridY: -2.5, layer: 1 }, { gridX: -0.5, gridY: -2.5, layer: 1 },
  { gridX:  0.5, gridY: -2.5, layer: 1 }, { gridX:  1.5, gridY: -2.5, layer: 1 },
  { gridX: -2.5, gridY: -0.5, layer: 1 }, { gridX: -2.5, gridY:  0.5, layer: 1 },
  { gridX:  2.5, gridY: -0.5, layer: 1 }, { gridX:  2.5, gridY:  0.5, layer: 1 },
  { gridX: -1.5, gridY:  2.5, layer: 1 }, { gridX: -0.5, gridY:  2.5, layer: 1 },
  { gridX:  0.5, gridY:  2.5, layer: 1 }, { gridX:  1.5, gridY:  2.5, layer: 1 },
  // Layer 2 (10 tiles - integer)
  { gridX: -1.0, gridY: -2.0, layer: 2 }, { gridX:  1.0, gridY: -2.0, layer: 2 },
  { gridX: -2.0, gridY: -1.0, layer: 2 }, { gridX: -2.0, gridY:  0.0, layer: 2 },
  { gridX: -2.0, gridY:  1.0, layer: 2 }, { gridX:  2.0, gridY: -1.0, layer: 2 },
  { gridX:  2.0, gridY:  0.0, layer: 2 }, { gridX:  2.0, gridY:  1.0, layer: 2 },
  { gridX: -1.0, gridY:  2.0, layer: 2 }, { gridX:  1.0, gridY:  2.0, layer: 2 },
  // Layer 3 (8 tiles - half-integer)
  { gridX: -0.5, gridY: -1.5, layer: 3 }, { gridX:  0.5, gridY: -1.5, layer: 3 },
  { gridX: -1.5, gridY: -0.5, layer: 3 }, { gridX: -1.5, gridY:  0.5, layer: 3 },
  { gridX:  1.5, gridY: -0.5, layer: 3 }, { gridX:  1.5, gridY:  0.5, layer: 3 },
  { gridX: -0.5, gridY:  1.5, layer: 3 }, { gridX:  0.5, gridY:  1.5, layer: 3 },
  // Layer 4 (8 tiles - integer)
  { gridX: -1.0, gridY: -1.0, layer: 4 }, { gridX:  0.0, gridY: -1.0, layer: 4 },
  { gridX:  1.0, gridY: -1.0, layer: 4 }, { gridX: -1.0, gridY:  0.0, layer: 4 },
  { gridX:  1.0, gridY:  0.0, layer: 4 }, { gridX: -1.0, gridY:  1.0, layer: 4 },
  { gridX:  0.0, gridY:  1.0, layer: 4 }, { gridX:  1.0, gridY:  1.0, layer: 4 },
  // Layer 5 (4 tiles - half-integer)
  { gridX: -0.5, gridY: -0.5, layer: 5 }, { gridX:  0.5, gridY: -0.5, layer: 5 },
  { gridX: -0.5, gridY:  0.5, layer: 5 }, { gridX:  0.5, gridY:  0.5, layer: 5 },
];

// 2. Twin Towers Hard (twin_towers)
export const PATTERN_HARD_TOWERS: PatternSlot[] = [
  // Layer 0 (12 tiles: 6 left, 6 right - integer)
  { gridX: -3.0, gridY: -3.0, layer: 0 }, { gridX: -2.0, gridY: -3.0, layer: 0 }, { gridX: -1.0, gridY: -3.0, layer: 0 },
  { gridX: -2.0, gridY:  2.0, layer: 0 }, { gridX: -3.0, gridY:  3.0, layer: 0 }, { gridX: -1.0, gridY:  3.0, layer: 0 },
  { gridX:  1.0, gridY: -3.0, layer: 0 }, { gridX:  2.0, gridY: -3.0, layer: 0 }, { gridX:  3.0, gridY: -3.0, layer: 0 },
  { gridX:  2.0, gridY:  2.0, layer: 0 }, { gridX:  1.0, gridY:  3.0, layer: 0 }, { gridX:  3.0, gridY:  3.0, layer: 0 },
  // Layer 1 (10 tiles: 5 left, 5 right - half-integer)
  { gridX: -2.5, gridY: -2.5, layer: 1 }, { gridX: -1.5, gridY: -2.5, layer: 1 }, { gridX: -0.5, gridY: -1.5, layer: 1 },
  { gridX: -2.5, gridY:  2.5, layer: 1 }, { gridX: -1.5, gridY:  2.5, layer: 1 },
  { gridX:  0.5, gridY: -1.5, layer: 1 }, { gridX:  1.5, gridY: -2.5, layer: 1 }, { gridX:  2.5, gridY: -2.5, layer: 1 },
  { gridX:  1.5, gridY:  2.5, layer: 1 }, { gridX:  2.5, gridY:  2.5, layer: 1 },
  // Layer 2 (10 tiles: 5 left, 5 right - integer)
  { gridX: -3.0, gridY: -2.0, layer: 2 }, { gridX: -2.0, gridY: -2.0, layer: 2 }, { gridX: -1.0, gridY: -2.0, layer: 2 },
  { gridX: -3.0, gridY:  2.0, layer: 2 }, { gridX: -1.0, gridY:  2.0, layer: 2 },
  { gridX:  1.0, gridY: -2.0, layer: 2 }, { gridX:  2.0, gridY: -2.0, layer: 2 }, { gridX:  3.0, gridY: -2.0, layer: 2 },
  { gridX:  1.0, gridY:  2.0, layer: 2 }, { gridX:  3.0, gridY:  2.0, layer: 2 },
  // Layer 3 (8 tiles: 4 left, 4 right - half-integer)
  { gridX: -2.5, gridY: -1.5, layer: 3 }, { gridX: -1.5, gridY: -1.5, layer: 3 },
  { gridX: -2.5, gridY:  1.5, layer: 3 }, { gridX: -1.5, gridY:  1.5, layer: 3 },
  { gridX:  1.5, gridY: -1.5, layer: 3 }, { gridX:  2.5, gridY: -1.5, layer: 3 },
  { gridX:  1.5, gridY:  1.5, layer: 3 }, { gridX:  2.5, gridY:  1.5, layer: 3 },
  // Layer 4 (6 tiles: 3 left, 3 right - integer)
  { gridX: -2.0, gridY: -1.0, layer: 4 }, { gridX: -2.0, gridY:  0.0, layer: 4 }, { gridX: -2.0, gridY:  1.0, layer: 4 },
  { gridX:  2.0, gridY: -1.0, layer: 4 }, { gridX:  2.0, gridY:  0.0, layer: 4 }, { gridX:  2.0, gridY:  1.0, layer: 4 },
  // Layer 5 (4 tiles: 2 left, 2 right - half-integer)
  { gridX: -1.5, gridY: -0.5, layer: 5 }, { gridX: -1.5, gridY:  0.5, layer: 5 },
  { gridX:  1.5, gridY: -0.5, layer: 5 }, { gridX:  1.5, gridY:  0.5, layer: 5 },
];

// 3. Cross Fortress Hard (cross_fortress)
export const PATTERN_HARD_FORTRESS: PatternSlot[] = [
  // Layer 0 (12 tiles - integer outer fortress perimeter)
  { gridX: -2.0, gridY: -2.0, layer: 0 }, { gridX:  2.0, gridY: -2.0, layer: 0 },
  { gridX: -2.0, gridY:  2.0, layer: 0 }, { gridX:  2.0, gridY:  2.0, layer: 0 },
  { gridX: -2.0, gridY: -1.0, layer: 0 }, { gridX:  2.0, gridY: -1.0, layer: 0 },
  { gridX: -2.0, gridY:  1.0, layer: 0 }, { gridX:  2.0, gridY:  1.0, layer: 0 },
  { gridX:  0.0, gridY: -3.0, layer: 0 }, { gridX:  0.0, gridY:  3.0, layer: 0 },
  { gridX: -3.0, gridY:  0.0, layer: 0 }, { gridX:  3.0, gridY:  0.0, layer: 0 },
  // Layer 1 (10 tiles - half-integer corner & wing bastions)
  { gridX: -1.5, gridY: -1.5, layer: 1 }, { gridX:  1.5, gridY: -1.5, layer: 1 },
  { gridX: -1.5, gridY:  1.5, layer: 1 }, { gridX:  1.5, gridY:  1.5, layer: 1 },
  { gridX: -0.5, gridY: -2.5, layer: 1 }, { gridX:  0.5, gridY: -2.5, layer: 1 },
  { gridX: -0.5, gridY:  2.5, layer: 1 }, { gridX:  0.5, gridY:  2.5, layer: 1 },
  { gridX: -2.5, gridY: -0.5, layer: 1 }, { gridX:  2.5, gridY:  0.5, layer: 1 },
  // Layer 2 (8 tiles - integer outer cross)
  { gridX:  0.0, gridY: -2.0, layer: 2 }, { gridX: -2.0, gridY:  0.0, layer: 2 },
  { gridX:  2.0, gridY:  0.0, layer: 2 }, { gridX:  0.0, gridY:  2.0, layer: 2 },
  { gridX: -1.0, gridY: -2.0, layer: 2 }, { gridX:  1.0, gridY: -2.0, layer: 2 },
  { gridX: -1.0, gridY:  2.0, layer: 2 }, { gridX:  1.0, gridY:  2.0, layer: 2 },
  // Layer 3 (8 tiles - half-integer cross arms)
  { gridX: -0.5, gridY: -1.5, layer: 3 }, { gridX:  0.5, gridY: -1.5, layer: 3 },
  { gridX: -1.5, gridY: -0.5, layer: 3 }, { gridX:  1.5, gridY: -0.5, layer: 3 },
  { gridX: -1.5, gridY:  0.5, layer: 3 }, { gridX:  1.5, gridY:  0.5, layer: 3 },
  { gridX: -0.5, gridY:  1.5, layer: 3 }, { gridX:  0.5, gridY:  1.5, layer: 3 },
  // Layer 4 (8 tiles - integer inner ring)
  { gridX: -1.0, gridY: -1.0, layer: 4 }, { gridX:  0.0, gridY: -1.0, layer: 4 },
  { gridX:  1.0, gridY: -1.0, layer: 4 }, { gridX: -1.0, gridY:  0.0, layer: 4 },
  { gridX:  1.0, gridY:  0.0, layer: 4 }, { gridX: -1.0, gridY:  1.0, layer: 4 },
  { gridX:  0.0, gridY:  1.0, layer: 4 }, { gridX:  1.0, gridY:  1.0, layer: 4 },
  // Layer 5 (4 tiles - half-integer central keep)
  { gridX: -0.5, gridY: -0.5, layer: 5 }, { gridX:  0.5, gridY: -0.5, layer: 5 },
  { gridX: -0.5, gridY:  0.5, layer: 5 }, { gridX:  0.5, gridY:  0.5, layer: 5 },
];

// 4. Hourglass Hard (hourglass)
export const PATTERN_HARD_HOURGLASS: PatternSlot[] = [
  // Layer 0 (12 tiles - integer outer hourglass caps)
  { gridX: -3.0, gridY: -3.0, layer: 0 }, { gridX: -2.0, gridY: -3.0, layer: 0 },
  { gridX: -1.0, gridY: -3.0, layer: 0 }, { gridX:  0.0, gridY: -3.0, layer: 0 },
  { gridX:  1.0, gridY: -3.0, layer: 0 }, { gridX:  2.0, gridY: -3.0, layer: 0 },
  { gridX: -2.0, gridY:  3.0, layer: 0 }, { gridX: -1.0, gridY:  3.0, layer: 0 },
  { gridX:  0.0, gridY:  3.0, layer: 0 }, { gridX:  1.0, gridY:  3.0, layer: 0 },
  { gridX:  2.0, gridY:  3.0, layer: 0 }, { gridX:  3.0, gridY:  3.0, layer: 0 },
  // Layer 1 (10 tiles - half-integer wide rims)
  { gridX: -2.5, gridY: -2.5, layer: 1 }, { gridX: -1.5, gridY: -2.5, layer: 1 },
  { gridX: -0.5, gridY: -2.5, layer: 1 }, { gridX:  0.5, gridY: -2.5, layer: 1 },
  { gridX:  1.5, gridY: -2.5, layer: 1 }, { gridX: -1.5, gridY:  2.5, layer: 1 },
  { gridX: -0.5, gridY:  2.5, layer: 1 }, { gridX:  0.5, gridY:  2.5, layer: 1 },
  { gridX:  1.5, gridY:  2.5, layer: 1 }, { gridX:  2.5, gridY:  2.5, layer: 1 },
  // Layer 2 (10 tiles - integer upper & lower flare)
  { gridX: -2.0, gridY: -2.0, layer: 2 }, { gridX: -1.0, gridY: -2.0, layer: 2 },
  { gridX:  0.0, gridY: -2.0, layer: 2 }, { gridX:  1.0, gridY: -2.0, layer: 2 },
  { gridX:  2.0, gridY: -2.0, layer: 2 }, { gridX: -2.0, gridY:  2.0, layer: 2 },
  { gridX: -1.0, gridY:  2.0, layer: 2 }, { gridX:  0.0, gridY:  2.0, layer: 2 },
  { gridX:  1.0, gridY:  2.0, layer: 2 }, { gridX:  2.0, gridY:  2.0, layer: 2 },
  // Layer 3 (8 tiles - half-integer middle flare)
  { gridX: -1.5, gridY: -1.5, layer: 3 }, { gridX: -0.5, gridY: -1.5, layer: 3 },
  { gridX:  0.5, gridY: -1.5, layer: 3 }, { gridX:  1.5, gridY: -1.5, layer: 3 },
  { gridX: -1.5, gridY:  1.5, layer: 3 }, { gridX: -0.5, gridY:  1.5, layer: 3 },
  { gridX:  0.5, gridY:  1.5, layer: 3 }, { gridX:  1.5, gridY:  1.5, layer: 3 },
  // Layer 4 (6 tiles - integer inner waist collars)
  { gridX: -1.0, gridY: -1.0, layer: 4 }, { gridX:  0.0, gridY: -1.0, layer: 4 },
  { gridX:  1.0, gridY: -1.0, layer: 4 }, { gridX: -1.0, gridY:  1.0, layer: 4 },
  { gridX:  0.0, gridY:  1.0, layer: 4 }, { gridX:  1.0, gridY:  1.0, layer: 4 },
  // Layer 5 (4 tiles - half-integer waist)
  { gridX: -0.5, gridY: -0.5, layer: 5 }, { gridX:  0.5, gridY: -0.5, layer: 5 },
  { gridX: -0.5, gridY:  0.5, layer: 5 }, { gridX:  0.5, gridY:  0.5, layer: 5 },
];

// 5. Diagonal Cascade Hard (staircase)
export const PATTERN_HARD_STAIRCASE: PatternSlot[] = [
  // Layer 0 (12 tiles - integer outer diagonal crest)
  { gridX: -3.0, gridY: -3.0, layer: 0 }, { gridX: -2.0, gridY: -3.0, layer: 0 },
  { gridX: -1.0, gridY: -3.0, layer: 0 }, { gridX:  0.0, gridY: -3.0, layer: 0 },
  { gridX: -3.0, gridY: -2.0, layer: 0 }, { gridX: -3.0, gridY: -1.0, layer: 0 },
  { gridX:  3.0, gridY:  1.0, layer: 0 }, { gridX:  3.0, gridY:  2.0, layer: 0 },
  { gridX:  0.0, gridY:  3.0, layer: 0 }, { gridX:  1.0, gridY:  3.0, layer: 0 },
  { gridX:  2.0, gridY:  3.0, layer: 0 }, { gridX:  3.0, gridY:  3.0, layer: 0 },
  // Layer 1 (10 tiles - half-integer outer diagonal cascade)
  { gridX: -2.5, gridY: -2.5, layer: 1 }, { gridX: -1.5, gridY: -2.5, layer: 1 },
  { gridX: -0.5, gridY: -2.5, layer: 1 }, { gridX: -2.5, gridY: -1.5, layer: 1 },
  { gridX:  1.5, gridY: -1.5, layer: 1 }, { gridX: -1.5, gridY:  1.5, layer: 1 },
  { gridX:  2.5, gridY:  1.5, layer: 1 }, { gridX:  0.5, gridY:  2.5, layer: 1 },
  { gridX:  1.5, gridY:  2.5, layer: 1 }, { gridX:  2.5, gridY:  2.5, layer: 1 },
  // Layer 2 (10 tiles - integer diagonal wave)
  { gridX: -2.0, gridY: -2.0, layer: 2 }, { gridX: -1.0, gridY: -2.0, layer: 2 },
  { gridX:  0.0, gridY: -2.0, layer: 2 }, { gridX: -2.0, gridY: -1.0, layer: 2 },
  { gridX:  1.0, gridY: -1.0, layer: 2 }, { gridX: -1.0, gridY:  1.0, layer: 2 },
  { gridX:  2.0, gridY:  1.0, layer: 2 }, { gridX:  0.0, gridY:  2.0, layer: 2 },
  { gridX:  1.0, gridY:  2.0, layer: 2 }, { gridX:  2.0, gridY:  2.0, layer: 2 },
  // Layer 3 (8 tiles - half-integer diagonal middle ridge)
  { gridX: -1.5, gridY: -1.5, layer: 3 }, { gridX: -0.5, gridY: -1.5, layer: 3 },
  { gridX: -1.5, gridY: -0.5, layer: 3 }, { gridX:  0.5, gridY: -1.5, layer: 3 },
  { gridX: -0.5, gridY:  1.5, layer: 3 }, { gridX:  1.5, gridY:  0.5, layer: 3 },
  { gridX:  0.5, gridY:  1.5, layer: 3 }, { gridX:  1.5, gridY:  1.5, layer: 3 },
  // Layer 4 (6 tiles - integer diagonal inner steps)
  { gridX: -1.0, gridY: -1.0, layer: 4 }, { gridX:  0.0, gridY: -1.0, layer: 4 },
  { gridX: -1.0, gridY:  0.0, layer: 4 }, { gridX:  1.0, gridY:  0.0, layer: 4 },
  { gridX:  0.0, gridY:  1.0, layer: 4 }, { gridX:  1.0, gridY:  1.0, layer: 4 },
  // Layer 5 (4 tiles - half-integer core)
  { gridX: -0.5, gridY: -0.5, layer: 5 }, { gridX:  0.5, gridY: -0.5, layer: 5 },
  { gridX: -0.5, gridY:  0.5, layer: 5 }, { gridX:  0.5, gridY:  0.5, layer: 5 },
];

// Helper to get daily layout for date (deterministically rotates through the 5 layouts)
export function getDailyLayoutForDate(dateStr: string): LayoutMode {
  const layouts: LayoutMode[] = ['pyramid', 'twin_towers', 'cross_fortress', 'hourglass', 'staircase'];
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % layouts.length;
  return layouts[idx];
}

export function getPatternForMode(difficulty: DifficultyMode, layoutMode: LayoutMode = 'daily', dateStr?: string): PatternSlot[] {
  const resolvedLayout = layoutMode === 'daily' ? getDailyLayoutForDate(dateStr || '2026-01-01') : layoutMode;

  if (difficulty === 'hard') {
    switch (resolvedLayout) {
      case 'twin_towers': return PATTERN_HARD_TOWERS;
      case 'cross_fortress': return PATTERN_HARD_FORTRESS;
      case 'hourglass': return PATTERN_HARD_HOURGLASS;
      case 'staircase': return PATTERN_HARD_STAIRCASE;
      case 'pyramid':
      default: return PATTERN_HARD_PYRAMID;
    }
  } else {
    switch (resolvedLayout) {
      case 'twin_towers': return PATTERN_NORMAL_TOWERS;
      case 'cross_fortress': return PATTERN_NORMAL_FORTRESS;
      case 'hourglass': return PATTERN_NORMAL_HOURGLASS;
      case 'staircase': return PATTERN_NORMAL_STAIRCASE;
      case 'pyramid':
      default: return PATTERN_NORMAL_PYRAMID;
    }
  }
}
