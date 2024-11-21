import type {
  ModuleFederationConfig,
  NxModuleFederationConfigOverride,
} from '../../utils';
import { getModuleFederationConfig } from './utils';
import { ModuleFederationPlugin } from '@module-federation/enhanced/webpack';

export async function withModuleFederation(
  options: ModuleFederationConfig,
  configOverride?: NxModuleFederationConfigOverride
) {
  if (global.NX_GRAPH_CREATION) {
    return (config) => config;
  }

  const { sharedLibraries, sharedDependencies, mappedRemotes } =
    await getModuleFederationConfig(options);

  return (config) => {
    const updatedConfig = {
      ...(config ?? {}),
      output: {
        ...(config.output ?? {}),
        uniqueName: options.name,
        publicPath: 'auto',
      },
      optimization: {
        ...(config.optimization ?? {}),
        runtimeChunk: false,
      },
      resolve: {
        ...(config.resolve ?? {}),
        alias: {
          ...(config.resolve?.alias ?? {}),
          ...sharedLibraries.getAliases(),
        },
      },
      experiments: {
        ...(config.experiments ?? {}),
        outputModule: true,
      },
      plugins: [
        ...(config.plugins ?? []),
        new ModuleFederationPlugin({
          name: options.name.replace(/-/g, '_'),
          filename: 'remoteEntry.mjs',
          exposes: options.exposes,
          remotes: mappedRemotes,
          shared: {
            ...sharedDependencies,
          },
          library: {
            type: 'module',
          },
          /**
           * Apply user-defined config override
           */
          ...(configOverride ? configOverride : {}),
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
          virtualRuntimeEntry: true,
        }),
        sharedLibraries.getReplacementPlugin(),
      ],
    };

    // The env var is only set from the module-federation-dev-server
    // Attach the runtime plugin
    updatedConfig.plugins.push(
      new (require('webpack').DefinePlugin)({
        'process.env.NX_MF_DEV_REMOTES': process.env.NX_MF_DEV_REMOTES,
      })
    );

    return updatedConfig;
  };
}
