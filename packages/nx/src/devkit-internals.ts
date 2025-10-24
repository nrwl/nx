/**
 * Note to developers: STOP! These exports are available via requireNx in @nx/devkit.
 *
 * These may not be available in certain version of Nx, so be sure to check them first.
 */
export { createTempNpmDirectory } from './utils/package-manager';
export {
  getExecutorInformation,
  parseExecutor,
} from './command-line/run/executor-utils';
export { readNxJson as readNxJsonFromDisk } from './config/nx-json';
export { calculateDefaultProjectName } from './config/calculate-default-project-name';
export { retrieveProjectConfigurationsWithAngularProjects } from './project-graph/utils/retrieve-workspace-files';
export { mergeTargetConfigurations } from './project-graph/utils/project-configuration-utils';
export {
  readProjectConfigurationsFromRootMap,
  findMatchingConfigFiles,
} from './project-graph/utils/project-configuration-utils';
export { getIgnoreObjectForTree } from './utils/ignore';
export { splitTarget } from './utils/split-target';
export { combineOptionsForExecutor } from './utils/params';
export { sortObjectByKeys } from './utils/object-sort';
export { stripIndent } from './utils/logger';
export {
  readModulePackageJson,
  installPackageToTmp,
} from './utils/package-json';
export { splitByColons } from './utils/split-target';
export { hashObject } from './hasher/file-hasher';
export {
  hashWithWorkspaceContext,
  hashMultiGlobWithWorkspaceContext,
} from './utils/workspace-context';
export {
  createProjectRootMappingsFromProjectConfigurations,
  findProjectForPath,
} from './project-graph/utils/find-project-for-path';
export { retrieveProjectConfigurations } from './project-graph/utils/retrieve-workspace-files';
export { LoadedNxPlugin } from './project-graph/plugins/loaded-nx-plugin';
export * from './project-graph/error-types';
export { registerTsProject } from './plugins/js/utils/register';
export { interpolate } from './tasks-runner/utils';
export { isCI } from './utils/is-ci';
export { isUsingPrettierInTree } from './utils/is-using-prettier';
export { readYamlFile } from './utils/fileutils';
export { globalSpinner } from './utils/spinner';
export { signalToCode } from './utils/exit-codes';
