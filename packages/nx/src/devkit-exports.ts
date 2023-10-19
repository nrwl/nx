/**
 * Note to developers: STOP! These exports end up as the public API of @nx/devkit.
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

// TODO(v18): Remove this export
/**
 * @category Workspace
 */
export { Workspaces } from './config/workspaces';

export { workspaceLayout } from './config/configuration';

export type {
  NxPlugin,
  NxPluginV1,
  NxPluginV2,
  ProjectTargetConfigurator,
  CreateNodes,
  CreateNodesFunction,
  CreateNodesContext,
  CreateDependencies,
  CreateDependenciesContext,
} from './utils/nx-plugin';

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
  PluginConfiguration,
  TargetDefaults,
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
export type { Target } from './command-line/run/run';
/**
 * @category Commands
 */
export { runExecutor } from './command-line/run/run';

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
export { glob } from './generators/utils/glob';

/**
 * @category Generators
 */
export {
  readNxJson,
  updateNxJson,
} from './generators/utils/project-configuration';

/**
 * @category Project Graph
 */
export type {
  ProjectFileMap,
  FileMap,
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
export {
  ProjectGraphBuilder,
  RawProjectGraphDependency,
  DynamicDependency,
  ImplicitDependency,
  StaticDependency,
  validateDependency,
} from './project-graph/project-graph-builder';

/**
 * @category Generators
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
export { joinPathFragments, normalizePath } from './utils/path';

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
  readProjectsConfigurationFromProjectGraph,
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
export { Hash, TaskHasher, Hasher } from './hasher/task-hasher';
export { hashArray } from './hasher/file-hasher';

/**
 * @category Utils
 */
export { cacheDir } from './utils/cache-directory';

/**
 * @category Utils
 */
export { createProjectFileMapUsingProjectGraph } from './project-graph/file-map-utils';
