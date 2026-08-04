import type { Tree } from 'nx/src/devkit-exports';
import {
  createIgnoreChainResolver,
  isIgnoredByChain,
  posixDirname,
  type ScopedIgnoreMatcher,
} from 'nx/src/devkit-internals';
import { join, relative, sep } from 'path';

/** Matches a `.git` directory at any depth, as the pattern `.git` would. */
const GIT_DIR = /(^|\/)\.git(\/|$)/;

type ResolveIgnores = (dir: string) => ScopedIgnoreMatcher[];

/**
 * Utility to act on all files in a tree that are not ignored by git.
 *
 * Ignore files cascade: a `.gitignore` applies to its own directory and below,
 * so a nested one is consulted for the files under it and a nested negation
 * overrides the root. Reading them from the tree rather than disk matters
 * because a generator can create or amend one in the same run.
 */
export function visitNotIgnoredFiles(
  tree: Tree,
  dirPath: string = tree.root,
  visitor: (path: string) => void
): void {
  // Built once for the whole traversal. The recursion used to call this
  // function again per directory, which rebuilt the matcher every time.
  const resolveIgnores = createIgnoreChainResolver(
    (path) => (tree.exists(path) ? tree.read(path, 'utf-8') : null),
    ['.gitignore', '.nxignore']
  );

  visitDirectory(
    tree,
    normalizePathRelativeToRoot(dirPath, tree.root),
    visitor,
    resolveIgnores
  );
}

function visitDirectory(
  tree: Tree,
  dirPath: string,
  visitor: (path: string) => void,
  resolveIgnores: ResolveIgnores
): void {
  if (dirPath !== '' && isIgnored(dirPath, resolveIgnores)) {
    return;
  }

  for (const child of tree.children(dirPath)) {
    // Joined as POSIX rather than with `path.join`: tree paths are POSIX, and
    // on Windows a backslash-separated path silently matches nothing.
    const fullPath = dirPath ? `${dirPath}/${child}` : child;
    if (isIgnored(fullPath, resolveIgnores)) {
      continue;
    }
    if (tree.isFile(fullPath)) {
      visitor(fullPath);
    } else {
      visitDirectory(tree, fullPath, visitor, resolveIgnores);
    }
  }
}

function isIgnored(path: string, resolveIgnores: ResolveIgnores): boolean {
  // Unconditional, where it used to ride along on the root `.gitignore` being
  // present - a workspace without one had its `.git` directory walked.
  if (GIT_DIR.test(path)) {
    return true;
  }
  return isIgnoredByChain(resolveIgnores(posixDirname(path)), path);
}

function normalizePathRelativeToRoot(path: string, root: string): string {
  return relative(root, join(root, path)).split(sep).join('/');
}
