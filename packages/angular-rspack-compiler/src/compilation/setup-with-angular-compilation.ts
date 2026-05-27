import type { RsbuildConfig } from '@rsbuild/core';
import { join } from 'path';
import { mkdir } from 'fs/promises';

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

  // When a persistent cache directory is available, enable TypeScript's
  // incremental program and persist its `.tsbuildinfo` to that directory.
  if (
    sourceFileCache?.persistentCachePath &&
    compilerOptions['incremental'] !== false
  ) {
    // ensure path exists
    await mkdir(sourceFileCache.persistentCachePath, { recursive: true });
    compilerOptions['incremental'] = true;
    compilerOptions['tsBuildInfoFile'] = join(
      sourceFileCache.persistentCachePath,
      '.tsbuildinfo'
    );
  }
  angularCompilation ??= await createAngularCompilation(
    !options.aot,
    options.hasServer,
    false
  );

  // Drop the bundler's cached results for files the watcher reported as
  // modified so dependent stylesheets get rebuilt; skipped on the initial
  // build when there's nothing to invalidate.
  if (modifiedFiles) {
    componentStylesheetBundler.invalidate(modifiedFiles);
  }

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
