import { ModuleFederationConfig } from '@nx/webpack/src/utils/module-federation';
import { getModuleFederationConfig } from './utils';

export async function withModuleFederationForSSR(
  options: ModuleFederationConfig
) {
  if (global.NX_GRAPH_CREATION) {
    return (config) => config;
  }
  const { sharedLibraries, sharedDependencies, mappedRemotes } =
    await getModuleFederationConfig(options, {
      isServer: true,
    });

  return (config) => ({
    ...(config ?? {}),
    target: false,
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
      new (require('@module-federation/node').UniversalFederationPlugin)(
        {
          name: options.name,
          filename: 'remoteEntry.js',
          exposes: options.exposes,
          remotes: mappedRemotes,
          shared: {
            ...sharedDependencies,
          },
          library: {
            type: 'commonjs-module',
          },
          isServer: true,
        },
        {}
      ),
      sharedLibraries.getReplacementPlugin(),
    ],
  });
}
