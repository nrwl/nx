import { WebBuildBuilderOptions } from '../builders/build/build.impl';
import { normalize } from '@angular-devkit/core';
import { resolve, dirname, relative, basename, join } from 'path';
import { BuildBuilderOptions, PackageBuilderOptions } from './types';
import { statSync } from 'fs';

export interface FileReplacement {
  replace: string;
  with: string;
}

export interface NormalizedBundleBuilderOptions extends PackageBuilderOptions {
  entryRoot: string;
  projectRoot: string;
  assets: NormalizedCopyAssetOption[];
}

export function normalizePackageOptions(
  options: PackageBuilderOptions,
  root: string,
  sourceRoot: string
): NormalizedBundleBuilderOptions {
  const entryFile = `${root}/${options.entryFile}`;
  const entryRoot = dirname(entryFile);
  const project = `${root}/${options.project}`;
  const projectRoot = dirname(project);
  const outputPath = `${root}/${options.outputPath}`;
  return {
    ...options,
    babelConfig: normalizePluginPath(options.babelConfig, root),
    rollupConfig: normalizePluginPath(options.rollupConfig, root),
    assets: options.assets
      ? normalizeAssets(options.assets, root, sourceRoot)
      : undefined,
    entryFile,
    entryRoot,
    project,
    projectRoot,
    outputPath,
  };
}

export function normalizeBuildOptions<T extends BuildBuilderOptions>(
  options: T,
  root: string,
  sourceRoot: string
): T {
  return {
    ...options,
    root,
    sourceRoot,
    main: resolve(root, options.main),
    outputPath: resolve(root, options.outputPath),
    tsConfig: resolve(root, options.tsConfig),
    fileReplacements: normalizeFileReplacements(root, options.fileReplacements),
    assets: normalizeAssets(options.assets, root, sourceRoot),
    webpackConfig: normalizePluginPath(options.webpackConfig, root),
  };
}

function normalizePluginPath(pluginPath: void | string, root: string) {
  if (!pluginPath) {
    return '';
  }
  try {
    return require.resolve(pluginPath);
  } catch {
    return resolve(root, pluginPath);
  }
}

export interface NormalizedCopyAssetOption {
  glob: string;
  input: string;
  output: string;
}

export function normalizeAssets(
  assets: any[],
  root: string,
  sourceRoot: string
): NormalizedCopyAssetOption[] {
  return assets.map((asset) => {
    if (typeof asset === 'string') {
      const assetPath = normalize(asset);
      const resolvedAssetPath = resolve(root, assetPath);
      const resolvedSourceRoot = resolve(root, sourceRoot);

      if (!resolvedAssetPath.startsWith(resolvedSourceRoot)) {
        throw new Error(
          `The ${resolvedAssetPath} asset path must start with the project source root: ${sourceRoot}`
        );
      }

      const isDirectory = statSync(resolvedAssetPath).isDirectory();
      const input = isDirectory
        ? resolvedAssetPath
        : dirname(resolvedAssetPath);
      const output = relative(resolvedSourceRoot, resolve(root, input));
      const glob = isDirectory ? '**/*' : basename(resolvedAssetPath);
      return {
        input,
        output,
        glob,
      };
    } else {
      if (asset.output.startsWith('..')) {
        throw new Error(
          'An asset cannot be written to a location outside of the output path.'
        );
      }

      const assetPath = normalize(asset.input);
      const resolvedAssetPath = resolve(root, assetPath);
      return {
        ...asset,
        input: resolvedAssetPath,
        // Now we remove starting slash to make Webpack place it from the output root.
        output: asset.output.replace(/^\//, ''),
      };
    }
  });
}

function normalizeFileReplacements(
  root: string,
  fileReplacements: FileReplacement[]
): FileReplacement[] {
  return fileReplacements.map((fileReplacement) => ({
    replace: resolve(root, fileReplacement.replace),
    with: resolve(root, fileReplacement.with),
  }));
}

export function normalizeWebBuildOptions(
  options: WebBuildBuilderOptions,
  root: string,
  sourceRoot: string
): WebBuildBuilderOptions {
  return {
    ...normalizeBuildOptions(options, root, sourceRoot),
    optimization:
      typeof options.optimization !== 'object'
        ? {
            scripts: options.optimization,
            styles: options.optimization,
          }
        : options.optimization,
    sourceMap:
      typeof options.sourceMap === 'object'
        ? options.sourceMap
        : {
            scripts: options.sourceMap,
            styles: options.sourceMap,
            hidden: false,
            vendors: false,
          },
    polyfills: options.polyfills ? resolve(root, options.polyfills) : undefined,
    es2015Polyfills: options.es2015Polyfills
      ? resolve(root, options.es2015Polyfills)
      : undefined,
  };
}

export function convertBuildOptions(buildOptions: WebBuildBuilderOptions): any {
  const options = buildOptions as any;
  return <any>{
    ...options,
    buildOptimizer: options.optimization,
    aot: false,
    forkTypeChecker: false,
    lazyModules: [] as string[],
  };
}
