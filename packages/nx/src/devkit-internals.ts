/**
 * Note to developers: STOP! These exports are available via requireNx in @nx/devkit.
 *
 * These may not be available in certain version of Nx, so be sure to check them first.
 */
export { createTempNpmDirectory } from './utils/package-manager';
export { getExecutorInformation } from './command-line/run/executor-utils';
export { readNxJson as readNxJsonFromDisk } from './config/nx-json';
export { calculateDefaultProjectName } from './config/calculate-default-project-name';
export { retrieveProjectConfigurationsWithAngularProjects } from './project-graph/utils/retrieve-workspace-files';
export { splitTarget } from './utils/split-target';
export { combineOptionsForExecutor } from './utils/params';
export { sortObjectByKeys } from './utils/object-sort';
export { stripIndent } from './utils/logger';
export { readModulePackageJson } from './utils/package-json';
export { splitByColons } from './utils/split-target';
