import { basename, dirname, join, relative, resolve } from 'path';
import { statSync } from 'fs';
import {
  normalizePath,
  readCachedProjectGraph,
  workspaceRoot,
} from '@nx/devkit';
import {
  AssetGlobPattern,
  FileReplacement,
  NormalizedNxWebpackPluginOptions,
  NxWebpackPluginOptions,
} from '../nx-webpack-plugin-options';

export function normalizeOptions(
  options: NxWebpackPluginOptions
): NormalizedNxWebpackPluginOptions {
  const combinedOptions: Partial<NormalizedNxWebpackPluginOptions> = {};
  const isProd = process.env.NODE_ENV === 'production';
  const projectName = process.env.NX_TASK_TARGET_PROJECT;
  const targetName = process.env.NX_TASK_TARGET_TARGET;
  const configurationName = process.env.NX_TASK_TARGET_CONFIGURATION;

  // Since this is invoked by the executor, the graph has already been created and cached.
  const projectGraph = readCachedProjectGraph();

  const projectNode = projectGraph.nodes[projectName];
  const targetConfig = projectNode.data.targets[targetName];

  // Merge options from `@nx/webpack:webpack` into plugin options.
  // Options from `@nx/webpack:webpack` take precedence.
  const originalTargetOptions = targetConfig.options;
  if (configurationName) {
    Object.assign(
      originalTargetOptions,
      targetConfig.configurations?.[configurationName]
    );
  }
  // This could be called from dev-server which means we need to read `buildTarget` to get actual build options.
  // Otherwise, the options are passed from the `@nx/webpack:webpack` executor.
  if (originalTargetOptions.buildTarget) {
    const buildTargetOptions = targetConfig.options;
    if (configurationName) {
      Object.assign(
        buildTargetOptions,
        targetConfig.configurations?.[configurationName]
      );
    }
    Object.assign(combinedOptions, buildTargetOptions);
  } else {
    Object.assign(combinedOptions, originalTargetOptions, options);
  }

  normalizeRelativePaths(projectNode.data.root, options);

  const sourceRoot = projectNode.data.sourceRoot ?? projectNode.data.root;

  if (!options.main) {
    throw new Error(
      `Missing "main" option for the entry file. Set this option in your Nx webpack plugin.`
    );
  }

  return {
    ...options,
    assets: options.assets
      ? normalizeAssets(options.assets, workspaceRoot, sourceRoot)
      : [],
    baseHref: options.baseHref ?? '/',
    commonChunk: options.commonChunk ?? true,
    compiler: options.compiler ?? 'babel',
    configurationName,
    deleteOutputPath: options.deleteOutputPath ?? true,
    extractCss: options.extractCss ?? true,
    fileReplacements: normalizeFileReplacements(
      workspaceRoot,
      options.fileReplacements
    ),
    generateIndexHtml: options.generateIndexHtml ?? true,
    main: options.main,
    namedChunks: options.namedChunks ?? !isProd,
    optimization: options.optimization ?? isProd,
    outputFileName: options.outputFileName ?? 'main.js',
    outputHashing: options.outputHashing ?? (isProd ? 'all' : 'none'),
    outputPath: options.outputPath,
    projectGraph,
    projectName,
    projectRoot: projectNode.data.root,
    root: workspaceRoot,
    runtimeChunk: options.runtimeChunk ?? true,
    scripts: options.scripts ?? [],
    sourceMap: options.sourceMap ?? !isProd,
    sourceRoot,
    styles: options.styles ?? [],
    target: options.target,
    targetName,
    vendorChunk: options.vendorChunk ?? !isProd,
  };
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

export function normalizeFileReplacements(
  root: string,
  fileReplacements: FileReplacement[]
): FileReplacement[] {
  return fileReplacements
    ? fileReplacements.map((fileReplacement) => ({
        replace: resolve(root, fileReplacement.replace),
        with: resolve(root, fileReplacement.with),
      }))
    : [];
}

function normalizeRelativePaths(
  projectRoot: string,
  options: NxWebpackPluginOptions
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
  return (
    typeof val === 'string' &&
    (val.startsWith('./') ||
      // Windows
      val.startsWith('.\\'))
  );
}
