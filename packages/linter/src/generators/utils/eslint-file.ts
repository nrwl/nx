import { joinPathFragments, Tree } from '@nrwl/devkit';

export const eslintConfigFileWhitelist = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc.json',
];

export function findEslintFile(tree: Tree, projectRoot = ''): string | null {
  for (const file of eslintConfigFileWhitelist) {
    if (tree.exists(joinPathFragments(projectRoot, file))) {
      return file;
    }
  }

  return null;
}
