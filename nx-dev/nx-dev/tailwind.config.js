const path = require('path');
// Ignore @nx/next dependency since it is the installed version not the one in the workspace
// nx-ignore-next-line
const { createGlobPatternsForDependencies } = require('@nx/next/tailwind');

if (!createGlobPatternsForDependencies(__dirname).length)
  throw Error('GRAPH ISSUE: No dependency found when many are expected.');

module.exports = {
  experimental: {
    optimizeUniversalDefaults: true,
  },
  mode: 'jit',
  darkMode: 'class',
  content: [
    path.join(__dirname, 'pages/**/*.{js,ts,jsx,tsx}'),
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
    require('@tailwindcss/line-clamp'),
  ],
};
