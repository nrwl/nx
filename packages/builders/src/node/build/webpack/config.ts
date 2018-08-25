import * as webpack from 'webpack';
import { Configuration, ProgressPlugin } from 'webpack';

import * as ts from 'typescript';
import { dirname, resolve } from 'path';

import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import CircularDependencyPlugin = require('circular-dependency-plugin');
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

import { BuildNodeBuilderOptions } from '../node-build.builder';
import * as nodeExternals from 'webpack-node-externals';

export const OUT_FILENAME = 'main.js';

export function getWebpackConfig(
  options: BuildNodeBuilderOptions
): Configuration {
  const webpackConfig: Configuration = {
    entry: [options.main],
    mode: options.optimization ? 'production' : 'development',
    output: {
      path: options.outputPath,
      filename: OUT_FILENAME,
      libraryTarget: 'commonjs'
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: `ts-loader`,
          options: {
            configFile: options.tsConfig,
            transpileOnly: true,
            // https://github.com/TypeStrong/ts-loader/pull/685
            experimentalWatchApi: true
          }
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: getAliases(options)
    },
    target: 'node',
    node: false,
    performance: {
      hints: false
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        tsconfig: options.tsConfig,
        workers: options.maxWorkers || ForkTsCheckerWebpackPlugin.TWO_CPUS_FREE
      })
    ],
    watch: options.watch
  };

  const extraPlugins: webpack.Plugin[] = [];

  if (options.progress) {
    extraPlugins.push(new ProgressPlugin());
  }

  if (options.optimization) {
    webpackConfig.optimization = {
      minimize: false,
      concatenateModules: false
    };
  }

  if (options.extractLicenses) {
    extraPlugins.push(
      new LicenseWebpackPlugin({
        pattern: /.*/,
        suppressErrors: true,
        perChunkOutput: false,
        outputFilename: `3rdpartylicenses.txt`
      })
    );
  }

  if (options.externalDependencies === 'all') {
    webpackConfig.externals = [nodeExternals()];
  } else if (Array.isArray(options.externalDependencies)) {
    webpackConfig.externals = [
      function(context, request, callback: Function) {
        if (options.externalDependencies.includes(request)) {
          // not bundled
          return callback(null, 'commonjs ' + request);
        }
        // bundled
        callback();
      }
    ];
  }

  if (options.showCircularDependencies) {
    extraPlugins.push(
      new CircularDependencyPlugin({
        exclude: /[\\\/]node_modules[\\\/]/
      })
    );
  }

  webpackConfig.plugins = [...webpackConfig.plugins, ...extraPlugins];

  return webpackConfig;
}

function getAliases(
  options: BuildNodeBuilderOptions
): { [key: string]: string } {
  const readResult = ts.readConfigFile(options.tsConfig, ts.sys.readFile);
  const tsConfig = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    dirname(options.tsConfig)
  );
  const compilerOptions = tsConfig.options;
  const replacements = [
    ...options.fileReplacements,
    ...(compilerOptions.paths
      ? Object.entries(compilerOptions.paths).map(([importPath, values]) => ({
          replace: importPath,
          with: resolve(options.root, values[0])
        }))
      : [])
  ];
  return replacements.reduce(
    (aliases, replacement) => ({
      ...aliases,
      [replacement.replace]: replacement.with
    }),
    {}
  );
}
