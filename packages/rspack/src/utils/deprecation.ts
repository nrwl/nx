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

// TODO(v24): Remove the composePlugins/withNx/withWeb/withReact config helpers.
// They emit an Nx-specific config function that only runs under the
// @nx/rspack:rspack executor; the inferred @nx/rspack/plugin works with standard
// rspack configs built around NxAppRspackPlugin/NxReactRspackPlugin instead.
export const RSPACK_COMPOSE_HELPERS_DEPRECATION_MESSAGE =
  'The `composePlugins`, `withNx`, `withWeb`, and `withReact` config helpers from `@nx/rspack` are deprecated and will be removed in Nx v24. They produce an Nx-specific config function that only runs under the `@nx/rspack:rspack` executor. Migrate to a standard rspack config that uses `NxAppRspackPlugin` (from `@nx/rspack/app-plugin`) or `NxReactRspackPlugin` (from `@nx/rspack/react-plugin`) under the inferred `@nx/rspack/plugin` by running `nx g @nx/rspack:convert-to-inferred`. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

let composeHelpersWarned = false;
let suppressDepth = 0;

// Nx-internal entry points compose these helpers themselves (e.g. the rspack
// executor). They wrap their synchronous composition in this so the warning
// fires only for user-authored configs.
export function suppressRspackComposeHelperWarnings<T>(fn: () => T): T {
  suppressDepth++;
  try {
    return fn();
  } finally {
    suppressDepth--;
  }
}

// Warn once per process so a `composePlugins(withNx(), withReact())` chain logs
// a single line, not one per helper, and HMR reloads don't repeat it.
export function warnRspackComposeHelpersDeprecation(): void {
  if (suppressDepth > 0 || composeHelpersWarned) return;
  composeHelpersWarned = true;
  logger.warn(RSPACK_COMPOSE_HELPERS_DEPRECATION_MESSAGE);
}
