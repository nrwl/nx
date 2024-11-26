import {
  ModuleFederationConfig,
  NxModuleFederationConfigOverride,
} from '@nx/webpack/src/utils/module-federation';
import { getModuleFederationConfig } from './utils';
import type { AsyncNxComposableWebpackPlugin } from '@nx/webpack';
import { ModuleFederationPlugin } from '@module-federation/enhanced/webpack';

/**
 * @param {ModuleFederationConfig} options
 * @return {Promise<AsyncNxComposableWebpackPlugin>}
 */
export async function withModuleFederation(
  options: ModuleFederationConfig,
  configOverride?: NxModuleFederationConfigOverride
): Promise<AsyncNxComposableWebpackPlugin> {
  if (global.NX_GRAPH_CREATION) {
    return (config) => config;
  }

  const { sharedDependencies, sharedLibraries, mappedRemotes } =
    await getModuleFederationConfig(options);

  return (config, ctx) => {
    config.output.uniqueName = options.name;
    config.output.publicPath = 'auto';

    config.output.scriptType = 'text/javascript';
    config.optimization = {
      ...(config.optimization ?? {}),
      runtimeChunk: false,
    };

    if (
      config.mode === 'development' &&
      Object.keys(mappedRemotes).length > 1 &&
      !options.exposes
    ) {
      config.optimization.runtimeChunk = 'single';
    }

    config.plugins.push(
      new ModuleFederationPlugin({
        name: options.name.replace(/-/g, '_'),
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
        remoteType: 'script',
        /**
         * Apply user-defined config overrides
         */
        ...(configOverride ? configOverride : {}),
        runtimePlugins:
          process.env.NX_MF_DEV_REMOTES &&
          !options.disableNxRuntimeLibraryControlPlugin
            ? [
                ...(configOverride?.runtimePlugins ?? []),
                require.resolve(
                  '@nx/webpack/src/utils/module-federation/plugins/runtime-library-control.plugin.js'
                ),
              ]
            : configOverride?.runtimePlugins,
        virtualRuntimeEntry: true,
      }),
      sharedLibraries.getReplacementPlugin()
    );

    // The env var is only set from the module-federation-dev-server
    // Attach the runtime plugin
    config.plugins.push(
      new (require('webpack').DefinePlugin)({
        'process.env.NX_MF_DEV_REMOTES': process.env.NX_MF_DEV_REMOTES,
      })
    );

    return config;
  };
}
