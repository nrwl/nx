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
export { formatFiles } from './src/generators/format-files.js';

/**
 * @category Generators
 */
export {
  generateFiles,
  OverwriteStrategy,
} from './src/generators/generate-files.js';

/**
 * @category Generators
 */
export { toJS, ToJSOptions } from './src/generators/to-js.js';

/**
 * @category Generators
 */
export { updateTsConfigsToJs } from './src/generators/update-ts-configs-to-js.js';

/**
 * @category Generators
 */
export { runTasksInSerial } from './src/generators/run-tasks-in-serial.js';

/**
 * @category Generators
 */
export { visitNotIgnoredFiles } from './src/generators/visit-not-ignored-files.js';

export {
  parseTargetString,
  targetToTargetString,
} from './src/executors/parse-target-string.js';

/**
 * @category Executors
 */
export { readTargetOptions } from './src/executors/read-target-options.js';

/**
 * @category Utils
 */
export {
  addDependenciesToPackageJson,
  removeDependenciesFromPackageJson,
  ensurePackage,
  getDependencyVersionFromPackageJson,
  NX_VERSION,
} from './src/utils/package-json.js';

/**
 * @category Utils
 */
export { installPackagesTask } from './src/tasks/install-packages-task.js';

/**
 * @category Utils
 */
export { names } from './src/utils/names.js';

/**
 * @category Utils
 */
export {
  getWorkspaceLayout,
  extractLayoutDirectory,
} from './src/utils/get-workspace-layout.js';

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
export { applyChangesToString, ChangeType } from './src/utils/string-change.js';

/**
 * @category Utils
 */
export { offsetFromRoot } from './src/utils/offset-from-root.js';

/**
 * @category Utils
 */
export { convertNxGenerator } from './src/utils/invoke-nx-generator.js';

/**
 * @category Utils
 */
export { convertNxExecutor } from './src/utils/convert-nx-executor.js';

/**
 * @category Utils
 */
export { moveFilesToNewDirectory } from './src/utils/move-dir.js';
