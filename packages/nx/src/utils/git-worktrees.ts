import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

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

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * The nearest directory at or above `from` holding a `.git`, or null when
 * there is no repository above it.
 *
 * The workspace root and the repository root are often the same directory, but
 * a workspace nested in a larger repo is ordinary - and its worktrees are
 * registered against the repository, not against the workspace.
 */
function findGitRoot(from: string): string | null {
  let current = resolve(from);

  while (!existsSync(join(current, '.git'))) {
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }

  return current;
}

/**
 * `<git-dir>/worktrees`, where git registers every linked worktree of the
 * repository `workspaceRoot` belongs to - found by walking up, since the
 * workspace need not be the repository root. Null when there is no `.git`, or
 * when it is a gitfile that names nothing. The registry itself is not checked -
 * reading it is what tells us whether anything is registered.
 */
function worktreeRegistry(workspaceRoot: string): string | null {
  const gitRoot = findGitRoot(workspaceRoot);
  if (!gitRoot) {
    return null;
  }

  const dotGit = join(gitRoot, '.git');

  let gitDir: string | null;
  try {
    gitDir = statSync(dotGit).isDirectory()
      ? dotGit
      : readRecordedPath(dotGit, gitRoot);
  } catch {
    return null;
  }
  if (!gitDir) {
    return null;
  }

  // Running from inside a linked worktree lands on
  // `<main>/.git/worktrees/<name>`, whose `commondir` names the real git dir.
  // Ignored unless it names a directory that exists. That is a sanity check
  // on a path out of a file we did not write, not a bound on where it may
  // point - it can still name any directory on the machine.
  const commonDir = readRecordedPath(join(gitDir, 'commondir'), gitDir);
  return join(
    commonDir && isDirectory(commonDir) ? commonDir : gitDir,
    'worktrees'
  );
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
    // Neither the workspace itself nor anything outside it is a nested
    // worktree Nx would walk into. Compared by whole segments, because `..` is
    // a traversal and `..hidden` is an ordinary directory name; and by
    // absoluteness, because `relative` across Windows drives returns its
    // second argument, which is outside by definition and carries no `..`.
    if (!root || isAbsolute(root) || root.split(sep)[0] === '..') {
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

/** Advice for duplicate project names that come from nested git worktrees. */
export interface WorktreeConflictAdvice {
  /** Paths to add to `.gitignore`. */
  ignoreTargets: string[];
  /**
   * Whether ignoring them settles every duplicate. When false the caller still
   * owes the reader the ordinary advice for the ones left over.
   */
  explainsAllConflicts: boolean;
}

/**
 * What to tell someone whose duplicate project names come from git worktrees
 * nested in the workspace, or null when none of them do.
 */
export function analyzeWorktreeConflicts(
  workspaceRoot: string,
  conflicts: Map<string, string[]>
): WorktreeConflictAdvice | null {
  const worktrees = nestedWorktreeRoots(workspaceRoot);
  if (!worktrees.length) {
    return null;
  }

  const offending: string[] = [];
  let explainsAllConflicts = true;

  for (const roots of conflicts.values()) {
    const fromWorktrees = worktrees.filter((worktree) =>
      roots.some((root) => isInside(root, worktree))
    );
    // What would still be defined twice once the worktrees are out of the way.
    const remaining = roots.filter(
      (root) => !worktrees.some((worktree) => isInside(root, worktree))
    );

    // Worth naming whenever a worktree is involved, even if ignoring it
    // doesn't settle the whole conflict.
    for (const worktree of fromWorktrees) {
      if (!offending.includes(worktree)) {
        offending.push(worktree);
      }
    }

    if (!fromWorktrees.length || remaining.length > 1) {
      explainsAllConflicts = false;
    }
  }

  if (!offending.length) {
    return null;
  }

  return {
    ignoreTargets: ignoreTargetsFor(workspaceRoot, offending, worktrees),
    explainsAllConflicts,
  };
}

/**
 * The worktree roots themselves, or the one directory holding them.
 *
 * Collapsing to the directory is only worth anything when it saves lines, and
 * only safe when it holds nothing else. With a single worktree it saves
 * nothing and risks everything: a lone worktree in `apps/` would have us name
 * `apps/`, which holds only that worktree today and is where the reader will
 * put projects tomorrow.
 */
function ignoreTargetsFor(
  workspaceRoot: string,
  offending: string[],
  worktrees: string[]
): string[] {
  if (offending.length < 2) {
    return offending.map(anchored);
  }

  const parent = commonParent(offending);
  return (
    parent && holdsOnlyWorktrees(workspaceRoot, parent, worktrees)
      ? [parent]
      : offending
  ).map(anchored);
}

/**
 * A gitignore pattern rooted at the workspace rather than matched anywhere.
 *
 * Without the leading slash a single-segment path like `wt1` is a name, not a
 * location - it would ignore every `wt1` at any depth. Applied to all of them
 * so the emitted line reads the same way wherever it came from.
 */
function anchored(root: string): string {
  return `/${root}`;
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
