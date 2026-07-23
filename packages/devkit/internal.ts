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
export { promptWhenInteractive } from './src/generators/prompt';
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
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- nx/src/utils/catalog exists since nx 22.0.0, the whole supported range; swap to the nx/src/devkit-internals re-export in v25
export { getCatalogManager } from 'nx/src/utils/catalog';
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
  type TaskResult,
  Agent,
  BatchExecutorTaskResult,
  BatchFunctionRunner,
  BatchResults,
  CLIErrorMessageConfig,
  CLINoteMessageConfig,
  CLISuccessMessageConfig,
  CLIWarnMessageConfig,
  Cache,
  CachedResult,
  Change,
  ChangedFile,
  CompositeLifeCycle,
  DeletedFileChange,
  DependsOnEntryLocation,
  FileChange,
  FileDataDependency,
  FileMapCache,
  type FinalConfigForProject,
  FsTree,
  GeneratorInformation,
  InputDefinition,
  JsonInput,
  LARGE_BUFFER,
  LifeCycle,
  LockFileChange,
  NX_PREFIX,
  NormalizedTargetDependencyConfig,
  NxCloudOnBoardingStatus,
  type NxReleaseVersionConfiguration,
  PackageJson,
  PackageJsonDependencySection,
  PackageManagerCommands,
  ProjectRootMappings,
  RemoteCacheV2,
  RunCommandsOptions,
  SyncError,
  SyncGeneratorResult,
  TEN_MEGABYTES,
  TargetProjectLocator,
  TaskMetadata,
  TaskStatus,
  TaskWithCachedResult,
  TasksRunner,
  UnregisterCallback,
  WholeFileChange,
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
  setWorkspaceRoot,
  setupAiAgentsGenerator,
  setupWorkspaceContext,
  shouldStreamOutput,
  toNewFormat,
  toOldFormat,
  transformLegacyOutputs,
  unparse,
  validateOutputs,
  workspaceDataDirectory,
  workspaceRootInner,
} from 'nx/src/devkit-internals';

// Release runtime values (releasePublish, releaseVersion, VersionActions) are
// intentionally NOT re-exported here: this barrel is imported by plugin graph
// hooks, and eagerly loading nx's release command module during graph
// construction creates a require cycle. Consumers import those from the public
// `nx/release` entry point directly. Only the erased type is re-exported.
export type { AfterAllProjectsVersioned } from 'nx/release';
