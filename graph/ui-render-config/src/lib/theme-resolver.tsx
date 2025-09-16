import { getEnvironmentConfig } from '@nx/graph-shared';
import { RenderTheme } from '@nx/graph';

const htmlEl = document.documentElement;
export const localStorageThemeKey = 'nx-dep-graph-theme';
export type Theme = RenderTheme | 'system';
export let currentTheme: Theme;

export let mediaListener: ((ev: MediaQueryListEvent) => void) | undefined =
  undefined;
export let vscodeDarkOberserver: MutationObserver | undefined = undefined;

// listen for (prefers-color-scheme: dark) changes
function mediaListenerFactory(
  setResolvedTheme: (resolvedTheme: RenderTheme) => void
) {
  return (ev: MediaQueryListEvent) => {
    const resolver = ev.matches ? 'dark' : 'light';
    toggleHtmlClass(resolver);
    currentTheme = resolver;
    setResolvedTheme(resolver);
  };
}

// listen for body.vscode-dark changes
function vscodeDarkOberserverFactory(
  setResolvedTheme: (resolvedTheme: RenderTheme) => void
) {
  return new MutationObserver((mutations) => {
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

        setResolvedTheme(resolver);
      }
    }
  });
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

export function themeResolver(
  theme: Theme,
  setResolvedTheme: (resolvedTheme: RenderTheme) => void
) {
  if (!('matchMedia' in window)) {
    return;
  }

  if (!mediaListener) {
    mediaListener = mediaListenerFactory(setResolvedTheme);
  }

  if (!vscodeDarkOberserver) {
    vscodeDarkOberserver = vscodeDarkOberserverFactory(setResolvedTheme);
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
  setResolvedTheme(currentTheme);

  return currentTheme;
}
