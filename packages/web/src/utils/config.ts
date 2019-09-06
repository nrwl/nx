import * as webpack from 'webpack';
import { Configuration, ProgressPlugin, Stats } from 'webpack';
import { dirname } from 'path';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import * as TerserWebpackPlugin from 'terser-webpack-plugin';
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

import { BuildBuilderOptions } from './types';
import CircularDependencyPlugin = require('circular-dependency-plugin');
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
import { getOutputHashFormat } from './hash-format';

export function getBaseWebpackPartial(
  options: BuildBuilderOptions,
  esm?: boolean,
  isScriptOptimizeOn?: boolean
): Configuration {
  const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
  const mainFields = [...(esm ? ['es2015'] : []), 'module', 'main'];
  const hashFormat = getOutputHashFormat(options.outputHashing);
  const suffixFormat = esm ? '.esm' : '.es5';
  const filename = isScriptOptimizeOn
    ? `[name]${hashFormat.script}${suffixFormat}.js`
    : '[name].js';
  const chunkFilename = isScriptOptimizeOn
    ? `[name]${hashFormat.chunk}${suffixFormat}.js`
    : '[name].js';

  const webpackConfig: Configuration = {
    entry: {
      main: [options.main]
    },
    devtool: options.sourceMap ? 'source-map' : false,
    mode: isScriptOptimizeOn ? 'production' : 'development',
    output: {
      path: options.outputPath,
      filename,
      chunkFilename
    },
    module: {
      rules: [
        {
          test: /\.([jt])sx?$/,
          loader: `babel-loader`,
          exclude: /node_modules/,
          options: {
            cacheDirectory: true,
            cacheCompression: false,
            compact: isScriptOptimizeOn,
            presets: [
              [
                '@babel/preset-env',
                {
                  // Allows browserlist file from project to be used.
                  configPath: dirname(options.main),
                  // Allow importing core-js in entrypoint and use browserlist to select polyfills.
                  // This is needed for differential loading as well.
                  useBuiltIns: 'entry',
                  debug: options.verbose,
                  corejs: 3,
                  modules: false,
                  // Exclude transforms that make all code slower
                  exclude: ['transform-typeof-symbol'],
                  // Let babel-env figure which modern browsers to support.
                  // See: https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/built-in-modules.json
                  targets: esm ? { esmodules: true } : undefined
                }
              ],
              ['@babel/preset-typescript']
            ],
            plugins: [
              'babel-plugin-macros',
              [
                // Allows decorators to be before export since it is consistent with TypeScript syntax.
                '@babel/plugin-proposal-decorators',
                { decoratorsBeforeExport: true }
              ],
              ['@babel/plugin-proposal-class-properties']
            ]
          }
        }
      ]
    },
    resolve: {
      extensions,
      alias: getAliases(options),
      plugins: [
        new TsConfigPathsPlugin({
          configFile: options.tsConfig,
          extensions,
          mainFields
        })
      ],
      mainFields
    },
    performance: {
      hints: false
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        tsconfig: options.tsConfig,
        workers: options.maxWorkers || ForkTsCheckerWebpackPlugin.TWO_CPUS_FREE
      })
    ],
    watch: options.watch,
    watchOptions: {
      poll: options.poll
    },
    stats: getStatsConfig(options)
  };

  if (isScriptOptimizeOn) {
    webpackConfig.optimization = {
      minimizer: [createTerserPlugin(esm)],
      runtimeChunk: true
    };
  }

  const extraPlugins: webpack.Plugin[] = [];

  if (options.progress) {
    extraPlugins.push(new ProgressPlugin());
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

  // process asset entries
  if (options.assets) {
    const copyWebpackPluginPatterns = options.assets.map((asset: any) => {
      return {
        context: asset.input,
        // Now we remove starting slash to make Webpack place it from the output root.
        to: asset.output,
        ignore: asset.ignore,
        from: {
          glob: asset.glob,
          dot: true
        }
      };
    });

    const copyWebpackPluginOptions = {
      ignore: ['.gitkeep', '**/.DS_Store', '**/Thumbs.db']
    };

    const copyWebpackPluginInstance = new CopyWebpackPlugin(
      copyWebpackPluginPatterns,
      copyWebpackPluginOptions
    );
    extraPlugins.push(copyWebpackPluginInstance);
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

function getAliases(options: BuildBuilderOptions): { [key: string]: string } {
  return options.fileReplacements.reduce(
    (aliases, replacement) => ({
      ...aliases,
      [replacement.replace]: replacement.with
    }),
    {}
  );
}

export function createTerserPlugin(esm: boolean) {
  return new TerserWebpackPlugin({
    parallel: true,
    cache: true,
    terserOptions: {
      ecma: esm ? 6 : 5,
      safari10: true,
      output: {
        ascii_only: true,
        comments: false,
        webkit: true
      }
    }
  });
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
    usedExports: !!options.verbose
  };
}

function createFileName(esm, isScriptOptimizeOn, outputHashing) {
  return isScriptOptimizeOn
    ? esm
      ? outputHashing
        ? '[name].[chunkhash].esm.js'
        : '[name].esm.js'
      : outputHashing
      ? '[name].[chunkhash].es5.js'
      : '[name].es5.js'
    : '[name].js';
}
