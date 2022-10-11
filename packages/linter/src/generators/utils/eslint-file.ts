import type { Tree } from '@nrwl/devkit';

export const eslintFileList = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc.json',
];

export function findEslintFile(tree: Tree): string | null {
  for (const file of eslintFileList) {
    if (tree.exists(file)) {
      return file;
    }
  }

  return null;
}
