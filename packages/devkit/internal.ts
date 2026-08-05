export {
  signalToCode,
  createProjectRootMappingsFromProjectConfigurations,
  PluginCache,
  safeWriteFileCache,
  emitPluginWorkerLog,
  resolveImplementation,
  resolveSchema,
  ImplementationResolutionError,
  SchemaResolutionError,
  resolvePrompt,
  PromptResolutionError,
  acknowledgeBuildScripts,
  // getCatalogManager takes the barrel route here because this file *is*
  // @nx/devkit/internal — first-party consumers only, released in lockstep. Its
  // class-1 siblings in packages/devkit/src/utils/ (semver.ts, package-json.ts)
  // ship to external plugins under the +/- 1 tolerance, so they must keep
  // importing nx/src/utils/catalog directly. See packages/devkit/CLAUDE.md.
  getCatalogManager,
  getGraphTimeDotEnvForTask,
} from 'nx/src/devkit-internals';

// Generators
export {
  determineArtifactNameAndDirectoryOptions,
  getRelativeCwd,
  type FileExtensionType,
} from './src/generators/artifact-name-and-directory-utils';
export {
  getE2EWebServerInfo,
  type E2EWebServerDetails,
} from './src/generators/e2e-web-server-info-utils';
export { forEachExecutorOptions } from './src/generators/executor-options-utils';
export { AggregatedLog } from './src/generators/plugin-migrations/aggregate-log-util';
export {
  migrateProjectExecutorsToPlugin,
  migrateProjectExecutorsToPluginV1,
  NoTargetsToMigrateError,
  type InferredTargetConfiguration,
} from './src/generators/plugin-migrations/executor-to-plugin-migrator';
export {
  processTargetOutputs,
  deleteMatchingProperties,
  toProjectRelativePath,
} from './src/generators/plugin-migrations/plugin-migration-utils';
export {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
  resolveImportPath,
} from './src/generators/project-name-and-root-utils';
export { isInteractive } from './src/generators/prompt';
export {
  addBuildTargetDefaults,
  addE2eCiTargetDefaults,
  findTargetDefault,
  readTargetDefaultsForTarget,
  updateTargetDefault,
  upsertTargetDefault,
} from './src/generators/target-defaults-utils';

// Utils
export { addPlugin } from './src/utils/add-plugin';
export {
  getDeclaredPackageVersion,
  getInstalledPackageVersion,
} from './src/utils/installed-version';
export {
  assertSupportedInstalledPackageVersion,
  assertSupportedPackageVersion,
} from './src/utils/version-floor';
export {
  createAsyncIterable,
  combineAsyncIterables,
  mapAsyncIterable,
} from './src/utils/async-iterable';
export {
  calculateHashForCreateNodes,
  calculateHashesForCreateNodes,
} from './src/utils/calculate-hash-for-create-nodes';
export { loadConfigFile, clearRequireCache } from './src/utils/config-utils';
export { findPluginForConfigFile } from './src/utils/find-plugin-for-config-file';
export { getNamedInputs } from './src/utils/get-named-inputs';
export { logShowProjectCommand } from './src/utils/log-show-project-command';
export { eachValueFrom } from './src/utils/rxjs-for-await';
export { checkAndCleanWithSemver } from './src/utils/semver';
export {
  camelize,
  capitalize,
  classify,
  dasherize,
} from './src/utils/string-utils';

