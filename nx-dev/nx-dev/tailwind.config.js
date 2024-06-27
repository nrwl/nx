const path = require('path');
// Ignore @nx/next dependency since it is the installed version not the one in the workspace
// nx-ignore-next-line
const { createGlobPatternsForDependencies } = require('@nx/next/tailwind');
const plugin = require('tailwindcss/plugin');

if (!createGlobPatternsForDependencies(__dirname).length)
  throw Error('GRAPH ISSUE: No dependency found when many are expected.');

const FlipAnimation = plugin(function ({ addUtilities }) {
  addUtilities({
    '.my-rotate-y-180': {
      transform: 'rotateY(180deg)',
    },
    '.preserve-3d': {
      transformStyle: 'preserve-3d',
    },
    '.perspective': {
      perspective: '1000px',
    },
    '.backface-hidden': {
      backfaceVisibility: 'hidden',
    },
  });
});

module.exports = {
  experimental: {
    optimizeUniversalDefaults: true,
  },
  mode: 'jit',
  darkMode: 'class',
  content: [
    path.join(__dirname, '{pages,app}/**/*.{js,ts,jsx,tsx}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            'code::before': {
              content: '',
            },
            'code::after': {
              content: '',
            },
            'blockquote p:first-of-type::before': {
              content: '',
            },
            'blockquote p:last-of-type::after': {
              content: '',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    FlipAnimation,
  ],
};
