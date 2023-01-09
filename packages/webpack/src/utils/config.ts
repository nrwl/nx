import { Configuration } from 'webpack';
import { ExecutorContext } from '@nrwl/devkit';

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
  ctx?: {
    options: NormalizedWebpackExecutorOptions;
    context?: ExecutorContext;
  }
) => Configuration;

export function composePlugins(...plugins: NxWebpackPlugin[]) {
  return function combined(
    config: Configuration,
    ctx?: {
      options: NormalizedWebpackExecutorOptions;
      context?: ExecutorContext;
    }
  ): Configuration {
    for (const plugin of plugins) {
      config = plugin(config, ctx);
    }
    return config;
  };
}
