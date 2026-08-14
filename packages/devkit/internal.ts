export {
  signalToCode,
  createProjectRootMappingsFromProjectConfigurations,
  PluginCache,
  safeExecFileSync,
  safeSpawn,
  safeWriteFileCache,
} from 'nx/src/devkit-internals';

export { AggregatedLog } from './src/generators/plugin-migrations/aggregate-log-util';
export { loadConfigFile, clearRequireCache } from './src/utils/config-utils';
