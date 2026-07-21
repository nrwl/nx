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
export { mergeTargetConfigurations } from './project-graph/utils/project-configuration/target-merging';
export { readProjectConfigurationsFromRootMap } from './project-graph/utils/project-configuration/project-nodes-manager';
export { findMatchingConfigFiles } from './project-graph/utils/project-configuration-utils';
export { findMatchingProjects } from './utils/find-matching-projects';
export { readTargetDefaultsForTarget } from './project-graph/utils/project-configuration/target-defaults';
export { getIgnoreObjectForTree } from './utils/ignore';
export { splitTarget } from './utils/split-target';
export { combineOptionsForExecutor } from './utils/params';
export { sortObjectByKeys } from './utils/object-sort';
export { stripIndent } from './utils/logger';
export {
  readModulePackageJson,
  installPackageToTmp,
  installPackageToTmpAsync,
} from './utils/package-json';
export { splitByColons } from './utils/split-target';
export { hashObject } from './hasher/file-hasher';
export {
  hashWithWorkspaceContext,
  hashMultiGlobWithWorkspaceContext,
} from './utils/workspace-context';
export {
  createProjectRootMappingsFromProjectConfigurations,
  createProjectRootMappings,
  findProjectForPath,
} from './project-graph/utils/find-project-for-path';
export { retrieveProjectConfigurations } from './project-graph/utils/retrieve-workspace-files';
export { LoadedNxPlugin } from './project-graph/plugins/loaded-nx-plugin';
export * from './project-graph/error-types';
export {
  registerTsProject,
  loadTsFile,
  forceRegisterEsmLoader,
  requireWithTsconfigFallback,
} from './plugins/js/utils/register';
export { interpolate } from './tasks-runner/utils';
export { isCI } from './utils/is-ci';
export { isUsingPrettierInTree } from './utils/is-using-prettier';
export { readYamlFile } from './utils/fileutils';
export { globalSpinner } from './utils/spinner';
export { signalToCode } from './utils/exit-codes';
export { handleImport } from './utils/handle-import';
export { PluginCache, safeWriteFileCache } from './utils/plugin-cache-utils';
export { emitPluginWorkerLog } from './project-graph/plugins/isolation/worker-streaming';
export {
  resolveImplementation,
  resolveSchema,
  ImplementationResolutionError,
  SchemaResolutionError,
} from './config/schema-utils';
export {
  resolvePrompt,
  PromptResolutionError,
} from './command-line/migrate/prompt-files';
export {
  checkFilesAreInputs,
  checkFilesAreOutputs,
} from './hasher/check-task-files';
export {
  getCatalogManager,
  getCatalogDependenciesFromPackageJson,
} from './utils/catalog';
export { acknowledgeBuildScripts } from './utils/acknowledge-build-scripts';

