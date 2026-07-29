import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Tree } from '../../generators/tree';
import { readJson } from '../../generators/utils/json';
import { readJsonFile } from '../fileutils';
import { isUsingOxfmt, isUsingOxfmtInTree } from './oxfmt';
import { isUsingPrettier, isUsingPrettierInTree } from './prettier';

/**
 * A formatter Nx can actually dispatch to. "No formatter configured" is the
 * absence of one, so detection returns `FormatterType | null` rather than
 * folding null into this union - dispatch sites then handle only formatters
 * they can actually run, and the caller has to deal with "none" once, up front.
 *
 * The repo builds with `strict: false`, so a `switch` that merely omits a
 * member is not an error by itself. The two dispatch sites that return a value
 * carry a `never` assertion in their `default` arm, and that *is* enforced -
 * adding a member here fails to compile there rather than returning `undefined`
 * into a caller that iterates it. The remaining sites are `if`/`else` chains
 * (devkit's `formatFiles`, `nx init`'s formatter pass) and still need visiting
 * by hand.
 */
export type FormatterType = 'prettier' | 'oxfmt';

export function detectFormatter(root: string): FormatterType | null {
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

export function detectFormatterInTree(tree: Tree): FormatterType | null {
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
