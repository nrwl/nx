import { resolve } from 'path';

import { normalizeAssets } from '../../../plugins/nx-webpack-plugin/lib/normalize-options';
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
  return {
    ...options,
    root,
    projectRoot,
    sourceRoot,
    target: options.target ?? 'web',
    outputFileName: options.outputFileName ?? 'main.js',
    assets: normalizeAssets(options.assets, root, sourceRoot),
    webpackConfig: normalizePluginPath(options.webpackConfig, root),
    optimization:
      typeof options.optimization !== 'object'
        ? {
            scripts: options.optimization,
            styles: options.optimization,
          }
        : options.optimization,
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
