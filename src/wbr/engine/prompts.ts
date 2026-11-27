import { getDictionaryForCategory } from '../data/dictionary';
import {
  CustomGameRules,
  PromptRule,
  PromptTier,
} from '../types/game';

export const DEFAULT_CUSTOM_RULES: CustomGameRules = {
  lobbyDurationSec: 25,
  baseWaveDurationSec: 20,
  waveDecaySec: 1.5,
  minWaveDurationSec: 10,
  maxPlayers: 100,
  allowWave1LateJoin: true,
  bannedLetters: [],
  enabledRuleGroups: {
    SUBSTRING: true,
    AFFIX: true,
    LENGTH: true,
    FORBIDDEN: true,
    VOWELS: true,
    CONSONANTS: true,
    STRUCTURE: true,
    LETTER_COMBO: true,
    RARE_LETTERS: true,
    SPECIAL: true,
  },
  globalCategory: 'ALL',
};

export const ALL_PROMPT_RULES: PromptRule[] = [
  // ===================== TIER 1 (Waves 1–2: Easy / Fast) =====================
  {
    id: 't1_contains_er',
    tier: 1,
    type: 'CONTAINS',
    categoryGroup: 'SUBSTRING',
    label: 'CONTAINS "ER"',
    sublabel: 'Any valid word with ER',
    highlightToken: 'ER',
    param: 'ER',
  },
  {
    id: 't1_contains_an',
    tier: 1,
    type: 'CONTAINS',
    categoryGroup: 'SUBSTRING',
    label: 'CONTAINS "AN"',
    sublabel: 'Any valid word with AN',
    highlightToken: 'AN',
    param: 'AN',
  },
  {
    id: 't1_contains_in',
    tier: 1,
    type: 'CONTAINS',
    categoryGroup: 'SUBSTRING',
    label: 'CONTAINS "IN"',
    sublabel: 'Any valid word with IN',
    highlightToken: 'IN',
    param: 'IN',
  },
  {
    id: 't1_contains_st',
    tier: 1,
    type: 'CONTAINS',
    categoryGroup: 'SUBSTRING',
    label: 'CONTAINS "ST"',
    sublabel: 'Any valid word with ST',
    highlightToken: 'ST',
    param: 'ST',
  },
  {
    id: 't1_contains_on',
    tier: 1,
    type: 'CONTAINS',
    categoryGroup: 'SUBSTRING',
    label: 'CONTAINS "ON"',
    sublabel: 'Any valid word with ON',
    highlightToken: 'ON',
    param: 'ON',
  },
  {
    id: 't1_contains_ar',
    tier: 1,
    type: 'CONTAINS',
    categoryGroup: 'SUBSTRING',
    label: 'CONTAINS "AR"',
    sublabel: 'Any valid word with AR',
    highlightToken: 'AR',
    param: 'AR',
  },
  {
    id: 't1_starts_b',
    tier: 1,
    type: 'STARTS_WITH',
    categoryGroup: 'AFFIX',
    label: 'STARTS WITH "B"',
    sublabel: 'First letter must be B',
    highlightToken: 'B',
    param: 'B',
  },
  {
    id: 't1_starts_s',
    tier: 1,
    type: 'STARTS_WITH',
    categoryGroup: 'AFFIX',
    label: 'STARTS WITH "S"',
    sublabel: 'First letter must be S',
    highlightToken: 'S',
    param: 'S',
  },
  {
    id: 't1_starts_t',
    tier: 1,
    type: 'STARTS_WITH',
    categoryGroup: 'AFFIX',
    label: 'STARTS WITH "T"',
    sublabel: 'First letter must be T',
    highlightToken: 'T',
    param: 'T',
  },
  {
    id: 't1_starts_m',
    tier: 1,
    type: 'STARTS_WITH',
    categoryGroup: 'AFFIX',
    label: 'STARTS WITH "M"',
    sublabel: 'First letter must be M',
    highlightToken: 'M',
    param: 'M',
  },
  {
    id: 't1_starts_p',
    tier: 1,
    type: 'STARTS_WITH',
    categoryGroup: 'AFFIX',
    label: 'STARTS WITH "P"',
    sublabel: 'First letter must be P',
    highlightToken: 'P',
    param: 'P',
  },
  {
    id: 't1_ends_ed',
    tier: 1,
    type: 'ENDS_WITH',
    categoryGroup: 'AFFIX',
    label: 'ENDS WITH "ED"',
    sublabel: 'Must end in ED',
    highlightToken: 'ED',
    param: 'ED',
  },
  {
    id: 't1_ends_ly',
    tier: 1,
    type: 'ENDS_WITH',
    categoryGroup: 'AFFIX',
    label: 'ENDS WITH "LY"',
    sublabel: 'Must end in LY',
    highlightToken: 'LY',
    param: 'LY',
  },
  {
    id: 't1_ends_er',
    tier: 1,
    type: 'ENDS_WITH',
    categoryGroup: 'AFFIX',
    label: 'ENDS WITH "ER"',
    sublabel: 'Must end in ER',
    highlightToken: 'ER',
    param: 'ER',
  },
  {
    id: 't1_exact_4',
    tier: 1,
    type: 'EXACT_LENGTH',
    categoryGroup: 'LENGTH',
    label: '4 LETTERS EXACTLY',
    sublabel: 'Exactly 4 letters long',
    highlightToken: '4',
    exactLength: 4,
  },
  {
    id: 't1_short_3_4',
    tier: 1,
    type: 'MAX_LENGTH',
    categoryGroup: 'LENGTH',
    label: 'SHORT WORD (3–4 LETTERS)',
    sublabel: 'Maximum 4 letters allowed',
    highlightToken: '3–4',
    maxLength: 4,
  },
  {
    id: 't1_starts_vowel',
    tier: 1,
    type: 'STARTS_VOWEL',
    categoryGroup: 'VOWELS',
    label: 'STARTS WITH A VOWEL',
    sublabel: 'First letter must be A, E, I, O, or U',
    highlightToken: 'AEIOU',
    minLength: 4,
  },
  {
    id: 't1_ends_vowel',
    tier: 1,
    type: 'ENDS_VOWEL',
    categoryGroup: 'VOWELS',
    label: 'ENDS WITH A VOWEL',
    sublabel: 'Last letter must be A, E, I, O, or U',
    highlightToken: 'AEIOU',
    minLength: 4,
  },
  {
    id: 't1_consecutive_vowels',
    tier: 1,
    type: 'CONSECUTIVE_VOWELS',
    categoryGroup: 'VOWELS',
    label: 'TWO VOWELS TOGETHER',
    sublabel: 'Two vowels side by side anywhere',
    highlightToken: 'VV',
  },
  {
    id: 't1_starts_two_consonants',
    tier: 1,
    type: 'STARTS_TWO_CONSONANTS',
    categoryGroup: 'CONSONANTS',
    label: 'STARTS WITH 2 CONSONANTS',
    sublabel: 'First two letters must be consonants',
    highlightToken: 'CC···',
    minLength: 4,
  },
  {
    id: 't1_second_letter_a',
    tier: 1,
    type: 'SECOND_LETTER',
    categoryGroup: 'STRUCTURE',
    label: '2ND LETTER IS "A"',
    sublabel: 'Second letter of the word must be A',
    highlightToken: '_A···',
    param: 'A',
    minLength: 4,
  },
  {
    id: 't1_second_letter_o',
    tier: 1,
    type: 'SECOND_LETTER',
    categoryGroup: 'STRUCTURE',
    label: '2ND LETTER IS "O"',
    sublabel: 'Second letter of the word must be O',
    highlightToken: '_O···',
    param: 'O',
    minLength: 4,
  },
  {
    id: 't1_contains_both_r_t',
    tier: 1,
    type: 'CONTAINS_BOTH',
    categoryGroup: 'LETTER_COMBO',
    label: 'CONTAINS BOTH "R" & "T"',
    sublabel: 'Must include both R and T anywhere',
    highlightToken: 'R + T',
    param: 'R',
    param2: 'T',
  },
  {
    id: 't1_contains_both_s_n',
    tier: 1,
    type: 'CONTAINS_BOTH',
    categoryGroup: 'LETTER_COMBO',
    label: 'CONTAINS BOTH "S" & "N"',
    sublabel: 'Must include both S and N anywhere',
    highlightToken: 'S + N',
    param: 'S',
    param2: 'N',
  },
  {
    id: 't1_contains_b_or_p',
    tier: 1,
    type: 'CONTAINS_ANY',
    categoryGroup: 'RARE_LETTERS',
    label: 'CONTAINS "B" OR "P"',
    sublabel: 'Must contain at least one B or P',
    highlightToken: 'B / P',
    param: 'B',
    param2: 'P',
  },

  // ===================== TIER 2 (Waves 3–4: Medium) =====================
  {
    id: 't2_contains_qu',
    tier: 2,
    type: 'CONTAINS',
    categoryGroup: 'SUBSTRING',
    label: 'CONTAINS "QU"',
    sublabel: 'Must contain QU anywhere',
    highlightToken: 'QU',
    param: 'QU',
  },
  {
    id: 't2_contains_ch',
    tier: 2,
    type: 'CONTAINS',
    categoryGroup: 'SUBSTRING',
    label: 'CONTAINS "CH"',
    sublabel: 'Must contain CH anywhere',
    highlightToken: 'CH',
    param: 'CH',
  },
  {
    id: 't2_contains_th',
    tier: 2,
    type: 'CONTAINS',
    categoryGroup: 'SUBSTRING',
    label: 'CONTAINS "TH"',
    sublabel: 'Must contain TH anywhere',
    highlightToken: 'TH',
    param: 'TH',
  },
  {
    id: 't2_contains_sh',
    tier: 2,
    type: 'CONTAINS',
    categoryGroup: 'SUBSTRING',
    label: 'CONTAINS "SH"',
    sublabel: 'Must contain SH anywhere',
    highlightToken: 'SH',
    param: 'SH',
  },
  {
    id: 't2_contains_ck',
    tier: 2,
    type: 'CONTAINS',
    categoryGroup: 'SUBSTRING',
    label: 'CONTAINS "CK"',
    sublabel: 'Must contain CK anywhere',
    highlightToken: 'CK',
    param: 'CK',
  },
  {
    id: 't2_6plus_starts_c',
    tier: 2,
    type: 'MIN_LENGTH_STARTS',
    categoryGroup: 'LENGTH',
    label: '6+ LETTERS · STARTS WITH "C"',
    sublabel: 'At least 6 letters starting with C',
    highlightToken: '6+ / C',
    param: 'C',
    minLength: 6,
  },
  {
    id: 't2_6plus_starts_s',
    tier: 2,
    type: 'MIN_LENGTH_STARTS',
    categoryGroup: 'LENGTH',
    label: '6+ LETTERS · STARTS WITH "S"',
    sublabel: 'At least 6 letters starting with S',
    highlightToken: '6+ / S',
    param: 'S',
    minLength: 6,
  },
  {
    id: 't2_exact_5',
    tier: 2,
    type: 'EXACT_LENGTH',
    categoryGroup: 'LENGTH',
    label: '5 LETTERS EXACTLY',
    sublabel: 'Not 4, not 6 — exactly 5 letters',
    highlightToken: '5',
    exactLength: 5,
  },
  {
    id: 't2_exact_6',
    tier: 2,
    type: 'EXACT_LENGTH',
    categoryGroup: 'LENGTH',
    label: '6 LETTERS EXACTLY',
    sublabel: 'Exactly 6 letters long',
    highlightToken: '6',
    exactLength: 6,
  },
  {
    id: 't2_min_7',
    tier: 2,
    type: 'MIN_LENGTH',
    categoryGroup: 'LENGTH',
    label: '7+ LETTERS LONG',
    sublabel: 'Must be at least 7 letters long',
    highlightToken: '7+',
    minLength: 7,
  },
  {
    id: 't2_no_e',
    tier: 2,
    type: 'NO_LETTER',
    categoryGroup: 'FORBIDDEN',
    label: 'NO LETTER "E"',
    sublabel: '5+ letters, zero E allowed',
    highlightToken: 'NO E',
    param: 'E',
    minLength: 5,
  },
  {
    id: 't2_no_a',
    tier: 2,
    type: 'NO_LETTER',
    categoryGroup: 'FORBIDDEN',
    label: 'NO LETTER "A"',
    sublabel: '5+ letters, zero A allowed',
    highlightToken: 'NO A',
    param: 'A',
    minLength: 5,
  },
  {
    id: 't2_no_s',
    tier: 2,
    type: 'NO_LETTER',
    categoryGroup: 'FORBIDDEN',
    label: 'NO LETTER "S"',
    sublabel: '5+ letters, zero S allowed',
    highlightToken: 'NO S',
    param: 'S',
    minLength: 5,
  },
  {
    id: 't2_no_o',
    tier: 2,
    type: 'NO_LETTER',
    categoryGroup: 'FORBIDDEN',
    label: 'NO LETTER "O"',
    sublabel: '5+ letters, zero O allowed',
    highlightToken: 'NO O',
    param: 'O',
    minLength: 5,
  },
  {
    id: 't2_ends_ing_7',
    tier: 2,
    type: 'ENDS_WITH_MIN_LENGTH',
    categoryGroup: 'AFFIX',
    label: 'ENDS WITH "ING" (7+ LETTERS)',
    sublabel: 'Minimum 7 letters ending in ING',
    highlightToken: 'ING · 7+',
    param: 'ING',
    minLength: 7,
  },
  {
    id: 't2_ends_le',
    tier: 2,
    type: 'ENDS_WITH',
    categoryGroup: 'AFFIX',
    label: 'ENDS WITH "LE"',
    sublabel: 'Must end in LE',
    highlightToken: 'LE',
    param: 'LE',
  },
  {
    id: 't2_starts_s_ends_e',
    tier: 2,
    type: 'STARTS_AND_ENDS',
    categoryGroup: 'AFFIX',
    label: 'STARTS "S" · ENDS "E"',
    sublabel: 'Must start with S and end with E',
    highlightToken: 'S···E',
    param: 'S',
    param2: 'E',
    minLength: 4,
  },
  {
    id: 't2_min_3_vowels',
    tier: 2,
    type: 'MIN_VOWELS',
    categoryGroup: 'VOWELS',
    label: '3+ VOWELS',
    sublabel: 'Must contain at least 3 vowels (A, E, I, O, U)',
    highlightToken: '3+ V',
    count: 3,
  },
  {
    id: 't2_exact_1_vowel',
    tier: 2,
    type: 'EXACT_VOWELS',
    categoryGroup: 'VOWELS',
    label: 'EXACTLY 1 VOWEL (4+ LETTERS)',
    sublabel: '4+ letters with only one vowel total',
    highlightToken: '1 VOWEL',
    count: 1,
    minLength: 4,
  },
  {
    id: 't2_ends_two_consonants',
    tier: 2,
    type: 'ENDS_TWO_CONSONANTS',
    categoryGroup: 'CONSONANTS',
    label: 'ENDS WITH 2 CONSONANTS',
    sublabel: 'Last two letters must be consonants',
    highlightToken: '···CC',
    minLength: 4,
  },
  {
    id: 't2_min_4_consonants',
    tier: 2,
    type: 'MIN_CONSONANTS',
    categoryGroup: 'CONSONANTS',
    label: '4+ CONSONANTS',
    sublabel: 'Must contain at least 4 consonants',
    highlightToken: '4+ C',
    count: 4,
  },
  {
    id: 't2_unique_5',
    tier: 2,
    type: 'UNIQUE_LETTERS',
    categoryGroup: 'STRUCTURE',
    label: 'ALL UNIQUE LETTERS (5+)',
    sublabel: '5+ letters with no repeated letter',
    highlightToken: 'NO DUPES',
    minLength: 5,
  },
  {
    id: 't2_second_letter_r',
    tier: 2,
    type: 'SECOND_LETTER',
    categoryGroup: 'STRUCTURE',
    label: '2ND LETTER IS "R"',
    sublabel: 'Second letter of the word must be R',
    highlightToken: '_R···',
    param: 'R',
    minLength: 4,
  },
  {
    id: 't2_contains_both_c_l',
    tier: 2,
    type: 'CONTAINS_BOTH',
    categoryGroup: 'LETTER_COMBO',
    label: 'CONTAINS BOTH "C" & "L"',
    sublabel: 'Must include both C and L anywhere',
    highlightToken: 'C + L',
    param: 'C',
    param2: 'L',
  },
  {
    id: 't2_contains_both_p_r',
    tier: 2,
    type: 'CONTAINS_BOTH',
    categoryGroup: 'LETTER_COMBO',
    label: 'CONTAINS BOTH "P" & "R"',
    sublabel: 'Must include both P and R anywhere',
    highlightToken: 'P + R',
    param: 'P',
    param2: 'R',
  },
  {
    id: 't2_contains_v_or_w',
    tier: 2,
    type: 'CONTAINS_ANY',
    categoryGroup: 'RARE_LETTERS',
    label: 'CONTAINS "V" OR "W"',
    sublabel: 'Must contain at least one V or W',
    highlightToken: 'V / W',
    param: 'V',
    param2: 'W',
  },
  {
    id: 't2_contains_j_or_k',
    tier: 2,
    type: 'CONTAINS_ANY',
    categoryGroup: 'RARE_LETTERS',
    label: 'CONTAINS "J" OR "K"',
    sublabel: 'Must contain at least one J or K',
    highlightToken: 'J / K',
    param: 'J',
    param2: 'K',
  },

  // ===================== TIER 3 (Waves 5+: Sudden Death Hardcore) =====================
  {
    id: 't3_contains_xz',
    tier: 3,
    type: 'CONTAINS_ANY',
    categoryGroup: 'RARE_LETTERS',
    label: 'CONTAINS "X" OR "Z"',
    sublabel: 'High-value rare letter required',
    highlightToken: 'X / Z',
    param: 'X',
    param2: 'Z',
  },
  {
    id: 't3_contains_jq',
    tier: 3,
    type: 'CONTAINS_ANY',
    categoryGroup: 'RARE_LETTERS',
    label: 'CONTAINS "J" OR "Q"',
    sublabel: 'Must include a J or Q anywhere',
    highlightToken: 'J / Q',
    param: 'J',
    param2: 'Q',
  },
  {
    id: 't3_contains_yk',
    tier: 3,
    type: 'CONTAINS_BOTH',
    categoryGroup: 'LETTER_COMBO',
    label: 'CONTAINS BOTH "M" & "N"',
    sublabel: 'Must include both M and N anywhere',
    highlightToken: 'M + N',
    param: 'M',
    param2: 'N',
  },
  {
    id: 't3_contains_both_b_r',
    tier: 3,
    type: 'CONTAINS_BOTH',
    categoryGroup: 'LETTER_COMBO',
    label: 'CONTAINS BOTH "B" & "R"',
    sublabel: 'Must include both B and R anywhere',
    highlightToken: 'B + R',
    param: 'B',
    param2: 'R',
  },
  {
    id: 't3_double_letters',
    tier: 3,
    type: 'DOUBLE_LETTERS',
    categoryGroup: 'SPECIAL',
    label: 'DOUBLE LETTERS',
    sublabel: 'Two identical letters side by side',
    highlightToken: 'AA / EE',
  },
  {
    id: 't3_double_consonant',
    tier: 3,
    type: 'DOUBLE_CONSONANT',
    categoryGroup: 'CONSONANTS',
    label: 'DOUBLE CONSONANT',
    sublabel: 'Two identical consonants side by side',
    highlightToken: 'TT / LL',
  },
  {
    id: 't3_consonant_cluster_3',
    tier: 3,
    type: 'CONSONANT_CLUSTER',
    categoryGroup: 'CONSONANTS',
    label: '3 CONSONANTS IN A ROW',
    sublabel: 'Three consecutive consonants anywhere',
    highlightToken: 'CCC',
    count: 3,
  },
  {
    id: 't3_same_start_end',
    tier: 3,
    type: 'SAME_START_END',
    categoryGroup: 'SPECIAL',
    label: 'STARTS & ENDS SAME LETTER',
    sublabel: 'First and last letter must match',
    highlightToken: 'A···A',
    minLength: 4,
  },
  {
    id: 't3_7plus_no_e',
    tier: 3,
    type: 'MIN_LENGTH_NO_LETTER',
    categoryGroup: 'FORBIDDEN',
    label: '7+ LETTERS · NO LETTER "E"',
    sublabel: 'Long word without a single E',
    highlightToken: '7+ · NO E',
    param: 'E',
    minLength: 7,
  },
  {
    id: 't3_no_e_or_a',
    tier: 3,
    type: 'NO_TWO_LETTERS',
    categoryGroup: 'FORBIDDEN',
    label: 'NO "E" OR "A" (4+ LETTERS)',
    sublabel: '4+ letters with zero E and zero A',
    highlightToken: 'NO E / A',
    param: 'E',
    param2: 'A',
    minLength: 4,
  },
  {
    id: 't3_contains_ph_gh',
    tier: 3,
    type: 'CONTAINS_ANY',
    categoryGroup: 'SUBSTRING',
    label: 'CONTAINS "PH" OR "GH"',
    sublabel: 'Must contain PH or GH anywhere',
    highlightToken: 'PH / GH',
    param: 'PH',
    param2: 'GH',
  },
  {
    id: 't3_contains_wh_wr',
    tier: 3,
    type: 'CONTAINS_ANY',
    categoryGroup: 'SUBSTRING',
    label: 'CONTAINS "WH" OR "WR"',
    sublabel: 'Must contain WH or WR anywhere',
    highlightToken: 'WH / WR',
    param: 'WH',
    param2: 'WR',
  },
  {
    id: 't3_min_4_vowels',
    tier: 3,
    type: 'MIN_VOWELS',
    categoryGroup: 'VOWELS',
    label: '4+ VOWELS',
    sublabel: 'Must contain at least 4 vowels',
    highlightToken: '4+ V',
    count: 4,
  },
  {
    id: 't3_unique_6',
    tier: 3,
    type: 'UNIQUE_LETTERS',
    categoryGroup: 'STRUCTURE',
    label: 'ALL UNIQUE LETTERS (6+)',
    sublabel: '6+ letters with zero repeated letters',
    highlightToken: '6+ UNIQUE',
    minLength: 6,
  },
  {
    id: 't3_exact_7',
    tier: 3,
    type: 'EXACT_LENGTH',
    categoryGroup: 'LENGTH',
    label: '7 LETTERS EXACTLY',
    sublabel: 'Exactly 7 letters long',
    highlightToken: '7',
    exactLength: 7,
  },
  {
    id: 't3_min_8',
    tier: 3,
    type: 'MIN_LENGTH',
    categoryGroup: 'LENGTH',
    label: '8+ LETTERS LONG',
    sublabel: 'Must be at least 8 letters long',
    highlightToken: '8+',
    minLength: 8,
  },
  {
    id: 't3_ends_tion',
    tier: 3,
    type: 'ENDS_WITH',
    categoryGroup: 'AFFIX',
    label: 'ENDS WITH "TION"',
    sublabel: 'Must end in TION',
    highlightToken: 'TION',
    param: 'TION',
  },
  {
    id: 't3_palindrome_or_6',
    tier: 3,
    type: 'PALINDROME_OR_MIN_LENGTH',
    categoryGroup: 'SPECIAL',
    label: 'PALINDROME OR 6+ LETTERS',
    sublabel: 'Reads same forwards & backwards, or 6+ letters',
    highlightToken: 'PALINDROME',
    minLength: 6,
  },
];

