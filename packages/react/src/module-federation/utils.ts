import {
  applyAdditionalShared,
  applySharedFunction,
  createProjectGraphAsync,
  getDependentPackagesForProject,
  mapRemotes,
  mapRemotesForSSR,
  ModuleFederationConfig,
  ProjectConfiguration,
  ProjectGraph,
  readCachedProjectGraph,
  sharePackages,
  shareWorkspaceLibraries,
} from '@nrwl/devkit';

export async function getModuleFederationConfig(
  mfConfig: ModuleFederationConfig,
  determineRemoteUrl: (remote: string) => string,
  options: { isServer: boolean } = { isServer: false }
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
  const mappedRemotes =
    !mfConfig.remotes || mfConfig.remotes.length === 0
      ? {}
      : mapRemotesFunction(mfConfig.remotes, 'js', determineRemoteUrl);

  return { sharedLibraries, sharedDependencies, mappedRemotes };
}
