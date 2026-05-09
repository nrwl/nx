import { createGlobPatternsForDependencies as jsGenerateGlobs } from '@nx/js/src/utils/generate-globs';

let hasWarned = false;

/**
 * @deprecated `@nx/angular/tailwind` will be removed in Nx 24. Migrate to Tailwind CSS v4 which no longer needs glob patterns.
 * See: https://nx.dev/docs/technologies/angular/guides/using-tailwind-css-with-angular
 */
export function createGlobPatternsForDependencies(
  dirPath: string,
  fileGlobPattern: string = '/**/!(*.stories|*.spec).{ts,html}'
) {
  if (!hasWarned) {
    hasWarned = true;
    console.warn(
      `\nWARNING: "@nx/angular/tailwind" is deprecated and will be removed in Nx 24.\n` +
        `Migrate to Tailwind CSS v4 which no longer needs glob patterns for content detection.\n` +
        `See: https://nx.dev/docs/technologies/angular/guides/using-tailwind-css-with-angular\n`
    );
  }
  try {
    return jsGenerateGlobs(dirPath, fileGlobPattern);
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