const VOWEL_SET = new Set(['A', 'E', 'I', 'O', 'U']);

function isVowel(ch: string): boolean {
  return VOWEL_SET.has(ch);
}

function isConsonant(ch: string): boolean {
  return ch >= 'A' && ch <= 'Z' && !VOWEL_SET.has(ch);
}

function countVowels(word: string): number {
  let count = 0;
  for (let i = 0; i < word.length; i++) {
    if (VOWEL_SET.has(word[i])) count++;
  }
  return count;
}

function countConsonants(word: string): number {
  let count = 0;
  for (let i = 0; i < word.length; i++) {
    if (isConsonant(word[i])) count++;
  }
  return count;
}

function hasConsecutiveConsonants(word: string, needed: number): boolean {
  let streak = 0;
  for (let i = 0; i < word.length; i++) {
    if (isConsonant(word[i])) {
      streak++;
      if (streak >= needed) return true;
    } else {
      streak = 0;
    }
  }
  return false;
}

function isPalindrome(word: string): boolean {
  if (word.length < 3) return false;
  let left = 0;
  let right = word.length - 1;
  while (left < right) {
    if (word[left] !== word[right]) return false;
    left++;
    right--;
  }
  return true;
}

/**
 * Exact validation for every prompt rule type with zero false positives/negatives.
 */
