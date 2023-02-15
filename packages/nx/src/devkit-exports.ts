/**
 * Note to developers: STOP! These exports end up as the public API of @nrwl/devkit.
 * Try hard to not add to this API to reduce the surface area we need to maintain.
 */

/**
 * @category Tree
 */
export type { Tree, FileChange } from './generators/tree';

/**
 * @category Workspace
 */
export type {
  WorkspaceJsonConfiguration,
  ProjectsConfigurations,
  TargetDependencyConfig,
  TargetConfiguration,
  ProjectConfiguration,
  ProjectType,
  Workspace,
} from './config/workspace-json-project-json';

/**
 * @category Workspace
 */
export type {
  Generator,
  GeneratorCallback,
  Executor,
  ExecutorContext,
  TaskGraphExecutor,
  GeneratorsJson,
  ExecutorsJson,
  MigrationsJson,
  CustomHasher,
  HasherContext,
} from './config/misc-interfaces';

/**
 * @category Workspace
 */
export { Workspaces } from './config/workspaces';

// TODO (v16): Change this to export from './config/configuration'
export {
  readAllWorkspaceConfiguration,
  workspaceLayout,
} from './project-graph/file-utils';

export type { NxPlugin, ProjectTargetConfigurator } from './utils/nx-plugin';

/**
 * @category Workspace
 */
export type { Task, TaskGraph } from './config/task-graph';

/**
 * @category Workspace
 */
export type {
  ImplicitDependencyEntry,
  ImplicitJsonSubsetDependency,
  NxJsonConfiguration,
  NxAffectedConfig,
} from './config/nx-json';

/**
 * @category Logger
 */
export { logger } from './utils/logger';

/**
 * @category Utils
 */
export { output } from './utils/output';

/**
 * @category Package Manager
 */
export type { PackageManager } from './utils/package-manager';

/**
 * @category Package Manager
 */
export {
  getPackageManagerCommand,
  detectPackageManager,
  getPackageManagerVersion,
} from './utils/package-manager';

/**
 * @category Commands
 */
export type { Target } from './command-line/run';
/**
 * @category Commands
 */
export { runExecutor } from './command-line/run';

/**
 * @category Generators
 */
export {
  addProjectConfiguration,
  readProjectConfiguration,
  removeProjectConfiguration,
  updateProjectConfiguration,
  getProjects,
} from './generators/utils/project-configuration';

/**
 * @category Generators
 */
export {
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
  isStandaloneProject,
  WorkspaceConfiguration,
  getWorkspacePath,
} from './generators/utils/deprecated';

export {
  readNxJson,
  updateNxJson,
} from './generators/utils/project-configuration';

/**
 * @category Project Graph
 */
export type {
  ProjectFileMap,
  FileData,
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphNode,
  ProjectGraphProjectNode,
  ProjectGraphExternalNode,
  ProjectGraphProcessorContext,
} from './config/project-graph';

/**
 * @category Project Graph
 */
export { DependencyType } from './config/project-graph';

/**
 * @category Project Graph
 */
export { ProjectGraphBuilder } from './project-graph/project-graph-builder';

/**
 * @category Utils
 */
export { readJson, writeJson, updateJson } from './generators/utils/json';

/**
 * @category Utils
 */
export { parseJson, serializeJson, stripJsonComments } from './utils/json';

/**
 * @category Utils
 */
export type { JsonParseOptions, JsonSerializeOptions } from './utils/json';

/**
 * @category Utils
 */
export { readJsonFile, writeJsonFile } from './utils/fileutils';

/**
 * @category Utils
 */
export { stripIndents } from './utils/strip-indents';

/**
 * @category Utils
 */
export {
  joinPathFragments,
  normalizePath,
  getImportPath,
  detectWorkspaceScope,
} from './utils/path';

// TODO(v16): Change this to export from './utils/workspace-root'
/**
 * @category Utils
 */
export { workspaceRoot, appRootPath } from './utils/app-root';

/**
 * @category Utils
 */
export { reverse } from './project-graph/operators';
/**
 * @category Utils
 */
export {
  createProjectGraphAsync,
  readCachedProjectGraph,
} from './project-graph/project-graph';

/**
 * @category Utils
 */
export { getOutputsForTargetAndConfiguration } from './tasks-runner/utils';

/**
 * @category Utils
 */
export {
  defaultTasksRunner,
  DefaultTasksRunnerOptions,
  RemoteCache,
} from './tasks-runner/default-tasks-runner';

/**
 * @category Utils
 */
export { Hash, Hasher } from './hasher/hasher';

/**
 * @category Utils
 */
export { cacheDir } from './utils/cache-directory';

import { createLockFile as _createLockFile } from './plugins/js/lock-file/lock-file';
import { createPackageJson as _createPackageJson } from './plugins/js/package-json/create-package-json';

/**
 * @category Package Manager
 */
/**
 * @deprecated Import this from @nrwl/js instead
 */
export const createLockFile = _createLockFile;
/**
 * @deprecated Import this from @nrwl/js instead
 */
export const createPackageJson = _createPackageJson;
