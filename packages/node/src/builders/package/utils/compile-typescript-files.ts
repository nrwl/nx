import { BuilderContext, BuilderOutput } from '@angular-devkit/architect';
import {
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utils/buildable-libs-utils';
import { NormalizedBuilderOptions } from './models';
import { removeSync } from 'fs-extra';
import { join } from 'path';
import { readTsConfig } from '@nrwl/workspace';
import { Observable, Subscriber } from 'rxjs';
import * as ts from 'typescript';

function createProgram(
  tsconfig: ts.ParsedCommandLine,
  context: BuilderContext
) {
  const host = ts.createCompilerHost(tsconfig.options);
  const program = ts.createProgram({
    rootNames: tsconfig.fileNames,
    options: tsconfig.options,
    host,
  });

  return new Observable((subscriber: Subscriber<BuilderOutput>) => {
    context.logger.info(
      `Compiling TypeScript files for library ${context.target?.project}...`
    );
    try {
      program.emit();
      context.logger.info(
        `Done compiling TypeScript files for library ${context.target?.project}`
      );
      subscriber.next({ success: true });
    } catch {
      subscriber.error('Could not compile Typescript files');
    } finally {
      subscriber.complete();
    }
  });
}

function createWatchProgram(tsconfig: ts.ParsedCommandLine) {
  const host = ts.createWatchCompilerHost(
    tsconfig.fileNames,
    tsconfig.options,
    ts.sys
  );
  ts.createWatchProgram(host);
  return new Observable((subscriber: Subscriber<BuilderOutput>) => {
    subscriber.next({ success: true });
  });
}

export default function compileTypeScriptFiles(
  options: NormalizedBuilderOptions,
  context: BuilderContext,
  libRoot: string,
  projectDependencies: DependentBuildableProjectNode[]
) {
  removeSync(options.normalizedOutputPath);
  let tsConfigPath = join(context.workspaceRoot, options.tsConfig);
  if (projectDependencies.length > 0) {
    tsConfigPath = createTmpTsConfig(
      tsConfigPath,
      context.workspaceRoot,
      libRoot,
      projectDependencies
    );
  }

  const tsconfig = readTsConfig(tsConfigPath);
  tsconfig.options.outDir = options.normalizedOutputPath;
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
