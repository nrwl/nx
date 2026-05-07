import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/rspack:rspack and @nx/rspack:dev-server
// executors. The inferred plugin (@nx/rspack/plugin) and the
// convert-to-inferred generator stay supported.
export const RSPACK_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/rspack:rspack` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/rspack:convert-to-inferred` to migrate to the `@nx/rspack/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export const RSPACK_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/rspack:dev-server` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/rspack:convert-to-inferred` to migrate to the `@nx/rspack/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnRspackExecutorDeprecation(): void {
  logger.warn(RSPACK_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnRspackDevServerExecutorDeprecation(): void {
  logger.warn(RSPACK_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnRspackExecutorGenerating(): void {
  logger.warn(
    'Generating targets that use the deprecated `@nx/rspack:rspack` and `@nx/rspack:dev-server` executors. These executors will be removed in Nx v24. Run `nx g @nx/rspack:convert-to-inferred` next to migrate these targets to the `@nx/rspack/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