export function validatePromptRule(word: string, rule: PromptRule): boolean {
  const clean = word.trim().toUpperCase();
  if (clean.length < 3 || !/^[A-Z]+$/.test(clean)) return false;

  switch (rule.type) {
    case 'CONTAINS':
      return !!rule.param && clean.includes(rule.param);

    case 'STARTS_WITH':
      return !!rule.param && clean.startsWith(rule.param);

    case 'ENDS_WITH':
      return !!rule.param && clean.endsWith(rule.param);

    case 'EXACT_LENGTH':
      return rule.exactLength !== undefined && clean.length === rule.exactLength;

    case 'MIN_LENGTH':
      return rule.minLength !== undefined && clean.length >= rule.minLength;

    case 'MAX_LENGTH':
      return rule.maxLength !== undefined && clean.length <= rule.maxLength;

    case 'MIN_LENGTH_STARTS':
      return (
        !!rule.param &&
        rule.minLength !== undefined &&
        clean.length >= rule.minLength &&
        clean.startsWith(rule.param)
      );

    case 'NO_LETTER':
      return (
        !!rule.param &&
        clean.length >= (rule.minLength ?? 4) &&
        !clean.includes(rule.param)
      );

    case 'NO_TWO_LETTERS':
      return (
        !!rule.param &&
        !!rule.param2 &&
        clean.length >= (rule.minLength ?? 4) &&
        !clean.includes(rule.param) &&
        !clean.includes(rule.param2)
      );

    case 'ENDS_WITH_MIN_LENGTH':
      return (
        !!rule.param &&
        rule.minLength !== undefined &&
        clean.length >= rule.minLength &&
        clean.endsWith(rule.param)
      );

    case 'STARTS_AND_ENDS':
      return (
        !!rule.param &&
        !!rule.param2 &&
        clean.length >= (rule.minLength ?? 3) &&
        clean.startsWith(rule.param) &&
        clean.endsWith(rule.param2)
      );

    case 'CONTAINS_ANY': {
      const hasFirst = !!rule.param && clean.includes(rule.param);
      const hasSecond = !!rule.param2 && clean.includes(rule.param2);
      return hasFirst || hasSecond;
    }

    case 'CONTAINS_BOTH':
      return (
        !!rule.param &&
        !!rule.param2 &&
        clean.length >= (rule.minLength ?? 3) &&
        clean.includes(rule.param) &&
        clean.includes(rule.param2)
      );

    case 'DOUBLE_LETTERS':
      return /([A-Z])\1/.test(clean);

    case 'DOUBLE_CONSONANT':
      return /([BCDFGHJKLMNPQRSTVWXYZ])\1/.test(clean);

    case 'SAME_START_END':
      return (
        clean.length >= (rule.minLength ?? 4) &&
        clean[0] === clean[clean.length - 1]
      );

    case 'MIN_LENGTH_NO_LETTER':
      return (
        !!rule.param &&
        rule.minLength !== undefined &&
        clean.length >= rule.minLength &&
        !clean.includes(rule.param)
      );

    case 'PALINDROME_OR_MIN_LENGTH':
      return isPalindrome(clean) || clean.length >= (rule.minLength ?? 6);

    case 'MIN_VOWELS':
      return (
        rule.count !== undefined &&
        clean.length >= (rule.minLength ?? 3) &&
        countVowels(clean) >= rule.count
      );

    case 'EXACT_VOWELS':
      return (
        rule.count !== undefined &&
        clean.length >= (rule.minLength ?? 4) &&
        countVowels(clean) === rule.count
      );

    case 'CONSECUTIVE_VOWELS':
      return clean.length >= (rule.minLength ?? 3) && /[AEIOU]{2}/.test(clean);

    case 'STARTS_VOWEL':
      return clean.length >= (rule.minLength ?? 3) && isVowel(clean[0]);

    case 'ENDS_VOWEL':
      return clean.length >= (rule.minLength ?? 3) && isVowel(clean[clean.length - 1]);

    case 'STARTS_TWO_CONSONANTS':
      return (
        clean.length >= (rule.minLength ?? 4) &&
        isConsonant(clean[0]) &&
        isConsonant(clean[1])
      );

    case 'ENDS_TWO_CONSONANTS':
      return (
        clean.length >= (rule.minLength ?? 4) &&
        isConsonant(clean[clean.length - 2]) &&
        isConsonant(clean[clean.length - 1])
      );

    case 'CONSONANT_CLUSTER':
      return (
        rule.count !== undefined &&
        hasConsecutiveConsonants(clean, rule.count)
      );

    case 'MIN_CONSONANTS':
      return (
        rule.count !== undefined &&
        countConsonants(clean) >= rule.count
      );

    case 'UNIQUE_LETTERS':
      return (
        clean.length >= (rule.minLength ?? 5) &&
        new Set(clean.split('')).size === clean.length
      );

    case 'SECOND_LETTER':
      return (
        !!rule.param &&
        clean.length >= (rule.minLength ?? 4) &&
        clean[1] === rule.param
      );

    default:
      return false;
  }
}

