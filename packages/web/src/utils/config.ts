import * as webpack from 'webpack';
import { Configuration, ProgressPlugin, Stats } from 'webpack';
import { join, resolve } from 'path';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import * as TerserWebpackPlugin from 'terser-webpack-plugin';
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

import { AssetGlobPattern, BuildBuilderOptions } from './types';
import { getOutputHashFormat } from './hash-format';
import CircularDependencyPlugin = require('circular-dependency-plugin');
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const IGNORED_WEBPACK_WARNINGS = [
  /The comment file/i,
  /could not find any license/i,
];

export function getBaseWebpackPartial(
  options: BuildBuilderOptions,
  esm?: boolean,
  isScriptOptimizeOn?: boolean,
  configuration?: string
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
  const mode = isScriptOptimizeOn ? 'production' : 'development';

  const webpackConfig: Configuration = {
    entry: {
      main: [options.main],
    },
    devtool: options.sourceMap ? 'source-map' : false,
    mode,
    output: {
      path: options.outputPath,
      filename,
      chunkFilename,
    },
    module: {
      rules: [
        {
          test: /\.([jt])sx?$/,
          loader: join(__dirname, 'web-babel-loader'),
          exclude: /node_modules/,
          options: {
            rootMode: 'upward',
            cwd: join(options.root, options.sourceRoot),
            isModern: esm,
            envName: configuration || 'development',
            babelrc: true,
            cacheDirectory: true,
            cacheCompression: false,
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
      // Search closest node_modules first, and then fallback to to default node module resolution scheme.
      // This ensures we are pulling the correct versions of dependencies, such as `core-js`.
      modules: [resolve(__dirname, '..', '..', 'node_modules'), 'node_modules'],
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
      new webpack.DefinePlugin(getClientEnvironment(mode).stringified),
    ],
    watch: options.watch,
    watchOptions: {
      poll: options.poll,
    },
    stats: getStatsConfig(options),
  };

  if (isScriptOptimizeOn) {
    webpackConfig.optimization = {
      minimizer: [createTerserPlugin(esm, !!options.sourceMap)],
      runtimeChunk: true,
    };
  }

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

  if (options.assets) {
    extraPlugins.push(createCopyPlugin(options.assets));
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

export function createTerserPlugin(esm: boolean, sourceMap: boolean) {
  return new TerserWebpackPlugin({
    parallel: true,
    cache: true,
    sourceMap,
    terserOptions: {
      ecma: esm ? 8 : 5,
      // Don't remove safari 10 workaround for ES modules
      safari10: true,
      output: {
        ascii_only: true,
        comments: false,
        webkit: true,
      },
    },
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
    usedExports: !!options.verbose,
    warningsFilter: IGNORED_WEBPACK_WARNINGS,
  };
}

// This is shamelessly taken from CRA and modified for NX use
// https://github.com/facebook/create-react-app/blob/4784997f0682e75eb32a897b4ffe34d735912e6c/packages/react-scripts/config/env.js#L71
function getClientEnvironment(mode) {
  // Grab NODE_ENV and NX_* environment variables and prepare them to be
  // injected into the application via DefinePlugin in webpack configuration.
  const NX_APP = /^NX_/i;

  const raw = Object.keys(process.env)
    .filter((key) => NX_APP.test(key))
    .reduce(
      (env, key) => {
        env[key] = process.env[key];
        return env;
      },
      {
        // Useful for determining whether we’re running in production mode.
        NODE_ENV: process.env.NODE_ENV || mode,
      }
    );

  // Stringify all values so we can feed into webpack DefinePlugin
  const stringified = {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };

  return { stringified };
}

export function createCopyPlugin(assets: AssetGlobPattern[]) {
  return new CopyWebpackPlugin({
    patterns: assets.map((asset) => {
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
}
