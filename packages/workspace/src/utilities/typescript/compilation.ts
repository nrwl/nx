import { logger } from '@nrwl/devkit';
import { removeSync } from 'fs-extra';
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
}

export function compileTypeScript(
  options: TypeScriptCompilationOptions
): { success: boolean } {
  const normalizedOptions = normalizeOptions(options);

  if (normalizedOptions.deleteOutputPath) {
    removeSync(normalizedOptions.outputPath);
  }
  const tsConfig = readTsConfig(normalizedOptions.tsConfig);
  tsConfig.options.outDir = normalizedOptions.outputPath;
  tsConfig.options.noEmitOnError = true;
  tsConfig.options.rootDir = normalizedOptions.rootDir;

  if (normalizedOptions.watch) {
    return createWatchProgram(tsConfig);
  } else {
    return createProgram(tsConfig, normalizedOptions.projectName);
  }
}

function createProgram(
  tsconfig: ts.ParsedCommandLine,
  projectName: string
): { success: boolean } {
  const host = ts.createCompilerHost(tsconfig.options);
  const program = ts.createProgram({
    rootNames: tsconfig.fileNames,
    options: tsconfig.options,
    host,
  });
  logger.info(`Compiling TypeScript files for project "${projectName}"...`);
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
    logger.info(
      `Done compiling TypeScript files for project "${projectName}".`
    );
    return { success: true };
  }
}

function createWatchProgram(
  tsconfig: ts.ParsedCommandLine
): { success: boolean } {
  const host = ts.createWatchCompilerHost(
    tsconfig.fileNames,
    tsconfig.options,
    ts.sys
  );
  ts.createWatchProgram(host);
  return { success: true };
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
