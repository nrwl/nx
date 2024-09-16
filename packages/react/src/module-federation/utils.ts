import {
  applyAdditionalShared,
  applySharedFunction,
  getDependentPackagesForProject,
  mapRemotes,
  mapRemotesForSSR,
  ModuleFederationConfig,
  sharePackages,
  shareWorkspaceLibraries,
} from '@nx/webpack/src/utils/module-federation';

import {
  createProjectGraphAsync,
  ProjectGraph,
  readCachedProjectGraph,
} from '@nx/devkit';
import { readCachedProjectConfiguration } from 'nx/src/project-graph/project-graph';

export function getFunctionDeterminateRemoteUrl(isServer: boolean = false) {
  const target = 'serve';
  const remoteEntry = isServer ? 'server/remoteEntry.js' : 'remoteEntry.js';

  return function (remote: string) {
    const mappedStaticRemotesFromEnv = process.env
      .NX_MF_DEV_SERVER_STATIC_REMOTES
      ? JSON.parse(process.env.NX_MF_DEV_SERVER_STATIC_REMOTES)
      : undefined;
    if (mappedStaticRemotesFromEnv && mappedStaticRemotesFromEnv[remote]) {
      return `${mappedStaticRemotesFromEnv[remote]}/${remoteEntry}`;
    }

    let remoteConfiguration = null;
    try {
      remoteConfiguration = readCachedProjectConfiguration(remote);
    } catch (e) {
      throw new Error(
        `Cannot find remote: "${remote}". Check that the remote name is correct in your module federation config file.\n`
      );
    }
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
    ...sharedLibraries.getLibraries(project.root),
    ...npmPackages,
  };

  applySharedFunction(sharedDependencies, mfConfig.shared);
  applyAdditionalShared(
    sharedDependencies,
    mfConfig.additionalShared,
    projectGraph
  );

  // Choose the correct mapRemotes function based on the server state.
  const mapRemotesFunction = options.isServer ? mapRemotesForSSR : mapRemotes;

  // Determine the URL function, either from provided options or by using a default.
  const determineRemoteUrlFunction = options.determineRemoteUrl
    ? options.determineRemoteUrl
    : getFunctionDeterminateRemoteUrl(options.isServer);

  // Map the remotes if they exist, otherwise default to an empty object.
  let mappedRemotes = {};

  if (mfConfig.remotes && mfConfig.remotes.length > 0) {
    const isLibraryTypeVar = mfConfig.library?.type === 'var';
    mappedRemotes = mapRemotesFunction(
      mfConfig.remotes,
      'js',
      determineRemoteUrlFunction,
      true
    );
  }

  return { sharedLibraries, sharedDependencies, mappedRemotes };
}
