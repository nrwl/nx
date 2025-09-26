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
  StylesheetTransformResult,
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

  // Store collected stylesheet output files
  const collectedStylesheetAssets: Array<{ path: string; text: string }> = [];

  // Create a wrapper around styleTransform to collect outputFiles
  const transformFn = styleTransform(componentStylesheetBundler);
  const wrappedTransformStylesheet = async (
    styles: string,
    containingFile: string,
    stylesheetFile?: string
  ) => {
    const result = await transformFn(styles, containingFile, stylesheetFile);

    // Collect outputFiles if present
    if (result.outputFiles && result.outputFiles.length > 0) {
      collectedStylesheetAssets.push(...result.outputFiles);
    }

    // Return just the contents string as expected by Angular compilation
    return result.contents;
  };

  try {
    const { referencedFiles } = await angularCompilation.initialize(
      config.source?.tsconfigPath ?? options.tsConfig,
      {
        sourceFileCache,
        fileReplacements,
        modifiedFiles,
        transformStylesheet: wrappedTransformStylesheet,
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
  return {
    angularCompilation,
    collectedStylesheetAssets,
  };
}
