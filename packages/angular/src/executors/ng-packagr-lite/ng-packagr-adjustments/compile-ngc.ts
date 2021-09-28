/**
 * Adapted from the original ngPackagr source.
 *
 * Excludes the ngcc compilation which is not needed
 * since these libraries will be compiled by the ngtsc.
 */

import { InjectionToken, Provider } from 'injection-js';
import type { Transform } from 'ng-packagr/lib/graph/transform';
import { transformFromPromise } from 'ng-packagr/lib/graph/transform';
import { provideTransform } from 'ng-packagr/lib/graph/transform.di';
import {
  isEntryPoint,
  isEntryPointInProgress,
} from 'ng-packagr/lib/ng-package/nodes';
import {
  NgPackagrOptions,
  OPTIONS_TOKEN,
} from 'ng-packagr/lib/ng-package/options.di';
import { compileSourceFiles } from './compile-source-files';
import type { StylesheetProcessor as StylesheetProcessorClass } from 'ng-packagr/lib/styles/stylesheet-processor';
import {
  STYLESHEET_PROCESSOR,
  STYLESHEET_PROCESSOR_TOKEN,
} from 'ng-packagr/lib/styles/stylesheet-processor.di';
import { setDependenciesTsConfigPaths } from 'ng-packagr/lib/ts/tsconfig';
import * as path from 'path';
import * as ts from 'typescript';

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

export const NX_COMPILE_NGC_TOKEN = new InjectionToken<Transform>(
  `nx.v1.compileNgc`
);
export const NX_COMPILE_NGC_TRANSFORM = provideTransform({
  provide: NX_COMPILE_NGC_TOKEN,
  useFactory: nxCompileNgcTransformFactory,
  deps: [STYLESHEET_PROCESSOR_TOKEN, OPTIONS_TOKEN],
});
export const NX_COMPILE_NGC_PROVIDERS: Provider[] = [
  STYLESHEET_PROCESSOR,
  NX_COMPILE_NGC_TRANSFORM,
];
