
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */


import { Path, virtualFs } from '@angular-devkit/core';
import { BuildOptions } from '../angular-cli-files/models/build-options';
import {
  AssetPatternClass,
  OptimizationClass,
  Schema as BrowserBuilderSchema,
  SourceMapClass,
} from '../browser/schema';
import { normalizeAssetPatterns } from './normalize-asset-patterns';
import {
  NormalizedFileReplacement,
  normalizeFileReplacements,
} from './normalize-file-replacements';
import { normalizeOptimization } from './normalize-optimization';
import { normalizeSourceMaps } from './normalize-source-maps';


/**
 * A normalized browser builder schema.
 */
export type NormalizedBrowserBuilderSchema = BrowserBuilderSchema & BuildOptions & {
  sourceMap: SourceMapClass;
  assets: AssetPatternClass[];
  fileReplacements: NormalizedFileReplacement[];
  optimization: OptimizationClass;
};

export function normalizeBrowserSchema(
  host: virtualFs.Host<{}>,
  root: Path,
  projectRoot: Path,
  sourceRoot: Path | undefined,
  options: BrowserBuilderSchema,
): NormalizedBrowserBuilderSchema {
  const syncHost = new virtualFs.SyncDelegateHost(host);

  const normalizedSourceMapOptions = normalizeSourceMaps(options.sourceMap || false);
  normalizedSourceMapOptions.vendor = normalizedSourceMapOptions.vendor || options.vendorSourceMap;

  return {
    ...options,
    assets: normalizeAssetPatterns(options.assets || [], syncHost, root, projectRoot, sourceRoot),
    fileReplacements: normalizeFileReplacements(options.fileReplacements || [], syncHost, root),
    optimization: normalizeOptimization(options.optimization),
    sourceMap: normalizedSourceMapOptions,

    statsJson: options.statsJson || false,
    forkTypeChecker: options.forkTypeChecker || false,
    budgets: options.budgets || [],
    scripts: options.scripts || [],
    styles: options.styles || [],
    stylePreprocessorOptions: {
      includePaths: options.stylePreprocessorOptions
        && options.stylePreprocessorOptions.includePaths
        || [],
    },
    lazyModules: options.lazyModules || [],
  };
}