export function hasBannedLetter(word: string, bannedLetters: string[]): string | null {
  if (!bannedLetters.length) return null;
  const upper = word.toUpperCase();
  for (const letter of bannedLetters) {
    if (upper.includes(letter.toUpperCase())) {
      return letter.toUpperCase();
    }
  }
  return null;
}

/**
 * Checks if a prompt rule is compatible with the streamer's custom banned letters
 * and ensures enough valid words exist in the active word category.
 */
function isRuleCompatible(rule: PromptRule, customRules: CustomGameRules): boolean {
  if (customRules.enabledRuleGroups[rule.categoryGroup] === false) return false;

  const banned = new Set(customRules.bannedLetters.map((l) => l.toUpperCase()));
  if (banned.size > 0) {
    // Reject rules that directly require a banned letter
    if (
      (rule.type === 'CONTAINS' ||
        rule.type === 'STARTS_WITH' ||
        rule.type === 'ENDS_WITH' ||
        rule.type === 'MIN_LENGTH_STARTS' ||
        rule.type === 'ENDS_WITH_MIN_LENGTH' ||
        rule.type === 'SECOND_LETTER') &&
      rule.param
    ) {
      for (const ch of rule.param) {
        if (banned.has(ch)) return false;
      }
    }
    if (
      (rule.type === 'CONTAINS_BOTH' || rule.type === 'STARTS_AND_ENDS') &&
      rule.param &&
      rule.param2
    ) {
      if (
        [...rule.param].some((ch) => banned.has(ch)) ||
        [...rule.param2].some((ch) => banned.has(ch))
      ) {
        return false;
      }
    }
    if (rule.type === 'CONTAINS_ANY' && rule.param && rule.param2) {
      const p1Blocked = [...rule.param].some((ch) => banned.has(ch));
      const p2Blocked = [...rule.param2].some((ch) => banned.has(ch));
      if (p1Blocked && p2Blocked) return false;
    }
  }

  // Verify at least 12 valid words exist in the active dictionary/category
  const matches = getMatchingWordsForRule(rule, customRules, 15);
  return matches.length >= 12;
}

