import type { Tree } from '@nrwl/devkit';

const eslintFileList = ['.eslintrc.json', '.eslintrc.js'];

export function containsEslint(tree: Tree): boolean {
  for (const file of eslintFileList) {
    if (tree.exists(file)) {
      return true;
    }
  }
  return false;
}

export function findEslintFile(tree: Tree): string {
  for (const file of eslintFileList) {
    if (tree.exists(file)) {
      return file;
    }
  }
  // Default file
  return '.eslintrc.json';
}
