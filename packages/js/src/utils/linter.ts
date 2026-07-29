import {
  getDependencyVersionFromPackageJson,
  readNxJson,
  type Tree,
} from '@nx/devkit';

/**
 * The linters Nx generators can set up for a project.
 *
 * Canonical home. `@nx/eslint` re-exports this for back-compat; the copy in
 * `@nx/workspace` is standalone because `@nx/workspace` does not depend on
 * `@nx/js`.
 */
export type LinterType = 'eslint' | 'oxlint' | 'none';

function hasPlugin(tree: Tree, plugin: string): boolean {
  const nxJson = readNxJson(tree);
  return !!nxJson?.plugins?.some((p) =>
    typeof p === 'string' ? p === plugin : p.plugin === plugin
  );
}

function hasAnyDependency(tree: Tree, packages: string[]): boolean {
  return packages.some((pkg) =>
    Boolean(getDependencyVersionFromPackageJson(tree, pkg))
  );
}

/**
 * The linter a workspace is already using, for generators that were not told
 * which one to set up.
 *
 * Oxlint wins when both are present: a workspace with both has adopted Oxlint
 * alongside its existing ESLint setup, and new projects should follow the
 * direction of travel rather than the setup being migrated away from.
 *
 * Falls back to `eslint` when nothing is detected, preserving the historical
 * default for fresh workspaces. Never returns `none` — detection answers "which
 * linter", not "whether to lint", so callers keep that decision.
 */
export function detectLinter(tree: Tree): Exclude<LinterType, 'none'> {
  if (
    hasPlugin(tree, '@nx/oxlint') ||
    hasAnyDependency(tree, ['@nx/oxlint', 'oxlint'])
  ) {
    return 'oxlint';
  }

  return 'eslint';
}
