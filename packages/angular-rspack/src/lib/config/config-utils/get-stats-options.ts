import { type StatsOptions } from '@rspack/core';

export function getStatsOptions(verbose = false): StatsOptions {
  const rspackStatsOptions: StatsOptions = {
    all: false, // Fallback value for stats options when an option is not defined. It has precedence over local webpack defaults.
    colors: true,
    hash: true, // required by custom stat output
    timings: true, // required by custom stat output
    chunks: true, // required by custom stat output
    builtAt: true, // required by custom stat output
    warnings: true,
    errors: true,
    assets: true, // required by custom stat output
    cachedAssets: true, // required for bundle size calculators

    // Needed for markAsyncChunksNonInitial.
    ids: true,
    entrypoints: true,
  };

  const verboseStatsOutputOptions: StatsOptions = {
    // The verbose output will most likely be piped to a file, so colors just mess it up.
    colors: false,
    usedExports: true,
    optimizationBailout: true,
    reasons: true,
    children: true,
    assets: true,
    version: true,
    chunkModules: true,
    errorDetails: true,
    errorStack: true,
    moduleTrace: true,
    logging: 'verbose',
    modulesSpace: Infinity,
  };

  return verbose
    ? { ...rspackStatsOptions, ...verboseStatsOutputOptions }
    : rspackStatsOptions;
}
