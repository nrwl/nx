import type { Tree } from '@nrwl/devkit';
import { joinPathFragments } from '@nrwl/devkit';
import { createGitignoreFromTree } from 'nx/src/utils/ignore';

export function getAllFilesRecursivelyFromDir(
  tree: Tree,
  dir: string
): string[] {
  const ignore = createGitignoreFromTree(tree);

  function inner(dir: string) {
    if (ignore.ignores(dir)) {
      return [];
    }

    const files: string[] = [];
    const children = tree.children(dir);
    children.forEach((child) => {
      const childPath = joinPathFragments(dir, child);
      if (tree.isFile(childPath)) {
        files.push(childPath);
      } else {
        files.push(...inner(childPath));
      }
    });

    return files;
  }

  return inner(dir);
}
