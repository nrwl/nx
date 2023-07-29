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
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  ModuleFederationConfig,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  SharedLibraryConfig,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  SharedWorkspaceLibraryConfig,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  AdditionalSharedConfig,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  WorkspaceLibrary,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  SharedFunction,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  WorkspaceLibrarySecondaryEntryPoint,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  Remotes,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  ModuleFederationLibrary,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  applySharedFunction,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  applyAdditionalShared,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  getNpmPackageSharedConfig,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  shareWorkspaceLibraries,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  sharePackages,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  mapRemotes,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  mapRemotesForSSR,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  getDependentPackagesForProject,
  /**
   * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
   */
  readRootPackageJson,
};
