/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
/* eslint-enable @nx/enforce-module-boundaries */
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'
    ),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
