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

export function isFlatConfig(configFilePath: string): boolean {
  return configFilePath.endsWith('.config.js');
}
