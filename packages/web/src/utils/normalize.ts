import { Path } from '@angular-devkit/core';
import { resolve } from 'path';
import { BuildOptions } from '@angular-devkit/build-angular/src/angular-cli-files/models/build-options';
import { NormalizedBrowserBuilderSchema } from '@angular-devkit/build-angular';
import { normalizeBuildOptions } from '@nrwl/workspace';
import { WebBuildBuilderOptions } from '../builders/build/build.builder';

export function normalizeWebBuildOptions(
  options: WebBuildBuilderOptions,
  root: string,
  sourceRoot: Path
): WebBuildBuilderOptions {
  return {
    ...normalizeBuildOptions(options, root, sourceRoot),
    optimization:
      typeof options.optimization !== 'object'
        ? {
            scripts: options.optimization,
            styles: options.optimization
          }
        : options.optimization,
    sourceMap:
      typeof options.sourceMap === 'object'
        ? options.sourceMap
        : {
            scripts: options.sourceMap,
            styles: options.sourceMap,
            hidden: false,
            vendors: false
          },
    polyfills: options.polyfills ? resolve(root, options.polyfills) : undefined,
    es2015Polyfills: options.es2015Polyfills
      ? resolve(root, options.es2015Polyfills)
      : undefined
  };
}

export function convertBuildOptions(
  buildOptions: WebBuildBuilderOptions
): BuildOptions {
  const options = buildOptions as any;
  return <NormalizedBrowserBuilderSchema>{
    ...options,
    buildOptimizer: options.optimization,
    aot: false,
    forkTypeChecker: false,
    lazyModules: [] as string[],
    assets: [] as string[]
  };
}
