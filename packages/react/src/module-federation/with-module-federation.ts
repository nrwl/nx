import { ModuleFederationConfig } from '@nx/webpack/src/utils/module-federation';
import { getModuleFederationConfig } from './utils';
import type { AsyncNxWebpackPlugin } from '@nx/webpack';
import ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

/**
 * @param {ModuleFederationConfig} options
 * @return {Promise<AsyncNxWebpackPlugin>}
 */
export async function withModuleFederation(
  options: ModuleFederationConfig
): Promise<AsyncNxWebpackPlugin> {
  const { sharedDependencies, sharedLibraries, mappedRemotes } =
    await getModuleFederationConfig(options);

  return (config, ctx) => {
    config.output.uniqueName = options.name;
    config.output.publicPath = 'auto';

    if (options.library?.type === 'var') {
      config.output.scriptType = 'text/javascript';
      config.experiments.outputModule = false;
    }

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
        /**
         * remoteType: 'script' is required for the remote to be loaded as a script tag.
         * remotes will need to be defined as:
         *  { appX: 'appX@http://localhost:3001/remoteEntry.js' }
         *  { appY: 'appY@http://localhost:3002/remoteEntry.js' }
         */
        ...(options.library?.type === 'var' ? { remoteType: 'script' } : {}),
      }),
      sharedLibraries.getReplacementPlugin()
    );

    return config;
  };
}
