import { ModuleFederationConfig } from '@nx/webpack/src/utils/module-federation';
import { getModuleFederationConfig } from './utils';
import type { AsyncNxComposableWebpackPlugin } from '@nx/webpack';
import ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

const isVarOrWindow = (libType?: string) => libType === 'var' || libType === 'window';

/**
 * @param {ModuleFederationConfig} options
 * @return {Promise<AsyncNxComposableWebpackPlugin>}
 */
export async function withModuleFederation(
  options: ModuleFederationConfig
): Promise<AsyncNxComposableWebpackPlugin> {
  const { sharedDependencies, sharedLibraries, mappedRemotes } =
    await getModuleFederationConfig(options);

  return (config, ctx) => {
    config.output.uniqueName = options.name;
    config.output.publicPath = 'auto';

    if (isVarOrWindow(options.library?.type)) {
      config.output.scriptType = 'text/javascript';
    }

    config.optimization = {
      runtimeChunk: false,
    };

    config.experiments = {
      ...config.experiments,
      outputModule: !isVarOrWindow(options.library?.type),
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
        ...(isVarOrWindow(options.library?.type) ? { remoteType: 'script' } : {}),
      }),
      sharedLibraries.getReplacementPlugin()
    );

    return config;
  };
}
