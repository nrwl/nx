import { logger } from '@nx/devkit';

// TODO(v24): Remove the @nx/webpack:webpack and @nx/webpack:dev-server
// executors. The inferred plugin (@nx/webpack/plugin) and the
// convert-to-inferred generator stay supported.
export const WEBPACK_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/webpack:webpack` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/webpack:convert-to-inferred` to migrate to the `@nx/webpack/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export const WEBPACK_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/webpack:dev-server` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/webpack:convert-to-inferred` to migrate to the `@nx/webpack/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnWebpackExecutorDeprecation(): void {
  logger.warn(WEBPACK_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnWebpackDevServerExecutorDeprecation(): void {
  logger.warn(WEBPACK_DEV_SERVER_EXECUTOR_DEPRECATION_MESSAGE);
}

// Fired when the @nx/webpack:configuration generator is about to scaffold
// targets that use the deprecated executors — i.e. when @nx/webpack/plugin
// isn't registered in nx.json. Surfaces the deprecation at scaffold time
// rather than only when the user later runs the generated targets.
export function warnWebpackExecutorScaffolding(): void {
  logger.warn(
    'Scaffolding targets that use the deprecated `@nx/webpack:webpack` and `@nx/webpack:dev-server` executors. These executors will be removed in Nx v24. Run `nx g @nx/webpack:convert-to-inferred` after this scaffold to migrate the generated targets to the `@nx/webpack/plugin` inferred plugin. To skip emitting executor targets entirely on future scaffolds, register `@nx/webpack/plugin` in `nx.json` first (`nx add @nx/webpack` or a manual plugin entry). See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}
