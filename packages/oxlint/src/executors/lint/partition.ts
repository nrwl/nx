import { isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OxlintDiagnostic } from './run-oxlint.js';

export interface TaskPaths {
  taskId: string;
  /** Workspace-relative paths or globs this task lints. */
  paths: string[];
}

/**
 * Assigns each diagnostic to the task whose lint path is the longest prefix of
 * its file, so a nested project claims its own files ahead of the project that
 * contains it. Every task gets an entry, empty when nothing was reported.
 */
export function partitionDiagnostics(
  diagnostics: OxlintDiagnostic[],
  tasks: TaskPaths[]
): Map<string, OxlintDiagnostic[]> {
  const byTask = new Map<string, OxlintDiagnostic[]>();
  const prefixes: { prefix: string; taskId: string }[] = [];
  for (const { taskId, paths } of tasks) {
    byTask.set(taskId, []);
    for (const path of paths) {
      prefixes.push({ prefix: staticPrefix(path), taskId });
    }
  }
  prefixes.sort((a, b) => b.prefix.length - a.prefix.length);

  for (const diagnostic of diagnostics) {
    const file = diagnostic.filename;
    const owner = prefixes.find(
      ({ prefix }) =>
        prefix === '' || file === prefix || file.startsWith(`${prefix}/`)
    );
    if (owner) {
      byTask.get(owner.taskId).push(diagnostic);
    }
  }
  return byTask;
}

/**
 * Oxlint reports `filename` workspace-relative, except under some terminals
 * where it becomes a `file://` URL or an absolute path
 * (https://github.com/oxc-project/oxc/issues/24916).
 */
export function normalizeFilename(
  filename: string,
  workspaceRoot: string
): string {
  let path = filename.startsWith('file://')
    ? fileURLToPath(filename)
    : filename;
  if (isAbsolute(path)) {
    path = relative(workspaceRoot, path);
  }
  path = path.split(sep).join('/');
  return path.startsWith('./') ? path.slice(2) : path;
}

/**
 * `--ignore-pattern` flags for Oxlint projects nested under a task's path whose
 * own task is not part of this run, so the parent never lints — and never
 * fails on — files that belong to another project. Nested projects that are in
 * the run keep their files: an ignore pattern applies to the whole invocation.
 *
 * Patterns are anchored (`/libs/a/nested`) — a bare single-segment pattern
 * would also match a same-named directory a task owns — and gitignore
 * metacharacters are escaped so the root is matched literally.
 */
export function nestedProjectIgnorePatterns(
  tasks: { projectRoot: string; paths: string[] }[],
  oxlintProjectRoots: string[]
): string[] {
  const inRun = new Set(tasks.map((t) => t.projectRoot));
  const excluded: string[] = [];
  for (const root of [...oxlintProjectRoots].sort()) {
    if (inRun.has(root)) {
      continue;
    }
    // Excluding a root already prunes everything under it.
    if (excluded.some((parent) => root.startsWith(`${parent}/`))) {
      continue;
    }
    if (
      tasks.some(({ paths }) =>
        paths.some((p) => root.startsWith(`${staticPrefix(p)}/`))
      )
    ) {
      excluded.push(root);
    }
  }
  return excluded.map(
    (root) => `--ignore-pattern=/${escapeIgnorePattern(root)}`
  );
}

/**
 * Escape the gitignore metacharacters in a path so `--ignore-pattern` matches
 * it literally: to Oxlint's matcher `\`, `[`, `]`, `*` and `?` are pattern
 * syntax, and a trailing space is stripped unless escaped.
 */
function escapeIgnorePattern(pattern: string): string {
  return pattern
    .replace(/([\\[\]*?])/g, '\\$1')
    .replace(/ +$/, (spaces) => spaces.replace(/ /g, '\\ '));
}

/** The directory a glob is anchored in: `libs/a/src/**\/*.ts` → `libs/a/src`. */
function staticPrefix(pattern: string): string {
  const normalized = pattern.replace(/^\.\//, '').replace(/\/$/, '');
  if (normalized === '.') {
    return '';
  }
  const globStart = normalized.search(/[*?[{]/);
  if (globStart === -1) {
    return normalized;
  }
  return normalized.slice(0, normalized.lastIndexOf('/', globStart));
}
