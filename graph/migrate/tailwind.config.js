const { join } = require('path');

const glob = '**/*!(*.stories|*.spec).{ts,tsx,html}';

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, '{src,pages,components,app}', glob),
    join(__dirname, '..', 'ui-*/src', glob),
    join(__dirname, '..', 'shared/src', glob),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
