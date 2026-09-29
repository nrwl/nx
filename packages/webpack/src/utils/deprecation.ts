import { logger } from '@nx/devkit';

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
