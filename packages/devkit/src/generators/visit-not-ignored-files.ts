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
  // Built once for the whole traversal. `.nxignore` last and `merged` so its
  // patterns win: the native walker registers it through
  // `add_custom_ignore_filename`, which outranks `.gitignore`, so a `!x` there
  // has to re-include an `x` that `.gitignore` excluded. Merging is also exactly
  // what the helper this replaced did.
  const isIgnored = createTreeIgnoreChecker(tree, ['.gitignore', '.nxignore'], {
    cascade: true,
    combine: 'merged',
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
  // Probed as `dist/`, which is the spelling git documents for a directory and
  // the only one a trailing-slash pattern matches. Load-bearing: without it the
  // walk descends, and a negation in an ignore file *inside* the excluded
  // directory becomes the nearest opinion and re-includes children git would
  // never have looked at.
  if (dirPath !== '' && isIgnored(asDirectory(dirPath))) {
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
      // A directory excluded as `dist/` is not caught above - `ignore` will not
      // match a trailing-slash pattern against a slash-less path - so the guard
      // at the top of `visitDirectory` re-tests it as `dist/`.
      visitDirectory(tree, fullPath, visitor, isIgnored);
    }
  }
}

function asDirectory(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

function normalizePathRelativeToRoot(path: string, root: string): string {
  return relative(root, join(root, path)).split(sep).join('/');
}
