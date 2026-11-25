import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/firebase';
import { CLOUD_HYDRATED_EVENT, saveUserProfilePreferences } from '@/lib/cloud-progress';

export const SITE_DARK_MODE_KEY = 'mp_site_dark_mode_v2';
export const SITE_THEME_CHANGE_EVENT = 'mp-site-theme-change';

export function readSiteDarkMode(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = window.localStorage.getItem(SITE_DARK_MODE_KEY);
    if (saved !== null) return saved !== 'false';
  } catch {
    // Ignore storage read errors
  }
  return true;
}

export function applySiteDarkMode(nextDark: boolean, persistCloud = false): void {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  if (nextDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  try {
    window.localStorage.setItem(SITE_DARK_MODE_KEY, String(nextDark));
  } catch {
    // Ignore storage write errors
  }
  window.dispatchEvent(
    new CustomEvent<{ darkMode: boolean }>(SITE_THEME_CHANGE_EVENT, {
      detail: { darkMode: nextDark },
    }),
  );
  if (persistCloud && auth?.currentUser) {
    void saveUserProfilePreferences({ darkMode: nextDark });
  }
}

/**
 * Shared site-wide Dark / Light mode hook synced across all pages, headers, and games.
 * Keeps `document.documentElement.classList` (`dark`), localStorage, custom events,
 * cloud hydration, and external toggles (games that directly mutate `html.dark`) in sync.
 */
export function useSiteTheme() {
  const [darkMode, setDarkModeState] = useState<boolean>(() => readSiteDarkMode());

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(SITE_DARK_MODE_KEY, String(darkMode));
    } catch {
      // Ignore storage write errors
    }
  }, [darkMode]);

  useEffect(() => {
    const handleThemeEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ darkMode?: boolean }>).detail;
      if (typeof detail?.darkMode === 'boolean') {
        setDarkModeState(detail.darkMode);
      } else {
        setDarkModeState(readSiteDarkMode());
      }
    };

    const handleCloudHydrated = () => {
      setDarkModeState(readSiteDarkMode());
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === SITE_DARK_MODE_KEY) {
        setDarkModeState(e.newValue !== 'false');
      }
    };

    // Also observe direct `document.documentElement.classList` mutations from legacy games
    const observer = new MutationObserver(() => {
      const hasDark = document.documentElement.classList.contains('dark');
      setDarkModeState((prev) => (prev === hasDark ? prev : hasDark));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    window.addEventListener(SITE_THEME_CHANGE_EVENT, handleThemeEvent);
    window.addEventListener(CLOUD_HYDRATED_EVENT, handleCloudHydrated);
    window.addEventListener('storage', handleStorage);

    return () => {
      observer.disconnect();
      window.removeEventListener(SITE_THEME_CHANGE_EVENT, handleThemeEvent);
      window.removeEventListener(CLOUD_HYDRATED_EVENT, handleCloudHydrated);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setDarkMode = useCallback((next: boolean) => {
    setDarkModeState(next);
    applySiteDarkMode(next, true);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkModeState((prev) => {
      const next = !prev;
      applySiteDarkMode(next, true);
      return next;
    });
  }, []);

  return {
    darkMode,
    isDark: darkMode,
    isLight: !darkMode,
    setDarkMode,
    toggleDarkMode,
  };
}
