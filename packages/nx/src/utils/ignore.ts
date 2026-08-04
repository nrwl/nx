import ignore = require('ignore');
import { readFileIfExisting } from './fileutils';
import { workspaceRoot } from './workspace-root';
import { Tree } from '../generators/tree';

export function getIgnoreObject(
  root: string = workspaceRoot
): ReturnType<typeof ignore> {
  const ig = ignore();
  ig.add(readFileIfExisting(`${root}/.gitignore`));
  ig.add(readFileIfExisting(`${root}/.nxignore`));
  return ig;
}

/** An ignore matcher paired with the directory its patterns are rooted at. */
export type ScopedIgnoreMatcher = {
  /** Workspace-relative POSIX directory, `''` for the workspace root. */
  dir: string;
  matcher: ReturnType<typeof ignore>;
};

/**
 * Resolves the ignore files that apply to a directory: its own and every one
 * above it, up to the workspace root.
 *
 * Ignore files cascade - a `.gitignore` covers its own directory and below, and
 * its patterns are relative to *itself*, not to the workspace root. Reading only
 * the root file, which is what `getIgnoreObject` and `getIgnoreObjectForTree`
 * do, silently misses every nested one.
 *
 * A directory's answer is its own files plus its parent's, so every directory on
 * the way up is memoized rather than only the one asked for: sibling leaves
 * share the whole trunk, and a later walk stops at the first directory already
 * known.
 *
 * `read` decides where the files come from - `tree.read` for a generator, disk
 * for a caller with no tree - and returns an empty string or null when there is
 * no such file. Paths handed to it are workspace-relative POSIX.
 */
export function createIgnoreChainResolver(
  read: (path: string) => string | null | undefined,
  filenames: string[]
): (dir: string) => ScopedIgnoreMatcher[] {
  const cache = new Map<string, ScopedIgnoreMatcher[]>();

  const resolve = (dir: string): ScopedIgnoreMatcher[] => {
    const cached = cache.get(dir);
    if (cached) {
      return cached;
    }

    const contents = filenames
      .map((name) => read(dir ? `${dir}/${name}` : name))
      .filter((c) => !!c && c.length > 0);

    const inherited = dir === '' ? [] : resolve(parentDir(dir));
    let chain = inherited;
    if (contents.length > 0) {
      const matcher = ignore();
      for (const c of contents) {
        matcher.add(c);
      }
      chain = [{ dir, matcher }, ...inherited];
    }

    cache.set(dir, chain);
    return chain;
  };

  return resolve;
}

/**
 * True when any matcher in the chain covers the file. Each is tested against the
 * path relative to its own directory, which is what makes a nested pattern like
 * `build` mean that directory's `build` rather than the workspace's.
 *
 * `filePath` is workspace-relative POSIX and must sit under every `dir` in the
 * chain - which holds when the chain came from that file's own directory.
 */
export function isIgnoredByChain(
  chain: ScopedIgnoreMatcher[],
  filePath: string
): boolean {
  for (const { dir, matcher } of chain) {
    const relative = dir === '' ? filePath : filePath.slice(dir.length + 1);
    if (relative && matcher.ignores(relative)) {
      return true;
    }
  }
  return false;
}

function parentDir(dir: string): string {
  const separator = dir.lastIndexOf('/');
  return separator === -1 ? '' : dir.slice(0, separator);
}

export function getIgnoreObjectForTree(tree: Tree) {
  let ig: ReturnType<typeof ignore>;
  if (tree.exists('.gitignore')) {
    ig = ignore();
    ig.add('.git');
    ig.add(tree.read('.gitignore', 'utf-8'));
  }
  if (tree.exists('.nxignore')) {
    ig ??= ignore();
    ig.add(tree.read('.nxignore', 'utf-8'));
  }

  return ig;
}

/**
 * Adds an entry to a .gitignore file if it's not already covered by existing patterns.
 * Creates the file if it doesn't exist.
 */
export function addEntryToGitIgnore(
  tree: Tree,
  gitignorePath: string,
  entry: string
) {
  const gitignore = tree.exists(gitignorePath)
    ? tree.read(gitignorePath, 'utf-8')
    : '';
  const ig = ignore();
  ig.add(gitignore);
  if (!ig.ignores(entry)) {
    const updatedLines = gitignore.length ? [gitignore, entry] : [entry];
    tree.write(gitignorePath, updatedLines.join('\n'));
  }
}
