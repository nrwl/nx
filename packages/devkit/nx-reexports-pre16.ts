/**
 * STOP! Do not change this file!
 *
 * If you need to export something from nx, it should go into nx/src/devkit-exports
 */

// TODO(v17): Remove this file

/* eslint-disable @typescript-eslint/no-restricted-imports */

/**
 * @category Tree
 */
export type { Tree, FileChange } from 'nx/src/generators/tree';

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
} from 'nx/src/config/workspace-json-project-json';

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
} from 'nx/src/config/misc-interfaces';

/**
 * @category Workspace
 */
export { Workspaces } from 'nx/src/config/workspaces';

// TODO (v16): Change this to export from 'nx/src/config/configuration'
export {
  readAllWorkspaceConfiguration,
  workspaceLayout,
} from 'nx/src/project-graph/file-utils';

export type {
  NxPlugin,
  ProjectTargetConfigurator,
} from 'nx/src/utils/nx-plugin';

/**
 * @category Workspace
 */
export type { Task, TaskGraph } from 'nx/src/config/task-graph';

/**
 * @category Workspace
 */
export type {
  ImplicitDependencyEntry,
  ImplicitJsonSubsetDependency,
  NxJsonConfiguration,
  NxAffectedConfig,
} from 'nx/src/config/nx-json';

/**
 * @category Logger
 */
export { logger } from 'nx/src/utils/logger';

/**
 * @category Utils
 */
export { output } from 'nx/src/utils/output';

/**
 * @category Package Manager
 */
export type { PackageManager } from 'nx/src/utils/package-manager';

/**
 * @category Package Manager
 */
export {
  getPackageManagerCommand,
  detectPackageManager,
  getPackageManagerVersion,
} from 'nx/src/utils/package-manager';

/**
 * @category Commands
 */
export type { Target } from 'nx/src/command-line/run';
/**
 * @category Commands
 */
export { runExecutor } from 'nx/src/command-line/run';

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
export {
  addProjectConfiguration,
  readProjectConfiguration,
  removeProjectConfiguration,
  updateProjectConfiguration,
  getProjects,
} from 'nx/src/generators/utils/project-configuration';

/**
 * @category Generators
 */
export {
  readNxJson,
  updateNxJson,
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
  isStandaloneProject,
  WorkspaceConfiguration,
  getWorkspacePath,
} from 'nx/src/generators/utils/project-configuration';

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
 * @category Project Graph
 */
export type {
  ProjectFileMap,
  FileData,
  ProjectGraph,
  ProjectGraphV4,
  ProjectGraphDependency,
  ProjectGraphNode,
  ProjectGraphProjectNode,
  ProjectGraphExternalNode,
  ProjectGraphProcessorContext,
} from 'nx/src/config/project-graph';

/**
 * @category Project Graph
 */
export { DependencyType } from 'nx/src/config/project-graph';

/**
 * @category Project Graph
 */
export { ProjectGraphBuilder } from 'nx/src/project-graph/project-graph-builder';

/**
 * @category Utils
 */
export { readJson, writeJson, updateJson } from 'nx/src/generators/utils/json';

/**
 * @category Utils
 */
export { parseJson, serializeJson, stripJsonComments } from 'nx/src/utils/json';

/**
 * @category Utils
 */
export type { JsonParseOptions, JsonSerializeOptions } from 'nx/src/utils/json';

/**
 * @category Utils
 */
export { readJsonFile, writeJsonFile } from 'nx/src/utils/fileutils';

/**
 * @category Utils
 */
export {
  addDependenciesToPackageJson,
  ensurePackage,
  removeDependenciesFromPackageJson,
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
export { stripIndents } from 'nx/src/utils/strip-indents';

/**
 * @category Utils
 */
export {
  joinPathFragments,
  normalizePath,
  getImportPath,
  detectWorkspaceScope,
} from 'nx/src/utils/path';

/**
 * @category Utils
 */
export { moveFilesToNewDirectory } from './src/utils/move-dir';

/**
 * @category Utils
 */
export {
  SharedLibraryConfig,
  SharedWorkspaceLibraryConfig,
  AdditionalSharedConfig,
  applySharedFunction,
  applyAdditionalShared,
  mapRemotes,
  mapRemotesForSSR,
  getNpmPackageSharedConfig,
  shareWorkspaceLibraries,
  sharePackages,
  getDependentPackagesForProject,
  ModuleFederationConfig,
  ModuleFederationLibrary,
  readRootPackageJson,
  WorkspaceLibrary,
  SharedFunction,
  WorkspaceLibrarySecondaryEntryPoint,
  Remotes,
} from './src/utils/module-federation';

// TODO(v16): Change this to export from 'nx/src/utils/workspace-root'
/**
 * @category Utils
 */
export { workspaceRoot, appRootPath } from 'nx/src/utils/app-root';

/**
 * @category Utils
 */
export { reverse } from 'nx/src/project-graph/operators';
/**
 * @category Utils
 */
export {
  createProjectGraphAsync,
  readCachedProjectGraph,
} from 'nx/src/project-graph/project-graph';

/**
 * @category Utils
 */
export { getOutputsForTargetAndConfiguration } from 'nx/src/tasks-runner/utils';

/**
 * @category Utils
 */
export {
  defaultTasksRunner,
  DefaultTasksRunnerOptions,
  RemoteCache,
} from 'nx/src/tasks-runner/default-tasks-runner';

/**
 * @category Utils
 */
export { Hash, Hasher } from 'nx/src/hasher/hasher';

/**
 * @category Utils
 */
export { cacheDir } from 'nx/src/utils/cache-directory';

// STOP! Do not export any new things from the nx package
