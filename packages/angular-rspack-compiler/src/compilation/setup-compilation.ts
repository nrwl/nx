import { RsbuildConfig } from '@rsbuild/core';
import * as ts from 'typescript';
import { compileString } from 'sass-embedded';
import { augmentHostWithResources } from './augments';
import { InlineStyleExtension, FileReplacement } from '../models';
import { loadCompilerCli } from '../utils';
import { ComponentStylesheetBundler } from '@angular/build/src/tools/esbuild/angular/component-stylesheets';
import { transformSupportedBrowsersToTargets } from '../utils/targets-from-browsers';
import { getSupportedBrowsers } from '@angular/build/private';

export interface SetupCompilationOptions {
  root: string;
  tsconfigPath: string;
  aot: boolean;
  inlineStylesExtension: InlineStyleExtension;
  fileReplacements: Array<FileReplacement>;
  useTsProjectReferences?: boolean;
  hasServer?: boolean;
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
  const isProd = config.mode === 'production';

  const { readConfiguration } = await loadCompilerCli();
  const { options: tsCompilerOptions, rootNames } = readConfiguration(
    config.source?.tsconfigPath ?? options.tsconfigPath,
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
  const host = ts.createIncrementalCompilerHost(compilerOptions);

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
    },
    options.inlineStylesExtension,
    false
  );

  if (options.aot) {
    augmentHostWithResources(host, (code) => compileString(code).css, {
      inlineStylesExtension: options.inlineStylesExtension,
      isProd,
    });
  }

  return {
    rootNames,
    compilerOptions,
    host,
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
  ) => {
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
      return stylesheetResult.contents;
    } catch (e) {
      console.error(
        'Failed to compile styles. Continuing execution ignoring failing stylesheet...',
        e
      );
      return '';
    }
  };
}
