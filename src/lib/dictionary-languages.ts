import { useCallback, useEffect, useState } from 'react';
import {
  DICTIONARY_LANGUAGES,
  DICTIONARY_LANGUAGE_EVENT,
  DICTIONARY_LANGUAGE_STORAGE_KEY,
  LANGUAGE_CONTROLLED_GAMES,
  getDictionaryLanguageMeta,
  isValidDictionaryLanguage,
  normalizeDictionaryLanguage,
  stripDiacritics,
  type DictionaryLanguageCode,
  type DictionaryLanguageMeta,
} from './dictionary-language-core.ts';

export {
  DICTIONARY_LANGUAGES,
  DICTIONARY_LANGUAGE_EVENT,
  DICTIONARY_LANGUAGE_STORAGE_KEY,
  LANGUAGE_CONTROLLED_GAMES,
  getDictionaryLanguageMeta,
  isValidDictionaryLanguage,
  normalizeDictionaryLanguage,
  stripDiacritics,
};
export type { DictionaryLanguageCode, DictionaryLanguageMeta };

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

  if (!options?.skipCloudSync) {
    void import('../firebase')
      .then(({ auth }) => {
        if (!auth?.currentUser) return;
        return import('./cloud-progress').then(({ saveUserProfilePreferences }) =>
          saveUserProfilePreferences({ preferredLanguage: normalized })
        );
      })
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
