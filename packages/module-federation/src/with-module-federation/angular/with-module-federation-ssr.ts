import type {
  ModuleFederationConfig,
  NxModuleFederationConfigOverride,
} from '../../utils';
import { getModuleFederationConfig } from './utils';

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
    const updatedConfig = {
      ...(config ?? {}),
      target: 'async-node',
      output: {
        ...(config.output ?? {}),
        uniqueName: options.name,
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
      plugins: [
        ...(config.plugins ?? []),
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
             * Apply user-defined config override
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
                    require.resolve('@module-federation/node/runtimePlugin'),
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
