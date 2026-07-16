import { RsbuildConfig } from '@rsbuild/core';
import * as ts from 'typescript';
import { InlineStyleLanguage, FileReplacement, type Sass } from '../models';
import { loadCompilerCli } from '../utils';
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
  /**
   * Whether to emit script sourcemaps. The Angular compilation always emits
   * an *inline* sourcemap (required to keep TypeScript transpilation enabled
   * — see the compiler options below); this option controls whether the
   * original sources are embedded in it so the downstream
   * `JavaScriptTransformer` can chain the mapping back to the original
   * TypeScript. Defaults to `true` to preserve the previous behavior.
   */
  sourceMap?: boolean;
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

export async function setupCompilation(
  config: Pick<RsbuildConfig, 'mode' | 'source'>,
  options: SetupCompilationOptions
) {
  assertSupportedAngularRspackCompilerVersions();

  const sourceMap = options.sourceMap ?? true;
  const { readConfiguration } = await loadCompilerCli();
  const { options: tsCompilerOptions, rootNames } = readConfiguration(
    config.source?.tsconfigPath ?? options.tsConfig,
    {
      ...DEFAULT_NG_COMPILER_OPTIONS,
      // Align with `@angular/build`'s esbuild pipeline: emit an *inline*
      // sourcemap that also embeds the original sources. The downstream
      // `JavaScriptTransformer` (babel + the Angular linker) only reads inline
      // input sourcemaps, so an external `.js.map` would be dropped and the
      // chained sourcemap would point at the intermediate Ivy JavaScript
      // instead of the original TypeScript.
      //
      // `inlineSourceMap` must stay enabled even when sourcemaps are turned
      // off: `AotCompilation.emitAffectedFiles` skips TypeScript transpilation
      // entirely for `isolatedModules` projects when no sourcemap option is
      // set, emitting raw TypeScript for esbuild to transpile — but this
      // babel-based pipeline cannot parse TypeScript. The loaders strip the
      // inline sourcemap comment from the emitted code, and Rspack discards
      // the extracted map when `devtool` is disabled, so only `inlineSources`
      // is gated on the user's sourcemap setting.
      sourceMap: false,
      inlineSourceMap: true,
      inlineSources: sourceMap,
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
    false
  );

  return {
    rootNames,
    compilerOptions,
    componentStylesheetBundler: COMPONENT_STYLESHEET_BUNDLER,
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

      // Return both contents and outputFiles
      return {
        contents: stylesheetResult.contents,
        outputFiles: stylesheetResult.outputFiles,
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
