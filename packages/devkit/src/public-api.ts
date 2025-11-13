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
export { formatFiles } from './generators/format-files.js';

/**
 * @category Generators
 */
export {
  generateFiles,
  OverwriteStrategy,
} from './generators/generate-files.js';

/**
 * @category Generators
 */
export { toJS, ToJSOptions } from './generators/to-js.js';

/**
 * @category Generators
 */
export { updateTsConfigsToJs } from './generators/update-ts-configs-to-js.js';

/**
 * @category Generators
 */
export { runTasksInSerial } from './generators/run-tasks-in-serial.js';

/**
 * @category Generators
 */
export { visitNotIgnoredFiles } from './generators/visit-not-ignored-files.js';

export {
  parseTargetString,
  targetToTargetString,
} from './executors/parse-target-string.js';

/**
 * @category Executors
 */
export { readTargetOptions } from './executors/read-target-options.js';

/**
 * @category Utils
 */
export {
  addDependenciesToPackageJson,
  removeDependenciesFromPackageJson,
  ensurePackage,
  getDependencyVersionFromPackageJson,
  NX_VERSION,
} from './utils/package-json.js';

/**
 * @category Utils
 */
export { installPackagesTask } from './tasks/install-packages-task.js';

/**
 * @category Utils
 */
export { names } from './utils/names.js';

/**
 * @category Utils
 */
export {
  getWorkspaceLayout,
  extractLayoutDirectory,
} from './utils/get-workspace-layout.js';

/**
 * @category Utils
 */
export type {
  StringChange,
  StringDeletion,
  StringInsertion,
} from './utils/string-change';

/**
 * @category Utils
 */
export { applyChangesToString, ChangeType } from './utils/string-change.js';

/**
 * @category Utils
 */
export { offsetFromRoot } from './utils/offset-from-root.js';

/**
 * @category Utils
 */
export { convertNxGenerator } from './utils/invoke-nx-generator.js';

/**
 * @category Utils
 */
export { convertNxExecutor } from './utils/convert-nx-executor.js';

/**
 * @category Utils
 */
export { moveFilesToNewDirectory } from './utils/move-dir.js';
