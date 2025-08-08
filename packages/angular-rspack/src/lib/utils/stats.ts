/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  BudgetCalculatorResult,
  BundleStats,
  generateBuildStatsTable,
} from '@angular/build/private';
import assert from 'node:assert';
import * as path from 'node:path';
import {
  Configuration,
  StatsCompilation,
  Stats,
  StatsOptions,
} from '@rspack/core';
import {
  NormalizedAngularRspackPluginOptions,
  NormalizedEntryPoint,
  ScriptOrStyleEntry,
} from '../models/angular-rspack-plugin-options';
import { normalizeOptimization } from '../models/normalize-options';
import { colors as ansiColors } from './color';
import { markAsyncChunksNonInitial } from './async-chunks';
import { getStatsOptions } from '../config/config-utils/get-stats-options';

export interface RspackLoggingCallback {
  (stats: Stats, config: Configuration): void;
}

export type RspackStatsOptions = Exclude<
  Configuration['stats'],
  string | boolean | undefined
>;

export function normalizeExtraEntryPoints(
  extraEntryPoints: ScriptOrStyleEntry[],
  defaultBundleName: string
): NormalizedEntryPoint[] {
  return extraEntryPoints.map((entry) => {
    if (typeof entry === 'string') {
      return { input: entry, inject: true, bundleName: defaultBundleName };
    }

    const { inject = true, ...newEntry } = entry;
    let bundleName;
    if (entry.bundleName) {
      bundleName = entry.bundleName;
    } else if (!inject) {
      // Lazy entry points use the file name as bundle name.
      bundleName = path.parse(entry.input).name;
    } else {
      bundleName = defaultBundleName;
    }

    return { ...newEntry, inject, bundleName };
  });
}

function getBuildDuration(rspackStats: StatsCompilation): number {
  assert(rspackStats.builtAt, 'buildAt cannot be undefined');
  assert(rspackStats.time, 'time cannot be undefined');

  return Date.now() - rspackStats.builtAt + rspackStats.time;
}

function generateBundleStats(info: {
  rawSize?: number;
  estimatedTransferSize?: number;
  files?: string[];
  names?: string[];
  initial?: boolean;
  rendered?: boolean;
}): BundleStats {
  const rawSize = typeof info.rawSize === 'number' ? info.rawSize : '-';
  const estimatedTransferSize =
    typeof info.estimatedTransferSize === 'number'
      ? info.estimatedTransferSize
      : '-';
  const files =
    info.files
      ?.filter((f) => !f.endsWith('.map'))
      .map((f) => path.basename(f))
      .join(', ') ?? '';
  const names = info.names?.length ? info.names.join(', ') : '-';
  const initial = !!info.initial;

  return {
    initial,
    stats: [files, names, rawSize, estimatedTransferSize],
  };
}

// We use this cache because we can have multiple builders running in the same process,
// where each builder has different output path.

// Ideally, we should create the logging callback as a factory, but that would need a refactoring.
const runsCache = new Set<string>();

