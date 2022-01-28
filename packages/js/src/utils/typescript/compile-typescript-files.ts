import { ExecutorContext } from '@nrwl/devkit';
import {
  compileTypeScript,
  compileTypeScriptWatcher,
} from '@nrwl/workspace/src/utilities/typescript/compilation';
import type {
  CustomTransformers,
  Diagnostic,
  Program,
  SourceFile,
  TransformerFactory,
} from 'typescript';
import { createAsyncIterable } from '../create-async-iterable/create-async-iteratable';
import { NormalizedExecutorOptions } from '../schema';
import { loadTsPlugins } from './load-ts-plugins';

export async function* compileTypeScriptFiles(
  normalizedOptions: NormalizedExecutorOptions,
  context: ExecutorContext,
  postCompilationCallback: () => void | Promise<void>
) {
  const getResult = (success: boolean) => ({
    success,
    outfile: normalizedOptions.mainOutputPath,
  });

  const { compilerPluginHooks } = loadTsPlugins(normalizedOptions.transformers);

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

  const tscOptions = {
    outputPath: normalizedOptions.outputPath,
    projectName: context.projectName,
    projectRoot: normalizedOptions.projectRoot,
    tsConfig: normalizedOptions.tsConfig,
    watch: normalizedOptions.watch,
    getCustomTransformers,
  };

  return yield* createAsyncIterable<{ success: boolean; outfile: string }>(
    async ({ next, done }) => {
      if (normalizedOptions.watch) {
        compileTypeScriptWatcher(tscOptions, async (d: Diagnostic) => {
          if (d.code === 6194) {
            next(getResult(true));
          }
        });
      } else {
        const { success } = compileTypeScript(tscOptions);
        await postCompilationCallback();
        next(getResult(success));
        done();
      }
    }
  );
}
