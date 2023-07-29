import { ExecutorContext } from '@nx/devkit';
import { Configuration } from 'webpack';

import { NormalizedWebpackExecutorOptions } from '../executors/webpack/schema';
import { withNx } from './with-nx';
import { withWeb } from './with-web';

/** @deprecated use withNx and withWeb plugins directly */
export function getBaseWebpackPartial(
  options: NormalizedWebpackExecutorOptions,
  context?: ExecutorContext
): Configuration {
  const config: Configuration = {};
  const configure = composePluginsSync(withNx(), withWeb());
  return configure(config, { options, context });
}

export interface NxWebpackExecutionContext {
  options: NormalizedWebpackExecutorOptions;
  context: ExecutorContext;
}

export interface NxWebpackPlugin {
  (config: Configuration, ctx: NxWebpackExecutionContext): Configuration;
}
export interface AsyncNxWebpackPlugin {
  (config: Configuration, ctx: NxWebpackExecutionContext):
    | Configuration
    | Promise<Configuration>;
}

export function composePlugins(
  ...plugins: (
    | NxWebpackPlugin
    | AsyncNxWebpackPlugin
    | Promise<NxWebpackPlugin | AsyncNxWebpackPlugin>
  )[]
) {
  return async function combined(
    config: Configuration,
    ctx: NxWebpackExecutionContext
  ): Promise<Configuration> {
    for (const plugin of plugins) {
      const fn = await plugin;
      config = await fn(config, ctx);
    }
    return config;
  };
}

export function composePluginsSync(...plugins: NxWebpackPlugin[]) {
  return function combined(
    config: Configuration,
    ctx: NxWebpackExecutionContext
  ): Configuration {
    for (const plugin of plugins) {
      config = plugin(config, ctx);
    }
    return config;
  };
}