function statsToString(
  stats: Stats,
  json: StatsCompilation,
  statsConfig: StatsOptions,
  budgetFailures?: BudgetCalculatorResult[]
): string {
  if (!json.chunks?.length) {
    return '';
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const colors = statsConfig.colors!;
  const rs = (x: string) => (colors ? ansiColors.reset(x) : x);
  const w = (x: string) => (colors ? ansiColors.bold.white(x) : x);

  const changedChunksStats: BundleStats[] = [];
  let unchangedChunkNumber = 0;
  let hasEstimatedTransferSizes = false;

  const isFirstRun = !runsCache.has(json.outputPath || '');

  for (const chunk of json.chunks) {
    // During first build we want to display unchanged chunks
    // but unchanged cached chunks are always marked as not rendered.
    if (!isFirstRun && !chunk.rendered) {
      continue;
    }

    const assets = json.assets?.filter((asset) =>
      chunk.files?.includes(asset.name)
    );
    let rawSize = 0;
    let estimatedTransferSize;
    if (assets) {
      for (const asset of assets) {
        if (asset.name.endsWith('.map')) {
          continue;
        }

        rawSize += asset.size;

        const compilationAsset = stats.compilation.getAsset(asset.name);
        const assetInfo = compilationAsset ? compilationAsset.info : undefined;
        if (assetInfo) {
          if (typeof assetInfo.estimatedTransferSize === 'number') {
            if (estimatedTransferSize === undefined) {
              estimatedTransferSize = 0;
              hasEstimatedTransferSizes = true;
            }
            estimatedTransferSize += assetInfo.estimatedTransferSize;
          }
        }
      }
    }
    changedChunksStats.push(
      generateBundleStats({ ...chunk, rawSize, estimatedTransferSize })
    );
  }
  unchangedChunkNumber = json.chunks.length - changedChunksStats.length;

  runsCache.add(json.outputPath || '');

  const statsTable = generateBuildStatsTable(
    changedChunksStats,
    colors,
    unchangedChunkNumber === 0,
    hasEstimatedTransferSizes,
    budgetFailures
  );

  // In some cases we do things outside of rspack context
  // Such us index generation, service worker augmentation etc...
  // This will correct the time and include these.
  const time = getBuildDuration(json);

  return rs(
    `\n${statsTable}\n\n` +
      (unchangedChunkNumber > 0
        ? `${unchangedChunkNumber} unchanged chunks\n\n`
        : '') +
      `Build at: ${w(new Date().toISOString())} - Hash: ${w(
        json.hash || ''
      )} - Time: ${w('' + time)}ms`
  );
}

export function statsWarningsToString(
  json: StatsCompilation,
  statsConfig: RspackStatsOptions
): string {
  const colors = statsConfig.colors;
  const c = (x: string) => (colors ? ansiColors.reset.cyan(x) : x);
  const y = (x: string) => (colors ? ansiColors.reset.yellow(x) : x);
  const yb = (x: string) => (colors ? ansiColors.reset.yellowBright(x) : x);

  const warnings = json.warnings ? [...json.warnings] : [];
  if (json.children) {
    warnings.push(
      ...json.children
        .map((c) => c.warnings ?? [])
        .reduce((a, b) => [...a, ...b], [])
    );
  }

  let output = '';
  for (const warning of warnings) {
    if (typeof warning === 'string') {
      output += yb(`Warning: ${warning}\n\n`);
    } else {
      let file = warning.file || warning.moduleName;
      // Clean up warning paths
      // Ex: ./src/app/styles.scss.rspack[javascript/auto]!=!./node_modules/css-loader/dist/cjs.js....
      // to ./src/app/styles.scss.rspack
      if (file && !statsConfig.errorDetails) {
        const rpsackPathIndex = file.indexOf('.rspack[');
        if (rpsackPathIndex !== -1) {
          file = file.substring(0, rpsackPathIndex);
        }
        const rspackLoadersIndex = file.indexOf('!=!');
        if (rspackLoadersIndex !== -1) {
          file = file.substring(0, rspackLoadersIndex);
        }
      }

      if (file) {
        output += c(file);
        if (warning.loc) {
          output += ':' + yb(warning.loc);
        }
        output += ' - ';
      }
      if (!/^error/i.test(warning.message)) {
        const errorIndex = warning.message.indexOf('Error: ');
        warning.message = warning.message.substring(errorIndex + 7);
      }
      if (!/^warning/i.test(warning.message)) {
        output += y('Warning: ');
      }
      output += `${warning.message}\n\n`;
    }
  }

  return output ? '\n' + output : output;
}

export function statsErrorsToString(
  json: StatsCompilation,
  statsConfig: RspackStatsOptions
): string {
  const colors = statsConfig.colors;
  const c = (x: string) => (colors ? ansiColors.reset.cyan(x) : x);
  const yb = (x: string) => (colors ? ansiColors.reset.yellowBright(x) : x);
  const r = (x: string) => (colors ? ansiColors.reset.redBright(x) : x);

  const errors = json.errors ? [...json.errors] : [];
  if (json.children) {
    errors.push(
      ...json.children
        .map((c) => c?.errors || [])
        .reduce((a, b) => [...a, ...b], [])
    );
  }

  let output = '';
  for (const error of errors) {
    if (typeof error === 'string') {
      output += r(`Error: ${error}\n\n`);
    } else {
      let file = error.file || error.moduleName;
      // Clean up error paths
      // Ex: ./src/app/styles.scss.rspack[javascript/auto]!=!./node_modules/css-loader/dist/cjs.js....
      // to ./src/app/styles.scss.rspack
      if (file && !statsConfig.errorDetails) {
        const rspackPathIndex = file.indexOf('.rspack[');
        if (rspackPathIndex !== -1) {
          file = file.substring(0, rspackPathIndex);
        }
        const rspackLoadersIndex = file.indexOf('!=!');
        if (rspackLoadersIndex !== -1) {
          file = file.substring(0, rspackLoadersIndex);
        }
      }

      if (file) {
        output += c(file);
        if (error.loc) {
          output += ':' + yb(error.loc);
        }
        output += ' - ';
      }

      // In most cases rspack will add stack traces to error messages.
      // This below cleans up the error from stacks.
      // See: https://github.com/webpack/webpack/issues/15980
      const index = error.message.search(/[\n\s]+at /);
      const message =
        statsConfig.errorStack || index === -1
          ? error.message
          : error.message.substring(0, index);

      if (!/^error/i.test(message)) {
        output += r('Error: ');
      }
      output += `${message}\n\n`;
    }
  }

  return output ? '\n' + output : output;
}

export function statsHasErrors(json: StatsCompilation): boolean {
  return !!(
    json.errors?.length || json.children?.some((c) => c.errors?.length)
  );
}

export function statsHasWarnings(json: StatsCompilation): boolean {
  return !!(
    json.warnings?.length || json.children?.some((c) => c.warnings?.length)
  );
}

export function createRspackLoggingCallback(
  options: NormalizedAngularRspackPluginOptions
) {
  const { verbose = false, scripts = [], styles = [] } = options;
  const extraEntryPoints = [
    ...normalizeExtraEntryPoints(styles, 'styles'),
    ...normalizeExtraEntryPoints(scripts, 'scripts'),
  ];

  return (stats, config) => {
    if (verbose && config.stats !== false) {
      const statsOptions = config.stats === true ? undefined : config.stats;
      console.info(stats.toString(statsOptions));
    }

    const rawStats = stats.toJson(getStatsOptions(false));
    const rspackStats = {
      ...rawStats,
      chunks: markAsyncChunksNonInitial(rawStats, extraEntryPoints),
    };

    rspackStatsLogger(rspackStats, config);
  };
}

export interface BuildEventStats {
  aot: boolean;
  optimization: boolean;
  allChunksCount: number;
  lazyChunksCount: number;
  initialChunksCount: number;
  changedChunksCount?: number;
  durationInMs: number;
  cssSizeInBytes: number;
  jsSizeInBytes: number;
  ngComponentCount: number;
}

export function generateBuildEventStats(
  rspackStats: StatsCompilation,
  options: NormalizedAngularRspackPluginOptions
): BuildEventStats {
  const { chunks = [], assets = [] } = rspackStats;

  let jsSizeInBytes = 0;
  let cssSizeInBytes = 0;
  let initialChunksCount = 0;
  let ngComponentCount = 0;
  let changedChunksCount = 0;

  const allChunksCount = chunks.length;
  const isFirstRun = !runsCache.has(rspackStats.outputPath || '');

  const chunkFiles = new Set<string>();
  for (const chunk of chunks) {
    if (!isFirstRun && chunk.rendered) {
      changedChunksCount++;
    }

    if (chunk.initial) {
      initialChunksCount++;
    }

    for (const file of chunk.files ?? []) {
      chunkFiles.add(file);
    }
  }

  for (const asset of assets) {
    if (asset.name.endsWith('.map') || !chunkFiles.has(asset.name)) {
      continue;
    }

    if (asset.name.endsWith('.js')) {
      jsSizeInBytes += asset.size;
      ngComponentCount += asset.info.ngComponentCount ?? 0;
    } else if (asset.name.endsWith('.css')) {
      cssSizeInBytes += asset.size;
    }
  }

  return {
    optimization: normalizeOptimization(options.optimization).scripts,
    aot: options.aot,
    allChunksCount,
    lazyChunksCount: allChunksCount - initialChunksCount,
    initialChunksCount,
    changedChunksCount,
    durationInMs: getBuildDuration(rspackStats),
    cssSizeInBytes,
    jsSizeInBytes,
    ngComponentCount,
  };
}

export function rspackStatsLogger(
  stats: Stats,
  statOptions: StatsOptions,
  budgetFailures?: BudgetCalculatorResult[]
): void {
  const json = stats.toJson();
  console.log(statsToString(stats, json, statOptions, budgetFailures));

  if (typeof stats !== 'object') {
    throw new Error('Invalid Rspack stats configuration.');
  }

  if (statsHasWarnings(json)) {
    console.warn(statsWarningsToString(json, statOptions));
  }

  if (statsHasErrors(json)) {
    console.log('Stats has errors');
    console.error(statsErrorsToString(json, statOptions));
  }
}
