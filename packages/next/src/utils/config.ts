import { offsetFromRoot } from '@nrwl/workspace';
import * as withCSS from '@zeit/next-css';
import * as withLESS from '@zeit/next-less';
import * as withSASS from '@zeit/next-sass';
import * as withSTYLUS from '@zeit/next-stylus';
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_EXPORT,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER
} from 'next/dist/next-server/lib/constants';
import loadConfig from 'next/dist/next-server/server/config';
import { resolve } from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { Configuration } from 'webpack';
import { FileReplacement } from './types';

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
        mainFields
      })
    ];

    fileReplacements
      .map(fileReplacement => ({
        replace: resolve(workspaceRoot, fileReplacement.replace),
        with: resolve(workspaceRoot, fileReplacement.with)
      }))
      .reduce((alias, replacement) => {
        alias[replacement.replace] = replacement.with;
        return alias;
      }, config.resolve.alias);

    config.module.rules.push(
      {
        test: /\.tsx?$/,
        use: [defaultLoaders.babel]
      },
      {
        test: /\.svg$/,
        oneOf: [
          // If coming from JS/TS file, then transform into React component using SVGR.
          {
            issuer: {
              test: /\.[jt]sx?$/
            },
            use: [
              '@svgr/webpack?-svgo,+titleProp,+ref![path]',
              {
                loader: 'url-loader',
                options: {
                  limit: 10000, // 10kB
                  name: '[name].[hash:7].[ext]'
                }
              }
            ]
          },
          // Fallback to plain URL loader.
          {
            use: [
              {
                loader: 'url-loader',
                options: {
                  limit: 10000, // 10kB
                  name: '[name].[hash:7].[ext]'
                }
              }
            ]
          }
        ]
      }
    );
    return config;
  };
}

export function prepareConfig(
  workspaceRoot: string,
  projectRoot: string,
  outputPath: string,
  fileReplacements: FileReplacement[],
  phase:
    | typeof PHASE_PRODUCTION_BUILD
    | typeof PHASE_EXPORT
    | typeof PHASE_DEVELOPMENT_SERVER
    | typeof PHASE_PRODUCTION_SERVER
) {
  const config = withSTYLUS(
    withSASS(withLESS(withCSS(loadConfig(phase, projectRoot, null))))
  );
  // Yes, these do have different capitalisation...
  config.distDir = `${offsetFromRoot(projectRoot)}${outputPath}`;
  config.outdir = `${offsetFromRoot(projectRoot)}${outputPath}`;
  const userWebpack = config.webpack;
  config.webpack = (a, b) =>
    createWebpackConfig(workspaceRoot, projectRoot, fileReplacements)(
      userWebpack(a, b),
      b
    );
  return config;
}
