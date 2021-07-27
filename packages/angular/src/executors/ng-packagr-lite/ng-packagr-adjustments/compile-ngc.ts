/**
 * Adapted from the original ngPackagr source.
 *
 * Excludes the ngcc compilation which is not needed
 * since these libraries will be compiled by the ngtsc.
 */

import { InjectionToken } from 'injection-js';
import type { Transform } from 'ng-packagr/lib/graph/transform';
import { transformFromPromise } from 'ng-packagr/lib/graph/transform';
import { provideTransform } from 'ng-packagr/lib/graph/transform.di';
import {
  isEntryPoint,
  isEntryPointInProgress,
} from 'ng-packagr/lib/ng-package/nodes';
import { compileSourceFiles } from 'ng-packagr/lib/ngc/compile-source-files';
import type { StylesheetProcessor as StylesheetProcessorClass } from 'ng-packagr/lib/styles/stylesheet-processor';
import { STYLESHEET_PROCESSOR_TOKEN } from 'ng-packagr/lib/styles/stylesheet-processor.di';
import { setDependenciesTsConfigPaths } from 'ng-packagr/lib/ts/tsconfig';
import * as path from 'path';
import * as ts from 'typescript';

export const nxCompileNgcTransformFactory = (
  StylesheetProcessor: typeof StylesheetProcessorClass
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
      const { esm2015, declarations } = entryPoint.data.destinationFiles;
      const { moduleResolutionCache } = entryPoint.cache;
      const { basePath, cssUrl, styleIncludePaths } =
        entryPoint.data.entryPoint;
      const stylesheetProcessor = new StylesheetProcessor(
        basePath,
        cssUrl,
        styleIncludePaths
      );

      await compileSourceFiles(
        graph,
        tsConfig,
        moduleResolutionCache,
        stylesheetProcessor,
        {
          outDir: path.dirname(esm2015),
          declarationDir: path.dirname(declarations),
          declaration: true,
          target: ts.ScriptTarget.ES2015,
        }
      );
    } catch (error) {
      throw error;
    }

    return graph;
  });
};

export const NX_COMPILE_NGC_TOKEN = new InjectionToken<Transform>(
  `nx.v1.compileNgc`
);
export const NX_COMPILE_NGC_TRANSFORM = provideTransform({
  provide: NX_COMPILE_NGC_TOKEN,
  useFactory: nxCompileNgcTransformFactory,
  deps: [STYLESHEET_PROCESSOR_TOKEN],
});
