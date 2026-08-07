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
 * Every linter the workspace has installed, most-preferred first — so `[0]` is
 * the one a generator should follow when it was not told which to set up, and
 * `.includes(x)` answers whether the workspace uses `x` at all. Those differ in
 * a workspace part-way through a migration: it has both, and a project
 * generated for Oxlint still lives under the root ESLint config.
 *
 * Oxlint sorts first when both are present. A workspace with both has adopted
 * Oxlint alongside its existing ESLint setup, and new projects should follow
 * the direction of travel rather than the setup being migrated away from.
 *
 * Empty means the workspace opted out of linting; callers that need a concrete
 * answer should read that as `none` rather than inferring ESLint for it.
 *
 * Reads the tree, never the generator's own module resolution: `eslint` is a
 * peer dependency of several first-party plugins, so it resolves from disk in
 * workspaces that do not use it.
 */
export function detectLinters(tree: Tree): Exclude<LinterType, 'none'>[] {
  const linters: Exclude<LinterType, 'none'>[] = [];

  if (
    hasPlugin(tree, '@nx/oxlint') ||
    hasAnyDependency(tree, ['@nx/oxlint', 'oxlint'])
  ) {
    linters.push('oxlint');
  }

  // `@nx/eslint` registers its inference plugin as `@nx/eslint/plugin`, unlike
  // `@nx/oxlint`, which registers under its bare package name.
  if (
    hasPlugin(tree, '@nx/eslint/plugin') ||
    hasAnyDependency(tree, ['@nx/eslint', 'eslint'])
  ) {
    linters.push('eslint');
  }

  return linters;
}
