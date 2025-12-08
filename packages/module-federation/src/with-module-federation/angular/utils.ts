import {
  applyAdditionalShared,
  applySharedFunction,
  getDependentPackagesForProject,
  mapRemotes,
  mapRemotesForSSR,
  ModuleFederationConfig,
  normalizeProjectName,
  SharedLibraryConfig,
  sharePackages,
  shareWorkspaceLibraries,
} from '../../utils';
import { createRemoteUrlResolver } from '../../utils/remote-url';

import {
  createProjectGraphAsync,
  ProjectGraph,
  readCachedProjectGraph,
} from '@nx/devkit';

export function applyDefaultEagerPackages(
  sharedConfig: Record<string, SharedLibraryConfig>,
  useRspack = false
) {
  const DEFAULT_PACKAGES_TO_LOAD_EAGERLY = [
    '@angular/localize',
    '@angular/localize/init',
    ...(useRspack
      ? [
          '@angular/core',
          '@angular/core/primitives/signals',
          '@angular/core/primitives/di',
          '@angular/core/event-dispatch',
          '@angular/core/rxjs-interop',
          '@angular/common',
          '@angular/common/http',
          '@angular/platform-browser',
        ]
      : []),
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
  '@nx/angular-rspack',
];
export const DEFAULT_ANGULAR_PACKAGES_TO_SHARE = [
  '@angular/core',
  '@angular/animations',
  '@angular/common',
];

export function getFunctionDeterminateRemoteUrl(
  isServer: boolean = false,
  useRspack = false
) {
  return createRemoteUrlResolver({
    isServer,
    bundler: useRspack ? 'angular-rspack' : 'angular-webpack',
  });
}

export async function getModuleFederationConfig(
  mfConfig: ModuleFederationConfig,
  options: {
    isServer: boolean;
    determineRemoteUrl?: (remote: string) => string;
  } = { isServer: false },
  bundler: 'rspack' | 'webpack' = 'rspack'
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
    dependencies.workspaceLibraries,
    undefined,
    bundler
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
    ...sharedLibraries.getLibraries(
      projectGraph.nodes[mfConfig.name].data.root
    ),
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

export function getModuleFederationConfigSync(
  mfConfig: ModuleFederationConfig,
  options: {
    isServer: boolean;
    determineRemoteUrl?: (remote: string) => string;
  } = { isServer: false },
  useRspack = false
) {
  const projectGraph: ProjectGraph = readCachedProjectGraph();

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
    dependencies.workspaceLibraries,
    undefined,
    'rspack'
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
    ...sharedLibraries.getLibraries(
      projectGraph.nodes[mfConfig.name].data.root
    ),
    ...npmPackages,
  };

  applyDefaultEagerPackages(sharedDependencies, useRspack);
  applySharedFunction(sharedDependencies, mfConfig.shared);
  applyAdditionalShared(
    sharedDependencies,
    mfConfig.additionalShared,
    projectGraph
  );
  const determineRemoteUrlFn =
    options.determineRemoteUrl ||
    getFunctionDeterminateRemoteUrl(options.isServer, useRspack);

  const mapRemotesFunction = options.isServer ? mapRemotesForSSR : mapRemotes;
  const mappedRemotes =
    !mfConfig.remotes || mfConfig.remotes.length === 0
      ? {}
      : mapRemotesFunction(
          mfConfig.remotes,
          useRspack ? 'js' : 'mjs',
          determineRemoteUrlFn
        );
  return { sharedLibraries, sharedDependencies, mappedRemotes };
}
