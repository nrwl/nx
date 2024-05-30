/**
 * Adapted from the original ng-packagr source.
 *
 * Changes made:
 * - Use custom StylesheetProcessor instead of the one provided by ng-packagr.
 * - Support ngcc for Angular < 16.
 * - Support Angular Compiler `incrementalDriver` for Angular < 16.
 */

import { BuildGraph } from 'ng-packagr/lib/graph/build-graph';
import {
  EntryPointNode,
  PackageNode,
  isEntryPointInProgress,
  isPackage,
} from 'ng-packagr/lib/ng-package/nodes';
import * as log from 'ng-packagr/lib/utils/log';
import {
  augmentProgramWithVersioning,
  cacheCompilerHost,
} from 'ng-packagr/lib/ts/cache-compiler-host';
import { join } from 'node:path';
import * as ts from 'typescript';
import { getInstalledAngularVersionInfo } from '../../../utilities/angular-version-utils';
import { loadEsmModule } from '../../../utilities/module-loader';
import { NgPackagrOptions } from '../ng-package/options.di';
import { StylesheetProcessor } from '../styles/stylesheet-processor';

export async function compileSourceFiles(
  graph: BuildGraph,
  tsConfig: any,
  moduleResolutionCache: ts.ModuleResolutionCache,
  options: NgPackagrOptions,
  extraOptions?: Partial<ts.CompilerOptions>,
  stylesheetProcessor?: StylesheetProcessor,
  ngccProcessor?: any
) {
  const { NgtscProgram, formatDiagnostics } = await loadEsmModule(
    '@angular/compiler-cli'
  );
  const { cacheDirectory, watch, cacheEnabled } = options;
  const tsConfigOptions: ts.CompilerOptions = {
    ...tsConfig.options,
    ...extraOptions,
  };
  const entryPoint: EntryPointNode = graph.find(isEntryPointInProgress());
  const ngPackageNode: PackageNode = graph.find(isPackage);
  const inlineStyleLanguage = ngPackageNode.data.inlineStyleLanguage;

  const cacheDir = cacheEnabled && cacheDirectory;
  if (cacheDir) {
    tsConfigOptions.incremental ??= true;
    tsConfigOptions.tsBuildInfoFile ??= join(
      cacheDir,
      `tsbuildinfo/${entryPoint.data.entryPoint.flatModuleFile}.tsbuildinfo`
    );
  }

  let tsCompilerHost = cacheCompilerHost(
    graph,
    entryPoint,
    tsConfigOptions,
    moduleResolutionCache,
    stylesheetProcessor as any,
    inlineStyleLanguage
  );

  if (ngccProcessor) {
    tsCompilerHost =
      require('ng-packagr/lib/ts/ngcc-transform-compiler-host').ngccTransformCompilerHost(
        tsCompilerHost,
        tsConfigOptions,
        ngccProcessor,
        moduleResolutionCache
      );
  }

  const cache = entryPoint.cache;
  const sourceFileCache = cache.sourcesFileCache;
  let usingBuildInfo = false;

  let oldBuilder = cache.oldBuilder;
  if (!oldBuilder && cacheDir) {
    oldBuilder = ts.readBuilderProgram(tsConfigOptions, tsCompilerHost);
    usingBuildInfo = true;
  }

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
  if (watch || cacheDir) {
    builder = cache.oldBuilder =
      ts.createEmitAndSemanticDiagnosticsBuilderProgram(
        typeScriptProgram,
        tsCompilerHost,
        oldBuilder
      );
    cache.oldNgtscProgram = angularProgram;
  } else {
    builder = ts.createEmitAndSemanticDiagnosticsBuilderProgram(
      typeScriptProgram,
      tsCompilerHost
    );
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

    // Add all files with associated template type checking files.
    // Stored TS build info does not have knowledge of the AOT compiler or the typechecking state of the templates.
    // To ensure that errors are reported correctly, all AOT component diagnostics need to be analyzed even if build
    // info is present.
    if (usingBuildInfo) {
      for (const sourceFile of builder.getSourceFiles()) {
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
        }
      }
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
    if (ignoreForDiagnostics.has(sourceFile)) {
      continue;
    }

    allDiagnostics.push(
      ...builder.getDeclarationDiagnostics(sourceFile),
      ...builder.getSyntacticDiagnostics(sourceFile),
      ...builder.getSemanticDiagnostics(sourceFile)
    );

    // Declaration files cannot have template diagnostics
    if (sourceFile.isDeclarationFile) {
      continue;
    }

    // Only request Angular template diagnostics for affected files to avoid
    // overhead of template diagnostics for unchanged files.
    if (affectedFiles.has(sourceFile)) {
      const angularDiagnostics = angularCompiler.getDiagnosticsForFile(
        sourceFile,
        affectedFiles.size === 1
          ? /** OptimizeFor.SingleFile **/ 0
          : /** OptimizeFor.WholeProgram */ 1
      );

      allDiagnostics.push(...angularDiagnostics);
      sourceFileCache.updateAngularDiagnostics(sourceFile, angularDiagnostics);
    }
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

  if ('getSemanticDiagnosticsOfNextAffectedFile' in builder) {
    while (
      builder.emitNextAffectedFile(
        (fileName, data, writeByteOrderMark, onError, sourceFiles) => {
          if (fileName.endsWith('.tsbuildinfo')) {
            tsCompilerHost.writeFile(
              fileName,
              data,
              writeByteOrderMark,
              onError,
              sourceFiles
            );
          }
        }
      )
    ) {
      // empty
    }
  }

  const angularVersion = getInstalledAngularVersionInfo();
  const incrementalCompilation: typeof angularCompiler.incrementalCompilation =
    angularVersion.major < 16
      ? (angularCompiler as any).incrementalDriver
      : angularCompiler.incrementalCompilation;

  for (const sourceFile of builder.getSourceFiles()) {
    if (ignoreForEmit.has(sourceFile)) {
      continue;
    }

    if (incrementalCompilation.safeToSkipEmit(sourceFile)) {
      continue;
    }

    builder.emit(sourceFile, undefined, undefined, undefined, transformers);
    incrementalCompilation.recordSuccessfulEmit(sourceFile);
  }
}
