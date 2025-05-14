import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Tree } from '../generators/tree';
import { readJson } from '../generators/utils/json';
import { readJsonFile } from './fileutils';

/**
 * Possible configuration files are taken from https://prettier.io/docs/configuration
 */
const configFiles = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  '.prettierrc.json5',
  '.prettierrc.js',
  'prettier.config.js',
  '.prettierrc.ts',
  'prettier.config.ts',
  '.prettierrc.mjs',
  'prettier.config.mjs',
  '.prettierrc.mts',
  'prettier.config.mts',
  '.prettierrc.cjs',
  'prettier.config.cjs',
  '.prettierrc.cts',
  'prettier.config.cts',
  '.prettierrc.toml',
];

export function isUsingPrettier(root: string) {
  for (const file of configFiles) {
    if (existsSync(file)) {
      return true;
    }
  }
  // Even if no file is present, it is possible the user is configuring prettier via their package.json
  const packageJsonPath = join(root, 'package.json');
  if (existsSync(packageJsonPath)) {
    const packageJson = readJsonFile(packageJsonPath);
    if (packageJson.prettier) {
      return true;
    }
  }
  return false;
}

export function isUsingPrettierInTree(tree: Tree) {
  for (const file of configFiles) {
    if (tree.exists(file)) {
      return true;
    }
  }
  // Even if no file is present, it is possible the user is configuring prettier via their package.json
  if (tree.exists('package.json')) {
    const packageJson = readJson(tree, 'package.json');
    if (packageJson.prettier) {
      return true;
    }
  }
  return false;
}
