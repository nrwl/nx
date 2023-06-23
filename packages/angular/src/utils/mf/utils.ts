import {
  applyAdditionalShared,
  applySharedFunction,
  getDependentPackagesForProject,
  mapRemotes,
  mapRemotesForSSR,
  ModuleFederationConfig,
  SharedLibraryConfig,
  sharePackages,
  shareWorkspaceLibraries,
} from '@nx/devkit/src/utils/module-federation';

import {
  createProjectGraphAsync,
  ProjectGraph,
  readCachedProjectGraph,
} from '@nx/devkit';
import { readCachedProjectConfiguration } from 'nx/src/project-graph/project-graph';

export function applyDefaultEagerPackages(
  sharedConfig: Record<string, SharedLibraryConfig>
) {
  const DEFAULT_PACKAGES_TO_LOAD_EAGERLY = [
    '@angular/localize',
    '@angular/localize/init',
  ];
  for (const pkg of DEFAULT_PACKAGES_TO_LOAD_EAGERLY) {
    if (!sharedConfig[pkg]) {
      continue;
    }

    sharedConfig[pkg] = { ...sharedConfig[pkg], eager: true };
  }
}

export const DEFAULT_NPM_PACKAGES_TO_AVOID = [
  'zone.js',
  '@nx/angular/mf',
  '@nrwl/angular/mf',
];
export const DEFAULT_ANGULAR_PACKAGES_TO_SHARE = [
  '@angular/animations',
  '@angular/common',
];

export function getFunctionDeterminateRemoteUrl(isServer: boolean = false) {
  const target = 'serve';
  const remoteEntry = isServer ? 'server/remoteEntry.js' : 'remoteEntry.mjs';

  return function (remote: string) {
    const remoteConfiguration = readCachedProjectConfiguration(remote);
    const serveTarget = remoteConfiguration?.targets?.[target];

    if (!serveTarget) {
      throw new Error(
        `Cannot automatically determine URL of remote (${remote}). Looked for property "host" in the project's "serve" target.\n
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

  if (!projectGraph.nodes[mfConfig.name]?.data) {
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

  const npmPackages = sharePackages(
    Array.from(
      new Set([
        ...DEFAULT_ANGULAR_PACKAGES_TO_SHARE,
        ...dependencies.npmPackages.filter(
          (pkg) => !DEFAULT_NPM_PACKAGES_TO_AVOID.includes(pkg)
        ),
      ])
    )
  );

  DEFAULT_NPM_PACKAGES_TO_AVOID.forEach((pkgName) => {
    if (pkgName in npmPackages) {
      delete npmPackages[pkgName];
    }
  });

  const sharedDependencies = {
    ...sharedLibraries.getLibraries(),
    ...npmPackages,
  };

  applyDefaultEagerPackages(sharedDependencies);
  applySharedFunction(sharedDependencies, mfConfig.shared);
  applyAdditionalShared(
    sharedDependencies,
    mfConfig.additionalShared,
    projectGraph
  );
  const determineRemoteUrlFn =
    options.determineRemoteUrl ||
    getFunctionDeterminateRemoteUrl(options.isServer);

  const mapRemotesFunction = options.isServer ? mapRemotesForSSR : mapRemotes;
  const mappedRemotes =
    !mfConfig.remotes || mfConfig.remotes.length === 0
      ? {}
      : mapRemotesFunction(mfConfig.remotes, 'mjs', determineRemoteUrlFn);
  return { sharedLibraries, sharedDependencies, mappedRemotes };
}
