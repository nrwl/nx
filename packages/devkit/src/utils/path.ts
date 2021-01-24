import * as path from 'path';

function removeWindowsDriveLetter(osSpecificPath: string): string {
  return osSpecificPath.replace(/^[A-Z]:/, '');
}

/**
 * Coverts an os specific path to a unix style path
 */
export function normalizePath(osSpecificPath: string): string {
  return removeWindowsDriveLetter(osSpecificPath).split(path.sep).join('/');
}

/**
 * Normalized path fragments and joins them
 */
export function joinPathFragments(...fragments: string[]): string {
  const normalizedFragments = [];
  for (let i = 0; i < fragments.length; ++i) {
    if (i === 0) {
      normalizedFragments.push(normalizePath(fragments[i]));
    } else {
      const n = normalizePath(fragments[i]);
      normalizedFragments.push(n.startsWith('/') ? n.substring(1) : n);
    }
  }
  return normalizedFragments.join('/');
}
