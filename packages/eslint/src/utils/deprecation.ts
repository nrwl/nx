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
