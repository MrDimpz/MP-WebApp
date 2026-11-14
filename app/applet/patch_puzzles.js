const fs = require('fs');
let content = fs.readFileSync('src/thematix/data/puzzles.ts', 'utf8');

// 1. Fix Fossil puzzle truncated words
const oldFossil = `  {
    clue: '"Prehistoric dinosaur titans"',
    themeWord: 'FOSSIL',
    words: ['ANKYLO', 'BRACHIO', 'RAPTOR', 'SPINO', 'STEGO', 'TREX'],
    difficulty: 'Medium',
    funFact: 'The Stegosaurus had a brain roughly the size of a walnut, despite weighing over 5 tons.'
  },`;

const newFossil = `  {
    clue: '"Prehistoric amber inclusions and bones"',
    themeWord: 'FOSSIL',
    words: ['AMBER', 'AMMONITE', 'BONE', 'CORAL', 'MOLD', 'TOOTH'],
    difficulty: 'Medium',
    funFact: 'Fossils are preserved remains or traces of ancient animals, plants, and other organisms from the remote geological past.'
  },`;

if (content.includes(oldFossil)) {
  content = content.replace(oldFossil, newFossil);
  console.log('Fixed Fossil puzzle');
} else {
  console.log('Could not find old Fossil puzzle block');
}

// 2. Fix clues containing themeWord
const clueReplacements = [
  { from: '"Midnight countdown to a new beginning"', to: '"Midnight ticking celebration to a new year"' },
  { from: '"Protect our shared home planet"', to: '"Protect our shared celestial globe"' },
  { from: '"Fiesta of music and heritage"', to: '"Vibrant celebration of music and heritage"' },
  { from: '"Fresh bakery morning aromas"', to: '"Fresh patisserie morning aromas"' },
  { from: '"Citrus orchard harvest"', to: '"Tangy orchard fruit harvest"' },
  { from: '"Spices from the silk road"', to: '"Aromatic seasonings from the silk road"' },
  { from: '"Berry patch basket"', to: '"Juicy bramble fruit basket"' },
  { from: '"At the circus big top"', to: '"Under the big top tent"' },
  { from: '"Ancient wonders of architecture"', to: '"Ancient marvels of architecture"' },
  { from: '"Modes of public transit"', to: '"Modes of public commute"' },
  { from: '"Fresh salad bar garden greens"', to: '"Fresh leafy garden greens"' },
  { from: '"In the cocktail bartender\'s garnish"', to: '"In the cocktail bartender\'s rim"' },
  { from: '"In the photographer\'s camera bag"', to: '"In the photographer\'s equipment bag"' },
  { from: '"Popular ballroom dancing styles"', to: '"Popular formal dancing styles"' },
  { from: '"In the Italian trattoria kitchen"', to: '"In the Italian rustic eatery"' },
  { from: '"Under the hood of an electric car"', to: '"Under the hood of a battery-powered car"' },
  { from: '"Fresh fruits in the summer orchard"', to: '"Fresh fruits in the summer grove"' },
  { from: '"On the classic diner counter"', to: '"On the classic retro eatery counter"' },
  { from: '"In the school science laboratory"', to: '"In the school science experiment room"' },
  { from: '"Musical brass section power"', to: '"Musical horn section power"' },
  { from: '"On the campfire barbecue grill"', to: '"On the backyard charcoal grill"' },
  { from: '"In the tropical island lagoon"', to: '"In the tropical island turquoise cove"' },
  { from: '"On the summer tennis lawn court"', to: '"On the summer racket lawn court"' },
  { from: '"In the botanical apothecary herb shop"', to: '"In the botanical herbalist shop"' },
  { from: '"In the morning country breakfast pantry"', to: '"In the morning country breakfast larder"' },
  { from: '"On the evening symphony orchestra program"', to: '"On the evening orchestral concert program"' },
  { from: '"Things with strings that play music"', to: '"Things with chords that play music"' },
  { from: '"Things in the Italian espresso bar"', to: '"Things in the Italian coffee bar"' },
  { from: '"Things in the sweet chocolate factory"', to: '"Things in the sweet confectionary factory"' },
  { from: '"Things in the classic detective mystery"', to: '"Things in the classic sleuth mystery"' },
  { from: '"Architectural gems of a Gothic cathedral"', to: '"Architectural gems of a Gothic minster"' },
  { from: '"Tools of a traditional bookbinder"', to: '"Tools of a traditional tome binder"' },
  { from: '"Instruments of celestial navigation"', to: '"Instruments of stellar navigation"' },
  { from: '"Inside a classical luthiers workshop"', to: '"Inside a classical stringed-instrument workshop"' },
  { from: '"Desert oasis caravan stop"', to: '"Desert oasis nomad convoy stop"' },
  { from: '"Winter Nordic ski lodge"', to: '"Winter Scandinavian ski lodge"' },
  { from: '"Classic boardwalk amusement pier"', to: '"Classic seaside amusement pier"' },
  { from: '"Autumn woodland foraging basket"', to: '"Autumn forest foraging basket"' }
];

let replacedCount = 0;
for (const rep of clueReplacements) {
  if (content.includes(rep.from)) {
    content = content.replace(rep.from, rep.to);
    replacedCount++;
  } else {
    console.log(`Warning: could not find clue ${rep.from}`);
  }
}
console.log(`Replaced ${replacedCount} clues.`);

fs.writeFileSync('src/thematix/data/puzzles.ts', content, 'utf8');
console.log('Successfully patched puzzles.ts');
