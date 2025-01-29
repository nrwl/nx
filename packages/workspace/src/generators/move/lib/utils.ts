import { normalizePath } from '@nx/devkit';

/**
 * Normalizes slashes (removes duplicates)
 *
 * @param input
 */
export function normalizePathSlashes(input: string): string {
  return (
    normalizePath(input)
      // strip leading ./ or /
      .replace(/^\.?\//, '')
      .split('/')
      .filter((x) => !!x)
      .join('/')
  );
}
