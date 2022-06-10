const path = require('path');
const { createGlobPatternsForDependencies } = require('@nrwl/next/tailwind');

module.exports = {
  mode: 'jit',
  content: [
    path.join(__dirname, 'pages/**/*.{js,ts,jsx,tsx},../docs/**/*.md'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      colors: {
        black: 'hsla(0, 0%, 13%, 1)',
        blue: {
          'nx-dark': 'hsla(214, 61%, 11%, 1)',
          'nx-base': 'hsla(214, 62%, 21%, 1)',
        },
        green: {
          'nx-base': 'hsla(162, 47%, 50%, 1)',
        },
        purple: {
          'nx-base': 'hsla(258, 76%, 62%, 1)',
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
  plugins: [
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
};
