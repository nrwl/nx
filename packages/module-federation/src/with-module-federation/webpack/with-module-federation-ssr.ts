import {
  ModuleFederationConfig,
  NxModuleFederationConfigOverride,
} from '../../utils';
import { getModuleFederationConfig } from './utils';
import type { NormalModuleReplacementPlugin } from 'webpack';

export async function withModuleFederationForSSR(
  options: ModuleFederationConfig,
  configOverride?: NxModuleFederationConfigOverride
) {
  if (global.NX_GRAPH_CREATION) {
    return (config) => config;
  }

  const { sharedLibraries, sharedDependencies, mappedRemotes } =
    await getModuleFederationConfig(options, {
      isServer: true,
    });

  return (config) => {
    config.target = 'async-node';
    config.output.uniqueName = options.name;
    config.optimization = {
      ...(config.optimization ?? {}),
      runtimeChunk: false,
    };

    config.plugins.push(
      new (require('@module-federation/enhanced').ModuleFederationPlugin)(
        {
          name: options.name.replace(/-/g, '_'),
          filename: 'remoteEntry.js',
          exposes: options.exposes,
          remotes: mappedRemotes,
          shared: {
            ...sharedDependencies,
          },
          remoteType: 'script',
          library: {
            type: 'commonjs-module',
          },
          /**
           * Apply user-defined config overrides
           */
          ...(configOverride ? configOverride : {}),
          experiments: {
            federationRuntime: 'hoisted',
            // We should allow users to override federationRuntime
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
              : [
                  ...(configOverride?.runtimePlugins ?? []),
                  require.resolve('@module-federation/node/runtimePlugin'),
                ],
          virtualRuntimeEntry: true,
        },
        {}
      ),
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
