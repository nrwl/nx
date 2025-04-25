import { createGlobPatternsForDependencies as jsGenerateGlobs } from '@nx/js/src/utils/generate-globs';
import { relative } from 'path';

/**
 * Generates a set of glob patterns based off the source root of the app and its dependencies
 * @param dirPath workspace relative directory path that will be used to infer the parent project and dependencies
 * @param fileGlobPatternToInclude pass a custom glob pattern to be used
 * @param fileGlobPatternToExclude pass a custom glob pattern for files to be excluded
 */
export function createGlobPatternsForDependencies(
  dirPath: string,
  fileGlobPatternToInclude: string = '/**/*.{tsx,ts,jsx,js,html}',
  fileGlobPatternToExclude: string = '/**/*.{stories,spec}.{tsx,ts,jsx,js,html}'
) {
  /**
   * There is an issue with TailwindCSS v4 and how globs patterns are consumed.
   * This is a temporary workaround to support both TailwindCSS v4 and v3.
   * Once TailwindCSS v3 is no longer supported, this workaround can be removed.
   */
  const tailwindVersion = require(require.resolve('tailwindcss/package.json', {
    paths: [dirPath],
  })).version;

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
        console.warn(
          '\nWARNING: There was an error creating glob patterns, returning an empty array\n' +
            `${e.message}\n`
        );
      }
    } else {
      const {
        createGlobPatternsForDependencies: reactGlobPatternFunction,
      } = require('@nx/react/tailwind');
      return reactGlobPatternFunction(dirPath, fileGlobPatternToInclude);
    }
  }
  return [];
}
