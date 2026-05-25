import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/remix:build and @nx/remix:serve executors. The
// inferred plugin (@nx/remix/plugin) and the convert-to-inferred generator
// stay supported.
export const REMIX_BUILD_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/remix:build` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/remix:convert-to-inferred` to migrate to the `@nx/remix/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export const REMIX_SERVE_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/remix:serve` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/remix:convert-to-inferred` to migrate to the `@nx/remix/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnRemixBuildExecutorDeprecation(): void {
  logger.warn(REMIX_BUILD_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnRemixServeExecutorDeprecation(): void {
  logger.warn(REMIX_SERVE_EXECUTOR_DEPRECATION_MESSAGE);
}
