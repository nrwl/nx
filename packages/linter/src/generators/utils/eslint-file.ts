import type { Tree } from '@nrwl/devkit';

export const eslintConfigFileWhitelist = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc.json',
];

export function findEslintFile(tree: Tree): string | null {
  for (const file of eslintConfigFileWhitelist) {
    if (tree.exists(file)) {
      return file;
    }
  }

  return null;
}
