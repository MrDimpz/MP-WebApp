import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { RAW_TARGET_POOL } from './targetWordsEn.ts';
import { MULTILANG_WORD_PACKS } from '../../src/data/dictionaries/multilang-word-packs.ts';
import {
  normalizeDictionaryLanguage,
  stripDiacritics,
  type DictionaryLanguageCode,
} from '../../src/lib/dictionary-languages.ts';
import type { LadderMode } from '../../src/mpwh/shared/types.ts';

const require = createRequire(import.meta.url);
const wordsJsonPath = require.resolve('an-array-of-english-words/index.json');
const words = JSON.parse(fs.readFileSync(wordsJsonPath, 'utf8')) as string[];

interface LanguageDictionary {
  validArray: string[];
  validSet: Set<string>;
  targetWords: string[];
}

// Build English dictionary once (4-8 lowercase ASCII letters, ~80,000+ words)
const EN_VALID_ARRAY: string[] = [];
const EN_VALID_SET = new Set<string>();
for (const w of words) {
  if (w.length >= 4 && w.length <= 8 && /^[a-z]+$/.test(w)) {
    EN_VALID_SET.add(w);
    EN_VALID_ARRAY.push(w);
  }
}
EN_VALID_ARRAY.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const EN_TARGET_WORDS = Array.from(
  new Set(
    RAW_TARGET_POOL.map((w) => w.toLowerCase().trim()).filter(
      (w) => w.length >= 4 && w.length <= 8 && EN_VALID_SET.has(w)
    )
  )
).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const DICTIONARIES = new Map<DictionaryLanguageCode, LanguageDictionary>();
DICTIONARIES.set('en', {
  validArray: EN_VALID_ARRAY,
  validSet: EN_VALID_SET,
  targetWords: EN_TARGET_WORDS,
});

function getLanguageDictionary(langInput?: string): LanguageDictionary {
  const lang = normalizeDictionaryLanguage(langInput);
  const cached = DICTIONARIES.get(lang);
  if (cached) return cached;

  if (lang === 'en') {
    return DICTIONARIES.get('en')!;
  }

  const pack = MULTILANG_WORD_PACKS[lang];
  const validSet = new Set<string>();
  const validArray: string[] = [];

  if (pack) {
    for (const rawWord of pack.words) {
      const clean = stripDiacritics(rawWord).toLowerCase().replace(/[^a-z]/g, '');
      if (clean.length >= 4 && clean.length <= 8 && !validSet.has(clean)) {
        validSet.add(clean);
        validArray.push(clean);
      }
    }
    for (const rawPrompt of pack.drawingPrompts) {
      if (rawPrompt.includes(' ') || rawPrompt.includes('-')) continue;
      const clean = stripDiacritics(rawPrompt).toLowerCase().replace(/[^a-z]/g, '');
      if (clean.length >= 4 && clean.length <= 8 && !validSet.has(clean)) {
        validSet.add(clean);
        validArray.push(clean);
      }
    }
  }

  validArray.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  // Fallback to English if a pack somehow had too few words
  if (validArray.length < 30) {
    return DICTIONARIES.get('en')!;
  }

  const dict: LanguageDictionary = {
    validArray,
    validSet,
    targetWords: validArray,
  };
  DICTIONARIES.set(lang, dict);
  return dict;
}

export function normalizeGuessWord(raw: string): string {
  return stripDiacritics(String(raw ?? ''))
    .toLowerCase()
    .trim()
    .replace(/[^a-z]/g, '');
}

export function isValidDictionaryWord(
  word: string,
  lang: DictionaryLanguageCode = 'en'
): boolean {
  const clean = normalizeGuessWord(word);
  if (clean.length < 4 || clean.length > 8) return false;
  return getLanguageDictionary(lang).validSet.has(clean);
}

function seededIndices(seedStr: string, count: number, poolLength: number): number[] {
  const picked: number[] = [];
  const used = new Set<number>();
  let nonce = 0;
  while (picked.length < count && nonce < 500) {
    const hash = crypto
      .createHash('sha256')
      .update(`${seedStr}:${nonce++}`)
      .digest();
    const idx = hash.readUInt32BE(0) % poolLength;
    if (!used.has(idx)) {
      used.add(idx);
      picked.push(idx);
    }
  }
  return picked;
}

