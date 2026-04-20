// @ts-check

const path = require('node:path');

module.exports = {
  experimental: {
    optimizeUniversalDefaults: true,
  },
  mode: 'jit',
  darkMode: 'class',
  content: [
    path.join(__dirname, '{pages,app}/**/*.{js,ts,jsx,tsx}'),
    '../ui-*/src/**/*.{js,ts,jsx,tsx}',
    '../feature-*/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            'code::before': { content: '' },
            'code::after': { content: '' },
            'blockquote p:first-of-type::before': { content: '' },
            'blockquote p:last-of-type::after': { content: '' },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/typography'),
  ],
};
