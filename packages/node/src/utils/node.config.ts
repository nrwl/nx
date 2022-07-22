import { ExecutorContext, ProjectGraph, workspaceRoot } from '@nrwl/devkit';
import { Configuration } from 'webpack';
import { merge } from 'webpack-merge';

import { getBaseWebpackPartial } from './config';
import { GeneratePackageJsonWebpackPlugin } from './generate-package-json-webpack-plugin';
import { BuildNodeBuilderOptions } from './types';
import nodeExternals = require('webpack-node-externals');
import TerserPlugin = require('terser-webpack-plugin');

function getNodePartial(
  context: ExecutorContext,
  projectGraph: ProjectGraph,
  options: BuildNodeBuilderOptions
) {
  const webpackConfig: Configuration = {
    output: {
      libraryTarget: 'commonjs',
    },
    target: 'node',
    node: false,
  };

  if (options.optimization) {
    webpackConfig.optimization = {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            mangle: false,
            keep_classnames: true,
          },
        }),
      ],
      concatenateModules: true,
    };
  }

  if (options.externalDependencies === 'all') {
    const modulesDir = `${workspaceRoot}/node_modules`;
    webpackConfig.externals = [nodeExternals({ modulesDir })];
  } else if (Array.isArray(options.externalDependencies)) {
    webpackConfig.externals = [
      function (context, callback: Function) {
        if (options.externalDependencies.includes(context.request)) {
          // not bundled
          return callback(null, `commonjs ${context.request}`);
        }
        // bundled
        callback();
      },
    ];
  }

  if (options.generatePackageJson) {
    webpackConfig.plugins ??= [];
    webpackConfig.plugins.push(
      new GeneratePackageJsonWebpackPlugin(context, projectGraph, options)
    );
  }

  return webpackConfig;
}

export function getNodeWebpackConfig(
  context: ExecutorContext,
  projectGraph: ProjectGraph,
  options: BuildNodeBuilderOptions
) {
  return merge([
    getBaseWebpackPartial(options),
    getNodePartial(context, projectGraph, options),
  ]);
}
