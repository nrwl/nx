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
  const { rootNames, compilerOptions, componentStylesheetBundler } =
    await setupCompilation(config, options);
  angularCompilation ??= await createAngularCompilation(
    !options.aot,
    !options.hasServer,
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
      // Inline styles share the containing file; disambiguate like
      // `@angular/build` does so entries stay unique per stylesheet.
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

  // Initialization errors are intentionally not caught here: callers must
  // surface them as build errors instead of continuing with a compilation
  // that was never initialized.
  const { compilerOptions: initializedCompilerOptions, referencedFiles } =
    await angularCompilation.initialize(
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

  // Mirrors @angular/build: with isolated modules and no sourcemaps, Angular
  // emits transformed TypeScript and leaves transpilation to the bundler.
  // Unlike esbuild, the swc rule transpiling that output doesn't read the
  // project's tsconfig; it assumes the default tsconfig semantics (legacy
  // decorators without metadata, ES2022 targets, default class-field and
  // import-elision behavior). Other configs use TypeScript transpilation.
  const useTypeScriptTranspilation =
    !initializedCompilerOptions?.isolatedModules ||
    !!initializedCompilerOptions.sourceMap ||
    !!initializedCompilerOptions.inlineSourceMap ||
    !initializedCompilerOptions.experimentalDecorators ||
    !!initializedCompilerOptions.emitDecoratorMetadata ||
    initializedCompilerOptions.useDefineForClassFields === false ||
    !!initializedCompilerOptions.verbatimModuleSyntax ||
    !!initializedCompilerOptions.importsNotUsedAsValues ||
    (initializedCompilerOptions.target ?? 0) < 9; /* ts.ScriptTarget.ES2022 */

  return {
    angularCompilation,
    collectedStylesheetAssets,
    collectedStylesheetMetafileInputs,
    useTypeScriptTranspilation,
  };
}
