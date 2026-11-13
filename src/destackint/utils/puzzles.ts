import { WordPuzzle, TileData, DifficultyMode, LayoutMode } from '../types';

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
];

// Deduplicate by word and ensure 5 distinct letters
const SEEN_WORDS = new Set<string>();
const WORD_BANK = RAW_WORD_BANK.filter(item => {
  if (item.word.length !== 5) return false;
  if (new Set(item.word.split('')).size !== 5) return false;
  if (SEEN_WORDS.has(item.word)) return false;
  SEEN_WORDS.add(item.word);
  return true;
});

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
  layoutMode: LayoutMode = 'daily'
): WordPuzzle {
  const seedKey = `${dateStr}-${difficulty}-${layoutMode}`;
  let hash = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    hash ^= seedKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const rng = createPRNG(hash);

  const pattern = getPatternForMode(difficulty, layoutMode, dateStr);
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

  // Step 1: Build a balanced cascading unstacking sequence `slotOrder[0 .. totalSlots-1]`:
  // - Within each 5-letter word, the first picks clear oldest-exposed / highest-layer tiles so no tile lingers across many words,
  //   while the later picks in the word select newly uncovered tiles so each word requires unstacking step-by-step!
  const slotOrder: number[] = [];
  const exposedAtStep: number[][] = [];
  const removedSlots = new Set<number>();
  const exposedSinceStep: number[] = new Array(totalSlots).fill(-1);

  // Mark initially uncovered slots at step 0
  for (let s = 0; s < totalSlots; s++) {
    if (coveredByIndices[s].length === 0) {
      exposedSinceStep[s] = 0;
    }
  }

  let prevPickedSlot: number | null = null;

  for (let step = 0; step < totalSlots; step++) {
    const currentlyExposed: number[] = [];
    for (let s = 0; s < totalSlots; s++) {
      if (removedSlots.has(s)) continue;
      if (coveredByIndices[s].every(cov => removedSlots.has(cov))) {
        if (exposedSinceStep[s] === -1) {
          exposedSinceStep[s] = step;
        }
        currentlyExposed.push(s);
      }
    }
    exposedAtStep.push(currentlyExposed);

    const kInWord = step % 5; // 0..4
    const wordStartStep = step - kInWord;

    const scoredCandidates = currentlyExposed.map(s => {
      let newlyUncoveredCount = 0;
      for (let sub = 0; sub < totalSlots; sub++) {
        if (removedSlots.has(sub) || sub === s) continue;
        if (!coveredByIndices[sub].includes(s)) continue;
        const allOthersRemoved = coveredByIndices[sub].every(
          cov => cov === s || removedSlots.has(cov)
        );
        if (allOthersRemoved) {
          newlyUncoveredCount++;
        }
      }

      const age = step - exposedSinceStep[s];
      const uncoveredInCurrentWord = exposedSinceStep[s] > wordStartStep ? 1 : 0;
      const distToPrev =
        prevPickedSlot !== null
          ? Math.hypot(
              pattern[s].gridX - pattern[prevPickedSlot].gridX,
              pattern[s].gridY - pattern[prevPickedSlot].gridY
            )
          : 0;

      // For kInWord >= 2, strongly prefer slots that were uncovered during the current word (cascading path!)
      // while also preventing any old tile from lingering for > 6 steps.
      let score = 0;
      if (age >= 6) {
        // Must clear lingering tile so the exposed frontier stays small and fresh
        score = -50 - age * 4 - pattern[s].layer * 2 + rng() * 0.5;
      } else if (kInWord >= 2 && uncoveredInCurrentWord) {
        // Cascade into newly uncovered tile for this word!
        score = -20 + newlyUncoveredCount * 2.5 + distToPrev * 1.5 + rng() * 0.8;
      } else {
        // Clear highest-layer / adjacent exposed tile that uncovers the next step
        score = -pattern[s].layer * 3 - age * 1.5 + distToPrev * 1.2 + newlyUncoveredCount * 1.5 + rng() * 0.8;
      }

      return { slot: s, score };
    });

    scoredCandidates.sort((a, b) => a.score - b.score);
    const chosenSlot = scoredCandidates[0].slot;

    slotOrder.push(chosenSlot);
    removedSlots.add(chosenSlot);
    prevPickedSlot = chosenSlot;
  }

  // Map each pattern slot index `s` to the step `t` at which it is picked
  const stepOfSlot: number[] = new Array(totalSlots).fill(0);
  for (let t = 0; t < totalSlots; t++) {
    stepOfSlot[slotOrder[t]] = t;
  }

  // For each step `t`, find all LATER steps `t' > t` whose tile `slotOrder[t']` is ALREADY exposed at step `t`
  const otherExposedStepsAtStep: number[][] = Array.from({ length: totalSlots }, (_, t) => {
    const slotT = slotOrder[t];
    return exposedAtStep[t]
      .filter(s => s !== slotT)
      .map(s => stepOfSlot[s]);
  });

  // Shuffle word bank indices deterministically for this date
  const shuffledBankIndices = WORD_BANK.map((_, i) => i);
  for (let i = shuffledBankIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledBankIndices[i], shuffledBankIndices[j]] = [shuffledBankIndices[j], shuffledBankIndices[i]];
  }

  // Helper to check if a 5-letter word `wStr` can be formed in 5 valid unstacking steps
  // starting from `startStep` (when `slotOrder[0 .. startStep - 1]` are already cleared)
  function canFormWordFromStep(startStep: number, wStr: string, slotLetters: string[]): boolean {
    const cleared = new Set<number>();
    for (let u = 0; u < startStep; u++) {
      cleared.add(slotOrder[u]);
    }

    function dfs(letterIdx: number): boolean {
      if (letterIdx === 5) return true;
      const targetChar = wStr[letterIdx];

      for (let s = 0; s < totalSlots; s++) {
        if (cleared.has(s)) continue;
        if (slotLetters[s] !== targetChar) continue;
        const isExp = coveredByIndices[s].every(cov => cleared.has(cov));
        if (!isExp) continue;

        cleared.add(s);
        if (dfs(letterIdx + 1)) return true;
        cleared.delete(s);
      }
      return false;
    }

    return dfs(0);
  }

  // Step 2: Assign words from last word (`wordCount - 1`) down to first word (`0`).
  // Because we assign from `wordCount - 1` down to `0`, when testing `wordIdx`,
  // ALL deeper tiles (`step >= (wordIdx + 1) * 5`) already have their letters assigned,
  // AND any other tile in `exposedAtStep[step]` is at some `t' > step` which is already assigned!
  const chosenWordBankIndices: number[] = new Array(wordCount).fill(0);
  const usedBankSet = new Set<number>();
  const assignedStepLetters: string[] = new Array(totalSlots).fill('');
  const assignedSlotLetters: string[] = new Array(totalSlots).fill('');

  let searchCalls = 0;
  const MAX_SEARCH_CALLS = 4000;

  function solveWordReverse(wordIdx: number, strictOtherWords: boolean): boolean {
    if (wordIdx < 0) {
      return true;
    }
    searchCalls++;
    if (searchCalls > MAX_SEARCH_CALLS) {
      return false;
    }

    const baseStep = wordIdx * 5;

    for (let i = 0; i < shuffledBankIndices.length; i++) {
      const bankIdx = shuffledBankIndices[i];
      if (usedBankSet.has(bankIdx)) continue;

      const candidateWord = WORD_BANK[bankIdx].word;
      let valid = true;

      // Temporarily place letters for steps baseStep .. baseStep + 4
      for (let k = 0; k < 5; k++) {
        const step = baseStep + k;
        assignedStepLetters[step] = candidateWord[k];
        assignedSlotLetters[slotOrder[step]] = candidateWord[k];
      }

      // Check 1 (Unique Path): At each of the 5 steps `step = baseStep + k`,
      // `candidateWord[k]` must NOT match any other tile exposed on the board at `step` (`otherExposedStepsAtStep[step]`).
      for (let k = 0; k < 5; k++) {
        const step = baseStep + k;
        const ch = candidateWord[k];
        const otherSteps = otherExposedStepsAtStep[step];
        for (let c = 0; c < otherSteps.length; c++) {
          if (assignedStepLetters[otherSteps[c]] === ch) {
            valid = false;
            break;
          }
        }
        if (!valid) break;
      }

      // Check 2 (Single Possible Answer): Verify that at the start of `wordIdx` (`baseStep`),
      // NO other word in `WORD_BANK` can be formed in 5 valid unstacking steps!
      if (valid && strictOtherWords) {
        for (let b = 0; b < WORD_BANK.length; b++) {
          if (b === bankIdx) continue;
          if (canFormWordFromStep(baseStep, WORD_BANK[b].word, assignedSlotLetters)) {
            valid = false;
            break;
          }
        }
      }

      if (valid) {
        usedBankSet.add(bankIdx);
        chosenWordBankIndices[wordIdx] = bankIdx;

        if (solveWordReverse(wordIdx - 1, strictOtherWords)) {
          return true;
        }

        usedBankSet.delete(bankIdx);
      }

      // Clean up temporary placement
      for (let k = 0; k < 5; k++) {
        const step = baseStep + k;
        assignedStepLetters[step] = '';
        assignedSlotLetters[slotOrder[step]] = '';
      }

      if (searchCalls > MAX_SEARCH_CALLS) {
        return false;
      }
    }

    return false;
  }

  // Pass 1: Full strict solve (Unique Path + Single Possible Word Answer)
  let solved = solveWordReverse(wordCount - 1, true);

  // Pass 2: If search budget was exceeded, solve with Unique Path (Check 1) only
  if (!solved) {
    searchCalls = 0;
    usedBankSet.clear();
    assignedStepLetters.fill('');
    assignedSlotLetters.fill('');
    solved = solveWordReverse(wordCount - 1, false);
  }

  // Pass 3: Guaranteed greedy fallback per word (picks word with minimal/zero exposed letter conflicts)
  if (!solved) {
    usedBankSet.clear();
    assignedStepLetters.fill('');
    assignedSlotLetters.fill('');
    for (let w = wordCount - 1; w >= 0; w--) {
      const baseStep = w * 5;
      let bestBankIdx = shuffledBankIndices.find(idx => !usedBankSet.has(idx)) ?? 0;
      let bestConflicts = 999;

      for (let i = 0; i < shuffledBankIndices.length; i++) {
        const bankIdx = shuffledBankIndices[i];
        if (usedBankSet.has(bankIdx)) continue;
        const candidateWord = WORD_BANK[bankIdx].word;
        for (let k = 0; k < 5; k++) {
          assignedStepLetters[baseStep + k] = candidateWord[k];
        }
        let conflicts = 0;
        for (let k = 0; k < 5; k++) {
          const step = baseStep + k;
          const ch = candidateWord[k];
          for (const oStep of otherExposedStepsAtStep[step]) {
            if (assignedStepLetters[oStep] === ch) conflicts++;
          }
        }
        if (conflicts < bestConflicts) {
          bestConflicts = conflicts;
          bestBankIdx = bankIdx;
          if (conflicts === 0) break;
        }
      }

      usedBankSet.add(bestBankIdx);
      chosenWordBankIndices[w] = bestBankIdx;
      const finalWord = WORD_BANK[bestBankIdx].word;
      for (let k = 0; k < 5; k++) {
        const step = baseStep + k;
        assignedStepLetters[step] = finalWord[k];
        assignedSlotLetters[slotOrder[step]] = finalWord[k];
      }
    }
  }

  const words = chosenWordBankIndices.map(idx => WORD_BANK[idx].word);
  const hints = chosenWordBankIndices.map(idx => WORD_BANK[idx].hint);

  const stepPct = difficulty === 'hard' ? 13.0 : 18.5;

  const tiles: TileData[] = pattern.map((slot, idx) => {
    const id = `tile-${dateStr}-${difficulty}-${idx}`;
    const coveredBy = coveredByIndices[idx].map(covIdx => `tile-${dateStr}-${difficulty}-${covIdx}`);
    return {
      id,
      letter: assignedSlotLetters[idx],
      x: 50 + slot.gridX * stepPct,
      y: 56 + slot.gridY * (stepPct * 0.78),
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

// =========================================================================
// 5 DISTINCT MULTI-LAYER TILE LAYOUTS FOR NORMAL MODE (4 Layers, 30 Tiles)
// =========================================================================

// 1. Classic Diamond (pyramid)
export const PATTERN_NORMAL_PYRAMID: PatternSlot[] = [
  // Layer 0 (10 tiles)
  { gridX: -1.0, gridY: -2.0, layer: 0 }, { gridX: 1.0, gridY: -2.0, layer: 0 },
  { gridX: -2.0, gridY: -1.0, layer: 0 }, { gridX: -2.0, gridY: 0.0, layer: 0 },
  { gridX: -2.0, gridY: 1.0, layer: 0 },  { gridX: 2.0, gridY: -1.0, layer: 0 },
  { gridX: 2.0, gridY: 0.0, layer: 0 },   { gridX: 2.0, gridY: 1.0, layer: 0 },
  { gridX: -1.0, gridY: 2.0, layer: 0 },  { gridX: 1.0, gridY: 2.0, layer: 0 },
  // Layer 1 (8 tiles)
  { gridX: -0.5, gridY: -1.5, layer: 1 }, { gridX: 0.5, gridY: -1.5, layer: 1 },
  { gridX: -1.5, gridY: -0.5, layer: 1 }, { gridX: -1.5, gridY: 0.5, layer: 1 },
  { gridX: 1.5, gridY: -0.5, layer: 1 },  { gridX: 1.5, gridY: 0.5, layer: 1 },
  { gridX: -0.5, gridY: 1.5, layer: 1 },  { gridX: 0.5, gridY: 1.5, layer: 1 },
  // Layer 2 (8 tiles)
  { gridX: -1.0, gridY: -1.0, layer: 2 }, { gridX: 0.0, gridY: -1.0, layer: 2 },
  { gridX: 1.0, gridY: -1.0, layer: 2 },  { gridX: -1.0, gridY: 0.0, layer: 2 },
  { gridX: 1.0, gridY: 0.0, layer: 2 },   { gridX: -1.0, gridY: 1.0, layer: 2 },
  { gridX: 0.0, gridY: 1.0, layer: 2 },   { gridX: 1.0, gridY: 1.0, layer: 2 },
  // Layer 3 (4 tiles)
  { gridX: -0.5, gridY: -0.5, layer: 3 }, { gridX: 0.5, gridY: -0.5, layer: 3 },
  { gridX: -0.5, gridY: 0.5, layer: 3 },  { gridX: 0.5, gridY: 0.5, layer: 3 },
];

// 2. Twin Towers (twin_towers)
export const PATTERN_NORMAL_TOWERS: PatternSlot[] = [
  // Layer 0 (Bottom - 10 tiles split in two columns)
  { gridX: -2.0, gridY: -2.6, layer: 0 }, { gridX: -1.0, gridY: -2.6, layer: 0 },
  { gridX: -2.0, gridY: -1.3, layer: 0 }, { gridX: -1.0, gridY: -1.3, layer: 0 },
  { gridX: -2.0, gridY:  1.3, layer: 0 }, { gridX: -1.0, gridY:  1.3, layer: 0 },
  { gridX: -2.0, gridY:  2.6, layer: 0 }, { gridX: -1.0, gridY:  2.6, layer: 0 },
  { gridX:  0.0, gridY:  0.0, layer: 0 }, { gridX:  0.0, gridY: -0.7, layer: 0 },
  // Layer 1 (8 tiles)
  { gridX:  1.0, gridY: -2.6, layer: 1 }, { gridX:  2.0, gridY: -2.6, layer: 1 },
  { gridX:  1.0, gridY: -1.3, layer: 1 }, { gridX:  2.0, gridY: -1.3, layer: 1 },
  { gridX:  1.0, gridY:  1.3, layer: 1 }, { gridX:  2.0, gridY:  1.3, layer: 1 },
  { gridX:  1.0, gridY:  2.6, layer: 1 }, { gridX:  2.0, gridY:  2.6, layer: 1 },
  // Layer 2 (8 tiles)
  { gridX: -1.5, gridY: -1.9, layer: 2 }, { gridX: -1.5, gridY:  1.9, layer: 2 },
  { gridX:  1.5, gridY: -1.9, layer: 2 }, { gridX:  1.5, gridY:  1.9, layer: 2 },
  { gridX: -1.5, gridY: -0.7, layer: 2 }, { gridX: -1.5, gridY:  0.7, layer: 2 },
  { gridX:  1.5, gridY: -0.7, layer: 2 }, { gridX:  1.5, gridY:  0.7, layer: 2 },
  // Layer 3 (4 tiles top bridges)
  { gridX: -1.5, gridY:  0.0, layer: 3 }, { gridX: -0.5, gridY:  0.0, layer: 3 },
  { gridX:  0.5, gridY:  0.0, layer: 3 }, { gridX:  1.5, gridY:  0.0, layer: 3 },
];

// 3. Cross Fortress (cross_fortress)
export const PATTERN_NORMAL_FORTRESS: PatternSlot[] = [
  // Layer 0 (10 tiles cross base)
  { gridX:  0.0, gridY: -2.0, layer: 0 }, { gridX:  0.0, gridY:  2.0, layer: 0 },
  { gridX: -2.0, gridY:  0.0, layer: 0 }, { gridX:  2.0, gridY:  0.0, layer: 0 },
  { gridX: -1.0, gridY: -2.0, layer: 0 }, { gridX:  1.0, gridY: -2.0, layer: 0 },
  { gridX: -1.0, gridY:  2.0, layer: 0 }, { gridX:  1.0, gridY:  2.0, layer: 0 },
  { gridX: -2.0, gridY: -1.0, layer: 0 }, { gridX:  2.0, gridY:  1.0, layer: 0 },
  // Layer 1 (8 tiles)
  { gridX:  0.0, gridY: -1.5, layer: 1 }, { gridX:  0.0, gridY:  1.5, layer: 1 },
  { gridX: -1.5, gridY:  0.0, layer: 1 }, { gridX:  1.5, gridY:  0.0, layer: 1 },
  { gridX: -1.0, gridY: -1.0, layer: 1 }, { gridX:  1.0, gridY:  1.0, layer: 1 },
  { gridX: -1.0, gridY:  1.0, layer: 1 }, { gridX:  1.0, gridY: -1.0, layer: 1 },
  // Layer 2 (8 tiles)
  { gridX: -0.5, gridY: -1.0, layer: 2 }, { gridX:  0.5, gridY: -1.0, layer: 2 },
  { gridX: -0.5, gridY:  1.0, layer: 2 }, { gridX:  0.5, gridY:  1.0, layer: 2 },
  { gridX: -1.0, gridY: -0.5, layer: 2 }, { gridX:  1.0, gridY: -0.5, layer: 2 },
  { gridX: -1.0, gridY:  0.5, layer: 2 }, { gridX:  1.0, gridY:  0.5, layer: 2 },
  // Layer 3 (4 tiles center keep)
  { gridX: -0.5, gridY: -0.5, layer: 3 }, { gridX:  0.5, gridY: -0.5, layer: 3 },
  { gridX: -0.5, gridY:  0.5, layer: 3 }, { gridX:  0.5, gridY:  0.5, layer: 3 },
];

// 4. Hourglass (hourglass)
export const PATTERN_NORMAL_HOURGLASS: PatternSlot[] = [
  // Layer 0 (10 tiles wide top/bottom)
  { gridX: -2.0, gridY: -2.6, layer: 0 }, { gridX: -1.0, gridY: -2.6, layer: 0 },
  { gridX:  0.0, gridY: -2.6, layer: 0 }, { gridX:  1.0, gridY: -2.6, layer: 0 },
  { gridX:  2.0, gridY: -2.6, layer: 0 }, { gridX: -2.0, gridY:  2.6, layer: 0 },
  { gridX: -1.0, gridY:  2.6, layer: 0 }, { gridX:  0.0, gridY:  2.6, layer: 0 },
  { gridX:  1.0, gridY:  2.6, layer: 0 }, { gridX:  2.0, gridY:  2.6, layer: 0 },
  // Layer 1 (8 tiles tapering)
  { gridX: -1.5, gridY: -1.9, layer: 1 }, { gridX: -0.5, gridY: -1.9, layer: 1 },
  { gridX:  0.5, gridY: -1.9, layer: 1 }, { gridX:  1.5, gridY: -1.9, layer: 1 },
  { gridX: -1.5, gridY:  1.9, layer: 1 }, { gridX: -0.5, gridY:  1.9, layer: 1 },
  { gridX:  0.5, gridY:  1.9, layer: 1 }, { gridX:  1.5, gridY:  1.9, layer: 1 },
  // Layer 2 (8 tiles narrow waist)
  { gridX: -1.0, gridY: -1.3, layer: 2 }, { gridX:  1.0, gridY: -1.3, layer: 2 },
  { gridX: -1.0, gridY: -0.7, layer: 2 }, { gridX:  1.0, gridY: -0.7, layer: 2 },
  { gridX: -1.0, gridY:  0.7, layer: 2 }, { gridX:  1.0, gridY:  0.7, layer: 2 },
  { gridX: -1.0, gridY:  1.3, layer: 2 }, { gridX:  1.0, gridY:  1.3, layer: 2 },
  // Layer 3 (4 tiles center waist)
  { gridX: -0.5, gridY: -0.7, layer: 3 }, { gridX:  0.5, gridY: -0.7, layer: 3 },
  { gridX: -0.5, gridY:  0.7, layer: 3 }, { gridX:  0.5, gridY:  0.7, layer: 3 },
];

// 5. Diagonal Cascade (staircase)
export const PATTERN_NORMAL_STAIRCASE: PatternSlot[] = [
  // Layer 0 (10 tiles diagonal)
  { gridX: -2.0, gridY: -2.0, layer: 0 }, { gridX: -1.5, gridY: -1.5, layer: 0 },
  { gridX: -1.0, gridY: -1.0, layer: 0 }, { gridX: -0.5, gridY: -0.5, layer: 0 },
  { gridX:  0.0, gridY:  0.0, layer: 0 }, { gridX:  0.5, gridY:  0.5, layer: 0 },
  { gridX:  1.0, gridY:  1.0, layer: 0 }, { gridX:  1.5, gridY:  1.5, layer: 0 },
  { gridX:  2.0, gridY:  2.0, layer: 0 }, { gridX:  2.0, gridY: -2.0, layer: 0 },
  // Layer 1 (8 tiles)
  { gridX: -1.5, gridY: -2.0, layer: 1 }, { gridX: -1.0, gridY: -1.5, layer: 1 },
  { gridX: -0.5, gridY: -1.0, layer: 1 }, { gridX:  0.0, gridY: -0.5, layer: 1 },
  { gridX:  0.5, gridY:  0.0, layer: 1 }, { gridX:  1.0, gridY:  0.5, layer: 1 },
  { gridX:  1.5, gridY:  1.0, layer: 1 }, { gridX:  2.0, gridY:  1.5, layer: 1 },
  // Layer 2 (8 tiles)
  { gridX: -2.0, gridY: -1.5, layer: 2 }, { gridX: -1.5, gridY: -1.0, layer: 2 },
  { gridX: -1.0, gridY: -0.5, layer: 2 }, { gridX: -0.5, gridY:  0.0, layer: 2 },
  { gridX:  0.0, gridY:  0.5, layer: 2 }, { gridX:  0.5, gridY:  1.0, layer: 2 },
  { gridX:  1.0, gridY:  1.5, layer: 2 }, { gridX:  1.5, gridY:  2.0, layer: 2 },
  // Layer 3 (4 tiles core)
  { gridX: -0.5, gridY: -0.5, layer: 3 }, { gridX:  0.5, gridY: -0.5, layer: 3 },
  { gridX: -0.5, gridY:  0.5, layer: 3 }, { gridX:  0.5, gridY:  0.5, layer: 3 },
];

// =========================================================================
// 5 DISTINCT MULTI-LAYER TILE LAYOUTS FOR HARD MODE (6 Layers, 50 Tiles)
// =========================================================================

// 1. Classic Diamond (pyramid) Hard
export const PATTERN_HARD_PYRAMID: PatternSlot[] = [
  // Layer 0 (8 tiles)
  { gridX:  0.0, gridY: -3.0, layer: 0 }, { gridX: -2.0, gridY: -2.0, layer: 0 },
  { gridX:  2.0, gridY: -2.0, layer: 0 }, { gridX: -3.0, gridY:  0.0, layer: 0 },
  { gridX:  3.0, gridY:  0.0, layer: 0 }, { gridX: -2.0, gridY:  2.0, layer: 0 },
  { gridX:  2.0, gridY:  2.0, layer: 0 }, { gridX:  0.0, gridY:  3.0, layer: 0 },
  // Layer 1 (12 tiles)
  { gridX: -1.5, gridY: -2.5, layer: 1 }, { gridX: -0.5, gridY: -2.5, layer: 1 },
  { gridX:  0.5, gridY: -2.5, layer: 1 }, { gridX:  1.5, gridY: -2.5, layer: 1 },
  { gridX: -2.5, gridY: -0.5, layer: 1 }, { gridX: -2.5, gridY:  0.5, layer: 1 },
  { gridX:  2.5, gridY: -0.5, layer: 1 }, { gridX:  2.5, gridY:  0.5, layer: 1 },
  { gridX: -1.5, gridY:  2.5, layer: 1 }, { gridX: -0.5, gridY:  2.5, layer: 1 },
  { gridX:  0.5, gridY:  2.5, layer: 1 }, { gridX:  1.5, gridY:  2.5, layer: 1 },
  // Layer 2 (10 tiles)
  { gridX: -1.0, gridY: -2.0, layer: 2 }, { gridX:  1.0, gridY: -2.0, layer: 2 },
  { gridX: -2.0, gridY: -1.0, layer: 2 }, { gridX: -2.0, gridY:  0.0, layer: 2 },
  { gridX: -2.0, gridY:  1.0, layer: 2 }, { gridX:  2.0, gridY: -1.0, layer: 2 },
  { gridX:  2.0, gridY:  0.0, layer: 2 }, { gridX:  2.0, gridY:  1.0, layer: 2 },
  { gridX: -1.0, gridY:  2.0, layer: 2 }, { gridX:  1.0, gridY:  2.0, layer: 2 },
  // Layer 3 (8 tiles)
  { gridX: -0.5, gridY: -1.5, layer: 3 }, { gridX:  0.5, gridY: -1.5, layer: 3 },
  { gridX: -1.5, gridY: -0.5, layer: 3 }, { gridX: -1.5, gridY:  0.5, layer: 3 },
  { gridX:  1.5, gridY: -0.5, layer: 3 }, { gridX:  1.5, gridY:  0.5, layer: 3 },
  { gridX: -0.5, gridY:  1.5, layer: 3 }, { gridX:  0.5, gridY:  1.5, layer: 3 },
  // Layer 4 (8 tiles)
  { gridX: -1.0, gridY: -1.0, layer: 4 }, { gridX:  0.0, gridY: -1.0, layer: 4 },
  { gridX:  1.0, gridY: -1.0, layer: 4 }, { gridX: -1.0, gridY:  0.0, layer: 4 },
  { gridX:  1.0, gridY:  0.0, layer: 4 }, { gridX: -1.0, gridY:  1.0, layer: 4 },
  { gridX:  0.0, gridY:  1.0, layer: 4 }, { gridX:  1.0, gridY:  1.0, layer: 4 },
  // Layer 5 (4 tiles)
  { gridX: -0.5, gridY: -0.5, layer: 5 }, { gridX:  0.5, gridY: -0.5, layer: 5 },
  { gridX: -0.5, gridY:  0.5, layer: 5 }, { gridX:  0.5, gridY:  0.5, layer: 5 },
];

// 2. Twin Towers Hard (twin_towers)
export const PATTERN_HARD_TOWERS: PatternSlot[] = [
  // Layer 0 (8 tiles)
  { gridX: -2.5, gridY: -2.6, layer: 0 }, { gridX: -1.5, gridY: -2.6, layer: 0 },
  { gridX: -2.5, gridY:  2.6, layer: 0 }, { gridX: -1.5, gridY:  2.6, layer: 0 },
  { gridX:  1.5, gridY: -2.6, layer: 0 }, { gridX:  2.5, gridY: -2.6, layer: 0 },
  { gridX:  1.5, gridY:  2.6, layer: 0 }, { gridX:  2.5, gridY:  2.6, layer: 0 },
  // Layer 1 (12 tiles)
  { gridX: -2.5, gridY: -1.3, layer: 1 }, { gridX: -1.5, gridY: -1.3, layer: 1 },
  { gridX: -2.5, gridY:  0.0, layer: 1 }, { gridX: -1.5, gridY:  0.0, layer: 1 },
  { gridX: -2.5, gridY:  1.3, layer: 1 }, { gridX: -1.5, gridY:  1.3, layer: 1 },
  { gridX:  1.5, gridY: -1.3, layer: 1 }, { gridX:  2.5, gridY: -1.3, layer: 1 },
  { gridX:  1.5, gridY:  0.0, layer: 1 }, { gridX:  2.5, gridY:  0.0, layer: 1 },
  { gridX:  1.5, gridY:  1.3, layer: 1 }, { gridX:  2.5, gridY:  1.3, layer: 1 },
  // Layer 2 (10 tiles)
  { gridX: -2.0, gridY: -3.3, layer: 2 }, { gridX: -2.0, gridY:  3.3, layer: 2 },
  { gridX:  2.0, gridY: -3.3, layer: 2 }, { gridX:  2.0, gridY:  3.3, layer: 2 },
  { gridX: -2.0, gridY: -2.0, layer: 2 }, { gridX: -2.0, gridY:  2.0, layer: 2 },
  { gridX:  2.0, gridY: -2.0, layer: 2 }, { gridX:  2.0, gridY:  2.0, layer: 2 },
  { gridX:  0.0, gridY: -3.3, layer: 2 }, { gridX:  0.0, gridY:  3.3, layer: 2 },
  // Layer 3 (8 tiles)
  { gridX: -2.0, gridY: -0.7, layer: 3 }, { gridX: -2.0, gridY:  0.7, layer: 3 },
  { gridX:  2.0, gridY: -0.7, layer: 3 }, { gridX:  2.0, gridY:  0.7, layer: 3 },
  { gridX: -1.0, gridY: -2.6, layer: 3 }, { gridX: -1.0, gridY:  2.6, layer: 3 },
  { gridX:  1.0, gridY: -2.6, layer: 3 }, { gridX:  1.0, gridY:  2.6, layer: 3 },
  // Layer 4 (8 tiles)
  { gridX: -1.5, gridY: -1.3, layer: 4 }, { gridX: -1.5, gridY:  1.3, layer: 4 },
  { gridX:  1.5, gridY: -1.3, layer: 4 }, { gridX:  1.5, gridY:  1.3, layer: 4 },
  { gridX: -1.0, gridY: -1.3, layer: 4 }, { gridX: -1.0, gridY:  1.3, layer: 4 },
  { gridX:  1.0, gridY: -1.3, layer: 4 }, { gridX:  1.0, gridY:  1.3, layer: 4 },
  // Layer 5 (4 tiles center bridge)
  { gridX: -0.5, gridY: -0.7, layer: 5 }, { gridX:  0.5, gridY: -0.7, layer: 5 },
  { gridX: -0.5, gridY:  0.7, layer: 5 }, { gridX:  0.5, gridY:  0.7, layer: 5 },
];

// 3. Cross Fortress Hard (cross_fortress)
export const PATTERN_HARD_FORTRESS: PatternSlot[] = [
  // Layer 0 (8 tiles)
  { gridX:  0.0, gridY: -3.0, layer: 0 }, { gridX:  0.0, gridY:  3.0, layer: 0 },
  { gridX: -3.0, gridY:  0.0, layer: 0 }, { gridX:  3.0, gridY:  0.0, layer: 0 },
  { gridX: -2.0, gridY: -2.0, layer: 0 }, { gridX:  2.0, gridY: -2.0, layer: 0 },
  { gridX: -2.0, gridY:  2.0, layer: 0 }, { gridX:  2.0, gridY:  2.0, layer: 0 },
  // Layer 1 (12 tiles)
  { gridX:  0.0, gridY: -2.0, layer: 1 }, { gridX:  0.0, gridY:  2.0, layer: 1 },
  { gridX: -2.0, gridY:  0.0, layer: 1 }, { gridX:  2.0, gridY:  0.0, layer: 1 },
  { gridX: -1.0, gridY: -2.5, layer: 1 }, { gridX:  1.0, gridY: -2.5, layer: 1 },
  { gridX: -1.0, gridY:  2.5, layer: 1 }, { gridX:  1.0, gridY:  2.5, layer: 1 },
  { gridX: -2.5, gridY: -1.0, layer: 1 }, { gridX:  2.5, gridY: -1.0, layer: 1 },
  { gridX: -2.5, gridY:  1.0, layer: 1 }, { gridX:  2.5, gridY:  1.0, layer: 1 },
  // Layer 2 (10 tiles)
  { gridX: -1.5, gridY: -1.5, layer: 2 }, { gridX:  1.5, gridY: -1.5, layer: 2 },
  { gridX: -1.5, gridY:  1.5, layer: 2 }, { gridX:  1.5, gridY:  1.5, layer: 2 },
  { gridX:  0.0, gridY: -1.5, layer: 2 }, { gridX:  0.0, gridY:  1.5, layer: 2 },
  { gridX: -1.5, gridY:  0.0, layer: 2 }, { gridX:  1.5, gridY:  0.0, layer: 2 },
  { gridX: -1.0, gridY: -1.0, layer: 2 }, { gridX:  1.0, gridY:  1.0, layer: 2 },
  // Layer 3 (8 tiles)
  { gridX: -1.0, gridY: -0.5, layer: 3 }, { gridX:  1.0, gridY: -0.5, layer: 3 },
  { gridX: -1.0, gridY:  0.5, layer: 3 }, { gridX:  1.0, gridY:  0.5, layer: 3 },
  { gridX: -0.5, gridY: -1.0, layer: 3 }, { gridX:  0.5, gridY: -1.0, layer: 3 },
  { gridX: -0.5, gridY:  1.0, layer: 3 }, { gridX:  0.5, gridY:  1.0, layer: 3 },
  // Layer 4 (8 tiles)
  { gridX: -1.0, gridY: -1.0, layer: 4 }, { gridX:  1.0, gridY: -1.0, layer: 4 },
  { gridX: -1.0, gridY:  1.0, layer: 4 }, { gridX:  1.0, gridY:  1.0, layer: 4 },
  { gridX:  0.0, gridY: -1.0, layer: 4 }, { gridX:  0.0, gridY:  1.0, layer: 4 },
  { gridX: -1.0, gridY:  0.0, layer: 4 }, { gridX:  1.0, gridY:  0.0, layer: 4 },
  // Layer 5 (4 tiles)
  { gridX: -0.5, gridY: -0.5, layer: 5 }, { gridX:  0.5, gridY: -0.5, layer: 5 },
  { gridX: -0.5, gridY:  0.5, layer: 5 }, { gridX:  0.5, gridY:  0.5, layer: 5 },
];

// 4. Hourglass Hard (hourglass)
export const PATTERN_HARD_HOURGLASS: PatternSlot[] = [
  // Layer 0 (8 tiles)
  { gridX: -2.5, gridY: -3.3, layer: 0 }, { gridX: -1.5, gridY: -3.3, layer: 0 },
  { gridX:  1.5, gridY: -3.3, layer: 0 }, { gridX:  2.5, gridY: -3.3, layer: 0 },
  { gridX: -2.5, gridY:  3.3, layer: 0 }, { gridX: -1.5, gridY:  3.3, layer: 0 },
  { gridX:  1.5, gridY:  3.3, layer: 0 }, { gridX:  2.5, gridY:  3.3, layer: 0 },
  // Layer 1 (12 tiles)
  { gridX: -2.0, gridY: -2.6, layer: 1 }, { gridX: -1.0, gridY: -2.6, layer: 1 },
  { gridX:  0.0, gridY: -2.6, layer: 1 }, { gridX:  1.0, gridY: -2.6, layer: 1 },
  { gridX:  2.0, gridY: -2.6, layer: 1 }, { gridX: -2.0, gridY:  2.6, layer: 1 },
  { gridX: -1.0, gridY:  2.6, layer: 1 }, { gridX:  0.0, gridY:  2.6, layer: 1 },
  { gridX:  1.0, gridY:  2.6, layer: 1 }, { gridX:  2.0, gridY:  2.6, layer: 1 },
  { gridX: -3.0, gridY:  0.0, layer: 1 }, { gridX:  3.0, gridY:  0.0, layer: 1 },
  // Layer 2 (10 tiles tapering)
  { gridX: -1.5, gridY: -2.0, layer: 2 }, { gridX: -0.5, gridY: -2.0, layer: 2 },
  { gridX:  0.5, gridY: -2.0, layer: 2 }, { gridX:  1.5, gridY: -2.0, layer: 2 },
  { gridX: -1.5, gridY:  2.0, layer: 2 }, { gridX: -0.5, gridY:  2.0, layer: 2 },
  { gridX:  0.5, gridY:  2.0, layer: 2 }, { gridX:  1.5, gridY:  2.0, layer: 2 },
  { gridX: -2.0, gridY:  0.0, layer: 2 }, { gridX:  2.0, gridY:  0.0, layer: 2 },
  // Layer 3 (8 tiles narrow waist)
  { gridX: -1.0, gridY: -1.3, layer: 3 }, { gridX:  1.0, gridY: -1.3, layer: 3 },
  { gridX: -1.0, gridY: -0.7, layer: 3 }, { gridX:  1.0, gridY: -0.7, layer: 3 },
  { gridX: -1.0, gridY:  0.7, layer: 3 }, { gridX:  1.0, gridY:  0.7, layer: 3 },
  { gridX: -1.0, gridY:  1.3, layer: 3 }, { gridX:  1.0, gridY:  1.3, layer: 3 },
  // Layer 4 (8 tiles waist)
  { gridX: -0.5, gridY: -1.3, layer: 4 }, { gridX:  0.5, gridY: -1.3, layer: 4 },
  { gridX: -0.5, gridY: -0.7, layer: 4 }, { gridX:  0.5, gridY: -0.7, layer: 4 },
  { gridX: -0.5, gridY:  0.7, layer: 4 }, { gridX:  0.5, gridY:  0.7, layer: 4 },
  { gridX: -0.5, gridY:  1.3, layer: 4 }, { gridX:  0.5, gridY:  1.3, layer: 4 },
  // Layer 5 (4 tiles center)
  { gridX: -0.5, gridY: -0.7, layer: 5 }, { gridX:  0.5, gridY: -0.7, layer: 5 },
  { gridX: -0.5, gridY:  0.7, layer: 5 }, { gridX:  0.5, gridY:  0.7, layer: 5 },
];

// 5. Diagonal Cascade Hard (staircase)
export const PATTERN_HARD_STAIRCASE: PatternSlot[] = [
  // Layer 0 (8 tiles)
  { gridX: -3.0, gridY: -3.0, layer: 0 }, { gridX: -2.0, gridY: -2.0, layer: 0 },
  { gridX: -1.0, gridY: -1.0, layer: 0 }, { gridX:  0.0, gridY:  0.0, layer: 0 },
  { gridX:  1.0, gridY:  1.0, layer: 0 }, { gridX:  2.0, gridY:  2.0, layer: 0 },
  { gridX:  3.0, gridY:  3.0, layer: 0 }, { gridX:  3.0, gridY: -3.0, layer: 0 },
  // Layer 1 (12 tiles)
  { gridX: -2.5, gridY: -2.5, layer: 1 }, { gridX: -1.5, gridY: -1.5, layer: 1 },
  { gridX: -0.5, gridY: -0.5, layer: 1 }, { gridX:  0.5, gridY:  0.5, layer: 1 },
  { gridX:  1.5, gridY:  1.5, layer: 1 }, { gridX:  2.5, gridY:  2.5, layer: 1 },
  { gridX: -2.5, gridY: -1.5, layer: 1 }, { gridX: -1.5, gridY: -0.5, layer: 1 },
  { gridX: -0.5, gridY:  0.5, layer: 1 }, { gridX:  0.5, gridY:  1.5, layer: 1 },
  { gridX:  1.5, gridY:  2.5, layer: 1 }, { gridX:  2.5, gridY:  3.0, layer: 1 },
  // Layer 2 (10 tiles)
  { gridX: -3.0, gridY: -1.0, layer: 2 }, { gridX: -2.0, gridY: -0.0, layer: 2 },
  { gridX: -1.0, gridY:  1.0, layer: 2 }, { gridX:  0.0, gridY:  2.0, layer: 2 },
  { gridX:  1.0, gridY:  3.0, layer: 2 }, { gridX: -2.0, gridY: -3.0, layer: 2 },
  { gridX: -1.0, gridY: -2.0, layer: 2 }, { gridX:  0.0, gridY: -1.0, layer: 2 },
  { gridX:  1.0, gridY:  0.0, layer: 2 }, { gridX:  2.0, gridY:  1.0, layer: 2 },
  // Layer 3 (8 tiles)
  { gridX: -2.0, gridY: -1.5, layer: 3 }, { gridX: -1.0, gridY: -0.5, layer: 3 },
  { gridX:  0.0, gridY:  0.5, layer: 3 }, { gridX:  1.0, gridY:  1.5, layer: 3 },
  { gridX: -1.5, gridY: -2.0, layer: 3 }, { gridX: -0.5, gridY: -1.0, layer: 3 },
  { gridX:  0.5, gridY:  0.0, layer: 3 }, { gridX:  1.5, gridY:  1.0, layer: 3 },
  // Layer 4 (8 tiles)
  { gridX: -1.0, gridY: -1.5, layer: 4 }, { gridX:  0.0, gridY: -0.5, layer: 4 },
  { gridX:  1.0, gridY:  0.5, layer: 4 }, { gridX:  2.0, gridY:  1.5, layer: 4 },
  { gridX: -1.5, gridY: -1.0, layer: 4 }, { gridX: -0.5, gridY:  0.0, layer: 4 },
  { gridX:  0.5, gridY:  1.0, layer: 4 }, { gridX:  1.5, gridY:  2.0, layer: 4 },
  // Layer 5 (4 tiles)
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
