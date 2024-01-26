/**
 * Adapted from the original ngPackagr source.
 *
 * Changes made:
 * - Use our own StylesheetProcessor files instead of the ones provide by ng-packagr.
 * - Excludes the ngcc compilation for faster builds (angular < v16)
 * - Support ESM2020 for Angular < 16.
 */

import type { Transform } from 'ng-packagr/lib/graph/transform';
import { transformFromPromise } from 'ng-packagr/lib/graph/transform';
import {
  EntryPointNode,
  isEntryPoint,
  isEntryPointInProgress,
  isPackage,
  PackageNode,
} from 'ng-packagr/lib/ng-package/nodes';
import { setDependenciesTsConfigPaths } from 'ng-packagr/lib/ts/tsconfig';
import * as path from 'path';
import * as ts from 'typescript';
import { getInstalledAngularVersionInfo } from '../../../../../utilities/angular-version-utils';
import { compileSourceFiles } from '../../ngc/compile-source-files';
import { StylesheetProcessor as StylesheetProcessorClass } from '../../styles/stylesheet-processor';
import { NgPackagrOptions } from '../options.di';

export const nxCompileNgcTransformFactory = (
  StylesheetProcessor: typeof StylesheetProcessorClass,
  options: NgPackagrOptions
): Transform => {
  return transformFromPromise(async (graph) => {
    const entryPoints: EntryPointNode[] = graph.filter(isEntryPoint);
    const entryPoint: EntryPointNode = graph.find(isEntryPointInProgress());
    const ngPackageNode: PackageNode = graph.find(isPackage);
    const projectBasePath = ngPackageNode.data.primary.basePath;

    try {
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

      entryPoint.cache.stylesheetProcessor ??= new StylesheetProcessor(
        projectBasePath,
        basePath,
        cssUrl,
        styleIncludePaths,
        options.cacheEnabled && options.cacheDirectory,
        options.tailwindConfig
      ) as any;

      await compileSourceFiles(
        graph,
        tsConfig,
        moduleResolutionCache,
        options,
        {
          outDir: path.dirname(esmModulePath),
          declarationDir: path.dirname(declarations),
          declaration: true,
          target:
            angularVersion.major >= 16
              ? ts.ScriptTarget.ES2022
              : ts.ScriptTarget.ES2020,
        },
        entryPoint.cache.stylesheetProcessor as any
      );
    } catch (error) {
      throw error;
    }

    return graph;
  });
};
