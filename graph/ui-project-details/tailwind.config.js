// @ts-check

const path = require('node:path');

// Ignore these nx related dependencies since they are the installed versions not the ones in the workspace
// nx-ignore-next-line
const { workspaceRoot } = require('@nx/devkit');

const glob = '**/*.{js,ts,jsx,tsx,html}';

module.exports = {
  content: [
    path.join(__dirname, 'src', glob),
    path.join(__dirname, '..', 'ui-*/src', glob),
    path.join(__dirname, '..', 'shared/src', glob),
    // Resolve the classes used in @nx/graph components
    // TODO: make a decision on whether this is really the best approach, or if precompiling and deduplicating the classes would be better
    path.join(workspaceRoot, 'node_modules/@nx/graph', glob),
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