export function getTierForWave(wave: number): PromptTier {
  if (wave <= 2) return 1;
  if (wave <= 4) return 2;
  return 3;
}

export function getWaveDurationSec(wave: number, rules: CustomGameRules): number {
  const raw = rules.baseWaveDurationSec - (wave - 1) * rules.waveDecaySec;
  return Math.max(rules.minWaveDurationSec, Math.round(raw * 10) / 10);
}

export function pickNextPromptRule(
  wave: number,
  customRules: CustomGameRules,
  previousRuleId?: string
): PromptRule {
  const tier = getTierForWave(wave);
  let candidates = ALL_PROMPT_RULES.filter(
    (r) => r.tier === tier && r.id !== previousRuleId && isRuleCompatible(r, customRules)
  );

  // Fallback across all tiers if strict custom rules filtered out current tier
  if (candidates.length === 0) {
    candidates = ALL_PROMPT_RULES.filter(
      (r) => r.id !== previousRuleId && isRuleCompatible(r, customRules)
    );
  }

  // Final safety fallback if user banned almost the entire alphabet
  if (candidates.length === 0) {
    candidates = ALL_PROMPT_RULES.filter((r) => r.id !== previousRuleId);
  }

  return candidates[Math.floor(Math.random() * candidates.length)] ?? ALL_PROMPT_RULES[0];
}

export function getMatchingWordsForRule(
  rule: PromptRule,
  customRules: CustomGameRules,
  limit?: number
): string[] {
  const dict = getDictionaryForCategory(customRules.globalCategory);
  const results: string[] = [];
  for (let i = 0; i < dict.length; i++) {
    const w = dict[i];
    if (validatePromptRule(w, rule) && !hasBannedLetter(w, customRules.bannedLetters)) {
      results.push(w);
      if (limit && results.length >= limit) break;
    }
  }
  return results;
}
