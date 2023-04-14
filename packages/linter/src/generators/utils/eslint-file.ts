import { joinPathFragments, Tree } from '@nx/devkit';

export const eslintConfigFileWhitelist = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc.json',
  'eslint.config.js', // new format that requires `ESLINT_USE_FLAT_CONFIG=true`
];

export const baseEsLintConfigFile = '.eslintrc.base.json';

export function findEslintFile(tree: Tree, projectRoot = ''): string | null {
  if (projectRoot === '' && tree.exists(baseEsLintConfigFile)) {
    return baseEsLintConfigFile;
  }
  for (const file of eslintConfigFileWhitelist) {
    if (tree.exists(joinPathFragments(projectRoot, file))) {
      return file;
    }
  }

  return null;
}
