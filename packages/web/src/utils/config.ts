import * as webpack from 'webpack';
import { Configuration, ProgressPlugin, Stats } from 'webpack';
import { dirname, resolve } from 'path';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import * as TerserWebpackPlugin from 'terser-webpack-plugin';
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

import { BuildBuilderOptions } from './types';
import CircularDependencyPlugin = require('circular-dependency-plugin');
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
import { getOutputHashFormat } from './hash-format';
import { createBabelConfig } from './babel-config';

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
            ...createBabelConfig(dirname(options.main), esm, options.verbose),
            cacheDirectory: true,
            cacheCompression: false
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
      // Search closest node_modules first, and then fallback to to default node module resolution scheme.
      // This ensures we are pulling the correct versions of dependencies, such as `core-js`.
      modules: [resolve(__dirname, '..', '..', 'node_modules'), 'node_modules'],
      mainFields
    },
    performance: {
      hints: false
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        tsconfig: options.tsConfig,
        memoryLimit:
          options.memoryLimit ||
          ForkTsCheckerWebpackPlugin.DEFAULT_MEMORY_LIMIT,
        workers: options.maxWorkers || ForkTsCheckerWebpackPlugin.TWO_CPUS_FREE,
        useTypescriptIncrementalApi: false
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
    extraPlugins.push((new LicenseWebpackPlugin({
      stats: {
        errors: false
      },
      perChunkOutput: false,
      outputFilename: `3rdpartylicenses.txt`
    }) as unknown) as webpack.Plugin);
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
