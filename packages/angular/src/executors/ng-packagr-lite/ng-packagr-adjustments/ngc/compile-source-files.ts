/**
 * Adapted from the original ng-packagr source.
 *
 * Changes made:
 * - Made sure ngccProcessor is optional.
 * - Use custom cacheCompilerHost instead of the one provided by ng-packagr.
 */

import type {
  CompilerOptions,
  ParsedConfiguration,
} from '@angular/compiler-cli';
import { BuildGraph } from 'ng-packagr/lib/graph/build-graph';
import {
  EntryPointNode,
  isEntryPointInProgress,
  isPackage,
  PackageNode,
} from 'ng-packagr/lib/ng-package/nodes';
import { NgccProcessor } from 'ng-packagr/lib/ngc/ngcc-processor';
import { augmentProgramWithVersioning } from 'ng-packagr/lib/ts/cache-compiler-host';
import { ngccTransformCompilerHost } from 'ng-packagr/lib/ts/ngcc-transform-compiler-host';
import * as log from 'ng-packagr/lib/utils/log';
import { ngCompilerCli } from 'ng-packagr/lib/utils/ng-compiler-cli';
import * as ts from 'typescript';
import { InlineStyleLanguage } from '../../../package/ng-packagr-adjustments/styles/stylesheet-processor';
import { StylesheetProcessor } from '../styles/stylesheet-processor';
import { cacheCompilerHost } from '../ts/cache-compiler-host';

