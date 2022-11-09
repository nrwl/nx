import {
  applyAdditionalShared,
  applySharedFunction,
  createProjectGraphAsync,
  getDependentPackagesForProject,
  mapRemotes,
  ModuleFederationConfig,
  ProjectConfiguration,
  ProjectGraph,
  readCachedProjectGraph,
  sharePackages,
  shareWorkspaceLibraries,
} from '@nrwl/devkit';
import { readCachedProjectConfiguration } from 'nx/src/project-graph/project-graph';
import ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

function determineRemoteUrl(remote: string) {
  const remoteConfiguration = readCachedProjectConfiguration(remote);
  const serveTarget = remoteConfiguration?.targets?.serve;

  if (!serveTarget) {
    throw new Error(
      `Cannot automatically determine URL of remote (${remote}). Looked for property "host" in the project's "serve" target.\n
      You can also use the tuple syntax in your webpack config to configure your remotes. e.g. \`remotes: [['remote1', '//localhost:4201']]\``
    );
  }

  const host = serveTarget.options?.host ?? '//localhost';
  const port = serveTarget.options?.port ?? 4201;
  return `${
    host.endsWith('/') ? host.slice(0, -1) : host
  }:${port}/remoteEntry.js`;
}

export async function withModuleFederation(options: ModuleFederationConfig) {
  const reactWebpackConfig = require('../../plugins/webpack');
  let projectGraph: ProjectGraph<ProjectConfiguration>;
  try {
    projectGraph = readCachedProjectGraph();
  } catch (e) {
    projectGraph = await createProjectGraphAsync();
  }

  const project = projectGraph.nodes[options.name]?.data;

  if (!project) {
    throw Error(
      `Cannot find project "${options.name}". Check that the name is correct in module-federation.config.js`
    );
  }

  const dependencies = getDependentPackagesForProject(
    projectGraph,
    options.name
  );
  const sharedLibraries = shareWorkspaceLibraries(
    dependencies.workspaceLibraries
  );

  const npmPackages = sharePackages(dependencies.npmPackages);

  const sharedDependencies = {
    ...sharedLibraries.getLibraries(),
    ...npmPackages,
  };

  applySharedFunction(sharedDependencies, options.shared);
  applyAdditionalShared(
    sharedDependencies,
    options.additionalShared,
    projectGraph
  );

  return (config) => {
    config = reactWebpackConfig(config);
    config.output.uniqueName = options.name;
    config.output.publicPath = 'auto';

    config.optimization = {
      runtimeChunk: false,
    };

    config.experiments = {
      ...config.experiments,
      outputModule: true,
    };

    const mappedRemotes =
      !options.remotes || options.remotes.length === 0
        ? {}
        : mapRemotes(options.remotes, 'js', determineRemoteUrl);

    config.plugins.push(
      new ModuleFederationPlugin({
        name: options.name,
        library: {
          type: 'module',
        },
        filename: 'remoteEntry.js',
        exposes: options.exposes,
        remotes: mappedRemotes,
        shared: {
          ...sharedDependencies,
        },
      }),
      sharedLibraries.getReplacementPlugin()
    );

    return config;
  };
}
