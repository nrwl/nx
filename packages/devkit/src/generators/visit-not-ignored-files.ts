import type { Tree } from 'nx/src/generators/tree';
import { join, relative, sep } from 'path';
import { getIgnoredGlobsInTree } from 'nx/src/utils/ignore-patterns';

/**
 * Utility to act on all files in a tree that are not ignored by git or Nx.
 */
export function visitNotIgnoredFiles(
  tree: Tree,
  dirPath: string = tree.root,
  visitor: (path: string) => void
): void {
  const { fileIsIgnored } = getIgnoredGlobsInTree(tree);
  inner(tree, dirPath, visitor, fileIsIgnored);
}

function inner(
  tree: Tree,
  dirPath: string = tree.root,
  visitor: (path: string) => void,
  fileIsIgnored: (path: string) => boolean
): void {
  dirPath = normalizePathRelativeToRoot(dirPath, tree.root);
  if (dirPath !== '' && fileIsIgnored(dirPath)) {
    return;
  }
  for (const child of tree.children(dirPath)) {
    const fullPath = join(dirPath, child);
    if (fileIsIgnored(fullPath)) {
      continue;
    }
    if (tree.isFile(fullPath)) {
      visitor(fullPath);
    } else {
      inner(tree, fullPath, visitor, fileIsIgnored);
    }
  }
}

function normalizePathRelativeToRoot(path: string, root: string): string {
  return relative(root, join(root, path)).split(sep).join('/');
}
