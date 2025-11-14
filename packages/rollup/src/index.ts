import { configurationGenerator } from './generators/configuration/configuration.js';

export { configurationGenerator };

// Exported for backwards compatibility in case a plugin is using the old name.
/** @deprecated Use `configurationGenerator` instead. */
export const rollupProjectGenerator = configurationGenerator;

export * from './generators/init/init.js';
export type {
  AssetGlobPattern,
  Globals,
  RollupExecutorOptions,
} from './executors/rollup/schema';
export * from './executors/rollup/rollup.impl.js';
