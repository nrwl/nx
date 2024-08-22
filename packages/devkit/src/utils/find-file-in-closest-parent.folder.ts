import type { Tree } from 'nx/src/devkit-exports';
import { join } from 'node:path/posix';
import { dirname } from 'path';

/**
 * Find a file in the closest parent folder.
 *
 * @param tree
 * @param path The path relative to the workspace root to start searching from.
 * @param fileName The name of the file to search for.
 */
export function findFileInClosestParentFolder({
  tree,
  path,
  fileName,
}: {
  tree: Tree;
  path: string;
  fileName: string;
}): string | null {
  while (true) {
    const filePath = join(path, fileName);
    if (tree.exists(filePath)) {
      return filePath;
    }
    if (path === '.') {
      break;
    }
    path = dirname(path);
  }

  return null;
}
