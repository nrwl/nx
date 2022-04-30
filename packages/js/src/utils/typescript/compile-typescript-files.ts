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
import { loadTsTransformers } from './load-ts-transformers';

const TYPESCRIPT_FOUND_N_ERRORS_WATCHING_FOR_FILE_CHANGES = 6194;
// Typescript diagnostic message for 6194: Found {0} errors. Watching for file changes.
// https://github.com/microsoft/TypeScript/blob/d45012c5e2ab122919ee4777a7887307c5f4a1e0/src/compiler/diagnosticMessages.json#L4763-L4766
const ERROR_COUNT_REGEX = /Found (\d+) errors/;

function getErrorCountFromMessage(messageText: string) {
  return Number.parseInt(ERROR_COUNT_REGEX.exec(messageText)[1]);
}

export async function* compileTypeScriptFiles(
  normalizedOptions: NormalizedExecutorOptions,
  context: ExecutorContext,
  postCompilationCallback: () => void | Promise<void>
) {
  const getResult = (success: boolean) => ({
    success,
    outfile: normalizedOptions.mainOutputPath,
  });

  const { compilerPluginHooks } = loadTsTransformers(
    normalizedOptions.transformers
  );

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
          if (d.code === TYPESCRIPT_FOUND_N_ERRORS_WATCHING_FOR_FILE_CHANGES) {
            await postCompilationCallback();
            next(
              getResult(getErrorCountFromMessage(d.messageText as string) === 0)
            );
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
