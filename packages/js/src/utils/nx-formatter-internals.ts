import {
  detectFormatterInTree,
  oxfmtConfigFiles,
  prettierConfigFiles,
} from '@nx/devkit/internal';

/**
 * `@nx/js` has no `nx` peer of its own - it inherits `@nx/devkit`'s, which spans
 * a major either side - so an older nx can legally be installed alongside it.
 * The formatter helpers do not exist there, and a missing CommonJS named export
 * arrives as `undefined` rather than as a load error, so the first use would
 * otherwise be a bare `undefined.every` naming neither the package nor the cause.
 */
export function assertNxSupportsFormatters(): void {
  if (detectFormatterInTree && oxfmtConfigFiles && prettierConfigFiles) {
    return;
  }

  throw new Error(
    'The installed version of nx does not export the formatter helpers that @nx/js needs to detect and set up a formatter. ' +
      'This happens when nx and @nx/js are on different major versions. Run `nx migrate latest` to bring them into line.'
  );
}