export function pickTargetWords(
  mode: LadderMode,
  lang: DictionaryLanguageCode = 'en',
  dailyDate?: string
): string[] {
  const count = mode === 'classic' ? 1 : mode === 'dual' ? 2 : 4;
  const pool = getLanguageDictionary(lang).targetWords;

  if (dailyDate) {
    const indices = seededIndices(
      `mpwh-daily:${lang}:${dailyDate}:${mode}`,
      count,
      pool.length
    );
    const wordsPicked = indices.map((i) => pool[i]);
    if (mode === 'dual') {
      wordsPicked.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    }
    return wordsPicked;
  }

  const picked: string[] = [];
  const used = new Set<string>();
  let attempts = 0;

  while (picked.length < count && attempts < 240) {
    attempts++;
    const idx = crypto.randomInt(0, pool.length);
    const candidate = pool[idx];
    if (used.has(candidate)) continue;
    // For Dual mode, ensure the two words have meaningful alphabetical separation
    if (mode === 'dual' && picked.length === 1) {
      if (candidate.slice(0, 2) === picked[0].slice(0, 2)) continue;
    }
    used.add(candidate);
    picked.push(candidate);
  }

  if (mode === 'dual') {
    picked.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  return picked;
}

function lowerBoundIndex(arr: string[], target: string): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Computes a smart dictionary word strictly between the current closest bound
 * and the secret word, narrowing the bracket roughly in half without spoiling it.
 */
export function computeBisectHint(
  secretWord: string,
  closestBefore: string | null,
  closestAfter: string | null,
  alreadyUsed: Set<string>,
  lang: DictionaryLanguageCode = 'en'
): string | null {
  const { validArray, targetWords } = getLanguageDictionary(lang);
  const secretIdx = lowerBoundIndex(validArray, secretWord);
  const beforeIdx = closestBefore ? lowerBoundIndex(validArray, closestBefore) : 0;
  const afterIdx = closestAfter
    ? lowerBoundIndex(validArray, closestAfter)
    : validArray.length - 1;

  const distBefore = Math.max(0, secretIdx - beforeIdx);
  const distAfter = Math.max(0, afterIdx - secretIdx);

  const preferBefore = distBefore >= distAfter;
  const sides: Array<'before' | 'after'> = preferBefore
    ? ['before', 'after']
    : ['after', 'before'];

  for (const side of sides) {
    const start = side === 'before' ? beforeIdx + (closestBefore ? 1 : 0) : secretIdx + 1;
    const end = side === 'before' ? secretIdx - 1 : afterIdx - (closestAfter ? 1 : 0);
    if (start > end) continue;

    // Prefer a recognizable target word of the same length first
    const requiredLen = secretWord.length;
    const targetCandidates = targetWords.filter(
      (w) =>
        w.length === requiredLen &&
        !alreadyUsed.has(w) &&
        w !== secretWord &&
        (side === 'before'
          ? (!closestBefore || w > closestBefore) && w < secretWord
          : w > secretWord && (!closestAfter || w < closestAfter))
    );

    if (targetCandidates.length > 0) {
      const pickIndex =
        side === 'before'
          ? Math.floor(targetCandidates.length * 0.65)
          : Math.floor(targetCandidates.length * 0.35);
      return targetCandidates[
        Math.min(targetCandidates.length - 1, Math.max(0, pickIndex))
      ];
    }

    // Fallback: bisect full dictionary array (prefer matching length, then any valid length)
    const mid = Math.floor((start + end) / 2);
    const maxOffset = Math.max(mid - start, end - mid);
    for (const enforceLength of [true, false]) {
      for (let offset = 0; offset <= maxOffset; offset++) {
        for (const candidateIdx of [mid + offset, mid - offset]) {
          if (candidateIdx >= start && candidateIdx <= end) {
            const w = validArray[candidateIdx];
            if (
              w &&
              (!enforceLength || w.length === requiredLen) &&
              w !== secretWord &&
              !alreadyUsed.has(w)
            ) {
              return w;
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * Computes 0-100 alphabetical proximity percentage based on how tightly
 * [closestBefore, closestAfter] narrows the dictionary index range around secretWord.
 */
export function computeProximityPct(
  _secretWord: string,
  closestBefore: string | null,
  closestAfter: string | null,
  solved: boolean,
  lang: DictionaryLanguageCode = 'en'
): number {
  if (solved) return 100;
  if (!closestBefore && !closestAfter) return 0;

  const { validArray } = getLanguageDictionary(lang);
  const total = Math.max(2, validArray.length);
  const lo = closestBefore ? lowerBoundIndex(validArray, closestBefore) : 0;
  const hi = closestAfter ? lowerBoundIndex(validArray, closestAfter) : total - 1;
  const span = Math.max(1, hi - lo);
  const pct = (1 - Math.log(span) / Math.log(total)) * 100;
  return Math.max(2, Math.min(99, Math.round(pct)));
}

export function getDictionarySize(lang: DictionaryLanguageCode = 'en'): number {
  return getLanguageDictionary(lang).validArray.length;
}
