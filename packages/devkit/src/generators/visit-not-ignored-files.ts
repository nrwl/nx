import type { Tree } from 'nx/src/devkit-exports';
import { getIgnoreObjectForTree } from 'nx/src/devkit-internals';
import { join, relative, sep } from 'path';

/**
 * Utility to act on all files in a tree that are not ignored by git.
 */
export function visitNotIgnoredFiles(
  tree: Tree,
  dirPath: string = tree.root,
  visitor: (path: string) => void
): void {
  const ig = getIgnoreObjectForTree(tree);
  dirPath = normalizePathRelativeToRoot(dirPath, tree.root);
  if (dirPath !== '' && ig?.ignores(dirPath)) {
    return;
  }
  for (const child of tree.children(dirPath)) {
    const fullPath = join(dirPath, child);
    if (ig?.ignores(fullPath)) {
      continue;
    }
    if (tree.isFile(fullPath)) {
      visitor(fullPath);
    } else {
      visitNotIgnoredFiles(tree, fullPath, visitor);
    }
  }
}

function normalizePathRelativeToRoot(path: string, root: string): string {
  return relative(root, join(root, path)).split(sep).join('/');
}
