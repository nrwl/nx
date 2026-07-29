import { ensurePackage, GeneratorCallback, Tree } from '@nx/devkit';
import { nxVersion } from './versions';
import type { LinterType } from './linter';

export interface AddLintingToProjectOptions {
  linter: LinterType;
  project: string;
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  addPlugin?: boolean;
  /** ESLint-only. Ignored by other linters. */
  tsConfigPaths?: string[];
  unitTestRunner?: string;
  /** ESLint-only. Ignored by other linters. */
  rootProject?: boolean;
  /** ESLint-only. Ignored by other linters. */
  enableTypedLinting?: boolean;
  /** ESLint-only. Ignored by other linters. */
  eslintConfigFormat?: 'mjs' | 'cjs';
  /**
   * Oxlint plugins to enable for this project, e.g. `['react', 'jsx-a11y']`.
   * Ignored by other linters, which express framework presets differently.
   */
  oxlintPlugins?: string[];
}

/**
 * Sets a project's linter up, dispatching to whichever linter the workspace
 * asked for. Consumers call this instead of importing `lintProjectGenerator`
 * from `@nx/eslint` directly, so adding a linter does not mean editing every
 * generator.
 *
 * Scope is deliberately narrow: registering the linter and its project target.
 * Linter-specific config shaping — ESLint framework presets, `extends`, ignore
 * entries — stays at the call site guarded on `linter`, because none of it has
 * a cross-linter equivalent.
 *
 * Both plugins are loaded through `ensurePackage`; a static import would be
 * circular, since both depend on `@nx/js`.
 */
export async function addLintingToProject(
  tree: Tree,
  options: AddLintingToProjectOptions
): Promise<GeneratorCallback> {
  if (options.linter === 'none') {
    return () => {};
  }

  if (options.linter === 'oxlint') {
    // `ensurePackage` installs by package name, so the subpath is required
    // separately. `nx-ignore-next-line` keeps the edge out of the graph — oxlint
    // depends on js, so a real one would be a cycle. `implicitDependencies` in
    // packages/js/project.json carries the hashing relationship instead.
    ensurePackage('@nx/oxlint', nxVersion);
    const {
      lintProjectGenerator,
      // nx-ignore-next-line
    } = require('@nx/oxlint/generators');
    return lintProjectGenerator(tree, {
      project: options.project,
      plugins: [
        ...(options.oxlintPlugins ?? []),
        ...oxlintTestPlugins(options.unitTestRunner),
      ],
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      keepExistingVersions: options.keepExistingVersions,
      addPlugin: options.addPlugin,
    });
  }

  const { lintProjectGenerator } = ensurePackage('@nx/eslint', nxVersion);
  return lintProjectGenerator(tree, {
    linter: options.linter,
    project: options.project,
    tsConfigPaths: options.tsConfigPaths,
    unitTestRunner: options.unitTestRunner,
    rootProject: options.rootProject,
    enableTypedLinting: options.enableTypedLinting,
    eslintConfigFormat: options.eslintConfigFormat,
    skipFormat: true,
    skipPackageJson: options.skipPackageJson,
    keepExistingVersions: options.keepExistingVersions,
    addPlugin: options.addPlugin,
  });
}

/**
 * Oxlint's test-runner plugins are named after the runner, so the plugin comes
 * straight from `unitTestRunner`. Matched loosely because runners arrive with
 * suffixes, e.g. Angular's `vitest-analog`.
 */
function oxlintTestPlugins(unitTestRunner: string | undefined): string[] {
  if (unitTestRunner?.includes('vitest')) {
    return ['vitest'];
  }
  if (unitTestRunner?.includes('jest')) {
    return ['jest'];
  }
  return [];
}
