import type { RenderTheme } from '@nx/graph';

export function resolveTheme(theme: RenderTheme | 'system'): RenderTheme {
  if (theme !== 'system') {
    return theme;
  }

  const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
  return darkMedia.matches ? 'dark' : 'light';
}
