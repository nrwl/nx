import { ExecutorContext } from '@nrwl/devkit';
import {
  compileTypeScript,
  compileTypeScriptWatcher,
} from '@nrwl/workspace/src/utilities/typescript/compilation';
import { Observable } from 'rxjs';
import type {
  CustomTransformers,
  Diagnostic,
  Program,
  SourceFile,
  TransformerFactory,
} from 'typescript';
import { NormalizedExecutorOptions } from '../schema';
import { loadTsPlugins } from './load-ts-plugins';

export function compileTypeScriptFiles(
  options: NormalizedExecutorOptions,
  context: ExecutorContext,
  postCompleteAction: () => void | Promise<void>
) {
  const { compilerPluginHooks } = loadTsPlugins(options.transformers);

  const getCustomTransformers = (program: Program): CustomTransformers => ({
    before: compilerPluginHooks.beforeHooks.map(
      (hook) => hook(program) as TransformerFactory<SourceFile>
    ),
    after: compilerPluginHooks.afterHooks.map(
      (hook) => hook(program) as TransformerFactory<SourceFile>
    ),
    afterDeclarations: compilerPluginHooks.afterDeclarationsHooks.map(
      (hook) => hook(program) as TransformerFactory<SourceFile>
    ),
  });

  // const tcsOptions = {
  //   outputPath: options.normalizedOutputPath,
  //   projectName: context.projectName,
  //   projectRoot: libRoot,
  //   tsConfig: tsConfigPath,
  //   deleteOutputPath: options.deleteOutputPath,
  //   rootDir: options.srcRootForCompilationRoot,
  //   watch: options.watch,
  //   getCustomTransformers,
  // };

  const tscOptions = {
    outputPath: options.outputPath,
    projectName: context.projectName,
    projectRoot: options.projectRoot,
    tsConfig: options.tsConfig,
    // deleteOutputPath: options.deleteOutputPath,
    // rootDir: options.srcRootForCompilationRoot,
    watch: options.watch,
    getCustomTransformers,
  };

  return new Observable((subscriber) => {
    if (options.watch) {
      const watcher = compileTypeScriptWatcher(
        tscOptions,
        async (d: Diagnostic) => {
          if (d.code === 6194) {
            await postCompleteAction();
            subscriber.next({ success: true });
          }
        }
      );

      return () => {
        watcher.close();
        subscriber.complete();
      };
    }

    const result = compileTypeScript(tscOptions);
    (postCompleteAction() as Promise<void>).then(() => {
      subscriber.next(result);
      subscriber.complete();
    });

    return () => {
      subscriber.complete();
    };
  });
}
