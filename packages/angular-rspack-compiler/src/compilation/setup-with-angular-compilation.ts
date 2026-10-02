import type { RsbuildConfig } from '@rsbuild/core';
import { join } from 'node:path';
import {
  createAngularCompilation,
  AngularCompilation,
  SourceFileCache,
  toTypeScriptFileCacheKey,
} from '../models';
import { resetAngularBuildSassCaches } from '../utils/angular-build-sass';
import { isAngularBuildVersionAtLeast } from '../utils/angular-build-version';
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

type AngularHostOptions = Parameters<AngularCompilation['initialize']>[1];

// Before @angular/build 22.2, `initialize` took the source file cache in the
// host options and a function replacing the compiler options it read.
interface LegacyAngularCompilation {
  initialize(
    tsconfig: string,
    hostOptions: AngularHostOptions & { sourceFileCache?: SourceFileCache },
    compilerOptionsTransformer: (
      compilerOptions: Record<string, unknown>
    ) => Record<string, unknown>
  ): ReturnType<AngularCompilation['initialize']>;
}

// The declarations are those of the installed @angular/build, so only its
// version tells whether `initialize` has the pre-22.2 signature.
function hasLegacyInitialize(
  compilation: AngularCompilation
): compilation is LegacyAngularCompilation & AngularCompilation {
  return !isAngularBuildVersionAtLeast('22.2.0');
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
    resetAngularBuildSassCaches(modifiedFiles);
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

  const tsconfig = config.source?.tsconfigPath ?? options.tsConfig;
  const hostOptions: AngularHostOptions = {
    fileReplacements,
    modifiedFiles,
    transformStylesheet: wrappedTransformStylesheet,
    processWebWorker(workerFile: string) {
      return workerFile;
    },
  };
  // Initialization errors are rethrown for callers to surface as build
  // errors instead of continuing with a compilation that was never
  // initialized.
  let initializationResult;
  try {
    if (hasLegacyInitialize(angularCompilation)) {
      // Persist the TypeScript incremental state to the cache directory when
      // one is available so later cold builds resume from it.
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
      // @angular/build 22.1 gates the emit on this flag, and its application
      // builder sets it to `!isolatedModules`. Earlier versions ignore it and
      // use the fallback's expression.
      if (isAngularBuildVersionAtLeast('22.1.0')) {
        compilerOptions['_useTypeScriptTranspilation'] =
          !compilerOptions.isolatedModules;
      }
      initializationResult = await angularCompilation.initialize(
        tsconfig,
        { ...hostOptions, sourceFileCache },
        () => compilerOptions
      );
    } else {
      // The compilation reads and adjusts the tsconfig itself, like
      // `setupCompilation` does; only these overrides reach it.
      initializationResult = await angularCompilation.initialize(
        tsconfig,
        hostOptions,
        {
          sourcemap: !!options.sourceMap,
          preserveSymlinks: options.preserveSymlinks,
          cachePath: sourceFileCache?.persistentCachePath,
          customConditions: options.customConditions,
        }
      );
    }
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
  // watch dependencies without re-parsing sources. JIT compilations do not
  // report them, and neither does @angular/build 20 in any mode, so both fall
  // back to the URL resolvers.
  let resourceDependencies: Map<string, readonly string[]> | undefined;
  if (componentResourcesDependencies) {
    resourceDependencies = new Map();
    for (const [file, dependencies] of componentResourcesDependencies) {
      resourceDependencies.set(toTypeScriptFileCacheKey(file), dependencies);
    }
  }

  // Only the AOT emit branches between TypeScript transpilation and raw
  // Angular-transformed TypeScript (JIT always transpiles). The loaders
  // classify the emitted cache entries with this flag, so it must never
  // diverge from the emit's gate. Worker-based compilations before
  // @angular/build 22.1 report only `allowJs` and the options the fallback
  // reads.
  const useTypeScriptTranspilation =
    (initializedCompilerOptions?.['_useTypeScriptTranspilation'] as
      | boolean
      | undefined) ?? isTypeScriptTranspiled(initializedCompilerOptions);

  return {
    angularCompilation,
    collectedStylesheetAssets,
    collectedStylesheetMetafileInputs,
    useTypeScriptTranspilation,
    resourceDependencies,
    setupWarnings,
  };
}

// The AOT emit gate of @angular/build < 22.1.
function isTypeScriptTranspiled(
  compilerOptions:
    | {
        isolatedModules?: unknown;
        sourceMap?: unknown;
        inlineSourceMap?: unknown;
      }
    | undefined
): boolean {
  return (
    !compilerOptions?.isolatedModules ||
    !!compilerOptions.sourceMap ||
    !!compilerOptions.inlineSourceMap
  );
}

// Callers report initialization failures as build errors; hand them the
// setup warnings so they are not lost with the failed build.
function attachSetupWarnings(error: unknown, setupWarnings: string[]): void {
  if (error && typeof error === 'object') {
    (error as { setupWarnings?: string[] }).setupWarnings = setupWarnings;
  }
}
