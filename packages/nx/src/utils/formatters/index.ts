import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Tree } from '../../generators/tree';
import { readJson } from '../../generators/utils/json';
import { readJsonFile } from '../fileutils';
import { isUsingOxfmt, isUsingOxfmtInTree } from './oxfmt';
import { isUsingPrettier, isUsingPrettierInTree } from './prettier';
import { logger } from '../logger';

/**
 * Adding a member here does NOT reliably break compilation: the repo builds
 * with `strict: false`, so a `switch` that omits one is not an error. The
 * `never` assertions and type-keyed tables that do catch it live outside
 * `packages/nx` in part, and those only fail once `packages/nx` is rebuilt.
 */
export type FormatterType = 'prettier' | 'oxfmt';

// Once per process: detection runs on every one of 200+ `formatFiles` call sites.
let warnedBothConfigured = false;

function warnBothConfigured(): void {
  warnedBothConfigured = true;
  logger.warn(
    'Both an oxfmt and a prettier config were found. Nx is formatting with ' +
      'oxfmt. Remove one config, or pass --formatter, to choose explicitly.'
  );
}

/** Test-only: the warn-once flag is module state and would leak between cases. */
export function resetFormatterWarningsForTesting(): void {
  warnedBothConfigured = false;
}

export function detectFormatter(root: string): FormatterType | null {
  if (isUsingOxfmt(root)) {
    // Flag first: the extra prettier lookup then costs once, not per generator.
    if (!warnedBothConfigured && isUsingPrettier(root)) {
      warnBothConfigured();
    }
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

export function detectFormatterInTree(tree: Tree): FormatterType | null {
  if (isUsingOxfmtInTree(tree)) {
    if (!warnedBothConfigured && isUsingPrettierInTree(tree)) {
      warnBothConfigured();
    }
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
