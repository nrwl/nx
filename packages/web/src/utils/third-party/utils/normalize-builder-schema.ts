/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { BuildOptions } from '../cli-files/models/build-options';
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
export type NormalizedBrowserBuilderSchema = BrowserBuilderSchema &
  BuildOptions & {
    sourceMap: SourceMapClass;
    assets: AssetPatternClass[];
    fileReplacements: NormalizedFileReplacement[];
    optimization: OptimizationClass;
  };

export function normalizeBrowserSchema(
  root: string,
  projectRoot: string,
  sourceRoot: string | undefined,
  options: BrowserBuilderSchema
): NormalizedBrowserBuilderSchema {
  const normalizedSourceMapOptions = normalizeSourceMaps(
    options.sourceMap || false
  );
  normalizedSourceMapOptions.vendor =
    normalizedSourceMapOptions.vendor || options.vendorSourceMap;

  return {
    ...options,
    assets: normalizeAssetPatterns(
      options.assets || [],
      root,
      projectRoot,
      sourceRoot
    ),
    fileReplacements: normalizeFileReplacements(
      options.fileReplacements || [],
      root
    ),
    optimization: normalizeOptimization(options.optimization),
    sourceMap: normalizedSourceMapOptions,

    statsJson: options.statsJson || false,
    forkTypeChecker: options.forkTypeChecker || false,
    budgets: options.budgets || [],
    scripts: options.scripts || [],
    styles: options.styles || [],
    stylePreprocessorOptions: {
      includePaths:
        (options.stylePreprocessorOptions &&
          options.stylePreprocessorOptions.includePaths) ||
        [],
    },
    lazyModules: options.lazyModules || [],
  };
}
