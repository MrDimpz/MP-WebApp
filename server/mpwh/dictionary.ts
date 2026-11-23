import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { RAW_TARGET_POOL } from './targetWordsEn.ts';
import { MULTILANG_WORD_PACKS } from '../../src/data/dictionaries/multilang-word-packs.ts';
import {
  normalizeDictionaryLanguage,
  stripDiacritics,
  type DictionaryLanguageCode,
} from '../../src/lib/dictionary-languages.ts';
import type { LadderMode } from '../../src/mpwh/shared/types.ts';

interface LanguageDictionary {
  validArray: string[];
  validSet: Set<string>;
  targetWords: string[];
}

const MIN_GUESS_LENGTH = 2;
const MAX_GUESS_LENGTH = 32;

function loadFullEnglishWords(): string[] {
  const candidates: string[] = [];
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      const req = createRequire(import.meta.url);
      candidates.push(req.resolve('an-array-of-english-words/index.json'));
    }
  } catch {
    // fallback below
  }
  candidates.push(
    path.resolve(process.cwd(), 'node_modules/an-array-of-english-words/index.json')
  );

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // try next path
    }
  }
  return [];
}

// Possible secret words: 500 most common 4–8 letter English words
const EN_TARGET_ARRAY = Array.from(
  new Set(
    RAW_TARGET_POOL.map((w) => w.toLowerCase().trim()).filter(
      (w) => w.length >= 4 && w.length <= 8 && /^[a-z]+$/.test(w)
    )
  )
)
  .slice(0, 500)
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

// Guess dictionary: full English dictionary (all word lengths >= 2) + target pool
const EN_VALID_SET = new Set<string>(EN_TARGET_ARRAY);
for (const raw of loadFullEnglishWords()) {
  const clean = String(raw).toLowerCase().trim();
  if (
    clean.length >= MIN_GUESS_LENGTH &&
    clean.length <= MAX_GUESS_LENGTH &&
    /^[a-z]+$/.test(clean)
  ) {
    EN_VALID_SET.add(clean);
  }
}
const EN_VALID_ARRAY = Array.from(EN_VALID_SET).sort((a, b) =>
  a < b ? -1 : a > b ? 1 : 0
);

const DICTIONARIES = new Map<DictionaryLanguageCode, LanguageDictionary>();
DICTIONARIES.set('en', {
  validArray: EN_VALID_ARRAY,
  validSet: EN_VALID_SET,
  targetWords: EN_TARGET_ARRAY,
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
  const targetSet = new Set<string>();
  const targetWords: string[] = [];

  if (pack) {
    for (const rawWord of pack.words) {
      const clean = stripDiacritics(rawWord).toLowerCase().replace(/[^a-z]/g, '');
      if (clean.length >= MIN_GUESS_LENGTH && clean.length <= MAX_GUESS_LENGTH) {
        validSet.add(clean);
        if (
          targetWords.length < 500 &&
          clean.length >= 4 &&
          clean.length <= 8 &&
          !targetSet.has(clean)
        ) {
          targetSet.add(clean);
          targetWords.push(clean);
        }
      }
    }
    for (const rawPrompt of pack.drawingPrompts) {
      // Add individual tokens from prompts as valid guesses, and single-word prompts as potential 500-pool targets
      const isSingle = !rawPrompt.includes(' ') && !rawPrompt.includes('-');
      for (const token of rawPrompt.split(/[\s-]+/)) {
        const clean = stripDiacritics(token).toLowerCase().replace(/[^a-z]/g, '');
        if (clean.length >= MIN_GUESS_LENGTH && clean.length <= MAX_GUESS_LENGTH) {
          validSet.add(clean);
          if (
            isSingle &&
            targetWords.length < 500 &&
            clean.length >= 4 &&
            clean.length <= 8 &&
            !targetSet.has(clean)
          ) {
            targetSet.add(clean);
            targetWords.push(clean);
          }
        }
      }
    }
  }

  const validArray = Array.from(validSet).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  targetWords.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const dict: LanguageDictionary = {
    validArray,
    validSet,
    targetWords,
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
  if (clean.length < MIN_GUESS_LENGTH || clean.length > MAX_GUESS_LENGTH) {
    return false;
  }
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

    // Prefer a target word of the same length first, then any common target word in the bracket
    const requiredLen = secretWord.length;
    const bracketTargets = targetWords.filter(
      (w) =>
        !alreadyUsed.has(w) &&
        w !== secretWord &&
        (side === 'before'
          ? (!closestBefore || w > closestBefore) && w < secretWord
          : w > secretWord && (!closestAfter || w < closestAfter))
    );
    const sameLengthTargets = bracketTargets.filter((w) => w.length === requiredLen);
    const targetCandidates =
      sameLengthTargets.length > 0 ? sameLengthTargets : bracketTargets;

    if (targetCandidates.length > 0) {
      const pickIndex =
        side === 'before'
          ? Math.floor(targetCandidates.length * 0.65)
          : Math.floor(targetCandidates.length * 0.35);
      return targetCandidates[
        Math.min(targetCandidates.length - 1, Math.max(0, pickIndex))
      ];
    }

    // Fallback: bisect full dictionary array in a single bounded outward scan
    const mid = Math.floor((start + end) / 2);
    const maxOffset = Math.max(mid - start, end - mid);
    const sameLenLimit = Math.min(maxOffset, 2500);
    let anyLenFallback: string | null = null;
    for (let offset = 0; offset <= maxOffset; offset++) {
      for (const candidateIdx of [mid + offset, mid - offset]) {
        if (candidateIdx >= start && candidateIdx <= end) {
          const w = validArray[candidateIdx];
          if (w && w !== secretWord && !alreadyUsed.has(w)) {
            if (w.length === requiredLen) {
              return w;
            }
            if (!anyLenFallback) {
              anyLenFallback = w;
            }
          }
        }
      }
      if (anyLenFallback && offset >= sameLenLimit) {
        return anyLenFallback;
      }
    }
    if (anyLenFallback) {
      return anyLenFallback;
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
