import * as webpack from 'webpack';
import { Configuration, ProgressPlugin, Stats } from 'webpack';

import * as ts from 'typescript';

import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import CircularDependencyPlugin = require('circular-dependency-plugin');
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import { readTsConfig } from '@nrwl/workspace';
import { BuildBuilderOptions } from './types';

export const OUT_FILENAME = 'main.js';

export function getBaseWebpackPartial(
  options: BuildBuilderOptions
): Configuration {
  const { options: compilerOptions } = readTsConfig(options.tsConfig);
  const supportsEs2015 =
    compilerOptions.target !== ts.ScriptTarget.ES3 &&
    compilerOptions.target !== ts.ScriptTarget.ES5;
  const mainFields = [...(supportsEs2015 ? ['es2015'] : []), 'module', 'main'];
  const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
  const webpackConfig: Configuration = {
    entry: {
      main: [options.main],
    },
    devtool: options.sourceMap ? 'source-map' : false,
    mode: options.optimization ? 'production' : 'development',
    output: {
      path: options.outputPath,
      filename: OUT_FILENAME,
    },
    module: {
      rules: [
        {
          test: /\.(j|t)sx?$/,
          loader: require.resolve(`ts-loader`),
          exclude: /node_modules/,
          options: {
            configFile: options.tsConfig,
            transpileOnly: true,
            // https://github.com/TypeStrong/ts-loader/pull/685
            experimentalWatchApi: true,
          },
        },
      ],
    },
    resolve: {
      extensions,
      alias: getAliases(options),
      plugins: [
        new TsConfigPathsPlugin({
          configFile: options.tsConfig,
          extensions,
          mainFields,
        }),
      ],
      mainFields,
    },
    performance: {
      hints: false,
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        tsconfig: options.tsConfig,
        memoryLimit:
          options.memoryLimit ||
          ForkTsCheckerWebpackPlugin.DEFAULT_MEMORY_LIMIT,
        workers: options.maxWorkers || ForkTsCheckerWebpackPlugin.TWO_CPUS_FREE,
        useTypescriptIncrementalApi: false,
      }),
    ],
    watch: options.watch,
    watchOptions: {
      poll: options.poll,
    },
    stats: getStatsConfig(options),
  };

  const extraPlugins: webpack.Plugin[] = [];

  if (options.progress) {
    extraPlugins.push(new ProgressPlugin());
  }

  if (options.extractLicenses) {
    extraPlugins.push(
      (new LicenseWebpackPlugin({
        stats: {
          errors: false,
        },
        perChunkOutput: false,
        outputFilename: `3rdpartylicenses.txt`,
      }) as unknown) as webpack.Plugin
    );
  }

  // process asset entries
  if (options.assets) {
    const copyWebpackPluginInstance = new CopyWebpackPlugin({
      patterns: options.assets.map((asset: any) => {
        return {
          context: asset.input,
          // Now we remove starting slash to make Webpack place it from the output root.
          to: asset.output,
          from: asset.glob,
          globOptions: {
            ignore: [
              '.gitkeep',
              '**/.DS_Store',
              '**/Thumbs.db',
              ...(asset.ignore ? asset.ignore : []),
            ],
            dot: true,
          },
        };
      }),
    });
    extraPlugins.push(copyWebpackPluginInstance);
  }

  if (options.showCircularDependencies) {
    extraPlugins.push(
      new CircularDependencyPlugin({
        exclude: /[\\\/]node_modules[\\\/]/,
      })
    );
  }

  webpackConfig.plugins = [...webpackConfig.plugins, ...extraPlugins];

  return webpackConfig;
}

function getAliases(options: BuildBuilderOptions): { [key: string]: string } {
  return options.fileReplacements.reduce(
    (aliases, replacement) => ({
      ...aliases,
      [replacement.replace]: replacement.with,
    }),
    {}
  );
}

function getStatsConfig(options: BuildBuilderOptions): Stats.ToStringOptions {
  return {
    hash: true,
    timings: false,
    cached: false,
    cachedAssets: false,
    modules: false,
    warnings: true,
    errors: true,
    colors: !options.verbose && !options.statsJson,
    chunks: !options.verbose,
    assets: !!options.verbose,
    chunkOrigins: !!options.verbose,
    chunkModules: !!options.verbose,
    children: !!options.verbose,
    reasons: !!options.verbose,
    version: !!options.verbose,
    errorDetails: !!options.verbose,
    moduleTrace: !!options.verbose,
    usedExports: !!options.verbose,
  };
}
