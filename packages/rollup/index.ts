import { configurationGenerator } from './src/generators/configuration/configuration';
export { configurationGenerator };

// Exported for backwards compatibility with older name, in case a community plugin uses it.
export { configurationGenerator as rollupProjectGenerator };

export * from './src/generators/init/init';
export type {
  AssetGlobPattern,
  Globals,
  RollupExecutorOptions,
} from './src/executors/rollup/schema';
export * from './src/executors/rollup/rollup.impl';
