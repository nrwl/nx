import { ModuleFederationConfig } from '@nx/devkit';
import { getModuleFederationConfig } from './utils';
import ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
import type { AsyncNxWebpackPlugin } from '@nx/webpack';

/**
 * @param {ModuleFederationConfig} options
 * @return {Promise<AsyncNxWebpackPlugin>}
 */
export async function withModuleFederation(
  options: ModuleFederationConfig
): Promise<AsyncNxWebpackPlugin> {
  const reactWebpackConfig = require('../../plugins/webpack');

  const { sharedDependencies, sharedLibraries, mappedRemotes } =
    await getModuleFederationConfig(options);

  return (config, ctx) => {
    config = reactWebpackConfig(config, ctx);
    config.output.uniqueName = options.name;
    config.output.publicPath = 'auto';

    config.optimization = {
      runtimeChunk: false,
    };

    config.experiments = {
      ...config.experiments,
      outputModule: true,
    };

    config.plugins.push(
      new ModuleFederationPlugin({
        name: options.name,
        library: options.library ?? { type: 'module' },
        filename: 'remoteEntry.js',
        exposes: options.exposes,
        remotes: mappedRemotes,
        shared: {
          ...sharedDependencies,
        },
      }),
      sharedLibraries.getReplacementPlugin()
    );

    return config;
  };
}
