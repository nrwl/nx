import { logger } from '@nrwl/devkit';
import { removeSync } from 'fs-extra';
import * as ts from 'typescript';
import { Diagnostic } from 'typescript';
import { readTsConfig } from '../typescript';

export interface TypeScriptCompilationOptions {
  outputPath: string;
  projectName: string;
  projectRoot: string;
  tsConfig: string;
  deleteOutputPath?: boolean;
  rootDir?: string;
  watch?: boolean;
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

  return createProgram(tsConfig, normalizedOptions.projectName);
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

  const original = host.onWatchStatusChange;
  host.onWatchStatusChange = async (a, b, c, d) => {
    original?.(a, b, c, d);
    await callback?.(a, b, c, d);
  };

  ts.createWatchProgram(host);
  return new Promise(() => {});
}

export function getNormalizedTsConfig(options: TypeScriptCompilationOptions) {
  const tsConfig = readTsConfig(options.tsConfig);
  tsConfig.options.outDir = options.outputPath;
  tsConfig.options.noEmitOnError = true;
  tsConfig.options.rootDir = options.rootDir;
  return tsConfig;
}

function createProgram(
  tsconfig: ts.ParsedCommandLine,
  projectName: string
): { success: boolean } {
  logger.info(`Compiling TypeScript files for project "${projectName}"...`);
  const results = emitTsProgram(tsconfig.options, tsconfig.fileNames);
  if (results && !results.emitSkipped) {
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

export function emitTsProgram(
  options: ts.CompilerOptions,
  rootNames: string[]
): ts.EmitResult | never {
  const host = ts.createCompilerHost(options);
  const program = ts.createProgram({
    rootNames,
    options,
    host,
  });
  const results = program.emit();
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
    return results;
  }
}
