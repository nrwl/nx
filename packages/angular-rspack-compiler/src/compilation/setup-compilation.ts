import { RsbuildConfig } from '@rsbuild/core';
import * as ts from 'typescript';
import { InlineStyleLanguage, FileReplacement, type Sass } from '../models';
import { loadCompilerCli } from '../utils';
import { ComponentStylesheetBundler } from '@angular/build/private';
import { transformSupportedBrowsersToTargets } from '../utils/targets-from-browsers';
import { getSupportedBrowsers } from '@angular/build/private';

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
}

export const DEFAULT_NG_COMPILER_OPTIONS: ts.CompilerOptions = {
  suppressOutputPathCheck: true,
  outDir: undefined,
  sourceMap: true,
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

export async function setupCompilation(
  config: Pick<RsbuildConfig, 'mode' | 'source'>,
  options: SetupCompilationOptions
) {
  const { readConfiguration } = await loadCompilerCli();
  const { options: tsCompilerOptions, rootNames } = readConfiguration(
    config.source?.tsconfigPath ?? options.tsConfig,
    {
      ...DEFAULT_NG_COMPILER_OPTIONS,
      ...(options.useTsProjectReferences
        ? {
            sourceMap: false,
            inlineSources: false,
            isolatedModules: true,
          }
        : {}),
    }
  );

  const compilerOptions = tsCompilerOptions;

  const componentStylesheetBundler = new ComponentStylesheetBundler(
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
    },
    options.inlineStyleLanguage,
    false
  );

  return {
    rootNames,
    compilerOptions,
    componentStylesheetBundler,
  };
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
        stylesheetResult = await componentStylesheetBundler.bundleFile(
          stylesheetFile
        );
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
