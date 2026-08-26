/**
 * Note to developers: STOP! These are nx internals, not part of the public
 * @nx/devkit API.
 *
 * This barrel is NOT under @nx/devkit's version-tolerance contract. That contract
 * (nx at the current major +/- 1, per devkit's peerDependencies) covers the public
 * @nx/devkit API only. Two classes of consumer read this file, and the rules
 * differ:
 *
 *   1. packages/devkit/src/ — devkit's own implementation. It ships to external
 *      plugins, so it *does* run under the +/- 1 tolerance (@nx/devkit@23 may be
 *      installed against nx@22) and must still guard: check at runtime, or only
 *      use symbols that have existed since the oldest supported nx major.
 *   2. First-party plugins in this repo, via @nx/devkit/internal. They release in
 *      lockstep with nx, so they require an exactly matching nx version and need
 *      no guarding.
 *
 * See packages/devkit/CLAUDE.md.
 */
export {
  createTempNpmDirectory,
  parseVersionFromPackageManagerField,
} from './utils/package-manager';
export {
  getExecutorInformation,
  parseExecutor,
} from './command-line/run/executor-utils';
export { readNxJson as readNxJsonFromDisk } from './config/nx-json';
export { calculateDefaultProjectName } from './config/calculate-default-project-name';
export { retrieveProjectConfigurationsWithAngularProjects } from './project-graph/utils/retrieve-workspace-files';
export {
  mergeTargetConfigurations,
  resolveCommandSyntacticSugar,
} from './project-graph/utils/project-configuration/target-merging';
export {
  findMatchingTargetNames,
  readProjectConfigurationsFromRootMap,
} from './project-graph/utils/project-configuration/project-nodes-manager';
export { findMatchingConfigFiles } from './project-graph/utils/project-configuration-utils';
export { findMatchingProjects } from './utils/find-matching-projects';
export {
  createTargetDefaultsResults,
  readTargetDefaultsForTarget,
} from './project-graph/utils/project-configuration/target-defaults';
// Only the tree-bound checkers and their type cross the boundary. The
// primitives they are built from carry preconditions a caller can violate - a
// chain must be resolved from the file's own directory, and the array it
// returns is the memo cache itself - and nothing outside this package needs
// them.
export {
  createGitIgnoreChecker,
  createOxfmtIgnoreChecker,
  createPrettierIgnoreChecker,
  type TreeIgnoreChecker,
} from './utils/ignore';
export { splitTarget } from './utils/split-target';
export {
  selectPrompt,
  multiselectPrompt,
  textPrompt,
  confirmationPrompt,
  type Choice as PromptChoice,
} from './utils/prompt-helpers';
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
export {
  isUsingPrettierInTree,
  prettierConfigFiles,
} from './utils/formatters/prettier';
export { detectFormatter, detectFormatterInTree } from './utils/formatters';
export type { FormatterType } from './utils/formatters';
export {
  formatFilesWithOxfmt,
  oxfmtConfigFiles,
} from './utils/formatters/oxfmt';
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
export type { Agent } from './ai/utils';
export type { GeneratorInformation } from './command-line/generate/generator-utils';
export { getGeneratorInformation } from './command-line/generate/generator-utils';
// Type-only: a value re-export would pull release-graph and the project graph
// into this barrel's eager closure, which every plugin worker loads. Not a
// cycle — nothing under packages/nx/src imports the barrel.
export type { FinalConfigForProject } from './command-line/release/utils/release-graph';
export { BatchFunctionRunner } from './command-line/watch/watch';
export type { BatchExecutorTaskResult } from './config/misc-interfaces';
export type { NxReleaseVersionConfiguration } from './config/nx-json';
export type { FileDataDependency } from './config/project-graph';
export {
  fileDataDepTarget,
  fileDataDepType,
  isProjectGraphExternalNode,
  isProjectGraphProjectNode,
} from './config/project-graph';
export type { InputDefinition } from './config/workspace-json-project-json';
export type { ChangedFile, UnregisterCallback } from './daemon/client/client';
export { daemonClient } from './daemon/client/client';
export type { RunCommandsOptions } from './executors/run-commands/run-commands.impl';
export { LARGE_BUFFER } from './executors/run-commands/run-commands.impl';
export { FsTree } from './generators/tree';
export { getRelativeProjectJsonSchemaPath } from './generators/utils/project-configuration';
export { hashFile } from './hasher/file-hasher';
export { filterUsingGlobPatterns, getTargetInputs } from './hasher/task-hasher';
export type { JsonInput } from './native';
export { killProcessTreeGraceful } from './native';
export { connectToNxCloud } from './nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud';
export type { NxCloudOnBoardingStatus } from './nx-cloud/models/onboarding-status';
export {
  createNxCloudOnboardingURLForWelcomeApp,
  getNxCloudAppOnBoardingUrl,
} from './nx-cloud/utilities/onboarding';
export { createNxCloudOnboardingURL } from './nx-cloud/utilities/url-shorten';
export {
  createLockFile,
  generatePrunedDeployOutput,
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
  buildPackageJsonPatterns,
  buildPackageJsonWorkspacesMatcher,
} from './plugins/package-json/create-nodes';
// NOTE: distinct from @nx/devkit's public FileChange (generators/tree.ts), which
// describes a pending Tree write ({ path, type: 'CREATE' | 'DELETE' | 'UPDATE',
// content }). This one describes a per-file diff ({ file, getChanges }). The two
// barrels are routinely imported side by side, so an editor auto-import can
// silently pick the wrong — but structurally plausible — FileChange.
export type { Change, FileChange } from './project-graph/file-utils';
export {
  DeletedFileChange,
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
export type { FileMapCache } from './project-graph/nx-deps-cache';
export { readFileMapCache } from './project-graph/nx-deps-cache';
export { isNpmProject } from './project-graph/operators';
export {
  buildProjectGraphAndSourceMapsWithoutDaemon,
  createProjectGraphAndSourceMapsAsync,
  handleProjectGraphError,
  preventRecursionInGraphConstruction,
  readCachedProjectConfiguration,
} from './project-graph/project-graph';
export type { ProjectRootMappings } from './project-graph/utils/find-project-for-path';
export type { BatchResults } from './tasks-runner/batch/batch-messages';
export type { CachedResult, TaskWithCachedResult } from './tasks-runner/cache';
export { Cache } from './tasks-runner/cache';
export { RemoteCacheV2 } from './tasks-runner/default-tasks-runner';
export type { LifeCycle, TaskMetadata } from './tasks-runner/life-cycle';
export { CompositeLifeCycle } from './tasks-runner/life-cycle';
export { createRunManyDynamicOutputRenderer } from './tasks-runner/life-cycles/dynamic-run-many-terminal-output-life-cycle';
export type { TaskStatus, TasksRunner } from './tasks-runner/tasks-runner';
export type {
  DependsOnEntryLocation,
  NormalizedTargetDependencyConfig,
} from './tasks-runner/utils';
export {
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
export type {
  CLIErrorMessageConfig,
  CLINoteMessageConfig,
  CLISuccessMessageConfig,
  CLIWarnMessageConfig,
} from './utils/output';
export { orange } from './utils/output';
export { getNxCloudUrl, isNxCloudUsed } from './utils/nx-cloud-utils';
export type {
  PackageJson,
  PackageJsonDependencySection,
} from './utils/package-json';
export { readNxMigrateConfig } from './utils/package-json';
export {
  dropEmptyPeerDependencySections,
  movePeerDependencyToDependencies,
  relocatePrunedLocalPathSpec,
  warnUnshippableLocalPathSpec,
} from './plugins/js/lock-file/pruned-output';
export type { PackageManagerCommands } from './utils/package-manager';
// Sourced from the leaf module rather than ./utils/plugins: the barrel index
// pulls output.ts and core-plugins.ts into the eager closure for a function that
// depends on neither.
export { deriveGroupNameFromTarget } from './utils/plugins/atomizer-utils';
export { findInstalledPlugins } from './utils/plugins/installed-plugins';
export {
  findAllProjectNodeDependencies,
  getSourceDirOfDependentProjects,
} from './utils/project-graph-utils';
export type { SyncGeneratorResult } from './utils/sync-generators';
export { SyncError } from './utils/sync-generators';
export { nxVersion } from './utils/versions';
export {
  getFilesInDirectoryUsingContext,
  globWithWorkspaceContext,
  resetWorkspaceContext,
  setupWorkspaceContext,
} from './utils/workspace-context';
export { setWorkspaceRoot, workspaceRootInner } from './utils/workspace-root';
export { safeExecFileSync, safeSpawn } from './utils/safe-spawn';
