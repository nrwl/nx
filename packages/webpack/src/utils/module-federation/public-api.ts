import {
  AdditionalSharedConfig,
  ModuleFederationConfig,
  ModuleFederationLibrary,
  Remotes,
  SharedFunction,
  SharedLibraryConfig,
  SharedWorkspaceLibraryConfig,
  WorkspaceLibrary,
  WorkspaceLibrarySecondaryEntryPoint,
} from './models';

import {
  applyAdditionalShared,
  applySharedFunction,
  getNpmPackageSharedConfig,
  sharePackages,
  shareWorkspaceLibraries,
} from './share';

import { mapRemotes, mapRemotesForSSR } from './remotes';

import { getDependentPackagesForProject } from './dependencies';

import { readRootPackageJson } from './package-json';

export {
  ModuleFederationConfig,
  SharedLibraryConfig,
  SharedWorkspaceLibraryConfig,
  AdditionalSharedConfig,
  WorkspaceLibrary,
  SharedFunction,
  WorkspaceLibrarySecondaryEntryPoint,
  Remotes,
  ModuleFederationLibrary,
  applySharedFunction,
  applyAdditionalShared,
  getNpmPackageSharedConfig,
  shareWorkspaceLibraries,
  sharePackages,
  mapRemotes,
  mapRemotesForSSR,
  getDependentPackagesForProject,
  readRootPackageJson,
};
