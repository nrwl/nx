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
  Migration,
  GeneratorCallback,
  PromiseExecutor,
  AsyncIteratorExecutor,
  Executor,
  ExecutorContext,
  TaskGraphExecutor,
  GeneratorsJson,
  ExecutorsJson,
  MigrationsJson,
  CustomHasher,
  HasherContext,
} from './config/misc-interfaces';

export { workspaceLayout } from './config/configuration.js';

export type {
  NxPlugin,
  NxPluginV2,
  CreateNodesResult,
  CreateNodesContextV2,
  CreateNodesFunctionV2,
  CreateNodesResultV2,
  CreateNodesV2,
  CreateDependencies,
  CreateDependenciesContext,
  CreateMetadata,
  CreateMetadataContext,
  ProjectsMetadata,
  PreTasksExecution,
  PreTasksExecutionContext,
  PostTasksExecution,
  PostTasksExecutionContext,
} from './project-graph/plugins';

export {
  AggregateCreateNodesError,
  StaleProjectGraphCacheError,
} from './project-graph/error-types.js';

export { createNodesFromFiles } from './project-graph/plugins/index.js';

/**
 * @category Tasks
 */
export type { Task, TaskGraph } from './config/task-graph';

/**
 * @category Tasks
 */
export type { TaskResult, TaskResults } from './tasks-runner/life-cycle';

/**
 * @category Workspace
 */
export type {
  ImplicitDependencyEntry,
  ImplicitJsonSubsetDependency,
  NxJsonConfiguration,
  PluginConfiguration,
  ExpandedPluginConfiguration,
  TargetDefaults,
  NxAffectedConfig,
} from './config/nx-json';

/**
 * @category Logger
 */
export { logger } from './utils/logger.js';

/**
 * @category Utils
 */
export { output } from './utils/output.js';

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
  isWorkspacesEnabled,
} from './utils/package-manager.js';

/**
 * @category Commands
 */
export type { Target } from './command-line/run/run';
/**
 * @category Commands
 */
export { runExecutor } from './command-line/run/run.js';

/**
 * @category Generators
 */
export {
  addProjectConfiguration,
  readProjectConfiguration,
  removeProjectConfiguration,
  updateProjectConfiguration,
  getProjects,
} from './generators/utils/project-configuration.js';

/**
 * @category Generators
 */
export { glob, globAsync } from './generators/utils/glob.js';

/**
 * @category Generators
 */
export {
  readNxJson,
  updateNxJson,
} from './generators/utils/project-configuration.js';

/**
 * @category Project Graph
 */
export type {
  ProjectFileMap,
  FileMap,
  FileData,
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
  ProjectGraphExternalNode,
} from './config/project-graph';

export type { GraphJson } from './command-line/graph/graph';

/**
 * @category Project Graph
 */
export { DependencyType } from './config/project-graph.js';

/**
 * @category Project Graph
 */
export {
  RawProjectGraphDependency,
  DynamicDependency,
  ImplicitDependency,
  StaticDependency,
  validateDependency,
} from './project-graph/project-graph-builder.js';

/**
 * @category Generators
 */
export { readJson, writeJson, updateJson } from './generators/utils/json.js';

/**
 * @category Utils
 */
export { parseJson, serializeJson, stripJsonComments } from './utils/json.js';

/**
 * @category Utils
 */
export type { JsonParseOptions, JsonSerializeOptions } from './utils/json';

/**
 * @category Utils
 */
export { readJsonFile, writeJsonFile } from './utils/fileutils.js';

/**
 * @category Utils
 */
export { stripIndents } from './utils/strip-indents.js';

/**
 * @category Utils
 */
export { joinPathFragments, normalizePath } from './utils/path.js';

/**
 * @category Utils
 */
export { workspaceRoot } from './utils/workspace-root.js';

/**
 * @category Utils
 */
export { reverse } from './project-graph/operators.js';
/**
 * @category Utils
 */
export {
  createProjectGraphAsync,
  readCachedProjectGraph,
  readProjectsConfigurationFromProjectGraph,
} from './project-graph/project-graph.js';

/**
 * @category Utils
 */
export { getOutputsForTargetAndConfiguration } from './tasks-runner/utils.js';

/**
 * @category Utils
 */
export {
  defaultTasksRunner,
  DefaultTasksRunnerOptions,
  RemoteCache,
} from './tasks-runner/default-tasks-runner.js';

/**
 * @category Utils
 */
export { Hash, TaskHasher, Hasher } from './hasher/task-hasher.js';
export { hashArray } from './hasher/file-hasher.js';

/**
 * @category Utils
 */
export { cacheDir } from './utils/cache-directory.js';

/**
 * @category Utils
 */
export { createProjectFileMapUsingProjectGraph } from './project-graph/file-map-utils.js';

export { isDaemonEnabled } from './daemon/client/client.js';
