/**
 * Adapted from the original ng-packagr source.
 *
 * Changes made:
 * - Use our own StylesheetProcessor files instead of the ones provide by ng-packagr.
 * - Support ngcc for Angular < 16.
 * - Support ESM2020 for Angular < 16.
 */

import {
  Transform,
  transformFromPromise,
} from 'ng-packagr/lib/graph/transform';
import {
  EntryPointNode,
  isEntryPoint,
  isEntryPointInProgress,
} from 'ng-packagr/lib/ng-package/nodes';
import { setDependenciesTsConfigPaths } from 'ng-packagr/lib/ts/tsconfig';
import * as ora from 'ora';
import * as path from 'path';
import * as ts from 'typescript';
import { getInstalledAngularVersionInfo } from '../../../../utilities/angular-version-utils';
import { compileSourceFiles } from '../../ngc/compile-source-files';
import { StylesheetProcessor as StylesheetProcessorClass } from '../../styles/stylesheet-processor';
import { ngccCompilerCli } from '../../utils/ng-compiler-cli';
import { NgPackagrOptions } from '../options.di';

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

      const angularVersion = getInstalledAngularVersionInfo();

      // Compile TypeScript sources
      const { declarations } = entryPoint.data.destinationFiles;
      const esmModulePath =
        angularVersion.major < 16
          ? (entryPoint.data.destinationFiles as any).esm2020
          : entryPoint.data.destinationFiles.esm2022;
      const { basePath, cssUrl, styleIncludePaths } =
        entryPoint.data.entryPoint;
      const { moduleResolutionCache } = entryPoint.cache;

      spinner.start(
        `Compiling with Angular sources in Ivy ${
          tsConfig.options.compilationMode || 'full'
        } compilation mode.`
      );
      let ngccProcessor: any;
      if (angularVersion && angularVersion.major < 16) {
        ngccProcessor =
          new (require('ng-packagr/lib/ngc/ngcc-processor').NgccProcessor)(
            await ngccCompilerCli(),
            (entryPoint.cache as any).ngccProcessingCache,
            tsConfig.project,
            tsConfig.options,
            entryPoints
          );
        if (!entryPoint.data.entryPoint.isSecondaryEntryPoint) {
          // Only run the async version of NGCC during the primary entrypoint processing.
          await ngccProcessor.process();
        }
      }

      entryPoint.cache.stylesheetProcessor ??= new StylesheetProcessor(
        basePath,
        cssUrl,
        styleIncludePaths,
        options.cacheEnabled && options.cacheDirectory,
        options.watch,
        options.tailwindConfig
      ) as any;

      await compileSourceFiles(
        graph,
        tsConfig,
        moduleResolutionCache,
        {
          outDir: path.dirname(esmModulePath),
          declarationDir: path.dirname(declarations),
          declaration: true,
          target:
            angularVersion.major >= 16
              ? ts.ScriptTarget.ES2022
              : ts.ScriptTarget.ES2020,
        },
        entryPoint.cache.stylesheetProcessor as any,
        ngccProcessor,
        options.watch
      );
    } catch (error) {
      spinner.fail();
      throw error;
    }

    spinner.succeed();
    return graph;
  });
};
