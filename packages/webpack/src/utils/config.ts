import type { ExecutorContext } from '@nx/devkit';
import type { Configuration } from 'webpack';
import type { NormalizedWebpackExecutorOptions } from '../executors/webpack/schema';
import { warnWebpackComposeHelpersDeprecation } from './deprecation';

export const nxWebpackComposablePlugin = 'nxWebpackComposablePlugin';

export function isNxWebpackComposablePlugin(
  a: unknown
): a is AsyncNxComposableWebpackPlugin {
  return a?.[nxWebpackComposablePlugin] === true;
}

export interface NxWebpackExecutionContext {
  options: NormalizedWebpackExecutorOptions;
  context: ExecutorContext;
  configuration?: string;
}

export interface NxComposableWebpackPlugin {
  (config: Configuration, ctx: NxWebpackExecutionContext): Configuration;
}

export interface AsyncNxComposableWebpackPlugin {
  (
    config: Configuration,
    ctx: NxWebpackExecutionContext
  ): Configuration | Promise<Configuration>;
}

// TODO(v25): remove the inert config-helper stubs in this file.
/**
 * @deprecated Use `NxAppWebpackPlugin` from `@nx/webpack/app-plugin`.
 * This inert stub will be removed in Nx v25.
 */
export function composePlugins(
  ..._plugins: (
    | NxComposableWebpackPlugin
    | AsyncNxComposableWebpackPlugin
    | Promise<NxComposableWebpackPlugin | AsyncNxComposableWebpackPlugin>
  )[]
) {
  warnWebpackComposeHelpersDeprecation();
  return Object.assign(
    async (
      config: Configuration = {},
      ctx?: NxWebpackExecutionContext
    ): Promise<Configuration> => {
      // Only the legacy Nx executor passes a config; CLIs pass (env, argv).
      return ctx?.context && typeof ctx.context === 'object' ? config : {};
    },
    { [nxWebpackComposablePlugin]: true }
  );
}

/**
 * @deprecated Use `NxAppWebpackPlugin` from `@nx/webpack/app-plugin`.
 * This inert stub will be removed in Nx v25.
 */
export function composePluginsSync(..._plugins: NxComposableWebpackPlugin[]) {
  warnWebpackComposeHelpersDeprecation();
  return Object.assign(
    (
      config: Configuration = {},
      ctx?: NxWebpackExecutionContext
    ): Configuration => {
      // Only the legacy Nx executor passes a config; CLIs pass (env, argv).
      return ctx?.context && typeof ctx.context === 'object' ? config : {};
    },
    { [nxWebpackComposablePlugin]: true }
  );
}