// Exposed for first-party plugins in this repo (imported via @nx/devkit/internal).
export { default as runCommandsExecutor } from './executors/run-commands/run-commands.impl';
// NOTE: distinct from @nx/devkit's TaskResult (tasks-runner/life-cycle) —
// this is the batch-executor result shape.
export type { TaskResult } from './config/misc-interfaces';
export { toNewFormat, toOldFormat } from './adapter/angular-json';
export { setupAiAgentsGenerator } from './ai/set-up-ai-agents/set-up-ai-agents';
export { Agent } from './ai/utils';
export {
  GeneratorInformation,
  getGeneratorInformation,
} from './command-line/generate/generator-utils';
// Type-only: a value re-export would eagerly require release-graph (which pulls
// in the project graph) during nx's own graph construction, creating a cycle.
export type { FinalConfigForProject } from './command-line/release/utils/release-graph';
export { BatchFunctionRunner } from './command-line/watch/watch';
export { BatchExecutorTaskResult } from './config/misc-interfaces';
export type { NxReleaseVersionConfiguration } from './config/nx-json';
export {
  FileDataDependency,
  fileDataDepTarget,
  fileDataDepType,
  isProjectGraphExternalNode,
  isProjectGraphProjectNode,
} from './config/project-graph';
export { InputDefinition } from './config/workspace-json-project-json';
export {
  ChangedFile,
  UnregisterCallback,
  daemonClient,
} from './daemon/client/client';
export {
  LARGE_BUFFER,
  RunCommandsOptions,
} from './executors/run-commands/run-commands.impl';
export { FsTree } from './generators/tree';
export { getRelativeProjectJsonSchemaPath } from './generators/utils/project-configuration';
export { hashFile } from './hasher/file-hasher';
export { filterUsingGlobPatterns, getTargetInputs } from './hasher/task-hasher';
export { JsonInput, killProcessTreeGraceful } from './native';
export { connectToNxCloud } from './nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud';
export { NxCloudOnBoardingStatus } from './nx-cloud/models/onboarding-status';
export {
  createNxCloudOnboardingURLForWelcomeApp,
  getNxCloudAppOnBoardingUrl,
} from './nx-cloud/utilities/onboarding';
export { createNxCloudOnboardingURL } from './nx-cloud/utilities/url-shorten';
export {
  createLockFile,
  getLockFileName,
} from './plugins/js/lock-file/lock-file';
export {
  createPackageJson,
  findProjectsNpmDependencies,
} from './plugins/js/package-json/create-package-json';
export {
  TargetProjectLocator,
  isBuiltinModuleImport,
} from './plugins/js/project-graph/build-dependencies/target-project-locator';
export { getWorkspacePackagesFromGraph } from './plugins/js/utils/get-workspace-packages-from-graph';
export { registerTsConfigPaths } from './plugins/js/utils/register';
export { getGlobPatternsFromPackageManagerWorkspaces } from './plugins/package-json';
export {
  Change,
  DeletedFileChange,
  FileChange,
  LockFileChange,
  TEN_MEGABYTES,
  WholeFileChange,
  calculateFileChanges,
  defaultFileRead,
  isDeletedFileChange,
  isLockFileChange,
  isWholeFileChange,
  readPackageJson,
} from './project-graph/file-utils';
export { FileMapCache, readFileMapCache } from './project-graph/nx-deps-cache';
export { isNpmProject } from './project-graph/operators';
export {
  buildProjectGraphAndSourceMapsWithoutDaemon,
  createProjectGraphAndSourceMapsAsync,
  handleProjectGraphError,
  preventRecursionInGraphConstruction,
  readCachedProjectConfiguration,
} from './project-graph/project-graph';
export { ProjectRootMappings } from './project-graph/utils/find-project-for-path';
export { BatchResults } from './tasks-runner/batch/batch-messages';
export {
  Cache,
  CachedResult,
  TaskWithCachedResult,
} from './tasks-runner/cache';
export { RemoteCacheV2 } from './tasks-runner/default-tasks-runner';
export {
  CompositeLifeCycle,
  LifeCycle,
  TaskMetadata,
} from './tasks-runner/life-cycle';
export { createRunManyDynamicOutputRenderer } from './tasks-runner/life-cycles/dynamic-run-many-terminal-output-life-cycle';
export { TaskStatus, TasksRunner } from './tasks-runner/tasks-runner';
export {
  DependsOnEntryLocation,
  NormalizedTargetDependencyConfig,
  calculateReverseDeps,
  createTaskId,
  expandDependencyConfigSyntaxSugar,
  expandInitiatingTasksThroughNoop,
  expandWildcardTargetConfiguration,
  getCliPath,
  getCustomHasher,
  getDependencyConfigs,
  getExecutorForTask,
  getExecutorNameForTask,
  getOutputs,
  getPrintableCommandArgsForTask,
  getSerializedArgsForTask,
  getTargetConfigurationForTask,
  getUnparsedOverrideArgs,
  isCacheableTask,
  normalizeDependencyConfigDefinition,
  normalizeDependencyConfigProjects,
  normalizeTargetDependencyWithStringProjects,
  readProjectAndTargetFromTargetString,
  removeTasksFromTaskGraph,
  shouldStreamOutput,
  transformLegacyOutputs,
  unparse,
  validateOutputs,
} from './tasks-runner/utils';
export { getLastValueFromAsyncIterableIterator } from './utils/async-iterator';
export { workspaceDataDirectory } from './utils/cache-directory';
export { runNxSync } from './utils/child-process';
export { codeFrameColumns } from './utils/code-frames';
export { deduceDefaultBase } from './utils/default-base';
export {
  createDirectory,
  directoryExists,
  fileExists,
  isRelativePath,
  readFileIfExisting,
} from './utils/fileutils';
export { getLatestCommitSha } from './utils/git-utils';
export { combineGlobPatterns } from './utils/globs';
export { getNxRequirePaths } from './utils/installation-directory';
export { NX_PREFIX } from './utils/logger';
export {
  CLIErrorMessageConfig,
  CLINoteMessageConfig,
  CLISuccessMessageConfig,
  CLIWarnMessageConfig,
  orange,
} from './utils/output';
export { getNxCloudUrl, isNxCloudUsed } from './utils/nx-cloud-utils';
export {
  PackageJson,
  PackageJsonDependencySection,
  readNxMigrateConfig,
} from './utils/package-json';
export { PackageManagerCommands } from './utils/package-manager';
export { deriveGroupNameFromTarget } from './utils/plugins';
export { findInstalledPlugins } from './utils/plugins/installed-plugins';
export {
  findAllProjectNodeDependencies,
  getSourceDirOfDependentProjects,
} from './utils/project-graph-utils';
export { SyncError, SyncGeneratorResult } from './utils/sync-generators';
export { nxVersion } from './utils/versions';
export {
  getFilesInDirectoryUsingContext,
  globWithWorkspaceContext,
  resetWorkspaceContext,
  setupWorkspaceContext,
} from './utils/workspace-context';
export { setWorkspaceRoot, workspaceRootInner } from './utils/workspace-root';
