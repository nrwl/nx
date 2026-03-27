const path = require('path');

// nx-ignore-next-line
const {
  createGlobPatternsForDependencies,
} = require('@nx/js/src/utils/generate-globs');

function safeCreateGlobPatternsForDependencies(dir, pattern) {
  try {
    return createGlobPatternsForDependencies(dir, pattern);
  } catch {
    return [];
  }
}

module.exports = {
  content: [
    path.join(__dirname, 'src/**/*.{js,ts,jsx,tsx,html}'),
    ...safeCreateGlobPatternsForDependencies(__dirname),
  ],
  darkMode: 'class', // or 'media' or 'class'
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
  variants: {
    extend: {
      translate: ['group-hover'],
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),
  ],
};
