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
  /** ESLint-only. Oxlint is inference-only, so it writes no explicit target. */
  addExplicitTargets?: boolean;
  /**
   * ESLint-only. The `@nx/dependency-checks` rule lints `package.json`, which
   * Oxlint cannot read.
   */
  addPackageJsonDependencyChecks?: boolean;
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
 * generator. The two arms name different generators on purpose: `@nx/eslint`
 * writes a lint target, while `@nx/oxlint` is inference-only and only
 * configures the project.
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
  // `linter` is typed as required, but `tsconfig.base.json` sets
  // `"strict": false` and several generator schemas (detox, expo,
  // react-native) declare it optional, so `undefined` does reach here through
  // a `...options` spread. It has always meant ESLint; naming that here keeps
  // it from being an implicit fallthrough and lets the union below be
  // exhaustive.
  const linter = options.linter ?? 'eslint';

  if (linter === 'none') {
    return () => {};
  }

  if (linter === 'oxlint') {
    // `ensurePackage` installs by package name, so the subpath is required
    // separately. `nx-ignore-next-line` keeps this out of the import graph so
    // `@nx/dependency-checks` does not demand `@nx/oxlint` in this package's
    // package.json — it is installed on demand, not depended on. The deliberate
    // `js` <-> `@nx/oxlint` graph cycle comes from `implicitDependencies` in
    // packages/js/project.json and is recorded in `ignoredCircularDependencies`
    // in the root eslint config.
    ensurePackage('@nx/oxlint', nxVersion);
    const {
      configurationGenerator,
      // nx-ignore-next-line
    } = require('@nx/oxlint/generators');
    return configurationGenerator(tree, {
      project: options.project,
      plugins: [
        ...(options.oxlintPlugins ?? []),
        ...oxlintTestPlugins(options.unitTestRunner),
      ],
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      keepExistingVersions: options.keepExistingVersions,
      // No `addPlugin`: `@nx/oxlint` is inference-only, so it always registers.
    });
  }

  if (linter === 'eslint') {
    const { lintProjectGenerator } = ensurePackage('@nx/eslint', nxVersion);
    return lintProjectGenerator(tree, {
      linter,
      project: options.project,
      tsConfigPaths: options.tsConfigPaths,
      unitTestRunner: options.unitTestRunner,
      rootProject: options.rootProject,
      enableTypedLinting: options.enableTypedLinting,
      eslintConfigFormat: options.eslintConfigFormat,
      addExplicitTargets: options.addExplicitTargets,
      addPackageJsonDependencyChecks: options.addPackageJsonDependencyChecks,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      keepExistingVersions: options.keepExistingVersions,
      addPlugin: options.addPlugin,
    });
  }

  // Spelling ESLint out as its own branch rather than letting it be the
  // fallthrough: a new `LinterType` member then fails to compile here instead of
  // silently getting an ESLint setup.
  const unhandled: never = linter;
  throw new Error(`Unsupported linter: ${unhandled}`);
}

/**
 * Which Oxlint plugins a test runner needs is the runner package's knowledge,
 * so it is read from there rather than hardcoded here — this only maps the
 * runner name to its package. Matched loosely because runners arrive with
 * suffixes, e.g. Angular's `vitest-analog`. Both packages are already installed
 * by the time the runner's own generator runs; `ensurePackage` keeps them out
 * of the import graph, since both depend on `@nx/js`.
 */
function oxlintTestPlugins(unitTestRunner: string | undefined): string[] {
  const pkg = unitTestRunner?.includes('vitest')
    ? '@nx/vitest'
    : unitTestRunner?.includes('jest')
      ? '@nx/jest'
      : undefined;

  if (!pkg) {
    return [];
  }

  // `ensurePackage` installs by package name, so the `internal` subpath is
  // required separately. It is a semi-private entry — this is a first-party
  // consumer, which is what that surface is for.
  ensurePackage(pkg, nxVersion);
  const { oxlintPlugins }: { oxlintPlugins?: string[] } = require(
    `${pkg}/internal`
  );

  return oxlintPlugins ?? [];
}
