import type { TreeIgnoreChecker } from 'nx/src/devkit-internals';
import { createGitIgnoreChecker } from 'nx/src/devkit-internals';

/**
 * `@nx/devkit`'s `nx` peer spans a major either side, so an older nx
 * predating the ignore checkers can be installed, and a missing CommonJS
 * named export arrives as `undefined`. The two callers want opposite things
 * from that - see `NOTHING_IGNORED` for the other half.
 *
 * A tree walk cannot degrade: with no checker the walker would descend into
 * `node_modules` and hand a migration every file in it. Worse than the older
 * nx's own behaviour, so this fails instead - once, by name.
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
 * `ignorePath`, prettier's `getFileInfo` never read the workspace's ignore
 * files either (measured) - so an older nx gets the behaviour it always had.
 */
export const NOTHING_IGNORED: TreeIgnoreChecker = {
  isIgnoredFile: () => false,
  isIgnoredDirectory: () => false,
};
