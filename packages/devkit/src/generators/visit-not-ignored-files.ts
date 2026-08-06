import type { Tree } from 'nx/src/devkit-exports';
import {
  createGitIgnoreChecker,
  type TreeIgnoreChecker,
} from 'nx/src/devkit-internals';
import { join, relative, sep } from 'path';
import { assertNxSupportsIgnoreCheckers } from '../utils/nx-ignore-internals';

/**
 * Utility to act on all files in a tree that are not ignored by git.
 *
 * Ignore files cascade, so a nested `.gitignore` covers the files under it and a
 * nested negation overrides the root. They are read from the tree, not disk, so
 * one a generator wrote in the same run counts.
 *
 * `node_modules`, `.git` and the nx and yarn caches are never visited, whatever
 * the workspace's ignore files say.
 */
export function visitNotIgnoredFiles(
  tree: Tree,
  dirPath: string = tree.root,
  visitor: (path: string) => void
): void {
  assertNxSupportsIgnoreCheckers();

  // Built once for the whole traversal.
  const isIgnored = createGitIgnoreChecker(tree);
  const start = normalizePathRelativeToRoot(dirPath, tree.root);

  // The caller's own directory is the only one nothing has checked - every
  // deeper one is checked before it is descended into.
  if (start !== '' && isIgnored.isIgnoredDirectory(start)) {
    return;
  }

  visitDirectory(tree, start, visitor, isIgnored);
}

/**
 * Callers must have cleared `dirPath` already - both call sites do.
 *
 * Not descending into an ignored directory is what makes the answers match git,
 * not just what makes them fast: git refuses to re-include a file inside an
 * excluded directory, and `isIgnoredFile` alone does not implement that rule
 * (see `isIgnoredByChain`). Flattening this into a per-file filter would start
 * visiting files git ignores.
 */
function visitDirectory(
  tree: Tree,
  dirPath: string,
  visitor: (path: string) => void,
  isIgnored: TreeIgnoreChecker
): void {
  for (const child of tree.children(dirPath)) {
    // Joined as POSIX rather than with `path.join`: tree paths are POSIX, and
    // on Windows a backslash-separated path silently matches nothing.
    const fullPath = dirPath ? `${dirPath}/${child}` : child;
    if (tree.isFile(fullPath)) {
      if (!isIgnored.isIgnoredFile(fullPath)) {
        visitor(fullPath);
      }
    } else if (!isIgnored.isIgnoredDirectory(fullPath)) {
      visitDirectory(tree, fullPath, visitor, isIgnored);
    }
  }
}

function normalizePathRelativeToRoot(path: string, root: string): string {
  return relative(root, join(root, path)).split(sep).join('/');
}
