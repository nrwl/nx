import { ExecutorContext, offsetFromRoot } from '@nrwl/devkit';
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_EXPORT,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from 'next/dist/next-server/lib/constants';
import loadConfig from 'next/dist/next-server/server/config';
import { join, resolve } from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { Configuration } from 'webpack';
import { FileReplacement, NextBuildBuilderOptions } from './types';
import { normalizeAssets } from '@nrwl/web/src/utils/normalize';
import { createCopyPlugin } from '@nrwl/web/src/utils/config';

export function createWebpackConfig(
  workspaceRoot: string,
  projectRoot: string,
  fileReplacements: FileReplacement[] = [],
  assets: any = null
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
    config.resolve.plugins = [
      new TsconfigPathsPlugin({
        configFile: resolve(workspaceRoot, projectRoot, 'tsconfig.json'),
        extensions,
        mainFields,
      }),
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

    config.module.rules.push(
      {
        test: /\.(j|t)sx?$/,
        exclude: /node_modules/,
        use: [defaultLoaders.babel],
      },
      {
        test: /\.svg$/,
        oneOf: [
          // If coming from JS/TS file, then transform into React component using SVGR.
          {
            issuer: {
              test: /\.[jt]sx?$/,
            },
            use: [
              {
                loader: require.resolve('@svgr/webpack'),
                options: {
                  svgo: false,
                  titleProp: true,
                  ref: true,
                },
              },
              {
                loader: require.resolve('url-loader'),
                options: {
                  limit: 10000, // 10kB
                  name: '[name].[hash:7].[ext]',
                },
              },
            ],
          },
          // Fallback to plain URL loader.
          {
            use: [
              {
                loader: require.resolve('url-loader'),
                options: {
                  limit: 10000, // 10kB
                  name: '[name].[hash:7].[ext]',
                },
              },
            ],
          },
        ],
      }
    );

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
  context: ExecutorContext
) {
  const config = await loadConfig(phase, options.root, null);
  const userWebpack = config.webpack;
  const userNextConfig = options.nextConfig
    ? require(options.nextConfig)
    : (_, x) => x;
  // Yes, these do have different capitalisation...
  config.outdir = `${offsetFromRoot(options.root)}${options.outputPath}`;
  config.distDir =
    config.distDir && config.distDir !== '.next'
      ? config.distDir
      : join(config.outdir, '.next');
  config.webpack = (a, b) =>
    createWebpackConfig(
      context.root,
      options.root,
      options.fileReplacements,
      options.assets
    )(userWebpack ? userWebpack(a, b) : a, b);
  return userNextConfig(phase, config, { options });
}
