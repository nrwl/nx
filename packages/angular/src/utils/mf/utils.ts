import {
  applyAdditionalShared,
  applySharedFunction,
  createProjectGraphAsync,
  getDependentPackagesForProject,
  mapRemotes,
  mapRemotesForSSR,
  ModuleFederationConfig,
  ProjectGraph,
  readCachedProjectGraph,
  SharedLibraryConfig,
  sharePackages,
  shareWorkspaceLibraries,
} from '@nrwl/devkit';

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

export const DEFAULT_NPM_PACKAGES_TO_AVOID = ['zone.js', '@nrwl/angular/mf'];
export const DEFAULT_ANGULAR_PACKAGES_TO_SHARE = [
  '@angular/animations',
  '@angular/common',
];

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
      (lib) => mfConfig.shared(lib.name, {})
    );
    dependencies.npmPackages = dependencies.npmPackages.filter((pkg) =>
      mfConfig.shared(pkg, {})
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

  const mapRemotesFunction = options.isServer ? mapRemotesForSSR : mapRemotes;
  const mappedRemotes =
    !mfConfig.remotes || mfConfig.remotes.length === 0
      ? {}
      : mapRemotesFunction(mfConfig.remotes, 'mjs', determineRemoteUrl);
  return { sharedLibraries, sharedDependencies, mappedRemotes };
}
