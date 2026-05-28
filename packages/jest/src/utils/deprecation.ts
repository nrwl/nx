import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/jest:jest executor. The inferred plugin
// (@nx/jest/plugin) and the convert-to-inferred generator stay supported.
export const JEST_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/jest:jest` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/jest:convert-to-inferred` to migrate to the `@nx/jest/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnJestExecutorDeprecation(): void {
  logger.warn(JEST_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnJestExecutorGenerating(): void {
  logger.warn(
    'Generating a target that uses the deprecated `@nx/jest:jest` executor. The executor will be removed in Nx v24. Run `nx g @nx/jest:convert-to-inferred` next to migrate this target to the `@nx/jest/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
