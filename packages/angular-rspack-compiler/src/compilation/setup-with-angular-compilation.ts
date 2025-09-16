import type { RsbuildConfig } from '@rsbuild/core';
import {
  createAngularCompilation,
  AngularCompilation,
  SourceFileCache,
} from '../models';
import {
  setupCompilation,
  styleTransform,
  SetupCompilationOptions,
} from './setup-compilation';

export async function setupCompilationWithAngularCompilation(
  config: Pick<RsbuildConfig, 'source'>,
  options: SetupCompilationOptions,
  sourceFileCache?: SourceFileCache,
  angularCompilation?: AngularCompilation,
  modifiedFiles?: Set<string>
) {
  const { rootNames, compilerOptions, componentStylesheetBundler } =
    await setupCompilation(config, options);
  angularCompilation ??= await createAngularCompilation(
    !options.aot,
    options.hasServer,
    false
  );
  modifiedFiles ??= new Set(rootNames);

  const fileReplacements: Record<string, string> =
    options.fileReplacements.reduce((r, f) => {
      r[f.replace] = f.with;
      return r;
    }, {});

  try {
    const { referencedFiles } = await angularCompilation.initialize(
      config.source?.tsconfigPath ?? options.tsConfig,
      {
        sourceFileCache,
        fileReplacements,
        modifiedFiles,
        transformStylesheet: styleTransform(componentStylesheetBundler),
        processWebWorker(workerFile: string) {
          return workerFile;
        },
      },
      () => compilerOptions
    );
    if (sourceFileCache) {
      sourceFileCache.referencedFiles = referencedFiles;
    }
  } catch (e) {
    console.error('Failed to initialize Angular Compilation', e);
  }
  return angularCompilation;
}
