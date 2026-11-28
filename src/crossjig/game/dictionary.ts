import english10 from 'wordlist-english/english-words-10.json';
import english20 from 'wordlist-english/english-words-20.json';
import english35 from 'wordlist-english/english-words-35.json';
import english40 from 'wordlist-english/english-words-40.json';
import english50 from 'wordlist-english/english-words-50.json';
import american10 from 'wordlist-english/american-words-10.json';
import american20 from 'wordlist-english/american-words-20.json';
import american35 from 'wordlist-english/american-words-35.json';
import american40 from 'wordlist-english/american-words-40.json';
import american50 from 'wordlist-english/american-words-50.json';

/**
 * Official standard 2-letter word game words (TWL / NWL / CSW core)
 * used during validation so any legitimate 2-letter crossing is accepted.
 */
const STANDARD_TWO_LETTER_WORDS = [
  'AA', 'AB', 'AD', 'AE', 'AG', 'AH', 'AI', 'AL', 'AM', 'AN', 'AR', 'AS', 'AT', 'AW', 'AX', 'AY',
  'BA', 'BE', 'BI', 'BO', 'BY',
  'DA', 'DE', 'DO',
  'ED', 'EF', 'EH', 'EL', 'EM', 'EN', 'ER', 'ES', 'ET', 'EW', 'EX',
  'FA', 'FE',
  'GI', 'GO',
  'HA', 'HE', 'HI', 'HM', 'HO',
  'ID', 'IF', 'IN', 'IS', 'IT',
  'JO',
  'KA', 'KI',
  'LA', 'LI', 'LO',
  'MA', 'ME', 'MI', 'MM', 'MO', 'MU', 'MY',
  'NA', 'NE', 'NO', 'NU',
  'OD', 'OE', 'OF', 'OH', 'OI', 'OK', 'OM', 'ON', 'OP', 'OR', 'OS', 'OW', 'OX', 'OY',
  'PA', 'PE', 'PI', 'PO',
  'QI',
  'RE',
  'SH', 'SI', 'SO',
  'TA', 'TI', 'TO',
  'UH', 'UM', 'UN', 'UP', 'US', 'UT',
  'WE', 'WO',
  'XI', 'XU',
  'YA', 'YE', 'YO',
  'ZA',
];

const ALPHA_ONLY = /^[a-z]+$/;

/** Curated exclusions: single-letter abbreviations or overly obscure fragments for generation */
const GENERATION_EXCLUSIONS = new Set<string>([
  'III', 'VII', 'VIII', 'XII', 'XIV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XXI',
  'MRS', 'MR', 'MS', 'DR', 'ST', 'JR', 'SR', 'ETC', 'VS',
]);

export interface DictionaryIndex {
  /** Full standard English dictionary for validating any formed word */
  validWords: Set<string>;
  /** Everyday high-frequency words grouped by length (3..9) for generating fair puzzles */
  commonByLength: Map<number, string[]>;
  /** Broader standard English words grouped by length (3..9) as solver fallback */
  extendedByLength: Map<number, string[]>;
  /** Total dictionary word count */
  totalWordCount: number;
}

let cachedIndex: DictionaryIndex | null = null;

function buildDictionaryIndex(): DictionaryIndex {
  const validWords = new Set<string>(STANDARD_TWO_LETTER_WORDS);
  const commonSets = new Map<number, Set<string>>();
  const extendedSets = new Map<number, Set<string>>();

  for (let len = 3; len <= 9; len++) {
    commonSets.set(len, new Set<string>());
    extendedSets.set(len, new Set<string>());
  }

  const commonSources: string[][] = [
    english10 as string[],
    american10 as string[],
    english20 as string[],
    american20 as string[],
    english35 as string[],
    american35 as string[],
  ];

  const extendedSources: string[][] = [
    english40 as string[],
    american40 as string[],
    english50 as string[],
    american50 as string[],
  ];

  for (const list of commonSources) {
    for (let i = 0; i < list.length; i++) {
      const raw = list[i];
      if (!ALPHA_ONLY.test(raw)) continue;
      const word = raw.toUpperCase();
      if (word.length < 2 || word.length > 15) continue;
      validWords.add(word);
      if (word.length >= 3 && word.length <= 9 && !GENERATION_EXCLUSIONS.has(word)) {
        commonSets.get(word.length)!.add(word);
        extendedSets.get(word.length)!.add(word);
      }
    }
  }

  for (const list of extendedSources) {
    for (let i = 0; i < list.length; i++) {
      const raw = list[i];
      if (!ALPHA_ONLY.test(raw)) continue;
      const word = raw.toUpperCase();
      if (word.length < 2 || word.length > 15) continue;
      validWords.add(word);
      if (word.length >= 3 && word.length <= 9 && !GENERATION_EXCLUSIONS.has(word)) {
        extendedSets.get(word.length)!.add(word);
      }
    }
  }

  const commonByLength = new Map<number, string[]>();
  const extendedByLength = new Map<number, string[]>();
  for (let len = 3; len <= 9; len++) {
    commonByLength.set(len, Array.from(commonSets.get(len)!));
    extendedByLength.set(len, Array.from(extendedSets.get(len)!));
  }

  return {
    validWords,
    commonByLength,
    extendedByLength,
    totalWordCount: validWords.size,
  };
}

export function getDictionary(): DictionaryIndex {
  if (!cachedIndex) {
    cachedIndex = buildDictionaryIndex();
  }
  return cachedIndex;
}

export function isValidWord(word: string): boolean {
  return getDictionary().validWords.has(word.toUpperCase());
}
