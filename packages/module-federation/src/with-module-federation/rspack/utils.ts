import {
  createProjectGraphAsync,
  ProjectGraph,
  readCachedProjectGraph,
} from '@nx/devkit';
import {
  ModuleFederationConfig,
  applyAdditionalShared,
  applySharedFunction,
  sharePackages,
  shareWorkspaceLibraries,
  mapRemotes,
  mapRemotesForSSR,
  getDependentPackagesForProject,
} from '../../utils';
import { createRemoteUrlResolver } from '../../utils/remote-url';
import { applyDefaultEagerPackages as applyReactEagerPackages } from '../react/utils';
import { isReactProject } from '../../utils/framework-detection';

export function getFunctionDeterminateRemoteUrl(isServer = false) {
  return createRemoteUrlResolver({ isServer, bundler: 'rspack' });
}

export function getModuleFederationConfig(
  mfConfig: ModuleFederationConfig,
  options: {
    isServer: boolean;
    determineRemoteUrl?: (remote: string) => string;
  } = { isServer: false }
) {
  const projectGraph = readCachedProjectGraph();

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

  // Apply framework-specific eager packages
  if (isReactProject(mfConfig.name, projectGraph)) {
    applyReactEagerPackages(sharedDependencies);
  }

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
    mappedRemotes = mapRemotesFunction(
      mfConfig.remotes,
      'js',
      determineRemoteUrlFunction,
      true
    );
  }

  return { sharedLibraries, sharedDependencies, mappedRemotes };
}
