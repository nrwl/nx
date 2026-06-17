import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/eslint:lint executor. The inferred plugin
// (@nx/eslint/plugin) and the convert-to-inferred generator stay supported.
export const ESLINT_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/eslint:lint` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/eslint:convert-to-inferred` to migrate to the `@nx/eslint/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnEslintExecutorDeprecation(): void {
  logger.warn(ESLINT_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnEslintExecutorGenerating(): void {
  logger.warn(
    'Generating a target that uses the deprecated `@nx/eslint:lint` executor. The executor will be removed in Nx v24. Run `nx g @nx/eslint:convert-to-inferred` next to migrate this target to the `@nx/eslint/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}

// TODO(v24): Remove ESLint v8 support. Concrete removals:
//   - Raise `minSupportedEslintVersion` to '9.0.0' in versions.ts.
//   - Delete `versionMap[8]` and the `CompatVersions` type alias.
//   - Delete this constant + `warnEslintV8Deprecation` and their call sites.
//   - Drop the v8 branch in the workspace-rule generator/template.
export const ESLINT_V8_DEPRECATION_MESSAGE =
  'Support for ESLint v8 is deprecated and will be removed in Nx v24. Please upgrade to ESLint v9.';

export function warnEslintV8Deprecation(): void {
  logger.warn(ESLINT_V8_DEPRECATION_MESSAGE);
}
