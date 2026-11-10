import { basename } from 'path';
import {
  baseEslintConfigFilenames,
  eslintFlatConfigFilenames,
  eslintrcFilenames,
} from './flat-config';

export const ESLINT_FLAT_CONFIG_FILENAMES = eslintFlatConfigFilenames;

export const ESLINT_OLD_CONFIG_FILENAMES = eslintrcFilenames;

export const ESLINT_CONFIG_FILENAMES = [
  ...ESLINT_OLD_CONFIG_FILENAMES,
  ...ESLINT_FLAT_CONFIG_FILENAMES,
];

export const BASE_ESLINT_CONFIG_FILENAMES = baseEslintConfigFilenames;

export const baseEsLintConfigFile = '.eslintrc.base.json';
export const baseEsLintFlatConfigFile = 'eslint.base.config.mjs';
// Make sure we can handle previous file extension as well for migrations or custom generators.
export const legacyBaseEsLintFlatConfigFile = 'eslint.base.config.js';

export function isFlatConfig(configFilePath: string): boolean {
  const configFileName = basename(configFilePath);

  return ESLINT_FLAT_CONFIG_FILENAMES.includes(configFileName);
}
