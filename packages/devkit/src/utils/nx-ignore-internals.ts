import type { TreeIgnoreChecker } from 'nx/src/devkit-internals';
import { createGitIgnoreChecker } from 'nx/src/devkit-internals';

/**
 * `@nx/devkit`'s `nx` peer spans a major either side, so an older nx that
 * predates the ignore checkers can legally be installed alongside it, and a
 * missing CommonJS named export arrives as `undefined` rather than as a load
 * error. The two callers want opposite things from that, so they get different
 * helpers - see `NOTHING_IGNORED` for the other half.
 *
 * A tree walk cannot degrade: without a checker nothing would be ignored, and
 * the walker would descend into `node_modules` and hand a migration every file
 * in it to rewrite. That is worse than the older nx's own behaviour, which at
 * least read the root `.gitignore`, so this fails instead - once, by name.
 */
export function assertNxSupportsIgnoreCheckers(): void {
  if (createGitIgnoreChecker) {
    return;
  }

  throw new Error(
    'The installed version of nx does not export the ignore checkers that @nx/devkit needs to decide which files a generator may touch. ' +
      'This happens when nx and @nx/devkit are on different major versions. Run `nx migrate latest` to bring them into line.'
  );
}

/**
 * The degrade the other way, for formatting.
 *
 * Filtering nothing is what devkit did before the checkers existed - with no
 * `ignorePath`, prettier's own `getFileInfo` never read the workspace's ignore
 * files either (measured) - so an older nx gets the formatting behaviour it has
 * always had rather than a generator that refuses to run.
 */
export const NOTHING_IGNORED: TreeIgnoreChecker = {
  isIgnoredFile: () => false,
  isIgnoredDirectory: () => false,
};
