/**
 * Note to developers: STOP! These exports are available via requireNx in @nx/devkit.
 *
 * These may not be available in certain version of Nx, so be sure to check them first.
 */
export { createTempNpmDirectory } from './utils/package-manager.js';
export {
  getExecutorInformation,
  parseExecutor,
} from './command-line/run/executor-utils.js';
export { readNxJson as readNxJsonFromDisk } from './config/nx-json.js';
export { calculateDefaultProjectName } from './config/calculate-default-project-name.js';
export { retrieveProjectConfigurationsWithAngularProjects } from './project-graph/utils/retrieve-workspace-files.js';
export { mergeTargetConfigurations } from './project-graph/utils/project-configuration-utils.js';
export {
  readProjectConfigurationsFromRootMap,
  findMatchingConfigFiles,
} from './project-graph/utils/project-configuration-utils.js';
export { getIgnoreObjectForTree } from './utils/ignore.js';
export { splitTarget } from './utils/split-target.js';
export { combineOptionsForExecutor } from './utils/params.js';
export { sortObjectByKeys } from './utils/object-sort.js';
export { stripIndent } from './utils/logger.js';
export {
  readModulePackageJson,
  installPackageToTmp,
} from './utils/package-json.js';
export { splitByColons } from './utils/split-target.js';
export { hashObject } from './hasher/file-hasher.js';
export {
  hashWithWorkspaceContext,
  hashMultiGlobWithWorkspaceContext,
} from './utils/workspace-context.js';
export {
  createProjectRootMappingsFromProjectConfigurations,
  createProjectRootMappings,
  findProjectForPath,
} from './project-graph/utils/find-project-for-path.js';
export { retrieveProjectConfigurations } from './project-graph/utils/retrieve-workspace-files.js';
export { LoadedNxPlugin } from './project-graph/plugins/loaded-nx-plugin.js';
export * from './project-graph/error-types.js';
export { registerTsProject } from './plugins/js/utils/register.js';
export { interpolate } from './tasks-runner/utils.js';
export { isCI } from './utils/is-ci.js';
export { isUsingPrettierInTree } from './utils/is-using-prettier.js';
export { readYamlFile } from './utils/fileutils.js';
export { globalSpinner } from './utils/spinner.js';
export { signalToCode } from './utils/exit-codes.js';
