import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import loadConfig from 'next-server/dist/server/config';
import { offsetFromRoot } from '@nrwl/workspace';
import * as path from 'path';
import * as withCSS from '@zeit/next-css';
import * as withLESS from '@zeit/next-less';
import * as withSASS from '@zeit/next-sass';
import * as withSTYLUS from '@zeit/next-stylus';

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
    config.module.rules.push({
      test: /\.tsx/,
      use: [defaultLoaders.babel]
    });
    return config;
  };
}

export function prepareConfig(
  workspaceRoot: string,
  root: string,
  outputPath: string,
  mode: string
) {
  const absoluteRoot = path.resolve(workspaceRoot, root);
  const config = withSTYLUS(
    withSASS(withLESS(withCSS(loadConfig(mode, root, null))))
  );
  config.distDir = `${offsetFromRoot(root)}${outputPath}`;
  config.outdir = `${offsetFromRoot(root)}${outputPath}`;
  const userWebpack = config.webpack;
  config.webpack = (a, b) =>
    createWebpackConfig(absoluteRoot)(userWebpack(a, b), b);
  return config;
}
