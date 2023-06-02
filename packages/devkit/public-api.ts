/**
 * Note to developers: STOP! This is the Public API of @nx/devkit.
 * @nx/devkit should be compatible with versions of Nx 1 major version prior.
 * This is so that plugins can use the latest @nx/devkit while their users may use versions +/- 1 of Nx.
 *
 * 1. Try hard to not add to this API to reduce the surface area we need to maintain.
 * 2. Do not add newly created paths from the nx package to this file as they will not be available in older versions of Nx.
 *   a. We might need to duplicate code instead of importing from nx until all supported versions of nx contain the file.
 */

/**
 * @category Generators
 */
export { formatFiles } from './src/generators/format-files';

/**
 * @category Generators
 */
export { generateFiles } from './src/generators/generate-files';

/**
 * @category Generators
 */
export { toJS } from './src/generators/to-js';

/**
 * @category Generators
 */
export { updateTsConfigsToJs } from './src/generators/update-ts-configs-to-js';

/**
 * @category Generators
 */
export { runTasksInSerial } from './src/generators/run-tasks-in-serial';

/**
 * @category Generators
 */
export { visitNotIgnoredFiles } from './src/generators/visit-not-ignored-files';

export {
  parseTargetString,
  targetToTargetString,
} from './src/executors/parse-target-string';

/**
 * @category Executors
 */
export { readTargetOptions } from './src/executors/read-target-options';

/**
 * @category Utils
 */
export {
  addDependenciesToPackageJson,
  ensurePackage,
  removeDependenciesFromPackageJson,
  NX_VERSION,
} from './src/utils/package-json';

/**
 * @category Utils
 */
export { installPackagesTask } from './src/tasks/install-packages-task';

/**
 * @category Utils
 */
export { names } from './src/utils/names';

/**
 * @category Utils
 */
export {
  getWorkspaceLayout,
  extractLayoutDirectory,
} from './src/utils/get-workspace-layout';

/**
 * @category Utils
 */
export type {
  StringChange,
  StringDeletion,
  StringInsertion,
} from './src/utils/string-change';

/**
 * @category Utils
 */
export { applyChangesToString, ChangeType } from './src/utils/string-change';

/**
 * @category Utils
 */
export { offsetFromRoot } from './src/utils/offset-from-root';

/**
 * @category Utils
 */
export { convertNxGenerator } from './src/utils/invoke-nx-generator';

/**
 * @category Utils
 */
export { convertNxExecutor } from './src/utils/convert-nx-executor';

/**
 * @category Utils
 */
export { moveFilesToNewDirectory } from './src/utils/move-dir';

/**
 * @category Utils
 * @deprecated Accessing the Module Federation Utils from the Public API of @nx/devkit is deprecated and they will be removed from the Public API in v17.
 */
export {
  AdditionalSharedConfig,
  ModuleFederationConfig,
  SharedLibraryConfig,
  SharedWorkspaceLibraryConfig,
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
} from './src/utils/module-federation/public-api';
