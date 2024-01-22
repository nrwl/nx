import { createGlobPatternsForDependencies as jsGenerateGlobs } from '@nx/js/src/utils/generate-globs';

/**
 * Generates a set of glob patterns based off the source root of the app and its dependencies
 * @param dirPath workspace relative directory path that will be used to infer the parent project and dependencies
 * @param fileGlobPattern pass a custom glob pattern to be used
 */
export function createGlobPatternsForDependencies(
  dirPath: string,
  fileGlobPattern: string = '/**/!(*.stories|*.spec).{ts,html}'
) {
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
     * fundamently unavailable in this tailwind-specific context.
     */
    console.warn(
      '\nWARNING: There was an error creating glob patterns, returning an empty array\n' +
        `${e.message}\n`
    );
    return [];
  }
}
