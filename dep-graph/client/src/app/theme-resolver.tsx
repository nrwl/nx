import { getGraphService } from './machines/graph.service';

const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
const htmlEl = document.documentElement;

export let currentTheme: string;

function mediaListner(ev: MediaQueryListEvent) {
  const resolver = ev.matches ? 'dark' : 'light';
  htmlEl.className = resolver;
  currentTheme = resolver;
  console.log('Theme: ', currentTheme);
}

export function themeInit() {
  const theme = localStorage.theme ?? 'system';
  themeResolver(theme);
}

export function themeResolver(theme: string) {
  if (theme !== 'system') {
    darkMedia.removeEventListener('change', mediaListner);
    htmlEl.className = theme;
    currentTheme = theme;
  } else {
    const resolver = darkMedia.matches ? 'dark' : 'light';

    darkMedia.addEventListener('change', mediaListner);
    htmlEl.className = resolver;
    currentTheme = resolver;
  }

  localStorage.theme = theme;
  getGraphService().evaluateStyles();
}

export function selectDynamically<T>(
  dakrModeSetting: T,
  lightModeSetting: T
): () => T {
  return () => (currentTheme === 'dark' ? dakrModeSetting : lightModeSetting);
}

// The function exists because some places do not support selectDynamically
// It also prevents the dynamic change of theme for certain elements like tippy
export function selectStatically<T>(
  darkModeSetting: T,
  lightModeSetting: T
): T {
  return currentTheme === 'dark' ? darkModeSetting : lightModeSetting;
}
