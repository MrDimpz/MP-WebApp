import { useCallback, useEffect, useState } from 'react';
import { auth } from '../firebase';

export type DictionaryLanguageCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'tl';

export interface DictionaryLanguageMeta {
  code: DictionaryLanguageCode;
  shortCode: string;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const DICTIONARY_LANGUAGES: readonly DictionaryLanguageMeta[] = [
  { code: 'en', shortCode: 'EN', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'es', shortCode: 'ES', label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' },
  { code: 'fr', shortCode: 'FR', label: 'French', nativeLabel: 'Français', flag: '🇫🇷' },
  { code: 'de', shortCode: 'DE', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', shortCode: 'IT', label: 'Italian', nativeLabel: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', shortCode: 'PT', label: 'Portuguese', nativeLabel: 'Português', flag: '🇵🇹' },
  { code: 'tl', shortCode: 'TL', label: 'Filipino / Tagalog', nativeLabel: 'Filipino / Tagalog', flag: '🇵🇭' },
] as const;

export const LANGUAGE_CONTROLLED_GAMES = [
  'InkStream',
  'Crowdle',
  'Lexi Tiles',
  'Word Hunt Extreme',
  'Squared',
  'Squared Interactive',
  'DeStack',
  'DeStack Interactive',
  'MP Search',
  'MP Search Interactive',
  'Unolingo',
] as const;

export const DICTIONARY_LANGUAGE_STORAGE_KEY = 'mp_dictionary_language_v1';
export const DICTIONARY_LANGUAGE_EVENT = 'mp-dictionary-language-changed';

const VALID_CODES = new Set<string>(DICTIONARY_LANGUAGES.map((l) => l.code));

export function isValidDictionaryLanguage(value: unknown): value is DictionaryLanguageCode {
  return typeof value === 'string' && VALID_CODES.has(value.toLowerCase());
}

export function normalizeDictionaryLanguage(value: unknown): DictionaryLanguageCode {
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'fil' || lower === 'filipino' || lower === 'tagalog') {
      return 'tl';
    }
    if (VALID_CODES.has(lower)) {
      return lower as DictionaryLanguageCode;
    }
  }
  return 'en';
}

export function getDictionaryLanguageMeta(
  code?: DictionaryLanguageCode | string | null
): DictionaryLanguageMeta {
  const normalized = normalizeDictionaryLanguage(code);
  return (
    DICTIONARY_LANGUAGES.find((entry) => entry.code === normalized) || DICTIONARY_LANGUAGES[0]
  );
}

/**
 * Strips diacritics and maps common European ligatures (ß -> ss, œ -> oe, æ -> ae)
 * so chat guesses, keyboards, and A–Z letter boards match seamlessly without accents.
 */
export function stripDiacritics(input: string): string {
  if (!input) return '';
  return input
    .replace(/ß/g, 'ss')
    .replace(/ẞ/g, 'SS')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

let memoryLanguage: DictionaryLanguageCode = 'en';

export function getDictionaryLanguage(): DictionaryLanguageCode {
  if (typeof window === 'undefined') {
    return memoryLanguage;
  }
  try {
    const stored = window.localStorage.getItem(DICTIONARY_LANGUAGE_STORAGE_KEY);
    if (stored && isValidDictionaryLanguage(stored)) {
      memoryLanguage = stored;
      return stored;
    }
  } catch {
    // Ignore storage access restrictions
  }
  return memoryLanguage;
}

export function setDictionaryLanguage(
  nextLang: DictionaryLanguageCode,
  options?: { skipCloudSync?: boolean }
): void {
  const normalized = normalizeDictionaryLanguage(nextLang);
  const changed = memoryLanguage !== normalized;
  memoryLanguage = normalized;

  if (typeof window === 'undefined') return;

  try {
    const prev = window.localStorage.getItem(DICTIONARY_LANGUAGE_STORAGE_KEY);
    window.localStorage.setItem(DICTIONARY_LANGUAGE_STORAGE_KEY, normalized);
    if (changed || prev !== normalized) {
      window.dispatchEvent(
        new CustomEvent<DictionaryLanguageCode>(DICTIONARY_LANGUAGE_EVENT, {
          detail: normalized,
        })
      );
    }
  } catch {
    if (changed) {
      window.dispatchEvent(
        new CustomEvent<DictionaryLanguageCode>(DICTIONARY_LANGUAGE_EVENT, {
          detail: normalized,
        })
      );
    }
  }

  if (!options?.skipCloudSync && auth?.currentUser) {
    void import('./cloud-progress')
      .then(({ saveUserProfilePreferences }) =>
        saveUserProfilePreferences({ preferredLanguage: normalized })
      )
      .catch(() => {});
  }
}

export function subscribeDictionaryLanguage(
  listener: (lang: DictionaryLanguageCode) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const onCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent<DictionaryLanguageCode>).detail;
    listener(normalizeDictionaryLanguage(detail ?? getDictionaryLanguage()));
  };

  const onStorageEvent = (event: StorageEvent) => {
    if (event.key === DICTIONARY_LANGUAGE_STORAGE_KEY) {
      listener(normalizeDictionaryLanguage(event.newValue));
    }
  };

  window.addEventListener(DICTIONARY_LANGUAGE_EVENT, onCustomEvent);
  window.addEventListener('storage', onStorageEvent);

  return () => {
    window.removeEventListener(DICTIONARY_LANGUAGE_EVENT, onCustomEvent);
    window.removeEventListener('storage', onStorageEvent);
  };
}

export function useDictionaryLanguage(): [
  DictionaryLanguageCode,
  (lang: DictionaryLanguageCode) => void,
] {
  const [language, setLanguageState] = useState<DictionaryLanguageCode>(() =>
    getDictionaryLanguage()
  );

  useEffect(() => {
    setLanguageState(getDictionaryLanguage());
    return subscribeDictionaryLanguage((next) => {
      setLanguageState(next);
    });
  }, []);

  const updateLanguage = useCallback((next: DictionaryLanguageCode) => {
    setDictionaryLanguage(next);
  }, []);

  return [language, updateLanguage];
}
