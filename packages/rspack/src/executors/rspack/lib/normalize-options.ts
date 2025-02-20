import { resolve } from 'path';

import {
  normalizeAssets,
  normalizeFileReplacements,
} from '../../../plugins/utils/plugins/normalize-options';
import type {
  RspackExecutorSchema,
  NormalizedRspackExecutorSchema,
} from '../schema';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export function normalizeOptions(
  options: RspackExecutorSchema,
  root: string,
  projectRoot: string,
  sourceRoot: string
): NormalizedRspackExecutorSchema {
  const normalizedOptions = {
    ...options,
    useTsconfigPaths: !isUsingTsSolutionSetup(),
    root,
    projectRoot,
    sourceRoot,
    target: options.target ?? 'web',
    outputFileName: options.outputFileName ?? 'main.js',
    rspackConfig: normalizePluginPath(options.rspackConfig, root),
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
  return normalizedOptions as NormalizedRspackExecutorSchema;
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
