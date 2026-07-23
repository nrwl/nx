import type { RsbuildConfig } from '@rsbuild/core';
import { join } from 'node:path';
import {
  createAngularCompilation,
  AngularCompilation,
  SourceFileCache,
  toTypeScriptFileCacheKey,
} from '../models';
import {
  setupCompilation,
  styleTransform,
  SetupCompilationOptions,
} from './setup-compilation';

/**
 * The files bundled into a component stylesheet, keyed by the stylesheet
 * they were bundled from. Used to attribute package licenses.
 */
export interface StylesheetMetafileInputs {
  source: string;
  inputs: Record<string, { bytesInOutput: number }>;
}

export async function setupCompilationWithAngularCompilation(
  config: Pick<RsbuildConfig, 'source'>,
  options: SetupCompilationOptions,
  sourceFileCache?: SourceFileCache,
  angularCompilation?: AngularCompilation,
  modifiedFiles?: Set<string>
) {
  const {
    rootNames,
    compilerOptions,
    componentStylesheetBundler,
    setupWarnings,
  } = await setupCompilation(config, options);

  // Persist the TypeScript incremental state to the cache directory when one
  // is available so later cold builds resume from it.
  if (
    sourceFileCache?.persistentCachePath &&
    compilerOptions.incremental !== false
  ) {
    compilerOptions.incremental = true;
    compilerOptions.tsBuildInfoFile = join(
      sourceFileCache.persistentCachePath,
      '.tsbuildinfo'
    );
  } else {
    compilerOptions.incremental = false;
  }

  // Mirrors @angular/build's NG_BUILD_PARALLEL_TS switch: anything but
  // 0/false runs the Angular compilation in a worker thread, so type
  // checking overlaps with the bundling work.
  const parallelTs = process.env['NG_BUILD_PARALLEL_TS'];
  let createdAngularCompilation = false;
  if (!angularCompilation) {
    try {
      angularCompilation = await createAngularCompilation(
        !options.aot,
        !options.hasServer,
        parallelTs !== '0' && parallelTs?.toLowerCase() !== 'false'
      );
    } catch (error) {
      attachSetupWarnings(error, setupWarnings);
      throw error;
    }
    createdAngularCompilation = true;
  }

  // Drop the bundler's cached results for changed files so dependent
  // stylesheets get rebuilt; there's nothing to invalidate on the first build.
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
  const collectedStylesheetMetafileInputs: StylesheetMetafileInputs[] = [];

  // Create a wrapper around styleTransform to collect outputFiles
  const transformFn = styleTransform(componentStylesheetBundler);
  const wrappedTransformStylesheet = async (
    styles: string,
    containingFile: string,
    stylesheetFile?: string,
    order?: number,
    className?: string
  ) => {
    const result = await transformFn(styles, containingFile, stylesheetFile);

    // Collect outputFiles if present
    if (result.outputFiles && result.outputFiles.length > 0) {
      collectedStylesheetAssets.push(...result.outputFiles);
    }

    if (result.metafile) {
      // Inline styles share the containing file; disambiguate with the
      // class name and order so entries stay unique per stylesheet.
      let source = stylesheetFile ?? containingFile;
      if (!stylesheetFile) {
        source += `?class=${className}&order=${order}`;
      }
      const inputs: StylesheetMetafileInputs['inputs'] = {};
      for (const output of Object.values(result.metafile.outputs)) {
        Object.assign(inputs, output.inputs);
      }
      collectedStylesheetMetafileInputs.push({ source, inputs });
    }

    // Return just the contents string as expected by Angular compilation
    return result.contents;
  };

  // Initialization errors are rethrown for callers to surface as build
  // errors instead of continuing with a compilation that was never
  // initialized.
  let initializationResult;
  try {
    initializationResult = await angularCompilation.initialize(
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
  } catch (error) {
    // A worker-based compilation spawns its worker thread on construction;
    // close one created here or every failing setup would leak a worker.
    // A caller-provided compilation stays alive for the caller to reuse.
    if (createdAngularCompilation) {
      try {
        await angularCompilation.close?.();
      } catch {
        // The initialization error is the one worth surfacing.
      }
    }
    attachSetupWarnings(error, setupWarnings);
    throw error;
  }
  const {
    compilerOptions: initializedCompilerOptions,
    referencedFiles,
    componentResourcesDependencies,
  } = initializationResult;
  if (sourceFileCache) {
    sourceFileCache.referencedFiles = referencedFiles;
  }

  // The compiler already tracks each source file's template and stylesheet
  // dependencies; re-key them like the emit cache so loaders can register
  // watch dependencies without re-parsing sources. AOT only: JIT compilations
  // do not report them and fall back to the URL resolvers.
  let resourceDependencies: Map<string, readonly string[]> | undefined;
  if (componentResourcesDependencies) {
    resourceDependencies = new Map();
    for (const [file, dependencies] of componentResourcesDependencies) {
      resourceDependencies.set(toTypeScriptFileCacheKey(file), dependencies);
    }
  }

  // Only the AOT emit branches between TypeScript transpilation and raw
  // Angular-transformed TypeScript, on this exact expression over the
  // program's options (JIT always transpiles). The loaders classify the
  // emitted cache entries with this flag, so it must never diverge from the
  // emit's gate. The worker-based initialize reports only four options; the
  // three the gate reads are among them, and any other option would be
  // undefined here.
  const useTypeScriptTranspilation =
    !initializedCompilerOptions?.isolatedModules ||
    !!initializedCompilerOptions?.sourceMap ||
    !!initializedCompilerOptions?.inlineSourceMap;

  return {
    angularCompilation,
    collectedStylesheetAssets,
    collectedStylesheetMetafileInputs,
    useTypeScriptTranspilation,
    resourceDependencies,
    setupWarnings,
  };
}

// Callers report initialization failures as build errors; hand them the
// setup warnings so they are not lost with the failed build.
function attachSetupWarnings(error: unknown, setupWarnings: string[]): void {
  if (error && typeof error === 'object') {
    (error as { setupWarnings?: string[] }).setupWarnings = setupWarnings;
  }
}
