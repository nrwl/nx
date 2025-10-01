import type { RenderTheme } from '@nx/graph';
import { useEffect, useState } from 'react';

export function resolveTheme(theme: RenderTheme | 'system'): RenderTheme {
  // Astro theme switcher sets this data attr when
  // user manually changes theme or on first render
  const astroTheme = document.documentElement.dataset.theme;

  if (astroTheme === 'light' || astroTheme === 'dark') {
    return astroTheme as RenderTheme;
  }

  if (astroTheme === 'auto' || !astroTheme || theme === 'system') {
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;
    return prefersDark ? 'dark' : 'light';
  }

  return theme === 'dark' || theme === 'light' ? theme : 'light';
}

/**
 * Hook to track theme changes from both Astro theme switcher and system preference
 */
export function useThemeSync(
  fallbackTheme: RenderTheme | 'system' = 'system',
  onThemeChange?: (theme: RenderTheme) => void
): RenderTheme {
  const [currentTheme, setCurrentTheme] = useState<RenderTheme>(() => {
    if (typeof window === 'undefined') return 'light';
    return resolveTheme(fallbackTheme);
  });

  useEffect(() => {
    const updateTheme = () => {
      const newTheme = resolveTheme(fallbackTheme);
      setCurrentTheme(newTheme);
      onThemeChange?.(newTheme);
    };

    updateTheme();

    // Listen for changes to the document's theme attribute astro theme switcher sets
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-theme'
        ) {
          updateTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // Listen for system theme preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => updateTheme();

    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [fallbackTheme, onThemeChange]);

  return currentTheme;
}
