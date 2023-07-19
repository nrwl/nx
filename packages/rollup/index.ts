import { configurationGenerator } from './src/generators/configuration/configuration';
export { configurationGenerator };

// Exported for backwards compatibility in case a plugin is using the old name.
/** @deprecated Use `configurationGenerator` instead. */
export const rollupProjectGenerator = configurationGenerator;

export * from './src/generators/init/init';
export type {
  AssetGlobPattern,
  Globals,
  RollupExecutorOptions,
} from './src/executors/rollup/schema';
export * from './src/executors/rollup/rollup.impl';
