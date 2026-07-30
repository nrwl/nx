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
 * member is not an error by itself. Adding a member here is therefore made to
 * fail compilation at all five dispatch sites that can be made to: `check()`
 * and `write()` in `command-line/format/format.ts` and `formatDetectedFiles`
 * in `generators/internal-utils/format-changed-files.ts` each carry a `never`
 * assertion in their `default` arm, and both `format.ts`'s binary-resolution
 * table and `@nx/js`'s `formatterSetups` are keyed by this type. The last one
 * reads the type from nx's *emitted* declarations, so it only fails once
 * `packages/nx` has been rebuilt.
 *
 * What still needs visiting by hand: the `formatterType === 'prettier'`
 * ternary and `if` in `format.ts`, devkit's `formatFiles`, and `nx init`'s
 * formatter pass - all `if`/`else` shapes with no exhaustiveness to assert.
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
