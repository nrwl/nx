import { logger } from '@nx/devkit';

// TODO(v24): Remove the webpack `withReact` config helper. It emits an
// Nx-specific webpack config function that only runs under the
// @nx/webpack:webpack executor; the inferred @nx/webpack/plugin works with
// standard webpack configs built around NxReactWebpackPlugin instead.
export const REACT_WITH_REACT_DEPRECATION_MESSAGE =
  'The `withReact` config helper from `@nx/react` is deprecated and will be removed in Nx v24. It produces an Nx-specific webpack config function that only runs under the `@nx/webpack:webpack` executor. Migrate to a standard webpack config that uses `NxReactWebpackPlugin` (from `@nx/react/webpack-plugin`) under the inferred `@nx/webpack/plugin` by running `nx g @nx/webpack:convert-to-inferred`. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

let withReactWarned = false;
let suppressDepth = 0;

// Nx-internal entry points compose `withReact` themselves (e.g. the storybook
// and component-testing presets). They wrap their synchronous composition in
// this so the warning fires only for user-authored configs.
export function suppressReactComposeHelperWarnings<T>(fn: () => T): T {
  suppressDepth++;
  try {
    return fn();
  } finally {
    suppressDepth--;
  }
}

// Warn once per process so HMR reloads and repeated config evaluation don't
// repeat the message.
export function warnReactWithReactDeprecation(): void {
  if (suppressDepth > 0 || withReactWarned) return;
  withReactWarned = true;
  logger.warn(REACT_WITH_REACT_DEPRECATION_MESSAGE);
}
