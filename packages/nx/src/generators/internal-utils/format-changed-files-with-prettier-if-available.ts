import type { Tree } from '../tree';
import * as path from 'path';
import type * as Prettier from 'prettier';
import { formatFileContentsWithPrettierIfAvailable } from '../../utils/prettier';
import { readJson } from '../utils/json';

/**
 * Formats all the created or updated files using Prettier
 * @param tree - the file system tree
 */
export async function formatChangedFilesWithPrettierIfAvailable(
  tree: Tree
): Promise<void> {
  const files = new Set(
    tree.listChanges().filter((file) => file.type !== 'DELETE')
  );

  const changedPrettierInTree = getChangedPrettierConfigInTree(tree);

  await Promise.all(
    Array.from(files).map(async (file) => {
      const systemPath = path.join(tree.root, file.path);
      try {
        tree.write(
          file.path,
          await formatFileContentsWithPrettierIfAvailable(
            systemPath,
            file.content.toString('utf-8'),
            changedPrettierInTree
          )
        );
      } catch (e) {
        console.warn(`Could not format ${file.path}. Error: "${e.message}"`);
      }
    })
  );
}

function getChangedPrettierConfigInTree(tree: Tree): Prettier.Options | null {
  if (tree.listChanges().find((file) => file.path === '.prettierrc')) {
    try {
      return readJson(tree, '.prettierrc');
    } catch {
      return null;
    }
  } else {
    return null;
  }
}
