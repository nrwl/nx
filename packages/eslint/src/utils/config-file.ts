import { joinPathFragments } from '@nx/devkit';
import { existsSync } from 'fs';

export const ESLINT_CONFIG_FILENAMES = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc.json',
  'eslint.config.js',
];

export const baseEsLintConfigFile = '.eslintrc.base.json';
export const baseEsLintFlatConfigFile = 'eslint.base.config.js';

export function findBaseEslintFile(workspaceRoot = ''): string | null {
  if (existsSync(joinPathFragments(workspaceRoot, baseEsLintConfigFile))) {
    return baseEsLintConfigFile;
  }
  if (existsSync(joinPathFragments(workspaceRoot, baseEsLintFlatConfigFile))) {
    return baseEsLintFlatConfigFile;
  }
  for (const file of ESLINT_CONFIG_FILENAMES) {
    if (existsSync(joinPathFragments(workspaceRoot, file))) {
      return file;
    }
  }

  return null;
}

export function isFlatConfig(configFilePath: string): boolean {
  return configFilePath.endsWith('.config.js');
}
