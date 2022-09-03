import type { Tree } from '@nrwl/devkit';

const eslintFileList = ['.eslintrc.json', '.eslintrc.js'];

export function findEslintFile(tree: Tree): string | null {
  for (const file of eslintFileList) {
    if (tree.exists(file)) {
      return file;
    }
  }
  return null;
}
