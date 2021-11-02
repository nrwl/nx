import type { Tree } from '@nrwl/tao/src/shared/tree';
import { join } from 'path';
import ignore, { Ignore } from 'ignore';

/**
 * Utility to act on all files in a tree that are not ignored by git.
 */
export function visitNotIgnoredFiles(
  tree: Tree,
  dirPath: string = tree.root,
  visitor: (path: string) => void
): void {
  let ig: Ignore;
  if (tree.exists('.gitignore')) {
    ig = ignore();
    ig.add(tree.read('.gitignore', 'utf-8'));
  }
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
