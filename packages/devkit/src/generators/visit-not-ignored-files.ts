import type { Tree } from 'nx/src/devkit-exports';
import { createTreeIgnoreChecker } from 'nx/src/devkit-internals';
import { join, relative, sep } from 'path';

/**
 * Utility to act on all files in a tree that are not ignored by git.
 *
 * Ignore files cascade, so a nested `.gitignore` covers the files under it and a
 * nested negation overrides the root. They are read from the tree, not disk, so
 * one a generator wrote in the same run counts.
 *
 * `node_modules`, `.git` and the nx caches are never visited, whatever the
 * workspace's ignore files say.
 */
export function visitNotIgnoredFiles(
  tree: Tree,
  dirPath: string = tree.root,
  visitor: (path: string) => void
): void {
  // Built once for the whole traversal.
  const isIgnored = createTreeIgnoreChecker(tree, ['.gitignore', '.nxignore'], {
    cascade: true,
  });

  visitDirectory(
    tree,
    normalizePathRelativeToRoot(dirPath, tree.root),
    visitor,
    isIgnored
  );
}

function visitDirectory(
  tree: Tree,
  dirPath: string,
  visitor: (path: string) => void,
  isIgnored: (path: string) => boolean
): void {
  // A short-circuit, not a correctness guard: every child would be skipped
  // individually anyway, since a pattern that excludes a directory also
  // excludes its contents. It saves the `children` call for the entry
  // directory, which is the only one not already filtered by the loop below.
  if (dirPath !== '' && isIgnored(dirPath)) {
    return;
  }

  for (const child of tree.children(dirPath)) {
    // Joined as POSIX rather than with `path.join`: tree paths are POSIX, and
    // on Windows a backslash-separated path silently matches nothing.
    const fullPath = dirPath ? `${dirPath}/${child}` : child;
    if (isIgnored(fullPath)) {
      continue;
    }
    if (tree.isFile(fullPath)) {
      visitor(fullPath);
    } else {
      visitDirectory(tree, fullPath, visitor, isIgnored);
    }
  }
}

function normalizePathRelativeToRoot(path: string, root: string): string {
  return relative(root, join(root, path)).split(sep).join('/');
}
