import {
  createGitIgnoreChecker,
  createPrettierIgnoreChecker,
} from 'nx/src/devkit-internals';

/**
 * `@nx/devkit`'s `nx` peer spans a major either side, so an older nx that
 * predates the ignore checkers can legally be installed alongside it. A missing
 * CommonJS named export arrives as `undefined` rather than as a load error, so
 * the first use would otherwise be a bare `undefined is not a function` thrown
 * from inside a generator, naming neither the package nor the cause.
 */
export function assertNxSupportsIgnoreCheckers(): void {
  if (createGitIgnoreChecker && createPrettierIgnoreChecker) {
    return;
  }

  throw new Error(
    'The installed version of nx does not export the ignore checkers that @nx/devkit needs to decide which files a generator may touch. ' +
      'This happens when nx and @nx/devkit are on different major versions. Run `nx migrate latest` to bring them into line.'
  );
}
