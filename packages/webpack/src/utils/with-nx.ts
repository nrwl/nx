import { Configuration } from 'webpack';
import { NxWebpackExecutionContext, NxWebpackPlugin } from './config';
import { applyBaseConfig } from '../plugins/nx-webpack-plugin/lib/apply-base-config';

const processed = new Set();

export interface WithNxOptions {
  skipTypeChecking?: boolean;
}

/**
 * @param {WithNxOptions} pluginOptions
 * @returns {NxWebpackPlugin}
 */
export function withNx(pluginOptions?: WithNxOptions): NxWebpackPlugin {
  return function configure(
    config: Configuration,
    { options, context }: NxWebpackExecutionContext
  ): Configuration {
    if (processed.has(config)) return config;

    applyBaseConfig(
      {
        ...options,
        ...pluginOptions,
        root: context.root,
        projectName: context.projectName,
        targetName: context.targetName,
        configurationName: context.configurationName,
        projectGraph: context.projectGraph,
      },
      config
    );

    processed.add(config);
    return config;
  };
}
