import { getGraphService } from './machines/graph.service';

const htmlEl = document.documentElement;
export const localStorageThemeKey = 'nx-dep-graph-theme';
export type Theme = 'light' | 'dark' | 'system';
export let currentTheme: Theme;

function mediaListener(ev: MediaQueryListEvent) {
  const resolver = ev.matches ? 'dark' : 'light';
  toggleHtmlClass(resolver);
  currentTheme = resolver;
}

function toggleHtmlClass(theme: Theme) {
  if (theme === 'dark') {
    htmlEl.classList.add('dark');
    htmlEl.classList.remove('light');
  } else {
    htmlEl.classList.add('light');
    htmlEl.classList.remove('dark');
  }
}

export function themeInit() {
  const theme =
    (localStorage.getItem(localStorageThemeKey) as Theme) ?? 'system';
  themeResolver(theme);
}

export function themeResolver(theme: Theme) {
  if (!('matchMedia' in window)) {
    return;
  }

  const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
  if (theme !== 'system') {
    darkMedia.removeEventListener('change', mediaListener);
    toggleHtmlClass(theme);
    currentTheme = theme;
  } else {
    const resolver = darkMedia.matches ? 'dark' : 'light';

    darkMedia.addEventListener('change', mediaListener);
    toggleHtmlClass(resolver);
    currentTheme = resolver;
  }

  localStorage.setItem(localStorageThemeKey, theme);

  getGraphService().theme = currentTheme;
}

export function selectValueByThemeDynamic<T>(
  darkModeSetting: T,
  lightModeSetting: T
): () => T {
  return () => selectValueByThemeStatic(darkModeSetting, lightModeSetting);
}

// The function exists because some places do not support selectDynamically
// It also prevents the dynamic change of theme for certain elements like tippy
export function selectValueByThemeStatic<T>(
  darkModeSetting: T,
  lightModeSetting: T
): T {
  return currentTheme === 'dark' ? darkModeSetting : lightModeSetting;
}
