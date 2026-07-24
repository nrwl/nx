import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Tree } from '../../generators/tree';
import { readJson } from '../../generators/utils/json';
import { readJsonFile } from '../fileutils';
import { isUsingOxfmt, isUsingOxfmtInTree } from './oxfmt';
import { isUsingPrettier, isUsingPrettierInTree } from './prettier';

export type FormatterType = 'prettier' | 'oxfmt' | null;

export { FORMATTER_MAX_BUFFER } from './shared';

export function detectFormatter(root: string): FormatterType {
  if (isUsingOxfmt(root)) {
    return 'oxfmt';
  }
  if (isUsingPrettier(root)) {
    return 'prettier';
  }

  // oxfmt runs on defaults with no config file at all, so a declared
  // dependency is the only signal an unconfigured oxfmt workspace gives.
  // Prettier deliberately has no equivalent fallback: prettier being merely
  // present in node_modules must not mean "format with prettier", or
  // workspaces using biome/dprint get reformatted (#30426).
  const packageJsonPath = join(root, 'package.json');
  if (existsSync(packageJsonPath)) {
    const packageJson = readJsonFile(packageJsonPath);
    if (hasOxfmtDependency(packageJson)) {
      return 'oxfmt';
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

  // See detectFormatter: oxfmt-only fallback, deliberately not prettier.
  if (tree.exists('package.json')) {
    if (hasOxfmtDependency(readJson(tree, 'package.json'))) {
      return 'oxfmt';
    }
  }

  return null;
}

function hasOxfmtDependency(packageJson: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): boolean {
  return Boolean(
    packageJson.dependencies?.['oxfmt'] ??
      packageJson.devDependencies?.['oxfmt']
  );
}
