export {
  signalToCode,
  createProjectRootMappingsFromProjectConfigurations,
  PluginCache,
  safeWriteFileCache,
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
} from './src/generators/target-defaults-utils';

// Utils
export { addPlugin } from './src/utils/add-plugin';
export {
  createAsyncIterable,
  combineAsyncIterables,
  mapAsyncIterable,
} from './src/utils/async-iterable';
export {
  calculateHashForCreateNodes,
  calculateHashesForCreateNodes,
} from './src/utils/calculate-hash-for-create-nodes';
export { getCatalogManager } from './src/utils/catalog';
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
