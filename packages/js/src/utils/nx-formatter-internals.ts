import {
  detectFormatterInTree,
  oxfmtConfigFiles,
  prettierConfigFiles,
} from '@nx/devkit/internal';

/**
 * `@nx/js` inherits `@nx/devkit`'s `nx` peer, which spans a major either
 * side, so an older nx without these helpers can legally be installed. A
 * missing CommonJS named export arrives as `undefined`, so the first use
 * would otherwise be a bare `undefined.every` naming neither package nor
 * cause.
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
