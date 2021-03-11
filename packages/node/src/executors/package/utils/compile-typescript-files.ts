import { ExecutorContext, logger } from '@nrwl/devkit';
import * as ts from 'typescript';

import { NormalizedBuilderOptions } from './models';
import { removeSync } from 'fs-extra';
import { join } from 'path';
import {
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { readTsConfig } from '@nrwl/workspace/src/utilities/typescript';

async function createProgram(
  tsconfig: ts.ParsedCommandLine,
  context: ExecutorContext
) {
  const host = ts.createCompilerHost(tsconfig.options);
  const program = ts.createProgram({
    rootNames: tsconfig.fileNames,
    options: tsconfig.options,
    host,
  });
  logger.info(
    `Compiling TypeScript files for library ${context.projectName}...`
  );
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
      `Done compiling TypeScript files for library ${context.projectName}`
    );
    return { success: true };
  }
}

function createWatchProgram(tsconfig: ts.ParsedCommandLine) {
  const host = ts.createWatchCompilerHost(
    tsconfig.fileNames,
    tsconfig.options,
    ts.sys
  );
  ts.createWatchProgram(host);
  return { success: true };
}

export default async function compileTypeScriptFiles(
  options: NormalizedBuilderOptions,
  context: ExecutorContext,
  libRoot: string,
  projectDependencies: DependentBuildableProjectNode[]
) {
  removeSync(options.normalizedOutputPath);
  let tsConfigPath = join(context.root, options.tsConfig);
  if (projectDependencies.length > 0) {
    tsConfigPath = createTmpTsConfig(
      tsConfigPath,
      context.root,
      libRoot,
      projectDependencies
    );
  }

  const tsconfig = readTsConfig(tsConfigPath);
  tsconfig.options.outDir = options.normalizedOutputPath;
  tsconfig.options.noEmitOnError = true;

  if (options.srcRootForCompilationRoot) {
    tsconfig.options.rootDir = options.srcRootForCompilationRoot;
  } else {
    tsconfig.options.rootDir = libRoot;
  }

  if (options.watch) {
    return createWatchProgram(tsconfig);
  } else {
    return createProgram(tsconfig, context);
  }
}
