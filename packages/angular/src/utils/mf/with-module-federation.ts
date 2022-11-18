import { ModuleFederationConfig } from '@nrwl/devkit';
import { getModuleFederationConfig } from './utils';
import { readCachedProjectConfiguration } from 'nx/src/project-graph/project-graph';
import ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

function determineRemoteUrl(remote: string) {
  const remoteProjectConfiguration = readCachedProjectConfiguration(remote);
  let publicHost = '';
  try {
    publicHost = remoteProjectConfiguration.targets.serve.options.publicHost;
  } catch (error) {
    throw new Error(
      `Cannot automatically determine URL of remote (${remote}). Looked for property "publicHost" in the project's "serve" target.\n
      You can also use the tuple syntax in your webpack config to configure your remotes. e.g. \`remotes: [['remote1', 'http://localhost:4201']]\``
    );
  }
  return `${
    publicHost.endsWith('/') ? publicHost.slice(0, -1) : publicHost
  }/remoteEntry.mjs`;
}

export async function withModuleFederation(options: ModuleFederationConfig) {
  const { sharedLibraries, sharedDependencies, mappedRemotes } =
    await getModuleFederationConfig(options, determineRemoteUrl);

  return (config) => ({
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
        name: options.name,
        filename: 'remoteEntry.mjs',
        exposes: options.exposes,
        remotes: mappedRemotes,
        shared: {
          ...sharedDependencies,
        },
        library: {
          type: 'module',
        },
      }),
      sharedLibraries.getReplacementPlugin(),
    ],
  });
}
