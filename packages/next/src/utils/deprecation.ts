import { logger } from '@nx/devkit';

declare global {
  // Set by Nx while it builds the project graph. See nx's project-graph.
  // eslint-disable-next-line no-var
  var NX_GRAPH_CREATION: boolean;
}

// TODO(v24): Remove the @nx/next:build and @nx/next:server executors. The
// inferred plugin (@nx/next/plugin) and the convert-to-inferred generator
// stay supported.
export const NEXT_BUILD_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/next:build` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/next:convert-to-inferred` to migrate to the `@nx/next/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export const NEXT_SERVER_EXECUTOR_DEPRECATION_MESSAGE =
  'The `@nx/next:server` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/next:convert-to-inferred` to migrate to the `@nx/next/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.';

export function warnNextBuildExecutorDeprecation(): void {
  logger.warn(NEXT_BUILD_EXECUTOR_DEPRECATION_MESSAGE);
}

export function warnNextServerExecutorDeprecation(): void {
  logger.warn(NEXT_SERVER_EXECUTOR_DEPRECATION_MESSAGE);
}

// Fired when the @nx/next:application generator is about to generate targets
// that use the deprecated executors — i.e. when @nx/next/plugin isn't
// registered in nx.json. Surfaces the deprecation at generation time rather
// than only when the user later runs the generated targets.
export function warnNextExecutorGenerating(): void {
  logger.warn(
    'Generating targets that use the deprecated `@nx/next:build` and `@nx/next:server` executors. These executors will be removed in Nx v24. Run `nx g @nx/next:convert-to-inferred` next to migrate these targets to the `@nx/next/plugin` inferred plugin and prevent future generators from emitting executor targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.'
  );
}

// TODO(v24): Remove the `withNx`/`composePlugins` config wrappers. Modern
// workspaces resolve libraries via package manager workspaces and Next.js
// transpiles workspace source automatically, so a plain `next.config.js` works.
export const WITHNX_DEPRECATION_MESSAGE =
  '[Nx] `withNx()` from `@nx/next` is deprecated and will be removed in Nx v24. ' +
  'A plain `next.config.js` is now the recommended pattern; Next.js transpiles workspace libraries automatically. ' +
  'See https://nx.dev/docs/technologies/react/next/Guides/next-config-setup for the migration recipe.';

export const COMPOSE_PLUGINS_DEPRECATION_MESSAGE =
  '[Nx] `composePlugins()` from `@nx/next` is deprecated and will be removed in Nx v24. ' +
  'Compose Next.js plugins directly in your `next.config.js` and remove the `@nx/next` import. ' +
  'See https://nx.dev/docs/technologies/react/next/Guides/next-config-setup for the migration recipe.';

let warnedWithNx = false;
export function warnWithNxDeprecation(): void {
  if (warnedWithNx) return;
  warnedWithNx = true;
  logger.warn(WITHNX_DEPRECATION_MESSAGE);
}

let warnedComposePlugins = false;
// Only nudge during interactive Nx task execution: skip production server start
// (PHASE_PRODUCTION_SERVER), internal graph-creation passes, and direct
// (non-Nx) `next` invocations. `next/constants` is required lazily so the helper
// stays loadable in contexts where Next is not present.
export function warnComposePluginsDeprecation(phase: string): void {
  if (warnedComposePlugins) return;
  const { PHASE_PRODUCTION_SERVER } = require('next/constants');
  if (
    phase === PHASE_PRODUCTION_SERVER ||
    global.NX_GRAPH_CREATION ||
    !process.env.NX_TASK_TARGET_TARGET
  ) {
    return;
  }
  warnedComposePlugins = true;
  logger.warn(COMPOSE_PLUGINS_DEPRECATION_MESSAGE);
}
