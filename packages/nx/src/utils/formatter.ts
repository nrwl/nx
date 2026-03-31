import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Tree } from '../generators/tree';
import { isUsingOxfmt, isUsingOxfmtInTree } from './is-using-oxfmt';
import { isUsingPrettier, isUsingPrettierInTree } from './is-using-prettier';
import { readJsonFile } from './fileutils';
import { readJson } from '../generators/utils/json';

export type FormatterType = 'prettier' | 'oxfmt' | null;

export function detectFormatter(root: string): FormatterType {
  if (isUsingOxfmt(root)) {
    return 'oxfmt';
  }
  if (isUsingPrettier(root)) {
    return 'prettier';
  }

  const packageJsonPath = join(root, 'package.json');
  if (existsSync(packageJsonPath)) {
    const packageJson = readJsonFile(packageJsonPath);
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    if (deps['oxfmt']) {
      return 'oxfmt';
    }
    if (deps['prettier']) {
      return 'prettier';
    }
  }

  return null;
}

export function detectFormatterInTree(tree: Tree): FormatterType {
  if (isUsingOxfmtInTree(tree)) {
    return 'oxfmt';
  }
  if (isUsingPrettierInTree(tree)) {
    return 'prettier';
  }

  if (tree.exists('package.json')) {
    const packageJson = readJson(tree, 'package.json');
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    if (deps['oxfmt']) {
      return 'oxfmt';
    }
    if (deps['prettier']) {
      return 'prettier';
    }
  }

  return null;
}
