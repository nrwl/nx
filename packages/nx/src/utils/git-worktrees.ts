import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const GITDIR_PREFIX = 'gitdir:';

function readRecordedPath(file: string, base: string): string | null {
  let contents: string;
  try {
    contents = readFileSync(file, 'utf-8').trim();
  } catch {
    return null;
  }

  const raw = contents.startsWith(GITDIR_PREFIX)
    ? contents.slice(GITDIR_PREFIX.length).trim()
    : contents;

  return raw ? resolve(base, raw) : null;
}

/**
 * `<git-dir>/worktrees`, where git registers every linked worktree of the
 * repository `workspaceRoot` belongs to. Null when there is no repository, or
 * when `.git` is a gitfile naming a directory that isn't there.
 */
function worktreeRegistry(workspaceRoot: string): string | null {
  const dotGit = join(workspaceRoot, '.git');

  let gitDir: string | null;
  try {
    gitDir = statSync(dotGit).isDirectory()
      ? dotGit
      : readRecordedPath(dotGit, workspaceRoot);
  } catch {
    return null;
  }
  if (!gitDir) {
    return null;
  }

  // Running from inside a linked worktree lands on
  // `<main>/.git/worktrees/<name>`, whose `commondir` names the real git dir.
  const commonDir =
    readRecordedPath(join(gitDir, 'commondir'), gitDir) ?? gitDir;
  return join(commonDir, 'worktrees');
}

/**
 * Roots of the git linked worktrees that live inside `workspaceRoot`,
 * relative to it and separator-normalized.
 *
 * Reads git's own registry rather than probing the workspace, so it costs one
 * `readdir` plus a small file per worktree. Worktrees outside the workspace
 * are dropped - nothing walks them. Submodules use the same gitfile mechanism
 * but register under `<git-dir>/modules`, so they never appear here.
 */
export function nestedWorktreeRoots(workspaceRoot: string): string[] {
  const registry = worktreeRegistry(workspaceRoot);
  if (!registry) {
    return [];
  }

  let entries: string[];
  try {
    entries = readdirSync(registry);
  } catch {
    return [];
  }

  const roots: string[] = [];
  for (const entry of entries) {
    // Points at the worktree's own `.git` gitfile, so its parent is the root.
    const gitfile = readRecordedPath(
      join(registry, entry, 'gitdir'),
      join(registry, entry)
    );
    if (!gitfile || !existsSync(gitfile)) {
      continue;
    }

    const root = relative(workspaceRoot, dirname(gitfile));
    // Outside the workspace, or the workspace itself - neither is a nested
    // worktree that Nx would walk into.
    if (
      !root ||
      root.startsWith('..') ||
      resolve(workspaceRoot, root) === resolve(workspaceRoot)
    ) {
      continue;
    }

    roots.push(root.split(sep).join('/'));
  }

  return roots;
}

/**
 * Whether `path` sits inside `root`, comparing whole path segments so that
 * `wt-other` is not read as living inside `wt`.
 */
export function isInside(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

/**
 * The path to suggest ignoring when duplicate project names come from git
 * worktrees nested in the workspace, or null when they don't.
 *
 * Prefers the directory holding the worktrees - agent tooling keeps them under
 * one (`.claude/worktrees`), and one entry beats one per worktree. Only when
 * that directory holds nothing else, though: ignoring a directory that also
 * holds real projects would drop them from the graph.
 */
export function worktreeIgnoreTarget(
  workspaceRoot: string,
  conflictingRoots: string[]
): string[] | null {
  const worktrees = nestedWorktreeRoots(workspaceRoot);
  if (!worktrees.length) {
    return null;
  }

  const offending = worktrees.filter((worktree) =>
    conflictingRoots.some((root) => isInside(root, worktree))
  );
  if (!offending.length) {
    return null;
  }

  const parent = commonParent(offending);
  return parent && holdsOnlyWorktrees(workspaceRoot, parent, worktrees)
    ? [parent]
    : offending;
}

/**
 * The directory every one of `roots` sits directly inside, or null when they
 * don't share one - including when it would be the workspace root, which is
 * never something to ignore.
 */
function commonParent(roots: string[]): string | null {
  const parents = new Set(
    roots.map((root) => root.split('/').slice(0, -1).join('/'))
  );
  const [parent] = parents;
  return parents.size === 1 && parent ? parent : null;
}

function holdsOnlyWorktrees(
  workspaceRoot: string,
  directory: string,
  worktrees: string[]
): boolean {
  let entries: string[];
  try {
    entries = readdirSync(join(workspaceRoot, directory));
  } catch {
    return false;
  }

  return (
    entries.length > 0 &&
    entries.every((entry) => worktrees.includes(`${directory}/${entry}`))
  );
}
