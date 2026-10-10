export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'zhon-theme';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  } catch {
    // LocalStorage access may fail in restricted sandboxes
  }
  return 'dark';
}

export function setStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
  } catch {
    // Ignore storage errors in private/sandboxed mode
  }
}
