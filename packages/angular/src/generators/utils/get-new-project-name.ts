import { normalizePath } from '@nx/devkit';

/**
 * Joins path segments replacing slashes with dashes
 *
 * @param path
 */
export function getNewProjectName(path: string): string {
  // strip leading '/' or './' or '../' and trailing '/' and replaces '/' with '-'
  return normalizePath(path)
    .replace(/(^\.{0,2}\/|\.{1,2}\/|\/$)/g, '')
    .split('/')
    .filter((x) => !!x)
    .join('-');
}
