import { WebWebpackExecutorOptions } from '../executors/webpack/webpack.impl';
import { normalizePath } from '@nrwl/devkit';
import { basename, dirname, relative, resolve } from 'path';
import {
  AssetGlobPattern,
  BuildBuilderOptions,
  ExtraEntryPoint,
  ExtraEntryPointClass,
} from './shared-models';
import { statSync } from 'fs';

export interface FileReplacement {
  replace: string;
  with: string;
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

export function normalizePluginPath(pluginPath: void | string, root: string) {
  if (!pluginPath) {
    return '';
  }
  try {
    return require.resolve(pluginPath);
  } catch {
    return resolve(root, pluginPath);
  }
}

export function normalizeAssets(
  assets: any[],
  root: string,
  sourceRoot: string
): AssetGlobPattern[] {
  return assets.map((asset) => {
    if (typeof asset === 'string') {
      const assetPath = normalizePath(asset);
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

      const assetPath = normalizePath(asset.input);
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
  options: WebWebpackExecutorOptions,
  root: string,
  sourceRoot: string
): WebWebpackExecutorOptions {
  return {
    ...normalizeBuildOptions(options, root, sourceRoot),
    optimization:
      typeof options.optimization !== 'object'
        ? {
            scripts: options.optimization,
            styles: options.optimization,
          }
        : options.optimization,
    polyfills: options.polyfills ? resolve(root, options.polyfills) : undefined,
    es2015Polyfills: options.es2015Polyfills
      ? resolve(root, options.es2015Polyfills)
      : undefined,
  };
}

export function convertBuildOptions(
  buildOptions: WebWebpackExecutorOptions
): any {
  const options = buildOptions as any;
  return <any>{
    ...options,
    buildOptimizer: options.optimization,
    forkTypeChecker: false,
    lazyModules: [] as string[],
  };
}

export type NormalizedEntryPoint = Required<Omit<ExtraEntryPointClass, 'lazy'>>;

export function normalizeExtraEntryPoints(
  extraEntryPoints: ExtraEntryPoint[],
  defaultBundleName: string
): NormalizedEntryPoint[] {
  return extraEntryPoints.map((entry) => {
    let normalizedEntry;
    if (typeof entry === 'string') {
      normalizedEntry = {
        input: entry,
        inject: true,
        bundleName: defaultBundleName,
      };
    } else {
      const { lazy, inject = true, ...newEntry } = entry;
      const injectNormalized = entry.lazy !== undefined ? !entry.lazy : inject;
      let bundleName;

      if (entry.bundleName) {
        bundleName = entry.bundleName;
      } else if (!injectNormalized) {
        // Lazy entry points use the file name as bundle name.
        bundleName = basename(
          normalizePath(
            entry.input.replace(/\.(js|css|scss|sass|less|styl)$/i, '')
          )
        );
      } else {
        bundleName = defaultBundleName;
      }

      normalizedEntry = { ...newEntry, inject: injectNormalized, bundleName };
    }

    return normalizedEntry;
  });
}
