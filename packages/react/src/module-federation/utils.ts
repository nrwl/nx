import {
  applyAdditionalShared,
  applySharedFunction,
  getDependentPackagesForProject,
  mapRemotes,
  mapRemotesForSSR,
  ModuleFederationConfig,
  sharePackages,
  shareWorkspaceLibraries,
} from '@nx/devkit/src/utils/module-federation';

import {
  createProjectGraphAsync,
  ProjectGraph,
  readCachedProjectGraph,
} from '@nx/devkit';
import { readCachedProjectConfiguration } from 'nx/src/project-graph/project-graph';

export function getFunctionDeterminateRemoteUrl(isServer: boolean = false) {
  const target = isServer ? 'serve-server' : 'serve';
  const remoteEntry = isServer ? 'server/remoteEntry.js' : 'remoteEntry.js';

  return function (remote: string) {
    const remoteConfiguration = readCachedProjectConfiguration(remote);
    const serveTarget = remoteConfiguration?.targets?.[target];

    if (!serveTarget) {
      throw new Error(
        `Cannot automatically determine URL of remote (${remote}). Looked for property "host" in the project's "${serveTarget}" target.\n
      You can also use the tuple syntax in your webpack config to configure your remotes. e.g. \`remotes: [['remote1', 'http://localhost:4201']]\``
      );
    }

    const host =
      serveTarget.options?.host ??
      `http${serveTarget.options.ssl ? 's' : ''}://localhost`;
    const port = serveTarget.options?.port ?? 4201;
    return `${
      host.endsWith('/') ? host.slice(0, -1) : host
    }:${port}/${remoteEntry}`;
  };
}

export async function getModuleFederationConfig(
  mfConfig: ModuleFederationConfig,
  options: {
    isServer: boolean;
    determineRemoteUrl?: (remote: string) => string;
  } = { isServer: false }
) {
  let projectGraph: ProjectGraph;
  try {
    projectGraph = readCachedProjectGraph();
  } catch (e) {
    projectGraph = await createProjectGraphAsync();
  }

  const project = projectGraph.nodes[mfConfig.name]?.data;

  if (!project) {
    throw Error(
      `Cannot find project "${mfConfig.name}". Check that the name is correct in module-federation.config.js`
    );
  }

  const dependencies = getDependentPackagesForProject(
    projectGraph,
    mfConfig.name
  );

  if (mfConfig.shared) {
    dependencies.workspaceLibraries = dependencies.workspaceLibraries.filter(
      (lib) => mfConfig.shared(lib.importKey, {}) !== false
    );
    dependencies.npmPackages = dependencies.npmPackages.filter(
      (pkg) => mfConfig.shared(pkg, {}) !== false
    );
  }

  const sharedLibraries = shareWorkspaceLibraries(
    dependencies.workspaceLibraries
  );

  const npmPackages = sharePackages(dependencies.npmPackages);

  const sharedDependencies = {
    ...sharedLibraries.getLibraries(),
    ...npmPackages,
  };

  applySharedFunction(sharedDependencies, mfConfig.shared);
  applyAdditionalShared(
    sharedDependencies,
    mfConfig.additionalShared,
    projectGraph
  );

  const mapRemotesFunction = options.isServer ? mapRemotesForSSR : mapRemotes;
  const determineRemoteUrlFn =
    options.determineRemoteUrl ||
    getFunctionDeterminateRemoteUrl(options.isServer);
  const mappedRemotes =
    !mfConfig.remotes || mfConfig.remotes.length === 0
      ? {}
      : mapRemotesFunction(mfConfig.remotes, 'js', determineRemoteUrlFn);

  return { sharedLibraries, sharedDependencies, mappedRemotes };
}
