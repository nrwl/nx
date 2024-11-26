import { basename, dirname, join, relative, resolve } from 'node:path';
import { statSync } from 'node:fs';
import { normalizePath, workspaceRoot } from '@nx/devkit';
import type {
  AssetGlobPattern,
  NormalizedRollupWithNxPluginOptions,
  RollupWithNxPluginOptions,
} from './with-nx-options';
import { createEntryPoints } from '@nx/js';

export function normalizeOptions(
  projectRoot: string,
  sourceRoot: string,
  options: RollupWithNxPluginOptions
): NormalizedRollupWithNxPluginOptions {
  if (global.NX_GRAPH_CREATION)
    return options as NormalizedRollupWithNxPluginOptions;
  normalizeRelativePaths(projectRoot, options);
  return {
    ...options,
    additionalEntryPoints: createEntryPoints(
      options.additionalEntryPoints,
      workspaceRoot
    ),
    allowJs: options.allowJs ?? false,
    assets: options.assets
      ? normalizeAssets(options.assets, workspaceRoot, sourceRoot)
      : [],
    babelUpwardRootMode: options.babelUpwardRootMode ?? false,
    compiler: options.compiler ?? 'babel',
    deleteOutputPath: options.deleteOutputPath ?? true,
    extractCss: options.extractCss ?? true,
    format: options.format ? Array.from(new Set(options.format)) : undefined,
    generateExportsField: options.generateExportsField ?? false,
    javascriptEnabled: options.javascriptEnabled ?? false,
    skipTypeCheck: options.skipTypeCheck ?? false,
    skipTypeField: options.skipTypeField ?? false,
  };
}

function normalizeAssets(
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

function normalizeRelativePaths(
  projectRoot: string,
  options: RollupWithNxPluginOptions
): void {
  for (const [fieldName, fieldValue] of Object.entries(options)) {
    if (isRelativePath(fieldValue)) {
      options[fieldName] = join(projectRoot, fieldValue);
    } else if (Array.isArray(fieldValue)) {
      for (let i = 0; i < fieldValue.length; i++) {
        if (isRelativePath(fieldValue[i])) {
          fieldValue[i] = join(projectRoot, fieldValue[i]);
        }
      }
    }
  }
}

function isRelativePath(val: unknown): boolean {
  return typeof val === 'string' && val.startsWith('.');
}
