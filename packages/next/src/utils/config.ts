import {
  ExecutorContext,
  offsetFromRoot,
  joinPathFragments,
} from '@nrwl/devkit';
// ignoring while we support both Next 11.1.0 and versions before it
// @ts-ignore
import type { NextConfig } from 'next/dist/server/config-shared';
// @ts-ignore
import type {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_EXPORT,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from 'next/dist/shared/lib/constants';
import { join, resolve } from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { Configuration } from 'webpack';
import {
  FileReplacement,
  NextBuildBuilderOptions,
  WebpackConfigOptions,
} from './types';
import { normalizeAssets } from '@nrwl/web/src/utils/normalize';
import { createCopyPlugin } from '@nrwl/web/src/utils/config';
import { WithNxOptions } from '../../plugins/with-nx';
import {
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
const loadConfig = require('next/dist/server/config').default;

export function createWebpackConfig(
  workspaceRoot: string,
  projectRoot: string,
  fileReplacements: FileReplacement[] = [],
  assets: any = null,
  dependencies: DependentBuildableProjectNode[] = [],
  libsDir = ''
): (a, b) => Configuration {
  return function webpackConfig(
    config: Configuration,
    {
      isServer,
      defaultLoaders,
    }: {
      buildId: string;
      dev: boolean;
      isServer: boolean;
      defaultLoaders: any;
    }
  ): Configuration {
    const mainFields = ['es2015', 'module', 'main'];
    const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
    let tsConfigPath = join(projectRoot, 'tsconfig.json');
    if (dependencies.length > 0) {
      tsConfigPath = createTmpTsConfig(
        join(workspaceRoot, tsConfigPath),
        workspaceRoot,
        projectRoot,
        dependencies
      );
    }

    config.resolve.plugins = [
      new TsconfigPathsPlugin({
        configFile: tsConfigPath,
        extensions,
        mainFields,
      }) as never, // TODO: Remove never type when 'tsconfig-paths-webpack-plugin' types fixed
    ];

    fileReplacements
      .map((fileReplacement) => ({
        replace: resolve(workspaceRoot, fileReplacement.replace),
        with: resolve(workspaceRoot, fileReplacement.with),
      }))
      .reduce((alias, replacement) => {
        alias[replacement.replace] = replacement.with;
        return alias;
      }, config.resolve.alias);

    config.module.rules.push({
      test: /\.([jt])sx?$/,
      include: [libsDir],
      exclude: /node_modules/,
      use: [defaultLoaders.babel],
    });

    // Copy (shared) assets to `public` folder during client-side compilation
    if (!isServer && Array.isArray(assets) && assets.length > 0) {
      config.plugins.push(
        createCopyPlugin(
          normalizeAssets(assets, workspaceRoot, projectRoot).map((asset) => ({
            ...asset,
            output: join('../public', asset.output),
          }))
        )
      );
    }

    return config;
  };
}

export async function prepareConfig(
  phase:
    | typeof PHASE_PRODUCTION_BUILD
    | typeof PHASE_EXPORT
    | typeof PHASE_DEVELOPMENT_SERVER
    | typeof PHASE_PRODUCTION_SERVER,
  options: NextBuildBuilderOptions,
  context: ExecutorContext,
  dependencies: DependentBuildableProjectNode[],
  libsDir: string
) {
  const config = (await loadConfig(phase, options.root, null)) as NextConfig &
    WithNxOptions;

  const userWebpack = config.webpack;
  const userNextConfig = getConfigEnhancer(options.nextConfig, context.root);
  // Yes, these do have different capitalisation...
  const outputDir = `${offsetFromRoot(options.root)}${options.outputPath}`;
  config.distDir =
    config.distDir && config.distDir !== '.next'
      ? joinPathFragments(outputDir, config.distDir)
      : joinPathFragments(outputDir, '.next');
  config.webpack = (a, b) =>
    createWebpackConfig(
      context.root,
      options.root,
      options.fileReplacements,
      options.assets,
      dependencies,
      libsDir
    )(userWebpack ? userWebpack(a, b) : a, b);

  if (typeof userNextConfig !== 'function') {
    throw new Error(
      `Module specified by 'nextConfig' option does not export a function. It should be of form 'module.exports = (phase, config, options) => config;'`
    );
  }

  return userNextConfig(phase, config, { options });
}

function getConfigEnhancer(
  pluginPath: undefined | string,
  workspaceRoot: string
) {
  if (!pluginPath) {
    return (_, x) => x;
  }

  let fullPath: string;

  try {
    fullPath = require.resolve(pluginPath);
  } catch {
    fullPath = join(workspaceRoot, pluginPath);
  }

  try {
    return require(fullPath);
  } catch {
    throw new Error(
      `Could not find file specified by 'nextConfig' option: ${fullPath}`
    );
  }
}
