import { minimatch } from 'minimatch';
import type { ChangedFile } from './changed-projects';

/**
 * Returns true if the given file path passes the include/exclude glob filters.
 *
 * Rules:
 * - If `include` is non-empty, the file must match at least one pattern.
 * - If `exclude` is non-empty, the file must NOT match any pattern.
 * - When both lists are empty every file is accepted.
 */
export function fileMatchesGlobFilter(
  filePath: string,
  include: readonly string[],
  exclude: readonly string[]
): boolean {
  const opts = { dot: true };

  if (
    include.length > 0 &&
    !include.some((p) => minimatch(filePath, p, opts))
  ) {
    return false;
  }

  if (exclude.length > 0 && exclude.some((p) => minimatch(filePath, p, opts))) {
    return false;
  }

  return true;
}

/**
 * Filters an array of `ChangedFile` objects, keeping only those whose `path`
 * passes the include/exclude glob filter.
 */
export function filterChangedFiles(
  files: ChangedFile[],
  include: readonly string[],
  exclude: readonly string[]
): ChangedFile[] {
  if (include.length === 0 && exclude.length === 0) {
    return files;
  }
  return files.filter((f) => fileMatchesGlobFilter(f.path, include, exclude));
}
