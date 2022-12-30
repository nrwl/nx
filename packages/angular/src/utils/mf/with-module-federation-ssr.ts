import { readCachedProjectConfiguration } from 'nx/src/project-graph/project-graph';
import { ModuleFederationConfig } from '@nrwl/devkit';
import { getModuleFederationConfig } from './utils';

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
  }/server/remoteEntry.js`;
}

export async function withModuleFederationForSSR(
  options: ModuleFederationConfig
) {
  const { sharedLibraries, sharedDependencies, mappedRemotes } =
    await getModuleFederationConfig(options, determineRemoteUrl, {
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
