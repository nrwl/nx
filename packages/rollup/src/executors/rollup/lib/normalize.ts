import { basename, dirname, join, relative, resolve } from 'path';
import { statSync } from 'fs';
import { ExecutorContext, normalizePath } from '@nx/devkit';

import type { AssetGlobPattern, RollupExecutorOptions } from '../schema';
import { createEntryPoints } from '@nx/js';

export interface NormalizedRollupExecutorOptions extends RollupExecutorOptions {
  entryRoot: string;
  projectRoot: string;
  assets: AssetGlobPattern[];
  rollupConfig: string[];
}

export function normalizeRollupExecutorOptions(
  options: RollupExecutorOptions,
  context: ExecutorContext,
  sourceRoot: string
): NormalizedRollupExecutorOptions {
  const { root } = context;
  const main = `${root}/${options.main}`;
  const entryRoot = dirname(main);
  const project = options.project
    ? `${root}/${options.project}`
    : join(root, 'package.json');
  const projectRoot = dirname(project);
  const outputPath = `${root}/${options.outputPath}`;

  return {
    ...options,
    // de-dupe formats
    format: Array.from(new Set(options.format)),
    rollupConfig: []
      .concat(options.rollupConfig)
      .filter(Boolean)
      .map((p) => normalizePluginPath(p, root)),
    assets: options.assets
      ? normalizeAssets(options.assets, root, sourceRoot)
      : undefined,
    main,
    entryRoot,
    project,
    projectRoot,
    outputPath,
    skipTypeCheck: options.skipTypeCheck || false,
    additionalEntryPoints: createEntryPoints(
      options.additionalEntryPoints,
      context.root
    ),
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
