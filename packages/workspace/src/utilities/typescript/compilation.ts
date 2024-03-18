import { joinPathFragments, logger } from '@nx/devkit';
import { rmSync } from 'fs';
import type * as ts from 'typescript';
import type { CustomTransformers, Diagnostic, Program } from 'typescript';
import { readTsConfig } from '../ts-config';
import { ensureTypescript } from '../typescript';

let tsModule: typeof import('typescript');

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
    rmSync(normalizedOptions.outputPath, { recursive: true, force: true });
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
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const normalizedOptions = normalizeOptions(options);
  const tsConfig = getNormalizedTsConfig(normalizedOptions);

  if (normalizedOptions.deleteOutputPath) {
    rmSync(normalizedOptions.outputPath, { recursive: true, force: true });
  }

  const host = tsModule.createWatchCompilerHost(
    tsConfig.fileNames,
    tsConfig.options,
    tsModule.sys
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
      const consumerCustomTransformers = options.getCustomTransformers?.(
        builderProgram.getProgram()
      );

      const mergedCustomTransformers = mergeCustomTransformers(
        customTransformers,
        consumerCustomTransformers
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

  return tsModule.createWatchProgram(host);
}

function mergeCustomTransformers(
  originalCustomTransformers: CustomTransformers | undefined,
  consumerCustomTransformers: CustomTransformers | undefined
): CustomTransformers | undefined {
  if (!consumerCustomTransformers) return originalCustomTransformers;

  const mergedCustomTransformers: CustomTransformers = {};
  if (consumerCustomTransformers.before) {
    mergedCustomTransformers.before = originalCustomTransformers?.before
      ? [
          ...originalCustomTransformers.before,
          ...consumerCustomTransformers.before,
        ]
      : consumerCustomTransformers.before;
  }

  if (consumerCustomTransformers.after) {
    mergedCustomTransformers.after = originalCustomTransformers?.after
      ? [
          ...originalCustomTransformers.after,
          ...consumerCustomTransformers.after,
        ]
      : consumerCustomTransformers.after;
  }

  if (consumerCustomTransformers.afterDeclarations) {
    mergedCustomTransformers.afterDeclarations =
      originalCustomTransformers?.afterDeclarations
        ? [
            ...originalCustomTransformers.afterDeclarations,
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
  if (tsConfig.options.incremental && !tsConfig.options.tsBuildInfoFile) {
    tsConfig.options.tsBuildInfoFile = joinPathFragments(
      options.outputPath,
      'tsconfig.tsbuildinfo'
    );
  }
  return tsConfig;
}

function createProgram(
  tsconfig: ts.ParsedCommandLine,
  { projectName, getCustomTransformers }: TypeScriptCompilationOptions
): { success: boolean } {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const host = tsModule.createCompilerHost(tsconfig.options);
  const program = tsModule.createProgram({
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
    const diagnostics = tsModule.formatDiagnosticsWithColorAndContext(
      results.diagnostics,
      {
        getCurrentDirectory: () => tsModule.sys.getCurrentDirectory(),
        getNewLine: () => tsModule.sys.newLine,
        getCanonicalFileName: (name) => name,
      }
    );
    logger.error(diagnostics);
    return { success: false };
  } else {
    logger.info(
      `Done compiling TypeScript files for project "${projectName}".`
    );
    return { success: true };
  }
}

function normalizeOptions(
  options: TypeScriptCompilationOptions
): TypeScriptCompilationOptions {
  return {
    ...options,
    deleteOutputPath: options.deleteOutputPath ?? true,
    rootDir: options.rootDir ?? options.projectRoot,
  };
}
