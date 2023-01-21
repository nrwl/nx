import { ExecutorContext } from '@nrwl/devkit';
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
  const configure = composePlugins(withNx(), withWeb());
  return configure(config, { options, context });
}

export type NxWebpackPlugin = (
  config: Configuration,
  ctx: {
    options: NormalizedWebpackExecutorOptions;
    context: ExecutorContext;
  }
) => Configuration;

export type NxWebpackPluginAsyncResolver = Promise<NxWebpackPlugin>;

export function composePlugins(
  ...plugins: (NxWebpackPlugin | NxWebpackPluginAsyncResolver)[]
) {
  return function combined(
    config: Configuration,
    ctx: {
      options: NormalizedWebpackExecutorOptions;
      context: ExecutorContext;
    }
  ): Configuration {
    for (const plugin of plugins) {
      if ('then' in plugin) {
        plugin.then((resolvedPlugin) => {
          config = resolvedPlugin(config, ctx);
        });
      } else {
        config = plugin(config, ctx);
      }
    }
    return config;
  };
}
