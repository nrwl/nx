/**
 * Adapted from the original ngPackagr source.
 *
 * Excludes the ngcc compilation which is not needed
 * since these libraries will be compiled by the ngtsc.
 */

import type { Transform } from 'ng-packagr/lib/graph/transform';
import { transformFromPromise } from 'ng-packagr/lib/graph/transform';
import {
  isEntryPoint,
  isEntryPointInProgress,
} from 'ng-packagr/lib/ng-package/nodes';
import { NgPackagrOptions } from 'ng-packagr/lib/ng-package/options.di';
import type { StylesheetProcessor as StylesheetProcessorClass } from 'ng-packagr/lib/styles/stylesheet-processor';
import { setDependenciesTsConfigPaths } from 'ng-packagr/lib/ts/tsconfig';
import * as path from 'path';
import * as ts from 'typescript';
import { compileSourceFiles } from '../../ngc/compile-source-files';

export const nxCompileNgcTransformFactory = (
  StylesheetProcessor: typeof StylesheetProcessorClass,
  options: NgPackagrOptions
): Transform => {
  return transformFromPromise(async (graph) => {
    try {
      const entryPoint = graph.find(isEntryPointInProgress());
      const entryPoints = graph.filter(isEntryPoint);
      // Add paths mappings for dependencies
      const tsConfig = setDependenciesTsConfigPaths(
        entryPoint.data.tsConfig,
        entryPoints
      );

      // Compile TypeScript sources
      const { esm2020, declarations } = entryPoint.data.destinationFiles;
      const { basePath, cssUrl, styleIncludePaths } =
        entryPoint.data.entryPoint;
      const { moduleResolutionCache } = entryPoint.cache;

      entryPoint.cache.stylesheetProcessor ??= new StylesheetProcessor(
        basePath,
        cssUrl,
        styleIncludePaths,
        options.cacheEnabled && options.cacheDirectory
      );

      await compileSourceFiles(
        graph,
        tsConfig,
        moduleResolutionCache,
        {
          outDir: path.dirname(esm2020),
          declarationDir: path.dirname(declarations),
          declaration: true,
          target: ts.ScriptTarget.ES2020,
        },
        entryPoint.cache.stylesheetProcessor,
        null,
        options.watch
      );
    } catch (error) {
      throw error;
    }

    return graph;
  });
};
