import type { Tree } from 'nx/src/generators/tree';
import { createGitIgnoreFromTree } from 'nx/src/utils/ignore';
import { join, relative, sep } from 'path';

/**
 * Utility to act on all files in a tree that are not ignored by git.
 */
export function visitNotIgnoredFiles(
  tree: Tree,
  dirPath: string = tree.root,
  visitor: (path: string) => void
): void {
  const ignore = createGitIgnoreFromTree(tree);

  function inner(dirPath: string) {
    dirPath = normalizePathRelativeToRoot(dirPath, tree.root);
    if (dirPath !== '' && ignore.ignores(dirPath)) {
      return;
    }
    for (const child of tree.children(dirPath)) {
      const fullPath = join(dirPath, child);
      if (ignore.ignores(fullPath)) {
        continue;
      }
      if (tree.isFile(fullPath)) {
        visitor(fullPath);
      } else {
        inner(fullPath);
      }
    }
  }

  inner(dirPath);
}

function normalizePathRelativeToRoot(path: string, root: string): string {
  return relative(root, join(root, path)).split(sep).join('/');
}
