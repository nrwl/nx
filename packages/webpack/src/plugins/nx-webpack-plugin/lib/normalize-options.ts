import { basename, dirname, join, relative, resolve } from 'path';
import { statSync } from 'fs';
import {
  normalizePath,
  parseTargetString,
  readCachedProjectGraph,
  workspaceRoot,
} from '@nx/devkit';
import {
  AssetGlobPattern,
  FileReplacement,
  NormalizedNxAppWebpackPluginOptions,
  NxAppWebpackPluginOptions,
} from '../nx-app-webpack-plugin-options';

export function normalizeOptions(
  options: NxAppWebpackPluginOptions
): NormalizedNxAppWebpackPluginOptions {
  const combinedPluginAndMaybeExecutorOptions: Partial<NormalizedNxAppWebpackPluginOptions> =
    {};
  const isProd = process.env.NODE_ENV === 'production';
  // Since this is invoked by the executor, the graph has already been created and cached.
  const projectGraph = readCachedProjectGraph();

  const taskDetailsFromBuildTarget = process.env.NX_BUILD_TARGET
    ? parseTargetString(process.env.NX_BUILD_TARGET, projectGraph)
    : undefined;
  const projectName = taskDetailsFromBuildTarget
    ? taskDetailsFromBuildTarget.project
    : process.env.NX_TASK_TARGET_PROJECT;
  const targetName = taskDetailsFromBuildTarget
    ? taskDetailsFromBuildTarget.target
    : process.env.NX_TASK_TARGET_TARGET;
  const configurationName = taskDetailsFromBuildTarget
    ? taskDetailsFromBuildTarget.configuration
    : process.env.NX_TASK_TARGET_CONFIGURATION;

  const projectNode = projectGraph.nodes[projectName];
  const targetConfig = projectNode.data.targets[targetName];

  normalizeRelativePaths(projectNode.data.root, options);

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
    Object.assign(
      combinedPluginAndMaybeExecutorOptions,
      options,
      // executor options take precedence (especially for overriding with CLI args)
      buildTargetOptions
    );
  } else {
    Object.assign(
      combinedPluginAndMaybeExecutorOptions,
      options,
      // executor options take precedence (especially for overriding with CLI args)
      originalTargetOptions
    );
  }

  const sourceRoot = projectNode.data.sourceRoot ?? projectNode.data.root;

  if (!options.main) {
    throw new Error(
      `Missing "main" option for the entry file. Set this option in your Nx webpack plugin.`
    );
  }

  return {
    ...combinedPluginAndMaybeExecutorOptions,
    assets: combinedPluginAndMaybeExecutorOptions.assets
      ? normalizeAssets(
          combinedPluginAndMaybeExecutorOptions.assets,
          workspaceRoot,
          sourceRoot,
          projectNode.data.root
        )
      : [],
    baseHref: combinedPluginAndMaybeExecutorOptions.baseHref ?? '/',
    buildLibsFromSource:
      combinedPluginAndMaybeExecutorOptions.buildLibsFromSource ?? true,
    commonChunk: combinedPluginAndMaybeExecutorOptions.commonChunk ?? true,
    compiler: combinedPluginAndMaybeExecutorOptions.compiler ?? 'babel',
    configurationName,
    deleteOutputPath:
      combinedPluginAndMaybeExecutorOptions.deleteOutputPath ?? true,
    extractCss: combinedPluginAndMaybeExecutorOptions.extractCss ?? true,
    fileReplacements: normalizeFileReplacements(
      workspaceRoot,
      combinedPluginAndMaybeExecutorOptions.fileReplacements
    ),
    generateIndexHtml:
      combinedPluginAndMaybeExecutorOptions.generateIndexHtml ?? true,
    main: combinedPluginAndMaybeExecutorOptions.main,
    namedChunks: combinedPluginAndMaybeExecutorOptions.namedChunks ?? !isProd,
    optimization: combinedPluginAndMaybeExecutorOptions.optimization ?? isProd,
    outputFileName:
      combinedPluginAndMaybeExecutorOptions.outputFileName ?? 'main.js',
    outputHashing:
      combinedPluginAndMaybeExecutorOptions.outputHashing ??
      (isProd ? 'all' : 'none'),
    outputPath: combinedPluginAndMaybeExecutorOptions.outputPath,
    projectGraph,
    projectName,
    projectRoot: projectNode.data.root,
    root: workspaceRoot,
    runtimeChunk: combinedPluginAndMaybeExecutorOptions.runtimeChunk ?? true,
    scripts: combinedPluginAndMaybeExecutorOptions.scripts ?? [],
    sourceMap: combinedPluginAndMaybeExecutorOptions.sourceMap ?? !isProd,
    sourceRoot,
    styles: combinedPluginAndMaybeExecutorOptions.styles ?? [],
    target: combinedPluginAndMaybeExecutorOptions.target,
    targetName,
    vendorChunk: combinedPluginAndMaybeExecutorOptions.vendorChunk ?? !isProd,
  };
}

export function normalizeAssets(
  assets: any[],
  root: string,
  sourceRoot: string,
  projectRoot: string,
  resolveRelativePathsToProjectRoot = true
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
      let resolvedAssetPath = resolve(root, assetPath);
      if (resolveRelativePathsToProjectRoot && asset.input.startsWith('.')) {
        const resolvedProjectRoot = resolve(root, projectRoot);
        resolvedAssetPath = resolve(resolvedProjectRoot, assetPath);
      }

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
  options: NxAppWebpackPluginOptions
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
