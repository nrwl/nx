/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
const {
  createGlobPatternsForDependencies,
} = require('@nx/js/src/utils/generate-globs');
/* eslint-enable @nx/enforce-module-boundaries */
const { join } = require('path');

function safeCreateGlobPatternsForDependencies(dir, pattern) {
  try {
    return createGlobPatternsForDependencies(dir, pattern);
  } catch {
    return [];
  }
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'
    ),
    ...safeCreateGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
