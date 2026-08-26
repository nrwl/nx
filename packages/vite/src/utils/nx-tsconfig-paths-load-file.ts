import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigLoaderSuccessResult } from 'tsconfig-paths';
import { findFile } from './nx-tsconfig-paths-find-file';

/**
 * Fallback resolver used when `tsconfig-paths` produces nothing that exists on
 * disk, whether because no alias matched or because the match pointed at a
 * missing file.
 *
 * A wildcard alias captures the suffix of the import and substitutes it into
 * the `*` of each mapped path. The `*` is not always trailing, so the suffix
 * cannot simply be appended.
 */
export function loadFileFromPaths(
  tsconfig: ConfigLoaderSuccessResult,
  importPath: string,
  extensions: string[],
  existsSyncImpl: typeof existsSync = existsSync
): string {
  let resolvedFile: string;
  for (const alias of sortAliasesBySpecificity(
    Object.keys(tsconfig.paths),
    importPath
  )) {
    const paths = tsconfig.paths[alias];

    const isWildcard = alias.endsWith('/*');
    const normalizedImport = alias.replace(/\/\*$/, '');

    if (
      importPath === normalizedImport ||
      importPath.startsWith(normalizedImport + '/')
    ) {
      const suffix = importPath.slice(normalizedImport.length + 1);

      for (const path of paths) {
        // The replacements go through a function because a string replacement
        // would expand `$&` and friends as substitution patterns.
        const joinedPath = join(
          tsconfig.absoluteBaseUrl,
          isWildcard
            ? path.replace('*', () => suffix)
            : path.replace(/\/\*$/, '')
        );
        const candidate = isWildcard
          ? joinedPath
          : importPath.replace(normalizedImport, () => joinedPath);

        resolvedFile = findFile(candidate, extensions, existsSyncImpl);

        // The candidate ends with the import's own tail only when the wildcard
        // is last. Anything the mapped path appends after the `*`
        // (`packages/foo/*.ts`) is the tail instead, so dropping an extension
        // from it would resolve a sibling the mapping never pointed at.
        const endsWithImportTail = !isWildcard || path.endsWith('*');

        if (resolvedFile === undefined && endsWithImportTail) {
          const foundExtension = extensions.find((ext) =>
            importPath.endsWith(ext)
          );
          if (foundExtension) {
            resolvedFile = findFile(
              candidate.slice(0, -foundExtension.length),
              extensions,
              existsSyncImpl
            );
          }
        }

        if (resolvedFile !== undefined) {
          return resolvedFile;
        }
      }
    }
  }

  return resolvedFile;
}

/**
 * TypeScript picks between competing aliases by specificity, never by
 * declaration order: an exact hit on a non-wildcard alias first, then the
 * longest wildcard prefix.
 */
function sortAliasesBySpecificity(
  aliases: string[],
  importPath: string
): string[] {
  const isWildcard = (alias: string) => alias.endsWith('/*');
  const rank = (alias: string) =>
    isWildcard(alias) ? 1 : importPath === alias ? 2 : 0;
  const prefixLength = (alias: string) => alias.replace(/\/\*$/, '').length;

  return [...aliases].sort((a, b) => {
    const byRank = rank(b) - rank(a);
    if (byRank !== 0) return byRank;

    // Prefix length only separates wildcards. Reordering two aliases
    // TypeScript matches neither way would change resolution for no gain.
    return isWildcard(a) ? prefixLength(b) - prefixLength(a) : 0;
  });
}
