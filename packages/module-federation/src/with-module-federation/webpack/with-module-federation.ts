import {
  ModuleFederationConfig,
  normalizeProjectName,
  NxModuleFederationConfigOverride,
} from '../../utils';
import { getModuleFederationConfig } from './utils';
import { ModuleFederationPlugin } from '@module-federation/enhanced/webpack';
import type { NormalModuleReplacementPlugin } from 'webpack';

/**
 * @param {ModuleFederationConfig} options
 */
export async function withModuleFederation(
  options: ModuleFederationConfig,
  configOverride?: NxModuleFederationConfigOverride
) {
  if (global.NX_GRAPH_CREATION) {
    return (config) => config;
  }
  const isDevServer = process.env['WEBPACK_SERVE'];

  const { sharedDependencies, sharedLibraries, mappedRemotes } =
    await getModuleFederationConfig(options, undefined, 'webpack');

  return (config, ctx) => {
    config.output.uniqueName = options.name;
    config.output.publicPath = 'auto';

    config.output.scriptType = 'text/javascript';
    config.optimization = {
      ...(config.optimization ?? {}),
      runtimeChunk:
        isDevServer && !options.exposes
          ? config.optimization?.runtimeChunk ?? undefined
          : false,
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
        name: normalizeProjectName(options.name),
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
        experiments: {
          asyncStartup: true,
          // We should allow users to override experiments
          ...(configOverride?.experiments ?? {}),
        },
        runtimePlugins:
          process.env.NX_MF_DEV_REMOTES &&
          !options.disableNxRuntimeLibraryControlPlugin
            ? [
                ...(configOverride?.runtimePlugins ?? []),
                require.resolve(
                  '@nx/module-federation/src/utils/plugins/runtime-library-control.plugin.js'
                ),
              ]
            : configOverride?.runtimePlugins,
      }),
      sharedLibraries.getReplacementPlugin() as NormalModuleReplacementPlugin
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
