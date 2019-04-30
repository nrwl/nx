import * as webpack from 'webpack';
import { Configuration, ProgressPlugin } from 'webpack';

import * as ts from 'typescript';
import { resolve } from 'path';

import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import CircularDependencyPlugin = require('circular-dependency-plugin');
import ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
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
  const webpackConfig: Configuration = {
    entry: {
      main: [options.main]
    },
    devtool: options.sourceMap ? 'source-map' : false,
    mode: options.optimization ? 'production' : 'development',
    output: {
      path: options.outputPath,
      filename: OUT_FILENAME
    },
    module: {
      rules: [
        {
          test: /\.(j|t)sx?$/,
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
      extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx'],
      alias: getAliases(options, compilerOptions),
      mainFields: [...(supportsEs2015 ? ['es2015'] : []), 'module', 'main']
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
    }
  };

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

function getAliases(
  options: BuildBuilderOptions,
  compilerOptions: ts.CompilerOptions
): { [key: string]: string } {
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
