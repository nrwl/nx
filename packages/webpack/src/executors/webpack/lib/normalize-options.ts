import { resolve } from 'path';

import {
  normalizeAssets,
  normalizeFileReplacements,
} from '../../../plugins/nx-webpack-plugin/lib/normalize-options';
import type {
  NormalizedWebpackExecutorOptions,
  WebpackExecutorOptions,
} from '../schema';

export function normalizeOptions(
  options: WebpackExecutorOptions,
  root: string,
  projectRoot: string,
  sourceRoot: string
): NormalizedWebpackExecutorOptions {
  const normalizedOptions = {
    ...options,
    root,
    projectRoot,
    sourceRoot,
    target: options.target ?? 'web',
    outputFileName: options.outputFileName ?? 'main.js',
    webpackConfig: normalizePluginPath(options.webpackConfig, root),
    fileReplacements: normalizeFileReplacements(root, options.fileReplacements),
    optimization:
      typeof options.optimization !== 'object'
        ? {
            scripts: options.optimization,
            styles: options.optimization,
          }
        : options.optimization,
  };
  if (options.assets) {
    normalizedOptions.assets = normalizeAssets(
      options.assets,
      root,
      sourceRoot,
      projectRoot,
      false // executor assets are relative to workspace root for consistency
    );
  }
  return normalizedOptions as NormalizedWebpackExecutorOptions;
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