// Re-exported for first-party plugins in this repo.
export {
  runCommandsExecutor,
  // NOTE: distinct from @nx/devkit's TaskResult (tasks-runner/life-cycle) —
  // this is the batch-executor result shape.
  type TaskResult,
  type Agent,
  type BatchExecutorTaskResult,
  BatchFunctionRunner,
  type BatchResults,
  type CLIErrorMessageConfig,
  type CLINoteMessageConfig,
  type CLISuccessMessageConfig,
  type CLIWarnMessageConfig,
  Cache,
  type CachedResult,
  type Change,
  type ChangedFile,
  CompositeLifeCycle,
  DeletedFileChange,
  type DependsOnEntryLocation,
  confirmationPrompt,
  // NOTE: distinct from @nx/devkit's public FileChange (generators/tree.ts),
  // which describes a pending Tree write. This one is a per-file diff
  // ({ file, getChanges }), and the two barrels are routinely imported side by
  // side — an editor auto-import can silently pick the wrong one.
  type FileChange,
  type FileDataDependency,
  type FileMapCache,
  type FinalConfigForProject,
  FsTree,
  type GeneratorInformation,
  type InputDefinition,
  type JsonInput,
  LARGE_BUFFER,
  type LifeCycle,
  LockFileChange,
  NX_PREFIX,
  type NormalizedTargetDependencyConfig,
  type NxCloudOnBoardingStatus,
  type NxReleaseVersionConfiguration,
  type PackageJson,
  type PackageJsonDependencySection,
  type PackageManagerCommands,
  type ProjectRootMappings,
  RemoteCacheV2,
  type RunCommandsOptions,
  SyncError,
  type SyncGeneratorResult,
  TEN_MEGABYTES,
  TargetProjectLocator,
  type TaskMetadata,
  type TaskStatus,
  type TaskWithCachedResult,
  type TasksRunner,
  type UnregisterCallback,
  WholeFileChange,
  buildPackageJsonPatterns,
  buildPackageJsonWorkspacesMatcher,
  buildProjectGraphAndSourceMapsWithoutDaemon,
  calculateFileChanges,
  calculateReverseDeps,
  codeFrameColumns,
  combineGlobPatterns,
  connectToNxCloud,
  createDirectory,
  createLockFile,
  createNxCloudOnboardingURL,
  createNxCloudOnboardingURLForWelcomeApp,
  createPackageJson,
  createProjectGraphAndSourceMapsAsync,
  createProjectRootMappings,
  createRunManyDynamicOutputRenderer,
  createTaskId,
  daemonClient,
  deduceDefaultBase,
  defaultFileRead,
  deriveGroupNameFromTarget,
  directoryExists,
  expandDependencyConfigSyntaxSugar,
  expandInitiatingTasksThroughNoop,
  expandWildcardTargetConfiguration,
  fileDataDepTarget,
  fileDataDepType,
  fileExists,
  filterUsingGlobPatterns,
  findAllProjectNodeDependencies,
  findInstalledPlugins,
  findMatchingConfigFiles,
  findMatchingProjects,
  findProjectForPath,
  findProjectsNpmDependencies,
  forceRegisterEsmLoader,
  getCliPath,
  getCustomHasher,
  getDependencyConfigs,
  getExecutorForTask,
  getExecutorInformation,
  getExecutorNameForTask,
  getFilesInDirectoryUsingContext,
  getGeneratorInformation,
  getGlobPatternsFromPackageManagerWorkspaces,
  getLastValueFromAsyncIterableIterator,
  getLatestCommitSha,
  getLockFileName,
  getNxCloudAppOnBoardingUrl,
  getNxCloudUrl,
  getNxRequirePaths,
  getOutputs,
  getPrintableCommandArgsForTask,
  getRelativeProjectJsonSchemaPath,
  getSerializedArgsForTask,
  getSourceDirOfDependentProjects,
  getTargetConfigurationForTask,
  getTargetInputs,
  getUnparsedOverrideArgs,
  getWorkspacePackagesFromGraph,
  globWithWorkspaceContext,
  handleImport,
  handleProjectGraphError,
  hashFile,
  hashObject,
  hashWithWorkspaceContext,
  interpolate,
  isBuiltinModuleImport,
  isCI,
  isCacheableTask,
  isDeletedFileChange,
  isLockFileChange,
  isNpmProject,
  isNxCloudUsed,
  isProjectGraphExternalNode,
  isProjectGraphProjectNode,
  isRelativePath,
  isWholeFileChange,
  killProcessTreeGraceful,
  loadTsFile,
  mergeTargetConfigurations,
  multiselectPrompt,
  normalizeDependencyConfigDefinition,
  normalizeDependencyConfigProjects,
  normalizeTargetDependencyWithStringProjects,
  nxVersion,
  orange,
  parseExecutor,
  preventRecursionInGraphConstruction,
  readCachedProjectConfiguration,
  readFileIfExisting,
  readFileMapCache,
  readModulePackageJson,
  readNxJsonFromDisk,
  readNxMigrateConfig,
  readPackageJson,
  readProjectAndTargetFromTargetString,
  registerTsConfigPaths,
  registerTsProject,
  removeTasksFromTaskGraph,
  requireWithTsconfigFallback,
  resetWorkspaceContext,
  runNxSync,
  safeExecFileSync,
  safeSpawn,
  selectPrompt,
  setWorkspaceRoot,
  setupAiAgentsGenerator,
  setupWorkspaceContext,
  shouldStreamOutput,
  toNewFormat,
  toOldFormat,
  transformLegacyOutputs,
  textPrompt,
  unparse,
  validateOutputs,
  workspaceDataDirectory,
  workspaceRootInner,
} from 'nx/src/devkit-internals';

// Release runtime values (releasePublish, releaseVersion, VersionActions) are
// intentionally NOT re-exported here: this barrel is imported by plugin graph
// hooks, and value-re-exporting `nx/release` would add ~73 modules to the
// closure they eagerly load. It is a startup-cost constraint, not a require
// cycle — nothing under packages/nx/src imports either devkit barrel back.
// Consumers import those from the public `nx/release` entry point directly.
// Only erased types are re-exported — `AfterAllProjectsVersioned` below, and
// `FinalConfigForProject` via nx/src/devkit-internals.
export type { AfterAllProjectsVersioned } from 'nx/release';
