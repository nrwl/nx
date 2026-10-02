import { isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OxlintDiagnostic } from './run-oxlint.js';

export interface TaskScope {
  taskId: string;
  /** Workspace-relative files or directories this task lints. */
  paths: string[];
  /** Nested project roots under `paths` whose files this task never lints. */
  excludedRoots: string[];
}

/**
 * Gives each diagnostic to every task that lints its file when run on its own,
 * so overlapping paths report in each task. A diagnostic outside every task's
 * paths goes to the `outsideOwners` tasks. Every task gets an entry, empty
 * when nothing was reported.
 */
export function partitionDiagnostics(
  diagnostics: OxlintDiagnostic[],
  tasks: TaskScope[],
  outsideOwners: string[]
): Map<string, OxlintDiagnostic[]> {
  const byTask = new Map<string, OxlintDiagnostic[]>(
    tasks.map(({ taskId }) => [taskId, []])
  );
  for (const diagnostic of diagnostics) {
    for (const task of tasks) {
      if (lintsFile(task, diagnostic.filename)) {
        byTask.get(task.taskId).push(diagnostic);
      }
    }
    if (
      !tasks.some((task) =>
        task.paths.some((path) => contains(path, diagnostic.filename))
      )
    ) {
      for (const taskId of outsideOwners) {
        byTask.get(taskId).push(diagnostic);
      }
    }
  }
  return byTask;
}

/** The nested roots a task excludes: the ones inside the paths it lints. */
export function excludedNestedRoots(
  paths: string[],
  nestedProjectRoots: string[]
): string[] {
  return nestedProjectRoots.filter((root) =>
    paths.some((path) => root !== normalizePath(path) && contains(path, root))
  );
}

function lintsFile(
  task: Pick<TaskScope, 'paths' | 'excludedRoots'>,
  file: string
): boolean {
  return (
    task.paths.some((path) => contains(path, file)) &&
    !task.excludedRoots.some((root) => contains(root, file))
  );
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
 * `--ignore-pattern` flags for the nested roots the tasks exclude, so Oxlint
 * never lints, fails on, or fixes files that belong to a project outside this
 * run. A root stays linted when it is in the run or another task lints it: an
 * ignore pattern applies to the whole invocation.
 *
 * Patterns are anchored (`/libs/a/nested`) — a bare single-segment pattern
 * would also match a same-named directory a task owns — and gitignore
 * metacharacters are escaped so the root is matched literally.
 */
export function nestedProjectIgnorePatterns(
  tasks: { projectRoot: string; paths: string[]; excludedRoots: string[] }[]
): string[] {
  const inRun = new Set(tasks.map((t) => t.projectRoot));
  const excluded: string[] = [];
  for (const root of [
    ...new Set(tasks.flatMap((t) => t.excludedRoots)),
  ].sort()) {
    if (inRun.has(root)) {
      continue;
    }
    // Excluding a root already prunes everything under it.
    if (excluded.some((parent) => root.startsWith(`${parent}/`))) {
      continue;
    }
    if (!tasks.some((task) => lintsFile(task, root))) {
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

/**
 * Whether `file` is `path` or lies under it. Oxlint takes paths literally and
 * expands no globs, so containment is the whole match.
 */
function contains(path: string, file: string): boolean {
  const dir = normalizePath(path);
  return dir === '' || file === dir || file.startsWith(`${dir}/`);
}

/** `./libs/a/` -> `libs/a`, and `.` -> the empty string for the workspace root. */
function normalizePath(path: string): string {
  const normalized = path.replace(/^\.\//, '').replace(/\/$/, '');
  return normalized === '.' ? '' : normalized;
}
