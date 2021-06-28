import type { Tree } from '@nrwl/devkit';
import { joinPathFragments } from '@nrwl/devkit';
import type { Ignore } from 'ignore';
import ignore from 'ignore';

export function getAllFilesRecursivelyFromDir(
  tree: Tree,
  dir: string
): string[] {
  if (isPathIgnored(tree, dir)) {
    return [];
  }

  const files: string[] = [];
  const children = tree.children(dir);
  children.forEach((child) => {
    const childPath = joinPathFragments(dir, child);
    if (tree.isFile(childPath)) {
      files.push(childPath);
    } else {
      files.push(...getAllFilesRecursivelyFromDir(tree, childPath));
    }
  });

  return files;
}

function isPathIgnored(tree: Tree, path: string): boolean {
  let ig: Ignore;
  if (tree.exists('.gitignore')) {
    ig = ignore();
    ig.add(tree.read('.gitignore', 'utf-8'));
  }

  return path !== '' && ig?.ignores(path);
}
