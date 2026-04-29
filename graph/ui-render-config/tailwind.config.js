const path = require('path');

const glob = '**/!(*.stories|*.spec).{js,ts,jsx,tsx,html}';

module.exports = {
  content: [
    path.join(__dirname, 'src', glob),
    path.join(__dirname, '..', 'ui-*/src', glob),
    path.join(__dirname, '..', 'shared/src', glob),
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
