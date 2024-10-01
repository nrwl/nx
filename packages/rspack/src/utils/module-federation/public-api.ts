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

import { withModuleFederation } from './with-module-federation/with-module-federation';
import { withModuleFederationForSSR } from './with-module-federation/with-module-federation-ssr';

export {
  AdditionalSharedConfig,
  applyAdditionalShared,
  applySharedFunction,
  getDependentPackagesForProject,
  getNpmPackageSharedConfig,
  mapRemotes,
  mapRemotesForSSR,
  ModuleFederationConfig,
  ModuleFederationLibrary,
  readRootPackageJson,
  Remotes,
  SharedFunction,
  SharedLibraryConfig,
  SharedWorkspaceLibraryConfig,
  sharePackages,
  shareWorkspaceLibraries,
  withModuleFederation,
  withModuleFederationForSSR,
  WorkspaceLibrary,
  WorkspaceLibrarySecondaryEntryPoint,
};
