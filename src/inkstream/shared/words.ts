export const DEFAULT_WORDS: string[] = [
  // Animals
  'elephant', 'penguin', 'giraffe', 'octopus', 'flamingo', 'hedgehog', 'kangaroo',
  'dolphin', 'chameleon', 'platypus', 'squirrel', 'butterfly', 'jellyfish', 'crocodile',
  'peacock', 'panda', 'lobster', 'seahorse', 'raccoon', 'koala', 'cheetah', 'owl',
  'shark', 'turtle', 'hamster', 'toucan', 'narwhal', 'beaver', 'sloth', 'walrus',
  'ladybug', 'scorpion', 'firefly', 'goldfish', 'parrot', 'alpaca', 'gorilla', 'camel',

  // Food & Drink
  'pizza', 'avocado', 'croissant', 'pancake', 'pineapple', 'spaghetti', 'cupcake',
  'hamburger', 'watermelon', 'sushi', 'pretzel', 'popcorn', 'taco', 'donut',
  'ice cream', 'lemonade', 'broccoli', 'cheesecake', 'hot dog', 'waffle', 'strawberry',
  'ramen', 'sandwich', 'burrito', 'pretzel', 'lollipop', 'chocolate', 'cinnamon roll',
  'fried egg', 'mushroom', 'coconut', 'cherry', 'banana split', 'milkshake', 'boba tea',

  // Everyday Objects
  'umbrella', 'telescope', 'backpack', 'headphones', 'bicycle', 'hourglass', 'compass',
  'skateboard', 'lantern', 'typewriter', 'microscope', 'toothbrush', 'sunglasses',
  'keyboard', 'guitar', 'violin', 'camera', 'balloon', 'suitcase', 'scissors',
  'magnifying glass', 'alarm clock', 'flashlight', 'teapot', 'trophy', 'keyhole',
  'shopping cart', 'paper airplane', 'snow globe', 'wind chime', 'paint palette',
  'traffic light', 'chessboard', 'anchor', 'boomerang', 'binoculars', 'lawnmower',
  'washing machine', 'microwave', 'toaster', 'chandelier', 'hammock', 'wheelbarrow',

  // Nature & Weather
  'volcano', 'rainbow', 'waterfall', 'cactus', 'tornado', 'glacier', 'lightning',
  'aurora', 'campfire', 'lighthouse', 'mountain', 'palm tree', 'sunflower', 'eclipse',
  'avalanche', 'coral reef', 'island', 'snowflake', 'meteor', 'bonsai', 'pinecone',
  'mushroom cloud', 'crescent moon', 'shooting star', 'sandcastle', 'geyser',

  // Places & Architecture
  'castle', 'pyramid', 'igloo', 'treehouse', 'ferris wheel', 'skyscraper', 'windmill',
  'bridge', 'library', 'aquarium', 'greenhouse', 'bakery', 'space station', 'roller coaster',
  'cabin', 'pagoda', 'amphitheater', 'observatory', 'subway', 'train station',

  // Vehicles & Adventure
  'submarine', 'helicopter', 'hot air balloon', 'rocket', 'pirate ship', 'sailboat',
  'tractor', 'bulldozer', 'ambulance', 'fire truck', 'spaceship', 'scooter', 'kayak',
  'parachute', 'cable car', 'monster truck', 'unicycle', 'gondola', 'jet ski',

  // Fantasy, Sci-Fi & Characters
  'dragon', 'unicorn', 'astronaut', 'wizard', 'mermaid', 'robot', 'vampire', 'ninja',
  'pirate', 'superhero', 'detective', 'scarecrow', 'snowman', 'alien', 'phoenix',
  'knight', 'yeti', 'centaur', 'genie', 'ghost', 'treasure chest', 'magic wand',
  'crystal ball', 'time machine', 'ufo', 'portal', 'crown', 'sword', 'shield',

  // Sports, Music & Activities
  'basketball', 'archery', 'bowling', 'surfing', 'skateboarding', 'fishing', 'camping',
  'juggling', 'origami', 'karate', 'fencing', 'badminton', 'volleyball', 'snowboarding',
  'saxophone', 'accordion', 'drum set', 'harp', 'trumpet', 'microphone', 'vinyl record',
  'ping pong', 'trampoline', 'tug of war', 'hopscotch', 'kite', 'boomerang'
];

export const SKRIBBL_COLORS: string[] = [
  '#0F172A', '#FFFFFF', '#94A3B8', '#EF4444', '#F97316', '#FACC15',
  '#22C55E', '#14B8A6', '#06B6D4', '#2563EB', '#8B5CF6', '#EC4899', '#78350F',
];

export const AVATAR_COLORS: string[] = [
  '#2563EB', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1',
];

export function levenshteinDistance(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const prev = new Array<number>(s2.length + 1);
  const curr = new Array<number>(s2.length + 1);

  for (let j = 0; j <= s2.length; j++) prev[j] = j;

  for (let i = 1; i <= s1.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= s2.length; j++) prev[j] = curr[j];
  }
  return prev[s2.length];
}

export function isCloseGuess(guess: string, target: string): boolean {
  const g = guess.toLowerCase().trim().replace(/\s+/g, ' ');
  const t = target.toLowerCase().trim().replace(/\s+/g, ' ');
  if (!g || g === t) return false;

  // Check multi-word partial matches (e.g. "cream" or "ice" for "ice cream")
  const targetParts = t.split(' ').filter((p) => p.length >= 3);
  if (targetParts.length > 1) {
    if (targetParts.some((part) => g === part || (g.length >= 4 && levenshteinDistance(g, part) <= 1))) {
      return true;
    }
  }

  if (t.length <= 3) {
    return levenshteinDistance(g, t) === 1;
  }

  const dist = levenshteinDistance(g, t);
  const threshold = t.length >= 7 ? 2 : 1;
  if (dist > 0 && dist <= threshold) return true;

  // Catch strong prefix / substring near-matches (e.g., "pineap" for "pineapple")
  if (g.length >= 4 && Math.abs(g.length - t.length) <= 3 && (t.includes(g) || g.includes(t))) {
    return true;
  }

  return false;
}
