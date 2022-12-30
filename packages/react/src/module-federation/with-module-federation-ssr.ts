import { ModuleFederationConfig } from '@nrwl/devkit';
import { readCachedProjectConfiguration } from 'nx/src/project-graph/project-graph';
import { getModuleFederationConfig } from './utils';

function determineRemoteUrl(remote: string) {
  const remoteConfiguration = readCachedProjectConfiguration(remote);
  const serveTarget = remoteConfiguration?.targets?.['serve-server'];

  if (!serveTarget) {
    throw new Error(
      `Cannot automatically determine URL of remote (${remote}). Looked for property "host" in the project's "serve-server" target.\n
      You can also use the tuple syntax in your webpack config to configure your remotes. e.g. \`remotes: [['remote1', 'http://localhost:4201']]\``
    );
  }

  const host = serveTarget.options?.host ?? 'http://localhost';
  const port = serveTarget.options?.port ?? 4201;
  return `${
    host.endsWith('/') ? host.slice(0, -1) : host
  }:${port}/server/remoteEntry.js`;
}

export async function withModuleFederationForSSR(
  options: ModuleFederationConfig
) {
  const reactWebpackConfig = require('../../plugins/webpack');

  const { sharedLibraries, sharedDependencies, mappedRemotes } =
    await getModuleFederationConfig(options, determineRemoteUrl, {
      isServer: true,
    });

  return (config) => {
    config = reactWebpackConfig(config);

    config.target = false;
    config.output.uniqueName = options.name;
    config.optimization = {
      runtimeChunk: false,
    };

    config.plugins.push(
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
      sharedLibraries.getReplacementPlugin()
    );

    return config;
  };
}
