import { offsetFromRoot } from '@nrwl/workspace';
import * as withCSS from '@zeit/next-css';
import * as withLESS from '@zeit/next-less';
import * as withSASS from '@zeit/next-sass';
import * as withSTYLUS from '@zeit/next-stylus';
import loadConfig from 'next/dist/next-server/server/config';
import * as path from 'path';
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

function createWebpackConfig(root: string) {
  return function webpackConfig(config, { defaultLoaders }) {
    const mainFields = ['es2015', 'module', 'main'];
    const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
    config.resolve.plugins = [
      new TsConfigPathsPlugin({
        configFile: path.resolve(root, 'tsconfig.json'),
        extensions,
        mainFields
      })
    ];
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
  root: string,
  outputPath: string,
  phase: string
) {
  const absoluteRoot = path.resolve(workspaceRoot, root);
  const config = withSTYLUS(
    withSASS(withLESS(withCSS(loadConfig(phase, root, null))))
  );
  config.distDir = `${offsetFromRoot(root)}${outputPath}`;
  config.outdir = `${offsetFromRoot(root)}${outputPath}`;
  const userWebpack = config.webpack;
  config.webpack = (a, b) =>
    createWebpackConfig(absoluteRoot)(userWebpack(a, b), b);
  return config;
}
