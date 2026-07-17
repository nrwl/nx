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

// Fired when the @nx/webpack:configuration generator is about to generate
// targets that use the deprecated executors — i.e. when @nx/webpack/plugin
// isn't registered in nx.json. Surfaces the deprecation at generation time
// rather than only when the user later runs the generated targets.
export function warnWebpackExecutorGenerating(): void {
  logger.warn(
    'Generating targets that use the deprecated `@nx/webpack:webpack` and `@nx/webpack:dev-server` executors. These executors will be removed in Nx v24. Run `nx g @nx/webpack:convert-to-inferred` next to migrate these targets to the `@nx/webpack/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}

// TODO(v24): Remove the composePlugins/withNx/withWeb config helpers. They emit
// an Nx-specific config function that only runs under the @nx/webpack:webpack
// executor; the inferred @nx/webpack/plugin works with standard webpack configs
// built around NxAppWebpackPlugin instead.
export const WEBPACK_COMPOSE_HELPERS_DEPRECATION_MESSAGE =
  'The `composePlugins`, `withNx`, and `withWeb` config helpers from `@nx/webpack` are deprecated and will be removed in Nx v24. They produce an Nx-specific config function that only runs under the `@nx/webpack:webpack` executor. Migrate to a standard webpack config that uses `NxAppWebpackPlugin` (from `@nx/webpack/app-plugin`) under the inferred `@nx/webpack/plugin` by running `nx g @nx/webpack:convert-to-inferred`. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

let composeHelpersWarned = false;
let suppressDepth = 0;

// Nx-internal entry points compose these helpers themselves (e.g. the rspack
// executor, the storybook/component-testing presets). They wrap their
// synchronous composition in this so the warning fires only for user-authored
// configs, not for users who never touched the compose helpers.
export function suppressWebpackComposeHelperWarnings<T>(fn: () => T): T {
  suppressDepth++;
  try {
    return fn();
  } finally {
    suppressDepth--;
  }
}

// Warn once per process so a `composePlugins(withNx(), withWeb())` chain logs a
// single line, not one per helper, and HMR reloads don't repeat it.
export function warnWebpackComposeHelpersDeprecation(): void {
  if (suppressDepth > 0 || composeHelpersWarned) return;
  composeHelpersWarned = true;
  logger.warn(WEBPACK_COMPOSE_HELPERS_DEPRECATION_MESSAGE);
}
