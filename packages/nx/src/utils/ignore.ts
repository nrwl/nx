import ignore = require('ignore');
import { getHardcodedIgnorePatterns } from '../native/index';
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
 * True when the file is ignored, resolving the chain nearest file first.
 *
 * Each matcher is tested against the path relative to its own directory, which
 * is what makes a nested pattern like `/build` mean that directory's `build`
 * rather than the workspace's.
 *
 * The first file with an *opinion* decides, rather than the first file that
 * ignores: git overrides higher-level patterns with lower-level ones, so a
 * nested `!keep.log` re-includes a file the root's `*.log` excluded. Stopping at
 * the first match instead would let the root win and silently drop the
 * negation. A file that matches nothing in a directory carries no opinion, so
 * the search continues upwards.
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
    if (!relative) {
      continue;
    }
    const result = matcher.test(relative);
    if (result.ignored) {
      return true;
    }
    if (result.unignored) {
      return false;
    }
  }
  return false;
}

let alwaysIgnored: ReturnType<typeof ignore> | undefined;

/**
 * Directories that should never be walked, whatever the workspace's own ignore
 * files say - `node_modules`, `.git`, the nx caches.
 *
 * The list comes from the native walker rather than a second copy here, so a
 * filesystem walk and a tree walk cannot drift apart.
 *
 * Checked ahead of the cascading chain rather than folded into it: these are not
 * re-includable, and as ordinary patterns a nested negation could resurrect
 * `node_modules`.
 */
export function isAlwaysIgnored(path: string): boolean {
  alwaysIgnored ??= ignore().add(getHardcodedIgnorePatterns());
  return alwaysIgnored.ignores(path);
}

/**
 * The cascading chain bound to a tree, as a predicate over workspace-relative
 * POSIX paths.
 *
 * Reads from the tree rather than disk because a generator can create or amend
 * an ignore file in the same run, which would leave the on-disk copy stale.
 *
 * `filenames` differs by caller: git-facing walks want `.nxignore`, while a
 * formatter wants `.prettierignore` - both prettier and oxfmt honour it, and
 * `.gitignore`, in their CLIs.
 */
export function createTreeIgnoreChecker(
  tree: Tree,
  filenames: string[]
): (path: string) => boolean {
  const resolve = createIgnoreChainResolver(
    (path) => (tree.exists(path) ? tree.read(path, 'utf-8') : null),
    filenames
  );

  return (path) =>
    isAlwaysIgnored(path) ||
    isIgnoredByChain(resolve(posixDirname(path)), path);
}

/** `path.dirname` for the workspace-relative POSIX paths the chain is keyed by. */
export function posixDirname(relativePath: string): string {
  const separator = relativePath.lastIndexOf('/');
  return separator === -1 ? '' : relativePath.slice(0, separator);
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
