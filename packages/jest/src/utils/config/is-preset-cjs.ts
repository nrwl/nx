import { type Tree, readJson } from '@nx/devkit';

export function isPresetCjs(tree: Tree) {
  if (tree.exists('jest.preset.cjs')) {
    return true;
  }

  const rootPkgJson = readJson(tree, 'package.json');
  if (rootPkgJson.type && rootPkgJson.type === 'module') {
    return true;
  }

  return false;
}
