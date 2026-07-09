import { RsbuildConfig } from '@rsbuild/core';
import * as ts from 'typescript';
import { InlineStyleLanguage, FileReplacement, type Sass } from '../models';
import { loadCompilerCli } from '../utils';
import { applyEs2022TargetDefaults } from '../utils/typescript-compiler-options';
import { assertSupportedAngularRspackCompilerVersions } from '../utils/assert-supported-versions';
import {
  ComponentStylesheetBundler,
  findTailwindConfiguration,
  generateSearchDirectories,
  loadPostcssConfiguration,
} from '@angular/build/private';
import { transformSupportedBrowsersToTargets } from '../utils/targets-from-browsers';
import { getSupportedBrowsers } from '@angular/build/private';
import { createRequire } from 'node:module';

export interface StylesheetTransformResult {
  contents: string;
  outputFiles?: Array<{ path: string; text: string }>;
  /** Bundle metadata listing the files that went into the stylesheet. */
  metafile?: {
    outputs: Record<
      string,
      { inputs: Record<string, { bytesInOutput: number }> }
    >;
  };
}

export interface SetupCompilationOptions {
  root: string;
  tsConfig: string;
  aot: boolean;
  inlineStyleLanguage: InlineStyleLanguage;
  fileReplacements: Array<FileReplacement>;
  useTsProjectReferences?: boolean;
  hasServer?: boolean;
  includePaths?: string[];
  sass?: Sass;
  watch?: boolean;
  sourceMap?: boolean;
  preserveSymlinks?: boolean;
  customConditions?: string[];
}

export const DEFAULT_NG_COMPILER_OPTIONS: ts.CompilerOptions = {
  suppressOutputPathCheck: true,
  outDir: undefined,
  declaration: false,
  declarationMap: false,
  allowEmptyCodegenFiles: false,
  annotationsAs: 'decorators',
  enableResourceInlining: false,
  noEmitOnError: false,
  mapRoot: undefined,
  sourceRoot: undefined,
  supportTestBed: false,
  supportJitMode: false,
};

let COMPONENT_STYLESHEET_BUNDLER: ComponentStylesheetBundler | undefined =
  undefined;

/**
 * Reads the project's TypeScript configuration with the Angular compiler
 * defaults applied and creates (or reuses) the shared component stylesheet
 * bundler. TypeScript sourcemaps are emitted inline and only when
 * `options.sourceMap` is enabled. Targets below ES2022 are raised (see
 * `applyEs2022TargetDefaults`), unsupported `module` values are set to
 * ES2022, and partial compilation mode is forced to full, each with a
 * warning in the returned `setupWarnings`.
 */
