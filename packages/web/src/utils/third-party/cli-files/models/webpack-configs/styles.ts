/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as path from 'path';
import * as webpack from 'webpack';
import {
  PostcssCliResources,
  RawCssLoader,
  RemoveHashPlugin,
  SuppressExtractedTextChunksWebpackPlugin,
} from '../../plugins/webpack';
import { WebpackConfigOptions } from '../build-options';
import { getOutputHashFormat, normalizeExtraEntryPoints } from './utils';

const autoprefixer = require('autoprefixer');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const postcssImports = require('postcss-import');

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 *
 * require('style-loader')
 * require('postcss-loader')
 * require('stylus')
 * require('stylus-loader')
 * require('less')
 * require('less-loader')
 * require('node-sass')
 * require('sass-loader')
 */
// tslint:disable-next-line:no-big-function
export function getStylesConfig(wco: WebpackConfigOptions) {
  const { root, buildOptions } = wco;
  const entryPoints: { [key: string]: string[] } = {};
  const globalStylePaths: string[] = [];
  const extraPlugins = [];

  const cssSourceMap = buildOptions.sourceMap.styles;

  // Determine hashing format.
  const hashFormat = getOutputHashFormat(buildOptions.outputHashing as string);

  const postcssPluginCreator = function (loader: webpack.loader.LoaderContext) {
    return [
      postcssImports({
        resolve: (url: string) => (url.startsWith('~') ? url.substr(1) : url),
        load: (filename: string) => {
          return new Promise<string>((resolve, reject) => {
            loader.fs.readFile(filename, (err: Error, data: Buffer) => {
              if (err) {
                reject(err);

                return;
              }

              const content = data.toString();
              resolve(content);
            });
          });
        },
      }),
      PostcssCliResources({
        baseHref: buildOptions.baseHref,
        deployUrl: buildOptions.deployUrl,
        resourcesOutputPath: buildOptions.resourcesOutputPath,
        loader,
        rebaseRootRelative: buildOptions.rebaseRootRelativeCssUrls,
        filename: `[name]${hashFormat.file}.[ext]`,
      }),
      autoprefixer(),
    ];
  };

  // use includePaths from appConfig
  const includePaths: string[] = [];
  let lessPathOptions: { paths?: string[] } = {};

  if (
    buildOptions.stylePreprocessorOptions &&
    buildOptions.stylePreprocessorOptions.includePaths &&
    buildOptions.stylePreprocessorOptions.includePaths.length > 0
  ) {
    buildOptions.stylePreprocessorOptions.includePaths.forEach(
      (includePath: string) =>
        includePaths.push(path.resolve(root, includePath))
    );
    lessPathOptions = {
      paths: includePaths,
    };
  }

  // Process global styles.
  if (buildOptions.styles.length > 0) {
    const chunkNames: string[] = [];

    normalizeExtraEntryPoints(buildOptions.styles, 'styles').forEach(
      (style) => {
        const resolvedPath = path.resolve(root, style.input);
        // Add style entry points.
        if (entryPoints[style.bundleName]) {
          entryPoints[style.bundleName].push(resolvedPath);
        } else {
          entryPoints[style.bundleName] = [resolvedPath];
        }

        // Add non injected styles to the list.
        if (!style.inject) {
          chunkNames.push(style.bundleName);
        }

        // Add global css paths.
        globalStylePaths.push(resolvedPath);
      }
    );

    if (chunkNames.length > 0) {
      // Add plugin to remove hashes from lazy styles.
      extraPlugins.push(new RemoveHashPlugin({ chunkNames, hashFormat }));
    }
  }

  let sassImplementation: {} | undefined;
  let fiber: {} | undefined;
  try {
    // tslint:disable-next-line:no-implicit-dependencies
    sassImplementation = require('node-sass');
  } catch {
    sassImplementation = require('sass');

    try {
      // tslint:disable-next-line:no-implicit-dependencies
      fiber = require('fibers');
    } catch {}
  }

  // set base rules to derive final rules from
  const baseRules: webpack.RuleSetRule[] = [
    { test: /\.css$/, use: [] },
    {
      test: /\.scss$|\.sass$/,
      use: [
        {
          loader: require.resolve('sass-loader'),
          options: {
            implementation: sassImplementation,
            sourceMap: cssSourceMap,
            sassOptions: {
              fiber,
              // bootstrap-sass requires a minimum precision of 8
              precision: 8,
              includePaths,
            },
          },
        },
      ],
    },
    {
      test: /\.less$/,
      use: [
        {
          loader: require.resolve('less-loader'),
          options: {
            sourceMap: cssSourceMap,
            javascriptEnabled: true,
            ...lessPathOptions,
          },
        },
      ],
    },
    {
      test: /\.styl$/,
      use: [
        {
          loader: require.resolve('stylus-loader'),
          options: {
            sourceMap: cssSourceMap,
            paths: includePaths,
          },
        },
      ],
    },
  ];

  // load component css as raw strings
  const rules: webpack.RuleSetRule[] = baseRules.map(({ test, use }) => ({
    exclude: globalStylePaths,
    test,
    use: [
      { loader: require.resolve('raw-loader') },
      {
        loader: require.resolve('postcss-loader'),
        options: {
          ident: 'embedded',
          plugins: postcssPluginCreator,
          sourceMap:
            cssSourceMap &&
            // Never use component css sourcemap when style optimizations are on.
            // It will just increase bundle size without offering good debug experience.
            !buildOptions.optimization.styles &&
            // Inline all sourcemap types except hidden ones, which are the same as no sourcemaps
            // for component css.
            !buildOptions.sourceMap.hidden
              ? 'inline'
              : false,
        },
      },
      ...(use as webpack.Loader[]),
    ],
  }));

  // load global css as css files
  if (globalStylePaths.length > 0) {
    rules.push(
      ...baseRules.map(({ test, use }) => {
        return {
          include: globalStylePaths,
          test,
          use: [
            buildOptions.extractCss
              ? MiniCssExtractPlugin.loader
              : require.resolve('style-loader'),
            RawCssLoader,
            {
              loader: require.resolve('postcss-loader'),
              options: {
                ident: buildOptions.extractCss ? 'extracted' : 'embedded',
                plugins: postcssPluginCreator,
                sourceMap:
                  cssSourceMap &&
                  !buildOptions.extractCss &&
                  !buildOptions.sourceMap.hidden
                    ? 'inline'
                    : cssSourceMap,
              },
            },
            ...(use as webpack.Loader[]),
          ],
        };
      })
    );
  }

  if (buildOptions.extractCss) {
    extraPlugins.push(
      // extract global css from js files into own css file
      new MiniCssExtractPlugin({ filename: `[name]${hashFormat.extract}.css` }),
      // suppress empty .js files in css only entry points
      new SuppressExtractedTextChunksWebpackPlugin()
    );
  }

  return {
    entry: entryPoints,
    module: { rules },
    plugins: extraPlugins,
  };
}
