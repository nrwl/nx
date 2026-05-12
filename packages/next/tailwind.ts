import { createGlobPatternsForDependencies as jsGenerateGlobs } from '@nx/js/src/utils/generate-globs';
import { relative } from 'path';

let hasWarned = false;

/**
 * @deprecated `@nx/next/tailwind` will be removed in Nx 24. Migrate to Tailwind CSS v4 which no longer needs glob patterns.
 * See: https://nx.dev/docs/technologies/react/guides/using-tailwind-css-in-react
 */
export function createGlobPatternsForDependencies(
  dirPath: string,
  fileGlobPatternToInclude: string = '/**/*.{tsx,ts,jsx,js,html}',
  fileGlobPatternToExclude: string = '/**/*.{stories,spec}.{tsx,ts,jsx,js,html}'
) {
  if (!hasWarned) {
    hasWarned = true;
    console.warn(
      `\nWARNING: "@nx/next/tailwind" is deprecated and will be removed in Nx 24.\n` +
        `Migrate to Tailwind CSS v4 which no longer needs glob patterns for content detection.\n` +
        `See: https://nx.dev/docs/technologies/react/guides/using-tailwind-css-in-react\n`
    );
  }

  const tailwindVersion = require(
    require.resolve('tailwindcss/package.json', {
      paths: [dirPath],
    })
  ).version;

  if (tailwindVersion && typeof tailwindVersion === 'string') {
    const majorVersion = parseInt(tailwindVersion.split('.')[0], 10);
    if (majorVersion >= 4) {
      try {
        return [
          ...jsGenerateGlobs(dirPath, fileGlobPatternToInclude).map((glob) =>
            relative(dirPath, glob)
          ),
          ...jsGenerateGlobs(dirPath, fileGlobPatternToExclude).map(
            (glob) => `!${relative(dirPath, glob)}`
          ),
        ];
      } catch (e) {
        /**
         * It should not be possible to reach this point when the utility is invoked as part of the normal
         * lifecycle of Nx executors. However, other tooling, such as the VSCode Tailwind IntelliSense plugin
         * or JetBrains editors such as WebStorm, may execute the tailwind.config.js file in order to provide
         * autocomplete features, for example.
         *
         * In order to best support that use-case, we therefore do not hard error when the ProjectGraph is
         * fundamentally unavailable in this tailwind-specific context.
         */
        console.warn(
          '\nWARNING: There was an error creating glob patterns, returning an empty array\n' +
            `${e.message}\n`
        );
        return [];
      }
    } else {
      try {
        return jsGenerateGlobs(dirPath, fileGlobPatternToInclude);
      } catch (e) {
        /**
         * It should not be possible to reach this point when the utility is invoked as part of the normal
         * lifecycle of Nx executors. However, other tooling, such as the VSCode Tailwind IntelliSense plugin
         * or JetBrains editors such as WebStorm, may execute the tailwind.config.js file in order to provide
         * autocomplete features, for example.
         *
         * In order to best support that use-case, we therefore do not hard error when the ProjectGraph is
         * fundamentally unavailable in this tailwind-specific context.
         */
        console.warn(
          '\nWARNING: There was an error creating glob patterns, returning an empty array\n' +
            `${e.message}\n`
        );
        return [];
      }
    }
  }
  return [];
}