export async function setupCompilation(
  config: Pick<RsbuildConfig, 'mode' | 'source'>,
  options: SetupCompilationOptions
) {
  assertSupportedAngularRspackCompilerVersions();

  const { readConfiguration } = await loadCompilerCli();
  const { options: tsCompilerOptions, rootNames } = readConfiguration(
    config.source?.tsconfigPath ?? options.tsConfig,
    {
      ...DEFAULT_NG_COMPILER_OPTIONS,
      // Sourcemaps must be inline to survive the loader chain, and emitting
      // them forgoes Angular's fast raw-TS emit path, so only emit them when
      // script sourcemaps are requested.
      inlineSources: !!options.sourceMap,
      inlineSourceMap: !!options.sourceMap,
      sourceMap: undefined,
      // Composite emit is unsupported and conflicts with the incremental
      // state handling; force it off.
      composite: false,
      // The bundler resolves symlinks based on this option alone; the
      // program must resolve the same way, so the tsconfig value is ignored.
      preserveSymlinks: options.preserveSymlinks,
      ...(options.useTsProjectReferences
        ? {
            sourceMap: false,
            inlineSourceMap: false,
            inlineSources: false,
            isolatedModules: true,
          }
        : {}),
    }
  );

  const compilerOptions = tsCompilerOptions;

  const setupWarnings: string[] = [];
  const hasExplicitUseDefineForClassFields =
    compilerOptions.useDefineForClassFields !== undefined;
  if (applyEs2022TargetDefaults(compilerOptions)) {
    setupWarnings.push(
      hasExplicitUseDefineForClassFields
        ? "TypeScript compiler option 'target' is set to 'ES2022'."
        : "TypeScript compiler options 'target' and 'useDefineForClassFields' are set to 'ES2022' and 'false' respectively."
    );
  }
  // Partial compilation output requires the Angular linker, which the JS
  // transformer skips for application code; it would ship unlinked and fail
  // at runtime.
  if (compilerOptions.compilationMode === 'partial') {
    setupWarnings.push(
      'Angular partial compilation mode is not supported when building applications. Full compilation mode will be used instead.'
    );
    compilerOptions.compilationMode = 'full';
  }
  if (
    compilerOptions.module === undefined ||
    compilerOptions.module < ts.ModuleKind.ES2015
  ) {
    compilerOptions.module = ts.ModuleKind.ES2022;
    setupWarnings.push(
      "TypeScript compiler options 'module' values 'CommonJS', 'UMD', 'System' and 'AMD' are not supported. The 'module' option will be set to 'ES2022' instead."
    );
  }
  if (
    compilerOptions.isolatedModules &&
    compilerOptions.emitDecoratorMetadata
  ) {
    setupWarnings.push(
      "TypeScript compiler option 'isolatedModules' may prevent the 'emitDecoratorMetadata' option from emitting all metadata. " +
        "The 'emitDecoratorMetadata' option is not required by Angular and can be removed if not explicitly required by the project."
    );
  }
  // With bundler-style resolution the program resolves package exports with
  // these conditions; keep them in step with the bundler's custom
  // conditions so both resolve the same files.
  if (
    compilerOptions.moduleResolution === ts.ModuleResolutionKind.Bundler ||
    compilerOptions.module === ts.ModuleKind.Preserve
  ) {
    compilerOptions.customConditions = options.customConditions;
  }

  const searchDirectories = await generateSearchDirectories([options.root]);
  const postcssConfiguration =
    await loadPostcssConfiguration(searchDirectories);
  // Skip tailwind configuration if postcss is customized
  let tailwindConfiguration;
  if (!postcssConfiguration) {
    const tailwindConfigPath = findTailwindConfiguration(searchDirectories);
    if (tailwindConfigPath) {
      const resolver = createRequire(tailwindConfigPath);
      try {
        tailwindConfiguration = {
          file: tailwindConfigPath,
          package: resolver.resolve('tailwindcss'),
        };
      } catch (e) {
        // Tailwind config found but package not installed - warning already shown by Angular build
      }
    }
  }

  COMPONENT_STYLESHEET_BUNDLER ??= new ComponentStylesheetBundler(
    {
      workspaceRoot: options.root,
      optimization: config.mode === 'production',
      cacheOptions: { path: '', basePath: '', enabled: false },
      inlineFonts: false,
      outputNames: {
        bundles: config.mode === 'production' ? '[name]-[hash]' : '[name]',
        media: `media/${
          config.mode === 'production' ? '[name]-[hash]' : '[name]'
        }`,
      },
      sourcemap: false,
      target: transformSupportedBrowsersToTargets(
        getSupportedBrowsers(options.root, {
          warn: (message) => console.warn(message),
        })
      ),
      includePaths: options.includePaths,
      sass: options.sass,
      postcssConfiguration,
      tailwindConfiguration,
    },
    options.inlineStyleLanguage,
    !!options.watch
  );

  return {
    rootNames,
    compilerOptions,
    componentStylesheetBundler: COMPONENT_STYLESHEET_BUNDLER,
    setupWarnings,
  };
}

/**
 * Dispose the shared component stylesheet bundler and reset the singleton.
 *
 * `@angular/build` >= 21.2.14 backs `ComponentStylesheetBundler` with a
 * persistent esbuild build context (it previously used a one-shot
 * `esbuild.build()` for non-incremental bundling). That context keeps an
 * esbuild service - a child process and its sockets - alive until disposed,
 * which prevents a one-shot `rspack build` from exiting once the bundle is
 * written. Angular's own application builder disposes it in a `finally` block;
 * we must do the same since we drive the bundler directly.
 */
export async function disposeComponentStylesheetBundler(): Promise<void> {
  if (COMPONENT_STYLESHEET_BUNDLER) {
    const bundler = COMPONENT_STYLESHEET_BUNDLER;
    COMPONENT_STYLESHEET_BUNDLER = undefined;
    await bundler.dispose();
  }
}

export function styleTransform(
  componentStylesheetBundler: ComponentStylesheetBundler
) {
  return async (
    styles: string,
    containingFile: string,
    stylesheetFile?: string
  ): Promise<StylesheetTransformResult> => {
    try {
      let stylesheetResult;
      if (stylesheetFile) {
        stylesheetResult =
          await componentStylesheetBundler.bundleFile(stylesheetFile);
      } else {
        stylesheetResult = await componentStylesheetBundler.bundleInline(
          styles,
          containingFile,
          containingFile.endsWith('.html') ? 'css' : undefined
        );
      }
      if (stylesheetResult.errors && stylesheetResult.errors.length > 0) {
        for (const error of stylesheetResult.errors) {
          console.error(
            'Failed to compile styles. Continuing execution ignoring failing stylesheet...',
            error.text
          );
        }
      }

      return {
        contents: stylesheetResult.contents,
        outputFiles: stylesheetResult.outputFiles,
        metafile: stylesheetResult.metafile,
      };
    } catch (e) {
      console.error(
        'Failed to compile styles. Continuing execution ignoring failing stylesheet...',
        e
      );
      return { contents: '', outputFiles: undefined };
    }
  };
}
