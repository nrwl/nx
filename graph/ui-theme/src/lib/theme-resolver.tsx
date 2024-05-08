import { getEnvironmentConfig } from '@nx/graph/shared';

const htmlEl = document.documentElement;
export const localStorageThemeKey = 'nx-dep-graph-theme';
export type Theme = 'light' | 'dark' | 'system';
export let currentTheme: Theme;

// listen for (prefers-color-scheme: dark) changes
function mediaListener(ev: MediaQueryListEvent) {
  const resolver = ev.matches ? 'dark' : 'light';
  toggleHtmlClass(resolver);
  currentTheme = resolver;
}

// listen for body.vscode-dark changes
const vscodeDarkOberserver = new MutationObserver((mutations) => {
  for (let mutation of mutations) {
    if (mutation.type === 'attributes') {
      const isVSCodeDark = document.body.classList.contains('vscode-dark');
      const isVSCodeLight = document.body.classList.contains('vscode-light');
      if (!isVSCodeDark && !isVSCodeLight) {
        return;
      }
      const resolver = isVSCodeDark ? 'dark' : 'light';
      toggleHtmlClass(resolver);
      currentTheme = resolver;
    }
  }
});

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

export function getSystemTheme(): 'light' | 'dark' {
  const isVSCodeDark = document.body.classList.contains('vscode-dark');
  const isVSCodeLight = document.body.classList.contains('vscode-light');
  if (isVSCodeDark || isVSCodeLight) {
    return isVSCodeDark ? 'dark' : 'light';
  }
  // we don't want to use system theme in nx-console because it might conflict with the IDE theme
  if (getEnvironmentConfig().environment === 'nx-console') {
    return 'light';
  }
  const isDarkMedia = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return isDarkMedia || isVSCodeDark ? 'dark' : 'light';
}

export function themeResolver(theme: Theme) {
  if (!('matchMedia' in window)) {
    return;
  }

  const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
  if (theme !== 'system') {
    darkMedia.removeEventListener('change', mediaListener);
    vscodeDarkOberserver.disconnect();
    toggleHtmlClass(theme);
    currentTheme = theme;
  } else {
    const resolver = getSystemTheme();
    if (getEnvironmentConfig().environment !== 'nx-console') {
      darkMedia.addEventListener('change', mediaListener);
    }
    vscodeDarkOberserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
    toggleHtmlClass(resolver);
    currentTheme = resolver;
  }

  localStorage.setItem(localStorageThemeKey, theme);
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
