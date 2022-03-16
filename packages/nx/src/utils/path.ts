import * as path from 'path';

function removeWindowsDriveLetter(osSpecificPath: string): string {
  return osSpecificPath.replace(/^[A-Z]:/, '');
}

/**
 * Coverts an os specific path to a unix style path
 */
export function normalizePath(osSpecificPath: string): string {
  return removeWindowsDriveLetter(osSpecificPath).split('\\').join('/');
}

/**
 * Normalized path fragments and joins them
 */
export function joinPathFragments(...fragments: string[]): string {
  return normalizePath(path.join(...fragments));
}
