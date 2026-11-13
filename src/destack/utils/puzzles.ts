import { WordPuzzle, TileData, DifficultyMode } from '../types';

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
// Layer 0 (bottom): 8 tiles
// Layer 1: 12 tiles
// Layer 2: 10 tiles
// Layer 3: 8 tiles
// Layer 4: 8 tiles
// Layer 5 (top): 4 tiles
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

// Master list of 5-letter words and hints
const WORD_BANK: Array<{ word: string; hint: string }> = [
  { word: "WORST", hint: "Most severe or lowest in quality" },
  { word: "BUGGY", hint: "Small vehicle or full of software errors" },
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
  { word: "APPLE", hint: "Crisp orchard fruit that keeps doctors away" },
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
];

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
  difficulty: DifficultyMode = 'normal'
): WordPuzzle {
  const seedKey = difficulty === 'hard' ? `${dateStr}-HARD-6LAYER` : dateStr;
  let hash = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    hash ^= seedKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const rng = createPRNG(hash);

  const pattern = difficulty === 'hard' ? STACKDOWN_PATTERN_HARD : STACKDOWN_PATTERN_NORMAL;
  const wordCount = difficulty === 'hard' ? 10 : 6; // 50 tiles (10 words) in hard, 30 tiles (6 words) in normal
  const totalLayers = difficulty === 'hard' ? 6 : 4;

  // Deterministically select `wordCount` distinct words from WORD_BANK
  const indices = WORD_BANK.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const chosenIndices = indices.slice(0, wordCount);
  const words = chosenIndices.map(idx => WORD_BANK[idx].word);
  const hints = chosenIndices.map(idx => WORD_BANK[idx].hint);

  // Precompute coverage graph for the pattern slots
  // A slot i is covered by slot j if slot j is on a higher layer and within 0.5 grid units in both X and Y
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

  // Simulate valid unstacking order to place the letters into the slots
  // so that every word in `words` can be picked sequentially from exposed tiles.
  const assignedLetters: string[] = new Array(pattern.length).fill('');
  const assignedSlotSet = new Set<number>();

  const flatLetters = words.join('').split('');

  for (let step = 0; step < flatLetters.length; step++) {
    const availableSlots: number[] = [];
    for (let s = 0; s < pattern.length; s++) {
      if (assignedSlotSet.has(s)) continue;
      const isUncovered = coveredByIndices[s].every(covIdx => assignedSlotSet.has(covIdx));
      if (isUncovered) {
        availableSlots.push(s);
      }
    }

    availableSlots.sort((a, b) => pattern[b].layer - pattern[a].layer);
    const candidatePoolSize = Math.min(availableSlots.length, 4);
    const chosenPoolIdx = Math.floor(rng() * candidatePoolSize);
    const chosenSlot = availableSlots[chosenPoolIdx];

    assignedLetters[chosenSlot] = flatLetters[step];
    assignedSlotSet.add(chosenSlot);
  }

  // Convert slots to TileData
  // Normal mode spans [-2.0, +2.0] -> step = 18.5%
  // Hard mode spans [-3.0, +3.0] -> step = 13.0% (so -3..+3 maps to 11%..89%)
  const stepPct = difficulty === 'hard' ? 13.0 : 18.5;

  const tiles: TileData[] = pattern.map((slot, idx) => {
    const id = `tile-${dateStr}-${difficulty}-${idx}`;
    const coveredBy = coveredByIndices[idx].map(covIdx => `tile-${dateStr}-${difficulty}-${covIdx}`);
    return {
      id,
      letter: assignedLetters[idx],
      x: 50 + slot.gridX * stepPct,
      y: 50 + slot.gridY * stepPct,
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

  return {
    id: dateStr,
    difficulty,
    totalLayers,
    dayIndex: dayIndex > 180 ? (dayIndex % 180) + 1 : dayIndex,
    dateString: dateStr,
    words,
    hints,
    tiles,
  };
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
