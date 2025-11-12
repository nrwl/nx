import {
  AdditionalSharedConfig,
  ModuleFederationConfig,
  ModuleFederationLibrary,
  NxModuleFederationConfigOverride,
  Remotes,
  SharedFunction,
  SharedLibraryConfig,
  SharedWorkspaceLibraryConfig,
  WorkspaceLibrary,
  WorkspaceLibrarySecondaryEntryPoint,
} from './models/index.js';

import {
  applyAdditionalShared,
  applySharedFunction,
  getNpmPackageSharedConfig,
  sharePackages,
  shareWorkspaceLibraries,
} from './share.js';

import { normalizeProjectName } from './normalize-project-name.js';

import { mapRemotes, mapRemotesForSSR } from './remotes.js';

import { getDependentPackagesForProject } from './dependencies.js';

import { readRootPackageJson } from './package-json.js';

export {
  ModuleFederationConfig,
  NxModuleFederationConfigOverride,
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
  normalizeProjectName,
  getDependentPackagesForProject,
  readRootPackageJson,
};
