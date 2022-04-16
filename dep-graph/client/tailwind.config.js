const path = require('path');

module.exports = {
  content: [
    path.join(__dirname, 'src/**/*.{js,ts,jsx,tsx,html}'),
    // ...createGlobPatternsForDependencies(__dirname),
  ],
  darkMode: 'class', // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        blue: {
          'nx-dark': 'hsla(214, 61%, 11%, 1)',
          'nx-base': 'hsla(214, 62%, 21%, 1)',
        },
        green: {
          'nx-base': 'hsla(162, 47%, 50%, 1)',
        },
      },
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
  plugins: [require('@tailwindcss/typography')],
};
