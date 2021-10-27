import { logger } from '@nrwl/devkit';
import { removeSync } from 'fs-extra';
import type { CustomTransformers, Diagnostic, Program } from 'typescript';
import * as ts from 'typescript';
import { readTsConfig } from '../typescript';

export interface TypeScriptCompilationOptions {
  outputPath: string;
  projectName: string;
  projectRoot: string;
  tsConfig: string;
  deleteOutputPath?: boolean;
  rootDir?: string;
  watch?: boolean;

  getCustomTransformers?(program: Program): CustomTransformers;
}

export interface TypescriptWatchChangeEvent {
  diagnostic: ts.Diagnostic;
  newLine: string;
  options: ts.CompilerOptions;
  errorCount: number;
}

export function compileTypeScript(options: TypeScriptCompilationOptions): {
  success: boolean;
} {
  const normalizedOptions = normalizeOptions(options);
  const tsConfig = getNormalizedTsConfig(normalizedOptions);

  if (normalizedOptions.deleteOutputPath) {
    removeSync(normalizedOptions.outputPath);
  }

  return createProgram(tsConfig, normalizedOptions);
}

export function compileTypeScriptWatcher(
  options: TypeScriptCompilationOptions,
  callback: (
    diagnostic: Diagnostic,
    newLine: string,
    options: ts.CompilerOptions,
    errorCount: number
  ) => void | Promise<void>
): Promise<any> {
  const normalizedOptions = normalizeOptions(options);
  const tsConfig = getNormalizedTsConfig(normalizedOptions);

  if (normalizedOptions.deleteOutputPath) {
    removeSync(normalizedOptions.outputPath);
  }

  const host = ts.createWatchCompilerHost(
    tsConfig.fileNames,
    tsConfig.options,
    ts.sys
  );

  const originalAfterProgramCreate = host.afterProgramCreate;
  host.afterProgramCreate = (builderProgram) => {
    const originalProgramEmit = builderProgram.emit;
    builderProgram.emit = (
      targetSourceFile,
      writeFile,
      cancellationToken,
      emitOnlyDtsFiles,
      customTransformers
    ) => {
      const consumerCustomTransfomers = options.getCustomTransformers?.(
        builderProgram.getProgram()
      );

      const mergedCustomTransformers = mergeCustomTransformers(
        customTransformers,
        consumerCustomTransfomers
      );

      return originalProgramEmit(
        targetSourceFile,
        writeFile,
        cancellationToken,
        emitOnlyDtsFiles,
        mergedCustomTransformers
      );
    };

    if (originalAfterProgramCreate) originalAfterProgramCreate(builderProgram);
  };

  const originalOnWatchStatusChange = host.onWatchStatusChange;
  host.onWatchStatusChange = async (a, b, c, d) => {
    originalOnWatchStatusChange?.(a, b, c, d);
    await callback?.(a, b, c, d);
  };

  ts.createWatchProgram(host);
  return new Promise(() => {});
}

function mergeCustomTransformers(
  originalCustomTransfomers: CustomTransformers | undefined,
  consumerCustomTransformers: CustomTransformers | undefined
): CustomTransformers | undefined {
  if (!consumerCustomTransformers) return originalCustomTransfomers;

  const mergedCustomTransformers: CustomTransformers = {};
  if (consumerCustomTransformers.before) {
    mergedCustomTransformers.before = originalCustomTransfomers?.before
      ? [
          ...originalCustomTransfomers.before,
          ...consumerCustomTransformers.before,
        ]
      : consumerCustomTransformers.before;
  }

  if (consumerCustomTransformers.after) {
    mergedCustomTransformers.after = originalCustomTransfomers?.after
      ? [
          ...originalCustomTransfomers.after,
          ...consumerCustomTransformers.after,
        ]
      : consumerCustomTransformers.after;
  }

  if (consumerCustomTransformers.afterDeclarations) {
    mergedCustomTransformers.afterDeclarations =
      originalCustomTransfomers?.afterDeclarations
        ? [
            ...originalCustomTransfomers.afterDeclarations,
            ...consumerCustomTransformers.afterDeclarations,
          ]
        : consumerCustomTransformers.afterDeclarations;
  }

  return mergedCustomTransformers;
}

function getNormalizedTsConfig(options: TypeScriptCompilationOptions) {
  const tsConfig = readTsConfig(options.tsConfig);
  tsConfig.options.outDir = options.outputPath;
  tsConfig.options.noEmitOnError = true;
  tsConfig.options.rootDir = options.rootDir;
  return tsConfig;
}

function createProgram(
  tsconfig: ts.ParsedCommandLine,
  { projectName, getCustomTransformers }: TypeScriptCompilationOptions
): { success: boolean } {
  const host = ts.createCompilerHost(tsconfig.options);
  const program = ts.createProgram({
    rootNames: tsconfig.fileNames,
    options: tsconfig.options,
    host,
  });
  logger.info(`Compiling TypeScript files for project "${projectName}"...`);
  const results = program.emit(
    undefined,
    undefined,
    undefined,
    undefined,
    getCustomTransformers?.(program)
  );
  if (results.emitSkipped) {
    const diagnostics = ts.formatDiagnosticsWithColorAndContext(
      results.diagnostics,
      {
        getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
        getNewLine: () => ts.sys.newLine,
        getCanonicalFileName: (name) => name,
      }
    );
    logger.error(diagnostics);
    throw new Error(diagnostics);
  } else {
    logger.info(
      `Done compiling TypeScript files for project "${projectName}".`
    );
    return { success: true };
  }
}

export function normalizeOptions(
  options: TypeScriptCompilationOptions
): TypeScriptCompilationOptions {
  return {
    ...options,
    deleteOutputPath: options.deleteOutputPath ?? true,
    rootDir: options.rootDir ?? options.projectRoot,
  };
}
