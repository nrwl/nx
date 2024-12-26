import { existsSync, statSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { eslintFlatConfigFilenames } from './flat-config';

export const ESLINT_FLAT_CONFIG_FILENAMES = eslintFlatConfigFilenames;

export const ESLINT_OLD_CONFIG_FILENAMES = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc.json',
];

export const ESLINT_CONFIG_FILENAMES = [
  ...ESLINT_OLD_CONFIG_FILENAMES,
  ...ESLINT_FLAT_CONFIG_FILENAMES,
];

export const baseEsLintConfigFile = '.eslintrc.base.json';
export const baseEsLintFlatConfigFile = 'eslint.base.config.cjs';
// Make sure we can handle previous file extension as well for migrations or custom generators.
export const legacyBaseEsLintFlatConfigFile = 'eslint.base.config.js';

export function isFlatConfig(configFilePath: string): boolean {
  const configFileName = basename(configFilePath);

  return ESLINT_FLAT_CONFIG_FILENAMES.includes(configFileName);
}

// https://eslint.org/docs/latest/use/configure/configuration-files#configuration-file-resolution
export function findFlatConfigFile(
  directory: string,
  workspaceRoot: string
): string | null {
  let currentDir = resolve(workspaceRoot, directory);

  while (true) {
    const configFilePath = getConfigFileInDirectory(
      currentDir,
      ESLINT_FLAT_CONFIG_FILENAMES
    );
    if (configFilePath) {
      return configFilePath;
    }
    if (currentDir === workspaceRoot) {
      break;
    }
    currentDir = dirname(currentDir);
  }

  return null;
}

export function findOldConfigFile(
  filePathOrDirectory: string,
  workspaceRoot: string
): string | null {
  let currentDir = resolve(workspaceRoot, filePathOrDirectory);
  if (!statSync(currentDir).isDirectory()) {
    currentDir = dirname(currentDir);
  }

  while (true) {
    const configFilePath = getConfigFileInDirectory(
      currentDir,
      ESLINT_OLD_CONFIG_FILENAMES
    );
    if (configFilePath) {
      return configFilePath;
    }
    if (currentDir === workspaceRoot) {
      break;
    }
    currentDir = dirname(currentDir);
  }

  return null;
}

function getConfigFileInDirectory(
  directory: string,
  candidateFileNames: string[]
): string | null {
  for (const filename of candidateFileNames) {
    const filePath = join(directory, filename);
    if (existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}
