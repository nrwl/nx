import type { ExecutorContext } from '@nx/devkit';
import type { Configuration } from '@rspack/core';
import type { NormalizedRspackExecutorSchema } from '../executors/rspack/schema';
import { warnRspackComposeHelpersDeprecation } from './deprecation';

export const nxRspackComposablePlugin = 'nxRspackComposablePlugin';

export function isNxRspackComposablePlugin(
  a: unknown
): a is AsyncNxComposableRspackPlugin {
  return a?.[nxRspackComposablePlugin] === true;
}

export interface NxRspackExecutionContext {
  options: NormalizedRspackExecutorSchema;
  context: ExecutorContext;
  configuration?: string;
}

export interface NxComposableRspackPlugin {
  (config: Configuration, ctx: NxRspackExecutionContext): Configuration;
}

export interface AsyncNxComposableRspackPlugin {
  (
    config: Configuration,
    ctx: NxRspackExecutionContext
  ): Configuration | Promise<Configuration>;
}

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
export function composePlugins(
  ..._plugins: (
    | NxComposableRspackPlugin
    | AsyncNxComposableRspackPlugin
    | Promise<NxComposableRspackPlugin | AsyncNxComposableRspackPlugin>
  )[]
) {
  warnRspackComposeHelpersDeprecation();
  return Object.assign(
    async (
      config: Configuration = {},
      ctx?: NxRspackExecutionContext
    ): Promise<Configuration> => {
      // Only the legacy Nx executor passes a config; CLIs pass (env, argv).
      return ctx?.context && typeof ctx.context === 'object' ? config : {};
    },
    { [nxRspackComposablePlugin]: true }
  );
}

/** @deprecated Removed in Nx v24. This inert stub only keeps old configs loadable. */
export function composePluginsSync(..._plugins: NxComposableRspackPlugin[]) {
  warnRspackComposeHelpersDeprecation();
  return Object.assign(
    (
      config: Configuration = {},
      ctx?: NxRspackExecutionContext
    ): Configuration => {
      // Only the legacy Nx executor passes a config; CLIs pass (env, argv).
      return ctx?.context && typeof ctx.context === 'object' ? config : {};
    },
    { [nxRspackComposablePlugin]: true }
  );
}
