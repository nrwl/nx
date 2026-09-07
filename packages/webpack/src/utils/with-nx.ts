import type { Configuration } from 'webpack';
import { NxComposableWebpackPlugin, NxWebpackExecutionContext } from './config';
import { NxAppWebpackPluginOptions } from '../plugins/nx-webpack-plugin/nx-app-webpack-plugin-options';
import { normalizeAssets } from '../plugins/nx-webpack-plugin/lib/normalize-options';
import { warnWebpackComposeHelpersDeprecation } from './deprecation';

const processed = new Set();

export type WithNxOptions = Partial<NxAppWebpackPluginOptions>;

/**
 * @deprecated Will be removed in Nx v24. Use `NxAppWebpackPlugin` from
 * `@nx/webpack/app-plugin` in a standard webpack config and run
 * `nx g @nx/webpack:convert-to-inferred`. See
 * https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.
 * @param {WithNxOptions} pluginOptions
 * @returns {NxWebpackPlugin}
 */
export function withNx(
  pluginOptions: WithNxOptions = {}
): NxComposableWebpackPlugin {
  warnWebpackComposeHelpersDeprecation();
  return function configure(
    config: Configuration,
    { options, context }: NxWebpackExecutionContext
  ): Configuration {
    if (processed.has(config)) return config;

    // Lazy-required so importing this module does not load the webpack bundler.
    const { applyBaseConfig } =
      require('../plugins/nx-webpack-plugin/lib/apply-base-config') as typeof import('../plugins/nx-webpack-plugin/lib/apply-base-config');

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
                options.sourceRoot,
                options.projectRoot
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
