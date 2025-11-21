import type { RenderTheme } from '@nx/graph';
import { useEffect, useRef, useState } from 'react';

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

  // Use a ref to keep the latest callback without re-triggering the effect
  const onThemeChangeRef = useRef(onThemeChange);
  useEffect(() => {
    onThemeChangeRef.current = onThemeChange;
  }, [onThemeChange]);

  useEffect(() => {
    const updateTheme = () => {
      const newTheme = resolveTheme(fallbackTheme);
      setCurrentTheme((prevTheme) => {
        // Only update state if theme actually changed
        if (prevTheme !== newTheme) {
          onThemeChangeRef.current?.(newTheme);
          return newTheme;
        }
        return prevTheme;
      });
    };

    // Check theme on mount
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
  }, [fallbackTheme]);

  return currentTheme;
}

export const affectedNodeStyles: Stylesheet = {
  selector: 'node[?affected]',
  style: {
    color: (node: NodeSingular) => {
      const { theme } = getThemedScratch(node);
      return NODES_THEME[theme].defaultColor;
    },
    'border-color': (node) => {
      const { theme } = getThemedScratch(node);
      return NODES_THEME[theme].affectedBorderColor;
    },
    backgroundColor: (node) => {
      const { theme } = getThemedScratch(node);
      return NODES_THEME[theme].affectedBackgroundColor;
    },
  },
};

// Nx Graph doesn't expose this palette, so copied here
const NxGraphPalette = {
  blue_500: 'hsla(217, 91%, 60%, 1)',
  blue_600: 'hsla(221, 83%, 53%, 1)',
  blue_700: 'rgb(29, 78, 216)',
  sky_500: 'hsla(199, 89%, 48%, 1)',
  sky_600: 'hsla(200, 98%, 39%, 1)',
  pink_400: 'hsla(329, 86%, 70%, 1)',
  pink_500: 'hsla(330, 81%, 60%, 1)',
  fuchsia_500: 'hsla(292, 84%, 61%, 1)',
  fuchsia_700: 'hsla(295, 72%, 40%, 1)',
  fuchsia_800: 'hsla(295, 70%, 33%, 1)',
  slate_50: 'hsla(210, 40%, 98%, 1)',
  slate_200: 'hsla(214, 32%, 91%, 1)',
  slate_400: 'hsla(213, 27%, 84%, 1)',
  slate_500: 'hsla(215, 16%, 47%, 1)',
  slate_600: 'hsla(215, 19%, 35%, 1)',
  slate_700: 'hsla(215, 25%, 27%, 1)',
  slate_800: 'hsla(217, 33%, 17%, 1)',
  slate_900: 'rgb(15, 23, 42)',
  slate_950: 'rgb(2, 6, 23)',
  white: '#fff',

  // New Purples
  purple_400: 'hsla(270, 60%, 70%, 1)',
  purple_800: 'hsla(270, 40%, 30%, 1)',

  // Nx colors
  nxBlue_500: 'rgb(59,130,246)',
  nxBlue_600: 'rgb(37,99,235)',
  nxBlue_700: 'rgb(29,78,216)',
  nxBlue_800: 'rgb(22,52,161)',

  nxGreen_500: 'rgb(16,185,129)',
  nxGreen_600: 'rgb(5,150,105)',
  nxGreen_700: 'rgb(4,120,87)',

  nxYellow_500: 'rgb(234,179,8)',
  nxYellow_600: 'rgb(202,138,4)',
  nxYellow_700: 'rgb(161,98,7)',

  nxRed_500: 'rgb(239,68,68)',
  nxRed_600: 'rgb(220,38,38)',
  nxRed_700: 'rgb(185,28,28)',

  nxLightGrey_50: 'rgb(248,250,252)',
  nxLightGrey_100: 'rgb(241,245,249)',
  nxLightGrey_200: 'rgb(224,227,231)',

  // Zinc colors from Tailwind v4
  zinc_50: 'rgb(250,250,250)',
  zinc_100: 'rgb(244,244,245)',
  zinc_200: 'rgb(228,228,231)',
  zinc_300: 'rgb(212,212,216)',
  zinc_400: 'rgb(161,161,170)',
  zinc_500: 'rgb(113,113,122)',
  zinc_600: 'rgb(82,82,91)',
  zinc_700: 'rgb(63,63,70)',
  zinc_800: 'rgb(39,39,42)',
  zinc_900: 'rgb(24,24,27)',
  zinc_950: 'rgb(9,9,11)',
};

const NODES_THEME = {
  light: {
    defaultColor: NxGraphPalette.slate_700,
    projectBorderColor: NxGraphPalette.slate_400,
    affectedColor: NxGraphPalette.zinc_800,
    affectedBorderColor: NxGraphPalette.pink_500,
    affectedBackgroundColor: NxGraphPalette.pink_400,
    expandedCompositeProjectColor: NxGraphPalette.slate_700,
    expandedCompositeProjectBackgroundColor: NxGraphPalette.slate_50,
    selectedBackgroundColor: NxGraphPalette.sky_500,
    expandedCompositeTaskBackgroundOpacity: 0.8,
    expandedCompositeTaskBackgroundColor: NxGraphPalette.slate_50,
    expandedCompositeTaskBorderColor: NxGraphPalette.slate_400,
    expandedCompositeTaskColor: NxGraphPalette.slate_700,
    taskBackgroundColor: NxGraphPalette.white,
    taskBorderColor: NxGraphPalette.slate_400,
    taskColor: NxGraphPalette.slate_900,
    highlightedColor: NxGraphPalette.zinc_800,
    highlightedBackgroundColor: NxGraphPalette.sky_500,
    highlightedBorderColor: NxGraphPalette.sky_600,
    anchorBorderColor: NxGraphPalette.nxYellow_600,
    anchorBackgroundColor: NxGraphPalette.nxYellow_500,
  },
  dark: {
    defaultColor: NxGraphPalette.zinc_200,
    projectBorderColor: NxGraphPalette.slate_600,
    affectedColor: NxGraphPalette.zinc_100,
    affectedBorderColor: NxGraphPalette.fuchsia_800,
    affectedBackgroundColor: NxGraphPalette.fuchsia_700,
    expandedCompositeProjectColor: NxGraphPalette.zinc_200,
    expandedCompositeProjectBackgroundColor: NxGraphPalette.slate_800,
    selectedBackgroundColor: NxGraphPalette.sky_600,
    expandedCompositeTaskBackgroundOpacity: 0.5,
    expandedCompositeTaskBackgroundColor: NxGraphPalette.slate_800,
    expandedCompositeTaskBorderColor: NxGraphPalette.slate_600,
    expandedCompositeTaskColor: NxGraphPalette.zinc_200,
    taskBackgroundColor: NxGraphPalette.slate_800,
    taskBorderColor: NxGraphPalette.slate_600,
    taskColor: NxGraphPalette.zinc_100,
    highlightedColor: NxGraphPalette.white,
    highlightedBackgroundColor: NxGraphPalette.sky_500,
    highlightedBorderColor: NxGraphPalette.sky_600,
    anchorBorderColor: NxGraphPalette.nxYellow_500,
    anchorBackgroundColor: NxGraphPalette.nxYellow_700,
  },
};

function getThemedScratch(element: NodeSingular | EdgeSingular): {
  theme: RenderTheme;
  platform: 'nxCloud' | 'nx';
} {
  const { _nxGraphTheme = 'light', _nxGraphPlatform = 'nxCloud' } =
    element.scratch();
  return { theme: _nxGraphTheme, platform: _nxGraphPlatform };
}
