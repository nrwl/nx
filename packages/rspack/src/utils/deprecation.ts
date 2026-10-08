import { logger } from '@nx/devkit';

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
