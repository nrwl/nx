import { offsetFromRoot } from '@nrwl/workspace';
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
import { BuilderContext } from '@angular-devkit/architect';
import { createCopyPlugin } from '@nrwl/web/src/utils/config';

export function createWebpackConfig(
  workspaceRoot: string,
  projectRoot: string,
  fileReplacements: FileReplacement[] = []
): (a, b) => Configuration {
  return function webpackConfig(
    config: Configuration,
    { defaultLoaders }
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
        test: /\.tsx?$/,
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
              '@svgr/webpack?-svgo,+titleProp,+ref![path]',
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

    config.plugins.push(
      createCopyPlugin([
        {
          input: 'public',
          // distDir is `dist/apps/[name]/.next` and we want public to be copied
          // to `dist/apps/[name]/public` thus the `..` here.
          output: '../public',
          glob: '**/*',
        },
      ])
    );

    return config;
  };
}

export function prepareConfig(
  phase:
    | typeof PHASE_PRODUCTION_BUILD
    | typeof PHASE_EXPORT
    | typeof PHASE_DEVELOPMENT_SERVER
    | typeof PHASE_PRODUCTION_SERVER,
  options: NextBuildBuilderOptions,
  context: BuilderContext
) {
  const config = loadConfig(phase, options.root, null);
  // Yes, these do have different capitalisation...
  config.outdir = `${offsetFromRoot(options.root)}${options.outputPath}`;
  config.distDir = join(config.outdir, '.next');
  const userWebpack = config.webpack;
  config.webpack = (a, b) =>
    createWebpackConfig(
      context.workspaceRoot,
      options.root,
      options.fileReplacements
    )(userWebpack ? userWebpack(a, b) : a, b);
  return config;
}
