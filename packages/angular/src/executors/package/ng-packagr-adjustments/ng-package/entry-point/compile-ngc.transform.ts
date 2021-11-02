/**
 * Adapted from the original ng-packagr source.
 *
 * Changes made:
 * - Use our own StylesheetProcessor files instead of the ones provide by ng-packagr.
 */

import {
  Transform,
  transformFromPromise,
} from 'ng-packagr/lib/graph/transform';
import * as ivy from 'ng-packagr/lib/ivy';
import {
  EntryPointNode,
  isEntryPoint,
  isEntryPointInProgress,
} from 'ng-packagr/lib/ng-package/nodes';
import { NgPackagrOptions } from 'ng-packagr/lib/ng-package/options.di';
import { compileSourceFiles } from 'ng-packagr/lib/ngc/compile-source-files';
import { NgccProcessor } from 'ng-packagr/lib/ngc/ngcc-processor';
import { setDependenciesTsConfigPaths } from 'ng-packagr/lib/ts/tsconfig';
import * as ora from 'ora';
import * as path from 'path';
import * as ts from 'typescript';
import { StylesheetProcessor as IvyStylesheetProcessor } from '../../ivy/styles/stylesheet-processor';
import { StylesheetProcessor as StylesheetProcessorClass } from '../../styles/stylesheet-processor';

function isEnabled(variable: string | undefined): variable is string {
  return (
    typeof variable === 'string' &&
    (variable === '1' || variable.toLowerCase() === 'true')
  );
}

export const compileNgcTransformFactory = (
  StylesheetProcessor: typeof StylesheetProcessorClass,
  options: NgPackagrOptions
): Transform => {
  return transformFromPromise(async (graph) => {
    const spinner = ora({
      hideCursor: false,
      discardStdin: false,
    });

    try {
      const entryPoint: EntryPointNode = graph.find(isEntryPointInProgress());
      const entryPoints: EntryPointNode[] = graph.filter(isEntryPoint);
      // Add paths mappings for dependencies
      const tsConfig = setDependenciesTsConfigPaths(
        entryPoint.data.tsConfig,
        entryPoints
      );

      // Compile TypeScript sources
      const { esm2015, declarations } = entryPoint.data.destinationFiles;
      const { basePath, cssUrl, styleIncludePaths } =
        entryPoint.data.entryPoint;
      const { moduleResolutionCache, ngccProcessingCache } = entryPoint.cache;

      let ngccProcessor: NgccProcessor | undefined;
      if (tsConfig.options.enableIvy !== false) {
        spinner.start(
          `Compiling with Angular sources in Ivy ${
            tsConfig.options.compilationMode || 'full'
          } compilation mode.`
        );
        ngccProcessor = new NgccProcessor(
          ngccProcessingCache,
          tsConfig.project,
          tsConfig.options,
          entryPoints
        );
        if (!entryPoint.data.entryPoint.isSecondaryEntryPoint) {
          // Only run the async version of NGCC during the primary entrypoint processing.
          await ngccProcessor.process();
        }
      } else {
        spinner.start(
          `Compiling with Angular in legacy View Engine compilation mode.`
        );
      }

      if (
        tsConfig.options.enableIvy !== false &&
        !isEnabled(process.env['NG_BUILD_LIB_LEGACY'])
      ) {
        entryPoint.cache.stylesheetProcessor ??= new IvyStylesheetProcessor(
          basePath,
          cssUrl,
          styleIncludePaths
        ) as any;

        await ivy.compileSourceFiles(
          graph,
          tsConfig,
          moduleResolutionCache,
          {
            outDir: path.dirname(esm2015),
            declarationDir: path.dirname(declarations),
            declaration: true,
            target: ts.ScriptTarget.ES2015,
          },
          entryPoint.cache.stylesheetProcessor as any,
          ngccProcessor,
          options.watch
        );
      } else {
        entryPoint.cache.stylesheetProcessor ??= new StylesheetProcessor(
          basePath,
          cssUrl,
          styleIncludePaths,
          options.watch
        ) as any;
        await compileSourceFiles(
          graph,
          tsConfig,
          moduleResolutionCache,
          entryPoint.cache.stylesheetProcessor as any,
          {
            outDir: path.dirname(esm2015),
            declarationDir: path.dirname(declarations),
            declaration: true,
            target: ts.ScriptTarget.ES2015,
          },
          ngccProcessor
        );
      }
    } catch (error) {
      spinner.fail();
      throw error;
    }

    spinner.succeed();
    return graph;
  });
};
