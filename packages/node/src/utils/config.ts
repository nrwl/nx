import type { Configuration, WebpackPluginInstance } from 'webpack';
import * as webpack from 'webpack';
import * as ts from 'typescript';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';

import { readTsConfig } from '@nrwl/workspace/src/utilities/typescript';
import { BuildBuilderOptions } from './types';
import { loadTsPlugins } from './load-ts-plugins';

// Inlining tsconfig-paths-webpack-plugin with a patch
// See: https://github.com/dividab/tsconfig-paths-webpack-plugin/pull/85
// TODO(jack): Remove once the patch lands in original package
import TsConfigPathsPlugin from './webpack/plugins/tsconfig-paths/tsconfig-paths.plugin';
import { getSwcRuleLoader } from './swc';
import CopyWebpackPlugin = require('copy-webpack-plugin');
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

export const OUT_FILENAME_TEMPLATE = '[name].js';

export function getBaseWebpackPartial(
  options: BuildBuilderOptions
): Configuration {
  const { options: compilerOptions } = readTsConfig(options.tsConfig);
  const supportsEs2015 =
    compilerOptions.target !== ts.ScriptTarget.ES3 &&
    compilerOptions.target !== ts.ScriptTarget.ES5;
  const mainFields = [...(supportsEs2015 ? ['es2015'] : []), 'module', 'main'];
  const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];

  let transpileRuleLoader: { loader: string; options?: object };

  if (options.experimentalSwc) {
    transpileRuleLoader = getSwcRuleLoader();
  } else {
    const { compilerPluginHooks, hasPlugin } = loadTsPlugins(options.tsPlugins);
    transpileRuleLoader = {
      loader: require.resolve(`ts-loader`),
      options: {
        configFile: options.tsConfig,
        transpileOnly: !hasPlugin,
        // https://github.com/TypeStrong/ts-loader/pull/685
        experimentalWatchApi: true,
        getCustomTransformers: (program) => ({
          before: compilerPluginHooks.beforeHooks.map((hook) => hook(program)),
          after: compilerPluginHooks.afterHooks.map((hook) => hook(program)),
          afterDeclarations: compilerPluginHooks.afterDeclarationsHooks.map(
            (hook) => hook(program)
          ),
        }),
      },
    };
  }

  const additionalEntryPoints =
    options.additionalEntryPoints?.reduce(
      (obj, current) => ({
        ...obj,
        [current.entryName]: current.entryPath,
      }),
      {} as { [entryName: string]: string }
    ) ?? {};
  const webpackConfig: Configuration = {
    entry: {
      main: [options.main],
      ...additionalEntryPoints,
    },
    devtool: options.sourceMap ? 'source-map' : false,
    mode: options.optimization ? 'production' : 'development',
    output: {
      path: options.outputPath,
      filename:
        options.additionalEntryPoints?.length > 0
          ? OUT_FILENAME_TEMPLATE
          : options.outputFileName,
      hashFunction: 'xxhash64',
      // Disabled for performance
      pathinfo: false,
    },
    module: {
      // Enabled for performance
      unsafeCache: true,
      rules: [
        {
          test: /\.([jt])sx?$/,
          exclude: /node_modules/,
          ...transpileRuleLoader,
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
        typescript: {
          enabled: true,
          configFile: options.tsConfig,
          memoryLimit: options.memoryLimit || 2018,
        },
      }),
    ],
    watch: options.watch,
    watchOptions: {
      poll: options.poll,
    },
    stats: getStatsConfig(options),
    experiments: {
      cacheUnaffected: true,
    },
  };

  const extraPlugins: WebpackPluginInstance[] = [];

  if (options.progress) {
    extraPlugins.push(new webpack.ProgressPlugin());
  }

  if (options.extractLicenses) {
    extraPlugins.push(
      new LicenseWebpackPlugin({
        stats: {
          errors: false,
        },
        perChunkOutput: false,
        outputFilename: `3rdpartylicenses.txt`,
      }) as unknown as WebpackPluginInstance
    );
  }

  // process asset entries
  if (Array.isArray(options.assets) && options.assets.length > 0) {
    const copyWebpackPluginInstance = new CopyWebpackPlugin({
      patterns: options.assets.map((asset) => {
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
              ...(asset.ignore ?? []),
            ],
            dot: true,
          },
        };
      }),
    });

    new CopyWebpackPlugin({
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
              ...(asset.ignore ?? []),
            ],
            dot: true,
          },
        };
      }),
    });
    extraPlugins.push(copyWebpackPluginInstance);
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

function getStatsConfig(options: BuildBuilderOptions) {
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
