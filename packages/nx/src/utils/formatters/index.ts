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
 * `never` assertions and type-keyed tables that do catch it fail immediately
 * inside `packages/nx`, but the ones in devkit and `@nx/js` read the type from
 * its emitted declarations, so those only fail once it has been rebuilt.
 */
export type FormatterType = 'prettier' | 'oxfmt';

// Once per process: detection runs on every one of 200+ `formatFiles` call sites.
let warnedBothConfigured = false;

function warnBothConfigured(): void {
  warnedBothConfigured = true;
  logger.warn(
    'Both an oxfmt and a prettier config were found. Nx is formatting with ' +
      'oxfmt. Delete the config you are not using to make the choice ' +
      'explicit: https://nx.dev/docs/reference/code-formatting'
  );
}

/** Test-only: the warn-once flag is module state and would leak between cases. */
export function resetFormatterWarningsForTesting(): void {
  warnedBothConfigured = false;
}

export function detectFormatter(root: string): FormatterType | null {
  if (isUsingOxfmt(root)) {
    // Flag first, so the lookup stops repeating once we have warned.
    if (!warnedBothConfigured && isUsingPrettier(root)) {
      warnBothConfigured();
    }
    return 'oxfmt';
  }
  if (isUsingPrettier(root)) {
    return 'prettier';
  }

  // Neither is configured. Both formatters run on their defaults, so a
  // dependency declared in the root package.json is the only statement of
  // intent an unconfigured workspace gives. #30426 ruled out treating prettier
  // as *resolvable in node_modules*, which a declared dependency is not.
  const packageJsonPath = join(root, 'package.json');
  if (existsSync(packageJsonPath)) {
    return detectFormatterFromDependencies(readJsonFile(packageJsonPath));
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

  // See detectFormatter: a declared dependency is the fallback for both.
  if (tree.exists('package.json')) {
    return detectFormatterFromDependencies(readJson(tree, 'package.json'));
  }

  return null;
}

type PackageJsonDependencies = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/** oxfmt first, matching the precedence the config files already have. */
function detectFormatterFromDependencies(
  packageJson: PackageJsonDependencies
): FormatterType | null {
  if (hasDependency(packageJson, 'oxfmt')) {
    return 'oxfmt';
  }
  if (hasDependency(packageJson, 'prettier')) {
    return 'prettier';
  }
  return null;
}

function hasDependency(
  packageJson: PackageJsonDependencies,
  name: string
): boolean {
  return Boolean(
    packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name]
  );
}
