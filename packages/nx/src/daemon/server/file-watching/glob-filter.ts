import { Minimatch } from 'minimatch';
import type { ChangedFile } from './changed-projects';

// `dot: true` lets `**` traverse and match dot-prefixed segments (e.g. a file
// inside `.config/`), which the default minimatch behavior would skip.
const GLOB_OPTIONS = { dot: true };

/**
 * Compiles raw glob pattern strings into reusable {@link Minimatch} matchers.
 *
 * Patterns are invariant for the life of a watch subscription, so compiling
 * once here (at registration) avoids re-parsing/re-compiling every pattern on
 * every file-change batch on the daemon hot path.
 */
export function compileGlobs(patterns: readonly string[]): Minimatch[] {
  return patterns.map((pattern) => new Minimatch(pattern, GLOB_OPTIONS));
}

/**
 * Returns true if the given file path passes the include/exclude glob filters.
 * Accepts precompiled matchers (see {@link compileGlobs}) so no pattern is
 * parsed here.
 *
 * Rules:
 * - If `include` is non-empty, the file must match at least one matcher.
 * - If `exclude` is non-empty, the file must NOT match any matcher.
 * - When both lists are empty every file is accepted.
 *
 * Paths are matched as they arrive from the watcher: workspace-relative.
 */
export function fileMatchesGlobFilter(
  filePath: string,
  include: readonly Minimatch[],
  exclude: readonly Minimatch[]
): boolean {
  if (include.length > 0 && !include.some((m) => m.match(filePath))) {
    return false;
  }

  if (exclude.length > 0 && exclude.some((m) => m.match(filePath))) {
    return false;
  }

  return true;
}

/**
 * Filters an array of `ChangedFile` objects, keeping only those whose `path`
 * passes the include/exclude glob filter.
 *
 * When there are no filters this is a true zero-cost identity: the original
 * array is returned by reference with no allocation.
 */
export function filterChangedFiles(
  files: ChangedFile[],
  include: readonly Minimatch[],
  exclude: readonly Minimatch[]
): ChangedFile[] {
  if (include.length === 0 && exclude.length === 0) {
    return files;
  }
  return files.filter((f) => fileMatchesGlobFilter(f.path, include, exclude));
}

/**
 * Applies the include/exclude filter to each project's changed files and drops
 * any project whose files are entirely filtered out (the "project-drop gate").
 * A project is only reported when at least one of its changed files survives
 * the filter.
 *
 * `consideredFileCount` is the number of changed files seen before filtering,
 * so callers can tell "nothing changed" apart from "everything was filtered
 * out" (useful for debugging a misconfigured pattern).
 */
export function selectChangedProjectsAndFiles(
  projectFilesByName: Record<string, ChangedFile[]>,
  include: readonly Minimatch[],
  exclude: readonly Minimatch[]
): {
  changedProjects: string[];
  changedFiles: ChangedFile[];
  consideredFileCount: number;
} {
  const changedProjects: string[] = [];
  const changedFiles: ChangedFile[] = [];
  let consideredFileCount = 0;

  for (const [projectName, projectFiles] of Object.entries(
    projectFilesByName
  )) {
    consideredFileCount += projectFiles.length;
    const filteredFiles = filterChangedFiles(projectFiles, include, exclude);
    if (filteredFiles.length > 0) {
      changedProjects.push(projectName);
      changedFiles.push(...filteredFiles);
    }
  }

  return { changedProjects, changedFiles, consideredFileCount };
}
