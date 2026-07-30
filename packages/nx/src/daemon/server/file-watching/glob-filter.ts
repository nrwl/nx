import { Minimatch } from 'minimatch';
import type { ChangedFile } from './changed-projects';

// `dot: true` lets `**` traverse and match dot-prefixed segments (e.g. a file
// inside `.config/`), which the default minimatch behavior would skip.
const GLOB_OPTIONS = { dot: true };

/** The CLI flag a set of patterns came from, used to build error messages. */
export type WatchGlobFlag = '--include' | '--exclude';

/**
 * Validates and normalizes a single raw watch glob.
 *
 * Two inputs are rejected outright rather than accepted and quietly matched
 * against nothing:
 *
 * - A leading `!`. Minimatch implements negation by inverting that *one*
 *   pattern's own result, and both filters combine their patterns with OR, so
 *   a negated pattern can only ever widen the set it lives in. That makes the
 *   familiar gitignore/eslint idiom mean the opposite of how it reads:
 *   `--include "**\/*.ts" "!**\/*.spec.ts"` would *keep* the spec files, and
 *   `--exclude "!**\/*.spec.ts"` would drop everything that is *not* a spec.
 *   Negation already has a first-class spelling here — the other flag.
 * - An empty (or whitespace-only) pattern, which matches nothing. It is what
 *   an unset shell variable expands to, so it is always a mistake.
 *
 * A leading `./` is stripped rather than rejected: patterns are matched
 * against workspace-root-relative paths, which never carry that prefix, but
 * `./src/**` is a natural thing to copy out of a tsconfig.
 */
export function normalizeWatchGlob(
  pattern: string,
  flag: WatchGlobFlag
): string {
  if (pattern.startsWith('!')) {
    throw new Error(
      `Invalid ${flag} pattern ${JSON.stringify(
        pattern
      )}: negated patterns are not supported. Use ${
        flag === '--include' ? '--exclude' : '--include'
      } to express the opposite set.`
    );
  }

  if (pattern.trim() === '') {
    throw new Error(
      `Invalid ${flag} pattern ${JSON.stringify(
        pattern
      )}: the pattern is empty, so it would match no files.`
    );
  }

  return pattern.startsWith('./') ? pattern.slice(2) : pattern;
}

/**
 * Validates and normalizes the patterns for one flag as they enter the system
 * from the CLI. Unlike {@link compileGlobs} this also rejects a flag that was
 * passed with no value at all (`nx watch --all --include -- ...`), which yargs
 * parses as `[]` and which would otherwise disable the filter entirely — the
 * opposite of what was asked for.
 */
export function normalizeWatchGlobs(
  patterns: string[] | undefined,
  flag: WatchGlobFlag
): string[] | undefined {
  if (patterns === undefined) {
    return undefined;
  }

  if (patterns.length === 0) {
    throw new Error(`${flag} was passed without any glob patterns.`);
  }

  return patterns.map((pattern) => normalizeWatchGlob(pattern, flag));
}

/**
 * Compiles raw glob pattern strings into reusable {@link Minimatch} matchers.
 *
 * Patterns are invariant for the life of a watch subscription, so compiling
 * once here (at registration) avoids re-parsing/re-compiling every pattern on
 * every file-change batch on the daemon hot path.
 *
 * Patterns are validated here as well as at the CLI boundary because
 * `daemonClient.registerFileWatcher` is a public API that other packages call
 * directly, so this is the only choke point every pattern passes through.
 */
export function compileGlobs(
  patterns: readonly string[],
  flag: WatchGlobFlag
): Minimatch[] {
  return patterns.map(
    (pattern) => new Minimatch(normalizeWatchGlob(pattern, flag), GLOB_OPTIONS)
  );
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
 *
 * Takes `[projectName, files]` entries rather than an object so the caller
 * owns the iteration order — a plain object hoists integer-like keys, which
 * would silently reorder a project named e.g. `2024` in `changedProjects`.
 */
export function selectChangedProjectsAndFiles(
  projectFilesByName: Iterable<[string, ChangedFile[]]>,
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

  for (const [projectName, projectFiles] of projectFilesByName) {
    consideredFileCount += projectFiles.length;
    const filteredFiles = filterChangedFiles(projectFiles, include, exclude);
    if (filteredFiles.length > 0) {
      changedProjects.push(projectName);
      changedFiles.push(...filteredFiles);
    }
  }

  return { changedProjects, changedFiles, consideredFileCount };
}