export async function compileSourceFiles(
  graph: BuildGraph,
  tsConfig: ParsedConfiguration,
  moduleResolutionCache: ts.ModuleResolutionCache,
  extraOptions?: Partial<CompilerOptions>,
  stylesheetProcessor?: StylesheetProcessor,
  ngccProcessor?: NgccProcessor,
  watch?: boolean
) {
  const { NgtscProgram, formatDiagnostics } = await ngCompilerCli();

  const tsConfigOptions: CompilerOptions = {
    ...tsConfig.options,
    ...extraOptions,
  };
  const entryPoint: EntryPointNode = graph.find(isEntryPointInProgress());
  const ngPackageNode: PackageNode = graph.find(isPackage);
  const inlineStyleLanguage = ngPackageNode.data.inlineStyleLanguage;

  let tsCompilerHost = cacheCompilerHost(
    graph,
    entryPoint,
    tsConfigOptions,
    moduleResolutionCache,
    stylesheetProcessor,
    InlineStyleLanguage.css
  );

  if (ngccProcessor) {
    tsCompilerHost = ngccTransformCompilerHost(
      tsCompilerHost,
      tsConfigOptions,
      ngccProcessor,
      moduleResolutionCache
    );
  }

  const cache = entryPoint.cache;
  const sourceFileCache = cache.sourcesFileCache;

  // Create the Angular specific program that contains the Angular compiler
  const angularProgram = new NgtscProgram(
    tsConfig.rootNames,
    tsConfigOptions,
    tsCompilerHost,
    cache.oldNgtscProgram
  );

  const angularCompiler = angularProgram.compiler;
  const { ignoreForDiagnostics, ignoreForEmit } = angularCompiler;

  // SourceFile versions are required for builder programs.
  // The wrapped host inside NgtscProgram adds additional files that will not have versions.
  const typeScriptProgram = angularProgram.getTsProgram();
  augmentProgramWithVersioning(typeScriptProgram);

  let builder: ts.BuilderProgram | ts.EmitAndSemanticDiagnosticsBuilderProgram;
  if (watch) {
    builder = cache.oldBuilder =
      ts.createEmitAndSemanticDiagnosticsBuilderProgram(
        typeScriptProgram,
        tsCompilerHost,
        cache.oldBuilder
      );
    cache.oldNgtscProgram = angularProgram;
  } else {
    // When not in watch mode, the startup cost of the incremental analysis can be avoided by
    // using an abstract builder that only wraps a TypeScript program.
    builder = ts.createAbstractBuilder(typeScriptProgram, tsCompilerHost);
  }

  // Update semantic diagnostics cache
  const affectedFiles = new Set<ts.SourceFile>();

  // Analyze affected files when in watch mode for incremental type checking
  if ('getSemanticDiagnosticsOfNextAffectedFile' in builder) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = builder.getSemanticDiagnosticsOfNextAffectedFile(
        undefined,
        (sourceFile) => {
          // If the affected file is a TTC shim, add the shim's original source file.
          // This ensures that changes that affect TTC are typechecked even when the changes
          // are otherwise unrelated from a TS perspective and do not result in Ivy codegen changes.
          // For example, changing @Input property types of a directive used in another component's
          // template.
          if (
            ignoreForDiagnostics.has(sourceFile) &&
            sourceFile.fileName.endsWith('.ngtypecheck.ts')
          ) {
            // This file name conversion relies on internal compiler logic and should be converted
            // to an official method when available. 15 is length of `.ngtypecheck.ts`
            const originalFilename = sourceFile.fileName.slice(0, -15) + '.ts';
            const originalSourceFile = builder.getSourceFile(originalFilename);
            if (originalSourceFile) {
              affectedFiles.add(originalSourceFile);
            }

            return true;
          }

          return false;
        }
      );

      if (!result) {
        break;
      }

      affectedFiles.add(result.affected as ts.SourceFile);
    }
  }

  // Collect program level diagnostics
  const allDiagnostics: ts.Diagnostic[] = [
    ...angularCompiler.getOptionDiagnostics(),
    ...builder.getOptionsDiagnostics(),
    ...builder.getGlobalDiagnostics(),
  ];

  // Required to support asynchronous resource loading
  // Must be done before creating transformers or getting template diagnostics
  await angularCompiler.analyzeAsync();

  // Collect source file specific diagnostics
  for (const sourceFile of builder.getSourceFiles()) {
    if (!ignoreForDiagnostics.has(sourceFile)) {
      allDiagnostics.push(
        ...builder.getSyntacticDiagnostics(sourceFile),
        ...builder.getSemanticDiagnostics(sourceFile)
      );
    }

    if (sourceFile.isDeclarationFile) {
      continue;
    }

    // Collect sources that are required to be emitted
    if (
      !ignoreForEmit.has(sourceFile) &&
      !angularCompiler.incrementalDriver.safeToSkipEmit(sourceFile)
    ) {
      // If required to emit, diagnostics may have also changed
      if (!ignoreForDiagnostics.has(sourceFile)) {
        affectedFiles.add(sourceFile);
      }
    } else if (
      sourceFileCache &&
      !affectedFiles.has(sourceFile) &&
      !ignoreForDiagnostics.has(sourceFile)
    ) {
      // Use cached Angular diagnostics for unchanged and unaffected files
      const angularDiagnostics =
        sourceFileCache.getAngularDiagnostics(sourceFile);
      if (angularDiagnostics?.length) {
        allDiagnostics.push(...angularDiagnostics);
      }
    }
  }

  // Collect new Angular diagnostics for files affected by changes
  for (const affectedFile of affectedFiles) {
    const angularDiagnostics = angularCompiler.getDiagnosticsForFile(
      affectedFile,
      /** OptimizeFor.WholeProgram */ 1
    );

    allDiagnostics.push(...angularDiagnostics);
    sourceFileCache.updateAngularDiagnostics(affectedFile, angularDiagnostics);
  }

  const otherDiagnostics = [];
  const errorDiagnostics = [];
  for (const diagnostic of allDiagnostics) {
    if (diagnostic.category === ts.DiagnosticCategory.Error) {
      errorDiagnostics.push(diagnostic);
    } else {
      otherDiagnostics.push(diagnostic);
    }
  }

  if (otherDiagnostics.length) {
    log.msg(formatDiagnostics(errorDiagnostics));
  }

  if (errorDiagnostics.length) {
    throw new Error(formatDiagnostics(errorDiagnostics));
  }

  const transformers = angularCompiler.prepareEmit().transformers;
  for (const sourceFile of builder.getSourceFiles()) {
    if (!ignoreForEmit.has(sourceFile)) {
      builder.emit(sourceFile, undefined, undefined, undefined, transformers);
    }
  }
}
