import ignore = require('ignore');
import { readFileIfExisting } from './fileutils';
import { workspaceRoot } from './workspace-root';
import { Tree } from '../generators/tree';

export function getIgnoreObject(
  root: string = workspaceRoot
): ReturnType<typeof ignore> {
  const ig = ignore();
  ig.add(readFileIfExisting(`${root}/.gitignore`));
  ig.add(readFileIfExisting(`${root}/.nxignore`));
  return ig;
}

export function getIgnoreObjectForTree(tree: Tree) {
  let ig: ReturnType<typeof ignore>;
  if (tree.exists('.gitignore')) {
    ig = ignore();
    ig.add('.git');
    ig.add(tree.read('.gitignore', 'utf-8'));
  }
  if (tree.exists('.nxignore')) {
    ig ??= ignore();
    ig.add(tree.read('.nxignore', 'utf-8'));
  }

  return ig;
}
