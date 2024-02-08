import { Configuration } from 'webpack';
import { NxComposableWebpackPlugin, NxWebpackExecutionContext } from './config';
import { applyBaseConfig } from '../plugins/nx-webpack-plugin/lib/apply-base-config';
import { NxWebpackPluginOptions } from '../plugins/nx-webpack-plugin/nx-webpack-plugin-options';
import { normalizeAssets } from '../plugins/nx-webpack-plugin/lib/normalize-options';

const processed = new Set();

export type WithNxOptions = Partial<NxWebpackPluginOptions>;

/**
 * @param {WithNxOptions} pluginOptions
 * @returns {NxWebpackPlugin}
 */
export function withNx(
  pluginOptions: WithNxOptions = {}
): NxComposableWebpackPlugin {
  return function configure(
    config: Configuration,
    { options, context }: NxWebpackExecutionContext
  ): Configuration {
    if (processed.has(config)) return config;

    applyBaseConfig(
      {
        ...options,
        ...pluginOptions,
        target: options.target ?? 'web',
        assets: options.assets
          ? options.assets
          : pluginOptions.assets
          ? normalizeAssets(
              pluginOptions.assets,
              options.root,
              options.sourceRoot
            )
          : [],
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
